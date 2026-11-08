// The Today torso figure (figure.js from the design handoff): fabrics from tagged colours, tap targets, selected piece,
// below-the-waist tiles, optional tie/clip/watch, unique ids, view toggle.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{localStorage.removeItem('fig_mode');let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('shirt','lightblue'),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tieclip','gold',{metal:'gold'}),
      I('watch','black',{metal:'gold',dial:'white',band:'leather'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'gold'}),I('socks','navy'),
      I('blazer','navy'),I('pants','grey')];
    settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});
  const f=await p.evaluate(()=>{const c=document.querySelector('#mannequin-container'),svg=c.querySelector('svg'),o=planFor()[key(sel)];
    const pat=id=>svg.querySelector(`pattern[id="${id}"]`);
    return {fig:c.classList.contains('fig'),vb:svg.getAttribute('viewBox'),role:svg.getAttribute('role'),label:svg.getAttribute('aria-label'),
      noImg:!svg.querySelector('image'),suitHex:pat('fig-suitB').innerHTML.includes(COLORS[o.top.primaryColor]),lapel:/rotate\(-16\)/.test(pat('fig-suitL').getAttribute('patternTransform')),
      tieDots:pat('fig-tie').querySelectorAll('circle').length>0,clip:!!svg.querySelector('.fig-clip'),clipGold:svg.querySelector('.fig-clip rect:nth-child(2)').getAttribute('fill')===METAL.gold,
      watch:!!svg.querySelector('.fig-watch'),dialWhite:svg.innerHTML.includes(COLORS.white),hot:[...c.querySelectorAll('.hot')].map(b=>b.getAttribute('aria-label').split(':')[0]),
      size:[...c.querySelectorAll('.hot')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44}),
      useInClip:!!svg.querySelector('clipPath use')}});
  ok(f.fig&&f.vb==='0 0 390 400'&&f.role==='img'&&/navy/.test(f.label),'Today shows the torso figure (390x400, role=img, labelled with the outfit)');
  ok(f.noImg&&f.suitHex,'fabrics are drawn from the tagged colours, not photo crops');
  ok(f.lapel,'lapel weave is turned to follow the lapel');
  ok(f.tieDots,'a polka-dot tie shows dots');
  ok(f.clip&&f.clipGold,'the tie clip is drawn in its metal (gold)');
  ok(f.watch&&f.dialWhite,'the watch uses its dial colour');
  ok(f.hot.join()==='Suit,Shirt,Tie,Tie clip,Watch'&&f.size,'five labelled tap targets, each at least 44x44');
  ok(!f.useInClip,'no <use> inside <clipPath> (WebKit-safe)');
  // selecting a piece fills the card
  await p.click('.hot[aria-label^="Tie:"]');
  const card=await p.evaluate(()=>({t:document.querySelector('#piece').textContent,pressed:document.querySelector('.hot[aria-label^="Tie:"]').getAttribute('aria-pressed')}));
  ok(/Tie/.test(card.t)&&/Burgundy/i.test(card.t)&&card.pressed==='true','tapping the tie selects it in the piece card');
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
  // view toggle
  await p.click('.figmode >> text=Full outfit');
  ok(await p.evaluate(()=>!document.querySelector('.fig')&&!!document.querySelector('.man svg')&&localStorage.getItem('fig_mode')==='full'),'Full outfit switches to the full mannequin (remembered)');
  await p.click('.figmode >> text=Close-up');
  ok(await p.evaluate(()=>!!document.querySelector('.fig svg')),'Close-up switches back');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=390),'no horizontal scroll on a phone');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
