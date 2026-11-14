/* Daily Wardrobe worker: the backup: its version, large backups in parts, daily snapshots, the small sync (syncLite) and the write budget.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { PV, asText, isPv, loadAny, phKey, putWhole, pvMeta, pvResponse, pvText, refsOf, scanPhotos, storePhotos } from './photostore.js';
import { countWrites, limitBody, sha256Hex, spend, spendUpTo, unspend, utcDay } from './people.js';

const SYNC_KEY = 'wardrobe:v1', SYNC_NONE = '{"rev":0,"saved":0,"data":null}';
/* the stored backup's version {rev, saved} without loading the backup (several MB of photos): KV keeps it as the key's
   metadata, written in the same put as the backup itself. null for a backup saved before this, or where KV can't list. */
/* a key's metadata by a read, without loading its value (the value comes as a stream that is never read): null when the key is not
   there, {} when it has none; undefined when it can't be told this way (a KV without getWithMetadata) and the caller lists instead.
   KV lists are capped at 1,000 a day for everyone together, reads at 100,000: with testers a list per sync would use them up. */
async function kvMeta(env, key) {
  if (typeof env.WARDROBE.getWithMetadata !== 'function') return undefined;
  try {
    const r = await env.WARDROBE.getWithMetadata(key, { type: 'stream' });
    if (!r) return undefined;
    if (r.value && typeof r.value.cancel === 'function') r.value.cancel().catch(() => { });
    return r.value == null ? null : r.metadata || {};
  } catch { return undefined; }
}
async function syncVersion(env, ns = '') { return storedVersion(env, ns + SYNC_KEY); }
/* a stored backup's (or dated copy's) metadata {rev, saved, parts?}, or null */
async function storedVersion(env, key) {
  const got = await kvMeta(env, key);
  if (got !== undefined) return got && Number.isInteger(got.rev) ? got : null;
  if (typeof env.WARDROBE.list !== 'function') return null;
  try {
    const l = await env.WARDROBE.list({ prefix: key, limit: 10 }), k = (l.keys || []).find(x => x.name === key), m = k && k.metadata;
    return m && Number.isInteger(m.rev) ? m : null;
  } catch { return null; }
}
/* ---- large backups. KV keeps at most 25 MiB in one value, so a backup over PART_MAX is stored in parts: the first under the
   key itself, whose metadata says {rev, saved, parts: n}, the others as <key>~<rev>~<i>. The parts are written before the key,
   and carry the rev, so a reader never mixes two versions. Each part is one KV write, so a 48 MB backup costs 3 writes a save
   instead of 1 (and 2 deletes of the version before). Up to PART_MAX nothing changes: one value, as before. The stored text is the same either way: {"rev":…,"saved":…,"data":…}. ---- */
const BACKUP_MAX = 48 * 1024 * 1024, PART_MAX = 20 * 1024 * 1024;
const partKey = (key, rev, i) => `${key}~${rev}~${i}`;
const isParted = m => !!(m && Number.isInteger(m.parts) && m.parts > 1);
const asBytes = v => typeof v === 'string' ? new TextEncoder().encode(v) : new Uint8Array(v);
/* the stored bytes of a parted value as a stream, part by part (never all in memory); lead goes first, and skip drops that many
   bytes from the start of the first part */
function partedStream(env, key, m, lead = '', skip = 0) {
  let i = 0;
  return new ReadableStream({
    async pull(c) {
      if (i === 0 && lead) c.enqueue(new TextEncoder().encode(lead));
      if (i >= m.parts) { c.close(); return; }
      const v = await env.WARDROBE.get(i ? partKey(key, m.rev, i) : key, 'arrayBuffer');
      if (v == null) { c.error(new Error('a part of the backup is missing')); return; }
      let b = asBytes(v); if (i === 0 && skip) b = b.subarray(skip);
      i++; c.enqueue(b);
    }
  });
}
/* copy a stored value (one or in parts) to another key: the dated copies */
async function copyStored(env, from, to, m, opt) {
  const meta = { rev: m.rev, saved: m.saved, ...(isParted(m) ? { parts: m.parts } : {}), ...(isPv(m) ? { pv: PV } : {}) };
  if (!isParted(m)) { const cur = await env.WARDROBE.get(from); if (cur && cur !== SYNC_NONE) await env.WARDROBE.put(to, cur, { ...opt, metadata: meta }); return; }
  for (let i = 1; i < m.parts; i++) { const v = await env.WARDROBE.get(partKey(from, m.rev, i), 'arrayBuffer'); if (v == null) return; await env.WARDROBE.put(partKey(to, m.rev, i), v, opt); }
  const v = await env.WARDROBE.get(from, 'arrayBuffer'); if (v != null) await env.WARDROBE.put(to, v, { ...opt, metadata: meta });
}
/* the parts of the version before, once a new one is stored */
async function dropParts(env, key, old) {
  if (!isParted(old)) return;
  for (let i = 1; i < old.parts; i++) try { await env.WARDROBE.delete(partKey(key, old.rev, i)); } catch { }
}
/* a stored value as a response: passed through as stored (a parted one streamed), with lead in front of it instead of its
   opening brace when given ({"error":"conflict", …}) */
async function storedResponse(env, key, m, cors, lead, status = 200) {
  const headers = { ...cors, 'content-type': 'application/json' };
  if (isPv(m)) return pvResponse(env, key, m, cors, lead, status);   // photos by reference: rebuilt whole, as it always was sent
  if (isParted(m)) return new Response(partedStream(env, key, m, lead || '', lead ? 1 : 0), { status, headers });
  const t = (await env.WARDROBE.get(key)) || SYNC_NONE;
  return new Response(lead ? lead + t.slice(1) : t, { status, headers });
}
/* GET /sync returns the stored backup {rev, saved, data}; GET /sync?v=<rev>:<saved> answers {rev, saved, same:true} with no
   data when that is still the stored version, so a device with nothing new neither downloads nor uploads anything.
   PUT /sync {baseRev, data} stores a new one: baseRev must equal the stored rev, otherwise 409 with the current backup so
   the app can merge and retry (two devices syncing at once never overwrite each other). */
/* dated copies of the backup, so a bad change that reaches the backup can be undone: before the first overwrite of each
   calendar day (the app's own date), the backup as it stood is kept as snap:<YYYY-MM-DD> for 30 days, and the first of each
   month as snap:<YYYY-MM> for a year. A restore from the app (body.reason 'restore') first keeps the backup it replaces as
   snap:before-restore, so a restore can itself be undone. Copied as stored text, not parsed (the backup is several MB). */
const SNAP_DAYS = 30, SNAP_MONTHS = 400, SNAP_DAY = /^\d{4}-\d{2}-\d{2}$/;
/* oldPv: the version being replaced in its by-reference form, when it was stored with its photos inline (a backup converted at this
   save): its copies are kept small too, their photos already stored */
async function keepSnapshots(env, m, body, ns = '', oldPv = null) {
  const day = SNAP_DAY.test(body.day || '') ? body.day : new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
  const want = [[`${ns}snap:${day}`, SNAP_DAYS], [`${ns}snap:${month}`, SNAP_MONTHS]];
  // which of the two are already kept: asked for by a read each where KV can; else by one list, as before
  let have = new Set();
  const seen = await Promise.all(want.map(([k]) => kvMeta(env, k)));
  if (seen.every(s => s !== undefined)) seen.forEach((s, i) => { if (s) have.add(want[i][0]); });
  else try { have = new Set(((await env.WARDROBE.list({ prefix: `${ns}snap:` })).keys || []).map(k => k.name)); } catch { }
  const todo = want.filter(([k]) => !have.has(k));
  if (body.reason === 'restore') todo.push([`${ns}snap:before-restore`, SNAP_DAYS]);
  // -> how many KV writes it made (a tester's are counted, countWrites)
  if (!todo.length) return 0;
  if (oldPv && m && m.saved) { for (const [k, days] of todo) await env.WARDROBE.put(k, oldPv, { expirationTtl: days * 86400, metadata: pvMeta(m.rev, m.saved) }); return todo.length; }
  if (isParted(m)) { if (!m.saved) return 0; for (const [k, days] of todo) await copyStored(env, ns + SYNC_KEY, k, m, { expirationTtl: days * 86400 }); return todo.length * (+m.parts || 1); }
  const cur = await env.WARDROBE.get(ns + SYNC_KEY);
  if (!cur || cur === SYNC_NONE) return 0;                       // nothing stored yet
  let meta = m;
  if (!meta) { try { const o = JSON.parse(cur); meta = { rev: o.rev, saved: o.saved }; } catch { return 0; } }
  if (!meta.saved) return 0;
  for (const [k, days] of todo) await env.WARDROBE.put(k, cur, { expirationTtl: days * 86400, metadata: { rev: meta.rev, saved: meta.saved, ...(isPv(m) ? { pv: PV } : {}) } });
  return todo.length;
}
async function listSnapshots(env, ns = '') {
  const l = await env.WARDROBE.list({ prefix: `${ns}snap:` });
  return (l.keys || []).filter(k => k.metadata && k.metadata.saved).map(k => ({ id: k.name.slice(ns.length + 5), saved: k.metadata.saved, rev: k.metadata.rev }))
    .sort((a, b) => b.saved - a.saved || b.id.localeCompare(a.id));   // same moment: the later date first
}
/* PUT /sync over PART_MAX: the body is never parsed whole (that took more memory than a Worker has). The app sends
   {"baseRev":n,"day":"…"[,"reason":"restore"],"data":…} with data last (sync.js), so the leading fields are read from the first
   bytes, and what follows "data": up to the closing brace is stored as it came, behind {"rev":…,"saved":…,"data":. */
const BIG_HEAD = /^\{"baseRev":(-?\d+),"day":("(?:[^"\\]|\\.)*")(?:,"reason":"(restore)")?,"data":/;
async function putParted(env, json, cors, who, all) {
  const ns = who.ns, KEY = ns + SYNC_KEY, h = BIG_HEAD.exec(new TextDecoder().decode(all.subarray(0, 300)));
  if (!h || all[all.length - 1] !== 0x7d) return json({ error: 'backup too large for this version of the app: update the app (Settings → About)' }, 413);
  const body = { baseRev: +h[1], day: JSON.parse(h[2]), ...(h[3] ? { reason: h[3] } : {}) };
  const m = await syncVersion(env, ns), rev = m ? m.rev : 0;
  if (body.baseRev !== rev) return m ? storedResponse(env, KEY, m, cors, '{"error":"conflict",', 409) : json({ error: 'conflict', rev: 0, saved: 0, data: null }, 409);
  // its photos cut out unparsed and stored by hash: what is left is small, and saved like any other backup
  const sc = await scanPhotos(all);
  if (sc) { let b = null; try { b = JSON.parse(sc.text); } catch { } if (b) return putWhole(env, json, cors, who, b, sc.pre); }
  const snaps = await keepSnapshots(env, m, body, ns);
  const saved = Date.now(), lead = new TextEncoder().encode(`{"rev":${rev + 1},"saved":${saved},"data":`);
  const rest = all.subarray(new TextEncoder().encode(h[0]).length), total = lead.length + rest.length, parts = Math.ceil(total / PART_MAX);
  // part i holds bytes [i*PART_MAX, (i+1)*PART_MAX) of lead+rest; the later parts first, the key (part 0) last
  for (let i = 1; i < parts; i++) await env.WARDROBE.put(partKey(KEY, rev + 1, i), rest.slice(i * PART_MAX - lead.length, (i + 1) * PART_MAX - lead.length).buffer);
  const first = new Uint8Array(Math.min(PART_MAX, total)); first.set(lead); first.set(rest.subarray(0, first.length - lead.length), lead.length);
  await env.WARDROBE.put(KEY, first.buffer, { metadata: { rev: rev + 1, saved, parts } });
  await dropParts(env, KEY, m);
  await countWrites(env, who, snaps + parts);   // (an old app's backup kept in parts: counted, never cut off half way)
  return json({ rev: rev + 1, saved });
}
/* ---- the small sync (sync.js syncLite). The stored backup keeps its form ({"rev","saved","data"}: older apps, the daily copies and
   Roll back read it as before) with one field more before data: "index", the same data with every photo (a "data:" string of PH_MIN
   characters or more, anywhere in it) replaced by a reference dwph:<the first 20 hex of its SHA-256>, each record's revision (revs: the
   rev that last changed it) and where each photo's JSON string lies in the data that follows (ph: hash -> [offset, length], characters
   from data's first). The metadata says where the index is (ls, ll; it is written in ASCII, so characters are bytes) and where data
   starts (ds). A newer app asks GET /sync?lite=1&since=<rev>:<saved> for the records changed since that version, without photos, gets
   the photos it lacks from GET /sync?ph=<hash>,…, and sends only what changed with POST /sync {baseRev, day, reason?, delta, photos}
   (an older worker answers POST 405, so it is never sent one). The worker builds the new backup from the index, the stored photos'
   text and the new photos, without parsing the photos: one KV write a save, as before. ---- */
const PH_MIN = 256, PH_REF = 'dwph:', PH_HEX = /^[0-9a-f]{20}$/, PH_TOKEN = /"dwph:([0-9a-f]{20})"/g;
const isPhoto = s => typeof s === 'string' && s.length >= PH_MIN && s.startsWith('data:');
const phHash = async s => (await sha256Hex(s)).slice(0, 20);
const arrOf = a => Array.isArray(a) ? a : [];
const stampOf = i => i && (i.updated || i.added) || 0;
function phCollect(x, test, out = new Set()) {
  if (typeof x === 'string') { if (test(x)) out.add(x); }
  else if (Array.isArray(x)) for (const v of x) phCollect(v, test, out);
  else if (x && typeof x === 'object') for (const k in x) phCollect(x[k], test, out);
  return out;
}
function phMapStr(x, f) {
  if (typeof x === 'string') return f(x);
  if (Array.isArray(x)) return x.map(v => phMapStr(v, f));
  if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = phMapStr(x[k], f); return o; }
  return x;
}
/* data with its photos replaced by references; photos (hash -> the photo) gets them */
async function splitPhotos(data, photos = new Map()) {
  const strs = [...phCollect(data, isPhoto)], hs = await Promise.all(strs.map(phHash)), by = new Map();
  strs.forEach((s, i) => { by.set(s, hs[i]); if (!photos.has(hs[i])) photos.set(hs[i], s); });
  return { refs: by.size ? phMapStr(data, s => by.has(s) ? PH_REF + by.get(s) : s) : data, photos };
}
/* each record's revision in a new version: the one before for a record whose stamp is unchanged, rev for the rest */
function nextRevs(prev, data, rev) {
  const pd = (prev && prev.data) || {}, pr = (prev && prev.revs) || {}, i = {}, d = {};
  const pi = new Map(arrOf(pd.items).map(x => [x.id, stampOf(x)])), pdy = new Map(arrOf(pd.days).map(x => [x.date, x.updated || 0]));
  for (const x of arrOf(data && data.items)) i[x.id] = pi.has(x.id) && pi.get(x.id) === stampOf(x) && pr.i && pr.i[x.id] != null ? pr.i[x.id] : rev;
  for (const x of arrOf(data && data.days)) d[x.date] = pdy.has(x.date) && pdy.get(x.date) === (x.updated || 0) && pr.d && pr.d[x.date] != null ? pr.d[x.date] : rev;
  const st = data && data.settings, ps = pd.settings ? pd.settings.updated || 0 : null;
  return { i, d, s: st && (st.updated || 0) === ps && pr.s != null ? pr.s : rev };
}
/* core.js mergeState and stateSig, for the worker: the newer stamp wins, a deletion wins over any older edit, ties keep a's */
function mergeLite(a, b) {
  a = a || {}; b = b || {}; const items = {}, tomb = { ...(a.tombstones || {}) };
  for (const [id, t] of Object.entries(b.tombstones || {})) tomb[id] = Math.max(tomb[id] || 0, +t || 0);
  for (const it of [...arrOf(a.items), ...arrOf(b.items)]) { if (!it || it.id == null) continue; const cur = items[it.id]; if (!cur || stampOf(it) > stampOf(cur)) items[it.id] = it; }
  for (const id of Object.keys(items)) if (tomb[id] && tomb[id] >= stampOf(items[id])) delete items[id];
  const cutoff = Date.now() - 180 * 864e5; for (const id of Object.keys(tomb)) if (tomb[id] < cutoff) delete tomb[id];
  // (a newer copy that is only the app's lock of the week loses to an older copy changed after the version the lock was built on:
  // core.js dayWins, 2026-11-14)
  const dayWins = (o, n) => !o || o === n || !n.lockOnly ? n : ((o.lockOnly ? o.base : o.updated) || 0) > (n.base || 0) ? o : n;
  const days = {}; for (const d of [...arrOf(a.days), ...arrOf(b.days)]) { if (!d || !d.date) continue; const cur = days[d.date]; days[d.date] = !cur || (d.updated || 0) > (cur.updated || 0) ? dayWins(cur, d) : dayWins(d, cur); }
  const settings = a.settings && b.settings ? ((a.settings.updated || 0) >= (b.settings.updated || 0) ? a.settings : b.settings) : (a.settings || b.settings || null);
  return { items: Object.values(items), tombstones: tomb, days: Object.values(days), settings };
}
function liteSig(s) {
  s = s || {}; const by = (arr, k, v) => arrOf(arr).map(x => x[k] + ':' + v(x)).sort().join(',');
  return [by(s.items, 'id', stampOf), Object.entries(s.tombstones || {}).map(e => e.join(':')).sort().join(','), by(s.days, 'date', d => d.updated || 0), s.settings ? s.settings.updated || 0 : ''].join('|');
}
/* the first n characters of a stored value (the index, ASCII, comes first): read as a stream and cancelled there */
async function readHead(env, key, n) {
  let v; try { v = await env.WARDROBE.get(key, { type: 'stream' }); } catch { v = null; }
  if (v == null) return null;
  if (typeof v === 'string') return v.slice(0, n);
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return new TextDecoder().decode(asBytes(v).subarray(0, n));
  const r = v.getReader(), parts = []; let got = 0;
  while (got < n) { const { done, value } = await r.read(); if (done) break; parts.push(value); got += value.length; }
  r.cancel().catch(() => { });
  const b = new Uint8Array(got); let o = 0; for (const p of parts) { b.set(p, o); o += p.length; }
  return new TextDecoder().decode(b.subarray(0, n));
}
async function readLite(env, key, m) {
  if (!m || !m.ll) return null;
  try { const h = await readHead(env, key, m.ls + m.ll); return h ? JSON.parse(h.slice(m.ls)) : null; } catch { return null; }
}
/* a stored value's whole text, parts joined */
async function readText(env, key, m) {
  if (!isParted(m)) { const t = await env.WARDROBE.get(key); return t == null || typeof t === 'string' ? t : new TextDecoder().decode(asBytes(t)); }
  const bufs = []; let total = 0;
  for (let i = 0; i < m.parts; i++) { const v = await env.WARDROBE.get(i ? partKey(key, m.rev, i) : key, 'arrayBuffer'); if (v == null) return null; const b = asBytes(v); bufs.push(b); total += b.length; }
  const all = new Uint8Array(total); let o = 0; for (const b of bufs) { all.set(b, o); o += b.length; }
  return new TextDecoder().decode(all);
}
/* the backup as {lite, lit}: its index and, with text, each photo's JSON string by hash. A backup stored before the index (by an older
   worker) is read whole and indexed in memory (once: the next save stores the index); null for one too large to read whole (parted
   with no index), where the app falls back to the whole backup */
async function loadSync(env, key, m, text) {
  if (m && m.ll) {
    const lite = await readLite(env, key, m);
    if (lite && !text) return { lite };
    const t = lite && await readText(env, key, m);
    if (t) return { lite, lit: h => lite.ph[h] ? t.substr(m.ds + lite.ph[h][0], lite.ph[h][1]) : null };
  }
  if (isParted(m)) return null;
  const t = await readText(env, key, m);
  if (!t) return { lite: { data: null, revs: {}, ph: {} }, lit: () => null };
  let o; try { o = JSON.parse(t); } catch { return null; }
  const { refs, photos } = await splitPhotos(o.data), rev = m ? m.rev : o.rev || 0;
  const all = { i: Object.fromEntries(arrOf(refs && refs.items).map(x => [x.id, rev])), d: Object.fromEntries(arrOf(refs && refs.days).map(x => [x.date, rev])), s: rev };
  return { lite: { data: refs, revs: all, ph: Object.fromEntries([...photos.keys()].map(h => [h, 1])) }, lit: h => photos.has(h) ? JSON.stringify(photos.get(h)) : null };
}
/* a built backup stored: one value up to PART_MAX, in parts above it; the version before's parts are dropped */
async function putStored(env, KEY, b, old) {
  const bytes = b.text.length * 3 > PART_MAX ? new TextEncoder().encode(b.text) : null;
  if (!bytes || bytes.length <= PART_MAX) await env.WARDROBE.put(KEY, b.text, { metadata: b.meta });
  else {
    const parts = Math.ceil(bytes.length / PART_MAX);
    for (let i = 1; i < parts; i++) await env.WARDROBE.put(partKey(KEY, b.meta.rev, i), bytes.slice(i * PART_MAX, (i + 1) * PART_MAX).buffer);
    await env.WARDROBE.put(KEY, bytes.slice(0, PART_MAX).buffer, { metadata: { ...b.meta, parts } });
  }
  await dropParts(env, KEY, old);
}
/* GET /sync?lite=1[&since=<rev>:<saved>][&v=<rev>:<saved>]: {same:true} as ?v= does; else {lite:1, rev, saved, all, items, days,
   settings?, tombstones, idx, ph}: the records changed since that version (every one when since is missing, from another backup, or
   newer than this one: all), every tombstone, every record's stamp (idx: what the backup holds, so the app can tell what to send and
   whether it lacks anything) and the hashes of the photos kept (ph) */
async function syncLiteGet(env, json, cors, ns, q) {
  const KEY = ns + SYNC_KEY, m = await syncVersion(env, ns), v = q.get('v');
  if (v && m && `${m.rev}:${m.saved}` === v) return json({ rev: m.rev, saved: m.saved, same: true });
  if (!m && await env.WARDROBE.get(KEY)) return storedResponse(env, KEY, m, cors);   // saved by a worker that kept no version: as before
  const src = await loadAny(env, KEY, m, false);
  if (!src) return storedResponse(env, KEY, m, cors);                                 // too large to index here: the whole backup, as before
  const rev = m ? m.rev : 0, saved = m ? m.saved : 0, D = src.lite.data || {}, R = src.lite.revs || {};
  const [sr, ss] = (q.get('since') || '').split(':').map(Number), all = !(sr > 0) || sr > rev || (sr === rev && ss !== saved);
  const newer = r => all || (r ?? rev) > sr;
  const body = { lite: 1, rev, saved, all, items: arrOf(D.items).filter(i => newer(R.i && R.i[i.id])), days: arrOf(D.days).filter(d => newer(R.d && R.d[d.date])), tombstones: D.tombstones || {},
    idx: { i: Object.fromEntries(arrOf(D.items).map(i => [i.id, stampOf(i)])), d: Object.fromEntries(arrOf(D.days).map(d => [d.date, d.updated || 0])), s: D.settings ? D.settings.updated || 0 : -1 },
    ph: Object.keys(src.lite.ph || {}) };
  if (D.settings && newer(R.s)) body.settings = D.settings;
  return json(body);
}
/* GET /sync?ph=<hash>,<hash>,… (60 at most): {photos: {hash: photo}} for those the backup holds, cut from its text unparsed */
async function syncPhotos(env, json, cors, ns, q) {
  const hs = [...new Set((q.get('ph') || '').split(','))].filter(h => PH_HEX.test(h)).slice(0, 60);
  if (!hs.length) return json({ error: 'no photos asked for' }, 400);
  const KEY = ns + SYNC_KEY, m = await syncVersion(env, ns), out = [];
  if (isPv(m)) {   // each from its own key
    const vs = await Promise.all(hs.map(h => env.WARDROBE.get(phKey(ns, h))));
    vs.forEach((v, i) => { if (v != null) out.push(`"${hs[i]}":${asText(v)}`); });
    return new Response(`{"photos":{${out.join(',')}}}`, { headers: { ...cors, 'content-type': 'application/json' } });
  }
  const src = await loadSync(env, KEY, m, true);
  if (src && src.lit) for (const h of hs) { const l = src.lit(h); if (l != null) out.push(`"${h}":${l}`); }
  return new Response(`{"photos":{${out.join(',')}}}`, { headers: { ...cors, 'content-type': 'application/json' } });
}
/* POST /sync {baseRev, day, reason?, delta: {items, days, settings?, tombstones}, photos: {hash: photo}}: delta's photos are references
   (or inline: they are split off here); a photo the backup lacks comes in photos. Merged into the backup by the app's rules. 409
   {rev, saved} when baseRev is not the stored rev (the app asks again since what it had); 400 {missing} for a referenced photo nobody
   sent; 422 legacy for a backup this can't index (the app sends the whole backup instead). A tester's save counts as a backup. */
async function syncLitePost(req, env, json, cors, who) {
  const ns = who.ns, KEY = ns + SYNC_KEY;
  if (+(req.headers.get('content-length') || 0) > BACKUP_MAX) return json({ error: 'backup too large (over 48 MB)' }, 413);
  const buf = await req.arrayBuffer();
  if (buf.byteLength > BACKUP_MAX) return json({ error: 'backup too large (over 48 MB)' }, 413);
  let body; try { body = JSON.parse(new TextDecoder().decode(buf)); } catch { return json({ error: 'bad json' }, 400); }
  if (!body || !body.delta || typeof body.delta !== 'object') return json({ error: 'nothing to save' }, 400);
  const over = await spend(env, who, 'backup'); if (over) return json(over.body, over.status);
  const give = async r => { await unspend(env, who, 'backup'); return r; };
  const m = await syncVersion(env, ns), rev = m ? m.rev : 0;
  if (!m && await env.WARDROBE.get(KEY)) return give(json({ error: 'legacy' }, 422));
  if ((body.baseRev ?? -1) !== rev) return give(json({ error: 'conflict', rev, saved: m ? m.saved : 0 }, 409));
  const src = m ? await loadAny(env, KEY, m, true) : { pv: true, refs: new Set(), lite: { data: null, revs: {}, ph: {} } };
  if (!src) return give(json({ error: 'legacy' }, 422));
  const photos = new Map();
  for (const [h, s] of Object.entries(body.photos || {})) {
    if (!PH_HEX.test(h) || !isPhoto(s) || await phHash(s) !== h) return give(json({ error: 'a photo does not match its name' }, 400));
    photos.set(h, s);
  }
  const { refs: delta } = await splitPhotos(body.delta, photos), cur = src.lite.data || {}, next = mergeLite(cur, delta);
  if (liteSig(cur) === liteSig(next) && m) return give(json({ rev, saved: m.saved }));   // nothing new: nothing written
  // every photo the new version refers to: kept by the backup now, or sent; the backup's own are already stored (or, inline, are stored now)
  const want = new Map(), missing = [];
  for (const h of refsOf(next)) {
    if (src.pv && src.refs.has(h)) continue;
    if (photos.has(h)) want.set(h, JSON.stringify(photos.get(h)));
    else if (!src.pv && src.lit(h) != null) want.set(h, src.lit);
    else missing.push(h);
  }
  if (missing.length) return give(json({ error: 'missing photos', missing }, 400));
  const w = writeBudget(env, who), oldPv = await storePhotos(env, ns, m, src, want, w.allow);
  if (w.short) { const x = await w.refuse(); return give(json(x.body, x.status)); }
  await countWrites(env, who, await keepSnapshots(env, m, body, ns, oldPv));
  const saved = Date.now();
  await putStored(env, KEY, { text: pvText(rev + 1, saved, nextRevs(src.lite, next, rev + 1), next), meta: pvMeta(rev + 1, saved) }, m);
  return json({ rev: rev + 1, saved });
}
/* a save's KV writes against a tester's daily cap: putPhotos asks (allow) for its new photos and the backup itself, and stores as many
   photos as are granted; short: not all fitted, the save is refused (refuse() gives back what wasn't used, and says so in the backup
   limit's words, so the app tries again tomorrow; the photos stored are not sent again) */
function writeBudget(env, who) {
  const w = { short: null, got: 0, used: 0 };
  w.allow = async need => {
    const r = await spendUpTo(env, who, 'write', need + 1);
    w.got = r.got; w.need = need;
    if (r.got >= need + 1) { w.used = need + 1; return need; }
    w.short = r.over || limitBody('write', 0, 0); w.used = Math.min(need, r.got); return w.used;
  };
  w.refuse = async () => {
    await unspend(env, who, 'write', utcDay(), w.got - w.used);
    if (w.short.status !== 429) return w.short;
    const message = `Today’s room on the server for your backups is used up (${w.used} of ${w.need} new photos are saved). Your changes are kept on this phone and backed up tomorrow.`;
    return { status: 429, body: { error: 'limit', what: 'backup', write: true, ...(w.short.body.all ? { all: true } : {}), message, detail: message } };
  };
  return w;
}

export { BACKUP_MAX, PART_MAX, PH_HEX, PH_MIN, PH_REF, PH_TOKEN, SNAP_DAY, SNAP_DAYS, SNAP_MONTHS, SYNC_KEY, SYNC_NONE, asBytes, isParted, keepSnapshots, kvMeta, listSnapshots, loadSync, nextRevs, putParted, putStored, readText, splitPhotos, storedResponse, storedVersion, syncLiteGet, syncLitePost, syncPhotos, syncVersion, writeBudget };
