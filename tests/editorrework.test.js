// The item editor and the color / pattern sheets reworked (2026-11-15, the owner's four asks), in Chromium and WebKit on a touch
// screen with the worker stubbed (no paid call), the items seeded from tests/fixtures:
// 1. "True color in 3 steps" is seen before "Read color and texture from close-up" (since Edit photos option B: right above it).
// 2. The color / pattern sheet (its New color / New pattern states too) and the reading sheet close on a downward swipe as the item sheet
//    does: the top (grabber, title, photos) at any time, the content while scrolled to the top, following the finger, springing back on a
//    short pull, a mouse / trackpad by the top; never from the New color shade square; their top below a stand-in 59px status bar.
// 3. Ask Claude comes right under the Close-up / Whole photo / Drawing buttons, then Your colors / Your patterns.
// 4. Zoom & crop left without Apply keeps a moved or zoomed frame: Done, swiping the item sheet down, Back, Esc and ‹ ›, with "Crop
//    saved." and Undo; Discard drops it; a frame left as it opened changes nothing; the editor's Undo still works.
module.exports=async({ok,chromium,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
const SAT=59;   // an iPhone's status bar with the Dynamic Island, in CSS px (as tests/wardrobetap.test.js)
async function run(eng,browser,{ok,url,settle}){
  for(const [w,h] of [[390,844],[690,960],[1180,820]]){
    const T=`${eng} ${w}×${h}: `,H={'content-type':'application/json','access-control-allow-origin':'*'},phone=w===390;
    const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:eng==='Chromium'});
    await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
      if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify({id:'owner',role:'owner',caps:null,used:{}})});
      return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});   // nothing paid: /describe and the tagger are never answered
    await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
      const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
      const cv=(im,k)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)};
      rememberRole({role:'owner'});settings.custom={colors:[],patterns:[]};applyCustom(settings.custom);
      window.PH0=cv(pi,1);items=[{id:'m1',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:PH0,texture:cv(ci,3),added:2,name:'Mink suit'},{id:'m2',type:'suit',primaryColor:'navy',pattern:'solid',photo:PH0,added:1,name:'Navy suit'}];
      settings.workdays=[0,1,2,3,4];settings.setupDone=1;cache={};flt='all';editing=null;show('wardrobe')});
    await settle(p,400);
    const ev=(f,a)=>p.evaluate(f,a);
    const cdp=await ctx.newCDPSession(p);let clock=0;
    const TE=(type,x,y,ms=16)=>{clock=type==='touchStart'?Math.max(clock+ms,Date.now()):clock+ms;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}],timestamp:clock/1000})};
    const touch=async(x,y0,y1,at,n=8,ms=16)=>{let mid;await TE('touchStart',x,y0);for(let k=1;k<=n;k++){await TE('touchMove',x,y0+(y1-y0)*k/n,ms);await p.waitForTimeout(ms);if(k===n&&at)mid=await at()}await TE('touchEnd',x,y1);await settle(p,450);return mid};
    const mouse=async(x,y0,y1,at,n=10)=>{let mid;await p.mouse.move(x,y0);await p.mouse.down();for(let k=1;k<=n;k++){await p.mouse.move(x,y0+(y1-y0)*k/n);await p.waitForTimeout(30);if(k===n&&at)mid=await at()}await p.mouse.up();await settle(p,450);return mid};
    const openItem1=async(id='m1')=>{await ev(()=>{if(colPick)closeColPick();if(rd)rdClose();phEdit.crop=null;if(editing)closeItem()});await settle(p,450);await ev(id=>openItem(id),id);await settle(p,500)};

    // ---- 1. "True color in 3 steps" seen before the Read tap: since Edit photos option B it sits right ABOVE Read color and texture, in
    //         the Color & texture card (tests/editphotosb.test.js has the rest of B)
    if(phone){await openItem1();
      const r=await ev(()=>{const rd=document.querySelector('#item-view .ivrd'),st=document.querySelector('#item-view .wbsteps'),tg=document.querySelector('#item-view .ivtags');if(!rd||!st)return null;
        const a=rd.getBoundingClientRect(),b=st.getBoundingClientRect();
        return {next:st.nextElementSibling===rd,card:!!st.closest('#ivct')&&!!rd.closest('#ivct'),above:b.bottom<=a.top,seen:b.height>40&&getComputedStyle(st).visibility==='visible',beforeTags:!!(st.compareDocumentPosition(tg)&Node.DOCUMENT_POSITION_FOLLOWING),fold:!!document.querySelector('#ivph,.ivphbtn'),read:!!rd.querySelector('#iv-read'),n:document.querySelectorAll('#item-view .wbsteps').length}});
      ok(r&&r.next&&r.card&&r.above&&r.seen&&r.beforeTags&&!r.fold&&r.read&&r.n===1,T+`"True color in 3 steps" is right above Read color and texture in the Color & texture card, shown once, before Details, no Edit photos fold (${JSON.stringify(r)})`)}

    // ---- 3. Ask Claude right under the Close-up / Whole photo / Drawing buttons, then Your colors / Your patterns
    if(phone)for(const [k,own] of [['primaryColor','Your colors'],['pattern','Your patterns']]){await openItem1();
      await p.click(k==='pattern'?'#item-view .patbtn':'#item-view .colbtn[data-k="primaryColor"]');await settle(p,400);
      const r=await ev(own=>{const s=document.querySelector('#col-sheet'),top=s.querySelector('.cptop'),ask=s.querySelector('.cpask'),seg=top&&top.querySelector('.cpseg');
        const kids=[...s.children],i=el=>kids.indexOf(el),ownH=[...s.querySelectorAll('h4.cph')].find(x=>x.textContent===own),first=s.querySelector('h4.cph');
        return {seg:!!seg&&seg.textContent,afterTop:top&&top.nextElementSibling===ask,btn:ask&&(ask.querySelector('.cpaskbtn')||{}).textContent,ownNext:!!ownH&&i(ask)<i(ownH),firstHead:first&&first.textContent,
          help:i(s.querySelector('.cphelp'))>i(ask)&&i(s.querySelector('.cphelp'))<i(ownH)}},own);
      ok(r.seg==='Close-upWhole photoDrawing'&&r.afterTop&&r.btn==='Ask Claude'&&r.ownNext&&r.firstHead===own&&r.help,T+`the ${k==='pattern'?'pattern':'color'} sheet: Ask Claude comes right under the Close-up / Whole photo / Drawing buttons, then ${own} (${JSON.stringify(r)})`);
      await ev(()=>closeColPick());await settle(p,300)}

    // ---- 2. the color / pattern sheet, New color and the reading sheet swipe down
    const geo=sel=>ev(sel=>{const s=document.querySelector(sel),r=s.getBoundingClientRect(),g=s.querySelector('.cpgrab,.rdgrab').getBoundingClientRect(),t=s.querySelector('#col-title,#rd-title').getBoundingClientRect(),c=s.querySelector('.cphelp,.rdbusy,.cnlim');
      const cr=c?c.getBoundingClientRect():null;return {top:r.top,left:r.left,w:r.width,h:r.height,gx:g.left+g.width/2,gy:g.top+g.height/2,tx:t.left+8,ty:t.top+t.height/2,cx:cr?cr.left+20:0,cy:cr?cr.top+cr.height/2:0}},sel);
    const at=sel=>()=>ev(sel=>{const s=document.querySelector(sel),b=document.querySelector(sel==='#col-sheet'?'#col-backdrop':'#rd-backdrop');return {top:s.getBoundingClientRect().top,dim:+getComputedStyle(b).opacity,up:sel==='#col-sheet'?!!colPick:!!rd}},sel);
    const openCol=async k=>{await openItem1();await p.click(k==='pattern'?'#item-view .patbtn':'#item-view .colbtn[data-k="primaryColor"]');await settle(p,450)};
    // under a stand-in status bar: the top (and so the grabber) starts below it
    await ev(s=>document.documentElement.style.setProperty('--sat',s+'px'),SAT);
    for(const k of ['primaryColor','pattern']){await openCol(k);const g=await geo('#col-sheet');
      ok(g.top>=SAT+8&&g.gy>=SAT+8&&g.top+g.h<=h+1,T+`under a ${SAT}px status bar the ${k==='pattern'?'pattern':'color'} sheet starts below it (top ${Math.round(g.top)}px, grabber at ${Math.round(g.gy)}px)`)}
    await ev(()=>{closeColPick();rd={src:'e',id:'m1',run:1,state:'limit',limit:'Today’s lookups are used up.'};rdOpen();rdRender(true)});await settle(p,400);
    let g=await geo('#rd-sheet');ok(g.top>=SAT+8,T+`under a ${SAT}px status bar the reading sheet starts below it (top ${Math.round(g.top)}px)`);
    await ev(()=>{rdClose();document.documentElement.style.removeProperty('--sat')});await settle(p,300);
    // touch: the grabber, the title and the content at the top close it, the sheet following the finger and the backdrop lightening
    for(const k of ['primaryColor','pattern'])for(const where of ['grabber','title','content']){await openCol(k);g=await geo('#col-sheet');
      const x=where==='grabber'?g.gx:where==='title'?g.tx:g.cx,y=where==='grabber'?g.gy:where==='title'?g.ty:g.cy;
      const mid=await touch(x,y,y+g.h*.5,at('#col-sheet'));const r=await ev(()=>({cp:!!colPick,on:!!document.querySelector('#col-sheet.on'),it:editing}));
      ok(mid&&mid.up&&mid.top>g.top+g.h*.35&&mid.dim<1&&!r.cp&&!r.on&&r.it==='m1',T+`${k==='pattern'?'pattern':'color'} sheet: a finger dragging the ${where} down moves it with it (top ${Math.round(g.top)} → ${Math.round(mid&&mid.top)}) and closes it; the item sheet stays (${JSON.stringify(r)})`)}
    await openCol('primaryColor');g=await geo('#col-sheet');await touch(g.gx,g.gy,g.gy+48,null,4,60);let s=await at('#col-sheet')();
    ok(s.up&&Math.abs(s.top-g.top)<1&&s.dim===1,T+`a short, slow pull on the grabber springs back (top ${Math.round(s.top)} vs ${Math.round(g.top)})`);
    await ev(()=>{document.querySelector('#col-sheet').scrollTop=300});await settle(p,200);g=await geo('#col-sheet');await touch(g.left+g.w/2,g.top+g.h*.7,g.top+g.h*.95);s=await at('#col-sheet')();
    ok(s.up,T+'scrolled down, a downward swipe on the content leaves the sheet up (it scrolls back instead)');
    // a mouse / trackpad drags it by its top, not by its content; × still takes a click
    for(const where of ['grabber','title']){await openCol('primaryColor');g=await geo('#col-sheet');const x=where==='grabber'?g.gx:g.tx,y=where==='grabber'?g.gy:g.ty;
      const mid=await mouse(x,y,y+g.h*.5,at('#col-sheet'));s=await at('#col-sheet')();
      ok(mid&&mid.up&&mid.top>g.top+g.h*.35&&!s.up,T+`a mouse dragging the ${where} down moves the sheet (top ${Math.round(g.top)} → ${Math.round(mid&&mid.top)}) and closes it`)}
    await openCol('primaryColor');g=await geo('#col-sheet');await mouse(g.gx,g.gy,g.gy+40,null,8);s=await at('#col-sheet')();
    ok(s.up&&Math.abs(s.top-g.top)<1,T+'a short mouse drag springs back');
    await mouse(g.cx,g.cy,g.cy+g.h*.4);s=await at('#col-sheet')();ok(s.up&&Math.abs(s.top-g.top)<1,T+'a mouse drag on the content doesn’t move the sheet');
    await p.mouse.click(...await ev(()=>{const r=document.querySelector('#col-sheet .pick-x').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}));await settle(p,300);
    ok(!await ev(()=>colPick),T+'× still closes it with a click');
    // New color: its grabber closes it; a drag on the shade square picks a shade and leaves the sheet where it is
    await openCol('primaryColor');await p.click('#cn-open');await settle(p,400);
    const sq=await ev(()=>{const r=document.querySelector('#cn-sq').getBoundingClientRect();return {x:r.left+r.width*.3,y:r.top+8,h:r.height,top:document.querySelector('#col-sheet').getBoundingClientRect().top}});
    await touch(sq.x,sq.y,sq.y+sq.h*.8);s=await at('#col-sheet')();
    ok(s.up&&Math.abs(s.top-sq.top)<1&&await ev(()=>!!(colPick&&colPick.newc)),T+'New color: a finger dragging down the shade square leaves the sheet in place');
    await ev(()=>{document.querySelector('#col-sheet').scrollTop=0});g=await geo('#col-sheet');await touch(g.gx,g.gy,g.gy+g.h*.5);
    ok(!await ev(()=>colPick),T+'New color: dragging its grabber down closes it');
    await openCol('pattern');await p.click('#pn-open');await settle(p,400);g=await geo('#col-sheet');await touch(g.tx,g.ty,g.ty+g.h*.5);
    ok(!await ev(()=>colPick),T+'New pattern: dragging its title down closes it');
    // the reading sheet: by its grabber (finger and mouse), springing back on a short pull
    const openRd=async()=>{await openItem1();await ev(()=>{rd={src:'e',id:'m1',run:1,state:'limit',limit:'Today’s lookups are used up.'};rdOpen();rdRender(true)});await settle(p,400)};
    await openRd();g=await geo('#rd-sheet');let mid=await touch(g.gx,g.gy,g.gy+g.h*.6,at('#rd-sheet'));
    ok(mid&&mid.up&&mid.top>g.top+20&&!await ev(()=>!!rd||!!document.querySelector('#rd-sheet.on'))&&await ev(()=>editing==='m1'),T+`the reading sheet: a finger dragging its grabber down moves it and closes it, the item sheet stays`);
    await openRd();g=await geo('#rd-sheet');await touch(g.gx,g.gy,g.gy+20,null,4,60);s=await at('#rd-sheet')();
    ok(s.up&&Math.abs(s.top-g.top)<1,T+'the reading sheet: a short, slow pull springs back');
    await mouse(g.tx,g.ty,g.ty+g.h*.6);ok(!await ev(()=>!!rd),T+'the reading sheet: a mouse dragging its title down closes it');

    // ---- 4. zoom & crop: leaving it without Apply keeps a moved or zoomed frame
    if(phone){
      const photo=()=>ev(()=>items.find(x=>x.id==='m1').photo);
      const crop=async(z='2')=>{await openItem1();await ev(()=>{items.find(x=>x.id==='m1').photo=PH0;startCrop('m1')});await p.waitForSelector('#cropbox');await settle(p,200);
        if(z)await ev(z=>{const r=document.querySelector('#item-view .cropzoom input');r.value=z;r.dispatchEvent(new Event('input',{bubbles:true}))},z)};
      const saved=()=>p.waitForFunction(()=>items.find(x=>x.id==='m1').photo!==PH0,null,{timeout:6000}).then(()=>true,()=>false);
      const sq1=()=>ev(async()=>{const im=await imgOf(items.find(x=>x.id==='m1').photo);return im.naturalWidth===im.naturalHeight});
      // (on the Wardrobe, with the sheet closed, an Undo is the round button above the +, its label "Undo: …": 2026-11-17)
      const toastNow=()=>ev(()=>{const t=document.querySelector('#toast.on'),u=document.querySelector('#undo-fab.on');return (t?t.textContent:'')+(u?' '+u.getAttribute('aria-label'):'')});
      // Done
      await crop();await p.click('#item-view .ivdone');let sv=await saved();await settle(p,300);
      ok(sv&&await sq1()&&!await ev(()=>editing)&&/Crop saved\./.test(await toastNow())&&/Undo/.test(await toastNow()),T+`zoomed, then Done: the crop is saved (a square photo), the sheet closes, "Crop saved." with Undo (${await toastNow()})`);
      await ev(()=>(document.querySelector('#undo-fab.on')||[...document.querySelectorAll('#toast button')].find(b=>b.textContent==='Undo')).click());await p.waitForFunction(()=>items.find(x=>x.id==='m1').photo===PH0,null,{timeout:4000}).catch(()=>{});
      ok(await photo()===await ev(()=>PH0),T+'…and the toast’s Undo puts the photo back');
      // swiping the item sheet down by its header while cropping
      await crop();g=await ev(()=>{const r=document.querySelector('#ivhead').getBoundingClientRect(),v=document.querySelector('#item-view').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+9,h:v.height}});
      await touch(g.x,g.y,g.y+g.h*.5);sv=await saved();
      ok(sv&&!await ev(()=>editing),T+'zoomed, then the item sheet swiped down by its header: the crop is saved and the sheet closes');
      await crop();const cb=await ev(()=>{const r=document.querySelector('#cropbox').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+20,top:document.querySelector('#item-view').getBoundingClientRect().top}});
      await touch(cb.x,cb.y,cb.y+120);
      ok(await ev(()=>!!phEdit.crop&&editing==='m1')&&Math.abs((await ev(()=>document.querySelector('#item-view').getBoundingClientRect().top))-cb.top)<1,T+'while cropping, a drag on the picture moves the picture, not the sheet');
      // the backdrop (the strip above the sheet)
      await p.mouse.click(w/2,8);sv=await saved();ok(sv&&!await ev(()=>editing),T+'zoomed, then a tap on the strip above the sheet: the crop is saved');
      // Esc: kept and left, the sheet stays; the editor's Undo
      await crop();await p.keyboard.press('Escape');sv=await saved();await settle(p,300);
      let e=await ev(()=>({crop:!!phEdit.crop,ed:editing,frame:!!document.querySelector('#cropbox'),undo:phEdit.undo.length,toast:(document.querySelector('#toast.on')||{}).textContent||''}));
      ok(sv&&!e.crop&&e.ed==='m1'&&!e.frame&&e.undo===1&&/Crop saved\..*Undo/.test(e.toast),T+`zoomed, then Esc: the crop is saved and the frame left, the sheet stays, "Crop saved." with Undo in the toast (${JSON.stringify(e)})`);
      await ev(()=>undoPhoto('m1'));await settle(p,300);ok(await photo()===await ev(()=>PH0),T+'…and the editor’s Undo (phEdit.undo) still puts the photo back');
      // ‹ ›: the next item; the crop kept for the one it was on
      await crop();await p.click('#iv-next');sv=await saved();await settle(p,300);
      ok(sv&&await ev(()=>editing==='m2'&&items.find(x=>x.id==='m2').photo===PH0),T+'zoomed, then › to the next item: the crop is kept for the item it was on, the next item untouched');
      // Discard drops it
      await crop();await p.click('#item-view .cropdiscard');await settle(p,500);
      e=await ev(()=>({same:items.find(x=>x.id==='m1').photo===PH0,crop:!!phEdit.crop,ed:editing,label:'Discard'}));
      ok(e.same&&!e.crop&&e.ed==='m1',T+`Discard drops the zoomed frame: the photo unchanged, the sheet stays (${JSON.stringify(e)})`);
      // a frame left as it opened changes nothing
      await crop(null);await ev(()=>{document.querySelector('#toast').classList.remove('on')});await p.click('#item-view .ivdone');await settle(p,600);
      ok(await photo()===await ev(()=>PH0)&&!/Crop saved/.test(await toastNow())&&!await ev(()=>editing),T+'a crop frame left as it opened, then Done: nothing changes and nothing is said');
      // Apply still applies, with "Photo cropped." and Undo (option B: the editor's Undo button moved into the toasts)
      await crop();await p.click('#item-view .cropwrap button.pri');sv=await saved();await settle(p,300);
      ok(sv&&await ev(()=>editing==='m1'&&!phEdit.crop)&&/Photo cropped\..*Undo/.test(await toastNow()),T+`Apply still applies the crop and leaves the frame, "Photo cropped." with Undo (${await toastNow()})`);
      await ev(()=>{items.find(x=>x.id==='m1').photo=PH0})}
    ok(!errs.length,T+'no page errors ('+errs.join(' | ')+')');
    await ctx.close()}
}
