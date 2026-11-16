// W1-1-01: a phone that joins an account last backed up by the 12 Nov app (PLAN_RULES 11) re-plans the week on its
// second start ("The planner was updated…"): settings.planRules 11 comes back from the backup, and the updated phone's 15
// never reaches the backup (planRulesCheck stores it without a stamp).
// Standalone: lab on port 9610, fresh profiles verify1-r01-*, kv .work/kv/verify1-r01.json.
// node tests/replay/run.js --only W1-1-01
const RP = require('../harness/paths.js');
const L = require('./lib-verify1.js');
const { openPhone, setWorldTime, mock, sleep, toastWatch, serverSettings } = L;
const KV = RP.SCRATCH + '/kv/verify1-r01.json', APP = `http://127.0.0.1:${L.PORT}/index.html`;
const out = {};
(async () => {
  const { a, link, items } = await L.buildOld(KV, 'verify1-r01-a'); out.oldItems = items;
  out.serverOld = await serverSettings();
  await a.kill(); await L.stopLab();
  // the server and app are updated (same port, same kv); phone a opens on Sun 22 Nov, then closes and reopens to take the update
  await L.startLab(L.NEW, KV);
  await a.open(); await setWorldTime(a, L.PORT, '2026-11-22T07:30:00+03:00');
  await a.page.goto(APP); await a.ready().catch(() => {}); await sleep(6000);
  await a.reopen(APP); await a.ready().catch(() => {});
  out.aToastsAfterUpdate = await toastWatch(a, 8000);
  out.aVersion = await a.page.evaluate(() => typeof appVersion === 'function' ? appVersion() : '?');
  await a.background(); await sleep(4000); await a.foreground();
  out.aPlanRules = await a.page.evaluate(() => settings.planRules);
  out.serverAfterAUpdate = await serverSettings();
  // phone c joins the same account with the same invitation link, on today's code, then is closed and reopened
  await mock('clock', { at: '2026-11-22T05:00:00.000Z' });
  const c = await openPhone({ profile: 'verify1-r01-c', fresh: true, time: '2026-11-22T08:00:00+03:00' });
  await c.page.goto(link); await c.ready().catch(() => {}); await sleep(12000);
  out.cJoined = await c.page.evaluate(() => ({ planRules: settings.planRules, items: items.length }));
  await c.background(); await sleep(3000); await mock('count-reset', {});
  await c.reopen(APP); await c.ready().catch(() => {});
  out.cToastsOnReopen = await toastWatch(c, 9000);
  out.cAfterReopen = await c.page.evaluate(() => settings.planRules);
  await c.background(); await sleep(3000);
  out.kvWritesAfterCReopen = (await mock('log')).kvByPrefix;
  out.serverAfterC = await serverSettings();
  await a.reopen(APP); await a.ready().catch(() => {});
  out.aToastsLaterReopen = await toastWatch(a, 6000);
  await a.background(); await sleep(3000); await a.kill();
  // does it stop? phone c: four more starts, each followed by going to the background (a backup/sync)
  out.cLater = [];
  for (let i = 0; i < 4; i++) {
    await c.reopen(APP); await c.ready().catch(() => {});
    const t = await toastWatch(c, 7000); const pr = await c.page.evaluate(() => settings.planRules);
    await c.background(); await sleep(3000);
    out.cLater.push({ replanToast: t.some(x => /planner was updated/.test(x)), planRulesAfter: pr });
  }
  await c.page.evaluate(() => 0).catch(() => {}); await c.kill(); await L.stopLab();
  const rep = out.serverAfterAUpdate.planRules === 11 && out.cJoined.planRules < 15 && out.cToastsOnReopen.some(t => /planner was updated/.test(t));
  console.log(JSON.stringify(out, null, 1)); console.log(rep ? 'REPRODUCED' : 'NOT REPRODUCED'); process.exit(0);
})().catch(async e => { console.log(JSON.stringify(out, null, 1)); console.log('ERROR ' + (e.stack || e)); console.log('NO VERDICT (error)'); await L.stopLab(); process.exit(1) });
