// Combat boots (2026-11-17, the owner's Rocky S2V): a shoe style of their own, hand-pick only and only with camouflage pants. Never
// planned or suggested; the shoes picker offers them only while the day's pants are camouflage (else a line says why); picked, they are
// worn and the score finds no fault with camouflage pants; other pants picked take them off. Their drawing (SHOE_CB, drawCombatPair) is a
// tracing of its own, in the thumbnail's box, with the sole in the second colour (else the upper a smidge darker) and no marks. The coyote
// colour is offered for shoes; the tagger is offered the style and the colour only when the request names 'combat'.
const path=require('path');const {pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,settle,ROOT})=>{
  ROOT=ROOT||path.resolve(__dirname,'..');
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy'),I('blazer','tan'),I('pants','grey'),I('pants','khaki',{trouserKind:'chinos'}),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),
        I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),
        I('tee','tan'),I('pants','khaki',{trouserKind:'cargo',pattern:'camouflage',secondaryColor:'olive',tertiaryColor:'brown'}),
        I('shoes','coyote',{shoeStyle:'combat',leather:'suede'})];
      HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[3];HOOK.settings.vestMode='never';HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-09T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,9);HOOK.view={y:2026,m:10};HOOK.listOpen=true;HOOK.show('today')});
    const BOOT='shoes16',CAMO='pants15';
    // core: the style, the hand-pick rule, the materials, the colour
    const c=await p.evaluate(B=>{const b=HOOK.items.find(i=>i.id===B);return {hp:HOOK.isHandPick(b),slot:HOOK.handPickSlot(b),style:HOOK.shoeStyle(b),word:HOOK.typeWord(b),mats:HOOK.leathersFor(b).map(l=>HOOK.leatherWord(b,l)).join('|'),
      styles:HOOK.SHOE_STYLES.map(s=>s[0]).join(),cols:HOOK.COLS_BY.shoes.p.includes('coyote')&&HOOK.COLS_BY.shoes.a.includes('coyote'),hex:HOOK.COLORS.coyote,sole:HOOK.colFieldLabel(b,'secondaryColor'),shows:HOOK.colShows(b,'secondaryColor'),
      camo:HOOK.camoPants(HOOK.items.find(i=>i.id==='pants15')),chinos:HOOK.camoPants(HOOK.items.find(i=>i.id==='pants3')),title:HOOK.nm(b)}},BOOT);
    ok(c.hp&&c.slot==='shoes'&&c.style==='combat'&&c.word==='combat boots','combat boots: hand-pick only, worn in the shoes slot');
    ok(c.styles==='oxford,derby,loafer,boot,combat,sneaker','the style list: Combat boot after Boot');
    ok(c.mats==='suede and nylon|nubuck and nylon|smooth leather and nylon',`materials (${c.mats})`);
    ok(c.cols&&c.hex==='#8f6a3c'&&c.sole==='Sole'&&c.shows,'coyote is a shoe colour; the second colour is the sole');
    ok(c.camo&&!c.chinos,'camoPants: the camouflage cargo pants, not chinos');
    ok(/coyote/i.test(c.title)&&/combat boots/i.test(c.title),`the title (${c.title})`);
    // a combat boot added by hand is suede and nylon (the owner, 2026-11-18); a material chosen first is kept
    const hand=await p.evaluate(()=>{const keep=HOOK.queue;HOOK.queue=[{id:'cbq',manual:true,type:'shoes',primaryColor:'coyote',pattern:'solid',leather:'calf'},{id:'cbq2',manual:true,type:'shoes',primaryColor:'coyote',pattern:'solid',leather:'calf'}];
      HOOK.setq('cbq','shoeStyle','combat');HOOK.setq('cbq2','leather','nubuck');HOOK.setq('cbq2','shoeStyle','combat');const r=[HOOK.queue[0].leather,HOOK.queue[1].leather];HOOK.queue=keep;return r});
    ok(hand[0]==='suede'&&hand[1]==='nubuck',`by hand: Combat boot makes the material suede and nylon; a material chosen first stays (${hand})`);    // never planned
    const pl=await p.evaluate(B=>{const s=HOOK.planSim(new Date(2026,9,1)),pl=s.upTo(new Date(2027,0,31));let n=0,hit=0;for(const o of Object.values(pl)){if(!o)continue;n++;if(o.shoes&&o.shoes.id===B)hit++}return {n,hit}},BOOT);
    ok(pl.n>50&&!pl.hit,`never planned over ${pl.n} days`);
    // the picker with other pants: not offered, a line says why
    await p.evaluate(()=>HOOK.openPicker('shoes'));await settle(p,300);
    const a=await p.evaluate(B=>{const s=document.querySelector('#pick-sheet');return {boot:!!s.querySelector(`[data-id="${B}"]`),away:(s.querySelector('.pick-away')||{}).textContent||''}},BOOT);
    ok(!a.boot&&/camouflage pants/.test(a.away),`not offered with the day's pants; the line says why (${a.away})`);
    await p.evaluate(()=>HOOK.closePicker());
    // pick the camouflage pants (a blazer day: Wednesday), then the boots are offered by hand
    await p.evaluate(()=>{HOOK.sel=new Date(2026,10,11);HOOK.cache={};HOOK.renderToday()});await settle(p,300);
    await p.evaluate(C=>HOOK.pickItem('bot',C),CAMO);await settle(p,400);
    await p.evaluate(()=>HOOK.openPicker('shoes'));await settle(p,300);
    const g=await p.evaluate(B=>{const s=document.querySelector('#pick-sheet'),h=s.querySelector('.pick-hand');return {inHand:!!(h&&h.querySelector(`[data-id="${B}"]`)),note:h&&h.textContent,main:!!s.querySelector(`#pick-sheet > .pick-grid [data-id="${B}"]`)}},BOOT);
    ok(g.inHand&&!g.main&&/Combat boots/.test(g.note),'with camouflage pants the boots are offered in the hand-pick group, not the scored grid');
    await p.evaluate(B=>{HOOK.closePicker();return HOOK.pickItem('shoes',B)},BOOT);await settle(p,400);
    const w=await p.evaluate(()=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)],r=HOOK.rateOutfit(o);return {shoes:o.shoes&&o.shoes.id,bot:o.bot&&o.bot.id,shoesCheck:(r.checks.find(x=>x.label==='Shoes')||{}),hard:r.hard,belt:!!o.belt}});
    ok(w.shoes===BOOT&&w.bot===CAMO,`picked: the boots are worn with the camouflage pants (${w.shoes}, ${w.bot})`);
    ok(w.shoesCheck.pts===w.shoesCheck.max&&!w.hard.includes('Shoes'),`the score finds the boots right with camouflage pants (${JSON.stringify(w.shoesCheck)})`);
    // a belt swapped with the boots on: the boots stay (2026-11-18, the owner's coyote belt was refused: the swap freed the shoes, the planner
    // took calf shoes that suit neither the camo pants nor a canvas belt, and dropped the belt)
    const bs=await p.evaluate(async B=>{const k=HOOK.key(HOOK.sel),o=HOOK.planFor()[k],nb=HOOK.items.find(i=>i.type==='belt'&&(!o.belt||i.id!==o.belt.id));await HOOK.pickItem('belt',nb.id);await new Promise(r=>setTimeout(r,300));
      const o2=HOOK.planFor()[k];return {shoes:o2.shoes&&o2.shoes.id,belt:o2.belt&&o2.belt.id,want:nb.id,msg:HOOK.swapMsg}},BOOT);
    ok(bs.shoes===BOOT&&bs.belt===bs.want&&!/stays as it was/.test(bs.msg),`a belt swap with the boots on keeps the boots and takes the belt (${JSON.stringify(bs)})`);
    // other pants picked: the boots come off
    await p.evaluate(()=>HOOK.pickItem('bot','pants3'));await settle(p,400);
    const off=await p.evaluate(B=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)];return {shoes:o.shoes&&o.shoes.id,bot:o.bot&&o.bot.id}},BOOT);
    ok(off.bot==='pants3'&&off.shoes&&off.shoes!==BOOT,`chinos picked: the boots come off (${JSON.stringify(off)})`);
    // the score's reason when worn with other pants
    const why=await p.evaluate(B=>{const o={...HOOK.planFor()[HOOK.key(HOOK.sel)]};o.shoes=HOOK.items.find(i=>i.id===B);const r=HOOK.rateOutfit(o);const s=r.checks.find(x=>x.label==='Shoes');return {pts:s&&s.pts,why:s&&s.why,hard:r.hard}},BOOT);
    ok(why.pts===0&&/combat boots go with camouflage pants/.test(why.why)&&why.hard.includes('Shoes'),`with chinos: "${why.why}"`);
    // the drawing: in the thumbnail's box, the sole in the second colour, else the upper darker, no text
    const d=await p.evaluate(()=>{const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:260px';document.body.appendChild(host);
      const mk=x=>{host.innerHTML=HOOK.itemThumb({id:'t',type:'shoes',shoeStyle:'combat',primaryColor:'coyote',leather:'suede',...x});const svg=host.querySelector('svg'),r=svg.getBoundingClientRect(),b=svg.getBBox();return {svg:svg.outerHTML,b:[b.x,b.y,b.x+b.width,b.y+b.height]}};
      const plain=mk({}),black=mk({secondaryColor:'black'});host.remove();
      return {b:plain.b,text:/<text/i.test(plain.svg),soleDef:plain.svg.includes(HOOK.mix('#8f6a3c','#000',HOOK.CB_SOLE_DARK)),soleBlack:black.svg.includes(HOOK.COLORS.black),hooks:HOOK.SHOE_CB.fhooks.length,grom:HOOK.SHOE_CB.fgrom.length,laces:HOOK.SHOE_CB.flacel.split('M').length-1,len:plain.svg.length}});
    ok(d.b[0]>=0&&d.b[1]>=0&&d.b[2]<=100&&d.b[3]<=100,`the pair stays in the 100 box (${d.b.map(v=>v.toFixed(1))})`);
    ok(!d.text&&d.soleDef&&d.soleBlack,'no text or marks; the sole is the second colour, else the upper a smidge darker');
    ok(d.hooks===4&&d.grom===4&&d.laces>=12,`hooks ${d.hooks}, grommets ${d.grom}, lace runs ${d.laces}`);
    // the worker: the style and colour only for a request that names 'combat'
    const T=await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href);
    const sch=k=>T.tagSchema({colors:[],patterns:[]},true,false,false,k).properties;
    const withC=sch(['sockpat','combat']),without=sch(['sockpat']);
    ok(withC.shoeStyle.anyOf[0].enum.includes('combat')&&withC.primaryColor.enum.includes('coyote')&&!without.shoeStyle.anyOf[0].enum.includes('combat')&&!without.primaryColor.enum.includes('coyote'),'the tag schema offers combat and coyote only to an app that names combat');
    const pr=k=>T.promptOf(k);
    ok(/shoeStyle may also be combat/.test(pr(['combat']))&&!/combat/.test(pr(['sockpat']))&&/shoes: .*coyote/.test(pr(['combat']))&&!/coyote/.test(pr(['sockpat'])),'the prompt names combat boots and coyote only for such an app');
    ok(T.COLOR_HEX.coyote==='#8f6a3c','the worker knows coyote\'s shade');
    ok(!errs.length,'no page errors '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;
