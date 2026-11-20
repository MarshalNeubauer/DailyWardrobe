/* Daily Wardrobe: the OCP uniform blouse's colour-coded master and the OCP cloth on painted pictures (2026-11-17, the owner's uniform
   blouse; mockups, builds and the master's tools in C:\code\audit-2026-11-13\ocp-blouse\). Loaded after asm-kinds.js on the page and in
   asm-worker.js.

   (2026-11-20, option A) The master is made from the owner's own photo of himself in his blouse (ocp-blouse\tools\build_photo.py, no
   image generation), in his own hands-on-hips pose, cropped at the neck, on the open-collar shirt master's zones: the blouse as
   photographed (cloth, pockets, tapes, unit patch, sleeves, folds) is the 'dark' zone, kept as it is (the blouse is always OCP, never
   recoloured); his neck and hands are skin (kept); the T-shirt at the collar is the shirt zone (the day's T-shirt, jersey) and the pants
   below the hem the trousers zone (the day's pants; OCP pants in the OCP cloth); belt, buckle, watch and the sleeve parts are empty (the
   blouse covers them, so no watch or pocket square is painted). It is PERSONAL: its records go to the worker by `npm run cm-upload` from
   the owner's staged folder (ocp-blouse\UPLOAD.md) but never into the testers' shared list (tools/asm-cm-upload.js PERSONAL), so a tester's
   blouse shows the drawing (asmCmUse null), as does anyone's until the master is uploaded. Nothing of it is in the repo: the tests paint a
   made-up stand-in (tests/fixtures/cm/blouse, ocp-blouse\tools\make_fixtures_synth.py).

   Nothing here is in the painter's code fingerprint (asm-color.js asmCmCode / asmCmPrepCode) or asm-kinds.js's (asmNkCode):
   - the kind joins ASM_NK, ASM_CM_KINDS as a NON-ENUMERABLE property (asmNkBase, asmNkJob and the painter find it; the fingerprints'
     JSON doesn't), and ASM_GL_KINDS
   - the look's kind is asm-kinds.js asmCmKindOf: the blouse over a T-shirt, no tie, on pants and a belt (the open-shirt master's items)
   - the job: assemble.js asmJob builds the base job from the outfit without the blouse (asmOcpBase: the open-shirt master's T-shirt,
     trousers and belt), asmNkJob swaps in this master and the T-shirt's jersey, and asmOcpJob last drops the watch and pocket square,
     adds the rank and puts OCP pants in the OCP cloth (on any master that shows pants)
   - the keys: a blouse look's carries its kind, 'nk' + asmNkSig, the items (T-shirt, pants, belt) and the rank (asmOcpSig); OCP pants'
     sett signatures carry OCP_V (detect.js ocpSett): bump core.js OCP_V whenever the OCP cloth changes */
const ASM_OCP_KINDS={blouse:{base:'shirt-open',lapels:0,cloth:'jersey'}};
(()=>{const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  for(const [k,v] of Object.entries(ASM_OCP_KINDS)){const B=ASM_CM_KINDS[v.base];
    if(!own(ASM_NK,k))Object.defineProperty(ASM_NK,k,{value:v,enumerable:false});
    if(!own(ASM_CM_KINDS,k))Object.defineProperty(ASM_CM_KINDS,k,{value:{...B,zones:[...B.zones],lapels:v.lapels},enumerable:false});
    if(typeof ASM_GL_KINDS!=='undefined')ASM_GL_KINDS.add(k)}})();
/* the outfit the base job is built from: a blouse look's without the blouse (the open-shirt master's items), any other as it is */
const asmOcpBase=(o,k)=>ASM_OCP_KINDS[k]&&o?{...o,top:null}:o;
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
/* the job's last step (assemble.js asmJob, after the watch and pocket square): on the blouse's master no watch or pocket square (the
   blouse covers the wrist and has no breast pocket) and the rank on the chest tab; OCP pants in the OCP cloth on any master */
function asmOcpJob(j,o,k){if(!j||!j.cloth)return j;
  if(ASM_OCP_KINDS[k]){delete j.watch;delete j.pocket;const D=asmOcpDecal(o.top);if(D)j.ocpDecal=D}
  const tr=j.cloth.trousers;if(tr&&tr.suit&&o.bot&&typeof isOcp==='function'&&isOcp(o.bot)){const T=asmOcpTex(o.bot);if(T)j.cloth={...j.cloth,trousers:{...tr,suit:T}}}
  return j}
/* ---- the rank (2026-11-18, the owner: per item, not in the code or the master) ----
   The master's chest tab is blank (build_photo.py cloned the photo's Captain bars out). The page draws the item's insignia (draw.js
   OCP_RANK_SVG: the Major's oak leaf traced to his own, photo 2) as an alpha mask (asmOcpDecal), placed as on his tab (upper middle, about
   half the tab wide), and the painter lays it on the finished picture in spice brown, following the tab's own light (asmOcpPaint, from
   assemble.js asmBuildAfter, like the watch and the pocket square); the look's key carries the rank (asmOcpSig, in asm-color.js
   asmCmSig). The tapes on the master are his own as photographed, so no tape text is painted (the fields still draw the item's
   drawing). Bump ASM_OCP_DECV when the drawing of the insignia changes */
const ASM_OCP_BOX={rank:[1092,556,76,84]},ASM_OCP_INK='#55352B',ASM_OCP_DECV=2;
const asmOcpSig=(o,k)=>ASM_OCP_KINDS[k]&&o&&o.top&&typeof blouseTapes==='function'?'rank:'+ASM_OCP_DECV+'/'+(blouseTapes(o.top).rank||''):'';
/* the mask (page only: a canvas draws it): {ink, boxes:[{x, y, w, h, img}]} with the box's mask at 2x, or null with no rank */
function asmOcpDecal(it){if(typeof document==='undefined'||typeof blouseTapes!=='function')return null;const T=blouseTapes(it),boxes=[],K=2;
  const mk=(b,draw)=>{const [x,y,w,h]=b,c=document.createElement('canvas');c.width=w*K;c.height=h*K;const g=c.getContext('2d');if(!g)return;g.scale(K,K);g.fillStyle='#fff';draw(g,w,h);boxes.push({x,y,w,h,img:c.toDataURL('image/png')})};
  if(T.rank&&typeof OCP_RANK_SVG!=='undefined'&&OCP_RANK_SVG[T.rank])mk(ASM_OCP_BOX.rank,(g,w,h)=>{const p=new Path2D(OCP_RANK_SVG[T.rank]),s=Math.min(w,h)/100;g.translate((w-100*s)/2,(h-100*s)/2);g.scale(s,s);g.fill(p)});
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
