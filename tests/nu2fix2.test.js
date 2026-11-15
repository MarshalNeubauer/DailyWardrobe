// Fix round 2 after the re-audit (2026-11-15), the Add card and Several items: a card killed while its close-up (or pattern) was read
// comes back with a button to read it again, not stuck with Confirm and Save all off (N3); Settings stays open when a reading returns or
// the connection comes back; Undo of "Saved" then a kill loses nothing; a "Several items" photo is kept through a kill and read again once
// online; Stop on a photo being read; a double tap on Confirm doesn't open what moved under the finger; the texts.
module.exports=async({ok,chromium,url})=>{
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
  const restart=async p=>{await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForFunction(()=>addRestoreState==='done',null,{timeout:20000}).catch(()=>{});
    await p.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose();openAdd()});await p.waitForTimeout(100)};
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.route(HOST+'**',route);
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');if(document.querySelector('#setup.on'))setupClose();openAdd()},HOST);

    // ---- N3: killed while the close-up is read
    await p.evaluate(`(async()=>{queue=[];await addFiles([await ${pic(400,400,'#1b2a4a')}])})()`);
    await p.waitForFunction(()=>queue[0]&&queue[0].ai&&!queue[0].busy);
    mode='slow';await p.evaluate(`(async()=>{const f=await ${pic(600,600,'#1d2b4b')};addTexture(0,f)})()`);
    await p.waitForFunction(()=>queue[0].refining);
    ok(await kept(p,async()=>{const r=await metaGet('addq');return !!(r&&r[0]&&r[0].refineCut&&!('refining' in r[0]))}),'a close-up being read is kept as cut off, not as still reading');
    await restart(p);mode='ok';await p.waitForFunction(()=>queue.length>0,null,{timeout:20000}).catch(()=>{});   // (slow under load)
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
    await p.click('#toast button');await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForFunction(()=>addRestoreState==='done',null,{timeout:8000}).catch(()=>{});
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
    ok(/Colours corrected for the light/.test(s.w)&&!/Show original/.test(s.w),'a restored card still says its colours were corrected');
    s=await p.evaluate(()=>{localStorage.removeItem('worker_url');inviteChecking=true;const a=addNoteText();inviteChecking=false;const b=addNoteText();return {a,b}});
    ok(/Checking your invitation/.test(s.a)&&!/won’t be read/.test(s.a)&&/won’t be read/.test(s.b),`while the invitation is checked Add says so (${s.a})`);
    ok(await p.evaluate(()=>countWord('watch',4)==='4 watches'&&countWord('tie',2)==='2 ties'&&countWord('shoes',2)==='2 pairs of shoes'),'plurals: watches, ties, pairs of shoes');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
    await ctx.close();
  }finally{await browser.close()}
};
