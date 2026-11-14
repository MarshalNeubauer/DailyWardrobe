/* Daily Wardrobe: PROTOTYPE (2026-11-14) of the colour-coded painter's per-look pass (asmCmBuild) on the GPU, WebGL2.
   NOT loaded by index.html, asm-worker.js or sw.js: nothing in the app calls it. tools/asm-gl-bench.js loads it beside assemble.js and
   asm-color.js to measure it against the CPU painter at 2048 and compare the pixels.

   Covered (everything else falls back to asmCmBuild, the CPU painter):
     - the suit master ('suit') with the cloth look and lighting on (job.look !== false) and a background picture (job.bg)
     - the jacket a solid colour, or a plain one-colour or two-colour twill (asmTwillTex: no herringbone, no linen); dark cloths take
       the full look (ASM_CM_LOOK), lighter ones the folds' lighting, as on the CPU
     - the shirt and tie solid colours; skin, watch and the dark zone (the half-hidden button drawn as a horn button) passed through
     - the background picture darkened by the figure's shadow and dithered; the lighting (ASM_CM_LIGHT: contact shadows, window light,
       the jacket's lit rim, the tie's edges and sheen, warmth/coolness, film grain)
   The jacket's cloth coordinates (uvAt: the sleeves' tubes with their crease and cylinders, the lapels' axes, the body's stripe flow)
   are worked out in the shader from the setup's geometry (a few uniforms and two small tables), not stored per pixel.

   The master-only arrays (shares, light, contact shadows, rim, sleeve cells, and the kept zones' colours, which depend only on the
   master) are packed once per master on the CPU (asmGlPack) and uploaded as textures once (asmGlUpload); each look then sets a few
   uniforms, draws one full-screen triangle and reads the picture back. */
const ASM_GL_SEGS=7;   // body + two sleeves + two lapels (and room)
let asmGlState=null;   // {gl, prog, S, fbo, tex, pack, key, bgk}
/* WebGL2 on an OffscreenCanvas (a Web Worker or the page), or on a page canvas; null where there is none */
function asmGlContext(S){
  let cv=null;try{cv=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(S,S):typeof document!=='undefined'?Object.assign(document.createElement('canvas'),{width:S,height:S}):null}catch{cv=null}
  if(!cv)return null;let gl=null;try{gl=cv.getContext('webgl2',{antialias:false,depth:false,stencil:false,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'})}catch{gl=null}
  if(!gl)return null;if(gl.getParameter(gl.MAX_TEXTURE_SIZE)<S)return null;return gl}
/* the renderer's name (WEBGL_debug_renderer_info), for the bench */
function asmGlRenderer(gl){const x=gl.getExtension('WEBGL_debug_renderer_info');return x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL)+' / '+gl.getParameter(x.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.RENDERER)}
/* whether this look is one the prototype paints: else null, with why */
function asmGlCan(job,P){if(!job||job.cm!=='suit')return 'kind '+(job&&job.cm);if(job.look===false)return 'look off';if(!job.bg||!P.bgShadow)return 'no background picture';
  const cl=job.cloth||{};for(const z of ['jacket','tie','shirt'])if(!cl[z])return 'no '+z;
  if(cl.tie.tie||cl.tie.tile||cl.tie.suit)return 'patterned tie';if(cl.shirt.tile||cl.shirt.suit||cl.shirt.tie)return 'patterned shirt';
  const j=cl.jacket;if(j.tile||j.tie)return 'jacket tile';
  if(j.suit){const T=j.suit,C=T.cloth;if(!C||C.kind!=='twill'||T.linen||T.tweed||T.k!=null||T.wv||T.TW!==1||T.TH!==1)return 'jacket cloth not plain twill'}
  const g=P.geo;if(!g||g.gar!=='jacket')return 'no jacket geometry';if(g.segs.length>ASM_GL_SEGS)return 'too many parts';
  for(const s of g.segs)if(s.parts)for(const p of s.parts){if(p.poly)return 'polyline part';if(p.fd&&(p.fd.D.some(v=>v)||p.fd.G.some(v=>v)))return 'sleeve flow'}
  if(!P.lx)return 'no lighting';return null}
/* the master-only part, packed for the GPU (once per master; CPU). Replays asmCmBuild's per-pixel rules for the kept zones (skin,
   watch, dark: the master's colour or its clean neighbours', the chroma wall, the button) into one premultiplied colour + the button's
   weight, since none of it depends on the look */
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
        const Lm=.2126*c[0]+.7152*c[1]+.0722*c[2],shd=Math.min(1,Math.max(.35,Lm/.02));keep[j+3]+=al*L0*shd;continue}   // the colour (jacket's) is the look's: weight here
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
/* the fragment shader: asmCmBuild's per-pixel loop for the zones above (constants written in from the app's) */
function asmGlFrag(){const LK=ASM_CM_LOOK,LI=ASM_CM_LIGHT,F=ASM_FLOW,f=v=>{const s=String(+v);return /[.e]/.test(s)?s:s+'.0'};
  return `#version 300 es
precision highp float;precision highp int;precision highp usampler2D;precision highp isampler2D;
uniform usampler2D uA,uSh,uL1,uL2,uBG;uniform sampler2D uKeep,uLin,uTube,uFlow;uniform isampler2D uRow;
uniform int uS;uniform vec4 uG[${ASM_GL_SEGS*9}];uniform vec4 uFl;uniform vec2 uSm;
uniform vec3 uJ,uJ2,uSt,uTi,uBtn;uniform vec4 uJm;uniform vec4 uJl;uniform vec4 uTw;uniform vec4 uSl;uniform float uTieK,uLs,uLsc;
out vec4 oC;
const float PI=3.14159265358979;
float lum(vec3 c){return .2126*c.r+.7152*c.g+.0722*c.b;}
float lin(uint v){return texelFetch(uLin,ivec2(int(v),0),0).r;}
uint ih(float a,uint ma,float b,uint mb){return (uint(int(floor(a)))*ma)^(uint(int(floor(b)))*mb);}
// --- uvAt (asmTubePart, asmTubeRaw, asmTubeAt, asmFlowAt)
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
vec2 uvAt(int si,vec2 P){int b=si*9;float ty=uG[b].x;if(ty>.5&&ty<1.5)return tubeAt(b,P);
  if(ty>1.5){vec4 g=uG[b+1];return vec2((P.x-g.z)*g.x+(P.y-g.w)*g.y,(P.y-g.w)*g.x-(P.x-g.z)*g.y);}return uFl.w>.5?flowAt(P):P;}
// --- the look and the lighting (lookBase, lookAfter, lxF, lxPost)
vec3 tone(vec3 c){vec3 v=pow(max(c,0.),vec3(1./2.2)),w=1.-v,v2=v*v;v=v+${f(LK.toe)}*w*w*w-${f(LK.sh)}*v2*v2;return pow(max(v,0.),vec3(2.2));}   // (cubes written out: GLSL's pow is undefined below 0)
vec3 lookAfter(vec3 c,float s,bool shirt,int x,int y,bool plain,float tw,float bo){
  if(plain&&!shirt){float u=float(x)/uLs,v=float(y)/uLs;float h=float(ih((u+v)/2.,73856093u,v/3.,19349663u)%1024u)/512.-1.;
    tw=1.+${f(LK.grain)}*bo*(.6*cos(2.*PI*fract((u+v)/4.))+.5*h);c*=tw;}
  float t=clamp((s-${f(LK.s0)})/(${f(LK.s1-LK.s0)}),0.,1.);c+=${f(LK.sheen)}*t*t*(3.-2.*t)*(shirt?.25:1.)*max(0.,1.+${f(LK.sk)}*(tw-1.));return tone(c);}
vec3 lookBase(vec3 b,float lift){float y=lum(b);if(y<lift)b+=lift-y;float m=max(b.r,max(b.g,b.b));if(m>${f(LK.cmax)})b*=${f(LK.cmax)}/m;return b;}
vec3 post(vec3 c,int z,uint k,int x,ivec2 tr,float s,float rim){float h=0.,sl=min(s,1.3);if(z==0)h+=${f(LI.rim)}*rim*sl;
  if(z==1&&tr.x>=0){float w=float(tr.y-tr.x);if(w>4.){float u=((float(x-tr.x))/w-${f(LI.tp)})/${f(LI.tsw)};h+=${f(LI.ts)}*uTieK*exp(-u*u)*sl;}}c+=h;
  float S=float(uS),d=clamp(1.-s/.85,0.,1.),l=clamp((s-.95)/.5,0.,1.)*(1.-float(x)/S),y0=lum(c);
  c.r*=1.+${f(LI.warm)}*d*.9-${f(LI.cool)}*l*.5;c.g*=1.+${f(LI.warm)}*d*.15;c.b*=1.-${f(LI.warm)}*d*.9+${f(LI.cool)}*l*1.2;float y1=lum(c);if(y1>0.)c*=y0/y1;
  float h1=float((k*2246822519u)^((k>>7u)*3266489917u))/4294967296.,h2=float(((k+977u)*2654435761u)^(k>>3u))/4294967296.;return c*(1.+${f(LI.grain)}*(h1+h2-1.));}
// a garment's flat colour (lookBase if dark), times its light (above 1: neutral light), then the look's after-part
vec3 flatC(vec3 base,float s,bool look,float lift,float bo,bool shirt,int x,int y){if(look)base=lookBase(base,lift);vec3 c;
  if(s<=1.)c=base*s;else c=base+(s-1.)*lum(base);if(look)c=lookAfter(c,s,shirt,x,y,true,1.,bo);return c;}
// the plain twill (suitCol with asmTwillTex: a 1x1 tile, ribs averaged over four points a pixel, its fleck, a second colour)
vec3 twill(int si,int x,int y,float sh,out float tw){vec3 cm=4.*uJ;float pitch=uTw.x;vec2 c=uvAt(si,vec2(float(x)+.5,float(y)+.5));
  uint h=ih((c.x+c.y)/2.,73856093u,c.y/3.,19349663u);float ph=0.;
  for(int a=0;a<2;a++)for(int e=0;e<2;e++){vec2 s=uvAt(si,vec2(float(x)+(float(e)+.5)/2.,float(y)+(float(a)+.5)/2.));ph+=cos(2.*PI*fract((s.y+s.x)/pitch))/4.;}
  tw=1.+uTw.y*ph+uTw.z*(float(h%1024u)/512.-1.);if(uTw.w>0.){float m=uTw.w*(1.+ph)/2.;cm=cm*(1.-m)+4.*uJ2*m;}
  return cm/4.*sh*pow(max(0.,tw),2.2);}
void main(){int x=int(gl_FragCoord.x),y=int(gl_FragCoord.y);ivec2 p=ivec2(x,y);uint k=uint(y*uS+x);
  uvec4 A=texelFetch(uA,p,0),SH=texelFetch(uSh,p,0),L1=texelFetch(uL1,p,0),L2=texelFetch(uL2,p,0);vec4 K=texelFetch(uKeep,p,0);
  vec3 sum=vec3(0);float S=float(uS);ivec2 tr=texelFetch(uRow,ivec2(y,0),0).xy;int si=int(L2.w);
  // the jacket (z 0)
  if(A.x>0u){float s=float(SH.x)/40000.;bool look=uJm.x>.5;
    if(uJm.y>.5&&uSm.x>0.){float sl=float(L1.x)/40000.;if(sl>.01)s=uSm.x*pow(sl/uSm.x,${f(LK.lgam)})*(s/sl);}
    float v=float(L1.z);if(si==0)v=max(v,float(L2.y));s*=1.-${f(LI.ak)}*v/${f(ASM_CM_U16)};s*=1.+${f(LI.win)}*(look?${f(LI.wd)}:1.)*(1.-2.*float(x)/S);
    vec3 c;if(uJm.z>.5){float tw;c=twill(si,x,y,s,tw);
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
/* one texture, nearest, from a typed array */
function asmGlTex(gl,unit,w,h,ifmt,fmt,type,data){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texStorage2D(gl.TEXTURE_2D,1,ifmt,w,h);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,w,h,fmt,type,data);return t}
/* the master's textures (once per master): ~ 16+32+32+32+64 MB at 2048 (keep as RGBA32F; opts.half: RGBA16F, 32 MB) */
function asmGlUpload(G,pk,opts={}){const gl=G.gl,S=pk.S,u=n=>gl.getUniformLocation(G.prog,n);gl.useProgram(G.prog);
  for(const t of G.tex||[])gl.deleteTexture(t);
  const keep=opts.half?asmGlHalf(pk.keep):pk.keep;
  G.tex=[asmGlTex(gl,0,S,S,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,pk.a),asmGlTex(gl,1,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.s4),
    asmGlTex(gl,2,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.l1),asmGlTex(gl,3,S,S,gl.RGBA16UI,gl.RGBA_INTEGER,gl.UNSIGNED_SHORT,pk.l2),
    opts.half?asmGlTex(gl,5,S,S,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT,keep):asmGlTex(gl,5,S,S,gl.RGBA32F,gl.RGBA,gl.FLOAT,keep),
    asmGlTex(gl,6,256,1,gl.R32F,gl.RED,gl.FLOAT,ASM_LIN),asmGlTex(gl,7,pk.tw,pk.th,gl.RG32F,gl.RG,gl.FLOAT,pk.tube),
    asmGlTex(gl,8,ASM_FLOW.nu,ASM_FLOW.nv,gl.RG32F,gl.RG,gl.FLOAT,pk.flow),asmGlTex(gl,9,S,1,gl.RG32I,gl.RG_INTEGER,gl.INT,pk.row)];
  [['uA',0],['uSh',1],['uL1',2],['uL2',3],['uBG',4],['uKeep',5],['uLin',6],['uTube',7],['uFlow',8],['uRow',9]].forEach(([n,i])=>gl.uniform1i(u(n),i));
  gl.uniform1i(u('uS'),S);gl.uniform4fv(u('uG'),pk.G);gl.uniform4fv(u('uFl'),pk.fl);gl.uniform2fv(u('uSm'),pk.sm);
  if(!G.fbo){G.out=gl.createTexture();gl.activeTexture(gl.TEXTURE15);gl.bindTexture(gl.TEXTURE_2D,G.out);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,S,S);
    G.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,G.out,0)}
  G.pack=pk;G.bgk=null;gl.finish()}
/* float32 -> float16 bits (round to nearest) */
function asmGlHalf(f){const o=new Uint16Array(f.length),b=new Float32Array(1),i=new Uint32Array(b.buffer);
  for(let q=0;q<f.length;q++){b[0]=f[q];const x=i[0],s=(x>>>16)&0x8000;let e=((x>>>23)&0xff)-127+15,m=x&0x7fffff;
    if(e<=0){if(e<-10){o[q]=s;continue}m=(m|0x800000)>>(1-e);o[q]=s|((m+0x1000)>>13);continue}if(e>=31){o[q]=s|0x7c00;continue}const h=s|(e<<10)|(m>>13);o[q]=h+((m&0x1000)?1:0)}return o}
/* the GL state for a size (created once; null without WebGL2) */
function asmGlInit(S){if(asmGlState&&asmGlState.S===S)return asmGlState;if(asmGlState===false)return null;const gl=asmGlContext(S);if(!gl){asmGlState=false;return null}
  try{asmGlState={gl,S,prog:asmGlProgram(gl),renderer:asmGlRenderer(gl)}}catch(e){console.warn('asm-gl',e);asmGlState=false;return null}return asmGlState}
/* one look's pixels on the GPU -> Uint8ClampedArray (RGBA, rows top-down, as asmCmBuild's before its buttons, clip and JPEG) */
async function asmGlPaint(G,job,P){const gl=G.gl,S=P.S,u=n=>gl.getUniformLocation(G.prog,n),L=ASM_LIN,LK=ASM_CM_LOOK;gl.useProgram(G.prog);
  const hexLin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2];
  // the background picture (kept while the same one comes back)
  const bk=job.bgt+'|'+S;if(G.bgk!==bk){const d=(await asmData(job.bg,S)).data;if(G.bgt)gl.deleteTexture(G.bgt);G.bgt=asmGlTex(gl,4,S,S,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,new Uint8Array(d.buffer,d.byteOffset,d.byteLength));G.bgk=bk}
  const cl=job.cloth,lookOf=f=>{const mx=Math.max(...f),mn=Math.min(...f),sat=mx>0?(mx-mn)/mx:0,y=lum(f);return {lift:LK.ymin*(1-LK.chroma*Math.min(1,sat/.7)),boost:1+LK.dk*Math.max(0,1-y/LK.dy)}};
  const J=hexLin(cl.jacket.hex),jl=lum(J)<LK.dark?lookOf(J):null,T=cl.jacket.suit;
  gl.uniform3fv(u('uJ'),T?Array.from(T.c):J);gl.uniform4f(u('uJm'),jl?1:0,jl?0:1,T?1:0,0);gl.uniform4f(u('uJl'),jl?jl.lift:0,jl?jl.boost:1,0,0);
  if(T){const C=T.cloth,ls=S/ASM_SIZE,lsc=ls*ASM_CM_KINDS[job.cm].pxmm;gl.uniform4f(u('uTw'),(C.pitch||4)*lsc,C.amp,C.fleck!=null?C.fleck:.08,C.c2?C.mix:0);gl.uniform3fv(u('uJ2'),C.c2||[0,0,0])}
  const St=hexLin(cl.shirt.hex),sl=lum(St)<LK.dark?lookOf(St):null;gl.uniform3fv(u('uSt'),St);gl.uniform4f(u('uSl'),sl?1:0,sl?0:1,sl?sl.lift:0,sl?sl.boost:1);
  const Ti=hexLin(cl.tie.hex);gl.uniform3fv(u('uTi'),Ti);gl.uniform1f(u('uTieK'),asmTieSheenK(lum(Ti)));gl.uniform1f(u('uLs'),S/ASM_SIZE);
  const f=J,Lf=Math.max(1e-4,lum(f));gl.uniform3fv(u('uBtn'),f.map(v=>v/Lf*.6+.4));
  gl.bindFramebuffer(gl.FRAMEBUFFER,G.fbo);gl.viewport(0,0,S,S);gl.drawArrays(gl.TRIANGLES,0,3);
  const o=new Uint8Array(4*S*S);gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,o);return new Uint8ClampedArray(o.buffer)}
/* asmCmBuild's twin: the GPU where it can, else the CPU painter. job.glKey keys the packed master (as asmCmBuild's setup key) */
async function asmGlBuild(job,opts={}){const key=job.cm+'|'+job.mk+'|'+job.mt+'|'+(job.rev||'')+'|'+job.size;
  if(!asmCmMem||!asmCmMem.list)asmCmMem={list:[]};let hit=asmCmMem.list.find(e=>e.key===key);
  if(!hit){while(asmCmMem.list.length)asmCmMem.list.shift();const P=await asmCmPrep(job);if(job.look!==false)P.lx=asmCmLightPrep(P);hit={key,P,lx:P.lx||null};asmCmMem.list.push(hit)}
  const P=hit.P;if(!P.lx&&hit.lx)P.lx=hit.lx;const why=asmGlCan(job,P),G=why?null:asmGlInit(P.S);if(!G)return {...await asmCmBuild(job),gl:false,why:why||'no WebGL2'};
  if(G.key!==key||G.half!==!!opts.half){if(!hit.glPack)hit.glPack=asmGlPack(P);asmGlUpload(G,hit.glPack,opts);G.key=key;G.half=!!opts.half}
  const S=P.S,o=await asmGlPaint(G,job,P);
  if(job.bar&&P.A.tie){const tm=new Uint8Array(P.N);for(let k=0;k<P.N;k++)tm[k]=P.A.tie[k]>127?1:0;asmBarDraw(o,tm,S,job.bar,null)}
  let img=new ImageData(o,S,S);
  if(S>ASM_SIZE){const big=asmCmCanvas(S,S);big.getContext('2d').putImageData(img,0,0);const sm=asmCmCanvas(ASM_SIZE,ASM_SIZE),x=sm.getContext('2d',{willReadFrequently:true});
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(big,0,0,ASM_SIZE,ASM_SIZE);img=x.getImageData(0,0,ASM_SIZE,ASM_SIZE)}
  return {url:await asmJpeg(img),gl:true}}
