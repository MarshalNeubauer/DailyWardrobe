// Fix round 3, Fixer 6 (2026-11-16): backup size, server limits and storage.
//  W2-18-01  photos go up in batches under a size budget; a 413 halves it, one item too large pauses until tomorrow (not again at every close)
//  W1-10-01  "Delete everything" with the day's writes used up deletes nothing (the list is written before the code goes); a failure after
//            the code is gone is finished by the queue, and the app says it in its own words
//  W1-10-02  Revoke with the day's writes used up changes nothing (the record before the hub); the refusal says nothing was changed
//  W2-14-03 / W1-6-07  daily backups are named by the day they are for, with item counts; an empty copy is said in the roll-back question
//  W1-10-03 / W1-10-04  "Paused until" the real time; Connection doesn't say "backed up" while paused
//  W1-11-05  this phone's storage full during a sync: the app's plain sentence, in a toast and the status
//  W1-11-04 (owner decision 2)  Safari-only: the risk said once (Home Screen step) and under Backup; a reminder at 10+ items never backed up
//  W1-1-02   pictures remade at start-up: at most REMAKE_DAY a day on a connected phone
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();let full=false,delFail=null;const queued=[];
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,
    put:async(k,v,o)=>{if(full)throw new Error('KV put() limit exceeded for the day.');store.set(k,v);meta.set(k,o&&o.metadata)},
    delete:async k=>{if(full||(delFail&&delFail(k)))throw new Error('KV delete() limit exceeded for the day.');store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV,RENDER_QUEUE:{send:async(m,o)=>{queued.push({m,o})}}},HOST='https://wardrobevision.test/';
  const call=(p,o={},tok='secret')=>worker.fetch(new Request(HOST+p,{...o,headers:{'x-app-token':tok,'content-type':'application/json',...(o.headers||{})}}),env);

  // ---- W1-10-02: Revoke under the limit changes nothing
  const inv=await (await call('invites',{method:'POST',body:JSON.stringify({name:'Rev'})})).json();
  full=true;const rv=await call('invites?id='+inv.id,{method:'DELETE'}),rvj=await rv.json();full=false;
  const list1=(await (await call('invites')).json()).invites.find(v=>v.id===inv.id),me1=await call('me',{},inv.code);
  ok(rv.status===429&&/nothing was changed/.test(rvj.message)&&!/kept on this device/.test(rvj.message)&&list1&&!list1.off&&me1.status===200,
    `Revoke with the writes used up: refused, nothing changed, the refusal says so (${rv.status} ${rvj.message})`);
  const rv2=await call('invites?id='+inv.id,{method:'DELETE'}),me2=await call('me',{},inv.code);
  ok(rv2.status===200&&me2.status===403,'Revoke again after the reset: switched off');

  // ---- W1-10-01: Delete everything under the limit
  const t2=await (await call('invites',{method:'POST',body:JSON.stringify({name:'Del'})})).json();
  const L0=await (await call('sync?lite=1',{},t2.code)).json();
  await call('sync',{method:'POST',body:JSON.stringify({baseRev:L0.rev,baseSaved:L0.saved,day:'2026-11-15',delta:{items:[{id:'d1',type:'tie',primaryColor:'navy',pattern:'solid',updated:1}],days:[],tombstones:{}},photos:{}})},t2.code);
  const userKeys=()=>[...store.keys()].filter(k=>k.startsWith(`u:${t2.id}:`)).length,k0=userKeys();
  full=true;const d1=await call('account',{method:'DELETE',body:JSON.stringify({confirm:'delete'})},t2.code),d1j=await d1.json();full=false;
  const me3=await call('me',{},t2.code),inList=(await (await call('invites')).json()).invites.some(v=>v.id===t2.id);
  ok(d1.status===429&&me3.status===200&&inList&&userKeys()===k0&&k0>0,`Delete everything with the writes used up: nothing deleted, the code still works (${d1.status}, ${userKeys()} keys, /me ${me3.status})`);
  ok(/nothing was changed/.test(d1j.message||''),'and the refusal doesn\'t promise to save it later');
  // the code gone, then a delete refused: the queue finishes it after the reset, and the answer is ok
  delFail=k=>k.startsWith(`u:${t2.id}:`);
  const d2=await call('account',{method:'DELETE',body:JSON.stringify({confirm:'delete'})},t2.code),d2j=await d2.json();delFail=null;
  const q=queued.find(x=>x.m.wipe===`u:${t2.id}:`);
  ok(d2.status===200&&d2j.ok&&q&&q.o&&q.o.delaySeconds>0&&q.o.delaySeconds<=43200&&(await call('me',{},t2.code)).status===403,
    `a refusal after the code is gone: ok, and the wipe waits in the queue for the reset (${JSON.stringify(q&&q.o)})`);
  await worker.queue({messages:[{body:q.m,ack(){},retry(){}}]},env);
  ok(userKeys()===0,'the queue deletes the rest');

  // ---- W2-14-03: the daily copies carry their item counts
  const L1=await (await call('sync?lite=1')).json();
  await call('sync',{method:'POST',body:JSON.stringify({baseRev:L1.rev,baseSaved:L1.saved,day:'2026-11-15',delta:{items:[{id:'o1',type:'tie',primaryColor:'navy',pattern:'solid',updated:1},{id:'o2',type:'tie',primaryColor:'green',pattern:'solid',updated:1}],days:[],tombstones:{}},photos:{}})});
  const L2=await (await call('sync?lite=1')).json();
  await call('sync',{method:'POST',body:JSON.stringify({baseRev:L2.rev,baseSaved:L2.saved,day:'2026-11-16',delta:{items:[{id:'o3',type:'tie',primaryColor:'red',pattern:'solid',updated:2}],days:[],tombstones:{}},photos:{}})});
  const sn=(await (await call('sync?snaps=1')).json()).snaps,s16=sn.find(s=>s.id==='2026-11-16');
  ok(s16&&s16.n===2,`the copy for Nov 16 says it holds 2 items (${JSON.stringify(sn)})`);
  for(const k of [...store.keys()])if(!k.startsWith('invite'))store.delete(k);

  // ---- the app against that worker
  const browser=await chromium.launch();
  try{
    const route=async(ctx,limit)=>ctx.route(HOST+'**',async r=>{const qq=r.request(),body=['GET','HEAD'].includes(qq.method())?undefined:qq.postData();
      if(qq.method()==='POST'&&/\/sync$/.test(new URL(qq.url()).pathname)){ctx.posts.push(body.length);if(body.length>ctx.limit)return r.fulfill({status:413,headers:{'content-type':'application/json'},body:'{"error":"backup too large (over 48 MB)"}'})}
      const res=await worker.fetch(new Request(qq.url(),{method:qq.method(),headers:qq.headers(),body}),env);
      await r.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const open=async(o={})=>{const ctx=await browser.newContext({timezoneId:'Asia/Kuwait'});ctx.posts=[];ctx.limit=o.limit||1e9;await route(ctx);
      const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
      await p.addInitScript(([h,send,ios,conn])=>{window.SYNC_SEND_TEST=send;if(ios)window.DW_IOS=true;if(conn&&!localStorage.getItem('worker_url')){localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')}},[HOST,o.send||0,!!o.ios,o.conn!==false]);
      await p.goto(url);await p.waitForFunction(()=>window.appReady);p.ctx=ctx;return p};
    // a photo of about 25 KB (over PH_MIN, so sent and kept on its own): distinct text per item
    const addPhotos=(p,n,from=0)=>p.evaluate(async([n,from])=>{for(let k=from;k<from+n;k++){const ph='data:image/jpeg;base64,'+(k.toString(36)+'Q').repeat(25000).slice(0,25000);
      const it={id:'p'+k,type:'tie',primaryColor:'navy',pattern:'solid',photo:ph,added:Date.now()+k,updated:Date.now()+k};await put(it);items.push(it)}},[n,from]);
    const backup=()=>JSON.parse(store.get('wardrobe:v1')||'{"data":{"items":[]}}');

    // W2-18-01: twelve photo items, a 120 KB budget: several POSTs, each under it, all stored
    const A=await open({send:120000});
    await A.evaluate(()=>syncNow());await addPhotos(A,12);A.ctx.posts.length=0;
    const r1=await A.evaluate(async()=>({ok:await syncNow(),st:localStorage.getItem('sync_status'),last:+localStorage.getItem('last_sync')||0}));
    const onServer=(backup().data.items||[]).length,phs=[...store.keys()].filter(k=>k.startsWith('ph:')).length;
    ok(r1.ok&&!r1.st&&r1.last>0&&A.ctx.posts.length>=3&&A.ctx.posts.every(n=>n<150000)&&onServer===12&&phs===12,
      `12 photo items go up in ${A.ctx.posts.length} batches under the budget (${A.ctx.posts.join(', ')} bytes), all 12 kept with their photos`);
    // the status while batches go up
    const prog=await A.evaluate(()=>{localStorage.setItem('sync_status','Backing up: 7 items with photos still to send…');localStorage.setItem('last_sync',Date.now());openSettings('backup');showSyncStatus();
      const r={line:document.querySelector('#sync-status').textContent,sum:backupSummary(localStorage.getItem('worker_url'))};localStorage.removeItem('sync_status');closeSettings();return r});
    ok(/^Backing up: 7 items with photos still to send…/.test(prog.line)&&/^Backing up photos · last saved today$/.test(prog.sum),`plain progress words (“${prog.line}” / “${prog.sum}”)`);
    // a server with a smaller limit: 413 halves the budget, still everything goes up; nothing is resent in one body
    await addPhotos(A,6,12);A.ctx.posts.length=0;A.ctx.limit=60000;
    const r2=await A.evaluate(async()=>({ok:await syncNow(),st:localStorage.getItem('sync_status')}));
    ok(r2.ok&&(backup().data.items||[]).length===18&&A.ctx.posts.filter(n=>n>60000).length<=2,`after a 413 the batches are smaller and all go up (${A.ctx.posts.join(', ')})`);
    // one item larger than the server takes: paused until tomorrow with words, and the next close sends nothing
    A.ctx.limit=10000;await addPhotos(A,1,30);A.ctx.posts.length=0;
    const r3=await A.evaluate(async()=>{const ok1=await syncNow();const st=localStorage.getItem('sync_status');const ok2=await syncNow();return {ok1,ok2,st,pause:+localStorage.getItem('sync_pause')||0}});
    ok(!r3.ok1&&!r3.ok2&&r3.pause>Date.now()&&/too large for the server/.test(r3.st)&&!/HTTP|413/.test(r3.st)&&A.ctx.posts.length===1,`one item too large: paused with plain words, sent once only (${A.ctx.posts.length} POST; “${r3.st}”)`);
    // W1-10-03 / W1-10-04: the pause's end in local time; Connection doesn't say "backed up" while paused
    const pz=await A.evaluate(()=>{const later=new Date();later.setHours(23,0,0,0);const tom=new Date(Date.now()+864e5);tom.setHours(3,0,0,0);
      localStorage.setItem('sync_pause',+later);const a=backupSummary('x');localStorage.setItem('sync_pause',+tom);const b=backupSummary('x');const w=backedUpWords();localStorage.removeItem('sync_pause');return {a,b,w,w2:backedUpWords()}});
    ok(/^Paused until 11:00\s?PM/.test(pz.a)&&/^Paused until tomorrow/.test(pz.b),`"Paused until" says the real time when it is today (“${pz.a}” / “${pz.b}”)`);
    ok(/paused until/.test(pz.w)&&/only on this phone/.test(pz.w)&&pz.w2==='your wardrobe is backed up',`while paused, Connection's words say so (“${pz.w}”)`);
    // W2-14-03: the labels
    const lab=await A.evaluate(()=>({d:snapLabel({id:'2026-11-16',saved:Date.parse('2026-11-15T04:30:00Z'),n:5}),e:snapLabel({id:'2026-11-15',saved:Date.parse('2026-11-15T04:30:00Z'),n:0}),
      m:snapLabel({id:'2026-11',saved:1,n:0}),o:snapLabel({id:'2026-11-14',saved:1})}));
    ok(lab.d==='Mon, Nov 16, start of the day · 5 items'&&lab.e==='Sun, Nov 15, start of the day · empty'&&lab.m==='Start of November 2026 · empty'&&lab.o==='Sat, Nov 14, start of the day',
      `daily backups named by their day, with counts (${JSON.stringify(lab)})`);
    const askQ=await A.evaluate(async()=>{const sel=document.querySelector('#snap-list');sel.innerHTML='<option value="2026-11-15" data-n="0">Sun, Nov 15, start of the day · empty</option>';sel.value='2026-11-15';
      let txt='';const a0=window.askConfirm;window.askConfirm=async t=>{txt=t;return false};await rollBack();window.askConfirm=a0;return txt});
    ok(/no items: rolling back to it empties the wardrobe/.test(askQ),'the roll-back question says an empty copy empties the wardrobe');
    // W1-10-01 in the app: the server's saves used up says nothing was deleted, with the local time
    const del=await A.evaluate(async()=>{const f0=window.fetch;window.fetch=async()=>new Response('{"error":"kv-limit","what":"write","message":"x"}',{status:429});
      const r=await aboutDeleteAccount({w:localStorage.getItem('worker_url'),t:'secret'});window.fetch=f0;return r});
    ok(del.fail&&/can’t delete anything more today, so nothing was deleted\. Try again after \d/.test(del.fail),`Delete everything refused for the day's saves: said in the app's words (“${del.fail}”)`);
    // W1-1-02: the day's remakes
    const rm=await A.evaluate(async()=>{localStorage.removeItem('remake_day');const a=remakeLeft();remakeSpend(10);const b=remakeLeft();
      const m0=window.makeSmall;let made=0;window.makeSmall=async it=>{made++;it.photoSm='data:image/jpeg;base64,AA';it.phSig=phSigOf(it.photo);return true};
      for(const it of items)delete it.photoSm;const n0=await smallPhotos();localStorage.removeItem('remake_day');remakeSpend(7);const n1=await smallPhotos();window.makeSmall=m0;return {a,b,n0,n1,made}});
    ok(rm.a===10&&rm.b===0&&rm.n0===0&&rm.n1===3,`a connected phone remakes at most 10 pictures a day, the rest on the next days (${JSON.stringify(rm)})`);
    ok(!A.errs.length,'no page errors: '+A.errs.join('; '));
    await A.ctx.close();

    // W1-11-05: storage full while a sync brings the wardrobe: the plain sentence in a toast and the status
    const B=await open({});
    const fullR=await B.evaluate(async()=>{const P=IDBObjectStore.prototype,o=P.put;P.put=function(){throw new DOMException('The quota has been exceeded.','QuotaExceededError')};
      let e1=null;try{await addTombstones({zz:1})}catch(e){e1=e}const ok=await syncNow();P.put=o;
      return {name:e1&&e1.name,store:!!(e1&&e1.dwStore),ok,st:localStorage.getItem('sync_status'),toast:document.querySelector('#toast').textContent}});
    ok(fullR.name==='QuotaExceededError'&&fullR.store,`a put that throws aborts with its own error (${fullR.name})`);
    ok(!fullR.ok&&/storage is full/.test(fullR.st)&&/^Backup failed/.test(fullR.st)&&/storage is full/.test(fullR.toast),`the sync says the phone's storage is full, in a toast too (“${fullR.st}”)`);
    await B.ctx.close();

    // Decision 2: Safari only, not connected
    const S=await open({ios:true,conn:false});
    const saf=await S.evaluate(()=>{openSettings('backup');showSyncStatus();const line=document.querySelector('#sync-status').textContent;closeSettings();return {line,home:homeSteps(true)}});
    ok(/Safari can clear a website’s data/.test(saf.line)&&/Download backup/.test(saf.line),`Backup & sync, not connected in Safari, says why the file matters (“${saf.line}”)`);
    ok(/home-risk/.test(saf.home)&&/can clear the app’s data/.test(saf.home),'the setup\'s Home Screen step says it once');
    const rem=await S.evaluate(async()=>{for(let k=0;k<11;k++){const it={id:'s'+k,type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now()};items.push(it)}
      localStorage.removeItem('safari_remind');localStorage.removeItem('backup_file_at');document.querySelector('#toast').classList.remove('on');
      const a=safariRemind(),t=document.querySelector('#toast').textContent,again=safariRemind();
      localStorage.removeItem('safari_remind');localStorage.setItem('backup_file_at',Date.now());const after=safariRemind();
      localStorage.removeItem('backup_file_at');items.splice(-5);localStorage.removeItem('safari_remind');const few=safariRemind();return {a,t,again,after,few}});
    ok(rem.a&&/only in Safari/.test(rem.t)&&/Download backup/.test(rem.t)&&!rem.again&&!rem.after&&!rem.few,
      `at 10+ items never backed up, a reminder with Download backup; not again within a month, not after a backup file, not under 10 (${JSON.stringify(rem)})`);
    ok(!S.errs.length,'no page errors: '+S.errs.join('; '));
    await S.ctx.close();
  }finally{await browser.close()}
};
