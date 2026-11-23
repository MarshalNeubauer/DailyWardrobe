// The Add page's cards: saving once, How many, kept through a kill, readings, close-ups and their wording.
// Joined by feature from 5 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const fs=require('fs'),path=require('path');

/* ---- was tests/addcards.test.js ---- */
// The Add card's fixes from the new-user audit (2026-11-15): one save per card (a double tap on Confirm saved it twice and threw away the
// next card; Save all and Skip the same), "How many" saved in one transaction, waiting cards kept through a kill, a photo nobody read asks
// for its type, a dropped connection keeps the photo, a picture too small to read is refused, a close-up never changes the type and its
// changes can be undone, and the wording (no model name, one full stop, the Saved toast names the item).
const addcards=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const HOST='https://w.test/';
  let mode='ok',posts=0,answer={type:'shirt',primaryColor:'white',secondaryColor:'none',tertiaryColor:'none',pattern:'solid'};
  const route=async r=>{const q=r.request(),u=new URL(q.url()),cors={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
    if(q.method()==='POST'&&u.pathname==='/'){posts++;
      if(mode==='down')return r.abort('failed');
      if(mode==='slow')await new Promise(z=>setTimeout(z,4000));
      return r.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({...answer,model:'claude-test-model'})}).catch(()=>{})}
    if(/list=1/.test(u.search))return r.fulfill({status:200,contentType:'application/json',headers:cors,body:'{"keys":[]}'});
    return r.fulfill({status:503,contentType:'application/json',headers:cors,body:'{"error":"off"}'})};   // (no /sync: items set in memory stay)
  const pic=(w,h,col)=>`(async()=>{const c=document.createElement('canvas');c.width=${w};c.height=${h};const x=c.getContext('2d');x.fillStyle='${col||'#203050'}';x.fillRect(0,0,${w},${h});return new File([await new Promise(r=>c.toBlob(r,'image/jpeg',.9))],'p.jpg',{type:'image/jpeg'})})()`;
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.route(HOST+'**',route);
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose();openAdd()});

    // ---- C2: a double tap on Confirm saves the card once, and the next card stays
    await p.evaluate(()=>{queue=[{id:'c1',manual:true,type:'tie',primaryColor:'navy',pattern:'solid'},{id:'c2',manual:true,type:'tie',primaryColor:'gold',pattern:'solid'}];renderAdd()});
    await p.evaluate(()=>{const b=document.querySelector('#qconf-0');b.click();b.click()});
    await p.waitForFunction(()=>items.some(i=>i.id==='c1')&&!queue.some(q=>q.saving));await p.waitForTimeout(150);
    let s=await p.evaluate(async()=>({mem:items.filter(i=>i.id==='c1').length,c2:items.some(i=>i.id==='c2'),left:queue.map(q=>q.id).join(),disk:(await tx('readonly',st=>st.getAll())).length,toast:document.querySelector('#toast').textContent}));
    ok(s.mem===1&&!s.c2&&s.left==='c2'&&s.disk===1,`a double tap on Confirm saves the card once and leaves the next card waiting (${JSON.stringify(s)})`);
    ok(/^Saved: Navy tie\./.test(s.toast),`the toast names the item, not only its colour (${s.toast})`);
    // Skip found by id: a double tap skips one card
    await p.evaluate(()=>{queue.push({id:'c3',manual:true,type:'tie',primaryColor:'black',pattern:'solid'});renderAdd()});
    await p.evaluate(()=>{const b=document.querySelector('#queue .card .btns button:not(.pri)');b.click();b.click()});
    ok(await p.evaluate(()=>queue.map(q=>q.id).join()==='c3'),'a double tap on Skip skips one card');
    // ---- Save all tapped twice: every card once, in memory and on disk
    await p.waitForTimeout(1600);   // (a save within 1.5 s joins the last one's Undo: kit.js kitSaved)
    await p.evaluate(()=>{queue=['s1','s2','s3'].map((id,n)=>({id,manual:true,type:'tie',primaryColor:['red','green','grey'][n],pattern:'solid'}));renderAdd()});
    await p.evaluate(()=>{const b=document.querySelector('#save-all button');b.click();b.click()});
    await p.waitForFunction(()=>queue.length===0&&!saveAllOn);
    s=await p.evaluate(async()=>{const ids=items.map(i=>i.id);return {n:ids.length,uniq:new Set(ids).size,disk:(await tx('readonly',st=>st.getAll())).length,msg:document.querySelector('#multi-status').textContent}});
    ok(s.n===s.uniq&&s.n===4&&s.disk===4,`a double tap on Save all saves each card once (${JSON.stringify(s)})`);
    await p.click('#toast button');await p.waitForFunction(()=>queue.length===3&&items.length===1);await p.waitForTimeout(50);   // (Undo keeps the cards first, then takes the items out: kit.js kitUnsave)
    ok(await p.evaluate(()=>document.querySelector('#multi-status').textContent===''),'Undo after Save all clears "Saved 3 items to your wardrobe."');
    await p.evaluate(()=>{queue=[];renderAdd()});
    // ---- How many: the item and its copies in one transaction
    s=await p.evaluate(async()=>{let n=0;const T=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(st,m){if(m==='readwrite'&&[].concat(st).includes('items'))n++;return T.apply(this,arguments)};
      queue=[{id:'q12',manual:true,type:'socks',primaryColor:'navy',pattern:'solid',qty:12}];renderAdd();const r=await save('q12');IDBDatabase.prototype.transaction=T;
      return {r,n,saved:items.filter(i=>i.type==='socks').length,disk:(await tx('readonly',st=>st.getAll())).filter(i=>i.type==='socks').length}});
    ok(s.r===true&&s.n===1&&s.saved===12&&s.disk===12,`"Confirm 12" writes all twelve in one transaction (${JSON.stringify(s)})`);
    // ---- a past arrival date is refused
    await p.evaluate(()=>{queue=[{id:'o1',manual:true,type:'tie',primaryColor:'navy',pattern:'solid',order:true}];renderAdd();setArrives(0,'2020-01-01')});
    ok(await p.evaluate(()=>!queue[0].arrives&&/passed/.test(document.querySelector('#toast').textContent)),'"Bought, on the way" refuses a day already gone');

    // ---- not connected: a photo card asks for its type; Confirm is refused until then; the colour is then measured from the photo
    await p.evaluate(`(async()=>{queue=[];await addFiles([await ${pic(400,400,'#1b2a4a')}])})()`);
    s=await p.evaluate(()=>({sel:!!document.querySelector('#queue .typeask select'),conf:!!document.querySelector('#queue .card button.pri'),need:needType(queue[0])}));
    ok(s.sel&&!s.conf&&s.need,`an unread photo asks "What is it?" instead of saying Suit · Grey (${JSON.stringify(s)})`);
    ok(await p.evaluate(async()=>(await save(0))===false&&queue.length===1),'and can\'t be saved before its type is chosen');
    await p.evaluate(()=>{const e=document.querySelector('#queue .typeask select');e.value='suit';e.dispatchEvent(new Event('change',{bubbles:true}))});   // (as the browser's own change: it bubbles to act.js's listener)
    s=await p.evaluate(()=>({col:queue[0].primaryColor,conf:!!document.querySelector('#qconf-0'),ai:document.querySelector('#queue').textContent.includes('Not tagged by AI')}));
    ok(s.conf&&/navy/.test(s.col),`choosing the type gives the full card, its colour measured from the photo (${s.col})`);
    // too small to read: refused before any reading
    await p.evaluate(`(async()=>{queue=[];await addFiles([await ${pic(8,8)}])})()`);
    ok(await p.evaluate(()=>queue[0].err==='small'&&/too small to read \(8×8 pixels\)/.test(document.querySelector('#queue').textContent)&&!queue[0].photo),'an 8×8 picture is refused as too small to read');
    await p.click('#queue .card .btns button');   // Fill it in by hand
    ok(await p.evaluate(()=>queue[0].manual&&!!document.querySelector('#qconf-0')),'"Fill it in by hand" turns it into a card to fill in');

    // ---- connected: no connection keeps the photo with Try again, and it is read once back online
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');queue=[];renderAdd()},HOST);
    mode='down';
    await p.evaluate(`(async()=>{await addFiles([await ${pic(300,300)}])})()`);
    s=await p.evaluate(()=>({photo:!!queue[0].photo,err:queue[0].err,net:queue[0].tagNet,txt:document.querySelector('#queue').textContent}));
    ok(s.photo&&!s.err&&s.net&&/couldn’t be reached|offline/.test(s.txt)&&/Try again/.test(s.txt)&&!/couldn’t be opened/.test(s.txt),`a dropped connection keeps the photo, says so and offers Try again (${s.txt.slice(0,160)})`);
    mode='ok';const n0=posts;await p.evaluate(()=>dispatchEvent(new Event('online')));
    await p.waitForFunction(()=>queue[0]&&queue[0].ai&&!queue[0].busy,null,{timeout:8000}).catch(()=>{});
    ok(await p.evaluate(()=>queue[0].ai&&queue[0].type==='shirt'&&!/offline|couldn’t be reached/.test(document.querySelector('#add').textContent))&&posts===n0+1,'back online, the photo is read by itself and "offline" goes');
    ok(await p.evaluate(()=>/Tagged by Claude\./.test(document.querySelector('#queue').textContent)&&!/claude-test-model/.test(document.querySelector('#add').textContent)),'the card and the page name no model');
    // a photo added before the connection: "Read it now"
    await p.evaluate(()=>{localStorage.removeItem('worker_url');queue=[]});
    await p.evaluate(`(async()=>{await addFiles([await ${pic(300,300)}])})()`);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);renderAdd()},HOST);
    ok(await p.evaluate(()=>/added before the app was connected/.test(document.querySelector('#queue').textContent)&&[...document.querySelectorAll('#queue button')].some(b=>b.textContent==='Read it now')),'a photo added before the connection offers "Read it now"');
    // the tagging failure's wording
    s=await p.evaluate(()=>{const a=tagFailText(503,{error:'mock',message:'The server had a problem just now.'},'mock');const w1=tagWhy;
      const b=tagFailText(529,{error:'overloaded',detail:'The photo couldn’t be read just now. Try again later, or add the item by hand.'},'The photo couldn’t be read just now. Try again later, or add the item by hand.');
      const card=tagFailNote({tagErr:tagWhy},0);const c=tagFailText(500,{error:'busy'},'busy');return {a,w1,b,card,c}});
    ok(!/mock|\.\./.test(s.a+s.w1)&&/The server had a problem just now\. Fill/.test(s.a),`the server's own sentence, one full stop, never its code (${s.a})`);
    ok(!/\.\./.test(s.b+s.card)&&!/Try again later/.test(s.b+s.card)&&(s.card.match(/try again/gi)||[]).length===2&&!/tagging service/.test(s.card),`no doubled full stop or repeated advice (${s.b} | ${s.card.replace(/<[^>]+>/g,' ')})`);
    ok(!/busy/.test(s.c),`a bare code becomes a plain sentence (${s.c})`);

    // ---- a close-up never changes the type; a colour its measurement contradicts is kept; changes can be undone
    await p.evaluate(()=>{queue=[];renderAdd()});answer={type:'shirt',primaryColor:'white',secondaryColor:'none',tertiaryColor:'none',pattern:'solid'};
    await p.evaluate(`(async()=>{await addFiles([await ${pic(400,400,'#f4f1ea')}])})()`);
    answer={type:'suit',primaryColor:'navy',secondaryColor:'none',tertiaryColor:'none',pattern:'solid'};
    await p.evaluate(`(async()=>{await addTexture(0,await ${pic(600,600,'#f2efe6')});await new Promise(r=>{const t=setInterval(()=>{if(!queue[0].refining){clearInterval(t);r()}},50)})})()`);
    s=await p.evaluate(()=>({type:queue[0].type,col:queue[0].primaryColor,offer:!!document.querySelector('#queue .reftype'),kept:!!document.querySelector('#queue .refkept')}));
    ok(s.type==='shirt'&&s.offer,`a close-up read as a suit leaves the shirt a shirt, and offers the change (${JSON.stringify(s)})`);
    ok(s.col==='white'&&s.kept,'navy against a close-up measured near white is kept white, and said');
    answer={type:'shirt',primaryColor:'white',secondaryColor:'none',tertiaryColor:'none',pattern:'herringbone'};
    await p.evaluate(`(async()=>{await addTexture(0,await ${pic(600,600,'#f2efe6')});await new Promise(r=>{const t=setInterval(()=>{if(!queue[0].refining){clearInterval(t);r()}},50)})})()`);
    s=await p.evaluate(()=>({pat:queue[0].pattern,undo:!!document.querySelector('#queue .refnote button')}));
    ok(s.pat==='herringbone'&&s.undo,`a change from the close-up has an Undo (${JSON.stringify(s)})`);
    await p.click('#queue .refnote button');
    ok(await p.evaluate(()=>queue[0].pattern==='solid'&&queue[0].edited.pattern),'Undo puts the first tags back');

    // ---- the waiting cards survive a kill: a typed name, a read photo, a reading cut off; a saved card doesn't come back
    await p.evaluate(()=>{queue=[];renderAdd();addManual();setq(0,'type','tie');setQField(0,'name','My red tie')});
    answer={type:'shirt',primaryColor:'white',secondaryColor:'none',tertiaryColor:'none',pattern:'solid'};
    await p.evaluate(`(async()=>{await addFiles([await ${pic(300,300,'#f4f4f4')}])})()`);
    mode='slow';await p.evaluate(`(async()=>{window._sl=addFiles([await ${pic(300,300,'#333333')}])})()`);
    await p.waitForFunction(()=>queue.length===3&&queue[0].busy&&queue[0].photo);
    for(let t=0;t<50;t++){if(await p.evaluate(async()=>{const r=await metaGet('addq');return !!(r&&r.length===3&&r.some(c=>c.cut))}))break;await p.waitForTimeout(100)}   // (kept a moment after the change)
    const posts0=posts;
    // the kill: nothing the page does from here on is kept (addKeep keeps only once restored). A reload is not a kill: the page going
    // away cut the slow reading off, and on a busy WebKit its error handler still ran and kept "The server couldn't be reached" over
    // the cut card (the full --webkit run of 2026-11-17)
    await p.evaluate(()=>{clearTimeout(addKeepT);addRestoreState='killed'});
    await p.reload();await p.waitForFunction(()=>window.appReady);mode='ok';
    await p.waitForFunction(()=>addRestoreState==='done'&&queue.length===3&&queue.some(q=>!q.ai&&!q.manual&&q.tagErr),null,{timeout:20000}).catch(()=>{});
    s=await p.evaluate(()=>({n:queue.length,name:(queue.find(q=>q.manual)||{}).name,read:(queue.find(q=>q.ai)||{}).type,cut:(queue.find(q=>!q.ai&&!q.manual)||{}).tagErr,photo:queue.filter(q=>q.photo).length,toast:document.querySelector('#toast').textContent}));
    ok(s.n===3&&s.name==='My red tie'&&s.read==='shirt'&&s.photo===2,`after a kill the cards are back: the typed name, the reading and both photos (${JSON.stringify(s)})`);
    ok(/closed before this photo was read/.test(s.cut||''),`the card whose reading was cut off says so, with Try again (${s.cut})`);
    ok(posts===posts0&&/back on Add/.test(s.toast),`nothing is read again by itself, and a toast says the cards are back (${s.toast})`);
    await p.evaluate(()=>openAdd());
    const rid=await p.evaluate(()=>queue.find(q=>q.ai).id);
    await p.evaluate(id=>save(id),rid);await p.waitForTimeout(700);
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForFunction(()=>queue.length===2,null,{timeout:8000}).catch(()=>{});
    s=await p.evaluate(id=>({n:queue.length,dup:queue.some(q=>q.id===id),saved:items.filter(i=>i.id===id).length}),rid);
    ok(s.n===2&&!s.dup&&s.saved===1,`a saved card doesn't come back (${JSON.stringify(s)})`);
    await p.evaluate(()=>{queue=[];renderAdd()});await p.waitForTimeout(600);
    ok(await p.evaluate(async()=>{const r=await metaGet('addq'),k=await txs('meta','readonly',s=>s.getAllKeys(IDBKeyRange.bound('addpic:','addpic;',false,true)));return r.length===0&&k.length===0}),'once the cards are gone their kept copies go too');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/addqty.test.js ---- */
// Add several at once (2026-11-14, the owner): a shirt or socks card has a How many stepper (1-12) above Confirm; Confirm then saves that
// many identical items, each with its own id; Undo takes them all back; other types have no stepper and save one.
const addqty=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    await p.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose();openAdd();addManual();setq(0,'type','shirt');setq(0,'primaryColor','white')});
    const s0=await p.evaluate(()=>({row:!!document.querySelector('#nps-q .qtyrow'),n:document.querySelector('#qty-n-0').textContent,minus:document.querySelector('#qty-m-0').disabled,conf:document.querySelector('#qconf-0').textContent}));
    ok(s0.row&&s0.n==='1'&&s0.minus&&s0.conf==='Confirm','a shirt card has "How many": 1, minus off, Confirm');
    const box=await p.evaluate(()=>{const b=document.querySelector('#qty-p-0').getBoundingClientRect(),r=document.querySelector('#nps-q .qtyrow').getBoundingClientRect();return {h:Math.round(b.height),w:Math.round(b.width),fit:r.right<=innerWidth+0.5&&document.documentElement.scrollWidth<=innerWidth}});
    ok(box.h>=44&&box.w>=44&&box.fit,`the − and + are ${box.w}×${box.h} px and the row fits the phone`);
    await p.click('#qty-p-0');await p.click('#qty-p-0');
    const s1=await p.evaluate(()=>({n:document.querySelector('#qty-n-0').textContent,minus:document.querySelector('#qty-m-0').disabled,conf:document.querySelector('#qconf-0').textContent,q:queue[0].qty}));
    ok(s1.n==='3'&&!s1.minus&&s1.conf==='Confirm 3'&&s1.q===3,`+ twice: 3, Confirm reads "${s1.conf}"`);
    await p.click('#qty-m-0');ok(await p.evaluate(()=>document.querySelector('#qty-n-0').textContent==='2'),'− takes one off');
    await p.click('#qty-p-0');
    const n0=await p.evaluate(()=>items.length);await p.click('#qconf-0');await p.waitForFunction(n=>items.length===n+3,n0);
    const sv=await p.evaluate(n=>{const add=items.slice(n),db=Promise.all(add.map(i=>tx('readonly',s=>s.get(i.id))));return db.then(d=>({ids:new Set(add.map(i=>i.id)).size,same:add.every(i=>i.type==='shirt'&&i.primaryColor==='white'&&i.cuff===add[0].cuff),stored:d.every(Boolean),toast:document.querySelector('#toast').textContent}))},n0);
    ok(sv.ids===3&&sv.same&&sv.stored,'Confirm 3 saves three white shirts, each its own item, all stored');
    ok(/^Saved 3: White dress shirt\./.test(sv.toast),`the toast says so with Undo (${sv.toast})`);
    await p.click('#toast button');await p.waitForFunction(n=>items.length===n&&queue.length===1,n0);
    ok(await p.evaluate(()=>queue[0].qty===3&&document.querySelector('#qty-n-0').textContent==='3'),'Undo takes all three back and the card returns with its 3');
    // the top: 12
    await p.evaluate(()=>{queue[0].qty=11;renderAdd()});await p.click('#qty-p-0');
    ok(await p.evaluate(()=>document.querySelector('#qty-n-0').textContent==='12'&&document.querySelector('#qty-p-0').disabled),'at most 12');
    // socks too; other types none, and a number set before changing type is ignored (the card Undo brought back is on Add's list)
    await p.evaluate(()=>{setq(0,'type','socks')});ok(await p.evaluate(()=>!!document.querySelector('#queue .qtyrow')&&/pairs/.test(document.querySelector('#queue .qtyl').textContent)),'socks have it ("Identical pairs")');
    await p.evaluate(()=>{setq(0,'type','tie')});ok(await p.evaluate(()=>!document.querySelector('#queue .qtyrow')&&document.querySelector('#qconf-0').textContent==='Confirm'),'a tie has no stepper');
    const n1=await p.evaluate(()=>items.length);await p.click('#qconf-0');await p.waitForFunction(n=>items.length>n,n1);await p.waitForTimeout(200);
    ok(await p.evaluate(n=>items.length===n+1,n1),'and saves one, though 12 was set while it was a shirt');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/addreadend.test.js ---- */
// An Add card is drawn again whenever Claude's reading of it ends, even when a step after the answer fails (2026-11-16, a tester could
// save only after tapping "Bought, on the way": a pattern answer that couldn't be drawn threw after the reading's flag was cleared, and
// Confirm stayed switched off until something else redrew the card).
const addreadend=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.route('**/wv.test/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const conf=()=>p.evaluate(()=>{const q=queue[0],b=document.querySelector('#qconf-0');return {reading:!!(q&&(q.refining||q.patternReading)),off:b?b.disabled:'none'}});
    const start=async(pattern,arm)=>{await p.evaluate(async pat=>{queue.length=0;localStorage.setItem('worker_url','https://wv.test/');localStorage.setItem('app_token','x');
      window.ask=async()=>({type:'suit',primaryColor:'navy',secondaryColor:'white',tertiaryColor:null,pattern:'pinstripe',confidence:{type:'high',primaryColor:'high',pattern:'high'},model:'stub',
        weave:{direction:'vertical',repeatsAcross:30,colours:['#1f2a44','#e8e8e8'],description:'navy with fine white pinstripes'}});
      window.__patAns=pat;if(!window.__patF){const f0=window.fetch;window.__patF=1;window.fetch=(u,o)=>/\/pattern$/.test(String(u))?Promise.resolve(new Response(JSON.stringify(window.__patAns||{}),{status:200})):f0(u,o)}   // the server's answer to POST /pattern
      openAdd();
      const bl=await (await fetch('tests/fixtures/suit-pinstripe.jpg')).blob();await addFiles([new File([bl],'s.jpg',{type:'image/jpeg'})])},pattern);
      await p.waitForFunction(()=>queue[0]&&!queue[0].busy&&document.querySelector('#qconf-0'));
      // arm: measuring this card throws from its second write of q.meas on (the first is the close-up's own, before the reading, which tagging.js catches)
      if(arm)await p.evaluate(()=>{const q=queue[0];let v=q.meas,n=0;window.__measThrew=0;Object.defineProperty(q,'meas',{configurable:true,enumerable:true,get:()=>v,set(x){if(++n>1){window.__measThrew++;throw new Error('measuring failed')}v=x}})});
      await p.evaluate(async()=>{const bl=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([bl],'c.jpg',{type:'image/jpeg'}))});
      await p.waitForFunction(()=>queue[0]&&!queue[0].refining&&!queue[0].patternReading,null,{timeout:20000});await p.waitForTimeout(300)};

    // a pattern answer of a shape that can't be drawn (across without bands)
    await start({layout:'bands',across:[{hex:'#1f2a44',w:9}],stripeDirection:'vertical',repeatsInCloseup:6,repeatsAcrossItem:30,paneAspect:1});
    let c=await conf();ok(!c.reading&&c.off===false,'a pattern answer that can\'t be drawn: the reading ends and Confirm is on ('+JSON.stringify(c)+')');
    ok(await p.evaluate(async()=>{const r=await save(queue[0].id);return r===true&&items.length===1&&!items[0].order}),'and the item saves in rotation, without "Bought, on the way"');

    // a step after the close-up's answer throws
    await start(null,true);
    c=await conf();const threw=await p.evaluate(()=>window.__measThrew);ok(threw>0&&!c.reading&&c.off===false,'a measuring step that throws after the close-up\'s answer: Confirm is on ('+JSON.stringify({...c,threw})+')');

    // the reading itself fails (the network): Confirm comes back too
    await p.evaluate(()=>{window._ask=window.ask});await start(null);
    await p.evaluate(()=>{window.ask=async()=>{throw new Error('offline')}});
    await p.evaluate(async()=>{const bl=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([bl],'c2.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0]&&!queue[0].refining&&!queue[0].patternReading,null,{timeout:20000});await p.waitForTimeout(300);
    c=await conf();ok(!c.reading&&c.off===false,'a close-up reading that fails outright: Confirm is on ('+JSON.stringify(c)+')');
    ok(!errs.length,'no uncaught errors ('+errs.join('; ')+')');
  }finally{await browser.close()}};

/* ---- was tests/nu2fix2.test.js ---- */
// Fix round 2 after the re-audit (2026-11-15), the Add card and Several items: a card killed while its close-up (or pattern) was read
// comes back with a button to read it again, not stuck with Confirm and Save all off (N3); Settings stays open when a reading returns or
// the connection comes back; Undo of "Saved" then a kill loses nothing; a "Several items" photo is kept through a kill and read again once
// online; Stop on a photo being read; a double tap on Confirm doesn't open what moved under the finger; the texts.
const nu2fix2=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const HOST='https://w.test/';
  let mode='ok',many='ok',posts=0,manyPosts=0,answer={type:'tie',primaryColor:'navy',secondaryColor:'none',tertiaryColor:'none',pattern:'solid'};
  const MANY={items:[{type:'tie',primaryColor:'navy',pattern:'solid',box:{x:0,y:0,w:400,h:400},confidence:'high'},{type:'watch',primaryColor:'silver',box:{x:500,y:0,w:300,h:300}},
    {type:'watch',primaryColor:'gold',box:{x:500,y:500,w:300,h:300}},{type:'hat',primaryColor:'black',box:{x:0,y:500,w:300,h:300}}],model:'claude-test'};
  const route=async r=>{const q=r.request(),u=new URL(q.url()),cors={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
    if(q.method()==='POST'&&u.pathname==='/'){posts++;
      if(mode==='down')return r.abort('failed');
      if(mode==='slow')await new Promise(z=>setTimeout(z,4000));
      if(mode==='stall')await new Promise(z=>setTimeout(z,20000));
      return r.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({...answer,model:'claude-test'})}).catch(()=>{})}
    if(q.method()==='POST'&&u.pathname==='/tag-many'){manyPosts++;
      if(many==='down')return r.abort('failed');
      if(many==='slow')await new Promise(z=>setTimeout(z,4000));
      if(many==='529')return r.fulfill({status:529,contentType:'application/json',headers:cors,body:JSON.stringify({error:'overloaded',message:'The photo couldn’t be read just now. Try again later, or add the item by hand.'})});
      return r.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(MANY)}).catch(()=>{})}
    if(/list=1/.test(u.search))return r.fulfill({status:200,contentType:'application/json',headers:cors,body:'{"keys":[]}'});
    return r.fulfill({status:503,contentType:'application/json',headers:cors,body:'{"error":"off"}'})};
  const pic=(w,h,col)=>`(async()=>{const c=document.createElement('canvas');c.width=${w};c.height=${h};const x=c.getContext('2d');x.fillStyle='${col||'#203050'}';x.fillRect(0,0,${w},${h});return new File([await new Promise(r=>c.toBlob(r,'image/jpeg',.9))],'p.jpg',{type:'image/jpeg'})})()`;
  const kept=async(p,fn)=>{for(let t=0;t<50;t++){if(await p.evaluate(fn))return true;await p.waitForTimeout(100)}return false};
  // a kill: nothing the page does from here on is kept (addKeep keeps only once restored). A reload alone is not a kill: the page going
  // away cut the slow reading off, and on a busy WebKit its error handler still ran and kept the card without refineCut (the full
  // --webkit run of 2026-11-17: "it comes back saying the reading was cut off" failed with "Tagging again…" and no button)
  const restart=async p=>{await p.evaluate(()=>{clearTimeout(addKeepT);addRestoreState='killed'});await p.reload();await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});await p.waitForFunction(()=>addRestoreState==='done',null,{timeout:20000}).catch(()=>{});
    await p.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose();openAdd()});await p.waitForTimeout(100)};
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.route(HOST+'**',route);
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');if(document.querySelector('#setup.on'))setupClose();openAdd()},HOST);

    // ---- N3: killed while the close-up is read
    await p.evaluate(`(async()=>{queue=[];await addFiles([await ${pic(400,400,'#1b2a4a')}])})()`);
    await p.waitForFunction(()=>queue[0]&&queue[0].ai&&!queue[0].busy);
    mode='slow';await p.evaluate(`(async()=>{const f=await ${pic(600,600,'#1d2b4b')};addTexture(0,f)})()`);
    await p.waitForFunction(()=>queue[0].refining);
    ok(await kept(p,async()=>{const r=await metaGet('addq');return !!(r&&r[0]&&r[0].refineCut&&!('refining' in r[0]))}),'a close-up being read is kept as cut off, not as still reading');
    await restart(p);mode='ok';await p.waitForFunction(()=>queue.length>0&&!!document.querySelector('#qconf-0'),null,{timeout:20000}).catch(()=>{});   // (slow under load)
    let s=await p.evaluate(()=>({n:queue.length,reading:queue.some(cardReading),tex:!!queue[0].texture,cut:!!document.querySelector('#queue .refcut'),stuck:/Tagging again/.test(document.querySelector('#queue').textContent),conf:!document.querySelector('#qconf-0').disabled}));
    ok(s.n===1&&!s.reading&&s.tex&&s.cut&&!s.stuck&&s.conf,`it comes back saying the reading was cut off, Confirm on (${JSON.stringify(s)})`);
    await p.evaluate(()=>{addManual();setq(0,'type','tie')});
    ok(await p.evaluate(()=>{const b=document.querySelector('#save-all button');return !!b&&!b.disabled}),'Save all works for the other cards');
    const p0=posts;await p.evaluate(()=>{const b=[...document.querySelectorAll('#queue .refcut button')][0];b.click()});
    await p.waitForFunction(()=>queue.some(q=>q.refineNote)&&!queue.some(q=>q.refining),null,{timeout:8000}).catch(()=>{});
    ok(posts===p0+1&&await p.evaluate(()=>!document.querySelector('#queue .refcut')),'"Read the close-up again" reads it, once, on the tap');
    // a record kept by the version before (in-flight flags stored) is released too
    await p.evaluate(async()=>{await txs('meta','readwrite',st=>st.put({k:'addq',v:[{id:'L1',manual:true,type:'tie',primaryColor:'navy',pattern:'solid',refining:1,patternReading:1}]}))});
    await restart(p);
    ok(await p.evaluate(()=>queue.length===1&&!cardReading(queue[0])&&!document.querySelector('#qconf-0').disabled),'an old record with the reading flags comes back usable');

    // ---- Settings stays open when Add is redrawn (a reading back, the connection back)
    await p.evaluate(()=>{openSettings();renderAdd();dispatchEvent(new Event('online'))});
    ok(await p.evaluate(()=>settingsOpen()),'Settings stays open when a reading returns or the connection comes back');
    await p.evaluate(()=>closeSettings());

    // ---- Undo of "Saved", then a kill at once: the item is in the wardrobe or back on Add, never lost
    await p.evaluate(()=>{queue=[];addManual();setq(0,'type','tie');setQField(0,'name','Undo kill')});
    const uid=await p.evaluate(async()=>{const id=queue[0].id;await save(id);return id});
    await p.click('#toast button');await p.reload();await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});await p.waitForFunction(()=>addRestoreState==='done',null,{timeout:8000}).catch(()=>{});
    s=await p.evaluate(id=>({item:items.some(i=>i.id===id),card:queue.some(q=>q.id===id)}),uid);
    ok(s.item!==s.card,`Undo then a kill: the item stays or its card is back, exactly one (${JSON.stringify(s)})`);
    await p.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose();openAdd();queue=[];renderAdd()});

    // ---- "How many": a kill right after the last + keeps it
    await p.evaluate(()=>{addManual();setq(0,'type','socks')});await p.click('#qty-p-0');await p.click('#qty-p-0');
    ok(await kept(p,async()=>{const r=await metaGet('addq');return !!(r&&r[0]&&r[0].qty===3)}),'the last + is kept at once');
    await p.evaluate(()=>{queue=[];renderAdd()});

    // ---- Several items: the photo is kept while it is read; a kill brings it back with Try again
    many='slow';await p.evaluate(`(async()=>{addFiles([await ${pic(800,800,'#556677')}],true)})()`);
    await p.waitForFunction(()=>queue[0]&&queue[0].multiBusy&&queue[0].multiPic);
    ok(await kept(p,async()=>{const r=await metaGet('addq'),pic=r&&r[0]&&await metaGet('addpic:'+r[0].id);return !!(pic&&pic.multiPic)}),'a "Several items" photo is kept before it is read');
    await restart(p);many='ok';
    s=await p.evaluate(()=>({n:queue.length,err:queue[0]&&queue[0].multiErr,txt:document.querySelector('#queue').textContent}));
    ok(s.n===1&&/closed before this photo was read/.test(s.err||'')&&/Try again/.test(s.txt),`after a kill it is back, saying so, with Try again (${s.txt.slice(0,120)})`);
    const m0=manyPosts;await p.evaluate(()=>multiAgain(queue[0].id));await p.waitForFunction(()=>queue.length===3,null,{timeout:8000}).catch(()=>{});
    s=await p.evaluate(()=>({types:queue.map(q=>q.type).join(),msg:document.querySelector('#multi-status').textContent}));
    ok(manyPosts===m0+1&&s.types==='tie,watch,watch',`Try again reads the kept photo; a hat isn't made a suit (${s.types})`);
    ok(/2 watches/.test(s.msg)&&/doesn’t plan \(hat\)/.test(s.msg)&&!/watchs/.test(s.msg),`the summary: "2 watches", and the hat left out (${s.msg})`);
    await p.evaluate(()=>{queue=[];renderAdd()});
    // offline: kept through a kill, and read again by itself once online
    many='down';await p.evaluate(`(async()=>{await addFiles([await ${pic(800,800,'#556677')}],true)})()`);
    s=await p.evaluate(()=>({net:queue[0].multiNet,txt:document.querySelector('#queue').textContent}));
    ok(s.net&&/photo is kept/.test(s.txt),`offline, the card says the photo is kept (${s.txt.slice(0,140)})`);
    ok(await kept(p,async()=>{const r=await metaGet('addq');return !!(r&&r[0]&&r[0].multiErr)}),'and it is');
    await restart(p);many='ok';
    ok(await p.evaluate(()=>queue.length===1&&!!queue[0].multiErr&&queue[0].multiNet),'a failed "Several items" card survives a kill');
    const m1=manyPosts;await p.evaluate(()=>dispatchEvent(new Event('online')));await p.waitForFunction(()=>queue.length===3,null,{timeout:8000}).catch(()=>{});
    ok(manyPosts===m1+1&&await p.evaluate(()=>queue.length===3),'back online it is read again by itself');
    await p.evaluate(()=>{queue=[];renderAdd()});
    // the server's "Try again later, or add the item by hand" is not shown beside Try again
    many='529';await p.evaluate(`(async()=>{await addFiles([await ${pic(500,500)}],true)})()`);
    s=await p.evaluate(()=>document.querySelector('#queue').textContent);
    ok(/couldn’t be read just now\./.test(s)&&!/Try again later|by hand/.test(s),`the failure doesn't repeat "Try again later, or add it by hand" (${s.slice(0,140)})`);
    await p.click('#queue .card .btns button:not(.pri)');   // Dismiss
    ok(await p.evaluate(()=>document.querySelector('#multi-status').textContent===''),'dismissing it clears "Each item in the photo gets its own card…"');
    many='ok';

    // ---- Stop on a photo being read
    mode='stall';await p.evaluate(`(async()=>{window._st=addFiles([await ${pic(300,300,'#7a2030')}])})()`);
    await p.waitForSelector('#queue .stopread',{timeout:5000});await p.click('#queue .stopread');
    await p.waitForFunction(()=>queue[0]&&!queue[0].busy,null,{timeout:5000}).catch(()=>{});
    s=await p.evaluate(()=>({busy:queue[0].busy,photo:!!queue[0].photo,err:queue[0].tagErr,ask:!!document.querySelector('#queue .typeask'),note:document.querySelector('#note').textContent}));
    ok(!s.busy&&s.photo&&s.err==='You stopped the reading.'&&s.ask&&!/failed/.test(s.note),`Stop ends the wait and keeps the photo, to fill in or try again (${JSON.stringify(s)})`);
    mode='ok';await p.evaluate(()=>{queue=[];renderAdd()});

    // ---- a double tap on the last card's Confirm doesn't open the import sheet that moves under the finger
    await p.evaluate(`(async()=>{await addFiles([await ${pic(400,400,'#1b2a4a')}])})()`);await p.waitForFunction(()=>queue[0]&&queue[0].ai&&!queue[0].busy);await p.waitForTimeout(500);
    const b=await p.evaluate(()=>{document.querySelector('#add').style.paddingBottom='1500px';document.querySelector('#qconf-0').scrollIntoView({block:'center'});const r=document.querySelector('#qconf-0').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
    const n0=await p.evaluate(()=>items.length);
    await p.mouse.click(b.x,b.y);await p.waitForFunction(()=>queue.length===0);   // the card has gone: the list closed up under the finger
    // (how far the page moves depends on the cards and the phone: the import row is brought under the finger, as on the tester's phone)
    const under=await p.evaluate(b=>{const r=document.querySelector('#add-import').getBoundingClientRect();scrollBy(0,r.y+r.height/2-b.y);const e=document.elementFromPoint(b.x,b.y);return e?(e.closest('button')||e).id:''},b);
    await p.mouse.click(b.x,b.y);await p.waitForTimeout(300);
    s=await p.evaluate(n=>({saved:items.length-n,kit:typeof kitEl==='function'&&kitEl().classList.contains('on')}),n0);
    ok(under==='add-import'&&s.saved===1&&!s.kit,`a double tap saves once and doesn't open the import that moved under the finger (${JSON.stringify(s)}, under it: ${under})`);
    await p.waitForTimeout(500);await p.mouse.click(b.x,b.y);await p.waitForTimeout(200);
    ok(await p.evaluate(()=>kitEl().classList.contains('on')),'a tap there a moment later works as usual');await p.evaluate(()=>{kitClose();document.querySelector('#add').style.paddingBottom=''});

    // ---- texts: a hand card's close-up, a restored card's correction, the note while the invitation is checked
    await p.evaluate(()=>{queue=[{id:'h1',manual:true,type:'tie',primaryColor:'navy',pattern:'solid',texture:'data:image/png;base64,iVBORw0KGgo=',meas:{src:'closeup',sharp:.1,lab:[20,0,-10]}},
      {id:'w1',type:'tie',primaryColor:'navy',pattern:'solid',ai:true,photo:'data:image/png;base64,iVBORw0KGgo=',wbWas:1}];renderAdd()});
    s=await p.evaluate(()=>({h:document.querySelector('#queue [data-q="h1"]').textContent,w:document.querySelector('#queue [data-q="w1"]').textContent}));
    ok(!/right half/.test(s.h)&&/too blurry/.test(s.h),`a hand card's close-up doesn't mention a swatch it lacks, and a blurry one is flagged (${s.h.slice(0,120)})`);
    ok(/Colors corrected for the light/.test(s.w)&&!/Show original/.test(s.w),'a restored card still says its colors were corrected');
    s=await p.evaluate(()=>{localStorage.removeItem('worker_url');inviteChecking=true;const a=addNoteText();inviteChecking=false;const b=addNoteText();return {a,b}});
    ok(/Checking your invitation/.test(s.a)&&!/won’t be read/.test(s.a)&&/won’t be read/.test(s.b),`while the invitation is checked Add says so (${s.a})`);
    ok(await p.evaluate(()=>countWord('watch',4)==='4 watches'&&countWord('tie',2)==='2 ties'&&countWord('shoes',2)==='2 pairs of shoes'),'plurals: watches, ties, pairs of shoes');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/auditfix.test.js ---- */
// Quick bugs from the 2026-11-13 audit: an item photo at PH_MAX (not the 800 px measuring copy), Confirm / Save all wait while Claude
// reads a card and no pattern call for a card that left the queue, the reminder's title, the sharp close-ups pruned, one Generate tap
// is one request, the Backup line inside agrees with its summary, the trousers row of the checklist, the Days off summary follows a
// change, the schedule summary from the week's first day.
const auditfix=async({ok,chromium,url})=>{
  const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),ac=fs.readFileSync(path.join(__dirname,'..','asm-color.js'),'utf8');
  ok(sw.includes("'Today’s outfit'")&&!/â€/.test(sw)&&/\$\{asmGapRun\.n\}…</.test(ac),'the reminder reads "Today’s outfit" (no garbled "â€" in sw.js) and Settings\' "Reading 1 of 3…" has its ellipsis');
  const browser=await chromium.launch();
  try{
    /* this part points the app at the made-up host w.test with nothing answering it, so the app's own requests there (/sync, /me)
       fail; WebKit reports each as the page error "/w.test/<path> due to access control checks." (Chromium reports nothing).
       Exactly that error, on that host, is left out, as tests/webkit.js does for sw.js; every other error still counts */
    const FAKE_CUT=/^\/w\.test\/[\w\/?=&%.-]* due to access control checks\.$/;
    const p=await browser.newPage({viewport:{width:390,height:900}});const errs=[];p.on('pageerror',e=>{if(!FAKE_CUT.test(e.message))errs.push(e.message)});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the photo from the sharp copy
    const dims=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=3000;c.height=2000;const x=c.getContext('2d');x.fillStyle='#345';x.fillRect(0,0,3000,2000);
      const q={raw:{big:shrink(c,800),full:shrink(c,TAG_MAX)},wb:null};cardPics(q);const im=new Image();im.src=q.photo;await im.decode();return [im.width,im.height,PH_MAX]});
    ok(dims[0]===dims[2]&&dims[1]===1024,`a new item's photo is ${dims[2]} px across, not the 800 px measuring copy (${dims[0]}×${dims[1]})`);
    // Confirm and Save all wait for Claude
    // (the first card is in the "Add without a photo" sheet, its Confirm in the sheet's bar; the second a card of the list)
    const r=await p.evaluate(async()=>{show('add');addManual();queue.push({id:'h1',err:'open'});errToHand('h1');queue[0].refining=1;renderAdd();
      const conf=['#nps-bar .pri','#queue .btns button.pri'].map(s=>document.querySelector(s).disabled),all=document.querySelector('#save-all button');
      const before=items.length;await save(0);await saveAll();const kept=queue.length,after=items.length;
      let called=0;const was=window.fetch;window.fetch=(u,o)=>{if(/\/pattern$/.test(String(u))){called++;return Promise.resolve(new Response('{}',{status:200}))}return was(u,o)};
      const q={...queue[1],raw:{tex:document.createElement('canvas')},tagImg:'data:x',type:'tie',pattern:'stripe'};localStorage.setItem('worker_url','https://w.test/');
      await readPatternWithClaude(q);window.fetch=was;localStorage.removeItem('worker_url');
      queue[0].refining=0;renderAdd();const conf2=document.querySelector('#nps-bar .pri').disabled;queue.length=0;renderAdd();
      return {conf,all:all&&all.disabled,before,after,kept,called,conf2}});
    ok(r.conf[0]===true&&r.conf[1]===false&&r.all===true,`while Claude reads a card its Confirm and Save all are switched off, the other card's Confirm not (${JSON.stringify(r)})`);
    ok(r.before===r.after&&r.kept===2&&r.conf2===false,'save() and saveAll() save nothing meanwhile, and Confirm comes back once the reading is in');
    ok(r.called===0,'a card no longer in the queue (saved or skipped) sends no pattern request');
    // the kept sharp close-ups of deleted items go too
    const pr=await p.evaluate(async()=>{const was=items;items=[{id:'keep1',type:'tie',primaryColor:'navy',pattern:'solid'}];const c=await caches.open(TAGIMG_CACHE);for(const n of ['tagimg/gone1','closeimg/gone2','closeimg/keep1'])await c.put(new Request(n),new Response('x'));
      const n=await pruneTagImgs();items=was;const left=(await c.keys()).map(k=>k.url.replace(/^.*\/(\w+img\/)/,'$1'));return {n,left}});
    ok(pr.n===2&&pr.left.includes('closeimg/keep1')&&!pr.left.some(u=>/gone/.test(u)),`kept close-ups of deleted items are removed with the tagging copies (${JSON.stringify(pr)})`);
    // the Backup line inside Settings while a backup runs
    const b=await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t');localStorage.setItem('last_sync',String(Date.now()));localStorage.removeItem('sync_status');syncing=true;openSettings('backup');const a=document.querySelector('#sync-status').textContent,s=document.querySelector('#sum-backup').textContent;
      syncing=false;localStorage.setItem('sync_status','Syncing…');showSyncStatus();const c=document.querySelector('#sync-status').textContent;for(const k of ['sync_status','worker_url','app_token','last_sync'])localStorage.removeItem(k);closeSettings();return {a,s,c}});
    ok(/^Backed up /.test(b.a)&&/^Backed up today$/.test(b.s)&&/^Backed up .* · syncing…$/.test(b.c),`the Backup line inside agrees with its summary while a backup runs (${JSON.stringify(b)})`);
    // the checklist's trousers row with jackets on and no suit
    const t=await p.evaluate(()=>{const was=items;items=[];const h=setupToday();items=was;const d=document.createElement('div');d.innerHTML=h;const li=d.querySelector('[data-need="pants"]');return li&&li.textContent});
    ok(/not needed with a suit/.test(t)&&/If no suit/.test(t)&&!/Needed/.test(t),`the trousers row isn't marked "Needed" beside "not needed with a suit" (${t})`);
    // the Days off summary follows an added day; the schedule summary starts with the week's first day
    const o=await p.evaluate(async()=>{openSettings('daysoff');const s0=document.querySelector('#sum-daysoff').textContent;const T=todayDate(),d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+3);
      document.querySelector('#cfg-off-from').value=isoKey(d);await addDayOff();const s1=document.querySelector('#sum-daysoff').textContent;
      const w=settings.workdays;settings.workdays=[0,1,2,3,4];settingsSummaries();const a=document.querySelector('#sum-schedule').textContent;settings.workdays=[6,0];settingsSummaries();const c=document.querySelector('#sum-schedule').textContent;
      settings.workdays=[1,3,5];settingsSummaries();const e=document.querySelector('#sum-schedule').textContent;settings.workdays=w;closeSettings();return {s0,s1,a,c,e}});
    ok(/0 days off/.test(o.s0)&&/1 day off/.test(o.s1),`the Days off summary follows a day added (${o.s0} → ${o.s1})`);
    ok(/^Sun–Thu/.test(o.a)&&/^Sat, Sun/.test(o.c)&&/^Mon, Wed, Fri/.test(o.e),`the schedule summary starts with the week's first day (${o.a} | ${o.c} | ${o.e})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['addcards',addcards],['addqty',addqty],['addreadend',addreadend],['nu2fix2',nu2fix2],['auditfix',auditfix]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
