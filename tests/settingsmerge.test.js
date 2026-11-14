// Settings merge setting by setting (2026-11-14, the audit: phone A changed the workdays, phone B the city, and the later save dropped
// the other's change). core.js stampSettings/mergeSettings and the worker's port (worker/backup.js mergeSettingsLite): the rule in Node,
// then two browser devices syncing through the real worker with an in-memory KV, as sync.test.js does.
const path=require('path'),fs=require('fs'),vm=require('vm'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  /* ---- the rule ---- */
  const ctx={console,localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return null}}};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'core.js'),'utf8')+';this.K={stampSettings,mergeSettings,stampAllSettings,mergeState,keySettings}',ctx);
  const {stampSettings,mergeSettings,stampAllSettings,mergeState,keySettings}=ctx.K,J=o=>JSON.parse(JSON.stringify(o));
  const base={workdays:[0,1,2,3,4],location:null,units:'C',updated:1000};
  // as the app does: the copy is keyed when it is read, then changed, then saved
  const load=()=>keySettings(J(base)),change=(s,o,t)=>stampSettings(Object.assign(s,o),t);
  const a=change(load(),{workdays:[0,1,2,3]},5000);
  ok(a.ks.workdays===5000&&a.ks.location===1000&&a.ks.units===1000&&a.updated===5000,'a save stamps only the setting that changed; the others keep the copy\'s old stamp');
  const b=change(load(),{location:{name:'Kuwait City'}},6000);
  const m1=mergeSettings(a,b),m2=mergeSettings(b,a);
  const vals=m=>JSON.stringify([m.workdays,m.location,m.units]);
  ok(vals(m1)==='[[0,1,2,3],{"name":"Kuwait City"},"C"]'&&vals(m1)===vals(m2),'two phones changing different settings: the merge keeps both changes, whichever way round');
  ok(m1.updated===6001&&m2.updated===6001,'and its stamp is one above both, so the phone with the older stamp still uploads it');
  const again=mergeSettings(m1,b);ok(vals(again)===vals(m1)&&again.updated===6001,'merging the result again changes nothing (no endless uploads)');
  const c=stampSettings(Object.assign(J(a),{workdays:[1,2,3,4,5]}),7000);
  ok(JSON.stringify(mergeSettings(c,b).workdays)==='[1,2,3,4,5]'&&JSON.stringify(mergeSettings(b,c).workdays)==='[1,2,3,4,5]','the same setting changed on both: the later change wins');
  const legacyA={workdays:[1],updated:10},legacyB={workdays:[2],location:{name:'X'},updated:20};
  const lw=m=>JSON.stringify([m.workdays,m.location,m.updated]);
  ok(lw(mergeSettings(legacyA,legacyB))===lw(legacyB)&&lw(mergeSettings(legacyB,legacyA))===lw(legacyB),'two copies saved before this rule: the newer whole copy, as before');
  const d=keySettings({workdays:[1],units:'C',ks:{workdays:5},kh:{workdays:'x'},updated:5});
  ok(d.ks.units===0,'a setting only the defaults filled in is stamped 0, so it never wins over another device\'s choice');
  const old={workdays:[9],location:{name:'Old'},units:'F',updated:5500};
  const mo=mergeSettings(a,old);ok(JSON.stringify(mo.workdays)==='[9]'&&mo.units==='F'&&mergeSettings(old,a).units==='F','a copy without stamps counts its one stamp for every setting');
  const rm=stampSettings(Object.assign(J(b)),8000);delete rm.location;stampSettings(rm,8000);
  ok(!('location' in mergeSettings(rm,b))&&!('location' in mergeSettings(b,rm)),'a setting removed later is removed in the merge too');
  const rb=stampAllSettings({workdays:[3],updated:1},9000);ok(Object.values(rb.ks).every(t=>t===9000)&&rb.updated===9000,'a roll-back stamps every setting');
  ok(mergeState({settings:a},{settings:b}).settings.updated===6001,'mergeState merges settings with it');

  /* ---- two devices through the real worker ---- */
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  try{
    const device=async()=>{const c=await browser.newContext();
      await c.route(HOST+'**',async route=>{const r=route.request();
        const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(url);
      await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);return p};
    const sync=p=>p.evaluate(()=>syncNow());
    const backup=()=>JSON.parse(store.get('wardrobe:v1')).data.settings||{};
    const A=await device();
    await A.evaluate(async()=>{settings.workdays=[0,1,2,3,4];settings.units='C';await saveUserSettings()});await sync(A);
    const B=await device();await sync(B);
    ok(await B.evaluate(()=>settings.units==='C'),'phone B takes the backup\'s settings');
    // each phone changes a different setting before it syncs
    await A.evaluate(async()=>{settings.workdays=[0,1,2,3];await saveUserSettings()});
    await B.evaluate(async()=>{settings.location={name:'Kuwait City',lat:29.37,lon:47.98};await saveUserSettings()});
    await sync(B);await sync(A);await sync(B);
    const s=backup(),sa=await A.evaluate(()=>({w:settings.workdays,l:settings.location&&settings.location.name})),sb=await B.evaluate(()=>({w:settings.workdays,l:settings.location&&settings.location.name}));
    ok(JSON.stringify(s.workdays)==='[0,1,2,3]'&&s.location&&s.location.name==='Kuwait City',`the backup keeps both phones' changes (${JSON.stringify([s.workdays,s.location&&s.location.name])})`);
    ok(JSON.stringify(sa)==='{"w":[0,1,2,3],"l":"Kuwait City"}'&&JSON.stringify(sb)===JSON.stringify(sa),`and both phones end with both (${JSON.stringify([sa,sb])})`);
    // the same setting on both: the later save wins
    await A.evaluate(async()=>{settings.blazerDays=[1];await saveUserSettings()});await new Promise(r=>setTimeout(r,20));
    await B.evaluate(async()=>{settings.blazerDays=[3];await saveUserSettings()});
    await sync(A);await sync(B);await sync(A);
    const bd=JSON.stringify([backup().blazerDays,await A.evaluate(()=>settings.blazerDays),await B.evaluate(()=>settings.blazerDays)]);
    ok(bd==='[[3],[3],[3]]','the same setting changed on both phones: the later change wins everywhere '+bd);
    ok(!A.errs.length&&!B.errs.length,'no page errors: '+[...A.errs,...B.errs].join(' | '));
  }finally{await browser.close()}
};
