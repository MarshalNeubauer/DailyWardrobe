// "+ New colour" and "+ New pattern or texture" (colpick.js openColNew / openPatNew; the owner's approved design, 2026-11-15): the picker's
// "Your colours" / "Your patterns" groups and their + tiles, both sheets in every state with the worker's /describe mocked (no paid call):
// the square, hue and hex in step, busy, Claude's answer, the reuse thresholds, an error, an unclear answer, a pattern described as a colour,
// a tester's lookups left and limit, not connected; adding lands in settings.custom with its base and exact shade (a pattern with its look)
// and shows in "Your colours" and in its family; the Add card's offers open the sheet (the inline forms are gone); Settings' buttons; the
// look drawn on a blazer and following the item's colour; the close-up option; Escape; 390 px in both themes without sideways scroll.
module.exports=async({ok,chromium,url,settle})=>{
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
    await p.evaluate(()=>{rememberRole({role:'owner'});items=[{id:'t1',type:'tie',primaryColor:'navy',pattern:'solid',added:1},{id:'t2',type:'tie',primaryColor:'red',pattern:'solid',added:2},
      {id:'s1',type:'suit',primaryColor:'grey',pattern:'solid',added:3},{id:'b1',type:'blazer',primaryColor:'navy',pattern:'solid',added:4}]});
    // ---- the picker's entry tile
    await p.evaluate(()=>openColPick('e','t1','primaryColor'));
    let e=await p.evaluate(()=>({heads:[...document.querySelectorAll('#col-sheet .cph')].map(h=>h.textContent),tile:!!document.querySelector('#col-sheet .cnown #cn-open'),first:document.querySelector('#col-sheet .cph').textContent}));
    ok(e.first==='Your colors'&&e.tile,'the color picker starts with "Your colors" and a "+ New color" tile ('+e.heads.slice(0,3)+')');
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
      closeColPick();openColPick('e','s1','primaryColor');r.suit=!!document.querySelector('#col-sheet .cptile[data-c="ownfadedburgundy"]');closeColPick();return r});
    ok(e.c&&e.c.base==='wine'&&e.c.hex==='#7a3b47'&&e.c.types.join()==='tie'&&!e.c.accent,'"Add … and use it" adds it to settings.custom with its base and exact shade, for ties ('+JSON.stringify(e.c)+')');
    ok(e.own===1&&e.fam===1&&!e.suit,'it shows under "Your colors" and in its color family on another tie, and not on a suit');
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
    await p.evaluate(()=>{rememberRole({role:'tester'});acct.me={role:'tester',caps:{describe:40},used:{describe:39}};openColPick('e','t1','primaryColor')});await p.click('#cn-open');
    ok(await p.evaluate(()=>document.querySelector('#cn-cost').textContent==='1 of 40 lookups left today'&&!/¢/.test(document.querySelector('#col-sheet').textContent)),'a tester sees the lookups left today, no cost');
    reply=()=>[429,{error:'limit',what:'describe',message:'Today’s limit of 40 color and pattern lookups is used up. It starts again at midnight UTC.'}];
    await p.fill('#cn-text','faded burgundy');await p.click('#cn-ask');await p.waitForSelector('#col-sheet .cnlim');
    ok(/Today’s limit of 40 color and pattern lookups is used up/.test(await p.textContent('#col-sheet .cnlim'))&&await p.evaluate(()=>document.querySelector('#cn-ask').disabled&&!!document.querySelector('#cn-sq')),'over the limit: the server\'s sentence, Ask off, the shade picker still there');
    ok(await p.evaluate(()=>!/worker|Cloudflare|KV|token/i.test(document.querySelector('#col-sheet').textContent)),'no worker, Cloudflare, KV or token in what a tester reads');
    await p.evaluate(()=>{closeColPick();acct.me={role:'tester',caps:{describe:40},used:{describe:40}};openColPick('e','t1','primaryColor')});await p.click('#cn-open');
    ok(await p.evaluate(()=>document.querySelector('#cn-ask').disabled&&/0 of 40/.test(document.querySelector('#cn-cost').textContent)&&!!document.querySelector('#col-sheet .cnlim')),'with none left, Ask is off before asking');
    await p.evaluate(()=>{closeColPick();rememberRole({role:'owner'});acct.me=null;localStorage.removeItem('worker_url');openColPick('e','t1','primaryColor')});await p.click('#cn-open');
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
