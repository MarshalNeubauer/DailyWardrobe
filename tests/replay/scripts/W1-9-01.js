// W1-9-01: phone clock a year BEHIND (server right): a rename and a deletion are undone by the next backup, silently.
const V=require('./_v9lib.js');
V.run('W1-9-01',async(phones,link)=>{
  const ph=await V.phone('w01');phones.push(ph);
  await V.setWorldTime(ph,'2026-11-15T08:00:00+03:00');await V.joinAndSetUp(ph,link);
  await V.setWorldTime(ph,'2026-11-16T08:00:00+03:00');await V.reopen(ph);await V.sync(ph);
  await ph.setTime('2025-11-16T08:00:00+03:00');await V.reopen(ph);          // phone a year behind, server still 2026-11-16
  await V.rename(ph,/Navy suit/,'Navy suit EDITED');await V.delItem(ph,/pink/i);
  const before=await V.names(ph);
  await V.sync(ph);
  const after=await V.names(ph),s=await V.server(),status=await ph.page.evaluate(()=>localStorage.getItem('sync_status'));
  const toastTxt=await ph.page.evaluate(()=>{const t=document.querySelector('#toast');return t&&t.classList.contains('on')?t.innerText:''});
  const ok=before.includes('Navy suit EDITED')&&!before.some(n=>/pink/i.test(n))&&after.includes('Navy suit')&&!after.includes('Navy suit EDITED')&&after.some(n=>/pink/i.test(n))&&!Object.keys(s.tomb).length;
  V.verdict(ok,{before_sync:before.filter(n=>/suit|pink/i.test(n)),after_sync:after.filter(n=>/suit|pink/i.test(n)),server_navy:s.items.filter(x=>/Navy suit/.test(x)),server_tombstones:s.tomb,sync_status:status,toast:toastTxt});
});
