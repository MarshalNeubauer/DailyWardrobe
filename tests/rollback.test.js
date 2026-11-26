// Daily backups and rolling back to them.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');
const {appSrc}=require('./appsrc');

/* ---- was tests/rollback.test.js ---- */
// Roll back, backups and their messages (2026-11-15, the new-user audit, fix round 4):
// - a roll-back removes from memory the settings its copy lacks (core.js takeSettings), on this phone and the others, and they stay gone
//   after the next change (they came back for good: the removal mark lost to the stale value in memory);
// - a roll-back whose upload never arrived (Safari killed) is still uploaded as a restore at the next start, so "Before the last roll-back"
//   is kept (sync_restore);
// - open Settings is redrawn when a sync brings changes; offline backups say so in words; a code the server lost ends the invitation and a new
//   invitation keeps the phone's wardrobe; the write ceiling and feedback limits in words; the item sheet's name saved when the page goes;
//   a second phone's setup keeps the account's vest choice.
const rollback=async({ok,chromium,url,ROOT})=>{
  /* ---- the rule, in Node ---- */
  const cx={console,localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return null}}};vm.createContext(cx);
  vm.runInContext(appSrc(ROOT,'merge.js','core.js')+';this.K={stampSettings,stampAllSettings,keySettings,takeSettings,setKeys}',cx);
  const {stampSettings,stampAllSettings,keySettings,takeSettings,setKeys}=cx.K,J=o=>JSON.parse(JSON.stringify(o));
  const mem=keySettings({workdays:[0,1,2,3,4],blazerDays:[4],units:null,location:null,vestMode:'always',laundryDays:2,holidays:{country:'DE',list:[]},updated:5});
  const snap=stampAllSettings({workdays:[0,1,2,3,4],blazerDays:[4],units:null,location:null,updated:1},9000);
  for(const k of setKeys(mem))if(!(k in snap)){snap.ks[k]=9000;snap.kh[k]='-'}   // as snapshots.js rollBackState marks them
  const t=takeSettings(mem,J(snap));
  ok(!('holidays' in t)&&!('laundryDays' in t)&&t.vestMode==='auto'&&t.ks.vestMode===0,`a setting the stored copy marks removed leaves memory, or goes back to the app's default with stamp 0 (${JSON.stringify([t.holidays,t.laundryDays,t.vestMode,t.ks.vestMode])})`);
  const t2=stampSettings(J(t),9500);
  ok(t2.ks.holidays===9000&&t2.kh.holidays==='-'&&t2.ks.vestMode===0&&t2.ks.laundryDays===9000,'the next change on that phone stamps none of them back');
  const t3=takeSettings({units:'C',ks:{units:1},kh:{units:'x'}},{workdays:[1],ks:{workdays:2},kh:{workdays:'y'},updated:2});
  ok(t3.units==='C'&&JSON.stringify(t3.workdays)==='[1]','a setting only memory has, with no removal mark, stays as before');

  /* ---- two phones through the real worker (the owner's code), as tests/settingsmerge.test.js ---- */
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  try{
    let dropRestore=0,netDown=false;
    const device=async()=>{const c=await browser.newContext();
      await c.route(HOST+'**',async route=>{const r=route.request();
        if(netDown)return route.abort('internetdisconnected');   // (a routed request ignores setOffline)
        if(dropRestore&&r.method()!=='GET'&&/"reason":"restore"/.test(r.postData()||'')){dropRestore--;return route.abort('failed')}   // the upload never arrives (Safari killed)
        const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const p=await c.newPage();p.ctx=c;p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(url);
      await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);return p};
    const sync=p=>p.evaluate(()=>syncNow());
    const backup=()=>JSON.parse(store.get('wardrobe:v1')).data.settings||{};
    const A=await device();
    await A.evaluate(async()=>{settings.workdays=[0,1,2,3,4];await saveUserSettings()});await sync(A);   // the backup; today's daily copy is made before the next save
    await A.evaluate(async()=>{settings.daysOff=[{d:'2026-12-01',n:'Trip'}];settings.holidays={country:'DE',list:[],skip:[]};settings.laundryDays=2;settings.vestMode='always';await saveUserSettings();
      const it={id:'k1',type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now()};await put(it);items.push(it)});
    await sync(A);
    const B=await device();await sync(B);
    ok(await B.evaluate(()=>!!settings.daysOff&&settings.daysOff.length===1&&settings.holidays.country==='DE'),'phone B has the day off and the holidays');
    const day=await A.evaluate(()=>isoKey(new Date()));
    const rb=async(p,id,hush)=>p.evaluate(async([id,hush])=>{openSettings('backup');delete $('#snap-list').dataset.loaded;await HOOK.loadSnapshots();$('#snap-list').value=id;const r=HOOK.rollBack();await new Promise(r=>setTimeout(r,50));$('#ask-ok').click();await r;
      if(hush){clearTimeout(syncTimer);window.__rbMid={flag:localStorage.getItem('sync_restore'),n:items.length,st:localStorage.getItem('sync_status')}}return $('#snap-status').textContent},[id,!!hush]);
    const said=await rb(A,day);
    const memA=()=>A.evaluate(()=>({off:settings.daysOff||null,hol:settings.holidays||null,lau:settings.laundryDays??null,vest:settings.vestMode,n:items.length,sum:document.querySelector('#sum-daysoff').textContent}));
    const a1=await memA();
    ok(/^Rolled back\./.test(said)&&!a1.off&&!a1.hol&&a1.lau===null&&a1.vest==='auto'&&a1.n===0,`H3: after a roll-back this phone's settings in memory are the copy's: no day off, no holidays, laundry and vest as before (${said} ${JSON.stringify(a1)})`);
    ok(/^No holidays · 0 days off/.test(a1.sum),`and open Settings says so ("${a1.sum}")`);
    await sync(B);
    const b1=await B.evaluate(()=>({off:settings.daysOff||null,hol:settings.holidays||null,lau:settings.laundryDays??null}));
    ok(!b1.off&&!b1.hol&&b1.lau===null,`phone B too after its sync (${JSON.stringify(b1)})`);
    await B.evaluate(async()=>{settings.units='C';await saveUserSettings()});await sync(B);await sync(A);
    const s=backup(),a2=await memA();
    ok(!s.daysOff&&!s.holidays&&!('laundryDays' in s)&&s.units==='C',`an unrelated change on B afterwards doesn't bring them back on the server (${JSON.stringify([s.daysOff,s.holidays,s.laundryDays,s.units])})`);
    ok(!a2.off&&!a2.hol&&a2.lau===null,`nor in A's memory after it took B's change (${JSON.stringify(a2)})`);
    await A.reload();await A.waitForFunction(()=>window.appReady);await sync(A);
    const a3=await memA();ok(!a3.off&&!a3.hol&&a3.lau===null,`nor on A after a restart (${JSON.stringify(a3)})`);

    // ---- H2: the roll-back's upload never arrives (Safari killed): the next start uploads it as a restore, so the copy is kept
    await A.evaluate(async()=>{const it={id:'k2',type:'tie',primaryColor:'green',pattern:'solid',added:Date.now()};await put(it);items.push(it)});await sync(A);
    store.delete('snap:before-restore');dropRestore=1;
    // (read as the roll-back ends, its scheduled backup called off: under load the backup the redraw scheduled, 2.5 s later, went through first)
    const said2=await rb(A,day,true);
    const mid=await A.evaluate(()=>window.__rbMid);
    ok(/could not be updated yet/.test(said2)&&mid.flag==='secret'&&mid.n===0&&!store.has('snap:before-restore'),`the roll-back is on the phone, its upload marked as still to go (${said2} ${JSON.stringify(mid)})`);
    ok(/^Not backed up: the server couldn’t be reached/.test(mid.st||''),`the failed upload is said in words, not "Failed to fetch" ("${mid.st}")`);
    await A.reload();await A.waitForFunction(()=>window.appReady);
    await A.waitForFunction(()=>!localStorage.getItem('sync_restore'),null,{timeout:15000});
    const before=store.has('snap:before-restore')?JSON.parse(store.get('snap:before-restore')).data:null,server=JSON.parse(store.get('wardrobe:v1')).data;
    ok(before&&before.items.some(i=>i.id==='k2')&&!server.items.some(i=>i.id==='k2'),`after the restart the upload goes as a restore: "Before the last roll-back" holds the 2 pieces (${before&&before.items.map(i=>i.id)})`);

    // ---- open Settings is redrawn when a sync brings another phone's change
    await sync(B);await B.evaluate(()=>openSettings('schedule'));
    await A.evaluate(async()=>{settings.vestMode='always';settings.darkShirts='never';await saveUserSettings()});await sync(A);
    await sync(B);
    const ui=await B.evaluate(()=>({v:$('#cfg-vest').value,d:$('#cfg-dark')&&$('#cfg-dark').value,s:settings.vestMode}));
    ok(ui.v==='always'&&ui.s==='always'&&(ui.d==null||ui.d==='never'),`Settings open on B shows A's Suit vest and Dark shirts after B's sync (${JSON.stringify(ui)})`);
    await B.evaluate(()=>closeSettings());

    // ---- offline: words, not the browser's; back online, it backs up by itself
    await B.evaluate(async()=>{const it={id:'k3',type:'tie',primaryColor:'red',pattern:'solid',added:Date.now()};await put(it);items.push(it)});
    netDown=true;await B.ctx.setOffline(true);
    const off=await B.evaluate(async()=>{await syncNow();settingsSummaries();return {st:localStorage.getItem('sync_status'),sum:$('#sum-backup').textContent,net:plainErr('Load failed')}});
    ok(/^Not backed up: you’re offline\./.test(off.st)&&/^Waiting for a connection/.test(off.sum)&&/^you’re offline/.test(off.net),`offline: "${off.st}" / "${off.sum}" / "${off.net}"`);
    netDown=false;await B.ctx.setOffline(false);
    await B.waitForFunction(()=>!localStorage.getItem('sync_status')&&!localStorage.getItem('sync_wait'),null,{timeout:10000}).catch(()=>{});
    ok(await B.evaluate(()=>!localStorage.getItem('sync_status'))&&JSON.parse(store.get('wardrobe:v1')).data.items.some(i=>i.id==='k3'),'back online, the waiting change is backed up without a tap');
    // the write ceiling, everyone's or the tester's own
    const full=await B.evaluate(()=>[HOOK.backupFullMsg({error:'limit',what:'backup',write:true,all:true,message:'Today’s room on the server for your backups is used up (0 of 6 new photos are saved).'}),HOOK.backupFullMsg({error:'limit',what:'backup',write:true})]);
    ok(/everyone’s backups/.test(full[0])&&!/0 of 6/.test(full[0])&&/for your backups/.test(full[1]),`the write ceiling says whose room is used up (${full.join(' | ')})`);
    ok(!A.errs.length&&!B.errs.length,'no page errors: '+[...A.errs,...B.errs].join(' | '));
  }finally{await browser.close()}

  /* ---- a tester whose code the server lost, feedback limits, the item sheet's name, the setup's vest (mocked server) ---- */
  const ENDED_TXT='Your invitation has ended. Your wardrobe stays on this phone, and the app keeps working without a connection.';
  const CA='a'.repeat(32),CB='b'.repeat(32),who={[CB]:{id:'bbbbbbbbbb',name:'Bea',role:'tester'}};
  const b2=await chromium.launch();
  try{const ctx=await b2.newContext({viewport:{width:390,height:844}});let posts=[];
    await ctx.route(HOST+'**',route=>{const q=route.request(),u=new URL(q.url()),me=who[q.headers()['x-app-token']];const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(!me)return j({error:'forbidden token'},403);
      if(u.pathname==='/me')return j({...me,caps:{tag:40,pattern:10,photo:12,item:20},used:{tag:0,pattern:0,photo:0,item:0}});
      if(u.pathname==='/feedback'&&q.method()==='POST')return j({error:'limit',message:'Today’s limit of 20 messages is used up. It starts again at midnight UTC.'},429);
      if(u.pathname==='/sync'){if(q.method()==='GET')return j({rev:0,saved:0,data:null});posts.push(JSON.parse(q.postData()||'{}'));return j({rev:1,saved:Date.now()})}
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(async([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);localStorage.setItem('last_sync',String(Date.now()-864e5));HOOK.rememberRole({role:'tester'});
      const it={id:'mine1',type:'tie',primaryColor:'navy',pattern:'solid',added:1};await put(it);items.push(it)},[HOST,CA]);
    const lost=await p.evaluate(async()=>{const r=await syncNow();settingsSummaries();return {r,st:localStorage.getItem('sync_status'),line:(openSettings('backup'),$('#sync-status').textContent),sum:$('#sum-backup').textContent,toast:$('#toast').textContent,flag:localStorage.getItem('invite_lost'),tok:localStorage.getItem('app_token')}});
    ok(!lost.r&&lost.st===ENDED_TXT&&lost.line===ENDED_TXT&&/invitation has ended/.test(lost.sum)&&/backup on the server was deleted/.test(lost.toast)&&lost.flag===lost.tok,`a code the server lost: the invitation-ended sentence everywhere, the one-time message saying the backup was deleted (W1-6-03), marked as lost so a new link can keep the wardrobe (${JSON.stringify(lost).slice(0,260)})`);
    await p.evaluate(()=>closeSettings());
    const res=p.evaluate(l=>connectFromLink(l),'#invite='+CB+'&w='+encodeURIComponent(HOST));
    await p.waitForSelector('#ask-ok',{state:'visible'});const ask=await p.textContent('#ask-sheet');await p.click('#ask-ok');const okc=await res;
    await p.waitForFunction(()=>!localStorage.getItem('sync_status')||/^Backed/.test(localStorage.getItem('sync_status')),null,{timeout:8000}).catch(()=>{});
    const after=await p.evaluate(()=>({tok:localStorage.getItem('app_token'),n:items.length,flag:localStorage.getItem('invite_lost')}));
    ok(okc===true&&/old invitation has ended/.test(ask)&&after.tok===CB&&after.n===1&&!after.flag&&posts.some(b=>JSON.stringify(b).includes('mine1')),`a new invitation then keeps this phone's wardrobe and backs it up there (${JSON.stringify(after)}, ${posts.length} upload(s))`);
    // feedback refused for a daily limit: the server's sentence, not its code
    const fb=await p.evaluate(async()=>{openSettings('about');$('#fb-text').value='hello';await HOOK.sendFeedback();return {s:$('#fb-status').textContent,t:$('#fb-text').value}});
    ok(/limit of 20 messages is used up/.test(fb.s)&&!/: limit\./.test(fb.s)&&fb.t==='hello',`feedback over the day's limit says so in words and keeps the text ("${fb.s}")`);
    await p.evaluate(()=>closeSettings());
    // a name typed in the item sheet, the page going before the save's timer: saved at once
    const nm=await p.evaluate(async()=>{HOOK.itemFieldSoon('mine1','name','My lucky tie');dispatchEvent(new Event('pagehide'));await new Promise(r=>setTimeout(r,100));const st=await tx('readonly',s=>s.get('mine1'));return st&&st.name});
    ok(nm==='My lucky tie','a name typed just before the page goes is saved when it goes, not 0.6 s later');
    // a second phone's setup: the account's vest choice (stamped) is kept; a new install's default still becomes "No vest"
    const vs=await p.evaluate(()=>{const was=JSON.stringify(settings),s0=setup;HOOK.setup={...setup,first:true,vestSet:false};
      HOOK.settings=keySettings({workdays:[0,1,2,3,4],blazerDays:[4],vestMode:'auto',updated:0});const fresh=!HOOK.setupVestChosen();
      settings.vestMode='always';stampSettings(settings);const chosen=!HOOK.setupVestChosen();HOOK.setup=s0;HOOK.settings=JSON.parse(was);return {fresh,chosen}});
    ok(vs.fresh===true&&vs.chosen===false,`the setup sets "No vest" only while the vest is still the app's default (${JSON.stringify(vs)})`);
    ok(!errs.length,'no page errors: '+errs.join(' | '))}
  finally{await b2.close()}
};

/* ---- was tests/rollbackwhere.test.js ---- */
// Roll back wherever it lands (2026-11-15, the re-audit's fix round 2, Fixer 4):
// - a roll-back answered after Settings closed under its question says its result in a toast with Undo (it was written only to the closed
//   Settings page: the wardrobe vanished from Today with no word); Undo rolls back to "Before the last roll-back";
// - a first day's copy, from before the setup, brings back no settings: the setup doesn't start again, workdays and location stay;
// - the daily backups list is read when Backup opens, not only when the dropdown is focused (an iPhone opens the picker at the tap);
// - the list cap is said in words about the daily backups, not "photo list checks".
const rollbackwhere=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  // the account's backup as a new user's first open left it: the defaults, no setup, no items
  store.set('wardrobe:v1',JSON.stringify({rev:1,saved:1,data:{items:[],days:[],tombstones:{},settings:{workdays:[1,2,3,4,5],blazerDays:[],updated:1}}}));
  const browser=await chromium.launch();
  try{let capList=false,lists=0;
    const c=await browser.newContext({viewport:{width:390,height:844}});
    await c.route(HOST+'**',async route=>{const r=route.request(),u=new URL(r.url());
      if(u.searchParams.get('snaps')==='1'){lists++;if(capList)return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'limit',what:'list',cap:30,used:30,message:'Today’s limit of 30 photo list checks is used up. It starts again at midnight UTC.'})})}
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);
    await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>syncNow());
    // the setup done, a location, three pieces, backed up: today's daily copy is the one from before
    await p.evaluate(async()=>{if(typeof setupShown==='function'&&setupShown())HOOK.setupClose();settings.setupDone=Date.now();settings.workdays=[0,1,2,3];settings.location={name:'Kuwait City',lat:29.37,lon:47.98};await saveUserSettings();
      for(const [id,type,c] of [['r1','suit','navy'],['r2','shirt','white'],['r3','tie','burgundy']]){const it={id,type,primaryColor:c,pattern:'solid',added:Date.now()};await put(it);items.push(it)}});
    await p.evaluate(()=>syncNow());
    const day=await p.evaluate(()=>isoKey(new Date()));
    ok(store.has('snap:'+day)&&!JSON.parse(store.get('snap:'+day)).data.settings.setupDone,'the day\'s copy is from before the setup');

    // the list comes in as Backup opens, with no focus on the dropdown
    lists=0;await p.evaluate(()=>openSettings('backup'));
    await p.waitForFunction(()=>document.querySelectorAll('#snap-list option').length>1,null,{timeout:5000}).catch(()=>{});
    const opts=await p.evaluate(()=>({v:[...document.querySelectorAll('#snap-list option')].map(o=>o.value),focus:document.activeElement===document.querySelector('#snap-list')}));
    ok(opts.v.includes(day)&&!opts.focus&&lists===1,`opening Backup lists the daily backups without touching the dropdown (${JSON.stringify(opts)}, ${lists} list call)`);
    await p.evaluate(()=>{toggleCat('backup');toggleCat('backup');document.querySelector('#snap-list').focus()});await p.waitForTimeout(300);
    ok(lists===1,`opening it again or focusing the dropdown doesn't list again (${lists})`);

    // Roll back, and Settings goes (Back) while its question is up; the question is then answered
    const run=p.evaluate(d=>{$('#snap-list').value=d;window.__rb=HOOK.rollBack();return true},day);await run;
    await p.waitForSelector('#ask-ok',{state:'visible'});
    await p.evaluate(()=>closeSettings());
    await p.click('#ask-ok');await p.evaluate(()=>window.__rb);
    const after=await p.evaluate(()=>({n:items.length,toast:$('#toast').textContent,on:$('#toast').classList.contains('on'),undo:!!$('#toast button'),open:settingsOpen(),
      done:!!settings.setupDone,wd:settings.workdays.join(),loc:settings.location&&settings.location.name,setup:typeof setupShown==='function'&&setupShown()}));
    ok(after.n===0&&after.on&&/^Rolled back\. The wardrobe has 0 items\./.test(after.toast)&&after.undo&&!after.open,`with Settings closed the result is a toast with Undo (${JSON.stringify(after)})`);
    ok(after.done&&after.wd==='0,1,2,3'&&after.loc==='Kuwait City'&&!after.setup&&/settings were kept/.test(after.toast),`a copy from before the setup keeps the settings: no setup again, workdays and location stay (${JSON.stringify(after)})`);
    const srv=JSON.parse(store.get('wardrobe:v1')).data;
    ok(srv.items.length===0&&srv.settings.setupDone&&String(srv.settings.workdays)==='0,1,2,3','the server holds the same: no pieces, the settings as they were');

    // the toast's Undo asks, then brings the pieces back from "Before the last roll-back"
    await p.click('#toast button');await p.waitForSelector('#ask-ok',{state:'visible'});
    const ask=await p.textContent('#ask-sheet');await p.click('#ask-ok');
    await p.waitForFunction(()=>items.length===3&&/^Rolled back/.test($('#toast').textContent),null,{timeout:8000}).catch(()=>{});
    const undo=await p.evaluate(()=>({n:items.length,toast:$('#toast').textContent,undo:!!$('#toast button')}));
    ok(/Before the last roll-back/.test(ask)&&undo.n===3&&/^Rolled back\. The wardrobe has 3 items\./.test(undo.toast)&&!undo.undo,`Undo asks first, then the three pieces are back (${JSON.stringify(undo)})`);

    // with Settings open the line says it and no toast covers it
    await p.evaluate(()=>{toastDrop&&toastDrop();$('#toast').classList.remove('on');openSettings('backup')});
    await p.waitForFunction(()=>!document.querySelector('#snap-list').dataset.loaded||document.querySelectorAll('#snap-list option').length>1);
    await p.evaluate(()=>HOOK.loadSnapshots());
    const inS=await p.evaluate(async()=>{$('#snap-list').value='';await HOOK.rollBack();return {st:$('#snap-status').textContent,on:$('#toast').classList.contains('on')}});
    ok(inS.st==='Choose a day first.'&&!inS.on,`in open Settings the line answers and no toast (${JSON.stringify(inS)})`);
    await p.evaluate(()=>closeSettings());

    // the list cap in words about the daily backups
    capList=true;
    const cap=await p.evaluate(async()=>{delete $('#snap-list').dataset.loaded;openSettings('backup');await HOOK.loadSnapshots();return $('#snap-status').textContent});
    ok(/daily backups can’t be listed again today/.test(cap)&&!/photo list/.test(cap),`the list cap says what it means here ("${cap}")`);
    // after a restart the setup still doesn't come back
    await p.evaluate(()=>closeSettings());capList=false;
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(500);
    ok(await p.evaluate(()=>!(typeof setupShown==='function'&&setupShown())&&!!settings.setupDone),'after a restart the setup stays done');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};

/* ---- was tests/snapshots.test.js ---- */
// Daily backups: before the first overwrite of each calendar day the worker keeps the backup as it was (snap:<day>, 30 days;
// snap:<month>, a year), and the app can roll every device back to one of them, a roll-back that itself can be undone.
const snapshots=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map(),ttl=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,
    put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata);ttl.set(k,o&&o.expirationTtl)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const call=(method,q='',body,tok='secret')=>worker.fetch(new Request(HOST+'sync'+q,{method,headers:{'x-app-token':tok,'content-type':'application/json'},body:body&&JSON.stringify(body)}),env);
  const rev=()=>JSON.parse(store.get('wardrobe:v1')||'{"rev":0}').rev;
  const put=(data,day,x={})=>call('PUT','',{baseRev:rev(),data,day,...x});
  const st=n=>({items:[{id:'i'+n,type:'tie',primaryColor:'navy',added:n}],days:[],tombstones:{},settings:null});

  // worker. A save's day is the app's when it is within a day of the server's (CR-6-08), so the two days here are the day before and
  // today (today and tomorrow on the 1st: one month)
  const iso=t=>new Date(t).toISOString().slice(0,10),T=iso(Date.now()),[D0,D1]=T.endsWith('-01')?[T,iso(Date.now()+864e5)]:[iso(Date.now()-864e5),T],M=D0.slice(0,7);
  await put(st(1),D0);
  ok(![...store.keys()].some(k=>k.startsWith('snap:')),'the very first backup has nothing older to keep');
  const v1=store.get('wardrobe:v1');
  await put(st(2),D0);
  ok(store.get('snap:'+D0)===v1&&store.get('snap:'+M)===v1,'the first change of a day keeps the backup as it was, as that day and as that month');
  ok(ttl.get('snap:'+D0)===30*86400&&ttl.get('snap:'+M)===400*86400,'daily copies last 30 days, monthly ones about a year');
  await put(st(3),D0);
  ok(store.get('snap:'+D0)===v1,'later changes the same day leave that day\'s copy alone');
  await put(st(4),D1);
  ok(store.get('snap:'+D1)!==v1&&JSON.parse(store.get('snap:'+D1)).data.items[0].id==='i3'&&store.get('snap:'+M)===v1,'the next day keeps the state it started with; the month keeps its first');
  for(const k of ['snap:'+D0,'snap:'+M,'snap:'+D1])meta.set(k,{...meta.get(k),saved:1700000000000});   // all the same moment: the later date still comes first
  const L=await (await call('GET','?snaps=1')).json();
  ok(L.snaps.length===3&&L.snaps.every(s=>s.saved&&s.rev)&&L.snaps[0].id===D1,'GET ?snaps=1 lists the copies, newest first');
  const g=await (await call('GET','?snap='+D0)).json();
  ok(g.data.items[0].id==='i1','GET ?snap=<day> returns that copy');
  ok((await call('GET','?snap=../wardrobe')).status===400&&(await call('GET','?snap=2025-01-01')).status===404&&(await call('GET','?snaps=1',undefined,'nope')).status===403,'bad ids, missing copies and a wrong token are refused');
  const before=store.get('wardrobe:v1');await put(st(5),D1,{reason:'restore'});
  ok(store.get('snap:before-restore')===before,'a roll-back first keeps the backup it replaces');
  await put(st(6),'not-a-date');
  ok([...store.keys()].some(k=>/^snap:\d{4}-\d{2}-\d{2}$/.test(k)),'a missing or bad day falls back to the worker\'s own date');
  // a phone whose clock is days behind (or ahead): its copies go under the server's date, not a day of its own (CR-6-08: one behind kept
  // snap:2020-01-01 and snap:2020-01, two writes for every date it sent)
  {store.clear();meta.clear();ttl.clear();const far=iso(Date.now()-40*864e5);
    await put(st(1),far);await put(st(2),far);await put(st(3),'2020-01-01');
    const ids=[...store.keys()].filter(k=>k.startsWith('snap:')).sort();
    ok(ids.join()===['snap:'+T.slice(0,7),'snap:'+T].join(),`a day more than one away from the server's is taken as the server's (${ids.join(', ')})`);}

  // large backups: over 20 MB the photos are cut out unparsed and the rest is saved like any other (backup-storage.test.js); one whose
  // photos can't be cut out is refused (CR-6-02: it was kept in parts as it came, past the record check and the write cap); a backup
  // kept in parts before (KV holds 25 MiB a value) is still read, copied and replaced; over 48 MB is refused
  store.clear();meta.clear();ttl.clear();
  {const big=n=>({items:[{id:'big',type:'suit',primaryColor:'navy',added:1,photo:'data:image/jpeg;base64,'+'A'.repeat(n)}],days:[],tombstones:{},settings:null});
    const raw=o=>worker.fetch(new Request(HOST+'sync',{method:'PUT',headers:{'x-app-token':'secret','content-type':'application/json'},body:typeof o==='string'?o:JSON.stringify(o)}),env);
    const r1=await raw({baseRev:0,day:D0,data:big(30e6)});
    ok(r1.status===413&&!store.size,`a 30 MB backup whose one photo is too large to cut out is refused, nothing stored (${r1.status})`);
    const pad=raw({baseRev:0,day:D0,data:{items:[{id:'pad',type:'tie',notes:'x'.repeat(21*1024*1024),added:1}],days:[],tombstones:{}}});
    ok((await pad).status===413&&!store.size,'so is one with no photos to cut out');
    // a backup the worker kept in parts before 2026-11-17: the first part under the key, the rest under <key>~<rev>~<i>
    const PM=20*1024*1024,keepParted=(rev,n)=>{const t=Buffer.from(JSON.stringify({rev,saved:1000+rev,data:big(n)}));const parts=Math.ceil(t.length/PM);
      for(let i=1;i<parts;i++)store.set(`wardrobe:v1~${rev}~${i}`,new Uint8Array(t.subarray(i*PM,(i+1)*PM)).buffer);store.set('wardrobe:v1',new Uint8Array(t.subarray(0,PM)).buffer);meta.set('wardrobe:v1',{rev,saved:1000+rev,parts});return parts};
    ok(keepParted(2,46e6)===3,'(a 46 MB backup kept in three parts)');
    const KVp={...KV,get:async(k,t)=>{const v=store.get(k);if(v instanceof ArrayBuffer&&t!=='arrayBuffer'){const s=Buffer.from(v).toString();return t==='json'?JSON.parse(s):s}return KV.get(k,t)}};env.WARDROBE=KVp;
    let back=await (await call('GET')).json();
    ok(back.rev===2&&back.saved===1002&&back.data.items[0].photo.length===46e6+23,'it comes back whole');
    const c=await raw({baseRev:0,day:D1,data:st(8)});const cj=await c.json();
    ok(c.status===409&&cj.error==='conflict'&&cj.rev===2&&cj.data.items[0].photo.length===46e6+23,'a conflict hands back the stored parted backup to merge with');
    back=await (await call('GET','?v=2:1002')).json();
    ok(back.same===true,'an unchanged parted backup costs one tiny request');
    ok((await raw({baseRev:2,day:D1,data:big(51e6)})).status===413,'over 48 MB is refused');
    const old=await raw(JSON.stringify({baseRev:2,data:big(25e6),day:D1}));
    ok(old.status===413&&/update the app/.test((await old.json()).error),'a large backup from an app that sends its data first is asked to update');
    const r3=await call('PUT','',{baseRev:2,data:st(9),day:D1});
    ok(r3.status===200&&typeof store.get('wardrobe:v1')==='string'&&!meta.get('wardrobe:v1').parts&&![...store.keys()].some(k=>k.startsWith('wardrobe:v1~')),'a small backup after a parted one is one value again, and the parts are gone');
    ok(meta.get('snap:'+D1).parts===3&&store.has(`snap:${D1}~2~2`)&&ttl.get(`snap:${D1}~2~1`)===30*86400,'the daily copy of the parted backup keeps its parts, for 30 days');
    const s=await (await call('GET','?snap='+D1)).json();
    ok(s.rev===2&&s.data.items[0].photo.length===46e6+23,'and the copy comes back whole');
    const L2=await (await call('GET','?snaps=1')).json();
    ok(L2.snaps.length&&L2.snaps.every(x=>!x.id.includes('~')),'parts are not listed as backups');
    ok((await (await call('GET')).json()).data.items[0].id==='i9','and the new backup reads back');
    env.WARDROBE=KV;}

  // app: two devices; device A gets damaged, rolls back; device B follows
  store.clear();meta.clear();ttl.clear();
  const browser=await chromium.launch();
  const device=async()=>{const ctx=await browser.newContext();
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);return {p,errs}};
  const A=await device(),B=await device();
  const sig=p=>p.evaluate(()=>items.map(i=>i.id+':'+i.primaryColor).sort().join(','));
  // a device's background syncs finished first (tests/sync.test.js's quiet/hush): a sync that brought changes redraws Today, which
  // records the day and locks the week and schedules another backup; one landing after the roll-back sent the damaged copy's settings
  // up again (the flaky "roll back restores …" and "the other device follows …")
  const quiet=p=>p.evaluate(async()=>{let last='',same=0;const end=Date.now()+6000;
    while(Date.now()<end){await recordRun;const s=stateSig(await localState());same=!HOOK.syncing&&s===last?same+1:0;last=s;if(same>=3)return true;await new Promise(r=>setTimeout(r,120))}return false});
  const hush=async(...ps)=>{for(const p of ps){await quiet(p);await p.evaluate(()=>clearTimeout(syncTimer))}};
  const why=async()=>` [A ${await sig(A.p)}; good ${good}; A's workdays ${JSON.stringify(await A.p.evaluate(()=>settings.workdays))}; B ${await sig(B.p)}]`;
  await A.p.evaluate(async()=>{for(const [id,c] of [['t1','navy'],['t2','burgundy'],['t3','green']]){const it={id,type:'tie',primaryColor:c,pattern:'solid',added:Date.now()};await put(it);items.push(it)}
    const s={...settings,workdays:[1,2,3,4,5],updated:Date.now()};HOOK.settings=s;await metaPut('settings',s);await syncNow()});
  await B.p.evaluate(()=>syncNow());
  const good=await sig(A.p);
  // pretend yesterday's copy was this good state, then a bad change: one tie deleted, one recoloured, junk added, settings broken
  store.set('snap:2026-11-09',store.get('wardrobe:v1'));meta.set('snap:2026-11-09',meta.get('wardrobe:v1'));
  await A.p.evaluate(async()=>{const t=Date.now()+5;await del('t1');const tomb={...(await metaGet('tombstones')||{}),t1:t};await metaPut('tombstones',tomb);
    const b={...items.find(i=>i.id==='t2'),primaryColor:'pink',updated:t};await put(b);const j={id:'junk',type:'tie',primaryColor:'red',pattern:'solid',added:t};await put(j);
    HOOK.items=await tx('readonly',s=>s.getAll());const s={...settings,workdays:[],updated:t};HOOK.settings=s;await metaPut('settings',s);await syncNow()});
  await B.p.evaluate(()=>syncNow());
  ok(await sig(B.p)!==good&&(await sig(B.p)).includes('junk'),'(the damage reached the backup and the other device)');
  // roll back from Settings
  await A.p.evaluate(()=>openSettings&&openSettings());
  await A.p.evaluate(()=>HOOK.loadSnapshots());
  const opts=await A.p.evaluate(()=>[...document.querySelectorAll('#snap-list option')].map(o=>o.value).filter(Boolean));
  ok(opts.includes('2026-11-09'),`Settings lists the daily backups (${opts.join(', ')})`);
  await hush(A.p,B.p);
  await A.p.evaluate(async()=>{$('#snap-list').value='2026-11-09';const r=HOOK.rollBack();$('#ask-ok').click();await r});   // the app's own question: answered yes
  const a=await A.p.evaluate(()=>({st:$('#snap-status').textContent,wd:settings.workdays.length}));
  const back=await sig(A.p)===good&&a.wd===5;
  ok(back,`roll back restores the deleted tie, the old colour, drops the junk and the settings (${a.st})`+(back?'':await why()));
  await hush(A.p,B.p);
  await B.p.evaluate(()=>syncNow());
  const follows=await sig(B.p)===good&&await B.p.evaluate(()=>settings.workdays.length===5);
  ok(follows,'the other device follows the roll-back on its next sync'+(follows?'':await why()));
  ok(store.has('snap:before-restore')&&JSON.parse(store.get('snap:before-restore')).data.items.some(i=>i.id==='junk'),'the damaged state is kept as "before the last roll-back", so the roll-back can be undone');
  // and undo it
  await A.p.evaluate(async()=>{delete $('#snap-list').dataset.loaded;await HOOK.loadSnapshots();$('#snap-list').value='before-restore';const r=HOOK.rollBack();$('#ask-ok').click();await r});
  ok((await sig(A.p)).includes('junk'),'rolling back to "before the last roll-back" undoes it');
  ok(A.errs.length===0&&B.errs.length===0,'no page errors ('+[...A.errs,...B.errs].join('; ')+')');
  await browser.close();
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['rollback',rollback],['rollbackwhere',rollbackwhere],['snapshots',snapshots]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
