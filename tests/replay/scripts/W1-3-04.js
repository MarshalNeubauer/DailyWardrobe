// W1-3-04: after the update, a fresh phone joining the account on today's app gets the old backup's sample pieces and the
// "You're trying a sample wardrobe" banner, although today's rule is that the sample is never backed up; the backup keeps them.
const L=require('./_verify3-lib.js');
L.main(async()=>{
  const {A,link}=await L.buildLegacy('W1-3-04');await L.backup(A);
  const B=await L.open('W1-3-04-B',link);await L.skipSetup(B);await L.sleep(5000);await L.reopen(B);await L.today(B);
  const b=await B.page.evaluate(()=>({items:HOOK.items.length,sample:HOOK.items.filter(i=>i.sample).length,banner:((document.querySelector('#kit-sample')||{}).innerText||'').split('\n')[0]}));
  await L.backup(B);await L.later(A);await L.sleep(1500);
  const bk=await L.serverBackup();const srvSample=bk.items.filter(i=>i.sample).length;
  const ok=b.sample>0&&/sample wardrobe/i.test(b.banner)&&srvSample>0;
  await L.finish(ok,{phoneB:b,serverSampleAfter:srvSample,serverItems:bk.items.length});
});
