// The same tie with the same shirt color within 10 workdays costs PAIR_GAP under any jacket (planner.js pairRepeat): comboRepeat only
// knows each jacket's own last two outfits, so a pink shirt and the black-and-pink tie worn on 15 Nov came back on 24 Nov under another
// suit (the owner, 2026-11-16). Made-up wardrobe: six suits, white and light blue shirts, two pink shirts, a navy tie with a pink stripe
// and five others; every workday from July worn in turn without the pink pair, then 15 Nov the navy suit, pink shirt A and that tie.
// Without the rule (PAIR_GAP 0) this plan repeats a tie with a shirt color 14 times to the end of December, the pink pair 4 workdays apart.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      const suits=['navy','charcoal','grey','brown','tan','lightgrey'].map(c=>I('suit',c));
      const plain=[I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','lightblue')],pinkA=I('shirt','pink',{name:'Pink A'}),pinkB=I('shirt','pink',{name:'Pink B'});
      const X=I('tie','navy',{secondaryColor:'pink',pattern:'stripe',name:'Navy-pink stripe'}),others=[I('tie','burgundy'),I('tie','green'),I('tie','gold'),I('tie','charcoal'),I('tie','navy')];
      const shoes=[I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'})],belts=[I('belt','black',{leather:'calf'}),I('belt','brown',{leather:'calf'})];
      HOOK.items=[...suits,...plain,pinkA,pinkB,X,...others,...shoes,...belts,I('socks','navy'),I('socks','charcoal')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';settings.holidays=null;settings.daysOff=[];HOOK.weather={};HOOK.climate=null;HOOK.TODAY_OVERRIDE='2026-11-16T08:00:00';
      HOOK.dayRecs={};let w=0;const R=(d,s,sh,t)=>{dayRecs[key(d)]={date:key(d),worn:true,ids:{top:s.id,bot:s.id,shirt:sh.id,tie:t.id,shoes:shoes[0].id,belt:belts[0].id}}};
      for(const d=new Date(2026,6,1);d<new Date(2026,10,15);d.setDate(d.getDate()+1)){if(!isWorkday(d))continue;R(d,suits[w%suits.length],plain[w%plain.length],others[w%others.length]);w++}
      R(new Date(2026,10,15),suits[0],pinkA,X);
      HOOK.cache={};const pl={...planMonth(2026,10),...planMonth(2026,11)};
      const days=Object.keys(pl).filter(d=>keyDate(d)>=new Date(2026,10,15)&&pl[d].tie&&pl[d].shirt).sort((a,b)=>keyDate(a)-keyDate(b));
      const seq=days.map(d=>({d,top:pl[d].top&&pl[d].top.id,sh:pl[d].shirt.name||pl[d].shirt.primaryColor,g:shirtGroup(pl[d].shirt),t:pl[d].tie.id,tn:pl[d].tie.name||pl[d].tie.primaryColor}));
      const reps=[];seq.forEach((x,i)=>{for(let j=Math.max(0,i-10);j<i;j++)if(seq[j].t===x.t&&seq[j].g===x.g){reps.push(x.d+' '+x.sh+'+'+x.tn+' after '+seq[j].d);break}});
      const pinkX=seq.map((x,i)=>x.t===X.id&&x.g==='pink'?i:-1).filter(i=>i>=0);
      return {reps,pinkX,pinkXd:pinkX.map(i=>seq[i].d+' '+seq[i].top),pinkB:seq.findIndex(x=>x.sh==='Pink B'),rules:PLAN_RULES,gap:'PAIR_GAP' in HOOK&&HOOK.PAIR_GAP,n:seq.length}});
    ok(r.gap===5&&r.rules>=23,`PAIR_GAP 5, PLAN_RULES 23 or later (${r.gap}, ${r.rules})`);
    ok(r.pinkX[0]===0&&r.pinkX.slice(1).every((x,i)=>x-r.pinkX[i]>10),`the pink shirt and navy-pink tie never come back within 10 workdays, under any suit (${r.pinkXd.join(', ')})`);
    ok(r.pinkX.length>=2,`the pair still comes round after its 10 workdays (${r.pinkXd.join(', ')})`);
    ok(r.pinkB>=0&&r.pinkB<=5,`the rested pink shirt B is still worn soon (workday ${r.pinkB})`);
    ok(r.reps.length<=3,`tie and shirt color repeats within 10 workdays only where no close outfit avoids them: ${r.reps.length} of ${r.n} workdays, 14 without the rule (${r.reps.join('; ')||'none'})`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses (planMonth), not the fixed test plan
