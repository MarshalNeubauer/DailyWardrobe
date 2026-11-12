// Assembled pictures at 2048 (ASM_VER 3): the pixel distances tuned on 900px pictures scale with the picture (asmPx) and never shrink
// below what was tuned; every job asks the worker for the masters' size; the photos are kept as made (they were shrunk to 900px).
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>({px:[asmPx(4,900),asmPx(4,2048),asmPx(2,2048),asmPx(4,120)],size:ASM_SIZE,ver:ASM_VER,vest:ASM_VEST,zv:ASM_ZV,
      calib:asmCalibJob('tie').size,vestCalib:asmCalibJob('vest').size,vm:asmVestMasterJob(),cost:ASM_COST}));
    ok(r.px.join()==='4,9,5,4',`distances are as tuned at 900, about 2.3 times at 2048, and never smaller on a small picture (${r.px.join(', ')})`);
    ok(r.size===2048&&r.ver===3&&r.vest===3&&r.zv===9,`the third masters are 2048 (ASM_VER ${r.ver}, ASM_VEST ${r.vest}, zones version ${r.zv})`);
    ok(r.calib==='2048x2048'&&r.vestCalib==='2048x2048'&&r.vm.size==='2048x2048'&&r.vm.quality==='high',`calibration and waistcoat master jobs ask for 2048 (the waistcoat master at high quality)`);
    ok(/cut LOW/.test(r.vm.swap.text)&&/Do not move either hand/.test(r.vm.swap.text),'the waistcoat master is asked for cut low, the hands left where they are');
    ok(r.cost.piece===.14&&r.cost.master===.46,`the costs shown are the 2048 ones (a piece ${Math.round(r.cost.piece*100)}¢, the master ${Math.round(r.cost.master*100)}¢)`);
    const z=await p.evaluate(async()=>{const W=60,pic=(x0,y0,x1,y1)=>{const c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,W,W);g.fillStyle='#fff';g.fillRect(x0,y0,x1-x0,y1-y0);return c.toDataURL('image/png')};
      const z=await asmZonesFromImgs({jacket:pic(0,0,60,60),shirt:pic(20,0,40,30),tie:pic(25,0,35,40),watch:pic(30,30,40,40)},W),at=(s,x,y)=>z[s][y*W+x];
      const keys=['jacket','shirt','tie','watch','vest'].map(asmZoneKey);
      return {one:[at('jacket',5,5),at('shirt',21,5),at('tie',30,5),at('watch',35,35)].join(),over:at('jacket',30,5)+at('shirt',30,5)+at('tie',35,35),
        n:z.jacket.reduce((a,b)=>a+b,0),keys:new Set(keys).size===5&&keys.every(k=>/^c[0-9a-f]{16}$/.test(k))}});
    ok(z.one==='1,1,1,1'&&z.over===0,`zone pictures made outside the app: white is the piece, one zone per pixel, watch over tie over shirt over jacket (${z.one}; overlaps ${z.over})`);
    ok(z.keys,'each zone picture has a worker key of its own');
    // a piece that moved the master's green tie sideways: the green left in the shirt's zone is covered with the cloth beside it
    const k=await p.evaluate(()=>{const W=120,N=W*W,img=f=>{const d=new Uint8ClampedArray(4*N);for(let i=0;i<N;i++){const c=f(i%W,(i/W)|0);d.set([...c,255],4*i)}return new ImageData(d,W,W)};
      const G=[40,150,70],P=[230,180,200],Gr=[120,120,120],z={W,tie:new Uint8Array(N),shirt:new Uint8Array(N),jacket:new Uint8Array(N),watch:new Uint8Array(N)},lab=new Uint8Array(N);
      for(let i=0;i<N;i++){const x=i%W;if(x>=55&&x<70)z.tie[i]=1;else if(x>=30&&x<95){z.shirt[i]=1;lab[i]=2}else{z.jacket[i]=1;lab[i]=1}}
      const master=img(x=>x>=55&&x<70?G:x>=30&&x<95?[235,235,235]:Gr);
      const out=img(x=>x>=46&&x<70?G:x>=30&&x<95?(x%4<2?P:[210,160,180]):Gr);   // the shirt piece: its green 9px further left, a striped pink
      const n=asmKeyFill(out.data,lab,z,master,W);let green=0,stripes=0;for(let i=0;i<N;i++){if(!lab[i])continue;const j=4*i,o=out.data;if(o[j+1]-o[j]>40)green++;const x=i%W;if(lab[i]===2&&x>=46&&x<51&&(o[j]===230||o[j]===210)&&o[j]===o[j+16])stripes++}   // cloth, not a smear: its stripes still repeat every 4px
      return {n,green,stripes}});
    ok(k.n>0&&k.green===0,`green the master's tie left in another piece is cleaned up (${k.n} found, ${k.green} left)`);
    ok(k.stripes===5*120,`by a sideways copy of the cloth beside it, so its weave carries on (${k.stripes} of ${5*120} pixels in pattern)`);
    const src=fs.readFileSync(path.join(ROOT,'assemble.js'),'utf8');
    ok(!/shrinkUrl\([^)]*900\)/.test(src),'assembled-picture photos are kept as made, not shrunk to 900px');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
