// W1-1-02: the update morning's KV writes for one tester updating 12 Nov -> today (13-item wardrobe here, the tester had 16).
// Prints the writes of (1) the first open on the old cached app against today's server, (2) the first sync after the update
// (upgradePhotos remakes every photo at 1536 px + a small copy each). REPRODUCED when the two together are at least 2 writes per item and the post-update sync alone at least 1 per item
// (measured 2026-11-15: 20 + 20 = 40 writes for 13 items; the tester saw 31 + 33 for 16; small copies under 16 KB stay inline).
// Standalone: lab on port 9610, fresh profile verify1-r02-a, kv .work/kv/verify1-r02.json.
const RP = require('../harness/paths.js');
const L = require('./lib-verify1.js');
const { setWorldTime, mock, sleep, toastWatch } = L;
const KV = RP.SCRATCH + '/kv/verify1-r02.json', APP = `http://127.0.0.1:${L.PORT}/index.html`;
const out = {};
const syncs = l => l.recent.filter(r => /\/sync/.test(r));
(async () => {
  const { a, items } = await L.buildOld(KV, 'verify1-r02-a'); out.items = items;
  await a.kill(); await L.stopLab();
  await L.startLab(L.NEW, KV);
  await a.open(); await setWorldTime(a, L.PORT, '2026-11-22T07:30:00+03:00'); await mock('count-reset', {});
  // (1) first open: the phone still runs the 12 Nov app from its service worker
  await a.page.goto(APP); await a.ready().catch(() => {}); await sleep(6000);
  out.firstOpenVersion = await a.page.evaluate(() => typeof appVersion === 'function' ? appVersion() : '?');   // the old cached app: no HOOK (READS_KEPT)
  await a.background(); await sleep(4000);
  let l = await mock('log'); out.firstOpen = { kvPut: l.kvPut, byPrefix: l.kvByPrefix, syncs: syncs(l) };
  await mock('count-reset', {});
  // (2) close and reopen: today's app (dw-v376), upgradePhotos/smallPhotos, then the backup on going to the background
  await a.reopen(APP); await a.ready().catch(() => {});
  out.toasts = await toastWatch(a, 10000);
  out.version = await a.page.evaluate(() => typeof HOOK === 'object' && 'appVersion' in HOOK ? HOOK.appVersion() : '?');
  await a.background(); await sleep(6000); await a.foreground(); await sleep(1000); await a.background(); await sleep(4000);
  l = await mock('log'); out.afterUpdate = { kvPut: l.kvPut, byPrefix: l.kvByPrefix, syncs: syncs(l) };
  const kv = await mock('kv'); out.kvKeys = kv.keys.length; out.phKeys = kv.keys.filter(k => /:ph:|^ph:|dwph/.test(k)).length;
  await a.kill(); await L.stopLab();
  const total = out.firstOpen.kvPut + out.afterUpdate.kvPut;
  out.total = total; out.perItem = +(total / items).toFixed(1);
  console.log(JSON.stringify(out, null, 1)); console.log(total >= 2 * items && out.afterUpdate.kvPut >= items ? 'REPRODUCED' : 'NOT REPRODUCED'); process.exit(0);
})().catch(async e => { console.log(JSON.stringify(out, null, 1)); console.log('ERROR ' + (e.stack || e)); console.log('NO VERDICT (error)'); await L.stopLab(); process.exit(1) });
