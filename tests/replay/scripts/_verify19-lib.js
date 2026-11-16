// Shared helpers for verifier 19's repro scripts (tester 19's accessibility findings, lab port 9790).
// startLab(tag): fresh lab, fresh kv file kv/verify19-<tag>.json, server clock Mon 16 Nov 2026 07:40 Kuwait.
// phone(name, {sample, colorScheme, reducedMotion}): fresh phone (profile verify19-<tag>-<name>) from the invitation link,
//   Skip on the welcome, then (sample:true) "Try a sample wardrobe". Installs window.__v19 page helpers:
//   act() describes document.activeElement, live() returns and clears texts seen in aria-live/status/alert regions,
//   ratio(a,b) contrast of two CSS colors, col(c) -> [r,g,b,a].
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9790, WURL = `http://127.0.0.1:${PORT + 1}/`;
const T0 = '2026-11-16T07:40:00+03:00';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null, info = null, tag = '';
const phones = [];
async function startLab(t) {
  tag = t;
  const kv = `${RP.SCRATCH}/kv/verify19-${t}.json`; try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { info = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')); break } catch {} } }
  if (!info) throw new Error('lab did not start');
  await mock('clock', { at: new Date(T0).toISOString() });
  return info;
}
async function stopAll() {
  for (const p of phones) try { await p.kill() } catch {}
  if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) });
}
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
const HELP = () => {
  const cv = document.createElement('canvas').getContext('2d');
  const col = c => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]) };
  const ratio = (a, b) => { const x = lum(typeof a === 'string' ? col(a) : a), y = lum(typeof b === 'string' ? col(b) : b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2) };
  window.__v19 = {
    col, ratio, liveLog: [],
    act() { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; return a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + ' "' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40) + '"' },
    live() { const x = window.__v19.liveLog; window.__v19.liveLog = []; return x },
  };
  const mo = new MutationObserver(ms => { for (const m of ms) { const el = (m.target.nodeType === 3 ? m.target.parentElement : m.target); const r = el && el.closest && el.closest('[aria-live],[role=status],[role=alert]'); if (r) { const t = (r.textContent || '').trim(); const L = window.__v19.liveLog; if (t && L[L.length - 1] !== t) L.push(t.slice(0, 90)) } } });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true });
};
async function phone(name, { sample = true, colorScheme = 'light', reducedMotion } = {}) {
  const ph = await P.openPhone({ profile: `verify19-${tag}-${name}`, fresh: true, time: T0, colorScheme }); phones.push(ph);
  if (reducedMotion) await ph.page.emulateMedia({ reducedMotion });
  await ph.page.goto(info.inviteLink); await ph.ready(); await sleep(2000);
  const w = await ph.page.evaluate(() => localStorage.worker_url);
  if (w !== WURL) throw new Error('WORKER URL WRONG ' + w);
  if (await ph.page.locator('#su-skip').isVisible().catch(() => false)) { await ph.tap('#su-skip'); await sleep(800) }
  if (sample) { await ph.tap('#today button:has-text("Try a sample wardrobe")'); await sleep(4000) }
  await ph.page.keyboard.press('Escape'); await sleep(300);
  await ph.page.evaluate(HELP);
  return ph;
}
const kbd = async (ph, sel, ms = 1000) => { const l = ph.page.locator(sel).first(); await l.focus(); await ph.page.keyboard.press('Enter'); await sleep(ms) };
const act = ph => ph.page.evaluate(() => __v19.act());
const live = ph => ph.page.evaluate(() => __v19.live());
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { await stopAll() } process.exit(code) }
module.exports = { PORT, WURL, T0, sleep, mock, startLab, phone, kbd, act, live, verdict, run, HELP, get info() { return info } };
