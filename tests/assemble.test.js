// Assembled pictures, the parts of assemble.js around the colour-coded painter (asm-color.js, tested in asmcolor.test.js): the drawn tie
// bar, the ASM_ON switch, which picture Today shows for a painted look, that the earlier photo-per-item assembler is gone (2026-11-14), and
// the worker's edit-a-kept-photo jobs (worker.js still accepts them; nothing in the app sends them any more).
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch(),realFetch=globalThis.fetch;
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- the tie bar, drawn (asmBarDraw: the painter draws a tie clip with it) ----
    const dr=await p.evaluate(()=>{const W=1024,N=W*W,tie=new Uint8Array(N),o=new Uint8ClampedArray(4*N);
      for(let y=200;y<900;y++){const half=40+(y-200)*.03,cx=500+(y-200)*.02;for(let x=Math.round(cx-half);x<=Math.round(cx+half);x++)tie[y*W+x]=1}   // a tie, widening and leaning a little
      for(let i=0;i<N;i++){const v=tie[i]?60:200;o[4*i]=o[4*i+1]=v;o[4*i+2]=tie[i]?110:200;o[4*i+3]=255}const before=new Uint8ClampedArray(o);
      const m=asmBarDraw(o,tie,W,'silver',null),L=asmLab(new ImageData(o,W,W)),L0=asmLab(new ImageData(before,W,W));let n=0,off=0,Lmax=0,y0=W,y1=0;
      for(let i=0;i<N;i++)if(m&&m[i]){n++;if(!tie[i])off++;Lmax=Math.max(Lmax,L[3*i]);const y=(i/W)|0;y0=Math.min(y0,y);y1=Math.max(y1,y)}
      let sh=0,sn=0;if(n){const y=y1+2;for(let x=0;x<W;x++){const i=y*W+x;if(tie[i]&&!m[i]){sn++;sh+=L0[3*i]-L[3*i]}}}
      const metals=[{type:'tieclip',primaryColor:'silver',metal:'other'},{type:'tieclip',primaryColor:'rosegold'},{type:'tieclip',primaryColor:'black',metal:'gold'}].map(c=>asmBarRgb(c).join('.')).join(' ');
      return {n,off,L:Lmax,h:y1-y0+1,shadow:sn?sh/sn:0,metals,want:[ASM_METAL.silver,ASM_METAL.rosegold,[0x16,0x16,0x1a]].map(c=>c.join('.')).join(' '),sig:asmBarSig({type:'tieclip',primaryColor:'gold'})}});
    ok(dr.n>150&&dr.off<=dr.n*.05&&dr.L>85&&dr.h>=4&&dr.h<25&&dr.shadow>2,`the tie bar is drawn on the tie: ${dr.n} pixels, ${dr.off} past the tie's edge where it folds round, polished metal (its bright streak at lightness ${dr.L.toFixed(0)}), ${dr.h} px tall, and a shadow below it (${dr.shadow.toFixed(1)} L* darker)`);
    ok(dr.metals===dr.want&&/^b\d+[\d.]+$/.test(dr.sig),`a tie clip is drawn in its colour, the metal field ignored (${dr.metals}; ${dr.sig})`);
    // ---- the earlier assembler is gone ----
    const gone=await p.evaluate(()=>({fns:['asmCompose','asmZones','asmParts','asmNeeds','asmPieceJob','asmMasterJob','asmMakeMissing','asmQueueOutfit','asmPending','asmComposeP2','asmP2Set','asmPaint','asmSuitPaint','asmTiePaint','asmAtlasBuild','asmDrift','asmCan'].filter(n=>typeof window[n]!=='undefined'),
      ui:['#asm-status','#asm-btn'].filter(s=>document.querySelector(s)).join(),ver:ASM_VER,on:ASM_ON}));
    ok(!gone.fns.length&&!gone.ui&&gone.ver===3,`the earlier photo-per-item assembler and the atlas-painting trial are gone, and Settings has no Item photos (left: ${gone.fns.join(', ')||'none'}${gone.ui?'; '+gone.ui:''})`);
    // ---- which picture Today shows for a look painted on a colour-coded master ----
    const t=await p.evaluate(async()=>{let n=0;const I=(type,primaryColor,x={})=>({id:'t'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const o={top:I('suit','navy'),shirt:I('shirt','white'),tie:I('tie','burgundy'),watch:I('watch','silver',{metal:'silver'}),suitDay:true},mk=asmCmKey('suit','master');
      const calls=[],f0=window.fetch;window.fetch=async(...a)=>{calls.push(String(a[0]));return new Response('{}',{status:404})};localStorage.setItem('worker_url','https://off.test/');localStorage.setItem('app_token','t');
      const r={};try{
        renders[mk]={sig:'asm/cm test',img:'data:image/jpeg;base64,AAAA',model:'colormaster',t:1000};renders[comboKey(o)]={sig:comboSig(o),img:'data:image/jpeg;base64,OWN',model:'gpt',t:500};
        r.kind=asmCmUse(o);const k=asmOutKey(o);asmOut[k]={img:'data:image/jpeg;base64,ASM',stamp:asmStamp(o),t:9};
        r.over=renderFor(o).img;r.sig=asmPreSig(o);
        // switched off (ASM_ON false): the outfit's own photo, nothing asked of the worker, Settings hides the group
        ASM_ON=false;r.off={wants:asmWants(o),for:asmFor(o),shown:renderFor(o).img};await asmEnsure(o);await asmSync(true);openSettings('photos');renderAsmUI();
        r.off.calls=calls.filter(u=>!/\/me$/.test(u)).length;r.off.hidden=document.querySelector('#asm-group').hidden;ASM_ON=true;renderAsmUI();r.onShown=!document.querySelector('#asm-group').hidden;closeSettings&&closeSettings();
        // a photo made for this outfit after its master (Settings: Regenerate) wins, and nothing is painted or redrawn for it
        renders[comboKey(o)]={sig:comboSig(o),img:'data:image/jpeg;base64,NEW',model:'gpt',t:2000};r.under=renderFor(o).model;
        let made=0,redraws=0;const p0=asmPhoto,r0=refreshToday;asmPhoto=async x=>{made++;return p0(x)};refreshToday=()=>{redraws++};
        try{asmTried.clear();await asmEnsure(o);await asmEnsure(o)}finally{asmPhoto=p0;refreshToday=r0}r.loop={made,redraws};
        // a look with no colour-coded master: no picture, no job
        const o2={...o,top:null,bot:null};r.none={use:asmCmUse(o2),key:asmOutKey(o2),job:await asmJob(o2),pre:await asmPrebuildOne(o2)};
        delete asmOut[k]}
      finally{window.fetch=f0;localStorage.removeItem('worker_url');localStorage.removeItem('app_token');delete renders[mk];delete renders[comboKey(o)]}
      return r});
    ok(t.kind==='suit'&&t.over==='data:image/jpeg;base64,ASM'&&/^asm\/out\/cm\d+\/\d+$/.test(t.sig),`Today shows the painted picture (kept on the device) over an older photo of the outfit; the computer's pictures are signed with the masters' version (${t.sig})`);
    ok(t.off.wants===false&&t.off.for===null&&t.off.shown==='data:image/jpeg;base64,OWN'&&t.off.calls===0&&t.off.hidden&&t.onShown,`switched off (ASM_ON), Today shows the outfit's own photo, nothing is asked of the worker (${t.off.calls} requests) and Settings hides the group; switched on it shows again`);
    ok(t.under==='gpt'&&t.loop.made===0&&t.loop.redraws===0,`a photo made after the master wins, and nothing is painted or redrawn for that outfit (${JSON.stringify(t.loop)})`);
    ok(t.none.use===null&&t.none.key===''&&t.none.job===null&&t.none.pre===null,`a look with no colour-coded master gets no picture, key or job (${JSON.stringify(t.none)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // ---- the worker: an edit of a photo it keeps (baseKey + swap), through the queue ----
    const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
    const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const fx=n=>'data:image/jpeg;base64,'+fs.readFileSync(path.join(ROOT,'tests/fixtures/asm-'+n+'.jpg')).toString('base64');
    let got=[];
    globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});const f=init.body,im=f.getAll('image[]');
      got.push({prompt:f.get('prompt'),quality:f.get('quality'),n:im.length,first:im[0].type,firstSize:im[0].size});return new Response(JSON.stringify({data:[{b64_json:JPG}],usage:{output_tokens:1}}),{status:200,headers:{'content-type':'application/json'}})};
    try{
      const store=new Map(),KV={get:async(q,t)=>store.has(q)?(t==='json'?JSON.parse(store.get(q)):store.get(q)):null,put:async(q,v)=>{store.set(q,v)},delete:async q=>{store.delete(q)}};
      let sent=[];const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:{send:async m=>{sent.push(m)}}},HOST='https://w.test/';
      const post=b=>worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify(b)}),env);
      const drain=async()=>{const out=[];for(const body of sent.splice(0)){const m={body,attempts:body._a||1,acked:false,retried:null,ack(){this.acked=true},retry(o){this.retried=o}};await worker.queue({messages:[m]},env);out.push(m)}return out};
      const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC',SZ='2048x2048';
      const MK='c00000000000a0001',TK='c00000000000a0002',BK='c00000000000a0003',VK='c00000000000a0004',VCK='c00000000000a0005';
      const mj={mode:'queue',key:MK,image:PNG,refs:[],labels:[],outfit:'a plain mid grey suit, a plain white dress shirt, a green tie',sig:'asm/master {}',master:true,quality:'high',size:SZ};
      const tj={mode:'queue',key:TK,baseKey:MK,swap:{what:'tie',text:'a navy & pink stripe tie'},refs:[fx('tie')],labels:['the tie'],sig:'asm/piece/tie/x',size:SZ};
      const bj={mode:'queue',key:BK,baseKey:MK,swap:{what:'tie bar',text:'a slim silver tie bar, clipped horizontally across the tie',add:true},refs:[],labels:[],sig:'asm/piece/bar/x',size:SZ};
      const vj={mode:'queue',key:VK,baseKey:MK,refs:[],labels:[],sig:'asm/master/vest',quality:'high',size:SZ,swap:{what:'waistcoat',add:true,text:'a matching waistcoat (vest) in exactly the same cloth as the suit jacket, worn under the jacket and buttoned'}};
      const vcj={mode:'queue',key:VCK,baseKey:VK,swap:{what:'waistcoat',text:'a waistcoat of exactly the same cut and buttons in a solid, flat, bright pure orange cloth with no pattern or texture'},refs:[],labels:[],sig:'asm/calib/vest',size:SZ};
      // a job that edits a photo the worker doesn't keep yet waits (retries) instead of failing
      let q=await post(tj);ok(q.status===200&&(await q.json()).queued,'a job with no image of its own is accepted when it names the kept photo to edit');
      let ms=await drain();ok(ms[0].retried&&ms[0].retried.delaySeconds===60&&got.length===0,'while the photo to edit is not kept yet, the job waits and tries again');
      q=await post(mj);ms=await drain();
      ok(ms[0].acked&&store.has('render:'+MK)&&got[0].quality==='high'&&/^Turn the first image/.test(got[0].prompt)&&/reference photo that other photos are edited from/.test(got[0].prompt)&&/No waistcoat, tie bar/.test(got[0].prompt),'a reference photo (master: true) is made at high quality with the reference note and kept under its key');
      store.set('render:'+MK,JSON.stringify({sig:'asm/master',img:fx('master'),model:'m',t:1}));
      got=[];await post({...tj,replace:true});ms=await drain();
      ok(ms[0].acked&&store.has('render:'+TK)&&got[0].n===2&&got[0].first==='image/jpeg'&&got[0].firstSize>20000&&/^Edit the first image/.test(got[0].prompt)&&/Replace only the tie with: a navy & pink stripe tie/.test(got[0].prompt),'an edit of the kept photo: that photo first, then the item\'s photo, and only the tie replaced');
      got=[];await post(bj);ms=await drain();
      ok(ms[0].acked&&/Add one thing only: a slim silver tie bar/.test(got[0].prompt)&&!/Replace only/.test(got[0].prompt)&&/must stay exactly[^\n]*the tie, its knot and its pattern/.test(got[0].prompt),'an added piece (swap.add) is added with everything else kept');
      got=[];await post(vj);await drain();const p1=got[0]&&got[0].prompt;store.set('render:'+VK,JSON.stringify({sig:'',img:fx('master'),model:'m',t:1}));got=[];await post(vcj);await drain();
      ok(/Add one thing only: a matching waistcoat \(vest\) in exactly the same cloth as the suit jacket/.test(p1)&&/Replace only the waistcoat with: a waistcoat of exactly the same cut[^\n]*orange/.test(got[0].prompt)&&/must stay exactly[^\n]*the jacket and its pattern/.test(got[0].prompt),'a waistcoat is added, or swapped alone');
      q=await post({mode:'queue',key:'c0000000000000001',swap:{what:'tie',text:'x'}});ok(q.status===400,'a job with neither an image nor a photo to edit is refused');
      const del=(key,tok='t')=>worker.fetch(new Request(HOST+'render?key='+key,{method:'DELETE',headers:{'x-app-token':tok}}),env);
      const d0=store.has('render:'+TK),d1=await del(TK,'wrong'),d2=await del('not-a-key'),d3=await del(TK);
      ok(d0&&d1.status===403&&d2.status===400&&d3.status===200&&!store.has('render:'+TK),'DELETE /render?key= removes a kept photo, with the app token and a photo key only');
    }finally{globalThis.fetch=realFetch}
  }finally{globalThis.fetch=realFetch;await browser.close()}
};

module.exports.assembled=true;   // tests assembled pictures (assemble.js); other tests run with them switched off (ASM_TEST_OFF)
