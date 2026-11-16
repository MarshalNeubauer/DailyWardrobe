// Camouflage (2026-11-16, the owner's MultiCam pants were drawn plain: no band, motif or weave reading holds irregular blotches with no grid).
// core.js camoField: seamless, seeded, each colour exactly its share; camoPat: the pattern, or an own pattern named for it; detect.js: a
// reading on a camouflage is used, a camouflage with none gets its own colours (camoLook); draw.js fabricDef draws a camouflage tile;
// tagging.js camoFromPixels reads the colours and shares from a close-up; the painter's route and tile; the planner treats it as a bold,
// large pattern kept off formal days; the worker's /pattern answers a camouflage layout.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  // the worker: a camouflage answer is cleaned and kept
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default,realFetch=globalThis.fetch;
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},list:async()=>({keys:[],list_complete:true})};
  const env={APP_TOKEN:'owner',ANTHROPIC_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:{send:async()=>{}},RENDER_HUB:{idFromName:x=>x,get:()=>({fetch:async()=>new Response('{"ok":true}')})}};
  const answer={layout:'camouflage',across:null,along:null,motif:null,texture:null,camo:{colours:[{name:'khaki',hex:'#B8A47E',sharePct:40},{name:'sage',hex:'#7d8a68',sharePct:25},{name:'brown',hex:'#6b5444',sharePct:20},{name:'plum',hex:'#3d2c2a',sharePct:10},{name:'cream',hex:'#e6e1cf',sharePct:5},{name:'bad',hex:'nope',sharePct:3}],blobsAcrossItem:14},
    stripeDirection:'vertical',repeatsInCloseup:3,repeatsAcrossItem:14,paneAspect:1,ignored:'folds',description:'MultiCam'};
  globalThis.fetch=async(h,init)=>String(h)==='https://api.anthropic.com/v1/messages'?new Response(JSON.stringify({model:'m',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(answer)}]}),{status:200,headers:{'content-type':'application/json'}}):realFetch(h,init);
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  let r;try{r=await worker.fetch(new Request('https://w.test/pattern',{method:'POST',headers:{'x-app-token':'owner','content-type':'application/json'},body:JSON.stringify({image:PNG,type:'pants'})}),env);r={s:r.status,...(await r.json())}}finally{globalThis.fetch=realFetch}
  ok(r.s===200&&r.layout==='camouflage'&&r.camo&&r.camo.colours.length===5&&r.camo.colours[0].hex==='#b8a47e'&&Math.abs(r.camo.colours.reduce((a,c)=>a+c.share,0)-1)<.01&&r.camo.blobsAcrossItem===14&&!r.across,'the worker keeps a camouflage reading: valid colours only, shares as fractions, largest first ('+JSON.stringify(r).slice(0,160)+')');

  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    let e=await p.evaluate(()=>{const N=64,sh=[.4,.3,.2,.1],a=camoField(N,sh,7),b=camoField(N,sh,7),c=camoField(N,sh,8),cnt=[0,0,0,0];for(const v of a)cnt[v]++;
      // seamless: the colour across the right edge matches the left edge about as often as inside the tile
      let edge=0,inner=0;for(let y=0;y<N;y++){if(a[y*N+N-1]===a[y*N])edge++;if(a[y*N+N/2-1]===a[y*N+N/2])inner++}
      return {same:a===b||a.every((v,k)=>v===b[k]),diff:!a.every((v,k)=>v===c[k]),shares:cnt.map(n=>n/(N*N)),edge,inner}});
    ok(e.same&&e.diff,'camoField is the same for the same seed and different for another');
    ok(e.shares.every((s,k)=>Math.abs(s-[.4,.3,.2,.1][k])<.005),'each colour covers its share ('+e.shares.map(s=>s.toFixed(3)).join(', ')+')');
    ok(e.edge>=e.inner*.8,'the tile is seamless: the colours across its edge join as they do inside ('+e.edge+' / '+e.inner+')');
    e=await p.evaluate(()=>{applyCustom({patterns:[{key:'own-multicam-ocp',name:'Camouflage (OCP/MultiCam)',desc:'irregular blotches',base:'other',types:['pants']},{key:'own-micro-check',name:'micro check',base:'other',types:['pants']}]});
      const it={id:'cm1',type:'pants',primaryColor:'khaki',secondaryColor:'brown',tertiaryColor:'olive',pattern:'camouflage'},own={...it,id:'cm2',pattern:'own-multicam-ocp'},chk={...it,id:'cm3',pattern:'own-micro-check'};
      const s=usableSett(it),s2=usableSett(own);
      return {pat:[camoPat('camouflage'),camoPat('own-multicam-ocp'),camoPat('own-micro-check'),camoPat('solid')].join(),look:!!(s&&s.camo&&s.camo.cols.length===5&&s.camo.cols[0]===colOf(it)),own:!!(s2&&s2.camo),chk:!!(usableSett(chk)&&usableSett(chk).camo),
        fab:fabricDef('t1',it,'bot','fig'),sw:swatchSVG(it,true),route:asmCmRoute(it,'trousers').how,tex:(t=>t&&[t.TW,t.TH,t.t.length].join())(asmCamoTex(it)),
        read:(()=>{const r={...it,sett:{v:5,camo:{cols:['#111111','#eeeeee'],shares:[.6,.4],seed:3},tr:4,cr:1}};const x=usableSett(r);return x.camo.cols.join()})(),
        stripe:(()=>{const r={...it,pattern:'pinstripe',sett:{v:5,camo:{cols:['#111111','#eeeeee'],shares:[.6,.4],seed:3},tr:4,cr:1}};const x=usableSett(r);return !!(x&&x.camo)})()}});
    ok(e.pat==='true,true,false,false','camoPat: the pattern and an own pattern named for camouflage; not another own pattern or solid');
    ok(e.look&&e.own&&!e.chk,'a camouflage with no reading is drawn in its own colors (the tagged colour as the ground); an own pattern named MultiCam too');
    ok(e.read==='#111111,#eeeeee'&&!e.stripe,'its own reading wins; a camouflage reading on another pattern is not used');
    ok(/<pattern id="t1"[^>]*>.*<image href="data:image\/png/.test(e.fab)&&/<svg/.test(e.sw),'fabricDef draws a camouflage tile (an image of its blotches); the swatch draws');
    ok(e.route==='camo'&&e.tex==='256,256,196608','the painter paints camouflage pants with its own tile ('+e.route+', '+e.tex+')');
    // the close-up reader: three coloured regions in known shares
    e=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=300;const x=c.getContext('2d');x.fillStyle='#c3b091';x.fillRect(0,0,300,300);
      x.fillStyle='#4f6b3a';x.fillRect(60,60,180,90);x.fillStyle='#3a2a24';x.fillRect(60,150,180,45);
      const s=camoFromPixels({tex:c});return s&&{n:s.camo.cols.length,cols:s.camo.cols,shares:s.camo.shares,src:s.src}});
    ok(e&&e.n===3&&e.shares[0]>.45&&e.shares[1]>.25&&e.shares[2]>.12,'camoFromPixels finds the three colours and their shares, the largest first ('+JSON.stringify(e)+')');
    e=await p.evaluate(()=>{const a={type:'pants',primaryColor:'khaki',pattern:'camouflage'},jk={type:'suit',primaryColor:'olive',pattern:'camouflage'};return {pi:patInfo(a,'bot'),pis:patInfo({type:'shirt',pattern:'camouflage',primaryColor:'olive'},'shirt'),formal:formalTop(jk)<formalTop({...jk,pattern:'windowpane'}),pats:['suit','blazer','pants','shirt'].every(t=>PATS_BY[t].includes('camouflage'))&&!PATS_BY.tie.includes('camouflage')}});
    ok(e.pi&&e.pi.type==='camo'&&e.pi.scale===3&&e.pis.scale===3,'the planner counts camouflage as a bold, large pattern of its own kind');
    ok(e.formal,'a camouflage suit is kept off a formal day, further than a windowpane');
    ok(e.pats,'camouflage is a pattern of suits, blazers, pants and shirts');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}};
