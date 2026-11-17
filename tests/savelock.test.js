// One save at a time per person (CR-6-01, the 2026-11-16 code review). KV has no compare-and-swap: two phones saving from the same version
// both passed the baseRev check, both were answered {rev: N+1}, and the later write replaced the earlier one's change (20 of 20 races lost
// a save at 15 ms a KV call). The person's RenderHub (a Durable Object) now holds a lock around the version check and the write, and the
// version the last save committed (KV can show an older one for about a minute elsewhere). The real worker.js in Node against a KV that
// waits 4-12 ms a call and a RenderHub per name that counts its requests; each phone does what sync.js does: on a 409 it asks again
// since its version and posts again.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default,realNow=Date.now;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const world=({ms=[4,12],hub=true,stale=null}={})=>{
    const store=new Map(),meta=new Map(),w={store,meta,puts:[],hubReq:{},stale};
    const wait=()=>sleep(ms[0]+Math.random()*(ms[1]-ms[0]));
    const val=(v,t)=>{const tt=typeof t==='object'&&t?t.type:t;if(tt==='json')return JSON.parse(v);if(tt==='stream')return new Response(v).body;if(tt==='arrayBuffer')return new TextEncoder().encode(v).buffer;return v};
    w.KV={get:async(k,t)=>{await wait();if(w.stale&&w.stale[k])return val(w.stale[k].v,t);return store.has(k)?val(store.get(k),t):null},
      getWithMetadata:async(k,t)=>{await wait();if(w.stale&&w.stale[k])return {value:val(w.stale[k].v,t),metadata:w.stale[k].m};return {value:store.has(k)?val(store.get(k),t):null,metadata:meta.get(k)||null}},
      put:async(k,v,o)=>{await wait();w.puts.push(k);store.set(k,typeof v==='string'?v:new TextDecoder().decode(v));meta.set(k,o&&o.metadata)},
      delete:async k=>{await wait();store.delete(k);meta.delete(k)},
      list:async({prefix=''}={})=>{await wait();return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name)})),list_complete:true}}};
    const hubs=new Map();w.hubOf=n=>{if(!hubs.has(n)){const st=new Map();hubs.set(n,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},delete:async k=>{st.delete(k)},deleteAll:async()=>st.clear()}},{}))}return hubs.get(n)};
    w.down=false;
    w.env={APP_TOKEN:'own',WARDROBE:w.KV,...(hub?{RENDER_HUB:{idFromName:x=>x,get:n=>({fetch:async(u,i)=>{if(w.down)throw new Error('hub restarting');const p=new URL(u).pathname;w.hubReq[p]=(w.hubReq[p]||0)+1;await sleep(2);return w.hubOf(n).fetch(new Request(u,i))}})}}:{})};
    w.call=async(p,o={},tok='own')=>{const r=await worker.fetch(new Request('https://w.test/'+p,{method:o.method||'GET',headers:{'x-app-token':tok,'content-type':'application/json'},body:o.body}),w.env);const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}return {s:r.status,j}};
    return w};
  const tie=(id,c)=>({id,type:'tie',primaryColor:c,pattern:'solid',added:1,updated:Date.now()});
  const day=new Date().toISOString().slice(0,10);
  const post=(w,base,items,tok='own')=>w.call('sync',{method:'POST',body:JSON.stringify({baseRev:base.rev,baseSaved:base.saved,day,delta:{items,days:[],tombstones:{}},photos:{}})},tok);
  // a phone as sync.js syncs: on 409 (another device saved first) it asks again since what it had, and posts again (6 tries)
  const phone=async(w,base,it,tok='own')=>{for(let a=0;a<6;a++){const p=await post(w,base,[it],tok);if(p.s!==409)return {...p,tries:a+1};base=(await w.call('sync?lite=1&since='+encodeURIComponent(base.rev+':'+base.saved),{},tok)).j}return {s:0}};
  try{
    // ---- 20 races of two saves from the same version
    {let lost=0,both=0,same=0,retried=0,putsLast=0,lockLast=0;
      for(let r=0;r<20;r++){const w=world();
        await post(w,{rev:0,saved:0},[tie('first','red')]);
        const L=(await w.call('sync?lite=1')).j;w.puts.length=0;w.hubReq={};
        const [a,b]=await Promise.all([phone(w,L,tie('phoneA','navy')),phone(w,L,tie('phoneB','green'))]);
        const after=(await w.call('sync?lite=1')).j,ids=after.items.map(i=>i.id);
        if(a.s===200&&b.s===200)both++;if(!ids.includes('phoneA')||!ids.includes('phoneB'))lost++;if(a.j&&b.j&&a.j.saved===b.j.saved)same++;retried+=a.tries+b.tries-2;
        putsLast=w.puts.length;lockLast=w.hubReq['/lock']||0}
      ok(both===20&&lost===0,`two phones saving at once: both saves are in the backup in 20 of 20 races (lost ${lost}, both answered 200 in ${both}; one asked again ${retried} times)`);
      ok(same===0,`the two saves never share a save time (${same} of 20): a phone's quick check can't mistake the other's version for its own`);
      ok(putsLast===4,`a race costs no extra KV write: ${putsLast} puts for the two saves (the backup twice, the day's two copies once)`);
      ok(lockLast>=6&&lockLast<=12,`the lock is 2 requests to the person's hub per save tried, and a few more while one waits for it (${lockLast} for two saves and the one asked again)`);}
    // ---- an older app's whole PUT and a small sync at the same moment
    {const w=world();await post(w,{rev:0,saved:0},[tie('first','red')]);const L=(await w.call('sync?lite=1')).j;
      const full=async it=>{for(let a=0;a<6;a++){const g=(await w.call('sync')).j;const r=await w.call('sync',{method:'PUT',body:JSON.stringify({baseRev:g.rev,day,data:{...g.data,items:[...g.data.items,it]}})});if(r.s!==409)return r}return {s:0}};
      const [a,b]=await Promise.all([full(tie('oldApp','navy')),phone(w,L,tie('newApp','green'))]);
      const ids=(await w.call('sync?lite=1')).j.items.map(i=>i.id);
      ok(a.s===200&&b.s===200&&ids.includes('oldApp')&&ids.includes('newApp'),`an older app's PUT and this app's POST at once: both kept (${ids.join(',')})`);}
    // ---- KV showing an older version than the last save committed (a stale read in another location): asked to try again
    {const w=world();await post(w,{rev:0,saved:0},[tie('a','red')]);const v1={v:w.store.get('wardrobe:v1'),m:w.meta.get('wardrobe:v1')};
      const L=(await w.call('sync?lite=1')).j,r2=await post(w,L,[tie('b','navy')]);
      w.stale={'wardrobe:v1':v1};   // this location still reads rev 1
      const r3=await post(w,{rev:1,saved:v1.m.saved},[tie('c','green')]);
      w.stale=null;const L3=(await w.call('sync?lite=1')).j,r4=await post(w,L3,[tie('c','green')]);
      const ids=(await w.call('sync?lite=1')).j.items.map(i=>i.id);
      ok(r2.s===200&&r3.s===409&&r4.s===200&&ids.join()==='a,b,c',`a save that reads an older version than the hub committed is answered 409, not written over it (${r3.s}); once KV agrees it goes through (${ids.join(',')})`);}
    // ---- a fork from before the lock (same rev, another save time): 409, and the phone's next round sends what the backup lacks
    {const w=world();await post(w,{rev:0,saved:0},[tie('a','red')]);const L=(await w.call('sync?lite=1')).j;
      const r=await post(w,{rev:L.rev,saved:L.saved-5},[tie('b','navy')]);
      ok(r.s===409&&r.j.rev===L.rev&&r.j.saved===L.saved,`a save based on the same rev with another save time is answered 409 with the stored version (${r.s})`);
      const old=await w.call('sync',{method:'POST',body:JSON.stringify({baseRev:L.rev,day,delta:{items:[tie('c','green')],days:[],tombstones:{}},photos:{}})});
      ok(old.s===200,'a save that sends no baseSaved is taken as before');}
    // ---- busy: a lock held by a save still running answers 409 after about 3 s, the tester's backup count given back
    {const w=world({ms:[1,2]});
      const inv=(await w.call('invites',{method:'POST',body:JSON.stringify({name:'Tess'})})).j;
      const tok=inv.code,hub=w.hubOf('renders:u:'+inv.id+':');
      const held=await (await hub.fetch(new Request('https://hub/lock',{method:'POST',body:JSON.stringify({op:'take'})}))).json();
      const t0=realNow(),r=await post(w,{rev:0,saved:0},[tie('x','red')],tok),waited=realNow()-t0;
      const used=(await (await hub.fetch(new Request('https://hub/used?day='+day))).json()).used;
      ok(held.ok&&r.s===409&&r.j.busy===true&&waited>=2000&&waited<6000&&!w.store.has(`u:${inv.id}:wardrobe:v1`)&&!used.backup,`a save that finds the lock held waits about 3 s, then answers 409 busy (the app asks again) and gives the backup back (${r.s} after ${waited} ms, backups ${used.backup||0})`);
      await hub.fetch(new Request('https://hub/lock',{method:'POST',body:JSON.stringify({op:'give',tok:'not-the-holder'})}));
      ok((await post(w,{rev:0,saved:0},[tie('x','red')],tok)).s===409,'only the holder lets go of the lock');
      try{Date.now=()=>realNow()+31e3;const r2=await post(w,{rev:0,saved:0},[tie('x','red')],tok);ok(r2.s===200,`a lock never given back (its save killed) is free after 30 s (${r2.s})`)}finally{Date.now=realNow}}
    // ---- the lock is given back on every answer, an error included
    {const w=world({ms:[1,2]});await post(w,{rev:0,saved:0},[tie('a','red')]);
      const bad=await post(w,{rev:7,saved:1},[tie('b','red')]),junk=await post(w,{rev:1,saved:1},[{id:'"><img>',type:'tie'}]);
      const p0=w.KV.put;w.KV.put=async()=>{throw new Error('KV put() limit exceeded for the day.')};const full=await post(w,(await w.call('sync?lite=1')).j,[tie('c','red')]);w.KV.put=p0;
      const t0=realNow(),next=await post(w,(await w.call('sync?lite=1')).j,[tie('d','red')]);
      ok(bad.s===409&&junk.s===400&&full.s===429&&next.s===200&&realNow()-t0<1500,`after a conflict, a refused record and a failed write the next save goes straight through (${bad.s}, ${junk.s}, ${full.s}, then ${next.s})`);}
    // ---- the hub can't be asked: the save goes ahead unlocked, as before (backups never stop because of the hub)
    {const w=world({ms:[1,2]});w.down=true;const r=await post(w,{rev:0,saved:0},[tie('a','red')]);
      ok(r.s===200&&w.store.has('wardrobe:v1'),`with the hub not answering, a save still goes through (${r.s})`);
      const nohub=world({ms:[1,2],hub:false});ok((await post(nohub,{rev:0,saved:0},[tie('a','red')])).s===200,'and without the binding (as before)');}
    // ---- the owner's "Delete everything": the hub forgets the version it held, so the next first save is not taken for a stale read
    {const w=world({ms:[1,2]});await post(w,{rev:0,saved:0},[tie('a','red')]);await post(w,(await w.call('sync?lite=1')).j,[tie('b','red')]);
      const d=await w.call('account',{method:'DELETE',body:JSON.stringify({confirm:'delete'})});
      const r=await post(w,{rev:0,saved:0},[tie('c','red')]);
      ok(d.s===200&&r.s===200&&(await w.call('sync?lite=1')).j.rev===1,`after "Delete everything" a save from nothing goes through at once (${d.s}, ${r.s})`);}
  }finally{Date.now=realNow}
};
