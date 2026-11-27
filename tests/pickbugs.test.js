// The color & texture picker audit's four bugs (2026-11-17, C:\code\audit-2026-11-13\picker-audit\AUDIT.md §3), in Chromium and WebKit
// at 390 px: (1) "+ New color" / "+ New pattern or texture" (and Settings' "+ New color"): a name typed and one real tap on "Add … and use
// it" adds it the first time (the Name field's change used to redraw the sheet under the finger), by touch and by mouse, and a hex typed
// then left keeps the sheet in place; (2) the pattern sheet has no "Add a close-up" hint for types that can't have one (socks, pocket
// square, casual types); (3) the hint says "Pictures, at the bottom" (not "under the photos") and its link closes the picker, opens Pictures
// and shows its Close-up button; the Add card's hint has no place; (4) cargo pants read "Cargo pants" in the item sheet's Kind and Details
// and the Wardrobe grid, while the planner still reads them as chinos. The worker is mocked (no paid call).
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){const T=eng+': ';
  const open=async touch=>{const ctx=await browser.newContext({viewport:{width:390,height:844},...(touch?{hasTouch:true,isMobile:eng==='Chromium'}:{})});
    await ctx.route('https://w.test/**',route=>{const q=route.request();
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
      return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
    await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{HOOK.CK_OPEN['*']=true;HOOK.rememberRole({role:'owner'});if(document.querySelector('#setup.on')&&'setupClose' in HOOK&&typeof HOOK.setupClose==='function')HOOK.setupClose();
      const I=(id,type,x={})=>({id,type,primaryColor:'navy',pattern:'solid',added:1,...x});
      HOOK.items=[I('t1','tie'),I('t2','tie',{primaryColor:'red'}),I('s1','suit',{primaryColor:'grey'}),I('k1','socks'),I('q1','pocketsquare',{primaryColor:'white'}),I('e1','tee',{primaryColor:'white'}),
        I('w1','sweater'),I('c1','chore'),I('p1','pants',{primaryColor:'khaki',trouserKind:'cargo'})];HOOK.cache={};HOOK.flt='all';HOOK.editing=null;HOOK.show('wardrobe')});
    return {ctx,p,errs}};
  const sheetOn=p=>p.evaluate(()=>document.querySelector('#col-sheet').classList.contains('on'));
  const openItemPick=async(p,id,k,tap)=>{await p.evaluate(id=>{HOOK.closeColPick();HOOK.openItem(id)},id);await settle(p,150);
    const b=`#item-view.on .colbtn[data-k="${k}"]`;await p.locator(b).scrollIntoViewIfNeeded();if(tap)await p.tap(b);else await p.click(b);await p.waitForSelector('#col-sheet.on')};
  // typed as a person would: the field focused, keys typed (input events), then ONE tap on the bar's button, which takes the focus away
  const typeName=async(p,name)=>{await p.focus('#cn-name');await p.keyboard.type(name);await settle(p,50)};
  // ================= (1) touch =================
  {const {ctx,p,errs}=await open(true);
    await openItemPick(p,'t1','primaryColor',true);await p.tap('#cn-open');await p.waitForSelector('#cn-name');
    // the "How the app uses it" fold is there (hidden) and shows as a name is typed, with no redraw of the sheet
    let e=await p.evaluate(()=>{const h=document.querySelector('#cn-how');window.__bar=document.querySelector('#cn-add');return {has:!!h,hidden:!!(h&&h.hidden)}});
    ok(e.has&&e.hidden,T+'New color: "How the app uses it" is drawn, hidden until there is a name');
    await typeName(p,'Dusty rose');
    e=await p.evaluate(()=>({same:document.querySelector('#cn-add')===window.__bar,bar:document.querySelector('#cn-add').textContent,how:!(document.querySelector('#cn-how')||{hidden:true}).hidden,act:document.activeElement&&document.activeElement.id}));
    ok(e.same&&e.bar==='Add Dusty rose and use it'&&e.how&&e.act==='cn-name',T+`typing the name updates the button and shows "How the app uses it" in place (${JSON.stringify(e)})`);
    await p.tap('#cn-add');await settle(p,400);
    e=await p.evaluate(()=>{const c=HOOK.items.find(x=>x.id==='t1').primaryColor;return {on:document.querySelector('#col-sheet').classList.contains('on'),name:HOOK.CUSTOM_COL[c]&&HOOK.CUSTOM_COL[c].name}});
    ok(!e.on&&e.name==='Dusty rose',T+`New color, touch: the FIRST tap on "Add Dusty rose and use it" adds it and sets the tie (${JSON.stringify(e)})`);
    // the hex typed and left by a tap on the name field: the sheet stays in place (the field isn't replaced under the finger)
    await openItemPick(p,'t2','primaryColor',true);await p.tap('#cn-open');await p.waitForSelector('#cn-hex');
    await p.evaluate(()=>{window.__name=document.querySelector('#cn-name')});
    await p.focus('#cn-hex');await p.keyboard.press(eng==='WebKit'?'Meta+A':'Control+A');await p.keyboard.type('#336699');
    await p.locator('#cn-name').scrollIntoViewIfNeeded();await p.tap('#cn-name');await p.keyboard.type('Deep sea');await settle(p,100);
    e=await p.evaluate(()=>({same:document.querySelector('#cn-name')===window.__name,act:document.activeElement&&document.activeElement.id,hex:HOOK.colPick&&HOOK.colPick.newc&&HOOK.colPick.newc.hex,base:document.querySelector('#cn-base').value}));
    ok(e.same&&e.act==='cn-name'&&e.hex==='#336699'&&!!e.base,T+`a hex typed, then a tap on Name: the shade is taken, the Name field is the one tapped and has the focus (${JSON.stringify(e)})`);
    await p.tap('#cn-add');await settle(p,400);
    e=await p.evaluate(()=>{const c=HOOK.items.find(x=>x.id==='t2').primaryColor;return {on:document.querySelector('#col-sheet').classList.contains('on'),name:HOOK.CUSTOM_COL[c]&&HOOK.CUSTOM_COL[c].name,hex:HOOK.COLORS[c]}});
    ok(!e.on&&e.name==='Deep sea'&&e.hex==='#336699',T+`…and the first tap on Add adds Deep sea with that shade (${JSON.stringify(e)})`);
    // New pattern
    await openItemPick(p,'t1','pattern',true);await p.tap('#pn-open');await p.waitForSelector('#cn-name');
    await typeName(p,'Hopsack');await p.tap('#cn-add');await settle(p,400);
    e=await p.evaluate(()=>{const k=HOOK.items.find(x=>x.id==='t1').pattern;return {on:document.querySelector('#col-sheet').classList.contains('on'),name:HOOK.CUSTOM_PAT[k]&&HOOK.CUSTOM_PAT[k].name}});
    ok(!e.on&&e.name==='Hopsack',T+`New pattern, touch: the FIRST tap on "Add Hopsack and use it" adds it and sets the tie (${JSON.stringify(e)})`);
    // Settings → + New color
    await p.evaluate(()=>{HOOK.closeColPick();HOOK.openSettings();HOOK.openCustomNew('colour')});await p.waitForSelector('#cn-name');
    await typeName(p,'Old wine');
    ok(await p.evaluate(()=>document.querySelector('#cn-add').textContent==='Add Old wine'),T+'Settings\' New color: the button reads "Add Old wine"');
    await p.tap('#cn-add');await settle(p,400);
    e=await p.evaluate(()=>({on:document.querySelector('#col-sheet').classList.contains('on'),has:((HOOK.settings.custom||{}).colors||[]).some(c=>c.name==='Old wine')}));
    ok(!e.on&&e.has,T+`Settings' New color, touch: the FIRST tap on Add adds it (${JSON.stringify(e)})`);
    ok(!errs.length,T+'no page errors (touch) '+errs.join(' | '));
    await ctx.close()}
  // ================= (1) mouse =================
  {const {ctx,p,errs}=await open(false);
    await openItemPick(p,'t1','primaryColor',false);await p.click('#cn-open');await p.waitForSelector('#cn-name');
    await typeName(p,'Dusty rose');await p.click('#cn-add');await settle(p,400);
    let e=await p.evaluate(()=>{const c=HOOK.items.find(x=>x.id==='t1').primaryColor;return {on:document.querySelector('#col-sheet').classList.contains('on'),name:HOOK.CUSTOM_COL[c]&&HOOK.CUSTOM_COL[c].name}});
    ok(!e.on&&e.name==='Dusty rose',T+`New color, mouse: the first click on Add adds it (${JSON.stringify(e)})`);
    await openItemPick(p,'t2','pattern',false);await p.click('#pn-open');await p.waitForSelector('#cn-name');
    await typeName(p,'Hopsack');await p.click('#cn-add');await settle(p,400);
    e=await p.evaluate(()=>{const k=HOOK.items.find(x=>x.id==='t2').pattern;return {on:document.querySelector('#col-sheet').classList.contains('on'),name:HOOK.CUSTOM_PAT[k]&&HOOK.CUSTOM_PAT[k].name}});
    ok(!e.on&&e.name==='Hopsack',T+`New pattern, mouse: the first click on Add adds it (${JSON.stringify(e)})`);
    // ================= (2) no dead-end pattern hint =================
    const hint=async(id,k)=>{await openItemPick(p,id,k,false);const h=await p.evaluate(()=>{const x=document.querySelector('#col-sheet .cpaskhint');return x?x.textContent:null});await p.evaluate(()=>HOOK.closeColPick());return h};
    const none=[];for(const id of ['k1','q1','e1','w1','c1'])for(const k of ['pattern','primaryColor']){const h=await hint(id,k);if(h!==null)none.push(id+' '+k+': '+h)}
    ok(!none.length,T+'socks, pocket square, T-shirt, sweater, chore jacket: neither the pattern nor the color sheet says "Add a close-up" '+none.join(' | '));
    // ================= (3) the hint's wording and link =================
    for(const k of ['primaryColor','pattern']){
      await p.evaluate(()=>{HOOK.CK_OPEN['e|pics']=false});const h=await hint('s1',k);
      ok(!!h&&/Add a close-up in Pictures, at the bottom and Claude can (read the colors|name the pattern)\./.test(h)&&!/under the photos/.test(h),T+`a suit with no close-up, ${k}: the hint points to Pictures, at the bottom (${h})`)}
    await p.evaluate(()=>{HOOK.CK_OPEN['e|pics']=false});await openItemPick(p,'s1','pattern',false);
    ok(await p.evaluate(()=>!document.querySelector('#item-view.on .ivpics').classList.contains('open')),T+'(Pictures starts folded)');
    await p.click('#col-sheet .cpgopics');await settle(p,700);
    // (the sheet's own smooth scroll, which settle doesn't watch, may still be running: wait for the button to come into view, up to 3 s;
    // a longer Planning & care, the favorites' switch 2026-11-18, made it 72 px longer and the check read it mid-way)
    await p.waitForFunction(()=>{const b=document.querySelector('#item-view.on .ivpics .pt-closeup'),r=b&&b.getBoundingClientRect();return !!r&&r.height>0&&r.top>=0&&r.bottom<=innerHeight},null,{timeout:3000}).catch(()=>{});
    let e2=await p.evaluate(()=>{const s=document.querySelector('#item-view.on .ivpics'),b=s&&s.querySelector('.pt-closeup'),r=b&&b.getBoundingClientRect();
      return {sheet:document.querySelector('#col-sheet').classList.contains('on'),open:!!(s&&s.classList.contains('open')),seen:!!r&&r.height>0&&r.top>=0&&r.bottom<=innerHeight}});
    ok(!e2.sheet&&e2.open&&e2.seen,T+`the link closes the picker, opens Pictures and shows its Close-up button (${JSON.stringify(e2)})`);
    e2=await p.evaluate(()=>{const c=HOOK.colPick;HOOK.colPick={src:'q'};try{return HOOK.cpAskHint('name the pattern')}finally{HOOK.colPick=c}});
    ok(/Add a close-up and Claude can name the pattern/.test(e2)&&!/cpgopics|Pictures/.test(e2),T+'on the Add card the hint names no place and has no link');
    // ================= (4) cargo pants =================
    await p.evaluate(()=>{HOOK.closeColPick();HOOK.openItem('p1')});await settle(p,150);
    e2=await p.evaluate(()=>{const s=[...document.querySelectorAll('#item-view.on select')].find(x=>x.dataset.f==='trouserKind');
      const d=[...document.querySelectorAll('#item-view.on .cks')].find(x=>x.dataset.ck==='details');
      return {v:s&&s.value,shown:s&&s.selectedOptions[0].textContent,opts:s&&[...s.options].map(o=>o.value),sum:d&&d.querySelector('.ckt small').textContent,plan:HOOK.trouserKind(HOOK.items.find(x=>x.id==='p1'))}});
    ok(e2.v==='cargo'&&e2.shown==='Cargo pants'&&e2.opts.join()==='dress,chinos,jeans,cargo'&&/cargo pants/.test(e2.sum)&&!/chinos/.test(e2.sum),T+`cargo pants: the item sheet's Kind reads "Cargo pants" and Details says cargo (${JSON.stringify(e2)})`);
    ok(e2.plan==='chinos',T+'the planner still reads cargo pants as chinos (trouserKind)');
    e2=await p.evaluate(()=>{if('closeItem' in HOOK&&typeof HOOK.closeItem==='function')HOOK.closeItem();HOOK.renderWardrobe();const g=document.querySelector('#gi-p1 .gtype');return g&&g.textContent});
    ok(e2==='Cargo pants',T+`the Wardrobe grid labels them "Cargo pants" (${e2})`);
    ok(!errs.length,T+'no page errors (mouse) '+errs.join(' | '));
    await ctx.close()}
}
