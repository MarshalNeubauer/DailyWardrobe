// Cloth from an item's close-up (asm-color.js asmCu*, 2026-11-14): which items take it (not near-black cloth: the owner kept the current
// painter for his black suit), a tile whose mean is the item's colour, a photo's soft blotches flattened out of it (his Medium Grey came
// out a patchwork), and a fine or worsted cloth's grain capped at ASM_CU.fine (his "half strength for medium grey").
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{
      // a close-up: strong fine grain on mid grey, with a soft dark blotch a quarter of the picture across
      const W=840,c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d'),im=g.createImageData(W,W);let s=7;const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
      for(let y=0;y<W;y++)for(let x=0;x<W;x++){const dx=(x-420)/110,dy=(y-420)/110,blot=1-.12*Math.exp(-(dx*dx+dy*dy)),v=Math.max(0,Math.min(255,(70+110*rnd())*blot)),j=4*(y*W+x);im.data[j]=im.data[j+1]=im.data[j+2]=v;im.data[j+3]=255}
      g.putImageData(im,0,0);const tex=c.toDataURL('image/png');
      const mk=(col,pattern)=>({id:'cu'+col+pattern,type:'suit',primaryColor:col,pattern,texture:tex});
      const grey=mk('grey','twill'),fine=mk('grey','own-fine-worsted-melange-twill'),black=mk('black','twill');
      const T=await asmCuTile1(grey),F=await asmCuTile1(fine),n=T.TW*T.TH;let m=0;for(let k=0;k<n;k++)m+=T.t[3*k+1];m/=n;
      // what is left of anything broad: the tile's 32-texel block means against its mean
      let lo=9,hi=0;for(let by=0;by<T.TH;by+=32)for(let bx=0;bx<T.TW;bx+=32){let a=0;for(let y=0;y<32;y++)for(let x=0;x<32;x++)a+=T.t[3*((by+y)*T.TW+bx+x)+1];a/=1024;if(a<lo)lo=a;if(a>hi)hi=a}
      // a well-lit light grey cloth with no paper: its light threads are not paper
      for(let k=0;k<W*W;k++){const v=150+90*rnd();im.data[4*k]=im.data[4*k+1]=im.data[4*k+2]=v}g.putImageData(im,0,0);const B=await asmCuTile1({...mk('grey','twill'),id:'cubright',texture:c.toDataURL('image/png')});
      // and with a strip of white paper along one edge the patch keeps off it
      g.fillStyle='#fbfbfb';g.fillRect(0,0,W,150);const Pp=await asmCuTile1({...mk('grey','twill'),id:'cupaper',texture:c.toDataURL('image/png')});
      return {bright:!!B,offPaper:!!Pp&&Pp.cu.y*2>=150,wantsGrey:asmCuWants(grey,'twill'),wantsBlack:asmCuWants(black,'twill'),wantsBands:asmCuWants(grey,'bands'),noTex:asmCuWants({...grey,texture:''},'twill'),
        mean:m/T.c[1],broad:(hi-lo)/m,gain:T.cu.gain,shown:T.cu.shown,fgain:F.cu.gain,isFine:asmCuFine(fine)&&!asmCuFine(grey),tagDiff:asmCuTag('jacket',grey)!==''&&asmCuTag('jacket',black)===''}});
    ok(r.wantsGrey&&!r.wantsBands&&!r.noTex,'a plain or twill cloth with a close-up takes its cloth from it; a jacket read in bands, or one without a close-up, does not');
    ok(!r.wantsBlack&&r.tagDiff,'near-black cloth stays on the current painter, and its key carries no close-up tag');
    ok(Math.abs(r.mean-1)<.03,`the tile's mean is the item's colour (${r.mean.toFixed(3)} of it)`);
    ok(r.broad<.04,`a soft blotch of the photo is flattened out of the tile (its 32-texel blocks within ${(100*r.broad).toFixed(1)}% of each other)`);
    ok(r.shown>ASM_CU_FINE_T&&r.gain>=1&&r.isFine&&Math.abs(r.fgain*r.shown-ASM_CU_FINE_T)<.02,`a fine or worsted cloth's grain is capped (${r.fgain} of its strength, ${r.shown} seen in the close-up), another cloth's is not (${r.gain})`);
    ok(r.bright,'a bright neutral cloth with no paper in the close-up still gives a tile (its light threads are not paper)');
    ok(r.offPaper,'a strip of white paper along an edge is kept out of the patch');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
const ASM_CU_FINE_T=.5;
