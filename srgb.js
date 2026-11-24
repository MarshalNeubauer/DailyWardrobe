/* sRGB <-> linear light, written once (CR-8-09, 2026-11-17): it was copied about 20 times across the drawing files, and one hand copy (the
   mannequin's shirt buttons) had drifted from the painter. Loaded first on the page (index.html) and in the picture worker (asm-worker.js).
   The copies inside the painter's code fingerprint (asm-color.js asmCmCode: asmCmBtnCol, asmCmBuild's gam and hexLin; assemble.js ASM_LIN)
   stay where they are until a planned repaint (ASM_CM_PAINTV): moving them changes every look's key. The same arithmetic as the copies,
   so every result is bit for bit the same */
const srgbLin=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);   // a display value 0..1 -> linear
const linSrgb=v=>v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055;   // linear -> a display value 0..1 (not clamped)
const srgbLin8=v=>srgbLin(v/255);   // a display byte 0..255 -> linear
const linSrgb8=v=>255*linSrgb(v<0?0:v>1?1:v);   // linear, clamped to 0..1 -> a display value 0..255 (not rounded)
/* the bridge (an ES module since C3, 2026-11-24): what the classic scripts, the other modules, asm-worker.js and the tests still use as globals (tests/bridge.test.js lists who) */
Object.assign(globalThis,{srgbLin,linSrgb,srgbLin8,linSrgb8});
export {srgbLin,linSrgb,srgbLin8,linSrgb8};
