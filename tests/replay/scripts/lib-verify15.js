// Shared helpers for verifier 15's repro scripts (tester 15's import findings, lab port 9750).
// start(tag): fresh lab (fresh kv file kv/verify15-<tag>.json), the phone and server clocks at Mon 16 Nov 2026 07:40 Kuwait,
// a fresh phone (profile verify15-<tag>) opened from the tester invitation link, Skip on the welcome, Add an item,
// Import from a spreadsheet. paste(text) types the rows into the paste box like a paste and returns the preview.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9750, WURL = `http://127.0.0.1:${PORT + 1}/`;
const T0 = '2026-11-16T07:40:00+03:00';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null, ph = null;
async function startLab(tag) {
  const kv = `${RP.SCRATCH}/kv/verify15-${tag}.json`; try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { return JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')) } catch {} } }
  throw new Error('lab did not start');
}
async function stopAll() {
  if (ph) try { await ph.kill() } catch {}
  if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) });
}
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
async function start(tag) {
  const L = await startLab(tag);
  await mock('clock', { at: new Date(T0).toISOString() });
  ph = await P.openPhone({ profile: `verify15-${tag}`, fresh: true, time: T0 });
  await ph.page.goto(L.inviteLink); await ph.ready(); await sleep(1500);
  const w = await ph.page.evaluate(() => localStorage.worker_url); if (w && w !== WURL) throw new Error('WORKER URL WRONG ' + w);
  await ph.tap('#su-skip'); await sleep(800);
  await ph.tap('#fr-add'); await sleep(800);
  await openImport();
  return ph;
}
async function openImport() { await ph.tap('#add-import'); await sleep(800) }
// paste: clear the box, focus it, insert the text as one paste; returns the preview's text and the rows read
async function paste(t) {
  await ph.page.fill('#kit-paste', ''); await ph.tap('#kit-paste'); await ph.page.keyboard.insertText(t); await sleep(900);
  const prev = await ph.page.locator('#kit-prev').innerText();
  const btn = await ph.page.locator('#kit-imp').innerText();
  const rows = await ph.page.evaluate(() => HOOK.kitImp ? HOOK.kitImp.rows.map(r => r.ok ? { line: r.line, type: r.card.type, c: r.card.primaryColor, c2: r.card.secondaryColor, p: r.card.pattern, on: r.on, dup: !!r.dup } : { line: r.line, bad: r.why }) : null);
  return { prev, btn, rows };
}
async function addItems() { await ph.tap('#kit-imp'); await sleep(2500) }
const itemsNow = () => ph.page.evaluate(() => HOOK.items.map(i => ({ t: i.type, c: i.primaryColor, c2: i.secondaryColor, p: i.pattern, n: i.name || null, b: i.brand || null, notes: i.notes || null, k: i.trouserKind || null, s: i.shoeStyle || null })));
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { await stopAll() } process.exit(code) }
module.exports = { PORT, sleep, mock, start, openImport, paste, addItems, itemsNow, verdict, run, get ph() { return ph } };
