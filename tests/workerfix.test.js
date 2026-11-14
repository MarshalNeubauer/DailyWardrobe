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
    put:async(k,v,x)=>{if(o.failPut&&o.failPut(k))throw new Error(o.failErr||'KV put() limit exceeded for the day.');store.set(k,typeof v==='string'?v:new TextDecoder().decode(v));if(x&&x.metadata)meta.set(k,x.metadata)},
    delete:async k=>{store.delete(k)},list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})}};
  const hubs=new Map(),HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>st.clear()}},{}))}return hubs.get(name).fetch(new Request(u,init))}})};
  const HOST='https://w.test/';
  const call=(env,method,p,body,h={})=>worker.fetch(new Request(HOST+p,{method,headers:{'content-type':'application/json',...h},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}),env);
  const J=async r=>({s:r.status,h:r.headers,...(await r.clone().json().catch(()=>({})))});
  try{
    // ---- an uncaught error (KV over its daily writes) answers a readable 503 with the CORS headers, not Cloudflare's error 1101
    {const env={APP_TOKEN:'t',WARDROBE:kv({failPut:()=>true}),ALLOWED_ORIGIN:'https://a.github.io'};
      let r,threw=null;try{r=await J(await call(env,'PUT','render',{key:'c0123456789abcdef',rec:{img:'data:image/jpeg;base64,AAAA',t:1}},{'x-app-token':'t',Origin:'https://a.github.io'}))}catch(e){threw=e}
      // (2026-11-14) the day's writes used up is said as such: 429 kv-limit (the app pauses its backups until the reset, the PC's builder stops)
      ok(!threw&&r.s===429&&r.error==='kv-limit'&&r.h.get('access-control-allow-origin')==='https://a.github.io'&&/used up/.test(r.message)&&r.h.get('content-type')==='application/json','KV over its daily writes answers JSON 429 kv-limit with CORS headers, saying the saves are used up');
      const env2={APP_TOKEN:'t',WARDROBE:kv({failPut:()=>true,failErr:'KV storage is restarting'}),ALLOWED_ORIGIN:'https://a.github.io'};let r2,threw2=null;
      try{r2=await J(await call(env2,'PUT','render',{key:'c0123456789abcdef',rec:{img:'data:image/jpeg;base64,AAAA',t:1}},{'x-app-token':'t',Origin:'https://a.github.io'}))}catch(e){threw2=e}
      ok(!threw2&&r2.s===503&&r2.h.get('access-control-allow-origin')==='https://a.github.io'&&/Try again/.test(r2.message)&&r2.h.get('content-type')==='application/json','any other storage failure inside a route answers JSON 503 with CORS headers (the app shows a reason, not "Failed to fetch")');
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
    // ---- every KV write a tester causes is counted against a daily cap; lists too; everyone together stays well under 1,000
    {const realNow=Date.now;try{
      const store=kv(),env={APP_TOKEN:'own',WARDROBE:store,RENDER_HUB:HUB,TESTER_DAILY_TOTAL:JSON.stringify({write:40})};hubs.clear();
      const O={'x-app-token':'own'},mkT=async name=>{const r=await J(await call(env,'POST','invites',{name},O));const k='invite:'+crypto.createHash('sha256').update(r.code).digest('hex'),rec=JSON.parse(store.store.get(k));rec.created-=8*86400000;store.store.set(k,JSON.stringify(rec));return {id:r.id,ns:`u:${r.id}:`,h:{'x-app-token':r.code}}};
      const A=await mkT('Tess'),B=await mkT('Bo');
      // deletes: each one counted (1,200 went through before)
      let n=0,st=200;for(;n<60&&st===200;n++)st=(await call(env,'DELETE','render?key=c'+n.toString(16).padStart(16,'0'),undefined,A.h)).status;
      ok(st===429&&n===41,`a tester's DELETE /render is counted as a write and refused past everyone's daily total (refused at ${n})`);
      env.TESTER_DAILY_TOTAL=JSON.stringify({write:450});let d=0;st=200;for(;d<260&&st===200;d++)st=(await call(env,'DELETE','render?key=c'+d.toString(16).padStart(16,'0'),undefined,B.h)).status;
      ok(st===429&&d===201,`and past the tester's own 200 writes a day (refused at ${d})`);
      // a first backup larger than what is left today: what fits is stored, the save waits for tomorrow, and finishes then
      Date.now=()=>realNow()+86400000;env.TESTER_DAILY_TOTAL=JSON.stringify({write:30});
      const photos={},items=[];for(let i=0;i<50;i++){const ph='data:image/jpeg;base64,'+crypto.randomBytes(300).toString('base64');const h=crypto.createHash('sha256').update(ph).digest('hex').slice(0,20);photos[h]=ph;items.push({id:'i'+i,added:1,photo:'dwph:'+h})}
      const save=async()=>J(await call(env,'POST','sync',{baseRev:0,day:'2026-11-20',delta:{items,days:[],tombstones:{}},photos},A.h));
      let r=await save();const stored=()=>[...store.store.keys()].filter(k=>k.startsWith(A.ns+'ph:')&&k!==A.ns+'ph:gc').length;
      ok(r.s===429&&r.what==='backup'&&/30 of 50 new photos/.test(r.message)&&stored()===30&&!store.store.has(A.ns+'wardrobe:v1'),`a backup past the day's writes stores what fits and is refused in the backup's words, so the app tries tomorrow (${r.s}, ${stored()} photos stored: ${r.message})`);
      Date.now=()=>realNow()+2*86400000;r=await save();
      ok(r.s===200&&stored()===50&&store.store.has(A.ns+'wardrobe:v1'),`the next day it stores the other 20 and the backup (${r.s}, ${stored()})`);
      // lists: 30 a day
      let l=0;st=200;for(;l<40&&st===200;l++)st=(await call(env,'GET','render?list=1',undefined,B.h)).status;
      ok(st===429&&l===31,`a tester's photo list (a KV list) is capped too (refused at ${l})`);
      // the owner is never counted
      let ow=0;for(let i=0;i<50;i++)if((await call(env,'DELETE','render?key=c'+i.toString(16).padStart(16,'0'),undefined,O)).status===200)ow++;
      ok(ow===50,'the owner\'s writes are never counted');
      // reminders: a tester who knows the owner's push address can neither switch it off nor take it over
      const env2={...env,VAPID_PUBLIC_KEY:'x',VAPID_PRIVATE_KEY:'y'},EP='https://fcm.googleapis.com/fcm/send/owner-device';
      await call(env2,'POST','push',{endpoint:EP,time:'07:00',tz:'UTC',dates:[]},O);
      await call(env2,'POST','push',{endpoint:EP,off:true},A.h);
      const owners=()=>JSON.parse(store.store.get('push:subs')).list.filter(x=>x.endpoint===EP).map(x=>(x.ns||'owner')+'@'+x.time).sort().join();
      ok(owners()==='owner@07:00','a tester can\'t switch off the owner\'s reminder by its push address');
      await call(env2,'POST','push',{endpoint:EP,time:'05:00',tz:'UTC',dates:[]},A.h);
      ok(/owner@07:00/.test(owners()),`nor change it (${owners()})`);
    }finally{Date.now=realNow}}
    // ---- Claude calls: the fixed text cached in system, the owner's next, the photos and per-call text last; wb wording; retries
    {const TAG={type:'suit',primaryColor:'navy',secondaryColor:'none',tertiaryColor:'none',pattern:'pinstripe',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
        confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,
        weave:{layout:'stripes',direction:'vertical',repeatsAcross:34,colours:[{name:'navy',hex:'#1f2a44',width:'wide'},{name:'white',hex:'#ffffff',width:'hairline'}],crossing:'',description:'x'}};
      let bodies=[],replies=[],logs=[];const log0=console.log;
      globalThis.fetch=async(u,i)=>{if(String(u)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:599});bodies.push(JSON.parse(i.body));const f=replies.length>1?replies.shift():replies[0];return f()};
      const ok200=b=>()=>new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',usage:{input_tokens:900,cache_read_input_tokens:4200,cache_creation_input_tokens:0,output_tokens:310},content:[{type:'text',text:JSON.stringify(b)}]}),{status:200});
      const err=(s,m)=>()=>new Response(JSON.stringify({type:'error',error:{message:m}}),{status:s});
      const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k',CLAUDE_RETRY_MS:0},T={'x-app-token':'t'};
      const custom={colors:[{key:'ownink',name:'ink',hex:'#1a1f33',types:['suit']}],patterns:[]},corrections=[{field:'pattern',type:'suit',from:'stripe',to:'pinstripe'}];
      const tag=x=>call(env,'POST','',{image:PNG,closeup:PNG,custom,corrections,measured:{lab:[20,1,-8],ref:true,src:'closeup'},...x},T);
      replies=[ok200(TAG)];console.log=(...a)=>logs.push(a.join(' '));let r;
      try{r=await J(await tag({}))}finally{console.log=log0}
      const b=bodies.at(-1),sys=b.system||[],msg=b.messages[0].content,mt=msg.filter(c=>c.type==='text').map(c=>c.text).join('\n');
      ok(Array.isArray(sys)&&sys.length===2&&sys.every(s=>s.cache_control&&s.cache_control.type==='ephemeral'),'the system prompt has two cache points: the fixed instructions, then the owner\'s colours and corrections');
      ok(/type — one of/.test(sys[0].text)&&/clothBox —/.test(sys[0].text)&&!/no code fences|Reply with one JSON object/.test(sys[0].text)&&!/ownink|steelblue ->/.test(sys[0].text),'the first holds the fixed rules, without the stale JSON template or "no code fences" line (structured output answers)');
      ok(/ownink = ink/.test(sys[1].text)&&/suit pattern: stripe -> pinstripe/.test(sys[1].text),'the second holds the owner\'s own colours and corrections');
      ok(msg[0].type==='image'&&msg[1].type==='image'&&msg.at(-1).type==='text'&&/CIELAB L\*20/.test(mt)&&!/type — one of/.test(mt),'the photos and the per-call text (close-up note, light, measurement) come after');
      ok(r.s===200&&r.weave&&r.weave.repeatsAcross===34,`a pinstripe's count across is kept up to 80 (was capped at 12: ${r.weave&&r.weave.repeatsAcross})`);
      ok(logs.some(l=>/cache read 4200/.test(l)&&/out 310/.test(l)),'the log line has the cache reads and output tokens');
      await tag({wb:true});const wT=bodies.at(-1).messages[0].content.at(-1).text;await tag({wb:false});const wF=bodies.at(-1).messages[0].content.at(-1).text;await tag({});const wN=bodies.at(-1).messages[0].content.at(-1).text;
      ok(/white-balanced these photos from a white reference/.test(wT)&&!/neutral daylight/.test(wT),'wb:true: take the colours as shown');
      ok(/as the camera took them/.test(wF)&&/warm indoor light makes white look ivory/.test(wF),'wb:false: judge them as in daylight, allowing for the light');
      ok(/may or may not have been white-balanced/.test(wN)&&!/from a white reference in the frame/.test(wN),'no wb (an older app): the safe wording');
      ok(!/white-balanced|Judge shirt colours as in daylight/.test(bodies.at(-1).system.map(s=>s.text).join('')),'nothing about the light is fixed in the system prompt any more');
      replies=[ok200({items:[]})];await call(env,'POST','tag-many',{image:PNG,custom},T);
      ok(!/JSON only/.test(bodies.at(-1).system[0].text)&&bodies.at(-1).system.length===2,'the group prompt has no "JSON only" line and caches the same way');
      replies=[ok200({layout:'none'})];await call(env,'POST','pattern',{image:PNG,closeup:PNG,type:'tie'},T);
      ok(/reading the woven pattern/.test(bodies.at(-1).system[0].text)&&bodies.at(-1).system[0].cache_control&&/The item is a tie/.test(bodies.at(-1).messages[0].content.at(-1).text),'the pattern prompt is cached in system; the item\'s type goes after the photos');
      // retries: once on 429/529/5xx, never on a 4xx; a time limit on every attempt
      bodies=[];replies=[err(529,'Overloaded'),ok200(TAG)];r=await J(await tag({}));
      ok(r.s===200&&bodies.length===2,`an overloaded API (529) is tried once more and the tag comes back (${bodies.length} calls)`);
      bodies=[];replies=[err(500,'boom'),err(503,'still')];r=await J(await tag({}));
      ok(r.s===502&&bodies.length===2&&/still/.test(r.detail),'two failures in a row: one retry, then the error');
      bodies=[];replies=[err(400,'bad request')];r=await J(await tag({}));
      ok(r.s===502&&bodies.length===1,'a 400 is not retried');
      let sig=null;globalThis.fetch=async(u,i)=>{sig=i.signal;const e=new Error('timed out');e.name='TimeoutError';throw e};r=await J(await tag({}));
      ok(sig&&typeof sig.aborted==='boolean'&&r.s===504&&/minutes/.test(r.detail),'each call to Claude has a time limit, and running out says so');}
    // ---- the deploy workflow reads the repository only, and says loudly when worker.js changed but can't be deployed
    {const wf=require('fs').readFileSync(path.join(ROOT,'.github/workflows/deploy-worker.yml'),'utf8');
      ok(/^permissions:\n  contents: read$/m.test(wf),'the deploy workflow has permissions: contents: read');
      ok(/::warning::worker\.js changed on main but was NOT deployed/.test(wf)&&!/::notice::Automatic worker deploys/.test(wf),'missing Cloudflare settings give a warning, not a quiet notice')}
  }finally{globalThis.fetch=realFetch}
};
