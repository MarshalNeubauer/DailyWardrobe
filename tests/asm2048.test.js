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
    const src=fs.readFileSync(path.join(ROOT,'assemble.js'),'utf8');
    ok(!/shrinkUrl\([^)]*900\)/.test(src),'assembled-picture photos are kept as made, not shrunk to 900px');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
