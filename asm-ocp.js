/* Daily Wardrobe: the OCP uniform blouse's colour-coded masters and the OCP cloth on painted pictures (2026-11-17, the owner's uniform
   blouse; mockup and build in C:\code\audit-2026-11-13\ocp-blouse\). Loaded after asm-kinds.js on the page and in asm-worker.js.

   Two masters traced from a copy of the open-collar jacket master (ocp-blouse\tools\build_ocp.py, no image generation): 'blouse' (sleeves
   down) and 'blouse-roll' (sleeves rolled above the elbow, bare forearms): the front zipped to the upper chest with a covered placket, a
   crew-neck T-shirt in the small V (the shirt zone), the OCP collar as the lapel parts, angled chest pockets with flaps, the name and
   service tapes and the shoulder pockets' hook-and-loop fields drawn in the 'dark' zone (kept as drawn), plain cuffs with tabs. Their
   records are on the worker under their own kind, uploaded by `npm run cm-upload` from the staged folders (ocp-blouse\UPLOAD.md); until
   then a day with the blouse shows the drawing (asmCmUse null).

   Nothing here is in the painter's code fingerprint (asm-color.js asmCmCode / asmCmPrepCode) or asm-kinds.js's (asmNkCode):
   - the kinds join ASM_NK, ASM_CM_KINDS as NON-ENUMERABLE properties (asmNkBase, asmNkJob and the painter find them; the fingerprints'
     JSON doesn't), and ASM_GL_KINDS
   - the look's kind is asm-kinds.js asmCmKindOf: the blouse over a T-shirt, no tie ('blouse-roll' with o.rolled)
   - the cloth: assemble.js asmJob calls asmOcpJob after asmNkJob, with the base job's cloth: the blouse's OCP blotches (core.js ocpImage) as
     the jacket's cloth in canvas light, the T-shirt in jersey (asm-kinds.js asmNkCloth as on the T-shirt master); OCP pants on any master
     that shows pants take the same OCP cloth in place of the generic camouflage's
   - the keys: a blouse look's carries its kind, 'nk' + asmNkSig and the items' sett signatures (detect.js ocpSett: the OCP palette and a
     seed with OCP_V), so a new OCP look repaints only OCP looks: bump core.js OCP_V whenever the OCP cloth or this file's painting changes */
const ASM_OCP_KINDS={blouse:{base:'suit-open',lapels:1,cloth:'canvas'},'blouse-roll':{base:'suit-open',lapels:1,cloth:'canvas'}};
(()=>{const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  for(const [k,v] of Object.entries(ASM_OCP_KINDS)){const B=ASM_CM_KINDS[v.base];
    if(!own(ASM_NK,k))Object.defineProperty(ASM_NK,k,{value:v,enumerable:false});
    if(!own(ASM_CM_KINDS,k))Object.defineProperty(ASM_CM_KINDS,k,{value:{...B,zones:[...B.zones],lapels:v.lapels},enumerable:false});
    if(typeof ASM_GL_KINDS!=='undefined')ASM_GL_KINDS.add(k)}})();
/* the OCP cloth for the painter: OCP_TEX px a side, OCP_CAMO.mm wide on the cloth (the same mm as asmCamoTex's), linear light; kept per seed */
const ASM_OCP_TEX=1024,ASM_OCP_RIP=13,asmOcpMemo=new Map();   // (the grid: 13 px of the 1024 tile, OCP_CAMO.mm 450 wide: about 5.7 mm)
function asmOcpTex(i){const s=typeof usableSett==='function'?usableSett(i):null;if(!s||!s.ocp)return null;const k=s.camo.seed;if(asmOcpMemo.has(k))return asmOcpMemo.get(k);
  const N=ASM_OCP_TEX,L=ASM_LIN,im=ocpImage(N,k),t=new Float32Array(3*N*N);for(let q=0;q<3*N*N;q++)t[q]=L[im[q]];
  // (2026-11-18, the owner: "real ripstop OCP cloth, not a flat print") the ripstop grid: a heavier thread every ASM_OCP_RIP of the tile
  // (about 5.5 mm), its line a little darker with a faint lighter shoulder, and a fine plain-weave grain between
  const P=ASM_OCP_RIP,rip=new Float32Array(N);for(let x=0;x<N;x++){const d=Math.min(x%P,P-x%P);rip[x]=d<1?.9:d<2?1.03:1}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const g=rip[x]*rip[y]*(1+.025*(((x*13+y*7)%3)-1)),o=3*(y*N+x);t[o]*=g;t[o+1]*=g;t[o+2]*=g}
  const h=String(s.camo.cols[0]).replace('#',''),c=new Float32Array([0,2,4].map(q=>L[parseInt(h.slice(q,q+2),16)||0]));
  const T={t,c,TW:N,TH:N,mm:OCP_CAMO.mm,linen:false,cloth:null};if(asmOcpMemo.size>2)asmOcpMemo.clear();asmOcpMemo.set(k,T);return T}
/* the job's OCP cloth (assemble.js asmJob: after asmNkJob, with the base job's cloth c0) */
function asmOcpJob(j,o,k,c0){if(!j||!j.cloth)return j;
  if(ASM_OCP_KINDS[k]){const T=o.top&&asmOcpTex(o.top),jc=(c0&&c0.jacket)||j.cloth.jacket;
    j.cloth={...j.cloth,shirt:asmNkCloth(o.shirt,'tee',c0&&c0.shirt),jacket:T?{...jc,suit:T,mat:ASM_NK_MAT.canvas}:{...j.cloth.jacket}};
    const D=asmOcpDecal(o.top);if(D)j.ocpDecal=D;return j}
  const tr=j.cloth.trousers;if(tr&&tr.suit&&o.bot&&typeof isOcp==='function'&&isOcp(o.bot)){const T=asmOcpTex(o.bot);if(T)j.cloth={...j.cloth,trousers:{...tr,suit:T}}}
  return j}
/* ---- the tapes' text and the rank (2026-11-18, the owner: per item, not in the code or the masters) ----
   The masters carry blank tapes and a blank chest tab (build_ocp.py: these boxes, at 2048). The page draws the item's text and insignia
   (core.js blouseTapes; draw.js OCP_RANK_SVG) as alpha masks (asmOcpDecal), and the painter lays them on the finished picture in spice brown,
   following the tape's own light (asmOcpPaint, from assemble.js asmBuildAfter, like the watch and the pocket square); the look's key carries
   the text and rank (asmOcpSig, in asm-color.js asmCmSig). Bump ASM_OCP_DECV when the drawing of the text or insignia changes */
const ASM_OCP_BOX={name:[449,445,392,78],service:[1109,445,392,78],rank:[897,455,156,186]},ASM_OCP_INK='#5E3F2A',ASM_OCP_DECV=1;
const asmOcpSig=(o,k)=>ASM_OCP_KINDS[k]&&o&&o.top&&typeof blouseTapes==='function'?'tapes:'+ASM_OCP_DECV+'/'+JSON.stringify(blouseTapes(o.top)):'';
/* the masks (page only: a canvas draws the text): {ink, boxes:[{x, y, w, h, img}]} with each box's mask at 2x, or null with nothing to draw */
function asmOcpDecal(it){if(typeof document==='undefined'||typeof blouseTapes!=='function')return null;const T=blouseTapes(it),boxes=[],K=2;
  const mk=(b,draw)=>{const [x,y,w,h]=b,c=document.createElement('canvas');c.width=w*K;c.height=h*K;const g=c.getContext('2d');if(!g)return;g.scale(K,K);g.fillStyle='#fff';draw(g,w,h);boxes.push({x,y,w,h,img:c.toDataURL('image/png')})};
  for(const k of ['name','service'])if(T[k])mk(ASM_OCP_BOX[k],(g,w,h)=>{g.font=`700 ${Math.round(h*.6)}px "Arial Narrow","Roboto Condensed","Helvetica Neue",Arial,sans-serif`;
    const m=g.measureText(T[k]).width||1,s=Math.min(1,w*.86/m);g.textBaseline='middle';g.translate(w/2,h*.53);g.scale(s,1);g.textAlign='center';g.fillText(T[k],0,0)});
  if(T.rank&&typeof OCP_RANK_SVG!=='undefined'&&OCP_RANK_SVG[T.rank])mk(ASM_OCP_BOX.rank,(g,w,h)=>{const p=new Path2D(OCP_RANK_SVG[T.rank]),s=Math.min(w*.86,h*.8)/100;g.translate((w-100*s)/2,(h-100*s)/2);g.scale(s,s);g.fill(p)});
  return boxes.length?{ink:ASM_OCP_INK,boxes}:null}
/* lay the masks on the picture: the ink takes the tape's light (the pixel's lightness over the tape's mean in the box) */
async function asmOcpPaint(res,D){if(!res||!D||!D.boxes)return res;let img=null,px,S;
  if(res.px){px=res.px;S=res.S}else if(res.url){img=await asmData(res.url);px=img.data;S=img.width}else return res;
  const L=srgbLin8,G=linSrgb8,ink=[1,3,5].map(i=>L(parseInt(D.ink.slice(i,i+2),16))),f=S/2048,Y=i=>.2126*L(px[i])+.7152*L(px[i+1])+.0722*L(px[i+2]);
  for(const b of D.boxes){const m=await asmData(b.img),MW=m.width,MH=m.height,x0=Math.floor(b.x*f),y0=Math.floor(b.y*f),x1=Math.ceil((b.x+b.w)*f),y1=Math.ceil((b.y+b.h)*f);
    let s=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){if(x<0||y<0||x>=S||y>=S)continue;s+=Y(4*(y*S+x));n++}const mean=n?s/n:1;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){if(x<0||y<0||x>=S||y>=S)continue;
      const u=Math.min(MW-1,Math.max(0,Math.floor(((x+.5)/f-b.x)/b.w*MW))),v=Math.min(MH-1,Math.max(0,Math.floor(((y+.5)/f-b.y)/b.h*MH))),a=m.data[4*(v*MW+u)+3]/255;if(a<=0)continue;
      const i=4*(y*S+x),sh=Math.min(1.25,Math.max(.5,Y(i)/Math.max(1e-4,mean)));for(let q=0;q<3;q++){const cur=L(px[i+q]);px[i+q]=G(cur*(1-a)+ink[q]*sh*a)}}}
  if(img)res.url=await asmJpeg(img);return res}
