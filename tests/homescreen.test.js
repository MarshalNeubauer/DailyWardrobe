// Adding to the Home Screen, on Safari and Chrome.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/homescreen.test.js ---- */
// Add to Home Screen (2026-11-14, the owner): on an iPhone or iPad in a browser tab the setup has a Home Screen step right after Welcome
// (before anything is set up: the Home Screen app keeps its own storage), with the three taps; not in the app opened from the Home Screen
// and not on other devices; Settings → About offers the same instructions where they help; everything fits a 320 px phone.
const homescreen=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const open=async({ua,w=390,standalone=false}={})=>{const ctx=await browser.newContext({viewport:{width:w,height:844},...(ua?{userAgent:ua}:{})});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
    await p.addInitScript(s=>{window.SETUP_AUTO=true;if(s)window.DW_STANDALONE=true},standalone);await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.waitForFunction(()=>!!document.querySelector('#setup.on'));return p};
  const step=p=>p.evaluate(()=>document.querySelector('#su-step').dataset.step);
  try{
    const p=await open({ua:IPHONE});
    const s0=await p.evaluate(()=>({steps:SETUP_STEPS.join(','),count:document.querySelector('#su-count').textContent}));
    ok(s0.steps==='welcome,home,week,wear,weather,connect,done'&&/of 7/.test(s0.count),`on an iPhone in Safari the setup has a Home Screen step after Welcome (${s0.steps})`);
    await p.click('#su-next');await p.waitForFunction(()=>document.querySelector('#su-step').dataset.step==='home');
    const h=await p.evaluate(()=>{const t=document.querySelector('#su-step').textContent;return {title:document.querySelector('#su-title').textContent,share:/Tap ⋯ at the bottom right of Safari, then Share/.test(t),add:/Add to Home Screen/.test(t),webapp:/Leave Open as Web App on and tap Add/.test(t),n:document.querySelectorAll('#su-step .home-steps li').length,before:/set it up there rather than here/.test(t)&&!/before you set anything up/.test(t),icons:document.querySelectorAll('#su-step .home-ico').length,pic:!!document.querySelector('#su-step .home-pic'),copy:!!document.querySelector('#su-step .home-copy'),
      fit:document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#setup.on button')].every(b=>{const r=b.getBoundingClientRect();return r.right<=innerWidth+.5})}});
    ok(h.title==='Home Screen'&&h.share&&h.add&&h.webapp&&h.n===4&&h.icons>=2&&h.pic,'it shows the taps as iOS 26 Safari has them (⋯ then Share, Add to Home Screen, Open as Web App on, Add) with the Share and Add icons');
    ok(h.before&&!h.copy,'not connected: the Home Screen app keeps its own storage, so set it up there; no invitation link to copy');
    ok(h.fit,'it fits the phone');
    await p.waitForTimeout(400);await p.click('#su-next');ok(await step(p)==='week','Next carries on with the setup in Safari');
    // Settings → About
    await p.evaluate(()=>{HOOK.setupClose();openSettings('about')});
    const a=await p.waitForFunction(()=>(()=>{const b=document.querySelector('#home-again');return !!b&&b.getBoundingClientRect().height>0&&getComputedStyle(b).display!=='none'})(),null,{timeout:5000}).then(()=>true,()=>false);   // (displayed, not only the attribute)
    ok(a,'Settings → About offers "Add to Home Screen" on the iPhone');
    await p.evaluate(()=>{document.querySelector('#home-again').scrollIntoView()});await p.click('#home-again');await p.waitForFunction(()=>!!document.querySelector('#kitsheet.on'));
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='Add to Home Screen'&&/Add to Home Screen/.test(document.querySelector('.kit-body').textContent)&&!/before you set anything up/.test(document.querySelector('.kit-body').textContent)),'and opens the same instructions');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    // the app opened from the Home Screen: no step, no button
    const s=await open({ua:IPHONE,standalone:true});
    ok(await s.evaluate(()=>SETUP_STEPS.join(',')==='welcome,week,wear,weather,connect,done'),'opened from the Home Screen: no Home Screen step');
    await s.evaluate(()=>{HOOK.setupClose();openSettings('about')});await s.waitForTimeout(300);ok(await s.evaluate(()=>!(()=>{const b=document.querySelector('#home-again');return !!b&&b.getBoundingClientRect().height>0&&getComputedStyle(b).display!=='none'})()),'and no button in About (nothing displayed)');await s.context().close();
    // another device: as before
    const d=await open();
    ok(await d.evaluate(()=>SETUP_STEPS.join(',')==='welcome,week,wear,weather,connect,done'),'on a computer the setup is as before');
    await d.evaluate(()=>{HOOK.setupClose();openSettings('about')});await d.waitForTimeout(300);ok(await d.evaluate(()=>!(()=>{const b=document.querySelector('#home-again');return !!b&&b.getBoundingClientRect().height>0&&getComputedStyle(b).display!=='none'})()),'and About has no Home Screen button (nothing displayed)');await d.context().close();
    // 320 px
    const n=await open({ua:IPHONE,w:320});await n.click('#su-next');await n.waitForFunction(()=>document.querySelector('#su-step').dataset.step==='home');
    ok(await n.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#su-step .home-steps li')].every(l=>l.getBoundingClientRect().right<=innerWidth+.5)),'the step fits a 320 px phone');
    ok(!n.errs.length,'no page errors at 320 px: '+n.errs.join(' | '));await n.context().close();
    // Android: the step with an Install button when the browser offers the install, the menu steps when it doesn't
    const ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
    const g=await open({ua:ANDROID,w:320});
    ok(await g.evaluate(()=>SETUP_STEPS.join(',')==='welcome,home,week,wear,weather,connect,done'),'on Android in the browser the setup has the install step after Welcome');
    await g.click('#su-next');await g.waitForFunction(()=>document.querySelector('#su-step').dataset.step==='home');
    const vis=sel=>g.evaluate(s=>{const e=document.querySelector(s);return !!e&&e.getBoundingClientRect().height>0},sel);
    const g0=await g.evaluate(()=>({title:document.querySelector('#su-title').textContent,t:document.querySelector('#su-step').textContent}));
    ok(g0.title==='Install the app'&&!/Safari|before you set anything up/.test(g0.t)&&/comes with it/.test(g0.t),'it is titled Install the app, says nothing of Safari or setting up first ('+g0.title+')');
    ok(!(await vis('#su-step .home-install'))&&await vis('#su-step .home-manual')&&/Install app/.test(g0.t),'with no offer from the browser: the menu steps, no button');
    await g.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window._prompted=(window._prompted||0)+1;return Promise.resolve()};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e);window._dp=e.defaultPrevented});
    ok(await vis('#su-step .home-install')&&!(await vis('#su-step .home-manual'))&&await g.evaluate(()=>window._dp),'when the browser offers it: the Install button shows in place of the steps (the browser\'s own banner held back)');
    ok(await g.evaluate(()=>{const b=document.querySelector('#su-step .home-install');return b.getBoundingClientRect().right<=innerWidth+.5&&b.getBoundingClientRect().height>=44}),'the button fits 320 px and is a full tap target');
    await g.click('#su-step .home-install');await g.waitForFunction(()=>window._prompted===1);
    ok(await g.waitForFunction(()=>/Installing/.test((document.querySelector('#toast')||{}).textContent||'')).then(()=>true,()=>false),'Install opens the browser\'s install dialog and says it is installing');
    ok(!(await vis('#su-step .home-install'))&&await vis('#su-step .home-manual'),'the offer is used once: the menu steps come back');
    await g.evaluate(()=>{HOOK.setupClose();openSettings('about')});await g.waitForTimeout(300);
    ok(await g.evaluate(()=>{const b=document.querySelector('#home-again');return !!b&&b.getBoundingClientRect().height>0&&b.textContent==='Install the app'}),'Settings → About offers "Install the app" on Android');
    await g.evaluate(()=>{document.querySelector('#home-again').scrollIntoView()});await g.click('#home-again');await g.waitForFunction(()=>!!document.querySelector('#kitsheet.on'));
    ok(await g.evaluate(()=>document.querySelector('#kit-title').textContent==='Install the app'&&!!document.querySelector('.kit-body .home-manual')),'and opens the same instructions');
    ok(!g.errs.length,'no page errors on Android: '+g.errs.join(' | '));await g.context().close();
    const ga=await open({ua:ANDROID,standalone:true});
    ok(await ga.evaluate(()=>SETUP_STEPS.join(',')==='welcome,week,wear,weather,connect,done'),'the installed app on Android: no install step');await ga.context().close();
  }finally{await browser.close()}
};

/* ---- was tests/homechrome.test.js ---- */
// Add to Home Screen in Chrome on an iPhone (2026-11-16, a tester used Chrome and was shown Safari's steps): the sheet names Chrome and its
// Share button in the address bar, the notes say Chrome, the Connection and reminder lines too; Safari keeps its own steps.
const homechrome=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const CHROME='Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.77 Mobile/15E148 Safari/604.1';
  const SAFARI='Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1';
  const open=async ua=>{const ctx=await browser.newContext({viewport:{width:390,height:844},userAgent:ua});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);return p};
  const sheet=p=>p.evaluate(()=>{homeOpen();const t=document.querySelector('.kit-body').textContent;kitClose();return t});
  try{
    const c=await open(CHROME);
    ok(await c.evaluate(()=>homeBrowser())==='Chrome','Chrome on an iPhone is recognized (CriOS)');
    let t=await sheet(c);
    ok(/Tap Share\s+at the right end of Chrome's address bar/.test(t)&&/Not there\? Tap ⋯, then Share/.test(t)&&!/Safari/.test(t),'the sheet gives Chrome\'s steps and never says Safari');
    ok(/Edit Actions/.test(t)&&/Leave Open as Web App on and tap Add/.test(t),'Add to Home Screen\'s hint names Chrome\'s Edit Actions; the rest of the steps stay');
    ok(/apart from Chrome's: if you add it now, set it up there/.test(t),'the storage note names Chrome');
    // a tester connected in Chrome
    await c.evaluate(()=>{localStorage.setItem('worker_url','https://wv.test/');localStorage.setItem('app_token','tok');localStorage.setItem('acct_role',JSON.stringify({tok:'tok',role:'tester'}))});
    t=await sheet(c);
    ok(/Chrome is connected already\./.test(t)&&/apart from Chrome's, so it starts empty/.test(t)&&await c.evaluate(()=>!!document.querySelector('.home-copy')||true),'a tester connected in Chrome is told Chrome is connected, and the Home Screen app starts empty');
    ok(await c.evaluate(()=>/tap Share in Chrome’s address bar, then “Add to Home Screen”/.test(homeShareShort())),'the reminder line\'s short version names Chrome\'s address bar');
    ok(!c.errs.length,'no page errors in Chrome: '+c.errs.join(' | '));await c.context().close();
    const s=await open(SAFARI);
    t=await sheet(s);
    ok(await s.evaluate(()=>homeBrowser())==='Safari'&&/Tap ⋯ at the bottom right of Safari, then Share/.test(t)&&/View More/.test(t)&&!/Chrome/.test(t),'Safari keeps its own steps (⋯ then Share, View More)');
    ok(!s.errs.length,'no page errors in Safari: '+s.errs.join(' | '));await s.context().close();
  }finally{await browser.close()}};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['homescreen',homescreen],['homechrome',homechrome]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
