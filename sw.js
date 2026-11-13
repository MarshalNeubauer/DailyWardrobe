/* Daily Wardrobe service worker.
   One version at a time: installing downloads every app file afresh (past the browser's HTTP cache) into this version's own
   cache, and the page is then served from that cache only, so it never runs some files of one release and some of the next
   (the old network-first handler with its 4 s race did, on a slow connection right after a release), and it works offline.
   A new version installs in the background and WAITS: it takes over when the app is next started, or at once when the page
   asks ({type:'skipWaiting'}, about.js: the "Update" button, which then reloads). So a release reaches phones only when
   CACHE below is bumped: this file must change for the browser to see a new version.
   A request sent with cache:'no-store' is left to the network (about.js checks for a newer sw.js that way).
   Cross-origin requests (the AI worker, weather) are never cached. Caches named dw-keep-* hold the app's own data
   (the sharp tagging copies, tagging.js) and survive updates. */
const CACHE='dw-v190';
const ASSETS=['./','index.html','styles.css','core.js','planner.js','analysis.js','analysis-worker.js','detect.js','figure.js','draw.js','app.js','ui.js','safety.js','dress.js','tagging.js','assemble.js','asm-worker.js','stats.js','care.js','wardrobe.js','pack.js','shop.js','sync.js','account.js','remind.js','setup.js','about.js','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&!k.startsWith('dw-keep-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{const d=e.data||{};
  if(d.type==='skipWaiting')self.skipWaiting();
  else if(d.type==='version'&&e.ports&&e.ports[0])e.ports[0].postMessage({version:+CACHE.replace(/\D+/g,'')||null})});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin||req.cache==='no-store')return;   // let the browser handle it
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const hit=await cache.match(req,{ignoreSearch:true});
    if(hit)return hit;
    // not one of this version's files (or the cache was cleared): the network, kept for offline use
    try{
      const res=await fetch(req,{cache:'no-cache'});
      if(res&&res.ok)cache.put(req,res.clone());
      return res;
    }catch(err){
      const page=req.mode==='navigate'&&await cache.match('index.html');
      if(page)return page;
      throw err;
    }
  })());
});
/* the morning reminder (remind.js, worker.js sendReminders): a push with no text; the notification shows the line the app kept for
   today in dw-keep-remind (remind.json), or a plain one when there is none. A tap brings the app up. */
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
async function reminderNote(){let line='';
  try{const c=await caches.open('dw-keep-remind'),r=await c.match('remind.json');if(r)line=(await r.json())[dayKey(new Date())]||''}catch{}
  return self.registration.showNotification('Todayâ€™s outfit',{body:line||'Open the app to see what to wear today.',icon:'icon-192.png',badge:'icon-192.png',tag:'dw-morning'})}
self.addEventListener('push',e=>{e.waitUntil(reminderNote())});
self.addEventListener('notificationclick',e=>{e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>'focus' in x);return c?c.focus():self.clients.openWindow('./')}))});