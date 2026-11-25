// The Wardrobe's Add is a round + at the bottom right (2026-11-15, the owner: "a circular button with a plus on it that stays in the
// right corner while a person scrolls"; the page's header row with "Wardrobe", the item count and the small "+ Add" is gone, and the
// search row moved up). The button (#ward-add, in main after the pages) is fixed above the tab bar, on the Wardrobe only, at the right
// edge of the content column; it hides under the item sheet, Settings and the other sheets; it opens Add; the last row scrolls clear
// of it. Phone (390) and the Duo unfolded (690), and a wide 1280 where the column is centered; touch taps (CDP in Chromium,
// tests/webkit.js on WebKit); light and dark contrast; reduced motion.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();const WK=process.env.TEST_BROWSER==='webkit';
  const lum=c=>{const m=c.match(/[\d.]+/g).map(Number),f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
  const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  try{
    for(const [w,h] of [[390,844],[690,960],[1280,900]]){const tag=`${w}×${h}`;
      const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,...(WK?{}:{isMobile:true})});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(`(()=>{const W=${WARDROBES};HOOK.items=W.realistic;settings.workdays=[1,2,3,4,5];HOOK.TODAY_OVERRIDE='2026-11-11T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,11);HOOK.view={y:2026,m:10};HOOK.flt='all';show('wardrobe')})()`);
      await settle(p,600);
      const fab=()=>p.evaluate(()=>{const b=document.querySelector('#ward-add'),r=b.getBoundingClientRect(),cs=getComputedStyle(b),nav=document.querySelector('body>nav').getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();
        return {shown:cs.display!=='none'&&r.width>0,x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,bottom:r.bottom,pos:cs.position,rad:cs.borderRadius,navTop:nav.top,mainRight:m.right,vw:innerWidth,
          label:b.getAttribute('aria-label'),bg:cs.backgroundColor,fg:cs.color,page:getComputedStyle(document.body).backgroundColor}});
      // header row gone, the search row at the top of the page
      const top=await p.evaluate(()=>{const m=document.querySelector('main').getBoundingClientRect(),f=document.querySelector('#wardrobe .wfind').getBoundingClientRect(),h=document.querySelector('#wardrobe h2'),c=document.querySelector('#wcount'),hc=getComputedStyle(h);
        return {off:f.top-m.top,phead:!!document.querySelector('#wardrobe .phead'),oldBtn:!!document.querySelector('#wardrobe button.padd'),h2:h.textContent,h2w:h.getBoundingClientRect().width,clip:hc.clipPath,count:c.textContent,role:c.getAttribute('role')}});
      ok(!top.phead&&!top.oldBtn&&top.off<=17,`${tag}: no header row; the search row starts at the top of the page (${Math.round(top.off)}px below main's top; it was 78)`);
      ok(top.h2==='Wardrobe'&&top.h2w<=1&&/inset/.test(top.clip)&&/^\d+ items$/.test(top.count)&&top.role==='status','  the page keeps a heading "Wardrobe" and the item count for screen readers only');
      let f=await fab();
      ok(f.shown&&f.w===56&&f.h===56&&f.rad==='50%'&&f.pos==='fixed'&&f.label==='Add to wardrobe',`  a round 56px + labeled "Add to wardrobe" (${f.w}×${f.h}, ${f.rad}, ${f.pos})`);
      ok(f.bottom<=f.navTop-12&&f.bottom>=f.navTop-24,`  it sits above the tab bar (${Math.round(f.navTop-f.bottom)}px above)`);
      const wantRight=w>=1080+32?f.mainRight-16:f.vw-16;
      ok(Math.abs(f.right-wantRight)<=1,`  at the right edge of the content column (right ${Math.round(f.right)}, column edge ${Math.round(wantRight)})`);
      // fixed while scrolling; the last row scrolls clear of it
      await p.evaluate(()=>scrollTo(0,400));await settle(p,300);
      const f2=await fab();
      ok(f2.shown&&Math.abs(f2.y-f.y)<=1&&Math.abs(f2.x-f.x)<=1&&await p.evaluate(()=>scrollY>100),`  it stays put while the list scrolls (top ${Math.round(f.y)} → ${Math.round(f2.y)})`);
      for(let k=0;k<2;k++){await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await settle(p,300)}   // (Chromium's phone emulation stops the first jump short at 690)
      const last=await p.evaluate(()=>{const g=[...document.querySelectorAll('#wardrobe .grid .gi')],b=document.querySelector('#ward-add').getBoundingClientRect();const lr=g[g.length-1].getBoundingClientRect();
        const row=g.filter(x=>Math.abs(x.getBoundingClientRect().top-lr.top)<2).map(x=>x.getBoundingClientRect());return {bottom:Math.max(...row.map(r=>r.bottom)),fabTop:b.top}});
      ok(last.bottom<=last.fabTop-4,`  scrolled to the end, the last row ends above the button (${Math.round(last.bottom)} vs ${Math.round(last.fabTop)})`);
      await p.evaluate(()=>scrollTo(0,0));
      // focusable, with a ring
      await p.keyboard.press('Shift');await p.focus('#ward-add');
      const fo=await p.evaluate(()=>{const b=document.querySelector('#ward-add'),cs=getComputedStyle(b);return {act:document.activeElement===b,ring:cs.outlineStyle+' '+cs.outlineWidth}});
      ok(fo.act&&/solid 3px/.test(fo.ring),`  it takes the keyboard focus, with a ring (${fo.ring})`);
      await p.evaluate(()=>document.activeElement.blur());
      // an Undo on the Wardrobe is a round button above the + with a gold ring running down (2026-11-17, the owner's pick); a plain toast
      // sits above the + too; on Today an Undo stays the toast above the tab bar
      const und=()=>p.evaluate(async()=>{window.__u=0;toast('Deleted Navy suit',8000,{label:'Undo',fn:()=>{window.__u++}});await new Promise(r=>setTimeout(r,350));const u=document.querySelector('#undo-fab'),r=u.getBoundingClientRect(),b=document.querySelector('#ward-add').getBoundingClientRect(),cs=getComputedStyle(u),ring=getComputedStyle(u.querySelector('.ufc'));
        return {shown:cs.display!=='none'&&r.width>0,w:r.width,h:r.height,rad:cs.borderRadius,ub:r.bottom,ux:r.left+r.width/2,bx:b.left+b.width/2,bt:b.top,label:u.getAttribute('aria-label'),toastOn:document.querySelector('#toast').classList.contains('on'),anim:ring.animationName,dur:ring.animationDuration,txt:u.textContent.trim()}});
      let u=await und();
      ok(u.shown&&u.w===56&&u.h===56&&u.rad==='50%'&&u.txt==='Undo'&&!u.toastOn,`  an Undo is a round 56px "Undo" button, not the toast (${u.w}×${u.h}, toast ${u.toastOn?'on':'off'})`);
      ok(u.ub<=u.bt-14&&Math.abs(u.ux-u.bx)<=1,`  it floats above the +, centered on it (${Math.round(u.bt-u.ub)}px above)`);
      ok(u.anim==='ufRun'&&u.dur==='8s'&&u.label==='Undo: Deleted Navy suit',`  its ring runs down the 8 seconds; its label says what it undoes (${u.anim} ${u.dur}, "${u.label}")`);
      if(WK)await p.click('#undo-fab');else{const c=await ctx.newCDPSession(p);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:u.ux,y:u.ub-28}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
      await settle(p,300);
      ok(await p.evaluate(()=>window.__u===1&&getComputedStyle(document.querySelector('#undo-fab')).display==='none'),'  a tap undoes once and the button goes');
      await p.evaluate(()=>{toast('Deleted Navy suit',300,{label:'Undo',fn:()=>{}})});await p.waitForTimeout(8400);
      ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#undo-fab')).display==='none'),'  left alone, it goes after 8 seconds, leaving the +');
      const ts=await p.evaluate(()=>{toast('Saved.');const t=document.querySelector('#toast').getBoundingClientRect(),b=document.querySelector('#ward-add').getBoundingClientRect();return {tb:t.bottom,ft:b.top}});
      ok(ts.tb<=ts.ft-8,`  a plain toast sits above the + (toast bottom ${Math.round(ts.tb)}, button top ${Math.round(ts.ft)})`);
      await p.click('#n-today');await settle(p,400);
      const td=await p.evaluate(()=>{toast('Deleted Navy suit',8000,{label:'Undo',fn:()=>{}});const t=document.querySelector('#toast'),nav=document.querySelector('body>nav').getBoundingClientRect();return {on:t.classList.contains('on'),btn:!!t.querySelector('button'),gap:nav.top-t.getBoundingClientRect().bottom,fab:getComputedStyle(document.querySelector('#undo-fab')).display}});
      ok(td.on&&td.btn&&td.gap<=20&&td.fab==='none',`  on Today an Undo is the toast above the tab bar, as before (${Math.round(td.gap)}px above)`);
      await p.evaluate(()=>{toastDrop();document.querySelector('#toast').classList.remove('on')});await p.click('#n-wardrobe');await settle(p,400);
      // hidden under the item sheet, Settings and What to buy
      await p.evaluate(()=>openItem(items[3].id));await settle(p,600);
      ok(!(await fab()).shown,'  hidden while the item sheet is open');
      await p.evaluate(()=>HOOK.closeItem());await settle(p,600);
      ok((await fab()).shown,'  back when it closes');
      await p.evaluate(()=>openSettings());await settle(p,300);
      ok(!(await fab()).shown,'  hidden under Settings');
      await p.evaluate(()=>closeSettings());await settle(p,300);
      await p.evaluate(()=>openPicker&&openPicker('tie'));await settle(p,500);
      const pk=await p.evaluate(()=>!!document.querySelector('#pick-sheet.on'));
      if(pk){ok(!(await fab()).shown,'  hidden under the picker sheet');await p.evaluate(()=>closePicker());await settle(p,500)}
      // Today and Insights: none
      await p.click('#n-today');await settle(p,500);
      ok(!(await fab()).shown,'  not on Today');
      await p.click('#n-stats');await settle(p,500);
      ok(!(await fab()).shown,'  not on Insights');
      await p.click('#n-wardrobe');await settle(p,500);
      // a tap opens Add, as the old + Add did; ‹ comes back with it
      f=await fab();const cdp=await ctx.newCDPSession(p);const cx=f.x+f.w/2,cy=f.y+f.h/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await settle(p,500);
      const ad=await p.evaluate(()=>({add:!document.querySelector('#add').hidden,ward:!document.querySelector('#wardrobe').hidden}));
      ok(ad.add&&!ad.ward&&!(await fab()).shown,'  a tap opens the Add page (and the button goes with the Wardrobe)');
      await p.click('#add .pback');await settle(p,500);
      ok(await p.evaluate(()=>!document.querySelector('#wardrobe').hidden)&&(await fab()).shown,'  ‹ goes back to the Wardrobe, button and all');
      // contrast, light and dark: the + on the button, the button on the page
      for(const th of ['light','dark']){await p.evaluate(t=>document.documentElement.dataset.theme=t,th);await settle(p,200);
        const c=await fab();const a=cr(c.fg,c.bg),b=cr(c.bg,c.page);
        ok(a>=4.5&&b>=3,`  ${th}: the + is ${a.toFixed(1)}:1 on the button, the button ${b.toFixed(1)}:1 on the page`)}
      ok(errs.length===0,'  no page errors ('+errs.join('; ')+')');
      await ctx.close();
    }
    // reduced motion: no pop-in
    for(const rm of ['no-preference','reduce']){const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:rm});const p=await ctx.newPage();
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(`(()=>{const W=${WARDROBES};HOOK.items=W.realistic;HOOK.cache={};show('wardrobe')})()`);
      const an=await p.evaluate(()=>getComputedStyle(document.querySelector('#ward-add')).animationName);
      ok(rm==='reduce'?an==='none':an==='fabIn',`reduced motion ${rm}: ${rm==='reduce'?'the button appears at once':'the button pops in'} (${an})`);
      await ctx.close()}
  }finally{await browser.close()}
};
