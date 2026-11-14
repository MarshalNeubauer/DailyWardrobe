// The cuff rule in asmCmHandEdge (watch pixels beside the shirt that stay smooth and near-neutral become shirt: the cuff's shaded inner
// face) must not take the bracelet's steel (2026-11-14, shirt-open's top links: smooth warm-grey link faces next to the shirt were turned
// into shirt and painted in the shirt's colour). The rule now only takes cool pixels (blue >= red - 6): the cuff's white is cool, the steel
// warm grey (red 10-25 above blue). Checked on the 512 fixture (tests/fixtures/cm/shirt-tie/): the watch pixels next to the shirt are
// repainted in the master as smooth warm steel (top half of the watch) and smooth cool cuff white (bottom half), then the rule runs.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
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
      const w0=new Uint8Array(A.watch);asmCmHandEdge(A,M,S,N);
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
module.exports.assembled=true;
