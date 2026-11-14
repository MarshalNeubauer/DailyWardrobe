/* Daily Wardrobe worker: POST /pattern: Claude reads a woven pattern from the photo and the close-up as clean data.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { HEX_RE, TYPE_LIST, tagWithClaude, txt, wbOf } from './tag.js';
import { spend, unspend } from './people.js';

/* POST /pattern {image, closeup, type} -> the woven pattern as clean data, for the app to draw. The pixels of a photo carry noise
   (seams, folds, moire, slubs, panes made uneven by drape or perspective) that defeats measuring the pattern from them alone;
   Claude reads the pattern as it was woven: each direction's bands in order with their width share, and how many repeats the
   close-up and the item show. The app takes the exact colours from the pixels (tagging.js). */
const PBAND = { type: 'object', additionalProperties: false, required: ['role', 'name', 'hex', 'widthPct'],
  properties: { role: { type: 'string', enum: ['ground', 'line'] }, name: { type: 'string' }, hex: { type: 'string' }, widthPct: { type: 'number' } } };
const PDIR = { type: 'object', additionalProperties: false, required: ['bands'], properties: { bands: { type: 'array', items: PBAND } } };
/* a small figure repeated on a grid (a neat / foulard, mini squares, dots): the grid, the ground between the figures, and each
   figure's shape, place in the grid, colours (two alternate like a checkerboard) and size */
const PCOL = { type: 'object', additionalProperties: false, required: ['name', 'hex'], properties: { name: { type: 'string' }, hex: { type: 'string' } } };
const MOTIF_SHAPES = ['square', 'square-with-dot', 'diamond', 'dot', 'ring', 'cross', 'flower', 'figure', 'other'];
const PFIG = { type: 'object', additionalProperties: false, required: ['shape', 'placement', 'colours', 'centre', 'sizePct', 'bitmap', 'name'],
  properties: { shape: { type: 'string', enum: MOTIF_SHAPES }, placement: { type: 'string', enum: ['cell', 'corner', 'alternate-cells'] },
    colours: { type: 'array', items: PCOL }, centre: { anyOf: [PCOL, { type: 'null' }] }, sizePct: { type: 'number' },
    bitmap: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] }, name: { type: 'string' } } };
const PMOTIF = { type: 'object', additionalProperties: false, required: ['grid', 'ground', 'figures', 'cellAspect', 'rowOffset'],
  properties: { grid: { type: 'string', enum: ['straight', 'diagonal'] }, ground: PCOL, figures: { type: 'array', items: PFIG },
    cellAspect: { type: 'number' }, rowOffset: { type: 'string', enum: ['none', 'half'] } } };
/* a weave texture (a dress shirt's dobby diamonds, herringbone, oxford): the cloth is one colour and the pattern is in how the
   threads float, so it is read as a small bitmap of one repeat (1 = reads raised / catches the light) */
const TEXTURE_KINDS = ['diamond', 'herringbone', 'twill', 'oxford', 'royal-oxford', 'pinpoint', 'end-on-end', 'birdseye', 'honeycomb', 'dobby-dot', 'basket', 'other'];
const PTEX = { type: 'object', additionalProperties: false, required: ['kind', 'grid', 'aspect', 'ground', 'raised', 'contrast'],
  properties: { kind: { type: 'string', enum: TEXTURE_KINDS }, grid: { type: 'array', items: { type: 'string' } }, aspect: { type: 'number' }, ground: PCOL, raised: PCOL,
    contrast: { type: 'string', enum: ['faint', 'subtle', 'clear'] } } };
const PATTERN_SCHEMA = { type: 'object', additionalProperties: false,
  required: ['layout', 'across', 'along', 'motif', 'texture', 'stripeDirection', 'repeatsInCloseup', 'repeatsAcrossItem', 'paneAspect', 'ignored', 'description'],
  properties: {
    layout: { type: 'string', enum: ['stripes', 'check', 'windowpane', 'plaid', 'motif', 'texture', 'none'] },
    across: { anyOf: [PDIR, { type: 'null' }] }, along: { anyOf: [PDIR, { type: 'null' }] }, motif: { anyOf: [PMOTIF, { type: 'null' }] }, texture: { anyOf: [PTEX, { type: 'null' }] },
    stripeDirection: { type: 'string', enum: ['vertical', 'horizontal', 'upper-left to lower-right', 'lower-left to upper-right'] },
    repeatsInCloseup: { type: 'number' }, repeatsAcrossItem: { type: 'number' }, paneAspect: { type: 'number' },
    ignored: { type: 'string' }, description: { type: 'string' },
  } };
const PATTERN_PROMPT = `You are reading the woven pattern of a cloth so an app can draw it exactly. The first photo is the whole item; the second
(when there is one) is a close-up of its cloth. Report the pattern as it was WOVEN, stripping away everything that is not the
pattern: seams and the pattern shift across them, folds, shadows, sheen, moire, slubs and other texture of the weave, and panes or
stripes made uneven by drape or by the camera's angle (report the regular spacing they were woven at).

layout — stripes (lines one way), check, windowpane (thin lines both ways on a plain ground, large panes), plaid (several
  colours both ways), motif (a small figure repeated on a regular grid: a neat or foulard, mini squares, dots, diamonds, and
  a shirt's figured dobby whose small figures are woven in a second, clearly different colour, e.g. grey chevrons on white),
  texture (the cloth is one colour, or nearly, and the pattern is in the weave itself: a dress shirt's dobby diamonds,
  herringbone, twill, oxford, pinpoint, end-on-end, birdseye, honeycomb), or none. When the figures stand out in their own
  colour at a glance, it is a motif, not a texture.
across — one full repeat of the main lines, measured across them (for vertical lines from left to right, for a tie's diagonal
  stripes across the stripes): every band in order, the ground included, each with role (ground or line), a plain colour name,
  an sRGB hex of how that thread looks in neutral daylight (a light blue line is light blue even where the photo greys it),
  and widthPct, its share of the repeat in percent (the bands add up to 100). A line made of several close threads (a blue line
  with a thin white line each side) is listed thread by thread with the ground between them.
along — the same for the lines running the other way (top to bottom for horizontal lines), or null if there are none.
  For a motif or a texture, across and along are null.
motif — for a motif only (null otherwise), as woven, one grid cell being one repeat:
  grid: straight (rows and columns run with the item's edges) or diagonal (rows and columns run at 45°, squares stand on a point);
  ground: the colour that shows between the figures (a plain colour name and an sRGB hex as in "across");
  figures: each kind of figure, largest first, with
    shape: square, square-with-dot (a small square with a dot of another colour in its middle), diamond (a square on its point
      in a straight grid), dot, ring, cross, flower, figure (any other small shape: draw it in "bitmap"), or other;
    bitmap: for shape figure, the figure alone as a small bitmap, top row first: each row a string of 1 and 0 of the same
      length, 3 to 16 each way, 1 where the figure's colour is, 0 where the ground shows, with the figure's own proportions.
      Copy the figure in the close-up: its real outline and how thick its strokes are, filling the bitmap edge to edge, not an
      idealised icon (the format only, not a shape to reuse: a small plus sign is ["010","111","010"]); null for the other shapes;
    name: what the figure is in a few words (e.g. "downward chevron", "small square with a dot");
    placement: cell (one in every grid cell), corner (one where four cells meet, between the cell figures), or alternate-cells
      (only in every other cell, like the dark squares of a checkerboard);
    colours: its colour, or two colours when neighbouring figures alternate like a checkerboard (purple and navy squares);
    centre: the dot's colour for square-with-dot (null otherwise);
    sizePct: the figure's width as a percentage of the grid spacing (cell figures that nearly touch: 80; a small accent: 30).
  cellAspect: a grid cell's height divided by its width as the cloth hangs (figures stacked closer than the columns are
    apart: under 1, e.g. 0.6; a square grid: 1);
  rowOffset: half when every other row is shifted by half a cell (a brick or dropped layout), none when the figures line up
    in straight columns.
  repeatsInCloseup and repeatsAcrossItem then count grid cells, measured along a row.
texture — for a texture only (null otherwise), what the weave looks like up close (read it from the close-up):
  kind: diamond (a lattice of small diamonds), herringbone, twill (fine diagonal ribs), oxford, royal-oxford, pinpoint,
    end-on-end, birdseye, honeycomb, dobby-dot (small woven dots), basket, or other;
  grid: ONE repeat of the texture as a small bitmap, top row first: each row a string of 1 and 0 of the same length, 1 where the
    cloth reads raised or catches the light, 0 where it reads as the ground, 4 to 24 cells each way (the app stretches it to
    "aspect", so the cells need not be square), and the bitmap must tile seamlessly when repeated in
    both directions, its outlines continuing across the edges (a diamond lattice's lines meet the next repeat's). Draw the
    texture as it looks, at about the scale of the thread floats you see, not a weaving draft of every thread.
    A fine twill is e.g. ["1000","0100","0010","0001"]. A herringbone or twill stripe with plain (untwilled) bands between
    its columns gives each band its own columns, the same all the way down: all 1 for a shiny satin band, all 0 for a plain one;
  aspect: one repeat's height divided by its width as the cloth hangs, measured in the close-up (diamonds half again as tall
    as they are wide: 1.5; a square repeat: 1);
  ground and raised: the two tones (a plain colour name and an sRGB hex as in "across"; for a white shirt both are whites);
  contrast: faint (only seen up close), subtle, or clear.
  repeatsInCloseup and repeatsAcrossItem then count repeats of the grid, measured along a row.
stripeDirection — which way the main lines run as the viewer sees them.
repeatsInCloseup — how many repeats of "across" fit across the close-up's width (or the item photo's, without a close-up).
repeatsAcrossItem — how many repeats of "across" fit across the item's widest part in the first photo.
paneAspect — for checks: a pane's height divided by its width as woven (1 for square panes); 1 otherwise.
ignored — a few words on what you left out as noise (e.g. "a seam down the middle, moire").
description — one or two sentences describing the pattern for a photo-realistic image generator: the ground, the lines in
  order, their colours and widths, the size of the panes, and the cloth's texture. Leave out the direction.`;
function cleanPattern(p) {
  const hex = h => (HEX_RE.test(h || '') ? h.toLowerCase() : null);
  const dir = d => { if (!d || !Array.isArray(d.bands)) return null;
    const b = d.bands.slice(0, 40).map(x => ({ role: x.role === 'line' ? 'line' : 'ground', name: txt(x.name, 30), hex: hex(x.hex), w: Math.max(0, +x.widthPct || 0) })).filter(x => x.hex && x.w > 0);
    const t = b.reduce((a, x) => a + x.w, 0); return b.length >= 2 && t > 0 ? { bands: b.map(x => ({ ...x, w: +(x.w / t).toFixed(4) })) } : null; };
  const num = (v, lo, hi, d) => Math.max(lo, Math.min(hi, +v || d));
  const col = c => c && hex(c.hex) ? { name: txt(c.name, 30), hex: hex(c.hex) } : null;
  /* a figure's bitmap: rows of 1/0 (also #/. and x/-), the same length, 3-16 each way, with some of the figure in it */
  const bitmap = b => { if (!Array.isArray(b)) return null;
    const rows = b.slice(0, 16).map(r => String(r).replace(/[^01#.xX-]/g, '').replace(/[#xX]/g, '1').replace(/[.-]/g, '0').slice(0, 16)).filter(Boolean);
    const w = Math.max(0, ...rows.map(r => r.length)), g = rows.map(r => r.padEnd(w, '0'));
    return g.length >= 2 && w >= 2 && g.join('').includes('1') ? g : null; };
  const motif = m => { if (!m || !col(m.ground) || !Array.isArray(m.figures)) return null;
    const f = m.figures.slice(0, 3).map(x => { const bm = x.shape === 'figure' ? bitmap(x.bitmap) : null;
      return { shape: MOTIF_SHAPES.includes(x.shape) && (x.shape !== 'figure' || bm) ? x.shape : 'other', placement: ['cell', 'corner', 'alternate-cells'].includes(x.placement) ? x.placement : 'cell',
        colours: (x.colours || []).map(col).filter(Boolean).slice(0, 2), centre: x.shape === 'square-with-dot' ? col(x.centre) : null, size: num(x.sizePct, 5, 100, 50) / 100,
        ...(bm ? { bitmap: bm } : {}), name: txt(x.name, 40) }; }).filter(x => x.colours.length);
    return f.length ? { grid: m.grid === 'diagonal' ? 'diagonal' : 'straight', ground: col(m.ground), figures: f, cellAspect: num(m.cellAspect, .25, 4, 1), rowOffset: m.rowOffset === 'half' ? 'half' : 'none' } : null; };
  /* the texture's bitmap: rows of 1/0 (also #/. and x/-), the same length, 2-24 each way, with both tones in it */
  const texture = t => { if (!t || !Array.isArray(t.grid) || !col(t.ground)) return null;
    const rows = t.grid.slice(0, 24).map(r => String(r).replace(/[^01#.xX-]/g, '').replace(/[#xX]/g, '1').replace(/[.-]/g, '0').slice(0, 24)).filter(Boolean);
    const w = Math.max(0, ...rows.map(r => r.length)), g = rows.map(r => r.padEnd(w, '0')), all = g.join('');
    if (g.length < 2 || w < 2 || !all.includes('1') || !all.includes('0')) return null;
    return { kind: TEXTURE_KINDS.includes(t.kind) ? t.kind : 'other', grid: g, aspect: num(t.aspect, .25, 4, g.length / w), ground: col(t.ground), raised: col(t.raised) || col(t.ground), contrast: ['faint', 'subtle', 'clear'].includes(t.contrast) ? t.contrast : 'subtle' }; };
  const flat = p.layout === 'motif' || p.layout === 'texture';
  return { layout: p.layout, across: flat ? null : dir(p.across), along: flat ? null : dir(p.along), motif: p.layout === 'motif' ? motif(p.motif) : null, texture: p.layout === 'texture' ? texture(p.texture) : null, stripeDirection: p.stripeDirection,
    repeatsInCloseup: num(p.repeatsInCloseup, .2, 60, 1), repeatsAcrossItem: num(p.repeatsAcrossItem, .2, 80, 1), paneAspect: num(p.paneAspect, .3, 3, 1),
    ignored: txt(p.ignored, 200), description: txt(p.description, 600) };
}
async function handlePattern(req, env, json, who) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ai', detail: 'Reading a pattern needs Claude: add an ANTHROPIC_API_KEY secret to the worker.' }, 501);
  const text = await req.text();
  if (text.length > 20e6) return json({ error: 'photos too large' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  const cm = String(body.closeup || '').match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
  const kind = TYPE_LIST.includes(body.type) ? `The item is a ${body.type === 'pants' ? 'pair of dress trousers' : body.type}. ` : '';
  const over = await spend(env, who, 'pattern'); if (over) return json(over.body, over.status);
  const c = await tagWithClaude(env, String(body.image || ''), { schema: PATTERN_SCHEMA, prompt: PATTERN_PROMPT, text: kind, closeup: cm, wb: wbOf(body), effort: 'high', maxTokens: 16000 });
  if (c.status !== 200) { await unspend(env, who, 'pattern'); return json(c.body, c.status); }
  const out = cleanPattern(c.body);
  if (!out.across && !out.motif && !out.texture) return json({ error: 'no pattern', detail: 'Claude found no repeating pattern.', layout: out.layout }, 422);
  return json({ ...out, model: c.body.model });
}

export { handlePattern };
