// Records coming in (fix round 3, the audit's W2-13-02 = W2-12-01, W2-13-05/-06/-07, W2-12-06): a crafted Restore file, a sync from a
// server that holds crafted records, and records stored before the check never put markup into the page; the app's own records pass
// unchanged; the server refuses malformed records, pictures and photos with a plain message. Harmless markers only: a payload that
// reaches innerHTML unescaped inserts <i data-rx> or calls window.__rx(n), which only records n. Mocked KV and Claude; the real worker.js.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,getWithMetadata:async k=>({value:store.has(k)?store.get(k):null,metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  let claude=0,claudeAnswer=null;const realFetch=globalThis.fetch;
  globalThis.fetch=async(href,init)=>{if(String(href)==='https://api.anthropic.com/v1/messages'){claude++;return new Response(JSON.stringify({model:'claude-test',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(claudeAnswer)}]}),{status:200,headers:{'content-type':'application/json'}})}return new Response('',{status:404})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://records.test/';
  const call=(method,p,body,e=env)=>worker.fetch(new Request(HOST+p,{method,headers:{'x-app-token':'secret','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),e);
  const J=async r=>({s:r.status,...(await r.json().catch(()=>({})))});
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const B=n=>`" data-q="${n}"><i data-rx="${n}"></i><b x="`, S=n=>`');__rx(${n});('`;
  const T=Date.now()-864e5;
  const it=o=>({pattern:'solid',secondaryColor:null,tertiaryColor:null,added:T,updated:T,...o});
  const crafted=()=>[it({id:'id1'+B('id'),type:'suit',primaryColor:'navy'}),it({id:'s1'+S(1),type:'suit',primaryColor:'grey'}),
    it({id:'ph1',type:'shirt',primaryColor:'white',photo:PNG+B('photo')}),it({id:'ph2',type:'shirt',primaryColor:'lightblue',photoSm:'data:image/png;base64,AAAA" onerror="__rx(2)'}),
    it({id:'col1',type:'tie',primaryColor:'burgundy'+B('color'),name:'Odd tie'}),
    it({id:'set1',type:'shirt',primaryColor:'light blue',pattern:'stripe',sett:{v:2,a:90,bands:[['#ffffff'+B('sett'),1],['#0000ff',1]],cr:4,tr:20,src:'claude'}}),
    it({id:'nm1',type:'shoes',primaryColor:'black',leather:'calf',name:'‮epyt‬ '+B('name')}),
    it({id:'ok1',type:'pants',primaryColor:'charcoal'})];
  const browser=await chromium.launch();
  try{
    // ---- core.js: the app's own records come out equal; crafted ones lose what can't be shown
    const p=await browser.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const u=await p.evaluate(([c,PNG])=>{const own={id:crypto.randomUUID(),type:'suit',primaryColor:'navy',secondaryColor:'white',tertiaryColor:null,pattern:'pinstripe',photo:PNG,photoSm:PNG,swatch:PNG,swSrc:'tex',added:1,updated:2,vest:'no',
        name:'Men\'s "best" suit',notes:'Bought in Ra\'s al Khaimah <3',sett:{v:2,a:0,bands:[['#1b2a4a',.95],['#cccccc',.05]],cross:null,cr:3,tr:40,src:'claude+pixels'},tagAI:{col:'navy',conf:{type:'high',primaryColor:'medium',pattern:'low'},alt:null,altPat:null,seen:false},
        meas:{lab:[20,1,-10],ref:false,src:'closeup'},weave:{layout:'bands',description:"a 1/4 inch chalk stripe, it's soft"},shade:-2,arrives:'2026-12-01'};
      const x=cleanRecord(own),cs=cleanState({items:c,days:[{date:'2026-11-16',ids:{top:'s1\');x(\'',shirt:'ok1'},updated:1},{date:'<b>',updated:1}],tombstones:{ok1:5,'bad"id':5,ok2:'x'}});
      return {same:JSON.stringify(x)===JSON.stringify(own),again:JSON.stringify(cleanRecord(x))===JSON.stringify(x),ids:cs.items.map(i=>i.id),
        markup:cs.items.flatMap(i=>Object.entries(i).filter(([k,v])=>{if(['name','notes','brand','material','details'].includes(k))return false;let bad=false;JSON.stringify(v,(kk,x)=>{if(typeof x==='string'&&/[<>"`]/.test(x))bad=true;return x});return bad})).map(([k])=>k),
        lb:cs.items.find(i=>i.id==='set1').primaryColor,band:cs.items.find(i=>i.id==='set1').sett.bands[0][0],ph:'photo' in cs.items.find(i=>i.id==='ph1'),nm:cs.items.find(i=>i.id==='nm1').name,
        days:JSON.stringify(cs.days),tomb:JSON.stringify(cs.tombstones),
        own:(o=>o.primaryColor+','+o.secondaryColor+','+o.pattern)(cleanRecord({id:'o1',type:'tie',primaryColor:'ownrot1',secondaryColor:'ownbrun',pattern:'own-rot-2'}))}},[crafted(),PNG]);
    // per-field stamps (Fixer 4's field merge: item.fs, day.fs) come through unchanged
    const fs=await p.evaluate(()=>{const it={id:'f1',type:'suit',primaryColor:'navy',pattern:'solid',added:1,updated:9,fs:{primaryColor:5,pattern:7,name:9,sett:3}},d={date:'2026-11-16',updated:4,ids:{top:'f1'},fs:{top:4,shirt:2,occasion:3}};
      return {it:JSON.stringify(cleanRecord(it))===JSON.stringify(it),d:JSON.stringify(cleanDay(d))===JSON.stringify(d),bad:JSON.stringify(cleanRecord({...it,fs:{primaryColor:'5" x="'}}).fs)}});
    ok(fs.it&&fs.d&&fs.bad==='{"primaryColor":"5 x="}','per-field stamps (item.fs, day.fs) are kept as they are; a string in them loses its quotes ('+JSON.stringify(fs)+')');
    ok(u.own==='ownrot1,ownbrun,own-rot-2','own color and pattern keys with digits (and the older letters-only ones) are kept ('+u.own+')');
    ok(u.same&&u.again,'an item the app made comes through cleanRecord unchanged, and a cleaned record is unchanged by a second pass');
    ok(u.ids.join()==='ph1,ph2,col1,set1,nm1,ok1','items whose id isn\'t of the app\'s shape are left out ('+u.ids.join()+')');
    ok(!u.markup.length&&!u.ph&&u.band===null,'no field but the free text keeps markup: the photo, the color and the sett band are dropped ('+u.markup.join()+')');
    ok(u.lb==='lightblue','a color word that is a known color ("light blue") becomes its key');
    ok(!/[‪-‮]/.test(u.nm),'right-to-left override characters are taken out of names (W2-12-06)');
    ok(u.days==='[{"date":"2026-11-16","ids":{"shirt":"ok1"},"updated":1}]'&&u.tomb==='{"ok1":5}','days keep only item ids of the id shape and a date of the app\'s shape; tombstones only numbers ('+u.days+' '+u.tomb+')');

    // ---- Restore file with crafted records: nothing runs anywhere; the plain message says what was left out
    const file={app:'daily-wardrobe',version:1,items:crafted(),days:[],tombstones:{}};
    const r=await p.evaluate(async f=>{window.__rx=n=>(window.__rxs=window.__rxs||[]).push(n);
      await HOOK.restoreBackup(new File([JSON.stringify(f)],'b.json'));const msg=document.querySelector('#toast').textContent;
      closeSettings&&closeSettings();show('today');await new Promise(r=>setTimeout(r,300));show('wardrobe');await new Promise(r=>setTimeout(r,300));
      for(const i of items){openItem(i.id);await new Promise(r=>setTimeout(r,150));HOOK.closeItem()}
      const st=await tx('readonly',s=>s.getAll());
      return {msg,n:items.length,marks:document.querySelectorAll('[data-rx],[data-q]').length,hits:window.__rxs||[],stored:st.filter(i=>/[<>"']/.test(i.id)||/[<>"]/.test(String(i.photo||'')+String(i.photoSm||'')+String(i.primaryColor||''))).length}},file);
    ok(/Restored\. Your wardrobe now has 6 items\. 2 items in the file weren’t a Daily Wardrobe item and were left out\./.test(r.msg),'Restore file says how many items were left out ('+r.msg+')');
    ok(r.marks===0&&!r.hits.length&&r.stored===0,`a crafted backup file puts nothing into the page on Today, the Wardrobe or the item sheets, and nothing crafted is stored (marks ${r.marks}, calls ${r.hits.join()}, stored ${r.stored})`);

    // ---- the second lock: a crafted record that skipped the check (in memory) is still escaped at the sinks
    const s2=await p.evaluate(async([PNG,B,S])=>{window.__rxs=[];items=[{id:'z1'+S,type:'suit',primaryColor:'navy',pattern:'solid',added:1},{id:'z2',type:'shirt',primaryColor:'white',pattern:'solid',photo:PNG+B,photoSm:PNG+B,added:1}];cache={};
      show('wardrobe');await new Promise(r=>setTimeout(r,200));document.querySelector('#wardrobe .giopen').click();await new Promise(r=>setTimeout(r,300));
      const sheet=!!document.querySelector('#item-view.on, body.iv-on');HOOK.closeItem();openItem('z2');await new Promise(r=>setTimeout(r,200));HOOK.closeItem();
      return {marks:document.querySelectorAll('[data-rx]').length,hits:window.__rxs,sheet}},[PNG,B('sink'),S(7)]);
    ok(s2.marks===0&&!s2.hits.length&&s2.sheet,`ids in inline handlers and photo sources are escaped even for a record that skipped the check, and the item still opens (marks ${s2.marks}, calls ${s2.hits.join()}, opened ${s2.sheet})`);

    // ---- records stored before the check: cleaned once at start-up, in memory and in storage, with their stamps unchanged
    // (the step above put a crafted item straight into memory, skipping the check; the app's week lock can write its id into day records,
    // which the start-up check then rightly sets aside: found by looping this test on WebKit, 1 run in 24. Those days are cleared first,
    // so what follows sees only the records planted here; a real phone never holds an item that skipped the check)
    await p.evaluate(async()=>{items=[];cache={};await new Promise(r=>setTimeout(r,800));await txs('days','readwrite',s=>s.clear());dayRecs={}});
    await p.evaluate(async([PNG,B])=>{await putRaw({id:'old1',type:'shirt',primaryColor:'white',pattern:'solid',photo:PNG+B,added:1,updated:5});await putRaw({id:'old2'+B,type:'tie',primaryColor:'navy',pattern:'solid',added:1,updated:5});localStorage.removeItem('rec_clean')},[PNG,B('old')]);
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(500);
    await p.waitForTimeout(1500);
    const s3=await p.evaluate(async()=>{const st=await tx('readonly',s=>s.getAll()),o=st.find(i=>i.id==='old1'),k=await metaGet('rec_kept')||[];return {mem:items.some(i=>i.id==='old1'&&!i.photo),gone:!items.some(i=>/^old2/.test(i.id))&&!st.some(i=>/^old2/.test(i.id)),stored:!!o&&!o.photo&&o.updated===5,flag:localStorage.getItem('rec_clean'),
      kept:k.filter(x=>x.kind==='item').map(x=>String(x.rec.id).slice(0,4)+':'+x.dropped+':'+!!x.rec.photo).join(),days:k.filter(x=>x.kind!=='item').map(x=>{const c=cleanDay(x.rec);if(!c)return 'DROPPED '+JSON.stringify(x.rec).slice(0,400);
        return Object.keys({...x.rec,...c}).filter(f=>JSON.stringify(x.rec[f])!==JSON.stringify(c[f])||!(f in c)||!(f in x.rec)).map(f=>`${x.rec.date} ${f}: ${JSON.stringify(x.rec[f])} -> ${JSON.stringify(c[f])}`).join('; ')}),toast:document.querySelector('#toast').textContent}});
    if(s3.days.length)console.log('DAY SET ASIDE: '+s3.days.join(' | '));
    ok(!s3.days.length,'no day record the app wrote is set aside by the start-up check ('+s3.days.join(' | ')+')');
    ok(s3.mem&&s3.gone&&s3.stored&&s3.flag==='1','a record stored before the check is cleaned at the next start, in memory and in storage, stamp unchanged; one with a crafted id is taken out; once per phone ('+JSON.stringify(s3)+')');
    ok(s3.kept==='old1:false:true,old2:true:false'&&/1 item in this phone’s storage couldn’t be shown safely and was set aside\. Some details of 1 item .*Nothing was deleted: the originals are kept on this phone\./.test(s3.toast),'nothing is dropped silently: both originals are kept on the phone (meta rec_kept) and a plain message says so ('+s3.kept+' | '+s3.toast+')');
    await p.reload();await p.waitForFunction(()=>window.appReady);await p.waitForTimeout(1500);
    ok(await p.evaluate(()=>!/set aside/.test(document.querySelector('#toast').textContent)),'the message is said once, not at the next start');

    // ---- W2-13-05: the photo reader's confidence is shown only as high/medium/low
    const ct=await p.evaluate(()=>HOOK.confTxt({type:'high<img src=x onerror=__rx(5)>',primaryColor:'low',pattern:'medium'}));
    ok(ct==='Color: low confidence · Pattern: medium confidence'||(!/</.test(ct)&&/low confidence/.test(ct)),'confTxt shows only the words high, medium and low ('+ct+')');

    // ---- W2-12-06: a name typed with right-to-left overrides is saved without them
    const nm=await p.evaluate(async()=>{const i={id:'n1',type:'suit',primaryColor:'navy',pattern:'solid',added:1};items=[i];await setItemField('n1','name','‮epyt‬ blazer');return items[0].name});
    ok(nm==='epyt blazer','an item name is saved without bidi override characters ('+JSON.stringify(nm)+')');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await p.close();

    // ---- the server refuses malformed records (PUT and POST /sync), with a plain message, and counts nothing
    let x=await J(await call('PUT','sync',{baseRev:0,day:'2026-11-16',data:{items:[it({id:'a"b',type:'suit',primaryColor:'navy'})],days:[],tombstones:{},settings:null}}));
    ok(x.s===400&&x.error==='bad record'&&/The backup was not saved/.test(x.message)&&!store.has('wardrobe:v1'),'PUT /sync with a crafted item id is refused with a plain message, nothing stored ('+x.s+' '+x.message+')');
    x=await J(await call('PUT','sync',{baseRev:0,day:'2026-11-16',data:{items:[it({id:'p1',type:'shirt',primaryColor:'white',photo:PNG+'" onerror="x'})],days:[],tombstones:{},settings:null}}));
    ok(x.s===400&&x.what==='a photo','PUT /sync with a photo that isn\'t a picture is refused ('+x.s+' '+x.what+')');
    x=await J(await call('PUT','sync',{baseRev:0,day:'2026-11-16',data:{items:[it({id:'g1',type:'suit',primaryColor:'navy',photo:PNG,sett:{v:2,a:0,bands:[['#112233',1]],src:'claude+pixels'},name:'Men\'s "best"'})],days:[{date:'2026-11-16',ids:{top:'g1'},updated:T}],tombstones:{gone1:T},settings:null}}));
    ok(x.s===200&&x.rev===1,'PUT /sync with the app\'s own records is saved ('+x.s+')');
    x=await J(await call('POST','sync',{baseRev:1,day:'2026-11-16',delta:{items:[it({id:'c1',type:'tie',primaryColor:'navy'+B('c')})],days:[],tombstones:{}},photos:{}}));
    ok(x.s===400&&x.what==='a color','POST /sync with a crafted color key is refused ('+x.s+' '+x.what+')');
    x=await J(await call('POST','sync',{baseRev:1,day:'2026-11-16',delta:{items:[it({id:'c2',type:'tie',primaryColor:'navy',updated:Date.now()})],days:[{date:'2026-11-17',ids:{tie:'c2'},updated:Date.now()}],tombstones:{}},photos:{}}));
    ok(x.s===200&&x.rev===2,'POST /sync with the app\'s own records is saved ('+x.s+')');
    x=await J(await call('POST','sync',{baseRev:2,day:'2026-11-16',delta:{items:[it({id:'c3',type:'tie',primaryColor:'navy',updated:Date.now(),fs:{primaryColor:Date.now(),name:1}})],days:[{date:'2026-11-18',ids:{tie:'c3'},updated:Date.now(),fs:{tie:Date.now()}}],tombstones:{}},photos:{}}));
    ok(x.s===200&&x.rev===3,'POST /sync keeps records with per-field stamps (fs) ('+x.s+' '+(x.message||'')+')');

    // ---- a sync from a server that holds crafted records (stored by a worker before the check): the app cleans them, nothing runs, and the
    // next sync is the small one (no endless "ask for everything")
    const ctx=await browser.newContext();let gets=0;
    await ctx.route(HOST+'**',async route=>{const q=route.request(),uu=new URL(q.url());if(uu.pathname!=='/sync')return route.fulfill({status:404,body:'{}'});
      if(q.method()==='GET'&&/all|lite/.test(uu.search))gets++;
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    // plant crafted records straight into the stored backup (its index and data), as an older worker would have kept them
    const plant=s=>{const o=JSON.parse(s);const add=crafted().filter(i=>i.id!=='ok1');o.data.items.push(...add);
      if(o.revs&&o.revs.i)for(const i of add)o.revs.i[i.id]=o.rev;return JSON.stringify(o)};
    const planted=plant(store.get('wardrobe:v1'));store.set('wardrobe:v1',planted);
    const q=await ctx.newPage();const qerr=[];q.on('pageerror',e=>qerr.push(e.message));   // (WebKit's cut-off version check of sw.js is left out by tests/webkit.js)
    await q.goto(url);await q.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
    await q.addInitScript(()=>{window.__rx=n=>(window.__rxs=window.__rxs||[]).push(n)});
    await q.reload();await q.waitForFunction(()=>window.appReady);
    const sy=await q.evaluate(async()=>{const a=await syncNow();show('today');await new Promise(r=>setTimeout(r,300));show('wardrobe');await new Promise(r=>setTimeout(r,300));
      for(const i of items){openItem(i.id);await new Promise(r=>setTimeout(r,100));HOOK.closeItem()}
      return {a,ids:items.map(i=>i.id).sort().join(),marks:document.querySelectorAll('[data-rx],[data-q]').length,hits:window.__rxs||[],st:localStorage.getItem('sync_status')}});
    gets=0;const again=await q.evaluate(()=>syncNow());
    ok(sy.a===true&&sy.marks===0&&!sy.hits.length,`a sync that brings crafted records puts nothing into the page (ok ${sy.a}, marks ${sy.marks}, calls ${sy.hits.join()}, ${sy.st})`);
    ok(/c2/.test(sy.ids)&&/g1/.test(sy.ids)&&!/[<"']/.test(sy.ids),'the backup\'s good records arrive and no crafted id does ('+sy.ids+')');
    ok(again===true&&gets<=1,'the next sync is one small request, not a loop asking for the whole backup ('+gets+' GETs)');
    ok(qerr.length===0,'no page errors on the syncing phone ('+qerr.join('; ')+')');
    await ctx.close();

    // ---- W2-13-06: PUT /render keeps only a whole picture
    x=await J(await call('PUT','render',{key:'c0123456789abcdef',rec:{img:'data:image/png;base64,AAAA" onerror="alert(1)',t:1}}));
    ok(x.s===400&&!store.has('render:c0123456789abcdef'),'PUT /render with text after the base64 prefix is refused ('+x.s+')');
    // (2026-11-16) the owner's signatures up to 16000 characters: the masters' manifest lives in one and was cut off at 2000
    x=await J(await call('PUT','render',{key:'c0123456789abcdef',rec:{img:PNG,t:1,sig:'s'.repeat(20000)}}));
    ok(x.s===200&&JSON.parse(store.get('render:c0123456789abcdef')).sig.length===16000,'a picture is kept, with the owner\'s signature cut to a sane length (16000)');
    x=await J(await call('PUT','render',{key:'c0123456789abcdee',rec:{img:PNG,t:2,sig:'m'.repeat(9000)}}));
    ok(x.s===200&&JSON.parse(store.get('render:c0123456789abcdee')).sig.length===9000,'a 9000-character signature (a long manifest) is kept whole for the owner');

    // ---- W2-13-07: POST / takes only a whole picture, and spends nothing on anything else
    claude=0;claudeAnswer={type:'tie',primaryColor:'navy',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',metal:null,leather:null,dial:null,band:null,bezel:null,
      confidence:{type:'high<img src=x>',primaryColor:'medium',pattern:'low'},altColor:null,altPattern:null,newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,extra:'a"b<c>'};
    const e2={...env,ANTHROPIC_API_KEY:'k'};
    x=await J(await call('POST','',{image:'javascript:alert(1)'},e2));
    ok(x.s===400&&claude===0,'POST / with "javascript:alert(1)" as the photo is refused before any Claude call ('+x.s+', '+claude+' calls)');
    x=await J(await call('POST','',{image:'data:image/jpeg;base64,abc"def'},e2));
    ok(x.s===400&&claude===0,'POST / with a broken base64 photo is refused before any Claude call');
    // ---- W2-13-05: the answer's confidence is one of three words, and its text carries no markup
    x=await J(await call('POST','',{image:PNG},e2));
    ok(x.s===200&&claude===1&&x.confidence.type==='low'&&x.confidence.primaryColor==='medium'&&x.extra==='abc','the photo reader\'s confidence is high/medium/low only and other text loses < > " ('+JSON.stringify(x.confidence)+' '+x.extra+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
