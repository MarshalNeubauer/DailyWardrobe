// W1-3-02: after updating from 15 Nov a (whose backup holds the sample), a day whose outfit names a sample piece is never backed up:
// phone A marks today "Didn't", the server keeps its old record, phone B shows "Wore", and A's Settings say it is backed up.
// The verdict is the server's record (A's Didn't never reaches it) and A's own state; B's pill is evidence only (since the W1-3-04 fix B
// gets no sample pieces, so its view of the day can differ). "Remove the sample" on B (overlap with W1-6-04) runs only when B has them.
const L=require('./_verify3-lib.js');
L.main(async()=>{
  const {A,link}=await L.buildLegacy('W1-3-02');
  const B=await L.open('W1-3-02-B',link);await L.skipSetup(B);await L.sleep(4000);await L.today(B);
  await L.today(A);const k=await L.todayKey(A);
  const srv0=L.dayOf(await L.serverBackup(),k);
  await A.tap('#wpill');await L.sleep(1000);const aPill=await L.pill(A);
  const rec=await A.page.evaluate(k=>{const r=dayRecs[k];const off=new Set(items.filter(i=>!HOOK.kitSends(i)).map(i=>i.id));
    return {worn:r&&r.worn,updated:r&&r.updated,namesSample:!!r&&[r.ids,r.lock,r.force].some(o=>o&&Object.values(o).some(v=>off.has(v)))}},k);
  await L.backup(A);await L.later(A);await L.sleep(1500);
  const srv1=L.dayOf(await L.serverBackup(),k);
  await A.tap('header button:has(svg.hgear)').catch(async()=>{await A.page.evaluate(()=>openSettings())});await L.sleep(1000);
  const status=await A.page.evaluate(()=>({summary:(document.querySelector('#sum-backup')||{}).textContent||'',sync:(document.querySelector('#sync-status')||{}).textContent||''}));
  await A.page.keyboard.press('Escape');await L.sleep(600);
  await L.later(B);await L.reopen(B);await L.today(B);const bPill=await L.pill(B);
  const ok=aPill&&/Didn/.test(aPill)&&rec.namesSample&&srv1&&srv1.worn!==false&&(srv1.updated||0)===((srv0&&srv0.updated)||0)&&/Backed up/i.test(status.summary+status.sync);
  // overlap with W1-6-04: B removes the sample; does A's "Didn't" survive?
  let aAfter='B has no sample to remove';if(await B.page.evaluate(()=>items.filter(i=>i.sample).length)){
  await L.today(B);await L.tapText(B,'Remove the sample','#kit-sample');await B.tap('#ask-ok');await L.sleep(4000);await L.backup(B);
  await L.later(A);await L.reopen(A);
  aAfter=await A.page.evaluate(k=>{const r=dayRecs[k];return r?{worn:r.worn,ids:!!r.ids,noOutfit:r.noOutfit||0}:null},k)}
  await L.finish(ok,{day:k,phoneA:{pill:aPill,rec},serverBefore:srv0&&{worn:srv0.worn,updated:srv0.updated},serverAfter:srv1&&{worn:srv1.worn,updated:srv1.updated},
    phoneBpill:bPill,aSettings:status,extra_afterBRemovesSample_A_day:aAfter});
});
