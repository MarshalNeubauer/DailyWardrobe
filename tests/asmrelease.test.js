// The painting worker's memory and the page thread (fix round A of the 2026-11-16 code review, painter reviewer 8):
// CR-8-01 the worker is ended when the app is hidden and after ASM_IDLE_MS idle (it held about 146 MB of setup and 176 MB of graphics
//   textures for good after one picture), not while it is busy or saving a setup, and the next picture reads the setup back from disk;
// CR-8-02 a worker without WebGL2 (iOS 16.4-16.x): the page only draws; the setup is worked out and kept in the worker alone and the page
//   never works one out nor paints on its CPU (it froze the app for about 25 s), with the same picture; a failed page draw goes to the
//   worker's CPU; the page's graphics state goes with the idle release;
// CR-8-03 one ordinary error on the graphics chip keeps the context (that look on the CPU); the same error again releases it properly;
// CR-8-04 the mannequin's shirt buttons are the painter's (asmCmBtnCol); CR-8-05 Today's herringbone swatch ids never repeat.
// Real app files, the real asm-worker.js, the suit master's fixtures at 512 (tests/fixtures/cm/suit), no network.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,ROOT})=>{
  // (CR-8-04 without asm-color.js went with A8, 2026-11-28: every page file loads, and mannequin.js imports asmCmBtnCol; the page's check is below)
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await ctx.route(u=>!u.href.startsWith(new URL(url).origin),r=>r.abort());
    const p=await ctx.newPage();const errs=[],workers=[];p.on('pageerror',e=>errs.push(e.message));p.on('worker',w=>workers.push(w));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const FIX=path.join(__dirname,'fixtures','cm','suit'),recs={};
    for(const f of fs.readdirSync(FIX)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');recs[n]=`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64')}
    await p.evaluate(async recs=>{HOOK.ASM_ON=true;self.ASM_CM_SIZE=512;HOOK.asmAheadSoon=()=>{};HOOK.asmAhead=async()=>{};HOOK.asmCmSrcSig();HOOK.asmCmCodeSig();
      for(const [n,img] of Object.entries(recs))HOOK.renders[HOOK.asmCmKey('suit',n)]={img,t:1000,sig:'asm/cm test',model:'colormaster'};
      const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#e6e2dc';x.fillRect(0,0,512,512);
      HOOK.renders[HOOK.asmCmBgKey()]={img:c.toDataURL('image/png'),t:4242,sig:'asm/cm-bg test'};
      const I=(type,col,x={})=>({id:type+col,type,primaryColor:col,pattern:'solid',...x});
      window.__L=['burgundy','green','navy','brown','olive','grey'].map(t=>({top:I('suit','navy'),shirt:I('shirt','white'),tie:I('tie',t)}));
      window.__hide=h=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'))};
      window.__px=async u=>{const im=new Image();im.src=u;await im.decode();const k=document.createElement('canvas');k.width=im.width;k.height=im.height;const g=k.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,im.width,im.height).data};
      window.__diff=async(a,b)=>{const A=await __px(a),B=await __px(b);if(A.length!==B.length)return 999;let m=0;for(let i=0;i<A.length;i++)m=Math.max(m,Math.abs(A[i]-B[i]));return m};
      window.__ready=async()=>{const st=HOOK.asmWorker();if(!st)return st;await new Promise(ok=>{const t=setInterval(()=>{if(st.ok!=null||HOOK.asmW!==st){clearInterval(t);ok()}},20)});return st};
      const db=await HOOK.asmCmDb();await new Promise(ok=>{const t=db.transaction('p','readwrite');t.objectStore('p').clear();t.oncomplete=ok});db.close()},recs);
    // (a browser whose picture worker can't run, as Playwright's WebKit on Windows: no OffscreenCanvas 2D in a worker; the worker parts are skipped)
    const canWork=await p.evaluate(async()=>{await __ready();return !!(HOOK.asmW&&HOOK.asmW.ok)});
    if(canWork){
    const quiet=()=>p.waitForFunction(()=>HOOK.asmW&&HOOK.asmW.ok&&!HOOK.asmW.saving&&!HOOK.asmW.busy&&!HOOK.asmQ.length,null,{timeout:60000,polling:100});
    // ---- CR-8-01: hidden ends the worker; the next picture reads the setup back ----
    const a=await p.evaluate(async()=>{await __ready();const r=await HOOK.asmRun(await HOOK.asmJob(__L[0]),true);window.__ref=r.url;return {gl:r.gl,url:!!r.url,alive:!!(HOOK.asmW&&HOOK.asmW.w)}});
    await quiet();
    const nw0=workers.length,closed=new Promise(ok=>workers[workers.length-1].once('close',()=>ok(true)));
    await p.evaluate(()=>__hide(true));const gone=await Promise.race([closed,new Promise(ok=>setTimeout(()=>ok(false),5000))]);
    const h=await p.evaluate(()=>({asmW:HOOK.asmW,glPage:!!HOOK.asmGlState}));
    ok(a.url&&a.alive&&gone&&h.asmW===null,`CR-8-01: the worker that painted (gl ${a.gl}) is ended when the app is hidden (closed ${gone}, asmW ${h.asmW})`);
    await p.evaluate(()=>__hide(false));await p.evaluate(()=>__ready());
    const w2=workers[workers.length-1];await w2.evaluate(()=>{HOOK.asmCmSrcSig();self.__prep=0;const f=HOOK.asmCmPrep;HOOK.asmCmPrep=async(...x)=>{self.__prep++;return f(...x)}});
    const b=await p.evaluate(async()=>{const r=await HOOK.asmRun(await HOOK.asmJob(__L[0]),true);return {gl:r.gl,diff:await __diff(r.url,__ref)}});
    const prepB=await w2.evaluate(()=>self.__prep);
    ok(workers.length===nw0+1&&prepB===0&&b.diff<=2,`the next picture starts a new worker that reads the setup from disk (${prepB} worked out) and paints the same picture (largest difference ${b.diff})`);
    // the idle timer, and nothing ended while busy, waiting or saving
    const t=await p.evaluate(async()=>{const keep=HOOK.ASM_IDLE_MS;HOOK.ASM_IDLE_MS=400;await HOOK.asmRun(await HOOK.asmJob(__L[1]),true);
      for(let i=0;i<60&&HOOK.asmW&&HOOK.asmW.saving;i++)await new Promise(ok=>setTimeout(ok,100));
      await new Promise(ok=>setTimeout(ok,1200));const idleEnded=HOOK.asmW===null;HOOK.ASM_IDLE_MS=keep;
      const real=HOOK.asmW;let dead=0;const st={w:{postMessage(){},terminate(){dead++}},ok:true,busy:null,saving:1};HOOK.asmW=st;
      HOOK.asmIdleEnd();const saving=dead;st.saving=0;st.busy={id:1};HOOK.asmIdleEnd();const busy=dead;st.busy=null;HOOK.asmQ.push({id:2});HOOK.asmIdleEnd();const queued=dead;HOOK.asmQ.length=0;
      HOOK.asmIdleEnd();const idle=dead;const after=HOOK.asmW;HOOK.asmW=real;return {idleEnded,saving,busy,queued,idle,after}});
    ok(t.idleEnded,'CR-8-01: after ASM_IDLE_MS with nothing to paint the worker is ended');
    ok(t.saving===0&&t.busy===0&&t.queued===0&&t.idle===1&&t.after===null,`not while a setup is being saved, a picture is under way or one is waiting (${JSON.stringify(t)})`);
    // ---- CR-8-02: a worker without WebGL2 ----
    const pg=await p.evaluate(async()=>{const st=await __ready();const ref=await HOOK.asmRun(await HOOK.asmJob(__L[2]),true);
      HOOK.asmGlFree();HOOK.asmCmMem=null;st.gl=false;
      const n={prep:0,build:0,setup:0},wrap=(k,f)=>(...x)=>{n[k]++;return f(...x)};const P0=HOOK.asmCmPrep,B0=HOOK.asmCmBuild,S0=HOOK.asmCmSetup;HOOK.asmCmPrep=wrap('prep',P0);HOOK.asmCmBuild=wrap('build',B0);HOOK.asmCmSetup=wrap('setup',S0);
      const job=await HOOK.asmJob(__L[2]),onPage=HOOK.asmGlOnPage(job,st),r=await HOOK.asmRun(job,true);
      const out={onPage,gl:r.gl,diff:await __diff(r.url,ref.url),pageSetup:HOOK.asmCmMem,pageGl:!!HOOK.asmGlState,n:{...n}};
      // the page's graphics chip fails: the worker's CPU paints the look, not the page's
      const G0=HOOK.asmGlPage;HOOK.asmGlPage=async()=>null;const f=await HOOK.asmRun(await HOOK.asmJob(__L[3]),true);HOOK.asmGlPage=G0;
      out.fail={gl:f.gl,url:!!f.url,n:{...n}};HOOK.asmCmPrep=P0;HOOK.asmCmBuild=B0;HOOK.asmCmSetup=S0;return out});
    ok(pg.onPage&&pg.gl===true&&pg.diff<=2,`CR-8-02: with no WebGL2 in the worker the page draws the look on its graphics chip, the same picture as the worker's (largest difference ${pg.diff})`);
    ok(pg.n.prep===0&&pg.n.build===0&&pg.n.setup===0&&pg.pageSetup===null&&pg.pageGl,`the page works no setup out, paints nothing on its CPU and keeps no setup (${JSON.stringify(pg.n)}, page setup ${pg.pageSetup})`);
    ok(pg.fail.gl===false&&pg.fail.url&&pg.fail.n.prep===0&&pg.fail.n.build===0,`a failed draw on the page is painted by the worker's CPU, never the page's (${JSON.stringify(pg.fail)})`);
    await quiet();await p.evaluate(()=>__hide(true));await p.waitForFunction(()=>HOOK.asmW===null,null,{timeout:5000}).catch(()=>{});
    const rel=await p.evaluate(()=>({asmW:HOOK.asmW,glPage:!!HOOK.asmGlState}));
    ok(rel.asmW===null&&!rel.glPage,`hidden, the worker and the page's own graphics state are let go (${JSON.stringify(rel)})`);
    await p.evaluate(()=>__hide(false));
    // ---- CR-8-03: one ordinary error keeps the context ----
    const ge=await p.evaluate(async()=>{const job={...(await HOOK.asmJob(__L[4])),diskCache:false,gl:true};HOOK.asmGlReset();
      const first=(await HOOK.asmCmBuild(job)).gl,G1=HOOK.asmGlState;const real=HOOK.asmGlPaint;let n=1;HOOK.asmGlPaint=async(...q)=>{if(n-->0)throw new TypeError('a bug in a look');return real(...q)};
      const second=(await HOOK.asmCmBuild(job)).gl,kept=HOOK.asmGlState===G1&&!G1.gl.isContextLost(),third=(await HOOK.asmCmBuild(job)).gl,same=HOOK.asmGlState===G1;
      n=2;const e1=(await HOOK.asmCmBuild(job)).gl,e2=(await HOOK.asmCmBuild(job)).gl,released=HOOK.asmGlState===null&&G1.freed&&G1.gl.isContextLost();HOOK.asmGlPaint=real;HOOK.asmGlReset();
      return {first,second,kept,third,same,e1,e2,released}});
    ok(ge.first===true&&ge.second===false&&ge.kept&&ge.third===true&&ge.same,`CR-8-03: one ordinary graphics error paints that look on the CPU and keeps the context for the next (${JSON.stringify(ge)})`);
    ok(ge.e1===false&&ge.e2===false&&ge.released,'the same error again lets the context go properly (textures deleted, context given back)');
    }else ok(true,'CR-8-01/02/03 skipped: the picture worker can\'t run in this browser (it reports it is not ready)');
    // ---- CR-8-04 on the page: the painter's own rule ----
    const bt=await p.evaluate(()=>['#ffffff','#cfe0f2','#3b4a63'].map(sh=>{const svg=outfitMannequinSvg({kind:'shirt-open',shirtColor:sh,bot:{color:'#555'},shirt:{color:sh}});
      const m=/<g class="fig-shirtbtn">(?:<circle[^>]*\/>)(<circle[^>]*fill="(#[0-9a-f]{6})"\/>)/i.exec(svg);
      const want='#'+HOOK.asmCmBtnCol([1,3,5].map(k=>HOOK.srgbLin8(parseInt(sh.slice(k,k+2),16)))).map(v=>Math.round(255*HOOK.linSrgb(v)).toString(16).padStart(2,'0')).join('');return [m&&m[2],want]}));
    ok(bt.every(([d,w])=>d===w),`CR-8-04: the mannequin's buttons are the painted ones (${bt.map(x=>x.join('='))})`);
    // ---- CR-8-05: herringbone swatch ids stay unique after the cache evicts ----
    const hb=await p.evaluate(async()=>{const ids=[],cols=Object.keys(HOOK.COLORS).slice(0,24);let made=0;
      for(const c of cols){const i={id:'hb-'+c,type:'shirt',primaryColor:c,pattern:'herringbone'};const s=HOOK.ovlHbShirt(i);const m=s&&/data-hb="([^"]+)"/.exec(s);if(m)ids.push(m[1]);
        const e=HOOK.OVL_HB.get(HOOK.ovlHbKey(i));if(e&&e.p){await e.p.catch(()=>{});if(e.url)made++}}
      return {n:ids.length,distinct:new Set(ids).size,made}});
    ok(hb.n>=18&&hb.distinct===hb.n&&hb.made>=17,`CR-8-05: every herringbone swatch placeholder gets its own id, also after the cache evicts (${hb.distinct} distinct of ${hb.n}, ${hb.made} made)`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // the colour-coded painter and its worker (assemble.js, asm-color.js, asm-gl.js, asm-worker.js)
