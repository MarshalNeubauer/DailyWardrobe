// A tester's backups: a change waits until the app goes to the background (or 15 minutes), so every tap doesn't upload the whole
// wardrobe; over the server's daily limit the app stops uploading until the next day; an invitation that was switched off is said
// once and the app stops trying. The owner's phone still backs up 2.5 s after a change.
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/',T='t'.repeat(32);
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let mode='ok',puts=0,gets=0,rev=0;
    await ctx.route(HOST+'**',route=>{const q=route.request(),u=new URL(q.url()),j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/me')return j({id:'tttttttttt',name:'Tia',role:q.headers()['x-app-token']===T?'tester':'owner',caps:null,used:{}});
      if(u.pathname==='/sync'){
        if(mode==='ended')return j({error:'invite off',message:'This invitation has been switched off.'},403);
        if(q.method()==='GET'){gets++;return j({rev,saved:1,data:null})}
        puts++;if(mode==='limit')return j({error:'limit',what:'backup',message:'Today’s 30 backups are used up. Your changes are kept on this phone and backed up tomorrow.'},429);
        rev++;return j({rev,saved:Date.now()})}
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(([h,t])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',t);rememberRole({role:'tester'})},[HOST,T]);
    await p.waitForTimeout(3000);puts=0;
    const change=n=>p.evaluate(async n=>{const it={id:'x'+n,type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now(),updated:Date.now()};await put(it);items.push(it);scheduleSync()},n);
    const hide=()=>p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));delete document.visibilityState});
    await change(1);await p.waitForTimeout(3500);const p1=puts;
    await hide();await p.waitForFunction(()=>!syncing&&!syncDue,null,{timeout:8000});
    ok(p1===0&&puts===1,`a tester's change waits: nothing uploaded 3.5 s later, uploaded once the app goes to the background (${p1} then ${puts})`);
    ok(await p.evaluate(()=>{scheduleSync();const due=syncDue;return due>0&&due<=Date.now()&&TESTER_SYNC_MS===15*60000}),'without closing the app it goes up 15 minutes after the first change still waiting');
    await p.evaluate(()=>{clearTimeout(syncTimer);syncDue=0});
    // the daily limit
    mode='limit';await change(2);await hide();await p.waitForFunction(()=>!syncing&&!!localStorage.getItem('sync_pause'),null,{timeout:8000});
    const l=await p.evaluate(()=>({pause:+localStorage.getItem('sync_pause'),st:localStorage.getItem('sync_status')}));
    const tomorrow=await p.evaluate(()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)});
    ok(l.pause===tomorrow&&/backed up tomorrow/.test(l.st),`over the daily limit it says so and waits for the next UTC day (${l.st})`);
    const before=puts;await change(3);await hide();await p.waitForTimeout(1500);
    ok(puts===before,'no more uploads that day');
    await p.evaluate(()=>{localStorage.removeItem('sync_pause');localStorage.removeItem('sync_status')});mode='ok';
    // an invitation switched off
    mode='ended';const g0=gets;await p.evaluate(()=>syncNow());
    const e=await p.evaluate(()=>({flag:localStorage.getItem('invite_ended'),toast:document.querySelector('#toast').textContent,st:localStorage.getItem('sync_status')}));
    ok(e.flag===T&&/invitation has ended/.test(e.toast)&&/invitation has ended/.test(e.st),`an invitation switched off is said once (${e.toast})`);
    let tries=0;await p.route(HOST+'sync**',r=>{tries++;r.continue()});await p.evaluate(()=>syncNow());await p.waitForTimeout(500);
    ok(tries===0,'and the app stops trying');
    // the owner's phone: right away
    await p.evaluate(h=>{localStorage.setItem('app_token','owner');localStorage.removeItem('invite_ended');rememberRole({role:'owner'})},HOST);mode='ok';puts=0;await p.unroute(HOST+'sync**');
    await change(4);await p.waitForTimeout(4500);
    ok(puts===1,`the owner's change goes up 2.5 s later (${puts})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
