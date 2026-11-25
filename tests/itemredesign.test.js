// The checklist redesign of the item sheet and the Add card (2026-11-16, the owner's approved mockup compare-side.html, "2B Checklist"):
// sections with a status mark and a one-line summary that fold; the Add card's "N of M checked" pinned at the top of its scroll area the
// whole way down (over both columns from 600 px); the close-up beside the drawing, which a tap slides together (the same size, overlapping
// by half, the close-up on top and see-through on its overlapping half, a slider only while overlapped) and a second tap apart; no
// separate Close-up item (Texture match counts once there is a close-up, 4 → 5); the two close-up buttons before a close-up (the primary
// "Add close-up and read color, texture & material" with its cost over the outlined "Add close-up"); Confirm never blocked by unchecked
// parts; Back and a swipe closing one layer at a time. Chromium and WebKit, with touch; 390 light and 690 dark; the worker stubbed.
const fs=require('fs'),path=require('path');
const pic=f=>'data:image/jpeg;base64,'+fs.readFileSync(path.join(__dirname,'fixtures',f)).toString('base64');
module.exports=async({ok,chromium,engines,url,settle})=>{
  const PH=pic('suit-pinstripe.jpg'),TX=pic('walk-suit-pinstripe-closeup.jpg');
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{for(const [w,h,scheme] of [[390,844,'light'],[690,960,'dark']])await run(eng,browser,{ok,url,settle,w,h,scheme,PH,TX})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle,w,h,scheme,PH,TX}){
  const T=`${eng} ${w}px ${scheme}: `,H={'content-type':'application/json','access-control-allow-origin':'*'},WIDE=w>=600;
  const ctx=await browser.newContext({viewport:{width:w,height:h},colorScheme:scheme,hasTouch:true,isMobile:eng==='Chromium'&&!WIDE});
  await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify({id:'owner',role:'owner',caps:null,used:{}})});
    return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});   // no /sync, no /describe, no tagging: nothing paid
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const ev=(f,a)=>p.evaluate(f,a);
  await ev(([ph,tx])=>{HOOK.rememberRole({role:'owner'});settings.setupDone=1;
    // the cloth measured as navy, the drawing two steps lighter; white paper found in the close-up (tagging.js PAPER, as paperOf keeps it)
    items=[{id:'a',type:'suit',primaryColor:'navy',secondaryColor:'white',pattern:'pinstripe',photo:ph,texture:tx,material:'wool',season:'cold',shade:2,meas:{lab:labOf('navy'),ref:true,src:'closeup'},added:3},
      {id:'b',type:'pants',primaryColor:'charcoal',pattern:'solid',photo:ph,added:2},{id:'c',type:'shoes',primaryColor:'brown',added:1}];
    HOOK.PAPER[paperKey(items[0])]={ref:true,warm:false};
    cache={};queue.length=0;flt='all';editing=null;show('wardrobe')},[PH,TX]);
  await settle(p,400);
  const tap=async s=>{await p.click(s);await settle(p,450)};
  const rect=s=>ev(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,left:r.left,right:r.right,bottom:r.bottom,w:r.width,h:r.height}},s);
  const cdp=await ctx.newCDPSession(p);let clock=0;
  const TT=(type,x,y,ms=16)=>{clock=type==='touchStart'?Math.max(clock+ms,Date.now()):clock+ms;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}],timestamp:clock/1000})};
  const swipe=async(x,y0,y1,n=8,ms=16)=>{await TT('touchStart',x,y0);for(let k=1;k<=n;k++){await TT('touchMove',x,y0+(y1-y0)*k/n,ms);await p.waitForTimeout(ms)}await TT('touchEnd',x,y1);await settle(p,500)};
  let e;

  // ---- the item sheet: the summary, then the sections with their marks; Look & compare first and open
  await ev(()=>openItem('a'));await settle(p,600);
  await p.waitForFunction(()=>!!document.querySelector('#ivbody .cmpbar'),null,{timeout:4000}).catch(()=>{});
  e=await ev(()=>{const secs=[...document.querySelectorAll('#ivbody .cks')];return {ks:secs.map(s=>s.dataset.ck).join(','),
    marks:secs.map(s=>s.dataset.ck+':'+(s.querySelector('.ckm').className.match(/ck-(\w+)/)||[])[1]).join(','),open:secs.filter(s=>s.classList.contains('open')).map(s=>s.dataset.ck).join(','),
    sum:(document.querySelector('#ivct .ckt small')||{}).textContent,pills:[...document.querySelectorAll('.ivsum .ivpill')].map(x=>x.textContent).join('|'),
    labels:[...document.querySelectorAll('#ivbody .ckm')].every(m=>m.getAttribute('role')==='img'&&m.getAttribute('aria-label')),
    hdr:[...document.querySelectorAll('#ivbody .ckh')].every(b=>b.getBoundingClientRect().height>=44&&b.hasAttribute('aria-expanded')),
    line:(document.querySelector('#ivct .cmpmt')||{}).textContent,side:document.documentElement.scrollWidth<=innerWidth}});
  ok(e.ks==='look,color,pattern,material,details,care,names,pics'&&e.open==='look',T+`the item sheet is a checklist: Look & compare first and open, then Color, Pattern, Material, Details, Planning & care, Name & notes, Pictures, folded (${e.ks}; open ${e.open})`);
  ok(/look:warn/.test(e.marks)&&/color:good/.test(e.marks)&&/pics:opt/.test(e.marks)&&e.labels&&e.hdr,T+`each has a status mark (✓ done, ! worth a look, ○ optional) with a name for screen readers, and a 44 px header that says whether it is open (${e.marks})`);
  ok(/step/.test(e.sum)&&/^Drawn \d+ steps? lighter than the cloth$/.test(e.line)&&/In rotation/.test(e.pills)&&e.side,T+`Look & compare's summary and the match line say how far the drawing is off ("${e.sum}"; "${e.line}"; pills ${e.pills})`);
  await tap('#item-view [data-ck="details"] .ckh');
  e=await ev(()=>{const s=document.querySelector('#item-view [data-ck="details"]');return {open:s.classList.contains('open'),exp:s.querySelector('.ckh').getAttribute('aria-expanded'),vis:!!s.querySelector('select').offsetParent}});
  ok(e.open&&e.exp==='true'&&e.vis,T+`a tap on a section's header unfolds it (${JSON.stringify(e)})`);
  await tap('#item-view [data-ck="details"] .ckh');
  ok(await ev(()=>!document.querySelector('#item-view [data-ck="details"]').classList.contains('open')),T+'a second tap folds it again');

  // ---- the close-up beside the drawing: the same size and crop; a tap slides them together, half over, the close-up on top
  const sq=()=>ev(()=>{const R=s=>{const r=document.querySelector(s).getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,w:r.width,h:r.height}};
    const cu=R('#ivct .cmp-cu'),dw=R('#ivct .cmp-dw'),op=document.querySelector('#ivct .cmpop'),c=document.querySelector('#ivct .cmp-cu canvas'),x=c.getContext('2d'),W=c.width;
    const a=f=>x.getImageData(Math.floor(W*f),Math.floor(W/2),1,1).data[3];
    return {cu,dw,ov:document.querySelector('#ivct .cmpv').classList.contains('ovl'),z:[getComputedStyle(document.querySelector('#ivct .cmp-cu')).zIndex,getComputedStyle(document.querySelector('#ivct .cmp-dw')).zIndex],
      slider:!!op&&!op.hidden&&!!op.offsetParent,aL:a(.2),aR:a(.75),aEdge:a(.995),labels:[...document.querySelectorAll('#ivct .cmpl.tl,#ivct .cmpl.tr')].map(s=>s.textContent).join('|'),
      paper:!!document.querySelector('#ivct .cmp-cu .cmpl.ok'),pressed:document.querySelector('#ivct .cmp-cu').getAttribute('aria-pressed'),
      rad:getComputedStyle(document.querySelector('#ivct .cmp-cu')).borderTopRightRadius,shadow:getComputedStyle(document.querySelector('#ivct .cmp-cu')).boxShadow}});
  await p.waitForFunction(()=>{const c=document.querySelector('#ivct .cmp-cu canvas');return c&&c.width&&c.getContext('2d').getImageData(c.width>>1,c.width>>1,1,1).data[3]===255},null,{timeout:5000}).catch(()=>{});
  e=await sq();
  ok(!e.ov&&Math.abs(e.cu.w-e.dw.w)<1&&Math.abs(e.cu.h-e.cu.w)<1&&e.cu.r<=e.dw.l&&Math.abs(e.cu.t-e.dw.t)<1&&e.labels==='Close-up|Drawn'&&e.paper,T+`side by side: the close-up on the left, the drawing on the right, the same size, square, labeled "Close-up" and "Drawn", "White paper" on the close-up (${Math.round(e.cu.w)} / ${Math.round(e.dw.w)} px)`);
  ok(!e.slider&&e.aR===255,T+'apart, there is no slider and the close-up is solid');
  const w0=e.cu.w;
  await p.click('#ivct .cmp-cu');const moving=await ev(()=>document.querySelector('#ivct .cmp-cu').getAnimations().length);await settle(p,700);
  e=await sq();const over=e.cu.r-e.dw.l;
  ok(e.ov&&Math.abs(e.cu.w-w0)<1&&Math.abs(e.dw.w-w0)<1&&Math.abs(over-w0/2)<2&&e.pressed==='true',T+`a tap slides them together: the same size, overlapping by half (${Math.round(over)} of ${Math.round(w0)} px)`);
  ok(+e.z[0]>+e.z[1],T+`the close-up is on top (z ${e.z.join(' over ')})`);
  ok(e.aL===255&&e.aR>0&&e.aR<255&&e.aEdge<40,T+`the close-up's overlapping half is see-through (alpha ${e.aL} on its left, ${e.aR} across the overlap, ${e.aEdge} at its own edge), so the drawing shows through`);
  ok(e.rad==='0px'&&e.shadow==='none',T+`its inner corners go square, no shadow (${e.rad}, ${e.shadow})`);
  ok(e.slider,T+'the slider "Close-up ◀ ▶ Drawn" shows only while they overlap');
  if(eng==='Chromium')ok(moving>0,T+`they slide rather than jump (${moving} transitions)`);
  await ev(()=>{const i=document.querySelector('#ivct .cmpop input');i.value=90;i.dispatchEvent(new Event('input',{bubbles:true}))});const more=await sq();
  ok(more.aR<e.aR,T+`the slider sets how see-through it is (alpha ${e.aR} → ${more.aR} toward Drawn)`);
  await p.click('#ivct .cmpzi');await settle(p,200);
  ok(await ev(()=>{const t=document.querySelector('#ivct .cmpz');return !t.hidden&&t.textContent==='1.5×'}),T+'+ zooms both, the zoom shown on the drawing\'s corner');
  await p.click('#ivct .cmpzo');await settle(p,200);
  await p.click('#ivct .cmp-dw',{position:{x:Math.round(w0*.85),y:Math.round(w0/2)}});await settle(p,700);e=await sq();   // (its uncovered half: the close-up lies over the rest)
  ok(!e.ov&&e.cu.r<=e.dw.l&&!e.slider&&e.pressed==='false',T+'a second tap (on either) slides them apart and hides the slider');
  ok(await ev(()=>!document.querySelector('#ivbody .lens,#ivbody .loupe,#ivbody .cmphint')),T+'no lens and no hint text');
  // the state lasts through a redraw (an edit)
  await p.click('#ivct .cmp-cu');await settle(p,700);await ev(()=>renderWardrobe());await settle(p,300);
  ok((await sq()).ov,T+'an edit redraws the sheet with them still together');
  await p.click('#ivct .cmp-cu');await settle(p,600);

  // ---- Back and a swipe close one layer at a time
  await tap('#item-view [data-ck="color"] .ckh');await tap('#item-view .colbtn[data-k="primaryColor"]');
  ok(await ev(()=>!!colPick&&editing==='a'),T+'the color sheet opens over the item sheet');
  await ev(()=>history.back());await p.waitForTimeout(150);await settle(p,450);
  ok(await ev(()=>!colPick&&editing==='a'),T+'Back closes the color sheet only; the item sheet stays');
  const cu=await rect('#ivct .cmp-cu');
  await swipe(cu.left+cu.w/2,cu.top+10,cu.top+10+h*.4);
  ok(await ev(()=>editing==='a'),T+'a swipe down that starts on the pictures does not close the sheet');
  const hd=await rect('#ivhead');
  await swipe(hd.left+hd.w/2,hd.top+12,hd.top+12+h*.5);
  ok(await ev(()=>!editing),T+'a swipe down on the header closes it');
  await ev(()=>openItem('a'));await settle(p,500);await ev(()=>history.back());await p.waitForTimeout(150);await settle(p,450);
  ok(await ev(()=>!editing),T+'Back closes the item sheet');

  // ---- the Add card: before a close-up
  await ev(([ph])=>{openAdd();queue.length=0;
    queue.unshift({id:'q1',ai:true,type:'suit',primaryColor:'navy',secondaryColor:'white',tertiaryColor:null,pattern:'pinstripe',photo:ph,conf:{type:'high',primaryColor:'high',pattern:'medium'},altPattern:'chalk-stripe',aiTag:{pattern:'pinstripe'},material:'flannel',matAI:{key:'flannel',conf:'medium',why:'brushed nap'}});
    renderAdd()},[PH]);await settle(p,500);
  const card=()=>ev(()=>{const c=document.querySelector('#queue .qcard[data-q="q1"]');if(!c)return null;const secs=[...c.querySelectorAll('.cks')];
    return {ks:secs.map(s=>s.dataset.ck).join(','),titles:secs.map(s=>s.querySelector('.ckt b').textContent).join('|'),open:secs.filter(s=>s.classList.contains('open')).map(s=>s.dataset.ck).join(','),
      marks:secs.map(s=>s.dataset.ck+':'+(s.querySelector('.ckm').className.match(/ck-(\w+)/)||[])[1]).join(','),prog:c.querySelector('.ckprog b').textContent,
      left:(c.querySelector('.ckleft')||{}).textContent,conf:(c.querySelector('[id^="qconf-"]')||{}).disabled,
      progChild:c.querySelector('.ckprog').parentElement===c,sum:(c.querySelector('[data-ck="tex"] .ckt small')||{}).textContent}});
  e=await card();
  ok(e&&e.ks==='tex,type,colors,pattern,fabric,more'&&e.titles==='Texture match|Type|Colors|Pattern|Fabric & fit|More',T+`the Add card is a checklist: Texture match, Type, Colors, Pattern, Fabric & fit, More (${e&&e.titles})`);
  ok(e.prog==='0 of 4 checked'&&e.sum==='Not yet · add a close-up to compare'&&!/close-?up/i.test(e.ks.replace('tex','')),T+`before a close-up Texture match isn't counted, and there is no separate Close-up item ("${e.prog}"; "${e.sum}")`);
  ok(/pattern:warn/.test(e.marks)&&/type:todo/.test(e.marks)&&/fabric:ai/.test(e.marks)&&/tex:opt/.test(e.marks)&&e.open==='tex,pattern',T+`what Claude was unsure about gets "!" and opens first, Claude's material ✦ (${e.marks}; open ${e.open})`);
  e=await ev(()=>{const c=document.querySelector('#queue .qcard[data-q="q1"] [data-ck="tex"]'),a=c.querySelector('.ckreadadd'),b=c.querySelector('.ckadd'),cs=x=>getComputedStyle(x);
    return {order:!!a&&!!b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)>0&&a.getBoundingClientRect().bottom<=b.getBoundingClientRect().top+1,text:a&&a.querySelector('span').textContent,cost:a&&a.querySelector('.rdcost').textContent,
      pri:a&&a.classList.contains('pri')&&cs(a).backgroundColor===cs(document.querySelector('#queue [id^="qconf-"]')).backgroundColor,
      out:b&&cs(b).backgroundColor!==cs(a).backgroundColor&&cs(b).borderTopWidth!=='0px',btext:b&&b.textContent.trim(),steps:!!c.querySelector('.wbstcard'),h:[a,b].every(x=>x.getBoundingClientRect().height>=44)}});
  ok(e.order&&e.text==='Add close-up and read color, texture & material'&&/^About \d+¢$/.test(e.cost)&&e.btext==='Add close-up',T+`two buttons: "Add close-up and read color, texture & material · ${e.cost}" on top, "Add close-up" under it`);
  ok(e.pri&&e.out&&e.steps&&e.h,T+'the first in the primary style (as Confirm), the second outlined; True color in 3 steps above them; both 44 px or taller');
  e=await ev(()=>[...document.querySelectorAll('#queue [data-ck="pattern"] .ckpt')].map(t=>t.querySelector('b').textContent+'/'+t.querySelector('small').textContent+'/'+t.getAttribute('aria-checked')+'/'+!!t.querySelector('svg')).join('|'));
  ok(e==='Pinstripe/Claude’s pick/true/true|Chalk stripe/Claude’s 2nd/false/true',T+`Pattern shows Claude's pick and its second choice as drawn tiles (${e})`);
  ok((await card()).conf===false&&/^4 left to check · you can still confirm$/.test((await card()).left),T+'Confirm is not blocked by unchecked parts: "4 left to check · you can still confirm"');
  // Looks right: the section checked and folded, the next unchecked one opens; the count follows
  await tap('#queue [data-ck="pattern"] .cklr');e=await card();
  ok(e.prog==='1 of 4 checked'&&/pattern:good/.test(e.marks)&&!/pattern/.test(e.open)&&/^3 left/.test(e.left),T+`"Looks right" checks Pattern (✓), folds it and opens the next (${e.prog}; open ${e.open})`);
  ok(/type/.test(e.open),T+`the next unchecked part (Type) is the one open (${e.open})`);
  await p.selectOption('#queue [data-ck="type"] select','blazer');await settle(p,400);e=await card();
  ok(e.prog==='2 of 4 checked'&&/type:good/.test(e.marks),T+`a field changed by hand checks its section (${e.prog})`);
  await ev(()=>{const q=queue[0];q.type='suit';renderAdd()});await settle(p,200);

  // ---- the sticky progress: a direct child of the card, pinned at the top while the card scrolls under it (past its first column too)
  await ev(()=>{for(const s of document.querySelectorAll('#queue .qcard[data-q="q1"] .cks:not(.open) .ckh'))s.click()});await settle(p,300);
  e=await card();ok(e.progChild,T+'"N of M checked" is a direct child of the card (not inside a column)');
  const at=await ev(()=>{const R=s=>document.querySelector(s).getBoundingClientRect(),c=R('#queue .qcard[data-q="q1"]'),f=R('#queue .qcard[data-q="q1"] .ckcol');return {top:c.top+scrollY,end:c.bottom+scrollY,col:f.bottom+scrollY}});
  for(const [lab,y] of [['past the first section',at.top+500],['near the card\'s end',at.end-h*.6],...(WIDE?[['past the first column',at.col+40]]:[])]){
    await ev(y=>scrollTo(0,y),y);await settle(p,250);const b=await rect('#queue .qcard[data-q="q1"] .ckprog'),c2=await rect('#queue .qcard[data-q="q1"]');
    ok(c2.top<-20&&b.top>=0&&b.top<=10,T+`scrolled ${lab}, "N of M checked" stays pinned at the top (bar at ${Math.round(b.top)} px, card top ${Math.round(c2.top)})`)}
  const b=await rect('#queue .qcard[data-q="q1"] .ckprog'),cols=await rect('#queue .qcard[data-q="q1"] .ckcols');
  ok(b.left<=cols.left+1&&b.right>=cols.right-1,T+`the bar spans ${WIDE?'both columns':'the card'} (${Math.round(b.w)} px over ${Math.round(cols.w)} px)`);
  ok(await ev(()=>{const s=getComputedStyle(document.querySelector('#queue .ckprog'));return s.position==='sticky'&&s.boxShadow!=='none'}),T+'it has a soft shadow under it');
  if(WIDE)ok(await ev(()=>{const c=document.querySelectorAll('#queue .qcard[data-q="q1"] .ckcol');return c.length===2&&Math.abs(c[0].getBoundingClientRect().top-c[1].getBoundingClientRect().top)<2&&c[0].getBoundingClientRect().right<=c[1].getBoundingClientRect().left}),T+'from 600 px the card has two columns side by side');
  await ev(()=>scrollTo(0,0));

  // ---- with a close-up: Texture match counts (4 → 5), the comparison, Replace / Remove close-up under the paper line, Fine as is
  await ev(tx=>{const q=queue[0];q.checked={};q.texture=tx;q.meas={lab:[24,1,-12],ref:true,src:'closeup'};renderAdd()},TX);await settle(p,500);
  e=await card();
  ok(e.prog==='0 of 5 checked'&&!/closeup/.test(e.ks)&&/tex:(warn|todo)/.test(e.marks),T+`with a close-up Texture match is counted: "${e.prog}", still no separate Close-up item (${e.ks})`);
  e=await ev(()=>{const t=document.querySelector('#queue [data-ck="tex"]'),pos=s=>{const x=t.querySelector(s);return x?x.getBoundingClientRect().top:null};
    return {cmp:!!t.querySelector('.cmpw .cmp-cu')&&!!t.querySelector('.cmp-dw'),paper:pos('.cmpwb'),rep:pos('.ckcu'),read:!!t.querySelector('.ckread .rdgo'),fine:(t.querySelector('.cklr')||{}).textContent,
      match:(t.querySelector('.cmpgo')||{}).textContent,bar:!!t.querySelector('.cmpbar')}});
  ok(e.cmp&&e.bar&&e.match==='Match close-up'&&e.read&&e.fine==='Fine as is',T+'Texture match shows the comparison, the match bar with Match close-up, Read color and texture and "Fine as is"');
  ok(e.paper!==null&&e.rep!==null&&e.rep>e.paper,T+'Replace close-up (and Remove) sit under the white-paper line');
  await tap('#queue [data-ck="tex"] .cmpgo');e=await card();
  ok(/tex:good/.test(e.marks)&&e.prog==='1 of 5 checked'&&await ev(()=>!!document.querySelector('#queue [data-ck="tex"] .cmpundo')),T+'Match close-up checks Texture match and offers Undo');

  // ---- Confirm with parts unchecked saves the item
  const n0=await ev(()=>items.length);await tap('#queue .qcard[data-q="q1"] .ckfoot .pri');
  await p.waitForFunction(n=>items.length===n+1,n0,{timeout:5000}).catch(()=>{});
  ok(await ev(n=>items.length===n+1&&items.some(i=>i.id==='q1')&&!queue.length,n0),T+'Confirm saves the item with parts still unchecked');

  // ---- the no-photo sheet: its bar says what is left; the progress pinned in its scroll area; Back closes the sheet only
  await ev(()=>HOOK.addManual());await settle(p,500);
  e=await ev(()=>({left:(document.querySelector('#nps-bar .ckleft')||{}).textContent,conf:document.querySelector('#nps-bar .pri').disabled}));
  ok(/left to check · you can still confirm$/.test(e.left)&&e.conf===false,T+`the no-photo sheet's bar: "${e.left}" over an enabled Confirm`);
  await ev(()=>{for(const s of document.querySelectorAll('#nps-q .cks:not(.open) .ckh'))s.click();const b=document.querySelector('#nps-q');b.scrollTop=b.scrollHeight});await settle(p,250);
  const nb=await rect('#nps-q'),np=await rect('#nps-q .ckprog');
  ok(Math.abs(np.top-nb.top)<=6,T+`in the sheet, "N of M checked" stays at the top of its scroll area (${Math.round(np.top)} vs ${Math.round(nb.top)})`);
  await ev(()=>history.back());await p.waitForTimeout(150);await settle(p,450);
  ok(await ev(()=>!npsId&&!document.querySelector('#add').hidden),T+'Back closes the sheet and stays on Add');

  ok(errs.length===0,T+'no page errors ('+errs.join('; ')+')');
  await ctx.close();
}
