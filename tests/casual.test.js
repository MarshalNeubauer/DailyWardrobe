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
    // each is drawn as what it is
    const dr=await p.evaluate(()=>{const sh=(st,x={})=>itemThumb({id:'d',type:'shoes',primaryColor:'brown',pattern:'solid',leather:'calf',...(st?{shoeStyle:st}:{}),...x});
      const strip=s=>s.replace(/th\d+-/g,'');const svgs=['','derby','loafer','boot','sneaker'].map(st=>strip(sh(st)));
      const pt=k=>strip(itemThumb({id:'p',type:'pants',primaryColor:'denim',pattern:'solid',...(k?{trouserKind:k}:{})}));
      return {distinct:new Set(svgs).size,oxfordSame:svgs[0]===strip(sh('oxford')),sneakerSole:/#f4f2ec/.test(svgs[4])&&/#000000/i.test(strip(sh('sneaker',{secondaryColor:'black'})))||/#16161a/.test(strip(sh('sneaker',{secondaryColor:'black'}))),
        canvas:/<pattern[^>]+tx/.test(strip(sh('sneaker',{leather:'canvas'}))),jeans:/#b87333/.test(pt('jeans'))&&/#d9a441/.test(pt('jeans')),chinos:pt('chinos')!==pt('')&&!/#b87333/.test(pt('chinos')),dress:!/tw/.test(pt(''))}});
    ok(dr.distinct===5&&dr.oxfordSame,'oxford, derby, loafer, boot and sneaker each have a drawing of their own (no style is the oxford)');
    ok(dr.sneakerSole&&dr.canvas,'a sneaker\'s sole takes its second colour (white without one); canvas and knit have a texture');
    ok(dr.jeans&&dr.chinos&&dr.dress,'jeans are drawn as denim with gold stitching and a rivet, chinos as a cotton twill, dress trousers as before');
    // materials by style: a sneaker in leather, suede, canvas or knit
    const mat=await p.evaluate(()=>{openAdd();addManual();const i=queue.length-1;setq(i,'type','shoes');setq(i,'shoeStyle','loafer');setq(i,'leather','cordovan');setq(i,'shoeStyle','sneaker');renderAdd();
      const card=document.querySelectorAll('#queue .card')[i],lab=[...card.querySelectorAll('label')].find(l=>l.querySelector('select[onchange*="\'leather\'"]'));
      return {label:lab&&lab.firstChild.textContent.trim(),opts:lab?[...lab.querySelectorAll('option')].map(o=>o.textContent).join():'',leather:queue[i].leather,
        boots:leathersFor({type:'shoes',shoeStyle:'boot'}).join(),belt:leathersFor({type:'belt'}).includes('canvas')}});
    ok(mat.label==='Material'&&mat.opts==='Leather,Suede,Canvas,Knit'&&mat.leather==='calf',`a sneaker has Material: ${mat.opts}; switching a cordovan loafer to a sneaker makes it leather (${mat.leather})`);
    ok(!/canvas|knit/.test(mat.boots)&&!mat.belt,'boots and belts stay in leathers');
    // the item sheet: Material right under Style, above Notes
    const sheet=await p.evaluate(async()=>{closeSettings&&closeSettings();items=[{id:'sn9',type:'shoes',primaryColor:'white',pattern:'solid',leather:'canvas',shoeStyle:'sneaker',added:1}];cache={};show('wardrobe');openItem('sn9');await new Promise(r=>setTimeout(r,400));
      const labs=[...document.querySelectorAll('#item-view label')].map(l=>(l.firstChild&&l.firstChild.textContent||'').trim()).filter(Boolean);
      const sel=[...document.querySelectorAll('#item-view select')].find(s=>/'leather'/.test(s.getAttribute('onchange')||''));
      return {labs:labs.join(','),opts:sel?[...sel.options].map(o=>o.textContent).join():'',val:sel&&sel.value}});
    const li=sheet.labs.split(',');
    ok(li.indexOf('Material')===li.indexOf('Style')+1&&li.indexOf('Material')<li.indexOf('Notes')&&sheet.opts==='Leather,Suede,Canvas,Knit'&&sheet.val==='canvas',`the item sheet has Material right under Style and above Notes (${sheet.labs}; ${sheet.opts})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
  // the photo reader is told about both
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'};let sent=null;const realFetch=globalThis.fetch;
  globalThis.fetch=async(u,o)=>{if(/anthropic/.test(String(u))){sent=JSON.parse(o.body);return new Response(JSON.stringify({content:[{type:'text',text:'{}'}],stop_reason:'end_turn'}),{status:200})}return realFetch(u,o)};
  try{await worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,iVBORw0KGgo='})}),env)}catch{}
  globalThis.fetch=realFetch;
  const s=JSON.stringify(sent||{});
  ok(/trouserKind/.test(s)&&/shoeStyle/.test(s)&&/chinos/.test(s)&&/sneaker/.test(s)&&/stone/.test(s),'the photo reader is asked for the kind of trousers and the style of shoes, and knows stone and denim');
  ok(/"canvas","knit"/.test(s)&&/sneakers may also be canvas/.test(s),'and that a sneaker can be canvas or knit');
};
