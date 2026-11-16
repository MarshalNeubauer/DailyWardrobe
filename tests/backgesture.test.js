// The phone's Back (the iPhone's edge swipe, Android's Back: a history step back, popstate) across every layer of the app, on a touch
// screen in Chromium and WebKit with the worker stubbed (no paid call). For each sheet, page and mode: Back closes that layer alone
// (the one under it stays, with its own Back entry); closed with its × instead, its entry goes too (the next Back is not a dead press
// and reopens nothing); opening and closing it again and again leaves the history as long as it was. Nested stacks close one at a
// time, top first (a question over the color sheet over the item sheet; the close-up chooser over the reading sheet over the item
// sheet). The reading sheet (#rd-sheet, colpick.js) had no Back at all (2026-11-15); the crop frame closed the whole item sheet.
// The tabs keep no entries (Back there leaves the app, as before).
const {wrapBrowser}=require('./webkit');
const NEW={colour:{kind:'colour',match:'new',existing:'deeptaupe',dE:7.5,name:'mink brown',hex:'#4a4434',plansAs:'deeptaupe',fitsType:true,confidence:'high',why:'A warm gray-brown.',ask:null},
  pattern:{kind:'pattern',match:'new',existing:'twill',name:'steep fine twill',description:'Fine, steep diagonal ribs.',plansAs:'twill',
    look:{layout:'texture',tr:34,tex:{kind:'twill',grid:['1000','0100','0010','0001'],aspect:1,lighter:true,contrast:'subtle'}},colourHint:null,confidence:'high',why:'A steep twill.',ask:null},model:'stub',lookups:2};
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const engines=[['Chromium',()=>chromium.launch()],['WebKit',async()=>{const pw=require('playwright');return wrapBrowser(await pw.webkit.launch())}]];
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,WARDROBES,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,WARDROBES,settle}){
  const T=eng+': ',H={'content-type':'application/json','access-control-allow-origin':'*'};
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    if(u.pathname==='/describe'&&q.method()==='POST')return route.fulfill({status:200,headers:H,body:JSON.stringify(NEW)});
    if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify({id:'owner',role:'owner',caps:null,used:{}})});
    return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  const seed=async()=>{await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(async W=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
      const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
      const cv=(im,k)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)};
      rememberRole({role:'owner'});settings.custom={colors:[],patterns:[]};applyCustom(settings.custom);
      const w=(0,eval)(W);items=[...w.realistic.map(i=>({...i})),{id:'m1',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:cv(pi,1),texture:cv(ci,3),added:1,name:'Mink suit'}];
      settings.workdays=[0,1,2,3,4];settings.setupDone=1;TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};flt='all';editing=null;show('today')},WARDROBES);
    await settle(p,300)};
  await seed();
  const back=async()=>{await p.evaluate(()=>history.back());await p.waitForTimeout(120);await settle(p,350)};
  const flags=()=>p.evaluate(()=>({ah:appHist,ak:appHist?appKind:'',ih:itemHist,st:!!history.state,len:history.length,href:location.href}));
  const same=(a,b)=>a.ah===b.ah&&a.ak===b.ak&&a.ih===b.ih&&a.st===b.st&&a.href===b.href;
  const fl=f=>`${f.ah?'app:'+f.ak:'-'}/${f.ih?'item':'-'}/${f.st?'state':'none'}/len ${f.len}`;
  const ev=f=>p.evaluate(f);
  const tap=async s=>{await p.click(s);await settle(p,300)};
  /* everything closed, Today, no entry of ours left: else a fresh page */
  const home=async()=>{await ev(()=>{if(asking)askAnswer(false);if(cuOpen)closeupClose();if(rd)rdClose();if(colPick)closeColPick();if(kit)kitClose();if(picker)closePicker();closeShop();
      if(setupShown())setupFinish(false);phEdit.crop=null;if(editing)closeItem();closeSettings();show('today')}).catch(()=>{});await settle(p,400);
    const f=await flags().catch(()=>({ah:true}));if(f.ah||f.ih||f.st)await seed()};
  /* one layer: base() puts up what is under it; open() opens it; on() says it is up; x() closes it with its own ×; under() says the
     base is still as it was */
  const layer=(name,o)=>step(name,()=>layer1(name,o));
  /* a check that throws (Back left the app, a sheet that never opened) is a failure, and the next starts on a fresh page */
  const step=async(name,f)=>{try{await f()}catch(err){ok(false,T+`${name}: threw ${String(err.message).split('\n')[0]}`);await seed().catch(()=>{})}};
  const layer1=async(name,{base,open,on,x,under,reps=2})=>{
    await home();await base();await settle(p,300);const f0=await flags();
    await open();await settle(p,300);const up=await ev(on);
    await back();const r={up,gone:!await ev(on),under:await ev(under)},f1=await flags();
    ok(r.up&&r.gone&&r.under&&same(f0,f1),T+`${name}: Back closes it alone; what was under it stays, with its own Back entry (${JSON.stringify(r)}; ${fl(f0)} → ${fl(f1)})`);
    await open();await settle(p,300);await x();await settle(p,300);
    const r2={gone:!await ev(on),under:await ev(under)},f2=await flags();
    ok(r2.gone&&r2.under&&same(f0,f2),T+`${name}: closed with its ×, its Back entry goes too, so the next Back is not a dead press (${JSON.stringify(r2)}; ${fl(f0)} → ${fl(f2)})`);
    for(let k=0;k<reps;k++){await open();await settle(p,200);await x();await settle(p,200);await open();await settle(p,200);await back()}
    const f3=await flags(),r3={gone:!await ev(on),under:await ev(under)};
    ok(r3.gone&&r3.under&&same(f0,f3)&&f3.len<=f0.len+1,T+`${name}: opened and closed ${reps*2} times (× and Back), the history is as long as before (${fl(f0)} → ${fl(f3)})`)};
  const item=async()=>{await ev(()=>{show('wardrobe');openItem('m1')});await settle(p,450)};
  const itemUp=()=>editing==='m1'&&!!document.querySelector('#item-view.on');
  // a card of the list on Add (a photo that couldn't be opened, filled in by hand; "Add without a photo" has its own sheet: npsUp)
  const addCard=async()=>{await ev(()=>{show('wardrobe');openAdd();if(!queue.length){queue.unshift({id:'bg-card',err:'open'});errToHand('bg-card')}const q=queue[0];q.type='suit';q.primaryColor='deeptaupe';q.pattern='solid';q.texture=items.find(x=>x.id==='m1').texture;renderAdd()});await settle(p,300)};
  const addUp=()=>!document.querySelector('#add').hidden&&queue.length>0;
  const setUp=()=>settingsOpen();
  const today=()=>!document.querySelector('#today').hidden;
  let e;

  // ---- the tabs: no entries of their own (Back there leaves the app, as before)
  await home();await tap('#n-wardrobe');await tap('#n-stats');await tap('#n-today');
  e=await flags();ok(!e.ah&&!e.ih&&!e.st,T+`the tabs leave no Back entries behind (${fl(e)})`);

  // ---- pages and sheets with nothing of ours under them
  await layer('Settings',{base:()=>ev(()=>show('today')),open:()=>ev(()=>openSettings()),on:setUp,x:()=>tap('#settings-modal .sdone'),under:today});
  await layer('Settings → Packing list',{base:()=>ev(()=>{show('today');openSettings()}),open:()=>ev(()=>document.querySelector('#pack-btn').click()),on:()=>!document.querySelector('#pack').hidden,x:()=>tap('#pack .pback'),under:setUp});
  await layer('Settings → Laundry & cleaning',{base:()=>ev(()=>{show('today');openSettings()}),open:()=>ev(()=>document.querySelector('#care-btn').click()),on:()=>!document.querySelector('#care').hidden,x:()=>tap('#care .pback'),under:setUp});
  await layer('Add',{base:()=>ev(()=>show('wardrobe')),open:()=>ev(()=>openAdd()),on:()=>!document.querySelector('#add').hidden,x:()=>tap('#add .pback'),under:()=>!document.querySelector('#wardrobe').hidden});
  await layer('the item sheet',{base:()=>ev(()=>show('wardrobe')),open:()=>ev(()=>openItem('m1')),on:()=>!!editing,x:()=>tap('#item-view .ivdone'),under:()=>!document.querySelector('#wardrobe').hidden});
  await layer('the piece picker',{base:()=>ev(()=>show('today')),open:()=>ev(()=>openPicker('shirt')),on:()=>!!picker,x:()=>tap('#pick-sheet .pick-x'),under:today});
  await layer('What to buy',{base:()=>ev(()=>{show('wardrobe');window.shopGate=()=>[];window.analyzeWardrobe=()=>{}}),open:()=>ev(()=>openShop()),on:()=>shopOpen,x:()=>tap('#shop-sheet .pick-x'),under:()=>!document.querySelector('#wardrobe').hidden});
  await layer('a question',{base:()=>ev(()=>show('today')),open:()=>ev(()=>{askConfirm('Remove it?',{ok:'Remove',danger:true})}),on:()=>!!asking,x:()=>tap('#ask-cancel'),under:today});
  await layer('the tour',{base:()=>ev(()=>show('today')),open:()=>ev(()=>tourOpen()),on:()=>!!kit,x:()=>tap('#kitsheet .kit-x'),under:today});
  await layer('the close-up chooser',{base:()=>ev(()=>show('today')),open:()=>ev(()=>closeupPick({mode:'add',file:()=>{}})),on:()=>!!cuOpen,x:()=>tap('#cu-cancel'),under:today});
  // "Run setup again": Back steps back through it, and on its first step closes it as its Cancel (a first setup stays open there: backzoom)
  await layer('Run setup again',{base:()=>ev(()=>show('today')),open:()=>ev(()=>setupOpen(true)),on:()=>setupShown(),x:()=>ev(()=>setupCancel()),under:today,reps:1});

  // ---- over Settings
  await layer('a question over Settings',{base:()=>ev(()=>openSettings('backup')),open:()=>ev(()=>{askConfirm('Roll back?')}),on:()=>!!asking,x:()=>tap('#ask-cancel'),under:setUp});
  await layer('New color over Settings',{base:()=>ev(()=>openSettings()),open:()=>ev(()=>openCustomNew('colour')),on:()=>!!colPick,x:()=>tap('#col-sheet .pick-x'),under:setUp});
  await layer('Add to Home Screen from Settings',{base:()=>ev(()=>openSettings('about')),open:()=>ev(()=>homeAgain()),on:()=>!!kit,x:()=>tap('#kitsheet .kit-x'),under:setUp});

  // ---- over Add
  await layer('the import sheet over Add',{base:()=>ev(()=>{show('wardrobe');openAdd()}),open:()=>ev(()=>kitImportOpen()),on:()=>!!kit,x:()=>tap('#kit-cancel'),under:()=>!document.querySelector('#add').hidden});
  await layer('the color sheet over an Add card',{base:addCard,open:()=>tap('#add .colbtn[data-k="primaryColor"]'),on:()=>!!colPick,x:()=>tap('#col-sheet .pick-x'),under:addUp});
  await layer('the reading sheet over an Add card',{base:addCard,open:()=>ev(()=>rdRun('q',queue[0].id)),on:()=>!!document.querySelector('#rd-sheet.on'),x:()=>tap('#rd-sheet .rdx'),under:addUp});
  // "Add without a photo" (2026-11-15): its sheet over Add, the color sheet and the discard question over it
  // (on/under run in the page: each names only the page's own globals)
  const nps=async(change)=>{await ev(()=>{show('wardrobe');openAdd();queue.length=0;renderAdd()});await settle(p,300);await tap('#add-manual');
    if(change)await ev(()=>{setq(0,'type','tie')})};
  await layer('the "Add without a photo" sheet over Add',{base:()=>ev(()=>{show('wardrobe');openAdd();queue.length=0;renderAdd()}),open:()=>tap('#add-manual'),on:()=>!!npsId&&!!document.querySelector('#nps-sheet.on'),x:()=>tap('#nps-sheet .nps-x'),under:()=>!document.querySelector('#add').hidden&&!npsId&&!queue.length});
  await layer('the color sheet over the "Add without a photo" sheet',{base:()=>nps(false),open:()=>tap('#nps-q .colbtn[data-k="primaryColor"]'),on:()=>!!colPick,x:()=>tap('#col-sheet .pick-x'),under:()=>!!npsId&&!!document.querySelector('#nps-sheet.on')&&!document.querySelector('#add').hidden});
  await layer('"Discard this item?" over the "Add without a photo" sheet',{base:()=>nps(true),open:()=>tap('#nps-sheet .nps-x'),on:()=>!!asking,x:()=>tap('#ask-cancel'),under:()=>!!npsId&&!!document.querySelector('#nps-sheet.on')&&!document.querySelector('#add').hidden&&queue[0].type==='tie'});
  await step('question > no-photo sheet > Add',async()=>{await home();await nps(true);
    const stack=()=>ev(()=>[asking?'question':'',npsId?'nophoto':'',!document.querySelector('#add').hidden?'add':''].filter(Boolean).join(' > ')||'none');
    await tap('#nps-sheet .nps-x');const seen=[await stack()];
    await back();seen.push(await stack());   // the question closes as Keep editing
    await back();seen.push(await stack());   // Back on the changed card asks again
    await tap('#ask-ok');seen.push(await stack());   // Discard
    await back();seen.push(await stack());
    ok(seen.join(' | ')==='question > nophoto > add | nophoto > add | question > nophoto > add | add | none',T+`a changed "Add without a photo" card: Back closes the question, asks again, Discard closes the sheet, the next Back leaves Add (${seen.join(' | ')})`);
    e=await flags();e.q=await ev(()=>queue.length);ok(!e.ah&&!e.ih&&e.q===0,T+`…and leaves no entry and no card behind (${fl(e)}, ${e.q} cards)`)});
  // a card being filled in survives Back off the Add page (as its ‹)
  await step('an Add card being filled in',async()=>{await home();await addCard();await ev(()=>{queue[0].name='Half-typed suit'});await back();
    await ev(()=>openAdd());await settle(p,300);
    e=await ev(()=>({n:queue.length,name:queue[0]&&queue[0].name}));
    ok(e.n===1&&e.name==='Half-typed suit',T+`Back off Add keeps the card being filled in, as its ‹ does (${JSON.stringify(e)})`);
    await ev(()=>{queue.length=0;renderAdd()})});

  // ---- over the item sheet
  await layer('the color sheet over the item sheet',{base:item,open:()=>tap('#item-view .colbtn[data-k="primaryColor"]'),on:()=>!!colPick,x:()=>tap('#col-sheet .pick-x'),under:itemUp});
  await layer('the pattern sheet over the item sheet',{base:item,open:()=>tap('#item-view .patbtn'),on:()=>!!colPick,x:()=>tap('#col-sheet .pick-x'),under:itemUp});
  await layer('New color (from the list) over the item sheet',{base:async()=>{await item();await tap('#item-view .colbtn[data-k="primaryColor"]')},open:()=>tap('#cn-open'),on:()=>!!(colPick&&colPick.newc),x:()=>tap('#col-sheet .cnback'),under:()=>!!colPick&&!colPick.newc&&editing==='m1'});
  await layer('New pattern (from the list) over the item sheet',{base:async()=>{await item();await tap('#item-view .patbtn')},open:()=>tap('#pn-open'),on:()=>!!(colPick&&colPick.newc),x:()=>tap('#col-sheet .cnback'),under:()=>!!colPick&&!colPick.newc&&editing==='m1'});
  await layer('the reading sheet over the item sheet',{base:item,open:()=>tap('#iv-read'),on:()=>!!document.querySelector('#rd-sheet.on'),x:()=>tap('#rd-sheet .rdx'),under:itemUp});
  await layer('the close-up chooser over the item sheet',{base:item,open:()=>ev(()=>closeupPick({mode:'replace',file:()=>{}})),on:()=>!!cuOpen,x:()=>tap('#cu-cancel'),under:itemUp});
  await layer('the white-paper tip over the item sheet',{base:item,open:()=>ev(()=>paperTip()),on:()=>!!kit,x:()=>tap('#kitsheet .kit-x'),under:itemUp});
  await layer('a question over the item sheet',{base:item,open:()=>ev(()=>{askConfirm('Delete it?',{ok:'Delete',danger:true})}),on:()=>!!asking,x:()=>tap('#ask-cancel'),under:itemUp});
  await layer('zoom & crop in the item sheet',{base:item,open:async()=>{await ev(()=>startCrop('m1'));await p.waitForSelector('#cropbox')},on:()=>!!phEdit.crop,x:()=>p.evaluate(()=>[...document.querySelectorAll('#item-view .cropwrap button')].find(b=>b.textContent==='Discard').click()),under:itemUp});
  // a name being typed, Back at once: kept (the field saves itself; a sheet closed by Back never tells it it was left)
  await step('a name being typed',async()=>{await home();await item();await p.click('#item-view .wf-name');await p.keyboard.type('Brown');await back();
    await p.waitForTimeout(900);
    e=await ev(()=>({name:items.find(x=>x.id==='m1').name,open:!!editing}));
    ok(!e.open&&/Brown$/.test(e.name||''),T+`a name typed in the item sheet and Back at once: the sheet closes and the name is kept (${JSON.stringify(e)})`);
    await ev(()=>{const i=items.find(x=>x.id==='m1');i.name='Mink suit'})});

  // ---- nested: one layer per Back, top first
  await step('question > color > item',async()=>{await home();await item();await tap('#item-view .colbtn[data-k="primaryColor"]');await ev(()=>{askConfirm('Use it?')});await settle(p,200);
    const stack=()=>ev(()=>[asking?'question':'',colPick?'color':'',editing?'item':''].filter(Boolean).join(' > ')||'none');
    const seen=[await stack()];for(let k=0;k<3;k++){await back();seen.push(await stack())}
    ok(seen.join(' | ')==='question > color > item | color > item | item | none',T+`a question over the color sheet over the item sheet: Back closes one at a time, top first (${seen.join(' | ')})`);
    e=await flags();ok(!e.ah&&!e.ih,T+`…and leaves no entry behind (${fl(e)})`)});
  // the reading sheet: the close-up chooser over it (Retake), over the item sheet
  await step('chooser > reading > item',async()=>{await home();await item();await tap('#iv-read');await p.waitForSelector('#rd-sheet.on #rd-both');await settle(p,200);
    await ev(()=>closeupPick({mode:'retake',file:f=>rdRetake(f)}));await settle(p,200);
    const rstack=()=>ev(()=>[cuOpen?'chooser':'',document.querySelector('#rd-sheet.on')?'reading':'',editing?'item':''].filter(Boolean).join(' > ')||'none');
    const rs=[await rstack()];for(let k=0;k<3;k++){await back();rs.push(await rstack())}
    ok(rs.join(' | ')==='chooser > reading > item | reading > item | item | none',T+`the close-up chooser over the reading sheet over the item sheet: one Back each, top first (${rs.join(' | ')})`);
    e=await flags();ok(!e.ah&&!e.ih,T+`…and leaves no entry behind (${fl(e)})`)});
  // the reading sheet closed with ×: the next Back closes the item sheet (not a dead press), and doesn't bring the reading back
  await step('reading × then Back',async()=>{await home();await item();await tap('#iv-read');await p.waitForSelector('#rd-sheet.on');await settle(p,200);await tap('#rd-sheet .rdx');
    await back();
    e=await ev(()=>({rd:!!document.querySelector('#rd-sheet.on'),item:!!editing}));
    ok(!e.rd&&!e.item,T+`reading sheet closed with ×: the next Back closes the item sheet, the reading stays shut (${JSON.stringify(e)})`)});
  // Back while Claude is still reading: the sheet closes and the reading is called off (nothing changes, as Stop)
  await step('Back while reading',async()=>{await home();await item();await ev(()=>{window._fetch=window.fetch;window.fetch=(u,o)=>/describe/.test(String(u))?new Promise((ok,no)=>{if(o&&o.signal)o.signal.addEventListener('abort',()=>{window._aborted=true;no(new DOMException('aborted','AbortError'))})}):window._fetch(u,o)});
    await tap('#iv-read');await p.waitForSelector('#rd-sheet.on #rd-stop');await back();
    e=await ev(()=>({rd:!!document.querySelector('#rd-sheet.on'),item:editing,aborted:!!window._aborted,c:items.find(x=>x.id==='m1').primaryColor}));
    ok(!e.rd&&e.item==='m1'&&e.aborted&&e.c==='deeptaupe',T+`Back while Claude is reading closes the sheet and calls the reading off, the item unchanged and still open (${JSON.stringify(e)})`);
    await ev(()=>{window.fetch=window._fetch})});
  // crop, then Back: leaves the crop first (a frame left as it opened changes nothing), then closes the sheet
  await step('crop then Back',async()=>{await home();await item();await ev(()=>{window._ph0=items.find(x=>x.id==='m1').photo});await ev(()=>startCrop('m1'));await p.waitForSelector('#cropbox');await back();
    e=await ev(()=>({crop:!!phEdit.crop,item:editing,frame:!!document.querySelector('#item-view #cropbox'),same:items.find(x=>x.id==='m1').photo===window._ph0}));
    await back();const e2=await ev(()=>({item:editing}));
    ok(!e.crop&&e.item==='m1'&&!e.frame&&e.same&&!e2.item,T+`Back in an untouched crop frame leaves the crop (the photo unchanged), the next one closes the item sheet (${JSON.stringify([e,e2])})`)});
  // zoomed, then Back: the crop is kept and left (2026-11-15, the owner: closing the crop saves it), the sheet stays; Undo puts the photo back
  await step('zoomed crop then Back',async()=>{await home();await item();await ev(()=>{window._ph0=items.find(x=>x.id==='m1').photo});await ev(()=>startCrop('m1'));await p.waitForSelector('#cropbox');
    await ev(()=>{const r=document.querySelector('#item-view .cropzoom input');r.value='2';r.dispatchEvent(new Event('input',{bubbles:true}))});await back();
    await p.waitForFunction(()=>items.find(x=>x.id==='m1').photo!==window._ph0);await settle(p,300);
    e=await ev(()=>({crop:!!phEdit.crop,item:editing,frame:!!document.querySelector('#item-view #cropbox'),undo:phEdit.undo.length}));
    ok(!e.crop&&e.item==='m1'&&!e.frame&&e.undo===1,T+`Back in a zoomed crop frame keeps the crop and leaves the frame; the item sheet stays open (${JSON.stringify(e)})`);
    await ev(()=>[...document.querySelectorAll('#toast.on button')].find(b=>b.textContent==='Undo').click());await p.waitForFunction(()=>items.find(x=>x.id==='m1').photo===window._ph0,null,{timeout:4000}).catch(()=>{});await settle(p,200);
    ok(await ev(()=>items.find(x=>x.id==='m1').photo===window._ph0&&!phEdit.undo.length),T+'…and the toast’s Undo ("Crop saved.") puts the photo back through the editor’s Undo');
    await back();ok(!await ev(()=>editing),T+'…and the next Back closes the item sheet')});

  await home();
  ok(!errs.length,T+'no page errors ('+errs.join(' | ')+')');
  await ctx.close()}
