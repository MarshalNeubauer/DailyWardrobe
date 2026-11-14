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
    // a workday on Today (the regenerate line names a price only for a day with an outfit: run on a Friday, a day off in the
    // default Sunday-to-Thursday week, this failed whatever the code)
    const texts=()=>p.evaluate(()=>{const was=[typeof TODAY_OVERRIDE==='undefined'?undefined:TODAY_OVERRIDE,sel];TODAY_OVERRIDE='2026-11-16T12:00:00';sel=new Date(2026,10,16);cache={};const o=planFor()[key(sel)];const regen=(renderRegenUI(),(document.querySelector('#regen-status')||{}).textContent||'');TODAY_OVERRIDE=was[0];sel=was[1];cache={};return {cost:showCost(),regen,
      fb:(renderAbout(),document.querySelector('#fb-help').textContent)}});
    await as('tester');const t=await texts();
    ok(t.cost===false&&!/¢/.test(t.regen),`a tester sees no costs (${t.regen})`);
    ok(/goes to the person who invited you/.test(t.fb),'a tester is told who reads the feedback');
    await as('owner');const o=await texts();
    ok(o.cost===true&&/about 7¢/.test(o.regen)&&!/invited you/.test(o.fb)&&/^What works, what doesn’t, what is missing\.$/.test(o.fb),`the owner sees costs, and no "person who invited you" (${o.fb})`);
    ok(await p.evaluate(()=>{localStorage.setItem('app_token','another');return acctRole()===null&&showCost()}),'a remembered role belongs to its code: another code is asked again');
    // the owner's tools (the Advanced sections) are the owner's only
    const advs=role=>p.evaluate(r=>{localStorage.setItem('worker_url','https://w.test/');if(r){localStorage.setItem('app_token','code-'+r);acct.me=null;rememberRole({role:r})}else{localStorage.removeItem('worker_url');localStorage.removeItem('app_token')}applyRole();
      openSettings('schedule');return ['photos','connection'].filter(k=>getComputedStyle(document.querySelector('#adv-'+k)).display!=='none').join()},role);
    const vt=await advs('tester'),vo=await advs('owner'),vn=await advs(null);
    ok(vt===''&&/^(photos,)?connection$/.test(vo)&&vn==='connection'&&await p.evaluate(()=>!document.querySelector('#adv-tagging')),`Advanced sections: none for a tester, all of them for the owner (Schedule has none since 2026-11-14; Outfit pictures' only while item photos are on; Photo tagging has none since 2026-11-13), only the server address and code before connecting (tester "${vt}", owner "${vo}", not connected "${vn}")`);
    await p.evaluate(()=>{closeSettings();localStorage.setItem('worker_url','https://w.test/')});
    // Backup line
    const line=s=>p.evaluate(s=>{localStorage.setItem('app_token','x');for(const [k,v] of Object.entries(s))v==null?localStorage.removeItem(k):localStorage.setItem(k,v);settingsSummaries();return document.querySelector('#sum-backup').textContent},s);
    const now=Date.now(),old=new Date(2026,2,3,12).getTime();
    ok(/^Backed up today$/.test(await line({last_sync:String(now),sync_status:null})),'a backup today says so');
    ok(/^Backed up Mar 3$/.test(await line({last_sync:String(old),sync_status:null})),'an older one gives its day');
    const f=await line({last_sync:String(old),sync_status:'Backup failed: HTTP 500'});
    ok(/^Last backup failed · last saved Mar 3$/.test(f),`a failed try says so, with the last good day (${f})`);
    ok(/^Backup failed: not backed up yet$/.test(await line({last_sync:null,sync_status:'Backup failed: HTTP 500'})),'a first try that failed says nothing is backed up');
    ok(/^Not backed up yet: needs a connection$/.test(await p.evaluate(()=>{localStorage.removeItem('worker_url');settingsSummaries();return document.querySelector('#sum-backup').textContent})),'without a connection it says so');
    // one title style: descriptions start with a capital, the rest as written; a typed name exactly as typed
    const ti=await p.evaluate(()=>{const a={id:'t1',type:'suit',primaryColor:'navy',pattern:'pinstripe',secondaryColor:'white',added:1},b={...a,id:'t2',name:'navy hopsack'};
      return {a:itemTitle(a),b:itemTitle(b),cb:careName(b),tt:getComputedStyle(Object.assign(document.body.appendChild(document.createElement('span')),{className:'cap',textContent:'x'})).textTransform,
        s:[avgText(100),avgText(99.96),avgText(97.24),avgText(null)]}});
    ok(/^Navy [^A-Z]+$/.test(ti.a)&&ti.b==='navy hopsack'&&/: navy hopsack$/.test(ti.cb)&&ti.tt==='none',`a description is sentence case ("${ti.a}"), a typed name is kept as typed everywhere ("${ti.b}", "${ti.cb}")`);
    ok(ti.s.join()==='100,99.9,97.2,–','an average score has one decimal, rounded down, so it reads 100 only when every day did');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
