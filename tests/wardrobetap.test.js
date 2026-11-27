// The Wardrobe's item sheet: taps and swipes.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/wardrobetap.test.js ---- */
// Wardrobe: tapping an item (photo or name) opens it in a sheet that slides up over the Wardrobe: the full width of a phone, up
// to just under the top of the screen; a centred panel from 600px. The grid behind never moves, so closing puts you back where
// you were. Swiping the sheet down closes it (by the header at any time, by the content once it is scrolled to the top), and so
// do Done in the bar at the bottom, a tap on the strip above the sheet, the phone's Back button and Esc; the photo is no longer
// a hidden close button.
// ‹ › beside Done, a sideways swipe and the arrow keys go to the previous / next item; closing on another item than the one
// opened brings that one's box into view. Delete sits alone at the end of the page.
const wardrobetap=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    const rect=id=>p.evaluate(id=>{const r=document.getElementById('gi-'+id).getBoundingClientRect();return {top:Math.round(r.top),left:Math.round(r.left),width:Math.round(r.width)}},id);
    const view=()=>p.evaluate(()=>{const v=document.querySelector('#item-view'),r=v.getBoundingClientRect(),bar=v.querySelector('.ivbar').getBoundingClientRect(),b=v.querySelector('#ivbody');
      return {on:v.classList.contains('on'),shown:getComputedStyle(v).display!=='none',ed:HOOK.editing,w:Math.round(r.width),h:Math.round(r.height),vt:Math.round(r.top),vb:Math.round(r.bottom),bd:getComputedStyle(document.querySelector('#item-backdrop')).display,title:v.querySelector('#iv-title').textContent,count:(v.querySelector('.pcount')||{}).textContent,
        barBottom:Math.round(bar.bottom),top:b.scrollTop,sy:Math.round(scrollY),inert:document.querySelector('main').inert,prev:v.querySelector('#iv-prev').disabled,next:v.querySelector('#iv-next').disabled}});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{HOOK.CK_OPEN['*']=true});
    // ten shirts in a two-column grid, newest first: s9 s8 / s7 s6 / s5 s4 / ...; then a tie without a photo
    await p.evaluate(ph=>{HOOK.items=[...Array(10)].map((_,n)=>({id:'s'+n,type:'shirt',primaryColor:n%2?'white':'lightblue',pattern:'solid',photo:ph,added:n}));
      HOOK.items.push({id:'t',type:'tie',primaryColor:'navy',pattern:'solid',added:0});HOOK.flt='all';HOOK.editing=null;HOOK.show('wardrobe')},PH);
    await p.waitForFunction(()=>!document.querySelector('#wardrobe').getAnimations().length);   // the page has eased in (pageIn)
    await p.evaluate(()=>window.scrollTo(0,document.getElementById('gi-s7').getBoundingClientRect().top+scrollY-120));
    const y0=await p.evaluate(()=>Math.round(scrollY)),b6=await rect('s6'),b7=await rect('s7');
    // open: tap the photo
    await p.tap('#gi-s6 .giopen img');
    const anim=await p.evaluate(()=>document.querySelector('#item-view').getAnimations().length);await settle(p,500);
    let v=await view();
    ok(v.on&&v.ed==='s6'&&v.w===390&&v.vt===36&&v.vb===844&&v.bd==='block',`tapping an item's photo opens it in a sheet: the full width, from ${v.vt}px below the top to the bottom, the Wardrobe dimmed behind`);
    ok(anim>0,`the sheet slides up instead of jumping (${anim} animations)`);
    ok(/light blue/i.test(v.title)&&v.count==='4 of 11','its header names the item and where it is in the list ('+v.title+', '+v.count+')');
    ok(await p.evaluate(()=>!!document.querySelector('#item-view .pair')&&!!document.querySelector('#item-view .phtools')&&!!document.querySelector('#item-view select')),'the sheet has the photo beside the swatch, the photo tools and the tags');
    const g6=await rect('s6'),g7=await rect('s7');
    ok(v.sy===y0&&g6.top===b6.top&&g6.left===b6.left&&g6.width===b6.width&&g7.top===b7.top,'the grid behind does not move or reshuffle');
    ok(v.barBottom===844&&v.inert,'Done sits in a bar at the bottom of the screen; the app behind takes no taps');
    ok(await p.evaluate(()=>document.querySelectorAll('#wardrobe .grid .gi .btns, #wardrobe .grid select').length===0),'the boxes in the grid have no buttons (no Delete one tap away)');
    // the bar stays put however far the page is scrolled
    await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,9999));
    const end=await p.evaluate(()=>{const v=document.querySelector('#item-view'),bar=v.querySelector('.ivbar').getBoundingClientRect(),del=v.querySelector('.ivin > :last-child button'),d=del.getBoundingClientRect();
      return {scrolled:v.querySelector('#ivbody').scrollTop>100,bar:Math.round(bar.bottom),del:del.textContent,danger:del.classList.contains('danger'),above:d.bottom<=bar.top,page:Math.round(scrollY)}});
    ok(end.scrolled&&end.bar===844&&end.page===y0,'scrolling the sheet leaves Done where it is and does not scroll the Wardrobe behind');
    ok(end.del==='Delete item'&&end.danger&&end.above,'Delete is the last thing in the sheet, on its own');
    // the photo is not a close button any more
    await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,0));await p.tap('#item-view .phfig img');await p.tap('#item-view .tagsw');await settle(p,300);
    ok((await view()).ed==='s6','tapping the photo or the swatch does not close the sheet');
    // Done closes; nothing has moved
    await p.tap('#item-view .ivdone');await settle(p,500);v=await view();const e6=await rect('s6');
    ok(v.ed===null&&!v.on&&!v.shown&&!v.inert,'Done closes the sheet');
    ok(v.sy===y0&&e6.top===b6.top&&e6.left===b6.left,`and the Wardrobe is exactly where it was (scroll ${y0} → ${v.sy})`);
    // swiping down closes it: from the content while it is scrolled to the top
    // each touch carries its own time, `ms` after the one before (the sheet reads a flick's speed from e.timeStamp): a busy
    // machine that handles the moves late no longer turns a flick into a slow pull
    const cdp=await ctx.newCDPSession(p);let clock=0;const T=(type,x,y,ms=16)=>{clock=type==='touchStart'?Math.max(clock+ms,Date.now()):clock+ms;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}],timestamp:clock/1000})};
    const drag=async(x,y0,y1,n=8,probe)=>{let mid=null;await T('touchStart',x,y0);for(let k=1;k<=n;k++){await T('touchMove',x,y0+(y1-y0)*k/n);await p.waitForTimeout(16);if(probe&&k===n)mid=await probe()}await T('touchEnd');await settle(p,500);return mid};
    const pos=()=>p.evaluate(()=>({top:Math.round(document.querySelector('#item-view').getBoundingClientRect().top),dim:+getComputedStyle(document.querySelector('#item-backdrop')).opacity,ed:HOOK.editing}));
    await p.tap('#gi-s6 .giopen');await settle(p,500);
    let mid=await drag(200,400,640,8,pos);v=await view();
    ok(mid.top>36+200&&mid.dim<1&&mid.ed==='s6',`swiping down on the sheet's content drags the sheet with the finger and the Wardrobe brightens (top ${mid.top}px)`);
    ok(v.ed===null&&!v.shown&&v.bd==='none'&&v.sy===y0,'letting go past a quarter of its height closes it');
    // a short pull springs back
    await p.tap('#gi-s6 .giopen');await settle(p,500);
    await T('touchStart',200,400);for(let k=1;k<=4;k++){await T('touchMove',200,400+12*k,60);await p.waitForTimeout(60)}await T('touchEnd');await settle(p,400);v=await view();
    ok(v.ed==='s6'&&v.vt===36,'a short, slow pull springs back');
    // scrolled down: a downward swipe on the content scrolls it back up instead
    await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,400));
    await drag(200,400,520,5);v=await view();
    ok(v.ed==='s6'&&v.vt===36&&v.top<400,`scrolled down, a swipe down on the content scrolls it back up and the sheet stays (scroll 400 → ${v.top})`);
    // ...but the header is a handle at any time
    await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,400));
    await drag(200,62,420,8);v=await view();
    ok(v.ed===null&&!v.shown,'swiping the header down closes it even when the content is scrolled');
    // a flick is enough; a swipe that starts sideways is not a pull
    await p.tap('#gi-s6 .giopen');await settle(p,500);
    await drag(200,300,390,3);ok((await view()).ed===null,'a quick flick down closes it');
    await p.tap('#gi-s6 .giopen');await settle(p,500);
    await p.touchscreen.tap(200,16);await settle(p,500);v=await view();
    ok(v.ed===null&&!v.shown,'a tap on the strip of Wardrobe above the sheet closes it');
    // the name opens it too; the phone's Back button closes it
    await p.tap('#gi-s9 .giopen b');await settle(p,500);ok((await view()).ed==='s9','tapping an item\'s name opens it');
    await p.goBack();await settle(p,500);v=await view();
    ok(v.ed===null&&!v.shown&&v.sy===y0&&await p.evaluate(()=>!document.querySelector('#wardrobe').hidden),'the Back button closes the sheet and stays in the Wardrobe');
    // previous / next: the buttons, a swipe, the arrow keys
    await p.tap('#gi-s9 .giopen');await settle(p,500);v=await view();
    ok(v.prev&&!v.next&&v.count==='1 of 11','on the first item, previous is switched off');
    await p.tap('#iv-next');await settle(p,400);v=await view();ok(v.ed==='s8'&&v.count==='2 of 11'&&!v.prev,'› goes to the next item');
    const swipe=async(x0,x1,y=420)=>{await T('touchStart',x0,y);for(let k=1;k<=6;k++){await T('touchMove',x0+(x1-x0)*k/6,y+2);await p.waitForTimeout(16)}await T('touchEnd');await settle(p,450)};
    // (the first dropdown brought on screen: the 3-step card under Read color and texture pushes the Details card down, 2026-11-15)
    const sy=await p.evaluate(()=>{const s=document.querySelector('#item-view select');s.scrollIntoView({block:'center'});const r=s.getBoundingClientRect();return Math.round(r.top+r.height/2)});
    ok(await p.evaluate(y=>!!document.elementFromPoint(310,y).closest('select'),sy),'(the swipe below starts on a dropdown)');
    await swipe(310,90,sy);ok((await view()).ed==='s7','a swipe to the left goes to the next item, even when it starts on a dropdown');
    await swipe(90,310);ok((await view()).ed==='s8','a swipe to the right goes back');
    await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));ok((await view()).ed==='s7','the right arrow key goes to the next item');
    await p.evaluate(()=>{for(let k=0;k<8;k++)HOOK.stepItem(1)});await settle(p,400);v=await view();
    ok(v.ed==='t'&&v.next&&v.count==='11 of 11'&&v.top===0,'on the last item, next is switched off');
    ok(await p.evaluate(()=>!document.querySelector('#item-view .pair')&&!!document.querySelector('#item-view .ivdraw svg')),'an item without a photo shows its drawing');
    await swipe(310,90);ok((await view()).ed==='t','a swipe past the last item springs back');
    // closing on another item than the one opened: its box is brought into view
    await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await settle(p,500);v=await view();
    const tt=await p.evaluate(()=>{const r=document.querySelector('#gi-t').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight});
    ok(v.ed===null&&!v.shown,'Esc closes the sheet');ok(tt&&v.sy!==y0,'closing on another item than the one opened scrolls the Wardrobe to that item\'s box');
    // open → close → open at once: the history entry of the first doesn't close the second
    await p.evaluate(()=>{HOOK.openItem('s5');HOOK.closeItem();HOOK.openItem('s4')});await settle(p,500);await p.waitForTimeout(100);
    ok((await view()).ed==='s4','closing one item and opening another straight away keeps the second open');
    await p.goBack();await settle(p,500);ok((await view()).ed===null,'and Back still closes it');
    // editing keeps the page and its scroll position
    // (scrolled so the Color button is in view: since the Color & texture card it sits lower than 160 px; a click on it scrolled the page)
    await p.tap('#gi-s3 .giopen');await settle(p,500);const yS=await p.evaluate(()=>{const b=document.querySelector('#ivbody'),c=document.querySelector('#item-view .colbtn[data-k="primaryColor"]');b.scrollTo(0,Math.max(160,Math.round(c.getBoundingClientRect().top-b.getBoundingClientRect().top+b.scrollTop-200)));return b.scrollTop});
    await p.click('#item-view .colbtn[data-k="primaryColor"]');await p.click('#col-sheet .cptile[data-c="pink"] >> nth=-1');await p.click('#col-sheet .cpbar button');await p.waitForFunction(()=>HOOK.items.find(i=>i.id==='s3').primaryColor==='pink'&&/pink/i.test(document.querySelector('#iv-title').textContent));v=await view();   // (the sheet is redrawn a moment after the item is saved)
    ok(v.ed==='s3'&&v.on&&v.top===yS&&yS>=160&&/pink/i.test(v.title),`changing a tag redraws the sheet in place: still open, still scrolled, the header follows (${v.title}, ${v.top} of ${yS})`);
    ok(/pink/i.test(await p.textContent('#gi-s3')),'and the box in the grid behind is up to date');
    // while cropping, Esc leaves the crop first
    await p.evaluate(()=>HOOK.startCrop('s3'));await p.waitForSelector('#item-view #cropbox');
    ok(await p.evaluate(()=>!document.querySelector('#item-view .phtools')&&document.querySelector('#ivbody').scrollTop===0&&document.querySelector('#cropbox').getBoundingClientRect().top>0),'cropping scrolls the page to the picture; the photo tools step aside');
    await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    ok(await p.evaluate(()=>HOOK.editing==='s3'&&!document.querySelector('#cropbox')),'Esc leaves the crop, not the sheet');
    // another tab drops the page; deleting closes it
    await p.evaluate(()=>HOOK.show('add'));v=await view();ok(v.ed===null&&!v.shown&&!v.inert,'showing another tab closes the sheet');
    await p.evaluate(()=>{HOOK.show('wardrobe');HOOK.openItem('s2');window.confirm=()=>true});await settle(p,500);await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,9999));
    await p.tap('#item-view .ivin > :last-child button');await p.waitForFunction(()=>!HOOK.items.some(i=>i.id==='s2'));v=await view();
    ok(v.ed===null&&!v.shown&&!await p.$('#gi-s2'),'Delete removes the item and closes its sheet');
    // while cropping, the picture is dragged, not the sheet
    await p.tap('#gi-s1 .giopen');await settle(p,500);await p.evaluate(()=>HOOK.startCrop('s1'));await p.waitForSelector('#item-view #cropbox');
    await drag(200,500,740,8);ok((await view()).ed==='s1','while cropping, a swipe down does not close the sheet');
    await p.evaluate(()=>{HOOK.phEdit.crop=null;HOOK.closeItem()});await settle(p,500);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
    // a wide screen: a centred panel over a backdrop, which closes it
    const c2=await browser.newContext({viewport:{width:1000,height:800}});const q=await c2.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);await q.evaluate(()=>{HOOK.CK_OPEN['*']=true});
    await q.evaluate(ph=>{HOOK.items=[...Array(6)].map((_,n)=>({id:'s'+n,type:'shirt',primaryColor:'white',pattern:'solid',photo:ph,added:n}));HOOK.flt='all';HOOK.editing=null;HOOK.show('wardrobe')},PH);
    await q.click('#gi-s3 .giopen');await settle(q,500);
    const wide=await q.evaluate(()=>{const r=document.querySelector('#item-view').getBoundingClientRect();return {w:Math.round(r.width),mid:Math.round(r.left+r.width/2),h:Math.round(r.height),bd:getComputedStyle(document.querySelector('#item-backdrop')).display}});
    ok(wide.w===900&&wide.mid===500&&wide.h<800&&wide.bd==='block',`from 600px wide the item opens as a centred panel over a backdrop, 900px wide for its two columns since the checklist redesign (${wide.w}px wide)`);
    await q.mouse.click(40,400);await settle(q,500);
    ok(await q.evaluate(()=>HOOK.editing===null&&getComputedStyle(document.querySelector('#item-view')).display==='none'),'clicking the backdrop closes it');
    await c2.close();
  }finally{await browser.close()}
};

/* ---- was tests/sheetswipe.test.js ---- */
// The item sheet's swipe-down on wide screens (2026-11-15, the owner's iPhone Duo unfolded, upright: "a little icon at the top
// inviting me to swipe it down, but it doesn't let me"). From 600px the sheet is a centred panel; it sat at 4vh, so on the Duo its
// grabber and the top of its header lay under the status bar, where iOS takes a downward pull for itself (Notification / Control
// Center) and the page never sees it. The panel now starts below the status bar (`--ivtop`), like the phone's sheet. A stand-in
// status bar (`--sat`, the property styles.css reads env(safe-area-inset-top) into) checks that geometry; touches (CDP in
// Chromium, tests/webkit.js on WebKit) and mouse drags (Pointer Events: an iPad-style trackpad or Pencil, a desktop mouse) on the
// grabber, the title and the content check the gesture at phone, unfolded-Duo, iPad and landscape sizes.
// Also the Add page's item card has a × in its top corner that does what its Cancel does (the owner's ask, same day; a card of the
// list: "Add without a photo" opens a sheet of its own, tests/addsheet.test.js).
// SHOTS=<dir> saves screenshots of the × (phone and wide, light and dark) and of the panel under a stand-in status bar.
const sheetswipe=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const WK=process.env.TEST_BROWSER==='webkit',SHOTS=process.env.SHOTS;
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const SAT=59;   // an iPhone's status bar with the Dynamic Island, in CSS px
  try{
    for(const [w,h] of [[390,844],[690,960],[760,1000],[840,1100],[744,1133],[1024,1366],[1180,820]]){
      const tag=`${w}×${h}`;
      const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,...(WK?{}:{isMobile:true})});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(ph=>{HOOK.items=[...Array(6)].map((_,n)=>({id:'s'+n,type:'shirt',primaryColor:'white',pattern:'solid',photo:ph,added:n}));HOOK.flt='all';HOOK.editing=null;HOOK.show('wardrobe')},PH);
      await settle(p,600);
      const cdp=await ctx.newCDPSession(p);let clock=0;const T=(type,x,y,ms=16)=>{clock=type==='touchStart'?Math.max(clock+ms,Date.now()):clock+ms;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}],timestamp:clock/1000})};
      const at=()=>p.evaluate(()=>({top:document.querySelector('#item-view').getBoundingClientRect().top,dim:+getComputedStyle(document.querySelector('#item-backdrop')).opacity,ed:HOOK.editing}));
      const touch=async(x,y0,y1,n=8,ms=16)=>{let mid;await T('touchStart',x,y0);for(let k=1;k<=n;k++){await T('touchMove',x,y0+(y1-y0)*k/n,ms);await p.waitForTimeout(ms);if(k===n)mid=await at()}await T('touchEnd',x,y1);await settle(p,500);return mid};
      const mouse=async(x,y0,y1,n=10)=>{let mid;await p.mouse.move(x,y0);await p.mouse.down();for(let k=1;k<=n;k++){await p.mouse.move(x,y0+(y1-y0)*k/n);await p.waitForTimeout(30);if(k===n)mid=await at()}await p.mouse.up();await settle(p,500);return mid};
      const open=async()=>{await p.evaluate(()=>{if(HOOK.editing)HOOK.closeItem()});await settle(p,500);await p.evaluate(()=>HOOK.openItem('s3'));await settle(p,600);
        return p.evaluate(()=>{const v=document.querySelector('#item-view').getBoundingClientRect(),hd=document.querySelector('#ivhead').getBoundingClientRect(),t=document.querySelector('#iv-title').getBoundingClientRect();
          return {top:v.top,left:v.left,w:v.width,h:v.height,hb:hd.bottom,tx:t.left+10,ty:t.top+t.height/2}})};
      // under a status bar: the sheet (panel or not) and so its grabber start below it
      await p.evaluate(s=>document.documentElement.style.setProperty('--sat',s+'px'),SAT);
      let g=await open();
      ok(g.top>=SAT+8&&g.top+7>=SAT+8,`${tag}: under a ${SAT}px status bar the sheet starts below it (top ${Math.round(g.top)}px, grabber at ${Math.round(g.top+7)}px)`);
      // (the checklist redesign, 2026-11-16: from 600px the panel is up to 900px wide, for its two columns)
      if(w>=600)ok(Math.round(g.w)===Math.min(900,Math.round(w*.96))&&Math.abs(g.left+g.w/2-w/2)<1.5&&g.top+g.h<=h,`${tag}: still the centred panel, inside the screen (${Math.round(g.w)}px wide, bottom ${Math.round(g.top+g.h)})`);
      if(SHOTS&&w===690)await p.screenshot({path:`${SHOTS}/panel-690-statusbar59-${WK?'webkit':'chromium'}.png`});
      await p.evaluate(()=>document.documentElement.style.removeProperty('--sat'));
      // touch: from the grabber, the title, and the content at the top; the sheet follows the finger and the Wardrobe brightens
      for(const where of ['grabber','title','content']){
        g=await open();const x=where==='title'?g.tx:g.left+g.w/2,y=where==='grabber'?g.top+9:where==='title'?g.ty:g.hb+60;
        const mid=await touch(x,y,y+g.h*.5);const ed=await p.evaluate(()=>HOOK.editing);
        ok(mid.ed==='s3'&&mid.top>g.top+g.h*.4&&mid.dim<1&&ed===null,`${tag}: a finger dragging the ${where} down moves the sheet with it (top ${Math.round(g.top)} → ${Math.round(mid.top)}) and closes it`);
      }
      g=await open();const m0=await touch(g.left+g.w/2,g.top+9,g.top+9+48,4,60);let s=await at();
      ok(m0.top>g.top+30&&s.ed==='s3'&&Math.abs(s.top-g.top)<1&&s.dim===1,`${tag}: a short, slow pull on the header springs back`);
      // a mouse / trackpad / Pencil: the header drags it the same way (Pointer Events); the content doesn't
      for(const where of ['grabber','title']){
        g=await open();const x=where==='title'?g.tx:g.left+g.w/2,y=where==='grabber'?g.top+9:g.ty;
        const mid=await mouse(x,y,y+g.h*.5);const ed=await p.evaluate(()=>HOOK.editing);
        ok(mid.ed==='s3'&&mid.top>g.top+g.h*.4&&mid.dim<1&&ed===null,`${tag}: a mouse dragging the ${where} down moves the sheet (top ${Math.round(g.top)} → ${Math.round(mid.top)}) and closes it`);
      }
      g=await open();await mouse(g.left+g.w/2,g.top+9,g.top+9+40,8);s=await at();
      ok(s.ed==='s3'&&Math.abs(s.top-g.top)<1,`${tag}: a short mouse drag springs back`);
      await mouse(g.left+g.w/2,g.hb+60,g.hb+60+g.h*.5);s=await at();
      ok(s.ed==='s3'&&Math.abs(s.top-g.top)<1,`${tag}: a mouse drag on the content doesn't move the sheet`);
      await p.evaluate(()=>HOOK.closeItem());await settle(p,500);
      ok(!errs.length,`${tag}: no page errors (${errs.join('; ')})`);
      await ctx.close();
    }
    // the Add page's item card: a × in its top corner does what Cancel does
    for(const [w,h,scheme] of [[390,844,'light'],[390,844,'dark'],[690,960,'light'],[690,960,'dark']]){
      const tag=`${w}px ${scheme}`;
      const ctx=await browser.newContext({viewport:{width:w,height:h},colorScheme:scheme,hasTouch:true,...(WK?{}:{isMobile:true})});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{HOOK.queue.length=0;HOOK.show('add')});await settle(p,500);
      const cards=()=>p.evaluate(()=>({q:HOOK.queue.length,n:document.querySelectorAll('#queue .card').length}));
      // a card of the list ("Add without a photo" has its own sheet now, with the × in the sheet's header: tests/addsheet.test.js):
      // a photo that couldn't be opened, filled in by hand
      const listCard=()=>p.evaluate(()=>{HOOK.queue.unshift({id:'c'+Date.now(),err:'open'});HOOK.renderAdd();HOOK.errToHand(HOOK.queue[0].id)});
      await listCard();await settle(p,500);
      const x=await p.evaluate(()=>{const c=document.querySelector('#queue .card'),b=c&&c.querySelector(':scope>.qx');if(!b)return null;const r=b.getBoundingClientRect(),cr=c.getBoundingClientRect(),st=getComputedStyle(b);
        return {w:r.width,h:r.height,right:cr.right-r.right,top:r.top-cr.top,label:b.getAttribute('aria-label'),txt:b.textContent,color:st.color,bg:getComputedStyle(document.body).backgroundColor,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===b}});
      ok(x&&x.w>=44&&x.h>=44&&x.right<=8&&x.top<=8&&x.label==='Close'&&x.txt==='×'&&x.hit,`${tag}: the item card has a × (Close) in its top right corner, 44px to tap (${JSON.stringify(x)})`);
      ok((await cards()).q===1&&await p.evaluate(()=>[...document.querySelectorAll('#queue .card button')].some(b=>b.textContent==='Cancel')),`${tag}: Cancel is still at the bottom`);
      if(SHOTS){await p.evaluate(()=>{scrollTo(0,0);const c=document.querySelector('#queue .card');scrollTo(0,c.getBoundingClientRect().top+scrollY-160)});await p.waitForTimeout(200);await p.screenshot({path:`${SHOTS}/add-x-${w}-${scheme}-${WK?'webkit':'chromium'}.png`})}
      await p.click('#queue .card .qx');await settle(p,400);let c=await cards();
      ok(c.q===0&&c.n===0,`${tag}: the × closes the card, as Cancel does`);
      await listCard();await settle(p,400);await p.click('#queue .card button:text-is("Cancel")');await settle(p,400);c=await cards();
      ok(c.q===0&&c.n===0,`${tag}: (and Cancel still closes it)`);
      ok(!errs.length,`${tag}: no page errors (${errs.join('; ')})`);
      await ctx.close();
    }
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['wardrobetap',wardrobetap],['sheetswipe',sheetswipe]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
