// Camouflage (2026-11-16, the owner's MultiCam pants were drawn plain: no band, motif or weave reading holds irregular blotches with no grid).
// core.js camoField: seamless, seeded, each colour exactly its share; camoPat: the pattern, or an own pattern named for it; detect.js: a
// reading on a camouflage is used, a camouflage with none gets its own colours (camoLook); draw.js fabricDef draws a camouflage tile;
// tagging.js camoFromPixels reads the colours and shares from a close-up; the painter's route and tile; the planner treats it as a bold,
// large pattern kept off formal days; the worker's /pattern answers a camouflage layout.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  // the worker: Claude names a camouflage layout but sends no colours object (2026-11-18: the schema's sixth optional object, camo, made
  // Claude's API refuse it as "compiled grammar too large" and every pattern reading failed); the answer is 422 and the app reads the
  // camouflage from the pixels (camoFromPixels). The schema sent keeps to five optional objects: tests stub Claude, so only this guards it
  const mod=await import(pathToFileURL(path.join(ROOT,'worker.js')).href),worker=mod.default,realFetch=globalThis.fetch;
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)},list:async()=>({keys:[],list_complete:true})};
  const env={APP_TOKEN:'owner',ANTHROPIC_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:{send:async()=>{}},RENDER_HUB:{idFromName:x=>x,get:()=>({fetch:async()=>new Response('{"ok":true}')})}};
  const answer={layout:'camouflage',across:null,along:null,motif:null,texture:null,stripeDirection:'vertical',repeatsInCloseup:3,repeatsAcrossItem:14,paneAspect:1,ignored:'folds',description:'MultiCam'};
  let sent=null;globalThis.fetch=async(h,init)=>{if(String(h)==='https://api.anthropic.com/v1/messages'){sent=JSON.parse(init.body);return new Response(JSON.stringify({model:'m',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(answer)}]}),{status:200,headers:{'content-type':'application/json'}})}return realFetch(h,init)};
  const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  let r;try{r=await worker.fetch(new Request('https://w.test/pattern',{method:'POST',headers:{'x-app-token':'owner','content-type':'application/json'},body:JSON.stringify({image:PNG,type:'pants'})}),env);r={s:r.status,...(await r.json())}}finally{globalThis.fetch=realFetch}
  const sch=sent&&sent.output_config&&sent.output_config.format&&sent.output_config.format.schema,opt=sch?Object.values(sch.properties).filter(p=>p.anyOf&&p.anyOf.some(x=>x.type==='object')).length:-1;
  ok(sch&&!sch.properties.camo&&sch.properties.layout.enum.includes('camouflage')&&opt<=5,'the /pattern schema names camouflage but has no camo object, and at most five optional objects (Claude’s API refused six:'+opt+')');
  ok(r.s===422&&r.layout==='camouflage','a camouflage answer is a 422 naming the layout, so the app reads it from the pixels ('+JSON.stringify(r).slice(0,120)+')');

  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    let e=await p.evaluate(()=>{const N=64,sh=[.4,.3,.2,.1],a=HOOK.camoField(N,sh,7),b=HOOK.camoField(N,sh,7),c=HOOK.camoField(N,sh,8),cnt=[0,0,0,0];for(const v of a)cnt[v]++;
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
        fab:fabricDef('t1',it,'bot','fig'),sw:swatchSVG(it,true),route:asmCmRoute(it,'trousers').how,tex:(t=>t&&[t.TW,t.TH,t.t.length].join())(HOOK.asmCamoTex(it)),
        read:(()=>{const r={...it,sett:{v:5,camo:{cols:['#111111','#eeeeee','#777777'],shares:[.5,.4,.1],seed:3},tr:4,cr:1,src:'pixels'}};const x=usableSett(r),tag=usableSett(it);
          return {ground:x.camo.cols[0]===colOf(it),fromTags:x.camo.cols.every(h=>tag.camo.cols.includes(h)),noPhoto:!x.camo.cols.includes('#111111'),seed:x.camo.seed,shares:x.camo.shares.join()!==tag.camo.shares.join(),light:Math.min(...x.camo.shares)<=.12+1e-9}})(),
        stripe:(()=>{const r={...it,pattern:'pinstripe',sett:{v:5,camo:{cols:['#111111','#eeeeee'],shares:[.6,.4],seed:3},tr:4,cr:1}};const x=usableSett(r);return !!(x&&x.camo)})()}});
    ok(e.pat==='true,true,false,false','camoPat: the pattern and an own pattern named for camouflage; not another own pattern or solid');
    ok(e.look&&e.own&&!e.chk,'a camouflage with no reading is drawn in its own colors (the tagged colour as the ground); an own pattern named MultiCam too');
    ok(e.read.ground&&e.read.fromTags&&e.read.noPhoto&&e.read.seed===3&&e.read.shares&&!e.stripe,'a reading sets only the shares and the seed: the colours stay the tagged ones, the main colour the ground ('+JSON.stringify(e.read)+'); a camouflage reading on another pattern is not used');
    ok(/<pattern id="t1"[^>]*>.*<image href="data:image\/png/.test(e.fab)&&/<svg/.test(e.sw),'fabricDef draws a camouflage tile (an image of its blotches); the swatch draws');
    ok(await p.evaluate(()=>asmCmRoute({id:'cs',type:'shirt',primaryColor:'khaki',secondaryColor:'brown',pattern:'camouflage'},'shirt').how)==='camo','a camouflage shirt is painted with the same blotches as camouflage pants (route camo)');
    ok(e.route==='camo'&&e.tex==='384,384,442368','the painter paints camouflage pants with its own tile ('+e.route+', '+e.tex+')');
    // v2: the tagged colours (a muted accent), soft edges and grain in the image the drawings and the painter share
    e=await p.evaluate(()=>{const it={id:'g1',type:'shirt',primaryColor:'brown',secondaryColor:'green',tertiaryColor:'none',pattern:'camouflage'},s=usableSett(it);
      const L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]),g=s.camo.cols.find(h=>L(h)[0]>30&&L(h)[2]<L(COLORS.brown)[2]&&L(h)[1]<0);
      const im=camoImage(64,['#000000','#ffffff'],[.5,.5],5);let mid=0;for(let j=0;j<im.length;j+=3)if(im[j]>40&&im[j]<215)mid++;
      return {muted:!!g&&C(L(g))<C(L(COLORS.green)),ground:s.camo.cols[0]===colOf(it),soft:mid/(64*64),len:im.length}});
    ok(e.ground&&e.muted,'a camouflage takes its tagged colours, the main as the ground, a bright accent muted toward it');
    ok(e.len===64*64*3&&e.soft>.03&&e.soft<.4,'camoImage softens the blotches\' edges (a blended band, not a cut-out: '+(e.soft*100).toFixed(1)+'% in between)');
    // the close-up reader: three coloured regions in known shares
    e=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=300;const x=c.getContext('2d');x.fillStyle='#c3b091';x.fillRect(0,0,300,300);
      x.fillStyle='#4f6b3a';x.fillRect(60,60,180,90);x.fillStyle='#3a2a24';x.fillRect(60,150,180,45);
      const s=HOOK.camoFromPixels({tex:c});return s&&{n:s.camo.cols.length,cols:s.camo.cols,shares:s.camo.shares,src:s.src}});
    ok(e&&e.n===3&&e.shares[0]>.45&&e.shares[1]>.25&&e.shares[2]>.12,'camoFromPixels finds the three colours and their shares, the largest first ('+JSON.stringify(e)+')');
    e=await p.evaluate(()=>{const a={type:'pants',primaryColor:'khaki',pattern:'camouflage'},jk={type:'suit',primaryColor:'olive',pattern:'camouflage'};return {pi:patInfo(a,'bot'),pis:patInfo({type:'shirt',pattern:'camouflage',primaryColor:'olive'},'shirt'),formal:formalTop(jk)<formalTop({...jk,pattern:'windowpane'}),pats:['suit','blazer','pants','shirt'].every(t=>PATS_BY[t].includes('camouflage'))&&!PATS_BY.tie.includes('camouflage')}});
    ok(e.pi&&e.pi.type==='camo'&&e.pi.scale===3&&e.pis.scale===3,'the planner counts camouflage as a bold, large pattern of its own kind');
    ok(e.formal,'a camouflage suit is kept off a formal day, further than a windowpane');
    ok(e.pats,'camouflage is a pattern of suits, blazers, pants and shirts');
    // a uniform (the owner, 2026-11-16: "the military requires you to wear both together"): a camouflage shirt and pants are one pattern
    e=await p.evaluate(()=>{const sh={id:'u1',type:'shirt',primaryColor:'khaki',secondaryColor:'brown',pattern:'camouflage'},pt={id:'u2',type:'pants',primaryColor:'khaki',secondaryColor:'olive',pattern:'camouflage'},
        wsh={id:'u3',type:'shirt',primaryColor:'white',pattern:'solid'},npt={id:'u4',type:'pants',primaryColor:'navy',pattern:'solid'},day={clim:{season:'mild',rain:false,cold:false},nojkt:true,hasLinks:false};
      const r=rateOutfit({top:null,bot:pt,shirt:sh,tie:null,shoes:null,suitDay:false});
      return {ps:patternScore([[null,'top'],[pt,'bot'],[sh,'shirt']]),hard:HOOK.clothesHard(null,pt,sh,null,false,day,()=>true),pat:(r.checks.find(c=>c.label==='Patterns')||{}).pts,same:!!r.checks.find(c=>/same color/.test(c.why||'')),
        together:clothesScore(null,pt,sh,null,false,day),split1:clothesScore(null,pt,wsh,null,false,day),split2:clothesScore(null,npt,sh,null,false,day),suit:clothesScore({id:'u5',type:'suit',primaryColor:'brown',pattern:'solid'},null,sh,null,true,day)-clothesScore({id:'u5',type:'suit',primaryColor:'brown',pattern:'solid'},null,wsh,null,true,day),
        three:HOOK.patsOf([[pt,'bot'],[sh,'shirt'],[{type:'tie',pattern:'stripe',primaryColor:'navy'},'tie']]).length}});
    ok(e.ps===0&&!e.hard&&(e.pat==null||e.pat===10)&&!e.same&&e.three===2,'a camouflage shirt with camouflage pants is one pattern, no clash or same-color mark ('+JSON.stringify(e)+')');
    ok(e.together>e.split1&&e.together>e.split2,'a camouflage shirt and pants are planned together: either with a plain piece scores lower');
    ok(e.suit<=-30,'a camouflage shirt under a plain suit costs the uniform split ('+e.suit+')');
    // the owner's camouflage shirt (2026-11-16): no photo, a close-up, no reading of its own: the item sheet opened on nothing (it described
    // i.sett), so it couldn't be opened or deleted
    e=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=240;const x=c.getContext('2d');x.fillStyle='#81613c';x.fillRect(0,0,240,240);x.fillStyle='#3f2600';x.fillRect(40,40,120,80);
      const sh={id:'cs1',type:'shirt',primaryColor:'brown',pattern:'camouflage',cuff:'button',added:1,texture:c.toDataURL('image/jpeg',.9)};items=[sh];await put(sh);cache={};show('wardrobe');openItem('cs1');await new Promise(r=>setTimeout(r,500));
      const v=document.querySelector('#item-view'),txt=v&&v.textContent||'';return {open:!!v&&!v.hidden&&/Delete/i.test(txt),says:/camouflage drawn in its own colors/.test(txt),sum:patSummary(sh),gen:settSummary(null)}});
    ok(e.open&&e.says,'a camouflage shirt with no reading opens, its Delete there, and says its camouflage is drawn in its own colors ('+e.sum+')');
    ok(e.gen==='generic','settSummary of no reading is "generic", never an error');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}};
