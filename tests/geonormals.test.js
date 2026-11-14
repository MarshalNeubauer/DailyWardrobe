// Cloth lengths from a surface-normal map (asmGeoPrep, the 2026-11-14 trial): on a known shape the measured cloth positions must be the
// shape's own. A cylinder of radius R about the fly: a point x from the axis lies R·asin(x/R) of cloth from it (the formula the painter's
// sleeves and legs use); a flat panel facing the camera is one pixel of cloth per pixel; a plane tilted by 60° is two.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const S=512,N=S*S,R=180,xf=256;
      // the normal map: a cylinder about x = xf for the trousers rows (100..299), a 60° tilted plane below (300..511), flat above
      const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),d=x.createImageData(S,S);
      for(let y=0;y<S;y++)for(let X=0;X<S;X++){let n=[0,0,1];const u=(X+.5-xf)/R;
        if(y>=100&&y<300&&Math.abs(u)<.96)n=[u,0,Math.sqrt(1-u*u)];else if(y>=300)n=[Math.sin(Math.PI/3),0,Math.cos(Math.PI/3)];
        const j=4*(y*S+X);d.data[j]=Math.round((n[0]+1)*127.5);d.data[j+1]=Math.round((n[1]+1)*127.5);d.data[j+2]=Math.round((n[2]+1)*127.5);d.data[j+3]=255}
      x.putImageData(d,0,0);const normals=c.toDataURL('image/png');
      const tr=new Uint8Array(N).fill(255),P={S,N,A:{trousers:tr},legs:{xf:new Float32Array(S).fill(xf),y0:0,y1:S-1,yc:200},geo:null};
      const G=await asmGeoPrep({normals},P),at=(X,y)=>G.tr.X[y*S+X]-G.tr.X[y*S+xf];
      const cyl=[60,120,160].map(dx=>({dx,got:at(xf+dx,200),want:R*Math.asin((dx)/R)}));
      const flat=at(xf+100,50),tilt=at(xf+100,400),tiltY=G.tr.Y[450*S+100]-G.tr.Y[420*S+100];
      return {cyl,flat,tilt,tiltY}});
    for(const c of r.cyl)ok(Math.abs(c.got-c.want)/c.want<.02,`a cylinder: ${c.dx} px from the axis is ${c.got.toFixed(1)} px of cloth (R·asin: ${c.want.toFixed(1)})`);
    ok(Math.abs(r.flat-100)<1.5,`a flat panel facing the camera: 100 px is ${r.flat.toFixed(1)} of cloth`);
    ok(Math.abs(r.tilt-200)/200<.03&&Math.abs(r.tiltY-30)<1,`a panel turned 60° across: 100 px is ${r.tilt.toFixed(1)} of cloth (2x), 30 px down is ${r.tiltY.toFixed(1)} (it doesn't lean that way)`);
    // solved cloth positions (flatten.py's uv-u/uv-v pictures): decoded exactly, and read between pixel centres of the same garment only
    const uv=await p.evaluate(async()=>{const S=64,N=S*S,enc=(f)=>{const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),d=x.createImageData(S,S);
        for(let y=0;y<S;y++)for(let X=0;X<S;X++){const r=X<32?1:3,v=Math.round((f(X,y)+1024)*16),j=4*(y*S+X);d.data[j]=v>>8;d.data[j+1]=v&255;d.data[j+2]=r;d.data[j+3]=255}x.putImageData(d,0,0);return c.toDataURL('image/png')};
      const G=await asmGeoPrep({geoU:enc((x,y)=>1.5*x+.25),geoV:enc((x,y)=>y-3)},{S,N});const k=10*S+20;
      return {u:G.uv.U[k],v:G.uv.V[k],r:G.uv.R[k],mid:asmUvAt(G.uv,S,k,21,10.5),edge:asmUvAt(G.uv,S,10*S+31,32,10.5),r2:G.uv.R[10*S+40]}});
    ok(uv.u===30.25&&uv.v===7&&uv.r===1&&uv.r2===3,`positions and garments decode exactly (${uv.u}, ${uv.v}, garment ${uv.r})`);
    ok(Math.abs(uv.mid[0]-30.25-.75)<1e-3&&Math.abs(uv.mid[1]-7)<1e-3&&Math.abs(uv.edge[0]-(1.5*31+.25))<1e-3,`read between pixel centres, never across into another garment (${uv.mid.map(v=>v.toFixed(3))}; at the edge ${uv.edge[0].toFixed(3)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it calls the colour-coded painter's code (asm-color.js)
