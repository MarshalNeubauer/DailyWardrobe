// Assembled outfit photos (assemble.js): one master photo fixes the pose, every item has one photo that is the master with only that
// piece changed, and an outfit's picture is put together on the device by copying pieces onto the master. The fixtures are the real
// trial photos (tests/fixtures/asm-*.jpg, as the app keeps them: 900px): the master (grey suit, white shirt, green tie, the owner's
// watch) and six one-piece edits of it. The worker side (master and piece jobs through the queue) runs with mocked KV, queue and OpenAI.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch(),realFetchAll=globalThis.fetch;
  let worker;
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
      // the jacket's edge ring: just outside its zone, from the jacket's photo, never on another piece, and only where the master shows its own jacket's colour (never skin)
      const near=asmBox(z.jacket,W,ASM_EDGE,true),tieNear=asmBox(z.tie,W,ASM_HALO,true);let ringN=0,ringOk=1,ringSeam=0;for(let i=0;i<N;i++)if(ia.lab[i]===7){ringN++;const x=i%W;
        if(!near[i]||z.jacket[i]||z.shirt[i]||z.tie[i]||z.watch[i])ringOk=0;
        const out=[x?i-1:-1,x<W-1?i+1:-1,i-W,i+W].filter(j=>j>=0&&j<N),lone=out.every(j=>ia.lab[j]===7||ia.lab[j]===0||ia.lab[j]===1);
        if(Lm[3*i+1]>13&&Lm[3*i+2]>16&&Lm[3*i]>55)ringSeam++;   // a clear skin pixel of the master (reddish, yellowish, light)
        if(lone&&!ia.seam[i]&&!tieNear[i]){if(A.data[4*i]!==X.jacket.data[4*i]||A.data[4*i+1]!==X.jacket.data[4*i+1]||A.data[4*i+2]!==X.jacket.data[4*i+2])ringOk=0}}
      // the halo: beside the new tie, on the black shirt, nothing of the master's green tie is left
      const hb=asmBox(ia.tie,W,ASM_HALO,true);let haloN=0,haloGreen=0;for(let i=0;i<N;i++)if(hb[i]&&!ia.tie[i]&&z.shirt[i]){haloN++;if(La[3*i+1]<-8)haloGreen++}
      // the tie's outline: its left edge moves at most a pixel from one row to the next (it was ragged, each pixel decided by itself),
      // and along it nothing is rebuilt as a join: the edge pixels are the tie's clean colour over the shirt's, in the mask's share
      let jump=0,rows=0,edgeSeam=0,edgeN=0,prevX=-1;for(let y=0;y<W;y++){let x0=-1;for(let x=0;x<W;x++)if(ia.tie[y*W+x]){x0=x;break}if(x0<0){prevX=-1;continue}if(prevX>=0){rows++;if(Math.abs(x0-prevX)>1)jump++}prevX=x0}
      {const o1=asmBox(ia.tie,W,1,true),i1=asmBox(ia.tie,W,1,false);for(let i=0;i<N;i++)if(o1[i]&&!i1[i]&&z.shirt[i]){edgeN++;if(ia.seam[i])edgeSeam++}}
      const core=asmBox(z.tie,W,3,false),wide=asmBox(z.tie,W,3,true);let inCore=1,inWide=1;for(let i=0;i<N;i++){if(core[i]&&!ia.tie[i])inCore=0;if(ia.tie[i]&&!wide[i])inWide=0}
      const ring=asmBox(ia.tie,W,4,true);let rimN=0,rimPale=0;for(let i=0;i<N;i++)if(ring[i]&&!ia.tie[i]&&ia.lab[i]===2){rimN++;if(La[3*i]>55)rimPale++}
      const a={jump,rows,edgeSeam,edgeN,haloN,haloGreen,ringN,ringOk,ringSeam,moved,watchKept,inCore,inWide,rimN,rimPale:100*rimPale/Math.max(1,rimN),green:100*stat(La,z.tie,(l,x,b)=>x<-12?1:0),greenMaster:100*stat(Lm,z.tie,(l,x,b)=>x<-12?1:0),
        jacketB:stat(La,z.jacket,(l,x,b)=>b),jacketBMaster:stat(Lm,z.jacket,(l,x,b)=>b),shirtL:stat(La,asmBox(z.shirt,W,2,false),l=>l),bar:asmCount(ia.bar||[]),barL:ia.bar?stat(La,asmBox(ia.bar,W,1,false),l=>l):0};
      // B: the same with the pink shirt and another watch (smaller, on a strap: it uncovers a little of the cuff)
      const ib={},B=asmCompose(master,z,{jacket:X.jacket,shirt:X.pink,tie:X.tie,bar:X.bar,watch:X.watch},ib),Lb=asmLab(B);
      const b={watch:asmCount(ib.watch),dark:100*stat(Lb,ib.watch,l=>l<25?1:0),darkMaster:100*stat(Lm,ib.watch,l=>l<25?1:0),tinted:ib.tinted,white:100*stat(Lb,ib.watch,(l,x,y)=>l>88&&Math.hypot(x,y)<6?1:0),shirtA:stat(Lb,asmBox(z.shirt,W,2,false),(l,x)=>x)};
      // nothing but a tie: everything else stays as the master shows it
      const ic={};asmCompose(master,z,{tie:X.tie},ic);let onlyTie=1;for(let i=0;i<N;i++)if(ic.lab[i]&&ic.lab[i]!==3&&ic.lab[i]!==6)onlyTie=0;   // 6: where the new tie is narrower, filled from beside it
      // a vest day: the suit's piece is an edit of the vest master (the master with a waistcoat); the waistcoat's zone comes from its calibration photo
      const vm=await F('vestmaster'),vc=await F('vestcalib'),vs=await F('vest-suit'),V=asmVestZone(vm,vc,z),iv={},D=asmCompose(master,z,{jacket:vs,shirt:X.black,tie:X.tie,bar:X.bar,vest:V},iv),Ld=asmLab(D),Vin=asmBox(V,W,5,false);
      let vOff=0,tieIn=0,vn=0;for(let i=0;i<N;i++){if(Vin[i]){vn++;if(!iv.seam[i]&&(D.data[4*i]!==vs.data[4*i]||D.data[4*i+1]!==vs.data[4*i+1]||D.data[4*i+2]!==vs.data[4*i+2]))vOff++;if(iv.lab[i]===3)tieIn++}}
      const v={share:100*asmCount(V)/N,vOff,tieIn,vn,tie:asmCount(iv.tie),tieNoVest:asmCount(ia.tie),bar:iv.bar,green:100*stat(Ld,z.tie,(l,x)=>x<-12?1:0),jacketB:stat(Ld,z.jacket,(l,x,b)=>b),drift:asmDrift(master,z,'jacket',vs,V),driftNoV:asmDrift(master,z,'jacket',vs)};
      return {W,shares:['jacket','shirt','tie','watch'].map(share),overlap,ok:asmZonesOk(z),same,noneOk:asmZonesOk(none),a,b,onlyTie,v}});
    ok(r.v.share>2.5&&r.v.share<8&&r.v.vn>8000&&r.v.vOff<r.v.vn*.03&&r.v.tieIn===0,`the waistcoat's zone is found from its calibration photo (${r.v.share.toFixed(1)}% of the picture) and filled from the suit's vest photo, with no tie over it (${r.v.vOff} of ${r.v.vn} pixels differ: specks of the master's tie filled in)`);
    ok(r.v.tie>2000&&r.v.tie<r.v.tieNoVest*.9&&r.v.bar===null&&r.v.green<2&&r.v.jacketB<-2,`on a vest day only the top of the tie shows (${r.v.tie} pixels, ${r.v.tieNoVest} without a waistcoat), there is no tie bar, none of the master's green tie is left (${r.v.green.toFixed(1)}%) and the suit is the navy one`);
    ok(r.v.drift<.06&&r.v.driftNoV>r.v.drift,`a suit's vest photo is judged with the waistcoat counted as its own (${(100*r.v.drift).toFixed(1)}% changed outside it; ${(100*r.v.driftNoV).toFixed(1)}% if it were not)`);
    const [zj,zs,zt,zw]=r.shares;
    ok(r.W===900&&r.ok&&zj>45&&zj<70&&zs>2&&zs<7&&zt>1&&zt<4&&zw>.3&&zw<1.2&&r.overlap===0,`the four zones are found from the calibration photos, each of a sensible size and none overlapping (jacket ${zj.toFixed(1)}%, shirt ${zs.toFixed(1)}%, tie ${zt.toFixed(1)}%, watch ${zw.toFixed(2)}%)`);
    ok(r.same,'zones survive being packed for storage and unpacked');
    const ed=await p.evaluate(async()=>{const W=40,m=new Uint8Array(W*W);for(let y=0;y<12;y++)for(let x=10;x<30;x++)m[y*W+x]=1;m[0*W+15]=0;   // a block on the top edge with a one-pixel gap
      const c=asmBox(asmBox(m,W,2,true),W,2,false);let top=1;for(let x=10;x<30;x++)if(!c[x]||!c[W+x])top=0;const s=asmBox(m,W,2,false);
      const old={v:1,...asmPackZones({W:2,jacket:new Uint8Array(4),shirt:new Uint8Array(4),tie:new Uint8Array(4),watch:new Uint8Array(4)})};delete old.v;await metaPut('asm:zones:'+asmMasterKey(),old);const stale=await asmZonesKept();await metaPut('asm:zones:'+asmMasterKey(),null);
      return {top,inner:s[5*W+20]===1&&s[11*W+20]===0&&s[0*W+20]===1,stale,v:ASM_ZV}});
    ok(ed.top===1&&ed.inner,'a zone that reaches the picture\'s edge keeps its outermost rows when its gaps are closed (they were cut, and the master\'s white collar showed as a line along the top of a dark shirt)');
    // a suit's photo whose hand is two pixels larger than the master's: its rim of skin in the jacket's zone becomes cloth
    const hd=await p.evaluate(()=>{const W=120,N=W*W,mk=(r,cloth)=>{const d=new ImageData(W,W);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=4*(y*W+x),in_=Math.hypot(x-60,y-60)<=r,c=in_?[214,170,140]:cloth;d.data[i]=c[0];d.data[i+1]=c[1];d.data[i+2]=c[2];d.data[i+3]=255}return d};
      const master=mk(20,[70,70,74]),piece=mk(22,[30,40,90]),z={W,jacket:new Uint8Array(N),shirt:new Uint8Array(N),tie:new Uint8Array(N),watch:new Uint8Array(N)};
      for(let y=0;y<W;y++)for(let x=0;x<W;x++)if(Math.hypot(x-60,y-60)>20.5)z.jacket[y*W+x]=1;
      const o=asmCompose(master,z,{jacket:piece}),L=asmLab(o);let rim=0,hand=0,cloth=0;
      for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x,r=Math.hypot(x-60,y-60),skin=L[3*i+1]>8&&L[3*i+2]>10&&L[3*i]>60;if(r>21.5&&r<30&&skin)rim++;if(r<18&&skin)hand++;if(r>32&&o.data[4*i+2]===90)cloth++}
      return {rim,hand,cloth,h:ASM_HAND}});
    ok(hd.rim===0&&hd.hand>900&&hd.cloth>9000,`where a suit's photo shows a larger hand than the master's, its rim of skin outside the master's hand becomes cloth (${hd.rim} skin pixels left round the fist; the hand and the cloth are untouched)`);
    ok(ed.stale===false&&ed.v===9,'zones kept from before that fix are not used: they are worked out again');
    ok(!r.noneOk,'calibration photos that changed nothing give zones that are refused');
    ok(r.a.moved===0&&r.a.watchKept===1,`outside the pieces the picture is the master, pixel for pixel, and the owner's watch stays the master's own (${r.a.moved} pixels differ)`);
    ok(r.a.ringN>300&&r.a.ringOk===1&&r.a.ringSeam<r.a.ringN/100,`the jacket's own edge comes from its photo: ${r.a.ringN} pixels just outside its zone where the master shows a leftover of its own jacket, none on another piece and next to none on the hands (${r.a.ringSeam} skin pixels; the master's dark edge left there read as an outline)`);
    ok(r.a.rows>200&&r.a.jump<=r.a.rows*.1&&r.a.edgeN>300&&r.a.edgeSeam<=r.a.edgeN*.05,`the tie has a smooth outline and a soft edge: its side jumps more than a pixel on ${r.a.jump} of ${r.a.rows} rows, and ${r.a.edgeSeam} of ${r.a.edgeN} edge pixels on the shirt are rebuilt as a join`);
    ok(r.a.haloN>300&&r.a.haloGreen===0,`no halo of the master's tie round the new one: of the ${r.a.haloN} shirt pixels beside it, ${r.a.haloGreen} are green`);
    ok(r.a.jacketBMaster<4&&r.a.jacketB>8,`the jacket is the khaki one, not the master's grey (yellowness ${r.a.jacketBMaster.toFixed(1)} -> ${r.a.jacketB.toFixed(1)})`);
    ok(r.a.shirtL<35,`the shirt is black in the collar, chest and cuffs (lightness ${r.a.shirtL.toFixed(0)})`);
    ok(r.a.inCore&&r.a.inWide&&r.a.greenMaster>50&&r.a.green<2,`the tie is pasted within a few pixels of the master's and none of the green master tie is left (${r.a.green.toFixed(1)}% green, was ${r.a.greenMaster.toFixed(0)}%)`);
    ok(r.a.rimN>300&&r.a.rimPale<3,`a tie made over the white master shirt has no pale rim on the black shirt (${r.a.rimPale.toFixed(1)}% of ${r.a.rimN} pixels beside it are pale)`);
    ok(r.a.bar>150&&r.a.bar<1500&&r.a.barL>60,`the tie bar is found in its photo and laid on the tie (${r.a.bar} pixels, lightness ${r.a.barL.toFixed(0)})`);
    ok(r.b.watch>2500&&r.b.watch<9000&&r.b.dark>30&&r.b.darkMaster<15,`another watch replaces the master's (dark strap and dial: ${r.b.dark.toFixed(0)}% dark, was ${r.b.darkMaster.toFixed(0)}%)`);
    ok(r.b.shirtA>4&&r.b.tinted>0&&r.b.white<1.5,`the shirt is pink, and the bit of cuff the smaller watch uncovers is tinted to it, not left white (${r.b.tinted} pixels tinted, ${r.b.white.toFixed(2)}% white)`);
    ok(r.onlyTie===1,'a piece that is left out stays as the master shows it');
    // ---- keys, what an outfit needs, and the picture from the kept photos ----
    // switched off (ASM_ON false, as it was between the two masters): no picture, nothing wanted, nothing asked of the worker, Settings hides Item photos
    const off=await p.evaluate(async()=>{let n=0;const I=(type,primaryColor,x={})=>({id:'off'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const o={top:I('blazer','khaki'),shirt:I('shirt','black'),tie:I('tie','navy'),watch:I('watch','silver',{metal:'silver'}),suitDay:false};
      renders[asmMasterKey()]={sig:asmMasterSig(o),img:'data:image/jpeg;base64,AAAA',model:'',t:5};renders[comboKey(o)]={sig:comboSig(o),img:'data:image/jpeg;base64,OWN',model:'gpt',t:1};
      asmOut[asmOutKey(o)]={img:'data:image/jpeg;base64,ASM',stamp:asmStamp(o),t:9};
      const calls=[],f0=window.fetch;window.fetch=async(...a)=>{calls.push(String(a[0]));return new Response('{}',{status:404})};   /* (opening Settings asks who is connected, GET /me: account.js; not counted) */localStorage.setItem('worker_url','https://off.test/');localStorage.setItem('app_token','t');
      const shipped=ASM_ON;ASM_ON=false;const r={shipped,ver:ASM_VER,on:ASM_ON,wants:asmWants(o),for:asmFor(o),shown:renderFor(o).img,pending:asmPending(o)};await asmEnsure(o);await asmSync(true);asmAutoSoon();openSettings('photos');renderAsmUI();
      r.calls=calls.filter(u=>!/\/me$/.test(u)).length;r.hidden=document.querySelector('#asm-group').hidden&&getComputedStyle(document.querySelector('#asm-group')).display==='none';r.timer=asmAutoTimer;
      ASM_ON=true;r.forOn=(asmFor(o)||{}).img;renderAsmUI();r.shownOn=!document.querySelector('#asm-group').hidden;
      window.fetch=f0;localStorage.removeItem('worker_url');localStorage.removeItem('app_token');delete renders[asmMasterKey()];delete renders[comboKey(o)];delete asmOut[asmOutKey(o)];closeSettings&&closeSettings();return r});
    ok(off.on===false&&off.wants===false&&off.for===null&&off.shown==='data:image/jpeg;base64,OWN'&&off.pending===false&&off.calls===0&&off.hidden&&!off.timer,`assembled pictures are switched off: Today shows the outfit's own photo, nothing is asked of the worker or made for a new item, and Settings hides Item photos (${off.calls} requests)`);
    ok(off.forOn==='data:image/jpeg;base64,ASM'&&off.shownOn,'switched on (ASM_ON), the assembled picture is shown again and Settings offers Item photos');
    ok(off.shipped===true&&off.ver===3,'as shipped, assembled pictures are on, with the third masters (ASM_VER 3: 2048, plain mid grey suit, kelly green tie)');
    const k=await p.evaluate(async()=>{const url=async n=>{const d=await asmData('tests/fixtures/asm-'+n+'.jpg'),c=document.createElement('canvas');c.width=c.height=d.width;c.getContext('2d').putImageData(d,0,0);return c.toDataURL('image/jpeg',.9)};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const watch=I('watch','silver',{metal:'silver'}),jk=I('blazer','khaki',{pattern:'windowpane'}),black=I('shirt','black'),black2=I('shirt','black'),white=I('shirt','white'),tie=I('tie','navy',{pattern:'stripe',secondaryColor:'pink'}),tie2=I('tie','burgundy'),clip=I('tieclip','silver',{metal:'silver'}),gold=I('watch','gold',{metal:'gold'});
      const hb=I('shirt','pink',{pattern:'herringbone'}),pinkPlain=I('shirt','pink');
      items=[watch,jk,black,black2,white,tie,tie2,clip,gold];
      const o={top:jk,shirt:black,tie,clip,watch,suitDay:false};
      const out={before:asmParts(o).map(x=>x.slot).join(),keysDiffer:asmPieceKey('tie',tie)!==asmPieceKey('tie',tie2)&&asmPieceKey('jacket',jk)!==asmMasterKey(),sameShirt:asmPieceKey('shirt',black)===asmPieceKey('shirt',black2),
        keyShape:/^c[0-9a-f]{16}$/.test(asmPieceKey('tie',tie))&&/^c[0-9a-f]{16}$/.test(asmMasterKey())&&/^c[0-9a-f]{16}$/.test(asmCalibKey('tie')),
        weaveOwn:asmPieceKey('shirt',hb)!==asmPieceKey('shirt',pinkPlain)&&comboKey({...o,shirt:hb})===comboKey({...o,shirt:pinkPlain}),weaveText:asmShirtText(hb),plainText:asmShirtText(pinkPlain),
        can:[asmCan(o),asmCan({...o,vest:true}),asmCan({...o,tie:null}),asmCan({...o,top:null}),asmCan({...o,watch:null})].join()};
      const su=I('suit','navy',{pattern:'pinstripe',secondaryColor:'lightblue'}),ov={top:su,shirt:black,tie,watch,vest:true,suitDay:true};
      out.vparts=asmParts(ov).map(x=>x.slot+(x.vest?'+vest':'')).join();out.vkey=asmParts(ov)[0].key===asmPieceKey('vest',su)&&asmPieceKey('vest',su)!==asmPieceKey('jacket',su)&&asmVestKey()!==asmMasterKey();
      items.push(su);const nd=()=>asmNeeds().filter(q=>/vest/.test(q.kind+q.slot)).map(q=>q.kind+':'+(q.slot||'')).join(' ');out.vneeds=nd();settings.vestMode='never';out.vnever=nd();settings.vestMode='auto';su.vest='no';out.vno=nd();delete su.vest;items.pop();
      out.noMaster=await asmPhoto(o);
      const put=async(key,f,sig='')=>{renders[key]={sig,img:await url(f),model:'',t:1000}};
      // the master was made with this watch and a white shirt (its record says so): neither needs a piece
      await put(asmMasterKey(),'master',asmMasterSig({watch,shirt:asmMasterItem('shirt','white')}));
      out.parts=asmParts(o).map(x=>x.slot).join();out.partsWhite=asmParts({...o,shirt:white}).map(x=>x.slot).join();out.partsGold=asmParts({...o,watch:gold}).map(x=>x.slot).join();
      out.noPieces=await asmPhoto(o);
      await put(asmPieceKey('jacket',jk),'jacket');await put(asmPieceKey('shirt',black),'shirt-black');await put(asmPieceKey('tie',tie),'tie');await put(asmPieceKey('bar',clip),'bar');
      out.noZones=await asmPhoto(o);
      await put(asmCalibKey('jacket'),'jacket');await put(asmCalibKey('shirt'),'shirt-black');await put(asmCalibKey('tie'),'tie');await put(asmCalibKey('watch'),'watch');
      const u=await asmPhoto(o);out.made=typeof u==='string'&&/^data:image\/jpeg;base64,/.test(u)&&u.length>40000;
      out.zonesKept=!!(await metaGet('asm:zones:'+asmMasterKey()));
      // the picture is the outfit: dark shirt, khaki jacket
      const d=await asmData(u),L=asmLab(d),z=asmUnpackZones(await metaGet('asm:zones:'+asmMasterKey())),W=z.W;let sl=0,sn=0,jb=0,jn=0;const sh=asmBox(z.shirt,W,2,false);
      for(let i=0;i<W*W;i++){if(sh[i]){sn++;sl+=L[3*i]}if(z.jacket[i]){jn++;jb+=L[3*i+2]}}out.shirtL=sl/sn;out.jacketB=jb/jn;
      out.gold=await asmPhoto({...o,watch:gold});out.vest=await asmPhoto(ov);out.vwants=asmWants(ov);
      // with the vest master, its calibration photo and the suit's vest photo kept, a vest day is put together too
      await put(asmVestKey(),'vestmaster');await put(asmCalibKey('vest'),'vestcalib');await put(asmPieceKey('vest',su),'vest-suit');
      const uv=await asmPhoto(ov);out.vmade=typeof uv==='string'&&uv.length>40000;out.vkept=!!(await metaGet('asm:vest:'+asmVestKey()));out.vwants2=asmWants(ov);
      const vj=asmVestMasterJob(),vcj=asmCalibJob('vest'),vpj=await asmPieceJob('vest',su);out.vjobs={vj,vcj,vpj:{...vpj,refs:vpj.refs.length}};
      // photos from an earlier vest master (other keys) still on the device are dropped once
      const olds=[asmVestKey(1),asmCalibKey('vest',1),asmPieceKey('vest',su,1)];items.push(su);for(const q of olds){renders[q]={sig:'',img:'data:image/jpeg;base64,AAAA',model:'',t:1};await metaPut('render:'+q,renders[q])}
      localStorage.removeItem('asm_vest');const dropped=await asmDropOld(),again=await asmDropOld();items.pop();
      out.drop={differ:olds.every(q=>![asmVestKey(),asmCalibKey('vest'),asmPieceKey('vest',su)].includes(q)),dropped,again,gone:olds.every(q=>!renders[q]),stored:!!(await metaGet('render:'+olds[0])),kept:!!renders[asmVestKey()],flag:localStorage.getItem('asm_vest')};
      // a piece that did not keep the picture (the generator once made a collage: the figure moved aside) is refused
      const master=await asmData(renders[asmMasterKey()].img),real=await asmData(renders[asmPieceKey('tie',tie)].img),c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d');x.fillStyle='#ccc';x.fillRect(0,0,W,W);
      x.drawImage(await asmImg(renders[asmPieceKey('tie',tie)].img),0,0,W,W,-140,0,W*.8,W*.8);const moved=c.toDataURL('image/jpeg',.9);
      out.drift=[asmDrift(master,z,'tie',real),asmDrift(master,z,'jacket',await asmData(renders[asmPieceKey('jacket',jk)].img)),asmDrift(master,z,'shirt',await asmData(renders[asmPieceKey('shirt',black)].img)),asmDrift(master,z,'tie',await asmData(moved))];
      const keep=renders[asmPieceKey('tie',tie)];renders[asmPieceKey('tie',tie)]={...keep,img:moved};out.collage=await asmPhoto(o);out.bad=asmBad.has(asmPieceKey('tie',tie));renders[asmPieceKey('tie',tie)]=keep;asmBad.clear();
      // on Today: the assembled picture stands in for the outfit's photo, unless a photo was made for this outfit after the master
      out.forBefore=asmFor(o);asmTried.clear();await asmEnsure(o);const a=asmFor(o);out.forAfter=!!a&&a.model==='assembled'&&a.img.length>40000;out.keptOut=!!(await metaGet('asm:out:'+asmOutKey(o)));
      renders[comboKey(o)]={sig:comboSig(o),img:'data:image/jpeg;base64,OLD',model:'gpt',t:500};out.overOld=renderFor(o).model;
      renders[comboKey(o)]={sig:comboSig(o),img:'data:image/jpeg;base64,NEW',model:'gpt',t:2000};out.underNew=renderFor(o).model;
      // and then nothing is put together for it: asmEnsure runs at every redraw of Today, and assembling and redrawing again looped after a Regenerate
      {let made=0,redraws=0;const p0=asmPhoto,r0=refreshToday;asmPhoto=async x=>{made++;return p0(x)};refreshToday=()=>{redraws++};
        try{asmTried.clear();await asmEnsure(o);await asmEnsure(o)}finally{asmPhoto=p0;refreshToday=r0}out.fullLoop={made,redraws}}
      delete renders[comboKey(o)];
      renders[asmPieceKey('tie',tie)]={...keep,t:3000};out.stale=asmFor(o);renders[asmPieceKey('tie',tie)]=keep;
      // the jobs
      const mj=await asmMasterJob(),cj=asmCalibJob('tie'),tj=await asmPieceJob('tie',{...tie,photo:await url('tie')}),bj=await asmPieceJob('bar',clip),sj=await asmPieceJob('shirt',{...black,photo:await url('shirt-black')}),jj=await asmPieceJob('jacket',{...jk,photo:await url('jacket')}),wj=await asmPieceJob('watch',{...gold,photo:await url('watch')});
      out.jobs={mj:{...mj,image:mj.image.slice(0,30)},cj,tj:{...tj,refs:tj.refs.length},bj,sj:{...sj,refs:sj.refs.length},jj:{...jj,refs:jj.refs.length},wj:{...wj,refs:wj.refs.length}};out.masterUrl=await url('master');out.tieJob=tj;
      out.tieClose=(await asmPieceJob('tie',{...tie,photo:await url('tie'),texture:await url('tie')})).labels;
      out.needs=asmNeeds().map(q=>q.kind+':'+(q.slot||'')).join(' ');
      // the owner's own colours are named in the description, not sent as their keys
      const cu0=settings.custom;applyCustom({colors:[{key:'owntaupe',name:'taupe',hex:'#4b463b',base:'deeptaupe',types:['tie']}]});
      out.own=(await asmPieceJob('tie',I('tie','owntaupe',{pattern:'stripe',secondaryColor:'cream'}))).swap.text;applyCustom(cu0);out.ownAfter=prettyCols('a owntaupe tie');return out});
    ok(k.own==='a taupe & cream stripe tie'&&k.ownAfter==='a owntaupe tie',`a colour the owner added is described by its name ("${k.own}")`);
    ok(k.keyShape&&k.keysDiffer&&k.sameShirt,'the master, calibration and piece photos have their own photo keys; two plain shirts of one colour share a piece');
    ok(k.weaveOwn&&/bold tone-on-tone herringbone weave/.test(k.weaveText)&&/a little larger and with more contrast than life/.test(k.weaveText)&&k.plainText==='a plain pink dress shirt',
      'a shirt in a woven texture has its own piece (though it shares the outfit key with the plain colour) and is asked for with a bolder weave than life, so it can be seen');
    ok(k.can==='true,true,false,false,false','an outfit can be assembled when it has a jacket (with or without its waistcoat), a shirt, a tie and a watch');
    ok(k.vparts==='jacket+vest,shirt,tie,watch'&&k.vkey&&k.vneeds==='vestmaster: vestcalib:vest piece:vest'&&k.vnever===''&&k.vno==='',`a vest day takes the suit's vest photo (its own key) and no tie bar; a wardrobe with a three-piece suit needs the vest master, its calibration photo and that piece, unless vests are never worn or the suit has none (${k.vparts}; ${k.vkey}; "${k.vneeds}"; "${k.vnever}"; "${k.vno}")`);
    ok(k.before==='jacket,shirt,tie,bar,watch'&&k.parts==='jacket,shirt,tie,bar'&&k.partsWhite==='jacket,tie,bar'&&k.partsGold==='jacket,shirt,tie,bar,watch',`an outfit needs a piece per jacket, shirt, tie and tie bar; the master's own watch and a white shirt need none (${k.parts}; ${k.partsWhite}; ${k.partsGold})`);
    ok(k.noMaster===null&&k.noPieces===null&&k.noZones===null,'no picture without the master, with a piece missing, or before the calibration photos are there');
    ok(k.made&&k.zonesKept&&k.shirtL<38&&k.jacketB>8,`with everything kept on the device the outfit's picture is made and its zones stored (shirt lightness ${k.shirtL.toFixed(0)}, jacket yellowness ${k.jacketB.toFixed(1)})`);
    ok(k.gold===null&&k.vest===null&&k.vwants===false,'an outfit whose watch has no piece yet, or a vest day before the vest photos are there, gets no assembled picture (it keeps its own photo)');
    ok(k.vmade&&k.vkept&&k.vwants2,'with the vest master, its calibration photo and the suit\'s vest photo on the device, a vest day is put together, and the waistcoat\'s zone is kept');
    ok(k.drop.differ&&k.drop.dropped===3&&k.drop.again===0&&k.drop.gone&&!k.drop.stored&&k.drop.kept&&k.drop.flag==='3','a remade vest master has new keys: photos from the earlier one still on a device are dropped once, the new ones kept');
    const VJ=k.vjobs;
    ok(VJ.vj.baseKey===k.jobs.mj.key&&VJ.vj.swap.what==='waistcoat'&&VJ.vj.swap.add===true&&VJ.vcj.baseKey===VJ.vj.key&&VJ.vcj.swap.what==='waistcoat'&&/orange/.test(VJ.vcj.swap.text)&&VJ.vpj.baseKey===VJ.vj.key&&VJ.vpj.swap.what==='jacket'&&/navy & light blue pinstripe suit, a three-piece suit/.test(VJ.vpj.swap.text),
      'the vest master adds a waistcoat to the master; its calibration photo and each suit\'s vest photo are edits of the vest master');
    ok(k.drift.slice(0,3).every(v=>v<.06)&&k.drift[3]>.3&&k.collage===null&&k.bad,`a real piece leaves the rest of the picture alone; one that moved the figure is refused (${k.drift.map(v=>(100*v).toFixed(1)+'%').join(', ')} changed outside the piece)`);
    ok(k.forBefore===null&&k.forAfter&&k.keptOut&&k.overOld==='assembled'&&k.underNew==='gpt'&&k.stale===null,'Today takes the assembled picture (kept on the device) over an older photo of the outfit; a photo made after the master wins, and a piece made again makes the picture stale');
    ok(k.fullLoop.made===0&&k.fullLoop.redraws===0,`an outfit whose own photo wins (after a Regenerate) is not put together and Today is not redrawn for it: that looped and froze swiping and scrolling (${k.fullLoop.made} assembled, ${k.fullLoop.redraws} redraws)`);
    ok(/^master: calib:jacket calib:shirt calib:tie calib:watch( piece:\w+)+$/.test(k.needs)&&k.needs.split('piece:shirt').length===2&&k.needs.split('piece:tie').length===3&&k.needs.split('piece:watch').length===2,`the wardrobe needs the master, four calibration photos and one piece per look: not the white shirt or the master's watch (${k.needs})`);
    const J=k.jobs;
    ok(J.mj.mode==='queue'&&J.mj.master===true&&J.mj.quality==='high'&&/^data:image\/png/.test(J.mj.image)&&/mid grey suit/.test(J.mj.outfit)&&/green tie/.test(J.mj.outfit)&&/plain white dress shirt/.test(J.mj.outfit)&&J.mj.size==='2048x2048','the master job is a normal outfit photo of the master\'s clothes (plain mid grey suit, white shirt, green tie), marked as the master, at high quality and 2048 ('+J.mj.size+')');
    ok(J.cj.baseKey===J.mj.key&&J.cj.swap.what==='tie'&&/magenta/.test(J.cj.swap.text)&&J.tj.baseKey===J.mj.key&&J.tj.swap.what==='tie'&&/navy & pink stripe tie/.test(J.tj.swap.text)&&J.tj.refs===1,'calibration and piece jobs edit the kept master (by its key) and swap one piece, with the item\'s own photo');
    ok(k.tieClose[0]==='the tie'&&k.tieClose.some(l=>/^a close-up of the tie fabric/.test(l)),`a tie with a close-up still has its photo in its own piece job, first (${k.tieClose.map(l=>l.slice(0,22)).join(' | ')})`);
    ok(J.bj.swap.what==='tie bar'&&J.bj.swap.add===true&&/silver tie bar/.test(J.bj.swap.text)&&J.sj.swap.what==='shirt'&&J.sj.refs===1&&/plain black dress shirt/.test(J.sj.swap.text)&&J.jj.swap.what==='jacket'&&J.jj.refs===1&&J.wj.swap.what==='watch'&&J.wj.refs===2,'a tie bar is added, and a shirt, jacket or watch swapped, each from its own photo (the watch with its dial enlarged)');
    // ---- the worker: master and piece jobs through the queue ----
    worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
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
      ok(ms[0].acked&&store.has('render:'+mk)&&got[0].quality==='high'&&/^Turn the first image/.test(got[0].prompt)&&/reference photo that other photos are edited from/.test(got[0].prompt)&&/No waistcoat, tie bar/.test(got[0].prompt),'the master is made at high quality with the reference note and kept under its key');
      store.set('render:'+mk,JSON.stringify({sig:'asm/master',img:k.masterUrl,model:'m',t:1}));
      // the piece, now that the master is kept: the worker edits the kept photo
      got=[];await post({...k.tieJob,replace:true});ms=await drain();
      ok(ms[0].acked&&store.has('render:'+k.tieJob.key)&&got[0].n===2&&got[0].first==='image/jpeg'&&got[0].firstSize>20000&&/^Edit the first image/.test(got[0].prompt)&&/Replace only the tie with: a navy & pink stripe tie/.test(got[0].prompt),'the piece is an edit of the kept master: the master first, then the item\'s photo, and only the tie replaced');
      got=[];await post(J.bj);ms=await drain();
      ok(ms[0].acked&&/Add one thing only: a slim silver tie bar/.test(got[0].prompt)&&!/Replace only/.test(got[0].prompt)&&/must stay exactly[^\n]*the tie, its knot and its pattern/.test(got[0].prompt),'the tie bar is added to the master, with everything else kept');
      got=[];await post(k.vjobs.vj);ms=await drain();const p1=got[0]&&got[0].prompt;store.set('render:'+k.vjobs.vj.key,JSON.stringify({sig:'',img:k.masterUrl,model:'m',t:1}));got=[];await post(k.vjobs.vcj);await drain();
      ok(/Add one thing only: a matching waistcoat \(vest\) in exactly the same cloth as the suit jacket/.test(p1)&&/Replace only the waistcoat with: a waistcoat of exactly the same cut[^\n]*orange/.test(got[0].prompt)&&/must stay exactly[^\n]*the jacket and its pattern/.test(got[0].prompt),'the worker adds the waistcoat for the vest master and swaps only the waistcoat for its calibration photo');
      q=await post({mode:'queue',key:'c0000000000000001',swap:{what:'tie',text:'x'}});ok(q.status===400,'a job with neither an image nor a photo to edit is refused');
      // a photo that was made wrong can be removed from the worker
      const del=(key,tok='t')=>worker.fetch(new Request(HOST+'render?key='+key,{method:'DELETE',headers:{'x-app-token':tok}}),env);
      const d0=store.has('render:'+k.tieJob.key),d1=await del(k.tieJob.key,'wrong'),d2=await del('not-a-key'),d3=await del(k.tieJob.key);
      ok(d0&&d1.status===403&&d2.status===400&&d3.status===200&&!store.has('render:'+k.tieJob.key),'DELETE /render?key= removes a kept photo, with the app token and a photo key only');
    }finally{globalThis.fetch=realFetch}
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // ---- the app against the worker (mocked KV, queue and OpenAI): item photos come home, Today shows the outfit put together ----
    {const fs=require('fs'),fx=n=>'data:image/jpeg;base64,'+fs.readFileSync(path.join(ROOT,'tests/fixtures/asm-'+n+'.jpg')).toString('base64');
      const store=new Map(),KV={get:async(q,t)=>store.has(q)?(t==='json'?JSON.parse(store.get(q)):store.get(q)):null,put:async(q,v)=>{store.set(q,v)},delete:async q=>{store.delete(q)}};
      let sent=[],made=0;const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:{send:async m=>{sent.push(m)}}},HOST='https://asm.test/';
      const drain=async()=>{for(const body of sent.splice(0)){const m={body,attempts:1,ack(){},retry(){}};await worker.queue({messages:[m]},env)}};
      globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});made++;   // every made photo is the tie fixture
        return new Response(JSON.stringify({data:[{b64_json:fx('tie').split(',')[1]}]}),{status:200,headers:{'content-type':'application/json'}})};
      await p.close();const ctx=await browser.newContext({viewport:{width:390,height:900}});
      try{
        // no backup sync here: with a KV the app's start-up sync would answer, and reload the (empty) stored wardrobe over the test's items
        await ctx.route(HOST+'**',async route=>{const q=route.request();if(/\/sync(\?|$)/.test(q.url()))return route.fulfill({status:501,contentType:'application/json',body:'{"error":"no sync in this test"}'});
          const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
          await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
        const a=await ctx.newPage();const errs2=[];a.on('pageerror',e=>errs2.push(e.message));a.on('dialog',d=>d.accept());
        await a.goto(url);await a.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await a.reload();await a.waitForFunction(()=>window.appReady);
        const K=await a.evaluate(()=>{let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
          items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('shirt','lightblue'),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('watch','black',{metal:'silver'}),
            I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
          settings.workdays=[0,1,2,3,4];settings.vestMode='never';dayRecs={};TODAY_OVERRIDE='2026-11-16T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};ASM_AUTO_MS=60;ASM_ON=true;   // today is the day shown: a stray "new day" check changes nothing
          const o=planFor()[key(sel)];return {can:asmCan(o),master:asmMasterKey(),sig:asmMasterSig({watch:o.watch,shirt:asmMasterItem('shirt','white')}),calib:['jacket','shirt','tie','watch'].map(asmCalibKey),
            jacket:asmPieceKey('jacket',o.top),shirt:asmPieceKey('shirt',o.shirt),tie:asmPieceKey('tie',o.tie),combo:comboKey(o)}});
        const keep=(k,f,sig='')=>store.set('render:'+k,JSON.stringify({sig,img:fx(f),model:'m',t:1000}));
        keep(K.master,'master',K.sig);['jacket','shirt-black','tie','watch'].forEach((f,i)=>keep(K.calib[i],f));keep(K.jacket,'jacket');keep(K.shirt,'shirt-pink');   // the tie's photo is not made yet
        const s1=await a.evaluate(async()=>{show('today');const st=await asmSync(true);return {missing:st.missing.map(n=>n.kind+':'+n.slot).join(),total:st.total,have:['master','jacket','shirt'].length,btn:(document.querySelector('.render-btn')||{}).textContent||'',photo:!!document.querySelector('.fig.photo img')}});
        ok(K.can&&s1.missing==='piece:tie'&&s1.total===3&&!s1.photo&&/Generate realistic photo/.test(s1.btn),`the app brings the master and the item photos home and knows what is still to make (${s1.missing}); an outfit with a piece missing shows its drawing and Generate`);
        await a.click('.render-btn');await a.waitForFunction(()=>!rendering,null,{timeout:15000});
        const job=JSON.parse(store.get('job:'+K.tie)||'null');
        ok(sent.length===1&&sent[0].key===K.tie&&job&&job.swap.what==='tie'&&job.baseKey===K.master&&!job.image&&!store.has('job:'+K.combo)&&/Making photo/.test(await a.textContent('.render-btn')),'Generate sends only the missing item (the tie, as an edit of the master), not a whole outfit photo, and says it is being made');
        await drain();ok(made===1&&store.has('render:'+K.tie),'the worker makes the tie\'s photo from the kept master');
        await a.evaluate(()=>checkQueue());await a.waitForSelector('.fig.photo img',{timeout:15000});
        const s2=await a.evaluate(()=>{const o=planFor()[key(sel)],r=asmFor(o);return {shown:!!r&&document.querySelector('.fig.photo img').src===r.img,model:r&&r.model,btn:!!document.querySelector('.render-btn'),queued:queuedKeys().length}});
        ok(s2.shown&&s2.model==='assembled'&&!s2.btn&&s2.queued===0,'when it arrives, Today shows the outfit put together from the item photos, with no Generate button left');
        // Settings: Item photos
        const s3=await a.evaluate(async()=>{openSettings('photos');await asmSync(true);return {st:document.querySelector('#asm-status').textContent,btn:document.querySelector('#asm-btn').textContent,dis:document.querySelector('#asm-btn').disabled,auto:document.querySelector('#cfg-asm-auto').value,batch:batchCombos().length}});
        ok(/^All 3 item photos are here\./.test(s3.st)&&s3.dis&&s3.auto==='on'&&s3.batch===0,`Settings says every item photo is here, and the month batch no longer offers whole photos for outfits that are put together ("${s3.st}")`);
        // a new item: its photo is made by itself
        sent=[];const s4=await a.evaluate(async()=>{const it={id:'tie-new',type:'tie',primaryColor:'green',pattern:'solid'};await put(it);items.push(it);cache={};await new Promise(r=>setTimeout(r,900));return {key:asmPieceKey('tie',it),toast:(document.querySelector('.toast')||document.querySelector('#toast')||{}).textContent||''}});
        ok(sent.length===1&&sent[0].key===s4.key&&/green tie/.test(s4.toast),`adding an item sends its photo to be made, and says so ("${s4.toast}")`);
        sent=[];const s5=await a.evaluate(async()=>{setAsmAuto('off');const it={id:'tie-new2',type:'tie',primaryColor:'gold',pattern:'solid'};await put(it);items.push(it);cache={};await new Promise(r=>setTimeout(r,900));
          await asmSync(true);renderAsmUI();return {st:document.querySelector('#asm-status').textContent,btn:document.querySelector('#asm-btn').textContent,auto:settings.asmAuto}});
        ok(sent.length===0&&s5.auto===false&&/1 to make, about 14¢/.test(s5.st)&&/gold tie/.test(s5.st)&&s5.btn==='Make 1 photo',`with that switched off the item waits for the button, which says what it costs ("${s5.st}")`);
        await a.evaluate(()=>{const f=document.querySelector('#adv-photos');if(!f.classList.contains('open'))f.querySelector('.adv-head').click()});await a.click('#asm-btn');await a.click('#ask-ok');await a.waitForFunction(()=>/Making/.test(document.querySelector('#asm-btn').textContent),null,{timeout:15000});
        const st6=await a.textContent('#asm-status');
        ok(sent.length===1&&/2 photos are being made/.test(st6),`the button sends it after asking, and Settings says the worker is making them ("${st6}", ${sent.length} sent)`);
        ok(errs2.length===0,'no page errors with the worker ('+errs2.join('; ')+')');
      }finally{await ctx.close()}}
  }finally{globalThis.fetch=realFetchAll;await browser.close()}
};

module.exports.assembled=true;   // tests assembled pictures (assemble.js); other tests run with them switched off (ASM_TEST_OFF)
