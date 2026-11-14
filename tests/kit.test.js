// Getting started (kit.js, 2026-11-14, the owner's ask after the audit's new-user walkthrough): the quick tour and the close-up guide,
// Undo after Confirm on Add, Duplicate on the item sheet, import from a spreadsheet (CSV or pasted rows, a preview, Undo) and the
// sample wardrobe (marked sample, a note on Today, removed in one tap); every sheet fits a 320 px phone
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const open=async(w=390)=>{const ctx=await browser.newContext({viewport:{width:w,height:844}});const p=await ctx.newPage();p.errs=[];
    p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(typeof setupClose==='function'&&document.querySelector('#setup.on'))setupClose()});return p};
  const fits=p=>p.evaluate(()=>{const s=document.querySelector('#kitsheet'),out=[...s.querySelectorAll('button,label,textarea,li,svg')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-0.5||r.right>innerWidth+0.5)});
    return document.documentElement.scrollWidth<=innerWidth&&!out.length});
  try{
    const p=await open();
    /* ---- the tour ---- */
    await p.evaluate(()=>{localStorage.removeItem('tour_seen');tourOpen()});
    const t=await p.evaluate(()=>({on:!!document.querySelector('#kitsheet.on'),inert:['main'].every(s=>document.querySelector(s).inert),title:document.querySelector('#kit-title').textContent,n:document.querySelectorAll('.kit-prog i').length,seen:tourSeen()}));
    ok(t.on&&t.inert&&t.title==='The score'&&t.n===4&&!t.seen,'the tour opens full screen on "The score", four cards, the page behind inert');
    const titles=[t.title];for(let k=0;k<3;k++){await p.click('#kit-next');titles.push(await p.textContent('#kit-title'))}
    ok(titles.join('|')==='The score|The close-up|Shade|Patterns','its cards: the score, the close-up, Shade, patterns ('+titles.join(', ')+')');
    ok(await fits(p),'each card fits the phone');
    await p.click('#kit-back');ok(await p.textContent('#kit-title')==='Shade','Back goes to the card before');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(()=>!document.querySelector('#kitsheet.on')&&!document.querySelector('main').inert&&tourSeen()),'Escape closes it, the page usable again, and it is marked seen');
    /* ---- the close-up guide, from the Add card's close-up step ---- */
    await p.evaluate(()=>{openAdd();addManual()});
    ok(await p.evaluate(()=>!!document.querySelector('#queue .texguide')),'the close-up step has "Tips for a good close-up"');
    await p.click('#queue .texguide');
    const g=await p.evaluate(()=>({title:document.querySelector('#kit-title').textContent,txt:document.querySelector('.kit-body').textContent,prog:!!document.querySelector('.kit-prog')}));
    ok(g.title==='A good close-up'&&/white paper along one edge/i.test(g.txt)&&/middle/.test(g.txt)&&/no flash/i.test(g.txt)&&/tap the paper on the camera screen/i.test(g.txt)&&/exposure/.test(g.txt)&&!g.prog,'it opens the guide: paper along one edge, out of the middle, no flash, tap the paper to set the exposure');
    await p.click('#kit-next');ok(await p.evaluate(()=>!document.querySelector('#kitsheet.on')),'"Got it" closes it');
    /* ---- Undo after Confirm ---- */
    const u=await p.evaluate(async()=>{const n0=items.length,q=queue[0];q.type='tie';q.primaryColor='burgundy';q.name='Undo me';await save(0);
      const saved=items.length===n0+1&&!queue.length,t=document.querySelector('#toast'),btn=t.querySelector('button');
      return {saved,toast:t.textContent,btn:!!btn,id:q.id}});
    ok(u.saved&&/Saved: Undo me/.test(u.toast)&&u.btn,'Confirm saves the item and the toast says so with an Undo button ('+u.toast+')');
    await p.click('#toast button');
    await p.waitForFunction(()=>queue.length===1);
    const u2=await p.evaluate(async id=>({gone:!items.some(i=>i.id===id),card:queue[0].id===id&&queue[0].name==='Undo me',inDb:!!(await tx('readonly',s=>s.get(id))),tomb:true,shown:!!document.querySelector('#queue .card')}),u.id);
    ok(u2.gone&&!u2.inDb&&u2.card&&u2.shown,'Undo takes it out of the wardrobe and the store and puts its card back on Add, as it was');
    /* cards saved together are one Undo */
    const u3=await p.evaluate(async()=>{queue.length=0;addManual();addManual();queue[0].type='shirt';queue[1].type='tie';const n0=items.length;await save(0);await save(0);
      return {n:items.length-n0,toast:document.querySelector('#toast').textContent}});
    ok(u3.n===2&&/Saved 2 items/.test(u3.toast),'two cards saved one after the other: "Saved 2 items" with one Undo');
    await p.click('#toast button');await p.waitForFunction(()=>queue.length===2);ok(true,'and Undo puts both back');
    await p.evaluate(()=>{queue.length=0;renderAdd()});
    /* ---- Duplicate ---- */
    const d=await p.evaluate(async()=>{const it={id:'dup-src',type:'suit',primaryColor:'navy',pattern:'pinstripe',name:'Navy chalk',brand:'X',paused:true,cleaned:'2026-11-01',added:1};
      await put(it);items.push(it);openItem('dup-src');return !!document.querySelector('#iv-dup')});
    ok(d,'the item sheet has "Duplicate this item"');
    await p.click('#iv-dup');await p.waitForFunction(()=>items.filter(i=>i.name==='Navy chalk').length===2);
    const d2=await p.evaluate(()=>{const c=items.filter(i=>i.name==='Navy chalk'&&i.id!=='dup-src');const x=c[0]||{};
      return {n:c.length,same:x.type==='suit'&&x.primaryColor==='navy'&&x.pattern==='pinstripe'&&x.brand==='X',fresh:!x.paused&&!x.cleaned&&x.added>1,opened:editing===x.id||document.querySelector('#item-view')&&!document.querySelector('#item-view').hidden}});
    ok(d2.n===1&&d2.same&&d2.fresh&&d2.opened,'it makes one copy with the same tags, name and brand, no history (in rotation, not cleaned), and opens it');
    await p.evaluate(()=>{if(typeof closeItem==='function')closeItem();show('today')});
    /* ---- import ---- */
    const r=await p.evaluate(()=>{const a=kitRead('Item;Color;Pattern;Name;Vest\nSuit;Navy blue;Pin stripe;Office;yes\nTrousers;Mid gray;;;\nchinos;stone;;;\nLoafers;Brown;;;\nNecktie;Burgundy;checks;;\nScarf;Red;;;\nShirt;Mauve-ish;;;\n');
      const b=kitRead('Type\tColour\nShirt\tLight blue\n'),c=kitRead('Name,Brand\nx,y'),q=kitRead('Type,Colour,Notes\nTie,Navy,"Silk, ""repp"" stripe"\n');
      return {rows:a.rows.map(x=>x.ok?[x.card.type,x.card.primaryColor,x.card.pattern,x.card.vest||x.card.trouserKind||x.card.shoeStyle||'',x.card.name||''].join(':'):'bad:'+x.line+':'+x.why),
        tab:b.rows&&b.rows[0].card.primaryColor,err:c.err,quote:q.rows[0].card.notes}});
    ok(r.rows[0]==='suit:navy:pinstripe:yes:Office'&&r.rows[1]==='pants:midgrey:solid:dress:'&&r.rows[2]==='pants:stone:solid:chinos:'&&r.rows[3]==='shoes:brown:solid:loafer:'&&r.rows[4]==='tie:burgundy:check::',
      'rows are read with any column order, ; separators, common words (navy blue, pin stripe, gray, chinos, loafers, necktie, checks): '+r.rows.slice(0,5).join(' | '));
    ok(/^bad:7:.*Scarf/.test(r.rows[5])&&/^bad:8:.*Mauve-ish/.test(r.rows[6]),'an unknown type or colour is left out, saying which row and why');
    ok(r.tab==='lightblue'&&/Type.*Colour/.test(r.err)&&r.quote==='Silk, "repp" stripe','rows pasted from a spreadsheet (tabs) read too; without Type and Colour columns it says so; quoted commas and quotes are kept');
    await p.evaluate(()=>{openAdd()});await p.waitForFunction(()=>!document.querySelector('#add').hidden);
    const vis=await p.evaluate(()=>{const e=document.querySelector('#add-import'),r=e.getBoundingClientRect();let x=e,h=[];while(x){const c=getComputedStyle(x);if(c.display==='none'||c.visibility==='hidden'||x.hidden)h.push(x.id||x.className||x.tagName);x=x.parentElement}return JSON.stringify({r,h})});
    if(!/"height":[1-9]/.test(vis))console.log('add-import',vis);
    await p.click('#add-import');
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='Import from a spreadsheet'&&document.querySelector('#kit-imp').disabled),'Add → "Import from a spreadsheet" opens the sheet, Add items off until something is read');
    await p.fill('#kit-paste','Type,Colour,Second colour,Pattern\nTie,Navy,White,Polka dot\nShoes,Black,,\nHat,Black,,\n');
    const pv=await p.evaluate(()=>({sum:document.querySelector('.kit-sum').textContent,ok:document.querySelectorAll('.kit-rows li.ok').length,bad:document.querySelectorAll('.kit-rows li.bad').length,btn:document.querySelector('#kit-imp').textContent}));
    ok(pv.ok===2&&pv.bad===1&&/2 items ready, 1 row left out/.test(pv.sum)&&pv.btn==='Add 2 items','the preview lists what will be added and what is left out before anything is saved');
    ok(await fits(p),'the import sheet fits the phone');
    const n0=await p.evaluate(()=>items.length);
    await p.click('#kit-imp');await p.waitForFunction(n=>items.length===n+2,n0);
    const im=await p.evaluate(()=>{const t=items.find(i=>i.type==='tie'&&i.pattern==='polka-dot'&&i.secondaryColor==='white');return {tie:!!t,swatch:!!(t&&t.swatch),toast:document.querySelector('#toast').textContent,q:queue.length}});
    ok(im.tie&&/Imported 2 items/.test(im.toast)&&!im.q,'Add 2 items saves them as cards added by hand would be, and the toast offers Undo');
    await p.click('#toast button');
    ok(await p.waitForFunction(n=>items.length===n,n0,{timeout:5000}).then(()=>true,()=>false),'Undo takes the imported items out again '+await p.evaluate(n=>items.length+'/'+n+' '+document.querySelector('#toast').textContent+' inert:'+document.querySelector('main').inert,n0));
    /* ---- the sample wardrobe ---- */
    await p.evaluate(()=>{for(const i of items.slice())del(i.id);items=[];cache={};show('today')});
    await p.evaluate(()=>{renderToday()});
    ok(await p.evaluate(()=>!!document.querySelector('#firstrun #kit-sample-link')),'Today\'s first-outfit checklist offers the tour and a sample wardrobe');
    await p.click('#firstrun #kit-sample-link');
    if(!await p.waitForFunction(()=>items.length>=20&&!!document.querySelector('#kit-sample'),null,{timeout:15000}).then(()=>true,()=>false))
      console.log('sample state',await p.evaluate(()=>items.length+' q:'+queue.length+' today:'+!document.querySelector('#today').hidden+' ask:'+!!document.querySelector('.ask.on,#ask.on,[role=alertdialog]')+' '+document.body.className));
    const s=await p.evaluate(()=>({n:items.length,all:items.every(i=>i.sample),types:[...new Set(items.map(i=>i.type))].length,first:!!document.querySelector('#firstrun'),score:!!document.querySelector('.score')}));
    ok(s.all&&s.types>=8&&!s.first,`it adds ${s.n} pieces of ${s.types} types, all marked sample; the checklist is gone and Today plans an outfit`);
    ok(await p.evaluate(()=>/sample wardrobe/.test(document.querySelector('#kit-sample').textContent)),'Today says a sample wardrobe is being tried, with Add my own and Remove the sample');
    await p.click('#kit-sample button:has-text("Remove the sample")');
    await p.waitForSelector('#ask-ok');ok(/Remove the 24 sample pieces/.test(await p.textContent('#ask-title')),'it asks first');await p.click('#ask-ok');
    await p.waitForFunction(()=>!items.length);
    ok(await p.evaluate(async()=>!document.querySelector('#kit-sample')&&!(await tx('readonly',s=>s.getAll())).length),'Remove the sample takes every sample piece out (asked first)');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));
    await p.context().close();
    /* ---- 320 px ---- */
    const n=await open(320);await n.evaluate(()=>tourOpen());ok(await fits(n),'the tour fits a 320 px phone');await n.evaluate(()=>{kitClose();kitImportOpen()});ok(await fits(n),'and so does the import sheet');
    ok(!n.errs.length,'no page errors at 320 px: '+n.errs.join(' | '));await n.context().close();
  }finally{await browser.close()}
};
