// Accounts and invitations after the 2026-11-14 new-user audit (account.js, ui.js, about.js): a second invitation opened on a
// connected phone asks before switching even at a cold start (the wardrobe wasn't read yet, so the phone looked empty and its
// wardrobe was merged into the other account); a link opened in the open tab connects; a mangled link says so; offline is not a
// wrong link, and an unreachable link is tried again once online; a slow check is said; the sample isn't uploaded without asking;
// an ended invitation (switched off, or the account deleted) no longer says Connected / backed up; Delete everything says it ends
// the invitation and finishes after a kill; Delete clears every key; the owner's fold stays away from a new tester; two tabs don't
// overwrite each other's settings.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
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
  const askShown=p=>p.evaluate(()=>!!(document.querySelector('#ask-ok')&&document.querySelector('#ask-ok').offsetParent));
  try{
    // ---- C1: a cold start on another invitation's link, with a wardrobe stored: the question comes (it never did)
    {const {p,errs,st}=await page();
      await p.evaluate(async([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);rememberRole({role:'tester'});
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
      await p.waitForFunction(()=>!connBusy);const msg=await p.textContent('#conn-msg');
      ok(/offline/.test(msg)&&!/copied/.test(msg),`connecting offline says so ("${msg}")`);
      await p.evaluate(()=>closeSettings());
      await p.evaluate(l=>{location.hash=l},link(A));await p.waitForFunction(()=>acctWhy==='offline',null,{timeout:8000});
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
    // ---- the sample: connecting asks to remove it first; own pieces stay
    {const {p}=await page();
      await p.evaluate(async()=>{for(const [id,s] of [['s1',true],['s2',true],['mine',false]]){const it={id,type:'tie',primaryColor:'navy',pattern:'solid',added:Date.now(),updated:Date.now(),...(s?{sample:true}:{})};await put(it);items.push(it)}});
      const r=p.evaluate(l=>connectFromLink(l),link(A));await p.waitForSelector('#ask-ok',{state:'visible'});const ask=await p.textContent('#ask-sheet');await p.click('#ask-ok');
      const res=await r;const s=await p.evaluate(async()=>({ids:items.map(i=>i.id).join(),stored:(await tx('readonly',x=>x.getAll())).map(i=>i.id).join(),tok:localStorage.getItem('app_token')}));
      ok(/sample wardrobe/.test(ask)&&res===true&&s.ids==='mine'&&s.stored==='mine'&&s.tok===A,`connecting with the sample loaded asks first and removes it before anything is backed up (${JSON.stringify(s)})`)}
    // ---- an ended invitation: nothing says Connected or backed up; a deleted account (forbidden token) counts as ended for a tester
    {const {p,st,errs}=await page();
      await p.evaluate(([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);localStorage.setItem('last_sync',String(Date.now()));rememberRole({role:'tester'})},[HOST,A]);
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
      await p.evaluate(b=>{closeSettings();localStorage.setItem('app_token',b);localStorage.removeItem('invite_ended');rememberRole({role:'tester'})},B);delete st.who[B];
      await p.evaluate(()=>syncNow());await p.waitForFunction(b=>localStorage.getItem('invite_ended')===b,B,{timeout:5000});
      const d=await p.evaluate(()=>localStorage.getItem('sync_status'));
      ok(/invitation has ended/.test(d)&&!/available/.test(d),`a deleted account counts as ended for a tester ("${d}")`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')');st.who[B]={id:'bbbbbbbbbb',name:'Bea',role:'tester'}}
    // ---- Delete everything: says it ends the invitation; a kill before the answer is finished at the next start
    {const {p,st}=await page();
      await p.evaluate(([h,a])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',a);rememberRole({role:'tester'});openSettings('about');askDelete()},[HOST,A]);
      ok(/ends it, so its link stops working/.test(await p.textContent('#del-confirm')),'a tester\'s "Delete everything" says it ends the invitation');
      await p.evaluate(async([h,a])=>{closeSettings();localStorage.setItem('del_pending',JSON.stringify({w:h,t:a}));localStorage.removeItem('worker_url');localStorage.removeItem('app_token');
        await metaPut('conn',{worker_url:h,app_token:a});const it={id:'k1',type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:1};await put(it)},[HOST,A]);   // as if killed mid-request
      st.log.length=0;await p.reload();await p.waitForFunction(()=>window.appReady&&!localStorage.getItem('del_pending'),null,{timeout:15000});await p.waitForTimeout(500);
      const k=await p.evaluate(async()=>({n:(await tx('readonly',x=>x.getAll())).length,tok:localStorage.getItem('app_token'),t:document.querySelector('#toast').textContent}));
      ok(st.log.includes('DELETE /account')&&k.n===0&&!k.tok&&/deleted/.test(k.t),`a "Delete everything" cut off by a kill is finished when the app opens again (${JSON.stringify(k)})`);
      // already deleted on the server (forbidden token): the device is cleared and told so, no "forbidden token"
      await p.evaluate(b=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token',b);rememberRole({role:'tester'})},B);delete st.who[B];
      await p.evaluate(()=>{openSettings('about');askDelete()});const nav=p.waitForNavigation();await p.click('#del-all');await nav;
      await p.waitForFunction(()=>window.appReady,null,{timeout:15000});const t2=await p.textContent('#toast');
      ok(/already been deleted/.test(t2)&&!/token/.test(t2),`a second phone's Delete everything after the account was deleted clears it and says so ("${t2}")`);st.who[B]={id:'bbbbbbbbbb',name:'Bea',role:'tester'}}
    // ---- every localStorage key the app uses, named directly or through a constant, is one Delete removes
    {const keys=new Set(),root=path.join(__dirname,'..');
      for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const src=fs.readFileSync(path.join(root,f),'utf8'),consts={};
        for(const m of src.matchAll(/const ([A-Z_]+)\s*=\s*'([a-z_0-9]+)'/g))consts[m[1]]=m[2];
        for(const m of src.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([A-Z_]+)\b/g))if(consts[m[1]])keys.add(consts[m[1]])}
      const {p}=await page();const miss=await p.evaluate(k=>k.filter(x=>!aboutOwnKey(x)),[...keys]);
      ok(keys.has('tour_seen')&&miss.length===0,`keys kept through a constant (tour_seen, tex_up, photo_up…) are deleted too (missing: ${miss.join()||'none'})`)}
    // ---- not connected: the owner's address-and-code fold only after "I run the server"
    {const {p}=await page();await p.evaluate(()=>openSettings('connection'));
      const h=await p.isVisible('#adv-connection .adv-head');await p.click('#conn-own button');
      ok(!h&&await p.isVisible('#cfg-url'),'a phone that isn\'t connected doesn\'t show "Advanced · For the person who runs the server" until "I run the server" is tapped')}
    // ---- two tabs: a stale tab's settings change doesn't put back the other tab's older settings
    {const one=await page(),two=await page({ctx:one.ctx,st:one.st});
      await one.p.evaluate(async()=>{settings.workdays=[0,1,2,3,4,5];await saveUserSettings()});await two.p.waitForFunction(()=>setOther,null,{timeout:3000}).catch(()=>{});   // (the other tab hears of it a moment later)
      await two.p.evaluate(async()=>{settings.units='C';await saveUserSettings()});
      await one.p.reload();await one.p.waitForFunction(()=>window.appReady);
      const s=await one.p.evaluate(()=>({wd:settings.workdays.join(''),u:settings.units}));
      ok(s.wd==='012345'&&s.u==='C',`two tabs: each tab's change is kept (${JSON.stringify(s)})`)}
  }finally{await browser.close()}
};
