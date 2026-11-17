// Daily backups: before the first overwrite of each calendar day the worker keeps the backup as it was (snap:<day>, 30 days;
// snap:<month>, a year), and the app can roll every device back to one of them, a roll-back that itself can be undone.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map(),ttl=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,
    put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata);ttl.set(k,o&&o.expirationTtl)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const call=(method,q='',body,tok='secret')=>worker.fetch(new Request(HOST+'sync'+q,{method,headers:{'x-app-token':tok,'content-type':'application/json'},body:body&&JSON.stringify(body)}),env);
  const rev=()=>JSON.parse(store.get('wardrobe:v1')||'{"rev":0}').rev;
  const put=(data,day,x={})=>call('PUT','',{baseRev:rev(),data,day,...x});
  const st=n=>({items:[{id:'i'+n,type:'tie',primaryColor:'navy',added:n}],days:[],tombstones:{},settings:null});

  // worker. A save's day is the app's when it is within a day of the server's (CR-6-08), so the two days here are the day before and
  // today (today and tomorrow on the 1st: one month)
  const iso=t=>new Date(t).toISOString().slice(0,10),T=iso(Date.now()),[D0,D1]=T.endsWith('-01')?[T,iso(Date.now()+864e5)]:[iso(Date.now()-864e5),T],M=D0.slice(0,7);
  await put(st(1),D0);
  ok(![...store.keys()].some(k=>k.startsWith('snap:')),'the very first backup has nothing older to keep');
  const v1=store.get('wardrobe:v1');
  await put(st(2),D0);
  ok(store.get('snap:'+D0)===v1&&store.get('snap:'+M)===v1,'the first change of a day keeps the backup as it was, as that day and as that month');
  ok(ttl.get('snap:'+D0)===30*86400&&ttl.get('snap:'+M)===400*86400,'daily copies last 30 days, monthly ones about a year');
  await put(st(3),D0);
  ok(store.get('snap:'+D0)===v1,'later changes the same day leave that day\'s copy alone');
  await put(st(4),D1);
  ok(store.get('snap:'+D1)!==v1&&JSON.parse(store.get('snap:'+D1)).data.items[0].id==='i3'&&store.get('snap:'+M)===v1,'the next day keeps the state it started with; the month keeps its first');
  for(const k of ['snap:'+D0,'snap:'+M,'snap:'+D1])meta.set(k,{...meta.get(k),saved:1700000000000});   // all the same moment: the later date still comes first
  const L=await (await call('GET','?snaps=1')).json();
  ok(L.snaps.length===3&&L.snaps.every(s=>s.saved&&s.rev)&&L.snaps[0].id===D1,'GET ?snaps=1 lists the copies, newest first');
  const g=await (await call('GET','?snap='+D0)).json();
  ok(g.data.items[0].id==='i1','GET ?snap=<day> returns that copy');
  ok((await call('GET','?snap=../wardrobe')).status===400&&(await call('GET','?snap=2025-01-01')).status===404&&(await call('GET','?snaps=1',undefined,'nope')).status===403,'bad ids, missing copies and a wrong token are refused');
  const before=store.get('wardrobe:v1');await put(st(5),D1,{reason:'restore'});
  ok(store.get('snap:before-restore')===before,'a roll-back first keeps the backup it replaces');
  await put(st(6),'not-a-date');
  ok([...store.keys()].some(k=>/^snap:\d{4}-\d{2}-\d{2}$/.test(k)),'a missing or bad day falls back to the worker\'s own date');
  // a phone whose clock is days behind (or ahead): its copies go under the server's date, not a day of its own (CR-6-08: one behind kept
  // snap:2020-01-01 and snap:2020-01, two writes for every date it sent)
  {store.clear();meta.clear();ttl.clear();const far=iso(Date.now()-40*864e5);
    await put(st(1),far);await put(st(2),far);await put(st(3),'2020-01-01');
    const ids=[...store.keys()].filter(k=>k.startsWith('snap:')).sort();
    ok(ids.join()===['snap:'+T.slice(0,7),'snap:'+T].join(),`a day more than one away from the server's is taken as the server's (${ids.join(', ')})`);}

  // large backups: over 20 MB the photos are cut out unparsed and the rest is saved like any other (photostore.test.js); one whose
  // photos can't be cut out is refused (CR-6-02: it was kept in parts as it came, past the record check and the write cap); a backup
  // kept in parts before (KV holds 25 MiB a value) is still read, copied and replaced; over 48 MB is refused
  store.clear();meta.clear();ttl.clear();
  {const big=n=>({items:[{id:'big',type:'suit',primaryColor:'navy',added:1,photo:'data:image/jpeg;base64,'+'A'.repeat(n)}],days:[],tombstones:{},settings:null});
    const raw=o=>worker.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:typeof o==='string'?o:JSON.stringify(o)}),env);
    const r1=await raw({baseRev:0,day:D0,data:big(30e6)});
    ok(r1.status===413&&!store.size,`a 30 MB backup whose one photo is too large to cut out is refused, nothing stored (${r1.status})`);
    const pad=raw({baseRev:0,day:D0,data:{items:[{id:'pad',type:'tie',notes:'x'.repeat(21*1024*1024),added:1}],days:[],tombstones:{}}});
    ok((await pad).status===413&&!store.size,'so is one with no photos to cut out');
    // a backup the worker kept in parts before 2026-11-17: the first part under the key, the rest under <key>~<rev>~<i>
    const PM=20*1024*1024,keepParted=(rev,n)=>{const t=Buffer.from(JSON.stringify({rev,saved:1000+rev,data:big(n)}));const parts=Math.ceil(t.length/PM);
      for(let i=1;i<parts;i++)store.set(`wardrobe:v1~${rev}~${i}`,new Uint8Array(t.subarray(i*PM,(i+1)*PM)).buffer);store.set('wardrobe:v1',new Uint8Array(t.subarray(0,PM)).buffer);meta.set('wardrobe:v1',{rev,saved:1000+rev,parts});return parts};
    ok(keepParted(2,46e6)===3,'(a 46 MB backup kept in three parts)');
    const KVp={...KV,get:async(k,t)=>{const v=store.get(k);if(v instanceof ArrayBuffer&&t!=='arrayBuffer'){const s=Buffer.from(v).toString();return t==='json'?JSON.parse(s):s}return KV.get(k,t)}};env.WARDROBE=KVp;
    let back=await (await call('GET')).json();
    ok(back.rev===2&&back.saved===1002&&back.data.items[0].photo.length===46e6+23,'it comes back whole');
    const c=await raw({baseRev:0,day:D1,data:st(8)});const cj=await c.json();
    ok(c.status===409&&cj.error==='conflict'&&cj.rev===2&&cj.data.items[0].photo.length===46e6+23,'a conflict hands back the stored parted backup to merge with');
    back=await (await call('GET','?v=2:1002')).json();
    ok(back.same===true,'an unchanged parted backup costs one tiny request');
    ok((await raw({baseRev:2,day:D1,data:big(51e6)})).status===413,'over 48 MB is refused');
    const old=await raw(JSON.stringify({baseRev:2,data:big(25e6),day:D1}));
    ok(old.status===413&&/update the app/.test((await old.json()).error),'a large backup from an app that sends its data first is asked to update');
    const r3=await call('PUT','',{baseRev:2,data:st(9),day:D1});
    ok(r3.status===200&&typeof store.get('wardrobe:v1')==='string'&&!meta.get('wardrobe:v1').parts&&![...store.keys()].some(k=>k.startsWith('wardrobe:v1~')),'a small backup after a parted one is one value again, and the parts are gone');
    ok(meta.get('snap:'+D1).parts===3&&store.has(`snap:${D1}~2~2`)&&ttl.get(`snap:${D1}~2~1`)===30*86400,'the daily copy of the parted backup keeps its parts, for 30 days');
    const s=await (await call('GET','?snap='+D1)).json();
    ok(s.rev===2&&s.data.items[0].photo.length===46e6+23,'and the copy comes back whole');
    const L2=await (await call('GET','?snaps=1')).json();
    ok(L2.snaps.length&&L2.snaps.every(x=>!x.id.includes('~')),'parts are not listed as backups');
    ok((await (await call('GET')).json()).data.items[0].id==='i9','and the new backup reads back');
    env.WARDROBE=KV;}

  // app: two devices; device A gets damaged, rolls back; device B follows
  store.clear();meta.clear();ttl.clear();
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext();
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {p,errs}};
  const A=await device(),B=await device();
  const sig=p=>p.evaluate(()=>items.map(i=>i.id+':'+i.primaryColor).sort().join(','));
  // a device's background syncs finished first (tests/sync.test.js's quiet/hush): a sync that brought changes redraws Today, which
  // records the day and locks the week and schedules another backup; one landing after the roll-back sent the damaged copy's settings
  // up again (the flaky "roll back restores …" and "the other device follows …")
  const quiet=p=>p.evaluate(async()=>{let last='',same=0;const end=Date.now()+6000;
    while(Date.now()<end){await recordRun;const s=stateSig(await localState());same=!syncing&&s===last?same+1:0;last=s;if(same>=3)return true;await new Promise(r=>setTimeout(r,120))}return false});
  const hush=async(...ps)=>{for(const p of ps){await quiet(p);await p.evaluate(()=>clearTimeout(syncTimer))}};
  const why=async()=>` [A ${await sig(A.p)}; good ${good}; A's workdays ${JSON.stringify(await A.p.evaluate(()=>settings.workdays))}; B ${await sig(B.p)}]`;
  await A.p.evaluate(async()=>{for(const [id,c] of [['t1','navy'],['t2','burgundy'],['t3','green']]){const it={id,type:'tie',primaryColor:c,pattern:'solid',added:Date.now()};await put(it);items.push(it)}
    const s={...settings,workdays:[1,2,3,4,5],updated:Date.now()};settings=s;await metaPut('settings',s);await syncNow()});
  await B.p.evaluate(()=>syncNow());
  const good=await sig(A.p);
  // pretend yesterday's copy was this good state, then a bad change: one tie deleted, one recoloured, junk added, settings broken
  store.set('snap:2026-11-09',store.get('wardrobe:v1'));meta.set('snap:2026-11-09',meta.get('wardrobe:v1'));
  await A.p.evaluate(async()=>{const t=Date.now()+5;await del('t1');const tomb={...(await metaGet('tombstones')||{}),t1:t};await metaPut('tombstones',tomb);
    const b={...items.find(i=>i.id==='t2'),primaryColor:'pink',updated:t};await put(b);const j={id:'junk',type:'tie',primaryColor:'red',pattern:'solid',added:t};await put(j);
    items=await tx('readonly',s=>s.getAll());const s={...settings,workdays:[],updated:t};settings=s;await metaPut('settings',s);await syncNow()});
  await B.p.evaluate(()=>syncNow());
  ok(await sig(B.p)!==good&&(await sig(B.p)).includes('junk'),'(the damage reached the backup and the other device)');
  // roll back from Settings
  await A.p.evaluate(()=>openSettings&&openSettings());
  await A.p.evaluate(()=>loadSnapshots());
  const opts=await A.p.evaluate(()=>[...document.querySelectorAll('#snap-list option')].map(o=>o.value).filter(Boolean));
  ok(opts.includes('2026-11-09'),`Settings lists the daily backups (${opts.join(', ')})`);
  await hush(A.p,B.p);
  await A.p.evaluate(async()=>{$('#snap-list').value='2026-11-09';const r=rollBack();$('#ask-ok').click();await r});   // the app's own question: answered yes
  const a=await A.p.evaluate(()=>({st:$('#snap-status').textContent,wd:settings.workdays.length}));
  const back=await sig(A.p)===good&&a.wd===5;
  ok(back,`roll back restores the deleted tie, the old colour, drops the junk and the settings (${a.st})`+(back?'':await why()));
  await hush(A.p,B.p);
  await B.p.evaluate(()=>syncNow());
  const follows=await sig(B.p)===good&&await B.p.evaluate(()=>settings.workdays.length===5);
  ok(follows,'the other device follows the roll-back on its next sync'+(follows?'':await why()));
  ok(store.has('snap:before-restore')&&JSON.parse(store.get('snap:before-restore')).data.items.some(i=>i.id==='junk'),'the damaged state is kept as "before the last roll-back", so the roll-back can be undone');
  // and undo it
  await A.p.evaluate(async()=>{delete $('#snap-list').dataset.loaded;await loadSnapshots();$('#snap-list').value='before-restore';const r=rollBack();$('#ask-ok').click();await r});
  ok((await sig(A.p)).includes('junk'),'rolling back to "before the last roll-back" undoes it');
  ok(A.errs.length===0&&B.errs.length===0,'no page errors ('+[...A.errs,...B.errs].join('; ')+')');
  await browser.close();
};
