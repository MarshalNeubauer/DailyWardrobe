// Nothing fails silently (2026-11-14, after a tester's buttons did nothing on an iPhone): an error nobody caught right after a tap says
// so in a toast; one with no tap before it stays quiet; every one is noted on the phone and goes with the next feedback, then cleared.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // a button whose code throws (async, as most of the app's are)
    await p.evaluate(()=>{localStorage.removeItem('err_log');const b=document.createElement('button');b.id='boom';b.textContent='boom';b.style.cssText='position:fixed;top:200px;left:20px;z-index:99999';
      b.onclick=()=>{(async()=>{await 0;throw new TypeError("undefined is not an object (evaluating 'x.y')")})()};document.body.append(b)});
    await p.click('#boom');
    const t=await p.waitForFunction(()=>/Something went wrong: undefined is not an object/.test(document.querySelector('#toast').textContent)).then(()=>true,()=>false);
    ok(t,'an uncaught error right after a tap says so');
    const log=await p.evaluate(()=>JSON.parse(localStorage.getItem('err_log')||'[]'));
    ok(log.length===1&&/undefined is not an object/.test(log[0].m)&&log[0].v&&log[0].t>0,'and is noted on the phone with the time and the app version');
    // with no tap before it: noted, no toast
    await p.waitForTimeout(3200);
    await p.evaluate(()=>{document.querySelector('#toast').textContent='';document.querySelector('#toast').classList.remove('on');Promise.reject(new Error('background thing'))});await p.waitForTimeout(300);
    ok(await p.evaluate(()=>!/Something went wrong/.test(document.querySelector('#toast').textContent)&&JSON.parse(localStorage.getItem('err_log')).length===2),'one in the background with no tap is noted, not shown');
    // noise isn't noted
    await p.evaluate(()=>{Promise.reject(new DOMException('stopped','AbortError'))});await p.waitForTimeout(200);
    ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('err_log')).length===2),'a stopped request is not a problem');
    // feedback takes them along, and clears them once sent
    const fb=await p.evaluate(()=>fbWithErrs('The button did nothing'));
    ok(/^The button did nothing\n\n— Problems noted on this phone —\n.*undefined is not an object.*\n.*background thing/.test(fb)&&fb.length<=4000,'the next feedback carries them');
    ok(await p.evaluate(()=>fbWithErrs('x'.repeat(3990)).length===4000),'within the server\'s 4,000 characters');
    await p.evaluate(()=>localStorage.removeItem('err_log'));ok(await p.evaluate(()=>fbWithErrs('hi')==='hi'),'with nothing noted the feedback is as written');
    await ctx.close();
  }finally{await browser.close()}
};
