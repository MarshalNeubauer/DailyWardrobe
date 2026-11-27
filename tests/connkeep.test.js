// The connection kept in the database too (app.js connKeep / connRestored; 2026-11-14: on the owner's iPhone the Home Screen app's
// localStorage lost the server address and the code after a forced close during an update, while the database kept the wardrobe):
// lost from localStorage, they are put back at the next start before the first sync; cleared on purpose (Settings, Done), they stay cleared.
// A failed read of the copy at start-up, or the app going to the background after the loss, must not write the loss over the copy.
// (waitForFunction doesn't wait for an async predicate: its promise counts as true at once. `until` reads the database for real.)
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{const HOST='https://w.test/';let syncs=0;const errs=[];
    const until=async(p,f,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await p.waitForTimeout(25)}return false};
    const open=async(init)=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});let busy=0;
      await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url());if(u.pathname==='/sync')syncs++;
        route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.pathname==='/sync'?{rev:0,saved:0,data:null}:u.pathname==='/me'?{id:'owner',name:'Owner',role:'owner',caps:null,used:{}}:{ok:true})})});
      if(init)await ctx.addInitScript(init);
      const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
      const mine=r=>r.url().startsWith(HOST);p.on('request',r=>{if(mine(r))busy++});for(const ev of ['requestfinished','requestfailed'])p.on(ev,r=>{if(mine(r))busy--});
      // no request to the server under way and no sync running or due, three looks in a row: a reload can't cut one off
      const quiet=async()=>{let still=0;await until(p,async()=>{const idle=busy===0&&await p.evaluate(()=>{if(HOOK.syncing)return false;clearTimeout(HOOK.syncTimer);return true});still=idle?still+1:0;if(still<3)await p.waitForTimeout(100);return still>=3})};
      await p.goto(url);await p.waitForFunction(()=>window.appReady);return {ctx,p,quiet}};
    const copy=p=>p.evaluate(async()=>await HOOK.metaGet('conn')||null);
    const start=async p=>{await p.reload();await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>HOOK.connRestored)};
    const hide=p=>p.evaluate(async()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));delete document.visibilityState;await new Promise(r=>setTimeout(r,150))});
    const connect=async o=>{await o.p.evaluate(async h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner-code');await HOOK.connKeep()},HOST);await o.quiet()};
    const lose=p=>p.evaluate(()=>{for(const k of ['worker_url','app_token'])localStorage.removeItem(k)});
    const held=p=>p.evaluate(()=>({url:localStorage.getItem('worker_url'),tok:localStorage.getItem('app_token')}));

    const o=await open(),p=o.p;
    // connected, as from Settings: the copy is written when the connection is made
    await p.evaluate(h=>{HOOK.openSettings('connection');document.querySelector('#cfg-url').value=h;document.querySelector('#cfg-token').value='owner-code';HOOK.saveSettings()},HOST);
    ok(await until(p,async()=>{const v=await copy(p);return !!v&&v.app_token==='owner-code'}),'connecting in Settings writes the database copy');await o.quiet();
    // the phone's localStorage loses both (the database stays), then the app starts again
    await p.evaluate(async()=>{localStorage.setItem('remind',JSON.stringify({on:true,time:'06:30'}));await HOOK.connKeep()});
    await p.evaluate(()=>{for(const k of ['worker_url','app_token','remind'])localStorage.removeItem(k)});
    syncs=0;await start(p);await until(p,()=>syncs>0);await o.quiet();
    const a=await p.evaluate(()=>{HOOK.openSettings('connection');return {url:localStorage.getItem('worker_url'),tok:localStorage.getItem('app_token'),remind:HOOK.remindPrefs(),field:document.querySelector('#cfg-url').value,code:document.querySelector('#cfg-token').value}});
    ok(a.url===HOST&&a.tok==='owner-code'&&a.field===HOST&&a.code==='owner-code',`lost from localStorage, the address and the code are put back at the next start (Settings shows ${a.field})`);
    ok(syncs>0,`and the first sync goes out with them (${syncs} sync request${syncs===1?'':'s'})`);
    ok(a.remind.on===true&&a.remind.time==='06:30','the morning reminder\'s choice is put back too');
    // a change made since still reaches the copy when the app goes to the background
    await p.evaluate(()=>localStorage.setItem('remind',JSON.stringify({on:true,time:'07:15'})));await hide(p);
    ok(await until(p,async()=>{const v=await copy(p);return !!v&&/07:15/.test(v.remind||'')&&v.app_token==='owner-code'}),'going to the background copies a changed setting and keeps the rest');
    // cleared on purpose: stays cleared after a restart, also after going to the background
    await p.evaluate(()=>{document.querySelector('#cfg-url').value='';document.querySelector('#cfg-token').value='';HOOK.saveSettings()});
    ok(await until(p,async()=>{const v=await copy(p);return !!v&&!v.app_token}),'clearing in Settings clears the copy');
    await o.quiet();await hide(p);await start(p);
    const b=await p.evaluate(()=>({url:localStorage.getItem('worker_url')||'',tok:localStorage.getItem('app_token')||''}));
    ok(!b.url&&!b.tok,'cleared on purpose in Settings, the connection stays cleared after a restart');
    await o.ctx.close();

    // the keys lost while the app is open, then the app goes to the background: the copy is not emptied
    const h=await open();await connect(h);await lose(h.p);await hide(h.p);
    const hc=await copy(h.p);ok(!!hc&&hc.worker_url===HOST&&hc.app_token==='owner-code','lost while open, going to the background keeps the database copy');
    await start(h.p);const hb=await held(h.p);ok(hb.url===HOST&&hb.tok==='owner-code','and the next start puts the connection back');
    await h.ctx.close();

    // the keys lost and the copy can't be read at this start (iOS: "Connection to Indexed Database server lost"): it survives for the next one
    const f=await open(()=>{const g=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(k){if(k==='conn'&&sessionStorage.getItem('failconn')){const e=new Error('Connection to Indexed Database server lost');e.name='UnknownError';throw e}return g.call(this,k)}});
    let unread=0;f.p.on('console',m=>{if(/connection copy not read/.test(m.text()))unread++});
    await connect(f);await lose(f.p);await f.p.evaluate(()=>sessionStorage.setItem('failconn','1'));await start(f.p);
    ok(unread>0,'(the read of the copy did fail at that start)');
    await f.p.evaluate(()=>sessionStorage.removeItem('failconn'));
    const fc=await copy(f.p);ok(!!fc&&fc.worker_url===HOST&&fc.app_token==='owner-code','a failed read at start-up leaves the database copy as it was');
    await start(f.p);const fb=await held(f.p);ok(fb.url===HOST&&fb.tok==='owner-code','and the next start puts the connection back');
    await f.ctx.close();
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
