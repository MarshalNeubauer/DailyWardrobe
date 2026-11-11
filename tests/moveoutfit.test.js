// Moving an outfit in the open month: long-press a day, drag it over another and the month is re-planned live (the outfit pinned
// there, the day it left planned afresh, later days adjusting), outfits that changed day slide; drop to keep it (with Undo), drop
// elsewhere to cancel. Only today and later workdays that aren't worn and have no occasion take part; a tap still opens the day.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=()=>p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';
      dayRecs={'2026-11-09':{date:'2026-11-9'}};delete dayRecs['2026-11-09'];dayRecs['2026-11-30']={date:'2026-11-30',occasion:'wedding'};cache={};sel=new Date(2026,10,11);view={y:2026,m:10};monthOpen=true;show('today');
      const b=document.querySelector('#mbox');scrollTo(0,b.getBoundingClientRect().top+scrollY-60)})()`);
    await setup();await settle(p,400);
    const pt=k=>p.evaluate(k=>{const r=document.querySelector(`#mpanel-in .mc[data-k="${k}"]`).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}},k);
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    // which days take part
    const mv=await p.evaluate(()=>({past:!!document.querySelector('#mpanel-in .mc[data-k="2026-11-9"][data-mv]'),today:!!document.querySelector('#mpanel-in .mc[data-k="2026-11-11"][data-mv]'),
      fut:!!document.querySelector('#mpanel-in .mc[data-k="2026-11-18"][data-mv]'),occ:!!document.querySelector('#mpanel-in .mc[data-k="2026-11-30"][data-mv]'),wkend:!!document.querySelector('#mpanel-in .mc[data-k="2026-11-14"][data-mv]')}));
    ok(!mv.past&&mv.today&&mv.fut&&!mv.occ&&!mv.wkend,'today and later workdays can be moved; past days, occasion days and weekends can\'t');
    // the preview helper leaves the real plan alone
    const pure=await p.evaluate(()=>{const before=JSON.stringify(dayRecs),b0=planFor()['2026-11-16'].top.id,recs=moveRecs('2026-11-18','2026-11-16',planMonth(2026,10)),pl=planWith(recs,2026,10);
      return {same:JSON.stringify(dayRecs)===before&&planFor()['2026-11-16'].top.id===b0,moved:pl['2026-11-16'].top.id===planMonth(2026,10)['2026-11-18'].top.id,kind:recs['2026-11-16'].kind,force:Object.keys(recs['2026-11-16'].force).join()}});
    ok(pure.same&&pure.moved,'a preview re-plans a copy: the moved outfit lands on the target, the real records and plan are untouched');
    ok(/top/.test(pure.force)&&/shirt/.test(pure.force)&&/tie/.test(pure.force)&&!/coat/.test(pure.force)&&pure.kind,'the target pins the outfit\'s pieces (not the weather\'s coat) and keeps its kind');
    // a suit outfit moved onto a blazer day stays a suit day
    const kind=await p.evaluate(()=>{const base=planMonth(2026,10),src=Object.keys(base).find(k=>keyDate(k)>todayDate()&&base[k].suitDay&&base[k].top),recs=moveRecs(src,'2026-11-19',base),pl=planWith(recs,2026,10);
      return pl['2026-11-19'].suitDay&&pl['2026-11-19'].top.type==='suit'&&pl['2026-11-19'].top.id===base[src].top.id});
    ok(kind,'a suit outfit dropped on a blazer day (Thursday) stays a suit day');
    // a long press lifts it; dragging over another day re-plans the month live
    const a=await pt('2026-11-18'),z=await pt('2026-11-16');
    const before=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#mpanel-in .mc[data-sig]')].map(c=>[c.dataset.k,c.dataset.sig])));
    await T('touchStart',a.x,a.y);await p.waitForTimeout(500);
    const lifted=await p.evaluate(()=>({mv:!!outfitMove,ghost:!!document.querySelector('.mv-ghost .stack pattern'),cls:document.querySelector('#mpanel-in .mc[data-k="2026-11-18"]').classList.contains('lifted'),wig:document.querySelector('#mpanel-in').classList.contains('mv-on')}));
    ok(lifted.mv&&lifted.ghost&&lifted.cls&&lifted.wig,'a long press lifts the outfit: it follows the finger (its own drawing), the day it left is outlined, the others wiggle');
    for(let k=1;k<=10;k++){await T('touchMove',a.x+(z.x-a.x)*k/10,a.y+(z.y-a.y)*k/10);await p.waitForTimeout(25)}
    await p.waitForTimeout(100);
    const mid=await p.evaluate(()=>({over:outfitMove&&outfitMove.over,drop:document.querySelector('#mpanel-in .mc[data-k="2026-11-16"]').classList.contains('drop'),
      sig16:document.querySelector('#mpanel-in .mc[data-k="2026-11-16"]').dataset.sig,cells:Object.fromEntries([...document.querySelectorAll('#mpanel-in .mc[data-sig]')].map(c=>[c.dataset.k,c.dataset.sig])),sel:key(sel),saved:!!dayRecs['2026-11-16']}));
    ok(mid.over==='2026-11-16'&&mid.drop&&mid.sig16===before['2026-11-18'],'held over Monday, Monday shows the moved outfit');
    const changed=Object.keys(mid.cells).filter(k=>mid.cells[k]!==before[k]);
    ok(changed.includes('2026-11-18')&&changed.length>=2,`the rest of the month is re-planned live (${changed.length} days changed), nothing saved yet`);
    ok(!mid.saved&&mid.sel==='2026-11-11','nothing is saved and the day on Today doesn\'t change while dragging');
    await T('touchEnd');await settle(p,600);
    const done=await p.evaluate(()=>({p16:planFor()['2026-11-16'].top.id,rec:dayRecs['2026-11-16'],toast:document.querySelector('#toast').textContent,undo:!!document.querySelector('#toast button'),sel:key(sel),month:monthOpen}));
    ok(done.rec&&done.rec.force&&done.p16===before['2026-11-18'].split('|')[0]&&done.sel==='2026-11-11'&&done.month,'dropping keeps it: Monday is pinned to the outfit, Today stays on its day, the month stays open');
    ok(/Wednesday, Nov 18's outfit moved to Monday, Nov 16/.test(done.toast)&&done.undo,'a message says what moved, with Undo');
    await p.click('#toast button');await settle(p,400);
    ok(await p.evaluate(b=>!dayRecs['2026-11-16']||!dayRecs['2026-11-16'].force?planFor()['2026-11-18'].top.id===b.split('|')[0]:false,before['2026-11-18']),'Undo puts both days back');
    // dropping somewhere that isn't a day cancels
    await setup();await settle(p,300);const a2=await pt('2026-11-18');
    await T('touchStart',a2.x,a2.y);await p.waitForTimeout(500);await T('touchMove',a2.x,a2.y-300);await T('touchMove',a2.x,a2.y-320);await T('touchEnd');await settle(p,400);
    ok(await p.evaluate(()=>!outfitMove&&Object.keys(dayRecs).every(k=>!dayRecs[k].force)&&!document.querySelector('.mv-ghost')),'dropping off the days cancels: nothing changes');
    // moving before the hold ends is a scroll or a swipe, not a move; a quick tap opens the day
    await T('touchStart',a2.x,a2.y);await T('touchMove',a2.x,a2.y-40);await p.waitForTimeout(500);
    ok(await p.evaluate(()=>!outfitMove),'moving the finger before the hold ends doesn\'t lift anything');
    await T('touchEnd');await setup();await settle(p,300);
    await p.tap('#mpanel-in .mc[data-k="2026-11-18"]');await settle(p,400);
    ok(await p.evaluate(()=>key(sel)==='2026-11-18'),'a quick tap still opens the day');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
    // with a mouse on a computer: hold the button, drag, release
    const dctx=await browser.newContext({viewport:{width:1000,height:900}}),d=await dctx.newPage();
    await d.goto(url);await d.waitForFunction(()=>window.appReady);
    await d.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,11);view={y:2026,m:10};monthOpen=true;show('today');
      const b=document.querySelector('#mbox');scrollTo(0,b.getBoundingClientRect().top+scrollY-60)})()`);await settle(d,400);
    const dp=k=>d.evaluate(k=>{const r=document.querySelector(`#mpanel-in .mc[data-k="${k}"]`).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}},k);
    const b1=await dp('2026-11-18'),b2=await dp('2026-11-17');
    await d.mouse.move(b1.x,b1.y);await d.mouse.down();await d.waitForTimeout(500);await d.mouse.move(b2.x,b2.y,{steps:8});await d.mouse.up();await settle(d,500);
    ok(await d.evaluate(()=>!!(dayRecs['2026-11-17']&&dayRecs['2026-11-17'].force)),'a mouse can hold and drag too');
    await dctx.close();
  }finally{await browser.close()}
};
