/* An iPhone 17 Pro in Safari, as close as Playwright's WebKit gets (from the 2026-11-15 audit's harness, with a clock,
   storage wiping and reopen options).

   const R = require('../harness/paths.js');
   const {openPhone,mock,setWorldTime,rng}=require(R.H+'phone.js');
   const ph=await openPhone({profile:'agent3-a',fresh:true});   // storage kept in .work/profiles/agent3-a between opens
   await ph.page.goto(url); await ph.ready();
   ph.tap(sel) / ph.tapAt(x,y) / ph.swipe(x1,y1,x2,y2,ms)        real touch events
   ph.background() / ph.foreground()                            swipe up to Home and come back
   ph.kill()                                                    iOS killing Safari with no warning (storage kept)
   ph.reopen(url, {timezoneId, locale, offline})                opens Safari again on the same storage, optionally in another time zone
   ph.shot('name')                                              screenshot into .work/shots/<profile>-name.png
   ph.errors, ph.console, ph.lastDialog, ph.onDialog=d=>d.dismiss()

   The phone's clock (Playwright's clock: time keeps running from the time you set):
   await ph.setTime('2027-03-01T07:30:00+03:00')   jump the phone's clock (kept across kill/reopen: same offset from real time)
   await ph.advance(24*3600e3)                     move it forward, firing due timers once (like a phone left asleep)
   ph.now()                                        the phone's current time (ms)
   await setWorldTime(ph, port, iso)               phone AND your lab's server to the same time (use this for "days passing")

   Storage:
   await ph.evict()     Safari's own wipe of the site's data (7 days unvisited without Home Screen, or low space):
                        every IndexedDB database, localStorage, sessionStorage, Cache Storage and the service worker go; then reload.
   await ph.storageSummary()   what is stored now (IDB databases with their store counts, localStorage keys, caches)

   Network: every request a page makes to anything but 127.0.0.1 goes through net.js (weather and holidays replayed from
   fixtures/net, everything else refused and noted), and the browser's proxy is net.js's backstop, which refuses all.

   rng(seed) -> a repeatable random number function (mulberry32).
   Limits: WebKit's desktop build with the iPhone's size, touch and user agent. No safe areas, URL-bar resizing,
   momentum scrolling, real camera, Home Screen install, Web Push, or real ITP (ph.evict() stands in for it). */
const path=require('path'),fs=require('fs');
const R=require('./paths.js'),NET=require('./net.js');
const PW=require('playwright');
const ROOT=R.SCRATCH;
async function openPhone({profile='phone',fresh=false,timezoneId='Asia/Kuwait',locale='en-US',geolocation,colorScheme='light',offline=false,time}={}){
  const dir=path.join(ROOT,'profiles',profile);if(fresh)fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  fs.mkdirSync(path.join(ROOT,'shots'),{recursive:true});
  const dev=PW.devices['iPhone 17 Pro'];
  let opts={...dev,timezoneId,locale,colorScheme,offline,permissions:geolocation?['geolocation']:[],geolocation,acceptDownloads:true};
  delete opts.defaultBrowserType;
  const ph={profile,errors:[],console:[],ctx:null,page:null,offset:null};
  const watch=p=>{p.on('pageerror',e=>ph.errors.push('pageerror: '+e.message));p.on('console',m=>{const t=m.type()+': '+m.text();ph.console.push(t);if(ph.console.length>500)ph.console.shift();if(m.type()==='error')ph.errors.push('console: '+m.text())});
    p.on('dialog',d=>{ph.console.push('dialog '+d.type()+': '+d.message());ph.lastDialog=d.message();if(ph.onDialog)return ph.onDialog(d);d.accept().catch(()=>{})})};
  ph.open=async()=>{ph.ctx=await PW.webkit.launchPersistentContext(dir,{...opts,headless:true,proxy:await NET.backstopProxy()});
    await NET.guardContext(ph.ctx);
    if(ph.offset!=null)await ph.ctx.clock.install({time:Date.now()+ph.offset});
    await ph.ctx.addInitScript(()=>{try{Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false,configurable:true})}catch{}});
    ph.page=ph.ctx.pages()[0]||await ph.ctx.newPage();watch(ph.page);ph.ctx.on('page',watch);return ph.page};
  ph.now=()=>Date.now()+(ph.offset||0);
  ph.setTime=async t=>{const ms=new Date(t).getTime();if(ph.offset==null){ph.offset=ms-Date.now();await ph.ctx.clock.install({time:ms})}else{ph.offset=ms-Date.now();await ph.ctx.clock.setSystemTime(ms)}};
  ph.advance=async ms=>{if(ph.offset==null)await ph.setTime(Date.now());ph.offset+=ms;await ph.ctx.clock.fastForward(ms)};
  if(time!=null){ph.offset=new Date(time).getTime()-Date.now()}
  await ph.open();
  const touch=(type,x,y)=>ph.page.evaluate(([type,x,y])=>{const st=window.__ph||(window.__ph={});
    if(type==='touchstart')st.el=document.elementFromPoint(x,y)||document.body;const el=st.el||document.body;
    const t={identifier:1,target:el,clientX:x,clientY:y,pageX:x+scrollX,pageY:y+scrollY,screenX:x,screenY:y,radiusX:1,radiusY:1,force:1};
    const live=type==='touchend'?[]:[t],list=a=>Object.assign([...a],{item:i=>a[i]||null});
    const ev=new Event(type,{bubbles:true,cancelable:true,composed:true});
    for(const [k,v] of [['touches',live],['targetTouches',live],['changedTouches',[t]]])Object.defineProperty(ev,k,{value:list(v)});
    el.dispatchEvent(ev);return ev.defaultPrevented},[type,x,y]);
  ph.tapAt=async(x,y)=>{await touch('touchstart',x,y);await touch('touchend',x,y);await ph.page.mouse.click(x,y)};
  ph.tap=async(sel)=>{const l=ph.page.locator(sel).first();await l.scrollIntoViewIfNeeded();const b=await l.boundingBox();if(!b)throw new Error('not visible: '+sel);await ph.tapAt(b.x+b.width/2,b.y+b.height/2)};
  ph.swipe=async(x1,y1,x2,y2,ms=250)=>{const n=10;await touch('touchstart',x1,y1);for(let i=1;i<=n;i++){await touch('touchmove',x1+(x2-x1)*i/n,y1+(y2-y1)*i/n);await ph.page.waitForTimeout(ms/n)}await touch('touchend',x2,y2);
    await ph.page.mouse.wheel(x1-x2,y1-y2).catch(()=>{})};
  ph.background=async()=>ph.page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});Object.defineProperty(document,'hidden',{value:true,configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));document.dispatchEvent(new Event('freeze'))});
  ph.foreground=async()=>ph.page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});Object.defineProperty(document,'hidden',{value:false,configurable:true});
    document.dispatchEvent(new Event('resume'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));document.dispatchEvent(new Event('visibilitychange'))});
  ph.kill=async()=>{try{await ph.ctx.close()}catch{}ph.ctx=null;ph.page=null};
  ph.reopen=async(url,o={})=>{if(ph.ctx)await ph.kill();opts={...opts,...o};await ph.open();if(url)await ph.page.goto(url);return ph.page};
  ph.close=ph.kill;
  ph.evict=async(url)=>{url=url||ph.page.url().split('#')[0];await ph.page.evaluate(async()=>{
      try{for(const d of (await indexedDB.databases()))await new Promise(r=>{const q=indexedDB.deleteDatabase(d.name);q.onsuccess=q.onerror=q.onblocked=()=>r()})}catch(e){}
      try{localStorage.clear()}catch{}try{sessionStorage.clear()}catch{}
      try{for(const k of await caches.keys())await caches.delete(k)}catch{}
      try{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister()}catch{}});
    await ph.kill();await ph.open();if(url&&url.startsWith('http'))await ph.page.goto(url);return ph.page};
  ph.storageSummary=()=>ph.page.evaluate(async()=>{const out={idb:{},ls:Object.keys(localStorage),caches:await caches.keys().catch(()=>[])};
    for(const d of (await indexedDB.databases().catch(()=>[]))){out.idb[d.name]=await new Promise(r=>{const q=indexedDB.open(d.name);q.onerror=()=>r('?');q.onsuccess=async()=>{const db=q.result,o={};
      for(const s of db.objectStoreNames){o[s]=await new Promise(rr=>{try{const c=db.transaction(s).objectStore(s).count();c.onsuccess=()=>rr(c.result);c.onerror=()=>rr('?')}catch{rr('?')}})}db.close();r(o)}})}return out});
  ph.shot=async(name,full=false)=>{const f=path.join(ROOT,'shots',`${profile}-${name}.png`);await ph.page.screenshot({path:f,fullPage:full}).catch(e=>ph.errors.push('shot failed '+e.message));return f};
  ph.ready=()=>ph.page.waitForFunction(()=>window.appReady,null,{timeout:30000});
  return ph;
}
const mock=async(port,what,body)=>{const r=await fetch(`http://127.0.0.1:${port+1}/__mock/${what}`,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return r.json()};
const setWorldTime=async(ph,port,t)=>{await ph.setTime(t);return mock(port,'clock',{at:new Date(t).toISOString()})};
const rng=seed=>{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
module.exports={openPhone,mock,setWorldTime,rng,PW};
