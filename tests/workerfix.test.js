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
  }finally{globalThis.fetch=realFetch}
};
