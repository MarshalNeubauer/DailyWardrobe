// Cloudflare Worker: keeps your Anthropic API key off GitHub.
// Environment: ANTHROPIC_API_KEY (secret), APP_TOKEN (secret), ALLOWED_ORIGIN (e.g. https://YOURNAME.github.io), MODEL (optional)
const PROMPT = `Identify the single clothing item in this photo. Reply with JSON only:
{"type":"suit|blazer|pants|shirt|tie|tieclip|watch|shoes|belt|socks","color":"black|charcoal|grey|white|cream|lightblue|blue|navy|brown|tan|olive|green|burgundy|red|purple|pink|gold|silver","pattern":"solid|texture|stripe|check|other","metal":"gold|silver|other|null"}
"pants" means dress pants, "shirt" means dress shirt. Color and pattern describe the main fabric (the leather for shoes and belts). "metal" applies only to watches and tie clips.`;

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'content-type,x-app-token',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || req.headers.get('Origin') !== env.ALLOWED_ORIGIN ||
        req.headers.get('x-app-token') !== env.APP_TOKEN) {
      return new Response('forbidden', { status: 403, headers: cors });
    }
    const { image, media_type } = await req.json();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: env.MODEL || 'claude-sonnet-5-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data: image } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    });
    const j = await r.json();
    const text = (j.content || []).map(c => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    return new Response(m ? m[0] : '{}', { headers: { ...cors, 'content-type': 'application/json' } });
  },
};
