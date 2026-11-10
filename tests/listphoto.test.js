// Outfit list: tapping a piece's swatch or name unfolds its photo inside the list (one at a time), so you can see exactly
// which shirt it is; pieces without a photo show their drawing with a note; a swap keeps the open piece open.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(ph=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{photo:ph}),I('suit','charcoal',{photo:ph}),I('shirt','white',{photo:ph}),I('shirt','lightblue',{photo:ph}),I('tie','burgundy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.planRules=PLAN_RULES;dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};listOpen=true;openRow=null;show('today')},PH);
    const h=s=>p.evaluate(s=>Math.round(document.querySelector('#rp-'+s).getBoundingClientRect().height),s);
    ok(await h('shirt')===0&&await p.evaluate(()=>document.querySelector('#ri-shirt .rowtap').getAttribute('aria-expanded'))==='false','pieces start closed');
    await p.click('#ri-shirt .rowtap .cap');await p.waitForTimeout(600);
    const a=await p.evaluate(()=>{const o=planFor()[key(sel)],img=document.querySelector('#rp-shirt img.rpic');return {src:img&&img.getAttribute('src')===o.shirt.photo,exp:document.querySelector('#ri-shirt .rowtap').getAttribute('aria-expanded'),inList:!!img&&!!img.closest('#ibox .list')}});
    ok(a.src&&a.exp==='true'&&a.inList&&await h('shirt')>150,'tapping the shirt name unfolds the photo of that exact shirt, inside the list');
    await p.click('#ri-top .rowtap .dot');await p.waitForTimeout(600);
    ok(await h('top')>150&&await h('shirt')===0,'tapping the suit swatch opens the suit and closes the shirt');
    await p.click('#ri-top .rowtap');await p.waitForTimeout(600);
    ok(await h('top')===0&&await p.evaluate(()=>openRow===null),'tapping it again folds it away');
    await p.click('#ri-tie .rowtap');await p.waitForTimeout(600);
    ok(await p.evaluate(()=>!!document.querySelector('#rp-tie .rpic.draw svg')&&/No photo of this item yet/.test(document.querySelector('#rp-tie').textContent)),'a piece without a photo shows its drawing and says so');
    await p.click('#ri-tie .swap');await p.click('#pick-next');await p.waitForTimeout(300);
    ok(await p.evaluate(()=>document.querySelector('#ri-tie').classList.contains('open')&&planFor()[key(sel)].overrides),'swapping the open piece keeps it open, now showing the new one');
    ok(await p.evaluate(()=>!!document.querySelector('#ibox .vest-row')||!planFor()[key(sel)].vest),'the vest row is still in the list');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
