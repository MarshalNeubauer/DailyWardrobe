/* Daily Wardrobe worker: outfit photos: POST /render (OpenAI image edit), the background queue and its jobs, and the push to an open app (RenderHub).
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { itemPhoto, renderItem } from './items.js';
import { COMBO_RE, renderId, renderTtl } from './records.js';
import { DAY_KEY, JOB_WRITES, USE_RE, failFor, msgNs, photoCap, refundJob, runWipe, spendEach, unspend, utcDay } from './people.js';

/* POST /render {image, refs, outfit, nojacket?} -> {image: data URL, model}
   Turns the app's outfit illustration into a photorealistic picture with OpenAI's image edit API. The illustration
   fixes the pose and framing; photos of the actual items (refs) and the written outfit keep colours and patterns right. */
/* the room behind him, spelled out: "bright office background" came back as blown-out windows, harsh and different every time */
const BACKDROP = 'Soft natural daylight from the left, gentle shadows. The background is far out of focus, a smooth creamy blur with no sharp detail anywhere: a plain light office wall in soft off-white and pale warm grey, evenly lit, light but not glowing and not blown out; at the lower right the blurred corner of a light wooden desk with a dark laptop on it; along the far left edge a soft, slightly brighter strip of daylight. Nothing else behind him: no rows of desks, no chairs, no shelves, no lamps, no plants, no people.';
/* the watch in its own short sentence, early: at the end of the outfit list, after a long description, the generator drew a stock
   chronograph. The app puts the watch's own photo on the illustration's wrist (figureSvg photo:true) and sends the watch first */
const WATCH_KEY = outfit => /wristwatch/.test(outfit) ? `The wristwatch is a key detail. Its face in the illustration is the real watch's photo, already turned as worn: keep that dial as it is there, the same subdials in the same places and sizes, the same hands and markings, only made photorealistic. Do not draw a typical chronograph.
` : '';
/* a watch is mentioned only when the outfit has one (the app lists it as "a … wristwatch"); without, the hand is bare and the
   generator is told so, or it drew a stock watch on the wrist */
const hasWatch = outfit => /wristwatch/.test(outfit);
const NO_WATCH = 'He wears no wristwatch: both wrists are bare, only the shirt cuffs show.\n';
const DIAL_NOTE = outfit => (hasWatch(outfit) ? ' (printing on a watch dial stays as in its photo)' : '');
const RENDER_PROMPT = (outfit, nojacket) => nojacket ? `Turn the first image (an illustration) into a photorealistic photograph.
Keep exactly the same pose, crop and framing: a man's torso from the chin down to the hips, no face, in shirt sleeves with no jacket; his forearms cross at the waist, one hand rests on his chest${hasWatch(outfit) ? ' next to the wristwatch' : ''}, the other hand rests at his waist.
${hasWatch(outfit) ? WATCH_KEY(outfit) : NO_WATCH}He is wearing: ${outfit}.
Every garment must keep the colour and pattern shown in the illustration${'{REFS}'}. Do not add, remove or change any item: no jacket, and no tie unless one is listed.
A crisp cotton dress shirt with natural folds, buttoned cuffs, realistic hands and skin.
${BACKDROP} 50mm lens, editorial menswear photography. No added text, captions or watermark${DIAL_NOTE(outfit)}.`
  : `Turn the first image (an illustration) into a photorealistic photograph.
Keep exactly the same pose, crop and framing: a man's torso from just under the chin down to just below the jacket pocket flaps, no face, both shoulders and both elbows fully inside the picture, with a narrow strip of background visible at either side of the arms exactly as in the illustration; his left forearm lies across his chest, the hand a loose fist on the jacket front${hasWatch(outfit) ? " with the wristwatch on that wrist facing the camera, worn the usual way for a left wrist: its crown and pushers point toward the hand, so the camera sees the dial turned half a turn, 12 o'clock at the bottom and 6 o'clock at the top, exactly as the watch's photos after the illustration are turned" : ''}; his other hand is raised to the jacket's waist button, fastening it, directly under the first wrist so that it almost touches that cuff.
${hasWatch(outfit) ? WATCH_KEY(outfit) : NO_WATCH}He is wearing: ${outfit}.
Every garment must keep the colour and pattern shown in the illustration${'{REFS}'}. Do not add, remove or change any item.
Real wool suiting with natural drape and texture, crisp cotton shirt, a silk tie if one is listed (if none is listed he wears no tie: the shirt collar is open, the top button undone), realistic hands and skin.
${BACKDROP} 50mm lens, editorial menswear photography. No added text, captions or watermark${DIAL_NOTE(outfit)}.`;
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
This is a reference photo that other photos are edited from. The shirt is plain, with a classic spread collar and plain barrel cuffs showing at both wrists. No waistcoat, tie bar, tie clip, pocket square, lapel pin or cufflinks.`;
function dataUrlToBlob(u) {
  const m = String(u || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
  if (!m) return null;
  const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
async function handleRender(req, env, json, who) {
  if (!env.OPENAI_API_KEY) return json({ error: 'Add an OPENAI_API_KEY secret to the worker to generate realistic photos.' }, 501);
  const text = await req.text();
  if (text.length > 20e6) return json({ error: 'request too large' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
  // an invited tester gets the server's own model and quality: a request of theirs can't pick a dearer one
  if (who.role !== 'owner') { delete body.model; delete body.quality; delete body.complexity; delete body.size; }
  if (body.mode === 'item') return renderItem(body, env, json, who);
  if (body.mode === 'queue') return queueRender(body, env, json, who);
  const what = photoCap(body), over = await spendEach(env, who, [[what, 1], ['write', 1]]); if (over) return json(over.body, over.status);
  const r = await outfitPhoto(body, env, who.ns);
  if (!r.ok) { await unspend(env, who, what); await unspend(env, who, 'write'); return json({ error: r.error }, r.status); }
  // keep a copy per outfit combination so it is reused on any day and shown on every device (GET /render?key=...)
  const id = renderId(body);
  if (env.WARDROBE && id) await env.WARDROBE.put(`${who.ns}render:${id}`, JSON.stringify(r.rec), renderTtl(id));
  return json({ image: r.rec.img, model: r.rec.model, usage: r.usage });   // usage: OpenAI's token counts for this photo
}
/* one realistic outfit photo from the app's inputs (the rasterised illustration, item photos, outfit text) via OpenAI's image edit;
   -> {ok, rec} or {ok:false, status, error, retry} (retry: worth trying again later: network, rate limit, OpenAI server error) */
const QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max'];   // xhigh and max: GPT Image 2.5 and later
/* a request may name its own image model (to try a newer one under a test key) and, for GPT Image 2.6, a complexity */
const IMG_MODEL_RE = /^gpt-image-[a-z0-9.-]{1,40}$/, COMPLEXITIES = ['low', 'medium', 'high'];
/* the size a request may ask for (the owner's only, like model and quality): a piece of an assembled picture is an edit of the
   master and must come back at the master's size; anything else is 1024x1024 as before. 2048 at medium measured 3568 output
   tokens against 1756 at 1024 (2026-11-12) */
const IMG_SIZES = ['1024x1024', '1536x1536', '2048x2048'];
const OPENAI_MS = 300000;
async function outfitPhoto(body, env, ns = '') {
  let base = dataUrlToBlob(body.image);
  // baseKey: edit a photo kept here (an item's piece is an edit of the master), so the app doesn't upload the master with every piece
  if (!base && COMBO_RE.test(String(body.baseKey || '')) && env.WARDROBE) {
    const kept = await env.WARDROBE.get(`${ns}render:${body.baseKey}`, 'json');
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
  form.append('size', IMG_SIZES.includes(body.size) ? body.size : '1024x1024');
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
async function queueRender(body, env, json, who) {
  const ns = who.ns;
  if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'Background photos need the RENDER_QUEUE and WARDROBE bindings on the worker.', noQueue: true }, 501);
  const key = String(body.key || '');
  if (!COMBO_RE.test(key)) return json({ error: 'bad key' }, 400);
  if (!dataUrlToBlob(body.image) && !COMBO_RE.test(String(body.baseKey || ''))) return json({ error: 'no illustration' }, 400);
  if (!body.replace && await env.WARDROBE.get(`${ns}render:${key}`)) return json({ queued: false, exists: true });   // replace: a regenerate from the app
  const what = photoCap(body), day = utcDay(), over = await spendEach(env, who, [[what, 1], ['write', JOB_WRITES]], day); if (over) return json(over.body, over.status);
  const job = { key, image: body.image, refs: (Array.isArray(body.refs) ? body.refs : []).slice(0, 8), labels: (Array.isArray(body.labels) ? body.labels : []).slice(0, 8), outfit: String(body.outfit || '').slice(0, 2500), sig: String(body.sig || ''), quality: QUALITIES.includes(body.quality) ? body.quality : undefined, nojacket: !!body.nojacket || undefined,
    model: IMG_MODEL_RE.test(String(body.model || '')) ? body.model : undefined, complexity: COMPLEXITIES.includes(body.complexity) ? body.complexity : undefined, size: IMG_SIZES.includes(body.size) ? body.size : undefined, replace: body.replace ? true : undefined, t: Date.now(),
    ...(body.swap ? { swap: body.swap, mask: body.mask, markup: body.markup } : {}),   // a one-piece edit of a kept photo
    ...(COMBO_RE.test(String(body.baseKey || '')) ? { baseKey: body.baseKey } : {}), ...(body.master ? { master: true } : {}),
    ...(who.caps ? { cap: what, capDay: day } : {}) };   // a tester's job remembers what it counted as, to give it back if it can't be made
  await env.WARDROBE.put(`${ns}job:${key}`, JSON.stringify(job), JOB_TTL);
  await dropFail(env, ns, key);
  await env.WARDROBE.put(`${ns}jobrun:${key}`, JSON.stringify({ attempts: 0, at: Date.now() }), JOB_TTL);   // queued, not started (GET /render-queue resends it if it never starts)
  await env.RENDER_QUEUE.send(jobMsg(key, ns));
  return json({ queued: true });
}
/* the queue's message: {key} for the owner, as it always was, and {key, ns} for a tester, so the consumer reads and writes that
   person's keys (a message without ns is the owner's) */
const jobMsg = (key, ns) => (ns ? { key, ns } : { key });
/* an earlier failure of this photo is forgotten when it is queued again. KV counts a delete as one of the day's 1,000 writes even
   when there was nothing to delete, so it is looked for first (reads are plentiful) */
async function dropFail(env, ns, key) { if (await env.WARDROBE.get(`${ns}jobfail:${key}`)) await env.WARDROBE.delete(`${ns}jobfail:${key}`); }
const LOST_JOB_MS = 6 * 3600000;
/* a run's hold on its job (RenderHub job-claim): the OpenAI limit and two minutes; a job made or given up stays marked as long as
   its records live, so a late copy of its message does nothing */
const CLAIM_MS = OPENAI_MS + 120000, DONE_MS = 3 * 86400000;
async function queueStatus(req, env, json, who) {
  const ns = who.ns;
  if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'no queue', noQueue: true }, 501);
  // The app names the photos it waits for (?keys=a,b): each is looked up with reads, never a KV list. Lists are capped at 1,000 a
  // day on the free plan, and polling with two lists a time used them up, after which every list threw (error 1101) until midnight UTC.
  // Without keys (an older app) the lists are tried, and their failure is reported, not thrown.
  const want = String(new URL(req.url).searchParams.get('keys') || '').split(',').filter(k => COMBO_RE.test(k)).slice(0, 40);
  let pending, failedByKey = null;
  if (want.length) {
    pending = []; failedByKey = [];
    for (const k of want) {
      const f = await env.WARDROBE.get(`${ns}jobfail:${k}`, 'json'); if (f) { failedByKey.push({ key: k, error: f.error || 'failed' }); continue; }
      if (await env.WARDROBE.get(`${ns}jobrun:${k}`) || await env.WARDROBE.get(`${ns}job:${k}`)) pending.push(k);
    }
  } else if (ns) {
    return json({ pending: [], running: {}, failed: [] });   // a tester's app always names its photos: no KV list is spent on it
  } else {
    try { pending = (await env.WARDROBE.list({ prefix: 'job:' })).keys.map(k => k.name.slice(4)); }
    catch (e) { return json({ error: 'The worker has used up its daily KV list allowance; update the app.', detail: String(e && e.message) }, 503); }
  }
  // how far each waiting photo got: attempts so far and when the last began (none yet: its message hasn't been taken). Nothing is
  // sent again or written here: a job waiting behind others (two run at a time) is not lost, the queue delivers every message and
  // redelivers one whose run was cut off, and a re-send made a second paid photo (the 2026-11-13 audit). A job no message has
  // touched for LOST_JOB_MS is reported as failed (nothing is deleted: if it still runs, its photo is kept)
  const running = {}, now = Date.now(), lost = [];
  for (const k of pending.slice(0, 20)) {
    let r = await env.WARDROBE.get(`${ns}jobrun:${k}`, 'json');
    if (!r) { const j = await env.WARDROBE.get(`${ns}job:${k}`, 'json'); if (!j) continue; r = { attempts: 0, at: +j.t || now }; }   // a job from before jobrun
    if (now - (+r.at || 0) > LOST_JOB_MS) { lost.push(k); continue; }
    running[k] = r;
  }
  if (lost.length) pending = pending.filter(k => !lost.includes(k));
  let failed = failedByKey;
  if (failed) for (const k of lost) failed.push({ key: k, error: failFor(ns, 'The worker couldn’t get this photo made. Try again.') });
  if (!failed) { failed = [];
    try { for (const k of ns ? [] : (await env.WARDROBE.list({ prefix: 'jobfail:' })).keys.slice(0, 50)) { const f = await env.WARDROBE.get(k.name, 'json'); failed.push({ key: k.name.slice(8), error: f && f.error || 'failed' }); } }
    catch { } }
  return json({ pending, running, failed });
}
/* the queue consumer: one photo per message; temporary failures retry after a minute, others are recorded for the app */
async function runRenderJob(msg, env) {
  if (msg.body && msg.body.wipe) return runWipe(msg, env);   // the rest of a deleted account (DELETE /account)
  const key = String(msg.body && msg.body.key || ''), ns = msgNs(msg);
  if (ns === null) return msg.ack();   // not a namespace this worker writes: nothing is touched
  const job = COMBO_RE.test(key) ? await env.WARDROBE.get(`${ns}job:${key}`, 'json') : null;
  // the job is written to KV just before its message is sent, and KV can take up to a minute to show a new key in another
  // location: a consumer that can't see it yet tries again shortly (acking it lost the photo, which then sat "pending" for days)
  if (!job) {
    if ((await jobClaim(env, ns, key, 'state')).done) return msg.ack();   // made already (its job deleted): a late copy of the message
    if (COMBO_RE.test(key) && (msg.attempts || 1) < 6) return msg.retry({ delaySeconds: 20 }); return msg.ack();
  }
  // one run per job: the person's RenderHub hands the job to one message at a time, so a second copy (the queue delivers at least
  // once; the app's Try again queues the look again) neither calls OpenAI nor writes; a run cut off frees it after CLAIM_MS
  const jt = +job.t || 0, c = await jobClaim(env, ns, key, 'claim', jt);
  if (c.done) return msg.ack();
  if (c.running) return msg.retry({ delaySeconds: Math.min(900, Math.ceil(c.wait / 1000) + 10) });
  CLAIMED.set(msg, jt);
  await env.WARDROBE.put(`${ns}jobrun:${key}`, JSON.stringify({ attempts: msg.attempts || 1, at: Date.now() }), JOB_TTL);   // for GET /render-queue
  if (!job.replace && await env.WARDROBE.get(`${ns}render:${key}`)) {   // made meanwhile (another device uploaded it): nothing to pay for
    await refundJob(env, ns, job); await env.WARDROBE.delete(`${ns}job:${key}`); await env.WARDROBE.delete(`${ns}jobrun:${key}`);
    await jobClaim(env, ns, key, 'done', jt); return msg.ack();
  }
  if (!env.OPENAI_API_KEY) { await failJob(env, ns, key, job, 'Add an OPENAI_API_KEY secret to the worker.'); await jobClaim(env, ns, key, 'done', jt); return msg.ack(); }
  const r = job.kind === 'item' ? await itemPhoto(job, env) : await outfitPhoto(job, env, ns);
  if (r.ok) { PAID.add(msg); return keepMade(env, ns, key, job, jt, r.rec, msg); }
  if (r.retry && (msg.attempts || 1) < 4) { await jobClaim(env, ns, key, 'release', jt); return msg.retry({ delaySeconds: 60 }); }
  console.log(`photo ${key} failed: ${r.error}`);
  await failJob(env, ns, key, job, r.error);
  await jobClaim(env, ns, key, 'done', jt);
  msg.ack();
}
/* messages whose photo OpenAI has made (and been paid for): never retried, whatever happens after (queue() reads it) */
const PAID = new WeakSet(), CLAIMED = new WeakMap();   // CLAIMED: message -> the job's t it holds the run of
/* a photo OpenAI made, kept. Nothing here may lead to a retry, which would pay for it again: a failure to keep it (KV over its
   daily writes) is caught, the photo still goes to an open app through the hub, the failure is recorded, and the message is acked */
async function keepMade(env, ns, key, job, jt, rec, msg) {
  try {
    await env.WARDROBE.put(`${ns}render:${key}`, JSON.stringify(rec), renderTtl(key));
  } catch (e) {
    console.log(`photo ${key} made but not kept: ${e && e.message}`);
    const error = failFor(ns, 'The photo was made but the server couldn’t keep it: ' + String(e && e.message || e));
    await jobClaim(env, ns, key, 'done', jt);
    await tellHub(env, ns, { key, rec, error });   // an open app takes the photo itself; one that comes later reads the failure
    try { await env.WARDROBE.put(`${ns}jobfail:${key}`, JSON.stringify({ error, t: Date.now() }), FAIL_TTL); } catch { }
    try { await env.WARDROBE.delete(`${ns}job:${key}`); await env.WARDROBE.delete(`${ns}jobrun:${key}`); } catch { }
    return msg.ack();
  }
  await jobClaim(env, ns, key, 'done', jt);
  try { await env.WARDROBE.delete(`${ns}job:${key}`); await env.WARDROBE.delete(`${ns}jobrun:${key}`); } catch (e) { console.log('job cleanup failed', key, e && e.message); }
  await tellHub(env, ns, { key, rec });
  return msg.ack();
}
/* a queued photo that won't be made, everywhere the same (it used to be written out four ways): its count given back, the reason kept
   for the app (plain words for a tester), the job's records gone and an open app told. Each step on its own, so one failing doesn't
   stop the rest */
async function failJob(env, ns, key, job, why) {
  const error = failFor(ns, why), step = async f => { try { await f(); } catch (e) { console.log('failed-job cleanup', key, e && e.message); } };
  await step(() => refundJob(env, ns, job));
  await step(() => env.WARDROBE.put(`${ns}jobfail:${key}`, JSON.stringify({ error, t: Date.now() }), FAIL_TTL));
  await step(() => env.WARDROBE.delete(`${ns}job:${key}`));
  await step(() => env.WARDROBE.delete(`${ns}jobrun:${key}`));
  await tellHub(env, ns, { key, error });
}
/* the person's RenderHub for one job's run: 'claim' (-> {ok} | {running, wait} | {done}), 'done', 'release', 'state'. Without the
   binding, or when the hub can't be reached, a run goes ahead as before ({ok}) rather than leaving the photo unmade */
async function jobClaim(env, ns, key, op, t = 0) {
  const hub = hubOf(env, ns); if (!hub) return { ok: true };
  try { const r = await hub.fetch(`https://hub/job-${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, t }) }); return (await r.json()) || { ok: true }; }
  catch (e) { console.log('job claim failed', op, key, e && e.message); return { ok: true }; }
}
/* ---- the push to an open app (GET /render-wait): the app holds a request open while its photos are being made, and the queue
   job hands each finished photo (or its failure) to one Durable Object, RenderHub, which answers the waiting requests at once with
   the photo itself (KV can take up to a minute to show a new key elsewhere). Results are kept 10 minutes for an app between two
   waits. Without the RENDER_HUB binding the app just polls GET /render-queue. ---- */
/* one RenderHub per person: the owner's is the one named 'renders', as before; a tester's is 'renders:u:<id>:'. A hub only ever
   holds its own person's photos, so a wait can't be answered with someone else's. The tester's hub also counts the day's use. */
const hubOf = (env, ns = '') => env.RENDER_HUB && env.RENDER_HUB.get(env.RENDER_HUB.idFromName('renders' + (ns ? ':' + ns : '')));
async function tellHub(env, ns, m) {
  const hub = hubOf(env, ns); if (!hub) return;
  try { await hub.fetch('https://hub/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m) }); }
  catch (e) { console.log('hub notify failed', e && e.message); }   // the app still finds it by polling
}
async function waitForRenders(req, env, json, who) {
  const hub = hubOf(env, who.ns); if (!hub) return json({ error: 'no push', noPush: true }, 501);
  const u = new URL(req.url), keys = String(u.searchParams.get('keys') || '').split(',').filter(k => COMBO_RE.test(k)).slice(0, 60);
  if (!keys.length) return json({ error: 'no keys' }, 400);
  const ms = Math.max(1000, Math.min(100000, +u.searchParams.get('ms') || 90000));
  const r = await hub.fetch(`https://hub/wait?keys=${keys.join(',')}&ms=${ms}`);
  let res = await r.json().catch(() => []);
  // the hub remembers only that a photo was made ({key, ok}): the photo itself is read here (left out while KV doesn't show it yet:
  // the app goes on waiting or finds it by polling)
  if (Array.isArray(res) && env.WARDROBE) res = (await Promise.all(res.map(async m => {
    if (!m || m.rec || m.error || !m.ok) return m;
    const rec = await env.WARDROBE.get(`${who.ns}render:${m.key}`, 'json').catch(() => null);
    return rec ? { key: m.key, rec } : null;
  }))).filter(Boolean);
  return json(res, r.ok ? 200 : 502);
}
export class RenderHub {
  constructor(ctx, env) { this.ctx = ctx; this.waiting = new Set(); this.recent = new Map(); this.mem = new Map(); this.jobQ = Promise.resolve(); }
  /* the day's use and the "switched off" mark are kept in the object's own storage (no KV write per AI call); where a test or an
     old binding gives no storage, in memory */
  async sget(k) { const s = this.ctx && this.ctx.storage; return s ? await s.get(k) : this.mem.get(k); }
  async sput(k, v) { const s = this.ctx && this.ctx.storage; if (s) await s.put(k, v); else this.mem.set(k, v); }
  /* the job-* operations (see fetch), one at a time */
  async jobOp(op, m, now) {
    const k = 'job:' + m.key, t = +m.t || 0, c = await this.sget(k);
    if (op === 'state') return { done: !!(c && c.done && c.until > now) };
    if (op === 'claim') {
      if (c && c.until > now && !c.done) return { running: true, wait: c.until - now };
      if (c && c.until > now && c.done && t <= c.at) return { done: true };
      await this.sput(k, { t, at: now, until: now + CLAIM_MS, done: false });
      return { ok: true };
    }
    if (!c || c.done || c.t !== t) return { ok: false };
    if (op === 'done') { await this.sput(k, { t, at: now, until: now + DONE_MS, done: true }); await this.prune(now); }
    else if (op === 'release') await this.sdel(k);
    return { ok: true };
  }
  /* expired job records go (a hundred at a time, where the storage can list) */
  async prune(now) {
    const s = this.ctx && this.ctx.storage; if (!s || !s.list || !s.delete) return;
    try { const old = []; for (const [k, v] of await s.list({ prefix: 'job:', limit: 100 })) if (!v || v.until <= now) old.push(k); if (old.length) await s.delete(old); } catch { }
  }
  async sdel(k) { const s = this.ctx && this.ctx.storage; if (s && s.delete) await s.delete(k); else if (s) await s.put(k, null); else this.mem.delete(k); }
  async fetch(req) {
    const u = new URL(req.url), now = Date.now();
    for (const [k, v] of this.recent) if (now - v.at > 600000) this.recent.delete(k);
    const out = b => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/notify') {
      const m = await req.json().catch(() => null); if (!m || !COMBO_RE.test(String(m.key || ''))) return out({ ok: false });
      const res = m.rec ? { key: m.key, rec: m.rec } : { key: m.key, error: String(m.error || 'failed') };
      // kept for an app between two waits: only whether it was made ({key, ok}; the waiting route reads the photo from KV) or why
      // not, never the photo itself (a batch of 2048 photos held for 10 minutes could near the object's 128 MB)
      this.recent.set(m.key, { key: m.key, ...(m.error ? { error: String(m.error) } : { ok: true }), at: now });
      for (const w of [...this.waiting]) if (w.keys.has(m.key)) { this.waiting.delete(w); clearTimeout(w.timer); w.resolve([res]); }
      return out({ ok: true });
    }
    // one run per queued job (runRenderJob): {key, t} where t is the job's own stamp (when it was queued).
    //   job-claim -> {ok} the caller makes it; {running, wait} another message is making it (try again in wait ms; a run cut off
    //   frees it after CLAIM_MS); {done} it was made or failed after this job was queued (a late copy: nothing to do)
    //   job-done / job-release: the run ended (made or given up: kept DONE_MS) or will be retried (freed); job-state -> {done}
    if (u.pathname.startsWith('/job-')) {
      const m = await req.json().catch(() => null); if (!m || !COMBO_RE.test(String(m.key || ''))) return out({ ok: false, bad: true });
      // one at a time, whatever the storage does between its awaits: two claims can't both read "free"
      const run = this.jobQ.then(() => this.jobOp(u.pathname.slice(5), m, Date.now()));
      this.jobQ = run.catch(() => {});
      return out(await run);
    }
    if (u.pathname === '/wait') {
      const keys = new Set(String(u.searchParams.get('keys') || '').split(',').filter(Boolean));
      const ready = [...keys].map(k => this.recent.get(k)).filter(Boolean).map(({ at, ...r }) => r);
      if (ready.length) return out(ready);
      const ms = Math.max(1000, Math.min(100000, +u.searchParams.get('ms') || 90000));
      return out(await new Promise(resolve => { const w = { keys, resolve }; w.timer = setTimeout(() => { this.waiting.delete(w); resolve([]); }, ms); this.waiting.add(w); }));
    }
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
    if (u.pathname === '/wipe') {   // the account was deleted
      this.recent.clear(); this.mem.clear(); const s = this.ctx && this.ctx.storage; if (s && s.deleteAll) await s.deleteAll();
      if (u.searchParams.get('off')) await this.sput('off', true);
      return out({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }
}

export { CLAIMED, JOB_TTL, OPENAI_MS, PAID, dataUrlToBlob, dropFail, failJob, handleRender, hubOf, jobClaim, jobMsg, queueStatus, runRenderJob, waitForRenders };
