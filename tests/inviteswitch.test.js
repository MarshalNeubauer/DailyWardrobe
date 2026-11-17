// Switching invitations without losing anything (2026-11-15, the re-audit's N1 and its neighbours; account.js, about.js, app.js,
// safety.js, photos.js): a new invitation after "Invitation ended" (switched off, or the account deleted) keeps the wardrobe and backs it up
// with the new one instead of "Clear and switch"; a live switch backs up what is waiting first, and says plainly what would be lost when it
// can't; nothing more is sent with an ended code (photos, picture requests) and its Add cards offer no Try again; Feedback's double tap and
// the day's saves used up; the Delete card of an ended invitation; a "Delete everything" cut off by a kill on a slow server; Update.
module.exports=async({ok,chromium,url})=>{
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
  const seed=(p,tok,n=3,ended=false)=>p.evaluate(async([h,t,n,ended])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token',t);rememberRole({role:'tester'});
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
      await p.waitForFunction(()=>!syncing,null,{timeout:8000});
      const k=await p.evaluate(async()=>({tok:localStorage.getItem('app_token'),n:items.length,stored:(await tx('readonly',s=>s.getAll())).length,ended:localStorage.getItem('invite_ended')}));
      const up=(st.puts[B]&&st.puts[B].items||[]).map(i=>i.id).sort().join();
      ok(res===true&&k.tok===B&&k.n===3&&k.stored===3&&!k.ended&&up==='own0,own1,own2',`"Keep it and back it up": the phone keeps its 3 pieces and they are backed up with the new invitation (${JSON.stringify(k)}, uploaded ${up})`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    // ---- the same after the account was deleted (forbidden token, never seen because syncing had stopped)
    {const {p,st}=await page();
      await seed(p,A,2,true);delete st.who[A];
      const res=p.evaluate(l=>connectFromLink(l),link(B));const a=await askText(p);await p.click('#ask-ok');await res;
      await p.waitForFunction(()=>localStorage.getItem('last_sync')&&!syncing,null,{timeout:8000});
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
      await p.evaluate(()=>{openSettings('about');askDelete()});const d=await p.evaluate(()=>({t:document.querySelector('#del-confirm').textContent,all:!!document.querySelector('#del-all')}));
      ok(!d.all&&!/backup, its daily copies|connect again to get it back|ends it/.test(d.t)&&/invitation has ended/.test(d.t),`an ended invitation's Delete card promises nothing on the server ("${d.t.replace(/\s+/g,' ').slice(0,160)}…")`);
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')')}
    // ---- Feedback: a double tap leaves "Thank you"; the day's saves used up doesn't promise to save it later
    {const {p,st}=await page();
      await seed(p,A,0);await p.evaluate(()=>{openSettings('about');renderAbout()});
      await p.fill('#fb-text','Nice app');await p.evaluate(()=>{sendFeedback();setTimeout(sendFeedback,60)});
      await p.waitForTimeout(600);const s=await p.textContent('#fb-status');
      ok(/Thank you/.test(s)&&st.log.filter(l=>/^POST \/feedback/.test(l)).length===1,`a double tap on Send sends once and keeps "Thank you" ("${s}")`);
      st.fb='full';await p.fill('#fb-text','Again');await p.evaluate(()=>sendFeedback());await p.waitForFunction(()=>!/Sending/.test(document.querySelector('#fb-status').textContent));
      const f=await p.evaluate(()=>({s:document.querySelector('#fb-status').textContent,v:document.querySelector('#fb-text').value}));
      ok(/Send it again after/.test(f.s)&&!/kept on this device|saved after/.test(f.s)&&f.v==='Again',`feedback refused for the day's saves says to send it again, not that it is kept ("${f.s}")`)}
    // ---- Update: cards on Add come back, so only a photo still being read is asked about
    {const {p}=await page();
      await p.evaluate(()=>{queue.push({id:'r1',busy:1})});const u=p.evaluate(()=>updateNow());const a=await askText(p);await p.click('#ask-cancel');await u;
      ok(/still being read/.test(a.t)&&!/will be lost/.test(a.t),`Update asks only about a photo still being read ("${a.t.replace(/\s+/g,' ')}")`);
      // (the question just canceled must be gone first: on a busy machine it was still fading out 300 ms later and was read as a new
      // one, CR-10-03; then either the restart or a question comes, whichever is first, instead of a look after a fixed pause)
      // (Update's own question; on a busy machine another one, from the page's start-up, was up at times and was taken for it)
      // (a question is up while #ask-sheet has .on: a canceled one keeps its text and stays laid out while it fades)
      const seen=()=>{const s=document.querySelector('#ask-sheet.on');return !!(s&&/Update now/.test(s.textContent))};
      await p.waitForFunction(()=>!document.querySelector('#ask-sheet.on'),null,{timeout:5000}).catch(()=>{});
      // (the cards are set in the same step as the tap: on a busy machine the page's own start-up could change them in between)
      const nav=p.waitForNavigation({timeout:8000}).catch(()=>null);const q0=await p.evaluate(()=>{queue.length=0;queue.push({id:'k1',manual:true,type:'tie'});aboutUpdating=false;const q=JSON.stringify(queue.map(q=>[q.id,!!q.busy,!!q.multiBusy]));updateNow();return q});
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
