// Atlas painting (assemble.js asmComposeP2, a trial switched on per phone): when the suit, shirt and tie are all painted, the picture
// is put together with edges unmixed from the base picture's colours, patterns bent by the folds and the grain smoothed out of a
// newly woven cloth. Off by default (its Settings switch was removed 2026-11-13); its pictures have keys of their own.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const url=async n=>{const d=await asmData('tests/fixtures/asm-'+n+'.jpg'),c=document.createElement('canvas');c.width=c.height=d.width;c.getContext('2d').putImageData(d,0,0);return c.toDataURL('image/jpeg',.9)};
      const put=(k,img,t,sig='')=>{renders[k]={sig,img,model:'',t}},out={};let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const watch=I('watch','silver',{metal:'silver'}),su=I('suit','navy',{vest:'yes'}),tie=I('tie','burgundy'),hb=I('shirt','lightblue',{pattern:'herringbone'}),clip=I('tieclip','silver',{metal:'silver'});items=[watch,su,tie,hb,clip];
      put(asmMasterKey(),await url('master'),100,asmMasterSig({watch,shirt:asmMasterItem('shirt','white')}));
      for(const [s,f] of [['jacket','jacket'],['shirt','shirt-black'],['tie','tie'],['watch','watch']])put(asmCalibKey(s),await url(f),200);
      const M=await asmData(renders[asmMasterKey()].img),W=M.width,c={jacket:await asmData(await url('jacket')),shirt:await asmData(await url('shirt-black')),tie:await asmData(await url('tie')),watch:await asmData(await url('watch'))};
      const z=asmZones(M,c),pic=m=>{const cv=document.createElement('canvas');cv.width=cv.height=W;const x=cv.getContext('2d'),d=x.createImageData(W,W);for(let i=0;i<W*W;i++){const v=m[i]?255:0;d.data.set([v,v,v,255],4*i)}x.putImageData(d,0,0);return cv.toDataURL('image/png')};
      ASM_ZONE_SLOTS.forEach((s,i)=>put(asmZoneKey(s),pic(z[s]),300+i));
      const vm=await url('vestmaster');put(asmVestKey(),vm,500);put(asmCalibKey('vest'),await url('vestcalib'),510);put(asmZoneKey('vest'),pic(asmVestZone(await asmData(vm),await asmData(await url('vestcalib')),z)),520);
      const o={top:su,shirt:hb,tie,watch,suitDay:true},ov={...o,vest:true},oc={...o,clip};put(asmPieceKey('bar',clip),await url('bar'),150);   // (a tie bar is a photo)
      out.off=asmP2On();out.keyOff=asmOutKey(o);out.jobOff=(await asmJob(o)).p2;out.able=[asmP2Able(o),asmP2Able(ov),asmP2Able(oc)];
      asmP2Set('on');out.on=asmP2On()&&localStorage.getItem('asm_paint2')==='1';out.keyOn=asmOutKey(o);out.jobOn=(await asmJob(o)).p2;out.jobClip=(await asmJob(oc)).p2;
      // both ways, in the Web Worker, with and without the waistcoat
      const stat=async(a,b)=>{const A=await asmData(a),B=await asmData(b),zz=asmBox(z.shirt,W,6,false),zj=asmBox(z.jacket,W,6,false);let s=0,sn=0,j=0,jn=0,all=0;
        for(let i=0;i<W*W;i++){const d=Math.abs(A.data[4*i+2]-B.data[4*i+2]);all+=d;if(zz[i]){s+=A.data[4*i+2]-B.data[4*i+2];sn++}if(zj[i]){j+=A.data[4*i+2]-B.data[4*i+2];jn++}}return {shirt:s/sn,jacket:j/jn,all:all/(W*W)}};
      out.worker=!!asmWorker();for(const [k,x] of [['plain',o],['vest',ov]]){const a=await asmPhoto(x,true,false),b=await asmPhoto(x,true,true);out[k]=a&&b?{made:true,...await stat(a,b),differ:a!==b}:{made:false,a:!!a,b:!!b}}
      asmP2Set('off');out.offAgain=!asmP2On()&&asmOutKey(o)===out.keyOff;
      return out});
    ok(r.off===false&&r.jobOff===false,'atlas painting is off unless switched on (the job takes today\'s way)');
    ok(r.able.join()==='true,true,false',`it is for outfits whose suit, shirt and tie are all painted, with or without the waistcoat; a tie bar (a photo) keeps today's way (${r.able})`);
    ok(r.on&&r.jobOn===true&&r.jobClip===false&&r.keyOn!==r.keyOff&&r.offAgain,'switched on, on this phone only: such an outfit is painted the new way under a key of its own, and switched off again it is as before');
    ok(r.worker&&r.plain.made&&r.vest.made&&r.plain.differ,`both ways are put together in the Web Worker, with and without the waistcoat (${JSON.stringify({plain:r.plain.made,vest:r.vest.made})})`);
    ok(Math.abs(r.plain.shirt)<2&&Math.abs(r.plain.jacket)<2&&Math.abs(r.vest.shirt)<2.5&&Math.abs(r.vest.jacket)<2.5&&r.plain.all<4&&r.vest.all<4,
      `the pieces keep their colours and only edges, grain and folds change (shirt ${r.plain.shirt.toFixed(2)}/${r.vest.shirt.toFixed(2)}, jacket ${r.plain.jacket.toFixed(2)}/${r.vest.jacket.toFixed(2)}, whole picture ${r.plain.all.toFixed(2)}/${r.vest.all.toFixed(2)} levels apart)`);
    // Settings no longer has the switch (2026-11-13: the colour-coded masters come first on every day, so it changed nothing)
    await p.evaluate(()=>{document.body.classList.add('owner');openSettings('photos');const h=document.querySelector('#adv-photos .adv-head');if(h)h.click();renderAsmUI()});await settle(p,300);
    ok(await p.evaluate(()=>!document.querySelector('#cfg-p2,#p2-cmp-btn')&&typeof asmP2UI==='undefined'),'Settings has no atlas-painting switch or comparison any more');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
