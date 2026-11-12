// Chinos, jeans and shoe styles. Trousers have a kind (dress, chinos, jeans) and shoes a style (oxford, derby, loafer, boot, sneaker);
// an item without one is dress trousers or oxfords, planned exactly as before. Jeans go on days without a jacket (with a blazer only
// when the dress code allows it), never with a suit; a formal day, a wedding or a funeral takes dress trousers; boots and sneakers
// go only with chinos or jeans. The Add card, the editor and the photo reader know both.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const base=await p.evaluate(()=>({k:[trouserKind({type:'pants'}),trouserKind({type:'pants',trouserKind:'jeans'}),trouserKind({type:'suit',trouserKind:'jeans'})].join(),
      s:[shoeStyle({type:'shoes'}),shoeStyle({type:'shoes',shoeStyle:'loafer'}),shoeStyle({type:'shoes',shoeStyle:'clog'})].join(),
      w:[typeWord({type:'pants'}),typeWord({type:'pants',trouserKind:'chinos'}),typeWord({type:'shoes'}),typeWord({type:'shoes',shoeStyle:'sneaker'})].join(),
      n:nm({type:'pants',primaryColor:'denim',pattern:'solid',trouserKind:'jeans'}),c:COLS_BY.pants.p.includes('stone')&&COLS_BY.pants.p.includes('denim')}));
    ok(base.k==='dress,jeans,dress'&&base.s==='oxford,loafer,oxford','without a kind or style an item is dress trousers or oxfords');
    ok(base.w==='trousers,chinos,shoes,sneakers'&&/denim jeans/.test(base.n)&&base.c,`descriptions name them ("${base.n}"); stone and denim are trouser colours`);
    // the planner
    const plan=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      const W=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('blazer','grey'),I('pants','grey'),I('pants','khaki',{trouserKind:'chinos'}),I('pants','stone',{trouserKind:'chinos'}),I('pants','denim',{trouserKind:'jeans'}),I('pants','black',{trouserKind:'jeans'}),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf',shoeStyle:'loafer'}),I('shoes','white',{leather:'calf',shoeStyle:'sneaker'}),I('shoes','brown',{leather:'suede',shoeStyle:'boot'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      const run=(dress,recs={})=>{items=W;settings={...settings,workdays:[0,1,2,3,4],blazerDays:[1,3],dress,laundryDays:1,learn:null,holidays:null,daysOff:[]};weather={};climate=null;
        TODAY_OVERRIDE='2026-11-08T12:00:00';dayRecs=recs;cache={};const P=buildPlan(2026,10),days=Object.values(P).filter(o=>o&&(o.top||o.shirt));
        const kindOf=o=>o.bot&&o.bot.type==='pants'?trouserKind(o.bot):o.suitDay?'suit':'-';
        return {n:days.length,blazer:[...new Set(days.filter(o=>o.top&&!o.suitDay).map(kindOf))].sort().join(),suitShoes:[...new Set(days.filter(o=>o.suitDay).map(o=>shoeStyle(o.shoes)))].sort().join(),
          noJ:[...new Set(days.filter(o=>!o.top).map(kindOf))].sort().join(),dressShoes:[...new Set(days.filter(o=>o.bot&&kindOf(o)==='dress').map(o=>shoeStyle(o.shoes)))].sort().join(),
          casualShoes:[...new Set(days.filter(o=>['chinos','jeans'].includes(kindOf(o))).map(o=>shoeStyle(o.shoes)))].sort().join(),
          formal:(o=>o?kindOf(o):'none')(P['2026-11-12'])}};
      return {plain:run(undefined),jeans:run({jacket:true,tie:true,jeans:true}),noJ:run({jacket:false,tie:true}),formal:run({jacket:false,tie:true},{'2026-11-12':{date:'2026-11-12',formal:true}})}});
    ok(plan.plain.n>15&&!/jeans/.test(plan.plain.blazer)&&/chinos|dress/.test(plan.plain.blazer),`blazer days take dress trousers or chinos, never jeans (${plan.plain.blazer})`);
    ok(/jeans/.test(plan.jeans.blazer),`with "Jeans with a blazer" on, jeans come with a blazer too (${plan.jeans.blazer})`);
    ok(/jeans/.test(plan.noJ.noJ)&&/chinos/.test(plan.noJ.noJ),`without jackets every kind is worn (${plan.noJ.noJ})`);
    ok(!/boot|sneaker/.test(plan.plain.suitShoes)&&!/sneaker/.test(plan.noJ.dressShoes),`suits never get boots or sneakers (${plan.plain.suitShoes}), dress trousers no sneakers (${plan.noJ.dressShoes})`);
    ok(/sneaker/.test(plan.noJ.casualShoes),`chinos and jeans get the casual shoes too, sneakers included (${plan.noJ.casualShoes})`);
    ok(plan.formal.formal==='suit'||plan.formal.formal==='dress',`a formal day, even without jackets, is dressed in full: a suit, or dress trousers, never chinos or jeans (${plan.formal.formal})`);
    const sc=await p.evaluate(()=>{const s=x=>({type:'shoes',primaryColor:'black',leather:'calf',...x}),suit={type:'suit',primaryColor:'navy'},jeans={type:'pants',primaryColor:'denim',trouserKind:'jeans'};
      return [shoeScore(suit,suit,s({})),shoeScore(suit,suit,s({shoeStyle:'sneaker'})),shoeScore(null,jeans,s({shoeStyle:'sneaker'}))-shoeScore(null,jeans,s({}))]});
    ok(sc[1]<=-50&&sc[2]===0,`a sneaker with a suit scores as shoes that don't suit (${sc[1]}), with jeans as well as an oxford`);
    // the Add card and the editor
    const ui=await p.evaluate(()=>{items=[];cache={};openAdd();addManual();const i=queue.length-1;setq(i,'type','pants');renderAdd();const kind=!!document.querySelector('#queue select[onchange*="\'trouserKind\'"]');
      setq(i,'trouserKind','jeans');setq(i,'primaryColor','denim');setq(i,'type','shoes');renderAdd();const style=!!document.querySelector('#queue select[onchange*="\'shoeStyle\'"]');setq(i,'type','pants');return {kind,style}});
    ok(ui.kind&&ui.style,'the Add card has Kind for trousers and Style for shoes');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
  // the photo reader is told about both
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'};let sent=null;const realFetch=globalThis.fetch;
  globalThis.fetch=async(u,o)=>{if(/anthropic/.test(String(u))){sent=JSON.parse(o.body);return new Response(JSON.stringify({content:[{type:'text',text:'{}'}],stop_reason:'end_turn'}),{status:200})}return realFetch(u,o)};
  try{await worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,iVBORw0KGgo='})}),env)}catch{}
  globalThis.fetch=realFetch;
  const s=JSON.stringify(sent||{});
  ok(/trouserKind/.test(s)&&/shoeStyle/.test(s)&&/chinos/.test(s)&&/sneaker/.test(s)&&/stone/.test(s),'the photo reader is asked for the kind of trousers and the style of shoes, and knows stone and denim');
};
