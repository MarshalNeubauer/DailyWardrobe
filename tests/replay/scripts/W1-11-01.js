// W1-11-01: after Safari clears the site, a connected tester gets a plain new Welcome (nothing about his backup or his link), and pieces he
// re-adds before he finds his link are merged into the restored wardrobe without a question.
const L = require('./_verify11-lib.js');
(async () => {
  const ev = []; let ok = true;
  await L.startLab('verify11-01');
  try {
    const inv = await L.invite('v01');
    const ph = await L.phone('01');
    await L.world(ph, '2026-11-15T07:30:00+03:00');
    await ph.page.goto(inv.link); await ph.ready(); await L.sleep(2500); await L.checkWorker(ph);
    await L.tapSel(ph, '#su-skip'); await L.sleep(600);
    await L.addPhotos(ph, L.PHOTOS.slice(0, 6));
    await L.goTab(ph, 'Today'); await ph.background(); await L.sleep(3000);
    const before = await L.state(ph); ev.push(`before wipe: ${before.n} items, last_sync ${!!before.last}`);
    if (before.n !== 6 || !before.last) { ok = false; ev.push('setup failed: not 6 backed-up items') }
    // 11 days later Safari has cleared the site; he opens the bookmark (the app's plain address)
    await L.world(ph, '2026-11-26T07:40:00+03:00');
    await ph.evict(L.APP); await ph.ready(); await L.sleep(2500);
    const welcome = await L.text(ph, '#setup');
    ev.push('Welcome: ' + welcome.slice(0, 220));
    const mentions = /invitation|invite|backup|backed up|come back|before/i.test(welcome);
    ev.push('Welcome mentions backup/link/used before: ' + mentions);
    if (mentions) ok = false;
    await L.tapSel(ph, '#su-skip'); await L.sleep(800); await L.closeTour(ph);
    const today = await L.text(ph, '#today'); ev.push('Today mentions backup/link: ' + /invitation|backup/i.test(today));
    if (/invitation|backup/i.test(today)) ok = false;
    // re-adds two of the same pieces by hand (types picked: not connected)
    await L.addPhotos(ph, L.PHOTOS.slice(0, 2), ['suit', 'shirt']);
    const readded = await L.state(ph); ev.push('re-added: ' + readded.items.join(', '));
    // later he finds his invitation link
    let dialog = null; ph.onDialog = d => { dialog = d.message(); return d.accept() };
    await ph.page.goto(inv.link); await ph.page.reload(); await ph.ready(); await L.sleep(8000); await L.checkWorker(ph);
    const askEl = await L.text(ph, '.ask, [role=alertdialog]');
    const after = await L.state(ph);
    ev.push(`after link: ${after.n} items: ${after.items.join(', ')}`);
    ev.push('question asked: ' + (dialog || askEl || 'none'));
    if (after.n !== 8 || dialog || askEl) ok = false;
    await ph.kill();
  } catch (e) { ok = false; ev.push('ERROR ' + e.message) }
  await L.stopLab(); L.done(ok, ev); process.exit(0);
})();
