// Invitation links on a phone: a phone already connected to another wardrobe asks before switching and clears its own wardrobe
// first (a sync used to copy it into the new account); on an iPhone in Safari a tester is shown how to put the app on the Home
// Screen (which keeps storage of its own) and can copy their link from Connection; the owner can delete a switched-off tester's data.
module.exports=async({ok,chromium,url})=>{
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
    ok(/another wardrobe/.test(ask)&&res===false&&await p.evaluate(a=>localStorage.getItem('app_token')===a&&items.some(i=>i.id==='mine1'),A),`a phone connected to another wardrobe asks first; Cancel keeps everything as it was ("${ask.replace(/\s+/g,' ').slice(0,90)}…")`);
    const nav=p.waitForNavigation();p.evaluate(l=>connectFromLink(l),link(B)).catch(()=>{});
    await p.waitForSelector('#ask-ok',{state:'visible'});await p.click('#ask-ok');await nav;await p.waitForFunction(()=>window.appReady);
    const after=await p.evaluate(async()=>({tok:localStorage.getItem('app_token'),n:items.length,stored:(await tx('readonly',s=>s.getAll())).length,last:localStorage.getItem('last_sync')}));
    ok(after.tok===B&&after.n===0&&after.stored===0,`"Clear and switch" clears this phone's wardrobe and connects to the new one, so nothing of the old one reaches it (${JSON.stringify(after)})`);
    // a phone connected elsewhere but with nothing of its own switches without asking, forgetting the old account's sync marks
    await p.evaluate(()=>{localStorage.setItem('sync_mark','{"x":1}')});
    res=await p.evaluate(l=>connectFromLink(l),link(A));
    ok(res===true&&await p.evaluate(a=>localStorage.getItem('app_token')===a&&!(document.querySelector('#ask-ok')&&document.querySelector('#ask-ok').offsetParent)&&localStorage.getItem('sync_mark')!=='{"x":1}',A),'with nothing on the phone it switches at once, and forgets the old account\'s sync marks');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // ---- iPhone in Safari
    const IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const I=await page({userAgent:IOS,permissions:['clipboard-read','clipboard-write']});
    await I.p.goto(url+link(A));await I.p.reload();await I.p.waitForFunction(()=>window.appReady);
    await I.p.waitForSelector('#ask-ok',{state:'visible',timeout:10000});
    const guide=await I.p.textContent('#ask-sheet');await I.p.click('#ask-ok');
    await I.p.waitForFunction(()=>/copied/.test(document.querySelector('#toast').textContent));
    const clip=await I.p.evaluate(()=>navigator.clipboard.readText());
    ok(/Home Screen/.test(guide)&&/paste the link/.test(guide)&&clip.includes('#invite='+A)&&clip.includes('w='+encodeURIComponent(HOST)),`a tester connected in Safari on an iPhone is shown how to add the app to the Home Screen, and Copy link copies their link`);
    await I.p.evaluate(()=>{openSettings('connection');loadAccount()});await I.p.waitForSelector('#acct-box .acct-ios');
    const box=await I.p.textContent('#acct-box');
    ok(/Copy my invitation link/.test(box)&&/Home Screen/.test(box),'Connection says so too, with a button to copy the link');
    ok(I.errs.length===0,'no page errors ('+I.errs.join('; ')+')');
    // on a computer the guide doesn't show
    const D=await page();await D.p.goto(url+link(A));await D.p.reload();await D.p.waitForFunction(()=>window.appReady&&localStorage.getItem('app_token'));await D.p.waitForTimeout(1500);
    ok(await D.p.evaluate(()=>!(document.querySelector('#ask-ok')&&document.querySelector('#ask-ok').offsetParent)),'not on a computer');
    // ---- the owner deletes a switched-off tester's data
    const log=[],Ow=await page({},log);
    await Ow.p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner')},HOST);
    await Ow.p.evaluate(()=>{openSettings('connection');loadAccount()});await Ow.p.waitForSelector('text=Delete their data');
    const del=Ow.p.click('text=Delete their data');await Ow.p.waitForSelector('#ask-ok',{state:'visible'});const q=await Ow.p.textContent('#ask-sheet');await Ow.p.click('#ask-ok');await del;
    await Ow.p.waitForFunction(()=>!/Cal/.test(document.querySelector('#acct-box').textContent));
    ok(/can’t be undone/.test(q)&&log.includes('DELETE /invites?id=cccccccccc&purge=1'),'a switched-off invitation has "Delete their data": it asks, then deletes it on the server and takes it off the list');
    ok(Ow.errs.length===0,'no page errors ('+Ow.errs.join('; ')+')');
  }finally{await browser.close()}
};
