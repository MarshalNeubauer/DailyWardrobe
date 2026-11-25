// Titles (2026-11-17, the owner's title audit): what a piece is called on screen and in the planner's words is its main colour, its pattern and
// its kind ("Navy argyle", "Saved: Navy argyle socks.", "navy argyle socks"), never a chain of "&" colours, a toe cap, a season or French
// cuffs piled on; a watch its metal and dial. On a varied made-up wardrobe every generated title stays under TITLE_MAX, with no "&" and
// no word twice; a name the owner typed is shown exactly as typed; desc() (the item sheet's caption, search) keeps every detail.
const TITLE_MAX=32,NM_MAX=48,SAVED_MAX=40;
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:'t'+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      const W=[I('suit','navy',{secondaryColor:'white',pattern:'pinstripe',season:'cold'}),I('suit','grey',{secondaryColor:'burgundy',tertiaryColor:'navy',pattern:'glen-check',vest:'yes'}),
        I('blazer','tan',{pattern:'herringbone',season:'cold',secondaryColor:'brown',tertiaryColor:'cream'}),I('pants','khaki',{trouserKind:'chinos'}),I('pants','charcoal',{secondaryColor:'grey',pattern:'herringbone',season:'warm'}),
        I('shirt','white',{secondaryColor:'blue',pattern:'stripe',cuff:'french'}),I('shirt','lightblue',{secondaryColor:'white',tertiaryColor:'navy',pattern:'tattersall',accents:['red','green']}),
        I('shirt','paleyellow',{pattern:'end-on-end',secondaryColor:'lightblue',cuff:'french',season:'warm'}),I('tie','navy',{secondaryColor:'burgundy',tertiaryColor:'gold',pattern:'paisley',accents:['green','red']}),
        I('tie','burgundy',{secondaryColor:'navy',pattern:'stripe'}),I('pocketsquare','burgundy',{secondaryColor:'gold',tertiaryColor:'navy',pattern:'paisley'}),
        I('watch','brown',{metal:'gold',band:'leather',dial:'white',watchStyle:'chronograph'}),I('watch','silver',{metal:'two-tone',band:'integrated',dial:'navy',watchStyle:'chronograph'}),
        I('shoes','oxblood',{leather:'scotch-grain',shoeStyle:'loafer'}),I('shoes','white',{secondaryColor:'cream',leather:'calf',shoeStyle:'sneaker'}),I('belt','black',{leather:'braided',metal:'silver'}),
        I('socks','navy',{secondaryColor:'burgundy',tertiaryColor:'gold',pattern:'argyle',toeColor:'lightgrey'}),I('socks','black',{toeColor:'lightgrey'}),I('socks','black',{secondaryColor:'lightgrey'}),
        I('cufflinks','lightblue',{metal:'silver'}),I('cufflinks','silver',{metal:'silk'}),I('tieclip','rosegold'),I('overcoat','tan',{season:'cold'}),I('raincoat','khaki'),
        I('tee','white',{secondaryColor:'navy',pattern:'stripe'}),I('sweater','cream',{pattern:'cable'}),I('pants','olive',{trouserKind:'cargo'}),I('chore','navy'),
        I('suit','charcoal',{name:'My grandfather’s charcoal flannel three-piece & waistcoat'})];
      const rows=W.map(i=>({type:i.type,title:itemTitle(i),saved:savedTitle(i),nm:nm(i),care:HOOK.careName(i).replace(/<[^>]+>/g,''),stat:statName(i),desc:desc(i)}));
      return {rows,named:rows[rows.length-1]}});
    const gen=r.rows.slice(0,-1),twice=t=>{const w=t.toLowerCase().replace(/end on end/g,'endonend').split(/[^a-z]+/).filter(x=>x.length>2);return w.some((x,i)=>w.indexOf(x)!==i)};
    const long=gen.filter(x=>x.title.length>TITLE_MAX||x.saved.length>SAVED_MAX||x.nm.length>NM_MAX);
    ok(!long.length,`every generated title is short (title ≤ ${TITLE_MAX}, Saved ≤ ${SAVED_MAX}, the planner's ≤ ${NM_MAX}): ${JSON.stringify(long)}`);
    ok(gen.every(x=>![x.title,x.saved,x.nm,x.care,x.stat].some(t=>/&/.test(t))),'no chain of "&" colours in any title');
    ok(gen.every(x=>![x.title,x.saved,x.nm].some(twice)),`no word twice (${gen.filter(x=>[x.title,x.saved,x.nm].some(twice)).map(x=>x.saved).join(' | ')})`);
    const t=Object.fromEntries(gen.map(x=>[x.type+':'+x.title,x]));
    ok(gen[16].title==='Navy argyle'&&gen[16].saved==='Navy argyle socks'&&gen[16].nm==='navy argyle socks',`a patterned sock: ${gen[16].saved}`);
    ok(gen[0].title==='Navy pinstripe'&&gen[5].title==='White stripe'&&gen[8].title==='Navy paisley'&&gen[11].title==='Gold chronograph · white dial'&&gen[13].title==='Oxblood scotch grain loafers'&&gen[13].saved==='Oxblood scotch grain loafers'&&gen[14].saved==='White leather sneakers'&&gen[3].saved==='Khaki chinos',
      `examples: ${[0,5,8,11,13,14,15,19].map(n=>gen[n].saved).join(' | ')}`);
    ok(/burgundy/.test(gen[16].desc)&&/light gray toe/.test(gen[16].desc)&&/French cuffs/.test(gen[5].desc)&&/cold weather/.test(gen[0].desc)&&/ · leather strap/.test(gen[11].desc),'desc() keeps every detail (the colours, the toe cap, French cuffs, the season, the band)');
    ok(r.named.title==='My grandfather’s charcoal flannel three-piece & waistcoat'&&r.named.saved===r.named.title,'a name typed by the owner is shown exactly as typed');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
