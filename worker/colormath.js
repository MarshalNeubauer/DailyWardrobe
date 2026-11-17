/* Daily Wardrobe worker: colour arithmetic, one copy for the server and its tools (CR-2-15: worker/describe.js and tools/describe-eval.js each
   had their own). The worker can't load the app's core.js, so this is the server's copy of core.js's rgbLab and dE00; tests/colormath.test.js
   checks that the two give exactly the same numbers. A leaf module: it imports nothing. */
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/* CIE L*a*b* of an sRGB colour (0-255) (core.js rgbLab) */
function rgbLab(r, g, b) {
  const v = [r, g, b].map(u => { u /= 255; return u > .04045 ? ((u + .055) / 1.055) ** 2.4 : u / 12.92; });
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116, X = f((v[0] * .4124 + v[1] * .3576 + v[2] * .1805) / .95047), Y = f(v[0] * .2126 + v[1] * .7152 + v[2] * .0722), Z = f((v[0] * .0193 + v[1] * .1192 + v[2] * .9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
/* CIE L*a*b* of a #rrggbb hex (core.js labOf, for any hex) */
const hexLab = h => rgbLab(...hexRgb(h));
/* CIEDE2000 colour difference (core.js dE00 with kL 1) */
function dE00(a, b) {
  const [L1, a1, b1] = a, [L2, a2, b2] = b, rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2,
    G = .5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7))), A1 = a1 * (1 + G), A2 = a2 * (1 + G), c1 = Math.hypot(A1, b1), c2 = Math.hypot(A2, b2),
    h = (y, x) => { const t = Math.atan2(y, x) / rad; return t < 0 ? t + 360 : t; }, h1 = h(b1, A1), h2 = h(b2, A2), dL = L2 - L1, dC = c2 - c1;
  let dh = c1 * c2 === 0 ? 0 : h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh * rad / 2);
  const Lm = (L1 + L2) / 2, cm = (c1 + c2) / 2; let hm = h1 + h2; if (c1 * c2 !== 0) { if (Math.abs(h1 - h2) > 180) hm += hm < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - .17 * Math.cos((hm - 30) * rad) + .24 * Math.cos(2 * hm * rad) + .32 * Math.cos((3 * hm + 6) * rad) - .2 * Math.cos((4 * hm - 63) * rad),
    SL = 1 + .015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + .045 * cm, SH = 1 + .015 * cm * T, RT = -2 * Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

export { dE00, hexLab, hexRgb, rgbLab };
