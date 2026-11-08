/* Daily Wardrobe service worker.
   Network-first for the app's own files: every load fetches fresh copies (revalidating past the browser's HTTP cache),
   so updates show up immediately with no '?v=' tricks. If the network fails or is slow, the last cached copy is used,
   so the app also works offline. Cross-origin requests (the AI worker, weather) are never cached. */
const CACHE='dw-v12';
const ASSETS=['./','index.html','styles.css','core.js','planner.js','analysis.js','analysis-worker.js','detect.js','draw.js','app.js','sync.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin)return;   // let the browser handle it
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      // give the network ~4s, then fall back to the cached copy
      const res=await Promise.race([fetch(req,{cache:'no-cache'}),new Promise((_,no)=>setTimeout(()=>no(new Error('slow')),4000))]);
      if(res&&res.ok)cache.put(req,res.clone());
      return res;
    }catch(err){
      const hit=await cache.match(req,{ignoreSearch:true})||(req.mode==='navigate'&&await cache.match('index.html'));
      if(hit)return hit;
      throw err;
    }
  })());
});
