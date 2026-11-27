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
import {serve} from './bus.js';
import {ASM_CM_KINDS} from './asm-keys.js';
import {ASM_LIN} from './assemble.js';
import {ASM_CM_BTN} from './asm-color.js';
import {ASM_GL_KINDS} from './asm-gl.js';
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
/* ---- the cloths ---- */
const asmNkLin=h=>{const L=ASM_LIN;h=String(h||'#808080').replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
/* a seeded random (a tile is the same every time it is made) */
const asmNkRnd=seed=>{let s=(seed>>>0)||1;return ()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296};
/* the stitch's width (mm) by the yarn */
const asmNkStitchMm=i=>{const K=ASM_NK_KNIT,m=String(i&&i.material||'').toLowerCase();return /shetland|alpaca|mohair/.test(m)?K.chunky:/merino|cashmere(?! blend)|cotton/.test(m)?K.fine:K.mid};
/* the knit's relief (height 0-1) at a point of one stitch (u across 0-1, v down 0-1): two legs, each a raised oval leaning out at the
   top, the V's point tucked into the stitch below */
function asmNkLeg(u,v){let h=0;for(const dv of [-1,0,1])for(const s of [-1,1]){const cx=.5+s*.24,cy=.5,dx=u-cx,dy=v+dv-cy,a=s*.38,
    x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a),r=(x/.19)**2+(y/.7)**2;if(r<1)h=Math.max(h,Math.pow(1-r,.6))}return h}
/* (below the bridge: it reads asm-color.js's and asm-gl.js's tables at load, and throws without them) */
/* the kinds into the painter's tables, invisibly to its fingerprint (runs on the page and in the worker) */
(()=>{const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  for(const [k,v] of Object.entries(ASM_NK)){const B=ASM_CM_KINDS[v.base];
    if(!own(ASM_CM_KINDS,k))Object.defineProperty(ASM_CM_KINDS,k,{value:{...B,zones:[...B.zones],lapels:v.lapels!=null?v.lapels:B.lapels},enumerable:false});
    if(v.btn&&!own(ASM_CM_BTN,k))Object.defineProperty(ASM_CM_BTN,k,{value:v.btn,enumerable:false});
    if(typeof ASM_GL_KINDS!=='undefined')ASM_GL_KINDS.add(k)}})();
/* sockets (bus.js; the restructure S6p, 2026-11-27): a new garment's base master (asm-color.js asmNkBaseOf, which loads before this file) */
serve('asm-nk-base',asmNkBase);
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,ASM_JF_BASES,ASM_NK_KNIT,asmNkLin,ASM_NK,asmNkBase};
export {ASM_NK,ASM_NK_KNIT,asmNkBase,ASM_JF_BASES,asmNkLin,asmNkRnd,asmNkStitchMm,asmNkLeg,ASM_NK_HEATHER,ASM_NK_STRIPE,ASM_NK_MAT,ASM_NKV};
