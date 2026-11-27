// W1-6-05: "Take them out" on phone A (stale, not synced since B renamed an imported piece) deletes B's renamed piece everywhere,
// although the question says pieces changed since stay.
const L=require('./_verify6-lib.js');
L.main(async()=>{
  await L.startLab('W1-6-05','2026-11-15T09:00:00+03:00');
  const link=await L.newInvite('v6-05');
  const A=await L.open('05-A',link);await L.importRows(A);await L.backup(A);
  const B=await L.open('05-B',link);await L.sleep(2500);
  await L.sleep(21000);   // the import's Undo toast (20 s) has gone
  await L.rename(B,'Green tie','Green tie (gift)');await L.backup(B);
  const srvRename=JSON.stringify(await L.kv()).includes('Green tie (gift)');
  // A, open all along: Add -> Import from a spreadsheet -> Take them out
  await L.openImport(A);
  const line=await A.page.evaluate(()=>(document.querySelector('#kit-last')||{}).innerText||null);
  await L.tapText(A,/^Take (them|it) out$/,'#kit-last');
  // the question comes once it is up with its real text (since the fix round "Take them out" syncs first, so it shows later)
  await A.page.waitForFunction(()=>{const t=document.querySelector('#ask-title'),ok=document.querySelector('#ask-ok');return !!t&&t.textContent.trim().length>0&&!!ok&&ok.getBoundingClientRect().height>0},null,{timeout:30000});await L.sleep(400);
  const q=await A.page.evaluate(()=>{const t=document.querySelector('#ask-title');return t?t.parentElement.innerText:''});
  await L.confirmDialog(A,/^Take them out$/);await L.sleep(1000);
  const aAfter=await L.names(A);
  await A.page.evaluate(()=>'kitClose' in HOOK&&HOOK.kitClose()).catch(()=>{});await L.backup(A);
  await L.later(B);await L.sleep(1500);
  const bAfter=await L.names(B);
  L.log('server had rename',srvRename,'A line',line,'question',q.replace(/\s+/g,' '),'A after',aAfter,'B after',bAfter);
  const gone=!bAfter.some(n=>/Green tie/.test(n));
  await L.finish(srvRename&&/13 items/.test(line||'')&&gone,{line,question:q.replace(/\s+/g,' '),bItemsAfter:bAfter});
});
