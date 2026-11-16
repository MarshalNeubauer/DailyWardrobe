// The owner reads one tester's backup (GET /sync?as=<id>, worker.js ownerAs, 2026-11-16): owner only, GET only, the tester's own
// backup and photos and nobody else's; a tester's code with as= is refused, and so is any write with as=, so nothing of theirs changes.
const path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>{if(!store.has(k))return null;const v=store.get(k);return t==='json'?JSON.parse(typeof v==='string'?v:Buffer.from(v).toString()):v},
    getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
    put:async(k,v,o={})=>{if(v instanceof ArrayBuffer)v=new Uint8Array(v);store.set(k,v);meta.set(k,o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const call=(method,q='',body,tok='secret')=>worker.fetch(new Request(HOST+'sync'+q,{method,headers:{'x-app-token':tok,'content-type':'application/json'},body:body==null?undefined:JSON.stringify(body)}),env);
  const pic=n=>'data:image/jpeg;base64,'+crypto.randomBytes(n).toString('base64'),hashOf=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,20);
  const invite=async name=>(await (await worker.fetch(new Request(HOST+'invites',{method:'POST',headers:{'x-app-token':'secret','content-type':'application/json'},body:JSON.stringify({name})}),env)).json());
  const a=await invite('Tess'),b=await invite('Bo');
  const tp=pic(3000),th=hashOf(tp);
  await call('POST','',{baseRev:0,day:'2026-11-16',delta:{items:[{id:'s1',type:'shirt',primaryColor:'white',added:1,photo:'dwph:'+th}]},photos:{[th]:tp}},a.code);
  await call('POST','',{baseRev:0,day:'2026-11-16',delta:{items:[{id:'b1',type:'tie',primaryColor:'navy',added:1}]},photos:{}},b.code);
  await call('POST','',{baseRev:0,day:'2026-11-16',delta:{items:[{id:'o1',type:'suit',primaryColor:'navy',added:1}]},photos:{}});
  const before=JSON.stringify([...store.entries()].map(([k,v])=>[k,typeof v==='string'?v:Buffer.from(v).toString('base64')]));

  let r=await call('GET','?as='+a.id);const full=JSON.parse(await r.text());
  ok(r.status===200&&full.data&&full.data.items.length===1&&full.data.items[0].id==='s1','the owner reads the tester\'s whole backup with ?as=<id>');
  r=await call('GET','?lite=1&as='+a.id);const lite=await r.json();
  ok(r.status===200&&lite.items&&lite.items.map(i=>i.id).join()==='s1','…and the light form (?lite=1)');
  r=await call('GET','?ph='+th+'&as='+a.id);const ph=await r.json();
  ok(r.status===200&&ph.photos&&ph.photos[th]===tp,'…and the tester\'s photos (?ph=<hash>)');
  r=await call('GET','?lite=1&as='+b.id);
  ok((await r.json()).items.map(i=>i.id).join()==='b1','another tester\'s id gives that tester\'s backup only');
  r=await call('GET','?lite=1');
  ok((await r.json()).items.map(i=>i.id).join()==='o1','without as= the owner still gets their own backup');
  r=await call('GET','?lite=1&as='+b.id,null,a.code);
  ok(r.status===403,'a tester\'s own code with as= is refused (403)');
  r=await call('GET','?lite=1&as=owner!');
  ok(r.status===400,'a malformed id is refused (400)');
  for(const m of ['PUT','POST']){r=await call(m,'?as='+a.id,{baseRev:1,day:'2026-11-16',delta:{items:[]},data:{items:[]}});ok(r.status===405,`${m} with as= is refused (405): reading only`)}
  ok(JSON.stringify([...store.entries()].map(([k,v])=>[k,typeof v==='string'?v:Buffer.from(v).toString('base64')]))===before,'nothing stored changed while reading');
};
