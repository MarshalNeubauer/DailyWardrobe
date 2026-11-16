// New-user audit 2026-11-14, Today / month / Insights / packing fixes: Today moves on to the new workday after a weekend or a past day
// (H8) and opens on it; Settings changes (workdays, units) reach Today when Settings closes, the location line follows the units; days
// before the wardrobe existed say so instead of a red "0 · Incomplete"; "Trousers", never "Pants"; no "Add tab"; a past day's deleted piece
// is named; the month marks a day not worn; a striped shirt is named with its pattern; Insights pluralises, uses the given names and leaves
// out the weeks before the wardrobe; the empty pages have a way to start; a kept trip outlasts a Settings change; a piece arriving after
// the trip starts isn't packed; the month's drag preview keeps the days before the wardrobe empty; Add's Undo toast goes with the page;
// quick swipes in a row each move a day.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    // ---- opened on a Saturday: Today shows Sunday's outfit (the next workday), not the empty Saturday
    {const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});await ctx.clock.setFixedTime(new Date(2026,10,21,9));
      const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
      ok(await p.evaluate(()=>key(sel)==='2026-11-22'&&view.m===10),'opened on a Saturday, Today starts on Sunday, the next workday');
      await ctx.close()}
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const quiet=()=>p.evaluate(()=>recordRun.catch(()=>{}));   // the day records a drawing of Today writes in the background
    await p.evaluate(()=>{const added=new Date(2026,10,10).getTime();let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];dayRecs={};weather={};cache={}});
    // ---- H8: shown on a Friday (a day off, as the calendar day), brought back on Sunday: Sunday's outfit
    const fire=()=>p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    const at=async(today,s,v)=>{await p.evaluate(([t,s,v])=>{TODAY_OVERRIDE=t;cache={};dayRecs={};sel=new Date(...s);view={y:v[0],m:v[1]};dayShown=null;show('today')},[today,s,v]);await quiet();
    };
    await at('2026-11-20T07:30:00',[2026,10,20],[2026,10]);await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-22T07:30:00'});await fire();await quiet();
    const fri=await p.evaluate(()=>key(sel));
    // left on a past day (stepped back from Thursday to Tuesday), brought back on Sunday: Sunday
    await at('2026-11-19T07:30:00',[2026,10,17],[2026,10]);await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-22T07:30:00'});await fire();await quiet();
    const past=await p.evaluate(()=>key(sel));
    // a coming day the user stepped to stays
    await at('2026-11-19T07:30:00',[2026,11,1],[2026,11]);await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-22T07:30:00'});await fire();await quiet();
    const future=await p.evaluate(()=>key(sel));
    ok(fri==='2026-11-22',`opened on Friday and brought back on Sunday, Today shows Sunday (${fri})`);
    ok(past==='2026-11-22',`left on a past day, Today moves on to the new day (${past})`);
    ok(future==='2026-12-1',`a coming day the user stepped to stays (${future})`);
    // ---- Settings: a workday taken away moves Today on, units redraw the location line and Today
    await at('2026-11-16T09:00:00',[2026,10,16],[2026,10]);
    const st=await p.evaluate(()=>{settings.units='F';settings.location={lat:29.4,lon:48,name:'Kuwait City'};climate=Array.from({length:12},(_,m)=>({tmax:20+m*2}));weather={'2026-11-17':{code:0,tmax:25,tmin:15}};renderToday();
      openSettings('schedule');toggleDay('#cfg-workdays',1);const stale=todayStale;saveSettings();const r={stale,sel:key(sel),h2:$('#today .day h2 .dlong').textContent};
      openSettings('weather');setUnits('C');r.loc=$('#wx-loc').textContent;saveSettings();r.wx=$('#today .wxc').textContent;settings.workdays=[0,1,2,3,4];settings.location=null;climate=null;weather={};delete settings.units;cache={};return r});
    await quiet();
    ok(st.stale&&st.sel==='2026-11-17'&&/Tuesday/.test(st.h2),`a workday taken away in Settings moves Today on when Settings closes (${st.sel}, ${st.h2})`);
    ok(/highs of about 20° .* 42°/.test(st.loc),`the location line follows °C at once (${st.loc})`);
    ok(/25°\/15°/.test(st.wx),`and Today shows °C when Settings closes (${st.wx})`);
    // ---- days before the wardrobe existed; Trousers; Add one; a deleted piece on a past day
    await p.evaluate(()=>{items[0].sample=true});   // (with the sample's banner above it too: it hid the note on the phone)
    await at('2026-11-16T09:00:00',[2026,10,5],[2026,10]);
    const d=await p.evaluate(()=>{const r={pre:($('#prewd')||{}).textContent||'',score:!!$('#sbox'),banner:!!$('#kit-sample')};delete items[0].sample;      settings.blazerDays=[1];sel=new Date(2026,10,16);dayRecs={};cache={};renderToday();if(!listOpen)toggleList();
      r.rows=[...document.querySelectorAll('#ibox .row > span.mut:first-child')].map(e=>e.textContent);r.add=[...document.querySelectorAll('#ibox .addone')].map(b=>b.textContent+'|'+b.getAttribute('onclick'));
      r.html=$('#today').innerHTML;settings.blazerDays=[];
      dayRecs={'2026-11-12':{date:'2026-11-12',ids:{top:'gone1',bot:'gone1',shirt:'shirt5',tie:'tie6',shoes:'shoes8',belt:'belt9',socks:'socks10'},suitDay:true}};cache={};sel=new Date(2026,10,12);renderToday();
      r.gone=($('.gonenote')||{}).textContent||'';cache={};listOpen=false;return r});
    await quiet();
    ok(/No outfit: your wardrobe starts on Tuesday, November 10/.test(d.pre)&&!d.score&&d.banner,`a day before the wardrobe existed says so, with no score (${d.pre})`);
    ok(d.rows.includes('Pants')&&!d.rows.includes('Trousers'),`a blazer day's pants row says Pants (${d.rows.join(', ')})`);
    ok(d.add.length&&d.add.every(a=>/^Add one\|openAdd\('[a-z]+'\)/.test(a))&&!/Add tab/.test(d.html),`a missing piece offers "Add one", which opens Add for its type; no "Add tab" (${d.add.join(', ')})`);
    ok(/suit worn this day is no longer in your wardrobe/.test(d.gone),`a past day's deleted suit is named under the picture (${d.gone})`);
    // ---- the month: a day marked not worn; a past workday with no outfit is not "worn"; a striped shirt's name
    await at('2026-11-19T09:00:00',[2026,10,19],[2026,10]);
    const m=await p.evaluate(()=>{dayRecs={'2026-11-17':{date:'2026-11-17',ids:{top:'suit0',bot:'suit0',shirt:'shirt4',tie:'tie6',shoes:'shoes8',belt:'belt9',socks:'socks10'},suitDay:true,worn:false}};cache={};
      monthOpen=false;renderToday();toggleMonth();const c=k=>document.querySelector(`#mbox .mc[data-k="${k}"]`);
      const r={skip:c('2026-11-17').className,skipLabel:c('2026-11-17').getAttribute('aria-label'),pre:c('2026-11-3').className,worn:c('2026-11-16').className,
        line:piecesLine({top:items[0],suitDay:true,shirt:items[4],tie:items[6]}),rest:shortRest({shirt:items[4]})};toggleMonth();cache={};return r});
    await quiet();
    ok(/\bskip\b/.test(m.skip)&&!/\bworn\b/.test(m.skip)&&/not worn/.test(m.skipLabel),`a day marked "Didn't" is not shown as worn in the month (${m.skip}; ${m.skipLabel})`);
    ok(!/\bworn\b/.test(m.pre)&&/\bworn\b/.test(m.worn),`a past workday before the wardrobe is not marked worn; a worn one is (${m.pre} / ${m.worn})`);
    ok(/white & blue stripe shirt/i.test(m.line)&&/white & blue stripe shirt/i.test(m.rest),`a striped shirt is named with its pattern (${m.line} | ${m.rest})`);
    // ---- the month's drag preview keeps the days before the wardrobe empty
    ok(await p.evaluate(()=>{const pl=planWith({},2026,10);return !pl['2026-11-3']&&!!pl['2026-11-22']}),'the drag preview (planWith) has no outfits before the wardrobe existed');
    // ---- Insights
    const s=await p.evaluate(()=>{cache={};items[1].name='My charcoal pinstripe';
      const one=items.slice();items=[items[1]];renderStats();const t1=$('#stats .st-tiles').textContent;items=one;
      dayRecs={'2026-11-16':{date:'2026-11-16',ids:{top:'suit0',bot:'suit0',shirt:'shirt5',tie:'tie6',shoes:'shoes8',belt:'belt9',socks:'socks10'},suitDay:true}};cache={};renderStats();
      const r={t1,names:[...document.querySelectorAll('#stats .st-nm')].map(e=>e.textContent).join(' / '),weeks:document.querySelectorAll('#stats .st-wk').length};delete items[1].name;dayRecs={};cache={};return r});
    ok(/1item/.test(s.t1)&&!/1items|1 items/.test(s.t1),`Insights says "1 item", not "1 items" (${s.t1})`);
    ok(/My charcoal pinstripe/.test(s.names),'Insights uses the name the user gave');
    ok(s.weeks===2,`"Your scores" leaves out the weeks before the wardrobe existed (${s.weeks} weeks shown)`);
    // ---- the empty pages have a way to start
    const e=await p.evaluate(()=>{const keep=items;items=[];renderStats();const a=$('#stats').innerHTML;renderPack();const b=$('#pack').innerHTML;items=keep;cache={};return [a,b]});
    ok(e.every(h=>/openAdd\(\)/.test(h)&&/kitSampleLoad\(\)/.test(h)),'empty Insights and Packing list offer Add your first item and the sample');
    // ---- packing: a kept trip outlasts a Settings change; a suit arriving after the trip starts isn't packed
    const pk=await p.evaluate(async()=>{cache={};dayRecs={};localStorage.removeItem('pack_trip');
      packT={a:'2026-11-29',b:'2026-12-3',j:0,s:0};show('pack');await packLock();const before=packLockState(packNow.days);await clearLocks();renderPack();const after=packLockState(packNow.days);
      await packRelease();
      // the navy suit bought, arriving Nov 30: not in the trip from Nov 29
      Object.assign(items[0],{paused:true,order:true,arrives:'2026-11-30'});cache={};renderPack();
      const used=packNow.days.some(x=>x.o&&x.o.top&&x.o.top.id==='suit0'),note=($('#pk-late')||{}).textContent||'';
      packT={a:'2026-12-2',b:'2026-12-3',j:0,s:0};cache={};renderPack();const later=!$('#pk-late');
      delete items[0].paused;delete items[0].order;delete items[0].arrives;cache={};packT=null;dayRecs={};show('today');return {before,after,used,note,later}});
    await quiet();
    ok(pk.before.n===pk.before.of&&pk.after.n===pk.after.of&&pk.after.of>0,`a kept trip stays locked through a Settings change (clearLocks): ${pk.after.n} of ${pk.after.of}`);
    ok(!pk.used&&/arrives .*after you leave/.test(pk.note),`a suit arriving after the trip starts is left out, and the page says why (${pk.note})`);
    ok(pk.later,'a trip after its arrival has no such note');
    // ---- Add's "Saved … Undo" toast goes with the page
    const tst=await p.evaluate(()=>{openAdd();toast('Saved: Navy suit.',8000,{label:'Undo',fn:()=>{}});const a=$('#toast').classList.contains('on');show('today');return {a,b:$('#toast').classList.contains('on')}});
    ok(tst.a&&!tst.b,'leaving Add takes its Undo toast away (it lay over the month card)');
    await quiet();
    // ---- quick swipes in a row each move a day
    await at('2026-11-16T09:00:00',[2026,10,16],[2026,10]);await p.evaluate(()=>scrollTo(0,0));await settle(p,300);
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const c=await p.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+Math.min(b.height/2,250)}});
    for(let k=0;k<5;k++){await T('touchStart',c.x+90,c.y);for(let j=1;j<=4;j++)await T('touchMove',c.x+90-50*j,c.y+1);await T('touchEnd');await p.waitForTimeout(60)}
    await settle(p,900);
    const sw=await p.evaluate(()=>key(sel));
    ok(sw==='2026-11-23',`five quick swipes move five workdays (${sw})`);
    await p.evaluate(()=>{TODAY_OVERRIDE=null;cache={}});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // planTrim, the drag preview and the trip's plan need the real planner
