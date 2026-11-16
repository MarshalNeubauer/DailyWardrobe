// The close-up chooser (ui.js closeupBtn/closeupPick; closeup-chooser-mockups variant A, 2026-11-15) and the white-paper hint as
// "True color in 3 steps" (itemsheet.js paperSteps; paper-hint-proposals A), on a touch screen in Chromium and WebKit:
// every close-up button (the Add card's Add / Replace close-up, the editor's Add fabric close-up / Replace close-up, the editor's
// Retake close-up under the photos, the New color sheet's Retake close-up) opens the sheet with its title; Take close-up has
// capture="environment", Choose from photos none; a file chosen in either reaches the button's own handler; Cancel, a tap outside
// (not the first 0.45 s) and Escape close it with nothing changed; Remove close-up is in the sheet (and no longer a button of its own),
// with Undo; without a touch screen the buttons stay the direct file window and Remove stays a button. The 3-step card shows in the
// editor and on the Add card in both themes at 390 px and opens the tip. The close-ups are the mink suit's test pictures
// (tests/fixtures/suit-mink*), plain or with a band of white paper drawn on. Nothing goes to the server (it is stubbed).
const {wrapBrowser}=require('./webkit');
module.exports=async({ok,chromium,url,settle})=>{
  const engines=[['Chromium',()=>chromium.launch()],['WebKit',async()=>{const pw=require('playwright');return wrapBrowser(await pw.webkit.launch())}]];
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const open=async touch=>{const ctx=await browser.newContext({viewport:{width:390,height:844},...(touch?{hasTouch:true,isMobile:eng==='Chromium'}:{})});
    await ctx.route('https://w.test/**',route=>{const q=route.request();
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
      return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
    await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    const F=await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
      const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
      const cv=(im,k,f)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);if(f)f(c,x);return c};
      const paper=(c,x)=>{x.fillStyle='#f4f3ef';x.fillRect(0,c.height*.8,c.width,c.height*.2)};
      const J=c=>c.toDataURL('image/jpeg',.9),f={plain:J(cv(ci,3)),paper:J(cv(ci,3,paper)),photo:J(cv(pi,1))};
      rememberRole({role:'owner'});
      items=[{id:'m1',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:f.photo,texture:f.plain,added:1,name:'Mink suit'},
        {id:'m2',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:f.photo,added:2,name:'Bare suit'}];flt='all';editing=null;show('wardrobe');return f});
    return {ctx,p,errs,F}};
  const file=(name,u)=>({name,mimeType:'image/jpeg',buffer:Buffer.from(u.split(',')[1],'base64')});
  const T=eng+': ';
  // ================= touch screen =================
  {const {ctx,p,errs,F}=await open(true);
    ok(await p.evaluate(()=>cuTouch()),T+'the touch context reads as a touch screen (pointer: coarse)');
    const sheet=()=>p.evaluate(()=>{const s=document.querySelector('#cu-sheet'),on=!!(s&&s.classList.contains('on'));if(!on)return {on};
      const take=s.querySelector('#cu-take'),lib=s.querySelector('#cu-lib'),rm=s.querySelector('#cu-rm'),cancel=s.querySelector('#cu-cancel'),ae=document.activeElement;
      const h=x=>x?Math.round(x.getBoundingClientRect().height):0;
      return {on,title:s.querySelector('#cu-title').textContent,sub:s.querySelector('#cu-sub').textContent,tip:(s.querySelector('.cu-tip')||{}).textContent||'',
        takeLabel:take.closest('label').textContent.trim(),cap:take.getAttribute('capture'),libLabel:lib.closest('label').textContent.trim(),libCap:lib.hasAttribute('capture'),
        accept:take.accept+'|'+lib.accept,rm:rm?rm.textContent:'',cancel:cancel.textContent,role:s.getAttribute('role'),modal:s.getAttribute('aria-modal'),
        labelled:s.getAttribute('aria-labelledby'),focusIn:s.contains(ae),pic:!!s.querySelector('.wbpic.cu-pic'),
        hTake:h(take.closest('label')),hLib:h(lib.closest('label')),hRm:h(rm),hCancel:h(cancel),fit:s.getBoundingClientRect().right<=390}});
    const tex=id=>p.evaluate(id=>{const it=items.find(x=>x.id===id);return it&&it.texture?texSig(it.texture):null},id);
    // the editor's tool row (Edit photos option B): the Close-up button reads "Close-up", named "Replace close-up" / "Add fabric close-up"
    const btn=async text=>{const h=await p.evaluateHandle(t=>[...document.querySelectorAll('#item-view .phtools button,#item-view .phtools label,#toast button')].find(x=>(x.getAttribute('aria-label')||x.textContent.trim())===t)||null,text);return h.asElement()};
    const closed=async()=>{await p.waitForFunction(()=>!document.querySelector('#cu-sheet.on'));await settle(p,320)};
    // ---- the editor, an item with a close-up
    await p.evaluate(()=>openItem('m1'));await settle(p,400);
    let e=await p.evaluate(()=>{const t=[...document.querySelectorAll('#item-view .phtools > *')].map(x=>x.tagName+':'+(x.getAttribute('aria-label')||x.textContent.trim()));return {t,file:!!document.querySelector('#item-view .phtools .vfile[onchange*=replaceTexture]'),rm:!!document.querySelector('#item-view .ptmore,#item-view .ptrm')}});
    ok(e.t.includes('BUTTON:Replace close-up')&&!e.t.some(x=>/Remove close-up/.test(x))&&!e.file&&!e.rm,T+`the editor's close-up button is a plain button and there is no separate Remove close-up (${e.t.join(', ')})`);
    const t0=await tex('m1');
    await (await btn('Replace close-up')).click();await p.waitForSelector('#cu-sheet.on');let s=await sheet();
    ok(s.title==='Replace close-up'&&s.sub==='The new close-up takes the place of the one you have.'&&s.tip==='Lay white paper along one edge, then tap the paper on screen.'&&s.takeLabel==='Take close-up'&&s.libLabel==='Choose from photos'&&s.rm==='Remove close-up'&&s.cancel==='Cancel'&&s.pic,
      T+`"Replace close-up" opens the sheet: its title and line, the drawing, Take close-up, the paper line, Choose from photos, Remove close-up, Cancel (${JSON.stringify(s)})`);
    ok(s.cap==='environment'&&!s.libCap&&s.accept==='image/*|image/*',T+'Take close-up has capture="environment"; Choose from photos has no capture');
    ok(s.role==='dialog'&&s.modal==='true'&&s.labelled==='cu-title'&&s.focusIn&&s.fit,T+'the sheet is a modal dialog named by its title, the focus inside it, within 390 px');
    ok(s.hTake>=44&&s.hLib>=44&&s.hRm>=44&&s.hCancel>=44,T+`its buttons are 44 px or taller (${s.hTake}/${s.hLib}/${s.hRm}/${s.hCancel})`);
    ok(await p.evaluate(()=>!!document.querySelector('#item-view').inert||!!document.querySelector('main').inert),T+'the page under it is inert while it is up');
    await p.click('#cu-cancel');await closed();
    ok(await tex('m1')===t0&&await p.evaluate(()=>editing==='m1'&&!!document.querySelector('#item-view.on')),T+'Cancel closes it; the close-up and the item sheet are as they were');
    // a tap outside: ignored in the first moment (a double tap's second tap), then it closes
    await (await btn('Replace close-up')).click();await p.waitForSelector('#cu-sheet.on');
    await p.mouse.click(195,80);await settle(p,60);const early=(await sheet()).on;await p.waitForTimeout(500);await p.mouse.click(195,80);await closed();
    ok(early&&await tex('m1')===t0&&await p.evaluate(()=>!!document.querySelector('#item-view.on')),T+'a tap outside closes it with nothing changed (one in the first 0.45 s is ignored)');
    await (await btn('Replace close-up')).click();await p.waitForSelector('#cu-sheet.on');await p.keyboard.press('Escape');await closed();
    ok(await tex('m1')===t0&&await p.evaluate(()=>!!document.querySelector('#item-view.on')&&editing==='m1'),T+'Escape closes only the sheet; the item sheet stays');
    // Choose from photos -> replaceTexture; then the paper line
    const waitTex=(id,not)=>p.waitForFunction(([id,not])=>{const it=items.find(x=>x.id===id);return it&&it.texture&&texSig(it.texture)!==not},[id,not]);
    await (await btn('Replace close-up')).click();await p.waitForSelector('#cu-sheet.on');
    await (await p.$('#cu-lib')).setInputFiles(file('paper.jpg',F.paper));await waitTex('m1',t0);await p.waitForSelector('#ivwb');
    e=await p.evaluate(()=>({on:!!document.querySelector('#cu-sheet.on'),line:document.querySelector('#ivwb').textContent}));
    ok(!e.on&&/White paper found/.test(e.line),T+`a photo chosen through "Choose from photos" replaces the close-up, the sheet closes, and the paper line follows (${e.line})`);
    const t1=await tex('m1');
    await (await btn('Replace close-up')).click();await p.waitForSelector('#cu-sheet.on');
    await (await p.$('#cu-take')).setInputFiles(file('plain.jpg',F.plain));await waitTex('m1',t1);
    await p.waitForFunction(()=>/No white paper/.test((document.querySelector('#ivwb')||{}).textContent||''));
    e=await p.evaluate(()=>{const r=document.querySelector('#ivwb .wbretake');return {tag:r&&r.tagName,t:r&&r.textContent,file:!!document.querySelector('#ivwb input[type=file]'),h:r&&r.getBoundingClientRect().height}});
    ok(e.tag==='BUTTON'&&e.t==='Retake close-up'&&!e.file,T+'a photo taken through "Take close-up" replaces it too; "No white paper" offers Retake close-up as a button');
    // Retake close-up under the photos
    const t2=await tex('m1');
    await p.click('#ivwb .wbretake');await p.waitForSelector('#cu-sheet.on');s=await sheet();
    ok(s.title==='Retake close-up'&&s.sub==='Lay white paper along one edge this time, so the colors come out true.'&&!s.rm&&!s.tip&&s.cap==='environment',T+`Retake close-up opens the sheet titled "Retake close-up", without Remove (${s.title} / ${s.sub})`);
    await (await p.$('#cu-take')).setInputFiles(file('retake.jpg',F.paper));await waitTex('m1',t2);
    await p.waitForFunction(()=>/White paper found/.test((document.querySelector('#ivwb')||{}).textContent||''));
    ok(true,T+'a close-up taken from Retake replaces it and the line says "White paper found"');
    // Remove close-up from the sheet, and Undo
    const t3=await tex('m1');
    await (await btn('Replace close-up')).click();await p.waitForSelector('#cu-sheet.on');await p.click('#cu-rm');await closed();
    e=await p.evaluate(()=>({tex:!!items.find(x=>x.id==='m1').texture,toast:(document.querySelector('#toast')||{}).textContent||'',btns:[...document.querySelectorAll('#item-view .phtools > *')].map(x=>x.getAttribute('aria-label')||x.textContent.trim())}));
    ok(!e.tex&&/Close-up removed\./.test(e.toast)&&/Undo/.test(e.toast)&&e.btns.includes('Add fabric close-up'),T+`"Remove close-up" in the sheet removes it ("Close-up removed." with Undo), and the button is named Add fabric close-up (${e.btns.join(', ')})`);
    await (await btn('Undo')).click();await waitTex('m1','');
    ok(await tex('m1')===t3,T+'the toast’s Undo brings the close-up back');
    // the editor, an item without a close-up
    await p.evaluate(()=>openItem('m2'));await settle(p,400);
    await (await btn('Add fabric close-up')).click();await p.waitForSelector('#cu-sheet.on');s=await sheet();
    ok(s.title==='Fabric close-up'&&s.sub==='Hold the camera close so the weave fills the frame.'&&!s.rm,T+'"Add fabric close-up" opens the sheet titled "Fabric close-up", without Remove');
    await (await p.$('#cu-lib')).setInputFiles(file('m2.jpg',F.paper));await waitTex('m2','');
    ok(await p.evaluate(()=>!document.querySelector('#cu-sheet.on')),T+'a photo chosen there adds the close-up');
    // ---- the 3-step card in the editor, both themes
    for(const theme of ['light','dark']){await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);await settle(p,100);
      e=await p.evaluate(()=>{const c=document.querySelector('#item-view .wbstcard'),r=c&&c.getBoundingClientRect(),cs=c&&getComputedStyle(c);
        return c&&{h:Math.round(r.height),right:r.right,bg:cs.backgroundColor,ink:cs.color,text:c.textContent,fit:document.documentElement.scrollWidth<=390}});
      ok(e&&e.h>=44&&e.right<=390&&e.fit&&e.bg!==e.ink&&/True color in 3 steps/i.test(e.text),T+`${theme}: the editor shows the 3-step card (${JSON.stringify(e)})`)}
    await p.evaluate(()=>{delete document.documentElement.dataset.theme});
    await p.click('#item-view .wbstcard');await p.waitForSelector('#kitsheet.on');
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='White paper, true colors'),T+'the editor\'s card opens the white-paper tip');
    await p.click('#kitsheet .kit-x');await settle(p,200);
    // ---- the New color sheet's Retake close-up
    await p.evaluate(F=>{items.find(x=>x.id==='m1').texture=F.plain;delete items.find(x=>x.id==='m1').texSm},F);
    await p.evaluate(()=>{closeColPick();openColPick('e','m1','primaryColor')});await p.click('#cn-open');await p.waitForSelector('#cn-paper');
    await p.waitForFunction(()=>!!document.querySelector('#cn-paper .wbretake'));
    const t4=await tex('m1');
    await p.click('#cn-paper .wbretake');await p.waitForSelector('#cu-sheet.on');s=await sheet();
    ok(s.title==='Retake close-up'&&!s.rm,T+'the New color sheet\'s Retake close-up opens the sheet titled "Retake close-up"');
    await p.keyboard.press('Escape');await closed();
    ok(await p.evaluate(()=>!!colPick&&!!document.querySelector('#col-sheet.on')),T+'Escape there closes only the chooser; the color sheet stays');
    await p.click('#cn-paper .wbretake');await p.waitForSelector('#cu-sheet.on');
    await (await p.$('#cu-take')).setInputFiles(file('cn.jpg',F.paper));await waitTex('m1',t4);
    await p.waitForFunction(()=>/White paper found/.test((document.querySelector('#cn-paper')||{}).textContent||''));
    ok(true,T+'a close-up taken from it reaches cnRetake: the line turns to "White paper found"');
    await p.evaluate(()=>closeColPick());await settle(p,200);
    await p.evaluate(()=>closeItem&&closeItem());await settle(p,300);
    // ---- the Add card
    await p.evaluate(()=>{openAdd();addManual();queue[0].type='suit';queue[0].primaryColor='deeptaupe';renderAdd()});await settle(p,300);
    for(const theme of ['light','dark']){await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);await settle(p,100);
      e=await p.evaluate(()=>{const c=document.querySelector('#nps-q [data-ck="tex"] .wbstcard'),r=c&&c.getBoundingClientRect(),cs=c&&getComputedStyle(c);
        return c&&{h:Math.round(r.height),right:r.right,bg:cs.backgroundColor,ink:cs.color,text:c.textContent,old:!!document.querySelector('#nps-q .texguide,#nps-q .texpaper'),fit:document.documentElement.scrollWidth<=390}});
      ok(e&&e.h>=44&&e.right<=390&&e.fit&&!e.old&&e.bg!==e.ink&&/True color in 3 steps/i.test(e.text),T+`${theme}: the Add card's Texture match shows the 3-step card, not the old sentence and link (${JSON.stringify(e)})`)}
    await p.evaluate(()=>{delete document.documentElement.dataset.theme});
    await p.click('#nps-q .wbstcard');await p.waitForSelector('#kitsheet.on');
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='White paper, true colors'),T+'the Add card\'s card opens the white-paper tip');
    await p.click('#kitsheet .kit-x');await settle(p,200);
    e=await p.evaluate(()=>{const b=document.querySelector('#nps-q [data-ck="tex"] .cubtn');return {t:b&&b.textContent,file:!!document.querySelector('#nps-q [data-ck="tex"] input[type=file]')}});
    ok(e.t==='Add close-up'&&!e.file,T+'the Add card\'s "Add close-up" is a plain button');
    await p.click('#nps-q [data-ck="tex"] .cubtn');await p.waitForSelector('#cu-sheet.on');s=await sheet();
    ok(s.title==='Fabric close-up'&&!s.rm&&s.cap==='environment',T+'it opens the sheet titled "Fabric close-up"');
    await p.click('#cu-cancel');await closed();
    ok(await p.evaluate(()=>!queue[0].texture),T+'Cancel adds nothing');
    await p.click('#nps-q [data-ck="tex"] .cubtn');await p.waitForSelector('#cu-sheet.on');
    await (await p.$('#cu-take')).setInputFiles(file('add.jpg',F.paper));
    await p.waitForFunction(()=>queue[0]&&queue[0].texture&&!queue[0].refining&&!!document.querySelector('#nps-q [data-ck="tex"].cktexon'));await settle(p,200);
    e=await p.evaluate(()=>{const s=document.querySelector('#nps-q [data-ck="tex"].cktexon');return {btns:[...s.querySelectorAll('button,label')].map(x=>x.textContent.trim())}});
    ok(e.btns.includes('Replace close-up')&&!e.btns.includes('Remove close-up'),T+`a photo taken there reaches addTexture; the card then offers Replace close-up, with no Remove button of its own (${e.btns.join(', ')})`);
    await p.click('#nps-q [data-ck="tex"].cktexon .cubtn');await p.waitForSelector('#cu-sheet.on');s=await sheet();
    ok(s.title==='Replace close-up'&&s.rm==='Remove close-up',T+'the Add card\'s Replace close-up opens the sheet with Remove close-up');
    await p.click('#cu-rm');await closed();
    ok(await p.evaluate(()=>!queue[0].texture&&!document.querySelector('#nps-q [data-ck="tex"].cktexon')),T+'Remove close-up there takes the close-up off the card (dropTexture)');
    ok(!errs.length,T+'no page errors on the touch screen ('+errs.join(' | ')+')');
    await ctx.close()}
  // ================= no touch screen (a computer) =================
  {const {ctx,p,errs,F}=await open(false);
    ok(await p.evaluate(()=>!cuTouch()),T+'the desktop context reads as no touch screen');
    await p.evaluate(()=>openItem('m1'));await settle(p,400);
    let e=await p.evaluate(()=>{const l=document.querySelector('#item-view .phtools label:has(.vfile[onchange*=replaceTexture])'),i=l&&l.querySelector('input'),rm=document.querySelector('#item-view .ptmore .ptrm');
      return {label:l&&l.textContent.trim(),name:i&&i.getAttribute('aria-label'),cap:i&&i.hasAttribute('capture'),rm:rm&&rm.textContent,hRm:rm?Math.round(rm.getBoundingClientRect().height):0,cubtn:!!document.querySelector('.cubtn')}});
    ok(e.label==='Close-up'&&e.name==='Replace close-up'&&!e.cap&&e.rm==='Remove close-up'&&e.hRm>=44&&!e.cubtn,T+`without touch: the Close-up button is the file window itself, and Remove close-up stays a button (44 px) under the row (${JSON.stringify(e)})`);
    const t0=await p.evaluate(()=>texSig(items[0].texture));
    await (await p.$('#item-view .phtools label:has(.vfile[onchange*=replaceTexture]) input')).setInputFiles(file('d.jpg',F.paper));
    await p.waitForFunction(t0=>texSig(items[0].texture)!==t0,t0);
    ok(await p.evaluate(()=>!document.querySelector('#cu-sheet.on')),T+'a file chosen there replaces the close-up with no sheet');
    await p.waitForFunction(()=>/Close-up added/.test((document.querySelector('#toast.on')||{}).textContent||''));await settle(p,300);   // the replace's save has landed
    const t1=await p.evaluate(()=>texSig(items[0].texture));
    await p.click('#item-view .ptmore .ptrm');await p.waitForFunction(()=>!items[0].texture);
    await p.waitForFunction(()=>/Close-up removed/.test((document.querySelector('#toast.on')||{}).textContent||''),null,{timeout:3000}).catch(()=>{});   // (the toast follows the save)
    const tt=await p.evaluate(()=>(document.querySelector('#toast.on')||{}).textContent||'');
    ok(/Close-up removed\..*Undo/.test(tt),T+`without touch: Remove close-up removes it, with Undo in the toast (${tt})`);
    await p.click('#toast button');await p.waitForFunction(t1=>items[0].texture&&texSig(items[0].texture)===t1,t1);
    ok(true,T+'…and the toast’s Undo brings it back');
    await p.evaluate(()=>closeItem&&closeItem());await settle(p,300);
    await p.evaluate(F=>{openAdd();addManual();queue[0].type='suit';queue[0].primaryColor='deeptaupe';renderAdd()},F);await settle(p,300);
    await (await p.$('#nps-q [data-ck="tex"] label input[type=file]')).setInputFiles(file('a.jpg',F.paper));
    await p.waitForFunction(()=>queue[0]&&queue[0].texture&&!queue[0].refining&&!!document.querySelector('#nps-q [data-ck="tex"].cktexon'));await settle(p,200);
    e=await p.evaluate(()=>[...document.querySelectorAll('#nps-q [data-ck="tex"].cktexon button,#nps-q [data-ck="tex"].cktexon label')].map(x=>x.textContent.trim()));
    ok(e.includes('Replace close-up')&&e.includes('Remove close-up')&&!(await p.evaluate(()=>!!document.querySelector('#cu-sheet.on'))),T+`the Add card without touch: the file window directly, and Remove stays (${e.join(', ')})`);
    ok(!errs.length,T+'no page errors without touch ('+errs.join(' | ')+')');
    await ctx.close()}
}
