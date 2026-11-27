// W1-2-02: own colors "Gray" (made on a white shirt card) and "Navy" (made on a gray suit card) on the 14 Nov app take over
// import rows on today's app: "Suit,Grey" is saved as cream, "Suit,Navy" as the own gray-behaving Navy. Standalone, port 9620.
const RP = require('../harness/paths.js');
const v = require('./_verify2-lib.js');
const KV = RP.SCRATCH + '/kv/verify2-w1-2-02.json', T = '2026-11-14T10:00:00+03:00';
const ROWS = 'Type,Colour,Name\nSuit,Navy,Imp navy suit\nTie,Navy,Imp navy tie\nTrousers,Gray,Imp gray trousers\nShirt,Gray,Imp gray shirt\nSuit,Grey,Imp grey suit';
(async () => {
  require('fs').rmSync(KV, { force: true });
  let info = await v.startLab(v.OLD, KV);
  const ph = await v.openPhone({ profile: 'verify2-w1-2-02', fresh: true, time: T }); await v.mock('clock', { at: new Date(T).toISOString() });
  const built = await v.oldAddCards(ph, info);
  console.log('own colours (14 Nov)', JSON.stringify(built.custom.colors.map(c => [c.name, c.key || c.k, c.base])));
  await ph.background(); await v.sleep(1500); await ph.kill(); await v.stopLab();
  info = await v.startLab(v.NEW, KV);
  ph.offset = new Date('2026-11-15T10:00:00+03:00').getTime() - Date.now(); await v.mock('clock', { at: '2026-11-15T07:00:00.000Z' });
  await v.reopenNew(ph, info.appUrl);
  await v.tap(ph, /^Wardrobe$/, 'nav button'); await v.sleep(700); await v.tapSel(ph, '#ward-add'); await v.sleep(700);
  await v.tapSel(ph, '#add-import'); await v.sleep(700);
  await ph.page.locator('#kit-paste').fill(ROWS); await v.sleep(900);
  const prev = await v.txt(ph, '#kit-prev'); console.log('preview:', prev.slice(0, 700));
  await ph.shot('w1-2-02-preview', true);
  await v.tapSel(ph, '#kit-imp'); await v.sleep(2500);
  const got = await ph.page.evaluate(() => Object.fromEntries(HOOK.items.filter(i => /^Imp /.test(i.name || '')).map(i => [i.name, [i.primaryColor, HOOK.colName(i.primaryColor), HOOK.planCol(i)]])));
  console.log('saved', JSON.stringify(got));
  const bad = [];
  if (got['Imp grey suit'] && got['Imp grey suit'][0] !== 'grey') bad.push('Suit,Grey -> ' + got['Imp grey suit'][0]);
  if (got['Imp navy suit'] && got['Imp navy suit'][0] !== 'navy') bad.push('Suit,Navy -> ' + got['Imp navy suit'][0] + ' (plans as ' + got['Imp navy suit'][2] + ')');
  if (got['Imp navy tie'] && got['Imp navy tie'][0] !== 'navy') bad.push('Tie,Navy -> ' + got['Imp navy tie'][0]);
  if (got['Imp gray trousers'] && got['Imp gray trousers'][0] !== 'grey') bad.push('Trousers,Gray -> ' + got['Imp gray trousers'][0]);
  console.log(bad.length >= 2 ? 'REPRODUCED: ' + bad.join('; ') : 'NOT REPRODUCED ' + bad.join('; '));
  console.log('page errors', ph.errors.filter(e => !/404/.test(e)).slice(0, 5));
  await ph.kill(); await v.stopLab(); process.exit(0);
})().catch(async e => { console.error(e); await v.stopLab(); process.exit(1) });
