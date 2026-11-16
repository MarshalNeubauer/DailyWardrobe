// Shared helpers for verifier 1's repro scripts (port 9610). Starts/stops a lab, taps by text.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const ph_ = require(H + 'phone.js');
const PORT = 9610;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null;
async function startLab(app, kv) {
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--app', app, '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 100; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { return JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')) } catch {} } }
  throw new Error('lab did not start');
}
async function stopLab() { if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) }) }
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => ph_.mock(PORT, w, b);
// tap the innermost visible element whose text equals (else contains) text
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
const toastWatch = async (ph, ms) => { const seen = []; const end = Date.now() + ms; while (Date.now() < end) { await sleep(250); const t = await ph.page.evaluate(() => { const e = document.querySelector('#toast'); return e && (e.classList.contains('on') || e.offsetParent) ? e.innerText : null }).catch(() => null); if (t && !seen.includes(t)) seen.push(t) } return seen };
const serverSettings = async () => { const kv = await mock('kv-dump'); const k = Object.keys(kv).find(x => /wardrobe:v1$/.test(x)); if (!k) return { keys: Object.keys(kv) }; const e = kv[k]; const txt = e.b ? Buffer.from(e.v, 'base64').toString() : e.v; let s = {}; try { const j = JSON.parse(txt); s = (j.data || j).settings || {} } catch {} return { planRules: s.planRules, ksPlanRules: s.ks && s.ks.planRules, updated: s.updated, raw: txt.match(/"planRules":\d+/g), key: k } };
// The 12 Nov app (dw-v186, PLAN_RULES 11): join by the lab's invitation on Mon 16 Nov, Skip setup, add 13 items by photo
// (mocked tags, fixed order), open Today, background so it backs up. Leaves the lab running; returns {phone, link}.
const OLD = RP.old('26cd8b1'), NEW = RP.APP;
const PICS = fs.readdirSync(RP.SAMPLES_A).filter(f => /\.jpg$/i.test(f)).sort().map(f => RP.SAMPLES_A + '/' + f);
const TG = (t, o) => ({ type: t, primaryColor: o.c, secondaryColor: o.c2 || 'none', thirdColor: 'none', pattern: o.p || 'solid', material: o.m || 'wool', texture: 'smooth', formality: 'business', season: 'all' });
const ITEMS = [TG('suit', { c: 'navy' }), TG('suit', { c: 'grey' }), TG('suit', { c: 'charcoal', p: 'pinstripe' }), TG('shirt', { c: 'white', m: 'cotton' }), TG('shirt', { c: 'light blue', m: 'cotton' }), TG('shirt', { c: 'pink', m: 'cotton' }),
  TG('tie', { c: 'burgundy', m: 'silk' }), TG('tie', { c: 'navy', c2: 'white', p: 'stripes', m: 'silk' }), TG('tie', { c: 'green', m: 'silk' }), TG('shoes', { c: 'black', m: 'leather' }), TG('shoes', { c: 'brown', m: 'leather' }), TG('belt', { c: 'black', m: 'leather' }), TG('belt', { c: 'brown', m: 'leather' })];
async function buildOld(kv, profile) {
  fs.rmSync(kv, { force: true });
  const info = await startLab(OLD, kv), link = info.inviteLink;
  const a = await ph_.openPhone({ profile, fresh: true, time: '2026-11-16T07:30:00+03:00' });
  await mock('clock', { at: '2026-11-16T04:30:00.000Z' });
  await a.page.goto(link); await a.ready(); await sleep(4000);
  if (await a.page.evaluate(() => localStorage.worker_url) !== `http://127.0.0.1:${PORT + 1}/`) throw new Error('worker_url wrong');
  for (const t of ['Later', 'Skip']) { try { await tt(a, t) } catch {} await sleep(600) }
  await a.tap('#n-wardrobe'); await sleep(800); await a.tap('#ward-add'); await sleep(800);
  for (let i = 0; i < ITEMS.length; i++) {
    await mock('next-tag', ITEMS[i]);
    const fcP = a.page.waitForEvent('filechooser', { timeout: 8000 }); await a.tap('#add-one'); const fc = await fcP; await fc.setFiles(PICS[i % PICS.length]);
    await a.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Confirm' && b.offsetParent && !b.disabled), null, { timeout: 20000 });
    await sleep(800); await tt(a, 'Confirm'); await sleep(1200);
  }
  await a.tap('#n-today'); await sleep(4000);
  await a.background(); await sleep(4000); await a.foreground(); await sleep(1500);
  return { a, link, items: await a.page.evaluate(() => items.length) };
}
module.exports = { OLD, NEW, buildOld, ...ph_, PORT, sleep, startLab, stopLab, mock, tt, toastWatch, serverSettings };
