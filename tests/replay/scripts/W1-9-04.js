// W1-9-04: the monthly holiday refresh running while the phone's clock is a year ahead leaves next year's Kuwait holidays out
// (National Day Thu 2027-02-25 becomes a workday) until Dec 2027. Holidays are real public data (date.nager.at through the lab).
const V=require('./_v9lib.js');
const peek=ph=>ph.page.evaluate(()=>{const h=settings.holidays||{};return {country:h.country,n:(h.list||[]).length,first:(h.list||[])[0],last:(h.list||[]).slice(-1)[0],
  fetched:h.fetched&&new Date(h.fetched).toISOString(),natDay2027_workday:isWorkday(isoToDate('2027-02-25')),eid2027_workday:isWorkday(isoToDate('2027-03-10'))}});
V.run('W1-9-04',async(phones,link)=>{
  const ph=await V.phone('w04');phones.push(ph);
  await V.setWorldTime(ph,'2026-11-15T08:00:00+03:00');await V.joinAndSetUp(ph,link);
  const before=await peek(ph);
  await V.setWorldTime(ph,'2026-11-16T08:00:00+03:00');await V.reopen(ph);
  await ph.setTime('2027-11-16T08:00:00+03:00');await V.reopen(ph);await V.sleep(2000);await V.sync(ph);   // a year ahead: refresh due
  await ph.setTime('2026-11-16T10:00:00+03:00');await V.reopen(ph);await V.sync(ph);                      // clock put right
  await V.setWorldTime(ph,'2026-11-25T07:30:00+03:00');await V.reopen(ph);await V.sleep(2000);
  const after=await peek(ph);
  const ok=before.natDay2027_workday===false&&after.natDay2027_workday===true;
  V.verdict(ok,{before,after_on_2026_11_25:after});
});
