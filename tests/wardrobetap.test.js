// Wardrobe: tapping an item (photo or name) opens it as a page over the Wardrobe: the whole screen on a phone, a centred panel
// from 600px. The grid behind never moves, so closing puts you back where you were. Done in the bar at the bottom closes it,
// and so do the phone's Back button, Esc and (on a wide screen) the backdrop; the photo is no longer a hidden close button.
// ‹ › beside Done, a sideways swipe and the arrow keys go to the previous / next item; closing on another item than the one
// opened brings that one's box into view. Delete sits alone at the end of the page.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    const rect=id=>p.evaluate(id=>{const r=document.getElementById('gi-'+id).getBoundingClientRect();return {top:Math.round(r.top),left:Math.round(r.left),width:Math.round(r.width)}},id);
    const view=()=>p.evaluate(()=>{const v=document.querySelector('#item-view'),r=v.getBoundingClientRect(),bar=v.querySelector('.ivbar').getBoundingClientRect(),b=v.querySelector('#ivbody');
      return {on:v.classList.contains('on'),shown:getComputedStyle(v).display!=='none',ed:editing,w:Math.round(r.width),h:Math.round(r.height),title:v.querySelector('#iv-title').textContent,count:(v.querySelector('.pcount')||{}).textContent,
        barBottom:Math.round(bar.bottom),top:b.scrollTop,sy:Math.round(scrollY),inert:document.querySelector('main').inert,prev:v.querySelector('#iv-prev').disabled,next:v.querySelector('#iv-next').disabled}});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ten shirts in a two-column grid, newest first: s9 s8 / s7 s6 / s5 s4 / ...; then a tie without a photo
    await p.evaluate(ph=>{items=[...Array(10)].map((_,n)=>({id:'s'+n,type:'shirt',primaryColor:n%2?'white':'lightblue',pattern:'solid',photo:ph,added:n}));
      items.push({id:'t',type:'tie',primaryColor:'navy',pattern:'solid',added:0});flt='all';editing=null;show('wardrobe')},PH);
    await p.evaluate(()=>window.scrollTo(0,document.getElementById('gi-s7').getBoundingClientRect().top+scrollY-120));
    const y0=await p.evaluate(()=>Math.round(scrollY)),b6=await rect('s6'),b7=await rect('s7');
    // open: tap the photo
    await p.tap('#gi-s6 .giopen img');
    const anim=await p.evaluate(()=>document.querySelector('#item-view').getAnimations().length);await settle(p,500);
    let v=await view();
    ok(v.on&&v.ed==='s6'&&v.w===390&&v.h===844,`tapping an item's photo opens it as a page filling the phone screen (${v.w}×${v.h})`);
    ok(anim>0,`the page grows out of the tapped box instead of jumping (${anim} animations)`);
    ok(/light blue/i.test(v.title)&&v.count==='4 of 11','its header names the item and where it is in the list ('+v.title+', '+v.count+')');
    ok(await p.evaluate(()=>!!document.querySelector('#item-view .pair')&&!!document.querySelector('#item-view .phtools')&&!!document.querySelector('#item-view select')),'the page has the photo beside the swatch, the photo tools and the tags');
    const g6=await rect('s6'),g7=await rect('s7');
    ok(v.sy===y0&&g6.top===b6.top&&g6.left===b6.left&&g6.width===b6.width&&g7.top===b7.top,'the grid behind does not move or reshuffle');
    ok(v.barBottom===844&&v.inert,'Done sits in a bar at the bottom of the screen; the app behind takes no taps');
    ok(await p.evaluate(()=>document.querySelectorAll('#wardrobe .grid .gi .btns, #wardrobe .grid select').length===0),'the boxes in the grid have no buttons (no Delete one tap away)');
    // the bar stays put however far the page is scrolled
    await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,9999));
    const end=await p.evaluate(()=>{const v=document.querySelector('#item-view'),bar=v.querySelector('.ivbar').getBoundingClientRect(),del=v.querySelector('.ivin > :last-child button'),d=del.getBoundingClientRect();
      return {scrolled:v.querySelector('#ivbody').scrollTop>100,bar:Math.round(bar.bottom),del:del.textContent,danger:del.classList.contains('danger'),above:d.bottom<=bar.top,page:Math.round(scrollY)}});
    ok(end.scrolled&&end.bar===844&&end.page===y0,'scrolling the page leaves Done where it is and does not scroll the Wardrobe behind');
    ok(end.del==='Delete item'&&end.danger&&end.above,'Delete is the last thing on the page, on its own');
    // the photo is not a close button any more
    await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,0));await p.tap('#item-view .phfig img');await p.tap('#item-view .tagsw');await settle(p,300);
    ok((await view()).ed==='s6','tapping the photo or the swatch does not close the page');
    // Done closes; nothing has moved
    await p.tap('#item-view .ivdone');await settle(p,500);v=await view();const e6=await rect('s6');
    ok(v.ed===null&&!v.on&&!v.shown&&!v.inert,'Done closes the page');
    ok(v.sy===y0&&e6.top===b6.top&&e6.left===b6.left,`and the Wardrobe is exactly where it was (scroll ${y0} → ${v.sy})`);
    // the name opens it too; the phone's Back button closes it
    await p.tap('#gi-s9 .giopen b');await settle(p,500);ok((await view()).ed==='s9','tapping an item\'s name opens it');
    await p.goBack();await settle(p,500);v=await view();
    ok(v.ed===null&&!v.shown&&v.sy===y0&&await p.evaluate(()=>!document.querySelector('#wardrobe').hidden),'the Back button closes the page and stays in the Wardrobe');
    // previous / next: the buttons, a swipe, the arrow keys
    await p.tap('#gi-s9 .giopen');await settle(p,500);v=await view();
    ok(v.prev&&!v.next&&v.count==='1 of 11','on the first item, previous is switched off');
    await p.tap('#iv-next');await settle(p,400);v=await view();ok(v.ed==='s8'&&v.count==='2 of 11'&&!v.prev,'› goes to the next item');
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const swipe=async(x0,x1,y=420)=>{await T('touchStart',x0,y);for(let k=1;k<=6;k++){await T('touchMove',x0+(x1-x0)*k/6,y+2);await p.waitForTimeout(16)}await T('touchEnd');await settle(p,450)};
    const sy=await p.evaluate(()=>{const r=document.querySelector('#item-view select').getBoundingClientRect();return Math.round(r.top+r.height/2)});
    ok(await p.evaluate(y=>!!document.elementFromPoint(310,y).closest('select'),sy),'(the swipe below starts on a dropdown)');
    await swipe(310,90,sy);ok((await view()).ed==='s7','a swipe to the left goes to the next item, even when it starts on a dropdown');
    await swipe(90,310);ok((await view()).ed==='s8','a swipe to the right goes back');
    await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));ok((await view()).ed==='s7','the right arrow key goes to the next item');
    await p.evaluate(()=>{for(let k=0;k<8;k++)stepItem(1)});await settle(p,400);v=await view();
    ok(v.ed==='t'&&v.next&&v.count==='11 of 11'&&v.top===0,'on the last item, next is switched off');
    ok(await p.evaluate(()=>!document.querySelector('#item-view .pair')&&!!document.querySelector('#item-view .ivdraw svg')),'an item without a photo shows its drawing');
    await swipe(310,90);ok((await view()).ed==='t','a swipe past the last item springs back');
    // closing on another item than the one opened: its box is brought into view
    await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await settle(p,500);v=await view();
    const tt=await p.evaluate(()=>{const r=document.querySelector('#gi-t').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight});
    ok(v.ed===null&&!v.shown,'Esc closes the page');ok(tt&&v.sy!==y0,'closing on another item than the one opened scrolls the Wardrobe to that item\'s box');
    // open → close → open at once: the history entry of the first doesn't close the second
    await p.evaluate(()=>{openItem('s5');closeItem();openItem('s4')});await settle(p,500);await p.waitForTimeout(100);
    ok((await view()).ed==='s4','closing one item and opening another straight away keeps the second open');
    await p.goBack();await settle(p,500);ok((await view()).ed===null,'and Back still closes it');
    // editing keeps the page and its scroll position
    await p.tap('#gi-s3 .giopen');await settle(p,500);await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,160));
    await p.selectOption('#item-view select >> nth=1','pink');await p.waitForFunction(()=>items.find(i=>i.id==='s3').primaryColor==='pink');v=await view();
    ok(v.ed==='s3'&&v.on&&v.top===160&&/pink/i.test(v.title),`changing a tag redraws the page in place: still open, still scrolled, the header follows (${v.title})`);
    ok(/pink/i.test(await p.textContent('#gi-s3')),'and the box in the grid behind is up to date');
    // while cropping, Esc leaves the crop first
    await p.evaluate(()=>startCrop('s3'));await p.waitForSelector('#item-view #cropbox');
    ok(await p.evaluate(()=>!document.querySelector('#item-view .phtools')&&document.querySelector('#ivbody').scrollTop===0&&document.querySelector('#cropbox').getBoundingClientRect().top>0),'cropping scrolls the page to the picture; the photo tools step aside');
    await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    ok(await p.evaluate(()=>editing==='s3'&&!document.querySelector('#cropbox')),'Esc leaves the crop, not the page');
    // another tab drops the page; deleting closes it
    await p.evaluate(()=>show('add'));v=await view();ok(v.ed===null&&!v.shown&&!v.inert,'showing another tab closes the page');
    await p.evaluate(()=>{show('wardrobe');openItem('s2');window.confirm=()=>true});await settle(p,500);await p.evaluate(()=>document.querySelector('#ivbody').scrollTo(0,9999));
    await p.tap('#item-view .ivin > :last-child button');await p.waitForFunction(()=>!items.some(i=>i.id==='s2'));v=await view();
    ok(v.ed===null&&!v.shown&&!await p.$('#gi-s2'),'Delete removes the item and closes its page');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
    // a wide screen: a centred panel over a backdrop, which closes it
    const c2=await browser.newContext({viewport:{width:1000,height:800}});const q=await c2.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);
    await q.evaluate(ph=>{items=[...Array(6)].map((_,n)=>({id:'s'+n,type:'shirt',primaryColor:'white',pattern:'solid',photo:ph,added:n}));flt='all';editing=null;show('wardrobe')},PH);
    await q.click('#gi-s3 .giopen');await settle(q,500);
    const wide=await q.evaluate(()=>{const r=document.querySelector('#item-view').getBoundingClientRect();return {w:Math.round(r.width),mid:Math.round(r.left+r.width/2),h:Math.round(r.height),bd:getComputedStyle(document.querySelector('#item-backdrop')).display}});
    ok(wide.w===600&&wide.mid===500&&wide.h<800&&wide.bd==='block',`from 600px wide the item opens as a centred panel over a backdrop (${wide.w}px wide)`);
    await q.mouse.click(40,400);await settle(q,500);
    ok(await q.evaluate(()=>editing===null&&getComputedStyle(document.querySelector('#item-view')).display==='none'),'clicking the backdrop closes it');
    await c2.close();
  }finally{await browser.close()}
};
