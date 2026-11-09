// Added colours: mid grey, steel blue, deep blue, very dark navy, dark slate blue-grey, wine (cream already existed).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const NEW={midgrey:'mid grey',steelblue:'steel blue',deepblue:'deep blue',darknavy:'very dark navy',slate:'dark slate blue-grey',wine:'wine',cream:'cream'};
  const r=await p.evaluate(N=>{show('add');addManual();
    const allOpts=[...document.querySelectorAll('#queue select')].flatMap(s=>[...s.options].map(o=>o.value+'='+o.textContent)).concat(Object.keys(TYPES).flatMap(t=>COLOR_OPTS(t).map(x=>x[0]+'='+x[1])));
    return {opts:allOpts,keys:Object.keys(N).filter(k=>COLORS[k]),alias:['Denim Blue','Wine Red','Light Grey','Navy Blue','Dark Blue','Beige','slate grey','very dark navy','mid gray','deep blue'].map(c=>{const k=normCol(c);return SHIRT_ONLY.includes(k)?SHIRT_FALLBACK[k]:k}),
      pretty:prettyCols('a darknavy shirt with a steelblue tie, slate suit, midgrey trousers, deepblue socks'),
      lum:['lightgrey','midgrey','grey'].map(lumOf)}},NEW);
  ok(r.keys.length===7,'all seven colours exist');
  ok(Object.entries(NEW).every(([k,v])=>r.opts.includes(`${k}=${v}`)),'the colour dropdowns offer them with readable names');
  ok(r.alias.join()==='steelblue,wine,lightgrey,navy,navy,tan,slate,darknavy,midgrey,deepblue',`AI / shop colour names map to them (${r.alias.join()})`);
  ok(r.pretty==='a very dark navy shirt with a steel blue tie, dark slate blue-grey suit, mid grey trousers, deep blue socks','colour names are spelled out in text');
  ok(r.lum[0]>r.lum[1]&&r.lum[1]>r.lum[2],'mid grey sits between light grey and grey');
  // rules: new colours follow their families
  const rules=await p.evaluate(()=>{const I=(type,primaryColor,x={})=>({id:type+primaryColor,type,primaryColor,pattern:'solid',...x});
    const suit=I('suit','lightgrey');
    return {darkShirt:shirtScore(I('suit','charcoal'),I('shirt','darknavy'))<shirtScore(I('suit','charcoal'),I('shirt','white'))-10&&darkShirt(I('shirt','darknavy'))&&shirtScore(suit,I('shirt','darknavy'))>0,
      slateShirt:shirtScore(I('suit','navy'),I('shirt','slate'))<=-10,
      fam:['wine','deepblue','darknavy','steelblue','midgrey','slate'].map(c=>fam(c)).join(),
      wineBelt:leatherGroup('wine')===leatherGroup('burgundy'),
      steelTie:tieScore(I('tie','navy'),I('shirt','steelblue'),I('tie','navy'))!==tieScore(I('tie','navy'),I('shirt','steelblue'),I('tie','pink'))}});
  ok(rules.darkShirt&&rules.slateShirt,'very dark navy and dark slate are dark shirts: kept out under dark jackets, allowed under a light one');
  ok(rules.fam==='burgundy,navy,navy,blue,grey,charcoal','each new colour follows its family in the outfit rules');
  ok(rules.wineBelt,'wine shoes and belts match the burgundy leather group');
  ok(rules.steelTie,'ties on a steel blue shirt use the blue-shirt table');
  // a wardrobe built from the new colours plans and renders cleanly
  const txt=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','slate'),I('suit','deepblue'),I('suit','midgrey'),I('shirt','cream'),I('shirt','steelblue'),I('shirt','lightblue'),I('tie','wine'),I('tie','darknavy'),
      I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('shoes','wine',{leather:'calf'}),I('belt','burgundy',{leather:'calf',metal:'silver'}),I('socks','darknavy')];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today');document.querySelector('.score summary')?.click();
    const t=[document.querySelector('#today').innerText];show('wardrobe');t.push(document.querySelector('#wardrobe').innerText);return t.join('\n')});
  ok(!/\b(darknavy|steelblue|deepblue|midgrey)\b/.test(txt),'no run-together colour keys on Today or in the wardrobe');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
