// Today, the piece picker, the score card, the missed-days card, the month, the Add card's dropdowns and the "Today couldn't be shown"
// card name their handlers with data-act (act.js; Round C, wave C2-7, 2026-11-22) where they had inline on…="…" handlers. Every kind
// of control that moved is used here as a person uses it (a tap with a finger, the real dropdown, a key), with the effect it had
// before, and where controls sit inside each other, that only the right ones answered (a swap inside the score card's panel leaves the
// card open; a row inside the open pieces list leaves the list open). The test reads no attribute of the handlers (it finds controls
// by id, class, label and place), so it passes unchanged on the app from before the move: run there to prove the effects are the same.
// Today has <div>s that take a tap (a row's photo, the photo under the tiles, the list's ground, the score card's panel): on a phone
// such a tap is a click only while the element has a click listener of its own (act.js actTaps, from renderToday). Those taps are made
// here with a finger on both engines, but they also pass without actTaps (tried 2026-11-22: Playwright's WebKit sends these <div>s a
// click either way), so the last check reads the listener's effect instead: each such element answers a tap the way a control does.
// Chromium and WebKit (Safari's engine), with touch. The real planner (the score card's swaps).
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
module.exports.realPlanner=true;
const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',origin=new URL(url).origin;
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  let out=0;   // requests that leave the test's own server (the forecast): answered here, counted
  await ctx.route(u=>!u.href.startsWith(origin)&&/^https?:/.test(u.href),route=>{out++;route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
  // (which elements were given a click listener of their own: read by the tap-target check below)
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1');const own=new WeakSet(),add=EventTarget.prototype.addEventListener;window.__ownClick=el=>!!el.onclick||own.has(el);
    EventTarget.prototype.addEventListener=function(t,...a){if(t==='click'&&this instanceof Element)own.add(this);return add.call(this,t,...a)}});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const ev=(f,a)=>p.evaluate(f,a);
  const tap=async(sel,ms)=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.tap();await settle(p,ms||350)};
  /* a tap at a point of an element (its middle unless told), for the <div>s: the finger lands on the element itself, not on a child control */
  const tapAt=async(sel,ms,pos)=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.tap(pos?{position:pos}:{});await settle(p,ms||350)};
  await ev(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
    items=[I('suit','navy',{vest:'yes'}),I('suit','charcoal',{vest:'yes'}),I('suit','grey',{vest:'yes'}),I('suit','brown',{vest:'yes'}),I('blazer','navy'),I('pants','grey'),I('pants','tan'),
      I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','lavender'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','gold'),I('tie','purple'),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal')];
    settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';settings.vestDef=1;settings.setupDone=1;settings.location=null;CK_OPEN['*']=true;weather={};climate=null;
    TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};
    // the days before: three the owner recorded (Nov 3, 4 and 9) and two the app recorded by itself (Nov 5, Nov 8: the missed-days card)
    const pl=planMonth(2026,10),rec=(d,x)=>({date:d,ids:idsOf(pl[d]),suitDay:!!pl[d].suitDay,vestOn:false,...x}),K=n=>key(new Date(2026,10,n));
    dayRecs={[K(3)]:rec(K(3)),[K(4)]:rec(K(4)),[K(5)]:rec(K(5),{auto:true}),[K(8)]:rec(K(8),{auto:true}),[K(9)]:rec(K(9))};cache={};
    try{localStorage.removeItem('missed_ok');localStorage.removeItem('missed_seen')}catch{}
    sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
  await settle(p,500);
  const K=n=>ev(n=>key(new Date(2026,10,n)),n),k5=await K(5),k8=await K(8),k9=await K(9),k10=await K(10),k11=await K(11),k12=await K(12);
  const day=()=>ev(()=>key(sel)),rec=k=>ev(k=>JSON.parse(JSON.stringify(dayRecs[k]||null)),k);
  const out0=()=>ev(()=>{const o=planFor()[key(sel)];return o?idsOf(o):null});

  /* ---- the missed-days card ---- */
  let m=await ev(()=>{const b=document.querySelector('#missbox');return b?{btns:[...b.querySelectorAll('.missbtns:not(.missdays) button')].map(x=>x.textContent.trim()),days:b.querySelectorAll('.missone').length}:null});
  ok(m&&m.btns.length===3&&m.days===0,T+'Today shows the card for the two days the app recorded by itself ('+JSON.stringify(m)+')');
  await tap('#missbox .missbtns button[aria-expanded]');
  m=await ev(()=>({days:document.querySelectorAll('#missbox .missone').length,exp:document.querySelector('#missbox .missbtns button[aria-expanded]').getAttribute('aria-expanded')}));
  ok(m.days===2&&m.exp==='true',T+'"Choose days" lists the two days ('+JSON.stringify(m)+')');
  await tap('#missbox .missdays .missone',600);
  ok((await rec(k5)).worn===false&&(await rec(k8)).worn!==false&&await ev(()=>/Marked as not worn/.test(document.querySelector('#toast').textContent)),T+'a tap on a day’s ✕ marks that day not worn, and only that one');
  await p.waitForFunction(()=>document.querySelectorAll('#missbox .missbtns:not(.missdays) button').length===2).catch(()=>{});
  await tap('#missbox .missbtns button:last-child');
  ok(await ev(k=>!document.querySelector('#missbox')&&localStorage.getItem('missed_ok')===k,k8)&&(await rec(k8)).worn!==false,T+'"Keep as worn" takes the card away and the day stays worn');
  await ev(()=>{localStorage.removeItem('missed_ok');HOOK.missedPut()});await settle(p,300);
  await tap('#missbox .missbtns button:first-child',600);
  ok((await rec(k8)).worn===false,T+'"I didn’t wear it" marks the day left not worn');

  /* ---- the date bar: ‹ ›, by finger and by key; the Wore pill; the weather links ---- */
  await tap('#today .nav.day button[aria-label="Next day"]',600);
  const d1=await day();await tap('#today .nav.day button[aria-label="Previous day"]',600);
  ok(d1===k11&&await day()===k10,T+'› shows the next workday and ‹ the one before ('+d1+', '+await day()+')');
  await p.locator('#today .nav.day button[aria-label="Next day"]').first().focus();await p.keyboard.press('Enter');await settle(p,600);
  const f=await ev(()=>{const a=document.activeElement;return {k:key(sel),ok:!!a&&a.isConnected&&a.getAttribute('aria-label')==='Next day'}});
  ok(f.k===k11&&f.ok,T+'Enter on › steps a day and the new › keeps the focus ('+JSON.stringify(f)+')');
  await tap('#today .nav.day button[aria-label="Previous day"]',600);
  await tap('#wpill',600);
  const w1=await ev(()=>({worn:(dayRecs[key(sel)]||{}).worn,txt:document.querySelector('#wpill').textContent,toast:document.querySelector('#toast').textContent}));
  await tap('#wpill',600);
  const w2=await ev(()=>({worn:(dayRecs[key(sel)]||{}).worn,txt:document.querySelector('#wpill').textContent}));
  ok(w1.worn===false&&/Didn/.test(w1.txt)&&/not worn/.test(w1.toast)&&w2.worn===undefined&&/Wore/.test(w2.txt),T+'the Wore pill marks the day not worn, and worn again ('+JSON.stringify([w1.worn,w1.txt,w2.txt])+')');
  await tap('#today .day h2 a.wxl',600);
  ok(await ev(()=>settingsOpen())&&!/#/.test(p.url()),T+'"Set location" opens Settings and the link goes nowhere ('+p.url().replace(origin,'')+')');
  await ev(()=>{closeSettings();settings.location={lat:1,lon:1,name:'Testville'};weather={};renderToday()});await settle(p,500);
  const n0=out;await tap('#today .day h2 a.wxretry',700);
  ok(out>n0&&!/#/.test(p.url()),T+'"No forecast · retry" asks for the forecast again and the link goes nowhere ('+(out-n0)+' request'+(out-n0===1?'':'s')+')');
  await ev(()=>{settings.location=null;weather={};renderToday()});await settle(p,400);

  /* ---- the month: its head, a day, Fold away ---- */
  await tap('#mbox .month-link',900);
  ok(await ev(()=>monthOpen&&document.querySelector('#mbox').classList.contains('open')&&document.querySelectorAll('#mpanel-in .mc[data-k]').length>=28),T+'a tap on the month box unfolds the month');
  await tap(`#mpanel-in .mc[data-k="${k12}"]`,900);
  ok(await day()===k12&&await ev(()=>!monthOpen),T+'a tap on a day of the month shows that day and folds the month ('+await day()+')');
  await tap('#mbox .month-link',900);await tap('#mbox .foldbar',900);
  ok(await ev(()=>!monthOpen&&document.querySelector('#mbox .month-link').getAttribute('aria-expanded')==='false'),T+'"Fold away" folds the month');
  await ev(()=>goToday());await settle(p,600);

  /* ---- the pieces list: its head, a row and its photo, − and +, the vest, ⇄ and the picker, Suggest another ---- */
  await tap('#ibox .month-link',900);
  ok(await ev(()=>listOpen&&document.querySelector('#ibox').classList.contains('open')),T+'a tap on the pieces box unfolds the list');
  await tap('#ri-shirt .rowtap',800);
  let r=await ev(()=>({row:document.querySelector('#ri-shirt').classList.contains('open'),pic:!!document.querySelector('#rp-shirt .rpic'),list:listOpen,exp:document.querySelector('#ri-shirt .rowtap').getAttribute('aria-expanded')}));
  ok(r.row&&r.pic&&r.list&&r.exp==='true',T+'a tap on the shirt’s row unfolds its picture, and the list stays open ('+JSON.stringify(r)+')');
  await tapAt('#rp-shirt .rpanel-in',800);
  r=await ev(()=>({row:document.querySelector('#ri-shirt').classList.contains('open'),list:listOpen}));
  ok(!r.row&&r.list,T+'a tap on the picture folds it again, and the list stays open ('+JSON.stringify(r)+')');
  await tap('#ri-tie .offb',700);
  const off1=await rec(k10),offRow=await ev(()=>!!document.querySelector('#ri-tie.off-row'));
  await tap('#ri-tie.off-row .swap',700);
  const off2=await rec(k10);
  ok(off1.off&&off1.off.tie===true&&offRow&&!(off2.off&&off2.off.tie)&&await ev(()=>!!planFor()[key(sel)].tie),T+'− takes the tie off for the day and + on its "Taken off" row puts it back');
  await tap('#ibox .vest-row .swap',700);
  const v1=await ev(()=>({v:(dayRecs[key(sel)]||{}).vest,on:!!planFor()[key(sel)].vest,txt:document.querySelector('#ibox .vest-row').textContent}));
  await tap('#ibox .vest-row .swap',700);
  const v2=await ev(()=>({v:(dayRecs[key(sel)]||{}).vest,on:!!planFor()[key(sel)].vest}));
  ok(v1.v===true&&v1.on&&/Matching vest/.test(v1.txt)&&v2.v===false&&!v2.on,T+'the Vest row’s + wears the vest and − leaves it off ('+JSON.stringify([v1.v,v1.on,v2.v,v2.on])+')');
  await tap('#ri-tie .swap:not(.offb)',600);
  const sh=await ev(()=>({on:document.querySelector('#pick-sheet').classList.contains('on'),title:document.querySelector('#pick-title').textContent,n:document.querySelectorAll('#pick-sheet .pick-it').length}));
  ok(sh.on&&/tie/.test(sh.title)&&sh.n===5,T+'⇄ beside the tie opens the picker with every tie ('+JSON.stringify(sh)+')');
  await tap('#pick-sheet .pick-x',500);
  ok(await ev(()=>!picker&&!document.querySelector('#pick-sheet').classList.contains('on')),T+'the picker’s × closes it');
  const b0=await out0();
  await tap('#ri-tie .swap:not(.offb)',600);
  const want=await ev(()=>{const c=[...document.querySelectorAll('#pick-sheet > .pick-grid .pick-it:not(.cur)')].pop();return c.querySelector('.pick-nm').textContent});
  await tap('#pick-sheet > .pick-grid .pick-it:not(.cur) >> nth=-1',800);
  const a1=await ev(()=>{const o=planFor()[key(sel)],r=dayRecs[key(sel)]||{};return {ids:idsOf(o),force:r.force&&r.force.tie,title:itemTitle(o.tie),open:document.querySelector('#pick-sheet').classList.contains('on')}});
  ok(a1.ids.tie!==b0.tie&&a1.force===a1.ids.tie&&a1.title===want&&!a1.open&&a1.ids.shirt===b0.shirt&&a1.ids.top===b0.top,T+'a tap on a tie in the picker wears exactly that tie and closes the picker ('+want+')');

  /* ---- the score card: its head, its panel, a tap among the swaps, a swap ---- */
  await tap('#sbox .month-link',900);
  ok(await ev(()=>scoreOpen&&document.querySelector('#sbox').classList.contains('open')),T+'a tap on the score card unfolds it');
  await p.waitForFunction(()=>!!document.querySelector('#sbox.ranked #sswaps .sfixbtn')).catch(()=>{});
  const sw=await ev(()=>({n:document.querySelectorAll('#sswaps .sfixbtn').length,head:(document.querySelector('#sswaps .ssec')||{}).textContent}));
  ok(sw.n>=1&&!!sw.head,T+'the open card offers swaps that rank higher ('+JSON.stringify(sw)+')');
  await tapAt('#sswaps .ssec',700);
  ok(await ev(()=>scoreOpen&&document.querySelector('#sbox').classList.contains('open')),T+'a tap among the swaps, beside a button, leaves the card open');
  await tapAt('#spanel #srank',900);
  ok(await ev(()=>!scoreOpen&&!document.querySelector('#sbox').classList.contains('open')),T+'a tap on the open card’s words folds it');
  await tap('#sbox .month-link',900);await p.waitForFunction(()=>!!document.querySelector('#sbox.ranked #sswaps .sfixbtn')).catch(()=>{});
  const b1=await out0(),nm=await ev(()=>document.querySelector('#sswaps .sfixbtn .sfixnm').textContent);
  await tap('#sswaps .sfixbtn',900);
  const a2=await ev(()=>({ids:idsOf(planFor()[key(sel)]),force:(dayRecs[key(sel)]||{}).force||{},open:scoreOpen&&document.querySelector('#sbox').classList.contains('open')}));
  const changed=Object.keys(a2.ids).filter(s=>a2.ids[s]!==b1[s]);
  ok(changed.length>=1&&changed.some(s=>a2.force[s]===a2.ids[s])&&a2.open,T+'a tap on a swap wears its piece, and the card stays open ('+nm+': '+changed.join()+')');
  await tap('#sbox .month-link',900);

  /* ---- Suggest another, Reset, Add one, the list's own ground, the tiles ---- */
  const b2=await out0();
  await tap('#ri-shirt .swap',600);await tap('#pick-next',800);
  const a3=await ev(()=>({ids:idsOf(planFor()[key(sel)]),open:document.querySelector('#pick-sheet').classList.contains('on'),skip:(dayRecs[key(sel)]||{}).skip||{}}));
  ok(a3.ids.shirt!==b2.shirt&&!a3.open,T+'"Suggest another" closes the picker and brings another shirt ('+b2.shirt+' → '+a3.ids.shirt+')');
  await tap('#rbox .resetlink',800);
  const a4=await rec(k10);
  ok(!a4.force&&!a4.skip&&await ev(()=>!document.querySelector('#rbox')),T+'Reset puts the planned outfit back');
  const addTxt=await ev(()=>{const b=document.querySelector('#ibox .addone');return b?b.closest('.row').querySelector('.mut').textContent:''});
  await tap('#ibox .addone',700);
  const ad=await ev(()=>({add:!document.querySelector('#add').hidden,today:document.querySelector('#today').hidden,note:document.querySelector('#add-for').textContent,shown:!document.querySelector('#add-for').hidden}));
  ok(addTxt==='Watch'&&ad.add&&ad.today&&ad.shown&&/watch/i.test(ad.note),T+'"Add one" on the Watch row opens Add for a watch ('+ad.note+')');
  await ev(()=>show('today'));await settle(p,500);
  ok(await ev(()=>listOpen),T+'back on Today the list is still open');
  await tapAt('#ri-shirt .row > .mut',900);
  ok(await ev(()=>!listOpen&&!document.querySelector('#ibox').classList.contains('open')),T+'a tap on the open list’s own ground (a piece’s label) folds the list');
  await tap('#today .below .tile',800);
  r=await ev(()=>({open:document.querySelector('#bbox').classList.contains('open'),s:HOOK.belowOpen,exp:document.querySelector('#today .below .tile').getAttribute('aria-expanded'),others:[...document.querySelectorAll('#today .below .tile')].slice(1).every(t=>t.getAttribute('aria-expanded')==='false'),label:document.querySelector('#today .below .tile').getAttribute('aria-label')}));
  ok(r.open&&!!r.s&&r.exp==='true'&&r.others&&/Hide the photo/.test(r.label),T+'a tap on a tile under the figure unfolds its picture and marks that tile open ('+r.s+')');
  await tap('#today .below .tile >> nth=1',700);
  const r2=await ev(()=>({s:HOOK.belowOpen,exp:[...document.querySelectorAll('#today .below .tile')].map(t=>t.getAttribute('aria-expanded')).join()}));
  ok(r2.s!==r.s&&/^false,true/.test(r2.exp),T+'a tap on the next tile shows its picture instead ('+r2.s+', '+r2.exp+')');
  await tapAt('#bpanel .rpanel-in',800);
  ok(await ev(()=>!HOOK.belowOpen&&!document.querySelector('#bbox').classList.contains('open')),T+'a tap on that picture folds it');

  // Safari on a phone sends a tap's click only to a control or to an element with a click handler of its own: Today's <div>s that take a tap
  const divs=await ev(()=>['#rp-shirt .rpanel-in','#bpanel .rpanel-in','#ipanel .mpanel-in','#spanel .mpanel-in','#sswaps'].map(s=>{const e=document.querySelector(s);return s+(e?(__ownClick(e)?'':' has no click handler of its own'):' is missing')}).filter(s=>/ (has|is) /.test(s)));
  ok(!divs.length,T+'a row’s picture, the picture under the tiles, the list’s ground, the score card’s panel and its swaps each have a click handler of their own, so an iPhone’s tap there is a click'+(divs.length?': '+divs.join('; '):''));

  /* ---- the painted picture: its load, and a cloth swatch ---- */
  await ev(PH=>{window.__fit=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(cb){if(cb&&cb.name==='fitNav')window.__fit++;return raf.call(window,cb)};
    const o=planFor()[key(sel)];renders[comboKey(o)]={img:PH,sig:comboSig(o)};renderToday()},PH);
  await p.waitForFunction(()=>window.__fit>=2).catch(()=>{});await settle(p,300);
  const f0=await ev(()=>({photo:!!document.querySelector('#mannequin-container.photo img'),fit:window.__fit,sw:document.querySelectorAll('#mannequin-container .ovsw').length}));
  await ev(()=>{window.__fit=0;const im=document.querySelector('#mannequin-container.photo img');im.src=im.src.replace('AAAAAElFTkSuQmCC','AAAAAElFTkSuQmCC ')});
  await p.waitForFunction(()=>window.__fit>=1).catch(()=>{});
  const f1=await ev(()=>window.__fit);
  ok(f0.photo&&f0.fit>=2&&f1===1,T+'when the day’s picture has loaded the tab bar is fitted again ('+JSON.stringify([f0.fit,f1])+')');
  await tap('#mannequin-container .ovsw',700);
  const s1=await ev(()=>({open:HOOK.swOpen&&HOOK.swOpen.s,pressed:document.querySelector('#mannequin-container .ovsw').getAttribute('aria-pressed')}));
  await tap('#mannequin-container .ovsw',700);
  const s2=await ev(()=>({open:HOOK.swOpen&&HOOK.swOpen.s,pressed:document.querySelector('#mannequin-container .ovsw').getAttribute('aria-pressed')}));
  ok(f0.sw===3&&s1.open==='top'&&s1.pressed==='true'&&!s2.open&&s2.pressed==='false',T+'a tap on a cloth swatch opens that piece up close, and a second tap closes it ('+JSON.stringify([s1,s2])+')');

  /* ---- a past day: Correct this day, and "None: I didn't wear one" ---- */
  await tap('#today .nav.day button[aria-label="Previous day"]',700);
  ok(await day()===k9&&await ev(()=>!!document.querySelector('#today .pastedit')&&!document.querySelector('#ibox .swap')),T+'the workday before is a past day: "Correct this day", and no ⇄ yet');
  await tap('#today .pastedit',700);
  ok(await ev(()=>pastEdit===key(sel)&&listOpen&&document.querySelector('#today .pastedit').getAttribute('aria-pressed')==='true'&&!!document.querySelector('#ri-tie .swap')),T+'"Correct this day" opens the list with ⇄ beside each piece');
  await tap('#ri-tie .swap',600);await tap('#pick-sheet .btns button',800);
  const c=await rec(k9);
  ok(c.ids.tie===null&&c.edited===true&&c.worn===true&&await ev(()=>!document.querySelector('#pick-sheet').classList.contains('on')),T+'"None: I didn’t wear one" records the day without a tie');
  await tap('#today .pastedit',700);
  ok(await ev(()=>pastEdit===null&&document.querySelector('#today .pastedit').getAttribute('aria-pressed')==='false'),T+'Done ends the correcting');

  /* ---- the Add card's dropdowns (app.js S): the real dropdown, by finger and by key ---- */
  await ev(()=>{goToday();openAdd()});await settle(p,400);await tap('#add-manual',600);
  await p.selectOption('#nps-q section[data-ck="type"] select','shoes');await settle(p,500);
  const style='#nps-q label:has-text("Style") select:visible';
  const st0=await ev(()=>({type:queue[0].type,style:!![...document.querySelectorAll('#nps-q label')].find(l=>/^Style/.test(l.textContent.trim()))}));
  ok(st0.type==='shoes'&&st0.style,T+'the Add card’s Type dropdown makes the card a pair of shoes, with a Style dropdown');
  await p.selectOption(style,'loafer');await settle(p,500);
  ok(await ev(()=>queue[0].shoeStyle==='loafer'),T+'a choice in the Style dropdown is taken');
  await p.locator(style).first().focus();await p.keyboard.press('Shift');await p.selectOption(style,'boot');await settle(p,500);
  const st1=await ev(()=>{const a=document.activeElement,l=a&&a.closest('label');return {style:queue[0].shoeStyle,ok:!!a&&a.tagName==='SELECT'&&a.isConnected&&!!l&&/^Style/.test(l.textContent.trim())&&a.value==='boot'}});
  ok(st1.style==='boot'&&st1.ok,T+'picked by keyboard, the new Style dropdown keeps the focus ('+JSON.stringify(st1)+')');

  /* ---- "Today couldn't be shown": Try again loads the app again ---- */
  await ev(()=>{queue.length=0;if('npsClose' in HOOK&&typeof HOOK.npsClose==='function')HOOK.npsClose();window.__mark=1;HOOK.startPlain()});await settle(p,300);
  ok(await ev(()=>/couldn’t be shown/.test(document.querySelector('#today').textContent)&&!document.querySelector('#today').hidden),T+'the plain card says Today couldn’t be shown');
  ok(!errs.length,T+`no page errors (${errs.join(' | ')})`);
  await Promise.all([p.waitForFunction(()=>!window.__mark&&window.appReady,null,{timeout:15000}).catch(()=>{}),p.locator('#today .sactions button').first().tap()]);
  ok(await ev(()=>!window.__mark&&!!window.appReady),T+'"Try again" loads the app again');
  await ctx.close();
}
