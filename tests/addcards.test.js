// The Add card's fixes from the new-user audit (2026-11-15): one save per card (a double tap on Confirm saved it twice and threw away the
// next card; Save all and Skip the same), "How many" saved in one transaction, waiting cards kept through a kill, a photo nobody read asks
// for its type, a dropped connection keeps the photo, a picture too small to read is refused, a close-up never changes the type and its
// changes can be undone, and the wording (no model name, one full stop, the Saved toast names the item).
module.exports=async({ok,chromium,url})=>{
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
    await p.evaluate(()=>{const e=document.querySelector('#queue .typeask select');e.value='suit';e.dispatchEvent(new Event('change'))});
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
