// The new-user audit's import and sample findings (2026-11-15): the sample wardrobe tapped twice or cut off part-way, the sample from the
// setup's last step, the sample and the dress code, removing the sample (its day records, pieces the owner changed, one write), the sample's
// marks, item pictures for the sample; the import's double tap, all-or-nothing write, re-import, Undo and "Take them out", its words
// (everyday colours, plurals, each type's colours, materials, Kind, patterns, empty cells), files (Windows-1252, empty) and the template.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const open=async(o={})=>{const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));if(o.init)await p.addInitScript(o.init);await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(typeof setupClose==='function'&&document.querySelector('#setup.on'))setupClose()});return p};
  const dups=p=>p.evaluate(async()=>{const st=await tx('readonly',s=>s.getAll()),sig=st.filter(i=>i.sample).map(kitSampleSig);
    return {mem:items.length,disk:st.length,sample:sig.length,dupSig:sig.length-new Set(sig).size,dupId:items.length-new Set(items.map(i=>i.id)).size}});
  try{
    /* ---- the sample tapped twice ---- */
    const p=await open();
    await p.evaluate(()=>{show('today');renderToday()});
    await p.evaluate(()=>{const b=document.querySelector('#firstrun #kit-sample-link');b.click();b.click();setTimeout(()=>b.click(),150)});
    await p.waitForFunction(()=>items.length>=24&&!kitSampling);await p.waitForTimeout(400);
    const a=await dups(p);
    ok(a.mem===24&&a.disk===24&&a.sample===24&&!a.dupSig&&!a.dupId,`a double (and triple) tap on "Try a sample wardrobe" loads it once (${JSON.stringify(a)})`);
    const again=await p.evaluate(async()=>{await kitSampleLoad();return {n:items.length,t:document.querySelector('#toast').textContent}});
    ok(again.n===24&&/already here/.test(again.t),'tapping it again later adds nothing and says the sample is already here');
    /* a partial sample (cut off by iOS before this fix) is completed, not doubled */
    const part=await p.evaluate(async()=>{const s=items.filter(i=>i.sample).slice(9);await kitDelMany(s.map(i=>i.id));const n0=items.length;await kitSampleLoad();
      return {n0,t:document.querySelector('#toast').textContent}});
    const a2=await dups(p);
    ok(part.n0===9&&a2.mem===24&&a2.disk===24&&!a2.dupSig&&/rest of the sample/.test(part.t),`a partial sample (9 pieces) is completed to 24 with no piece twice (${JSON.stringify(a2)}, "${part.t}")`);
    /* the marks: the grid's tag, the item sheet's note, Keep it as mine */
    const mk=await p.evaluate(()=>{show('wardrobe');renderWardrobe();const tags=document.querySelectorAll('#wardrobe .sampletag').length;const it=items.find(i=>i.type==='pants'&&i.trouserKind==='chinos');
      const gt=document.querySelector('#gi-'+it.id+' .gtype').textContent;openItem(items[0].id);return {tags,gt,note:!!document.querySelector('#item-view .ivsample #iv-keep')}});
    ok(mk.tags===24&&mk.note,'every sample piece is tagged "Sample" in the grid, and its item sheet says so with "Keep it as mine"');
    ok(mk.gt==='Chinos','chinos are called Chinos in the grid, not Trousers');
    await p.click('#iv-keep');await p.waitForFunction(()=>!items[0].sample&&/yours now/.test(document.querySelector('#toast').textContent)).catch(()=>{});
    const kp=await p.evaluate(()=>({note:!!document.querySelector('#item-view .ivsample'),tag:!!document.querySelector('#gi-'+items[0].id+' .sampletag'),grid:!!document.querySelector('#gi-'+items[0].id),ward:!document.querySelector('#wardrobe').hidden,ed:editing}));
    ok(!kp.note&&!kp.tag,'"Keep it as mine" makes it his: the note and the tag go '+JSON.stringify(kp));
    await p.evaluate(()=>closeItem());
    /* item pictures leave the sample out */
    ok(await p.evaluate(()=>missingItemPics().every(i=>!i.sample)&&missingItemPics().length<=1),'"Generate item pictures" offers none of the sample\'s pieces');
    /* ---- removing the sample: day records, a piece he changed, one write ---- */
    const rm=await p.evaluate(async()=>{const s=items.filter(i=>i.sample),shirt=s.find(i=>i.type==='shirt');
      shirt.name='My white shirt';shirt.added=Date.now()-60000;await put(shirt);   // changed after it was added
      const suit=s.find(i=>i.type==='suit');
      await saveDay({date:'2026-11-10',ids:{top:suit.id,shirt:shirt.id},suitDay:true,worn:true});
      await saveDay({date:'2026-11-12',ids:{top:suit.id},occasion:'wedding',force:{top:suit.id}});
      await saveDay({date:'2026-11-13',lock:{top:suit.id}});
      return {kept:shirt.id,mine:items[0].id,gone:s.filter(i=>i!==shirt).map(i=>i.id)}});
    await p.evaluate(()=>{show('today');renderToday()});
    await p.click('#kit-sample button:has-text("Remove the sample")');await p.waitForSelector('#ask-ok');
    const q=await p.textContent('#ask-title');
    ok(/Remove the 22 sample pieces/.test(q)&&/the sample piece you changed: it is yours now/.test(await p.textContent('#ask-sheet')),'it asks to remove the pieces he didn\'t change and says the one he changed stays ('+q+')');
    await p.click('#ask-ok');await p.waitForFunction(()=>!items.some(i=>i.sample)&&!kitSampling);
    const r=await p.evaluate(async({kept,mine,gone})=>{const st=await tx('readonly',s=>s.getAll()),days=await txs('days','readonly',s=>s.getAll()),d=k=>days.find(x=>x.date===k)||{},tomb=await metaGet('tombstones');
      const left=JSON.stringify(days)+JSON.stringify(dayRecs);
      return {refs:gone.filter(id=>left.includes(id)).length,n:st.length,ids:st.map(i=>i.id).sort().join(),want:[kept,mine].sort().join(),flag:st.some(i=>i.sample),d10:d('2026-11-10'),d12:d('2026-11-12'),d13:d('2026-11-13'),mem:JSON.stringify(dayRecs['2026-11-10']),tombs:Object.keys(tomb||{}).length}},rm);
    ok(r.n===2&&r.ids===r.want&&!r.flag,'Remove the sample takes the 22 out; the piece he changed and the one he kept stay, no longer sample');
    ok(r.refs===0&&r.d10.worn===true&&r.d10.ids&&r.d10.ids.shirt===rm.kept&&r.d10.gone&&r.d10.gone.top&&!r.d12.force&&r.d12.occasion==='wedding'&&!r.d13.lock,'the days that recorded sample pieces lose them (worn days, picks, locks) and keep the rest: worn, his own piece, an occasion '+JSON.stringify([r.d10,r.d12,r.d13,r.mem]));
    ok(r.tombs>=22,'each removed piece leaves a tombstone, so it goes from every device');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    /* ---- the sample from the setup's last step finishes the setup ---- */
    const s=await open({init:()=>{localStorage.setItem('tour_seen','1')}});
    await s.evaluate(()=>{setupOpen(false);setup.at=SETUP_STEPS.length-1;setupDraw()});
    await s.click('#setup #kit-sample-link');await s.waitForFunction(()=>items.length===24&&!kitSampling);
    await s.waitForFunction(()=>settings.holidays&&settings.holidays.country,null,{timeout:8000}).catch(()=>{});
    const st=await s.evaluate(async()=>{const m=await metaGet('settings');return {shown:setupShown(),done:!!(m&&m.setupDone),vest:settings.vestMode,hol:settings.holidays&&settings.holidays.country,today:!document.querySelector('#today').hidden}});
    ok(!st.shown&&st.done&&st.vest==='never'&&st.hol==='KW'&&st.today,`from the setup's last step the setup is finished first: done stored, no vest, the time zone's holidays (${JSON.stringify(st)})`);
    ok(!s.errs.length,'no page errors: '+s.errs.join(' | '));await s.context().close();
    /* ---- the sample follows the dress code ---- */
    const d=await open();
    const dc=await d.evaluate(async()=>{settings.dress={jacket:false,tie:false};await kitSampleLoad();const c={};for(const i of items)c[i.type]=(c[i.type]||0)+1;return c});
    ok(!dc.suit&&!dc.blazer&&!dc.tie&&dc.pants===4&&dc.shirt===5,`without jackets and ties the sample has no suits, blazers or ties, and four pairs of trousers (${JSON.stringify(dc)})`);
    await d.context().close();
    /* ---- import ---- */
    const m=await open();
    const rd=await m.evaluate(()=>{const R=t=>kitRead(t).rows.map(x=>x.ok?[x.card.type,x.card.primaryColor,x.card.pattern,x.card.trouserKind||x.card.shoeStyle||'',x.card.material||x.card.leather||'',x.probs.join('/')].join(':'):'bad:'+x.why);
      return {col:R('Type,Colour\nShirt,Charcoal grey\nSuit,Medium grey\nShoes,Dark brown\nShirt,Pale blue\nShirt,Sky blue\nTie,Maroon\nSuit,Midnight blue\nBelt,Cognac\nShirt,light-blue\nShirt,Heather grey\n'),
        typ:R('Type,Colour\nBlazers,Navy\nJackets,Navy\nBelts,Black\nWatches,Silver\nTie clips,Silver\nOvercoats,Navy\nRaincoats,Khaki\nDress shirts,White\nCufflink,Silver\nSweater,Navy\n'),
        fit:R('Type,Colour\nShoes,Pink\nSuit,Pink\nShirt,Red\n'),
        mat:R('Type,Colour,Material,Kind,Pattern\nSuit,Navy,Wool,,Striped\nShirt,White,Poplin,,Bengal stripe\nTie,Navy,SILK,,Repp\nShoes,Brown,Suede,,\nBelt,Black,Leather,,\nTrousers,Stone,,chinos,\nWatch,Silver,Steel,,\n'),
        empty:R('Type,Colour\n,Navy\nSuit,\n')}});
    ok(rd.col.slice(0,9).every(x=>!/^bad/.test(x))&&rd.col[0].startsWith('shirt:charcoal')&&rd.col[3].startsWith('shirt:lightblue')&&rd.col[4].startsWith('shirt:lightblue')&&rd.col[5].startsWith('tie:burgundy')&&rd.col[8].startsWith('shirt:lightblue:')&&/read as/.test(rd.col[4]),
      'everyday colours are read as the app\'s and the preview says so: '+rd.col.join(' | '));
    ok(rd.typ.slice(0,9).map(x=>x.split(':')[0]).join()==='blazer,blazer,belt,watch,tieclip,overcoat,raincoat,shirt,cufflinks'&&/isn't a type the app plans\. It plans suits/.test(rd.typ[9]),'plural and everyday type names are read; an unknown type lists what the app plans: '+rd.typ.join(' | '));
    ok(!/pink/.test(rd.fit[0].split(':')[1])&&/pink isn't one of the shoes colours: read as/.test(rd.fit[0])&&!/pink/.test(rd.fit[1].split(':')[1])&&rd.fit[2].split(':')[1]!=='red','a colour a type isn\'t offered in moves to its nearest one, and the preview says so: '+rd.fit.join(' | '));
    ok(rd.mat[0]==='suit:navy:pinstripe::wool:'&&rd.mat[1].startsWith('shirt:white:stripe::poplin')&&rd.mat[2].startsWith('tie:navy:stripe::silk')&&rd.mat[3].startsWith('shoes:brown:solid:oxford:suede')&&rd.mat[4].startsWith('belt:black:solid::calf')&&rd.mat[5].startsWith('pants:stone:solid:chinos')&&/material “Steel” left out/.test(rd.mat[6]),
      'materials match the app\'s list in any case, shoes and belts take theirs as leather, Kind is read, Striped/Bengal stripe/Repp are patterns: '+rd.mat.join(' | '));
    ok(rd.empty[0]==='bad:Type is empty'&&rd.empty[1]==='bad:Colour is empty','an empty cell says which: '+rd.empty.join(' | '));
    /* files: Windows-1252 and an empty file; the template is a data link */
    const fl=await m.evaluate(async()=>{kitImportOpen();const b=new Uint8Array([...new TextEncoder().encode('Type,Colour,Name\nSuit,Navy,Costume bleu fonc'),0xE9,10]);
      await kitImportFile(new File([b],'x.csv'));const n1=kitImp&&kitImp.rows[0].card.name;await kitImportFile(new File([''],'e.csv'));const e=document.querySelector('#kit-prev').textContent;
      let href='';const ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){href=this.href};kitTemplate();HTMLAnchorElement.prototype.click=ck;return {n1,e,href,tpl:kitRead(KIT_TEMPLATE).rows.every(x=>x.ok&&!x.probs.length)}});
    ok(fl.n1==='Costume bleu foncé','a Windows-1252 CSV (Excel\'s "CSV (Comma delimited)") keeps its accents');
    ok(/The file is empty/.test(fl.e),'an empty file says so');
    ok(fl.href.startsWith('data:text/csv')&&fl.tpl,'the template downloads from a data link (nothing revoked) and every row of it imports cleanly');
    /* the double tap, the all-or-nothing write, the re-import, Undo and Take them out */
    const rows='Type,Colour,Name\nSuit,Navy,One\nSuit,Charcoal,Two\nShirt,White,\nShirt,White,\nTie,Burgundy,\nShoes,Black,\n';
    await m.fill('#kit-paste',rows);
    ok(await m.textContent('#kit-imp')==='Add 6 items','the preview offers 6 items');
    await m.evaluate(()=>{const b=document.querySelector('#kit-imp');b.click();b.click();b.click()});
    await m.waitForFunction(()=>items.length>=6&&!kitImpBusy);await m.waitForTimeout(300);
    const im=await m.evaluate(async()=>({mem:items.length,disk:(await tx('readonly',s=>s.getAll())).length,uniq:new Set(items.map(i=>i.id)).size,sheet:!!document.querySelector('#kitsheet.on'),toast:document.querySelector('#toast').textContent}));
    ok(im.mem===6&&im.disk===6&&im.uniq===6&&!im.sheet&&/Imported 6 items/.test(im.toast),`a triple tap on "Add 6 items" imports once (${JSON.stringify(im)})`);
    await m.evaluate(()=>{kitImportOpen()});await m.fill('#kit-paste',rows+'Belt,Black,\n');
    const re=await m.evaluate(()=>({sum:document.querySelector('.kit-sum').textContent,btn:document.querySelector('#kit-imp').textContent,ticked:[...document.querySelectorAll('.kit-rows li.ok .kit-tick')].filter(x=>x.checked).length,dup:document.querySelectorAll('.kit-rows li.dup').length,last:document.querySelector('#kit-last')&&document.querySelector('#kit-last').textContent}));
    ok(re.dup===6&&re.ticked===1&&re.btn==='Add 1 item'&&/6 are already in your wardrobe/.test(re.sum),`the same sheet again: its 6 rows are "already in your wardrobe" and unticked, only the new belt is ticked (${re.sum})`);
    ok(/Your last import .*6 items/.test(re.last||''),'the sheet offers to take the last import out again: '+re.last);
    await m.click('.kit-rows li.dup .kit-row');ok(await m.textContent('#kit-imp')==='Add 2 items','ticking one adds it');
    /* a write that fails part-way stores nothing */
    const fail=await m.evaluate(async()=>{const P=IDBObjectStore.prototype.put;let n=0;IDBObjectStore.prototype.put=function(...a){if(this.name==='items'&&++n===2)throw new DOMException('disk full','QuotaExceededError');return P.apply(this,a)};
      const n0=items.length;await kitImportGo();IDBObjectStore.prototype.put=P;await new Promise(r=>setTimeout(r,300));
      return {n0,mem:items.length,disk:(await tx('readonly',s=>s.getAll())).length,open:!!document.querySelector('#kitsheet.on'),btn:document.querySelector('#kit-imp').disabled}});
    ok(fail.mem===fail.n0&&fail.disk===fail.n0&&fail.open&&!fail.btn,`a write that fails part-way stores none of it and the sheet stays to try again (${JSON.stringify(fail)})`);
    await m.click('#kit-last button');await m.waitForSelector('#ask-ok');await m.click('#ask-ok');await m.waitForFunction(()=>!items.length);
    ok(await m.evaluate(async()=>!(await tx('readonly',s=>s.getAll())).length&&!document.querySelector('#kit-last')&&document.querySelectorAll('.kit-rows li.dup').length===0),'"Take them out" removes the last import, and the rows are no longer marked as there');
    /* Undo of a big import: quick, offered for 20 s */
    const big='Type,Colour\n'+Array.from({length:300},(_,k)=>['Shirt,White','Tie,Navy','Socks,Black'][k%3]).join('\n');
    const u=await m.evaluate(async t=>{kitImportText(t);const t0=performance.now();await kitImportGo();const add=performance.now()-t0;const n=items.length;
      const t1=performance.now();await kitUnsave({its:items.map(i=>i.id),qs:[]});return {add,n,undo:performance.now()-t1,after:items.length,disk:(await tx('readonly',s=>s.getAll())).length}},big);
    ok(u.n===300&&u.after===0&&u.disk===0&&u.add<15000&&u.undo<15000,`300 rows import and Undo in one go each (${Math.round(u.add)} ms, ${Math.round(u.undo)} ms)`);
    ok(await m.evaluate(()=>KIT_IMP_UNDO_MS>=20000),'the import\'s Undo is offered for 20 s');
    ok(!m.errs.length,'no page errors: '+m.errs.join(' | '));await m.context().close();
  }finally{await browser.close()}
};
