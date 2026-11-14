// A new user's first days (audit 2026-11-13): no planned days before the wardrobe existed; the server's set-up errors in plain words
// for a tester (never OPENAI_API_KEY, worker, KV); the setup's unfinished city search is said before Next leaves it; the holidays of the
// time zone's country; "Several items" says it needs a connection before a photo is picked; a day with no photo on the worker is not
// asked about (no 404 in the console for every day); no "· silver" on pieces without metal.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});
    await ctx.clock.setFixedTime(new Date(2026,10,16,12));
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the wardrobe started today: no outfit on the days before (a day with a record keeps its outfit)
    const past=await p.evaluate(()=>{const now=Date.now();let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:now,...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];dayRecs={'2026-11-3':{date:'2026-11-3',ids:{top:'suit0',bot:'suit0',shirt:'shirt1',tie:'tie2'},suitDay:true,worn:true}};cache={};
      const pl=planMonth(2026,10),ks=Object.keys(pl).filter(k=>pl[k]&&hasOutfit(pl[k]));
      const old=items.map(i=>({...i}));items.forEach(i=>delete i.added);cache={};const all=Object.keys(planMonth(2026,10)).length;items=old;cache={};
      return {before:ks.filter(k=>keyDate(k)<todayDate()),today:!!pl['2026-11-16'],all,rec:pl['2026-11-3']?JSON.stringify(idsOf(pl['2026-11-3'])):'none',keys:Object.keys(pl).slice(0,5).join()}});
    ok(past.before.join()==='2026-11-3'&&past.today,`no planned outfit before the first item was added, except a day really recorded (${past.before.join()}; ${past.rec}; ${past.keys})`);
    ok(past.all>past.before.length+10,'items from before `added` existed keep every planned day');
    // the server's set-up errors
    const pe=await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t1');rememberRole({role:'tester'});
      const t=['Add an OPENAI_API_KEY secret to the worker to generate realistic photos.','Several items in one photo needs Claude: add an ANTHROPIC_API_KEY secret to the worker.','Add a KV namespace binding named WARDROBE to the worker to enable backups.','Today’s limit: 12 outfit photos.'].map(plainErr);
      const tag=tagFailText(501,{},'Set an ANTHROPIC_API_KEY secret (or add a Workers AI binding named AI) on the worker.');
      rememberRole({role:'owner'});const own=plainErr('Add an OPENAI_API_KEY secret to the worker to generate realistic photos.');return {t,tag,own}});
    ok(pe.t.slice(0,3).every(m=>!/OPENAI|ANTHROPIC|worker|\bKV\b|WARDROBE|secret|binding|token/i.test(m))&&pe.t[3]==='Today’s limit: 12 outfit photos.',`a tester reads set-up errors in plain words (${pe.t.join(' | ')})`);
    ok(!/ANTHROPIC|worker|Workers AI/.test(pe.tag),`a failed tagging says it in plain words too (${pe.tag})`);
    ok(/OPENAI_API_KEY/.test(pe.own),'the owner still reads what to set up');
    // no 404 for every day without a photo: the worker's list says which it has
    const asks=[];await p.route('https://w.test/**',r=>{const u=r.request().url();asks.push(u.replace('https://w.test/',''));
      if(/list=1/.test(u))return r.fulfill({status:200,contentType:'application/json',body:'{"keys":[]}'});return r.fulfill({status:404,contentType:'application/json',body:'{"error":"none"}'})});
    await p.evaluate(async()=>{rememberRole({role:'tester'});renderTried.clear();remoteKeys=null;for(let i=0;i<4;i++){stepDay(1);await new Promise(r=>setTimeout(r,80))}await new Promise(r=>setTimeout(r,400))});
    ok(asks.filter(a=>/key=|day=/.test(a)).length===0&&asks.some(a=>/list=1/.test(a)),`days without a photo on the worker are not asked about one by one (${asks.length} requests: ${[...new Set(asks.map(a=>a.replace(/=.*/,'')))].join(', ')})`);
    await p.unroute('https://w.test/**');
    // no "· silver" where no metal applies
    const d=await p.evaluate(()=>[desc({type:'suit',primaryColor:'grey',pattern:'solid',metal:'silver'}),desc({type:'shoes',primaryColor:'black',pattern:'solid',leather:'calf',metal:'silver'}),desc({type:'belt',primaryColor:'black',pattern:'solid',leather:'calf',metal:'gold'})]);
    ok(!/silver/.test(d[0])&&!/silver/.test(d[1])&&/gold/.test(d[2]),`a suit's and shoes' caption has no metal, a belt's buckle still shows (${d.join(' | ')})`);
    // "Several items" without a connection
    const sev=await p.evaluate(()=>{localStorage.removeItem('worker_url');localStorage.removeItem('app_token');openAdd();const n=document.querySelector('#add-group-off');return {hidden:!document.querySelector('#add-group').offsetParent,note:n&&!n.hidden?n.textContent:''}});
    ok(sev.hidden&&/needs a connection/.test(sev.note),`without a connection Add says that Several items needs one, before any photo is picked (${sev.note})`);
    await p.evaluate(()=>{items=[];cache={};show('today')});
    // the setup: an unfinished city search, and the time zone's holidays
    await p.route('https://geocoding-api.open-meteo.com/**',async r=>{await new Promise(z=>setTimeout(z,1500));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[{latitude:29.4,longitude:47.9,name:'Kuwait City',country_code:'KW'}]})})});
    await p.route('https://date.nager.at/**',r=>r.fulfill({status:404,body:''}));
    const su=await p.evaluate(async()=>{settings.holidays=null;settings.location=null;setupOpen();setup.at=SETUP_STEPS.indexOf('weather');setupDraw();setup.q='Kuwait';setupSearch();await new Promise(r=>setTimeout(r,50));
      setupGo(1);const a={at:SETUP_STEPS[setup.at],msg:document.querySelector('#su-step').textContent};await new Promise(r=>setTimeout(r,1800));setupGo(1);a.after=SETUP_STEPS[setup.at];
      setupFinish(false);for(let i=0;i<40&&!(settings.holidays&&settings.holidays.country);i++)await new Promise(r=>setTimeout(r,50));a.cc=settings.holidays&&settings.holidays.country;a.tz=tzCountry();return a});
    ok(su.at==='weather'&&/haven’t picked a city/.test(su.msg)&&su.after==='connect',`Next on an unfinished city search says so first, and a second Next goes on (${su.at} → ${su.after})`);
    ok(su.tz==='KW'&&su.cc==='KW',`the setup picks the holidays of the time zone's country (${su.cc})`);
    const ho=await p.evaluate(()=>{openSettings('daysoff');const t=document.querySelector('#holiday-list').textContent;closeSettings();return t});
    ok(/loaded once the app is connected/.test(ho),`Days off says the list comes once connected (${ho.trim().slice(0,80)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;
