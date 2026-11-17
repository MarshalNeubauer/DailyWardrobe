/* Daily Wardrobe worker: the pattern lists and the bitmap cleaner shared by POST /pattern (pattern.js) and POST /describe (describe.js).
   One copy (CR-2-15: both files had their own, and nothing checked they agreed). A leaf module: it imports nothing. */
/* a weave texture's kinds (a dress shirt's dobby diamonds, herringbone, oxford) */
const TEXTURE_KINDS = ['diamond', 'herringbone', 'twill', 'oxford', 'royal-oxford', 'pinpoint', 'end-on-end', 'birdseye', 'honeycomb', 'dobby-dot', 'basket', 'other'];
/* a motif figure's shapes (a neat or foulard: squares, dots, a drawn figure) */
const MOTIF_SHAPES = ['square', 'square-with-dot', 'diamond', 'dot', 'ring', 'cross', 'flower', 'figure', 'other'];
/* where a motif figure sits: in every grid cell, where four cells meet, or in every other cell (the schema and the cleaners of both routes) */
const MOTIF_PLACES = ['cell', 'corner', 'alternate-cells'];
/* how strong a weave texture reads */
const TEX_CONTRASTS = ['faint', 'subtle', 'clear'];
/* a bitmap: rows of 1/0 (also #/. and x/-), the same length, lo..hi cells each way, some 1 in it; both tones present when both is set */
function bitmapOf(g, lo, hi, both) {
  if (!Array.isArray(g)) return null;
  const rows = g.slice(0, hi).map(r => String(r).replace(/[^01#.xX-]/g, '').replace(/[#xX]/g, '1').replace(/[.-]/g, '0').slice(0, hi)).filter(Boolean);
  const w = Math.max(0, ...rows.map(r => r.length)), out = rows.map(r => r.padEnd(w, '0')), all = out.join('');
  if (out.length < lo || w < lo || !all.includes('1') || (both && !all.includes('0'))) return null;
  return out;
}

export { MOTIF_PLACES, MOTIF_SHAPES, TEX_CONTRASTS, TEXTURE_KINDS, bitmapOf };
