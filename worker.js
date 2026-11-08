// Cloudflare Worker for photo recognition (Claude API, or Workers AI as a fallback), backup/sync and photo links.
//
// Bindings / variables (Worker > Settings):
//   ANTHROPIC_API_KEY  secret; your Claude API key from platform.claude.com. When set, photos are tagged by Claude.
//   CLAUDE_MODEL    optional, defaults to claude-opus-5-5 (e.g. claude-sonnet-5-5 or claude-haiku-5-5 cost less)
//   AI              Workers AI binding, variable name "AI"   (used only when ANTHROPIC_API_KEY is not set)
//   APP_TOKEN       secret; must match the App Token in the app's settings (recommended — without it anyone can use your quota)
//   ALLOWED_ORIGIN  e.g. https://YOURNAME.github.io          (optional; omit to allow any origin)
//   MODEL           optional Workers AI model, defaults to @cf/meta/llama-3.2-11b-vision-instruct
//   (GET /fetch?url=… also uses APP_TOKEN: it downloads photo links for the app)
//   WARDROBE        KV namespace binding, variable name "WARDROBE": backup and sync of the wardrobe (optional;
//                   backups also require APP_TOKEN, so your wardrobe is never readable without the token)
//
// Pattern lists must stay in sync with PATS_BY in index.html.
const PROMPT = `Identify the single clothing item in this photo. Reply with one JSON object only, no prose, no code fences:
{"type":"...","primaryColor":"...","secondaryColor":"...","tertiaryColor":"...","pattern":"...","metal":"...","leather":"...","dial":"...","band":"...","bezel":"..."}

type — one of:
  suit (suit jacket, or a jacket and trousers of the same cloth), blazer (odd jacket / sport coat), pants (dress trousers),
  shirt (dress shirt), tie, tieclip, watch, shoes, belt, socks, cufflinks, overcoat (wool topcoat), raincoat (trench or mac)

primaryColor — the dominant colour of the main fabric (the leather for shoes and belts, the strap for watches). One of:
  black, charcoal, darkgrey, grey, midgrey, lightgrey, white, cream, lightblue, blue, steelblue, deepblue, navy, darknavy, slate,
  brown, tan, olive, green, burgundy, wine, oxblood, red, purple, pink, gold, silver
  (charcoal is near-black grey; darkgrey sits between charcoal and grey; midgrey is a medium grey, between grey and lightgrey;
  lightgrey is pale grey; steelblue is a dusty, greyed mid blue (denim-like); deepblue is a rich, saturated dark blue, brighter
  than navy; darknavy is navy so dark it is almost black; slate is a dark blue-grey, greyer than navy and bluer than charcoal;
  wine is a red-leaning burgundy; oxblood is a deep brownish red, the colour of cordovan "color 8" shoes, darker and browner
  than burgundy)

secondaryColor — the colour of the stripe, check line, dot or motif, from the same list. "none" if the item is plain.
tertiaryColor — a third distinct colour in the pattern (e.g. the second line colour of a tattersall), or "none".

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
    solid, stripe (bold or bengal stripe), pinstripe (thin lines), gingham (even two-colour checks), tattersall (thin lines of two
    alternating colours forming checks), check (any other check or plaid), herringbone, oxford (basket-weave texture), twill, other
  tie:
    solid, stripe (diagonal/regimental), polka-dot, paisley, check, foulard (small repeating geometric motif), knit, other
  tieclip, watch, shoes, belt, socks, cufflinks, overcoat, raincoat: solid

Use "solid" for suits, blazers and trousers whose weave is only visible up close and does not match a listed pattern.

metal — for tieclip, watch, cufflinks and belt (the buckle): gold, silver or other (the case and bracelet metal for watches). Otherwise null.

leather — shoes and belts: calf (smooth, moderate shine), cordovan (dense, deep glossy shine with rolling creases), suede (matte napped),
  patent (mirror gloss), pebble-grain (large tumbled grain), scotch-grain (fine embossed grain). Otherwise null.

dial, band, bezel — watches only, otherwise null:
  dial: the dial colour, from the colour list above.
  band: bracelet (metal links) or leather (strap).
  bezel: fluted (finely ridged ring around the crystal) or smooth.`;

const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/* ---- Claude API ---- */
const CLAUDE_DEFAULT = 'claude-opus-5-5';
const COLOR_LIST = ['black','charcoal','darkgrey','grey','midgrey','lightgrey','white','cream','lightblue','blue','steelblue','deepblue','navy','darknavy','slate',
  'brown','tan','olive','green','burgundy','wine','oxblood','red','purple','pink','gold','silver'];
const TYPE_LIST = ['suit','blazer','pants','shirt','tie','tieclip','watch','shoes','belt','socks','cufflinks','overcoat','raincoat'];
const PATTERN_LIST = ['solid','pinstripe','chalk-stripe','herringbone','birdseye','nailhead','sharkskin','houndstooth','glen-check','windowpane','tweed','twill',
  'stripe','gingham','tattersall','check','oxford','polka-dot','paisley','foulard','knit','other'];
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
    dial: orNull(COLOR_LIST),
    band: orNull(['bracelet','leather']),
    bezel: orNull(['fluted','smooth']),
  },
};
async function tagWithClaude(env, image) {
  const m = image.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
  if (!m) return { status: 400, body: { error: 'no image' } };
  const model = env.CLAUDE_MODEL || CLAUDE_DEFAULT;
  const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
  const body = {
    model,
    max_tokens: 4000,                      // thinking counts toward this; the JSON itself is ~100 tokens
    output_config: { effort: 'low', format: { type: 'json_schema', schema: TAG_SCHEMA } },
    system: 'You are a menswear expert who labels clothing photos for a wardrobe app. Judge colours as the fabric would look in neutral daylight: correct for warm or cool lighting and shadows.',
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text: PROMPT },
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
  try { return { status: 200, body: { ...JSON.parse(text), model: out.model } }; }
  catch { return { status: 502, body: { error: 'unparseable model output', detail: text.slice(0, 300) } }; }
}

/* GET /sync returns the stored backup {rev, saved, data}; PUT /sync {baseRev, data} stores a new one.
   baseRev must equal the stored rev, otherwise 409 with the current backup so the app can merge and retry
   (two devices syncing at once never overwrite each other). */
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

const SYNC_KEY = 'wardrobe:v1';
async function handleSync(req, env, json) {
  if (!env.APP_TOKEN) return json({ error: 'Set an APP_TOKEN secret on the worker to enable backups.' }, 403);
  if ((req.headers.get('x-app-token') || '') !== env.APP_TOKEN) return json({ error: 'forbidden token' }, 403);
  if (!env.WARDROBE) return json({ error: 'Add a KV namespace binding named WARDROBE to the worker to enable backups.' }, 501);
  if (req.method === 'GET') {
    const stored = await env.WARDROBE.get(SYNC_KEY, 'json');
    return json(stored || { rev: 0, saved: 0, data: null });
  }
  if (req.method === 'PUT') {
    const text = await req.text();
    if (text.length > 24 * 1024 * 1024) return json({ error: 'backup too large (over 24 MB)' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
    const cur = (await env.WARDROBE.get(SYNC_KEY, 'json')) || { rev: 0, saved: 0, data: null };
    if ((body.baseRev ?? -1) !== cur.rev) return json({ error: 'conflict', ...cur }, 409);
    const next = { rev: cur.rev + 1, saved: Date.now(), data: body.data };
    await env.WARDROBE.put(SYNC_KEY, JSON.stringify(next));
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
    if (path === '/sync') return handleSync(req, env, json);
    if (path === '/fetch' && req.method === 'GET') return handleFetchImage(req, env, json, cors);
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
    if (raw && typeof raw === 'object') return json(raw);
    const text = String(raw || '');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: 'no json in model output', detail: text.slice(0, 300) }, 502);
    try { return json(JSON.parse(m[0])); }
    catch { return json({ error: 'unparseable model output', detail: m[0].slice(0, 300) }, 502); }
  },
};
