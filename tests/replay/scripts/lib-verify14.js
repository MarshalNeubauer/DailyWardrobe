// Shared helpers for verifier 14's repro scripts (tester 14's older-user findings, lab port 9740).
// start(tag,{at}): fresh lab (kv/verify14-<tag>.json), phone and server clocks at `at` (default Sun 15 Nov 2026 07:30 Kuwait),
// a fresh phone (profile verify14-<tag>) opened from the tester invitation link, Skip on the welcome.
// wardrobe(rows): Add -> Import from a spreadsheet -> paste rows -> add them (a quick, real UI path to a small wardrobe).
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9740, WURL = `http://127.0.0.1:${PORT + 1}/`;
const T0 = '2026-11-15T07:30:00+03:00';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null, ph = null, L = null;
async function startLab(tag) {
  const kv = `${RP.SCRATCH}/kv/verify14-${tag}.json`; try { fs.unlinkSync(kv) } catch {}
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
async function checkWorker() { const w = await ph.page.evaluate(() => localStorage.worker_url); if (w && w !== WURL) throw new Error('WORKER URL WRONG ' + w) }
async function start(tag, { at = T0, big = false } = {}) {
  L = await startLab(tag);
  await mock('clock', { at: new Date(at).toISOString() });
  ph = await P.openPhone({ profile: `verify14-${tag}`, fresh: true, time: at });
  if (big) await ph.ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = 'html{--tscale:1.5 !important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s)) });
  await ph.page.goto(L.inviteLink); await ph.ready(); await sleep(1500);
  await checkWorker();
  await ph.tap('#su-skip'); await sleep(800);
  return ph;
}
async function wardrobe(rows) {
  await ph.tap('#n-wardrobe'); await sleep(500);
  await ph.tap('#ward-add'); await sleep(700);
  await ph.tap('#add-import'); await sleep(800);
  await ph.page.fill('#kit-paste', ''); await ph.tap('#kit-paste'); await ph.page.keyboard.insertText(rows); await sleep(900);
  await ph.tap('#kit-imp'); await sleep(2500);
  await ph.tap('#n-today'); await sleep(1200);
}
async function setWorld(at) { return P.setWorldTime(ph, PORT, at) }
const byText = (re, sel = 'button,[role=button],a,.card,[onclick]') => ph.page.evaluate(([src, fl, sel]) => {
  const re = new RegExp(src, fl);
  const els = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && re.test((e.innerText || e.getAttribute('aria-label') || '').trim()) });
  const e = els[els.length - 1]; if (!e) return null; e.setAttribute('data-v14', '1'); document.querySelectorAll('[data-v14]').forEach(x => x !== e && x.removeAttribute('data-v14')); return true
}, [re.source, re.flags, sel]);
async function tapText(re, sel) { if (!await byText(re, sel)) throw new Error('no visible control matching ' + re); await ph.tap('[data-v14]'); await sleep(700) }
const text = (sel = 'body') => ph.page.locator(sel).first().innerText();
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { if (ph) { const e = ph.errors.filter(x => !/open-meteo|nager/.test(x)); if (e.length) console.log('page errors:', e.slice(0, 5)) } await stopAll() } process.exit(code) }
module.exports = { PORT, WURL, T0, sleep, mock, start, wardrobe, setWorld, tapText, byText, text, verdict, run, checkWorker, stop: stopAll, get ph() { return ph }, get L() { return L } };
