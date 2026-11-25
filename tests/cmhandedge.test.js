// The painter's hand edge and cuff steel, with assembled pictures.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const fs=require('fs'),path=require('path');

/* ---- was tests/cmhandedge.test.js ---- */
// The hand's edge (asmCmHandEdge) on the shirt-and-tie master (2026-11-14, the owner: "looks terrible"): the skin mask's stray shares of a
// few levels along the tie and the collar made the hand-edge rule hand the master's warm (pink-fringed) white shirt there to skin, which
// keeps the master's own colour: a pinkish band down the tie's right edge and under the collar on every shirt-and-tie look, on the CPU
// and the graphics chip alike (both read the same setup). Checked on the 512 fixture (tests/fixtures/cm/shirt-tie/).
const cmhandedge=async({ok,chromium,url})=>{
  const FIX=path.join(__dirname,'fixtures','cm','shirt-tie');
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const f={};for(const n of fs.readdirSync(FIX))f[n]=`data:image/${n.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,n)).toString('base64');
    const r=await p.evaluate(async f=>{const K=ASM_CM_KINDS['shirt-tie'],S=512,N=S*S,masks={};for(const z of K.zones)if(f['mask-'+z+'.png'])masks[z]=f['mask-'+z+'.png'];
      const job={cm:'shirt-tie',size:S,mk:'t',mt:1,rev:'t',master:f['master.jpg'],masks,parts:{sleeveR:f['part-sleeveR.png'],sleeveL:f['part-sleeveL.png']},cloth:{},gl:false,diskCache:false};
      const P=await asmCmPrep(job),A=P.A;
      // the raw skin mask: its shares beside the tie (pixels within 4 px right of the tie's edge, between the knot and the hand)
      const raw=(await asmData(masks.skin,S)).data,tie=A.tie,band=[];
      for(let y=0;y<S;y++){let xe=-1;for(let x=S-1;x>S/3;x--)if(tie[y*S+x]>127){xe=x;break}if(xe<0||xe>S*.7)continue;
        let hand=false;for(let x=xe+1;x<=xe+12&&x<S;x++)if(raw[4*(y*S+x)]>127)hand=true;if(hand)continue;   // the hand gripping the tie
        for(let x=xe+1;x<=xe+4;x++){let edge=false;for(let dy=-4;dy<=4&&!edge;dy++)for(let dx=-4;dx<=4;dx++){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<S&&raw[4*(yy*S+xx)]>127){edge=true;break}}
          if(!edge&&A.shirt[y*S+x]+A.tie[y*S+x]+A.skin[y*S+x]>=250)band.push(y*S+x)}}   // (the hand's own soft outline, within 4 px of it, is left to the hand-edge rule; the belt below is not the band)
      const strayRaw=band.filter(k=>raw[4*k]>0&&raw[4*k]<=127).length,skinAfter=band.filter(k=>A.skin[k]>0).length;
      // a skin share with no skin over half a pixel within ASM_CM_HAND_STRAY: none left
      const R=Math.round(('ASM_CM_HAND_STRAY' in HOOK?HOOK.ASM_CM_HAND_STRAY:24)*S/2048);const solid=new Float32Array(N);for(let k=0;k<N;k++)solid[k]=A.skin[k]>127?1:0;const near=HOOK.asmCmBlur(solid,S,R);
      let orphan=0;for(let k=0;k<N;k++)if(A.skin[k]&&!near[k])orphan++;
      let sum=0;for(let k=0;k<N;k++){let s=0;for(const z of P.names)s+=A[z][k];if(s&&s!==255)sum++}
      // painted with a blue shirt and a black tie: no pixel of that band keeps the master's colour (it reads blue or dark, never pinkish)
      const cl={shirt:{hex:'#3f6fb5'},tie:{hex:'#16161a'},trousers:{hex:'#3a3d44'},belt:{hex:'#5a3a22'}};
      const out=await asmCmBuild({...job,cloth:cl});const im=new Image();im.src=out.url;await im.decode();const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,S,S).data;
      let pink=0;for(const k of band){const j=4*k;if(d[j]>d[j+2]+4&&d[j]>60)pink++}
      return {band:band.length,strayRaw,skinAfter,orphan,sum,pink}},f);
    ok(r.band>100&&r.strayRaw>0,`the fixture's skin mask has stray shares beside the tie (${r.strayRaw} of ${r.band} pixels in the band)`);
    ok(r.skinAfter===0,`no skin share is left in the tie's right-edge band after the setup (${r.skinAfter})`);
    ok(r.orphan===0&&r.sum===0,`no skin share is left far from the hand or the neck, and the shares still add up to 255 (${r.orphan} stray, ${r.sum} off)`);
    ok(r.pink===0,`painted with a blue shirt, no pixel of the band is pinkish (the master's colour showing through: ${r.pink})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};

/* ---- was tests/cmcuffsteel.test.js ---- */
// The cuff rule in asmCmHandEdge (watch pixels beside the shirt that stay smooth and near-neutral become shirt: the cuff's shaded inner
// face) must not take the bracelet's steel (2026-11-14, shirt-open's top links: smooth warm-grey link faces next to the shirt were turned
// into shirt and painted in the shirt's colour). The rule now only takes cool pixels (blue >= red - 6): the cuff's white is cool, the steel
// warm grey (red 10-25 above blue). Checked on the 512 fixture (tests/fixtures/cm/shirt-tie/): the watch pixels next to the shirt are
// repainted in the master as smooth warm steel (top half of the watch) and smooth cool cuff white (bottom half), then the rule runs.
const cmcuffsteel=async({ok,chromium,url})=>{
  const FIX=path.join(__dirname,'fixtures','cm','shirt-tie');
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const f={};for(const n of fs.readdirSync(FIX))f[n]=`data:image/${n.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,n)).toString('base64');
    const r=await p.evaluate(async f=>{const K=ASM_CM_KINDS['shirt-tie'],S=512,N=S*S;
      const M=new Uint8ClampedArray((await asmData(f['master.jpg'],S)).data),A={};
      for(const z of K.zones)if(f['mask-'+z+'.png']){const d=(await asmData(f['mask-'+z+'.png'],S)).data,a=new Uint8Array(N);for(let k=0;k<N;k++)a[k]=d[4*k];A[z]=a}
      // shares made to add up to 255, as asmCmPrep does before the hand's edge
      const names=Object.keys(A);for(let k=0;k<N;k++){let s=0;for(const z of names)s+=A[z][k];if(s&&s!==255){let left=255;for(let i=0;i<names.length;i++){const z=names[i],v=i===names.length-1?left:Math.round(A[z][k]*255/s);A[z][k]=Math.max(0,Math.min(left,v));left-=A[z][k]}}}
      // the watch pixels within 6 px (through the watch) of the shirt's edge
      const D=new Int16Array(N).fill(-1);let q=[];
      for(let k=S;k<N-S;k++)if(A.watch[k]>127&&(A.shirt[k-1]>127||A.shirt[k+1]>127||A.shirt[k-S]>127||A.shirt[k+S]>127)){D[k]=0;q.push(k)}
      for(let d=0;d<6&&q.length;d++){const nx=[];for(const k of q)for(const n of [k-1,k+1,k-S,k+S])if(n>=0&&n<N&&D[n]<0&&A.watch[n]>127){D[n]=d+1;nx.push(n)}q=nx}
      let y0=S,y1=-1;for(let k=0;k<N;k++)if(D[k]>=0){const y=k/S|0;y0=Math.min(y0,y);y1=Math.max(y1,y)}const mid=(y0+y1)/2;
      const warm=[],cool=[];for(let k=0;k<N;k++)if(D[k]>=0){const j=4*k;if((k/S|0)<mid){M[j]=150;M[j+1]=145;M[j+2]=138;warm.push(k)}else{M[j]=236;M[j+1]=236;M[j+2]=240;cool.push(k)}}
      const w0=new Uint8Array(A.watch);HOOK.asmCmHandEdge(A,M,S,N);
      const took=ks=>ks.filter(k=>w0[k]>127&&A.watch[k]===0).length;
      let sum=0;for(let k=0;k<N;k++){let s=0;for(const z of Object.keys(A))s+=A[z][k];if(s&&s!==255)sum++}
      return {warm:warm.length,cool:cool.length,warmTaken:took(warm),coolTaken:took(cool),sum}},f);
    ok(r.warm>20&&r.cool>20,`the fixture's watch has pixels beside the shirt to repaint (${r.warm} as warm steel, ${r.cool} as cool cuff white)`);
    ok(r.warmTaken===0,`smooth warm-grey steel next to the shirt stays watch (${r.warmTaken} of ${r.warm} turned into shirt)`);
    ok(r.coolTaken>r.cool*.5,`smooth cool cuff white next to the shirt still becomes shirt (${r.coolTaken} of ${r.cool})`);
    ok(r.sum===0,`the shares still add up to 255 (${r.sum} off)`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['cmhandedge',cmhandedge],['cmcuffsteel',cmcuffsteel]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.assembled=true;   // assembled pictures on, as every part had them
