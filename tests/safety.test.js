// Data safety: failed saves say so, storage that can't be opened says so, the wardrobe asks to be kept, kept tagging copies
// of deleted items are removed, a failed tagging says why and can be tried again, unsaved Add cards guard the page, plurals.
module.exports=async({ok,chromium,url,settle})=>{
  const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const browser=await chromium.launch();
  try{
  const open=async(init)=>{const ctx=await browser.newContext({viewport:{width:390,height:780}});if(init)await ctx.addInitScript(init);
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);return {ctx,p,errs}};
  const toastText=p=>p.evaluate(()=>{const e=document.querySelector('#toast');return e.classList.contains('on')?e.textContent:''});
  const saveToast=p=>p.waitForFunction(()=>/Couldn.t save/.test(document.querySelector('#toast.on')?.textContent||''),null,{timeout:5000}).catch(()=>{});

  /* ---- failed saves ---- */
  const {ctx,p,errs}=await open(()=>{window.persistCalls=0;try{Object.defineProperty(StorageManager.prototype,'persist',{value:async()=>{window.persistCalls++;return true}});
    Object.defineProperty(StorageManager.prototype,'persisted',{value:async()=>false})}catch(e){}});
  const hung=await p.evaluate(()=>Promise.race([txs('items','readwrite',s=>{s.transaction.abort()}).then(()=>'saved',()=>'rejected'),new Promise(r=>setTimeout(()=>r('never settled'),1500))]));
  ok(hung==='rejected',`a save whose transaction is aborted fails instead of hanging (${hung})`);
  const hung2=await p.evaluate(()=>Promise.race([atomic('items','abort-me',()=>{throw new Error('x')}).then(()=>'saved',()=>'rejected'),new Promise(r=>setTimeout(()=>r('never settled'),1500))]));
  ok(hung2==='rejected',`a read-and-write that is aborted fails too (${hung2})`);
  // the phone's storage is full: the browser aborts the transaction with a QuotaExceededError
  await p.evaluate(()=>{show('add');addManual();window.realPut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(){const r=window.realPut.apply(this,arguments),t=this.transaction;Object.defineProperty(t,'error',{get:()=>new DOMException('The quota has been exceeded.','QuotaExceededError')});t.abort();return r}});
  ok(await p.evaluate(()=>window.persistCalls)===0,'nothing is asked of the browser before an item is saved');
  await p.click('#queue .card button.pri');await saveToast(p);
  const full=await toastText(p);
  ok(/Couldn.t save: your phone.s storage is full/.test(full),`a save that fails for lack of space says so (“${full}”)`);
  ok(await p.evaluate(()=>queue.length===1&&items.length===0&&!!document.querySelector('#queue .card button.pri')),'the card stays, so it can be saved again');
  // any other rejection stays quiet; a storage failure nobody caught is shown
  await p.evaluate(()=>{document.querySelector('#toast').classList.remove('on');Promise.reject(new Error('something else'))});
  await p.evaluate(()=>new Promise(r=>setTimeout(r,300)));   // waits to see that nothing appears
  ok(await toastText(p)==='','a rejection that is not about storage shows nothing');
  await p.evaluate(()=>{storeToldAt=0;metaPut('probe',1)});await saveToast(p);   // (storeToldAt: one failure is said once, so the earlier toast is forgotten first)
  ok(/Couldn.t save/.test(await toastText(p)),'a failed save that nothing caught is still shown');
  // with room again, the same card saves
  await p.evaluate(()=>{IDBObjectStore.prototype.put=window.realPut});
  await p.click('#queue .card button.pri');await p.waitForFunction(()=>items.length===1&&queue.length===0,null,{timeout:5000}).catch(()=>{});
  ok(await p.evaluate(async()=>(await tx('readonly',s=>s.getAll())).length===1),'once there is room the card saves');

  /* ---- ask the browser to keep the wardrobe, once, after the first item ---- */
  await p.waitForFunction(()=>window.persistCalls>0,null,{timeout:5000}).catch(()=>{});
  ok(await p.evaluate(()=>window.persistCalls)===1,'after the first item is saved the browser is asked to keep the wardrobe');
  await p.evaluate(()=>addManual());await p.click('#queue .card button.pri');await p.waitForFunction(()=>items.length===2&&queue.length===0,null,{timeout:5000}).catch(()=>{});
  ok(await p.evaluate(()=>window.persistCalls)===1,'and not again for the next item');
  await p.reload();await p.waitForFunction(()=>window.appReady);await settle(p,300);
  ok(await p.evaluate(()=>window.persistCalls)===0&&await p.evaluate(()=>!!localStorage.getItem('persist_asked')),'nor at the next start');

  /* ---- kept tagging copies of items that no longer exist ---- */
  const img='data:image/png;base64,'+PNG;
  const kept=()=>p.evaluate(async()=>(await (await caches.open('dw-keep-tagimg')).keys()).map(r=>decodeURIComponent(r.url.split('tagimg/')[1])).sort().join(','));
  const id=await p.evaluate(async img=>{await keepTagImg(items[0].id,img);await keepTagImg('gone-item',img);await keepTagImg('gone-too',img);return items[0].id},img);
  ok(await kept()===[id,'gone-item','gone-too'].sort().join(','),'sharp copies are kept for the benchmark');
  await p.reload();await p.waitForFunction(()=>window.appReady);
  await p.waitForFunction(async()=>(await (await caches.open('dw-keep-tagimg')).keys()).length===1,null,{timeout:8000}).catch(()=>{});
  ok(await kept()===id,`at start-up the copies of items that no longer exist are removed, the others stay (${await kept()})`);
  ok(await p.evaluate(async id=>!!(await tagImgOf(id)),id),'an existing item still has its copy');

  /* ---- unsaved Add cards guard the page ---- */
  const leave=()=>p.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented});
  ok(await leave()===false,'leaving the page is not questioned when nothing is unsaved');
  await p.evaluate(()=>{show('add');addManual()});
  ok(await leave()===true,'with an unsaved Add card, leaving the page asks first');
  await p.evaluate(()=>{queue.length=0;renderAdd()});
  ok(await leave()===false,'and no longer once the card is saved or skipped');

  /* ---- wording ---- */
  const words=await p.evaluate(()=>{const I=(id,type,primaryColor)=>({id,type,primaryColor,pattern:'solid'});const sh=I('s1','shirt','white'),t=I('t1','tie','navy');
    const b=o=>(/<b>([^<]*)<\/b>/.exec(piecesBox(o))||[])[1];return [b({shirt:sh}),b({shirt:sh,tie:t})]});
  ok(words[0]==='1 piece'&&words[1]==='2 pieces',`Today's pieces card counts in the singular too (${words})`);
  {const bad=errs.filter(e=>e!=='x'&&e!=='something else');   // the two this test threw itself
  ok(bad.length===0,'no page errors'+(bad.length?': '+bad.join(' | '):''))}
  await ctx.close();

  /* ---- tagging that fails says why and can be tried again ---- */
  {const HOST='https://wardrobevision.test/';let mode='down',posts=0;
    const c2=await browser.newContext({viewport:{width:390,height:780}});
    await c2.route(HOST+'**',async route=>{const r=route.request();if(r.method()!=='POST'||new URL(r.url()).pathname!=='/')return route.fulfill({status:404,contentType:'application/json',body:'{}'});posts++;
      if(mode==='down')return route.abort('failed');
      if(mode==='limit')return route.fulfill({status:429,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({error:'limit',message:'You have used today’s 20 photo readings. They start again tomorrow.'})});
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({type:'shirt',primaryColor:'white',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',model:'claude-test'})})});
    const q=await c2.newPage();const e2=[];q.on('pageerror',e=>e2.push(e.message));
    await q.goto(url);await q.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await q.reload();await q.waitForFunction(()=>window.appReady);
    await q.evaluate(b64=>{show('add');addFiles([new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],'a.png',{type:'image/png'})])},PNG);
    await q.waitForFunction(()=>queue.length===1&&!queue[0].busy,null,{timeout:10000}).catch(()=>{});
    const card=()=>q.evaluate(()=>{const f=document.querySelector('#queue .tagfail');return {why:f?f.textContent:'',again:!!(f&&[...f.querySelectorAll('button')].some(b=>/Try again/.test(b.textContent))),type:queue[0]&&queue[0].type,ai:queue[0]&&queue[0].ai}});
    let c=await card();
    ok(/couldn.t be reached|connection/i.test(c.why)&&c.again,`a photo that couldn't be tagged says why on its card and offers Try again (“${c.why}”)`);
    ok(await q.evaluate(()=>!!document.querySelector('#queue .card button.pri')),'the card can still be filled in and saved by hand');
    mode='limit';const n=posts;if(c.again)await q.click('#queue .tagfail button');
    await q.waitForFunction(()=>queue.length===1&&!queue[0].busy&&/photo readings/.test(document.querySelector('#queue .tagfail')?.textContent||''),null,{timeout:10000}).catch(()=>{});
    c=await card();
    ok(posts===n+1&&/You have used today’s 20 photo readings\. They start again tomorrow\./.test(c.why)&&c.again,`a daily limit shows the server's own message (“${c.why}”)`);
    mode='ok';if(c.again)await q.click('#queue .tagfail button');
    await q.waitForFunction(()=>queue.length===1&&!queue[0].busy&&queue[0].ai,null,{timeout:10000}).catch(()=>{});
    c=await card();
    ok(c.ai&&c.type==='shirt'&&c.why==='','Try again tags the card once the server answers');
    ok(e2.length===0,'no page errors while tagging fails'+(e2.length?': '+e2.join(' | '):''));
    await c2.close()}

  /* ---- storage that can't be opened ---- */
  {const {ctx:c3,p:r,errs:e3}=await open(()=>{const fail=()=>{const q={};setTimeout(()=>{q.error=new DOMException('A mutation operation was attempted on a database that did not allow mutations.','InvalidStateError');q.onerror&&q.onerror({target:q})},0);return q};
      try{IDBFactory.prototype.open=fail}catch(e){}});
    await r.waitForFunction(()=>!!document.querySelector('#nostore'),null,{timeout:8000}).catch(()=>{});
    const s=await r.evaluate(()=>{const el=document.querySelector('#nostore');if(!el)return null;const b=el.getBoundingClientRect();
      return {text:el.textContent,covers:b.left<=0&&b.top<=0&&b.right>=innerWidth&&b.bottom>=innerHeight,top:document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#nostore')===el,
        inert:document.querySelector('main').inert,btn:!!el.querySelector('button'),wide:document.documentElement.scrollWidth<=innerWidth}});
    ok(s&&/can.t be loaded or saved/.test(s.text),`when storage can't be opened a message says the wardrobe can't be loaded or saved (${s&&s.text.slice(0,90)})`);
    ok(s&&s.covers&&s.top&&s.inert&&s.btn&&s.wide,'it fills the page instead of an empty wardrobe, with a way to try again');
    ok(await toastText(r)==='','and no toast on top of it');
    ok(e3.length===0,'no page errors without storage'+(e3.length?': '+e3.join(' | '):''));
    await c3.close()}
  }finally{await browser.close()}
};
