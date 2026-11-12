// Data safety, sync: a device whose settings its user never changed can't win over a backup's settings.
// The real worker.js runs in Node with an in-memory KV; browser contexts play the devices (as in sync.test.js).
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  try{
  // a device; `connect` false leaves it without a backup address until connect() is called
  const device=async(connect=true)=>{const ctx=await browser.newContext();
    await ctx.route(HOST+'**',async route=>{const r=route.request();
      const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();await p.goto(url);
    if(connect){await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);await p.reload()}
    await p.waitForFunction(()=>window.appReady);return {ctx,p}};
  const connect=p=>p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
  const sync=p=>p.evaluate(()=>syncNow());
  const backup=()=>JSON.parse(store.get('wardrobe:v1')).data.settings||{};
  const mine=s=>JSON.stringify([s.workdays,s.location&&s.location.name,s.holidays&&s.holidays.country,(s.daysOff||[]).length,s.custom&&s.custom.colors&&s.custom.colors.length,s.learn&&s.learn.i&&s.learn.i.tie1]);
  const WANT=JSON.stringify([[0,1,2,3],'Testville','XX',1,1,2]);

  // device A: the owner's settings, backed up
  const A=await device();
  await A.p.evaluate(async()=>{settings.workdays=[0,1,2,3];settings.location={name:'Testville',lat:1,lon:2};
    settings.holidays={country:'XX',list:[{d:'2026-12-25',n:'A holiday'}],skip:[],fetched:Date.now()};settings.daysOff=[{d:'2026-11-20',n:'Trip'}];
    settings.custom={colors:[{key:'ownmoss',name:'moss',hex:'#556b2f',base:'olive'}],patterns:[]};settings.learn={p:{},i:{tie1:2}};await saveUserSettings()});
  ok(await sync(A.p)&&mine(backup())===WANT,'device A backs up its settings');

  // device B: a fresh install connected to that backup
  const B=await device();await sync(B.p);
  ok(mine(backup())===WANT,`a fresh install does not overwrite the backup's settings with defaults (${mine(backup())})`);
  ok(mine(await B.p.evaluate(()=>settings))===WANT,'the fresh install takes the settings from the backup');
  await B.p.reload();await B.p.waitForFunction(()=>window.appReady);await sync(B.p);
  ok(mine(backup())===WANT&&mine(await B.p.evaluate(()=>settings))===WANT,'and still not after it is opened again');

  // device C: used before it was connected (its settings were saved, as first-run setup does), then connected to the backup
  const C=await device(false);
  await C.p.evaluate(async()=>{settings.setupDone=Date.now();await saveUserSettings()});
  await connect(C.p);await sync(C.p);
  ok(mine(backup())===WANT,`a device connected to a backup for the first time takes the backup's settings, not its own (${mine(backup())})`);
  ok(mine(await C.p.evaluate(()=>settings))===WANT&&await C.p.evaluate(()=>!!settings.setupDone),'it shows them at once and keeps what only it had');
  ok(mine(await C.p.evaluate(()=>metaGet('settings')))===WANT,'and stores them');
  // from then on its user's changes count like any device's
  await C.p.evaluate(async()=>{settings.workdays=[1,2,3];await saveUserSettings()});await sync(C.p);await sync(A.p);
  ok(JSON.stringify(backup().workdays)==='[1,2,3]'&&JSON.stringify(await A.p.evaluate(()=>settings.workdays))==='[1,2,3]'&&backup().holidays.country==='XX','a change its user makes afterwards reaches the backup and the other devices');

  // new planning rules on a device: noting them is not a change to the settings (it must not beat a newer change made elsewhere)
  await sync(B.p);await B.p.evaluate(async()=>{settings.daysOff=[];await saveUserSettings();await syncNow()});   // B's user removes the day off
  const before=await A.p.evaluate(async()=>(await metaGet('settings')).updated);
  await A.p.evaluate(async()=>{const s=await metaGet('settings');s.planRules=1;await metaPut('settings',s)});
  await A.p.reload();await A.p.waitForFunction(()=>window.appReady);
  await A.p.waitForFunction(async()=>((await metaGet('settings'))||{}).planRules===PLAN_RULES,null,{timeout:8000}).catch(()=>{});
  const after=await A.p.evaluate(async()=>{const s=await metaGet('settings');return {u:s.updated,r:s.planRules===PLAN_RULES}});
  ok(after.r&&after.u===before,'new planning rules are noted without stamping the settings as changed');
  await sync(A.p);
  ok((backup().daysOff||[]).length===0&&(await A.p.evaluate(()=>(settings.daysOff||[]).length))===0,'so a change made on another device meanwhile is not undone');
  }finally{await browser.close()}
};
