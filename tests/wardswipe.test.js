// Wardrobe: swiping left/right moves between the type filters (All, Suit, Blazer, …) in chip order, skipping empty types.
// Only the grid slides; the chips row keeps its own horizontal scroll; nothing happens while an item is open.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    for(const [name,[w,h]] of Object.entries({'iPhone 13':[390,844],'Duo unfolded':[626,890]})){
      const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>{const I=(id,type,primaryColor)=>({id,type,primaryColor,pattern:'solid',added:1});
        items=[I('s1','suit','navy'),I('s2','suit','grey'),I('b1','blazer','tan'),I('t1','tie','burgundy'),I('h1','shoes','brown')];flt='all';editing=null;cache={};show('wardrobe')});
      await p.waitForTimeout(100);
      const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
      const y=await p.evaluate(()=>{const b=document.querySelector('#wardrobe .grid').getBoundingClientRect();return Math.round(b.y+40)});
      let mid=null;
      const swipe=async(x0,x1,yy=y,probe)=>{await T('touchStart',x0,yy);for(let k=1;k<=6;k++){await T('touchMove',x0+(x1-x0)*k/6,yy+2);await p.waitForTimeout(16);if(probe&&k===5)mid=await probe()}await T('touchEnd');await settle(p,450)};
      const state=()=>p.evaluate(()=>({flt,on:document.querySelector('#wardrobe .chip.on').textContent,n:document.querySelectorAll('#wardrobe .grid > .gi').length,
        chips:Math.round(document.querySelector('#wardrobe .chips').getBoundingClientRect().y),slide:(document.querySelector('#wslide')||{}).style?.transform||'',
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
      const s0=await state();
      await swipe(w-80,w-300,y,state);let s=await state();
      ok(s.flt==='suit'&&s.on.startsWith('Suit')&&s.n===2,`${name}: swiping left goes from All to Suits (${s.flt}, ${s.n} items)`);
      ok(mid&&mid.slide.includes('translateX(-')&&mid.chips===s0.chips,`${name}: the grid follows the finger; the chips stay put`);
      ok(mid.overflow===0&&s.overflow===0,`${name}: page never wider than the screen`);
      await swipe(w-80,w-300);s=await state();ok(s.flt==='blazer'&&s.n===1,`${name}: next swipe goes to Blazers`);
      await swipe(w-80,w-300);s=await state();ok(s.flt==='tie',`${name}: empty types (dress pants, shirts) are skipped (${s.flt})`);
      await swipe(80,300);s=await state();ok(s.flt==='blazer',`${name}: swiping right goes back`);
      await p.evaluate(()=>{flt='shoes';renderWardrobe()});await swipe(w-80,w-300);s=await state();ok(s.flt==='shoes',`${name}: the last type stays put on a further swipe`);
      await p.evaluate(()=>{flt='all';renderWardrobe()});await swipe(80,300);s=await state();ok(s.flt==='all'&&s.slide.includes('translateX(0'),`${name}: All is the first; a swipe right springs back`);
      await swipe(10,250);s=await state();ok(s.flt==='all',`${name}: swipes from the screen edge are ignored`);
      const cy=s0.chips+10;await swipe(w-80,w-300,cy);s=await state();ok(s.flt==='all',`${name}: dragging the chips row scrolls it instead of changing type`);
      await p.evaluate(()=>openItem('s1'));await settle(p,400);
      const oy=await p.evaluate(()=>Math.round(document.querySelector('#gi-s1').getBoundingClientRect().y+20));
      await swipe(w-80,w-300,oy);s=await state();ok(s.flt==='all'&&await p.evaluate(()=>editing==='s1'),`${name}: no type change while an item is open`);
      await p.evaluate(()=>{editing=null;flt='all';renderWardrobe();document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))});
      ok(await p.evaluate(()=>flt)==='suit',`${name}: the right arrow key moves to the next type`);
      await p.evaluate(()=>{flt='socks';renderWardrobe()});
      ok(await p.evaluate(()=>{const c=document.querySelector('#wardrobe .chips'),on=c.querySelector('.chip.on'),a=c.getBoundingClientRect(),b=on.getBoundingClientRect();return b.left>=a.left-1&&b.right<=a.right+1}),`${name}: the selected chip is scrolled into view`);
      ok(errs.length===0,`${name}: no page errors (${errs.join('; ')})`);
      await ctx.close();
    }
  }finally{await browser.close()}
};
