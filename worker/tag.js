/* Daily Wardrobe worker: tagging a photo: the prompt and the JSON schema Claude answers in, the per-request additions (custom colours, corrections,
   the measurement), POST / (tagWithClaude), POST /tag-many, and the Workers AI fallback.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { spend, unspend } from './people.js';

/* colours each item type really comes in: [main colours, stripe / motif colours]. Must match COLS_BY in core.js. */
const SUITING = ['black','charcoal','darkgrey','grey','midgrey','lightgrey','navy','darknavy','deepblue','blue','steelblue','slate','brown','deeptaupe','taupe','tan','khaki','olive','green'],
  SUIT_LINES = ['white','cream','lightgrey','grey','midgrey','charcoal','black','lightblue','blue','navy','deepblue','burgundy','red','rust','brown','tan','green','olive','gold'],
  LEATHER_COLS = ['black','brown','tan','oxblood','burgundy','navy','grey','taupe'];
const TYPE_COLORS = {
  suit: [[...SUITING,'cream'], SUIT_LINES],
  blazer: [[...SUITING,'cream','burgundy','wine','rust'], SUIT_LINES],
  pants: [[...SUITING,'cream','lightblue','stone','denim'], SUIT_LINES],
  shirt: [['white','ivory','cream','paleyellow','beige','pink','lavender','periwinkle','mint','lightblue','blue','steelblue','lightgrey','midgrey','grey','slate','charcoal','navy','darknavy','black','burgundy'],
    ['white','navy','darknavy','blue','lightblue','steelblue','red','burgundy','pink','lavender','purple','grey','lightgrey','charcoal','black','green','mint','brown','gold']],
  tie: [['navy','darknavy','deepblue','blue','steelblue','lightblue','slate','black','charcoal','grey','silver','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust','cream'],
    ['white','cream','silver','lightgrey','grey','charcoal','black','navy','deepblue','blue','lightblue','steelblue','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust']],
  tieclip: [['silver','gold','rosegold','gunmetal','grey','black','white','red','blue','navy'], ['black','white','silver','gold','navy','red','blue']],
  cufflinks: [['silver','gold','grey','black','white','navy','blue','lightblue','burgundy','red','green','purple'], ['silver','gold','black','white','navy','blue','burgundy','red','green']],
  watch: [['black','brown','tan','oxblood','navy','grey','green','silver','gold'], ['black','brown','white','grey','navy']],
  shoes: [[...LEATHER_COLS,'white','cream'], ['black','brown','tan','white','navy','cream','grey']],   // white/cream: sneakers; second colour: a sneaker's sole
  belt: [LEATHER_COLS, ['black','brown','tan','navy']],
  socks: [['black','charcoal','darkgrey','grey','midgrey','navy','darknavy','deepblue','blue','steelblue','slate','brown','taupe','tan','khaki','olive','green','burgundy','wine','red','rust','purple','pink','gold'],
    ['white','cream','lightgrey','grey','charcoal','black','navy','blue','lightblue','burgundy','red','rust','pink','purple','lavender','green','olive','gold','brown','tan']],
  overcoat: [['black','charcoal','darkgrey','grey','midgrey','navy','darknavy','brown','tan','taupe','olive'], ['black','charcoal','grey','navy','brown','tan','burgundy','green']],
  raincoat: [['khaki','tan','taupe','navy','darknavy','black','charcoal','grey','olive'], ['black','navy','tan','khaki','burgundy','brown']],
};
const DIAL_COLS = ['white','cream','silver','lightgrey','grey','slate','charcoal','black','navy','deepblue','blue','lightblue','green','olive','brown','burgundy','gold'];
const TYPE_COLOR_TEXT = Object.entries(TYPE_COLORS).map(([t, [p, a]]) => `  ${t}: ${p.join(', ')} | ${a.join(', ')}`).join('\n')
  + `\n  watch dial: ${DIAL_COLS.join(', ')}`;
const PROMPT = `Identify the single clothing item in this photo. Reply with one JSON object only, no prose, no code fences:
{"type":"...","primaryColor":"...","secondaryColor":"...","tertiaryColor":"...","pattern":"...","metal":"...","trouserKind":"...","shoeStyle":"...","leather":"...","dial":"...","band":"...","bezel":"..."}

type — one of:
  suit (suit jacket, or a jacket and trousers of the same cloth), blazer (odd jacket / sport coat), pants (dress trousers),
  shirt (dress shirt), tie, tieclip, watch, shoes, belt, socks, cufflinks, overcoat (wool topcoat), raincoat (trench or mac)

primaryColor — the dominant color of the main fabric (the leather for shoes and belts, the strap or bracelet for watches, the metal
  for tie clips). Use only a color from the item type's own list (main colors, before the |):
${TYPE_COLOR_TEXT}
  (charcoal is near-black gray; darkgrey sits between charcoal and grey; midgrey is a medium gray, between grey and lightgrey;
  lightgrey is pale gray; steelblue is a dusty, grayed mid blue (denim-like); deepblue is a rich, saturated dark blue, brighter
  than navy; darknavy is navy so dark it is almost black; slate is a dark blue-gray, grayer than navy and bluer than charcoal;
  wine is a red-leaning burgundy; oxblood is a deep brownish red, the color of cordovan "color 8" shoes, darker and browner
  than burgundy; khaki is the light sandy beige of classic chinos and cotton dress trousers, lighter and greener than tan,
  which is a warmer, deeper camel brown; stone is the pale gray-beige of stone chinos, grayer and lighter than khaki;
  denim is the indigo blue of jeans (trousers only; a faded light-blue pair is lightblue);
  taupe is a grayish brown, between grey and tan;
  deeptaupe is a dark taupe, a deep grayish brown, darker and grayer than brown and much darker than taupe (a mink or
    espresso-gray suit whose brown is so muted it reads almost gray is deeptaupe, not brown; brown is a clearly warm, colored brown); rust is a burnt orange-brown;
  ivory is a warm off-white, between white and cream; beige is a pale sandy tan; mint is a pale green; periwinkle is a soft
  blue with a violet cast, between lightblue and blue; grey for cufflinks means gunmetal; a tie clip's color is its finish: silver, gold, rosegold, gunmetal, or an enamel color)

secondaryColor — the color of the stripe, check line, dot or motif, from the type's line colors (after the |). "none" if plain.
  Socks: the color of a contrasting toe cap (the knitted tip over the toes, often a light heather gray on a dark sock), or "none"
  if the toe is the same color as the rest of the sock. A small logo or a heel in the same color as the sock does not count.
tertiaryColor — a third distinct color in the pattern (e.g. the second line color of a tattersall), from the same, or "none".

pattern — pick the closest value from the list for the item's type:
  suit, blazer, pants:
    solid        plain cloth with no visible pattern
    pinstripe    very thin, crisp, evenly spaced lines (about 1 cm apart)
    chalk-stripe soft, fuzzy, wider lines spaced further apart than pinstripe
    herringbone  columns of small V / zigzag shapes in the weave
    birdseye     tiny repeating dots with a light center, like a bird's eye
    nailhead     tiny pinpoint dots in an even grid
    sharkskin    fine two-tone diagonal weave with a slight sheen
    houndstooth  small broken, jagged, four-pointed checks
    glen-check   Prince of Wales: blocks of small check alternating with larger check, often with a colored overcheck
    windowpane   thin lines forming large squares on a plain ground
    tweed        rough, flecked, multi-tone wool
    twill        plain color with a visible diagonal rib
    other
  shirt:
    solid (smooth poplin or broadcloth), stripe (bold or bengal stripe), pinstripe (thin lines), fine-stripe (hairline stripes, very
    close together, reads almost solid), gingham (even two-color checks), tattersall (thin lines of two alternating colors forming
    checks), check (any other check or plaid), houndstooth (tiny broken checks), herringbone, oxford (basket-weave texture),
    pinpoint (very fine oxford weave), royal-oxford (pronounced, shiny basket weave), twill (fine diagonal rib), end-on-end
    (fil-a-fil: white and colored threads alternate, a fine heathered two-tone look), chambray (colored warp with white weft,
    slightly faded look), dobby (small repeating woven motif, tone on tone), woven (visible small cross-weave), textured (uneven,
    slubbed surface), fine-texture (barely visible texture up close), other
  tie:
    solid, woven (a textured solid: a fine basket/oxford weave or micro-check that reads as one color from a step away, often two-tone
    threads; put the second thread color in secondaryColor), stripe (diagonal/regimental), polka-dot, paisley, check (a visible check),
    tonal-check (a check or glen check woven in two close shades of one color,
    e.g. black on charcoal: subtle, but clearly not a solid; put the lighter shade in secondaryColor), foulard (small repeating geometric motif), knit, other
  tieclip, watch, shoes, belt, socks, cufflinks, overcoat, raincoat: solid

Use "solid" for suits, blazers and trousers whose weave is only visible up close and does not match a listed pattern.

metal — for watch, cufflinks and belt (the buckle; a tie clip has none: its color says it): gold, silver or other (the case and bracelet metal for watches). Otherwise null.

trouserKind — trousers (pants) only, otherwise null: dress (pressed wool or cotton dress trousers with a crease), chinos (casual
  cotton twill trousers, no crease, often with patch or slanted pockets), jeans (denim with rivets and five pockets).

shoeStyle — shoes only, otherwise null: oxford (closed lacing, often a cap toe), derby (open lacing, the quarters sewn on top),
  loafer (no laces: penny, tassel, horsebit), boot (above the ankle: chelsea, chukka, dress boot), sneaker (trainers, any sport or
  minimal leather sneaker).

leather — shoes and belts: calf (smooth, moderate shine), cordovan (dense, deep glossy shine with rolling creases), suede (matte napped),
  patent (mirror gloss), pebble-grain (large tumbled grain), scotch-grain (fine embossed grain); sneakers may also be canvas (woven
  cotton) or knit (a knitted textile upper); a smooth leather sneaker is calf. Otherwise null.

dial, band, bezel — watches only, otherwise null:
  dial: the dial color, from the watch dial list above.
  band: bracelet (metal links) or leather (strap).
  bezel: fluted (finely ridged ring around the crystal) or smooth.`;

const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
/* the field rules alone (from "type —"): Claude answers through structured output, so it gets no JSON template or "no code
   fences" line (those are for Workers AI, which reads PROMPT whole) */
const TAG_RULES = PROMPT.slice(PROMPT.indexOf('type —'));
const TAG_INTRO = 'Identify the single clothing item in the first photo.\n\n';
/* how to read the photos' colours, by the app's wb flag: true = it white-balanced them from a white reference, false = sent as the
   camera took them, absent (an older app) = not known. "Photos are white-balanced" in the system prompt and "judge as in daylight"
   in the rules said both at once (2026-11-13 audit) */
function lightText(wb) {
  if (wb === true) return 'The app white-balanced these photos from a white reference in the frame: take their colors as shown and do not shift them for warm or cool light; only allow for shadows, sheen and folds.';
  if (wb === false) return 'These photos are as the camera took them (the app found no white reference, so it did not correct them): judge the colors as they would look in neutral daylight, allowing for the light\'s cast (warm indoor light makes white look ivory and gray look beige) as well as for shadows, sheen and folds.';
  return 'These photos may or may not have been white-balanced. Judge the colors as they would look in neutral daylight: allow for a warm or cool cast only where the photo clearly has one (whites and grays look tinted), and for shadows, sheen and folds.';
}
const wbOf = body => (body && typeof body.wb === 'boolean' ? body.wb : undefined);

/* ---- Claude API ---- */
const CLAUDE_DEFAULT = 'claude-opus-5-5';
const COLOR_LIST = ['black','charcoal','darkgrey','grey','midgrey','lightgrey','white','cream','lightblue','blue','steelblue','deepblue','navy','darknavy','slate',
  'brown','tan','khaki','taupe','deeptaupe','rust','olive','green','burgundy','wine','oxblood','red','purple','pink','gold','silver','rosegold','gunmetal',
  'paleyellow','ivory','beige','lavender','periwinkle','mint','stone','denim'];   // per-type lists: TYPE_COLORS
const TYPE_LIST = ['suit','blazer','pants','shirt','tie','tieclip','watch','shoes','belt','socks','cufflinks','overcoat','raincoat'];
const PATTERN_LIST = ['solid','pinstripe','chalk-stripe','herringbone','birdseye','nailhead','sharkskin','houndstooth','glen-check','windowpane','tweed','twill',
  'stripe','gingham','tattersall','check','oxford','polka-dot','paisley','foulard','knit','other',
  'fine-stripe','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture','tonal-check'];
/* each colour key's sRGB hex: must match COLORS in core.js (tests/colouraudit.test.js); worker/describe.js tells Claude the shades */
const COLOR_HEX = { black: '#16161a', charcoal: '#3b3f46', darkgrey: '#5e6269', grey: '#8b8f96', midgrey: '#a2a4a8', lightgrey: '#babdc2', white: '#f6f6f3',
  cream: '#efe4c8', lightblue: '#a9c7e4', blue: '#3f6fb5', steelblue: '#56657f', deepblue: '#26326a', navy: '#1b2a4a', darknavy: '#1c1f2b', slate: '#3a3f4c',
  brown: '#5a3a22', tan: '#b8946a', khaki: '#c3b091', taupe: '#8b7d6b', deeptaupe: '#5f5449', rust: '#a4502a', olive: '#5b5d36', green: '#2f6b4a',
  burgundy: '#6d1f2c', wine: '#7d2438', oxblood: '#4a1a1e', red: '#b3262e', purple: '#5d3a7a', pink: '#e3a5b4', gold: '#c9a227', silver: '#c3c6cb',
  rosegold: '#c98f7a', gunmetal: '#55595f', paleyellow: '#f1e6ac', ivory: '#f4efde', beige: '#dccbb0', lavender: '#c9bfe2', periwinkle: '#9ea8d4',
  mint: '#cfe6d4', stone: '#cbbfa3', denim: '#3e5c86' };
/* the patterns each item type offers: must match PATS_BY in core.js (tests/colouraudit.test.js) */
const SUIT_PATS = ['solid','pinstripe','chalk-stripe','herringbone','birdseye','nailhead','sharkskin','houndstooth','glen-check','windowpane','tweed','twill','other'];
const PATTERN_BY_TYPE = { suit: SUIT_PATS, blazer: SUIT_PATS, pants: SUIT_PATS,
  shirt: ['solid','stripe','pinstripe','fine-stripe','gingham','tattersall','check','houndstooth','herringbone','oxford','pinpoint','royal-oxford','twill','end-on-end','chambray','dobby','woven','textured','fine-texture','other'],
  tie: ['solid','woven','stripe','polka-dot','paisley','check','tonal-check','foulard','knit','other'] };
/* what each item type is made of: must match MATERIALS_BY in core.js (tests/materials.test.js) */
const MATERIALS_BY = {
  suit: ['wool','wool blend','tropical wool','flannel','tweed','linen','linen blend','cotton','seersucker','cashmere','mohair blend','silk blend','moleskin','corduroy','velvet','polyester blend'],
  blazer: ['wool','wool blend','tropical wool','flannel','tweed','linen','linen blend','cotton','seersucker','cashmere','camel hair','hopsack','silk blend','jersey','corduroy','velvet','polyester blend'],
  pants: ['wool','wool blend','tropical wool','flannel','gabardine','cotton','cotton twill','denim','stretch denim','linen','linen blend','seersucker','moleskin','corduroy','tweed','polyester blend'],
  shirt: ['cotton','poplin','linen','linen blend','flannel','cotton blend','performance stretch','seersucker'],
  tie: ['silk','grenadine','shantung','wool','wool blend','cashmere','linen','cotton','polyester'],
  socks: ['cotton','mercerized cotton','merino wool','wool blend','cashmere blend','bamboo','silk blend','synthetic blend'],
  overcoat: ['wool','wool blend','melton','cashmere','cashmere blend','tweed','camel hair','loden','alpaca','cotton'],
  raincoat: ['cotton gabardine','waxed cotton','rubberized cotton','nylon','polyester','waterproof shell'] };
/* how well Claude can tell a material from a photo (the materials audit's tiers, 2026-11-15): a cloth plain to see may be high; a good
   bet from the look medium at most, and low without a close-up; a fiber the eye can't tell (wool vs blends, cashmere, cotton vs a
   blend, polyester) low at most; socks always low. The cleaner holds every answer to its tier, whatever Claude said */
const MAT_SEES = ['linen','seersucker','corduroy','velvet','tweed','flannel','denim','stretch denim','jersey','grenadine','knitted silk','waxed cotton','hopsack'];
const MAT_LIKELY = ['tropical wool','gabardine','cotton gabardine','mohair blend','silk blend','camel hair','melton','moleskin','cotton','cotton twill','poplin','performance stretch','linen blend','shantung','rubberized cotton','loden'];
const MAT_LIKELY_BY = { tie: ['silk','wool','cashmere','cotton'] };
const CONF_RANK = { low: 0, medium: 1, high: 2 }, CONF_NAME = ['low', 'medium', 'high'];
const matCap = (key, type, closeup) => type === 'socks' ? 0 : MAT_SEES.includes(key) ? 2 : (MAT_LIKELY.includes(key) || (MAT_LIKELY_BY[type] || []).includes(key)) ? (closeup ? 1 : 0) : 0;
/* Claude's material answer -> {key, confidence, why} (key one of the type's materials or 'none'), or null when the type has no list or
   there is no answer. A key off the list, or one that only repeats the pattern (an end-on-end shirt "made of" end-on-end), is 'none' */
function cleanMaterial(m, type, pats, closeup) {
  const list = MATERIALS_BY[type];
  if (!list || !m || typeof m !== 'object') return null;
  const why = String(m.why ?? '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  let key = String(m.key ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const same = (Array.isArray(pats) ? pats : [pats]).filter(Boolean).map(p => String(p).toLowerCase().replace(/-/g, ' '));
  if (!list.includes(key) || same.includes(key)) key = 'none';
  if (key === 'none') return { key, confidence: 'low', why };
  const asked = CONF_RANK[m.confidence] ?? 0;
  return { key, confidence: CONF_NAME[Math.min(asked, matCap(key, type, !!closeup))], why };
}
/* the material's rules for Claude (the photo tagger's single item and the close-up reader's pattern half) */
const MATERIAL_RULES = `material — what the item is made of, from its type's material list below, or "none":
  key: one material from the list for the item's type, or "none". "none" is always allowed, and it is the right answer when no listed
    material clearly fits or you cannot tell: never force the nearest one.
  confidence:
    high only for a cloth that is plain to see: linen (slubs, sharp creases), seersucker (puckered stripes), corduroy (wale ribs),
      velvet (pile sheen), tweed, flannel (fuzzy nap, blurred weave), denim, jersey (knit loops), grenadine (open gauze), waxed cotton,
      hopsack (basket weave);
    medium at most for a good bet from the look, and only with a close-up: tropical wool (open, grainy weave), gabardine, mohair (dry,
      glassy sheen), silk blend (sheen, slubs), camel hair, melton (smooth felted face), moleskin, cotton, poplin, a silk tie,
      performance stretch (sheen, cling);
    low for a fiber the eye cannot tell: wool vs wool blend vs polyester blend, cashmere vs wool, cotton vs cotton blend, every sock
      fiber, mercerized cotton, alpaca. Without a close-up, any fiber is low.
  Never give the pattern or weave as the material: a herringbone, twill, oxford, pinpoint, end-on-end, chambray or dobby look is the
    pattern; the material is the fiber or cloth it is woven in.
  why: one short line for the owner on what you saw.
  Materials per type:
${Object.entries(MATERIALS_BY).map(([t, l]) => `    ${t}: ${l.join(', ')}`).join('\n')}`;
/* the schema's part: key a plain string for the tagger (one schema for every type: an enum of every type's materials would grow the
   grammar), the type's own list for the reader (its type is known) */
const materialSchema = list => ({ type: 'object', additionalProperties: false, required: ['key', 'confidence', 'why'],
  properties: { key: list ? { type: 'string', enum: [...list, 'none'] } : { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, why: { type: 'string' } } });
const orNull = values => ({ anyOf: [{ type: 'string', enum: values }, { type: 'null' }] });
// Structured output: the reply is guaranteed to be JSON matching this schema.
const TAG_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['type','primaryColor','secondaryColor','tertiaryColor','pattern','metal','leather','dial','band','bezel','trouserKind','shoeStyle'],
  properties: {
    type: { type: 'string', enum: TYPE_LIST },
    primaryColor: { type: 'string', enum: COLOR_LIST },
    secondaryColor: { type: 'string', enum: [...COLOR_LIST, 'none'] },
    tertiaryColor: { type: 'string', enum: [...COLOR_LIST, 'none'] },
    pattern: { type: 'string', enum: PATTERN_LIST },
    metal: orNull(['gold','silver','other']),
    leather: orNull(['calf','cordovan','suede','patent','pebble-grain','scotch-grain','canvas','knit']),
    trouserKind: orNull(['dress','chinos','jeans']),
    shoeStyle: orNull(['oxford','derby','loafer','boot','sneaker']),
    dial: orNull(DIAL_COLS),
    band: orNull(['bracelet','leather']),
    bezel: orNull(['fluted','smooth']),
  },
};
/* ---- per-request additions to the tagger ----
   custom: colours and patterns the owner added in the app ({colors:[{key,name,hex,base,types,accent}], patterns:[{key,name,types,base,desc}]})
   extend the enums and the prompt; a single-item tag also asks for confidence, a runner-up, a suggested new colour or pattern
   when nothing listed fits, and a box on plain cloth (the app measures the colour there). */
const KEY_RE = /^own[a-z]{1,28}$/, PKEY_RE = /^own-[a-z0-9-]{1,28}$/, HEX_RE = /^#[0-9a-f]{6}$/i;
const txt = (v, n) => String(v ?? '').replace(/[^\w ,.;:'()\/&-]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
function cleanCustom(c) {
  c = c && typeof c === 'object' ? c : {};
  const types = t => (Array.isArray(t) ? t : []).filter(x => TYPE_LIST.includes(x));
  const colors = (Array.isArray(c.colors) ? c.colors : []).filter(x => x && KEY_RE.test(x.key) && HEX_RE.test(x.hex)).slice(0, 40)
    .map(x => ({ key: x.key, name: txt(x.name, 30) || x.key.slice(3), hex: x.hex.toLowerCase(), types: types(x.types), accent: !!x.accent }));
  const patterns = (Array.isArray(c.patterns) ? c.patterns : []).filter(x => x && PKEY_RE.test(x.key)).slice(0, 40)
    .map(x => ({ key: x.key, name: txt(x.name, 30) || x.key.slice(4), types: types(x.types), desc: txt(x.desc, 160) }));
  return { colors, patterns };
}
const CONF = { type: 'string', enum: ['high', 'medium', 'low'] };
const SUGGEST = { anyOf: [{ type: 'object', additionalProperties: false, required: ['name', 'why'],
  properties: { name: { type: 'string' }, why: { type: 'string' } } }, { type: 'null' }] };
const BOX = { type: 'object', additionalProperties: false, required: ['x', 'y', 'w', 'h'],
  properties: { x: { type: 'integer' }, y: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' } } };
/* a striped, checked or plaid cloth in words and colours: for the photo generator, the drawing's scale and direction, and as
   the drawing's colours when the app can't read them from the photo */
const WEAVE = { type: 'object', additionalProperties: false, required: ['layout', 'direction', 'repeatsAcross', 'colours', 'crossing', 'description'],
  properties: {
    layout: { type: 'string', enum: ['stripes', 'stripes-with-crossing-lines', 'check', 'plaid', 'other'] },
    direction: { type: 'string', enum: ['upper-left to lower-right', 'lower-left to upper-right', 'vertical', 'horizontal'] },
    repeatsAcross: { type: 'number' },
    colours: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'hex', 'width'],
      properties: { name: { type: 'string' }, hex: { type: 'string' }, width: { type: 'string', enum: ['hairline', 'narrow', 'medium', 'wide'] } } } },
    crossing: { type: 'string' },
    description: { type: 'string' },
  } };
/* freeColors (the app's colour picker, "Ask Claude"): Claude's own reading of each colour, not limited to the list */
const FREE_COL = { type: 'object', additionalProperties: false, required: ['name', 'hex'], properties: { name: { type: 'string' }, hex: { type: 'string' } } };
const OWN_COLORS = { type: 'object', additionalProperties: false, required: ['primary', 'secondary', 'tertiary'],
  properties: { primary: FREE_COL, secondary: { anyOf: [FREE_COL, { type: 'null' }] }, tertiary: { anyOf: [FREE_COL, { type: 'null' }] } } };
const FREE_EXTRA = `
ownColors — your own reading of each color as you actually see it, NOT limited to the lists above: for primary, secondary and
  tertiary (the same roles as primaryColor, secondaryColor, tertiaryColor; null where those are "none"), a short color name a
  tailor would use (e.g. "mushroom", "bottle green", "ink navy"; plain lower-case words) and its sRGB hex as the cloth looks in
  even daylight, judged mainly from the close-up. If a listed color is truly right, you may give its name.`;
/* freePattern (the app's pattern picker, "Ask Claude"): Claude's own name for the pattern or weave, not limited to the list */
const OWN_PATTERN = { type: 'object', additionalProperties: false, required: ['name', 'description', 'fits'],
  properties: { name: { type: 'string' }, description: { type: 'string' }, fits: { type: 'boolean' } } };
const FREE_PAT_EXTRA = `
ownPattern — the pattern or weave in your own precise words, NOT limited to the list above, judged mainly from the close-up:
  name: what a tailor or cloth merchant would call it, short and lower-case (e.g. "broken twill", "shepherd's check",
  "prince of wales check with overcheck", "basketweave", "micro houndstooth", "twill with a faint windowpane");
  description: one sentence on how it looks (structure, scale, colors, how strong), for drawing it and for a photo generator;
  fits: true only when the listed pattern you put in "pattern" already names it fully, false when your name says more.`;
function tagSchema(custom, single, free, freePat) {
  const cols = [...COLOR_LIST, ...custom.colors.map(c => c.key)], pats = [...PATTERN_LIST, ...custom.patterns.map(p => p.key)];
  const props = { ...TAG_SCHEMA.properties,
    primaryColor: { type: 'string', enum: cols }, secondaryColor: { type: 'string', enum: [...cols, 'none'] },
    tertiaryColor: { type: 'string', enum: [...cols, 'none'] }, pattern: { type: 'string', enum: pats } };
  if (!single) return { ...TAG_SCHEMA, properties: props };
  Object.assign(props, {
    confidence: { type: 'object', additionalProperties: false, required: ['type', 'primaryColor', 'pattern'], properties: { type: CONF, primaryColor: CONF, pattern: CONF } },
    altColor: { type: 'string', enum: [...cols, 'none'] }, altPattern: { type: 'string', enum: [...pats, 'none'] },
    newColor: SUGGEST, newPattern: SUGGEST, clothBox: { anyOf: [BOX, { type: 'null' }] },
    patternBox: { anyOf: [BOX, { type: 'null' }] }, weave: { anyOf: [WEAVE, { type: 'null' }] },
  });
  if (free) props.ownColors = OWN_COLORS;
  if (freePat) props.ownPattern = OWN_PATTERN;
  // the material (2026-11-15, the Add card's suggestion): only on the plain single tag, never with the picker's extras (the schema
  // with ownColors is near what the API compiles)
  const mat = !free && !freePat;
  if (mat) props.material = materialSchema(null);
  return { ...TAG_SCHEMA, properties: props, required: [...TAG_SCHEMA.required, 'confidence', 'altColor', 'altPattern', 'newColor', 'newPattern', 'clothBox', 'patternBox', 'weave', ...(free ? ['ownColors'] : []), ...(freePat ? ['ownPattern'] : []), ...(mat ? ['material'] : [])] };
}
/* the single tag's material rules, in the cached prompt after SINGLE_EXTRA (a tag with the picker's extras has no material) */
const MATERIAL_EXTRA = `
${MATERIAL_RULES}
  (For shoes, belts, watches, cufflinks and tie clips the material is always "none": their leather, band and metal have their own fields.)`;
function customText(custom) {
  let t = '';
  if (custom.colors.length) t += `\n\nColors the owner added (answer with the key, like any listed color, for the item types shown):\n`
    + custom.colors.map(c => `  ${c.key} = ${c.name} (${c.hex}), for ${c.types.join(', ') || 'any type'}${c.accent ? ', also as a stripe or motif color' : ''}`).join('\n');
  if (custom.patterns.length) t += `\n\nPatterns the owner added (answer with the key, for the item types shown):\n`
    + custom.patterns.map(p => `  ${p.key} = ${p.name}: ${p.desc || 'no description'} (${p.types.join(', ') || 'any type'})`).join('\n');
  return t;
}
const SINGLE_EXTRA = `

Also give:
confidence — for type, primaryColor and pattern: high (clearly visible), medium, or low (guessing).
altColor, altPattern — your second choice for the main color and the pattern, or "none" if nothing else is plausible.
newColor — when NONE of the colors allowed for this type (the owner's included) is a good match for the main color, give
  {"name": a short common name for the real color, "why": one line on how it differs from the closest listed one}; otherwise null.
  Still put the closest allowed color in primaryColor.
newPattern — the same for the pattern or weave: when no listed pattern fits (you would answer "other"), give {"name", "why": one
  line describing how it looks}; otherwise null. Still put the closest listed pattern in pattern.
clothBox — a rectangle on a plain, evenly lit area of the main cloth in the FIRST photo (no folds, shadows, buttons, labels,
  lining or background), in thousandths of that photo (x, y = top-left corner, w, h = size, all 0-1000), so the app can measure
  its color; null if there is no such area.
patternBox — for a striped, checked or plaid item, or one with a small figure repeated all over (a neat or foulard, dots): the largest rectangle of the FIRST photo that lies entirely on the patterned
  cloth (no background, knot, collar or edges; on a jacket the front panel beside the buttons, clear of lapels and pockets; on a
  shirt the body, clear of the collar and placket), in thousandths like clothBox, so the app can read the pattern's colors; null otherwise.
weave — for a striped, checked or plaid item (null for solids and fine weaves): its pattern as precisely as you can, from the
  close-up when there is one:
  layout: stripes, stripes-with-crossing-lines (stripes with finer lines running the other way), check, plaid, or other;
  direction: which way the main stripes run in the photo, as the viewer sees them (look carefully: follow one stripe from where it
    enters the tie to where it leaves);
  repeatsAcross: how many times the whole color sequence repeats across the item's widest part (0.5 if one repeat is twice as wide;
    for a pinstripe or chalk-stripe jacket, the number of stripes across its front, often 20 to 40);
  colours: one full repeat of the stripe sequence in order, each band with a plain name, an sRGB hex as seen, and its width
    (a pinstripe suit: the ground, then the stripe as a hairline; a gingham: the two colors);
  crossing: the lines that run the other way (colors, how fine, how far apart), or "" if none;
  description: one or two sentences describing the pattern for a photo-realistic image generator: the order and colors of the
  bands, which color dominates, their widths, the crossing lines, and the cloth's sheen or weave. Leave out the direction (the app
  measures it).`;
/* what the app measured (Lab after white balance), to weigh against what is seen */
function measuredText(m) {
  if (!m || !Array.isArray(m.lab) || m.lab.length !== 3) return '';
  const lab = m.lab.map(v => Math.round(+v || 0)), near = (Array.isArray(m.near) ? m.near : []).slice(0, 3)
    .filter(n => n && /^[a-z]{2,32}$/.test(n.c)).map(n => `${n.c} (ΔE ${(+n.d || 0).toFixed(1)})`);
  return `\n\nThe app measured the cloth's color ${m.src === 'closeup' ? 'in the close-up' : 'in the photo'} after white balance: CIELAB L*${lab[0]} a*${lab[1]} b*${lab[2]}`
    + (HEX_RE.test(m.hex || '') ? ` (${m.hex})` : '') + (near.length ? `; nearest of the owner's colors: ${near.join(', ')}` : '') + '. '
    + (m.ref ? 'A white reference was in the frame, so its lightness is reliable.' : 'There was no white reference, so its lightness may be off by the camera\'s exposure; hue and saturation are more reliable.')
    + ' Use it together with what you see.'
    + (near.length ? ' How colorful a cloth is (its a* and b*) is hard to judge by eye, and a muted color easily passes for its more saturated neighbor, so weigh the measured hue and saturation. If you choose a primaryColor other than the nearest measured one, give the nearest measured one as altColor.' : '');
}
/* the owner's earlier corrections of the tagger (AI said -> owner chose), to lean the same way */
const FIX_FIELDS = ['type', 'primaryColor', 'secondaryColor', 'pattern'];
function correctionsText(list) {
  const l = (Array.isArray(list) ? list : []).filter(f => f && FIX_FIELDS.includes(f.field) && TYPE_LIST.includes(f.type)
    && /^[a-z][a-z0-9-]{0,31}$/.test(f.from || '') && /^[a-z][a-z0-9-]{0,31}$/.test(f.to || '') && f.from !== f.to).slice(-20);
  return l.length ? `\n\nThe owner corrected these tags on earlier items (you said -> owner chose); lean the same way on similar items:\n`
    + l.map(f => `  ${f.type} ${f.field}: ${f.from} -> ${f.to}`).join('\n') : '';
}

const CLAUDE_SYSTEM = 'You are a menswear expert who labels clothing photos for a wardrobe app.\nWrite every word the owner reads (name, why, ask, hints) in American English.';
/* each call to Claude: at most 3 minutes an attempt; one retry after 2 s, or the API's retry-after up to 20 s */
const CLAUDE_MS = 180000, CLAUDE_RETRY_MS = 2000, CLAUDE_RETRY_MAX = 20000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CLIENT_GONE = { status: 499, body: { error: 'gone', detail: 'The app closed before the answer came.' } };
async function tagWithClaude(env, image, opts = {}) {
  const m = image.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
  if (!m) return { status: 400, body: { error: 'no image' } };
  /* The order is the cache's: the system prompt holds the fixed instructions (opts.prompt, the same for every call of a kind) with
     the first cache point, then the owner's colours, patterns and corrections (opts.owner, the same from call to call) with the
     second; the photos and what changes with each call (opts.text: the close-up note, the light, the measurement) come last.
     The fixed text used to follow the photos, so nothing could be cached. A prefix under the model's minimum is simply not cached */
  return claudeCall(env, { ...opts, model: env.CLAUDE_MODEL || CLAUDE_DEFAULT, system: CLAUDE_SYSTEM + '\n\n' + (opts.prompt || TAG_INTRO + TAG_RULES),
    schema: opts.schema || TAG_SCHEMA, content: [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      ...(opts.closeup ? [{ type: 'image', source: { type: 'base64', media_type: opts.closeup[1], data: opts.closeup[2] } }] : []),
      { type: 'text', text: [opts.closeup ? 'The first photo is the whole item. The second is a close-up of its cloth: use it for the weave, the pattern and the exact color.' : '', lightText(opts.wb), (opts.text || '').trim()].filter(Boolean).join('\n\n') },
    ] });
}
/* one call to Claude (tagWithClaude's photos, worker/describe.js's words): opts {model, system (the fixed text, first cache point),
   owner (the owner's own lists, second cache point), content (the user message's blocks: what changes per call), schema, effort,
   maxTokens, signal, what (the log's word)} -> {status, body}; the headers, refusal fallback, retry, time limit, stop reasons, token log */
async function claudeCall(env, opts) {
  const model = opts.model || CLAUDE_DEFAULT;
  const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
  const cached = t => ({ type: 'text', text: t, cache_control: { type: 'ephemeral' } });
  const body = {
    model,
    max_tokens: opts.maxTokens || 4000,    // thinking counts toward this; a single item's JSON is ~100 tokens
    output_config: { effort: opts.effort || 'low', format: { type: 'json_schema', schema: opts.schema } },
    system: [cached(opts.system), ...(opts.owner && opts.owner.trim() ? [cached(opts.owner.trim())] : [])],
    messages: [{ role: 'user', content: opts.content }],
  };
  // If a safety classifier declines (very unlikely for clothing photos), let the API retry on its recommended model.
  if (/opus|fable|sonnet-5-5/.test(model)) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
  const sent = JSON.stringify(body), pause = env.CLAUDE_RETRY_MS != null ? +env.CLAUDE_RETRY_MS || 0 : CLAUDE_RETRY_MS;   // (tests set it to 0)
  let r, out;
  // one automatic retry on an overloaded or failing API (429, 529, 5xx, a dropped connection), after its retry-after or a short
  // pause; every attempt has a time limit (CLAUDE_MS)
  // opts.signal: the app's request (req.signal). An app closed mid-reading drops its connection: the reading stops there, and the
  // handler, seeing a status other than 200, gives the count back (the audit of 2026-11-14: a reading killed mid-way was still counted)
  const gone = () => !!(opts.signal && opts.signal.aborted);
  for (let attempt = 1; ; attempt++) {
    if (gone()) return CLIENT_GONE;
    const limit = AbortSignal.timeout(CLAUDE_MS), signal = opts.signal && AbortSignal.any ? AbortSignal.any([limit, opts.signal]) : limit;
    try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: sent, signal }); }
    catch (e) {
      if (gone()) return CLIENT_GONE;
      if (e && e.name === 'TimeoutError') return { status: 504, body: { error: 'ai', detail: `Claude took over ${CLAUDE_MS / 60000} minutes to answer. Try again.` } };
      if (attempt < 2) { await sleep(pause); continue; }
      return { status: 502, body: { error: 'ai', detail: 'Could not reach the Claude API: ' + String(e && e.message) } };
    }
    if (attempt < 2 && (r.status === 429 || r.status >= 500)) {
      const after = Math.min(CLAUDE_RETRY_MAX, Math.max(pause, (+r.headers.get('retry-after') || 0) * 1000));
      console.log(`Claude API ${r.status}; trying again in ${after} ms`);
      try { await r.body?.cancel(); } catch { }
      await sleep(after); continue;
    }
    out = await r.json().catch(() => null);
    break;
  }
  if (!r.ok) {
    const msg = out && out.error && out.error.message || `HTTP ${r.status}`;
    const hint = r.status === 401 ? ' (check the ANTHROPIC_API_KEY secret)' : /credit|billing/i.test(msg) ? ' (add credits in the Claude Console: Billing)' : r.status === 429 ? ' (rate limited; try again shortly)' : r.status === 529 ? ' (overloaded; try again shortly)' : '';
    return { status: 502, body: { error: 'ai', detail: `Claude API: ${msg}${hint}` } };
  }
  if (!out) return { status: 502, body: { error: 'ai', detail: 'Claude API: an answer that was not JSON' } };
  if (out.stop_reason === 'refusal') return { status: 502, body: { error: 'ai', detail: opts.what === 'described' ? 'Claude declined to answer this description.' : 'Claude declined to label this photo.' } };
  if (out.stop_reason === 'max_tokens') return { status: 502, body: { error: 'ai', detail: 'Claude ran out of tokens before answering.' } };
  const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const u = out.usage || {};
  console.log(`${opts.what || 'tagged'} by Claude (${out.model}); tokens in ${u.input_tokens}, cache read ${u.cache_read_input_tokens || 0}, cache written ${u.cache_creation_input_tokens || 0}, out ${u.output_tokens}`);
  try { return { status: 200, body: { ...JSON.parse(text), model: out.model } }; }
  catch { return { status: 502, body: { error: 'unparseable model output', detail: text.slice(0, 300) } }; }
}

/* the extra single-item fields, tidied: suggestion text kept short and plain, the cloth box inside the photo */
function cleanTag(t, opts = {}) {
  const sug = v => v && typeof v === 'object' && txt(v.name, 30) ? { name: txt(v.name, 30), why: txt(v.why, 200) } : null;
  const clamp = v => Math.max(0, Math.min(1000, Math.round(+v || 0)));
  let box = null;
  if (t.clothBox && typeof t.clothBox === 'object') { const x = clamp(t.clothBox.x), y = clamp(t.clothBox.y);
    box = { x, y, w: Math.max(1, Math.min(1000 - x, clamp(t.clothBox.w))), h: Math.max(1, Math.min(1000 - y, clamp(t.clothBox.h))) }; }
  const boxOf = b => { if (!b || typeof b !== 'object') return null; const x = clamp(b.x), y = clamp(b.y);
    return { x, y, w: Math.max(1, Math.min(1000 - x, clamp(b.w))), h: Math.max(1, Math.min(1000 - y, clamp(b.h))) }; };
  let weave = null;
  if (t.weave && typeof t.weave === 'object') { const w = t.weave;
    // up to 80: a pinstripe jacket has 20-40 stripes across its front (the prompt says so); capped at 12 it was drawn 2.5x too wide
    weave = { layout: w.layout, direction: w.direction, repeatsAcross: Math.max(.2, Math.min(80, +w.repeatsAcross || 1)),
      colours: (Array.isArray(w.colours) ? w.colours : []).slice(0, 24).filter(c => c && HEX_RE.test(c.hex || '')).map(c => ({ name: txt(c.name, 30), hex: c.hex.toLowerCase(), width: ['hairline', 'narrow', 'medium', 'wide'].includes(c.width) ? c.width : 'medium' })),
      crossing: txt(w.crossing, 300), description: txt(w.description, 600) }; }
  const own = c => c && typeof c === 'object' && HEX_RE.test(c.hex || '') && /[a-z]{2}/i.test(txt(c.name, 30)) ? { name: txt(c.name, 30).toLowerCase(), hex: c.hex.toLowerCase() } : null;
  const ownColors = t.ownColors && typeof t.ownColors === 'object' && own(t.ownColors.primary)
    ? { primary: own(t.ownColors.primary), secondary: own(t.ownColors.secondary), tertiary: own(t.ownColors.tertiary) } : undefined;
  const op = t.ownPattern;
  const ownPattern = op && typeof op === 'object' && /[a-z]{2}/i.test(txt(op.name, 60))
    ? { name: txt(op.name, 60).toLowerCase(), description: txt(op.description, 300), fits: op.fits === true } : undefined;
  // the material held to its tier (cleanMaterial: a fiber is low, and low without a close-up), never only the pattern again
  const material = 'material' in t ? cleanMaterial(t.material, t.type, [t.pattern], !!opts.closeup) || undefined : undefined;
  return { ...t, newColor: sug(t.newColor), newPattern: sug(t.newPattern), clothBox: box, patternBox: boxOf(t.patternBox), weave, ownColors, ownPattern, material };
}
/* POST /tag-many {image} -> {items: [tag + confidence + box], model}
   One photo with several items (a closet rail of shirts, suits on hangers, folded trousers): every item is listed,
   left to right, each with the same fields as a single tag, a confidence, and a rough box (thousandths of the image). */
const MULTI_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: [...TAG_SCHEMA.required, 'confidence', 'box'],
    properties: {
      ...TAG_SCHEMA.properties,
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      box: { type: 'object', additionalProperties: false, required: ['x', 'y', 'w', 'h'],
        properties: { x: { type: 'integer' }, y: { type: 'integer' }, w: { type: 'integer' }, h: { type: 'integer' } } },
    },
  } } },
};
const MULTI_PROMPT = `This photo shows several clothing items, for example dress shirts hanging on a closet rail, suits or blazers on
hangers, or trousers hanging or folded. List every distinct item you can see, from left to right.

Rules:
- Each physical item is listed once. Count sleeves, collars and hangers to separate neighboring items; items that overlap
  or are partly hidden still count if you can see enough of them to tell their color.
- A suit jacket hanging together with trousers of the same cloth is ONE item of type suit, not a suit and pants.
- A jacket hanging on its own is a blazer, unless it is clearly a suit jacket (smooth worsted suiting, or its matching
  trousers are visible); when you cannot tell, choose blazer and confidence medium or low.
- Trousers hanging or folded on their own are type pants. Each pair is one item.
- confidence: high when the color, type and pattern are clearly visible; medium when part of the item is hidden or the
  texture is hard to see; low when you are guessing.
- box: the approximate rectangle around the visible part of the item, in thousandths of the image size: x and y are the
  top-left corner (0-1000 from the left and top edges), w and h the width and height (0-1000).

For each item give these fields:
` + PROMPT.slice(PROMPT.indexOf('type —'));
async function handleTagMany(req, env, json, who) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ai', detail: 'Several items in one photo needs Claude: add an ANTHROPIC_API_KEY secret to the worker.' }, 501);
  const text = await req.text();
  if (text.length > 15e6) return json({ error: 'photo too large' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  const custom = cleanCustom(body.custom), base = tagSchema(custom, false);
  const schema = { ...MULTI_SCHEMA, properties: { items: { ...MULTI_SCHEMA.properties.items, items: { ...MULTI_SCHEMA.properties.items.items,
    properties: { ...MULTI_SCHEMA.properties.items.items.properties, ...base.properties } } } } };
  const over = await spend(env, who, 'tag'); if (over) return json(over.body, over.status);
  const c = await tagWithClaude(env, String(body.image || ''), { schema, prompt: MULTI_PROMPT, owner: customText(custom) + correctionsText(body.corrections), wb: wbOf(body), maxTokens: 16000, effort: 'medium', signal: req.signal });
  if (c.status !== 200) { await unspend(env, who, 'tag'); return json(c.body, c.status); }
  const clamp = v => Math.max(0, Math.min(1000, Math.round(+v || 0)));
  const items = (Array.isArray(c.body.items) ? c.body.items : []).slice(0, 40).map(it => {
    const b = it.box || {}, x = clamp(b.x), y = clamp(b.y);
    return { ...it, box: { x, y, w: Math.max(1, Math.min(1000 - x, clamp(b.w))), h: Math.max(1, Math.min(1000 - y, clamp(b.h))) } };
  }).sort((a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2));
  console.log(`tagged ${items.length} items in one photo`);
  return json({ items, model: c.body.model });
}

/* the fallback tagger (no ANTHROPIC_API_KEY): Llama 3.2 Vision on Workers AI, told the JSON shape in the prompt -> {status, body} */
async function tagWithWorkersAi(env, image) {
  const model = env.MODEL || DEFAULT_MODEL;
  const input = {
    max_tokens: 300,
    temperature: 0.1,
    messages: [
      { role: 'system', content: 'You are a menswear expert who labels clothing photos. You answer with JSON only.' },
      { role: 'user', content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: image } },
      ] },
    ],
  };
  const fail = e => ({ status: 502, body: { error: 'ai', detail: String(e && e.message || e) } });
  let out;
  try {
    out = await env.AI.run(model, input);
  } catch (e) {
    if (!/5016|agree/i.test(String(e && e.message))) return fail(e);
    // Llama 3.2 Vision is gated: the account must accept Meta's licence once (error 5016). Do that and retry.
    try { await env.AI.run(model, { prompt: 'agree' }); out = await env.AI.run(model, input); }
    catch (e2) { return fail(e2); }
  }
  const raw = out && out.response;
  console.log(`tagged by Workers AI (${model})`);
  if (raw && typeof raw === 'object') return { status: 200, body: { ...raw, model } };
  const text = String(raw || '');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { status: 502, body: { error: 'no json in model output', detail: text.slice(0, 300) } };
  try { return { status: 200, body: { ...JSON.parse(m[0]), model } }; }
  catch { return { status: 502, body: { error: 'unparseable model output', detail: m[0].slice(0, 300) } }; }
}

export { COLOR_HEX, COLOR_LIST, FREE_EXTRA, FREE_PAT_EXTRA, HEX_RE, MATERIALS_BY, MATERIAL_EXTRA, MATERIAL_RULES, PATTERN_BY_TYPE, PATTERN_LIST, SINGLE_EXTRA, cleanMaterial, materialSchema, TAG_INTRO, TAG_RULES, TYPE_COLORS, TYPE_LIST, claudeCall, cleanCustom, cleanTag, correctionsText, customText, handleTagMany, lightText, measuredText, tagSchema, tagWithClaude, tagWithWorkersAi, txt, wbOf };
