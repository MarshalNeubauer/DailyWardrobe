// Roll back wherever it lands (2026-11-15, the re-audit's fix round 2, Fixer 4):
// - a roll-back answered after Settings closed under its question says its result in a toast with Undo (it was written only to the closed
//   Settings page: the wardrobe vanished from Today with no word); Undo rolls back to "Before the last roll-back";
// - a first day's copy, from before the setup, brings back no settings: the setup doesn't start again, workdays and location stay;
// - the daily backups list is read when Backup opens, not only when the dropdown is focused (an iPhone opens the picker at the tap);
// - the list cap is said in words about the daily backups, not "photo list checks".
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
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
    await p.evaluate(async()=>{if(typeof setupShown==='function'&&setupShown())setupClose();settings.setupDone=Date.now();settings.workdays=[0,1,2,3];settings.location={name:'Kuwait City',lat:29.37,lon:47.98};await saveUserSettings();
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
    const run=p.evaluate(d=>{$('#snap-list').value=d;window.__rb=rollBack();return true},day);await run;
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
    await p.evaluate(()=>loadSnapshots());
    const inS=await p.evaluate(async()=>{$('#snap-list').value='';await rollBack();return {st:$('#snap-status').textContent,on:$('#toast').classList.contains('on')}});
    ok(inS.st==='Choose a day first.'&&!inS.on,`in open Settings the line answers and no toast (${JSON.stringify(inS)})`);
    await p.evaluate(()=>closeSettings());

    // the list cap in words about the daily backups
    capList=true;
    const cap=await p.evaluate(async()=>{delete $('#snap-list').dataset.loaded;openSettings('backup');await loadSnapshots();return $('#snap-status').textContent});
    ok(/daily backups can’t be listed again today/.test(cap)&&!/photo list/.test(cap),`the list cap says what it means here ("${cap}")`);
    // after a restart the setup still doesn't come back
    await p.evaluate(()=>closeSettings());capList=false;
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(500);
    ok(await p.evaluate(()=>!(typeof setupShown==='function'&&setupShown())&&!!settings.setupDone),'after a restart the setup stays done');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
