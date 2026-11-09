// Wardrobe: tapping an item (photo or name) opens its editor in place: the tapped box keeps its spot on screen and grows
// across its row, the item beside it slides down under it, and the rows below don't change. Tapping the open photo or
// swatch (or Close / Done) folds it back the same way. Edit still works; while cropping, tapping the photo doesn't close.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const rect=id=>p.evaluate(id=>{const r=document.getElementById('gi-'+id).getBoundingClientRect();return {top:Math.round(r.top),left:Math.round(r.left),width:Math.round(r.width)}},id);
  const settle=()=>p.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ten shirts in a two-column grid, newest first: s9 s8 / s7 s6 / s5 s4 / ...
    await p.evaluate(ph=>{items=[...Array(10)].map((_,n)=>({id:'s'+n,type:'shirt',primaryColor:n%2?'white':'lightblue',pattern:'solid',photo:ph,added:n}));
      items.push({id:'t',type:'tie',primaryColor:'navy',pattern:'solid',added:0});flt='all';editing=null;show('wardrobe')},PH);
    await p.evaluate(()=>window.scrollTo(0,document.getElementById('gi-s7').getBoundingClientRect().top+scrollY-120));
    // tap the right-hand item of a row (s6, beside s7)
    const b6=await rect('s6'),b7=await rect('s7'),b5=await rect('s5'),b4=await rect('s4');
    await p.click('#gi-s6 .giopen img');
    const anim=await p.evaluate(()=>document.getAnimations().length);
    const a6=await rect('s6');await settle();
    const s6=await rect('s6'),s7=await rect('s7'),s5=await rect('s5'),s4=await rect('s4');
    ok(await p.evaluate(()=>editing==='s6'&&!!document.querySelector('#gi-s6 .phtools')&&!!document.querySelector('#gi-s6 .pair')),'tapping an item\'s photo opens its editor');
    ok(Math.abs(a6.top-b6.top)<=2&&Math.abs(s6.top-b6.top)<=2,`the tapped box stays where it was on screen (top ${b6.top} → ${s6.top})`);
    ok(s6.left===b7.left&&s6.width>b6.width*1.8,'it opens across the whole row, starting from the left');
    ok(s7.left===b7.left&&s7.top>s6.top+200,'the item beside it moves down under the open one, in its own column');
    ok(s5.left===b5.left&&s4.left===b4.left&&s4.top===s5.top,'the rows below keep their layout (a blank cell fills the open item\'s slot)');
    ok(anim>0,`the boxes glide into place instead of jumping (${anim} animations)`);
    // tapping the photo again folds it back, in reverse
    const o6=await rect('s6');await p.click('#gi-s6 .giclose .phfig img');const c6=await rect('s6');await settle();const e6=await rect('s6'),e7=await rect('s7');
    ok(await p.evaluate(()=>editing===null&&!!document.querySelector('#gi-s6 .giopen')),'tapping the open photo closes it');
    ok(Math.abs(c6.top-o6.top)<=2&&e6.left===b6.left&&e7.left===b7.left&&e7.top===e6.top,'and everything goes back to where it was, the box staying put');
    await p.click('#gi-s6 .giopen b');await settle();await p.click('#gi-s6 .tagsw');await settle();
    ok(await p.evaluate(()=>editing===null),'tapping the tagged swatch closes it too');
    // the left item of a row opens in place too; opening another item folds the first one
    await p.click('#gi-s9 .giopen b');await settle();
    ok(await p.evaluate(()=>editing==='s9'&&!!document.querySelector('#gi-s9 select')),'tapping an item\'s name opens it');
    await p.click('#gi-s4 .giopen b');await settle();
    ok(await p.evaluate(()=>editing==='s4'&&!!document.querySelector('#gi-s4 select')&&!!document.querySelector('#gi-s9 .giopen')),'tapping another item opens that one and folds the first');
    await p.click('#gi-s4 .btns >> text=Close');await settle();
    ok(await p.evaluate(()=>editing===null&&!!document.querySelector('#gi-s4 .giopen')&&!document.querySelector('.gi-gap')),'Close folds it back');
    await p.click('#gi-t .btns >> text=Edit');await settle();
    ok(await p.evaluate(()=>editing==='t'),'the Edit button still works (an item without a photo too)');
    await p.click('#gi-t .giclose');await settle();
    ok(await p.evaluate(()=>editing===null),'tapping a drawn swatch of an item without a photo closes it');
    // while cropping, the photo is for cropping: it doesn't close the item
    await p.click('#gi-s8 .giopen img');await settle();
    await p.evaluate(()=>{phEdit.id='s8';phEdit.crop={x:0,y:0,s:1};renderWardrobe()});
    ok(await p.evaluate(()=>!document.querySelector('#gi-s8 .giclose')&&editing==='s8'),'while cropping, tapping the photo does not close the item');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
