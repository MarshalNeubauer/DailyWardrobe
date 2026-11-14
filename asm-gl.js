/* Daily Wardrobe: the colour-coded painter's per-look pass (asmCmBuild, asm-color.js) on the graphics chip, WebGL2 (2026-11-14: the owner
   approved the port after an iPhone benchmark, lab/gl-bench.html: about 90 ms a look against 0.45-1.5 s for the CPU painter at 2048).
   Loaded after asm-color.js on the page and in asm-worker.js. asmCmBuild calls asmGlTry first; it paints the look here when
   asmGlCovers(job, P) says the look is covered and WebGL2 works, else returns null and the CPU painter paints it as before.

   Covered (stage 1; later stages extend asmGlWhy, the one coverage rule, and the shader):
     - the suit master ('suit') with the cloth look and lighting on (job.look !== false), a background picture (job.bg), at a phone's
       size or smaller (job.size <= ASM_SIZE: the computer's 2880 pre-build stays on the CPU)
     - the jacket a solid colour, or a plain one- or two-colour twill (asmTwillTex: not herringbone, linen or tweed); dark cloths take the
       full look (ASM_CM_LOOK), lighter ones the folds' lighting, as on the CPU
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
const ASM_GL_RETRY_MS=60e3;   // after a lost context, the CPU paints this long before the graphics chip is tried again
const ASM_GL='asm_gl';   // localStorage: '0' = this phone paints every picture on the processor (Settings → Outfit pictures → Advanced)
const asmGlPref=()=>{try{return localStorage.getItem(ASM_GL)!=='0'}catch{return true}};
let asmGlState=null,asmGlNone=false,asmGlEver=false,asmGlRetry=0,asmGlPageOk=null,asmGlLast=null;
/* ---- coverage: the one rule for which looks the graphics chip paints ('' = covered, else why not). Without P only the job is looked at
   (the page's routing, before any setup); with the master's setup P its geometry and lighting too */
function asmGlWhy(job,P){if(!job||job.cm!=='suit')return 'master '+(job&&job.cm);if(job.look===false)return 'cloth look off';
  if(!(job.size<=ASM_SIZE))return 'larger than a phone paints';if(!job.bg)return 'no background picture';
  const cl=job.cloth||{};for(const z of ['jacket','tie','shirt'])if(!cl[z])return 'no '+z;
  if(cl.tie.tie||cl.tie.tile||cl.tie.suit)return 'patterned tie';if(cl.shirt.tile||cl.shirt.suit||cl.shirt.tie)return 'patterned shirt';
  const j=cl.jacket;if(j.tile||j.tie)return 'jacket drawn from a tile';
  if(j.suit){const T=j.suit,C=T.cloth;
    if(!C||C.kind!=='twill'||T.linen||T.tweed||T.k!=null||T.wv||T.TW!==1||T.TH!==1||!C.ss||C.yarn||C.float||C.grain||C.mottle||C.thin||C.soft||C.brk||C.pbrk)
      return 'jacket cloth '+(T.k!=null?'bands':C&&C.kind||'other')}
  if(!P)return '';
  if(!P.bgShadow)return 'no background shadow';if(!P.lx)return 'no lighting';
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
  const G=new Float32Array(4*ASM_GL_SEGS*9),rows=[];let tw=1;
  if(geo)geo.segs.forEach((g,si)=>{const b=4*si*9;
    if(g.parts){G[b]=1;G[b+1]=g.parts.length;const k=g.crease;if(k){G[b+2]=1;G.set([k.x,k.y,k.mx,k.my],b+4);G.set([k.r0,k.r1,0,0],b+8)}
      g.parts.forEach((p,pi)=>{const o=b+12+12*pi;G.set([p.x,p.y,p.dx,p.dy],o);G.set([p.nx,p.ny,p.fd?p.fd.k:1,p.t?1:0],o+4);
        if(p.t){G.set([p.t.a0,p.t.bs,p.t.n,rows.length],o+8);rows.push(p.t);tw=Math.max(tw,p.t.n)}})}
    else if(si&&g.cs!=null){G[b]=2;G.set([g.cs,g.sn,g.cx,g.cy],b+4)}});
  const tube=new Float32Array(2*tw*Math.max(1,rows.length));rows.forEach((t,r)=>{for(let i=0;i<t.n;i++){tube[2*(r*tw+i)]=t.c[i];tube[2*(r*tw+i)+1]=t.R[i]}});
  const F=ASM_FLOW,fl=geo&&geo.flow,flow=new Float32Array(2*F.nu*F.nv);if(fl)for(let i=0;i<F.nu*F.nv;i++){flow[2*i]=fl.D[i];flow[2*i+1]=fl.G[i]}
  const row=new Int32Array(2*S).fill(-1);if(LX.tl)for(let y=0;y<S;y++){row[2*y]=LX.tl[y];row[2*y+1]=LX.tr[y]}
  return {S,a,s4,l1,l2,keep,G,tube,tw,th:Math.max(1,rows.length),flow,fl:fl?[fl.mid,fl.hw,fl.ysh,1]:[0,1,0,0],row,sm:[LX.sm.jacket||0,LX.sm.shirt||0]}}
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
uniform usampler2D uA,uSh,uL1,uL2,uBG,uGR;uniform sampler2D uKeep,uLin,uTube,uFlow,uGeo;uniform isampler2D uRow;
uniform int uS,uHasGeo;uniform vec4 uG[${ASM_GL_SEGS*9}];uniform vec4 uFl;uniform vec2 uSm;
uniform vec3 uJ,uJ2,uSt,uTi,uBtn;uniform vec4 uJm;uniform vec4 uJl;uniform vec4 uTw;uniform vec4 uSl;uniform float uTieK,uLs,uAA;
out vec4 oC;
const float PI=3.14159265358979;
float lum(vec3 c){return .2126*c.r+.7152*c.g+.0722*c.b;}
float lin(uint v){return texelFetch(uLin,ivec2(int(v),0),0).r;}
${asmGlHashGlsl()}
// --- uvAt (asmTubePart, asmTubeRaw, asmTubeAt, asmFlowAt, asmUvAt)
vec2 tubeRaw(int o,vec2 P){vec4 a=uG[o],n=uG[o+1];vec2 d=P-a.xy;return vec2(dot(d,n.xy),dot(d,a.zw));}
int tubePart(int b,vec2 P){int U=b+3,L=b+6;if(uG[b].z<.5)return U;vec4 k=uG[b+1];vec2 r=uG[b+2].xy;
  if(dot(P-k.xy,k.zw)>0.)return dot(P-uG[L].xy,uG[L+1].xy)< -1.3*r.y?U:L;return dot(P-uG[U].xy,uG[U+1].xy)< -1.3*r.x?L:U;}
vec2 tubeAt(int b,vec2 P){int o=tubePart(b,P);vec2 r=tubeRaw(o,P);vec4 q=uG[o+1];if(q.w<.5)return r;vec4 t=uG[o+2];float n=t.z;
  float f=clamp((r.y-t.x)/t.y-.5,0.,n-1.);float i=floor(f),j=min(n-1.,i+1.),w=f-i;int row=int(t.w);
  vec2 ci=texelFetch(uTube,ivec2(int(i),row),0).xy,cj=texelFetch(uTube,ivec2(int(j),row),0).xy;float c=ci.x*(1.-w)+cj.x*w,Rh=ci.y*(1.-w)+cj.y*w,R=Rh*${f(ASM_TUBE_K)};
  float x=(r.x-c)/R,ax=abs(x);float u=ax<.95?R*asin(x):sign(x)*R*(1.2532+(ax-.95)*3.2026);return vec2(u,r.y)/q.z;}
vec2 flowAt(vec2 P){float u=(P.x-uFl.x)/uFl.y,au=abs(u);float x=au/${f(F.d)},y=((P.y-uFl.z)/uFl.y-(${f(F.v0)}))/${f(F.d)};x=min(x,${f(F.nu-1)});y=clamp(y,0.,${f(F.nv-1)});
  int i=min(${F.nu-2},int(x)),j=min(${F.nv-2},int(y));float fx=x-float(i),fy=y-float(j);
  vec2 a=texelFetch(uFlow,ivec2(i,j),0).xy,b=texelFetch(uFlow,ivec2(i+1,j),0).xy,c=texelFetch(uFlow,ivec2(i,j+1),0).xy,d=texelFetch(uFlow,ivec2(i+1,j+1),0).xy;
  vec2 v=a*(1.-fx)*(1.-fy)+b*fx*(1.-fy)+c*(1.-fx)*fy+d*fx*fy;return vec2(P.x-(u<0.?-1.:1.)*uFl.y*v.x,P.y+uFl.y*v.y);}
// the solved cloth position (asmUvAt): from the four pixel centres around P that belong to the same piece r as the pixel p
vec2 geoAt(ivec2 p,uint r,vec2 P){vec2 q=P-.5,f0=floor(q),fq=q-f0;ivec2 b=ivec2(f0);vec2 s=vec2(0.);float sw=0.;
  for(int j=0;j<2;j++)for(int i=0;i<2;i++){ivec2 c=b+ivec2(i,j);if(c.x<0||c.y<0||c.x>=uS||c.y>=uS)continue;if(texelFetch(uGR,c,0).r!=r)continue;
    float w=(i==1?fq.x:1.-fq.x)*(j==1?fq.y:1.-fq.y);s+=w*texelFetch(uGeo,c,0).xy;sw+=w;}
  return sw>1e-6?s/sw:texelFetch(uGeo,p,0).xy;}
vec2 uvAt(int si,vec2 P,ivec2 p){
  if(uHasGeo==1){uint r=texelFetch(uGR,p,0).r;
    if(r==1u&&uFl.w>.5&&si==0)return flowAt(geoAt(p,r,P));   // the body: solved, then through the stripe flow
    if(r>=10u&&r<60u)return geoAt(p,r,P);}                     // sleeve parts and lapels, solved in the painter's own frames
  int b=si*9;float ty=uG[b].x;if(ty>.5&&ty<1.5)return tubeAt(b,P);
  if(ty>1.5){vec4 g=uG[b+1];return vec2((P.x-g.z)*g.x+(P.y-g.w)*g.y,(P.y-g.w)*g.x-(P.x-g.z)*g.y);}return uFl.w>.5?flowAt(P):P;}
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
// the plain twill (suitCol with asmTwillTex: a 1x1 tile, ribs averaged over four points a pixel, its fleck (asmCellV), a second colour)
vec3 twill(int si,int x,int y,ivec2 p,float sh,out float tw){vec3 cm=4.*uJ;float pitch=uTw.x;vec2 c=uvAt(si,vec2(float(x)+.5,float(y)+.5),p);
  float fk=cellV((c.x+c.y)/2.,c.y/3.,73856093u,19349663u,1024u);float ph=0.;
  for(int a=0;a<2;a++)for(int e=0;e<2;e++){vec2 s=uvAt(si,vec2(float(x)+(float(e)+.5)/2.,float(y)+(float(a)+.5)/2.),p);ph+=cos(2.*PI*fract((s.y+s.x)/pitch))/4.;}
  // ribs squeezed finer than the picture can show, softened (ASM_CM_AA, #360): a Gaussian pixel's response at the rib's cycles per pixel
  // against its response where the cloth faces the camera; a step into another piece (g2 >= 2.25) is left alone
  if(uAA>0.){float X=float(x),Y=float(y);vec2 a1=uvAt(si,vec2(X+1.,Y+.5),p),a0=uvAt(si,vec2(X,Y+.5),p),b1=uvAt(si,vec2(X+.5,Y+1.),p),b0=uvAt(si,vec2(X+.5,Y),p);
    float gx=((a1.y-a0.y)+(a1.x-a0.x))/pitch,gy=((b1.y-b0.y)+(b1.x-b0.x))/pitch,g2=gx*gx+gy*gy,g0=1./pitch;
    if(g2<2.25&&g2>g0*g0)ph*=exp(-2.*uAA*uAA*(g2-g0*g0));}
  tw=1.+uTw.y*ph+uTw.z*(fk/512.-1.);if(uTw.w>0.){float m=uTw.w*(1.+ph)/2.;cm=cm*(1.-m)+4.*uJ2*m;}
  return cm/4.*sh*pow(max(0.,tw),2.2);}
void main(){int x=int(gl_FragCoord.x),y=int(gl_FragCoord.y);ivec2 p=ivec2(x,y);uint k=uint(y*uS+x);
  uvec4 A=texelFetch(uA,p,0),SH=texelFetch(uSh,p,0),L1=texelFetch(uL1,p,0),L2=texelFetch(uL2,p,0);vec4 K=texelFetch(uKeep,p,0);
  vec3 sum=vec3(0);float S=float(uS);ivec2 tr=texelFetch(uRow,ivec2(y,0),0).xy;int si=int(L2.w);
  // the jacket (z 0)
  if(A.x>0u){float s=float(SH.x)/40000.;bool look=uJm.x>.5;
    if(uJm.y>.5&&uSm.x>0.){float sl=float(L1.x)/40000.;if(sl>.01)s=uSm.x*pow(sl/uSm.x,${f(LK.lgam)})*(s/sl);}
    float v=float(L1.z);if(si==0)v=max(v,float(L2.y));s*=1.-${f(LI.ak)}*v/${f(ASM_CM_U16)};s*=1.+${f(LI.win)}*(look?${f(LI.wd)}:1.)*(1.-2.*float(x)/S);
    vec3 c;if(uJm.z>.5){float tw;c=twill(si,x,y,p,s,tw);
      if(look){float bo=uJl.y,t2=1.+bo*(tw-1.);if(bo>1.)c*=max(0.,1.+(bo-1.)*2.2*(tw-1.));float yy=lum(c),fl=uJl.x*pow(min(s,1.),${f(LK.fp)});
        if(yy<fl)c+=(fl-yy)*max(0.,1.+${f(LK.wk)}*(t2-1.));c=lookAfter(c,s,false,x,y,false,t2,bo);}}
    else c=flatC(uJ,s,look,uJl.x,uJl.y,false,x,y);
    sum+=float(A.x)/255.*post(c,0,k,x,tr,s,float(L2.z)/${f(ASM_CM_U16)});}
  // the tie (z 1): its flat colour, its edges darker
  if(A.y>0u){float s=float(SH.y)/40000.;s*=1.-${f(LI.ak)}*float(L2.x)/${f(ASM_CM_U16)};s*=1.+${f(LI.win)}*(1.-2.*float(x)/S);
    if(tr.x>=0){float w=float(tr.y-tr.x);if(w>4.){float t=float(x-tr.x)/w;s*=1.-${f(LI.te)}*pow(abs(t-.5)*2.,3.);}}
    sum+=float(A.y)/255.*post(flatC(uTi,s,false,0.,1.,false,x,y),1,k,x,tr,s,0.);}
  // the background picture (z 2): as it is, darker by the figure's shadow, dithered
  if(A.z>0u){float s=1.-${f(ASM_CM_BG_SHADOW)}*float(SH.w)/255.,h=float((k*2654435761u)%1024u)/1024.;uvec4 B=texelFetch(uBG,p,0);
    vec3 lo=vec3(lin(B.r),lin(B.g),lin(B.b)),hi=vec3(lin(min(B.r+1u,255u)),lin(min(B.g+1u,255u)),lin(min(B.b+1u,255u)));sum+=float(A.z)/255.*(lo+(hi-lo)*h)*s;}
  // the shirt (z 3)
  if(A.w>0u){float s=float(SH.z)/40000.;bool look=uSl.x>.5;
    if(uSl.y>.5&&uSm.y>0.){float sl=float(L1.y)/40000.;if(sl>.01)s=uSm.y*pow(sl/uSm.y,${f(LK.lgam)})*(s/sl);}
    s*=1.-${f(LI.ak)}*float(L1.w)/${f(ASM_CM_U16)};s*=1.+${f(LI.win)}*(look?${f(LI.wd)}:1.)*(1.-2.*float(x)/S);
    sum+=float(A.w)/255.*post(flatC(uSt,s,look,uSl.z,uSl.w,true,x,y),3,k,x,tr,s,0.);}
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
/* the master's textures (once per master): about 16+32+32+32+64 MB at 2048 */
function asmGlUpload(G,pk){const gl=G.gl,S=pk.S,u=n=>gl.getUniformLocation(G.prog,n);gl.useProgram(G.prog);
  for(const t of G.tex||[])gl.deleteTexture(t);
  G.tex=[asmGlTex(gl,0,S,S,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,pk.a),asmGlTex(gl,1,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.s4),
    asmGlTex(gl,2,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.l1),asmGlTex(gl,3,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.l2),
    asmGlTex(gl,5,S,S,gl.RGBA32F,gl.RGBA,gl.FLOAT,pk.keep),
    asmGlTex(gl,6,256,1,gl.R32F,gl.RED,gl.FLOAT,ASM_LIN),asmGlTex(gl,7,pk.tw,pk.th,gl.RG32F,gl.RG,gl.FLOAT,pk.tube),
    asmGlTex(gl,8,ASM_FLOW.nu,ASM_FLOW.nv,gl.RG32F,gl.RG,gl.FLOAT,pk.flow),asmGlTex(gl,9,S,1,gl.RG32I,gl.RG_INTEGER,gl.INT,pk.row)];
  [['uA',0],['uSh',1],['uL1',2],['uL2',3],['uBG',4],['uKeep',5],['uLin',6],['uTube',7],['uFlow',8],['uRow',9],['uGeo',10],['uGR',11]].forEach(([n,i])=>gl.uniform1i(u(n),i));
  gl.uniform1i(u('uS'),S);gl.uniform4fv(u('uG'),pk.G);gl.uniform4fv(u('uFl'),pk.fl);gl.uniform2fv(u('uSm'),pk.sm);
  if(!G.fbo){G.out=gl.createTexture();gl.activeTexture(gl.TEXTURE15);gl.bindTexture(gl.TEXTURE_2D,G.out);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,S,S);
    G.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,G.out,0)}
  G.bgk=null;gl.finish()}
/* the master's solved cloth positions (asmGeoPrep's {U, V, R} at the painting's size), or none (1x1 stand-ins, uHasGeo 0) */
function asmGlUploadGeo(G,uv){const gl=G.gl,S=G.S;gl.useProgram(G.prog);for(const t of G.gtex||[])gl.deleteTexture(t);
  if(uv&&uv.U.length===S*S){const N=S*S,f=new Float32Array(2*N);for(let k=0;k<N;k++){f[2*k]=uv.U[k];f[2*k+1]=uv.V[k]}
    G.gtex=[asmGlTex(gl,10,S,S,gl.RG32F,gl.RG,gl.FLOAT,f),asmGlTex(gl,11,S,S,gl.R8UI,gl.RED_INTEGER,gl.UNSIGNED_BYTE,uv.R)]}
  else G.gtex=[asmGlTex(gl,10,1,1,gl.RG32F,gl.RG,gl.FLOAT,new Float32Array(2)),asmGlTex(gl,11,1,1,gl.R8UI,gl.RED_INTEGER,gl.UNSIGNED_BYTE,new Uint8Array(1))];
  gl.uniform1i(gl.getUniformLocation(G.prog,'uHasGeo'),uv&&uv.U.length===S*S?1:0)}
/* ---- one look */
/* its pixels on the GPU -> Uint8ClampedArray (RGBA, rows top-down, as asmCmBuild's before its buttons, clip and JPEG) */
async function asmGlPaint(G,job,P){const gl=G.gl,S=P.S,u=n=>gl.getUniformLocation(G.prog,n),L=ASM_LIN,LK=ASM_CM_LOOK;gl.useProgram(G.prog);
  const hexLin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2];
  // the background picture (kept while the same one comes back)
  const bk=job.bgt+'|'+S;if(G.bgk!==bk){const d=(await asmData(job.bg,S)).data;if(G.bgt)gl.deleteTexture(G.bgt);G.bgt=asmGlTex(gl,4,S,S,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,new Uint8Array(d.buffer,d.byteOffset,d.byteLength));G.bgk=bk}
  const cl=job.cloth,lookOf=f=>{const mx=Math.max(...f),mn=Math.min(...f),sat=mx>0?(mx-mn)/mx:0,y=lum(f);return {lift:LK.ymin*(1-LK.chroma*Math.min(1,sat/.7)),boost:1+LK.dk*Math.max(0,1-y/LK.dy)}};
  const J=hexLin(cl.jacket.hex),jl=lum(J)<LK.dark?lookOf(J):null,T=cl.jacket.suit;
  gl.uniform3fv(u('uJ'),T?Array.from(T.c):J);gl.uniform4f(u('uJm'),jl?1:0,jl?0:1,T?1:0,0);gl.uniform4f(u('uJl'),jl?jl.lift:0,jl?jl.boost:1,0,0);
  if(T){const C=T.cloth,lsc=S/ASM_SIZE*ASM_CM_KINDS[job.cm].pxmm;gl.uniform4f(u('uTw'),(C.pitch||4)*lsc,C.amp,C.fleck!=null?C.fleck:.08,C.c2?C.mix:0);gl.uniform3fv(u('uJ2'),C.c2||[0,0,0])}
  gl.uniform1f(u('uAA'),ASM_CM_AA&&job.aa!==false?Math.PI*(typeof job.aa==='number'?job.aa:ASM_CM_AA):0);   // (asmCmBuild's rule: job.aa false = off, a number = the bench's strength)
  const St=hexLin(cl.shirt.hex),sl=lum(St)<LK.dark?lookOf(St):null;gl.uniform3fv(u('uSt'),St);gl.uniform4f(u('uSl'),sl?1:0,sl?0:1,sl?sl.lift:0,sl?sl.boost:1);
  const Ti=hexLin(cl.tie.hex);gl.uniform3fv(u('uTi'),Ti);gl.uniform1f(u('uTieK'),asmTieSheenK(lum(Ti)));gl.uniform1f(u('uLs'),S/ASM_SIZE);
  const Lf=Math.max(1e-4,lum(J));gl.uniform3fv(u('uBtn'),J.map(v=>v/Lf*.6+.4));
  gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.viewport(0,0,S,S);gl.drawArrays(gl.TRIANGLES,0,3);
  const o=new Uint8Array(4*S*S);gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,o);return new Uint8ClampedArray(o.buffer)}
/* asmCmBuild's first step: the look on the graphics chip -> {url, gl:true, ms}, or null (not covered, no WebGL2, a lost context: the CPU
   paints it). hit is asmCmSetup's (the master's setup and solved positions) */
async function asmGlTry(job,hit){const P=hit.P;if(!P.lx&&hit.lx)P.lx=hit.lx;const why=asmGlWhy(job,P);if(why)return null;
  const G=asmGlInit(P.S);if(!G)return null;
  try{const t0=performance.now();
    if(G.key!==hit.key){G.key=null;asmGlUpload(G,asmGlPack(P));G.key=hit.key;G.gk=null}   // (the packed arrays are let go once uploaded)
    const gk=hit.key+'|'+(hit.gk||'');if(G.gk!==gk){asmGlUploadGeo(G,hit.uv);G.gk=gk}
    const o=await asmGlPaint(G,job,P);if(G.gl.isContextLost())throw new Error('graphics context lost while painting');
    const ms=Math.round(performance.now()-t0),S=P.S,L=ASM_LIN,N=P.N;
    const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},hx=String(job.cloth.shirt.hex).replace('#','');
    if(P.A.shirt)asmCmButtons(o,P,[0,2,4].map(k=>L[parseInt(hx.slice(k,k+2),16)||0]),L,gam);   // the shirt's buttons, drawn (ASM_CM_BTN), as on the CPU
    if(job.bar&&P.A.tie){const tm=new Uint8Array(N);for(let k=0;k<N;k++)tm[k]=P.A.tie[k]>127?1:0;asmBarDraw(o,tm,S,job.bar,null)}
    return {url:await asmJpeg(new ImageData(o,S,S)),gl:true,ms}}
  catch(e){console.warn('asm-gl: painting on the processor instead',e);asmGlLost(G.gl);return null}}
/* ---- Settings → Outfit pictures → Advanced (owner only): "Graphics-chip painting", this phone's switch, and how the last picture
   painted here was made */
function asmGlUI(b){if(!b)return;let g=document.getElementById('gl-box');if(!g){g=document.createElement('div');g.id='gl-box';b.appendChild(g)}
  g.innerHTML=`<label class="srow">Graphics-chip painting <select id="cfg-gl" onchange="asmGlSet(this.value)"><option value="on">On</option><option value="off">Off</option></select></label><p class="shelp" id="gl-status" role="status"></p>`;
  document.getElementById('cfg-gl').value=asmGlPref()?'on':'off';asmGlStatus()}
function asmGlStatus(){const el=document.getElementById('gl-status');if(!el)return;
  const last=asmGlLast?` Last picture painted on this phone: ${asmGlLast.gl?'graphics chip':'processor'}${asmGlLast.ms!=null?`, ${asmGlLast.ms} ms`:''}.`:'';
  el.textContent=(asmGlPref()?'On: pictures this phone paints of a plain or twill jacket with a plain shirt and tie are painted on the graphics chip (about ten times faster, the same picture within 2 levels); every other look on the processor.'
    :'Off on this phone: every picture painted here uses the processor, as before.')+last}
function asmGlSet(v){try{if(v==='off')localStorage.setItem(ASM_GL,'0');else localStorage.removeItem(ASM_GL)}catch{}asmGlStatus()}
/* a picture came back from the painter (asmRun): remember which way it was made, for the line above */
function asmGlNote(r){if(!r||!('gl' in r))return;asmGlLast={gl:!!r.gl,ms:r.ms!=null?r.ms:null};asmGlStatus()}
