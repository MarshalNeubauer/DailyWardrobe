// CR-6-12 / CR-5-12 (Round B, 2026-11-17): the merge rules moved into merge.js, one copy shared by the app and the worker. The worker
// must merge exactly as before, so phones still on an old app keep backing up: for each old build (26cd8b1 12 Nov, 7a28f96 14 Nov,
// c4a549b 15 Nov a) a phone on that app, against today's worker, joins, adds two pieces, backs up, adds a third and backs up again;
// then the lab's app is updated and a phone on today's app joins the same account and gets all three; the old phone (its page still
// on the old code) adds a fourth and backs up, and today's phone gets it. REPRODUCED = an old app's backup didn't arrive whole.
// Prints the KV writes of each step (CR612_WORKER=<checkout> runs the same against another worker, to compare).
// Own port group 9320 (Round B fixer 2), profiles cr612-*, kv .work/kv/cr612.json.  node tests/replay/run.js --only CR-6-12
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const { openPhone, mock: mk } = require(H + 'phone.js');
const PORT = 9320, KV = RP.SCRATCH + '/kv/cr612.json', NEW = RP.APP, WORKER = process.env.CR612_WORKER || NEW;
const OLDS = ['26cd8b1', '7a28f96', 'c4a549b'];
const TIME = '2026-11-16T07:30:00+03:00';
const PICS = fs.readdirSync(RP.SAMPLES_A).filter(f => /\.jpg$/i.test(f)).sort().map(f => RP.SAMPLES_A + '/' + f);
const TG = (t, c, m) => ({ type: t, primaryColor: c, secondaryColor: 'none', thirdColor: 'none', pattern: 'solid', material: m, texture: 'smooth', formality: 'business', season: 'all' });
const TAGS = [TG('suit', 'navy', 'wool'), TG('shirt', 'white', 'cotton'), TG('tie', 'burgundy', 'silk'), TG('shoes', 'brown', 'leather')];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mock = (w, b) => mk(PORT, w, b);
let lab = null;
async function startLab(app) {
  if (lab) await stopLab();
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--app', app, '--worker', WORKER, '--kv', KV], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 100; i++) { await sleep(150); if (fs.existsSync(RP.labInfo(PORT))) { try { const j = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')); await mock('clock', { at: new Date(TIME).toISOString() }); return j } catch {} } }
  throw new Error('lab did not start');
}
async function stopLab() { if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) }) }
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const guard = async p => { const u = await p.page.evaluate(() => localStorage.worker_url); if (u !== `http://127.0.0.1:${PORT + 1}/`) throw new Error('worker_url wrong: ' + u) };
// tap the innermost visible element whose text equals (else contains) text (lib-verify1's tt)
async function tt(ph, text) {
  const p = await ph.page.evaluate(text => {
    const els = [...document.querySelectorAll('button,a,[role=button],label,.chip,[onclick]')].filter(el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[inert]') });
    const tx = el => (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    let m = els.filter(el => tx(el) === text); if (!m.length) m = els.filter(el => tx(el).includes(text));
    m = m.filter(el => !m.some(o => o !== el && el.contains(o))); const el = m[0]; if (!el) return null;
    el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];
  }, text);
  if (!p) throw new Error('no element with text: ' + text);
  await ph.tapAt(p[0], p[1]); await sleep(400);
}
async function addOne(a, i) {   // one photo, the mocked tags, Confirm (the 12 Nov app's way, which every build since keeps)
  await mock('next-tag', TAGS[i % TAGS.length]);
  const fcP = a.page.waitForEvent('filechooser', { timeout: 8000 }); await a.tap('#add-one'); const fc = await fcP; await fc.setFiles(PICS[i % PICS.length]);
  await a.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Confirm' && b.offsetParent && !b.disabled), null, { timeout: 20000 });
  await sleep(800); await tt(a, 'Confirm'); await sleep(1200);
}
const sync = p => p.page.evaluate(async () => { for (let i = 0; i < 100 && (window.syncing || window.syncRun); i++) await new Promise(r => setTimeout(r, 200)); return typeof syncNow === 'function' ? syncNow() : null });
const backup = async p => { await sync(p); await sleep(1500); await sync(p); await sleep(1000) };
const phoneItems = p => p.page.evaluate(() => items.map(i => i.id).sort());
async function server() {
  const kv = await mock('kv-dump'), k = Object.keys(kv).find(x => /wardrobe:v1$/.test(x)); if (!k) return { ids: [] };
  const e = kv[k], txt = e.b ? Buffer.from(e.v, 'base64').toString() : e.v; let j = {}; try { j = JSON.parse(txt) } catch {}
  const d = j.data || {}; return { ids: (d.items || []).map(i => i.id).sort(), rev: j.rev };
}
const puts = async () => (await mock('log')).kvPut;
const out = { worker: WORKER, builds: {} };
let bad = false;
(async () => {
  for (const sha of OLDS) {
    const OLD = RP.old(sha), o = out.builds[sha] = {};
    fs.rmSync(KV, { force: true });
    const info = await startLab(OLD), LINK = info.inviteLink;
    const P = await openPhone({ profile: 'cr612-old-' + sha, fresh: true, time: TIME });
    await P.page.goto(LINK); await P.ready(); await sleep(4000); await guard(P);
    for (const t of ['Later', 'Skip']) { try { await tt(P, t) } catch {} await sleep(600) }
    await P.tap('#n-wardrobe'); await sleep(800); await P.tap('#ward-add'); await sleep(800);
    let w0 = await puts();
    await addOne(P, 0); await addOne(P, 1); await P.tap('#n-today'); await sleep(2500); await backup(P);
    o.first = { phone: await phoneItems(P), server: await server(), kvPuts: (await puts()) - w0 };
    w0 = await puts();
    await P.tap('#n-wardrobe'); await sleep(800); await P.tap('#ward-add'); await sleep(800); await addOne(P, 2); await P.tap('#n-today'); await sleep(2500); await backup(P);
    o.second = { phone: await phoneItems(P), server: await server(), kvPuts: (await puts()) - w0 };
    // today's app on the lab (same worker, same storage); the old phone's page stays on the old code
    await startLab(NEW);
    const Q = await openPhone({ profile: 'cr612-new-' + sha, fresh: true, time: TIME });
    await Q.page.goto(LINK); await Q.ready(); await sleep(5000); await guard(Q);
    for (const t of ['Later', 'Skip', 'Not now']) { try { await tt(Q, t) } catch {} await sleep(500) }
    await backup(Q); o.newJoined = { phone: await phoneItems(Q), server: await server() };
    w0 = await puts();
    await P.tap('#n-wardrobe'); await sleep(800); await P.tap('#ward-add'); await sleep(800); await addOne(P, 3); await P.tap('#n-today'); await sleep(2500); await backup(P);
    await backup(Q);
    o.third = { old: await phoneItems(P), server: await server(), new: await phoneItems(Q), kvPuts: (await puts()) - w0 };
    o.errors = { old: P.errors.filter(e => !/open-meteo|nager|Failed to load/i.test(e)).slice(0, 3), new: Q.errors.filter(e => !/open-meteo|nager|Failed to load/i.test(e)).slice(0, 3) };
    await P.kill(); await Q.kill(); await stopLab();
    const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    o.ok = o.first.phone.length === 2 && eq(o.first.phone, o.first.server.ids) && o.second.phone.length === 3 && eq(o.second.phone, o.second.server.ids)
      && eq(o.newJoined.phone, o.second.phone) && o.third.old.length === 4 && eq(o.third.old, o.third.server.ids) && eq(o.third.new, o.third.old);
    if (!o.ok) bad = true;
  }
  console.log(JSON.stringify(out, null, 1));
  console.log(bad ? 'REPRODUCED' : 'NOT REPRODUCED');
  process.exit(0);
})().catch(async e => { console.log(JSON.stringify(out, null, 1)); console.log('ERROR ' + (e.stack || e)); console.log('NO VERDICT (error)'); await stopLab(); process.exit(1) });
