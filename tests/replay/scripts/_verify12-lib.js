// Shared helpers for verifier 12's repro scripts (tester 12's typed/imported-input findings, lab port 9720).
// startLab(tag): fresh lab with a fresh kv file kv/verify12-<tag>.json, server clock at Mon 16 Nov 2026 07:40 Kuwait.
// phone(name, {invite}): a fresh phone (profile verify12-<tag>-<name>) with a harmless marker hook window.__v12h(n) that only
// records n in window.__v12, opened from the invitation link (invite:true) or the bare app URL; Skip on the welcome.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9720, WURL = `http://127.0.0.1:${PORT + 1}/`;
const T0 = '2026-11-16T07:40:00+03:00';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null, info = null, tag = '';
const phones = [];
async function startLab(t) {
  tag = t;
  const kv = `${RP.SCRATCH}/kv/verify12-${t}.json`; try { fs.unlinkSync(kv) } catch {}
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
async function phone(name, { invite = true } = {}) {
  const ph = await P.openPhone({ profile: `verify12-${tag}-${name}`, fresh: true, time: T0 }); phones.push(ph);
  await ph.ctx.addInitScript(() => { window.__v12 = []; window.__v12h = n => window.__v12.push(String(n)) });
  await ph.page.goto(invite ? info.inviteLink : info.appUrl); await ph.ready(); await sleep(2000);
  const w = await ph.page.evaluate(() => localStorage.worker_url);
  if (invite && w !== WURL) throw new Error('WORKER URL WRONG ' + w);
  if (!invite && w && w !== WURL) throw new Error('WORKER URL WRONG ' + w);
  if (await ph.page.locator('#su-skip').isVisible().catch(() => false)) { await ph.tap('#su-skip'); await sleep(800) }
  await ph.page.keyboard.press('Escape'); await sleep(300);
  return ph;
}
const hits = ph => ph.page.evaluate(() => window.__v12.splice(0));
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { await stopAll() } process.exit(code) }
module.exports = { PORT, WURL, T0, sleep, mock, startLab, phone, hits, verdict, run, get info() { return info } };
