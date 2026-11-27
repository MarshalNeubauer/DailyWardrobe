/* Daily Wardrobe: a look's job for the color-coded painter, worked out on the page (the restructure S6p, 2026-11-27: moved out of
   asm-color.js, asm-watch.js, asm-pocket.js, asm-kinds.js and asm-ocp.js with their text unchanged, so the painting worker's files read
   no page file): which master and cloth a look takes (asmCmKind, asmCmRoute's helpers), its cloth tiles (close-up, worsted, pile, knit,
   paisley, camouflage, OCP), the new garments' masters, the watch's and pocket square's parts, and the master's records' keys. It reads
   core.js, detect.js, draw.js and photo-keys.js; lab/gl-bench.html loads it too. */
import {ask,serve,served} from './bus.js';
import {CASUAL_JACKETS,CASUAL_TOPS,COLORS,OCP_CAMO,blouseTapes,camoImage,colOf,dressOut,inRotation,isOcp,items,ocpImage,patBase,patName,trouserKind,watchOpts,esc} from './core.js';
import {CAMO_TR,CHECK_PATS,STRIPE_PATS,settSig,usableSett} from './detect.js';
import {fnv64,renders} from './photo-keys.js';
import {ASM_CMV,ASM_CM_KINDS} from './asm-keys.js';
import {ASM_BAR_AT,ASM_BAR_LEN,ASM_BAR_MM,ASM_CLOSEUP_MM,ASM_CREASE_DEG,ASM_FLOW,ASM_FORE_K,ASM_HB_AMP,ASM_HB_BREAK,ASM_HB_FLECK,ASM_HB_FLOAT,ASM_HB_FLOATL,ASM_HB_GRAIN,ASM_HB_MM,ASM_HB_MOTTLE,ASM_HB_PBRK,ASM_HB_RIB,ASM_HB_SNAP,ASM_HB_SOFT,ASM_HB_THIN,ASM_HB_TR,ASM_HB_YARN,ASM_LIN,ASM_LINE_PX,ASM_METAL,ASM_MICRO,ASM_MICRO_KINDS,ASM_ON,ASM_PX_MM,ASM_SHIRT_MM,ASM_SIZE,ASM_SLEEVE_FLOW,ASM_STRIPE,ASM_STRIPE_PX,ASM_SUITV,ASM_TEX_MIN_MM,ASM_TIEV,ASM_TIE_FIG_MAX,ASM_TIE_TEX_MAX,ASM_TR_CAP,ASM_TUBE_K,ASM_TWEED,ASM_TWILL,asmAreas,asmBarDraw,asmBodyFlow,asmData,asmFlowAt,asmHbCw,asmImg,asmJpeg,asmLinen,asmLinenTile,asmMicroGrid,asmPolyAt,asmRepeatPx,asmSleeveFlow,asmSleeveSegs,asmStripeCount,asmTexMm,asmTq,asmTqn,asmTqr,asmTried,asmTubeAt,asmTubePart,asmTubePartQ,asmTubeRaw,asmTubeTabs,asmTweedTile} from './assemble.js';
import {ASM_WATCHV,ASM_WATCH_GEO,ASM_WATCH_MASTER,ASM_WATCH_STRAPS,asmWatchMetal} from './asm-watch.js';
import {ASM_POCKETV,asmPocketQuad} from './asm-pocket.js';
import {ASM_CAMO,ASM_CELL_FADE,ASM_CM_AA,ASM_CM_AA_CUT,ASM_CM_AA_FADE,ASM_CM_BG_SHADOW,ASM_CM_BTN,ASM_CM_BTNV,ASM_CM_BTN_MIX,ASM_CM_BTN_PEARL,ASM_CM_COLLAR,ASM_CM_CUFF_PX,ASM_CM_CUFF_STEP,ASM_CM_FIN,ASM_CM_FOLD,ASM_CM_FOLD_KEEP,ASM_CM_FOLD_MAX,ASM_CM_FOLD_Y,ASM_CM_GLOW,ASM_CM_HAND_LIT,ASM_CM_HAND_R,ASM_CM_HAND_STRAY,ASM_CM_JACKET,ASM_CM_LIGHT,ASM_CM_LOD0,ASM_CM_LOOK,ASM_CM_MAT,ASM_CM_MF,ASM_CM_MIPS,ASM_CM_PAINTV,ASM_CM_RIM,ASM_CM_SOFT,ASM_CM_U16,ASM_CM_WINK,ASM_CM_WLIGHT,ASM_CM_ZONE,ASM_CR,ASM_CU,ASM_GEO_PX,ASM_HB_COL_LIFT,ASM_HB_SHIRTV,ASM_HB_SHIRT_Y,ASM_KNIT_ACROSS,ASM_LEGV,ASM_LEG_BLEND,ASM_LEG_FOLD,ASM_LEG_FOLD_MAX,ASM_LEG_HAND,ASM_LEG_K,ASM_LEG_SMOOTH,ASM_LOOK,ASM_PAISLEY_ACROSS,ASM_PILE,ASM_TIE_LIT,ASM_TIE_SHEEN_MIN,ASM_TIE_SHEEN_Y,ASM_WT,asmAaK,asmCellT,asmCellV,asmCmAt,asmCmBlur,asmCmBtnCol,asmCmBuild,asmCmButtons,asmCmCanvas,asmCmCodeText,asmCmFinPrep,asmCmFinish,asmCmFoldW,asmCmHandEdge,asmCmHash,asmCmItems,asmCmKind,asmCmLightPrep,asmCmMips,asmCmMp,asmCmPrep,asmCmRead,asmCmRefit,asmCmSetup,asmCmWk,asmCrFind,asmCrMem,asmCuFine,asmCuMem,asmCuPatch,asmCuWrap,asmGeoPrep,asmH32,asmLegsAt,asmLegsPrep,asmNkBaseOf,asmPileKind,asmPileMem,asmTieLit,asmTieSheenK,asmUvAt,asmWtMem} from './asm-color.js';
import {asmGlPref} from './asm-gl.js';
import {ASM_JF_BASES,ASM_NK,ASM_NKV,ASM_NK_HEATHER,ASM_NK_KNIT,ASM_NK_MAT,ASM_NK_STRIPE,asmNkBase,asmNkLeg,asmNkLin,asmNkRnd,asmNkStitchMm} from './asm-kinds.js';
import {OCP_RANK_SVG,fabricDef,texPlainBand} from './draw.js';
import {ASM_OCP_BOX,ASM_OCP_CLOTH,ASM_OCP_DECV,ASM_OCP_INK,ASM_OCP_KINDS,ASM_OCP_MASTER_RANK,ASM_OCP_RIP,ASM_OCP_TEX,asmOcpBase,asmOcpMemo} from './asm-ocp.js';
import {asmBarRgb,asmBarSig,asmClothOf,asmCmKey,asmCmUse,asmDrawn,asmGet,asmKey,asmMicroKind,asmMicroTex,asmMotif,asmSuitBands,asmSuitSig,asmSuitTex,asmSuitTweed,asmSuitTwill,asmSuitWeave,asmTieFor,asmTieSig,asmTieTile,asmTweedTex,asmTwillTex,asmWeave} from './asm-look.js';
const asmWatchPaints=w=>{if(!w||w.type!=='watch')return false;const o=watchOpts(w);return (w.metal||'silver')!=='silver'||o.dial!=='white'||ASM_WATCH_STRAPS.includes(o.band)};
const asmWatchSig=w=>{const o=watchOpts(w);return ['w'+ASM_WATCHV,w.metal||'silver',o.dial,o.band,ASM_WATCH_STRAPS.includes(o.band)?colOf(w):''].join('/')};
/* the job's part (assemble.js asmJob): what to paint, or null */
function asmWatchJob(o,kind){const w=o&&o.watch;if(!kind||!asmWatchPaints(w))return null;const k=ASM_WATCH_MASTER[kind]||kind,g=ASM_WATCH_GEO[k];if(!g)return null;
  // (everything core.js knows is worked out here, on the page: the painting runs in asm-worker.js, which has no core.js. A COLORS read in
  // asmWatchDo failed every gold-watch picture in the worker on the day this shipped: phones and the PC builder; tests/sharedmasters)
  const op=watchOpts(w);return {k,g,metal:asmWatchMetal(w),white:op.dial==='white',dial:COLORS[op.dial]||COLORS.charcoal,dark:asmWatchDark(op.dial),band:op.band,strap:colOf(w),mask:'watch/'+k+'.png',leather:'watch/leather.jpg'}}
const asmWatchDark=c=>{const h=COLORS[c]||'#000000',v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);return .2126*v[0]+.7152*v[1]+.0722*v[2]<.45};
/* what the look's key carries for its square (asm-color.js asmCmSig) */
const asmPocketSig=p=>['q'+ASM_POCKETV,colOf(p),p.pattern||'solid',p.secondaryColor||'',p.tertiaryColor||'',String(p.material||'')].join('/');
/* the job's part (assemble.js asmJob): what to paint, or null (no square, no jacket, a master with no pocket) */
function asmPocketJob(o,kind){const p=o&&o.pocket;if(!p||!o.top||!kind||!asmPocketQuad(kind))return null;
  const c=k=>k&&COLORS[k]?COLORS[k]:null,pat=typeof patBase==='function'?patBase(p.pattern)||'solid':p.pattern||'solid';
  const m=String(p.material||'').toLowerCase();
  return {kind,col:colOf(p),c2:c(p.secondaryColor),c3:c(p.tertiaryColor),pat,linen:/linen/.test(m),silk:/silk/.test(m)}}
const asmCmAssets=kind=>{const K=ASM_CM_KINDS[kind];if(!K)return [];return [asmCmKey(kind,'master'),...K.zones.map(z=>asmCmKey(kind,'mask/'+z)),
  ...(K.sleeves?['sleeveR','sleeveL'].map(s=>asmCmKey(kind,'part/'+s)):[]),...(K.lapels?['lapelR','lapelL'].map(s=>asmCmKey(kind,'part/'+s)):[]),...asmCmGeoKeys(kind),...asmCmLightKeys(kind)]};
/* (2026-11-14) the master's light map, part of it once the manifest lists it (a master without one is lit as before): one picture at the
   maps' size made on the computer from the master's surface normals. R: the form light (a window from the left on the body's own shape;
   128 = unchanged, (R-128)/255 added to 1), G: the glow where the cloth turns away from the camera, B: the collar leaves' shadow on the
   shirt and tie under them. asmCmPrep lays R into every cloth's light; asmCmLightPrep takes G into the jacket's lit edges and B into the
   shirt's and tie's contact shadows, so both painters (this one and asm-gl.js) take all three from the setup they already share */
const asmCmLightKeys=kind=>{const l=asmCmKey(kind,'light'),M=asmCmMfNow().keys;return M[l]?[l]:[]};
/* the master's solved cloth positions (asmGeoPrep), part of it once the manifest lists them (a master without them paints as before) */
const asmCmGeoKeys=kind=>{const u=asmCmKey(kind,'geo/u'),v=asmCmKey(kind,'geo/v'),M=asmCmMfNow().keys;return M[u]&&M[v]?[u,v]:[]};
/* (2026-11-16) the master a look is painted on, the new garments' kinds included (asm-kinds.js asmCmKindOf); asmCmKind (in the painter's
   fingerprint) is unchanged. asmNkBaseOf: a new kind's base master (its cloth and trousers/jacket zones), else the kind itself */
/** @param {*} o */ const asmKindOf=o=>typeof asmCmKindOf==='function'?asmCmKindOf(o):asmCmKind(o);
/* only the ties it changes get a new picture key */
const asmCmTieTag=(z,i)=>{if(z!=='tie'||typeof colOf!=='function')return '';const h=String(colOf(i)).replace('#',''),L=ASM_LIN||null;if(!L)return '';
  const y=.2126*L[parseInt(h.slice(0,2),16)||0]+.7152*L[parseInt(h.slice(2,4),16)||0]+.0722*L[parseInt(h.slice(4,6),16)||0];return asmTieSheenK(y)<1?'/tsh1':''};
function asmCmMat(i,z){if(!i)return [1,1];const M=ASM_CM_MAT,m=String(i.material||'').toLowerCase(),t=(m+' '+(typeof patName==='function'?patName(i.pattern):i.pattern||'')+' '+(i.patternText||'')).toLowerCase();
  if(z==='tie')return /knit|wool|grenadine|linen|cashmere/.test(t)?M.knit:/cotton/.test(m)?M.chino:M.silk;
  if(z==='shirt')return /linen/.test(t)?M.linen:/seersucker/.test(m)?M.chino:/stretch|nylon|spandex/.test(m)?M.stretch:/sateen|satin/.test(t)?M.sateen:/oxford|flannel|twill|chambray/.test(t)?M.oxford:M.poplin;
  if(/linen/.test(t))return M.linen;if(/velvet/.test(m))return M.velvet;
  if(/tweed|flannel|melange|donegal|cashmere/.test(t)||/corduroy|moleskin|camel|melton|loden|alpaca/.test(m))return M.soft;
  if(/jersey/.test(m))return M.knit;if(/seersucker/.test(m))return M.chino;
  if(z==='trousers'&&(i.trouserKind||/cotton|chino|denim/.test(t)))return M.chino;
  if((z==='jacket'||z==='waistcoat')&&/^cotton/.test(m))return M.chino;
  if(/mohair|silk blend|polyester/.test(m))return M.sheen;if(/tropical/.test(m))return M.tropical;return M.worsted}
/* a jacket whose weave the 2026-11-13 audit added (a herringbone, or an own pattern based on solid named twill): marked in its look's key,
   so only those looks are painted again (a new ASM_CM_PAINTV would repaint every look) */
const asmCmWeaveTag=(z,i)=>{if(z==='shirt'&&asmHbShirt(i))return '/hbs'+ASM_HB_SHIRTV+'-'+ASM_HB_COL_LIFT+'-'+ASM_HB_SHIRT_Y;   // a herringbone shirt's columns and colour hold (asmHbShirtLook)
  const how=asmCmRoute(i,z).how;
  // the painters added after the routing test (2026-11-13): small woven figures on jackets and trousers, knit and paisley ties
  if(ASM_MICRO[how])return '/m'+how+'-'+JSON.stringify(ASM_MICRO[how]).replace(/\W+/g,'');
  if(how==='cord'||how==='sucker')return '/p'+how+'-'+JSON.stringify(ASM_PILE[how]).replace(/\W+/g,'');   // corduroy's wales, seersucker's pucker (asmPileTile)
  if(how==='knit')return '/knit'+ASM_KNIT_ACROSS;if(how==='paisley')return '/paisley'+ASM_PAISLEY_ACROSS;
  if(z==='trousers'){const h=asmCmRoute(i,z).how;return ['twill','herringbone','tweed'].includes(h)?'/t'+h+(h==='herringbone'?ASM_HB_MM+'-'+ASM_HB_AMP+'-'+ASM_HB_RIB+'-'+ASM_HB_FLECK+'-'+ASM_HB_YARN+'-'+ASM_HB_BREAK+'s'+ASM_HB_THIN+'m'+ASM_HB_MOTTLE+'f'+ASM_HB_FLOAT+'/'+ASM_HB_FLOATL+'o'+ASM_HB_SOFT+'g'+ASM_HB_GRAIN+'n'+ASM_HB_SNAP+'p'+ASM_HB_PBRK:''):''}
  if((z==='jacket'||z==='waistcoat')&&asmCmRoute(i,z).how==='tweed'&&!asmSuitTweed(i))return '/ttweed';   // an own pattern named tweed
  if((z!=='jacket'&&z!=='waistcoat')||!asmSuitTwill(i))return '';
  const w=asmSuitWeave(i);return w==='herringbone'?'/hb'+ASM_HB_MM+'-'+ASM_HB_AMP+'-'+ASM_HB_RIB+'-'+ASM_HB_FLECK+'-'+ASM_HB_YARN+'-'+ASM_HB_BREAK+'s'+ASM_HB_THIN+'m'+ASM_HB_MOTTLE+'f'+ASM_HB_FLOAT+'/'+ASM_HB_FLOATL+'o'+ASM_HB_SOFT+'g'+ASM_HB_GRAIN+'n'+ASM_HB_SNAP+'p'+ASM_HB_PBRK:patBase(i.pattern)!=='twill'?'/tw':''};
/** @param {*} i @param {*} z */ function asmCmRoute(i,z){if(!i)return {how:'flat',gap:'',why:''};const s=typeof usableSett==='function'?usableSett(i):null,b=patBase(i.pattern)||'solid',pn=(typeof patName==='function'?patName(i.pattern):b).toLowerCase();
  const w=asmSuitWeave(i),canRead=served('pattern-readable')?ask('pattern-readable',i.type,i.pattern,i.weave):false;
  const plain=(gap,why)=>({how:'plain',gap,why}),needs=()=>plain('reading',`its ${pn} is painted once its pattern is read (Read pattern from photo)`);
  if(z==='belt')return {how:'flat',gap:'',why:''};
  if(z==='shirt'&&s&&s.camo)return {how:'camo',gap:'',why:''};   // a camouflage shirt: the same blotches as camouflage pants (the owner, 2026-11-16: "why do they look different")
  if(z==='jacket'||z==='waistcoat'||z==='trousers'){
    if(s&&s.camo)return {how:'camo',gap:'',why:''};   // camouflage: its blotches (asmCamoTex, 2026-11-16)
    if(s&&s.look&&(s.tex||s.motif))return {how:'look',gap:'',why:''};   // an own pattern's weave or figure (its look, detect.js lookSett): asmLookSuit
    if(z!=='trousers'&&asmSuitBands(i))return {how:'bands',gap:'',why:''};
    // a suit's own trousers (its jacket taken off on Today, 2026-11-13): the jacket's cloth, so a pinstripe or check reads as on the jacket
    if(z==='trousers'&&i.type==='suit'&&asmSuitBands(i))return {how:'bands',gap:'',why:''};
    if(z==='trousers'&&s&&s.bands)return {how:'tile',gap:'',why:''};
    if(w&&!(s&&s.bands))return {how:w,gap:'',why:''};
    if(b==='tweed'||(/^own/.test(i.pattern||'')&&/tweed/i.test(i.pattern)))return {how:'tweed',gap:'',why:''};
    const mk=asmMicroKind(i);if(mk&&!(s&&s.bands))return {how:mk,gap:'',why:''};   // houndstooth, sharkskin, birdseye, nailhead
    if(b==='solid'){const pk=asmPileKind(i);return {how:pk&&!asmCuWants(i,'flat')?pk:'flat',gap:'',why:''}}   // a plain corduroy or seersucker without a close-up: its generated cloth (asmPileTile)
    if([...STRIPE_PATS,...CHECK_PATS].includes(b))return needs();
    return plain('painter',`no painter for ${pn} ${z==='trousers'?'pants':'jackets'} yet`)}
  if(z==='shirt'){if(b==='solid'&&!s)return {how:'flat',gap:'',why:''};
    return s?{how:'tile',gap:'',why:''}:{how:'tile',gap:canRead?'reading':'',why:canRead?`its ${pn} is a generic drawing until its pattern is read (Read pattern from photo)`:''}}
  if(z==='tie'){if(s&&(s.bands||s.motif||s.tex))return {how:'tie',gap:'',why:''};if(b==='solid')return {how:'flat',gap:'',why:''};
    if(canRead)return needs();
    if(b==='knit'||b==='paisley')return {how:b,gap:'',why:''};
    return plain('painter',`no painter for ${pn} ties yet`)}
  return {how:'flat',gap:'',why:''}}
const asmCmGaps=()=>items.filter(i=>ASM_CM_ZONE[i.type]&&inRotation(i)&&!dressOut(i.type)).map(i=>({i,r:asmCmRoute(i,ASM_CM_ZONE[i.type])})).filter(x=>x.r.gap);
/* trousers painted with the suit cloth (a suit's own trousers, or a twill, tweed or small woven figure) are drawn at the shirt master's
   own scale since 2026-11-13 (they were at the jacket master's, about 1.5 times too large): marked in only those looks' keys */
const asmCmTrSc=(z,i)=>{if(z!=='trousers')return '';const h=asmCmRoute(i,z).how;return h==='bands'||h==='look'||h==='twill'||h==='herringbone'||h==='tweed'||ASM_MICRO[h]?'/sc/lg'+ASM_LEGV:h==='tile'?'/lg'+ASM_LEGV:''};   // (/lg: the lines follow the legs, asmLegsPrep)
function asmCmSig(o){const k=asmKindOf(o);if(!k)return '';const b=asmNkBaseOf(k),it=asmCmItems(o,b),s=[k,'p'+ASM_CM_PAINTV+'.'+asmCmCodeSig()];
  if(b!==k)s.push('nk'+asmNkSig());   // a new garment's master (asm-kinds.js): its own code too
  const rev=asmCmRev(k);if(rev)s.push('mf:'+rev);   // the painter's code and the master's record dates (asmCmCode, asmCmRev)
  for(const z of Object.keys(it).sort()){const i=it[z];s.push(z+':'+colOf(i)+'/'+(i.pattern||'')+'/'+(typeof usableSett==='function'?settSig(usableSett(i)):'')+(i.patternSpec?'/ps'+fnv64(JSON.stringify([i.patternSpec.across,i.patternSpec.along])).slice(0,6):'')+(i.material?'/'+i.material:'')+asmCmWeaveTag(z,i)+asmCmTrSc(z,i)+asmCmTieTag(z,i)+asmCuTag(z,i)+asmCrTag(z,i)+asmWtTag(z,i)+asmLookTag(z,i))}
  if(o.clip&&k!=='vest')s.push('bar:'+asmBarSig(o.clip));
  if(typeof asmWatchPaints==='function'&&asmWatchPaints(o.watch))s.push('watch:'+asmWatchSig(o.watch));   // another watch than the master's (asm-watch.js)
  if(o.pocket&&o.top&&typeof asmPocketQuad==='function'&&asmPocketQuad(k))s.push('pocket:'+asmPocketSig(o.pocket));
  if(typeof asmOcpSig==='function'){const q=asmOcpSig(o,k);if(q)s.push(q)}   // the uniform blouse's tapes and rank, painted after (asm-ocp.js): only those looks   // the day's pocket square, painted after (asm-pocket.js): only such looks change key
  if(ASM_CM_BTN[k])s.push('btn'+ASM_CM_BTNV);   // the masters whose shirt buttons are drawn: a new look of them paints those looks again
  const bg=renders[asmCmBgKey()];if(bg)s.push('bg:'+bg.t+'/'+ASM_CM_BG_SHADOW);
  const jf=asmJfWants(o,k);if(jf)s.push('jf'+jf.t);   // jeans on the faded master (asm-kinds.js), once it is on the worker
  return s.join('|')}
/** @param {*} o */ const asmCmOutKey=o=>asmKey('out/cm'+ASM_CMV+'/'+fnv64(asmCmSig(o)));
/** @param {*} o */ const asmCmStamp=o=>{const k=asmKindOf(o);return k?asmCmAssets(k).reduce((t,key)=>Math.max(t,renders[key]&&renders[key].t||0),0):0};
/* the background behind every master (2026-11-13, the owner's choice: a blurred office the colour of his earlier masters, made with
   ChatGPT as an empty room and its desk carried further left so its end hides behind the trousers on the shirt masters): one picture on
   the worker (`npm run cm-upload -- --bg <file>`), shared by the four masters; without it the wall is the flat ASM_CM_WALL as before.
   It goes in each look's key (its record's date), so a new background paints every look again. */
const asmCmBgKey=()=>asmCmKey('all','background');
async function asmCmBgGet(){const k=asmCmBgKey();if(!renders[k])await asmGet(k);return !!renders[k]}
/* the masters' manifest (2026-11-14 audit: a master, mask or background uploaded again never reached a device that held it, since a
   photo is downloaded once and kept). `npm run cm-upload` writes one small record, asmCmMfKey(), signed 'asm/cm-manifest {"keys":
   {<key>: <record date>}}', listing every colour-coded record's date. A device reads it once per worker list (asmListGet: every
   LIST_MS while the app is open, photos.js workerList) or once a session without a list; a photo it holds that is older than the manifest says is
   dropped and downloaded again, and the dates of a master's records go into its looks' keys (asmCmRev), so every device
   agrees on a look's key whatever copies it holds. Remembered in localStorage.asm_cm_mf, so a restart finds its kept pictures
   before the manifest is read again. No manifest on the worker: the keys are as before and nothing is dropped. */
const asmCmMfKey=()=>asmCmKey('all','manifest');
let asmCmMf=null;
const asmCmMfNow=()=>{if(!asmCmMf){try{asmCmMf=JSON.parse(localStorage.getItem(ASM_CM_MF)||'null')}catch{}if(!asmCmMf||typeof asmCmMf.keys!=='object')asmCmMf={keys:{}}}return asmCmMf};
/* the dates the manifest gives a kind's records (master, masks, parts) and the background, hashed: '' without a manifest */
const asmCmRev=kind=>{const M=asmCmMfNow().keys,ks=[...asmCmAssets(kind),asmCmBgKey()];return ks.some(k=>M[k])?asmCmHash(ks.map(k=>M[k]||0).join(',')):''};
const asmCrWants=i=>{if(!i||i.type!=='shirt'||!i.texture)return false;const s=typeof usableSett==='function'?usableSett(i):null;
  return asmCmRoute(i,'shirt').how==='tile'&&!(s&&s.bands)&&!/herringbone|twill|end-on-end/i.test(String(i.pattern||'')+' '+(patBase(i.pattern)||''))};
const asmCrTag=(z,i)=>z==='shirt'&&asmCrWants(i)?'/cr'+ASM_CR.v+'.'+i.texture.length+i.texture.slice(-12).replace(/[^A-Za-z0-9]/g,''):'';
function asmCrTile(i){if(!i||!i.texture||typeof document==='undefined')return Promise.resolve(null);const key=i.id+'|'+colOf(i)+'|'+i.texture.length+i.texture.slice(-12);let p=asmCrMem.get(key);
  if(!p){if(asmCrMem.size>24)asmCrMem.clear();p=asmCrTile1(i).catch(()=>null);asmCrMem.set(key,p)}return p}
/* the tile: one repeat (two cells of a brick layout) -> {t,TW,TH,mm,fine,cr} or null when no repeat is found or it is not sure enough;
   all=true gives the tile whatever the confidence (the bench, the tests) */
async function asmCrTile1(i,all){const L=ASM_LIN,im=new Image();im.src=i.texture;await im.decode();if(!im.naturalWidth||!im.naturalHeight)return null;
  const W=Math.min(ASM_CR.W,im.naturalWidth),H=Math.max(8,Math.round(W*im.naturalHeight/im.naturalWidth)),cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const g=cv.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(im,0,0,W,H);const f=asmCrFind(g.getImageData(0,0,W,H).data,W,H);if(!f)return null;
  const cr={across:+Math.hypot(f.ax,f.ay).toFixed(2),down:+Math.hypot(f.bx,f.by).toFixed(2),of:W,cells:f.cells,per:+f.per.toFixed(3),sd:+f.sd.toFixed(3),peaks:f.peaks};
  if(!all&&!(f.per>=ASM_CR.per&&f.sd>=ASM_CR.sd))return null;
  const la=Math.hypot(f.ax,f.ay),lb=Math.hypot(f.bx,f.by),TW=Math.max(ASM_CR.TW,Math.min(ASM_CR.TWmax,Math.round(la*1.25))),TH=Math.max(8,Math.min(512,Math.round(TW*lb/la))),n=TW*TH,t=new Float32Array(3*n),lum=new Float32Array(n),nc=f.nc,nb=nc,mx=W/2,my=H/2;
  // each cell is lined up on the others before they are averaged (ASM_CR.align px either way, then half steps; twice): cloth is never
  // quite flat, and cells a few px out of step blurred a print's small figures into soft dashes
  const AL=ASM_CR.align,CL=[];for(let j=-nb;j<=nb;j++)for(let ii=-nc;ii<=nc;ii++){let ok=1;for(const cu of [0,1])for(const cw of [0,1]){const x=mx+(ii+cu)*f.ax+(j+cw)*f.bx,y=my+(ii+cu)*f.ay+(j+cw)*f.by;if(x<AL+2||y<AL+2||x>W-AL-3||y>H-AL-3)ok=0}if(ok)CL.push({ii,j,ox:0,oy:0})}
  if(!CL.length)return null;
  {const GU=32,GV=Math.max(8,Math.round(GU*lb/la)),gn=GU*GV,tp=new Float32Array(gn),px=new Float32Array(gn),py=new Float32Array(gn);
    for(let v=0;v<GV;v++)for(let u=0;u<GU;u++){const k=v*GU+u;px[k]=(u+.5)/GU*f.ax+(v+.5)/GV*f.bx;py[k]=(u+.5)/GU*f.ay+(v+.5)/GV*f.by}
    const dot=(c,ox,oy)=>{const bx0=mx+c.ii*f.ax+c.j*f.bx+ox,by0=my+c.ii*f.ay+c.j*f.by+oy;let s=0;for(let k=0;k<gn;k++)s+=f.samp(f.Fs,bx0+px[k],by0+py[k])*tp[k];return s};
    for(let it=0;it<2&&CL.length>1;it++){tp.fill(0);for(const c of CL){const bx0=mx+c.ii*f.ax+c.j*f.bx+c.ox,by0=my+c.ii*f.ay+c.j*f.by+c.oy;for(let k=0;k<gn;k++)tp[k]+=f.samp(f.Fs,bx0+px[k],by0+py[k])}
      for(const c of CL){let bo=[0,0],bv=-1e9;for(let oy=-AL;oy<=AL;oy++)for(let ox=-AL;ox<=AL;ox++){const v=dot(c,ox,oy);if(v>bv){bv=v;bo=[ox,oy]}}
        const b0=bo;for(const dy of [-.5,0,.5])for(const dx of [-.5,0,.5]){const v=dot(c,b0[0]+dx,b0[1]+dy);if(v>bv){bv=v;bo=[b0[0]+dx,b0[1]+dy]}}c.nx=bo[0];c.ny=bo[1]}
      for(const c of CL){c.ox=c.nx;c.oy=c.ny}}
    // the offsets' mean is taken out, so the tile stays where the pile was
    let sx=0,sy=0;for(const c of CL){sx+=c.ox;sy+=c.oy}sx/=CL.length;sy/=CL.length;for(const c of CL){c.ox-=sx;c.oy-=sy}}
  for(let v=0;v<TH;v++)for(let u=0;u<TW;u++){let r=0,gg=0,bb=0,c=0;for(const ce of CL){const x=mx+(ce.ii+u/TW)*f.ax+(ce.j+v/TH)*f.bx+ce.ox,y=my+(ce.ii+u/TW)*f.ay+(ce.j+v/TH)*f.by+ce.oy;if(x<1||y<1||x>W-2||y>H-2)continue;
      const l=f.samp(f.Yb,x,y)||1;r+=f.samp(f.R,x,y)/l;gg+=f.samp(f.G,x,y)/l;bb+=f.samp(f.B,x,y)/l;c++}
    const k=v*TW+u;if(!c)c=1;t[3*k]=r/c;t[3*k+1]=gg/c;t[3*k+2]=bb/c;lum[k]=.2126*t[3*k]+.7152*t[3*k+1]+.0722*t[3*k+2]}
  // the ground (the lighter part) becomes the tagged colour; the figure keeps its colour against it
  const srt=Array.from(lum).sort((p,q)=>p-q),cut=srt[Math.floor(n*ASM_CR.ground)],gr=[0,0,0];let gn=0;for(let k=0;k<n;k++)if(lum[k]>=cut){gr[0]+=t[3*k];gr[1]+=t[3*k+1];gr[2]+=t[3*k+2];gn++}
  const h=String(colOf(i)).replace('#',''),base=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]);
  for(let k=0;k<n;k++)for(let q=0;q<3;q++)t[3*k+q]=Math.min(1,base[q]*t[3*k+q]/((gr[q]/gn)||1));
  const mm=Math.max(ASM_TEX_MIN_MM,la/W*ASM_CLOSEUP_MM);cr.mm=+mm.toFixed(2);
  return {t,TW,TH,mm,fine:true,cr}}
/* one repeat of the app's drawing of an item (fabricDef), in linear light, softened toward its ground (each channel's median), and how
   many mm one repeat is on the cloth -> {t, TW, TH, mm} or null */
/** @param {*} i @param {*} role */ async function asmCmTile(i,role){const s=usableSett(i),pat=patBase(i.pattern)||'solid';if(pat==='solid'&&!s)return null;
  const def=fabricDef('cmt',i,role).replace(/ patternTransform="[^"]*"/,'').replace(/<path [^>]*stroke="#fff"[^>]*\/>/g,''),num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');
  if(!w||!h)return null;const TW=128,TH=Math.max(4,Math.min(512,Math.round(TW*h/w))),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${3*TW}" height="${3*TH}" viewBox="0 0 ${3*w} ${3*h}"><defs>${def}</defs><rect width="${3*w}" height="${3*h}" fill="url(#cmt)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=3*TW;cv.height=3*TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,3*TW,3*TH);const d=x.getImageData(TW,TH,TW,TH).data,t=new Float32Array(3*TW*TH);
  for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)t[3*k+q]=L[d[4*k+q]];
  // a woven shirt (dobby, basket, herringboneâ€¦: asmWeave's tile) keeps the earlier painter's rules, which the owner chose on 2026-11-12:
  // the drawing's full swing (texTones' 2.5..7 L*, not softened again: at 45% his white woven diamond was 3 L*, invisible), its
  // repeat measured from the close-up (asmTexMm) or a herringbone's count, and 3x3 points a pixel when painted (fine)
  const wv=role==='shirt'?asmWeave(i):null,fine=!!(wv&&wv.f==='tile');
  const kk=fine?1:ASM_CM_SOFT[role]??1;if(kk!==1){const g=[0,1,2].map(q=>{const v=[];for(let k=0;k<TW*TH;k++)v.push(t[3*k+q]);v.sort((a,b)=>a-b);return v[v.length>>1]});for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)t[3*k+q]=g[q]+kk*(t[3*k+q]-g[q])}
  // a repeat's size: the reading's count across (a jacket or shirt about 550 mm), a weave's own rules, else the drawing's (200 units across)
  let mm=0;if(s&&s.tex)mm=pat==='herringbone'?(s.tr&&s.tr<80?ASM_SHIRT_MM/s.tr:12):3;else if(s&&s.motif)mm=Math.max(ASM_TEX_MIN_MM,2*ASM_CLOSEUP_MM/Math.max(1,+s.cr||20));else if(s&&+s.tr)mm=ASM_SHIRT_MM/s.tr;else mm=w*ASM_SHIRT_MM/200;
  if(fine)mm=wv.hb?wv.mm:await asmTexMm(i);
  if(asmHbShirt(i)&&role==='shirt')asmHbShirtLook(t,TW,TH,i,s);
  return {t,TW,TH,mm,fine}}
/** @param {*} i */ const asmHbShirt=i=>!!i&&i.type==='shirt'&&(patBase(i.pattern)==='herringbone'||(()=>{const s=typeof usableSett==='function'?usableSett(i):null;return !!(s&&s.tex&&s.tex.kind==='herringbone')})());
function asmHbShirtLook(t,TW,TH,i,s){const L=ASM_LIN,h=String(colOf(i)).replace('#',''),tag=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),m=[0,0,0],n=TW*TH;
  for(let k=0;k<n;k++)for(let q=0;q<3;q++)m[q]+=t[3*k+q];
  const g=m.map((v,q)=>v>1e-6?ASM_HB_SHIRT_Y*tag[q]*n/v:1);for(let k=0;k<n;k++)for(let q=0;q<3;q++)t[3*k+q]=Math.min(1,t[3*k+q]*g[q]);
  const band=s&&s.tex&&typeof texPlainBand==='function'?texPlainBand(s.tex.grid):null,sh=band?band.share:0,x0=Math.round(TW/2),x1=Math.round(TW*(.5+(1-sh)/(2*(1+sh))));
  for(let y=0;y<TH;y++)for(let x=x0;x<x1;x++)for(let q=0;q<3;q++){const k=3*(y*TW+x);t[k+q]=Math.min(1,t[k+q]*(1+ASM_HB_COL_LIFT))}}
function asmKnitTile(i){const L=ASM_LIN,h=String(colOf(i)).replace('#',''),c=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),TW=24,TH=20,t=new Float32Array(3*TW*TH),b=new Float32Array(TW*TH);let m=0;
  for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){const u=(x+.5)/TW,v=(y+.5)/TH,hx=u<.5?u/.5:(1-u)/.5,ph=((v+.45*hx)%1+1)%1;   // each half a loop leaning in: a V
    const val=.55+.6*Math.sin(Math.PI*hx)*Math.pow(Math.sin(Math.PI*ph),.7);b[y*TW+x]=val;m+=val}
  m/=TW*TH;for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)t[3*k+q]=c[q]*b[k]/m;
  return {c:t,TW,TH,motif:false,across:ASM_KNIT_ACROSS,ang:0}}
async function asmPaisleyTile(i){const T=128,cv=document.createElement('canvas');cv.width=cv.height=T;const x=cv.getContext('2d',{willReadFrequently:true});
  const g=colOf(i),rgb=[1,3,5].map(k=>parseInt(String(g).slice(k,k+2),16)||0),lum=.299*rgb[0]+.587*rgb[1]+.114*rgb[2],c2=COLORS[i.secondaryColor]||(lum<110?'#d9cdb4':'#3a2f45');
  const mixHex=(a,b,t)=>'#'+[1,3,5].map(k=>Math.round(parseInt(a.slice(k,k+2),16)*(1-t)+parseInt(b.slice(k,k+2),16)*t).toString(16).padStart(2,'0')).join(''),c3=COLORS[i.thirdColor]||mixHex(g,c2,.45);
  x.fillStyle=g;x.fillRect(0,0,T,T);
  // a teardrop: a round body with its tip curling to one side, a smaller drop of the third colour inside, and an eye
  const drop=(cx,cy,r,rot)=>{for(const [dx,dy] of [[0,0],[T,0],[-T,0],[0,T],[0,-T]]){x.save();x.translate(cx+dx,cy+dy);x.rotate(rot);
      const path=(s,oy)=>{const P=(a,b)=>[a*r*s,b*r*s+oy*r];x.beginPath();x.moveTo(...P(.7,-1.9));x.bezierCurveTo(...P(.9,-1),...P(1.1,.2),...P(.2,1));
        x.bezierCurveTo(...P(-.7,1.6),...P(-1.3,.3),...P(-.8,-.4));x.bezierCurveTo(...P(-.4,-1),...P(.3,-.9),...P(.7,-1.9));x.closePath()};
      x.fillStyle=c2;path(1,0);x.fill();x.fillStyle=c3;path(.55,.2);x.fill();x.fillStyle=c2;x.beginPath();x.arc(-.05*r,.35*r,.18*r,0,2*Math.PI);x.fill();
      x.restore()}};
  drop(.3*T,.32*T,.17*T,.5);drop(.78*T,.8*T,.17*T,.5+Math.PI);
  x.fillStyle=c2;for(const [px,py] of [[.75*T,.25*T],[.25*T,.78*T]]){x.beginPath();x.arc(px,py,.035*T,0,2*Math.PI);x.fill()}   // small dots between
  const d=x.getImageData(0,0,T,T).data,t=new Float32Array(3*T*T),L=ASM_LIN;for(let k=0;k<T*T;k++)for(let q=0;q<3;q++)t[3*k+q]=L[d[4*k+q]];
  return {c:t,TW:T,TH:T,motif:false,across:ASM_PAISLEY_ACROSS,ang:0}}
/* (at its real size a fine twill's ribs are under one pixel of the picture and average to a flat colour, exactly what the close-up was
   meant to cure) the cloth is drawn ASM_CU.zoom times its real size, as shirt weaves and ties are drawn larger than life so they show on
   a phone; and a patch must be in focus: its fine detail at least ASM_CU.sharp of the cloth's sharpest tenth (the first build took the
   evenest patch, which on one close-up was its blurred corner) */
/* (the first build drew the detail 1.25x and it was too faint to matter at Today's size on two of the owner's three brown suits) the
   detail is drawn as strong as it takes to show in the picture: its swing (5th to 95th percentile) measured as the picture shows it
   (the tile averaged over a picture pixel, ASM_PX_MM) is brought up to ASM_CU.show, at most ASM_CU.kmax times, never weaker than life.
   A patch is clean when its light is even within ASM_CU.even and its strongest line is under ASM_CU.edge times the cloth's usual */
/* (the owner, 2026-11-14: "Leave the current painter for black solid color suits") cloth darker than ASM_CU.dark (linear light) is not
   taken from the close-up. (His Medium Grey came out a patchwork: the close-up's soft blotches and crease shadows, a quarter of the
   square across, survived a flattening at a seventh of the square and repeated with the tile) the square's light is flattened at
   1/ASM_CU.flat of its side, so only the weave and its grain stay */
const asmCuDark=i=>{const h=String(colOf(i)).replace('#',''),c=[0,2,4].map(k=>ASM_LIN[parseInt(h.slice(k,k+2),16)||0]);return .2126*c[0]+.7152*c[1]+.0722*c[2]<ASM_CU.dark};
/* (the owner, 2026-11-14, from sheets of his Grey Herringbone at full, double and triple: "put the herringbone on triple") a herringbone
   jacket, waistcoat or trousers with a close-up takes its cloth from it too, its detail ASM_CU.hb times life (its fine tonal chevrons are
   lost at life strength; the fine-cloth cap does not apply); one read in bands (a pinstripe on a herringbone ground) keeps its painter.
   (the same day, from mocks at triple with single, double and triple sleeves: "triple on the body, double on the sleeves": triple read
   rough and streaky on the sleeves) a jacket's sleeves show the detail at ASM_CU.hbs times life: the tile carries slv = hbs/hb, and both
   painters pull a sleeve pixel's tile colour that far toward the tile's colour (suitCol; the shader's uSlv) */
/** @param {*} i @param {*} how */ const asmCuWants=(i,how)=>!!(i&&i.texture&&(how==='flat'||how==='twill'||how==='plain'||how==='herringbone')&&!asmCuDark(i));
const asmCuTag=(z,i)=>(z==='jacket'||z==='waistcoat'||z==='trousers')&&asmCuWants(i,asmCmRoute(i,z).how)?'/cu'+ASM_CU.v+'.'+i.texture.length+i.texture.slice(-12).replace(/[^A-Za-z0-9]/g,''):'';
/** @param {*} i */ function asmCuTile(i){if(!i||!i.texture||typeof document==='undefined')return Promise.resolve(null);const key=i.id+'|'+colOf(i)+'|'+i.texture.length+i.texture.slice(-12);let p=asmCuMem.get(key);
  if(!p){if(asmCuMem.size>24)asmCuMem.clear();p=asmCuTile1(i).catch(()=>null);asmCuMem.set(key,p)}return p}
async function asmCuTile1(i){const L=ASM_LIN,h=String(colOf(i)).replace('#',''),base=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),im=new Image();im.src=i.texture;await im.decode();
  const FW=im.naturalWidth,FH=im.naturalHeight,cv=(w,hh)=>{const c=document.createElement('canvas');c.width=w;c.height=hh;return c};if(!FW||!FH)return null;
  const W=420,H=Math.max(8,Math.round(W*FH/FW)),sc=cv(W,H),sg=sc.getContext('2d',{willReadFrequently:true});sg.drawImage(im,0,0,W,H);
  const p=asmCuPatch(sg.getImageData(0,0,W,H).data,W,H);if(!p)return null;
  const T=ASM_CU.T,f=FW/W,pc=cv(T,T),pg=pc.getContext('2d',{willReadFrequently:true});pg.imageSmoothingQuality='high';pg.drawImage(im,Math.round(p.x0*f),Math.round(p.y0*f),Math.round(p.P*f),Math.round(p.P*f),0,0,T,T);
  const pd=pg.getImageData(0,0,T,T).data,n=T*T,cl=v=>v<0?0:v>T-1?T-1:v;
  const blur=(a,R)=>{const t=new Float32Array(n),o=new Float32Array(n);for(let y=0;y<T;y++)for(let x=0;x<T;x++){let s=0;for(let k=-R;k<=R;k++)s+=a[y*T+cl(x+k)];t[y*T+x]=s/(2*R+1)}
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){let s=0;for(let k=-R;k<=R;k++)s+=t[cl(y+k)*T+x];o[y*T+x]=s/(2*R+1)}return o};
  const R=Math.round(T/ASM_CU.flat),rel=[0,1,2].map(q=>{const a=new Float32Array(n);for(let k=0;k<n;k++)a[k]=L[pd[4*k+q]];let b=a;for(let j=0;j<3;j++)b=blur(b,R);const o=new Float32Array(n);for(let k=0;k<n;k++)o[k]=b[k]>1e-5?a[k]/b[k]:1;return asmCuWrap(o,T)});
  const v=Array.from(rel[1]).sort((a,b)=>a-b),swing=v[Math.floor(n*.95)]-v[Math.floor(n*.05)];if(!(swing>=ASM_CU.min))return null;
  // as the picture shows it: the tile averaged over one picture pixel (wrapping)
  const mm=p.P/W*ASM_CLOSEUP_MM*ASM_CU.zoom,fb=Math.max(1,Math.round(T/(mm*ASM_PX_MM))),lo=[];for(let y=0;y<T;y+=fb)for(let x=0;x<T;x+=fb){let s=0;for(let dy=0;dy<fb;dy++)for(let dx=0;dx<fb;dx++)s+=rel[1][((y+dy)%T)*T+(x+dx)%T];lo.push(s/(fb*fb))}
  lo.sort((a,b)=>a-b);const shown=lo[Math.floor(lo.length*.95)]-lo[Math.floor(lo.length*.05)],gain=asmSuitWeave(i)==='herringbone'?ASM_CU.hb:asmCuFine(i)&&shown>ASM_CU.fine?ASM_CU.fine/shown:Math.max(1,Math.min(ASM_CU.kmax,ASM_CU.show/Math.max(1e-4,shown)));
  const t=new Float32Array(3*n);for(let k=0;k<n;k++)for(let q=0;q<3;q++)t[3*k+q]=Math.max(0,base[q]*(1+gain*(rel[q][k]-1)));
  return {t,c:new Float32Array(base),TW:T,TH:T,mm,linen:false,cloth:null,...(asmSuitWeave(i)==='herringbone'?{slv:ASM_CU.hbs/ASM_CU.hb}:{}),cu:{x:p.x0,y:p.y0,side:p.P,of:W,even:+p.sd.toFixed(3),line:+p.e.toFixed(3),usual:+p.med.toFixed(3),sharp:+(p.sharp/(p.f90||1)).toFixed(2),swing:+swing.toFixed(3),shown:+shown.toFixed(3),gain:+gain.toFixed(2)}}}
async function asmLookSuit(i){const s=usableSett(i);if(!s||!s.look)return null;const L=ASM_LIN,h=String(colOf(i)).replace('#',''),base=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]);
  const mm=ASM_SHIRT_MM/Math.max(.2,+s.tr||10);
  if(s.tex){const g=s.tex.grid,M=g[0].length,N=g.length,P=ASM_LOOK.px,TW=M*P,TH=Math.max(2,Math.round(TW*(+s.tex.aspect||N/M))),ch=TH/N,r=Math.max(1,Math.round(P*ASM_LOOK.soft));
    const on=(x,y)=>g[((Math.floor(y/ch)%N)+N)%N][((Math.floor(x/P)%M)+M)%M]==='1'?1:0,v=new Float32Array(TW*TH);let lo=1,hi=0,m=0;
    for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){let a=0,n=0;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){a+=on(x+dx,y+dy);n++}const w=a/n;v[y*TW+x]=w;m+=w;if(w<lo)lo=w;if(w>hi)hi=w}
    m/=TW*TH;const amp=(ASM_LOOK.amp[s.tex.contrast]||ASM_LOOK.amp.subtle)*(s.tex.lighter===false?-1:1)/Math.max(1e-3,hi-lo),t=new Float32Array(3*TW*TH);
    for(let k=0;k<TW*TH;k++){const f=1+amp*(v[k]-m);for(let q=0;q<3;q++)t[3*k+q]=Math.max(0,Math.min(1,base[q]*f))}
    return {t,c:new Float32Array(base),TW,TH,mm,linen:asmLinen(i),cloth:null}}
  const T=await asmCmTile(i,'top');return T?{t:T.t,c:new Float32Array(base),TW:T.TW,TH:T.TH,mm:T.mm,linen:asmLinen(i),cloth:null}:null}
/* the look's part of a garment's key: its recipe's signature and repeats, so a re-described pattern repaints (an item changed to an own
   pattern already has a new key by its pattern) */
const asmLookTag=(z,i)=>{if(!i||!['jacket','waistcoat','trousers','shirt','tie'].includes(z))return '';const s=typeof usableSett==='function'?usableSett(i):null;return s&&s.look?'/lk'+ASM_LOOK.v+s.look+'x'+s.tr:''};
/** @param {*} i @param {*} z */ const asmWtWants=(i,z)=>!!i&&(z==='jacket'||z==='waistcoat'||z==='trousers')&&(i.type==='suit'||i.type==='blazer'||(i.type==='pants'&&!(typeof trouserKind==='function'&&trouserKind(i))))&&asmCmRoute(i,z).how==='twill';
const asmWtTag=(z,i)=>asmWtWants(i,z)&&!asmCuWants(i,'twill')?'/wt'+ASM_WT.v:'';
/** @param {*} i */ function asmWorstedTile(i){const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},base=lin(colOf(i)),c2=COLORS[i.secondaryColor]?lin(COLORS[i.secondaryColor]):null;
  const key=JSON.stringify([base,c2,ASM_WT]);let det=asmWtMem.get('d');const T=ASM_WT.T,n=T*T,[kx,ky]=ASM_WT.k;
  if(!det){let s=12345;const rnd=()=>(s=(Math.imul(s,1103515245)+12345)&0x7fffffff)/0x7fffffff;
    const pn=(f,c)=>{const w=[];for(let q=0;q<c;q++)w.push([1+Math.floor(rnd()*f),Math.floor(rnd()*(2*f+1))-f,rnd()*6.283,.5+rnd()]);return (x,y)=>{let v=0,m=0;for(const [a,b,p,g] of w){v+=g*Math.sin(6.283*(a*x+b*y)/T+p);m+=g}return v/m}};   // smooth noise of whole cycles over the tile
    const wob=pn(3,6),thick=pn(6,8),cloud=pn(4,6),d=new Float32Array(n),rib=new Float32Array(n);
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){const ph=(kx*x+ky*y)/T+.06*wob(x,y),r=ph-Math.floor(ph),ri=Math.floor(ph);
      const ridge=Math.pow(Math.sin(Math.PI*r),.7),tws=Math.sin(6.283*(2*(-ky*x+kx*y)/T+1.5*r)),rv=Math.sin(ri*12.9898+7)*43758.5453;
      d[y*T+x]=ridge-.62+ASM_WT.twist*.18*tws*ridge+.10*((rv-Math.floor(rv))-.5)+.04*thick(x,y)+.015*cloud(x,y)+.05*(rnd()-.5);rib[y*T+x]=ridge}
    let m=0;for(let k=0;k<n;k++)m+=d[k];m/=n;const v=[];for(let k=0;k<n;k+=7)v.push(d[k]-m);v.sort((a,b)=>a-b);const sw=v[Math.floor(v.length*.95)]-v[Math.floor(v.length*.05)];
    for(let k=0;k<n;k++)d[k]=(d[k]-m)/sw;det={d,rib};asmWtMem.set('d',det)}
  let t=asmWtMem.get(key);
  if(!t){t=new Float32Array(3*n);for(let k=0;k<n;k++){const g=1+ASM_WT.amp*det.d[k];for(let q=0;q<3;q++){const b=c2?base[q]+(c2[q]-base[q])*ASM_TWILL.mix*det.rib[k]:base[q];t[3*k+q]=Math.max(0,b*g)}}
    if(asmWtMem.size>24){asmWtMem.clear();asmWtMem.set('d',det)}asmWtMem.set(key,t)}
  return {t,c:new Float32Array(base),TW:T,TH:T,mm:ASM_WT.mm,linen:asmLinen(i),cloth:null}}
function asmPileTile(i,how){const P=ASM_PILE[how];if(!P)return null;const L=ASM_LIN,base=[0,2,4].map(k=>L[parseInt(String(colOf(i)).replace('#','').slice(k,k+2),16)||0]);
  const T=ASM_PILE.T,n=T*T,key=how+JSON.stringify([base,P]);let t=asmPileMem.get(key);
  if(!t){let s=777;const rnd=()=>(s=(Math.imul(s,1103515245)+12345)&0x7fffffff)/0x7fffffff,d=new Float32Array(n),col=[],row=[];for(let x=0;x<T;x++)col.push(rnd()-.5);for(let y=0;y<T;y++)row.push(rnd()-.5);
    const cell=new Float32Array(64*64);for(let k=0;k<cell.length;k++)cell[k]=rnd()-.5;const cv=(x,y)=>cell[((y>>2)&63)*64+((x>>2)&63)];
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){const ph=P.k*x/T,r=ph-Math.floor(ph);let v;
      if(how==='cord'){const ridge=Math.pow(Math.sin(Math.PI*r),.6);v=ridge-.6+.12*col[x]*ridge+.05*row[(y+7*Math.floor(ph))%T]+.04*(rnd()-.5)}   // a wale, its streaks along it
      else{const puck=r>=.5;v=puck?.1*Math.sin(2*Math.PI*(y*P.k*3/T+.3*cv(x,y)))+.25*cv(x,y)+.12*cv(x+2,y+5)-.05:.06+.03*(rnd()-.5)}   // the puckered stripe beside the flat one
      d[y*T+x]=v}
    let m=0;for(let k=0;k<n;k++)m+=d[k];m/=n;const v=[];for(let k=0;k<n;k+=7)v.push(d[k]-m);v.sort((a,b)=>a-b);const sw=(v[Math.floor(v.length*.95)]-v[Math.floor(v.length*.05)])||1;
    t=new Float32Array(3*n);for(let k=0;k<n;k++){const g=1+P.amp*(d[k]-m)/sw;for(let q=0;q<3;q++)t[3*k+q]=Math.max(0,base[q]*g)}
    if(asmPileMem.size>12)asmPileMem.clear();asmPileMem.set(key,t)}
  return {t,c:new Float32Array(base),TW:T,TH:T,mm:P.mm,linen:false,cloth:null}}
function asmCamoTex(i){const s=typeof usableSett==='function'?usableSett(i):null;if(!s||!s.camo)return null;const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
  const T=ASM_CAMO.T,n=T*T,im=camoImage(T,s.camo.cols,s.camo.shares,s.camo.seed),cols=s.camo.cols.map(lin),t=new Float32Array(3*n);   // (core.js camoImage: soft edges, cloth grain)
  for(let k=0;k<3*n;k++)t[k]=L[im[k]]
  return {t,c:new Float32Array(cols[0]),TW:T,TH:T,mm:ASM_SHIRT_MM/Math.max(.5,+s.tr||CAMO_TR),linen:false,cloth:null}}
/* the job for asmCmBuild, or null when the kind's master or masks are not on the device */
async function asmCmJob(o){const kind=asmCmKind(o),K=ASM_CM_KINDS[kind];if(!K)return null;const keys=asmCmAssets(kind);if(keys.some(k=>!renders[k]))return null;
  const masks={};for(const z of K.zones)masks[z]=renders[asmCmKey(kind,'mask/'+z)].img;
  const parts={};for(const s of ['sleeveR','sleeveL','lapelR','lapelL']){const r=renders[asmCmKey(kind,'part/'+s)];if(r)parts[s]=r.img}
  const gks=asmCmGeoKeys(kind),geo=gks.length?{geoU:renders[gks[0]].img,geoV:renders[gks[1]].img,gt:renders[gks[0]].t+'.'+renders[gks[1]].t}:{};
  const it=asmCmItems(o,kind),cloth={};
  for(const [z,i] of Object.entries(it)){if(!i)continue;const c={hex:colOf(i)},how=asmCmRoute(i,z).how;
    try{
      if(how==='tie'){const T=await asmTieFor(i);if(T&&T.c)c.tie={c:T.c,TW:T.TW,TH:T.TH,motif:T.motif,across:T.across,ang:T.ang}}
      else if(how==='bands')c.suit=await asmSuitTex(i);
      else if(how==='camo')c.suit=asmCamoTex(i);   // camouflage's blotches
      else if(how==='look')c.suit=await asmLookSuit(i);   // an own pattern's weave or figure on a jacket, waistcoat or trousers   // a jacket's read stripes or checks: the app's suit cloth
      else if(how==='twill'&&asmWtWants(i,z))c.suit=asmWorstedTile(i);   // a worsted twill's ribs (asmWorstedTile)
      else if(how==='twill'||how==='herringbone')c.suit=asmTwillTex(i);   // the weave's ribs (jacket or trousers)
      else if(how==='tweed')c.suit=asmTweedTex(i);
      else if(how==='cord'||how==='sucker')c.suit=asmPileTile(i,how);   // corduroy's wales, seersucker's pucker (asmPileTile)
      else if(ASM_MICRO[how])c.suit=asmMicroTex(i,how);   // houndstooth, sharkskin, birdseye, nailhead
      else if(how==='knit')c.tie=asmKnitTile(i);
      else if(how==='paisley')c.tie=await asmPaisleyTile(i);
      // a shirt, or read trousers: one repeat of the app's drawing; anything else is its colour (the swatch's drawing of a fine weave,
      // tiled over a whole jacket, was a field of dots and dashes: the owner's light grey twill)
      else if(how==='tile'){const T=await asmCmTile(i,z==='shirt'?'shirt':'bot');if(T)c.tile=T;
        if(z==='shirt'&&asmCrWants(i)){const C=await asmCrTile(i);if(C)c.tile=C}}   // a figured shirt: one whole repeat from its close-up, when the finder is sure
    }catch(e){console.warn('cloth',z,e)}
    // a plain or finely woven suit, blazer or trousers with a close-up: a patch of the close-up is its cloth (asmCuTile)
    if((z==='jacket'||z==='waistcoat'||z==='trousers')&&asmCuWants(i,how)){const T=await asmCuTile(i);if(T){c.suit=T;delete c.tile}}
    c.mat=asmCmMat(i,z);
    cloth[z]=c}
  const bg=renders[asmCmBgKey()],lks=asmCmLightKeys(kind);if(lks.length)geo.light=renders[lks[0]].img;
  return {cm:kind,size:self.ASM_CM_SIZE||ASM_SIZE,mk:keys[0],mt:renders[keys[0]].t,rev:asmCmHash(keys.filter(k=>!gks.includes(k)).map(k=>renders[k].t||0).join(',')),master:renders[keys[0]].img,masks,parts,cloth,...geo,bg:bg?bg.img:null,bgt:bg?bg.t:0,
    bar:o.clip&&kind!=='vest'?asmBarRgb(o.clip):null,gl:typeof asmGlPref==='function'?asmGlPref():false}}   // (gl: this phone's graphics-chip switch, asm-gl.js; the worker has no localStorage)
/* (2026-11-14 audit) every function and constant the painting reads, so a change to any of them changes the keys by itself: a picture's
   key carries asmCmCodeSig (the job, the setup and the painting: asmCmJob, asmCmPrep, asmCmBuild and everything they call in assemble.js
   and asm-color.js) and the kept setup's key asmCmSrcSig (asmCmPrep and asmCmLightPrep with theirs). ASM_CM_PAINTV was bumped by hand
   and three changes shipped without it. tests/asmcode.test.js reads both files and fails when something these functions reach is
   missing from a list. Not in them: draw.js's drawings (fabricDef) that tiles are made from, and the cloth's own readings (in asmCmSig). */
const asmCmCode=()=>[ASM_CAMO,asmCamoTex,ASM_LOOK,asmLookSuit,asmLookTag,ASM_WT,asmWtMem,asmWtWants,asmWorstedTile,ASM_PILE,asmPileMem,asmPileKind,asmPileTile,ASM_CR,asmCrWants,asmCrFind,asmCrTile,asmCrTile1,ASM_CU,asmCuDark,asmCuFine,asmCuWants,asmCuPatch,asmCuWrap,asmCuTile,asmCuTile1,ASM_CM_FOLD_MAX,ASM_CM_FOLD_Y,asmCmFoldW,asmCmMp,ASM_CM_MIPS,ASM_CM_LOD0,asmCmMips,asmCmRead,ASM_CM_MAT,asmCmMat,ASM_TIE_LIT,asmTieLit,ASM_CM_FOLD_KEEP,asmCmFinish,asmCmFinPrep,ASM_CM_FIN,asmCmWk,ASM_CM_WLIGHT,ASM_CM_COLLAR,ASM_CM_GLOW,ASM_CM_WINK,ASM_CM_FOLD,ASM_CM_CUFF_STEP,ASM_CM_CUFF_PX,ASM_CELL_FADE,asmH32,asmCellV,asmCmSetup,ASM_CM_AA,ASM_CM_AA_CUT,ASM_CM_AA_FADE,asmAaK,asmCellT,asmTubePartQ,asmTq,asmTqn,asmTqr,ASM_GEO_PX,asmGeoPrep,asmUvAt,ASM_BAR_AT,ASM_BAR_LEN,ASM_BAR_MM,ASM_CLOSEUP_MM,ASM_CM_BG_SHADOW,ASM_CM_BTN,ASM_CM_BTN_MIX,ASM_CM_BTN_PEARL,ASM_CM_HAND_R,ASM_CM_HAND_STRAY,ASM_CM_HAND_LIT,ASM_CM_JACKET,
  ASM_CM_KINDS,ASM_CM_LIGHT,ASM_CM_LOOK,ASM_CM_RIM,ASM_CM_SOFT,ASM_CM_U16,ASM_CREASE_DEG,ASM_FLOW,ASM_FORE_K,ASM_HB_AMP,ASM_HB_BREAK,ASM_HB_COL_LIFT,ASM_HB_FLECK,ASM_HB_FLOAT,
  ASM_HB_FLOATL,ASM_HB_GRAIN,ASM_HB_MM,ASM_HB_MOTTLE,ASM_HB_PBRK,ASM_HB_RIB,ASM_HB_SHIRT_Y,ASM_HB_SNAP,ASM_HB_SOFT,ASM_HB_THIN,ASM_HB_TR,ASM_HB_YARN,ASM_KNIT_ACROSS,
  ASM_LEG_BLEND,ASM_LEG_FOLD,ASM_LEG_FOLD_MAX,ASM_LEG_HAND,ASM_LEG_K,ASM_LEG_SMOOTH,ASM_LIN,ASM_LINE_PX,ASM_METAL,ASM_MICRO,ASM_MICRO_KINDS,ASM_PAISLEY_ACROSS,ASM_PX_MM,
  ASM_SHIRT_MM,ASM_SIZE,ASM_SLEEVE_FLOW,ASM_STRIPE,ASM_STRIPE_PX,ASM_SUITV,ASM_TEX_MIN_MM,ASM_TIEV,ASM_TIE_FIG_MAX,ASM_TIE_SHEEN_MIN,ASM_TIE_SHEEN_Y,ASM_TIE_TEX_MAX,
  ASM_TR_CAP,ASM_TUBE_K,ASM_TWEED,ASM_TWILL,asmAreas,asmBarDraw,asmBarRgb,asmBodyFlow,asmClothOf,asmCmAssets,asmCmAt,asmCmBlur,asmCmBtnCol,asmCmBuild,asmCmButtons,
  asmCmCanvas,asmCmHandEdge,asmCmItems,asmCmJob,asmCmKind,asmCmLightPrep,asmCmPrep,asmCmRefit,asmCmRoute,asmCmTile,asmData,asmFlowAt,asmHbCw,asmHbShirt,asmHbShirtLook,
  asmImg,asmJpeg,asmKnitTile,asmLegsAt,asmLegsPrep,asmLinen,asmLinenTile,asmMicroGrid,asmMicroKind,asmMicroTex,asmMotif,asmPaisleyTile,asmPolyAt,asmRepeatPx,
  asmSleeveFlow,asmSleeveSegs,asmStripeCount,asmSuitBands,asmSuitSig,asmSuitTex,asmSuitTweed,asmSuitTwill,asmSuitWeave,asmTexMm,asmTieFor,asmTieSheenK,asmTieSig,
  asmTieTile,asmTubeAt,asmTubePart,asmTubeRaw,asmTubeTabs,asmTweedTex,asmTweedTile,asmTwillTex,asmWeave];
let asmCmCodeH=null;
const asmCmCodeSig=()=>asmCmCodeH||(asmCmCodeH=asmCmHash(asmCmCodeText(asmCmCode())));

/* ---- faster masters on a phone (2026-11-14, the owner's ask: loading a master was the slow part; measured on a simulated phone, CPU 4x
   slower and 4G: a master's first use took about 15.5 s, 6.1 s downloading its 16 files, 7.5 s working out its setup, 1.9 s painting;
   with the setup kept, 2.6 s). Warming, which touches none of the functions in the pictures' code fingerprints: once Today's look is shown
   and the days ahead are fetched (asmAhead), the masters the coming looks use are downloaded and set up in the background, one at a time
   (asmCmWarm), so a day nobody built paints in about 2.6 s even the first time. (CR-8-06, 2026-11-17) The PC builder's shared setups
   (PUT /blob) and 2048 copies of the masters, which nothing has uploaded since it was removed on 2026-11-16, are no longer asked for:
   a phone downloads the master and works its setup out once (kept on disk, asmCmPack) ---- */
/* the master part of a job (asmCmJob's, without the outfit's cloth): enough to work out or read back the master's setup */
function asmCmBaseJob(kind,size){const K=ASM_CM_KINDS[kind];if(!K)return null;const keys=asmCmAssets(kind);if(keys.some(k=>!renders[k]))return null;
  const masks={};for(const z of K.zones)masks[z]=renders[asmCmKey(kind,'mask/'+z)].img;
  const parts={};for(const s of ['sleeveR','sleeveL','lapelR','lapelL']){const r=renders[asmCmKey(kind,'part/'+s)];if(r)parts[s]=r.img}
  const gks=asmCmGeoKeys(kind),geo=gks.length?{geoU:renders[gks[0]].img,geoV:renders[gks[1]].img,gt:renders[gks[0]].t+'.'+renders[gks[1]].t}:{};
  return {cm:kind,size:size||self.ASM_CM_SIZE||ASM_SIZE,mk:keys[0],mt:renders[keys[0]].t,rev:asmCmHash(keys.filter(k=>!gks.includes(k)).map(k=>renders[k].t||0).join(',')),master:renders[keys[0]].img,masks,parts,...geo}}
/* the item sheet's line when the pictures paint this piece plain or generic (none with "Drawing only": nothing is painted) */
/** @param {*} i */ function asmGapNote(i){if(!ASM_ON||asmDrawn())return '';const z=ASM_CM_ZONE[i.type];if(!z)return '';const r=asmCmRoute(i,z);
  return r.gap?`<p class="shelp asmgap">Outfit pictures: ${esc(i.photo||i.texture?r.why:r.why.replace('(Read pattern from photo)','(add a photo, then Read pattern from photo)'))}.</p>`:''}   // (no photo: Read pattern from photo isn't offered yet)
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
/* the second colour of a stripe: the item's own, else navy on a light top and cream on a dark one */
const asmNkSecond=i=>{const c=i.secondaryColor&&i.secondaryColor!=='none'&&COLORS[i.secondaryColor];if(c)return c;const [r,g,b]=asmNkLin(colOf(i));return .2126*r+.7152*g+.0722*b>.25?'#1f2a44':'#ece6d6'};
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
function asmOcpTex(i){const s=typeof usableSett==='function'?usableSett(i):null;if(!s||!s.ocp)return null;const k=s.camo.seed;if(asmOcpMemo.has(k))return asmOcpMemo.get(k);
  const N=ASM_OCP_TEX,L=ASM_LIN,im=ocpImage(N,k),t=new Float32Array(3*N*N);for(let q=0;q<3*N*N;q++)t[q]=L[im[q]];
  // (2026-11-18, the owner: "real ripstop OCP cloth, not a flat print") the ripstop grid: a heavier thread every ASM_OCP_RIP of the tile
  // (about 5.5 mm), its line a little darker with a faint lighter shoulder, and a fine plain-weave grain between
  const P=ASM_OCP_RIP,rip=new Float32Array(N);for(let x=0;x<N;x++){const d=Math.min(x%P,P-x%P);rip[x]=d<1?.9:d<2?1.03:1}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const g=rip[x]*rip[y]*(1+.025*(((x*13+y*7)%3)-1)),o=3*(y*N+x);t[o]*=g;t[o+1]*=g;t[o+2]*=g}
  const h=String(s.camo.cols[0]).replace('#',''),c=new Float32Array([0,2,4].map(q=>L[parseInt(h.slice(q,q+2),16)||0]));
  const T={t,c,TW:N,TH:N,mm:OCP_CAMO.mm,linen:false,cloth:null};if(asmOcpMemo.size>2)asmOcpMemo.clear();asmOcpMemo.set(k,T);return T}
const asmOcpClothKey=()=>asmCmKey('blouse',ASM_OCP_CLOTH.name);
const asmOcpClothT=()=>{try{return asmCmMfNow().keys[asmOcpClothKey()]||0}catch{return 0}};
async function asmOcpPhotoTex(){const k=asmOcpClothKey(),t0=asmOcpClothT();if(!t0)return null;
  if(!renders[k])await asmGet(k).catch(()=>false);const r=renders[k];if(!r||!r.img)return null;
  const mk='photo:'+(r.t||t0);if(asmOcpMemo.has(mk))return asmOcpMemo.get(mk);
  const d=await asmData(r.img),N=d.width,L=ASM_LIN,p=d.data,t=new Float32Array(3*N*N),c=new Float32Array(3);
  for(let q=0;q<N*N;q++)for(let e=0;e<3;e++){const v=L[p[4*q+e]];t[3*q+e]=v;c[e]+=v}for(let e=0;e<3;e++)c[e]/=N*N;
  const T={t,c,TW:N,TH:N,mm:ASM_OCP_CLOTH.mm,linen:false,cloth:null};if(asmOcpMemo.size>2)asmOcpMemo.clear();asmOcpMemo.set(mk,T);return T}
/* the job's last step (assemble.js asmJob, after the watch and pocket square): on the blouse's master no watch or pocket square (the
   blouse covers the wrist and has no breast pocket) and the rank on the chest tab; OCP pants in his own OCP cloth, else the made-up
   one, on any master */
async function asmOcpJob(j,o,k){if(!j||!j.cloth)return j;
  if(ASM_OCP_KINDS[k]){delete j.watch;delete j.pocket;const D=asmOcpDecal(o.top);if(D)j.ocpDecal=D}
  const tr=j.cloth.trousers;if(tr&&tr.suit&&o.bot&&typeof isOcp==='function'&&isOcp(o.bot)){const own=await asmOcpPhotoTex(),ck=asmOcpClothKey();
    // (2026-11-24, the code review R8 N1) the manifest lists his cloth (the key says 'oc:', asmOcpSig) but it isn't here and the worker
    // hasn't answered 404 (no connection, a 5xx, the day's limits: asmGetOnce asks again after ASM_RETRY_MS): no job, so no picture in
    // the made-up cloth is kept under his cloth's key; the look is painted at a later try. Only a 404 (asmTried) falls back
    if(!own&&asmOcpClothT()&&!renders[ck]&&!asmTried.has(ck))return null;
    const T=own||asmOcpTex(o.bot);if(T)j.cloth={...j.cloth,trousers:{...tr,suit:T}}}
  return j}
const asmOcpSig=(o,k)=>{const s=[];if(ASM_OCP_KINDS[k]&&o&&o.top&&typeof blouseTapes==='function')s.push('rank:'+ASM_OCP_DECV+'/'+(blouseTapes(o.top).rank||''));
  if(o&&o.bot&&typeof isOcp==='function'&&isOcp(o.bot)){const t=asmOcpClothT();if(t)s.push('oc:'+t)}   // his own OCP cloth (asmOcpPhotoTex)
  return s.join('|')};
/* the masks (page only: a canvas draws them): {ink, boxes:[{x, y, w, h, img, cover}]} with each box's mask at 2x, or null with nothing to
   change on the master's tab */
function asmOcpDecal(it){if(typeof document==='undefined'||typeof blouseTapes!=='function')return null;const T=blouseTapes(it),boxes=[],K=2;
  if(T.rank===ASM_OCP_MASTER_RANK)return null;
  const mk=(b,draw,cover)=>{const [x,y,w,h]=b,c=document.createElement('canvas');c.width=w*K;c.height=h*K;const g=c.getContext('2d');if(!g)return;g.scale(K,K);g.fillStyle='#fff';draw(g,w,h);boxes.push({x,y,w,h,img:c.toDataURL('image/png'),cover:!!cover})};
  mk(ASM_OCP_BOX.tab,(g,w,h)=>{g.fillRect(w*.12,h*.1,w*.76,h*.74)},true);   // the master's leaf covered (the tab's border left)
  if(T.rank&&typeof OCP_RANK_SVG!=='undefined'&&OCP_RANK_SVG[T.rank])mk(ASM_OCP_BOX.rank,(g,w,h)=>{const p=new Path2D(OCP_RANK_SVG[T.rank]),s=Math.min(w,h)/100;g.translate((w-100*s)/2,(h-100*s)/2);g.scale(s,s);g.fill(p)});
  return {ink:ASM_OCP_INK,boxes}}
/* everything the painting needs, as plain data (photos as data URLs), or null: a look with no colour-coded master (asm-color.js asmCmJob) */
/** @param {*} o */ async function asmJob(o){const k=asmCmUse(o);if(!k)return null;const ob=typeof asmOcpBase==='function'?asmOcpBase(o,k):o;let j=/** @type {any} */(await asmCmJob(ob));   // (the blouse's master is built on the open-shirt master's items: asm-ocp.js)
  if(j)j=await asmNkJob(j,ob,k);   // a new garment's master and cloth, the faded master for jeans (asm-kinds.js)
  if(j&&typeof asmWatchJob==='function'){const w=asmWatchJob(o,asmNkBaseOf(k));if(w)j.watch=w}
  if(j&&typeof asmPocketJob==='function'){const q=asmPocketJob(o,asmNkBaseOf(k));if(q)j.pocket=q}
  if(j&&typeof asmOcpJob==='function')j=await asmOcpJob(j,o,k);   // the uniform blouse (no watch or pocket square, the rank), OCP pants (asm-ocp.js)
  return j}   // (the day's watch painted after: asm-watch.js; a new kind's watch is its base master's)
const setAsmCmMf=v=>{asmCmMf=v};   // (asm-cm-page.js asmCmMfApply: an imported binding is read-only)
/* sockets (bus.js; the restructure S6p, 2026-11-27): what the today-no-picture files (asm-look.js, asm-today.js, draw.js) and the
   other optional groups (today-picture.js, the item sheet, the Add page's look.js) ask of this optional file, which they may not import */
serve('asm-job',asmJob);serve('asm-kind-of',asmKindOf);serve('asm-cm-out-key',asmCmOutKey);serve('asm-cm-stamp',asmCmStamp);serve('asm-cm-bg-get',asmCmBgGet);
serve('asm-cm-route',asmCmRoute);serve('asm-cu-wants',asmCuWants);serve('asm-wt-wants',asmWtWants);serve('asm-cu-tile',asmCuTile);serve('asm-worsted-tile',asmWorstedTile);
serve('asm-cm-tile',asmCmTile);serve('asm-hb-shirt',asmHbShirt);serve('asm-gap-note',asmGapNote);
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,asmJob,asmCamoTex,asmCmAssets,asmCmCode,get asmCmCodeH(){return asmCmCodeH},set asmCmCodeH(v){asmCmCodeH=v},asmCmCodeSig,asmCmGaps,asmCmGeoKeys,asmCmMat,get asmCmMf(){return asmCmMf},set asmCmMf(v){asmCmMf=v},asmCmMfKey,asmCmRev,asmCmSig,asmCmTrSc,asmCmWeaveTag,asmCrTag,asmCrTile1,asmCrWants,asmCuTag,asmCuTile1,asmPileTile,asmWtTag,asmCmBaseJob,asmCmMfNow,asmJfKey,asmNkCloth,asmNkKnitTile,asmOcpPhotoTex,asmCmBgKey,asmCmJob,asmCmKindOf,asmCmOutKey,asmCmRoute,asmCmTile,asmCuTile,asmCuWants,asmGapNote,asmHbShirt,asmKindOf,asmOcpSig,asmPocketJob,asmWatchJob,asmWatchPaints,asmWorstedTile,asmWtWants};
export {asmJob,setAsmCmMf,asmWatchPaints,asmWatchSig,asmWatchJob,asmPocketSig,asmPocketJob,asmCmAssets,asmCmLightKeys,asmCmGeoKeys,asmKindOf,asmCmMat,asmCmWeaveTag,asmCmRoute,asmCmGaps,asmCmTrSc,asmCmSig,asmCmOutKey,asmCmStamp,asmCmBgKey,asmCmBgGet,asmCmMfKey,asmCmMfNow,asmCmRev,asmCrWants,asmCrTag,asmCrTile1,asmCmTile,asmHbShirt,asmCuWants,asmCuTag,asmCuTile,asmCuTile1,asmWtWants,asmWtTag,asmWorstedTile,asmPileTile,asmCamoTex,asmCmJob,asmCmCode,asmCmCodeSig,asmCmBaseJob,asmGapNote,asmCmMf,asmCmCodeH,asmJfKey,asmJfWants,asmCmKindOf,asmNkKnitTile,asmNkCloth,asmNkJob,asmNkSig,asmOcpPhotoTex,asmOcpJob,asmOcpSig};
