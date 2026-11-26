/* Daily Wardrobe: the Look beta's base (the restructure S5d, 2026-11-26): its switch, which types have what, a field's value and the pattern groups,
   moved out of look.js with their text unchanged so colpick.js, checklist.js, add-card.js and own-lists.js (loaded before look.js) import them;
   look.js imports them too. Nothing runs at load. */
import {MATERIALS_BY,METAL,TEXTURE_TYPES,clipMetal,colName,hasPat,items,leatherWord,leathersFor,metalWord,patBase,watchOpts} from './core.js';
import {cap1} from './app.js';
const LOOK_LS='beta_look';
let lookBetaMemo=null;
function setLookMemo(v){lookBetaMemo=v}   // (look.js lookSet)
function lookOn(){if(lookBetaMemo===null){try{lookBetaMemo=localStorage.getItem(LOOK_LS)==='1'}catch{lookBetaMemo=false}}return lookBetaMemo}
const LOOK_CU=['sweater','qzip','cardigan','polo','socks','pocketsquare','overcoat','raincoat'];   // also take a close-up in the beta
const LOOK_COATS=['overcoat','raincoat'];   // patterns and a second color in the beta (core.js PATS_BY)
const LOOK_METALT=['watch','tieclip','cufflinks'];
const LOOK_CLIP_METALS=['silver','gold','rosegold','gunmetal'];   // a tie clip's metal: its colour key when it has no enamel (planner.js clipMetal reads it)
const LOOK_ENAMEL=['black','red','blue','navy'];   // the clip colours clipMetal reads as enamel (null): the planner's enamelPref
const LOOK_METAL_COLS=['silver','gold','rosegold','gunmetal'];   // no shade for a metal
const lookCu=t=>TEXTURE_TYPES.includes(t)||(lookOn()&&LOOK_CU.includes(t));
const lookHasPat=t=>hasPat(t)||(lookOn()&&LOOK_COATS.includes(t));
const LOOK_SHIRT_FIBERS=['cotton','cotton blend','linen','linen blend','silk','wool','polyester','polyester blend','performance stretch','rayon','modal','lyocell','bamboo'];
const LOOK_SHIRT_CLOTHS=['flannel','seersucker','corduroy','denim','jersey'];
const LOOK_SHIRT_AS={poplin:'cotton'};
function lookBuiltins(it,k){const t=it.type;
  if(k==='material')return t==='shirt'?[...LOOK_SHIRT_FIBERS,...LOOK_SHIRT_CLOTHS]:(MATERIALS_BY[t]||[]).slice();
  if(k==='leather')return leathersFor(it).slice();
  if(t==='tieclip')return LOOK_CLIP_METALS.slice();
  return [...Object.keys(METAL),...(t==='cufflinks'&&k==='metal'?['silk']:[])]}
function lookCur(it,k){
  if(k==='enamel'){const c=it.primaryColor;return LOOK_ENAMEL.includes(c)?c:'none'}
  if(k==='dial')return watchOpts(it).dial;
  return lookVal(it,k).v}
function lookVal(it,k){const t=it.type;
  if(k==='material'){const m=String(it.material||'').trim(),l=lookBuiltins(it,'material');if(!m)return {v:'none',name:'Not set'};
    if(t==='shirt'&&LOOK_SHIRT_AS[m.toLowerCase()])return {v:LOOK_SHIRT_AS[m.toLowerCase()],name:cap1(LOOK_SHIRT_AS[m.toLowerCase()]),note:`saved as ${m.toLowerCase()}`};
    if(l.includes(m))return {v:m,name:cap1(m)};return {v:'own:'+m,name:cap1(m)}}
  if(k==='leather'){if(it.leatherOwn)return {v:'own:'+it.leatherOwn,name:cap1(it.leatherOwn)};
    // (an Add card with none yet is saved as calf, add.js saveCard, unless None was picked: leatherNone)
    const l=it.leather||(it.leatherNone||items.some(x=>x.id===it.id)?'':'calf');if(!l)return {v:'none',name:'Not set'};
    return {v:l,name:cap1(leatherWord(it,l))}}
  if(t==='tieclip'){if(it.metalOwn)return {v:'own:'+it.metalOwn,name:cap1(it.metalOwn)};const m=lookClipMetal(it),pc=it.primaryColor;
    return {v:m,name:cap1(colName(m)),note:pc&&!LOOK_CLIP_METALS.includes(pc)&&!LOOK_ENAMEL.includes(pc)?`saved as ${colName(pc)}`:''}}
  if(it.metalOwn)return {v:'own:'+it.metalOwn,name:cap1(it.metalOwn)};const m=it.metal||'silver';return {v:m,name:cap1(metalWord(m))}}
function lookClipMetal(it){const pc=it.primaryColor;if(LOOK_CLIP_METALS.includes(pc))return pc;const cm=clipMetal(it);if(cm==='silver')return 'silver';if(cm==='other')return 'gunmetal';
  return LOOK_CLIP_METALS.includes(it.metal)?it.metal:'silver'}
const LOOK_PK=['material','leather','metal','buckle'];
const LOOK_KS=[...LOOK_PK,'enamel','dial'];
const LOOK_PAT_GROUPS=[[['solid','heather'],'Plain'],[['pinstripe','chalk-stripe','stripe','fine-stripe'],'Stripes'],[['glen-check','windowpane','check','gingham','tattersall','tonal-check','houndstooth'],'Checks'],
  [['herringbone','birdseye','nailhead','sharkskin','twill','tweed','oxford','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture'],'Weaves'],[['knit','ribbed','cable'],'Knits'],
  [['polka-dot','paisley','foulard','camouflage','argyle','clock','border'],'Figures']];
const lookPatGroupOf=p=>{const b=patBase(p);const g=LOOK_PAT_GROUPS.findIndex(([l])=>l.includes(b));return g<0?LOOK_PAT_GROUPS.length:g};
/* the bridge (tests/bridge.test.js): core.js, item-view.js, itemsheet.js, item-photo.js and tagging.js still ask lookOn as a global, the tests the rest */
Object.assign(globalThis,{lookOn,LOOK_COATS,LOOK_METALT,LOOK_ENAMEL,LOOK_METAL_COLS,lookCu,lookHasPat,lookCur,lookClipMetal,LOOK_PK,LOOK_KS,LOOK_PAT_GROUPS,lookPatGroupOf});
export {LOOK_LS,lookOn,setLookMemo,LOOK_CU,LOOK_COATS,LOOK_METALT,LOOK_CLIP_METALS,LOOK_ENAMEL,LOOK_METAL_COLS,lookCu,lookHasPat,LOOK_SHIRT_FIBERS,LOOK_SHIRT_CLOTHS,LOOK_SHIRT_AS,lookBuiltins,lookCur,lookVal,lookClipMetal,LOOK_PK,LOOK_KS,LOOK_PAT_GROUPS,lookPatGroupOf};
