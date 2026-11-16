// Invitations and links (fix round 3, the third audit's W1-7-01, W1-7-02, W1-7-03, W1-7-04, W1-11-01, W1-11-02, W1-6-03, W2-13-01,
// W2-13-04, W2-13-11 and the owner's decision 1): a link is followed only to the app's own server; the old code is asked about before a
// switch; the same account under a new code switches with no question; an empty connected phone and a phone with pieces of its own are
// asked; the owner's phone keeps a way back; a new link for the same tester (worker/people.js POST /invites {reissue}).
const path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  // ---- the server: a new link for the same account (the real worker.js, mocked KV and Durable Objects)
  {const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
    const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
    const store=new Map(),n={put:0};
    const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{n.put++;store.set(k,v)},delete:async k=>{store.delete(k)},
      list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name})),list_complete:true})};
    const hubs=new Map(),hubOf=name=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>{st.clear()}}},{}))}return hubs.get(name)};
    const env={APP_TOKEN:'owner-secret',WARDROBE:KV,RENDER_QUEUE:{send:async()=>{}},RENDER_HUB:{idFromName:x=>x,get:name=>({fetch:(u,init)=>hubOf(name).fetch(new Request(u,init))})}};
    const call=(method,p,tok,body)=>worker.fetch(new Request('https://w.test/'+p,{method,headers:{...(tok?{'x-app-token':tok}:{}),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);
    const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
    const O='owner-secret';
    const a=await J(await call('POST','invites',O,{name:'Tess'}));
    const now=Date.now(),item={id:'t1',type:'tie',primaryColor:'navy',pattern:'solid',added:now,updated:now};
    const saved=await J(await call('PUT','sync',a.code,{baseRev:0,data:{items:[item],days:[],tombstones:{},settings:{}}}));
    const w0=n.put,b=await J(await call('POST','invites',O,{reissue:a.id})),writes=n.put-w0;
    ok(saved.s===200&&b.s===200&&b.id===a.id&&b.name==='Tess'&&/^[A-Za-z0-9_-]{32}$/.test(b.code)&&b.code!==a.code&&writes===3,`POST /invites {reissue}: a new code for the same tester, 3 writes (${JSON.stringify({s:b.s,id:b.id===a.id,writes})})`);
    const me=await J(await call('GET','me',b.code)),old=await J(await call('GET','me',a.code)),got=await J(await call('GET','sync',b.code));
    ok(me.s===200&&me.id===a.id&&old.s===403&&old.error==='invite off'&&old.replaced===true&&/replaced by a new one/.test(old.message)&&((got.data||{}).items||[]).some(i=>i.id==='t1'),`the new code opens the same account and backup; the old one is refused as replaced (${JSON.stringify({me:me.id===a.id,old})})`);
    const del=await J(await call('DELETE','account',a.code,{confirm:'delete'}));
    ok(del.s===403&&[...store.keys()].some(k=>k.startsWith(`u:${a.id}:`)),`the replaced code can't delete the account the new link opens (${del.s})`);
    const raw=[...store.values()].join('\n'),idx=JSON.parse(store.get('invites:index')).list.find(v=>v.id===a.id);
    ok(!raw.includes(a.code)&&!raw.includes(b.code)&&idx.hash===sha(b.code)&&idx.prev.includes(sha(a.code))&&!JSON.parse(store.get('invite:'+sha(a.code))).id,'codes are still kept only as fingerprints: the list follows the new one and remembers the old one; the old record says nothing about the account');
    ok((await call('POST','invites',a.code,{reissue:a.id})).status===403&&(await call('POST','invites',b.code,{reissue:a.id})).status===403&&(await J(await call('POST','invites',O,{reissue:'nosuchidxx'}))).s===404,'only the owner makes a new link, for a tester on the list');
    await call('DELETE','invites?id='+a.id,O);
    ok((await J(await call('POST','invites',O,{reissue:a.id}))).s===400,'a switched-off invitation gets no new link');
    await call('DELETE','invites?id='+a.id+'&purge=1',O);
    ok(!store.has('invite:'+sha(a.code)),'deleting the tester\'s data removes the replaced code too')}

  // ---- the app (a stand-in server)
  const HOST='https://w.test/',EVIL='https://evil.example.com/',A='a'.repeat(32),A2='c'.repeat(32),B='b'.repeat(32),OW='o'.repeat(32);
  const browser=await chromium.launch();
  const page=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const st={who:{[A]:{id:'aaaaaaaaaa',name:'Ann',role:'tester'},[A2]:{id:'aaaaaaaaaa',name:'Ann',role:'tester'},[B]:{id:'bbbbbbbbbb',name:'Bea',role:'tester'},[OW]:{id:'owner',name:'Owner',role:'owner'}},off:new Set(),replaced:new Set(),log:[],evil:[],puts:{}};
    await ctx.route(EVIL+'**',route=>{st.evil.push(route.request().method()+' '+new URL(route.request().url()).pathname);route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'x',name:'Daily Wardrobe support',role:'tester'})})});
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url()),tok=q.headers()['x-app-token'],me=st.who[tok];st.log.push(q.method()+' '+u.pathname+' '+(tok||'').slice(0,1));
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(st.replaced.has(tok))return j({error:'invite off',replaced:true,message:'This invitation link was replaced by a new one.'},403);
      if(st.off.has(tok))return j({error:'invite off',message:'This invitation has been switched off.'},403);
      if(!me)return j({error:'forbidden token'},403);
      if(u.pathname==='/me')return j({...me,caps:me.role==='owner'?null:{tag:40,pattern:10,item:20,describe:10},used:{}});
      if(u.pathname==='/sync'){if(q.method()==='GET')return j({rev:0,saved:0,data:st.puts[me.id]||null});try{st.puts[me.id]=JSON.parse(q.postData()).data}catch{}return j({rev:1,saved:Date.now()})}
      if(u.pathname==='/invites')return j({invites:[]});
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);return {ctx,p,errs,st}};
  const link=(t,w=HOST)=>'#invite='+t+'&w='+encodeURIComponent(w);
  const seed=(p,tok,n=3,m={role:'tester'})=>p.evaluate(async([h,t,n,m])=>{if(t){localStorage.setItem('worker_url',h);localStorage.setItem('app_token',t);rememberRole(m)}
    for(let k=0;k<n;k++){const it={id:'own'+k,type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:Date.now()};await put(it);items.push(it)}},[HOST,tok,n,m]);
  const ask=async p=>{try{await p.waitForSelector('#ask-ok',{state:'visible',timeout:6000})}catch{return null}return {t:await p.textContent('#ask-sheet'),ok:await p.textContent('#ask-ok')}};
  const state=p=>p.evaluate(()=>({url:localStorage.getItem('worker_url'),tok:localStorage.getItem('app_token'),n:items.length,toast:(window.__toasts&&__toasts.length?__toasts[__toasts.length-1]:'')||(document.querySelector('#toast')||{}).textContent||''}));
// each toast's words as shown (a faded toast is emptied, W2-19-06, and `ask` waits 6 s for a question that may not come)
const noteToasts=p=>p.evaluate(()=>{if(window.__toasts)return;window.__toasts=[];const t0=toast;window.toast=function(t,...a){__toasts.push(String(t));return t0.call(this,t,...a)}});
  try{
    // W2-13-01: a link to a stranger's server on a phone that isn't connected: refused, nothing sent anywhere
    {const {p,st,errs}=await page();await seed(p,null,2);
      const r=await p.evaluate(l=>connectFromLink(l,{address:true}),link('Q'+'q'.repeat(31),EVIL));const s=await state(p);
      ok(r===false&&!s.url&&st.evil.length===0&&/server this app doesn’t use/.test(s.toast),`W2-13-01: a link naming another server is refused before anything is asked or sent (${JSON.stringify({r,s,evil:st.evil})})`);
      // W2-13-11: a server part of 200,000 characters isn't a link
      const r2=await p.evaluate(l=>connectFromLink(l,{address:true}),link(A,HOST+'x'.repeat(2000)));
      ok(r2===false&&(await p.evaluate(()=>acctWhy))==='bad'&&!(await p.evaluate(()=>location.hash)),'W2-13-11: a link with an endless server part is refused as unreadable and leaves the address');
      // W1-7-03 / W1-11-01: a phone with pieces of its own is asked before they go into the account
      const res=p.evaluate(l=>connectFromLink(l),link(A));const q=await ask(p);
      ok(q&&/Add this phone’s 2 pieces to Ann’s wardrobe/.test(q.t)&&/Add and connect/.test(q.ok),`W1-7-03/W1-11-01: the phone's own 2 pieces are asked about (${q&&q.t.slice(0,120)})`);
      await p.click('#ask-cancel');const rr=await res;const s2=await state(p);
      ok(rr===false&&!s2.tok&&!st.log.some(l=>/\/sync/.test(l)),'Cancel: not connected, nothing backed up');
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    // W2-13-04: the same code with another server, on a connected phone: refused, the code never sent there
    {const {p,st}=await page();await seed(p,A,2);
      const r=await p.evaluate(l=>connectFromLink(l,{address:true}),link(A,EVIL));const s=await state(p);
      ok(r===false&&s.url===HOST&&st.evil.length===0,`W2-13-04: the same code with another server changes nothing and sends nothing there (${JSON.stringify({r,url:s.url,evil:st.evil})})`)}
    // W1-7-01: switched off while this phone heard nothing: the server is asked about the old code, and the wardrobe is kept
    {const {p,st}=await page();await seed(p,A,3);st.off.add(A);
      const res=p.evaluate(l=>connectFromLink(l),link(B));const q=await ask(p);
      ok(q&&/Back up this phone’s wardrobe with Bea’s invitation/.test(q.t)&&!/Clear/.test(q.ok),`W1-7-01: a phone that hadn't heard of the switch-off is offered to keep its wardrobe, not "Clear and switch" (${q&&q.t.slice(0,90)} / ${q&&q.ok})`);
      await p.click('#ask-ok');await res;const s=await state(p);
      ok(s.tok===B&&s.n===3,`and keeps its 3 pieces with the new invitation (${JSON.stringify(s)})`)}
    // decision 1: the owner's new link for the same tester: no question, nothing cleared, the same backup
    {const {p,st}=await page();await seed(p,A,3,{role:'tester',id:'aaaaaaaaaa'});await p.evaluate(()=>localStorage.setItem('sync_mark',JSON.stringify({sig:'x'})));st.replaced.add(A);
      await noteToasts(p);const r=await p.evaluate(l=>connectFromLink(l,{address:true}),link(A2));const q=await ask(p);const s=await state(p);
      ok(r===true&&!q&&s.tok===A2&&s.n===3&&/same wardrobe/.test(s.toast)&&(await p.evaluate(()=>!!localStorage.getItem('sync_mark'))),`a new link for the same account switches with no question and keeps the wardrobe and its backup marks (${JSON.stringify({r,q:!!q,s})})`)}
    // W1-6-03 and the replaced link: what the phone is told once
    {const {p,st}=await page();await seed(p,A,1);st.replaced.add(A);
      await p.evaluate(()=>syncNow());await p.waitForTimeout(400);
      ok(/replaced by a new one/.test((await state(p)).toast),'a replaced link: the phone is told the new link opens the same wardrobe');
      const g=await page();await seed(g.p,B,1);delete g.st.who[B];await g.p.evaluate(()=>syncNow());await g.p.waitForTimeout(400);
      ok(/backup on the server was deleted/.test((await state(g.p)).toast),'W1-6-03: an account deleted elsewhere says the backup was deleted, not only "invitation ended"')}
    // W2-13-04: an empty connected phone is asked before its connection goes
    {const {p}=await page();await seed(p,A,0);
      const res=p.evaluate(l=>connectFromLink(l),link(B));const q=await ask(p);
      ok(q&&/Switch this phone to Bea’s invitation/.test(q.t)&&/connected as Ann/.test(q.t),`an empty connected phone is asked, naming its connection (${q&&q.t.slice(0,140)})`);
      await p.click('#ask-cancel');await res;ok((await state(p)).tok===A,'Cancel keeps it')}
    // W1-7-02 / W1-7-04: the owner's phone opening a tester's link is told how to come back, and Connection keeps the way back
    {const {p}=await page();await seed(p,OW,2,{role:'owner',id:'owner'});
      const res=p.evaluate(l=>connectFromLink(l),link(B));const q=await ask(p);
      ok(q&&/I run the server/.test(q.t)&&!/open that invitation’s link again/.test(q.t)&&/has no wardrobe yet, the setup starts again/.test(q.t),`W1-7-02/W1-7-04: the owner is told how to come back, and the setup is said only for an empty account (${q&&q.t.slice(0,300)})`);
      await Promise.all([p.waitForEvent('load',{timeout:15000}),p.click('#ask-ok')]);await res.catch(()=>{});await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>{if(typeof setupShown==='function'&&setupShown())setupFinish(false)});await p.waitForTimeout(300);
      await p.evaluate(()=>{openSettings('connection');renderConnUI()});await p.waitForTimeout(300);
      const v=await p.evaluate(()=>({mark:localStorage.getItem('acct_was_owner'),btn:!!document.querySelector('#conn-own button')}));
      await p.click('#conn-own button');const adv=await p.isVisible('#cfg-token');
      ok(v.mark==='1'&&v.btn&&adv,`after the switch Connection offers "I run the server" with the address and code (${JSON.stringify({...v,adv})})`);
      // typing the owner's code back goes through the same question (no silent merge of the tester's wardrobe into the owner's)
      await seed(p,null,1);await p.fill('#cfg-url',HOST);await p.fill('#cfg-token',OW);await p.evaluate(()=>saveSettings());
      const q2=await ask(p);
      ok(q2&&/Switch this phone back to your own wardrobe/.test(q2.t),`typing the owner's code back asks first (${q2&&q2.t.slice(0,80)})`);
      await p.click('#ask-cancel');await p.waitForTimeout(200);ok((await state(p)).tok===B,'Cancel keeps the tester connection')}
    // W1-11-01: the Welcome says the backup comes back with the link
    {const {p}=await page();await p.evaluate(()=>{if(typeof setupOpen==='function')setupOpen(false)});await p.waitForTimeout(300);
      ok(/Open that link again/.test(await p.evaluate(()=>(document.querySelector('#su-before')||{}).textContent||'')),'W1-11-01: the Welcome says the invitation link brings the backed-up wardrobe back')}
  }finally{await browser.close()}
};
