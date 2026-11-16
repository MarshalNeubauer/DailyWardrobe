// W1-11-03: after a Safari wipe, Restore file keeps the new setup's vest and holiday country over the backup file's, yet says "Restored".
// Not connected. Pass "walk" to walk the new setup with its defaults instead of Skip.
const RP = require('../harness/paths.js');
const L = require('./_verify11-lib.js');
const fs = require('fs');
const MODE = process.argv[2] || 'skip';
(async () => {
  const ev = [`mode ${MODE}`]; let ok = true;
  await L.startLab('verify11-03');
  const file = RP.SCRATCH + '/kv/verify11-03-backup.json';
  try {
    const ph = await L.phone('03');
    await L.world(ph, '2026-11-15T07:30:00+03:00');
    await ph.page.goto(L.APP); await ph.ready(); await L.sleep(2000);
    for (let i = 0; i < 9; i++) {
      const title = await L.text(ph, '#su-title');
      if (/Your week/.test(title)) await L.tapSel(ph, '#su-workdays button:nth-child(5)');   // Thursday off
      if (/What you wear/.test(title)) { await ph.page.selectOption('#su-vest', 'always'); await L.sleep(300) }
      if (/Weather/.test(title)) await L.tapSel(ph, '#su-units button:nth-child(2)');       // °F
      const last = /All set/.test(title);
      await L.tapSel(ph, '#su-next'); await L.sleep(300);
      if (last) break;
    }
    await L.sleep(800);
    await L.addPhotos(ph, L.PHOTOS.slice(0, 6), ['suit', 'shirt', 'tie', 'shoes', 'shirt', 'tie']);
    await L.goTab(ph, 'Today');
    await L.openSettingsCat(ph, 'daysoff'); await ph.page.selectOption('#cfg-country', 'GB'); await L.sleep(4000);
    await L.tapSel(ph, '#sc-daysoff .scat-head'); await L.tapSel(ph, '#sc-backup .scat-head'); await L.sleep(500);
    const dl = ph.page.waitForEvent('download', { timeout: 15000 });
    await L.tapText(ph, 'Download backup', '#sp-backup');
    await (await dl).saveAs(file);
    await ph.page.keyboard.press('Escape'); await L.sleep(500);
    const before = await L.state(ph);
    const fileSet = JSON.parse(fs.readFileSync(file, 'utf8')).settings;
    ev.push(`before wipe: ${before.n} items, vest ${before.vest}, holidays ${before.hol}; file: vest ${fileSet.vestMode}, holidays ${fileSet.holidays && fileSet.holidays.country}`);
    if (before.vest !== 'always' || before.hol !== 'GB') { ok = false; ev.push('setup failed') }
    // Safari wipes; he skips (or walks) the new setup, then restores the file
    await L.world(ph, '2026-11-30T07:40:00+03:00');
    await ph.evict(L.APP); await ph.ready(); await L.sleep(2000);
    if (MODE === 'skip') await L.tapSel(ph, '#su-skip');
    else for (let i = 0; i < 9; i++) { const last = /All set/.test(await L.text(ph, '#su-title')); await L.tapSel(ph, '#su-next'); await L.sleep(300); if (last) break }
    await L.sleep(1000); await L.closeTour(ph);
    if (await ph.page.locator('#add').isVisible().catch(() => false)) await L.goTab(ph, 'Today');
    await L.openSettingsCat(ph, 'backup');
    let toast = ''; const watch = setInterval(async () => { const t = await ph.page.evaluate(() => { const e = document.querySelector('#toast'); return e && e.classList.contains('on') ? e.innerText : '' }).catch(() => ''); if (/Restored/.test(t)) toast = t }, 150);
    await ph.page.locator('#sp-backup input[type=file]').setInputFiles(file); await L.sleep(3000); clearInterval(watch);
    await ph.page.keyboard.press('Escape'); await L.sleep(500);
    const after = await L.state(ph);
    ev.push(`toast: ${toast}`);
    ev.push(`after restore: ${after.n} items, vest ${after.vest}, holidays ${after.hol}`);
    await ph.reopen(L.APP); await ph.ready(); await L.sleep(2000);
    const again = await L.state(ph); ev.push(`after restart: vest ${again.vest}, holidays ${again.hol}`);
    if (!(after.n === 6 && /Restored/.test(toast) && (again.vest !== 'always' || again.hol !== 'GB'))) ok = false;
    await ph.kill();
  } catch (e) { ok = false; ev.push('ERROR ' + e.message) }
  try { fs.unlinkSync(file) } catch {}
  await L.stopLab(); L.done(ok, ev); process.exit(0);
})();
