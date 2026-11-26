/* Daily Wardrobe: the color-coded masters' version, their kinds and their records' keys, read by both assemble.js and asm-color.js
   (the restructure S4, 2026-11-26: moved out of asm-color.js with their text unchanged, so the painter's fingerprint is unchanged too;
   ASM_CM_KINDS is in asmCmPrepCode). It loads before both, on the page (index.html) and in the painting worker (asm-worker.js). */
const ASM_CMV=1;   // the colour-coded masters' version: in their keys and every picture's key
const ASM_CM_KINDS={
  suit:{zones:['jacket','tie','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  vest:{zones:['jacket','waistcoat','tie','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  'shirt-tie':{zones:['trousers','belt','tie','buckle','background','skin','shirt','dark','watch'],sleeves:1,lapels:0,pxmm:116/174},
  'shirt-open':{zones:['trousers','belt','buckle','background','skin','shirt','dark','watch'],sleeves:1,lapels:0,pxmm:116/174*1.05},
  // a jacket with no tie (Today's "Take off" on the tie, 2026-11-13), made like the suit and waistcoat masters
  'suit-open':{zones:['jacket','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  'vest-open':{zones:['jacket','waistcoat','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1}};
// (pxmm: the shirt masters are framed wider; measured: the tie 116 px wide at 2048 against 174 on the suit master, the open collar's
// shirt about 5% wider again)
const asmCmKey=(kind,name)=>asmKey('cm'+ASM_CMV+'/'+kind+'/'+name);
/* the bridge: what the other files, asm-worker.js and the tests use as globals (tests/bridge.test.js lists who) */
Object.assign(globalThis,{ASM_CMV,ASM_CM_KINDS,asmCmKey});
export {ASM_CMV,ASM_CM_KINDS,asmCmKey};
