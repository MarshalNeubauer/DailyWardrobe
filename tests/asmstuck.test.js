// A picture the assembly worker never answers (2026-11-14 audit, assemble.js asmStuck): after ASM_RUN_MS it fails, the worker is
// replaced and the pictures waiting behind it are made by the new one; before, everything after it waited until the app restarted.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const posted=[];
      // a worker that takes jobs and never answers
      const st={w:{postMessage:m=>posted.push(m.id),terminate:()=>{st.dead=true}},ok:true,busy:null};asmW=st;
      const out={run:typeof ASM_RUN_MS==='number'&&ASM_RUN_MS>=60e3};
      const a=asmRun({x:1}).then(()=>'ok',e=>'failed: '+e.message),b=asmRun({x:2}).then(()=>'ok',e=>'failed: '+e.message);
      out.waiting=asmQ.length;out.busy=st.busy&&st.busy.id;
      asmStuck(st,st.busy);out.first=await a;out.dead=!!st.dead;out.replaced=asmW!==st&&asmW!==null;
      // the next one goes to the new worker (here a real one: it fails on the bad job and says so, it doesn't hang)
      out.second=await Promise.race([b,new Promise(r=>setTimeout(()=>r('still waiting'),20000))]);
      out.posted=posted.length;return out});
    ok(r.run&&r.busy&&r.waiting===1,`a job waits behind the busy one (${JSON.stringify(r)})`);
    ok(/^failed: the picture took too long/.test(r.first)&&r.dead&&r.replaced,`the unanswered picture fails, its worker is ended and a new one started (${r.first})`);
    ok(r.second!=='still waiting'&&r.posted===1,`the picture waiting behind it is answered by the new worker (${r.second})`);
    ok(!errs.length,'no page errors ('+errs.join('; ')+')')}
  finally{await browser.close()}};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
