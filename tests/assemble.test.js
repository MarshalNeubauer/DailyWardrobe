// Assembled outfit photos (assemble.js): one master photo fixes the pose, every item has one photo that is the master with only that
// piece changed, and an outfit's picture is put together on the device by copying pieces onto the master. The fixtures are the real
// trial photos (tests/fixtures/asm-*.jpg, as the app keeps them: 900px): the master (grey suit, white shirt, green tie, the owner's
// watch) and six one-piece edits of it. The worker side (master and piece jobs through the queue) runs with mocked KV, queue and OpenAI.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- zones and assembling, on the real photos ----
    const r=await p.evaluate(async()=>{const F=n=>asmData('tests/fixtures/asm-'+n+'.jpg');
      const master=await F('master'),X={jacket:await F('jacket'),tie:await F('tie'),bar:await F('bar'),pink:await F('shirt-pink'),black:await F('shirt-black'),watch:await F('watch')};
      const z=asmZones(master,{jacket:X.jacket,shirt:X.black,tie:X.tie,watch:X.watch}),W=z.W,N=W*W,share=s=>100*asmCount(z[s])/N;
      let overlap=0;for(let i=0;i<N;i++)if(z.jacket[i]+z.shirt[i]+z.tie[i]+z.watch[i]>1)overlap++;
      const back=asmUnpackZones(JSON.parse(JSON.stringify(asmPackZones(z))));let same=back.W===W;for(const s of ['jacket','shirt','tie','watch'])for(let i=0;i<N&&same;i++)if(back[s][i]!==z[s][i])same=false;
      const none=asmZones(master,{jacket:master,shirt:master,tie:master,watch:master});
      const Lm=asmLab(master),stat=(L,m,f)=>{let s=0,n=0;for(let i=0;i<N;i++)if(m[i]){n++;s+=f(L[3*i],L[3*i+1],L[3*i+2])}return n?s/n:0};
      // A: the windowpane jacket, the black shirt, the striped tie and a tie bar; the watch stays the master's
      const ia={},A=asmCompose(master,z,{jacket:X.jacket,shirt:X.black,tie:X.tie,bar:X.bar},ia),La=asmLab(A);
      let moved=0,watchKept=1;for(let i=0;i<N;i++){if(!ia.lab[i]&&!ia.seam[i]&&(A.data[4*i]!==master.data[4*i]||A.data[4*i+1]!==master.data[4*i+1]||A.data[4*i+2]!==master.data[4*i+2]))moved++;if(z.watch[i]&&ia.lab[i])watchKept=0}
      const core=asmBox(z.tie,W,3,false),wide=asmBox(z.tie,W,3,true);let inCore=1,inWide=1;for(let i=0;i<N;i++){if(core[i]&&!ia.tie[i])inCore=0;if(ia.tie[i]&&!wide[i])inWide=0}
      const ring=asmBox(ia.tie,W,4,true);let rimN=0,rimPale=0;for(let i=0;i<N;i++)if(ring[i]&&!ia.tie[i]&&ia.lab[i]===2){rimN++;if(La[3*i]>55)rimPale++}
      const a={moved,watchKept,inCore,inWide,rimN,rimPale:100*rimPale/Math.max(1,rimN),green:100*stat(La,z.tie,(l,x,b)=>x<-12?1:0),greenMaster:100*stat(Lm,z.tie,(l,x,b)=>x<-12?1:0),
        jacketB:stat(La,z.jacket,(l,x,b)=>b),jacketBMaster:stat(Lm,z.jacket,(l,x,b)=>b),shirtL:stat(La,asmBox(z.shirt,W,2,false),l=>l),bar:asmCount(ia.bar||[]),barL:ia.bar?stat(La,asmBox(ia.bar,W,1,false),l=>l):0};
      // B: the same with the pink shirt and another watch (smaller, on a strap: it uncovers a little of the cuff)
      const ib={},B=asmCompose(master,z,{jacket:X.jacket,shirt:X.pink,tie:X.tie,bar:X.bar,watch:X.watch},ib),Lb=asmLab(B);
      const b={watch:asmCount(ib.watch),dark:100*stat(Lb,ib.watch,l=>l<25?1:0),darkMaster:100*stat(Lm,ib.watch,l=>l<25?1:0),tinted:ib.tinted,white:100*stat(Lb,ib.watch,(l,x,y)=>l>88&&Math.hypot(x,y)<6?1:0),shirtA:stat(Lb,asmBox(z.shirt,W,2,false),(l,x)=>x)};
      // nothing but a tie: everything else stays as the master shows it
      const ic={};asmCompose(master,z,{tie:X.tie},ic);let onlyTie=1;for(let i=0;i<N;i++)if(ic.lab[i]&&ic.lab[i]!==3)onlyTie=0;
      return {W,shares:['jacket','shirt','tie','watch'].map(share),overlap,ok:asmZonesOk(z),same,noneOk:asmZonesOk(none),a,b,onlyTie}});
    const [zj,zs,zt,zw]=r.shares;
    ok(r.W===900&&r.ok&&zj>45&&zj<70&&zs>2&&zs<7&&zt>1&&zt<4&&zw>.3&&zw<1.2&&r.overlap===0,`the four zones are found from the calibration photos, each of a sensible size and none overlapping (jacket ${zj.toFixed(1)}%, shirt ${zs.toFixed(1)}%, tie ${zt.toFixed(1)}%, watch ${zw.toFixed(2)}%)`);
    ok(r.same,'zones survive being packed for storage and unpacked');
    ok(!r.noneOk,'calibration photos that changed nothing give zones that are refused');
    ok(r.a.moved===0&&r.a.watchKept===1,`outside the pieces the picture is the master, pixel for pixel, and the owner's watch stays the master's own (${r.a.moved} pixels differ)`);
    ok(r.a.jacketBMaster<4&&r.a.jacketB>8,`the jacket is the khaki one, not the master's grey (yellowness ${r.a.jacketBMaster.toFixed(1)} -> ${r.a.jacketB.toFixed(1)})`);
    ok(r.a.shirtL<35,`the shirt is black in the collar, chest and cuffs (lightness ${r.a.shirtL.toFixed(0)})`);
    ok(r.a.inCore&&r.a.inWide&&r.a.greenMaster>50&&r.a.green<2,`the tie is pasted within a few pixels of the master's and none of the green master tie is left (${r.a.green.toFixed(1)}% green, was ${r.a.greenMaster.toFixed(0)}%)`);
    ok(r.a.rimN>300&&r.a.rimPale<3,`a tie made over the white master shirt has no pale rim on the black shirt (${r.a.rimPale.toFixed(1)}% of ${r.a.rimN} pixels beside it are pale)`);
    ok(r.a.bar>150&&r.a.bar<1500&&r.a.barL>60,`the tie bar is found in its photo and laid on the tie (${r.a.bar} pixels, lightness ${r.a.barL.toFixed(0)})`);
    ok(r.b.watch>2500&&r.b.watch<9000&&r.b.dark>30&&r.b.darkMaster<15,`another watch replaces the master's (dark strap and dial: ${r.b.dark.toFixed(0)}% dark, was ${r.b.darkMaster.toFixed(0)}%)`);
    ok(r.b.shirtA>4&&r.b.tinted>0&&r.b.white<1.5,`the shirt is pink, and the bit of cuff the smaller watch uncovers is tinted to it, not left white (${r.b.tinted} pixels tinted, ${r.b.white.toFixed(2)}% white)`);
    ok(r.onlyTie===1,'a piece that is left out stays as the master shows it');
    // ---- keys, what an outfit needs, and the picture from the kept photos ----
    const k=await p.evaluate(async()=>{const url=async n=>{const d=await asmData('tests/fixtures/asm-'+n+'.jpg'),c=document.createElement('canvas');c.width=c.height=d.width;c.getContext('2d').putImageData(d,0,0);return c.toDataURL('image/jpeg',.9)};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const watch=I('watch','silver',{metal:'silver'}),jk=I('blazer','khaki',{pattern:'windowpane'}),black=I('shirt','black'),black2=I('shirt','black'),white=I('shirt','white'),tie=I('tie','navy',{pattern:'stripe',secondaryColor:'pink'}),tie2=I('tie','burgundy'),clip=I('tieclip','silver',{metal:'silver'}),gold=I('watch','gold',{metal:'gold'});
      items=[watch,jk,black,black2,white,tie,tie2,clip,gold];
      const o={top:jk,shirt:black,tie,clip,watch,suitDay:false};
      const out={before:asmParts(o).map(x=>x.slot).join(),keysDiffer:asmPieceKey('tie',tie)!==asmPieceKey('tie',tie2)&&asmPieceKey('jacket',jk)!==asmMasterKey(),sameShirt:asmPieceKey('shirt',black)===asmPieceKey('shirt',black2),
        keyShape:/^c[0-9a-f]{16}$/.test(asmPieceKey('tie',tie))&&/^c[0-9a-f]{16}$/.test(asmMasterKey())&&/^c[0-9a-f]{16}$/.test(asmCalibKey('tie')),
        can:[asmCan(o),asmCan({...o,vest:true}),asmCan({...o,tie:null}),asmCan({...o,top:null}),asmCan({...o,watch:null})].join()};
      // the master was made with this watch and a white shirt: neither needs a piece
      localStorage.setItem('asm_master',JSON.stringify({key:asmMasterKey(),watch:lookSig('watch',watch),shirt:lookSig('shirt',asmMasterItem('shirt','white'))}));
      out.parts=asmParts(o).map(x=>x.slot).join();out.partsWhite=asmParts({...o,shirt:white}).map(x=>x.slot).join();out.partsGold=asmParts({...o,watch:gold}).map(x=>x.slot).join();
      out.noMaster=await asmPhoto(o);
      const put=async(key,f)=>{renders[key]={sig:'',img:await url(f),model:'',t:1}};
      await put(asmMasterKey(),'master');out.noPieces=await asmPhoto(o);
      await put(asmPieceKey('jacket',jk),'jacket');await put(asmPieceKey('shirt',black),'shirt-black');await put(asmPieceKey('tie',tie),'tie');await put(asmPieceKey('bar',clip),'bar');
      out.noZones=await asmPhoto(o);
      await put(asmCalibKey('jacket'),'jacket');await put(asmCalibKey('shirt'),'shirt-black');await put(asmCalibKey('tie'),'tie');await put(asmCalibKey('watch'),'watch');
      const u=await asmPhoto(o);out.made=typeof u==='string'&&/^data:image\/jpeg;base64,/.test(u)&&u.length>40000;out.again=(await asmPhoto(o))===u;
      out.zonesKept=!!(await metaGet('asm:zones:'+asmMasterKey()));
      // the picture is the outfit: dark shirt, khaki jacket
      const d=await asmData(u),L=asmLab(d),z=asmUnpackZones(await metaGet('asm:zones:'+asmMasterKey())),W=z.W;let sl=0,sn=0,jb=0,jn=0;const sh=asmBox(z.shirt,W,2,false);
      for(let i=0;i<W*W;i++){if(sh[i]){sn++;sl+=L[3*i]}if(z.jacket[i]){jn++;jb+=L[3*i+2]}}out.shirtL=sl/sn;out.jacketB=jb/jn;
      out.gold=await asmPhoto({...o,watch:gold});out.vest=await asmPhoto({...o,vest:true});
      // the jobs a later step sends
      const mj=await asmMasterJob(),cj=asmCalibJob('tie'),tj=await asmPieceJob('tie',{...tie,photo:await url('tie')}),bj=await asmPieceJob('bar',clip),sj=await asmPieceJob('shirt',{...black,photo:await url('shirt-black')}),jj=await asmPieceJob('jacket',{...jk,photo:await url('jacket')}),wj=await asmPieceJob('watch',{...gold,photo:await url('watch')});
      out.jobs={mj:{...mj,image:mj.image.slice(0,30)},cj,tj:{...tj,refs:tj.refs.length},bj,sj:{...sj,refs:sj.refs.length},jj:{...jj,refs:jj.refs.length},wj:{...wj,refs:wj.refs.length}};out.masterUrl=await url('master');out.tieJob=tj;return out});
    ok(k.keyShape&&k.keysDiffer&&k.sameShirt,'the master, calibration and piece photos have their own photo keys; two plain shirts of one colour share a piece');
    ok(k.can==='true,false,false,false,false','an outfit can be assembled when it has a jacket, shirt, tie and watch and no vest');
    ok(k.before==='jacket,shirt,tie,bar,watch'&&k.parts==='jacket,shirt,tie,bar'&&k.partsWhite==='jacket,tie,bar'&&k.partsGold==='jacket,shirt,tie,bar,watch',`an outfit needs a piece per jacket, shirt, tie and tie bar; the master's own watch and a white shirt need none (${k.parts}; ${k.partsWhite}; ${k.partsGold})`);
    ok(k.noMaster===null&&k.noPieces===null&&k.noZones===null,'no picture without the master, with a piece missing, or before the calibration photos are there');
    ok(k.made&&k.again&&k.zonesKept&&k.shirtL<38&&k.jacketB>8,`with everything kept on the device the outfit's picture is made, remembered, and its zones stored (shirt lightness ${k.shirtL.toFixed(0)}, jacket yellowness ${k.jacketB.toFixed(1)})`);
    ok(k.gold===null&&k.vest===null,'an outfit whose watch has no piece yet, or with a vest, gets no assembled picture (it keeps its own photo)');
    const J=k.jobs;
    ok(J.mj.mode==='queue'&&J.mj.master===true&&J.mj.quality==='high'&&/^data:image\/png/.test(J.mj.image)&&/mid grey suit/.test(J.mj.outfit)&&/green tie/.test(J.mj.outfit)&&/plain white dress shirt/.test(J.mj.outfit),'the master job is a normal outfit photo of the placeholder clothes, marked as the master, at high quality');
    ok(J.cj.baseKey===J.mj.key&&J.cj.swap.what==='tie'&&/magenta/.test(J.cj.swap.text)&&J.tj.baseKey===J.mj.key&&J.tj.swap.what==='tie'&&/navy & pink stripe tie/.test(J.tj.swap.text)&&J.tj.refs===1,'calibration and piece jobs edit the kept master (by its key) and swap one piece, with the item\'s own photo');
    ok(J.bj.swap.what==='tie bar'&&J.bj.swap.add===true&&/silver tie bar/.test(J.bj.swap.text)&&J.sj.swap.what==='shirt'&&J.sj.refs===1&&/plain black dress shirt/.test(J.sj.swap.text)&&J.jj.swap.what==='jacket'&&J.jj.refs===1&&J.wj.swap.what==='watch'&&J.wj.refs===1,'a tie bar is added, and a shirt, jacket or watch swapped, each from its own photo');
    // ---- the worker: master and piece jobs through the queue ----
    const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
    const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const realFetch=globalThis.fetch;let got=[];
    globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});const f=init.body,im=f.getAll('image[]');
      got.push({prompt:f.get('prompt'),quality:f.get('quality'),n:im.length,first:im[0].type,firstSize:im[0].size});return new Response(JSON.stringify({data:[{b64_json:JPG}],usage:{output_tokens:1}}),{status:200,headers:{'content-type':'application/json'}})};
    try{
      const store=new Map(),KV={get:async(q,t)=>store.has(q)?(t==='json'?JSON.parse(store.get(q)):store.get(q)):null,put:async(q,v)=>{store.set(q,v)},delete:async q=>{store.delete(q)}};
      let sent=[];const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:{send:async m=>{sent.push(m)}}},HOST='https://w.test/';
      const post=b=>worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify(b)}),env);
      const drain=async()=>{const out=[];for(const body of sent.splice(0)){const m={body,attempts:body._a||1,acked:false,retried:null,ack(){this.acked=true},retry(o){this.retried=o}};await worker.queue({messages:[m]},env);out.push(m)}return out};
      const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
      // a piece queued before its master is there waits (retries) instead of failing
      let q=await post(k.tieJob);ok(q.status===200&&(await q.json()).queued,'a piece job with no image of its own is accepted when it names the photo to edit');
      let ms=await drain();ok(ms[0].retried&&ms[0].retried.delaySeconds===60&&got.length===0,'while the master is not kept yet, the piece waits and tries again');
      // the master
      q=await post({...J.mj,image:PNG,refs:[],labels:[]});ms=await drain();const mk=J.mj.key;
      ok(ms[0].acked&&store.has('render:'+mk)&&got[0].quality==='high'&&/^Turn the first image/.test(got[0].prompt)&&/plain reference photo/.test(got[0].prompt)&&/No tie bar/.test(got[0].prompt),'the master is made at high quality with the plain-reference note and kept under its key');
      store.set('render:'+mk,JSON.stringify({sig:'asm/master',img:k.masterUrl,model:'m',t:1}));
      // the piece, now that the master is kept: the worker edits the kept photo
      got=[];await post({...k.tieJob,replace:true});ms=await drain();
      ok(ms[0].acked&&store.has('render:'+k.tieJob.key)&&got[0].n===2&&got[0].first==='image/jpeg'&&got[0].firstSize>20000&&/^Edit the first image/.test(got[0].prompt)&&/Replace only the tie with: a navy & pink stripe tie/.test(got[0].prompt),'the piece is an edit of the kept master: the master first, then the item\'s photo, and only the tie replaced');
      got=[];await post(J.bj);ms=await drain();
      ok(ms[0].acked&&/Add one thing only: a slim silver tie bar/.test(got[0].prompt)&&!/Replace only/.test(got[0].prompt)&&/must stay exactly[^\n]*the tie, its knot and its pattern/.test(got[0].prompt),'the tie bar is added to the master, with everything else kept');
      q=await post({mode:'queue',key:'c0000000000000001',swap:{what:'tie',text:'x'}});ok(q.status===400,'a job with neither an image nor a photo to edit is refused');
    }finally{globalThis.fetch=realFetch}
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
