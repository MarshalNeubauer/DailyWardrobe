// W1-6-06: B, offline with the sheet of "Blazer copy" open, edits it after A rolled back to a copy without it; when B syncs the piece
// comes back on both phones and the server (14 pieces after a roll back to 13).
const L=require('./_verify6-lib.js');
let A,B;
async function tick(ms){const t=Math.max(A.now(),B.now())+ms;await A.setTime(t);await B.setTime(t);await L.setServerTime(t)}
async function rollBack(ph,date){
  await ph.page.evaluate(()=>openSettings());await L.sleep(900);
  if(await ph.page.evaluate(()=>document.querySelector('#sc-backup .scat-head').getAttribute('aria-expanded'))!=='true'){await ph.page.evaluate(()=>document.querySelector('#sc-backup .scat-head').scrollIntoView({block:'center'}));await ph.tap('#sc-backup .scat-head');await L.sleep(2500)}
  const opts=await ph.page.evaluate(()=>[...document.querySelectorAll('#snap-list option')].map(o=>[o.value,o.textContent]));
  const v=(opts.find(o=>o[0]===date)||[])[0];if(!v)throw new Error('no copy '+date+' in '+JSON.stringify(opts));
  await ph.page.selectOption('#snap-list',v);await L.sleep(300);await ph.tap('#snap-btn');await L.sleep(800);await L.confirmDialog(ph,/^Roll back$/);await L.sleep(5000);
  return ph.page.evaluate(()=>document.querySelector('#snap-status').textContent)}
L.main(async()=>{
  await L.startLab('W1-6-06','2026-11-15T09:00:00+03:00');
  const link=await L.newInvite('v6-06');
  A=await L.open('06-A',link);await L.importRows(A);await L.backup(A);
  B=await L.open('06-B',link);await L.sleep(2500);
  // next morning for everyone
  const d2='2026-11-16T07:30:00+03:00';await L.setServerTime(d2);await A.setTime(d2);await B.setTime(d2);
  await A.reopen(L.APP);await A.ready();await B.reopen(L.APP);await B.ready();await L.sleep(3000);
  await L.rename(B,'Black belt','Black belt B');await L.backup(B);   // day 2's first change: the server keeps the 2026-11-16 copy (13 pieces)
  await L.openItem(A,'Blue blazer');await L.tapText(A,'Duplicate this item');await L.sleep(800);
  let i=L.nameInput(A);await i.fill('Blazer copy');await i.press('Tab');await L.done(A);await L.backup(A);
  await tick(70000);await L.backup(B);
  const b0=(await L.names(B)).length;
  // B offline: renames Blue shirt, opens the sheet of Blazer copy and leaves it open
  await B.ctx.setOffline(true);await L.rename(B,'Blue shirt','Blue shirt OFFLINE');await L.openItem(B,'Blazer copy');
  await tick(20000);
  const said=await rollBack(A,'2026-11-16');const a1=await L.names(A);
  // B, still offline, edits the open sheet, Done; back online
  i=L.nameInput(B);await i.fill('Blazer copy edited');await i.press('Tab');await L.done(B);
  await B.ctx.setOffline(false);await B.page.evaluate(()=>dispatchEvent(new Event('online')));await L.sleep(1000);
  await tick(70000);await L.backup(B);await L.sleep(1500);await tick(70000);await L.backup(A);
  const a2=await L.names(A),b2=await L.names(B),srv=JSON.stringify(await L.kv());
  L.log('B before',b0,'roll back said',said,'A after roll back',a1.length,'A after B synced',a2,'B',b2.length);
  await L.finish(b0===14&&a1.length===13&&a2.includes('Blazer copy edited')&&srv.includes('Blazer copy edited'),{afterRollBack:a1.length,aAfterBSync:a2.length,bAfter:b2.length,blueShirtOfflineRenameKept:a2.includes('Blue shirt OFFLINE')});
});
