// Shared helpers for verifier 7's repro scripts (joining and leaving; lab port 9670, profiles verify7-*, kv\verify7-*.json).
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9670, W = `http://127.0.0.1:${PORT + 1}/`, APP = `http://127.0.0.1:${PORT}/index.html`;
const T0 = '2026-11-16T09:00:00+03:00';   // a Monday
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null; const phones = [];
const log = (...a) => console.log(...a.map(x => typeof x === 'string' ? x : JSON.stringify(x)));
async function startLab(name) {
  const kv = `${RP.SCRATCH}/kv/verify7-${name}.json`; try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { const j = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')); await mock('clock', { at: new Date(T0).toISOString() }); return j } catch {} } }
  throw new Error('lab did not start');
}
async function stopAll() {
  for (const ph of phones) try { await ph.kill() } catch {}
  if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) });
}
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
async function checkWorker(ph) { const w = await ph.page.evaluate(() => localStorage.worker_url); if (w && w !== W) throw new Error('WORKER URL WRONG ' + w) }
async function tapL(ph, l) { l = l.first(); await l.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(150); const b = await l.boundingBox(); if (!b) throw new Error('not visible'); await ph.tapAt(b.x + b.width / 2, b.y + b.height / 2); await sleep(400) }
const btn = (ph, re) => ph.page.getByRole('button', { name: re }).filter({ visible: true });
const vis = (ph, sel) => ph.page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && b.width > 0 }, sel);
const CSV = `Type,Colour,Second colour,Pattern,Name,Material
Suit,Navy,,Solid,Navy suit,Wool
Suit,Charcoal,,Solid,Charcoal suit,Wool
Shirt,White,,Solid,White shirt,Cotton
Shirt,Light blue,,Solid,Blue shirt,Cotton
Tie,Burgundy,,Solid,Burgundy tie,Silk
Tie,Navy,White,Dots,Navy dot tie,Silk
Shoes,Black,,Solid,Black oxfords,
Belt,Black,,Solid,Black belt,`;
const N_ITEMS = 8;
async function open(tag) { const ph = await P.openPhone({ profile: `verify7-${tag}`, fresh: true, time: T0 }); phones.push(ph); return ph }
// a tester joins with the link: setup with its default answers, 8 pieces imported on Add, then the app to the background (backs up)
async function joinAndFill(ph, link) {
  await ph.page.goto(link); await ph.ready(); await sleep(3000); await checkWorker(ph);
  for (let k = 0; k < 16; k++) {
    if (!(await ph.page.locator('#setup').isVisible().catch(() => false))) break;
    const b = ph.page.locator('#setup button.pri').filter({ visible: true }).last(); if (!(await b.count())) break;
    if (/first item/i.test(await b.innerText())) { await tapL(ph, b); await sleep(1200); break }
    await tapL(ph, b); await sleep(600);
  }
  const x = ph.page.locator('button:visible', { hasText: '✕' }); if (await x.count()) { await tapL(ph, x); await sleep(600) }
  if (!(await vis(ph, '#add-import'))) { await tapL(ph, ph.page.locator('#ward-add')); await sleep(600) }
  await ph.tap('#add-import'); await sleep(600);
  const ta = ph.page.locator('textarea:visible').first(); await ta.fill(CSV); await ta.dispatchEvent('input'); await sleep(600);
  await tapL(ph, btn(ph, new RegExp(`^Add ${N_ITEMS} items$`))); await sleep(1500);
  if (await vis(ph, '.kit-x')) await ph.tap('.kit-x');
  const home = btn(ph, /Got it/); if (await home.count()) await tapL(ph, home);
  await tapL(ph, btn(ph, /^Today$/)); await sleep(1200);
  await bgfg(ph);
}
async function bgfg(ph) { await ph.background(); await sleep(3000); await ph.foreground(); await sleep(1500) }
// owner (with curl-like requests on the lab's worker): switch off the code's invitation, make a new one
async function revokeAndRenew(code) {
  const me = await (await fetch(W + 'me', { headers: { 'x-app-token': code } })).json();
  const d = await (await fetch(W + 'invites?id=' + me.id, { method: 'DELETE', headers: { 'x-app-token': 'owner-secret' } })).json();
  const j = await (await fetch(W + 'invites', { method: 'POST', headers: { 'x-app-token': 'owner-secret', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Renewed' }) })).json();
  return { oldId: me.id, revoked: d, newCode: j.code, link: `${APP}#invite=${j.code}&w=${encodeURIComponent(W)}` };
}
async function askNow(ph) { return ph.page.evaluate(() => { const s = document.querySelector('#ask-title'); if (!s) return null; const sh = s.closest('.on'); return sh ? sh.innerText : null }).catch(() => null) }
async function waitAsk(ph, s = 30) { for (let i = 0; i < s * 4; i++) { const q = await askNow(ph); if (q) return q; await sleep(250) } return null }
async function phoneState(ph) { return ph.page.evaluate(async () => { const st = await HOOK.localState(); const t = localStorage.app_token || ''; return { items: st.items.length, days: st.days.length, token: t.slice(0, 6), ended: (localStorage.invite_ended || '') === t && !!t, lost: (localStorage.invite_lost || '') === t && !!t } }) }
async function kvItems() { const d = await mock('kv-dump'); const o = {}; for (const [k, e] of Object.entries(d)) if (/^u:[^:]+:wardrobe:v1$/.test(k) && !e.b) { try { const j0 = JSON.parse(e.v), j = j0.data || j0; o[k.split(':')[1]] = { items: (j.items || []).length, days: (j.days || []).length } } catch {} } return o }
function main(fn) { (async () => { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack); code = 2 } finally { await stopAll() } process.exit(code) })() }
module.exports = { P, PORT, W, APP, T0, sleep, log, startLab, stopAll, mock, checkWorker, tapL, btn, vis, open, joinAndFill, bgfg, revokeAndRenew, askNow, waitAsk, phoneState, kvItems, main, N_ITEMS };
