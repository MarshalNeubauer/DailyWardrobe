// A look's picture already on the worker (assemble.js asmGetPre): a picture kept on the worker under the look's key, signed
// 'asm/out/cm<ASM_CMV>/<stamp>' (uploaded by the PC builder until it was removed on 2026-11-16), is taken by a phone before it downloads
// the master; a picture signed another way, or none, and the phone paints the look itself.
// Fixtures: the colour-coded suit master and its masks at 512 (tests/fixtures/cm/suit/). (Until 2026-11-16 this was asmprebuild.test.js,
// which also ran the PC builder, tools/asm-prebuild.js.)
const fs=require('fs');
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/',FIX=require('path').join(__dirname,'fixtures','cm','suit');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const got=[];let served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');if(k)got.push(k);
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&u.searchParams.get('list'))return j({keys:Object.keys(served)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the colour-coded suit master's records, as the worker keeps them
    const files=fs.readdirSync(FIX),names=files.map(f=>f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'));
    const ck=await p.evaluate(ns=>ns.map(n=>asmCmKey('suit',n)),names),cmRecs={};
    files.forEach((f,i)=>{cmRecs[ck[i]]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(require('path').join(FIX,f)).toString('base64'),model:'colormaster',t:1000}});
    const masterKeys=new Set(ck);Object.assign(served,cmRecs);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      items=[I('watch','silver',{metal:'silver'}),I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];settings.vestMode='never';dayRecs={};weather={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};
      HOOK.asmAheadSoon=()=>{};HOOK.asmAhead=async()=>{}},HOST);   // (nothing built in the background during the test)
    // the look's key and the signature a picture on the worker carries
    const pre=await p.evaluate(async()=>{await asmListGet(true);const o=planFor()[key(sel)];await HOOK.asmCmLook(o);await asmCmGet(asmCmKind(o));return {key:asmOutKey(o),sig:`asm/out/cm${ASM_CMV}/${asmStamp(o)}`,kind:asmCmUse(o)}});
    ok(pre.kind==='suit'&&/\/1000$/.test(pre.sig),`the day's look is painted on the suit master, its stamp the newest record's date (${pre.sig})`);
    // a phone holding nothing takes the worker's picture: it downloads no master record and paints nothing
    served[pre.key]={sig:pre.sig,img:'data:image/jpeg;base64,/9j/BUILT',model:'assembled',t:5};
    const phone=async()=>p.evaluate(async()=>{for(const k of Object.keys(renders))if(/^c/.test(k))delete renders[k];asmOut={};asmTried.clear();HOOK.asmPreNo.clear();await asmListGet(true);const o=planFor()[key(sel)];
      let built=0;const real=asmPhoto,idle=async()=>{for(let i=0;i<200&&(asmBusy.size||HOOK.asmPreGetting.size);i++)await new Promise(r=>setTimeout(r,50))};asmPhoto=async(...a)=>{built++;return real(...a)};
      try{await asmEnsure(o);await idle()}finally{asmPhoto=real}
      const a=asmFor(o);return {img:a&&a.img.slice(0,40),built,blob:!!(asmOut[asmOutKey(o)]||{}).blob}});
    got.length=0;const a=await phone();
    ok(a.built===0&&a.img==='data:image/jpeg;base64,/9j/BUILT'&&!got.some(k=>masterKeys.has(k)),`a phone takes the worker's picture before asking for the master, and paints nothing (${got.length} keys asked for, none of them a master record)`);
    // signed another way (the earlier assembler's zones, or another masters' version): not used, painted here
    served[pre.key]={...served[pre.key],sig:'asm/out/z9/1000'};const c=await phone();
    ok(c.built===1&&c.img,'a picture signed another way (the earlier assembler\'s): not used, painted here');
    delete served[pre.key];const d=await phone();
    ok(d.built===1&&d.img,'nothing on the worker for the look: the phone paints it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
