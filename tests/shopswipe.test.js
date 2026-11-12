// "What to buy": swiping the sheet down closes it, as on the Wardrobe's item sheet. The header (with the grabber) is a handle
// at any time, the content only while it is scrolled to the top; the sheet follows the finger and the backdrop lightens; past
// a quarter of its height, or with a flick, it closes, else it springs back. A redraw asked for during the swipe waits.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // a kept result, so opening the sheet runs no check; long enough to scroll
    await p.evaluate(()=>{items=[{id:'s1',type:'suit',primaryColor:'navy',pattern:'solid'},{id:'h1',type:'shirt',primaryColor:'white',pattern:'solid'}];dayRecs={};cache={};show('wardrobe');
      const cat=n=>({key:'c'+n,title:'Section '+n,verdict:'covered',own:null,notes:[...Array(8)].map((_,k)=>`Note ${k} of section ${n}`),recs:[]});
      shop={sig:shopSig(),at:Date.now(),res:{v:2,base:null,cats:[...Array(8)].map((_,n)=>cat(n)),top:[],occasions:[],checked:0,sims:1,months:6}}});
    const view=()=>p.evaluate(()=>{const v=document.querySelector('#shop-sheet'),r=v.getBoundingClientRect(),bd=getComputedStyle(document.querySelector('#shop-backdrop'));
      return {open:shopOpen,on:v.classList.contains('on'),vis:getComputedStyle(v).visibility,top:Math.round(r.top),scroll:Math.round(v.scrollTop),tall:v.scrollHeight-v.clientHeight,bd:bd.visibility,dim:+bd.opacity,busy:!!shopBusy,
        inline:v.style.transform+v.style.transition,grab:(g=>g?Math.round(g.getBoundingClientRect().width)+'px':'')(v.querySelector('.shop-top-head .shop-grab'))}});
    // every touch carries its own time (the sheet reads e.timeStamp), so a gesture's speed doesn't depend on how busy the machine is;
    // a gesture starts at the real time and each move is `ms` after the one before, however long sending it took
    const cdp=await ctx.newCDPSession(p);let clock=0;
    const T=(type,x,y,ms=16)=>{clock=type==='touchStart'?Math.max(clock+ms,Date.now()):clock+ms;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}],timestamp:clock/1000})};
    const drag=async(x,y0,y1,n=8,probe)=>{let mid=null;await T('touchStart',x,y0);for(let k=1;k<=n;k++){await T('touchMove',x,y0+(y1-y0)*k/n);await p.waitForTimeout(16);if(probe&&k===n)mid=await probe()}await T('touchEnd');await settle(p,500);return mid};
    const open=async()=>{await p.evaluate(()=>openShop());await settle(p,500)};
    ok(await p.evaluate(()=>!shopSwipeOn),'the swipe is not installed before the sheet is first opened');
    await open();let v=await view();const top0=v.top;
    ok(v.open&&v.on&&!v.busy&&v.tall>300&&v.bd==='visible'&&v.dim===1,`the sheet is open on the kept result and scrolls (${v.tall}px)`);
    ok(v.grab==='38px'&&await p.evaluate(()=>shopSwipeOn),'its header has a grabber, and opening the sheet installed the swipe');
    // from the content while it is scrolled to the top
    let mid=await drag(200,400,640,8,view);v=await view();
    ok(mid.top>top0+200&&mid.dim<1&&mid.open,`swiping down on the content drags the sheet with the finger and the backdrop lightens (top ${mid.top}px, backdrop ${mid.dim.toFixed(2)})`);
    ok(!v.open&&!v.on&&v.vis==='hidden'&&v.bd==='hidden'&&v.inline==='','letting go past a quarter of its height closes it');
    ok(await p.evaluate(()=>{const e=document.elementFromPoint(200,300);return !!e&&!e.closest('#shop-sheet,#shop-backdrop')}),'and the Wardrobe behind takes taps again');
    // a short, slow pull springs back
    await open();
    await T('touchStart',200,400);for(let k=1;k<=4;k++){await T('touchMove',200,400+12*k,60);await p.waitForTimeout(60)}await T('touchEnd');await settle(p,500);v=await view();
    ok(v.open&&v.top===top0&&v.dim===1&&v.inline==='',`a short, slow pull springs back (top ${v.top}px)`);
    // scrolled down: a downward swipe on the content scrolls it back up instead
    await p.evaluate(()=>document.querySelector('#shop-sheet').scrollTo(0,400));
    await drag(200,400,520,5);v=await view();
    ok(v.open&&v.top===top0&&v.scroll<400,`scrolled down, a swipe down on the content scrolls it back up and the sheet stays (scroll 400 → ${v.scroll})`);
    // ...but the header is a handle at any time
    await p.evaluate(()=>document.querySelector('#shop-sheet').scrollTo(0,400));
    await drag(200,top0+30,top0+400,8);v=await view();
    ok(!v.open&&v.vis==='hidden','swiping the header down closes it even when the content is scrolled');
    // a flick is enough; an upward or sideways swipe is not a pull
    await open();await drag(200,300,390,3);ok(!(await view()).open,'a quick flick down closes it');
    await open();await drag(200,500,300,6);v=await view();
    ok(v.open&&v.top===top0&&v.scroll>0,`a swipe up scrolls the content (scroll ${v.scroll})`);
    // (the swipe's momentum scrolls on for a moment and would undo a scrollTo: wait until it has stopped)
    const toTop=async()=>{await p.evaluate(async()=>{const s=document.querySelector('#shop-sheet');for(let same=0,last=-1;same<6;){await new Promise(r=>setTimeout(r,50));same=s.scrollTop===last?same+1:0;last=s.scrollTop}s.scrollTo(0,0)});await settle(p,200)};
    await toTop();
    await T('touchStart',120,400);for(let k=1;k<=6;k++){await T('touchMove',120+30*k,400+3*k);await p.waitForTimeout(16)}await T('touchEnd');await settle(p,400);v=await view();
    ok(v.open&&v.top===top0&&v.scroll===0,'a sideways swipe does not move the sheet');
    // a redraw asked for mid-swipe (a section arriving from the check) waits for the finger to lift
    await T('touchStart',200,400);for(let k=1;k<=4;k++){await T('touchMove',200,400+10*k,60);await p.waitForTimeout(60)}
    const held=await p.evaluate(()=>{shop.res.cats.push({key:'late',title:'Late section',verdict:'worth',own:null,notes:['Arrived during the swipe'],recs:[]});renderShop();
      return {drag:shopDrag,late:!!document.querySelector('#shop-c-late'),top:Math.round(document.querySelector('#shop-sheet').getBoundingClientRect().top)}});
    await T('touchEnd');await settle(p,500);v=await view();
    ok(held.drag&&!held.late&&held.top>top0,'a section arriving during a swipe is not drawn under the finger');
    ok(v.open&&v.top===top0&&await p.evaluate(()=>!!document.querySelector('#shop-c-late')&&!shopDrag&&!shopStale),'it is drawn when the finger lifts, and the sheet springs back');
    // the other ways out still work
    await p.touchscreen.tap(380,Math.max(2,top0-6));await settle(p,500);
    ok(!(await view()).open,'a tap on the backdrop above the sheet closes it');
    await open();await p.tap('#shop-sheet .pick-x');await settle(p,500);ok(!(await view()).open,'× closes it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
