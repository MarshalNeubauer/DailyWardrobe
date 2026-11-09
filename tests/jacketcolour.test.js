// Jacket colour variety: no two consecutive workdays (weekends skipped) in the same jacket colour group when the wardrobe
// has another choice; every jacket stays in rotation; a one-colour wardrobe still plans; neighbouring months agree and
// recording past days does not change the plan ahead.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      const base=[I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),I('tie','gold'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal')];
      const jackets=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','navy'),I('suit','lightgrey'),I('suit','midgrey'),I('suit','grey',{pattern:'herringbone'}),I('suit','brown'),I('suit','black'),I('suit','tan'),
        I('blazer','lightgrey'),I('blazer','steelblue'),I('blazer','tan'),I('pants','charcoal'),I('pants','grey'),I('pants','khaki')];
      items=[...base,...jackets];settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];weather={};dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';
      const seq=[];for(let m=10;m<16;m++){const pl=buildPlan(2026+Math.floor(m/12),m%12);for(const [d,o] of Object.entries(pl))if(keyDate(d).getMonth()===m%12&&o.top)seq.push([d,o.top.id,jacketGroup(o.top)])}
      const same=seq.filter((s,n)=>n&&seq[n-1][2]===s[2]).map(s=>s[0]);
      const used={},gap={},last={};seq.forEach(([d,id],n)=>{used[id]=(used[id]||0)+1;if(last[id]!==undefined)gap[id]=Math.max(gap[id]||0,n-last[id]);last[id]=n});
      const jk=jackets.filter(j=>j.type!=='pants');
      // a one-colour wardrobe still gets planned (repeats allowed)
      items=[...base,I('suit','lightgrey'),I('suit','midgrey'),I('suit','grey'),I('blazer','grey'),I('pants','charcoal')];
      const grey=buildPlan(2026,11),greyDays=Object.entries(grey).filter(([d,o])=>keyDate(d).getMonth()===11&&o.top).length;
      // consistency: neighbouring months agree; recording past days leaves the future alone
      items=[...base,...jackets];dayRecs={};
      const N=buildPlan(2026,10),D=buildPlan(2026,11);const dis=Object.keys(D).filter(k=>N[k]&&D[k].top&&JSON.stringify(idsOf(N[k]))!==JSON.stringify(idsOf(D[k])));
      const T=todayDate();for(const [d,o] of Object.entries(N))if(keyDate(d)<T&&o.top)dayRecs[d]={date:d,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest};
      const N2=buildPlan(2026,10),moved=Object.keys(N2).filter(k=>keyDate(k)>=T&&N2[k].top&&JSON.stringify(idsOf(N[k]))!==JSON.stringify(idsOf(N2[k])));
      return {n:seq.length,same,unused:jk.filter(j=>!used[j.id]).map(j=>j.primaryColor),maxSuit:Math.max(...jk.filter(j=>j.type==='suit').map(j=>gap[j.id]||0)),maxBlazer:Math.max(...jk.filter(j=>j.type==='blazer').map(j=>gap[j.id]||0)),greyDays,dis,moved,
        groups:['lightgrey','midgrey','grey','darkgrey','charcoal','navy','darknavy','deepblue','steelblue','tan','khaki','brown'].map(c=>jacketGroup({primaryColor:c})).join()}});
    ok(r.groups==='grey,grey,grey,charcoal,charcoal,navy,navy,navy,blue,tan,tan,brown',`colour groups read like the eye does (${r.groups})`);
    ok(r.n>100&&r.same.length===0,`over six months no two consecutive workdays share a jacket colour group (${r.same.length} of ${r.n}: ${r.same.slice(0,4).join(' ')})`);
    ok(!r.unused.length&&r.maxSuit<=14&&r.maxBlazer<=20,`every jacket stays in rotation: 8 suits on 4 days a week come back within 14 workdays, 3 blazers on 1 day a week within 4 weeks (longest ${r.maxSuit} / ${r.maxBlazer}${r.unused.length?', unused: '+r.unused.join():''})`);
    ok(r.greyDays>=20&&r.greyDays<=23,`a wardrobe of only grey jackets is still planned (${r.greyDays} days in December)`);
    ok(r.dis.length===0,`November and December agree on the days they share (${r.dis.join(' ')})`);
    ok(r.moved.length===0,`recording past days does not change the plan ahead (${r.moved.join(' ')})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
