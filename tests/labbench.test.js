// The lab's WebGL2 painter bench (lab/gl-bench.html, not part of the app): it loads with nothing heavy running, reports the device,
// and after Start at 1024 (one run a look, to keep it quick) shows a result for every look, the pictures and the JSON to copy, with no
// page errors and no request outside this site. Where this Chromium has no WebGL the bench must still finish on the CPU and say so.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[],outside=[];p.on('pageerror',e=>errs.push(e.message));
  const origin=new URL(url).origin;p.on('request',q=>{const u=q.url();if(!u.startsWith(origin)&&!/^(blob|data):/.test(u))outside.push(u)});
  try{
    await p.goto(new URL('lab/gl-bench.html',url).href);
    await p.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:30000});
    ok(await p.isHidden('#progress')&&await p.isHidden('#results'),'nothing runs before Start is tapped');
    await p.waitForFunction(()=>!/checking/.test(document.getElementById('device').textContent),null,{timeout:30000});
    const dev=await p.textContent('#device');ok(/Page WebGL2/.test(dev)&&/Worker WebGL2/.test(dev)&&/Pixel ratio/.test(dev),'the device is reported (WebGL2 on the page and in a Worker, pixel ratio)');
    const wide=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);ok(wide<=0,`readable at 390 px: no sideways scroll (${wide} px)`);
    await p.check('input[name=size][value="1024"]');await p.selectOption('#runs','1');await p.click('#start');
    await p.waitForSelector('#results:not([hidden])',{timeout:240000});
    const txt=await p.inputValue('#json'),J=JSON.parse(txt.slice(txt.indexOf('\n')+1)),o=J.worker&&J.worker.looks?J.worker:J.page;
    ok(J.options.size===1024&&o&&o.looks.length===4,`results for the four looks at 1024 (${o?o.looks.map(l=>l.name).join(', '):'none'})`);
    ok(o&&o.looks.every(l=>l.cpu>0),'every look timed on the CPU ('+(o?o.looks.map(l=>l.cpu).join(', '):'')+' ms)');
    const gl=[J.worker,J.page].filter(x=>x&&x.looks).flatMap(x=>x.looks).filter(l=>l.gl!=null);
    ok(gl.length?gl.every(l=>l.diff&&l.diff.max<=2):!!((J.worker&&J.worker.glWhy)||(J.page&&J.page.glWhy)),gl.length?`GL painted and compared (largest difference ${Math.max(...gl.map(l=>l.diff.max))})`:'no WebGL here: the bench says why ('+((J.page&&J.page.glWhy)||(J.worker&&J.worker.glWhy))+')');
    ok(!J.errors.length,'no errors in the results: '+J.errors.join('; '));
    ok(await p.$$eval('#pics canvas',c=>c.length)>=4,'the pictures are shown');
    ok((await p.$$eval('#table tbody tr',r=>r.length))===4,'the results table has a row per look');
    ok(await p.isVisible('#copy'),'the Copy results button is there');
    ok(!outside.length,'no requests outside the site: '+outside.join(', '));
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it runs the colour-coded painter (assemble.js, asm-color.js)
module.exports.realPlanner=true;   // the lab page has no planner: the fixed plan's script is not put into it
