// Cloudflare Worker for photo recognition (Claude API, or Workers AI as a fallback), backup/sync and photo links.
//
// Bindings / variables (Worker > Settings):
//   ANTHROPIC_API_KEY  secret; your Claude API key from platform.claude.com. When set, photos are tagged by Claude.
//   CLAUDE_MODEL    optional, defaults to claude-opus-5-5 (e.g. claude-sonnet-5-5 or claude-haiku-5-5 cost less)
//   AI              Workers AI binding, variable name "AI"   (used only when ANTHROPIC_API_KEY is not set)
//   APP_TOKEN       secret; must match the App Token in the app's settings (recommended — without it anyone can use your quota)
//   ALLOWED_ORIGIN  e.g. https://YOURNAME.github.io          (optional; omit to allow any origin)
//   MODEL           optional Workers AI model, defaults to @cf/meta/llama-3.2-11b-vision-instruct
//   (GET /fetch?url=… also uses APP_TOKEN: it downloads photo links for the app; so does GET /holidays?country=XX)
//   OPENAI_API_KEY  secret; enables POST /render (the "realistic photo" button). Requires APP_TOKEN.
//   OPENAI_IMAGE_MODEL    optional, defaults to gpt-image-2
//   OPENAI_IMAGE_QUALITY  optional: low, medium (default) or high; an outfit request may ask for its own with body.quality
//                         (and its own body.model, e.g. gpt-image-2.6-sunburst, and body.complexity for GPT Image 2.6)
//   WARDROBE        KV namespace binding, variable name "WARDROBE": backup and sync of the wardrobe (optional;
//                   backups also require APP_TOKEN, so your wardrobe is never readable without the token)
//
// Pattern lists must stay in sync with PATS_BY in core.js.
/* colours each item type really comes in: [main colours, stripe / motif colours]. Must match COLS_BY in core.js. */
const SUITING = ['black','charcoal','darkgrey','grey','midgrey','lightgrey','navy','darknavy','deepblue','blue','steelblue','slate','brown','deeptaupe','taupe','tan','khaki','olive','green'],
  SUIT_LINES = ['white','cream','lightgrey','grey','midgrey','charcoal','black','lightblue','blue','navy','deepblue','burgundy','red','rust','brown','tan','green','olive','gold'],
  LEATHER_COLS = ['black','brown','tan','oxblood','burgundy','navy','grey','taupe'];
const TYPE_COLORS = {
  suit: [[...SUITING,'cream'], SUIT_LINES],
  blazer: [[...SUITING,'cream','burgundy','wine','rust'], SUIT_LINES],
  pants: [[...SUITING,'cream','lightblue'], SUIT_LINES],
  shirt: [['white','ivory','cream','paleyellow','beige','pink','lavender','periwinkle','mint','lightblue','blue','steelblue','lightgrey','midgrey','grey','slate','charcoal','navy','darknavy','black','burgundy'],
    ['white','navy','darknavy','blue','lightblue','steelblue','red','burgundy','pink','lavender','purple','grey','lightgrey','charcoal','black','green','mint','brown','gold']],
  tie: [['navy','darknavy','deepblue','blue','steelblue','lightblue','slate','black','charcoal','grey','silver','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust','cream'],
    ['white','cream','silver','lightgrey','grey','charcoal','black','navy','deepblue','blue','lightblue','steelblue','burgundy','wine','red','pink','purple','lavender','green','olive','brown','tan','gold','rust']],
  tieclip: [['silver','gold','grey','black'], ['black','white','navy','gold','silver']],
  cufflinks: [['silver','gold','grey','black','white','navy','blue','lightblue','burgundy','red','green','purple'], ['silver','gold','black','white','navy','blue','burgundy','red','green']],
  watch: [['black','brown','tan','oxblood','navy','grey','green','silver','gold'], ['black','brown','white','grey','navy']],
  shoes: [LEATHER_COLS, ['black','brown','tan','white','navy']],
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
{"type":"...","primaryColor":"...","secondaryColor":"...","tertiaryColor":"...","pattern":"...","metal":"...","leather":"...","dial":"...","band":"...","bezel":"..."}

type — one of:
  suit (suit jacket, or a jacket and trousers of the same cloth), blazer (odd jacket / sport coat), pants (dress trousers),
  shirt (dress shirt), tie, tieclip, watch, shoes, belt, socks, cufflinks, overcoat (wool topcoat), raincoat (trench or mac)

primaryColor — the dominant colour of the main fabric (the leather for shoes and belts, the strap or bracelet for watches, the metal
  for tie clips). Use only a colour from the item type's own list (main colours, before the |):
${TYPE_COLOR_TEXT}
  (charcoal is near-black grey; darkgrey sits between charcoal and grey; midgrey is a medium grey, between grey and lightgrey;
  lightgrey is pale grey; steelblue is a dusty, greyed mid blue (denim-like); deepblue is a rich, saturated dark blue, brighter
  than navy; darknavy is navy so dark it is almost black; slate is a dark blue-grey, greyer than navy and bluer than charcoal;
  wine is a red-leaning burgundy; oxblood is a deep brownish red, the colour of cordovan "color 8" shoes, darker and browner
  than burgundy; khaki is the light sandy beige of classic chinos and cotton dress trousers, lighter and greener than tan,
  which is a warmer, deeper camel brown; taupe is a greyish brown, between grey and tan;
  deeptaupe is a dark taupe, a deep greyish brown, darker and greyer than brown and much darker than taupe (a mink or
    espresso-grey suit whose brown is so muted it reads almost grey is deeptaupe, not brown; brown is a clearly warm, coloured brown); rust is a burnt orange-brown;
  ivory is a warm off-white, between white and cream; beige is a pale sandy tan; mint is a pale green; periwinkle is a soft
  blue with a violet cast, between lightblue and blue; grey for a tie clip or cufflinks means gunmetal)
  Judge shirt colours as in daylight: warm indoor light makes white look ivory and grey look beige.

secondaryColor — the colour of the stripe, check line, dot or motif, from the type's line colours (after the |). "none" if plain.
  Socks: the colour of a contrasting toe cap (the knitted tip over the toes, often a light heather grey on a dark sock), or "none"
  if the toe is the same colour as the rest of the sock. A small logo or a heel in the same colour as the sock does not count.
tertiaryColor — a third distinct colour in the pattern (e.g. the second line colour of a tattersall), from the same, or "none".

pattern — pick the closest value from the list for the item's type:
  suit, blazer, pants:
    solid        plain cloth with no visible pattern
    pinstripe    very thin, crisp, evenly spaced lines (about 1 cm apart)
    chalk-stripe soft, fuzzy, wider lines spaced further apart than pinstripe
    herringbone  columns of small V / zigzag shapes in the weave
    birdseye     tiny repeating dots with a light centre, like a bird's eye
    nailhead     tiny pinpoint dots in an even grid
    sharkskin    fine two-tone diagonal weave with a slight sheen
    houndstooth  small broken, jagged, four-pointed checks
    glen-check   Prince of Wales: blocks of small check alternating with larger check, often with a coloured overcheck
    windowpane   thin lines forming large squares on a plain ground
    tweed        rough, flecked, multi-tone wool
    twill        plain colour with a visible diagonal rib
    other
  shirt:
    solid (smooth poplin or broadcloth), stripe (bold or bengal stripe), pinstripe (thin lines), fine-stripe (hairline stripes, very
    close together, reads almost solid), gingham (even two-colour checks), tattersall (thin lines of two alternating colours forming
    checks), check (any other check or plaid), houndstooth (tiny broken checks), herringbone, oxford (basket-weave texture),
    pinpoint (very fine oxford weave), royal-oxford (pronounced, shiny basket weave), twill (fine diagonal rib), end-on-end
    (fil-a-fil: white and coloured threads alternate, a fine heathered two-tone look), chambray (coloured warp with white weft,
    slightly faded look), dobby (small repeating woven motif, tone on tone), woven (visible small cross-weave), textured (uneven,
    slubbed surface), fine-texture (barely visible texture up close), other
  tie:
    solid, woven (a textured solid: a fine basket/oxford weave or micro-check that reads as one colour from a step away, often two-tone
    threads; put the second thread colour in secondaryColor), stripe (diagonal/regimental), polka-dot, paisley, check (a visible check),
    tonal-check (a check or glen check woven in two close shades of one colour,
    e.g. black on charcoal: subtle, but clearly not a solid; put the lighter shade in secondaryColor), foulard (small repeating geometric motif), knit, other
  tieclip, watch, shoes, belt, socks, cufflinks, overcoat, raincoat: solid

Use "solid" for suits, blazers and trousers whose weave is only visible up close and does not match a listed pattern.

metal — for tieclip, watch, cufflinks and belt (the buckle): gold, silver or other (the case and bracelet metal for watches). Otherwise null.

leather — shoes and belts: calf (smooth, moderate shine), cordovan (dense, deep glossy shine with rolling creases), suede (matte napped),
  patent (mirror gloss), pebble-grain (large tumbled grain), scotch-grain (fine embossed grain). Otherwise null.

dial, band, bezel — watches only, otherwise null:
  dial: the dial colour, from the watch dial list above.
  band: bracelet (metal links) or leather (strap).
  bezel: fluted (finely ridged ring around the crystal) or smooth.`;

const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/* ---- Claude API ---- */
const CLAUDE_DEFAULT = 'claude-opus-5-5';
const COLOR_LIST = ['black','charcoal','darkgrey','grey','midgrey','lightgrey','white','cream','lightblue','blue','steelblue','deepblue','navy','darknavy','slate',
  'brown','tan','khaki','taupe','deeptaupe','rust','olive','green','burgundy','wine','oxblood','red','purple','pink','gold','silver',
  'paleyellow','ivory','beige','lavender','periwinkle','mint'];   // per-type lists: TYPE_COLORS
const TYPE_LIST = ['suit','blazer','pants','shirt','tie','tieclip','watch','shoes','belt','socks','cufflinks','overcoat','raincoat'];
const PATTERN_LIST = ['solid','pinstripe','chalk-stripe','herringbone','birdseye','nailhead','sharkskin','houndstooth','glen-check','windowpane','tweed','twill',
  'stripe','gingham','tattersall','check','oxford','polka-dot','paisley','foulard','knit','other',
  'fine-stripe','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture','tonal-check'];
const orNull = values => ({ anyOf: [{ type: 'string', enum: values }, { type: 'null' }] });
// Structured output: the reply is guaranteed to be JSON matching this schema.
const TAG_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['type','primaryColor','secondaryColor','tertiaryColor','pattern','metal','leather','dial','band','bezel'],
  properties: {
    type: { type: 'string', enum: TYPE_LIST },
    primaryColor: { type: 'string', enum: COLOR_LIST },
    secondaryColor: { type: 'string', enum: [...COLOR_LIST, 'none'] },
    tertiaryColor: { type: 'string', enum: [...COLOR_LIST, 'none'] },
    pattern: { type: 'string', enum: PATTERN_LIST },
    metal: orNull(['gold','silver','other']),
    leather: orNull(['calf','cordovan','suede','patent','pebble-grain','scotch-grain']),
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
function tagSchema(custom, single) {
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
  return { ...TAG_SCHEMA, properties: props, required: [...TAG_SCHEMA.required, 'confidence', 'altColor', 'altPattern', 'newColor', 'newPattern', 'clothBox', 'patternBox', 'weave'] };
}
function customText(custom) {
  let t = '';
  if (custom.colors.length) t += `\n\nColours the owner added (answer with the key, like any listed colour, for the item types shown):\n`
    + custom.colors.map(c => `  ${c.key} = ${c.name} (${c.hex}), for ${c.types.join(', ') || 'any type'}${c.accent ? ', also as a stripe or motif colour' : ''}`).join('\n');
  if (custom.patterns.length) t += `\n\nPatterns the owner added (answer with the key, for the item types shown):\n`
    + custom.patterns.map(p => `  ${p.key} = ${p.name}: ${p.desc || 'no description'} (${p.types.join(', ') || 'any type'})`).join('\n');
  return t;
}
const SINGLE_EXTRA = `

Also give:
confidence — for type, primaryColor and pattern: high (clearly visible), medium, or low (guessing).
altColor, altPattern — your second choice for the main colour and the pattern, or "none" if nothing else is plausible.
newColor — when NONE of the colours allowed for this type (the owner's included) is a good match for the main colour, give
  {"name": a short common name for the real colour, "why": one line on how it differs from the closest listed one}; otherwise null.
  Still put the closest allowed colour in primaryColor.
newPattern — the same for the pattern or weave: when no listed pattern fits (you would answer "other"), give {"name", "why": one
  line describing how it looks}; otherwise null. Still put the closest listed pattern in pattern.
clothBox — a rectangle on a plain, evenly lit area of the main cloth in the FIRST photo (no folds, shadows, buttons, labels,
  lining or background), in thousandths of that photo (x, y = top-left corner, w, h = size, all 0-1000), so the app can measure
  its colour; null if there is no such area.
patternBox — for a striped, checked or plaid item, or one with a small figure repeated all over (a neat or foulard, dots): the largest rectangle of the FIRST photo that lies entirely on the patterned
  cloth (no background, knot, collar or edges; on a jacket the front panel beside the buttons, clear of lapels and pockets; on a
  shirt the body, clear of the collar and placket), in thousandths like clothBox, so the app can read the pattern's colours; null otherwise.
weave — for a striped, checked or plaid item (null for solids and fine weaves): its pattern as precisely as you can, from the
  close-up when there is one:
  layout: stripes, stripes-with-crossing-lines (stripes with finer lines running the other way), check, plaid, or other;
  direction: which way the main stripes run in the photo, as the viewer sees them (look carefully: follow one stripe from where it
    enters the tie to where it leaves);
  repeatsAcross: how many times the whole colour sequence repeats across the item's widest part (0.5 if one repeat is twice as wide;
    for a pinstripe or chalk-stripe jacket, the number of stripes across its front, often 20 to 40);
  colours: one full repeat of the stripe sequence in order, each band with a plain name, an sRGB hex as seen, and its width
    (a pinstripe suit: the ground, then the stripe as a hairline; a gingham: the two colours);
  crossing: the lines that run the other way (colours, how fine, how far apart), or "" if none;
  description: one or two sentences describing the pattern for a photo-realistic image generator: the order and colours of the
  bands, which colour dominates, their widths, the crossing lines, and the cloth's sheen or weave. Leave out the direction (the app
  measures it).`;
/* what the app measured (Lab after white balance), to weigh against what is seen */
function measuredText(m) {
  if (!m || !Array.isArray(m.lab) || m.lab.length !== 3) return '';
  const lab = m.lab.map(v => Math.round(+v || 0)), near = (Array.isArray(m.near) ? m.near : []).slice(0, 3)
    .filter(n => n && /^[a-z]{2,32}$/.test(n.c)).map(n => `${n.c} (ΔE ${(+n.d || 0).toFixed(1)})`);
  return `\n\nThe app measured the cloth's colour ${m.src === 'closeup' ? 'in the close-up' : 'in the photo'} after white balance: CIELAB L*${lab[0]} a*${lab[1]} b*${lab[2]}`
    + (HEX_RE.test(m.hex || '') ? ` (${m.hex})` : '') + (near.length ? `; nearest of the owner's colours: ${near.join(', ')}` : '') + '. '
    + (m.ref ? 'A white reference was in the frame, so its lightness is reliable.' : 'There was no white reference, so its lightness may be off by the camera\'s exposure; hue and saturation are more reliable.')
    + ' Use it together with what you see.'
    + (near.length ? ' How colourful a cloth is (its a* and b*) is hard to judge by eye, and a muted colour easily passes for its more saturated neighbour, so weigh the measured hue and saturation. If you choose a primaryColor other than the nearest measured one, give the nearest measured one as altColor.' : '');
}
/* the owner's earlier corrections of the tagger (AI said -> owner chose), to lean the same way */
const FIX_FIELDS = ['type', 'primaryColor', 'secondaryColor', 'pattern'];
function correctionsText(list) {
  const l = (Array.isArray(list) ? list : []).filter(f => f && FIX_FIELDS.includes(f.field) && TYPE_LIST.includes(f.type)
    && /^[a-z][a-z0-9-]{0,31}$/.test(f.from || '') && /^[a-z][a-z0-9-]{0,31}$/.test(f.to || '') && f.from !== f.to).slice(-20);
  return l.length ? `\n\nThe owner corrected these tags on earlier items (you said -> owner chose); lean the same way on similar items:\n`
    + l.map(f => `  ${f.type} ${f.field}: ${f.from} -> ${f.to}`).join('\n') : '';
}

async function tagWithClaude(env, image, opts = {}) {
  const m = image.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
  if (!m) return { status: 400, body: { error: 'no image' } };
  const model = env.CLAUDE_MODEL || CLAUDE_DEFAULT;
  const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
  const body = {
    model,
    max_tokens: opts.maxTokens || 4000,    // thinking counts toward this; a single item's JSON is ~100 tokens
    output_config: { effort: opts.effort || 'low', format: { type: 'json_schema', schema: opts.schema || TAG_SCHEMA } },
    system: 'You are a menswear expert who labels clothing photos for a wardrobe app. The app has already white-balanced the photos, '
      + 'so take their colours as shown and do not shift them for warm or cool light; only allow for shadows, sheen and folds.',
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      ...(opts.closeup ? [{ type: 'image', source: { type: 'base64', media_type: opts.closeup[1], data: opts.closeup[2] } }] : []),
      { type: 'text', text: (opts.closeup ? 'The first photo is the whole item. The second is a close-up of its cloth: use it for the weave, the pattern and the exact colour.\n\n' : '') + (opts.prompt || PROMPT) },
    ] }],
  };
  // If a safety classifier declines (very unlikely for clothing photos), let the API retry on its recommended model.
  if (/opus|fable|sonnet-5-5/.test(model)) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
  let r;
  try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) }); }
  catch (e) { return { status: 502, body: { error: 'ai', detail: 'Could not reach the Claude API: ' + String(e && e.message) } }; }
  const out = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = out && out.error && out.error.message || `HTTP ${r.status}`;
    const hint = r.status === 401 ? ' (check the ANTHROPIC_API_KEY secret)' : /credit|billing/i.test(msg) ? ' (add credits in the Claude Console: Billing)' : r.status === 429 ? ' (rate limited; try again shortly)' : '';
    return { status: 502, body: { error: 'ai', detail: `Claude API: ${msg}${hint}` } };
  }
  if (out.stop_reason === 'refusal') return { status: 502, body: { error: 'ai', detail: 'Claude declined to label this photo.' } };
  if (out.stop_reason === 'max_tokens') return { status: 502, body: { error: 'ai', detail: 'Claude ran out of tokens before answering.' } };
  const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  console.log(`tagged by Claude (${out.model}); tokens in ${out.usage && out.usage.input_tokens}, out ${out.usage && out.usage.output_tokens}`);
  try { return { status: 200, body: { ...JSON.parse(text), model: out.model } }; }
  catch { return { status: 502, body: { error: 'unparseable model output', detail: text.slice(0, 300) } }; }
}

/* the extra single-item fields, tidied: suggestion text kept short and plain, the cloth box inside the photo */
function cleanTag(t) {
  const sug = v => v && typeof v === 'object' && txt(v.name, 30) ? { name: txt(v.name, 30), why: txt(v.why, 200) } : null;
  const clamp = v => Math.max(0, Math.min(1000, Math.round(+v || 0)));
  let box = null;
  if (t.clothBox && typeof t.clothBox === 'object') { const x = clamp(t.clothBox.x), y = clamp(t.clothBox.y);
    box = { x, y, w: Math.max(1, Math.min(1000 - x, clamp(t.clothBox.w))), h: Math.max(1, Math.min(1000 - y, clamp(t.clothBox.h))) }; }
  const boxOf = b => { if (!b || typeof b !== 'object') return null; const x = clamp(b.x), y = clamp(b.y);
    return { x, y, w: Math.max(1, Math.min(1000 - x, clamp(b.w))), h: Math.max(1, Math.min(1000 - y, clamp(b.h))) }; };
  let weave = null;
  if (t.weave && typeof t.weave === 'object') { const w = t.weave;
    weave = { layout: w.layout, direction: w.direction, repeatsAcross: Math.max(.2, Math.min(12, +w.repeatsAcross || 1)),
      colours: (Array.isArray(w.colours) ? w.colours : []).slice(0, 24).filter(c => c && HEX_RE.test(c.hex || '')).map(c => ({ name: txt(c.name, 30), hex: c.hex.toLowerCase(), width: ['hairline', 'narrow', 'medium', 'wide'].includes(c.width) ? c.width : 'medium' })),
      crossing: txt(w.crossing, 300), description: txt(w.description, 600) }; }
  return { ...t, newColor: sug(t.newColor), newPattern: sug(t.newPattern), clothBox: box, patternBox: boxOf(t.patternBox), weave };
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
hangers, or trousers hanging or folded. List every distinct item you can see, from left to right. Reply with JSON only.

Rules:
- Each physical item is listed once. Count sleeves, collars and hangers to separate neighbouring items; items that overlap
  or are partly hidden still count if you can see enough of them to tell their colour.
- A suit jacket hanging together with trousers of the same cloth is ONE item of type suit, not a suit and pants.
- A jacket hanging on its own is a blazer, unless it is clearly a suit jacket (smooth worsted suiting, or its matching
  trousers are visible); when you cannot tell, choose blazer and confidence medium or low.
- Trousers hanging or folded on their own are type pants. Each pair is one item.
- confidence: high when the colour, type and pattern are clearly visible; medium when part of the item is hidden or the
  texture is hard to see; low when you are guessing.
- box: the approximate rectangle around the visible part of the item, in thousandths of the image size: x and y are the
  top-left corner (0-1000 from the left and top edges), w and h the width and height (0-1000).

For each item give these fields:
` + PROMPT.slice(PROMPT.indexOf('type —'));
async function handleTagMany(req, env, json) {
  if (env.APP_TOKEN && (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ai', detail: 'Several items in one photo needs Claude: add an ANTHROPIC_API_KEY secret to the worker.' }, 501);
  const text = await req.text();
  if (text.length > 15e6) return json({ error: 'photo too large' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  const custom = cleanCustom(body.custom), base = tagSchema(custom, false);
  const schema = { ...MULTI_SCHEMA, properties: { items: { ...MULTI_SCHEMA.properties.items, items: { ...MULTI_SCHEMA.properties.items.items,
    properties: { ...MULTI_SCHEMA.properties.items.items.properties, ...base.properties } } } } };
  const c = await tagWithClaude(env, String(body.image || ''), { schema, prompt: MULTI_PROMPT + customText(custom) + correctionsText(body.corrections), maxTokens: 16000, effort: 'medium' });
  if (c.status !== 200) return json(c.body, c.status);
  const clamp = v => Math.max(0, Math.min(1000, Math.round(+v || 0)));
  const items = (Array.isArray(c.body.items) ? c.body.items : []).slice(0, 40).map(it => {
    const b = it.box || {}, x = clamp(b.x), y = clamp(b.y);
    return { ...it, box: { x, y, w: Math.max(1, Math.min(1000 - x, clamp(b.w))), h: Math.max(1, Math.min(1000 - y, clamp(b.h))) } };
  }).sort((a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2));
  console.log(`tagged ${items.length} items in one photo`);
  return json({ items, model: c.body.model });
}

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
async function handlePattern(req, env, json) {
  if (env.APP_TOKEN && (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ai', detail: 'Reading a pattern needs Claude: add an ANTHROPIC_API_KEY secret to the worker.' }, 501);
  const text = await req.text();
  if (text.length > 20e6) return json({ error: 'photos too large' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  const cm = String(body.closeup || '').match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
  const kind = TYPE_LIST.includes(body.type) ? `The item is a ${body.type === 'pants' ? 'pair of dress trousers' : body.type}. ` : '';
  const c = await tagWithClaude(env, String(body.image || ''), { schema: PATTERN_SCHEMA, prompt: kind + PATTERN_PROMPT, closeup: cm, effort: 'high', maxTokens: 16000 });
  if (c.status !== 200) return json(c.body, c.status);
  const out = cleanPattern(c.body);
  if (!out.across && !out.motif && !out.texture) return json({ error: 'no pattern', detail: 'Claude found no repeating pattern.', layout: out.layout }, 422);
  return json({ ...out, model: c.body.model });
}

/* GET /fetch?url=… downloads a photo for the app when the site won't let the browser fetch it directly (no CORS).
   A link to a web page (e.g. a shop's product page) returns the page's share image (og:image / twitter:image).
   Requires APP_TOKEN; only http(s); images only; 15 MB cap. */
const IMG_LIMIT = 15e6;
async function handleFetchImage(req, env, json, cors) {
  if (!env.APP_TOKEN) return json({ error: 'Set an APP_TOKEN secret on the worker to fetch photo links.' }, 403);
  if ((req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  let u;
  try { u = new URL(new URL(req.url).searchParams.get('url') || ''); } catch { return json({ error: 'That is not a valid link.' }, 400); }
  if (!/^https?:$/.test(u.protocol)) return json({ error: 'Only http and https links are supported.' }, 400);
  const get = href => fetch(href, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyWardrobe photo fetch)', accept: 'image/*,text/html;q=0.8,*/*;q=0.5' } });
  let r = await get(u.href);
  if (!r.ok) return json({ error: `The link returned an error (${r.status}).` }, 502);
  let type = r.headers.get('content-type') || '';
  if (type.includes('text/html')) {
    const html = (await r.text()).slice(0, 600000);
    const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i);
    if (!meta) return json({ error: 'No photo found on that page. Try a direct link to the image.' }, 422);
    const img = new URL(meta[1].replace(/&amp;/g, '&'), u);
    if (!/^https?:$/.test(img.protocol)) return json({ error: 'No usable photo found on that page.' }, 422);
    r = await get(img.href);
    if (!r.ok) return json({ error: `The page's photo returned an error (${r.status}).` }, 502);
    type = r.headers.get('content-type') || '';
  }
  if (!type.startsWith('image/')) return json({ error: 'That link is not a photo.' }, 415);
  if (+(r.headers.get('content-length') || 0) > IMG_LIMIT) return json({ error: 'That photo is too large (over 15 MB).' }, 413);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > IMG_LIMIT) return json({ error: 'That photo is too large (over 15 MB).' }, 413);
  return new Response(buf, { headers: { ...cors, 'content-type': type, 'cache-control': 'no-store' } });
}

/* POST /render {image, refs, outfit, nojacket?} -> {image: data URL, model}
   Turns the app's outfit illustration into a photorealistic picture with OpenAI's image edit API. The illustration
   fixes the pose and framing; photos of the actual items (refs) and the written outfit keep colours and patterns right. */
const RENDER_PROMPT = (outfit, nojacket) => nojacket ? `Turn the first image (an illustration) into a photorealistic photograph.
Keep exactly the same pose, crop and framing: a man's torso from the chin down to the hips, no face, in shirt sleeves with no jacket; his forearms cross at the waist, one hand rests on his chest next to the wristwatch, the other hand rests at his waist.
He is wearing: ${outfit}.
Every garment must keep the colour and pattern shown in the illustration${'{REFS}'}. Do not add, remove or change any item: no jacket, and no tie unless one is listed.
A crisp cotton dress shirt with natural folds, buttoned cuffs, realistic hands and skin.
Soft natural daylight, softly blurred bright office background, 50mm lens, editorial menswear photography. No added text, captions or watermark (printing on a watch dial stays as in its photo).`
  : `Turn the first image (an illustration) into a photorealistic photograph.
Keep exactly the same pose, crop and framing: a man's torso from the chin down to the hips, no face; his forearms cross at the waist, one hand holds the jacket lapel next to the wristwatch, the other hand rests at the jacket button.
He is wearing: ${outfit}.
Every garment must keep the colour and pattern shown in the illustration${'{REFS}'}. Do not add, remove or change any item.
Real wool suiting with natural drape and texture, crisp cotton shirt, silk tie, realistic hands and skin.
Soft natural daylight, softly blurred bright office background, 50mm lens, editorial menswear photography. No added text, captions or watermark (printing on a watch dial stays as in its photo).`;
/* a one-piece edit of a kept photo (a test path: is changing one piece cheaper than a whole new photo?): body.image is the
   photo, body.swap {what, text} the piece (one of SWAP_KEEP) and its description, refs its photos, body.mask (or body.markup) where it is */
/* the generator once answered a swap with a collage: the figure moved aside and the reference photos pasted next to it */
const ONE_PHOTO = 'The result is one single photograph with the same crop and framing as the first image: the man stays where he is and at the same size. Do not add panels, insets, swatches, borders or copies of the other images; they only show what the new piece looks like.';
const SWAP_KEEP = { jacket: 'the jacket and its pattern', waistcoat: 'the waistcoat, if he wears one', shirt: 'the shirt and collar', tie: 'the tie, its knot and its pattern', 'tie bar': 'the tie bar', watch: 'the wristwatch' };
const SWAP_PROMPT = (what, text) => `Edit the first image (a photograph of a man's torso). Replace only the ${what} with: ${text}{REFS}.
The new ${what} takes the place of the old one: same position, size, shape, drape and lighting, with the same outline, lying under whatever covers it now (a hand, the tie bar, the lapels).${what === 'jacket' ? ' Keep the cut as it is: the lapels, buttons, pockets, sleeves and every fold stay where they are; only the cloth changes.' : ''}
Everything else must stay exactly as it is in the first image, pixel for pixel where possible: ${Object.keys(SWAP_KEEP).filter(k => k !== what).map(k => SWAP_KEEP[k]).join(', ')}, both hands, the pose, the background, the light and the framing.
${ONE_PHOTO}
No added text, captions or watermark.`;
/* adding a piece the photo doesn't have yet (a tie bar: the master photo has none) */
const SWAP_ADD_PROMPT = (what, text) => `Edit the first image (a photograph of a man's torso). Add one thing only: ${text}{REFS}.
Everything else must stay exactly as it is in the first image, pixel for pixel where possible: ${Object.keys(SWAP_KEEP).filter(k => k !== what).map(k => SWAP_KEEP[k]).join(', ')}, both hands, the pose, the background, the light and the framing.
${ONE_PHOTO}
No added text, captions or watermark.`;
/* the master photo of assembled outfits (assemble.js): the pose in plain placeholder clothes, which every item's photo is an edit of */
const MASTER_NOTE = `
This is a plain reference photo. The suit is a solid, perfectly plain worsted wool with no pattern, stripe, check or visible weave. The tie is a solid plain silk with no pattern. The shirt is plain, with a classic spread collar and plain barrel cuffs showing at both wrists. No tie bar, tie clip, pocket square, lapel pin or cufflinks.`;
function dataUrlToBlob(u) {
  const m = String(u || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
  if (!m) return null;
  const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
async function handleRender(req, env, json) {
  if (!env.APP_TOKEN) return json({ error: 'Set an APP_TOKEN secret on the worker to generate photos.' }, 403);
  if ((req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.OPENAI_API_KEY) return json({ error: 'Add an OPENAI_API_KEY secret to the worker to generate realistic photos.' }, 501);
  const text = await req.text();
  if (text.length > 20e6) return json({ error: 'request too large' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  if (body.mode === 'item') return renderItem(body, env, json);
  if (body.mode === 'queue') return queueRender(body, env, json);
  const r = await outfitPhoto(body, env);
  if (!r.ok) return json({ error: r.error }, r.status);
  // keep a copy per outfit combination so it is reused on any day and shown on every device (GET /render?key=...)
  const id = renderId(body);
  if (env.WARDROBE && id) await env.WARDROBE.put(`render:${id}`, JSON.stringify(r.rec), renderTtl(id));
  return json({ image: r.rec.img, model: r.rec.model, usage: r.usage });   // usage: OpenAI's token counts for this photo
}
/* one realistic outfit photo from the app's inputs (the rasterised illustration, item photos, outfit text) via OpenAI's image edit;
   -> {ok, rec} or {ok:false, status, error, retry} (retry: worth trying again later: network, rate limit, OpenAI server error) */
const QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max'];   // xhigh and max: GPT Image 2.5 and later
/* a request may name its own image model (to try a newer one under a test key) and, for GPT Image 2.6, a complexity */
const IMG_MODEL_RE = /^gpt-image-[a-z0-9.-]{1,40}$/, COMPLEXITIES = ['low', 'medium', 'high'];
const OPENAI_MS = 300000;
async function outfitPhoto(body, env) {
  let base = dataUrlToBlob(body.image);
  // baseKey: edit a photo kept here (an item's piece is an edit of the master), so the app doesn't upload the master with every piece
  if (!base && COMBO_RE.test(String(body.baseKey || '')) && env.WARDROBE) {
    const kept = await env.WARDROBE.get(`render:${body.baseKey}`, 'json');
    base = dataUrlToBlob(kept && kept.img);
    if (!base) return { ok: false, status: 409, retry: true, error: 'the photo to edit is not there yet' };   // the master may still be on its way
  }
  if (!base) return { ok: false, status: 400, error: 'no illustration' };
  const refs = (Array.isArray(body.refs) ? body.refs : []).slice(0, 8).map(dataUrlToBlob).filter(Boolean);
  const outfit = String(body.outfit || '').slice(0, 2500) || 'a suit, dress shirt and tie';
  const model = IMG_MODEL_RE.test(String(body.model || '')) ? body.model : env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const form = new FormData();
  form.append('model', model);
  const labels = (Array.isArray(body.labels) ? body.labels : []).slice(0, refs.length).map(l => String(l).replace(/[^\w ,.:()'-]/g, '').slice(0, 160));
  const refText = !refs.length ? '' : labels.length === refs.length
    ? `. The photos after the illustration show the actual items, in this order: ${labels.join('; ')}. Match each one exactly`
    : ', and match the photos of the actual items that follow it';
  const swap = body.swap && Object.hasOwn(SWAP_KEEP, String(body.swap.what || '')) ? { what: body.swap.what, text: String(body.swap.text || '').replace(/[{}`]/g, '').slice(0, 1500) || `another ${body.swap.what}` } : null;
  const swapRefs = !refs.length ? '' : `. The images after the first show the new ${swap && swap.what}${labels.length === refs.length ? `, in this order: ${labels.join('; ')}` : ''}. Match it exactly`;
  form.append('prompt', swap ? (body.swap.add ? SWAP_ADD_PROMPT : SWAP_PROMPT)(swap.what, swap.text).replace('{REFS}', swapRefs) : RENDER_PROMPT(outfit, !!body.nojacket).replace('{REFS}', refText) + (body.master ? MASTER_NOTE : ''));
  form.append('image[]', base, `outfit.${base.type.split('/')[1]}`);
  // where to edit: a mask (PNG with an alpha channel, the first image's size) or, for GPT Image 2.5 and later, a markup layer (not both)
  const mask = swap && dataUrlToBlob(body.mask), markup = swap && !mask && dataUrlToBlob(body.markup);
  if (mask) form.append('mask', mask, 'mask.png');
  if (markup) form.append('markup', markup, 'markup.png');
  refs.forEach((b, i) => form.append('image[]', b, `item-${i + 1}.${b.type.split('/')[1]}`));
  form.append('size', '1024x1024');
  form.append('quality', QUALITIES.includes(body.quality) ? body.quality : env.OPENAI_IMAGE_QUALITY || 'medium');
  if (COMPLEXITIES.includes(body.complexity)) form.append('complexity', body.complexity);
  form.append('output_format', 'jpeg');
  form.append('n', '1');
  let r;
  // a time limit: a call that hangs is retried instead of holding the job until Cloudflare stops it
  try { r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(OPENAI_MS) }); }
  catch (e) { return { ok: false, status: 502, retry: true, error: (e && e.name === 'TimeoutError' ? 'OpenAI took over 5 minutes' : 'Could not reach the OpenAI API: ' + String(e && e.message)) }; }
  const out = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = out && out.error && out.error.message || `HTTP ${r.status}`;
    const hint = r.status === 401 ? ' (check the OPENAI_API_KEY secret)' : /verif/i.test(msg) ? ' (verify your organization in the OpenAI dashboard: Settings, Organization, General)'
      : /billing|quota|credit/i.test(msg) ? ' (add credit in the OpenAI dashboard: Billing)' : /model/i.test(msg) ? ' (set OPENAI_IMAGE_MODEL to an image model your account can use)' : '';
    return { ok: false, status: 502, retry: r.status === 429 && !/quota|billing/i.test(msg) || r.status >= 500, error: `OpenAI: ${msg}${hint}` };
  }
  const b64 = out && out.data && out.data[0] && out.data[0].b64_json;
  if (!b64) return { ok: false, status: 502, retry: true, error: 'OpenAI returned no image' };
  console.log(`rendered by ${model}; usage ${JSON.stringify(out.usage || {})}`);
  // the record keeps OpenAI's token counts, so what a photo cost can be read back (GET /render?key=)
  return { ok: true, usage: out.usage || null, rec: { sig: String(body.sig || ''), img: `data:image/jpeg;base64,${b64}`, model, t: Date.now(), ...(out.usage ? { usage: out.usage } : {}) } };
}
/* ---- background photos: the app uploads each outfit's inputs once (POST /render {mode:'queue'}); they wait in KV as job:<key>
   and a Cloudflare Queue message ({key}) makes the photo later, so the app can be closed. GET /render-queue reports progress. ---- */
const JOB_TTL = { expirationTtl: 3 * 86400 }, FAIL_TTL = { expirationTtl: 7 * 86400 };
async function queueRender(body, env, json) {
  if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'Background photos need the RENDER_QUEUE and WARDROBE bindings on the worker.', noQueue: true }, 501);
  const key = String(body.key || '');
  if (!COMBO_RE.test(key)) return json({ error: 'bad key' }, 400);
  if (!dataUrlToBlob(body.image) && !COMBO_RE.test(String(body.baseKey || ''))) return json({ error: 'no illustration' }, 400);
  if (!body.replace && await env.WARDROBE.get(`render:${key}`)) return json({ queued: false, exists: true });   // replace: a regenerate from the app
  const job = { key, image: body.image, refs: (Array.isArray(body.refs) ? body.refs : []).slice(0, 8), labels: (Array.isArray(body.labels) ? body.labels : []).slice(0, 8), outfit: String(body.outfit || '').slice(0, 2500), sig: String(body.sig || ''), quality: QUALITIES.includes(body.quality) ? body.quality : undefined, nojacket: !!body.nojacket || undefined,
    model: IMG_MODEL_RE.test(String(body.model || '')) ? body.model : undefined, complexity: COMPLEXITIES.includes(body.complexity) ? body.complexity : undefined, replace: body.replace ? true : undefined, t: Date.now(),
    ...(body.swap ? { swap: body.swap, mask: body.mask, markup: body.markup } : {}),   // a one-piece edit of a kept photo
    ...(COMBO_RE.test(String(body.baseKey || '')) ? { baseKey: body.baseKey } : {}), ...(body.master ? { master: true } : {}) };
  await env.WARDROBE.put(`job:${key}`, JSON.stringify(job), JOB_TTL);
  await env.WARDROBE.delete(`jobfail:${key}`);
  await env.WARDROBE.put(`jobrun:${key}`, JSON.stringify({ attempts: 0, at: Date.now() }), JOB_TTL);   // queued, not started (GET /render-queue resends it if it never starts)
  await env.RENDER_QUEUE.send({ key });
  return json({ queued: true });
}
const START_STALE_MS = 3 * 60000, RUN_STALE_MS = 20 * 60000;
async function queueStatus(req, env, json) {
  if (!env.APP_TOKEN || (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'no queue', noQueue: true }, 501);
  // The app names the photos it waits for (?keys=a,b): each is looked up with reads, never a KV list. Lists are capped at 1,000 a
  // day on the free plan, and polling with two lists a time used them up, after which every list threw (error 1101) until midnight UTC.
  // Without keys (an older app) the lists are tried, and their failure is reported, not thrown.
  const want = String(new URL(req.url).searchParams.get('keys') || '').split(',').filter(k => COMBO_RE.test(k)).slice(0, 40);
  let pending, failedByKey = null;
  if (want.length) {
    pending = []; failedByKey = [];
    for (const k of want) {
      const f = await env.WARDROBE.get(`jobfail:${k}`, 'json'); if (f) { failedByKey.push({ key: k, error: f.error || 'failed' }); continue; }
      if (await env.WARDROBE.get(`jobrun:${k}`) || await env.WARDROBE.get(`job:${k}`)) pending.push(k);
    }
  } else {
    try { pending = (await env.WARDROBE.list({ prefix: 'job:' })).keys.map(k => k.name.slice(4)); }
    catch (e) { return json({ error: 'The worker has used up its daily KV list allowance; update the app.', detail: String(e && e.message) }, 503); }
  }
  // how far each waiting photo got: attempts so far and when the last began (none yet: its message hasn't been taken)
  // A job whose message never got going (lost, as before the consumer waited for KV) or whose run never finished (the consumer was
  // stopped) is sent to the queue again, up to 3 times, then recorded as failed: no photo sits "pending" for days.
  const running = {}, now = Date.now();
  for (const k of pending.slice(0, 20)) {
    let r = await env.WARDROBE.get(`jobrun:${k}`, 'json');
    if (!r) { const j = await env.WARDROBE.get(`job:${k}`, 'json'); if (!j) continue; r = { attempts: 0, at: +j.t || now }; }   // a job from before jobrun
    const stale = r.attempts ? now - r.at > RUN_STALE_MS : now - r.at > START_STALE_MS;
    if (stale) {
      const resends = (r.resends || 0) + 1;
      if (resends > 3) {
        const error = 'The worker couldn’t get this photo made after several tries. Try again.';
        await env.WARDROBE.put(`jobfail:${k}`, JSON.stringify({ error, t: now }), FAIL_TTL); await env.WARDROBE.delete(`job:${k}`); await env.WARDROBE.delete(`jobrun:${k}`);
        await tellHub(env, { key: k, error }); continue;
      }
      await env.RENDER_QUEUE.send({ key: k }); r = { ...r, attempts: 0, at: now, resends };
      await env.WARDROBE.put(`jobrun:${k}`, JSON.stringify(r), JOB_TTL);
    }
    running[k] = r;
  }
  for (const k of Object.keys(running)) if (!pending.includes(k)) delete running[k];
  let failed = failedByKey;
  if (!failed) { failed = [];
    try { for (const k of (await env.WARDROBE.list({ prefix: 'jobfail:' })).keys.slice(0, 50)) { const f = await env.WARDROBE.get(k.name, 'json'); failed.push({ key: k.name.slice(8), error: f && f.error || 'failed' }); } }
    catch { } }
  return json({ pending, running, failed });
}
/* the queue consumer: one photo per message; temporary failures retry after a minute, others are recorded for the app */
async function runRenderJob(msg, env) {
  const key = String(msg.body && msg.body.key || '');
  const job = COMBO_RE.test(key) ? await env.WARDROBE.get(`job:${key}`, 'json') : null;
  // the job is written to KV just before its message is sent, and KV can take up to a minute to show a new key in another
  // location: a consumer that can't see it yet tries again shortly (acking it lost the photo, which then sat "pending" for days)
  if (!job) { if (COMBO_RE.test(key) && (msg.attempts || 1) < 6) return msg.retry({ delaySeconds: 20 }); return msg.ack(); }
  const run0 = await env.WARDROBE.get(`jobrun:${key}`, 'json');
  await env.WARDROBE.put(`jobrun:${key}`, JSON.stringify({ attempts: msg.attempts || 1, at: Date.now(), resends: run0 && run0.resends || 0 }), JOB_TTL);   // for GET /render-queue
  if (!job.replace && await env.WARDROBE.get(`render:${key}`)) { await env.WARDROBE.delete(`job:${key}`); return msg.ack(); }
  if (!env.OPENAI_API_KEY) { await env.WARDROBE.put(`jobfail:${key}`, JSON.stringify({ error: 'Add an OPENAI_API_KEY secret to the worker.', t: Date.now() }), FAIL_TTL); await env.WARDROBE.delete(`job:${key}`); return msg.ack(); }
  const r = job.kind === 'item' ? await itemPhoto(job, env) : await outfitPhoto(job, env);
  if (r.ok) {
    await env.WARDROBE.put(`render:${key}`, JSON.stringify(r.rec), renderTtl(key));
    await env.WARDROBE.delete(`job:${key}`); await env.WARDROBE.delete(`jobrun:${key}`);
    await tellHub(env, { key, rec: r.rec });
    return msg.ack();
  }
  if (r.retry && (msg.attempts || 1) < 4) return msg.retry({ delaySeconds: 60 });
  console.log(`photo ${key} failed: ${r.error}`);
  await env.WARDROBE.put(`jobfail:${key}`, JSON.stringify({ error: r.error, t: Date.now() }), FAIL_TTL);
  await env.WARDROBE.delete(`job:${key}`); await env.WARDROBE.delete(`jobrun:${key}`);
  await tellHub(env, { key, error: r.error });
  msg.ack();
}
/* ---- the push to an open app (GET /render-wait): the app holds a request open while its photos are being made, and the queue
   job hands each finished photo (or its failure) to one Durable Object, RenderHub, which answers the waiting requests at once with
   the photo itself (KV can take up to a minute to show a new key elsewhere). Results are kept 10 minutes for an app between two
   waits. Without the RENDER_HUB binding the app just polls GET /render-queue. ---- */
const hubOf = env => env.RENDER_HUB && env.RENDER_HUB.get(env.RENDER_HUB.idFromName('renders'));
async function tellHub(env, m) {
  const hub = hubOf(env); if (!hub) return;
  try { await hub.fetch('https://hub/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m) }); }
  catch (e) { console.log('hub notify failed', e && e.message); }   // the app still finds it by polling
}
async function waitForRenders(req, env, json) {
  if (!env.APP_TOKEN || (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  const hub = hubOf(env); if (!hub) return json({ error: 'no push', noPush: true }, 501);
  const u = new URL(req.url), keys = String(u.searchParams.get('keys') || '').split(',').filter(k => COMBO_RE.test(k)).slice(0, 60);
  if (!keys.length) return json({ error: 'no keys' }, 400);
  const ms = Math.max(1000, Math.min(100000, +u.searchParams.get('ms') || 90000));
  const r = await hub.fetch(`https://hub/wait?keys=${keys.join(',')}&ms=${ms}`);
  return json(await r.json().catch(() => []), r.ok ? 200 : 502);
}
export class RenderHub {
  constructor(ctx, env) { this.ctx = ctx; this.waiting = new Set(); this.recent = new Map(); }
  async fetch(req) {
    const u = new URL(req.url), now = Date.now();
    for (const [k, v] of this.recent) if (now - v.at > 600000) this.recent.delete(k);
    const out = b => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/notify') {
      const m = await req.json().catch(() => null); if (!m || !COMBO_RE.test(String(m.key || ''))) return out({ ok: false });
      const res = m.rec ? { key: m.key, rec: m.rec } : { key: m.key, error: String(m.error || 'failed') };
      this.recent.set(m.key, { ...res, at: now });
      for (const w of [...this.waiting]) if (w.keys.has(m.key)) { this.waiting.delete(w); clearTimeout(w.timer); w.resolve([res]); }
      return out({ ok: true });
    }
    if (u.pathname === '/wait') {
      const keys = new Set(String(u.searchParams.get('keys') || '').split(',').filter(Boolean));
      const ready = [...keys].map(k => this.recent.get(k)).filter(Boolean).map(({ at, ...r }) => r);
      if (ready.length) return out(ready);
      const ms = Math.max(1000, Math.min(100000, +u.searchParams.get('ms') || 90000));
      return out(await new Promise(resolve => { const w = { keys, resolve }; w.timer = setTimeout(() => { this.waiting.delete(w); resolve([]); }, ms); this.waiting.add(w); }));
    }
    return new Response('not found', { status: 404 });
  }
}
/* POST /render {mode:'item', item, key} -> a product photo of one accessory (shoes, belt, socks...), made from a short
   description with OpenAI's image generation, kept in KV under the item's look key like outfit photos */
/* every item, socks included, on the same light warm-grey backdrop so the tiles match (a 'bg' from an older app is ignored) */
const ITEM_BG = () => 'Plain light warm-grey seamless background, not white';
const ITEM_PROMPT = item => `Studio product photograph of ${item}. ${ITEM_BG()}, soft even daylight,
the whole item centred and in frame, true-to-life colour and leather or fabric texture, sharp focus, catalogue style.
No person, no props, no text, no logos, no watermark.`;
const ITEM_REF_PROMPT = item => `Studio product photograph of the exact item in the reference photo: ${item}.
Recreate it faithfully, detail for detail: the same case or shape, proportions, materials and finish, the same dial or face layout,
markings, numerals, hands and printing, the same bracelet, strap or links. Do not redesign, simplify or add anything.
Show it on its own, off the wrist: ${ITEM_BG().replace(/^P/, 'p')}, soft even daylight, centred and in frame, sharp focus,
catalogue style. No hands, no person, no props, no added text or watermark.`;
async function renderItem(body, env, json) {
  const item = String(body.item || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  if (!item) return json({ error: 'no item description' }, 400);
  // background: the picture is made by the queue consumer (an edit from a reference photo can take minutes); fetch it later with GET ?key=
  if (body.queue) {
    const key = String(body.key || '');
    if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'no queue', noQueue: true }, 501);
    if (!COMBO_RE.test(key)) return json({ error: 'bad key' }, 400);
    await env.WARDROBE.put(`job:${key}`, JSON.stringify({ kind: 'item', key, item, ref: body.ref || null, t: Date.now() }), JOB_TTL);
    await env.WARDROBE.delete(`jobfail:${key}`);
    await env.RENDER_QUEUE.send({ key });
    return json({ queued: true });
  }
  const r = await itemPhoto({ item, ref: body.ref }, env);
  if (!r.ok) return json({ error: r.error }, r.status);
  const id = renderId(body);
  if (env.WARDROBE && id) await env.WARDROBE.put(`render:${id}`, JSON.stringify(r.rec), renderTtl(id));
  return json({ image: r.rec.img, model: r.rec.model });
}
/* one product picture: from the item's own photo by image edit when there is one, otherwise from the description */
async function itemPhoto({ item, ref: refUrl }, env) {
  const ref = dataUrlToBlob(refUrl), model = env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  let r;
  try {
    if (ref) {
      // a photo of the actual item: edit from it so the picture is that item, not a lookalike
      const form = new FormData();
      form.append('model', model); form.append('prompt', ITEM_REF_PROMPT(item)); form.append('image[]', ref, `item.${ref.type.split('/')[1]}`);
      form.append('size', '1024x1024'); form.append('quality', env.OPENAI_IMAGE_QUALITY || 'high'); form.append('output_format', 'jpeg'); form.append('n', '1');
      if (/^gpt-image-1/.test(model)) form.append('input_fidelity', 'high');
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form });
    } else {
      r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: ITEM_PROMPT(item), size: '1024x1024', quality: env.OPENAI_IMAGE_QUALITY || 'medium', output_format: 'jpeg', n: 1 }) });
    }
  } catch (e) { return { ok: false, status: 502, retry: true, error: 'Could not reach the OpenAI API: ' + String(e && e.message) }; }
  const out = await r.json().catch(() => null);
  if (!r.ok) { const msg = out && out.error && out.error.message || `HTTP ${r.status}`; return { ok: false, status: 502, retry: r.status === 429 && !/quota|billing/i.test(msg) || r.status >= 500, error: `OpenAI: ${msg}` }; }
  const b64 = out && out.data && out.data[0] && out.data[0].b64_json;
  if (!b64) return { ok: false, status: 502, retry: true, error: 'OpenAI returned no image' };
  console.log(`item picture by ${model}: ${item.slice(0, 120)}`);
  return { ok: true, rec: { sig: 'item|' + item, img: `data:image/jpeg;base64,${b64}`, model, t: Date.now() } };
}

/* photos are stored per outfit combination ("c" + 16 hex digits, kept until replaced); older ones were per date (90 days) */
const COMBO_RE = /^c[0-9a-f]{16}$/, DAY_RE = /^\d{4}-\d{1,2}-\d{1,2}$/;
const renderId = o => { const k = String(o && o.key || ''), d = String(o && o.day || ''); return COMBO_RE.test(k) ? k : DAY_RE.test(d) ? d : null; };
/* dated copies go after 90 days; test photos (keys starting c7e57, made to compare models or methods) after 7 */
const renderTtl = id => (DAY_RE.test(id) ? { expirationTtl: 90 * 86400 } : /^c7e57/.test(id) ? { expirationTtl: 7 * 86400 } : undefined);
/* PUT /render {key, rec}: a device uploads a photo the worker doesn't have yet */
async function putRender(req, env, json) {
  if (!env.APP_TOKEN || (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 501);
  const text = await req.text();
  if (text.length > 4e6) return json({ error: 'photo too large' }, 413);
  let b; try { b = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  const rec = b && b.rec;
  const id = renderId(b);
  if (!id || !rec || !/^data:image\/(jpeg|png|webp);base64,/.test(String(rec.img || ''))) return json({ error: 'bad photo' }, 400);
  const cur = await env.WARDROBE.get(`render:${id}`, 'json');
  if (cur && (cur.t || 0) >= (rec.t || 0)) return json({ ok: true, kept: 'newer' });
  await env.WARDROBE.put(`render:${id}`, JSON.stringify({ sig: String(rec.sig || ''), img: rec.img, model: String(rec.model || ''), t: +rec.t || Date.now() }), renderTtl(id));
  return json({ ok: true });
}
/* DELETE /render?key=c... -> the kept photo is removed (one that was made wrong; the app stops using its own copies by changing the key) */
async function delRender(req, env, json) {
  if (!env.APP_TOKEN || (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 501);
  const k = new URL(req.url).searchParams.get('key') || '';
  if (!COMBO_RE.test(k)) return json({ error: 'bad key' }, 400);
  await env.WARDROBE.delete(`render:${k}`);
  return json({ ok: true });
}
/* GET /render?key=c... (or the older ?day=) -> the stored photo, or 404 */
async function getRender(req, env, json) {
  if (!env.APP_TOKEN || (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 404);
  const q = new URL(req.url).searchParams;
  // GET /render?list=1 -> {keys}: every outfit or item photo kept here, so a device can download the ones it lacks in one go
  if (q.get('list')) {
    if (typeof env.WARDROBE.list !== 'function') return json({ error: 'listing not available' }, 501);
    const keys = []; let cursor;
    try { do { const page = await env.WARDROBE.list({ prefix: 'render:c', cursor }); for (const k of page.keys) keys.push(k.name.slice(7)); cursor = page.list_complete ? null : page.cursor; } while (cursor && keys.length < 20000); }
    catch (e) { return json({ error: 'listing not available right now', detail: String(e && e.message) }, 503); }   // the daily list allowance: the app then asks per photo
    return json({ keys: keys.filter(k => COMBO_RE.test(k)) });
  }
  const id = renderId({ key: q.get('key'), day: q.get('day') });
  if (!id) return json({ error: 'bad key' }, 400);
  const rec = await env.WARDROBE.get(`render:${id}`, 'json');
  return rec ? json(rec) : json({ error: 'none' }, 404);
}

/* GET /holidays?country=KW -> {country, holidays: [{date:'YYYY-MM-DD', name}], source}
   Public holidays from Google's public holiday calendars, for the countries the app's first source (Nager.Date, which the
   app asks directly) does not cover, e.g. the Gulf states. Only national public holidays are kept (no observances, no
   regional ones); a holiday of several days is listed day by day. Requires APP_TOKEN. */
function parseHolidayIcs(text) {
  const out = [], unfolded = String(text).replace(/\r?\n[ \t]/g, '');
  for (const ev of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const get = k => { const m = ev.match(new RegExp('^' + k + '[^:\\r\\n]*:(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const clean = s => s.replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1').trim();
    const start = get('DTSTART'), end = get('DTEND'), desc = clean(get('DESCRIPTION')), name = clean(get('SUMMARY'));
    if (!/^\d{8}$/.test(start) || !name) continue;
    if (desc && !/^Public holiday(?! in )/i.test(desc)) continue;     // observances and regional holidays are not days off
    const day = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
    const last = /^\d{8}$/.test(end) ? day(end) : new Date(+day(start) + 864e5);
    for (let d = day(start), n = 0; d < last && n < 31; d = new Date(+d + 864e5), n++) out.push({ date: d.toISOString().slice(0, 10), name });
  }
  return out;
}
async function handleHolidays(req, env, json) {
  if (!env.APP_TOKEN) return json({ error: 'Set an APP_TOKEN secret on the worker to load holiday lists.' }, 403);
  if ((req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  const cc = (new URL(req.url).searchParams.get('country') || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return json({ error: 'country must be a two-letter code' }, 400);
  let all = [];
  for (const id of [`en.${cc}.official`, `en.${cc}`]) {
    try {
      const r = await fetch(`https://calendar.google.com/calendar/ical/${encodeURIComponent(id + '#holiday@group.v.calendar.google.com')}/public/basic.ics`);
      if (r.ok) all = parseHolidayIcs(await r.text());
    } catch { /* try the next calendar name */ }
    if (all.length) break;
  }
  const holidaysError = 'There is no public holiday list for that country. Add its holidays as your own days off below.';
  if (!all.length) return json({ error: 'no holiday list', holidaysError }, 404);
  const from = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10), to = new Date(Date.now() + 430 * 864e5).toISOString().slice(0, 10);
  const byDay = new Map();
  for (const h of all) if (h.date >= from && h.date <= to) byDay.set(h.date, byDay.has(h.date) && !byDay.get(h.date).includes(h.name) ? byDay.get(h.date) + ', ' + h.name : byDay.get(h.date) || h.name);
  return json({ country: cc.toUpperCase(), source: 'google', holidays: [...byDay].sort().map(([date, name]) => ({ date, name })) });
}

const SYNC_KEY = 'wardrobe:v1', SYNC_NONE = '{"rev":0,"saved":0,"data":null}';
/* the stored backup's version {rev, saved} without loading the backup (several MB of photos): KV keeps it as the key's
   metadata, written in the same put as the backup itself. null for a backup saved before this, or where KV can't list. */
async function syncVersion(env) {
  if (typeof env.WARDROBE.list !== 'function') return null;
  try {
    const l = await env.WARDROBE.list({ prefix: SYNC_KEY, limit: 10 }), k = (l.keys || []).find(x => x.name === SYNC_KEY), m = k && k.metadata;
    return m && Number.isInteger(m.rev) ? m : null;
  } catch { return null; }
}
/* GET /sync returns the stored backup {rev, saved, data}; GET /sync?v=<rev>:<saved> answers {rev, saved, same:true} with no
   data when that is still the stored version, so a device with nothing new neither downloads nor uploads anything.
   PUT /sync {baseRev, data} stores a new one: baseRev must equal the stored rev, otherwise 409 with the current backup so
   the app can merge and retry (two devices syncing at once never overwrite each other). */
/* dated copies of the backup, so a bad change that reaches the backup can be undone: before the first overwrite of each
   calendar day (the app's own date), the backup as it stood is kept as snap:<YYYY-MM-DD> for 30 days, and the first of each
   month as snap:<YYYY-MM> for a year. A restore from the app (body.reason 'restore') first keeps the backup it replaces as
   snap:before-restore, so a restore can itself be undone. Copied as stored text, not parsed (the backup is several MB). */
const SNAP_DAYS = 30, SNAP_MONTHS = 400, SNAP_DAY = /^\d{4}-\d{2}-\d{2}$/;
async function keepSnapshots(env, m, body) {
  const day = SNAP_DAY.test(body.day || '') ? body.day : new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
  const want = [[`snap:${day}`, SNAP_DAYS], [`snap:${month}`, SNAP_MONTHS]];
  let have = new Set();
  try { have = new Set(((await env.WARDROBE.list({ prefix: 'snap:' })).keys || []).map(k => k.name)); } catch { }
  const todo = want.filter(([k]) => !have.has(k));
  if (body.reason === 'restore') todo.push(['snap:before-restore', SNAP_DAYS]);
  if (!todo.length) return;
  const cur = await env.WARDROBE.get(SYNC_KEY);
  if (!cur || cur === SYNC_NONE) return;                       // nothing stored yet
  let meta = m;
  if (!meta) { try { const o = JSON.parse(cur); meta = { rev: o.rev, saved: o.saved }; } catch { return; } }
  if (!meta.saved) return;
  for (const [k, days] of todo) await env.WARDROBE.put(k, cur, { expirationTtl: days * 86400, metadata: { rev: meta.rev, saved: meta.saved } });
}
async function listSnapshots(env) {
  const l = await env.WARDROBE.list({ prefix: 'snap:' });
  return (l.keys || []).filter(k => k.metadata && k.metadata.saved).map(k => ({ id: k.name.slice(5), saved: k.metadata.saved, rev: k.metadata.rev }))
    .sort((a, b) => b.saved - a.saved || b.id.localeCompare(a.id));   // same moment: the later date first
}
async function handleSync(req, env, json, cors) {
  if (!env.APP_TOKEN) return json({ error: 'Set an APP_TOKEN secret on the worker to enable backups.' }, 403);
  if ((req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.WARDROBE) return json({ error: 'Add a KV namespace binding named WARDROBE to the worker to enable backups.' }, 501);
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams, v = q.get('v');
    if (q.has('snaps')) return json({ snaps: await listSnapshots(env) });
    if (q.has('snap')) {
      const id = q.get('snap');
      if (!/^(\d{4}-\d{2}(-\d{2})?|before-restore)$/.test(id)) return json({ error: 'bad snapshot id' }, 400);
      const t = await env.WARDROBE.get('snap:' + id);
      if (!t) return json({ error: 'no such backup' }, 404);
      return new Response(t, { headers: { ...cors, 'content-type': 'application/json' } });
    }
    if (v) { const m = await syncVersion(env); if (m && `${m.rev}:${m.saved}` === v) return json({ rev: m.rev, saved: m.saved, same: true }); }
    // passed through as stored: no need to parse and rebuild several MB of JSON
    return new Response((await env.WARDROBE.get(SYNC_KEY)) || SYNC_NONE, { headers: { ...cors, 'content-type': 'application/json' } });
  }
  if (req.method === 'PUT') {
    const text = await req.text();
    if (text.length > 24 * 1024 * 1024) return json({ error: 'backup too large (over 24 MB)' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
    const none = { rev: 0, saved: 0, data: null }, m = await syncVersion(env);
    const rev = m ? m.rev : ((await env.WARDROBE.get(SYNC_KEY, 'json')) || none).rev;
    if ((body.baseRev ?? -1) !== rev) return json({ error: 'conflict', ...((await env.WARDROBE.get(SYNC_KEY, 'json')) || none) }, 409);
    await keepSnapshots(env, m, body);
    const next = { rev: rev + 1, saved: Date.now(), data: body.data };
    await env.WARDROBE.put(SYNC_KEY, JSON.stringify(next), { metadata: { rev: next.rev, saved: next.saved } });
    return json({ rev: next.rev, saved: next.saved });
  }
  return json({ error: 'method not allowed' }, 405);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'content-type,x-app-token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return json({ error: 'forbidden origin' }, 403);
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (path === '/sync') return handleSync(req, env, json, cors);
    if (path === '/render-queue' && req.method === 'GET') return queueStatus(req, env, json);
    if (path === '/render-wait' && req.method === 'GET') return waitForRenders(req, env, json);
    if (path === '/fetch' && req.method === 'GET') return handleFetchImage(req, env, json, cors);
    if (path === '/holidays' && req.method === 'GET') return handleHolidays(req, env, json);
    if (path === '/tag-many' && req.method === 'POST') return handleTagMany(req, env, json);
    if (path === '/pattern' && req.method === 'POST') return handlePattern(req, env, json);
    if (path === '/render' && req.method === 'POST') return handleRender(req, env, json);
    if (path === '/render' && req.method === 'GET') return getRender(req, env, json);
    if (path === '/render' && req.method === 'PUT') return putRender(req, env, json);
    if (path === '/render' && req.method === 'DELETE') return delRender(req, env, json);
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

    // The app sends the token both as a header and in the body.
    const token = req.headers.get('x-app-token') || body.appToken || '';
    if (env.APP_TOKEN && token !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);

    // The model wants the image as a data URI inside the user message.
    let image = String(body.image || '');
    if (image && !image.startsWith('data:')) image = `data:${body.media_type || 'image/jpeg'};base64,${image}`;
    if (!/^data:image\/[\w.+-]+;base64,/.test(image)) return json({ error: 'no image' }, 400);

    if (env.ANTHROPIC_API_KEY) {
      const custom = cleanCustom(body.custom), cm = String(body.closeup || '').match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
      const prompt = PROMPT + customText(custom) + SINGLE_EXTRA + measuredText(body.measured) + correctionsText(body.corrections);
      const c = await tagWithClaude(env, image, { schema: tagSchema(custom, true), prompt, closeup: cm, effort: 'medium', maxTokens: 12000 });
      if (c.status === 200) c.body = cleanTag(c.body);
      return json(c.body, c.status);
    }
    if (!env.AI) return json({ error: 'ai', detail: 'Set an ANTHROPIC_API_KEY secret (or add a Workers AI binding named AI) on the worker.' }, 501);

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

    let out;
    try {
      out = await env.AI.run(model, input);
    } catch (e) {
      // Llama 3.2 Vision is gated: the account must accept Meta's licence once (error 5016). Do that and retry.
      if (/5016|agree/i.test(String(e && e.message))) {
        await env.AI.run(model, { prompt: 'agree' });
        try { out = await env.AI.run(model, input); }
        catch (e2) { return json({ error: 'ai', detail: String(e2 && e2.message) }, 502); }
      } else {
        return json({ error: 'ai', detail: String(e && e.message) }, 502);
      }
    }

    const raw = out && out.response;
    console.log(`tagged by Workers AI (${model})`);
    if (raw && typeof raw === 'object') return json({ ...raw, model });
    const text = String(raw || '');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: 'no json in model output', detail: text.slice(0, 300) }, 502);
    try { return json({ ...JSON.parse(m[0]), model }); }
    catch { return json({ error: 'unparseable model output', detail: m[0].slice(0, 300) }, 502); }
  },
  // Cloudflare Queue consumer (queue "wardrobe-renders", see wrangler.toml): background outfit photos
  async queue(batch, env) {
    for (const msg of batch.messages) {
      try { await runRenderJob(msg, env); }
      catch (e) {
        console.log('photo job error', e && e.message);
        // a job that keeps crashing is recorded as failed (the queue would otherwise drop it silently and leave it "pending")
        const key = String(msg.body && msg.body.key || '');
        if ((msg.attempts || 1) < 4 || !COMBO_RE.test(key)) { msg.retry({ delaySeconds: 60 }); continue; }
        try { const error = 'The worker failed making it: ' + String(e && e.message || e);
          await env.WARDROBE.put(`jobfail:${key}`, JSON.stringify({ error, t: Date.now() }), FAIL_TTL); await env.WARDROBE.delete(`job:${key}`); await tellHub(env, { key, error }); } catch {}
        msg.ack();
      }
    }
  },
};
