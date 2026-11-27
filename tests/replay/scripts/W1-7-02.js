// W1-7-02: the owner's phone (connected with the server address and code) opens a tester's invitation link, is told the current
// wardrobe can be had back by "open that invitation's link again" (the owner has no link), clears and switches, and Settings →
// Connection then offers no way back (the Advanced fold with the address and code is hidden, no field to paste a link).
const L = require('./_verify7-lib.js');
async function openConn(ph) { await ph.tap('svg.hgear'); await L.sleep(800); await ph.page.evaluate(() => { const c = document.querySelector('#sc-connection'); if (c && !c.classList.contains('open')) HOOK.toggleCat('connection') }); await L.sleep(600) }
const usable = (ph) => ph.page.evaluate(() => { const v = e => !!(e && (e.offsetParent || e.getClientRects().length)); const c = document.querySelector('#sc-connection');
  return { advanced: v(document.querySelector('#adv-connection')), fields: [...c.querySelectorAll('input,textarea')].filter(e => v(e) && !e.readOnly && e.type !== 'hidden').map(e => e.id || e.type), ownerBtn: [...c.querySelectorAll('button')].some(b => v(b) && /I run the server/.test(b.innerText)) } });
L.main(async () => {
  const info = await L.startLab('W1-7-02');
  const o = await L.open('02-owner');
  await o.page.goto(L.APP); await o.ready(); await L.sleep(2000);
  await o.tap('#su-skip').catch(() => { }); await L.sleep(800);
  await openConn(o); await L.tapL(o, o.page.locator('#settings-modal button:visible', { hasText: 'I run the server' })); await L.sleep(500);
  await o.page.fill('#cfg-url', L.W); await o.page.fill('#cfg-token', 'owner-secret');
  await L.tapL(o, L.btn(o, /^Done$/)); await L.sleep(3000); await L.checkWorker(o);
  // 8 pieces from Add → Import
  await L.tapL(o, L.btn(o, /^Wardrobe$/)); await L.tapL(o, o.page.locator('#ward-add')); await L.sleep(600);
  await o.tap('#add-import'); await L.sleep(600);
  const csv = require('fs').readFileSync(__dirname + '/_verify7-lib.js', 'utf8').match(/const CSV = `([\s\S]*?)`/)[1];
  const ta = o.page.locator('textarea:visible').first(); await ta.fill(csv); await ta.dispatchEvent('input'); await L.sleep(600);
  await L.tapL(o, L.btn(o, new RegExp(`^Add ${L.N_ITEMS} items$`))); await L.sleep(1500);
  if (await L.vis(o, '.kit-x')) await o.tap('.kit-x');
  await L.sleep(5000);   // the owner backs up shortly after a change
  const d = await L.mock('kv-dump'); const ownItems = d['wardrobe:v1'] ? (() => { const j = JSON.parse(d['wardrobe:v1'].v); return ((j.data || j).items || []).length })() : 0;
  L.log('owner phone items', (await L.phoneState(o)).items, 'owner backup items', ownItems);
  await o.page.goto(info.inviteLink);
  const q = await L.waitAsk(o, 30); L.log('QUESTION', q); await o.shot('W1-7-02-q');
  await o.page.click('#ask-ok');
  for (let i = 0; i < 40; i++) { await L.sleep(500); try { if (await o.page.evaluate(() => window.appReady)) break } catch { } }
  await L.sleep(4000); await o.tap('#su-skip').catch(() => { }); await L.sleep(800);
  await openConn(o); const u = await usable(o);
  const connTxt = await o.page.evaluate(() => document.querySelector('#sc-connection').innerText.replace(/\s+/g, ' ').slice(0, 200));
  L.log('Connection after switch', connTxt); L.log('ways back', u); await o.shot('W1-7-02-conn');
  const ok = /open that invitation’s link again to get it back/.test(q || '') && !u.advanced && !u.fields.length && !u.ownerBtn && ownItems === L.N_ITEMS;
  console.log(ok ? `REPRODUCED: the owner was told to "open that invitation’s link again", and after switching Connection shows no Advanced fold, no field and no "I run the server" (${JSON.stringify(u)}); his ${ownItems} items stay in the server's backup` : 'NOT REPRODUCED ' + JSON.stringify({ q: q && q.slice(0, 120), u, ownItems }));
});
