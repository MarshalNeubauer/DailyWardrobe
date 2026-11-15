// The server and request-volume fixes of the new-user audit (2026-11-15): the picture list is one shared request and, once refused
// (429/503), not asked again until the next UTC day; item pictures stop at the first one the server can't keep, keep that one on the
// phone and say so; a picture is not paid for once the server's saves are known to be used up; Kuwait's holidays come from a built-in
// list; a photo reading the app closed on gives its count back. Mocked KV, Durable Object, OpenAI and Claude; the real worker and app.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const realFetch=globalThis.fetch;let openai=0,claudeWait=false;
  globalThis.fetch=async(href,init)=>{href=String(href);
    if(href.startsWith('https://api.openai.com/v1/images/')){openai++;return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})}
    if(href.startsWith('https://api.anthropic.com/')&&claudeWait)return new Promise((ok,no)=>{const s=init&&init.signal;if(!s)return;
      if(s.aborted)return no(new DOMException('aborted','AbortError'));s.addEventListener('abort',()=>no(new DOMException('aborted','AbortError')))});
    return new Response('',{status:404})};
  const kv=(o={})=>{const store=new Map(),meta=new Map();return {store,o,
    get:async(k,t)=>store.has(k)?((t==='json'||(t&&t.type==='json'))?JSON.parse(store.get(k)):store.get(k)):null,
    put:async(k,v,x)=>{if(o.failPut&&o.failPut(k))throw new Error('KV put() limit exceeded for the day.');store.set(k,typeof v==='string'?v:new TextDecoder().decode(v));if(x&&x.metadata)meta.set(k,x.metadata)},
    delete:async k=>{store.delete(k)},list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})}};
  const hubs=new Map(),HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>st.clear()}},{}))}return hubs.get(name).fetch(new Request(u,init))}})};
  const HOST='https://w.test/';
  const call=(env,method,p,body,tok,signal)=>worker.fetch(new Request(HOST+p,{method,signal,headers:{'content-type':'application/json','x-app-token':tok},body:body===undefined?undefined:JSON.stringify(body)}),env);
  const J=async r=>({s:r.status,...(await r.clone().json().catch(()=>({})))});
  const browser=await chromium.launch();
  try{
    // ---- worker: an item picture the server can't keep (KV's daily writes used up)
    {let full=true;const KV=kv({failPut:k=>full&&/render:/.test(k)}),env={APP_TOKEN:'o',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_HUB:HUB};
      const code=(await J(await call(env,'POST','invites',{name:'t'},'o'))).code;
      const item=k=>({mode:'item',item:'a pair of black calf leather cap-toe oxford dress shoes',key:'c012345678900000'+k});
      const hubUsed=async()=>{const day=new Date().toISOString().slice(0,10),out={};for(const [n,h] of hubs)if(/u:(?!all:)/.test(n))Object.assign(out,(await (await h.fetch(new Request('https://hub/used?day='+day))).json()).used||{});return out};
      const a=await J(await call(env,'POST','render',item('a'),code)),me1=await hubUsed();
      ok(a.s===200&&a.stored===false&&/^data:image\/jpeg/.test(a.image)&&/kept on this phone only/.test(a.message)&&!/KV|worker|Cloudflare/i.test(a.message)&&openai===1,
        `a picture made while the server can't save is still handed to the app, marked not stored, in plain words (${a.s}, ${a.message})`);
      ok((me1.item||0)===1&&!(me1.write>0),`it counts as a picture made (it is on the phone) but not as a write (${JSON.stringify(me1)})`);
      const b=await J(await call(env,'POST','render',item('b'),code)),me2=(await J(await call(env,'GET','me',undefined,code))).used||{};
      ok(b.s===429&&b.error!==undefined&&/no item pictures can be made until the daily reset/.test(b.message)&&openai===1&&(me2.item||0)===1,
        `the next picture is refused before OpenAI is paid (${b.s}, OpenAI calls ${openai}, used ${JSON.stringify(me2)})`);
      full=false;const KV2=kv(),env2={...env,WARDROBE:KV2};
      const c=await J(await call(env2,'POST','render',item('c'),'o'));
      ok(c.s===200&&c.stored===undefined&&KV2.store.has('render:c012345678900000c')&&openai===2,'with its saves back (another KV) a picture is made and kept as before');}
    // ---- worker: Kuwait's public holidays from the built-in list when no calendar answers
    {const env={APP_TOKEN:'o'};
      const kw=await J(await call(env,'GET','holidays?country=KW',undefined,'o')),gb=await call(env,'GET','holidays?country=GB',undefined,'o');
      const names=(kw.holidays||[]).map(h=>h.date.slice(5)+' '+h.name);
      ok(kw.s===200&&kw.source==='built-in'&&kw.country==='KW'&&names.some(n=>/^02-25 National Day$/.test(n))&&names.some(n=>/^02-26 Liberation Day$/.test(n))&&names.some(n=>/Eid al-Fitr \(expected\)/.test(n))&&names.some(n=>/Eid al-Adha \(expected\)/.test(n)),
        `Kuwait gets its holidays from the built-in list (${kw.s}, ${names.length}: ${names.slice(0,4).join('; ')}…)`);
      const all=mod.default&&(await import(pathToFileURL(path.join(ROOT,'worker','holidays.js')).href)).BUILTIN_HOLIDAYS.kw;
      const last=all.map(x=>x[0]).sort().pop(),ahead=(Date.parse(last)-Date.now())/864e5;
      ok(ahead>300,`the built-in Kuwait list reaches at least ~10 months ahead (to ${last}; extend it each year)`);
      ok(gb.status===404,'a country with no calendar and no built-in list still answers 404');}
    // ---- worker: a photo reading the app closed on is stopped and its count goes back
    {const env={APP_TOKEN:'o',ANTHROPIC_API_KEY:'a',CLAUDE_RETRY_MS:0,WARDROBE:kv(),RENDER_HUB:HUB};
      const code=(await J(await call(env,'POST','invites',{name:'k'},'o'))).code;claudeWait=true;
      const ac=new AbortController();setTimeout(()=>ac.abort(),80);
      const r=await call(env,'POST','',{image:PNG},code,ac.signal);claudeWait=false;
      const used=(await J(await call(env,'GET','me',undefined,code))).used||{};
      ok(r.status===499&&!(used.tag>0),`a reading the app closed on stops, and the tester's photo readings stay at 0 (${r.status}, ${JSON.stringify(used)})`);}

    // ---- the app: one shared list, paused after a refusal
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    let listMode=200;const asks=[];const KV=kv({failPut:()=>false}),env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV};
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url());if(u.pathname==='/sync')return route.fulfill({status:503,body:'sync is off in this test'});
      if(u.pathname==='/render'&&q.method()==='GET')asks.push(u.search);
      if(u.searchParams.get('list')==='1'&&listMode!==200)return route.fulfill({status:listMode,contentType:'application/json',body:'{"error":"limit","message":"Today’s photo list checks are used up."}'});
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const lists=()=>asks.filter(a=>/list=1/.test(a)).length;
    const both=await p.evaluate(async()=>{listKeys=null;listAt=0;remoteKeys=null;await Promise.all([asmListGet(),remoteList(),asmListGet(),remoteList()]);return {asm:!!asmList,remote:remoteListed}});
    const n0=lists();asks.length=0;
    await p.evaluate(async()=>{remoteKeys=null;await Promise.all([asmListGet(),remoteList()])});
    ok(both.asm&&both.remote&&lists()===0,`the painted pictures and the outfit photos share one list, kept for a while (${n0} at start, ${lists()} more when both asked again)`);
    listMode=429;asks.length=0;
    const paused=await p.evaluate(async()=>{listKeys=null;listAt=0;remoteKeys=null;asmList=null;await remoteList();remoteKeys=null;
      await Promise.all([asmListGet(),remoteList(),asmListGet()]);
      const o={top:{id:'s',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'}};renderTried.clear();await fetchRemoteRender(o,'2026-11-16');
      let p=null;try{p=JSON.parse(localStorage.getItem('list_pause'))}catch{}return {p,asm:asmList,listed:remoteListed}});
    const tomorrow=(d=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1))(new Date());
    ok(lists()===1&&asks.length===1&&paused.p&&paused.p.until===tomorrow&&!paused.asm&&!paused.listed,
      `a refused list (429) is not asked again until the next UTC day, and no day is asked about one by one meanwhile (${asks.length} requests: ${asks.join(' ')})`);
    listMode=503;asks.length=0;await p.evaluate(async()=>{localStorage.removeItem('list_pause');listKeys=null;remoteKeys=null;await remoteList();remoteKeys=null;await remoteList();await asmListGet()});
    ok(lists()===1,`a 503 list pauses the same way (${lists()} request)`);
    listMode=200;asks.length=0;const forced=await p.evaluate(async()=>{const L=await asmListGet(true);return !!L&&!localStorage.getItem('list_pause')});
    ok(lists()===1&&forced,'a forced ask (Settings) still tries once, and a list that comes clears the pause');

    // ---- the app: an item-picture batch stops at the first picture the server can't keep
    KV.o.failPut=k=>/render:/.test(k);openai=0;
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      for(const x of Object.keys(renders))delete renders[x];renderTried.clear();openSettings('photos')});
    await p.evaluate(()=>{startItemPics()});await p.click('#ask-ok');
    await p.waitForFunction(()=>!itemBatch&&/Done/.test($('#itempic-status').textContent),null,{timeout:20000});
    const st=await p.evaluate(()=>({status:$('#itempic-status').textContent,local:Object.values(renders).filter(r=>r&&r.local).length,left:missingItemPics().length}));
    ok(openai===1&&st.local===1&&st.left===3,`the batch stops after the first picture the server couldn't keep: one paid for, kept on the phone (${openai} made, ${st.local} kept here, ${st.left} left)`);
    ok(/^Done: 1 picture ready, 3 not made \(.*kept on this phone only/.test(st.status)&&!/failed|changes are kept/.test(st.status),`it says so plainly (${st.status})`);
    await p.evaluate(()=>{startItemPics()});await p.click('#ask-ok');
    await p.waitForFunction(()=>!itemBatch&&/Done: 0/.test($('#itempic-status').textContent),null,{timeout:20000}).catch(()=>{});
    const st2=await p.evaluate(()=>$('#itempic-status').textContent);
    ok(openai===1&&/^Done: 0 pictures ready, 3 not made \(.*no item pictures can be made until the daily reset/.test(st2),`a second tap is refused before anything is paid for, and says why (${openai} made; ${st2})`);
    KV.o.failPut=()=>false;
    const shared=await p.evaluate(async()=>({n:await shareLocalPics(),local:Object.values(renders).filter(r=>r&&r.local).length}));
    ok(shared.n===1&&shared.local===0&&[...KV.store.keys()].some(k=>/^render:c/.test(k)),'once the server saves again, the picture kept on the phone is uploaded');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
