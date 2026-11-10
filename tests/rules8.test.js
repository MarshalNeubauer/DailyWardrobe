// Planner rules 8: odd trousers rotate (their rest counts over months, since blazer days are weekly); shoes get a day off
// when another pair suits; steel blue is a mid-tone shirt (worn under a darker jacket with a darker tie), not a "dark shirt".
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('suit','brown'),I('suit','tan'),I('blazer','navy'),I('blazer','charcoal'),I('blazer','tan'),
        I('pants','grey'),I('pants','charcoal'),I('pants','tan'),I('pants','khaki'),I('pants','navy'),I('pants','black'),
        I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','steelblue'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','brown'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('shoes','oxblood',{leather:'calf'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','oxblood',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='never';weather={};climate=null;dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};
      const seq=[];for(let m=10;m<17;m++){const y=2026+Math.floor(m/12),mm=m%12,pl=planMonth(y,mm);for(const [d,o] of Object.entries(pl)){const dt=keyDate(d);if(dt.getMonth()===mm&&dt.getFullYear()===y&&dt>=todayDate()&&o.top)seq.push([d,o])}}
      const pants={};seq.forEach(([,o])=>{if(!o.suitDay&&o.bot)pants[o.bot.primaryColor]=(pants[o.bot.primaryColor]||0)+1});
      const b2b=seq.filter((x,n)=>n&&x[1].shoes.id===seq[n-1][1].shoes.id&&keyDate(x[0])-keyDate(seq[n-1][0])<1.5*864e5);
      const forced=b2b.filter(([d,o])=>{const alt=items.filter(i=>i.type==='shoes'&&i.id!==o.shoes.id);return alt.every(s=>shoeScore(o.top,o.bot,s)<=-50)}).length;
      const sb=seq.filter(([,o])=>o.shirt.primaryColor==='steelblue');
      const sbi=items.find(i=>i.primaryColor==='steelblue');
      return {pants,blazerDays:seq.filter(([,o])=>!o.suitDay).length,b2b:b2b.length,forced,n:seq.length,minScore:Math.min(...seq.map(([,o])=>rateOutfit(o).score)),
        sb:sb.length,sbOk:sb.every(([,o])=>LUM(o.top)<LUM(o.shirt)-20&&LUM(o.tie)<LUM(o.shirt)-25),sbScore:sb.length?Math.min(...sb.map(([,o])=>rateOutfit(o).score)):0,
        dark:[darkShirt(sbi),darkShirt({primaryColor:'slate'}),darkShirt({primaryColor:'navy'}),darkShirt({primaryColor:'blue'})].join(),rules:PLAN_RULES}});
    const worn=Object.keys(r.pants);
    ok(['grey','charcoal','tan','khaki','navy'].every(c=>r.pants[c]>=2)&&!r.pants.black,`every pair of trousers that suits a blazer gets worn, not just each blazer's best match (${JSON.stringify(r.pants)} over ${r.blazerDays} blazer days); black odd trousers stay out`);
    ok(Math.max(...Object.values(r.pants))<=r.blazerDays*.5,`no single pair takes over the blazer days (${Math.max(...Object.values(r.pants))} of ${r.blazerDays})`);
    ok(r.b2b===r.forced,`shoes are not worn two days running when another pair suits the outfit (${r.b2b} repeats, ${r.forced} with no alternative)`);
    ok(r.dark==='false,true,true,false',`steel blue is not a "dark shirt"; slate and navy still are (${r.dark})`);
    ok(r.sb>=3&&r.sbOk&&r.sbScore>=80,`a steel blue shirt gets worn, under a darker jacket with a darker tie (${r.sb} days, lowest score ${r.sbScore})`);
    ok(r.minScore>=80,`the new rotation never costs a good outfit (lowest score ${r.minScore})`);
    ok(r.rules>=8,'PLAN_RULES was bumped so upcoming days are planned again');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
