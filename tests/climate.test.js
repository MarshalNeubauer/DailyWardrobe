// Days beyond the 16-day forecast are planned from the location's usual weather (Open-Meteo archive, mocked), not from a
// temperate calendar: in a hot climate December is not "cold" (no overcoat warning) and April is already warm.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({locale:'en-US'});
  // two years of daily highs like Kuwait's: 19°C in January, 46°C in July
  const TMAX=[19,19,25,34,41,44,46,45,42,36,28,20],time=[],tmax=[],tmin=[],rain=[];let calls=0,lastUrl='';
  for(const y of [2024,2025])for(let m=0;m<12;m++)for(let d=1;d<=28;d++){time.push(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);tmax.push(TMAX[m]);tmin.push(TMAX[m]-10);rain.push(m===11&&d<=7?3:0)}
  await ctx.route('https://archive-api.open-meteo.com/**',r=>{calls++;lastUrl=r.request().url();r.fulfill({contentType:'application/json',body:JSON.stringify({daily:{time,temperature_2m_max:tmax,temperature_2m_min:tmin,precipitation_sum:rain}})})});
  await ctx.route('https://api.open-meteo.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({daily:{time:['2026-11-15'],temperature_2m_max:[27],temperature_2m_min:[17],precipitation_probability_max:[0],precipitation_sum:[0],weather_code:[0]}})}));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='auto';dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,15);view={y:2026,m:10}});
    // before a location is set: the calendar decides, so mid-January is "cold" and warns about the missing overcoat
    const cal=await p.evaluate(()=>{const o=planMonth(2027,0)['2027-1-12'];return {season:o.clim.season,note:(o.notes||[]).some(n=>/overcoat/.test(n))}});
    ok(cal.season==='cold'&&cal.note,'without climate history, January follows the calendar: cold, and a missing overcoat is flagged');
    await p.evaluate(()=>setLocation({lat:29.31,lon:48.01,name:'Kuwait City'}));await p.waitForFunction(()=>!!climate&&!!weather['2026-11-15'],null,{timeout:8000});   // both the climate history and the forecast have arrived
    ok(calls===1&&/start_date=\d{4}-01-01&end_date=\d{4}-12-31/.test(lastUrl)&&/latitude=29.31/.test(lastUrl),`the usual weather for the location is fetched once (${lastUrl.split('?')[1]||''})`);
    const k=await p.evaluate(()=>{const g=(y,m,d)=>planMonth(y,m)[y+'-'+(m+1)+'-'+d];const jan=g(2027,0,12),apr=g(2027,3,13),jul=g(2027,6,13),tom=g(2026,10,15);
      return {jan:jan.clim.season,janNote:(jan.notes||[]).some(n=>/overcoat/.test(n)),janVest:jan.vest,apr:apr.clim.season,jul:jul.clim.season,julVest:jul.vest,fc:!!tom.clim.wx,n:climate.length,jt:climate[0].tmax,
        notes:Object.entries(planMonth(2027,1)).filter(([d,o])=>keyDate(d)>todayDate()&&(o.notes||[]).some(n=>/overcoat/.test(n))).length}});
    ok(k.n===12&&k.jt===19,'it is averaged per month (January highs 19°C)');
    ok(k.jan==='mild'&&!k.janNote&&k.notes===0,`in a hot climate January is mild: no overcoat warnings through February (${k.jan}, ${k.notes} warnings)`);
    ok(k.apr==='warm'&&k.jul==='warm'&&k.janVest&&!k.julVest,`April is already warm there (${k.apr}); the vest comes off for the hot months and stays on in January`);
    ok(k.fc,'days inside the forecast still use the forecast');
    // kept on the device: a reload does not fetch it again; Settings says what is used
    await p.evaluate(()=>saveUserSettings());await p.reload();await p.waitForFunction(()=>window.appReady&&!!climate,null,{timeout:8000});
    ok(calls===1,'the climate history is kept on the device (no second download after a reload)');
    await p.evaluate(()=>openSettings('weather'));
    ok(/usual weather there/.test(await p.textContent('#wx-loc'))&&/66°.*115°/.test(await p.textContent('#wx-loc')),`Settings says days beyond the forecast use the usual weather (${await p.textContent('#wx-loc')})`);
    // another location: fetched again for the new place
    await p.evaluate(()=>setLocation({lat:51.5,lon:-0.12,name:'London'}));for(let t=0;t<250&&calls<2;t++)await p.waitForTimeout(20);
    await p.waitForFunction(()=>Array.isArray(climate)&&climate.length===12,null,{timeout:5000}).catch(()=>{});   // the request is made before its answer fills the climate in
    ok(calls===2,'changing the location fetches that place\'s climate');
    // the what-to-buy analysis plans with it too
    const pay=await p.evaluate(()=>{let sent=null;const W=window.Worker;window.Worker=function(){this.postMessage=d=>{sent=d};this.terminate=()=>{}};analyzeWardrobe();window.Worker=W;shopBusy=null;return Array.isArray(sent.climate)&&sent.climate.length});
    ok(pay===12,'the what-to-buy analysis is given the climate too');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
