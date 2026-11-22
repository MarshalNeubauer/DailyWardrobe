// CR-1-01 (the owner's bug, 2026-11-16): on Add without a photo and in the item sheet, every dropdown opened its picker again right after
// a choice: the redraw's keepFocus (app.js) focused the new <select>, and iOS opens a select's picker (or a date field's wheel) when it is
// focused. Picked from the real controls, as a person does: a tap, then the choice in the dropdown or the date field. After a tap no
// select or date field is focused by code and the focus is on the section's head button; after a key press (a keyboard) the new control
// keeps the focus, as fix round 3 (W2-19-01) wanted. Also CR-1-07: the item sheet's Arrives refuses a day gone, as the Add card does.
// Chromium and WebKit (Safari's engine), with touch; the worker stubbed (nothing paid).
module.exports=async({ok,chromium,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  await ctx.route('https://w.test/**',route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1');window.__foc=[];const f=HTMLElement.prototype.focus;
    HTMLElement.prototype.focus=function(...a){window.__foc.push(this.tagName+(this.getAttribute('type')?':'+this.getAttribute('type'):''));return f.apply(this,a)}});   // (the type written: WebKit's Linux build has no date field and says 'text')
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{CK_OPEN['*']=true;let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('tie','green',{paused:true,order:true,arrives:'2099-01-10'})];
    settings.setupDone=1;cache={};queue.length=0;show('wardrobe');openAdd()});
  await settle(p,400);
  const T=eng+': ';
  const act=()=>p.evaluate(()=>{const a=document.activeElement;return !a||a===document.body?'BODY':a.tagName+(a.className?'.'+a.className:'')+' '+(a.getAttribute('aria-label')||a.textContent||'').trim().replace(/\s+/g,' ').slice(0,40)});
  /* a tap on the control (or a key press on it), then the choice made in it; -> what code focused and where the focus is */
  const pick=async(sel,val,via)=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();
    if(via==='touch')await l.tap();else{await l.focus();await p.keyboard.press('Shift')}
    await l.focus();await p.evaluate(()=>{window.__foc=[]});
    if(await l.evaluate(e=>e.tagName==='SELECT'))await l.selectOption(val);
    else{const h=await l.elementHandle();await h.fill(val);   // (WebKit's Linux date field says `change` only when left; the phone's wheel says it at once)
      if(await h.evaluate(e=>e.isConnected))await h.evaluate(e=>e.dispatchEvent(new Event('change',{bubbles:true})))}
    await p.waitForTimeout(500);   // (to see that no focus comes)
    return {opened:await p.evaluate(()=>window.__foc.filter(t=>/^SELECT|^INPUT:date/.test(t)).length),active:await act(),
      now:await p.evaluate(s=>{const e=document.querySelector(s);return e?{tag:e.tagName,v:e.value,has:e===document.activeElement}:null},sel)}};
  const check=async(what,sel,val,via)=>{const r=await pick(sel,val,via);
    if(via==='touch')ok(r.opened===0&&/^BUTTON\.ckh/.test(r.active)&&r.now&&r.now.v===val,`${T}${what}, picked after a tap: no picker opened again by code, the focus is on its section's head (${JSON.stringify(r)})`);
    else ok(r.opened>0&&r.now&&r.now.has&&r.now.v===val,`${T}${what}, picked after a key press: the new control keeps the focus (${JSON.stringify(r)})`);
    return r};

  // Add without a photo: Type, Material, and the Arrives date of "Bought, on the way"
  await p.locator('#add-manual').tap();await settle(p,500);
  const ts='#nps-q section[data-ck="type"] select';
  await check('Add without a photo, Type → T-shirt',ts,'tee','touch');
  await check('Add without a photo, Type → Polo',ts,'polo','key');
  await check('Add without a photo, Type → Suit',ts,'suit','touch');
  ok(await p.evaluate(()=>queue[0]&&queue[0].type==='suit'),`${T}the card took the type picked`);
  const ms='#nps-q select.wmat';
  const mat=await p.evaluate(s=>{const e=document.querySelector(s);return e?[...e.options].map(o=>o.value).filter(v=>v&&v!==e.value&&v!=='other'):[]},ms);
  ok(mat.length>=2,`${T}the card has a Material dropdown (${mat.join(', ')})`);
  if(mat.length>=2){await check('Add without a photo, Material',ms,mat[0],'touch');await check('Add without a photo, Material by keyboard',ms,mat[1],'key')}
  await p.locator('#nps-q .ordrow .rotbtn').tap();await settle(p,300);
  const ds='#nps-q .ordrow input[type="date"]';
  await check('Add without a photo, Arrives',ds,'2099-01-15','touch');
  await check('Add without a photo, Arrives by keyboard',ds,'2099-01-20','key');
  ok(await p.evaluate(()=>queue[0].arrives==='2099-01-20'),`${T}the card took the Arrives date`);
  await p.evaluate(()=>{npsClose();queue.length=0;show('wardrobe')});await settle(p,400);

  // the item sheet: Type, Material, and the Arrives date of a piece on the way
  await p.evaluate(()=>openItem('suit0'));await settle(p,500);
  const it='#ivbody select[data-act-change="itemPick"][data-id="suit0"][data-f="type"]';
  await check('the item sheet, Type → Blazer',it,'blazer','touch');
  await check('the item sheet, Type → Suit by keyboard',it,'suit','key');
  const im='#ivbody select.wmat';
  const imat=await p.evaluate(s=>{const e=document.querySelector(s);return e?[...e.options].map(o=>o.value).filter(v=>v&&v!==e.value&&v!=='other'):[]},im);
  ok(imat.length>=2,`${T}the item sheet has a Material dropdown (${imat.join(', ')})`);
  if(imat.length>=2){await check('the item sheet, Material',im,imat[0],'touch');await check('the item sheet, Material by keyboard',im,imat[1],'key')}
  await p.evaluate(()=>{closeItem();openItem('tie4')});await settle(p,500);
  const id='#ivbody .ordrow input[type="date"]';
  await check('the item sheet, Arrives',id,'2099-02-01','touch');
  await check('the item sheet, Arrives by keyboard',id,'2099-02-03','key');
  ok(await p.evaluate(()=>items.find(i=>i.id==='tie4').arrives==='2099-02-03'),`${T}the piece took the Arrives date`);

  // CR-1-07: the item sheet's Arrives refuses a day gone (it put the piece in rotation at once), as the Add card does
  ok(await p.evaluate(()=>{const e=document.querySelector('#ivbody .ordrow input[type="date"]');return !!e&&e.min===isoKey(todayDate())}),`${T}the item sheet's Arrives field starts at today`);
  {const h=await p.locator(id).elementHandle();await h.fill('2020-01-01');if(await h.evaluate(e=>e.isConnected))await h.evaluate(e=>e.dispatchEvent(new Event('change',{bubbles:true})));await settle(p,400)}
  const past=await p.evaluate(()=>{const i=items.find(x=>x.id==='tie4');return {arrives:i.arrives,paused:!!i.paused,toast:document.querySelector('#toast').textContent}});
  ok(past.arrives==='2099-02-03'&&past.paused&&/That day has passed/.test(past.toast),`${T}a past Arrives date is refused and the piece stays on the way (${JSON.stringify(past)})`);
  ok(!errs.length,`${T}no page errors (${errs.join(' | ')})`);
  await ctx.close();
}
