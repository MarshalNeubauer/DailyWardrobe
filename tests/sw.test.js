// Service worker: works offline after the first visit, and picks up changed files on the next load.
const http=require('http'),fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,ROOT})=>{
  let marker='';const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'};
  const srv=http.createServer((q,r)=>{let u=q.url.split('?')[0];if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
    fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}
      if(u==='/index.html'&&marker)d=Buffer.from(String(d).replace('<h1>Daily Wardrobe</h1>',`<h1>Daily Wardrobe ${marker}</h1>`));
      r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream','cache-control':'max-age=600'});r.end(d)})});
  await new Promise(r=>srv.listen(0,r));const url=`http://127.0.0.1:${srv.address().port}/`;
  const browser=await chromium.launch();const ctx=await browser.newContext();const page=await ctx.newPage();
  await page.goto(url);await page.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller,null,{timeout:10000}).catch(()=>{});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:5000}).catch(()=>{});
  ok(await page.evaluate(()=>!!navigator.serviceWorker.controller),'service worker controls the page');
  // update: the server now serves a changed page; despite max-age=600 the next load shows it
  marker='v2';await page.reload();await page.waitForFunction(()=>/v2/.test((document.querySelector('h1')||{}).textContent),null,{timeout:5000}).catch(()=>{});
  ok((await page.textContent('h1')).includes('v2'),'changed files show up on the next load (no ?v= needed)');
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
  await browser.close();srv.close();
};
