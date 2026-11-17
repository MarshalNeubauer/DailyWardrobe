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
   (people.js useCount), the "switched off" mark and the save lock (/lock). (The name is from when it also handed finished outfit photos
   to an open app.) One more object of the same class, 'renders:logs' (logHub), keeps the feedback and error reports the owner reads:
   apart from the owner's own, so his "Delete everything" (which clears his hub) keeps them, as it always kept feedback:log */
const hubOf = (env, ns = '') => env.RENDER_HUB && env.RENDER_HUB.get(env.RENDER_HUB.idFromName('renders' + (ns ? ':' + ns : '')));
const logHub = env => hubOf(env, 'logs');
/* the save lock (CR-6-01): a lease, so a save that never gives it back (its request killed) blocks that person's saves for LOCK_MS at most;
   LAST_MS: how long the last committed version is handed to the next save as "KV must show at least this" (KV can show an older value
   for up to about 60 s in another location; kept in memory only: an object is evicted after over a minute idle, by then KV agrees) */
const LOCK_MS = 30000, LAST_MS = 120000;
const LOG_KINDS = { fb: 1, er: 1 };
export class RenderHub {
  constructor(ctx, env) { this.ctx = ctx; this.mem = new Map(); this.lk = null; this.last = null; this.q = Promise.resolve(); }
  /* the day's use and the "switched off" mark are kept in the object's own storage (no KV write per AI call); where a test or an
     old binding gives no storage, in memory */
  async sget(k) { const s = this.ctx && this.ctx.storage; return s ? await s.get(k) : this.mem.get(k); }
  async sput(k, v) { const s = this.ctx && this.ctx.storage; if (s) await s.put(k, v); else this.mem.set(k, v); }
  async sdel(k) { const s = this.ctx && this.ctx.storage; if (s && s.delete) await s.delete(k); else if (s) await s.put(k, null); else this.mem.delete(k); }
  /* one log operation at a time (a read, a change and a write of the same day's list; the platform also holds other requests back while
     storage is read, this keeps it so wherever the object runs) */
  serial(f) { const p = this.q.then(f, f); this.q = p.catch(() => { }); return p; }
  /* the feedback (fb) and error reports (er): a list per UTC day, log:<kind>:<YYYY-MM-DD>, and the index log:<kind> = {day: count}.
     m: {op: 'add'|'get'|'drop', kind, days (kept), max (kept at most), items (add), id (drop: that person's entries go)} */
  async logOp(m) {
    const ik = `log:${m.kind}`, idx = (await this.sget(ik)) || {}, now = Date.now(), cut = new Date(now - (+m.days || 30) * 864e5).toISOString().slice(0, 10);
    let changed = false;
    for (const d of Object.keys(idx)) if (d < cut) { await this.sdel(`${ik}:${d}`); delete idx[d]; changed = true; }
    if (m.op === 'add') {
      const d = new Date(now).toISOString().slice(0, 10), k = `${ik}:${d}`, l = (await this.sget(k)) || [];
      await this.sput(k, [...l, ...m.items]); idx[d] = l.length + m.items.length; changed = true;
      let total = Object.values(idx).reduce((a, n) => a + n, 0);
      for (const dd of Object.keys(idx).sort()) {   // over the most kept: the oldest go
        if (total <= +m.max) break;
        const kk = `${ik}:${dd}`, ll = (await this.sget(kk)) || [], n = Math.min(ll.length, total - +m.max);
        total -= n; if (ll.length > n) { await this.sput(kk, ll.slice(n)); idx[dd] = ll.length - n; } else { await this.sdel(kk); delete idx[dd]; }
      }
    }
    const items = [];
    if (m.op === 'get' || m.op === 'drop') for (const d of Object.keys(idx).sort()) {
      const k = `${ik}:${d}`, l = (await this.sget(k)) || [];
      if (m.op === 'get') { items.push(...l); continue; }
      const keep = l.filter(x => !(x && x.id === m.id));
      if (keep.length === l.length) continue;
      if (keep.length) { await this.sput(k, keep); idx[d] = keep.length; } else { await this.sdel(k); delete idx[d]; }
      changed = true;
    }
    if (changed) await this.sput(ik, idx);
    return m.op === 'get' ? { items } : { ok: true };
  }
  async fetch(req) {
    const u = new URL(req.url);
    const out = b => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
    // POST /lock {op:'take'} -> {ok, tok, last} | {ok:false, busy}: one save at a time for this person (CR-6-01: KV can't compare and
    // swap, so two saves read the same version and both wrote it); last: the version the last save committed, while KV may still show an
    // older one elsewhere. {op:'give', tok, ver?}: let go (only by the holder), ver = {rev, saved} the version it stored
    if (u.pathname === '/lock') {
      const m = await req.json().catch(() => ({})), now = Date.now();
      if (m.op === 'take') {
        if (this.lk && this.lk.until > now) return out({ ok: false, busy: true });
        const tok = now.toString(36) + Math.random().toString(36).slice(2);
        this.lk = { tok, until: now + LOCK_MS };
        return out({ ok: true, tok, last: this.last && now - this.last.at < LAST_MS ? { rev: this.last.rev, saved: this.last.saved } : null });
      }
      if (m.op === 'give') {
        if (this.lk && this.lk.tok === m.tok) this.lk = null;
        const v = m.ver;
        if (v && Number.isInteger(v.rev) && Number.isFinite(v.saved) && (!this.last || v.rev >= this.last.rev)) this.last = { rev: v.rev, saved: v.saved, at: now };
        return out({ ok: true });
      }
      return out({ ok: false, bad: true });
    }
    // POST /log {op, kind, …} (the logs object only, logHub): see logOp
    if (u.pathname === '/log') {
      const m = await req.json().catch(() => null);
      if (!m || !LOG_KINDS[m.kind] || !['add', 'get', 'drop'].includes(m.op) || (m.op === 'add' && !Array.isArray(m.items))) return out({ ok: false, bad: true });
      return out(await this.serial(() => this.logOp(m)));
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
    if (u.pathname === '/wipe') {   // the account was deleted (also clears any job records left from the retired outfit-photo queue)
      this.mem.clear(); this.last = null; const s = this.ctx && this.ctx.storage; if (s && s.deleteAll) await s.deleteAll();
      if (u.searchParams.get('off')) await this.sput('off', true);
      return out({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }
}

export { OPENAI_MS, dataUrlToBlob, handleRender, hubOf, logHub };
