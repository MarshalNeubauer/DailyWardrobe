// The Wardrobe tab's search and sort, an item's own name / brand / material / notes, and Delete with Undo (wardrobe.js).
// The sync checks run the real worker.js in Node with an in-memory KV; two browser contexts play two devices.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,settle,ROOT})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    let dialogs=0;p.on('dialog',d=>{dialogs++;d.accept()});
    await p.goto(url);await p.evaluate(()=>{try{localStorage.removeItem('ward_sort')}catch{}});await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{const I=(id,type,primaryColor,added,x={})=>({id,type,primaryColor,pattern:'solid',added,...x});
      items=[I('be1','belt','black',1,{leather:'calf',metal:'silver'}),I('so1','socks','charcoal',2,{material:'merino wool'}),
        I('ti1','tie','burgundy',3,{pattern:'stripe',secondaryColor:'navy',material:'grenadine',brand:'Marlowe & Finch'}),I('ti2','tie','navy',9),
        I('sh1','shirt','white',4,{material:'poplin'}),I('sh2','shirt','lightblue',8,{notes:'Slim fit, bought for the spring conference'}),
        I('su1','suit','navy',5,{name:'Wedding suit',brand:'Halden',material:'wool'}),I('su2','suit','charcoal',6,{pattern:'pinstripe'}),I('su3','suit','lightgrey',7),
        I('bl1','blazer','brown',10,{pattern:'tweed'}),I('sx1','shoes','black',11,{leather:'calf'}),I('sx2','shoes','brown',12,{leather:'suede'})];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];TODAY_OVERRIDE='2026-11-11T12:00:00';cache={};sel=new Date(2026,10,11);view={y:2026,m:10};
      const D=(date,ids)=>({date,ids,suitDay:true,worn:true});
      dayRecs={'2026-11-2':D('2026-11-2',{top:'su2',shirt:'sh1',tie:'ti1',shoes:'sx1',belt:'be1',socks:'so1'}),'2026-11-3':D('2026-11-3',{top:'su1',shirt:'sh1',tie:'ti2',shoes:'sx1',belt:'be1',socks:'so1'}),
        '2026-11-9':D('2026-11-9',{top:'su2',shirt:'sh2',tie:'ti1',shoes:'sx1',belt:'be1',socks:'so1'})};
      editing=null;flt='all';show('wardrobe')});
    const ids=()=>p.evaluate(()=>[...document.querySelectorAll('#wardrobe .grid .gi')].map(g=>g.id.slice(3)));
    const type=async t=>{await p.fill('#wsearch',t);await p.waitForFunction(v=>wardQ===v,t)};
    const count=()=>p.textContent('#wcount');

    // ---- By type: the chips' order, suits first
    const t0=await ids();
    ok(t0.slice(0,3).join()==='su3,su2,su1'&&t0[3]==='bl1'&&t0.indexOf('be1')>t0.indexOf('sx1'),`"All" starts with the suits, then follows the type chips' order (${t0.join(' ')})`);
    ok(await p.evaluate(()=>{const ch=[...document.querySelectorAll('#wardrobe .chip')].map(c=>c.textContent.trim().replace(/ \d+$/,'')).slice(1),seen=[...new Set([...document.querySelectorAll('#wardrobe .gi .gtype')].map(x=>x.textContent))];
      return seen.join()===ch.filter(c=>seen.includes(c)).join()}),'the types appear in the same order as their chips');
    ok((await count())==='12 items'&&await p.evaluate(()=>document.querySelector('#wsort').value==='type'&&document.querySelector('#wclear').hidden),'the header counts the items; the sort control says By type; no clear button on an empty search');

    // ---- search: every field
    const finds=async(q,want,what)=>{await type(q);const got=(await ids()).sort().join();ok(got===want.slice().sort().join(),`search “${q}” finds by ${what} (${got||'nothing'})`)};
    await finds('wedding',['su1'],'name');
    await finds('marlowe',['ti1'],'brand');
    await finds('conference',['sh2'],'notes');
    await finds('grenadine',['ti1'],'material');
    await finds('merino',['so1'],'material on another type');
    await finds('blazer',['bl1'],'type');
    await finds('dress shirt',['sh1','sh2'],'the type\'s full name');
    await finds('light blue',['sh2'],'colour name as shown');
    await finds('burgundy',['ti1'],'colour');
    await finds('pinstripe',['su2'],'pattern');
    await finds('NAVY',['su1','ti1','ti2'],'colour, any case, second colours too');
    await finds('navy tie',['ti1','ti2'],'several words, all of which must match');
    ok((await count())==='2 of 12 items'&&await p.evaluate(()=>!document.querySelector('#wclear').hidden),'the count reads "n of m items" and the clear button shows');
    // typing keeps the field, its focus and the caret
    await p.evaluate(()=>{wardClear();window.__ws=document.querySelector('#wsearch')});
    await p.click('#wsearch');await p.keyboard.type('sui',{delay:20});await p.waitForFunction(()=>wardQ==='sui');
    const f1=await p.evaluate(()=>({same:document.querySelector('#wsearch')===window.__ws,foc:document.activeElement&&document.activeElement.id,val:document.querySelector('#wsearch').value,n:document.querySelectorAll('#wardrobe .gi').length}));
    ok(f1.same&&f1.foc==='wsearch'&&f1.val==='sui'&&f1.n===3,`typing filters as you type without replacing the field or losing focus (${JSON.stringify(f1)})`);
    await p.evaluate(()=>renderWardrobe());
    const f2=await p.evaluate(()=>({foc:document.activeElement&&document.activeElement.id,val:document.querySelector('#wsearch').value,caret:document.querySelector('#wsearch').selectionStart,n:document.querySelectorAll('#wardrobe .gi').length}));
    ok(f2.foc==='wsearch'&&f2.val==='sui'&&f2.caret===3&&f2.n===3,'a full redraw of the Wardrobe (a sync arriving) puts the focus and the caret back');
    await p.keyboard.type('t');await p.waitForFunction(()=>wardQ==='suit');
    ok((await ids()).join()==='su3,su2,su1','and typing carries on');

    // ---- search with a chip
    await type('navy');await p.click('#wardrobe .chip:has-text("Tie")');await p.waitForFunction(()=>flt==='tie');
    ok((await ids()).join()==='ti2,ti1'&&(await count())==='2 of 12 items'&&(await p.inputValue('#wsearch'))==='navy','a type chip narrows the search results, and the search stays when the chip changes');
    // ---- the sheet steps through the filtered list
    await p.evaluate(()=>{flt='all';renderWardrobe();openItem('su1')});await settle(p,500);
    const st0=await p.evaluate(()=>({n:document.querySelector('#ivhead .pcount').textContent,list:wardList().map(i=>i.id).join(),prev:document.querySelector('#iv-prev').disabled}));
    ok(st0.list==='su1,ti2,ti1'&&st0.n==='1 of 3'&&st0.prev,`the open item counts within the filtered list (${st0.n}; ${st0.list})`);
    await p.click('#iv-next');await p.waitForFunction(()=>editing==='ti2');await p.click('#iv-next');await p.waitForFunction(()=>editing==='ti1');
    ok(await p.evaluate(()=>document.querySelector('#iv-next').disabled&&document.querySelector('#ivhead .pcount').textContent==='3 of 3'),'› steps through the filtered, sorted list and stops at its end');
    await p.evaluate(()=>stepItem(-1));
    ok(await p.evaluate(()=>editing==='ti2'),'‹ steps back through it');
    await p.evaluate(()=>closeItem());await settle(p,500);

    // ---- nothing matches
    await type('zzzq');
    const none=await p.evaluate(()=>{const n=document.querySelector('#wnone');return n&&{t:n.textContent,btn:[...n.querySelectorAll('button')].map(b=>b.textContent).join('|'),grid:document.querySelectorAll('#wardrobe .gi').length}});
    ok(none&&/Nothing matches “zzzq”/.test(none.t)&&none.btn==='Clear search'&&none.grid===0&&(await count())==='0 of 12 items',`a search with no result says so and offers to clear it (${none&&none.btn})`);
    await p.evaluate(()=>{flt='belt';renderWardrobe()});await type('navy');
    const none2=await p.evaluate(()=>{const n=document.querySelector('#wnone');return n&&{t:n.textContent,btn:[...n.querySelectorAll('button')].map(b=>b.textContent).join('|')}});
    ok(none2&&/in belt/.test(none2.t)&&/3 items match in the rest/.test(none2.t)&&none2.btn==='Search all types|Clear search','with a chip on, it says how many match elsewhere and offers to search all types');
    await p.click('#wnone button.pri');await p.waitForFunction(()=>flt==='all');
    ok((await ids()).length===3,'"Search all types" shows them');
    await p.click('#wclear');await p.waitForFunction(()=>wardQ==='');
    ok((await ids()).length===12&&(await p.inputValue('#wsearch'))===''&&await p.evaluate(()=>document.activeElement.id==='wsearch'&&document.querySelector('#wclear').hidden),'the clear button empties the search, shows everything and keeps the field in use');

    // ---- sort orders
    const sortBy=async s=>{await p.selectOption('#wsort',s);await p.waitForFunction(v=>wardSort()===v,s);return ids()};
    const sNew=await sortBy('new');
    ok(sNew.join()==='sx2,sx1,bl1,ti2,sh2,su3,su2,su1,sh1,ti1,so1,be1',`Newest first (${sNew.join(' ')})`);
    const sWorn=await sortBy('worn');
    ok(sWorn.slice(0,3).sort().join()==='be1,so1,sx1'&&sWorn.indexOf('su2')<sWorn.indexOf('su1')&&sWorn.indexOf('su1')<sWorn.indexOf('su3'),`Most worn: three wears before two before one before none (${sWorn.join(' ')})`);
    ok(await p.evaluate(()=>/Worn 3 times/.test(document.querySelector('#gi-sx1').textContent)&&/Worn 1 time$/.test(document.querySelector('#gi-su1 .wwear').textContent)&&/Not worn yet/.test(document.querySelector('#gi-su3').textContent)),'each box says how often it was worn');
    const sRest=await sortBy('rest');
    const never=['su3','bl1','sx2'],k=x=>sRest.indexOf(x);
    ok(never.every(x=>k(x)<3)&&[k('su1'),k('sh1'),k('ti2')].sort().join()==='3,4,5'&&k('su2')>5&&k('sx1')>5,`Longest since worn: never worn first, then the longest ago (${sRest.join(' ')})`);
    ok(await p.evaluate(()=>/Last worn/.test(document.querySelector('#gi-sx1 .wwear').textContent)),'each box says when it was last worn');
    const sCol=await sortBy('colour');
    const kc=x=>sCol.indexOf(x);
    ok(kc('sh1')<kc('su3')&&kc('su3')<kc('su2')&&kc('su2')<kc('sx1')&&kc('sx1')<kc('sh2')&&kc('sh2')<kc('su1')&&kc('su1')<kc('bl1')&&kc('bl1')<kc('ti1'),`Colour: families together, light to dark within each (${sCol.join(' ')})`);
    const sAz=await sortBy('az');
    const names=await p.evaluate(()=>[...document.querySelectorAll('#wardrobe .gi .gimeta b')].map(b=>b.textContent.toLowerCase()));
    ok(names.join('|')===names.slice().sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true})).join('|')&&names.includes('wedding suit')&&sAz.length===12,`A to Z by the title shown, a name included (…${names.slice(-2).join(', ')})`);
    await p.reload();await p.waitForFunction(()=>window.appReady);
    ok(await p.evaluate(()=>{show('wardrobe');const s=document.querySelector('#wsort');return (s?s.value:wardSort())==='az'&&/* an empty wardrobe (after the reload) has no sort control */localStorage.getItem('ward_sort')==='az'}),'the sort order is remembered on the device');
    await p.evaluate(()=>{setWardSort('type')});

    // ---- the fields: item sheet
    await p.evaluate(()=>{const I=(id,type,primaryColor,added,x={})=>({id,type,primaryColor,pattern:'solid',added,...x});
      items=[I('su1','suit','navy',5),I('su2','suit','charcoal',6),I('sh1','shirt','white',4),I('sh2','shirt','lightblue',4),I('ti1','tie','burgundy',3),I('ti2','tie','navy',3),I('sx1','shoes','black',11,{leather:'calf'}),I('be1','belt','black',1,{leather:'calf',metal:'silver'}),I('so1','socks','charcoal',2),I('wa1','watch','black',2,{metal:'silver'}),I('co1','overcoat','navy',2)];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,11);view={y:2026,m:10};flt='all';show('wardrobe');openItem('su1')});
    await settle(p,500);
    const mats=()=>p.evaluate(()=>{const s=document.querySelector('#item-view .wmat');return s?[...s.options].map(o=>o.textContent):null});
    const mSuit=await mats();
    ok(mSuit&&mSuit[0]==='None'&&mSuit[mSuit.length-1]==='Other'&&['Wool','Flannel','Tweed','Linen','Seersucker','Velvet'].every(m=>mSuit.includes(m))&&!mSuit.includes('Poplin'),`a suit's materials: None, the suit cloths, Other (${mSuit&&mSuit.length} choices)`);
    ok(await p.evaluate(()=>{const l=[...document.querySelectorAll('#item-view .ivtags>label')].map(x=>x.firstChild.textContent.trim());return l[0]==='Name'&&l[1]==='Brand'&&l.includes('Material')&&l[l.length-1]==='Notes'}),'the Details card has Name and Brand at its top, Material and Notes at its end');
    await p.fill('#item-view .wf-name','Wedding suit');await p.fill('#item-view .wf-brand','Halden');
    await p.selectOption('#item-view .wmat','flannel');await p.waitForFunction(()=>items.find(i=>i.id==='su1').material==='flannel');
    await p.fill('#item-view .wf-notes','Trousers taken in <2cm> & "let out" again');await p.locator('#item-view .wf-notes').blur();
    await p.waitForFunction(()=>{const i=items.find(x=>x.id==='su1');return i.name==='Wedding suit'&&i.brand==='Halden'&&/let out/.test(i.notes||'')});
    const hd=await p.evaluate(()=>({t:document.querySelector('#iv-title').textContent,g:document.querySelector('#gi-su1 .gimeta b').textContent,gt:document.querySelector('#gi-su1 .gtype').textContent,cap:getComputedStyle(document.querySelector('#iv-title')).textTransform}));
    ok(hd.t==='Wedding suit'&&hd.g==='Wedding suit'&&hd.gt==='Suit'&&hd.cap==='none',`the name is the title in the sheet's header and in the grid, shown as typed (${hd.t} / ${hd.g})`);
    const stored=await p.evaluate(async()=>{const r=await tx('readonly',s=>s.get('su1'));return r&&[r.name,r.brand,r.material,r.notes].join('|')});
    ok(stored==='Wedding suit|Halden|flannel|Trousers taken in <2cm> & "let out" again',`all four are saved with the item (${stored})`);
    await p.evaluate(()=>renderWardrobe());
    const shown=await p.evaluate(()=>({n:document.querySelector('#item-view .wf-name').value,b:document.querySelector('#item-view .wf-brand').value,m:document.querySelector('#item-view .wmat').value,t:document.querySelector('#item-view .wf-notes').value}));
    ok(shown.n==='Wedding suit'&&shown.b==='Halden'&&shown.m==='flannel'&&shown.t==='Trousers taken in <2cm> & "let out" again','and shown again when the sheet is redrawn, special characters intact');
    // Other: a field to say which
    await p.selectOption('#item-view .wmat','other');await p.waitForSelector('#item-view .wmat-t');
    await p.fill('#item-view .wmat-t','Alpaca');await p.locator('#item-view .wmat-t').blur();await p.waitForFunction(()=>items.find(i=>i.id==='su1').material==='Alpaca');
    ok(await p.evaluate(()=>document.querySelector('#item-view .wmat').value==='other'&&document.querySelector('#item-view .wmat-t').value==='Alpaca'),'Other opens a field for the material, which is kept');
    await p.selectOption('#item-view .wmat','');await p.waitForFunction(()=>!('material' in items.find(i=>i.id==='su1')));
    await p.waitForFunction(()=>!document.querySelector('#item-view .wmat-t'));
    ok(await p.evaluate(()=>document.querySelector('#item-view .wmat').value===''),'None clears it and the extra field goes');
    await p.selectOption('#item-view .wmat','wool');await p.waitForFunction(()=>items.find(i=>i.id==='su1').material==='wool');
    // material options differ by type
    const per={};for(const id of ['sh1','ti1','so1','co1','sx1','wa1']){await p.evaluate(i=>openItem(i),id);per[id]=await mats()}
    ok(per.sh1.includes('Poplin')&&per.sh1.includes('Oxford')&&!per.sh1.includes('Tweed')&&per.ti1.includes('Silk')&&per.ti1.includes('Grenadine')&&!per.ti1.includes('Poplin')&&per.so1.includes('Merino wool')&&per.co1.includes('Cashmere'),'shirts, ties, socks and coats each offer their own materials');
    ok(per.sx1===null&&per.wa1===null&&await p.evaluate(()=>!!document.querySelector('#item-view .wf-name')&&!!document.querySelector('#item-view .wf-notes')),'shoes and watches (leather, band and metal) have no material list, but a name, brand and notes');
    const lists=await p.evaluate(()=>Object.entries(MATERIALS_BY).map(([t,l])=>[t,l.length,new Set(l).size===l.length&&l.every(m=>m===m.toLowerCase()&&m.length<=40),!!TYPES[t]]));
    ok(lists.length>=8&&lists.every(l=>l[1]>=5&&l[2]&&l[3])&&!lists.some(l=>['shoes','belt','watch'].includes(l[0])),`MATERIALS_BY lists materials for ${lists.map(l=>l[0]).join(', ')}`);
    await p.evaluate(()=>closeItem());await settle(p,500);
    // found by search right away
    await type('halden');ok((await ids()).join()==='su1','the new brand is found by the search');await p.evaluate(()=>wardClear());

    // ---- the name on Today: pieces list and picker; the planner's texts keep the description
    await p.evaluate(()=>{sel=new Date(2026,10,11);show('today');const o=planFor()[key(sel)];window.__top=o.top.id;for(const i of items)delete i.name;const it=items.find(i=>i.id===o.top.id);it.name='Wedding suit';cache={};renderToday()});
    await p.evaluate(()=>{if(typeof toggleList==='function'&&!document.querySelector('#ri-top'))toggleList()});
    const row=await p.evaluate(()=>{const r=document.querySelector('#ri-top .rowtap');return r&&{t:r.querySelector('span:not(.dot)').textContent,a:r.getAttribute('aria-label')}});
    ok(row&&row.t==='Wedding suit'&&/Wedding suit/.test(row.a),`Today's pieces list shows the name (${row&&row.t})`);
    await p.evaluate(()=>openPicker('top'));
    const pk=await p.evaluate(()=>[...document.querySelectorAll('#pick-sheet .pick-it .pick-nm')].map(x=>x.textContent));
    ok(pk.includes('Wedding suit')&&pk.some(t=>/charcoal|navy/i.test(t)),`the piece picker shows the name, and the description for unnamed pieces (${pk.join(' | ')})`);
    await p.evaluate(()=>closePicker());
    const texts=await p.evaluate(()=>{const o=planFor()[key(sel)],it=items.find(i=>i.id===window.__top);return {d:desc(it),nm:nm(it),r:JSON.stringify(rateOutfit(o).checks.map(c=>c.why)),ot:typeof outfitText==='function'?outfitText(o):''}});
    ok(/^(navy|charcoal)$/.test(texts.d)&&/^(navy|charcoal) suit$/.test(texts.nm)&&!/Wedding/.test(texts.r)&&!/Wedding/.test(texts.ot),'the planner\'s rule texts and descriptions keep using the colour description');

    // ---- the Add card: More details, folded
    await p.evaluate(()=>{show('add');addManual();setq(0,'type','tie')});
    const add0=await p.evaluate(()=>({btn:(document.querySelector('#queue .morebtn')||{}).textContent,exp:document.querySelector('#queue .morebtn').getAttribute('aria-expanded'),open:!!document.querySelector('#queue .morein'),
      labs:[...document.querySelectorAll('#queue .card>label')].map(l=>l.firstChild.textContent.trim()).slice(0,4).join()}));
    ok(/^More details/.test(add0.btn)&&add0.exp==='false'&&!add0.open&&add0.labs==='Type,Colour,Second colour,Third colour','the Add card has "More details" folded away, after the tags');
    const h0=await p.evaluate(()=>document.querySelector('#queue .card').getBoundingClientRect().height);
    await p.click('#queue .morebtn');await p.waitForSelector('#queue .morein');
    const addM=await p.evaluate(()=>[...document.querySelector('#queue .wmat').options].map(o=>o.textContent));
    ok(addM.includes('Knitted silk')&&!addM.includes('Poplin')&&await p.evaluate(h=>document.querySelector('#queue .card').getBoundingClientRect().height>h+150,h0),'unfolded it has Name, Brand, Material (a tie\'s) and Notes');
    await p.fill('#queue .wf-name','Club tie');await p.fill('#queue .wf-brand','Marlowe');await p.fill('#queue .wf-notes','A gift');await p.selectOption('#queue .wmat','knitted silk');
    await p.waitForFunction(()=>queue[0].material==='knitted silk'&&queue[0].name==='Club tie');
    ok(await p.evaluate(()=>document.querySelector('#queue .wf-name').value==='Club tie'&&document.querySelector('#queue .wf-notes').value==='A gift'),'what was typed stays when the card redraws');
    await p.click('#queue .morebtn');await p.waitForFunction(()=>!document.querySelector('#queue .morein'));
    ok(/4 filled in/.test(await p.textContent('#queue .morebtn')),'folded again, it says how many are filled in');
    await p.click('#queue .card .btns .pri');await p.waitForFunction(()=>items.some(i=>i.name==='Club tie'));
    const saved=await p.evaluate(()=>{const i=items.find(x=>x.name==='Club tie');return [i.type,i.brand,i.material,i.notes].join('|')});
    ok(saved==='tie|Marlowe|knitted silk|A gift',`Confirm saves them with the item (${saved})`);
    await p.evaluate(()=>{addManual();setq(0,'type','shoes');toggleMore(0)});
    ok(await p.evaluate(()=>!document.querySelector('#queue .wmat')&&!!document.querySelector('#queue .wf-name')),'the Add card offers no material for shoes');
    await p.evaluate(()=>{queue.length=0;renderAdd()});

    // ---- Delete: at once, a toast with Undo, everything back
    await p.evaluate(async()=>{const it=items.find(i=>i.id==='su1');Object.assign(it,{name:'Wedding suit',photo:'data:image/png;base64,AAAA',texture:'data:image/png;base64,BBBB',swatch:'data:image/png;base64,CCCC',swSrc:'tex',paused:true,shade:2,secondaryColor:'grey',pattern:'pinstripe',season:'cold',vest:'no',sett:{v:2,a:0,bands:[['#112233',3],['#ffffff',1]]}});await put(it);
      await saveDay({date:'2026-11-3',ids:{top:'su1',shirt:'sh1',tie:'ti1',shoes:'sx1',belt:'be1',socks:'so1'},suitDay:true,worn:true},true);await saveDay({date:'2026-11-17',force:{top:'su1'}},true);
      window.__before=JSON.stringify(items.find(i=>i.id==='su1'));window.__order=items.map(i=>i.id).join();window.__days=JSON.stringify([dayRecs['2026-11-3'],dayRecs['2026-11-17']]);
      show('wardrobe');openItem('su1')});
    await settle(p,500);dialogs=0;
    await p.click('#item-view .ivdel button');await p.waitForFunction(()=>!items.some(i=>i.id==='su1'));
    const gone=await p.evaluate(async()=>({sheet:document.querySelector('#item-view').classList.contains('on'),grid:!!document.querySelector('#gi-su1'),db:!!(await tx('readonly',s=>s.get('su1'))),tomb:!!((await metaGet('tombstones'))||{}).su1,
      toast:document.querySelector('#toast').textContent,on:document.querySelector('#toast').classList.contains('on'),btn:(document.querySelector('#toast button')||{}).textContent}));
    ok(dialogs===0&&!gone.sheet&&!gone.grid&&!gone.db&&gone.tomb,'Delete removes the item at once, without asking, and closes the sheet');
    ok(gone.on&&/^Deleted Wedding suit/.test(gone.toast)&&gone.btn==='Undo'&&await p.evaluate(()=>WARD_UNDO_MS===8000),`a toast says "Deleted Wedding suit" with Undo, for 8 seconds (${gone.toast})`);
    await p.click('#toast button');await p.waitForFunction(()=>items.some(i=>i.id==='su1'));
    const back=await p.evaluate(async()=>{const strip=o=>{const c={...o};delete c.updated;return JSON.stringify(c)},it=items.find(i=>i.id==='su1'),db=await tx('readonly',s=>s.get('su1')),tomb=(await metaGet('tombstones')).su1;
      return {same:strip(it)===strip(JSON.parse(window.__before)),db:strip(db)===strip(JSON.parse(window.__before)),newer:it.updated>tomb,order:items.map(i=>i.id).join()===window.__order,grid:!!document.querySelector('#gi-su1'),
        paused:document.querySelector('#gi-su1').classList.contains('paused'),days:JSON.stringify([dayRecs['2026-11-3'],dayRecs['2026-11-17']])===window.__days,past:(planMonth(2026,10)['2026-11-3'].top||{}).id}});
    ok(back.same&&back.db&&back.order&&back.grid&&back.paused,'Undo puts the item back as it was: same id, photo, close-up, tags, fields, rotation state, and its place in the wardrobe');
    ok(back.days&&back.past==='su1','the days that referred to it still do');
    ok(back.newer,'its stamp is newer than the deletion\'s, so it wins a sync');
    // a day changed while it was gone is put back too
    await p.evaluate(()=>{openItem('su1')});await settle(p,400);await p.click('#item-view .ivdel button');await p.waitForFunction(()=>!items.some(i=>i.id==='su1'));
    await p.evaluate(async()=>{const r={...dayRecs['2026-11-17']};delete r.force;await saveDay(r,true)});
    await p.click('#toast button');await p.waitForFunction(()=>items.some(i=>i.id==='su1'));
    await p.waitForFunction(()=>dayRecs['2026-11-17'].force&&dayRecs['2026-11-17'].force.top==='su1');
    ok(true,'a day re-planned without it meanwhile gets it back on Undo');
    ok(errs.length===0,'no page errors'+(errs.length?': '+errs.join('; '):''));
    await ctx.close();

    // ---- sizes and no sideways scroll, 320 / 390 / 626px, light and dark
    for(const scheme of ['light','dark'])for(const w of [320,390,626]){
      const c=await browser.newContext({viewport:{width:w,height:800},colorScheme:scheme,isMobile:true,hasTouch:true});const q=await c.newPage();
      await q.goto(url);await q.waitForFunction(()=>window.appReady);
      await q.evaluate(()=>{const I=(id,type,primaryColor,added,x={})=>({id,type,primaryColor,pattern:'solid',added,...x});
        items=[I('su1','suit','navy',5,{name:'The very long name of a suit that was bought for a wedding in May',brand:'Halden',material:'wool',notes:'n'}),I('sh1','shirt','white',4),I('ti1','tie','burgundy',3),I('sx1','shoes','black',11,{leather:'calf'})];
        settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};flt='all';show('wardrobe')});
      await q.waitForFunction(()=>!document.querySelector('#wardrobe').getAnimations().length);   // the page has eased in (pageIn): measured where it rests
      const m=await q.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),inp=r('#wsearch'),so=r('#wsort'),cs=getComputedStyle(document.querySelector('#wsearch')),chips=r('#wardrobe .chips'),lum=c=>{const v=c.match(/[\d.]+/g).map(Number);return v[0]*.3+v[1]*.59+v[2]*.11};
        return {ih:Math.round(inp.height),sh:Math.round(so.height),iw:Math.round(inp.width),above:inp.bottom<=chips.top,row:Math.abs(inp.top-so.top)<1,rad:cs.borderRadius,over:document.documentElement.scrollWidth-innerWidth,
          contrast:Math.abs(lum(cs.color)-lum(cs.backgroundColor)),bg:lum(cs.backgroundColor),right:Math.round(so.right)<=innerWidth}});
      ok(m.ih===44&&m.sh===44&&m.rad==='12px'&&m.above&&m.row&&m.iw>=120&&m.right&&m.over<=0,`${w}px ${scheme}: the search field and sort control are 44px tall on one row above the chips, nothing scrolls sideways (${m.iw}px field)`);
      ok(m.contrast>120&&(scheme==='dark'?m.bg<80:m.bg>180),`${w}px ${scheme}: the field follows the theme (background ${Math.round(m.bg)}, text contrast ${Math.round(m.contrast)})`);
      await q.fill('#wsearch','zzzq');await q.waitForSelector('#wnone');
      const e=await q.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,btn:[...document.querySelectorAll('#wnone button,#wclear')].map(b=>Math.round(b.getBoundingClientRect().height)).join()}));
      ok(e.over<=0&&e.btn==='44,44',`${w}px ${scheme}: the "nothing matches" state fits, its buttons 44px (${e.btn})`);
      await q.evaluate(()=>{wardClear();openItem('su1')});await settle(q,500);
      const iv=await q.evaluate(()=>{const v=document.querySelector('#item-view'),b=v.querySelector('#ivbody'),h=s=>[...v.querySelectorAll(s)].map(x=>Math.round(x.getBoundingClientRect().height));
        const ta=v.querySelector('.wf-notes'),tr=ta.getBoundingClientRect(),card=v.querySelector('.ivtags').getBoundingClientRect(),t=v.querySelector('#iv-title').getBoundingClientRect();
        return {inp:[...new Set(h('select,input[type=text]'))].join(),over:b.scrollWidth-b.clientWidth,ta:tr.height>=60&&tr.left>=card.left&&tr.right<=card.right,title:t.right<=innerWidth,del:h('.ivdel button').join(),
          grid:[...document.querySelectorAll('#wardrobe .gi')].every(g=>g.getBoundingClientRect().right<=innerWidth+.5)}});
      ok(iv.inp==='44'&&iv.over<=0&&iv.ta&&iv.title&&iv.del==='44'&&iv.grid,`${w}px ${scheme}: the sheet's new fields are 44px, the notes box fits its card, a long name doesn't push anything sideways (${JSON.stringify(iv)})`);
      await q.evaluate(()=>{closeItem();show('add');addManual();setq(0,'type','suit');toggleMore(0)});
      const ad=await q.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,h:[...new Set([...document.querySelectorAll('#queue .morefold button,#queue .morein select,#queue .morein input')].map(x=>Math.round(x.getBoundingClientRect().height)))].join()}));
      ok(ad.over<=0&&ad.h==='44',`${w}px ${scheme}: the Add card's More details fits, controls 44px (${ad.h})`);
      await c.close()}

    // ---- sync between two devices, and backup / restore
    const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
    const store=new Map(),meta=new Map();
    const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k)},
      list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
    const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobefields.test/';
    const device=async(linked=true)=>{const c=await browser.newContext();
      await c.route(HOST+'**',async route=>{const r=route.request();
        const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const pg=await c.newPage();const er=[];pg.on('pageerror',e=>er.push(e.message));pg.on('dialog',d=>d.accept());
      await pg.goto(url);if(linked){await pg.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await pg.reload()}
      await pg.waitForFunction(()=>window.appReady);return {c,p:pg,errs:er}};
    const sync=pg=>pg.evaluate(()=>syncNow());
    const fields=(pg,id)=>pg.evaluate(id=>{const i=items.find(x=>x.id===id);return i?[i.name,i.brand,i.material,i.notes].join('|'):null},id);
    const A=await device(),B=await device();
    await A.p.evaluate(async()=>{for(const it of [{id:'s-tie',type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now(),name:'Club tie',brand:'Marlowe',material:'grenadine',notes:'A gift'},{id:'s-suit',type:'suit',primaryColor:'grey',pattern:'solid',added:Date.now()}]){await put(it);items.push(it)}
      await saveDay({date:'2026-11-3',ids:{top:'s-suit',tie:'s-tie'},suitDay:true,worn:true})});
    await sync(A.p);await sync(B.p);
    ok((await fields(B.p,'s-tie'))==='Club tie|Marlowe|grenadine|A gift','name, brand, material and notes reach the other device with the item');
    await B.p.evaluate(()=>{show('wardrobe');openItem('s-tie')});await B.p.fill('#item-view .wf-notes','A gift, 2024');await B.p.locator('#item-view .wf-notes').blur();
    await B.p.waitForFunction(()=>items.find(i=>i.id==='s-tie').notes==='A gift, 2024');await B.p.evaluate(()=>closeItem());
    await sync(B.p);await sync(A.p);
    ok((await fields(A.p,'s-tie'))==='Club tie|Marlowe|grenadine|A gift, 2024','an edit to one of them on the second device comes back to the first');
    // backup file → an empty device
    const file=await A.p.evaluate(async()=>JSON.stringify({app:'daily-wardrobe',version:1,exported:new Date().toISOString(),...await localState()}));
    const C=await device(false);
    await C.p.evaluate(async f=>{await restoreBackup(new File([f],'backup.json',{type:'application/json'}))},file);
    ok((await fields(C.p,'s-tie'))==='Club tie|Marlowe|grenadine|A gift, 2024','a backup file carries them, and restoring it on an empty device brings them back');
    await C.c.close();
    // delete then Undo: the item survives a sync, on both devices
    const del=async pg=>{await pg.evaluate(()=>{show('wardrobe');openItem('s-tie')});await pg.click('#item-view .ivdel button');await pg.waitForFunction(()=>!items.some(i=>i.id==='s-tie'))};
    await del(A.p);await A.p.click('#toast button');await A.p.waitForFunction(()=>items.some(i=>i.id==='s-tie'));
    await sync(A.p);await sync(B.p);await sync(A.p);
    ok((await fields(A.p,'s-tie'))==='Club tie|Marlowe|grenadine|A gift, 2024'&&(await fields(B.p,'s-tie'))==='Club tie|Marlowe|grenadine|A gift, 2024','deleted and undone before a sync: the item is on both devices afterwards');
    // the deletion had already reached the other device when it was undone
    await del(A.p);await sync(A.p);await sync(B.p);
    ok((await fields(B.p,'s-tie'))===null,'a deletion reaches the other device');
    await A.p.click('#toast button');await A.p.waitForFunction(()=>items.some(i=>i.id==='s-tie'));await sync(A.p);await sync(B.p);await sync(A.p);
    const both=[await fields(A.p,'s-tie'),await fields(B.p,'s-tie')];
    ok(both[0]==='Club tie|Marlowe|grenadine|A gift, 2024'&&both[1]===both[0],'Undo after the deletion had synced: the item comes back on the other device too, and stays');
    ok(await B.p.evaluate(()=>dayRecs['2026-11-3'].ids.tie==='s-tie'&&items.some(i=>i.id==='s-tie')),'and the day it was worn on still refers to it there');
    await A.p.reload();await A.p.waitForFunction(()=>window.appReady);
    ok((await fields(A.p,'s-tie'))==='Club tie|Marlowe|grenadine|A gift, 2024','the restored item is still there after reopening the app');
    // delete without Undo propagates and stays deleted
    await del(A.p);await A.p.evaluate(()=>{const t=document.querySelector('#toast');t.classList.remove('on','act')});
    await sync(A.p);await sync(B.p);await sync(A.p);await sync(B.p);
    ok((await fields(A.p,'s-tie'))===null&&(await fields(B.p,'s-tie'))===null&&await B.p.evaluate(()=>items.some(i=>i.id==='s-suit')),'a delete that is not undone goes from both devices and stays gone; the rest stays');
    ok(A.errs.length+B.errs.length===0,'no page errors on either device'+(A.errs.concat(B.errs).length?': '+A.errs.concat(B.errs).join('; '):''));
  }finally{await browser.close()}
};
