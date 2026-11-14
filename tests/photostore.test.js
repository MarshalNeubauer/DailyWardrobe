// Photos stored once (worker.js, 2026-11-13): the backup keeps its photos by reference ("dwph:<hash>"), each photo once under
// <ns>ph:<hash>, so a save writes a small value and the daily and monthly copies share the photos. Checked on the real worker.js in
// Node against a mocked KV that counts what is written: saves and photo dedupe, the copies and Roll back, an older app's GET and PUT
// (also over 20 MB), the conversion of a backup stored inline (and of one stored with #284's index), account deletion, and the daily
// clean-up, which must never delete a photo the backup or a kept copy refers to.
const path=require('path'),fs=require('fs'),os=require('os'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
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
  const sum=a=>a.reduce((s,w)=>s+w.n,0);
  const kb=n=>(n/1e3).toFixed(1)+' KB';
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const T0=Date.now()-86400000;
  const seed=()=>({items:Array.from({length:24},(_,i)=>({id:'it'+i,type:['suit','shirt','tie','pants'][i%4],primaryColor:'navy',pattern:'solid',added:T0+i,photo:pic(60e3),texture:pic(60e3),swatch:pic(8e3),swSrc:'tex'})),
    days:Array.from({length:20},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,ids:['it0','it1','it2'],worn:true,updated:T0})),tombstones:{},settings:{workdays:[1,2,3,4,5],setupDone:1,updated:T0}});
  const S=seed();S.items[23].photo=S.items[22].photo;   // two items with one photo
  const photoCount=new Set(S.items.flatMap(i=>[i.photo,i.texture,i.swatch])).size;
  const inlineMB=JSON.stringify({rev:5,saved:T0,data:S}).length/1e6;

  // ---- a backup stored inline (by the worker before #284) is converted at its next save
  store.set('wardrobe:v1',JSON.stringify({rev:5,saved:T0,data:S}));meta.set('wardrobe:v1',{rev:5,saved:T0});
  let w0=writes.length;
  const r1=await post({days:[{date:'2026-11-02',ids:['it0','it1','it2'],worn:true,updated:Date.now()}]},{day:'2026-11-02'});
  const v1=store.get('wardrobe:v1'),f1=await full();
  ok(r1.status===200&&meta.get('wardrobe:v1').pv===1&&!v1.includes('base64')&&v1.length<30e3,`a backup stored inline (${inlineMB.toFixed(1)} MB) is converted at its next save: the stored value is ${kb(v1.length)}, photos by reference`);
  ok(phKeys().length===photoCount&&wrote(w0,/^ph:/).length===photoCount&&phKeys().every(k=>{const v=store.get(k);return typeof v==='string'&&hashOf(JSON.parse(v))===k.slice(3)}),`every photo is stored once under ph:<its hash> (${photoCount} photos for ${S.items.length*3} places: two items share one)`);
  ok(same(f1.data.items,S.items)&&f1.data.days.length===21&&f1.rev===6&&!('pv' in f1)&&!('revs' in f1),'the whole backup, rebuilt for an older app, has every photo exactly as it was, and only {rev, saved, data}');
  const snapDay=store.get('snap:2026-11-02');
  ok(snapDay&&meta.get('snap:2026-11-02').pv===1&&snapDay.length<30e3&&same((await full('?snap=2026-11-02')).data,S)&&store.get('snap:2026-11')===snapDay,`the day's copy of the version it replaced is small too (${kb(snapDay.length)}) and comes back whole, photos inline, for Roll back`);

  // ---- an ordinary save writes the small value only
  w0=writes.length;
  const r2=await post({days:[{date:'2026-11-03',ids:['it0','it1','it2'],worn:true,updated:Date.now()}]},{day:'2026-11-02'});
  const ws2=writes.slice(w0);
  ok(r2.status===200&&ws2.length===1&&ws2[0].k==='wardrobe:v1'&&ws2[0].n<30e3,`a day marked worn writes one small value (${ws2.map(w=>w.k+' '+kb(w.n)).join(', ')}), no photo`);
  // a new photo: written once; the same photo on a second item: not again
  const np=pic(70e3),nh=hashOf(np);w0=writes.length;
  const r3=await post({items:[{...S.items[5],photo:'dwph:'+nh,updated:Date.now()}]},{day:'2026-11-02',photos:{[nh]:np}});
  const r3b=await post({items:[{...S.items[6],photo:'dwph:'+nh,updated:Date.now()+1}]},{day:'2026-11-02'});
  ok(r3.status===200&&r3b.status===200&&wrote(w0,/^ph:/).length===1&&store.has('ph:'+nh)&&(await full()).data.items.find(i=>i.id==='it6').photo===np,'a new photo is written once; a second item with the same photo refers to the same one');
  const r3c=await post({items:[{...S.items[7],photo:'dwph:'+'f'.repeat(20),updated:Date.now()}]},{day:'2026-11-02'});
  ok(r3c.status===400&&(await r3c.json()).missing[0]==='f'.repeat(20),'a reference to a photo nobody sent is refused (400 missing), as before');
  const r3d=await call('POST','',{baseRev:1,day:'2026-11-02',delta:{items:[]}});
  ok(r3d.status===409&&(await r3d.json()).rev===meta.get('wardrobe:v1').rev,'a save based on an old version is refused (409) with the current version, as before');
  // a deletion: the tombstone is kept
  await post({tombstones:{it4:Date.now()}},{day:'2026-11-02'});
  ok(!(await full()).data.items.some(i=>i.id==='it4')&&JSON.parse(store.get('wardrobe:v1')).data.tombstones.it4,'a deletion leaves a tombstone in the backup, as before');

  // ---- the next day's copy: small, sharing the photos
  w0=writes.length;
  await post({days:[{date:'2026-11-04',ids:['it0','it1','it2'],worn:true,updated:Date.now()}]},{day:'2026-11-03'});
  const ws4=writes.slice(w0);
  ok(store.has('snap:2026-11-03')&&ws4.length===2&&!wrote(w0,/^ph:/).length&&ws4.every(w=>w.n<30e3),`the next day's first save keeps its copy (${ws4.map(w=>w.k+' '+kb(w.n)).join(', ')}), no photo written again`);
  const lst=await (await call('GET','?snaps=1')).json();
  ok(['2026-11-03','2026-11-02','2026-11'].every(id=>lst.snaps.some(s=>s.id===id)),'the copies are listed as before ('+lst.snaps.map(s=>s.id).join(', ')+')');
  const s3=await full('?snap=2026-11-03');
  ok(s3.data.items.find(i=>i.id==='it6').photo===np&&s3.data.items.find(i=>i.id==='it0').photo===S.items[0].photo,'a copy comes back with the photos it had that day');

  // ---- an older app: GET whole, PUT whole (a photo changed), its 409
  const old=await full();
  const np2=pic(65e3);old.data.items.find(i=>i.id==='it8').photo=np2;old.data.items.find(i=>i.id==='it8').updated=Date.now();
  w0=writes.length;
  const r5=await call('PUT','',{baseRev:old.rev,day:'2026-11-03',data:old.data});
  ok(r5.status===200&&wrote(w0,/^ph:/).length===1&&store.has('ph:'+hashOf(np2))&&meta.get('wardrobe:v1').pv&&store.get('wardrobe:v1').length<30e3,`an older app's whole backup (${kb(JSON.stringify(old).length*1)}) is stored by reference, writing only its one new photo`);
  const r5b=await call('PUT','',{baseRev:1,day:'2026-11-03',data:{items:[]}}),c5=JSON.parse(await r5b.text());
  ok(r5b.status===409&&c5.error==='conflict'&&c5.rev===meta.get('wardrobe:v1').rev&&c5.data.items.find(i=>i.id==='it8').photo===np2&&!('pv' in c5),'its conflict answer is the whole backup, photos inline, as before');
  const lite=await (await call('GET','?lite=1')).json();
  ok(lite.lite===1&&lite.ph.includes(hashOf(np2))&&lite.items.find(i=>i.id==='it8').photo==='dwph:'+hashOf(np2),'this app\'s small sync reads it as before (photos as references, the hashes listed)');
  const phr=await (await call('GET','?ph='+hashOf(np2)+','+nh)).json();
  ok(phr.photos[hashOf(np2)]===np2&&phr.photos[nh]===np,'and downloads photos by hash from their own keys');

  // ---- Roll back: the copy downloaded whole, saved back the way the app does (reason restore), the replaced version kept small
  const before=await full(),back=await full('?snap=2026-11-02');
  const r6=await call('PUT','',{baseRev:before.rev,day:'2026-11-03',reason:'restore',data:{...back.data,settings:{...back.data.settings,updated:Date.now()}}});
  const br=await full('?snap=before-restore');
  ok(r6.status===200&&meta.get('snap:before-restore').pv&&same(br.data,before.data)&&(await full()).data.items.find(i=>i.id==='it6').photo===S.items[6].photo,'Roll back: the copy comes back whole, is saved back, and the version it replaced is kept (small) as before-restore');

  // ---- a whole backup over 20 MB (an older app's large PUT, data last) is stored by reference without being parsed whole
  {const big=await full(),many=Array.from({length:110},(_,i)=>({id:'big'+i,type:'shirt',added:T0+100+i,photo:pic(200e3)}));
    big.data.items.push(...many);const txt=`{"baseRev":${big.rev},"day":"2026-11-03","data":${JSON.stringify(big.data)}}`;
    w0=writes.length;const r7=await call('PUT','',txt);
    ok(txt.length>20*1024*1024&&r7.status===200&&meta.get('wardrobe:v1').pv&&!meta.get('wardrobe:v1').parts&&store.get('wardrobe:v1').length<60e3&&wrote(w0,/^ph:/).length===110,`a ${(txt.length/1e6).toFixed(1)} MB backup is stored as ${kb(store.get('wardrobe:v1').length)} plus its 110 new photos`);
    const g=await full();ok(g.data.items.find(i=>i.id==='big77').photo===many[77].photo&&g.data.items.length===big.data.items.length,'and comes back whole');
    const r7b=await call('PUT','',JSON.stringify({baseRev:meta.get('wardrobe:v1').rev,day:'2026-11-03',data:{...g.data,items:g.data.items.filter(i=>!i.id.startsWith('big'))}}));
    ok(r7b.status===200,'(the large items taken out again)');}

  // ---- the daily clean-up
  const day=86400000,nextGc=(()=>{const d=new Date();d.setUTCHours(23,0,0,0);if(d.getTime()<Date.now())d.setTime(d.getTime()+day);return d.getTime()})();
  const gc=async t=>{const ps=[];await worker.scheduled({scheduledTime:t},env,{waitUntil:p=>ps.push(p)});await Promise.all(ps)};
  const gcDoc=()=>store.has('ph:gc')?JSON.parse(store.get('ph:gc')):null;
  // a photo replaced: the old one stays referred to by the day's copy
  const oldPh=S.items[9].photo,oh=hashOf(oldPh),np3=pic(60e3),h3=hashOf(np3);
  await post({items:[{...(await full()).data.items.find(i=>i.id==='it9'),photo:'dwph:'+h3,updated:Date.now()}]},{day:'2026-11-05',photos:{[h3]:np3}});
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
  await post({items:[{...(await full()).data.items.find(i=>i.id==='it10'),photo:'dwph:'+oh,updated:Date.now()}]},{day:'2026-11-06',photos:{[oh]:oldPh}});
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
      const r8=await post({days:[{date:'2026-11-07',ids:['it0'],worn:true,updated:Date.now()}]},{day:'2026-11-07'});
      ok(lb.lite===1&&r8.status===200&&meta.get('wardrobe:v1').pv&&same((await full()).data.items,s2.items)&&same((await full('?snap=2026-11-07')).data,s2),'a backup stored with #284\'s index is converted at its next save, every photo kept, its copy small and whole');
      store.set('wardrobe:v1',keep[0]);meta.set('wardrobe:v1',keep[1]);
    }else ok(true,'(the worker before this change is not in this clone: skipped)');}

  // ---- a tester: own photos under their prefix; deleting the account deletes them, and nobody else's
  {const inv=await (await worker.fetch(new Request(HOST+'invites',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({name:'Tess'})}),env)).json();
    const tp=pic(40e3),th=hashOf(tp),shared=S.items[0].photo;
    const t1=await call('POST','',{baseRev:0,day:'2026-11-03',delta:{items:[{id:'t1',type:'tie',added:1,photo:'dwph:'+th},{id:'t2',type:'tie',added:2,photo:shared}]},photos:{[th]:tp}},inv.code);
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
