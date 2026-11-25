// Favorites on screen (2026-11-18, the owner's approved design "B · Wore pill"; fav.js): the ♡ joined to Today's ✓ Wore pill shows on
// worn days only (today and past days not marked "Didn't", never ahead) and loves the day's look, with Undo; a favorite look shows a ♥ in
// "This look last worn"; the ⇄ picker's "Favorite looks" strip is there only once one exists and wears it on the day shown (its jacket,
// shirt and tie the owner's own picks); the item sheet's "Favorite, wear it more" switch marks a piece, with Undo; the ♥ on its Wardrobe
// and picker tiles, Wardrobe's "♥ Favorites" chip and Insights' "Your favorites" card show only while favorites exist; the score card's
// Why names a favorite look. At 390 and 320 px, light and dark: nothing past the edge. Chromium and WebKit, with touch; no worker.
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
const SETUP=()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:+new Date(2026,9,1),...x});
  items=[I('s1','suit','navy'),I('s2','suit','charcoal'),I('b1','blazer','tan'),I('p1','pants','grey'),I('h1','shirt','white'),I('h2','shirt','lightblue'),I('h3','shirt','pink'),
    I('t1','tie','burgundy'),I('t2','tie','navy'),I('t3','tie','green'),I('bs','shoes','black',{leather:'calf'}),I('bb','belt','black',{leather:'calf',metal:'silver'}),I('so','socks','charcoal')];
  settings.workdays=[1,2,3,4,5];settings.blazerDays=[5];settings.setupDone=1;delete settings.fav;TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};CK_OPEN['*']=true;
  cache={};sel=new Date(2026,10,11);view={y:2026,m:10};
  // the same look worn a week before, so "This look last worn" shows; Nov 10 marked "Didn't"
  const o=planFor()['2026-11-11'];dayRecs['2026-11-4']={date:'2026-11-4',ids:idsOf(o),suitDay:o.suitDay,worn:true};
  const y=planFor()['2026-11-10'];dayRecs['2026-11-10']={date:'2026-11-10',ids:idsOf(y),suitDay:y.suitDay,worn:false};cache={};show('today')};
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(SETUP);await settle(p,300);
  const toastUndo=async()=>{await p.waitForSelector('#toast.on button',{state:'visible'});await p.click('#toast.on button')};

  // ---- nothing is a favorite: the ♡ is on the pill, nothing else shows
  const none=await p.evaluate(async()=>{const r={heart:!!$('#wpfav'),pressed:$('#wpfav')&&$('#wpfav').getAttribute('aria-pressed'),lw:!!document.querySelector('.lastworn'),lwfav:!!document.querySelector('.lwfav')};
    sel=new Date(2026,10,12);renderToday();openPicker('tie');r.strip=!!document.querySelector('#pick-sheet .favpick');r.mark=!!document.querySelector('#pick-sheet .favmark');closePicker();
    show('wardrobe');r.chip=!!document.querySelector('.favchip');r.tiles=document.querySelectorAll('#wardrobe .favmark').length;
    show('stats');r.card=!!document.querySelector('#st-fav');sel=new Date(2026,10,11);show('today');return r});
  ok(none.heart&&none.pressed==='false'&&none.lw&&!none.lwfav,`${T}a worn day's pill carries the ♡, not pressed; "This look last worn" has no heart (${JSON.stringify(none)})`);
  ok(!none.strip&&!none.mark&&!none.chip&&!none.tiles&&!none.card,`${T}with no favorites: no picker strip, no tile marks, no Wardrobe chip, no Insights card`);
  const days=await p.evaluate(()=>{const at=d=>{sel=d;renderToday();return !!$('#wpfav')};const r={ahead:at(new Date(2026,10,13)),didnt:at(new Date(2026,10,10)),past:at(new Date(2026,10,9))};sel=new Date(2026,10,11);renderToday();return r});
  ok(!days.ahead&&!days.didnt&&days.past,`${T}the ♡ shows on worn days only: not on a coming day (${days.ahead}), not on a day marked "Didn't" (${days.didnt}), on a past worn day (${days.past})`);

  // ---- love today's look, Undo, love it again
  // (each step waits for the redraw that follows the save, not only for the setting: the save is stored first, then Today is drawn)
  const pressed=v=>p.waitForFunction(v=>$('#wpfav')&&$('#wpfav').getAttribute('aria-pressed')===v&&(settings.fav&&settings.fav.looks.length)===(v==='true'?1:0),v);
  await p.locator('#wpfav').tap();await pressed('true');await settle(p,200);
  const on=await p.evaluate(()=>({pressed:$('#wpfav').getAttribute('aria-pressed'),toast:$('#toast').textContent,lwfav:!!document.querySelector('.lastworn .lwfav'),look:settings.fav.looks[0],o:idsOf(planFor()['2026-11-11'])}));
  ok(on.pressed==='true'&&/Added to your favorite looks/.test(on.toast)&&/Undo/.test(on.toast)&&on.lwfav,`${T}a tap loves the look: the ♡ fills, a toast with Undo, a ♥ in "This look last worn" (${on.toast})`);
  ok(on.look.j===on.o.top&&on.look.sh===on.o.shirt&&on.look.tie===on.o.tie&&on.look.at>0,`${T}the look stored is the day's jacket, shirt and tie (${JSON.stringify(on.look)})`);
  // (the last day before today with this look: the fixed test plan repeats it on Nov 5 too, recorded as worn when Today was drawn)
  const why=await p.evaluate(()=>{const d=Object.values(dayRecs).filter(r=>r.ids&&r.worn!==false&&favKey(r.ids.top,r.ids.shirt,r.ids.tie)===favLookKey(settings.fav.looks[0])&&keyDate(r.date)<todayDate()).map(r=>keyDate(r.date)).sort((a,b)=>b-a)[0];
    const o=planFor()['2026-11-11'],at=r=>({...o,top:{...o.top,rest:r},shirt:{...o.shirt,rest:r},tie:{...o.tie,rest:r}});
    return {t:favWhy(at(12)),want:`One of your favorites, last worn ${Math.round((todayDate()-d)/864e5)} days ago (${statDate(d)}). Everything in it has rested.`,lo:favWhy(at(3))}});
  ok(why.t===why.want&&!/rested/.test(why.lo),`${T}the score card's Why names it, and says everything rested only when each piece rested 10 days ("${why.t}" / "${why.lo}")`);
  await toastUndo();await pressed('false');
  ok(true,`${T}Undo takes the heart back`);
  await p.locator('#wpfav').tap();await pressed('true');await settle(p,200);

  // ---- the picker's strip wears it on another day
  await p.evaluate(()=>{sel=new Date(2026,10,12);renderToday();openPicker('shirt')});await settle(p,300);
  const st=await p.evaluate(()=>({n:document.querySelectorAll('#pick-sheet .favpick .favlook').length,first:document.querySelector('#pick-sheet .favpick').nextElementSibling.tagName,label:document.querySelector('.favlook').getAttribute('aria-label')}));
  ok(st.n===1&&/^Wear this favorite look: /.test(st.label),`${T}once a favorite exists, the picker opens with a "Favorite looks" strip (${st.n} look: ${st.label})`);
  await p.locator('#pick-sheet .favlook').first().tap();await p.waitForFunction(()=>dayRecs['2026-11-12']&&dayRecs['2026-11-12'].force&&dayRecs['2026-11-12'].force.shirt&&/Wearing a favorite/.test($('#toast').textContent));await settle(p,200);
  const worn=await p.evaluate(()=>{const f=dayRecs['2026-11-12'].force,l=settings.fav.looks[0],o=planFor()['2026-11-12'];return {f,l,o:idsOf(o),toast:$('#toast').textContent,sheet:$('#pick-sheet').classList.contains('on'),heart:!!$('#wpfav')}});
  ok(worn.f.top===worn.l.j&&worn.f.shirt===worn.l.sh&&worn.f.tie===worn.l.tie&&worn.o.top===worn.l.j&&worn.o.shirt===worn.l.sh&&worn.o.tie===worn.l.tie&&!worn.sheet,`${T}a tap wears it: the day's jacket, shirt and tie are the owner's picks and shown (${JSON.stringify(worn.f)})`);
  ok(/Wearing a favorite look on Thu, Nov 12\./.test(worn.toast)&&/Undo/.test(worn.toast)&&!worn.heart,`${T}it says so, with Undo; a coming day has no ♡ (${worn.toast})`);
  await toastUndo();await p.waitForFunction(()=>!(dayRecs['2026-11-12']&&dayRecs['2026-11-12'].force));await settle(p,200);
  ok(true,`${T}Undo puts the day back as it was`);

  // ---- a favorite piece: the item sheet's switch, the tile's ♥, the chip, Insights
  await p.evaluate(()=>{sel=new Date(2026,10,11);show('wardrobe');openItem('t2')});await p.waitForSelector('.favtog');await settle(p,300);
  const tg=await p.evaluate(()=>{const b=document.querySelector('.favtog'),r=b.getBoundingClientRect();return {h:Math.round(r.height),checked:b.getAttribute('aria-checked'),role:b.getAttribute('role'),inCare:!!b.closest('.ivrot')}});
  ok(tg.role==='switch'&&tg.checked==='false'&&tg.h>=44&&tg.inCare,`${T}the item sheet's Planning & care has a "Favorite, wear it more" switch, off, ${tg.h}px tall`);
  const sw=v=>p.waitForFunction(v=>{const b=document.querySelector('.favtog');return b&&b.getAttribute('aria-checked')===v&&(settings.fav.items||[]).includes('t2')===(v==='true')&&(v==='false'||/favorite now/.test($('#toast').textContent))},v);
  await p.locator('.favtog').tap();await sw('true');await settle(p,200);
  const tg2=await p.evaluate(()=>({checked:document.querySelector('.favtog').getAttribute('aria-checked'),toast:$('#toast').textContent,sum:(document.querySelector('.ivrot')||{}).textContent||''}));
  ok(tg2.checked==='true'&&/is a favorite now/.test(tg2.toast)&&/Undo/.test(tg2.toast),`${T}the switch marks it, with Undo (${tg2.toast})`);
  await toastUndo();await sw('false');
  ok(true,`${T}Undo unmarks it`);
  await p.locator('.favtog').tap();await sw('true');await settle(p,200);
  const wd=await p.evaluate(()=>{HOOK.closeItem();show('wardrobe');const r={mark:!!document.querySelector('#gi-t2 .favmark'),others:document.querySelectorAll('#wardrobe .favmark').length,chip:(document.querySelector('.favchip')||{}).textContent,label:document.querySelector('#gi-t2 .giopen').getAttribute('aria-label')};
    document.querySelector('.favchip').click();r.shown=[...document.querySelectorAll('#wardrobe .gi')].map(g=>g.id).join();
    sel=new Date(2026,10,12);show('today');openPicker('tie');r.pick=!!document.querySelector('#pick-sheet .pick-it .favmark');closePicker();
    show('stats');const c=document.querySelector('#st-fav');r.card=c?c.textContent.replace(/\s+/g,' ').trim():'';return r});
  ok(wd.mark&&wd.others===1&&/favorite$/.test(wd.label),`${T}its Wardrobe tile has the ♥ (and says so: ${wd.label})`);
  ok(/Favorites 1/.test(wd.chip||'')&&wd.shown==='gi-t2',`${T}Wardrobe's "♥ Favorites" chip shows only the favorites (${wd.chip}: ${wd.shown})`);
  ok(wd.pick,`${T}the picker's tile has the ♥ too`);
  ok(/Your favorites/.test(wd.card)&&/1\s*look/.test(wd.card)&&/1\s*piece/.test(wd.card),`${T}Insights shows "Your favorites" (${wd.card.slice(0,140)})`);
  const gone=await p.evaluate(async()=>{await HOOK.favToggleItem('t2');const r={chip:!!document.querySelector('.favchip'),all:document.querySelectorAll('#wardrobe .gi').length===items.length};return r});
  ok(!gone.chip&&gone.all,`${T}with no favorite piece left the chip goes and the Wardrobe shows everything (${JSON.stringify(gone)})`);
  await p.evaluate(async()=>{await HOOK.favToggleItem('t2')});

  // ---- 390 and 320 px, light and dark: the pill and its ♡, the strip, the switch stay inside
  for(const w of [390,320])for(const th of ['light','dark']){
    await p.setViewportSize({width:w,height:780});
    const L=await p.evaluate(async th=>{document.documentElement.dataset.theme=th;HOOK.closeItem();sel=new Date(2026,10,11);show('today');await new Promise(r=>setTimeout(r,120));
      const g=document.querySelector('.wpgrp'),h=document.querySelector('#today .day h2'),gr=g.getBoundingClientRect(),hr=h.getBoundingClientRect(),hb=$('#wpfav').getBoundingClientRect(),wx=document.querySelector('#today .day h2 .wxc');
      const r={pill:gr.right<=hr.right+.5&&gr.left>=hr.left-.5,heartW:Math.round(hb.width),heartH:Math.round(hb.height),wxCut:wx?wx.scrollWidth>wx.clientWidth+1&&!document.querySelector('.wx.wxwrap'):false,wrap:!!document.querySelector('#today .wx.wxwrap'),side:document.documentElement.scrollWidth-innerWidth,
        bg:getComputedStyle($('#wpfav')).backgroundColor};
      sel=new Date(2026,10,12);renderToday();openPicker('tie');await new Promise(r=>setTimeout(r,350));const s=$('#pick-sheet').getBoundingClientRect(),f=document.querySelector('.favlook').getBoundingClientRect();
      r.strip=f.left>=s.left-.5&&f.height>=44&&document.querySelector('.favstrip').getBoundingClientRect().right<=s.right+.5;closePicker();
      show('wardrobe');openItem('t2');await new Promise(r=>setTimeout(r,300));const t=document.querySelector('.favtog').getBoundingClientRect();r.tog=t.height>=44&&t.right<=innerWidth+.5;r.side2=document.documentElement.scrollWidth-innerWidth;HOOK.closeItem();return r},th);
    ok(L.pill&&L.heartH>=24&&L.heartW>=20&&(w<390||!L.wrap)&&!L.wxCut&&L.side<=0,`${T}${w}px ${th}: the ✓ Wore pill and its ♡ fit the date bar (♡ ${L.heartW}×${L.heartH}, the weather ${L.wxCut?'cut':'whole'}${L.wrap?', the pill under it':', one line'})`);
    ok(L.strip&&L.tog&&L.side2<=0,`${T}${w}px ${th}: the picker strip and the item switch stay inside (${JSON.stringify(L)})`);
  }
  ok(!errs.length,`${T}no page errors (${errs.join('; ')})`);
  await ctx.close();
}
