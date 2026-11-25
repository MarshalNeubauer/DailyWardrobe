/* Daily Wardrobe: the phone's own calendar read, off the main thread (2026-11-25, the owner's design: the phone reads the calendar, the
   server only relays it: POST /calendar/feed, worker/calendar.js). A module worker started by calendar.js (calWorker); it imports the
   same parser the server's POST /calendar uses (calparse.js), so the events are the server's, byte for byte.
   It keeps the last good copy of the feed in Cache Storage 'dw-keep-cal' (one entry per link, named by a hash of the link, never the
   link; its etag, last-modified and ticket in the entry's headers): the next read asks the calendar only whether it changed, a day with
   no change downloads nothing, and offline the kept copy is read for today's window. Settings → Delete my data clears dw-keep-* caches.
   Messages, each answered with the same id:
     {op:'meta', url}                                      -> {has, etag, lm, tk}
     {op:'begin'}, {op:'part', buf}                        -> (no answer) a feed just read, as it arrives
     {op:'read', url, parts?|buf?, etag?, lm?, tk?, from, days} -> {from, to, events} (parts / buf: the feed just read, kept; none: the kept
                                                              copy, {missing:true} when there is none)
     {op:'forget'}                                         -> {} (the kept copies gone) */
import { calEvents, calHash, isoAdd } from './calparse.js';
const KEEP = 'dw-keep-cal';
const keyOf = url => new URL('cal-kept/' + calHash('feed|' + String(url)), self.location.href).href;
async function kept(url) {
  try { const c = await caches.open(KEEP), r = await c.match(keyOf(url)); if (!r) return null;
    return { r, etag: r.headers.get('x-etag') || '', lm: r.headers.get('x-lm') || '', tk: r.headers.get('x-tk') || '' }; }
  catch { return null; }
}
async function keep(url, text, m) {
  try { const c = await caches.open(KEEP), k = keyOf(url);
    for (const q of await c.keys()) if (q.url !== k) await c.delete(q);   // one calendar per person: a link read before goes
    await c.put(k, new Response(text, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'x-etag': m.etag || '', 'x-lm': m.lm || '', 'x-tk': m.tk || '', 'x-at': String(Date.now()) } })); return true; }
  catch { return false; }   // (no room, or no Cache Storage: the read still works, the next one downloads the feed again)
}
let dec = null, pieces = [];   // a feed arriving in parts (op 'begin', 'part'), decoded as it comes
const window_ = (text, d) => { const to = isoAdd(d.from, d.days); return { from: d.from, to, events: calEvents(text, d.tz, d.from, to) }; };
self.onmessage = async e => {
  const d = e.data || {}, id = d.id;
  try {
    if (d.op === 'meta') { const k = await kept(d.url); postMessage({ id, has: !!k, etag: k ? k.etag : '', lm: k ? k.lm : '', tk: k ? k.tk : '' }); return; }
    if (d.op === 'begin') { dec = new TextDecoder(); pieces = []; return; }
    if (d.op === 'part') { if (dec) pieces.push(dec.decode(new Uint8Array(d.buf), { stream: true })); return; }
    if (d.op === 'forget') { try { await caches.delete(KEEP); } catch { } postMessage({ id }); return; }
    if (d.op === 'read') {
      let text;
      if (d.buf || d.parts) {
        if (d.parts) { if (!dec) { postMessage({ id, error: 'no parts' }); return; } text = pieces.join('') + dec.decode(); dec = null; pieces = []; }
        else text = new TextDecoder().decode(d.buf);
        const ok = await keep(d.url, text, d);
        postMessage({ id, ...window_(text, d), kept: ok }); return;
      }
      const k = await kept(d.url);
      if (!k) { postMessage({ id, missing: true }); return; }
      text = await k.r.text();
      if (d.tk && d.tk !== k.tk) await keep(d.url, text, { etag: k.etag, lm: k.lm, tk: d.tk });   // (a new ticket for the same copy)
      postMessage({ id, ...window_(text, d), kept: true }); return;
    }
    postMessage({ id, error: 'unknown' });
  } catch (err) { postMessage({ id, error: String(err && err.name || 'error') }); }
};
