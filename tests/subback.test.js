// The ‹ on a page opened from Settings (stats, packing, care) goes back to Settings as it was: the same categories open, scrolled the same,
// over the page that was under it, still scrolled where it was. Opened from Today (the care note's link), it goes back to Today. (The ‹
// always went to Today, out of Settings entirely.)
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10}});
    for(const [name,btn,page] of [['Wardrobe stats','#stats-btn','stats'],['Packing list','#pack-btn','pack'],['Laundry & cleaning','#care-btn','care']]){
      // the Wardrobe under Settings, scrolled; Settings with two categories open and scrolled to its end (the link tapped from there)
      await p.evaluate(()=>{show('wardrobe');document.querySelector('main').style.minHeight='3000px';scrollTo(0,300)});await settle(p,400);
      const before=await p.evaluate(btn=>{openSettings();setCatOpen('weather',true,true);setCatOpen('backup',true,true);const m=document.querySelector('#settings-modal');
        m.scrollTop=m.scrollHeight;return {top:m.scrollTop,y:scrollY}},btn);
      await p.evaluate(btn=>document.querySelector(btn).click(),btn);await p.waitForFunction(page=>!document.querySelector('#'+page).hidden&&!settingsOpen(),page);await settle(p,400);
      await p.click(`#${page} .pback`);await settle(p,300);
      const after=await p.evaluate(()=>{const m=document.querySelector('#settings-modal');return {open:settingsOpen(),cats:SET_CATS.filter(k=>document.querySelector('#sc-'+k).classList.contains('open')).join(),
        top:m.scrollTop,ward:!document.querySelector('#wardrobe').hidden,y:scrollY}});
      ok(before.top>100&&after.open&&after.cats==='weather,backup'&&Math.abs(after.top-before.top)<=2&&after.ward&&after.y===before.y,
        `${name}: ‹ goes back to Settings as it was (${after.cats} open, scrolled ${after.top} of ${before.top}px) over the Wardrobe (${after.y}px)`);
      await p.evaluate(()=>{closeSettings();document.querySelector('main').style.minHeight=''});
    }
    // opened from Today (not from Settings): ‹ goes back to Today, Settings stays shut
    await p.evaluate(()=>{show('today');scrollTo(0,0);openCare()});await settle(p,300);await p.click('#care .pback');await settle(p,300);
    ok(await p.evaluate(()=>!settingsOpen()&&!document.querySelector('#today').hidden&&document.querySelector('#care').hidden),'opened from Today, ‹ goes back to Today, Settings stays shut');
    // the phone's Back (a history step back) does the same as the ‹
    await p.evaluate(()=>{show('wardrobe');scrollTo(0,0);openSettings();setCatOpen('backup',true,true)});await settle(p,200);
    const h0=await p.evaluate(()=>history.length);
    await p.evaluate(()=>document.querySelector('#stats-btn').click());await p.waitForFunction(()=>!document.querySelector('#stats').hidden);await settle(p,300);
    const pushed=await p.evaluate(()=>({len:history.length,state:history.state}));
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>settingsOpen(),null,{timeout:3000}).catch(()=>{});await settle(p,300);
    const bk=await p.evaluate(()=>({open:settingsOpen(),backup:document.querySelector('#sc-backup').classList.contains('open'),stats:!document.querySelector('#stats').hidden,ward:!document.querySelector('#wardrobe').hidden}));
    ok(pushed.len>=h0&&pushed.state&&pushed.state.sub===1&&bk.open&&bk.backup&&!bk.stats&&bk.ward,`the phone's Back on Wardrobe stats goes back to Settings as it was, over the Wardrobe (${JSON.stringify(bk)})`);
    // left with the ‹ or a tab, the page's Back entry goes with it: the next Back doesn't bring the page or Settings back
    for(const how of ['pback','tab']){
      await p.evaluate(()=>{closeSettings();show('today');openSettings()});await settle(p,200);
      await p.evaluate(()=>document.querySelector('#pack-btn').click());await p.waitForFunction(()=>!document.querySelector('#pack').hidden);await settle(p,200);
      if(how==='pback')await p.click('#pack .pback');else await p.click('#n-add');
      await settle(p,400);
      const st=await p.evaluate(()=>({state:history.state,pack:!document.querySelector('#pack').hidden}));
      ok(!(st.state&&st.state.sub)&&!st.pack,`left by ${how==='pback'?'the ‹':'a tab'}, the packing list's Back entry is gone with it`);
    }
    // left for the Wardrobe and an item opened at once: the step back that drops the page's entry doesn't shut the item; its own Back does
    await p.evaluate(()=>{closeSettings();show('today');openCare()});await settle(p,200);
    await p.evaluate(()=>{flt='all';show('wardrobe');openItem(items[0].id)});await settle(p,600);
    const it=await p.evaluate(()=>({open:!!editing,state:history.state}));
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!editing,null,{timeout:3000}).catch(()=>{});
    ok(it.open&&it.state&&it.state.item===1&&await p.evaluate(()=>!editing),`an item opened right after leaving the care page stays open with its own Back entry, and Back shuts it (${JSON.stringify(it)})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
