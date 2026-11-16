// W1-8-05: two of four suits at the cleaner's while the week locks; "It's back" doesn't release the locks.
// careSend / careBack are called through page.evaluate (the same calls the Care page's buttons make), to save driving the Care list.
// #472 locks only today through Friday, so the suits are sent on Sun 13 Dec, when the Sun-Thu week is locked (written for aa24910's
// 7-day lock: sent Wed 9, back Sun 13, read Mon 14 over Sun-Wed); now "It's back" is Mon 14 and the repeat is read on Tue 15 over Mon-Thu.
const RP = require('../harness/paths.js');
const V=require('./_verify8-lib.js');const fs=require('fs');
const TSV=fs.readFileSync(RP.FIX + '/agent8-wardrobe.tsv','utf8').trim();
V.run('W1-8-05',async(phones)=>{
  const ph=await V.phone('care');phones.push(ph);
  const plan=(ks)=>ph.page.evaluate(ks=>{const nm=id=>{const i=items.find(x=>x.id===id);return i?itemTitle(i):id?'?'+id.slice(0,4):null};const out={};
    for(const k of ks){const [y,m,d]=k.split('-').map(Number),o=planMonth(y,m-1)[k],r=dayRecs[k];
      out[k]={top:o&&o.top&&itemTitle(o.top),lock:r&&r.lock?nm(r.lock.top):null,worn:r&&r.worn}}return out},ks);
  const days=['2026-12-9','2026-12-10','2026-12-13','2026-12-14','2026-12-15','2026-12-16','2026-12-17'];
  await V.setWorldTime(ph,V.PORT,'2026-11-29T07:30:00+03:00');await ph.page.goto(V.URL);await ph.ready();await V.sleep(1200);
  await ph.tapText(/^Skip$/,'#setup button');await V.sleep(1000);
  await ph.tapText(/^Wardrobe$/,'nav button');await ph.tap('#ward-add');await V.sleep(700);await ph.tapText(/Import from a spreadsheet/);
  await ph.page.fill('#kit-paste',TSV);await ph.page.dispatchEvent('#kit-paste','input');await V.sleep(800);
  await ph.tapText(/^Add \d+ items?/,'#kitsheet button');await V.sleep(2000);await ph.tapText(/^Today$/,'nav button');await V.sleep(1200);await ph.guard();
  console.log('settings',await ph.page.evaluate(()=>({wd:settings.workdays,n:items.length,suits:items.filter(i=>i.type==='suit').map(itemTitle)})));
  // open every workday morning until Sun 13 Dec (the week Sun 13 - Thu 17 locks)
  for(const d of ['2026-11-30','2026-12-01','2026-12-02','2026-12-03','2026-12-06','2026-12-07','2026-12-08','2026-12-09','2026-12-10','2026-12-13']){
    await V.setWorldTime(ph,V.PORT,d+'T07:30:00+03:00');await ph.reopen(V.URL);await ph.ready();await V.sleep(1800)}
  console.log('Dec 13 before sending:',JSON.stringify(await plan(days)));
  // send the two suits that the next days' locks hold (not today's) to the cleaner
  const sent=await ph.page.evaluate(async()=>{const T=todayDate(),tk=key(T),todayTop=planFor()[tk].top.id;const ids=[];
    for(const r of Object.values(dayRecs).sort((a,b)=>keyDate(a.date)-keyDate(b.date)))if(keyDate(r.date)>T&&r.lock&&r.lock.top&&r.lock.top!==todayTop&&!ids.includes(r.lock.top)&&items.find(i=>i.id===r.lock.top).type==='suit')ids.push(r.lock.top);
    const pick=ids.slice(0,2);for(const id of pick)await careSend(id,'cleaner');return pick.map(id=>itemTitle(items.find(i=>i.id===id)))});
  console.log('sent to cleaner:',sent);await V.sleep(800);
  console.log('Dec 13 after sending:',JSON.stringify(await plan(days)));
  await V.setWorldTime(ph,V.PORT,'2026-12-14T07:30:00+03:00');await ph.reopen(V.URL);await ph.ready();await V.sleep(1800);
  const before=await plan(days);console.log('Dec 14 open, before back:',JSON.stringify(before));
  await ph.page.evaluate(async()=>{for(const i of items.filter(x=>x.away))await careBack(i.id)});await V.sleep(800);
  await ph.tapText(/^Today$/,'nav button').catch(()=>{});await V.sleep(1000);
  const after=await plan(days);console.log('Dec 14 after "It\'s back":',JSON.stringify(after));
  await V.setWorldTime(ph,V.PORT,'2026-12-15T07:30:00+03:00');await ph.reopen(V.URL);await ph.ready();await V.sleep(1800);
  const d14=await plan(days);console.log('Dec 15 open:',JSON.stringify(d14));
  const wd=['2026-12-14','2026-12-15','2026-12-16','2026-12-17'];
  const repeat=wd.slice(1).some((k,i)=>d14[k].top&&d14[k].top===d14[wd[i]].top);
  const unchanged=JSON.stringify(before)===JSON.stringify(after);const usedSent=wd.slice(1).some(k=>sent.includes(d14[k].top));
  V.verdict(repeat&&unchanged,{sent,locksUnchangedByItsBack:unchanged,repeatTwoWorkdaysRunning:repeat,returnedSuitUsedMonToThu:usedSent});
});
