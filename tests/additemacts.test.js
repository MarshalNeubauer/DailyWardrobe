// The Add card, the "Add without a photo" sheet, the item page, its photo tools and the Wardrobe's type chips name their handlers with
// data-act (act.js; Round C, wave C2-5, 2026-11-18) where they had inline on…="…" handlers. Every kind of control that moved is used here
// as a person uses it (a tap, the real dropdown, typing, a drag, a file chosen), with the effect it had before. The test reads no
// attribute of the handlers (it finds controls by class, label and words), so it passes unchanged on the app from before the move: run
// there to prove the effects are the same. Also: the control used keeps the keyboard's focus after the redraw (app.js keepFocus), as
// with an inline handler. Chromium and WebKit (Safari's engine), with touch; then without touch for the two Remove close-up buttons.
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function open(browser,eng,url,touch,settle){
  const ctx=await browser.newContext(touch?{viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'}:{viewport:{width:900,height:900}});
  await ctx.route('https://w.test/**',route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{CK_OPEN['*']=true;
    window.__pic=(w,h,c)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(0,0,w/4,h/4);return cv.toDataURL('image/jpeg',.9)};
    let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    HOOK.items=[I('suit','navy',{photo:__pic(400,300,'#234')}),I('shirt','white',{photo:__pic(300,300,'#eee'),pattern:'stripe',secondaryColor:'blue',stripes:{kind:'stripe',a:0,b:[['#fff',4],['#36c',1]]}}),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),
      I('tie','green',{paused:true,order:true,arrives:'2099-01-10'}),I('watch','black',{metal:'silver'}),I('suit','charcoal',{texture:__pic(300,300,'#444')})];
    settings.setupDone=1;HOOK.cache={};queue.length=0;show('wardrobe')});
  await settle(p,400);
  return {ctx,p,errs}}
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',{ctx,p,errs}=await open(browser,eng,url,true,settle);
  const ev=(f,a)=>p.evaluate(f,a);
  const tap=async(sel,ms)=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.tap();await settle(p,ms||300)};
  const date=async(sel,v)=>{const h=await p.locator(sel).first().elementHandle();await h.fill(v);if(await h.evaluate(e=>e.isConnected))await h.evaluate(e=>e.dispatchEvent(new Event('change',{bubbles:true})));await settle(p,300)};   // (WebKit's Linux date field says `change` only when left)
  const item=id=>ev(id=>{const i=items.find(x=>x.id===id);return i?JSON.parse(JSON.stringify({...i,photo:i.photo?i.photo.length:0,photoSm:0,texture:i.texture?1:0})):null},id);

  /* ---- Add without a photo: the sheet's card ---- */
  await ev(()=>openAdd());await settle(p,300);await tap('#add-manual',500);
  const Q=()=>ev(()=>{const q=queue[0];return q?{type:q.type,checked:q.checked||{},shade:q.shade||0,qty:q.qty||1,order:!!q.order,arrives:q.arrives||'',name:q.name||'',notes:q.notes||'',material:q.material||''}:null});
  await tap('#nps-q section[data-ck="type"] .cklr');
  let q=await Q();
  ok(q.checked.type===1&&await ev(()=>/^1 of/.test(document.querySelector('#nps-q .ckprog b').textContent)),T+'Add without a photo: a tap on Type’s "Looks right" checks the section and the count follows ('+JSON.stringify(q.checked)+')');
  const unfold=()=>ev(()=>{for(const k of Object.keys(CK_OPEN))if(k!=='*')delete CK_OPEN[k];renderAdd()});   // (a checked section folds: every section open again)
  await unfold();await tap('#nps-q section[data-ck="type"] .cklr');q=await Q();
  ok(!q.checked.type,T+'a second tap takes the check off again');
  await tap('#nps-q .shaderow .shbtn[aria-label="Lighter"]');q=await Q();
  const sh1=q.shade;await tap('#nps-q .shaderow .shbtn[aria-label="Darker"]');await tap('#nps-q .shaderow .shbtn[aria-label="Darker"]');q=await Q();
  ok(sh1===1&&q.shade===-1&&await ev(()=>!!document.querySelector('#nps-q .shaderow .shval').textContent),T+'the Shade row’s + and − step the card’s shade ('+sh1+', '+q.shade+')');
  await p.selectOption('#nps-q section[data-ck="type"] select','shirt');await settle(p,400);
  await tap('#nps-q .qtyb[aria-label="One more"]');await tap('#nps-q .qtyb[aria-label="One more"]');await tap('#nps-q .qtyb[aria-label="One fewer"]');q=await Q();
  ok(q.type==='shirt'&&q.qty===2&&await ev(()=>document.querySelector('#nps-q .qtyrow output').textContent==='2'&&/Confirm 2/.test(document.querySelector('#nps-bar .pri').textContent)),T+'How many: + + − leaves 2, on the row and on Confirm ('+q.qty+')');
  await p.locator('#nps-q input.wf-name').first().scrollIntoViewIfNeeded();await p.locator('#nps-q input.wf-name').first().click();await p.keyboard.type('Oxford no. 2');
  await p.locator('#nps-q textarea.wf-notes').first().click();await p.keyboard.type('Fits well');await settle(p,200);q=await Q();
  ok(q.name==='Oxford no. 2'&&q.notes==='Fits well',T+'typing in Name and Notes fills the card ('+JSON.stringify([q.name,q.notes])+')');
  await tap('#nps-q .ordrow .rotbtn');q=await Q();
  ok(q.order&&await ev(()=>!!document.querySelector('#nps-q .ordrow input[type="date"]')),T+'"Bought, on the way" marks the card and shows the Arrives date');
  await date('#nps-q .ordrow input[type="date"]','2099-03-04');q=await Q();
  ok(q.arrives==='2099-03-04',T+'the Arrives date is taken ('+q.arrives+')');
  await tap('#nps-q .ordrow .rotbtn');q=await Q();
  ok(!q.order&&!q.arrives,T+'a second tap takes "on the way" and its date off');
  const n0=await ev(()=>items.length);
  await tap('#nps-cancel',400);
  const asked=await ev(()=>({ask:!!(typeof asking!=='undefined'&&asking),up:document.querySelector('#nps-sheet').classList.contains('on')}));
  ok(asked.ask&&asked.up,T+'Cancel on a changed card asks before it discards ('+JSON.stringify(asked)+')');
  await ev(()=>askAnswer(false));await settle(p,300);
  await tap('#nps-bar .pri',700);await p.waitForFunction(n=>items.length===n+2,n0).catch(()=>{});
  ok(await ev(n=>items.length===n+2&&items.slice(-2).every(i=>i.type==='shirt'&&i.name==='Oxford no. 2')&&!document.querySelector('#nps-sheet').classList.contains('on')&&!queue.length,n0),T+'Confirm saves the two shirts and closes the sheet');
  // an untouched card: Cancel closes at once
  await tap('#add-manual',500);await tap('#nps-cancel',400);
  ok(await ev(()=>!queue.length&&!document.querySelector('#nps-sheet').classList.contains('on')),T+'Cancel on an untouched card closes the sheet and drops the card');

  /* ---- Add's list: the cards that are not a form, a form's × and Skip, Claude's guess, Save all ---- */
  await ev(()=>{queue.unshift({id:'cE',err:'open'});queue.unshift({id:'cM',multiErr:'Nothing found.'});const a=new AbortController();window.__ab=a;queue.unshift({id:'cB',busy:true,abort:a});renderAdd()});await settle(p,300);
  await tap('#queue [data-q="cB"] .stopread');
  ok(await ev(()=>cardOf('cB').stopped===1&&window.__ab.signal.aborted),T+'Stop on a card being read stops the reading');
  await ev(()=>{const c=cardOf('cB');delete c.abort;c.multiBusy=true;renderAdd()});await settle(p,200);
  await tap('#queue [data-q="cB"] button');
  ok(await ev(()=>!cardOf('cB')&&queue.length===2),T+'Cancel on a "Several items" card being read takes it away');
  await tap('#queue [data-q="cM"] .btns button:not(.pri)');
  ok(await ev(()=>!cardOf('cM')&&queue.length===1),T+'Dismiss takes a card that couldn’t be read away');
  await tap('#queue [data-q="cE"] .btns button:first-child',400);
  ok(await ev(()=>{const c=cardOf('cE');return !!c&&c.manual&&!c.err&&!!document.querySelector('#queue [data-q="cE"].ckcard')}),T+'"Fill it in by hand" turns the card into a form');
  await ev(()=>{const c=cardOf('cE');c.matGuess={key:matsFor('suit')[0],why:'smooth'};renderAdd()});await settle(p,200);
  await tap('#queue [data-q="cE"] .matguess .chipbtn');
  ok(await ev(()=>cardOf('cE').material===matsFor('suit')[0]),T+'"Use …" takes Claude’s guess as the material');
  await ev(()=>{queue.unshift({id:'cF',err:'open'});errToHand('cF');queue.unshift({id:'cG',err:'open'});errToHand('cG')});await settle(p,300);
  await tap('#queue [data-q="cG"] .qx');
  ok(await ev(()=>!cardOf('cG')&&queue.length===2),T+'a form card’s × takes it away');
  await ev(()=>{queue.unshift({id:'cH',err:'open'});errToHand('cH')});await settle(p,300);
  await tap('#queue [data-q="cH"] .ckfoot .btns button:not(.pri)');
  ok(await ev(()=>!cardOf('cH')&&queue.length===2),T+'and so does its Cancel');
  const n1=await ev(()=>items.length);
  ok(await ev(()=>/Save all 2 items/.test(document.querySelector('#save-all').textContent)),T+'two ready cards offer "Save all 2 items"');
  await tap('#save-all button',900);await p.waitForFunction(n=>items.length===n+2&&!queue.length,n1).catch(()=>{});
  ok(await ev(n=>items.length===n+2&&!queue.length,n1),T+'Save all saves both cards');
  await ev(()=>{queue.unshift({id:'cI',err:'open'});errToHand('cI')});await settle(p,300);
  const n2=await ev(()=>items.length);
  await tap('#queue [data-q="cI"] .ckfoot .pri',800);await p.waitForFunction(n=>items.length===n+1,n2).catch(()=>{});
  ok(await ev(n=>items.length===n+1&&!cardOf('cI'),n2),T+'a list card’s Confirm saves it');
  // a photo nobody read asks for its type first: the real dropdown
  await ev(()=>{queue.unshift({id:'cT',unread:1,photo:__pic(300,300,'#356'),type:'suit',primaryColor:'grey',pattern:'solid'});renderAdd()});await settle(p,300);
  const asks=await ev(()=>!!document.querySelector('#queue [data-q="cT"].typeask select'));
  if(asks){await p.selectOption('#queue [data-q="cT"].typeask select','tie');await settle(p,500)}
  ok(asks&&await ev(()=>{const c=cardOf('cT');return c.type==='tie'&&!document.querySelector('#queue [data-q="cT"].typeask')&&!!document.querySelector('#queue [data-q="cT"].ckcard')}),T+'the type picked on a "What is it?" card is taken and the full card follows');
  await tap('#queue [data-q="cT"] .qx');

  /* ---- the Wardrobe's type chips: a tap filters; by keyboard the chip keeps the focus through the redraw ---- */
  await ev(()=>show('wardrobe'));await settle(p,400);
  await tap('#wardrobe .chips .chip:has-text("Tie")');
  ok(await ev(()=>flt==='tie'&&document.querySelector('#wardrobe .chip.on').textContent.trim().startsWith('Tie')),T+'a tap on the Tie chip shows the ties');
  await p.locator('#wardrobe .chips .chip:has-text("Watch")').first().focus();await p.keyboard.press('Enter');await settle(p,300);
  const chip=await ev(()=>{const a=document.activeElement;return {flt,on:a&&a.classList.contains('chip')&&a.classList.contains('on')&&a.isConnected,txt:a&&a.textContent.trim()}});
  ok(chip.flt==='watch'&&chip.on&&/^Watch/.test(chip.txt),T+'Enter on the Watch chip shows the watches and the new chip keeps the focus ('+JSON.stringify(chip)+')');
  await tap('#wardrobe .chips .chip:has-text("All")');
  ok(await ev(()=>flt==='all'),T+'the All chip shows everything again');

  /* ---- the item page ---- */
  await ev(()=>openItem('watch5'));await settle(p,500);
  await p.locator('#ivbody .wdetails input').first().fill('  three subdials  ');await p.keyboard.press('Tab');await settle(p,400);
  ok((await item('watch5')).details==='three subdials',T+'the watch’s Details field is saved trimmed when left');
  const bandSel='#ivbody label:has-text("Band") select';
  const bandEl=()=>{const l=[...document.querySelectorAll('#ivbody label')].find(l=>/^Band/.test(l.textContent.trim()));return l&&l.querySelector('select')};
  const band=await ev(f=>{const e=(0,eval)('('+f+')')();return e?[...e.options].map(o=>o.value).find(v=>v!==e.value):null},String(bandEl));
  await p.selectOption(bandSel,band);await settle(p,400);
  ok(!!band&&(await item('watch5')).band===band,T+'a choice in the item page’s Band dropdown is saved ('+band+')');
  await p.locator(bandSel).first().focus();await p.keyboard.press('Shift');
  const band2=await ev(f=>{const e=(0,eval)('('+f+')')();return [...e.options].map(o=>o.value).find(v=>v!==e.value)},String(bandEl));
  await p.selectOption(bandSel,band2);await settle(p,400);
  ok((await item('watch5')).band===band2&&await ev(f=>document.activeElement===(0,eval)('('+f+')')(),String(bandEl)),T+'picked by keyboard, the new Band dropdown keeps the focus');
  await ev(()=>{HOOK.closeItem();openItem('tie2')});await settle(p,500);
  await tap('#ivbody .shaderow .shbtn[aria-label="Darker"]',400);
  ok((await item('tie2')).shade===-1,T+'the item page’s Shade − makes the drawn color a step darker');
  await tap('#ivbody .shaderow .shbtn[aria-label="Lighter"]',400);
  ok(!(await item('tie2')).shade,T+'and + brings it back');
  await tap('#ivbody .ivrot .rotbtn',500);
  ok((await item('tie2')).paused===true&&await ev(()=>/Put back in rotation/.test(document.querySelector('#ivbody .ivrot .rotbtn').textContent)),T+'"Take out of rotation" takes the piece out');
  await tap('#ivbody .ivrot .rotbtn',500);
  ok(!(await item('tie2')).paused,T+'"Put back in rotation" puts it back');
  await ev(()=>{HOOK.closeItem();openItem('tie4')});await settle(p,500);
  await date('#ivbody .ordrow input[type="date"]','2099-02-01');
  ok((await item('tie4')).arrives==='2099-02-01',T+'the item page’s Arrives date is saved');
  await ev(()=>{HOOK.closeItem();openItem('shirt1')});await settle(p,500);
  ok(await ev(()=>/stripes read from photo/.test(document.querySelector('#ivbody .ivpat').textContent)),T+'a shirt with read stripes says so');
  await tap('#ivbody .ivpat .btns button:has-text("Use generic")',500);
  ok(!(await item('shirt1')).stripes&&await ev(()=>/generic/.test(document.querySelector('#ivbody .ivpat .shelp').textContent)),T+'"Use generic" drops the reading');
  await tap('#ivbody .ivpat #readpat-btn',700);
  ok(await ev(()=>/Could not find a clear repeating pattern/.test(document.querySelector('#toast').textContent)||!!items.find(i=>i.id==='shirt1').stripes),T+'"Read pattern from photo" reads the photo (a plain one: it says no pattern was found)');
  const n3=await ev(()=>items.length);
  await tap('#ivbody #iv-dup',700);await p.waitForFunction(n=>items.length===n+1,n3).catch(()=>{});
  ok(await ev(n=>items.length===n+1,n3),T+'"Duplicate this item" adds a copy');
  await ev(()=>{HOOK.closeItem();openItem('tie2')});await settle(p,500);
  await tap('#ivbody .ivdel .danger',700);await p.waitForFunction(()=>!items.some(i=>i.id==='tie2')).catch(()=>{});
  ok(await ev(()=>!items.some(i=>i.id==='tie2')),T+'"Delete item" deletes the piece');

  /* ---- the photo tools: rotate, crop (zoom, drag, apply, discard) ---- */
  await ev(()=>{HOOK.closeItem();openItem('suit0')});await settle(p,500);
  const dims=()=>ev(async()=>{const im=await imgOf(items.find(i=>i.id==='suit0').photo);return [im.naturalWidth,im.naturalHeight]});
  const d0=await dims();
  await tap('#ivbody .pt-rotate',900);await p.waitForFunction(()=>/Photo rotated/.test(document.querySelector('#toast').textContent)).catch(()=>{});
  const d1=await dims();
  ok(d0[0]===400&&d0[1]===300&&d1[0]===300&&d1[1]===400,T+'Rotate turns the photo a quarter turn ('+d0+' → '+d1+')');
  await tap('#ivbody .pt-crop',700);
  ok(await ev(()=>!!phEdit.crop&&!!document.querySelector('#cropbox #cropimg')),T+'Crop opens the crop frame');
  await p.locator('#ivbody .cropzoom input').first().focus();for(let k=0;k<10;k++)await p.keyboard.press('ArrowRight');await settle(p,200);
  const z=await ev(()=>({z:phEdit.crop.z,w:parseFloat(document.querySelector('#cropimg').style.width),box:document.querySelector('#cropbox').clientWidth}));
  ok(z.z>1.4&&z.z<1.6&&z.w>z.box*1.3,T+'the Zoom slider zooms the picture in the frame ('+JSON.stringify(z)+')');
  const c0=await ev(()=>({x:phEdit.crop.cx,y:phEdit.crop.cy})),bb=await p.locator('#cropbox').boundingBox();
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(bb.x+bb.width/2-30,bb.y+bb.height/2-20,{steps:4});await p.mouse.up();await settle(p,200);
  const c1=await ev(()=>({x:phEdit.crop.cx,y:phEdit.crop.cy}));
  ok(c1.x>c0.x+.01&&c1.y>c0.y+.01,T+'dragging the picture moves it under the frame ('+JSON.stringify([c0,c1])+')');
  await p.mouse.move(bb.x+bb.width/2+60,bb.y+bb.height/2+60,{steps:3});await settle(p,100);
  ok(await ev(c=>phEdit.crop.cx===c.x&&phEdit.crop.cy===c.y,c1),T+'once let go, the pointer no longer moves it');
  await tap('#ivbody .cropwrap .btns .pri',900);await p.waitForFunction(()=>!phEdit.crop&&!document.querySelector('#cropbox')&&/Photo cropped/.test(document.querySelector('#toast').textContent)).catch(()=>{});
  const d2=await dims();
  ok(await ev(()=>!phEdit.crop)&&d2[0]===d2[1]&&d2[0]<300,T+'Apply saves the square crop ('+d2+')');
  await tap('#ivbody .pt-crop',700);await tap('#ivbody .cropwrap .cropdiscard',500);
  ok(await ev(()=>!phEdit.crop&&!document.querySelector('#cropbox'))&&(await dims()).join()===d2.join(),T+'Discard leaves the crop frame with the photo unchanged');
  // True color in 3 steps: the card opens the tip
  await ev(()=>{HOOK.closeItem();openItem('suit6')});await settle(p,500);
  await tap('#ivbody .wbstcard',600);
  ok(await ev(()=>!!kit&&!!document.querySelector('.kit-body')),T+'the "True color in 3 steps" card opens the tip');
  await ev(()=>{if(kit)kitClose()});await settle(p,300);
  ok(!errs.length,T+`no page errors (${errs.join(' | ')})`);
  await ctx.close();

  /* ---- without a touch screen: Replace's file window, and Remove close-up as a button of its own, on the item page and on the Add card ---- */
  const D=await open(browser,eng,url,false,settle),d=D.p;
  await d.evaluate(()=>openItem('suit0'));await settle(d,500);
  const dimsD=()=>d.evaluate(async()=>{const im=await imgOf(items.find(i=>i.id==='suit0').photo);return [im.naturalWidth,im.naturalHeight].join()});
  const jpg=Buffer.from(await d.evaluate(()=>__pic(640,480,'#a33').split(',')[1]),'base64');
  await (await d.$('#ivbody .pt-replace input[type=file]')).setInputFiles({name:'new.jpg',mimeType:'image/jpeg',buffer:jpg});
  await d.waitForFunction(()=>/Photo replaced/.test(document.querySelector('#toast').textContent)).catch(()=>{});
  const rep=await d.evaluate(()=>({toast:document.querySelector('#toast').textContent,empty:document.querySelector('#ivbody .pt-replace input[type=file]').value===''}));
  ok(await dimsD()==='640,480'&&rep.empty&&/Photo replaced/.test(rep.toast),T+'a file chosen with Replace becomes the photo and says so, and the field is emptied for the next one ('+await dimsD()+' '+JSON.stringify(rep)+')');
  await d.evaluate(()=>{HOOK.closeItem();openItem('suit6')});await settle(d,500);
  const has=await d.evaluate(()=>!!document.querySelector('#ivbody .ptrm'));
  if(has){await d.locator('#ivbody .ptrm').first().click();await d.waitForFunction(()=>!items.find(i=>i.id==='suit6').texture&&/Close-up removed/.test(document.querySelector('#toast').textContent)).catch(()=>{})}
  ok(has&&await d.evaluate(()=>!items.find(i=>i.id==='suit6').texture&&/Close-up removed/.test(document.querySelector('#toast').textContent)),T+'no touch: the item page’s "Remove close-up" removes it and says so');
  await d.evaluate(()=>{HOOK.closeItem();openAdd();queue.unshift({id:'cR',err:'open'});errToHand('cR');const c=cardOf('cR');c.texture=__pic(300,300,'#555');renderAdd()});await settle(d,400);
  const has2=await d.evaluate(()=>!!document.querySelector('#queue [data-q="cR"] .ckrm'));
  if(has2){await d.locator('#queue [data-q="cR"] .ckrm').first().click();await settle(d,400)}
  ok(has2&&await d.evaluate(()=>!cardOf('cR').texture&&!document.querySelector('#queue [data-q="cR"] .ckrm')),T+'no touch: the Add card’s "Remove close-up" removes it');
  ok(!D.errs.length,T+`no page errors without touch (${D.errs.join(' | ')})`);
  await D.ctx.close();
}
