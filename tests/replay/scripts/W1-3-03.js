// W1-3-03: after the update, phone A uses the app on Sun 8 Nov (outfit of sample pieces, record not uploaded: W1-3-02);
// a new phone C joining on Mon 9 is told "A past workday you didn't open the app (Sun, Nov 8) was counted as worn".
const L=require('./_verify3-lib.js');
L.main(async()=>{
  const {A,link}=await L.buildLegacy('W1-3-03');
  await L.today(A);const k=await L.todayKey(A);await L.backup(A);await L.later(A);
  const aRec=await A.page.evaluate(k=>{const r=HOOK.dayRecs[k];return r?{ids:!!r.ids,auto:!!r.auto}:null},k);
  const s=L.dayOf(await L.serverBackup(),k);
  await A.kill();
  await L.setServerTime('2026-11-09T08:00:00+03:00');
  const C=await L.P.openPhone({profile:'verify3-W1-3-03-C',fresh:true,time:L.worldNow()});L.phones.push(C);await L.recordToasts(C);
  await C.page.goto(link);await C.ready();await L.sleep(4000);await L.checkWorker(C);await L.skipSetup(C);await L.sleep(12000);
  const toasts=await C.page.evaluate(()=>window.__toasts||[]);
  const missed=toasts.find(t=>/didn.t open the app/.test(t))||'';
  const card=await C.page.evaluate(()=>!!document.querySelector('#missbox'));
  const ok=aRec&&aRec.ids&&!aRec.auto&&s&&!s.ids&&/Nov 8/.test(missed);
  await L.finish(ok,{day:k,phoneArecord:aRec,serverRecord:s&&{ids:!!s.ids,lock:!!s.lock},Ctoast:missed,allToasts:toasts,missedCard:card});
});
