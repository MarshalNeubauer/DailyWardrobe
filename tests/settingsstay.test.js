// Work finishing in the background (photos, weather, the start-up plan check) redraws Today with refreshToday(): while Settings is
// open it waits until Settings closes, since drawing Today closes Settings (opened right after launch, it snapped shut).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today');
      openSettings();let drawn=0;const r0=renderToday;renderToday=function(){drawn++;return r0.apply(this,arguments)};
      refreshToday();const stillOpen=settingsOpen(),during=drawn;closeSettings();const after=drawn;renderToday=r0;
      refreshToday();return {stillOpen,during,after,closedNow:!settingsOpen()}});
    ok(r.stillOpen&&r.during===0,'a background redraw while Settings is open leaves Settings open');
    ok(r.after===1&&r.closedNow,'Today is redrawn once Settings closes');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
