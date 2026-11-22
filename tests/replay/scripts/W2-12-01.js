// W2-12-01: a crafted backup file ("Restore file") puts an item id and a photo string into the page unescaped, so they run
// script in the app; the restored phone backs them up and a second phone of the same account runs them too.
// Harmless markers only: each payload calls window.__v12h(n), which just records n (see _verify12-lib.js).
const RP = require('../harness/paths.js');
const fs = require('fs');
const L = require('./_verify12-lib.js');
const FILE = RP.SCRATCH + '/kv/verify12-crafted-backup.json';
const now = new Date(L.T0).getTime();
const it = (id, o) => ({ id, type: 'suit', primaryColor: 'navy', secondaryColor: null, tertiaryColor: null, pattern: 'solid', vest: 'no', added: now - 864e5, updated: now, ...o });
fs.writeFileSync(FILE, JSON.stringify({ app: 'daily-wardrobe', version: 1, exported: new Date(now).toISOString(), items: [
  it("v1');__v12h(201);('"),                                                                         // id -> onclick="openItem('…')"
  it('v2', { type: 'shirt', primaryColor: 'white', photo: 'data:image/png;base64,AAAA" onerror="__v12h(203)' }), // photo -> <img src="…">
  it('v3', { type: 'tie', primaryColor: 'burgundy' }),
  it('v4', { type: 'shoes', primaryColor: 'black', leather: 'calf' }),
], days: [], settings: null }));

async function restore(ph) {
  await ph.tap('header .hbtns button[data-act="setOpenTap"]'); await L.sleep(700);
  await ph.tap('#sc-backup .scat-head'); await L.sleep(500);
  await ph.page.setInputFiles('#sc-backup input[type=file]', FILE); await L.sleep(2500);
  const msg = await ph.page.evaluate(() => document.body.innerText.match(/Restored\.[^\n]*/)?.[0] || null);
  await ph.page.keyboard.press('Escape'); await L.sleep(500);
  if (await ph.page.locator('#settings-modal').isVisible().catch(() => false)) await ph.page.evaluate(() => closeSettings());
  return msg;
}
async function wardrobe(ph) { await ph.tap('#n-wardrobe'); await L.sleep(1200); return L.hits(ph) }

L.run(async () => {
  await L.startLab('w2-12-01');
  const ev = {};
  // 1) a fresh phone that isn't connected
  const r = await L.phone('r', { invite: false });
  ev.rRestore = await restore(r); ev.rAfterRestore = await L.hits(r);
  ev.rWardrobe = await wardrobe(r);
  const box = r.page.locator('#wardrobe .giopen[onclick*="__v12h(201)"]');
  // tapped when it is there (a fixed app leaves the crafted item out); the verdict is the markers, not the box
  ev.boxCount = await box.count();
  if (ev.boxCount) { await box.scrollIntoViewIfNeeded(); const b = await box.boundingBox(); await r.tapAt(b.x + b.width / 2, b.y + b.height / 2); await L.sleep(800) }
  ev.rTapBox = await L.hits(r);
  // 2) a connected phone A restores the same file and backs up; a fresh phone B joins with the same invitation link
  const a = await L.phone('a');
  ev.aRestore = await restore(a); await L.hits(a);
  await a.page.evaluate(() => syncNow()).catch(() => {}); await L.sleep(4000);
  const kv = await L.mock('kv-dump');
  const wk = Object.keys(kv).find(k => /:wardrobe:v1$/.test(k)); const v = wk ? (typeof kv[wk] === 'string' ? kv[wk] : JSON.stringify(kv[wk])) : '';
  ev.serverKey = wk; ev.serverHasId = v.includes('__v12h(201)'); ev.serverHasPhoto = v.includes('__v12h(203)');
  const bp = await L.phone('b'); await L.sleep(3000);
  ev.bItems = await bp.page.evaluate(() => items.length);
  ev.bWardrobe = await wardrobe(bp);
  ev.workerUrls = [await a.page.evaluate(() => localStorage.worker_url), await bp.page.evaluate(() => localStorage.worker_url)];
  ev.openaiCalls = (await L.mock('log')).openai;
  const ok = ev.rWardrobe.includes('203') && ev.rTapBox.includes('201') && ev.serverHasId && ev.serverHasPhoto && ev.bWardrobe.includes('203');
  L.verdict(ok, ev);
});
