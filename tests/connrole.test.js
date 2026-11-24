// The body's connection classes after localStorage lost the connection (account.js acctStart): app.js connRestored puts it back from the
// database, which can finish after account.js first set the classes, and the phone then stayed `nocon` (connected, its server's parts of
// the app hidden) until Settings was opened. Another tab holds the database's meta store through the reload, so the restore always
// comes last here. Chromium and WebKit, Settings never opened.
const HOST='https://w.test/';
const classes=p=>p.evaluate(()=>['owner','tester','nocon'].filter(c=>document.body.classList.contains(c)).join());
module.exports=async({ok,engines,url})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{const T=eng+': ',errs=[];
      const open=async role=>{const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
        await ctx.addInitScript(()=>{try{localStorage.setItem('tour_seen','1')}catch(e){}});
        await ctx.route(u=>!u.href.startsWith(new URL(url).origin+'/'),r=>{const u=new URL(r.request().url());if(!r.request().url().startsWith(HOST))return r.abort();
          return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(u.pathname==='/sync'?{rev:0,saved:0,data:null}:u.pathname==='/me'?{id:'u1',name:'Sam',role,caps:null,used:{}}:{ok:true})})});
        const p=await ctx.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);return {ctx,p}};
      // a second tab, on a plain file of the same site, keeps a write open on the meta store for `ms`: the app's read of its copy waits for it
      const hold=async(ctx,ms)=>{const h=await ctx.newPage();await h.goto(new URL('icon-192.png',url).href);
        await h.evaluate(ms=>new Promise((yes,no)=>{const o=indexedDB.open('wardrobe');o.onerror=()=>no(o.error);o.onsuccess=()=>{const d=o.result,t=d.transaction('meta','readwrite'),s=t.objectStore('meta'),end=performance.now()+ms;
          const spin=()=>{if(performance.now()<end)s.get('lab-hold').onsuccess=spin};spin();t.oncomplete=()=>d.close();yes()}}),ms);return h};
      const restart=async(o,ms=1200)=>{const h=await hold(o.ctx,ms);await o.p.reload();await o.p.waitForFunction(()=>window.appReady);await o.p.evaluate(()=>connRestored);await o.p.waitForTimeout(150);await h.close()};
      for(const role of ['tester','owner']){const o=await open(role),p=o.p;
        await p.evaluate(async([h,role])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','lab-code');await connKeep();rememberRole({role,id:'u1'})},[HOST,role]);
        await restart(o);
        ok(await classes(p)===role,T+`a ${role}'s phone that kept its connection starts as ${role} (${await classes(p)})`);
        await p.evaluate(()=>{for(const k of ['worker_url','app_token'])localStorage.removeItem(k)});
        await restart(o);
        const w=await p.evaluate(()=>({url:localStorage.getItem('worker_url'),open:settingsOpen(),on:isConnected()}));
        ok(w.url===HOST&&w.on&&!w.open,T+`a ${role}'s lost connection is put back, Settings not opened (${JSON.stringify(w)})`);
        ok(await classes(p)===role,T+`and the page is ${role}, not nocon, without opening Settings (${await classes(p)})`);
        await o.ctx.close()}
      const n=await open('tester');await restart(n);
      ok(await classes(n.p)==='nocon',T+`a phone with no saved connection stays nocon (${await classes(n.p)})`);
      await n.ctx.close();
      ok(!errs.length,T+'no page errors: '+errs.join(' | '))}
    finally{await browser.close()}}
};
