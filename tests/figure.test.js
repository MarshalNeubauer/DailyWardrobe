// The Today torso figure (figure.js from the design handoff): fabrics from tagged colours, tap targets, selected piece,
// below-the-waist tiles, optional tie/clip/watch, unique ids, view toggle.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    HOOK.items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('shirt','lightblue'),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tieclip','gold',{metal:'gold'}),
      I('watch','black',{metal:'gold',dial:'white',band:'leather'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'gold'}),I('socks','navy'),
      I('blazer','navy'),I('pants','grey')];
    HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[4];HOOK.settings.vestMode='never';HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-15T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,16);HOOK.view={y:2026,m:10};HOOK.show('today')});
  const f=await p.evaluate(()=>{const c=document.querySelector('#mannequin-container'),svg=c.querySelector('svg'),o=HOOK.planFor()[HOOK.key(HOOK.sel)],G=mqData(HOOK.figKind(o));
    const pat=id=>svg.querySelector(`pattern[id="${id}"]`),lap=G.parts.find(x=>x.id==='lapL'),fills=[...svg.querySelectorAll('.fig-watch path')].map(e=>e.getAttribute('fill'));
    return {fig:c.classList.contains('fig'),kind:HOOK.figKind(o),vb:svg.getAttribute('viewBox'),role:svg.getAttribute('role'),label:svg.getAttribute('aria-label'),
      noImg:!svg.querySelector('image:not(.fig-shade):not(.fig-office)'),suitHex:pat('fig-suitB').innerHTML.includes(HOOK.COLORS[o.top.primaryColor]),lapel:pat('fig-suitL').getAttribute('patternTransform').includes(`rotate(${lap.rot})`),
      tieDots:pat('fig-tie').querySelectorAll('circle').length>0,clip:!!svg.querySelector('.fig-clip'),clipGold:svg.querySelector('.fig-clip rect:nth-child(2)').getAttribute('fill')===HOOK.METAL.gold,
      watch:fills.length>3&&fills.every(x=>G.watch.some(b=>b.c===x)),hot:c.querySelectorAll('.hot').length,skin:!!svg.querySelector('.fig-skin'),useInClip:!!svg.querySelector('clipPath use'),
      clipOnTie:(()=>{const k=svg.querySelector('.fig-clip').getBoundingClientRect(),t=svg.querySelector('use[href="#fig-bladeP"]').getBoundingClientRect();return k.left<t.right&&k.right>t.left&&k.top>=t.top-8&&k.bottom<=t.bottom})()}});
  ok(f.fig&&f.kind==='suit'&&f.vb==='0 0 390 390'&&f.role==='img'&&/navy/.test(f.label),'a suit day shows the suit pose\'s traced mannequin (390x390, role=img, labelled with the outfit)');
  ok(f.noImg&&f.suitHex,'fabrics are drawn from the tagged colors, not photo crops');
  ok(f.lapel,'lapel weave is turned to follow the traced lapel');
  ok(f.tieDots,'a polka-dot tie shows dots');
  ok(f.clip&&f.clipGold&&f.clipOnTie,'the tie clip is drawn in its metal (gold), on the tie\'s blade where the painter puts it');
  ok(f.watch,'the watch is the master\'s steel watch (as the painted picture), not the gold item');
  ok(f.hot===0,'no selection dots on the figure');
  ok(!f.useInClip,'no <use> inside <clipPath> (WebKit-safe)');
  ok(f.skin,'the hands are the traced skin');
  // a tile unfolds that item's photo in a box below the tiles; tapping it again, or the photo, folds it back
  await p.click('.below .tile >> nth=1');await settle(p,600);
  const bo=await p.evaluate(()=>{const b=HOOK.$('#bbox'),o=HOOK.planFor()[HOOK.key(HOOK.sel)],t=[...document.querySelectorAll('.below .tile')];
    return {open:b.classList.contains('open'),h:b.querySelector('.rpanel').getBoundingClientRect().height,exp:t.map(x=>x.getAttribute('aria-expanded')).join(),label:t[1].getAttribute('aria-label'),pic:!!b.querySelector('.rpic'),below:b.getBoundingClientRect().top>=document.querySelector('.below').getBoundingClientRect().bottom-1,shoes:o.shoes&&o.shoes.id,shown:HOOK.belowOpen}});
  ok(bo.open&&bo.h>60&&bo.pic&&bo.below&&bo.shown==='shoes'&&bo.exp==='false,true,false'&&/Hide the photo/.test(bo.label),`tapping the shoes tile unfolds their photo below the tiles (${bo.h|0}px, ${bo.exp})`);
  await p.click('.below .tile >> nth=0');await p.waitForFunction(()=>HOOK.belowOpen==='belt',null,{timeout:5000}).catch(()=>{});
  ok(await p.evaluate(()=>HOOK.belowOpen==='belt'&&HOOK.$('#bbox').classList.contains('open')&&document.querySelectorAll('.below .tile[aria-expanded="true"]').length===1),'tapping another tile switches the box to that item');
  await p.click('#bbox .rpanel-in');await settle(p,600);
  ok(await p.evaluate(()=>!HOOK.$('#bbox').classList.contains('open')&&HOOK.belowOpen===null&&HOOK.$('#bbox .rpanel').getBoundingClientRect().height<1),'tapping the photo folds it back');
  await p.click('.below .tile >> nth=2');await p.click('.below .tile >> nth=2');await settle(p,600);
  ok(await p.evaluate(()=>!HOOK.$('#bbox').classList.contains('open')&&HOOK.$('#bbox .rpanel').getBoundingClientRect().height<1),'tapping the same tile again folds it back');
  ok(await p.evaluate(()=>!document.querySelector('#piece')),'there is no swap card under the score any more');
  ok((await p.$$eval('.below .tile small',e=>e.map(x=>x.textContent))).join()==='Belt,Shoes,Socks','below the waist: belt, shoes, socks on a suit day');
  // blazer day: trousers tile; no tie => no tie or clip drawn
  const bz=await p.evaluate(()=>{HOOK.sel=new Date(2026,10,19);HOOK.renderToday();const t=[...document.querySelectorAll('.below .tile small')].map(x=>x.textContent).join();
    const o=HOOK.planFor()[HOOK.key(HOOK.sel)];return {t,blazer:!o.suitDay}});
  ok(bz.blazer&&bz.t.startsWith('Pants'),'on a blazer day the pants are a tile');
  const nt=await p.evaluate(()=>{const o={...HOOK.planFor()[HOOK.key(HOOK.sel)],tie:null,clip:null,watch:null};const d=document.createElement('div');d.innerHTML=HOOK.figureSvg(o,'x-');
    return {tie:!!d.querySelector('use[href="#x-bladeP"]'),clip:!!d.querySelector('.fig-clip'),watch:!!d.querySelector('.fig-watch')}});
  ok(!nt.tie&&!nt.clip,'without a tie or clip, neither is drawn');
  // two figures don't share ids
  const ids=await p.evaluate(()=>{const o=HOOK.planFor()[HOOK.key(HOOK.sel)],a=HOOK.figureSvg(o,'a-'),b=HOOK.figureSvg(o,'b-'),A=new Set([...a.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));return [...b.matchAll(/id="([^"]+)"/g)].some(m=>A.has(m[1]))});
  ok(!ids,'two figures on a page use distinct ids');
  ok(await p.evaluate(()=>!document.querySelector('.figmode:not(.small)')&&typeof renderMannequinCanvas==='undefined'),'the full-body mannequin is gone (no view toggle)');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=390),'no horizontal scroll on a phone');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
