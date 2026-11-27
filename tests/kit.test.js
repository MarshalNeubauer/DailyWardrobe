// kit.js: the tour, the sample, the import and their fixes.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/kit.test.js ---- */
// Getting started (kit.js, 2026-11-14, the owner's ask after the audit's new-user walkthrough): the quick tour and the close-up guide,
// Undo after Confirm on Add, Duplicate on the item sheet, import from a spreadsheet (CSV or pasted rows, a preview, Undo) and the
// sample wardrobe (marked sample, a note on Today, removed in one tap); every sheet fits a 320 px phone
const kit=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const open=async(w=390)=>{const ctx=await browser.newContext({viewport:{width:w,height:844}});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{HOOK.CK_OPEN['*']=true});
    await p.evaluate(()=>{if('setupClose' in HOOK&&typeof HOOK.setupClose==='function'&&document.querySelector('#setup.on'))HOOK.setupClose()});return p};
  const fits=p=>p.evaluate(()=>{const s=document.querySelector('#kitsheet'),out=[...s.querySelectorAll('button,label,textarea,li,svg')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-0.5||r.right>innerWidth+0.5)});
    return document.documentElement.scrollWidth<=innerWidth&&!out.length});
  try{
    const p=await open();
    /* ---- the tour ---- */
    await p.evaluate(()=>{localStorage.removeItem('tour_seen');HOOK.tourOpen()});
    const t=await p.evaluate(()=>({on:!!document.querySelector('#kitsheet.on'),inert:['main'].every(s=>document.querySelector(s).inert),title:document.querySelector('#kit-title').textContent,n:document.querySelectorAll('.kit-prog i').length,seen:HOOK.tourSeen()}));
    ok(t.on&&t.inert&&t.title==='The score'&&t.n===4&&!t.seen,'the tour opens full screen on "The score", four cards, the page behind inert');
    const titles=[t.title];for(let k=0;k<3;k++){await p.waitForTimeout(400);await p.click('#kit-next');titles.push(await p.textContent('#kit-title'))}   // (a tap within 350 ms of the last is a double tap's second: kit.js KIT_TAP_MS)
    ok(titles.join('|')==='The score|The close-up|Shade|Patterns','its cards: the score, the close-up, Shade, patterns ('+titles.join(', ')+')');
    ok(await fits(p),'each card fits the phone');
    await p.waitForTimeout(400);await p.click('#kit-back');ok(await p.textContent('#kit-title')==='Shade','Back goes to the card before');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(()=>!document.querySelector('#kitsheet.on')&&!document.querySelector('main').inert&&HOOK.tourSeen()),'Escape closes it, the page usable again, and it is marked seen');
    /* ---- the close-up guide, from the Add card's close-up step ---- */
    await p.evaluate(()=>{HOOK.openAdd();HOOK.addManual()});
    ok(await p.evaluate(()=>{const c=document.querySelector('#nps-q [data-ck="tex"] .wbstcard');return !!c&&/True color in 3 steps/i.test(c.textContent)&&/Paper on an edge/.test(c.textContent)&&/Tap the paper/.test(c.textContent)&&/Take the photo/.test(c.textContent)&&!document.querySelector('#nps-q .texguide')}),'the close-up step shows "True color in 3 steps": paper on an edge, tap the paper, take the photo');
    await p.click('#nps-q .wbstcard');
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='White paper, true colors'),'the card opens the short white-paper tip');
    await p.click('#kitsheet .kit-body .linkbtn');await p.waitForFunction(()=>document.querySelector('#kit-title').textContent==='A good close-up');
    const g=await p.evaluate(()=>({title:document.querySelector('#kit-title').textContent,txt:document.querySelector('.kit-body').textContent,prog:!!document.querySelector('.kit-prog')}));
    ok(g.title==='A good close-up'&&/white paper along one edge/i.test(g.txt)&&/middle/.test(g.txt)&&/no flash/i.test(g.txt)&&/tap the paper on the camera screen/i.test(g.txt)&&/exposure/.test(g.txt)&&!g.prog,'it opens the guide: paper along one edge, out of the middle, no flash, tap the paper to set the exposure');
    await p.waitForTimeout(400);await p.click('#kit-next');ok(await p.evaluate(()=>!document.querySelector('#kitsheet.on')),'"Got it" closes it');
    /* ---- Undo after Confirm ---- */
    const u=await p.evaluate(async()=>{const n0=HOOK.items.length,q=HOOK.queue[0];q.type='tie';q.primaryColor='burgundy';q.name='Undo me';await HOOK.save(0);
      const saved=HOOK.items.length===n0+1&&!HOOK.queue.length,t=document.querySelector('#toast'),btn=t.querySelector('button');
      return {saved,toast:t.textContent,btn:!!btn,id:q.id}});
    ok(u.saved&&/Saved: Undo me/.test(u.toast)&&u.btn,'Confirm saves the item and the toast says so with an Undo button ('+u.toast+')');
    await p.click('#toast button');
    await p.waitForFunction(()=>HOOK.queue.length===1&&!!document.querySelector('#queue .card'));   // (the card is kept first, then the item taken out and Add drawn: kitUnsave)
    const u2=await p.evaluate(async id=>({gone:!HOOK.items.some(i=>i.id===id),card:HOOK.queue[0].id===id&&HOOK.queue[0].name==='Undo me',inDb:!!(await HOOK.tx('readonly',s=>s.get(id))),tomb:true,shown:!!document.querySelector('#queue .card')}),u.id);
    ok(u2.gone&&!u2.inDb&&u2.card&&u2.shown,'Undo takes it out of the wardrobe and the store and puts its card back on Add, as it was');
    /* cards saved together are one Undo */
    const u3=await p.evaluate(async()=>{HOOK.queue.length=0;HOOK.addManual();HOOK.queue.unshift({id:'k2',err:'open'});HOOK.errToHand('k2');HOOK.queue[0].type='shirt';HOOK.queue[1].type='tie';   // (a second card: one filled in by hand from a photo that couldn't be opened; "Add without a photo" holds one card at a time)
const n0=HOOK.items.length;await HOOK.save(0);await HOOK.save(0);
      return {n:HOOK.items.length-n0,toast:document.querySelector('#toast').textContent}});
    ok(u3.n===2&&/Saved 2 items/.test(u3.toast),'two cards saved one after the other: "Saved 2 items" with one Undo');
    await p.click('#toast button');await p.waitForFunction(()=>HOOK.queue.length===2);ok(true,'and Undo puts both back');
    await p.evaluate(()=>{HOOK.queue.length=0;HOOK.renderAdd()});
    /* ---- Duplicate ---- */
    const d=await p.evaluate(async()=>{const it={id:'dup-src',type:'suit',primaryColor:'navy',pattern:'pinstripe',name:'Navy chalk',brand:'X',paused:true,cleaned:'2026-11-01',added:1};
      await HOOK.put(it);HOOK.items.push(it);HOOK.openItem('dup-src');return !!document.querySelector('#iv-dup')});
    ok(d,'the item sheet has "Duplicate this item"');
    await p.click('#iv-dup');await p.waitForFunction(()=>HOOK.items.filter(i=>i.name==='Navy chalk').length===2);
    const d2=await p.evaluate(()=>{const c=HOOK.items.filter(i=>i.name==='Navy chalk'&&i.id!=='dup-src');const x=c[0]||{};
      return {n:c.length,same:x.type==='suit'&&x.primaryColor==='navy'&&x.pattern==='pinstripe'&&x.brand==='X',fresh:!x.paused&&!x.cleaned&&x.added>1,opened:HOOK.editing===x.id||document.querySelector('#item-view')&&!document.querySelector('#item-view').hidden}});
    ok(d2.n===1&&d2.same&&d2.fresh&&d2.opened,'it makes one copy with the same tags, name and brand, no history (in rotation, not cleaned), and opens it');
    await p.evaluate(()=>{if('closeItem' in HOOK&&typeof HOOK.closeItem==='function')HOOK.closeItem();HOOK.show('today')});
    /* ---- import ---- */
    const r=await p.evaluate(()=>{const a=HOOK.kitRead('Item;Color;Pattern;Name;Vest\nSuit;Navy blue;Pin stripe;Office;yes\nTrousers;Mid gray;;;\nchinos;stone;;;\nLoafers;Brown;;;\nNecktie;Burgundy;checks;;\nScarf;Red;;;\nShirt;Mauve-ish;;;\n');
      const b=HOOK.kitRead('Type\tColour\nShirt\tLight blue\n'),c=HOOK.kitRead('Name,Brand\nx,y'),q=HOOK.kitRead('Type,Colour,Notes\nTie,Navy,"Silk, ""repp"" stripe"\n');
      return {rows:a.rows.map(x=>x.ok?[x.card.type,x.card.primaryColor,x.card.pattern,x.card.vest||x.card.trouserKind||x.card.shoeStyle||'',x.card.name||''].join(':'):'bad:'+x.line+':'+x.why),
        tab:b.rows&&b.rows[0].card.primaryColor,err:c.err,quote:q.rows[0].card.notes}});
    ok(r.rows[0]==='suit:navy:pinstripe:yes:Office'&&r.rows[1]==='pants:midgrey:solid:dress:'&&r.rows[2]==='pants:stone:solid:chinos:'&&r.rows[3]==='shoes:brown:solid:loafer:'&&r.rows[4]==='tie:burgundy:check::',
      'rows are read with any column order, ; separators, common words (navy blue, pin stripe, gray, chinos, loafers, necktie, checks): '+r.rows.slice(0,5).join(' | '));
    ok(/^bad:7:.*Scarf/.test(r.rows[5])&&/^bad:8:.*Mauve-ish/.test(r.rows[6]),'an unknown type or color is left out, saying which row and why');
    ok(r.tab==='lightblue'&&/Type.*Color/.test(r.err)&&r.quote==='Silk, "repp" stripe','rows pasted from a spreadsheet (tabs) read too; without Type and Color columns it says so; quoted commas and quotes are kept');
    await p.evaluate(()=>{HOOK.openAdd()});await p.waitForFunction(()=>!document.querySelector('#add').hidden);
    const vis=await p.evaluate(()=>{const e=document.querySelector('#add-import'),r=e.getBoundingClientRect();let x=e,h=[];while(x){const c=getComputedStyle(x);if(c.display==='none'||c.visibility==='hidden'||x.hidden)h.push(x.id||x.className||x.tagName);x=x.parentElement}return JSON.stringify({r,h})});
    if(!/"height":[1-9]/.test(vis))console.log('add-import',vis);
    await p.click('#add-import');
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='Import from a spreadsheet'&&document.querySelector('#kit-imp').disabled),'Add → "Import from a spreadsheet" opens the sheet, Add items off until something is read');
    await p.fill('#kit-paste','Type,Colour,Second colour,Pattern\nTie,Navy,White,Polka dot\nShoes,Black,,\nHat,Black,,\n');
    const pv=await p.evaluate(()=>({sum:document.querySelector('.kit-sum').textContent,ok:document.querySelectorAll('.kit-rows li.ok').length,bad:document.querySelectorAll('.kit-rows li.bad').length,btn:document.querySelector('#kit-imp').textContent}));
    ok(pv.ok===2&&pv.bad===1&&/2 items ready, 1 row left out/.test(pv.sum)&&pv.btn==='Add 2 items','the preview lists what will be added and what is left out before anything is saved');
    ok(await fits(p),'the import sheet fits the phone');
    const n0=await p.evaluate(()=>HOOK.items.length);
    await p.click('#kit-imp');await p.waitForFunction(n=>HOOK.items.length===n+2,n0);
    const im=await p.evaluate(()=>{const t=HOOK.items.find(i=>i.type==='tie'&&i.pattern==='polka-dot'&&i.secondaryColor==='white');return {tie:!!t,swatch:!!(t&&t.swatch),toast:document.querySelector('#toast').textContent,q:HOOK.queue.length}});
    ok(im.tie&&/Imported 2 items/.test(im.toast)&&!im.q,'Add 2 items saves them as cards added by hand would be, and the toast offers Undo');
    await p.click('#toast button');
    ok(await p.waitForFunction(n=>HOOK.items.length===n,n0,{timeout:5000}).then(()=>true,()=>false),'Undo takes the imported items out again '+await p.evaluate(n=>HOOK.items.length+'/'+n+' '+document.querySelector('#toast').textContent+' inert:'+document.querySelector('main').inert,n0));
    /* ---- the sample wardrobe ---- */
    await p.evaluate(()=>{for(const i of HOOK.items.slice())HOOK.del(i.id);HOOK.items=[];HOOK.cache={};HOOK.show('today')});
    await p.evaluate(()=>{HOOK.renderToday()});
    ok(await p.evaluate(()=>!!document.querySelector('#firstrun #kit-sample-link')),'Today\'s first-outfit checklist offers the tour and a sample wardrobe');
    await p.click('#firstrun #kit-sample-link');
    if(!await p.waitForFunction(()=>HOOK.items.length>=20&&!!document.querySelector('#kit-sample'),null,{timeout:15000}).then(()=>true,()=>false))
      console.log('sample state',await p.evaluate(()=>HOOK.items.length+' q:'+HOOK.queue.length+' today:'+!document.querySelector('#today').hidden+' ask:'+!!document.querySelector('.ask.on,#ask.on,[role=alertdialog]')+' '+document.body.className));
    const s=await p.evaluate(()=>({n:HOOK.items.length,all:HOOK.items.every(i=>i.sample),types:[...new Set(HOOK.items.map(i=>i.type))].length,first:!!document.querySelector('#firstrun'),score:!!document.querySelector('.score')}));
    ok(s.all&&s.types>=8&&!s.first,`it adds ${s.n} pieces of ${s.types} types, all marked sample; the checklist is gone and Today plans an outfit`);
    ok(await p.evaluate(()=>/sample wardrobe/.test(document.querySelector('#kit-sample').textContent)),'Today says a sample wardrobe is being tried, with Add my own and Remove the sample');
    await p.click('#kit-sample button:has-text("Remove the sample")');
    await p.waitForSelector('#ask-ok');ok(/Remove the 24 sample pieces/.test(await p.textContent('#ask-title')),'it asks first');await p.click('#ask-ok');
    await p.waitForFunction(()=>!HOOK.items.length);
    ok(await p.evaluate(async()=>!document.querySelector('#kit-sample')&&!(await HOOK.tx('readonly',s=>s.getAll())).length),'Remove the sample takes every sample piece out (asked first)');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));
    await p.context().close();
    /* ---- 320 px ---- */
    const n=await open(320);await n.evaluate(()=>HOOK.tourOpen());ok(await fits(n),'the tour fits a 320 px phone');await n.evaluate(()=>{HOOK.kitClose();HOOK.kitImportOpen()});ok(await fits(n),'and so does the import sheet');
    ok(!n.errs.length,'no page errors at 320 px: '+n.errs.join(' | '));await n.context().close();
  }finally{await browser.close()}
};

/* ---- was tests/kitfix.test.js ---- */
// The new-user audit's import and sample findings (2026-11-15): the sample wardrobe tapped twice or cut off part-way, the sample from the
// setup's last step, the sample and the dress code, removing the sample (its day records, pieces the owner changed, one write), the sample's
// marks, item pictures for the sample; the import's double tap, all-or-nothing write, re-import, Undo and "Take them out", its words
// (everyday colours, plurals, each type's colours, materials, Kind, patterns, empty cells), files (Windows-1252, empty) and the template.
const kitfix=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const open=async(o={})=>{const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));if(o.init)await p.addInitScript(o.init);await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if('setupClose' in HOOK&&typeof HOOK.setupClose==='function'&&document.querySelector('#setup.on'))HOOK.setupClose()});return p};
  const dups=p=>p.evaluate(async()=>{const st=await HOOK.tx('readonly',s=>s.getAll()),sig=st.filter(i=>i.sample).map(HOOK.kitSampleSig);
    return {mem:HOOK.items.length,disk:st.length,sample:sig.length,dupSig:sig.length-new Set(sig).size,dupId:HOOK.items.length-new Set(HOOK.items.map(i=>i.id)).size}});
  try{
    /* ---- the sample tapped twice ---- */
    const p=await open();
    await p.evaluate(()=>{HOOK.show('today');HOOK.renderToday()});
    await p.evaluate(()=>{const b=document.querySelector('#firstrun #kit-sample-link');b.click();b.click();setTimeout(()=>b.click(),150)});
    await p.waitForFunction(()=>HOOK.items.length>=24&&!HOOK.kitSampling);await p.waitForTimeout(400);
    const a=await dups(p);
    ok(a.mem===24&&a.disk===24&&a.sample===24&&!a.dupSig&&!a.dupId,`a double (and triple) tap on "Try a sample wardrobe" loads it once (${JSON.stringify(a)})`);
    const again=await p.evaluate(async()=>{await HOOK.kitSampleLoad();return {n:HOOK.items.length,t:document.querySelector('#toast').textContent}});
    ok(again.n===24&&/already here/.test(again.t),'tapping it again later adds nothing and says the sample is already here');
    /* a partial sample (cut off by iOS before this fix) is completed, not doubled */
    const part=await p.evaluate(async()=>{const s=HOOK.items.filter(i=>i.sample).slice(9);await HOOK.kitDelMany(s.map(i=>i.id));const n0=HOOK.items.length;await HOOK.kitSampleLoad();
      return {n0,t:document.querySelector('#toast').textContent}});
    const a2=await dups(p);
    ok(part.n0===9&&a2.mem===24&&a2.disk===24&&!a2.dupSig&&/rest of the sample/.test(part.t),`a partial sample (9 pieces) is completed to 24 with no piece twice (${JSON.stringify(a2)}, "${part.t}")`);
    /* the marks: the grid's tag, the item sheet's note, Keep it as mine */
    const mk=await p.evaluate(()=>{HOOK.show('wardrobe');HOOK.renderWardrobe();const tags=document.querySelectorAll('#wardrobe .sampletag').length;const it=HOOK.items.find(i=>i.type==='pants'&&i.trouserKind==='chinos');
      const gt=document.querySelector('#gi-'+it.id+' .gtype').textContent;HOOK.openItem(HOOK.items[0].id);return {tags,gt,note:!!document.querySelector('#item-view .ivsample #iv-keep')}});
    ok(mk.tags===24&&mk.note,'every sample piece is tagged "Sample" in the grid, and its item sheet says so with "Keep it as mine"');
    ok(mk.gt==='Chinos','chinos are called Chinos in the grid, not Pants');
    await p.click('#iv-keep');await p.waitForFunction(()=>!HOOK.items[0].sample&&/yours now/.test(document.querySelector('#toast').textContent)).catch(()=>{});
    const kp=await p.evaluate(()=>({note:!!document.querySelector('#item-view .ivsample'),tag:!!document.querySelector('#gi-'+HOOK.items[0].id+' .sampletag'),grid:!!document.querySelector('#gi-'+HOOK.items[0].id),ward:!document.querySelector('#wardrobe').hidden,ed:HOOK.editing}));
    ok(!kp.note&&!kp.tag,'"Keep it as mine" makes it his: the note and the tag go '+JSON.stringify(kp));
    await p.evaluate(()=>HOOK.closeItem());
    /* item pictures leave the sample out */
    ok(await p.evaluate(()=>HOOK.missingItemPics().every(i=>!i.sample)&&HOOK.missingItemPics().length<=1),'"Generate item pictures" offers none of the sample\'s pieces');
    /* ---- removing the sample: day records, a piece he changed, one write ---- */
    const rm=await p.evaluate(async()=>{const s=HOOK.items.filter(i=>i.sample),shirt=s.find(i=>i.type==='shirt');
      HOOK.openItem(shirt.id);await HOOK.setItemField(shirt.id,'name','My white shirt');HOOK.closeItem();   // renamed in the item sheet
      const suit=s.find(i=>i.type==='suit');
      await HOOK.saveDay({date:'2026-11-10',ids:{top:suit.id,shirt:shirt.id},suitDay:true,worn:true});
      await HOOK.saveDay({date:'2026-11-12',ids:{top:suit.id},occasion:'wedding',force:{top:suit.id}});
      await HOOK.saveDay({date:'2026-11-13',lock:{top:suit.id}});
      return {kept:shirt.id,mine:HOOK.items[0].id,gone:s.filter(i=>i!==shirt).map(i=>i.id)}});
    await p.evaluate(()=>{HOOK.show('today');HOOK.renderToday()});
    await p.click('#kit-sample button:has-text("Remove the sample")');await p.waitForSelector('#ask-ok');
    const q=await p.textContent('#ask-title');
    ok(/Remove the 22 sample pieces/.test(q)&&/the sample piece you changed: it is yours now/.test(await p.textContent('#ask-sheet')),'it asks to remove the pieces he didn\'t change and says the one he changed stays ('+q+')');
    await p.click('#ask-ok');await p.waitForFunction(()=>!HOOK.items.some(i=>i.sample)&&!HOOK.kitSampling);
    const r=await p.evaluate(async({kept,mine,gone})=>{const st=await HOOK.tx('readonly',s=>s.getAll()),days=await HOOK.txs('days','readonly',s=>s.getAll()),d=k=>days.find(x=>x.date===k)||{},tomb=await HOOK.metaGet('tombstones');
      const left=JSON.stringify(days)+JSON.stringify(HOOK.dayRecs);
      return {refs:gone.filter(id=>left.includes(id)).length,n:st.length,ids:st.map(i=>i.id).sort().join(),want:[kept,mine].sort().join(),flag:st.some(i=>i.sample),d10:d('2026-11-10'),d12:d('2026-11-12'),d13:d('2026-11-13'),mem:JSON.stringify(HOOK.dayRecs['2026-11-10']),tombs:Object.keys(tomb||{}).length}},rm);
    ok(r.n===2&&r.ids===r.want&&!r.flag,'Remove the sample takes the 22 out; the piece he changed and the one he kept stay, no longer sample');
    ok(r.refs===0&&r.d10.worn===true&&r.d10.ids&&r.d10.ids.shirt===rm.kept&&r.d10.gone&&r.d10.gone.top&&!r.d12.force&&r.d12.occasion==='wedding'&&!r.d13.lock,'the days that recorded sample pieces lose them (worn days, picks, locks) and keep the rest: worn, his own piece, an occasion '+JSON.stringify([r.d10,r.d12,r.d13,r.mem]));
    ok(r.tombs>=22,'each removed piece leaves a tombstone, so it goes from every device');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    /* ---- the sample from the setup's last step finishes the setup ---- */
    const s=await open({init:()=>{localStorage.setItem('tour_seen','1')}});
    await s.evaluate(()=>{HOOK.setupOpen(false);HOOK.setup.at=HOOK.SETUP_STEPS.length-1;HOOK.setupDraw()});
    await s.click('#setup #kit-sample-link');await s.waitForFunction(()=>HOOK.items.length===24&&!HOOK.kitSampling);
    await s.waitForFunction(()=>HOOK.settings.holidays&&HOOK.settings.holidays.country,null,{timeout:8000}).catch(()=>{});
    const st=await s.evaluate(async()=>{const m=await HOOK.metaGet('settings');return {shown:HOOK.setupShown(),done:!!(m&&m.setupDone),vest:HOOK.settings.vestMode,hol:HOOK.settings.holidays&&HOOK.settings.holidays.country,today:!document.querySelector('#today').hidden}});
    ok(!st.shown&&st.done&&st.vest==='never'&&st.hol==='KW'&&st.today,`from the setup's last step the setup is finished first: done stored, no vest, the time zone's holidays (${JSON.stringify(st)})`);
    ok(!s.errs.length,'no page errors: '+s.errs.join(' | '));await s.context().close();
    /* ---- the sample follows the dress code ---- */
    const d=await open();
    const dc=await d.evaluate(async()=>{HOOK.settings.dress={jacket:false,tie:false};await HOOK.kitSampleLoad();const c={};for(const i of HOOK.items)c[i.type]=(c[i.type]||0)+1;return c});
    ok(!dc.suit&&!dc.blazer&&!dc.tie&&dc.pants===4&&dc.shirt===5,`without jackets and ties the sample has no suits, blazers or ties, and four pairs of pants (${JSON.stringify(dc)})`);
    await d.context().close();
    /* ---- import ---- */
    const m=await open();
    const rd=await m.evaluate(()=>{const R=t=>HOOK.kitRead(t).rows.map(x=>x.ok?[x.card.type,x.card.primaryColor,x.card.pattern,x.card.trouserKind||x.card.shoeStyle||'',x.card.material||x.card.leather||'',x.probs.join('/')].join(':'):'bad:'+x.why);
      return {col:R('Type,Colour\nShirt,Charcoal grey\nSuit,Medium grey\nShoes,Dark brown\nShirt,Pale blue\nShirt,Sky blue\nTie,Maroon\nSuit,Midnight blue\nBelt,Cognac\nShirt,light-blue\nShirt,Heather grey\n'),
        typ:R('Type,Colour\nBlazers,Navy\nJackets,Navy\nBelts,Black\nWatches,Silver\nTie clips,Silver\nOvercoats,Navy\nRaincoats,Khaki\nDress shirts,White\nCufflink,Silver\nScarf,Navy\n'),
        fit:R('Type,Colour\nShoes,Pink\nSuit,Pink\nShirt,Red\n'),
        mat:R('Type,Colour,Material,Kind,Pattern\nSuit,Navy,Wool,,Striped\nShirt,White,Poplin,,Bengal stripe\nTie,Navy,SILK,,Repp\nShoes,Brown,Suede,,\nBelt,Black,Leather,,\nTrousers,Stone,,chinos,\nWatch,Silver,Steel,,\n'),
        empty:R('Type,Colour\n,Navy\nSuit,\n')}});
    ok(rd.col.slice(0,9).every(x=>!/^bad/.test(x))&&rd.col[0].startsWith('shirt:charcoal')&&rd.col[3].startsWith('shirt:lightblue')&&rd.col[4].startsWith('shirt:lightblue')&&rd.col[5].startsWith('tie:burgundy')&&rd.col[8].startsWith('shirt:lightblue:')&&/read as/.test(rd.col[4]),
      'everyday colors are read as the app\'s and the preview says so: '+rd.col.join(' | '));
    ok(rd.typ.slice(0,9).map(x=>x.split(':')[0]).join()==='blazer,blazer,belt,watch,tieclip,overcoat,raincoat,shirt,cufflinks'&&/isn't a type the app plans\. It plans suits/.test(rd.typ[9]),'plural and everyday type names are read; an unknown type lists what the app plans: '+rd.typ.join(' | '));
    ok(!/pink/.test(rd.fit[0].split(':')[1])&&/pink isn't one of the shoes colors: read as/.test(rd.fit[0])&&!/pink/.test(rd.fit[1].split(':')[1])&&rd.fit[2].split(':')[1]!=='red','a color a type isn\'t offered in moves to its nearest one, and the preview says so: '+rd.fit.join(' | '));
    ok(rd.mat[0]==='suit:navy:pinstripe::wool:'&&rd.mat[1].startsWith('shirt:white:stripe::poplin')&&rd.mat[2].startsWith('tie:navy:stripe::silk')&&rd.mat[3].startsWith('shoes:brown:solid:oxford:suede')&&rd.mat[4].startsWith('belt:black:solid::calf')&&rd.mat[5].startsWith('pants:stone:solid:chinos')&&/material “Steel” left out/.test(rd.mat[6]),
      'materials match the app\'s list in any case, shoes and belts take theirs as leather, Kind is read, Striped/Bengal stripe/Repp are patterns: '+rd.mat.join(' | '));
    ok(rd.empty[0]==='bad:Type is empty'&&rd.empty[1]==='bad:Color is empty','an empty cell says which: '+rd.empty.join(' | '));
    /* files: Windows-1252 and an empty file; the template is a data link */
    const fl=await m.evaluate(async()=>{HOOK.kitImportOpen();const b=new Uint8Array([...new TextEncoder().encode('Type,Colour,Name\nSuit,Navy,Costume bleu fonc'),0xE9,10]);
      await HOOK.kitImportFile(new File([b],'x.csv'));const n1=HOOK.kitImp&&HOOK.kitImp.rows[0].card.name;await HOOK.kitImportFile(new File([''],'e.csv'));const e=document.querySelector('#kit-prev').textContent;
      let href='';const ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){href=this.href};HOOK.kitTemplate();HTMLAnchorElement.prototype.click=ck;return {n1,e,href,tpl:HOOK.kitRead(HOOK.KIT_TEMPLATE).rows.every(x=>x.ok&&!x.probs.length)}});
    ok(fl.n1==='Costume bleu foncé','a Windows-1252 CSV (Excel\'s "CSV (Comma delimited)") keeps its accents');
    ok(/The file is empty/.test(fl.e),'an empty file says so');
    ok(fl.href.startsWith('data:text/csv')&&fl.tpl,'the template downloads from a data link (nothing revoked) and every row of it imports cleanly');
    /* the double tap, the all-or-nothing write, the re-import, Undo and Take them out */
    const rows='Type,Colour,Name\nSuit,Navy,One\nSuit,Charcoal,Two\nShirt,White,\nShirt,White,\nTie,Burgundy,\nShoes,Black,\n';
    await m.fill('#kit-paste',rows);
    ok(await m.textContent('#kit-imp')==='Add 6 items','the preview offers 6 items');
    await m.evaluate(()=>{const b=document.querySelector('#kit-imp');b.click();b.click();b.click()});
    await m.waitForFunction(()=>HOOK.items.length>=6&&!HOOK.kitImpBusy);await m.waitForTimeout(300);
    const im=await m.evaluate(async()=>({mem:HOOK.items.length,disk:(await HOOK.tx('readonly',s=>s.getAll())).length,uniq:new Set(HOOK.items.map(i=>i.id)).size,sheet:!!document.querySelector('#kitsheet.on'),toast:document.querySelector('#toast').textContent}));
    ok(im.mem===6&&im.disk===6&&im.uniq===6&&!im.sheet&&/Imported 6 items/.test(im.toast),`a triple tap on "Add 6 items" imports once (${JSON.stringify(im)})`);
    await m.evaluate(()=>{HOOK.kitImportOpen()});await m.fill('#kit-paste',rows+'Belt,Black,\n');
    const re=await m.evaluate(()=>({sum:document.querySelector('.kit-sum').textContent,btn:document.querySelector('#kit-imp').textContent,ticked:[...document.querySelectorAll('.kit-rows li.ok .kit-tick')].filter(x=>x.checked).length,dup:document.querySelectorAll('.kit-rows li.dup').length,last:document.querySelector('#kit-last')&&document.querySelector('#kit-last').textContent}));
    ok(re.dup===6&&re.ticked===1&&re.btn==='Add 1 item'&&/6 are already in your wardrobe/.test(re.sum),`the same sheet again: its 6 rows are "already in your wardrobe" and unticked, only the new belt is ticked (${re.sum})`);
    ok(/Your last import .*6 items/.test(re.last||''),'the sheet offers to take the last import out again: '+re.last);
    await m.click('.kit-rows li.dup .kit-row');ok(await m.textContent('#kit-imp')==='Add 2 items','ticking one adds it');
    /* a write that fails part-way stores nothing */
    const fail=await m.evaluate(async()=>{const P=IDBObjectStore.prototype.put;let n=0;IDBObjectStore.prototype.put=function(...a){if(this.name==='items'&&++n===2)throw new DOMException('disk full','QuotaExceededError');return P.apply(this,a)};
      const n0=HOOK.items.length;await HOOK.kitImportGo();IDBObjectStore.prototype.put=P;await new Promise(r=>setTimeout(r,300));
      return {n0,mem:HOOK.items.length,disk:(await HOOK.tx('readonly',s=>s.getAll())).length,open:!!document.querySelector('#kitsheet.on'),btn:document.querySelector('#kit-imp').disabled}});
    ok(fail.mem===fail.n0&&fail.disk===fail.n0&&fail.open&&!fail.btn,`a write that fails part-way stores none of it and the sheet stays to try again (${JSON.stringify(fail)})`);
    await m.click('#kit-last button');await m.waitForSelector('#ask-ok');await m.click('#ask-ok');await m.waitForFunction(()=>!HOOK.items.length);
    ok(await m.evaluate(async()=>!(await HOOK.tx('readonly',s=>s.getAll())).length&&!document.querySelector('#kit-last')&&document.querySelectorAll('.kit-rows li.dup').length===0),'"Take them out" removes the last import, and the rows are no longer marked as there');
    /* Undo of a big import: quick, offered for 20 s */
    const big='Type,Colour\n'+Array.from({length:300},(_,k)=>['Shirt,White','Tie,Navy','Socks,Black'][k%3]).join('\n');
    const u=await m.evaluate(async t=>{HOOK.kitImportText(t);const t0=performance.now();await HOOK.kitImportGo();const add=performance.now()-t0;const n=HOOK.items.length;
      const t1=performance.now();await HOOK.kitUnsave({its:HOOK.items.map(i=>i.id),qs:[]});return {add,n,undo:performance.now()-t1,after:HOOK.items.length,disk:(await HOOK.tx('readonly',s=>s.getAll())).length}},big);
    ok(u.n===300&&u.after===0&&u.disk===0&&u.add<15000&&u.undo<15000,`300 rows import and Undo in one go each (${Math.round(u.add)} ms, ${Math.round(u.undo)} ms)`);
    ok(await m.evaluate(()=>HOOK.KIT_IMP_UNDO_MS>=20000),'the import\'s Undo is offered for 20 s');
    ok(!m.errs.length,'no page errors: '+m.errs.join(' | '));await m.context().close();
  }finally{await browser.close()}
};

/* ---- was tests/importfix3.test.js ---- */
// Fix round 3 (2026-11-16, the third audit), the spreadsheet import (kit.js): a Description column read for patterns, kinds, styles and
// names, with the columns not used named (W2-15-01); a re-import updates matching pieces (W2-15-02, the owner's decision 5); "lt."/"dk"
// (W2-15-03); row numbers after a blank row (W2-15-04); a title row, a list with no column names, everyday headers (W2-15-05); quantities
// (W2-15-06); short forms, typos, shoe words, both problems of a row (W2-15-07); long fields cut and said (W2-12-05); Arabic types and colors
// (W2-16-06); the app's own hyphenated color name (W2-18-04); a file that can't be read (W2-20-01); the 14 Nov import's list numbers as
// colors repaired, and own colours named like the app's (W1-2-01, W1-2-02).
const importfix3=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if('setupClose' in HOOK&&typeof HOOK.setupClose==='function'&&document.querySelector('#setup.on'))HOOK.setupClose()});
    /* ---- W2-15-01: the Description column ---- */
    const d=await p.evaluate(()=>{const r=HOOK.kitRead('Category\tDescription\tColor\tBrand\tSize\nSuit\tcharcoal pinstripe\tcharcoal\tM&S\t40R\nShirt\tpink gingham\tpink/white\t\t\nShirt\tbengal stripe\tblue & white\tHilditch\t\nTie\tknit\tnavy\t\t\nTie\trepp stripe\tburgundy & navy\tDrake\'s\t\nTie\tpaisley\tgold\t\t\nTie\tpolka dot\tnavy\t\t\nTrousers\tchinos\tkhaki\tGap\t\nShoes\tpenny loafers\toxblood\t\t\nShoes\tbrogues\ttan\t\t\nSuit\tnavy three-piece\tnavy\t\t\n');
      HOOK.kitImportOpen();HOOK.kitImportText('Category\tDescription\tColor\tSize\nTie\tknit\tnavy\tM\n');const prev=document.querySelector('#kit-prev').textContent;HOOK.kitClose();
      return {rows:r.rows.map(x=>[x.card.type,x.card.pattern,x.card.trouserKind||x.card.shoeStyle||x.card.vest||'',x.card.name||''].join(':')),unused:r.unused,desc:r.descCols,prev}});
    ok(d.rows.join('|')==='suit:pinstripe:no:|shirt:gingham::|shirt:stripe::|tie:knit::|tie:stripe::|tie:paisley::|tie:polka-dot::|pants:solid:chinos:|shoes:solid:loafer:Penny loafers|shoes:solid:oxford:Brogues|suit:solid:yes:',
      'a Description column gives the pattern, the trousers\' kind, the shoes\' style, a three-piece suit, and its other words the name: '+d.rows.join(' | '));
    ok(d.unused.join()==='Size'&&d.desc.join()==='Description'&&/Description: read for patterns/.test(d.prev)&&/Not used: Size/.test(d.prev),'the preview says the Description column was read and names the column it didn\'t use: '+d.prev);
    /* ---- W2-15-02: the same sheet again with a Pattern column updates the pieces, keeping their ids ---- */
    const B=[['Suit','charcoal','M&HOOK.S','pinstripe'],['Shirt','pink/white','','gingham'],['Tie','navy','','knit'],['Tie','navy','','polka dot'],['Tie','gold','','paisley'],['Shoes','tan','','']];
    const first='Category\tColor\tBrand\n'+B.map(r=>r.slice(0,3).join('\t')).join('\n'),second='Category\tColor\tBrand\tPattern\n'+B.map(r=>r.join('\t')).join('\n')+'\nBelt\tblack\t\t';
    const u=await p.evaluate(async([a,b])=>{HOOK.kitImportOpen();HOOK.kitImportText(a);await HOOK.kitImportGo();const ids=HOOK.items.map(i=>i.id).sort().join();
      const tie=HOOK.items.find(i=>i.type==='tie'&&i.primaryColor==='navy');tie.name='Office';tie.updated=Date.now();
      HOOK.kitImportOpen();HOOK.kitImportText(b);const sum=document.querySelector('.kit-sum').textContent,btn=document.querySelector('#kit-imp').textContent,upd=document.querySelectorAll('.kit-rows li.upd').length,
        info=[...document.querySelectorAll('.kit-rows li.upd small')].map(x=>x.textContent);
      await HOOK.kitImportGo();
      const canon=v=>v&&typeof v==='object'&&!Array.isArray(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':JSON.stringify(v);
      const stored=await HOOK.tx('readonly',s=>s.getAll()),clean=stored.every(i=>{const c=HOOK.cleanRecord(i);return c&&canon(c)===canon(i)}),
        fsOk=stored.filter(i=>i.type==='tie').every(i=>i.fs&&i.fs.u===i.updated&&i.fs.s.pattern===i.updated&&!('brand' in i.fs.s));
      const after=HOOK.items.length,same=HOOK.items.filter(i=>i.type!=='belt').map(i=>i.id).sort().join()===ids,pats=HOOK.items.filter(i=>i.type==='tie').map(i=>i.pattern).sort().join(),named=(HOOK.items.find(i=>i.name==='Office')||{}).pattern;
      const t=document.querySelector('#toast').textContent;await document.querySelector('#toast button').click();await new Promise(r=>setTimeout(r,400));
      return {sum,btn,upd,info,after,same,pats,named,t,clean,fsOk,undone:HOOK.items.filter(i=>i.type==='tie').map(i=>i.pattern).sort().join(),n:HOOK.items.length}},[first,second]);
    ok(u.upd===5&&u.btn==='Add 1, update 5'&&/5 match pieces you have with another pattern/.test(u.sum)&&u.info.some(x=>/updates your navy tie: pattern solid → (knit|polka dot)/.test(x)),`re-importing with a Pattern column offers to update the 5 re-patterned pieces, not add them (${u.btn}; ${u.sum})`);
    ok(u.after===7&&u.same&&u.pats==='knit,paisley,polka-dot'&&/Imported 1 item and updated 5 pieces/.test(u.t),`the pieces keep their ids (and so their history) and get the patterns; only the new belt is added (${JSON.stringify(u)})`);
    ok(u.clean&&u.fsOk,`imported and updated pieces pass the record check unchanged, and an update stamps only the fields it changed, as an edit does (${u.clean}, ${u.fsOk})`);
    ok(u.undone==='solid,solid,solid'&&u.n===6,'Undo puts the updated pieces back as they were and takes the belt out: '+u.undone);
    const an=await p.evaluate(()=>{HOOK.kitImportOpen();HOOK.kitImportText('Type,Colour,Pattern\nTie,Navy,Paisley\n');const b0=document.querySelector('#kit-imp').textContent;document.querySelector('.kit-asnew').click();
      const b1=document.querySelector('#kit-imp').textContent;HOOK.kitImportText('Type,Colour\nTie,Navy\nTie,Navy\nTie,Navy\n');const b2=document.querySelector('#kit-imp').textContent;HOOK.kitImportText('Type,Colour,Name\nTie,Navy,Sheet tie\n');const b3=document.querySelector('#kit-imp').textContent;HOOK.kitClose();return {b0,b1,b2,b3}});
    ok(an.b0==='Update 1 piece'&&an.b1==='Add 1 item'&&an.b2==='Add 1 item'&&an.b3==='Add 1 item',`"Add as new" adds the row instead of updating; rows that say nothing new are the pieces already there; a name for an unnamed piece, or another name, is a new piece (${JSON.stringify(an)})`);
    /* ---- W2-15-03, -04, -05, -06, -07, W2-12-05, W2-16-06, W2-18-04 ---- */
    const w=await p.evaluate(()=>{const R=t=>{const r=HOOK.kitRead(t);return r.err?['ERR']:r.rows.map(x=>x.ok?[x.card.type,x.card.primaryColor,x.card.secondaryColor||'',x.qty,x.probs.join('/')].join(':'):'bad:'+x.line+':'+x.why)};
      return {lt:R('Type\tColour\nShirt\tlt. blue\nShirt\tlt blue\nTrousers\tdk grey\nTrousers\tmed grey\nSocks\theather grey\n'),
        line:R('Type\tColour\nSuit\tnavy\nTie\tnavy\n\t\nScarf\twhite\nBelt\tbrown'),   // (a pocket square is a type since 2026-11-16: a scarf is the row left out)
        title:R('My clothes (updated Oct)\nType\tColour\nSuit\tnavy\nShirt\twhite'),list:R('Navy suit\nWhite shirt x3\nBurgundy tie\nCharcoal pinstripe suit\nNavy and white striped tie'),
        heads:[R('Item type\tColours\nSuit\tnavy'),R('Clothing\tColour\nSuit\tnavy'),R('Piece,Colour\nSuit,navy')],
        qty:R('Type\tColour\tQty\nShirt\tWhite\t3\nTie\tNavy\t0\nSocks\tBlack\t40\nShirt\tBlue\tsome\n'),
        typo:R('Type\tColour\nShoes\tbrn\nShirt\tblue & wht\nShrit\tsky\nBrogues\tTan\nMonk straps\tBlack\nScarf\tbrnx\n'),
        long:R('Type,Colour,Name,Notes\nTie,Navy,'+'n'.repeat(80)+','+'z'.repeat(600)+'\n'),
        ar:R('Type\tColour\tName\nبدلة\tأسود\tبدلة سوداء\nقميص\tأبيض\tقميص أبيض ٢\nربطة عنق\tأزرق فاتح\t\nحذاء\tبني\t\nقبعة\tأسود\t\n'),
        slate:R('Type\tColour\nTie\tDark slate blue-gray\nTie\tdark slate blue-grey\n')}});
    ok(w.lt[0].startsWith('shirt:lightblue:')&&w.lt[1].startsWith('shirt:lightblue:')&&w.lt[2].startsWith('pants:darkgrey:')&&w.lt[3].startsWith('pants:midgrey:')&&/only “grey” of “heather grey” was understood/.test(w.lt[4]),'"lt. blue" is light blue, "dk grey" dark gray, "med grey" mid gray, and a color only partly understood says so: '+w.lt.join(' | '));
    ok(/^bad:5:/.test(w.line.find(x=>/^bad/.test(x))||''),'a row left out after a blank row has its own row number: '+w.line.join(' | '));
    ok(w.title.length===2&&w.title[0].startsWith('suit:navy'),'the column names under a title row are found: '+w.title.join(' | '));
    ok(w.list.length===5&&!w.list.some(x=>/^bad/.test(x))&&w.list[0].startsWith('suit:navy::1')&&w.list[1].startsWith('shirt:white::3')&&w.list[2].startsWith('tie:burgundy')&&w.list[4].startsWith('tie:navy:white:'),'a list with no column names is read line by line, with "x3": '+w.list.join(' | '));
    ok(w.heads.every(h=>h[0]&&h[0].startsWith('suit:navy')),'"Item type", "Colours", "Clothing" and "Piece" name the columns: '+JSON.stringify(w.heads));
    ok(w.qty[0]==='shirt:white::3:'&&/bad:3:Quantity is 0/.test(w.qty[1])&&/^socks:black::12:40 asked for/.test(w.qty[2])&&/shirt:blue::1:quantity “some” left out/.test(w.qty[3]),'a Qty column makes that many pieces, at most 12, and says what it couldn\'t read: '+w.qty.join(' | '));
    ok(w.typo[0].startsWith('shoes:brown:')&&w.typo[1].startsWith('shirt:blue:white:')&&/^shirt:lightblue::1:“Shrit” read as dress shirt/.test(w.typo[2])&&w.typo[3].startsWith('shoes:tan:')&&w.typo[4].startsWith('shoes:black:')&&/isn't a type the app plans.*“brnx” isn't a color the app knows either/.test(w.typo[5]),
      'short forms (brn, wht, sky), a typo in the type, Brogues and Monk straps are read; an unknown type and color are both said: '+w.typo.join(' | '));
    const lr=await p.evaluate(()=>HOOK.kitRead('Type,Colour,Name,Notes\nTie,Navy,'+'n'.repeat(80)+','+'z'.repeat(600)+'\n').rows[0].card);
    ok(lr.name.length===60&&lr.notes.length===500&&/name cut to 60 characters\/notes cut to 500 characters/.test(w.long[0]),'long text is cut to what is kept, and the preview says so: '+w.long[0].slice(-80));
    ok(w.ar.slice(0,4).map(x=>x.split(':').slice(0,2).join(':')).join()==='suit:black,shirt:white,tie:lightblue,shoes:brown'&&/write the type in English/.test(w.ar[4]),'Arabic type and color words are read; an unknown one asks for English: '+w.ar.join(' | '));
    ok(w.slate.every(x=>/^tie:slate::1:$/.test(x)),'the app\'s own color name with its hyphen is no "read as": '+w.slate.join(' | '));
    /* ---- W2-20-01: a file that can't be read ---- */
    const f=await p.evaluate(async()=>{HOOK.kitImportOpen();const bad={arrayBuffer:()=>Promise.reject(new DOMException('The I/O read operation failed.','NotReadableError')),text:()=>Promise.reject(new DOMException('The I/O read operation failed.','NotReadableError'))};
      await HOOK.kitImportFile(bad);const t=document.querySelector('#kit-prev').textContent;HOOK.kitClose();return t});
    ok(/This file couldn’t be read/.test(f),'a file that can\'t be read says so: '+f);
    /* ---- W1-2-01 and W1-2-02: own colours from the 14 Nov version ---- */
    const o=await p.evaluate(async()=>{for(const i of HOOK.items.slice())await HOOK.kitDelMany([i.id]);
      HOOK.settings.custom={colors:[{key:'ownmocha',name:'Mocha',hex:'#6f4e37',base:'brown',types:['suit']},{key:'owngray',name:'Gray',hex:'#eeeeee',base:'white',types:['shirt']},{key:'ownnavy',name:'Navy',hex:'#7a7f88',base:'grey',types:['suit','blazer','pants']}],patterns:[]};HOOK.applyCustom(HOOK.settings.custom);
      const mk=(id,type,c,name)=>({id,type,primaryColor:c,secondaryColor:null,pattern:'solid',name,added:1,updated:1});
      const old=[mk('o1','tie','1','Gray tie'),mk('o2','pants','2','Navy trousers'),mk('o3','suit','0','Mocha two'),{...mk('o4','shirt','white','Two'),secondaryColor:'2'}];
      await HOOK.kitStore(old);const n=await HOOK.kitFixOldImports();const disk=await HOOK.tx('readonly',s=>s.getAll());const again=await HOOK.kitFixOldImports();
      const imp=HOOK.kitRead('Type,Colour\nSuit,Navy\nTie,Navy\nTrousers,Gray\nShirt,Gray\nSuit,Grey\nSuit,Mocha\n').rows.map(x=>x.card.primaryColor);
      return {n,again,cols:disk.sort((a,b)=>a.id<b.id?-1:1).map(i=>[i.primaryColor,i.secondaryColor].filter(Boolean).join('+')),stamped:disk.every(i=>i.updated>1),imp}});
    ok(o.n===4&&o.again===0&&o.cols.join()==='grey,navy,ownmocha,white+navy'&&o.stamped,`a list number saved as a color by the 14 Nov import becomes the color its own colour's name means, stamped to sync, once (${JSON.stringify(o)})`);
    ok(o.imp.join()==='navy,navy,grey,grey,grey,ownmocha','the app\'s own color names come before own colours named alike ("Navy", "Gray"); other own colours still read by name: '+o.imp.join());
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['kit',kit],['kitfix',kitfix],['importfix3',importfix3]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
