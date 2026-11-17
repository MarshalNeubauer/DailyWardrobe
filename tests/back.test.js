// The phone's Back on Chromium (backgesture.test.js has both engines): layers, Settings coming back, questions, setup steps, text size.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const fs=require('fs'),path=require('path'),{holds}=require('./pace');

/* ---- was tests/subback.test.js ---- */
// The ‹ on a page opened from Settings (stats, packing, care) goes back to Settings as it was: the same categories open, scrolled the same,
// over the page that was under it, still scrolled where it was. Opened from Today (the care note's link), it goes back to Today. (The ‹
// always went to Today, out of Settings entirely.)
const subback=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10}});
    for(const [name,btn,page] of [['Packing list','#pack-btn','pack']]){   // (Laundry & cleaning is a fold of Settings since 2026-11-17)
      // the Wardrobe under Settings, scrolled; Settings with two categories open and scrolled to its end (the link tapped from there)
      await p.evaluate(()=>{show('wardrobe');document.querySelector('main').style.minHeight='3000px';scrollTo(0,300)});await settle(p,400);
      const before=await p.evaluate(btn=>{openSettings();setCatOpen('weather',true,true);setCatOpen('backup',true,true);const m=document.querySelector('#settings-modal');
        m.scrollTop=m.scrollHeight;return {top:m.scrollTop,y:scrollY}},btn);
      await p.evaluate(btn=>document.querySelector(btn).click(),btn);await p.waitForFunction(page=>!document.querySelector('#'+page).hidden&&!settingsOpen(),page);await settle(p,400);
      await p.click(`#${page} .pback`);await settle(p,300);
      const after=await p.evaluate(()=>{const m=document.querySelector('#settings-modal');return {open:settingsOpen(),cats:SET_CATS.filter(k=>document.querySelector('#sc-'+k).classList.contains('open')).join(),
        top:m.scrollTop,ward:!document.querySelector('#wardrobe').hidden,y:scrollY}});
      ok(before.top>100&&after.open&&after.cats==='weather,backup'&&Math.abs(after.top-before.top)<=2&&after.ward&&after.y===before.y,
        `${name}: ‹ goes back to Settings as it was (${after.cats} open, scrolled ${after.top} of ${before.top}px) over the Wardrobe (${after.y}px)`);
      await p.evaluate(()=>{closeSettings();document.querySelector('main').style.minHeight=''});
    }
    // Today's "See what is due" opens Settings with Laundry & cleaning unfolded; Back closes Settings, back on Today
    await p.evaluate(()=>{show('today');scrollTo(0,0);openCare()});await settle(p,300);
    ok(await p.evaluate(()=>settingsOpen()&&document.querySelector('#sc-laundry').classList.contains('open')),'opened from Today, Laundry & cleaning is unfolded in Settings');
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!settingsOpen(),null,{timeout:3000}).catch(()=>{});await settle(p,300);
    ok(await p.evaluate(()=>!settingsOpen()&&!document.querySelector('#today').hidden),'and the phone\'s Back closes Settings, back on Today');
    // left with the ‹ or a tab, the page's Back entry goes with it: the next Back doesn't bring the page or Settings back
    for(const how of ['pback','tab']){
      await p.evaluate(()=>{closeSettings();show('today');openSettings()});await settle(p,200);
      await p.evaluate(()=>document.querySelector('#pack-btn').click());await p.waitForFunction(()=>!document.querySelector('#pack').hidden);await settle(p,200);
      if(how==='pback')await p.click('#pack .pback');else await p.click('#n-stats');
      await settle(p,400);
      const st=await p.evaluate(()=>({state:history.state,pack:!document.querySelector('#pack').hidden,open:settingsOpen()}));
      ok(!st.pack&&(how==='pback'?st.open&&st.state&&st.state.app:!(st.state&&st.state.app)),how==='pback'?'left by the ‹, back in Settings: the one Back entry is Settings\' again':'left by a tab, the packing list\'s Back entry is gone with it');
    }
    // Settings: the phone's Back closes it, like Done (the page under it stays where it was); Done takes its Back entry away
    await p.evaluate(()=>{closeSettings();show('today')});await settle(p,300);
    await p.evaluate(()=>{show('wardrobe');document.querySelector('main').style.minHeight='3000px';scrollTo(0,250);openSettings()});await settle(p,300);
    const st1=await p.evaluate(()=>({state:history.state,open:settingsOpen()}));
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!settingsOpen(),null,{timeout:3000}).catch(()=>{});await settle(p,200);
    const cl=await p.evaluate(()=>({open:settingsOpen(),ward:!document.querySelector('#wardrobe').hidden,y:scrollY,lock:document.documentElement.classList.contains('set-lock')}));
    ok(st1.open&&st1.state&&st1.state.app==='set'&&!cl.open&&!cl.lock&&cl.ward&&cl.y===250,`the phone's Back closes Settings, leaving the Wardrobe where it was (${JSON.stringify(cl)})`);
    await p.evaluate(()=>openSettings());await settle(p,200);await p.click('#settings-modal .sdone');await settle(p,400);
    ok(await p.evaluate(()=>!settingsOpen()&&!(history.state&&history.state.app)),'closed by Done, Settings\' Back entry goes with it');
    // Settings → packing list → Back → Settings → Back → closed: one press a level
    await p.evaluate(()=>openSettings());await settle(p,200);await p.evaluate(()=>document.querySelector('#pack-btn').click());await settle(p,300);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>settingsOpen(),null,{timeout:3000}).catch(()=>{});await settle(p,300);
    const lv1=await p.evaluate(()=>({open:settingsOpen(),stats:!document.querySelector('#pack').hidden}));
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!settingsOpen(),null,{timeout:3000}).catch(()=>{});await settle(p,300);
    const lv2=await p.evaluate(()=>({open:settingsOpen(),ward:!document.querySelector('#wardrobe').hidden}));
    ok(lv1.open&&!lv1.stats&&!lv2.open&&lv2.ward,`Back from the packing list opens Settings again, and the next Back closes it (${JSON.stringify([lv1,lv2])})`);
    // and the ‹ hands the entry back to Settings: Back then closes Settings at once
    await p.evaluate(()=>openSettings());await settle(p,200);await p.evaluate(()=>document.querySelector('#pack-btn').click());await settle(p,300);
    await p.click('#pack .pback');await settle(p,400);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!settingsOpen(),null,{timeout:3000}).catch(()=>{});await settle(p,300);
    ok(await p.evaluate(()=>!settingsOpen()&&document.querySelector('#pack').hidden),'after the packing list\'s ‹ back to Settings, one Back closes Settings');
    await p.evaluate(()=>{document.querySelector('main').style.minHeight=''});
    // left for the Wardrobe and an item opened at once: the step back that drops the page's entry doesn't shut the item; its own Back does
    await p.evaluate(()=>{closeSettings();show('today');openPack()});await settle(p,200);
    await p.evaluate(()=>{flt='all';show('wardrobe');openItem(items[0].id)});await settle(p,600);
    const it=await p.evaluate(()=>({open:!!editing,state:history.state}));
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!editing,null,{timeout:3000}).catch(()=>{});
    ok(it.open&&it.state&&it.state.item===1&&await p.evaluate(()=>!editing),`an item opened right after leaving the packing list stays open with its own Back entry, and Back shuts it (${JSON.stringify(it)})`);
    // Add is a page of the Wardrobe: + Add opens it, its ‹ (or the phone's Back) goes back to the Wardrobe where it was
    await p.evaluate(()=>{show('wardrobe');document.querySelector('main').style.minHeight='3000px';scrollTo(0,0)});await settle(p,300);
    await p.click('#ward-add');await settle(p,400);
    const ad=await p.evaluate(()=>({add:!document.querySelector('#add').hidden,back:!!document.querySelector('#add .pback'),state:history.state}));
    await p.click('#add .pback');await settle(p,400);
    ok(ad.add&&ad.back&&ad.state&&ad.state.app&&await p.evaluate(()=>!document.querySelector('#wardrobe').hidden&&document.querySelector('#add').hidden),'Wardrobe → + Add opens the Add page; its ‹ goes back to the Wardrobe');
    await p.click('#ward-add');await settle(p,300);await p.evaluate(()=>history.back());await p.waitForFunction(()=>!document.querySelector('#wardrobe').hidden,null,{timeout:3000}).catch(()=>{});
    ok(await p.evaluate(()=>!document.querySelector('#wardrobe').hidden&&document.querySelector('#add').hidden),'and the phone\'s Back does the same');
    await p.evaluate(()=>{document.querySelector('main').style.minHeight=''});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/nufix9.test.js ---- */
// Fix round 2 after the re-audit (2026-11-15), Fixer 9: the phone's Back closes a question as Cancel and leaves the page under it
// (Settings, the item sheet) open, also with nothing under it; Back closes the tour, the Home Screen sheet and the import sheet (which
// leaves Add open) instead of leaving the app (start.js appBorrow/appGiveBack, kinds 'ask' and 'kit'); the second tap of a double tap
// doesn't cancel the question it opened; the Wardrobe box reads its Sample tag out; the largest text with page zoom keeps the tab names
// apart and the item sheet's title and values whole; a long name in a toast leaves its Undo on screen; Advanced wording.
const nufix9=async({ok,chromium,url,WARDROBES,settle})=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  ok(!/realistic photos/.test(html),'Settings → Connection → Advanced no longer says the server makes the realistic photos');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const inApp=()=>p.evaluate(()=>!!window.appReady&&location.href).catch(()=>false);
    const back=async()=>{await p.goBack({timeout:3000}).catch(()=>{});await settle(p,300)};
    const st=()=>p.evaluate(()=>history.state&&history.state.app||'');
    const ask=(q='Remove it?')=>p.evaluate(q=>{window._ans=undefined;askConfirm(q,{ok:'Remove',danger:true}).then(v=>{window._ans=v})},q);
    const asked=()=>p.evaluate(()=>!!document.querySelector('#ask-sheet.on'));
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic.map(i=>({...i}));settings.workdays=[0,1,2,3,4];settings.setupDone=1;TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')})()`);await settle(p,300);
    // ---- a question with nothing under it: its own entry
    await ask();await settle(p,200);
    ok(await st()==='ask','a question over Today takes a Back entry');
    await back();
    ok(await inApp()===url&&!await asked()&&await p.evaluate(()=>window._ans===false),'Back closes the question as Cancel and stays in the app (it left the app)');
    await ask();await settle(p,200);await p.click('#ask-cancel');await settle(p,300);
    ok(await st()===''&&await p.evaluate(()=>window._ans===false),'Cancel takes the question’s entry away');
    // answered yes, and the answer opens Settings: Settings gets its entry once the question's step back has landed
    await p.evaluate(()=>{askConfirm('Open it?').then(v=>{if(v)openSettings('about')})});await settle(p,200);await p.click('#ask-ok');await settle(p,400);
    ok(await st()==='set'&&await p.evaluate(()=>settingsOpen()),'a yes that opens Settings: Settings has the Back entry');
    // ---- a question over Settings borrows Settings' entry
    await ask('Roll back to Sun, Nov 15?');await settle(p,200);
    ok(await st()==='set'&&await p.evaluate(()=>appKind==='ask'),'a question over Settings borrows its entry (no second one)');
    await back();
    ok(await inApp()===url&&!await asked()&&await p.evaluate(()=>window._ans===false&&settingsOpen()),'Back over Settings closes the question as Cancel; Settings stays open (it closed Settings and left the question up)');
    ok(await st()==='set','…and Settings has its Back entry again');
    await back();
    ok(await inApp()===url&&await p.evaluate(()=>!settingsOpen()),'the next Back closes Settings, in the app');
    await p.evaluate(()=>openSettings('schedule'));await settle(p,300);await ask();await settle(p,200);await p.click('#ask-cancel');await settle(p,300);
    ok(await st()==='set'&&await p.evaluate(()=>appKind==='set'&&settingsOpen()),'Cancel over Settings hands the entry back to Settings');
    await back();ok(await p.evaluate(()=>!settingsOpen())&&await inApp()===url,'…and Back then closes Settings');
    // (Back over the item sheet, over the color sheet over it, the tour, Add to Home Screen from Settings and the import sheet over Add
    // are checked on Chromium and WebKit in tests/backgesture.test.js: layer() and the nested steps; their copies here went, CR-10-14 / v4)
    // ---- the double tap's second tap doesn't cancel; a later tap outside does
    await p.evaluate(()=>show('today'));await settle(p,300);
    await ask();await p.mouse.click(195,120);await settle(p,100);
    ok(await asked(),'a tap outside the question right after it opened (a double tap’s second tap) leaves it open (it cancelled it)');
    await p.waitForTimeout(600);await p.mouse.click(195,120);await settle(p,300);
    ok(!await asked()&&await p.evaluate(()=>window._ans===false),'a tap outside half a second later still cancels it');
    // ---- the tour from Settings
    await p.evaluate(()=>openSettings('about'));await settle(p,300);await p.evaluate(()=>tourAgain());await settle(p,400);
    ok(await st()==='kit'&&await p.evaluate(()=>!!kit&&!settingsOpen()),'Take the tour from Settings: the tour has the entry');
    await back();
    ok(await inApp()===url&&await p.evaluate(()=>!kit&&settingsOpen()&&appKind==='set')&&await st()==='set','Back on it goes back to Settings → About, with Settings’ entry');
    await back();ok(await p.evaluate(()=>!settingsOpen()),'…and Back again closes Settings');
    await p.evaluate(()=>closeSettings());await settle(p,300);
    // ---- the Sample tag in the box's name
    await p.evaluate(()=>{items[0].sample=1;show('wardrobe')});await settle(p,300);
    const lab=await p.evaluate(()=>document.querySelector('#gi-'+items[0].id+' .giopen').getAttribute('aria-label'));
    ok(/, Sample$/.test(lab),`a sample piece’s box says so in its name (${lab})`);
    await p.evaluate(()=>{delete items[0].sample;items[1].paused=true;show('wardrobe')});await settle(p,300);
    ok(/, Out of rotation$/.test(await p.evaluate(()=>document.querySelector('#gi-'+items[1].id+' .giopen').getAttribute('aria-label'))),'…and so does one out of rotation');
    await p.evaluate(()=>{delete items[1].paused});
    // ---- the largest text with page zoom (150% text, 150% zoom: 268 px)
    await p.setViewportSize({width:268,height:454});await p.evaluate(()=>{document.documentElement.style.setProperty('--tscale','1.5');show('today')});await settle(p,400);
    const nav=await p.evaluate(()=>[...document.querySelectorAll('nav button')].map(b=>{const r=document.createRange();r.selectNodeContents(b);const t=r.getBoundingClientRect(),o=b.getBoundingClientRect();return t.left>=o.left-1&&t.right<=o.right+1&&b.scrollWidth<=b.clientWidth+1}));
    ok(nav.length===3&&nav.every(Boolean),'150% text at 268 px: each tab name fits its own button (they ran together)');
    // (each read once the layout holds it, within 4 s: after the zoom the sizes settle a moment later on a busy machine, CR-10-03)
    ok(await holds(p,()=>{const h=document.querySelector('header h1');return h.scrollWidth<=h.clientWidth+1}),'…the header title isn’t cut');
    ok(await p.evaluate(()=>[...document.querySelectorAll('#today .score .lbl b,#today .mltxt b')].every(b=>b.scrollWidth<=b.clientWidth+1)),'…nor the cards’ titles ("7 p…")');
    await p.evaluate(()=>{show('wardrobe');const it=items.find(i=>i.type==='suit');it.name='Mid grey herringbone';openItem(it.id)});await settle(p,500);
    await holds(p,()=>{const h=document.querySelector('#iv-title');return !!h&&h.scrollWidth<=h.clientWidth+1&&h.scrollHeight<=h.clientHeight+2});
    const iv=await p.evaluate(()=>{const h=document.querySelector('#iv-title'),c=[...document.querySelectorAll('#item-view .colnm')];return {t:h.scrollWidth<=h.clientWidth+1&&h.scrollHeight<=h.clientHeight+2,c:c.length>0&&c.every(x=>x.scrollWidth<=x.clientWidth+1)}});
    ok(iv.t,'…the item sheet’s title wraps instead of "Mid grey h…"');
    ok(iv.c,'…and its colour and pattern values aren’t cut ("Mid …")');
    await p.evaluate(()=>{closeItem();document.documentElement.style.removeProperty('--tscale')});await settle(p,300);
    // ---- a toast with a long unbroken name
    await p.setViewportSize({width:402,height:874});await settle(p,200);
    const tb=await p.evaluate(()=>{show('today');toast('Deleted 🦚🦚🦚🦚🦚 '+'x'.repeat(60)+'.',8000,{label:'Undo',fn:()=>{}});const b=document.querySelector('#toast button').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth});
    ok(tb,'a long unbroken name in a toast wraps and its Undo stays on the screen (half was off the edge)');
    ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
  }finally{await browser.close()}
};

/* ---- was tests/backzoom.test.js ---- */
// New-user audit 2026-11-14 (layout, gestures, accessibility): the phone's Back steps back through the setup and closes the piece
// picker and What to buy instead of leaving the app (one history entry, start.js appPush 'setup'/'pick'/'shop'), also after setup
// ends on Add, and not while the address still holds an invitation; text is in rem and follows --tscale (iPhone Larger Text) with
// the default look kept; narrow screens (page zoom) keep Today's piece names, Settings' day names and the item sheet's values
// readable; 44px tap targets for the header, links and a toast's Undo, which stays 8 s; the drawn gear; dark checklist rings;
// the picker on a phone on its side.
const backzoom=async({ok,chromium,url,WARDROBES,settle})=>{
  const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const pxText=[];css.replace(/([^{}]*)\{([^{}]*)\}/g,(m,sel,body)=>{if(!/(^|[;\s])fill:/.test(body)&&/(font-size:\s*[\d.]+px|(^|[;\s])font:[^;]*?\b[\d.]+px)/.test(body))pxText.push(sel.trim().slice(-40));return m});
  ok(pxText.length===0,'styles.css sizes text in rem (only SVG labels keep px)'+(pxText.length?': '+pxText.slice(0,4).join(' | '):''));
  ok(/-apple-system-body/.test(html)&&/--tscale/.test(html)&&/html\{font-size:calc\(var\(--tscale,1\) \* 100%\)\}/.test(css),'the root text size follows the iPhone text size (index.html) as a ratio, 1 by default');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    const app=()=>p.evaluate(()=>!!window.appReady&&location.href);
    const back=async()=>{await p.goBack({timeout:3000}).catch(()=>{});await settle(p,300)};
    const stateApp=()=>p.evaluate(()=>history.state&&history.state.app||'');
    // ---- the setup
    await p.evaluate(()=>{items=[];delete settings.setupDone;setupOpen(false)});await settle(p,300);
    await p.evaluate(()=>{setupGo(1);setupGo(1)});await settle(p,200);
    ok(await stateApp()==='setup','the setup has a Back entry');
    await back();
    ok(await app()===url&&await p.evaluate(()=>setupShown()&&setup.at===1),'Back in the setup goes to the step before, in the app');
    await back();await back();
    ok(await app()===url&&await p.evaluate(()=>setupShown()&&setup.at===0),'Back on the first step leaves the setup open, in the app');
    await p.evaluate(()=>setupFinish(false));await settle(p,300);
    ok(await stateApp()===''&&await p.evaluate(()=>!setupShown()),'Skip takes the setup’s entry away');
    // Run setup again from Settings: Settings' entry goes first, the setup's comes once that step back has landed
    await p.evaluate(()=>openSettings('about'));await settle(p,300);
    await p.evaluate(()=>setupOpen(true));await settle(p,400);
    ok(await stateApp()==='setup','Run setup again from Settings: the setup gets its entry after Settings’ step back');
    // finishing on Add: Add's entry waits for the setup's step back, then Back goes to the Wardrobe
    await p.evaluate(()=>{setup.at=SETUP_STEPS.length-1;setupFinish(true)});await settle(p,500);
    ok(await stateApp()==='sub'&&await p.evaluate(()=>!document.querySelector('#add').hidden),'setup finished on Add: Add has the Back entry');
    await back();
    ok(await app()===url&&await p.evaluate(()=>document.querySelector('#add').hidden),'Back on Add (from the setup) stays in the app');
    // an invitation in the address: the entry waits until it is dropped
    await p.evaluate(()=>{history.replaceState(null,'',location.pathname+'#invite=abcdefghijklmnopqrstuvwxyz&w=x');setupOpen(false)});await settle(p,200);
    ok(await stateApp()==='','no entry while the address holds an invitation (Back would land on it again)');
    await p.evaluate(()=>dropInviteHash());await settle(p,200);
    ok(await stateApp()==='setup'&&await p.evaluate(()=>!location.hash),'the entry is made once the invitation leaves the address');
    await p.evaluate(()=>setupFinish(false));await settle(p,300);
    // ---- the picker and What to buy
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[0,1,2,3,4];settings.setupDone=1;TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')})()`);await settle(p,300);
    await p.evaluate(()=>openPicker('shirt'));await settle(p,300);
    ok(await stateApp()==='pick','the picker has a Back entry');
    await back();
    ok(await app()===url&&await p.evaluate(()=>!picker&&!document.querySelector('#pick-sheet.on')),'Back closes the picker, in the app');
    await p.evaluate(()=>openPicker('shirt'));await settle(p,300);await p.evaluate(()=>closePicker());await settle(p,300);
    ok(await stateApp()==='','closing the picker with × takes its entry away');
    await p.evaluate(()=>{show('stats');window.shopGate=()=>[];window.analyzeWardrobe=()=>{};openShop()});await settle(p,300);
    ok(await stateApp()==='shop','What to buy has a Back entry');
    await back();
    ok(await app()===url&&await p.evaluate(()=>!shopOpen),'Back closes What to buy, in the app');
    // ---- text size: rem, following --tscale
    await p.evaluate(()=>show('today'));await settle(p,200);
    const fsz=()=>p.evaluate(()=>[getComputedStyle(document.body).fontSize,getComputedStyle(document.querySelector('nav button')).fontSize,getComputedStyle(document.querySelector('header h1')).fontSize]);
    ok(JSON.stringify(await fsz())==='["16px","17px","21px"]','default text sizes (16, 17, 21 px; the tab labels 17 px since 2026-11-15, the owner found 15 hard to read)');
    await p.evaluate(()=>document.documentElement.style.setProperty('--tscale','1.5'));
    ok(JSON.stringify(await fsz())==='["24px","25.5px","31.5px"]','with Larger Text at 150% every text grows by half');
    ok(await p.evaluate(()=>{const h=document.querySelector('header');return h.getBoundingClientRect().height<80&&document.documentElement.scrollWidth<=innerWidth}),'at 150% the header stays one line and nothing scrolls sideways');
    await p.evaluate(()=>document.documentElement.style.removeProperty('--tscale'));
    // ---- tap targets and the gear
    const hit=()=>p.evaluate(()=>[...document.querySelectorAll('header .hbtns button:not([hidden])')].map(b=>{const r=b.getBoundingClientRect(),x=r.left+r.width/2;
      return {h:r.height,top:document.elementFromPoint(x,r.top-1.5)?.closest('button')===b,bot:document.elementFromPoint(x,r.bottom+1.5)?.closest('button')===b}}));
    const hs=await hit();ok(hs.length>=2&&hs.every(h=>h.top&&h.bot),'the header’s buttons take taps 2px past their 40px box (44px)');
    ok(await p.evaluate(()=>{const b=document.querySelector('header button[aria-label="Settings"]');return !!b.querySelector('svg.hgear')&&!/⚙/.test(b.textContent)}),'the gear is drawn, not the ⚙ emoji');
    const tm=await p.evaluate(()=>{const was=window.setTimeout;let ms=0;window.setTimeout=(f,t)=>{ms=Math.max(ms,t||0);return was(f,t)};toast('Deleted it',5000,{label:'Undo',fn:()=>{}});window.setTimeout=was;
      const b=document.querySelector('#toast button'),r=b.getBoundingClientRect(),x=r.left+r.width/2;return {ms,top:document.elementFromPoint(x,r.top-7)===b,bot:document.elementFromPoint(x,r.bottom+7)===b,h:r.height}});
    ok(tm.ms>=8000,'a toast with Undo stays at least 8 s (asked for 5)');
    ok(tm.top&&tm.bot&&tm.h+16>=44,'a toast’s Undo takes taps over 44px');
    // ---- the empty checklist: rings in the dark theme, link tap height
    await p.evaluate(()=>{items=[];cache={};document.documentElement.dataset.theme='dark';show('today')});await settle(p,300);
    const ring=await p.evaluate(()=>{const t=document.querySelector('.fr-it:not(.done) .fr-tick');if(!t)return null;const c=getComputedStyle(t).borderTopColor;
      let e=t.parentElement,bg='';while(e){bg=getComputedStyle(e).backgroundColor;if(!/rgba\(0, 0, 0, 0\)|transparent/.test(bg))break;e=e.parentElement}
      const lum=s=>{const v=s.match(/[\d.]+/g).slice(0,3).map(n=>{n/=255;return n<=.03928?n/12.92:((n+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
      const a=lum(c),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
    ok(ring&&ring>=3,'dark theme: the checklist’s empty rings stand out from the card (3:1 or more, was about 1.3)');
    const lk=await p.evaluate(()=>{const b=[...document.querySelectorAll('#today .linkbtn')].find(x=>x.offsetParent);if(!b)return null;const r=b.getBoundingClientRect(),x=r.left+r.width/2;return document.elementFromPoint(x,r.top-8)===b&&document.elementFromPoint(x,r.bottom+8)===b});
    ok(lk,'a text link takes taps 9px above and below (44px)');
    await p.evaluate(()=>{document.documentElement.dataset.theme='light'});
    // ---- narrow screens (Safari page zoom 150% on this phone = 268 CSS px)
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;cache={};show('today');if(!document.querySelector('#ibox.open'))toggleList()})()`);await settle(p,400);
    const rows=()=>p.evaluate(()=>[...document.querySelectorAll('#today .rowtap')].map(t=>{const n=t.lastElementChild,l=t.parentElement.firstElementChild;return {w:n.getBoundingClientRect().width,stacked:l.getBoundingClientRect().bottom<=t.getBoundingClientRect().top+1}}));
    let r=await rows();ok(r.length>2&&r.every(x=>!x.stacked),'390 px: each piece’s slot name beside it, as before');
    await p.setViewportSize({width:268,height:454});await settle(p,300);
    // (once the narrow layout holds, within 4 s: on a busy machine the rows were read before it settled, CR-10-03)
    await holds(p,()=>{const t=[...document.querySelectorAll('#today .rowtap')];return t.length>2&&t.every(t=>{const n=t.lastElementChild,l=t.parentElement.firstElementChild;return n.getBoundingClientRect().width>=60&&l.getBoundingClientRect().bottom<=t.getBoundingClientRect().top+1})});
    r=await rows();ok(r.length>2&&r.every(x=>x.w>=60&&x.stacked),'268 px (150% zoom): the slot name goes above, piece names keep 60px or more (were 2px)');
    await p.evaluate(()=>{openSettings('schedule')});await settle(p,400);
    const days=await p.evaluate(()=>{const b=[...document.querySelectorAll('#cfg-workdays .dtog')];return {rows:new Set(b.map(x=>Math.round(x.getBoundingClientRect().top))).size,fit:b.every(x=>x.scrollWidth<=x.clientWidth+1)}});
    ok(days.rows===2&&days.fit,'268 px: the workday buttons go on two rows and every name fits ("Mon" was cut)');
    await p.evaluate(()=>closeSettings());await settle(p,300);
    await p.evaluate(()=>{show('wardrobe');openItem(items.find(i=>i.type==='suit').id)});await settle(p,500);
    const cb=await p.evaluate(()=>{const b=document.querySelector('#item-view .colbtn');return b?b.getBoundingClientRect().width:0});
    ok(cb>=135,'268 px: the item sheet’s colour field keeps 8.5rem for its value (was about 118px, "N…")');
    await p.evaluate(()=>closeItem());await settle(p,300);
    await p.setViewportSize({width:390,height:844});await settle(p,300);
    await p.evaluate(()=>{openSettings('schedule')});await settle(p,400);
    ok(await p.evaluate(()=>new Set([...document.querySelectorAll('#cfg-workdays .dtog')].map(x=>Math.round(x.getBoundingClientRect().top))).size===1),'390 px: the seven workday buttons stay on one row');
    await p.evaluate(()=>closeSettings());await settle(p,300);
    // ---- a phone on its side: the picker shows a whole row of pieces
    await p.setViewportSize({width:874,height:402});await p.evaluate(()=>show('today'));await settle(p,300);
    await p.evaluate(()=>openPicker('shirt'));await settle(p,500);
    const land=await p.evaluate(()=>{const s=document.querySelector('#pick-sheet'),t=s.querySelector('.pick-it');return {cols:getComputedStyle(s.querySelector('.pick-grid')).gridTemplateColumns.split(' ').length,bottom:t.getBoundingClientRect().bottom,h:innerHeight}});
    ok(land.cols===6&&land.bottom<=land.h,'landscape: the picker shows six across and the first row fits whole on screen');
    await p.evaluate(()=>closePicker());
    ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['subback',subback],['nufix9',nufix9],['backzoom',backzoom]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
