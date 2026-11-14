// Add to Home Screen (2026-11-14, the owner): on an iPhone or iPad in a browser tab the setup has a Home Screen step right after Welcome
// (before anything is set up: the Home Screen app keeps its own storage), with the three taps; not in the app opened from the Home Screen
// and not on other devices; Settings → About offers the same instructions where they help; everything fits a 320 px phone.
module.exports=async({ok,chromium,url})=>{
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
    const h=await p.evaluate(()=>{const t=document.querySelector('#su-step').textContent;return {title:document.querySelector('#su-title').textContent,share:/Tap Share/.test(t)&&/bottom of Safari/.test(t),add:/Add to Home Screen/.test(t),tapAdd:/Tap Add/.test(t),before:/before you set anything up/.test(t),icons:document.querySelectorAll('#su-step .home-ico').length,pic:!!document.querySelector('#su-step .home-pic'),
      fit:document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#setup.on button')].every(b=>{const r=b.getBoundingClientRect();return r.right<=innerWidth+.5})}});
    ok(h.title==='Home Screen'&&h.share&&h.add&&h.tapAdd&&h.icons===2&&h.pic,'it shows the three taps (Share at the bottom of Safari, Add to Home Screen, Add) with the Share and Add icons');
    ok(h.before,'and says to do it before setting anything up (the Home Screen app keeps its own copy)');
    ok(h.fit,'it fits the phone');
    await p.click('#su-next');ok(await step(p)==='week','Next carries on with the setup in Safari');
    // Settings → About
    await p.evaluate(()=>{setupClose();openSettings('about')});
    const a=await p.waitForFunction(()=>(()=>{const b=document.querySelector('#home-again');return !!b&&b.getBoundingClientRect().height>0&&getComputedStyle(b).display!=='none'})(),null,{timeout:5000}).then(()=>true,()=>false);   // (displayed, not only the attribute)
    ok(a,'Settings → About offers "Add to Home Screen" on the iPhone');
    await p.evaluate(()=>{document.querySelector('#home-again').scrollIntoView()});await p.click('#home-again');await p.waitForFunction(()=>!!document.querySelector('#kitsheet.on'));
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='Add to Home Screen'&&/Add to Home Screen/.test(document.querySelector('.kit-body').textContent)&&!/before you set anything up/.test(document.querySelector('.kit-body').textContent)),'and opens the same instructions');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    // the app opened from the Home Screen: no step, no button
    const s=await open({ua:IPHONE,standalone:true});
    ok(await s.evaluate(()=>SETUP_STEPS.join(',')==='welcome,week,wear,weather,connect,done'),'opened from the Home Screen: no Home Screen step');
    await s.evaluate(()=>{setupClose();openSettings('about')});await s.waitForTimeout(300);ok(await s.evaluate(()=>!(()=>{const b=document.querySelector('#home-again');return !!b&&b.getBoundingClientRect().height>0&&getComputedStyle(b).display!=='none'})()),'and no button in About (nothing displayed)');await s.context().close();
    // another device: as before
    const d=await open();
    ok(await d.evaluate(()=>SETUP_STEPS.join(',')==='welcome,week,wear,weather,connect,done'),'on a computer the setup is as before');
    await d.evaluate(()=>{setupClose();openSettings('about')});await d.waitForTimeout(300);ok(await d.evaluate(()=>!(()=>{const b=document.querySelector('#home-again');return !!b&&b.getBoundingClientRect().height>0&&getComputedStyle(b).display!=='none'})()),'and About has no Home Screen button (nothing displayed)');await d.context().close();
    // 320 px
    const n=await open({ua:IPHONE,w:320});await n.click('#su-next');await n.waitForFunction(()=>document.querySelector('#su-step').dataset.step==='home');
    ok(await n.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#su-step .home-steps li')].every(l=>l.getBoundingClientRect().right<=innerWidth+.5)),'the step fits a 320 px phone');
    ok(!n.errs.length,'no page errors at 320 px: '+n.errs.join(' | '));await n.context().close();
  }finally{await browser.close()}
};
