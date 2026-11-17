// What an app that sends no `types` (an older app) gets from the tagger: the requests the worker sends to Claude and to Workers AI for
// the plain single tag, the picker's two calls, /tag-many and the fallback, recorded with stubs (nothing paid). tests/tagger.test.js
// compares them with tests/fixtures/garmentworker-old.json, recorded from main before the new garments (2026-11-16); run this file with
// `node tests/garmentworker-calls.js --write` only to record a deliberate change to what an older app is sent.
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
async function oldCalls(ROOT, extra = {}) {
  const worker = (await import(pathToFileURL(path.join(ROOT, 'worker.js')).href)).default;
  const realFetch = globalThis.fetch; let sent = [];
  globalThis.fetch = async (href, init) => {
    if (String(href) !== 'https://api.anthropic.com/v1/messages') return new Response('', { status: 404 });
    const b = JSON.parse(init.body); sent.push(b);
    const a = b.output_config.format.schema.required.includes('items') ? { items: [] } : { type: 'suit', primaryColor: 'navy', secondaryColor: 'none', tertiaryColor: 'none', pattern: 'solid' };
    return new Response(JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(a) }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const out = {};
  try {
    const env = { APP_TOKEN: 't', ANTHROPIC_API_KEY: 'k', CLAUDE_RETRY_MS: '0' };
    const post = async (p, body, e = env) => { const r = await worker.fetch(new Request('https://w.test/' + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-token': 't' }, body: JSON.stringify(body) }), e); await r.text(); };
    const take = () => { const b = sent[0]; sent = []; return { system: b.system.map(s => s.text), schema: b.output_config.format.schema }; };
    await post('', { image: IMG, ...extra }); out.single = take();
    await post('', { image: IMG, freeColors: true, ...extra }); out.free = take();
    await post('', { image: IMG, freePattern: true, ...extra }); out.freePat = take();
    await post('tag-many', { image: IMG, ...extra }); out.many = take();
    let ai = null; const envAi = { APP_TOKEN: 't', AI: { run: async (m, input) => { ai = input; return { response: { type: 'suit' } }; } } };
    await post('', { image: IMG, ...extra }, envAi); out.workersAi = ai.messages[1].content[0].text;
  } finally { globalThis.fetch = realFetch; }
  return out;
}
module.exports = { oldCalls };
if (require.main === module && process.argv.includes('--write')) {
  const ROOT = path.join(__dirname, '..');
  oldCalls(ROOT).then(o => { fs.writeFileSync(path.join(__dirname, 'fixtures', 'garmentworker-old.json'), JSON.stringify(o)); console.log('written'); });
}
