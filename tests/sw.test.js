// Service worker: works offline after the first visit and serves one version at a time: a new release (a bumped CACHE in sw.js)
// is downloaded whole in the background and waits; the page says so, and Update switches to it and reloads (about.js).
const http=require('http'),fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,ROOT})=>{
  let marker='',bump=0,slow=null,legacy=false;
  const LEGACY=`const CACHE='dw-v1';self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting())});self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
    self.addEventListener('fetch',e=>{const q=e.request;if(q.method!=='GET'||new URL(q.url).origin!==location.origin)return;e.respondWith(fetch(q,{cache:'no-cache'}))});`;
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'};
  const srv=http.createServer((q,r)=>{let u=q.url.split('?')[0];if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
    fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}
      if(u==='/index.html'&&marker)d=Buffer.from(String(d).replace('<h1>Daily Wardrobe</h1>',`<h1>Daily Wardrobe ${marker}</h1>`));
      if(u==='/core.js'&&marker)d=Buffer.from(String(d)+`\n;window.__core='${marker}';`);   // a second file of the same release
      if(u==='/sw.js'&&legacy)d=Buffer.from(LEGACY);
      if(u==='/sw.js'&&bump)d=Buffer.from(String(d).replace(/dw-v(\d+)/,(m,n)=>'dw-v'+(+n+bump)));
      if(slow&&slow.test(u)){setTimeout(()=>{r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(d)},6000);return}
      r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream','cache-control':'max-age=600'});r.end(d)})});
  await new Promise(r=>srv.listen(0,r));const url=`http://127.0.0.1:${srv.address().port}/`;
  const browser=await chromium.launch();const ctx=await browser.newContext();let page=await ctx.newPage();
  await page.goto(url);await page.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller,null,{timeout:10000}).catch(()=>{});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:5000}).catch(()=>{});
  ok(await page.evaluate(()=>!!navigator.serviceWorker.controller),'service worker controls the page');
  // one version at a time: the server's files change (a release), with and without a new version number
  const v0=await page.evaluate(async()=>{while(appVersion()==null)await new Promise(r=>setTimeout(r,50));return appVersion()});
  const seen=()=>page.evaluate(()=>({h:/v2/.test(document.querySelector('h1').textContent),core:window.__core||'',v:appVersion()}));
  marker='v2';await page.reload();await page.waitForFunction(()=>window.appReady&&appVersion()!=null);
  let s=await seen();
  ok(!s.h&&!s.core&&s.v===v0,'a reload stays on the installed version: no file of a newer release is mixed in');
  bump=1;slow=/app\.js$/;   // the release gets its number, and one of its files is slow to come (the old 4 s race served a mix here)
  await page.evaluate(()=>{window.__same=1;return checkForUpdate()});
  await page.waitForFunction(()=>document.querySelector('#toast').classList.contains('on')&&/A new version is ready/.test(document.querySelector('#toast').textContent),null,{timeout:10000}).catch(()=>{});
  ok(await page.evaluate(()=>/A new version is ready/.test(document.querySelector('#toast').textContent)&&!!document.querySelector('#toast button')),'a bumped sw.js raises "A new version is ready" with Update');
  await page.evaluate(async()=>{window.__reg=await navigator.serviceWorker.getRegistration()});await page.waitForFunction(()=>!!window.__reg.waiting,null,{timeout:30000}).catch(()=>{});
  s=await seen();
  ok(await page.evaluate(()=>window.__same===1&&navigator.serviceWorker.getRegistration().then(g=>!!g.waiting&&g.active===navigator.serviceWorker.controller))&&!s.h&&s.v===v0,
    'the new version downloads and waits: the page is not reloaded and keeps its service worker');
  await page.reload();await page.waitForFunction(()=>window.appReady&&appVersion()!=null);s=await seen();
  ok(!s.h&&!s.core&&s.v===v0,'a plain reload while it waits is still the old version, whole');
  slow=null;await page.evaluate(()=>{window.__same=1;return checkForUpdate()});
  await page.evaluate(()=>updateNow());
  await page.waitForFunction(()=>window.__same===undefined&&window.appReady&&appVersion()!=null,null,{timeout:20000}).catch(()=>{});s=await seen();
  ok(s.h&&s.core==='v2'&&s.v===v0+1,`Update switches to the new service worker and reloads: every file is the new release (version ${s.v})`);
  ok(await page.evaluate(async()=>{const ks=await caches.keys();return ks.filter(k=>/^dw-v/.test(k)).length===1&&navigator.serviceWorker.getRegistration().then(g=>!g.waiting&&!g.installing)}),'the old version\'s cache is gone');
  // a version that was left waiting takes over when the app is next started
  marker='v3';bump=2;await page.evaluate(()=>checkForUpdate());
  await page.evaluate(async()=>{window.__reg=await navigator.serviceWorker.getRegistration()});await page.waitForFunction(()=>!!window.__reg.waiting,null,{timeout:30000}).catch(()=>{});
  await page.close();page=await ctx.newPage();
  let v3=false;for(let i=0;i<20&&!v3;i++){await page.goto(url);await page.waitForFunction(()=>window.appReady&&appVersion()!=null);v3=await page.evaluate(()=>/v3/.test(document.querySelector('h1').textContent)&&window.__core==='v3');
    if(!v3){await page.goto('about:blank');await new Promise(r=>setTimeout(r,250))}}   // the browser activates the waiting worker shortly after the last page went
  ok(v3&&await page.evaluate(v=>appVersion()===v,v0+2),'a version left waiting is the one running after the app was closed and opened again');
  // offline: the app shell still loads and renders
  await ctx.setOffline(true);await page.reload();await page.waitForSelector('#n-today',{timeout:5000}).catch(()=>{});
  ok((await page.textContent('h1')).includes('Daily Wardrobe')&&await page.$('#n-today')!==null,'app loads offline from the cache');
  ok(await page.evaluate(()=>typeof buildPlan==='function'&&typeof figureSvg==='function'&&typeof outfitFigureSvg==='function'),'all scripts available offline');
  await ctx.setOffline(false);
  // cross-origin requests are not intercepted
  const sw=await page.evaluate(()=>fetch('https://example.invalid/x').then(()=>'ok',e=>'network error'));
  ok(sw==='network error','cross-origin requests pass through untouched');
  const manifest=await page.evaluate(()=>fetch('manifest.webmanifest').then(r=>r.json()));
  ok(manifest.display==='standalone'&&manifest.icons.length===2,'web app manifest with icons');
  // home-screen icons: right sizes, and a photo (thousands of colours), not flat artwork
  const icons=await page.evaluate(()=>Promise.all([['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]].map(([f,s])=>new Promise(res=>{const im=new Image();
    im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data,set=new Set();
      for(let i=0;i<d.length;i+=4)set.add((d[i]>>2)<<12|(d[i+1]>>2)<<6|(d[i+2]>>2));res({f,ok:im.width===s&&im.height===s,colours:set.size})};im.onerror=()=>res({f,ok:false,colours:0});im.src=f}))));
  ok(icons.every(i=>i.ok&&i.colours>1500),`home-screen icons are the outfit photo at 180/192/512 px (${icons.map(i=>i.f+':'+i.colours).join(', ')})`);
  ok(/rel="apple-touch-icon" href="apple-touch-icon.png/.test(require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8')),'iPhone home-screen icon is linked');
  // coming from the earlier service worker (network-first, took over by itself): the page already runs the new files, so the
  // new worker of that same version takes over quietly, with no prompt and no reload
  {legacy=true;marker='';bump=0;const c2=await browser.newContext(),p2=await c2.newPage();
    await p2.goto(url);await p2.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000}).catch(()=>{});
    legacy=false;await p2.reload();await p2.waitForFunction(()=>window.appReady&&appVersion()!=null);
    await p2.evaluate(()=>{window.__same=1});
    const took=await p2.evaluate(async()=>{const t0=Date.now();while(Date.now()-t0<30000){const c=navigator.serviceWorker.controller;if(c&&await aboutAsk(c)===appVersion())return true;await new Promise(r=>setTimeout(r,200))}return false});
    ok(took&&await p2.evaluate(()=>window.__same===1&&!/new version/.test(document.querySelector('#toast').textContent)),'after the earlier service worker, the new one of the same version takes over without a prompt or a reload');
    await c2.close()}
  await browser.close();srv.close();
};
