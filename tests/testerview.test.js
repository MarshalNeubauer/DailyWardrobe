// What a tester sees and what the owner sees: testers have daily limits, so no cost lines ("about 7¢"); the owner reads the
// feedback, so About doesn't tell them it "goes to the person who invited you". Settings' Backup line says what really
// happened (the last backup's day, or that the last try failed) instead of "Backed up every day".
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage({viewport:{width:390,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // the role is remembered for the connection's code
    const as=role=>p.evaluate(r=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','code-'+r);acct.me=null;rememberRole({role:r})},role);
    const texts=()=>p.evaluate(()=>{const o=planFor()[key(sel)];return {cost:showCost(),regen:(renderRegenUI(),(document.querySelector('#regen-status')||{}).textContent||''),
      fb:(renderAbout(),document.querySelector('#fb-help').textContent)}});
    await as('tester');const t=await texts();
    ok(t.cost===false&&!/¢/.test(t.regen),`a tester sees no costs (${t.regen})`);
    ok(/goes to the person who invited you/.test(t.fb),'a tester is told who reads the feedback');
    await as('owner');const o=await texts();
    ok(o.cost===true&&/about 7¢/.test(o.regen)&&!/invited you/.test(o.fb)&&/^What works, what doesn’t, what is missing\.$/.test(o.fb),`the owner sees costs, and no "person who invited you" (${o.fb})`);
    ok(await p.evaluate(()=>{localStorage.setItem('app_token','another');return acctRole()===null&&showCost()}),'a remembered role belongs to its code: another code is asked again');
    // Backup line
    const line=s=>p.evaluate(s=>{localStorage.setItem('app_token','x');for(const [k,v] of Object.entries(s))v==null?localStorage.removeItem(k):localStorage.setItem(k,v);settingsSummaries();return document.querySelector('#sum-backup').textContent},s);
    const now=Date.now(),old=new Date(2026,2,3,12).getTime();
    ok(/^Backed up today$/.test(await line({last_sync:String(now),sync_status:null})),'a backup today says so');
    ok(/^Backed up Mar 3$/.test(await line({last_sync:String(old),sync_status:null})),'an older one gives its day');
    const f=await line({last_sync:String(old),sync_status:'Backup failed: HTTP 500'});
    ok(/^Last backup failed · last saved Mar 3$/.test(f),`a failed try says so, with the last good day (${f})`);
    ok(/^Backup failed: not backed up yet$/.test(await line({last_sync:null,sync_status:'Backup failed: HTTP 500'})),'a first try that failed says nothing is backed up');
    ok(/^Not backed up yet: needs a connection$/.test(await p.evaluate(()=>{localStorage.removeItem('worker_url');settingsSummaries();return document.querySelector('#sum-backup').textContent})),'without a connection it says so');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
