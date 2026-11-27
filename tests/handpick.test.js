// The new casual garments are hand-pick only (2026-11-16, the owner's decision): a T-shirt, sweater, cardigan, chore jacket or cargo pants
// is never planned, suggested ("Suggest another") or counted in the rotation stats and What to buy; Today's picker offers them under
// "Casual · pick by hand"; a pick is worn like any other (the day's record, care counts); a casual top in the shirt slot takes the tie and
// tie clip off for the day; a casual jacket makes the day a blazer day. Also the types everywhere: import words, search, Add card's types.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('blazer','tan'),I('pants','grey'),I('pants','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),
        I('tieclip','silver'),I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),
        I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),
        I('tee','white'),I('sweater','navy',{pattern:'cable',material:'lambswool'}),I('polo','navy'),I('cardigan','charcoal'),I('chore','olive'),I('pants','khaki',{trouserKind:'cargo'})];
      HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[3];HOOK.settings.vestMode='never';HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-09T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,9);HOOK.view={y:2026,m:10};HOOK.listOpen=true;HOOK.show('today')});
    const HP=['tee16','sweater17','polo18','cardigan19','chore20','pants21'];
    // never planned: every workday of three months
    const planned=await p.evaluate(HP=>{const s=HOOK.planSim(new Date(2026,9,1)),pl=s.upTo(new Date(2027,0,31)),seen=new Set();let n=0;
      for(const o of Object.values(pl)){if(!o)continue;n++;for(const sl of HOOK.SLOTS)if(o[sl])seen.add(o[sl].id)}return {n,hp:HP.filter(id=>seen.has(id))}},HP);
    ok(planned.n>50&&!planned.hp.length,`no hand-pick piece is planned over ${planned.n} days (${planned.hp.join(',')||'none'})`);
    ok(await p.evaluate(()=>HOOK.isHandPick({type:'pants',trouserKind:'cargo'})&&!HOOK.isHandPick({type:'pants',trouserKind:'chinos'})&&!HOOK.isHandPick({type:'pants',trouserKind:'jeans'})&&HOOK.isHandPick({type:'hoodie'})&&!HOOK.isHandPick({type:'shirt'})),'isHandPick: the casual types and cargo pants, not chinos or jeans');
    // Suggest another never brings one: swap the shirt and the pants a few times
    const sugg=await p.evaluate(async HP=>{const got=new Set();for(let r=0;r<4;r++)for(const s of ['shirt','bot','top']){await HOOK.swapSlot(s);const o=HOOK.planFor()[HOOK.key(HOOK.sel)];if(o&&o[s])got.add(o[s].id)}return HP.filter(id=>got.has(id))},HP);
    ok(!sugg.length,`Suggest another never brings a hand-pick piece (${sugg.join(',')||'none'})`);
    await p.evaluate(()=>{HOOK.resetDay&&HOOK.dayRecs[HOOK.key(HOOK.sel)]&&delete HOOK.dayRecs[HOOK.key(HOOK.sel)];HOOK.cache={};HOOK.renderToday()});await settle(p,300);
    // the picker: a "Casual · pick by hand" group with the tops, not in the scored grid
    await p.evaluate(()=>HOOK.openPicker('shirt'));await settle(p,300);
    const pk=await p.evaluate(()=>{const s=document.querySelector('#pick-sheet'),g=s.querySelector('.pick-hand'),ids=el=>[...el.querySelectorAll('.pick-it')].map(c=>(c.dataset.slot==='shirt'?c.dataset.id:undefined));
      return {title:s.querySelector('#pick-title').textContent,head:g&&g.querySelector('.pick-hand-h').textContent,hand:g?ids(g):[],main:ids(s.querySelector('.pick-grid')),note:g&&g.textContent}});
    ok(pk.head==='Casual · pick by hand'&&pk.hand.includes('tee16')&&pk.hand.includes('sweater17')&&pk.hand.includes('polo18')&&!pk.hand.includes('cardigan19'),`the shirt picker has the casual tops by hand (${pk.hand})`);
    ok(!pk.main.some(id=>/tee|sweater|polo/.test(id))&&pk.main.length===2,`the scored grid keeps the shirts only (${pk.main})`);
    ok(/Choose a shirt/.test(pk.title)&&/no tie that day/.test(pk.note),`the title and the group's note (${pk.title})`);
    await p.evaluate(()=>HOOK.closePicker());
    // pick the T-shirt: worn in the shirt slot, no tie, no clip, the row named T-shirt
    await p.evaluate(()=>HOOK.pickItem('shirt','tee16'));await settle(p,400);
    const t=await p.evaluate(()=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)];return {shirt:o.shirt&&o.shirt.id,tie:o.tie,clip:o.clip,top:o.top&&o.top.id,hard:HOOK.rateOutfit(o).hard,needs:HOOK.needsTie(o),
      rows:[...document.querySelectorAll('#ibox .row')].map(e=>e.textContent.replace(/\s+/g,' ').trim())}});
    ok(t.shirt==='tee16'&&!t.tie&&!t.clip&&!t.needs,`a T-shirt picked: no tie and no tie clip that day (${JSON.stringify({shirt:t.shirt,tie:!!t.tie,clip:!!t.clip})})`);
    ok(t.rows.some(r=>/^T-shirt/.test(r))&&!t.rows.some(r=>/^Tie/.test(r)),`Today's rows: "T-shirt", no Tie row (${t.rows.join(' | ')})`);
    ok(!t.hard.some(h=>/tie/i.test(h)),`the score asks for no tie (${t.hard.join(';')})`);
    // the group marks it as worn now
    await p.evaluate(()=>HOOK.openPicker('shirt'));await settle(p,300);
    ok(await p.evaluate(()=>{const c=document.querySelector('#pick-sheet .pick-hand .pick-it.cur');return !!c&&/Wearing/.test(c.textContent)}),'the picker shows the T-shirt as worn, in its group');
    await p.evaluate(()=>HOOK.closePicker());
    // recorded as worn: the day's record, care counts
    await p.evaluate(()=>HOOK.setWorn(true));await settle(p,300);
    const w=await p.evaluate(()=>{HOOK.cache={};const r=HOOK.dayRecs[HOOK.key(HOOK.sel)];return {ids:r&&r.ids,care:HOOK.careCounts()['tee16']||0}});
    ok(w.ids&&w.ids.shirt==='tee16'&&!w.ids.tie&&w.care===1,`worn: the record holds the T-shirt (care count ${w.care})`);
    // not in the rotation stats or What to buy
    const st=await p.evaluate(()=>{const S=HOOK.buildStats();return {rows:S.rows?S.rows.map(r=>r.i.id):null,shop:HOOK.shopList(HOOK.items).map(i=>i.id)}});
    ok(st.shop.length&&!st.shop.some(id=>/tee|sweater|polo|cardigan|chore|pants21/.test(id)),'What to buy plans without the hand-pick pieces');
    ok(!st.rows||!st.rows.some(id=>/tee|sweater|polo|cardigan|chore|pants21/.test(id)),'the rotation stats leave them out');
    // Wednesday (a blazer day): pick the cardigan as the jacket; Monday (a suit day) the chore jacket: a blazer day with odd pants
    await p.evaluate(()=>{HOOK.sel=new Date(2026,10,10);HOOK.cache={};HOOK.renderToday()});await settle(p,300);
    await p.evaluate(()=>HOOK.openPicker('top'));await settle(p,300);
    const tp=await p.evaluate(()=>[...document.querySelectorAll('#pick-sheet .pick-hand .pick-it')].map(c=>(c.dataset.slot==='top'?c.dataset.id:undefined)));
    ok(tp.includes('cardigan19')&&tp.includes('chore20')&&tp.length===2,`the jacket picker's hand-pick group: cardigan and chore jacket (${tp})`);
    await p.evaluate(()=>{HOOK.closePicker();return HOOK.pickItem('top','chore20')});await settle(p,400);
    const ch=await p.evaluate(()=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)];return {top:o.top&&o.top.id,suitDay:o.suitDay,bot:o.bot&&o.bot.id,tie:!!o.tie,rows:[...document.querySelectorAll('#ibox .row')].map(e=>e.textContent.replace(/\s+/g,' ').trim())}});
    ok(ch.top==='chore20'&&!ch.suitDay&&ch.bot&&/^pants/.test(ch.bot)&&ch.bot!=='pants21',`a chore jacket on a suit day: a blazer day with odd pants (${JSON.stringify(ch)})`);
    ok(ch.rows.some(r=>/^Chore jacket/.test(r)),'the row is named "Chore jacket"');
    // cargo pants by hand
    await p.evaluate(()=>HOOK.openPicker('bot'));await settle(p,300);
    const bp=await p.evaluate(()=>({hand:[...document.querySelectorAll('#pick-sheet .pick-hand .pick-it')].map(c=>c.textContent),main:[...document.querySelectorAll('#pick-sheet > .pick-grid .pick-it')].map(c=>(c.dataset.slot==='bot'?c.dataset.id:undefined))}));
    ok(bp.hand.length===1&&/Cargo pants/.test(bp.hand[0])&&!bp.main.includes('pants21'),`cargo pants are in the pants picker's hand-pick group only (${bp.main})`);
    await p.evaluate(()=>{HOOK.closePicker();return HOOK.pickItem('bot','pants21')});await settle(p,400);
    ok(await p.evaluate(()=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)];return o.bot&&o.bot.id==='pants21'}),'cargo pants picked are worn that day');
    // the types everywhere: the import's words, the search, the Add card's types, names
    const kit=await p.evaluate(()=>({polo:HOOK.kitType('polo shirt'),jumper:HOOK.kitType('jumper'),qz:HOOK.kitType('1/4 zip'),qz2:HOOK.kitType('quarter zip'),chore:HOOK.kitType('chore coat'),field:HOOK.kitType('field jacket'),cargos:HOOK.kitType('cargos'),
      tee:HOOK.kitType('tee'),tshirt:HOOK.kitType('t-shirt'),hood:HOOK.kitType('hoodie'),cardi:HOOK.kitType('cardigan'),crew:HOOK.kitType('crewneck'),sweat:HOOK.kitType('sweatshirt'),henley:HOOK.kitType('henley')}));
    ok(kit.polo==='polo'&&kit.jumper==='sweater'&&kit.qz==='qzip'&&kit.qz2==='qzip'&&kit.chore==='chore'&&kit.field==='chore'&&kit.cargos==='pants'&&kit.tee==='tee'&&kit.tshirt==='tee'&&kit.hood==='hoodie'&&kit.cardi==='cardigan'&&kit.crew==='sweater'&&kit.sweat==='sweatshirt'&&kit.henley==='henley',`import words (${JSON.stringify(kit)})`);
    const words=await p.evaluate(()=>({hay:HOOK.wardHay(HOOK.items.find(i=>i.id==='tee16')),cargo:HOOK.wardHay(HOOK.items.find(i=>i.id==='pants21')),title:HOOK.itemTitle(HOOK.items.find(i=>i.id==='pants21')),nm:HOOK.nm(HOOK.items.find(i=>i.id==='sweater17')),
      pats:HOOK.PATS_BY.sweater.join(),np:HOOK.normPat('tee','breton'),mats:HOOK.MATERIALS_BY.polo[0],ma:HOOK.matAlias('sweatshirt','terry')}));
    ok(/\btee\b/.test(words.hay)&&/casual/.test(words.hay)&&/cargo/.test(words.cargo),'search finds "tee", "casual" and "cargo"');
    ok(words.title==='Khaki cargo pants'&&/navy cable sweater/.test(words.nm),`names (${words.title}; ${words.nm})`);
    ok(words.np==='stripe'&&words.mats==='piqué'&&words.ma==='french terry'&&/cable/.test(words.pats),'patterns, materials and their other words');
    await p.evaluate(()=>HOOK.show('wardrobe'));await settle(p,300);
    const chips=await p.evaluate(()=>[...document.querySelectorAll('#wardrobe .chip')].map(c=>c.textContent.trim()));
    ok(chips.some(c=>/^T-shirt 1/.test(c))&&chips.some(c=>/^Chore jacket 1/.test(c))&&!chips.some(c=>/^Hoodie/.test(c)),`Wardrobe chips: a casual type's chip once one is owned (${chips.join(', ')})`);
    ok(await p.evaluate(()=>Object.entries(HOOK.TYPES).filter(([k])=>HOOK.HANDPICK_TYPES.includes(k)).length===10&&HOOK.TAG_TYPES.includes('cargo')&&HOOK.TAG_TYPES.includes('blouse')),'ten new types (the uniform blouse since 2026-11-17); the tag requests name them');
    ok(!errs.length,'no page errors '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;
