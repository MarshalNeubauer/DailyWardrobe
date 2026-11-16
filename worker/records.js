/* Daily Wardrobe worker: kept photo records (render:<key>) and blobs: GET/PUT/DELETE /render, GET/PUT /blob.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { ownerOnly, spend, spendEach } from './people.js';

/* photos are stored per outfit combination ("c" + 16 hex digits, kept until replaced); older ones were per date (90 days) */
const COMBO_RE = /^c[0-9a-f]{16}$/, DAY_RE = /^\d{4}-\d{1,2}-\d{1,2}$/;
/* ---- records coming in (fix round 3, the audit's W2-13-02 / W2-13-06): the same shapes as the app's core.js cleanRecord. A picture is a
   whole data:image/jpeg|png|webp;base64 string; a backup's item has an id of safe characters, a type key (or none), colour and option keys of
   letters, digits, - and _, pictures as above (or the backup's own dwph: reference), numbers as numbers and a pattern reading of hex
   colours and plain words; a day a date of the app's shape and item ids of the id shape. recCheck -> null, or what is wrong (the
   server refuses the save with a plain message; the app checks the same before anything is sent, so its own records always pass) ---- */
const PIC_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]*$/, REF_RE = /^dwph:[0-9a-f]{20}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/, KEY_RE = /^[\p{L}\p{M}\p{N}_-]{1,48}$/u, HEX_RE = /^#[0-9a-fA-F]{3,8}$/, DATE_RE = DAY_RE;
const WORD_RE = /^[\p{L}\p{M}\p{N} _+.,:;()\/#%’-]{0,120}$/u, BAD_CH = /[<>"`]/;
const COLS = ['primaryColor', 'secondaryColor', 'tertiaryColor', 'dial'], PICS = ['photo', 'photoSm', 'texture', 'swatch'],
  KEYS = ['pattern', 'swSrc', 'metal', 'leather', 'cuff', 'vest', 'season', 'shoeStyle', 'trouserKind', 'band', 'bezel', 'watchStyle'],
  NUMS = ['added', 'updated', 'shade'], TEXT = ['name', 'brand', 'material', 'notes', 'details', 'patternText'];
const colOk = c => c == null || c === '' || typeof c === 'string' && (KEY_RE.test(c) || /^[a-z ]{1,30}$/i.test(c));   // (a colour word, "light blue": the app makes it a key)
const strictOk = (v, d = 0) => typeof v === 'string' ? HEX_RE.test(v) || WORD_RE.test(v) : typeof v === 'number' ? isFinite(v) : v == null || typeof v === 'boolean' ? true : d > 8 ? false
  : Array.isArray(v) ? v.every(x => strictOk(x, d + 1)) : typeof v === 'object' ? Object.entries(v).every(([k, x]) => WORD_RE.test(k) && strictOk(x, d + 1)) : false;
const freeOk = (v, d = 0) => typeof v === 'string' ? !BAD_CH.test(v) : typeof v === 'number' ? isFinite(v) : v == null || typeof v === 'boolean' ? true : d > 8 ? false
  : Array.isArray(v) ? v.every(x => freeOk(x, d + 1)) : typeof v === 'object' ? Object.entries(v).every(([k, x]) => WORD_RE.test(k) && freeOk(x, d + 1)) : false;
// (core.js recProse: prose may hold quotes, nothing that opens a tag; a "hex" a hex colour)
const PROSE = ['weave', 'patternSpec', 'tagAI', 'meas', 'away'];
const proseOk = (v, d = 0, k = '') => typeof v === 'string' ? (/^hex$/i.test(k) ? HEX_RE.test(v) : !/[<>`]/.test(v)) : typeof v === 'number' ? isFinite(v) : v == null || typeof v === 'boolean' ? true : d > 8 ? false
  : Array.isArray(v) ? v.every(x => proseOk(x, d + 1, k)) : typeof v === 'object' ? Object.entries(v).every(([kk, x]) => WORD_RE.test(kk) && proseOk(x, d + 1, kk)) : false;
function itemWrong(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return 'an item that is not a record';
  if (typeof it.id !== 'string' || !ID_RE.test(it.id)) return 'an item id';
  if (it.type != null && !(typeof it.type === 'string' && KEY_RE.test(it.type))) return 'an item type';   // (an unknown type the app leaves out when it reads it)
  for (const [k, v] of Object.entries(it)) {
    if (k === 'id' || k === 'type') continue;
    if (!WORD_RE.test(k) || k === '__proto__') return 'a field name';
    if (COLS.includes(k)) { if (!colOk(v)) return 'a color'; }
    else if (PICS.includes(k)) { if (v != null && !(typeof v === 'string' && (PIC_RE.test(v) || REF_RE.test(v)))) return 'a photo'; }
    else if (KEYS.includes(k)) { if (v != null && !(typeof v === 'string' && KEY_RE.test(v))) return 'a ' + k; }
    else if (NUMS.includes(k)) { if (v != null && !(typeof v === 'number' && isFinite(v))) return 'a number'; }
    else if (TEXT.includes(k)) { if (v != null && typeof v !== 'string' && typeof v !== 'number') return 'a text field'; }
    else if (k === 'sett') { if (!strictOk(v)) return 'a pattern reading'; }
    else if (PROSE.includes(k)) { if (!proseOk(v)) return 'the field ' + k; }
    else if (!freeOk(v)) return 'the field ' + k;
  }
  return null;
}
function dayWrong(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.date !== 'string' || !DATE_RE.test(d.date)) return 'a day';
  for (const [k, v] of Object.entries(d)) {
    if (k === 'date') continue;
    if (!WORD_RE.test(k) || k === '__proto__') return 'a field name';
    if ((k === 'ids' || k === 'lock' || k === 'force') && v && typeof v === 'object') { if (Object.entries(v).some(([s, x]) => !KEY_RE.test(s) || typeof x === 'string' && !ID_RE.test(x) || !freeOk(x))) return 'a day’s pieces'; }
    else if (!freeOk(v)) return 'a day';
  }
  return null;
}
/* a backup (or part of one: {items, days, tombstones}) -> null when every record is of the app's shape, else a plain refusal body */
function recCheck(data) {
  if (!data || typeof data !== 'object') return null;
  let w = null;
  for (const it of Array.isArray(data.items) ? data.items : []) if ((w = itemWrong(it))) break;
  if (!w) for (const d of Array.isArray(data.days) ? data.days : []) if ((w = dayWrong(d))) break;
  if (!w && data.tombstones && typeof data.tombstones === 'object') for (const [id, t] of Object.entries(data.tombstones)) if (!ID_RE.test(id) || typeof t !== 'number' || !isFinite(t)) { w = 'a deletion mark'; break; }
  return w ? { error: 'bad record', what: w, message: 'The backup was not saved: it holds a record the app doesn’t make (' + w + '). Update the app and try again.' } : null;
}
/* a picture sent with a backup (its JSON string's bytes, quotes included, or the string): the whole of it a picture */
function picBytesOk(b) {
  const s = typeof b === 'string' ? b : new TextDecoder().decode(b);
  const t = s.length > 1 && s[0] === '"' && s[s.length - 1] === '"' ? s.slice(1, -1) : s;
  return PIC_RE.test(t);
}
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
  // the whole string a picture (fix round 3, W2-13-06: any text after the prefix was kept, and the app put it into src)
  if (!id || !rec || typeof rec.img !== 'string' || !PIC_RE.test(rec.img)) return json({ error: 'bad photo', message: 'That is not a picture the app can keep.' }, 400);
  const cur = await env.WARDROBE.get(`${ns}render:${id}`, 'json');
  if (cur && (cur.t || 0) >= (rec.t || 0)) return json({ ok: true, kept: 'newer' });
  const over = await spendEach(env, who, [['upload', 1], ['write', 1]]); if (over) return json(over.body, over.status);   // every upload is a KV write
  await env.WARDROBE.put(`${ns}render:${id}`, JSON.stringify({ sig: String(rec.sig || '').slice(0, 2000), img: rec.img, model: String(rec.model || '').slice(0, 80), t: +rec.t || Date.now() }), renderTtl(id));
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

export { COMBO_RE, PIC_RE, SHARED_KEY, delRender, getRender, handleBlob, handleShared, picBytesOk, putRender, recCheck, renderId, renderTtl };
