// Made-up calendar feeds for the calendar tests (tests/calfeed.test.js, tests/replay/scripts/CR-cal.js): a long-used work calendar as
// a subscription link gives it, oldest first. Years of past meetings (each with a description and attendees, as Outlook and Google
// write them), weekly series (ended, ongoing, with COUNT), about five meetings a workday in the coming weeks, and three occasions
// listed last (a gala, a wedding, a vacation), so a reader that stops early misses them. Nothing here is a real calendar.
// feed(mb) -> the text, near mb megabytes; the same text for the same mb.
const p2 = n => String(n).padStart(2, '0');
const day = (base, n) => { const t = new Date(Date.UTC(2026, 10, 20)); t.setUTCDate(t.getUTCDate() + n); return t; };
const ymd = t => `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}`;
const NOTES = 'Agenda: review of the quarter, the open items from last time and the next steps. Join on Teams or in the room. Please read the attached notes before the meeting and add your updates to the shared document. ';
function ev(uid, sum, dt, extra = '') {
  return `BEGIN:VEVENT\r\nUID:${uid}@example.test\r\nDTSTAMP:20260101T080000Z\r\nSUMMARY:${sum}\r\n${dt}${extra}END:VEVENT\r\n`;
}
const timed = (t, h, len = 1) => `DTSTART;TZID=Asia/Kuwait:${ymd(t)}T${p2(h)}0000\r\nDTEND;TZID=Asia/Kuwait:${ymd(t)}T${p2(h + len)}0000\r\n`;
const people = i => `ATTENDEE;CN=Person ${i % 37};ROLE=REQ-PARTICIPANT:mailto:person${i % 37}@example.test\r\nATTENDEE;CN=Person ${(i + 5) % 37}:mailto:person${(i + 5) % 37}@example.test\r\nORGANIZER;CN=Lead:mailto:lead@example.test\r\n`;
const meeting = (i, t, h) => ev('m' + i, ['Weekly sync', 'Budget review', 'Project update', 'Client call', 'Team stand-up', '1:1'][i % 6] + ' ' + (i % 97), timed(t, h),
  `LOCATION:Room ${i % 12}\r\nDESCRIPTION:${NOTES.slice(0, 120 + (i % 90))}\r\n${people(i)}BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\n`);
const workday = t => t.getUTCDay() <= 4;   // Sun-Thu
function feed(mb) {
  const head = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Made up//Calendar test//EN\r\nX-WR-CALNAME:Work\r\n';
  const window = [], series = [], last = [];
  let i = 0;
  // the coming weeks: about five meetings a workday (one, on a small calendar of its own) (from 2 days back to 62 ahead)
  for (let n = -2; n <= 62; n++) { const t = day(0, n); if (!workday(t)) continue; for (const h of mb < 0.3 ? [9] : [9, 10, 11, 13, 15]) window.push(meeting(i++, t, h)); }
  // weekly series: ended ones, ongoing ones, and ones with a COUNT
  for (let s = 0; s < (mb < 0.3 ? 2 : 30); s++) series.push(ev('s' + s, 'Ended series ' + s, timed(day(0, -900 + s * 20), 8), `RRULE:FREQ=WEEKLY;UNTIL=${ymd(day(0, -300 + s * 5))}T000000Z\r\nDESCRIPTION:${NOTES}\r\n`));
  for (let s = 0; s < (mb < 0.3 ? 1 : 8); s++) series.push(ev('o' + s, 'Ongoing series ' + s, timed(day(0, -700 + s * 30), 14), `RRULE:FREQ=WEEKLY;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH'][s % 5]}\r\nDESCRIPTION:${NOTES}\r\n`));
  for (let s = 0; s < 4; s++) series.push(ev('c' + s, 'Counted series ' + s, timed(day(0, -60 + s * 7), 16), `RRULE:FREQ=WEEKLY;COUNT=20\r\n`));
  // the occasions, listed last
  last.push(ev('gala', 'Embassy gala, black tie', `DTSTART:${ymd(day(0, 13))}T170000Z\r\nDTEND:${ymd(day(0, 13))}T210000Z\r\n`, 'LOCATION:Embassy\r\n'));
  last.push(ev('wed', "Cousin's wedding", `DTSTART;VALUE=DATE:${ymd(day(0, 26))}\r\nDTEND;VALUE=DATE:${ymd(day(0, 27))}\r\n`));
  last.push(ev('vac', 'Vacation', `DTSTART;VALUE=DATE:${ymd(day(0, 40))}\r\nDTEND;VALUE=DATE:${ymd(day(0, 45))}\r\n`));
  const fixed = head.length + window.join('').length + series.join('').length + last.join('').length + 15;
  // the past: workday meetings going back as far as the size asks, oldest first
  const past = []; let size = fixed, n = -3;
  while (size < mb * 1e6) { const t = day(0, n--); if (!workday(t)) continue; for (const h of [9, 11, 14]) { const e = meeting(i++, t, h); past.push(e); size += e.length; if (size >= mb * 1e6) break; } }
  past.reverse();
  return head + series.join('') + past.join('') + window.join('') + last.join('') + 'END:VCALENDAR\r\n';
}
module.exports = { feed };
