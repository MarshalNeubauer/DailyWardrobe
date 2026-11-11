// An item's photo is shown beside the colour and texture it is tagged with (Wardrobe item opened, Add cards), and the
// drawn swatch follows every change to the colour or pattern, so the tag can be checked against the photo.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(ph=>{items=[{id:'p1',type:'pants',primaryColor:'darkgrey',pattern:'nailhead',photo:ph,added:1},{id:'p2',type:'pants',primaryColor:'navy',pattern:'solid',added:2}];flt='all';editing=null;show('wardrobe')},PH);
    ok(await p.evaluate(()=>!document.querySelector('#wardrobe .pair')&&!document.querySelector('#item-view.on')),'closed items show just the photo');
    await p.evaluate(()=>{editing='p1';renderWardrobe()});
    const a=await p.evaluate(()=>{const f=document.querySelector('#tagsw-p1');return {pair:!!document.querySelector('#item-view .pair img.ph'),svg:!!(f&&f.querySelector('svg pattern')),cap:f&&f.textContent,html:f&&f.innerHTML}});
    ok(a.pair&&a.svg&&/As tagged\s*dark grey nailhead/i.test(a.cap),`an opened item shows its photo and the tagged swatch side by side (${a.cap})`);
    const hex=await p.evaluate(()=>[COLORS.darkgrey,COLORS.khaki]);
    ok(a.html.toLowerCase().includes(hex[0]),'the swatch is drawn in the tagged colour');
    const sz=await p.evaluate(()=>{const im=document.querySelector('#item-view .pair img.ph').getBoundingClientRect(),th=document.querySelector('#tagsw-p1 .ph.thumb').getBoundingClientRect(),r=document.querySelector('#tagsw-p1 svg > rect');
      return {w:[Math.round(im.width),Math.round(th.width)],h:[Math.round(im.height),Math.round(th.height)],full:!!r&&r.getAttribute('width')==='100'&&r.getAttribute('height')==='100'&&!r.getAttribute('x')&&!document.querySelector('#tagsw-p1 svg [stroke]')}});
    ok(sz.w[0]===sz.w[1]&&sz.h[0]===sz.h[1]&&sz.full,`the swatch fills a block the same size as the photo, edge to edge with no border (${JSON.stringify(sz)})`);
    await p.selectOption('#item-view select >> nth=1','khaki');await p.waitForTimeout(150);
    const b=await p.evaluate(()=>{const f=document.querySelector('#tagsw-p1');return {cap:f.textContent,html:f.innerHTML.toLowerCase()}});
    ok(/khaki nailhead/i.test(b.cap)&&b.html.includes(hex[1])&&!b.html.includes(hex[0]),'picking khaki redraws the swatch in khaki nailhead');
    const before=await p.evaluate(()=>document.querySelector('#tagsw-p1 svg').innerHTML);
    await p.selectOption('#item-view select >> nth=4','glen-check');await p.waitForTimeout(150);
    ok(await p.evaluate(b=>{const f=document.querySelector('#tagsw-p1');return /glen check/i.test(f.textContent)&&f.querySelector('svg').innerHTML!==b},before),'changing the pattern changes the texture');
    ok(await p.evaluate(()=>{editing='p2';renderWardrobe();return !document.querySelector('#item-view .pair')&&!!document.querySelector('#item-view .ivdraw .thumb')}),'an item without a photo keeps its single drawing');
    // Add card with a photo
    await p.evaluate(ph=>{queue.length=0;queue.push({id:'q1',type:'pants',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',photo:ph});show('add')},PH);
    ok(await p.evaluate(()=>!!document.querySelector('#queue .pair img.ph')&&/As tagged\s*grey/i.test(document.querySelector('#tagsw-q0').textContent)),'an Add card shows the photo and the tagged swatch');
    await p.evaluate(()=>{const sel=[...document.querySelectorAll('#queue select')].find(s=>s.getAttribute('onchange').includes("'primaryColor'"));sel.value='khaki';sel.dispatchEvent(new Event('change'))});
    await p.evaluate(()=>{const sel=[...document.querySelectorAll('#queue select')].find(s=>s.getAttribute('onchange').includes("'pattern'"));sel.value='nailhead';sel.dispatchEvent(new Event('change'))});
    ok(await p.evaluate(h=>{const f=document.querySelector('#tagsw-q0');return /khaki nailhead/i.test(f.textContent)&&f.innerHTML.toLowerCase().includes(h)},hex[1]),'and it follows the colour and pattern picked on the card');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
