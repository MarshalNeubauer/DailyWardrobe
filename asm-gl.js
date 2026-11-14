/* Daily Wardrobe: the colour-coded painter's per-look pass (asmCmBuild, asm-color.js) on the graphics chip, WebGL2 (2026-11-14: the owner
   approved the port after an iPhone benchmark, lab/gl-bench.html: about 90 ms a look against 0.45-1.5 s for the CPU painter at 2048).
   Loaded after asm-color.js on the page and in asm-worker.js. asmCmBuild calls asmGlTry first; it paints the look here when
   asmGlCovers(job, P) says the look is covered and WebGL2 works, else returns null and the CPU painter paints it as before.

   Covered (stage 1; later stages extend asmGlWhy, the one coverage rule, and the shader):
     - the suit master ('suit') with the cloth look and lighting on (job.look !== false), a background picture (job.bg), at a phone's
       size or smaller (job.size <= ASM_SIZE; since stage 6 up to ASM_GL_MAX, the computer's 2880 pre-build on its graphics card)
     - the jacket a solid colour, or a plain one- or two-colour twill (asmTwillTex: not herringbone, linen or tweed); dark cloths take the
       full look (ASM_CM_LOOK), lighter ones the folds' lighting, as on the CPU
     - (stage 2) a jacket read in bands (asmSuitTex: pinstripes, chalk stripes, windowpanes, checks in one or two colours): its tile uploaded
       as a texture and read at four points a pixel as asmCmAt does; a stripe's breakup (T.k, faded between stripes like asmCellV), its
       softness and minimum widths (already in the tile), its steeper shading on a dark ground, and no look or lighting (kept as it was);
       the twill or herringbone grain under it (asmClothOf, the herringbone's columns faded at their edges). Not linen (stage 3)
     - (stage 3) every other jacket cloth on the suit master: the standalone herringbone (asmTwillTex with yarn, floats, grain cells,
       mottle and the column break, each faded at its rib's and column's edge as on the CPU), tweed (asmTweedTile as an RG32F texture,
       sampled upright, its Donegal fleck in the second colour) and the small woven figures (asmMicroTex: the thread grid as uniforms,
       4x4 points a pixel, each crossing faded at its edge as asmCellT does)
     - (stage 4) the tie and the shirt read from their tiles (asmTieFor's bands, motifs, weaves, knit and paisley; asmCmTile's stripes,
       checks, motifs, woven and herringbone shirts): the tie at four points a pixel turned by its lean (a quarter turn more in the knot) or
       on its solved pieces 80/81; the shirt at its solved front (2) and cuffs (60..79), else upright or turned in a cuff (P.cuffAng), 3x3
       points a pixel when woven (tile.fine); the tiles stacked in one texture (asmGlAtlas); the clip and buttons drawn after read-back
     - the shirt and tie solid colours; skin, watch and the dark zone (the half-hidden button drawn as a horn button) as on the CPU
     - the background picture darkened by the figure's shadow and dithered; the lighting (ASM_CM_LIGHT)
     - the jacket's cloth positions as on the CPU (uvAt): the master's solved positions (job.geoU/geoV, asmGeoPrep: the body's through the
       stripe flow, sleeve parts and lapels as they are) where it has them, else the sleeves' tubes, the lapels' axes, the body's flow
   Random cloth details go through the same 32-bit integer hash and faded cells as the CPU (asmH32, asmCellV in asm-color.js), so the two
   pictures agree within 2 levels (tests/asmgl.test.js). The picture's key is the CPU's: the same look and code whichever painted it.

   The master-only arrays (shares, light, contact shadows, rim, sleeve cells, the kept zones' colours) are packed once per master on the
   CPU (asmGlPack) and uploaded as textures (asmGlUpload); each look sets a few uniforms, draws one full-screen triangle and reads the
   picture back. A lost context (webglcontextlost) paints on the CPU and tries the graphics chip again after ASM_GL_RETRY_MS. */
const ASM_GL_SEGS=7;   // body + two sleeves + two lapels (and room)
const ASM_GL_TILE=4096;   // a band tile larger than this either way stays on the CPU (asmSuitTex's are about 256 across)
const ASM_GL_CUFFS=15;   // (stage 4) turned shirt parts (P.cuffAng not 0) the shader takes: their index in the lighting texture's high byte
/* (stage 4) the master's turned shirt parts (asmCmPrep's P.cuff / P.cuffAng: a cuff's weave runs along the arm): each part's index into a
   short table of the turned ones (0 = upright: the front, a small part, no part) and the table's cos and sin, worked out here in float64 */
function asmGlCuffs(P){const ix=new Uint8Array(256),cs=[1,0];let n=0;if(P.cuff)P.cuffAng.forEach((a,i)=>{if(a&&i<255){n++;if(n<=ASM_GL_CUFFS){ix[i]=n;cs.push(Math.cos(a),Math.sin(a))}}});return {ix,cs,n}}
/* (stage 6) the largest picture painted on the chip: the PC's pre-build paints at 2880 (ASM_CM_SIZE, scaled to 2048 after, as on the CPU)
   on the graphics card, one context, inside tools/gpu-guard.js; about 440 MB of textures there (twice 2048's, the solved positions as
   floats); a chip whose MAX_TEXTURE_SIZE is under the size has no context (asmGlContext) and the CPU paints */
const ASM_GL_MAX=2880;
let asmGlNot='';   // (stage 6) why the last asmGlTry returned null ('' after a picture): the worker adds it to a CPU picture (glWhy) for the builder's log
const ASM_GL_RETRY_MS=60e3;  // after a lost context, the CPU paints this long before the graphics chip is tried again
const ASM_GL='asm_gl';   // localStorage: '0' = this phone paints every picture on the processor (Settings → Outfit pictures → Advanced)
const asmGlPref=()=>{try{return localStorage.getItem(ASM_GL)!=='0'}catch{return true}};
let asmGlState=null,asmGlNone=false,asmGlEver=false,asmGlRetry=0,asmGlPageOk=null,asmGlLast=null;
/* ---- coverage: the one rule for which looks the graphics chip paints ('' = covered, else why not). Without P only the job is looked at
   (the page's routing, before any setup); with the master's setup P its geometry and lighting too */
function asmGlWhy(job,P){if(!job||job.cm!=='suit')return 'master '+(job&&job.cm);if(job.look===false)return 'cloth look off';
  if(!(job.size<=ASM_GL_MAX))return 'larger than the graphics chip paints';if(!job.bg)return 'no background picture';
  const cl=job.cloth||{};for(const z of ['jacket','tie','shirt'])if(!cl[z])return 'no '+z;
  // (stage 4) a tie read from a tile (asmTieFor: bands, motifs, weaves; knit, paisley) and a shirt drawn from one (asmCmTile: stripes,
  // checks, motifs, woven and herringbone shirts) are covered; a tie or shirt painted any other way (no route gives one today) is not
  const ti=cl.tie,sh=cl.shirt;if(ti.tile||ti.suit)return 'patterned tie';if(sh.suit||sh.tie)return 'patterned shirt';
  const tileOk=(t,c)=>!!(t&&c&&t.TW>=1&&t.TH>=1&&c.length>=3*t.TW*t.TH&&t.TW<=ASM_GL_TILE&&t.TH<=ASM_GL_TILE);
  if(ti.tie&&!tileOk(ti.tie,ti.tie.c))return 'tie tile missing or too large';
  if(sh.tile&&(!tileOk(sh.tile,sh.tile.t||sh.tile.c)||!(sh.tile.mm>0)))return 'shirt tile missing, too large or without its size';
  const j=cl.jacket;if(j.tile||j.tie)return 'jacket drawn from a tile';
  // the jacket's, tie's and shirt's tiles share one texture, stacked (asmGlAtlas)
  if((j.suit&&(j.suit.TH||0)>1?j.suit.TH:0)+(ti.tie?ti.tie.TH:0)+(sh.tile?sh.tile.TH:0)>ASM_GL_TILE)return 'tiles too large together';
  if(j.suit){const T=j.suit,C=T.cloth,t=T.t||T.c;
    // (stage 2) a band tile (asmSuitTex: stripes, checks, windowpanes, one or two colours) with or without the stripe breakup (T.k), on
    // no grain, the linen texture (asmLinenTile: a linen windowpane), or a plain twill or herringbone grain (asmClothOf: no yarn, floats,
    // grain cells, mottle or breaks: those are stage 3's)
    // (stage 3) the standalone herringbone (asmTwillTex: yarn, floats, grain cells, mottle, the column break), tweed (asmTweedTile, its
    // Donegal fleck) and the small woven figures (asmMicroTex: houndstooth, sharkskin, birdseye, nailhead, a thread grid of at most 8x8)
    // are covered; a herringbone's soft column edge (ASM_HB_SOFT, 0 today) is not
    if(T.wv&&!(T.wv.N>=1&&T.wv.N<=8&&T.wv.g&&T.wv.g.length>=T.wv.N*T.wv.N))return 'jacket small figure grid too large';
    if(!t||!(T.TW>=1&&T.TH>=1)||t.length<3*T.TW*T.TH)return 'jacket cloth without its tile';
    if(T.TW>ASM_GL_TILE||T.TH>ASM_GL_TILE)return 'jacket tile too large';
    if(C&&!T.linen&&((C.kind!=='twill'&&C.kind!=='herringbone')||C.soft))return 'jacket cloth '+(C.soft?'herringbone with soft column edges':C.kind||'other');
    if(T.k!=null&&!(T.g&&T.blen>0&&T.mm>0))return 'jacket stripe without its ground';
    if((T.TW>1||T.TH>1)&&!(T.mm>0))return 'jacket tile without its size'}
  if(!P)return '';
  if(!P.bgShadow)return 'no background shadow';if(!P.lx)return 'no lighting';
  if(P.cuff&&asmGlCuffs(P).n>ASM_GL_CUFFS)return 'too many turned cuffs';
  const g=P.geo;if(!g||g.gar!=='jacket')return 'no jacket geometry';if(g.segs.length>ASM_GL_SEGS)return 'too many parts';
  for(const s of g.segs)if(s.parts)for(const p of s.parts){if(p.poly)return 'polyline part';if(p.fd&&(p.fd.D.some(v=>v)||p.fd.G.some(v=>v)))return 'sleeve flow'}
  return ''}
const asmGlCovers=(job,P)=>!asmGlWhy(job,P);
/* ---- the context */
/* WebGL2 on an OffscreenCanvas (a Web Worker or the page), or on a page canvas; null where there is none */
function asmGlContext(S){
  let cv=null;try{cv=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(S,S):typeof document!=='undefined'?Object.assign(document.createElement('canvas'),{width:S,height:S}):null}catch{cv=null}
  if(!cv)return null;let gl=null;try{gl=cv.getContext('webgl2',{antialias:false,depth:false,stencil:false,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'})}catch{gl=null}
  if(!gl)return null;if(gl.getParameter(gl.MAX_TEXTURE_SIZE)<S)return null;
  // a lost context (the system took the graphics chip back, a phone under memory pressure): the CPU paints until the retry
  if(cv.addEventListener)cv.addEventListener('webglcontextlost',e=>{e.preventDefault();asmGlLost(gl)},false);
  return gl}
function asmGlLost(gl){if(asmGlState&&(!gl||asmGlState.gl===gl)){asmGlState=null;asmGlRetry=Date.now()+ASM_GL_RETRY_MS;console.warn('asm-gl: graphics context lost; painting on the processor for now')}}
/* whether WebGL2 works here (the worker's ready message; the page's own when the worker has none) */
function asmGlProbe(){try{const cv=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1,1):typeof document!=='undefined'?document.createElement('canvas'):null;const gl=cv&&cv.getContext('webgl2');
  if(!gl)return false;const x=gl.getExtension('WEBGL_lose_context');if(x)x.loseContext();return true}catch{return false}}
/* the page paints a covered look itself when the worker has no WebGL2 and the page has (asmRun, assemble.js) */
function asmGlOnPage(job,st){if(!job||!job.cm||!st||!st.ok||st.gl!==false||job.gl===false||!asmGlCovers(job))return false;
  if(asmGlPageOk===null)asmGlPageOk=asmGlProbe();return asmGlPageOk}
/* the GL state for a size (made once; null without WebGL2, after a lost context until the retry, or when the program won't build) */
function asmGlInit(S){const G=asmGlState;if(G&&G.S===S&&!G.gl.isContextLost())return G;if(asmGlNone||Date.now()<asmGlRetry)return null;
  if(G&&G.gl.isContextLost()){asmGlLost(G.gl);return null}   // (lost before its event arrived)
  const gl=asmGlContext(S);if(!gl){if(asmGlEver)asmGlRetry=Date.now()+ASM_GL_RETRY_MS;else asmGlNone=true;return null}
  try{asmGlState={gl,S,prog:asmGlProgram(gl),renderer:asmGlRenderer(gl)};asmGlEver=true}catch(e){console.warn('asm-gl',e);asmGlState=null;asmGlNone=true;return null}return asmGlState}
/* (tests) forget what was found out about WebGL2 here */
function asmGlReset(){asmGlState=null;asmGlNone=false;asmGlEver=false;asmGlRetry=0;asmGlPageOk=null}
/* the renderer's name (WEBGL_debug_renderer_info), for the bench and the tests */
function asmGlRenderer(gl){const x=gl.getExtension('WEBGL_debug_renderer_info');return x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL)+' / '+gl.getParameter(x.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.RENDERER)}
/* ---- the master-only part, packed for the GPU (once per master; CPU). Replays asmCmBuild's per-pixel rules for the kept zones (skin,
   watch, dark: the master's colour or its clean neighbours', the chroma wall, the button) into one colour + the button's weight, since
   none of it depends on the look */
function asmGlPack(P){const S=P.S,N=P.N,A=P.A,L=ASM_LIN,M=P.M,LX=P.lx,geo=P.geo,CLEAN=248,z8=new Uint8Array(N),z16=new Uint16Array(N);
  const sh=P.shade,a=new Uint8Array(4*N),s4=new Uint16Array(4*N),l1=new Uint16Array(4*N),l2=new Uint16Array(4*N);
  const ch=(dst,i,src)=>{if(!src)return;for(let k=0;k<N;k++)dst[4*k+i]=src[k]};
  ch(a,0,A.jacket||z8);ch(a,1,A.tie||z8);ch(a,2,A.background||z8);ch(a,3,A.shirt||z8);
  ch(s4,0,sh.jacket||z16);ch(s4,1,sh.tie||z16);ch(s4,2,sh.shirt||z16);ch(s4,3,P.bgShadow||z8);
  ch(l1,0,LX.smb.jacket||z16);ch(l1,1,LX.smb.shirt||z16);ch(l1,2,LX.ao.jacket||z16);ch(l1,3,LX.ao.shirt||z16);
  ch(l2,0,LX.ao.tie||z16);ch(l2,1,LX.aob||z16);ch(l2,2,LX.rim||z16);ch(l2,3,geo?geo.seg:z8);
  // (stage 4) the shirt part's turn (asmGlCuffs) in the part channel's high byte, beside the jacket part (under ASM_GL_SEGS) in its low one
  const cu=asmGlCuffs(P);if(P.cuff)for(let k=0;k<N;k++){const c=P.cuff[k];if(c<255&&cu.ix[c])l2[4*k+3]|=cu.ix[c]<<8}
  // the button pieces of the dark zone (asmCmBuild's BL/BT, as it is)
  let BL=null;const BT=[];if(A.dark){BL=new Int32Array(N).fill(-1);const st=[];
    for(let s0=0;s0<N;s0++){if(A.dark[s0]<=96||BL[s0]>=0)continue;const id=BT.length;let n=0,sx=0,sy=0,x0=1e9,x1=-1,y0=1e9,y1=-1;st.push(s0);BL[s0]=id;
      while(st.length){const q=st.pop(),x=q%S,y=(q-x)/S;n++;sx+=x;sy+=y;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        for(const nb of [q-1,q+1,q-S,q+S])if(nb>=0&&nb<N&&BL[nb]<0&&A.dark[nb]>96&&Math.abs(nb%S-x)<=1){BL[nb]=id;st.push(nb)}}
      BT.push(n>20&&x1-x0<160&&y1-y0<160?{cx:sx/n,cy:sy/n,R:Math.max(x1-x0,y1-y0)/2+2}:null)}
    for(let k=0;k<N;k++)if(A.dark[k]&&BL[k]<0){const x=k%S;for(let r=1;r<=3&&BL[k]<0;r++)for(const nb of [k-r,k+r,k-r*S,k+r*S])if(nb>=0&&nb<N&&BL[nb]>=0&&Math.abs(nb%S-x)<=r){BL[k]=BL[nb];break}}}
  const keep=new Float32Array(4*N),c=[0,0,0];
  for(const z of ['skin','watch','buckle','dark']){if(!A[z]||P.names.indexOf(z)<0)continue;const K=P.keep[z],I=K.I;let p=0;
    for(let k=0;k<N;k++){const a8=A[z][k];if(!a8)continue;const al=a8/255,x=k%S,y=(k-x)/S,j=4*k;while(p<I.length&&I[p]<k)p++;
      if(a8<CLEAN&&p<I.length&&I[p]===k){c[0]=K.C[3*p];c[1]=K.C[3*p+1];c[2]=K.C[3*p+2]}else{c[0]=L[M[j]];c[1]=L[M[j+1]];c[2]=L[M[j+2]]}
      if(z==='skin'&&c[2]>c[0]*.92)c[2]=c[0]*.92;if(c[1]>Math.max(c[0],c[2]))c[1]=Math.max(c[0],c[2]);
      const bt=z==='dark'&&BL&&BL[k]>=0?BT[BL[k]]:null;
      if(bt){const dx=(x+.5-bt.cx)/bt.R,dy=(y+.5-bt.cy)/bt.R,d=Math.hypot(dx,dy);let L0=.016+.05*Math.pow(Math.max(0,1-Math.hypot(dx+.3,dy+.35)/.75),2);
        if(d>.74&&d<.96)L0+=.03*(1-Math.abs(d-.85)/.11);for(const [hx,hy] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){const hd=Math.hypot(dx-hx,dy-hy);if(hd<.12)L0*=.15+.85*hd/.12}
        const Lm=.2126*c[0]+.7152*c[1]+.0722*c[2],shd=Math.min(1,Math.max(.35,Lm/.02));keep[j+3]+=al*L0*shd;continue}   // the colour (the jacket's) is the look's: weight here
      keep[j]+=al*c[0];keep[j+1]+=al*c[1];keep[j+2]+=al*c[2]}}
  // the geometry: per part a row of (middle, half width) along it; the body's flow table
  // (Q: the crease's choice of part in whole numbers, asmTubePartQ's: the crease point and direction, the two thresholds, each part's
  // point and normal)
  const G=new Float32Array(4*ASM_GL_SEGS*9),Q=new Int32Array(4*ASM_GL_SEGS*4),rows=[];let tw=1;
  if(geo)geo.segs.forEach((g,si)=>{const b=4*si*9;
    if(g.parts){G[b]=1;G[b+1]=g.parts.length;const k=g.crease;if(k){G[b+2]=1;G.set([k.x,k.y,k.mx,k.my],b+4);G.set([k.r0,k.r1,0,0],b+8);
      const U=g.parts[0],L=g.parts[1]||U;Q.set([asmTq(k.x),asmTq(k.y),asmTqn(k.mx),asmTqn(k.my),asmTqr(k.r0),asmTqr(k.r1),0,0,
        asmTq(U.x),asmTq(U.y),asmTqn(U.nx),asmTqn(U.ny),asmTq(L.x),asmTq(L.y),asmTqn(L.nx),asmTqn(L.ny)],16*si)}
      g.parts.forEach((p,pi)=>{const o=b+12+12*pi;G.set([p.x,p.y,p.dx,p.dy],o);G.set([p.nx,p.ny,p.fd?p.fd.k:1,p.t?1:0],o+4);
        if(p.t){G.set([p.t.a0,p.t.bs,p.t.n,rows.length],o+8);rows.push(p.t);tw=Math.max(tw,p.t.n)}})}
    else if(si&&g.cs!=null){G[b]=2;G.set([g.cs,g.sn,g.cx,g.cy],b+4)}});
  const tube=new Float32Array(2*tw*Math.max(1,rows.length));rows.forEach((t,r)=>{for(let i=0;i<t.n;i++){tube[2*(r*tw+i)]=t.c[i];tube[2*(r*tw+i)+1]=t.R[i]}});
  const F=ASM_FLOW,fl=geo&&geo.flow,flow=new Float32Array(2*F.nu*F.nv);if(fl)for(let i=0;i<F.nu*F.nv;i++){flow[2*i]=fl.D[i];flow[2*i+1]=fl.G[i]}
  const row=new Int32Array(2*S).fill(-1);if(LX.tl)for(let y=0;y<S;y++){row[2*y]=LX.tl[y];row[2*y+1]=LX.tr[y]}
  const cuCs=new Float32Array(4*8);cuCs.set(cu.cs.slice(0,32));
  return {S,a,s4,l1,l2,keep,G,Q,tube,tw,th:Math.max(1,rows.length),flow,fl:fl?[fl.mid,fl.hw,fl.ysh,1]:[0,1,0,0],row,sm:[LX.sm.jacket||0,LX.sm.shirt||0],cuCs,cuff:P.cuff?1:0}}
/* ---- the shaders */
const asmGlF=v=>{const s=String(+v);return /[.e]/.test(s)?s:s+'.0'};
/* asmH32 and asmCellV (asm-color.js) in GLSL: the same bits from the same cells; a later stage's cloth uses these too */
function asmGlHashGlsl(){const F=asmGlF(ASM_CELL_FADE);return `
uint h32(int i,int j,uint a,uint b){return (uint(i)*a)^(uint(j)*b);}
float cellV(float u,float v,uint a,uint b,uint m){float fi=floor(u),fj=floor(v),fu=u-fi,fv=v-fj,F=${F};int i=int(fi),j=int(fj);
  int di=fu<F?-1:(fu>1.-F?1:0),dj=fv<F?-1:(fv>1.-F?1:0);float h00=float(h32(i,j,a,b)%m);if(di==0&&dj==0)return h00;
  float wu=di<0?(F-fu)/(2.*F):(di>0?(fu-1.+F)/(2.*F):0.),wv=dj<0?(F-fv)/(2.*F):(dj>0?(fv-1.+F)/(2.*F):0.);
  return (h00*(1.-wu)+float(h32(i+di,j,a,b)%m)*wu)*(1.-wv)+(float(h32(i,j+dj,a,b)%m)*(1.-wu)+float(h32(i+di,j+dj,a,b)%m)*wu)*wv;}
// floor(v/3) for a whole v exactly (a shader's division may land a hair under a whole number)
float fdiv3(float v){float r=floor(v+.5);return abs(v-r)<1e-3&&r>=0.?float(int(r)/3):floor(v/3.);}`}
/* the fragment shader: asmCmBuild's per-pixel loop for the covered zones (constants written in from the app's) */
function asmGlFrag(){const LK=ASM_CM_LOOK,LI=ASM_CM_LIGHT,F=ASM_FLOW,f=asmGlF;
  return `#version 300 es
precision highp float;precision highp int;precision highp usampler2D;precision highp isampler2D;
uniform usampler2D uA,uSh,uL1,uL2,uBG,uGR,uGeoI;uniform sampler2D uKeep,uLin,uTube,uFlow,uGeo,uTile;uniform isampler2D uRow;
uniform int uS,uHasGeo,uGeo16;uniform vec4 uG[${ASM_GL_SEGS*9}];uniform ivec4 uQ[${ASM_GL_SEGS*4}];uniform vec4 uFl;uniform vec2 uSm;
uniform vec3 uJ,uJ2,uSt,uTi,uBtn,uSg;uniform vec4 uJm;uniform vec4 uJl;uniform vec4 uTw;uniform vec4 uSl;uniform float uTieK,uLs,uAA;
uniform ivec4 uTT;uniform vec4 uRep,uSk,uCl;   // the band tile (TW, TH, has a tile, has the stripe breakup); its repeat, the breakup, the grain
uniform sampler2D uLinT;uniform int uLinen,uLinN;uniform float uLsc;   // the linen texture (asmLinenTile, uLinN square), on a linen cloth
// (stage 3) the herringbone's extras: yarn, float, float length, grain; mottle, thin, break, pair break. A tweed (uLinT holds asmTweedTile's
// r and f then): has a second colour, its mix. A small woven figure: N (0 = none), thread width, swing, mix toward the second colour; the grid
uniform vec4 uHb1,uHb2;uniform int uTweed;uniform vec4 uTd;uniform vec3 uTc2;uniform vec4 uWv;uniform vec4 uWg[16];uniform vec3 uWc2;
// (stage 4) the tiles' places in uTile (x, y, width, height: 0 jacket, 1 tie, 2 shirt); the tie's tile (has one, the knot's last row), its
// repeat, its turns (the blade's cos/sin, the knot's; on the solved pieces 80/81 the pattern's own); the shirt's (has one), its repeat,
// fine (3x3 points), has turned parts; the turned parts' cos/sin, two to a vec4 (entry 0 upright)
uniform ivec4 uTO[3];uniform ivec2 uTie;uniform vec2 uTr,uTs;uniform vec4 uTa;uniform int uShT;uniform vec4 uShR;uniform vec4 uCu[8];
out vec4 oC;
const float PI=3.14159265358979;
float lum(vec3 c){return .2126*c.r+.7152*c.g+.0722*c.b;}
float lin(uint v){return texelFetch(uLin,ivec2(int(v),0),0).r;}
${asmGlHashGlsl()}
// --- uvAt (asmTubePart, asmTubeRaw, asmTubeAt, asmFlowAt, asmUvAt)
vec2 tubeRaw(int o,vec2 P){vec4 a=uG[o],n=uG[o+1];vec2 d=P-a.xy;return vec2(dot(d,n.xy),dot(d,a.zw));}
// which part (asmTubePartQ): in whole numbers, the point in 1/16 px, so the choice is the CPU's exactly
int tubePart(int si,int b,vec2 P){int U=b+3,L=b+6;if(uG[b].z<.5)return U;int q=4*si;ivec2 I=ivec2(floor(P*16.+.5));ivec4 k=uQ[q],pu=uQ[q+2],pl=uQ[q+3];ivec2 th=uQ[q+1].xy;
  ivec2 d=I-k.xy;if(d.x*k.z+d.y*k.w>0){ivec2 e=I-pl.xy;return e.x*pl.z+e.y*pl.w<th.y?U:L;}ivec2 e=I-pu.xy;return e.x*pu.z+e.y*pu.w<th.x?L:U;}
vec2 tubeAt(int si,int b,vec2 P){int o=tubePart(si,b,P);vec2 r=tubeRaw(o,P);vec4 q=uG[o+1];if(q.w<.5)return r;vec4 t=uG[o+2];float n=t.z;
  float f=clamp((r.y-t.x)/t.y-.5,0.,n-1.);float i=floor(f),j=min(n-1.,i+1.),w=f-i;int row=int(t.w);
  vec2 ci=texelFetch(uTube,ivec2(int(i),row),0).xy,cj=texelFetch(uTube,ivec2(int(j),row),0).xy;float c=ci.x*(1.-w)+cj.x*w,Rh=ci.y*(1.-w)+cj.y*w,R=Rh*${f(ASM_TUBE_K)};
  float x=(r.x-c)/R,ax=abs(x);float u=ax<.95?R*asin(x):sign(x)*R*(1.2532+(ax-.95)*3.2026);return vec2(u,r.y)/q.z;}
vec2 flowAt(vec2 P){float u=(P.x-uFl.x)/uFl.y,au=abs(u);float x=au/${f(F.d)},y=((P.y-uFl.z)/uFl.y-(${f(F.v0)}))/${f(F.d)};x=min(x,${f(F.nu-1)});y=clamp(y,0.,${f(F.nv-1)});
  int i=min(${F.nu-2},int(x)),j=min(${F.nv-2},int(y));float fx=x-float(i),fy=y-float(j);
  vec2 a=texelFetch(uFlow,ivec2(i,j),0).xy,b=texelFetch(uFlow,ivec2(i+1,j),0).xy,c=texelFetch(uFlow,ivec2(i,j+1),0).xy,d=texelFetch(uFlow,ivec2(i+1,j+1),0).xy;
  vec2 v=a*(1.-fx)*(1.-fy)+b*fx*(1.-fy)+c*(1.-fx)*fy+d*fx*fy;return vec2(P.x-(u<0.?-1.:1.)*uFl.y*v.x,P.y+uFl.y*v.y);}
// the solved cloth position (asmUvAt): from the four pixel centres around P that belong to the same piece r as the pixel p
// (the positions as the maps hold them, 16-bit (value+1024)*16, at a phone's 2048; floats at another size)
vec2 geoV(ivec2 c){return uGeo16==1?vec2(texelFetch(uGeoI,c,0).xy)/16.-1024.:texelFetch(uGeo,c,0).xy;}
vec2 geoAt(ivec2 p,uint r,vec2 P){vec2 q=P-.5,f0=floor(q),fq=q-f0;ivec2 b=ivec2(f0);vec2 s=vec2(0.);float sw=0.;
  for(int j=0;j<2;j++)for(int i=0;i<2;i++){ivec2 c=b+ivec2(i,j);if(c.x<0||c.y<0||c.x>=uS||c.y>=uS)continue;if(texelFetch(uGR,c,0).r!=r)continue;
    float w=(i==1?fq.x:1.-fq.x)*(j==1?fq.y:1.-fq.y);s+=w*geoV(c);sw+=w;}
  return sw>1e-6?s/sw:geoV(p);}
// without a solved position: the sleeves' tubes, the lapels' axes, the body's flow
vec2 uvFall(int si,vec2 P){int b=si*9;float ty=uG[b].x;if(ty>.5&&ty<1.5)return tubeAt(si,b,P);
  if(ty>1.5){vec4 g=uG[b+1];return vec2((P.x-g.z)*g.x+(P.y-g.w)*g.y,(P.y-g.w)*g.x-(P.x-g.z)*g.y);}return uFl.w>.5?flowAt(P):P;}
vec2 uvAt(int si,vec2 P,ivec2 p){
  if(uHasGeo==1){uint r=texelFetch(uGR,p,0).r;
    if(r==1u&&uFl.w>.5&&si==0)return flowAt(geoAt(p,r,P));   // the body: solved, then through the stripe flow
    if(r>=10u&&r<60u)return geoAt(p,r,P);}                     // sleeve parts and lapels, solved in the painter's own frames
  return uvFall(si,P);}
// (stage 4) a shirt pixel on piece r: the front in the V (2, off the jacket's parts) and the cuffs (60..79) solved, else as the jacket's
vec2 uvShirt(int si,vec2 P,ivec2 p,uint r){if((r==2u&&si==0)||(r>=60u&&r<80u))return geoAt(p,r,P);return uvFall(si,P);}
// --- the look and the lighting (lookBase, lookAfter, lxF, lxPost)
vec3 tone(vec3 c){vec3 v=pow(max(c,0.),vec3(1./2.2)),w=1.-v,v2=v*v;v=v+${f(LK.toe)}*w*w*w-${f(LK.sh)}*v2*v2;return pow(max(v,0.),vec3(2.2));}   // (cubes written out: GLSL's pow is undefined below 0)
vec3 lookAfter(vec3 c,float s,bool shirt,int x,int y,bool plain,float tw,float bo){
  if(plain&&!shirt){float u=float(x)/uLs,v=float(y)/uLs;float h=float(h32(int(floor((u+v)/2.)),int(fdiv3(v)),73856093u,19349663u)%1024u)/512.-1.;
    tw=1.+${f(LK.grain)}*bo*(.6*cos(2.*PI*fract((u+v)/4.))+.5*h);c*=tw;}
  float t=clamp((s-${f(LK.s0)})/(${f(LK.s1-LK.s0)}),0.,1.);c+=${f(LK.sheen)}*t*t*(3.-2.*t)*(shirt?.25:1.)*max(0.,1.+${f(LK.sk)}*(tw-1.));return tone(c);}
vec3 lookBase(vec3 b,float lift){float y=lum(b);if(y<lift)b+=lift-y;float m=max(b.r,max(b.g,b.b));if(m>${f(LK.cmax)})b*=${f(LK.cmax)}/m;return b;}
vec3 post(vec3 c,int z,uint k,int x,ivec2 tr,float s,float rim){float h=0.,sl=min(s,1.3);if(z==0)h+=${f(LI.rim)}*rim*sl;
  if(z==1&&tr.x>=0){float w=float(tr.y-tr.x);if(w>4.){float u=((float(x-tr.x))/w-${f(LI.tp)})/${f(LI.tsw)};h+=${f(LI.ts)}*uTieK*exp(-u*u)*sl;}}c+=h;
  float S=float(uS),d=clamp(1.-s/.85,0.,1.),l=clamp((s-.95)/.5,0.,1.)*(1.-float(x)/S),y0=lum(c);
  c.r*=1.+${f(LI.warm)}*d*.9-${f(LI.cool)}*l*.5;c.g*=1.+${f(LI.warm)}*d*.15;c.b*=1.-${f(LI.warm)}*d*.9+${f(LI.cool)}*l*1.2;float y1=lum(c);if(y1>0.)c*=y0/y1;
  float h1=float(h32(int(k),int(k>>7u),2246822519u,3266489917u))/4294967296.,h2=float(h32(int(k+977u),int(k>>3u),2654435761u,1u))/4294967296.;return c*(1.+${f(LI.grain)}*(h1+h2-1.));}
// a garment's flat colour (lookBase if dark), times its light (above 1: neutral light), then the look's after-part
vec3 flatC(vec3 base,float s,bool look,float lift,float bo,bool shirt,int x,int y){if(look)base=lookBase(base,lift);vec3 c;
  if(s<=1.)c=base*s;else c=base+(s-1.)*lum(base);if(look)c=lookAfter(c,s,shirt,x,y,true,1.,bo);return c;}
// the app's suit cloth (suitCol): a band tile read at four points a pixel (asmCmAt: bilinear, wrapping), or a 1x1 tile's colour
// (stage 4) tile t of the three stacked in uTile (uTO[t]: its place and size)
vec3 tileAt(int t,float u,float v){ivec4 o=uTO[t];int TW=o.z,TH=o.w;float x=(u-floor(u))*float(TW)-.5,y=(v-floor(v))*float(TH)-.5,x0=floor(x),y0=floor(y),fx=x-x0,fy=y-y0;
  int i0=(int(x0)+TW)%TW+o.x,i1=(int(x0)+1+TW)%TW+o.x,j0=(int(y0)+TH)%TH+o.y,j1=(int(y0)+1+TH)%TH+o.y;
  return (texelFetch(uTile,ivec2(i0,j0),0).rgb*(1.-fx)+texelFetch(uTile,ivec2(i1,j0),0).rgb*fx)*(1.-fy)+(texelFetch(uTile,ivec2(i0,j1),0).rgb*(1.-fx)+texelFetch(uTile,ivec2(i1,j1),0).rgb*fx)*fy;}
// (stage 4) the tie read from its tile (asmCmBuild's tie: four points a pixel, turned by the blade's lean and the pattern's angle, a quarter
// turn more in the knot; on the solved knot (80) and blade (81) their positions, turned by the pattern's angle only)
vec3 tieBase(int x,int y,ivec2 p){float X=float(x),Y=float(y);uint r=uHasGeo==1?texelFetch(uGR,p,0).r:0u;bool tr=r==80u||r==81u;
  vec2 cs=tr?uTs:(y<uTie.y?uTa.zw:uTa.xy);vec3 b=vec3(0.);
  for(int a=0;a<2;a++)for(int e=0;e<2;e++){vec2 q=vec2(X+(float(e)+.5)/2.,Y+(float(a)+.5)/2.);if(tr)q=geoAt(p,r,q);b+=tileAt(1,(q.x*cs.x+q.y*cs.y)/uTr.x,(q.y*cs.x-q.x*cs.y)/uTr.y);}
  return b/4.;}
// (stage 4) the shirt read from its tile (asmCmBuild's shirt): on its solved pieces 2x2 points a pixel (3x3 woven, tile.fine) at their
// positions; else a woven shirt 3x3 points, turned in a cuff; else one point, turned in a cuff; the turn's cos/sin from uCu
vec2 cuCs(int c){vec4 v=uCu[c>>1];return (c&1)!=0?v.zw:v.xy;}
vec3 shirtBase(int x,int y,ivec2 p,int si,int cu){float X=float(x),Y=float(y),rp=uShR.x,rv=uShR.y;vec3 b=vec3(0.);uint r=uHasGeo==1?texelFetch(uGR,p,0).r:0u;
  if(r==2u||(r>=60u&&r<80u)){int n=uShR.z>.5?3:2;float fn=float(n);
    for(int a=0;a<3;a++)for(int e=0;e<3;e++){if(a<n&&e<n){vec2 c=uvShirt(si,vec2(X+(float(e)+.5)/fn,Y+(float(a)+.5)/fn),p,r);b+=tileAt(2,c.x/rp,c.y/rv);}}return b/(fn*fn);}
  vec2 cs=cuCs(cu);
  if(uShR.z>.5){for(int a=0;a<3;a++)for(int e=0;e<3;e++){float Xs=X+(float(e)+.5)/3.,Ys=Y+(float(a)+.5)/3.;b+=tileAt(2,(Xs*cs.x+Ys*cs.y)/rp,(Ys*cs.x-Xs*cs.y)/rv);}return b/9.;}
  if(uShR.w>.5){float Xs=X+.5,Ys=Y+.5;return tileAt(2,(Xs*cs.x+Ys*cs.y)/rp,(Ys*cs.x-Xs*cs.y)/rv);}
  return tileAt(2,(X+.5)/rp,(Y+.5)/rv);}
// the linen's light at (u, v) texels, faded at each texel's edge (asmCellT)
float linAt(int a,int b){int T=uLinN;return texelFetch(uLinT,ivec2(((a%T)+T)%T,((b%T)+T)%T),0).r;}
float cellT(float u,float v){float fi=floor(u),fj=floor(v),fu=u-fi,fv=v-fj,F=${f(ASM_CELL_FADE)};int i=int(fi),j=int(fj);
  int di=fu<F?-1:(fu>1.-F?1:0),dj=fv<F?-1:(fv>1.-F?1:0);float h00=linAt(i,j);if(di==0&&dj==0)return h00;
  float wu=di<0?(F-fu)/(2.*F):(di>0?(fu-1.+F)/(2.*F):0.),wv=dj<0?(F-fv)/(2.*F):(dj>0?(fv-1.+F)/(2.*F):0.);
  return (h00*(1.-wu)+linAt(i+di,j)*wu)*(1.-wv)+(linAt(i,j+dj)*(1.-wu)+linAt(i+di,j+dj)*wu)*wv;}
// the stripe breakup's value for stripe i, cell j
float hS(int i,int j){return float(h32(i,j,374761393u,668265263u)%2048u)/1024.-1.;}
// (stage 3) i mod n, never negative (GLSL leaves % of a negative number undefined)
int imod(int i,int n){return i>=0?i%n:(n-1)-((-i-1)%n);}
// a herringbone's break for column cc (ASM_HB_BREAK on odd columns, else ASM_HB_PBRK: each pair of columns, one V, shifted from the next)
float boOf(int cc){return uHb2.z!=0.&&(cc&1)!=0?uHb2.z*uTw.x:(uHb2.w!=0.?uHb2.w*uTw.x*floor(float(cc)*.5):0.);}
// a rib of the grain for column cc (a herringbone's odd columns run the other way): four points a pixel (C.ss) or the pixel's middle
float ribAt(int si,float X,float Y,ivec2 p,vec2 c,int cc){float d=(cc&1)!=0?-1.:1.,pitch=uTw.x,ph=0.,b=boOf(cc);
  if(uCl.y>.5){for(int a=0;a<2;a++)for(int e=0;e<2;e++){vec2 s=uvAt(si,vec2(X+(float(e)+.5)/2.,Y+(float(a)+.5)/2.),p);ph+=cos(2.*PI*fract((s.y+d*s.x+b)/pitch))/4.;}}
  else ph=cos(2.*PI*fract((c.y+d*c.x+b)/pitch));return ph;}
// the yarn breakup and raised floats of rib r0 in column cc (al: the position along the rib)
float hYarn(int r0,int s,int cc){return float((h32(r0,s,2246822519u,3266489917u)^h32(cc,0,668265263u,0u))%1024u)/1024.;}
float yn1(int r0,int cc,float al){float y=1.,pitch=uTw.x;
  if(uHb1.x>0.){float t=al/(pitch*1.7),s0=floor(t),f=t-s0,fs=f*f*(3.-2.*f);int s=int(s0);y=1.-uHb1.x/2.+uHb1.x*(hYarn(r0,s,cc)*(1.-fs)+hYarn(r0,s+1,cc)*fs);}
  if(uHb1.y>0.){float hf=float(h32(r0,cc,374761393u,668265263u)%4096u)/4096.,s=al/(pitch*uHb1.z)+hf*7.,f=s-floor(s),sn=sin(PI*f);y*=1.-uHb1.y+uHb1.y*sn*sn;}return y;}
// ... with the rib's index faded into its neighbour's within ASM_CELL_FADE of its edge (as asmCellV)
float ynOf(vec2 c,int cc){float d=(cc&1)!=0?-1.:1.,q=(c.y+d*c.x+boOf(cc))/uTw.x+.5,rf=floor(q),fq=q-rf,F=${f(ASM_CELL_FADE)},al=c.y-d*c.x;int r=int(rf);
  int di=fq<F?-1:(fq>1.-F?1:0);float v=yn1(r,cc,al);if(di==0)return v;float w=di<0?(F-fq)/(2.*F):(fq-1.+F)/(2.*F);return v*(1.-w)+yn1(r+di,cc,al)*w;}
// the woollen mottle: value noise (asm-color.js's vn)
float hM(int i,int j){return float(h32(i,j,1597334677u,3812015801u)%2048u)/1024.-1.;}
float vnz(float u,float v){float i0=floor(u),j0=floor(v),fu=u-i0,fv=v-j0,su=fu*fu*(3.-2.*fu),sv=fv*fv*(3.-2.*fv);int i=int(i0),j=int(j0);
  return (hM(i,j)*(1.-su)+hM(i+1,j)*su)*(1.-sv)+(hM(i,j+1)*(1.-su)+hM(i+1,j+1)*su)*sv;}
// a small woven figure's thread crossing (a, b), wrapping, and read at (u, v) crossings faded at each edge (asmCellT)
float wgAt(int a,int b){int N=int(uWv.x),k=imod(b,N)*N+imod(a,N);return uWg[k>>2][k&3];}
float cellG(float u,float v){float fi=floor(u),fj=floor(v),fu=u-fi,fv=v-fj,F=${f(ASM_CELL_FADE)};int i=int(fi),j=int(fj);
  int di=fu<F?-1:(fu>1.-F?1:0),dj=fv<F?-1:(fv>1.-F?1:0);float h00=wgAt(i,j);if(di==0&&dj==0)return h00;
  float wu=di<0?(F-fu)/(2.*F):(di>0?(fu-1.+F)/(2.*F):0.),wv=dj<0?(F-fv)/(2.*F):(dj>0?(fv-1.+F)/(2.*F):0.);
  return (h00*(1.-wu)+wgAt(i+di,j)*wu)*(1.-wv)+(wgAt(i,j+dj)*(1.-wu)+wgAt(i+di,j+dj)*wu)*wv;}
// ribs squeezed finer than the picture can show, softened (ASM_CM_AA, #360; asmAaK): a Gaussian pixel's response at the rib's cycles per
// pixel against its response where the cloth faces the camera; a step into another piece (past ASM_CM_AA_CUT) is left alone, faded
float aaOf(vec2 da,vec2 db,int cc){if(uAA<=0.)return 1.;float d=(cc&1)!=0?-1.:1.,pitch=uTw.x,gx=(da.y+d*da.x)/pitch,gy=(db.y+d*db.x)/pitch,g2=gx*gx+gy*gy,g0=1./pitch;
  float f=g2>g0*g0?exp(-2.*uAA*uAA*(g2-g0*g0)):1.,t=(g2-${f(ASM_CM_AA_CUT)}+${f(ASM_CM_AA_FADE)})/${f(2*ASM_CM_AA_FADE)};return t<=0.?f:(t>=1.?1.:f+(1.-f)*t);}
vec3 suit(int si,int x,int y,ivec2 p,float sh,out float tw){float X=float(x),Y=float(y),FD=${f(ASM_CELL_FADE)};vec3 cm=vec3(0.);
  if(uTT.z==1){for(int a=0;a<2;a++)for(int e=0;e<2;e++){vec2 s=uvAt(si,vec2(X+(float(e)+.5)/2.,Y+(float(a)+.5)/2.),p);cm+=tileAt(0,s.x/uRep.x,s.y/uRep.y);}}else cm=4.*uJ;
  tw=1.;vec2 c=uvAt(si,vec2(X+.5,Y+.5),p);
  // a stripe's breakup (T.k): each stripe its own strength along its length, faded between stripes (asmCellV's rule) and smoothly along
  if(uTT.w==1){float su=c.x/uRep.x-uRep.z+.5,fi=floor(su),fu=su-fi;int i=int(fi),di=fu<FD?-1:(fu>1.-FD?1:0);float wu=di<0?(FD-fu)/(2.*FD):(di>0?(fu-1.+FD)/(2.*FD):0.);
    float tt=c.y/uRep.w,jf=floor(tt),f0=tt-jf,fs=f0*f0*(3.-2.*f0);int j=int(jf);float n0=hS(i,j),n1=hS(i,j+1);
    if(di!=0){n0=n0*(1.-wu)+hS(i+di,j)*wu;n1=n1*(1.-wu)+hS(i+di,j+1)*wu;}
    float nz=max(0.,1.+uSk.y*(n0*(1.-fs)+n1*fs));cm=4.*uSg+(cm-4.*uSg)*uSk.x*nz;sh=uSk.z*pow(max(sh,0.),uSk.w);}
  // a linen cloth: its threads' light (before any grain, as on the CPU); else the grain under it (asmClothOf / asmTwillTex): a twill's
  // ribs, or a herringbone's in columns, their fleck (asmCellV), a second colour
  // (stage 3) a tweed: sampled upright in the picture at whole picture pixels over the cloth's scale (a power of two on the suit master,
  // so the same cell as the CPU's), its flecks in the second colour
  if(uTweed==1){int T=uLinN,u=int(floor(X/uLsc)),v=int(floor(Y/uLsc));vec2 rf=texelFetch(uLinT,ivec2(imod(u,T),imod(v,T)),0).rg;sh*=rf.x;
    if(uTd.x>.5&&rf.y!=0.)cm=cm*(1.-uTd.y)+4.*uTc2*uTd.y;}
  else if(uLinen==1)sh*=cellT(c.x/uLsc,c.y/uLsc);
  else if(uCl.x>.5){float cw=uCl.z,off=uCl.w;int col=uCl.x>1.5&&cw>0.?int(floor((c.x-off)/cw)):0;float d=(col&1)!=0?-1.:1.;vec2 da=vec2(0.),db=vec2(0.);
    if(uAA>0.){da=uvAt(si,vec2(X+1.,Y+.5),p)-uvAt(si,vec2(X,Y+.5),p);db=uvAt(si,vec2(X+.5,Y+1.),p)-uvAt(si,vec2(X+.5,Y),p);}
    float ph=ribAt(si,X,Y,p,c,col)*aaOf(da,db,col),fk=cellV((c.x+d*c.y)/2.,c.y/3.,73856093u,19349663u,1024u);
    // a herringbone's column faded into the next within ASM_CELL_FADE of its edge (as on the CPU)
    if(cw>0.){float fx=(c.x-off)/cw-float(col);if(fx<FD||fx>1.-FD){int nb=fx<FD?col-1:col+1;float w=fx<FD?(FD-fx)/(2.*FD):(fx-1.+FD)/(2.*FD),d2=(nb&1)!=0?-1.:1.;
      ph=ph*(1.-w)+ribAt(si,X,Y,p,c,nb)*aaOf(da,db,nb)*w;fk=fk*(1.-w)+cellV((c.x+d2*c.y)/2.,c.y/3.,73856093u,19349663u,1024u)*w;}}
    // (stage 3) the standalone herringbone's yarn breakup and floats (faded at the rib's and the column's edge), grain cells, mottle
    float yn=1.,mo=0.;bool yf=uHb1.x>0.||uHb1.y>0.;if(yf)yn=ynOf(c,col);
    if(yf&&cw>0.){float fx=(c.x-off)/cw-float(col);if(fx<FD||fx>1.-FD){int nb=fx<FD?col-1:col+1;float w=fx<FD?(FD-fx)/(2.*FD):(fx-1.+FD)/(2.*FD);yn=yn*(1.-w)+ynOf(c,nb)*w;}}
    if(uHb1.w>0.){float gs=${f(.6*ASM_PX_MM)}*uLs,gv=cellV(c.x/gs,c.y/gs,2654435761u,2246822519u,4096u)/4096.;yn*=1.-uHb1.w+2.*uHb1.w*pow(gv,1.6);}
    if(uHb2.x>0.){float m1=${f(4*ASM_PX_MM)}*uLs,m2=${f(11*ASM_PX_MM)}*uLs;mo=uHb2.x*(.55*vnz(c.x/m1,c.y/m1)+.45*vnz(c.x/m2+17.3,c.y/m2+5.1));}
    float pr=uHb2.y!=0.?2.*((ph+1.)/2.)*((ph+1.)/2.)-.75:ph;
    tw=1.+mo+uTw.y*pr*yn+uTw.z*(fk/512.-1.);if(uTw.w>0.){float m=uTw.w*(1.+ph)/2.;cm=cm*(1.-m)+4.*uJ2*m;}}
  // (stage 3) a small woven figure (asmMicroTex): its thread grid along the cloth, 4x4 points a pixel from three positions
  if(uWv.x>0.){float tp=uWv.y,v=0.;vec2 p0=uvAt(si,vec2(X,Y),p),px=uvAt(si,vec2(X+1.,Y),p),py=uvAt(si,vec2(X,Y+1.),p);
    for(int a=0;a<4;a++)for(int e=0;e<4;e++){float fx=(float(e)+.5)/4.,fy=(float(a)+.5)/4.,u=p0.x+(px.x-p0.x)*fx+(py.x-p0.x)*fy,w=p0.y+(px.y-p0.y)*fx+(py.y-p0.y)*fy;v+=cellG(u/tp,w/tp);}
    v/=16.;tw*=1.+uWv.z*v;if(uWv.w>0.){float m=uWv.w*(1.-v)/2.;cm=cm*(1.-m)+4.*uWc2*m;}}
  return cm/4.*sh*pow(max(0.,tw),2.2);}
void main(){int x=int(gl_FragCoord.x),y=int(gl_FragCoord.y);ivec2 p=ivec2(x,y);uint k=uint(y*uS+x);
  uvec4 A=texelFetch(uA,p,0),SH=texelFetch(uSh,p,0),L1=texelFetch(uL1,p,0),L2=texelFetch(uL2,p,0);vec4 K=texelFetch(uKeep,p,0);
  vec3 sum=vec3(0);float S=float(uS);ivec2 tr=texelFetch(uRow,ivec2(y,0),0).xy;int si=int(L2.w&255u),cu=int(L2.w>>8u);
  // the jacket (z 0)
  // (uJm: the full look, the folds' lighting, the suit cloth, lit; a striped jacket (T.k) is kept as it was: neither look nor lighting)
  if(A.x>0u){float s=float(SH.x)/40000.;bool look=uJm.x>.5,lit=uJm.w>.5;
    if(uJm.y>.5&&uSm.x>0.){float sl=float(L1.x)/40000.;if(sl>.01)s=uSm.x*pow(sl/uSm.x,${f(LK.lgam)})*(s/sl);}
    if(lit){float v=float(L1.z);if(si==0)v=max(v,float(L2.y));s*=1.-${f(LI.ak)}*v/${f(ASM_CM_U16)};s*=1.+${f(LI.win)}*(look?${f(LI.wd)}:1.)*(1.-2.*float(x)/S);}
    vec3 c;if(uJm.z>.5){float tw;c=suit(si,x,y,p,s,tw);
      if(look){float bo=uJl.y,t2=1.+bo*(tw-1.);if(bo>1.)c*=max(0.,1.+(bo-1.)*2.2*(tw-1.));float yy=lum(c),fl=uJl.x*pow(min(s,1.),${f(LK.fp)});
        if(yy<fl)c+=(fl-yy)*max(0.,1.+${f(LK.wk)}*(t2-1.));c=lookAfter(c,s,false,x,y,false,t2,bo);}}
    else c=flatC(uJ,s,look,uJl.x,uJl.y,false,x,y);
    if(lit)c=post(c,0,k,x,tr,s,float(L2.z)/${f(ASM_CM_U16)});sum+=float(A.x)/255.*c;}
  // the tie (z 1): its flat colour or (stage 4) its tile, its edges darker
  if(A.y>0u){float s=float(SH.y)/40000.;s*=1.-${f(LI.ak)}*float(L2.x)/${f(ASM_CM_U16)};s*=1.+${f(LI.win)}*(1.-2.*float(x)/S);
    if(tr.x>=0){float w=float(tr.y-tr.x);if(w>4.){float t=float(x-tr.x)/w;s*=1.-${f(LI.te)}*pow(abs(t-.5)*2.,3.);}}
    sum+=float(A.y)/255.*post(flatC(uTie.x==1?tieBase(x,y,p):uTi,s,false,0.,1.,false,x,y),1,k,x,tr,s,0.);}
  // the background picture (z 2): as it is, darker by the figure's shadow, dithered
  if(A.z>0u){float s=1.-${f(ASM_CM_BG_SHADOW)}*float(SH.w)/255.,h=float((k*2654435761u)%1024u)/1024.;uvec4 B=texelFetch(uBG,p,0);
    vec3 lo=vec3(lin(B.r),lin(B.g),lin(B.b)),hi=vec3(lin(min(B.r+1u,255u)),lin(min(B.g+1u,255u)),lin(min(B.b+1u,255u)));sum+=float(A.z)/255.*(lo+(hi-lo)*h)*s;}
  // the shirt (z 3)
  if(A.w>0u){float s=float(SH.z)/40000.;bool look=uSl.x>.5;
    if(uSl.y>.5&&uSm.y>0.){float sl=float(L1.y)/40000.;if(sl>.01)s=uSm.y*pow(sl/uSm.y,${f(LK.lgam)})*(s/sl);}
    s*=1.-${f(LI.ak)}*float(L1.w)/${f(ASM_CM_U16)};s*=1.+${f(LI.win)}*(look?${f(LI.wd)}:1.)*(1.-2.*float(x)/S);
    sum+=float(A.w)/255.*post(flatC(uShT==1?shirtBase(x,y,p,si,cu):uSt,s,look,uSl.z,uSl.w,true,x,y),3,k,x,tr,s,0.);}   // (stage 4: or its tile)
  // skin, watch, dark (packed once per master), the button in the jacket's colour
  sum+=K.rgb+K.a*uBtn;
  float m=max(sum.r,max(sum.g,sum.b));if(m>1.){float w=min(1.,(m-1.)/m);sum=sum/m+(1.-sum/m)*w;}
  vec3 v=clamp(sum,0.,1.);v=mix(12.92*v,1.055*pow(v,vec3(1./2.4))-.055,step(vec3(.0031308),v));oC=vec4(v,1.);}`}
const ASM_GL_VERT=`#version 300 es
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}`;
function asmGlProgram(gl){const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(o));return o};
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,ASM_GL_VERT));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,asmGlFrag()));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(p));return p}
/* ---- textures */
/* one texture, nearest, from a typed array */
function asmGlTex(gl,unit,w,h,ifmt,fmt,type,data){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texStorage2D(gl.TEXTURE_2D,1,ifmt,w,h);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,w,h,fmt,type,data);return t}
/* the master's textures (once per master): 16+32+32+32+32 MB at 2048 (the kept zones' colours half floats since stage 2: 64 -> 32 MB,
   within a tenth of a level), plus the background and the output, 16 MB each */
function asmGlUpload(G,pk){const gl=G.gl,S=pk.S,u=n=>gl.getUniformLocation(G.prog,n);gl.useProgram(G.prog);
  for(const t of G.tex||[])gl.deleteTexture(t);
  G.tex=[asmGlTex(gl,0,S,S,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,pk.a),asmGlTex(gl,1,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.s4),
    asmGlTex(gl,2,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.l1),asmGlTex(gl,3,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.l2),
    asmGlTex(gl,5,S,S,gl.RGBA16F,gl.RGBA,gl.FLOAT,pk.keep),
    asmGlTex(gl,6,256,1,gl.R32F,gl.RED,gl.FLOAT,ASM_LIN),asmGlTex(gl,7,pk.tw,pk.th,gl.RG32F,gl.RG,gl.FLOAT,pk.tube),
    asmGlTex(gl,8,ASM_FLOW.nu,ASM_FLOW.nv,gl.RG32F,gl.RG,gl.FLOAT,pk.flow),asmGlTex(gl,9,S,1,gl.RG32I,gl.RG_INTEGER,gl.INT,pk.row)];
  [['uA',0],['uSh',1],['uL1',2],['uL2',3],['uBG',4],['uKeep',5],['uLin',6],['uTube',7],['uFlow',8],['uRow',9],['uGeo',10],['uGR',11],['uTile',12],['uGeoI',13],['uLinT',14]].forEach(([n,i])=>gl.uniform1i(u(n),i));
  gl.uniform1i(u('uS'),S);gl.uniform4fv(u('uG'),pk.G);gl.uniform4iv(u('uQ'),pk.Q);gl.uniform4fv(u('uFl'),pk.fl);gl.uniform2fv(u('uSm'),pk.sm);
  gl.uniform4fv(u('uCu'),pk.cuCs);G.cuff=pk.cuff;   // (stage 4) the turned shirt parts' cos/sin; whether the master has its shirt's parts
  if(!G.fbo){G.out=gl.createTexture();gl.activeTexture(gl.TEXTURE15);gl.bindTexture(gl.TEXTURE_2D,G.out);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,S,S);
    G.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,G.out,0)}
  G.bgk=null;gl.finish()}
/* the master's solved cloth positions (asmGeoPrep's {U, V, R} at the painting's size), or none (1x1 stand-ins, uHasGeo 0) */
/* (stage 2) at the maps' own size (a phone's 2048) every position is a whole number of 1/16 px from -1024: kept as the maps' 16-bit values
   (RG16UI, 16 MB at 2048 against 32 MB of floats), read back exactly; at any other size (resampled) as floats */
function asmGlUploadGeo(G,uv){const gl=G.gl,S=G.S;gl.useProgram(G.prog);for(const t of G.gtex||[])gl.deleteTexture(t);
  const z32=()=>asmGlTex(gl,10,1,1,gl.RG32F,gl.RG,gl.FLOAT,new Float32Array(2)),z16=()=>asmGlTex(gl,13,1,1,gl.RG16UI,gl.RG_INTEGER,gl.UNSIGNED_SHORT,new Uint16Array(2));let g16=0;
  if(uv&&uv.U.length===S*S){const N=S*S,h=new Uint16Array(2*N);let ok=true;
    for(let k=0;k<N&&ok;k++){const a=uv.U[k]*16+16384,b=uv.V[k]*16+16384;if(a!==Math.round(a)||b!==Math.round(b)||a<0||b<0||a>65535||b>65535)ok=false;else{h[2*k]=a;h[2*k+1]=b}}
    if(ok){g16=1;G.gtex=[z32(),asmGlTex(gl,13,S,S,gl.RG16UI,gl.RG_INTEGER,gl.UNSIGNED_SHORT,h)]}
    else{const f=new Float32Array(2*N);for(let k=0;k<N;k++){f[2*k]=uv.U[k];f[2*k+1]=uv.V[k]}G.gtex=[asmGlTex(gl,10,S,S,gl.RG32F,gl.RG,gl.FLOAT,f),z16()]}
    G.gtex.push(asmGlTex(gl,11,S,S,gl.R8UI,gl.RED_INTEGER,gl.UNSIGNED_BYTE,uv.R))}
  else G.gtex=[z32(),z16(),asmGlTex(gl,11,1,1,gl.R8UI,gl.RED_INTEGER,gl.UNSIGNED_BYTE,new Uint8Array(1))];
  G.geoBytes=uv&&uv.U.length===S*S?S*S*(g16?4:8)+S*S:0;
  gl.uniform1i(gl.getUniformLocation(G.prog,'uHasGeo'),uv&&uv.U.length===S*S?1:0);gl.uniform1i(gl.getUniformLocation(G.prog,'uGeo16'),g16)}
/* (stage 4) the look's tiles, [jacket, tie, shirt] (each {c: linear RGB, TW, TH} or null), stacked in one RGBA32F texture on unit 12 (the
   sampler units 0..14 were all taken): each one's place and size in uTO; about 1 MB a tile */
function asmGlAtlas(G,ts){const gl=G.gl;let W=1,H=0;for(const t of ts)if(t){W=Math.max(W,t.TW);H+=t.TH}H=Math.max(1,H);
  const f=new Float32Array(4*W*H),to=new Int32Array(12);let y=0;
  ts.forEach((t,i)=>{if(!t){to.set([0,0,1,1],4*i);return}to.set([0,y,t.TW,t.TH],4*i);
    for(let r=0;r<t.TH;r++)for(let x=0;x<t.TW;x++){const s=3*(r*t.TW+x),d=4*((y+r)*W+x);f[d]=t.c[s];f[d+1]=t.c[s+1];f[d+2]=t.c[s+2]}y+=t.TH});
  if(G.ttex)gl.deleteTexture(G.ttex);G.ttex=asmGlTex(gl,12,W,H,gl.RGBA32F,gl.RGBA,gl.FLOAT,f);G.tileBytes=16*W*H;
  gl.uniform4iv(gl.getUniformLocation(G.prog,'uTO'),to)}
/* ---- one look */
/* its pixels on the GPU -> Uint8ClampedArray (RGBA, rows top-down, as asmCmBuild's before its buttons, clip and JPEG) */
async function asmGlPaint(G,job,P){const gl=G.gl,S=P.S,u=n=>gl.getUniformLocation(G.prog,n),L=ASM_LIN,LK=ASM_CM_LOOK;gl.useProgram(G.prog);
  const hexLin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2];
  // the background picture (kept while the same one comes back)
  const bk=job.bgt+'|'+S;if(G.bgk!==bk){const d=(await asmData(job.bg,S)).data;if(G.bgt)gl.deleteTexture(G.bgt);G.bgt=asmGlTex(gl,4,S,S,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,new Uint8Array(d.buffer,d.byteOffset,d.byteLength));G.bgk=bk}
  const cl=job.cloth,lookOf=f=>{const mx=Math.max(...f),mn=Math.min(...f),sat=mx>0?(mx-mn)/mx:0,y=lum(f);return {lift:LK.ymin*(1-LK.chroma*Math.min(1,sat/.7)),boost:1+LK.dk*Math.max(0,1-y/LK.dy)}};
  // the jacket: a striped one (T.k) is kept as it was (no look, no lighting: asmCmBuild's e.keep), a dark cloth takes the full look, a lighter
  // one its folds' lighting
  const J=hexLin(cl.jacket.hex),T=cl.jacket.suit,keep=!!(T&&T.k!=null),jl=!keep&&lum(J)<LK.dark?lookOf(J):null;
  const tc=T?(T.t||T.c):null,tile=!!(T&&(T.TW>1||T.TH>1));
  gl.uniform3fv(u('uJ'),T?[tc[0],tc[1],tc[2]]:J);gl.uniform4f(u('uJm'),jl?1:0,jl||keep?0:1,T?1:0,keep?0:1);gl.uniform4f(u('uJl'),jl?jl.lift:0,jl?jl.boost:1,0,0);
  if(G.ttex){gl.deleteTexture(G.ttex);G.ttex=null}
  if(T){const C=T.cloth,lsc=S/ASM_SIZE*ASM_CM_KINDS[job.cm].pxmm,rep=(T.mm||1)*ASM_PX_MM*lsc,TW=T.TW,TH=T.TH;
    // the band tile (asmSuitTex: about 256 px a repeat, linear floats), 4 channels; a 1x1 tile's colour is uJ
    // (stage 4: one of up to three tiles stacked in one texture, asmGlAtlas below)
    gl.uniform4i(u('uTT'),tile?TW:1,tile?TH:1,tile?1:0,keep?1:0);gl.uniform4f(u('uRep'),rep,rep*TH/TW,T.loff||0,(T.blen||1)*lsc);
    gl.uniform4f(u('uSk'),keep?T.k:0,keep?T.brk:0,keep?T.gain:1,keep?T.gam:1);gl.uniform3fv(u('uSg'),keep?T.g:[0,0,0]);
    gl.uniform4f(u('uCl'),C&&C.kind==='herringbone'?2:C&&C.kind==='twill'?1:0,C&&C.ss?1:0,C&&C.cw?C.cw*lsc:0,C&&C.off?C.off*lsc:0);
    // a linen cloth: the linen texture (256 x 256 light factors, the same on every device); (stage 3) a tweed: asmTweedTile's 512 x 512
    // light factors and flecks (RG32F, 2 MB); one at a time on unit 14, uploaded when the cloth changes
    const ck=T.tweed?'tweed':T.linen?'linen':null;
    if(ck&&G.clothK!==ck){if(G.lint)gl.deleteTexture(G.lint);
      if(ck==='linen'){const ln=asmLinenTile();G.lint=asmGlTex(gl,14,ln.T,ln.T,gl.R32F,gl.RED,gl.FLOAT,ln.r);G.linN=ln.T;G.clothBytes=4*ln.T*ln.T}
      else{const td=asmTweedTile(),n=td.T*td.T,rf=new Float32Array(2*n);for(let q=0;q<n;q++){rf[2*q]=td.r[q];rf[2*q+1]=td.f[q]}G.lint=asmGlTex(gl,14,td.T,td.T,gl.RG32F,gl.RG,gl.FLOAT,rf);G.linN=td.T;G.clothBytes=8*n}
      G.clothK=ck}
    gl.uniform1i(u('uLinen'),T.linen&&!T.tweed?1:0);gl.uniform1i(u('uLinN'),G.linN||1);gl.uniform1f(u('uLsc'),lsc);
    gl.uniform1i(u('uTweed'),T.tweed?1:0);gl.uniform4f(u('uTd'),T.tweed&&T.c2?1:0,T.fmix||0,0,0);gl.uniform3fv(u('uTc2'),T.tweed&&T.c2?[T.c2[0],T.c2[1],T.c2[2]]:[0,0,0]);
    gl.uniform4f(u('uTw'),C?(C.pitch||4)*lsc:4,C?C.amp:0,C&&C.fleck!=null?C.fleck:.08,C&&C.c2?C.mix:0);gl.uniform3fv(u('uJ2'),C&&C.c2||[0,0,0]);
    // (stage 3) the herringbone's extras (asmTwillTex), and a small woven figure's thread grid (asmMicroTex)
    gl.uniform4f(u('uHb1'),C&&C.yarn||0,C&&C.float||0,C&&C.floatL||1,C&&C.grain||0);gl.uniform4f(u('uHb2'),C&&C.mottle||0,C&&C.thin?1:0,C&&C.brk||0,C&&C.pbrk||0);
    const W=T.wv,wg=new Float32Array(64);if(W)wg.set(W.g.subarray?W.g.subarray(0,W.N*W.N):W.g.slice(0,W.N*W.N));
    gl.uniform4f(u('uWv'),W?W.N:0,W?W.thr*ASM_PX_MM*lsc:1,W?W.amp:0,W&&W.c2?W.mix:0);gl.uniform4fv(u('uWg'),wg);gl.uniform3fv(u('uWc2'),W&&W.c2?[W.c2[0],W.c2[1],W.c2[2]]:[0,0,0])}
  else{gl.uniform4i(u('uTT'),1,1,0,0);gl.uniform1i(u('uLinen'),0);gl.uniform1i(u('uTweed'),0);gl.uniform4f(u('uWv'),0,1,0,0)}
  if(!G.lint){G.lint=asmGlTex(gl,14,1,1,gl.R32F,gl.RED,gl.FLOAT,new Float32Array([1]));G.linN=0;G.clothK=null;G.clothBytes=0}   // (a stand-in until a linen or tweed cloth comes)
  gl.uniform1f(u('uAA'),ASM_CM_AA&&job.aa!==false?Math.PI*(typeof job.aa==='number'?job.aa:ASM_CM_AA):0);   // (asmCmBuild's rule: job.aa false = off, a number = the bench's strength)
  const St=hexLin(cl.shirt.hex),sl=lum(St)<LK.dark?lookOf(St):null;gl.uniform3fv(u('uSt'),St);gl.uniform4f(u('uSl'),sl?1:0,sl?0:1,sl?sl.lift:0,sl?sl.boost:1);
  const Ti=hexLin(cl.tie.hex);gl.uniform3fv(u('uTi'),Ti);gl.uniform1f(u('uTieK'),asmTieSheenK(lum(Ti)));gl.uniform1f(u('uLs'),S/ASM_SIZE);
  const Lf=Math.max(1e-4,lum(J));gl.uniform3fv(u('uBtn'),J.map(v=>v/Lf*.6+.4));
  // (stage 4) the tie read from its tile (asmCmBuild's e.tie: only with the master's tie geometry, else its colour): its repeat (the count
  // across the blade, twice the size for a motif), the turns' cos and sin worked out here in float64 (blade, knot; the pattern's own on the
  // solved pieces 80/81); the shirt read from its tile (asmCmTile, its repeat in mm at the master's px per mm)
  const tg=P.tieGeo,TI=tg&&cl.tie.tie?cl.tie.tie:null,SH=cl.shirt.tile||null;
  if(TI){const rep=(TI.motif?2:1)*tg.bw/Math.max(.5,TI.across||1.5),a=TI.ang||0,tb=tg.lean+a,tk=tb+Math.PI/2;gl.uniform2i(u('uTie'),1,tg.yk);
    gl.uniform2f(u('uTr'),rep,rep*TI.TH/TI.TW);gl.uniform4f(u('uTa'),Math.cos(tb),Math.sin(tb),Math.cos(tk),Math.sin(tk));gl.uniform2f(u('uTs'),Math.cos(a),Math.sin(a))}
  else gl.uniform2i(u('uTie'),0,0);
  if(SH){const rep=SH.mm*P.pxmm;gl.uniform1i(u('uShT'),1);gl.uniform4f(u('uShR'),rep,rep*SH.TH/SH.TW,SH.fine?1:0,G.cuff?1:0)}else gl.uniform1i(u('uShT'),0);
  asmGlAtlas(G,[tile?{c:tc,TW:T.TW,TH:T.TH}:null,TI?{c:TI.c,TW:TI.TW,TH:TI.TH}:null,SH?{c:SH.t||SH.c,TW:SH.TW,TH:SH.TH}:null]);
  gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.viewport(0,0,S,S);gl.drawArrays(gl.TRIANGLES,0,3);
  const o=new Uint8Array(4*S*S);gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,o);return new Uint8ClampedArray(o.buffer)}
/* asmCmBuild's first step: the look on the graphics chip -> {url, gl:true, ms}, or null (not covered, no WebGL2, a lost context: the CPU
   paints it). hit is asmCmSetup's (the master's setup and solved positions) */
async function asmGlTry(job,hit){const P=hit.P;if(!P.lx&&hit.lx)P.lx=hit.lx;const why=asmGlWhy(job,P);asmGlNot=why;if(why)return null;
  const G=asmGlInit(P.S);if(!G){asmGlNot='no WebGL2 context at '+P.S;return null}
  try{const t0=performance.now();
    if(G.key!==hit.key){G.key=null;asmGlUpload(G,asmGlPack(P));G.key=hit.key;G.gk=null}   // (the packed arrays are let go once uploaded)
    const gk=hit.key+'|'+(hit.gk||'');if(G.gk!==gk){asmGlUploadGeo(G,hit.uv);G.gk=gk}
    const o=await asmGlPaint(G,job,P);if(G.gl.isContextLost())throw new Error('graphics context lost while painting');
    const ms=Math.round(performance.now()-t0),S=P.S,L=ASM_LIN,N=P.N;
    const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},hx=String(job.cloth.shirt.hex).replace('#','');
    if(P.A.shirt)asmCmButtons(o,P,[0,2,4].map(k=>L[parseInt(hx.slice(k,k+2),16)||0]),L,gam);   // the shirt's buttons, drawn (ASM_CM_BTN), as on the CPU
    if(job.bar&&P.A.tie){const tm=new Uint8Array(N);for(let k=0;k<N;k++)tm[k]=P.A.tie[k]>127?1:0;asmBarDraw(o,tm,S,job.bar,null)}
    // (stage 6) over a phone's size (the PC's 2880) scaled to 2048 exactly as asmCmBuild scales the CPU's picture
    let img=new ImageData(o,S,S);if(S>ASM_SIZE){const big=asmCmCanvas(S,S);big.getContext('2d').putImageData(img,0,0);const sm=asmCmCanvas(ASM_SIZE,ASM_SIZE),x=sm.getContext('2d',{willReadFrequently:true});
      x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(big,0,0,ASM_SIZE,ASM_SIZE);img=x.getImageData(0,0,ASM_SIZE,ASM_SIZE)}
    return {url:await asmJpeg(img),gl:true,ms,renderer:G.renderer}}
  catch(e){console.warn('asm-gl: painting on the processor instead',e);asmGlNot='graphics error: '+String(e&&e.message||e).slice(0,200);asmGlLost(G.gl);return null}}
/* ---- Settings → Outfit pictures → Advanced (owner only): "Graphics-chip painting", this phone's switch, and how the last picture
   painted here was made */
function asmGlUI(b){if(!b)return;let g=document.getElementById('gl-box');if(!g){g=document.createElement('div');g.id='gl-box';b.appendChild(g)}
  g.innerHTML=`<label class="srow">Graphics-chip painting <select id="cfg-gl" onchange="asmGlSet(this.value)"><option value="on">On</option><option value="off">Off</option></select></label><p class="shelp" id="gl-status" role="status"></p>`;
  document.getElementById('cfg-gl').value=asmGlPref()?'on':'off';asmGlStatus()}
function asmGlStatus(){const el=document.getElementById('gl-status');if(!el)return;
  const last=asmGlLast?` Last picture painted on this phone: ${asmGlLast.gl?'graphics chip':'processor'}${asmGlLast.ms!=null?`, ${asmGlLast.ms} ms`:''}.`:'';
  el.textContent=(asmGlPref()?'On: pictures this phone paints of a jacket, shirt and tie of any cloth (no waistcoat) are painted on the graphics chip (about ten times faster, the same picture within 2 levels); every other look on the processor.'
    :'Off on this phone: every picture painted here uses the processor, as before.')+last}
function asmGlSet(v){try{if(v==='off')localStorage.setItem(ASM_GL,'0');else localStorage.removeItem(ASM_GL)}catch{}asmGlStatus()}
/* a picture came back from the painter (asmRun): remember which way it was made, for the line above */
function asmGlNote(r){if(!r||!('gl' in r))return;asmGlLast={gl:!!r.gl,ms:r.ms!=null?r.ms:null};asmGlStatus()}
