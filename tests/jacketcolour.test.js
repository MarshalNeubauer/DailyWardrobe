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
      // shirts and ties like the real wardrobe: staples plus a few greys, and several navy and black ties
      base.push(I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','charcoal'),I('shirt','midgrey'),I('shirt','lightgrey'),I('shirt','periwinkle'),I('shirt','lavender'),
        I('tie','navy'),I('tie','black'),I('tie','black',{pattern:'check',secondaryColor:'grey'}),I('tie','deepblue'),I('tie','brown',{pattern:'stripe',secondaryColor:'cream'}));
      items=[...base,...jackets];
      const seq=[];for(let m=10;m<16;m++){const pl=buildPlan(2026+Math.floor(m/12),m%12);for(const [d,o] of Object.entries(pl))if(keyDate(d).getMonth()===m%12&&o.top)seq.push([d,o.top.id,jacketGroup(o.top),shirtGroup(o.shirt),o.tie.id,tieGroup(o.tie),rateOutfit(o).score])}
      const after=f=>seq.filter((s,n)=>n&&f(seq[n-1],s)).map(s=>s[0]);
      const shirtRep=after((a,b)=>a[3]===b[3]&&!['white','lightblue'].includes(b[3])),tieSame=after((a,b)=>a[4]===b[4]),tieGroupRep=after((a,b)=>a[5]===b[5]);
      const tieUse={};seq.forEach(s=>tieUse[s[4]]=(tieUse[s[4]]||0)+1);const tieIds=base.filter(i=>i.type==='tie').map(i=>i.id);
      const same=after((a,b)=>a[2]===b[2]);
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
      return {shirtRep,tieSame,tieGroupRep,tiesUnused:tieIds.filter(t=>!tieUse[t]).length,minScore:Math.min(...seq.map(x=>x[6])),n:seq.length,same,unused:jk.filter(j=>!used[j.id]).map(j=>j.primaryColor),maxSuit:Math.max(...jk.filter(j=>j.type==='suit').map(j=>gap[j.id]||0)),maxBlazer:Math.max(...jk.filter(j=>j.type==='blazer').map(j=>gap[j.id]||0)),greyDays,dis,moved,
        groups:['lightgrey','midgrey','grey','darkgrey','charcoal','navy','darknavy','deepblue','steelblue','tan','khaki','brown'].map(c=>jacketGroup({primaryColor:c})).join()}});
    ok(r.groups==='grey,grey,grey,charcoal,charcoal,navy,navy,navy,blue,tan,tan,brown',`colour groups read like the eye does (${r.groups})`);
    ok(r.n>100&&r.same.length===0,`over six months no two consecutive workdays share a jacket colour group (${r.same.length} of ${r.n}: ${r.same.slice(0,4).join(' ')})`);
    ok(r.shirtRep.length===0,`no shirt colour group (e.g. dark grey then light grey) on consecutive workdays, apart from white and light blue (${r.shirtRep.join(' ')})`);
    ok(r.tieSame.length===0&&r.tieGroupRep.length===0,`never the same tie, nor the same tie colour, on consecutive workdays (${r.tieSame.length} / ${r.tieGroupRep.length})`);
    ok(r.tiesUnused===0,'every tie gets worn');
    ok(r.minScore>=80,`variety never costs a good outfit (lowest score ${r.minScore})`);
    ok(!r.unused.length&&r.maxSuit<=14&&r.maxBlazer<=20,`every jacket stays in rotation: 8 suits on 4 days a week come back within 14 workdays, 3 blazers on 1 day a week within 4 weeks (longest ${r.maxSuit} / ${r.maxBlazer}${r.unused.length?', unused: '+r.unused.join():''})`);
    ok(r.greyDays>=20&&r.greyDays<=23,`a wardrobe of only grey jackets is still planned (${r.greyDays} days in December)`);
    ok(r.dis.length===0,`November and December agree on the days they share (${r.dis.join(' ')})`);
    ok(r.moved.length===0,`recording past days does not change the plan ahead (${r.moved.join(' ')})`);
    // your Nov 17/18 case: a navy suit unworn for weeks must not follow the other navy; a pinned next day is respected
    const c=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:'x'+type+(k++),type,primaryColor,pattern:'solid',...x});
      const navyA=I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),navyB=I('suit','navy'),g1=I('suit','lightgrey'),br=I('suit','brown'),bl=I('suit','black'),tn=I('suit','tan');
      items=[navyA,navyB,g1,br,bl,tn,I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','green'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';
      // history: navy B last worn in September; the others in early November; navy A pinned for Nov 17
      dayRecs={'2026-9-29':{date:'2026-9-29',ids:{top:navyB.id},suitDay:true,worn:true},'2026-11-17':{date:'2026-11-17',force:{top:navyA.id}}};
      ['2026-11-1','2026-11-2','2026-11-3','2026-11-4','2026-11-5','2026-11-8'].forEach((d,n)=>dayRecs[d]={date:d,ids:{top:[g1,br,bl,tn,g1,br][n].id},suitDay:true,worn:true});
      // the days before are pinned to the other suits (swaps), so navy B builds up weeks of rest
      ['2026-11-9','2026-11-10','2026-11-11','2026-11-12','2026-11-15','2026-11-16'].forEach((d,n)=>dayRecs[d]={date:d,force:{top:[bl,tn,g1,br,bl,tn][n].id}});
      const pl=buildPlan(2026,10),t=d=>pl[d]&&pl[d].top&&pl[d].top.id;
      // a pinned navy on Nov 23: the Sunday before must not be navy
      dayRecs['2026-11-23']={date:'2026-11-23',force:{top:navyB.id}};const pl2=buildPlan(2026,10);
      return {n17:t('2026-11-17')===navyA.id,n18:t('2026-11-18')!==navyB.id&&t('2026-11-16')!==navyB.id,n22:pl2['2026-11-22'].top.primaryColor,n23:pl2['2026-11-23'].top.id===navyB.id}});
    ok(c.n17&&c.n18,'a navy suit left unworn for weeks still does not come right before or after the other navy');
    ok(c.n23&&c.n22!=='navy',`the day before a pinned navy day is not navy (${c.n22})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
