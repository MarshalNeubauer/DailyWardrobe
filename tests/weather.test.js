// Workdays, formal days, cufflinks, coats, seasons and the weather forecast (Open-Meteo mocked).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({locale:'en-US'});
  // forecast: Nov 16 cold rain (6°C), Nov 17 hot (28°C), Nov 18 freezing and dry (2°C)
  const days=['2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'];
  const daily={time:days,temperature_2m_max:[14,6,28,2,15,15],temperature_2m_min:[6,2,19,-4,8,8],precipitation_probability_max:[10,90,0,5,10,10],precipitation_sum:[0,12,0,0,0,0],weather_code:[2,63,0,0,3,3]};
  let wxCalls=0;
  // no climate history in this suite (tests/climate.test.js covers it): days beyond the forecast follow the calendar
  await ctx.route('https://archive-api.open-meteo.com/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await ctx.route('https://api.open-meteo.com/**',r=>{wxCalls++;r.fulfill({contentType:'application/json',body:JSON.stringify({daily})})});
  await ctx.route('https://geocoding-api.open-meteo.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({results:[{name:'Austin',admin1:'Texas',country_code:'US',latitude:30.27,longitude:-97.74}]})}));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','lightgrey'),I('suit','tan'),I('suit','navy'),I('suit','charcoal'),I('suit','navy',{season:'warm'}),I('suit','grey',{season:'cold'}),I('blazer','navy'),I('pants','grey'),
      I('shirt','white',{cuff:'french'}),I('shirt','lightblue'),I('shirt','pink',{pattern:'stripe',secondaryColor:'white'}),
      I('tie','burgundy'),I('tie','pink',{pattern:'paisley',secondaryColor:'gold'}),I('tie','black',{pattern:'knit'}),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'suede'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'gold'}),I('belt','brown',{leather:'suede',metal:'gold'}),I('belt','brown',{leather:'calf',metal:'gold'}),
      I('watch','grey',{metal:'gold'}),I('cufflinks','gold',{metal:'gold'}),I('cufflinks','grey',{metal:'silver'}),I('overcoat','charcoal'),I('raincoat','tan'),I('socks','navy')];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});

  // ---- workdays ----
  const wd=await p.evaluate(()=>{settings.workdays=[1,2,3,4,5];settings.blazerDays=[5];cache={};const P=buildPlan(2026,10);
    const dows=[...new Set(Object.keys(P).map(k=>keyDate(k).getDay()))].sort().join(',');const fri=P['2026-11-20'];
    sel=new Date(2026,10,20);stepDay(1);const next=key(sel);return {dows,friBlazer:fri&&!fri.suitDay,next}});
  ok(wd.dows==='1,2,3,4,5','custom workdays (Mon–Fri) are the only planned days');
  ok(wd.friBlazer,'Friday is a blazer day when set as one');
  ok(wd.next==='2026-11-23','the next-day arrow skips the weekend');

  // ---- formal day via Settings: pick a date, Make formal ----
  await p.evaluate(()=>{sel=new Date(2026,10,19);view={y:2026,m:10};renderToday();openSettings('daysoff')});
  ok(await p.evaluate(()=>!document.querySelector('#today [aria-label="Make formal"]')&&!document.querySelector('#today .tog')),'the formal option is not on Today');
  await p.fill('#cfg-formal-date','2026-11-19');await p.click('#occ-add');await p.waitForFunction(()=>planFor()['2026-11-19'].formal&&document.querySelectorAll('#formal-list .fchip').length===1);   // (Settings lists it a moment after the day is saved)
  const fl=await p.evaluate(()=>({msg:$('#formal-msg').textContent,list:[...document.querySelectorAll('#formal-list .fchip')].map(c=>c.textContent)}));
  ok(/is now a formal day/.test(fl.msg)&&fl.list.length===1&&/Nov 19/.test(fl.list[0]),`Settings lists the formal day (${fl.list.join()})`);
  await p.fill('#cfg-formal-date','2026-11-21');await p.click('#occ-add');
  ok(/day off/.test(await p.textContent('#formal-msg'))&&await p.evaluate(()=>!monthPlan(2026,10)['2026-11-21']),'a day off cannot be made formal');
  await p.evaluate(()=>closeSettings());
  const f=await p.evaluate(()=>{const o=planFor()['2026-11-19'],r=rateOutfit(o);return {formal:o.formal,suitDay:o.suitDay,top:o.top.primaryColor,shirt:o.shirt.primaryColor,cuff:o.shirt.cuff,tie:o.tie.primaryColor+' '+o.tie.pattern,shoes:o.shoes.primaryColor+' '+o.shoes.leather,links:o.links&&o.links.metal,watch:o.watch&&o.watch.metal,formality:r.checks.find(c=>c.label==='Formality')}});
  ok(f.formal&&f.suitDay,'a blazer day upgraded to formal gets a suit');
  ok(['navy','charcoal'].includes(f.top),`formal suit is dark (${f.top})`);
  ok(f.shirt==='white'&&f.cuff==='french','formal shirt is white with French cuffs');
  ok(f.tie==='burgundy solid','formal tie is the quiet one');
  ok(f.shoes==='black calf','formal shoes are black calf');
  ok(f.links==='gold'&&f.watch==='gold','French cuffs get cufflinks matching the watch metal');
  ok(f.formality&&f.formality.pts===10,'Formality check scores 10/10');
  ok(await p.evaluate(()=>(document.querySelector('#today .dayact .ftag')||{}).textContent==='Formal day'),'Today marks the formal day (a small tag, not a button)');
  await p.evaluate(()=>openSettings('daysoff'));await p.click('#formal-list .fchip button');await p.waitForFunction(()=>!planFor()['2026-11-19'].formal);
  ok(await p.evaluate(()=>!document.querySelector('#formal-list .fchip')),'the × on a formal day in Settings makes it regular again');
  await p.evaluate(()=>{closeSettings();setFormal(true,'2026-11-19')});await p.waitForFunction(()=>planFor()['2026-11-19'].formal);
  // French cuffs with no cufflinks owned
  const nl=await p.evaluate(()=>{const keep=items;items=items.filter(i=>i.type!=='cufflinks');cache={};const o=planFor()['2026-11-19'];const n=o.notes.join(' ');items=keep;cache={};return {cuff:o.shirt.cuff,n}});
  ok(nl.cuff!=='french'||nl.n.includes('cufflinks'),'without cufflinks the French-cuff shirt is avoided or flagged');

  // ---- no location yet: a link in the date bar opens Settings at the weather section ----
  await p.evaluate(()=>{settings.location=null;closeSettings();renderToday()});
  ok((await p.textContent('.day .wx')).includes('Set your location'),'without a location the date bar offers "Set your location for weather"');
  await p.click('.day .wx a');await p.waitForTimeout(150);
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#settings-modal')).display!=='none'&&document.querySelector('#sc-weather').classList.contains('open')&&!document.querySelector('#sc-schedule').classList.contains('open')),'the link opens Settings at the weather section');
  await p.evaluate(()=>closeSettings());
  // ---- weather ----
  await p.evaluate(()=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];openSettings('weather')});
  await p.fill('#cfg-city','Austin');await p.click('text=Search');await p.waitForTimeout(150);
  await p.click('#city-results button');await p.waitForFunction(()=>Object.keys(weather).length>0);
  ok(wxCalls>=1,'choosing a city fetches the forecast');
  const w=await p.evaluate(()=>{closeSettings();cache={};const P=buildPlan(2026,10),g=k=>P[k];return {
    loc:settings.location&&settings.location.name,
    rain:{coat:g('2026-11-16').coat&&g('2026-11-16').coat.type,shoes:g('2026-11-16').shoes.leather},
    hot:{coat:g('2026-11-17').coat,top:g('2026-11-17').top.season||'all'},
    freezing:{coat:g('2026-11-18').coat&&g('2026-11-18').coat.type,top:g('2026-11-18').top.season||'all'}}});
  ok(w.loc==='Austin, Texas, US','city search sets the weather location');
  ok(w.rain.coat==='raincoat'&&w.rain.shoes!=='suede','cold rain: raincoat, and no suede shoes');
  ok(!w.hot.coat&&w.hot.top!=='cold','hot day: no coat, no cold-weather suit');
  ok(w.freezing.coat==='overcoat'&&w.freezing.top!=='warm','freezing day: overcoat, no warm-weather suit');
  await p.evaluate(()=>{sel=new Date(2026,10,16);renderToday()});
  const chipF=await p.textContent('.day .wx');
  ok(chipF.includes('43°')&&chipF.includes('☂ 90%'),`weather chip on the date bar (${chipF.trim()})`);
  ok((await p.textContent('#today .list')).includes('Raincoat'),'the raincoat is listed with the outfit');
  ok(await p.evaluate(()=>{const t=document.querySelector('.coat-tile');return !!t&&t.dataset.coat==='raincoat'}),'on the rainy day the raincoat tile is shown');
  await p.evaluate(()=>{sel=new Date(2026,10,18);renderToday()});
  ok(await p.evaluate(()=>{const t=document.querySelector('.coat-tile');return !!t&&t.dataset.coat==='overcoat'}),'on the freezing day the overcoat tile is shown');
  await p.evaluate(()=>{sel=new Date(2026,10,19);renderToday()});
  ok(await p.evaluate(()=>!document.querySelector('.coat-tile')&&!/Raincoat|Overcoat|Coat/.test(document.querySelector('#today .list').textContent)),'on a mild dry day there is no coat, in the figure or in the list');
  await p.evaluate(()=>{sel=new Date(2026,10,16);renderToday()});
  await p.evaluate(()=>setUnits('C'));await p.evaluate(()=>renderToday());
  ok((await p.textContent('.day .wx')).includes('6°'),'switching to °C converts the chip');

  // ---- persistence and sync of settings ----
  await p.reload();await p.waitForFunction(()=>window.appReady);
  const st=await p.evaluate(async()=>({s:settings,inBackup:!!(await localState()).settings}));
  ok(st.s.location&&st.s.units==='C'&&st.s.workdays.join()==='0,1,2,3,4','settings survive a reload');
  ok(st.inBackup,'settings are part of the backup/sync data');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
