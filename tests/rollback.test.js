// Roll back, backups and their messages (2026-11-15, the new-user audit, fix round 4):
// - a roll-back removes from memory the settings its copy lacks (core.js takeSettings), on this phone and the others, and they stay gone
//   after the next change (they came back for good: the removal mark lost to the stale value in memory);
// - a roll-back whose upload never arrived (Safari killed) is still uploaded as a restore at the next start, so "Before the last roll-back"
//   is kept (sync_restore);
// - open Settings is redrawn when a sync brings changes; offline backups say so in words; a code the server lost ends the invitation and a new
//   invitation keeps the phone's wardrobe; the write ceiling and feedback limits in words; the item sheet's name saved when the page goes;
//   a second phone's setup keeps the account's vest choice.
const path=require('path'),fs=require('fs'),vm=require('vm'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  /* ---- the rule, in Node ---- */
  const cx={console,localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return null}}};vm.createContext(cx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'merge.js'),'utf8')+fs.readFileSync(path.join(ROOT,'core.js'),'utf8')+';this.K={stampSettings,stampAllSettings,keySettings,takeSettings,setKeys}',cx);
  const {stampSettings,stampAllSettings,keySettings,takeSettings,setKeys}=cx.K,J=o=>JSON.parse(JSON.stringify(o));
  const mem=keySettings({workdays:[0,1,2,3,4],blazerDays:[4],units:null,location:null,vestMode:'always',laundryDays:2,holidays:{country:'DE',list:[]},updated:5});
  const snap=stampAllSettings({workdays:[0,1,2,3,4],blazerDays:[4],units:null,location:null,updated:1},9000);
  for(const k of setKeys(mem))if(!(k in snap)){snap.ks[k]=9000;snap.kh[k]='-'}   // as sync.js rollBackState marks them
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
    const rb=async(p,id,hush)=>p.evaluate(async([id,hush])=>{openSettings('backup');delete $('#snap-list').dataset.loaded;await loadSnapshots();$('#snap-list').value=id;const r=rollBack();await new Promise(r=>setTimeout(r,50));$('#ask-ok').click();await r;
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
    const full=await B.evaluate(()=>[backupFullMsg({error:'limit',what:'backup',write:true,all:true,message:'Today’s room on the server for your backups is used up (0 of 6 new photos are saved).'}),backupFullMsg({error:'limit',what:'backup',write:true})]);
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
    await p.evaluate(async([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);localStorage.setItem('last_sync',String(Date.now()-864e5));rememberRole({role:'tester'});
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
    const fb=await p.evaluate(async()=>{openSettings('about');$('#fb-text').value='hello';await sendFeedback();return {s:$('#fb-status').textContent,t:$('#fb-text').value}});
    ok(/limit of 20 messages is used up/.test(fb.s)&&!/: limit\./.test(fb.s)&&fb.t==='hello',`feedback over the day's limit says so in words and keeps the text ("${fb.s}")`);
    await p.evaluate(()=>closeSettings());
    // a name typed in the item sheet, the page going before the save's timer: saved at once
    const nm=await p.evaluate(async()=>{itemFieldSoon('mine1','name','My lucky tie');dispatchEvent(new Event('pagehide'));await new Promise(r=>setTimeout(r,100));const st=await tx('readonly',s=>s.get('mine1'));return st&&st.name});
    ok(nm==='My lucky tie','a name typed just before the page goes is saved when it goes, not 0.6 s later');
    // a second phone's setup: the account's vest choice (stamped) is kept; a new install's default still becomes "No vest"
    const vs=await p.evaluate(()=>{const was=JSON.stringify(settings),s0=setup;setup={...setup,first:true,vestSet:false};
      settings=keySettings({workdays:[0,1,2,3,4],blazerDays:[4],vestMode:'auto',updated:0});const fresh=!setupVestChosen();
      settings.vestMode='always';stampSettings(settings);const chosen=!setupVestChosen();setup=s0;settings=JSON.parse(was);return {fresh,chosen}});
    ok(vs.fresh===true&&vs.chosen===false,`the setup sets "No vest" only while the vest is still the app's default (${JSON.stringify(vs)})`);
    ok(!errs.length,'no page errors: '+errs.join(' | '))}
  finally{await b2.close()}
};
