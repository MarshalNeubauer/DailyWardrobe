// The color picker: new colors and the live drag.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const {pace}=require('./pace');

/* ---- was tests/colnew.test.js ---- */
// "+ New colour" and "+ New pattern or texture" (colpick.js openColNew / openPatNew; the owner's approved design, 2026-11-15): the picker's
// "Your colours" / "Your patterns" groups and their + tiles, both sheets in every state with the worker's /describe mocked (no paid call):
// the square, hue and hex in step, busy, Claude's answer, the reuse thresholds, an error, an unclear answer, a pattern described as a colour,
// a tester's lookups left and limit, not connected; adding lands in settings.custom with its base and exact shade (a pattern with its look)
// and shows in "Your colours" and in its family; the Add card's offers open the sheet (the inline forms are gone); Settings' buttons; the
// look drawn on a blazer and following the item's colour; the close-up option; Escape; 390 px in both themes without sideways scroll.
const colnew=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  let reply=()=>[200,{}],bodies=[],hold=null;
  await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());
    if(u.pathname==='/describe'){const b=JSON.parse(q.postData()||'{}');bodies.push(b);if(hold)await hold;const [s,j]=reply(b);return route.fulfill({status:s,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:JSON.stringify(j)})}
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok')});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const COL={kind:'colour',match:'new',existing:'wine',dE:5.7,name:'faded burgundy',hex:'#7a3b47',plansAs:'wine',fitsType:true,confidence:'high',why:'A grayed, softer burgundy.',ask:null,model:'claude-sonnet-5-5'};
  const HOP={kind:'pattern',match:'new',existing:'nailhead',name:'hopsack',description:'A small basketweave, two threads over two.',plansAs:'nailhead',
    look:{layout:'texture',tr:70,tex:{kind:'basket',grid:['1100','1100','0011','0011'],aspect:1,lighter:true,contrast:'subtle'}},colourHint:null,confidence:'high',why:'A basket weave, plain from a few feet.',ask:null};
  const PANE={kind:'pattern',match:'new',existing:'windowpane',name:'tonal windowpane',description:'A windowpane a shade lighter than the cloth.',plansAs:'windowpane',
    look:{layout:'windowpane',tr:5,across:[['main',.95],['lighter',.05]],along:[['main',.95],['lighter',.05]]},colourHint:null,confidence:'high',why:'',ask:null};
  const sheet=()=>p.evaluate(()=>{const s=document.querySelector('#col-sheet');return {on:s.classList.contains('on'),title:(s.querySelector('#col-title')||{}).textContent,text:s.textContent,bar:(s.querySelector('.cpbar button')||{}).textContent,disabled:!!(s.querySelector('.cpbar button')||{}).disabled}});
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{HOOK.rememberRole({role:'owner'});items=[{id:'t1',type:'tie',primaryColor:'navy',pattern:'solid',added:1},{id:'t2',type:'tie',primaryColor:'red',pattern:'solid',added:2},
      {id:'s1',type:'suit',primaryColor:'grey',pattern:'solid',added:3},{id:'b1',type:'blazer',primaryColor:'navy',pattern:'solid',added:4}]});
    // ---- the picker's entry tile
    await p.evaluate(()=>openColPick('e','t1','primaryColor'));
    let e=await p.evaluate(()=>({heads:[...document.querySelectorAll('#col-sheet .cph')].map(h=>h.textContent),tile:!!document.querySelector('#col-sheet .cnown #cn-open'),first:document.querySelector('#col-sheet .cph').textContent}));
    ok(e.first==='Your colors'&&e.tile,'the color picker starts with "Your colors" and its "+ New color" (a slim line while there are none of your own) ('+e.heads.slice(0,3)+')');
    await p.click('#cn-open');
    let s=await sheet();
    ok(s.title==='New color'&&/Describe it to Claude/.test(s.text)&&/Or pick the shade/.test(s.text)&&s.disabled&&s.bar==='Add color','"+ New color" opens the sheet: describe box, the shade picker, the Add button off until it has a name');
    ok(await p.evaluate(()=>/About \d+¢/.test(document.querySelector('#cn-cost').textContent)),'the owner sees the lookup\'s cost');
    // the square, the hue bar and the hex field in step
    await p.fill('#cn-hex','#336699');await p.dispatchEvent('#cn-hex','change');
    e=await p.evaluate(()=>{const n=colPick.newc,th=document.querySelector('#cn-sq .cnthumb');return {h:Math.round(n.h),hex:n.hex,left:th.style.left,big:document.querySelector('#col-sheet .cpbig').style.background}});
    ok(e.h===210&&e.hex==='#336699'&&e.left==='66.7%'&&/51, 102, 153/.test(e.big),`a hex typed moves the square and the hue bar (${JSON.stringify(e)})`);
    let box=await p.locator('#cn-sq').boundingBox();await p.mouse.move(box.x+box.width*.25,box.y+box.height*.25);await p.mouse.down();await p.mouse.move(box.x+box.width*.9,box.y+box.height*.1,{steps:3});
    const mid=await p.evaluate(()=>({hex:colPick.newc.hex,field:document.querySelector('#cn-hex').value}));await p.mouse.up();await settle(p,100);
    e=await p.evaluate(()=>({hex:colPick.newc.hex,field:document.querySelector('#cn-hex').value,s:Math.round(colPick.newc.s),v:Math.round(colPick.newc.v)}));
    ok(mid.field===mid.hex.toUpperCase()&&e.field===e.hex.toUpperCase()&&e.s===90&&e.v===90,`dragging the square changes the shade and the hex field together (${JSON.stringify(e)})`);
    box=await p.locator('#cn-hue').boundingBox();await p.mouse.click(box.x+box.width*.5,box.y+box.height/2);await settle(p,100);
    e=await p.evaluate(()=>({h:Math.round(colPick.newc.h),sq:document.querySelector('#cn-sq').style.getPropertyValue('--h')}));
    ok(Math.abs(e.h-180)<=2&&e.sq===String(e.h),`a tap on the hue bar turns the square's hue (${e.h})`);
    await p.focus('#cn-sq');const v0=await p.evaluate(()=>colPick.newc.v);await p.keyboard.press('ArrowDown');
    ok(await p.evaluate(v=>Math.round(colPick.newc.v)===Math.round(v-1)&&document.activeElement.id==='cn-sq',v0),'arrow keys move the square by one step and keep its focus');
    // ask Claude: busy, then the answer
    let release;hold=new Promise(r=>{release=r});reply=()=>[200,COL];
    await p.fill('#cn-text','  faded <burgundy> like old wine');const asked=p.click('#cn-ask');await p.waitForSelector('#col-sheet .cnbusy');
    ok(/Claude is finding the shade/.test(await p.textContent('#col-sheet .cnbusy')),'Ask shows that Claude is finding the shade');
    release();hold=null;await asked;await p.waitForSelector('#cn-res');
    const b0=bodies.at(-1);
    ok(b0.what==='colour'&&b0.type==='tie'&&b0.field==='primary'&&/faded\s+burgundy like old wine/.test(b0.text)&&!/[<>]/.test(b0.text)&&b0.colours.main==='navy'&&typeof b0.custom==='object','the request: what, the words (no < or >), the item\'s kind and color, the owner\'s colors');
    s=await sheet();
    ok(/Claude’s color/.test(s.text)&&/Faded burgundy/.test(s.text)&&/behaves like wine/.test(s.text)&&/a slight difference · ΔE 5\.7/.test(s.text)&&/Use Wine instead/.test(s.text)&&s.bar==='Add Faded burgundy and use it'&&!s.disabled,'the answer: Claude\'s color, what it behaves like, the nearest you have; a new color (ΔE 3-6, "new") is the default');
    ok(await p.evaluate(()=>colPick.newc.hex==='#7a3b47'&&document.querySelector('#cn-hex').value==='#7A3B47'&&document.querySelector('#cn-name').value==='Faded burgundy'&&document.querySelector('#cn-base').value==='wine'),'the answer fills the shade, the name and "behaves like"');
    await p.click('#cn-use');await settle(p,100);
    ok(await p.evaluate(()=>items.find(x=>x.id==='t1').primaryColor==='wine'&&!document.querySelector('#col-sheet').classList.contains('on')),'"Use Wine instead" sets wine');
    // add it
    await p.evaluate(()=>{openColPick('e','t1','primaryColor')});await p.click('#cn-open');await p.fill('#cn-text','faded burgundy');await p.click('#cn-ask');await p.waitForSelector('#cn-res');
    await p.click('#cn-add');await p.waitForFunction(()=>items.find(x=>x.id==='t1').primaryColor==='ownfadedburgundy');
    e=await p.evaluate(()=>{const c=settings.custom.colors.find(x=>x.key==='ownfadedburgundy');openColPick('e','t2','primaryColor');
      const r={c,own:[...document.querySelectorAll('#col-sheet .cnown .cptile[data-c="ownfadedburgundy"]')].length,fam:[...document.querySelectorAll('#col-sheet .cpgrid:not(.cnown):not(.cpai) .cptile[data-c="ownfadedburgundy"]')].length};
      closeColPick();openColPick('e','s1','primaryColor');const ts=[...document.querySelectorAll('#col-sheet .cptile[data-c="ownfadedburgundy"]')];r.suit=ts.some(b=>!b.closest('.cpother'));r.suitOther=ts.some(b=>b.closest('.cpother'));closeColPick();return r});
    ok(e.c&&e.c.base==='wine'&&e.c.hex==='#7a3b47'&&e.c.types.join()==='tie,pocketsquare'&&!e.c.accent,'"Add … and use it" adds it to settings.custom with its base and exact shade, for ties and pocket squares ('+JSON.stringify(e.c)+')');
    ok(e.own===1&&e.fam===1&&!e.suit&&e.suitOther,'it shows under "Your colors" and in its color family on another tie; on a suit only under "Your other colors"');
    // ΔE ≤ 3: "That's your …"
    reply=()=>[200,{...COL,name:'mushroom',hex:'#8f8273',existing:'taupe',dE:2.3,plansAs:'taupe',match:'existing'}];
    await p.evaluate(()=>{openColPick('e','s1','primaryColor')});await p.click('#cn-open');await p.fill('#cn-text','mushroom');await p.click('#cn-ask');await p.waitForSelector('#cn-res');
    s=await sheet();
    ok(/You already have it/.test(s.text)&&/That’s your taupe/.test(s.text)&&s.bar==='Use Taupe'&&/Add Mushroom anyway/.test(s.text),'ΔE00 ≤ 3: "That\'s your taupe", Use Taupe first, Add anyway second');
    // 3-6 and Claude says existing: use it first, add second
    reply=()=>[200,{...COL,name:'smoky lavender',hex:'#b9aec8',existing:'lavender',dE:5.4,plansAs:'lavender',match:'existing'}];
    await p.click('#cn-ask');await p.waitForFunction(()=>colPick.newc.res&&colPick.newc.res.dE===5.4);
    s=await sheet();ok(s.bar==='Use Lavender'&&/Add Smoky lavender anyway/.test(s.text),'ΔE 3-6 with Claude\'s "existing": the one you have first, the new one offered');
    // an error, an unclear answer, a pattern described here
    reply=()=>[502,{error:'ai',detail:'Claude API: overloaded'}];await p.click('#cn-ask');await p.waitForSelector('#cn-err');
    ok(/Claude couldn’t answer/.test(await p.textContent('#cn-err'))&&!!(await p.$('#cn-err button')),'an error shows its card with Try again');
    reply=()=>[200,{kind:'unclear',ask:'Try something like “silver gray”.'}];await p.click('#cn-err button');await p.waitForSelector('#cn-kind');
    ok(/That isn’t a color yet/.test(await p.textContent('#cn-kind'))&&/silver gray/.test(await p.textContent('#cn-kind')),'an unclear description says so, with Claude\'s example');
    reply=()=>[200,{kind:'pattern',ask:'That sounds like a pattern: add it under the pattern.'}];await p.fill('#cn-text','herringbone');await p.click('#cn-ask');await p.waitForSelector('#cn-kind button');
    await p.click('#cn-kind button');await settle(p,100);
    ok(await p.evaluate(()=>colPick&&colPick.k==='pattern'&&colPick.newc&&colPick.newc.kind==='pattern'&&document.querySelector('#cn-text').value==='herringbone'),'"That sounds like a pattern" → Open patterns takes the words to the new-pattern sheet');
    await p.evaluate(()=>closeColPick());
    // Escape: back to the list, then closed
    await p.evaluate(()=>openColPick('e','t1','primaryColor'));await p.click('#cn-open');await p.keyboard.press('Escape');
    e=await p.evaluate(()=>({on:document.querySelector('#col-sheet').classList.contains('on'),newc:!!colPick.newc}));await p.keyboard.press('Escape');
    ok(e.on&&!e.newc&&await p.evaluate(()=>!colPick&&!document.querySelector('#col-sheet').classList.contains('on')),'Escape on the new sheet goes back to the list first, then closes');
    // a tester: lookups left, the limit
    await p.evaluate(()=>{HOOK.rememberRole({role:'tester'});acct.me={role:'tester',caps:{describe:40},used:{describe:39}};openColPick('e','t1','primaryColor')});await p.click('#cn-open');
    ok(await p.evaluate(()=>document.querySelector('#cn-cost').textContent==='1 of 40 lookups left today'&&!/¢/.test(document.querySelector('#col-sheet').textContent)),'a tester sees the lookups left today, no cost');
    reply=()=>[429,{error:'limit',what:'describe',message:'Today’s limit of 40 color and pattern lookups is used up. It starts again at midnight UTC.'}];
    await p.fill('#cn-text','faded burgundy');await p.click('#cn-ask');await p.waitForSelector('#col-sheet .cnlim');
    ok(/Today’s limit of 40 color and pattern lookups is used up/.test(await p.textContent('#col-sheet .cnlim'))&&await p.evaluate(()=>document.querySelector('#cn-ask').disabled&&!!document.querySelector('#cn-sq')),'over the limit: the server\'s sentence, Ask off, the shade picker still there');
    ok(await p.evaluate(()=>!/worker|Cloudflare|KV|token/i.test(document.querySelector('#col-sheet').textContent)),'no worker, Cloudflare, KV or token in what a tester reads');
    await p.evaluate(()=>{closeColPick();acct.me={role:'tester',caps:{describe:40},used:{describe:40}};openColPick('e','t1','primaryColor')});await p.click('#cn-open');
    ok(await p.evaluate(()=>document.querySelector('#cn-ask').disabled&&/0 of 40/.test(document.querySelector('#cn-cost').textContent)&&!!document.querySelector('#col-sheet .cnlim')),'with none left, Ask is off before asking');
    await p.evaluate(()=>{closeColPick();HOOK.rememberRole({role:'owner'});acct.me=null;localStorage.removeItem('worker_url');openColPick('e','t1','primaryColor')});await p.click('#cn-open');
    ok(await p.evaluate(()=>document.querySelector('#cn-ask').disabled&&document.querySelector('#cn-cost').textContent===NEED_CONN),'not connected: Ask is off and says to connect');
    await p.evaluate(()=>{closeColPick();localStorage.setItem('worker_url','https://w.test/')});
    // ---- the pattern sheet: hopsack on a blazer
    await p.evaluate(()=>openColPick('e','b1','pattern'));
    ok(await p.evaluate(()=>[...document.querySelectorAll('#col-sheet .cph')].some(h=>h.textContent==='Your patterns')&&!!document.querySelector('#col-sheet .cnown #pn-open')),'the pattern picker has "Your patterns" with a "+ New pattern or texture" tile');
    await p.click('#pn-open');reply=()=>[200,HOP];await p.fill('#cn-text','a small basketweave like a hopsack');await p.click('#cn-ask');await p.waitForSelector('#cn-res');
    s=await sheet();
    ok(s.title==='New pattern or texture'&&/Claude’s pattern/.test(s.text)&&/plans like nailhead/.test(s.text)&&/counts as plain/.test(s.text)&&/Claude’s weave map \(4 × 4\)/.test(s.text)&&s.bar==='Add Hopsack and use it','the pattern answer: plans like nailhead, drawn from Claude\'s 4 × 4 weave map');
    ok(bodies.at(-1).what==='pattern'&&bodies.at(-1).type==='blazer'&&!bodies.at(-1).closeup,'the pattern request (no close-up for an item without one)');
    ok(await p.evaluate(()=>document.querySelectorAll('#col-sheet .cnbmp i').length===16&&/<image/.test(document.querySelector('#col-sheet .cppatbig').innerHTML)),'the weave map is shown and the blazer is drawn with its texture');
    await p.click('#cn-add');await p.waitForFunction(()=>items.find(x=>x.id==='b1').pattern==='own-hopsack');
    e=await p.evaluate(()=>{const b=items.find(x=>x.id==='b1'),pp=settings.custom.patterns.find(x=>x.key==='own-hopsack'),s=usableSett(b);
      return {pp,s:s&&{v:s.v,grid:s.tex&&s.tex.grid.join(),tr:s.tr,look:s.look},def:/<image/.test(fabricDef('zz',b,'top')),plan:patOf(b),suit:PATS_BY.suit.includes('own-hopsack')}});
    ok(e.pp&&e.pp.base==='nailhead'&&e.pp.look&&e.pp.look.tex.grid.join()==='1100,1100,0011,0011'&&e.pp.types.join()==='suit,blazer,pants'&&e.suit,'the pattern is added with its look, for suits, blazers and pants ('+JSON.stringify(e.pp&&e.pp.look)+')');
    ok(e.s&&e.s.v===4&&e.s.grid==='1100,1100,0011,0011'&&e.s.tr===70&&/^l/.test(e.s.look)&&e.def&&e.plan==='nailhead','the blazer draws the look\'s weave (a texture reading on a jacket) and plans as nailhead');
    // the tonal windowpane follows the item's colour
    reply=()=>[200,PANE];await p.evaluate(()=>openColPick('e','s1','pattern'));await p.click('#pn-open');await p.fill('#cn-text','tonal windowpane');await p.click('#cn-ask');await p.waitForSelector('#cn-res');await p.click('#cn-add');
    await p.waitForFunction(()=>items.find(x=>x.id==='s1').pattern==='own-tonal-windowpane');
    e=await p.evaluate(()=>{const it=items.find(x=>x.id==='s1'),a=usableSett(it),b=usableSett({...it,primaryColor:'navy'});return {a:a.bands.map(x=>x[0]),b:b.bands.map(x=>x[0]),cross:!!a.cross,ga:colOf(it),gb:colOf({...it,primaryColor:'navy'})}});
    ok(e.a[0]===e.ga&&e.b[0]===e.gb&&e.a[1]!==e.b[1]&&e.cross,`the tonal windowpane is drawn in the item's color and follows it (${e.a} → ${e.b})`);
    // a close-up: the option sends it; Claude says windowpane already names it
    await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=8;c.getContext('2d').fillStyle='#c8a';c.getContext('2d').fillRect(0,0,8,8);items.push({id:'b2',type:'blazer',primaryColor:'tan',pattern:'solid',texture:c.toDataURL('image/jpeg'),added:5});openColPick('e','b2','pattern')});
    await p.click('#pn-open');
    ok(await p.evaluate(()=>!!document.querySelector('#pn-close')&&/About \d+¢/.test(document.querySelector('#cn-cost').textContent)),'with a close-up the sheet offers "Also show Claude my close-up"');
    await p.click('#pn-close');ok(await p.evaluate(()=>/with the close-up/.test(document.querySelector('#cn-cost').textContent)&&document.querySelector('#pn-close').getAttribute('aria-checked')==='true'),'ticked, the cost says it includes the close-up');
    reply=()=>[200,{...PANE,match:'existing',existing:'windowpane',name:'windowpane',look:{layout:'none',tr:5}}];await p.fill('#cn-text','pale blue windowpane on a slubby tan linen');await p.click('#cn-ask');await p.waitForSelector('#cn-res');
    s=await sheet();
    ok(/^data:image\//.test(bodies.at(-1).closeup||'')&&s.bar==='Use Windowpane'&&/Add a new pattern anyway/.test(s.text),'the close-up is sent; a reuse answer offers "Use Windowpane" first');
    await p.click('#col-sheet .cpbar button');await settle(p,100);
    ok(await p.evaluate(()=>items.find(x=>x.id==='b2').pattern==='windowpane'),'"Use Windowpane" sets windowpane');
    ok(bodies.at(-1).wb===false,'the pattern request now says whether the close-up was corrected (no paper: wb false)');
    // ---- white paper in the close-up (photo-wb-mockups 07-10): the mink suit's close-up with a band of white paper drawn on, plain, or
    // warm-tinted with paper; a photo with a warm cast
    const F=await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
      const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
      const cv=(im,k,f)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);if(f)f(c,x);return c};
      const paper=(c,x)=>{x.fillStyle='#f4f3ef';x.fillRect(0,c.height*.8,c.width,c.height*.2)};
      const warm=(c,x)=>{const D=x.getImageData(0,0,c.width,c.height),d=D.data;for(let i=0;i<d.length;i+=4){d[i]=Math.min(255,d[i]*1.12);d[i+1]=Math.min(255,d[i+1]*1.02);d[i+2]=d[i+2]*.78}x.putImageData(D,0,0)};
      const J=c=>c.toDataURL('image/jpeg',.9),f={plain:J(cv(ci,3)),paper:J(cv(ci,3,paper)),warmPaper:J(cv(ci,3,(c,x)=>{paper(c,x);warm(c,x)})),photo:J(cv(pi,1)),warmPhoto:J(cv(pi,1,warm))};
      const S=(id,texture,photo)=>({id,type:'suit',primaryColor:'deeptaupe',pattern:'solid',texture,photo,added:9});
      items.push(S('mp',f.paper,f.photo),S('mw',f.plain,f.warmPhoto),S('mx',f.warmPaper,f.photo),S('mn',f.plain,f.photo));return f});
    const colSheet=async id=>{await p.evaluate(id=>{closeColPick();openColPick('e',id,'primaryColor')},id);await p.click('#cn-open');await p.waitForSelector('#cn-paper')};
    const pbox=()=>p.evaluate(()=>{const b=document.querySelector('#cn-close,#pn-close'),l=document.querySelector('#cn-paper');return {on:b&&b.getAttribute('aria-checked')==='true',line:l&&l.textContent,cls:l&&l.className,retake:!!(l&&l.querySelector('.wbretake input[type=file]')),cost:document.querySelector('#cn-cost').textContent}});
    const askCol=async(words,res=COL)=>{reply=()=>[200,res];const n=bodies.length;await p.fill('#cn-text',words);await p.click('#cn-ask');await p.waitForFunction(n=>colPick.newc&&colPick.newc.state!=='busy'&&!!document.querySelector('#cn-res'),n);return bodies.at(-1)};
    await colSheet('mp');e=await pbox();
    ok(e.on&&/\bok\b/.test(e.cls)&&e.line==='✓White paper found: Claude sees the true color.'&&/with the close-up/.test(e.cost),`a close-up with paper: the New colour sheet's "Also show Claude my close-up" starts ticked, "White paper found" under it (${JSON.stringify(e)})`);
    let b=await askCol('mink, a greyish brown');
    ok(/^data:image\/jpeg;base64,/.test(b.closeup||'')&&b.wb===true&&b.what==='colour','the colour request carries the close-up and wb:true');
    ok(await p.evaluate(()=>!document.querySelector('#cn-warm')),'no light note on the answer when the close-up had paper');
    await colSheet('mx');b=await askCol('mink');
    e=await p.evaluate(async([sent,id])=>{const it=items.find(x=>x.id===id),m=async u=>{const c=await HOOK.urlCanvas(u),d=c.getContext('2d').getImageData(0,0,c.width,Math.round(c.height*.7)).data;let r=0,bb=0;for(let i=0;i<d.length;i+=4){r+=d[i];bb+=d[i+2]}return bb/r};
      return {same:sent===it.texture,stored:+(await m(it.texture)).toFixed(3),sent:+(await m(sent)).toFixed(3)}},[b.closeup,'mx']);
    ok(b.wb===true&&!e.same&&e.sent>e.stored*1.1,`with paper the copy sent is white-balanced from it (the cloth's blue/red ${e.stored} stored → ${e.sent} sent), not the close-up as stored`);
    await colSheet('mw');e=await pbox();
    ok(!e.on&&/\bno\b/.test(e.cls)&&/^!No white paper, and the light looks warm: Claude may see it yellower\. Retake close-up$/.test(e.line)&&e.retake&&!/with the close-up/.test(e.cost),`no paper and a warm photo: the box starts unticked, the warm line with Retake close-up (${e.line})`);
    b=await askCol('mink');
    ok(!('closeup' in b)&&!('wb' in b),'box off: neither closeup nor wb is sent');
    ok(await p.evaluate(()=>!document.querySelector('#cn-warm')),'no light note when the close-up wasn\'t shown');
    await p.click('#cn-close');ok((await pbox()).on,'the box can be ticked');b=await askCol('mink');
    ok(/^data:image\//.test(b.closeup||'')&&b.wb===false,'ticked with no paper: the close-up goes as taken with wb:false');
    e=await p.evaluate(()=>{const w=document.querySelector('#cn-res .cnwarm');return w&&{t:w.textContent,retake:!!w.querySelector('.wbretake input')}});
    ok(e&&/Taken in warm light — the color may be yellower than the cloth; add white paper for a truer color\./.test(e.t)&&e.retake,'Claude\'s colour carries the warm-light note with Retake close-up');
    await colSheet('mn');e=await pbox();
    ok(!e.on&&/^!No white paper in this close-up: the color may be off\. Retake close-up$/.test(e.line),'no paper, light not warm: the plain "No white paper" line, nothing said about the light');
    await p.click('#cn-close');b=await askCol('mink');
    ok(b.wb===false&&await p.evaluate(()=>/No white paper in the close-up, so this shade is Claude’s best guess from the photo as taken\./.test(document.querySelector('#cn-warm').textContent)&&!document.querySelector('#cn-res .cnwarm')),'the answer then says the shade is Claude\'s best guess from the photo as taken');
    // Retake close-up from the sheet: the new close-up has paper, the box ticks itself and the line turns
    const buf=Buffer.from(F.paper.split(',')[1],'base64');await (await p.$('#cn-paper .wbretake input')).setInputFiles({name:'paper.jpg',mimeType:'image/jpeg',buffer:buf});
    await p.waitForFunction(()=>/White paper found/.test((document.querySelector('#cn-paper')||{}).textContent||''));
    ok((await pbox()).on,'Retake close-up on the sheet: the new close-up with paper ticks the box and says "White paper found"');
    // the pattern sheet shows the same reading; its box still starts unticked
    await p.evaluate(()=>{closeColPick();openColPick('e','mw','pattern')});await p.click('#pn-open');await p.waitForSelector('#cn-paper');e=await pbox();
    ok(!e.on&&e.line==='!No white paper: the weave reads fine, the colors may be off.','the pattern sheet\'s close-up option shows "No white paper: the weave reads fine, the colors may be off."');
    await p.click('#pn-close');b=await askCol('a fine twill',HOP);ok(/^data:image\//.test(b.closeup||'')&&b.wb===false,'the pattern request sends wb:false with a close-up without paper');
    await p.evaluate(()=>{closeColPick();openColPick('e','mp','pattern')});await p.click('#pn-open');await p.waitForSelector('#cn-paper');e=await pbox();
    ok(e.line==='✓White paper found: Claude sees the true colors.','with paper: "White paper found: Claude sees the true colors."');
    await p.click('#pn-close');b=await askCol('a fine twill',HOP);ok(b.wb===true,'and sends wb:true');
    for(const theme of ['light','dark']){await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);await colSheet('mw');await p.click('#cn-close');await askCol('mink');
      e=await p.evaluate(()=>{const s=document.querySelector('#col-sheet'),small=[...s.querySelectorAll('button,input:not(.vfile),select,textarea')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43.5).map(b=>b.id||b.className||b.tagName);
        return {w:s.scrollWidth<=s.clientWidth+1&&document.documentElement.scrollWidth<=390,small,warm:getComputedStyle(document.querySelector('.cnwarm')).backgroundColor}});
      ok(e.w&&!e.small.length&&e.warm!=='rgba(0, 0, 0, 0)',`${theme}: the box, the paper line and the warm note fit 390 px (${JSON.stringify(e)})`)}
    await p.evaluate(()=>{delete document.documentElement.dataset.theme;closeColPick()});
    // ---- Settings: the two buttons, a "For" choice, a colour by hand
    await p.evaluate(()=>openSettings('tagging'));
    ok(await p.evaluate(()=>!!document.querySelector('#custom-list #cust-newcol')&&!!document.querySelector('#custom-list #cust-newpat')&&!!document.querySelector('#custom-list .msw.pat svg')),'Settings → Your colors & patterns has "+ New color" and "+ New pattern", and draws each pattern with its look');
    await p.click('#cust-newcol');await p.selectOption('#cn-for','suit');
    await p.fill('#cn-hex','#9caf88');await p.dispatchEvent('#cn-hex','change');await p.fill('#cn-name','Sage');await p.dispatchEvent('#cn-name','change');
    s=await sheet();ok(s.bar==='Add Sage'&&/How the app uses it/.test(s.text),'from Settings: a "For" choice in place of an item, "Add Sage"');
    await p.click('#cn-add');await p.waitForFunction(()=>(settings.custom.colors||[]).some(c=>c.key==='ownsage')&&!document.querySelector('#col-sheet').classList.contains('on'));
    e=await p.evaluate(()=>({c:settings.custom.colors.find(c=>c.key==='ownsage'),row:[...document.querySelectorAll('#custom-list .custrow')].some(r=>/Sage/.test(r.textContent)),open:document.querySelector('#col-sheet').classList.contains('on')}));
    ok(e.c.types.join()==='suit,blazer,pants'&&e.c.hex==='#9caf88'&&['olive','khaki','green'].includes(e.c.base)&&e.row&&!e.open,'a color picked by hand is added for the chosen kind, behaving like a suit color of its family by default, and listed ('+JSON.stringify(e)+')');
    await p.click('#cust-newpat');ok(await p.evaluate(()=>colPick.newc.kind==='pattern'&&!!document.querySelector('#cn-for')),'Settings\' "+ New pattern" opens the pattern sheet with a "For" choice');
    await p.evaluate(()=>{closeColPick();closeSettings&&closeSettings()});
    // ---- the Add card: the offers open the sheet, the inline forms are gone
    ok(await p.evaluate(()=>typeof newColForm==='undefined'&&typeof newPatForm==='undefined'&&typeof colOwnHtml==='undefined'),'the Add card\'s inline forms and "A color of my own" are gone');
    // ---- 390 px, both themes, no sideways scroll; 44 px controls
    for(const theme of ['light','dark']){
      await p.evaluate(t=>{document.documentElement.dataset.theme=t;closeColPick();openColPick('e','t1','primaryColor')},theme);await p.click('#cn-open');reply=()=>[200,COL];await p.fill('#cn-text','faded burgundy');await p.click('#cn-ask');await p.waitForSelector('#cn-res');
      e=await p.evaluate(()=>{const s=document.querySelector('#col-sheet'),small=[...s.querySelectorAll('button,input,select,textarea')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43.5).map(b=>b.id||b.className||b.tagName);
        return {w:s.scrollWidth<=s.clientWidth+1&&document.documentElement.scrollWidth<=390,small,bg:getComputedStyle(s.querySelector('.cntext')).backgroundColor}});
      ok(e.w&&!e.small.length,`${theme}: the new-colour sheet fits 390 px with 44 px controls (${e.small})`);
      await p.evaluate(()=>{closeColPick();openColPick('e','b1','pattern')});await p.click('#pn-open');reply=()=>[200,HOP];await p.fill('#cn-text','hopsack');await p.click('#cn-ask');await p.waitForSelector('#cn-res');
      e=await p.evaluate(()=>{const s=document.querySelector('#col-sheet');return s.scrollWidth<=s.clientWidth+1&&document.documentElement.scrollWidth<=390});
      ok(e,`${theme}: the new-pattern sheet fits 390 px`)}
    await p.evaluate(()=>{delete document.documentElement.dataset.theme;closeColPick()});
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/colpicklive.test.js ---- */
// The New colour sheet's drawn item follows the finger (colpick.js cnLive → cnFigLive; the owner's ask, 2026-11-15: "as I move the colour
// around the suit updates live, not just when I lift my finger"): a drag in the square and along the hue bar with several moves and no
// lift recolours "Your suit, drawn" between steps, at most once a frame, with the big swatch and its hex; a hex typed recolours it before
// the field is left; the lift still draws the sheet again as before; nothing is fetched or saved while moving; the figure doesn't move;
// the redraw's cost (Chromium at 4× CPU throttling; WebKit with npm run test:webkit). The worker is stubbed (no paid call).
const colpicklive=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  let calls=0;
  await ctx.route('https://w.test/**',route=>{calls++;return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok')});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  // what the figure shows: its fills, the shade it was drawn in, where it sits
  const fig=()=>p.evaluate(()=>{const d=document.querySelector('#col-sheet .cpph.cpfig .cpdraw'),r=d.getBoundingClientRect();
    return {fills:[...d.querySelectorAll('[fill]')].map(e=>e.getAttribute('fill')).filter(f=>/^#/.test(f)).join(),hex:d.dataset.hex||null,cur:colPick.newc.hex,rgb:'rgb('+hexRgb(colPick.newc.hex).join(',')+')',
      big:document.querySelector('#col-sheet .cpbig').style.background,cap:document.querySelector('#col-sheet .cpbig figcaption').textContent,field:document.querySelector('#cn-hex').value,
      box:[r.x,r.y,r.width,r.height].map(Math.round).join(),y:document.querySelector('#col-sheet').scrollTop}});
  const frame=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{HOOK.rememberRole({role:'owner'});items=[{id:'s1',type:'suit',primaryColor:'grey',pattern:'solid',added:1}];openColPick('e','s1','primaryColor')});
    await p.click('#cn-open');
    ok(await p.evaluate(()=>/Your suit, drawn/.test(document.querySelector('#col-sheet .cpph figcaption').textContent)&&getComputedStyle(document.querySelector('#cn-sq')).touchAction==='none'&&getComputedStyle(document.querySelector('#cn-hue')).touchAction==='none'),
      'the sheet shows "Your suit, drawn"; the square and the hue bar don\'t scroll the sheet (touch-action none)');
    await p.evaluate(()=>{document.querySelector('#cn-sq').dataset.mark='1';let n=0;const cnt=r=>{for(const x of r)if(x.target.matches&&x.target.matches('.cpdraw'))n++},mo=new MutationObserver(cnt);mo.observe(document.querySelector('#col-sheet'),{childList:true,subtree:true});window.__draws=()=>{cnt(mo.takeRecords());return n}});   // a redraw is one replacement of the figure's contents (cnDrawn is called inside colpick.js, a module)
    const before=await fig();calls=0;
    // the square: down, four moves, no lift
    const box=await p.locator('#cn-sq').boundingBox(),steps=[[.2,.3],[.45,.25],[.7,.15],[.9,.1],[.55,.6]];
    await p.mouse.move(box.x+box.width*steps[0][0],box.y+box.height*steps[0][1]);await p.mouse.down();await frame();
    const seen=[await fig()];
    for(const [x,y] of steps.slice(1)){await p.mouse.move(box.x+box.width*x,box.y+box.height*y,{steps:4});await frame();seen.push(await fig())}
    const changed=seen.every((s,i)=>!i||s.fills!==seen[i-1].fills),follows=seen.every(s=>s.hex===s.cur&&s.fills.includes(s.cur)),diff=seen[0].fills!==before.fills;
    ok(diff&&changed&&follows,`dragging in the square recolours the drawn suit at every step, before the finger lifts (${seen.map(s=>s.cur).join(' → ')})`);
    ok(seen.every(s=>s.field===s.cur.toUpperCase()&&s.cap===s.cur.toUpperCase()&&s.big.replace(/\s/g,'')===s.rgb),'the big swatch, its hex label and the Hex field follow too');
    ok(seen.every(s=>s.box===before.box&&s.y===before.y),`the figure doesn't move or resize while dragging (${before.box})`);
    ok(await p.evaluate(()=>document.querySelector('#cn-sq').dataset.mark==='1'&&items[0].primaryColor==='grey'),'while moving the sheet isn\'t drawn again and nothing is saved');
    const draws=await p.evaluate(()=>window.__draws());
    ok(draws<=seen.length+4*(steps.length-1)&&draws>=seen.length-1,`one redraw a frame at most (${draws} redraws for ${1+4*(steps.length-1)} moves)`);
    // the lift: the sheet is drawn again as before, in the last shade
    const last=seen.at(-1).cur;await p.mouse.up();await settle(p,100);
    let e=await p.evaluate(()=>({mark:document.querySelector('#cn-sq').dataset.mark||null,hex:colPick.newc.hex,th:document.querySelector('#cn-sq .cnthumb').style.left,s:Math.round(colPick.newc.s),field:document.querySelector('#cn-hex').value,saved:items[0].primaryColor}));
    const after=await fig();
    ok(!e.mark&&e.hex===last&&e.field===last.toUpperCase()&&e.s===55&&after.fills.includes(last)&&e.saved==='grey','the lift draws the sheet again in the last shade, as before, still unsaved until Add');
    // the hue bar: three moves, no lift
    await p.evaluate(()=>document.querySelector('#cn-hue').scrollIntoView({block:'center'}));await frame();   // (on screen, not under the bottom bar: the sheet's grabber moved it down, 2026-11-15)
    const hb=await p.locator('#cn-hue').boundingBox(),hues=[];
    await p.mouse.move(hb.x+hb.width*.1,hb.y+hb.height/2);await p.mouse.down();await frame();hues.push(await fig());
    for(const x of [.35,.6,.85]){await p.mouse.move(hb.x+hb.width*x,hb.y+hb.height/2,{steps:3});await frame();hues.push(await fig())}
    ok(hues.every((s,i)=>(!i||s.fills!==hues[i-1].fills)&&s.fills.includes(s.cur)),`dragging the hue bar recolours the suit at every step (${hues.map(s=>s.cur).join(' → ')})`);
    // a burst of moves inside one frame (a 120 Hz screen, coalesced touches): one redraw, in the last shade
    e=await p.evaluate(async()=>{const el=document.querySelector('#cn-hue'),r=el.getBoundingClientRect(),n0=window.__draws();
      for(let i=0;i<10;i++)el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width*(.86-i*.02),clientY:r.top+r.height/2,pointerId:1}));
      await new Promise(f=>requestAnimationFrame(()=>requestAnimationFrame(f)));const d=document.querySelector('#col-sheet .cpph.cpfig .cpdraw');
      return {n:window.__draws()-n0,last:d.dataset.hex===colPick.newc.hex}});
    ok(e.n===1&&e.last,`ten moves in one frame redraw the suit once, in the last shade (${e.n})`);
    await p.mouse.up();await settle(p,100);
    // the hex field: typed, not yet left
    await p.fill('#cn-hex','#2a6e3f');await frame();const hx=await fig();
    ok(hx.cur==='#2a6e3f'&&hx.fills.includes('#2a6e3f')&&hx.cap==='#2A6E3F','a valid hex typed recolours the suit before the field is left');
    await p.fill('#cn-hex','#2a6e');await frame();
    ok((await fig()).fills.includes('#2a6e3f'),'a half-typed hex leaves the suit as it was');
    ok(calls===0,`nothing is fetched while moving or typing (${calls})`);
    // the cost of one redraw: the figure's drawing, put in and laid out (Chromium throttled 4×, as a slower phone)
    // the budget is the owner's PC's (12 ms) times how much slower this machine is right now (tests/pace.js, measured before throttling):
    // GitHub's 4-core runner took 19.7 ms against a flat 12 (CR-10-03)
    const k=await pace(p);
    let cdp=null;try{cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})}catch{cdp=null}
    const cost=await p.evaluate(async()=>{const d=document.querySelector('#col-sheet .cpph.cpfig .cpdraw'),it=colTarget(),t=[];
      for(let i=0;i<40;i++){const t0=performance.now();d.innerHTML=HOOK.cnDrawn(it,HOOK.cnFromHsv(i*9,60,55),'primaryColor');d.getBoundingClientRect();t.push(performance.now()-t0);await new Promise(r=>requestAnimationFrame(r))}
      t.sort((a,b)=>a-b);return {med:t[20],p90:t[36]}});
    if(cdp)await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    console.log(`    redraw per frame${cdp?' (4× CPU throttling)':''}: median ${cost.med.toFixed(1)} ms, 90th ${cost.p90.toFixed(1)} ms`);
    ok(cost.p90<12*k,`a redraw fits well inside a 60 fps frame (90th percentile ${cost.p90.toFixed(1)} ms, ${(12*k).toFixed(0)} allowed: 12 at this machine's pace ×${k.toFixed(2)})`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['colnew',colnew],['colpicklive',colpicklive]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
