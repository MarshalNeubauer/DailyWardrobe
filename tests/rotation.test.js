// A full rail of shirts rotates: shirts that are less "classic" (periwinkle, beige, lavender, mid grey) still come around,
// because rest counts for more on shirts; outfit quality stays high.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+String(k++).padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
    const shirts=[['paleyellow','solid'],['midgrey','fine-texture'],['lightblue','solid'],['white','dobby'],['pink','solid'],['white','woven'],['lavender','solid'],['periwinkle','end-on-end'],['ivory','solid'],['white','textured'],['beige','solid']];
    items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('suit','grey'),I('suit','navy'),I('blazer','navy'),I('pants','grey'),
      ...shirts.map(([c,pa])=>I('shirt',c,{pattern:pa})),
      I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','green'),I('tie','navy'),I('tie','grey'),I('tie','purple'),I('tie','brown'),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('watch','black',{metal:'silver'}),I('socks','navy'),I('socks','charcoal')];
    settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='auto';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-08T12:00:00';
    const cnt={};for(const s of items.filter(i=>i.type==='shirt'))cnt[s.id]=0;let sum=0,n=0,min=100,maxRun=0;
    for(const m of [10,11]){cache={};const P=buildPlan(2026,m);for(const [kk,o] of Object.entries(P)){if(keyDate(kk)<new Date(2026,10,8)||keyDate(kk).getMonth()!==m)continue;
      if(o.shirt)cnt[o.shirt.id]++;const sc=rateOutfit(o).score;sum+=sc;n++;min=Math.min(min,sc)}}
    const c=Object.values(cnt);return {min:Math.min(...c),max:Math.max(...c),avg:sum/n,low:min,days:n,
      byName:Object.entries(cnt).map(([id,v])=>items.find(i=>i.id===id).primaryColor+'='+v).join(' ')}});
  ok(r.min>=2,`every one of 11 shirts is worn at least twice in ${r.days} workdays (${r.byName})`);
  ok(r.max-r.min<=4,'no shirt hogs the rotation');
  ok(r.avg>=95&&r.low>=90,`outfit quality stays high (average ${r.avg.toFixed(1)}, lowest ${r.low})`);
  ok(errs.length===0,'no page errors');
  await browser.close();
};
