// The bottom tab bar is compact (44px buttons, a tap target's size, reaching into the home-indicator zone) so Today's picture and the tiles under it
// fit on one screen; page content still clears it.
module.exports=async({ok,chromium,url,devices,WARDROBES})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({...devices['iPhone 13']});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')})()`);
  const r=await p.evaluate(()=>{const n=document.querySelector('body>nav'),b=n.querySelector('button'),cs=getComputedStyle(document.documentElement);
    scrollTo(0,document.documentElement.scrollHeight);const last=[...document.querySelectorAll('#today > *')].filter(e=>e.offsetHeight).pop();
    return {nav:n.getBoundingClientRect().height,btn:b.getBoundingClientRect().height,pad:cs.getPropertyValue('--navpad'),
      clear:innerHeight-n.getBoundingClientRect().height-last.getBoundingClientRect().bottom}});
  ok(r.nav<=46,`the tab bar is compact (${r.nav}px without a home indicator; it was 55px, then 39)`);
  ok(r.btn>=44,`its buttons are a full tap target's height (${r.btn}px)`);
  ok(/max\(0px,\s*calc\(.*-\s*18px\)\)/.test(r.pad),'with a home indicator it keeps only part of the inset clear below it');
  ok(r.clear>=8,`scrolled to the bottom, Today's last card clears the bar (${Math.round(r.clear)}px)`);
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
