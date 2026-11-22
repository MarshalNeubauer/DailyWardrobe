// The Add page redesign (2026-11-15, the owner's choice: variant A of add-page-mockups, the hanger-and-pencil icon): One item and
// Several items as before, then a long "Add without a photo" button with its icon, then "Other ways to add" with "Import from a
// spreadsheet" as its last row. "Add without a photo" and the import open bottom sheets over Add: grabber, title with an icon, × in the
// header, opening from below; ×, Cancel, a swipe down and the phone's Back close them; a changed no-photo card asks "Discard this item?"
// first (Keep editing / Discard); Confirm and Cancel are pinned at the bottom; saving closes the sheet with a toast and Undo, and the
// pieces are in the Wardrobe. On the wide layout the sheets sit below a stand-in status bar, at most 640 px wide, centered.
// Chromium and WebKit, with touch; light and dark; the worker stubbed (nothing paid).
module.exports=async({ok,chromium,engines,url,WARDROBES,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{for(const [w,h,scheme] of [[390,844,'light'],[690,960,'dark']])await run(eng,browser,{ok,url,WARDROBES,settle,w,h,scheme})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,WARDROBES,settle,w,h,scheme}){
  const T=`${eng} ${w}px ${scheme}: `,H={'content-type':'application/json','access-control-allow-origin':'*'},WIDE=w>=600;
  const ctx=await browser.newContext({viewport:{width:w,height:h},colorScheme:scheme,hasTouch:true,isMobile:eng==='Chromium'});
  await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify({id:'owner',role:'owner',caps:null,used:{}})});
    return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});   // (no /sync, no reading: nothing paid)
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
  await p.evaluate(W=>{rememberRole({role:'owner'});const w=(0,eval)(W);items=w.realistic.map(i=>({...i}));settings.setupDone=1;cache={};queue.length=0;show('wardrobe');openAdd()},WARDROBES);
  await settle(p,400);
  const ev=(f,a)=>p.evaluate(f,a);
  const tap=async s=>{await p.click(s);await settle(p,350)};
  const cdp=await ctx.newCDPSession(p);let clock=0;
  const TT=(type,x,y,ms=16)=>{clock=type==='touchStart'?Math.max(clock+ms,Date.now()):clock+ms;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}],timestamp:clock/1000})};
  const swipe=async(x,y0,y1,n=8,ms=16)=>{await TT('touchStart',x,y0);for(let k=1;k<=n;k++){await TT('touchMove',x,y0+(y1-y0)*k/n,ms);await p.waitForTimeout(ms)}await TT('touchEnd',x,y1);await settle(p,500)};
  const rect=s=>ev(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,left:r.left,right:r.right,bottom:r.bottom,w:r.width,h:r.height}},s);
  const npsUp=()=>ev(()=>!!npsId&&!!document.querySelector('#nps-sheet.on'));
  const kitUp=()=>ev(()=>!!kit&&!!document.querySelector('#kitsheet.on.kbs'));
  // the sheet's top edge over the frames after a tap: it rises from below
  const rise=async(sel,act)=>{await ev(s=>{window._tops=[];let k=0;const f=()=>{const e=document.querySelector(s),r=e&&e.getBoundingClientRect();if(r&&r.height>0&&getComputedStyle(e).visibility!=='hidden')window._tops.push(r.top);if(++k<40)requestAnimationFrame(f)};requestAnimationFrame(f)},sel);
    await act();await settle(p,400);const t=await ev(()=>window._tops),end=t[t.length-1];return {first:Math.round(Math.max(...t.slice(0,4))),end:Math.round(end)}};
  let e;

  // ---- the Add page: the two tiles, the long button with its icon, the import row last in "Other ways to add"
  e=await ev(()=>{const R=s=>document.querySelector(s).getBoundingClientRect(),one=R('#add-one'),grp=R('#add-group'),lng=R('#add-manual'),more=R('#add .addmore');
    const b=document.querySelector('#add-manual'),ic=b.querySelector('svg.aic'),tic=document.querySelector('#add-one svg.aic'),cs=getComputedStyle(ic),ts=getComputedStyle(tic);
    const rows=[...document.querySelectorAll('#add .addmore .addrow')];
    return {tiles:Math.abs(one.top-grp.top)<1&&one.left<grp.left,under:lng.top>=Math.max(one.bottom,grp.bottom),full:Math.abs(lng.left-one.left)<1&&Math.abs(lng.right-grp.right)<1,h:Math.round(lng.height),
      icon:!!ic&&ic.querySelectorAll('path').length===4&&cs.strokeWidth===ts.strokeWidth&&cs.fill==='none'&&Math.round(ic.getBoundingClientRect().width)>=24,
      text:b.querySelector('b').textContent+' / '+b.querySelector('small').textContent,moreUnder:more.top>=lng.bottom,
      lastRow:rows.length?rows[rows.length-1].id+' '+rows[rows.length-1].querySelector('span').textContent:'',oldRow:rows.some(r=>/without/i.test(r.textContent)),
      side:document.documentElement.scrollWidth<=innerWidth}});
  ok(e.tiles&&e.under&&e.full&&e.h>=44&&e.icon&&e.moreUnder&&e.side,T+`Add: One item and Several items side by side, the long button under them across both, 44 px or taller, with the hanger-and-pencil in the tiles' line (${JSON.stringify(e)})`);
  ok(e.text==='Add without a photo / Pick the type and colors yourself'&&e.lastRow==='add-import Import from a spreadsheet'&&!e.oldRow,T+`its words, and "Other ways to add" ends with "Import from a spreadsheet" (no row for adding without a photo) (${e.text}; ${e.lastRow})`);

  // ---- "Add without a photo": opens from below, the card inside, × in the header, Confirm and Cancel pinned
  // where a sheet's top belongs: --ivtop (the status bar, or 36 px) on the phone, never above 4vh on the wide layout (as the item sheet)
  const ivtop=await ev(W=>{const d=document.createElement('div');d.style.cssText='position:fixed;top:'+(W?'max(4vh,var(--ivtop))':'var(--ivtop)');document.body.append(d);const t=d.getBoundingClientRect().top;d.remove();return t},WIDE);
  let r=await rise('#nps-sheet',()=>p.click('#add-manual'));
  e=await ev(()=>{const s=document.querySelector('#nps-sheet'),R=x=>x.getBoundingClientRect(),sr=R(s),bar=R(document.querySelector('#nps-bar')),x=document.querySelector('#nps-sheet .nps-x');
    const c=document.querySelector('#nps-q .card');return {top:sr.top,w:sr.width,left:sr.left,bottom:sr.bottom,grab:!!s.querySelector('.nps-grab'),title:s.querySelector('#nps-title').textContent,icon:s.querySelectorAll('.nps-head svg.aic path').length,
      x:x&&{w:R(x).width,h:R(x).height,label:x.getAttribute('aria-label')},cardX:!!(c&&c.querySelector('.qx')),cardBtns:!!(c&&c.querySelector('.btns #qconf-0')),
      bar:[...document.querySelectorAll('#nps-bar button')].map(b=>b.textContent).join(','),barBottom:bar.bottom,
      fields:!!(c&&c.querySelector('.rv svg,.rv .thumb'))&&!!c.querySelector('.shaderow')&&!!c.querySelector('[data-ck="tex"] .wbstcard')&&!!c.querySelector('select[data-f="type"]'),
      inert:document.querySelector('body>header').inert&&document.querySelector('body>nav').inert&&document.querySelector('#add .addpick').inert&&!s.closest('[inert]'),dim:+getComputedStyle(document.querySelector('#nps-backdrop')).opacity,
      bg:getComputedStyle(s).backgroundColor}});
  ok(await npsUp()&&r.first>r.end+40&&Math.abs(r.end-e.top)<2,T+`tapping it slides the sheet up from below (top ${r.first} → ${r.end})`);
  ok(Math.abs(e.top-ivtop)<1&&e.grab&&e.title==='Add without a photo'&&e.icon===4&&e.x&&e.x.w>=44&&e.x.h>=44&&e.x.label==='Close'&&e.dim>.9,T+`it has the grabber, the title with the icon and a 44 px × (Close), the page dimmed behind (top ${Math.round(e.top)} = --ivtop ${ivtop}; ${JSON.stringify(e.x)})`);
  ok(e.fields&&!e.cardX&&!e.cardBtns&&e.bar==='Confirm,Cancel'&&Math.abs(e.barBottom-h)<1.5,T+`today's no-photo card is inside (drawing, Shade, Texture match with its close-up buttons, Type), without its own ×; Confirm and Cancel are pinned at the bottom (${e.bar}, bar bottom ${Math.round(e.barBottom)} of ${h})`);
  ok(e.inert,T+'the page behind (header, tab bar, the rest of Add) is out of reach while it is up');
  if(WIDE)ok(Math.round(e.w)===640&&Math.abs(e.left-(w-640)/2)<1.5,T+`on the wide layout it is 640 px wide and centered (${Math.round(e.w)} px at ${Math.round(e.left)})`);
  else ok(Math.round(e.w)===w,T+`on the phone it spans the width (${Math.round(e.w)} px)`);
  const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255};
  ok(scheme==='dark'?lum(e.bg)<.2:lum(e.bg)>.7,T+`the sheet follows the ${scheme} theme (${e.bg})`);
  // scrolled to the end, the bar stays where it was
  e=await ev(()=>{const b=document.querySelector('#nps-q');b.scrollTop=b.scrollHeight;const r=document.querySelector('#nps-bar').getBoundingClientRect();return {bottom:r.bottom,scrolled:b.scrollTop>0}});
  ok(e.scrolled&&Math.abs(e.bottom-h)<1.5,T+`scrolled to the end, Confirm and Cancel stay pinned (${JSON.stringify(e)})`);
  await ev(()=>{document.querySelector('#nps-q').scrollTop=0});

  // ---- closing an untouched card: ×, Cancel, a swipe, Back; nothing asked, nothing kept
  const shut=async(how)=>{const s=await ev(()=>({up:!!npsId,asking:!!asking,q:queue.length,n:items.length}));return s};
  await tap('#nps-sheet .nps-x');e=await shut();
  ok(!await npsUp()&&!e.asking&&e.q===0,T+`× closes it at once when nothing was changed (${JSON.stringify(e)})`);
  ok(await ev(()=>document.activeElement&&document.activeElement.id==='add-manual'&&!document.querySelector('body>nav').inert),T+'the focus is back on the button and the page usable again');
  await tap('#add-manual');await tap('#nps-cancel');e=await shut();
  ok(!await npsUp()&&!e.asking&&e.q===0,T+`Cancel closes it (${JSON.stringify(e)})`);
  await tap('#add-manual');let g=await rect('#nps-sheet');
  await swipe(g.left+g.w/2,g.top+9,g.top+9+g.h*.5);e=await shut();
  ok(!await npsUp()&&!e.asking&&e.q===0,T+`a swipe down on the grabber closes it (${JSON.stringify(e)})`);
  await tap('#add-manual');g=await rect('#nps-sheet');const hb=await rect('#nps-sheet .nps-head');
  await swipe(g.left+g.w/2,hb.bottom+40,hb.bottom+40+g.h*.5);e=await shut();
  ok(!await npsUp()&&e.q===0,T+`a swipe down on the card, scrolled to the top, closes it (${JSON.stringify(e)})`);
  await tap('#add-manual');g=await rect('#nps-sheet');await swipe(g.left+g.w/2,g.top+9,g.top+9+40,4,60);
  ok(await npsUp()&&Math.abs((await rect('#nps-sheet')).top-g.top)<1,T+'a short, slow pull springs back');
  await ev(()=>history.back());await p.waitForTimeout(150);await settle(p,400);e=await shut();
  ok(!await npsUp()&&!e.asking&&e.q===0&&await ev(()=>!document.querySelector('#add').hidden),T+`the phone's Back closes it and stays on Add (${JSON.stringify(e)})`);

  // ---- a changed card asks first: Keep editing keeps it, Discard drops it (×, Cancel, swipe, Back)
  const change=async()=>{await tap('#add-manual');await p.selectOption('#nps-q select[data-f="type"]','tie');await settle(p,300)};
  await change();await tap('#nps-sheet .nps-x');
  e=await ev(()=>({q:(document.querySelector('#ask-title')||{}).textContent,ok:(document.querySelector('#ask-ok')||{}).textContent,cancel:(document.querySelector('#ask-cancel')||{}).textContent,up:!!npsId}));
  ok(e.q==='Discard this item?'&&e.ok==='Discard'&&e.cancel==='Keep editing'&&e.up,T+`× on a changed card asks "Discard this item?" with Keep editing / Discard (${JSON.stringify(e)})`);
  await tap('#ask-cancel');
  ok(await npsUp()&&await ev(()=>queue[0]&&queue[0].type==='tie'&&!asking),T+'Keep editing leaves the sheet up with the card as it was');
  await tap('#nps-cancel');ok(await ev(()=>!!asking),T+'Cancel asks too');
  await tap('#ask-ok');e=await shut();
  ok(!await npsUp()&&e.q===0&&!e.asking,T+`Discard closes it and drops the card (${JSON.stringify(e)})`);
  await change();g=await rect('#nps-sheet');await swipe(g.left+g.w/2,g.top+9,g.top+9+g.h*.5);
  ok(await ev(()=>!!asking&&!!npsId)&&Math.abs((await rect('#nps-sheet')).top-g.top)<1,T+'a swipe on a changed card springs back and asks');
  await tap('#ask-cancel');await ev(()=>history.back());await p.waitForTimeout(150);await settle(p,400);
  ok(await ev(()=>!!asking&&!!npsId&&!document.querySelector('#add').hidden),T+'Back on a changed card asks too, the sheet and Add stay');
  await tap('#ask-ok');ok(!await npsUp()&&await ev(()=>!queue.length),T+'… and Discard closes it');

  // ---- Confirm: the sheet closes, "Saved: …" with Undo, the piece in the Wardrobe
  const n0=await ev(()=>items.length);
  // (the save, its toast and the redraw come a moment after the tap: waited for, not read after settle, CR-10-03)
  await change();await tap('#nps-bar .pri');await p.waitForFunction(n0=>!npsId&&items.length===n0+1&&/^Saved: /.test(document.querySelector('#toast').textContent),n0,{timeout:8000}).catch(()=>{});
  e=await ev(()=>({up:!!npsId,n:items.length,toast:document.querySelector('#toast').textContent,undo:!!document.querySelector('#toast.on button'),add:!document.querySelector('#add').hidden}));
  ok(!e.up&&e.n===n0+1&&/^Saved: .+\./.test(e.toast)&&e.undo&&e.add,T+`Confirm saves it, the sheet closes, back on Add, a toast "${e.toast}" with Undo`);
  const sid=await ev(()=>items[items.length-1].id);
  await tap('#toast button');await p.waitForFunction(id=>!items.some(i=>i.id===id),sid);
  ok(true,T+'Undo takes it out again');
  await ev(()=>{queue.length=0;renderAdd()});
  await change();await tap('#nps-bar .pri');await p.waitForFunction(n0=>!npsId&&items.length===n0+1,n0,{timeout:8000}).catch(()=>{});
  await ev(()=>show('wardrobe'));await settle(p,400);
  e=await ev(()=>({n:items.length,tile:document.querySelectorAll('#wardrobe .gi').length}));
  ok(e.n===n0+1&&e.tile>=1&&await ev(()=>{const it=items[items.length-1];return !!document.querySelector(`#wardrobe .gi[data-id="${it.id}"],#wardrobe [onclick*="${it.id}"]`)}),T+`the saved piece is in the Wardrobe (${JSON.stringify(e)})`);
  await ev(()=>openAdd());await settle(p,300);

  // ---- the import sheet: from below, ×, Cancel, swipe, Back; importing closes it with "Imported N items." and Undo
  r=await rise('#kitsheet',()=>p.click('#add-import'));
  e=await ev(()=>{const s=document.querySelector('#kitsheet'),sr=s.getBoundingClientRect();return {top:sr.top,w:sr.width,left:sr.left,bottom:sr.bottom,grab:!!s.querySelector('.kit-grab'),icon:!!s.querySelector('.kit-head svg.kit-hic'),title:s.querySelector('#kit-title').textContent,
    bd:!!document.querySelector('#kit-backdrop.on'),body:/only Type and Color are needed/.test(s.querySelector('.kit-body').textContent.replace(/\s+/g,' ')),tpl:/Download a template/.test(s.textContent)&&/Choose a CSV file/.test(s.textContent)&&!!s.querySelector('#kit-paste')}});
  ok(await kitUp()&&r.first>r.end+40&&Math.abs(e.top-ivtop)<1&&Math.abs(e.bottom-h)<1.5,T+`"Import from a spreadsheet" slides up as a bottom sheet (top ${r.first} → ${r.end}, --ivtop ${ivtop})`);
  ok(e.grab&&e.icon&&e.title==='Import from a spreadsheet'&&e.bd&&e.body&&e.tpl,T+`with the grabber, the table icon, the backdrop, and today's content (${JSON.stringify(e)})`);
  if(WIDE)ok(Math.round(e.w)===640&&Math.abs(e.left-(w-640)/2)<1.5,T+`the import sheet is 640 px wide and centered (${Math.round(e.w)} px at ${Math.round(e.left)})`);
  await tap('#kitsheet .kit-x');ok(!await kitUp()&&await ev(()=>!document.querySelector('#kit-backdrop.on')&&!document.querySelector('#add').hidden),T+'× closes it, Add stays');
  await tap('#add-import');await tap('#kit-cancel');ok(!await kitUp(),T+'Cancel closes it');
  await tap('#add-import');g=await rect('#kitsheet');await swipe(g.left+g.w/2,g.top+9,g.top+9+g.h*.5);
  ok(!await kitUp()&&await ev(()=>!kit),T+'a swipe down on its header closes it');
  await tap('#add-import');await ev(()=>history.back());await p.waitForTimeout(150);await settle(p,400);
  ok(!await kitUp()&&await ev(()=>!document.querySelector('#add').hidden),T+"the phone's Back closes it and stays on Add");
  const m0=await ev(()=>items.length);
  await tap('#add-import');await p.fill('#kit-paste','Type,Color,Name\nTie,Burgundy,Sheet tie\nShirt,Light blue,Sheet shirt\nBelt,Dark brown,Sheet belt');await settle(p,300);
  ok(await p.textContent('#kit-imp')==='Add 3 items',T+'pasted rows: "Add 3 items"');
  await tap('#kit-imp');
  e=await ev(()=>({kit:!!kit,n:items.length,toast:document.querySelector('#toast').textContent,undo:!!document.querySelector('#toast.on button')}));
  ok(!e.kit&&e.n===m0+3&&/^Imported 3 items\./.test(e.toast)&&e.undo,T+`importing closes the sheet: "${e.toast}" with Undo`);
  await ev(()=>show('wardrobe'));await settle(p,300);
  ok(await ev(()=>['Sheet tie','Sheet shirt','Sheet belt'].every(n=>document.querySelector('#wardrobe').textContent.includes(n))),T+'the imported pieces are in the Wardrobe');
  await ev(()=>openAdd());await settle(p,300);

  // ---- the wide layout under a stand-in status bar (the unfolded foldable): both sheets start below it
  if(WIDE){const SAT=59;await ev(s=>document.documentElement.style.setProperty('--sat',s+'px'),SAT);
    await tap('#add-manual');let a=await rect('#nps-sheet');await tap('#nps-sheet .nps-x');
    await tap('#add-import');let b=await rect('#kitsheet');await tap('#kitsheet .kit-x');
    ok(a.top>=SAT+8&&b.top>=SAT+8,T+`under a ${SAT} px status bar both sheets start below it (${Math.round(a.top)}, ${Math.round(b.top)})`);
    await ev(()=>document.documentElement.style.removeProperty('--sat'))}
  ok(!errs.length,T+'no page errors ('+errs.join(' | ')+')');
  await ctx.close()}
