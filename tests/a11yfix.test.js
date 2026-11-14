// Front end and accessibility from the 2026-11-13 audit: Settings, the piece picker and What to buy are dialogs (the page behind inert,
// the focus in and back, Tab kept inside, Escape closes); a sync's redraw waits for the item sheet and the picker; Settings opens and
// closes with full or blocked storage; file pickers by keyboard; labels; esc() and city names escaped; the score's points' contrast;
// reduced motion; the folded score list hidden; tap targets.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route('https://geocoding-api.open-meteo.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[{latitude:1,longitude:2,name:'<img src=x onerror=window.__x=1>Town',country_code:'TT'}]})}));
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';sel=new Date(2026,10,16);view={y:2026,m:10};cache={};show('today')});
    const inertMain=()=>p.evaluate(()=>['header','main','nav'].every(s=>document.querySelector(s).inert));
    // Settings
    await p.focus('header button[aria-label="Settings"]');await p.keyboard.press('Enter');
    const s1=await p.evaluate(()=>({open:settingsOpen(),inside:document.querySelector('#settings-modal').contains(document.activeElement)}));
    ok(s1.open&&s1.inside&&await inertMain(),'Settings: the focus moves in and the page behind is inert');
    let out=false;for(let i=0;i<120;i++){await p.keyboard.press('Tab');if(!(await p.evaluate(()=>document.querySelector('#settings-modal').contains(document.activeElement)))){out=true;break}}
    ok(!out,'Tab goes round inside Settings (120 presses)');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(()=>!settingsOpen()&&document.activeElement===document.querySelector('header button[aria-label="Settings"]')&&!document.querySelector('main').inert),'Escape closes Settings and gives the focus back to ⚙');
    // the piece picker
    await p.evaluate(()=>openPicker('shirt'));
    ok(await p.evaluate(()=>!!picker&&document.querySelector('#pick-sheet').contains(document.activeElement))&&await inertMain(),'the piece picker: the focus moves in and the page behind is inert');
    // a sync's redraw waits for the picker
    await p.evaluate(()=>syncRedraw('today'));
    ok(await p.evaluate(()=>!!picker&&document.querySelector('#pick-sheet').classList.contains('on')&&syncLater==='today'),'a sync arriving leaves the picker open; Today is redrawn once it closes');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(()=>!picker&&syncLater===null&&!document.querySelector('main').inert),'Escape closes the picker, and the waiting redraw runs');
    // What to buy (its gate and analysis stood in for)
    const sh=await p.evaluate(()=>{const g=window.shopGate,a=window.analyzeWardrobe;window.shopGate=()=>[];window.analyzeWardrobe=()=>{};openShop();const r={inside:document.querySelector('#shop-sheet').contains(document.activeElement),inert:document.querySelector('main').inert};
      closeShop();r.after=document.querySelector('main').inert;window.shopGate=g;window.analyzeWardrobe=a;return r});
    ok(sh.inside&&sh.inert&&!sh.after,`What to buy: the focus moves in, the page behind is inert while it is up (${JSON.stringify(sh)})`);
    // the item sheet: a sync doesn't wipe what is being typed
    const iv=await p.evaluate(async()=>{show('wardrobe');openItem(items[2].id);await new Promise(r=>setTimeout(r,50));const f=document.querySelector('#item-view textarea,#item-view input[type=text]');if(!f)return {none:true};
      f.focus();f.value='typed by hand';syncRedraw('wardrobe');const g=document.querySelector('#item-view textarea,#item-view input[type=text]');const r={same:g===f,val:g.value,focus:document.activeElement===g,wait:syncLater};
      closeItem();await new Promise(r=>setTimeout(r,500));r.ran=syncLater===null;return r});
    ok(iv.same&&iv.val==='typed by hand'&&iv.focus&&iv.wait==='wardrobe'&&iv.ran,`a sync arriving while the item sheet is open waits for it to close (${JSON.stringify(iv)})`);
    // full or blocked storage
    const st=await p.evaluate(()=>{show('today');const set=Storage.prototype.setItem,get=Storage.prototype.getItem;const r={};
      Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError')};try{openSettings('backup');r.opened=settingsOpen()}catch(e){r.threw=e.message}
      Storage.prototype.getItem=get;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};try{saveSettings();r.closed=!settingsOpen()}catch(e){r.threw2=e.message}
      Storage.prototype.setItem=set;return r});
    ok(st.opened&&st.closed,`Settings opens with storage blocked, and Done closes it with storage full (${JSON.stringify(st)})`);
    // the file pickers by keyboard, labels
    const fk=await p.evaluate(()=>{show('add');const i=document.querySelector('#add-one input[type=file]');i.focus();return {focus:document.activeElement===i,hidden:i.hidden,tab:i.tabIndex,
      lab:['#photo-url','#cfg-city'].every(s=>{const e=document.querySelector(s);return !!(e.getAttribute('aria-label')||e.closest('label'))})}});
    ok(fk.focus&&!fk.hidden&&fk.tab===0,'the file pickers (One item, Several items, Restore file, item photo, close-up) can be reached with Tab');
    ok(fk.lab,'the photo-link field and the city field have labels');
    // escaping
    ok(await p.evaluate(()=>esc(`a'b"c<d&`)==='a&#39;b&quot;c&lt;d&amp;'),"esc() escapes ' too");
    const city=await p.evaluate(async()=>{show('today');openSettings('weather');document.querySelector('#cfg-city').value='town';await findCity();const b=document.querySelector('#city-results button');const r={text:b&&b.textContent,img:!!document.querySelector('#city-results img'),x:!!window.__x};closeSettings();return r});
    ok(/<img/.test(city.text||'')&&!city.img&&!city.x,`a city name from the weather service is shown as text (${city.text})`);
    // the score's points, folded and in both themes
    const sc=await p.evaluate(()=>{show('today');const box=document.querySelector('#sbox');if(!box)return null;const pin=box.querySelector('#spanel .mpanel-in');const folded=getComputedStyle(pin).visibility;
      const cv=document.createElement('canvas').getContext('2d',{willReadFrequently:true}),P=s=>{cv.clearRect(0,0,1,1);cv.fillStyle='#000';cv.fillStyle=s;cv.fillRect(0,0,1,1);return [...cv.getImageData(0,0,1,1).data].slice(0,3)},L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
      const ratio=()=>{const e=box.querySelector('.pts');let bg=null;for(let x=e;x&&!bg;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\(.*, 0\)|transparent/.test(c))bg=c}const a=L(P(getComputedStyle(e).color)),b=L(P(bg));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      const r={folded};for(const t of ['light','dark']){document.documentElement.dataset.theme=t;r[t]=+ratio().toFixed(2)}delete document.documentElement.dataset.theme;return r});
    ok(sc&&sc.folded==='hidden','the folded score list is hidden from screen readers and Tab');
    ok(sc&&sc.light>=4.5&&sc.dark>=4.5,`the score's points are at least 4.5:1 in both themes (${sc&&sc.light}, ${sc&&sc.dark})`);
    // reduced motion: the score's checks, the pieces list and a day step don't animate
    await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(500);   // (the page slide of the show() above ends first)
    const rm=await p.evaluate(async()=>{show('today');toggleScore();toggleList();await new Promise(r=>setTimeout(r,60));const a=document.querySelector('#today').getAnimations({subtree:true}).filter(x=>x.effect&&x.effect.getComputedTiming().duration>50).map(x=>(x.animationName||x.transitionProperty||'js')+'@'+(x.effect.target.closest('[id]')||{}).id+'/'+(x.effect.target.id||x.effect.target.className||x.effect.target.tagName)+':'+Object.keys(x.effect.getKeyframes()[0]||{}).join('/'));
      stepDay(1);const sl=document.querySelector('#slide');const moved=sl&&(sl.style.transform||'')!=='';return {a,moved}});
    ok(rm.a.length===0&&!rm.moved,`with reduced motion the score's checks, the pieces and a day step don't animate (${JSON.stringify(rm)})`);
    await p.emulateMedia({reducedMotion:null});
    // tap targets
    const tg=await p.evaluate(()=>{show('today');foldAll();scrollTo(0,0);const nav=document.querySelector('body>nav button').getBoundingClientRect().height,ar=document.querySelector('.nav.day>button'),r=ar.getBoundingClientRect();
      const hit=document.elementFromPoint(r.left+r.width/2,r.bottom+1)===ar;openSettings('daysoff');const lb=[...document.querySelectorAll('#settings-modal .linkbtn')].find(x=>x.getClientRects().length);const lh=lb?lb.getBoundingClientRect().height:24;closeSettings();return {nav,hit,lh,at:(document.elementFromPoint(r.left+r.width/2,r.bottom+1)||{}).outerHTML?.slice(0,80),r:[r.top,r.bottom,scrollY],ps:(s=>[s.content,s.position,s.top,s.bottom,s.display].join())(getComputedStyle(ar,'::after')),bp:getComputedStyle(ar).position+getComputedStyle(ar).overflow+getComputedStyle(ar.parentElement).overflow+getComputedStyle(ar.parentElement.parentElement).overflow+ar.parentElement.parentElement.id}});
    ok(tg.nav>=44&&tg.hit&&tg.lh>=24,`the tab bar's buttons are ${tg.nav}px tall, a day arrow takes a tap just below its box, a link button is ${tg.lh}px tall${tg.hit?'':' '+JSON.stringify(tg)}`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
