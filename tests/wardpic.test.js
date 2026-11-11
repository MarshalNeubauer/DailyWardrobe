// Wardrobe: shoes, belts and socks show their realistic product picture when there is one (fetched from the worker if this
// device does not have it yet); otherwise their photo or drawing. Other types are unchanged.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PIC='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(pic=>{items=[{id:'s',type:'shoes',primaryColor:'black',pattern:'solid',leather:'calf',added:3},{id:'b',type:'belt',primaryColor:'brown',pattern:'solid',leather:'calf',metal:'silver',added:2},
        {id:'k',type:'socks',primaryColor:'navy',pattern:'solid',added:1},{id:'t',type:'tie',primaryColor:'navy',pattern:'solid',added:4}];
      renders[itemKey(items[0])]={sig:'item',img:pic};renders[itemKey(items[1])]={sig:'item',img:pic};renderTried.add(itemKey(items[2]));
      flt='all';editing=null;show('wardrobe');const src=id=>{const im=document.querySelector(`#gi-${id} .giopen img.ph`);return im&&im.getAttribute('src')};
      const a={shoes:src('s'),belt:src('b'),socks:src('k'),tie:src('t'),sockDrawn:!!document.querySelector('#gi-k .thumb')};
      editing='s';renderWardrobe();a.open=!!document.querySelector('#item-view .pair img.ph')&&document.querySelector('#item-view .pair img.ph').getAttribute('src')===pic;closeItem();return a},PIC);
    ok(r.shoes===PIC&&r.belt===PIC,'shoes and belts with a product picture show it in the Wardrobe');
    ok(!r.socks&&r.sockDrawn,'without a picture they keep their drawing');
    ok(!r.tie,'other types are unchanged');
    ok(r.open,'opened, the product picture sits beside the tagged swatch');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
