// Settings → About (about.js): the version and the new-version prompt, feedback, deleting one's data, the privacy note.
// The server's /me, /feedback and /account are mocked here.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,settle,ROOT})=>{
  const browser=await chromium.launch();
  const SRV='https://wardrobe-server.test/';
  const swVer=+/CACHE='dw-v(\d+)'/.exec(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'))[1];
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'};
  /* a page whose server answers from `h` (path → (request) → {status, body}); every call is recorded */
  const open=async(h={},o={})=>{const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),calls=[],errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route(SRV+'**',async r=>{const q=r.request(),u=new URL(q.url()),name=q.method()+' '+u.pathname;
      if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
      calls.push({name,body:q.postData(),tok:q.headers()['x-app-token'],type:q.headers()['content-type']});
      const f=h[name];if(f==='down')return r.abort();const a=f?f(q):{status:404,body:{error:'not found'}};
      return r.fulfill({status:a.status||200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(a.body||{})})});
    if(o.newer)await p.route(/\/sw\.js\?check=/,r=>r.fulfill({status:200,contentType:'text/javascript',body:`const CACHE='dw-v${o.newer}';`}));
    await p.goto(url);await p.waitForFunction(()=>window.appReady&&appVersion()!=null);
    if(o.connect!==false)await p.evaluate(s=>{localStorage.setItem('worker_url',s);localStorage.setItem('app_token','tok-1')},SRV);
    return {p,ctx,calls,errs}};
  const about=async p=>{await p.evaluate(()=>{openSettings('about');renderAbout()});await settle(p,600)};
  const text=(p,s)=>p.evaluate(s=>(document.querySelector(s)||{}).textContent||'',s);
  try{
    /* version */
    {const {p,ctx,errs}=await open({},{connect:false});
      ok(await p.evaluate(()=>appVersion())===swVer,`appVersion() is the number in sw.js (${swVer})`);
      await about(p);
      ok(await text(p,'#about-ver')==='Version '+swVer&&(await text(p,'#sum-about')).startsWith('Version '+swVer),'About shows "Version '+swVer+'", in its summary too');
      ok(await p.evaluate(()=>SET_CATS[SET_CATS.length-1]==='about'&&$('#sc-about').classList.contains('open')&&$('#sc-connection').nextElementSibling.id==='sc-about'),'About is the last Settings category, after Connection');
      await p.click('#about-check');await p.waitForFunction(()=>/latest/.test($('#about-status').textContent));
      ok(await p.evaluate(()=>$('#about-update').hidden&&getComputedStyle($('#about-update')).display==='none'&&!/new version/.test($('#toast').textContent)),'Check for updates: "You have the latest version", no Update button, no prompt');
      ok(await p.evaluate(()=>{const b=$('#about-check').getBoundingClientRect();return b.height>=44&&document.documentElement.scrollWidth<=innerWidth}),'44px controls, no sideways scroll');
      ok(await p.evaluate(()=>{const d=$('#about-privacy');const shut=!d.open;d.querySelector('summary').click();return shut&&d.open&&/Anthropic/.test(d.textContent)&&/OpenAI/.test(d.textContent)&&/Nothing else leaves your phone/.test(d.textContent)&&/person who invited you/.test(d.textContent)&&/Open-Meteo/.test(d.textContent)&&/Nager\.Date/.test(d.textContent)&&/Cloudflare/.test(d.textContent)}),'the privacy note is a fold naming everyone who gets something: the server’s owner, Cloudflare, GitHub Pages, Anthropic, OpenAI, Open-Meteo, Nager.Date');
      ok(/^Feedback needs a connection/.test(await text(p,'#fb-status'))&&await p.isDisabled('#fb-send'),'not connected: feedback says it needs a connection and Send is switched off');
      await p.fill('#fb-text','hello');await p.evaluate(()=>sendFeedback());
      ok(/needs a connection/.test(await text(p,'#fb-status'))&&await p.inputValue('#fb-text')==='hello','sending without a connection says so and keeps the text');
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')');await ctx.close()}

    /* a newer version on the server */
    {const {p,ctx}=await open({},{newer:swVer+5,connect:false});
      await p.waitForFunction(()=>$('#toast').classList.contains('on')&&/A new version is ready/.test($('#toast').textContent));
      ok(await p.evaluate(()=>{const b=$('#toast button');return !!b&&b.textContent==='Update'}),'a newer sw.js raises the toast "A new version is ready" with Update');
      const again=await p.evaluate(async()=>{window.__same=1;let n=0;const t0=toast;toast=function(){n++;return t0.apply(this,arguments)};
        await checkForUpdate();await checkForUpdate(true);document.dispatchEvent(new Event('visibilitychange'));await checkForUpdate();toast=t0;return n});
      ok(again===0,'the prompt is raised once for a version, however often it is checked');
      await about(p);
      ok(await p.evaluate(()=>window.__same===1&&appVersion()<aboutNew&&!$('#about-update').hidden)&&(await text(p,'#about-status')).includes(`Version ${swVer+5} is ready`),'nothing reloads by itself; About offers Update for the new version');
      // unsaved Add cards: asked first
      await p.evaluate(()=>{queue=[{},{}]});
      await p.click('#about-update');await p.waitForFunction(()=>document.querySelector('#ask-sheet.on'));const asked=await text(p,'#ask-sheet');   // the app's own question (ui.js), not a browser dialog
      await p.click('#ask-cancel');await p.waitForFunction(()=>!aboutUpdating&&!document.querySelector('#ask-sheet.on'));
      ok(/2 unsaved cards on the Add tab/.test(asked)&&await p.evaluate(()=>window.__same===1),'with unsaved Add cards Update asks first, and No leaves the page as it is');
      await p.evaluate(()=>{queue=[]});
      await Promise.all([p.waitForFunction(()=>window.__same===undefined&&window.appReady,null,{timeout:20000}),p.click('#about-update')]);
      ok(true,'Update reloads the page');
      await ctx.close()}

    /* feedback */
    {let me={role:'tester'},fb={status:200,body:{ok:true}};
      const {p,ctx,calls,errs}=await open({'POST /feedback':()=>fb,'GET /me':()=>({body:me}),
        'GET /feedback':()=>({body:{items:[{t:1700000000000,name:'Tester A',text:'older <b>note</b>',version:140},{t:1800000000000,name:'Tester B',text:'newest note',version:142}]}})});
      await about(p);
      await p.fill('#fb-text','  The picker is great  ');await p.click('#fb-send');
      await p.waitForFunction(()=>/Thank you/.test($('#fb-status').textContent));
      const c=calls.find(c=>c.name==='POST /feedback'),b=JSON.parse(c.body);
      ok(b.text==='The picker is great'&&b.version===swVer&&b.where==='settings'&&Object.keys(b).length===3,'Send posts {text, version, where:"settings"}');
      ok(c.tok==='tok-1'&&/application\/json/.test(c.type),'with the app’s usual headers');
      ok(await p.inputValue('#fb-text')===''&&!await p.evaluate(()=>$('#fb-status').classList.contains('about-bad')),'success thanks the person and empties the box');
      ok(await p.evaluate(()=>$('#fb-list').hidden),'a tester doesn’t see the feedback received');
      fb={status:404,body:{error:'not found'}};await p.fill('#fb-text','again');await p.click('#fb-send');
      await p.waitForFunction(()=>/isn’t available yet/.test($('#fb-status').textContent));
      ok(await p.inputValue('#fb-text')==='again','a 404 (older server): "feedback isn’t available yet", the text stays');
      fb={status:429,body:{error:'too many messages today'}};await p.click('#fb-send');
      await p.waitForFunction(()=>/too many messages today/.test($('#fb-status').textContent));
      ok(await p.evaluate(()=>$('#fb-status').classList.contains('about-bad')&&!$('#fb-send').disabled),'a failure shows the server’s reason');
      me={role:'owner'};await p.evaluate(()=>renderAbout());await p.waitForFunction(()=>!$('#fb-list').hidden);
      const list=await p.evaluate(()=>({t:[...document.querySelectorAll('.fb-item p')].map(e=>e.textContent),h:[...document.querySelectorAll('.fb-item small')].map(e=>e.textContent),html:!!$('#fb-list').querySelector('b')}));
      ok(list.t.length===2&&list.t[0]==='newest note'&&list.t[1]==='older <b>note</b>'&&!list.html,'the owner sees the feedback received, newest first, as plain text');
      ok(/Tester B/.test(list.h[0])&&/version 142/.test(list.h[0]),'each with who, when and the version');
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')');await ctx.close()}
    {const {p,ctx}=await open({'POST /feedback':'down'});await about(p);
      await p.fill('#fb-text','x');await p.click('#fb-send');await p.waitForFunction(()=>/didn’t answer/.test($('#fb-status').textContent));
      ok(await p.inputValue('#fb-text')==='x'&&await p.evaluate(()=>$('#fb-list').hidden),'a server that can’t be reached is reported, the text stays, and no /me means no list');await ctx.close()}

    /* delete my data */
    const seed=p=>p.evaluate(async()=>{
      await put({id:'tie1',type:'tie',primaryColor:'navy',pattern:'solid'});await put({id:'shirt1',type:'shirt',primaryColor:'white',pattern:'solid'});
      await txs('days','readwrite',s=>s.put({date:'2026-11-02',worn:true}));await metaPut('settings',{...settings,workdays:[1,2]});await metaPut('render:c0000000000000001',{img:'x'});
      const c=await caches.open('dw-keep-tagimg');await c.put(new Request('tagimg/tie1'),new Response('x'));
      for(const k of ABOUT_KEYS)if(k!=='worker_url'&&k!=='app_token')localStorage.setItem(k,'SEED');
      localStorage.setItem('nav_fit2:390x844','SEED');localStorage.setItem('someone_elses_key','keep');clearTimeout(syncTimer)});
    const state=p=>p.evaluate(async()=>({items:items.length,db:[(await tx('readonly',s=>s.getAll())).length,(await txs('days','readonly',s=>s.getAll())).length,(await txs('meta','readonly',s=>s.getAll())).map(r=>r.k)],
      kept:(await caches.keys()).filter(k=>k.startsWith('dw-keep-')),seeded:Object.keys(localStorage).filter(k=>localStorage.getItem(k)==='SEED'),
      conn:[localStorage.getItem('worker_url'),localStorage.getItem('app_token')],other:localStorage.getItem('someone_elses_key'),days:Object.keys(dayRecs).length,workdays:settings.workdays.length,toast:$('#toast').textContent}));
    const gone=s=>s.items===0&&s.db[0]===0&&s.db[1]===0&&!s.db[2].some(k=>/^render:/.test(k))&&s.kept.length===0&&s.seeded.length===0&&!s.conn[0]&&!s.conn[1]&&s.days===0&&s.workdays!==2;
    const wipe=async(p,btn)=>{await p.evaluate(()=>{window.__same=1});await p.click('#del-open');await p.waitForSelector(btn);
      await Promise.all([p.waitForFunction(()=>window.__same===undefined&&window.appReady,null,{timeout:20000}),p.click(btn)])};
    {const {p,ctx,calls,errs}=await open({'DELETE /account':()=>({body:{ok:true}})});await seed(p);await about(p);
      await p.click('#del-open');
      const box=await text(p,'#del-confirm');
      ok(/wardrobe, outfit history and settings on this device/.test(box)&&/photos kept on this device/.test(box)&&/backup.*on the server/.test(box)&&/can’t be undone/.test(box),'Delete my data first says what goes: the device’s wardrobe, history, settings and photos, and the server’s backup and photos');
      ok(await p.evaluate(()=>$('#del-open').classList.contains('danger')&&$('#del-all').classList.contains('danger')&&!!$('#del-device')&&!!$('#del-cancel')),'red buttons: Delete everything, Delete from this device only, and Cancel');
      await p.click('#del-cancel');
      ok(await p.evaluate(()=>$('#del-confirm').hidden)&&(await state(p)).db[0]===2,'Cancel deletes nothing');
      await wipe(p,'#del-device');const s=await state(p);
      ok(gone(s),'"Delete from this device only" clears every store, the kept photos, the kept caches and the app’s localStorage keys ('+JSON.stringify(s)+')');
      ok(!calls.some(c=>/account/.test(c.name)),'and doesn’t call the server');
      ok(s.other==='keep','keys that are not the app’s stay');
      ok(/backup on the server was kept/.test(s.toast),'after the restart it says the server’s backup was kept');
      ok(await p.evaluate(()=>!$('#today').hidden&&items.length===0)&&errs.length===0,'the app comes up empty, without errors ('+errs.join('; ')+')');await ctx.close()}
    {const {p,ctx,calls}=await open({'DELETE /account':()=>({body:{ok:true}})});await seed(p);await about(p);
      await wipe(p,'#del-all');const s=await state(p),c=calls.find(c=>c.name==='DELETE /account');
      ok(!!c&&c.body==='{"confirm":"delete"}'&&c.tok==='tok-1'&&/application\/json/.test(c.type),'"Delete everything" sends DELETE /account with {confirm:"delete"}');
      ok(gone(s)&&/from this device and from the server/.test(s.toast),'and clears the device too, saying both are gone');
      ok(!calls.some(c=>/sync/.test(c.name)&&/^PUT/.test(c.name)),'no backup is uploaded while deleting');await ctx.close()}
    {const {p,ctx}=await open({});await seed(p);await about(p);   // an older server: no /account
      await wipe(p,'#del-all');const s=await state(p);
      ok(gone(s)&&/This device was cleared/.test(s.toast)&&/couldn’t delete your backup/.test(s.toast),'a 404 from the server: the device is cleared and it says the server’s copy is still there');await ctx.close()}
    {const {p,ctx}=await open({'DELETE /account':()=>({status:500,body:{error:'storage is busy'}})});await seed(p);await about(p);
      await p.evaluate(()=>{window.__same=1});await p.click('#del-open');await p.click('#del-all');
      await p.waitForFunction(()=>/storage is busy/.test($('#del-status').textContent));const s=await state(p);
      ok(s.db[0]===2&&s.db[1]===1&&s.kept.length===1&&s.conn[0]&&s.conn[1]==='tok-1'&&await p.evaluate(()=>window.__same===1&&!$('#del-all').disabled),'a server error deletes nothing, keeps the connection and gives the reason');await ctx.close()}
    {const {p,ctx}=await open({},{connect:false});await about(p);await p.click('#del-open');
      ok(await p.evaluate(()=>!$('#del-all')&&!!$('#del-device'))&&!/on the server<\/li>/.test(await p.innerHTML('#del-confirm')),'not connected: only the device is offered');await ctx.close()}

    /* every localStorage key the app uses is one Delete removes */
    {const {p,ctx}=await open({},{connect:false});const keys=new Set();
      for(const f of fs.readdirSync(ROOT).filter(f=>/\.js$/.test(f)&&!['worker.js','sw.js'].includes(f))){const src=fs.readFileSync(path.join(ROOT,f),'utf8');
        for(const m of src.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"`])([^'"`]+)\1/g))keys.add(m[2]);
        for(const m of src.matchAll(/localStorage\.(?!getItem|setItem|removeItem|clear|key\b|length)([A-Za-z_]\w*)/g))keys.add(m[1]);
        for(const m of src.matchAll(/localStorage\[\s*(['"`])([^'"`]+)\1/g))keys.add(m[2])}
      const miss=await p.evaluate(ks=>ks.filter(k=>!aboutOwnKey(k)),[...keys]);
      ok(keys.size>10&&miss.length===0,'every localStorage key named in the app’s scripts is in ABOUT_KEYS / ABOUT_KEY_PREFIXES (missing: '+miss.join(', ')+')');
      ok(await p.evaluate(()=>aboutOwnKey(RQ)&&aboutOwnKey('nav_fit2:1x1')&&aboutOwnKey('nav_fit:1x1')&&!aboutOwnKey('someone_elses_key')),'the photo queue and the per-screen keys too, and nothing else');await ctx.close()}
    const rd=fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
    ok(/invite link/i.test(rd)&&/GitHub Pages/.test(rd)&&/Cloudflare Worker/.test(rd)&&/npm test/.test(rd),'README: joining by invite link, hosting, running the tests');
    ok(!fs.readdirSync(ROOT).some(f=>/^wa\d\.png$/.test(f)),'the stray screenshots are gone');
  }finally{await browser.close()}
};
