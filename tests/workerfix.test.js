// The server's reliability fixes from the 2026-11-13 audit (worker.js only, mocked bindings, no network): an uncaught error answers
// a JSON 503 the app can read; preflights are cached; only POST / tags; reminders across midnight and the clocks going forward;
// time limits and dead links; the Workers AI fallback gives a tester's count back; the token is checked before a big body is read.
const path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;
  const kv=(o={})=>{const store=new Map(),meta=new Map();return {store,
    get:async(k,t)=>store.has(k)?((t==='json'||(t&&t.type==='json'))?JSON.parse(store.get(k)):store.get(k)):null,
    put:async(k,v,x)=>{if(o.failPut&&o.failPut(k))throw new Error('KV put() limit exceeded for the day.');store.set(k,typeof v==='string'?v:new TextDecoder().decode(v));if(x&&x.metadata)meta.set(k,x.metadata)},
    delete:async k=>{store.delete(k)},list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})}};
  const hubs=new Map(),HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>st.clear()}},{}))}return hubs.get(name).fetch(new Request(u,init))}})};
  const HOST='https://w.test/';
  const call=(env,method,p,body,h={})=>worker.fetch(new Request(HOST+p,{method,headers:{'content-type':'application/json',...h},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}),env);
  const J=async r=>({s:r.status,h:r.headers,...(await r.clone().json().catch(()=>({})))});
  try{
    // ---- an uncaught error (KV over its daily writes) answers a readable 503 with the CORS headers, not Cloudflare's error 1101
    {const env={APP_TOKEN:'t',WARDROBE:kv({failPut:()=>true}),ALLOWED_ORIGIN:'https://a.github.io'};
      let r,threw=null;try{r=await J(await call(env,'PUT','render',{key:'c0123456789abcdef',rec:{img:'data:image/jpeg;base64,AAAA',t:1}},{'x-app-token':'t',Origin:'https://a.github.io'}))}catch(e){threw=e}
      ok(!threw&&r.s===503&&r.h.get('access-control-allow-origin')==='https://a.github.io'&&/Try again/.test(r.message)&&r.h.get('content-type')==='application/json','a storage failure inside a route answers JSON 503 with CORS headers (the app shows a reason, not "Failed to fetch")');
      const o=await worker.fetch(new Request(HOST+'sync',{method:'OPTIONS',headers:{Origin:'https://a.github.io'}}),env);
      ok(o.headers.get('access-control-max-age')==='7200','preflight answers are cached for 2 hours (Access-Control-Max-Age: 7200)');}
    // ---- only POST / tags; any other unknown address is 404
    {let ai=0;const env={APP_TOKEN:'t',AI:{run:async()=>{ai++;return {response:'{"type":"tie"}'}}}},T={'x-app-token':'t'};
      const a=await call(env,'POST','holidayz',{image:PNG},T),b=await call(env,'GET','nothing',undefined,T),c=await call(env,'GET','tag-many',undefined,T),d=await call(env,'GET','',undefined,T);
      ok(a.status===404&&b.status===404&&ai===0,`a POST to an unknown address is not read as a photo (${a.status}, AI calls ${ai}) and an unknown GET is 404 (${b.status})`);
      ok(c.status===405&&d.status===405,'a known address with the wrong method is 405');
      const e=await J(await call(env,'POST','',{image:PNG},T));ok(e.s===200&&e.type==='tie'&&ai===1,'POST / still tags');}
    // ---- the token is checked before the body is read; the body's appToken is no longer taken
    {let read=false;const env={APP_TOKEN:'t',AI:{run:async()=>({response:'{"type":"tie"}'})}};
      const body=new ReadableStream({pull(c){read=true;c.enqueue(new TextEncoder().encode(JSON.stringify({image:PNG,appToken:'t'})));c.close()}},{highWaterMark:0});
      const r=await worker.fetch(new Request(HOST,{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'}),env);
      ok(r.status===403&&!read,'POST / without the token header is refused before its body is read (a body token alone no longer counts)');}
    // ---- the Workers AI fallback: its template asks for every field; a failure gives the tester's count back; 'agree' can't crash it
    {const store=kv(),env={APP_TOKEN:'own',WARDROBE:store,RENDER_HUB:HUB,AI:null};let mode='fail',runs=[];
      env.AI={run:async(m,i)=>{runs.push(i.prompt||'tag');if(mode==='fail')throw new Error('model overloaded');if(mode==='gate'){if(i.prompt==='agree')throw new Error('agree failed');throw new Error('5016: agree to the licence')}
        return {response:'{"type":"pants","trouserKind":"chinos"}'}}};
      const inv=await J(await call(env,'POST','invites',{name:'Tess'},{'x-app-token':'own'})),T={'x-app-token':inv.code};
      const used=async()=>(await J(await call(env,'GET','me',undefined,T))).used.tag;
      let r=await call(env,'POST','',{image:PNG},T);ok(r.status===502&&await used()===0,'a Workers AI failure gives the tester\'s tag count back');
      mode='gate';runs=[];let threw=null;try{r=await call(env,'POST','',{image:PNG},T)}catch(e){threw=e}
      ok(!threw&&r.status===502&&runs.includes('agree')&&await used()===0,'a failing licence acceptance (AI.run "agree") answers 502 and refunds, instead of throwing');
      mode='ok';let sent=null;env.AI.run=async(m,i)=>{sent=i.messages[1].content[0].text;return {response:'{"type":"pants","trouserKind":"chinos"}'}};
      r=await J(await call(env,'POST','',{image:PNG},T));ok(r.s===200&&r.trouserKind==='chinos'&&await used()===1,'a good answer counts once');
      ok(/"trouserKind":"\.\.\.","shoeStyle":"\.\.\."/.test(sent||''),'the JSON template Workers AI gets includes trouserKind and shoeStyle');}
    // ---- item pictures have a time limit like outfit photos
    {let sig=null;globalThis.fetch=async(u,i)=>{if(String(u).startsWith('https://api.openai.com/')){sig=i&&i.signal;return new Response(JSON.stringify({data:[{b64_json:'AAAA'}]}),{status:200})}return new Response('',{status:599})};
      const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:kv()};
      const r=await call(env,'POST','render',{mode:'item',item:'brown suede loafers',key:'c0000000000000001'},{'x-app-token':'t'});
      ok(r.status===200&&sig&&typeof sig.aborted==='boolean','an item picture\'s call to OpenAI has a time limit');
      globalThis.fetch=async()=>{const e=new Error('The operation was aborted due to timeout');e.name='TimeoutError';throw e};
      const t=await J(await call(env,'POST','render',{mode:'item',item:'brown suede loafers',key:'c0000000000000002'},{'x-app-token':'t'}));
      ok(t.s===502&&/over 5 minutes/.test(t.error),'and says so when it runs out');}
    // ---- a link to a dead domain answers a plain 502, not an uncaught error
    {globalThis.fetch=async()=>{throw new TypeError('fetch failed: getaddrinfo ENOTFOUND shop.example')};
      const r=await J(await call({APP_TOKEN:'t'},'GET','fetch?url='+encodeURIComponent('https://shop.example/p.jpg'),undefined,{'x-app-token':'t'}));
      ok(r.s===502&&/could not be reached/.test(r.error),`a link that can't be reached answers 502 with a reason (${r.s})`);}
    // ---- reminders: every time of day fires once, across midnight and where the clocks go forward or back
    {const kp=await crypto.webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
      const jwk=await crypto.webcrypto.subtle.exportKey('jwk',kp.privateKey),raw=new Uint8Array(await crypto.webcrypto.subtle.exportKey('raw',kp.publicKey));
      let sent=0;globalThis.fetch=async()=>{sent++;return new Response('',{status:201})};
      const fires=async(time,tz,date,from,hours)=>{const store=kv();store.store.set('push:subs',JSON.stringify({list:[{id:'x',ns:'',endpoint:'https://push.test/a',time,tz,dates:[date],last:null}]}));
        const env={WARDROBE:store,VAPID_PUBLIC_KEY:Buffer.from(raw).toString('base64url'),VAPID_PRIVATE_KEY:jwk.d};sent=0;const at=[];
        for(let t=Date.parse(from);t<Date.parse(from)+hours*3600e3;t+=15*60e3){const s0=sent,ps=[];await worker.scheduled({scheduledTime:t},env,{waitUntil:p=>ps.push(p)});await Promise.all(ps);if(sent>s0)at.push(new Date(t).toISOString().slice(11,16))}
        return at};
      const never=[];for(let hm=0;hm<1440;hm+=7){const time=String(Math.floor(hm/60)).padStart(2,'0')+':'+String(hm%60).padStart(2,'0');const a=await fires(time,'Asia/Kuwait','2026-11-15','2026-11-14T18:00:00Z',36);if(a.length!==1)never.push(time+'×'+a.length)}
      ok(!never.length,`every reminder time fires exactly once on its date, 23:46-23:59 included (${never.slice(0,6).join(' ')||'all'})`);
      const late=await fires('23:50','Asia/Kuwait','2026-11-15','2026-11-15T18:00:00Z',8);
      ok(late.join()==='21:00','a 23:50 reminder goes at the 23:45-00:00 run (21:00 UTC in Kuwait)');
      const dst=await fires('02:30','America/New_York','2027-03-14','2027-03-14T00:00:00Z',24);
      ok(dst.length===1&&dst[0]==='07:00',`where the clocks go forward (New York, 14 Mar 2027) a reminder in the skipped hour still fires, once (${dst.join()})`);
      const back=await fires('01:30','America/New_York','2026-11-01','2026-11-01T00:00:00Z',24);
      ok(back.length===1,`where they go back the repeated hour sends it once (${back.join()})`);}
    // ---- no duplicate paid photos: a queued job is made once, whatever is delivered twice or fails after OpenAI answered
    {let openai=0,delay=0;globalThis.fetch=async u=>{if(String(u).startsWith('https://api.openai.com/')){openai++;if(delay)await new Promise(r=>setTimeout(r,delay));return new Response(JSON.stringify({data:[{b64_json:'AAAA'}]}),{status:200})}return new Response('',{status:599})};
      const mk=o=>{const store=kv(o),sent=[];hubs.clear();return {store,sent,env:{APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:store,RENDER_QUEUE:{send:async m=>{sent.push(m)}},RENDER_HUB:HUB}}};
      const T={'x-app-token':'t'},msg=(body,attempts=1)=>({body,attempts,acked:false,retried:null,ack(){this.acked=true},retry(o){this.retried=o}});
      const queueIt=(env,key,x={})=>call(env,'POST','render',{mode:'queue',key,image:PNG,...x},T);
      // the photo is made, then keeping it fails (KV over its writes): acked, never retried; a copy of the message does nothing
      {const {store,sent,env}=mk({failPut:k=>k.startsWith('render:')}),K='c00000000000000a1';openai=0;
        await queueIt(env,K);const w=call(env,'GET','render-wait?keys='+K+'&ms=5000',undefined,T);await new Promise(r=>setTimeout(r,20));
        const m1=msg(sent[0]);await worker.queue({messages:[m1]},env);const got=await (await w).json();
        const m2=msg(sent[0],2);await worker.queue({messages:[m2]},env);
        ok(openai===1&&m1.acked&&!m1.retried&&m2.acked&&!m2.retried,`a photo made but not kept: acked, and a second delivery does nothing (${openai} OpenAI call)`);
        ok(Array.isArray(got)&&got[0]&&got[0].rec&&got[0].rec.img,'the open app still gets the photo through the hub');
        ok(/couldn’t keep it/.test(JSON.parse(store.store.get('jobfail:'+K)||'{}').error||''),'and the failure is recorded for an app that comes later')}
      // two copies of one message at once (two consumers run side by side): one makes it, the other waits and then finds it done
      {const {store,sent,env}=mk(),K='c00000000000000a2';openai=0;delay=40;
        await queueIt(env,K);const a=msg(sent[0]),b=msg(sent[0]);
        await Promise.all([worker.queue({messages:[a]},env),worker.queue({messages:[b]},env)]);delay=0;
        const late=[a,b].find(x=>x.retried);ok(openai===1&&late&&late.retried.delaySeconds>0&&store.store.has('render:'+K),`two copies of a message at once make one photo (${openai} OpenAI call); the other is put back to wait`);
        const again=msg(sent[0],2);await worker.queue({messages:[again]},env);
        ok(openai===1&&again.acked,'when it comes back the photo is made, so it does nothing')}
      // the app's Try again while the first run is still going: queued again under the same key, still one photo
      {const {store,sent,env}=mk(),K='c00000000000000a3';openai=0;delay=40;
        await queueIt(env,K);const first=msg(sent[0]),run=worker.queue({messages:[first]},env);await new Promise(r=>setTimeout(r,10));
        await queueIt(env,K,{replace:true});const second=msg(sent[1]);await worker.queue({messages:[second]},env);await run;delay=0;
        ok(openai===1&&first.acked&&second.retried,`a look queued again while it is being made is not made twice (${openai} OpenAI call)`);
        await new Promise(r=>setTimeout(r,5));await queueIt(env,K,{replace:true});await worker.queue({messages:[msg(sent[2])]},env);
        ok(openai===2,'a regenerate asked for after it was made is made (a new job)')}
      // the hub keeps whether a photo was made, not the photo; a wait after it still gets the photo (read from KV)
      {const {store,sent,env}=mk(),K='c00000000000000a4';openai=0;
        await queueIt(env,K);await worker.queue({messages:[msg(sent[0])]},env);
        const hub=hubs.get('renders'),kept=hub&&hub.recent.get(K);
        ok(kept&&kept.ok&&!kept.rec&&!JSON.stringify([...hub.recent.values()]).includes('AAAA'),'RenderHub remembers {key, ok}, not the 2048 photo');
        const got=await (await call(env,'GET','render-wait?keys='+K+'&ms=1000',undefined,T)).json();
        ok(Array.isArray(got)&&got[0]&&got[0].rec&&got[0].rec.img==='data:image/jpeg;base64,AAAA','a wait after it was made gets the photo, read from KV')}
      // a job that can't be made leaves no records behind, by any path (one helper, failJob)
      {const {store,sent,env}=mk(),K='c00000000000000a5';delete env.OPENAI_API_KEY;
        store.store.set('job:'+K,JSON.stringify({key:K,image:PNG,t:Date.now()}));const m=msg({key:K});await worker.queue({messages:[m]},env);
        ok(m.acked&&store.store.has('jobfail:'+K)&&!store.store.has('job:'+K)&&!store.store.has('jobrun:'+K),'a job given up (no OpenAI key) keeps its reason and leaves no job or jobrun record')}}
  }finally{globalThis.fetch=realFetch}
};
