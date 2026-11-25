// Accessibility: focus, labels, targets and screen-reader names.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/a11yfix.test.js ---- */
// Front end and accessibility from the 2026-11-13 audit: Settings, the piece picker and What to buy are dialogs (the page behind inert,
// the focus in and back, Tab kept inside, Escape closes); a sync's redraw waits for the item sheet and the picker; Settings opens and
// closes with full or blocked storage; file pickers by keyboard; labels; esc() and city names escaped; the score's points' contrast;
// reduced motion; the folded score list hidden; tap targets.
const a11yfix=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route('https://geocoding-api.open-meteo.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[{latitude:1,longitude:2,name:'<img src=x onerror=window.__x=1>Town',country_code:'TT'}]})}));
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-15T12:00:00';HOOK.sel=new Date(2026,10,16);HOOK.view={y:2026,m:10};HOOK.cache={};show('today')});
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
    ok(await p.evaluate(()=>!!picker&&document.querySelector('#pick-sheet').classList.contains('on')&&HOOK.syncLater==='today'),'a sync arriving leaves the picker open; Today is redrawn once it closes');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(()=>!picker&&HOOK.syncLater===null&&!document.querySelector('main').inert),'Escape closes the picker, and the waiting redraw runs');
    // What to buy (enough pieces for its gate, for this one step; a check "already running", so none starts)
    const sh=await p.evaluate(()=>{const keep=items,I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',...x});HOOK.items=[...keep,I('sx1','suit','grey'),I('sx2','shirt','white'),I('sx3','shirt','pink'),I('sx4','shirt','cream'),I('sx5','tie','green'),I('sx6','tie','gold'),I('sx7','shoes','brown',{leather:'calf'})];HOOK.shopBusy={i:-1,n:1,label:'',t0:Date.now()};HOOK.openShop();const r={inside:document.querySelector('#shop-sheet').contains(document.activeElement),inert:document.querySelector('main').inert};
      closeShop();r.after=document.querySelector('main').inert;HOOK.items=keep;HOOK.shopBusy=null;return r});
    ok(sh.inside&&sh.inert&&!sh.after,`What to buy: the focus moves in, the page behind is inert while it is up (${JSON.stringify(sh)})`);
    // the item sheet: a sync doesn't wipe what is being typed
    const iv=await p.evaluate(async()=>{show('wardrobe');openItem(items[2].id);await new Promise(r=>setTimeout(r,50));const f=document.querySelector('#item-view textarea,#item-view input[type=text]');if(!f)return {none:true};
      f.focus();f.value='typed by hand';syncRedraw('wardrobe');const g=document.querySelector('#item-view textarea,#item-view input[type=text]');const r={same:g===f,val:g.value,focus:document.activeElement===g,wait:HOOK.syncLater};
      HOOK.closeItem();await new Promise(r=>setTimeout(r,500));r.ran=HOOK.syncLater===null;return r});
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
      const ratio=()=>{const e=box.querySelector('.sdl small');let bg=null;for(let x=e;x&&!bg;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\(.*, 0\)|transparent/.test(c))bg=c}const a=L(P(getComputedStyle(e).color)),b=L(P(bg));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      const r={folded};for(const t of ['light','dark']){document.documentElement.dataset.theme=t;r[t]=+ratio().toFixed(2)}delete document.documentElement.dataset.theme;return r});
    ok(sc&&sc.folded==='hidden','the folded score list is hidden from screen readers and Tab');
    ok(sc&&sc.light>=4.5&&sc.dark>=4.5,`the score's points are at least 4.5:1 in both themes (${sc&&sc.light}, ${sc&&sc.dark})`);
    // reduced motion: the score's checks, the pieces list and a day step don't animate
    await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(500);   // (the page slide of the show() above ends first)
    const rm=await p.evaluate(async()=>{show('today');toggleScore();HOOK.toggleList();await new Promise(r=>setTimeout(r,60));const a=document.querySelector('#today').getAnimations({subtree:true}).filter(x=>x.effect&&x.effect.getComputedTiming().duration>50).map(x=>(x.animationName||x.transitionProperty||'js')+'@'+(x.effect.target.closest('[id]')||{}).id+'/'+(x.effect.target.id||x.effect.target.className||x.effect.target.tagName)+':'+Object.keys(x.effect.getKeyframes()[0]||{}).join('/'));
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

/* ---- was tests/a11yround3.test.js ---- */
// Fix round 3 (2026-11-16), accessibility and the older user (W2-19, W2-14): the focus kept after a redraw and the change said (#sr-live);
// the item sheet and the color sheet over it as dialogs; the color buttons' names; the tab, chip and day states; a faded toast gone for
// everyone; the dark red button, field edges, green words; Today's "Add one" for its type; the colors above the Keep button; the cleaning
// banner's way forward; the tour's double tap; the theme button's first tap; the weather that couldn't be read; the pieces legend; headings.
const a11yround3=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const build=()=>p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy',{pattern:'herringbone'}),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('socks','navy')];
      if(typeof CK_OPEN!=='undefined')CK_OPEN['*']=true;   // (the item sheet's checklist sections open: the color button is inside one)
      settings.workdays=[0,1,2,3,4];HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-16T09:00:00';HOOK.sel=new Date(2026,10,16);HOOK.view={y:2026,m:10};HOOK.cache={};show('today')});
    await build();
    const live=()=>p.evaluate(()=>new Promise(r=>setTimeout(()=>r(document.querySelector('#sr-live').textContent),150)));
    const act=()=>p.evaluate(()=>{const a=document.activeElement;return !a||a===document.body?'BODY':(a.id?'#'+a.id:'')+(a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,40)});

    // W2-19-01: Next day by keyboard keeps the focus on Next day and says the new day and outfit
    await p.focus('#today button[aria-label="Next day"]');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    ok(await act()==='Next day',`Next day by keyboard: the focus stays on it after the redraw (${await act()})`);
    const said=await live();
    ok(/^Tuesday, November 17: \S/.test(said),`the new day and its outfit are said by the live region ("${said}")`);
    await p.focus('#today button[aria-label="Previous day"]');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    // the Wore pill (today, Monday 16): the focus stays, a line says what changed (W2-14-09)
    await p.evaluate(()=>{HOOK.TODAY_OVERRIDE='2026-11-16T18:00:00';HOOK.cache={};renderToday()});
    await p.focus('#wpill');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    const wp=await p.evaluate(()=>({f:document.activeElement&&document.activeElement.id,no:document.querySelector('#wpill').classList.contains('no'),t:document.querySelector('#toast').textContent,label:document.querySelector('#wpill').getAttribute('aria-label')}));
    ok(wp.f==='wpill'&&wp.no&&/not worn/.test(wp.t)&&wp.label==='Wore this outfit',`the Wore pill keeps the focus, says "Marked as not worn", and its name stays (${JSON.stringify(wp)})`);
    await p.keyboard.press('Enter');await p.waitForTimeout(300);

    // W2-19-05: the tab, the chip and the month's day are spoken states
    await p.evaluate(()=>show('wardrobe'));
    await p.evaluate(()=>{const c=[...document.querySelectorAll('#wardrobe .chip')].find(b=>/^Suit/.test(b.textContent));c.click()});
    const st=await p.evaluate(()=>({tab:document.querySelector('#n-wardrobe').getAttribute('aria-current'),other:document.querySelector('#n-today').getAttribute('aria-current'),
      chip:[...document.querySelectorAll('#wardrobe .chip')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent.trim())}));
    ok(st.tab==='page'&&st.other===null&&st.chip.length===1&&/^Suit/.test(st.chip[0]),`the tab is aria-current and the chip aria-pressed (${JSON.stringify(st)})`);
    await p.evaluate(()=>{HOOK.flt='all';renderWardrobe()});

    // W2-19-02: the item sheet takes the focus and gives it back to the item's box
    const tile='#wardrobe .gi:nth-child(3) .giopen';
    await p.focus(tile);await p.keyboard.press('Enter');await p.waitForTimeout(500);
    const op=await p.evaluate(()=>({inside:document.querySelector('#item-view').contains(document.activeElement)}));
    ok(op.inside,'opening an item by keyboard moves the focus into the sheet');
    // W2-19-04: the color and pattern buttons say their values
    const names=await p.evaluate(()=>[...document.querySelectorAll('#item-view .colbtn')].map(b=>b.getAttribute('aria-label')));
    ok(names.some(n=>/^Color: \S/.test(n||''))&&names.some(n=>/^Pattern: \S/.test(n||'')),`the color and pattern buttons are named with their values (${names.join(' | ')})`);
    // W2-19-03: the color sheet over the item sheet: the item sheet is out of reach, Tab stays in, Escape gives the focus back
    await p.focus('#item-view .colbtn[data-k=primaryColor]');await p.keyboard.press('Enter');await p.waitForTimeout(400);
    ok(await p.evaluate(()=>document.querySelector('#item-view').inert&&document.querySelector('#col-sheet').contains(document.activeElement)),'the color sheet: the focus is in it and the item sheet behind is inert');
    let out=0;for(let i=0;i<30;i++){await p.keyboard.press('Tab');if(await p.evaluate(()=>!document.querySelector('#col-sheet').contains(document.activeElement)))out++}
    ok(out===0,`Tab stays inside the color sheet (${out} of 30 left it)`);
    await p.keyboard.press('Escape');await p.waitForTimeout(300);
    const ce=await p.evaluate(()=>({k:document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.k,inert:document.querySelector('#item-view').inert}));
    ok(ce.k==='primaryColor'&&!ce.inert,`Escape closes the color sheet and the focus is back on the Color button (${JSON.stringify(ce)})`);
    // picking a color: the sheet is drawn again, the focus comes back to the same field's button
    await p.focus('#item-view .colbtn[data-k=primaryColor]');await p.keyboard.press('Enter');await p.waitForTimeout(300);
    await p.evaluate(()=>{const t=[...document.querySelectorAll('#col-sheet .cptile')].find(b=>b.dataset.c&&b.dataset.c!==colPick.cur&&b.dataset.c!=='none');t.click()});
    await p.evaluate(()=>document.querySelector('#col-sheet .cpbar button').focus());await p.keyboard.press('Enter');await p.waitForTimeout(500);
    ok(await p.evaluate(()=>document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.k==='primaryColor'&&document.querySelector('#item-view').contains(document.activeElement)),'after Use, the focus is on the Color button of the item drawn again');
    await p.keyboard.press('Escape');await p.waitForTimeout(600);
    ok(await p.evaluate(()=>!editing&&!!document.activeElement.closest('.gi')),`Escape closes the item and the focus is on its box in the grid (${await act()})`);

    // W2-14-02: a color to pick shows above the Keep button, at the default and the largest text
    for(const ts of ['1','1.5']){
      const m=await p.evaluate(async ts=>{document.documentElement.style.setProperty('--tscale',ts);openItem(items[0].id);await new Promise(r=>setTimeout(r,200));
        document.querySelector('#item-view .colbtn[data-k=primaryColor]').click();await new Promise(r=>setTimeout(r,300));
        const sh=document.querySelector('#col-sheet'),bar=sh.querySelector('.cpbar').getBoundingClientRect().top;
        const first=[...sh.querySelectorAll('.cpgrid:not(.cnown) .cptile')][0].getBoundingClientRect();
        const own=sh.querySelector('#cn-open').getBoundingClientRect().top,std=first.top;closeColPick();HOOK.closeItem();await new Promise(r=>setTimeout(r,500));
        document.documentElement.style.removeProperty('--tscale');return {bar:Math.round(bar),std:Math.round(std),bottom:Math.round(first.bottom),own:Math.round(own)}},ts);
      ok(m.bottom<=m.bar&&m.own<m.std,`text at ${ts}: the first color to pick is whole above the Keep button, under the slim "Your colors" line (${JSON.stringify(m)})`);
    }

    // W2-19-06: a faded toast is gone for the keyboard and VoiceOver
    const tt=await p.evaluate(async()=>{show('today');toast('Saved: test.',300,{label:'Undo',fn:()=>{window.__undone=1}});await new Promise(r=>setTimeout(r,HOOK.TOAST_ACT_MS+800));const t=document.querySelector('#toast');
      return {text:t.textContent,btn:!!t.querySelector('button'),vis:getComputedStyle(t).visibility}});
    ok(tt.text===''&&!tt.btn&&tt.vis==='hidden',`a toast that has faded holds no words or Undo, and is hidden (${JSON.stringify(tt)})`);
    const tk=await p.evaluate(async()=>{toast('Saved: kept.',300,{label:'Undo',fn:()=>{}});document.querySelector('#toast button').focus();await new Promise(r=>setTimeout(r,HOOK.TOAST_ACT_MS+800));
      const r=!!document.querySelector('#toast.on button');document.activeElement.blur();await new Promise(r=>setTimeout(r,2000));return {kept:r,gone:!document.querySelector('#toast button')}});
    ok(tk.kept&&tk.gone,`while the keyboard is on its Undo the toast stays, and goes once the focus leaves (${JSON.stringify(tk)})`);

    // W2-19-07, W2-19-08, W2-19-11: contrast in both themes
    const con=await p.evaluate(()=>{const cv=document.createElement('canvas').getContext('2d',{willReadFrequently:true}),P=s=>{cv.clearRect(0,0,1,1);cv.fillStyle='#000';cv.fillStyle=s;cv.fillRect(0,0,1,1);return [...cv.getImageData(0,0,1,1).data].slice(0,3)};
      const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])},R=(a,b)=>{const x=L(P(a)),y=L(P(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
      const bgOf=e=>{for(let x=e.parentElement;x;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;if(!/rgba\(.*, 0\)|transparent/.test(c))return c}return '#fff'};
      const out={};show('wardrobe');
      for(const t of ['light','dark']){document.documentElement.dataset.theme=t;
        askConfirm('Delete?',{ok:'Delete',danger:true});const b=document.querySelector('#ask-sheet .ask-danger'),cs=getComputedStyle(b);const d=R(cs.color,cs.backgroundColor);askAnswer(false);
        const fs=[...document.querySelectorAll('#wsearch,#wsort')].map(e=>R(getComputedStyle(e).borderTopColor,bgOf(e)));
        const g=document.createElement('span');g.className='fit best';document.querySelector('#wardrobe').append(g);const gr=R(getComputedStyle(g).color,bgOf(g));g.remove();
        out[t]={danger:+d.toFixed(2),field:+Math.min(...fs).toFixed(2),green:+gr.toFixed(2)}}
      delete document.documentElement.dataset.theme;return out});
    ok(['light','dark'].every(t=>con[t].danger>=4.5&&con[t].field>=3&&con[t].green>=4.5),`the danger button 4.5:1, field edges 3:1 and green words 4.5:1 in both themes (${JSON.stringify(con)})`);

    // W2-14-01: Today's "Add one" beside a belt opens Add for a belt, and "Add without a photo" starts as a belt
    await p.evaluate(()=>{show('today');if(!HOOK.listOpen)HOOK.toggleList()});await p.waitForTimeout(400);
    await p.evaluate(()=>document.querySelector('button.addone[aria-label^="Belt"]').click());await p.waitForTimeout(300);
    const af=await p.evaluate(()=>({add:!document.querySelector('#add').hidden,note:document.querySelector('#add-for').textContent,shown:!document.querySelector('#add-for').hidden}));
    ok(af.add&&af.shown&&/a belt/.test(af.note),`"Add one" beside Belt opens Add, which says a belt is being added (${JSON.stringify(af)})`);
    await p.evaluate(()=>HOOK.addManual());await p.waitForTimeout(300);
    const ty=await p.evaluate(()=>{const q=queue.find(x=>x.id===npsId);return q&&q.type});
    ok(ty==='belt',`its card without a photo starts as a belt (${ty})`);
    await p.evaluate(()=>{HOOK.npsClose();queue.splice(0,queue.length);show('today')});
    await p.evaluate(()=>openAdd());
    ok(await p.evaluate(()=>HOOK.addFor===null&&document.querySelector('#add-for').hidden),"Add from the Wardrobe's + asks for no type");
    // W2-14-10: the pieces list says what ⇄ and − do
    await p.evaluate(()=>show('today'));
    ok(await p.evaluate(()=>{const l=document.querySelector('#today .plegend');return !!l&&/choose another/.test(l.textContent)&&l.getAttribute('aria-hidden')==='true'}),'the open pieces list has a line saying what ⇄ and − do');

    // W2-14-05: the cleaning banner leads somewhere: a tap asks, "Cleaned today" starts the count again
    const cb=await p.evaluate(async()=>{const o=planFor()[key(sel)];const id=o.top.id;const real=cache.careW;cache.careW={[id]:6};renderToday();   /* (care.js careCounts answers from cache.careW) */
      const b=document.querySelector('#cband');const r={over:!!document.querySelector('.care-over'),role:b&&b.getAttribute('role')};b.querySelector('.ctxt').click();await new Promise(r=>setTimeout(r,100));
      r.ask=document.querySelector('#ask-sheet.on')?document.querySelector('#ask-ok').textContent:'';if(real)cache.careW=real;else delete cache.careW;askAnswer(false);return r});
    ok(cb.over&&cb.role==='button'&&cb.ask==='Cleaned today',`tapping the red "Overdue" banner asks, with "Cleaned today" (${JSON.stringify(cb)})`);

    // W2-14-14: a location set and no weather read: the line says so, with a retry
    await p.evaluate(()=>{settings.location={name:'Kuwait City',lat:29.37,lon:47.98};HOOK.weather={};renderToday()});
    ok(await p.evaluate(()=>!!document.querySelector('#today .wxretry')),'a location with no forecast read says so, with a way to try again');
    await p.evaluate(()=>{settings.location=null;renderToday()});

    // W2-14-13: the theme button's first tap changes what is on screen and says so
    const th=await p.evaluate(()=>{try{localStorage.removeItem('theme')}catch{}HOOK.applyTheme('auto');HOOK.cycleTheme();const r={t:document.documentElement.dataset.theme,msg:document.querySelector('#toast').textContent};HOOK.cycleTheme();r.t2=document.documentElement.dataset.theme;HOOK.cycleTheme();r.t3=document.documentElement.dataset.theme||'auto';return r});
    ok(th.t==='dark'&&/Dark theme/.test(th.msg)&&th.t2==='light'&&th.t3==='auto',`on a light phone the first tap goes dark, then light, then automatic (${JSON.stringify(th)})`);

    // W2-14-06 and W2-14-07: a double tap on the tour's Next moves one card; after the setup the first card says what comes
    await p.evaluate(()=>tourOpen(()=>{},'Add my first item'));await p.waitForTimeout(200);
    ok(await p.evaluate(()=>/First, four quick cards/.test(document.querySelector('#kitsheet').textContent)),'the tour opened by "Add my first item" says so on its first card');
    await p.dblclick('#kit-next');await p.waitForTimeout(200);
    ok(await p.evaluate(()=>kit&&kit.at===1),`a double tap on Next moves one card (card ${await p.evaluate(()=>kit&&kit.at+1)})`);
    await p.waitForTimeout(400);await p.click('#kit-next');await p.waitForTimeout(150);
    ok(await p.evaluate(()=>kit&&kit.at===2),'a tap after the pause moves on again');
    await p.evaluate(()=>kitClose());

    // W2-19-16 and W2-19-10: Settings' categories are headings; the day rows are named groups
    const sg=await p.evaluate(()=>{openSettings();const r={h:document.querySelectorAll('#settings-modal h3.scat-h > .scat-head').length,g:[...document.querySelectorAll('#cfg-workdays,#cfg-blazer')].map(e=>e.getAttribute('role')+':'+e.getAttribute('aria-label'))};closeSettings();return r});
    ok(sg.h>=8&&sg.g.join()==='group:Workdays,group:Blazer days',`Settings' categories are headings and the day rows named groups (${JSON.stringify(sg)})`);
    ok(!errs.length,'no page errors'+(errs.length?': '+errs.join(' | '):''));
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['a11yfix',a11yfix],['a11yround3',a11yround3]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
