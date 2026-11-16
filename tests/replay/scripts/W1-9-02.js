// W1-9-02: after one backup with the phone's clock a year AHEAD, an edit made once the clock is right reverts at every backup.
const V=require('./_v9lib.js');
V.run('W1-9-02',async(phones,link)=>{
  const ph=await V.phone('w02');phones.push(ph);
  await V.setWorldTime(ph,'2026-11-15T08:00:00+03:00');await V.joinAndSetUp(ph,link);
  await V.setWorldTime(ph,'2026-11-16T08:00:00+03:00');await V.reopen(ph);
  await ph.setTime('2027-11-16T08:00:00+03:00');await V.reopen(ph);           // phone a year ahead, server right
  await V.rename(ph,/Grey suit/,'Grey suit A');await V.sync(ph);
  await ph.setTime('2026-11-16T10:00:00+03:00');await V.reopen(ph);           // clock put right
  await V.rename(ph,/Grey suit A/,'Grey suit B');const before=(await V.names(ph)).filter(n=>/Grey suit/.test(n));
  await V.sync(ph);const after=(await V.names(ph)).filter(n=>/Grey suit/.test(n));
  await V.setWorldTime(ph,'2026-11-17T08:00:00+03:00');await V.reopen(ph);await V.sync(ph);
  const nextDay=(await V.names(ph)).filter(n=>/Grey suit/.test(n)),s=await V.server();
  const ok=before.includes('Grey suit B')&&after.includes('Grey suit A')&&nextDay.includes('Grey suit A');
  V.verdict(ok,{renamed_on_right_clock:before,after_backup:after,next_day:nextDay,server:s.items.filter(x=>/Grey suit/.test(x)),
    future_setting_stamps:Object.entries((s.settings&&s.settings.ks)||{}).filter(([k,t])=>t>Date.parse('2027-01-01')).map(([k,t])=>k+'@'+new Date(t).toISOString()),
    snap_keys:s.keys.filter(k=>/snap:/.test(k))});
});
