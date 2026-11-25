// Invitations and links: the invite code, switching, ended codes and their pictures.
// Joined by feature from 5 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');

/* ---- was tests/invitefix.test.js ---- */
// Accounts and invitations after the 2026-11-14 new-user audit (account.js, ui.js, about.js): a second invitation opened on a
// connected phone asks before switching even at a cold start (the wardrobe wasn't read yet, so the phone looked empty and its
// wardrobe was merged into the other account); a link opened in the open tab connects; a mangled link says so; offline is not a
// wrong link, and an unreachable link is tried again once online; a slow check is said; the sample stays on the phone, never uploaded;
// an ended invitation (switched off, or the account deleted) no longer says Connected / backed up; Delete everything says it ends
// the invitation and finishes after a kill; Delete clears every key; the owner's fold stays away from a new tester; two tabs don't
// overwrite each other's settings.
const invitefix=async({ok,chromium,url})=>{
  const HOST='https://w.test/',A='a'.repeat(32),B='b'.repeat(32);
  const browser=await chromium.launch();
  const page=async(o={})=>{const ctx=o.ctx||await browser.newContext({viewport:{width:390,height:844}});const st=o.st||{mode:'ok',who:{[A]:{id:'aaaaaaaaaa',name:'Ann',role:'tester'},[B]:{id:'bbbbbbbbbb',name:'Bea',role:'tester'}},log:[],hold:null};
    if(!o.ctx)await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url()),tok=q.headers()['x-app-token'],me=st.who[tok];st.log.push(q.method()+' '+u.pathname);
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(st.mode==='down')return route.abort();
      if(st.hold&&u.pathname==='/me')await st.hold;
      if(st.mode==='off'&&tok===A)return j({error:'invite off',message:'This invitation has been switched off.'},403);
      if(!me)return j({error:'forbidden token'},403);
      if(u.pathname==='/me')return j({...me,caps:{tag:40,pattern:10,photo:12,item:20},used:{}});
      if(u.pathname==='/sync')return q.method()==='GET'?j({rev:0,saved:0,data:null}):j({rev:1,saved:Date.now()});
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));if(!o.noGo){await p.goto(url);await p.waitForFunction(()=>window.appReady)}return {ctx,p,errs,st}};
  const link=(t,x='')=>'#invite='+t+'&w='+encodeURIComponent(HOST)+x;
  try{
    // ---- C1: a cold start on another invitation's link, with a wardrobe stored: the question comes (it never did)
    {const {p,errs,st}=await page();
      await p.evaluate(async([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);HOOK.rememberRole({role:'tester'});
        const big='data:image/jpeg;base64,'+'A'.repeat(400000);   // a wardrobe with photos: read from the database after the link is checked
        for(let n=0;n<40;n++){const it={id:'own'+n,type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:1,photo:big+n};await put(it)}},[HOST,A]);
      // a slow phone: the wardrobe is read from the database a moment after the page has loaded (on the testers' iPhones the
      // server answered the link's check first; here the database's answers to the first reads are held back 1.5 s)
      await p.addInitScript(()=>{const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete'),t0=Date.now();
        Object.defineProperty(IDBTransaction.prototype,'oncomplete',{configurable:true,get(){return d.get.call(this)},set(f){const slow=f&&Date.now()-t0<2500&&this.mode==='readonly'&&[...this.objectStoreNames].includes('items');d.set.call(this,slow?function(e){setTimeout(()=>f.call(this,e),1500)}:f)}})});
      await p.goto('about:blank');await p.goto(url+link(B));   // a fresh load (a hash change alone is read at once now)
      await p.waitForSelector('#ask-ok',{state:'visible',timeout:15000});const ask=await p.textContent('#ask-sheet');
      await p.click('#ask-cancel');await p.waitForTimeout(800);
      const s=await p.evaluate(()=>({tok:localStorage.getItem('app_token'),n:items.length}));
      ok(/Switch this phone to Bea/.test(ask)&&s.tok===A&&s.n===40,`opened cold on another invitation's link, a phone holding a wardrobe asks "Clear and switch" before anything (${JSON.stringify(s)})`);
      // the link opened in the tab that already shows the app (only the # changes): handled too
      await p.evaluate(l=>{location.hash=l},link(B));await p.waitForSelector('#ask-ok',{state:'visible',timeout:8000});
      ok(/Switch this phone/.test(await p.textContent('#ask-sheet')),'an invitation link opened in the open tab (a hash change) is read, with the same question');
      await p.click('#ask-cancel');
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    // ---- an unconnected phone: a link pasted into the open tab connects; a mangled link says so; a trailing full stop is not part of it
    {const {p,errs}=await page();
      await p.evaluate(l=>{location.hash=l},link(A,'.'));await p.waitForFunction(a=>localStorage.getItem('app_token')===a,A,{timeout:8000});
      ok(await p.evaluate(()=>/Connected as Ann/.test(document.querySelector('#toast').textContent)),'a link opened in the open tab connects, a full stop after it ignored');
      const {p:q}=await page();
      await q.evaluate(()=>{location.hash='#invite=abc123short&w='+encodeURIComponent('https://w.test/')});await q.waitForTimeout(400);
      const m=await q.evaluate(()=>({t:document.querySelector('#toast').textContent,tok:localStorage.getItem('app_token'),hash:location.hash}));
      ok(/didn’t work/.test(m.t)&&!m.tok&&!m.hash,`a mangled invitation link says it didn't work ("${m.t}")`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    // ---- offline: the paste field says offline, not "check that you copied all of it"; a link from the address is retried once online
    {const {p,st}=await page();st.mode='down';
      await p.evaluate(()=>openSettings('connection'));await p.fill('#conn-link',url+link(A));await p.click('#conn-go');
      await p.waitForFunction(()=>!HOOK.connBusy);const msg=await p.textContent('#conn-msg');
      ok(/offline/.test(msg)&&!/copied/.test(msg),`connecting offline says so ("${msg}")`);
      // (Settings' step back lands first: landing after the link is set, it takes the link out of the address. acctWhy is still 'offline'
      // from the typed try above, so the wait is for this link's own attempt: the app has started on it, and it has ended)
      await p.evaluate(async()=>{closeSettings();await backSettled()});
      await p.evaluate(l=>new Promise(r=>{addEventListener('hashchange',()=>r(),{once:true});location.hash=l}),link(A));
      await p.waitForFunction(()=>acctWhy==='offline'&&!HOOK.acctLinkRun&&!inviteChecking,null,{timeout:8000});
      const kept=await p.evaluate(()=>location.hash);
      await p.evaluate(()=>openSettings('connection'));
      const w=await p.evaluate(()=>({st:document.querySelector('#conn-state').textContent,f:document.querySelector('#conn-link').value}));
      st.mode='ok';await p.evaluate(()=>dispatchEvent(new Event('online')));
      await p.waitForFunction(a=>localStorage.getItem('app_token')===a,A,{timeout:8000});
      ok(/invite=/.test(kept)&&/couldn’t be reached/.test(w.st)&&/invite=/.test(w.f),'an unreachable link stays in the address, Connection says so with the link in the field');
      ok(true,'and it is tried again once the phone is back online')}
    // ---- a slow check is said (setup's Connection step, Settings)
    {const {p,st}=await page();let free;st.hold=new Promise(r=>free=r);
      await p.evaluate(l=>{location.hash=l},link(A));await p.waitForFunction(()=>inviteChecking,null,{timeout:5000});
      await p.evaluate(()=>openSettings('connection'));const c=await p.evaluate(()=>({box:document.querySelector('#conn-state').textContent,sum:document.querySelector('#sum-connection').textContent}));
      free();st.hold=null;await p.waitForFunction(a=>localStorage.getItem('app_token')===a,A,{timeout:8000});
      ok(/Checking your invitation/.test(c.box)&&/Checking/.test(c.sum),`while the link is checked, Connection says so (${c.box})`)}
    // ---- the sample: connecting keeps it on the phone, never backed up (kit.js kitShareFilter; re-audit 2026-11-15)
    {const {p}=await page();
      await p.evaluate(async()=>{for(const [id,s] of [['s1',true],['s2',true],['mine',false]]){const it={id,type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now(),updated:Date.now(),...(s?{sample:true}:{})};await put(it);items.push(it)}});
      // (fix round 3, W1-7-03) his own piece is asked about, the sample pieces aren't counted
      const run=p.evaluate(l=>connectFromLink(l),link(A));await p.waitForSelector('#ask-ok',{state:'visible',timeout:8000});const q=await p.textContent('#ask-sheet');await p.click('#ask-ok');const res=await run;
      ok(/Add this phone’s 1 piece to/.test(q),'connecting with the sample and one piece of his own asks about that one piece only ('+q.slice(0,60)+')');
      const s=await p.evaluate(async()=>({ask:!!document.querySelector('#ask-sheet.on'),ids:items.map(i=>i.id).sort().join(),stored:(await tx('readonly',x=>x.getAll())).map(i=>i.id).sort().join(),tok:localStorage.getItem('app_token'),share:kitShareFilter({items,days:[]},null,HOOK.syncJoinAt()).items.map(i=>i.id).join()}));
      ok(!s.ask&&res===true&&s.ids==='mine,s1,s2'&&s.stored==='mine,s1,s2'&&s.tok===A&&s.share==='mine',`connecting with the sample loaded keeps it on the phone; only his own pieces are ever backed up (${JSON.stringify(s)})`)}
    // ---- an ended invitation: nothing says Connected or backed up; a deleted account (forbidden token) counts as ended for a tester
    {const {p,st,errs}=await page();
      await p.evaluate(([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);localStorage.setItem('last_sync',String(Date.now()));HOOK.rememberRole({role:'tester'})},[HOST,A]);
      st.mode='off';await p.evaluate(()=>syncNow());await p.waitForFunction(a=>localStorage.getItem('invite_ended')===a,A);
      await p.evaluate(()=>openSettings('connection'));
      const e=await p.evaluate(()=>({conn:isConnected(),sum:document.querySelector('#sum-connection').textContent,box:document.querySelector('#conn-state').textContent,bk:document.querySelector('#sum-backup').textContent,line:document.querySelector('#sync-status').textContent,nocon:document.body.classList.contains('nocon')}));
      await p.evaluate(()=>{closeSettings();show('add')});const note=await p.textContent('#note');
      ok(!e.conn&&e.sum==='Invitation ended'&&/invitation has ended/.test(e.box)&&!/✓/.test(e.box)&&/invitation has ended/.test(e.bk)&&/invitation has ended/.test(e.line)&&e.nocon,`a switched-off invitation: Connection, Backup and the server-only parts no longer say connected (${JSON.stringify(e)})`);
      ok(!/Photos are read automatically/.test(note),`and Add doesn't promise reading ("${note}")`);
      // feedback: the server's sentence or the ended text, never "invite off"
      await p.evaluate(()=>{openSettings('about');renderAbout()});const fb=await p.evaluate(()=>({off:document.querySelector('#fb-send').disabled,t:document.querySelector('#fb-status').textContent}));
      ok(fb.off&&/invitation has ended/.test(fb.t)&&!/invite off/.test(fb.t),`Feedback says the invitation ended ("${fb.t}")`);
      // the account deleted on another phone: 403 forbidden token, said as ended, not "Backups aren't available on this server yet"
      await p.evaluate(b=>{closeSettings();localStorage.setItem('app_token',b);localStorage.removeItem('invite_ended');HOOK.rememberRole({role:'tester'})},B);delete st.who[B];
      await p.evaluate(()=>syncNow());await p.waitForFunction(b=>localStorage.getItem('invite_ended')===b,B,{timeout:5000});
      const d=await p.evaluate(()=>localStorage.getItem('sync_status'));
      ok(/invitation has ended/.test(d)&&!/available/.test(d),`a deleted account counts as ended for a tester ("${d}")`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')');st.who[B]={id:'bbbbbbbbbb',name:'Bea',role:'tester'}}
    // ---- Delete everything: says it ends the invitation; a kill before the answer is finished at the next start
    {const {p,st}=await page();
      await p.evaluate(([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);HOOK.rememberRole({role:'tester'});openSettings('about');HOOK.askDelete()},[HOST,A]);
      ok(/ends it, so its link stops working/.test(await p.textContent('#del-confirm')),'a tester\'s "Delete everything" says it ends the invitation');
      await p.evaluate(async([h,a])=>{closeSettings();localStorage.setItem('del_pending',JSON.stringify({w:h,t:a}));localStorage.removeItem('worker_url');localStorage.removeItem('app_token');
        await metaPut('conn',{worker_url:h,app_token:a});const it={id:'k1',type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:1};await put(it)},[HOST,A]);   // as if killed mid-request
      st.log.length=0;await p.reload();await p.waitForFunction(()=>window.appReady&&!localStorage.getItem('del_pending'),null,{timeout:15000});await p.waitForTimeout(500);
      const k=await p.evaluate(async()=>({n:(await tx('readonly',x=>x.getAll())).length,tok:localStorage.getItem('app_token'),t:document.querySelector('#toast').textContent}));
      ok(st.log.includes('DELETE /account')&&k.n===0&&!k.tok&&/deleted/.test(k.t),`a "Delete everything" cut off by a kill is finished when the app opens again (${JSON.stringify(k)})`);
      // already deleted on the server (forbidden token): the device is cleared and told so, no "forbidden token"
      await p.evaluate(b=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token',b);HOOK.rememberRole({role:'tester'})},B);delete st.who[B];
      await p.evaluate(()=>{openSettings('about');HOOK.askDelete()});const nav=p.waitForNavigation();await p.click('#del-all');await nav;
      await p.waitForFunction(()=>window.appReady,null,{timeout:15000});const t2=await p.textContent('#toast');
      ok(/already been deleted/.test(t2)&&!/token/.test(t2),`a second phone's Delete everything after the account was deleted clears it and says so ("${t2}")`);st.who[B]={id:'bbbbbbbbbb',name:'Bea',role:'tester'}}
    // ---- (every localStorage key the app uses through a constant is one Delete removes: tests/sourcerules.test.js, CR-10-07)
    // ---- not connected: the owner's address-and-code fold only after "I run the server"
    {const {p}=await page();await p.evaluate(()=>openSettings('connection'));
      const h=await p.isVisible('#adv-connection .adv-head');await p.click('#conn-own button');
      ok(!h&&await p.isVisible('#cfg-url'),'a phone that isn\'t connected doesn\'t show "Advanced · For the person who runs the server" until "I run the server" is tapped')}
    // ---- two tabs: a stale tab's settings change doesn't put back the other tab's older settings
    {const one=await page(),two=await page({ctx:one.ctx,st:one.st});
      await one.p.evaluate(async()=>{settings.workdays=[0,1,2,3,4,5];await saveUserSettings()});await two.p.waitForFunction(()=>HOOK.setOther,null,{timeout:3000}).catch(()=>{});   // (the other tab hears of it a moment later)
      await two.p.evaluate(async()=>{settings.units='C';await saveUserSettings()});
      await one.p.reload();await one.p.waitForFunction(()=>window.appReady);
      const s=await one.p.evaluate(()=>({wd:settings.workdays.join(''),u:settings.units}));
      ok(s.wd==='012345'&&s.u==='C',`two tabs: each tab's change is kept (${JSON.stringify(s)})`)}
  }finally{await browser.close()}
};

/* ---- was tests/invitelink.test.js ---- */
// Invitation links on a phone: a phone already connected to another wardrobe asks before switching and clears its own wardrobe
// first (a sync used to copy it into the new account); on an iPhone in Safari a tester is shown how to put the app on the Home
// Screen (which keeps storage of its own) and can copy their link from Connection; the owner can delete a switched-off tester's data.
const invitelink=async({ok,chromium,url})=>{
  const HOST='https://w.test/',A='a'.repeat(32),B='b'.repeat(32);
  const who={[A]:{id:'aaaaaaaaaa',name:'Ann',role:'tester'},[B]:{id:'bbbbbbbbbb',name:'Bea',role:'tester'},owner:{id:'owner',name:'Owner',role:'owner'}};
  const browser=await chromium.launch();
  const page=async(ctxOpt={},log=[])=>{const ctx=await browser.newContext({viewport:{width:390,height:844},...ctxOpt});
    let invites=[{id:'cccccccccc',name:'Cal',off:true,caps:{tag:40,pattern:10,photo:12,item:20},used:{tag:0,pattern:0,photo:0,item:0}}];
    await ctx.route(HOST+'**',route=>{const q=route.request(),u=new URL(q.url()),tok=q.headers()['x-app-token'],me=who[tok];log.push(q.method()+' '+u.pathname+u.search);
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(!me)return j({error:'forbidden token'},403);
      if(u.pathname==='/me')return j({...me,caps:me.role==='tester'?{tag:40,pattern:10,photo:12,item:20}:null,used:{tag:0,pattern:0,photo:0,item:0}});
      if(u.pathname==='/sync')return q.method()==='GET'?j({rev:0,saved:0,data:null}):j({rev:1,saved:Date.now()});
      if(u.pathname==='/invites'&&q.method()==='GET')return j({invites,day:'2026-11-12'});
      if(u.pathname==='/invites'&&q.method()==='DELETE'){if(u.searchParams.get('purge')==='1')invites=invites.filter(v=>v.id!==u.searchParams.get('id'));return j({ok:true})}
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);return {ctx,p,errs}};
  const link=t=>'#invite='+t+'&w='+encodeURIComponent(HOST);
  try{
    // ---- switching accounts
    const {p,errs}=await page();
    await p.evaluate(async([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);localStorage.setItem('last_sync','1');
      const it={id:'mine1',type:'tie',primaryColor:'navy',pattern:'solid',added:1};await put(it);items.push(it)},[HOST,A]);
    let res=p.evaluate(l=>connectFromLink(l),link(B));
    await p.waitForSelector('#ask-ok',{state:'visible'});
    const ask=await p.textContent('#ask-sheet');
    await p.click('#ask-cancel');res=await res;
    ok(/Switch this phone to Bea/.test(ask)&&/everything on this phone is cleared first/.test(ask)&&/has no wardrobe yet, the setup starts again/.test(ask)&&!/aren’t backed up/.test(ask)&&res===false&&await p.evaluate(a=>localStorage.getItem('app_token')===a&&items.some(i=>i.id==='mine1'),A),`a phone connected to another wardrobe asks first; Cancel keeps everything as it was ("${ask.replace(/\s+/g,' ').slice(0,90)}…")`);
    const nav=p.waitForEvent('load');p.evaluate(l=>connectFromLink(l),link(B)).catch(()=>{});
    await p.waitForSelector('#ask-ok',{state:'visible'});await p.click('#ask-ok');await nav;await p.waitForFunction(()=>window.appReady);
    const after=await p.evaluate(async()=>({tok:localStorage.getItem('app_token'),n:items.length,stored:(await tx('readonly',s=>s.getAll())).length,last:localStorage.getItem('last_sync')}));
    ok(after.tok===B&&after.n===0&&after.stored===0,`"Clear and switch" clears this phone's wardrobe and connects to the new one, so nothing of the old one reaches it (${JSON.stringify(after)})`);
    // a phone connected elsewhere but with nothing of its own switches without asking, forgetting the old account's sync marks
    await p.evaluate(()=>{localStorage.setItem('sync_mark','{"x":1}')});
    // (fix round 3, W2-13-04) an empty phone is asked too: its connection goes
    res=p.evaluate(l=>connectFromLink(l),link(A));await p.waitForSelector('#ask-ok',{state:'visible'});const ask2=await p.textContent('#ask-sheet');await p.click('#ask-ok');res=await res;
    ok(res===true&&/Nothing is stored on it yet/.test(ask2)&&await p.evaluate(a=>localStorage.getItem('app_token')===a&&localStorage.getItem('sync_mark')!=='{"x":1}',A),'with nothing on the phone it asks, says nothing is cleared, switches, and forgets the old account\'s sync marks');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // ---- iPhone in Safari
    const IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const I=await page({userAgent:IOS,permissions:['clipboard-read','clipboard-write']});
    await I.p.goto('about:blank');await I.p.goto(url+link(A));   // a fresh load: a hash change alone is read at once (account.js hashchange)
    await I.p.waitForFunction(()=>window.appReady);
    await I.p.waitForSelector('#kitsheet.on .home-copy',{state:'visible',timeout:10000});   // the one explanation (kit.js homeSteps), not a question sheet (audit 2026-11-15, H12)
    const guide=await I.p.textContent('#kitsheet');await I.p.click('#kitsheet .home-copy');
    await I.p.waitForFunction(()=>/copied/.test(document.querySelector('#toast').textContent));
    const clip=await I.p.evaluate(()=>navigator.clipboard.readText());
    ok(/Home Screen/.test(guide)&&/paste your invitation link/.test(guide)&&/Safari is connected already/.test(guide)&&clip.includes('#invite='+A)&&clip.includes('w='+encodeURIComponent(HOST)),`a tester connected in Safari on an iPhone is shown how to add the app to the Home Screen, and Copy my invitation link copies their link`);
    await I.p.click('#kit-next');await I.p.waitForFunction(()=>!document.querySelector('#kitsheet.on'));
    await I.p.evaluate(()=>{openSettings('connection');HOOK.loadAccount()});await I.p.waitForSelector('#acct-box .acct-ios');
    const box=await I.p.textContent('#acct-box');
    ok(/Copy my invitation link/.test(box)&&/Home Screen/.test(box),'Connection says so too, with a button to copy the link');
    ok(I.errs.length===0,'no page errors ('+I.errs.join('; ')+')');
    // on a computer the guide doesn't show
    const D=await page();await D.p.goto('about:blank');await D.p.goto(url+link(A));await D.p.waitForFunction(()=>window.appReady&&localStorage.getItem('app_token'));await D.p.waitForTimeout(1500);
    ok(await D.p.evaluate(()=>!(document.querySelector('#ask-ok')&&document.querySelector('#ask-ok').offsetParent)&&!document.querySelector('#kitsheet.on')),'not on a computer');
    // ---- the owner deletes a switched-off tester's data
    const log=[],Ow=await page({},log);
    await Ow.p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner')},HOST);
    await Ow.p.evaluate(()=>{openSettings('connection');HOOK.loadAccount()});await Ow.p.waitForSelector('text=Delete their data');
    const del=Ow.p.click('text=Delete their data');await Ow.p.waitForSelector('#ask-ok',{state:'visible'});const q=await Ow.p.textContent('#ask-sheet');await Ow.p.click('#ask-ok');await del;
    await Ow.p.waitForFunction(()=>!/Cal/.test(document.querySelector('#acct-box').textContent));
    ok(/can’t be undone/.test(q)&&log.includes('DELETE /invites?id=cccccccccc&purge=1'),'a switched-off invitation has "Delete their data": it asks, then deletes it on the server and takes it off the list');
    ok(Ow.errs.length===0,'no page errors ('+Ow.errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/inviteswitch.test.js ---- */
// Switching invitations without losing anything (2026-11-15, the re-audit's N1 and its neighbours; account.js, about.js, app.js,
// safety.js, photos.js): a new invitation after "Invitation ended" (switched off, or the account deleted) keeps the wardrobe and backs it up
// with the new one instead of "Clear and switch"; a live switch backs up what is waiting first, and says plainly what would be lost when it
// can't; nothing more is sent with an ended code (photos, picture requests) and its Add cards offer no Try again; Feedback's double tap and
// the day's saves used up; the Delete card of an ended invitation; a "Delete everything" cut off by a kill on a slow server; Update.
const inviteswitch=async({ok,chromium,url})=>{
  const HOST='https://w.test/',A='a'.repeat(32),B='b'.repeat(32);
  const browser=await chromium.launch();
  const page=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const st={who:{[A]:{id:'aaaaaaaaaa',name:'Ann',role:'tester'},[B]:{id:'bbbbbbbbbb',name:'Bea',role:'tester'}},off:new Set(),full:false,log:[],puts:{},fb:'ok'};
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url()),tok=q.headers()['x-app-token'],me=st.who[tok];st.log.push(q.method()+' '+u.pathname+u.search+' '+(tok||'').slice(0,1));
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(st.off.has(tok))return j({error:'invite off',message:'This invitation has been switched off.'},403);
      if(!me)return j({error:'forbidden token'},403);
      if(u.pathname==='/me')return j({...me,caps:{tag:40,pattern:10,item:20,describe:10},used:{}});
      if(u.pathname==='/sync'){if(q.method()==='GET')return j({rev:0,saved:0,data:st.puts[tok]||null});
        if(st.full)return j({error:'kv-limit',what:'backup',message:'Today’s saves on the server are used up.'},429);
        try{st.puts[tok]=JSON.parse(q.postData()).data}catch{}return j({rev:1,saved:Date.now()})}
      if(u.pathname==='/feedback'){if(st.fb==='full')return j({error:'kv-limit',what:'write',message:'Today’s saves on the server are used up. Your changes are kept on this device and are saved after the daily reset (00:00 UTC).'},429);return j({ok:true})}
      if(u.pathname==='/account'&&q.method()==='DELETE'){delete st.who[tok];return j({ok:true})}
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);return {ctx,p,errs,st}};
  const link=t=>'#invite='+t+'&w='+encodeURIComponent(HOST);
  const seed=(p,tok,n=3,ended=false)=>p.evaluate(async([h,t,n,ended])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',t);HOOK.rememberRole({role:'tester'});
    if(ended)localStorage.setItem('invite_ended',t);
    for(let k=0;k<n;k++){const it={id:'own'+k,type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:Date.now()};await put(it);items.push(it)}},[HOST,tok,n,ended]);
  const askText=async p=>{await p.waitForSelector('#ask-ok',{state:'visible',timeout:10000});return {t:await p.textContent('#ask-sheet'),ok:await p.textContent('#ask-ok')}};
  try{
    // ---- N1: switched off, then a new invitation: the wardrobe stays and goes into the new backup
    {const {p,st,errs}=await page();
      await seed(p,A,3,true);st.off.add(A);
      let res=p.evaluate(l=>connectFromLink(l),link(B));let a=await askText(p);
      ok(/Back up this phone’s wardrobe with Bea’s invitation/.test(a.t)&&/old invitation has ended/.test(a.t)&&!/Clear/.test(a.ok)&&!/another wardrobe|stays as it is/.test(a.t),`an ended invitation and a new link: the question offers to keep the wardrobe and back it up, not "Clear and switch" ("${a.t.replace(/\s+/g,' ').slice(0,120)}…" / ${a.ok})`);
      await p.click('#ask-cancel');res=await res;
      const c=await p.evaluate(a=>({tok:localStorage.getItem('app_token'),n:items.length,ended:localStorage.getItem('invite_ended')===a}),A);
      ok(res===false&&c.tok===A&&c.n===3&&c.ended,`Cancel changes nothing (${JSON.stringify(c)})`);
      res=p.evaluate(l=>connectFromLink(l),link(B));await askText(p);await p.click('#ask-ok');res=await res;
      await p.waitForFunction(b=>!!document&&localStorage.getItem('last_sync')&&localStorage.getItem('app_token')===b,B,{timeout:8000});
      await p.waitForFunction(()=>!HOOK.syncing,null,{timeout:8000});
      const k=await p.evaluate(async()=>({tok:localStorage.getItem('app_token'),n:items.length,stored:(await tx('readonly',s=>s.getAll())).length,ended:localStorage.getItem('invite_ended')}));
      const up=(st.puts[B]&&st.puts[B].items||[]).map(i=>i.id).sort().join();
      ok(res===true&&k.tok===B&&k.n===3&&k.stored===3&&!k.ended&&up==='own0,own1,own2',`"Keep it and back it up": the phone keeps its 3 pieces and they are backed up with the new invitation (${JSON.stringify(k)}, uploaded ${up})`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    // ---- the same after the account was deleted (forbidden token, never seen because syncing had stopped)
    {const {p,st}=await page();
      await seed(p,A,2,true);delete st.who[A];
      const res=p.evaluate(l=>connectFromLink(l),link(B));const a=await askText(p);await p.click('#ask-ok');await res;
      await p.waitForFunction(()=>localStorage.getItem('last_sync')&&!HOOK.syncing,null,{timeout:8000});
      ok(/Back up this phone’s wardrobe/.test(a.t)&&await p.evaluate(()=>items.length)===2&&(st.puts[B]&&st.puts[B].items||[]).length===2,'switched off and then deleted: the same, the wardrobe is kept and backed up with the new invitation')}
    // ---- a live switch with changes no backup took: backed up first, then the plain question
    {const {p,st}=await page();
      await seed(p,A,2);
      const res=p.evaluate(l=>connectFromLink(l),link(B));const a=await askText(p);
      const sentA=(st.puts[A]&&st.puts[A].items||[]).length;
      ok(sentA===2&&/everything on this phone is cleared first/.test(a.t)&&/workdays, what you wear, holidays/.test(a.t)&&/has no wardrobe yet, the setup starts again/.test(a.t)&&!/aren’t backed up/.test(a.t)&&a.ok==='Clear and switch',`a switch backs up the waiting changes first (old backup holds ${sentA}), and the question says the settings and setup go too ("${a.ok}")`);
      await p.click('#ask-cancel');await res}
    // ---- a live switch while backups are refused (the day's saves used up): it says the changes would be lost; Cancel keeps them
    {const {p,st}=await page();
      await seed(p,A,2);st.full=true;
      const res=p.evaluate(l=>connectFromLink(l),link(B));const a=await askText(p);
      ok(/aren’t backed up yet/.test(a.t)&&/loses them/.test(a.t)&&/losing those changes/.test(a.ok),`backups refused: the question says plainly that the changes would be lost ("${a.ok}")`);
      await p.click('#ask-cancel');const r=await res;
      ok(r===false&&await p.evaluate(a=>localStorage.getItem('app_token')===a&&items.length===2,A),'Cancel keeps them and the connection')}
    // ---- an ended invitation sends nothing more: a photo isn't posted, its card has no Try again, no picture requests
    {const {p,st,errs}=await page();
      await seed(p,A,1,true);st.off.add(A);st.log.length=0;
      const r=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=8;const a=await ask(c.toDataURL('image/jpeg'),{});const q={tagImg:'x',photo:'x'};tagFailed(q);
        return {a,err:q.tagErr||'',note:tagFailNote({tagErr:'This invitation has been switched off.'},0),base:workerBase()}});
      ok(r.a===null&&!r.err&&r.note===''&&r.base===null&&!st.log.some(l=>/^POST \/ /.test(l)||/\/render/.test(l)),`with the invitation ended no photo is sent, no Try again is offered, and no pictures are asked for (${st.log.join(' | ')||'no requests'})`);
      // found out by the photo's own answer: said as ended, no Try again
      await p.evaluate(a=>{localStorage.removeItem('invite_ended')},A);
      const r2=await p.evaluate(async a=>{const c=document.createElement('canvas');c.width=c.height=8;const x=await ask(c.toDataURL('image/jpeg'),{});const q={tagImg:'x',photo:'x'};tagFailed(q);return {x,err:q.tagErr||'',ended:localStorage.getItem('invite_ended')===a}},A);
      ok(r2.x===null&&!r2.err&&r2.ended,`a photo refused as switched off marks the invitation ended and leaves no Try again (${JSON.stringify(r2)})`);
      // the Delete card speaks of this device only
      await p.evaluate(()=>{openSettings('about');HOOK.askDelete()});const d=await p.evaluate(()=>({t:document.querySelector('#del-confirm').textContent,all:!!document.querySelector('#del-all')}));
      ok(!d.all&&!/backup, its daily copies|connect again to get it back|ends it/.test(d.t)&&/invitation has ended/.test(d.t),`an ended invitation's Delete card promises nothing on the server ("${d.t.replace(/\s+/g,' ').slice(0,160)}…")`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    // ---- Feedback: a double tap leaves "Thank you"; the day's saves used up doesn't promise to save it later
    {const {p,st}=await page();
      await seed(p,A,0);await p.evaluate(()=>{openSettings('about');renderAbout()});
      await p.fill('#fb-text','Nice app');await p.evaluate(()=>{HOOK.sendFeedback();setTimeout(HOOK.sendFeedback,60)});
      await p.waitForTimeout(600);const s=await p.textContent('#fb-status');
      ok(/Thank you/.test(s)&&st.log.filter(l=>/^POST \/feedback/.test(l)).length===1,`a double tap on Send sends once and keeps "Thank you" ("${s}")`);
      st.fb='full';await p.fill('#fb-text','Again');await p.evaluate(()=>HOOK.sendFeedback());await p.waitForFunction(()=>!/Sending/.test(document.querySelector('#fb-status').textContent));
      const f=await p.evaluate(()=>({s:document.querySelector('#fb-status').textContent,v:document.querySelector('#fb-text').value}));
      ok(/Send it again after/.test(f.s)&&!/kept on this device|saved after/.test(f.s)&&f.v==='Again',`feedback refused for the day's saves says to send it again, not that it is kept ("${f.s}")`)}
    // ---- Update: cards on Add come back, so only a photo still being read is asked about
    {const {p}=await page();
      await p.evaluate(()=>{queue.push({id:'r1',busy:1})});const u=p.evaluate(()=>HOOK.updateNow());const a=await askText(p);await p.click('#ask-cancel');await u;
      ok(/still being read/.test(a.t)&&!/will be lost/.test(a.t),`Update asks only about a photo still being read ("${a.t.replace(/\s+/g,' ')}")`);
      // (the question just canceled must be gone first: on a busy machine it was still fading out 300 ms later and was read as a new
      // one, CR-10-03; then either the restart or a question comes, whichever is first, instead of a look after a fixed pause)
      // (Update's own question; on a busy machine another one, from the page's start-up, was up at times and was taken for it)
      // (a question is up while #ask-sheet has .on: a canceled one keeps its text and stays laid out while it fades)
      const seen=()=>{const s=document.querySelector('#ask-sheet.on');return !!(s&&/Update now/.test(s.textContent))};
      await p.waitForFunction(()=>!document.querySelector('#ask-sheet.on'),null,{timeout:5000}).catch(()=>{});
      // (the cards are set in the same step as the tap: on a busy machine the page's own start-up could change them in between)
      const nav=p.waitForNavigation({timeout:8000}).catch(()=>null);const q0=await p.evaluate(()=>{queue.length=0;queue.push({id:'k1',manual:true,type:'tie'});HOOK.aboutUpdating=false;const q=JSON.stringify(queue.map(q=>[q.id,!!q.busy,!!q.multiBusy]));HOOK.updateNow();return q});
      const asked=await Promise.race([nav.then(()=>false),p.waitForFunction(seen,null,{timeout:8000}).then(()=>true,()=>false)]);await nav;
      ok(!asked,'a card that comes back after the restart is not a reason to ask'+(asked?` (asked, with the cards ${q0} at the tap)`:''))}
    // ---- "Delete everything" cut off by a kill on a slow server: the server deleted it; the next start finishes the job and says so
    {const {p,st}=await page();
      await seed(p,A,1);delete st.who[A];   // the server already deleted the account before the phone was killed
      await p.evaluate(async([h,a])=>{closeSettings();localStorage.setItem('del_pending',JSON.stringify({w:h,t:a}));localStorage.removeItem('worker_url');localStorage.removeItem('app_token');await metaPut('conn',{worker_url:h,app_token:a})},[HOST,A]);
      await p.reload();let k={};   // the app reloads itself once the device is cleared: read until the page after that says something
      for(const t0=Date.now();Date.now()-t0<15000;await p.waitForTimeout(200))try{k=await p.evaluate(async()=>window.appReady&&!localStorage.getItem('del_pending')?{n:(await tx('readonly',x=>x.getAll())).length,tok:localStorage.getItem('app_token'),t:document.querySelector('#toast').textContent}:{});if(/deleted/.test(k.t||''))break}catch{}
      ok(k.n===0&&!k.tok&&/already been deleted/.test(k.t)&&!/nothing was deleted/.test(k.t),`killed during "Delete everything" after the server deleted it: the phone is cleared and says the server's data is gone (${JSON.stringify(k)})`)}
  }finally{await browser.close()}
};

/* ---- was tests/linkfix.test.js ---- */
// Invitations and links (fix round 3, the third audit's W1-7-01, W1-7-02, W1-7-03, W1-7-04, W1-11-01, W1-11-02, W1-6-03, W2-13-01,
// W2-13-04, W2-13-11 and the owner's decision 1): a link is followed only to the app's own server; the old code is asked about before a
// switch; the same account under a new code switches with no question; an empty connected phone and a phone with pieces of its own are
// asked; the owner's phone keeps a way back; a new link for the same tester (worker/people.js POST /invites {reissue}).
const linkfix=async({ok,chromium,url,ROOT})=>{
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
    const st={who:{[A]:{id:'aaaaaaaaaa',name:'Ann',role:'tester'},[A2]:{id:'aaaaaaaaaa',name:'Ann',role:'tester'},[B]:{id:'bbbbbbbbbb',name:'Bea',role:'tester'},[OW]:{id:'owner',name:'Owner',role:'owner'}},off:new Set(),replaced:new Set(),log:[],evil:[],puts:{},meErr:{}};
    await ctx.route(EVIL+'**',route=>{st.evil.push(route.request().method()+' '+new URL(route.request().url()).pathname);route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'x',name:'Daily Wardrobe support',role:'tester'})})});
    await ctx.route(HOST+'**',async route=>{const q=route.request(),u=new URL(q.url()),tok=q.headers()['x-app-token'],me=st.who[tok];st.log.push(q.method()+' '+u.pathname+' '+(tok||'').slice(0,1));
      const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/me'&&st.meErr[tok]){const s=st.meErr[tok];delete st.meErr[tok];return j({error:s===429?'rate':'server',message:'The server had a problem just now.'},s)}   // (one passing error)
      if(st.replaced.has(tok))return j({error:'invite off',replaced:true,message:'This invitation link was replaced by a new one.'},403);
      if(st.off.has(tok))return j({error:'invite off',message:'This invitation has been switched off.'},403);
      if(!me)return j({error:'forbidden token'},403);
      if(u.pathname==='/me')return j({...me,caps:me.role==='owner'?null:{tag:40,pattern:10,item:20,describe:10},used:{}});
      if(u.pathname==='/sync'){if(q.method()==='GET')return j({rev:0,saved:0,data:st.puts[me.id]||null});try{st.puts[me.id]=JSON.parse(q.postData()).data}catch{}return j({rev:1,saved:Date.now()})}
      if(u.pathname==='/invites')return j({invites:[]});
      return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);return {ctx,p,errs,st}};
  const link=(t,w=HOST)=>'#invite='+t+'&w='+encodeURIComponent(w);
  const seed=(p,tok,n=3,m={role:'tester'})=>p.evaluate(async([h,t,n,m])=>{if(t){localStorage.setItem('worker_url',h);localStorage.setItem('app_token',t);HOOK.rememberRole(m)}
    for(let k=0;k<n;k++){const it={id:'own'+k,type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:Date.now()};await put(it);items.push(it)}},[HOST,tok,n,m]);
  const ask=async p=>{try{await p.waitForSelector('#ask-ok',{state:'visible',timeout:6000})}catch{return null}return {t:await p.textContent('#ask-sheet'),ok:await p.textContent('#ask-ok')}};
  const state=p=>p.evaluate(()=>({url:localStorage.getItem('worker_url'),tok:localStorage.getItem('app_token'),n:items.length,toast:(window.__toasts&&__toasts.length?__toasts[__toasts.length-1]:'')||(document.querySelector('#toast')||{}).textContent||''}));
// each toast's words as shown (a faded toast is emptied, W2-19-06, and `ask` waits 6 s for a question that may not come)
const noteToasts=p=>p.evaluate(()=>{if(window.__toasts)return;window.__toasts=[];const e=document.querySelector('#toast');new MutationObserver(()=>{const t=e.firstChild&&e.firstChild.nodeValue;if(t&&t!==__toasts[__toasts.length-1])__toasts.push(t)}).observe(e,{childList:true})});
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
    // CR-5-02: a passing server error on the old code (503, 429) is not "ended": nothing is asked or changed, the link can be tried again,
    // and then the old code's real answer decides (still on: "Clear and switch")
    for(const code of [503,429]){const {p,st}=await page();await seed(p,A,3);st.meErr[A]=code;
      await noteToasts(p);const r=await p.evaluate(l=>connectFromLink(l,{address:true}),link(B));const q=await ask(p);const s=await state(p);
      ok(r===false&&!q&&s.tok===A&&s.n===3&&/Couldn’t check the invitation this phone uses now/.test(s.toast)&&!st.puts.bbbbbbbbbb,`CR-5-02: a ${code} on the old code changes nothing and asks nothing (${JSON.stringify({r,q:q&&q.ok,s})})`);
      if(code===503){const res=p.evaluate(l=>connectFromLink(l),link(B));const q2=await ask(p);
        ok(q2&&/Clear/.test(q2.ok)&&!/Keep it/.test(q2.ok),`tried again with the server well, the old code still on: "Clear and switch", not "Keep it and back it up" (${q2&&q2.ok})`);
        await p.click('#ask-cancel');await res}}
    // CR-5-07: a first connection typed under Advanced goes through the same check and question as a link
    {const {p,st}=await page();await seed(p,null,2);
      await p.evaluate(h=>{openSettings('connection');document.querySelector('#cfg-url').value=h;document.querySelector('#cfg-token').value='z'.repeat(32);saveSettings()},HOST);
      await p.waitForFunction(()=>!HOOK.acctLinkRun,null,{timeout:6000});const s0=await state(p);
      ok(!s0.tok&&!s0.url&&!st.log.some(l=>/\/sync/.test(l)),`CR-5-07: a mistyped code typed on a phone not connected is checked and not stored (${JSON.stringify(s0)})`);
      await p.evaluate(([h,a])=>{openSettings('connection');document.querySelector('#cfg-url').value=h;document.querySelector('#cfg-token').value=a;saveSettings()},[HOST,A]);
      const q=await ask(p);
      ok(q&&/Add this phone’s 2 pieces to Ann’s wardrobe/.test(q.t),`and a right one asks "Add this phone’s 2 pieces…?" first (${q&&q.t.slice(0,80)})`);
      await p.click('#ask-ok');await p.waitForFunction(a=>localStorage.getItem('app_token')===a,A,{timeout:6000}).catch(()=>{});
      const s1=await state(p);ok(s1.tok===A&&s1.url===HOST&&s1.n===2&&(await p.evaluate(()=>acctRole())==='tester'),`Add and connect: connected, the role known (${JSON.stringify(s1)})`)}
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
    {const {p}=await page();await p.evaluate(()=>{if('setupOpen' in HOOK&&typeof HOOK.setupOpen==='function')HOOK.setupOpen(false)});await p.waitForTimeout(300);
      ok(/Open that link again/.test(await p.evaluate(()=>(document.querySelector('#su-before')||{}).textContent||'')),'W1-11-01: the Welcome says the invitation link brings the backed-up wardrobe back')}
  }finally{await browser.close()}
};

/* ---- was tests/endedpics.test.js ---- */
// After an invitation ends nothing is asked for pictures with the dead code (photos.js workerBase, workerList's 403), and the
// item pictures question names a tester's daily limit (itemPicLimitText) (2026-11-15, the re-audit: 12-45 refused requests per open)
const endedpics=async({ok,chromium,url})=>{
  const HOST='https://wardrobevision.test/',browser=await chromium.launch();
  try{
    const ctx=await browser.newContext();const hits=[];let listAnswer={status:403,body:{error:'invite off',message:'This invitation was switched off.'}};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url());hits.push(u.pathname+u.search);
      if(u.pathname==='/render'&&u.searchParams.get('list'))return route.fulfill({status:listAnswer.status,contentType:'application/json',body:JSON.stringify(listAnswer.body)});
      return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'invite off'})})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','deadcode');localStorage.setItem('invite_ended','deadcode')},HOST);
    await p.reload();await p.waitForFunction(()=>window.appReady);
    hits.length=0;
    const r=await p.evaluate(async()=>{const shoes={id:'s1',type:'shoes',primaryColor:'brown',pattern:'solid'};await fetchItemPic(shoes);await fetchRemoteRender({top:null,shirt:null},'2026-11-20');const L=await workerList(true);
      return {base:workerBase(),L}});
    ok(r.base===null&&r.L===null&&!hits.some(h=>h.startsWith('/render')),`with the invitation ended no picture request goes out (${hits.join(' ')||'none'})`);
    // a code the server refuses while this phone doesn't know yet: the list's 403 ends it, and nothing more is asked
    await p.evaluate(()=>{localStorage.removeItem('invite_ended');localStorage.setItem('app_token','offcode');localStorage.removeItem('list_pause')});hits.length=0;
    const r2=await p.evaluate(async()=>{await workerList(true);const ended=localStorage.getItem('invite_ended');HOOK.renderTried.clear();await fetchItemPic({id:'s2',type:'belt',primaryColor:'black',pattern:'solid'});return {ended,base:workerBase()}});
    ok(r2.ended==='offcode'&&r2.base===null&&hits.filter(h=>h.startsWith('/render')).length===1,`a refused list ('invite off') ends the invitation; no picture is asked for after it (${hits.join(' ')})`);
    // the owner's mistyped code (forbidden token, not a tester): not ended, but the pieces aren't asked one by one either
    await p.evaluate(()=>{localStorage.removeItem('invite_ended');localStorage.setItem('app_token','typo');remoteKeys=null;HOOK.remoteListed=false});listAnswer={status:403,body:{error:'forbidden token'}};hits.length=0;
    const r3=await p.evaluate(async()=>{HOOK.renderTried.clear();await fetchItemPic({id:'s3',type:'socks',primaryColor:'navy',pattern:'solid'});await fetchItemPic({id:'s4',type:'socks',primaryColor:'grey',pattern:'solid'});return {ended:localStorage.getItem('invite_ended')}});
    ok(!r3.ended&&hits.length===1&&hits[0]==='/render?list=1',`a refused code that isn't an ended invitation holds the picture asks for that code (${hits.join(' ')})`);
    // the daily limit in the question
    const t=await p.evaluate(()=>{const day=new Date().toISOString().slice(0,10);acct.me={caps:{item:40},used:{item:38},day};const a=HOOK.itemPicLimitText(5),b=HOOK.itemPicLimitText(2);
      acct.me={caps:{item:40},used:{item:40},day:'2000-01-01'};const old=HOOK.itemPicLimitText(3);acct.me={caps:null,used:{}};const owner=HOOK.itemPicLimitText(3);
      acct.me={caps:{item:20},used:{item:20},day};return {a,b,old,owner,up:HOOK.itemPicsUsedUp()}});
    ok(/You can make 2 more today, of your daily 40\. The first 2 are made now/.test(t.a)&&/2 more today/.test(t.b)&&!/first/.test(t.b)&&/40 more today/.test(t.old)&&t.owner===''&&t.up===20,
      `the Generate question says the day's limit ("${t.a.trim()}"); yesterday's count starts again; the owner has none`);
    const st=await p.evaluate(async()=>{if(!$('#itempic-status')){const d=document.createElement('div');d.id='itempic-status';document.body.append(d)}items=[{id:'z1',type:'shoes',primaryColor:'black',pattern:'solid'}];
      let over=false;const run=HOOK.startItemPics().finally(()=>{over=true});while(!over&&!asking)await new Promise(r=>setTimeout(r,10));const asked=!!asking;if(asked)askAnswer(false);await run;return {asked,t:$('#itempic-status').textContent}});
    ok(!st.asked&&/item pictures are used up/.test(st.t),`with the day's pictures used up it says so instead of asking ("${st.t}")`);
    ok(!errs.length,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['invitefix',invitefix],['invitelink',invitelink],['inviteswitch',inviteswitch],['linkfix',linkfix],['endedpics',endedpics]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
