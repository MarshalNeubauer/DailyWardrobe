/* The replay lab (from the 2026-11-15 audit). One private copy of the app plus the real worker.js against an in-memory KV.
   Nothing here talks to the real server, OpenAI or Anthropic: those calls are mocked and counted. Weather and holidays
   come from recorded answers (net.js); any other host is refused and noted.

   node tests/replay/harness/lab.js --port 9410 [--app <checkout>] [--worker <checkout>] [--kv <file.json>]
     app on http://127.0.0.1:9410/index.html, worker on http://127.0.0.1:9411/
     --app     which copy of the app (and its worker.js) to serve. Default: the app under test (paths.js R.APP).
     --worker  serve the server code (worker.js) from another checkout than the app files. Default: the same as --app.
     --kv      keep the server's storage in this file: loaded at start, saved after every change and on exit.
               Stop the lab, start it again with another --app and the same --kv and port = "the server was updated".
   It prints a tester invitation link and the owner token, and writes them to .work/labs/lab-<port>.json (R.labInfo).

   Control endpoints on the worker port (not part of the real API):
     GET  /__mock/log                  counts: claude, openai, kvPut, kvDel, kvList, kvByPrefix, kvPutToday, last 200 requests
     POST /__mock/count-reset          zero the counters (not the storage)
     GET  /__mock/kv                   the key names; GET /__mock/kv-dump  every key with its value (text, or base64 for binary)
     POST /__mock/next-tag   {json}    the next single-item tagging answer (else a rotating plausible one)
     POST /__mock/next-items {items:[...]}  the next "several items" answer
     POST /__mock/fail  {what:'claude'|'openai'|'kvput'|'server'|'all', status:529, count:2, delayMs:0}
     POST /__mock/delay {ms}           delay every worker reply (slow network)
     POST /__mock/drop  {rate:0.3}     drop that share of worker requests (connection reset, no reply)
     POST /__mock/kv-limit {perDay:N}  KV writes per UTC day (server clock) before put() fails like Cloudflare's daily limit; 0 = off
     POST /__mock/clock {offsetMs} | {at:'2027-01-05T08:00:00Z'}   the server's clock (Date/Date.now in the worker); {} resets
     POST /__mock/reset                clear failures, delays, drops and the KV limit (not the clock)
     POST /__mock/cal {href, fixture|mb|text, etag}   a made-up calendar at href (a tests/fixtures/calendar file, tests/calfeeds.js's
                                       feed of mb megabytes, or the text); the worker's fetch of href answers it, 304 for its etag
*/
const http=require('http'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const R=require('./paths.js'),NET=require('./net.js');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null};
const APP=path.resolve(arg('app')||R.APP);
const KVFILE=arg('kv')?path.resolve(arg('kv')):null;
const WAPP=path.resolve(arg('worker')||APP);   // --worker <checkout>: the server's code from another copy (old app on the phones, new server, or the reverse)
const PORT=+(arg('port')||9410),WPORT=PORT+1,HOST=`http://127.0.0.1:${WPORT}/`;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.bin':'application/octet-stream'};

// ---------- the server's clock (the worker reads Date at call time)
const RealDate=Date;let clockOff=0;
class LabDate extends RealDate{constructor(...a){if(a.length)super(...a);else super(RealDate.now()+clockOff)}static now(){return RealDate.now()+clockOff}}
globalThis.Date=LabDate;

// ---------- the app, served like GitHub Pages
http.createServer((q,r)=>{let f=path.join(APP,decodeURIComponent(q.url.split('?')[0].split('#')[0]));if(!f.startsWith(APP)){r.writeHead(403);return r.end()}
  if(f.endsWith(path.sep)||f===APP)f=path.join(f,'index.html');
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('not found')}r.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-cache'});r.end(d)})
}).listen(PORT,'127.0.0.1');

(async()=>{
  const mod=await import(pathToFileURL(path.join(WAPP,'worker.js')).href),worker=mod.default;
  const log={app:APP,worker:WAPP,claude:0,openai:0,kvPut:0,kvDel:0,kvList:0,kvByPrefix:{},kvPutToday:0,recent:[]};
  const note=s=>{log.recent.push(new RealDate().toISOString().slice(11,19)+' '+s);if(log.recent.length>200)log.recent.shift()};
  let fail={},delay=0,drop=0,kvLimit=0,nextTag=null,nextItems=null,rot=0;const putsByDay={};
  const TAGS=[
    {type:'suit',primaryColor:'navy',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'wool',texture:'smooth',formality:'business',season:'all'},
    {type:'shirt',primaryColor:'white',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'cotton',texture:'smooth',formality:'business',season:'all'},
    {type:'tie',primaryColor:'burgundy',secondaryColor:'navy',thirdColor:'none',pattern:'stripes',material:'silk',texture:'smooth',formality:'business',season:'all'},
    {type:'trousers',primaryColor:'grey',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'wool',texture:'smooth',formality:'business',season:'all'},
    {type:'shoes',primaryColor:'brown',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'leather',texture:'smooth',formality:'business',season:'all'},
    {type:'shirt',primaryColor:'light blue',secondaryColor:'white',thirdColor:'none',pattern:'stripes',material:'cotton',texture:'smooth',formality:'business',season:'all'},
    {type:'blazer',primaryColor:'charcoal',secondaryColor:'none',thirdColor:'none',pattern:'herringbone',material:'wool',texture:'textured',formality:'business',season:'autumn-winter'}];
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const failNow=w=>{for(const k of [w,'all']){const f=fail[k];if(f&&f.count>0){f.count--;return f}}return null};
  // every request the worker makes goes through here: the two AI services are mocked, the data services replayed, the rest refused
  globalThis.fetch=async(href,init)=>{href=String(href&&href.url||href);
    if(href.startsWith('https://api.openai.com/')){log.openai++;note('OPENAI '+href);const f=failNow('openai');if(f)return new Response(JSON.stringify({error:{message:'mock failure'}}),{status:f.status||500});
      return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})}
    if(href.startsWith('https://api.anthropic.com/')){log.claude++;const f=failNow('claude');if(f){note('CLAUDE fail '+f.status);if(f.delayMs)await new Promise(r=>setTimeout(r,f.delayMs));return new Response(JSON.stringify({type:'error',error:{type:'overloaded_error',message:'Overloaded'}}),{status:f.status||529})}
      let body={};try{body=JSON.parse(init.body)}catch{}
      const props=(((body.output_config||{}).format||{}).schema||{}).properties||{};let ans;
      if(props.items){ans=nextItems||{items:[TAGS[1],TAGS[2]]};nextItems=null}
      else if(props.layout)ans={layout:'none'};
      else{ans=nextTag||{...TAGS[rot++%TAGS.length]};nextTag=null}
      note('CLAUDE '+Object.keys(props).slice(0,6).join(','));
      return new Response(JSON.stringify({model:'mock',stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify(ans)}]}),{status:200,headers:{'content-type':'application/json'}})}
    // a made-up calendar host (POST /__mock/cal): only these links answer, from local text; If-None-Match answers 304
    if(cals.has(href)){const c=cals.get(href),h=(init&&init.headers)||{};log.cal=(log.cal||0)+1;
      if(c.etag&&h['if-none-match']===c.etag){note('CAL 304');return new Response(null,{status:304})}
      note('CAL 200 '+c.text.length);return new Response(c.text,{status:200,headers:{'content-type':'text/calendar',...(c.etag?{etag:c.etag}:{})}})}
    if(!NET.isData(href))note('BLOCKED outbound '+href);
    return NET.nodeAnswer(href)};
  const cals=new Map();

  // ---------- KV in memory, optionally kept in a file
  const store=new Map(),meta=new Map();
  if(KVFILE&&fs.existsSync(KVFILE)){const j=JSON.parse(fs.readFileSync(KVFILE,'utf8'));for(const [k,e] of Object.entries(j)){store.set(k,e.b?Buffer.from(e.v,'base64'):e.v);if(e.m!=null)meta.set(k,e.m)}note(`loaded ${store.size} keys from ${KVFILE}`)}
  const dump=()=>{const o={};for(const [k,v] of store){o[k]=typeof v==='string'?{v,m:meta.get(k)}:{b:1,v:Buffer.from(v).toString('base64'),m:meta.get(k)}}return o};
  let saveT=null;const saveNow=()=>{if(!KVFILE)return;clearTimeout(saveT);saveT=null;fs.writeFileSync(KVFILE+'.tmp',JSON.stringify(dump()));fs.renameSync(KVFILE+'.tmp',KVFILE)};
  const save=()=>{if(KVFILE&&!saveT)saveT=setTimeout(saveNow,200)};
  for(const s of ['SIGINT','SIGTERM','SIGBREAK'])process.on(s,()=>{try{saveNow()}catch{}process.exit(0)});
  process.on('exit',()=>{try{if(saveT)saveNow()}catch{}});
  const today=()=>new LabDate().toISOString().slice(0,10);
  const KV={get:async(k,t)=>{if(!store.has(k))return null;const v=store.get(k);if(t==='json')return JSON.parse(typeof v==='string'?v:Buffer.from(v).toString());if(t==='arrayBuffer'){const b=typeof v==='string'?Buffer.from(v):Buffer.from(v);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}if(t==='stream')return new Response(v).body;return typeof v==='string'?v:Buffer.from(v).toString()},
    getWithMetadata:async(k,t)=>({value:await KV.get(k,t),metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{const d=today();if(kvLimit&&(putsByDay[d]||0)>=kvLimit){note('KV LIMIT put '+k);throw new Error('KV put() limit exceeded for the day.')}
      const f=failNow('kvput');if(f)throw new Error('KV put() limit exceeded for the day.');
      log.kvPut++;putsByDay[d]=(putsByDay[d]||0)+1;log.kvPutToday=putsByDay[d];const p=String(k).split(/[:/]/)[0];log.kvByPrefix[p]=(log.kvByPrefix[p]||0)+1;
      if(v instanceof ReadableStream)v=Buffer.from(await new Response(v).arrayBuffer());else if(v instanceof ArrayBuffer)v=Buffer.from(v);else if(ArrayBuffer.isView(v))v=Buffer.from(v.buffer,v.byteOffset,v.byteLength);
      store.set(k,v);meta.set(k,o&&o.metadata);save()},
    delete:async k=>{log.kvDel++;store.delete(k);meta.delete(k);save()},
    list:async({prefix=''}={})=>{log.kvList++;return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name)})),list_complete:true}}};
  const hubs=new Map(),hubOf=name=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},delete:async k=>{st.delete(k)},deleteAll:async()=>{st.clear()}}},{}))}return hubs.get(name)};
  const HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>mod.RenderHub?hubOf(name).fetch(new Request(u,init)):Promise.resolve(new Response('no hub',{status:404}))})};
  const queue=[];const Q={send:async m=>{queue.push(m)}};
  const env={APP_TOKEN:'owner-secret',OPENAI_API_KEY:'mock',ANTHROPIC_API_KEY:'mock',WARDROBE:KV,RENDER_QUEUE:Q,RENDER_HUB:HUB};
  setInterval(async()=>{if(!queue.length||!worker.queue)return;const msgs=queue.splice(0).map(body=>({body,attempts:1,ack(){},retry(){queue.push(body)}}));try{await worker.queue({messages:msgs},env,{waitUntil(){}})}catch(e){note('queue error '+e.message)}},2000);
  const ctxObj={waitUntil(p){Promise.resolve(p).catch(e=>note('waitUntil error '+e.message))},passThroughOnException(){}};
  const json=(r,s,o)=>{r.writeHead(s,{'content-type':'application/json','access-control-allow-origin':'*'});r.end(JSON.stringify(o))};
  http.createServer((q,res)=>{const ch=[];q.on('data',d=>ch.push(d));q.on('end',async()=>{const body=Buffer.concat(ch);
    try{
      if(q.url.startsWith('/__mock/')){const b=body.length?JSON.parse(body):{};const w=q.url.slice(8).split('?')[0];
        if(w==='log')return json(res,200,log);
        if(w==='count-reset'){Object.assign(log,{claude:0,openai:0,kvPut:0,kvDel:0,kvList:0,kvByPrefix:{}});return json(res,200,{ok:1})}
        if(w==='next-tag'){nextTag=b;return json(res,200,{ok:1})}
        if(w==='next-items'){nextItems=b;return json(res,200,{ok:1})}
        if(w==='fail'){fail[b.what||'all']={status:b.status||503,count:b.count==null?1:b.count,delayMs:b.delayMs||0};return json(res,200,{ok:1,fail})}
        if(w==='delay'){delay=+b.ms||0;return json(res,200,{ok:1})}
        if(w==='drop'){drop=+b.rate||0;return json(res,200,{ok:1})}
        if(w==='kv-limit'){kvLimit=+b.perDay||0;return json(res,200,{ok:1,today:today(),putsToday:putsByDay[today()]||0})}
        if(w==='clock'){clockOff=b.at?new RealDate(b.at).getTime()-RealDate.now():(+b.offsetMs||0);return json(res,200,{ok:1,now:new LabDate().toISOString()})}
        if(w==='reset'){fail={};delay=0;drop=0;kvLimit=0;return json(res,200,{ok:1})}
        if(w==='cal'){const text=b.fixture?fs.readFileSync(path.join(R.REPO,'tests','fixtures','calendar',path.basename(b.fixture)),'utf8'):b.mb?require(path.join(R.REPO,'tests','calfeeds.js')).feed(+b.mb):String(b.text||'');
          cals.set(String(b.href),{text,etag:b.etag||''});return json(res,200,{ok:1,bytes:Buffer.byteLength(text)})}
        if(w==='kv')return json(res,200,{keys:[...store.keys()]});
        if(w==='kv-dump')return json(res,200,dump());
        return json(res,404,{})}
      if(drop&&Math.random()<drop){note('DROPPED '+q.method+' '+q.url.slice(0,60));return res.destroy()}
      if(delay)await new Promise(r=>setTimeout(r,delay));
      const f=failNow('server');if(f)return json(res,f.status||503,{error:'mock',message:'The server had a problem just now.'});
      const headers=Object.fromEntries(Object.entries(q.headers).filter(([k])=>!/^(host|connection|content-length|transfer-encoding)$/.test(k)));
      const rq=new Request(HOST.slice(0,-1)+q.url,{method:q.method,headers,body:['GET','HEAD'].includes(q.method)||!body.length?undefined:body});
      const r=await worker.fetch(rq,env,ctxObj);note(`${q.method} ${q.url.slice(0,80)} -> ${r.status}`);
      const out=Buffer.from(await r.arrayBuffer());const h={};r.headers.forEach((v,k)=>{h[k]=v});res.writeHead(r.status,h);res.end(out)
    }catch(e){note('ERR '+e.stack);json(res,500,{error:String(e)})}})}).listen(WPORT,'127.0.0.1');
  const inv=await (await worker.fetch(new Request(HOST+'invites',{method:'POST',headers:{'x-app-token':'owner-secret','content-type':'application/json'},body:JSON.stringify({name:'New tester'})}),env,ctxObj)).json();
  const code=inv.code||(inv.invite&&inv.invite.code);
  const appUrl=`http://127.0.0.1:${PORT}/index.html`;
  const info={app:APP,workerCode:WAPP,kv:KVFILE,appUrl,worker:HOST,ownerToken:'owner-secret',inviteCode:code,inviteLink:code?`${appUrl}#invite=${code}&w=${encodeURIComponent(HOST)}`:null,rawInvite:code?undefined:inv};
  fs.writeFileSync(R.labInfo(PORT),JSON.stringify(info,null,1));
  console.log(JSON.stringify(info,null,1));
})().catch(e=>{console.error(e);process.exit(1)});
