// "What to buy": the analysis runs in a Web Worker, ranks purchases, explains them, and "I bought this" adds them.
module.exports=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('watch','grey',{metal:'silver'}),I('socks','navy')];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};show('wardrobe')});
  const t0=Date.now();
  await p.click('text=Analyze my wardrobe');
  await p.waitForFunction(()=>shop&&!shopBusy,null,{timeout:60000});
  const secs=(Date.now()-t0)/1000;
  const r=await p.evaluate(()=>shop.res);
  ok(r.recs.length>=3,`recommendations returned (${r.recs.length} of ${r.checked} candidates)`);
  ok(r.recs.length>0&&r.after.problems<=r.base.problems&&r.after.rest<=r.base.rest,'buying the recommendations reduces problem days and short-rest days');
  ok(!(r.recs.some(x=>/overcoat/.test(x.name))&&r.recs.some(x=>/raincoat/.test(x.name)&&x.why.some(w=>w.includes('no overcoat')))),'no double counting: two coats are not both credited with the same fix');
  ok(r.recs.every(x=>x.why.length>0),'every recommendation says why');
  ok(r.recs.slice(0,3).some(x=>/suit/.test(x.name)),`a suit is in the top 3 (two suits can't rest): ${r.recs.slice(0,3).map(x=>x.name).join(', ')}`);
  ok(r.base.rest>0&&r.recs.some(x=>/suit/.test(x.name)&&x.why.some(w=>w.includes('rest'))),'the suit recommendation explains the rest problem');
  ok(secs<45,`analysis finished in ${secs.toFixed(1)}s`);
  ok((await p.$$('#wardrobe .recs li')).length===r.recs.length,'recommendations are listed with thumbnails');
  const used=await p.evaluate(()=>{const w=performance.getEntriesByType('resource').some(e=>e.name.includes('analysis-worker.js'));return w});
  ok(used,'analysis ran in a background Web Worker');
  // "I bought this" adds the item(s) and re-runs
  const first=r.recs[0].name,n0=await p.evaluate(()=>items.length);
  await p.click('#wardrobe .recs li >> nth=0 >> text=I bought this');
  await p.waitForFunction(n=>items.length>n&&shop&&!shopBusy,n0,{timeout:60000});
  const after=await p.evaluate(()=>({n:items.length,names:shop.res.recs.map(x=>x.name)}));
  ok(after.n>n0&&!after.names.includes(first),`"I bought this" adds ${first} and it drops off the list`);
  // a well-stocked wardrobe needs little
  const full=await p.evaluate(`(()=>{const W=${WARDROBES};const r=runAnalysis([...W.realistic,{id:'oc',type:'overcoat',primaryColor:'charcoal',pattern:'solid'},{id:'rc',type:'raincoat',primaryColor:'tan',pattern:'solid'}],todayDate(),8);return {n:r.recs.length,top:r.recs[0]?r.recs[0].gain:0,problems:r.base.problems}})()`);
  ok(full.top<r.recs[0].gain,`a well-stocked wardrobe gets smaller gains (top +${full.top} vs +${r.recs[0].gain})`);
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
