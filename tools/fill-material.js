/* Fill in item.material for wardrobe items that have none, by asking Claude to look at each item's photo and close-up.
   Uses the Message Batches API (half price). Without --apply it only reads the server: it downloads the backup and writes a report,
   and nothing is saved to the wardrobe. --apply SAVES to the wardrobe: it posts the approved materials to the worker (CR-8-12, the
   header said nothing was ever saved).

   Usage (PowerShell, in the repo):
     $env:DW_WORKER='https://<worker>.workers.dev/'; $env:DW_TOKEN=<owner code>; $env:ANTHROPIC_API_KEY=<key>
     node tools/fill-material.js --out <folder> [--model claude-opus-5-5] [--dry] [--batch <id>] [--only <type,...>]

   --dry      download and list what would be sent, with an estimated cost; nothing is sent to Claude
   --batch    pick up a batch already sent (its id is in <out>/batch.json) instead of sending a new one
   --apply <file>   save approved materials ([{id, material}]); with --dry only says what it would save
   Writes <out>/suggestions.json (one row per item) and <out>/report.html (photos, suggestion, confidence, reason). */
const fs = require('fs'), path = require('path');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d) };
const has = n => process.argv.includes('--' + n);
const WORKER = String(process.env.DW_WORKER || arg('worker', '')).replace(/\/?$/, '/'), TOKEN = process.env.DW_TOKEN || '';
const KEY = process.env.ANTHROPIC_API_KEY || '', MODEL = arg('model', 'claude-opus-5-5');
const OUT = arg('out', ''), DRY = has('dry'), BATCH = arg('batch', ''), ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const ORIGIN = String(arg('origin', 'https://marshalneubauer.github.io/DailyWardrobe/'));
if (has('help') || !WORKER.startsWith('http') || !TOKEN || (!arg('apply', '') && (!OUT || (!DRY && !KEY)))) {
  console.log('Usage: DW_WORKER=… DW_TOKEN=… ANTHROPIC_API_KEY=… node tools/fill-material.js --out <folder> [--model m] [--dry] [--batch <id>] [--only shirt,tie]');
  process.exit(has('help') ? 0 : 1);
}
if (OUT) fs.mkdirSync(OUT, { recursive: true });

/* the app's list of materials per type (core.js MATERIALS_BY): read from the file so the two never drift apart */
const core = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8');
const MATERIALS_BY = Function('return ' + core.match(/const MATERIALS_BY=(\{[\s\S]*?\});/)[1])();
/* the app's own field stamps (core.js itemFields, fix round 3): read from the file too, so a saved item carries fs as a phone's save would */
const itemFields = Function(core.match(/^const (?:stamp|ITEM_META|fsOk|fieldStamp|sameVal|fsPack)=.*$/gm).join('\n') + '\n'
  + core.match(/^function itemFields\([\s\S]*?i\.fs=fsPack\(t,s\);return i\}$/m)[0] + '\nreturn itemFields;')();
const TYPE_WORD = { suit: 'suit', blazer: 'blazer (sport coat)', pants: 'trousers', shirt: 'dress shirt', tie: 'tie', socks: 'pair of socks', overcoat: 'overcoat', raincoat: 'raincoat' };

const api = p => fetch(new URL(p, WORKER).href, { headers: { 'x-app-token': TOKEN, origin: new URL(ORIGIN).origin } });
const claude = (p, opt = {}) => fetch('https://api.anthropic.com/v1/' + p, { ...opt, headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...(opt.headers || {}) } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hashOf = v => typeof v === 'string' && v.startsWith('dwph:') ? v.slice(5) : null;

async function photos(hashes) {
  const got = {}, list = [...new Set(hashes.filter(Boolean))];
  for (let i = 0; i < list.length; i += 40) {
    const r = await api('sync?ph=' + list.slice(i, i + 40).join(','));
    if (!r.ok) throw new Error('photos: HTTP ' + r.status + ' ' + await r.text());
    Object.assign(got, (await r.json()).photos || {});
  }
  return got;
}

const SYSTEM = `You are a menswear expert who identifies what a garment is made of from photos, for a wardrobe app.
You get the whole item and, when there is one, a close-up of its cloth. Judge from the weave, the surface, the sheen, the drape and the
texture you can actually see. Choose exactly one material from the list you are given. If the photos don't let you tell (for example
wool against wool blend, which look alike), pick the likelier one and say low confidence; answer "unsure" only when you can't narrow
it down at all. Confidence: high = you can see it plainly (linen slubs, flannel nap, knit loops, oxford basketweave); medium = likely
from the look; low = a guess. The reason is one short sentence naming what you saw.`;

const schemaFor = list => ({
  type: 'object', additionalProperties: false, required: ['material', 'confidence', 'reason'],
  properties: { material: { type: 'string', enum: [...list, 'unsure'] }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, reason: { type: 'string' } },
});

function request(it, ph) {
  const img = u => { const m = String(u || '').match(/^data:(image\/[\w.+-]+);base64,(.*)$/s); return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } : null };
  const a = img(ph[hashOf(it.photo)] || it.photo), b = img(ph[hashOf(it.texture)] || it.texture);
  const list = MATERIALS_BY[it.type];
  const known = [it.primaryColor, it.pattern && it.pattern !== 'solid' ? it.pattern : '', it.name ? `named "${it.name}"` : ''].filter(Boolean).join(', ');
  return {
    custom_id: it.id,
    params: {
      model: MODEL, max_tokens: 2000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: schemaFor(list) } },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: [a, b, { type: 'text', text:
        `${a && b ? 'The first photo is the whole item, the second a close-up of its cloth.' : b ? 'The photo is a close-up of the cloth.' : 'The photo is the whole item.'}\n`
        + `It is a ${TYPE_WORD[it.type] || it.type} (tagged: ${known}).\nMaterials to choose from: ${list.join(', ')}.` }].filter(Boolean) }],
    },
  };
}

/* --apply <file>: save approved materials, a JSON list [{id, material, other?, replace?}]. Downloads a fresh copy, changes only `material`
   on those items (an item that already has a material is left alone unless it is exactly `replace`; one that is gone is skipped; `other`
   allows a typed material outside the type's list), stamps `updated`, and POSTs just those items as the app's small
   sync does (the worker merges by stamp), then reads them back. Settings → Roll back undoes it. (CR-8-12) Each item's field stamps (fs)
   are worked out by the app's own itemFields: only `material` takes the new stamp, so an edit to another field on a phone, not yet
   synced, still wins that field (the old fs, kept as it was, made this copy win whole) */
async function apply(file) {
  const want = JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await api('sync?lite=1');
  if (!r.ok) throw new Error('backup: HTTP ' + r.status + ' ' + await r.text());
  const lite = await r.json(), byId = Object.fromEntries((lite.items || []).map(i => [i.id, i]));
  const now = Date.now(), changed = [], skipped = [];
  for (const w of want) {
    const it = byId[w.id], list = it && MATERIALS_BY[it.type];
    if (!it || it.deleted) { skipped.push([w.id, 'not in the wardrobe']); continue; }
    if (it.material && !(w.replace && it.material === w.replace)) { skipped.push([w.id, 'already has ' + it.material]); continue; }
    // w.other: a material typed in, as the app's "Other" does (at most 40 characters, wardrobe.js WARD_MAX)
    if (!list || !(list.includes(w.material) || (w.other && typeof w.material === 'string' && w.material.trim() && w.material.length <= 40))) { skipped.push([w.id, w.material + ' is not offered for ' + it.type]); continue; }
    changed.push(itemFields({ ...it, material: w.material, updated: now }, it));
  }
  console.log(`${changed.length} to save, ${skipped.length} left alone`); for (const s of skipped) console.log('  skipped', s.join(': '));
  if (!changed.length || DRY) return;
  const body = { baseRev: lite.rev, baseSaved: lite.saved, day: new Date().toISOString().slice(0, 10), delta: { items: changed, days: [], tombstones: {} }, photos: {} };
  const p = await fetch(new URL('sync', WORKER).href, { method: 'POST', headers: { 'x-app-token': TOKEN, origin: new URL(ORIGIN).origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const pj = await p.json().catch(() => ({}));
  if (!p.ok) throw new Error('save: HTTP ' + p.status + ' ' + JSON.stringify(pj));
  console.log('saved: backup version', lite.rev, '->', pj.rev);
  const back = await (await api('sync?lite=1')).json(), got = Object.fromEntries((back.items || []).map(i => [i.id, i]));
  const bad = changed.filter(c => !got[c.id] || got[c.id].material !== c.material);
  console.log(bad.length ? `read back: ${bad.length} not as saved: ${bad.map(b => b.id).join(', ')}` : `read back: all ${changed.length} saved`);
}

(async () => {
  if (arg('apply', '')) return apply(arg('apply', ''));
  const r = await api('sync?lite=1');
  if (!r.ok) throw new Error('backup: HTTP ' + r.status + ' ' + await r.text());
  const lite = await r.json(), items = (lite.items || []).filter(i => i && !i.deleted);
  const want = items.filter(i => MATERIALS_BY[i.type] && !i.material && (!ONLY.length || ONLY.includes(i.type)));
  const can = want.filter(i => i.photo || i.texture), skipped = want.filter(i => !(i.photo || i.texture));
  console.log(`${items.length} items; ${want.length} have no material; ${can.length} have a photo to judge from` + (skipped.length ? `, ${skipped.length} skipped (no photo)` : ''));

  const ph = await photos(can.flatMap(i => [hashOf(i.photo), hashOf(i.texture), hashOf(i.photoSm)]));
  const reqs = can.map(i => request(i, ph));
  const imgs = reqs.reduce((n, q) => n + q.params.messages[0].content.filter(c => c.type === 'image').length, 0);
  // a 1536 px photo is about 1,600 x 1,200 / 750 ≈ 2,400 tokens; prices per million: Opus 5.5 $4 / $20, halved in a batch
  const PRICE = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] }[MODEL] || [4, 20];
  const est = ((imgs * 2400 + reqs.length * 600) * PRICE[0] + reqs.length * 600 * PRICE[1]) / 1e6 / 2;
  console.log(`${reqs.length} requests, ${imgs} photos, model ${MODEL}: about $${est.toFixed(2)} (batch price)`);
  if (DRY) { for (const i of can) console.log(' ', i.type.padEnd(8), (i.name || '').padEnd(22), i.primaryColor, i.pattern || ''); return; }

  let id = BATCH;
  if (!id) {
    const s = await claude('messages/batches', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    const sj = await s.json();
    if (!s.ok) throw new Error('batch: HTTP ' + s.status + ' ' + JSON.stringify(sj));
    id = sj.id; fs.writeFileSync(path.join(OUT, 'batch.json'), JSON.stringify({ id, at: new Date().toISOString(), model: MODEL, n: reqs.length }));
    console.log('sent batch', id);
  }
  let b;
  for (;;) {
    b = await (await claude('messages/batches/' + id)).json();
    if (b.processing_status === 'ended') break;
    console.log(new Date().toLocaleTimeString(), b.processing_status, JSON.stringify(b.request_counts));
    await sleep(30000);
  }
  const txt = await (await claude('messages/batches/' + id + '/results')).text();
  const byId = Object.fromEntries(items.map(i => [i.id, i])), rows = [];
  let inTok = 0, outTok = 0, cacheTok = 0;
  for (const line of txt.split('\n').filter(Boolean)) {
    const x = JSON.parse(line), it = byId[x.custom_id];
    const row = { id: x.custom_id, type: it && it.type, name: it && it.name, color: it && it.primaryColor, pattern: it && it.pattern, status: x.result.type };
    if (x.result.type === 'succeeded') {
      const m = x.result.message, u = m.usage || {};
      inTok += u.input_tokens || 0; outTok += u.output_tokens || 0; cacheTok += (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      if (m.stop_reason === 'refusal') row.status = 'refused';
      else { const t = (m.content.find(c => c.type === 'text') || {}).text || ''; try { Object.assign(row, JSON.parse(t)) } catch { row.status = 'bad-json'; row.raw = t.slice(0, 200) } }
    } else row.error = JSON.stringify(x.result.error || x.result).slice(0, 300);
    rows.push(row);
  }
  const order = { high: 0, medium: 1, low: 2 };
  rows.sort((a, b) => (a.type || '').localeCompare(b.type || '') || (order[a.confidence] ?? 3) - (order[b.confidence] ?? 3));
  const cost = ((inTok + cacheTok) * PRICE[0] + outTok * PRICE[1]) / 1e6 / 2;
  fs.writeFileSync(path.join(OUT, 'suggestions.json'), JSON.stringify({ batch: id, model: MODEL, tokens: { in: inTok, cache: cacheTok, out: outTok }, cost, rows }, null, 1));

  const thumb = i => { const u = ph[hashOf(i.photoSm)] || ph[hashOf(i.photo)] || ph[hashOf(i.texture)] || ''; return u ? `<img src="${u}" alt="">` : '<div class="none">no photo</div>' };
  const close = i => { const u = ph[hashOf(i.texture)]; return u ? `<img src="${u}" alt="">` : '' };
  const count = k => rows.filter(r => r.confidence === k).length;
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Material suggestions</title>
<style>body{font:15px system-ui,sans-serif;margin:16px;background:#f6f5f2;color:#222}h1{font-size:20px}table{border-collapse:collapse;width:100%;background:#fff}
td,th{border-bottom:1px solid #e3e0da;padding:8px;text-align:left;vertical-align:middle}img{width:96px;height:96px;object-fit:cover;border-radius:8px;margin-right:4px}
.none{width:96px;height:96px;display:grid;place-items:center;background:#eee;border-radius:8px;color:#888;font-size:12px}
.high{color:#1b7a3a;font-weight:600}.medium{color:#a06b00;font-weight:600}.low{color:#b3352b;font-weight:600}.mat{font-size:17px;font-weight:600}small{color:#666}</style>
<h1>Material suggestions</h1><p>${rows.length} items · ${count('high')} high, ${count('medium')} medium, ${count('low')} low confidence · ${MODEL} · cost $${cost.toFixed(2)} · nothing has been saved to the wardrobe.</p>
<table><tr><th>Photos</th><th>Item</th><th>Suggested</th><th>Why</th></tr>${rows.map(r => { const i = byId[r.id] || {}; return `<tr><td>${thumb(i)}${close(i)}</td>
<td>${esc(r.type)}<br><b>${esc(r.name || '')}</b><br><small>${esc(r.color)}${r.pattern && r.pattern !== 'solid' ? ' · ' + esc(r.pattern) : ''}</small></td>
<td><span class="mat">${esc(r.material || r.status)}</span><br><span class="${esc(r.confidence)}">${esc(r.confidence || '')}</span></td><td>${esc(r.reason || r.error || r.raw || '')}</td></tr>` }).join('')}</table>`;
  fs.writeFileSync(path.join(OUT, 'report.html'), html);
  console.log(`done: ${rows.length} rows (${count('high')} high, ${count('medium')} medium, ${count('low')} low); tokens in ${inTok} cache ${cacheTok} out ${outTok}; cost about $${cost.toFixed(2)}`);
  console.log('report:', path.join(OUT, 'report.html'));
})().catch(e => { console.error(e.message || e); process.exit(1) });
