// Fix round A of the 2026-11-16 code review, the Add card and the item sheet, done as a person does it (taps, the real dropdowns):
// CR-1-02 / CR-1-08: an Add card is found by its id, never by its place in the list: the color sheet of one card, opened before the list
// moved (a "Several items" answer, a pasted photo), still colors that card, and closes when the card goes; a tap on a card's button after
// the list moved acts on that card. CR-1-03: Undo of "Saved" brings the card back with its swatch box. CR-1-04: each "How many" copy keeps
// the sharp photo. CR-1-05: a type change under a type chip keeps the item sheet's "n of m" and ‹ ›. CR-1-06: a type change on the Add card
// drops a material the new type can't have. The worker stubbed (nothing paid).
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1')});
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const ev=(f,a)=>p.evaluate(f,a);
    const tap=async s=>{await p.locator(s).first().click();await settle(p,300)};
    await ev(()=>{HOOK.CK_OPEN['*']=true;HOOK.settings.setupDone=1;HOOK.items=[];HOOK.cache={};HOOK.queue.length=0;HOOK.show('add')});
    /* two list cards by hand (a second card for a test: queue.unshift({id,err:'open'});errToHand(id)): A a navy suit, B a tie */
    const card=(id,type,c)=>ev(([id,type,c])=>{HOOK.queue.unshift({id,err:'open'});HOOK.errToHand(id);HOOK.setq(id,'type',type);HOOK.setq(id,'primaryColor',c)},[id,type,c]);
    await card('cA','suit','navy');await card('cB','tie','burgundy');await settle(p,300);   // queue: [cB, cA]

    // CR-1-02: A's Color sheet open, the list moves under it (a card lands at the top), "Use" still colors A
    await tap('#queue [data-q="cA"] .colbtn[data-k="primaryColor"]');
    ok(await ev(()=>!!HOOK.colPick&&HOOK.colPick.ref==='cA'),'the color sheet keeps its card by its id');
    await ev(()=>{HOOK.queue.unshift({id:'cX',manual:true,type:'shirt',primaryColor:'white',pattern:'solid'});HOOK.renderAdd()});await settle(p,200);
    const pick=await ev(()=>{const t=[...document.querySelectorAll('#col-sheet .cptile[data-c]')].find(b=>b.dataset.c!=='none'&&b.dataset.c!=='navy'&&HOOK.COLORS[b.dataset.c]);return t&&t.dataset.c});
    await tap(`#col-sheet .cptile[data-c="${pick}"]`);await tap('#col-sheet .cpbar button.pri');
    const got=await ev(()=>({A:HOOK.cardOf('cA').primaryColor,X:HOOK.cardOf('cX').primaryColor,B:HOOK.cardOf('cB').primaryColor}));
    ok(got.A===pick&&got.X==='white'&&got.B==='burgundy',`after the list moved, "Use" colored the card the sheet was opened on, and no other (${pick}: ${JSON.stringify(got)})`);
    // ...and the sheet closes when its card goes
    await tap('#queue [data-q="cB"] .colbtn[data-k="primaryColor"]');
    await ev(()=>HOOK.skipCard('cB'));await settle(p,200);
    ok(await ev(()=>!HOOK.colPick&&!document.querySelector('#col-sheet').classList.contains('on')),'the color sheet of a card taken off Add closes');

    // CR-1-08: a card's own button after the list moved without a redraw yet acts on that card (its place is looked up when tapped)
    await ev(()=>{HOOK.queue.unshift({id:'cY',manual:true,type:'tie',primaryColor:'navy',pattern:'solid'})});   // (not drawn yet)
    await tap('#queue [data-q="cA"] section[data-ck="pattern"] .cklr');
    const ck=await ev(()=>({A:!!(HOOK.cardOf('cA').checked||{}).pattern,Y:!!(HOOK.cardOf('cY').checked||{}).pattern,X:!!(HOOK.cardOf('cX').checked||{}).pattern}));
    ok(ck.A&&!ck.Y&&!ck.X,`"Looks right" on a card checks that card after the list moved (${JSON.stringify(ck)})`);
    await ev(()=>{HOOK.queue.length=0;HOOK.renderAdd()});

    // CR-1-06: the Add card's type changed from a suit in tweed to a tie (the real Type dropdown): the tie is saved without the tweed
    await ev(()=>{HOOK.queue.unshift({id:'cT',err:'open'});HOOK.errToHand('cT');HOOK.setQField('cT','material','tweed')});await settle(p,200);
    await p.locator('#queue [data-q="cT"] section[data-ck="type"] select').selectOption('tie');await settle(p,200);
    ok(await ev(()=>!HOOK.cardOf('cT').material),'a type change on the Add card drops a material the new type has no place for');
    await tap('#queue [data-q="cT"] [id^="qconf-"]');await p.waitForFunction(()=>HOOK.items.some(x=>x.id==='cT'),null,{timeout:4000}).catch(()=>{});
    const tie=await ev(()=>{const i=HOOK.items.find(x=>x.id==='cT');return i?{type:i.type,material:i.material||''}:{left:HOOK.queue.map(q=>q.id).join(),toast:document.querySelector('#toast').textContent}});
    ok(tie.type==='tie'&&!tie.material,`the tie is saved without the suit's tweed (${JSON.stringify(tie)})`);

    // CR-1-03 / CR-1-04: a photo card (not read: no connection), its type picked, How many 3, Confirm, then Undo
    await ev(async()=>{const c=document.createElement('canvas');c.width=c.height=600;const x=c.getContext('2d');x.fillStyle='#f2f2f2';x.fillRect(0,0,600,600);x.fillStyle='#3a5a8a';x.fillRect(150,100,300,420);
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));await HOOK.addFiles([new File([b],'shirt.jpg',{type:'image/jpeg'})])});
    await p.waitForFunction(()=>HOOK.queue[0]&&!HOOK.queue[0].busy);await settle(p,300);
    const qid=await ev(()=>HOOK.queue[0].id);
    await p.locator(`#queue [data-q="${qid}"] select`).first().selectOption('shirt');await settle(p,300);
    for(let k=0;k<2;k++)await tap(`#queue [data-q="${qid}"] .qtyb[aria-label="One more"]`);
    await tap(`#queue [data-q="${qid}"] [id^="qconf-"]`);
    await p.waitForFunction(id=>!HOOK.queue.some(q=>q.id===id)&&HOOK.items.filter(i=>i.type==='shirt').length===3,qid);
    const sharp=await ev(async()=>{const s=HOOK.items.filter(i=>i.type==='shirt');for(let k=0;k<40;k++){const r=await Promise.all(s.map(i=>HOOK.tagImgOf(i.id)));if(r.every(Boolean))return r.length;await new Promise(f=>setTimeout(f,100))}
      return (await Promise.all(s.map(i=>HOOK.tagImgOf(i.id)))).filter(Boolean).length});
    ok(sharp===3,`each of the 3 shirts keeps the sharp photo for crop and readings (${sharp} of 3)`);
    await tap('#toast button');
    await p.waitForFunction(id=>HOOK.queue.some(q=>q.id===id),qid);await settle(p,400);
    const back=await ev(id=>{const q=HOOK.cardOf(id),c=document.querySelector(`#queue [data-q="${id}"]`);return {raw:!!(q&&q.raw&&q.raw.full),big:!!(q&&q.big),box:!!(c&&c.querySelector('.sw-box'))}},qid);
    ok(back.raw&&back.big&&back.box,`Undo of "Saved" brings the card back with its pictures and its Fabric swatch box (${JSON.stringify(back)})`);
    await ev(()=>{HOOK.queue.length=0;HOOK.renderAdd()});

    // CR-1-05: the Wardrobe on its Suit chip, a suit made a blazer in the item sheet (the real Type dropdown)
    await ev(()=>{HOOK.items=[{id:'s1',type:'suit',primaryColor:'navy',pattern:'solid'},{id:'s2',type:'suit',primaryColor:'grey',pattern:'solid'},{id:'s3',type:'suit',primaryColor:'charcoal',pattern:'solid'},{id:'t1',type:'tie',primaryColor:'navy',pattern:'solid'}];
      HOOK.cache={};HOOK.flt='suit';HOOK.show('wardrobe');HOOK.openItem('s2')});await settle(p,500);
    await p.locator('#ivbody select[data-act-change="itemPick"][data-id="s2"][data-f="type"]').selectOption('blazer');await settle(p,400);
    const nav=await ev(()=>({n:(document.querySelector('#ivhead .pcount')||{}).textContent||'',prev:document.querySelector('#iv-prev').disabled,next:document.querySelector('#iv-next').disabled,type:HOOK.items.find(i=>i.id==='s2').type}));
    ok(nav.type==='blazer'&&nav.n==='2 of 3'&&!nav.prev&&!nav.next,`under the Suit chip, a suit made a blazer keeps "n of m" and ‹ › (${JSON.stringify(nav)})`);
    await tap('#iv-next');
    ok(await ev(()=>HOOK.editing==='s3'),'› still goes to the next suit');
    await tap('.ivdone');
    ok(await ev(()=>{const a=document.activeElement;return !!a&&a!==document.body}),'closing gives the focus to something on the page');
    ok(!errs.length,`no page errors (${errs.join(' | ')})`);
  }finally{await browser.close()}
};
