// An Add card is drawn again whenever Claude's reading of it ends, even when a step after the answer fails (2026-11-16, a tester could
// save only after tapping "Bought, on the way": a pattern answer that couldn't be drawn threw after the reading's flag was cleared, and
// Confirm stayed switched off until something else redrew the card).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.route('**/wv.test/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const conf=()=>p.evaluate(()=>{const q=queue[0],b=document.querySelector('#qconf-0');return {reading:!!(q&&(q.refining||q.patternReading)),off:b?b.disabled:'none'}});
    const start=async(pattern)=>{await p.evaluate(async pat=>{queue.length=0;localStorage.setItem('worker_url','https://wv.test/');localStorage.setItem('app_token','x');
      window.ask=async()=>({type:'suit',primaryColor:'navy',secondaryColor:'white',tertiaryColor:null,pattern:'pinstripe',confidence:{type:'high',primaryColor:'high',pattern:'high'},model:'stub',
        weave:{direction:'vertical',repeatsAcross:30,colours:['#1f2a44','#e8e8e8'],description:'navy with fine white pinstripes'}});
      window.claudePattern=async()=>pat;openAdd();
      const bl=await (await fetch('tests/fixtures/suit-pinstripe.jpg')).blob();await addFiles([new File([bl],'s.jpg',{type:'image/jpeg'})])},pattern);
      await p.waitForFunction(()=>queue[0]&&!queue[0].busy&&document.querySelector('#qconf-0'));
      await p.evaluate(async()=>{const bl=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([bl],'c.jpg',{type:'image/jpeg'}))});
      await p.waitForFunction(()=>queue[0]&&!queue[0].refining&&!queue[0].patternReading,null,{timeout:20000});await p.waitForTimeout(300)};

    // a pattern answer of a shape that can't be drawn (across without bands)
    await start({layout:'bands',across:[{hex:'#1f2a44',w:9}],stripeDirection:'vertical',repeatsInCloseup:6,repeatsAcrossItem:30,paneAspect:1});
    let c=await conf();ok(!c.reading&&c.off===false,'a pattern answer that can\'t be drawn: the reading ends and Confirm is on ('+JSON.stringify(c)+')');
    ok(await p.evaluate(async()=>{const r=await save(queue[0].id);return r===true&&items.length===1&&!items[0].order}),'and the item saves in rotation, without "Bought, on the way"');

    // a step after the close-up's answer throws
    await p.evaluate(()=>{window._ma=measureAndApply;window.measureAndApply=()=>{throw new Error('measuring failed')}});
    await start(null);
    c=await conf();ok(!c.reading&&c.off===false,'a measuring step that throws after the close-up\'s answer: Confirm is on ('+JSON.stringify(c)+')');
    await p.evaluate(()=>{window.measureAndApply=window._ma});

    // the reading itself fails (the network): Confirm comes back too
    await p.evaluate(()=>{window._ask=window.ask});await start(null);
    await p.evaluate(()=>{window.ask=async()=>{throw new Error('offline')}});
    await p.evaluate(async()=>{const bl=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([bl],'c2.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0]&&!queue[0].refining&&!queue[0].patternReading,null,{timeout:20000});await p.waitForTimeout(300);
    c=await conf();ok(!c.reading&&c.off===false,'a close-up reading that fails outright: Confirm is on ('+JSON.stringify(c)+')');
    ok(!errs.length,'no uncaught errors ('+errs.join('; ')+')');
  }finally{await browser.close()}};
