// Wardrobe: tapping an item (photo or name) opens its editor; Edit still works; Close folds it back.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(ph=>{items=[{id:'a',type:'shirt',primaryColor:'white',pattern:'solid',photo:ph,added:2},{id:'b',type:'tie',primaryColor:'navy',pattern:'solid',added:1}];flt='all';editing=null;show('wardrobe')},PH);
    await p.click('#gi-a .giopen img');
    ok(await p.evaluate(()=>editing==='a'&&!!document.querySelector('#gi-a .phtools')&&!!document.querySelector('#gi-a .pair')),'tapping an item\'s photo opens its editor');
    ok(await p.evaluate(()=>!document.querySelector('#gi-a .giopen')),'while open, the photo is not a tap target (so cropping and tools work)');
    await p.click('#gi-b .giopen b');
    ok(await p.evaluate(()=>editing==='b'&&!!document.querySelector('#gi-b select')),'tapping another item\'s name opens that one instead');
    await p.click('#gi-b .btns >> text=Close');
    ok(await p.evaluate(()=>editing===null&&!!document.querySelector('#gi-b .giopen')),'Close folds it back');
    await p.click('#gi-a .btns >> text=Edit');
    ok(await p.evaluate(()=>editing==='a'),'the Edit button still works');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
