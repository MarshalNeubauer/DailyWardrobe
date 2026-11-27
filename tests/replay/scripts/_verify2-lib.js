// Verifier 2's shared helpers (port 9620): start/stop a lab, tap by text, build 14 Nov (7a28f96, dw-v350) data, update to today.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9620, W = `http://127.0.0.1:${PORT + 1}/`;
const OLD = RP.old('7a28f96'), NEW = RP.APP;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null;
const up = () => fetch(W + '__mock/log').then(r => r.ok).catch(() => false);
async function startLab(app, kv) {
  if (await up()) throw new Error('a lab is already running on ' + PORT);
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  const a = [H + 'lab.js', '--port', String(PORT), '--app', app]; if (kv) a.push('--kv', kv);
  lab = spawn(process.execPath, a, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; lab.stderr.on('data', d => err += d);
  for (let i = 0; i < 100; i++) { await sleep(200); if (await up() && fs.existsSync(RP.labInfo(PORT))) return JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')) }
  throw new Error('lab did not start ' + err);
}
async function stopLab() { if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) }) }
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
async function checkUrl(ph) { const u = await ph.page.evaluate(() => localStorage.worker_url).catch(() => null); if (u && u !== W) throw new Error('worker_url is ' + u) }
const txt = (ph, sel = 'body') => ph.page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : '' }, sel);
// tap the first visible element in `sel` whose text matches re
async function tap(ph, re, sel = 'button,a,label,[role=button],.chip,summary') {
  const ok = await ph.page.evaluate(([src, fl, sel]) => { const r = new RegExp(src, fl);
    const el = [...document.querySelectorAll(sel)].find(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[inert]') && r.test((e.innerText || e.getAttribute('aria-label') || '').trim()) });
    if (!el) return false; document.querySelectorAll('[data-v2]').forEach(e => e.removeAttribute('data-v2')); el.setAttribute('data-v2', '1'); el.scrollIntoView({ block: 'center' }); return true }, [re.source, re.flags, sel]);
  if (!ok) throw new Error('nothing visible matches ' + re + ' in ' + sel);
  await ph.tap('[data-v2="1"]'); await sleep(400);
}
async function tapSel(ph, sel) { await ph.page.evaluate(s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'center' }) }, sel); await sleep(200); await ph.tap(sel); await sleep(400) }
const B = { secondaryColor: 'none', thirdColor: 'none', pattern: 'solid', material: 'wool', texture: 'smooth', formality: 'business', season: 'all' };
const S1 = RP.SAMPLES_A + '/', S2 = RP.SAMPLES_B + '/';
// cards for the 14 Nov app: [photo, mocked tag, own kind, own name]
const CARDS = [
  [S1 + 'c35c0d6d866b9ebe6.jpg', { ...B, type: 'suit', primaryColor: 'brown', newColor: { name: 'Mocha', hex: '#6b4f3f', why: 'greyish brown' } }, 'col', 'Mocha'],
  [S1 + 'c7e7304aaf275052e.jpg', { ...B, type: 'shirt', primaryColor: 'white', material: 'cotton', newColor: { name: 'Gray', hex: '#c4c4c4', why: 'pale' } }, 'col', 'Gray'],
  [S1 + 'c957da963043b96a3.jpg', { ...B, type: 'tie', primaryColor: 'burgundy', pattern: 'stripes', material: 'silk', newPattern: { name: 'Paisley neat', why: 'tiny teardrops' } }, 'pat', 'Paisley neat'],
  [S2 + 'c801c50fc04012d61.jpg',{ ...B, type: 'suit', primaryColor: 'grey', newColor: { name: 'Navy', hex: '#24304a', why: 'inky' } }, 'col', 'Navy'],
  [S1 + 'cb7a20d54cc5a72e9.jpg', { ...B, type: 'shoes', primaryColor: 'brown', material: 'leather' }],
  [S1 + 'cb90cf59ca12b90c5.jpg', { ...B, type: 'shirt', primaryColor: 'light blue', material: 'cotton' }],
  [S2 + 'c1132fb6a5a0ec93a.jpg', { ...B, type: 'tie', primaryColor: 'navy', material: 'silk' }],
  [S2 + 'c4956e18e7a4486e2.jpg', { ...B, type: 'shoes', primaryColor: 'black', material: 'leather' }],
  [S2 + 'c231abaf31ee11443.jpg', { ...B, type: 'shirt', primaryColor: 'white', material: 'cotton' }],
];
// Phone on the 14 Nov app: skip setup, add CARDS by photo with own colors/pattern typed in the card's form. Lab must run on OLD.
async function oldAddCards(ph, info) {
  await ph.page.goto(info.inviteLink); await ph.ready(); await sleep(3500); await checkUrl(ph);   // connected: photos are read (mocked)
  await tap(ph, /^Later$/).catch(() => {}); await tap(ph, /^Skip$/, '#setup button').catch(() => {}); await sleep(600);
  await tap(ph, /^Wardrobe$/, 'nav button'); await sleep(700); await tapSel(ph, '#ward-add'); await sleep(700);
  for (const [f, tag, kind, nm] of CARDS) {
    await mock('next-tag', tag);
    await ph.page.setInputFiles('#add-one input[type=file]', [f]);
    await ph.page.waitForFunction(() => queue.length && !queue.some(q => q.busy || q.loading || q.tagging), null, { timeout: 60000 });
    await sleep(1000);
    if (kind) {
      await tap(ph, kind === 'col' ? /Add as a new colour/ : /Add this pattern/, '#add button');
      await ph.page.locator('#add .newform input[type=text]').first().fill(nm);
      await tap(ph, kind === 'col' ? /^Add colour$/ : /^Add pattern$/, '#add button'); await sleep(600);
    }
    await tap(ph, /^Confirm/, '#add button'); await sleep(1300);
    if (await ph.page.evaluate(() => queue.length)) throw new Error('card did not save: ' + nm);
  }
  return ph.page.evaluate(() => ({ n: items.length, custom: settings.custom }));
}
async function oldImport(ph, rows) {
  await tap(ph, /^Wardrobe$/, 'nav button'); await sleep(600); await tapSel(ph, '#ward-add'); await sleep(600);
  await tapSel(ph, '#add-import'); await sleep(600);
  await ph.page.locator('#kit-paste').fill(rows); await sleep(800);
  const prev = await txt(ph, '#kit-prev');
  await tapSel(ph, '#kit-imp'); await sleep(2500);
  return prev;
}
// after the lab restarted on NEW with the same KV: reopen until today's code runs (PLAN_RULES 15)
async function reopenNew(ph, url) {
  for (let i = 0; i < 4; i++) {
    await ph.reopen(url); await ph.ready(); await sleep(3500); await checkUrl(ph);
    // the page may still be the 14 Nov app, which has no HOOK: there PLAN_RULES is its global (READS_KEPT in tests/bridge.test.js)
    const pr = await ph.page.evaluate(() => window.HOOK ? ('PLAN_RULES' in HOOK ? HOOK.PLAN_RULES : null) : typeof PLAN_RULES !== 'undefined' ? PLAN_RULES : null);
    if (pr >= 15) return i + 1;   // 15 on aa24910; later builds bump it (20 on dw-v416), the 14 Nov app has less
  }
  throw new Error('today\'s app never took over');
}
module.exports = { ...P, PORT, W, OLD, NEW, sleep, startLab, stopLab, mock, checkUrl, txt, tap, tapSel, oldAddCards, oldImport, reopenNew, CARDS };
