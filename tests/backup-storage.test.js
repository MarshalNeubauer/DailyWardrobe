// How backups are stored: photos kept apart, the small sync, inline swatches, batches and size limits.
// Joined by feature from 4 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),fs=require('fs'),os=require('os'),crypto=require('crypto'),{pathToFileURL}=require('url');

/* ---- was tests/photostore.test.js ---- */
// Photos stored once (worker.js, 2026-11-13): the backup keeps its photos by reference ("dwph:<hash>"), each photo once under
// <ns>ph:<hash>, so a save writes a small value and the daily and monthly copies share the photos. Checked on the real worker.js in
// Node against a mocked KV that counts what is written: saves and photo dedupe, the copies and Roll back, an older app's GET and PUT
// (also over 20 MB), the conversion of a backup stored inline (and of one stored with #284's index), account deletion, and the daily
// clean-up, which must never delete a photo the backup or a kept copy refers to.
const photostore=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map(),exp=new Map(),writes=[];let hook=null;
  const size=v=>typeof v==='string'?Buffer.byteLength(v):v.byteLength;
  const KV={get:async(k,t)=>{if(!store.has(k))return null;const v=store.get(k);if(t==='json')return JSON.parse(typeof v==='string'?v:Buffer.from(v).toString());return v},
    getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
    put:async(k,v,o={})=>{if(v instanceof ArrayBuffer)v=new Uint8Array(v);store.set(k,v);meta.set(k,o.metadata);writes.push({k,n:size(v)});
      if(o.expirationTtl)exp.set(k,Math.floor(Date.now()/1000)+o.expirationTtl);else if(o.expiration)exp.set(k,o.expiration);else exp.delete(k)},
    delete:async k=>{if(hook)await hook(k);store.delete(k);meta.delete(k);exp.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name),...(exp.has(name)?{expiration:exp.get(name)}:{})})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const call=(method,q='',body,tok='secret')=>worker.fetch(new Request(HOST+'sync'+q,{method,headers:{'x-app-token':tok,'content-type':'application/json'},body:body==null?undefined:typeof body==='string'?body:JSON.stringify(body)}),env);
  const full=async(q='',tok)=>JSON.parse(await (await call('GET',q,null,tok)).text());
  const post=(delta,o={},ns='',tok)=>{const m=meta.get(ns+'wardrobe:v1');return call('POST','',{baseRev:m?m.rev:0,baseSaved:m?m.saved:0,day:o.day,reason:o.reason,delta,photos:o.photos||{}},tok)};
  const pic=n=>'data:image/jpeg;base64,'+crypto.randomBytes(Math.round(n*3/4)).toString('base64');
  const hashOf=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,20);
  const phKeys=(ns='')=>[...store.keys()].filter(k=>k.startsWith(ns+'ph:')&&/^[0-9a-f]{20}$/.test(k.slice(ns.length+3)));
  const wrote=(from,re)=>writes.slice(from).filter(w=>re.test(w.k));
  const kb=n=>(n/1e3).toFixed(1)+' KB';
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const T0=Date.now()-86400000;
  // the save days: a save's day is the app's only within a day of the server's (CR-6-08), so three days around today, the first two
  // in one month (DA the first day, DB the next, DC one with no copy yet)
  const iso=t=>new Date(t).toISOString().slice(0,10),TD=iso(Date.now()),[DA,DB,DC]=TD.endsWith('-01')?[TD,iso(Date.now()+864e5),iso(Date.now()-864e5)]:[iso(Date.now()-864e5),TD,iso(Date.now()+864e5)],MA=DA.slice(0,7);
  const seed=()=>({items:Array.from({length:24},(_,i)=>({id:'it'+i,type:['suit','shirt','tie','pants'][i%4],primaryColor:'navy',pattern:'solid',added:T0+i,photo:pic(60e3),texture:pic(60e3),swatch:pic(38e3),swSrc:'tex'})),   // (a PNG swatch from before 2026-11-15, over PH_MIN; a JPEG one stays inline: backup-storage.test.js)
    days:Array.from({length:20},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,ids:['it0','it1','it2'],worn:true,updated:T0})),tombstones:{},settings:{workdays:[1,2,3,4,5],setupDone:1,updated:T0}});
  const S=seed();S.items[23].photo=S.items[22].photo;   // two items with one photo
  const photoCount=new Set(S.items.flatMap(i=>[i.photo,i.texture,i.swatch])).size;
  const inlineMB=JSON.stringify({rev:5,saved:T0,data:S}).length/1e6;

  // ---- a backup stored inline (by the worker before #284) is converted at its next save
  store.set('wardrobe:v1',JSON.stringify({rev:5,saved:T0,data:S}));meta.set('wardrobe:v1',{rev:5,saved:T0});
  let w0=writes.length;
  const r1=await post({days:[{date:'2026-11-02',ids:['it0','it1','it2'],worn:true,updated:Date.now()}]},{day:DA});
  const v1=store.get('wardrobe:v1'),f1=await full();
  ok(r1.status===200&&meta.get('wardrobe:v1').pv===1&&!v1.includes('base64')&&v1.length<30e3,`a backup stored inline (${inlineMB.toFixed(1)} MB) is converted at its next save: the stored value is ${kb(v1.length)}, photos by reference`);
  ok(phKeys().length===photoCount&&wrote(w0,/^ph:/).length===photoCount&&phKeys().every(k=>{const v=store.get(k);return typeof v==='string'&&hashOf(JSON.parse(v))===k.slice(3)}),`every photo is stored once under ph:<its hash> (${photoCount} photos for ${S.items.length*3} places: two items share one)`);
  ok(same(f1.data.items,S.items)&&f1.data.days.length===21&&f1.rev===6&&!('pv' in f1)&&!('revs' in f1),'the whole backup, rebuilt for an older app, has every photo exactly as it was, and only {rev, saved, data}');
  const snapDay=store.get('snap:'+DA);
  ok(snapDay&&meta.get('snap:'+DA).pv===1&&snapDay.length<30e3&&same((await full('?snap='+DA)).data,S)&&store.get('snap:'+MA)===snapDay,`the day's copy of the version it replaced is small too (${kb(snapDay.length)}) and comes back whole, photos inline, for Roll back`);

  // ---- an ordinary save writes the small value only
  w0=writes.length;
  const r2=await post({days:[{date:'2026-11-03',ids:['it0','it1','it2'],worn:true,updated:Date.now()}]},{day:DA});
  const ws2=writes.slice(w0);
  ok(r2.status===200&&ws2.length===1&&ws2[0].k==='wardrobe:v1'&&ws2[0].n<30e3,`a day marked worn writes one small value (${ws2.map(w=>w.k+' '+kb(w.n)).join(', ')}), no photo`);
  // a new photo: written once; the same photo on a second item: not again
  const np=pic(70e3),nh=hashOf(np);w0=writes.length;
  const r3=await post({items:[{...S.items[5],photo:'dwph:'+nh,updated:Date.now()}]},{day:DA,photos:{[nh]:np}});
  const r3b=await post({items:[{...S.items[6],photo:'dwph:'+nh,updated:Date.now()+1}]},{day:DA});
  ok(r3.status===200&&r3b.status===200&&wrote(w0,/^ph:/).length===1&&store.has('ph:'+nh)&&(await full()).data.items.find(i=>i.id==='it6').photo===np,'a new photo is written once; a second item with the same photo refers to the same one');
  const r3c=await post({items:[{...S.items[7],photo:'dwph:'+'f'.repeat(20),updated:Date.now()}]},{day:DA});
  ok(r3c.status===400&&(await r3c.json()).missing[0]==='f'.repeat(20),'a reference to a photo nobody sent is refused (400 missing), as before');
  const r3d=await call('POST','',{baseRev:1,day:DA,delta:{items:[]}});
  ok(r3d.status===409&&(await r3d.json()).rev===meta.get('wardrobe:v1').rev,'a save based on an old version is refused (409) with the current version, as before');
  // a deletion: the tombstone is kept
  await post({tombstones:{it4:Date.now()}},{day:DA});
  ok(!(await full()).data.items.some(i=>i.id==='it4')&&JSON.parse(store.get('wardrobe:v1')).data.tombstones.it4,'a deletion leaves a tombstone in the backup, as before');

  // ---- the next day's copy: small, sharing the photos
  w0=writes.length;
  await post({days:[{date:'2026-11-04',ids:['it0','it1','it2'],worn:true,updated:Date.now()}]},{day:DB});
  const ws4=writes.slice(w0);
  ok(store.has('snap:'+DB)&&ws4.length===2&&!wrote(w0,/^ph:/).length&&ws4.every(w=>w.n<30e3),`the next day's first save keeps its copy (${ws4.map(w=>w.k+' '+kb(w.n)).join(', ')}), no photo written again`);
  const lst=await (await call('GET','?snaps=1')).json();
  ok([DB,DA,MA].every(id=>lst.snaps.some(s=>s.id===id)),'the copies are listed as before ('+lst.snaps.map(s=>s.id).join(', ')+')');
  const s3=await full('?snap='+DB);
  ok(s3.data.items.find(i=>i.id==='it6').photo===np&&s3.data.items.find(i=>i.id==='it0').photo===S.items[0].photo,'a copy comes back with the photos it had that day');

  // ---- an older app: GET whole, PUT whole (a photo changed), its 409
  const old=await full();
  const np2=pic(65e3);old.data.items.find(i=>i.id==='it8').photo=np2;old.data.items.find(i=>i.id==='it8').updated=Date.now();
  w0=writes.length;
  const r5=await call('PUT','',{baseRev:old.rev,day:DB,data:old.data});
  ok(r5.status===200&&wrote(w0,/^ph:/).length===1&&store.has('ph:'+hashOf(np2))&&meta.get('wardrobe:v1').pv&&store.get('wardrobe:v1').length<30e3,`an older app's whole backup (${kb(JSON.stringify(old).length*1)}) is stored by reference, writing only its one new photo`);
  const r5b=await call('PUT','',{baseRev:1,day:DB,data:{items:[]}}),c5=JSON.parse(await r5b.text());
  ok(r5b.status===409&&c5.error==='conflict'&&c5.rev===meta.get('wardrobe:v1').rev&&c5.data.items.find(i=>i.id==='it8').photo===np2&&!('pv' in c5),'its conflict answer is the whole backup, photos inline, as before');
  const lite=await (await call('GET','?lite=1')).json();
  ok(lite.lite===1&&lite.ph.includes(hashOf(np2))&&lite.items.find(i=>i.id==='it8').photo==='dwph:'+hashOf(np2),'this app\'s small sync reads it as before (photos as references, the hashes listed)');
  const phr=await (await call('GET','?ph='+hashOf(np2)+','+nh)).json();
  ok(phr.photos[hashOf(np2)]===np2&&phr.photos[nh]===np,'and downloads photos by hash from their own keys');

  // ---- Roll back: the copy downloaded whole, saved back the way the app does (reason restore), the replaced version kept small
  const before=await full(),back=await full('?snap='+DA);
  const r6=await call('PUT','',{baseRev:before.rev,day:DB,reason:'restore',data:{...back.data,settings:{...back.data.settings,updated:Date.now()}}});
  const br=await full('?snap=before-restore');
  ok(r6.status===200&&meta.get('snap:before-restore').pv&&same(br.data,before.data)&&(await full()).data.items.find(i=>i.id==='it6').photo===S.items[6].photo,'Roll back: the copy comes back whole, is saved back, and the version it replaced is kept (small) as before-restore');

  // ---- a whole backup over 20 MB (an older app's large PUT, data last) is stored by reference without being parsed whole
  {const big=await full(),many=Array.from({length:110},(_,i)=>({id:'big'+i,type:'shirt',added:T0+100+i,photo:pic(200e3)}));
    big.data.items.push(...many);const txt=`{"baseRev":${big.rev},"day":"${DB}","data":${JSON.stringify(big.data)}}`;
    w0=writes.length;const r7=await call('PUT','',txt);
    ok(txt.length>20*1024*1024&&r7.status===200&&meta.get('wardrobe:v1').pv&&!meta.get('wardrobe:v1').parts&&store.get('wardrobe:v1').length<60e3&&wrote(w0,/^ph:/).length===110,`a ${(txt.length/1e6).toFixed(1)} MB backup is stored as ${kb(store.get('wardrobe:v1').length)} plus its 110 new photos`);
    const g=await full();ok(g.data.items.find(i=>i.id==='big77').photo===many[77].photo&&g.data.items.length===big.data.items.length,'and comes back whole');
    const r7b=await call('PUT','',JSON.stringify({baseRev:meta.get('wardrobe:v1').rev,day:DB,data:{...g.data,items:g.data.items.filter(i=>!i.id.startsWith('big'))}}));
    ok(r7b.status===200,'(the large items taken out again)');}

  // ---- the daily clean-up
  const day=86400000,nextGc=(()=>{const d=new Date();d.setUTCHours(23,0,0,0);if(d.getTime()<Date.now())d.setTime(d.getTime()+day);return d.getTime()})();
  const gc=async t=>{const ps=[];await worker.scheduled({scheduledTime:t},env,{waitUntil:p=>ps.push(p)});await Promise.all(ps)};
  const gcDoc=()=>store.has('ph:gc')?JSON.parse(store.get('ph:gc')):null;
  // a photo replaced: the old one stays referred to by the day's copy
  const oldPh=S.items[9].photo,oh=hashOf(oldPh),np3=pic(60e3),h3=hashOf(np3);
  await post({items:[{...(await full()).data.items.find(i=>i.id==='it9'),photo:'dwph:'+h3,updated:Date.now()}]},{day:DB,photos:{[h3]:np3}});
  const bigKeys=phKeys().filter(k=>!JSON.stringify([...store.entries()].filter(([k2])=>!k2.startsWith('ph:'))).includes(k.slice(3)));
  const n0=phKeys().length;
  await gc(nextGc-3600000);   // not its hour: nothing
  ok(phKeys().length===n0&&!gcDoc(),'the clean-up runs only at 23:00 UTC');
  await gc(nextGc);
  ok(phKeys().length===n0&&store.has('ph:'+oh),`its first run deletes nothing (${bigKeys.length} photos nothing refers to are noted: ${Object.keys((gcDoc()||{}).cand||{}).length})`);
  ok(!Object.keys((gcDoc()||{}).cand||{}).includes(oh),'a photo only an old copy refers to is not even noted');
  await gc(nextGc+day);
  ok(phKeys().length===n0-bigKeys.length&&bigKeys.every(k=>!store.has(k))&&store.has('ph:'+oh)&&store.has('ph:'+h3),`a day later the ${bigKeys.length} photos still referred to by nothing are deleted; the old copy's photo stays`);
  // every kept copy still comes back whole
  const copies=[...store.keys()].filter(k=>/^snap:/.test(k)).map(k=>k.slice(5));
  const whole=async q=>{const t=await (await call('GET',q)).text();return !/"dwph:/.test(t)&&JSON.parse(t).data};
  ok((await Promise.all(copies.map(id=>whole('?snap='+id)))).every(Boolean)&&await whole(''),`after the clean-up the backup and every kept copy (${copies.join(', ')}) come back whole, no photo missing`);
  // the copies expire: the old photo is then referred to by nothing, and goes only after two runs a day apart
  for(const k of [...store.keys()])if(k.startsWith('snap:')&&store.get(k).includes(oh))store.delete(k);
  await gc(nextGc+2*day);
  ok(store.has('ph:'+oh)&&gcDoc().cand[oh],'once no copy refers to it, the first run only notes it');
  // a save that brings it back meanwhile (sent again by a phone): written again, and kept
  await post({items:[{...(await full()).data.items.find(i=>i.id==='it10'),photo:'dwph:'+oh,updated:Date.now()}]},{day:DB,photos:{[oh]:oldPh}});
  await gc(nextGc+3*day);
  ok(store.has('ph:'+oh)&&!(gcDoc()&&gcDoc().cand&&gcDoc().cand[oh]),'a noted photo that a save refers to again is kept (and written again: the clean-up had it in view)');
  // a race: a save refers to a photo just as it is deleted: the clean-up reads the backup again and puts it back
  const lone=pic(30e3),lh=hashOf(lone);
  store.set('ph:'+lh,JSON.stringify(lone));meta.set('ph:'+lh,{t:nextGc-10*day});
  await gc(nextGc+4*day);await gc(nextGc+5*day+1);
  ok(!store.has('ph:'+lh),'(a stray photo goes after two runs)');
  store.set('ph:'+lh,JSON.stringify(lone));meta.set('ph:'+lh,{t:nextGc-10*day});
  await gc(nextGc+6*day);
  hook=async k=>{if(k==='ph:'+lh){hook=null;const b=JSON.parse(store.get('wardrobe:v1'));b.data.items[0].photo='dwph:'+lh;store.set('wardrobe:v1',JSON.stringify(b))}};
  await gc(nextGc+7*day);hook=null;
  ok(store.has('ph:'+lh)&&(await full()).data.items[0].photo===lone,'a photo a save refers to while it is being deleted is put back');

  // ---- inline copies (kept before this change) are converted by the clean-up, a few a day, keeping their expiry
  {const inl=JSON.stringify({rev:3,saved:T0-5*day,data:S});store.set('snap:2026-10',inl);meta.set('snap:2026-10',{rev:3,saved:T0-5*day});exp.set('snap:2026-10',Math.floor(Date.now()/1000)+200*86400);
    const e0=exp.get('snap:2026-10');w0=writes.length;
    await gc(nextGc+8*day);
    ok(meta.get('snap:2026-10').pv&&store.get('snap:2026-10').length<30e3&&exp.get('snap:2026-10')===e0&&same((await full('?snap=2026-10')).data,S)&&phKeys().includes('ph:'+hashOf(S.items[1].photo)),
      `a copy kept inline (${(inl.length/1e6).toFixed(1)} MB) is converted to ${kb(store.get('snap:2026-10').length)}, keeps its expiry and comes back the same (${wrote(w0,/^ph:/).length} photos written: the ones nothing else kept)`);}

  // ---- a backup stored with #284's index (the worker before this change) is converted too
  // (commit 036c1d6's worker.js, kept as a fixture: a shallow clone has no history to `git show` it from)
  {let Old=null,oldErr='';try{const src=fs.readFileSync(path.join(__dirname,'fixtures','old-worker','worker-036c1d6.js'),'utf8'),f=path.join(os.tmpdir(),`dw-pv-old-worker-${process.pid}.mjs`);fs.writeFileSync(f,src);Old=(await import(pathToFileURL(f).href)).default;fs.unlinkSync(f)}catch(e){oldErr=e.message}
    ok(!!Old,'the worker from before loads (tests/fixtures/old-worker/worker-036c1d6.js) '+oldErr);
    if(Old){const s2=seed();
      const st2=new Map(),m2=new Map(),K2={get:async(k,t)=>st2.has(k)?(t==='json'?JSON.parse(st2.get(k)):st2.get(k)):null,getWithMetadata:async k=>({value:st2.has(k)?st2.get(k):null,metadata:m2.get(k)||null}),put:async(k,v,o)=>{st2.set(k,v);m2.set(k,o&&o.metadata)},delete:async k=>{st2.delete(k);m2.delete(k)},list:async({prefix})=>({keys:[...st2.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:m2.get(name)})),list_complete:true})};
      await Old.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:0,day:'2026-11-01',data:s2})}),{APP_TOKEN:'secret',WARDROBE:K2});
      ok(m2.get('wardrobe:v1').ll>0&&st2.get('wardrobe:v1').includes('"index"'),'(a backup stored by the worker before this change, with its index)');
      const keep=[store.get('wardrobe:v1'),meta.get('wardrobe:v1')];store.set('wardrobe:v1',st2.get('wardrobe:v1'));meta.set('wardrobe:v1',m2.get('wardrobe:v1'));
      const lb=await (await call('GET','?lite=1')).json();
      const r8=await post({days:[{date:'2026-11-07',ids:['it0'],worn:true,updated:Date.now()}]},{day:DC});
      ok(lb.lite===1&&r8.status===200&&meta.get('wardrobe:v1').pv&&same((await full()).data.items,s2.items)&&same((await full('?snap='+DC)).data,s2),'a backup stored with #284\'s index is converted at its next save, every photo kept, its copy small and whole');
      store.set('wardrobe:v1',keep[0]);meta.set('wardrobe:v1',keep[1]);
    }}

  // ---- a tester: own photos under their prefix; deleting the account deletes them, and nobody else's
  {const inv=await (await worker.fetch(new Request(HOST+'invites',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({name:'Tess'})}),env)).json();
    const tp=pic(40e3),th=hashOf(tp),shared=S.items[0].photo;
    const t1=await call('POST','',{baseRev:0,day:DB,delta:{items:[{id:'t1',type:'tie',added:1,photo:'dwph:'+th},{id:'t2',type:'tie',added:2,photo:shared}]},photos:{[th]:tp}},inv.code);
    const tns=`u:${inv.id}:`;
    ok(t1.status===200&&store.has(tns+'ph:'+th)&&store.has(tns+'ph:'+hashOf(shared))&&(await full('',inv.code)).data.items.find(i=>i.id==='t2').photo===shared,'a tester\'s photos are stored under their own prefix (even one the owner also has)');
    await gc(nextGc+9*day);await gc(nextGc+10*day);const ownerPh=phKeys().length;
    ok(store.has(tns+'ph:'+th)&&phKeys().length===ownerPh,'the clean-up keeps a tester\'s referenced photos and leaves the owner\'s alone');
    const d=await worker.fetch(new Request(HOST+'account',{method:'DELETE',headers:{'x-app-token':inv.code,'content-type':'application/json'},body:JSON.stringify({confirm:'delete'})}),env);
    ok(d.status===200&&![...store.keys()].some(k=>k.startsWith(tns))&&phKeys().length===ownerPh,'deleting a tester\'s account deletes their photos too, and none of the owner\'s');}
  {const del=async()=>(await worker.fetch(new Request(HOST+'account',{method:'DELETE',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({confirm:'delete'})}),env)).json();
    for(let i=0;i<40;i++)if(!(await del()).more)break;
    const left=phKeys().length+[...store.keys()].filter(k=>/^(wardrobe:|snap:)/.test(k)).length;
    ok(!left&&!store.has('ph:gc'),'deleting the owner\'s account deletes the owner\'s photos and the clean-up\'s note too');}
};

/* ---- was tests/deltasync.test.js ---- */
// The small sync (sync.js syncLite, worker.js syncLiteGet / syncPhotos / syncLitePost): a change on one device goes up and comes down
// without the backup's photos. A wardrobe of 40 items with real-sized photos (about 10 MB, as the owner's 98 items are 16 MB) is put on
// the real worker.js in Node as an older worker stored it; three devices sync through it: two with this app, one playing an older app
// (whole backup each time). Also the worker from before this change, against this app, and a tester's daily backup limit.
const deltasync=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  let W=worker;   // the worker answering (swapped for the one from before this change below)
  const pic=n=>'data:image/jpeg;base64,'+crypto.randomBytes(Math.round(n*3/4)).toString('base64');
  const T0=Date.now()-86400000;
  const seed={items:Array.from({length:40},(_,i)=>({id:'it'+i,type:['suit','shirt','tie','pants'][i%4],primaryColor:'navy',pattern:'solid',added:T0+i,photo:pic(120e3),texture:pic(120e3),swatch:pic(20e3),swSrc:'tex'})),
    days:Array.from({length:30},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,ids:['it0','it1','it2'],worn:true,updated:T0})),tombstones:{},settings:{workdays:[1,2,3,4,5],setupDone:1,updated:T0}};
  // stored as the worker before this change kept it: no index
  store.set('wardrobe:v1',JSON.stringify({rev:5,saved:T0,data:seed}));meta.set('wardrobe:v1',{rev:5,saved:T0});
  const MB=store.get('wardrobe:v1').length/1e6;
  const browser=await chromium.launch();
  const traffic=[],devs=[];
  const device=async(old)=>{const ctx=await browser.newContext();ctx.__n=devs.length;if(old)await ctx.addInitScript(()=>{window.SYNC_OLD=true});
    await ctx.route(HOST+'**',async route=>{const r=route.request(),u=new URL(r.url());
      if(u.pathname!=='/sync')return route.fulfill({status:404,body:'{}'});
      const res=await W.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      const body=await res.text();traffic.push({who:ctx.__n,m:r.method(),q:u.search.slice(0,40),up:(r.postData()||'').length,down:body.length});
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);const d={ctx,p,errs,n:ctx.__n};devs.push(d);return d};
  const sync=d=>d.p.evaluate(()=>syncNow());
  // every device still first: no sync or day recording running, the stored wardrobe the same over three checks 120 ms apart (at most
  // 6 s), and the backup an edit or a redraw scheduled (scheduleSync, 2.5 s on) called off, as tests/sync.test.js's quiet. On a busy
  // machine the older app's scheduled sync (C: the whole backup, down and up) came due during B's count on the new worker:
  // "still takes the small sync (10425.2 KB up, 20886.1 KB down, 5 requests)", the nightly run of 2026-11-17
  const quiet=d=>d.p.evaluate(async()=>{let last='',same=0;const end=Date.now()+6000;
    while(Date.now()<end){await recordRun;const sig=stateSig(await localState());same=!syncing&&sig===last?same+1:0;last=sig;if(same>=3)break;await new Promise(r=>setTimeout(r,120))}
    clearTimeout(syncTimer)});
  // one sync on d, with what it sent and received (d's own requests: each is noted with its device)
  const counted=(d,r)=>{const t=traffic.filter(x=>x.who===d.n);return {ok:r,up:t.reduce((a,x)=>a+x.up,0),down:t.reduce((a,x)=>a+x.down,0),n:t.length,t,big:t.some(x=>x.up>1e6||x.down>1e6)}};
  // (d's own scheduled backup is called off before the wait, so the change it holds goes up in the count, not during the quiet:
  // "a day marked worn goes up without the backup (0.0 KB up …)" on the branch's nightly run)
  const measured=async d=>{await d.p.evaluate(()=>clearTimeout(syncTimer));await Promise.all(devs.map(quiet));traffic.length=0;return counted(d,await sync(d))};
  const kb=x=>`${(x.up/1e3).toFixed(1)} KB up, ${(x.down/1e3).toFixed(1)} KB down, ${x.n} requests`;
  const status=d=>d.p.evaluate(()=>localStorage.getItem('sync_status'));
  const itemOf=(d,id)=>d.p.evaluate(id=>items.find(i=>i.id===id)||null,id);
  // an edit is made on a quiet device: made while the device's own background sync ran (the older app's, just started), that sync
  // took the edit into its mark without sending it, and the counted sync then saw nothing to send ("and still saves the whole backup
  // … 0.0 KB up, 1 requests", after main's #554 changed the timing)
  const edit=async(d,id,f)=>{await quiet(d);return d.p.evaluate(async([id,f])=>{const it={...items.find(i=>i.id===id),...f,updated:Date.now()};await put(it);items=items.map(i=>i.id===id?it:i)},[id,f])};
  const stored=()=>JSON.parse(store.get('wardrobe:v1'));
  // the backup whole, photos inline, as an older app downloads it (since 2026-11-13 the stored value keeps its photos by reference)
  const full=async()=>JSON.parse(await (await W.fetch(new Request(HOST+'sync',{headers:{'x-app-token':'secret'}}),env)).text());
  try{
    const A=await device(),B=await device();
    // a first sync brings the whole wardrobe, photos and all
    await sync(A);await sync(B);
    const a0=await itemOf(A,'it7'),b0=await itemOf(B,'it7');
    ok(a0&&b0&&a0.photo===seed.items[7].photo&&b0.texture===seed.items[7].texture&&b0.swatch===seed.items[7].swatch&&(await A.p.evaluate(()=>items.length))===40,`two devices with this app take the whole wardrobe from a backup an older worker stored (${MB.toFixed(1)} MB), every photo intact`);
    ok(!!meta.get('wardrobe:v1').pv&&!store.get('wardrobe:v1').includes('base64')&&(await full()).data.items[7].photo===seed.items[7].photo&&[...store.keys()].some(k=>/^ph:[0-9a-f]{20}$/.test(k)),'the next save stores the backup with its photos by reference (no photos in it), each photo once under ph:<hash>');
    await sync(A);await sync(B);   // (both settled)

    // a day marked worn on A: under 100 KB each way, on A and on B
    await A.p.evaluate(()=>saveDay({date:'2026-11-03',ids:['it0','it1','it2'],worn:true},true));
    const up1=await measured(A),down1=await measured(B);
    ok(up1.ok&&!up1.big&&up1.up+up1.down<100e3&&up1.t.some(x=>x.m==='POST'),`a day marked worn goes up without the backup (${kb(up1)})`);
    ok(down1.ok&&!down1.big&&down1.up+down1.down<100e3&&(await B.p.evaluate(()=>dayRecs['2026-11-03']&&dayRecs['2026-11-03'].worn===true)),`and comes down to the other device the same way (${kb(down1)})`);
    // a swapped piece (an item edited) on B, back to A
    await edit(B,'it5',{primaryColor:'burgundy'});
    const up2=await measured(B),down2=await measured(A),a5=await itemOf(A,'it5');
    ok(up2.ok&&down2.ok&&up2.up+up2.down<100e3&&down2.up+down2.down<100e3&&a5.primaryColor==='burgundy'&&a5.photo===seed.items[5].photo,`an edited piece: ${kb(up2)} from B, ${kb(down2)} to A, its photos kept`);
    // a new photo goes up once and comes down once, alone
    const np=pic(150e3);await edit(A,'it9',{photo:np});
    const up3=await measured(A),down3=await measured(B);
    ok(up3.ok&&up3.up>150e3&&up3.up<300e3&&(await full()).data.items.find(i=>i.id==='it9').photo===np,`a replaced photo is sent once (${kb(up3)})`);
    ok(down3.ok&&down3.down>150e3&&down3.down<300e3&&down3.t.some(x=>x.q.startsWith('?ph='))&&(await itemOf(B,'it9')).photo===np,`and downloaded alone by the other device (${kb(down3)})`);
    // a deletion (tombstone)
    await A.p.evaluate(async()=>{const t=Date.now();await del('it3');await metaPut('tombstones',{...(await metaGet('tombstones')||{}),it3:t});items=items.filter(i=>i.id!=='it3')});
    await sync(A);await sync(B);
    ok(!(await itemOf(B,'it3'))&&!stored().data.items.some(i=>i.id==='it3')&&stored().data.tombstones.it3,'a deletion reaches the backup and the other device');
    // both devices change something before either syncs: the second is refused (409), asks again and merges
    await edit(A,'it11',{primaryColor:'grey'});await edit(B,'it12',{primaryColor:'green'});
    traffic.length=0;await sync(A);await sync(B);const conflict=traffic.filter(x=>x.m==='POST').length;await sync(A);
    const both=async d=>{const [x,y]=[await itemOf(d,'it11'),await itemOf(d,'it12')];return x.primaryColor==='grey'&&y.primaryColor==='green'};
    ok(await both(A)&&await both(B)&&!traffic.some(x=>x.down>1e6),`changes made on both devices at once both survive, without the backup (${conflict} saves)`);
    {const r=await W.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:1,day:'2026-11-13',delta:{items:[]}})}),env);
      ok(r.status===409&&(await r.json()).rev===meta.get('wardrobe:v1').rev,'a save based on an old version is refused (409) with the current version');}
    // nothing changed: one tiny request
    const q=await measured(A);
    ok(q.ok&&q.n===1&&q.down<200,`nothing new: one small request (${kb(q)})`);
    // a device whose storage was cleared but kept its marker gets everything back
    await B.p.evaluate(async()=>{for(const i of await tx('readonly',s=>s.getAll()))await tx('readwrite',s=>s.delete(i.id));items=[]});
    await sync(B);
    ok((await B.p.evaluate(()=>items.length))===(await A.p.evaluate(()=>items.length))&&(await itemOf(B,'it7')).photo===seed.items[7].photo&&stored().data.items.length>30,'a device that lost its wardrobe gets it back, photos and all, and the backup is not emptied');

    // an older app (the whole backup each time) on the same worker
    // (counted from its start: its start-up sync is the first download; a quiet before the count would let it finish uncounted)
    await Promise.all(devs.map(quiet));traffic.length=0;const C=await device(true);
    const cs=counted(C,await sync(C));
    ok(cs.ok&&cs.t[0].q===''&&(await itemOf(C,'it9')).photo===np&&(await C.p.evaluate(()=>items.length))===(await A.p.evaluate(()=>items.length)),`an older app still downloads the whole backup and reads it (${kb(cs)})`);
    await edit(C,'it13',{primaryColor:'black'});const cu=await measured(C);
    ok(cu.ok&&cu.t.some(x=>x.m==='PUT'&&x.up>1e6)&&stored().data.items.find(i=>i.id==='it13').primaryColor==='black'&&meta.get('wardrobe:v1').pv,`and still saves the whole backup, which the worker stores by reference (${kb(cu)})`);
    const fromOld=await measured(A);
    ok(fromOld.ok&&fromOld.up+fromOld.down<100e3&&(await itemOf(A,'it13')).primaryColor==='black'&&(await itemOf(A,'it13')).photo===seed.items[13].photo,`a change from the older app reaches this app without the backup (${kb(fromOld)})`);
    {const v=`${meta.get('wardrobe:v1').rev}:${meta.get('wardrobe:v1').saved}`,r=await (await W.fetch(new Request(HOST+'sync?v='+v,{headers:{'x-app-token':'secret'}}),env)).json();
      const c=await W.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({baseRev:1,data:{items:[]}})}),env),cj=await c.json();
      ok(r.same===true&&c.status===409&&cj.data.items.find(i=>i.id==='it7').photo===seed.items[7].photo&&!('index' in cj),'the older app\'s quick check and its conflict answer (the whole backup, photos inline) are as before');}
    // daily copies and Roll back: the copies are the stored backup, read whole by any app
    const day=new Date().toISOString().slice(0,10),snap=store.get('snap:'+day)?JSON.parse(store.get('snap:'+day)):null,local=new Date();
    const anySnap=[...store.keys()].filter(k=>/^snap:\d{4}-\d{2}-\d{2}$/.test(k));
    const sv=anySnap.length&&(await (await W.fetch(new Request(HOST+'sync?snap='+anySnap[0].slice(5),{headers:{'x-app-token':'secret'}}),env)).json());
    ok(anySnap.length>=1&&sv&&sv.data.items.find(i=>i.id==='it7').photo===seed.items[7].photo,`the day's first change keeps the backup as it was (${anySnap.join(', ')}), photos inline`);
    await A.p.evaluate(()=>openSettings&&openSettings());await A.p.evaluate(()=>loadSnapshots());
    await A.p.evaluate(async d=>{$('#snap-list').value=d;const r=rollBack();$('#ask-ok').click();await r},anySnap[0].slice(5));
    const rb=await A.p.evaluate(()=>({st:$('#snap-status').textContent,c5:items.find(i=>i.id==='it5').primaryColor,n:items.length}));
    await sync(B);
    ok(/Rolled back\./.test(rb.st)&&rb.c5==='navy'&&(await itemOf(B,'it5')).primaryColor==='navy'&&(await itemOf(B,'it5')).photo===seed.items[5].photo&&store.has('snap:before-restore'),`Roll back goes through the small sync and reaches the other device (${rb.st})`);

    // the worker from before this change (commit ef18d06's worker.js, kept as a fixture: a shallow clone has no history to
    // `git show` it from, and the check used to skip itself there): this app syncs with it the old way
    let OldW=null,oldErr='';
    try{const src=fs.readFileSync(path.join(__dirname,'fixtures','old-worker','worker-ef18d06.js'),'utf8'),f=path.join(os.tmpdir(),`dw-old-worker-${process.pid}.mjs`);fs.writeFileSync(f,src);OldW=(await import(pathToFileURL(f).href)).default;fs.unlinkSync(f)}catch(e){oldErr=e.message}
    ok(!!OldW,'the worker from before loads (tests/fixtures/old-worker/worker-ef18d06.js) '+oldErr);
    if(OldW){W=OldW;
      await edit(A,'it14',{primaryColor:'pink'});const o1=await measured(A);
      ok(o1.ok&&o1.t.some(x=>x.m==='PUT')&&!o1.t.some(x=>x.m==='POST')&&stored().data.items.find(i=>i.id==='it14').primaryColor==='pink',`against the worker from before, this app syncs the whole backup as before (${kb(o1)})`);
      const o2=await measured(B);
      ok(o2.ok&&(await itemOf(B,'it14')).primaryColor==='pink',`and the other device takes it (${kb(o2)})`);
      W=worker;await edit(B,'it15',{primaryColor:'olive'});const o3=await measured(B),o4=await measured(A);
      ok(o3.ok&&o4.ok&&o3.up+o3.down<100e3&&(await itemOf(A,'it15')).primaryColor==='olive',`back on this worker, a backup the old one stored (no index) still takes the small sync (${kb(o3)}; ${kb(o4)})`);
    }   // (a fixture that didn't load has already failed the check above)

    ok([A,B,C].every(d=>!d.errs.length),'no page errors ('+[A,B,C].flatMap(d=>d.errs).join('; ')+')');
    {const sa=await status(A),sb=await status(B);ok(!sa&&!sb,'no sync failure left on either device'+(sa||sb?` (${sa} | ${sb})`:''))}
  }finally{await browser.close()}

  // a tester's saves count against their daily backups, as the whole-backup saves do; a refused one is given back
  {store.clear();meta.clear();
    const inv=await (await worker.fetch(new Request(HOST+'invites',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({name:'Tess'})}),env)).json();
    for(const k of store.keys())if(k.startsWith('invite:')){const r=JSON.parse(store.get(k));r.created-=8*86400000;store.set(k,JSON.stringify(r))}
    const post=(baseRev,i)=>worker.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':inv.code,'content-type':'application/json'},body:JSON.stringify({baseRev,day:'2026-11-13',delta:{items:[{id:'t'+i,type:'tie',added:1000+i}]}})}),env);
    const verOf=async()=>((await (await worker.fetch(new Request(HOST+'sync?lite=1',{headers:{'x-app-token':inv.code}}),env)).json()).rev);
    ok((await post(99,0)).status===409,'(a conflict first)');
    const st=[];for(let i=0;i<31;i++)st.push((await post(await verOf(),i)).status);
    ok(st.slice(0,30).every(s=>s===200)&&st[30]===429,`a tester's 30 saves a day, conflicts not counted; the 31st is refused (${st.slice(-2).join(', ')})`);
    ok(!store.has('wardrobe:v1')&&[...store.keys()].some(k=>/^u:[^:]+:wardrobe:v1$/.test(k)),'a tester\'s backup is under their own prefix');}
};

/* ---- was tests/inlineswatch.test.js ---- */
// Option A for the server's writes (2026-11-15, the owner's choice): a new item's 128 px swatch is a small JPEG kept inline in the backup
// (sync.js / worker/backup.js PH_MIN 16384), so an item costs one KV write less; records from before (a PNG swatch stored as its own ph:
// value and referenced as dwph:<hash>, sent by an older app) stay readable and are still taken. The real worker.js in Node, this app in
// Chromium; an older app's save is played by posting what it sends.
const inlineswatch=async({ok,chromium,url,ROOT})=>{
  let worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map(),writes=[];
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{writes.push(k);store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const pic=(n,t='jpeg')=>`data:image/${t};base64,`+crypto.randomBytes(Math.round(n*3/4)).toString('base64');
  const hashOf=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,20);
  const T0=Date.now()-86400000,oldSw=pic(5000,'png'),photos=[0,1,2].map(()=>pic(40e3));
  // an older app's first save (PH_MIN was 256): every data string by reference, the small PNG swatch too, sent in photos
  {const items=[0,1,2].map(i=>({id:'it'+i,type:'suit',primaryColor:'navy',pattern:'solid',added:T0+i,photo:'dwph:'+hashOf(photos[i]),swatch:'dwph:'+hashOf(oldSw),swSrc:'tex'}));
    const body={baseRev:0,day:'2026-11-14',delta:{items,days:[],tombstones:{},settings:null},photos:Object.fromEntries([...photos,oldSw].map(s=>[hashOf(s),s]))};
    const r=await worker.fetch(new Request(HOST+'sync',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify(body)}),env);
    ok(r.status===200&&store.has('ph:'+hashOf(oldSw))&&store.get('wardrobe:v1').includes('dwph:'+hashOf(oldSw)),`an older app's save with a small PNG swatch by reference is taken and stored as before (${r.status})`);}
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext();
    await ctx.route(HOST+'**',async route=>{const r=route.request(),u=new URL(r.url());
      if(u.pathname!=='/sync')return route.fulfill({status:404,body:'{}'});
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {p,errs}};
  const itemOf=(d,id)=>d.p.evaluate(id=>items.find(i=>i.id===id)||null,id);
  const stored=()=>JSON.parse(store.get('wardrobe:v1'));
  try{
    const A=await device();
    ok(await A.p.evaluate(()=>syncNow())&&(await itemOf(A,'it1')).swatch===oldSw&&(await itemOf(A,'it1')).photo===photos[1],'this app reads the old record: the referenced PNG swatch (under the new PH_MIN) comes back whole');
    await A.p.evaluate(()=>syncNow());
    // an edit of an old item: its PNG swatch now rides inline; nothing is written but the backup (and the day's copy)
    writes.length=0;
    await A.p.evaluate(async()=>{const it={...items.find(i=>i.id==='it0'),primaryColor:'charcoal'};await put(it);items=items.map(i=>i.id==='it0'?it:i)});
    ok(await A.p.evaluate(()=>syncNow())&&!writes.some(k=>k.startsWith('ph:'))&&stored().data.items.find(i=>i.id==='it0').swatch===oldSw&&store.has('ph:'+hashOf(oldSw)),
      `an edited old item goes up with no photo written (${writes.join(', ')}); its swatch is inline, the old value stays for the clean-up`);
    // a new item: the swatch is cut as a JPEG of a few KB from a real close-up
    const sw=await A.p.evaluate(async()=>{const im=await imgOf('tests/fixtures/blazer-windowpane-closeup.jpg'),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
      const s=cropSwatch(c,1,.5,.5,'#1f2a44');return {s,min:PH_MIN}});
    ok(sw.s.startsWith('data:image/jpeg;base64,')&&sw.s.length<sw.min*.75,`the swatch is a JPEG of ${(sw.s.length/1024).toFixed(1)} KB of text (a PNG was about 38 KB), under PH_MIN (${sw.min})`);
    const np=pic(60e3),nt=pic(70e3);writes.length=0;
    await A.p.evaluate(async([sw,np,nt])=>{const it={id:'new1',type:'suit',primaryColor:'grey',pattern:'solid',added:Date.now(),photo:np,texture:nt,swatch:sw,swSrc:'tex'};await put(it);items=[...items,it]},[sw.s,np,nt]);
    ok(await A.p.evaluate(()=>syncNow())&&writes.filter(k=>k.startsWith('ph:')).length===2&&stored().data.items.find(i=>i.id==='new1').swatch===sw.s&&!store.has('ph:'+hashOf(sw.s)),
      `a new item with a photo and a close-up writes 2 photos and the backup (${writes.join(', ')}), its swatch inline: one write less than before`);
    // another device takes both, the old reference and the inline swatch
    const B=await device();
    ok(await B.p.evaluate(()=>syncNow())&&(await itemOf(B,'new1')).swatch===sw.s&&(await itemOf(B,'it2')).swatch===oldSw&&(await itemOf(B,'new1')).photo===np,'another device gets the inline swatch and the old referenced one');
    // the full backup an older app downloads has both inline
    const full=JSON.parse(await (await worker.fetch(new Request(HOST+'sync',{headers:{'x-app-token':'secret'}}),env)).text());
    ok(full.data.items.find(i=>i.id==='it2').swatch===oldSw&&full.data.items.find(i=>i.id==='new1').swatch===sw.s,'an older app\'s whole download carries both swatches inline');
    // the worker from before (this worker with PH_MIN 256, as main had it), as between the app's deploy and the worker's: it splits the
    // inline swatch out itself, so the save goes through (no 400 missing) and another device still gets it
    {const fs=require('fs'),os=require('os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'dw-ph256-'));fs.mkdirSync(path.join(dir,'worker'));
      fs.copyFileSync(path.join(ROOT,'worker.js'),path.join(dir,'worker.js'));fs.copyFileSync(path.join(ROOT,'merge.js'),path.join(dir,'merge.js'));   // (the merge rules it imports)
      for(const n of fs.readdirSync(path.join(ROOT,'worker')))if(n.endsWith('.js')){let s=fs.readFileSync(path.join(ROOT,'worker',n),'utf8');if(n==='backup.js')s=s.replace('const PH_MIN = 16384,','const PH_MIN = 256,');fs.writeFileSync(path.join(dir,'worker',n),s)}
      ok(/const PH_MIN = 256,/.test(fs.readFileSync(path.join(dir,'worker','backup.js'),'utf8')),'(the worker from before: PH_MIN 256)');
      const Old=(await import(pathToFileURL(path.join(dir,'worker.js')).href)).default;const cur=worker;worker=Old;
      const sw2=sw.s.replace(/.$/,c=>c==='A'?'B':'A'),np2=pic(50e3);writes.length=0;
      await A.p.evaluate(async([sw,np])=>{const it={id:'new2',type:'shirt',primaryColor:'white',pattern:'solid',added:Date.now(),photo:np,swatch:sw,swSrc:'photo'};await put(it);items=[...items,it]},[sw2,np2]);
      const okA=await A.p.evaluate(()=>syncNow()),st=await A.p.evaluate(()=>localStorage.getItem('sync_status'));
      const C=await device();const okC=await C.p.evaluate(()=>syncNow());const got=await itemOf(C,'new2');worker=cur;try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
      ok(okA&&!st&&store.has('ph:'+hashOf(sw2))&&okC&&got&&got.swatch===sw2&&got.photo===np2,`against the worker from before, a new inline swatch is saved (stored separately by it, as before) and read back on another device (${writes.join(', ')})`);}
    ok([A,B].every(d=>!d.errs.length),'no page errors ('+[A,B].flatMap(d=>d.errs).join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/w3fix6.test.js ---- */
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
const w3fix6=async({ok,chromium,url,ROOT})=>{
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
  // (yesterday and today by the server's UTC date: the server takes a phone's day only within a day of its own, so the fixed Nov 15 and
  // Nov 16 of before failed from Nov 18 00:00 UTC on)
  const utcDay=k=>new Date(Date.now()+k*864e5).toISOString().slice(0,10),dY=utcDay(-1),dT=utcDay(0);
  const L1=await (await call('sync?lite=1')).json();
  await call('sync',{method:'POST',body:JSON.stringify({baseRev:L1.rev,baseSaved:L1.saved,day:dY,delta:{items:[{id:'o1',type:'tie',primaryColor:'navy',pattern:'solid',updated:1},{id:'o2',type:'tie',primaryColor:'green',pattern:'solid',updated:1}],days:[],tombstones:{}},photos:{}})});
  const L2=await (await call('sync?lite=1')).json();
  await call('sync',{method:'POST',body:JSON.stringify({baseRev:L2.rev,baseSaved:L2.saved,day:dT,delta:{items:[{id:'o3',type:'tie',primaryColor:'red',pattern:'solid',updated:2}],days:[],tombstones:{}},photos:{}})});
  const sn=(await (await call('sync?snaps=1')).json()).snaps,s16=sn.find(s=>s.id===dT);
  ok(s16&&s16.n===2,`the copy for ${dT} (today, UTC) says it holds 2 items (${JSON.stringify(sn)})`);
  // (the lead's check on final main) a phone whose date is already tomorrow (east of UTC, late evening) still gets that day's copy, listed
  const tmr=new Date(Date.now()+864e5).toISOString().slice(0,10),L3=await (await call('sync?lite=1')).json();
  await call('sync',{method:'POST',body:JSON.stringify({baseRev:L3.rev,baseSaved:L3.saved,day:tmr,delta:{items:[{id:'o4',type:'tie',primaryColor:'green',pattern:'solid',updated:3}],days:[],tombstones:{}},photos:{}})});
  const sn2=(await (await call('sync?snaps=1')).json()).snaps,st=sn2.find(s=>s.id===tmr);
  ok(st&&st.n===3,`a save dated tomorrow (${tmr}) keeps and lists that day's copy, with its 3 items (${JSON.stringify(sn2.map(s=>s.id+':'+s.n))})`);
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
    // a pause ending later today, whatever the hour the test runs: 30 minutes from now, or 23:59 when that would be tomorrow (it was
    // 23:00 today, already past between 23:00 and midnight, so the check failed then); its words are the same minute as the US clock reads it.
    // The pause "tomorrow" is 00:30 tomorrow: at most 24.5 hours off (25.5 over a clock change), as a real pause (next UTC day) never is more
    // than a day; it was 03:00 tomorrow, over 26 hours off between 00:00 and 01:00, which syncPaused lets go as set by a wrong clock
    const pz=await A.evaluate(()=>{const now=new Date(),later=new Date(+now+30*60e3);if(later.getDate()!==now.getDate()){later.setTime(+now);later.setHours(23,59,59,0)}
      const at=later.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});const tom=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,30);
      localStorage.setItem('sync_pause',+later);const a=backupSummary('x');localStorage.setItem('sync_pause',+tom);const b=backupSummary('x');const w=backedUpWords();localStorage.removeItem('sync_pause');return {a,b,w,at,w2:backedUpWords()}});
    const atRe=new RegExp('^Paused until '+pz.at.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s/g,'\\s?'));
    ok(atRe.test(pz.a)&&/^Paused until tomorrow/.test(pz.b),`"Paused until" says the real time when it is today (“${pz.a}” / “${pz.b}”, ${pz.at} expected)`);
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
      const cv=document.createElement('canvas');cv.width=cv.height=8;const cx=cv.getContext('2d');items.forEach((it,k)=>{cx.fillStyle='rgb(40,'+(60+k)+',90)';cx.fillRect(0,0,8,8);it.photo=cv.toDataURL('image/png')});   // real pictures: the real makeSmall runs
      for(const it of items)delete it.photoSm;const n0=await smallPhotos();localStorage.removeItem('remake_day');remakeSpend(7);const n1=await smallPhotos(),made=items.filter(it=>it.photoSm&&it.phSig===phSigOf(it.photo)).length;return {a,b,n0,n1,made}});
    ok(rm.a===10&&rm.b===0&&rm.n0===0&&rm.n1===3&&rm.made===3,`a connected phone remakes at most 10 pictures a day, the rest on the next days (${JSON.stringify(rm)})`);
    ok(!A.errs.length,'no page errors: '+A.errs.join('; '));
    await A.ctx.close();

    // W1-11-05: storage full while a sync brings the wardrobe: the plain sentence in a toast and the status
    const B=await open({});
    const fullR=await B.evaluate(async()=>{const P=IDBObjectStore.prototype,o=P.put;P.put=function(){throw new DOMException('The quota has been exceeded.','QuotaExceededError')};
      // (the lead's re-run on final main: a start-up write had failed a moment before, its toast already replaced by "Connected as …",
      // and saveFailed's once-in-1.5 s skipped the sync's: the sync's own toast is said every time)
      let e1=null;try{await addTombstones({zz:1})}catch(e){e1=e}storeToldAt=Date.now();toast('Connected as Fay');const ok=await syncNow();P.put=o;
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

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['photostore',photostore],['deltasync',deltasync],['inlineswatch',inlineswatch],['w3fix6',w3fix6]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
