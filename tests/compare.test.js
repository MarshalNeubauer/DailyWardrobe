// Wardrobe item sheet: with a fabric close-up, the split swatch (drawing | close-up) is a button. Tapped, the two split up: the
// drawing slides over the photo's square on the left and the close-up fills its own square on the right, to compare them
// whole. A tap on either square puts them back. The choice lasts while the item stays open (an edit redraws it still split up).
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(ph=>{items=[{id:'a',type:'blazer',primaryColor:'tan',secondaryColor:'lightblue',pattern:'windowpane',photo:ph,texture:ph,added:3},
      {id:'b',type:'pants',primaryColor:'navy',pattern:'solid',photo:ph,added:2},{id:'c',type:'tie',primaryColor:'navy',pattern:'solid',photo:ph,texture:ph,added:1}];flt='all';editing=null;show('wardrobe')},PH);
    const look=()=>p.evaluate(()=>{const q=s=>document.querySelector(s),r=s=>{const b=q(s).getBoundingClientRect();return [b.left,b.top,b.width,b.height].map(Math.round).join()},pair=q('#ivpair');if(!pair)return null;
      const cs=getComputedStyle(q('#ivpair .cmpdraw'));
      return {cmp:pair.classList.contains('cmp'),pressed:q('#ivpair .tagsw').getAttribute('aria-pressed'),draw:r('#ivpair .cmpdraw'),photo:r('#ivpair .phfig img.ph'),sw:r('#ivpair .tagsw .ph.thumb'),tex:r('#ivpair .swtex'),
        vis:cs.visibility,dclip:cs.clipPath,tclip:getComputedStyle(q('#ivpair .swtex')).clipPath,line:getComputedStyle(q('#ivpair .swsplit'),'::after').opacity,
        caps:[...pair.querySelectorAll('figcaption')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.innerText.trim().split('\n')[0]).join('|'),svg:!!q('#ivpair .cmpdraw svg pattern')}});
    await p.tap('#gi-a .giopen');await settle(p,500);
    let v=await look();
    ok(v&&!v.cmp&&v.vis==='hidden'&&v.tclip==='inset(0px 0px 0px 50%)'&&v.caps==='Photo|As tagged · Close-up',`opened, the photo is on the left and the swatch on the right is split: drawing | close-up (${v&&v.caps})`);
    ok(v.sw===v.tex&&v.draw!==v.photo,'the hidden copy of the drawing lies on the swatch, not on the photo');
    // tap the split swatch: they split up
    await p.tap('#ivpair .tagsw');const moving=await p.evaluate(()=>document.querySelector('#ivpair .cmpdraw').getAnimations().length);await settle(p,600);v=await look();
    ok(v.cmp&&v.pressed==='true'&&v.vis==='visible'&&v.draw===v.photo&&v.svg,`a tap splits them up: the drawing covers the photo's square on the left (${v.draw})`);
    ok(/^inset\(0px/.test(v.tclip)&&!/50%/.test(v.tclip)&&v.tex===v.sw&&v.line==='0','the close-up fills the whole square on the right; the dividing line is gone');
    ok(v.caps==='As tagged|Close-up',`the captions follow (${v.caps})`);
    ok(moving>0,`the drawing slides across instead of jumping (${moving} transitions)`);
    // an edit redraws the sheet still split up
    await p.selectOption('#item-view select >> nth=1','navy');await p.waitForFunction(()=>items.find(i=>i.id==='a').primaryColor==='navy');v=await look();
    ok(v.cmp&&v.draw===v.photo&&await p.evaluate(()=>document.querySelector('#ivpair .cmpdraw').innerHTML.toLowerCase().includes(COLORS.navy)),'changing the colour keeps them split up, the drawing redrawn in the new colour');
    // tap again (either square) puts them back
    await p.tap('#ivpair .phfig');await settle(p,600);v=await look();
    ok(!v.cmp&&v.pressed==='false'&&v.vis==='hidden'&&v.tclip==='inset(0px 0px 0px 50%)'&&v.line==='1'&&v.caps==='Photo|As tagged · Close-up','a tap on the left square puts them back: photo on the left, the split swatch on the right');
    await p.tap('#ivpair .phfig');await settle(p,300);ok(!(await look()).cmp,'a tap on the photo does not split them (only the swatch does)');
    await p.tap('#ivpair .tagsw');await settle(p,600);await p.tap('#ivpair .tagsw');await settle(p,600);ok(!(await look()).cmp,'a second tap on the right square puts them back too');
    ok(await p.evaluate(()=>editing==='a'),'none of these taps closes the sheet');
    // an item without a close-up has nothing to compare; another item starts closed
    await p.tap('#ivpair .tagsw');await settle(p,600);
    await p.tap('#iv-next');await settle(p,400);
    ok(await p.evaluate(()=>editing==='b'&&!document.querySelector('#ivpair')&&!!document.querySelector('#item-view .pair .tagsw')),'an item without a close-up keeps the plain pair, with nothing to tap');
    await p.tap('#iv-next');await settle(p,400);v=await look();
    ok(await p.evaluate(()=>editing==='c')&&v&&!v.cmp,'the next item with a close-up starts with them together');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
