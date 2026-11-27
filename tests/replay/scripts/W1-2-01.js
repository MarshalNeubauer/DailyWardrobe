// W1-2-01: rows imported on the 14 Nov app naming an own color are saved with the list index ("0","1"...) as their color,
// and today's app keeps it: the item sheet says "Colour None". Standalone: lab on port 9620, fresh KV and profile.
const RP = require('../harness/paths.js');
const v = require('./_verify2-lib.js');
const KV = RP.SCRATCH + '/kv/verify2-w1-2-01.json', T = '2026-11-14T10:00:00+03:00';
const ROWS = 'Type\tColour\tPattern\tName\nTie\tGray\tSolid\tGray tie\nTrousers\tNavy\tSolid\tNavy trousers\nSuit\tMocha\tSolid\tMocha two';
(async () => {
  require('fs').rmSync(KV, { force: true });
  let info = await v.startLab(v.OLD, KV);
  const ph = await v.openPhone({ profile: 'verify2-w1-2-01', fresh: true, time: T }); await v.mock('clock', { at: new Date(T).toISOString() });
  const built = await v.oldAddCards(ph, info);
  console.log('own colours (14 Nov)', JSON.stringify(built.custom.colors.map(c => c.name)));
  await v.oldImport(ph, ROWS);
  // still the 14 Nov app, which has no HOOK: `items` is its global there (READS_KEPT in tests/bridge.test.js)
  const old = await ph.page.evaluate(() => items.filter(i => /^(Gray tie|Navy trousers|Mocha two)$/.test(i.name || '')).map(i => [i.name, i.primaryColor]));
  console.log('saved by 14 Nov import', JSON.stringify(old));
  await ph.background(); await v.sleep(1500); await ph.kill(); await v.stopLab();
  // the app and server are updated
  info = await v.startLab(v.NEW, KV);
  const opens = await v.reopenNew(ph, info.appUrl);
  const now = await ph.page.evaluate(() => HOOK.items.filter(i => /^(Gray tie|Navy trousers|Mocha two)$/.test(i.name || '')).map(i => [i.name, i.primaryColor, HOOK.colName(i.primaryColor)]));
  console.log('today\'s app after', opens, 'opens', JSON.stringify(now));
  await v.tap(ph, /^Wardrobe$/, 'nav button'); await v.sleep(800);
  const id = await ph.page.evaluate(() => (HOOK.items.find(i => i.name === 'Gray tie') || {}).id);
  await v.tapSel(ph, `#gi-${id} .giopen`); await v.sleep(800);
  const sheet = await v.txt(ph, '#item-view'); const m = sheet.match(/Colou?r\s+(\S+)/);   // "Colour" (aa24910) or "Color" (#462)
  console.log('Gray tie sheet:', sheet.slice(0, 200));
  await ph.shot('w1-2-01-sheet');
  const numeric = now.filter(x => /^\d+$/.test(x[1]));
  if (numeric.length >= 2 && m && /None/.test(m[1])) console.log('REPRODUCED: ' + numeric.length + ' imported items keep an index as colour ' + JSON.stringify(numeric) + '; sheet reads "Colour ' + m[1] + '"');
  else console.log('NOT REPRODUCED', JSON.stringify(now), m && m[1]);
  console.log('page errors', ph.errors.filter(e => !/404/.test(e)).slice(0, 5));
  await ph.kill(); await v.stopLab(); process.exit(0);
})().catch(async e => { console.error(e); await v.stopLab(); process.exit(1) });
