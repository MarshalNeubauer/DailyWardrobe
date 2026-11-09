// Item pictures (product photos of shoes, belts, socks for the tiles under the figure, made by OpenAI image generation
// through the worker, mocked) and the one-row day actions (worn toggle + formal toggle + reset icon).
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch;const gens=[];
  globalThis.fetch=async(href,init)=>{if(String(href)==='https://api.openai.com/v1/images/generations'){const b=JSON.parse(init.body);gens.push(b);
      return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})}
    return new Response('',{status:404})};
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)}};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV},HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    // worker
    const r=await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({mode:'item',item:'a pair of black calf leather cap-toe oxford dress shoes',key:'c0123456789abcdef'})}),env);
    const j=await r.json();
    ok(r.status===200&&j.image.startsWith('data:image/jpeg;base64,')&&store.has('render:c0123456789abcdef'),'the worker makes an item picture and keeps it under its key');
    ok(gens[0]&&gens[0].model==='gpt-image-2'&&gens[0].size==='1024x1024'&&/Studio product photograph of a pair of black calf leather cap-toe oxford dress shoes/.test(gens[0].prompt)&&/No person/.test(gens[0].prompt),'it uses OpenAI image generation with a product-photo prompt (no person)');
    ok((await worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t'},body:JSON.stringify({mode:'item'})}),env)).status===400,'an empty description is refused');
    // app
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','oxblood',{leather:'cordovan',metal:'silver'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      settings.workdays=[0,1,2,3,4];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today')});
    const d=await p.evaluate(()=>({desc:items.filter(i=>ITEM_PIC_TYPES.includes(i.type)).map(itemDesc),same:itemKey(items[6])===itemKey(items[8]),diff:itemKey(items[4])!==itemKey(items[5]),missing:missingItemPics().length,
      drawn:document.querySelectorAll('.below .tile .item-pic').length}));
    ok(/oxblood cordovan leather cap-toe oxford/.test(d.desc[1])&&/black calf leather dress belt.*silver buckle/.test(d.desc[2])&&/charcoal fine ribbed over-the-calf dress socks/.test(d.desc[5]),'each item is described from its tags (colour, leather, buckle metal)');
    ok(d.same&&d.diff&&d.missing===5,'identical items share a picture (5 distinct of 6)');
    ok(d.drawn===0,'without pictures the tiles keep their drawings');
    await p.evaluate(()=>openSettings());
    ok(/^Generate 5 item pictures$/.test(await p.textContent('#itempic-btn')),'Settings offers to generate the missing item pictures');
    await p.click('#itempic-btn');await p.waitForFunction(()=>!itemBatch,null,{timeout:20000});
    const after=await p.evaluate(()=>{closeSettings();renderToday();return {left:missingItemPics().length,status:$('#itempic-status').textContent,
      tiles:[...document.querySelectorAll('.below .tile')].map(t=>!!t.querySelector('img.item-pic')),piece:(pickPiece('shoes'),!!document.querySelector('#piece .item-pic'))}});
    ok(gens.length===6&&after.left===0&&/Done: 5 pictures ready/.test(after.status),'five pictures generated, nothing left');
    ok(after.tiles.length>=3&&after.tiles.every(Boolean)&&after.piece,'belt, shoes and socks tiles (and the piece card) now show the pictures');
    // another device fetches them instead of generating
    const p2=await ctx.newPage();await p2.goto(url);await p2.waitForFunction(()=>window.appReady);
    const fetched=await p2.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      for(const x of Object.keys(renders))delete renders[x];for(const x of [...renderTried])renderTried.delete(x);
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today');
      await new Promise(r=>setTimeout(r,800));return document.querySelectorAll('.below .tile img.item-pic').length});
    ok(fetched===3&&gens.length===6,'another device shows the pictures from the worker without generating again');
    // day actions: one row
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});
    const row=await p.evaluate(()=>{const r=document.querySelector('.dayact'),kids=[...r.children],tops=new Set(kids.map(k=>(b=>Math.round((b.top+b.bottom)/2))(k.getBoundingClientRect())));
      return {kids:kids.map(k=>k.className),oneRow:tops.size===1,seg:[...r.querySelectorAll('.seg button')].map(b=>b.textContent+':'+b.getAttribute('aria-pressed')).join(),formal:r.querySelector('.tog')}});
    ok(row.oneRow&&row.kids.join()==='seg','Today has the worn toggle only');
    ok(row.seg==='✓ Worn:false,Not worn:false'&&row.formal===null,'worn is a two-way toggle; no Formal button on Today');
    await p.click('.seg button >> nth=0');await p.waitForFunction(()=>planFor()[key(sel)].worn===true&&document.querySelector('.seg button').getAttribute('aria-pressed')==='true');
    ok(await p.evaluate(()=>document.querySelector('.seg button').getAttribute('aria-pressed')==='true'),'tapping Wore this marks it');
    await p.click('.seg button >> nth=0');await p.waitForFunction(()=>planFor()[key(sel)].worn===undefined);
    ok(true,'tapping it again clears it');
    await p.evaluate(()=>{sel=new Date(2026,10,10);renderToday()});
    await p.evaluate(()=>setFormal(true));await p.waitForFunction(()=>planFor()[key(sel)].formal===true);
    await p.evaluate(()=>swapSlot('shoes'));await p.waitForFunction(()=>planFor()[key(sel)].overrides);
    const r2=await p.evaluate(()=>{const r=document.querySelector('.dayact'),tops=new Set([...r.children].map(k=>(b=>Math.round((b.top+b.bottom)/2))(k.getBoundingClientRect())));return {kids:[...r.children].map(k=>k.className).join(),one:tops.size===1,label:r.querySelector('.ftag').textContent}});
    ok(r2.kids==='ftag,reset'&&r2.one&&r2.label==='Formal day','a future formal day: a Formal day tag and the reset icon after a swap, same row');
    await p.click('[aria-label="Reset changes"]');await p.waitForFunction(()=>!planFor()[key(sel)].overrides);
    ok(await p.evaluate(()=>!document.querySelector('.dayact .reset')),'reset clears the changes and the icon goes away');
    // today with a change: worn toggle, Formal and the reset icon fit one row even on narrow phones
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});await p.evaluate(()=>swapSlot('shoes'));await p.waitForFunction(()=>planFor()[key(sel)].overrides&&document.querySelector('.dayact .reset'));
    await p.evaluate(()=>setFormal(true));await p.waitForFunction(()=>planFor()[key(sel)].formal);await p.evaluate(()=>swapSlot('shoes'));await p.waitForFunction(()=>document.querySelector('.dayact .reset')&&document.querySelector('.dayact .ftag'));
    for(const [w,fs] of [[320,16],[360,16],[390,16]]){await p.setViewportSize({width:w,height:900});
      const f=await p.evaluate(fs=>{document.body.style.fontSize=fs+'px';const r=document.querySelector('.dayact'),kids=[...r.children],btns=[...r.querySelectorAll('button')];
        const mids=new Set(kids.map(k=>{const b=k.getBoundingClientRect();return Math.round((b.top+b.bottom)/2)}));
        const out=Math.max(...kids.map(k=>k.getBoundingClientRect().right))<=r.getBoundingClientRect().right+0.5;
        const clipped=btns.filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent);document.body.style.fontSize='';
        return {kids:kids.map(k=>k.className.split(' ')[0]).join(),one:mids.size===1,out,clipped}},fs);
      ok(f.kids==='seg,ftag,reset'&&f.one&&f.out&&!f.clipped.length,`${w}px wide: the day buttons and reset icon share one row, nothing cut off (${JSON.stringify(f)})`)}
    await p.setViewportSize({width:390,height:900});
    // three tiles on a suit day span the column like the score card; pictures keep their size, the tile takes the photo's backdrop
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});await p.waitForFunction(()=>document.querySelectorAll('.below .tile.has-pic').length===3);
    const lay=await p.evaluate(()=>{const b=document.querySelector('.below').getBoundingClientRect(),sc=document.querySelector('.score').getBoundingClientRect(),t=[...document.querySelectorAll('.below .tile')],im=t.map(x=>x.querySelector('img').getBoundingClientRect());
      return {n:t.length,left:Math.round(b.left-sc.left),right:Math.round(b.right-sc.right),tileW:Math.round(t[0].getBoundingClientRect().width),imgW:Math.round(im[0].width),square:Math.abs(im[0].width-im[0].height)<1,
        expect:Math.round((b.width-24)/4-8),bg:t[0].style.background,centred:Math.abs((im[0].left+im[0].right)/2-(t[0].getBoundingClientRect().left+t[0].getBoundingClientRect().right)/2)<1}});
    ok(lay.n===3&&lay.left===0&&lay.right===0&&lay.imgW>=lay.tileW,`the three tiles fill the score card's width (${JSON.stringify(lay)})`);
    ok(lay.square&&lay.imgW>lay.expect*1.3&&lay.centred,'pictures fill their tile (square, not stretched, centred), much larger than four to a row');
    ok(/^rgb\(/.test(lay.bg),'the tile around a picture is filled with the photo\'s backdrop colour');
    // WebKit can read blank (transparent) pixels: the tile must keep the light default, never turn black
    const blank=await p.evaluate(async()=>{const real=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h){return new ImageData(w,h)};
      for(const k in picBgs)delete picBgs[k];renderToday();await new Promise(r=>setTimeout(r,300));
      const bgs=[...document.querySelectorAll('.below .tile.has-pic')].map(t=>getComputedStyle(t).backgroundColor);CanvasRenderingContext2D.prototype.getImageData=real;return bgs});
    ok(blank.length===3&&blank.every(c=>c==='rgb(220, 215, 210)'),`a blank canvas reading keeps the light backdrop (${blank.join(' / ')})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
