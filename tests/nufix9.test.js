// Fix round 2 after the re-audit (2026-11-15), Fixer 9: the phone's Back closes a question as Cancel and leaves the page under it
// (Settings, the item sheet) open, also with nothing under it; Back closes the tour, the Home Screen sheet and the import sheet (which
// leaves Add open) instead of leaving the app (start.js appBorrow/appGiveBack, kinds 'ask' and 'kit'); the second tap of a double tap
// doesn't cancel the question it opened; the Wardrobe box reads its Sample tag out; the largest text with page zoom keeps the tab names
// apart and the item sheet's title and values whole; a long name in a toast leaves its Undo on screen; Advanced wording.
const fs=require('fs'),path=require('path'),{holds}=require('./pace');
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
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
