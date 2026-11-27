// Insights, What to buy's counts and Today's new-user fixes, with the real planner.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/stats.test.js ---- */
// The stats page (Settings → Wardrobe stats): wear counts from what was really worn and from the next six months' plan,
// the pieces that never get worn with a reason, what costs points, colour balance, pairings and rest; no learning section, and
// learning votes an earlier version stored are dropped.
const stats=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900},locale:'en-US'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:+new Date(2026,10,4,12),...x});   // the wardrobe was set up on Nov 4
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('suit','brown'),I('blazer','navy'),I('pants','grey'),I('pants','tan'),I('pants','black'),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'gold'}),I('belt','tan',{leather:'suede',metal:'silver'}),
        I('socks','purple'),I('cufflinks','silver',{metal:'silver'}),I('watch','silver',{metal:'silver'})];
      HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[4];HOOK.settings.vestMode='never';HOOK.settings.holidays=null;HOOK.settings.daysOff=null;HOOK.weather={};HOOK.climate=null;HOOK.TODAY_OVERRIDE='2026-11-10T12:00:00';HOOK.cache={};
      // history: three real days (one marked not worn), and a planner warm-up day from before the items existed
      const ids=(top,shirt,tie)=>({top,bot:top,shirt,tie,shoes:'shoes14',belt:'belt16',socks:'socks19',watch:'watch21'});
      HOOK.dayRecs={'2026-9-1':{date:'2026-9-1',ids:ids('suit0','shirt8','tie11'),suitDay:true,auto:true},
        '2026-11-4':{date:'2026-11-4',ids:ids('suit0','shirt8','tie11'),suitDay:true},'2026-11-5':{date:'2026-11-5',ids:ids('suit1','shirt9','tie12'),suitDay:true,worn:false},
        '2026-11-8':{date:'2026-11-8',ids:ids('suit0','shirt9','tie11'),suitDay:true,worn:true},'2026-11-9':{date:'2026-11-9',ids:ids('suit2','shirt8','tie13'),suitDay:true}};
      HOOK.sel=new Date(2026,10,10);HOOK.view={y:2026,m:10};HOOK.show('today')});
    await p.evaluate(()=>HOOK.openSettings());
    ok(!(await p.isVisible('#stats-btn'))&&await p.isVisible('#n-stats')&&(await p.textContent('#n-stats'))==='Insights','Insights is a tab (no longer a link in Settings)');
    await p.evaluate(()=>HOOK.closeSettings());await p.click('#n-stats');
    const wait=await p.evaluate(()=>!!document.querySelector('#stats .st-wait'));await p.waitForFunction(()=>!!document.querySelector('#stats .st-tiles'),null,{timeout:20000});
    ok(wait,'the tab shows at once, saying it is planning the next six months, and the stats follow (planned in idle slices, stats.js statsShow)');
    ok(await p.evaluate(()=>!HOOK.$('#stats').hidden&&HOOK.$('#today').hidden&&HOOK.$('#settings-modal').style.display==='none'&&/Insights/.test(HOOK.$('#stats h2').textContent)&&!HOOK.$('#stats .pback')&&HOOK.$('#n-stats').classList.contains('on')),'it opens Insights, a tab with no ‹');
    const s=await p.evaluate(()=>{const S=HOOK.buildStats(),row=id=>S.rows.find(r=>r.i.id===id);
      return {worn:S.worn.map(w=>w.date).join(),navy:row('suit0').worn,ch:row('suit1').worn,tie:row('tie11').worn,last:row('suit0').last&&HOOK.key(row('suit0').last),plan:S.plan.length,planNavy:row('suit0').planned,next:!!row('suit0').next,
        unused:S.unused.map(r=>r.i.id).sort().join(),avg:S.avg,miss:Object.keys(S.miss),looks:S.looks,minRest:S.minRest,tiles:[...document.querySelectorAll('.st-tile b')].map(b=>b.textContent).join(),
        firstPlan:S.plan[0][0],lastPlan:S.plan[S.plan.length-1][0],sumTop:S.rows.filter(r=>r.i.type==='suit'||r.i.type==='blazer').reduce((a,r)=>a+r.planned,0)}});
    ok(s.worn==='2026-11-4,2026-11-8,2026-11-9'&&s.navy===2&&s.ch===0&&s.tie===2&&s.last==='2026-11-8',`worn counts come from the days really worn: not the day marked "Not worn", not a planner warm-up day from before the items existed (${s.worn})`);
    ok(s.plan>100&&s.plan<140&&s.firstPlan==='2026-11-11'&&/^2027-5-/.test(s.lastPlan)&&s.sumTop===s.plan&&s.planNavy>10&&s.next,`planned counts cover the next six months from tomorrow (${s.plan} outfits, ${s.firstPlan} to ${s.lastPlan})`);
    ok(s.tiles.split(',')[0]==='22'&&s.tiles.split(',')[1]==='3'&&+s.tiles.split(',')[2]===s.plan,`the tiles summarise items, days worn and outfits planned (${s.tiles})`);
    // never worn, with reasons
    const un=await p.evaluate(()=>[...document.querySelectorAll('#st-unused .st-row')].map(r=>r.querySelector('.st-nm').textContent+' → '+r.querySelector('small').textContent));
    const why=n=>(un.find(u=>u.toLowerCase().startsWith(n))||'');
    ok(s.unused==='belt18,cufflinks20,pants7'&&un.length===3,`the pieces never worn are listed (${s.unused})`);
    ok(/don't suit any of your blazers well enough/.test(why('pants: black'))&&/None of your shoes match it/.test(why('belt: tan'))&&/no French-cuff shirt/.test(why('cufflinks')),`each with its reason (${un.join(' | ')})`);
    // wear counts by type: suits open, others unfold on tap (their rows are only built then)
    const wc=await p.evaluate(()=>({types:[...document.querySelectorAll('#st-wear .st-type summary b')].map(b=>b.textContent).join(),open:[...document.querySelectorAll('#st-wear .st-type[open]')].map(d=>d.dataset.type).join(),
      suitRows:[...document.querySelectorAll('#st-wear .st-type[data-type=suit] .st-row')].map(r=>r.textContent.replace(/\s+/g,' ').trim()),shirtRows:document.querySelectorAll('#st-wear .st-type[data-type=shirt] .st-row').length}));
    ok(/^Suits,Blazer,Pants,Dress shirts,Ties/.test(wc.types)&&wc.open==='suit'&&wc.shirtRows===0,`wear counts are grouped by type, suits unfolded (${wc.types})`);
    ok(wc.suitRows.length===4&&/worn 2× · last Nov 8 · planned \d+× · next Nov \d+/.test(wc.suitRows.find(r=>/^navy/i.test(r))||''),`a row shows worn, last worn, planned and next (${wc.suitRows.find(r=>/^navy/i.test(r))})`);
    await p.click('#st-wear .st-type[data-type=shirt] summary');await p.waitForFunction(()=>document.querySelectorAll('#st-wear .st-type[data-type=shirt] .st-row').length===3);
    ok(await p.evaluate(()=>document.querySelector('#st-wear .st-type[data-type=shirt]').open&&document.querySelector('#st-wear .st-type[data-type=suit]').open),'tapping a type unfolds it and keeps the others as they were');
    // what costs points, colours, pairings
    const rest=await p.evaluate(()=>({miss:[...document.querySelectorAll('#st-points .st-miss')].map(m=>m.querySelector('b').textContent+': '+m.querySelector('span').textContent+' / '+(m.querySelector('small')||{textContent:''}).textContent),
      mix:[...document.querySelectorAll('#st-colours .st-mix')].map(m=>m.querySelector('small').textContent+'='+[...m.querySelectorAll('.st-mixnm')].map(x=>x.textContent).join('/')).join(' '),
      pct:[...document.querySelectorAll('#st-colours .st-mix')][0].querySelectorAll('.st-mixrow small').length,pairs:document.querySelectorAll('#st-pairs .st-pair').length,restTxt:document.querySelector('#st-pairs p:last-of-type').textContent,learn:!document.querySelector('#st-learn')&&document.querySelector('#stats').textContent}));
    ok(rest.miss.length>=2&&/^Socks: \d+ of \d+ days \/ Mostly: socks don't match the pants\./.test(rest.miss[0])&&rest.miss.some(m=>/^Metals/.test(m)),`"What costs you points" ranks the deductions with the usual reason (${rest.miss.slice(0,3).join(' | ')})`);
    ok(/Jackets=.*Navy/.test(rest.mix)&&/Shirts=/.test(rest.mix)&&/Ties=/.test(rest.mix)&&rest.pct>=3,`the color balance covers jackets, shirts and ties (${rest.mix})`);
    ok(rest.pairs>=3&&/A jacket rests at least \d+ workdays/.test(rest.restTxt)&&/shoes/i.test(rest.restTxt),`pairings and rest are shown (${rest.restTxt.trim()})`);
    ok(rest.learn&&!/learned/i.test(rest.learn),'Insights has no "What the planner has learned" section (the planner no longer learns from changes)');
    // votes an earlier version stored (settings.learn) are dropped once, the removal stamped so it wins over a copy that still has them
    const dl=await p.evaluate(async()=>{const old=HOOK.stampSettings({...JSON.parse(JSON.stringify(HOOK.settings)),learn:{p:{'a|b':-2},i:{}}},Date.now()-5000);   // another device's older copy, votes and all
      HOOK.settings.learn={p:{'a|b':-2},i:{}};await HOOK.saveUserSettings();await HOOK.dropLearn();const st=await HOOK.metaGet('settings'),m=HOOK.mergeSettings(old,JSON.parse(JSON.stringify(HOOK.settings)));
      return {mem:'learn' in HOOK.settings,stored:'learn' in st,mark:st.kh&&st.kh.learn,merged:'learn' in m,again:await HOOK.dropLearn()===undefined}});
    ok(!dl.mem&&!dl.stored&&dl.mark==='-'&&!dl.merged&&dl.again,`stored learning votes are removed and saved, marked removed (${dl.mark}), and the removal wins a merge with an older copy that has them`);
    // lowest days link back to Today; back button; an empty wardrobe
    await p.click('#n-today');
    ok(await p.evaluate(()=>!HOOK.$('#today').hidden&&HOOK.$('#stats').hidden),'the Today tab returns to Today');
    ok(await p.evaluate(()=>{const keep=HOOK.items;HOOK.items=[];HOOK.openStats();const t=HOOK.$('#stats').textContent;HOOK.items=keep;HOOK.cache={};HOOK.show('today');return /wardrobe is empty/i.test(t)}),'an empty wardrobe gets a plain message');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) runs the real planner (never-worn reasons and points come from the planner); other tests get tests/fixedplan.js

/* ---- was tests/nu2fix7.test.js ---- */
// Re-audit 2026-11-15, fix round 2 (Today, month, Insights): with Jackets off, Insights doesn't list blazers as "never worn"; Insights
// and What to buy count the same outfits for the next six months (they said 122 and 126); a wardrobe that can't dress a day yet (a suit
// and a shirt left after removing the sample) gets no score, no "This look last worn" and no outfit count on Today, and Insights says
// what is missing instead of "121 outfits planned … 50.0 average"; the date bar's "Set location" keeps its words with Larger Text and
// page zoom, and takes taps over 44 px.
const nu2fix7=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const quiet=()=>p.evaluate(()=>HOOK.recordRun.catch(()=>{}));
    const full=()=>p.evaluate(()=>{HOOK.TODAY_OVERRIDE='2026-11-16T09:00:00';const added=new Date(2026,10,10).getTime();let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added,...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('blazer','grey'),I('pants','grey'),I('pants','tan'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[4];delete HOOK.settings.dress;HOOK.dayRecs={};HOOK.weather={};HOOK.cache={};HOOK.sel=new Date(2026,10,16);HOOK.view={y:2026,m:10};HOOK.show('today')});
    await full();await quiet();
    // ---- Insights and What to buy: the same days
    const c=await p.evaluate(()=>{const ins=HOOK.plannedDays(),ev=HOOK.evalPlan(HOOK.items,HOOK.todayDate(),HOOK.SHOP_WEEKS),ks=HOOK.horizonKeys(HOOK.todayDate(),HOOK.SHOP_WEEKS);
      return {ins:ins.length,shop:ev.days,first:ks[0],today:HOOK.key(HOOK.todayDate()),same:ins.every(([k],n)=>k===ks[n])}});
    ok(c.ins===c.shop&&c.same&&c.ins>100,`Insights and What to buy count the same planned outfits (${c.ins} and ${c.shop})`);
    ok(c.first==='2026-11-17',`both start tomorrow, not today (${c.first}, today ${c.today})`);
    // ---- Jackets off: blazers and suits are left out by the dress code, not "never worn"
    const j=await p.evaluate(()=>{HOOK.settings.dress={jacket:false,tie:true};HOOK.cache={};HOOK.renderStats();
      const r={sum:[...document.querySelectorAll('#st-wear summary')].map(s=>s.textContent.replace(/\s+/g,' ').trim())};delete HOOK.settings.dress;HOOK.cache={};return r});
    const bl=j.sum.find(s=>/^Blazers/.test(s))||'';
    ok(/left out by your dress code/.test(bl)&&!/never worn/.test(bl),`with Jackets off, Wear counts says the blazers are left out by the dress code (${bl})`);
    // ---- a wardrobe that can't dress a day: a suit and a shirt, with a worn day of that look on record
    const h=await p.evaluate(()=>{HOOK.items=HOOK.items.filter(i=>i.id==='suit0'||i.id==='shirt6');
      HOOK.dayRecs={'2026-11-12':{date:'2026-11-12',ids:{top:'suit0',bot:'suit0',shirt:'shirt6'},suitDay:true}};HOOK.cache={};HOOK.renderToday();
      const r={first:!!HOOK.$('#firstrun'),fig:!!HOOK.$('#mannequin-container'),score:!!HOOK.$('#sbox'),last:!!HOOK.$('.lastworn'),month:(HOOK.$('#mbox .mltxt')||{}).textContent||''};
      HOOK.renderStats();r.tiles=HOOK.$('#stats .st-tiles').textContent;r.short=(HOOK.$('#st-short')||{}).textContent||'';r.stats=HOOK.$('#stats').textContent;return r});
    await quiet();
    ok(h.first&&h.fig&&!h.score&&!h.last,`a suit and a shirt: the checklist and the drawing, but no score and no "This look last worn" (score ${h.score}, last worn ${h.last})`);
    ok(/pieces still missing/.test(h.month)&&!/\d+ outfits?/.test(h.month),`the month card doesn't count half-outfits (${h.month.trim()})`);
    ok(/a tie and shoes/.test(h.short)&&!/outfits? planned|average outfit score/.test(h.tiles)&&!/averages|can.t get right|Small deductions/.test(h.stats),`Insights says what is missing and shows no plan numbers (${h.short.slice(0,80)})`);
    // one own piece left (Fixer 3's case after removing the sample): the checklist, no "69 Incomplete"
    const one=await p.evaluate(()=>{HOOK.items=HOOK.items.filter(i=>i.id==='suit0');HOOK.cache={};HOOK.renderToday();return {first:!!HOOK.$('#firstrun'),score:!!HOOK.$('#sbox')}});
    await quiet();
    ok(one.first&&!one.score,`one piece left: the checklist and no score (score ${one.score})`);
    // ---- complete again: the score and the counts come back
    await full();await quiet();
    ok(await p.evaluate(()=>!!HOOK.$('#sbox')&&!HOOK.$('#firstrun')&&/\d+ outfits/.test(HOOK.$('#mbox .mltxt').textContent)),'with a complete wardrobe the score and the month\'s count are back');
    // ---- the date bar's "Set location" beside the pill: Larger Text and page zoom
    const bar=async(w,h,ts)=>{await p.setViewportSize({width:w,height:h});
      await p.evaluate(ts=>{document.documentElement.style.setProperty('--tscale',String(ts));HOOK.settings.location=null;HOOK.sel=new Date(2026,10,16);HOOK.renderToday();scrollTo(0,0)},ts);await settle(p,200);
      // (measured again for up to 2 s until the bar is in place: the resize and the scroll back to the top settle on their own time)
      const m=()=>p.evaluate(()=>{scrollTo(0,0);const t=HOOK.$('#toast');if(t)t.classList.remove('on','act');/* (a toast from the steps above lay over the bar on a short screen) */const a=HOOK.$('.day h2 .wxl'),pl=HOOK.$('#wpill');if(!a||!pl)return null;const r=a.getBoundingClientRect(),rp=pl.getBoundingClientRect(),x=r.left+r.width/2;
        const at=document.elementFromPoint(x,r.top+r.height/2);
        return {top:Math.round(r.top),sy:scrollY,at:at&&(at.tagName+'.'+at.className+'#'+at.id),wrap:a.closest('.wx').classList.contains('wxwrap'),below:rp.top>=r.bottom-16,txt:a.textContent,w:r.width,h:r.height,cut:a.scrollWidth>a.clientWidth+1,hit:[r.top+3,r.top+r.height/2,r.bottom-3].filter(y=>document.elementFromPoint(x,y)===a).length,
          pill:pl.contains(document.elementFromPoint(rp.left+rp.width/2,rp.top+rp.height/2)),side:document.documentElement.scrollWidth<=innerWidth+1}});
      let b=await m();for(let k=0;k<20&&b&&!(b.hit>=2&&b.pill);k++){await p.waitForTimeout(100);b=await m()}return b};
    for(const [w,hh,ts] of [[390,844,1],[402,681,1.5],[268,454,1.5]]){const b=await bar(w,hh,ts);
      ok(b&&b.txt==='Set location'&&!b.cut&&b.w>40&&b.pill&&b.side,`${w} px, text ${ts*100}%: "Set location" shows whole beside or above the pill (${b&&Math.round(b.w)} px wide, ${b&&!(b.pill&&b.side)?JSON.stringify(b):`cut ${b&&b.cut}`})`);
      ok(b&&b.h>=44&&b.hit>=2,`${w} px, text ${ts*100}%: the link takes taps over ${b&&Math.round(b.h)} px`);
      if(ts===1)ok(b&&!b.wrap,`${w} px, usual text: one line, the pill beside it`);else ok(b&&b.wrap&&b.below,`${w} px, text ${ts*100}%: the pill goes under "Set location" at the right`)}
    await p.evaluate(()=>{document.documentElement.style.removeProperty('--tscale');HOOK.TODAY_OVERRIDE=null;HOOK.cache={}});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
// (realPlanner) the planned days and What to buy's own plan need the real planner

/* ---- was tests/nufix7.test.js ---- */
// New-user audit 2026-11-14, Today / month / Insights / packing fixes: Today moves on to the new workday after a weekend or a past day
// (H8) and opens on it; Settings changes (workdays, units) reach Today when Settings closes, the location line follows the units; days
// before the wardrobe existed say so instead of a red "0 · Incomplete"; "Trousers", never "Pants"; no "Add tab"; a past day's deleted piece
// is named; the month marks a day not worn; a striped shirt is named with its pattern; Insights pluralises, uses the given names and leaves
// out the weeks before the wardrobe; the empty pages have a way to start; a kept trip outlasts a Settings change; a piece arriving after
// the trip starts isn't packed; the month's drag preview keeps the days before the wardrobe empty; Add's Undo toast goes with the page;
// quick swipes in a row each move a day.
const nufix7=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    // ---- opened on a Saturday: Today shows Sunday's outfit (the next workday), not the empty Saturday
    {const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});await ctx.clock.setFixedTime(new Date(2026,10,21,9));
      const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
      ok(await p.evaluate(()=>HOOK.key(HOOK.sel)==='2026-11-22'&&HOOK.view.m===10),'opened on a Saturday, Today starts on Sunday, the next workday');
      await ctx.close()}
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const quiet=()=>p.evaluate(()=>HOOK.recordRun.catch(()=>{}));   // the day records a drawing of Today writes in the background
    await p.evaluate(()=>{const added=new Date(2026,10,10).getTime();let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added,...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[];HOOK.dayRecs={};HOOK.weather={};HOOK.cache={}});
    // ---- H8: shown on a Friday (a day off, as the calendar day), brought back on Sunday: Sunday's outfit
    const fire=()=>p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    const at=async(today,s,v)=>{await p.evaluate(([t,s,v])=>{HOOK.TODAY_OVERRIDE=t;HOOK.cache={};HOOK.dayRecs={};HOOK.sel=new Date(...s);HOOK.view={y:v[0],m:v[1]};HOOK.dayShown=null;HOOK.show('today')},[today,s,v]);await quiet();
    };
    await at('2026-11-20T07:30:00',[2026,10,20],[2026,10]);await p.evaluate(()=>{HOOK.TODAY_OVERRIDE='2026-11-22T07:30:00'});await fire();await quiet();
    const fri=await p.evaluate(()=>HOOK.key(HOOK.sel));
    // left on a past day (stepped back from Thursday to Tuesday), brought back on Sunday: Sunday
    await at('2026-11-19T07:30:00',[2026,10,17],[2026,10]);await p.evaluate(()=>{HOOK.TODAY_OVERRIDE='2026-11-22T07:30:00'});await fire();await quiet();
    const past=await p.evaluate(()=>HOOK.key(HOOK.sel));
    // a coming day the user stepped to stays
    await at('2026-11-19T07:30:00',[2026,11,1],[2026,11]);await p.evaluate(()=>{HOOK.TODAY_OVERRIDE='2026-11-22T07:30:00'});await fire();await quiet();
    const future=await p.evaluate(()=>HOOK.key(HOOK.sel));
    ok(fri==='2026-11-22',`opened on Friday and brought back on Sunday, Today shows Sunday (${fri})`);
    ok(past==='2026-11-22',`left on a past day, Today moves on to the new day (${past})`);
    ok(future==='2026-12-1',`a coming day the user stepped to stays (${future})`);
    // ---- Settings: a workday taken away moves Today on, units redraw the location line and Today
    await at('2026-11-16T09:00:00',[2026,10,16],[2026,10]);
    const st=await p.evaluate(()=>{HOOK.settings.units='F';HOOK.settings.location={lat:29.4,lon:48,name:'Kuwait City'};HOOK.climate=Array.from({length:12},(_,m)=>({tmax:20+m*2}));HOOK.weather={'2026-11-17':{code:0,tmax:25,tmin:15}};HOOK.renderToday();
      HOOK.openSettings('schedule');HOOK.toggleDay('#cfg-workdays',1);const stale=HOOK.todayStale;HOOK.saveSettings();const r={stale,sel:HOOK.key(HOOK.sel),h2:HOOK.$('#today .day h2 .dlong').textContent};
      HOOK.openSettings('weather');HOOK.setUnits('C');r.loc=HOOK.$('#wx-loc').textContent;HOOK.saveSettings();r.wx=HOOK.$('#today .wxc').textContent;HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.location=null;HOOK.climate=null;HOOK.weather={};delete HOOK.settings.units;HOOK.cache={};return r});
    await quiet();
    ok(st.stale&&st.sel==='2026-11-17'&&/Tuesday/.test(st.h2),`a workday taken away in Settings moves Today on when Settings closes (${st.sel}, ${st.h2})`);
    ok(/highs of about 20° .* 42°/.test(st.loc),`the location line follows °C at once (${st.loc})`);
    ok(/25°\/15°/.test(st.wx),`and Today shows °C when Settings closes (${st.wx})`);
    // ---- days before the wardrobe existed; Trousers; Add one; a deleted piece on a past day
    await p.evaluate(()=>{HOOK.items[0].sample=true});   // (with the sample's banner above it too: it hid the note on the phone)
    await at('2026-11-16T09:00:00',[2026,10,5],[2026,10]);
    const d=await p.evaluate(()=>{const r={pre:(HOOK.$('#prewd')||{}).textContent||'',score:!!HOOK.$('#sbox'),banner:!!HOOK.$('#kit-sample')};delete HOOK.items[0].sample;      HOOK.settings.blazerDays=[1];HOOK.sel=new Date(2026,10,16);HOOK.dayRecs={};HOOK.cache={};HOOK.renderToday();if(!HOOK.listOpen)HOOK.toggleList();
      r.rows=[...document.querySelectorAll('#ibox .row > span.mut:first-child')].map(e=>e.textContent);r.add=[...document.querySelectorAll('#ibox .addone')].map(b=>b.textContent+'|'+b.dataset.act+'|'+b.dataset.type);
      r.html=HOOK.$('#today').innerHTML;HOOK.settings.blazerDays=[];
      HOOK.dayRecs={'2026-11-12':{date:'2026-11-12',ids:{top:'gone1',bot:'gone1',shirt:'shirt5',tie:'tie6',shoes:'shoes8',belt:'belt9',socks:'socks10'},suitDay:true}};HOOK.cache={};HOOK.sel=new Date(2026,10,12);HOOK.renderToday();
      r.gone=(HOOK.$('.gonenote')||{}).textContent||'';HOOK.cache={};HOOK.listOpen=false;return r});
    await quiet();
    ok(/No outfit: your wardrobe starts on Tuesday, November 10/.test(d.pre)&&!d.score&&d.banner,`a day before the wardrobe existed says so, with no score (${d.pre})`);
    ok(d.rows.includes('Pants')&&!d.rows.includes('Trousers'),`a blazer day's pants row says Pants (${d.rows.join(', ')})`);
    ok(d.add.length&&d.add.every(a=>/^Add one\|addOneTap\|[a-z]+$/.test(a))&&!/Add tab/.test(d.html),`a missing piece offers "Add one", which opens Add for its type; no "Add tab" (${d.add.join(', ')})`);
    ok(/suit worn this day is no longer in your wardrobe/.test(d.gone),`a past day's deleted suit is named under the picture (${d.gone})`);
    // ---- the month: a day marked not worn; a past workday with no outfit is not "worn"; a striped shirt's name
    await at('2026-11-19T09:00:00',[2026,10,19],[2026,10]);
    const m=await p.evaluate(()=>{HOOK.dayRecs={'2026-11-17':{date:'2026-11-17',ids:{top:'suit0',bot:'suit0',shirt:'shirt4',tie:'tie6',shoes:'shoes8',belt:'belt9',socks:'socks10'},suitDay:true,worn:false}};HOOK.cache={};
      HOOK.monthOpen=false;HOOK.renderToday();HOOK.toggleMonth();const c=k=>document.querySelector(`#mbox .mc[data-k="${k}"]`);
      const r={skip:c('2026-11-17').className,skipLabel:c('2026-11-17').getAttribute('aria-label'),pre:c('2026-11-3').className,worn:c('2026-11-16').className,
        line:HOOK.piecesLine({top:HOOK.items[0],suitDay:true,shirt:HOOK.items[4],tie:HOOK.items[6]}),rest:HOOK.shortRest({shirt:HOOK.items[4]})};HOOK.toggleMonth();HOOK.cache={};return r});
    await quiet();
    ok(/\bskip\b/.test(m.skip)&&!/\bworn\b/.test(m.skip)&&/not worn/.test(m.skipLabel),`a day marked "Didn't" is not shown as worn in the month (${m.skip}; ${m.skipLabel})`);
    ok(!/\bworn\b/.test(m.pre)&&/\bworn\b/.test(m.worn),`a past workday before the wardrobe is not marked worn; a worn one is (${m.pre} / ${m.worn})`);
    // (its main colour and pattern since the title audit, 2026-11-17: it was "white & blue stripe shirt")
    ok(/white stripe shirt/i.test(m.line)&&/white stripe shirt/i.test(m.rest),`a striped shirt is named with its pattern (${m.line} | ${m.rest})`);
    // ---- the month's drag preview keeps the days before the wardrobe empty
    ok(await p.evaluate(()=>{const pl=HOOK.planWith({},2026,10);return !pl['2026-11-3']&&!!pl['2026-11-22']}),'the drag preview (planWith) has no outfits before the wardrobe existed');
    // ---- Insights
    const s=await p.evaluate(()=>{HOOK.cache={};HOOK.items[1].name='My charcoal pinstripe';
      const one=HOOK.items.slice();HOOK.items=[HOOK.items[1]];HOOK.renderStats();const t1=HOOK.$('#stats .st-tiles').textContent;HOOK.items=one;
      HOOK.dayRecs={'2026-11-16':{date:'2026-11-16',ids:{top:'suit0',bot:'suit0',shirt:'shirt5',tie:'tie6',shoes:'shoes8',belt:'belt9',socks:'socks10'},suitDay:true}};HOOK.cache={};HOOK.renderStats();
      const r={t1,names:[...document.querySelectorAll('#stats .st-nm')].map(e=>e.textContent).join(' / '),weeks:document.querySelectorAll('#stats .st-wk').length};delete HOOK.items[1].name;HOOK.dayRecs={};HOOK.cache={};return r});
    ok(/1item/.test(s.t1)&&!/1items|1 items/.test(s.t1),`Insights says "1 item", not "1 items" (${s.t1})`);
    ok(/My charcoal pinstripe/.test(s.names),'Insights uses the name the user gave');
    ok(s.weeks===2,`"Your scores" leaves out the weeks before the wardrobe existed (${s.weeks} weeks shown)`);
    // ---- the empty pages have a way to start
    const e=await p.evaluate(()=>{const keep=HOOK.items;HOOK.items=[];HOOK.renderStats();const a=HOOK.$('#stats').innerHTML;HOOK.renderPack();const b=HOOK.$('#pack').innerHTML;HOOK.items=keep;HOOK.cache={};return [a,b]});
    ok(e.every(h=>/<button[^>]*>Add your first item<\/button>/.test(h)&&/<button[^>]*>Try a sample wardrobe<\/button>/.test(h)),'empty Insights and Packing list offer Add your first item and the sample');
    // ---- packing: a kept trip outlasts a Settings change; a suit arriving after the trip starts isn't packed
    const pk=await p.evaluate(async()=>{HOOK.cache={};HOOK.dayRecs={};localStorage.removeItem('pack_trip');
      HOOK.packT={a:'2026-11-29',b:'2026-12-3',j:0,s:0};HOOK.show('pack');await HOOK.packLock();const before=HOOK.packLockState(HOOK.packNow.days);await HOOK.clearLocks();HOOK.renderPack();const after=HOOK.packLockState(HOOK.packNow.days);
      await HOOK.packRelease();
      // the navy suit bought, arriving Nov 30: not in the trip from Nov 29
      Object.assign(HOOK.items[0],{paused:true,order:true,arrives:'2026-11-30'});HOOK.cache={};HOOK.renderPack();
      const used=HOOK.packNow.days.some(x=>x.o&&x.o.top&&x.o.top.id==='suit0'),note=(HOOK.$('#pk-late')||{}).textContent||'';
      HOOK.packT={a:'2026-12-2',b:'2026-12-3',j:0,s:0};HOOK.cache={};HOOK.renderPack();const later=!HOOK.$('#pk-late');
      delete HOOK.items[0].paused;delete HOOK.items[0].order;delete HOOK.items[0].arrives;HOOK.cache={};HOOK.packT=null;HOOK.dayRecs={};HOOK.show('today');return {before,after,used,note,later}});
    await quiet();
    ok(pk.before.n===pk.before.of&&pk.after.n===pk.after.of&&pk.after.of>0,`a kept trip stays locked through a Settings change (clearLocks): ${pk.after.n} of ${pk.after.of}`);
    ok(!pk.used&&/arrives .*after you leave/.test(pk.note),`a suit arriving after the trip starts is left out, and the page says why (${pk.note})`);
    ok(pk.later,'a trip after its arrival has no such note');
    // ---- Add's "Saved … Undo" toast goes with the page
    const tst=await p.evaluate(()=>{HOOK.openAdd();HOOK.toast('Saved: Navy suit.',8000,{label:'Undo',fn:()=>{}});const a=HOOK.$('#toast').classList.contains('on');HOOK.show('today');return {a,b:HOOK.$('#toast').classList.contains('on')}});
    ok(tst.a&&!tst.b,'leaving Add takes its Undo toast away (it lay over the month card)');
    await quiet();
    // ---- quick swipes in a row each move a day
    await at('2026-11-16T09:00:00',[2026,10,16],[2026,10]);await p.evaluate(()=>scrollTo(0,0));await settle(p,300);
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const c=await p.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+Math.min(b.height/2,250)}});
    for(let k=0;k<5;k++){await T('touchStart',c.x+90,c.y);for(let j=1;j<=4;j++)await T('touchMove',c.x+90-50*j,c.y+1);await T('touchEnd');await p.waitForTimeout(60)}
    await settle(p,900);
    const sw=await p.evaluate(()=>HOOK.key(HOOK.sel));
    ok(sw==='2026-11-23',`five quick swipes move five workdays (${sw})`);
    await p.evaluate(()=>{HOOK.TODAY_OVERRIDE=null;HOOK.cache={}});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
// (realPlanner) planTrim, the drag preview and the trip's plan need the real planner

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['stats',stats],['nu2fix7',nu2fix7],['nufix7',nufix7]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.realPlanner=true;   // runs the real planner (every part checks the planner's choices); other tests get tests/fixedplan.js
