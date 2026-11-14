/* Daily Wardrobe worker: kept photo records (render:<key>) and blobs: GET/PUT/DELETE /render, GET/PUT /blob.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { ownerOnly, spend, spendEach } from './people.js';

/* photos are stored per outfit combination ("c" + 16 hex digits, kept until replaced); older ones were per date (90 days) */
const COMBO_RE = /^c[0-9a-f]{16}$/, DAY_RE = /^\d{4}-\d{1,2}-\d{1,2}$/;
const renderId = o => { const k = String(o && o.key || ''), d = String(o && o.day || ''); return COMBO_RE.test(k) ? k : DAY_RE.test(d) ? d : null; };
/* dated copies go after 90 days; test photos (keys starting c7e57, made to compare models or methods) after 7 */
const renderTtl = id => (DAY_RE.test(id) ? { expirationTtl: 90 * 86400 } : /^c7e57/.test(id) ? { expirationTtl: 7 * 86400 } : undefined);
/* PUT /render {key, rec}: a device uploads a photo the worker doesn't have yet */
async function putRender(req, env, json, who) {
  const ns = who.ns;
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 501);
  const text = await req.text();
  if (text.length > 4e6) return json({ error: 'photo too large' }, 413);
  let b; try { b = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  const rec = b && b.rec;
  const id = renderId(b);
  if (!id || !rec || !/^data:image\/(jpeg|png|webp);base64,/.test(String(rec.img || ''))) return json({ error: 'bad photo' }, 400);
  const cur = await env.WARDROBE.get(`${ns}render:${id}`, 'json');
  if (cur && (cur.t || 0) >= (rec.t || 0)) return json({ ok: true, kept: 'newer' });
  const over = await spendEach(env, who, [['upload', 1], ['write', 1]]); if (over) return json(over.body, over.status);   // every upload is a KV write
  await env.WARDROBE.put(`${ns}render:${id}`, JSON.stringify({ sig: String(rec.sig || ''), img: rec.img, model: String(rec.model || ''), t: +rec.t || Date.now() }), renderTtl(id));
  return json({ ok: true });
}
/* DELETE /render?key=c... -> the kept photo is removed (one that was made wrong; the app stops using its own copies by changing the key) */
async function delRender(req, env, json, who) {
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 501);
  const k = new URL(req.url).searchParams.get('key') || '';
  if (!COMBO_RE.test(k)) return json({ error: 'bad key' }, 400);
  // a delete is one of the day's KV writes even when there is nothing to delete: a tester's count (1,200 went through unrefused)
  const over = await spend(env, who, 'write'); if (over) return json(over.body, over.status);
  await env.WARDROBE.delete(`${who.ns}render:${k}`);
  return json({ ok: true });
}
/* GET /render?key=c... (or the older ?day=) -> the stored photo, or 404 */
/* GET /blob?key=<c + 16 hex>: the stored bytes (application/octet-stream), 404 when none. PUT /blob?key=…&sig=…, the bytes as the body
   (owner only, at most BLOB_MAX): a colour-coded master's setup packed by the computer for phones (asm-color.js asmCmSetupBlob, 2026-11-14),
   about 5 MB. Raw bytes, nothing parsed: a JSON body of that size is more than a request's CPU on the free plan. The same signature
   already stored is not written again (one KV write a master each time its setup changes) */
const BLOB_MAX = 20e6;
async function handleBlob(req, env, json, who, cors) {
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 501);
  const q = new URL(req.url).searchParams, key = q.get('key') || '';
  if (!COMBO_RE.test(key)) return json({ error: 'bad key' }, 400);
  const kk = `${who.ns}blob:${key}`;
  if (req.method === 'GET') {
    // every blob is the owner's (writes are owner only), and every one is a master's setup for phones: a tester reads the owner's
    // (their own prefix can never hold one). If a blob ever holds anything private, this must change
    const v = await env.WARDROBE.get(`blob:${key}`, 'arrayBuffer');
    return v ? new Response(v, { headers: { ...cors, 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } }) : json({ error: 'none' }, 404);
  }
  const no = ownerOnly(who, json); if (no) return no;
  const sig = String(q.get('sig') || '').slice(0, 300), body = await req.arrayBuffer();
  if (!body.byteLength) return json({ error: 'empty' }, 400);
  if (body.byteLength > BLOB_MAX) return json({ error: 'too large' }, 413);
  const cur = typeof env.WARDROBE.getWithMetadata === 'function' ? await env.WARDROBE.getWithMetadata(kk, 'stream').catch(() => null) : null;
  if (cur && cur.value && cur.value.cancel) cur.value.cancel().catch(() => { });
  if (cur && cur.metadata && cur.metadata.sig === sig && sig) return json({ ok: true, kept: 'same' });
  await env.WARDROBE.put(kk, body, { metadata: { sig, t: Date.now(), size: body.byteLength } });
  return json({ ok: true, size: body.byteLength });
}
async function getRender(req, env, json, who) {
  const ns = who.ns;
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 404);
  const q = new URL(req.url).searchParams;
  // GET /render?list=1 -> {keys}: every outfit or item photo kept here, so a device can download the ones it lacks in one go
  if (q.get('list')) {
    if (typeof env.WARDROBE.list !== 'function') return json({ error: 'listing not available' }, 501);
    const over = await spend(env, who, 'list'); if (over) return json(over.body, over.status);   // KV lists are rationed too (1,000 a day)
    const keys = []; let cursor;
    try { do { const page = await env.WARDROBE.list({ prefix: `${ns}render:c`, cursor }); for (const k of page.keys) keys.push(k.name.slice(ns.length + 7)); cursor = page.list_complete ? null : page.cursor; } while (cursor && keys.length < 20000); }
    catch (e) { return json({ error: 'listing not available right now', detail: String(e && e.message) }, 503); }   // the daily list allowance: the app then asks per photo
    // a tester's list also names the owner's shared master records (one cached read, not a list): their phone then marks them held
    const own = keys.filter(k => COMBO_RE.test(k));
    if (!ns) return json({ keys: own });
    const mine = new Set(own); for (const k of await sharedKeys(env)) if (!mine.has(k)) own.push(k);
    return json({ keys: own });
  }
  const id = renderId({ key: q.get('key'), day: q.get('day') });
  if (!id) return json({ error: 'bad key' }, 400);
  let rec = await env.WARDROBE.get(`${ns}render:${id}`, 'json');
  // a tester reads the owner's colour-coded master records (only the keys in cm:shared) when they have no copy of their own
  if (!rec && ns && (await sharedKeys(env)).has(id)) rec = await env.WARDROBE.get(`render:${id}`, 'json');
  return rec ? json(rec) : json({ error: 'none' }, 404);
}

/* ---- the owner's colour-coded masters, shared with testers (2026-11-14). tools/asm-cm-upload.js writes SHARED_KEY = {keys, t}: exactly
   the render keys that are master assets (each master, mask, part, geo/u|v and light, the 2048 copies, the background, the manifest).
   A tester's GET /render?key= of one of them falls back to the owner's record, and their GET /render?list=1 includes them, so a tester's
   phone paints as the owner's does. Nothing else ever falls back (outfit pictures, item photos, backups, snapshots, jobs). Owner-only
   GET/PUT /cm-shared; a PUT that changes nothing writes nothing. Read at most once a minute per isolate (SHARED_MS) */
const SHARED_KEY = 'cm:shared', SHARED_MS = 60e3, SHARED_MAX = 2000;
const sharedCache = new WeakMap();   // the KV binding -> {at, set}
async function sharedKeys(env) {
  const kv = env.WARDROBE, c = sharedCache.get(kv);
  if (c && Date.now() - c.at < SHARED_MS) return c.set;
  let set = new Set();
  try { const v = await kv.get(SHARED_KEY, 'json'); if (v && Array.isArray(v.keys)) set = new Set(v.keys.filter(k => COMBO_RE.test(k))); } catch { }
  sharedCache.set(kv, { at: Date.now(), set });
  return set;
}
async function handleShared(req, env, json, who) {
  const no = ownerOnly(who, json); if (no) return no;
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 501);
  if (req.method === 'GET') { const v = await env.WARDROBE.get(SHARED_KEY, 'json'); return v ? json(v) : json({ error: 'none' }, 404); }
  let b; try { b = JSON.parse(await req.text()); } catch { return json({ error: 'bad json' }, 400); }
  const keys = Array.isArray(b && b.keys) ? [...new Set(b.keys.map(String))].sort() : null;
  if (!keys || keys.length > SHARED_MAX || !keys.every(k => COMBO_RE.test(k))) return json({ error: 'bad keys' }, 400);
  const cur = await env.WARDROBE.get(SHARED_KEY, 'json');
  if (cur && Array.isArray(cur.keys) && [...cur.keys].sort().join() === keys.join()) return json({ ok: true, kept: 'same', n: keys.length });
  await env.WARDROBE.put(SHARED_KEY, JSON.stringify({ keys, t: Date.now() }));
  sharedCache.set(env.WARDROBE, { at: Date.now(), set: new Set(keys) });
  return json({ ok: true, n: keys.length });
}

export { COMBO_RE, SHARED_KEY, delRender, getRender, handleBlob, handleShared, putRender, renderId, renderTtl };
