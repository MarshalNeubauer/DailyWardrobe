// Shared helpers for verifier 5's repro scripts (two phones on one account, lab port 9650).
// startTwo() starts a fresh lab (fresh kv file), sets the world clock to a fixed Monday, opens phone A through the tester
// invitation link, runs the setup with its default answers, imports 18 rows, backs up, then opens phone B on the same link.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9650, WURL = `http://127.0.0.1:${PORT + 1}/`;
const T0 = '2026-11-16T09:00:00+03:00';   // a Monday: a workday with either work week
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null; const phones = [];
async function startLab(kvName) {
  const kv = `${RP.SCRATCH}/kv/${kvName}.json`; try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { return JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')) } catch {} } }
  throw new Error('lab did not start');
}
async function stopAll() {
  for (const ph of phones) try { await ph.kill() } catch {}
  if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) });
}
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
const wu = async ph => { const w = await ph.page.evaluate(() => localStorage.worker_url); if (w && w !== WURL) throw new Error('WORKER URL WRONG ' + w); return w };
// tap a locator's center with a real touch
async function tapL(ph, l) { l = l.first(); await l.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(150); const b = await l.boundingBox(); if (!b) throw new Error('not visible'); await ph.tapAt(b.x + b.width / 2, b.y + b.height / 2); await sleep(400) }
const btn = (ph, re) => ph.page.getByRole('button', { name: re }).filter({ visible: true });
const vis = (ph, sel) => ph.page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && b.width > 0 }, sel);
const CSV = `Type,Colour,Second colour,Pattern,Name,Material
Suit,Navy,,Solid,Navy suit,Wool
Suit,Charcoal,,Solid,Charcoal suit,Wool
Suit,Grey,,Herringbone,Grey herringbone,Wool
Blazer,Navy,,Solid,Navy blazer,Wool
Trousers,Grey,,Solid,Grey trousers,Wool
Trousers,Tan,,Solid,Tan chinos,Cotton
Shirt,White,,Solid,White shirt,Cotton
Shirt,Light blue,,Solid,Blue shirt,Cotton
Shirt,White,Light blue,Stripes,Striped shirt,Cotton
Shirt,Pink,,Solid,Pink shirt,Cotton
Tie,Burgundy,,Solid,Burgundy tie,Silk
Tie,Navy,White,Dots,Navy dot tie,Silk
Tie,Green,,Solid,Green tie,Silk
Tie,Red,Navy,Stripes,Red stripe tie,Silk
Shoes,Brown,,Solid,Brown oxfords,
Shoes,Black,,Solid,Black oxfords,
Belt,Brown,,Solid,Brown belt,
Belt,Black,,Solid,Black belt,`;
async function startTwo(tag, { bOffsetMs = 0 } = {}) {
  const L = await startLab(`verify5-${tag}`);
  await mock('clock', { at: new Date(T0).toISOString() });
  const A = await P.openPhone({ profile: `verify5-${tag}-a`, fresh: true, time: T0 }); phones.push(A);
  await A.page.goto(L.inviteLink); await A.ready(); await sleep(3000); await wu(A);
  for (let k = 0; k < 16; k++) {   // the setup: the primary button each step, default answers
    if (!(await A.page.locator('#setup').isVisible().catch(() => false))) break;
    const b = A.page.locator('#setup button.pri').filter({ visible: true }).last(); if (!(await b.count())) break;
    if (/first item/i.test(await b.innerText())) { await tapL(A, b); await sleep(1200); break }
    await tapL(A, b); await sleep(600);
  }
  const x = A.page.locator('button:visible', { hasText: '✕' }); if (await x.count()) { await tapL(A, x); await sleep(600) }   // the tour that follows the setup
  if (!(await vis(A, '#add-import'))) { await tapL(A, A.page.locator('#ward-add')); await sleep(600) }
  await A.tap('#add-import'); await sleep(600);
  const ta = A.page.locator('textarea:visible').first(); await ta.fill(CSV); await ta.dispatchEvent('input'); await sleep(600);
  await tapL(A, btn(A, /^Add 18 items$/)); await sleep(1500);
  if (await vis(A, '.kit-x')) await A.tap('.kit-x');
  await tapL(A, btn(A, /^Today$/)); await sleep(1200);
  await sync(A);
  const B = await P.openPhone({ profile: `verify5-${tag}-b`, fresh: true, time: new Date(A.now() - bOffsetMs).toISOString() }); phones.push(B);
  await B.page.goto(L.inviteLink); await B.ready(); await sleep(4000); await wu(B);
  const got = btn(B, /Got it/); if (await got.count()) await tapL(B, got);
  const n = { A: await A.page.evaluate(() => items.length), B: await B.page.evaluate(() => items.length) };
  if (n.A !== 18 || n.B !== 18) throw new Error('setup failed ' + JSON.stringify(n));
  return { A, B, L };
}
// back up: the app to the background and back (a tester's phone backs up as it goes to the background)
async function bgfg(ph) { await ph.background(); await sleep(2500); await ph.foreground(); await sleep(1200) }
// the Settings -> Backup "Sync now" button's own function (syncTap), then wait for it
async function sync(ph) { await ph.page.evaluate(() => syncTap()); await ph.page.waitForFunction(() => !syncing, null, { timeout: 20000 }); await sleep(600); return ph.page.evaluate(() => localStorage.sync_status || 'ok') }
async function goTab(ph, t) { await tapL(ph, btn(ph, new RegExp('^' + t + '$'))); await sleep(600) }
async function openItem(ph, name) {
  if (await ph.page.evaluate(() => !!editing)) await closeItem(ph);
  if (!(await vis(ph, '#wardrobe'))) await goTab(ph, 'Wardrobe');
  const id = await ph.page.evaluate(n => { const i = items.find(x => x.name === n); return i && i.id }, name); if (!id) throw new Error('no item ' + name);
  await ph.page.evaluate(() => { if (typeof CK_OPEN !== 'undefined') CK_OPEN['*'] = true });   // #497: the sheet's fields are in folded sections; open them all (no-op before)
  await tapL(ph, ph.page.locator(`#gi-${id} .giopen`)); await sleep(700); return id;
}
async function closeItem(ph) { if (await vis(ph, '#item-view .ivdone')) { await tapL(ph, ph.page.locator('#item-view .ivdone')); await sleep(600) } }
async function rename(ph, text) { await tapL(ph, ph.page.locator('#item-view .wf-name')); await ph.page.keyboard.press('Control+A'); await ph.page.keyboard.type(text, { delay: 20 }); await sleep(900) }
async function rot(ph) { await tapL(ph, ph.page.locator('#item-view .rotbtn')); await sleep(600) }
const item = (ph, idOrName) => ph.page.evaluate(n => { const i = items.find(x => x.id === n || x.name === n); return i ? { n: i.name, p: i.primaryColor, paused: !!i.paused, u: i.updated } : null }, idOrName);
async function kvData() { const d = await mock('kv-dump'); const k = Object.keys(d).find(k => /:wardrobe:v1$/.test(k)); const e = d[k]; const t = e.b ? Buffer.from(e.v, 'base64').toString() : e.v; const j = JSON.parse(t); return j.data || j }
async function openSettings(ph) { if (!(await ph.page.evaluate(() => settingsOpen()))) { await tapL(ph, ph.page.locator('header button[aria-label=Settings]')); await sleep(900) } }
async function cat(ph, c) { const h = ph.page.locator(`#settings-modal .scat-head[data-cat="${c}"]`); if (await h.getAttribute('aria-expanded') !== 'true') { await tapL(ph, h); await sleep(400) } }
async function choose(ph, sel, v) { const l = ph.page.locator(sel); await l.evaluate(e => e.scrollIntoView({ block: 'center' })); await l.selectOption(v); await sleep(400) }
async function settingsDone(ph) { await tapL(ph, ph.page.locator('#settings-modal .sdone')); await sleep(500) }
async function pickTo(ph, slot, name) {
  if (!(await ph.page.evaluate(() => { const b = document.querySelector('#ibox'); return b && b.classList.contains('open') }))) { await tapL(ph, ph.page.locator('#today button.month-link[data-act="listTap"]')); await sleep(1200) }
  await tapL(ph, ph.page.locator(`#today .swap[data-act="pickTap"][data-s="${slot}"]`)); await sleep(500);
  const l = ph.page.locator('#pick-sheet .pick-it').filter({ hasText: name }); if (!(await l.count())) throw new Error('picker lacks ' + name + ': ' + (await ph.page.locator('#pick-sheet').innerText().catch(() => '?')).slice(0, 400).replace(/\n/g, '|') + ' picker=' + await ph.page.evaluate(() => JSON.stringify(picker)));
  await tapL(ph, l); await sleep(700);
}
const dayRec = (ph, d) => ph.page.evaluate(d => { const r = dayRecs[d]; if (!r) return null; const nm = id => { const i = items.find(x => x.id === id); return i ? i.name : id }; const o = { worn: r.worn, updated: r.updated }; for (const k of ['ids', 'force']) if (r[k]) o[k] = Object.fromEntries(Object.entries(r[k]).map(([a, b]) => [a, nm(b)])); return o }, d);
async function offline(ph, off) { await ph.ctx.setOffline(off); if (!off) { await ph.page.evaluate(() => dispatchEvent(new Event('online'))); await sleep(2500) } }
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { await stopAll() } process.exit(code) }
module.exports = { ...P, PORT, T0, sleep, mock, startTwo, stopAll, tapL, btn, vis, bgfg, sync, goTab, openItem, closeItem, rename, rot, item, kvData, openSettings, cat, choose, settingsDone, pickTo, dayRec, offline, verdict, run, wu };
