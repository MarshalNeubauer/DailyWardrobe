// The Wardrobe's boxes fit the screen (30 of them: most are off screen, where the placeholder size applies) (2026-11-14: `contain-intrinsic-size:auto 230px` on .gi held every box at least 230 px wide, so two
// columns ran off a phone's screen and the Wardrobe looked zoomed in; the page itself didn't scroll sideways, so the page checks missed it)
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{for(const w of [320,390,412,540]){
    const p=await browser.newPage({viewport:{width:w,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');g.fillStyle='#777';g.fillRect(0,0,800,600);const ph=c.toDataURL('image/jpeg',.7);
      for(let k=0;k<30;k++){const it={id:'w'+k,type:k%2?'suit':'shirt',primaryColor:'grey',pattern:'solid',photo:ph,name:'A long name for a piece of clothing number '+k,added:Date.now()};await put(it);items.push(it)}
      show('wardrobe');await new Promise(r=>setTimeout(r,400));const grid=document.querySelector('#wardrobe .grid').getBoundingClientRect();
      const boxes=[...document.querySelectorAll('#wardrobe .gi')].map(e=>e.getBoundingClientRect());
      return {n:boxes.length,gridR:Math.round(grid.right),maxR:Math.round(Math.max(...boxes.map(b=>b.right))),cols:new Set(boxes.map(b=>Math.round(b.left))).size}});
    ok(r.n===30&&r.maxR<=r.gridR+1&&r.cols>=2&&errs.length===0,`at ${w} px the Wardrobe's boxes fit inside the grid, ${r.cols} across (rightmost ${r.maxR}, grid ${r.gridR})`);
    await p.close()}
  }finally{await browser.close()}
};
