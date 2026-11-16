// An iPhone out of memory for pictures refuses new canvases (getContext gives null). A tester's very first item (2026-11-16, Chrome on an
// iPhone, a textured shirt with a close-up): the card's redraw stopped on the refused canvas and Confirm stayed switched off until
// "Bought, on the way" redrew the card. With canvases refused at any point of the photo, close-up and pattern reading: the card is drawn
// (plainly if need be), Confirm is on, and it saves in rotation; the textured swatch's tile is not cached while refused.
module.exports=async({ok,chromium,url})=>{
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
    const t=await p.evaluate(()=>{TEX_TILES.clear();window.__n=0;window.__at=1;const a=texTileUrl(['10','01'],'#000000','#ffffff'),b=texTileSmooth(['10','01'],'#000000','#ffffff'),n=TEX_TILES.size;window.__at=1e9;const c=texTileUrl(['10','01'],'#000000','#ffffff');return {a,b,n,c:!!c}});
    ok(t.a===null&&t.b===null&&t.n===0&&t.c,'a swatch tile with no canvas is null and not cached; with one again it is drawn');
    ok(await p.evaluate(()=>{const q={id:'z',type:'shirt'};return /couldn’t be drawn/.test(cardSafe(q,0,()=>{throw new Error('x')}))&&/qconf-0/.test(cardSafe(q,0,()=>{throw new Error('x')}))}),'a card that throws while drawn becomes a plain card with Confirm');
    ok(!errs.length,'no uncaught errors ('+errs.slice(0,3).join(' | ')+')');
  }finally{await browser.close()}};
