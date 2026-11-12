// The scroll that goes with an unfold or a fold (app.js pageScroll): the page is scrolled once at the start and Today slides back by
// that much and eases to rest with the cards, so no script moves the page on any frame. A scrollTo on every frame ran out of step with
// the clip and the slide on an iPhone and the calendar, pieces and score cards juddered. Checked here: one scroll, a slide of Today,
// the card moving smoothly on screen, and a second tap in the middle carrying on from where the page is drawn.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};scoreOpen=listOpen=monthOpen=false;show('today');scrollTo(0,0)});
    await p.waitForFunction(()=>{const el=$('#mpanel-in');return el&&el.querySelectorAll('.mc[data-k]').length>=28},null,{timeout:5000});await settle(p,300);
    const quiet=()=>p.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect&&a.effect.getComputedTiming().endTime!==Infinity),null,{timeout:4000});
    // watch one tap: how often the page is scrolled, whether Today slides, and the card's top on screen every frame
    const watch=(tap,el)=>p.evaluate(({tap,el})=>new Promise(res=>{let scrolls=0;const on=()=>scrolls++;addEventListener('scroll',on);
      const y0=scrollY;new Function(tap)();const slide=($('#today').getAnimations()[0]||null);const tr=slide?slide.effect.getKeyframes()[0].transform:'';const tops=[];
      const f=()=>{tops.push(Math.round($(el).getBoundingClientRect().top));if(document.getAnimations().some(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime!==Infinity)||tops.length<5)requestAnimationFrame(f);
        else setTimeout(()=>{removeEventListener('scroll',on);res({scrolls,tr,tops,moved:scrollY-y0,left:getComputedStyle($('#today')).transform})},50)};requestAnimationFrame(f)}),{tap,el});
    const smooth=w=>{let jump=0,moving=0;for(let i=1;i<w.tops.length;i++){const d=Math.abs(w.tops[i]-w.tops[i-1]);jump=Math.max(jump,d);if(d>2)moving++}
      const way=Math.abs(w.tops[w.tops.length-1]-w.tops[0]);return {jump,moving,way,ok:way<4||(jump<=Math.max(way*.4,40)&&moving>=5)}};
    for(const [name,tap,el] of [['calendar','toggleMonth()','#mbox'],['pieces list','toggleList()','#ibox'],['score','toggleScore()','#sbox']]){
      // the card's head near the bottom of the screen, so unfolding has to scroll to show it
      await p.evaluate(el=>{const b=$(el);scrollTo(0,0);scrollBy(0,b.getBoundingClientRect().top-innerHeight+200)},el);await settle(p,200);
      const u=await watch(tap,el),su=smooth(u);
      ok(u.moved>40&&u.scrolls<=2&&/translateY\(\d/.test(u.tr)&&u.left==='none',`unfolding the ${name} scrolls the page once (${u.scrolls} scroll events for ${u.moved}px) and slides Today back by it (${u.tr}), nothing left over`);
      ok(su.ok,`and the ${name} card moves smoothly on screen (largest step ${su.jump} of ${su.way}px over ${su.moving} frames: ${u.tops.join(' ')})`);
      await quiet();
      // folding from the bottom of the page: the page has to come back up, also once
      await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await settle(p,200);
      const f=await watch(tap,el),sf=smooth(f);
      ok(f.scrolls<=3&&f.left==='none'&&sf.ok,`folding the ${name} from the page's end: ${f.scrolls} scroll events, moving smoothly (largest step ${sf.jump} of ${sf.way}px: ${f.tops.join(' ')})`);
      await quiet();await settle(p,100);
    }
    // a second tap while the first still runs: the page carries on from where it is drawn, no jump
    await p.evaluate(()=>{const b=$('#mbox');scrollTo(0,0);scrollBy(0,b.getBoundingClientRect().top-innerHeight+200)});await settle(p,200);
    const twice=await p.evaluate(()=>new Promise(res=>{toggleMonth();setTimeout(()=>{const before=Math.round($('#mbox').getBoundingClientRect().top);toggleMonth();const after=Math.round($('#mbox').getBoundingClientRect().top);
      setTimeout(()=>res({before,after,left:getComputedStyle($('#today')).transform,open:$('#mbox').classList.contains('open')}),1400)},150)}));
    ok(Math.abs(twice.after-twice.before)<=3&&twice.left==='none'&&!twice.open,`folding again halfway through the unfold starts from where the card is (${twice.before} → ${twice.after}px) and ends shut, nothing left over`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
