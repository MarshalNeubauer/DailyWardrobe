/* Daily Wardrobe worker: item pictures: a product photo of one accessory, made from a short description.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */
import { JOB_TTL, OPENAI_MS, dataUrlToBlob, dropFail, jobMsg } from './render.js';
import { COMBO_RE, renderId, renderTtl } from './records.js';
import { JOB_WRITES, spendEach, unspend, utcDay } from './people.js';

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
async function renderItem(body, env, json, who) {
  const ns = who.ns;
  const item = String(body.item || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  if (!item) return json({ error: 'no item description' }, 400);
  // background: the picture is made by the queue consumer (an edit from a reference photo can take minutes); fetch it later with GET ?key=
  if (body.queue) {
    const key = String(body.key || '');
    if (!env.RENDER_QUEUE || !env.WARDROBE) return json({ error: 'no queue', noQueue: true }, 501);
    if (!COMBO_RE.test(key)) return json({ error: 'bad key' }, 400);
    const day = utcDay(), over = await spendEach(env, who, [['item', 1], ['write', JOB_WRITES]], day); if (over) return json(over.body, over.status);
    await env.WARDROBE.put(`${ns}job:${key}`, JSON.stringify({ kind: 'item', key, item, ref: body.ref || null, t: Date.now(), ...(who.caps ? { cap: 'item', capDay: day } : {}) }), JOB_TTL);
    await dropFail(env, ns, key);
    await env.RENDER_QUEUE.send(jobMsg(key, ns));
    return json({ queued: true });
  }
  const over = await spendEach(env, who, [['item', 1], ['write', 1]]); if (over) return json(over.body, over.status);
  const r = await itemPhoto({ item, ref: body.ref }, env);
  if (!r.ok) { await unspend(env, who, 'item'); await unspend(env, who, 'write'); return json({ error: r.error }, r.status); }
  const id = renderId(body);
  if (env.WARDROBE && id) await env.WARDROBE.put(`${ns}render:${id}`, JSON.stringify(r.rec), renderTtl(id));
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
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(OPENAI_MS) });
    } else {
      r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: ITEM_PROMPT(item), size: '1024x1024', quality: env.OPENAI_IMAGE_QUALITY || 'medium', output_format: 'jpeg', n: 1 }), signal: AbortSignal.timeout(OPENAI_MS) });
    }
  } catch (e) { return { ok: false, status: 502, retry: true, error: (e && e.name === 'TimeoutError' ? 'OpenAI took over 5 minutes' : 'Could not reach the OpenAI API: ' + String(e && e.message)) }; }
  const out = await r.json().catch(() => null);
  if (!r.ok) { const msg = out && out.error && out.error.message || `HTTP ${r.status}`; return { ok: false, status: 502, retry: r.status === 429 && !/quota|billing/i.test(msg) || r.status >= 500, error: `OpenAI: ${msg}` }; }
  const b64 = out && out.data && out.data[0] && out.data[0].b64_json;
  if (!b64) return { ok: false, status: 502, retry: true, error: 'OpenAI returned no image' };
  console.log(`item picture by ${model}: ${item.slice(0, 120)}`);
  return { ok: true, rec: { sig: 'item|' + item, img: `data:image/jpeg;base64,${b64}`, model, t: Date.now() } };
}

export { itemPhoto, renderItem };
