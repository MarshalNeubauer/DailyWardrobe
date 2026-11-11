// "What to buy": a button on the Wardrobe tab opens a sheet from the bottom. The analysis runs in a Web Worker, compares
// every colour and pattern of each kind of piece with what is owned, and lists more than a handful of ideas by section
// (suits, ties, shoes…) with their reasons. "Bought it" adds the piece as on the way; "Not for me" hides it for good.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:780}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','grey'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('watch','grey',{metal:'silver'}),I('socks','navy')];
    dayRecs={};settings.shopSkip=[];TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};shop=null;show('wardrobe')});
  ok(await p.$('#wardrobe #shop-btn')&&!await p.$('#wardrobe .shop'),'the Wardrobe tab has a "What to buy" button, not the old card');
  const t0=Date.now();
  await p.click('#shop-btn');
  ok(await p.evaluate(()=>document.querySelector('#shop-sheet').classList.contains('on')&&!!shopBusy),'the button opens the sheet and starts the check');
  await p.waitForFunction(()=>shop&&!shopBusy,null,{timeout:90000});
  const secs=(Date.now()-t0)/1000;await settle(p,400);
  const r=await p.evaluate(()=>shop.res),recs=r.cats.flatMap(c=>c.recs),cat=k=>r.cats.find(c=>c.key===k),top=r.top.map(t=>cat(t.cat).recs.find(x=>x.key===t.key));
  ok(secs<60,`the check finished in ${secs.toFixed(1)}s`);
  ok(await p.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('analysis-worker.js'))),'it ran in a background Web Worker');
  ok(recs.length>=12&&top.length>5,`far more than three ideas (${recs.length} in ${r.cats.length} sections, ${top.length} top picks; ${r.checked} possible purchases compared)`);
  ok(['suit','blazer','pants','shirt','tie','shoes','extra'].every(k=>cat(k)),'sections: suits, blazers, trousers, shirts, ties, shoes and belts, socks and accessories');
  ok(recs.every(x=>x.why.length>=2&&x.name&&x.items.length),'every idea has a name and says why');
  // ties: colour and pattern or texture
  const ties=cat('tie').recs;
  ok(ties.length>=3&&ties.every(x=>/tie$/.test(x.name)&&x.detail)&&new Set(ties.map(x=>x.items[0].primaryColor)).size>=2&&new Set(ties.map(x=>x.items[0].pattern)).size>=2,
    `tie ideas name a colour and a pattern or texture (${ties.map(x=>x.name).join(', ')})`);
  ok(ties.some(x=>x.tier==='gap'&&/navy/.test(x.name)&&/staple/.test(x.why.join(' '))),'a plain navy tie is a staple gap: the only navy tie is striped');
  ok(cat('tie').own.n===2&&cat('tie').own.none.includes('dotted or figured'),'the section says what is owned and which patterns are missing');
  // suits: colour and texture, and the rest problem
  const suits=cat('suit').recs;
  ok(r.base.rest>0&&suits.length>=3&&suits[0].tier==='fix'&&suits[0].why.some(w=>/rest/.test(w)),`two suits can't rest: a third fixes it (${suits[0].name}: ${suits[0].why[0]})`);
  ok(suits.some(x=>x.items[0].pattern==='solid'&&/Solid, or a fine texture/.test(x.detail)),'a plain suit idea names the textures to look for');
  ok(suits.every(x=>/shoes/.test(x.why.join(' '))),'each suit idea says which shoes go with it');
  ok(top.slice(0,3).some(x=>x.type==='suit')&&top.filter(x=>x.type==='suit'&&x.tier==='fix').length===1,`one suit is among the first top picks, not five alternatives (${top.slice(0,3).map(x=>x.name).join(', ')})`);
  // shoes: the pair that is never worn for want of a belt, and the load on the one pair in use
  const shoes=cat('shoes');
  ok(shoes.notes.some(n=>/first-choice colour/.test(n))&&shoes.notes.some(n=>/two days running/.test(n)),`the shoe section says what the plan leans on (${shoes.notes.join(' ')})`);
  ok(shoes.recs[0].type==='belt'&&/brown/.test(shoes.recs[0].name)&&/never planned/.test(shoes.recs[0].why[0])&&!shoes.recs.some(x=>x.type==='shoes'&&x.items[0].primaryColor==='brown'&&x.items[0].leather==='calf'),
    'brown shoes without a belt: the belt is the idea, not a second brown pair');
  ok(shoes.recs.some(x=>x.type==='shoes'&&/rest between wears|colour you don't have/.test(x.why[0])),'and another pair so the shoes can rest');
  // coats: one fix, not two for the same days
  const coats=cat('extra').recs.filter(x=>['overcoat','raincoat'].includes(x.type));
  ok(coats.length===1&&coats[0].tier==='fix'&&/cold with no overcoat/.test(coats[0].why[0]),`no double counting: one coat is credited with the cold days (${coats.map(x=>x.name).join(', ')})`);
  ok(cat('extra').recs.some(x=>x.type==='socks'&&/charcoal/.test(x.name)),'socks for the suit that has no matching pair');
  ok(r.occasions.length===4&&r.occasions.find(o=>o.occ==='funeral').gaps.some(g=>/black tie/i.test(g)),'occasions: a funeral lacks a black tie');
  // the same answer from the page thread: nothing random in it
  const again=await p.evaluate(()=>runAnalysis(items,todayDate()).cats.flatMap(c=>c.recs.map(x=>x.key+x.tier)).join());
  ok(again===recs.map(x=>x.key+x.tier).join(),'the same wardrobe gives the same ideas every time');
  // the sheet
  const ui=await p.evaluate(()=>{const s=document.querySelector('#shop-sheet'),b=s.getBoundingClientRect();
    return {top:b.top,bottom:Math.round(innerHeight-b.bottom),rows:s.querySelectorAll('.shop-cat:not(#shop-c-top) .shop-rec').length,tops:s.querySelectorAll('.shop-toprow').length,cats:s.querySelectorAll('.shop-cat').length,
      tags:[...new Set([...s.querySelectorAll('.shop-rec .shop-tag')].map(e=>e.textContent))],text:s.innerText}});
  ok(ui.top<=40&&ui.bottom===0,`the sheet comes up from the bottom over the whole page (top at ${Math.round(ui.top)}px)`);
  ok(ui.rows===recs.length&&ui.tops===top.length&&ui.cats>=9,`every idea is listed (${ui.rows}), with ${ui.tops} top picks and the occasions`);
  ok(ui.tags.includes('Optional')&&ui.tags.includes('Fixes a problem')&&ui.tags.includes('Fills a gap'),`ideas are tagged by how much they matter, optional ones as Optional (${ui.tags.join(', ')})`);
  ok(!/lightblue|lightgrey|darkgrey|undefined|NaN/.test(ui.text),'no run-together colour names or blanks in the sheet');
  // a top pick opens its idea: reasons, sample outfits drawn from the owner's pieces
  const firstSuit=top.find(x=>x.type==='suit');
  await p.evaluate(k=>shopGo(k),firstSuit.key);await settle(p,700);
  const open=await p.evaluate(k=>{const e=[...document.querySelectorAll('#shop-sheet .shop-rec')].find(e=>e.dataset.key===k),s=document.querySelector('#shop-sheet').getBoundingClientRect(),b=e.getBoundingClientRect();
    return {open:e.classList.contains('open'),figs:e.querySelectorAll('.shop-fig svg').length,cap:(e.querySelector('figcaption')||{}).textContent||'',why:e.querySelectorAll('.shop-why li').length,vis:b.top>=s.top&&b.top<s.bottom-80,
      btns:[...e.querySelectorAll('.btns button')].map(b=>b.textContent)}},firstSuit.key);
  ok(open.open&&open.vis&&open.why===firstSuit.why.length,'tapping a top pick unfolds that idea in its section and scrolls to it');
  ok(open.figs>=1&&/With your .*shirt/.test(open.cap),`it shows sample outfits with the owner's own pieces (${open.cap.trim()})`);
  ok(open.btns.join()==='Bought it,Not for me','with "Bought it" and "Not for me"');
  // no sideways scroll, comfortable buttons, on the narrow and the unfolded screens too
  for(const [w,h] of [[320,640],[390,780],[626,720]]){await p.setViewportSize({width:w,height:h});await settle(p,300);
    const m=await p.evaluate(()=>{const s=document.querySelector('#shop-sheet');return {over:s.scrollWidth-s.clientWidth,small:[...s.querySelectorAll('button')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43.5).map(b=>b.textContent.trim().slice(0,16))}});
    ok(m.over<=0&&!m.small.length,`${w}px wide: no sideways scroll, every button at least 44px tall${m.small.length?' ('+m.small.join(', ')+')':''}`)}
  await p.setViewportSize({width:390,height:780});
  // "Not for me": hidden at once, remembered, listed at the bottom, and left out of the next check
  const hideKey=ties.find(x=>x.tier!=='gap').key;
  await p.evaluate(k=>{shopShown[k]=true;renderShop()},hideKey);
  await p.evaluate(k=>[...document.querySelectorAll('#shop-sheet .shop-rec')].find(e=>e.dataset.key===k).querySelector('.btns button:last-child').click(),hideKey);
  await p.waitForFunction(k=>(settings.shopSkip||[]).includes(k)&&![...document.querySelectorAll('#shop-sheet .shop-rec')].some(e=>e.dataset.key===k),hideKey);
  ok(await p.evaluate(async k=>(await metaGet('settings')).shopSkip.includes(k)&&/Hidden ideas/.test(document.querySelector('#shop-sheet').innerText),hideKey),'"Not for me" hides the idea, saves it with the settings and lists it under Hidden ideas');
  // "Bought it": added as on the way, with the arrival date; it counts as owned in the next check
  const buy=suits[0];
  await p.evaluate(k=>{shopShown[k]=true;renderShop();[...document.querySelectorAll('#shop-sheet .shop-rec')].find(e=>e.dataset.key===k).querySelector('.btns button').click()},buy.key);
  await p.fill('#shop-arr','2026-11-20');const n0=await p.evaluate(()=>items.length);
  await p.click('#shop-sheet .shop-buy .pri');
  await p.waitForFunction(n=>items.length>n&&shop&&!shopBusy&&!shopPart,n0,{timeout:90000});
  const after=await p.evaluate(({k,hk})=>{const it=items[items.length-1],r=shop.res,all=r.cats.flatMap(c=>c.recs);
    return {it:{type:it.type,paused:it.paused,order:it.order,arrives:it.arrives,uuid:/^[0-9a-f-]{36}$/.test(it.id)},gone:!all.some(x=>x.key===k),hidden:!all.some(x=>x.key===hk),rest:r.base.rest,msg:document.querySelector('#shop-sheet .shop-msg').textContent,
      tag:[...document.querySelectorAll('#wardrobe .pausetag')].map(e=>e.textContent).join()}},{k:buy.key,hk:hideKey});
  ok(after.it.type==='suit'&&after.it.paused===true&&after.it.order===true&&after.it.arrives==='2026-11-20'&&after.it.uuid,'"Bought it" adds the piece as bought, on the way, with its arrival date');
  ok(/On the way/.test(after.tag)&&/on the way/.test(after.msg),'the wardrobe shows it as on the way and the sheet says so');
  ok(after.gone&&after.rest<r.base.rest,`the next check counts it as owned: the idea is gone and the suits rest (${r.base.rest} short-rest days, now ${after.rest})`);
  ok(after.hidden,'and the hidden idea stays out of the new check');
  ok(await p.evaluate(async()=>{const v=await metaGet('shop');return v&&v.res.v===2&&v.sig===shopSig()}),'the result is kept on the device for next time');
  // closing
  await p.keyboard.press('Escape');
  ok(await p.evaluate(()=>!document.querySelector('#shop-sheet').classList.contains('on')&&!shopOpen),'Escape closes the sheet');
  const btn=await p.textContent('#shop-btn');
  ok(/\d+ ideas · first: /.test(btn)&&!/changed since/.test(btn),`the button sums up the last check (${btn.replace(/\s+/g,' ').trim()})`);
  await p.click('#shop-btn');ok(await p.evaluate(()=>shopOpen&&!shopBusy),'opening it again shows the kept result without checking again');
  await p.evaluate(()=>show('today'));ok(await p.evaluate(()=>!shopOpen),'leaving the tab closes it');
  // a well-stocked wardrobe: nothing to fix; a full category's ideas are optional; an item out of rotation is not counted as owned
  const full=await p.evaluate(`(()=>{const W=${WARDROBES};let k=900;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});settings.shopSkip=[];
    const r=runAnalysis([...W.realistic,{id:'oc',type:'overcoat',primaryColor:'charcoal',pattern:'solid'},{id:'rc',type:'raincoat',primaryColor:'tan',pattern:'solid'},I('suit','black'),I('socks','black',{paused:true}),...[...Array(30)].map(()=>I('shirt','white'))],todayDate());
    const c=k=>r.cats.find(c=>c.key===k);return {fix:r.cats.flatMap(c=>c.recs).filter(x=>x.tier==='fix').length,problems:r.base.problems,shirts:c('shirt').verdict,shirtTiers:c('shirt').recs.map(x=>x.tier),note:c('shirt').notes[0],
      socks:c('extra').recs.filter(x=>x.type==='socks').map(x=>x.name),n:r.cats.flatMap(c=>c.recs).length}})()`);
  ok(full.problems===0&&full.fix===0&&full.n>=10,`a well-stocked wardrobe has nothing to fix and still gets ideas (${full.n})`);
  ok(full.shirts==='covered'&&full.shirtTiers.length>0&&full.shirtTiers.every(t=>t==='optional')&&/nothing here is needed/.test(full.note),`38 shirts: the section is Covered and its ideas are optional (${full.note})`);
  ok(full.socks.includes('black socks'),'black socks out of rotation are not counted as owned: black socks are still suggested');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
