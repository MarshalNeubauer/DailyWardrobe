// W1-9-05: a wardrobe set up and imported while the phone's clock is a year ahead counts no wear after the clock is put right
// (Insights 0, cleaning never counts), vs a control phone (own account) set up on the right clock and used the same mornings.
const V=require('./_v9lib.js');
const invite=async name=>{const r=await fetch(V.W+'invites',{method:'POST',headers:{'x-app-token':'owner-secret','content-type':'application/json'},body:JSON.stringify({name})});
  const j=await r.json();return `${V.APP}#invite=${j.code||(j.invite&&j.invite.code)}&w=${encodeURIComponent(V.W)}`};
const peek=ph=>ph.page.evaluate(()=>({worn:wornDays().length,planStart:planStartDay()&&isoKey(planStartDay()),records:Object.keys(dayRecs).length}));
V.run('W1-9-05',async(phones,link)=>{
  await V.mock('clock',{at:'2026-11-15T06:00:00Z'});
  const a=await V.phone('w05a'),c=await V.phone('w05ctl');phones.push(a,c);
  await a.setTime('2027-11-15T08:00:00+03:00');await V.joinAndSetUp(a,await invite('w05a'));     // phone a year ahead during setup
  await c.setTime('2026-11-15T09:00:00+03:00');await V.joinAndSetUp(c,await invite('w05ctl'));   // control, right clock
  for(const d of ['16','17','18']){const t=`2026-11-${d}T07:30:00+03:00`;await V.setWorldTime(a,t);await c.setTime(t);await V.reopen(a);await V.reopen(c)}
  const pa=await peek(a),pc=await peek(c);
  const ins=async ph=>{await ph.tap('#n-stats');await V.sleep(5000);return (await ph.page.evaluate(()=>document.querySelector('#stats')?document.querySelector('#stats').innerText:document.body.innerText)).replace(/\s+/g,' ').slice(0,260)};
  const ia=await ins(a),ic=await ins(c);
  const ok=pa.worn===0&&pc.worn>0&&pa.planStart>='2027';
  V.verdict(ok,{ahead_phone:pa,control:pc,insights_ahead:ia,insights_control:ic});
});
