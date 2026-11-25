/* Daily Wardrobe: the new garments' colour-coded masters (2026-11-16, the owner approved the casual garments from the trace mockup,
   C:\code\audit-2026-11-13\new-types-trace\new-types-mockup.html). Loaded after asm-color.js and asm-gl.js on the page and in
   asm-worker.js.

   Each casual top (core.js CASUAL_TOPS) has its own master traced from the open-collar shirt master (a T-shirt, a polo with its drawn knit
   collar, a henley, a crewneck sweater, a sweatshirt, a hoodie, a quarter-zip), and each casual jacket (CASUAL_JACKETS) one traced from the
   open-collar jacket master (a cardigan without lapels, a chore jacket with its collar as lapels). Their records are on the worker under
   their own kind (asmCmKey(kind, …)), uploaded by `npm run cm-upload` from the staged folders (C:\code\audit-2026-11-13\new-types-trace\
   UPLOAD.md); until a kind's master is there a day with that garment shows the drawing (asmCmUse null).

   Nothing here is in the painter's code fingerprint (asm-color.js asmCmCode / asmCmPrepCode), so no existing look repaints:
   - the kinds join ASM_CM_KINDS and ASM_CM_BTN as NON-ENUMERABLE properties: the painter finds them (ASM_CM_KINDS[job.cm]) but the
     fingerprint's JSON of those constants is unchanged; asm-gl.js's ASM_GL_KINDS takes them too (not fingerprinted)
   - the outfit's kind is asmCmKindOf(o), outside asmCmKind (fingerprinted, unchanged): the callers that make keys and fetch records
     (asmCmSig, asmCmStamp, asmCmEnsure, asmCmWarm, assemble.js asmCmUse, asmCmLook) ask it; the mannequin keeps asmCmKind's pose
   - the job is the base master's (asmCmJob, unchanged), then asmNkJob swaps in the new kind's master, masks, parts, solved positions and
     light map (as the mockup's paint-new2.js did) and the garment's own cloth (asmNkCloth: the sweater knit, a stripe, a heather)
   - a new-kind look's key carries the kind and 'nk' + asmNkSig() (this file's own code and constants, ASM_NKV), so a change here
     repaints only those looks
   Jeans (trousers kind 'jeans') on a master that shows trousers (shirt-open, shirt-tie and the seven tops) are painted on a faded copy of
   that master (record 'master-jeans': only the master's trousers pixels differ, lifted at the thigh fronts and knees, the mockup's
   jeansfade.py): only those looks' keys take 'jf' + the record's date, and only once the manifest lists it. */
const ASM_NKV=1;
/* the new kinds: their base master, lapels (the jacket masters), the shirt's or top's drawn buttons ([x, y, radius] at 2048, from each
   trace's report.json; the jackets keep the open shirt's), and the cloth family: jersey (T-shirt, polo, henley), fleece (sweatshirt,
   hoodie), knit (sweater, quarter-zip, cardigan), canvas (chore jacket) */
const ASM_NK={tee:{base:'shirt-open',cloth:'jersey'},polo:{base:'shirt-open',cloth:'jersey',btn:[[1023,300,9.5],[1023,388,9.5]]},
  henley:{base:'shirt-open',cloth:'jersey',btn:[[1023,238,9],[1023,292,9],[1023,346,9]]},sweater:{base:'shirt-open',cloth:'knit'},
  sweatshirt:{base:'shirt-open',cloth:'fleece'},hoodie:{base:'shirt-open',cloth:'fleece'},qzip:{base:'shirt-open',cloth:'knit'},
  cardigan:{base:'suit-open',lapels:0,cloth:'knit',btn:[[919,312,12],[974,508,12],[954,714,12]]},
  chore:{base:'suit-open',lapels:1,cloth:'canvas',btn:[[919,312,12],[974,508,12],[954,714,12]]}};
/* each cloth's light ([power below the lit level, highlight strength], as asm-color.js ASM_CM_MAT): jersey soft (the mockup's), fleece
   softer and flatter still (brushed loops: no sheen at all), knit as the knit tie, canvas crisp and matt like chinos */
const ASM_NK_MAT={jersey:[.96,.6],fleece:[.92,.3],knit:[.9,.4],canvas:[1.05,.7]};
/* the sweater knit (stockinette: columns of V stitches, each V two raised legs; a stitch about .73 as tall as wide, as a real gauge of
   22 stitches by 30 rows to 10 cm): the stitch's width in mm by the yarn: fine (merino, cashmere, cotton) 3, mid (wool, lambswool, blends,
   none given) 3.8, chunky (shetland, alpaca, mohair) 4.6 (a little coarser than life, so the stitches read at 2048: about 7, 8.5 and 10 px
   on the open-shirt masters, 10-15 on the cardigan's closer jacket master). `cols`/`rows` stitches a tile (yarn varies stitch by stitch,
   `vary`), relief `amp` lit from the upper left (`lit`), the gaps between columns `gap` darker */
const ASM_NK_KNIT={fine:3,mid:3.8,chunky:4.6,cols:8,rows:8,cw:12,ch:9,amp:.42,lit:.22,gap:.22,vary:.035,h:.73};
/* a jersey or fleece stripe (a Breton: about 12 mm a repeat, a third of it the stripe) and a heather's flecks (light and dark fibres,
   about a mm, ±`amp`) */
const ASM_NK_STRIPE={mm:12,share:.36},ASM_NK_HEATHER={T:64,mm:14,amp:.16,fleck:.5};
const asmNkBase=k=>ASM_NK[k]?ASM_NK[k].base:k;
/* the masters that show trousers: jeans there are painted on the faded copy */
const ASM_JF_BASES=['shirt-open','shirt-tie'];
const asmJfKey=k=>asmCmKey(k,'master-jeans');
/* the look's faded master, when its trousers are jeans and the manifest lists one for its kind: {key, t}, else null */
const asmJfWants=(o,k)=>{const b=o&&o.bot;if(!k||!b||b.type!=='pants'||b.trouserKind!=='jeans'||!ASM_JF_BASES.includes(asmNkBase(k)))return null;
  const key=asmJfKey(k),t=asmCmMfNow().keys[key];return t?{key,t}:null};
/* the master an outfit is painted on, the new kinds included (page only: it reads core.js): a casual top with no jacket and no tie, on
   trousers and a belt, is its own kind; a cardigan or chore jacket over a dress shirt with no tie, its own; any other outfit with a casual
   piece (a casual top under a jacket, a casual jacket with a tie or over a casual top) has no master (null: the drawing); else asmCmKind */
function asmCmKindOf(o){const k=asmCmKind(o);if(!o||typeof CASUAL_TOPS==='undefined')return k;
  const ct=!!(o.shirt&&CASUAL_TOPS.includes(o.shirt.type)),cj=!!(o.top&&CASUAL_JACKETS.includes(o.top.type));if(!ct&&!cj)return k;if(!k)return null;
  if(ct&&!cj&&!o.top&&!o.tie&&k==='shirt-open'&&ASM_NK[o.shirt.type])return o.shirt.type;
  if(cj&&!ct&&!o.tie&&!o.vest&&k==='suit-open'&&o.top.type!=='blouse'&&ASM_NK[o.top.type])return o.top.type;
  // the uniform blouse (asm-ocp.js, 2026-11-17) over a T-shirt, no tie, on pants and a belt: its own master (2026-11-20: from the
  // owner's photo, on the open-shirt master's items; sleeves down: rolled sleeves have no master); over anything else none (the drawing)
  if(cj&&ct&&o.top.type==='blouse'&&o.shirt.type==='tee'&&!o.tie&&!o.vest&&k==='suit-open'&&o.bot&&o.belt&&ASM_NK.blouse)return 'blouse';
  return null}
/* the records a look needs on this device: the base master's too (asmCmJob builds the cloth on it) and the faded master for jeans */
async function asmNkGet(o,k){const b=asmNkBase(k);if(b!==k&&!await asmCmGet(b))return false;if(!await asmCmGet(k))return false;
  const jf=asmJfWants(o,k);if(jf&&!renders[jf.key])await asmGet(jf.key,true);return true}
/* ---- the cloths ---- */
const asmNkLin=h=>{const L=ASM_LIN;h=String(h||'#808080').replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
/* a seeded random (a tile is the same every time it is made) */
const asmNkRnd=seed=>{let s=(seed>>>0)||1;return ()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296};
/* the stitch's width (mm) by the yarn */
const asmNkStitchMm=i=>{const K=ASM_NK_KNIT,m=String(i&&i.material||'').toLowerCase();return /shetland|alpaca|mohair/.test(m)?K.chunky:/merino|cashmere(?! blend)|cotton/.test(m)?K.fine:K.mid};
/* the second colour of a stripe: the item's own, else navy on a light top and cream on a dark one */
const asmNkSecond=i=>{const c=i.secondaryColor&&i.secondaryColor!=='none'&&COLORS[i.secondaryColor];if(c)return c;const [r,g,b]=asmNkLin(colOf(i));return .2126*r+.7152*g+.0722*b>.25?'#1f2a44':'#ece6d6'};
/* the knit's relief (height 0-1) at a point of one stitch (u across 0-1, v down 0-1): two legs, each a raised oval leaning out at the
   top, the V's point tucked into the stitch below */
function asmNkLeg(u,v){let h=0;for(const dv of [-1,0,1])for(const s of [-1,1]){const cx=.5+s*.24,cy=.5,dx=u-cx,dy=v+dv-cy,a=s*.38,
    x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a),r=(x/.19)**2+(y/.7)**2;if(r<1)h=Math.max(h,Math.pow(1-r,.6))}return h}
/* the sweater knit tile (cable on 'cable': two ropes crossing in a 6-stitch panel between purl columns) -> {t, TW, TH, mm} in the item's
   linear colour, its mean that colour; stripes and heather on the stitches when the pattern says so */
function asmNkKnitTile(i){const K=ASM_NK_KNIT,pat=String(i.pattern||'solid'),cable=pat==='cable',TW=K.cols*K.cw,TH=K.rows*K.ch,n=TW*TH,b=new Float32Array(n),rnd=asmNkRnd(7+(cable?11:0)),
    vary=Array.from({length:K.cols*K.rows*2},()=>1+K.vary*(2*rnd()-1));
  const H=(u,v)=>{if(!cable)return asmNkLeg(((u%1)+1)%1,((v%1)+1)%1);
    // cable: per 8 columns, a 6-stitch panel (cols 1..6) of two ropes, purl ridges (cols 0 and 7) between; the ropes cross once a tile
    const cu=((u%K.cols)+K.cols)%K.cols,vv=((v%K.rows)+K.rows)%K.rows;if(cu<1||cu>=7){const r=(vv*2)%1;return .3+.2*Math.pow(Math.sin(Math.PI*r),2)}   // purl: small ridges across
    const p=(cu-1)/6,ph=vv/K.rows*2*Math.PI,a=.5+.24*Math.cos(ph),c=.5-.24*Math.cos(ph),top=Math.sin(ph)>0;   // the ropes' centres across the panel
    const rope=(x0)=>{const d=Math.abs(p-x0)/.2;return d<1?Math.pow(1-d*d,.5):0},ra=rope(a),rc=rope(c),st=asmNkLeg(((u%1)+1)%1,((v%1)+1)%1);
    const r1=top?Math.max(ra,rc*.8):Math.max(rc,ra*.8);return r1>0?.45+.4*r1*(.7+.3*st):.3};
  // the relief, lit from the upper left, darker in the gaps between columns
  const cw=K.cw,ch=K.ch,hh=new Float32Array(n);for(let y=0;y<TH;y++)for(let x=0;x<TW;x++)hh[y*TW+x]=H((x+.5)/cw,(y+.5)/ch);
  let m=0;for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){const k=y*TW+x,h=hh[k],hx=hh[y*TW+(x+1)%TW]-hh[y*TW+(x+TW-1)%TW],hy=hh[((y+1)%TH)*TW+x]-hh[((y+TH-1)%TH)*TW+x];
    const s=Math.floor(x/cw)+K.cols*Math.floor(y/ch)+(((x%cw)<cw/2)?0:K.cols*K.rows),fu=((x+.5)/cw)%1,du=Math.min(fu,1-fu),val=(1+K.amp*(h-.5)-K.lit*(hx+hy))*(1-K.gap*Math.exp(-((du/.07)**2)))*vary[s];
    b[k]=Math.max(.05,val);m+=b[k]}
  m/=n;const c1=asmNkLin(colOf(i)),c2=asmNkLin(asmNkSecond(i)),t=new Float32Array(3*n);
  for(let y=0;y<TH;y++){const row=Math.floor(y/ch),band=pat==='stripe'&&(row%K.rows)<3;   // a stripe: three rows in eight
    for(let x=0;x<TW;x++){const k=y*TW+x,c=band?c2:c1,f=b[k]/m;let g=1;if(pat==='heather'){const leg=Math.floor(x/(cw/2))+2*K.cols*row;g=1+ASM_NK_HEATHER.amp*((((leg*2654435761)>>>0)%1000)/500-1)}
      for(let q=0;q<3;q++)t[3*k+q]=Math.min(1,c[q]*f*g)}}
  return {t,TW,TH,mm:K.cols*asmNkStitchMm(i),fine:false,knit:true}}
/* a jersey or fleece top's stripe (Breton bands) or heather (flecks), or null for a plain one (painted flat) */
function asmNkTopTile(i){const pat=String(i.pattern||'solid');
  if(pat==='stripe'){const S=ASM_NK_STRIPE,TW=8,TH=64,t=new Float32Array(3*TW*TH),c1=asmNkLin(colOf(i)),c2=asmNkLin(asmNkSecond(i)),cut=Math.round(TH*S.share);
    for(let y=0;y<TH;y++){const c=y<cut?c2:c1;for(let x=0;x<TW;x++)for(let q=0;q<3;q++)t[3*(y*TW+x)+q]=c[q]}
    return {t,TW,TH,mm:S.mm*TW/TH,fine:false}}
  if(pat==='heather'){const E=ASM_NK_HEATHER,T=E.T,n=T*T,t=new Float32Array(3*n),c=asmNkLin(colOf(i)),r=asmNkRnd(31),f=new Float32Array(n);let m=0;
    // flecks: short horizontal fibres, lighter and darker, over a fine noise
    for(let k=0;k<n;k++)f[k]=1+E.amp*.3*(2*r()-1);
    for(let j=0;j<n*E.fleck/4;j++){const x=Math.floor(r()*T),y=Math.floor(r()*T),len=2+Math.floor(r()*4),s=r()<.5?1+E.amp:1-E.amp;for(let d=0;d<len;d++)f[y*T+(x+d)%T]*=s}
    for(let k=0;k<n;k++)m+=f[k];m/=n;for(let k=0;k<n;k++)for(let q=0;q<3;q++)t[3*k+q]=Math.min(1,c[q]*f[k]/m);
    return {t,TW:T,TH:T,mm:E.mm,fine:false}}
  return null}
/* the casual garment's cloth in the job (z: 'shirt' for a top, 'jacket' for a cardigan or chore jacket): its material's light and its
   tile; the base job's drawing of it (asmCmTile, from draw.js casualTile) is replaced */
function asmNkCloth(i,kind,c){const N=ASM_NK[kind],o={hex:(c&&c.hex)||colOf(i),mat:ASM_NK_MAT[N.cloth]||[1,1]};
  const T=N.cloth==='knit'?asmNkKnitTile(i):N.cloth==='canvas'?null:asmNkTopTile(i);if(T)o.tile=T;return o}
/* the job for a look (assemble.js asmJob, after asm-color.js asmCmJob built the base master's): the new kind's records and cloth, and the
   faded master for jeans; null when a record it needs isn't on this device */
async function asmNkJob(j,o,k){if(!j)return j;const N=ASM_NK[k];
  if(N){const B=asmCmBaseJob(k,j.size);if(!B)return null;for(const f of ['geoU','geoV','gt','light'])delete j[f];Object.assign(j,B);
    const lks=asmCmLightKeys(k);if(lks.length)j.light=renders[lks[0]].img;
    const z=N.base==='suit-open'?'jacket':'shirt',it=z==='jacket'?o.top:o.shirt;j.cloth={...j.cloth,[z]:asmNkCloth(it,k,j.cloth[z])}}
  const jf=asmJfWants(o,k);if(jf){const r=renders[jf.key];if(!r)return null;j.master=r.img;j.mk=jf.key;j.mt=r.t}
  return j}
/* this file's painting code, for the new looks' keys (asmCmSig: 'nk' + it) */
const asmNkCode=()=>[ASM_NKV,ASM_NK,ASM_NK_MAT,ASM_NK_KNIT,ASM_NK_STRIPE,ASM_NK_HEATHER,ASM_JF_BASES,asmNkLin,asmNkRnd,asmNkStitchMm,asmNkSecond,asmNkLeg,asmNkKnitTile,asmNkTopTile,asmNkCloth,asmNkJob,asmJfWants];
let asmNkH=null;
const asmNkSig=()=>asmNkH||(asmNkH=asmCmHash(asmCmCodeText(asmNkCode())));
/* the bridge (an ES module since C3, 2026-11-24): what the classic scripts, the other modules, asm-worker.js and the tests still use as globals (tests/bridge.test.js lists who) */
Object.assign(globalThis,{ASM_NK,asmNkBase,asmJfWants,asmCmKindOf,asmNkGet,asmNkJob,asmNkSig});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,ASM_JF_BASES,ASM_NK_KNIT,asmJfKey,asmNkCloth,asmNkKnitTile,asmNkLin};
export {ASM_NK,ASM_NK_KNIT,asmNkBase,ASM_JF_BASES,asmJfKey,asmJfWants,asmCmKindOf,asmNkGet,asmNkLin,asmNkKnitTile,asmNkCloth,asmNkJob,asmNkSig};
/* (below the bridge: it reads asm-color.js's and asm-gl.js's tables at load, and throws without them) */
/* the kinds into the painter's tables, invisibly to its fingerprint (runs on the page and in the worker) */
(()=>{const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  for(const [k,v] of Object.entries(ASM_NK)){const B=ASM_CM_KINDS[v.base];
    if(!own(ASM_CM_KINDS,k))Object.defineProperty(ASM_CM_KINDS,k,{value:{...B,zones:[...B.zones],lapels:v.lapels!=null?v.lapels:B.lapels},enumerable:false});
    if(v.btn&&!own(ASM_CM_BTN,k))Object.defineProperty(ASM_CM_BTN,k,{value:v.btn,enumerable:false});
    if(typeof ASM_GL_KINDS!=='undefined')ASM_GL_KINDS.add(k)}})();
