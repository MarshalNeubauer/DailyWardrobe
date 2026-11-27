/* sRGB <-> linear light, written once (CR-8-09, 2026-11-17): it was copied about 20 times across the drawing files, and one hand copy (the
   mannequin's shirt buttons) had drifted from the painter. Loaded first on the page (index.html) and in the picture worker (asm-worker.js).
   The same arithmetic as the copies it replaced, so every result is bit for bit the same. Since C3 (2026-11-24) the painter's
   fingerprinted code calls it (asmCmBtnCol, asmCmBuild's gam, assemble.js ASM_LIN), but these four names are in no picture key
   (asm-color.js asmCmCode): an edit here changes every painted pixel and no key. tests/asmcode.test.js pins this file's code, so change
   it only with a planned repaint (bump ASM_CM_PAINTV, or add the four names to asmCmCode: every phone repaints every look) */
const srgbLin=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);   // a display value 0..1 -> linear
const linSrgb=v=>v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055;   // linear -> a display value 0..1 (not clamped)
const srgbLin8=v=>srgbLin(v/255);   // a display byte 0..255 -> linear
const linSrgb8=v=>255*linSrgb(v<0?0:v>1?1:v);   // linear, clamped to 0..1 -> a display value 0..255 (not rounded)
/* the bridge (an ES module since C3, 2026-11-24): what the classic scripts, the other modules, asm-worker.js and the tests still use as globals (tests/bridge.test.js lists who) */
Object.assign(globalThis,{srgbLin,linSrgb,srgbLin8,linSrgb8});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,linSrgb,linSrgb8,srgbLin8};
export {srgbLin,linSrgb,srgbLin8,linSrgb8};
