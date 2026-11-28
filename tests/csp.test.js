// index.html's security policy (the owner's decision of 2026-11-28: "Do the security policy"). GitHub Pages sets no headers, so the
// policy is a <meta http-equiv="Content-Security-Policy"> right after the charset, before any script. Two parts:
// 1. The file: the policy is there and first; script-src is 'self' and one sha256 per inline script, each matching that script's text
//    as it is now (an inline script changed without its hash fails here, and the message gives the new hash), with nothing loose
//    ('unsafe-inline', 'unsafe-eval', a scheme, *); object-src 'none', base-uri 'self'; connect-src and img-src as documented below;
//    no app file needs eval. The check is shown to catch a changed, an added and a removed inline script.
// 2. The app under the policy, on Chromium and WebKit: every `securitypolicyviolation` the page fires is recorded (an init script's
//    listener, there before the page's first script) while the app is used: Today with the painter on the graphics chip, on the
//    processor in its worker and on the page; the tabs, the month and the score card; every Settings category and Advanced fold, a city
//    searched and picked (the forecast and the climate), a holiday country, a calendar link, the morning reminder, Sync now, Check for
//    updates and feedback; the item sheet, the color sheet, the piece picker, What to buy, the Packing list; Add with a photo read by
//    the server; the setup, the tour and the import; the start-up card; the service worker's registration. It must see none.
//    A planted inline script (added to the page, and served in index.html) and a changed head script must each be refused and seen.
// The server is the repo's own worker.js in Node (KV in memory, Claude mocked) at https://w.test/, the masters are the 512 test masters
// (tests/fixtures/cm), and the weather and holiday services are answered here: nothing leaves the machine.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
const sha=t=>`'sha256-${crypto.createHash('sha256').update(t,'utf8').digest('base64')}'`;
/* the policy as written: {raw, at (its offset), dirs: {directive: [sources]}} or null */
function policyOf(html){const m=/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/i.exec(html);if(!m)return null;
  const dirs={};for(const part of m[1].split(';')){const w=part.trim().split(/\s+/).filter(Boolean);if(w.length)dirs[w[0].toLowerCase()]=w.slice(1)}
  return {raw:m[1],at:m.index,dirs}}
/* the inline scripts of a page (comments left out): [{attrs, text, hash}] */
const inlineScripts=html=>[...html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1])).map(m=>({attrs:m[1].trim(),text:m[2],hash:sha(m[2])}));
/* what is wrong with the hashes: an inline script whose hash isn't listed (the hash it needs), a listed hash no script has */
function hashProblems(html){const P=policyOf(html);if(!P)return ['no policy'];const listed=(P.dirs['script-src']||[]).filter(s=>/^'sha256-/.test(s)),S=inlineScripts(html),out=[];
  for(const s of S)if(!listed.includes(s.hash))out.push(`the inline script "${s.text.trim().slice(0,40)}…" needs ${s.hash} in script-src`);
  for(const h of listed)if(!S.some(s=>s.hash===h))out.push(`${h} is listed but no inline script has it`);
  return out}
module.exports=async({ok,engines,url,settle,ROOT})=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),P=policyOf(html),D=(P&&P.dirs)||{};
  /* ---- 1. the file ---- */
  ok(!!P&&P.at<html.search(/<script\b/i)&&P.at<html.search(/<link\b/i)&&html.indexOf('<meta charset="utf-8">')<P.at,'index.html has its security policy as a meta tag after the charset, before any script or stylesheet');
  ok(!/frame-ancestors|report-uri|report-to|sandbox/.test(P?P.raw:''),'the policy has no directive a meta tag ignores (frame-ancestors, reports, sandbox)');
  const S=inlineScripts(html),bad=hashProblems(html);
  ok(S.length===4&&!bad.length,`each of the ${S.length} inline scripts (the theme, the text size, the start-up catcher, startUp()) has its sha256 in script-src and no other hash is listed`+(bad.length?': '+bad.join('; '):''));
  const ss=D['script-src']||[];
  ok(ss[0]==="'self'"&&ss.slice(1).every(s=>/^'sha256-[A-Za-z0-9+/]+=*'$/.test(s)),`script-src is 'self' and the hashes, nothing else (${ss.filter(s=>!/^'sha256-/.test(s)).join(' ')})`);
  ok((D['default-src']||[]).join(' ')==="'self'"&&(D['object-src']||[]).join(' ')==="'none'"&&(D['base-uri']||[]).join(' ')==="'self'"&&(D['worker-src']||[]).join(' ')==="'self'",
    "default-src 'self', object-src 'none', base-uri 'self', worker-src 'self' (the module workers and sw.js are the app's own files)");
  // connect-src: the server's address is typed in Settings > Connection > Advanced (any https address; a server run on this computer
  // on loopback http), and a photo link may be on any site, so any https address; the rest is the app's own data: and blob: pictures
  ok((D['connect-src']||[]).join(' ')==="'self' https: data: blob: http://localhost:* http://127.0.0.1:*",`connect-src is the app, any https address, data:, blob: and loopback http (${(D['connect-src']||[]).join(' ')})`);
  ok((D['img-src']||[]).join(' ')==="'self' data: blob:",`img-src is the app's files and its data: and blob: pictures, no other site (${(D['img-src']||[]).join(' ')})`);
  ok((D['style-src']||[]).join(' ')==="'self' 'unsafe-inline'",`style-src is the stylesheet and the style attributes the code writes (${(D['style-src']||[]).join(' ')})`);
  // the check catches a head script changed, added or removed without its hash following
  const theme=S[0].text,changed=html.replace(theme,theme.replace('localStorage','window.localStorage')),added=html.replace('<title>','<script>window.x=1</script><title>'),gone=html.replace('<script>'+theme+'</script>','');
  const c1=hashProblems(changed),c2=hashProblems(added),c3=hashProblems(gone);
  ok(c1.length===2&&/needs 'sha256-/.test(c1[0])&&/listed but no inline script/.test(c1[1])&&c2.length===1&&/window\.x=1/.test(c2[0])&&c3.length===1&&/listed but/.test(c3[0]),
    `the hash check names a changed (${c1.length}), an added (${c2.length}) and a removed (${c3.length}) inline script`);
  const app=fs.readdirSync(ROOT).filter(f=>f.endsWith('.js')&&!/^(worker|eslint)/.test(f)).concat(fs.readdirSync(path.join(ROOT,'mq')).map(f=>'mq/'+f));
  const evals=app.filter(f=>/\beval\(|new Function\(|setTimeout\(\s*['"`]|setInterval\(\s*['"`]|javascript:/.test(fs.readFileSync(path.join(ROOT,f),'utf8')));
  ok(app.length>60&&!evals.length,`no app file compiles code from text (eval, new Function, a string timer, javascript:), which script-src refuses (${evals.join(', ')||app.length+' files'})`);
  /* ---- 2. the app under the policy ---- */
  const worker=await server(ROOT);
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle,ROOT,worker})}finally{await browser.close()}}
};
module.exports.realPlanner=true;
module.exports.assembled=true;

/* the repo's worker.js in Node, as tests/accounts.test.js runs it: KV, queue and Durable Objects in memory, Claude and OpenAI mocked, a
   calendar at https://cal.test/ */
async function server(ROOT){const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const TAG={type:'tie',primaryColor:'navy',secondaryColor:'none',thirdColor:'none',pattern:'solid',material:'silk',texture:'smooth',formality:'business',season:'all'};
  const ICS='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a@test\r\nDTSTART;VALUE=DATE:20261118\r\nSUMMARY:Wedding\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  const realFetch=globalThis.fetch;
  const outside=async(href,init)=>{href=String(href&&href.url||href);
    if(href.startsWith('https://api.openai.com/'))return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}});
    if(href.startsWith('https://api.anthropic.com/')){let props={};try{props=JSON.parse(init.body).output_config.format.schema.properties||{}}catch(e){}
      return new Response(JSON.stringify({model:'mock',stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify(props.items?{items:[TAG]}:props.layout?{layout:'none'}:TAG)}]}),{status:200,headers:{'content-type':'application/json'}})}
    if(href.startsWith('https://cal.test/'))return new Response(ICS,{status:200,headers:{'content-type':'text/calendar'}});
    return new Response('refused',{status:503})};
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>{if(!store.has(k))return null;const v=store.get(k);return t==='json'?JSON.parse(v):t==='arrayBuffer'?new TextEncoder().encode(v).buffer:v},
    getWithMetadata:async(k,t)=>({value:await KV.get(k,t),metadata:meta.get(k)||null}),
    put:async(k,v,o)=>{if(v instanceof ArrayBuffer||ArrayBuffer.isView(v))v=Buffer.from(v).toString('latin1');store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k);meta.delete(k)},
    list:async({prefix=''}={})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const hubs=new Map(),hubOf=name=>{if(!hubs.has(name)){const st=new Map();hubs.set(name,new mod.RenderHub({storage:{get:async k=>st.get(k),put:async(k,v)=>{st.set(k,v)},delete:async k=>{st.delete(k)},deleteAll:async()=>{st.clear()}}},{}))}return hubs.get(name)};
  const env={APP_TOKEN:'owner-secret',OPENAI_API_KEY:'k',ANTHROPIC_API_KEY:'a',WARDROBE:KV,RENDER_QUEUE:{send:async()=>{}},RENDER_HUB:{idFromName:x=>x,get:name=>({fetch:(u,init)=>hubOf(name).fetch(new Request(u,init))})}};
  const ctxObj={waitUntil(p){Promise.resolve(p).catch(()=>{})},passThroughOnException(){}};
  return {call:async(method,href,headers,body)=>{globalThis.fetch=outside;
    try{return await worker.fetch(new Request(href,{method,headers,body:['GET','HEAD'].includes(method)?undefined:body}),env,ctxObj)}finally{globalThis.fetch=realFetch}}}}

const HOST='https://w.test/',DAY=new Date(2026,10,16,12);   // a Monday, a workday (the day's pose is the seeded outfit's)
async function run(eng,browser,{ok,url,settle,ROOT,worker}){
  const T=eng+': ',origin=new URL(url).origin,wait=ms=>new Promise(r=>setTimeout(r,ms));
  const FIX=path.join(ROOT,'tests','fixtures','cm'),data=f=>`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(f).toString('base64');
  const recs={};for(const kind of ['suit','vest','suit-open','shirt-tie','shirt-open']){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');recs[kind+'|'+n]=data(path.join(d,f))}}
  const masters={},away=[];
  /* every request off the test server: the server (its masters from here, the rest the worker), the two data services, nothing else */
  const days=[...Array(16)].map((_,i)=>{const d=new Date(DAY);d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)});
  const answer=async route=>{const q=route.request(),u=new URL(q.url()),j=(x,st=200)=>route.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
    if(u.href.startsWith(HOST)){const k=u.searchParams.get('key');
      if(q.method()==='GET'&&u.pathname==='/render'&&k&&masters[k])return j(masters[k]);
      const res=await worker.call(q.method(),u.href,q.headers(),q.postDataBuffer()||undefined),h={};res.headers.forEach((v,k)=>{h[k]=v});h['access-control-allow-origin']='*';
      return route.fulfill({status:res.status,headers:h,body:Buffer.from(await res.arrayBuffer())})}
    if(u.hostname==='geocoding-api.open-meteo.com')return j({results:[{id:285787,name:'Kuwait City',latitude:29.37,longitude:47.98,country_code:'KW',country:'Kuwait',admin1:'Al Asimah',timezone:'Asia/Kuwait'}]});
    if(u.hostname==='api.open-meteo.com')return j({daily:{time:days,temperature_2m_max:days.map(()=>24),temperature_2m_min:days.map(()=>14),precipitation_probability_max:days.map(()=>0),precipitation_sum:days.map(()=>0),weather_code:days.map(()=>1)}});
    if(u.hostname==='archive-api.open-meteo.com'){const t=[];for(let m=1;m<=12;m++)for(let d=1;d<=28;d++)t.push(`2025-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);return j({daily:{time:t,temperature_2m_max:t.map(()=>25),temperature_2m_min:t.map(()=>15),precipitation_sum:t.map(()=>0)}})}
    if(u.hostname==='date.nager.at')return j([{date:'2026-12-25',localName:'Christmas Day',name:'Christmas Day',countryCode:'US'}]);
    away.push(u.href.slice(0,80));return route.abort()};
  const NOTES=()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push([e.effectiveDirective||e.violatedDirective,String(e.blockedURI).slice(0,60),(e.sourceFile||'').split('/').pop()+':'+e.lineNumber,(e.sample||'').slice(0,40)].join(' ')))};
  const ctxOf=async(opt={},init)=>{const ctx=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:eng==='Chromium',locale:'en-US',timezoneId:'Asia/Kuwait',serviceWorkers:'block',...opt});
    await ctx.route(u=>/^https?:/.test(u.href)&&!u.href.startsWith(origin),answer);await ctx.addInitScript(NOTES);
    await ctx.addInitScript(()=>{self.ASM_CM_SIZE=512;
      // the morning reminder: the phone's push service stood in for (as tests/restacts.test.js does); nothing is sent anywhere
      for(const n of ['PushManager','Notification'])if(!(n in window))window[n]=function(){};
      try{window.Notification.requestPermission=async()=>'granted';Object.defineProperty(window.Notification,'permission',{configurable:true,get:()=>'granted'})}catch(e){}
      const sub={endpoint:'https://push.test/me',toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'x',auth:'y'}}},unsubscribe:async()=>true};let have=null;
      const reg={addEventListener(){},removeEventListener(){},update:async()=>{},installing:null,waiting:null,active:null,pushManager:{getSubscription:async()=>have,subscribe:async()=>{have=sub;return sub}}};
      if(!self.__swReal)try{Object.defineProperty(Navigator.prototype,'serviceWorker',{configurable:true,get(){return {getRegistration:async()=>reg,register:async()=>reg,addEventListener(){},ready:Promise.resolve(reg),controller:null}}})}catch(e){}});
    if(init)await ctx.addInitScript(init);await ctx.clock.setFixedTime(DAY);return ctx};
  const seen=async p=>p.evaluate(()=>window.__csp.splice(0)).catch(()=>['(page gone)']);
  const all={};const step=async(p,label,fn)=>{try{await fn()}catch(e){all[label+' (did not finish: '+e.message.split('\n')[0].slice(0,60)+')']=[]}await wait(150);const v=await seen(p);if(v.length)all[label]=v};
  const clk=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)throw new Error('no '+s);e.click()},sel);
  const tap=async(p,sel)=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded({timeout:3000});await l.tap({timeout:3000})};

  /* the seeded wardrobe, connected to the server, with a place for the weather; nothing painted yet (ASM_TEST_OFF while seeding) */
  const s=await ctxOf({},()=>{self.ASM_TEST_OFF=true}),sp=await s.newPage();await sp.goto(url);await sp.waitForFunction(()=>window.appReady,null,{timeout:90000});
  await sp.evaluate(async h=>{const I=[];let k=0;const add=(type,cols,x={})=>{for(const c of cols)I.push({id:'lab-'+type+'-'+(k++),type,primaryColor:c,pattern:'solid',added:1700000000000+k,...x})};
    add('suit',['navy','charcoal','grey','brown','black']);add('blazer',['navy','tan','grey']);add('pants',['grey','charcoal','navy','tan','brown']);
    add('shirt',['white','lightblue','pink','white','lightblue','white','blue','lavender','cream','white','lightblue','pink']);
    add('tie',['navy','burgundy','green','brown','grey','red','purple','black','blue','gold','navy','burgundy']);
    add('shoes',['black','brown','oxblood'],{leather:'calf'});add('belt',['black','brown','oxblood'],{leather:'calf',metal:'silver'});
    add('socks',['navy','charcoal','black','brown']);add('watch',['silver'],{metal:'silver',band:'metal bracelet'});add('tieclip',['silver'],{metal:'silver'});add('pocketsquare',['white']);
    for(const i of I)await HOOK.put(i);
    HOOK.settings.setupDone=1;HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.location={name:'Kuwait City, KW',lat:29.37,lon:47.98};await HOOK.saveUserSettings();
    localStorage.setItem('tour_seen','1');localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner-secret')},HOST);
  const kmap=await sp.evaluate(ks=>{const o={};for(const k of ks){const [kind,n]=k.split('|');o[k]=HOOK.asmCmKey(kind,n)}return o},Object.keys(recs));
  const bg=await sp.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#e6e2dc';x.fillRect(0,0,512,512);return {k:HOOK.asmCmBgKey(),img:c.toDataURL('image/png')}});
  for(const [k,img] of Object.entries(recs))masters[kmap[k]]={sig:'asm/cm test',img,model:'colormaster',t:1000};masters[bg.k]={sig:'asm/cm bg',img:bg.img,model:'colormaster',t:1000};
  const seedSeen=await seen(sp);const state=await s.storageState({indexedDB:true});await s.close();
  if(seedSeen.length)all['the first start and seeding']=seedSeen;

  /* ---- the painter: on the graphics chip (where there is one), on the processor in its worker, on the page ---- */
  const painted={};
  for(const [how,opt] of [['default',null],['processor',()=>{localStorage.setItem('asm_gl','0')}],['page',()=>{self.ASM_NO_WORKER=true}]]){
    const ctx=await ctxOf({storageState:state},opt),p=await ctx.newPage();
    await step(p,'Today painted ('+how+')',async()=>{await p.goto(url);await p.waitForFunction(()=>window.appReady,null,{timeout:90000});
      await p.waitForFunction(()=>!!document.querySelector('#today .fig img'),null,{timeout:60000}).catch(()=>{});
      painted[how]=await p.evaluate(()=>{const st=HOOK.asmWorker&&HOOK.asmWorker();return (document.querySelector('#today .fig img')?'painted':'not painted')+(st?' worker:'+st.ok+' gl:'+st.gl:' page')})});
    if(how==='default'){
      /* ---- everything a person uses, on this page ---- */
      await step(p,'the tabs, the month and the score card',async()=>{for(const t of ['#n-wardrobe','#n-stats','#n-today']){await tap(p,t);await settle(p,500)}
        for(const sel of ['#today .month-link','#sbox .month-link']){const n=await p.locator(sel).count();if(n){await tap(p,sel);await settle(p,700)}}});
      await step(p,'Settings: every category and Advanced fold',async()=>{await tap(p,'header .hbtns button[data-act="setOpenTap"]');await settle(p,500);
        await p.evaluate(()=>document.body.classList.add('owner'));
        for(const k of ['laundry','schedule','daysoff','calendar','weather','care','photos','tagging','backup','connection','about']){await tap(p,`#sc-${k} .scat-head`);await settle(p,550);
          for(const a of await p.locator(`#sc-${k} .adv-head`).all()){await a.scrollIntoViewIfNeeded();await a.tap();await settle(p,300)}}});
      await step(p,'Settings: a city searched and picked (the forecast, the climate)',async()=>{await p.fill('#cfg-city','Kuwait');await p.press('#cfg-city','Enter');
        await p.waitForSelector('#city-results button',{timeout:8000});await tap(p,'#city-results button');await wait(1500)});
      await step(p,'Settings: a country for public holidays',async()=>{await p.selectOption('#cfg-country','US');await wait(1500)});
      await step(p,'Settings: a calendar link',async()=>{await p.fill('#cal-link','https://cal.test/a.ics');await tap(p,'#cal-connect');await wait(2500)});
      await step(p,'Settings: the morning reminder',async()=>{await tap(p,'#remind-sw');await wait(1500)});
      await step(p,'Settings: Sync now, Check for updates, feedback',async()=>{await tap(p,'#sp-backup button[data-act="syncNowTap"]');await wait(1500);
        await tap(p,'#about-check');await wait(1000);await p.fill('#fb-text','A note');await tap(p,'#fb-send');await wait(1000)});
      await step(p,'Settings closed',async()=>{await clk(p,'#settings-modal .sdone');await settle(p,500);await p.evaluate(()=>{if(HOOK.settingsOpen())HOOK.closeSettings();document.querySelectorAll('#ask-sheet.on #ask-cancel').forEach(b=>b.click())});await settle(p,400)});
      await step(p,'the item sheet and the color sheet',async()=>{await clk(p,'#n-wardrobe');await settle(p,400);await p.evaluate(()=>HOOK.openItem('lab-suit-0'));await p.waitForFunction(()=>document.body.classList.contains('iv-on'));await settle(p,700);
        const c=await p.locator('#item-view .colbtn[data-k="primaryColor"]').count();if(c){await clk(p,'#item-view .colbtn[data-k="primaryColor"]');await settle(p,600);await clk(p,'#col-backdrop').catch(()=>{});await settle(p,500)}
        await clk(p,'#item-view .ivdone');await settle(p,500)});
      await step(p,'the piece picker, What to buy, the Packing list',async()=>{await clk(p,'#n-today');await settle(p,400);await p.evaluate(()=>HOOK.openPicker('tie'));await settle(p,600);await p.evaluate(()=>HOOK.closePicker());await settle(p,400);
        await p.evaluate(()=>HOOK.openShop());await wait(2500);await p.evaluate(()=>HOOK.closeShop());await settle(p,400);await p.evaluate(()=>HOOK.openPack());await settle(p,600);await p.evaluate(()=>HOOK.show('today'));await settle(p,400)});
      await step(p,'Add with a photo read by the server',async()=>{await clk(p,'#n-wardrobe');await settle(p,400);await clk(p,'#ward-add');await settle(p,600);
        await p.setInputFiles('#add-one input[type=file]',{name:'tie.jpg',mimeType:'image/jpeg',buffer:fs.readFileSync(path.join(FIX,'suit','mask-jacket.png'))});await wait(5000);
        await clk(p,'#add .pback').catch(()=>{});await settle(p,400)});
      await step(p,'the setup, the tour and the import',async()=>{await p.evaluate(()=>HOOK.setupOpen(true));await settle(p,800);
        for(let i=0;i<8;i++){const b=p.locator('#setup .pri:visible').first();if(!(await b.count()))break;await b.tap({timeout:2000}).catch(()=>{});await settle(p,500)}
        await p.evaluate(()=>{try{HOOK.setupClose()}catch(e){}});await settle(p,500);await p.evaluate(()=>HOOK.tourAgain());await settle(p,800);await p.keyboard.press('Escape');await settle(p,400);
        await p.evaluate(()=>HOOK.kitImportOpen());await settle(p,600);await p.keyboard.press('Escape');await settle(p,400)});
    }
    await ctx.close()}
  ok(/^painted/.test(painted.default||'')||eng==='WebKit',T+`the painter paints Today under the policy (graphics chip or worker: ${painted.default}; on the processor: ${painted.processor}; on the page: ${painted.page})`);

  /* ---- the start-up card (start.js refused) ---- */
  {const ctx=await ctxOf({storageState:state});await ctx.route(u=>u.href.startsWith(origin)&&new URL(u.href).pathname==='/start.js',r=>r.fulfill({status:404,body:''}));const p=await ctx.newPage();
    let card=false;await step(p,'the start-up card',async()=>{await p.goto(url);card=await p.waitForSelector('#start-fail',{timeout:20000}).then(()=>true).catch(()=>false)});
    ok(card,T+'with start.js refused, the start-up card still shows (its inline script is allowed by its hash)');await ctx.close()}
  /* ---- the service worker registers under worker-src ---- */
  {const ctx=await browser.newContext({serviceWorkers:'allow'});await ctx.route(u=>/^https?:/.test(u.href)&&!u.href.startsWith(origin),answer);await ctx.addInitScript(NOTES);await ctx.addInitScript(()=>{self.__swReal=1});
    const p=await ctx.newPage();let reg=false;
    await step(p,'the service worker',async()=>{await p.goto(url);await p.waitForFunction(()=>window.appReady,null,{timeout:90000});reg=await p.evaluate(()=>Promise.race([navigator.serviceWorker.ready.then(()=>true),new Promise(r=>setTimeout(()=>r(false),15000))]))});
    ok(reg||eng==='WebKit',T+`sw.js registers and activates under the policy (${reg})`);await ctx.close()}

  const list=Object.entries(all).map(([k,v])=>k+': '+v.join(' | '));
  ok(!list.length,T+'no security policy violation anywhere the app was used'+(list.length?': '+list.join(' ;; '):''));
  ok(!away.length,T+'nothing was asked of any other site'+(away.length?': '+[...new Set(away)].join(', '):''));

  /* ---- the plants: an inline script added to the page, one served in index.html, and a head script changed: each refused and seen ---- */
  {const ctx=await ctxOf({storageState:state});const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady,null,{timeout:90000});await seen(p);
    await p.evaluate(()=>{const s=document.createElement('script');s.textContent='window.__planted=1';document.head.appendChild(s)});await wait(300);
    const v=await seen(p),ran=await p.evaluate(()=>window.__planted===1);
    ok(!ran&&v.length===1&&/^script-src/.test(v[0]),T+`an inline script injected into the page doesn't run and the listener sees it (${v.join(' | ')||'nothing seen'})`);await ctx.close()}
  for(const [label,swap] of [['an inline script added to index.html',h=>h.replace('<title>','<script>window.__planted=1</script><title>')],
    ['the theme script changed without its hash',h=>h.replace('if(t==="light"||t==="dark")','window.__planted=1;if(t==="light"||t==="dark")')]]){
    const ctx=await ctxOf({storageState:state});await ctx.route(u=>u.href.startsWith(origin)&&/^\/(index\.html)?$/.test(new URL(u.href).pathname),r=>r.fulfill({status:200,contentType:'text/html',body:swap(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'))}));
    const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady,null,{timeout:90000}).catch(()=>{});await wait(300);
    const v=await seen(p),ran=await p.evaluate(()=>window.__planted===1).catch(()=>null);
    ok(ran===false&&v.length===1&&/^script-src/.test(v[0]),T+`${label}: refused, and the listener sees it (${v.join(' | ')||'nothing seen'})`);await ctx.close()}
}
