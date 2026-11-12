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
    const src=fs.readFileSync(path.join(ROOT,'assemble.js'),'utf8');
    ok(!/shrinkUrl\([^)]*900\)/.test(src),'assembled-picture photos are kept as made, not shrunk to 900px');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
