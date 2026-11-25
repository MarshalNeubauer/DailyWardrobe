/* Daily Wardrobe worker: POST /calendar: a person's calendar subscription link (.ics) read for the app (2026-11-17, the owner's ask:
   "share a calendar link once, and the app sets up occasion days, trips and days off from it").
   A browser can't read most calendar links itself (no CORS), so the server fetches the link and hands back only what the app needs:
   the events of the next CAL_DAYS days, each as {id, title, start, end, allDay, time, location, days}. Nothing else of the calendar
   (descriptions, attendees, organizers, notes) leaves the server.

   Privacy: the link is a secret (anyone with it can read the calendar). It comes in the POST body, never in the address (so it is in no
   access log), is never written to KV, never logged, never echoed in an answer or an error; the in-memory cache and rate count are keyed
   by a hash of who asked and the link. No KV reads or writes at all (the free plan's daily writes are kept for backups).
   Limits: a link must be https (webcal:// is read as https://) on a public host (links.js publicHost, every redirect checked too); at most
   CAL_MAX_BYTES read; CAL_FETCH_MS to answer; per person at most CAL_RATE_N real reads per CAL_RATE_MS in this isolate (a read again
   within CAL_CACHE_MS is answered from memory and costs nothing).
   Since 2026-11-25 the app reads the calendar itself through POST /calendar/feed below (the relay); POST /calendar stays, unchanged, for
   phones on older apps, its parser now in calparse.js (shared with the app). */
import { publicHost, readCapped } from './links.js';
import { calHash, tzOk, utcToLocal, isoAdd, calEvents } from '../calparse.js';   // the parser, shared with the app (calparse.js)

const CAL_DAYS = 60, CAL_EVENTS = 300, CAL_MAX_BYTES = 6e6, CAL_FETCH_MS = 15000, CAL_BODY = 8192;
const CAL_CACHE_MS = 10 * 60e3, CAL_RATE_N = 6, CAL_RATE_MS = 10 * 60e3;
const calCache = new Map();   // hash of (who, link, tz, day) -> {t, body}
const calHits = new Map();    // who.id -> [times of real reads]

/* the link the app sent -> a URL to fetch, or null: https (webcal / webcals read as https), a public host, no user name or password */
function calUrl(s) {
  s = String(s || '').trim(); if (!s || s.length > 2048) return null;
  s = s.replace(/^webcals?:\/\//i, 'https://');
  let u; try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || !publicHost(u.hostname)) return null;
  if (u.protocol === 'http:') u.protocol = 'https:';   // a calendar link over plain http would show the secret on the way: always https
  return u;
}

/* ---- the route ---- */
const CAL_MSG = {
  bad: 'That doesn’t look like a calendar link. Copy the whole link that starts with webcal:// or https://.',
  notCal: 'That link didn’t give a calendar. Check that it is the calendar’s subscription or iCal link (it often ends in .ics).',
  unreachable: 'The calendar couldn’t be read just now. Check the link, or try again later.',
  gone: 'The calendar link no longer works (it may have been reset or made private). Get a new link and connect again.',
  slow: 'The calendar took too long to answer. Try again later.',
  busy: 'The calendar was read several times just now. Try again in a few minutes.',
  big: 'This calendar is too large to read. A calendar of its own for the events that matter for clothes works best.',   // (the relay only: over CAL_FEED_MAX)
};
async function handleCalendar(req, env, json, who) {
  const got = await readCapped(req.body, CAL_BODY);
  let body; try { body = got.over ? null : JSON.parse(new TextDecoder().decode(got.bytes)); } catch { body = null; }
  if (!body || typeof body !== 'object') return json({ error: 'bad request', message: CAL_MSG.bad }, 400);
  const u = calUrl(body.url); if (!u) return json({ error: 'bad link', message: CAL_MSG.bad }, 400);
  const tz = typeof body.tz === 'string' && body.tz.length < 64 && tzOk(body.tz) ? body.tz : 'UTC';
  const days = Math.max(7, Math.min(CAL_DAYS, Math.round(+body.days) || CAL_DAYS));
  const fromIso = utcToLocal(Date.now(), tz).date, toIso = isoAdd(fromIso, days);
  const ck = calHash(who.id + '|' + u.href + '|' + tz + '|' + fromIso + '|' + days), now = Date.now();
  const hit = calCache.get(ck);
  if (hit && now - hit.t < CAL_CACHE_MS && !body.fresh) return json({ ...hit.body, cached: true });
  // per person, per isolate: at most CAL_RATE_N real reads in CAL_RATE_MS (no KV write: a count in memory)
  const times = (calHits.get(who.id) || []).filter(t => now - t < CAL_RATE_MS);
  if (times.length >= CAL_RATE_N) { if (hit) return json({ ...hit.body, cached: true }); return json({ error: 'limit', message: CAL_MSG.busy }, 429); }
  times.push(now); calHits.set(who.id, times);
  if (calHits.size > 500) for (const [k, v] of calHits) if (!v.some(t => now - t < CAL_RATE_MS)) calHits.delete(k);
  let text;
  try {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), CAL_FETCH_MS);
    try {
      let href = u.href, r = null;
      for (let hop = 0; hop < 6; hop++) {
        r = await fetch(href, { redirect: 'manual', signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyWardrobe calendar)', accept: 'text/calendar,text/plain;q=0.8,*/*;q=0.5' } });
        const to = r.status >= 300 && r.status < 400 && r.headers.get('location');
        if (!to) break;
        let next; try { next = new URL(to, href); } catch { next = null; }
        if (!next || !/^https?:$/.test(next.protocol) || !publicHost(next.hostname)) return json({ error: 'bad link', message: CAL_MSG.bad }, 400);
        href = next.href; r = null;
      }
      if (!r) return json({ error: 'unreachable', message: CAL_MSG.unreachable }, 502);
      if (r.status === 401 || r.status === 403 || r.status === 404 || r.status === 410) { try { await r.body?.cancel(); } catch { } return json({ error: 'gone', message: CAL_MSG.gone }, 502); }
      if (!r.ok) { try { await r.body?.cancel(); } catch { } return json({ error: 'unreachable', message: CAL_MSG.unreachable }, 502); }
      const b = await readCapped(r.body, CAL_MAX_BYTES);
      text = new TextDecoder().decode(b.bytes);
    } finally { clearTimeout(timer); }
  } catch (e) {
    // only the kind of failure goes to the log: never the link, its host or the error's text (which can quote the address)
    console.log('calendar read failed:', e && e.name === 'AbortError' ? 'timeout' : 'network');
    return json({ error: e && e.name === 'AbortError' ? 'slow' : 'unreachable', message: e && e.name === 'AbortError' ? CAL_MSG.slow : CAL_MSG.unreachable }, e && e.name === 'AbortError' ? 504 : 502);
  }
  if (!/^\s*BEGIN:VCALENDAR/i.test(text.replace(/^﻿/, ''))) return json({ error: 'not a calendar', message: CAL_MSG.notCal }, 422);
  let events;
  try { events = calEvents(text, tz, fromIso, toIso); }
  catch (e) { console.log('calendar parse failed:', e && e.name); return json({ error: 'not a calendar', message: CAL_MSG.notCal }, 422); }
  const out = { from: fromIso, to: toIso, tz, events: events.slice(0, CAL_EVENTS), more: events.length > CAL_EVENTS };
  calCache.set(ck, { t: now, body: out });
  if (calCache.size > 200) for (const [k, v] of calCache) if (now - v.t >= CAL_CACHE_MS) calCache.delete(k);
  return json(out);
}
/* ---- POST /calendar/feed: the relay (2026-11-25, the owner's design: the phone reads the calendar, the server only relays it) ----
   {url, tk?, etag?, lm?} -> the feed's own bytes, streamed as they arrive and never parsed here (the free plan's CPU time: a long-used
   calendar of 1.4 MB took about 12 ms to parse, over its 10 ms), or 204 when the calendar says it hasn't changed (etag / lm passed on as
   If-None-Match / If-Modified-Since: an unchanged calendar costs the phone no data). The app parses it with calparse.js, the parser above.
   Not an open proxy: the same link checks, redirects checked by hand and the person's own code as POST /calendar; only a body that starts
   as a calendar (BEGIN:VCALENDAR) is relayed (else 422, nothing of it sent); and only the person's own link: its ticket `tk` (x-cal-tk,
   an HMAC of who and the link under the owner's secret) is given with each relayed read, and a link without its ticket (a new link:
   Connect, or a phone's first read) counts against CAL_NEW_N reads per CAL_NEW_MS per person in this isolate. No KV reads or writes. */
const CAL_FEED_MAX = 40e6, CAL_PEEK = 64, CAL_BODY_MS = 60000, CAL_NEW_N = 4, CAL_NEW_MS = 60 * 60e3;
const CAL_EXPOSE = 'x-now,x-cal-etag,x-cal-lm,x-cal-tk';
const calNew = new Map();     // who.id -> [times of reads of a link without its ticket]
let calKey = null, calKeyOf = '';
async function calTicket(env, who, href) {
  const sec = String(env.APP_TOKEN || '');
  if (!calKey || calKeyOf !== sec) { calKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('dw-calendar-feed|' + sec), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); calKeyOf = sec; }
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', calKey, new TextEncoder().encode(who.id + '|' + href)));
  let s = ''; for (let i = 0; i < 18; i++) s += String.fromCharCode(sig[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_');
}
/* the text of a body's first bytes (up to 256) */
function calLead(parts) {
  const b = new Uint8Array(256); let o = 0;
  for (const p of parts) { if (o >= b.length) break; const s = p.subarray(0, b.length - o); b.set(s, o); o += s.length; }
  return new TextDecoder().decode(b.subarray(0, o));
}
const calHead = v => typeof v === 'string' && v.length <= 200 && /^[\x20-\x7e]+$/.test(v) ? v : '';   // an etag / date sent back as given
async function handleCalFeed(req, env, json, who, cors) {
  const got = await readCapped(req.body, CAL_BODY);
  let body; try { body = got.over ? null : JSON.parse(new TextDecoder().decode(got.bytes)); } catch { body = null; }
  if (!body || typeof body !== 'object') return json({ error: 'bad request', message: CAL_MSG.bad }, 400);
  const u = calUrl(body.url); if (!u) return json({ error: 'bad link', message: CAL_MSG.bad }, 400);
  const tk = await calTicket(env, who, u.href), own = typeof body.tk === 'string' && body.tk === tk, now = Date.now();
  // the same count as POST /calendar (a real read is a real read), and a new link's own, smaller one
  const times = (calHits.get(who.id) || []).filter(t => now - t < CAL_RATE_MS), fresh = (calNew.get(who.id) || []).filter(t => now - t < CAL_NEW_MS);
  if (times.length >= CAL_RATE_N || (!own && fresh.length >= CAL_NEW_N)) return json({ error: 'limit', message: CAL_MSG.busy }, 429);
  times.push(now); calHits.set(who.id, times); if (!own) { fresh.push(now); calNew.set(who.id, fresh); }
  for (const m of [calHits, calNew]) if (m.size > 500) for (const [k, v] of m) if (!v.some(t => now - t < CAL_NEW_MS)) m.delete(k);
  const etag = calHead(body.etag), lm = calHead(body.lm);
  const ac = new AbortController(); let timer = setTimeout(() => ac.abort(), CAL_FETCH_MS), r = null, rd = null;
  const head = { ...cors, 'Access-Control-Expose-Headers': CAL_EXPOSE, 'cache-control': 'no-store', 'x-cal-tk': tk };
  try {
    let href = u.href;
    for (let hop = 0; hop < 6; hop++) {
      r = await fetch(href, { redirect: 'manual', signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyWardrobe calendar)', accept: 'text/calendar,text/plain;q=0.8,*/*;q=0.5',
        ...(etag ? { 'if-none-match': etag } : {}), ...(lm ? { 'if-modified-since': lm } : {}) } });
      const to = r.status >= 300 && r.status < 400 && r.status !== 304 && r.headers.get('location');
      if (!to) break;
      try { await r.body?.cancel(); } catch { }
      let next; try { next = new URL(to, href); } catch { next = null; }
      if (!next || !/^https?:$/.test(next.protocol) || !publicHost(next.hostname)) { clearTimeout(timer); return json({ error: 'bad link', message: CAL_MSG.bad }, 400); }
      href = next.href; r = null;
    }
    const drop = async () => { clearTimeout(timer); try { await r.body?.cancel(); } catch { } };
    if (!r) { clearTimeout(timer); return json({ error: 'unreachable', message: CAL_MSG.unreachable }, 502); }
    if (r.status === 304 && (etag || lm)) { await drop(); return new Response(null, { status: 204, headers: head }); }
    if (r.status === 401 || r.status === 403 || r.status === 404 || r.status === 410) { await drop(); return json({ error: 'gone', message: CAL_MSG.gone }, 502); }
    if (!r.ok || !r.body) { await drop(); return json({ error: 'unreachable', message: CAL_MSG.unreachable }, 502); }
    if (+(r.headers.get('content-length') || 0) > CAL_FEED_MAX) { await drop(); return json({ error: 'too large', message: CAL_MSG.big }, 413); }
    // the first bytes: a calendar, or nothing of it is sent
    rd = r.body.getReader(); const first = []; let n = 0;
    while (n < CAL_PEEK) { const { done, value } = await rd.read(); if (done) break; first.push(value); n += value.byteLength; }
    if (!/^\s*BEGIN:VCALENDAR/i.test(calLead(first).replace(/^﻿/, ''))) { clearTimeout(timer); try { await rd.cancel(); } catch { } return json({ error: 'not a calendar', message: CAL_MSG.notCal }, 422); }
    clearTimeout(timer); timer = setTimeout(() => ac.abort(), CAL_BODY_MS);   // the rest of the body has a minute
    let sent = 0;
    const out = new ReadableStream({
      start(c) { for (const p of first) c.enqueue(p); sent = n; },
      async pull(c) {
        try {
          const { done, value } = await rd.read();
          if (done) { clearTimeout(timer); c.close(); return; }
          sent += value.byteLength;
          if (sent > CAL_FEED_MAX) { clearTimeout(timer); try { await rd.cancel(); } catch { } c.error(new Error('too large')); return; }   // never cut silently: the read fails
          c.enqueue(value);
        } catch (e) { clearTimeout(timer); console.log('calendar relay failed:', e && e.name === 'AbortError' ? 'timeout' : 'network'); c.error(e); }
      },
      cancel() { clearTimeout(timer); try { rd.cancel(); } catch { } },
    });
    const etagOut = calHead(r.headers.get('etag') || ''), lmOut = calHead(r.headers.get('last-modified') || '');
    return new Response(out, { status: 200, headers: { ...head, 'content-type': 'text/calendar; charset=utf-8', ...(etagOut ? { 'x-cal-etag': etagOut } : {}), ...(lmOut ? { 'x-cal-lm': lmOut } : {}) } });
  } catch (e) {
    clearTimeout(timer); if (rd) { try { await rd.cancel(); } catch { } }
    console.log('calendar read failed:', e && e.name === 'AbortError' ? 'timeout' : 'network');   // never the link, its host or the error's text
    return json({ error: e && e.name === 'AbortError' ? 'slow' : 'unreachable', message: e && e.name === 'AbortError' ? CAL_MSG.slow : CAL_MSG.unreachable }, e && e.name === 'AbortError' ? 504 : 502);
  }
}

/* for the tests: forget the in-memory cache and counts */
function calReset() { calCache.clear(); calHits.clear(); calNew.clear(); }

export { handleCalendar, handleCalFeed, calEvents, calUrl, calReset, CAL_RATE_N, CAL_NEW_N, CAL_FEED_MAX };
