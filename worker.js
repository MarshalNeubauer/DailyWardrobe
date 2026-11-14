// Cloudflare Worker for photo recognition (Claude API, or Workers AI as a fallback), backup/sync and photo links.
//
// Bindings / variables (Worker > Settings):
//   ANTHROPIC_API_KEY  secret; your Claude API key from platform.claude.com. When set, photos are tagged by Claude.
//   CLAUDE_MODEL    optional, defaults to claude-opus-5-5 (e.g. claude-sonnet-5-5 or claude-haiku-5-5 cost less)
//   AI              Workers AI binding, variable name "AI"   (used only when ANTHROPIC_API_KEY is not set)
//   APP_TOKEN       secret; the owner's token, the App Token in the app's settings. Required: without it every route refuses.
//                   Invited testers connect with a code of their own (POST /invites), each with their own storage and daily caps.
//   ALLOWED_ORIGIN  e.g. https://YOURNAME.github.io          (optional; omit to allow any origin; several: separate with commas)
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
// The routes live in worker/*.js (ES modules; Wrangler bundles them on deploy). This file is the entry: the route table, serve,
// CORS and the Worker's handlers (fetch, queue, scheduled). Split into modules on 2026-11-14.
import { FREE_EXTRA, FREE_PAT_EXTRA, SINGLE_EXTRA, TAG_INTRO, TAG_RULES, cleanCustom, cleanTag, correctionsText, customText, handleTagMany, measuredText, tagSchema, tagWithClaude, tagWithWorkersAi, wbOf } from './worker/tag.js';
import { handlePattern } from './worker/pattern.js';
import { handleFetchImage, readCapped } from './worker/links.js';
import { CLAIMED, PAID, failJob, handleRender, jobClaim, queueStatus, runRenderJob, waitForRenders } from './worker/render.js';
import { COMBO_RE, delRender, getRender, handleBlob, putRender } from './worker/records.js';
import { handleHolidays } from './worker/holidays.js';
import { gcDue, handleSync, photoGc } from './worker/photostore.js';
import { handleAccount, handleFeedback, handleInvites, handleMe, msgNs, plainFor, spend, unspend, whoIs } from './worker/people.js';
import { handlePush, sendReminders } from './worker/remind.js';
export { RenderHub } from './worker/render.js';   // the Durable Object class must be exported by the entry

/* every route but the root (POST / tags one photo, below): [handler(req, env, json, who, cors), what to say when APP_TOKEN is not set] */
const TAG_LIMIT = 15e6, UNSET = 'Set an APP_TOKEN secret on the worker: nothing runs without it.';
const ROUTES = {
  '* /sync': [(req, env, json, who, cors) => handleSync(req, env, json, cors, who), 'Set an APP_TOKEN secret on the worker to enable backups.'],
  'GET /render-queue': [queueStatus],
  'GET /render-wait': [waitForRenders],
  'GET /fetch': [(req, env, json, who, cors) => handleFetchImage(req, env, json, cors), 'Set an APP_TOKEN secret on the worker to fetch photo links.'],
  'GET /holidays': [handleHolidays, 'Set an APP_TOKEN secret on the worker to load holiday lists.'],
  'POST /tag-many': [handleTagMany, UNSET],
  'POST /pattern': [handlePattern, UNSET],
  'POST /render': [handleRender, 'Set an APP_TOKEN secret on the worker to generate photos.'],
  'GET /render': [getRender],
  'PUT /render': [putRender],
  'DELETE /render': [delRender],
  'GET /blob': [handleBlob],
  'PUT /blob': [handleBlob],
  'GET /me': [handleMe, UNSET],
  'GET /invites': [handleInvites, UNSET],
  'POST /invites': [handleInvites, UNSET],
  'DELETE /invites': [handleInvites, UNSET],
  'GET /feedback': [handleFeedback, UNSET],
  'GET /push': [handlePush, UNSET],
  'POST /push': [handlePush, UNSET],
  'POST /feedback': [handleFeedback, UNSET],
  'DELETE /account': [handleAccount, UNSET],
};

/* one request, routed (fetch() catches what it throws) */
async function serve(req, env, cors, allowed, origin) {
  let viewer = null, where = '';   // who is asking (set once known) and the route: a tester's answers are put in plain words
  const json = (body, status = 200) =>
    new Response(JSON.stringify(viewer && viewer.role === 'tester' ? plainFor(body, where) : body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (allowed.length && !allowed.includes(origin)) return json({ error: 'forbidden origin' }, 403);
  const path = new URL(req.url).pathname.replace(/\/+$/, ''); where = path;
  const deny = (a, unset) => json({ error: a.unset && unset || a.error, ...(a.message ? { message: a.message } : {}) }, a.status);
  const route = ROUTES[`${req.method} ${path}`] || ROUTES[`* ${path}`];
  if (route) {
    const a = await whoIs(env, req.headers.get('x-app-token') || '');
    viewer = a.who || a.offWho || null;
    if (!a.who && a.offWho && req.method === 'DELETE' && path === '/account') return route[0](req, env, json, a.offWho, cors);
    return a.who ? route[0](req, env, json, a.who, cors) : deny(a, route[1]);
  }
  // only POST / tags a photo: any other address is unknown (a POST to /holidayz used to be read as a photo and spent a Claude call),
  // and a known address asked with another method says so
  if (path !== '') return json({ error: 'not found' }, Object.keys(ROUTES).some(k => k.endsWith(' ' + path)) ? 405 : 404);
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // POST / : tag one photo. The token comes as the x-app-token header and is checked before the body (up to 15 MB) is read; the
  // body's appToken (sent by apps before 2026-11-12, beside the header) is no longer read
  const a = await whoIs(env, req.headers.get('x-app-token') || '');
  if (!a.who) return deny(a, UNSET);
  const who = a.who; viewer = who;
  if (+(req.headers.get('content-length') || 0) > TAG_LIMIT) return json({ error: 'photo too large', detail: 'That photo is too large (over 15 MB).' }, 413);
  const inBody = await readCapped(req.body, TAG_LIMIT);
  if (inBody.over) return json({ error: 'photo too large', detail: 'That photo is too large (over 15 MB).' }, 413);
  let body;
  try { body = JSON.parse(new TextDecoder().decode(inBody.bytes)); } catch { return json({ error: 'bad json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad json' }, 400);

  // The model wants the image as a data URI inside the user message.
  let image = String(body.image || '');
  if (image && !image.startsWith('data:')) image = `data:${body.media_type || 'image/jpeg'};base64,${image}`;
  if (!/^data:image\/[\w.+-]+;base64,/.test(image)) return json({ error: 'no image' }, 400);

  if (!env.ANTHROPIC_API_KEY && !env.AI) return json({ error: 'ai', detail: 'Set an ANTHROPIC_API_KEY secret (or add a Workers AI binding named AI) on the worker.' }, 501);
  const over = await spend(env, who, 'tag'); if (over) return json(over.body, over.status);
  if (env.ANTHROPIC_API_KEY) {
    const custom = cleanCustom(body.custom), cm = String(body.closeup || '').match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
    // never both: together the answer's schema is more than the API compiles ("compiled grammar is too large", 2026-11-13)
    const freePat = body.freePattern === true, free = body.freeColors === true && !freePat;
    // fixed (cached): the rules and the single-item extras; the owner's own (cached next): colours, patterns, corrections; per call:
    // the picker's extras and the measurement
    const c = await tagWithClaude(env, image, { schema: tagSchema(custom, true, free, freePat), prompt: TAG_INTRO + TAG_RULES + SINGLE_EXTRA,
      owner: customText(custom) + correctionsText(body.corrections), text: (free ? FREE_EXTRA : '') + (freePat ? FREE_PAT_EXTRA : '') + measuredText(body.measured),
      closeup: cm, wb: wbOf(body), effort: 'medium', maxTokens: 12000 });
    if (c.status === 200) c.body = cleanTag(c.body); else await unspend(env, who, 'tag');
    return json(c.body, c.status);
  }
  // Workers AI: any answer that is not a tag gives the tester's count back
  const r = await tagWithWorkersAi(env, image);
  if (r.status !== 200) await unspend(env, who, 'tag');
  return json(r.body, r.status);
}

/* the CORS headers for a request's Origin. ALLOWED_ORIGIN may list several origins, separated by commas; the one that matches is
   echoed. Max-Age: the browser keeps a preflight's answer 2 hours, so most calls skip the extra round trip (100-300 ms from Kuwait) */
function corsFor(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
  return { allowed, origin, cors: {
    'Access-Control-Allow-Origin': !allowed.length ? '*' : allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'content-type,x-app-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '7200',
    ...(allowed.length > 1 ? { Vary: 'Origin' } : {}),
  } };
}
/* what any uncaught error answers (a KV write over the day's allowance, a Durable Object restarting): a JSON 503 with the CORS
   headers, so the app reads a reason instead of "Failed to fetch" (Cloudflare's own error 1101 page carries no CORS headers) */
const SERVER_DOWN = 'The server had a problem just now. Try again in a moment.';
/* the day's allowance of KV writes used up (Cloudflare's free plan: 1,000 a day, reset at 00:00 UTC; 2026-11-14 the PC's picture uploads used
   it up and every backup answered SERVER_DOWN): a 429 that says so. what 'backup' for a save of the wardrobe, so the app pauses its
   uploads until the next UTC day and says why (sync.js), as for a tester's own backup limit; tools/asm-prebuild.js stops uploading too */
const KV_FULL = 'Today’s saves on the server are used up. Your changes are kept on this device and are saved after the daily reset (00:00 UTC).';
const kvFull = e => /limit exceeded/i.test(String(e && e.message || e));
export default {
  async fetch(req, env) {
    const { cors, allowed, origin } = corsFor(req, env);
    try { return await serve(req, env, cors, allowed, origin); }
    catch (e) {
      console.log('uncaught error', req.method, new URL(req.url).pathname, e && (e.stack || e.message));
      if (kvFull(e)) return new Response(JSON.stringify({ error: 'kv-limit', what: new URL(req.url).pathname.endsWith('/sync') ? 'backup' : 'write', message: KV_FULL }), { status: 429, headers: { ...cors, 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'server', message: SERVER_DOWN, detail: SERVER_DOWN }), { status: 503, headers: { ...cors, 'content-type': 'application/json' } });
    }
  },
  // Cloudflare Queue consumer (queue "wardrobe-renders", see wrangler.toml): background outfit photos
  async queue(batch, env) {
    for (const msg of batch.messages) {
      try { await runRenderJob(msg, env); }
      catch (e) {
        console.log('photo job error', e && e.message);
        // a job that keeps crashing is recorded as failed (the queue would otherwise drop it silently and leave it "pending")
        // after OpenAI made the photo nothing is retried (a retry pays again); before it, a crash is tried again after a minute
        if (PAID.has(msg)) { msg.ack(); continue; }
        const key = String(msg.body && msg.body.key || ''), ns = msgNs(msg);
        if (CLAIMED.has(msg)) await jobClaim(env, ns, key, 'release', CLAIMED.get(msg));   // its run is over: a retry may claim it again
        if ((msg.attempts || 1) < 4 || !COMBO_RE.test(key) || ns === null) { msg.retry({ delaySeconds: 60 }); continue; }
        let job = null; try { job = await env.WARDROBE.get(`${ns}job:${key}`, 'json'); } catch { }
        await failJob(env, ns, key, job, 'The worker failed making it: ' + String(e && e.message || e));
        await jobClaim(env, ns, key, 'done', job && +job.t || 0);
        msg.ack();
      }
    }
  },
  // Cron trigger (wrangler.toml [triggers], every 15 minutes): the morning reminders due now
  async scheduled(event, env, ctx) {
    const now = event && event.scheduledTime ? new Date(event.scheduledTime) : new Date();
    ctx.waitUntil(sendReminders(env, now));
    if (gcDue(now)) ctx.waitUntil(photoGc(env, now.getTime()));   // once a day: photos nothing refers to any more
  },
};

