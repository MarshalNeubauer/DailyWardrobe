// Solved cloth positions (asm-color.js asmGeoPrep, 2026-11-14): the two pictures per master decode exactly at their own size, are read
// between pixel centres of the same piece only, scale with another painting size without blending pieces, and are part of a master only
// once the manifest lists them (then their dates are in the looks' keys).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const G=ASM_GEO_PX,enc=f=>{const c=document.createElement('canvas');c.width=c.height=G;const x=c.getContext('2d'),d=x.createImageData(G,G);
        // left half piece 1, right half a sleeve part (14); the top rows nothing
        for(let y=0;y<G;y++)for(let X=0;X<G;X++){const j=4*(y*G+X),r=y<8?0:X<G/2?1:14,v=r?Math.round((f(X,y)+1024)*16):0;d.data[j]=v>>8;d.data[j+1]=v&255;d.data[j+2]=r;d.data[j+3]=255}
        x.putImageData(d,0,0);return c.toDataURL('image/png')};
      const job={geoU:enc((x,y)=>x<G/2?1.5*x+.25:-.5*x+2000.0625),geoV:enc((x,y)=>y-3)};
      const A=await asmGeoPrep(job,{S:G,N:G*G}),k=100*G+20,ke=100*G+G/2-1;
      const half=await asmGeoPrep(job,{S:G/2,N:G*G/4}),kh=50*(G/2)+10;
      return {u:A.U[k],v:A.V[k],r:A.R[k],r2:A.R[100*G+G-5],top:A.R[3*G+5],mid:asmUvAt(A,G,k,21,100.5),edge:asmUvAt(A,G,ke,G/2,100.5),
        hu:half.U[kh],hv:half.V[kh],hr:half.R[kh],hr2:half.R[50*(G/2)+G/2-3],none:await asmGeoPrep({},{S:G,N:G*G})}});
    ok(r.u===30.25&&r.v===97&&r.r===1&&r.r2===14&&r.top===0,`positions and pieces decode exactly at the maps' size (${r.u}, ${r.v}, piece ${r.r}, the sleeve part ${r.r2})`);
    ok(Math.abs(r.mid[0]-31)<1e-3&&Math.abs(r.mid[1]-97)<1e-3&&Math.abs(r.edge[0]-(1.5*(1023)+.25))<1e-3,`read between pixel centres, never across into another piece (${r.mid.map(v=>v.toFixed(3))}; at the edge ${r.edge[0].toFixed(3)})`);
    // at half the size: the pixel at (10, 50) covers map pixels 20..21 x 100..101, centre (21, 101) in the map, half way between pixel
    // centres 20 and 21 (u 30.25, 31.75) and rows 100 and 101 (v 97, 98): u 31 and v 97.5 map px, 15.5 and 48.75 px here
    ok(Math.abs(r.hu-15.5)<1e-3&&Math.abs(r.hv-48.75)<1e-3&&r.hr===1&&r.hr2===14,`another painting size: positions scale with the picture, pieces stay whole (${r.hu.toFixed(3)}, ${r.hv.toFixed(3)}, pieces ${r.hr} / ${r.hr2})`);
    ok(r.none===null,'no maps in the job: nothing (the painter as before)');
    // the manifest decides: without the maps listed a master's assets and its looks' keys are as before
    const m=await p.evaluate(()=>{const before=asmCmAssets('suit').length,rev0=asmCmRev('suit'),u=asmCmKey('suit','geo/u'),v=asmCmKey('suit','geo/v'),M=asmCmMfNow();
      const keep=JSON.stringify(M.keys);M.keys[u]=111;const half=asmCmAssets('suit').length;M.keys[v]=222;const after=asmCmAssets('suit'),rev1=asmCmRev('suit');
      M.keys=JSON.parse(keep);return {before,half,after:after.length,has:after.includes(u)&&after.includes(v),rev0,rev1,shirt:asmCmGeoKeys('shirt-tie').length}});
    ok(m.half===m.before&&m.after===m.before+2&&m.has,`the maps join a master only when the manifest lists both (${m.before} -> ${m.half} with one -> ${m.after} with both)`);
    ok(m.rev1!==m.rev0,'their dates are in the looks\' keys (a new map paints the looks again)');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it calls the colour-coded painter's code (asm-color.js)
