// W1-11-04: someone using the app only in iPhone Safari, unconnected, is never told that Safari can clear the wardrobe, nor given a reason
// to Download backup (setup's Home Screen step, Settings -> Backup & sync).
const L = require('./_verify11-lib.js');
const RISK = /clear|delete|erase|lose|lost|wipe|remov|week|not opened|short of space/i;
(async () => {
  const ev = []; let ok = true;
  await L.startLab('verify11-04');
  try {
    const ph = await L.phone('04');
    await L.world(ph, '2026-11-15T07:30:00+03:00');
    await ph.page.goto(L.APP); await ph.ready(); await L.sleep(2000);
    let home = '';
    for (let i = 0; i < 9; i++) {
      const title = await L.text(ph, '#su-title');
      if (/Home Screen/.test(title)) home = await L.text(ph, '#setup .su-body');
      const last = /All set/.test(title); await L.tapSel(ph, '#su-next'); await L.sleep(300); if (last) break;
    }
    ev.push('Home Screen step: ' + (home || '(no such step)').slice(0, 400));
    if (!home || RISK.test(home)) ok = false;
    await L.sleep(800); await L.closeTour(ph);
    await L.addPhotos(ph, L.PHOTOS.slice(0, 2), ['suit', 'shirt']);
    await L.goTab(ph, 'Today');
    await L.openSettingsCat(ph, 'backup');
    const backup = await L.text(ph, '#sp-backup');
    ev.push('Backup & sync: ' + backup.slice(0, 400));
    if (RISK.test(backup)) ok = false;
    const all = await L.text(ph, '#settings-modal');
    ev.push('Settings mentions Safari clearing: ' + /Safari.{0,80}(clear|delete)/i.test(all));
    if (/Safari.{0,80}(clear|delete)/i.test(all)) ok = false;
    await ph.kill();
  } catch (e) { ok = false; ev.push('ERROR ' + e.message) }
  await L.stopLab(); L.done(ok, ev); process.exit(0);
})();
