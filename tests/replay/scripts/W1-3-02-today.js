// W1-3-02, extra check: a user who never had an old version. Today's app only: a connected phone loads the sample and marks today
// "Didn't" (1) with the outfit still made of untouched sample pieces, then (2) after editing every piece of that outfit in the item sheet
// (which makes them his: sampleMine). Prints what reached the server each time. Prints REPRODUCED when (1) is held back and (2) goes up.
const L=require('./_verify3-lib.js');
L.main(async()=>{
  const info=await L.startLab('W1-3-02-today',L.NEW,'2026-11-15T08:00:00+03:00');
  const A=await L.open('W1-3-02t-A',info.inviteLink);await L.skipSetup(A);await L.sleep(1500);await L.today(A);
  await A.tap('#kit-sample-link');for(let i=0;i<40&&await A.page.evaluate(()=>items.length)<24;i++)await L.sleep(250);await L.sleep(2000);
  await L.backup(A);const k=await L.todayKey(A);
  const look=()=>A.page.evaluate(k=>{const r=dayRecs[k]||{};const off=new Set(items.filter(i=>!HOOK.kitSends(i)).map(i=>i.id));
    const ids=[...new Set([r.ids,r.lock,r.force].flatMap(o=>o?Object.values(o):[]).filter(Boolean))];
    return {worn:r.worn,ids,unowned:ids.filter(v=>off.has(v)).length}},k);
  // (1) untouched sample outfit
  await A.tap('#wpill');await L.sleep(1000);const r1=await look();await L.backup(A);await L.later(A);
  const s1=L.dayOf(await L.serverBackup(),k);
  // (2) every piece of the day edited in the item sheet (brand), then marked again
  for(const id of r1.ids){await L.openItemId(A,id);await L.setField(A,'brand','Mine');await L.done(A)}
  await L.today(A);await A.tap('#wpill');await L.sleep(800);await A.tap('#wpill');await L.sleep(1000);
  const r2=await look();await L.backup(A);await L.later(A);
  const bk=await L.serverBackup(),s2=L.dayOf(bk,k);
  const ok=r1.unowned>0&&(!s1||s1.worn!==false)&&r2.unowned===0&&r2.worn===false&&s2&&s2.worn===false;
  await L.finish(ok,{day:k,untouched:{phone:r1,server:s1&&{worn:s1.worn}},afterEditing:{phone:r2,server:s2&&{worn:s2.worn}},serverItems:bk.items.length,serverSample:bk.items.filter(i=>i.sample).length});
});
