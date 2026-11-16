// W1-11-02: a tester who lost his invitation link can't get back to his backup: a new invitation with the same name is a new, empty account,
// and the tester-facing Connection text never tells him to keep the link safe.
const L = require('./_verify11-lib.js');
(async () => {
  const ev = []; let ok = true;
  await L.startLab('verify11-02');
  try {
    const inv = await L.invite('v02');
    const a = await L.phone('02a');
    await L.world(a, '2026-11-15T07:30:00+03:00');
    await a.page.goto(inv.link); await a.ready(); await L.sleep(2500); await L.checkWorker(a);
    await L.tapSel(a, '#su-skip'); await L.sleep(600);
    await L.addPhotos(a, L.PHOTOS.slice(0, 4));
    await L.goTab(a, 'Today'); await a.background(); await L.sleep(3000);
    const sa = await L.state(a); ev.push(`phone A: ${sa.n} items, backed up ${!!sa.last}`);
    if (sa.n !== 4 || !sa.last) { ok = false; ev.push('setup failed') }
    // what the tester is told about his link (Settings -> Connection, connected in Safari)
    await a.foreground(); await L.sleep(500);
    await L.openSettingsCat(a, 'connection'); await L.sleep(2500);
    const conn = await L.text(a, '#acct-box');
    ev.push('Connection text: ' + conn.slice(0, 400));
    const keepSafe = /keep (it|the link|your link) (safe|somewhere)|save (it|the link)|only way back|lose/i.test(conn);
    ev.push('tells him to keep the link safe for later: ' + keepSafe); if (keepSafe) ok = false;
    await a.kill();
    // Safari wiped, the message is lost: the owner makes a new invitation with the same name
    const inv2 = await L.invite('v02');
    const b = await L.phone('02b');
    await L.world(b, '2026-11-26T07:30:00+03:00');
    await b.page.goto(inv2.link); await b.ready(); await L.sleep(7000); await L.checkWorker(b);
    const sb = await L.state(b); ev.push(`new link on a fresh phone: ${sb.n} items, setup shown ${sb.setupShown}`);
    if (sb.n !== 0) ok = false;
    const list = (await L.ownerList()).invites.filter(v => v.name === 'v02');
    ev.push(`owner's list: ${list.length} entries named v02 (${list.map(v => v.id).join(', ')})`);
    if (list.length !== 2) ok = false;
    const kv = await L.mock('kv'); ev.push('wardrobes on server: ' + kv.keys.filter(k => /wardrobe:v1$/.test(k)).length);
    await b.kill();
  } catch (e) { ok = false; ev.push('ERROR ' + e.message) }
  await L.stopLab(); L.done(ok, ev); process.exit(0);
})();
