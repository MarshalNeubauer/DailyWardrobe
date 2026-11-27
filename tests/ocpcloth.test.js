// The owner's own OCP cloth on OCP pants (asm-ocp.js asmOcpJob / asmOcpPhotoTex; the code review R8 N1, 2026-11-24): while the masters'
// manifest lists his cloth record, the look's key says so (asmOcpSig 'oc:'+date). A download that fails for now (no connection, a 5xx,
// the worker's limits) must then give no job, so no picture with the made-up cloth is kept under that key, and the look is painted in
// his cloth once the download works; a 404 (a device that can't have it) still falls back to the made-up cloth. Painted at 512 in the
// real Web Worker on the T-shirt master (tests/fixtures/cm/tee, a made-up stand-in).
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const FIX=path.join(__dirname,'fixtures','cm'),HOST='https://w.test/';
  const browser=await chromium.launch();const errs=[];
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});const served={};
    let mode='fail',clothKey=null,cloth=null,asked=0;
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(route.request().method()!=='GET')return j({ok:true});
      if(k&&k===clothKey){asked++;if(mode==='fail')return route.abort('internetdisconnected');if(mode==='busy')return j({error:'busy'},503);if(mode==='404')return j({error:'not found'},404);
        return j({img:cloth,t:5000,sig:'asm/cm test',model:'colormaster'})}
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});
      return j({error:'not found'},404)});
    const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the manifest lists his cloth (as on the owner's phone) and the phone is connected
    clothKey=await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');const ck=HOOK.asmCmKey('blouse','ocp-cloth');localStorage.setItem('asm_cm_mf',JSON.stringify({keys:{[ck]:5000}}));return ck},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);
    const recs={};for(const kind of ['shirt-open','tee']){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d))recs[kind+'|'+f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/')]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(d,f)).toString('base64'),model:'colormaster',t:1000}}
    const kmap=await p.evaluate(ks=>{const o={};for(const k of ks){const [kind,n]=k.split('|');o[k]=HOOK.asmCmKey(kind,n)}return o},Object.keys(recs));
    for(const [k,r] of Object.entries(recs))served[kmap[k]]=r;
    // a 64 px square tile standing in for his cloth (asmOcpPhotoTex reads a square tile)
    cloth=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');for(let y=0;y<64;y+=8)for(let x=0;x<64;x+=8){g.fillStyle=(x+y)%16?'#7d7254':'#a39a78';g.fillRect(x,y,8,8)}return c.toDataURL('image/png')});
    await p.evaluate(()=>{self.ASM_CM_SIZE=512;HOOK.asmAheadSoon=()=>{};HOOK.asmAhead=async()=>{};let n=0;const I=(type,primaryColor,x={})=>({id:'c'+type+(n++),type,primaryColor,pattern:'solid',...x});
      window.__o={shirt:I('tee','tan'),bot:I('pants','khaki',{pattern:'camouflage',camo:'ocp',trouserKind:'cargo'}),belt:I('belt','brown'),watch:I('watch','silver',{metal:'silver',dial:'white',band:'integrated'})}});
    const look=()=>p.evaluate(async ck=>{const o=window.__o,k=HOOK.asmKindOf(o),r={kind:k,sig:HOOK.asmOcpSig(o,k)};await HOOK.asmCmLook(o);r.records=!!await HOOK.asmNkGet(o,k);
      const j=await HOOK.asmJob(o),T=j&&j.cloth&&j.cloth.trousers&&j.cloth.trousers.suit;r.job=!j?'none':T&&T.mm===211?'his cloth':T&&T.TW===1024?'made-up cloth':'?';
      await HOOK.asmCmEnsure(o,true);const f=HOOK.asmFor(o);r.kept=!!f;r.held=!!HOOK.renders[ck];r.tried=HOOK.asmTried.has(ck);
      // the kept picture against one painted now from this job: the same pixels, or the kept one is another cloth's
      if(f&&j){const now=await HOOK.asmPhoto(o,true),A=(await HOOK.asmData(f.img,512)).data,B=(await HOOK.asmData(now,512)).data;let m=0;for(let q=0;q<A.length;q++)m=Math.max(m,Math.abs(A[q]-B[q]));r.keptDiff=m}
      return r},clothKey);
    const a=await look();
    ok(a.kind==='tee'&&a.records&&/oc:5000/.test(a.sig),`an OCP-pants look on the T-shirt master carries his cloth's date in its key (${JSON.stringify(a)})`);
    ok(a.job==='none'&&!a.kept&&!a.held&&!a.tried,`his cloth can't be downloaded for now: no job and no picture kept under the key that promises his cloth, the drawing stays (${JSON.stringify(a)})`);
    mode='busy';await p.evaluate(()=>HOOK.asmRetryAt.clear());const b=await look();
    ok(b.job==='none'&&!b.kept&&!b.tried,`a busy worker (503): the same (${JSON.stringify(b)})`);
    mode='ok';await p.evaluate(()=>HOOK.asmRetryAt.clear());const c=await look();   // (the 30 s retry wait passed, the connection is back)
    ok(c.job==='his cloth'&&c.kept&&c.held&&c.sig===a.sig&&c.keptDiff<=2,`once the download works the look is painted in his own cloth and kept under the same key (${JSON.stringify(c)}; asked ${asked} times)`);
    // a device that can't have it (a 404, a tester): the made-up OCP cloth, as before
    mode='404';await p.evaluate(async ck=>{delete HOOK.renders[ck];HOOK.asmTried.delete(ck);HOOK.asmRetryAt.clear();HOOK.asmOut={}},clothKey);const d=await look();
    ok(d.job==='made-up cloth'&&d.kept&&d.tried&&d.keptDiff<=2,`a 404 for his cloth: painted in the made-up OCP cloth, as before (${JSON.stringify(d)})`);
    ok(!errs.length,`no page errors (${errs.join(' | ')})`);
  }finally{await browser.close()}};
module.exports.assembled=true;   // (assembled pictures on: tests/run.js)
