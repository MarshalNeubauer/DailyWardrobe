// After an invitation ends nothing is asked for pictures with the dead code (photos.js workerBase, workerList's 403), and the
// item pictures question names a tester's daily limit (itemPicLimitText) (2026-11-15, the re-audit: 12-45 refused requests per open)
module.exports=async({ok,chromium,url})=>{
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
    const r2=await p.evaluate(async()=>{await workerList(true);const ended=localStorage.getItem('invite_ended');renderTried.clear();await fetchItemPic({id:'s2',type:'belt',primaryColor:'black',pattern:'solid'});return {ended,base:workerBase()}});
    ok(r2.ended==='offcode'&&r2.base===null&&hits.filter(h=>h.startsWith('/render')).length===1,`a refused list ('invite off') ends the invitation; no picture is asked for after it (${hits.join(' ')})`);
    // the owner's mistyped code (forbidden token, not a tester): not ended, but the pieces aren't asked one by one either
    await p.evaluate(()=>{localStorage.removeItem('invite_ended');localStorage.setItem('app_token','typo');remoteKeys=null;remoteListed=false});listAnswer={status:403,body:{error:'forbidden token'}};hits.length=0;
    const r3=await p.evaluate(async()=>{renderTried.clear();await fetchItemPic({id:'s3',type:'socks',primaryColor:'navy',pattern:'solid'});await fetchItemPic({id:'s4',type:'socks',primaryColor:'grey',pattern:'solid'});return {ended:localStorage.getItem('invite_ended')}});
    ok(!r3.ended&&hits.length===1&&hits[0]==='/render?list=1',`a refused code that isn't an ended invitation holds the picture asks for that code (${hits.join(' ')})`);
    // the daily limit in the question
    const t=await p.evaluate(()=>{const day=new Date().toISOString().slice(0,10);acct.me={caps:{item:40},used:{item:38},day};const a=itemPicLimitText(5),b=itemPicLimitText(2);
      acct.me={caps:{item:40},used:{item:40},day:'2000-01-01'};const old=itemPicLimitText(3);acct.me={caps:null,used:{}};const owner=itemPicLimitText(3);
      acct.me={caps:{item:20},used:{item:20},day};return {a,b,old,owner,up:itemPicsUsedUp()}});
    ok(/You can make 2 more today, of your daily 40\. The first 2 are made now/.test(t.a)&&/2 more today/.test(t.b)&&!/first/.test(t.b)&&/40 more today/.test(t.old)&&t.owner===''&&t.up===20,
      `the Generate question says the day's limit ("${t.a.trim()}"); yesterday's count starts again; the owner has none`);
    const st=await p.evaluate(async()=>{if(!$('#itempic-status')){const d=document.createElement('div');d.id='itempic-status';document.body.append(d)}items=[{id:'z1',type:'shoes',primaryColor:'black',pattern:'solid'}];
      let asked=false;const real=askConfirm;askConfirm=async()=>{asked=true;return false};await startItemPics();askConfirm=real;return {asked,t:$('#itempic-status').textContent}});
    ok(!st.asked&&/item pictures are used up/.test(st.t),`with the day's pictures used up it says so instead of asking ("${st.t}")`);
    ok(!errs.length,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
