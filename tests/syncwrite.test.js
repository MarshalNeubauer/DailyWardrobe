// What a sync writes on the phone (code review 2026-11-16, fix round A): the merge's winner is written even when it is the older copy
// (CR-5-01: a formal day set on one phone lost on the other, whose own week lock it beat); an edit made while a sync runs is merged field
// by field, not skipped; one sync at a time (CR-5-04); last_sync by the corrected clock (CR-5-06); Restore file names the pieces that
// stayed deleted (CR-5-03). The real worker.js runs in Node with an in-memory KV; browser contexts are the phones.
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    delete:async k=>{store.delete(k);meta.delete(k)},list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  // o.hold: while o.hold.p is set, this phone's GET /sync waits for it; o.ahead: the server's clock this far ahead of the phone's;
  // o.slow: each GET /sync answered this much later; o.seen: GETs in flight now and at most
  const device=async(o={})=>{const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});o.flight=0;o.most=0;
    await ctx.route(HOST+'**',async route=>{const r=route.request(),get=r.method()==='GET'&&new URL(r.url()).pathname==='/sync';
      if(get){o.flight++;o.most=Math.max(o.most,o.flight)}
      try{if(get&&o.hold&&o.hold.p){o.hold.waiting=true;await o.hold.p}
        if(get&&o.slow)await new Promise(ok=>setTimeout(ok,o.slow));
        const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
        const h=Object.fromEntries(res.headers);if(o.ahead&&h['x-now'])h['x-now']=String(+h['x-now']+o.ahead);
        await route.fulfill({status:res.status,headers:h,body:await res.text()})}finally{if(get)o.flight--}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));   // (WebKit's cut-off version check of sw.js is left out by tests/webkit.js)
    await p.goto(url);if(o.connect!==false)await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);o.p=p;o.errs=errs;return o};
  const sync=d=>d.p.evaluate(()=>{clearTimeout(syncTimer);return syncNow()});
  const stored=(d,store,k)=>d.p.evaluate(([s,k])=>txs(s,'readonly',x=>x.get(k)),[store,k]);
  try{
    const A=await device(),B=await device();
    await sync(A);await sync(B);
    // ---- CR-5-01: B marks a coming day formal (no record of it before: no field stamps); A, not having heard of it, locks that day (the
    // week's lock on a day with no record: lockOnly, base 0, no field stamps, a newer stamp). The merge keeps B's change, the older copy
    const D=await A.p.evaluate(()=>{const T=todayDate();return isoKey(new Date(T.getFullYear(),T.getMonth(),T.getDate()+30))});
    await B.p.evaluate(async d=>{await saveDay({date:d,formal:true},true)},D);
    await new Promise(r=>setTimeout(r,20));
    await A.p.evaluate(async d=>{await saveDay({date:d,lock:{top:'s1',bot:'s1'},lockOnly:1,base:0},true,true)},D);
    const a0=await A.p.evaluate(d=>({lockOnly:dayRecs[d].lockOnly,fs:!!dayRecs[d].fs,formal:!!dayRecs[d].formal}),D),b0=await B.p.evaluate(d=>({fs:!!dayRecs[d].fs,formal:!!dayRecs[d].formal}),D);
    ok(a0.lockOnly===1&&!a0.fs&&!a0.formal&&b0.formal&&!b0.fs,`the case: B's formal day and A's newer lock of it, neither with field stamps (${JSON.stringify({a0,b0})})`);
    await sync(B);await sync(A);
    const a1=await A.p.evaluate(d=>({formal:!!(dayRecs[d]&&dayRecs[d].formal),lockOnly:!!(dayRecs[d]&&dayRecs[d].lockOnly)}),D),a1s=await stored(A,'days',D);
    ok(a1.formal&&!a1.lockOnly&&a1s&&a1s.formal&&!a1s.lockOnly,`CR-5-01: the phone that locked the day takes the other phone's formal day, on screen and in storage (${JSON.stringify({mem:a1,stored:a1s&&{formal:!!a1s.formal,lockOnly:!!a1s.lockOnly}})})`);
    await sync(A);await sync(B);
    const srv=(await (await worker.fetch(new Request(HOST+'sync?lite=1',{headers:{'x-app-token':'secret'}}),env)).json()).days.find(d=>d.date===D);
    const b1=await B.p.evaluate(d=>!!(dayRecs[d]&&dayRecs[d].formal),D);
    ok(srv&&srv.formal&&b1&&(await A.p.evaluate(d=>!!dayRecs[d].formal,D)),'and the two phones and the backup agree on it afterwards');
    // ---- an edit made while a sync is under way: B renames a piece; A takes it out of rotation after its sync has read its own copy and
    // while it waits for the backup. Both changes stay, on A at once and on B after the next syncs
    const id=await A.p.evaluate(async()=>{const it={id:'jkt-1',type:'suit',primaryColor:'navy',pattern:'solid',added:nowMs()};await put(it);items.push(it);return it.id});
    await sync(A);await sync(B);
    await B.p.evaluate(async id=>{const it=items.find(i=>i.id===id);it.name='Navy one';await put(it)},id);await sync(B);
    A.hold={};A.hold.p=new Promise(r=>A.hold.go=r);
    const run=A.p.evaluate(()=>{clearTimeout(syncTimer);return syncNow()});
    for(let k=0;k<100&&!A.hold.waiting;k++)await new Promise(r=>setTimeout(r,50));
    await A.p.evaluate(async id=>{const it=items.find(i=>i.id===id);it.paused=true;await put(it);clearTimeout(syncTimer)},id);
    A.hold.go();A.hold=null;await run;
    const e1=await stored(A,'items',id);
    ok(!!A.hold===false&&e1&&e1.name==='Navy one'&&e1.paused===true,`an edit made during a sync is merged with what the sync brought, field by field: both the other phone's rename and this one's change stay (${JSON.stringify(e1&&{name:e1.name,paused:e1.paused})})`);
    await sync(A);await sync(B);
    const e2=await B.p.evaluate(id=>{const i=items.find(x=>x.id===id);return i&&{name:i.name,paused:i.paused}},id);
    ok(e2&&e2.name==='Navy one'&&e2.paused===true,`and the other phone gets both after the next syncs (${JSON.stringify(e2)})`);
    // ---- CR-5-04: many callers at once (the timer, going to the background, online, Sync now, a roll-back): one sync at a time, and the
    // ones that came while it ran share one more run after it
    A.slow=150;A.most=0;
    const ov=await A.p.evaluate(async()=>{const o=syncOnce;let n=0,most=0,runs=0;syncOnce=async()=>{n++;runs++;most=Math.max(most,n);try{return await o()}finally{n--}};
      try{const r=await Promise.all([1,2,3,4,5].map(()=>syncNow()));return {r,most,runs,syncing}}finally{syncOnce=o}});
    A.slow=0;
    ok(ov.most===1&&ov.runs===2&&A.most===1&&ov.r.every(x=>x===true)&&!ov.syncing,`CR-5-04: five syncs asked for at once run one at a time, two runs in all, every caller told it went through (${JSON.stringify({...ov,getsAtOnce:A.most})})`);
    // ---- CR-5-06: a phone whose clock is an hour behind the server's: its last backup's time is the corrected one, as the server's times
    // it is compared with (syncWiped held its backups after a wipe)
    const C=await device({ahead:3600e3});await sync(C);
    const c=await C.p.evaluate(()=>({last:+localStorage.getItem('last_sync')||0,now:Date.now(),skew:clockSkew}));
    ok(Math.abs(c.skew-3600e3)<60000&&Math.abs(c.last-(c.now+3600e3))<60000,`CR-5-06: last_sync is stamped by the corrected clock (${Math.round((c.last-c.now)/6e4)} min from the phone's own, the gap ${Math.round(c.skew/6e4)} min)`);
    // ---- CR-5-03: Restore file, on a phone without a connection: a piece deleted after the file was saved stays deleted (a restore
    // merges), and the message names it
    const E=await device({connect:false});
    await E.p.evaluate(async()=>{for(const [id,type,c,name] of [['r1','tie','burgundy','Burgundy tie'],['r2','tie','navy','Navy tie'],['r3','shirt','white','White shirt']]){const it={id,type,primaryColor:c,pattern:'solid',name,added:nowMs()};await put(it);items.push(it)}});
    await E.p.evaluate(()=>openSettings('backup'));
    const [dl]=await Promise.all([E.p.waitForEvent('download'),E.p.click('#sp-backup button[onclick="downloadBackup()"]')]);
    const file=path.join(require('os').tmpdir(),'dw-syncwrite-'+process.pid+'.json');await dl.saveAs(file);
    await E.p.evaluate(async()=>{closeSettings();await del('r1');items=items.filter(i=>i.id!=='r1')});
    await E.p.evaluate(()=>openSettings('backup'));
    await E.p.setInputFiles('#sp-backup input[type=file]',file);
    await E.p.waitForFunction(()=>/Restored/.test(document.querySelector('#toast').textContent),null,{timeout:8000}).catch(()=>{});
    const t=await E.p.evaluate(()=>({toast:document.querySelector('#toast').textContent,n:items.length}));try{fs.unlinkSync(file)}catch{}
    ok(t.n===2&&/Restored\. Your wardrobe now has 2 items\./.test(t.toast)&&/1 piece in the file stayed deleted/.test(t.toast)&&/“Burgundy tie”/.test(t.toast),`CR-5-03: Restore file says which piece in the file stayed deleted (${t.toast})`);
    ok([A,B,C,E].every(d=>!d.errs.length),'no page errors ('+[A,B,C,E].flatMap(d=>d.errs).join('; ')+')');
  }finally{await browser.close()}
};
