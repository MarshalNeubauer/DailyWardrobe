// W1-9-06: a "backups used up" pause set while the phone's clock is a year ahead lasts until that future date: after the clock is
// right and the server's allowance is back, edits on later days are not backed up, and Settings says "Paused until tomorrow".
const V=require('./_v9lib.js');
const st=ph=>ph.page.evaluate(()=>({pause:+localStorage.getItem('sync_pause')?new Date(+localStorage.getItem('sync_pause')).toISOString():null,status:localStorage.getItem('sync_status')}));
const blazer=async()=>(await V.server()).items.filter(x=>/lazer/i.test(x));
V.run('W1-9-06',async(phones,link)=>{
  const ph=await V.phone('w06');phones.push(ph);
  await V.setWorldTime(ph,'2026-11-15T08:00:00+03:00');await V.joinAndSetUp(ph,link);
  await V.setWorldTime(ph,'2026-11-16T08:00:00+03:00');await V.reopen(ph);await V.sync(ph);
  await ph.setTime('2027-11-16T08:00:00+03:00');await V.reopen(ph);
  await V.mock('kv-limit',{perDay:1});
  await V.rename(ph,/Navy blazer/,'Blazer one');await V.sync(ph);
  await V.rename(ph,/Blazer one/,'Blazer two');await V.sync(ph);
  const ahead=await st(ph);
  await V.mock('reset',{});
  await V.setWorldTime(ph,'2026-11-17T08:00:00+03:00');await V.reopen(ph);
  await V.rename(ph,/Blazer/,'Blazer three');await V.sync(ph);
  const d17=await st(ph),srv17=await blazer();
  await ph.tap('.hgear');await V.sleep(1200);
  const line=(await ph.page.evaluate(()=>document.body.innerText)).split('\n').find(l=>/Paused until|Backed up|last saved/.test(l))||'';
  await V.setWorldTime(ph,'2026-11-19T08:00:00+03:00');await V.reopen(ph);await V.sync(ph);
  const srv19=await blazer();
  const ok=!!ahead.pause&&ahead.pause.startsWith('2027')&&!!d17.pause&&!srv17.some(x=>/three/.test(x))&&!srv19.some(x=>/three/.test(x));
  V.verdict(ok,{while_ahead:ahead,on_nov17:d17,server_nov17:srv17,settings_line:line,server_nov19:srv19});
});
