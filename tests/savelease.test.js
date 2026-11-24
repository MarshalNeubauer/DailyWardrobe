// A save longer than the save lock's lease (the 2026-11-24 review's R6 N1). The lock (CR-6-01, tests/savelock.test.js) is a lease of
// LOCK_MS (30 s): a save that ran past it (a first or converting save of a few hundred photos, each its own KV put) let a second save in,
// both were answered rev N+1 and the backup kept only one phone's change. Now a save checks it still holds the lease before it writes the
// backup (and its daily copies), and renews it while it writes photos. The real worker.js in Node, a KV in memory and a RenderHub per name
// as savelock builds them; time is moved on with Date.now (the hub's lease reads the same clock). Each phone does what sync.js does: on a
// 409 it asks again since its version and posts again.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default,realNow=Date.now;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let skew=0;Date.now=()=>realNow()+skew;
  const world=()=>{
    const store=new Map(),meta=new Map(),w={store,meta,puts:[],hubReq:{},onPhoto:null};
    const val=(v,t)=>{const tt=typeof t==='object'&&t?t.type:t;if(tt==='json')return JSON.parse(v);if(tt==='stream')return new Response(v).body;if(tt==='arrayBuffer')return new TextEncoder().encode(v).buffer;return v};
    w.KV={get:async(k,t)=>{await sleep(1);return store.has(k)?val(store.get(k),t):null},
      getWithMetadata:async(k,t)=>{await sleep(1);return {value:store.has(k)?val(store.get(k),t):null,metadata:meta.get(k)||null}},
      // a photo's put: what the scene says happens meanwhile (time passing, another phone saving)
      put:async(k,v,o)=>{await sleep(1);if(/ph:[0-9a-f]{20}$/.test(k)&&w.onPhoto)await w.onPhoto(k);w.puts.push(k);store.set(k,typeof v==='string'?v:new TextDecoder().decode(v));meta.set(k,o&&o.metadata)},
      delete:async k=>{store.delete(k);meta.delete(k)},
      list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
    const hubs=new Map();w.hubOf=n=>{if(!hubs.has(n)){const st=new Map();hubs.set(n,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},delete:async k=>{st.delete(k)},deleteAll:async()=>st.clear()}},{}))}return hubs.get(n)};
    w.env={APP_TOKEN:'own',WARDROBE:w.KV,RENDER_HUB:{idFromName:x=>x,get:n=>({fetch:async(u,i)=>{const r=new Request(u,i),p=new URL(u).pathname;let op='';try{op=(await r.clone().json()).op||''}catch{}w.hubReq[p+(op?':'+op:'')]=(w.hubReq[p+(op?':'+op:'')]||0)+1;return w.hubOf(n).fetch(r)}})}};
    w.call=async(p,o={})=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:o.method||'GET',headers:{'x-app-token':'own','content-type':'application/json'},body:o.body}),w.env);const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}return {s:r.status,j}};
    return w};
  const day=new Date(realNow()).toISOString().slice(0,10);
  const pic=c=>'data:image/jpeg;base64,'+c.repeat(20000);
  const tie=(id,extra={})=>({id,type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:Date.now(),...extra});
  const post=(w,base,items)=>w.call('sync',{method:'POST',body:JSON.stringify({baseRev:base.rev,baseSaved:base.saved,day,delta:{items,days:[],tombstones:{}},photos:{}})});
  const phone=async(w,base,items)=>{const answers=[];for(let a=0;a<6;a++){const p=await post(w,base,items);answers.push(p.s);if(p.s!==409)return {...p,answers};base=(await w.call('sync?lite=1&since='+encodeURIComponent(base.rev+':'+base.saved))).j}return {s:0,answers}};
  const held=async w=>{const a=(await w.call('sync?lite=1')).j;return {rev:a.rev,ids:a.items.map(i=>i.id).sort()}};
  try{
    // ---- one photo put that takes longer than the lease (31 s): phone B saves meanwhile
    {const w=world();await post(w,{rev:0,saved:0},[tie('first')]);const L=(await w.call('sync?lite=1')).j;
      let b=null;w.onPhoto=async()=>{w.onPhoto=null;skew+=31e3;b=await phone(w,L,[tie('phoneB')])};
      const a=await phone(w,L,[tie('phoneA',{photo:pic('A')})]);skew=0;
      const h=await held(w);
      ok(h.ids.join()==='first,phoneA,phoneB',`a save whose photo write outlasts the lease while another phone saves: both changes are in the backup (${h.ids.join(',')} at rev ${h.rev}; phone A answered ${a.answers.join(',')}, phone B ${b&&b.answers.join(',')})`);
      ok(a.answers[0]===409&&a.s===200&&b&&b.s===200,'the save that lost its lease is answered 409 (the app asks again), not 200 with its write over the other phone\'s');}
    // ---- a long photo loop (12 photos, 8 s each, 96 s in all): the lease is renewed, so phone B waits its turn instead of coming in
    {const w=world();await post(w,{rev:0,saved:0},[tie('first')]);const L=(await w.call('sync?lite=1')).j;
      let n=0,b=null,bp=null;w.onPhoto=async()=>{skew+=8e3;if(++n===3)bp=phone(w,L,[tie('phoneB')]).then(r=>b=r)};
      const many=Array.from({length:12},(_,i)=>tie('a'+String(i).padStart(2,'0'),{photo:pic(String.fromCharCode(65+i))}));
      const a=await phone(w,L,many);w.onPhoto=null;await bp;skew=0;
      const h=await held(w);
      ok(h.ids.length===14&&h.ids.includes('phoneB')&&many.every(x=>h.ids.includes(x.id)),`a save writing photos for 96 s keeps its lease: the other phone's save and all 12 pieces are in the backup (${h.ids.length} pieces at rev ${h.rev}; A answered ${a.answers.join(',')}, B ${b&&b.answers.join(',')})`);
      ok(a.answers.join()==='200'&&(w.hubReq['/lock:hold']||0)>=3,`the long save went through at its first try, renewing its lease as it wrote (${w.hubReq['/lock:hold']||0} renewals)`);}
    // ---- an older app's whole PUT whose photo write outlasts the lease
    {const w=world();await post(w,{rev:0,saved:0},[tie('first')]);const L=(await w.call('sync?lite=1')).j;
      let b=null;w.onPhoto=async()=>{w.onPhoto=null;skew+=31e3;b=await phone(w,L,[tie('phoneB')])};
      const full=async it=>{const out=[];for(let a=0;a<6;a++){const g=(await w.call('sync')).j;const r=await w.call('sync',{method:'PUT',body:JSON.stringify({baseRev:g.rev,day,data:{...g.data,items:[...g.data.items,it]}})});out.push(r.s);if(r.s!==409)return {...r,out}}return {s:0,out}};
      const a=await full(tie('oldApp',{photo:pic('O')}));skew=0;
      const h=await held(w);
      ok(h.ids.join()==='first,oldApp,phoneB',`an older app's PUT that outlasts the lease: both changes kept (${h.ids.join(',')}; PUT answered ${a.out.join(',')}, phone B ${b&&b.answers.join(',')})`);}
    // ---- an ordinary save costs what it did: no renewal, the same KV writes, two requests to the hub
    {const w=world();await post(w,{rev:0,saved:0},[tie('first')]);const L=(await w.call('sync?lite=1')).j;w.puts.length=0;w.hubReq={};
      const r=await post(w,L,[tie('x',{photo:pic('X')}),tie('y',{photo:pic('Y')})]);
      ok(r.s===200&&w.puts.length===5&&!w.hubReq['/lock:hold']&&w.hubReq['/lock:take']===1&&w.hubReq['/lock:give']===1,`a quick save makes no renewal: 5 KV puts (2 photos, the day's 2 copies, the backup) and 2 hub requests (${w.puts.length} puts, hub ${JSON.stringify(w.hubReq)})`);}
    // ---- the hub: a renewal is the holder's only, and a lock taken over is never renewed
    {const w=world(),hub=w.hubOf('t');const q=b=>hub.fetch(new Request('https://hub/lock',{method:'POST',body:JSON.stringify(b)})).then(r=>r.json());
      const t=await q({op:'take'}),wrong=await q({op:'hold',tok:'nope'}),mine=await q({op:'hold',tok:t.tok});
      skew+=31e3;const t2=await q({op:'take'}),late=await q({op:'hold',tok:t.tok});await q({op:'give',tok:t2.tok});const gone=await q({op:'hold',tok:t.tok});skew=0;
      ok(t.ok&&!wrong.ok&&mine.ok&&t2.ok&&!late.ok&&!gone.ok,`only the holder renews; once another save took the lock, or it was given back, the first holder's renewal is refused (${[wrong.ok,mine.ok,late.ok,gone.ok].join(',')})`);}
  }finally{Date.now=realNow}
};
