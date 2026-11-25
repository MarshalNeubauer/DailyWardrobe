// Testers' phones report their errors by themselves (2026-11-16, the owner: a tester's very first item failed and nothing showed why).
// Worker: POST /errors keeps a tester's reports (message, code line, version, page), counted against a daily cap; GET /errors is the
// owner's; deleting the tester deletes them. App: a tester's errors, and failures the app handles (a photo not tagged), go to POST /errors
// on their own and are marked sent; the owner's phone and a phone not connected send nothing; Settings → About tells testers.
const path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const hubs=new Map(),hubOf=name=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>{st.clear()}}},{}))}return hubs.get(name)};
  const env={APP_TOKEN:'owner-secret',WARDROBE:KV,RENDER_QUEUE:{send:async()=>{}},RENDER_HUB:{idFromName:x=>x,get:name=>({fetch:(u,init)=>hubOf(name).fetch(new Request(u,init))})}};
  const call=(method,p,tok,body)=>worker.fetch(new Request('https://w.test/'+p,{method,headers:{'x-app-token':tok,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);
  const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
  // a tester
  const inv=await J(await call('POST','invites','owner-secret',{name:'Natasha'}));
  ok(inv.s===200&&inv.code,'the owner invites a tester');
  const T=inv.code;
  let r=await J(await call('POST','errors',T,{errs:[{t:Date.now(),m:'Pattern answer not drawn (shirt, motif): d.bands is not iterable',at:'settFromSpec@tagging.js:636',v:'393',w:'add'},{t:Date.now(),m:'<b>x</b>\u0001',v:'393'}]}));
  ok(r.s===200&&r.n===2,'a tester\'s phone reports two errors ('+JSON.stringify(r)+')');
  ok((await J(await call('GET','errors',T))).s===403,'a tester can\'t read the reports');
  let g=await J(await call('GET','errors','owner-secret'));
  ok(g.s===200&&g.items.length===2&&g.items.some(e=>e.name==='Natasha'&&/d\.bands/.test(e.m)&&e.v==='393'&&e.w==='add'&&e.at),'the owner reads them, with the tester\'s name, the version and the page');
  ok(g.items.every(e=>!/\u0001/.test(e.m)),'control characters are taken out');
  ok((await J(await call('POST','errors',T,{errs:[]}))).s===400,'an empty report is refused');
  // the daily cap (20 reports a day)
  let last=null;for(let k=0;k<20;k++)last=await J(await call('POST','errors',T,{errs:[{m:'again '+k}]}));
  ok(last.s===429&&last.error==='limit','over 20 reports a day are refused ('+last.s+')');
  ok((await J(await call('GET','errors','owner-secret'))).items.length===21,'what came in before the cap is kept (21)');
  // deleting the tester deletes their reports
  await call('DELETE','invites?id='+encodeURIComponent((await J(await call('GET','invites','owner-secret'))).invites[0].id)+'&purge=1','owner-secret');
  for(let k=0;k<5&&(await J(await call('GET','errors','owner-secret'))).items.length;k++)await new Promise(r=>setTimeout(r,50));
  ok((await J(await call('GET','errors','owner-secret'))).items.length===0,'deleting the tester\'s data deletes their error reports');

  // the app
  const browser=await chromium.launch();
  const open=async role=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();p.posts=[];p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
    await p.route('**/w.test/**',async rt=>{const q=rt.request();if(q.method()==='POST'&&/\/errors$/.test(q.url()))p.posts.push(JSON.parse(q.postData()||'{}'));return rt.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
    await p.addInitScript(role=>{if(!role)return;localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok-'+role);localStorage.setItem('acct_role',JSON.stringify({tok:'tok-'+role,role}))},role);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);return p};
  try{
    const p=await open('tester');
    await p.evaluate(()=>{show('add');errNote(new Error('boom'),'Close-up answer not applied (suit)')});
    await p.waitForFunction(()=>true);for(let k=0;k<80&&!p.posts.length;k++)await p.waitForTimeout(100);
    ok(p.posts.length===1&&p.posts[0].errs.length>=1&&p.posts[0].errs.some(e=>e.m==='Close-up answer not applied (suit): boom'&&e.w==='add'&&e.v),'a tester\'s error is sent by itself within seconds, with what was going on, the page and the version ('+JSON.stringify(p.posts[0]||{}).slice(0,200)+')');
    ok(await p.evaluate(()=>HOOK.errList().filter(x=>/boom/.test(x.m)).every(x=>x.s===1)),'and marked sent (kept for feedback)');
    // a photo the server didn't tag is reported too; one a phone offline couldn't send is not
    await p.evaluate(()=>{tagWhy='Claude declined this photo.';tagNetLast=false;const q={id:'x'};tagFailed(q);tagNetLast=true;tagWhy='offline';tagFailed({id:'y'})});
    ok(await p.evaluate(()=>HOOK.errList().some(x=>x.m==='Photo not tagged: Claude declined this photo.')&&!HOOK.errList().some(x=>/offline/.test(x.m))),'a photo not tagged is noted for the report; a phone offline is not');
    ok(await p.evaluate(()=>{renderAbout();return /this phone also tells them what broke and where/.test(document.querySelector('#fb-help').textContent)&&/never your photos or your wardrobe/.test(document.querySelector('#fb-help').textContent)}),'Settings → About tells a tester, and that photos and the wardrobe are never sent');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    for(const [role,what] of [['owner','the owner\'s phone'],[null,'a phone not connected']]){const o=await open(role);
      await o.evaluate(()=>errNote(new Error('boom2'),'x'));await o.waitForTimeout(6500);
      ok(o.posts.length===0&&await o.evaluate(()=>HOOK.errList().some(x=>/boom2/.test(x.m)&&!x.s)),what+' sends nothing and keeps its log');await o.context().close()}
  }finally{await browser.close()}};
