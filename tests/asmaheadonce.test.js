// Building ahead runs one pass at a time (C3, 2026-11-24): asmAhead's first line held its hidden-check comment, and the comment ran on
// over the guard after it on the same line (`if(asmAheadOn){asmAheadAgain=true;return}asmAheadOn=true;`), so asmAheadOn never became
// true and two passes started together (Today drawn twice in a row, a sync's redraw) painted side by side. Now a pass started while one
// runs only asks the running one to go round again: the pictures go to the worker one at a time, and the result (the looks kept, their
// keys, Pictures ahead) is a single pass's. On the colour-coded suit master's fixtures (512), the real Web Worker, no network.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    // a stand-in server that has nothing (Pictures ahead counts only while connected): every look is painted here
    await ctx.route('https://w.test/**',route=>{const u=new URL(route.request().url()),j=(x,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(x)});
      if(route.request().method()!=='GET')return j({ok:true});if(u.pathname==='/render'&&u.searchParams.get('list'))return j({keys:[]});if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({error:'not found'},404)});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const FIX=path.join(__dirname,'fixtures','cm','suit'),recs=fs.readdirSync(FIX).map(f=>[f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'),`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64')]);
    await p.evaluate(async recs=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;HOOK.ASM_ON=true;HOOK.asmAheadSoon=()=>{};
      for(const [n,img] of recs)HOOK.renders[HOOK.asmCmKey('suit',n)]={sig:'asm/cm test',img,model:'colormaster',t:1000};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('watch','silver',{metal:'silver'}),I('blazer','khaki',{pattern:'windowpane'}),I('blazer','navy'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','navy',{pattern:'stripe',secondaryColor:'pink'}),I('tie','burgundy'),I('tie','green'),
        I('pants','grey'),I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      HOOK.settings.workdays=[1,2,3,4,5];HOOK.settings.blazerDays=[1,2,3,4,5];HOOK.settings.vestMode='never';HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-10T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,10);HOOK.view={y:2026,m:10};
      const st=HOOK.asmWorker();await new Promise(ok=>{const t=setInterval(()=>{if(!st||st.ok!=null){clearInterval(t);ok()}},20)});
      // at most how many pictures are at the worker at once (waiting or being painted), and whether a pass says it is running
      window.__mx=0;window.__on=false;setInterval(()=>{const n=HOOK.asmQ.length+(HOOK.asmW&&HOOK.asmW.busy?1:0);if(n>__mx)__mx=n;if(HOOK.asmAheadOn)__on=true},1);
      window.__status=async()=>{HOOK.openSettings('photos');document.body.classList.add('owner');HOOK.renderAsmUI();const el=()=>(document.querySelector('#cm-status')||{textContent:''}).textContent;for(let i=0;i<200&&!/^Next/.test(el());i++)await new Promise(r=>setTimeout(r,25));const t=el();HOOK.closeSettings();return t};
      window.__done=()=>!HOOK.asmAheadOn&&!HOOK.asmQ.length&&!(HOOK.asmW&&HOOK.asmW.busy)},recs);
    const ready=await p.evaluate(()=>!!(HOOK.asmW&&HOOK.asmW.ok));
    ok(ready,'the painting worker is ready');
    // one pass by itself
    const one=await p.evaluate(async()=>{__mx=0;__on=false;await HOOK.asmAhead();for(let i=0;i<600&&!__done();i++)await new Promise(r=>setTimeout(r,50));
      return {keys:Object.keys(HOOK.asmOut).sort(),status:await __status(),mx:__mx,on:__on}});
    // two passes started together, from nothing kept
    const two=await p.evaluate(async()=>{for(const k of Object.keys(HOOK.asmOut))delete HOOK.asmOut[k];__mx=0;__on=false;
      await Promise.all([HOOK.asmAhead(),HOOK.asmAhead()]);for(let i=0;i<600&&!__done();i++)await new Promise(r=>setTimeout(r,50));
      return {keys:Object.keys(HOOK.asmOut).sort(),status:await __status(),mx:__mx,on:__on}});
    ok(one.keys.length>=3,`one pass paints the coming looks (${one.keys.length} looks: ${one.status})`);
    ok(two.on&&two.mx===1,`two passes started together run one at a time: a pass says it is running (${two.on}) and the worker never holds more than one of their pictures (${two.mx} at most)`);
    ok(JSON.stringify(two.keys)===JSON.stringify(one.keys),`and they keep the same looks under the same keys as one pass (${two.keys.length} and ${one.keys.length})`);
    ok(two.status===one.status&&/^Next 60 days: \d+ of \d+/.test(two.status),`Pictures ahead says the same (${two.status})`);
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // builds colour-coded pictures (assemble.js)
