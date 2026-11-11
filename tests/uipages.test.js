// The pages other than Today share one design: page headers, 44px buttons and inputs, bordered cards; Settings is a full-screen
// page of categories that unfold (each with a one-line summary), opened at a category by openSettings('<key>'), closed by Done.
// Wardrobe boxes are one tap target with no buttons on them (Delete lives inside the open item). Nothing scrolls sideways.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';cache={};sel=new Date(2026,10,11);view={y:2026,m:10};flt='all'})()`);
    // ---- Settings
    await p.evaluate(()=>openSettings());
    const s0=await p.evaluate(()=>{const m=document.querySelector('#settings-modal').getBoundingClientRect(),cats=[...document.querySelectorAll('#settings-modal .scat')];
      return {full:m.width>=389&&m.height>=843,cats:cats.map(c=>c.id),open:cats.filter(c=>c.classList.contains('open')).length,sums:cats.map(c=>c.querySelector('.mltxt small').textContent),
        stats:!!document.querySelector('#settings-modal #stats-btn'),done:(document.querySelector('.shead .sdone')||{}).textContent,
        panel:document.querySelector('#sp-schedule').getBoundingClientRect().height}});
    ok(s0.full,'Settings fills the phone screen');
    ok(s0.cats.join()==='sc-schedule,sc-daysoff,sc-weather,sc-photos,sc-tagging,sc-backup,sc-connection'&&s0.open===0&&s0.panel<1,'seven categories, all folded when Settings opens');
    ok(s0.sums.every(t=>t.length>4)&&/Mon–Fri · blazers Thu/.test(s0.sums[0]),`each category shows a one-line summary (${s0.sums[0]})`);
    ok(s0.stats&&s0.done==='Done','a Wardrobe stats link at the top, and Done in the header');
    await p.click('#sc-schedule .scat-head');await settle(p,600);
    const s1=await p.evaluate(()=>({open:document.querySelector('#sc-schedule').classList.contains('open'),exp:document.querySelector('#sc-schedule .scat-head').getAttribute('aria-expanded'),h:document.querySelector('#sp-schedule').getBoundingClientRect().height}));
    ok(s1.open&&s1.exp==='true'&&s1.h>200,'tapping a category unfolds it');
    await p.click('#cfg-workdays .dtog:has-text("Sat")');
    ok(/Mon–Sat/.test(await p.textContent('#sum-schedule')),'its summary follows a change made inside it');
    await p.click('#cfg-workdays .dtog:has-text("Sat")');
    await p.click('#sc-schedule .scat-head');await settle(p,600);
    ok(await p.evaluate(()=>!document.querySelector('#sc-schedule').classList.contains('open')),'tapping it again folds it');
    await p.evaluate(()=>{closeSettings();openSettings('weather')});await settle(p,300);
    const w=await p.evaluate(()=>({open:[...document.querySelectorAll('#settings-modal .scat.open')].map(c=>c.id),top:document.querySelector('#sc-weather').getBoundingClientRect().top}));
    ok(w.open.join()==='sc-weather'&&w.top<200,`openSettings('weather') opens just Weather, scrolled into view (top ${Math.round(w.top)}px)`);
    await p.evaluate(()=>openSettings('connection'));await p.fill('#cfg-url','https://new.example.dev/');await p.click('.shead .sdone');
    ok(await p.evaluate(()=>localStorage.getItem('worker_url')==='https://new.example.dev/'&&!settingsOpen()),'Done saves the connection and closes Settings');
    // ---- Wardrobe
    await p.evaluate(()=>show('wardrobe'));
    const wd=await p.evaluate(()=>({head:document.querySelector('#wardrobe .phead h2').textContent,count:document.querySelector('#wardrobe .phead .pcount').textContent,
      btns:document.querySelectorAll('#wardrobe .grid .gi .btns').length,tiles:document.querySelectorAll('#wardrobe .grid .giopen').length,type:(document.querySelector('.gimeta .gtype')||{}).textContent}));
    ok(wd.head==='Wardrobe'&&/^\d+ items$/.test(wd.count)&&wd.btns===0&&wd.tiles>10&&wd.type,'Wardrobe: a page header with the item count; each box is the item, with no Edit/Delete buttons on it');
    const id=await p.evaluate(()=>document.querySelector('#wardrobe .gi').id.slice(3));
    await p.click(`#gi-${id} .giopen`);await settle(p,600);
    const op=await p.evaluate(id=>[...document.querySelectorAll(`#gi-${id} .giact button`)].map(b=>b.textContent+(b.classList.contains('danger')?'!':'')),id);
    ok(op.join('|')==='Close|Delete!|Take out of rotation','the open item has Close, Delete (marked as destructive) and Take out of rotation');
    // ---- Add
    await p.evaluate(()=>{closeItem();show('add')});await settle(p,400);
    const ad=await p.evaluate(()=>({head:document.querySelector('#add .phead h2').textContent,picks:[...document.querySelectorAll('#add .addpick label')].map(l=>l.querySelector('span').textContent),
      more:!!document.querySelector('#add .addmore #photo-url')&&!!document.querySelector('#add .addmore .addrow')}));
    ok(ad.head==='Add to wardrobe'&&ad.picks.join()==='One item,Several items'&&ad.more,'Add: a page header, the two ways in, and the other ways in one card');
    await p.evaluate(()=>{addManual();setq(0,'type','suit')});
    const lab=await p.evaluate(()=>[...document.querySelectorAll('#queue .card>label')].map(l=>l.firstChild.textContent.trim()).slice(0,4).join(','));
    ok(lab==='Type,Colour,Second colour,Third colour','the item card and the Wardrobe editor use the same labels');
    ok(await p.evaluate(()=>[...document.querySelectorAll('#queue select')].every(s=>[...s.options].every(o=>!/^[a-z]/.test(o.textContent)))),'dropdown choices start with a capital');
    // ---- one size for controls, one style for page titles
    const sz=await p.evaluate(async()=>{const out={btn:new Set(),inp:new Set()},take=root=>{for(const b of root.querySelectorAll('button:not(.giopen):not(.chip):not(.chipbtn):not(.linkbtn):not(.dtog):not(.addrow):not(.pback):not(.fchip button):not(.month-link):not(.slink)'))if(b.offsetParent)out.btn.add(Math.round(b.getBoundingClientRect().height));
        for(const i of root.querySelectorAll('select,input[type=text],input[type=url],input[type=date]'))if(i.offsetParent)out.inp.add(Math.round(i.getBoundingClientRect().height))};
      take(document.querySelector('#add'));openSettings();for(const k of SET_CATS)setCatOpen(k,true,true);take(document.querySelector('#settings-modal'));closeSettings();
      const titles=[];for(const s of ['wardrobe','add']){show(s);titles.push(getComputedStyle(document.querySelector(`#${s} .phead h2`)).fontSize)}openStats();titles.push(getComputedStyle(document.querySelector('#stats .phead h2')).fontSize);
      return {btn:[...out.btn],inp:[...out.inp],titles}});
    ok(sz.btn.every(h=>h===44),`buttons are 44px tall on Add and in Settings (${sz.btn})`);
    ok(sz.inp.every(h=>h===44),`inputs and dropdowns are 44px too, so a button beside one lines up (${sz.inp})`);
    ok(new Set(sz.titles).size===1&&sz.titles[0]==='22px','Wardrobe, Add and Stats share one page title style');
    // ---- nothing scrolls sideways, on a small phone and on the Duo
    for(const w of [320,466,626]){await p.setViewportSize({width:w,height:800});
      const over=await p.evaluate(async()=>{const r={};for(const s of ['wardrobe','add']){show(s);await new Promise(x=>setTimeout(x,50));r[s]=document.documentElement.scrollWidth-innerWidth}
        openSettings();for(const k of SET_CATS)setCatOpen(k,true,true);const m=document.querySelector('#settings-modal');r.settings=m.scrollWidth-m.clientWidth;closeSettings();return r});
      ok(Object.values(over).every(v=>v<=0),`${w}px wide: no page scrolls sideways (${JSON.stringify(over)})`)}
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
