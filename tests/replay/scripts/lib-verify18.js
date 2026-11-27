// Shared helpers for verifier 18's repro scripts (tester 18's big-wardrobe findings, lab port 9780).
// startLab(tag): fresh lab, fresh kv file kv/verify18-<tag>.json, server clock Mon 16 Nov 2026 07:40 Kuwait.
// joined(tag): a fresh phone (profile verify18-<tag>) at that time, opened from a NEW invitation link (its own account), setup skipped.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9780, WURL = `http://127.0.0.1:${PORT + 1}/`;
const T0 = '2026-11-16T07:40:00+03:00';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null, L = null; const phones = [];
async function startLab(tag) {
  const kv = `${RP.SCRATCH}/kv/verify18-${tag}.json`; try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, ['--max-old-space-size=4096', H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { L = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')); break } catch {} } }
  if (!L) throw new Error('lab did not start');
  await mock('clock', { at: new Date(T0).toISOString() });
  return L;
}
async function stopAll() {
  for (const ph of phones) try { await ph.kill() } catch {}
  if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) });
}
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
async function invite(name) {
  const j = await fetch(WURL + 'invites', { method: 'POST', headers: { 'x-app-token': 'owner-secret', 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json());
  const code = j.code || (j.invite && j.invite.code);
  return `${L.appUrl}#invite=${code}&w=${encodeURIComponent(WURL)}`;
}
async function checkUrl(ph) { const w = await ph.page.evaluate(() => localStorage.worker_url || null); if (w && w !== WURL) throw new Error('WORKER URL WRONG ' + w); return w }
// every request the page makes: method, url, body length, status (inspection only)
const HOOK = () => { if (window.__mf) return; window.__mf = []; const f0 = window.fetch; window.fetch = async function (u, o) {
  const url = String(u && u.url || u), m = (o && o.method) || 'GET', up = o && typeof o.body === 'string' ? o.body.length : 0, e = { m, url: url.replace(/^https?:\/\/[^/]+/, ''), up, st: null };
  window.__mf.push(e); try { const r = await f0.apply(this, arguments); e.st = r.status; return r } catch (x) { e.st = 'ERR'; throw x } } };
async function joined(tag) {
  const link = await invite('verify18 ' + tag);
  const ph = await P.openPhone({ profile: `verify18-${tag}`, fresh: true, time: T0 }); phones.push(ph);
  await ph.ctx.addInitScript(HOOK);
  await ph.page.goto(link); await ph.ready(); await sleep(2500);
  await checkUrl(ph);
  if (await ph.page.locator('#su-skip').isVisible().catch(() => false)) { await ph.tap('#su-skip'); await sleep(1000) }
  for (let i = 0; i < 40 && await ph.page.evaluate(() => 'syncing' in HOOK && HOOK.syncing); i++) await sleep(250);
  return ph;
}
// SETUP (impossible by hand): N photo items made as Add makes them: each photo is one of the 16 sample photos drawn at PH_MAX
// (1536 px, JPEG .85, Add's cardPics), with a 4 px dot so every photo is distinct as real photos are, its small copy by the app's own
// makeSmall (480 px, .82); optionally a close-up (TEX_MAX 1536, .85) cut from the middle of another sample. Stored in one go with
// the app's kitStore (as an import stores). Returns the bytes each item adds to a backup's POST.
const SAMPLES = [...fs.readdirSync(RP.SAMPLES_A).map(f => RP.SAMPLES_A + '/' + f), ...fs.readdirSync(RP.SAMPLES_B).map(f => RP.SAMPLES_B + '/' + f)]
  .filter(f => /\/c[0-9a-f]{16}\.jpg$/.test(f)).sort();
const sampleUrls = () => SAMPLES.map(f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64'));
async function addPhotoItems(ph, n, { closeups = false, from = 0, store = true } = {}) {
  return ph.page.evaluate(async ([urls, n, closeups, from, store]) => {
    const load = s => new Promise((r, j) => { const im = new Image(); im.onload = () => r(im); im.onerror = j; im.src = s });
    const ims = []; for (const u of urls) ims.push(await load(u));
    const TY = ['suit', 'blazer', 'pants', 'shirt', 'shirt', 'tie', 'tie', 'shoes'], COL = { suit: 'navy', blazer: 'brown', pants: 'grey', shirt: 'white', tie: 'burgundy', shoes: 'brown' };
    const list = [], per = [];
    for (let k = from; k < from + n; k++) {
      const c = HOOK.shrink(ims[k % ims.length], HOOK.PH_MAX), g = c.getContext('2d');
      g.fillStyle = `rgb(${k % 256},${(k * 7) % 256},${(k * 13) % 256})`; g.fillRect((k * 37) % (c.width - 4), (k * 53) % (c.height - 4), 4, 4);
      const type = TY[k % TY.length];
      const it = { id: crypto.randomUUID(), type, primaryColor: COL[type], secondaryColor: 'none', thirdColor: 'none', pattern: 'solid', added: Date.now(), name: 'Photo item ' + (k + 1), photo: c.toDataURL('image/jpeg', .85) };
      await HOOK.makeSmall(it);
      if (closeups && HOOK.TEXTURE_TYPES.includes(type)) { const s = ims[(k + 5) % ims.length], t = document.createElement('canvas'); t.width = t.height = HOOK.TEX_MAX;
        const tg = t.getContext('2d'), w = Math.min(s.naturalWidth, s.naturalHeight) / 2; tg.drawImage(s, (s.naturalWidth - w) / 2, (s.naturalHeight - w) / 2, w, w, 0, 0, HOOK.TEX_MAX, HOOK.TEX_MAX);
        tg.fillStyle = '#123'; tg.fillRect(k % 1500, 7, 4, 4); it.texture = t.toDataURL('image/jpeg', .85) }
      // what this item adds to POST /sync: its record with references, plus each photo as "hash":"data…"
      const strs = [...HOOK.phStrings(it, HOOK.isPh)]; let ref = JSON.stringify(HOOK.phMap(it, s => strs.includes(s) ? 'dwph:' + '0'.repeat(20) : s)).length + 1;
      per.push(ref + strs.reduce((a, s) => a + s.length + 26, 0));
      list.push(it);
    }
    const ok = store ? await HOOK.kitStore(list, null) : null;
    return { ok, n: list.length, items: HOOK.items.length, per, photoKB: Math.round(list.reduce((a, i) => a + i.photo.length, 0) / list.length / 1024), smKB: Math.round(list.reduce((a, i) => a + i.photoSm.length, 0) / list.length / 1024) };
  }, [sampleUrls(), n, closeups, from, store]);
}
const reqs = ph => ph.page.evaluate(() => window.__mf.slice());
const syncPosts = async ph => (await reqs(ph)).filter(r => r.m === 'POST' && /^\/sync/.test(r.url));
// the person closes the app (background) and comes back; waits for the backup's POST(s) to finish
async function backgroundAndWait(ph, ms = 90000) {
  const n0 = (await syncPosts(ph)).length; await ph.background(); const t = Date.now();
  while (Date.now() - t < ms) { await sleep(500); const p = await syncPosts(ph); if (p.length > n0 && p.every(x => x.st != null) && !(await ph.page.evaluate(() => HOOK.syncing))) break }
  await sleep(1500); await ph.foreground(); await sleep(1500);
  for (let i = 0; i < 120 && await ph.page.evaluate(() => HOOK.syncing); i++) await sleep(500);
  return (await syncPosts(ph)).slice(n0);
}
const status = ph => ph.page.evaluate(() => ({ sync_status: localStorage.getItem('sync_status'), pause: localStorage.getItem('sync_pause') }));
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { await stopAll() } process.exit(code) }
module.exports = { PORT, WURL, T0, sleep, mock, startLab, joined, invite, addPhotoItems, reqs, syncPosts, backgroundAndWait, status, verdict, run, get lab() { return L } };
