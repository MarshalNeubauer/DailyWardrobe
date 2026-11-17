/* Daily Wardrobe worker: the backup: its version, large backups in parts, daily snapshots, the small sync (syncLite) and the write budget.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { PV, asText, isPv, loadAny, phKey, putWhole, pvMeta, pvResponse, pvText, refsOf, scanPhotos, storePhotos } from './photostore.js';
import { WIPED_KEY, countWrites, limitBody, sha256Hex, spend, spendUpTo, unspend, utcDay } from './people.js';
import { PIC_RE, recCheck } from './records.js';
import { hubOf } from './render.js';

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
/* n: how many items the copied version holds (the app's backups list says it, W2-14-03); kept in the copy's metadata, no extra write */
async function keepSnapshots(env, m, body, ns = '', oldPv = null, n = null) {
  const cnt = Number.isInteger(n) ? { n } : {};
  // the app's own date, unless it is more than a day away from the server's (a phone clock a year ahead kept snap:2027-11, the audit's
  // W1-9-07; one behind kept copies under 2020-01-01, two writes for each date it sent: CR-6-08)
  const today = new Date().toISOString().slice(0, 10), near = SNAP_DAY.test(body.day || '') && Math.abs(Date.parse(body.day) - Date.parse(today)) <= 864e5;
  const day = near ? body.day : today, month = day.slice(0, 7);
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
  if (oldPv && m && m.saved) { for (const [k, days] of todo) await env.WARDROBE.put(k, oldPv, { expirationTtl: days * 86400, metadata: { ...pvMeta(m.rev, m.saved), ...cnt } }); return todo.length; }
  if (isParted(m)) { if (!m.saved) return 0; for (const [k, days] of todo) await copyStored(env, ns + SYNC_KEY, k, m, { expirationTtl: days * 86400 }); return todo.length * (+m.parts || 1); }
  const cur = await env.WARDROBE.get(ns + SYNC_KEY);
  if (!cur || cur === SYNC_NONE) return 0;                       // nothing stored yet
  let meta = m;
  if (!meta) { try { const o = JSON.parse(cur); meta = { rev: o.rev, saved: o.saved }; } catch { return 0; } }
  if (!meta.saved) return 0;
  for (const [k, days] of todo) await env.WARDROBE.put(k, cur, { expirationTtl: days * 86400, metadata: { rev: meta.rev, saved: meta.saved, ...(isPv(m) ? { pv: PV } : {}), ...cnt } });
  return todo.length;
}
async function listSnapshots(env, ns = '') {
  const l = await env.WARDROBE.list({ prefix: `${ns}snap:` });
  return (l.keys || []).filter(k => k.metadata && k.metadata.saved).map(k => ({ id: k.name.slice(ns.length + 5), saved: k.metadata.saved, rev: k.metadata.rev, ...(Number.isInteger(k.metadata.n) ? { n: k.metadata.n } : {}) }))
    .sort((a, b) => b.saved - a.saved || b.id.localeCompare(a.id));   // same moment: the later date first
}
/* PUT /sync over PART_MAX: the body is never parsed whole (that took more memory than a Worker has). The app sends
   {"baseRev":n,"day":"…"[,"reason":"restore"],"data":…} with data last (sync.js), so the leading fields are read from the first
   bytes; its photos are cut out unparsed (scanPhotos) and what is left is saved like any other backup (putWhole: the record check, the
   write budget). A body whose photos can't be cut out, or whose rest still isn't a small backup, is refused (CR-6-02: it was stored in
   parts as it came, without the record check or the write cap, and left a backup with no index; the app never sends one: its photos
   are plain base64). lk: the save lock (saveLock) */
const BIG_HEAD = /^\{"baseRev":(-?\d+),"day":("(?:[^"\\]|\\.)*")(?:,"reason":"(restore)")?,"data":/;
const TOO_BIG_OLD = 'backup too large for this version of the app: update the app (Settings → About)', TOO_BIG_TEXT = 'backup too large: over 20 MB without its photos';
async function putParted(env, json, cors, who, all, lk = NO_LOCK) {
  const ns = who.ns, KEY = ns + SYNC_KEY, h = BIG_HEAD.exec(new TextDecoder().decode(all.subarray(0, 300)));
  if (!h || all[all.length - 1] !== 0x7d) return json({ error: TOO_BIG_OLD }, 413);
  const body = { baseRev: +h[1] };
  const m = await syncVersion(env, ns), rev = m ? m.rev : 0;
  if (lockStale(lk, m)) return json(conflictBody(m, true), 409);
  if (body.baseRev !== rev) return m ? storedResponse(env, KEY, m, cors, '{"error":"conflict",', 409) : json({ error: 'conflict', rev: 0, saved: 0, data: null }, 409);
  // its photos cut out unparsed and stored by hash: what is left is small, and saved like any other backup
  const sc = await scanPhotos(all);
  let b = null; if (sc) try { b = JSON.parse(sc.text); } catch { }
  if (!b) return json({ error: TOO_BIG_TEXT }, 413);
  return putWhole(env, json, cors, who, b, sc.pre, lk);
}
/* ---- one save at a time per person (CR-6-01, the 2026-11-16 code review). KV has no compare-and-swap: two saves read the same version,
   both passed the baseRev check, both were answered {rev: N+1}, and the later write replaced the earlier one's change. The person's
   RenderHub (a Durable Object: one request at a time, strongly consistent) holds a lock around the version check and the write
   (POST /lock, render.js), and the version the last save committed, which KV may still show older in another location for about a
   minute: then the save is answered 409 and the app asks again. A save waits up to about 3 s for the lock (LOCK_WAIT), then 409 too
   (every app since 2026-11-07 answers a 409 by asking again; none reads its body). No KV read or write is added: the version check is
   the save's own read. Without the binding, or when the hub can't be asked, the save goes ahead unlocked, as before (backups never stop
   because of the hub). ---- */
const LOCK_WAIT = [60, 120, 200, 300, 400, 500, 600, 700];
const NO_LOCK = { ok: true, last: null, ver: null, give: async () => { } };
const nap = ms => new Promise(r => setTimeout(r, ms));
async function saveLock(env, ns) {
  const hub = hubOf(env, ns);
  if (!hub) return { ...NO_LOCK };
  const call = b => hub.fetch('https://hub/lock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  let t;
  try {
    for (let i = 0; ; i++) {
      t = await call({ op: 'take' });
      if (t && t.ok && t.tok) break;
      if (!(t && t.busy)) return { ...NO_LOCK };   // (an answer this worker doesn't know: unlocked, as before)
      if (i >= LOCK_WAIT.length) return { busy: true };
      await nap(LOCK_WAIT[i]);
    }
  } catch (e) { console.log('save lock not taken', ns, e && e.message); return { ...NO_LOCK }; }
  const lk = { ok: true, last: t.last || null, ver: null, give: async () => { try { await call({ op: 'give', tok: t.tok, ver: lk.ver }); } catch (e) { console.log('save lock not given back', ns, e && e.message); } } };
  return lk;
}
/* KV shows an older version than the last save committed (a stale read in another location) */
const lockStale = (lk, m) => !!(lk && lk.last && (!m || m.rev < lk.last.rev || (m.rev === lk.last.rev && m.saved !== lk.last.saved)));
const conflictBody = (m, busy) => ({ error: 'conflict', rev: m ? m.rev : 0, saved: m ? m.saved || 0 : 0, ...(busy ? { busy: true } : {}) });
/* a new version's save time: never the same as the version before (two saves in one millisecond gave two forks one {rev, saved}, and
   the losing phone's quick check then said "nothing new") */
const nextSaved = m => Math.max(Date.now(), (m && +m.saved || 0) + 1);
/* ---- the small sync (sync.js syncLite). The stored backup keeps its form ({"rev","saved","data"}: older apps, the daily copies and
   Roll back read it as before) with one field more before data: "index", the same data with every photo (a "data:" string of PH_MIN
   characters or more, anywhere in it) replaced by a reference dwph:<the first 20 hex of its SHA-256>, each record's revision (revs: the
   rev that last changed it) and where each photo's JSON string lies in the data that follows (ph: hash -> [offset, length], characters
   from data's first). The metadata says where the index is (ls, ll; it is written in ASCII, so characters are bytes) and where data
   starts (ds). A newer app asks GET /sync?lite=1&since=<rev>:<saved> for the records changed since that version, without photos, gets
   the photos it lacks from GET /sync?ph=<hash>,…, and sends only what changed with POST /sync {baseRev, day, reason?, delta, photos}
   (an older worker answers POST 405, so it is never sent one). The worker builds the new backup from the index, the stored photos'
   text and the new photos, without parsing the photos: one KV write a save, as before. ---- */
/* (2026-11-15, the owner's option A for KV writes) PH_MIN was 256: every data string, the 128 px swatch too, became its own ph: value, a
   write per item. A string under PH_MIN (the app's JPEG swatch, a few KB) now stays inline in the backup's small value. PH_OLD: an older
   app still sends its smaller photos (a PNG swatch) by reference in body.photos; they are taken and stored as before, and references
   already in backups stay readable (they are resolved by hash, whatever the length). sync.js has the same two numbers */
const PH_MIN = 16384, PH_OLD = 256, PH_REF = 'dwph:', PH_HEX = /^[0-9a-f]{20}$/, PH_TOKEN = /"dwph:([0-9a-f]{20})"/g;
const isPhoto = s => typeof s === 'string' && s.length >= PH_MIN && s.startsWith('data:');
const isPhotoOld = s => typeof s === 'string' && s.length >= PH_OLD && s.startsWith('data:');
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
/* ---- stamps from wrong clocks (fix round 3, 2026-11-16, the audit's W1-9 and W2-13-03). The app stamps by the server's time now (core.js
   nowMs, from the x-now header every answer carries), so a stamp more than CLOCK_AHEAD past the server's clock is a wrong clock or a
   crafted request: in what a save sends (dropFuture) it is left out, so deletion marks dated years ahead can't wipe a wardrobe and a record
   dated ahead can't freeze it, and the app, which puts its own such stamps back to now once it knows the gap (sync.js clockFix), sends them
   again as ordinary changes. What the backup already holds from before is read with such stamps put back to the backup's own save time
   (clampStamps, the same value on every read until the next save, which stores it so), by GET ?lite=1 and by a save alike ---- */
const CLOCK_AHEAD = 10 * 6e4;
const over = (v, lim) => (+v || 0) > lim;
/* (fix round 3's field stamps: an item's or day's fs = {u, b, s} and the settings' entry stamps kse count like updated and ks: a field
   stamped ahead would win that field for as long as the record's own stamp) */
const fsOver = (x, lim) => !!(x && x.fs && typeof x.fs === 'object' && (over(x.fs.u, lim) || over(x.fs.b, lim) || Object.values(x.fs.s || {}).some(v => over(v, lim))));
const kseOver = (s, lim) => !!(s && s.kse && typeof s.kse === 'object' && Object.values(s.kse).some(e => e && typeof e === 'object' && Object.values(e).some(v => over(v, lim))));
const fsClamp = (c, x, to, lim) => { if (!x.fs || typeof x.fs !== 'object') return c; const f = x.fs, s = {};
  for (const [k, v] of Object.entries(f.s || {})) s[k] = over(v, lim) ? to : v;
  c.fs = { u: f.u === stampOf(x) ? stampOf(c) : f.u, b: over(f.b, lim) ? to : f.b, s }; return c; };
function clampStamps(d, to, lim) {
  if (!d || !(to > 0)) return d;   // (no save time known: nothing to measure against)
  const bad = arrOf(d.items).some(x => x && (over(x.updated, lim) || over(x.added, lim) || fsOver(x, lim))) || arrOf(d.days).some(x => x && (over(x.updated, lim) || over(x.base, lim) || over(x.lockAt, lim) || fsOver(x, lim)))
    || Object.values(d.tombstones || {}).some(v => over(v, lim)) || !!(d.settings && (over(d.settings.updated, lim) || Object.values(d.settings.ks || {}).some(v => over(v, lim)) || kseOver(d.settings, lim)));
  if (!bad) return d;
  const fix = (o, ks) => { const c = { ...o }; for (const k of ks) if (over(c[k], lim)) c[k] = to; return c; };
  const out = { ...d, items: arrOf(d.items).map(x => x ? fsClamp(fix(x, ['updated', 'added']), x, to, lim) : x), days: arrOf(d.days).map(x => x ? fsClamp(fix(x, ['updated', 'base', 'lockAt']), x, to, lim) : x),
    tombstones: Object.fromEntries(Object.entries(d.tombstones || {}).map(([id, t]) => [id, over(t, lim) ? to : t])) };
  if (d.settings) { const s = fix(d.settings, ['updated']); if (s.ks) s.ks = Object.fromEntries(Object.entries(s.ks).map(([k, t]) => [k, over(t, lim) ? to : t])); if (kseOver(s, lim)) s.kse = Object.fromEntries(Object.entries(s.kse).map(([k, e]) => [k, e && typeof e === 'object' ? Object.fromEntries(Object.entries(e).map(([x, v]) => [x, over(v, lim) ? to : v])) : e])); out.settings = s; }
  return out;
}
function dropFuture(d, lim) {
  if (!d) return d;
  const s = d.settings && !over(d.settings.updated, lim) && !Object.values(d.settings.ks || {}).some(v => over(v, lim)) && !kseOver(d.settings, lim) ? d.settings : null;
  return { ...d, items: arrOf(d.items).filter(x => !(x && (over(stampOf(x), lim) || over(x.added, lim) || fsOver(x, lim)))), days: arrOf(d.days).filter(x => !(x && (over(x.updated, lim) || over(x.base, lim) || over(x.lockAt, lim) || fsOver(x, lim)))),
    tombstones: Object.fromEntries(Object.entries(d.tombstones || {}).filter(([, t]) => !over(t, lim))), settings: s };
}
/* the sample wardrobe stays on the phone that loaded it (fix round 3, W1-3-04): a sample piece the person hasn't made his (sample without
   sampleMine; kit.js kitEdited) is never kept or handed out. An app from before that rule (14-15 Nov) uploaded the whole sample, and a new
   phone joining got it with "You're trying a sample wardrobe": GET ?lite leaves such pieces out, and the next save drops them */
const sampleOnly = i => !!i && i.sample === true && !i.sampleMine;
/* core.js mergeItem, for the worker (fix round 3, 2026-11-16): an item field by field by its field stamps (fs = {u, b, s}: the stamp of
   each field changed after b; a copy whose fs.u isn't its stamp counts its one stamp for every field), the result one above both when it
   took anything from the copy with the older stamp; a deletion wins over a copy whose oldest field is no newer than it (itemBase) */
const ITEM_META = ['id', 'added', 'updated', 'fs'];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fsOk = i => !!(i && i.fs && typeof i.fs === 'object' && i.fs.u === stampOf(i) && i.fs.s && typeof i.fs.s === 'object');
const fieldStamp = (i, k) => fsOk(i) ? (own(i.fs.s, k) ? +i.fs.s[k] || 0 : +i.fs.b || 0) : stampOf(i);
const itemBase = i => fsOk(i) ? +i.fs.b || 0 : stampOf(i);
const sameVal = (x, y) => x === y || (x != null && y != null && typeof x === 'object' && typeof y === 'object' && JSON.stringify(x) === JSON.stringify(y));
const fsPack = (u, s) => { const v = Object.values(s), b = v.length ? Math.min(...v) : u, o = {}; for (const [k, t] of Object.entries(s)) if (t > b) o[k] = t; return { u, b, s: o }; };
function mergeItemLite(a, b) {
  const ua = stampOf(a), ub = stampOf(b), hi = ua >= ub ? a : b;
  if (a === b || (!fsOk(a) && !fsOk(b))) return hi;
  const out = {}, s = {}; let mixed = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b), ...(fsOk(a) ? Object.keys(a.fs.s) : []), ...(fsOk(b) ? Object.keys(b.fs.s) : [])])) {
    if (ITEM_META.includes(k)) continue;
    const sa = fieldStamp(a, k), sb = fieldStamp(b, k), w = sa === sb ? hi : sa > sb ? a : b;
    if (w !== hi && !sameVal(w[k], hi[k])) mixed = true;
    if (w[k] !== undefined) out[k] = w[k]; s[k] = Math.max(sa, sb);
  }
  if (!mixed) return hi;
  const u = Math.max(ua, ub) + 1, added = hi.added ?? (hi === a ? b : a).added;
  return { id: hi.id, ...(added != null ? { added } : {}), ...out, updated: u, fs: fsPack(u, s) };
}
/* core.js dayWins and mergeDay, for the worker (fix round 3): a day field by field, the picks, skips, pieces taken off and recorded slot by
   slot; a copy without fs counts its one stamp for every field, except the week's lock (lockOnly: its other fields are its base) */
const dayWins = (o, n) => !o || o === n || !n.lockOnly ? n : ((o.lockOnly ? o.base : o.updated) || 0) > (n.base || 0) ? o : n;
const DAY_META = ['date', 'updated', 'fs', 'lockOnly', 'base', 'lockAt'], DAY_SUB = ['force', 'skip', 'off', 'ids'];
function dayFlat(d) {
  const o = {};
  for (const k of Object.keys(d || {})) { if (DAY_META.includes(k)) continue; const v = d[k]; if (DAY_SUB.includes(k) && v && typeof v === 'object' && !Array.isArray(v)) { for (const s of Object.keys(v)) o[k + '.' + s] = v[s]; } else o[k] = v; }
  return o;
}
function dayUnflat(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) { const i = k.indexOf('.'), g = i > 0 ? k.slice(0, i) : ''; if (g && DAY_SUB.includes(g)) { if (!r[g] || typeof r[g] !== 'object') r[g] = {}; r[g][k.slice(i + 1)] = v; } else if (!(k in r)) r[k] = v; }
  return r;
}
const dayStamp = (d, k) => fsOk(d) ? fieldStamp(d, k) : d.lockOnly ? (k === 'lock' ? stampOf(d) : +d.base || 0) : stampOf(d);
function mergeDayLite(a, b) {
  if (a === b) return a; const ua = a.updated || 0, ub = b.updated || 0;
  if (!fsOk(a) && !fsOk(b)) return ub > ua ? dayWins(a, b) : dayWins(b, a);
  const hi = ua >= ub ? a : b, fa = dayFlat(a), fb = dayFlat(b), fh = hi === a ? fa : fb, out = {}, s = {}; let mixed = false, lockW = null;
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb), ...(fsOk(a) ? Object.keys(a.fs.s) : []), ...(fsOk(b) ? Object.keys(b.fs.s) : [])])) {
    const sa = dayStamp(a, k), sb = dayStamp(b, k); let w = sa === sb ? hi : sa > sb ? a : b;
    if (k === 'lock') { const o = w === a ? b : a; if (w.lockOnly && dayWins(o, w) === o) w = o; lockW = w; }
    const fw = w === a ? fa : fb; if (w !== hi && !sameVal(fw[k], fh[k])) mixed = true;
    if (fw[k] !== undefined) out[k] = fw[k]; s[k] = Math.max(sa, sb);
  }
  if (!mixed) return hi;
  const u = Math.max(ua, ub) + 1, r = { date: hi.date, ...dayUnflat(out), updated: u };
  if (r.lock && lockW && lockW.lockAt != null) r.lockAt = lockW.lockAt; r.fs = fsPack(u, s); return r;
}
/* core.js mergeState and stateSig, for the worker: each item field by field (mergeItemLite), a deletion wins over any older edit, ties keep a's */
function mergeLite(a, b) {
  a = a || {}; b = b || {}; const items = {}, tomb = { ...(a.tombstones || {}) };
  for (const [id, t] of Object.entries(b.tombstones || {})) tomb[id] = Math.max(tomb[id] || 0, +t || 0);
  for (const it of [...arrOf(a.items), ...arrOf(b.items)]) { if (!it || it.id == null) continue; const cur = items[it.id]; items[it.id] = cur ? mergeItemLite(cur, it) : it; }
  for (const id of Object.keys(items)) if ((tomb[id] && tomb[id] >= itemBase(items[id])) || sampleOnly(items[id])) delete items[id];
  const cutoff = Date.now() - 180 * 864e5; for (const id of Object.keys(tomb)) if (tomb[id] < cutoff) delete tomb[id];
  // (a newer copy that is only the app's lock of the week loses to an older copy changed after the version the lock was built on:
  // core.js dayWins, 2026-11-14)
  const days = {}; for (const d of [...arrOf(a.days), ...arrOf(b.days)]) { if (!d || !d.date) continue; const cur = days[d.date]; days[d.date] = cur ? mergeDayLite(cur, d) : d; }
  const settings = a.settings && b.settings ? mergeSettingsLite(a.settings, b.settings) : (a.settings || b.settings || null);
  return { items: Object.values(items), tombstones: tomb, days: Object.values(days), settings };
}
/* core.js mergeSettings, for the worker (2026-11-14): setting by setting by each one's stamp (settings.ks; a copy without it counts its
   one stamp for all), the result one above both when it took anything from the copy with the older overall stamp */
const SET_META = ['updated', 'ks', 'kh', 'kse', 'khe'];
const setHashLite = v => { const s = JSON.stringify(v === undefined ? null : v); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const setKeysLite = s => Object.keys(s || {}).filter(k => !SET_META.includes(k));
const setStampLite = (s, k) => s.ks ? (+s.ks[k] || 0) : (s.updated || 0);
/* core.js SET_SPLIT, setEntries, setJoin, subOk, subStampOf and mergeSplit (fix round 3): own colors and patterns, Care, the dress code,
   workdays, blazer days, hidden ideas and own days off merged entry by entry by their entry stamps (settings.kse / khe) */
const SET_SPLIT = { custom: 'custom', care: 'obj', dress: 'obj', workdays: 'set', blazerDays: 'set', shopSkip: 'set', daysOff: 'list', ownMaterials: 'mats' };   // (own materials {type: [name]}, 2026-11-16)
function setEntriesLite(k, v) {
  const t = SET_SPLIT[k], m = new Map(); if (v == null) return m;
  if (t === 'obj') { if (typeof v !== 'object' || Array.isArray(v)) return null; for (const e of Object.keys(v)) m.set(e, v[e]); }
  else if (t === 'set') { if (!Array.isArray(v)) return null; for (const x of v) if (x != null && typeof x !== 'object') m.set(String(x), x); else return null; }
  else if (t === 'list') { if (!Array.isArray(v)) return null; for (const x of v) { if (!x || typeof x !== 'object' || !x.d) return null; m.set(String(x.d), x); } }
  else if (t === 'mats') { if (typeof v !== 'object' || Array.isArray(v)) return null; for (const g of Object.keys(v)) { const l = v[g]; if (!Array.isArray(l)) return null; for (const x of l) { if (typeof x !== 'string') return null; m.set(g + '/' + x, x); } } }
  else if (t === 'custom') {
    if (typeof v !== 'object' || Array.isArray(v)) return null;
    for (const g of Object.keys(v)) { const l = v[g]; if (g !== 'colors' && g !== 'patterns') { m.set('@' + g, l); continue; } if (!Array.isArray(l)) return null; for (const x of l) { if (!x || typeof x !== 'object' || !x.key) return null; m.set(g + '/' + x.key, x); } }
  } else return null;
  return m;
}
function setJoinLite(k, m) {
  const t = SET_SPLIT[k], v = [...m.values()];
  if (t === 'obj') return Object.fromEntries(m);
  if (t === 'set') return v.every(x => typeof x === 'number') ? v.sort((a, b) => a - b) : v.sort();
  if (t === 'list') return v.sort((a, b) => String(a.d) < String(b.d) ? -1 : String(a.d) > String(b.d) ? 1 : 0);
  if (t === 'mats') { const o = {}; for (const [e, x] of m) { const g = e.slice(0, e.indexOf('/')); (o[g] = o[g] || []).push(x); } for (const g of Object.keys(o)) o[g].sort(); return o; }
  const o = { colors: [], patterns: [] }; for (const [e, x] of m) { if (e[0] === '@') o[e.slice(1)] = x; else o[e.slice(0, e.indexOf('/'))].push(x); } return o;
}
const subOkLite = (s, k) => !!(s && s.kse && s.kse[k] && s.khe && s.khe[k] && s.khe[k]['#'] === setHashLite(s[k]));
const subStampLite = (s, k, e) => subOkLite(s, k) ? (own(s.kse[k], e) ? +s.kse[k][e] || 0 : +s.kse[k][''] || 0) : setStampLite(s, k);
function mergeSplitLite(a, b, k, hi) {
  const ma = setEntriesLite(k, a[k]), mb = setEntriesLite(k, b[k]); if (!ma || !mb) return null;
  const mh = hi === a ? ma : mb, lo = hi === a ? b : a, ml = hi === a ? mb : ma, m = new Map(), se = {}, he = {}; let mixed = false;
  const keys = new Set([...mh.keys(), ...ml.keys(), ...Object.keys(subOkLite(a, k) ? a.khe[k] : {}), ...Object.keys(subOkLite(b, k) ? b.khe[k] : {})]); keys.delete('#'); keys.delete('');
  for (const e of keys) {
    const xh = subStampLite(hi, k, e), xl = subStampLite(lo, k, e), mw = xl > xh ? ml : mh;
    if (mw !== mh && (mw.has(e) !== mh.has(e) || (mw.has(e) && setHashLite(mw.get(e)) !== setHashLite(mh.get(e))))) mixed = true;
    if (mw.has(e)) { m.set(e, mw.get(e)); he[e] = setHashLite(mw.get(e)); } else he[e] = '-';
    se[e] = Math.max(xh, xl);
  }
  const v = mixed ? setJoinLite(k, m) : hi[k], st = Object.values(se), base = st.length ? Math.min(...st) : Math.max(setStampLite(a, k), setStampLite(b, k)), cs = { '': base };
  for (const [e, x] of Object.entries(se)) if (x > base) cs[e] = x;
  return { v, mixed, se: cs, he: { ...he, '#': setHashLite(v) } };
}
function mergeSettingsLite(a, b) {
  const ua = a.updated || 0, ub = b.updated || 0, hi = ua >= ub ? a : b; if (!a.ks && !b.ks) return hi;
  const out = {}, ks = {}, kh = {}, kse = {}, khe = {}; let mixed = false;
  for (const k of new Set([...setKeysLite(a), ...setKeysLite(b), ...Object.keys(a.ks || {}), ...Object.keys(b.ks || {})])) {
    const sa = setStampLite(a, k), sb = setStampLite(b, k);
    const r = SET_SPLIT[k] && (subOkLite(a, k) || subOkLite(b, k)) && setHashLite(a[k]) !== setHashLite(b[k]) ? mergeSplitLite(a, b, k, hi) : null;
    if (r) { if (r.mixed) mixed = true; if (r.v !== undefined) out[k] = r.v; ks[k] = Math.max(sa, sb); kh[k] = r.v === undefined ? '-' : setHashLite(r.v); kse[k] = r.se; khe[k] = r.he; continue; }
    const w = sa === sb ? hi : sa > sb ? a : b;
    if (w !== hi && setHashLite(w[k]) !== setHashLite(hi[k])) mixed = true;
    if (k in w) out[k] = w[k]; ks[k] = Math.max(sa, sb); kh[k] = (w.kh && w.kh[k]) || setHashLite(w[k]);
    if (SET_SPLIT[k] && subOkLite(w, k)) { kse[k] = w.kse[k]; khe[k] = w.khe[k]; }
  }
  out.ks = ks; out.kh = kh; if (Object.keys(kse).length) { out.kse = kse; out.khe = khe; } out.updated = mixed ? Math.max(ua, ub) + 1 : Math.max(ua, ub);
  return mixed ? out : (hi.ks ? hi : Object.assign(out, { updated: hi.updated || 0 }));
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
  const rev = m ? m.rev : 0, saved = m ? m.saved : 0, D0 = clampStamps(src.lite.data || {}, saved, saved + CLOCK_AHEAD), R = src.lite.revs || {};
  const D = arrOf(D0.items).some(sampleOnly) ? { ...D0, items: arrOf(D0.items).filter(i => !sampleOnly(i)) } : D0;   // (not the sample wardrobe)
  const [sr, ss] = (q.get('since') || '').split(':').map(Number), all = !(sr > 0) || sr > rev || (sr === rev && ss !== saved);
  const newer = r => all || (r ?? rev) > sr;
  const body = { lite: 1, rev, saved, all, items: arrOf(D.items).filter(i => newer(R.i && R.i[i.id])), days: arrOf(D.days).filter(d => newer(R.d && R.d[d.date])), tombstones: D.tombstones || {},
    idx: { i: Object.fromEntries(arrOf(D.items).map(i => [i.id, stampOf(i)])), d: Object.fromEntries(arrOf(D.days).map(d => [d.date, d.updated || 0])), s: D.settings ? D.settings.updated || 0 : -1 },
    ph: Object.keys(src.lite.ph || {}) };
  if (D.settings && newer(R.s)) body.settings = D.settings;
  // the owner's data deleted with "Delete everything" (people.js handleAccount keeps when): his other phones don't put it back unasked
  // (fix round 3, W1-6-01). One read, only for the owner and only when the app isn't already up to date
  if (!ns) { const w = await env.WARDROBE.get(WIPED_KEY, 'json').catch(() => null); if (w && +w.at > 0) body.wiped = +w.at; }
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
  const ns = who.ns;
  if (+(req.headers.get('content-length') || 0) > BACKUP_MAX) return json({ error: 'backup too large (over 48 MB)' }, 413);
  const buf = await req.arrayBuffer();
  if (buf.byteLength > BACKUP_MAX) return json({ error: 'backup too large (over 48 MB)' }, 413);
  let body; try { body = JSON.parse(new TextDecoder().decode(buf)); } catch { return json({ error: 'bad json' }, 400); }
  if (!body || !body.delta || typeof body.delta !== 'object') return json({ error: 'nothing to save' }, 400);
  const wrong = recCheck(body.delta); if (wrong) return json(wrong, 400);   // records of the app's shape only (records.js), before anything is counted
  for (const s of Object.values(body.photos || {})) if (typeof s !== 'string' || !PIC_RE.test(s)) return json({ error: 'bad photo', message: 'The backup was not saved: a photo in it is not a picture.' }, 400);
  const over = await spend(env, who, 'backup'); if (over) return json(over.body, over.status);
  const give = async r => { await unspend(env, who, 'backup'); return r; };
  // the version check and the write, one save at a time for this person (saveLock)
  const lk = await saveLock(env, ns);
  if (lk.busy) return give(json(conflictBody(null, true), 409));
  try { return await syncLiteSave(env, json, who, body, lk, give); }
  catch (e) { await unspend(env, who, 'backup'); throw e; }
  finally { await lk.give(); }
}
async function syncLiteSave(env, json, who, body, lk, give) {
  const ns = who.ns, KEY = ns + SYNC_KEY;
  const m = await syncVersion(env, ns), rev = m ? m.rev : 0;
  if (lockStale(lk, m)) return give(json(conflictBody(m, true), 409));
  if (!m && await env.WARDROBE.get(KEY)) return give(json({ error: 'legacy' }, 422));
  if ((body.baseRev ?? -1) !== rev) return give(json({ error: 'conflict', rev, saved: m ? m.saved : 0 }, 409));
  // the same rev with another save time: a fork from before the lock (two saves answered the same rev). The app asks again since its
  // version, gets everything (syncLiteGet's all) and sends what the backup lacks
  if (m && +body.baseSaved > 0 && +m.saved > 0 && +body.baseSaved !== +m.saved) return give(json({ error: 'conflict', rev, saved: m.saved }, 409));
  const src = m ? await loadAny(env, KEY, m, true) : { pv: true, refs: new Set(), lite: { data: null, revs: {}, ph: {} } };
  if (!src) return give(json({ error: 'legacy' }, 422));
  const photos = new Map();
  for (const [h, s] of Object.entries(body.photos || {})) {
    if (!PH_HEX.test(h) || !isPhotoOld(s) || await phHash(s) !== h) return give(json({ error: 'a photo does not match its name' }, 400));
    photos.set(h, s);
  }
  const sv = m ? m.saved || 0 : 0, { refs: sent } = await splitPhotos(body.delta, photos), delta = dropFuture(sent, Date.now() + CLOCK_AHEAD);
  const cur = clampStamps(src.lite.data || {}, sv, sv + CLOCK_AHEAD), next = mergeLite(cur, delta);
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
  await countWrites(env, who, await keepSnapshots(env, m, body, ns, oldPv, m ? arrOf(cur.items).length : null));
  const saved = nextSaved(m);
  await putStored(env, KEY, { text: pvText(rev + 1, saved, nextRevs(src.lite, next, rev + 1), next), meta: pvMeta(rev + 1, saved) }, m);
  lk.ver = { rev: rev + 1, saved };
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

export { BACKUP_MAX, CLOCK_AHEAD, NO_LOCK, clampStamps, conflictBody, dropFuture, lockStale, mergeLite, nextSaved, saveLock, PART_MAX, PH_HEX, PH_MIN, PH_REF, PH_TOKEN, SNAP_DAY, SNAP_DAYS, SNAP_MONTHS, SYNC_KEY, SYNC_NONE, asBytes, isParted, keepSnapshots, kvMeta, listSnapshots, loadSync, nextRevs, putParted, putStored, readText, splitPhotos, storedResponse, storedVersion, syncLiteGet, syncLitePost, syncPhotos, syncVersion, writeBudget };
