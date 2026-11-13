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
    // Ask Claude: the close-up, the photo and the close-up's measurement go to the tagger; its pick is selected, its colours can all be taken
    const asked=[];
    await p.route('**/fakeworker/**',async r=>{const b=r.request().postDataJSON();asked.push(b);await new Promise(z=>setTimeout(z,300));
      await r.fulfill({json:{model:'m',response:JSON.stringify({type:'tie',primaryColor:'burgundy',secondaryColor:'navy',tertiaryColor:'none',pattern:'solid',confidence:{type:'high',primaryColor:'medium',pattern:'high'},altColor:'wine',altPattern:'none',newColor:null,newPattern:null})}})});
    await p.evaluate(()=>{localStorage.setItem('worker_url',location.origin+'/fakeworker/');localStorage.setItem('app_token','t')});
    await p.evaluate(ph=>{queue.length=0;show('wardrobe');items=[{id:'t1',type:'tie',primaryColor:'red',secondaryColor:null,pattern:'solid',photo:ph,texture:ph,added:3}];editing='t1';renderWardrobe()},PH);
    await p.click('#item-view .colbtn[data-k="primaryColor"]');
    ok(await p.evaluate(()=>/About \d+¢/.test(document.querySelector('#col-sheet .cpask').textContent)),'with a close-up the sheet offers to ask Claude, with the cost');
    await p.click('#col-sheet .cpaskbtn');
    ok(await p.evaluate(()=>/looking at the close-up/.test(document.querySelector('#col-sheet .cpask').textContent)),'it says Claude is looking while it waits');
    await p.waitForFunction(()=>/reads it as/.test(document.querySelector('#col-sheet .cpask').textContent));
    const e=await p.evaluate(()=>({txt:document.querySelector('#col-sheet .cpask').textContent,ai:[...document.querySelectorAll('#col-sheet .cpai .cptile')].map(b=>b.dataset.c),sel:colPick.sel,big:document.querySelector('#col-sheet .cpbig figcaption').textContent,all:!!document.querySelector('#col-sheet .cpask .cpaskbtn:not(.ghost)'),cur:items[0].primaryColor}));
    ok(asked.length===1&&!!asked[0].closeup&&!!asked[0].measured&&asked[0].measured.src==='closeup','the request carries the close-up and its measurement');
    ok(/Burgundy and Navy/.test(e.txt)&&/Medium confidence/.test(e.txt)&&e.ai.join()==='burgundy,wine'&&e.sel==='burgundy'&&e.big==='Burgundy',`Claude's pick and runner-up are shown, its pick beside the close-up (${e.txt})`);
    ok(e.all&&e.cur==='red','nothing is saved until asked; "Use all" is offered since the second colour differs');
    await p.click('#col-sheet .cpask .cpaskbtn:not(.ghost)');await p.waitForTimeout(200);
    ok(await p.evaluate(()=>items[0].primaryColor==='burgundy'&&items[0].secondaryColor==='navy'&&!document.querySelector('#col-sheet').classList.contains('on')),'"Use all of Claude’s colours" saves both');
    await p.click('#item-view .colbtn[data-k="secondaryColor"]');
    ok(await p.evaluate(()=>/reads it as/.test(document.querySelector('#col-sheet .cpask').textContent)&&colPick.sel==='navy')&&asked.length===1,'the second colour shows the same answer without asking again');
    await p.keyboard.press('Escape');
    await p.evaluate(()=>{items.push({id:'t2',type:'tie',primaryColor:'red',pattern:'solid',photo:'x',added:4});editing='t2';renderWardrobe()});
    await p.click('#item-view .colbtn[data-k="primaryColor"]');
    ok(await p.evaluate(()=>/Add a close-up/.test(document.querySelector('#col-sheet .cpask').textContent)&&!document.querySelector('#col-sheet .cpaskbtn')),'without a close-up it says to add one first');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
