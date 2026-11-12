// Pasted photos, photo links (direct, and through the worker's /fetch for sites without CORS and shop pages), drag & drop.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC','base64');
  // the outside web as the worker sees it
  const web={'https://shop.test/product/42':{type:'text/html',body:'<html><head><meta property="og:image" content="/img/tie.png?x=1&amp;y=2"></head></html>'},
    'https://shop.test/img/tie.png?x=1&y=2':{type:'image/png',body:PNG},'https://nocors.test/a.png':{type:'image/png',body:PNG},
    'https://shop.test/plain':{type:'text/html',body:'<html>nothing</html>'},'https://shop.test/doc.pdf':{type:'application/pdf',body:'%PDF'}};
  const realFetch=globalThis.fetch;const seen=[];
  globalThis.fetch=async(href)=>{seen.push(String(href));const w=web[String(href)];return w?new Response(w.body,{status:200,headers:{'content-type':w.type}}):new Response('nope',{status:404})};
  let env={APP_TOKEN:'secret'};const HOST='https://wardrobevision.test/';
  const browser=await chromium.launch();
  try{
  const ctx=await browser.newContext();
  await ctx.route(HOST+'**',async route=>{const r=route.request();
    const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
    await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
  let directHits=0;
  await ctx.route('https://cors.test/**',r=>{directHits++;r.fulfill({status:200,headers:{'content-type':'image/png','access-control-allow-origin':'*'},body:PNG})});
  // a browser fetch blocked by CORS fails with a network error; route.fulfill would bypass the CORS check, so abort
  await ctx.route('https://nocors.test/**',r=>r.abort('failed'));
  await ctx.route('https://shop.test/**',r=>r.abort('failed'));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const photos=()=>p.evaluate(()=>queue.filter(q=>q.photo&&!q.busy).length);
  const settle=n=>p.waitForFunction(n=>queue.filter(q=>q.photo&&!q.busy).length>=n||document.querySelector('#paste-status').textContent.length>0&&!/Fetching/.test(document.querySelector('#paste-status').textContent),n,{timeout:8000}).catch(()=>{});
  const status=()=>p.textContent('#paste-status');

  // pasting an image (Ctrl+V) on another screen switches to Add and queues it
  await p.evaluate(()=>show('today'));
  await p.evaluate(b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),dt=new DataTransfer();dt.items.add(new File([bin],'shot.png',{type:'image/png'}));
    document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))},PNG.toString('base64'));
  await settle(1);
  ok(!(await p.evaluate(()=>$('#add').hidden))&&(await photos())===1,'a pasted image opens Add and is queued with its photo');
  ok(await p.isVisible('#photo-url'),'the Add screen has a box for pasting a photo or link');

  // a link to an image on a site that allows downloads is fetched directly (no worker needed)
  await p.fill('#photo-url','https://cors.test/shirt.png');await p.click('.paste-box >> text=Add');await settle(2);
  ok((await photos())===2&&directHits===1,'an image link from a CORS-enabled site is fetched directly');
  ok((await p.inputValue('#photo-url'))==='','the box clears after the photo is added');

  // a site without CORS and no worker configured: says what to do
  await p.fill('#photo-url','https://nocors.test/a.png');await p.press('#photo-url','Enter');await settle(9);
  ok(/Connect in/.test(await status())&&(await photos())===2,`without a worker, a blocked link explains the options ("${await status()}")`);

  // with the worker: blocked sites go through /fetch, shop pages give their og:image
  await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret');pasteMsg('')},HOST);
  await p.fill('#photo-url','https://nocors.test/a.png');await p.click('.paste-box >> text=Add');await settle(3);
  ok((await photos())===3&&seen.includes('https://nocors.test/a.png'),'a link from a site without CORS is fetched through the worker');
  await p.evaluate(()=>pasteMsg(''));
  // pasting a link while the Add screen is open adds it straight away
  await p.evaluate(()=>{const dt=new DataTransfer();dt.setData('text/plain','https://shop.test/product/42');document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});
  await settle(4);
  ok((await photos())===4&&seen.includes('https://shop.test/img/tie.png?x=1&y=2'),'a pasted shop product link adds the page\'s photo (og:image)');
  // errors from the worker are shown
  for(const [u,re,label] of [['https://shop.test/plain',/No photo found/,'a page with no photo'],['https://shop.test/doc.pdf',/not a photo/,'a link that is not an image']]){
    await p.evaluate(()=>pasteMsg(''));await p.fill('#photo-url',u);await p.click('.paste-box >> text=Add');await settle(99);
    ok(re.test(await status()),`${label} is reported ("${await status()}")`)}
  await p.evaluate(()=>pasteMsg(''));await p.fill('#photo-url','not a link');await p.click('.paste-box >> text=Add');
  ok(/doesn’t look like a link/.test(await status()),'text that isn\'t a link is rejected');
  // an old worker without /fetch: tells you to redeploy
  await p.evaluate(()=>pasteMsg(''));
  await ctx.route(HOST+'fetch**',r=>r.fulfill({status:405,contentType:'application/json',body:'{"error":"method not allowed"}'}));
  await p.fill('#photo-url','https://nocors.test/a.png');await p.click('.paste-box >> text=Add');await settle(99);
  ok(/needs an update/.test(await status()),'an old worker without photo links says to redeploy it');
  await ctx.unroute(HOST+'fetch**');

  // the Paste button reads the clipboard
  await p.evaluate(()=>{pasteMsg('');navigator.clipboard.read=async()=>[{types:['image/png'],getType:async()=>new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC'),c=>c.charCodeAt(0))],{type:'image/png'})}]});
  await p.click('.paste-box >> text=Paste');await settle(5);
  ok((await photos())===5,'the Paste button adds an image from the clipboard');
  await p.evaluate(()=>{navigator.clipboard.read=async()=>{throw new Error('denied')}});await p.click('.paste-box >> text=Paste');
  ok(/long-press/.test(await status()),'a denied clipboard explains how to paste by hand');

  // drag & drop a photo file onto the app
  await p.evaluate(b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),dt=new DataTransfer();dt.items.add(new File([bin],'drop.png',{type:'image/png'}));
    document.querySelector('#add').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}))},PNG.toString('base64'));
  await settle(6);
  ok((await photos())===6,'a photo dropped on the app is queued');
  // pasting text into another field is left alone
  await p.evaluate(()=>{openSettings('weather');const i=document.querySelector('#cfg-city')||document.querySelector('#settings-modal input[type=text]');const dt=new DataTransfer();dt.setData('text/plain','https://cors.test/x.png');
    window.__def=!i.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));closeSettings()});
  ok(!(await p.evaluate(()=>window.__def)),'pasting a link into another text field is not hijacked');
  // a queued pasted photo saves like an uploaded one
  const n0=await p.evaluate(()=>items.length);
  await p.evaluate(async()=>{const i=queue.findIndex(q=>q.photo&&!q.busy);await save(i)});
  ok((await p.evaluate(()=>items.length))===n0+1&&(await p.evaluate(()=>!!items[items.length-1].photo)),'a pasted photo saves to the wardrobe with its photo');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');

  // worker /fetch guards
  const call=(q,h={})=>worker.fetch(new Request(HOST+'fetch'+q,{headers:h}),env);
  ok((await call('?url=https://nocors.test/a.png')).status===403,'worker /fetch refuses requests without the token');
  ok((await call('?url=file:///etc/passwd',{'x-app-token':'secret'})).status===400,'worker /fetch only accepts http(s)');
  env={};ok((await call('?url=https://nocors.test/a.png',{'x-app-token':'x'})).status===403,'worker /fetch is off when no APP_TOKEN is set');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
