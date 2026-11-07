// Cloudflare Worker (Workers AI) for photo recognition.
//
// Bindings / variables (Worker > Settings):
//   AI              Workers AI binding, variable name "AI"   (required)
//   APP_TOKEN       secret; must match the App Token in the app's settings (recommended — without it anyone can use your quota)
//   ALLOWED_ORIGIN  e.g. https://YOURNAME.github.io          (optional; omit to allow any origin)
//   MODEL           optional, defaults to @cf/meta/llama-3.2-11b-vision-instruct
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
  black, charcoal, darkgrey, grey, lightgrey, white, cream, lightblue, blue, navy, brown, tan, olive, green, burgundy, oxblood, red,
  purple, pink, gold, silver
  (charcoal is near-black grey; darkgrey sits between charcoal and grey; lightgrey is pale grey; oxblood is a deep brownish red,
  the colour of cordovan "color 8" shoes, darker and browner than burgundy)

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

/* GET /sync returns the stored backup {rev, saved, data}; PUT /sync {baseRev, data} stores a new one.
   baseRev must equal the stored rev, otherwise 409 with the current backup so the app can merge and retry
   (two devices syncing at once never overwrite each other). */
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
    if (new URL(req.url).pathname.replace(/\/+$/, '') === '/sync') return handleSync(req, env, json);
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
