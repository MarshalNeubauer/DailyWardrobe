// Assembled pictures, the parts of assemble.js around the colour-coded painter (asm-color.js, tested in asmcolor.test.js): the drawn tie
// bar, the ASM_ON switch, which picture Today shows for a painted look, that the earlier photo-per-item assembler is gone (2026-11-14), and
// that the worker refuses its edit-a-kept-photo jobs (removed 2026-11-14) but still deletes a kept photo.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch(),realFetch=globalThis.fetch;
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- the tie bar, drawn (asmBarDraw: the painter draws a tie clip with it) ----
    const dr=await p.evaluate(()=>{const W=1024,N=W*W,tie=new Uint8Array(N),o=new Uint8ClampedArray(4*N);
      for(let y=200;y<900;y++){const half=40+(y-200)*.03,cx=500+(y-200)*.02;for(let x=Math.round(cx-half);x<=Math.round(cx+half);x++)tie[y*W+x]=1}   // a tie, widening and leaning a little
      for(let i=0;i<N;i++){const v=tie[i]?60:200;o[4*i]=o[4*i+1]=v;o[4*i+2]=tie[i]?110:200;o[4*i+3]=255}const before=new Uint8ClampedArray(o);
      const m=HOOK.asmBarDraw(o,tie,W,'silver',null),L=HOOK.asmLab(new ImageData(o,W,W)),L0=HOOK.asmLab(new ImageData(before,W,W));let n=0,off=0,Lmax=0,y0=W,y1=0;
      for(let i=0;i<N;i++)if(m&&m[i]){n++;if(!tie[i])off++;Lmax=Math.max(Lmax,L[3*i]);const y=(i/W)|0;y0=Math.min(y0,y);y1=Math.max(y1,y)}
      let sh=0,sn=0;if(n){const y=y1+2;for(let x=0;x<W;x++){const i=y*W+x;if(tie[i]&&!m[i]){sn++;sh+=L0[3*i]-L[3*i]}}}
      const metals=[{type:'tieclip',primaryColor:'silver',metal:'other'},{type:'tieclip',primaryColor:'rosegold'},{type:'tieclip',primaryColor:'black',metal:'gold'}].map(c=>HOOK.asmBarRgb(c).join('.')).join(' ');
      return {n,off,L:Lmax,h:y1-y0+1,shadow:sn?sh/sn:0,metals,want:[HOOK.ASM_METAL.silver,HOOK.ASM_METAL.rosegold,[0x16,0x16,0x1a]].map(c=>c.join('.')).join(' '),sig:HOOK.asmBarSig({type:'tieclip',primaryColor:'gold'})}});
    ok(dr.n>150&&dr.off<=dr.n*.05&&dr.L>85&&dr.h>=4&&dr.h<25&&dr.shadow>2,`the tie bar is drawn on the tie: ${dr.n} pixels, ${dr.off} past the tie's edge where it folds round, polished metal (its bright streak at lightness ${dr.L.toFixed(0)}), ${dr.h} px tall, and a shadow below it (${dr.shadow.toFixed(1)} L* darker)`);
    ok(dr.metals===dr.want&&/^b\d+[\d.]+$/.test(dr.sig),`a tie clip is drawn in its colour, the metal field ignored (${dr.metals}; ${dr.sig})`);
    // ---- the earlier assembler is gone ----
    const gone=await p.evaluate(()=>({fns:['asmCompose','asmZones','asmParts','asmNeeds','asmPieceJob','asmMasterJob','asmMakeMissing','asmQueueOutfit','asmPending','asmComposeP2','asmP2Set','asmPaint','asmSuitPaint','asmTiePaint','asmAtlasBuild','asmDrift','asmCan'].filter(n=>typeof window[n]!=='undefined'),
      ui:['#asm-status','#asm-btn'].filter(s=>document.querySelector(s)).join(),ver:HOOK.ASM_VER,on:HOOK.ASM_ON}));
    ok(!gone.fns.length&&!gone.ui&&gone.ver===3,`the earlier photo-per-item assembler and the atlas-painting trial are gone, and Settings has no Item photos (left: ${gone.fns.join(', ')||'none'}${gone.ui?'; '+gone.ui:''})`);
    // ---- which picture Today shows for a look painted on a colour-coded master ----
    const t=await p.evaluate(async()=>{let n=0;const I=(type,primaryColor,x={})=>({id:'t'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const o={top:I('suit','navy'),shirt:I('shirt','white'),tie:I('tie','burgundy'),watch:I('watch','silver',{metal:'silver'}),suitDay:true},mk=HOOK.asmCmKey('suit','master');
      const calls=[],f0=window.fetch;window.fetch=async(...a)=>{calls.push(String(a[0]));return new Response('{}',{status:404})};localStorage.setItem('worker_url','https://off.test/');localStorage.setItem('app_token','t');
      const r={};try{
        HOOK.renders[mk]={sig:'asm/cm test',img:'data:image/jpeg;base64,AAAA',model:'colormaster',t:1000};HOOK.renders[HOOK.comboKey(o)]={sig:HOOK.comboSig(o),img:'data:image/jpeg;base64,OWN',model:'gpt',t:500};
        r.kind=HOOK.asmCmUse(o);const k=HOOK.asmOutKey(o);HOOK.asmOut[k]={img:'data:image/jpeg;base64,ASM',stamp:HOOK.asmStamp(o),t:9};
        r.over=HOOK.renderFor(o).img;
        // switched off (ASM_ON false): the outfit's own photo, nothing asked of the worker, Settings hides the group
        HOOK.ASM_ON=false;r.off={wants:HOOK.asmWants(o),for:HOOK.asmFor(o),shown:HOOK.renderFor(o).img};await HOOK.asmEnsure(o);await HOOK.asmSync(true);HOOK.openSettings('photos');HOOK.renderAsmUI();
        r.off.calls=calls.filter(u=>!/\/me$/.test(u)).length;r.off.hidden=document.querySelector('#asm-group').hidden;HOOK.ASM_ON=true;HOOK.renderAsmUI();r.onShown=!document.querySelector('#asm-group').hidden;HOOK.closeSettings&&HOOK.closeSettings();
        // a photo made for this outfit after its master (Settings: Regenerate) wins, and nothing is painted or redrawn for it
        HOOK.renders[HOOK.comboKey(o)]={sig:HOOK.comboSig(o),img:'data:image/jpeg;base64,NEW',model:'gpt',t:2000};r.under=HOOK.renderFor(o).model;
        let made=0,redraws=0;const p0=HOOK.asmPhoto,drew=l=>l.filter(x=>x.addedNodes.length).length,mo=new MutationObserver(l=>{redraws+=drew(l)});mo.observe(HOOK.$('#today'),{childList:true});HOOK.asmPhoto=async x=>{made++;return p0(x)};
        try{HOOK.asmTried.clear();await HOOK.asmEnsure(o);await HOOK.asmEnsure(o)}finally{HOOK.asmPhoto=p0}redraws+=drew(mo.takeRecords());mo.disconnect();r.loop={made,redraws};
        // a look with no colour-coded master: no picture, no job
        const o2={...o,top:null,bot:null};r.none={use:HOOK.asmCmUse(o2),key:HOOK.asmOutKey(o2),job:await HOOK.asmJob(o2)};
        delete HOOK.asmOut[k]}
      finally{window.fetch=f0;localStorage.removeItem('worker_url');localStorage.removeItem('app_token');delete HOOK.renders[mk];delete HOOK.renders[HOOK.comboKey(o)]}
      return r});
    ok(t.kind==='suit'&&t.over==='data:image/jpeg;base64,ASM','Today shows the painted picture (kept on the device) over an older photo of the outfit');
    ok(t.off.wants===false&&t.off.for===null&&t.off.shown==='data:image/jpeg;base64,OWN'&&t.off.calls===0&&t.off.hidden&&t.onShown,`switched off (ASM_ON), Today shows the outfit's own photo, nothing is asked of the worker (${t.off.calls} requests) and Settings hides the group; switched on it shows again`);
    ok(t.under==='gpt'&&t.loop.made===0&&t.loop.redraws===0,`a photo made after the master wins, and nothing is painted or redrawn for that outfit (${JSON.stringify(t.loop)})`);
    ok(t.none.use===null&&t.none.key===''&&t.none.job===null,`a look with no colour-coded master gets no picture, key or job (${JSON.stringify(t.none)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // ---- the worker: a kept photo can be deleted (the edit-a-kept-photo jobs went with the outfit photo, 2026-11-14) ----
    const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
    {const store=new Map(),KV={get:async(q,t)=>store.has(q)?(t==='json'?JSON.parse(store.get(q)):store.get(q)):null,put:async(q,v)=>{store.set(q,v)},delete:async q=>{store.delete(q)}};
      const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV},HOST='https://w.test/',TK='c00000000000a0002';
      const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
      const q=await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({mode:'queue',key:TK,baseKey:'c00000000000a0001',swap:{what:'tie',text:'x'},image:PNG})}),env);
      ok(q.status===410&&!store.size,'an edit-a-kept-photo job is refused (410) and nothing is stored');
      store.set('render:'+TK,JSON.stringify({sig:'x',img:PNG,model:'m',t:1}));
      const del=(key,tok='t')=>worker.fetch(new Request(HOST+'render?key='+key,{method:'DELETE',headers:{'x-app-token':tok}}),env);
      const d1=await del(TK,'wrong'),d3=await del(TK);
      ok(d1.status===405&&d3.status===405&&store.has('render:'+TK),'DELETE /render is gone (405 with or without the app token, CR-6-14: nothing asked for it): a kept photo stays');}
  }finally{globalThis.fetch=realFetch;await browser.close()}
};

module.exports.assembled=true;   // tests assembled pictures (assemble.js); other tests run with them switched off (ASM_TEST_OFF)
