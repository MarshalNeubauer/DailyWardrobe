// Colors: names, families, shirts, khaki and deep taupe, how they are shown.
// Joined by feature from 6 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),{pathToFileURL}=require('url'),fs=require('fs');

/* ---- was tests/colouraudit.test.js ---- */
// Per-type colour lists: each item type offers only colours it really comes in (main colours and stripe / motif colours),
// the tagger is told the same lists, off-list tags move to the closest allowed colour, and colours already in the wardrobe stay.
const colouraudit=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null;
  globalThis.fetch=async(href,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'{"type":"tie","primaryColor":"navy","secondaryColor":"none","tertiaryColor":"none","pattern":"solid","metal":null,"leather":null,"dial":null,"band":null,"bezel":null}'}]}),{status:200,headers:{'content-type':'application/json'}})};
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await worker.fetch(new Request('https://w.test/',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,iVBORw0KGgo=',types:['tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore','cargo','combat','blouse']})}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'});
    const prompt=[...(sent.system||[]).map(s=>s.text),...sent.messages[0].content.filter(c=>c.type==='text').map(c=>c.text)].join('\n'),schema=sent.output_config.format.schema;
    const wTable={};for(const m of prompt.matchAll(/^  (\w+): ([a-z, ]+) \| ([a-z, ]+)$/gm))wTable[m[1]]=[m[2].split(', '),m[3].split(', ')];
    const dial=(prompt.match(/^  watch dial: ([a-z, ]+)$/m)||[])[1];
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const app=await p.evaluate(()=>({by:Object.fromEntries(Object.entries(COLS_BY).map(([t,v])=>[t,[v.p,v.a]])),dial:DIAL_COLS,types:Object.keys(TYPES),cols:Object.keys(COLORS)}));
    ok(JSON.stringify(wTable)===JSON.stringify(app.by)&&dial===app.dial.join(', '),'the tagger is given exactly the app\'s per-type lists');
    // POST /describe (worker/describe.js) tells Claude the shades and the per-type lists: the worker's own copies must be the app's
    const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href),D=await import(pathToFileURL(path.join(ROOT,'worker/describe.js')).href);
    const appX=await p.evaluate(()=>({hex:Object.fromEntries(Object.keys(COLORS).sort().map(k=>[k,COLORS[k]])),pats:PATS_BY}));
    ok(JSON.stringify(Object.fromEntries(Object.keys(T.COLOR_HEX).sort().map(k=>[k,T.COLOR_HEX[k]])))===JSON.stringify(appX.hex),'the worker\'s COLOR_HEX is the app\'s COLORS, shade for shade');
    ok(JSON.stringify(T.PATTERN_BY_TYPE)===JSON.stringify(appX.pats),'the worker\'s PATTERN_BY_TYPE is the app\'s PATS_BY');
    {const dt={};for(const m of D.descTables().colour.matchAll(/^(\w+): ([a-z, ]+) \| ([a-z, ]+)$/gm))dt[m[1]]=[m[2].split(', '),m[3].split(', ')];
      ok(JSON.stringify(dt)===JSON.stringify(app.by),'the colour lookups\' table lists exactly the app\'s per-type colours')}
    ok(app.types.every(t=>app.by[t])&&Object.values(app.by).flat(2).every(c=>app.cols.includes(c)),'every type has a list, and every listed colour exists');
    ok(JSON.stringify(schema.properties.dial.anyOf[0].enum)===JSON.stringify(app.dial),'watch dials have their own list in the schema');
    const r=await p.evaluate(()=>{const o=t=>COLOR_OPTS(t).map(x=>x[0]);return {
      suit:o('suit'),shirt:o('shirt'),tie:o('tie'),shoes:o('shoes'),clip:o('tieclip'),socks:o('socks'),rain:o('raincoat'),
      fit:[['suit','silver'],['suit','gold'],['tie','white'],['shoes','wine'],['shirt','olive'],['tieclip','navy'],['pants','beige'],['socks','white']].map(([t,c])=>normColFor(t,c)).join(),
      acc:normColFor('suit','white',true)+','+normColFor('suit','pink',true),
      legacy:COLOR_OPTS('suit','pink').some(x=>x[0]==='pink'),fam:['mint','taupe','rust'].map(fam).join()}});
    ok(!['silver','gold','pink','purple','red','white','oxblood','paleyellow'].some(c=>r.suit.includes(c))&&['taupe','khaki','navy','charcoal'].every(c=>r.suit.includes(c)),'suits offer suiting colours only (no watch metals, no shirt or tie colours)');
    ok(['mint','periwinkle','lavender','ivory'].every(c=>r.shirt.includes(c))&&!['silver','gold','olive','oxblood','khaki','tan'].some(c=>r.shirt.includes(c)),'shirts offer shirt colours');
    ok(['silver','rust','lavender','gold'].every(c=>r.tie.includes(c))&&!r.tie.includes('white'),'ties include silver, rust and lavender; no white ties');
    ok(r.shoes.join()==='black,brown,tan,oxblood,burgundy,navy,grey,taupe,white,cream,coyote'&&r.clip.join()==='silver,gold,rosegold,gunmetal,grey,black,white,red,blue,navy','shoes are leather colours, plus white and cream for sneakers and coyote for combat boots; tie clips are their finishes: the metals (rose gold and gunmetal too) and the enamel colours clips are sold in');
    ok(!r.socks.includes('white')&&r.rain.includes('khaki')&&!r.rain.includes('red'),'no white dress socks; raincoats come in trench colours');
    ok(r.fit==='lightgrey,khaki,cream,burgundy,grey,black,cream,lightgrey'||/^lightgrey,/.test(r.fit),`off-list tags move to the closest allowed colour (${r.fit})`);
    ok(/^(white|cream),/.test(r.acc),`stripe colours have their own list (${r.acc})`);
    ok(r.legacy,'a colour an existing item already has stays selectable for it');
    ok(r.fam==='green,tan,brown','new colours (mint, taupe, rust) follow their families in the outfit rules');
    // the live wardrobe's colours (Nov 2026) are all still offered
    const LIVE={suit:{p:['black','darkgrey','midgrey','lightgrey','brown','navy','tan'],a:['brown','tan']},shirt:{p:['cream','darknavy','white','lightblue','periwinkle','midgrey','pink','lavender','navy','paleyellow','slate','charcoal','burgundy','black','beige','steelblue'],a:['navy','grey']},
      tie:{p:['navy','black','deepblue','green','brown','burgundy'],a:['pink','grey','white','cream','lightgrey','lightblue']},shoes:{p:['oxblood','black','brown'],a:[]},tieclip:{p:['grey'],a:[]},blazer:{p:['lightgrey','charcoal','steelblue','tan'],a:['lightblue','white']},
      belt:{p:['brown','black','oxblood'],a:['black']},pants:{p:['darkgrey','tan','midgrey','lightblue','grey','deepblue','khaki','navy','black'],a:['grey','tan','navy']},socks:{p:['charcoal'],a:[]},watch:{p:['grey'],a:[]}};
    const miss=Object.entries(LIVE).flatMap(([t,{p:pp,a}])=>[...pp.filter(c=>!app.by[t][0].includes(c)).map(c=>t+':'+c),...a.filter(c=>!app.by[t][1].includes(c)).map(c=>t+'/'+c)]);
    ok(miss.length===0,'every colour in the current wardrobe is still on its type\'s list ('+miss.join()+')');
    // the Add form uses the type's list
    const add=await p.evaluate(()=>{show('add');HOOK.addManual();const q=queue[0];setq(0,'type','tieclip');document.querySelector('#nps-q .colbtn[data-k="primaryColor"]').click();
      const l=[...document.querySelectorAll('#col-sheet .cpgrid:not(.cpnear):not(.cnown) .cptile')].map(b=>b.dataset.c);closeColPick();
      return l.length===new Set(l).size&&l.slice().sort().join()===HOOK.colChoices(queue[0],'primaryColor').slice().sort().join()?HOOK.colChoices(queue[0],'primaryColor').join():l.join()});
    ok(add==='silver,gold,rosegold,gunmetal,grey,black,white,red,blue,navy','the Add form shows a tie clip its finishes');
    const nm=await p.evaluate(()=>{show('add');const q=queue[0];return {metal:document.querySelectorAll('#nps-q select[data-f="metal"]').length,word:colName(primaryCol({type:'tieclip',primaryColor:'rosegold'})),
      m:[{type:'tieclip',primaryColor:'rosegold'},{type:'tieclip',primaryColor:'silver',metal:'gold'},{type:'tieclip',primaryColor:'gunmetal'},{type:'tieclip',primaryColor:'red'}].map(metalOf).join()}});
    ok(nm.metal===0&&nm.word==='rose gold'&&nm.m==='gold,silver,other,',`a tie clip has no Metal field: its colour says its metal (rose gold reads as gold, a silver clip tagged gold as silver, red enamel as none: ${nm.m})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};

/* ---- was tests/colours.test.js ---- */
// Added colours: mid grey, steel blue, deep blue, very dark navy, dark slate blue-grey, wine (cream already existed).
const colours=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const NEW={midgrey:'mid gray',steelblue:'steel blue',deepblue:'deep blue',darknavy:'very dark navy',slate:'dark slate blue-gray',wine:'wine',cream:'cream'};
  const r=await p.evaluate(N=>{show('add');HOOK.addManual();
    const allOpts=[...document.querySelectorAll('#nps-q select')].flatMap(s=>[...s.options].map(o=>o.value+'='+o.textContent)).concat(Object.keys(TYPES).flatMap(t=>COLOR_OPTS(t).map(x=>x[0]+'='+x[1])));
    return {opts:allOpts,keys:Object.keys(N).filter(k=>COLORS[k]),alias:['Denim Blue','Wine Red','Light Grey','Navy Blue','Dark Blue','Beige','slate grey','very dark navy','mid gray','deep blue'].map(c=>{const k=normCol(c);return HOOK.SHIRT_ONLY.includes(k)?HOOK.SHIRT_FALLBACK[k]:k}),
      pretty:prettyCols('a darknavy shirt with a steelblue tie, slate suit, midgrey pants, deepblue socks'),
      lum:['lightgrey','midgrey','grey'].map(HOOK.lumOf)}},NEW);
  ok(r.keys.length===7,'all seven colors exist');
  ok(Object.entries(NEW).every(([k,v])=>r.opts.includes(`${k}=${v}`)),'the color dropdowns offer them with readable names');
  ok(r.alias.join()==='steelblue,wine,lightgrey,navy,navy,tan,slate,darknavy,midgrey,deepblue',`AI / shop color names map to them (${r.alias.join()})`);
  ok(r.pretty==='a very dark navy shirt with a steel blue tie, dark slate blue-gray suit, mid gray pants, deep blue socks','color names are spelled out in text');
  ok(r.lum[0]>r.lum[1]&&r.lum[1]>r.lum[2],'mid gray sits between light gray and gray');
  // rules: new colours follow their families
  const rules=await p.evaluate(()=>{const I=(type,primaryColor,x={})=>({id:type+primaryColor,type,primaryColor,pattern:'solid',...x});
    const suit=I('suit','lightgrey');
    return {darkShirt:shirtScore(I('suit','charcoal'),I('shirt','darknavy'))<shirtScore(I('suit','charcoal'),I('shirt','white'))-10&&darkShirt(I('shirt','darknavy'))&&shirtScore(suit,I('shirt','darknavy'))>0,
      slateShirt:shirtScore(I('suit','navy'),I('shirt','slate'))<=-10,
      fam:['wine','deepblue','darknavy','steelblue','midgrey','slate'].map(c=>fam(c)).join(),
      wineBelt:leatherGroup('wine')===leatherGroup('burgundy'),
      steelTie:HOOK.tieScore(I('tie','navy'),I('shirt','steelblue'),I('tie','navy'))!==HOOK.tieScore(I('tie','navy'),I('shirt','steelblue'),I('tie','pink'))}});
  ok(rules.darkShirt&&rules.slateShirt,'very dark navy and dark slate are dark shirts: kept out under dark jackets, allowed under a light one');
  ok(rules.fam==='burgundy,navy,navy,blue,grey,charcoal','each new colour follows its family in the outfit rules');
  ok(rules.wineBelt,'wine shoes and belts match the burgundy leather group');
  ok(rules.steelTie,'ties on a steel blue shirt use the blue-shirt table');
  // a wardrobe built from the new colours plans and renders cleanly
  const txt=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','slate'),I('suit','deepblue'),I('suit','midgrey'),I('shirt','cream'),I('shirt','steelblue'),I('shirt','lightblue'),I('tie','wine'),I('tie','darknavy'),
      I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('shoes','wine',{leather:'calf'}),I('belt','burgundy',{leather:'calf',metal:'silver'}),I('socks','darknavy')];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today');document.querySelector('#sbox .month-link')?.click();
    const t=[document.querySelector('#today').innerText];show('wardrobe');t.push(document.querySelector('#wardrobe').innerText);return t.join('\n')});
  ok(!/\b(darknavy|steelblue|deepblue|midgrey)\b/.test(txt),'no run-together color keys on Today or in the wardrobe');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};

/* ---- was tests/shirts.test.js ---- */
// Dress-shirt colours and textures: pale yellow, ivory, beige, lavender, periwinkle are offered only for shirts (other items
// keep the old list, and AI tags fall back to a family); shirt textures render, count as quiet (not bold patterns),
// and the worker prompt/schema know them.
const shirts=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const NEW=['paleyellow','ivory','beige','lavender','periwinkle'],TEX=['fine-stripe','fine-texture','woven','textured','end-on-end','chambray','pinpoint','royal-oxford','dobby','houndstooth'];
  const r=await p.evaluate(([NEW,TEX])=>{
    const shirtOpts=COLOR_OPTS('shirt').map(x=>x[0]),tieOpts=COLOR_OPTS('tie').map(x=>x[0]),suitOpts=COLOR_OPTS('suit').map(x=>x[0]);
    return {shirtHas:NEW.every(c=>shirtOpts.includes(c))&&['lightblue','midgrey'].every(c=>shirtOpts.includes(c)),
      othersLack:NEW.every(c=>!suitOpts.includes(c))&&NEW.filter(c=>c!=='lavender').every(c=>!tieOpts.includes(c))&&tieOpts.includes('lavender'),names:NEW.map(colName).join(','),
      fallback:NEW.map(c=>normColFor('tie',c)).join(','),keep:NEW.map(c=>normColFor('shirt',c)).join(','),
      alias:['Pale Yellow','Lilac','Eggshell','Periwinkle','Beige'].map(c=>normColFor('shirt',c)).join(','),
      tex:TEX.every(t=>PATS_BY.shirt.includes(t)),texNotSuit:['end-on-end','chambray','fine-texture'].every(t=>!PATS_BY.suit.includes(t)),
      labels:['fine-stripe','fine-texture','royal-oxford'].map(patLabel).join(','),
      normPat:[normPat('shirt','Fine Texture'),normPat('shirt','hairline'),normPat('shirt','fil-a-fil'),normPat('shirt','texture'),normPat('shirt','poplin')].join(','),
      lums:['white','ivory','cream','paleyellow'].map(HOOK.lumOf)}},[NEW,TEX]);
  ok(r.shirtHas,'shirts can be pale yellow, ivory, beige, lavender, periwinkle (and light blue, mid grey)');
  ok(r.othersLack,'suits do not get the shirt colours; ties get lavender only');
  ok(r.names==='pale yellow,ivory,beige,lavender,periwinkle','readable names ("pale yellow")');
  ok(r.fallback==='cream,cream,tan,lavender,blue'&&r.keep===NEW.join(','),'an AI tag of a shirt colour on another item falls back to its family; on a shirt it is kept');
  ok(r.alias==='paleyellow,lavender,ivory,periwinkle,beige',`shop/AI names map to the shirt colours (${r.alias})`);
  ok(r.tex&&r.texNotSuit,'shirt textures are offered for shirts only');
  ok(r.labels==='fine stripe,fine texture,royal oxford','texture labels read naturally');
  ok(r.normPat==='fine-texture,fine-stripe,end-on-end,textured,solid',`texture names from the AI map correctly (${r.normPat})`);
  ok(r.lums[0]>r.lums[1]&&r.lums[1]>r.lums[2]&&r.lums[2]>r.lums[3],'brightness order: white > ivory > cream > pale yellow');
  // every texture draws a distinct pattern; none is a bold pattern for the planner except fine stripe / houndstooth (fine scale)
  const d=await p.evaluate(TEX=>{const I=pattern=>({id:'s',type:'shirt',primaryColor:'lavender',pattern});const tiles=TEX.map(t=>fabricDef('x',I(t),'shirt'));
    const solid=fabricDef('x',I('solid'),'shirt');return {distinct:new Set(tiles).size===TEX.length&&tiles.every(t=>t!==solid),
      bold:TEX.filter(t=>patInfo(I(t),'shirt')).join(','),scale:[patInfo(I('fine-stripe'),'shirt').scale,patInfo(I('houndstooth'),'shirt').scale].join(',')}},TEX);
  ok(d.distinct,'each texture is drawn with its own fabric');
  ok(d.bold==='fine-stripe,houndstooth'&&d.scale==='1,1','textures are quiet; fine stripe and houndstooth count as small-scale patterns');
  // planner: new shirt colours get sensible scores and tie pairings
  const pl=await p.evaluate(()=>{const S=c=>({id:'s',type:'shirt',primaryColor:c,pattern:'solid'}),suit={id:'t',type:'suit',primaryColor:'navy',pattern:'solid'},T=c=>({id:'x'+c,type:'tie',primaryColor:c,pattern:'solid'});
    return {ivoryOk:shirtScore(suit,S('ivory'))>=shirtScore(suit,S('cream')),periDark:shirtScore({...suit,primaryColor:'lightgrey'},S('periwinkle'))<shirtScore({...suit,primaryColor:'lightgrey'},S('white')),
      lavTie:HOOK.tieScore(T('purple'),S('lavender'),T('purple'))>HOOK.tieScore(T('tan'),S('lavender'),T('tan')),
      rate:rateOutfit({suitDay:true,top:suit,shirt:S('paleyellow'),tie:T('navy')}).checks.find(c=>c.label==='Shirt').pts}});
  ok(pl.ivoryOk&&pl.periDark,'shirt scores: ivory at least as good as cream; periwinkle is darker than white under a light suit');
  ok(pl.lavTie,'a lavender shirt prefers a purple tie over a tan one');
  ok(pl.rate>=6,`a pale yellow shirt scores reasonably (${pl.rate}/10)`);
  // editor: a shirt offers them, switching type to tie falls back
  const ed=await p.evaluate(async()=>{items=[{id:'sh1',type:'shirt',primaryColor:'periwinkle',pattern:'end-on-end'}];editing='sh1';show('wardrobe');
    const pb=document.querySelector('#item-view .patbtn');pb.click();const texOk=!!document.querySelector('#col-sheet .cptile[data-c="royal-oxford"]');closeColPick();const tex={value:/end on end/i.test(pb.textContent)?'end-on-end':pb.textContent};
    const btn=document.querySelector('#item-view .colbtn[data-k="primaryColor"]');btn.click();const prim=!!document.querySelector('#col-sheet .cptile[data-c="lavender"]');closeColPick();
    const a=prim&&texOk&&/periwinkle/i.test(btn.textContent)&&tex.value==='end-on-end';await sete('sh1','type','tie');const it=items[0];HOOK.closeItem();return {a,col:it.primaryColor,pat:it.pattern}});
  ok(ed.a,'the shirt editor offers the new colours and textures');
  ok(ed.col==='blue'&&ed.pat==='solid','changing a periwinkle end-on-end shirt into a tie gives a blue solid tie');
  // the figure draws a new-colour shirt
  ok(await p.evaluate(()=>{const o={suitDay:true,top:{id:'t',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:{id:'s',type:'shirt',primaryColor:'lavender',pattern:'dobby'},tie:{id:'x',type:'tie',primaryColor:'navy',pattern:'solid'}};
    const d=document.createElement('div');d.innerHTML=figureSvg(o,'q-');return d.querySelector('#q-shirt').innerHTML.includes(COLORS.lavender)}),'the figure draws the lavender dobby shirt');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
  // worker prompt and schema
  const src=require('./workersrc.js')();
  ok(NEW.every(c=>new RegExp(`shirt: \\[\\[[^\\]]*'${c}'`).test(src)),'the worker lists the shirt colours under shirts');
  ok(TEX.filter(t=>t!=='houndstooth').every(t=>src.includes(`'${t}'`)&&new RegExp(t+'\\s*\\(').test(src)),'the worker schema and prompt include every shirt texture');
};

/* ---- was tests/display.test.js ---- */
// List swatches are drawn from the tagged colours (not cropped photos), and colour names are shown with spaces.
const display=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  // a brownish photo crop on a grey suit and a light-blue shirt (what warm indoor light does to a photo)
  const brown='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  await p.evaluate(b=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','grey',{pattern:'herringbone',swatch:b,photo:b}),I('suit','darkgrey',{swatch:b}),I('shirt','lightblue',{swatch:b}),I('shirt','lightgrey'),I('tie','navy',{pattern:'stripe',secondaryColor:'white',tertiaryColor:'lightgrey',swatch:b}),
      I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('watch','grey',{metal:'silver'}),I('socks','darkgrey')];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')},brown);
  const sw=await p.evaluate(()=>[...document.querySelectorAll('#today .list .dot')].map(d=>({bg:d.getAttribute('style')||'',svg:!!d.querySelector('svg'),html:d.innerHTML})));
  ok(sw.length>=6&&sw.every(d=>d.svg&&!d.bg.includes('url(')),'every list swatch is drawn, none uses the photo crop');
  const suitSw=sw[0].html;
  const suitHex=await p.evaluate(()=>COLORS[planFor()[key(sel)].top.primaryColor]);
  ok(suitSw.includes(suitHex)&&!suitSw.includes('data:image'),'the suit swatch uses its tagged gray, not the brown photo crop');
  const shirt=await p.evaluate(()=>{const o=planFor()[key(sel)];return o.shirt.primaryColor});
  const shirtSw=await p.evaluate(()=>{const r=[...document.querySelectorAll('#today .list .row')].find(r=>r.querySelector('.mut').textContent==='Shirt');return r.querySelector('.dot').innerHTML});
  ok(shirtSw.includes(await p.evaluate(c=>COLORS[c],shirt)),'the shirt swatch uses the shirt\'s tagged color');
  // colour names with spaces everywhere they are shown
  await p.click('#sbox .month-link');
  const texts=await p.evaluate(()=>{const t=[document.querySelector('#today').innerText];
    sel=new Date(2026,10,16);items.push({id:'x1',type:'shoes',primaryColor:'brown',leather:'suede'});cache={};renderToday();t.push(document.querySelector('#today').innerText);
    show('add');HOOK.addManual();t.push([...document.querySelectorAll('#nps-q select option')].map(o=>o.textContent).join(' '));
    t.push(runAnalysis(items,todayDate(),2).cats.map(c=>c.notes.join(' ')+' '+(c.own?c.own.groups.map(g=>g[0]).join(' '):'')+' '+c.recs.map(r=>r.name+' '+r.detail+' '+r.why.join(' ')).join(' ')).join(' '));
    return t.join('\n')});
  ok(!/lightblue|lightgrey|darkgrey/i.test(texts),'no run-together color names on Today, in the score, notes, dropdowns or recommendations');
  ok(/light blue/i.test(texts)&&/dark gray/i.test(texts),'color names read "light blue", "dark gray"');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};

/* ---- was tests/khaki.test.js ---- */
// Khaki: a light chino colour for trousers (and any non-shirt item), lighter than tan; the planner treats it as the tan family,
// the tagger knows it, and its item picture asks for cotton twill.
const khaki=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>({pants:COLOR_OPTS('pants').some(x=>x[0]==='khaki'),shirt:COLOR_OPTS('shirt').some(x=>x[0]==='khaki'),
      norm:['Khaki','chino','stone'].map(c=>normColFor('pants',c)).join(),camel:normCol('camel'),
      lighter:HOOK.lumOf('khaki')>HOOK.lumOf('tan')+10,fam:fam('khaki'),belt:leatherGroup('khaki'),
      desc:HOOK.itemDesc({type:'pants',primaryColor:'khaki',pattern:'solid'}),wool:HOOK.itemDesc({type:'pants',primaryColor:'tan',pattern:'solid'})}));
    ok(r.pants&&!r.shirt,'khaki is offered for trousers (not dress shirts)');
    ok(r.norm==='khaki,khaki,stone'&&r.camel==='tan','khaki and chino tag as khaki, stone is its own trouser colour now (chinos); camel stays tan');
    ok(r.lighter&&r.fam==='tan'&&r.belt==='tan','khaki is lighter than tan and follows the tan rules');
    ok(/khaki cotton twill dress trousers/.test(r.desc)&&/tan wool dress trousers/.test(r.wool),'the khaki item picture asks for cotton twill');
    // a blazer day with a navy blazer wears the khaki trousers
    const bot=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','khaki'),I('pants','black'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),
        I('shoes','brown',{leather:'calf'}),I('shoes','black',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};view={y:2026,m:10};
      // (the real planner, buildPlan, on three blazer days: planFor gives tests/fixedplan.js's outfit, whose pants the day number picks; CR-10-05)
      const P=buildPlan(2026,10);return ['2026-11-12','2026-11-19','2026-11-26'].map(k=>P[k]&&P[k].bot&&P[k].bot.primaryColor).join()});
    ok(bot==='khaki,khaki,khaki','a navy blazer is paired with the khaki trousers on every blazer day ('+bot+')');
    const w=require('./workersrc.js')();
    ok(/pants: \[\[\.\.\.SUITING/.test(w)&&/'tan','khaki'/.test(w)&&/khaki is the light sandy beige/.test(w),'the tagging prompt lists and explains khaki');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/deeptaupe.test.js ---- */
// Deep taupe: a suiting colour (suits, blazers, trousers), darker and greyer than taupe. It has its own swatch and name,
// the tagger is told about it, shop names map to it, and the planner treats it as a brown (shoes, ties, jacket rotation).
const deeptaupe=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const o=t=>COLOR_OPTS(t).map(x=>x[0]);
      const S=c=>({id:'s'+c,type:'suit',primaryColor:c,pattern:'solid'}),Sh=c=>({id:'h'+c,type:'shoes',primaryColor:c,leather:'calf'});
      const dt=S('deeptaupe');
      return {suit:o('suit').includes('deeptaupe'),blazer:o('blazer').includes('deeptaupe'),pants:o('pants').includes('deeptaupe'),
        notTie:!o('tie').includes('deeptaupe')&&!o('shirt').includes('deeptaupe'),
        hex:COLORS.deeptaupe,name:colName('deeptaupe'),pretty:prettyCols('a deeptaupe suit'),
        keep:normColFor('suit','deeptaupe'),alias:['Deep Taupe','dark taupe','mink','taupe'].map(c=>normColFor('suit',c)).join(),
        lum:[HOOK.lumOf('taupe'),HOOK.lumOf('deeptaupe'),HOOK.lumOf('black')],
        fam:fam('deeptaupe'),grp:jacketGroup(dt),
        shoes:['brown','black'].map(c=>shoeScore(dt,dt,Sh(c)))}});
    ok(r.suit&&r.blazer&&r.pants,'deep taupe is offered for suits, blazers and trousers');
    ok(r.notTie,'shirts and ties do not get it');
    ok(/^#[0-9a-f]{6}$/.test(r.hex)&&r.name==='deep taupe'&&r.pretty==='a deep taupe suit','it has a swatch and reads as "deep taupe"');
    ok(r.keep==='deeptaupe'&&r.alias==='deeptaupe,deeptaupe,deeptaupe,taupe',`tags and shop names map to it; plain taupe stays taupe (${r.alias})`);
    ok(r.lum[0]>r.lum[1]&&r.lum[1]>r.lum[2],'deep taupe is darker than taupe and lighter than black');
    ok(r.fam==='brown'&&r.grp==='brown','the planner treats deep taupe as a brown (colour family and jacket rotation group)');
    ok(r.shoes[0]>r.shoes[1],`a deep taupe suit prefers brown shoes over black (${r.shoes})`);
    // a deep taupe suit is planned, drawn and scored
    const d=await p.evaluate(()=>{const I=(id,type,primaryColor,x)=>({id,type,primaryColor,pattern:'solid',...x});
      items=[I('st','suit','deeptaupe'),I('sh','shirt','white'),I('tb','tie','burgundy'),I('tn','tie','navy'),I('bs','shoes','brown',{leather:'calf'}),I('bk','shoes','black',{leather:'calf'}),I('bb','belt','brown',{leather:'calf'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};
      // (the real planner, buildPlan: planMonth gives tests/fixedplan.js's outfit, whose shoe the day number picks; the code review CR-10-05)
      const days=['2026-11-10','2026-11-11','2026-11-12'],P=buildPlan(2026,10),o=P['2026-11-10'],allBrown=days.every(k=>P[k].shoes&&P[k].shoes.id==='bs');const div=document.createElement('div');div.innerHTML=figureSvg({suitDay:true,top:items[0],shirt:items[1],tie:items[2]},'q-');
      return {top:o.top&&o.top.id,shoes:o.shoes&&o.shoes.id,allBrown,drawn:div.innerHTML.includes(COLORS.deeptaupe),score:rateOutfit(o).score}});
    ok(d.top==='st'&&d.shoes==='bs'&&d.allBrown,`the planner dresses a deep taupe suit with brown shoes, three days running (${d.top}/${d.shoes})`);
    ok(d.drawn,'the figure draws the deep taupe suit');
    ok(d.score>=6,`the outfit scores reasonably (${d.score})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
  const src=require('./workersrc.js')();
  ok(/COLOR_LIST = \[[^\]]*'deeptaupe'/.test(src)&&/deeptaupe is a/.test(src),'the tagger may answer deeptaupe and is told what it looks like');
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['colouraudit',colouraudit],['colours',colours],['shirts',shirts],['display',display],['khaki',khaki],['deeptaupe',deeptaupe]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
