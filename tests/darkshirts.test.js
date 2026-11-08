// Option B: dark shirts are worn under light jackets with a tie that reads lighter than the shirt (a patterned tie counts
// its light stripes); with dark jackets the classic rule stays. A wardrobe of light and dark shirts rotates them all.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const r=await p.evaluate(()=>{const I=(type,primaryColor,x={})=>({id:type+primaryColor+(x.pattern||''),type,primaryColor,pattern:'solid',...x});
    const lightSuit=I('suit','lightgrey'),tan=I('suit','tan'),navySuit=I('suit','navy'),navyShirt=I('shirt','navy'),white=I('shirt','white');
    const stripe=I('tie','navy',{pattern:'stripe',secondaryColor:'white',tertiaryColor:'grey'}),navyTie=I('tie','navy'),silver=I('tie','silver');
    const o={suitDay:true,top:lightSuit,shirt:navyShirt,tie:stripe},o2={...o,tie:navyTie},rate=x=>rateOutfit(x).checks.reduce((m,c)=>(m[c.label]=c.pts+'/'+c.max,m),{});
    return {allowed:shirtScore(lightSuit,navyShirt)>0&&shirtScore(tan,navyShirt)>0,kept:shirtScore(navySuit,navyShirt)<=-20,
      tieStripe:tieScore(lightSuit,navyShirt,stripe)>tieScore(lightSuit,navyShirt,navyTie),tieSilver:tieScore(lightSuit,navyShirt,silver)>tieScore(lightSuit,navyShirt,navyTie),
      tieLum:Math.round(tieLum(stripe)),lightRule:tieScore(lightSuit,white,navyTie)>tieScore(lightSuit,white,silver),
      rate:rate(o),rate2:rate(o2),notes:[...new Set([o,o2].flatMap(x=>{const P=[];if(darkShirt(x.shirt)&&tieLum(x.tie)-LUM(x.shirt)<25)P.push('not lighter');return P}))]}});
  ok(r.allowed,'a navy shirt is allowed under a light grey or tan suit');
  ok(r.kept,'and still kept out under a navy suit');
  ok(r.tieStripe&&r.tieSilver,`on a dark shirt a lighter tie wins: silver, or navy with white stripes (reads as ${r.tieLum})`);
  ok(r.lightRule,'on a white shirt the darker tie still wins');
  ok(r.rate.Shirt==='7/10'&&r.rate['Tie and shirt'].startsWith('1'),`score: dark shirt under a light jacket ${r.rate.Shirt}, stripe tie on it ${r.rate['Tie and shirt']}`);
  ok(!r.rate2['Tie and shirt'].startsWith('15'),'a plain navy tie on a navy shirt loses points');
  // rotation with 6 light + 4 dark shirts, 2 light and 2 dark suits, mixed ties
  const rot=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+String(k++).padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
    const sh=[['white'],['white'],['lightblue'],['pink'],['ivory'],['lavender'],['navy'],['charcoal'],['black'],['burgundy']];
    items=[I('suit','navy'),I('suit','charcoal'),I('suit','lightgrey'),I('suit','tan'),I('blazer','navy'),I('pants','grey'),...sh.map(([c])=>I('shirt',c)),
      I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white',tertiaryColor:'grey'}),I('tie','navy'),I('tie','green'),I('tie','silver'),I('tie','lightblue'),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
    settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='auto';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-08T12:00:00';
    const cnt={};let bad=0,dkDays=0,days=0;for(const m of [10,11]){cache={};for(const [kk,o] of Object.entries(buildPlan(2026,m))){if(keyDate(kk)<new Date(2026,10,8)||keyDate(kk).getMonth()!==m)continue;days++;
      if(o.shirt){cnt[o.shirt.primaryColor]=(cnt[o.shirt.primaryColor]||0)+1;if(darkShirt(o.shirt)){dkDays++;if(!lightTop(o.top))bad++;if(o.tie&&tieLum(o.tie)-LUM(o.shirt)<25)bad++}}}}
    return {cnt,bad,dkDays,days}});
  ok(['navy','charcoal','black','burgundy'].every(c=>rot.cnt[c]>=1),`every dark shirt is worn in 8 weeks (${JSON.stringify(rot.cnt)})`);
  ok(rot.bad===0,'dark shirts only ever appear under a light jacket with a lighter tie');
  ok(rot.dkDays<=rot.days/3,`dark shirts stay occasional (${rot.dkDays} of ${rot.days} days)`);
  ok(errs.length===0,'no page errors');
  await browser.close();
};
