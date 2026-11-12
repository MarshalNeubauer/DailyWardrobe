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

  // worker
  await put(st(1),'2026-11-10');
  ok(![...store.keys()].some(k=>k.startsWith('snap:')),'the very first backup has nothing older to keep');
  const v1=store.get('wardrobe:v1');
  await put(st(2),'2026-11-10');
  ok(store.get('snap:2026-11-10')===v1&&store.get('snap:2026-11')===v1,'the first change of a day keeps the backup as it was, as that day and as that month');
  ok(ttl.get('snap:2026-11-10')===30*86400&&ttl.get('snap:2026-11')===400*86400,'daily copies last 30 days, monthly ones about a year');
  const v2=store.get('wardrobe:v1');await put(st(3),'2026-11-10');
  ok(store.get('snap:2026-11-10')===v1,'later changes the same day leave that day\'s copy alone');
  await put(st(4),'2026-11-11');
  ok(store.get('snap:2026-11-11')!==v1&&JSON.parse(store.get('snap:2026-11-11')).data.items[0].id==='i3'&&store.get('snap:2026-11')===v1,'the next day keeps the state it started with; the month keeps its first');
  for(const k of ['snap:2026-11-10','snap:2026-11','snap:2026-11-11'])meta.set(k,{...meta.get(k),saved:1700000000000});   // all the same moment: the later date still comes first
  const L=await (await call('GET','?snaps=1')).json();
  ok(L.snaps.length===3&&L.snaps.every(s=>s.saved&&s.rev)&&L.snaps[0].id==='2026-11-11','GET ?snaps=1 lists the copies, newest first');
  const g=await (await call('GET','?snap=2026-11-10')).json();
  ok(g.data.items[0].id==='i1','GET ?snap=<day> returns that copy');
  ok((await call('GET','?snap=../wardrobe')).status===400&&(await call('GET','?snap=2025-01-01')).status===404&&(await call('GET','?snaps=1',undefined,'nope')).status===403,'bad ids, missing copies and a wrong token are refused');
  const before=store.get('wardrobe:v1');await put(st(5),'2026-11-11',{reason:'restore'});
  ok(store.get('snap:before-restore')===before,'a roll-back first keeps the backup it replaces');
  await put(st(6),'not-a-date');
  ok([...store.keys()].some(k=>/^snap:\d{4}-\d{2}-\d{2}$/.test(k)),'a missing or bad day falls back to the worker\'s own date');

  // large backups: over 20 MB the worker keeps parts (a KV value holds 25 MiB at most) and streams them back; over 48 MB it refuses
  store.clear();meta.clear();ttl.clear();
  {const big=n=>({items:[{id:'big',type:'suit',primaryColor:'navy',added:1,photo:'data:image/jpeg;base64,'+'A'.repeat(n)}],days:[],tombstones:{},settings:null});
    const raw=o=>worker.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:typeof o==='string'?o:JSON.stringify(o)}),env);
    const r1=await raw({baseRev:0,day:'2026-11-10',data:big(30e6)});
    ok(r1.status===200&&meta.get('wardrobe:v1').parts===2&&store.has('wardrobe:v1~1~1'),`a 30 MB backup is stored in two parts (${r1.status})`);
    let back=await (await call('GET')).json();
    ok(back.rev===1&&back.saved===meta.get('wardrobe:v1').saved&&back.data.items[0].photo.length===30e6+23,'and comes back whole');
    const r2=await raw({baseRev:1,day:'2026-11-11',data:big(46e6)});
    ok(r2.status===200&&meta.get('wardrobe:v1').parts===3&&store.has('wardrobe:v1~2~2')&&!store.has('wardrobe:v1~1~1'),`a 46 MB backup takes three parts; the version before's parts are gone (${r2.status})`);
    ok(meta.get('snap:2026-11-11').parts===2&&store.has('snap:2026-11-11~1~1')&&ttl.get('snap:2026-11-11~1~1')===30*86400,'the daily copy of a parted backup keeps its parts, for 30 days');
    const s=await (await call('GET','?snap=2026-11-11')).json();
    ok(s.rev===1&&s.data.items[0].photo.length===30e6+23,'and the copy comes back whole');
    const L=await (await call('GET','?snaps=1')).json();
    ok(L.snaps.every(x=>!x.id.includes('~')),'parts are not listed as backups');
    const c=await raw({baseRev:0,day:'2026-11-11',data:big(25e6)});const cj=await c.json();
    ok(c.status===409&&cj.error==='conflict'&&cj.rev===2&&cj.data.items[0].photo.length===46e6+23,'a conflict hands back the stored parted backup to merge with');
    back=await (await call('GET','?v=2:'+meta.get('wardrobe:v1').saved)).json();
    ok(back.same===true,'an unchanged parted backup costs one tiny request');
    ok((await raw({baseRev:2,day:'2026-11-11',data:big(51e6)})).status===413,'over 48 MB is refused');
    const old=await raw(JSON.stringify({baseRev:2,data:big(25e6),day:'2026-11-11'}));
    ok(old.status===413&&/update the app/.test((await old.json()).error),'a large backup from an app that sends its data first is asked to update');
    const r3=await call('PUT','',{baseRev:2,data:st(9),day:'2026-11-11'});
    ok(r3.status===200&&typeof store.get('wardrobe:v1')==='string'&&!meta.get('wardrobe:v1').parts&&![...store.keys()].some(k=>k.startsWith('wardrobe:v1~')),'a small backup after a large one is one value again, and the parts are gone');
    ok((await (await call('GET')).json()).data.items[0].id==='i9','and reads back');}

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
  await A.p.evaluate(async()=>{$('#snap-list').value='2026-11-09';const r=rollBack();$('#ask-ok').click();await r});   // the app's own question: answered yes
  const a=await A.p.evaluate(()=>({st:$('#snap-status').textContent,wd:settings.workdays.length}));
  ok(await sig(A.p)===good&&a.wd===5,`roll back restores the deleted tie, the old colour, drops the junk and the settings (${a.st})`);
  await B.p.evaluate(()=>syncNow());
  ok(await sig(B.p)===good&&await B.p.evaluate(()=>settings.workdays.length===5),'the other device follows the roll-back on its next sync');
  ok(store.has('snap:before-restore')&&JSON.parse(store.get('snap:before-restore')).data.items.some(i=>i.id==='junk'),'the damaged state is kept as "before the last roll-back", so the roll-back can be undone');
  // and undo it
  await A.p.evaluate(async()=>{delete $('#snap-list').dataset.loaded;await loadSnapshots();$('#snap-list').value='before-restore';const r=rollBack();$('#ask-ok').click();await r});
  ok((await sig(A.p)).includes('junk'),'rolling back to "before the last roll-back" undoes it');
  ok(A.errs.length===0&&B.errs.length===0,'no page errors ('+[...A.errs,...B.errs].join('; ')+')');
  await browser.close();
};
