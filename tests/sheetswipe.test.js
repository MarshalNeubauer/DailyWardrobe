// The item sheet's swipe-down on wide screens (2026-11-15, the owner's iPhone Duo unfolded, upright: "a little icon at the top
// inviting me to swipe it down, but it doesn't let me"). From 600px the sheet is a centred panel; it sat at 4vh, so on the Duo its
// grabber and the top of its header lay under the status bar, where iOS takes a downward pull for itself (Notification / Control
// Center) and the page never sees it. The panel now starts below the status bar (`--ivtop`), like the phone's sheet. A stand-in
// status bar (`--sat`, the property styles.css reads env(safe-area-inset-top) into) checks that geometry; touches (CDP in
// Chromium, tests/webkit.js on WebKit) and mouse drags (Pointer Events: an iPad-style trackpad or Pencil, a desktop mouse) on the
// grabber, the title and the content check the gesture at phone, unfolded-Duo, iPad and landscape sizes.
// Also the Add page's item card has a × in its top corner that does what its Cancel does (the owner's ask, same day).
// SHOTS=<dir> saves screenshots of the × (phone and wide, light and dark) and of the panel under a stand-in status bar.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const WK=process.env.TEST_BROWSER==='webkit',SHOTS=process.env.SHOTS;
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const SAT=59;   // an iPhone's status bar with the Dynamic Island, in CSS px
  try{
    for(const [w,h] of [[390,844],[690,960],[760,1000],[840,1100],[744,1133],[1024,1366],[1180,820]]){
      const tag=`${w}×${h}`;
      const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,...(WK?{}:{isMobile:true})});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(ph=>{items=[...Array(6)].map((_,n)=>({id:'s'+n,type:'shirt',primaryColor:'white',pattern:'solid',photo:ph,added:n}));flt='all';editing=null;show('wardrobe')},PH);
      await settle(p,600);
      const cdp=await ctx.newCDPSession(p);let clock=0;const T=(type,x,y,ms=16)=>{clock=type==='touchStart'?Math.max(clock+ms,Date.now()):clock+ms;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}],timestamp:clock/1000})};
      const at=()=>p.evaluate(()=>({top:document.querySelector('#item-view').getBoundingClientRect().top,dim:+getComputedStyle(document.querySelector('#item-backdrop')).opacity,ed:editing}));
      const touch=async(x,y0,y1,n=8,ms=16)=>{let mid;await T('touchStart',x,y0);for(let k=1;k<=n;k++){await T('touchMove',x,y0+(y1-y0)*k/n,ms);await p.waitForTimeout(ms);if(k===n)mid=await at()}await T('touchEnd',x,y1);await settle(p,500);return mid};
      const mouse=async(x,y0,y1,n=10)=>{let mid;await p.mouse.move(x,y0);await p.mouse.down();for(let k=1;k<=n;k++){await p.mouse.move(x,y0+(y1-y0)*k/n);await p.waitForTimeout(30);if(k===n)mid=await at()}await p.mouse.up();await settle(p,500);return mid};
      const open=async()=>{await p.evaluate(()=>{if(editing)closeItem()});await settle(p,500);await p.evaluate(()=>openItem('s3'));await settle(p,600);
        return p.evaluate(()=>{const v=document.querySelector('#item-view').getBoundingClientRect(),hd=document.querySelector('#ivhead').getBoundingClientRect(),t=document.querySelector('#iv-title').getBoundingClientRect();
          return {top:v.top,left:v.left,w:v.width,h:v.height,hb:hd.bottom,tx:t.left+10,ty:t.top+t.height/2}})};
      // under a status bar: the sheet (panel or not) and so its grabber start below it
      await p.evaluate(s=>document.documentElement.style.setProperty('--sat',s+'px'),SAT);
      let g=await open();
      ok(g.top>=SAT+8&&g.top+7>=SAT+8,`${tag}: under a ${SAT}px status bar the sheet starts below it (top ${Math.round(g.top)}px, grabber at ${Math.round(g.top+7)}px)`);
      if(w>=600)ok(Math.round(g.w)===Math.min(600,Math.round(w*.94))&&g.top+g.h<=h,`${tag}: still the centred panel, inside the screen (${Math.round(g.w)}px wide, bottom ${Math.round(g.top+g.h)})`);
      if(SHOTS&&w===690)await p.screenshot({path:`${SHOTS}/panel-690-statusbar59-${WK?'webkit':'chromium'}.png`});
      await p.evaluate(()=>document.documentElement.style.removeProperty('--sat'));
      // touch: from the grabber, the title, and the content at the top; the sheet follows the finger and the Wardrobe brightens
      for(const where of ['grabber','title','content']){
        g=await open();const x=where==='title'?g.tx:g.left+g.w/2,y=where==='grabber'?g.top+9:where==='title'?g.ty:g.hb+60;
        const mid=await touch(x,y,y+g.h*.5);const ed=await p.evaluate(()=>editing);
        ok(mid.ed==='s3'&&mid.top>g.top+g.h*.4&&mid.dim<1&&ed===null,`${tag}: a finger dragging the ${where} down moves the sheet with it (top ${Math.round(g.top)} → ${Math.round(mid.top)}) and closes it`);
      }
      g=await open();const m0=await touch(g.left+g.w/2,g.top+9,g.top+9+48,4,60);let s=await at();
      ok(m0.top>g.top+30&&s.ed==='s3'&&Math.abs(s.top-g.top)<1&&s.dim===1,`${tag}: a short, slow pull on the header springs back`);
      // a mouse / trackpad / Pencil: the header drags it the same way (Pointer Events); the content doesn't
      for(const where of ['grabber','title']){
        g=await open();const x=where==='title'?g.tx:g.left+g.w/2,y=where==='grabber'?g.top+9:g.ty;
        const mid=await mouse(x,y,y+g.h*.5);const ed=await p.evaluate(()=>editing);
        ok(mid.ed==='s3'&&mid.top>g.top+g.h*.4&&mid.dim<1&&ed===null,`${tag}: a mouse dragging the ${where} down moves the sheet (top ${Math.round(g.top)} → ${Math.round(mid.top)}) and closes it`);
      }
      g=await open();await mouse(g.left+g.w/2,g.top+9,g.top+9+40,8);s=await at();
      ok(s.ed==='s3'&&Math.abs(s.top-g.top)<1,`${tag}: a short mouse drag springs back`);
      await mouse(g.left+g.w/2,g.hb+60,g.hb+60+g.h*.5);s=await at();
      ok(s.ed==='s3'&&Math.abs(s.top-g.top)<1,`${tag}: a mouse drag on the content doesn't move the sheet`);
      await p.evaluate(()=>closeItem());await settle(p,500);
      ok(!errs.length,`${tag}: no page errors (${errs.join('; ')})`);
      await ctx.close();
    }
    // the Add page's item card: a × in its top corner does what Cancel does
    for(const [w,h,scheme] of [[390,844,'light'],[390,844,'dark'],[690,960,'light'],[690,960,'dark']]){
      const tag=`${w}px ${scheme}`;
      const ctx=await browser.newContext({viewport:{width:w,height:h},colorScheme:scheme,hasTouch:true,...(WK?{}:{isMobile:true})});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{queue.length=0;show('add')});await settle(p,500);
      const cards=()=>p.evaluate(()=>({q:queue.length,n:document.querySelectorAll('#queue .card').length}));
      await p.click('text=Add without photo');await settle(p,500);
      const x=await p.evaluate(()=>{const c=document.querySelector('#queue .card'),b=c&&c.querySelector(':scope>.qx');if(!b)return null;const r=b.getBoundingClientRect(),cr=c.getBoundingClientRect(),st=getComputedStyle(b);
        return {w:r.width,h:r.height,right:cr.right-r.right,top:r.top-cr.top,label:b.getAttribute('aria-label'),txt:b.textContent,color:st.color,bg:getComputedStyle(document.body).backgroundColor,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===b}});
      ok(x&&x.w>=44&&x.h>=44&&x.right<=8&&x.top<=8&&x.label==='Close'&&x.txt==='×'&&x.hit,`${tag}: the item card has a × (Close) in its top right corner, 44px to tap (${JSON.stringify(x)})`);
      ok((await cards()).q===1&&await p.evaluate(()=>[...document.querySelectorAll('#queue .card button')].some(b=>b.textContent==='Cancel')),`${tag}: Cancel is still at the bottom`);
      if(SHOTS){await p.evaluate(()=>{scrollTo(0,0);const c=document.querySelector('#queue .card');scrollTo(0,c.getBoundingClientRect().top+scrollY-160)});await p.waitForTimeout(200);await p.screenshot({path:`${SHOTS}/add-x-${w}-${scheme}-${WK?'webkit':'chromium'}.png`})}
      await p.click('#queue .card .qx');await settle(p,400);let c=await cards();
      ok(c.q===0&&c.n===0,`${tag}: the × closes the card, as Cancel does`);
      await p.click('text=Add without photo');await settle(p,400);await p.click('#queue .card button:text-is("Cancel")');await settle(p,400);c=await cards();
      ok(c.q===0&&c.n===0,`${tag}: (and Cancel still closes it)`);
      ok(!errs.length,`${tag}: no page errors (${errs.join('; ')})`);
      await ctx.close();
    }
  }finally{await browser.close()}
};
