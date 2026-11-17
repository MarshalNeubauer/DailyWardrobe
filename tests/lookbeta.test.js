// The New Look editor (beta, look.js; 2026-11-17, the owner's approved design C:\code\audit-2026-11-13\look-mockup\): the Settings switch
// (Photo tagging → Beta features, per phone, off by default, redraws what is open, loses nothing either way); the Look section on the Add
// card and in the item sheet for every type (Color, Pattern, Material rows; second and third colours following the pattern; the Pattern row
// dimmed where there is none; a belt's Buckle; a watch's Dial; a tie clip's Enamel and Metal); Claude's and the measurement's chips on the
// rows (Use, Undo, kept on the saved item until used or "Looks right"); the picker for every kind (Shade in the colour sheet, none for a
// metal; "+ New" works on the first real tap); Read with Claude (the worker mocked: no paid call) filling all three; a tie clip's planner
// input unchanged (plans compared); own materials shared by a group; the new fields kept by the record check; 390 and 320 px, light and
// dark, no sideways scroll; Chromium and WebKit.
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
const READ_SUIT={colour:{kind:'colour',match:'existing',existing:'charcoal',dE:2.1,name:'charcoal',hex:'#3b3f46',plansAs:'charcoal',fitsType:true,confidence:'high',why:'',ask:null,accents:[]},
  pattern:{kind:'pattern',match:'existing',existing:'glen-check',name:'glen check',description:'A Prince of Wales check.',plansAs:'glen-check',look:{layout:'none',tr:10},colourHint:null,confidence:'high',why:'',ask:null,
    material:{key:'flannel',confidence:'high',why:'A soft napped wool.'}},model:'m',lookups:0};
const READ_SHOES={colour:{kind:'colour',match:'existing',existing:'brown',dE:1.5,name:'brown',hex:'#5a3a22',plansAs:'brown',fitsType:true,confidence:'high',why:'',ask:null,accents:[]},pattern:null,
  material:{key:'suede',confidence:'high',why:'Matte nap.'},dial:null,buckle:null,model:'m',lookups:0};
const READ_WATCH={colour:{kind:'colour',match:'existing',existing:'black',dE:1,name:'black',hex:'#16161a',plansAs:'black',fitsType:true,confidence:'high',why:'',ask:null,accents:[]},pattern:null,
  material:{key:'gold',confidence:'high',why:'Yellow metal.'},dial:'navy',buckle:null,model:'m',lookups:0};
const PHOTO='data:image/jpeg;base64,'+Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64');
async function run(eng,browser,{ok,url,settle}){const T=eng+': ',full=eng==='Chromium';
  const open=async(o={})=>{const ctx=await browser.newContext({viewport:{width:o.w||390,height:844},colorScheme:o.dark?'dark':'light',...(o.touch?{hasTouch:true,isMobile:eng==='Chromium'}:{})});
    const sent=[];
    await ctx.route('https://w.test/**',route=>{const q=route.request(),h={'content-type':'application/json','access-control-allow-origin':'*'};
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
      if(/\/describe$/.test(q.url())){const b=JSON.parse(q.postData()||'{}');sent.push(b);
        return route.fulfill({status:200,headers:h,body:JSON.stringify(b.type==='shoes'?READ_SHOES:b.type==='watch'?READ_WATCH:READ_SUIT)})}
      return route.fulfill({status:503,headers:h,body:'{"error":"server"}'})});
    await ctx.addInitScript(on=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1');if(on)localStorage.setItem('beta_look','1')},o.off?0:1);
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{rememberRole({role:'owner'});if(document.querySelector('#setup.on')&&typeof setupClose==='function')setupClose()});
    return {ctx,p,errs,sent}};
  const WARD=photo=>{const I=(id,type,x={})=>({id,type,primaryColor:'navy',pattern:'solid',added:1,...x});
    return [I('s1','suit',{pattern:'pinstripe',secondaryColor:'white',material:'wool',photo,tagAI:{col:'navy',alt:'darknavy',altPat:'chalk-stripe'}}),I('s2','suit',{primaryColor:'charcoal'}),
      I('sh','shirt',{primaryColor:'lightblue',pattern:'end-on-end',secondaryColor:'white',material:'poplin'}),I('so','socks',{pattern:'argyle',secondaryColor:'burgundy',tertiaryColor:'lightgrey',toeColor:'grey'}),
      I('sw','sweater',{pattern:'cable'}),I('sk','shoes',{primaryColor:'oxblood',leather:'calf',shoeStyle:'loafer',photo}),I('sn','shoes',{primaryColor:'white',shoeStyle:'sneaker',secondaryColor:'grey',leather:'calf'}),
      I('b1','belt',{primaryColor:'brown',leather:'calf',metal:'silver'}),I('w1','watch',{primaryColor:'brown',metal:'silver',dial:'white',band:'leather',photo}),I('w2','watch',{primaryColor:'silver',metal:'gold',dial:'black',band:'bracelet'}),
      I('c1','tieclip',{primaryColor:'gold'}),I('c2','tieclip',{primaryColor:'navy',metal:'silver'}),I('cl','cufflinks',{primaryColor:'silver',metal:'silver'}),
      I('o1','overcoat',{primaryColor:'charcoal',pattern:'herringbone'}),I('r1','raincoat',{primaryColor:'khaki'}),I('q1','pocketsquare',{primaryColor:'white'}),I('t1','tie')]};
  const load=(p,photo)=>p.evaluate(([w])=>{items=w;cache={};flt='all';editing=null;show('wardrobe')},[WARD(photo)]);
  const look=(p,id)=>p.evaluate(async id=>{closeColPick();openItem(id);await new Promise(r=>setTimeout(r,40));const s=document.querySelector('#item-view .cklook');
    return s?{open:s.classList.contains('open'),rows:[...s.querySelectorAll('.lkrow')].map(r=>r.querySelector('small').textContent+(r.classList.contains('off')?' [off]':'')),
      text:s.innerText.replace(/\s+/g,' '),mark:s.querySelector('.ckm').className}:null},id);

  // ================= Settings: the switch, off by default, visible to everyone (not in an Advanced fold), per phone =================
  {const {ctx,p,errs}=await open({off:1});await load(p,null);
    let e=await p.evaluate(()=>{openSettings('tagging');const b=document.querySelector('#beta-look');return {has:!!b,checked:b&&b.getAttribute('aria-checked'),inAdv:!!(b&&b.closest('.adv')),
      label:(document.querySelector('#beta-look-l')||{}).textContent,ls:localStorage.getItem('beta_look'),look:!!document.querySelector('.cklook')}});
    ok(e.has&&e.checked==='false'&&!e.inAdv&&e.label==='New Look editor (beta)'&&!e.ls,T+`Settings → Photo tagging → Beta features has "New Look editor (beta)", off by default, outside the Advanced folds (${JSON.stringify(e)})`);
    // off: today's UI exactly (the old Color, Pattern and Material sections, no Look)
    await p.evaluate(()=>closeSettings());let L=await look(p,'s1');
    e=await p.evaluate(()=>({secs:[...document.querySelectorAll('#item-view .cks')].map(s=>s.dataset.ck).join(),read:!!document.querySelector('#iv-read')}));
    ok(!L&&/color,pattern,material,details/.test(e.secs),T+`with it off the item sheet is as before (${e.secs})`);
    // on from Settings: stored on this phone, the open sheet redrawn, nothing on the item changed
    const before=await p.evaluate(()=>JSON.stringify(items));
    await p.evaluate(()=>{openSettings('tagging')});await p.click('#beta-look');await settle(p,100);
    e=await p.evaluate(()=>({ls:localStorage.getItem('beta_look'),checked:document.querySelector('#beta-look').getAttribute('aria-checked'),look:!!document.querySelector('#item-view .cklook'),synced:!!(settings.beta_look||settings.betaLook)}));
    ok(e.ls==='1'&&e.checked==='true'&&e.look&&!e.synced,T+`the switch turns it on for this phone (localStorage beta_look, not a synced setting) and redraws the open item sheet (${JSON.stringify(e)})`);
    await p.evaluate(()=>{closeSettings();openSettings('tagging')});await p.click('#beta-look');await settle(p,100);await p.evaluate(()=>closeSettings());
    e=await p.evaluate(()=>({ls:localStorage.getItem('beta_look'),same:JSON.stringify(items),look:!!document.querySelector('#item-view .cklook')}));
    ok(e.ls===null&&!e.look&&e.same===before,T+'off again: the old sections are back and not one field changed either way');
    ok(errs.length===0,T+'no page errors with it off ('+errs.join('; ')+')');await ctx.close()}

  const {ctx,p,errs,sent}=await open({});await load(p,PHOTO);
  // ================= the Look section for every type =================
  {let L=await look(p,'s1');
    ok(L&&L.open&&L.rows.join('|')==='Color|Second color · the stripes|Pattern|Material · Fabric',T+`suit: Color, Second color "the stripes" (pinstripe), Pattern, Material · Fabric; Look open (${L&&L.rows.join('|')})`);
    ok(/Claude: very dark navy\? Use/.test(L.text)&&/Claude: or chalk stripe\? Use/.test(L.text)&&/ck-warn/.test(L.mark),T+'an item saved before the beta shows Claude\'s runner-ups from tagAI as chips on the rows, the mark "!"');
    L=await look(p,'s2');ok(L.rows.join('|')==='Color|Pattern|Material · Fabric',T+`a solid suit has no second color row (${L.rows.join('|')})`);
    L=await look(p,'sh');ok(L.rows.join('|')==='Color|Second color · the light threads|Pattern|Material · Fiber'&&/Cotton saved as poplin/.test(L.text),T+`shirt: the weave's second color, Material is the fiber, a poplin shirt shown as Cotton without rewriting it (${L.rows.join('|')})`);
    ok(await p.evaluate(()=>items.find(x=>x.id==='sh').material==='poplin'),T+'…its stored material is still poplin');
    L=await look(p,'so');ok(L.rows.join('|')==='Color|Second color · the diamonds|Third color · the lines over them|Toe cap · and the cuff edge|Pattern|Material · Fabric',T+`socks: argyle's two colors and the toe cap (${L.rows.join('|')})`);
    L=await look(p,'sw');ok(L.rows.join('|')==='Color|Pattern|Material · Fabric'&&/Add a close-up/.test(L.text),T+`sweater: no second color for cable; a close-up is offered (${L.rows.join('|')})`);
    ok(await p.evaluate(()=>!!document.querySelector('#item-view .ivpics .pt-closeup')),T+'…and Pictures has the Close-up button for a sweater (beta only)');
    L=await look(p,'sk');ok(L.rows.join('|')==='Color|Pattern [off]|Material · Leather'&&/Not used for shoes/.test(L.text),T+`shoes: Pattern dimmed "Not used for shoes", Material · Leather (${L.rows.join('|')})`);
    L=await look(p,'sn');ok(L.rows.join('|')==='Color|Sole|Pattern [off]|Material · Leather',T+`sneakers keep the Sole row (${L.rows.join('|')})`);
    L=await look(p,'b1');ok(L.rows.join('|')==='Color|Pattern [off]|Material · Leather|Buckle · Metal',T+`belt: Leather and a Buckle row (${L.rows.join('|')})`);
    L=await look(p,'w1');ok(L.rows.join('|')==='Dial|Strap color|Pattern [off]|Material · Metal (case)',T+`strap watch: Dial, Strap color, Metal (case) (${L.rows.join('|')})`);
    L=await look(p,'w2');ok(L.rows.join('|')==='Dial|Pattern [off]|Material · Metal',T+`bracelet watch: Dial and a Metal row (it had none) (${L.rows.join('|')})`);
    L=await look(p,'c1');ok(L.rows.join('|')==='Enamel|Pattern [off]|Material · Metal'&&/None · plain metal/.test(L.text)&&/Gold/.test(L.text),T+`plain tie clip: Enamel None, Metal Gold (${L.text.slice(0,120)})`);
    L=await look(p,'c2');ok(/Enamel Navy/.test(L.text)&&/Metal Silver/.test(L.text),T+'enamel tie clip: Enamel Navy, Metal Silver');
    L=await look(p,'cl');ok(L.rows.join('|')==='Color|Pattern [off]|Material · Metal',T+'cufflinks: Metal in Material');
    L=await look(p,'o1');ok(L.rows.join('|')==='Color|Pattern|Material · Fabric'&&/Herringbone/.test(L.text),T+`overcoat: a Pattern row (herringbone) (${L.rows.join('|')})`);
    L=await look(p,'q1');ok(L.rows[0]==='Color'&&L.rows.includes('Pattern'),T+'pocket square: Color and Pattern');
    // the Look section never shows the old Color / Pattern / Material sections or the old reader
    const e=await p.evaluate(()=>({secs:[...document.querySelectorAll('#item-view .cks')].map(s=>s.dataset.ck).join(),read:!!document.querySelector('#iv-read')}));
    ok(!/(^|,)(color|pattern|material)(,|$)/.test(e.secs)&&!e.read,T+`beta: no separate Color / Pattern / Material sections and no "Read color and texture from close-up" (${e.secs})`)}

  // ================= second and third rows follow the pattern =================
  {const r=await p.evaluate(async()=>{const rows=()=>[...document.querySelectorAll('#item-view .cklook .lkrow small:first-of-type')].map(x=>x.textContent).join('|');
      openItem('s2');const out=[rows()];await sete('s2','pattern','glen-check');out.push(rows());await sete('s2','pattern','windowpane');out.push(rows());return out});
    ok(r[0]==='Color|Pattern|Material · Fabric'&&r[1]==='Color|Second color · the check|Third color · the overcheck|Pattern|Material · Fabric'&&r[2]==='Color|Second color · the pane lines|Pattern|Material · Fabric',T+`second and third colors follow the pattern (${r.join(' / ')})`)}

  // ================= chips on the item sheet: Use, Undo, the hint dropped; Looks right hides them and its ✓ stays after an edit =================
  {await p.evaluate(()=>{const s=items.find(x=>x.id==='s1');s.lookHint={c:'darknavy',m:'charcoal',p:'chalk-stripe',mat:{key:'flannel',why:'soft'}};openItem('s1')});
    let e=await p.evaluate(()=>[...document.querySelectorAll('#item-view .lkchip')].map(c=>c.textContent.replace(/\s+/g,' ').trim()));
    ok(e.includes('Claude: very dark navy?Use')&&e.includes('Measured: charcoal?Use')&&e.includes('Claude: or chalk stripe?Use')&&e.some(t=>/Claude: Flannel\?/.test(t)),T+`kept hints show as chips: Claude's and the measured color, the pattern, the material (${e.join(' / ')})`);
    await p.evaluate(()=>{const s=items.find(x=>x.id==='s1');s.lookHint={c:'charcoal',m:'charcoal'};renderWardrobe()});
    e=await p.evaluate(()=>[...document.querySelectorAll('#item-view .lkchip')].map(c=>c.textContent.replace(/\s+/g,' ').trim()));
    ok(e.length===1&&e[0]==='Claude & measured: charcoal?Use',T+`Claude and the measurement agreeing are one chip (${e.join(' / ')})`);
    await p.locator('#item-view .lkchip').first().scrollIntoViewIfNeeded();await p.click('#item-view .lkchip');await settle(p,150);
    e=await p.evaluate(()=>{const s=items.find(x=>x.id==='s1');return {c:s.primaryColor,h:s.lookHint,chips:document.querySelectorAll('#item-view .lkchip').length,undo:!!document.querySelector('#toast.on button,#undo-fab')}});
    ok(e.c==='charcoal'&&!e.h.c&&e.chips===0&&e.undo,T+`a chip's Use sets the color, drops its hint and offers Undo (${JSON.stringify(e)})`);
    await p.evaluate(()=>{const b=document.querySelector('#toast.on button');if(b)b.click()});await settle(p,150);
    e=await p.evaluate(()=>{const s=items.find(x=>x.id==='s1');return {c:s.primaryColor,h:s.lookHint}});
    ok(e.c==='navy'&&e.h.c==='charcoal',T+`Undo puts the color and the hint back (${JSON.stringify(e)})`);
    await p.evaluate(()=>lookCheck('s1'));await settle(p,100);
    e=await p.evaluate(()=>({ok:items.find(x=>x.id==='s1').lookOk,chips:document.querySelectorAll('#item-view .lkchip').length,mark:document.querySelector('#item-view .cklook .ckm').className}));
    ok(e.ok===1&&e.chips===0&&/ck-good/.test(e.mark),T+`Looks right: kept on the item, the chips go, the mark is ✓ (${JSON.stringify(e)})`);
    await p.evaluate(()=>sete('s1','pattern','chalk-stripe'));
    e=await p.evaluate(()=>({ok:items.find(x=>x.id==='s1').lookOk,mark:document.querySelector('#item-view .cklook .ckm').className}));
    ok(e.ok===1&&/ck-good/.test(e.mark),T+'the ✓ stays after a later edit');
    e=await p.evaluate(()=>{openItem('s2');return document.querySelector('#item-view .cklook .ckm').className});
    ok(!/ck-good/.test(e),T+`an item nobody checked has no ✓ (it always had one on Color and Pattern) (${e})`)}

  // ================= the pickers: shade (not for metals), material, leather, metal, buckle, dial, enamel; + New on the first tap =================
  {let e=await p.evaluate(async()=>{const out={};openItem('s2');openColPick('e','s2','primaryColor');out.shade=!!document.querySelector('#col-sheet .lkshade');out.ask=!!document.querySelector('#col-sheet .cpask');
      out.order=[...document.querySelectorAll('#col-sheet .cph')].map(h=>h.textContent).filter(t=>['Suggested','Yours','New'].includes(t)).join(',');
      colPickSel('silver');out.metalShade=!!document.querySelector('#col-sheet .lkshade');closeColPick();
      openItem('cl');openColPick('e','cl','primaryColor');out.clip=!!document.querySelector('#col-sheet .lkshade');closeColPick();
      openItem('s2');openColPick('e','s2','primaryColor');lookShadeStep(-1);lookShadeStep(-1);colPickSel('slate');out.bar=document.querySelector('#col-sheet .cpbar button').textContent;await useColPick();
      const s=items.find(x=>x.id==='s2');out.after=[s.primaryColor,s.shade];return out});
    ok(e.shade&&!e.ask&&e.order==='Yours,New'&&!e.clip,T+`color sheet: Shade under the preview, no Ask Claude, Yours then "+ New" at the end; no Shade for silver cufflinks (${JSON.stringify(e)})`);
    ok(e.bar==='Use Dark slate blue-gray · Darker 2'&&e.after[0]==='slate'&&e.after[1]===-2,T+`the shade is kept with the color (${e.bar}, ${e.after})`);
    // accents: only the type's line colours, no metals on a tie
    e=await p.evaluate(()=>{openItem('t1');openColPick('e','t1','accents');const c=[...document.querySelectorAll('#col-sheet .cptile')].map(t=>t.dataset.c);closeColPick();return c});
    ok(!e.some(c=>['silver','gold','rosegold','gunmetal','oxblood','stone'].includes(c))&&e.includes('white'),T+`"Also has" offers only the tie's own line colors, no metals (${e.length})`);
    // the material picker: Suggested / Yours / groups / Or / New
    e=await p.evaluate(()=>{openItem('sh');openColPick('e','sh','material');const h=[...document.querySelectorAll('#col-sheet .cph')].map(x=>x.textContent);const t=[...document.querySelectorAll('#col-sheet .cptile')].map(x=>x.dataset.c);closeColPick();return {h,t}});
    ok(e.h.join()==='Yours,Fibers,Cotton cloths,Or,New'&&e.t.includes('cotton')&&!e.t.includes('oxford')&&!e.t.includes('poplin')&&e.t.includes('flannel'),T+`a shirt's material sheet: fibers, the cotton cloths, no weaves (${e.h.join()})`);
    // leather: set, own leather by + New on the first real tap, shared with belts
    await p.evaluate(()=>{openItem('sk');openColPick('e','sk','leather')});await p.click('#lk-newopen');await p.waitForSelector('#lk-new');
    await p.focus('#lk-new');await p.keyboard.type('shell cordovan');await settle(p,50);await p.click('#lk-newadd');await settle(p,200);
    e=await p.evaluate(()=>{const s=items.find(x=>x.id==='sk');return {on:document.querySelector('#col-sheet').classList.contains('on'),own:s.leatherOwn,leather:s.leather,list:settings.ownMaterials&&settings.ownMaterials.shoes}});
    ok(!e.on&&e.own==='shell cordovan'&&e.leather==='calf'&&JSON.stringify(e.list)==='["shell cordovan"]',T+`+ New leather: the FIRST tap on "Add and use it" adds it (yours, synced) and sets it; the planner's leather stays calf (${JSON.stringify(e)})`);
    e=await p.evaluate(()=>{openItem('b1');openColPick('e','b1','leather');const t=[...document.querySelectorAll('#col-sheet .cnown .cptile')].map(x=>x.dataset.c);closeColPick();return t});
    ok(e.includes('own:shell cordovan'),T+'an own leather made on shoes is offered for belts (one group, as own colors)');
    // Other typed and kept as one of yours
    await p.evaluate(()=>{openItem('o1');openColPick('e','o1','material');colPickSel(LOOK_OTHER)});await p.fill('#lk-other','boiled wool');
    await p.click('#col-sheet .cpbar button');await settle(p,200);
    e=await p.evaluate(()=>({m:items.find(x=>x.id==='o1').material,own:settings.ownMaterials&&settings.ownMaterials.overcoat,shared:lookOwnMats({type:'raincoat'},'material')}));
    ok(e.m==='boiled wool'&&JSON.stringify(e.own)==='["boiled wool"]'&&e.shared.includes('boiled wool'),T+`a typed Other is kept as your own (and offered for raincoats too) (${JSON.stringify(e)})`);
    // metal, buckle, dial, enamel
    e=await p.evaluate(async()=>{const o={};openItem('w2');openColPick('e','w2','metal');colPickSel('two-tone');await useColPick();o.watch=items.find(x=>x.id==='w2').metal;
      openItem('w2');openColPick('e','w2','dial');o.dialShade=!!document.querySelector('#col-sheet .lkshade');colPickSel('navy');await useColPick();o.dial=items.find(x=>x.id==='w2').dial;
      openItem('b1');openColPick('e','b1','buckle');colPickSel('gold');await useColPick();o.buckle=items.find(x=>x.id==='b1').metal;return o});
    ok(e.watch==='two-tone'&&e.dial==='navy'&&!e.dialShade&&e.buckle==='gold',T+`the metal, dial (swatches, no shade) and buckle pickers set their fields (${JSON.stringify(e)})`);
    // New color and New pattern from the beta's sheet: the first tap adds (the audit's #1 kept)
    await p.evaluate(()=>{openItem('t1');openColPick('e','t1','primaryColor')});await p.click('#cn-open');await p.waitForSelector('#cn-name');
    await p.focus('#cn-name');await p.keyboard.type('Dusty rose');await settle(p,50);await p.click('#cn-add');await settle(p,300);
    e=await p.evaluate(()=>{const c=items.find(x=>x.id==='t1').primaryColor;return {on:document.querySelector('#col-sheet').classList.contains('on'),n:CUSTOM_COL[c]&&CUSTOM_COL[c].name}});
    ok(!e.on&&e.n==='Dusty rose',T+`"+ New color" at the end of the beta's sheet: the first tap adds and uses it (${JSON.stringify(e)})`);
    await p.evaluate(()=>{openItem('t1');openColPick('e','t1','pattern')});await p.click('#pn-open');await p.waitForSelector('#cn-name');
    await p.focus('#cn-name');await p.keyboard.type('Hopsack');await settle(p,50);await p.click('#cn-add');await settle(p,300);
    e=await p.evaluate(()=>{const k=items.find(x=>x.id==='t1').pattern;return {on:document.querySelector('#col-sheet').classList.contains('on'),n:CUSTOM_PAT[k]&&CUSTOM_PAT[k].name}});
    ok(!e.on&&e.n==='Hopsack',T+`"+ New pattern" likewise (${JSON.stringify(e)})`)}

  // ================= Read with Claude (the worker mocked): all three filled, one toast with Undo =================
  {sent.length=0;await p.evaluate(()=>{const s=items.find(x=>x.id==='s2');Object.assign(s,{primaryColor:'navy',pattern:'solid',material:'wool',photo:items.find(x=>x.id==='s1').photo});delete s.shade;openItem('s2')});
    let e=await p.evaluate(()=>document.querySelector('#item-view .lkrd').innerText.replace(/\s+/g,' '));
    ok(/Read with Claude/.test(e)&&/from the photo/.test(e)&&/About \d+¢/.test(e),T+`the owner sees one price on Read with Claude (${e})`);
    e=await p.evaluate(()=>{const was=acct.me;acct.me={id:'tess',role:'tester',caps:{describe:40},used:{describe:2}};renderWardrobe();const t=document.querySelector('#item-view .lkrd').innerText.replace(/\s+/g,' ');acct.me=was;renderWardrobe();return t});
    ok(/counts as 2 lookups · 38 of 40 left today/.test(e)&&!/¢/.test(e),T+`a tester sees "counts as 2 lookups" and what is left, no cents (${e})`);
    await p.click('#lk-read-e');await p.waitForFunction(()=>/Claude read it/.test((document.querySelector('#toast')||{}).innerText||''),null,{timeout:5000}).catch(()=>{});
    e=await p.evaluate(()=>{const s=items.find(x=>x.id==='s2');return {c:s.primaryColor,p:s.pattern,m:s.material,ai:document.querySelectorAll('#item-view .lkai').length,toast:(document.querySelector('#toast')||{}).innerText||''}});
    const b=sent[0]||{};
    ok(b.what==='both'&&b.look===true&&b.src==='photo'&&b.type==='suit'&&/^data:image/.test(b.closeup||''),T+`one /describe call: what both, look true, src photo, the photo (${JSON.stringify({what:b.what,look:b.look,src:b.src})})`);
    ok(e.c==='charcoal'&&e.p==='glen-check'&&e.m==='flannel'&&e.ai===3&&/Claude read it: charcoal, glen check, flannel/.test(e.toast),T+`it fills color, pattern and material, marks them "✦ Claude" and says so with Undo (${JSON.stringify(e)})`);
    await p.evaluate(()=>{const b=document.querySelector('#toast.on button');if(b)b.click()});await settle(p,150);
    e=await p.evaluate(()=>{const s=items.find(x=>x.id==='s2');return [s.primaryColor,s.pattern,s.material].join()});
    ok(e==='navy,solid,wool',T+`Undo puts all three back (${e})`);
    sent.length=0;await p.evaluate(()=>openItem('sk'));await p.click('#lk-read-e');await p.waitForFunction(()=>items.find(x=>x.id==='sk').leather==='suede',null,{timeout:5000}).catch(()=>{});
    e=await p.evaluate(()=>{const s=items.find(x=>x.id==='sk');return {c:s.primaryColor,l:s.leather,own:s.leatherOwn||null}});
    ok((sent[0]||{}).type==='shoes'&&e.c==='brown'&&e.l==='suede'&&!e.own,T+`shoes: color and leather from the photo (${JSON.stringify(e)})`);
    sent.length=0;await p.evaluate(()=>openItem('w1'));await p.click('#lk-read-e');await p.waitForFunction(()=>items.find(x=>x.id==='w1').dial==='navy',null,{timeout:5000}).catch(()=>{});
    e=await p.evaluate(()=>{const s=items.find(x=>x.id==='w1');return {c:s.primaryColor,m:s.metal,d:s.dial}});
    ok(e.c==='black'&&e.m==='gold'&&e.d==='navy',T+`a strap watch: strap color, case metal and dial (${JSON.stringify(e)})`)}

  // ================= the Add card: one Look section, chips, Looks right, the hints kept on the saved item =================
  {let e=await p.evaluate(async()=>{closeItem();show('add');addManual();await new Promise(r=>setTimeout(r,80));const q=queue[0];
      Object.assign(q,{type:'suit',primaryColor:'navy',pattern:'pinstripe',secondaryColor:'white',manual:false,ai:true,altColor:'darknavy',altPattern:'chalk-stripe',matGuess:{key:'flannel',conf:'low',why:'soft nap'}});renderAdd();
      await new Promise(r=>setTimeout(r,80));return {secs:[...document.querySelectorAll('#nps-q .cks')].map(s=>s.dataset.ck).join(),chips:[...document.querySelectorAll('#nps-q .lkchip')].map(c=>c.dataset.chip).join(),id:q.id}});
    ok(/type,lk,/.test(e.secs)&&!/colors|pattern/.test(e.secs)&&e.chips==='primaryColor,pattern,material',T+`Add card: Type, then one Look section with Claude's chips on the color, pattern and material rows (${JSON.stringify(e)})`);
    await p.click('#nps-q .lkchip[data-chip="pattern"]');await settle(p,100);
    e=await p.evaluate(id=>{const q=queue.find(x=>x.id===id);return {p:q.pattern,left:[...document.querySelectorAll('#nps-q .lkchip')].map(c=>c.dataset.chip).join()}},e.id);
    ok(e.p==='chalk-stripe'&&e.left==='primaryColor,material',T+`a chip applies at once (${JSON.stringify(e)})`);
    e=await p.evaluate(async()=>{const q=queue[0];await save(q.id);await new Promise(r=>setTimeout(r,150));const it=items.find(x=>x.id===q.id);return it&&{h:it.lookHint,ok:it.lookOk||0}});
    ok(e&&e.h&&e.h.c==='darknavy'&&e.h.mat&&e.h.mat.key==='flannel'&&!e.ok,T+`saved unchecked, Claude's runner-ups are kept on the item for the item sheet (${JSON.stringify(e)})`);
    e=await p.evaluate(async()=>{show('add');addManual();await new Promise(r=>setTimeout(r,80));const q=queue[0];Object.assign(q,{type:'tieclip',primaryColor:'silver'});renderAdd();
      await lookSetMat('q',q.id,'metal','gold');await lookSetEnamel('q',q.id,'navy');ckCheck(qAt(q.id),'lk');await save(q.id);await new Promise(r=>setTimeout(r,150));const it=items.find(x=>x.id===q.id);return it&&{pc:it.primaryColor,m:it.metal,ok:it.lookOk}});
    ok(e&&e.pc==='navy'&&e.m==='gold'&&e.ok===1,T+`a tie clip made on the Add card: navy enamel on gold, checked (${JSON.stringify(e)})`)}

  // ================= the tie clip's planner input is unchanged: the same colour field the old UI wrote, the same plans =================
  if(full){const e=await p.evaluate(async()=>{const was=items;const mk=()=>{const I=(id,type,x={})=>({id,type,primaryColor:'navy',pattern:'solid',added:1,...x});
        return [I('a1','suit'),I('a2','suit',{primaryColor:'charcoal'}),I('a3','shirt',{primaryColor:'white'}),I('a4','shirt',{primaryColor:'lightblue'}),I('a5','tie',{primaryColor:'burgundy',secondaryColor:'navy',pattern:'stripe'}),I('a6','tie',{primaryColor:'navy'}),
          I('a7','shoes',{primaryColor:'black',leather:'calf'}),I('a8','belt',{primaryColor:'black',leather:'calf',metal:'silver'}),I('a9','watch',{primaryColor:'black',metal:'silver',band:'leather'}),
          I('k1','tieclip',{primaryColor:'gold'}),I('k2','tieclip',{primaryColor:'navy'}),I('k3','tieclip',{primaryColor:'silver'}),I('a10','socks',{toeColor:'none'})]};
      const sig=()=>JSON.stringify(Object.entries(buildPlan(2026,10)).sort().map(([k,o])=>[k,o.clip&&o.clip.id,o.top&&o.top.id,o.tie&&o.tie.id]));
      items=mk();cache={};const A=sig();
      // the same clips edited through the beta (plain gold → metal silver → gold again; navy enamel on a silver clip: enamel none, then navy again)
      items=mk();cache={};await lookSetMat('e','k1','metal','silver');await lookSetMat('e','k1','metal','gold');await lookSetEnamel('e','k2','none');await lookSetEnamel('e','k2','navy');await lookSetMat('e','k3','metal','silver');
      const pcs=items.filter(x=>x.type==='tieclip').map(x=>x.primaryColor).join(),metals=items.filter(x=>x.type==='tieclip').map(x=>String(clipMetal(x))).join();cache={};const B=sig();
      items=was;cache={};return {same:A===B,pcs,metals,n:JSON.parse(A).length}});
    ok(e.same&&e.pcs==='gold,navy,silver'&&e.metals==='gold,null,silver'&&e.n>10,T+`tie clips edited in the beta keep the planner's input (their colors ${e.pcs}, clipMetal ${e.metals}) and plan exactly the same month`)}

  // ================= the new fields are kept by the record check (sync, restore) and by the field-by-field merge =================
  {const e=await p.evaluate(()=>{const it={id:'z1',type:'shoes',primaryColor:'brown',leather:'calf',leatherOwn:'shell cordovan',metalOwn:'titanium',lookOk:1,lookHint:{c:'tan',mat:{key:'suede',why:'matte "nap"'}}};
      const c=cleanRecord(it);return {own:c.leatherOwn,m:c.metalOwn,ok:c.lookOk,h:c.lookHint&&c.lookHint.c,why:c.lookHint&&c.lookHint.mat&&c.lookHint.mat.why}});
    ok(e.own==='shell cordovan'&&e.m==='titanium'&&e.ok===1&&e.h==='tan'&&/matte/.test(e.why||''),T+`cleanRecord keeps lookOk, lookHint, leatherOwn and metalOwn (${JSON.stringify(e)})`)}

  // ================= the switch round trip loses nothing: the old UI shows what the beta set =================
  {const e=await p.evaluate(()=>{lookSet(false);openItem('o1');const sel=[...document.querySelectorAll('#item-view select.wmat')].map(s=>s.value).join(),other=(document.querySelector('#item-view .wmat-t')||{}).value;
      openItem('sk');const lea=[...document.querySelectorAll('#item-view select')].map(s=>s.value);const keep=JSON.stringify(items.find(x=>x.id==='o1'));lookSet(true);
      return {sel,other,lea,same:keep===JSON.stringify(items.find(x=>x.id==='o1')),look:!!document.querySelector('#item-view .cklook')}});
    ok(e.sel==='boiled wool'&&e.lea.includes('suede')&&e.same&&e.look,T+`switched off, the old sheet shows the beta's values (material "boiled wool", one of the overcoat's own materials now, in its dropdown; leather suede) and on again nothing moved (${JSON.stringify(e)})`)}

  // ================= Settings: + New material (beta) =================
  {await p.evaluate(()=>{closeItem();openSettings('tagging')});await p.click('#ownmat-new');await p.waitForSelector('#ownmat-name');
    await p.selectOption('#ownmat-for','watch');await p.fill('#ownmat-name','titanium');await p.click('#ownmat-add');await settle(p,150);
    const e=await p.evaluate(()=>({w:settings.ownMaterials&&settings.ownMaterials.watch,row:[...document.querySelectorAll('#ownmat-list .ownmatrow')].some(r=>r.dataset.m==='titanium'),shared:lookOwnMats({type:'cufflinks'},'metal')}));
    ok(JSON.stringify(e.w)==='["titanium"]'&&e.row&&e.shared.includes('titanium'),T+`Settings → Your materials → "+ New material" adds one (a metal shared by watches, clips and cufflinks) (${JSON.stringify(e)})`);
    await p.evaluate(()=>closeSettings())}

  // ================= 390 and 320 px, light and dark: no sideways scroll on the item sheet, the Add card or a picker =================
  for(const [w,dark] of [[390,false],[390,true],[320,false],[320,true]]){const o=await open({w,dark});await load(o.p,PHOTO);
    const r=await o.p.evaluate(async()=>{const out=[];const x=()=>Math.max(document.documentElement.scrollWidth-innerWidth,(document.querySelector('#ivbody')||{scrollWidth:0,clientWidth:0}).scrollWidth-(document.querySelector('#ivbody')||{clientWidth:0}).clientWidth);
      for(const id of ['s1','so','w1','b1','c2']){openItem(id);await new Promise(r=>setTimeout(r,30));out.push(x())}
      for(const k of ['primaryColor','material','pattern']){openItem('s1');openColPick('e','s1',k);await new Promise(r=>setTimeout(r,30));const s=document.querySelector('#col-sheet');out.push(s.scrollWidth-s.clientWidth);closeColPick()}
      closeItem();show('add');addManual();await new Promise(r=>setTimeout(r,60));Object.assign(queue[0],{type:'socks',pattern:'argyle'});renderAdd();await new Promise(r=>setTimeout(r,60));const n=document.querySelector('#nps-q');out.push(n.scrollWidth-n.clientWidth);
      return out});
    ok(r.every(v=>v<=1),T+`${w} px ${dark?'dark':'light'}: no sideways scroll on the item sheets, pickers or the Add card (${r.join(',')})`);
    ok(o.errs.length===0,T+`${w} px ${dark?'dark':'light'}: no page errors (${o.errs.join('; ')})`);await o.ctx.close()}

  ok(errs.length===0,T+'no page errors ('+errs.join('; ')+')');await ctx.close()}
