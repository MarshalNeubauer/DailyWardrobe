// "Read color and texture from close-up" (colpick.js rd*; closeup-reading-mockups variant A with the owner's changes, 2026-11-15), on
// a touch screen in Chromium and WebKit with the worker stubbed (no paid call): the editor's button in the Color & texture card, under
// "True color in 3 steps", is the page's button (height, radius, background, the card's width) and is labeled; with no close-up the close-up chooser comes first, then the reading;
// the request is what:'both' with the close-up and wb and no words; the result sheet shows the color and the pattern card; Use color,
// Keep, Use both and Undo (the card on the page and the toast) change exactly what they say; ΔE00 ≤ 3 puts "That's your X" first;
// the warm-light note with Retake; a tester sees "2 lookups · N of 40 left today" and can't start with 1 left; one half failing
// still shows the other; the Add card's second button sits to the right of Add close-up and runs chooser -> reading with no re-tag.
// The close-ups are the mink suit's test pictures (tests/fixtures/suit-mink*), scaled up, plain or with white paper drawn on.
const NEW={colour:{kind:'colour',match:'new',existing:'deeptaupe',dE:7.5,name:'mink brown',hex:'#4a4434',plansAs:'deeptaupe',fitsType:true,confidence:'high',why:'A warm gray-brown, darker than Deep taupe.',ask:null},
  pattern:{kind:'pattern',match:'new',existing:'twill',name:'steep fine twill',description:'Fine, steep diagonal ribs, tightly woven.',plansAs:'twill',
    look:{layout:'texture',tr:34,tex:{kind:'twill',grid:['1000','0100','0010','0001'],aspect:1,lighter:true,contrast:'subtle'}},colourHint:null,confidence:'high',why:'A steep twill.',ask:null},model:'stub',lookups:2};
const DUP={colour:{...NEW.colour,existing:'taupe',dE:2.8,name:'mink taupe',hex:'#584c41'},pattern:{...NEW.pattern,match:'existing',existing:'twill',name:'twill',look:{layout:'none',tr:10}},model:'stub',lookups:2};
const HALF={colour:NEW.colour,pattern:{error:'ai',detail:'failed',status:502},model:'stub',lookups:1};
module.exports=async({ok,chromium,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ',S={reply:NEW,me:{id:'owner',role:'owner',caps:null,used:{}},sent:[],other:[]};
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium'});
  const H={'content-type':'application/json','access-control-allow-origin':'*'};
  await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    if(u.pathname==='/describe'&&q.method()==='POST'){let b={};try{b=JSON.parse(q.postData()||'{}')}catch{}S.sent.push(b);const r=S.reply;
      return route.fulfill({status:r.status||200,headers:H,body:JSON.stringify(r.body||r)})}
    if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify(S.me)});
    if(q.method()==='POST'&&u.pathname!=='/sync')S.other.push(u.pathname);
    return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
  const F=await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
    const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
    const cv=(im,k,f)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);if(f)f(c,x);return c};
    const paper=(c,x)=>{x.fillStyle='#f4f3ef';x.fillRect(0,c.height*.8,c.width,c.height*.2)};
    const J=c=>c.toDataURL('image/jpeg',.9),f={plain:J(cv(ci,3)),paper:J(cv(ci,3,paper)),photo:J(cv(pi,1))};
    HOOK.rememberRole({role:'owner'});settings.custom={colors:[],patterns:[]};applyCustom(settings.custom);
    items=[{id:'m1',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:f.photo,texture:f.plain,added:1,name:'Mink suit'},
      {id:'m2',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:f.photo,added:2,name:'Bare suit'}];flt='all';editing=null;show('wardrobe');return f});
  const file=(name,u)=>({name,mimeType:'image/jpeg',buffer:Buffer.from(u.split(',')[1],'base64')});
  const item=id=>p.evaluate(id=>{const it=items.find(x=>x.id===id);return {c:it.primaryColor,p:it.pattern,cols:(settings.custom.colors||[]).length,pats:(settings.custom.patterns||[]).length}},id);
  const result=async()=>{await p.waitForSelector('#rd-sheet.on #rd-both');await settle(p,300)};
  const closed=async()=>{await p.waitForFunction(()=>!document.querySelector('#rd-sheet.on'));await settle(p,300)};
  const toast=()=>p.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');
  let e;
  // ---- the editor: the button in the Color & texture card (Edit photos option B), right under the 3 steps, a page button like Duplicate
  await p.evaluate(()=>openItem('m1'));await settle(p,400);
  e=await p.evaluate(()=>{const a=document.querySelector('#iv-dup'),b=document.querySelector('#iv-read'),st=document.querySelector('#ivct .wbsteps'),cd=document.querySelector('#ivct'),ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect(),rs=st.getBoundingClientRect(),rc=cd.getBoundingClientRect(),ca=getComputedStyle(a),cb=getComputedStyle(b);
    return {label:b.textContent,icon:!!b.querySelector('svg,img,i'),h:[Math.round(ra.height),Math.round(rb.height)],r:[ca.borderRadius,cb.borderRadius],bg:[ca.backgroundColor,cb.backgroundColor],
      border:[ca.borderTopColor,cb.borderTopColor],font:[ca.fontSize,cb.fontSize,ca.fontWeight,cb.fontWeight],gap:Math.round(rb.top-rs.bottom),full:Math.round(rc.width-rb.width),cost:(document.querySelector('.ivrd .rdcost')||{}).textContent}});
  ok(e.label==='Read color and texture from close-up'&&!e.icon,T+`the editor's button is labeled "${e.label}", with no icon`);
  ok(e.h[0]===e.h[1]&&e.h[1]>=44&&e.r[0]===e.r[1]&&e.bg[0]===e.bg[1]&&e.border[0]===e.border[1]&&e.font[0]===e.font[1]&&e.font[2]===e.font[3]&&e.full>=20&&e.full<=40,T+`it is the page's button: height, radius, background, border, font as Duplicate, the card's full width (${JSON.stringify(e)})`);
  ok(e.gap>=0&&e.gap<=16,T+`it sits directly under "True color in 3 steps" (${e.gap} px below)`);
  ok(/^About \d+¢$/.test(e.cost),T+`the owner sees the cents under it (${e.cost})`);
  // ---- a tap with a close-up: the reading, then both cards; nothing changes yet
  S.sent=[];await p.click('#iv-read');await result();
  const b0=S.sent[0]||{};
  ok(S.sent.length===1&&b0.what==='both'&&/^data:image\//.test(b0.closeup||'')&&typeof b0.wb==='boolean'&&!b0.text&&b0.type==='suit'&&b0.colours.main==='deeptaupe'&&b0.pattern==='solid',T+`one request: what 'both', the close-up and wb, no words (${JSON.stringify({...b0,closeup:(b0.closeup||'').slice(0,20)})})`);
  e=await p.evaluate(()=>{const s=document.querySelector('#rd-sheet'),q=x=>s.querySelector(x);return {col:q('#rd-col')&&q('#rd-col').textContent,pat:q('#rd-pat')&&q('#rd-pat').textContent,both:q('#rd-both').textContent,
    fig:!!q('.rdsrc .rddraw svg'),img:!!q('.rdsrc img'),role:s.getAttribute('role'),fit:s.getBoundingClientRect().right<=390,h:[...s.querySelectorAll('.rdbtns button,#rd-both')].map(b=>Math.round(b.getBoundingClientRect().height))}});
  ok(/Mink brown/.test(e.col)&&/#4A4434/.test(e.col)&&/Keep Deep taupe/.test(e.col)&&/Use Mink brown/.test(e.col)&&/Use adds Mink brown to your colors/.test(e.col),T+'the color card: Claude\'s shade, Keep Deep taupe / Use Mink brown');
  ok(/Steep fine twill/.test(e.pat)&&/Keep Solid/.test(e.pat)&&/Use Steep fine twill/.test(e.pat)&&/weave map/.test(e.pat),T+'the pattern & texture card: Claude\'s weave, Keep Solid / Use Steep fine twill');
  ok(e.both==='Use both'&&e.fig&&e.img&&e.role==='dialog'&&e.fit&&e.h.every(x=>x>=44),T+`"Use both" at the bottom, the close-up and the drawing at the top, buttons 44 px or taller (${e.h.join('/')})`);
  e=await item('m1');ok(e.c==='deeptaupe'&&e.p==='solid'&&!e.cols&&!e.pats,T+'nothing changes until a tap');
  // Use both, then Undo from the card on the page
  await p.click('#rd-both');await closed();
  e=await item('m1');const t1=await toast();
  ok(/^own/.test(e.c)&&/^own-/.test(e.p)&&e.cols===1&&e.pats===1,T+`Use both adds Mink brown and Steep fine twill and sets them (${JSON.stringify(e)})`);
  ok(/Color and texture updated\./.test(t1)&&/Undo/.test(t1),T+`the toast says so, with Undo (${t1})`);
  e=await p.evaluate(()=>{const d=document.querySelector('#item-view #rd-done');return d&&{t:d.textContent,h:Math.round(d.querySelector('#rd-undo').getBoundingClientRect().height),fig:!!d.querySelector('svg')}});
  ok(e&&/Mink brown and Steep fine twill set/.test(e.t)&&/Added to your colors and patterns/.test(e.t)&&e.h>=44&&e.fig,T+`a card under the button says what changed, with the new drawing and Undo (${e&&e.t})`);
  // (each step of the Undo is a save of its own; on WebKit each save takes a while: wait for all of them)
  await p.click('#rd-undo');await p.waitForFunction(()=>{const it=items.find(x=>x.id==='m1');return it.primaryColor==='deeptaupe'&&it.pattern==='solid'&&!(settings.custom.colors||[]).length&&!(settings.custom.patterns||[]).length&&!document.querySelector('#rd-done')},null,{timeout:5000}).catch(()=>{});await settle(p,200);
  e=await item('m1');ok(e.c==='deeptaupe'&&e.p==='solid'&&!e.cols&&!e.pats&&!(await p.$('#rd-done')),T+'Undo puts the color and pattern back and takes out what the reading added '+JSON.stringify(e));
  // Use color only, Keep the pattern, Undo from the toast
  await p.click('#iv-read');await result();
  await p.click('#rd-cuse');await p.waitForSelector('#rd-col.done');
  e=await p.evaluate(()=>({on:!!document.querySelector('#rd-sheet.on'),col:document.querySelector('#rd-col').textContent,both:document.querySelector('#rd-both').textContent}));
  ok(e.on&&/Mink brown set/.test(e.col)&&e.both==='Use Steep fine twill',T+`Use on the color card sets it; the sheet stays for the pattern (${e.both})`);
  await p.click('#rd-pkeep');await closed();
  e=await item('m1');const t2=await toast();
  ok(/^own/.test(e.c)&&e.p==='solid'&&e.cols===1&&!e.pats&&/Color updated\./.test(t2),T+`Keep leaves the pattern as it was; the toast says "Color updated." (${t2})`);
  await p.click('#toast button');await p.waitForFunction(()=>items.find(x=>x.id==='m1').primaryColor==='deeptaupe');await settle(p,200);
  e=await item('m1');ok(e.c==='deeptaupe'&&!e.cols,T+'the toast\'s Undo puts the color back');
  // Keep both: nothing changes, no toast with Undo
  await p.click('#iv-read');await result();await p.click('#rd-ckeep');await p.click('#rd-pkeep');await closed();
  e=await item('m1');ok(e.c==='deeptaupe'&&e.p==='solid'&&!e.cols&&!e.pats,T+'Keep on both cards changes nothing');
  // ---- close to a color you have (ΔE00 2.8): "That's your Taupe" first; the twill you have
  S.reply=DUP;await p.click('#iv-read');await result();
  e=await p.evaluate(()=>({col:document.querySelector('#rd-col').textContent,use:(document.querySelector('#rd-cuse')||{}).textContent,alt:(document.querySelector('#rd-calt')||{}).textContent,pat:document.querySelector('#rd-pat').textContent,both:document.querySelector('#rd-both').textContent}));
  ok(/You have it/i.test(e.col)&&/That’s your Taupe/.test(e.col)&&/2\.8 ΔE/.test(e.col)&&e.use==='Use Taupe'&&e.alt==='Add Mink taupe as a new color instead',T+`ΔE ≤ 3: "That's your Taupe" and Use Taupe first, adding Claude's as a link (${e.use} / ${e.alt})`);
  ok(/That’s Twill/.test(e.pat)&&/Use Twill/.test(e.pat)&&!/Use adds/.test(e.pat),T+'the pattern Claude says you have: "That\'s Twill", Use Twill');
  await p.click('#rd-both');await closed();
  e=await item('m1');ok(e.c==='taupe'&&e.p==='twill'&&!e.cols&&!e.pats,T+`Use both sets your Taupe and Twill, adding nothing (${JSON.stringify(e)})`);
  await p.click('#rd-undo');await p.waitForFunction(()=>items.find(x=>x.id==='m1').primaryColor==='deeptaupe');await settle(p,200);
  // ---- warm light, no paper: the note with Retake; the paper line
  S.reply=NEW;await p.evaluate(()=>{HOOK.PAPER[paperKey(items.find(x=>x.id==='m1'))]={ref:false,warm:true}});
  S.sent=[];await p.click('#iv-read');await result();
  e=await p.evaluate(()=>{const w=document.querySelector('#rd-warm');return {w:w&&w.textContent,retake:!!(w&&w.querySelector('.wbretake')),paper:(document.querySelector('#rd-paper')||{}).textContent,pat:document.querySelector('#rd-pat').textContent}});
  ok(S.sent[0]&&S.sent[0].wb===false&&/Taken in warm light — the color may be yellower than the cloth/.test(e.w)&&e.retake&&/No white paper, warm light/.test(e.paper),T+`no paper in warm light: the color card's note with Retake close-up, and the paper line (${e.paper})`);
  ok(/weave reads fine without it/.test(e.pat),T+'the texture card says the weave reads fine without paper');
  await p.click('#rd-warm .wbretake');await p.waitForSelector('#cu-sheet.on');
  ok(await p.evaluate(()=>document.querySelector('#cu-title').textContent==='Retake close-up'),T+'Retake close-up opens the chooser over the sheet');
  await p.click('#cu-cancel');await p.waitForFunction(()=>!document.querySelector('#cu-sheet.on'));
  await p.keyboard.press('Escape');await closed();
  ok(await p.evaluate(()=>editing==='m1'&&!!document.querySelector('#item-view.on')),T+'Escape closes only the reading sheet; the item stays open');
  // ---- one half failing: the other still shows
  S.reply=HALF;await p.click('#iv-read');await result();
  e=await p.evaluate(()=>({pat:document.querySelector('#rd-pat').textContent,col:!!document.querySelector('#rd-cuse'),both:document.querySelector('#rd-both').textContent}));
  ok(/Claude couldn’t read the weave this time/.test(e.pat)&&e.col&&e.both==='Use Mink brown',T+`the pattern half failed: its card says so, the color card stays usable (${e.both})`);
  await p.click('#rdx, #rd-sheet .rdx');await closed();
  // ---- an item with no close-up: the chooser first, then the reading
  S.reply=NEW;await p.evaluate(()=>openItem('m2'));await settle(p,400);
  S.sent=[];await p.click('#iv-read');await p.waitForSelector('#cu-sheet.on');
  e=await p.evaluate(()=>({t:document.querySelector('#cu-title').textContent,s:document.querySelector('#cu-sub').textContent,rd:!!document.querySelector('#rd-sheet.on')}));
  ok(e.t==='Close-up for Claude'&&/reads the color and the weave/.test(e.s)&&!e.rd&&!S.sent.length,T+`no close-up: the close-up chooser comes first ("${e.t}"), nothing asked yet`);
  await (await p.$('#cu-lib')).setInputFiles(file('paper.jpg',F.paper));await result();
  e=await p.evaluate(()=>({tex:!!items.find(x=>x.id==='m2').texture,paper:(document.querySelector('#rd-paper')||{}).textContent}));
  ok(e.tex&&S.sent.length===1&&S.sent[0].wb===true&&/White paper found/.test(e.paper),T+`the close-up is kept and read at once, white-balanced from its paper (wb true; ${e.paper})`);
  await p.click('#rd-sheet .rdx');await closed();
  // ---- a tester: 2 lookups, what is left; with 1 left the button can't start
  await p.evaluate(()=>{acct.me={id:'tess',role:'tester',caps:{describe:40},used:{describe:2}};renderWardrobe()});await settle(p,200);
  e=await p.evaluate(()=>document.querySelector('.ivrd .rdcost').textContent);
  ok(e==='2 lookups · 38 of 40 left today',T+`a tester sees "${e}" (no cents)`);
  await p.click('#iv-read');await result();await p.click('#rd-sheet .rdx');await closed();
  e=await p.evaluate(()=>({used:acct.me.used.describe,cost:document.querySelector('.ivrd .rdcost').textContent}));
  ok(e.used===4&&e.cost==='2 lookups · 36 of 40 left today',T+`a reading counts 2 of the tester's lookups (${e.cost})`);
  await p.evaluate(()=>{acct.me.used.describe=39;renderWardrobe()});await settle(p,200);S.sent=[];
  e=await p.evaluate(()=>document.querySelector('#iv-read').getAttribute('aria-disabled'));
  await p.click('#iv-read',{force:true});await settle(p,200);const t3=await toast();   // (aria-disabled: still tappable, it says why)
  ok(e==='true'&&!S.sent.length&&/takes 2 lookups and you have 1 left today/.test(t3)&&!(await p.$('#rd-sheet.on')),T+`with 1 left the button is grayed and says why, nothing asked (${t3})`);
  await p.evaluate(()=>{acct.me={id:'owner',role:'owner',caps:null,used:{}};HOOK.closeItem&&HOOK.closeItem()});await settle(p,300);
  // ---- the Add card (the checklist redesign, 2026-11-16): in Texture match, "Add close-up and read color, texture & material" (primary,
  // its cost inside) over the outlined "Add close-up"; chooser -> reading, with no re-tag
  await p.evaluate(F=>{openAdd();HOOK.addManual();const q=queue[0];q.type='suit';q.primaryColor='deeptaupe';q.pattern='solid';q.tagImg=F.photo;renderAdd()},F);await settle(p,300);
  for(const theme of ['light','dark']){await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);await settle(p,100);
    e=await p.evaluate(()=>{const s=document.querySelector('#nps-q [data-ck="tex"]'),a=s.querySelector('.ckadd.cubtn'),b=s.querySelector('.ckreadadd'),ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect(),ca=getComputedStyle(a),cb=getComputedStyle(b);
      return {a:a.textContent,b:b.querySelector('span').textContent,cost:b.querySelector('.rdcost').textContent,above:rb.bottom<=ra.top+1,h:[Math.round(ra.height),Math.round(rb.height)],r:[ca.borderRadius,cb.borderRadius],in:rb.right<=s.getBoundingClientRect().right+1,fit:document.documentElement.scrollWidth<=390,bg:[ca.backgroundColor,cb.backgroundColor],ink:cb.color}});
    ok(e.a==='Add close-up'&&e.b==='Add close-up and read color, texture & material'&&/^About \d+¢$/.test(e.cost)&&e.above&&e.in&&e.fit,T+`${theme}: "Add close-up and read color, texture & material" (${e.cost}) sits over Add close-up, inside the card at 390 px (${JSON.stringify(e)})`);
    ok(e.h.every(x=>x>=44)&&e.r[0]===e.r[1]&&e.bg[1]!==e.ink&&e.bg[0]!==e.bg[1],T+`${theme}: both 44 px or taller, the same shape, the read one filled and Add close-up plain (${e.h.join('/')}, ${e.r.join('/')})`)}
  await p.evaluate(()=>{delete document.documentElement.dataset.theme});
  S.sent=[];S.other=[];await p.click('#nps-q [data-ck="tex"] .ckreadadd');await p.waitForSelector('#cu-sheet.on');
  ok(await p.evaluate(()=>document.querySelector('#cu-title').textContent==='Close-up for Claude'),T+'the Add card\'s read button opens the chooser first');
  await (await p.$('#cu-take')).setInputFiles(file('add.jpg',F.paper));await result();
  e=await p.evaluate(()=>({tex:!!queue[0].texture,refining:!!queue[0].refining}));
  ok(e.tex&&!e.refining&&S.sent.length===1&&!S.other.length,T+`the close-up is added and read, with no automatic re-tag (other requests: ${S.other.join(',')||'none'})`);
  await p.click('#rd-both');await closed();
  e=await p.evaluate(()=>({c:queue[0].primaryColor,p:queue[0].pattern,done:(document.querySelector('#nps-q #rd-done')||{}).textContent||'',read:(document.querySelector('#nps-q .cktexon .ckread .rdgo')||{}).textContent}));
  ok(/^own/.test(e.c)&&/^own-/.test(e.p)&&/set/.test(e.done)&&e.read==='Read color and texture',T+`Use both on the Add card sets both; the card shows what changed, and offers "Read color and texture" under Replace close-up (${e.read})`);
  await p.click('#nps-q #rd-undo');await p.waitForFunction(()=>queue[0].primaryColor==='deeptaupe');
  ok(await p.evaluate(()=>queue[0].pattern==='solid'&&!(settings.custom.colors||[]).length),T+'Undo on the Add card puts both back');
  // the plain Replace close-up still re-tags (the control: the skip is only for the read button)
  S.other=[];await p.click('#nps-q .cktexon .ckcu .cubtn');await p.waitForSelector('#cu-sheet.on');
  await (await p.$('#cu-lib')).setInputFiles(file('rep.jpg',F.plain));await p.waitForFunction(()=>!queue[0].refining);await settle(p,300);
  ok(S.other.length>0,T+`Replace close-up (not the read button) still asks for the re-tag (${S.other.join(',')})`);
  ok(!errs.length,T+'no page errors ('+errs.join(' | ')+')');
  await ctx.close()}
