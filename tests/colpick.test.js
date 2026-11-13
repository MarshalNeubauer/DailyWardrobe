// The colour fields of the item sheet and the Add card are a chip and a name; a tap opens a sheet with the item's close-up (or photo)
// beside a large chip of the colour being looked at, the nearest measured colours first, then every allowed colour by family.
// A tap on a chip only previews it; "Use …" saves it.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:375,height:812}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(ph=>{items=[{id:'s1',type:'suit',primaryColor:'black',pattern:'solid',photo:ph,texture:ph,added:1,meas:{src:'closeup',lab:labOf('deeptaupe'),ref:false}}];flt='all';editing='s1';show('wardrobe')},PH);
    const a=await p.evaluate(()=>{const b=document.querySelector('#item-view .colbtn[data-k="primaryColor"]');return {txt:b&&b.textContent,chip:b&&b.querySelector('.colchip').style.background,sel:!!document.querySelector('#item-view select[onchange*="primaryColor"]')}});
    ok(a.txt==='Black'&&/22, 26|#16161a/i.test(a.chip)&&!a.sel,`the editor's colour is a chip and a name, not a dropdown (${a.txt}, ${a.chip})`);
    await p.click('#item-view .colbtn[data-k="primaryColor"]');
    const b=await p.evaluate(()=>{const s=document.querySelector('#col-sheet');return {on:s.classList.contains('on'),img:!!s.querySelector('.cpph img'),big:s.querySelector('.cpbig figcaption').textContent,
      near:[...s.querySelectorAll('.cpnear .cpnm')].map(e=>e.textContent),heads:[...s.querySelectorAll('.cph')].map(e=>e.textContent),now:s.querySelector('.cpnow')&&s.querySelector('.cpnow').closest('.cptile').textContent,
      seg:s.querySelectorAll('.cpseg button').length,bar:s.querySelector('.cpbar button').textContent}});
    ok(b.on&&b.img&&b.big==='Black'&&b.seg===2,'the sheet shows the close-up beside the current colour, with a switch to the whole photo');
    ok(b.near[0]==='Deep taupe'&&/Closest to your close-up/.test(b.heads[0])&&b.heads.includes('Blues'),`the measured nearest colours come first, then the families (${b.near}; ${b.heads})`);
    ok(/^Now/.test(b.now)&&b.bar==='Keep Black','the current colour is marked, and the button keeps it');
    await p.click('#col-sheet .cpnear .cptile >> nth=0');
    const c=await p.evaluate(()=>({big:document.querySelector('#col-sheet .cpbig figcaption').textContent,bar:document.querySelector('#col-sheet .cpbar button').textContent,saved:items[0].primaryColor}));
    ok(c.big==='Deep taupe'&&c.bar==='Use Deep taupe'&&c.saved==='black','a tap previews the colour beside the photo without saving it');
    await p.click('#col-sheet .cpbar button');await p.waitForTimeout(200);
    const d=await p.evaluate(()=>({saved:items.find(x=>x.id==='s1').primaryColor,open:document.querySelector('#col-sheet').classList.contains('on'),btn:document.querySelector('#item-view .colbtn[data-k="primaryColor"]').textContent}));
    ok(d.saved==='deeptaupe'&&!d.open&&d.btn==='Deep taupe','"Use" saves it, closes the sheet and the field shows the new colour');
    await p.click('#item-view .colbtn[data-k="secondaryColor"]');await p.keyboard.press('Escape');
    ok(await p.evaluate(()=>!document.querySelector('#col-sheet').classList.contains('on')&&!!document.querySelector('#item-view.on')),'Escape closes the colour sheet and leaves the item open');
    // Add card: the second colour offers None
    await p.evaluate(ph=>{editing=null;closeItem&&closeItem();queue.length=0;queue.push({id:'q1',type:'tie',primaryColor:'navy',secondaryColor:'red',tertiaryColor:null,pattern:'solid',photo:ph,manual:true});show('add')},PH);
    await p.click('#queue .colbtn[data-k="secondaryColor"]');await p.click('#col-sheet .cptile:has-text("None")');await p.click('#col-sheet .cpbar button');
    ok(await p.evaluate(()=>queue[0].secondaryColor===null&&document.querySelector('#queue .colbtn[data-k="secondaryColor"]').textContent==='None'),'on the Add card a second colour can be set back to None');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
