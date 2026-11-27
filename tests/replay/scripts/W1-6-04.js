// W1-6-04: "Remove the sample" on phone B (which tried the sample, then joined A's account) wipes A's real outfit record for a past day.
const L=require('./_verify6-lib.js');
L.main(async()=>{
  await L.startLab('W1-6-04','2026-11-15T09:00:00+03:00');   // Sunday 15 Nov, a Kuwait workday
  const link=await L.newInvite('v6-04');
  const A=await L.open('04-A',link);await L.importRows(A);await L.backup(A);
  // A: Today "✓ Wore" -> "✕ Didn't", backed up
  await A.tap('#n-today');await L.sleep(800);await A.tap('#wpill');await L.sleep(1000);await L.backup(A);
  const rec=ph=>ph.page.evaluate(()=>{const r=HOOK.dayRecs['2026-11-15'];const nm=id=>{const i=HOOK.items.find(x=>x.id===id);return i?(i.name||i.type):id};
    return r?{ids:r.ids?Object.values(r.ids).filter(Boolean).map(nm):null,worn:r.worn,noOutfit:r.noOutfit||0}:null});
  const a0=await rec(A);L.log('A 15th recorded',a0);
  // B: a new phone, not connected: Skip, Try a sample wardrobe
  await L.sleep(1500);const B=await L.open('04-B');await B.tap('#kit-sample-link');await L.sleep(3000);
  L.log('B items with sample',(await L.names(B)).length,'B 15th',await rec(B));
  // next morning for both phones and the server
  const d2='2026-11-16T08:00:00+03:00';await L.setServerTime(d2);await A.setTime(d2);await B.setTime(d2);
  await A.reopen(L.APP);await A.ready();await B.reopen(L.APP);await B.ready();await L.sleep(2500);
  // B opens the invitation link (connects; the sample stays)
  await B.page.goto(link);await L.sleep(6000);await L.checkWorker(B);await L.backup(B);await L.later(A);
  const a1=await rec(A);L.log('B items after join',(await L.names(B)).length,'A 15th after B joined',a1);
  // B: Today -> Remove the sample -> Remove
  await B.tap('#n-today');await L.sleep(800);await L.tapText(B,'Remove the sample','#kit-sample');await L.confirmDialog(B,/^Remove$/);await L.sleep(2500);
  await L.backup(B);await L.later(A);
  const a2=await rec(A);L.log('B items after remove',(await L.names(B)).length,'A 15th after B removed the sample',a2);
  const srv=JSON.stringify(await L.kv());
  const ok=a0&&a0.worn===false&&a1&&a1.worn===false&&a2&&a2.noOutfit&&a2.worn!==false;
  await L.finish(ok,{before:a0,afterJoin:a1,afterRemove:a2,serverMentionsNoOutfit:srv.includes('noOutfit')});
});
