// Shared helpers for verifier 11's repro scripts (port 9710). Starts/stops its own lab with a fresh kv file, opens phones, adds items.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9710, W = `http://127.0.0.1:${PORT + 1}/`, APP = `http://127.0.0.1:${PORT}/index.html`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PHOTOS = fs.readdirSync(RP.SAMPLES_A).filter(f => /\.jpg$/i.test(f)).sort().map(f => RP.SAMPLES_A + '/' + f);
let lab = null;
async function startLab(kvName) {
  const kv = `${RP.SCRATCH}/kv/${kvName}.json`;
  try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT)) && await fetch(W + '__mock/log').then(r => r.ok).catch(() => false)) return }
  throw new Error('lab did not start');
}
async function stopLab() { if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) }) }
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
const world = (ph, iso) => P.setWorldTime(ph, PORT, iso);
async function invite(name) {
  const j = await fetch(W + 'invites', { method: 'POST', headers: { 'x-app-token': 'owner-secret', 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json());
  return { code: j.code, link: APP + '#invite=' + j.code + '&w=' + encodeURIComponent(W) };
}
const ownerList = () => fetch(W + 'invites', { headers: { 'x-app-token': 'owner-secret' } }).then(r => r.json());
async function phone(name, opt = {}) { return P.openPhone({ profile: 'verify11-' + name, fresh: true, ...opt }) }
async function checkWorker(ph) { const u = await ph.page.evaluate(() => localStorage.getItem('worker_url')); if (u && u !== W) { console.log('WORKER URL WRONG', u); process.exit(3) } }
async function tapSel(ph, sel) { await ph.tap(sel); await sleep(400) }
async function tapText(ph, text, scope = 'body') {
  const l = ph.page.locator(scope + ' button:visible', { hasText: text }).first();
  await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); if (!b) throw new Error('no button ' + text);
  await ph.tapAt(b.x + b.width / 2, b.y + b.height / 2); await sleep(400);
}
const text = async (ph, sel = 'body') => { try { return (await ph.page.innerText(sel)).replace(/\s+/g, ' ') } catch { return '' } };
const state = ph => ph.page.evaluate(() => ({ items: items.map(i => i.type + ':' + i.primaryColor).sort(), n: items.length, setupShown: typeof setupShown === 'function' ? setupShown() : null,
  vest: settings.vestMode, hol: settings.holidays && settings.holidays.country, sync: localStorage.getItem('sync_status'), last: localStorage.getItem('last_sync') }));
async function closeTour(ph) { for (let k = 0; k < 10 && await ph.page.locator('#kit-next').isVisible().catch(() => false); k++) { await ph.tap('#kit-next'); await sleep(400) } }
async function openAdd(ph) {
  await closeTour(ph);
  if (await ph.page.locator('#add').isVisible().catch(() => false)) return;
  const nav = ph.page.locator('nav button', { hasText: 'Wardrobe' }).first(); const nb = await nav.boundingBox(); await ph.tapAt(nb.x + nb.width / 2, nb.y + nb.height / 2); await sleep(600);
  await tapSel(ph, '#ward-add'); await sleep(500);
  if (!await ph.page.locator('#add').isVisible()) throw new Error('Add did not open');
}
// photos as "One item"; connected: wait for the readings; types = pick the type by hand on each card (not connected)
async function addPhotos(ph, files, types) {
  await openAdd(ph);
  await ph.page.locator('#add-one input[type=file]').setInputFiles(files);
  if (types) {
    await sleep(3000);
    for (const t of types) { const s = ph.page.locator('#add select[aria-label="Type"]').first(); if (!await s.count()) break; await s.scrollIntoViewIfNeeded(); await s.selectOption(t); await sleep(1200) }
  } else await ph.page.waitForFunction(n => queue.length >= n && !queue.some(q => q.busy || (typeof cardReading === 'function' && cardReading(q))), files.length, { timeout: 60000 });
  await sleep(800);
  const sa = ph.page.locator('#add button', { hasText: /^Save all/ }).first();
  await sa.scrollIntoViewIfNeeded(); const b = await sa.boundingBox(); await ph.tapAt(b.x + b.width / 2, b.y + b.height / 2);
  await ph.page.waitForFunction(() => queue.length === 0, null, { timeout: 30000 }); await sleep(1200);
}
async function goTab(ph, name) { const nav = ph.page.locator('nav button', { hasText: name }).first(); const nb = await nav.boundingBox(); await ph.tapAt(nb.x + nb.width / 2, nb.y + nb.height / 2); await sleep(500) }
async function openSettingsCat(ph, cat) { await tapSel(ph, 'header button[aria-label="Settings"]'); await sleep(600); await tapSel(ph, `#sc-${cat} .scat-head`); await sleep(600) }
function done(ok, evidence) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); for (const e of evidence) console.log('  ' + e) }
module.exports = { ...P, PORT, W, APP, PHOTOS, sleep, startLab, stopLab, mock, world, invite, ownerList, phone, checkWorker, tapSel, tapText, text, state, closeTour, openAdd, addPhotos, goTab, openSettingsCat, done };
