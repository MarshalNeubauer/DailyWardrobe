/* Daily Wardrobe: the calendar parser, one copy for the app and the server (2026-11-25, the owner's design: the phone reads the
   calendar, the server only relays it). An .ics text -> the events of a window, each {id, title, start, end, allDay, time, location, days}.
   Moved here unchanged from worker/calendar.js (calHash ... calEvents): the server's POST /calendar (older apps) imports it, and so does
   the app's cal-worker.js (the phone's own read). Pure: no DOM, no storage, no network, no other file's names (tests/deps.test.js LEAVES).
   An ES module: the page never loads it as a script, only cal-worker.js (a module worker) and, if no Worker can start, calendar.js's
   import(). */
const CAL_SCAN = 40000;   // at most this many events kept from a feed, and steps walked for one repeating event

/* a short, stable hash (two FNV-1a passes): cache keys and the events' ids, so neither the link nor a calendar's own UIDs (which often
   name an email domain) are kept or sent */
function calHash(s) {
  s = String(s); let a = 2166136261, b = 0x811c9dc5 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/* ---- time zones ---- */
// the Windows names Outlook / Microsoft 365 put in TZID, for the zones the app's people live in (Intl knows only IANA names)
const WIN_TZ = { 'Arab Standard Time': 'Asia/Riyadh', 'Arabian Standard Time': 'Asia/Dubai', 'Arabic Standard Time': 'Asia/Baghdad',
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix', 'Pacific Standard Time': 'America/Los_Angeles', 'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu', 'Atlantic Standard Time': 'America/Halifax', 'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik', 'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw', 'E. Europe Standard Time': 'Europe/Chisinau',
  'GTB Standard Time': 'Europe/Bucharest', 'FLE Standard Time': 'Europe/Kiev', 'Turkey Standard Time': 'Europe/Istanbul', 'Israel Standard Time': 'Asia/Jerusalem',
  'Egypt Standard Time': 'Africa/Cairo', 'South Africa Standard Time': 'Africa/Johannesburg', 'Russian Standard Time': 'Europe/Moscow',
  'Iran Standard Time': 'Asia/Tehran', 'Pakistan Standard Time': 'Asia/Karachi', 'India Standard Time': 'Asia/Kolkata', 'Singapore Standard Time': 'Asia/Singapore',
  'China Standard Time': 'Asia/Shanghai', 'Tokyo Standard Time': 'Asia/Tokyo', 'Korea Standard Time': 'Asia/Seoul', 'AUS Eastern Standard Time': 'Australia/Sydney',
  'New Zealand Standard Time': 'Pacific/Auckland', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC' };
const tzFmt = new Map();
const tzKnown = new Map();
function tzOk(tz) { if (tzKnown.has(tz)) return tzKnown.get(tz); let ok; try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); ok = true; } catch { ok = false; } if (tzKnown.size < 500) tzKnown.set(tz, ok); return ok; }
/* minutes east of UTC of zone z at instant ms; z is an IANA name or {fixed: minutes} */
/* (kept per zone and quarter hour: zones change their offset only on a quarter hour, and Intl is the parse's slowest step) */
const tzMemo = new Map();
function tzOffset(ms, z) {
  if (z && typeof z === 'object') return z.fixed;
  const mk = z + '|' + Math.floor(ms / 900e3), got = tzMemo.get(mk); if (got !== undefined) return got;
  if (tzMemo.size > 20000) tzMemo.clear();
  const v = tzOffsetOf(ms, z); tzMemo.set(mk, v); return v;
}
function tzOffsetOf(ms, z) {
  let f = tzFmt.get(z);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); tzFmt.set(z, f); }
  const p = {}; for (const x of f.formatToParts(new Date(ms))) p[x.type] = +x.value;
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000);
}
/* a wall-clock time in zone z -> UTC ms (the second guess settles a DST change) */
function wallToUtc(w, z) {
  const g = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s); let u = g - tzOffset(g, z) * 60000; const o2 = tzOffset(u, z);
  if (g - o2 * 60000 !== u) u = g - o2 * 60000;
  return u;
}
/* UTC ms -> {date 'YYYY-MM-DD', time 'HH:MM'} in zone z */
function utcToLocal(ms, z) {
  const d = new Date(ms + tzOffset(ms, z) * 60000), p = n => String(n).padStart(2, '0');
  return { date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}
const isoOf = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.toISOString().slice(0, 10); };
const isoAdd = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const isoDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/* ---- the .ics text ---- */
/* a property's text value: \n, \, \; and \\ unescaped, control characters and markup characters out, spaces folded */
function calText(v, max) {
  const s = String(v || '').replace(/\\[nN]/g, ' ').replace(/\\([,;\\:"])/g, '$1').replace(/[\u0000-\u001f\u007f<>`"]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, max).join('');
}
/* one content line -> {name, params, value}; a parameter value may be quoted and hold ':' or ';' */
function calLine(l) {
  let i = 0, q = false; const n = l.length;
  for (; i < n; i++) { const c = l[i]; if (c === '"') q = !q; else if (!q && (c === ':')) break; }
  if (i >= n) return null;
  const head = l.slice(0, i), value = l.slice(i + 1), parts = []; let cur = ''; q = false;
  for (const c of head) { if (c === '"') { q = !q; cur += c; } else if (c === ';' && !q) { parts.push(cur); cur = ''; } else cur += c; }
  parts.push(cur);
  const params = {}; for (const p of parts.slice(1)) { const e = p.indexOf('='); if (e > 0) params[p.slice(0, e).toUpperCase()] = p.slice(e + 1).replace(/^"|"$/g, ''); }
  return { name: parts[0].toUpperCase(), params, value };
}
/* a DATE or DATE-TIME value -> {allDay, y, m, d, h, mi, s, utc} */
function calWhen(prop) {
  if (!prop) return null;
  const v = String(prop.value || '').trim(), m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const w = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0), utc: !!m[7], allDay: !m[4] || prop.params.VALUE === 'DATE' };
  if (w.m < 1 || w.m > 12 || w.d < 1 || w.d > 31) return null;
  w.tzid = prop.params.TZID || '';
  return w;
}
/* an ISO 8601 duration (DURATION:P1DT2H) -> ms */
function calDur(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
  if (!m) return null;
  const ms = (((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 + +(m[4] || 0)) * 60 + +(m[5] || 0)) * 60000 + +(m[6] || 0) * 1000;
  return m[1] === '-' ? -ms : ms;
}
/* a RRULE value -> {freq, interval, count, until, byday:[{n, wd}], bymonthday, bymonth} */
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function calRule(v) {
  const r = {}; for (const p of String(v || '').split(';')) { const e = p.indexOf('='); if (e > 0) r[p.slice(0, e).toUpperCase()] = p.slice(e + 1); }
  if (!/^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(r.FREQ || '')) return null;
  const list = s => String(s || '').split(',').filter(Boolean);
  return { freq: r.FREQ, interval: Math.max(1, Math.min(1000, +r.INTERVAL || 1)), count: r.COUNT ? Math.max(0, +r.COUNT || 0) : 0, until: r.UNTIL || '',
    byday: list(r.BYDAY).map(x => { const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(x); return m ? { n: m[1] ? +m[1] : 0, wd: WD[m[2].toUpperCase()] } : null; }).filter(Boolean),
    bymonthday: list(r.BYMONTHDAY).map(Number).filter(n => n && Math.abs(n) <= 31), bymonth: list(r.BYMONTH).map(Number).filter(n => n >= 1 && n <= 12),
    wkst: WD[(r.WKST || 'MO').toUpperCase()] ?? 1 };
}

const CAL_PROPS = /^(BEGIN|END|UID|DTSTART|DTEND|DURATION|RRULE|EXDATE|RECURRENCE-ID|SUMMARY|LOCATION|STATUS|TZID|TZOFFSETTO)[;:]/i;   // the only properties read
/* the text -> [{props: {NAME: [prop…]}}] of the VEVENTs, and the VTIMEZONEs' standard offsets {TZID: minutes} (for a TZID Intl doesn't know) */
function calParse(text, fromIso, toIso) {
  // an event that isn't repeating and lies wholly outside the window (a couple of days' slack for time zones) is dropped as soon as it is
  // read: the time zone work below is the slow part, and a calendar of years holds thousands of past events
  const lo = fromIso ? isoAdd(fromIso, -2) : '', hi = toIso ? isoAdd(toIso, 2) : '', far = fromIso ? isoAdd(fromIso, -40) : '';
  const dayOf = p => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(((p || [])[0] || {}).value || ''); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
  const inWindow = ev => { if (!lo || ev.props.RRULE || ev.props['RECURRENCE-ID']) return true; const s = dayOf(ev.props.DTSTART); if (!s || s > hi) return false;
    return ev.props.DURATION ? s >= far : (dayOf(ev.props.DTEND) || s) >= lo; };
  const lines = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [], tzStd = {}; let ev = null, depth = [], tzid = '', inStd = false;
  for (const raw of lines) {
    if (!raw || !CAL_PROPS.test(raw)) continue;   // (descriptions, attendees, alarms' text: never read)
    const l = calLine(raw); if (!l) continue;
    if (l.name === 'BEGIN') {
      const what = l.value.trim().toUpperCase(); depth.push(what);
      if (what === 'VEVENT' && depth.length === 2) ev = { props: {} };
      else if (what === 'STANDARD') inStd = true;
      continue;
    }
    if (l.name === 'END') {
      const what = l.value.trim().toUpperCase(); depth.pop();
      if (what === 'VEVENT' && ev) { if (inWindow(ev)) events.push(ev); ev = null; if (events.length > CAL_SCAN) break; }
      else if (what === 'STANDARD') inStd = false;
      else if (what === 'VTIMEZONE') tzid = '';
      continue;
    }
    const top = depth[depth.length - 1];
    if (ev && top === 'VEVENT') (ev.props[l.name] = ev.props[l.name] || []).push(l);
    else if (top === 'VTIMEZONE' && l.name === 'TZID') tzid = l.value.trim();
    else if (inStd && tzid && l.name === 'TZOFFSETTO' && !(tzid in tzStd)) { const m = /^([+-])(\d{2})(\d{2})/.exec(l.value.trim()); if (m) tzStd[tzid] = (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]); }
  }
  return { events, tzStd };
}

/* the zone a TZID names: IANA as is, a Windows name mapped, else the calendar's own VTIMEZONE standard offset, else the person's zone */
function zoneOf(tzid, tzStd, home) {
  if (!tzid) return home;
  const t = tzid.replace(/^\/+/, '').replace(/^.*\/(?=[A-Z][a-z]+\/[A-Za-z_]+$)/, '');   // "/mozilla.org/20050126_1/Europe/London" -> Europe/London
  if (tzOk(t)) return t;
  if (WIN_TZ[tzid] && tzOk(WIN_TZ[tzid])) return WIN_TZ[tzid];
  if (tzid in tzStd) return { fixed: tzStd[tzid] };
  return home;
}

/* the occurrences' start wall times of a recurring event, from its first start, up to (and including) the day `toIso`;
   each {y, m, d, h, mi, s} in the event's zone */
function occurrences(w, rule, toIso, fromIso, spanDays, untilMs, zone) {
  const out = [], start = isoOf(w.y, w.m, w.d), wd0 = new Date(start + 'T00:00:00Z').getUTCDay();
  const byday = rule.byday.length ? rule.byday : rule.freq === 'WEEKLY' ? [{ n: 0, wd: wd0 }] : [];
  const weekOf = iso => { const t = Date.parse(iso + 'T00:00:00Z') / 864e5, wd = new Date(iso + 'T00:00:00Z').getUTCDay(); return Math.floor((t - ((wd - rule.wkst + 7) % 7)) / 7); };
  const w0 = weekOf(start), m0 = w.y * 12 + w.m - 1;
  // without COUNT the days before the window can be skipped (the alignment counts from the first start); with COUNT every one counts
  let iso = start; if (!rule.count) { const skip = isoAdd(fromIso, -spanDays - 1); if (skip > iso) iso = skip; }
  for (let g = 0, n = 0; g < CAL_SCAN && iso <= toIso; g++, iso = isoAdd(iso, 1)) {
    const [y, m, d] = iso.split('-').map(Number), wd = new Date(iso + 'T00:00:00Z').getUTCDay(), dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let hit = false;
    if (rule.freq === 'DAILY') hit = isoDays(start, iso) % rule.interval === 0 && (!rule.byday.length || rule.byday.some(b => b.wd === wd)) && (!rule.bymonth.length || rule.bymonth.includes(m));
    else if (rule.freq === 'WEEKLY') hit = (weekOf(iso) - w0) % rule.interval === 0 && byday.some(b => b.wd === wd);
    else if (rule.freq === 'MONTHLY' || rule.freq === 'YEARLY') {
      const step = rule.freq === 'MONTHLY' ? (y * 12 + m - 1 - m0) % rule.interval === 0 : (y - w.y) % rule.interval === 0 && (rule.bymonth.length ? rule.bymonth.includes(m) : m === w.m);
      if (step) {
        if (rule.bymonthday.length) hit = rule.bymonthday.some(x => (x > 0 ? x : dim + 1 + x) === d);
        else if (byday.length) hit = byday.some(b => b.wd === wd && (!b.n || (b.n > 0 ? Math.ceil(d / 7) === b.n : Math.ceil((dim - d + 1) / 7) === -b.n)));
        else hit = d === w.d;
      }
    }
    if (!hit || iso < start) continue;
    const o = { y, m, d, h: w.h, mi: w.mi, s: w.s };
    if (untilMs != null && (w.allDay ? Date.UTC(y, m - 1, d) : w.utc ? Date.UTC(y, m - 1, d, w.h, w.mi, w.s) : wallToUtc(o, zone)) > untilMs) break;
    n++; out.push(o);
    if (rule.count && n >= rule.count) break;
  }
  return out;
}

/* the calendar's events that touch [fromIso, toIso] in the person's zone `home` (an IANA name) -> [{id, title, start, end, allDay, time, location, days}] */
function calEvents(text, home, fromIso, toIso) {
  const { events, tzStd } = calParse(text, fromIso, toIso), out = [], moved = new Map();   // moved: uid -> the original starts (wall times) overrides replace
  const one = (ev, k) => (ev.props[k] || [])[0];
  for (const ev of events) {
    const rid = one(ev, 'RECURRENCE-ID'), uid = (one(ev, 'UID') || {}).value || '';
    if (rid && uid) { const w = calWhen(rid); if (w) { const s = moved.get(uid) || []; s.push(w); moved.set(uid, s); } }
  }
  // a wall time (an EXDATE, a RECURRENCE-ID) -> its day in zone z: a UTC or other-zone time is moved into z first
  const dayIn = (w, z) => w.allDay ? isoOf(w.y, w.m, w.d) : utcToLocal(w.utc ? Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) : wallToUtc(w, w.tzid ? zoneOf(w.tzid, tzStd, home) : z), z).date;
  for (const ev of events) {
    if (/^CANCELLED$/i.test(((one(ev, 'STATUS') || {}).value || '').trim())) continue;
    const st = calWhen(one(ev, 'DTSTART')); if (!st) continue;
    const uid = (one(ev, 'UID') || {}).value || '', title = calText((one(ev, 'SUMMARY') || {}).value, 120), location = calText((one(ev, 'LOCATION') || {}).value, 120);
    const zone = st.utc ? 'UTC' : zoneOf(st.tzid, tzStd, home), en = calWhen(one(ev, 'DTEND')), dur = calDur((one(ev, 'DURATION') || {}).value);
    // the event's length: all-day in days (DTEND is the day after the last), timed in ms
    let spanDays = 1, spanMs = 0;
    if (st.allDay) { spanDays = en && en.allDay ? Math.max(1, isoDays(isoOf(st.y, st.m, st.d), isoOf(en.y, en.m, en.d))) : dur ? Math.max(1, Math.round(dur / 864e5)) : 1; }
    else {
      const s0 = st.utc ? Date.UTC(st.y, st.m - 1, st.d, st.h, st.mi, st.s) : wallToUtc(st, zone);
      const e0 = en && !en.allDay ? (en.utc ? Date.UTC(en.y, en.m - 1, en.d, en.h, en.mi, en.s) : wallToUtc(en, en.tzid ? zoneOf(en.tzid, tzStd, home) : zone)) : dur != null ? s0 + dur : s0;
      spanMs = Math.max(0, e0 - s0); spanDays = Math.ceil(spanMs / 864e5) + 1;
    }
    const rr = !one(ev, 'RECURRENCE-ID') && calRule((one(ev, 'RRULE') || {}).value);
    let starts;
    if (rr) {
      let untilMs = null;
      if (rr.until) { const u = calWhen({ value: rr.until, params: {} }); if (u) untilMs = u.allDay ? Date.UTC(u.y, u.m - 1, u.d, 23, 59, 59) : u.utc ? Date.UTC(u.y, u.m - 1, u.d, u.h, u.mi, u.s) : wallToUtc(u, zone); }
      starts = occurrences(st, rr, toIso, fromIso, spanDays, untilMs, zone);
      // EXDATEs and the instances an override (RECURRENCE-ID) replaces, by their day in the event's zone (a rule here repeats at most daily)
      const ex = new Set((moved.get(uid) || []).map(w => dayIn(w, zone)));
      for (const p of ev.props.EXDATE || []) for (const v of String(p.value).split(',')) { const w = calWhen({ value: v.trim(), params: p.params }); if (w) ex.add(dayIn(w, zone)); }
      starts = starts.filter(o => !ex.has(isoOf(o.y, o.m, o.d)));
    } else starts = [st];
    // an instance's id: the event's UID and, for a repeating event, the instance's own day (an override keeps the day it replaced), so a
    // dismissal or a kept event stays with it; an event with no UID by its title and day
    const rid = calWhen(one(ev, 'RECURRENCE-ID')), base = uid || 'n:' + title;
    for (const o of starts) {
      let start, end, time = '';
      if (st.allDay) { start = isoOf(o.y, o.m, o.d); end = isoAdd(start, spanDays - 1); }
      else {
        const s = st.utc ? Date.UTC(o.y, o.m - 1, o.d, o.h, o.mi, o.s) : wallToUtc(o, zone), a = utcToLocal(s, home), b = utcToLocal(spanMs ? s + spanMs - 1 : s, home);
        // an evening that runs past midnight (a gala until 1 a.m.) is that evening's day; only 24 hours or more spans days
        start = a.date; end = spanMs < 864e5 || b.date < a.date ? a.date : b.date; time = a.time;
      }
      if (end < fromIso || start > toIso) continue;
      const inst = rr ? isoOf(o.y, o.m, o.d) : rid ? dayIn(rid, zone) : uid ? '' : start;
      out.push({ id: calHash(base + '|' + inst), title, start, end, allDay: !!st.allDay, time, location, days: isoDays(start, end) + 1 });
    }
  }
  out.sort((x, y) => x.start < y.start ? -1 : x.start > y.start ? 1 : x.time < y.time ? -1 : 1);
  return out;
}

export { CAL_SCAN, calHash, tzOk, utcToLocal, isoAdd, calEvents };
