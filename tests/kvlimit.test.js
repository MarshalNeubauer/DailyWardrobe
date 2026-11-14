// The worker's writes for the day used up (2026-11-14: Cloudflare's free plan allows 1,000 KV writes a day; the PC's picture uploads used them
// up and every backup answered "The server had a problem just now"): the worker answers 429 kv-limit (what 'backup' for /sync), the app
// pauses its uploads until the next UTC day and says so in words, with the local time of the reset.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();let full=false;
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{if(full)throw new Error('KV put() limit exceeded for the day.');store.set(k,v);meta.set(k,o&&o.metadata)},
    delete:async k=>{store.delete(k);meta.delete(k)},list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  // the worker's own answers
  const call=(p,o={})=>worker.fetch(new Request(HOST+p,{...o,headers:{'x-app-token':'secret','content-type':'application/json',...(o.headers||{})}}),env);
  await call('sync',{method:'PUT',body:JSON.stringify({baseRev:0,day:'2026-11-14',data:{items:[{id:'a',type:'tie',primaryColor:'navy',pattern:'solid',updated:1}],days:[],tombstones:{},settings:{updated:1}}})});
  full=true;const L=await (await call('sync?lite=1')).json();
  const r1=await call('sync',{method:'POST',body:JSON.stringify({baseRev:L.rev,baseSaved:L.saved,day:'2026-11-14',delta:{items:[{id:'b',type:'tie',primaryColor:'green',pattern:'solid',updated:2}],days:[],tombstones:{}},photos:{}})}),j1=await r1.json();
  const r2=await call('render',{method:'PUT',body:JSON.stringify({key:'c0123456789abcdef',rec:{sig:'x',img:'data:image/jpeg;base64,AA',model:'assembled',t:1}})}),j2=await r2.json().catch(()=>({}));
  ok(r1.status===429&&j1.error==='kv-limit'&&j1.what==='backup'&&/used up/.test(j1.message),`a backup save answers 429 kv-limit, "backup" (${r1.status} ${JSON.stringify(j1).slice(0,90)})`);
  ok(r2.status===429&&j2.error==='kv-limit'&&j2.what==='write','a picture upload answers 429 kv-limit too (the PC\'s builder stops on it)');
  // the app, against that worker
  const browser=await chromium.launch();
  try{const ctx=await browser.newContext({timezoneId:'Asia/Kuwait'});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{await syncNow();const it={id:'n',type:'tie',primaryColor:'burgundy',pattern:'solid',added:Date.now()};await put(it);items.push(it);const ok1=await syncNow();
      const st=localStorage.getItem('sync_status')||'',pause=+localStorage.getItem('sync_pause')||0;let n=0;const f0=window.fetch;window.fetch=function(u,o){if(o&&o.method&&o.method!=='GET')n++;return f0.apply(this,arguments)};
      const ok2=await syncNow();window.fetch=f0;return {ok1,ok2,st,pause,writes:n,reset:new Date(pause).toISOString()}});
    ok(!r.ok1&&/Today’s backups are used up on the server\. Your changes are kept on this phone and back up after 3:00/.test(r.st),`the app says why, with the local reset time ("${r.st}")`);
    ok(r.pause>Date.now()&&/T00:00:00/.test(r.reset)&&r.writes===0&&!r.ok2,'and sends nothing more until the next UTC day');
    ok(!errs.length,'no page errors: '+errs.join('; '))}
  finally{await browser.close()}
};
