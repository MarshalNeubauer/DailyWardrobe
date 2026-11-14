/* Daily Wardrobe worker: POST /render (item pictures only) and RenderHub, the Durable Object that counts each tester's day.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.)
   The outfit photo made with OpenAI from the app's drawing, its background queue (job:/jobrun:/jobfail:, GET /render-queue) and the
   push to an open app (GET /render-wait) were removed on 2026-11-14, after the app stopped asking for them (#415-#420). Outfit photos
   kept from before are still read and written with GET/PUT /render (records.js). */
import { renderItem } from './items.js';
import { DAY_KEY, USE_RE } from './people.js';

/* POST /render {mode:'item', item, key, ref?} -> {image: data URL, model}: a product picture of one accessory (worker/items.js).
   Anything else is an outfit photo, which is no longer made: 410 */
async function handleRender(req, env, json, who) {
  const text = await req.text();
  if (text.length > 20e6) return json({ error: 'request too large' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  if (!body || body.mode !== 'item') return json({ error: 'gone', message: 'Outfit photos are no longer made: the app paints every outfit itself.' }, 410);
  if (!env.OPENAI_API_KEY) return json({ error: 'Add an OPENAI_API_KEY secret to the worker to generate item pictures.' }, 501);
  return renderItem(body, env, json, who);
}
function dataUrlToBlob(u) {
  const m = String(u || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
  if (!m) return null;
  const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
/* the time an item picture may take at OpenAI */
const OPENAI_MS = 300000;

/* one RenderHub per person: the owner's is the one named 'renders'; a tester's is 'renders:u:<id>:'. It keeps the tester's day's use
   (people.js useCount) and the "switched off" mark. (The name is from when it also handed finished outfit photos to an open app.) */
const hubOf = (env, ns = '') => env.RENDER_HUB && env.RENDER_HUB.get(env.RENDER_HUB.idFromName('renders' + (ns ? ':' + ns : '')));
export class RenderHub {
  constructor(ctx, env) { this.ctx = ctx; this.mem = new Map(); }
  /* the day's use and the "switched off" mark are kept in the object's own storage (no KV write per AI call); where a test or an
     old binding gives no storage, in memory */
  async sget(k) { const s = this.ctx && this.ctx.storage; return s ? await s.get(k) : this.mem.get(k); }
  async sput(k, v) { const s = this.ctx && this.ctx.storage; if (s) await s.put(k, v); else this.mem.set(k, v); }
  async fetch(req) {
    const u = new URL(req.url);
    const out = b => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
    // POST /use {what, n, cap, day}: count n of `what` for that UTC day unless it would pass the cap -> {ok, used}; n < 0 gives back
    // (only for the day being counted). One object handles one request at a time, so two calls at once can't both take the last one.
    if (u.pathname === '/use') {
      const m = await req.json().catch(() => null); if (!m || !USE_RE.test(String(m.what || '')) || !DAY_KEY.test(String(m.day || ''))) return out({ ok: false, bad: true });
      if (await this.sget('off')) return out({ ok: false, off: true });
      let use = await this.sget('use'); if (!use || use.day !== m.day) { if (m.n < 0) return out({ ok: true, used: 0 }); use = { day: m.day, n: {} }; }
      const have = +use.n[m.what] || 0, n = Math.round(+m.n) || 0;
      if (n > 0 && have + n > +m.cap) return out({ ok: false, used: have });
      use.n[m.what] = Math.max(0, have + n); await this.sput('use', use);
      return out({ ok: true, used: use.n[m.what] });
    }
    if (u.pathname === '/used') { const use = await this.sget('use'); return out({ used: use && use.day === u.searchParams.get('day') ? use.n : {}, off: !!(await this.sget('off')) }); }
    if (u.pathname === '/off') { await this.sput('off', true); return out({ ok: true }); }   // an invitation switched off: no more AI calls, at once
    if (u.pathname === '/wipe') {   // the account was deleted (also clears any job records left from the retired outfit-photo queue)
      this.mem.clear(); const s = this.ctx && this.ctx.storage; if (s && s.deleteAll) await s.deleteAll();
      if (u.searchParams.get('off')) await this.sput('off', true);
      return out({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }
}

export { OPENAI_MS, dataUrlToBlob, handleRender, hubOf };
