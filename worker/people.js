/* Daily Wardrobe worker: people: who is calling (the owner, testers), plain error words, daily caps, invitations, feedback, deleting an account.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { readCapped } from './links.js';
import { hubOf } from './render.js';
import { PUSH_KEY } from './remind.js';

/* ================= people: the owner and invited beta testers =================
   One function, whoIs, says who is calling from the x-app-token header. The owner's token is the APP_TOKEN secret; a tester's is
   the code of an invitation the owner made (POST /invites), of which only the SHA-256 is kept, as invite:<hash>.
   Each person's data lives under their own key prefix (ns): '' for the owner, so every key the owner already has keeps its exact
   name (wardrobe:v1, snap:…, render:…, job:…, jobfail:…, jobrun:…), and 'u:<id>:' for a tester (u:<id>:wardrobe:v1, …).
   Without APP_TOKEN nothing runs: every route refuses. */
const OWNER = { id: 'owner', name: 'Owner', role: 'owner', ns: '', caps: null };
const CODE_RE = /^[A-Za-z0-9_-]{24,80}$/, UID_RE = /^[a-z0-9]{8,24}$/, NS_RE = /^u:[a-z0-9]{8,24}:$/;
const INVITE_INDEX = 'invites:index', FEEDBACK_KEY = 'feedback:log', MAX_INVITES = 30;
const sha256Hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].map(b => b.toString(16).padStart(2, '0')).join('');
/* two digests compared in full, whatever differs: the time taken says nothing about the secret */
const sameText = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
/* -> {who: {id, name, role, ns, caps, hash?}} or {status, error, message?, unset?} */
async function whoIs(env, token) {
  token = String(token || '');
  const no = { status: 403, error: 'forbidden token' };
  if (!env.APP_TOKEN) return { ...no, unset: true };
  if (!token) return no;
  const h = await sha256Hex(token);
  if (sameText(h, await sha256Hex(env.APP_TOKEN))) return { who: OWNER };
  if (!CODE_RE.test(token) || !env.WARDROBE) return no;
  const rec = await env.WARDROBE.get(`invite:${h}`, 'json');
  if (!rec || !UID_RE.test(String(rec.id || ''))) return no;
  const first = firstWeek(rec), caps = { ...DEFAULT_CAPS, ...cleanCaps(rec.caps) };
  if (first) for (const k of [...Object.keys(DEFAULT_CAPS), 'write', 'list']) caps[k] = (caps[k] ?? EXTRA_CAPS[k]) * FIRST_WEEK_X;   // a tester's first week: twice the daily limits
  const who = { id: rec.id, name: String(rec.name || ''), role: 'tester', ns: `u:${rec.id}:`, caps, hash: h, ...(first ? { firstUntil: rec.created + FIRST_WEEK_MS } : {}) };
  // switched off: refused everywhere, except that the tester may still delete what they stored (DELETE /account, the router)
  if (rec.off) return { status: 403, error: 'invite off', message: INVITE_OFF, offWho: { ...who, off: true } };
  return { who };
}
const INVITE_OFF = 'This invitation has been switched off.';

/* ---- a tester's errors in plain words. What the owner needs to fix the server (the API's own message, which secret or binding is
   missing, what to do in which dashboard) means nothing to a tester: their answers carry a plain sentence instead, chosen by the
   route, and the original goes to the worker's log. A sentence already written for people (a daily limit, a photo too large) is
   left as it is. Also used for a tester's failed queued photos (jobfail). ---- */
const TECH_RE = /\b(API|api|OpenAI|Claude|Anthropic|secret|binding|KV|worker|Worker|Cloudflare|token|quota|billing|Billing|dashboard|Console|HTTP|status \d|RENDER_|OPENAI_|ANTHROPIC_|APP_TOKEN)\b|ECONN|fetch failed|TypeError|undefined/;
const PLAIN = {
  photo: 'The photo service had a problem. Try again later.',
  tag: 'The photo couldn’t be read just now. Try again later, or add the item by hand.',
  pattern: 'The pattern couldn’t be read just now. Try again later.',
  sync: 'The backup couldn’t be reached just now. Your wardrobe is safe on this phone; it will try again.',
  other: 'Something went wrong on the server. Try again later.',
};
const plainKind = p => (/^\/(render|render-queue|render-wait)$/.test(p) ? 'photo' : p === '/pattern' ? 'pattern' : p === '' || p === '/tag-many' ? 'tag' : p === '/sync' ? 'sync' : 'other');
function plainText(s, p) { return typeof s === 'string' && TECH_RE.test(s) ? PLAIN[plainKind(p)] : s; }
function plainFor(body, p) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  let changed = false; const out = { ...body };
  for (const k of ['error', 'detail', 'message']) if (typeof out[k] === 'string' && TECH_RE.test(out[k])) { out[k] = k === 'error' ? 'server' : PLAIN[plainKind(p)]; changed = true; }
  if (changed) { if (!out.message) out.message = PLAIN[plainKind(p)]; if (!out.detail && (body.detail || plainKind(p) === 'tag')) out.detail = out.message; console.log('tester error', p, JSON.stringify(body).slice(0, 500)); }
  if (Array.isArray(out.failed)) out.failed = out.failed.map(f => f && typeof f.error === 'string' ? { ...f, error: plainText(f.error, '/render') } : f);
  return out;
}
/* a failed queued photo's reason as it is kept: plain for a tester (ns), the original for the owner */
const failFor = (ns, error) => { if (ns && TECH_RE.test(String(error || ''))) { console.log('tester photo failed', ns, String(error).slice(0, 300)); return PLAIN.photo; } return error; };

/* ---- daily caps, testers only (the owner has none and is not counted). Per UTC day: tag = POST / and /tag-many, pattern =
   /pattern, photo = outfit photos (direct, queued, replaced), item = item pictures and one-piece edits. An invitation may carry
   its own numbers. Two more that the app doesn't show keep a tester from using up the KV's 1,000 writes a day: photo uploads
   (PUT /render) and feedback messages.
   Counted in the person's RenderHub (a Durable Object's own storage: no KV write per AI call); without the RENDER_HUB binding in
   KV as use:<id>:<day>, kept 3 days. A call that fails gives its count back. ---- */
const DEFAULT_CAPS = { tag: 40, pattern: 10, photo: 12, item: 20 };
const EXTRA_CAPS = { upload: 60, feedback: 20, backup: 30, push: 20, write: 200, list: 30 };
/* write: every KV write a tester causes (each new photo a backup stores, the backup itself and its daily copies, uploads, deletes,
   feedback, reminders, about 5 per queued photo), so no one tester can use up the free plan's 1,000 writes a day; a backup whose
   new photos pass it stores what fits and is refused (429, what 'backup': the app tries again tomorrow and the stored photos are not
   sent twice). list: KV lists (GET /render?list=1, /sync?snaps=1), also 1,000 a day for everyone. Twice in the first week, like
   the AI caps */
const JOB_WRITES = 5;   // a queued photo: the job, the consumer's jobrun, the photo, and the job's two records deleted
/* the first 7 days after an invitation was made: every daily limit twice (adding a whole wardrobe is the first week's work) */
const FIRST_WEEK_MS = 7 * 86400000, FIRST_WEEK_X = 2;
const firstWeek = rec => !!(rec && rec.created && Date.now() - rec.created < FIRST_WEEK_MS);
const CAP_WORDS = { tag: 'photo readings', pattern: 'pattern readings', photo: 'outfit photos', item: 'item pictures', upload: 'photo uploads', feedback: 'messages', backup: 'backups', push: 'reminder changes', write: 'saves to the server', list: 'photo list checks' };
const USE_RE = /^(tag|pattern|photo|item|upload|feedback|backup|push|write|list)$/, DAY_KEY = /^\d{4}-\d{2}-\d{2}$/, USE_TTL = { expirationTtl: 3 * 86400 };
const utcDay = () => new Date(Date.now()).toISOString().slice(0, 10);
function cleanCaps(c) {
  const out = {};
  if (c && typeof c === 'object') for (const k of Object.keys(DEFAULT_CAPS)) if (c[k] != null && Number.isFinite(+c[k]) && +c[k] >= 0) out[k] = Math.min(100000, Math.round(+c[k]));
  return out;
}
const photoCap = body => (body && body.swap ? 'item' : 'photo');
/* count n of `what` for tester `id` on `day`, unless that passes `cap` -> {ok, used} | {ok:false, used} | {ok:false, off} | {ok:false, fail} */
async function useCount(env, id, what, n, cap, day) {
  const hub = hubOf(env, `u:${id}:`);
  if (hub) {
    try {
      const r = await hub.fetch('https://hub/use', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ what, n, cap, day }) });
      const j = await r.json();
      return j && !j.bad ? j : { ok: false, fail: true };
    } catch (e) { console.log('use count failed', e && e.message); return { ok: false, fail: true }; }
  }
  if (!env.WARDROBE) return { ok: false, fail: true };
  const key = `use:${id}:${day}`, use = (await env.WARDROBE.get(key, 'json')) || {}, have = +use[what] || 0;
  if (n > 0 && have + n > cap) return { ok: false, used: have };
  if (n < 0 && !have) return { ok: true, used: 0 };
  use[what] = Math.max(0, have + n);
  await env.WARDROBE.put(key, JSON.stringify(use), USE_TTL);
  return { ok: true, used: use[what] };
}
/* every tester together, per UTC day: a ceiling on what the owner's API keys can be made to pay for, whatever the number of
   invitations (each tester's own caps still apply first). Counted like one more tester, under the id 'all' (a tester's id is
   8–24 characters, so it can't be one); the owner is never counted. The worker's TESTER_DAILY_TOTAL variable (JSON, e.g.
   {"photo":20}) changes any of them. About $15 a day at most with these numbers. */
/* write: 450 of the free plan's 1,000 KV writes a day for every tester together, so the owner (backups, the PC's picture uploads,
   the reminders, the clean-up) always has more than half; list: 150 of its 1,000 lists */
const ALL_CAPS = { tag: 150, pattern: 40, photo: 40, item: 60, upload: 300, feedback: 100, backup: 300, push: 200, write: 450, list: 150 }, ALL_ID = 'all';
function allCaps(env) {
  let o = {}; try { o = JSON.parse(env.TESTER_DAILY_TOTAL || '{}') || {}; } catch { }
  const out = { ...ALL_CAPS };
  for (const k of Object.keys(ALL_CAPS)) if (o[k] != null && Number.isFinite(+o[k]) && +o[k] >= 0) out[k] = Math.round(+o[k]);
  return out;
}
/* before a capped call: null when it may go ahead (and is now counted), else {status, body} to answer with */
const capOf = (who, what) => who.caps[what] ?? EXTRA_CAPS[what];
const busyBody = () => ({ status: 503, body: { error: 'busy', message: 'Couldn’t check today’s limit. Try again in a moment.' } });
function limitBody(what, cap, used, all) {
  const message = all ? `Today’s ${CAP_WORDS[what]} for everyone testing the app are used up. They start again at midnight UTC.`
    : what === 'backup' ? `Today’s ${cap} backups are used up. Your changes are kept on this phone and backed up tomorrow.` : `Today’s limit of ${cap} ${CAP_WORDS[what]} is used up. It starts again at midnight UTC.`;
  return { status: 429, body: { error: 'limit', what, ...(all ? { all: true } : { cap, used }), message, detail: message } };
}
/* before a capped call: null when it may go ahead (and n are now counted), else {status, body} to answer with */
async function spend(env, who, what, day = utcDay(), n = 1) {
  if (!who.caps || n <= 0) return null;
  const cap = capOf(who, what), r = await useCount(env, who.id, what, n, cap, day);
  if (r.off) return { status: 403, body: { error: 'invite off', message: INVITE_OFF } };
  if (r.fail) return busyBody();
  if (!r.ok) return limitBody(what, cap, r.used);
  const all = await useCount(env, ALL_ID, what, n, allCaps(env)[what], day);
  if (all.ok) return null;
  try { await useCount(env, who.id, what, -n, 0, day); } catch { }   // not made: the tester's own count goes back
  return all.fail ? busyBody() : limitBody(what, 0, 0, true);
}
/* several counts for one call (a capped call and the KV writes it makes): all of them, or none and the refusal */
async function spendEach(env, who, list, day = utcDay()) {
  const done = [];
  for (const [what, n] of list) {
    const over = await spend(env, who, what, day, n);
    if (over) { for (const [w, k] of done) await unspend(env, who, w, day, k); return over; }
    done.push([what, n]);
  }
  return null;
}
/* up to n of `what`, as many as the tester's own cap and everyone's allow -> {got, over}: over, the refusal, when got < n */
async function spendUpTo(env, who, what, n, day = utcDay()) {
  if (!who.caps || n <= 0) return { got: n, over: null };
  const take = async (id, cap) => {   // -> how many of n were counted for id
    let r = await useCount(env, id, what, n, cap, day);
    if (r.ok) return { got: n };
    if (r.off || r.fail) return { got: 0, r };
    const left = Math.max(0, cap - (+r.used || 0));
    if (left) { r = await useCount(env, id, what, left, cap, day); if (r.ok) return { got: left }; }
    return { got: 0, r };
  };
  const cap = capOf(who, what), mine = await take(who.id, cap);
  if (mine.r && mine.r.off) return { got: 0, over: { status: 403, body: { error: 'invite off', message: INVITE_OFF } } };
  if (!mine.got) return { got: 0, over: mine.r && mine.r.fail ? busyBody() : limitBody(what, cap, mine.r && mine.r.used) };
  const nn = n; n = mine.got;
  const all = await take(ALL_ID, allCaps(env)[what]);
  if (all.got < mine.got) try { await useCount(env, who.id, what, all.got - mine.got, 0, day); } catch { }   // the tester's surplus goes back
  return { got: all.got, over: all.got >= nn ? null : all.got < mine.got ? (all.r && all.r.fail ? busyBody() : limitBody(what, 0, 0, true)) : limitBody(what, cap, cap) };
}
async function unspend(env, who, what, day = utcDay(), n = 1) {
  if (who.caps && n > 0) { try { await useCount(env, who.id, what, -n, 0, day); } catch { } try { await useCount(env, ALL_ID, what, -n, 0, day); } catch { } }
}
/* KV writes that happen whatever the cap says (a backup's daily copies, made with the save they belong to): counted, never refused */
async function countWrites(env, who, n, day = utcDay()) {
  if (who.caps && n > 0) { try { await useCount(env, who.id, 'write', n, 1e9, day); } catch { } try { await useCount(env, ALL_ID, 'write', n, 1e9, day); } catch { } }
}
/* a queued photo that could not be made gives its count back (the job says what it counted as, and on which day) */
async function refundJob(env, ns, job) {
  if (ns && job && USE_RE.test(String(job.cap || '')) && DAY_KEY.test(String(job.capDay || ''))) {
    try { await useCount(env, ns.slice(2, -1), job.cap, -1, 0, job.capDay); } catch { }
    try { await useCount(env, ALL_ID, job.cap, -1, 0, job.capDay); } catch { }
  }
}
/* whose a queue message is: '' the owner's (no ns, as every message was before), 'u:<id>:' a tester's, null when it is neither */
const msgNs = msg => { const n = msg.body && msg.body.ns; return n == null || n === '' ? '' : NS_RE.test(String(n)) ? String(n) : null; };
async function usedOf(env, id, day) {
  let n = {};
  const hub = id !== 'owner' && hubOf(env, `u:${id}:`);
  try {
    if (hub) n = (await (await hub.fetch(`https://hub/used?day=${day}`)).json()).used || {};
    else if (id !== 'owner' && env.WARDROBE) n = (await env.WARDROBE.get(`use:${id}:${day}`, 'json')) || {};
  } catch { }
  return Object.fromEntries(Object.keys(DEFAULT_CAPS).map(k => [k, +n[k] || 0]));
}
/* GET /me -> {id, name, role, caps, used, day}: who the app is connected as, and today's use against each cap (caps null: the owner) */
async function handleMe(req, env, json, who) {
  const day = utcDay();
  return json({ id: who.id, name: who.name, role: who.role, ...(who.firstUntil ? { firstUntil: who.firstUntil } : {}), caps: who.caps ? Object.fromEntries(Object.keys(DEFAULT_CAPS).map(k => [k, who.caps[k]])) : null, used: await usedOf(env, who.id, day), day });
}
const smallBody = async (req, limit) => { try { const r = await readCapped(req.body, limit); return r.over ? null : JSON.parse(new TextDecoder().decode(r.bytes)); } catch { return null; } };
const ownerOnly = (who, json) => (who.role === 'owner' ? null : json({ error: 'owner only' }, 403));
const NO_KV = { error: 'Add a KV namespace binding named WARDROBE to the worker.' };

/* ---- invitations (owner only). POST /invites {name, caps?} -> {id, code, name}: the code (32 URL-safe characters from 24 random
   bytes) is shown this once; KV keeps invite:<sha256 of the code> = {id, name, caps, created, off}. GET /invites -> {invites, day}
   with today's use, from one index document (invites:index) rather than a KV list. DELETE /invites?id= switches one off: its
   hub refuses AI calls at once, and KV shows the record as off to every other route within about a minute. ---- */
async function handleInvites(req, env, json, who) {
  const no = ownerOnly(who, json); if (no) return no;
  if (!env.WARDROBE) return json(NO_KV, 501);
  const index = (await env.WARDROBE.get(INVITE_INDEX, 'json')) || { list: [] }, list = Array.isArray(index.list) ? index.list : [];
  if (req.method === 'GET') {
    const day = utcDay();
    const invites = await Promise.all(list.map(async v => ({ id: v.id, name: v.name, caps: { ...DEFAULT_CAPS, ...cleanCaps(v.caps) }, created: v.created, off: !!v.off,
      used: v.off ? Object.fromEntries(Object.keys(DEFAULT_CAPS).map(k => [k, 0])) : await usedOf(env, v.id, day) })));
    return json({ invites, day });
  }
  if (req.method === 'POST') {
    const b = await smallBody(req, 4000), name = String(b && b.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return json({ error: 'name', message: 'Give the tester a name.' }, 400);
    if (list.filter(v => !v.off).length >= MAX_INVITES) return json({ error: 'full', message: `There are already ${MAX_INVITES} invitations. Revoke one first.` }, 400);
    const id = [...crypto.getRandomValues(new Uint8Array(10))].map(x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join('');
    const code = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const hash = await sha256Hex(code), caps = cleanCaps(b.caps), rec = { id, name, caps: Object.keys(caps).length ? caps : null, created: Date.now(), off: false };
    await env.WARDROBE.put(`invite:${hash}`, JSON.stringify(rec));
    await env.WARDROBE.put(INVITE_INDEX, JSON.stringify({ list: [...list, { ...rec, hash }] }));
    return json({ id, code, name });
  }
  if (req.method === 'DELETE') {
    // ?purge=1 also deletes everything the tester stored (backup, photos, feedback, counts) and takes them off the list;
    // the code stays refused ("switched off")
    const q = new URL(req.url).searchParams, id = q.get('id') || '', v = list.find(x => x.id === id), purge = q.get('purge') === '1';
    if (!v) return json({ error: 'no such invitation' }, 404);
    v.off = true;
    const hub = hubOf(env, `u:${v.id}:`);
    if (hub) try { await hub.fetch(purge ? 'https://hub/wipe?off=1' : 'https://hub/off', { method: 'POST' }); } catch (e) { console.log('hub off failed', e && e.message); }
    const rec = (await env.WARDROBE.get(`invite:${v.hash}`, 'json')) || { id: v.id, name: v.name, caps: v.caps || null, created: v.created };
    await env.WARDROBE.put(`invite:${v.hash}`, JSON.stringify({ ...rec, off: true }));
    await env.WARDROBE.put(INVITE_INDEX, JSON.stringify({ list: purge ? list.filter(x => x.id !== v.id) : list }));
    if (!purge) return json({ ok: true });
    await dropTesterExtras(env, v.id);
    const ns = `u:${v.id}:`, done = await wipeSome(env, ns, 30);
    if (!done && env.RENDER_QUEUE) { await env.RENDER_QUEUE.send({ wipe: ns, n: 1 }); return json({ ok: true, purged: true }); }
    return json({ ok: true, purged: done, ...(done ? {} : { more: true }) });
  }
  return json({ error: 'method not allowed' }, 405);
}

/* ---- feedback. POST /feedback {text, version, where} -> {ok:true} from anyone connected (text up to 4,000 characters);
   GET /feedback (owner) -> {items:[{t, name, text, version, where}]}, newest first. One document, feedback:log, holding the last
   180 days (500 messages at most): one KV write per message and one read to show them, no list. ---- */
const FEEDBACK_MS = 180 * 86400000, FEEDBACK_MAX = 500;
async function handleFeedback(req, env, json, who) {
  if (!env.WARDROBE) return json(NO_KV, 501);
  const log = (await env.WARDROBE.get(FEEDBACK_KEY, 'json')) || { items: [] }, now = Date.now();
  const items = (Array.isArray(log.items) ? log.items : []).filter(m => m && now - m.t < FEEDBACK_MS);
  if (req.method === 'GET') {
    const no = ownerOnly(who, json); if (no) return no;
    return json({ items: items.map(({ t, name, text, version, where }) => ({ t, name, text, version, where })).sort((a, b) => b.t - a.t) });
  }
  const b = await smallBody(req, 40000), text = String(b && b.text || '').trim();
  if (!text) return json({ error: 'empty', message: 'Write a few words first.' }, 400);
  if (text.length > 4000) return json({ error: 'too long', message: 'That is over 4,000 characters. Shorten it a little.' }, 400);
  const over = await spendEach(env, who, [['feedback', 1], ['write', 1]]); if (over) return json(over.body, over.status);
  items.push({ t: now, id: who.id, name: who.name, text, version: String(b.version ?? '').slice(0, 40), where: String(b.where ?? '').slice(0, 80) });
  await env.WARDROBE.put(FEEDBACK_KEY, JSON.stringify({ items: items.slice(-FEEDBACK_MAX) }), { expirationTtl: FEEDBACK_MS / 1000 });
  return json({ ok: true });
}

/* ---- DELETE /account {confirm:'delete'} -> {ok:true}: everything kept for the caller is deleted, and nothing of anyone else's.
   A tester: every key under u:<id>:, the day's count, the invitation (the code stops working at once) and their feedback.
   The owner: the owner's own key families only (the backup, snap:, render:, job:, jobfail:, jobrun:), never u:…, invite:… or
   the invitation list. A Worker may make only so many KV calls per request, so a first part goes now and the queue finishes
   the rest ({wipe}); without the queue the answer carries more:true and the same call deletes the next part. ---- */
const OWNER_FAMILIES = ['wardrobe:v1', 'snap:', 'render:', 'job:', 'jobfail:', 'jobrun:', 'ph:'];
async function wipeSome(env, ns, budget) {   // -> true once nothing is left
  for (const p of ns ? [ns] : OWNER_FAMILIES) {
    for (;;) {
      if (budget < 2) return false;
      const l = await env.WARDROBE.list({ prefix: p, limit: Math.max(1, budget - 1) }); budget--;
      const keys = (l.keys || []).map(k => k.name).filter(n => (ns ? n.startsWith(ns) : !/^(u:|invite|feedback:)/.test(n) && (p.endsWith(':') || n === p || n.startsWith(p + '~')))).slice(0, budget);   // (<key>~<rev>~<i>: a large backup's parts)
      if (!keys.length) break;
      for (const k of keys) { await env.WARDROBE.delete(k); budget--; }
    }
  }
  return true;
}
/* what a tester has outside u:<id>:: their feedback and today's count */
/* a deleted account's reminders: its subscriptions leave push:subs */
async function dropPush(env, ns) {
  const doc = await env.WARDROBE.get(PUSH_KEY, 'json');
  if (doc && Array.isArray(doc.list) && doc.list.some(x => x.ns === ns)) await env.WARDROBE.put(PUSH_KEY, JSON.stringify({ list: doc.list.filter(x => x.ns !== ns) }));
}
async function dropTesterExtras(env, id) {
  await dropPush(env, `u:${id}:`);
  const log = await env.WARDROBE.get(FEEDBACK_KEY, 'json');
  if (log && Array.isArray(log.items) && log.items.some(m => m.id === id)) await env.WARDROBE.put(FEEDBACK_KEY, JSON.stringify({ items: log.items.filter(m => m.id !== id) }), { expirationTtl: FEEDBACK_MS / 1000 });
  const use = `use:${id}:${utcDay()}`; if (await env.WARDROBE.get(use)) await env.WARDROBE.delete(use);
}
async function handleAccount(req, env, json, who) {
  if (!env.WARDROBE) return json(NO_KV, 501);
  const b = await smallBody(req, 2000);
  if (!b || b.confirm !== 'delete') return json({ error: 'confirm', message: 'Deleting needs {"confirm":"delete"}.' }, 400);
  const hub = hubOf(env, who.ns);
  if (who.role === 'tester') {
    await env.WARDROBE.delete(`invite:${who.hash}`);   // first: the code stops working
    const index = await env.WARDROBE.get(INVITE_INDEX, 'json');
    if (index && Array.isArray(index.list) && index.list.some(v => v.id === who.id)) await env.WARDROBE.put(INVITE_INDEX, JSON.stringify({ list: index.list.filter(v => v.id !== who.id) }));
    await dropTesterExtras(env, who.id);
  }
  if (!who.ns) await dropPush(env, '');
  if (hub) try { await hub.fetch(`https://hub/wipe${who.ns ? '?off=1' : ''}`, { method: 'POST' }); } catch (e) { console.log('hub wipe failed', e && e.message); }
  const done = await wipeSome(env, who.ns, 30);
  if (!done && env.RENDER_QUEUE) { await env.RENDER_QUEUE.send({ wipe: who.ns || 'owner', n: 1 }); return json({ ok: true }); }
  return json({ ok: true, ...(done ? {} : { more: true }) });
}
/* the queue finishing a deleted account: {wipe: 'owner' | 'u:<id>:', n}; a part per message until nothing is left */
async function runWipe(msg, env) {
  const w = String(msg.body.wipe), ns = w === 'owner' ? '' : NS_RE.test(w) ? w : null, n = +msg.body.n || 1;
  if (ns !== null && !(await wipeSome(env, ns, 40)) && n < 400) await env.RENDER_QUEUE.send({ wipe: w, n: n + 1 });
  msg.ack();
}


export { DAY_KEY, INVITE_INDEX, JOB_WRITES, UID_RE, USE_RE, countWrites, failFor, handleAccount, handleFeedback, handleInvites, handleMe, limitBody, msgNs, ownerOnly, photoCap, plainFor, refundJob, runWipe, sha256Hex, smallBody, spend, spendEach, spendUpTo, unspend, utcDay, whoIs };
