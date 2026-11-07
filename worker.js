// Cloudflare Worker: keeps your Anthropic API key off GitHub.
// Environment: ANTHROPIC_API_KEY (secret), APP_TOKEN (secret), ALLOWED_ORIGIN (e.g. https://YOURNAME.github.io), MODEL (optional)
//
// Pattern lists must stay in sync with PATS_BY in index.html.
const PROMPT = `Identify the single clothing item in this photo. Reply with one JSON object only, no prose, no code fences:
{"type":"...","primaryColor":"...","secondaryColor":"...","tertiaryColor":"...","pattern":"...","metal":"..."}

type — one of:
  suit (suit jacket, or a jacket and trousers of the same cloth), blazer (odd jacket / sport coat), pants (dress trousers),
  shirt (dress shirt), tie, tieclip, watch, shoes, belt, socks

primaryColor — the dominant colour of the main fabric (the leather for shoes and belts, the strap for watches). One of:
  black, charcoal, grey, white, cream, lightblue, blue, navy, brown, tan, olive, green, burgundy, red, purple, pink, gold, silver

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
  tieclip, watch, shoes, belt, socks: solid

Use "solid" for suits, blazers and trousers whose weave is only visible up close and does not match a listed pattern.

metal — for tieclip and watch: gold, silver or other. Otherwise null.`;

const json = (body, cors, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'content-type,x-app-token',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ error: 'forbidden' }, cors, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, cors, 400); }

    // The app sends the token both as a header and in the body.
    const token = req.headers.get('x-app-token') || body.appToken;
    if (token !== env.APP_TOKEN) return json({ error: 'forbidden' }, cors, 403);

    // Accept either a data URL ("data:image/jpeg;base64,...") or raw base64 plus media_type.
    let data = String(body.image || ''), media_type = body.media_type || 'image/jpeg';
    const du = /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(data);
    if (du) { media_type = du[1]; data = du[2]; }
    if (!data) return json({ error: 'no image' }, cors, 400);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: env.MODEL || 'claude-sonnet-5-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: 'upstream', detail: j.error?.message || r.status }, cors, 502);
    const text = (j.content || []).map(c => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    return json(m ? m[0] : '{}', cors);
  },
};
