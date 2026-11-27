// A canvas the browser refuses, or one that dies.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/canvasrefuse.test.js ---- */
// An iPhone out of memory for pictures refuses new canvases (getContext gives null). A tester's very first item (2026-11-16, Chrome on an
// iPhone, a textured shirt with a close-up): the card's redraw stopped on the refused canvas and Confirm stayed switched off until
// "Bought, on the way" redrew the card. With canvases refused at any point of the photo, close-up and pattern reading: the card is drawn
// (plainly if need be), Confirm is on, and it saves in rotation; the textured swatch's tile is not cached while refused.
const canvasrefuse=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.route('**/wv.test/**',async r=>{const u=r.request().url();
      if(/\/pattern/.test(u))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({layout:'texture',across:null,along:null,motif:null,texture:{kind:'other',grid:['1010','0101','1010','0100'],aspect:1,ground:{name:'blue',hex:'#2a4a8a'},raised:{name:'blue',hex:'#3b5b9b'},contrast:'subtle'},stripeDirection:'vertical',repeatsInCloseup:20,repeatsAcrossItem:60,paneAspect:1,ignored:'',description:'a fine jersey knit',model:'m'})});
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'shirt',primaryColor:'blue',secondaryColor:'none',tertiaryColor:'none',pattern:'textured',confidence:{type:'high',primaryColor:'high',pattern:'medium'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,model:'m'})})});
    await p.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();window.__n=0;window.__at=1e9;
      HTMLCanvasElement.prototype.getContext=function(...a){if(seen.has(this))return g.apply(this,a);window.__n++;if(window.__n>=window.__at)return null;seen.add(this);return g.apply(this,a)};
      localStorage.setItem('worker_url','https://wv.test/');localStorage.setItem('app_token','tok')});
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const run=at=>p.evaluate(async at=>{queue.length=0;items.length=0;openAdd();window.__n=0;window.__at=1e9;
      const blob=async u=>(await fetch(u)).blob();
      window.__at=at;await addFiles([new File([await blob('tests/fixtures/suit-pinstripe.jpg')],'p.jpg',{type:'image/jpeg'})]);
      let t0=Date.now();while((!queue[0]||queue[0].busy)&&Date.now()-t0<15000)await new Promise(r=>setTimeout(r,50));
      const q=queue[0];if(!q)return {at,err:'no card'};
      if(TEXTURE_TYPES.includes(q.type)&&!q.err&&!needType(q))await addTexture(0,new File([await blob('tests/fixtures/blazer-windowpane-closeup.jpg')],'c.jpg',{type:'image/jpeg'}));
      t0=Date.now();while(Date.now()-t0<15000&&(q.refining||q.patternReading))await new Promise(r=>setTimeout(r,50));
      await new Promise(r=>setTimeout(r,150));
      const b=document.querySelector('#qconf-0'),state={at,off:b?b.disabled:'none',needType:needType(q),err:q.err||null};
      window.__at=1e9;state.saved=b&&!b.disabled?await save(q.id):null;state.rot=state.saved?!items[items.length-1].paused:null;return state},at);
    // canvases refused from the 1st up to the 40th new one: every point of the flow
    const bad=[];for(let at=1;at<=40;at++){const s=await run(at);if(s.needType||s.err)continue;   // (refused before the photo could be read: the card asks for the type, as when unread)
      if(s.off!==false||s.saved!==true||s.rot!==true)bad.push(s)}
    ok(!bad.length,'with canvases refused at any point, the card is drawn, Confirm is on and it saves in rotation ('+JSON.stringify(bad.slice(0,3))+')');
    // the textured swatch's tile: refused, nothing is cached; allowed again, it is drawn
    const t=await p.evaluate(()=>{HOOK.TEX_TILES.clear();window.__n=0;window.__at=1;const a=HOOK.texTileUrl(['10','01'],'#000000','#ffffff'),b=HOOK.texTileSmooth(['10','01'],'#000000','#ffffff'),n=HOOK.TEX_TILES.size;window.__at=1e9;const c=HOOK.texTileUrl(['10','01'],'#000000','#ffffff');return {a,b,n,c:!!c}});
    ok(t.a===null&&t.b===null&&t.n===0&&t.c,'a swatch tile with no canvas is null and not cached; with one again it is drawn');
    ok(await p.evaluate(()=>{const q={id:'z',type:'shirt'};return /couldn’t be drawn/.test(cardSafe(q,0,()=>{throw new Error('x')}))&&/qconf-0/.test(cardSafe(q,0,()=>{throw new Error('x')}))}),'a card that throws while drawn becomes a plain card with Confirm');
    ok(!errs.length,'no uncaught errors ('+errs.slice(0,3).join(' | ')+')');
  }finally{await browser.close()}};

/* ---- was tests/deadcanvas.test.js ---- */
// A browser whose graphics have failed draws every picture pure black (2026-11-15, the owner's desktop browser: a zoom & crop came out
// black and a suit's swatch was saved black). Crop, rotate, replace, the swatch and the small copy refuse a picture drawn pure black and
// keep what the item had; a dark but real photo (black cloth) still saves.
const deadcanvas=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const mk=(w,h,draw)=>p.evaluate(([w,h,draw])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');new Function('x','w','h',draw)(x,w,h);return c.toDataURL('image/png')},[w,h,draw]);
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    const photo=await mk(600,800,"x.fillStyle='#8a6';x.fillRect(0,0,w,h);x.fillStyle='#246';x.fillRect(0,0,w/2,h/2)");
    const tex=await mk(400,400,"for(let y=0;y<h;y+=4)for(let X=0;X<w;X+=4){x.fillStyle=((X+y)/4)%2?'#654':'#432';x.fillRect(X,y,4,4)}");
    // a dark but real picture: near-black cloth with texture up to about 20
    const dark=await mk(300,300,"for(let y=0;y<h;y+=3)for(let X=0;X<w;X+=3){const v=4+((X*7+y*13)%17);x.fillStyle=`rgb(${v},${v},${v+2})`;x.fillRect(X,y,3,3)}");
    await p.evaluate(([ph,tx])=>{HOOK.items=[{id:'s1',type:'suit',primaryColor:'brown',pattern:'solid',added:1,photo:ph,texture:tx},{id:'t1',type:'tie',primaryColor:'navy',pattern:'solid',added:2},{id:'h1',type:'shirt',primaryColor:'white',pattern:'solid',added:3}];
      settings.workdays=[0,1,2,3,4];settings.planRules=PLAN_RULES;HOOK.dayRecs={};HOOK.cache={};HOOK.flt='all'},[photo,tex]);
    await p.evaluate(async()=>{const it=items[0];await refreshSwatch(it);await makeSmall(it);await put(it);HOOK.editing='s1';show('wardrobe')});
    const keep=await p.evaluate(()=>({photo:items[0].photo,swatch:items[0].swatch,sm:items[0].photoSm}));
    ok(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');x.fillStyle='#345';x.fillRect(0,0,8,8);
      const b=document.createElement('canvas');b.width=b.height=8;const y=b.getContext('2d');y.fillStyle='#000';y.fillRect(0,0,8,8);return !deadCanvas(c)&&deadCanvas(b)}),'a colored picture is not taken for a dead one; a pure black one is');
    ok(await p.evaluate(async d=>!(await deadPic(d)),dark),'a dark but real photo (black cloth, texture up to about 20) is not taken for a dead one');

    // the graphics fail: every drawImage paints black
    await p.evaluate(()=>{window._di=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(){this.fillStyle='#000';this.fillRect(0,0,this.canvas.width,this.canvas.height)}});
    await p.click('.phtools .pt-crop');await p.waitForSelector('#cropbox');await p.waitForTimeout(100);
    await p.click('.cropwrap >> text=Apply');await p.waitForFunction(()=>!document.querySelector('#cropbox'));await p.waitForTimeout(300);
    let now=await p.evaluate(()=>({photo:items[0].photo,toast:document.querySelector('#toast').textContent}));
    ok(now.photo===keep.photo&&/stopped drawing pictures/.test(now.toast),'a crop drawn black is not saved: the photo stays and the toast says to reload ('+now.toast.slice(0,60)+')');
    await p.click('.phtools .pt-rotate');await p.waitForTimeout(400);
    ok(await p.evaluate(k=>items[0].photo===k,keep.photo),'a rotation drawn black is not saved');
    const sw=await p.evaluate(async()=>{const it=items[0];it.texture=it.texture+'';await refreshSwatch(it);return it.swatch});
    ok(sw===keep.swatch,'a swatch cut black keeps the swatch the item had');
    const sm=await p.evaluate(async()=>{const it={...items[0],phSig:'old'};const r=await makeSmall(it);return {r,sm:it.photoSm}});
    ok(sm.r===false&&sm.sm===keep.sm,'a small copy drawn black is not made: the old one stays');
    const q=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;const q={texCanvas:c,swatch:'kept',primaryColor:'navy',zoom:1,cx:.5,cy:.5};generateSwatch(q);return q.swatch});
    ok(q==='kept','an Add card keeps its swatch when the new cut comes out black');

    // the graphics work again: the crop saves
    await p.evaluate(()=>{CanvasRenderingContext2D.prototype.drawImage=window._di});
    await p.click('.phtools .pt-crop');await p.waitForSelector('#cropbox');await p.waitForTimeout(100);
    await p.click('.cropwrap >> text=Apply');await p.waitForFunction(k=>!document.querySelector('#cropbox')&&items[0].photo!==k,keep.photo);
    ok(await p.evaluate(async()=>!(await deadPic(items[0].photo))),'with working graphics the crop saves as before');
    ok(!errs.length,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['canvasrefuse',canvasrefuse],['deadcanvas',deadcanvas]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
