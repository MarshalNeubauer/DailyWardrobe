/* Daily Wardrobe worker: GET /holidays: public holidays from Google's calendars.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */

/* GET /holidays?country=KW -> {country, holidays: [{date:'YYYY-MM-DD', name}], source}
   Public holidays from Google's public holiday calendars, for the countries the app's first source (Nager.Date, which the
   app asks directly) does not cover, e.g. the Gulf states. Only national public holidays are kept (no observances, no
   regional ones); a holiday of several days is listed day by day. Requires APP_TOKEN. */
function parseHolidayIcs(text) {
  const out = [], unfolded = String(text).replace(/\r?\n[ \t]/g, '');
  for (const ev of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const get = k => { const m = ev.match(new RegExp('^' + k + '[^:\\r\\n]*:(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const clean = s => s.replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1').trim();
    const start = get('DTSTART'), end = get('DTEND'), desc = clean(get('DESCRIPTION')), name = clean(get('SUMMARY'));
    if (!/^\d{8}$/.test(start) || !name) continue;
    if (desc && !/^Public holiday(?! in )/i.test(desc)) continue;     // observances and regional holidays are not days off
    const day = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
    const last = /^\d{8}$/.test(end) ? day(end) : new Date(+day(start) + 864e5);
    for (let d = day(start), n = 0; d < last && n < 31; d = new Date(+d + 864e5), n++) out.push({ date: d.toISOString().slice(0, 10), name });
  }
  return out;
}
async function handleHolidays(req, env, json) {
  const cc = (new URL(req.url).searchParams.get('country') || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return json({ error: 'country must be a two-letter code' }, 400);
  let all = [];
  for (const id of [`en.${cc}.official`, `en.${cc}`]) {
    try {
      const r = await fetch(`https://calendar.google.com/calendar/ical/${encodeURIComponent(id + '#holiday@group.v.calendar.google.com')}/public/basic.ics`);
      if (r.ok) all = parseHolidayIcs(await r.text());
    } catch { /* try the next calendar name */ }
    if (all.length) break;
  }
  const holidaysError = 'There is no public holiday list for that country. Add its holidays as your own days off below.';
  if (!all.length) return json({ error: 'no holiday list', holidaysError }, 404);
  const from = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10), to = new Date(Date.now() + 430 * 864e5).toISOString().slice(0, 10);
  const byDay = new Map();
  for (const h of all) if (h.date >= from && h.date <= to) byDay.set(h.date, byDay.has(h.date) && !byDay.get(h.date).includes(h.name) ? byDay.get(h.date) + ', ' + h.name : byDay.get(h.date) || h.name);
  return json({ country: cc.toUpperCase(), source: 'google', holidays: [...byDay].sort().map(([date, name]) => ({ date, name })) });
}

export { handleHolidays };
