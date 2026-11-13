// Dress-shirt colours and textures: pale yellow, ivory, beige, lavender, periwinkle are offered only for shirts (other items
// keep the old list, and AI tags fall back to a family); shirt textures render, count as quiet (not bold patterns),
// and the worker prompt/schema know them.
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
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
      lums:['white','ivory','cream','paleyellow'].map(lumOf)}},[NEW,TEX]);
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
      lavTie:tieScore(T('purple'),S('lavender'),T('purple'))>tieScore(T('tan'),S('lavender'),T('tan')),
      rate:rateOutfit({suitDay:true,top:suit,shirt:S('paleyellow'),tie:T('navy')}).checks.find(c=>c.label==='Shirt').pts}});
  ok(pl.ivoryOk&&pl.periDark,'shirt scores: ivory at least as good as cream; periwinkle is darker than white under a light suit');
  ok(pl.lavTie,'a lavender shirt prefers a purple tie over a tan one');
  ok(pl.rate>=6,`a pale yellow shirt scores reasonably (${pl.rate}/10)`);
  // editor: a shirt offers them, switching type to tie falls back
  const ed=await p.evaluate(async()=>{items=[{id:'sh1',type:'shirt',primaryColor:'periwinkle',pattern:'end-on-end'}];editing='sh1';show('wardrobe');
    const sels=[...document.querySelectorAll('#item-view select')],tex=sels.find(s=>[...s.options].some(o=>o.value==='royal-oxford'));
    const btn=document.querySelector('#item-view .colbtn[data-k="primaryColor"]');btn.click();const prim=!!document.querySelector('#col-sheet .cptile[data-c="lavender"]');closeColPick();
    const a=prim&&!!tex&&/periwinkle/i.test(btn.textContent)&&tex.value==='end-on-end';await sete('sh1','type','tie');const it=items[0];closeItem();return {a,col:it.primaryColor,pat:it.pattern}});
  ok(ed.a,'the shirt editor offers the new colours and textures');
  ok(ed.col==='blue'&&ed.pat==='solid','changing a periwinkle end-on-end shirt into a tie gives a blue solid tie');
  // the figure draws a new-colour shirt
  ok(await p.evaluate(()=>{const o={suitDay:true,top:{id:'t',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:{id:'s',type:'shirt',primaryColor:'lavender',pattern:'dobby'},tie:{id:'x',type:'tie',primaryColor:'navy',pattern:'solid'}};
    const d=document.createElement('div');d.innerHTML=figureSvg(o,'q-');return d.querySelector('#q-shirt').innerHTML.includes(COLORS.lavender)}),'the figure draws the lavender dobby shirt');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
  // worker prompt and schema
  const src=fs.readFileSync(path.join(ROOT,'worker.js'),'utf8');
  ok(NEW.every(c=>new RegExp(`shirt: \\[\\[[^\\]]*'${c}'`).test(src)),'the worker lists the shirt colours under shirts');
  ok(TEX.filter(t=>t!=='houndstooth').every(t=>src.includes(`'${t}'`)&&new RegExp(t+'\\s*\\(').test(src)),'the worker schema and prompt include every shirt texture');
};
