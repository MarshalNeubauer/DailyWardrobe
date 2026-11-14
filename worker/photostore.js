/* Daily Wardrobe worker: photos stored once (ph:<hash>), their clean-up, and POST/GET /sync.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { BACKUP_MAX, PART_MAX, PH_HEX, PH_MIN, PH_REF, PH_TOKEN, SNAP_DAY, SNAP_DAYS, SNAP_MONTHS, SYNC_KEY, SYNC_NONE, asBytes, isParted, keepSnapshots, kvMeta, listSnapshots, loadSync, nextRevs, putParted, putStored, readText, splitPhotos, storedResponse, storedVersion, syncLiteGet, syncLitePost, syncPhotos, syncVersion, writeBudget } from './backup.js';
import { INVITE_INDEX, UID_RE, countWrites, spend, unspend } from './people.js';

/* ---- photos stored once (2026-11-13). The backup's photos (99% of it) are kept apart, each once, under <ns>ph:<hash> (hash = phHash,
   the value the photo's JSON string, metadata {t: when written}), and the backup itself is {"rev","saved","pv":1,"revs","data"} with
   every photo in data as "dwph:<hash>" (about 130 KB for the owner's 16.7 MB), metadata {rev, saved, pv:1}. A save writes the small
   value and only the photos not stored yet; the daily and monthly copies are copies of the small value, so they share the photos.
   Whoever needs the old form (an older app's GET and its 409, ?snap= for Roll back) gets it rebuilt, streamed photo by photo
   (pvResponse). A backup stored the old way (inline, with or without #284's index) is converted at its next save: its photos are
   stored first, then its daily copy (small), then the new version. The daily clean-up (photoGc, from the cron at 23:00 UTC) deletes
   a photo only when neither the backup nor any kept copy refers to it, seen so at two runs a day apart, and written over a day ago. ---- */
const PV = 1, GC_AGE = 864e5, GC_MAX = 200, GC_GONE = 3 * 864e5, GC_SNAPS = 2;
const phKey = (ns, h) => `${ns}ph:${h}`, gcKey = ns => `${ns}ph:gc`;
const isPv = m => !!(m && m.pv);
const pvMeta = (rev, saved) => ({ rev, saved, pv: PV });
const asText = v => v == null || typeof v === 'string' ? v : new TextDecoder().decode(asBytes(v));
const nsOf = key => (/^u:[a-z0-9]{8,24}:/.exec(key) || [''])[0];
const gcDue = d => d.getUTCHours() === 23 && d.getUTCMinutes() < 15;
function pvText(rev, saved, revs, data) { return `{"rev":${rev},"saved":${saved},"pv":${PV},"revs":${JSON.stringify(revs || {})},"data":${JSON.stringify(data === undefined ? null : data)}}`; }
/* the hashes a stored text refers to: "dwph:<hash>" as a value of its own (not inside someone's text) */
function refsIn(text, out = new Set()) {
  if (!text) return out;
  const re = new RegExp(PH_TOKEN.source, 'g'); let x;
  while ((x = re.exec(text))) if (!(x.index && text[x.index - 1] === '\\')) out.add(x[1]);
  return out;
}
const refsOf = data => refsIn(JSON.stringify(data === undefined ? null : data));
async function readPv(env, key, m) { const t = await readText(env, key, m); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } }
/* the backup as loadSync gives it, for either form: {pv, refs, lite: {data, revs, ph}} for one by reference */
async function loadAny(env, key, m, text) {
  if (!isPv(m)) return loadSync(env, key, m, text);
  const o = await readPv(env, key, m);
  if (!o) return null;
  const refs = refsOf(o.data);
  return { pv: true, refs, lite: { data: o.data, revs: o.revs || {}, ph: Object.fromEntries([...refs].map(h => [h, 1])) } };
}
async function phThere(env, ns, h) {
  const m = await kvMeta(env, phKey(ns, h));
  return m !== undefined ? m !== null : (await env.WARDROBE.get(phKey(ns, h))) != null;
}
/* each photo of want (hash -> its JSON string, or a function of the hash giving it) stored: written only when it is not there yet,
   or when the clean-up has it in view (unreferenced at its last run, or deleted in the last days: KV elsewhere may still show it).
   -> the hashes that could not be stored (no text for them) */
async function putPhotos(env, ns, want, allow) {
  const failed = new Set(), todo = [];
  if (want.size) {
    let gc = {}; try { gc = (await env.WARDROBE.get(gcKey(ns), 'json')) || {}; } catch { }
    const risky = h => !!((gc.cand && gc.cand[h]) || (gc.gone && gc.gone[h]));
    for (const [h, lit] of want) if (risky(h) || !(await phThere(env, ns, h))) todo.push([h, lit]);
  }
  // allow(n) -> how many of the n photos to write may be written (a tester's daily writes, writeBudget); the rest are not stored
  const ok = allow ? await allow(todo.length) : todo.length;
  todo.forEach(([h], i) => { if (i >= ok) failed.add(h); });
  for (const [h, lit] of todo.slice(0, ok)) {
    const l = typeof lit === 'function' ? lit(h) : lit;
    if (l == null) { failed.add(h); continue; }
    await env.WARDROBE.put(phKey(ns, h), l, { metadata: { t: Date.now(), n: l.length } });
  }
  return failed;
}
/* a save's photos stored before anything refers to them; a backup stored inline has all of its own stored too, and -> the
   by-reference text of that version (for its daily copy), or null when it is already by reference or a photo could not be had */
async function storePhotos(env, ns, m, src, want, allow) {
  const conv = !!(m && src && !src.pv);
  if (conv) for (const h of Object.keys(src.lite.ph || {})) if (!want.has(h)) want.set(h, src.lit);
  const failed = await putPhotos(env, ns, want, allow);
  if (!conv || failed.size) return null;
  const t = pvText(m.rev, m.saved, src.lite.revs, src.lite.data);
  return t.length <= PART_MAX ? t : null;
}
/* a stored by-reference value rebuilt whole, {"rev","saved","data"} with every photo inline, as older apps and Roll back read it;
   streamed, a few photos at a time (never the whole backup in memory); lead replaces its opening brace ({"error":"conflict", …}) */
async function pvResponse(env, key, m, cors, lead, status = 200) {
  const headers = { ...cors, 'content-type': 'application/json' }, ns = nsOf(key), o = await readPv(env, key, m);
  if (!o) return new Response(lead ? lead + SYNC_NONE.slice(1) : SYNC_NONE, { status, headers });
  const D = JSON.stringify(o.data === undefined ? null : o.data), segs = [], hs = [], re = new RegExp(PH_TOKEN.source, 'g');
  let last = 0, x;
  while ((x = re.exec(D))) { if (x.index && D[x.index - 1] === '\\') continue; segs.push(D.slice(last, x.index)); hs.push(x[1]); last = x.index + x[0].length; }
  segs.push(D.slice(last));
  const head = `{"rev":${o.rev},"saved":${o.saved},"data":`, enc = new TextEncoder();
  let i = 0;
  return new Response(new ReadableStream({
    start(c) { c.enqueue(enc.encode((lead ? lead + head.slice(1) : head) + segs[0])); },
    async pull(c) {
      if (i >= hs.length) { c.enqueue(enc.encode('}')); c.close(); return; }
      const n = Math.min(8, hs.length - i), vs = await Promise.all(hs.slice(i, i + n).map(h => env.WARDROBE.get(phKey(ns, h), 'arrayBuffer')));
      for (let k = 0; k < n; k++, i++) {
        if (vs[k] == null) { console.log('a stored photo is missing', ns, hs[i]); c.enqueue(enc.encode(`"${PH_REF}${hs[i]}"`)); }
        else c.enqueue(typeof vs[k] === 'string' ? enc.encode(vs[k]) : asBytes(vs[k]));
        c.enqueue(enc.encode(segs[i + 1]));
      }
    }
  }), { status, headers });
}
/* a large body's photos cut out without parsing it: each JSON string value starting "data: of PH_MIN characters or more with no
   escapes in it becomes "dwph:<hash>" (the hash over its bytes, which are its UTF-8, = phHash). -> {text: what is left, pre: hash ->
   a function giving the photo's JSON string as bytes} */
async function scanPhotos(all) {
  const n = all.length, enc = new TextEncoder(), out = [], pre = new Map();
  let last = 0, i = 0, size = 0;
  const isStart = i => all[i + 1] === 0x64 && all[i + 2] === 0x61 && all[i + 3] === 0x74 && all[i + 4] === 0x61 && all[i + 5] === 0x3a && !(i && all[i - 1] === 0x5c);
  while ((i = all.indexOf(0x22, i)) >= 0) {
    if (!isStart(i)) { i++; continue; }
    let j = i + 1; while (j < n && all[j] !== 0x22 && all[j] !== 0x5c) j++;
    if (j >= n) break;
    if (all[j] === 0x5c) { i = j + 1; continue; }   // escapes: left as it is
    const len = j - i - 1;
    if (len >= PH_MIN && len + 2 <= PART_MAX) {
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', all.subarray(i + 1, j)));
      const h = [...d.slice(0, 10)].map(b => b.toString(16).padStart(2, '0')).join(''), tok = enc.encode(`"${PH_REF}${h}"`);
      out.push(all.subarray(last, i), tok); size += i - last + tok.length; last = j + 1;
      if (!pre.has(h)) { const a = i, b = j + 1; pre.set(h, () => all.slice(a, b)); }
    }
    i = j + 1;
  }
  if (!pre.size) return null;
  out.push(all.subarray(last)); size += n - last;
  if (size > PART_MAX) return null;   // still large without its photos: stored in parts as before
  const b = new Uint8Array(size); let o = 0; for (const p of out) { b.set(p, o); o += p.length; }
  return { text: new TextDecoder().decode(b), pre };
}
/* every key under a prefix (lists, following the cursor) -> {keys, complete} */
async function listAll(env, prefix) {
  const keys = []; let cursor;
  for (let i = 0; i < 20; i++) {
    const l = await env.WARDROBE.list({ prefix, ...(cursor ? { cursor } : {}) });
    keys.push(...(l.keys || []));
    if (l.list_complete !== false || !l.cursor) return { keys, complete: true };
    cursor = l.cursor;
  }
  return { keys, complete: false };
}
/* every photo hash the backup and its kept copies refer to, or null when that can't be told for sure (then nothing is deleted).
   A copy stored with its photos inline refers to none. */
async function refsInUse(env, ns) {
  const l = await listAll(env, ns + 'snap:');
  if (!l.complete) return null;
  const used = new Set(), live = await storedVersion(env, ns + SYNC_KEY);
  const keys = [[ns + SYNC_KEY, live], ...l.keys.filter(k => !k.name.includes('~')).map(k => [k.name, k.metadata || null])];
  for (const [k, m] of keys) {
    if (m && !isPv(m)) continue;
    const t = await readText(env, k, m || undefined);
    if (t) refsIn(t, used);
  }
  return used;
}
/* migration of the kept copies stored inline (16 MB each for the owner): a few a day, monthly ones first, converted to the small form
   once the backup itself is by reference; their photos are stored first; the copy keeps its expiry */
async function convertSnaps(env, ns, now) {
  if (!isPv(await storedVersion(env, ns + SYNC_KEY))) return 0;
  const l = await listAll(env, ns + 'snap:'); let n = 0;
  const old = l.keys.filter(k => !k.name.includes('~') && k.metadata && k.metadata.saved && !isPv(k.metadata) && !isParted(k.metadata))
    .sort((a, b) => (SNAP_DAY.test(a.name.slice(ns.length + 5)) ? 1 : 0) - (SNAP_DAY.test(b.name.slice(ns.length + 5)) ? 1 : 0));
  for (const k of old) {
    if (n >= GC_SNAPS) break;
    if (k.expiration && k.expiration - now / 1000 < 3600) continue;
    const t = asText(await env.WARDROBE.get(k.name)); if (!t) continue;
    let o; try { o = JSON.parse(t); } catch { continue; }
    const { refs, photos } = await splitPhotos(o.data), want = new Map();
    for (const [h, s] of photos) want.set(h, JSON.stringify(s));
    if ((await putPhotos(env, ns, want)).size) continue;
    const id = k.name.slice(ns.length + 5), ttl = (SNAP_DAY.test(id) || id === 'before-restore' ? SNAP_DAYS : SNAP_MONTHS) * 86400;
    await env.WARDROBE.put(k.name, pvText(k.metadata.rev, k.metadata.saved, {}, refs), { metadata: pvMeta(k.metadata.rev, k.metadata.saved), ...(k.expiration ? { expiration: k.expiration } : { expirationTtl: ttl }) });
    n++;
  }
  return n;
}
/* one person's clean-up -> {photos, kept, deleted, converted} */
async function gcSpace(env, ns, now) {
  const converted = await convertSnaps(env, ns, now);
  const ph = (await listAll(env, ns + 'ph:')).keys.filter(k => PH_HEX.test(k.name.slice(ns.length + 3)));
  let gc = null; try { gc = await env.WARDROBE.get(gcKey(ns), 'json'); } catch { }
  const had = !!gc, cand = { ...(gc && gc.cand) }, gone = { ...(gc && gc.gone) };
  const used = ph.length ? await refsInUse(env, ns) : new Set();
  if (!used) return { photos: ph.length, skipped: true, converted };
  let changed = false; const del = [], stored = new Set();
  for (const k of ph) {
    const h = k.name.slice(ns.length + 3); stored.add(h);
    if (used.has(h)) { if (cand[h]) { delete cand[h]; changed = true; } continue; }
    const t = (k.metadata && k.metadata.t) || 0;
    if (cand[h] && now - cand[h] >= GC_AGE && now - t >= GC_AGE) { if (del.length < GC_MAX) del.push(h); }
    else if (!cand[h]) { cand[h] = now; changed = true; }
  }
  for (const h of Object.keys(cand)) if (!stored.has(h)) { delete cand[h]; changed = true; }
  // deleted only after a fresh look at each (written again meanwhile: not); kept in hand until the backup is read once more
  const held = new Map();
  for (const h of del) {
    const r = typeof env.WARDROBE.getWithMetadata === 'function' ? await env.WARDROBE.getWithMetadata(phKey(ns, h), 'arrayBuffer')
      : { value: await env.WARDROBE.get(phKey(ns, h), 'arrayBuffer'), metadata: (ph.find(k => k.name === phKey(ns, h)) || {}).metadata };
    if (!r || r.value == null) { delete cand[h]; changed = true; continue; }
    if (now - ((r.metadata && r.metadata.t) || 0) < GC_AGE) { cand[h] = now; changed = true; continue; }
    held.set(h, r); await env.WARDROBE.delete(phKey(ns, h)); delete cand[h]; gone[h] = now; changed = true;
  }
  let restored = 0;
  if (held.size) {
    const again = await refsInUse(env, ns);
    for (const [h, r] of held) if (!again || again.has(h)) {   // referred to after all (a save meanwhile): put back
      await env.WARDROBE.put(phKey(ns, h), r.value, { metadata: { ...(r.metadata || {}), t: now } }); delete gone[h]; restored++;
    }
  }
  for (const h of Object.keys(gone)) if (now - gone[h] > GC_GONE) { delete gone[h]; changed = true; }
  if (changed || (had && !Object.keys(cand).length && !Object.keys(gone).length)) {
    if (Object.keys(cand).length || Object.keys(gone).length) await env.WARDROBE.put(gcKey(ns), JSON.stringify({ at: now, cand, gone }));
    else if (had) await env.WARDROBE.delete(gcKey(ns));
  }
  return { photos: ph.length, kept: ph.length - held.size + restored, deleted: held.size - restored, waiting: Object.keys(cand).length, converted };
}
/* the daily clean-up of stored photos: the owner and every tester */
async function photoGc(env, now = Date.now()) {
  if (!env.WARDROBE) return {};
  let idx = null; try { idx = await env.WARDROBE.get(INVITE_INDEX, 'json'); } catch { }
  const spaces = ['', ...((idx && Array.isArray(idx.list) ? idx.list : []).filter(v => v && UID_RE.test(v.id)).map(v => `u:${v.id}:`))], out = {};
  for (const ns of spaces) try { out[ns || 'owner'] = await gcSpace(env, ns, now); } catch (e) { console.log('photo clean-up failed', ns, e && e.message); out[ns || 'owner'] = { error: true }; }
  return out;
}
async function handleSync(req, env, json, cors, who) {
  const ns = who.ns, KEY = ns + SYNC_KEY;
  if (!env.WARDROBE) return json({ error: 'Add a KV namespace binding named WARDROBE to the worker to enable backups.' }, 501);
  if (req.method === 'POST') return syncLitePost(req, env, json, cors, who);
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams, v = q.get('v');
    if (q.has('ph')) return syncPhotos(env, json, cors, ns, q);
    if (q.has('lite')) return syncLiteGet(env, json, cors, ns, q);
    if (q.has('snaps')) { const over = await spend(env, who, 'list'); if (over) return json(over.body, over.status); return json({ snaps: await listSnapshots(env, ns) }); }
    if (q.has('snap')) {
      const id = q.get('snap');
      if (!/^(\d{4}-\d{2}(-\d{2})?|before-restore)$/.test(id)) return json({ error: 'bad snapshot id' }, 400);
      const sk = `${ns}snap:${id}`, sm = await storedVersion(env, sk);
      if (isParted(sm) || isPv(sm)) return storedResponse(env, sk, sm, cors);
      const t = await env.WARDROBE.get(sk);
      if (!t) return json({ error: 'no such backup' }, 404);
      return new Response(t, { headers: { ...cors, 'content-type': 'application/json' } });
    }
    const m = await syncVersion(env, ns);
    if (v && m && `${m.rev}:${m.saved}` === v) return json({ rev: m.rev, saved: m.saved, same: true });
    // passed through as stored: no need to parse and rebuild several MB of JSON
    return storedResponse(env, KEY, m, cors);
  }
  if (req.method === 'PUT') {
    if (+(req.headers.get('content-length') || 0) > BACKUP_MAX) return json({ error: 'backup too large (over 48 MB)' }, 413);
    const buf = await req.arrayBuffer();
    if (buf.byteLength > BACKUP_MAX) return json({ error: 'backup too large (over 48 MB)' }, 413);
    // a tester's backups a day are capped (each is a KV write, and the whole team shares 1,000 a day); a conflict gives it back
    const over = await spend(env, who, 'backup'); if (over) return json(over.body, over.status);
    if (buf.byteLength > PART_MAX) { const r = await putParted(env, json, cors, who, new Uint8Array(buf)); if (r.status === 409 && !r.refunded) await unspend(env, who, 'backup'); return r; }
    let body;
    try { body = JSON.parse(new TextDecoder().decode(buf)); } catch { return json({ error: 'bad json' }, 400); }
    return putWhole(env, json, cors, who, body);
  }
  return json({ error: 'method not allowed' }, 405);
}
/* an older app's whole backup (PUT /sync {baseRev, day, reason?, data}), its photos inline: stored by reference like any other save.
   pre: photos already cut out of the body (putParted), hash -> a function giving the photo's JSON string as bytes */
async function putWhole(env, json, cors, who, body, pre = new Map()) {
  const ns = who.ns, KEY = ns + SYNC_KEY, none = { rev: 0, saved: 0, data: null }, m = await syncVersion(env, ns);
  const rev = m ? m.rev : ((await env.WARDROBE.get(KEY, 'json')) || none).rev;
  if ((body.baseRev ?? -1) !== rev) {
    await unspend(env, who, 'backup');
    const r = isParted(m) || isPv(m) ? await storedResponse(env, KEY, m, cors, '{"error":"conflict",', 409) : json({ error: 'conflict', ...((await env.WARDROBE.get(KEY, 'json')) || none), index: undefined }, 409);
    r.refunded = true; return r;
  }
  const src = m ? await loadAny(env, KEY, m, true) : null, { refs, photos } = await splitPhotos(body.data), want = new Map();
  for (const h of refsOf(refs)) {
    if (src && src.pv && src.refs.has(h)) continue;
    if (pre.has(h)) want.set(h, pre.get(h));
    else if (photos.has(h)) want.set(h, JSON.stringify(photos.get(h)));
    // (else a "dwph:" string that came as text: kept as it came)
  }
  const w = writeBudget(env, who), oldPv = await storePhotos(env, ns, m, src, want, w.allow);
  if (w.short) { await unspend(env, who, 'backup'); const x = await w.refuse(); const r = json(x.body, x.status); r.refunded = true; return r; }
  await countWrites(env, who, await keepSnapshots(env, m, body, ns, oldPv));
  const saved = Date.now();
  await putStored(env, KEY, { text: pvText(rev + 1, saved, nextRevs(src && src.lite, refs, rev + 1), refs), meta: pvMeta(rev + 1, saved) }, m);
  return json({ rev: rev + 1, saved });
}

export { PV, asText, gcDue, handleSync, isPv, loadAny, phKey, photoGc, putWhole, pvMeta, pvResponse, pvText, refsOf, scanPhotos, storePhotos };
