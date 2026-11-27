// Own names for colors and patterns.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),{pathToFileURL}=require('url');

/* ---- was tests/ownnames.test.js ---- */
// Own colour and pattern names are text, never HTML (2026-11-15, the re-audit's N4: a name like `<img src=x onerror=…>` ran in the colour
// button, the picker's tiles and the pattern button, came back on every reopen and synced). A typed name with < > " = etc. is refused; a
// name arriving by sync (or saved before) is cleaned where it is applied (applyCustom); every place shows it escaped. Also: "Gray",
// "Dark gray", "Light gray" are taken (they are Grey's spellings); the phone's Back with the colour or pattern sheet up closes only the
// sheet, on the item sheet, on Add and over Settings; the item sheet refuses a close-up under TEX_MIN_PX as Add does.
const ownnames=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{errs.push('dialog '+d.message());d.dismiss()});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{HOOK.CK_OPEN['*']=true});
    // ---- a synced settings.custom carrying HTML in its names (as another device or an old copy could)
    await p.evaluate(()=>{window.__pwned=0;
      HOOK.settings.custom={colors:[{key:'ownimgsrcxonerror',name:'<img src=x onerror=__pwned++>',hex:'#c06080',base:'pink',types:['tie'],accent:false}],
        patterns:[{key:'own-bad',name:'<img src=y onerror=__pwned++>',desc:'<b onmouseover=x>hi</b>',base:'woven',types:['tie']}]};
      HOOK.applyCustom(HOOK.settings.custom);
      HOOK.items=[{id:'t1',type:'tie',primaryColor:'ownimgsrcxonerror',pattern:'own-bad',added:1},{id:'t2',type:'tie',primaryColor:'navy',pattern:'solid',added:2},{id:'s1',type:'suit',primaryColor:'navy',pattern:'solid',added:3}];
      HOOK.cache={};HOOK.show('wardrobe');HOOK.renderWardrobe()});
    await settle(p,200);
    await p.evaluate(()=>HOOK.openItem('t1'));await settle(p,500);
    let e=await p.evaluate(()=>({imgs:document.querySelectorAll('#item-view .colbtn img').length,col:(document.querySelector('#item-view .colbtn[data-k="primaryColor"] .colnm')||{}).textContent,
      pat:(document.querySelector('#item-view .patbtn .colnm')||{}).textContent,name:HOOK.COLOR_NAMES.ownimgsrcxonerror,pname:HOOK.CUSTOM_PAT['own-bad'].name,desc:HOOK.CUSTOM_PAT['own-bad'].desc}));
    ok(e.imgs===0&&!/[<>=]/.test(e.col+e.pat+e.name+e.pname)&&!/[<>]/.test(e.desc)&&/img src x onerror/i.test(e.col)&&/img src y onerror/i.test(e.pat),
      `a synced name with HTML is cleaned and shown as text on the item sheet (color "${e.col}", pattern "${e.pat}", desc "${e.desc}")`);
    await p.evaluate(()=>HOOK.openColPick('e','t1','primaryColor'));await settle(p,200);
    e=await p.evaluate(()=>({imgs:document.querySelectorAll('#col-sheet img:not(.cpph img)').length,own:[...document.querySelectorAll('#col-sheet .cnown .cpnm')].map(x=>x.textContent),cap:document.querySelector('#col-sheet .cpbig figcaption').textContent,bar:document.querySelector('#col-sheet .cpbar button').textContent}));
    ok(e.imgs===0&&e.own.some(t=>/img src x/i.test(t))&&/img src x/i.test(e.cap)&&/^Keep /.test(e.bar),`the color sheet's tiles, big swatch and button show it as text (${e.own.join(' | ')})`);
    await p.evaluate(()=>{HOOK.closeColPick();HOOK.openColPick('e','t1','pattern')});await settle(p,200);
    e=await p.evaluate(()=>({imgs:document.querySelectorAll('#col-sheet .cnown img').length,own:[...document.querySelectorAll('#col-sheet .cnown .cpnm')].map(x=>x.textContent)}));
    ok(e.imgs===0&&e.own.some(t=>/img src y/i.test(t)),`the pattern sheet's own tiles show it as text (${e.own.join(' | ')})`);
    await p.evaluate(()=>{HOOK.closeColPick();HOOK.closeItem()});await settle(p,500);
    await p.evaluate(()=>{HOOK.openSettings();HOOK.renderCustomUI()});await settle(p,200);
    ok(await p.evaluate(()=>document.querySelectorAll('#custom-list img').length===0),'Settings\' list of own colors and patterns shows them as text');
    await p.evaluate(()=>HOOK.closeSettings());
    ok(await p.evaluate(()=>window.__pwned===0),'no name ran as code');
    // ---- typing a name: HTML refused with a plain message; a straight apostrophe and & are kept as ’ and "and"
    e=await p.evaluate(async()=>{const r={};const add=async n=>{try{return await HOOK.addCustomColor({name:n,hex:'#aa5566',base:'pink',types:['tie']})}catch(x){return 'ERR '+x.message}};
      r.html=await add('<img src=x onerror=a()//');r.quote=await add('Sage "x"');r.eq=await add('a=b color');
      r.ok=await add("Bishop's purple");r.amp=await add('Salt & pepper');
      r.okName=(HOOK.settings.custom.colors.find(c=>c.key===r.ok)||{}).name;r.ampName=(HOOK.settings.custom.colors.find(c=>c.key===r.amp)||{}).name;
      r.pat=await HOOK.addCustomPattern({name:'<svg onload=x>',desc:'',base:'woven',types:['tie']}).catch(x=>'ERR '+x.message);return r});
    ok(/^ERR Use only letters/.test(e.html)&&/^ERR Use only letters/.test(e.quote)&&/^ERR Use only letters/.test(e.eq)&&/^ERR Use only letters/.test(e.pat),`a typed name with < > " = is refused (${e.html})`);
    ok(e.okName==='Bishop’s purple'&&e.ampName==='Salt and pepper',`an apostrophe and & are kept as ’ and "and" (${e.okName}, ${e.ampName})`);
    // ---- the greys' other spellings are taken
    e=await p.evaluate(async()=>{const r={};for(const n of ['Gray','Dark gray','Light gray','Mid gray','gray']){try{await HOOK.addCustomColor({name:n,hex:'#e0a0b0',base:'pink',types:['tie']});r[n]='added'}catch(x){r[n]=x.message}}
      try{await HOOK.addCustomColor({name:'Cognac',hex:'#9a4a20',base:'brown',types:['shoes','belt']});r.Cognac='added'}catch(x){r.Cognac=x.message}return r});
    ok(['Gray','Dark gray','Light gray','Mid gray','gray'].every(n=>/already a color/.test(e[n]))&&e.Cognac==='added',`"Gray", "Dark gray", "Light gray" are refused as Gray's spellings; "Cognac" is free (${JSON.stringify(e)})`);
    // ---- Back with the colour sheet up closes only the sheet: the item sheet
    await p.evaluate(()=>HOOK.openItem('t2'));await settle(p,500);
    await p.click('#item-view .colbtn[data-k="primaryColor"]');await settle(p,200);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!HOOK.colPick,null,{timeout:3000}).catch(()=>{});await settle(p,300);
    e=await p.evaluate(()=>({sheet:document.querySelector('#col-sheet').classList.contains('on'),editing:HOOK.editing}));
    ok(!e.sheet&&e.editing==='t2',`Back on the item sheet's color sheet closes the color sheet and keeps the item open (${JSON.stringify(e)})`);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!HOOK.editing,null,{timeout:3000}).catch(()=>{});await settle(p,500);
    ok(await p.evaluate(()=>!HOOK.editing),'the next Back closes the item sheet');
    // the pattern sheet, and a "New colour" sheet opened from the list (‹ back to the list first)
    await p.evaluate(()=>HOOK.openItem('t2'));await settle(p,500);await p.click('#item-view .patbtn');await settle(p,200);
    await p.evaluate(()=>history.back());await settle(p,400);
    ok(await p.evaluate(()=>!HOOK.colPick&&HOOK.editing==='t2'),'Back on the pattern sheet closes it and keeps the item');
    await p.click('#item-view .colbtn[data-k="primaryColor"]');await settle(p,200);await p.click('#cn-open');await settle(p,200);
    await p.evaluate(()=>history.back());await settle(p,400);
    e=await p.evaluate(()=>({on:!!HOOK.colPick,newc:!!(HOOK.colPick&&HOOK.colPick.newc),title:(document.querySelector('#col-title')||{}).textContent,editing:HOOK.editing}));
    ok(e.on&&!e.newc&&e.title==='Choose the color'&&e.editing==='t2',`Back on "New color" goes back to the color list (${JSON.stringify(e)})`);
    await p.evaluate(()=>history.back());await settle(p,400);
    ok(await p.evaluate(()=>!HOOK.colPick&&HOOK.editing==='t2'),'… and the next Back closes the color sheet, the item still open');
    // "Use" after that changes nothing hidden: the sheet is gone, the tie still navy
    ok(await p.evaluate(()=>HOOK.items.find(x=>x.id==='t2').primaryColor==='navy'),'the item keeps its color');
    await p.evaluate(()=>HOOK.closeItem());await settle(p,500);
    // ---- the Add page
    await p.evaluate(()=>{HOOK.show('wardrobe');HOOK.openAdd()});await settle(p,300);
    await p.evaluate(()=>{HOOK.addManual();HOOK.renderAdd()});await settle(p,200);
    await p.click('#add .colbtn[data-k="primaryColor"]');await settle(p,200);
    await p.evaluate(()=>history.back());await settle(p,400);
    e=await p.evaluate(()=>({sheet:!!HOOK.colPick,add:!document.querySelector('#add').hidden}));
    ok(!e.sheet&&e.add,`Back on an Add card's color sheet closes the sheet and stays on Add (${JSON.stringify(e)})`);
    // (the card is in the "Add without a photo" sheet: the next Back closes that, untouched, so nothing is asked)
    await p.evaluate(()=>history.back());await settle(p,400);
    e=await p.evaluate(()=>({nps:!!document.querySelector('#nps-sheet.on'),add:!document.querySelector('#add').hidden,asking:!!HOOK.asking}));
    ok(!e.nps&&e.add&&!e.asking,`the next Back closes the "Add without a photo" sheet and stays on Add (${JSON.stringify(e)})`);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>document.querySelector('#add').hidden,null,{timeout:3000}).catch(()=>{});await settle(p,300);
    ok(await p.evaluate(()=>document.querySelector('#add').hidden&&!document.querySelector('#wardrobe').hidden),'the next Back leaves Add for the Wardrobe');
    // ---- over Settings (Your colours & patterns → + New colour)
    await p.evaluate(()=>{HOOK.openSettings();HOOK.openCustomNew('colour')});await settle(p,300);
    await p.evaluate(()=>history.back());await settle(p,400);
    ok(await p.evaluate(()=>!HOOK.colPick&&HOOK.settingsOpen()),'Back on Settings\' "New color" closes it and keeps Settings open');
    await p.evaluate(()=>HOOK.closeSettings());await settle(p,200);
    // ---- the item sheet refuses a close-up under TEX_MIN_PX, as Add does
    e=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=40;c.getContext('2d').fillStyle='#345';c.getContext('2d').fillRect(0,0,40,40);
      const b=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([b],'x.png',{type:'image/png'});
      await HOOK.replaceTexture('t2',f);return {tex:!!HOOK.items.find(x=>x.id==='t2').texture,toast:document.querySelector('#toast').textContent}});
    ok(!e.tex&&/too small to show the weave \(40×40/.test(e.toast),`the item sheet refuses a 40×40 close-up (${e.toast})`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}};

/* ---- was tests/w3ownnames.test.js ---- */
// Fix round 3 (2026-11-16, Fixer 10): own colors and patterns in any script, Arabic names in English lines, and Settings text.
// W2-12-03 = W2-16-01: an Arabic own color or pattern name was refused ("at least two letters": the key kept only a-z), and "Rot 1" / "Rot 2"
// shared ownrot; keys stay ASCII and a Latin name keeps the key it always had. W2-16-02: the Arabic comma. W1-3-05: a built-in pattern's
// name. W1-1-04: an own pattern called "own basketweave". W2-16-04/-10: <bdi> round right-to-left names (packing list, Today's pieces
// line). W2-16-05: the new color sheet's error in its sticky bar. W2-16-07: Arabic search. W2-16-11: deep blue among the blues.
// W2-16-12: a dark petrol isn't based on light blue. W2-17-05: Claude's "dusty pink" opens on a pink shade. W2-12-02: a long day-off
// name keeps its × on the screen. W2-12-04: a watch's Details has a limit. The worker keeps the new keys and the names.
const COLORS_PINK='#e3a5b4',COLORS_CREAM='#efe4c8';
const w3ownnames=async({ok,chromium,url,settle})=>{
  // ---- the worker's cleaning of the owner's lists (tag and describe requests)
  {const tag=await import(pathToFileURL(path.join(__dirname,'..','worker','tag.js')).href);
    const c=tag.cleanCustom({colors:[{key:'ownxk3j2a1',name:'بترولي غامق ٢',hex:'#1f4e5a',types:['tie']},{key:'ownrot1',name:'Rot 1',hex:'#aa2233',types:['tie']}],patterns:[{key:'own-1abcd',name:'سدو كويتي',types:['tie']}]});
    ok(c.colors.length===2&&c.colors[0].name==='بترولي غامق ٢'&&c.colors[1].key==='ownrot1'&&c.patterns[0].name==='سدو كويتي',`the worker keeps keys with digits and Arabic names (${JSON.stringify(c)})`)}
  const ok2=await import(pathToFileURL(path.join(__dirname,'..','worker','ownkeys.js')).href);
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- keys
    let e=await p.evaluate(async()=>{const r={};const add=async(n,o={})=>{try{return await HOOK.addCustomColor({name:n,hex:'#1f4e5a',base:'navy',types:['tie'],...o})}catch(x){return 'ERR '+x.message}};
      const addP=async n=>{try{return await HOOK.addCustomPattern({name:n,desc:'',base:'woven',types:['tie']})}catch(x){return 'ERR '+x.message}};
      r.same=[HOOK.ownColKey('Petrol'),HOOK.ownColKey('Faded burgundy'),HOOK.ownPatKey('Hop sack'),HOOK.ownPatKey('Nailhead 2')];
      // an own color saved before digits counted: "Rot 1" stored as ownrot
      HOOK.settings.custom={colors:[{key:'ownrot',name:'Rot 1',hex:'#aa2233',base:'red',types:['tie'],accent:false}],patterns:[]};HOOK.applyCustom(HOOK.settings.custom);
      r.old=HOOK.ownColFind('rot 1');r.ar=await add('بترولي غامق ٢');r.ar2=await add('كحلي غامق');r.dupAr=await add('بترولي  غامق ٢');
      r.rot=await add('Rot');r.rot2=await add('Rot 2');r.rotAgain=await add('Rot 1');r.comma=await add('أزرق بترولي، غامق');r.one=await add('ب');
      r.pat=await addP('سدو كويتي');r.bird=await addP('Birdseye');r.glen=await addP('glen check');r.patDup=await addP('سدو كويتي');
      r.keysOk=HOOK.settings.custom.colors.every(c=>HOOK.OWN_COL_RE.test(c.key))&&HOOK.settings.custom.patterns.every(x=>HOOK.OWN_PAT_RE.test(x.key));
      HOOK.applyCustom(HOOK.settings.custom);r.applied=[r.ar,r.ar2,r.rot,r.rot2,r.comma].map(k=>!!HOOK.COLORS[k]);r.arName=HOOK.colName(r.ar);r.patOn=!!HOOK.CUSTOM_PAT[r.pat];
      r.norm=HOOK.normCol(r.rot2);r.col=HOOK.colsFor('tie').includes(r.ar);return r});
    ok(e.same.join()==='ownpetrol,ownfadedburgundy,own-hop-sack,own-nailhead-2','a Latin name keeps the key it always had ('+e.same.join()+')');
    ok(/^own[a-z0-9]+$/.test(e.ar)&&/^own[a-z0-9]+$/.test(e.ar2)&&e.ar!==e.ar2&&e.applied.every(Boolean)&&e.arName==='بترولي غامق ٢'&&e.col,`an Arabic color name is added and offered (${e.ar}, ${e.ar2}, "${e.arName}")`);
    ok(/already a color/.test(e.dupAr)&&/already a color/.test(e.rotAgain)&&/two letters/.test(e.one),`the same name twice is refused, one letter too (${e.dupAr} | ${e.rotAgain} | ${e.one})`);
    ok(e.old==='ownrot'&&e.rot!=='ownrot'&&e.rot2!==e.rot&&!/^ERR/.test(e.rot+e.rot2)&&e.norm===e.rot2,`"Rot", "Rot 1" (an old key) and "Rot 2" each have their own key (${e.old}, ${e.rot}, ${e.rot2})`);
    ok(!/^ERR/.test(e.comma),`the Arabic comma is accepted (${e.comma})`);
    ok(/^own-[a-z0-9-]+$/.test(e.pat)&&e.patOn&&/already a pattern/.test(e.patDup),`an Arabic pattern name is added (${e.pat}), and refused twice`);
    ok(/already a pattern/.test(e.bird)&&/already a pattern/.test(e.glen),`a built-in pattern's name is refused (${e.bird} | ${e.glen})`);
    ok(e.keysOk,'every stored key is ASCII and matches OWN_COL_RE / OWN_PAT_RE');
    // ---- one key rule: the app's (applyCustom, cleanRecord) is the server's (worker/ownkeys.js: tag, describe, the backup's record check)
    e=await p.evaluate(({ar,pat})=>({col:String(HOOK.OWN_COL_RE),pat:String(HOOK.OWN_PAT_RE),keep:HOOK.cleanRecord({id:'r1',type:'tie',primaryColor:ar,secondaryColor:'ownrot1',pattern:pat}),
      drop:HOOK.cleanRecord({id:'r2',type:'tie',primaryColor:'ownبني',secondaryColor:'own_x',pattern:'own-بني'})}),{ar:e.ar,pat:e.pat});
    ok(e.col===String(ok2.OWN_COL_RE)&&e.pat===String(ok2.OWN_PAT_RE),`the app and the server have one own-key rule (${e.col} ${e.pat})`);
    ok(e.keep.primaryColor&&e.keep.secondaryColor==='ownrot1'&&/^own-/.test(e.keep.pattern)&&e.drop.primaryColor===undefined&&e.drop.secondaryColor===undefined&&e.drop.pattern===undefined,
      `cleanRecord keeps own keys of the rule and drops others (${JSON.stringify(e.keep)} | ${JSON.stringify(e.drop)})`);
    {const rec=await import(pathToFileURL(path.join(__dirname,'..','worker','records.js')).href),chk=rec.recCheck;
      // (a renamed check fails here instead of passing silently: CR-10-11)
      const good=typeof chk==='function'?chk({items:[{id:'r1',type:'tie',primaryColor:'ownrot1',pattern:'own-1abcd'}]}):'no recCheck',bad=typeof chk==='function'?chk({items:[{id:'r2',type:'tie',primaryColor:'ownبني'}]}):null;
      ok(!good&&!!bad,`the server's record check (records.js recCheck) takes keys of the rule and refuses others (${good} | ${bad})`)}
    // ---- an own pattern by its name in the lines the planner writes (W1-1-04)
    e=await p.evaluate(()=>{HOOK.settings.custom.patterns.push({key:'own-basketweave',name:'Basketweave',desc:'',base:'woven',types:['tie']});HOOK.applyCustom(HOOK.settings.custom);
      const t={id:'tw',type:'tie',primaryColor:'taupe',pattern:'own-basketweave'};return {nm:HOOK.nm(t),line:HOOK.piecesLine({top:{type:'suit',primaryColor:'navy',pattern:'solid'},suitDay:true,tie:t})}});
    ok(/taupe basketweave tie/.test(e.nm)&&!/own/.test(e.nm+e.line),`an own pattern is named by its name ("${e.nm}", "${e.line}")`);
    // ---- right-to-left names keep their place (W2-16-04, W2-16-10)
    e=await p.evaluate(()=>{const suit={id:'a1',type:'suit',primaryColor:'navy',pattern:'solid',name:'بدلة كحلي رسمية'},shirt={id:'a2',type:'shirt',primaryColor:'lightblue',pattern:'solid',name:'قميص سماوي'};
      const box=HOOK.piecesBox({top:suit,suitDay:true,shirt});return {box:(box.match(/<small class="cap">(.*?)<\/small>/)||[])[1],iso:HOOK.nameIso('بدلة'),lat:HOOK.nameHtml('Grey suit'),toast:HOOK.savedTitle(suit)}});
    ok(/^<bdi>بدلة كحلي رسمية<\/bdi> · <bdi>قميص سماوي<\/bdi>$/.test(e.box||'')&&e.iso==='⁨بدلة⁩'&&e.lat==='Grey suit'&&e.toast==='⁨بدلة كحلي رسمية⁩',`Today's pieces line isolates each Arabic name (${e.box}); Latin names unchanged`);
    await p.evaluate(()=>{HOOK.items=[{id:'p1',type:'suit',primaryColor:'navy',pattern:'solid',name:'بدلة سوداء ٢',added:1},{id:'p2',type:'shirt',primaryColor:'white',pattern:'solid',name:'قميص أبيض',added:2},
      {id:'p3',type:'tie',primaryColor:'burgundy',pattern:'solid',added:3},{id:'p4',type:'shoes',primaryColor:'black',added:4},{id:'p5',type:'belt',primaryColor:'black',added:5}];HOOK.cache={};HOOK.openPack()});
    await settle(p,600);
    e=await p.evaluate(()=>[...document.querySelectorAll('#pack .pk-nm')].map(x=>x.innerHTML));
    ok(e.some(h=>/^<bdi>⁨?(بدلة سوداء ٢|قميص أبيض)⁩?<\/bdi> <small>· /.test(h)),`the packing list's Arabic names are in <bdi> (${e.slice(0,3).join(' | ')})`);
    // measured as the audit's replay measured it: the day count's digit sits right of the Arabic name, on the same line, before "days"
    e=await p.evaluate(()=>[...document.querySelectorAll('#pack .pk-nm')].filter(x=>x.querySelector('bdi')&&x.querySelector('small')).map(x=>{const b=x.querySelector('bdi').getBoundingClientRect(),s=x.querySelector('small').firstChild,t=s.textContent,i=t.search(/\d/);
      const r=document.createRange();r.setStart(s,i);r.setEnd(s,i+1);const d=r.getBoundingClientRect();r.setStart(s,t.length-3);r.setEnd(s,t.length);const y=r.getBoundingClientRect();
      return {after:d.left>=b.right-1,days:y.left>=d.right-1,line:Math.abs(d.top-b.top)<4}}));
    ok(e.length>=2&&e.every(r=>r.after&&r.days&&r.line),`the day count stays after the Arabic name (${JSON.stringify(e)})`);
    await p.evaluate(()=>{if('subBack' in HOOK)HOOK.subBack();HOOK.show('wardrobe')});await settle(p,300);
    // ---- Arabic search (W2-16-07)
    e=await p.evaluate(()=>({h:HOOK.wardNorm('أبيض')===HOOK.wardNorm('ابيض'),t:HOOK.wardNorm('بدلة')===HOOK.wardNorm('بدله'),d:HOOK.wardNorm('سوداء ٢').endsWith('2'),y:HOOK.wardNorm('على')===HOOK.wardNorm('علي'),lat:HOOK.wardNorm('Café  Crème')}));
    ok(e.h&&e.t&&e.d&&e.y&&e.lat==='cafe creme',`search treats hamza, ة/ه, ى/ي and Arabic digits alike (${JSON.stringify(e)})`);
    await p.evaluate(()=>{HOOK.wardSearch('2');HOOK.renderWardrobe()});await settle(p,200);
    ok(await p.evaluate(()=>HOOK.wardList().some(i=>i.id==='p1')),'searching 2 finds "بدلة سوداء ٢"');
    await p.evaluate(()=>{HOOK.wardClear()});
    // ---- colors (W2-16-11, W2-16-12, W2-17-05)
    e=await p.evaluate(()=>({fam:HOOK.colFamily('deepblue'),lav:HOOK.colFamily('lavender'),base:HOOK.colBaseFor('#1f4e5a','tie'),hex:HOOK.newColHex({primaryColor:'cream',newColor:{name:'dusty pink'},meas:null}),
      hex2:HOOK.newColHex({primaryColor:'cream',newColor:{name:'heather'},meas:null}),hex3:HOOK.newColHex({primaryColor:'cream',newColor:{name:'dusty pink'},meas:{hex:'#e0d0c0',src:'closeup'}})}));
    ok(e.fam===3&&e.lav===4,`deep blue is listed with the blues (family ${e.fam}), lavender with the purples`);
    ok(e.base!=='lightblue'&&['slate','steelblue','navy','darknavy','deepblue'].includes(e.base),`a dark petrol tie behaves like a dark blue, not light blue (${e.base})`);
    ok(e.hex===COLORS_PINK&&e.hex2===COLORS_CREAM&&e.hex3==='#e0d0c0',`"Add as a new color" opens on the named shade (${e.hex}), the tagged one when the name has no color, a close-up's measurement first`);
    // ---- the new color sheet's error is in its sticky bar, wholly on screen (W2-16-05)
    await p.evaluate(()=>{HOOK.openSettings();HOOK.openCustomNew('colour')});await settle(p,300);
    await p.fill('#cn-name','<x>');await p.evaluate(()=>{HOOK.cnName('<x>');HOOK.colNewAdd()});await settle(p,300);
    e=await p.evaluate(()=>{const er=document.querySelector('#cn-error'),bar=document.querySelector('#col-sheet .cpbar'),r=er&&er.getBoundingClientRect(),b=bar&&bar.getBoundingClientRect();
      const at=r&&document.elementFromPoint(r.left+Math.min(20,r.width/2),r.top+r.height/2);return {t:er&&er.textContent,in:!!(er&&bar.contains(er)),top:r&&r.top,bt:b&&b.top,vh:innerHeight,bottom:r&&r.bottom,hit:!!(at&&er.contains(at))}});
    ok(e.in&&e.top>=e.bt&&e.bottom<=e.vh&&e.hit&&/Use only letters/.test(e.t),`the error shows whole in the sheet's bar (${JSON.stringify(e)})`);
    await p.evaluate(()=>HOOK.closeColPick());
    // ---- a long day-off name (W2-12-02)
    await p.evaluate(()=>{const d=new Date(HOOK.todayDate());d.setDate(d.getDate()+20);const v=HOOK.isoKey(d);HOOK.$('#cfg-off-from').value=v;HOOK.$('#cfg-off-to').value=v;HOOK.$('#cfg-off-name').value='https://intranet.example.com/hr/leave/requests/2026/12/21/extra';return HOOK.addDayOff()});await settle(p,300);
    e=await p.evaluate(()=>{const c=document.querySelector('#off-list .fchip'),b=c&&c.querySelector('button'),r=b&&b.getBoundingClientRect();
      return {n:HOOK.settings.daysOff.map(x=>x.n),max:HOOK.$('#cfg-off-name').maxLength,right:r&&r.right,vw:document.documentElement.clientWidth}});
    ok(e.max===40&&e.n.every(n=>[...n].length<=40)&&e.right<=e.vw,`a long day-off name is cut to 40 and its × stays on screen (${JSON.stringify(e)})`);
    await p.evaluate(()=>HOOK.closeSettings());
    // ---- a watch's Details has a limit (W2-12-04)
    await p.evaluate(()=>{HOOK.items.push({id:'w1',type:'watch',primaryColor:'black',metal:'silver',details:'x'.repeat(300),added:9});HOOK.cache={};HOOK.show('wardrobe');HOOK.renderWardrobe();HOOK.openItem('w1')});await settle(p,500);
    e=await p.evaluate(()=>{const i=document.querySelector('#item-view .wdetails input');return {max:i&&i.maxLength,len:i&&i.value.length}});
    ok(e.max===120&&e.len===120,`a watch's Details field takes at most 120 letters (${JSON.stringify(e)})`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['ownnames',ownnames],['w3ownnames',w3ownnames]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
