// The Today torso figure (figure.js from the design handoff): fabrics from tagged colours, tap targets, selected piece,
// below-the-waist tiles, optional tie/clip/watch, unique ids, view toggle.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('shirt','lightblue'),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tieclip','gold',{metal:'gold'}),
      I('watch','black',{metal:'gold',dial:'white',band:'leather'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'gold'}),I('socks','navy'),
      I('blazer','navy'),I('pants','grey')];
    settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='never';dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});
  const f=await p.evaluate(()=>{const c=document.querySelector('#mannequin-container'),svg=c.querySelector('svg'),o=planFor()[key(sel)];
    const pat=id=>svg.querySelector(`pattern[id="${id}"]`);
    return {fig:c.classList.contains('fig'),vb:svg.getAttribute('viewBox'),role:svg.getAttribute('role'),label:svg.getAttribute('aria-label'),
      noImg:!svg.querySelector('image'),suitHex:pat('fig-suitB').innerHTML.includes(COLORS[o.top.primaryColor]),lapel:/rotate\(-16\)/.test(pat('fig-suitL').getAttribute('patternTransform')),
      tieDots:pat('fig-tie').querySelectorAll('circle').length>0,clip:!!svg.querySelector('.fig-clip'),clipGold:svg.querySelector('.fig-clip rect:nth-child(2)').getAttribute('fill')===METAL.gold,
      watch:!!svg.querySelector('.fig-watch'),dialWhite:svg.innerHTML.includes(COLORS.white),hot:c.querySelectorAll('.hot').length,
      useInClip:!!svg.querySelector('clipPath use'),shoulder:!!svg.querySelector('clipPath[id="fig-clipShoulder"]'),collar:svg.innerHTML.includes('collar band')}});
  ok(f.fig&&f.vb==='0 0 390 400'&&f.role==='img'&&/navy/.test(f.label),'Today shows the torso figure (390x400, role=img, labelled with the outfit)');
  ok(f.noImg&&f.suitHex,'fabrics are drawn from the tagged colours, not photo crops');
  ok(f.lapel,'lapel weave is turned to follow the lapel');
  ok(f.tieDots,'a polka-dot tie shows dots');
  ok(f.clip&&f.clipGold,'the tie clip is drawn in its metal (gold)');
  ok(f.watch&&f.dialWhite,'the watch uses its dial colour');
  ok(f.hot===0,'no selection dots on the figure');
  ok(!f.useInClip,'no <use> inside <clipPath> (WebKit-safe)');
  ok(f.shoulder&&f.collar,'the redrawn figure: sleeves set into the shoulder line, a shirt collar band around the neck');
  // selecting a piece fills the card
  await p.click('.below .tile >> nth=1');
  ok(/Shoes/.test(await p.textContent('#piece')),'tapping a tile under the figure selects that piece in the card');
  ok((await p.$$eval('.below .tile small',e=>e.map(x=>x.textContent))).join()==='Belt,Shoes,Socks','below the waist: belt, shoes, socks on a suit day');
  // blazer day: trousers tile; no tie => no tie or clip drawn
  const bz=await p.evaluate(()=>{sel=new Date(2026,10,19);renderToday();const t=[...document.querySelectorAll('.below .tile small')].map(x=>x.textContent).join();
    const o=planFor()[key(sel)];return {t,blazer:!o.suitDay}});
  ok(bz.blazer&&bz.t.startsWith('Trousers'),'on a blazer day the trousers are a tile');
  const nt=await p.evaluate(()=>{const o={...planFor()[key(sel)],tie:null,clip:null,watch:null};const d=document.createElement('div');d.innerHTML=figureSvg(o,'x-');
    return {tie:!!d.querySelector('use[href="#x-bladeP"]'),clip:!!d.querySelector('.fig-clip'),watch:!!d.querySelector('.fig-watch')}});
  ok(!nt.tie&&!nt.clip&&!nt.watch,'without a tie, clip or watch, none is drawn');
  // two figures don't share ids
  const ids=await p.evaluate(()=>{const o=planFor()[key(sel)],a=figureSvg(o,'a-'),b=figureSvg(o,'b-'),A=new Set([...a.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));return [...b.matchAll(/id="([^"]+)"/g)].some(m=>A.has(m[1]))});
  ok(!ids,'two figures on a page use distinct ids');
  ok(await p.evaluate(()=>!document.querySelector('.figmode:not(.small)')&&typeof renderMannequinCanvas==='undefined'),'the full-body mannequin is gone (no view toggle)');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=390),'no horizontal scroll on a phone');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
