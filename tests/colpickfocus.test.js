// The color sheet keeps the keyboard's focus when it is drawn again (2026-11-22): a press on a tile, one of the owner's own colors, a
// Shade step or an "Offer it for" chip redraws #col-sheet, and the focus fell to <body> (the redraw was not under keepFocus, app.js).
// Each control is focused and pressed with Enter, as a keyboard does, in Chromium and WebKit: the press takes effect, the markup is new,
// and the focus is on the same control in it. A color listed twice (the owner's own: under "Your colors" and in its family) keeps the
// copy that was pressed. The sheet's dropdown ("Behaves like") is not focused by code after a touch (iOS would open its list again:
// CR-1-01, tests/pickerfocus.test.js) and keeps the focus after a key press. The server is stubbed: nothing is sent or paid.
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ';
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  await ctx.route('https://w.test/**',route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1');window.__foc=[];const f=HTMLElement.prototype.focus;
    HTMLElement.prototype.focus=function(...a){window.__foc.push(this.tagName);return f.apply(this,a)}});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const own=await p.evaluate(async()=>{HOOK.CK_OPEN['*']=true;HOOK.settings.setupDone=1;HOOK.settings.custom={colors:[],patterns:[]};HOOK.applyCustom(HOOK.settings.custom);
    HOOK.items=[{id:'s1',type:'suit',primaryColor:'grey',pattern:'solid',added:1,name:'Gray suit'}];HOOK.flt='all';HOOK.editing=null;HOOK.show('wardrobe');
    const k=await HOOK.addCustomColor({name:'Test plum',hex:'#5a2a4a',base:'wine',types:HOOK.groupOf('suit'),accent:false});
    HOOK.openItem('s1');return k});
  await settle(p,400);
  /* the control is marked, focused and pressed with Enter -> was it replaced, where the focus is now, and whether that is `sel` */
  const press=async(sel,key='Enter')=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.evaluate(e=>{e.__old=1});await l.focus();
    const had=await p.evaluate(()=>!!document.activeElement.__old);await p.keyboard.press(key);await settle(p,150);
    return p.evaluate(([sel,had])=>{const a=document.activeElement,e=document.querySelector(sel);
      return {had,fresh:!!e&&!e.__old,on:!!a&&a===e,active:!a||a===document.body?'BODY':a.tagName+(a.id?'#'+a.id:'')+(a.className?'.'+a.className:'')+' '+(a.textContent||'').trim().replace(/\s+/g,' ').slice(0,30),
        pressed:a&&a.getAttribute?a.getAttribute('aria-pressed'):null}},[sel,had])};
  const kept=r=>r.had&&r.fresh&&r.on;
  let r,e;

  // ---- opening the sheet still puts the focus on its ×
  await p.evaluate(()=>{document.querySelector('#item-view .colbtn[data-k="primaryColor"]').focus();HOOK.openColPick('e','s1','primaryColor')});await settle(p,300);
  ok(await p.evaluate(()=>document.activeElement.matches('#col-sheet .pick-x')),T+'opening the color sheet puts the focus on its ×, as before');

  // ---- 1. a swatch
  r=await press('#col-sheet .cptile[data-k="fam"][data-c="navy"]');e=await p.evaluate(()=>HOOK.colPick.sel);
  ok(e==='navy'&&kept(r)&&r.pressed==='true',T+`Enter on a color's swatch shows it and the focus stays on that swatch in the new markup (${JSON.stringify(r)})`);
  r=await press('#col-sheet .cptile[data-k="fam"][data-c="charcoal"]',' ');e=await p.evaluate(()=>HOOK.colPick.sel);
  ok(e==='charcoal'&&kept(r),T+`Space on another swatch: the same (${JSON.stringify(r)})`);

  // ---- 2. one of the owner's own colors: under "Your colors", and its second copy in its family
  ok(await p.evaluate(k=>document.querySelectorAll(`#col-sheet .cptile[data-c="${k}"]`).length===2&&!!document.querySelector(`#col-sheet .cnown .cptile[data-c="${k}"]`),own),T+'the owner\'s color is listed twice: under "Your colors" and in its family');
  r=await press(`#col-sheet .cnown .cptile[data-c="${own}"]`);e=await p.evaluate(()=>HOOK.colPick.sel);
  ok(e===own&&kept(r)&&r.pressed==='true',T+`Enter on the owner's own color under "Your colors": the focus stays on it (${JSON.stringify(r)})`);
  await press('#col-sheet .cptile[data-k="fam"][data-c="navy"]');
  r=await press(`#col-sheet .cptile[data-k="fam"][data-c="${own}"]`);e=await p.evaluate(()=>HOOK.colPick.sel);
  ok(e===own&&kept(r),T+`Enter on its copy in the family list: the focus stays on that copy, not the one under "Your colors" (${JSON.stringify(r)})`);

  // ---- the views switch (a control with no id either)
  await p.evaluate(()=>{const i=HOOK.items[0];i.photo=i.texture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';HOOK.closeColPick();HOOK.openColPick('e','s1','primaryColor')});await settle(p,300);
  r=await press('#col-sheet .cpseg button[data-v="photo"]');
  ok(await p.evaluate(()=>HOOK.colPick.view==='photo')&&kept(r)&&r.pressed==='true',T+`Enter on "Whole photo": the focus stays on it (${JSON.stringify(r)})`);
  await p.evaluate(()=>{const i=HOOK.items[0];delete i.photo;delete i.texture;HOOK.closeColPick()});await settle(p,250);

  // ---- 3. the Shade steps (the Look beta)
  await p.evaluate(()=>{HOOK.lookSet(true);HOOK.openColPick('e','s1','primaryColor')});await settle(p,300);
  r=await press('#col-sheet .lkshade button[data-d="1"]');e=await p.evaluate(()=>HOOK.colPick.shade);
  ok(e===1&&kept(r),T+`Enter on "Lighter +" moves the shade a step and the focus stays on it (${JSON.stringify(r)})`);
  r=await press('#col-sheet .lkshade button[data-d="1"]');e=await p.evaluate(()=>HOOK.colPick.shade);
  ok(e===2&&kept(r),T+`again: two steps, the focus still on it (${JSON.stringify(r)})`);
  r=await press('#col-sheet .lkshade button[data-d="-1"]');e=await p.evaluate(()=>HOOK.colPick.shade);
  ok(e===1&&kept(r),T+`Enter on "− Darker" moves it back a step and the focus stays on Darker (${JSON.stringify(r)})`);
  await p.evaluate(()=>{HOOK.closeColPick();HOOK.lookSet(false)});await settle(p,250);

  // ---- 4. an "Offer it for" chip of the New color sheet, and its switch
  await p.evaluate(()=>{HOOK.openColPick('e','s1','primaryColor');document.querySelector('#cn-open').focus();HOOK.openColNew()});await settle(p,300);
  ok(await p.evaluate(()=>document.activeElement.matches('#col-sheet .cnback')),T+'opening New color puts the focus on its ‹, as before');
  await p.fill('#cn-name','Dusk');   // ("How the app uses it" shows once there is a name)
  const chip=await p.evaluate(()=>document.querySelector('#col-sheet .cnchip').dataset.t),CH=`#col-sheet .cnchip[data-t="${chip}"]`;
  r=await press(CH);e=await p.evaluate(()=>HOOK.colPick.newc.types.join());
  ok(!e.split(',').includes(chip)&&kept(r)&&r.pressed==='false',T+`Enter on an "Offer it for" chip takes the kind out and the focus stays on the chip (${JSON.stringify(r)})`);
  r=await press(CH);e=await p.evaluate(()=>HOOK.colPick.newc.types.join());
  ok(e.split(',').includes(chip)&&kept(r)&&r.pressed==='true',T+`Enter again puts it back, the focus still on the chip (${JSON.stringify(r)})`);
  r=await press('#cn-accent');
  ok(await p.evaluate(()=>HOOK.colPick.newc.accent===true)&&kept(r),T+`the "Also for stripes and motifs" switch keeps the focus too (${JSON.stringify(r)})`);

  // ---- the sheet's dropdown: not focused by code after a touch (iOS opens a focused dropdown's list), kept after a key press
  const pick=async via=>{const l=p.locator('#cn-base');await l.scrollIntoViewIfNeeded();
    if(via==='touch')await l.tap();else{await l.focus();await p.keyboard.press('Shift')}
    await l.focus();const v=await l.evaluate(s=>[...s.options].map(o=>o.value).find(x=>x!==s.value));await p.evaluate(()=>{window.__foc=[]});
    await l.selectOption(v);await p.waitForTimeout(400);
    return p.evaluate(v=>({opened:window.__foc.filter(t=>t==='SELECT').length,took:HOOK.colPick.newc.base===v&&document.querySelector('#cn-base').value===v,has:document.activeElement===document.querySelector('#cn-base'),
      active:document.activeElement===document.body?'BODY':document.activeElement.tagName}),v)};
  r=await pick('touch');
  ok(r.took&&r.opened===0&&!r.has,T+`"Behaves like" picked after a tap: the choice is taken and no dropdown is focused by code (${JSON.stringify(r)})`);
  r=await pick('key');
  ok(r.took&&r.has,T+`"Behaves like" picked after a key press: the new dropdown keeps the focus (${JSON.stringify(r)})`);

  // ---- a text field with the focus is left as before: a redraw from elsewhere drops the focus to <body> and code focuses no field
  // (a phone's keyboard would come back up). The shade square pressed with the Name field focused; a redraw while the words are typed.
  await p.focus('#cn-name');
  const box=await (async()=>{await p.evaluate(()=>document.querySelector('#cn-sq').scrollIntoView({block:'center'}));await settle(p,150);return p.locator('#cn-sq').boundingBox()})();
  e=await p.evaluate(()=>{window.__foc=[];document.querySelector('#cn-name').__old=1;return document.activeElement.id+' '+HOOK.colPick.newc.hex});
  await p.mouse.click(box.x+box.width*.3,box.y+box.height*.6);await settle(p,200);
  r=await p.evaluate(()=>({foc:window.__foc.join(),active:document.activeElement===document.body?'BODY':document.activeElement.tagName+'#'+document.activeElement.id,fresh:!document.querySelector('#cn-name').__old,hex:HOOK.colPick.newc.hex,name:document.querySelector('#cn-name').value}));
  ok(/^cn-name /.test(e)&&!e.endsWith(r.hex)&&r.fresh&&r.active==='BODY'&&!/INPUT|TEXTAREA/.test(r.foc)&&r.name==='Dusk',T+`the shade square pressed while the Name field has the focus: the shade is taken, the sheet is drawn again, and no field is focused by code (${e} -> ${JSON.stringify(r)})`);
  await p.focus('#cn-text');await p.keyboard.type('plum');
  r=await p.evaluate(()=>{window.__foc=[];const was=document.activeElement.id;HOOK.renderColPick(true);
    return {was,foc:window.__foc.join(),active:document.activeElement===document.body?'BODY':document.activeElement.tagName+'#'+document.activeElement.id,text:document.querySelector('#cn-text').value}});
  ok(r.was==='cn-text'&&r.active==='BODY'&&!/INPUT|TEXTAREA/.test(r.foc)&&r.text==='plum',T+`a redraw while the words are being typed: the words stay and no field is focused by code (${JSON.stringify(r)})`);
  await p.evaluate(()=>HOOK.closeColPick());await settle(p,250);

  // ---- the pattern sheet's tiles go the same way
  await p.evaluate(()=>{document.querySelector('#item-view .patbtn').focus();HOOK.openColPick('e','s1','pattern')});await settle(p,300);
  r=await press('#col-sheet .cptile[data-k="fam"][data-c="herringbone"]');e=await p.evaluate(()=>HOOK.colPick.sel);
  ok(e==='herringbone'&&kept(r)&&r.pressed==='true',T+`Enter on a pattern's tile: the focus stays on it (${JSON.stringify(r)})`);
  // closing still gives the focus back to the field's button
  await p.keyboard.press('Escape');await settle(p,300);
  ok(await p.evaluate(()=>!document.querySelector('#col-sheet.on')&&!!document.activeElement&&document.activeElement.matches('#item-view .colbtn')),T+'Escape closes the sheet and the focus goes back to the item sheet\'s button');
  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.join(' | '):''));
  await ctx.close()}
