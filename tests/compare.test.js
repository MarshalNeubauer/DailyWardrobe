// Wardrobe item sheet, Pictures: the photo and the split swatch (drawing | close-up) are plain pictures. The old tap-to-compare
// there was taken out at the owner's ask (2026-11-16); the comparison lives in Look & compare. The photo tool row stays.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    await p.evaluate(ph=>{items=[{id:'a',type:'blazer',primaryColor:'tan',secondaryColor:'lightblue',pattern:'windowpane',photo:ph,texture:ph,added:3},
      {id:'b',type:'pants',primaryColor:'navy',pattern:'solid',photo:ph,added:2}];flt='all';editing=null;show('wardrobe')},PH);
    await p.tap('#gi-a .giopen');await settle(p,500);
    const look=()=>p.evaluate(()=>{const pics=document.querySelector('#item-view .ivpics'),pair=pics&&pics.querySelector('.ivhero .pair');if(!pair)return null;
      return {old:!!document.querySelector('#ivpair,.cmpable,.cmpdraw,.cmpbox'),tap:[...pair.querySelectorAll('*')].some(e=>e.hasAttribute('onclick')||e.getAttribute('role')==='button'||e.hasAttribute('tabindex')),
        photo:!!pair.querySelector('.phfig img.ph'),sw:!!pair.querySelector('.tagsw .swsplit'),tex:!!pair.querySelector('.tagsw .swtex'),fn:typeof window.toggleCompare,
        tools:(pics.querySelector('.phtools')||{innerText:''}).innerText.replace(/\s+/g,'|')}});
    let v=await look();
    ok(v&&v.photo&&v.sw&&v.tex,'Pictures still shows the photo and the split swatch with the close-up');
    ok(v&&!v.old&&!v.tap&&v.fn==='undefined',`nothing in the pair is tappable; the old compare is gone (${JSON.stringify(v)})`);
    ok(v&&/Replace/.test(v.tools)&&/Rotate/.test(v.tools)&&/Crop/.test(v.tools)&&/Close-up/.test(v.tools),`the Replace · Rotate · Crop · Close-up row stays (${v&&v.tools})`);
    await p.tap('#item-view .ivpics .tagsw');await settle(p,300);
    ok(await p.evaluate(()=>editing==='a'&&!document.querySelector('.pair.cmp')),'a tap on the swatch does nothing and keeps the sheet open');
    await p.tap('#iv-next');await settle(p,400);v=await look();
    ok(await p.evaluate(()=>editing==='b')&&v&&v.photo&&!v.tex,'an item without a close-up keeps the plain pair');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
