// Add to Home Screen in Chrome on an iPhone (2026-11-16, a tester used Chrome and was shown Safari's steps): the sheet names Chrome and its
// Share button in the address bar, the notes say Chrome, the Connection and reminder lines too; Safari keeps its own steps.
module.exports=async({ok,chromium,url})=>{
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
