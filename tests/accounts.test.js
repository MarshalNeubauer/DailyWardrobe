// The server for more than one person: the owner (the APP_TOKEN secret) and invited testers (a code each). Every person's data
// sits under their own key prefix; the owner's prefix is empty, so the owner's keys keep their exact names. Testers have daily
// caps, counted in their Durable Object. Mocked KV, queue, Durable Object, OpenAI and Claude; the real worker.js and app.
const path=require('path'),fs=require('fs'),crypto=require('crypto'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,settle,ROOT})=>{
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const TAG={type:'tie',primaryColor:'navy',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'silk',texture:'smooth',formality:'business',season:'all'};
  // the outside world: OpenAI (what it was asked is kept), Claude, and a few web addresses for /fetch
  const realFetch=globalThis.fetch,realNow=Date.now;let openai=[],claude=0,imgReply=()=>[200,{data:[{b64_json:JPG}]}],web={},pulled=0;
  globalThis.fetch=async(href,init)=>{href=String(href);
    if(href.startsWith('https://api.openai.com/v1/images/')){const f=init&&init.body&&init.body.get?init.body:null;openai.push({model:f?f.get('model'):JSON.parse(init.body).model,quality:f?f.get('quality'):JSON.parse(init.body).quality,complexity:f?f.get('complexity'):null});
      const [st,b]=imgReply();return new Response(JSON.stringify(b),{status:st,headers:{'content-type':'application/json'}})}
    if(href==='https://api.anthropic.com/v1/messages'){claude++;const sys=JSON.parse(init.body),props=sys.output_config.format.schema.properties||{};
      return new Response(JSON.stringify({model:'claude-test',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(props.items?{items:[]}:props.layout?{layout:'none'}:TAG)}]}),{status:200,headers:{'content-type':'application/json'}})}
    const w=web[href];return w?w():new Response('nope',{status:404})};
  const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
  // KV: values, metadata and expiry, and a count of what the free plan rations (writes and lists)
  const store=new Map(),meta=new Map(),ttl=new Map(),n={put:0,del:0,list:0};
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,
    put:async(k,v,o)=>{n.put++;store.set(k,v);meta.set(k,o&&o.metadata);ttl.set(k,o&&o.expirationTtl)},delete:async k=>{n.del++;store.delete(k);meta.delete(k)},
    list:async({prefix})=>{n.list++;return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name)})),list_complete:true}}};
  let sent=[];const Q={send:async m=>{sent.push(m)}};
  // Durable Objects: one RenderHub per name, each with its own storage
  const hubs=new Map(),hubOf=name=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,{st,hub:new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},deleteAll:async()=>{st.clear()}}},{})})}return hubs.get(name)};
  const HUB={idFromName:x=>x,get:name=>({fetch:(u,init)=>hubOf(name).hub.fetch(new Request(u,init))})};
  const env={APP_TOKEN:'owner-secret',OPENAI_API_KEY:'k',ANTHROPIC_API_KEY:'a',WARDROBE:KV,RENDER_QUEUE:Q,RENDER_HUB:HUB},HOST='https://w.test/';
  const call=(method,p,tok,body,e=env,h={})=>worker.fetch(new Request(HOST+p,{method,headers:{...(tok?{'x-app-token':tok}:{}),'content-type':'application/json',...h},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}),e);
  const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
  const drain=async()=>{const out=[];const msgs=sent.splice(0);for(const body of msgs){const m={body,attempts:body._a||1,acked:false,retried:null,ack(){this.acked=true},retry(o){this.retried=o}};
    await worker.queue({messages:[m]},env);if(m.retried)sent.push({...body,_a:(body._a||1)+1});out.push(m)}return out};
  const O='owner-secret',keysOf=pre=>[...store.keys()].filter(k=>k.startsWith(pre)).sort();
  const browser=await chromium.launch();
  try{
    // ---- nothing runs without APP_TOKEN
    {const bare={...env,APP_TOKEN:undefined},res=[];
      for(const [m,p,b] of [['POST','',{image:PNG}],['POST','tag-many',{image:PNG}],['POST','pattern',{image:PNG}],['GET','me'],['GET','sync'],['PUT','sync',{baseRev:0,data:{}}],['GET','render?key=c0123456789abcdef'],['GET','render?list=1'],
        ['POST','render',{image:PNG}],['PUT','render',{}],['DELETE','render?key=c0123456789abcdef'],['GET','render-queue'],['GET','render-wait?keys=c0123456789abcdef'],['GET','fetch?url=https://a.test/x.png'],['GET','holidays?country=nl'],
        ['GET','invites'],['POST','invites',{name:'x'}],['POST','feedback',{text:'hi'}],['GET','feedback'],['DELETE','account',{confirm:'delete'}]])res.push((await call(m,p,'anything',b,bare)).status);
      const body=await J(await call('POST','','',{image:PNG,appToken:''},bare));
      ok(res.every(s=>s===403)&&claude===0&&openai.length===0,`with APP_TOKEN unset every route refuses, the three tagging routes included (${res.join()})`);
      ok(body.s===403&&/APP_TOKEN/.test(body.error),'and says that the secret is missing')}
    // ---- the owner
    let me=await J(await call('GET','me',O));
    ok(me.s===200&&me.id==='owner'&&me.role==='owner'&&me.caps===null&&me.used&&me.used.photo===0&&/^\d{4}-\d\d-\d\d$/.test(me.day),'GET /me: the owner, with no caps');
    ok((await call('GET','me','owner-secreT')).status===403&&(await call('GET','me','')).status===403&&(await call('GET','me','x'.repeat(40))).status===403,'a wrong token, no token and an unknown code are refused');
    {const a=await J(await call('POST','',null,{image:PNG,appToken:O})),b=await call('POST','',null,{image:PNG,appToken:'nope'});
      ok(a.s===200&&a.type==='tie'&&b.status===403,'POST / still takes the token from the body (an older cached app)')}
    // ---- invitations
    let r=await J(await call('POST','invites',O,{name:'Tess'}));const A={id:r.id,code:r.code,ns:`u:${r.id}:`};
    ok(r.s===200&&/^[A-Za-z0-9_-]{24,}$/.test(r.code)&&/^[a-z0-9]{8,}$/.test(r.id)&&r.name==='Tess','POST /invites makes a tester: an id and a code of 24+ URL-safe characters');
    ok(store.has('invite:'+sha(r.code))&&![...store.values()].some(v=>String(v).includes(r.code)),'only the SHA-256 of the code is kept (invite:<hash>); the code itself is nowhere in the store');
    r=await J(await call('POST','invites',O,{name:'Bo',caps:{photo:3,item:2,tag:2,pattern:1}}));const B={id:r.id,code:r.code,ns:`u:${r.id}:`};
    ok((await call('POST','invites',A.code,{name:'x'})).status===403&&(await call('GET','invites',A.code)).status===403&&(await call('DELETE','invites?id='+B.id,A.code)).status===403&&(await call('POST','invites',O,{name:''})).status===400,'invitations are the owner\'s: a tester can\'t make, list or revoke them; a name is needed');
    // a new invitation's first week has twice the limits; the testers below are made a week older so the usual limits apply
    {me=await J(await call('GET','me',A.code));
      ok(JSON.stringify(me.caps)===JSON.stringify({tag:80,pattern:20,photo:24,item:40})&&me.firstUntil>Date.now()+6.9*86400000,`a tester's first week: twice every daily limit, and /me says until when (${JSON.stringify(me.caps)})`);
      for(const x of [A,B]){const k='invite:'+sha(x.code),rec=JSON.parse(store.get(k));rec.created-=8*86400000;store.set(k,JSON.stringify(rec))}}
    me=await J(await call('GET','me',B.code));
    ok(!me.firstUntil&&me.id===B.id&&me.name==='Bo'&&me.role==='tester'&&me.caps.photo===3&&me.caps.item===2&&me.caps.tag===2&&me.caps.pattern===1,'GET /me: a tester with the caps of their invitation');
    me=await J(await call('GET','me',A.code));
    ok(JSON.stringify(me.caps)===JSON.stringify({tag:40,pattern:10,photo:12,item:20}),'an invitation without caps gets the defaults: 40 readings, 10 patterns, 12 photos, 20 item pictures');
    // ---- sync and snapshots, each to their own
    const put=(tok,data,day)=>call('PUT','sync',tok,{baseRev:0,data,day});
    ok((await put(O,{who:'owner'},'2026-03-01')).status===200&&(await put(A.code,{who:'tess'},'2026-03-01')).status===200&&(await put(B.code,{who:'bo'},'2026-03-01')).status===200,'three people save a backup, each from revision 0');
    const got=async tok=>(await J(await call('GET','sync',tok))).data;
    ok((await got(O)).who==='owner'&&(await got(A.code)).who==='tess'&&(await got(B.code)).who==='bo','each reads back their own backup');
    for(const [tok,w] of [[O,'owner'],[A.code,'tess'],[B.code,'bo']])await call('PUT','sync',tok,{baseRev:1,data:{who:w,v:2},day:'2026-03-02'});
    const snaps=async tok=>(await J(await call('GET','sync?snaps=1',tok))).snaps.map(s=>s.id).sort().join();
    ok((await snaps(O))==='2026-03,2026-03-02'&&(await snaps(A.code))==='2026-03,2026-03-02'&&(await snaps(B.code))==='2026-03,2026-03-02','each has their own daily copies');
    ok((await J(await call('GET','sync?snap=2026-03-02',A.code))).data.who==='tess'&&(await J(await call('GET','sync?snap=2026-03-02',O))).data.who==='owner','a roll back reads the caller\'s copy');
    await call('PUT','sync',A.code,{baseRev:2,data:{who:'tess',v:3},day:'2026-03-02',reason:'restore'});
    ok(store.has(A.ns+'snap:before-restore')&&!store.has('snap:before-restore')&&!store.has(B.ns+'snap:before-restore')&&JSON.parse(store.get('wardrobe:v1')).data.v===2,'a tester\'s roll back keeps its undo copy under their prefix and leaves the others\' backups alone');
    ok(keysOf('wardrobe').join()==='wardrobe:v1'&&keysOf('snap:').join()==='snap:2026-03,snap:2026-03-02'&&keysOf(A.ns).join()===[A.ns+'snap:2026-03',A.ns+'snap:2026-03-02',A.ns+'snap:before-restore',A.ns+'wardrobe:v1'].join(),
      'the owner\'s backup is wardrobe:v1 and snap:<day> / snap:<month>, exactly as before; a tester\'s are u:<id>:wardrobe:v1 and u:<id>:snap:…');
    // ---- photos
    const K='c0123456789abcdef',K2='c1111111111111111',rec=t=>({key:K,rec:{img:'data:image/jpeg;base64,'+JPG,sig:t,model:'m',t:5}});
    await call('PUT','render',A.code,rec('tess'));
    ok((await call('GET','render?key='+K,B.code)).status===404&&(await call('GET','render?key='+K,O)).status===404&&(await J(await call('GET','render?key='+K,A.code))).sig==='tess','a tester\'s photo is theirs alone: the owner and the other tester get 404 for its key');
    await call('PUT','render',O,rec('owner'));await call('PUT','render',B.code,{...rec('bo'),key:K2});
    const list=async tok=>(await J(await call('GET','render?list=1',tok))).keys.join();
    ok((await list(O))===K&&(await list(A.code))===K&&(await list(B.code))===K2&&(await J(await call('GET','render?key='+K,O))).sig==='owner','GET /render?list=1 lists only the caller\'s photos');
    await call('DELETE','render?key='+K,A.code);
    ok(store.has('render:'+K)&&!store.has(A.ns+'render:'+K)&&store.has(B.ns+'render:'+K2),'deleting a photo deletes the caller\'s, kept as render:<key> for the owner and u:<id>:render:<key> for a tester');
    // ---- the queue
    const QK='c2222222222222222';
    await call('POST','render',A.code,{mode:'queue',key:QK,image:PNG,sig:'tess'});await call('POST','render',O,{mode:'queue',key:QK,image:PNG,sig:'owner'});
    ok(JSON.stringify(sent)===JSON.stringify([{key:QK,ns:A.ns},{key:QK}]),`a tester\'s queue message carries their prefix; the owner\'s is {key} alone, as it always was (${JSON.stringify(sent)})`);
    ok(store.has('job:'+QK)&&store.has('jobrun:'+QK)&&store.has(A.ns+'job:'+QK)&&store.has(A.ns+'jobrun:'+QK),'the owner\'s job is job:<key> and jobrun:<key>; the tester\'s the same under u:<id>:');
    const st=async(tok,k=QK)=>J(await call('GET','render-queue?keys='+k,tok));
    ok((await st(B.code)).pending.length===0&&(await st(A.code)).pending.join()===QK&&(await st(O)).pending.join()===QK&&(await st(B.code,'')).pending.length===0,'GET /render-queue reports only the caller\'s photos');
    // the push: B waits for the same key and must not get A's photo
    const wait=(tok,ms)=>call('GET',`render-wait?keys=${QK}&ms=${ms}`,tok).then(x=>x.json());
    const wB=wait(B.code,1500),wA=wait(A.code,8000),wO=wait(O,8000);await new Promise(x=>setTimeout(x,50));
    const lists0=n.list;await drain();const [gA,gO,gB]=[await wA,await wO,await wB];
    ok(gA.length===1&&gA[0].rec.sig==='tess'&&gO.length===1&&gO[0].rec.sig==='owner'&&gB.length===0,'GET /render-wait hands each person their own finished photo; someone else waiting for the same key gets nothing');
    ok(JSON.parse(store.get('render:'+QK)).sig==='owner'&&JSON.parse(store.get(A.ns+'render:'+QK)).sig==='tess'&&!store.has('job:'+QK)&&!store.has(A.ns+'job:'+QK)&&n.list===lists0,'the consumer writes each photo under its person and clears the job, without a KV list');
    ok([...hubs.keys()].sort().join()===['renders','renders:'+A.ns,'renders:'+B.ns,'renders:u:all:'].sort().join(),'one hub per person: the owner\'s is still the one named "renders"; one more counts all the testers together');
    imgReply=()=>[400,{error:{message:'not allowed'}}];
    await call('POST','render',O,{mode:'queue',key:K2,image:PNG});await drain();
    ok(store.has('jobfail:'+K2)&&!store.has('job:'+K2)&&!store.has('jobrun:'+K2),'a failed photo of the owner\'s is recorded as jobfail:<key>');
    imgReply=()=>[200,{data:[{b64_json:JPG}]}];
    // every key the owner has: the names are byte for byte what they were before there were testers
    ok(keysOf('').filter(k=>!/^(u:|invite:|invites:index$)/.test(k)).join()===['jobfail:'+K2,'render:'+K,'render:'+QK,'snap:2026-03','snap:2026-03-02','wardrobe:v1'].join(),`the owner\'s keys, all of them: ${keysOf('').filter(k=>!/^(u:|invite)/.test(k)).join(' ')}`);
    // ---- caps (Bo: 3 photos, 2 item pictures, 2 readings, 1 pattern)
    const photo=(tok,x={})=>call('POST','render',tok,{image:PNG,outfit:'a navy suit',...x});
    const puts0=n.put;openai=[];
    ok((await photo(B.code,{model:'gpt-image-9',quality:'high',complexity:'high'})).status===200&&openai[0].model==='gpt-image-2'&&openai[0].quality==='medium'&&!openai[0].complexity,'a tester\'s model, quality and complexity are ignored: the server\'s own are used');
    await photo(O,{model:'gpt-image-9',quality:'high'});
    ok(openai[1].model==='gpt-image-9'&&openai[1].quality==='high','the owner can still choose them');
    ok((await call('POST','render',B.code,{mode:'queue',key:'c3333333333333333',image:PNG,model:'gpt-image-9',quality:'high'})).status===200&&!JSON.parse(store.get(B.ns+'job:c3333333333333333')).model&&!JSON.parse(store.get(B.ns+'job:c3333333333333333')).quality,'a queued photo of a tester\'s keeps no model or quality either');
    ok((await J(await call('POST','render',B.code,{mode:'queue',key:'c3333333333333333',image:PNG,replace:true}))).queued,'a third photo, queued with replace, still fits');
    r=await J(await photo(B.code));
    ok(r.s===429&&r.error==='limit'&&r.what==='photo'&&r.cap===3&&r.used===3&&r.message==='Today’s limit of 3 outfit photos is used up. It starts again at midnight UTC.',`the fourth answers 429 with a plain sentence (${r.message})`);
    ok((await call('POST','render',B.code,{mode:'queue',key:'c4444444444444444',image:PNG})).status===429&&!store.has(B.ns+'job:c4444444444444444'),'a queued photo over the cap is refused too, and nothing is stored for it');
    ok((await photo(A.code)).status===200&&(await photo(O)).status===200,'the other tester and the owner are not affected');
    ok((await call('POST','render',B.code,{mode:'item',item:'a black belt',key:'c5555555555555555'})).status===200&&(await photo(B.code,{swap:{what:'tie',text:'a red tie'}})).status===200,'item pictures and one-piece edits count as item pictures, not outfit photos');
    r=await J(await call('POST','render',B.code,{mode:'item',item:'black shoes'}));
    ok(r.s===429&&r.what==='item'&&r.cap===2&&/2 item pictures/.test(r.message),'the item cap answers 429 in its own words');
    ok((await call('POST','',B.code,{image:PNG})).status===200&&(await call('POST','tag-many',B.code,{image:PNG})).status===200,'two readings: one photo and a photo of several items');
    r=await J(await call('POST','',B.code,{image:PNG}));const r2=await J(await call('POST','tag-many',B.code,{image:PNG}));
    ok(r.s===429&&r.what==='tag'&&r.detail===r.message&&r2.s===429&&/2 photo readings/.test(r2.message),'POST / and /tag-many share the reading cap');
    await call('POST','pattern',B.code,{image:PNG,type:'tie'});r=await J(await call('POST','pattern',B.code,{image:PNG,type:'tie'}));
    ok(r.s===429&&r.what==='pattern'&&r.cap===1,'/pattern has its own cap');
    me=await J(await call('GET','me',B.code));
    ok(JSON.stringify(me.used)===JSON.stringify({tag:2,pattern:1,photo:3,item:2}),`GET /me shows today's use (${JSON.stringify(me.used)})`);
    r=await J(await call('GET','invites',O));const iB=r.invites.find(v=>v.id===B.id),iA=r.invites.find(v=>v.id===A.id);
    ok(r.invites.length===2&&iB.name==='Bo'&&iB.used.photo===3&&iB.caps.photo===3&&iA.used.photo===2&&iA.caps.photo===12&&!JSON.stringify(r).includes(sha(B.code)),'GET /invites lists the testers with today\'s use, and no hashes');
    ok(!keysOf('use:').length&&[...store.keys()].every(k=>!/use:/.test(k))&&hubOf('renders:'+B.ns).st.get('use').n.photo===3&&!hubs.get('renders').st.has('use'),'the counting is in the tester\'s Durable Object: no KV key is written for it, and the owner is not counted');
    // a call that fails gives its count back; so does a queued photo that can't be made
    imgReply=()=>[400,{error:{message:'not allowed'}}];
    const used=async t=>(await J(await call('GET','me',t))).used;const a0=(await used(A.code)).photo;
    await photo(A.code);await call('POST','render',A.code,{mode:'queue',key:'c6666666666666666',image:PNG});const mid=(await used(A.code)).photo;await drain();
    ok(mid===a0+1&&(await used(A.code)).photo===a0&&store.has(A.ns+'jobfail:c6666666666666666'),'a photo that fails is not counted: a direct one at once, a queued one when the consumer gives up');
    imgReply=()=>[200,{data:[{b64_json:JPG}]}];
    // the next UTC day
    Date.now=()=>realNow()+86400000;
    r=await J(await photo(B.code));me=await J(await call('GET','me',B.code));
    ok(r.s===200&&me.used.photo===1&&me.used.tag===0,'the next day the caps are clear');
    Date.now=realNow;
    // without the Durable Object: counted in KV, kept three days
    {const e2={...env,RENDER_HUB:undefined},day=new Date().toISOString().slice(0,10),k=`use:${B.id}:${day}`;
      const s=[];for(let i=0;i<4;i++)s.push((await call('POST','render',B.code,{image:PNG},e2)).status);
      ok(s.join()==='200,200,200,429'&&JSON.parse(store.get(k)).photo===3&&ttl.get(k)===3*86400,'without the RENDER_HUB binding the count is kept in KV as use:<id>:<day> for three days');
      store.delete(k)}
    // ---- a tester's errors are in plain words; the owner's keep the detail
    {imgReply=()=>[400,{error:{message:'Your organization must be verified to use the model gpt-image-2'}}];
      const rt=await J(await photo(A.code)),ro=await J(await photo(O));
      ok(!/OpenAI|verif|organization|model/i.test(JSON.stringify(rt))&&rt.error==='server'&&/photo service had a problem/.test(rt.message),`a tester's failed photo says so plainly (${rt.message})`);
      ok(/OpenAI/.test(ro.error)&&/verif/.test(ro.error),'the owner still sees what to fix');
      await call('POST','render',A.code,{mode:'queue',key:'c7777777777777777',image:PNG});await drain();
      const jf=JSON.parse(store.get(A.ns+'jobfail:c7777777777777777')||'{}'),qs=await J(await call('GET','render-queue?keys=c7777777777777777',A.code));
      ok(/photo service had a problem/.test(jf.error)&&!JSON.stringify(qs).includes('OpenAI'),'a tester\'s queued photo that failed is kept and reported in plain words too');
      imgReply=()=>[200,{data:[{b64_json:JPG}]}];}
    // ---- a tester's backups: 30 a day; a conflict doesn't count
    {r=await J(await call('POST','invites',O,{name:'Kit'}));const K={id:r.id,code:r.code};{const k='invite:'+sha(K.code),rec=JSON.parse(store.get(k));rec.created-=8*86400000;store.set(k,JSON.stringify(rec))}
      const rev=async()=>(await J(await call('GET','sync',K.code))).rev||0,st=[];
      ok((await call('PUT','sync',K.code,{baseRev:99,data:{items:[]},day:'2026-03-01'})).status===409,'(a conflict first)');
      for(let i=0;i<31;i++)st.push(await J(await call('PUT','sync',K.code,{baseRev:await rev(),data:{items:[{id:'k'+i}]},day:'2026-03-01'})));
      ok(st.slice(0,30).every(x=>x.s===200)&&st[30].s===429&&st[30].what==='backup'&&/backed up tomorrow/.test(st[30].message),`30 backups a day, the 31st is refused in plain words; the conflict before didn't count (${st[30].message})`);
      ok((await call('PUT','sync',O,{baseRev:(await J(await call('GET','sync',O))).rev||0,data:{items:[]},day:'2026-03-01'})).status===200,'the owner has no such limit');}
    // ---- feedback
    ok((await J(await call('POST','feedback',A.code,{text:'The tie looks purple.',version:'144',where:'today'}))).ok&&(await call('POST','feedback',A.code,{text:'x'.repeat(4001)})).status===400&&(await call('POST','feedback',A.code,{text:'  '})).status===400,'POST /feedback takes up to 4,000 characters');
    await call('POST','feedback',B.code,{text:'x'.repeat(4000),version:7});
    r=await J(await call('GET','feedback',O));
    ok((await call('GET','feedback',A.code)).status===403&&r.items.length===2&&r.items.some(m=>m.name==='Tess'&&m.text==='The tie looks purple.'&&m.version==='144'&&m.t>0)&&ttl.get('feedback:log')===180*86400,'GET /feedback is the owner\'s: who wrote what, with the app version; kept 180 days');
    // ---- revoking
    ok((await J(await call('DELETE','invites?id='+B.id,O))).ok&&(await call('GET','me',B.code)).status===403&&(await call('GET','sync',B.code)).status===403&&(await photo(B.code)).status===403&&(await call('GET','me',A.code)).status===200,'a revoked code gets 403 everywhere, at once; the other tester carries on');
    ok((await J(await call('GET','invites',O))).invites.find(v=>v.id===B.id).off===true&&(await call('DELETE','invites?id=nobody',O)).status===404,'the list shows it as switched off');
    // all testers together have a ceiling a day (TESTER_DAILY_TOTAL changes it); the owner never counts towards it
    {const allUsed=()=>{const u=hubs.get('renders:u:all:').hub&&hubs.get('renders:u:all:').st.get('use');return u?+u.n.photo||0:0},u0=allUsed();
      r=await J(await call('POST','invites',O,{name:'Fi'}));const F={id:r.id,code:r.code};
      const e3={...env,TESTER_DAILY_TOTAL:JSON.stringify({photo:u0+1})};
      const s1=(await call('POST','render',F.code,{image:PNG,outfit:'a navy suit'},e3)).status,r2=await J(await call('POST','render',F.code,{image:PNG,outfit:'a navy suit'},e3));
      const own=(await J(await call('GET','me',F.code))).used.photo,o3=(await call('POST','render',O,{image:PNG,outfit:'a navy suit'},e3)).status;
      ok(s1===200&&r2.s===429&&r2.all===true&&/everyone testing the app/.test(r2.message)&&own===1&&allUsed()===u0+1&&o3===200,`over the total for all testers a call is refused in plain words and the tester's own count is given back; the owner carries on (${r2.message})`);
      ok(allUsed()===u0+1&&(await call('POST','render',A.code,{image:PNG,outfit:'x'},e3)).status===429&&(await call('POST','render',A.code,{image:PNG,outfit:'x'})).status===200,'it holds for every tester; the default total is higher');}
    // a switched-off tester can still delete what they stored; the owner can delete it for them
    {r=await J(await call('POST','invites',O,{name:'Gus'}));const G={id:r.id,code:r.code,ns:`u:${r.id}:`};
      await put(G.code,{who:'gus'},'2026-03-01');await call('POST','feedback',G.code,{text:'from gus'});await call('DELETE','invites?id='+G.id,O);
      const gm=await J(await call('GET','me',G.code));
      r=await J(await call('DELETE','account',G.code,{confirm:'delete'}));
      ok(gm.s===403&&gm.error==='invite off'&&r.ok&&!keysOf(G.ns).length&&!(await J(await call('GET','feedback',O))).items.some(m=>m.text==='from gus')&&(await call('GET','sync',G.code)).status===403,'a switched-off tester can still delete their data (and nothing else)');
      r=await J(await call('POST','invites',O,{name:'Hal'}));const H={id:r.id,code:r.code,ns:`u:${r.id}:`};
      await put(H.code,{who:'hal'},'2026-03-01');await call('PUT','render',H.code,rec('hal'));await call('POST','feedback',H.code,{text:'from hal'});
      const keep=keysOf('').filter(k=>!k.startsWith(H.ns)&&k!=='invites:index'&&k!=='feedback:log'&&k!=='invite:'+sha(H.code)).join('|');
      await call('DELETE','invites?id='+H.id,O);const h0=keysOf(H.ns).length;
      r=await J(await call('DELETE','invites?id='+H.id+'&purge=1',O));const hm=await J(await call('GET','me',H.code));
      ok(h0>0&&r.ok&&!keysOf(H.ns).length&&!(await J(await call('GET','invites',O))).invites.some(v=>v.id===H.id)&&!(await J(await call('GET','feedback',O))).items.some(m=>m.text==='from hal')&&hm.error==='invite off'&&keysOf('').filter(k=>!k.startsWith(H.ns)&&k!=='invites:index'&&k!=='feedback:log'&&k!=='invite:'+sha(H.code)).join('|')===keep,'the owner deletes a switched-off tester\'s data: their keys, feedback and list entry go; the code stays refused; nothing else is touched');
      ok((await call('DELETE','invites?id='+A.id+'&purge=1',A.code)).status===403,'only the owner can');}
    // ---- deleting an account
    r=await J(await call('POST','invites',O,{name:'Cy'}));const C={id:r.id,code:r.code,ns:`u:${r.id}:`};
    await put(C.code,{who:'cy'},'2026-03-01');await call('PUT','render',C.code,rec('cy'));await call('POST','feedback',C.code,{text:'bye'});
    const others=()=>keysOf('').filter(k=>!k.startsWith(C.ns)&&k!=='invites:index'&&k!=='feedback:log'&&k!=='invite:'+sha(C.code)).join('|'),before=others();
    ok((await call('DELETE','account',C.code,{})).status===400&&(await call('DELETE','account',C.code)).status===400&&keysOf(C.ns).length===2,'DELETE /account needs {confirm:"delete"}');
    r=await J(await call('DELETE','account',C.code,{confirm:'delete'}));
    ok(r.ok===true&&!keysOf(C.ns).length&&!store.has('invite:'+sha(C.code))&&(await call('GET','me',C.code)).status===403&&others()===before,'a tester\'s account: their keys and their invitation are gone, and nobody else\'s key is touched');
    ok(!(await J(await call('GET','invites',O))).invites.some(v=>v.id===C.id)&&!(await J(await call('GET','feedback',O))).items.some(m=>m.text==='bye'),'they are off the owner\'s list, and their feedback is deleted');
    // a big account is finished by the queue, a part at a time
    r=await J(await call('POST','invites',O,{name:'Di'}));const D={code:r.code,ns:`u:${r.id}:`};
    for(let i=0;i<90;i++)store.set(`${D.ns}render:c${String(i).padStart(16,'0')}`,'{}');sent=[];
    r=await J(await call('DELETE','account',D.code,{confirm:'delete'}));const left=keysOf(D.ns).length;
    ok(r.ok&&left>0&&left<90&&sent.length===1&&sent[0].wipe===D.ns,`a first part of a large account is deleted in the request (${90-left} of 90) and the rest handed to the queue`);
    for(let i=0;i<8&&sent.length;i++)await drain();
    ok(!keysOf(D.ns).length&&!sent.length&&others()===before,'which finishes it, touching nothing else');
    // the owner's own
    const theirs=()=>keysOf('').filter(k=>/^(u:|invite)/.test(k)).join('|'),t0=theirs();
    r=await J(await call('DELETE','account',O,{confirm:'delete'}));for(let i=0;i<8&&sent.length;i++)await drain();
    ok(r.ok&&!keysOf('').some(k=>/^(wardrobe:|snap:|render:|job:|jobfail:|jobrun:)/.test(k))&&theirs()===t0&&store.has('invites:index')&&store.has(A.ns+'wardrobe:v1'),'the owner\'s account: the owner\'s key families go; testers\' data, the invitations and their list stay');
    ok((await J(await call('GET','me',O))).id==='owner'&&(await got(A.code)).who==='tess','and both still work afterwards');
    // ---- hardening
    {const big=await call('POST','',O,'{"image":"'+'A'.repeat(15.2e6)+'"}'),c0=claude;
      const huge=new ReadableStream({pull(c){pulled++;if(pulled>400)c.close();else c.enqueue(new Uint8Array(1e6))}});
      const s2=await worker.fetch(new Request(HOST,{method:'POST',headers:{'x-app-token':O},body:huge,duplex:'half'}),env);
      ok(big.status===413&&s2.status===413&&pulled<40&&claude===c0,`POST / refuses a body over 15 MB and stops reading it (${pulled} MB read of 400)`)}
    {const f=async u=>(await call('GET','fetch?url='+encodeURIComponent(u),O)).status,seen=[];
      const img=()=>new Response(Buffer.from(PNG.split(',')[1],'base64'),{headers:{'content-type':'image/png'}});
      web={'https://shop.test/a.png':()=>{seen.push('a');return img()},'https://shop.test/go':()=>new Response('',{status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}}),
        'https://shop.test/hop':()=>new Response('',{status:301,headers:{location:'/a.png'}}),
        'https://shop.test/page':()=>new Response('<meta property="og:image" content="http://localhost/x.png">',{headers:{'content-type':'text/html'}}),
        'https://shop.test/big.png':()=>{pulled=0;return new Response(new ReadableStream({pull(c){pulled++;if(pulled>300)c.close();else c.enqueue(new Uint8Array(1e6))}}),{headers:{'content-type':'image/png'}})}};
      const bad=[];for(const u of ['http://127.0.0.1/a.png','http://localhost:8080/a.png','http://[::1]/a.png','http://2130706433/a.png','http://0x7f.1/a.png','http://10.0.0.5/a.png','http://printer.local/a.png','http://intranet/a.png','http://db.internal/a.png','http://router.lan/a.png'])bad.push(await f(u));
      ok(bad.every(s=>s===400)&&(await f('https://shop.test/a.png'))===200&&seen.length===1,`/fetch refuses IP addresses, localhost and internal names (${bad.join()}) and still fetches a public photo`);
      ok((await f('https://shop.test/go'))===400&&(await f('https://shop.test/page'))===422&&(await f('https://shop.test/hop'))===200,'a redirect or a share image that leads inside is refused; a redirect that stays outside is followed');
      ok((await f('https://shop.test/big.png'))===413&&pulled<40,`/fetch stops reading at its 15 MB cap (${pulled} MB read of 300)`);web={}}
    {const e2={...env,ALLOWED_ORIGIN:'https://one.test, https://two.test'},g=o=>call('GET','me',O,undefined,e2,o?{Origin:o}:{});
      const a=await g('https://two.test'),b=await g('https://one.test'),c=await g('https://evil.test'),e1={...env,ALLOWED_ORIGIN:'https://one.test'};
      ok(a.status===200&&a.headers.get('access-control-allow-origin')==='https://two.test'&&b.headers.get('access-control-allow-origin')==='https://one.test'&&a.headers.get('vary')==='Origin'&&c.status===403&&(await g('')).status===403,'ALLOWED_ORIGIN may list several origins: the one that asks is echoed, others are refused');
      ok((await call('GET','me',O,undefined,e1,{Origin:'https://one.test'})).headers.get('access-control-allow-origin')==='https://one.test'&&(await call('GET','me',O,undefined,e1,{Origin:'https://two.test'})).status===403,'a single origin works as before')}
    const toml=fs.readFileSync(path.join(ROOT,'wrangler.toml'),'utf8');
    ok(/new_sqlite_classes = \["RenderHub"\]/.test(toml)&&/name = "RENDER_HUB"\s+class_name = "RenderHub"/.test(toml),'wrangler.toml declares RenderHub with storage (the counts live there): no new migration is needed');

    // ---- the app
    store.clear();meta.clear();hubs.clear();sent=[];
    r=await J(await call('POST','invites',O,{name:'Tess',caps:{photo:1,item:0,tag:1,pattern:0}}));const T=r.code;{const k='invite:'+sha(T),rec=JSON.parse(store.get(k));rec.created-=8*86400000;store.set(k,JSON.stringify(rec))}   // past the first week
    const serve=async ctx=>ctx.route(HOST+'**',async route=>{const q=route.request();
      if(new URL(q.url()).pathname==='/sync')return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'{}'});   // no /sync: the start-up sync would merge away the items set in memory
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    for(const vp of [{width:390,height:844},{width:626,height:900}]){
      const ctx=await browser.newContext({viewport:vp,colorScheme:vp.width===390?'light':'dark'});await serve(ctx);
      const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
      // a link that the server refuses changes nothing
      await p.goto(url+'#invite='+'x'.repeat(32)+'&w='+encodeURIComponent(HOST));await p.waitForFunction(()=>window.appReady&&!location.hash);
      await p.waitForFunction(()=>/didn’t work/.test(document.querySelector('#toast').textContent));
      ok(await p.evaluate(()=>!localStorage.getItem('app_token')&&!localStorage.getItem('worker_url')),`a link the server doesn\'t accept connects nothing and says so (${vp.width}px)`);
      // the real one
      await p.goto(url+'#invite='+T+'&w='+encodeURIComponent(HOST));await p.reload();
      await p.waitForFunction(t=>localStorage.getItem('app_token')===t,T);await p.waitForFunction(()=>window.appReady&&/Connected as Tess/.test(document.querySelector('#toast').textContent));
      ok(await p.evaluate(h=>localStorage.getItem('worker_url')===h&&!location.hash&&document.querySelector('#toast').classList.contains('on'),HOST),`opening an invitation link connects the app: address and code stored, "Connected as Tess", the link gone from the address bar (${vp.width}px)`);
      ok(await p.evaluate(async t=>typeof connectFromLink==='function'&&(await connectFromLink('#invite='+t+'&w='+encodeURIComponent(localStorage.getItem('worker_url'))))===true&&(await connectFromLink('nonsense'))===false,T),'connectFromLink(text) answers true for a good link and false for anything else');
      await p.evaluate(()=>openSettings('connection'));await p.waitForFunction(()=>/Connected as Tess/.test(document.querySelector('#acct-box').textContent));
      let box=await p.evaluate(()=>({t:document.querySelector('#acct-box').innerText.replace(/\s+/g,' '),w:document.querySelector('#settings-modal').scrollWidth<=document.querySelector('#settings-modal').clientWidth,inv:!!document.querySelector('#acct-create')}));
      ok(/Outfit photos today: [01] of 1/.test(box.t)&&/Item pictures today: 0 of 0/.test(box.t)&&/Photo readings today: [01] of 1/.test(box.t)&&/Pattern readings today: 0 of 0/.test(box.t)&&box.w&&!box.inv&&!/worker|token|KV|endpoint/i.test(box.t),`Settings → Connection shows who is connected and today\'s use against each cap (${box.t})`);
      await p.evaluate(()=>closeSettings());
      if(vp.width===390){
        // a limit reaches the user: outfit photo, Add card, pattern reading, item picture
        await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
          items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
          settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
        await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering&&queuedKeys().length===1,null,{timeout:15000});
        await p.evaluate(()=>{stepDay(1)});await settle(p,300);
        await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering&&/limit/.test(document.querySelector('#render-msg').textContent),null,{timeout:15000});
        const msg=await p.evaluate(()=>document.querySelector('#render-msg').textContent);
        ok(msg==='Today’s limit of 1 outfit photos is used up. It starts again at midnight UTC.',`Generate photo over the cap shows the server\'s sentence, nothing else ("${msg}")`);
        const itemErr=await p.evaluate(()=>renderItemPic(items.find(i=>i.type==='shoes')).then(()=>'',e=>e.message));
        ok(/limit of 0 item pictures is used up/.test(itemErr),`an item picture over the cap fails with the sentence (${itemErr})`);
        await p.evaluate(()=>show('add'));
        const add=async()=>{await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=300;const x=c.getContext('2d');x.fillStyle='#234';x.fillRect(0,0,300,300);
          const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));await addFiles([new File([b],'s.jpg',{type:'image/jpeg'})])})};
        await add();await add();
        await p.waitForFunction(()=>/limit of 1 photo readings is used up/.test(document.querySelector('#note').textContent),null,{timeout:15000});
        ok(await p.evaluate(()=>document.querySelector('#note').textContent.includes('Today’s limit of 1 photo readings is used up. It starts again at midnight UTC.')&&/limit of 1 photo readings/.test(document.querySelector('#queue').textContent)),'the Add card says a reading limit in the server\'s words');
        await p.evaluate(u=>{document.querySelector('#toast').textContent='';claudePattern({image:u,type:'tie'})},PNG);
        await p.waitForFunction(()=>/limit of 0 pattern readings is used up/.test(document.querySelector('#toast').textContent)&&document.querySelector('#toast').classList.contains('on'));
        ok(true,'a pattern reading over the cap says so in a toast');
        await p.evaluate(()=>openSettings('connection'));await p.waitForFunction(()=>/Outfit photos today: 1 of 1/.test(document.querySelector('#acct-box').innerText.replace(/\s+/g,' ')));
        ok(true,'and Settings shows the day\'s use going up')}
      // the owner: invite, copy, revoke
      await p.evaluate(()=>{closeSettings();localStorage.setItem('app_token','owner-secret')});await p.evaluate(()=>openSettings('connection'));
      await p.waitForFunction(()=>document.querySelector('#acct-create')&&document.querySelector('#acct-list .acct-inv'));
      box=await p.evaluate(()=>document.querySelector('#acct-box').innerText.replace(/\s+/g,' '));
      ok(/Connected as the owner/.test(box)&&/Invite testers/.test(box)&&/Tess/.test(box)&&/Outfit photos today: \d of 1/.test(box),`the owner sees "Invite testers" and each tester\'s use today (${vp.width}px)`);
      await p.fill('#acct-name','Sam');await p.click('#acct-create');await p.waitForFunction(()=>document.querySelector('#acct-link-url'));
      const link=await p.evaluate(()=>({u:document.querySelector('#acct-link-url').value,n:document.querySelectorAll('#acct-list .acct-inv').length,
        h:[...document.querySelectorAll('#acct-box button,#acct-box input')].map(e=>Math.round(e.getBoundingClientRect().height)),w:document.querySelector('#settings-modal').scrollWidth<=document.querySelector('#settings-modal').clientWidth}));
      const lp=new URLSearchParams(link.u.split('#')[1]);
      ok(new URL(link.u).origin===new URL(url).origin&&/^[A-Za-z0-9_-]{24,}$/.test(lp.get('invite'))&&lp.get('w')===HOST&&link.n>=2,`Create shows the new link once: the app\'s address with #invite=<code>&w=<server> (${link.u.replace(/invite=[^&]+/,'invite=…')})`);
      ok(link.h.every(h=>h>=44)&&link.w,`its controls are 44px and nothing scrolls sideways (${link.h.join()})`);
      ok((await J(await call('GET','me',lp.get('invite')))).name==='Sam','the code in the link is the new tester\'s');
      await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});await p.click('#acct-copy');
      await p.waitForFunction(()=>/copied|copy it/i.test(document.querySelector('#toast').textContent));
      ok(true,'Copy copies it (or says to select it)');
      await p.click('#acct-list .acct-inv:last-child button.danger');await p.click('#ask-ok');await p.waitForFunction(()=>/Switched off/.test(document.querySelector('#acct-list .acct-inv:last-child').textContent));
      ok((await call('GET','me',lp.get('invite'))).status===403&&(await call('GET','me',T)).status===200,'Revoke switches that tester off, and only that one');
      await p.evaluate(()=>{closeSettings()});await p.evaluate(()=>openSettings('connection'));await p.waitForFunction(()=>document.querySelector('#acct-create'));
      ok(await p.evaluate(()=>!document.querySelector('#acct-link-url')),'the link is shown once: it is gone when Settings is opened again');
      ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
      // an older server (no /me): the box stays empty
      await p.evaluate(()=>{closeSettings();localStorage.setItem('worker_url','https://old.test/')});await ctx.route('https://old.test/**',r=>r.request().method()==='OPTIONS'?r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}}):r.fulfill({status:405,headers:{'access-control-allow-origin':'*'},body:'{"error":"method not allowed"}'}));
      await p.evaluate(()=>{acct.at=0;openSettings('connection')});await p.waitForFunction(()=>acct.state==='old');
      ok(await p.evaluate(()=>document.querySelector('#acct-box').hidden),'with an older server the Connection page shows nothing extra');
      await ctx.close()}
  }finally{globalThis.fetch=realFetch;Date.now=realNow;await browser.close()}
};
