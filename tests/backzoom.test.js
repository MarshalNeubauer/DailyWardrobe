// New-user audit 2026-11-14 (layout, gestures, accessibility): the phone's Back steps back through the setup and closes the piece
// picker and What to buy instead of leaving the app (one history entry, start.js appPush 'setup'/'pick'/'shop'), also after setup
// ends on Add, and not while the address still holds an invitation; text is in rem and follows --tscale (iPhone Larger Text) with
// the default look kept; narrow screens (page zoom) keep Today's piece names, Settings' day names and the item sheet's values
// readable; 44px tap targets for the header, links and a toast's Undo, which stays 8 s; the drawn gear; dark checklist rings;
// the picker on a phone on its side.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const pxText=[];css.replace(/([^{}]*)\{([^{}]*)\}/g,(m,sel,body)=>{if(!/(^|[;\s])fill:/.test(body)&&/(font-size:\s*[\d.]+px|(^|[;\s])font:[^;]*?\b[\d.]+px)/.test(body))pxText.push(sel.trim().slice(-40));return m});
  ok(pxText.length===0,'styles.css sizes text in rem (only SVG labels keep px)'+(pxText.length?': '+pxText.slice(0,4).join(' | '):''));
  ok(/-apple-system-body/.test(html)&&/--tscale/.test(html)&&/html\{font-size:calc\(var\(--tscale,1\) \* 100%\)\}/.test(css),'the root text size follows the iPhone text size (index.html) as a ratio, 1 by default');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
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
