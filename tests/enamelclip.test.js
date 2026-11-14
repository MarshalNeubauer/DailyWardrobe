// Enamel tie clips are planned by the tie (2026-11-14, the owner: 7 of his 9 clips were never planned; an enamel clip scored 0 against a
// silver watch-and-buckle match's 9). planner.js enamelPref: an accent of the tie wins, the tie's own colour or a near one comes round,
// a clash stays off; gold stays off against a silver watch and buckle (the owner: "keep gold off").
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      const T1=I('tie','taupe',{pattern:'stripe',secondaryColor:'cream',tertiaryColor:'steelblue'}),T2=I('tie','burgundy'),T3=I('tie','green'),T4=I('tie','navy',{pattern:'stripe',secondaryColor:'white'});
      const silver=I('tieclip','silver'),blue=I('tieclip','blue'),red=I('tieclip','red'),navy=I('tieclip','navy'),gold=I('tieclip','gold');
      const prefs={accent:enamelPref(blue,T1),tone:enamelPref(red,T2),toneNavy:enamelPref(navy,T4),near:enamelPref(blue,T4),clash:enamelPref(blue,T3),clashRed:enamelPref(red,T1),none:enamelPref(blue,null)};
      items=[I('blazer','navy'),I('blazer','charcoal'),I('pants','grey'),I('pants','tan'),I('shirt','white'),I('shirt','lightblue'),T1,T2,T3,T4,
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal'),
        I('watch','silver',{metal:'silver'}),silver,blue,red,navy,gold];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[0,1,2,3,4];settings.vestMode='never';weather={};climate=null;dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};
      // the same day with each tie picked
      const on=t=>{dayRecs={'2026-11-16':{date:'2026-11-16',force:{tie:t.id}}};cache={};const o=planMonth(2026,10)['2026-11-16'];return o.clip?o.clip.primaryColor:null};
      const picks={T1:on(T1),T3:on(T3)};dayRecs={};cache={};
      // six months: every clip but gold comes round
      const n={};for(let m=10;m<16;m++){const pl=planMonth(2026+Math.floor(m/12),m%12);for(const [d,o] of Object.entries(pl))if(keyDate(d).getMonth()===m%12&&keyDate(d)>=todayDate()&&o.clip)n[o.clip.primaryColor]=(n[o.clip.primaryColor]||0)+1}
      return {prefs,picks,n}});
    const P=r.prefs;
    ok(P.accent===11&&P.tone===8&&P.toneNavy===8&&P.near===8&&P.clash===-5&&P.clashRed===-5&&P.none===0,`an enamel clip: an accent of the tie 11, its colour or a near one 8, a clash -5 (${JSON.stringify(P)})`);
    ok(r.picks.T1==='blue',`on a taupe, cream and steel blue stripe the blue enamel clip is chosen over silver (${r.picks.T1})`);
    ok(r.picks.T3==='silver',`on a green tie, where every enamel clip clashes, silver (${r.picks.T3})`);
    ok(r.n.blue>0&&r.n.red>0&&r.n.navy>0&&r.n.silver>0&&!r.n.gold,`six months: the enamel clips come round, gold never with a silver watch and buckle (${JSON.stringify(r.n)})`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses (planMonth), not the fixed test plan
