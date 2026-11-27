// W1-9-03: opening Today once with the phone's clock a year ahead records the skipped workdays as worn and backs them up.
const V=require('./_v9lib.js');
V.run('W1-9-03',async(phones,link)=>{
  const ph=await V.phone('w03');phones.push(ph);
  await V.setWorldTime(ph,'2026-11-15T08:00:00+03:00');await V.joinAndSetUp(ph,link);
  await V.setWorldTime(ph,'2026-11-16T08:00:00+03:00');await V.reopen(ph);
  await ph.setTime('2027-11-16T08:00:00+03:00');await ph.reopen(V.APP);await ph.ready();
  let toast='';for(let i=0;i<20&&!/counted as worn/.test(toast);i++){await V.sleep(500);toast=await ph.page.evaluate(()=>{const t=document.querySelector('#toast');return t?t.innerText:''})}
  await V.sleep(1500);const card=await ph.page.evaluate(()=>{const c=document.querySelector('#missbox');return c?c.innerText:''});
  const auto=await ph.page.evaluate(()=>Object.values(HOOK.dayRecs).filter(r=>r.auto&&r.ids&&r.date>='2027').map(r=>r.date));
  await V.sync(ph);await ph.setTime('2026-11-16T10:00:00+03:00');await V.reopen(ph);await V.sync(ph);
  const s=await V.server(),srv2027=s.days.filter(d=>d.auto&&String(d.date)>='2027').map(d=>d.date);
  const kept=await ph.page.evaluate(()=>Object.values(HOOK.dayRecs).filter(r=>r.auto&&r.date>='2027').length);
  const ok=/counted as worn/.test(toast)&&auto.length>20&&srv2027.length>20&&kept>20;
  V.verdict(ok,{toast,card,auto_records_2027:auto.length,first:auto.sort()[0],server_auto_2027:srv2027.length,kept_on_phone_after_clock_fixed:kept});
});
