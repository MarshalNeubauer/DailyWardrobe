/* Daily Wardrobe worker: the morning reminder (Web Push).
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { publicHost } from './links.js';
import { sha256Hex, smallBody, spendEach, unspend } from './people.js';

/* ================= the morning reminder (Web Push) =================
   A phone that switched the reminder on gives the server its push subscription, the time it wants it (HH:MM in its own time
   zone, an IANA name) and the dates of its coming workdays (the app knows the plan; the server never plans). Every 15 minutes
   the cron sends each phone due within that quarter of an hour a push with no body; the app's service worker then shows the
   outfit line the app kept for that date (sw.js, Cache Storage dw-keep-remind), so no outfit text passes through here and
   nothing needs encrypting. The push is signed with the VAPID key pair (secrets VAPID_PUBLIC_KEY, base64url of the 65-byte
   public point, and VAPID_PRIVATE_KEY, base64url of the 32-byte private scalar; VAPID_SUBJECT, the app's https address or a
   mailto:). One KV document, push:subs, holds every subscription: one read a quarter of an hour, a write only when something
   was sent or changed. A subscription the push service says is gone (404, 410) is dropped. ---- */
const PUSH_KEY = 'push:subs', PUSH_MAX = 200, PUSH_STEP = 15;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
const pushReady = env => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.WARDROBE);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const subId = async endpoint => (await sha256Hex(endpoint)).slice(0, 24);
/* the VAPID header for one push service (aud = its origin), a JWT signed ES256 */
async function vapidAuth(env, endpoint) {
  const pub = unb64u(env.VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const head = enc({ typ: 'JWT', alg: 'ES256' }), body = enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'https://github.com/' });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}
async function pushTo(env, endpoint) {
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { authorization: await vapidAuth(env, endpoint), ttl: '3600', urgency: 'normal', 'content-length': '0' } });
    return r.status;
  } catch (e) { console.log('push failed', e && e.message); return 0; }
}
/* the date and HH:MM a moment is in a time zone */
function localNow(now, tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
  } catch { return null; }
}
/* the run covers the local clock from the run before (prev, 15 minutes earlier) to now (cur): a reminder at `at` (minutes) is due
   when its time lies in (prev, cur]. -> the local date it is due for, or null. Across midnight a 23:50 reminder belongs to the
   day before (the 23:45-00:00 run; the old window [at, at+15) ran past 23:59 and never fired); where the clocks go forward the
   skipped hour lies in one run's span (01:45 -> 03:00), so a 02:30 reminder still fires; where they go back the repeated hour is
   covered twice and `last` keeps it to one */
function dueDay(prev, cur, at) {
  if (!prev || !cur) return null;
  if (prev.date === cur.date) return prev.min < at && at <= cur.min ? cur.date : null;
  return at > prev.min ? prev.date : at <= cur.min ? cur.date : null;
}
async function sendReminders(env, now = new Date()) {
  if (!pushReady(env)) return { sent: 0 };
  const doc = (await env.WARDROBE.get(PUSH_KEY, 'json')) || { list: [] }, list = Array.isArray(doc.list) ? doc.list : [];
  let changed = false, sent = 0;
  const before = new Date(now.getTime() - PUSH_STEP * 60000), l0 = tz => localNow(before, tz);
  for (const s of [...list]) {
    const l = localNow(now, s.tz), [h, m] = String(s.time || '').split(':').map(Number);
    if (!l || !Number.isFinite(h) || !Number.isFinite(m)) continue;
    const at = h * 60 + m;
    const day = dueDay(l0(s.tz), l, at);   // the local date whose reminder falls since the last run, if any
    if (!day || s.last === day || !(s.dates || []).includes(day)) continue;
    const st = await pushTo(env, s.endpoint);
    if (st === 404 || st === 410) { list.splice(list.indexOf(s), 1); changed = true; continue; }
    if (st >= 200 && st < 300) { s.last = day; sent++; changed = true; }
  }
  if (changed) await env.WARDROBE.put(PUSH_KEY, JSON.stringify({ list }));
  return { sent };
}
/* GET /push -> {key, on, time}: the public key a phone subscribes with (null: reminders not set up on this server), and whether
   this subscription (?endpoint=) is on. POST /push {endpoint, time, tz, dates} switches it on or updates it; {endpoint, off:true}
   switches it off. Anyone connected; a tester's are counted (push, 20 a day). */
async function handlePush(req, env, json, who) {
  if (req.method === 'GET') {
    const ep = new URL(req.url).searchParams.get('endpoint') || '', doc = pushReady(env) && ep ? (await env.WARDROBE.get(PUSH_KEY, 'json')) : null;
    const id = ep ? await subId(ep) : '', s = doc && (doc.list || []).find(x => x.id === id && x.ns === who.ns);
    return json({ key: pushReady(env) ? env.VAPID_PUBLIC_KEY : null, on: !!s, time: s ? s.time : null });
  }
  if (!pushReady(env)) return json({ error: 'off', message: 'Reminders aren’t set up on the server yet.' }, 501);
  const b = await smallBody(req, 20000), ep = String(b && b.endpoint || '');
  let host; try { host = new URL(ep); } catch { }
  if (!host || host.protocol !== 'https:' || !publicHost(host.hostname)) return json({ error: 'bad endpoint' }, 400);
  const over = await spendEach(env, who, [['push', 1], ['write', 1]]); if (over) return json(over.body, over.status);
  const doc = (await env.WARDROBE.get(PUSH_KEY, 'json')) || { list: [] }, list = Array.isArray(doc.list) ? doc.list : [], id = await subId(ep);
  // only the caller's own subscription is changed or switched off: knowing another account's push address is not enough
  const mine = x => x.id === id && (x.ns || '') === who.ns, rest = list.filter(x => !mine(x));
  if (b.off) { if (rest.length !== list.length) await env.WARDROBE.put(PUSH_KEY, JSON.stringify({ list: rest })); else await unspend(env, who, 'write'); return json({ ok: true, on: false }); }
  const time = TIME_RE.test(String(b.time || '')) ? b.time : '07:00', tz = String(b.tz || 'UTC').slice(0, 64);
  if (!localNow(new Date(), tz)) return json({ error: 'bad time zone' }, 400);
  const dates = (Array.isArray(b.dates) ? b.dates : []).filter(d => DATE_RE.test(String(d))).slice(0, 31);
  const old = list.find(mine);
  if (!old && rest.length >= PUSH_MAX) return json({ error: 'full', message: 'Too many phones have reminders on.' }, 400);
  rest.push({ id, ns: who.ns, endpoint: ep, time, tz, dates, last: old && old.time === time ? old.last : null });
  await env.WARDROBE.put(PUSH_KEY, JSON.stringify({ list: rest }));
  return json({ ok: true, on: true, time });
}

export { PUSH_KEY, handlePush, sendReminders };
