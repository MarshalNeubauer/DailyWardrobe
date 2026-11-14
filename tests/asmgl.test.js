// The graphics chip's painter (asm-gl.js, 2026-11-14): every look it covers is painted both ways in this Chromium (WebGL2 on SwiftShader)
// and the two pictures must agree, largest difference at most 2 levels a channel and mean under 0.1; the looks it doesn't cover, a page
// with no WebGL2 and a lost context are painted on the CPU; the real worker paints a covered look on its graphics chip; the switch and
// the page's routing. Fixtures: the suit master at 512 (tests/fixtures/cm/suit), a stand-in background, and for some looks stand-in
// solved cloth positions (asmGeoPrep's maps, made here from the master's own parts).
// LOOKS is the table later stages add rows to: a look's jacket, shirt and tie, whether it has solved positions, and whether the graphics
// chip paints it (gl) or must leave it to the CPU (why: the reason asmGlWhy gives).
const fs=require('fs'),path=require('path');
// readings (sett) as Claude gives them: the owner's navy pinstripe (tests/asm2048.test.js), a khaki windowpane (its white-blue-white line
// group both ways; no linen in its description), a charcoal pinstripe whose description says herringbone (asmClothOf: the grain's columns)
const PIN={v:2,a:0,bands:[['#2b365a',.94],['#a3aecb',.06]],cross:null,cr:7,tr:40,src:'claude+pixels'};
const WPB=[['#baa98e',.905],['#e0d9c9',.02],['#baa98e',.015],['#97b0c5',.025],['#baa98e',.015],['#e0d9c9',.02]];
const WP={v:2,a:0,bands:WPB,cross:{d:90,bands:WPB.map((b,k)=>[k===0||k===2||k===4?null:b[0],b[1]]),r:1.05},cr:3.8,tr:11,src:'claude+pixels'};
const HBP={v:2,a:0,bands:[['#3b3d42',.47],['#b8b8b4',.06],['#3b3d42',.47]],cross:null,cr:6,tr:30,src:'claude+pixels'};
const LOOKS=[
  {name:'plain navy',top:['suit','navy'],shirt:'pink',tie:'burgundy',gl:true},
  {name:'plain mid grey',top:['suit','midgrey'],shirt:'white',tie:'navy',gl:true},
  {name:'plain black (full look)',top:['suit','black'],shirt:'white',tie:'black',gl:true},
  {name:'plain light grey blazer, solved positions',top:['blazer','lightgrey'],shirt:'lightblue',tie:'burgundy',geo:true,gl:true},
  {name:'twill charcoal',top:['suit','charcoal',{pattern:'twill'}],shirt:'pink',tie:'burgundy',gl:true},
  {name:'twill navy, solved positions',top:['suit','navy',{pattern:'twill'}],shirt:'white',tie:'burgundy',geo:true,gl:true},
  {name:'twill tan and brown',top:['suit','tan',{pattern:'twill',secondaryColor:'brown'}],shirt:'pink',tie:'navy',gl:true},
  {name:'twill light grey, solved positions',top:['suit','lightgrey',{pattern:'twill'}],shirt:'white',tie:'wine',geo:true,gl:true},
  // stage 2: jackets read in bands (asmSuitTex), with the stripe breakup (T.k: kept as they were), the look or the folds' lighting (checks)
  // (has: what the jacket's cloth must be, so a row can't quietly turn into a plain one: the band tile, the stripe breakup, the grain)
  {name:'navy pinstripe',top:['suit','navy',{pattern:'pinstripe',sett:PIN}],shirt:'white',tie:'burgundy',gl:true,has:'tile,k'},
  {name:'navy pinstripe, solved positions',top:['suit','navy',{pattern:'pinstripe',sett:PIN}],shirt:'lightblue',tie:'wine',geo:true,gl:true,has:'tile,k'},
  {name:'grey chalk stripe on twill',top:['suit','grey',{pattern:'chalk-stripe',patternText:'chalk stripe on a twill',sett:{v:2,a:0,bands:[['#55585e',.9],['#d6d4cc',.1]],cross:null,cr:5,tr:22,src:'claude+pixels'}}],shirt:'white',tie:'navy',gl:true,has:'tile,k,twill'},
  {name:'khaki windowpane',top:['blazer','khaki',{pattern:'windowpane',sett:WP}],shirt:'lightblue',tie:'navy',gl:true,has:'tile'},
  {name:'khaki windowpane, solved positions',top:['blazer','khaki',{pattern:'windowpane',sett:WP}],shirt:'white',tie:'burgundy',geo:true,gl:true,has:'tile'},
  // (the owner's khaki windowpane reads as "a slubby linen-blend ground": the linen texture, asmLinenTile, faded at its texels' edges)
  {name:'khaki linen windowpane',top:['blazer','khaki',{pattern:'windowpane',patternText:'a slubby linen-blend ground',sett:WP}],shirt:'lightblue',tie:'navy',gl:true,has:'tile,linen'},
  {name:'khaki linen windowpane, solved positions',top:['blazer','khaki',{pattern:'windowpane',material:'linen',sett:WP}],shirt:'white',tie:'navy',geo:true,gl:true,has:'tile,linen'},
  {name:'two-colour check (dark: the full look)',top:['blazer','navy',{pattern:'check',sett:{v:2,a:0,bands:[['#1b2333',.5],['#3a4a63',.5]],cross:{d:90,bands:[['#1b2333',.5],['#3a4a63',.5]],r:1},cr:3,tr:14,src:'claude+pixels'}}],shirt:'white',tie:'burgundy',gl:true,has:'tile'},
  {name:'charcoal pinstripe on herringbone',top:['suit','charcoal',{pattern:'pinstripe',patternText:'pinstripe on a herringbone',sett:HBP}],shirt:'pink',tie:'navy',gl:true,has:'tile,k,herringbone-cols'},
  {name:'charcoal pinstripe on herringbone, solved positions',top:['suit','charcoal',{pattern:'pinstripe',patternText:'pinstripe on a herringbone',sett:HBP}],shirt:'white',tie:'burgundy',geo:true,gl:true,has:'tile,k,herringbone-cols'},
  // not covered yet: the CPU paints them (stage 3 onwards moves rows up)
  {name:'herringbone',top:['suit','midgrey',{pattern:'herringbone'}],shirt:'white',tie:'burgundy',gl:false,why:/herringbone/},
  {name:'gingham shirt',top:['suit','navy'],shirt:['lightblue',{pattern:'gingham'}],tie:'burgundy',gl:false,why:/patterned shirt/},
].filter(L=>!process.env.ASMGL_ONLY||new RegExp(process.env.ASMGL_ONLY).test(L.name));
// (ASMGL_SIZE=2048 paints the looks at a phone's size, the fixtures enlarged: the spot check; ASMGL_ONLY=<regexp> picks rows by name)
const SIZE=+process.env.ASMGL_SIZE||512;
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/',FIX=path.join(__dirname,'fixtures','cm','suit');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});
      if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const recs={};for(const f of fs.readdirSync(FIX)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');
      recs[n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64'),model:'colormaster',t:1000}}
    const keys=await p.evaluate(ns=>Object.fromEntries(ns.map(n=>[n,asmCmKey('suit',n)])),Object.keys(recs));
    for(const [n,r] of Object.entries(recs))served[keys[n]]=r;
    // the master, a stand-in background (a cream wall, a window, a desk and laptop, fixed noise, blurred), the jobs and the stand-in maps
    const setup=await p.evaluate(async([h,LOOKS,SIZE])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=SIZE;asmAheadSoon=()=>{};asmAhead=async()=>{};
      if(!await asmCmGet('suit'))return {err:'no master'};
      const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');let g=x.createLinearGradient(0,0,512,0);g.addColorStop(0,'#efe9df');g.addColorStop(1,'#d9d1c4');x.fillStyle=g;x.fillRect(0,0,512,512);
      x.fillStyle='#fbf8f2';x.fillRect(20,45,125,280);x.fillStyle='#7a5c40';x.fillRect(300,380,212,20);x.fillStyle='#2b2d31';x.fillRect(380,320,95,60);
      const id=x.getImageData(0,0,512,512);let s=7;for(let k=0;k<id.data.length;k+=4){s=(Math.imul(s,1103515245)+12345)>>>0;const v=(s/4294967296-.5)*6;id.data[k]+=v;id.data[k+1]+=v;id.data[k+2]+=v}x.putImageData(id,0,0);
      const b=document.createElement('canvas');b.width=b.height=512;const bx=b.getContext('2d');bx.filter='blur(3px)';bx.drawImage(c,0,0);
      renders[asmCmBgKey()]={img:b.toDataURL('image/png'),t:4242,sig:'asm/cm-bg test'};
      let n=0;const I=(type,c,x={})=>({id:type+(n++),type,primaryColor:c,pattern:'solid',...x}),watch=I('watch','silver',{metal:'silver'});items=[watch];
      window.__jobs=[];for(const L of LOOKS){const top=I(L.top[0],L.top[1],L.top[2]||{}),sh=Array.isArray(L.shirt)?I('shirt',L.shirt[0],L.shirt[1]):I('shirt',L.shirt),tie=I('tie',L.tie);items.push(top,sh,tie);
        const j=await asmCmJob({top,shirt:sh,tie,watch});j.diskCache=false;__jobs.push(j)}
      // stand-in solved positions at the maps' 2048: the body piece 1, sleeve parts 10+, lapels 40+ (from the master's own parts at 512), each
      // position a smooth bend of the picture's, encoded as asmGeoPrep reads them
      const hit=await asmCmSetup(__jobs[0]),P=hit.P,G=ASM_GEO_PX,f=G/P.S;
      const enc=fn=>{const cv=document.createElement('canvas');cv.width=cv.height=G;const cx=cv.getContext('2d'),d=cx.createImageData(G,G);
        for(let Y=0;Y<G;Y++)for(let X=0;X<G;X++){const k=Math.floor(Y/f)*P.S+Math.floor(X/f),j=4*(Y*G+X),si=P.geo.seg[k],gs=P.geo.segs[si];
          const r=!P.A.jacket[k]?0:!si?1:gs&&gs.parts?10+2*si:40+si,v=r?Math.round((fn(X,Y,r)+1024)*16):0;d.data[j]=v>>8;d.data[j+1]=v&255;d.data[j+2]=r;d.data[j+3]=255}
        cx.putImageData(d,0,0);return cv.toDataURL('image/png')};
      const geo={geoU:enc((X,Y,r)=>X*1.03+8*Math.sin(Y/150)+r),geoV:enc((X,Y,r)=>Y*.97+5*Math.sin(X/210)-r),gt:'77.78'};
      LOOKS.forEach((L,i)=>{if(L.geo)Object.assign(__jobs[i],geo)});
      // the picture as asmCmBuild hands it to its JPEG encoder (raw pixels, not the JPEG)
      window.__cap=null;asmJpeg=async img=>{__cap=new Uint8ClampedArray(img.data);return 'data:image/jpeg;base64,'};
      window.__paint=async(i,gl)=>{const j={...__jobs[i],gl};const r=await asmCmBuild(j);return {r,px:__cap}};
      // the creased sleeves (the tube path's choice of upper arm or forearm, asmTubePartQ, in whole numbers on both painters): how many
      // quarter-pixel points the float rule (asmTubePart) would put in the other part
      const cr=P.geo.segs.filter(g=>g&&g.crease);let pts=0,moved=0;
      for(const g of cr)for(let k=0;k<P.N;k+=7){if(!P.A.jacket[k]||P.geo.segs[P.geo.seg[k]]!==g)continue;const X=k%P.S+.25,Y=(k-k%P.S)/P.S+.75;pts++;if(asmTubePartQ(g,X,Y)!==asmTubePart(g,X,Y))moved++}
      return {renderer:(()=>{const G2=asmGlInit(SIZE);return G2?G2.renderer:null})(),bg:!!__jobs[0].bg,crease:cr.length,pts,moved}},[HOST,LOOKS,SIZE]);
    ok(!setup.err&&setup.bg,`the suit master, its masks and a background are on the page (${setup.err||'ok'})`);
    ok(!!setup.renderer,`WebGL2 here: ${setup.renderer}`);
    ok(setup.crease>=1&&setup.pts>100&&setup.moved<=setup.pts/1000,`the master has a creased sleeve (${setup.crease}), whose part the whole-number rule chooses as the float rule did (${setup.moved} of ${setup.pts} points moved)`);
    // every look, both ways
    for(let i=0;i<LOOKS.length;i++){const L=LOOKS[i];
      const r=await p.evaluate(async i=>{const c=await __paint(i,false),why=asmGlWhy(__jobs[i],(await asmCmSetup(__jobs[i])).P),g=await __paint(i,true);
        const a=c.px,b=g.px,N=a.length/4;let mx=0,sum=0,over=0;for(let k=0;k<N;k++){let m=0;for(let q=0;q<3;q++){const d=Math.abs(a[4*k+q]-b[4*k+q]);sum+=d;if(d>m)m=d}if(m>mx)mx=m;if(m>2)over++}
        const T=__jobs[i].cloth.jacket.suit,C=T&&T.cloth,has=!T?'':[T.TW>1||T.TH>1?'tile':'',T.k!=null?'k':'',C?C.kind+(C.cw?'-cols':''):''].filter(Boolean).join(',');
        return {cpu:c.r.gl,gl:g.r.gl,why,max:mx,mean:sum/(3*N),over,cms:c.r.ms,gms:g.r.ms,has}},i);
      if(L.has)ok(r.has===L.has,`${L.name}: the cloth is what the row means (${r.has}, wanted ${L.has})`);
      if(L.gl){ok(r.cpu===false&&r.gl===true,`${L.name}: the graphics chip paints it (switch on), the CPU with the switch off (${r.why||'covered'})`);
        ok(r.max<=2&&r.mean<.1,`${L.name}: GL and CPU agree (largest difference ${r.max}, mean ${r.mean.toFixed(4)}, pixels over 2: ${r.over}; CPU ${r.cms} ms, GL ${r.gms} ms at ${SIZE})`)}
      else ok(r.gl===false&&L.why.test(r.why)&&r.max===0,`${L.name}: not covered (${r.why}): painted on the CPU either way, the same picture`)}
    // fallbacks: no WebGL2 at all, then a lost context, then the retry
    const fb=await p.evaluate(async()=>{const i=0,out={};
      const oc=OffscreenCanvas.prototype.getContext,hc=HTMLCanvasElement.prototype.getContext;
      OffscreenCanvas.prototype.getContext=function(t,...a){return t==='webgl2'?null:oc.call(this,t,...a)};HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:hc.call(this,t,...a)};
      asmGlReset();out.none=(await __paint(i,true)).r.gl;out.probe=asmGlProbe();out.onPage=asmGlOnPage(__jobs[i],{ok:true,gl:false});
      OffscreenCanvas.prototype.getContext=oc;HTMLCanvasElement.prototype.getContext=hc;asmGlReset();
      out.back=(await __paint(i,true)).r.gl;
      asmGlState.gl.getExtension('WEBGL_lose_context').loseContext();await new Promise(r=>setTimeout(r,50));
      const lost=await __paint(i,true);out.lost=lost.r.gl;out.lostPx=!!lost.px&&lost.px.some(v=>v>0);out.waiting=asmGlRetry>Date.now();
      asmGlRetry=0;out.again=(await __paint(i,true)).r.gl;return out});
    ok(fb.none===false&&fb.probe===false&&fb.onPage===false,`no WebGL2: painted on the CPU, and the page doesn't take the look either (${JSON.stringify(fb)})`);
    ok(fb.back===true,'WebGL2 back: the graphics chip paints again');
    ok(fb.lost===false&&fb.lostPx&&fb.waiting,'a lost context: that look is painted on the CPU (a whole picture), and the graphics chip waits ASM_GL_RETRY_MS');
    ok(fb.again===true,'after the wait a new context paints on the graphics chip again');
    // the routing: the job carries this phone's switch; the page paints a covered look only when the worker has no WebGL2; the real worker
    const rt=await p.evaluate(async()=>{const it=items,o={top:it[1],shirt:it[2],tie:it[3],watch:it[0]},out={};
      out.on=(await asmCmJob(o)).gl;localStorage.setItem('asm_gl','0');out.off=(await asmCmJob(o)).gl;localStorage.removeItem('asm_gl');
      const cov=__jobs[0],unc=__jobs[__jobs.length-1];
      out.page=[asmGlOnPage(cov,{ok:true,gl:false}),asmGlOnPage(cov,{ok:true,gl:true}),asmGlOnPage(unc,{ok:true,gl:false}),asmGlOnPage({...cov,gl:false},{ok:true,gl:false})];
      const w=new Worker('asm-worker.js');const next=()=>new Promise(r=>{w.onmessage=e=>r(e.data)});
      const ready=await next();const {geoU,geoV,...job}=cov;w.postMessage({id:1,job:{...job,gl:true}});const res=await next();w.terminate();
      out.ready=ready;out.res={gl:res.res&&res.res.gl,url:!!(res.res&&res.res.url&&res.res.url.startsWith('data:image/jpeg')),err:res.error||null,ms:res.res&&res.res.ms};return out});
    ok(rt.on===true&&rt.off===false,'the job carries the switch (localStorage asm_gl \'0\' = off on this phone)');
    ok(rt.page.join()==='true,false,false,false',`the page paints a look itself only when it is covered, the switch is on and the worker has no WebGL2 (${rt.page})`);
    ok(rt.ready.ready===true&&rt.ready.gl===true&&rt.res.gl===true&&rt.res.url,`the app's worker says it has WebGL2 and paints a covered look on the graphics chip (${JSON.stringify(rt.res)})`);
    // Settings: the owner's switch
    const ui=await p.evaluate(()=>{const b=document.createElement('div');document.body.appendChild(b);asmGlNote({gl:true,ms:91});asmGlUI(b);const s=document.getElementById('cfg-gl'),out={v:s.value,txt:document.getElementById('gl-status').textContent};
      s.value='off';s.dispatchEvent(new Event('change'));out.ls=localStorage.getItem('asm_gl');out.txt2=document.getElementById('gl-status').textContent;asmGlSet('on');out.ls2=localStorage.getItem('asm_gl');b.remove();return out});
    ok(ui.v==='on'&&/graphics chip, 91 ms/.test(ui.txt)&&ui.ls==='0'&&/Off on this phone/.test(ui.txt2)&&ui.ls2===null,`Settings → Outfit pictures → Advanced: "Graphics-chip painting" on by default, off kept in localStorage, the last picture's way shown (${ui.txt.slice(-60)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it runs the colour-coded painter (assemble.js, asm-color.js, asm-gl.js)
