// W2-13-03: a /sync POST (from anyone holding the tester's code) carrying deletion marks (tombstones) dated far in the future wipes
// the wardrobe, and "Roll back" to the daily copy kept before cannot bring it back: the future tombstones outrank the restamped items.
// Lab 9730/9731, one connected phone. No markup here, just the merge rule.
const RP = require('../harness/paths.js');
const L = require('./lib-verify13.js'), fs = require('fs');
L.run(async () => {
  const lab = await L.startLab('03');
  const F = await L.invite('Fay', lab.appUrl);
  const ph = await L.phone('03');
  await ph.page.goto(F.link); await ph.ready(); await L.sleep(3000); await L.skipSetup(ph);
  const now = Date.parse(L.T0) - 864e5 * 3;
  const mk = (id, type, c, name) => ({ id, type, primaryColor: c, pattern: 'solid', secondaryColor: 'none', tertiaryColor: 'none', name, added: now, updated: now });
  const file = RP.SCRATCH + '/kv/verify13-03-backup.json';
  fs.writeFileSync(file, JSON.stringify({ app: 'daily-wardrobe', version: 1, items: [
    mk('f1', 'suit', 'navy', 'Fay suit'), mk('f2', 'shirt', 'white', 'Fay shirt'), mk('f3', 'tie', 'burgundy', 'Fay tie'), mk('f4', 'shoes', 'black', 'Fay shoes')], days: [], tombstones: {} }));
  await L.restoreFile(ph, file); await L.closeSettingsUI(ph);
  await ph.background(); await L.sleep(2500); await ph.foreground(); await L.sleep(2500);
  const day1 = await L.st(ph);

  // day 2: the attacker (holding Fay's code) POSTs future-dated tombstones for the four items
  await L.mock('clock', { at: '2026-11-17T06:00:00+03:00' }); await ph.setTime('2026-11-17T06:00:00+03:00');
  const lite = await L.call('GET', 'sync?lite=1', F.code);
  const post = await L.call('POST', 'sync', F.code, { baseRev: lite.j.rev, day: '2026-11-17', delta: { items: [], days: [], tombstones: { f1: 9e12, f2: 9e12, f3: 9e12, f4: 9e12 } }, photos: {} });
  await ph.kill(); // reopen the SAME phone/profile (storage kept), like Fay opening the app next day
  const ph2 = await L.P.openPhone({ profile: 'verify13-03', fresh: false, time: '2026-11-17T06:10:00+03:00' });
  await ph2.page.goto(lab.appUrl); await ph2.ready(); await L.sleep(5000);
  const afterAttack = await ph2.page.evaluate(() => ('items' in HOOK ? HOOK.items.map(i => i.id) : null));

  // Fay rolls back to the copy kept before today's first change
  await ph2.tap(L.gear); await L.sleep(500);
  await ph2.page.evaluate(() => { if ('setCatOpen' in HOOK && typeof HOOK.setCatOpen === 'function') HOOK.setCatOpen('backup', true); else if ('toggleCat' in HOOK && typeof HOOK.toggleCat === 'function') HOOK.toggleCat('backup'); }); await L.sleep(2500);
  // the copies list loads from the server; wait for it, and roll back only when there is a copy (none listed: nothing to roll back to)
  let opts = [];
  for (let i = 0; i < 20 && !opts.length; i++) { opts = await ph2.page.evaluate(() => [...document.querySelectorAll('#snap-list option')].map(o => o.value).filter(Boolean)); if (!opts.length) await L.sleep(500) }
  const pick = opts.find(v => v === '2026-11-17') || opts[0] || null;
  if (pick) {
  await ph2.page.selectOption('#snap-list', pick); await L.sleep(300);
  ph2.onDialog = d => d.accept();
  await ph2.page.evaluate(() => { const b = document.querySelector('#snap-btn'); if (b) b.click(); }); await L.sleep(800);
  await ph2.page.evaluate(() => { const b = document.querySelector('#ask-ok'); if (b) b.click(); }); await L.sleep(5000);
  }
  const status = await ph2.page.evaluate(() => (document.querySelector('#snap-status') || {}).innerText || '');
  const afterRoll = await ph2.page.evaluate(() => ('items' in HOOK ? HOOK.items.map(i => i.id) : null));
  const srv = await L.call('GET', 'sync?lite=1', F.code);
  await ph2.kill();
  const ok = (afterAttack || []).length === 0 && (afterRoll || []).length === 0;
  L.verdict(ok, { day1Items: day1.items, attackerPost: post.s, chosenCopy: pick, afterAttackItems: afterAttack,
    copiesListed: opts, rollBackStatus: status, afterRollbackItems: afterRoll, serverTombstonesStillFuture: srv.j.tombstones, serverItems: (srv.j.items || []).map(i => i.id) });
});
