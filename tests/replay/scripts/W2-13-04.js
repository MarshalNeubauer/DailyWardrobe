// W2-13-04: a crafted link on an already-connected phone.
// (a) a link with a NEW code + a w= pointing at a stranger shows "Switch this phone to <stranger-chosen name>'s invitation?" and one
//     tap ("Clear and switch") wipes the phone and moves it to the stranger (where W2-13-01/02 then apply).
// (b) a link with the SAME code but a different w= moves the phone to the stranger with NO question, leaking the real code there.
// Each case on its own connected phone. Lab 9730/9731; stranger on 127.0.0.1:9735.
const RP = require('../harness/paths.js');
const L = require('./lib-verify13.js'), fs = require('fs');
const pollQ = async ph => { let q = ''; for (let i = 0; i < 30; i++) { await L.sleep(500); q = await L.askText(ph); if (q) return q; } return ''; };
L.run(async () => {
  const lab = await L.startLab('04'); await L.startStranger();
  // a small benign wardrobe so the connected phone has something to clear (the switch question is only shown when local.any)
  const now = Date.parse(L.T0) - 864e5 * 2, file = RP.SCRATCH + '/kv/verify13-04-backup.json';
  fs.writeFileSync(file, JSON.stringify({ app: 'daily-wardrobe', version: 1, items: [
    { id: 'd1', type: 'suit', primaryColor: 'navy', pattern: 'solid', secondaryColor: 'none', tertiaryColor: 'none', name: 'Dana suit', added: now, updated: now },
    { id: 'd2', type: 'shirt', primaryColor: 'white', pattern: 'solid', secondaryColor: 'none', tertiaryColor: 'none', name: 'Dana shirt', added: now, updated: now }], days: [], tombstones: {} }));

  // ---- (a) new code + stranger w  ->  the switch question, stranger-controlled name, one tap wipes+switches
  const Da = await L.invite('Dana', lab.appUrl);
  const pa = await L.phone('04a');
  await pa.page.goto(Da.link); await pa.ready(); await L.sleep(3000); await L.skipSetup(pa);
  await L.restoreFile(pa, file); await L.closeSettingsUI(pa); await L.sleep(1500);
  await pa.page.goto(lab.appUrl + '#invite=' + 'Yy' + 'd'.repeat(30) + '&w=' + encodeURIComponent(L.SURL));
  const qa = await pollQ(pa);
  const nameInQuestion = /Daily Wardrobe support/.test(qa);      // the stranger's /me name steers the wording
  await pa.page.evaluate(() => { const b = document.querySelector('#ask-ok'); if (b) b.click(); }); await L.sleep(5000);
  const workerA = await pa.page.evaluate(() => localStorage.getItem('worker_url')).catch(() => null);
  const switchedA = workerA === L.SURL;

  // ---- (b) same code + different w  ->  no question, silent switch, real code leaked to the stranger
  const Db = await L.invite('Dan2', lab.appUrl);
  const pb = await L.phone('04b');
  await pb.page.goto(Db.link); await pb.ready(); await L.sleep(3000); await L.skipSetup(pb);
  L.strangerLog.length = 0;
  await pb.page.goto(lab.appUrl + '#invite=' + Db.code + '&w=' + encodeURIComponent(L.SURL));
  const qb = await pollQ(pb);
  await L.sleep(1500);
  const workerB = await pb.page.evaluate(() => localStorage.getItem('worker_url')).catch(() => null);
  const meToStranger = L.strangerLog.find(e => e.path === '/me');
  const codeHead = Db.code.slice(0, 6);

  const ok = nameInQuestion && switchedA && !qb && workerB === L.SURL && !!meToStranger && meToStranger.tok === codeHead;
  L.verdict(ok, {
    partA_question: qa || '(none)', partA_nameStrangerControlled: nameInQuestion, partA_switchedAndWiped: switchedA, partA_worker: workerA,
    partB_questionAsked: qb || '(none)', partB_switchedSilently: workerB === L.SURL, partB_worker: workerB,
    partB_realCodeSentToStranger: meToStranger ? `GET /me tok=${meToStranger.tok} (real code starts ${codeHead})` : null });
});
