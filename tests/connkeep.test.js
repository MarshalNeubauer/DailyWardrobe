// The connection kept in the database too (app.js connKeep / connRestored; 2026-11-14: on the owner's iPhone the Home Screen app's
// localStorage lost the server address and the code after a forced close during an update, while the database kept the wardrobe):
// lost from localStorage, they are put back at the next start before the first sync; cleared on purpose (Settings, Done), they stay cleared.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{const ctx=await browser.newContext({viewport:{width:390,height:844}});const HOST='https://w.test/';let syncs=0;
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url());if(u.pathname==='/sync')syncs++;
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.pathname==='/sync'?{rev:0,saved:0,data:null}:u.pathname==='/me'?{id:'owner',name:'Owner',role:'owner',caps:null,used:{}}:{ok:true})})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // connected, as from Settings: the copy is written when Settings closes
    await p.evaluate(h=>{openSettings('connection');document.querySelector('#cfg-url').value=h;document.querySelector('#cfg-token').value='owner-code';saveSettings()},HOST);
    await p.waitForFunction(async()=>{const v=await metaGet('conn');return v&&v.app_token==='owner-code'});
    // the phone's localStorage loses both (the database stays), then the app starts again
    await p.evaluate(async()=>{localStorage.setItem('remind',JSON.stringify({on:true,time:'06:30'}));await connKeep()});
    await p.evaluate(()=>{for(const k of ['worker_url','app_token','remind'])localStorage.removeItem(k)});
    syncs=0;await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(800);
    const a=await p.evaluate(()=>{openSettings('connection');return {url:localStorage.getItem('worker_url'),tok:localStorage.getItem('app_token'),remind:remindPrefs(),field:document.querySelector('#cfg-url').value,code:document.querySelector('#cfg-token').value}});
    ok(a.url===HOST&&a.tok==='owner-code'&&a.field===HOST&&a.code==='owner-code',`lost from localStorage, the address and the code are put back at the next start (Settings shows ${a.field})`);
    ok(syncs>0,`and the first sync goes out with them (${syncs} sync request${syncs===1?'':'s'})`);
    ok(a.remind.on===true&&a.remind.time==='06:30','the morning reminder\'s choice is put back too');
    // cleared on purpose: stays cleared after a restart
    await p.evaluate(()=>{document.querySelector('#cfg-url').value='';document.querySelector('#cfg-token').value='';saveSettings()});
    await p.waitForFunction(async()=>{const v=await metaGet('conn');return v&&!v.app_token});
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(500);
    const b=await p.evaluate(()=>({url:localStorage.getItem('worker_url')||'',tok:localStorage.getItem('app_token')||''}));
    ok(!b.url&&!b.tok,'cleared on purpose in Settings, the connection stays cleared after a restart');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
