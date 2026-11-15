// Re-audit 2026-11-15, fix round 2 (Today, month, Insights): with Jackets off, Insights doesn't list blazers as "never worn"; Insights
// and What to buy count the same outfits for the next six months (they said 122 and 126); a wardrobe that can't dress a day yet (a suit
// and a shirt left after removing the sample) gets no score, no "This look last worn" and no outfit count on Today, and Insights says
// what is missing instead of "121 outfits planned … 50.0 average"; the date bar's "Set location" keeps its words with Larger Text and
// page zoom, and takes taps over 44 px.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const quiet=()=>p.evaluate(()=>recordRun.catch(()=>{}));
    const full=()=>p.evaluate(()=>{TODAY_OVERRIDE='2026-11-16T09:00:00';const added=new Date(2026,10,10).getTime();let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('blazer','grey'),I('pants','grey'),I('pants','tan'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];delete settings.dress;dayRecs={};weather={};cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});
    await full();await quiet();
    // ---- Insights and What to buy: the same days
    const c=await p.evaluate(()=>{const ins=plannedDays(),ev=evalPlan(items,todayDate(),SHOP_WEEKS),ks=horizonKeys(todayDate(),SHOP_WEEKS);
      return {ins:ins.length,shop:ev.days,first:ks[0],today:key(todayDate()),same:ins.every(([k],n)=>k===ks[n])}});
    ok(c.ins===c.shop&&c.same&&c.ins>100,`Insights and What to buy count the same planned outfits (${c.ins} and ${c.shop})`);
    ok(c.first==='2026-11-17',`both start tomorrow, not today (${c.first}, today ${c.today})`);
    // ---- Jackets off: blazers and suits are left out by the dress code, not "never worn"
    const j=await p.evaluate(()=>{settings.dress={jacket:false,tie:true};cache={};renderStats();
      const r={sum:[...document.querySelectorAll('#st-wear summary')].map(s=>s.textContent.replace(/\s+/g,' ').trim())};delete settings.dress;cache={};return r});
    const bl=j.sum.find(s=>/^Blazers/.test(s))||'';
    ok(/left out by your dress code/.test(bl)&&!/never worn/.test(bl),`with Jackets off, Wear counts says the blazers are left out by the dress code (${bl})`);
    // ---- a wardrobe that can't dress a day: a suit and a shirt, with a worn day of that look on record
    const h=await p.evaluate(()=>{items=items.filter(i=>i.id==='suit0'||i.id==='shirt6');
      dayRecs={'2026-11-12':{date:'2026-11-12',ids:{top:'suit0',bot:'suit0',shirt:'shirt6'},suitDay:true}};cache={};renderToday();
      const r={first:!!$('#firstrun'),fig:!!$('#mannequin-container'),score:!!$('#sbox'),last:!!$('.lastworn'),month:($('#mbox .mltxt')||{}).textContent||''};
      renderStats();r.tiles=$('#stats .st-tiles').textContent;r.short=($('#st-short')||{}).textContent||'';r.stats=$('#stats').textContent;return r});
    await quiet();
    ok(h.first&&h.fig&&!h.score&&!h.last,`a suit and a shirt: the checklist and the drawing, but no score and no "This look last worn" (score ${h.score}, last worn ${h.last})`);
    ok(/pieces still missing/.test(h.month)&&!/\d+ outfits?/.test(h.month),`the month card doesn't count half-outfits (${h.month.trim()})`);
    ok(/a tie and shoes/.test(h.short)&&!/outfits? planned|average outfit score/.test(h.tiles)&&!/averages|can.t get right|Small deductions/.test(h.stats),`Insights says what is missing and shows no plan numbers (${h.short.slice(0,80)})`);
    // ---- complete again: the score and the counts come back
    await full();await quiet();
    ok(await p.evaluate(()=>!!$('#sbox')&&!$('#firstrun')&&/\d+ outfits/.test($('#mbox .mltxt').textContent)),'with a complete wardrobe the score and the month\'s count are back');
    // ---- the date bar's "Set location" beside the pill: Larger Text and page zoom
    const bar=async(w,h,ts)=>{await p.setViewportSize({width:w,height:h});
      await p.evaluate(ts=>{document.documentElement.style.setProperty('--tscale',String(ts));settings.location=null;sel=new Date(2026,10,16);renderToday();scrollTo(0,0)},ts);await settle(p,200);
      // (measured again for up to 2 s until the bar is in place: the resize and the scroll back to the top settle on their own time)
      const m=()=>p.evaluate(()=>{scrollTo(0,0);const t=$('#toast');if(t)t.classList.remove('on','act');/* (a toast from the steps above lay over the bar on a short screen) */const a=$('.day h2 .wxl'),pl=$('#wpill');if(!a||!pl)return null;const r=a.getBoundingClientRect(),rp=pl.getBoundingClientRect(),x=r.left+r.width/2;
        const at=document.elementFromPoint(x,r.top+r.height/2);
        return {top:Math.round(r.top),sy:scrollY,at:at&&(at.tagName+'.'+at.className+'#'+at.id),wrap:a.closest('.wx').classList.contains('wxwrap'),below:rp.top>=r.bottom-16,txt:a.textContent,w:r.width,h:r.height,cut:a.scrollWidth>a.clientWidth+1,hit:[r.top+3,r.top+r.height/2,r.bottom-3].filter(y=>document.elementFromPoint(x,y)===a).length,
          pill:pl.contains(document.elementFromPoint(rp.left+rp.width/2,rp.top+rp.height/2)),side:document.documentElement.scrollWidth<=innerWidth+1}});
      let b=await m();for(let k=0;k<20&&b&&!(b.hit>=2&&b.pill);k++){await p.waitForTimeout(100);b=await m()}return b};
    for(const [w,hh,ts] of [[390,844,1],[402,681,1.5],[268,454,1.5]]){const b=await bar(w,hh,ts);
      ok(b&&b.txt==='Set location'&&!b.cut&&b.w>40&&b.pill&&b.side,`${w} px, text ${ts*100}%: "Set location" shows whole beside or above the pill (${b&&Math.round(b.w)} px wide, ${b&&!(b.pill&&b.side)?JSON.stringify(b):`cut ${b&&b.cut}`})`);
      ok(b&&b.h>=44&&b.hit>=2,`${w} px, text ${ts*100}%: the link takes taps over ${b&&Math.round(b.h)} px`);
      if(ts===1)ok(b&&!b.wrap,`${w} px, usual text: one line, the pill beside it`);else ok(b&&b.wrap&&b.below,`${w} px, text ${ts*100}%: the pill goes under "Set location" at the right`)}
    await p.evaluate(()=>{document.documentElement.style.removeProperty('--tscale');TODAY_OVERRIDE=null;cache={}});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // the planned days and What to buy's own plan need the real planner
