// W1-2-04: an own pattern is named by its key ("own paisley neat") in Today's folded pieces line. Own pattern "Paisley neat"
// made on a tie card (14 Nov app; the same text on today's app for any own pattern), then today's app steps through the days. Port 9620.
const RP = require('../harness/paths.js');
const v = require('./_verify2-lib.js');
const KV = RP.SCRATCH + '/kv/verify2-w1-2-04.json', T = '2026-11-14T10:00:00+03:00';
(async () => {
  require('fs').rmSync(KV, { force: true });
  let info = await v.startLab(v.OLD, KV);
  const ph = await v.openPhone({ profile: 'verify2-w1-2-04', fresh: true, time: T }); await v.mock('clock', { at: new Date(T).toISOString() });
  await v.oldAddCards(ph, info);
  await ph.background(); await v.sleep(1500); await ph.kill(); await v.stopLab();
  info = await v.startLab(v.NEW, KV);
  ph.offset = new Date('2026-11-15T08:00:00+03:00').getTime() - Date.now(); await v.mock('clock', { at: '2026-11-15T05:00:00.000Z' });
  await v.reopenNew(ph, info.appUrl);
  const tie = await ph.page.evaluate(() => { const i = HOOK.items.find(x => /^own-/.test(x.pattern || '')); return { pattern: i.pattern, patName: HOOK.patName(i.pattern), nm: HOOK.nm(i) } });
  console.log('own-pattern tie', JSON.stringify(tie));
  await v.tap(ph, /^Today$/, 'nav button'); await v.sleep(800);
  let hit = null;
  for (let d = 0; d < 10 && !hit; d++) {
    const line = await v.txt(ph, '#ibox');
    if (/\bown\b/i.test(line)) hit = line;
    else { await ph.tap('button[aria-label="Next day"]'); await v.sleep(900) }
  }
  if (hit) await ph.shot('w1-2-04-line');
  console.log(hit ? 'REPRODUCED: Today\'s pieces line reads "' + hit.slice(0, 160) + '"' : 'NOT REPRODUCED (no day in 10 showed "own")');
  console.log('page errors', ph.errors.filter(e => !/404/.test(e)).slice(0, 5));
  await ph.kill(); await v.stopLab(); process.exit(0);
})().catch(async e => { console.error(e); await v.stopLab(); process.exit(1) });
