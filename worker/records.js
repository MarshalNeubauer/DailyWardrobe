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
    const v = await env.WARDROBE.get(kk, 'arrayBuffer');
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
    return json({ keys: keys.filter(k => COMBO_RE.test(k)) });
  }
  const id = renderId({ key: q.get('key'), day: q.get('day') });
  if (!id) return json({ error: 'bad key' }, 400);
  const rec = await env.WARDROBE.get(`${ns}render:${id}`, 'json');
  return rec ? json(rec) : json({ error: 'none' }, 404);
}

export { COMBO_RE, delRender, getRender, handleBlob, putRender, renderId, renderTtl };
