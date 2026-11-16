// W1-9-08: two phones on one account, phone A's clock 10 minutes fast. A renames at real 08:02, B (right clock) renames the same
// suit at real 08:05; after both back up, A's earlier rename wins on both phones and the server, with no message.
const V=require('./_v9lib.js');
V.run('W1-9-08',async(phones,link)=>{
  const a=await V.phone('w08a');phones.push(a);
  await V.setWorldTime(a,'2026-11-16T07:50:00+03:00');await V.joinAndSetUp(a,link);
  const own=await a.page.evaluate(()=>location.origin+location.pathname+'#invite='+localStorage.app_token+'&w='+encodeURIComponent(localStorage.worker_url));
  const b=await V.phone('w08b');phones.push(b);
  await b.setTime('2026-11-16T07:55:00+03:00');await b.page.goto(own);await b.ready();await V.sleep(5000);await V.guard(b);
  for(let i=0;i<12&&await V.vis(b,'#su-next');i++){await b.tap('#su-next');await V.sleep(600)}
  await V.reopen(b);
  const bHas=(await V.names(b)).filter(n=>/Charcoal/.test(n));
  await V.mock('clock',{at:'2026-11-16T05:02:00Z'});
  await a.setTime('2026-11-16T08:12:00+03:00');                         // real 08:02, A 10 minutes fast
  await V.rename(a,/Charcoal suit/,'Charcoal (A, 08:02)');await V.sync(a);
  await V.setWorldTime(b,'2026-11-16T08:05:00+03:00');await V.reopen(b);   // real 08:05, B right
  await V.rename(b,/Charcoal/,'Charcoal (B, 08:05)');const bBefore=(await V.names(b)).filter(n=>/Charcoal/.test(n));
  await V.sync(b);const bAfter=(await V.names(b)).filter(n=>/Charcoal/.test(n));
  await a.setTime('2026-11-16T08:17:00+03:00');await V.reopen(a);await V.sync(a);
  const aEnd=(await V.names(a)).filter(n=>/Charcoal/.test(n)),srv=(await V.server()).items.filter(x=>/Charcoal/.test(x));
  const ok=bBefore.includes('Charcoal (B, 08:05)')&&bAfter.includes('Charcoal (A, 08:02)')&&aEnd.includes('Charcoal (A, 08:02)')&&srv.some(x=>/\(A, 08:02\)/.test(x));
  V.verdict(ok,{b_joined_with:bHas,b_before_backup:bBefore,b_after_backup:bAfter,a_end:aEnd,server:srv});
});
