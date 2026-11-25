// The rest of the app's controls name their handlers with data-act (act.js; Round C, wave C2-9, 2026-11-22) where they had inline
// on…="…" handlers: the question sheet, Connection, the account and invitations, About's delete card, reminders, the calendar, the dress
// code, the own colors, patterns and materials, the Add card's notes (tagging.js, pattern-read.js, safety.js), the close-up buttons
// (ui.js closeupBtn and its callers), an item picture's load and the "can't be opened" page. Every kind of control that moved is used
// here as a person uses it (a tap, Enter, a time typed, a file chosen), with the effect it had before. The test reads no attribute of the
// handlers (it finds controls by id, class and words), so it passes unchanged on the app from before the move: run there to prove the
// effects are the same. Where the real function would need the server or the push service, the function the control called is replaced
// on window and its arguments are checked. Chromium and WebKit (Safari's engine), with touch; then without touch for the file fields,
// one of them redrawn away while its picker is open (act.js actFileGone).
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await free(eng,browser,{ok,url,settle});await linked(eng,browser,{ok,url,settle});await desk(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
const HOST='https://w.test/',J={'content-type':'application/json','access-control-allow-origin':'*'};
const PUSH_KEY='BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';   // a made-up public key of the right shape (65 bytes)
const FILE=n=>({name:n,mimeType:'image/jpeg',buffer:Buffer.from('not a real picture')});
// replaceTexture (item-photo.js) is called inside its module, so it runs for real on the item page's close-up: a real picture, and the test reads which item took it
const REAL=n=>({name:n,mimeType:'image/jpeg',buffer:require('fs').readFileSync(require('path').join(__dirname,'fixtures','blazer-windowpane-closeup.jpg'))});
async function open(browser,eng,url,settle,o={}){
  const ctx=await browser.newContext(o.desk?{viewport:{width:900,height:900}}:{viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium',locale:'en-US',timezoneId:'Asia/Kuwait'});
  const S={reads:0,push:[],invites:[{id:'inv1',name:'Sam',used:{},caps:{}}],n:1};
  await ctx.route(HOST+'**',async r=>{const q=r.request(),u=new URL(q.url()),m=q.method(),send=(j,status=200)=>r.fulfill({status,headers:J,body:JSON.stringify(j)});
    if(m==='OPTIONS')return r.fulfill({status:204,headers:{...J,'access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(!o.linked)return send({error:'server'},503);
    if(u.pathname==='/me')return send({id:'own',role:'owner',name:'Owner'});
    if(u.pathname==='/invites'){
      if(m==='GET')return send({invites:S.invites});
      if(m==='POST'){const b=JSON.parse(q.postData()||'{}');
        if(b.reissue){const v=S.invites.find(x=>x.id===b.reissue);return send({code:'again'+(++S.n),name:v&&v.name})}
        S.invites.push({id:'inv'+(++S.n),name:b.name,used:{},caps:{}});return send({code:'code'+S.n,name:b.name})}
      if(m==='DELETE'){const id=u.searchParams.get('id');if(u.searchParams.get('purge'))S.invites=S.invites.filter(x=>x.id!==id);else S.invites.find(x=>x.id===id).off=true;return send({ok:true})}}
    if(u.pathname==='/push'){if(m==='GET')return send({key:PUSH_KEY,on:false});S.push.push(JSON.parse(q.postData()||'{}'));return send({ok:true,on:true})}
    // (no relay here, as a server from before it: the app then asks POST /calendar for the events; tests/calfeed.test.js has the relay)
    if(u.pathname==='/calendar/feed')return send({error:'not found'},404);
    if(u.pathname==='/calendar'){S.reads++;return send({from:'2026-11-20',to:'2027-01-19',events:[
      {id:'a1a1a1a1a1a1a1a1',title:'Annual gala, black tie',start:'2026-11-26',end:'2026-11-26',allDay:true,days:1},
      {id:'b2b2b2b2b2b2b2b2',title:'Dress down Thursday',start:'2026-11-25',end:'2026-11-25',allDay:true,days:1},
      {id:'c3c3c3c3c3c3c3c3',title:'Retail conference',start:'2026-12-07',end:'2026-12-09',allDay:true,days:3,location:'Dubai'}]})}
    return send({error:'server'},503)});
  await ctx.addInitScript(([h,linked])=>{localStorage.setItem('tour_seen','1');
    if(linked){localStorage.setItem('worker_url',h);localStorage.setItem('app_token','o');localStorage.setItem('last_sync',String(Date.now()))}
    // reminders need the push service's names to draw their switches (WebKit outside a phone has none); nothing here subscribes
    for(const n of ['PushManager','Notification'])if(!(n in window))window[n]=function(){};
    if(!('serviceWorker' in navigator))Object.defineProperty(Navigator.prototype,'serviceWorker',{configurable:true,get(){return {getRegistration:async()=>null,addEventListener(){},ready:new Promise(()=>{})}}})},[HOST,!!o.linked]);
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{CK_OPEN['*']=true;
    window.__pic=(w,h,c)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,w,h);return cv.toDataURL('image/jpeg',.9)};
    HOOK.items=[{id:'s1',type:'suit',primaryColor:'navy',pattern:'solid',photo:__pic(300,300,'#234')},{id:'s2',type:'suit',primaryColor:'charcoal',pattern:'solid',photo:__pic(300,300,'#444'),texture:__pic(200,200,'#444')},
      {id:'t1',type:'tie',primaryColor:'burgundy',pattern:'solid'},{id:'h1',type:'shirt',primaryColor:'white',pattern:'solid'},{id:'p1',type:'pants',primaryColor:'grey',pattern:'solid'},{id:'o1',type:'shoes',primaryColor:'black',pattern:'solid',leather:'calf'}];
    settings.setupDone=1;settings.workdays=[0,1,2,3,4];HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-20T09:00:00';HOOK.cache={};queue.length=0;
    window.__calls=[];window.__spy=(...names)=>{for(const f of names)window[f]=(...a)=>{__calls.push([f,...a.map(x=>x instanceof File?'file:'+x.name:x)])}};
    /* a function of a file that is an ES module (remind.js: remindSwitch) is called inside its module, where a replaced window.<name>
       isn't seen (tests/bridge.test.js; tests/actsindex.test.js VIA): it is replaced one step earlier, at the handlers the markup names
       (ACTS, act.js), each given here with the arguments its own line calls the function with. So this file no longer runs those
       handlers' own lines: tests/remind.test.js taps both switches with the real ones (and a push service of its own). */
    window.__via=(f,how)=>{for(const h of Object.keys(how)){if(typeof ACTS[h]!=='function'){__calls.push(['missing',h]);continue}ACTS[h]=el=>{__calls.push([f,...how[h](el)])}}};
    show('today')});
  await settle(p,400);
  const ev=(f,a)=>p.evaluate(f,a);
  const tap=async(sel,ms)=>{const l=typeof sel==='string'?p.locator(sel).first():sel;await l.scrollIntoViewIfNeeded();if(o.desk)await l.click();else await l.tap();await settle(p,ms||300)};
  const calls=async()=>{const c=await ev(()=>__calls.splice(0));return JSON.stringify(c)};
  return {ctx,p,errs,S,ev,tap,calls}}

/* ---- not connected: the question, Connection, "needs a connection", the dress code, the own lists, an item picture, the page that can't open ---- */
async function free(eng,browser,{ok,url,settle}){
  const T=eng+': ',{ctx,p,errs,ev,tap}=await open(browser,eng,url,settle);
  // the question sheet
  await ev(()=>{window.__ans=[];askConfirm('Sure?\n\nMore.',{ok:'Yes',cancel:'No'}).then(v=>__ans.push(v))});await settle(p,300);
  await tap('#ask-cancel',400);
  await ev(()=>{askConfirm('Sure?',{ok:'Yes',cancel:'No'}).then(v=>__ans.push(v))});await settle(p,300);
  await tap('#ask-ok',400);
  const ans=await ev(()=>({a:__ans,up:!!asking}));
  ok(JSON.stringify(ans.a)==='[false,true]'&&!ans.up,T+'a question: a tap on its left button answers no, on its right button yes, and it closes ('+JSON.stringify(ans)+')');
  // Connection: Enter in the invite field, Connect, the owner's line
  await ev(()=>{openSettings('connection');document.addEventListener('keydown',e=>{if(e.key==='Enter')window.__kd=e.defaultPrevented})});await settle(p,600);
  await p.locator('#conn-link').click();await p.keyboard.type('nonsense');await p.keyboard.press('Enter');
  await p.waitForFunction(()=>!HOOK.connBusy&&!!document.querySelector('#conn-msg').textContent,null,{timeout:8000}).catch(()=>{});
  let c=await ev(()=>({msg:document.querySelector('#conn-msg').textContent,kd:window.__kd,typed:document.querySelector('#conn-link').value}));
  ok(/link/.test(c.msg)&&c.kd===true&&c.typed==='nonsense',T+'Connection: Enter in the invite field tries the link (the key’s own effect held back) and says why it failed ('+JSON.stringify(c)+')');
  await ev(()=>{HOOK.connMsg='';renderConnUI()});
  await tap('#conn-go');await p.waitForFunction(()=>!HOOK.connBusy&&!!document.querySelector('#conn-msg').textContent,null,{timeout:8000}).catch(()=>{});
  c=await ev(()=>document.querySelector('#conn-msg').textContent);
  ok(/link/.test(c),T+'a tap on Connect does the same ('+c+')');
  await tap('#conn-own button',400);
  c=await ev(()=>({open:document.body.classList.contains('srv-open'),fold:document.querySelector('#adv-connection').classList.contains('open'),line:document.querySelector('#conn-own').hidden}));
  ok(c.open&&c.fold&&c.line,T+'"I run the server" opens the address and code fold and goes ('+JSON.stringify(c)+')');
  // a section that needs the server: its Connect opens Connection with the cursor in the field
  await ev(()=>{openSettings('backup')});await settle(p,600);
  await ev(()=>{if(document.querySelector('#sc-connection').classList.contains('open'))toggleCat('connection')});await settle(p,600);
  await tap('#backup-conn button',900);
  c=await ev(()=>({open:document.querySelector('#sc-connection').classList.contains('open'),at:document.activeElement&&document.activeElement.id}));
  ok(c.open&&c.at==='conn-link',T+'"Backing up and syncing needs a connection. Connect" opens Connection and puts the cursor in the invite field ('+JSON.stringify(c)+')');
  await ev(()=>{closeSettings();openAdd()});await settle(p,500);
  await tap('#add-group-off button',900);
  c=await ev(()=>({set:settingsOpen(),open:document.querySelector('#sc-connection').classList.contains('open')}));
  ok(c.set&&c.open,T+'Add’s "Several items … needs a connection. Connect" opens Settings on Connection ('+JSON.stringify(c)+')');
  // the dress code's switches
  await ev(()=>openSettings('schedule'));await settle(p,600);
  await tap('#dress-tie',500);const d1=await ev(()=>({tie:wearsTie(),aria:document.querySelector('#dress-tie').getAttribute('aria-checked')}));
  await tap('#dress-tie',500);const d2=await ev(()=>({tie:wearsTie(),aria:document.querySelector('#dress-tie').getAttribute('aria-checked')}));
  await tap('#dress-jeans',500);const d3=await ev(()=>!!(settings.dress&&settings.dress.jeans));
  await tap('#dress-jeans',500);const d4=await ev(()=>!!(settings.dress&&settings.dress.jeans));
  ok(!d1.tie&&d1.aria==='false'&&d2.tie&&d2.aria==='true'&&d3&&!d4,T+'the dress code: a tap switches Ties off, a second tap on again; Jeans with a blazer on, then off ('+JSON.stringify([d1,d2,d3,d4])+')');
  // the own colors, patterns and materials
  await ev(()=>{settings.ownMaterials={suit:['cupro'],tie:['raffia']};openSettings('tagging')});await settle(p,600);
  await tap('#ownmat-list .ownmatrow[data-m="cupro"] button',500);
  c=await ev(()=>({mats:JSON.stringify(settings.ownMaterials),rows:[...document.querySelectorAll('#ownmat-list .ownmatrow')].map(r=>r.dataset.m)}));
  ok(c.mats==='{"tie":["raffia"]}'&&c.rows.join()==='raffia',T+'Your materials: Remove takes that material off the list and leaves the other ('+JSON.stringify(c)+')');
  await tap('#cust-newcol',700);const n1=await ev(()=>({on:document.querySelector('#col-sheet').classList.contains('on'),t:(document.querySelector('#col-sheet').textContent||'').replace(/\s+/g,' ').slice(0,60)}));
  await ev(()=>closeColPick());await settle(p,500);
  await tap('#cust-newpat',700);const n2=await ev(()=>({on:document.querySelector('#col-sheet').classList.contains('on'),t:(document.querySelector('#col-sheet').textContent||'').replace(/\s+/g,' ').slice(0,60)}));
  await ev(()=>closeColPick());await settle(p,500);
  ok(n1.on&&n2.on&&/color/i.test(n1.t)&&/pattern/i.test(n2.t)&&n1.t!==n2.t,T+'"+ New color" opens the new color sheet and "+ New pattern" the new pattern sheet ('+JSON.stringify([n1.t,n2.t])+')');
  // an item picture reads its background color once it has loaded
  const bg=await ev(async()=>{closeSettings();const t=HOOK.ITEM_PIC_TYPES[0],it={id:'pic1',type:t,primaryColor:'black',pattern:'solid'},k=itemKey(it);renders[k]={img:__pic(64,64,'#a33')};
    const before=picBgs[k];const d=document.createElement('div');d.id='pic-fx';document.body.append(d);d.innerHTML=itemPicHtml(it,'');
    for(let i=0;i<60&&picBgs[k]===undefined;i++)await new Promise(r=>setTimeout(r,50));
    const r={img:!!d.querySelector('img.item-pic'),before:before===undefined,after:picBgs[k]!==undefined};d.remove();return r});
  ok(bg.img&&bg.before&&bg.after,T+'an item picture’s background is read when the picture has loaded ('+JSON.stringify(bg)+')');
  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.join(' | '):''));
  // the page shown when the wardrobe can't be opened: Try again loads the app again
  await ev(()=>{window.__mark=1;return storageDown({dwStore:true,message:'made up'})});await settle(p,300);
  const ns=await ev(()=>!!document.querySelector('#nostore .nostore-btn'));
  await tap('#nostore .nostore-btn',300);
  await p.waitForFunction(()=>window.appReady&&!window.__mark,null,{timeout:15000}).catch(()=>{});
  const again=await ev(()=>({mark:window.__mark||0,page:!document.querySelector('#nostore'),ready:!!window.appReady}));
  ok(ns&&!again.mark&&again.page&&again.ready,T+'"Your wardrobe can’t be opened here": Try again loads the app afresh ('+JSON.stringify(again)+')');
  await ctx.close()}

/* ---- connected as the owner: invitations, About's delete card, reminders, the calendar, the Add card's notes, the close-up chooser ---- */
async function linked(eng,browser,{ok,url,settle}){
  const T=eng+': ',{ctx,p,errs,S,ev,tap,calls}=await open(browser,eng,url,settle,{linked:true});
  let c;
  // invitations
  await ev(()=>openSettings('connection'));
  await p.waitForFunction(()=>!!document.querySelector('#acct-create')&&!!document.querySelector('#acct-list .acct-inv'),null,{timeout:10000}).catch(()=>{});await settle(p,500);
  await p.locator('#acct-name').click();await p.keyboard.type('Kim');
  await tap('#acct-create',300);await p.waitForFunction(()=>!!document.querySelector('#acct-link-url'),null,{timeout:8000}).catch(()=>{});
  c=await ev(()=>({url:(document.querySelector('#acct-link-url')||{}).value||'',rows:[...document.querySelectorAll('#acct-list .acct-inv-top > b')].map(b=>b.textContent)}));
  ok(/code2/.test(c.url)&&c.rows.join()==='Sam,Kim',T+'invitations: Create makes the tester named in the field and shows the link ('+JSON.stringify(c)+')');
  await ev(()=>{document.activeElement.blur();document.querySelector('#acct-link-url').focus()});await settle(p,200);   // (the focus itself: a tap also puts the cursor somewhere)
  c=await ev(()=>{const f=document.querySelector('#acct-link-url');return {at:document.activeElement===f,a:f.selectionStart,b:f.selectionEnd,n:f.value.length}});
  ok(c.at&&c.a===0&&c.b===c.n&&c.n>10,T+'the link’s field selects the whole link when it gets the focus ('+JSON.stringify(c)+')');
  await ev(()=>toastDrop&&toastDrop());await tap('#acct-copy',500);
  c=await ev(()=>document.querySelector('#toast').textContent);
  ok(/Link copied|Select the link and copy it/.test(c),T+'Copy copies the link, or says to select it ('+c+')');
  await tap('#acct-list .acct-inv[data-id="inv1"] .acct-new',500);const q1=await ev(()=>!!asking&&document.querySelector('#ask-title').textContent);
  await tap('#ask-ok',300);await p.waitForFunction(()=>/again/.test((document.querySelector('#acct-link-url')||{}).value||''),null,{timeout:8000}).catch(()=>{});
  c=await ev(()=>({url:(document.querySelector('#acct-link-url')||{}).value||'',label:(document.querySelector('#acct-link .slabel')||{}).textContent||''}));
  ok(/new link for Sam/i.test(q1||'')&&/again3/.test(c.url)&&c.label==='New link for Sam',T+'New link asks first, then shows Sam’s new link ('+JSON.stringify([q1,c])+')');
  await tap('#acct-list .acct-inv[data-id="inv2"] .acct-btns .danger',500);const q2=await ev(()=>!!asking&&document.querySelector('#ask-title').textContent);
  await tap('#ask-ok',300);await p.waitForFunction(()=>!!document.querySelector('#acct-list .acct-inv.off[data-id="inv2"]'),null,{timeout:8000}).catch(()=>{});
  c=await ev(()=>({off:!!document.querySelector('#acct-list .acct-inv.off[data-id="inv2"]'),btn:(document.querySelector('#acct-list .acct-inv[data-id="inv2"] button')||{}).textContent}));
  ok(/Revoke Kim/.test(q2||'')&&c.off&&c.btn==='Delete their data'&&S.invites.find(x=>x.id==='inv2').off===true,T+'Revoke asks first, then switches Kim’s invitation off on the server ('+JSON.stringify([q2,c])+')');
  await tap('#acct-list .acct-inv[data-id="inv2"] button',500);const q3=await ev(()=>!!asking&&document.querySelector('#ask-title').textContent);
  await tap('#ask-ok',300);await p.waitForFunction(()=>!document.querySelector('#acct-list .acct-inv[data-id="inv2"]'),null,{timeout:8000}).catch(()=>{});
  c=await ev(()=>[...document.querySelectorAll('#acct-list .acct-inv')].map(r=>r.dataset.id));
  ok(/Delete Kim/.test(q3||'')&&c.join()==='inv1'&&S.invites.length===1,T+'Delete their data asks first, then takes Kim off the server and the list ('+JSON.stringify([q3,c])+')');
  await ev(()=>{toastDrop&&toastDrop();HOOK.acct={...acct,me:{id:'t',role:'tester',name:'Tess',used:{},caps:{}},state:'ok'};HOOK.renderAccountUI()});await settle(p,200);
  await tap('#acct-box .sactions button',500);
  c=await ev(()=>document.querySelector('#toast').textContent);
  ok(/Your invitation link is copied|Copy the link shown under the button/.test(c),T+'a tester’s "Copy my invitation link" copies it, or shows it to copy ('+c+')');
  await ev(()=>{HOOK.acct={...acct,me:{id:'own',role:'owner',name:'Owner'}};HOOK.renderAccountUI()});

  // About: the delete card (the deletion itself is replaced: it would empty this test's app)
  await ev(()=>{__via('deleteMyData',{delAllTap:()=>[true],delDeviceTap:()=>[false]});openSettings('about')});await settle(p,600);   // (at the two handlers: about.js is a module; about.test.js and shellfix.test.js tap them for real)
  await tap('#del-open',400);const a1=await ev(()=>({up:!document.querySelector('#del-confirm').hidden,btns:[...document.querySelectorAll('#del-confirm button')].map(b=>b.id)}));
  await tap('#del-cancel',300);const a2=await ev(()=>document.querySelector('#del-confirm').hidden);
  await tap('#del-open',400);await tap('#del-all',300);const a3=await calls();
  await tap('#del-open',400);await tap('#del-device',300);const a4=await calls();
  ok(a1.up&&a1.btns.join()==='del-all,del-device,del-cancel'&&a2&&a3==='[["deleteMyData",true]]'&&a4==='[["deleteMyData",false]]',
    T+'About’s delete card: Cancel puts it away, "Delete everything" deletes from the server too, "this device only" doesn’t ('+JSON.stringify([a1,a2,a3,a4])+')');

  // reminders, the real handlers first (remind.js remindSwTap and careRemSwTap, down to remindSwitch), on both engines: the app's
  // users are on iPhones, and tests/remind.test.js, which also clicks both switches, starts Chromium only (it runs the server's
  // side in Node and reads the lines kept in Cache Storage). The phone's notifications and push service are stood in for (no
  // prompt, nothing subscribed anywhere), and the server is this test's route.
  await ev(()=>{const sub={endpoint:'https://push.test/me',unsubscribe:async()=>{window.__unsub=(window.__unsub||0)+1;have=null;return true}};let have=null;
    window.__perm=0;window.Notification.requestPermission=async()=>{window.__perm++;return 'granted'};
    const reg={addEventListener(){},removeEventListener(){},update:async()=>{},installing:null,waiting:null,active:null,pushManager:{getSubscription:async()=>have,subscribe:async()=>{have=sub;return sub}}};
    Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(reg),getRegistration:async()=>reg,addEventListener(){},removeEventListener(){}}});
    localStorage.removeItem('remind_sent');HOOK.remindSave({on:false,care:false,time:'06:30'});openSettings('schedule')});await settle(p,600);
  {const flip=async(sw,want)=>{await tap(sw,100);await p.waitForFunction(w=>!HOOK.remindBusy&&JSON.stringify([HOOK.remindPrefs().on,HOOK.remindPrefs().care])===w,want,{timeout:8000}).catch(()=>{});
      return ev(()=>({p:[HOOK.remindPrefs().on,HOOK.remindPrefs().care],sw:['#remind-sw','#care-rem-sw'].map(s=>document.querySelector(s).getAttribute('aria-checked')).join(),msg:document.querySelector('.remind-msg').textContent}))};
    const a=await flip('#remind-sw','[true,false]'),b=await flip('#care-rem-sw','[true,true]'),c2=await flip('#remind-sw','[false,true]'),d=await flip('#care-rem-sw','[false,false]');
    const n=await ev(()=>({perm:window.__perm,unsub:window.__unsub||0})),ps=S.push;
    ok(a.p.join()==='true,false'&&a.sw==='true,false'&&/^On: a notification at 06:30 on your workdays/.test(a.msg)&&b.p.join()==='true,true'&&b.sw==='true,true'&&/due for the cleaner/.test(b.msg)
      &&c2.p.join()==='false,true'&&c2.sw==='false,true'&&c2.msg==='Off.'&&d.p.join()==='false,false'&&d.sw==='false,false'&&d.msg==='Off.',
      T+'reminders, the real handlers: a tap switches the morning reminder on, a tap the cleaning reminders on, then each off again, each switch its own ('+JSON.stringify([a,b,c2,d])+')');
    ok(ps.length===4&&ps.slice(0,3).every(x=>x.endpoint==='https://push.test/me'&&x.time==='06:30'&&Array.isArray(x.dates)&&!x.off)&&ps[3].off===true&&n.perm===2&&n.unsub===1,
      T+'and the server is told each time: the time and the dates while either is on, off with the last one, the subscription then given up ('+JSON.stringify({posts:ps.map(x=>x.off?'off':x.time+' '+(x.dates||[]).length+' dates'),...n})+')');
    await ev(()=>{delete navigator.serviceWorker;localStorage.removeItem('remind_sent');closeSettings()});await settle(p,300)}
  // then the calls themselves (the push service is replaced: remindSwitch is what both switches call)
  await ev(()=>{const turn=el=>el.getAttribute('aria-checked')!=='true';   // (a tap turns a switch the other way from what it shows)
    __via('remindSwitch',{remindSwTap:el=>['morning',turn(el)],careRemSwTap:el=>['care',turn(el)]});HOOK.remindSave({on:false,care:false,time:'06:30'});openSettings('schedule')});await settle(p,600);
  const hasSw=await ev(()=>!!document.querySelector('#remind-sw'));
  await tap('#remind-sw',300);const r1=await calls();
  await ev(()=>{HOOK.remindSave({on:true,care:false,time:'06:30'});HOOK.renderRemindUI()});
  await tap('#remind-sw',300);const r2=await calls();
  await tap('#care-rem-sw',300);const r3=await calls();
  await ev(()=>{HOOK.remindSave({on:true,care:true,time:'06:30'});HOOK.renderRemindUI()});
  await tap('#care-rem-sw',300);const r4=await calls();
  ok(hasSw&&r1==='[["remindSwitch","morning",true]]'&&r2==='[["remindSwitch","morning",false]]'&&r3==='[["remindSwitch","care",true]]'&&r4==='[["remindSwitch","care",false]]',
    T+'reminders: each switch turns the other way from what it shows, the morning one and the cleaning one ('+[r1,r2,r3,r4].join(' ')+')');
  await ev(()=>{HOOK.remindSave({on:false,care:false,time:'06:30'});HOOK.renderRemindUI()});
  {const h=await p.locator('#remind-time').elementHandle();await h.fill('07:15');if(await h.evaluate(e=>e.isConnected))await h.evaluate(e=>e.dispatchEvent(new Event('change',{bubbles:true})));await settle(p,300)}
  c=await ev(()=>HOOK.remindPrefs().time);
  ok(c==='07:15',T+'the reminder’s time is kept when it is changed ('+c+')');

  // the calendar
  await ev(()=>openSettings('calendar'));await settle(p,600);
  await p.locator('#cal-link').click();await p.keyboard.type('not a link');await tap('#cal-connect',400);
  const k0=await ev(()=>document.querySelector('#cal-msg').textContent);
  await p.locator('#cal-link').fill('webcal://cal.example.test/p/secret/basic.ics');await tap('#cal-connect',300);
  await p.waitForFunction(()=>/^Connected/.test((document.querySelector('#cal-msg')||{}).textContent||''),null,{timeout:10000}).catch(()=>{});
  c=await ev(()=>({msg:document.querySelector('#cal-msg').textContent,rows:[...document.querySelectorAll('#cal-new-list .cal-row b')].map(b=>b.textContent),url:settings.calendar&&settings.calendar.url}));
  ok(/doesn’t look like a calendar link/.test(k0)&&/^Connected\. 3 events/.test(c.msg)&&c.rows.length===3&&/^webcal:/.test(c.url||'')&&S.reads===1,T+'the calendar: Connect turns down a text that isn’t a link, then reads the link and lists its events ('+JSON.stringify([k0,c])+')');
  await ev(()=>{closeSettings();show('today');HOOK.sel=homeDay();renderToday()});await settle(p,400);
  const ban=await ev(()=>(document.querySelector('#cal-new')||{}).textContent||'');
  await tap('#cal-new button',700);
  c=await ev(()=>settingsOpen()&&document.querySelector('#sc-calendar').classList.contains('open'));
  ok(/^3 new calendar eventsReview$/.test(ban)&&c,T+'Today’s "3 new calendar events · Review" opens Settings on the calendar ('+ban+')');
  const row=t=>`#cal-review .cal-row:has(b:text-is("${t}"))`;
  await tap(row('Annual gala, black tie')+' .cal-ok',300);await p.waitForFunction(()=>settings.calSeen&&settings.calSeen.a1a1a1a1a1a1a1a1==='k',null,{timeout:8000}).catch(()=>{});await settle(p,300);
  c=await ev(()=>({formal:!!(dayRecs['2026-11-26']&&dayRecs['2026-11-26'].formal),kept:!!document.querySelector('.cal-row.kept .linkbtn')&&document.querySelector('.cal-row.kept .linkbtn').textContent}));
  ok(c.formal&&c.kept==='Used · Undo',T+'✓ on the gala sets that day formal and marks the event used ('+JSON.stringify(c)+')');
  await tap(row('Annual gala, black tie')+' .linkbtn',300);await p.waitForFunction(()=>!(settings.calSeen||{}).a1a1a1a1a1a1a1a1,null,{timeout:8000}).catch(()=>{});await settle(p,300);
  c=await ev(()=>({seen:(settings.calSeen||{}).a1a1a1a1a1a1a1a1||'',msg:document.querySelector('#cal-msg').textContent}));
  ok(!c.seen&&/offered again/.test(c.msg),T+'"Used · Undo" takes the mark off again ('+JSON.stringify(c)+')');
  await tap(row('Dress down Thursday')+' .cal-no',300);await p.waitForFunction(()=>(settings.calSeen||{}).b2b2b2b2b2b2b2b2==='x',null,{timeout:8000}).catch(()=>{});await settle(p,300);
  c=await ev(()=>({seen:(settings.calSeen||{}).b2b2b2b2b2b2b2b2||'',gone:!!document.querySelector('.cal-row.gone .linkbtn')&&document.querySelector('.cal-row.gone .linkbtn').textContent}));
  ok(c.seen==='x'&&c.gone==='Dismissed · Undo',T+'✕ dismisses an event ('+JSON.stringify(c)+')');
  await tap(row('Retail conference')+' .cal-ok',300);await p.waitForFunction(()=>(settings.calSeen||{}).c3c3c3c3c3c3c3c3==='k',null,{timeout:8000}).catch(()=>{});await settle(p,300);
  c=await ev(()=>({trip:HOOK.packTrip(),toast:document.querySelector('#toast').textContent,on:document.querySelector('#toast').classList.contains('on')}));
  ok(c.trip&&c.trip.a==='2026-12-07'&&c.trip.b==='2026-12-09'&&c.on&&/Packing list set/.test(c.toast)&&/Open/.test(c.toast),T+'✓ on the conference sets the Packing list’s trip, with a toast that offers Open ('+JSON.stringify(c)+')');
  await tap('#toast button',700);
  c=await ev(()=>({pack:!document.querySelector('#pack').hidden,set:settingsOpen()}));
  ok(c.pack,T+'the toast’s Open opens the Packing list ('+JSON.stringify(c)+')');
  await ev(()=>{closeSettings();show('today');HOOK.sel=new Date(2026,11,8);renderToday()});await settle(p,400);
  const trip=await ev(()=>(document.querySelector('#cal-trip')||{}).textContent||'');
  await tap('#cal-trip button',700);
  c=await ev(()=>!document.querySelector('#pack').hidden);
  ok(/^Trip: Retail conference/.test(trip)&&c,T+'a trip day’s "Packing list" on Today opens it ('+trip+')');
  await ev(()=>{show('today');openSettings('calendar')});await settle(p,600);
  await tap('.cal-guides button:text-is("Google")',700);
  c=await ev(()=>({kit:!!kit,set:settingsOpen(),text:((document.querySelector('#kit')||document.body).textContent||'').includes('Google')}));
  await ev(()=>kitClose());await settle(p,600);
  const back=await ev(()=>settingsOpen()&&document.querySelector('#sc-calendar').classList.contains('open'));
  ok(c.kit&&!c.set&&c.text&&back,T+'"How to get the link · Google" opens that walkthrough over the app, and closing it goes back to Settings → Calendar ('+JSON.stringify([c,back])+')');
  await tap('#cal-read',300);await p.waitForFunction(()=>!HOOK.calBusy&&/nothing new|new event/.test(document.querySelector('#cal-msg').textContent),null,{timeout:8000}).catch(()=>{});
  c=await ev(()=>document.querySelector('#cal-msg').textContent);
  ok(S.reads===2&&/nothing new|new event/.test(c),T+'Read now reads the calendar again ('+S.reads+', '+c+')');
  await tap('#cal-off',500);const q4=await ev(()=>!!asking&&document.querySelector('#ask-title').textContent);
  await tap('#ask-ok',600);
  c=await ev(()=>({url:settings.calendar||null,field:!!document.querySelector('#cal-link')}));
  ok(/Disconnect the calendar/.test(q4||'')&&!c.url&&c.field,T+'Disconnect asks first, then forgets the link ('+JSON.stringify([q4,c])+')');

  // the Add card's notes: three cards, so a control must find its own card
  await ev(()=>{closeSettings();const other=PATS_BY.suit.find(x=>x!=='pinstripe'&&x!=='solid'&&x!=='other');window.__other=other;
    __spy('retryTag','patternAgain','refineAgain','openColForm','openPatForm','addTexture');
    queue.length=0;queue.push({id:'k0',manual:true,type:'tie',primaryColor:'navy',pattern:'solid'},
      {id:'k1',type:'suit',primaryColor:'navy',pattern:'pinstripe',ai:{},tagErr:'It failed.',patternCut:true,refineNote:'Tagged again from the close-up.',refineUndo:{brand:'Was'},
        refineType:'blazer',refineKept:{c:'grey'},altColor:'charcoal',altPattern:other,auto:{secondaryColor:{from:'grey',to:'blue',src:'photo'}},secondaryColor:'blue',
        measV:[{mode:'flag',f:'tertiaryColor',to:'grey'}],newColor:{name:'Petrol'},newPattern:{name:'Basket'},settOff:true},
      {id:'k2',type:'suit',primaryColor:'grey',pattern:'solid',ai:{},refineCut:true});
    openAdd();renderAdd()});await settle(p,600);
  const K='#queue [data-q="k1"] ',Q=()=>ev(()=>{const q=queue.find(x=>x.id==='k1');return q?{type:q.type,c1:q.primaryColor,c2:q.secondaryColor,c3:q.tertiaryColor||'',pat:q.pattern,brand:q.brand||'',auto:Object.keys(q.auto||{}).join()}:null});
  const chip=(re,box)=>p.locator((box||K)+'button').filter({hasText:re}).first();
  const n0=await ev(()=>({cards:document.querySelectorAll('#queue [data-q]').length,k1:[...document.querySelectorAll('#queue [data-q="k1"] .chipbtn,#queue [data-q="k1"] .tagfail-btn')].map(b=>b.textContent)}));
  ok(n0.cards===3&&n0.k1.length>=11,T+'the Add card shows its notes and offers ('+JSON.stringify(n0)+')');
  await tap(chip(/^Try again$/));const t1=await calls();
  await tap(chip(/^Read the pattern again$/));const t2=await calls();
  await tap(chip(/^Read the close-up again$/,'#queue [data-q="k2"] '));const t3=await calls();
  // (toggleSett is called inside pattern-read.js, so it runs for real: the switch moved on this card alone; put back for the steps below)
  await tap(chip(/^Use the pattern from the photo$/));const t4=await ev(()=>{const q=queue.find(x=>x.id==='k1'),r=[q.settOff===false,queue.filter(x=>x!==q).every(x=>!x.settOff),__calls.splice(0).length];q.settOff=true;renderAdd();return r.join()});await settle(p,200);
  await tap(chip(/^Add as a new color$/));const t5=await calls();
  await tap(chip(/^Add this pattern$/));const t6=await calls();
  ok(t1==='[["retryTag",1]]'&&t2==='[["patternAgain",1]]'&&t3==='[["refineAgain",2]]'&&t4==='true,true,0'&&t5==='[["openColForm",1]]'&&t6==='[["openPatForm",1]]',
    T+'Try again, Read the pattern again, Read the close-up again, Use the pattern from the photo, Add as a new color and Add this pattern each act on their own card ('+[t1,t2,t3,t4,t5,t6].join(' ')+')');
  await tap(chip(/^Use /,K+'.measalt '),400);let q=await Q();
  ok(q.c3==='grey',T+'a measured color’s "Use …" sets that field ('+JSON.stringify(q)+')');
  await tap(chip(/^Undo$/,K+'.refnote '),400);q=await Q();
  ok(q.brand==='Was',T+'the close-up note’s Undo puts the earlier tags back ('+JSON.stringify(q)+')');
  await tap(chip(/^Undo$/,K+'.measauto '),400);q=await Q();
  ok(q.c2==='grey'&&!q.auto,T+'a measured change’s Undo puts the color back ('+JSON.stringify(q)+')');
  await tap(chip(/^or /),400);q=await Q();const first=q.c1;
  await tap(chip(/^or /),400);q=await Q();const other=await ev(()=>__other);
  ok(first==='charcoal'&&q.pat===other,T+'Claude’s runner-ups: "or charcoal" sets the color, then the other one the pattern ('+JSON.stringify(q)+')');
  await tap(chip(/^Use /,K+'.refkept '),400);q=await Q();
  ok(q.c1==='grey',T+'"Use gray" (what Claude said of the close-up) sets the color ('+JSON.stringify(q)+')');
  await tap(chip(/^Make it /,K+'.reftype '),500);q=await Q();
  ok(q.type==='blazer',T+'"Make it blazer" changes the type ('+JSON.stringify(q)+')');
  // the close-up chooser: the card's Add close-up and Replace close-up, the item page's Close-up
  await ev(()=>{const q=queue.find(x=>x.id==='k2');delete q.refineCut;renderAdd()});await settle(p,300);
  await tap('#queue [data-q="k2"] .ckadds .ckadd',600);
  const u1=await ev(()=>({up:!!cuOpen,rm:!!document.querySelector('#cu-rm'),title:document.querySelector('#cu-title').textContent}));
  await p.locator('#cu-lib').setInputFiles(FILE('a.jpg'));await settle(p,400);
  const u2=await calls(),u3=await ev(()=>!!cuOpen);
  ok(u1.up&&!u1.rm&&u1.title==='Fabric close-up'&&u2==='[["addTexture",2,"file:a.jpg"]]'&&!u3,T+'the card’s "Add close-up" opens the chooser, and the picture chosen goes to that card ('+JSON.stringify([u1,u2,u3])+')');
  await ev(()=>{const q=queue.find(x=>x.id==='k2');q.texture=__pic(120,120,'#555');renderAdd()});await settle(p,300);
  await tap(p.locator('#queue [data-q="k2"] .cubtn').filter({hasText:/Replace close-up/}).first(),600);
  const u4=await ev(()=>({up:!!cuOpen,rm:!!document.querySelector('#cu-rm'),title:document.querySelector('#cu-title').textContent}));
  await tap('#cu-rm',500);
  const u5=await ev(()=>({tex:!!queue.find(x=>x.id==='k2').texture,up:!!cuOpen}));
  ok(u4.up&&u4.rm&&u4.title==='Replace close-up'&&!u5.tex&&!u5.up,T+'"Replace close-up" opens the chooser with Remove close-up, which takes the card’s close-up off ('+JSON.stringify([u4,u5])+')');
  await ev(()=>{queue.length=0;window.__s2=items.find(x=>x.id==='s2').texture;show('wardrobe');openItem('s1')});await settle(p,700);
  await tap('#item-view .pt-closeup',600);
  const v1=await ev(()=>({up:!!cuOpen,rm:!!document.querySelector('#cu-rm')}));
  await p.locator('#cu-take').setInputFiles(REAL('b.jpg'));await p.waitForFunction(()=>!!items.find(x=>x.id==='s1').texture,null,{timeout:8000}).catch(()=>{});await settle(p,400);
  const v2=await ev(()=>({s1:!!items.find(x=>x.id==='s1').texture,s2same:items.find(x=>x.id==='s2').texture===__s2}));
  await ev(()=>{HOOK.closeItem();openItem('s2')});await settle(p,700);
  await tap('#item-view .pt-closeup',600);
  const v3=await ev(()=>({up:!!cuOpen,rm:!!document.querySelector('#cu-rm')}));
  await tap('#cu-rm',300);await p.waitForFunction(()=>!items.find(x=>x.id==='s2').texture,null,{timeout:8000}).catch(()=>{});await settle(p,300);
  const v4=await ev(()=>({tex:!!items.find(x=>x.id==='s2').texture,other:!!items.find(x=>x.id==='s1').texture,up:!!cuOpen}));
  ok(v1.up&&!v1.rm&&v2.s1&&v2.s2same&&v3.up&&v3.rm&&!v4.tex&&!v4.up,
    T+'the item page’s Close-up: the picture taken goes to that item; with a close-up, Remove close-up takes that item’s off ('+JSON.stringify([v1,v2,v3,v4])+')');
  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.join(' | '):''));
  await ctx.close()}

/* ---- without a touch screen a close-up button is the file field itself ---- */
async function desk(eng,browser,{ok,url,settle}){
  const T=eng+' (no touch): ',{ctx,p,errs,ev,calls}=await open(browser,eng,url,settle,{desk:true});
  await ev(()=>{__spy('addTexture');window.__s2=items.find(x=>x.id==='s2').texture;queue.length=0;queue.push({id:'k0',manual:true,type:'tie',primaryColor:'navy',pattern:'solid'},{id:'k2',type:'suit',primaryColor:'grey',pattern:'solid',ai:{}});openAdd();renderAdd()});await settle(p,600);
  const f1=p.locator('#queue [data-q="k2"] label.ckadd input[type=file]').first();
  await f1.setInputFiles(FILE('c.jpg'));await settle(p,400);
  const a=await calls(),av=await f1.evaluate(e=>e.value);
  // the picker open while the cards are drawn again (another card was read, say): the file chosen still goes to its card
  const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.locator('#queue [data-q="k2"] label.ckadd').first().click()]);
  const gone=await ev(()=>{const old=document.querySelector('#queue [data-q="k2"] label.ckadd input[type=file]');queue.unshift({id:'k9',manual:true,type:'tie',primaryColor:'red',pattern:'solid'});renderAdd();return !old.isConnected});
  await fc.setFiles(FILE('e.jpg'));await settle(p,400);
  const g=await calls();
  ok(gone&&g==='[["addTexture",2,"file:e.jpg"]]',T+'a close-up chosen after the cards were drawn again (its field no longer on the page) still goes to its card, now third ('+gone+' '+g+')');
  await ev(()=>{queue.shift();renderAdd()});
  await ev(()=>{queue.length=0;show('wardrobe');openItem('s1')});await settle(p,700);
  const f2=p.locator('#item-view .phtools label.pt-closeup input[type=file]').first();
  const f2h=await f2.elementHandle();await f2.setInputFiles(REAL('d.jpg'));await p.waitForFunction(()=>!!items.find(x=>x.id==='s1').texture,null,{timeout:8000}).catch(()=>{});await settle(p,400);
  const b=await ev(()=>({s1:!!items.find(x=>x.id==='s1').texture,s2same:items.find(x=>x.id==='s2').texture===__s2})),bv=await f2h.evaluate(e=>e.value);
  ok(a==='[["addTexture",1,"file:c.jpg"]]'&&av===''&&b.s1&&b.s2same&&bv==='',T+'a picture chosen in the card’s and the item page’s close-up field goes to that card and that item, and the field is emptied ('+[a,JSON.stringify(av),JSON.stringify(b),JSON.stringify(bv)].join(' ')+')');
  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.join(' | '):''));
  await ctx.close()}
