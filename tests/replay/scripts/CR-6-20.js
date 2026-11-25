// CR-6-20 (Round D, the review's R6 N2, 2026-11-25): the phone reads the calendar, the server only relays it (POST /calendar/feed); the
// parser moved to calparse.js, shared by the app and the server's POST /calendar. Phones still on the app before this change ask the
// server to parse (POST /calendar), so that must answer exactly as before. For each made-up calendar (the personal fixture, 1.4 MB and
// 6 MB work calendars from tests/calfeeds.js), a phone connects it in Settings → Calendar three ways:
//   A  the app before this change (40dbc2c) against the server before it (40dbc2c): what phones see today
//   B  the same app against this checkout's server: an older app after the server is updated
//   C  this checkout's app and server
// REPRODUCED = B differs from A in anything a person sees or keeps (the events kept, the words after Connect, the review list, the
// Settings line and summary), or C lost an event A had. Also printed: what C keeps beyond A (every event of the 60 days, and the
// occasions of a feed over 6 MB), and the server's calendar requests and KV writes per step.
// Own port 9230 (Round D, lane d-cal), profiles cr620-*, kv .work/kv/cr620.json.  node tests/replay/run.js --only CR-6-20
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const { openPhone, mock: mk } = require(H + 'phone.js');
const PORT = 9230, KV = RP.SCRATCH + '/kv/cr620.json', NEW = RP.APP, OLD_SHA = '40dbc2c';
const TIME = '2026-11-20T09:00:00+03:00';
const FEEDS = [['personal', { fixture: 'personal.ics' }], ['1.4 MB', { mb: 1.4 }], ['6 MB', { mb: 6 }]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mock = (w, b) => mk(PORT, w, b);
let lab = null;
async function startLab(app, worker) {
  if (lab) await stopLab();
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--app', app, '--worker', worker, '--kv', KV], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 100; i++) { await sleep(150); if (fs.existsSync(RP.labInfo(PORT))) { try { const j = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')); await mock('clock', { at: new Date(TIME).toISOString() }); return j } catch {} } }
  throw new Error('lab did not start');
}
async function stopLab() { if (!lab) return; await sleep(800); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) }) }
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
async function connect(app, worker, tag, name, src) {
  fs.rmSync(KV, { force: true });
  const info = await startLab(app, worker), href = `https://cal.example.test/p/Cr620Secret/${encodeURIComponent(name)}.ics`;
  await mock('cal', { href, ...src, etag: '"r1"' });
  const P = await openPhone({ profile: `cr620-${tag}`, fresh: true, time: TIME });
  try {
    await P.page.goto(info.inviteLink); await P.ready(); await sleep(3000);
    await P.page.evaluate(() => { try { localStorage.setItem('tour_seen', '1') } catch {} settings.workdays = [0, 1, 2, 3, 4]; settings.location = { name: 'Kuwait City, KW', lat: 29.37, lon: 47.98 }; openSettings('calendar') });
    await P.page.waitForSelector('#cal-link', { timeout: 15000 });
    const w0 = (await mock('log')).kvPut;
    await P.page.fill('#cal-link', href.replace('https://', 'webcal://')); await P.tap('#cal-connect');
    await P.page.waitForFunction(() => /^Connected|couldn|didn|no longer/.test(($('#cal-msg') || {}).textContent || ''), null, { timeout: 90000 });
    await sleep(1500);
    const s = await P.page.evaluate(() => { const l = JSON.parse(localStorage.getItem('cal_last') || '{}');
      return { events: JSON.stringify(l.events || []), n: (l.events || []).length, from: l.from, to: l.to, msg: $('#cal-msg').textContent, rows: [...document.querySelectorAll('#cal-review .cal-row')].map(r => r.querySelector('b').textContent + ' → ' + r.querySelector('.cal-to').textContent).join(' | '),
        status: $('#cal-status').textContent.replace(/^Last read [^·]+·/, 'Last read <time> ·'), summary: $('#sum-calendar').textContent } });
    const log = await mock('log');
    s.requests = log.recent.filter(l => / \/calendar/.test(l)).map(l => l.replace(/^\S+ /, '')); s.kvPuts = log.kvPut - w0;
    s.errors = P.errors.filter(e => !/open-meteo|nager|Failed to load/i.test(e)).slice(0, 3);
    return s;
  } finally { await P.kill(); await stopLab(); }
}
const out = { old: OLD_SHA, feeds: {} };
let bad = false;
(async () => {
  const OLD = RP.old(OLD_SHA);
  for (const [name, src] of FEEDS) {
    const A = await connect(OLD, OLD, 'a', name, src), B = await connect(OLD, NEW, 'b', name, src), C = await connect(NEW, NEW, 'c', name, src);
    const seen = ['events', 'from', 'to', 'msg', 'rows', 'status', 'summary'], same = seen.filter(k => A[k] === B[k]);
    const aIds = JSON.parse(A.events).map(e => JSON.stringify(e)), cAll = new Set(JSON.parse(C.events).map(e => JSON.stringify(e)));
    const lost = aIds.filter(e => !cAll.has(e)).length;
    const o = out.feeds[name] = {
      olderAppSameAsToday: same.length === seen.length, differs: seen.filter(k => A[k] !== B[k]),
      today: { events: A.n, msg: A.msg, rows: A.rows, status: A.status, summary: A.summary, requests: A.requests, kvPuts: A.kvPuts },
      olderAppNewServer: { events: B.n, requests: B.requests, kvPuts: B.kvPuts },
      newApp: { events: C.n, sameAsTodayByteForByte: seen.filter(k => k !== 'msg' || A.n === C.n).every(k => A[k] === C[k]), eventsOfTodayKept: aIds.length - lost + ' of ' + aIds.length, msg: C.msg, rows: C.rows, status: C.status, summary: C.summary, requests: C.requests, kvPuts: C.kvPuts },
      errors: { a: A.errors, b: B.errors, c: C.errors } };
    if (!o.olderAppSameAsToday || lost) bad = true;
  }
  console.log(JSON.stringify(out, null, 1));
  console.log(bad ? 'REPRODUCED' : 'NOT REPRODUCED');
  process.exit(0);
})().catch(async e => { console.log(JSON.stringify(out, null, 1)); console.log('ERROR ' + (e.stack || e)); console.log('NO VERDICT (error)'); await stopLab(); process.exit(1) });
