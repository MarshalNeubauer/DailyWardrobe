// A piece never worn yet creeps only from the day it was added (planner.js fresh): it counted as rested a year, so two new brown suits
// (155 rest points each against 74 for a suit rested six weeks) outweighed JKT_SAME and were planned on consecutive workdays
// (the owner, 2026-11-16: "two brown suits on the 22nd and 23rd"). Made-up wardrobe: eight suits worn in turn since July (frozen
// days), two brown suits added two days ago and never worn.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      const old=['navy','grey','black','tan','olive','blue','burgundy','lightgrey'].map(c=>I('suit',c));
      const born=new Date(2026,10,14).getTime(),brownA=I('suit','brown',{added:born,name:'New brown'}),brownB=I('suit','deeptaupe',{added:born,name:'New deep taupe'});
      const shirts=[I('shirt','white'),I('shirt','lightblue'),I('shirt','white'),I('shirt','pink')],ties=[I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','charcoal'),I('tie','gold')];
      const shoes=[I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'})],belts=[I('belt','black',{leather:'calf'}),I('belt','brown',{leather:'calf'})];
      HOOK.items=[...old,brownA,brownB,...shirts,...ties,...shoes,...belts,I('socks','navy'),I('socks','charcoal')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';settings.holidays=null;settings.daysOff=[];HOOK.weather={};HOOK.climate=null;HOOK.TODAY_OVERRIDE='2026-11-16T08:00:00';
      // the eight old suits in turn on every workday from July (before the simulation starts) to yesterday (worn, frozen)
      HOOK.dayRecs={};let w=0;for(const d=new Date(2026,6,1);d<new Date(2026,10,16);d.setDate(d.getDate()+1)){if(!isWorkday(d))continue;
        const s=old[w%old.length],t=ties[w%ties.length],sh=shirts[w%shirts.length];w++;
        dayRecs[key(d)]={date:key(d),worn:true,ids:{top:s.id,bot:s.id,shirt:sh.id,tie:t.id,shoes:shoes[0].id,belt:belts[0].id}}}
      HOOK.cache={};const pl={...planMonth(2026,10),...planMonth(2026,11)};
      const days=Object.keys(pl).filter(d=>keyDate(d)>=new Date(2026,10,16)&&keyDate(d)<=new Date(2026,11,10)&&pl[d].top).sort((a,b)=>keyDate(a)-keyDate(b));
      const seq=days.map(d=>[d,pl[d].top.name||pl[d].top.primaryColor,jacketGroup(pl[d].top)]);
      const runs=seq.filter((x,i)=>i&&x[2]===seq[i-1][2]).map(x=>x[0]);
      const firstA=seq.findIndex(x=>x[1]==='New brown'),firstB=seq.findIndex(x=>x[1]==='New deep taupe');
      return {seq,runs,firstA,firstB}});
    ok(r.firstA>=0&&r.firstB>=0&&r.firstA<8&&r.firstB<8,`the two new brown suits still come round within the first two weeks (workdays ${r.firstA+1} and ${r.firstB+1})`);
    ok(Math.abs(r.firstA-r.firstB)>1,`the two new brown suits are not worn on consecutive workdays (${r.seq.slice(0,8).map(x=>x[0]+' '+x[1]).join(', ')})`);
    ok(r.runs.length===0,`no jacket colour group two workdays running while another well-rested one is free (${r.runs.join(', ')||'none'})`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses (planMonth), not the fixed test plan
