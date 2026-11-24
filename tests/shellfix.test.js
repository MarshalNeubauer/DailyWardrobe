// The app shell's fixes from the 2026-11-16 code review (fix round A), each as a person meets it:
// CR-7-01 "Delete my data" after iOS closed the database connection and the app reopened it: everything goes, or it says it didn't;
// CR-7-03 an error during start-up keeps the wardrobe that was read, says so in plain words and notes the error;
// CR-7-04 Settings opened over Add (the gear) and closed by Done or Back leaves Add's Back entry: the next Back goes to the Wardrobe;
// CR-7-05 on an Arabic-language phone the backup-pause time is in the app's language;
// CR-7-06 opening and closing About asks the server who this is at most once (account.js already knows).
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,settle,ROOT})=>{
  const browser=await chromium.launch();
  const SRV='https://shell-server.test/';
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'};
  const open=async(o={})=>{const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',...(o.locale?{locale:o.locale}:{})}),p=await ctx.newPage(),errs=[],calls=[];
    p.on('pageerror',e=>errs.push(e.message));
    await p.route(SRV+'**',r=>{const q=r.request();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});calls.push(q.method()+' '+new URL(q.url()).pathname);
      const a=(o.srv||{})[q.method()+' '+new URL(q.url()).pathname];return r.fulfill({status:a?200:404,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(a?a():{error:'not found'})})});
    if(o.today)await p.route(/\/today\.js(\?|$)/,r=>r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(path.join(ROOT,'today.js'),'utf8').replace('function renderToday(){','function renderToday(){'+o.today)}));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);return {p,ctx,errs,calls}};
  const seed=p=>p.evaluate(async()=>{const mk=(id,type,c)=>({id,type,primaryColor:c,pattern:'solid',added:Date.now()});
    for(const it of [mk('s1','suit','navy'),mk('h1','shirt','white'),mk('t1','tie','burgundy'),mk('p1','shoes','black')]){await put(it);items.push(it)}
    settings.setupDone=Date.now();await saveUserSettings();cache={};show('today')});
  const stored=p=>p.evaluate(async()=>(await tx('readonly',s=>s.getAll())).length);
  const gear='header button[aria-label="Settings"]';
  const toAbout=async p=>{await p.click(gear);await p.waitForFunction(()=>settingsOpen());await p.click('#sc-about .scat-head');await settle(p,300)};
  try{
    /* CR-7-01: the connection closed by the phone, reopened by the next save, then Delete from this device only */
    {const {p,ctx,errs}=await open();await seed(p);
      await p.evaluate(async()=>{(await db).close()});
      const saved=await p.evaluate(async()=>{const it=items.find(x=>x.id==='h1');it.name='Kept';try{await put(it);return 'ok'}catch(e){return e.name}});
      await toAbout(p);await p.click('#del-open');await p.waitForSelector('#del-device');
      await Promise.all([p.waitForNavigation(),p.click('#del-device')]);await p.waitForFunction(()=>window.appReady);await settle(p,300);
      const s=await p.evaluate(async()=>({items:items.length,stored:(await tx('readonly',s=>s.getAll())).length,toast:$('#toast').textContent}));
      ok(saved==='ok'&&s.items===0&&s.stored===0&&/deleted/.test(s.toast),`after the database was reopened, "Delete from this device only" deletes the wardrobe (${JSON.stringify(s)})`);
      ok(!errs.length,'no page errors ('+errs.join('; ')+')');await ctx.close()}
    /* CR-7-01: held up by the app open in another tab: it says what holds it up, and finishes once that tab lets go */
    {const {p,ctx}=await open();await seed(p);
      await p.evaluate(()=>new Promise(r=>{const q=indexedDB.open('wardrobe');q.onsuccess=()=>{window.__other=q.result;q.result.onversionchange=()=>{};r()}}));   // a tab that doesn't let go
      await toAbout(p);await p.click('#del-open');await p.waitForSelector('#del-device');await p.click('#del-device');
      await p.waitForFunction(()=>/another tab or window/.test($('#del-status').textContent),null,{timeout:15000});
      ok(true,'a delete held up by another tab says so ("'+await p.textContent('#del-status')+'")');
      await Promise.all([p.waitForNavigation({timeout:20000}),p.evaluate(()=>window.__other.close())]);await p.waitForFunction(()=>window.appReady);
      ok(await stored(p)===0&&/deleted/.test(await p.textContent('#toast')),'and it finishes, the wardrobe deleted, once that tab lets go');await ctx.close()}
    /* CR-7-01: a delete the browser refuses: no "deleted", the wardrobe stays and the app keeps saving */
    {const {p,ctx}=await open();await seed(p);
      await p.evaluate(()=>{Object.defineProperty(IDBFactory.prototype,'deleteDatabase',{configurable:true,writable:true,value:()=>{const q={};setTimeout(()=>q.onerror&&q.onerror(),50);return q}})});   // (on the prototype: WebKit ignores an own property)
      await toAbout(p);await p.click('#del-open');await p.waitForSelector('#del-device');await p.click('#del-device');
      await p.waitForFunction(()=>/couldn’t be deleted/.test($('#del-status').textContent),null,{timeout:15000});
      const s=await p.evaluate(async()=>{const it=items.find(x=>x.id==='t1');it.name='After';let w='ok';try{await put(it)}catch(e){w=e.name}
        return {items:items.length,stored:(await tx('readonly',s=>s.getAll())).length,w,btn:!$('#del-device').disabled}});
      ok(s.items===4&&s.stored===4&&s.w==='ok'&&s.btn,`a failed delete says so and changes nothing; the app still saves (${JSON.stringify(s)})`);await ctx.close()}

    /* CR-7-03: one failure while drawing Today at start-up: the wardrobe stays, it says so, the error is noted */
    {const once='if(window.__boom&&!window.__boomed){window.__boomed=1;throw new Error("test: Today failed once")}';
      const {p,ctx}=await open({today:once});await seed(p);
      await p.addInitScript(()=>{window.__boom=1});await p.reload();await p.waitForFunction(()=>window.appReady);await settle(p,1500);
      const s=await p.evaluate(()=>({boomed:!!window.__boomed,items:items.length,first:/Get your first outfit/.test($('#today').innerText),toast:$('#toast').textContent,
        noted:(JSON.parse(localStorage.getItem('err_log')||'[]')).some(x=>/Start-up/.test(x.m)&&/Today failed once/.test(x.m))}));
      ok(s.boomed&&s.items===4&&!s.first,`a start-up error keeps the wardrobe that was read (${s.items} pieces) and doesn't show "Get your first outfit"`);
      ok(/wardrobe is safe/.test(s.toast)&&/nothing was deleted/.test(s.toast),'and says in plain words that nothing is lost ("'+s.toast+'")');
      ok(s.noted,'and the error is noted for the error report (err_log)');
      ok(await stored(p)===4,'nothing in storage changed');await ctx.close()}
    /* CR-7-03: Today can't be drawn at all: a plain card with Try again, the wardrobe still in memory */
    {const always='if(window.__boom)throw new Error("test: Today failed");';
      const {p,ctx}=await open({today:always});await seed(p);
      await p.addInitScript(()=>{window.__boom=1});await p.reload();await p.waitForFunction(()=>window.appReady);await settle(p,800);
      const s=await p.evaluate(()=>({items:items.length,shown:!$('#today').hidden,text:$('#today').innerText,btn:[...document.querySelectorAll('#today button')].some(b=>/Try again/.test(b.textContent))}));
      ok(s.items===4&&s.shown&&/Today couldn’t be shown/.test(s.text)&&/nothing was deleted/.test(s.text)&&s.btn,'Today that can\'t be drawn: a plain card says the wardrobe is safe, with Try again');
      await p.evaluate(()=>{window.__boom=0});await Promise.all([p.waitForNavigation(),p.click('#today button')]);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>{window.__boom=0});
      ok(await p.evaluate(()=>items.length)===4,'Try again starts the app again');await ctx.close()}
    /* CR-7-03: a stored own-colors list that isn't a list no longer stops the start-up */
    {const {p,ctx,errs}=await open();await seed(p);
      await p.evaluate(async()=>{const st=await metaGet('settings');st.custom={colors:{},patterns:'x'};await metaPut('settings',st)});
      await p.reload();await p.waitForFunction(()=>window.appReady);await settle(p,500);
      ok(await p.evaluate(()=>items.length===4&&!/Something went wrong/.test($('#toast').textContent))&&!errs.length,'own colors stored as something other than a list count as none: the app starts as usual');await ctx.close()}

    /* CR-7-04: Wardrobe → + → the gear → Done (or Back) → Back goes to the Wardrobe, not out of the app */
    {const {p,ctx}=await open();await seed(p);
      for(const how of ['Done','Back']){
        await p.click('#n-wardrobe');await settle(p,300);await p.click('#ward-add');await p.waitForFunction(()=>!$('#add').hidden);
        await p.click(gear);await p.waitForFunction(()=>settingsOpen());
        if(how==='Done')await p.click('.sdone');else await p.evaluate(()=>history.back());
        await p.waitForFunction(()=>!settingsOpen());await settle(p,500);
        const r={add:await p.evaluate(()=>!$('#add').hidden),hist:await p.evaluate(()=>appHist)};
        await p.evaluate(()=>history.back());await settle(p,800);
        r.ward=await p.evaluate(()=>!$('#wardrobe').hidden&&$('#add').hidden);r.url=p.url();
        ok(r.add&&r.hist&&r.ward&&r.url.startsWith(url.split('#')[0]),`Settings over Add closed by ${how}: Add keeps its Back entry, and the next Back goes to the Wardrobe (${JSON.stringify(r)})`)}
      // and from Settings over Add, a tab leaves no entry behind
      await p.click('#ward-add');await p.waitForFunction(()=>!$('#add').hidden);await p.click(gear);await p.waitForFunction(()=>settingsOpen());
      await p.evaluate(()=>show('today'));await settle(p,600);
      ok(await p.evaluate(()=>!appHist&&!$('#today').hidden&&!settingsOpen()),'Settings over Add, then a tab: no Back entry is left behind');
      await ctx.close()}

    /* CR-7-05: an Arabic-language phone: the backup-pause time is in the app's language, like its dates */
    {const {p,ctx}=await open({locale:'ar-KW'});
      await p.evaluate(s=>{localStorage.setItem('worker_url',s);localStorage.setItem('app_token','x');localStorage.setItem('last_sync',String(Date.now()-864e5));
        const t=new Date();t.setHours(23,0,0,0);localStorage.setItem('sync_pause',String(Math.max(t.getTime(),Date.now()+60e3)))},SRV);
      await p.click(gear);await p.waitForFunction(()=>settingsOpen());
      const s=await p.evaluate(()=>({sum:$('#sum-backup').textContent,reset:aboutResetAt(),sync:new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}));
      const arabic=/[؀-ۿ٠-٩]/;
      ok(/^Paused until /.test(s.sum)&&!arabic.test(s.sum)&&!arabic.test(s.reset)&&!arabic.test(s.sync),`times are in the app's language on an Arabic phone (${JSON.stringify(s)})`);await ctx.close()}

    /* CR-7-06: About asks /me only as it opens, and not again when account.js already knows */
    {const {p,ctx,calls}=await open({srv:{'GET /me':()=>({id:'u1',role:'tester',name:'T'})}});
      await p.evaluate(s=>{localStorage.setItem('worker_url',s);localStorage.setItem('app_token','tok')},SRV);
      await p.click(gear);await p.waitForFunction(()=>settingsOpen());await settle(p,800);const n0=calls.filter(c=>c==='GET /me').length;
      await p.click('#sc-about .scat-head');await settle(p,600);await p.click('#sc-about .scat-head');await settle(p,600);
      const n1=calls.filter(c=>c==='GET /me').length;
      ok(n0===1&&n1===n0,`opening and closing About asks the server nothing more (/me: ${n0} with Settings, ${n1-n0} more for About)`);await ctx.close()}
  }finally{await browser.close()}
};
