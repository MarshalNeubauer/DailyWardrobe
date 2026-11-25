// Item pictures.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),{pathToFileURL}=require('url');

/* ---- was tests/itempics.test.js ---- */
// Item pictures (product photos of shoes, belts, socks for the tiles under the figure, made by OpenAI image generation
// through the worker, mocked) and the one-row day actions (worn toggle + formal toggle + reset icon).
const itempics=async({ok,chromium,url,ROOT})=>{
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
    // the worker answers no /sync: the items below are set in memory only, and a sync merges in what is saved, so the start-up
    // sync (300 ms after the database opens) or one scheduled by a day record saved while Today draws emptied them on a busy
    // machine; this test is about item pictures (sync.test.js covers syncing, and a sync with Settings open, which used to close
    // it and time out the click on #itempic-btn below)
    await ctx.route(HOST+'**',async route=>{const q=route.request();if(new URL(q.url()).pathname==='/sync')return route.fulfill({status:503,body:'sync is off in this test'});const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','oxblood',{leather:'cordovan',metal:'silver'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      settings.workdays=[0,1,2,3,4];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today')});
    const d=await p.evaluate(()=>({desc:items.filter(i=>HOOK.ITEM_PIC_TYPES.includes(i.type)).map(HOOK.itemDesc),same:itemKey(items[6])===itemKey(items[8]),diff:itemKey(items[4])!==itemKey(items[5]),missing:HOOK.missingItemPics().length,
      drawn:document.querySelectorAll('.below .tile .item-pic').length}));
    ok(/oxblood cordovan leather cap-toe oxford/.test(d.desc[1])&&/black calf leather dress belt.*silver buckle/.test(d.desc[2])&&/single charcoal fine-knit mid-calf dress sock in side profile/.test(d.desc[5]),'each item is described from its tags (colour, leather, buckle metal)');
    ok(d.same&&d.diff&&d.missing===5,'identical items share a picture (5 distinct of 6)');
    ok(d.drawn===0,'without pictures the tiles keep their drawings');
    await p.evaluate(()=>openSettings('photos'));
    ok(/^Generate 5 item pictures$/.test(await p.textContent('#itempic-btn')),'Settings offers to generate the missing item pictures');
    await p.click('#itempic-btn');await p.click('#ask-ok');await p.waitForFunction(()=>!HOOK.itemBatch&&!HOOK.missingItemPics().length,null,{timeout:20000}).catch(()=>{});
    const after=await p.evaluate(()=>{closeSettings();renderToday();return {left:HOOK.missingItemPics().length,status:$('#itempic-status').textContent,
      tiles:[...document.querySelectorAll('.below .tile')].map(t=>!!t.querySelector('img.item-pic')),piece:(HOOK.pickPiece('shoes'),!!document.querySelector('#bbox.open .rpic'))}});
    ok(gens.length===6&&after.left===0&&/Done: 5 pictures ready/.test(after.status),'five pictures generated, nothing left');
    ok(after.tiles.length>=3&&after.tiles.every(Boolean)&&after.piece,'belt, shoes and socks tiles now show the pictures, and a tapped tile unfolds its picture');
    // another device fetches them instead of generating
    await p.evaluate(()=>localStorage.setItem('last_sync',Date.now()+864e5));   // no background sync when the first page becomes visible again
    const p2=await ctx.newPage();await p2.goto(url);await p2.waitForFunction(()=>window.appReady);
    const fetched=await p2.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      for(const x of Object.keys(renders))delete renders[x];for(const x of [...HOOK.renderTried])HOOK.renderTried.delete(x);
      settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today');
      const n=()=>document.querySelectorAll('.below .tile img.item-pic').length;await new Promise(r=>setTimeout(r,800));
      for(let k=0;k<80&&n()<3;k++)await new Promise(r=>setTimeout(r,50));return n()});   // (longer on a busy machine, where the three downloads can take more than 0.8 s)
    ok(fetched===3&&gens.length===6,'another device shows the pictures from the worker without generating again');
    // day actions: one row (set the first page up again: a second page in the same context can make it reload via the service worker)
    await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      if(!items.some(i=>i.id==='shoes5'))items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','oxblood',{leather:'cordovan',metal:'silver'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      settings.workdays=[0,1,2,3,4];TODAY_OVERRIDE='2026-11-09T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=false;show('today')});
    const row=await p.evaluate(()=>({dayact:!!document.querySelector('.dayact'),pill:(document.querySelector('#wpill')||{}).textContent,formal:!!document.querySelector('.tog')}));
    ok(!row.dayact&&row.pill==='✓ Wore'&&!row.formal,`worn is the date bar's pill (${row.pill}); no other day buttons on a plain day`);
    await p.click('#wpill');await p.waitForFunction(()=>planFor()[key(sel)].worn===false);
    ok(await p.evaluate(()=>document.querySelector('#wpill').textContent==="✕ Didn't"),'tapping it marks it not worn');
    await p.click('#wpill');await p.waitForFunction(()=>planFor()[key(sel)].worn===undefined);
    ok(true,'tapping it again goes back to worn');
    await p.evaluate(()=>{sel=new Date(2026,10,10);renderToday()});
    await p.evaluate(()=>HOOK.setFormal(true));await p.waitForFunction(()=>planFor()[key(sel)].formal===true);
    await p.evaluate(()=>HOOK.swapSlot('shoes'));await p.waitForFunction(()=>planFor()[key(sel)].overrides);
    const r2=await p.evaluate(()=>{const r=document.querySelector('.dayact'),tops=new Set([...r.children].map(k=>(b=>Math.round((b.top+b.bottom)/2))(k.getBoundingClientRect())));return {kids:[...r.children].map(k=>k.className).join(),one:tops.size===1,label:r.querySelector('.ftag').textContent}});
    const rc=await p.evaluate(()=>{const b=document.querySelector('#rbox'),m=document.querySelector('#mbox');return {after:!!b&&!!m&&b.previousElementSibling===m,h:b&&Math.round(b.getBoundingClientRect().height),w:b&&Math.round(b.getBoundingClientRect().width),mw:m&&Math.round(m.getBoundingClientRect().width),text:b&&b.textContent.trim()}});
    ok(r2.kids==='ftag'&&r2.label==='Formal day'&&rc.after&&rc.h>=76&&rc.w===rc.mw&&/Reset/.test(rc.text),`after a swap, a Reset card under the month, the size of the other cards (${JSON.stringify(rc)}); the Formal day tag stays in its row`);
    await p.click('[aria-label="Reset changes"]');await p.waitForFunction(()=>!planFor()[key(sel)].overrides&&!document.querySelector('#rbox'),null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>!document.querySelector('#rbox')),'Reset clears the changes and the card goes away');
    // today with a change: worn toggle, Formal and the reset icon fit one row even on narrow phones
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});await p.evaluate(()=>HOOK.swapSlot('shoes'));await p.waitForFunction(()=>planFor()[key(sel)].overrides&&document.querySelector('#rbox'));
    await p.evaluate(()=>HOOK.setFormal(true));await p.waitForFunction(()=>planFor()[key(sel)].formal);await p.evaluate(()=>HOOK.swapSlot('shoes'));await p.waitForFunction(()=>document.querySelector('#rbox')&&document.querySelector('.dayact .ftag'));
    for(const [w,fs] of [[320,16],[360,16],[390,16]]){await p.setViewportSize({width:w,height:900});
      const f=await p.evaluate(fs=>{document.body.style.fontSize=fs+'px';const r=document.querySelector('.dayact'),kids=[...r.children],btns=[...r.querySelectorAll('button')];
        const mids=new Set(kids.map(k=>{const b=k.getBoundingClientRect();return Math.round((b.top+b.bottom)/2)}));
        const out=Math.max(...kids.map(k=>k.getBoundingClientRect().right))<=r.getBoundingClientRect().right+0.5;
        const clipped=btns.filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent);document.body.style.fontSize='';
        return {kids:kids.map(k=>k.className.split(' ')[0]).join(),one:mids.size===1,out,clipped}},fs);
      ok(f.kids==='ftag'&&f.one&&f.out&&!f.clipped.length,`${w}px wide: the day's row fits, nothing cut off (${JSON.stringify(f)})`)}
    await p.setViewportSize({width:390,height:900});
    // three tiles on a suit day span the column like the score card; pictures keep their size, the tile takes the photo's backdrop
    await p.evaluate(()=>{sel=new Date(2026,10,9);renderToday()});await p.waitForFunction(()=>document.querySelectorAll('.below .tile.has-pic').length===3);
    const lay=await p.evaluate(()=>{const b=document.querySelector('.below').getBoundingClientRect(),sc=document.querySelector('.score').getBoundingClientRect(),t=[...document.querySelectorAll('.below .tile')],im=t.map(x=>x.querySelector('img').getBoundingClientRect());
      return {n:t.length,left:Math.round(b.left-sc.left),right:Math.round(b.right-sc.right),tileW:Math.round(t[0].getBoundingClientRect().width),imgW:Math.round(im[0].width),square:Math.abs(im[0].width/im[0].height-4/3)<.02,fit:getComputedStyle(t[0].querySelector('img')).objectFit,
        expect:Math.round((b.width-24)/4-8),bg:t[0].style.background,centred:Math.abs((im[0].left+im[0].right)/2-(t[0].getBoundingClientRect().left+t[0].getBoundingClientRect().right)/2)<1}});
    ok(lay.n===3&&lay.left===0&&lay.right===0&&lay.imgW>=lay.tileW,`the three tiles fill the score card's width (${JSON.stringify(lay)})`);
    ok(lay.square&&lay.fit==='cover'&&lay.imgW>lay.expect*1.3&&lay.centred,'pictures fill their tile (a short 4:3 landscape crop, not stretched, centred), much larger than four to a row');
    ok(/^rgb\(/.test(lay.bg),'the tile around a picture is filled with the photo\'s backdrop colour');
    // WebKit can read blank (transparent) pixels: the tile must keep the light default, never turn black
    const blank=await p.evaluate(async()=>{const real=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h){return new ImageData(w,h)};
      for(const k in picBgs)delete picBgs[k];renderToday();await new Promise(r=>setTimeout(r,300));
      const bgs=[...document.querySelectorAll('.below .tile.has-pic')].map(t=>getComputedStyle(t).backgroundColor);CanvasRenderingContext2D.prototype.getImageData=real;return bgs});
    ok(blank.length===3&&blank.every(c=>c==='rgb(220, 215, 210)'),`a blank canvas reading keeps the light backdrop (${blank.join(' / ')})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};

/* ---- was tests/wardpic.test.js ---- */
// Wardrobe: shoes, belts and socks show their realistic product picture when there is one (fetched from the worker if this
// device does not have it yet); otherwise their photo or drawing. Other types are unchanged.
const wardpic=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PIC='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(pic=>{items=[{id:'s',type:'shoes',primaryColor:'black',pattern:'solid',leather:'calf',added:3},{id:'b',type:'belt',primaryColor:'brown',pattern:'solid',leather:'calf',metal:'silver',added:2},
        {id:'k',type:'socks',primaryColor:'navy',pattern:'solid',added:1},{id:'t',type:'tie',primaryColor:'navy',pattern:'solid',added:4}];
      renders[itemKey(items[0])]={sig:'item',img:pic};renders[itemKey(items[1])]={sig:'item',img:pic};HOOK.renderTried.add(itemKey(items[2]));
      flt='all';editing=null;show('wardrobe');const src=id=>{const im=document.querySelector(`#gi-${id} .giopen img.ph`);return im&&im.getAttribute('src')};
      const a={shoes:src('s'),belt:src('b'),socks:src('k'),tie:src('t'),sockDrawn:!!document.querySelector('#gi-k .thumb')};
      editing='s';renderWardrobe();a.open=!!document.querySelector('#item-view .pair img.ph')&&document.querySelector('#item-view .pair img.ph').getAttribute('src')===pic;HOOK.closeItem();return a},PIC);
    ok(r.shoes===PIC&&r.belt===PIC,'shoes and belts with a product picture show it in the Wardrobe');
    ok(!r.socks&&r.sockDrawn,'without a picture they keep their drawing');
    ok(!r.tie,'other types are unchanged');
    ok(r.open,'opened, the product picture sits beside the tagged swatch');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- a product picture arriving in the background (Round D, 2026-11-24: the review's R1 N1) ---- */
// The Wardrobe asks the server for a belt's picture; it lands a moment later. With Settings opened meanwhile, Settings stays open and the
// Wardrobe shows the picture once Settings closes; with the belt's sheet open, the sheet is not drawn again and the grid shows the picture
// once the sheet closes. (The server is a route: its list answers 404, so the picture is asked for by its key.)
const wardpicwait=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
  const PIC='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNgYGD4z0AswK4SAFXuAf8EPy+xAAAAAElFTkSuQmCC';
  const S={asked:0};
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});
  await ctx.route('https://w.test/**',async route=>{const u=route.request().url();
    if(/[?&]key=/.test(u)){S.asked++;await new Promise(r=>setTimeout(r,700));return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({img:PIC,t:1})})}
    return route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:''})});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const fresh=()=>p.evaluate(()=>{items=[{id:'b',type:'belt',primaryColor:'brown',pattern:'solid',leather:'calf',metal:'silver',added:2}];const k=itemKey(items[0]);delete renders[k];HOOK.renderTried.delete(k);flt='all';return k});
    const got=k=>p.waitForFunction(k=>!!renders[k],k,{timeout:10000}).then(()=>true,()=>false);
    const tile=()=>p.evaluate(()=>!!document.querySelector('#gi-b img.item-pic, #gi-b .giopen img.ph'));
    // Settings opened while the picture is on its way
    let k=await fresh();await p.evaluate(()=>{HOOK.closeItem();show('wardrobe');openSettings()});
    const before=await p.evaluate(()=>settingsOpen()),had=await got(k);await settle(p,300);
    const still=await p.evaluate(()=>settingsOpen());
    ok(had&&before&&still,`a product picture arriving while Settings is open leaves Settings open (open before ${before}, after ${still}, picture ${had})`);
    await p.evaluate(()=>closeSettings());await settle(p,300);
    ok(await tile(),'…and the Wardrobe shows the picture once Settings closes');
    // the belt's sheet open while the picture is on its way
    k=await fresh();await p.evaluate(()=>{show('wardrobe');openItem('b');document.querySelector('#ivbody').firstElementChild.dataset.mark='1'});
    const had2=await got(k);await settle(p,300);
    const kept=await p.evaluate(()=>!!document.querySelector('#ivbody [data-mark="1"]')&&editing==='b');
    ok(had2&&kept,`a product picture arriving while the item's sheet is open doesn't draw the sheet again (picture ${had2}, sheet as it was ${kept})`);
    await p.evaluate(()=>HOOK.closeItem());await settle(p,600);
    ok(await tile(),'…and the Wardrobe shows the picture once the sheet closes');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['itempics',itempics],['wardpic',wardpic],['wardpicwait',wardpicwait]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
