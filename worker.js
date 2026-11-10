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
//   WARDROBE        KV namespace binding, variable name "WARDROBE": backup and sync of the wardrobe (optional;
//                   backups also require APP_TOKEN, so your wardrobe is never readable without the token)
//
// Pattern lists must stay in sync with PATS_BY in core.js.
/* colours each item type really comes in: [main colours, stripe / motif colours]. Must match COLS_BY in core.js. */
const SUITING = ['black','charcoal','darkgrey','grey','midgrey','lightgrey','navy','darknavy','deepblue','blue','steelblue','slate','brown','taupe','tan','khaki','olive','green'],
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
  which is a warmer, deeper camel brown; taupe is a greyish brown, between grey and tan; rust is a burnt orange-brown;
  ivory is a warm off-white, between white and cream; beige is a pale sandy tan; mint is a pale green; periwinkle is a soft
  blue with a violet cast, between lightblue and blue; grey for a tie clip or cufflinks means gunmetal)
  Judge shirt colours as in daylight: warm indoor light makes white look ivory and grey look beige.

secondaryColor — the colour of the stripe, check line, dot or motif, from the type's line colours (after the |). "none" if plain.
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
  'brown','tan','khaki','taupe','rust','olive','green','burgundy','wine','oxblood','red','purple','pink','gold','silver',
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
async function tagWithClaude(env, image, opts = {}) {
  const m = image.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
  if (!m) return { status: 400, body: { error: 'no image' } };
  const model = env.CLAUDE_MODEL || CLAUDE_DEFAULT;
  const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
  const body = {
    model,
    max_tokens: opts.maxTokens || 4000,    // thinking counts toward this; a single item's JSON is ~100 tokens
    output_config: { effort: opts.effort || 'low', format: { type: 'json_schema', schema: opts.schema || TAG_SCHEMA } },
    system: 'You are a menswear expert who labels clothing photos for a wardrobe app. Judge colours as the fabric would look in neutral daylight: correct for warm or cool lighting and shadows.',
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text: opts.prompt || PROMPT },
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
  const c = await tagWithClaude(env, String(body.image || ''), { schema: MULTI_SCHEMA, prompt: MULTI_PROMPT, maxTokens: 16000, effort: 'medium' });
  if (c.status !== 200) return json(c.body, c.status);
  const clamp = v => Math.max(0, Math.min(1000, Math.round(+v || 0)));
  const items = (Array.isArray(c.body.items) ? c.body.items : []).slice(0, 40).map(it => {
    const b = it.box || {}, x = clamp(b.x), y = clamp(b.y);
    return { ...it, box: { x, y, w: Math.max(1, Math.min(1000 - x, clamp(b.w))), h: Math.max(1, Math.min(1000 - y, clamp(b.h))) } };
  }).sort((a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2));
  console.log(`tagged ${items.length} items in one photo`);
  return json({ items, model: c.body.model });
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

/* POST /render {image, refs, outfit} -> {image: data URL, model}
   Turns the app's outfit illustration into a photorealistic picture with OpenAI's image edit API. The illustration
   fixes the pose and framing; photos of the actual items (refs) and the written outfit keep colours and patterns right. */
const RENDER_PROMPT = outfit => `Turn the first image (an illustration) into a photorealistic photograph.
Keep exactly the same pose, crop and framing: a man's torso from the chin down to the hips, no face; his forearms cross at the waist, one hand holds the jacket lapel next to the wristwatch, the other hand rests at the jacket button.
He is wearing: ${outfit}.
Every garment must keep the colour and pattern shown in the illustration${'{REFS}'}. Do not add, remove or change any item.
Real wool suiting with natural drape and texture, crisp cotton shirt, silk tie, realistic hands and skin.
Soft natural daylight, softly blurred bright office background, 50mm lens, editorial menswear photography. No added text, captions or watermark (printing on a watch dial stays as in its photo).`;
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
  return json({ image: r.rec.img, model: r.rec.model });
}
/* one realistic outfit photo from the app's inputs (the rasterised illustration, item photos, outfit text) via OpenAI's image edit;
   -> {ok, rec} or {ok:false, status, error, retry} (retry: worth trying again later: network, rate limit, OpenAI server error) */
const QUALITIES = ['low', 'medium', 'high'];
async function outfitPhoto(body, env) {
  const base = dataUrlToBlob(body.image);
  if (!base) return { ok: false, status: 400, error: 'no illustration' };
  const refs = (Array.isArray(body.refs) ? body.refs : []).slice(0, 6).map(dataUrlToBlob).filter(Boolean);
  const outfit = String(body.outfit || '').slice(0, 2500) || 'a suit, dress shirt and tie';
  const model = env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const form = new FormData();
  form.append('model', model);
  const labels = (Array.isArray(body.labels) ? body.labels : []).slice(0, refs.length).map(l => String(l).replace(/[^\w ,.:()'-]/g, '').slice(0, 160));
  const refText = !refs.length ? '' : labels.length === refs.length
    ? `. The photos after the illustration show the actual items, in this order: ${labels.join('; ')}. Match each one exactly`
    : ', and match the photos of the actual items that follow it';
  form.append('prompt', RENDER_PROMPT(outfit).replace('{REFS}', refText));
  form.append('image[]', base, 'outfit.png');
  refs.forEach((b, i) => form.append('image[]', b, `item-${i + 1}.${b.type.split('/')[1]}`));
  form.append('size', '1024x1024');
  form.append('quality', QUALITIES.includes(body.quality) ? body.quality : env.OPENAI_IMAGE_QUALITY || 'medium');
  form.append('output_format', 'jpeg');
  form.append('n', '1');
  let r;
  try { r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form }); }
  catch (e) { return { ok: false, status: 502, retry: true, error: 'Could not reach the OpenAI API: ' + String(e && e.message) }; }
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
  return { ok: true, rec: { sig: String(body.sig || ''), img: `data:image/jpeg;base64,${b64}`, model, t: Date.now() } };
}
/* ---- background photos: the app uploads each outfit's inputs once (POST /render {mode:'queue'}); they wait in KV as job:<key>
   and a Cloudflare Queue message ({key}) makes the photo later, so the app can be closed. GET /render-queue reports progress. ---- */
const JOB_TTL = { expirationTtl: 3 * 86400 }, FAIL_TTL = { expirationTtl: 7 * 86400 };
async function queueRender(body, env, json) {
  if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'Background photos need the RENDER_QUEUE and WARDROBE bindings on the worker.', noQueue: true }, 501);
  const key = String(body.key || '');
  if (!COMBO_RE.test(key)) return json({ error: 'bad key' }, 400);
  if (!dataUrlToBlob(body.image)) return json({ error: 'no illustration' }, 400);
  if (await env.WARDROBE.get(`render:${key}`)) return json({ queued: false, exists: true });
  const job = { key, image: body.image, refs: (Array.isArray(body.refs) ? body.refs : []).slice(0, 6), labels: (Array.isArray(body.labels) ? body.labels : []).slice(0, 6), outfit: String(body.outfit || '').slice(0, 2500), sig: String(body.sig || ''), quality: QUALITIES.includes(body.quality) ? body.quality : undefined, t: Date.now() };
  await env.WARDROBE.put(`job:${key}`, JSON.stringify(job), JOB_TTL);
  await env.WARDROBE.delete(`jobfail:${key}`);
  await env.RENDER_QUEUE.send({ key });
  return json({ queued: true });
}
async function queueStatus(req, env, json) {
  if (!env.APP_TOKEN || (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'no queue', noQueue: true }, 501);
  const pending = (await env.WARDROBE.list({ prefix: 'job:' })).keys.map(k => k.name.slice(4));
  const failed = [];
  for (const k of (await env.WARDROBE.list({ prefix: 'jobfail:' })).keys.slice(0, 50)) {
    const f = await env.WARDROBE.get(k.name, 'json'); failed.push({ key: k.name.slice(8), error: f && f.error || 'failed' });
  }
  return json({ pending, failed });
}
/* the queue consumer: one photo per message; temporary failures retry after a minute, others are recorded for the app */
async function runRenderJob(msg, env) {
  const key = String(msg.body && msg.body.key || '');
  const job = COMBO_RE.test(key) ? await env.WARDROBE.get(`job:${key}`, 'json') : null;
  if (!job) return msg.ack();
  if (await env.WARDROBE.get(`render:${key}`)) { await env.WARDROBE.delete(`job:${key}`); return msg.ack(); }
  if (!env.OPENAI_API_KEY) { await env.WARDROBE.put(`jobfail:${key}`, JSON.stringify({ error: 'Add an OPENAI_API_KEY secret to the worker.', t: Date.now() }), FAIL_TTL); await env.WARDROBE.delete(`job:${key}`); return msg.ack(); }
  const r = job.kind === 'item' ? await itemPhoto(job, env) : await outfitPhoto(job, env);
  if (r.ok) {
    await env.WARDROBE.put(`render:${key}`, JSON.stringify(r.rec));
    await env.WARDROBE.delete(`job:${key}`);
    return msg.ack();
  }
  if (r.retry && (msg.attempts || 1) < 4) return msg.retry({ delaySeconds: 60 });
  console.log(`photo ${key} failed: ${r.error}`);
  await env.WARDROBE.put(`jobfail:${key}`, JSON.stringify({ error: r.error, t: Date.now() }), FAIL_TTL);
  await env.WARDROBE.delete(`job:${key}`);
  msg.ack();
}
/* POST /render {mode:'item', item, key} -> a product photo of one accessory (shoes, belt, socks...), made from a short
   description with OpenAI's image generation, kept in KV under the item's look key like outfit photos */
const ITEM_PROMPT = item => `Studio product photograph of ${item}. Plain light warm-grey seamless background, soft even daylight,
the whole item centred and in frame, true-to-life colour and leather or fabric texture, sharp focus, catalogue style.
No person, no props, no text, no logos, no watermark.`;
const ITEM_REF_PROMPT = item => `Studio product photograph of the exact item in the reference photo: ${item}.
Recreate it faithfully, detail for detail: the same case or shape, proportions, materials and finish, the same dial or face layout,
markings, numerals, hands and printing, the same bracelet, strap or links. Do not redesign, simplify or add anything.
Show it on its own, off the wrist: plain light warm-grey seamless background, soft even daylight, centred and in frame, sharp focus,
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
const renderTtl = id => (DAY_RE.test(id) ? { expirationTtl: 90 * 86400 } : undefined);
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
/* GET /render?key=c... (or the older ?day=) -> the stored photo, or 404 */
async function getRender(req, env, json) {
  if (!env.APP_TOKEN || (req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.WARDROBE) return json({ error: 'no KV binding' }, 404);
  const q = new URL(req.url).searchParams;
  // GET /render?list=1 -> {keys}: every outfit or item photo kept here, so a device can download the ones it lacks in one go
  if (q.get('list')) {
    if (typeof env.WARDROBE.list !== 'function') return json({ error: 'listing not available' }, 501);
    const keys = []; let cursor;
    do { const page = await env.WARDROBE.list({ prefix: 'render:c', cursor }); for (const k of page.keys) keys.push(k.name.slice(7)); cursor = page.list_complete ? null : page.cursor; } while (cursor && keys.length < 20000);
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
async function handleSync(req, env, json, cors) {
  if (!env.APP_TOKEN) return json({ error: 'Set an APP_TOKEN secret on the worker to enable backups.' }, 403);
  if ((req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.WARDROBE) return json({ error: 'Add a KV namespace binding named WARDROBE to the worker to enable backups.' }, 501);
  if (req.method === 'GET') {
    const v = new URL(req.url).searchParams.get('v');
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
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return json({ error: 'forbidden origin' }, 403);
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (path === '/sync') return handleSync(req, env, json, cors);
    if (path === '/render-queue' && req.method === 'GET') return queueStatus(req, env, json);
    if (path === '/fetch' && req.method === 'GET') return handleFetchImage(req, env, json, cors);
    if (path === '/holidays' && req.method === 'GET') return handleHolidays(req, env, json);
    if (path === '/tag-many' && req.method === 'POST') return handleTagMany(req, env, json);
    if (path === '/render' && req.method === 'POST') return handleRender(req, env, json);
    if (path === '/render' && req.method === 'GET') return getRender(req, env, json);
    if (path === '/render' && req.method === 'PUT') return putRender(req, env, json);
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

    if (env.ANTHROPIC_API_KEY) { const c = await tagWithClaude(env, image); return json(c.body, c.status); }
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
      catch (e) { console.log('photo job error', e && e.message); msg.retry({ delaySeconds: 60 }); }
    }
  },
};
