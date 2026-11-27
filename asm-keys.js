
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
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,ASM_CMV,ASM_CM_KINDS};
export {ASM_CMV,ASM_CM_KINDS};
