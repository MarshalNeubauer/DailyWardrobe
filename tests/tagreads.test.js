// Readings of an Add card (code review 2026-11-16, fix round A; the server stubbed, nothing paid), done the way a person adds an item:
// the photo through "One item", the close-up through the card's own "Add close-up" button.
// - CR-2-03: while Claude reads the close-up the card has no Replace, Retake, Remove or Read button, Confirm stays off, and they come
//   back when it ends; two close-ups in a row are one reading: the earlier is called off, only the latest answer is used, and the
//   flag stays on until it lands (a second close-up paid twice and switched Confirm back on half way).
// - CR-2-04: tagging again fits Claude's colors to the card's own type (a burgundy blazer Claude called a suit came back brown).
// - CR-2-10: Skip calls off the reading in flight (it went on, paid).
// - CR-2-07: each reading keeps its own failure (ask's out), and tagging again says so in its own words.
// - CR-2-01: a camouflage answer from the real worker's /pattern is kept and drawn with Claude's blotch size (it was paid and dropped).
// - CR-2-09: the busy pill says what "Read color and texture" does. CR-2-12: the black-backdrop fix stays within the day's remakes.
const path=require('path'),{pathToFileURL}=require('url');
const TAG={secondaryColor:'none',tertiaryColor:'none',pattern:'solid',metal:null,leather:null,dial:null,band:null,bezel:null,trouserKind:null,shoeStyle:null,
  confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,model:'claude-stub'};
module.exports=async({ok,chromium,url,ROOT,settle})=>{
  // the real worker's /pattern answer for a camouflage (Claude stubbed in this process only)
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const camoAns={layout:'camouflage',across:null,along:null,motif:null,texture:null,camo:{colours:[{name:'khaki',hex:'#b8a47e',sharePct:45},{name:'sage',hex:'#7d8a68',sharePct:30},{name:'brown',hex:'#6b5444',sharePct:25}],blobsAcrossItem:14},
    stripeDirection:'vertical',repeatsInCloseup:3,repeatsAcrossItem:14,paneAspect:1,ignored:'folds',description:'MultiCam'};
  const real=globalThis.fetch;let camoBody;
  globalThis.fetch=async h=>String(h).startsWith('https://api.anthropic.com/')?new Response(JSON.stringify({model:'claude-stub',stop_reason:'end_turn',usage:{},content:[{type:'text',text:JSON.stringify(camoAns)}]}),{status:200}):new Response('',{status:404});
  try{const r=await worker.fetch(new Request('https://w.test/pattern',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:IMG,closeup:IMG,type:'pants'})}),{APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'});
    camoBody={status:r.status,body:await r.text()}}finally{globalThis.fetch=real}
  ok(camoBody.status===200&&/"camo":\{/.test(camoBody.body),'the worker answers a camouflage reading (200, camo only)');

  const S={tags:[],pats:0,sent:[]};   // S.tags: the next answers to POST / ({body, status, delay, fail})
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const H={'content-type':'application/json','access-control-allow-origin':'*'};
    await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
      try{
        if(q.method()==='POST'&&u.pathname==='/'){let b={};try{b=JSON.parse(q.postData()||'{}')}catch{}S.sent.push(b);const a=S.tags.shift()||{body:{...TAG,type:'suit',primaryColor:'navy'}};
          if(a.delay)await new Promise(z=>setTimeout(z,a.delay));if(a.fail)return await route.abort('failed');
          return await route.fulfill({status:a.status||200,headers:H,body:JSON.stringify(a.body)})}
        if(q.method()==='POST'&&u.pathname==='/pattern'){S.pats++;return await route.fulfill(S.camo?{status:camoBody.status,headers:H,body:camoBody.body}:{status:422,headers:H,body:'{"error":"no pattern"}'})}
        return await route.fulfill({status:503,headers:H,body:'{"error":"server"}'})}catch{}});   // (a request the app called off can't be answered)
    await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{CK_OPEN['*']=true;rememberRole({role:'owner'});window.__sig=[];const f=window.fetch;window.fetch=(u,o)=>{if(o&&o.signal)__sig.push({u:String(u),s:o.signal});return f(u,o)}});
    const F=await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
      const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
      const cv=(im,k)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)};
      return {photo:cv(pi,1),close:cv(ci,3),close2:cv(ci,2.5)}});
    const file=(name,u)=>({name,mimeType:'image/jpeg',buffer:Buffer.from(u.split(',')[1],'base64')});
    const card=()=>p.evaluate(()=>{const q=queue[0],el=document.querySelector('#queue .card'),t=el?el.textContent:'',b=document.querySelector('#qconf-0');
      return q?{reading:!!(q.refining||q.patternReading),replace:/Replace close-up/.test(t),retake:/Retake close-up/.test(t),remove:!!document.querySelector('#queue .ckrm'),read:!!document.querySelector('#queue .ckread'),
        wait:/You can replace the close-up once Claude has read it/.test(t),confirmOff:b?b.disabled||b.getAttribute('aria-disabled')==='true':'none',c:q.primaryColor,type:q.type,offer:q.refineType||null,note:q.refineNote||'',p:q.pattern,sett:q.sett||null}:null});
    const addPhoto=async(answer)=>{S.tags.push({body:answer});await p.evaluate(()=>{queue.length=0;openAdd()});await settle(p,300);
      await (await p.$('#add-one input[type=file]')).setInputFiles(file('item.jpg',F.photo));
      await p.waitForFunction(()=>queue[0]&&!queue[0].busy&&document.querySelector('#queue .card'));await settle(p,300)};
    const addCloseup=async(name,u)=>{await (await p.$('#queue label.ckadd input[type=file], #queue label input.vfile[data-act-change="cardCuFile"]')).setInputFiles(file(name,u))};
    const ended=()=>p.waitForFunction(()=>queue[0]&&!queue[0].refining&&!queue[0].patternReading,null,{timeout:20000});

    // ---- CR-2-03 / CR-2-04: a blazer; its close-up read again, Claude calling it a suit in burgundy
    await addPhoto({...TAG,type:'blazer',primaryColor:'burgundy'});
    S.tags.push({body:{...TAG,type:'suit',primaryColor:'burgundy'},delay:1500});S.sent=[];
    await addCloseup('close.jpg',F.close);await p.waitForFunction(()=>queue[0]&&queue[0].refining);await settle(p,200);
    let c=await card();
    ok(c.reading&&!c.replace&&!c.retake&&!c.remove&&!c.read&&c.wait&&c.confirmOff===true,`while Claude reads the close-up: no Replace, Retake, Remove or Read, a line saying why, Confirm off (${JSON.stringify(c)})`);
    await ended();await settle(p,300);c=await card();
    ok(!c.reading&&c.replace&&c.read&&!c.wait&&c.confirmOff===false,`when it ends they are back and Confirm is on (${JSON.stringify(c)})`);
    ok(c.c==='burgundy'&&c.type==='blazer'&&c.offer==='suit',`Claude's colors are fitted to the card's type: a blazer Claude called a suit stays burgundy, the suit only offered (${c.c}, ${c.type}, offer ${c.offer})`);
    ok(S.sent.length===1&&!!S.sent[0].closeup,'one paid reading for the close-up, with it attached');

    // ---- CR-2-03: two close-ups in a row (another way in than the hidden button) are one reading
    await p.evaluate(()=>{queue[0].edited={}});
    S.tags.push({body:{...TAG,type:'blazer',primaryColor:'navy'},delay:700},{body:{...TAG,type:'blazer',primaryColor:'wine'},delay:1800});S.sent=[];
    const states=p.evaluate(async c2=>{const st=[],toFile=async(u,n)=>new File([await (await fetch(u)).blob()],n,{type:'image/jpeg'});
      await addTexture(0,await toFile(c2,'a.jpg'));await new Promise(r=>setTimeout(r,150));await addTexture(0,await toFile(c2,'b.jpg'));
      for(let k=0;k<60;k++){await new Promise(r=>setTimeout(r,100));const q=queue[0];st.push({r:q.refining?1:0,c:q.primaryColor});if(!q.refining&&k>25)break}return st},F.close2);
    const seen=await states;await ended();
    const firstSig=await p.evaluate(()=>{const l=__sig.filter(x=>/w\.test\/$/.test(x.u));return l.length>=2?l[l.length-2].s.aborted:null});
    ok(seen.every(x=>x.r===1||x.c==='wine')&&!seen.some(x=>x.c==='navy'),`the earlier answer is not used and the reading shows until the latest lands (${JSON.stringify(seen.filter((x,i,a)=>!i||JSON.stringify(x)!==JSON.stringify(a[i-1])))})`);
    ok(firstSig===true&&(await card()).c==='wine','the earlier request was called off; the latest close-up\'s answer is the one kept');

    // ---- CR-2-10: Skip during tagging again calls the request off
    S.tags.push({body:{...TAG,type:'blazer',primaryColor:'navy'},delay:2500});
    await addCloseup('again.jpg',F.close);await p.waitForFunction(()=>queue[0]&&queue[0].refining);
    await p.evaluate(()=>{const q=queue[0];skipCard(q.id)});
    const sk=await p.evaluate(()=>{const l=__sig.filter(x=>/w\.test\/$/.test(x.u));return {aborted:l[l.length-1].s.aborted,cards:queue.length}});
    ok(sk.aborted&&sk.cards===0,`Skip during tagging again calls off the paid request (${JSON.stringify(sk)})`);

    // ---- CR-2-07: tagging again that fails says so in its own words, with this reading's reason
    await addPhoto({...TAG,type:'blazer',primaryColor:'navy'});
    S.tags.push({status:503,body:{error:'mock',message:'The server had a problem just now.'}});
    await addCloseup('fail.jpg',F.close);await ended();await settle(p,200);c=await card();
    ok(/^Tagging again from the close-up didn’t work: The server had a problem just now\. The first tags stay\.$/.test(c.note)&&!/Fill in the details/.test(c.note),`a failed tagging again keeps the tags and says why in its own words (${c.note})`);
    S.tags.push({status:503,body:{error:'mock',message:'The server had a problem just now.'},delay:500},{fail:true});
    const both=await p.evaluate(async img=>{const a={},b={};await Promise.all([ask(img,{out:a}),ask(img,{out:b})]);
      tagWhy='someone else’s reason';tagNetLast=false;const qa={id:'a'},qb={id:'b'};tagFailed(qa,a.err);tagFailed(qb,b.err);return {a:qa.tagErr,an:!!qa.tagNet,b:qb.tagErr,bn:!!qb.tagNet}},F.photo);
    ok(/server had a problem/.test(both.a)&&!both.an&&/couldn’t be reached|offline/.test(both.b)&&both.bn,`two readings failing at once each keep their own reason, whatever the last one was (${JSON.stringify(both)})`);

    // ---- CR-2-01: camouflage pants, the pattern read by the worker: Claude's reading is kept and gives the blotch size
    S.camo=true;S.pats=0;
    await addPhoto({...TAG,type:'pants',primaryColor:'khaki',pattern:'camouflage',trouserKind:'cargo'});
    S.tags.push({body:{...TAG,type:'pants',primaryColor:'khaki',pattern:'camouflage'}});
    await addCloseup('camo.jpg',F.close);await p.waitForFunction(()=>queue[0]&&queue[0].spec,null,{timeout:20000}).catch(()=>{});await ended();await settle(p,200);
    const cm=await p.evaluate(()=>{const q=queue[0];return {spec:!!(q.spec&&q.spec.camo),src:q.sett&&q.sett.src,tr:q.sett&&q.sett.tr,camo:!!(q.sett&&q.sett.camo)}});
    ok(S.pats===1&&cm.spec&&cm.camo&&/^claude/.test(cm.src)&&cm.tr===3.5,`a camouflage reading from the worker is kept: drawn from Claude's reading, 14 blotches across → ${cm.tr} tiles (${JSON.stringify(cm)})`);
    S.camo=false;

    // ---- CR-2-09: the busy pill during "Read color and texture"
    const lab=await p.evaluate(()=>[busyLabelFor('https://w.test/describe',{method:'POST',body:JSON.stringify({what:'both',type:'suit'})}),busyLabelFor('https://w.test/describe',{method:'POST',body:JSON.stringify({what:'pattern'})})]);
    ok(lab[0]==='Claude is reading the color and texture…'&&lab[1]==='Claude is working out the weave…',`the busy pill names the reading (${lab.join(' / ')})`);

    // ---- CR-2-12: the black-backdrop fix within the day's remakes, done once nothing is left
    const bb=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=120;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,120,120);x.fillStyle='#e8e4dc';x.fillRect(30,30,60,60);
      const ph=c.toDataURL('image/png');localStorage.removeItem('black_bd');items=[{id:'s1',type:'socks',primaryColor:'cream',pattern:'solid',photo:ph,added:1}];
      localStorage.setItem('remake_day',JSON.stringify({d:isoKey(new Date()),n:REMAKE_DAY}));
      const n0=await fixBlackBackdrops(),f0=localStorage.getItem('black_bd'),same=items[0].photo===ph;
      localStorage.removeItem('remake_day');const n1=await fixBlackBackdrops(),f1=localStorage.getItem('black_bd'),spent=JSON.parse(localStorage.getItem('remake_day')||'{}').n;
      return {n0,f0,same,n1,f1,spent,changed:items[0].photo!==ph}});
    ok(bb.n0===0&&bb.same&&!bb.f0,`with the day's remakes used up nothing is written and it waits for another day (${JSON.stringify(bb)})`);
    ok(bb.n1===1&&bb.changed&&bb.f1==='1'&&bb.spent===2,'the next day it is fixed, counted (photo and small copy) and marked done');
    ok(!errs.length,'no uncaught errors ('+errs.join('; ')+')');
  }finally{await browser.close()}};
