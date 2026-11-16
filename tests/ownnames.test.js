// Own colour and pattern names are text, never HTML (2026-11-15, the re-audit's N4: a name like `<img src=x onerror=…>` ran in the colour
// button, the picker's tiles and the pattern button, came back on every reopen and synced). A typed name with < > " = etc. is refused; a
// name arriving by sync (or saved before) is cleaned where it is applied (applyCustom); every place shows it escaped. Also: "Gray",
// "Dark gray", "Light gray" are taken (they are Grey's spellings); the phone's Back with the colour or pattern sheet up closes only the
// sheet, on the item sheet, on Add and over Settings; the item sheet refuses a close-up under TEX_MIN_PX as Add does.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{errs.push('dialog '+d.message());d.dismiss()});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    // ---- a synced settings.custom carrying HTML in its names (as another device or an old copy could)
    await p.evaluate(()=>{window.__pwned=0;
      settings.custom={colors:[{key:'ownimgsrcxonerror',name:'<img src=x onerror=__pwned++>',hex:'#c06080',base:'pink',types:['tie'],accent:false}],
        patterns:[{key:'own-bad',name:'<img src=y onerror=__pwned++>',desc:'<b onmouseover=x>hi</b>',base:'woven',types:['tie']}]};
      applyCustom(settings.custom);
      items=[{id:'t1',type:'tie',primaryColor:'ownimgsrcxonerror',pattern:'own-bad',added:1},{id:'t2',type:'tie',primaryColor:'navy',pattern:'solid',added:2},{id:'s1',type:'suit',primaryColor:'navy',pattern:'solid',added:3}];
      cache={};show('wardrobe');renderWardrobe()});
    await settle(p,200);
    await p.evaluate(()=>openItem('t1'));await settle(p,500);
    let e=await p.evaluate(()=>({imgs:document.querySelectorAll('#item-view .colbtn img').length,col:(document.querySelector('#item-view .colbtn[data-k="primaryColor"] .colnm')||{}).textContent,
      pat:(document.querySelector('#item-view .patbtn .colnm')||{}).textContent,name:COLOR_NAMES.ownimgsrcxonerror,pname:CUSTOM_PAT['own-bad'].name,desc:CUSTOM_PAT['own-bad'].desc}));
    ok(e.imgs===0&&!/[<>=]/.test(e.col+e.pat+e.name+e.pname)&&!/[<>]/.test(e.desc)&&/img src x onerror/i.test(e.col)&&/img src y onerror/i.test(e.pat),
      `a synced name with HTML is cleaned and shown as text on the item sheet (color "${e.col}", pattern "${e.pat}", desc "${e.desc}")`);
    await p.evaluate(()=>openColPick('e','t1','primaryColor'));await settle(p,200);
    e=await p.evaluate(()=>({imgs:document.querySelectorAll('#col-sheet img:not(.cpph img)').length,own:[...document.querySelectorAll('#col-sheet .cnown .cpnm')].map(x=>x.textContent),cap:document.querySelector('#col-sheet .cpbig figcaption').textContent,bar:document.querySelector('#col-sheet .cpbar button').textContent}));
    ok(e.imgs===0&&e.own.some(t=>/img src x/i.test(t))&&/img src x/i.test(e.cap)&&/^Keep /.test(e.bar),`the color sheet's tiles, big swatch and button show it as text (${e.own.join(' | ')})`);
    await p.evaluate(()=>{closeColPick();openColPick('e','t1','pattern')});await settle(p,200);
    e=await p.evaluate(()=>({imgs:document.querySelectorAll('#col-sheet .cnown img').length,own:[...document.querySelectorAll('#col-sheet .cnown .cpnm')].map(x=>x.textContent)}));
    ok(e.imgs===0&&e.own.some(t=>/img src y/i.test(t)),`the pattern sheet's own tiles show it as text (${e.own.join(' | ')})`);
    await p.evaluate(()=>{closeColPick();closeItem()});await settle(p,500);
    await p.evaluate(()=>{openSettings();renderCustomUI()});await settle(p,200);
    ok(await p.evaluate(()=>document.querySelectorAll('#custom-list img').length===0),'Settings\' list of own colors and patterns shows them as text');
    await p.evaluate(()=>closeSettings());
    ok(await p.evaluate(()=>window.__pwned===0),'no name ran as code');
    // ---- typing a name: HTML refused with a plain message; a straight apostrophe and & are kept as ’ and "and"
    e=await p.evaluate(async()=>{const r={};const add=async n=>{try{return await addCustomColor({name:n,hex:'#aa5566',base:'pink',types:['tie']})}catch(x){return 'ERR '+x.message}};
      r.html=await add('<img src=x onerror=a()//');r.quote=await add('Sage "x"');r.eq=await add('a=b color');
      r.ok=await add("Bishop's purple");r.amp=await add('Salt & pepper');
      r.okName=(settings.custom.colors.find(c=>c.key===r.ok)||{}).name;r.ampName=(settings.custom.colors.find(c=>c.key===r.amp)||{}).name;
      r.pat=await addCustomPattern({name:'<svg onload=x>',desc:'',base:'woven',types:['tie']}).catch(x=>'ERR '+x.message);return r});
    ok(/^ERR Use only letters/.test(e.html)&&/^ERR Use only letters/.test(e.quote)&&/^ERR Use only letters/.test(e.eq)&&/^ERR Use only letters/.test(e.pat),`a typed name with < > " = is refused (${e.html})`);
    ok(e.okName==='Bishop’s purple'&&e.ampName==='Salt and pepper',`an apostrophe and & are kept as ’ and "and" (${e.okName}, ${e.ampName})`);
    // ---- the greys' other spellings are taken
    e=await p.evaluate(async()=>{const r={};for(const n of ['Gray','Dark gray','Light gray','Mid gray','gray']){try{await addCustomColor({name:n,hex:'#e0a0b0',base:'pink',types:['tie']});r[n]='added'}catch(x){r[n]=x.message}}
      try{await addCustomColor({name:'Cognac',hex:'#9a4a20',base:'brown',types:['shoes','belt']});r.Cognac='added'}catch(x){r.Cognac=x.message}return r});
    ok(['Gray','Dark gray','Light gray','Mid gray','gray'].every(n=>/already a color/.test(e[n]))&&e.Cognac==='added',`"Gray", "Dark gray", "Light gray" are refused as Gray's spellings; "Cognac" is free (${JSON.stringify(e)})`);
    // ---- Back with the colour sheet up closes only the sheet: the item sheet
    await p.evaluate(()=>openItem('t2'));await settle(p,500);
    await p.click('#item-view .colbtn[data-k="primaryColor"]');await settle(p,200);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!colPick,null,{timeout:3000}).catch(()=>{});await settle(p,300);
    e=await p.evaluate(()=>({sheet:document.querySelector('#col-sheet').classList.contains('on'),editing}));
    ok(!e.sheet&&e.editing==='t2',`Back on the item sheet's color sheet closes the color sheet and keeps the item open (${JSON.stringify(e)})`);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>!editing,null,{timeout:3000}).catch(()=>{});await settle(p,500);
    ok(await p.evaluate(()=>!editing),'the next Back closes the item sheet');
    // the pattern sheet, and a "New colour" sheet opened from the list (‹ back to the list first)
    await p.evaluate(()=>openItem('t2'));await settle(p,500);await p.click('#item-view .patbtn');await settle(p,200);
    await p.evaluate(()=>history.back());await settle(p,400);
    ok(await p.evaluate(()=>!colPick&&editing==='t2'),'Back on the pattern sheet closes it and keeps the item');
    await p.click('#item-view .colbtn[data-k="primaryColor"]');await settle(p,200);await p.click('#cn-open');await settle(p,200);
    await p.evaluate(()=>history.back());await settle(p,400);
    e=await p.evaluate(()=>({on:!!colPick,newc:!!(colPick&&colPick.newc),title:(document.querySelector('#col-title')||{}).textContent,editing}));
    ok(e.on&&!e.newc&&e.title==='Choose the color'&&e.editing==='t2',`Back on "New color" goes back to the color list (${JSON.stringify(e)})`);
    await p.evaluate(()=>history.back());await settle(p,400);
    ok(await p.evaluate(()=>!colPick&&editing==='t2'),'… and the next Back closes the color sheet, the item still open');
    // "Use" after that changes nothing hidden: the sheet is gone, the tie still navy
    ok(await p.evaluate(()=>items.find(x=>x.id==='t2').primaryColor==='navy'),'the item keeps its color');
    await p.evaluate(()=>closeItem());await settle(p,500);
    // ---- the Add page
    await p.evaluate(()=>{show('wardrobe');openAdd()});await settle(p,300);
    await p.evaluate(()=>{addManual();renderAdd()});await settle(p,200);
    await p.click('#add .colbtn[data-k="primaryColor"]');await settle(p,200);
    await p.evaluate(()=>history.back());await settle(p,400);
    e=await p.evaluate(()=>({sheet:!!colPick,add:!document.querySelector('#add').hidden}));
    ok(!e.sheet&&e.add,`Back on an Add card's color sheet closes the sheet and stays on Add (${JSON.stringify(e)})`);
    // (the card is in the "Add without a photo" sheet: the next Back closes that, untouched, so nothing is asked)
    await p.evaluate(()=>history.back());await settle(p,400);
    e=await p.evaluate(()=>({nps:!!document.querySelector('#nps-sheet.on'),add:!document.querySelector('#add').hidden,asking:!!asking}));
    ok(!e.nps&&e.add&&!e.asking,`the next Back closes the "Add without a photo" sheet and stays on Add (${JSON.stringify(e)})`);
    await p.evaluate(()=>history.back());await p.waitForFunction(()=>document.querySelector('#add').hidden,null,{timeout:3000}).catch(()=>{});await settle(p,300);
    ok(await p.evaluate(()=>document.querySelector('#add').hidden&&!document.querySelector('#wardrobe').hidden),'the next Back leaves Add for the Wardrobe');
    // ---- over Settings (Your colours & patterns → + New colour)
    await p.evaluate(()=>{openSettings();openCustomNew('colour')});await settle(p,300);
    await p.evaluate(()=>history.back());await settle(p,400);
    ok(await p.evaluate(()=>!colPick&&settingsOpen()),'Back on Settings\' "New color" closes it and keeps Settings open');
    await p.evaluate(()=>closeSettings());await settle(p,200);
    // ---- the item sheet refuses a close-up under TEX_MIN_PX, as Add does
    e=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=40;c.getContext('2d').fillStyle='#345';c.getContext('2d').fillRect(0,0,40,40);
      const b=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([b],'x.png',{type:'image/png'});
      await replaceTexture('t2',f);return {tex:!!items.find(x=>x.id==='t2').texture,toast:document.querySelector('#toast').textContent}});
    ok(!e.tex&&/too small to show the weave \(40×40/.test(e.toast),`the item sheet refuses a 40×40 close-up (${e.toast})`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}};
