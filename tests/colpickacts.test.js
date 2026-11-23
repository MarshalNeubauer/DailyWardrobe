// The color picker's controls after their inline handlers became data-act (colpick.js, Round C wave C2-3, 2026-11-18): every kind of
// control, with a real tap (a finger on a touch screen; the two sliders with a pointer press and the arrow keys), in Chromium and WebKit,
// with the server stubbed (no paid call): the color and pattern buttons of the item sheet and the Add card, the tiles (listed, the owner's
// own, Claude's), the Close-up / Whole photo / Drawing switch, Use, ×, Ask Claude, Ask again, Use both colors, the Pictures link;
// "+ New color" and "+ New pattern or texture" (the tile, ‹, the words and Enter, the close-up tick, Ask, the hex and name fields, the
// square and the hue bar, Behaves like, Offer it for, the stripes switch, For, Add, Use … instead, Open patterns, Add a new pattern anyway);
// the reading sheet (Read, Keep, Change, Use, Undo, Use all, ×, Try again, the page's Undo); the Look beta's Shade steps inside the sheet.
// The checks name no data-act attribute, so the same file passes on the code before the change: the same effect from the same tap.
// The order: a tap's handler still runs after document's capture listeners (the tap guards) and before window's listeners.
const COL={kind:'colour',match:'new',existing:'wine',dE:5.7,name:'faded burgundy',hex:'#7a3b47',plansAs:'wine',fitsType:true,confidence:'high',why:'A grayed, softer burgundy.',ask:null,model:'stub'};
const RD={colour:{kind:'colour',match:'new',existing:'deeptaupe',dE:7.5,name:'mink brown',hex:'#4a4434',plansAs:'deeptaupe',fitsType:true,confidence:'high',why:'A warm gray-brown.',ask:null},
  pattern:{kind:'pattern',match:'new',existing:'twill',name:'steep fine twill',description:'Fine, steep diagonal ribs.',plansAs:'twill',
    look:{layout:'texture',tr:34,tex:{kind:'twill',grid:['1000','0100','0010','0001'],aspect:1,lighter:true,contrast:'subtle'}},colourHint:null,confidence:'high',why:'A steep twill.',ask:null},model:'stub',lookups:2};
const TAG={model:'m',type:'suit',primaryColor:'charcoal',secondaryColor:'lightblue',tertiaryColor:'none',pattern:'solid',confidence:{type:'high',primaryColor:'medium',pattern:'high'},altColor:'grey',altPattern:'none',newColor:null,newPattern:null};
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',S={describe:()=>[200,COL],sent:[],tags:[]};
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  const H={'content-type':'application/json','access-control-allow-origin':'*'};
  await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    if(u.pathname==='/describe'&&q.method()==='POST'){let b={};try{b=JSON.parse(q.postData()||'{}')}catch{}S.sent.push(b);const [s,j]=S.describe(b);return route.fulfill({status:s,headers:H,body:JSON.stringify(j)})}
    if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify({id:'owner',role:'owner',caps:null,used:{}})});
    if(q.method()==='POST'&&!/\/(?:sync|push|render)\b/.test(u.pathname)){S.tags.push(u.pathname);return route.fulfill({status:200,headers:H,body:JSON.stringify(TAG)})}
    return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
  await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
    const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
    const cv=(im,k)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)};
    rememberRole({role:'owner'});settings.custom={colors:[],patterns:[]};applyCustom(settings.custom);
    items=[{id:'s1',type:'suit',primaryColor:'grey',pattern:'solid',photo:cv(pi,1),texture:cv(ci,3),added:1,name:'Mink suit'},
      {id:'t1',type:'tie',primaryColor:'red',pattern:'solid',added:2,name:'Bare tie'}];flt='all';editing=null;show('wardrobe');
    // the order of a tap: document's capture listeners, the control's own function, window's listeners
    window.__o=[];document.addEventListener('click',()=>window.__o.push('document capture'),true);window.addEventListener('click',()=>window.__o.push('window'));
    // (colpick.js is a module: its handlers call these inside it, so each is watched at the handler the markup names)
    for(const [h,n] of [['colBtnTap','openColPick'],['cpTileTap','colPickSel'],['cpUseTap','useColPick']]){const f=ACTS[h];ACTS[h]=function(...a){window.__o.push(n);return f.apply(this,a)}}});
  const tap=async sel=>{await p.tap(sel)};
  const order=()=>p.evaluate(()=>{const o=window.__o.join(' > ');window.__o=[];return o});
  const it=id=>p.evaluate(id=>{const i=items.find(x=>x.id===id);return {c:i.primaryColor,c2:i.secondaryColor||null,p:i.pattern,m:i.material||null,shade:i.shade||0,cols:(settings.custom.colors||[]).map(c=>c.key),pats:(settings.custom.patterns||[]).length}},id);
  const sheet=()=>p.evaluate(()=>{const s=document.querySelector('#col-sheet');return {on:s.classList.contains('on'),title:(s.querySelector('#col-title')||{}).textContent||'',bar:(s.querySelector('.cpbar button')||{}).textContent||'',big:(s.querySelector('.cpbig figcaption')||{}).textContent||'',
    k:colPick&&colPick.k,src:colPick&&colPick.src,ref:colPick&&colPick.ref,sel:colPick&&colPick.sel,view:colPick&&colPick.view}});
  const nc=()=>p.evaluate(()=>{const n=colPick&&colPick.newc;return n&&{kind:n.kind,hex:n.hex,h:n.h,s:n.s,v:n.v,name:n.name,desc:n.desc,state:n.state,base:n.base,types:n.types.join(),accent:!!n.accent,closeOn:!!n.closeOn}});
  const shut=async()=>{await p.waitForFunction(()=>!document.querySelector('#col-sheet.on'));await settle(p,250)};
  const colIs=(id,c)=>p.waitForFunction(([id,c])=>items.find(x=>x.id===id).primaryColor===c,[id,c],{timeout:5000}).catch(()=>{});
  const CB='#item-view .colbtn[data-k="primaryColor"]';
  let e,n;
  await p.evaluate(()=>openItem('s1'));await settle(p,400);await order();

  // ---- the item sheet's color button, the views, a tile, Use
  await tap(CB);await settle(p,250);e=await sheet();
  ok(e.on&&e.k==='primaryColor'&&e.src==='e'&&e.ref==='s1'&&e.title==='Choose the color'&&e.bar==='Keep Gray',T+`a tap on the item sheet's Color button opens the sheet for that item and field (${JSON.stringify(e)})`);
  ok(await order()==='document capture > openColPick > window',T+'the button\'s handler runs after document\'s capture listeners and before window\'s');
  await tap('#col-sheet .cpseg button[aria-pressed="false"]');e=await p.evaluate(()=>({view:colPick.view,on:[...document.querySelectorAll('#col-sheet .cpseg button')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent).join()}));
  ok(e.view==='photo'&&e.on==='Whole photo',T+`a tap on "Whole photo" switches what the color is compared with (${JSON.stringify(e)})`);
  await order();await tap('#col-sheet .cptile[data-c="navy"]');e=await sheet();
  ok(e.sel==='navy'&&e.big==='Navy'&&e.bar==='Use Navy'&&(await it('s1')).c==='grey',T+'a tap on a tile shows that color beside the photo and saves nothing');
  ok(await order()==='document capture > colPickSel > window',T+'the tile\'s handler runs once, in the same place in the order');
  await tap('#col-sheet .cpbar button');await colIs('s1','navy');await shut();
  // (WebKit doesn't focus a button that is tapped, so there the sheet has no button to give the focus back to)
  e=await p.evaluate(()=>({btn:document.querySelector('#item-view .colbtn[data-k="primaryColor"]').textContent,focus:!!document.activeElement&&document.activeElement.matches('#item-view .colbtn[data-k="primaryColor"]')}));
  ok((await it('s1')).c==='navy'&&e.btn==='Navy'&&(e.focus||eng==='WebKit'),T+`"Use Navy" saves it, closes the sheet and gives the focus back to the button, which now says Navy (${JSON.stringify(e)})`);
  ok(await order()==='document capture > useColPick > window',T+'Use runs once, in the same place in the order');

  // ---- the pattern button, a pattern tile, ×
  await tap('#item-view .patbtn');await settle(p,250);e=await sheet();
  ok(e.on&&e.k==='pattern'&&e.title==='Choose the pattern',T+'a tap on the Pattern button opens the pattern sheet');
  await tap('#col-sheet .cptile[data-c="herringbone"]');e=await sheet();ok(e.sel==='herringbone'&&e.bar==='Use Herringbone',T+'a tap on a pattern tile shows it');
  await tap('#col-sheet .pick-x');await shut();ok((await it('s1')).p==='solid',T+'× closes the sheet and nothing is saved');

  // ---- Ask Claude, Use both colors, Ask again
  await tap(CB);await settle(p,250);await tap('#col-sheet .cpaskbtn');await p.waitForSelector('#col-sheet .cpai .cptile');await settle(p,150);
  e=await p.evaluate(()=>({all:(document.querySelector('#col-sheet .cpall')||{}).textContent,sel:colPick.sel}));
  ok(S.tags.length===1&&e.all==='Use both colors'&&e.sel==='charcoal',T+`a tap on Ask Claude sends one request and shows Claude's colors (${JSON.stringify(e)}, ${S.tags.length} request)`);
  await tap('#col-sheet .cpall');await colIs('s1','charcoal');await shut();e=await it('s1');
  ok(e.c==='charcoal'&&e.c2==='lightblue',T+`"Use both colors" sets them and closes the sheet (${JSON.stringify(e)})`);
  await tap(CB);await settle(p,250);await tap('#col-sheet .cpaskbtns .cpaskbtn.ghost');await p.waitForFunction(()=>!document.querySelector('#col-sheet .spin'));await settle(p,150);
  ok(S.tags.length===2,T+`"Ask again" asks once more (${S.tags.length} requests)`);

  // ---- "+ New color": the tile, ‹, the words and Enter, the close-up tick, the fields, the sliders, How the app uses it, Add
  await tap('#cn-open');await settle(p,200);ok((await sheet()).title==='New color',T+'a tap on "+ New color" opens the New color sheet');
  await tap('#col-sheet .cnback');await settle(p,200);ok((await sheet()).title==='Choose the color',T+'‹ goes back to the colors');
  await tap('#cn-open');await settle(p,200);
  await p.fill('#cn-text','faded burgundy');ok((await nc()).desc==='faded burgundy',T+'the words typed are kept as they are typed');
  S.sent=[];await p.press('#cn-text','Enter');await p.waitForSelector('#cn-res');n=await nc();
  ok(S.sent.length===1&&S.sent[0].text==='faded burgundy'&&n.desc==='faded burgundy'&&n.hex==='#7a3b47'&&n.name==='Faded burgundy',T+`Enter in the box asks Claude once and adds no line break; the answer fills the shade and the name (${JSON.stringify(n)})`);
  e=n.closeOn;await tap('#cn-close');n=await nc();
  ok(n.closeOn===!e&&await p.evaluate(()=>document.querySelector('#cn-close').getAttribute('aria-checked'))===String(!e),T+'a tap on "Also show Claude my close-up" flips it');
  await p.locator('#cn-hex').scrollIntoViewIfNeeded();await p.fill('#cn-hex','#3366aa');n=await nc();
  ok(n.hex==='#3366aa'&&await p.evaluate(()=>/51, 102, 170/.test(document.querySelector('#col-sheet .cpbig').style.background)),T+'a hex typed is taken as it is typed, the big swatch with it');
  await tap('#cn-name');await settle(p,150);
  ok(await p.evaluate(()=>document.querySelector('#cn-hex').value==='#3366AA'&&document.activeElement.id==='cn-name'),T+'leaving the hex field tidies it in place (the Name field under the finger is still the same field)');
  // (the square brought clear of the sheet's sticky top and bottom bar first)
  const clear=async sel=>{await p.evaluate(sel=>document.querySelector(sel).scrollIntoView({block:'center'}),sel);await settle(p,150);return p.locator(sel).boundingBox()};
  let box=await clear('#cn-sq');
  ok(await p.evaluate(([x,y])=>!!document.elementFromPoint(x,y).closest('#cn-sq'),[box.x+box.width*.25,box.y+box.height*.75]),T+'the square is in reach');
  await p.mouse.click(box.x+box.width*.25,box.y+box.height*.75);await settle(p,150);n=await nc();
  ok(Math.abs(n.s-25)<3&&Math.abs(n.v-25)<3&&await p.evaluate(()=>document.querySelector('#cn-hex').value.toLowerCase()===colPick.newc.hex),T+`a press on the square sets saturation and brightness, the hex with it (s ${Math.round(n.s)}, v ${Math.round(n.v)})`);
  box=await clear('#cn-hue');await p.mouse.click(box.x+box.width*.5,box.y+box.height/2);await settle(p,150);n=await nc();
  ok(Math.abs(n.h-180)<4,T+`a press on the hue bar sets the hue (${Math.round(n.h)})`);
  await p.focus('#cn-sq');e=n.v;await p.keyboard.press('ArrowDown');n=await nc();
  ok(Math.round(n.v)===Math.round(e-1)&&await p.evaluate(()=>document.activeElement.id==='cn-sq'),T+'an arrow key moves the square one step and the focus stays on it');
  await p.focus('#cn-hue');e=n.h;await p.keyboard.press('ArrowUp');n=await nc();
  ok(Math.round(n.h)===Math.round(e+1)&&await p.evaluate(()=>document.activeElement.id==='cn-hue'),T+'an arrow key moves the hue one step and the focus stays on it');
  await p.fill('#cn-name','Test plum');
  ok(await p.evaluate(()=>document.querySelector('#cn-add').textContent==='Add Test plum and use it'&&document.querySelector('#col-sheet .cpbig figcaption').textContent==='Test plum'),T+'the name typed shows on the button and the big swatch at once');
  e=await p.evaluate(()=>{const s=document.querySelector('#cn-base');return [...s.options].map(o=>o.value).find(v=>v!==s.value)});
  await p.selectOption('#cn-base',e);n=await nc();ok(n.base===e&&await p.evaluate(()=>document.querySelector('#cn-base').value)===e,T+`"Behaves like" takes the color picked (${e})`);
  e=n.types;await tap('#col-sheet .cnchip >> nth=0');n=await nc();const off=n.types;await tap('#col-sheet .cnchip >> nth=0');n=await nc();
  ok(off!==e&&n.types.split(',').sort().join()===e.split(',').sort().join(),T+`a tap on an "Offer it for" chip takes the kind out, another puts it back (${e} / ${off})`);
  await tap('#cn-accent');e=(await nc()).accent;await tap('#cn-accent');n=await nc();ok(e===true&&n.accent===false,T+'the "Also for stripes and motifs" switch goes on and off');
  await tap('#cn-add');await p.waitForFunction(()=>/^own/.test(items.find(x=>x.id==='s1').primaryColor),null,{timeout:5000}).catch(()=>{});await shut();e=await it('s1');
  const own=e.cols[0];
  ok(e.cols.length===1&&e.c===own&&/^own/.test(own||''),T+`"Add Test plum and use it" adds the color to the owner's and sets it (${JSON.stringify(e)})`);

  // ---- the owner's own color as a tile
  await tap(CB);await settle(p,250);await tap('#col-sheet .cptile[data-c="navy"]');await tap('#col-sheet .cpbar button');await colIs('s1','navy');await shut();
  await tap(CB);await settle(p,250);e=await p.evaluate(()=>[...document.querySelectorAll('#col-sheet .cph')].map(h=>h.textContent)[0]);
  await tap(`#col-sheet .cnown .cptile[data-c="${own}"]`);n=await sheet();
  ok(e==='Your colors'&&n.sel===own&&n.bar==='Use Test plum',T+'the owner\'s color is a tile under "Your colors"; a tap shows it');
  await tap('#col-sheet .cpbar button');await colIs('s1',own);await shut();ok((await it('s1')).c===own,T+'Use sets the owner\'s color');

  // ---- New color: a shade the owner has ("Use Wine"), a pattern described as a color ("Open patterns"), "Add a new pattern anyway"
  S.describe=()=>[200,{...COL,dE:2}];await tap(CB);await settle(p,250);await tap('#cn-open');await settle(p,200);await p.fill('#cn-text','wine');await tap('#cn-ask');await p.waitForSelector('#cn-res');
  ok(await p.evaluate(()=>document.querySelector('#cn-add').textContent==='Use Wine'),T+'a tap on Ask Claude asks; a shade the owner has is offered as "Use Wine"');
  await tap('#cn-add');await colIs('s1','wine');await shut();e=await it('s1');ok(e.c==='wine'&&e.cols.length===1,T+'"Use Wine" sets the color the owner has and adds nothing');
  S.describe=()=>[200,{kind:'pattern',ask:'That sounds like a pattern.'}];await tap(CB);await settle(p,250);await tap('#cn-open');await settle(p,200);await p.fill('#cn-text','herringbone');await tap('#cn-ask');await p.waitForSelector('#cn-kind button');
  await tap('#cn-kind button');await settle(p,250);e=await sheet();n=await nc();
  ok(e.title==='New pattern or texture'&&e.k==='pattern'&&n.kind==='pattern'&&n.desc==='herringbone',T+'"Open patterns" opens the New pattern sheet with the words kept');
  const have=await p.evaluate(()=>PATS_BY.suit.find(x=>x!=='solid'));
  S.describe=()=>[200,{...RD.pattern,match:'existing',existing:have}];await tap('#cn-ask');await p.waitForSelector('#cn-anyway');
  ok((await nc()).state==='reuse'&&!(await p.$('#pn-details')),T+'a pattern the owner has is offered for use');
  await tap('#cn-anyway');await settle(p,150);ok((await nc()).state==='result'&&!!(await p.$('#pn-details')),T+'"Add a new pattern anyway" shows the details to add it');
  await tap('#col-sheet .pick-x');await shut();
  await tap('#item-view .patbtn');await settle(p,250);await tap('#pn-open');await settle(p,200);ok((await sheet()).title==='New pattern or texture',T+'a tap on "+ New pattern or texture" opens the New pattern sheet');
  await tap('#col-sheet .cnback');await settle(p,200);ok((await sheet()).title==='Choose the pattern',T+'‹ goes back to the patterns');
  await tap('#col-sheet .pick-x');await shut();
  // Settings' sheet: the "For" choice
  await p.evaluate(()=>openCustomNew('colour'));await settle(p,250);await p.selectOption('#cn-for','suit');
  ok(await p.evaluate(()=>colPick.fake.type==='suit'&&document.querySelector('#cn-for').value==='suit'),T+'the "For" choice of Settings\' New color sheet takes the kind picked');
  await tap('#col-sheet .pick-x');await shut();

  // ---- the Pictures link (an item with no close-up)
  await p.evaluate(()=>openItem('t1'));await settle(p,400);await tap(CB);await settle(p,250);
  if(await p.$('#col-sheet .cpgopics')){await tap('#col-sheet .cpgopics');await shut();await settle(p,500);
    ok(await p.evaluate(()=>!!document.querySelector('#item-view.on .ivpics.open')),T+'"Pictures, at the bottom" closes the sheet and opens Pictures')}
  else{ok(false,T+'the sheet of an item with no close-up has the Pictures link');await tap('#col-sheet .pick-x');await shut()}

  // ---- the reading sheet: Read, Keep, Change, Use, Undo, Use all, the page's Undo, ×, Try again
  const mat=await p.evaluate(()=>matsFor('suit').find(m=>m!=='wool')),RDM={...RD,pattern:{...RD.pattern,material:{key:mat,confidence:'high',why:'Soft nap.'}}};
  const result=async()=>{await p.waitForSelector('#rd-sheet.on #rd-both');await settle(p,300)},closed=async()=>{await p.waitForFunction(()=>!document.querySelector('#rd-sheet.on'));await settle(p,300)};
  await p.evaluate(()=>openItem('s1'));await settle(p,400);S.describe=()=>[200,RDM];S.sent=[];
  await tap('#iv-read');await result();
  ok(S.sent.length===1&&S.sent[0].what==='both'&&await p.evaluate(()=>document.querySelector('#rd-both').textContent==='Use all'&&!!document.querySelector('#rd-mat')),T+'a tap on "Read color and texture from close-up" asks once and shows the color, pattern and material cards');
  await tap('#rd-ckeep');await settle(p,200);ok(await p.evaluate(()=>/Kept Wine/.test(document.querySelector('#rd-col').textContent)&&!document.querySelector('#rd-ckeep')),T+'Keep marks the color card kept');
  await tap('#rd-col .rdlink');await settle(p,200);ok(!!(await p.$('#rd-ckeep')),T+'Change opens the card again');
  await tap('#rd-cuse');await p.waitForSelector('#rd-col-undo',{timeout:8000}).catch(()=>{});await settle(p,200);e=await it('s1');
  ok(/^own/.test(e.c)&&e.c!==own&&e.cols.length===2&&e.p==='solid',T+`"Use Mink brown" adds and sets the color only (${JSON.stringify(e)})`);
  await tap('#rd-col-undo');await colIs('s1','wine');await p.waitForSelector('#rd-ckeep',{timeout:8000}).catch(()=>{});await settle(p,200);e=await it('s1');
  ok(e.c==='wine'&&e.cols.length===1&&!!(await p.$('#rd-ckeep')),T+`the card's Undo puts the color back and takes the added one out (${JSON.stringify(e)})`);
  await tap('#rd-both');await closed();e=await it('s1');
  ok(/^own/.test(e.c)&&/^own-/.test(e.p)&&e.m===mat&&e.cols.length===2&&e.pats===1,T+`"Use all" sets the color, the pattern and the material and closes the sheet (${JSON.stringify(e)})`);
  await tap('#item-view #rd-done #rd-undo');await p.waitForFunction(()=>{const i=items.find(x=>x.id==='s1');return i.primaryColor==='wine'&&i.pattern==='solid'&&!i.material&&!document.querySelector('#rd-done')},null,{timeout:8000}).catch(()=>{});await settle(p,200);e=await it('s1');
  ok(e.c==='wine'&&e.p==='solid'&&!e.m&&e.cols.length===1&&!e.pats,T+`the page's Undo puts all three back (${JSON.stringify(e)})`);
  await tap('#iv-read');await result();await tap('#rd-sheet .rdx');await closed();ok((await it('s1')).c==='wine',T+'× closes the reading sheet and nothing changes');
  S.describe=()=>[500,{error:'ai'}];S.sent=[];await tap('#iv-read');await p.waitForSelector('#rd-err button');S.describe=()=>[200,RDM];await tap('#rd-err button');await result();
  ok(S.sent.length===2,T+'"Try again" reads once more');
  await tap('#rd-sheet .rdx');await closed();

  // ---- the Look beta's Shade steps, inside the sheet
  await p.evaluate(()=>{lookSet(true);openItem('s1');openColPick('e','s1','primaryColor')});await settle(p,300);
  await tap('#col-sheet .lkshade button[data-d="1"]');await tap('#col-sheet .lkshade button[data-d="1"]');await tap('#col-sheet .lkshade button[data-d="-1"]');
  e=await p.evaluate(()=>({shade:colPick.shade,out:document.querySelector('#lk-shade').textContent,bar:document.querySelector('#col-sheet .cpbar button').textContent}));
  ok(e.shade===1&&/^Use Wine · /.test(e.bar),T+`two taps on Lighter and one on Darker leave the shade one step lighter (${JSON.stringify(e)})`);
  await tap('#col-sheet .cpbar button');await p.waitForFunction(()=>items.find(x=>x.id==='s1').shade===1,null,{timeout:5000}).catch(()=>{});await shut();
  ok((await it('s1')).shade===1,T+'Use saves the shade');
  await p.evaluate(()=>{lookSet(false);closeItem()});await settle(p,300);

  // ---- the Add card's color button (a card filled in by hand)
  await p.evaluate(()=>{openAdd();addManual()});await settle(p,500);await order();
  await tap('#nps-q .colbtn[data-k="primaryColor"]');await settle(p,250);e=await sheet();const qid=await p.evaluate(()=>queue[queue.length-1].id);
  ok(e.on&&e.src==='q'&&e.ref===qid&&e.k==='primaryColor',T+`a tap on the Add card's Color button opens the sheet for that card (${JSON.stringify(e)})`);
  e=await p.evaluate(()=>{const b=[...document.querySelectorAll('#col-sheet .cptile')].find(b=>b.dataset.c!==colPick.cur&&b.dataset.c!=='none'&&!b.id);return b.dataset.c});
  await tap(`#col-sheet .cptile[data-c="${e}"] >> nth=0`);await tap('#col-sheet .cpbar button');await shut();
  ok(await p.evaluate(([id,c])=>queue.find(q=>q.id===id).primaryColor===c,[qid,e]),T+`a tile and Use set the card's color (${e})`);
  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.join(' | '):''));
  await ctx.close()}
