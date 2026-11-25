// The server's smaller fixes from the 2026-11-16 code review (round A, the server), on the real worker.js in Node with mocked KV,
// Durable Objects and outside services: the owner's logs kept whole when testers write at once (CR-6-03), the reminder cron keeping a
// phone that switched on meanwhile (CR-4-03), a large backup that skipped the record check (CR-6-02), backup counts kept on answers that
// saved nothing (CR-6-05), item pictures counted for work that fails (CR-6-06), kept photos stamped ahead and read uncapped (CR-6-07),
// "Delete everything" leaving the masters' setups (CR-6-10), photo links uncounted and SVG taken as a photo (CR-6-11), garbled
// characters (CR-6-09) and the dead routes (CR-6-14).
const path=require('path'),fs=require('fs'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default,realFetch=globalThis.fetch;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const JPG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const world=({ms=0,vapid=null}={})=>{
    const store=new Map(),meta=new Map(),w={store,meta,puts:[]};
    const wait=()=>ms?sleep(ms*(0.5+Math.random())):null;
    const val=(v,t)=>{const tt=typeof t==='object'&&t?t.type:t,s=typeof v==='string'?v:new TextDecoder().decode(v);if(tt==='json')return JSON.parse(s);if(tt==='stream')return new Response(v).body;if(tt==='arrayBuffer')return typeof v==='string'?new TextEncoder().encode(v).buffer:v;return s};
    w.KV={get:async(k,t)=>{await wait();return store.has(k)?val(store.get(k),t):null},
      getWithMetadata:async(k,t)=>{await wait();return {value:store.has(k)?val(store.get(k),t):null,metadata:meta.get(k)||null}},
      put:async(k,v,o)=>{await wait();w.puts.push(k);store.set(k,v instanceof ArrayBuffer?v:typeof v==='string'?v:new TextDecoder().decode(v));meta.set(k,o&&o.metadata)},
      delete:async k=>{await wait();store.delete(k);meta.delete(k)},
      list:async({prefix=''}={})=>{await wait();return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name)})),list_complete:true}}};
    const hubs=new Map();w.hubOf=n=>{if(!hubs.has(n)){const st=new Map();hubs.set(n,{st,h:new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},delete:async k=>{st.delete(k)},deleteAll:async()=>st.clear()}},{})})}return hubs.get(n)};
    w.env={APP_TOKEN:'own',OPENAI_API_KEY:'k',WARDROBE:w.KV,RENDER_HUB:{idFromName:x=>x,get:n=>({fetch:async(u,i)=>{await wait();return w.hubOf(n).h.fetch(new Request(u,i))}})},RENDER_QUEUE:{send:async()=>{}},...(vapid||{})};
    w.call=async(p,o={},tok='own')=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:o.method||'GET',headers:{'x-app-token':tok,'content-type':'application/json'},body:o.body}),w.env);const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}return {s:r.status,j,t}};
    w.tester=async name=>{const j=(await w.call('invites',{method:'POST',body:JSON.stringify({name})})).j;for(const [k,v] of store)if(k.startsWith('invite:')&&v.includes(j.id)){const r=JSON.parse(v);r.created-=8*864e5;store.set(k,JSON.stringify(r))}return {...j,ns:`u:${j.id}:`}};
    w.used=async id=>(await (await w.hubOf('renders:u:'+id+':').h.fetch(new Request('https://hub/used?day='+new Date().toISOString().slice(0,10)))).json()).used;
    return w};
  try{
    // ---- CR-6-03: feedback and error reports from three testers at the same moment, KV at 15 ms a call: all kept, no KV write
    {const w=world({ms:15}),t=[];for(const n of ['A','B','C'])t.push(await w.tester(n));
      w.store.set('feedback:log',JSON.stringify({items:[{t:Date.now()-864e5,id:'old',name:'Earlier',text:'from before',version:'1',where:'x'}]}));
      w.puts.length=0;
      const fb=await Promise.all(t.map((x,i)=>w.call('feedback',{method:'POST',body:JSON.stringify({text:'message '+i,version:'9',where:'today'})},x.code)));
      const er=await Promise.all(t.map((x,i)=>w.call('errors',{method:'POST',body:JSON.stringify({errs:[{t:Date.now(),m:'error '+i,at:'a.js:1'}]})},x.code)));
      const F=(await w.call('feedback')).j.items,E=(await w.call('errors')).j.items;
      ok(fb.every(r=>r.s===200)&&er.every(r=>r.s===200)&&['message 0','message 1','message 2'].every(m=>F.some(x=>x.text===m))&&E.length===3,`three testers' feedback and error reports sent at once are all kept (${F.length-1} of 3 messages, ${E.length} of 3 reports; one KV document kept 1 of 3)`);
      ok(F.some(x=>x.text==='from before'&&x.name==='Earlier')&&F[0].text!=='from before','feedback kept in the KV document before still shows, newest first');
      ok(!w.puts.length,`sending them makes no KV write (${w.puts.join(',')||'none'}): the logs object keeps them`);
      ok((await w.call('feedback',{},t[0].code)).s===403&&(await w.call('errors',{},t[0].code)).s===403,'only the owner reads them');
      await w.call('invites?id='+t[1].id+'&purge=1',{method:'DELETE'});
      const F2=(await w.call('feedback')).j.items,E2=(await w.call('errors')).j.items;
      ok(!F2.some(x=>x.text==='message 1')&&F2.some(x=>x.text==='message 0')&&!E2.some(x=>x.m==='error 1')&&E2.length===2,'a tester deleted with everything takes their feedback and error reports along, and nobody else\'s');
      const d=await w.call('account',{method:'DELETE',body:JSON.stringify({confirm:'delete'})});
      ok(d.s===200&&(await w.call('feedback')).j.items.length===F2.length,'the owner\'s "Delete everything" keeps the feedback, as it always did');}
    // ---- CR-4-03: a phone switching its reminder on while the cron is pushing is not dropped by the cron's write
    {const b64u=b=>Buffer.from(b).toString('base64url'),kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
      const jwk=await crypto.subtle.exportKey('jwk',kp.privateKey),raw=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey));
      const w=world({vapid:{VAPID_PUBLIC_KEY:b64u(raw),VAPID_PRIVATE_KEY:jwk.d,VAPID_SUBJECT:'https://app.test/'}});
      let release,pushes=0;const gate=new Promise(r=>release=r);
      globalThis.fetch=async u=>{if(/web\.push\.apple\.com/.test(String(u))){pushes++;await gate;return new Response(null,{status:/gone/.test(String(u))?410:201})}throw new Error('no network in tests')};
      const at='2026-11-15T04:00:00Z';   // 07:00 in Kuwait
      for(const p of ['phoneA','gone'])await w.call('push',{method:'POST',body:JSON.stringify({endpoint:'https://web.push.apple.com/'+p,time:'07:00',tz:'Asia/Kuwait',dates:['2026-11-15']})});
      const work=[];await worker.scheduled({scheduledTime:Date.parse(at)},w.env,{waitUntil:p=>work.push(p)});await sleep(30);
      const b=await w.call('push',{method:'POST',body:JSON.stringify({endpoint:'https://web.push.apple.com/phoneB',time:'08:00',tz:'Asia/Kuwait',dates:['2026-11-15']})});
      const c=await w.call('push',{method:'POST',body:JSON.stringify({endpoint:'https://web.push.apple.com/phoneA',time:'07:30',tz:'Asia/Kuwait',dates:['2026-11-15']})});
      release();await Promise.all(work);globalThis.fetch=realFetch;
      const list=JSON.parse(w.store.get('push:subs')).list,by=e=>list.find(x=>x.endpoint.endsWith('/'+e));
      ok(b.s===200&&pushes===2&&by('phoneB')&&!by('gone'),`a phone that switched on while the cron was pushing keeps its reminder; a subscription the push service calls gone is dropped (${list.map(x=>x.endpoint.split('/').pop()).join(',')})`);
      ok(c.s===200&&by('phoneA').time==='07:30'&&by('phoneA').last==null,`a phone that changed its time meanwhile keeps the new time, and today's 07:30 is still to come (${by('phoneA').time}, last ${by('phoneA').last})`);}
    // ---- CR-6-02 and CR-6-05: a tester's large PUT whose photos can't be cut out is refused, and nothing that saved nothing uses a backup
    {const w=world(),t=await w.tester('Big'),day=new Date().toISOString().slice(0,10);
      const bad={id:'"><img src=x onerror=alert(1)>',type:'tie',primaryColor:'navy',updated:1};
      const big='{"baseRev":0,"day":'+JSON.stringify(day)+',"data":'+JSON.stringify({items:[bad,{id:'pad',type:'tie',notes:'x'.repeat(21*1024*1024),updated:1}],days:[],tombstones:{}})+'}';
      w.puts.length=0;const r=await w.call('sync',{method:'PUT',body:big},t.code);
      ok(r.s===413&&!w.puts.length&&!w.store.has(t.ns+'wardrobe:v1'),`a 21 MB backup with no photo to cut out is refused (${r.s}), nothing written: it was stored in parts past the record check and the write cap`);
      const codes=[];for(let i=0;i<30;i++)codes.push((await w.call('sync',{method:'PUT',body:'{"baseRev":0,"day":"'+day+'","data":{"items":['},t.code)).s);
      const real=await w.call('sync',{method:'POST',body:JSON.stringify({baseRev:0,day,delta:{items:[{id:'a1',type:'tie',primaryColor:'navy',pattern:'solid',updated:1}],days:[],tombstones:{}},photos:{}})},t.code);
      const u=await w.used(t.id);
      ok(codes.every(c=>c===400)&&real.s===200&&u.backup===1,`30 cut-off uploads (400) use none of the tester's 30 backups: the next real save goes through (${real.s}, backups used ${u.backup})`);}
    // ---- CR-6-06: an item picture with a photo that isn't one, or no key to keep it under: refused before anything is counted or paid
    {const w=world(),t=await w.tester('Pics');let openai=0;
      globalThis.fetch=async u=>{if(String(u).startsWith('https://api.openai.com/')){openai++;return new Response(JSON.stringify({data:[{b64_json:JPG.split(',')[1]}]}),{headers:{'content-type':'application/json'}})}throw new Error('no network in tests')};
      const a=await w.call('render',{method:'POST',body:JSON.stringify({mode:'item',item:'a black belt',key:'c0000000000000001',ref:'data:image/jpeg;base64,@@'})},t.code);
      const b=await w.call('render',{method:'POST',body:JSON.stringify({mode:'item',item:'a black belt'})},t.code);
      const u=await w.used(t.id);
      const c=await w.call('render',{method:'POST',body:JSON.stringify({mode:'item',item:'a black belt',key:'c0000000000000001'})},t.code);
      globalThis.fetch=realFetch;
      ok(a.s===400&&b.s===400&&!u.item&&!u.write&&openai===1&&c.s===200&&w.store.has(t.ns+'render:c0000000000000001'),`a photo that isn't one (${a.s}) and a missing key (${b.s}) are refused before OpenAI and before the counts (item ${u.item||0}, write ${u.write||0}); a good one is made and kept`);}
    // ---- CR-6-07: a kept photo stamped ahead by a wrong clock can be replaced; a body over 4 MB is not read past the cap
    {const w=world(),K='c0000000000000002',rec=t=>JSON.stringify({key:K,rec:{img:JPG,sig:'s'+t,model:'m',t}});
      const ahead=Date.now()+5*365*864e5;
      const r1=await w.call('render',{method:'PUT',body:rec(ahead)});const kept=JSON.parse(w.store.get('render:'+K)).t;
      const r2=await w.call('render',{method:'PUT',body:rec(Date.now())});
      w.store.set('render:'+K,JSON.stringify({sig:'old',img:JPG,model:'m',t:ahead}));
      const r3=await w.call('render',{method:'PUT',body:rec(Date.now())});
      ok(r1.s===200&&kept<=Date.now()+11*6e4&&r2.s===200&&JSON.parse(w.store.get('render:'+K)).sig.startsWith('s')&&r3.s===200&&JSON.parse(w.store.get('render:'+K)).sig!=='old',`a photo stamped five years ahead is kept as stamped now (${new Date(kept).toISOString()}), and one kept so from before is replaced by the next upload`);
      const huge=await w.call('render',{method:'PUT',body:JSON.stringify({key:K,rec:{img:'data:image/jpeg;base64,'+'A'.repeat(5e6),t:1}})});
      ok(huge.s===413,`an upload over 4 MB is refused (${huge.s})`);}
    // ---- CR-6-10: the owner's "Delete everything" takes the masters' packed setups and their list too
    {const w=world();w.store.set('blob:c0000000000000003',new ArrayBuffer(8));w.store.set('cm:shared',JSON.stringify({keys:['c0000000000000003'],t:1}));w.store.set('render:c0000000000000003','{}');
      const d=await w.call('account',{method:'DELETE',body:JSON.stringify({confirm:'delete'})});
      ok(d.s===200&&!w.store.has('blob:c0000000000000003')&&!w.store.has('cm:shared')&&!w.store.has('render:c0000000000000003'),'"Delete everything" (the owner) deletes blob: and cm:shared with the rest');}
    // ---- CR-6-11: a tester's photo links are counted, and only photo types come back
    {const w=world(),t=await w.tester('Links');
      globalThis.fetch=async u=>{u=String(u);if(u==='https://store.test/a.jpg')return new Response(Buffer.from(JPG.split(',')[1],'base64'),{headers:{'content-type':'image/jpeg'}});
        if(u==='https://store.test/x.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',{headers:{'content-type':'image/svg+xml'}});throw new Error('no network in tests')};
      const f=(u,tok=t.code)=>w.call('fetch?url='+encodeURIComponent(u),{},tok);
      const svg=await f('https://store.test/x.svg');
      let n=1,st=200;for(;n<120&&st===200;n++)st=(await f('https://store.test/a.jpg')).s;
      const last=await f('https://store.test/a.jpg'),own=await f('https://store.test/a.jpg','own');
      globalThis.fetch=realFetch;
      ok(svg.s===415&&/not a photo/.test(svg.j.error),`an SVG is not taken as a photo (${svg.s} ${svg.j.error})`);
      ok(st===429&&n===101&&/limit of 100 photo links is used up/.test(last.j.error)&&own.s===200,`a tester's photo links are counted, 100 a day, refused in words the app shows (${n}: ${last.j.error}); the owner's are not`);}
    // ---- CR-6-14: the routes nothing asks for are gone; GET /blob and GET /render?day= (older apps in the field still ask) stay
    {const w=world();w.store.set('blob:c0000000000000004',new Uint8Array([1,2]).buffer);w.store.set('render:2026-11-08',JSON.stringify({sig:'d',img:JPG,t:1}));
      const pb=await w.call('blob?key=c0000000000000004',{method:'PUT',body:'x'}),dr=await w.call('render?key=c0000000000000004',{method:'DELETE'});
      const gb=await w.call('blob?key=c0000000000000004'),gd=await w.call('render?day=2026-11-08'),pd=await w.call('render',{method:'PUT',body:JSON.stringify({day:'2026-11-09',rec:{img:JPG,t:1}})});
      ok(pb.s===405&&dr.s===405&&gb.s===200&&gd.s===200&&gd.j.sig==='d'&&pd.s===400&&!w.store.has('render:2026-11-09'),`PUT /blob and DELETE /render answer 405; a kept blob and a photo kept per date are still read; nothing is written per date (${pb.s} ${dr.s} ${gb.s} ${gd.s} ${pd.s})`);}
    // ---- CR-6-09: no garbled characters (UTF-8 read as Windows-1252) in the server's files
    {const files=['worker.js',...fs.readdirSync(path.join(ROOT,'worker')).filter(f=>f.endsWith('.js')).map(f=>'worker/'+f)];
      const bad=files.filter(f=>/â€|â†|Ã[ -¿]/.test(fs.readFileSync(path.join(ROOT,f),'utf8')));
      ok(!bad.length,`no garbled characters in worker.js and worker/*.js (${bad.join(', ')||files.length+' files'})`);}
  }finally{globalThis.fetch=realFetch}
};
