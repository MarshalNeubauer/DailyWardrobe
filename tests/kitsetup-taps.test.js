// The controls of the first-run setup (setup.js), the tour, the import sheet and the sample wardrobe (kit.js) and the checklist sections
// (checklist.js), by real taps, typing and picks, on Chromium and WebKit (Safari's engine) with touch (Round C, wave C2-6, 2026-11-18:
// their inline on…="…" handlers became data-act handlers, act.js). Every check is the effect a person sees or the app stores; none reads
// a handler's attribute, so the file passes unchanged on the app from before the move (run there to prove "the same effect").
const CITIES=[{id:1,name:'Springfield',admin1:'Illinois',country_code:'US',latitude:39.8,longitude:-89.64},
  {id:2,name:'Springfield',admin1:'Missouri',country_code:'US',latitude:37.22,longitude:-93.3}];
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ';
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium',locale:'en-US',acceptDownloads:true});
  const days=['2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'];
  await ctx.route('https://archive-api.open-meteo.com/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await ctx.route('https://api.open-meteo.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({daily:{time:days,temperature_2m_max:[14,14,14,14,14,14],temperature_2m_min:[6,6,6,6,6,6],precipitation_probability_max:[0,0,0,0,0,0],precipitation_sum:[0,0,0,0,0,0],weather_code:[2,2,2,2,2,2]}})}));
  await ctx.route('https://geocoding-api.open-meteo.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({results:CITIES})}));
  await ctx.route('https://date.nager.at/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  // the Home Screen step is left out (the app "opened from the Home Screen"), so the steps are the same on both engines
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1');window.DW_STANDALONE=true});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-16T12:00:00';settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.location=null;delete settings.setupDone;delete settings.dress;cache={};show('today')});
  await settle(p,300);
  const tap=async sel=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.tap()};
  const calm=()=>p.waitForTimeout(420);   // (a tap within 350 ms of the last at the same spot is a double tap's second: SETUP_TAP_MS, KIT_TAP_MS)
  const step=()=>p.evaluate(()=>{const s=document.querySelector('#su-step');return s?s.dataset.step:''});
  const yes=async()=>{await p.waitForSelector('#ask-sheet.on');await p.waitForTimeout(500);await tap('#ask-ok')};

  /* ---- the empty Wardrobe's ways in ---- */
  await p.evaluate(()=>show('wardrobe'));await settle(p,300);
  await tap('#wempty .kit-start .linkbtn:nth-of-type(1)');await settle(p,400);
  ok(await p.evaluate(()=>!!document.querySelector('#kitsheet.on.kbs')&&document.querySelector('#kit-title').textContent==='Import from a spreadsheet'),T+'the empty Wardrobe’s "Import from a spreadsheet" opens the import sheet');

  /* ---- the import sheet: paste, the preview's checks, a file, Add, Add as new, Cancel, the template, Take them out ---- */
  await tap('#kit-paste');await p.waitForTimeout(500);
  ok(await p.evaluate(()=>document.activeElement&&document.activeElement.id==='kit-paste'),T+'a tap puts the cursor in the paste field');
  await p.locator('#kit-paste').pressSequentially('Type, Color\nSuit, Navy\nShirt, White\nTie, Burgundy',{delay:5});await settle(p,300);
  const prev=()=>p.evaluate(()=>({rows:document.querySelectorAll('#kit-prev .kit-rows li.ok').length,btn:document.querySelector('#kit-imp').textContent,off:document.querySelector('#kit-imp').disabled}));
  let v=await prev();
  ok(v.rows===3&&v.btn==='Add 3 items'&&!v.off,T+`typed rows are read as they are typed: three pieces ready (${JSON.stringify(v)})`);
  await tap('#kit-prev .kit-rows li.ok:nth-of-type(2) .kit-tick');await settle(p,200);v=await prev();
  ok(v.btn==='Add 2 items',T+`unchecking a row takes it out of the count (${v.btn})`);
  await tap('#kit-prev .kit-rows li.ok:nth-of-type(2) .kit-tick');await settle(p,200);v=await prev();
  ok(v.btn==='Add 3 items',T+`checking it again puts it back (${v.btn})`);
  await p.locator('#kitsheet input[type=file]').setInputFiles({name:'two.csv',mimeType:'text/csv',buffer:Buffer.from('Type,Color\nSuit,Charcoal\nShoes,Black\n')});
  await p.waitForFunction(()=>document.querySelectorAll('#kit-prev .kit-rows li.ok').length===2).catch(()=>{});v=await prev();
  const f=await p.evaluate(()=>({n:document.querySelector('#kitsheet input[type=file]').files.length,ta:document.querySelector('#kit-paste').value}));
  ok(v.rows===2&&v.btn==='Add 2 items'&&f.n===0&&f.ta==='',T+`a picked file replaces the pasted rows, and the file field is emptied for the next pick (${JSON.stringify({v,f})})`);
  await tap('#kit-imp');await p.waitForFunction(()=>items.length===2&&!document.querySelector('#kitsheet.on')).catch(()=>{});
  ok(await p.evaluate(()=>items.length===2&&items.some(i=>i.type==='suit'&&i.primaryColor==='charcoal')&&!document.querySelector('#kitsheet.on')),T+'Add items stores the two pieces and closes the sheet');
  await p.evaluate(()=>{toastDrop&&toastDrop();kitImportOpen()});await settle(p,400);
  await p.locator('#kit-paste').fill('Type, Color, Pattern\nSuit, Charcoal, Pinstripe');await settle(p,300);
  let a=await p.evaluate(()=>({b:(document.querySelector('.kit-asnew')||{}).textContent,imp:document.querySelector('#kit-imp').textContent}));
  ok(a.b==='Add as new'&&a.imp==='Update 1 piece',T+`a row for a piece he has is offered as an update (${JSON.stringify(a)})`);
  await tap('.kit-asnew');await settle(p,200);
  a=await p.evaluate(()=>({b:(document.querySelector('.kit-asnew')||{}).textContent,imp:document.querySelector('#kit-imp').textContent}));
  ok(a.b==='Update it instead'&&a.imp==='Add 1 item',T+`"Add as new" makes it a new piece (${JSON.stringify(a)})`);
  await tap('#kit-cancel');await settle(p,500);
  ok(await p.evaluate(()=>!document.querySelector('#kitsheet.on')&&items.length===2&&!items.some(i=>i.pattern==='pinstripe')),T+'Cancel closes the sheet and nothing is added or changed');
  await p.evaluate(()=>kitImportOpen());await settle(p,400);
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:6000}).catch(()=>null),tap('#kitsheet .btns > button')]);
  ok(!!dl&&dl.suggestedFilename()==='wardrobe-template.csv',T+'"Download a template" downloads wardrobe-template.csv');
  ok(await p.evaluate(()=>/2 items/.test((document.querySelector('#kit-last')||{}).textContent||'')),T+'the sheet names the last import');
  await tap('#kit-last .linkbtn');await settle(p,300);
  if(await p.evaluate(()=>!!document.querySelector('#ask-sheet.on')))await yes();
  await p.waitForFunction(()=>items.length===0).catch(()=>{});
  ok(await p.evaluate(()=>items.length===0),T+'"Take them out" takes the last import out of the wardrobe');
  await p.evaluate(()=>{if(kit)kitClose();toastDrop&&toastDrop();show('today');show('wardrobe')});await settle(p,400);
  await tap('#wempty .kit-start .linkbtn:nth-of-type(1)');await settle(p,400);
  await tap('#kitsheet .kit-x');await settle(p,500);
  ok(await p.evaluate(()=>!document.querySelector('#kitsheet.on')&&!kit),T+'✕ closes the import sheet');

  /* ---- the setup, step by step ---- */
  await p.evaluate(()=>{show('today');setupOpen(false)});await settle(p,300);
  ok(await step()==='welcome'&&await p.evaluate(()=>!!document.querySelector('#su-skip')&&!document.querySelector('#su-back')),T+'the setup opens on Welcome, with Skip and no Back');
  await tap('#su-next');await calm();
  ok(await step()==='week',T+'Get started goes to Your week');
  await tap('#su-workdays .su-day:nth-child(6)');await settle(p,200);
  ok(await p.evaluate(()=>settings.workdays.includes(5)&&document.querySelector('#su-workdays .su-day:nth-child(6)').getAttribute('aria-pressed')==='true'),T+'a tap on Fri makes it a workday, and the button shows pressed');
  await tap('#su-workdays .su-day:nth-child(6)');await settle(p,200);
  const bz=await p.evaluate(()=>[...document.querySelectorAll('#su-blazer .su-day')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':'')).join(' '));
  await tap('#su-blazer .su-day:nth-child(1)');await settle(p,200);
  ok(await p.evaluate(()=>!settings.workdays.includes(5)&&settings.blazerDays.includes(0)),T+`a second tap takes Fri off again, and a tap on Sun makes it a blazer day (${bz})`);
  // the keyboard: Enter on a day button toggles it, and the focus stays on that button of that row after the step is drawn again
  await p.focus('#su-blazer .su-day:nth-child(2)');await p.keyboard.press('Enter');await settle(p,250);
  ok(await p.evaluate(()=>{const a=document.activeElement;return settings.blazerDays.includes(1)&&!!a.closest('#su-blazer')&&a.textContent==='Mon'&&a.getAttribute('aria-pressed')==='true'}),T+'Enter on the blazer row’s Mon makes it a blazer day, and the focus stays on that button');
  await p.keyboard.press('Enter');await settle(p,250);
  ok(await p.evaluate(()=>{const a=document.activeElement;return !settings.blazerDays.includes(1)&&!!a.closest('#su-blazer')&&a.textContent==='Mon'}),T+'Enter again takes it off, the focus still there');
  await tap('#su-back');await calm();
  ok(await step()==='welcome',T+'Back goes to Welcome');
  await tap('#su-next');await calm();await tap('#su-next');await calm();
  ok(await step()==='wear',T+'Next, twice, reaches What you wear');
  await tap('#su-sw-tie');await settle(p,250);
  ok(await p.evaluate(()=>settings.dress.tie===false&&document.querySelector('#su-sw-tie').getAttribute('aria-checked')==='false'&&!document.querySelector('#su-vest')&&document.activeElement.id==='su-sw-tie'),T+'the Ties switch turns ties off: the vest row goes, and the focus stays on the switch');
  await tap('#su-sw-tie');await settle(p,250);
  await p.selectOption('#su-vest','always');await settle(p,200);
  ok(await p.evaluate(()=>settings.dress.tie===true&&settings.vestMode==='always'&&setup.vestSet===true),T+'on again, and the Suit vest choice is stored');
  await tap('#su-next');await calm();
  ok(await step()==='weather',T+'Next goes to Weather');
  await tap('#su-units .su-day:nth-child(2)');await settle(p,200);
  ok(await p.evaluate(()=>unit()==='F'&&document.querySelector('#su-units .su-day:nth-child(2)').getAttribute('aria-pressed')==='true'),T+'°F is chosen by a tap');
  await p.focus('#su-units .su-day:nth-child(1)');await p.keyboard.press('Enter');await settle(p,250);
  ok(await p.evaluate(()=>unit()==='C'&&document.activeElement.textContent==='°C'&&!!document.activeElement.closest('#su-units')),T+'Enter on °C chooses it, and the focus stays on °C');
  await tap('#su-units .su-day:nth-child(2)');await settle(p,200);
  await tap('#su-city');await p.locator('#su-city').pressSequentially('Spring',{delay:5});
  ok(await p.evaluate(()=>setup.q==='Spring'),T+'what is typed in the city field is kept for a redraw');
  await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelectorAll('#su-cities button').length===2).catch(()=>{});
  ok(await p.evaluate(()=>document.querySelectorAll('#su-cities button').length===2&&document.querySelector('#su-city').value==='Spring'),T+'Enter in the city field searches: two places found');
  await tap('#su-cities button:nth-child(2)');await settle(p,300);
  ok(await p.evaluate(()=>!!settings.location&&/Missouri/.test(settings.location.name)&&!document.querySelectorAll('#su-cities button').length&&/Missouri/.test(document.querySelector('#su-loc').textContent)),T+'a tap on the second result picks it (Springfield, Missouri)');
  await p.locator('#su-city').pressSequentially('Spr',{delay:5});await tap('#su-find');await p.waitForFunction(()=>document.querySelectorAll('#su-cities button').length===2).catch(()=>{});
  ok(await p.evaluate(()=>document.querySelectorAll('#su-cities button').length===2),T+'the Search button searches too');
  await tap('#su-cities button:nth-child(1)');await settle(p,300);
  await p.evaluate(()=>{window.__geo=0;navigator.geolocation.getCurrentPosition=()=>{window.__geo++}});
  await tap('#su-geo');await settle(p,200);
  ok(await p.evaluate(()=>window.__geo===1&&/Illinois/.test(settings.location.name)),T+'"Use my location" asks the phone for the location (once)');
  await tap('#su-next');await calm();
  ok(await step()==='connect',T+'Next goes to Connection');
  await tap('#su-link');await p.locator('#su-link').pressSequentially('not a link',{delay:5});await p.keyboard.press('Enter');
  await p.waitForSelector('#setup .su-err').catch(()=>{});
  ok(await p.evaluate(()=>/didn’t work/.test((document.querySelector('#setup .su-err')||{}).textContent||'')&&document.querySelector('#su-link').value==='not a link'),T+'Enter in the link field tries the link: "That link didn’t work", the text kept');
  await p.evaluate(()=>{setup.msg='';setupDraw();document.querySelector('#su-link').value='nor this'});
  await tap('#su-connect');await p.waitForSelector('#setup .su-err').catch(()=>{});
  ok(await p.evaluate(()=>/didn’t work/.test((document.querySelector('#setup .su-err')||{}).textContent||'')),T+'the Connect button tries it too');
  await tap('#su-next');await calm();
  ok(await step()==='done'&&await p.evaluate(()=>document.querySelector('#su-next').textContent==='Add my first item'&&!document.querySelector('#su-skip')),T+'Next goes to All set: "Add my first item", no Skip');

  /* ---- the tour from the setup's last step: Next, Back, ✕, the link to the close-up guide ---- */
  const card=()=>p.evaluate(()=>{const b=document.querySelector('#kitsheet.on .kit-body');return b?b.dataset.card:''});
  await tap('#setup #kit-tour-link');await settle(p,300);
  ok(await card()==='score',T+'"Take the 1-minute tour" opens the tour on its first card');
  await calm();await tap('#kit-next');await calm();
  ok(await card()==='closeup',T+'Next goes to the close-up card');
  await tap('#kit-back');await calm();
  ok(await card()==='score',T+'Back goes to the first card again');
  await tap('#kitsheet .kit-x');await settle(p,300);
  ok(await card()===''&&await step()==='done',T+'✕ closes the tour, back on the setup');
  await tap('#setup #kit-tour-link');await calm();await tap('#kit-next');await calm();
  await tap('#kitsheet .kit-body .linkbtn');await settle(p,300);
  ok(await card()==='guide',T+'the close-up card’s link opens the close-up guide');
  await calm();await tap('#kit-next');await settle(p,300);
  ok(await card()==='',T+'"Got it" closes the guide');

  /* ---- the sample wardrobe: loaded from the setup's last step, kept, removed, loaded again from Today ---- */
  await tap('#setup #kit-sample-link');
  await p.waitForFunction(()=>items.length>10&&!setupShown()).catch(()=>{});await settle(p,600);
  const n=await p.evaluate(()=>items.filter(i=>i.sample).length);
  ok(n>10&&await p.evaluate(()=>!!settings.setupDone&&!document.querySelector('#setup.on')&&!document.querySelector('#today').hidden&&!!document.querySelector('#kit-sample')),T+`"Try a sample wardrobe" on the last step loads it (${n} pieces) and finishes the setup: Today, with the sample's note`);
  const sid=await p.evaluate(()=>{CK_OPEN['*']=undefined;const i=items.find(x=>x.sample&&x.type==='tie');openItem(i.id);return i.id});await settle(p,600);
  await tap('#iv-keep');await p.waitForFunction(id=>!items.find(i=>i.id===id).sample,sid).catch(()=>{});
  ok(await p.evaluate(id=>!items.find(i=>i.id===id).sample,sid),T+'"Keep it as mine" on a sample piece makes it his');
  await p.evaluate(()=>{closeItem();toastDrop&&toastDrop();show('today')});await settle(p,500);
  await tap('#kit-sample .btns button:nth-child(1)');await settle(p,400);
  ok(await p.evaluate(()=>!document.querySelector('#add').hidden),T+'the note’s "Add my own" opens Add');
  await p.evaluate(()=>show('today'));await settle(p,400);
  await tap('#kit-sample .btns button:nth-child(2)');await yes();
  await p.waitForFunction(()=>!items.some(i=>i.sample)).catch(()=>{});await settle(p,500);
  ok(await p.evaluate(id=>items.length===1&&items[0].id===id,sid),T+'"Remove the sample" takes the sample away and leaves the piece he kept');
  await p.evaluate(()=>{toastDrop&&toastDrop();show('today')});await settle(p,400);
  ok(await p.evaluate(()=>!!document.querySelector('#firstrun')),T+'Today shows the first-outfit checklist');
  await tap('#firstrun #kit-sample-link');await yes();
  await p.waitForFunction(()=>items.filter(i=>i.sample).length>10).catch(()=>{});await settle(p,500);
  ok(await p.evaluate(()=>items.filter(i=>i.sample).length>10),T+'the checklist’s "Try a sample wardrobe" loads it again, after asking');
  await p.evaluate(async()=>{await kitSampleRemove(true);toastDrop&&toastDrop();show('today')});await settle(p,500);
  await tap('#firstrun #kit-tour-link');await settle(p,300);
  ok(await card()==='score',T+'the checklist’s tour link opens the tour');
  await p.evaluate(()=>kitClose());await settle(p,300);
  await tap('#fr-add');await settle(p,400);
  ok(await p.evaluate(()=>!document.querySelector('#add').hidden),T+'the checklist’s "Add an item" opens Add');
  await p.evaluate(async()=>{await kitDelMany(items.map(i=>i.id));toastDrop&&toastDrop();show('wardrobe')});await settle(p,400);
  await tap('#wempty-add');await settle(p,400);
  ok(await p.evaluate(()=>!document.querySelector('#add').hidden),T+'the empty Wardrobe’s "Add your first item" opens Add');
  await p.evaluate(()=>show('wardrobe'));await settle(p,400);
  await tap('#wempty .kit-start .linkbtn:nth-of-type(2)');
  await p.waitForFunction(()=>items.filter(i=>i.sample).length>10).catch(()=>{});await settle(p,500);
  ok(await p.evaluate(()=>items.filter(i=>i.sample).length>10&&!document.querySelector('#today').hidden),T+'the empty Wardrobe’s "Try a sample wardrobe" loads it and shows Today');
  await p.evaluate(async()=>{await kitSampleRemove(true);toastDrop&&toastDrop()});await settle(p,400);

  /* ---- "Run setup again": Cancel puts the answers back; Skip on a first setup ---- */
  await p.evaluate(()=>{settings.setupDone=1;settings.workdays=[0,1,2,3,4];show('today');setupOpen(true)});await settle(p,300);
  await tap('#su-next');await calm();await tap('#su-workdays .su-day:nth-child(7)');await settle(p,200);
  ok(await p.evaluate(()=>settings.workdays.includes(6)&&!!document.querySelector('#su-cancel')),T+'run again: a workday is changed, Cancel is offered');
  await tap('#su-cancel');await settle(p,400);
  ok(await p.evaluate(()=>!setupShown()&&!settings.workdays.includes(6)&&/canceled/.test(document.querySelector('#toast').textContent)),T+'Cancel closes it and the workdays are as they were');
  await p.evaluate(()=>{toastDrop&&toastDrop();delete settings.setupDone;setupOpen(false)});await settle(p,600);
  await calm();await tap('#su-skip');await settle(p,400);   // (Skip is where Cancel was: a tap there within 350 ms of Cancel's is dropped as a double tap's second)
  const sk=await p.evaluate(()=>({shown:setupShown(),done:!!settings.setupDone,today:!document.querySelector('#today').hidden}));
  ok(!sk.shown&&sk.done&&sk.today,T+`Skip finishes a first setup and shows Today (${JSON.stringify(sk)})`);

  /* ---- the checklist sections on the item sheet: a header, "Also has" × and +, Match close-up and Undo ---- */
  const id=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#5a6f9a';x.fillRect(0,0,64,64);
    const it={id:'tapsuit',type:'suit',primaryColor:'navy',pattern:'stripe',secondaryColor:'white',accents:['red','green'],texture:c.toDataURL('image/jpeg',.9),meas:{src:'closeup',lab:[48,2,-26]},added:Date.now(),updated:Date.now()};
    await put(it);items=[it];planDirty();CK_OPEN['*']=undefined;for(const k of Object.keys(CK_OPEN))delete CK_OPEN[k];show('wardrobe');openItem(it.id);return it.id});
  await settle(p,700);
  const sec=k=>p.evaluate(k=>{const s=document.querySelector(`#item-view .cks[data-ck="${k}"]`);return s?{open:s.classList.contains('open'),ex:s.querySelector('.ckh').getAttribute('aria-expanded')}:null},k);
  const c0=await sec('color');
  await tap('#item-view .cks[data-ck="color"] .ckh');await settle(p,300);
  const c1=await sec('color');
  ok(c0&&c1&&c1.open===!c0.open&&c1.ex===String(c1.open),T+`a tap on the Color section's header ${c0&&c0.open?'folds':'unfolds'} it (${JSON.stringify([c0,c1])})`);
  if(c1&&!c1.open){await tap('#item-view .cks[data-ck="color"] .ckh');await settle(p,300)}
  ok((await sec('color')).open,T+'and a tap unfolds it');
  // the sheet is drawn again after every edit: the focus stays on the control it was on (app.js keepFocus)
  const stays=async sel=>{await p.focus(sel);await p.evaluate(()=>renderItem());await settle(p,200);return p.evaluate(sel=>document.activeElement===document.querySelector(sel),sel)};
  ok(await stays('#item-view .cks[data-ck="color"] .ckh'),T+'the focus stays on the Color section’s header when the sheet is drawn again');
  ok(await stays('#item-view .accchip[data-c="green"] .accx'),T+'and on "Also has" green’s ×, not red’s');
  ok(await stays('#item-view .accadd'),T+'and on "+ Add a color"');
  await tap('#item-view .accchip[data-c="red"] .accx');await p.waitForFunction(id=>!(items.find(i=>i.id===id).accents||[]).includes('red'),id).catch(()=>{});await settle(p,300);
  ok(await p.evaluate(id=>JSON.stringify(items.find(i=>i.id===id).accents)==='["green"]'&&!document.querySelector('#item-view .accchip[data-c="red"]'),id),T+'× on "Also has" red takes that color off, green stays');
  await tap('#item-view .accadd');await settle(p,400);
  ok(await p.evaluate(()=>!!document.querySelector('#col-sheet.on')&&!!colPick&&colPick.k==='accents'),T+'"+ Add a color" opens the color sheet for the accents');
  await p.evaluate(()=>closeColPick());await settle(p,300);
  if(!(await sec('look')).open){await tap('#item-view .cks[data-ck="look"] .ckh');await settle(p,300)}
  const s0=await p.evaluate(id=>items.find(i=>i.id===id).shade||0,id);
  await tap('#item-view .cmpgo');await p.waitForFunction(id=>(items.find(i=>i.id===id).shade||0)!==0,id).catch(()=>{});await settle(p,400);
  const s1=await p.evaluate(id=>({sh:items.find(i=>i.id===id).shade||0,undo:!!document.querySelector('#item-view .cmpundo')}),id);
  ok(s0===0&&s1.sh!==0&&s1.undo,T+`Match close-up sets the shade from the close-up (${s1.sh} steps) and offers Undo`);
  ok(await stays('#item-view .cmpundo')&&await stays('#item-view .cmpgo'),T+'the focus stays on Undo, and on Match close-up, when the sheet is drawn again');
  await tap('#item-view .cmpundo');await p.waitForFunction(id=>!(items.find(i=>i.id===id).shade),id).catch(()=>{});await settle(p,400);
  ok(await p.evaluate(id=>!(items.find(i=>i.id===id).shade)&&!document.querySelector('#item-view .cmpundo'),id),T+'Undo puts the shade back');

  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.join(' | '):''));
  await ctx.close();
}
