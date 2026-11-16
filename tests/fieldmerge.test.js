// Sync merges field by field (fix round 3, 2026-11-16, the audit's W1-5-01 … W1-11-03): an item's fields, a day's slots, and the
// entries of own colors, Care, workdays … each by their own stamp; a deletion against an edit made on a copy from before it; the owner's
// "Delete everything" held on his other phones; Restore file's settings winning. core.js (itemFields/mergeItem, dayFields/mergeDay,
// SET_SPLIT) and the worker's port (worker/backup.js mergeLite): the rules in Node, then two browser devices through the real worker.
const path=require('path'),fs=require('fs'),vm=require('vm'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const ctx={console,localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return null}}};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'core.js'),'utf8')+';this.K={itemFields,mergeItem,mergeState,dayFields,mergeDay,keySettings,stampSettings,mergeSettings,stateSig}',ctx);
  const K=ctx.K,J=o=>JSON.parse(JSON.stringify(o));
  const {mergeLite}=await import(pathToFileURL(path.join(ROOT,'worker','backup.js')).href);
  const both=(a,b,f)=>{const x=f(K.mergeState(a,b)),y=f(K.mergeState(b,a)),w=f(mergeLite(J(a),J(b))),v=f(mergeLite(J(b),J(a)));return [x,y,w,v]};
  const same=l=>l.every(x=>JSON.stringify(x)===JSON.stringify(l[0]));

  /* ---- items ---- */
  const base={id:'p1',type:'shirt',primaryColor:'pink',pattern:'solid',name:'Pink shirt',added:1000,updated:2000};
  const edit=(o,t)=>{const cur=J(base),i={...J(base),...o,updated:t};for(const k of Object.keys(o))if(o[k]===undefined)delete i[k];return K.itemFields(i,cur)};
  const a=edit({name:'Pink oxford'},5000),b=edit({paused:true},6000);
  ok(a.fs&&a.fs.u===5000&&a.fs.b===2000&&a.fs.s.name===5000&&!('paused' in a.fs.s),'an edit stamps only the field it changed (fs)');
  const r=both({items:[a]},{items:[b]},m=>{const i=m.items[0];return [i.name,!!i.paused,i.updated]});
  ok(same(r)&&r[0][0]==='Pink oxford'&&r[0][1]&&r[0][2]===6001,'two phones changing different fields of one piece: both changes kept, either way round, app and worker '+JSON.stringify(r));
  const m1=K.mergeState({items:[a]},{items:[b]}).items[0],m2=K.mergeItem(m1,b);
  ok(m2===m1,'merging the result again changes nothing (no endless uploads)');
  const c=K.itemFields({...J(b),name:'Pink poplin',updated:7000},J(b));
  ok(K.mergeState({items:[a]},{items:[c]}).items[0].name==='Pink poplin','the same field on both: the later change wins');
  const la={...J(base),name:'A',updated:5000},lb={...J(base),paused:true,updated:6000};
  ok(same(both({items:[la]},{items:[lb]},m=>m.items[0]))&&K.mergeState({items:[la]},{items:[lb]}).items[0].name==='Pink shirt','two copies without field stamps: the newer whole, as before');
  const old={...J(base),primaryColor:'white',updated:4000};   // an older app's edit (no fs), between the keyed copy's base and its edit
  const mo=K.mergeState({items:[a]},{items:[old]}).items[0];
  ok(mo.name==='Pink oxford'&&mo.primaryColor==='white','a copy without field stamps counts its stamp for every field: its newer color and the other\'s rename both stay');
  ok(K.mergeState({items:[a]},{items:[{...J(base),primaryColor:'red',updated:9000}]}).items[0].primaryColor==='red'&&K.mergeState({items:[a]},{items:[{...J(base),updated:9000}]}).items[0].name==='Pink shirt','a newer whole copy from an older app still wins whole');
  // deletions (W1-6-06, W1-5-05)
  const tomb={tombstones:{p1:5500}};
  ok(same(both({items:[a],tombstones:{}},{items:[],...tomb},m=>m.items.length))&&K.mergeState({items:[a]},tomb).items.length===0,'an edit made before the deletion: deleted');
  const late=edit({name:'Edited offline'},8000);
  const dl=both({items:[late]},tomb,m=>m.items.length);ok(same(dl)&&dl[0]===0,'an edit made after the deletion on a copy from before it: still deleted, app and worker '+JSON.stringify(dl));
  const undo={...J(base),updated:8000};
  ok(same(both({items:[undo]},tomb,m=>m.items.length))&&K.mergeState({items:[undo]},tomb).items.length===1,'Undo of a delete (restamped whole after it) brings it back');
  ok(!K.itemFields({...J(base),updated:3000},undefined).fs,'a new item gets no field stamps');
  const slow=K.itemFields({...J(base),name:'slow',updated:1500},J(base));ok(slow.updated===2001,'an edit stamped behind the copy it was made on is stamped one above it');

  /* ---- settings entry by entry (W1-5-06, W1-5-03) ---- */
  const sbase={workdays:[0,1,2,3,4],blazerDays:[4],care:{suit:6,shirt:2},custom:{colors:[{key:'ownclaret',name:'Smoky claret',hex:'#6b2d3a',base:'burgundy',types:['tie']}],patterns:[]},units:'C',updated:1000};
  const load=()=>K.keySettings(J(sbase)),chg=(f,t)=>{const s=load();f(s);return K.stampSettings(s,t)};
  const add=(s,key,name)=>{s.custom={...s.custom,colors:[...s.custom.colors,{key,name,hex:'#0f3d2a',base:'green',types:['tie']}]}};
  const sa=chg(s=>{add(s,'owndustyteal','Dusty teal');s.care={...s.care,tie:5};s.workdays=[0,1,2,3,4,5];s.units='F'},5000);
  const sb=chg(s=>{add(s,'ownmossyfern','Mossy fern');s.care={...s.care,blazer:8};s.workdays=[0,1,2,3,4,6];s.blazerDays=[0,4]},6000);
  const view=m=>{const s=m.settings;return [s.custom.colors.map(c=>c.name).sort().join(','),JSON.stringify(s.care,Object.keys(s.care).sort()),s.workdays.join(''),s.blazerDays.join(''),s.units]};
  const sr=both({settings:sa},{settings:sb},view);
  ok(same(sr)&&sr[0][0]==='Dusty teal,Mossy fern,Smoky claret','own colors made on two phones: both kept, app and worker '+JSON.stringify(sr[0]));
  ok(sr[0][1]==='{"blazer":8,"shirt":2,"suit":6,"tie":5}'&&sr[0][2]==='0123456'&&sr[0][3]==='04'&&sr[0][4]==='F','Care, workdays and blazer days changed on both: each phone\'s entry kept '+JSON.stringify(sr[0]));
  const bare=()=>K.keySettings(J({units:'C',updated:1000})),first=(name,t)=>{const s=bare();s.custom={colors:[{key:'own'+name,name,hex:'#123456',base:'green',types:['tie']}],patterns:[]};return K.stampSettings(s,t)};
  const fr=both({settings:first('Moss',5000)},{settings:first('Teal',6000)},m=>m.settings.custom.colors.map(c=>c.name).sort().join());
  ok(same(fr)&&fr[0]==='Moss,Teal','the first own color on each of two phones (no list before): both kept '+JSON.stringify(fr));
  const ms=K.mergeSettings(sa,sb);ok(K.mergeSettings(ms,sb)===ms||K.mergeSettings(ms,sb).updated===ms.updated,'merging the result again changes nothing');
  const rm=chg(s=>{s.custom={...s.custom,colors:[]}},7000);
  ok(K.mergeSettings(rm,sa).custom.colors.map(c=>c.name).join()==='Dusty teal','an own color removed on one phone goes; one added later on another stays');
  const tieA=chg(s=>{s.care={...s.care,tie:5}},5000),tieB=chg(s=>{s.care={...s.care,tie:3}},6000);
  ok(K.mergeSettings(tieA,tieB).care.tie===3&&K.mergeSettings(tieB,tieA).care.tie===3,'the same entry on both: the later change wins');
  const stale={...J(sa),care:{suit:1},updated:8000};stale.ks.care=8000;stale.kh.care='x';   // an older app changed Care (no entry stamps for it)
  ok(JSON.stringify(K.mergeSettings(stale,sb).care)==='{"suit":1}','a setting an older app changed counts whole, as before');

  /* ---- days slot by slot (W1-5-02) ---- */
  const D='2026-11-16',dbase={date:D,ids:{top:'s1',shirt:'w',tie:'red',belt:'bb'},updated:2000};
  const pick=(slot,id,t,extra)=>{const cur=J(dbase),force={top:'s1',shirt:'w',tie:'red',belt:'bb'};force[slot]=id;return K.dayFields({...J(dbase),force,...(extra||{}),updated:t},cur)};
  const da=pick('tie','green',5000),db=pick('shirt','blue',6000);
  ok(da.fs.s['force.tie']===5000&&!('force.shirt' in da.fs.s),'a pick stamps its own slot; the slots it fixed to what was shown are not changes');
  const dr=both({days:[da]},{days:[db]},m=>{const d=m.days[0];return [d.force.tie,d.force.shirt]});
  ok(same(dr)&&dr[0][0]==='green'&&dr[0][1]==='blue','picks for two slots of one day on two phones: both kept, app and worker '+JSON.stringify(dr));
  const worn=K.dayFields({...J(dbase),worn:false,updated:5000},J(dbase)),belt=pick('belt','black',6000);
  const wr=both({days:[worn]},{days:[belt]},m=>{const d=m.days[0];return [d.worn,d.force.belt]});
  ok(same(wr)&&wr[0][0]===false&&wr[0][1]==='black','"Didn\'t wear" on one phone and a belt on the other: both kept '+JSON.stringify(wr));
  // the week's lock (an older copy without fs): dayWins as before
  const owner={date:D,force:{tie:'navy'},updated:5000},lock={date:D,lock:{tie:'red'},lockOnly:1,base:1000,updated:7000};
  ok(K.mergeState({days:[owner]},{days:[lock]}).days[0].force.tie==='navy'&&K.mergeState({days:[lock]},{days:[owner]}).days[0].force.tie==='navy','a stale lock (built on an older version) doesn\'t replace a pick made after it');
  const lockK=K.dayFields({...J(da),lock:{tie:'green',shirt:'w'},lockAt:5100,lockOnly:1,base:5000,updated:5100},J(da));
  ok(lockK.fs.s.lock===5100&&lockK.fs.s['force.tie']===5000,'the week\'s lock stamps only the lock');
  const dr2=both({days:[lockK]},{days:[db]},m=>{const d=m.days[0];return [d.force.tie,d.force.shirt]});
  ok(same(dr2)&&dr2[0][0]==='green'&&dr2[0][1]==='blue','a pick then the week\'s lock on one phone, a pick on the other: both picks kept '+JSON.stringify(dr2));

  /* ---- two devices through the real worker ---- */
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  let puts=0,putKeys=[];const kvPut=KV.put;KV.put=async(...x)=>{puts++;putKeys.push(x[0]);return kvPut(...x)};
  const browser=await chromium.launch();
  try{
    const device=async()=>{const c=await browser.newContext();
      await c.route(HOST+'**',async route=>{const r=route.request();
        const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(url);
      await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>{clearTimeout(syncTimer);window.scheduleSync=()=>{}});return p};   // syncs only when the test says
    const sync=p=>p.evaluate(()=>syncNow());
    const data=()=>{const v=store.get('wardrobe:v1');return v?JSON.parse(typeof v==='string'?v:new TextDecoder().decode(v)).data:null};
    const A=await device();
    await A.evaluate(async()=>{for(const [id,n,t] of [['b1','Brown belt','belt'],['t1','Green tie','tie'],['s1','Pink shirt','shirt']]){const it={id,type:t,primaryColor:t==='belt'?'brown':t==='tie'?'green':'pink',pattern:'solid',name:n,added:Date.now(),updated:Date.now()};await put(it);items.push(it)}});
    await sync(A);const B=await device();await sync(B);
    ok(await B.evaluate(()=>items.length===3),'phone B takes the wardrobe');
    // W1-5-01 through the worker (on the Wardrobe: a sync that brings changes to Today records the day, one more backup that isn't the merge's)
    for(const d of [A,B])await d.evaluate(()=>show('wardrobe'));await sync(A);await sync(B);
    await A.evaluate(async()=>{const it=items.find(i=>i.id==='s1');it.name='Pink oxford';await put(it)});
    await B.evaluate(async()=>{const it=items.find(i=>i.id==='s1');it.paused=true;await put(it)});
    puts=0;putKeys=[];await sync(A);await sync(B);await sync(A);const w1=putKeys.filter(k=>k==='wardrobe:v1').length;   // (the day's first save also keeps its daily copies)
    const s1=x=>x.evaluate(()=>{const i=items.find(i=>i.id==='s1');return [i.name,!!i.paused]});
    const srv=data().items.find(i=>i.id==='s1');
    ok(JSON.stringify([await s1(A),await s1(B),[srv.name,!!srv.paused]])==='[["Pink oxford",true],["Pink oxford",true],["Pink oxford",true]]','a rename on one phone and "Take out of rotation" on the other: both on both phones and the server');
    ok(w1<=2,`and it took ${w1} backup writes (one per phone's backup, as before)`);
    // W1-5-04: the sheet open on A while B's change arrives
    await A.evaluate(()=>{show('wardrobe');openItem('b1')});
    await B.evaluate(async()=>{const it=items.find(i=>i.id==='b1');it.paused=true;await put(it)});await sync(B);await sync(A);
    const lab=await A.evaluate(()=>document.querySelector('#item-view .rotbtn').textContent);
    ok(/Put back/.test(lab),'the open item sheet is drawn again with the other phone\'s change: '+lab);
    await A.evaluate(()=>{window.__t=document.querySelector('#item-view .rotbtn').getAttribute('onclick')});
    await A.evaluate(()=>togglePause('b1',true));
    ok(await A.evaluate(()=>!!items.find(i=>i.id==='b1').paused),'a button drawn before the change does what it said ("Take out" never puts it back in)');
    await A.evaluate(()=>closeItem());
    // W1-6-02: the piece deleted on A while its sheet is open on B
    await B.evaluate(()=>{show('wardrobe');openItem('t1')});
    await A.evaluate(()=>wardDeleteNow('t1'));await sync(A);await sync(B);
    const gone=await B.evaluate(()=>({toast:document.querySelector('#toast').textContent,note:!!document.querySelector('#item-view .ivgone'),open:!!editing}));
    ok(/deleted on another phone/.test(gone.toast)&&gone.note&&gone.open,'the open sheet of a piece deleted on another phone says so '+JSON.stringify(gone));
    await B.evaluate(()=>setItemField('t1','name','Green tie (fav)'));
    ok(/wasn’t kept/.test(await B.evaluate(()=>document.querySelector('#toast').textContent)),'a change typed into it says it wasn\'t kept');
    await B.evaluate(()=>closeItem());
    // W1-6-05: "Take them out" on A, not synced since B renamed an imported piece: A syncs first, and the renamed piece stays
    await A.evaluate(async()=>{const at=Date.now()-60000;for(const id of ['x1','x2']){const it={id,type:'tie',primaryColor:'navy',pattern:'solid',name:'Imported '+id,added:at,updated:at+500};await putRaw(it);items.push(it)}
      localStorage.setItem('kit_import_last',JSON.stringify({ids:['x1','x2'],at}))});
    await sync(A);await sync(B);
    await B.evaluate(async()=>{const it=items.find(i=>i.id==='x2');it.name='Gift tie';await put(it)});await sync(B);
    const un=A.evaluate(()=>kitUnimport());await A.waitForFunction(()=>asking);
    const uq=await A.evaluate(()=>document.querySelector('.ask-q').textContent+' '+[...document.querySelectorAll('.ask-more')].map(e=>e.textContent).join(' '));
    await A.evaluate(()=>askAnswer(true));await un;
    const ua=await A.evaluate(()=>items.filter(i=>/^x/.test(i.id)).map(i=>i.name));
    ok(/Take out the 1 item/.test(uq)&&/changed since/.test(uq)&&JSON.stringify(ua)==='["Gift tie"]','"Take them out" syncs first: the piece renamed on the other phone stays '+JSON.stringify([uq,ua]));
    // W1-5-06 through the worker: own colors made on both phones
    await A.evaluate(async()=>{settings.custom={...(settings.custom||{}),colors:[...((settings.custom||{}).colors||[]),{key:'owndustyteal',name:'Dusty teal',hex:'#2f6f73',base:'teal',types:['tie']}]};await saveUserSettings()});
    await B.evaluate(async()=>{settings.custom={...(settings.custom||{}),colors:[...((settings.custom||{}).colors||[]),{key:'ownmossyfern',name:'Mossy fern',hex:'#0f3d2a',base:'green',types:['tie']}]};await saveUserSettings()});
    await sync(A);await sync(B);await sync(A);
    const cols=x=>x.evaluate(()=>(settings.custom.colors||[]).map(c=>c.name).sort().join(','));
    const cs=[await cols(A),await cols(B),(data().settings.custom.colors||[]).map(c=>c.name).sort().join(',')];
    ok(cs.every(c=>c==='Dusty teal,Mossy fern'),'own colors made on two phones: both on both phones and the server '+JSON.stringify(cs));
    // W1-11-03: Restore file keeps the file's settings
    const file=JSON.parse(await A.evaluate(async()=>JSON.stringify({app:'daily-wardrobe',version:1,...await localState()})));file.settings.vestMode='always';file.settings.units='F';   // (the file's stamps are older than the change below)
    await A.evaluate(async f=>{await new Promise(r=>setTimeout(r,5));settings.vestMode='never';settings.units='C';await saveUserSettings();await restoreBackup(new File([f],'b.json'))},JSON.stringify(file));
    const after=await A.evaluate(()=>[settings.vestMode,settings.units]);
    ok(JSON.stringify(after)==='["always","F"]','Restore file: the file\'s settings win over newer ones on the phone '+JSON.stringify(after));
    // W1-6-01: the owner's Delete everything on A, held on B
    await sync(A);await sync(B);await new Promise(r=>setTimeout(r,5));
    const del=await worker.fetch(new Request(HOST+'account',{method:'DELETE',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({confirm:'delete'})}),env);
    ok(del.status===200&&!store.has('wardrobe:v1')&&store.has('wiped'),'Delete everything leaves only the note of when');
    await B.evaluate(()=>{localStorage.setItem('last_sync',Date.now()-60000)});   // (B last synced before the delete)
    const held=await B.evaluate(()=>syncNow());await B.waitForSelector('#ask-ok');
    const q=await B.evaluate(()=>({q:document.querySelector('.ask-q').textContent,ok:document.querySelector('#ask-ok').textContent,st:localStorage.getItem('sync_status')}));
    ok(held===false&&!store.has('wardrobe:v1')&&/deleted from the server on another device/.test(q.q)&&q.ok==='Back it up again','the other owner phone puts nothing back and asks '+JSON.stringify(q));
    await B.evaluate(()=>askAnswer(false));await B.evaluate(()=>syncNow());
    ok(!store.has('wardrobe:v1')&&!(await B.evaluate(()=>!!asking)),'"Not now": nothing sent, not asked again at every sync');
    await B.evaluate(()=>syncTap());await B.waitForFunction(()=>asking);await B.evaluate(()=>askAnswer(true));
    await B.waitForFunction(()=>!syncing&&localStorage.getItem('wipe_seen'));await B.evaluate(()=>syncNow());
    ok(store.has('wardrobe:v1')&&data().items.length===await B.evaluate(()=>items.length),'"Back it up again" (from Sync now) puts this phone\'s copy back');
    ok(!A.errs.length&&!B.errs.length,'no page errors: '+[...A.errs,...B.errs].join(' | '));
  }finally{await browser.close()}
};
