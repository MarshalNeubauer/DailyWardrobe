// W1-8-01: a past public holiday becomes a "worn" workday once the monthly holiday refresh drops it from the list.
// Kuwait phone, not connected. Clock: 27 Dec 2026 -> 6 Jan 2027 -> 8 Feb 2027 (07:30 Kuwait). Jan 5 2027 = Isra and Mi'raj.
const V=require('./_verify8-lib.js');
V.run('W1-8-01',async(phones)=>{
  const ph=await V.phone('hol');phones.push(ph);
  const look=()=>ph.page.evaluate(()=>{const h=settings.holidays||{},r=dayRecs['2027-1-5'];return {
    country:h.country,listFirst:(h.list||[])[0],jan5InList:(h.list||[]).some(x=>x.d==='2027-01-05'),
    jan5off:offName(new Date(2027,0,5)),jan5rec:r?{auto:!!r.auto,ids:!!r.ids,worn:r.worn}:null,jan5worn:wornDays().some(w=>w.date==='2027-1-5')}});
  await V.setWorldTime(ph,V.PORT,'2026-12-27T07:30:00+03:00');await ph.page.goto(V.URL);await ph.ready();await V.sleep(1500);
  await ph.tapText(/^Skip$/,'#setup button');await V.sleep(1200);await ph.tapText(/Try a sample wardrobe/);await V.sleep(2500);await ph.guard();
  const s1=await look();
  await V.setWorldTime(ph,V.PORT,'2027-01-06T07:30:00+03:00');await ph.reopen(V.URL);await ph.ready();await V.sleep(3500);
  const s2=await look();
  await V.setWorldTime(ph,V.PORT,'2027-02-08T07:30:00+03:00');await ph.reopen(V.URL);await ph.ready();await V.sleep(5000);
  const s3=await look(),toast=await ph.toast(),card=await ph.page.evaluate(()=>{const m=document.querySelector('#missbox');return m?m.innerText:''});
  await ph.guard();
  const ok=s2.jan5off&&!s2.jan5rec&&!s3.jan5off&&s3.jan5rec&&s3.jan5rec.auto&&s3.jan5rec.ids&&s3.jan5worn;
  V.verdict(!!ok,{dec27:s1,jan6:s2,feb8:s3,toast,card});
});
