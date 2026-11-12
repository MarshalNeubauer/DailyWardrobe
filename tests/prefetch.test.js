// A new install (or a device that didn't make the photos) downloads the plan's photos from the worker in the background,
// nearest the selected day first, after one request that lists what the worker has: swiping to another day then shows
// its photo at once, nothing is downloaded twice, and combinations the worker doesn't have are not asked for.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  const env={APP_TOKEN:'t',WARDROBE:KV},HOST='https://w.test/';
  // the worker: the list needs the token and only names photo keys
  store.set('render:c00000000000000aa',JSON.stringify({img:JPG,t:1}));store.set('job:c00000000000000bb','{}');
  const lst=await worker.fetch(new Request(HOST+'render?list=1',{headers:{'x-app-token':'t'}}),env),lj=await lst.json();
  const no=await worker.fetch(new Request(HOST+'render?list=1'),env);
  ok(lst.status===200&&lj.keys.join()==='c00000000000000aa'&&no.status===403,`GET /render?list=1 lists the kept photos, with the app token only (${JSON.stringify(lj)})`);
  store.clear();
  const browser=await chromium.launch();
  const setup=()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',updated:1,...x});
    items=[I('suit','navy'),I('suit','charcoal'),I('suit','brown'),I('suit','lightgrey'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
    settings.workdays=[1,2,3,4,5];settings.blazerDays=[];settings.vestMode='auto';dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')};
  const reqs=[];
  const device=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:900}});
    // the worker answers no /sync: the wardrobe is set in memory only (setup), and a sync landing late (the start-up one, 300 ms
    // after the database opens) emptied it in a full run four at a time, so the plan, and the photos it fetched, changed under the test
    await ctx.route(HOST+'**',async route=>{const q=route.request();if(new URL(q.url()).pathname==='/sync')return route.fulfill({status:503,body:'sync is off in this test'});reqs.push(q.method()+' '+q.url().slice(HOST.length));
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    // the worker is set before the page loads: set on a first page and then reloaded, that first page's delayed start-up work (the
    // assembled pictures' look at the worker) could still ask for a photo before the reload, which read as a download made twice
    await ctx.addInitScript(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');localStorage.setItem('last_sync',String(Date.now()))},HOST);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    return {p,errs,ctx}};
  try{
    // the plan's combinations for November, worked out once; the worker has photos for all but two of them
    const A=await device();await A.p.evaluate(setup);
    const plan=await A.p.evaluate(()=>{const out={};for(const [k,o] of Object.entries(planFor()))if(o.top&&keyDate(k).getMonth()===10)out[k]=comboKey(o);return out});
    const keys=[...new Set(Object.values(plan))],missing=keys.slice(-2);
    for(const k of keys)if(!missing.includes(k))store.set('render:'+k,JSON.stringify({sig:'x',img:JPG,model:'m',t:5}));
    await A.ctx.close();
    // a fresh install: nothing stored on the device
    reqs.length=0;const B=await device();await B.p.evaluate(setup);
    const want=keys.filter(k=>!missing.includes(k));
    await B.p.waitForFunction(w=>w.every(k=>renders[k]),want,{timeout:20000}).catch(()=>{});
    const have=await B.p.evaluate(w=>w.filter(k=>renders[k]).length,want);
    ok(have===want.length,`a new install downloads the month's photos in the background without visiting each day (${have} of ${want.length})`);
    const gets=reqs.filter(r=>/^GET render\?key=/.test(r)).map(r=>r.split('key=')[1]);
    ok(reqs.filter(r=>r==='GET render?list=1').length===1,'one request lists what the worker has');
    ok(gets.length===new Set(gets).size,`nothing is downloaded twice (${gets.length} downloads, ${new Set(gets).size} photos)`);
    ok(!gets.some(k=>missing.includes(k)),'combinations the worker has no photo for are not asked for');
    // nearest the selected day first: the first downloads are for days close to Nov 16
    const dayOf=k=>Object.entries(plan).filter(([,v])=>v===k).map(([d])=>Math.abs(+new Date(d.replace(/-(\d)\b/g,'-0$1'))-+new Date('2026-11-16')))
      .reduce((a,b)=>Math.min(a,b),1e15)/864e5;
    const firstDays=gets.filter(k=>keys.includes(k)).slice(0,3).map(dayOf);   // outfit photos (product pictures of shoes etc. use the same endpoint)
    ok(firstDays.every(d=>d<=4),`downloads start with the days nearest the one on screen (${firstDays.join(', ')} days away)`);
    // swiping to another day shows its photo straight away
    const day=Object.keys(plan).find(d=>d!=='2026-11-16'&&!missing.includes(plan[d])&&new Date(d.replace(/-(\d)\b/g,'-0$1'))>new Date('2026-11-20'));
    const shown=await B.p.evaluate(d=>{const [y,m,dd]=d.split('-').map(Number);sel=new Date(y,m-1,dd);renderToday();return !!document.querySelector('.fig.photo img')},day);
    ok(shown,`swiping to ${day} shows the photo immediately`);
    // a day already here and on the worker is not downloaded again when shown
    const before=reqs.length;await B.p.evaluate(()=>{sel=new Date(2026,10,17);renderToday()});await B.p.waitForTimeout(600);
    ok(!reqs.slice(before).some(r=>keys.some(k=>r==='GET render?key='+k)),'showing a day whose photo is already here does not download it again');
    ok(B.errs.length===0,'no page errors ('+B.errs.join('; ')+')');
  }finally{await browser.close()}
};
