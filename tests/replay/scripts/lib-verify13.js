// Shared helpers for verifier 13's repro scripts (tester 13's "data from outside" findings, lab port 9730).
// Everything stays on 127.0.0.1. No OpenAI. Proofs are PASSIVE: a crafted field contains an attribute-breakout that inserts a
// plain, inert marker element (<i data-v13="TAG">) when the string reaches innerHTML unescaped. Nothing executes; we detect the
// hole by querying the DOM for [data-v13]. This shows the same sink as a script marker, without running any code.
const RP = require('../harness/paths.js');
const fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const HDIR = RP.H;
const P = require(HDIR + 'phone.js');
const PORT = 9730, WURL = `http://127.0.0.1:${PORT + 1}/`, SPORT = 9735, SURL = `http://127.0.0.1:${SPORT}/`;
const T0 = '2026-11-16T07:40:00+03:00';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null, phones = [], stranger = null; const strangerLog = [];
// A passive attribute-breakout: closes an attribute/tag then inserts an inert <i data-v13="tag"> element. No script, no handler.
const BREAK = tag => `"><i data-v13="${tag}"></i>`;
async function startLab(tag) {
  const kv = `${RP.SCRATCH}/kv/verify13-${tag}.json`; try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [HDIR + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { const L = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')); await mock('clock', { at: new Date(T0).toISOString() }); return L } catch {} } }
  throw new Error('lab did not start');
}
function startStranger() {
  const t = Date.parse(T0) - 3600e3;
  const evil = { id: 'sx1' + BREAK('from-stranger'), type: 'tie', primaryColor: 'navy', pattern: 'solid', secondaryColor: 'none', tertiaryColor: 'none', added: t, updated: t };
  let rev = 0;
  stranger = http.createServer((q, r) => { const ch = []; q.on('data', d => ch.push(d)); q.on('end', () => {
    const b = Buffer.concat(ch).toString('utf8');
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-app-token', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'content-type': 'application/json' };
    if (q.method === 'OPTIONS') { r.writeHead(204, h); return r.end() }
    let names = [], photos = 0, hasImg = false;
    if (b) { try { const j = JSON.parse(b); const its = ((j.delta || j.data || {}).items || []); names = its.map(i => i.name || i.type); photos = Object.keys(j.photos || {}).length; hasImg = /data:image/.test(b) } catch {} }
    strangerLog.push({ m: q.method, path: q.url.split('?')[0], q: q.url.includes('?') ? q.url.split('?')[1].slice(0, 30) : '', tok: String(q.headers['x-app-token'] || '').slice(0, 6), bytes: b.length, names, photos, hasImg });
    const u = new URL(q.url, 'http://x'), p = u.pathname, J = (s, o) => { r.writeHead(s, h); r.end(JSON.stringify(o)) };
    if (p === '/me') return J(200, { id: 'stranger1', name: 'Daily Wardrobe support', role: 'tester', caps: { tag: 40, pattern: 10, item: 20, describe: 40 }, used: { tag: 0, pattern: 0, item: 0, describe: 0 }, day: '2026-11-16' });
    if (p === '/sync' && q.method === 'GET') { if (u.searchParams.has('lite')) return J(200, { lite: 1, rev, saved: t, all: true, items: [evil], days: [], tombstones: {}, idx: { i: { [evil.id]: t }, d: {}, s: -1 }, ph: [] }); return J(200, { rev, saved: t, data: { items: [evil], days: [], tombstones: {} } }) }
    if (p === '/sync') { rev++; return J(200, { rev, saved: Date.now() }) }
    return J(404, { error: 'none' }) }) }).listen(SPORT, '127.0.0.1');
  return new Promise(r => stranger.once('listening', r));
}
async function phone(tag, opts = {}) { const ph = await P.openPhone({ profile: `verify13-${tag}`, fresh: true, time: T0, ...opts }); phones.push(ph); return ph }
async function stopAll() {
  for (const ph of phones) try { await ph.kill() } catch {}
  if (stranger) { stranger.close(); stranger = null }
  if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) });
}
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
async function call(method, path, tok, body) {
  const r = await fetch(WURL + path, { method, headers: { ...(tok ? { 'x-app-token': tok } : {}), ...(body != null ? { 'content-type': 'application/json' } : {}) }, body: body == null ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 200) } return { s: r.status, j };
}
async function invite(name, appUrl) { const r = await call('POST', 'invites', 'owner-secret', { name }); return { code: r.j.code, link: appUrl + '#invite=' + r.j.code + '&w=' + encodeURIComponent(WURL) } }
async function skipSetup(ph) { for (let i = 0; i < 20; i++) { if (await ph.page.locator('#su-skip').isVisible().catch(() => false)) { await ph.tap('#su-skip'); await sleep(900); return true } await sleep(300) } return false }
const gear = 'button[aria-label="Settings"]';
async function restoreFile(ph, file) { await ph.tap(gear); await sleep(700); await ph.page.locator('input[type=file][accept*="json"]').setInputFiles(file); await sleep(2000) }
async function closeSettingsUI(ph) { await ph.page.keyboard.press('Escape').catch(() => {}); await sleep(300); await ph.page.evaluate(() => { if ('settingsOpen' in HOOK && typeof HOOK.settingsOpen === 'function' && HOOK.settingsOpen() && 'closeSettings' in HOOK && typeof HOOK.closeSettings === 'function') HOOK.closeSettings() }); await sleep(800) }
// Count of inert marker elements inserted into the page (the proof: >0 means a crafted string reached innerHTML unescaped).
const marks = ph => ph.page.evaluate(() => [...document.querySelectorAll('[data-v13]')].map(e => e.getAttribute('data-v13'))).catch(() => []);
const st = ph => ph.page.evaluate(() => ({ items: 'items' in HOOK ? HOOK.items.map(i => String(i.id).slice(0, 10)) : null, worker: localStorage.getItem('worker_url'), tokLen: (localStorage.getItem('app_token') || '').length, marks: [...document.querySelectorAll('[data-v13]')].map(e => e.getAttribute('data-v13')) }));
const askText = ph => ph.page.evaluate(() => { const s = document.querySelector('#ask-title'); return s && s.offsetParent ? (s.closest('[role=dialog]') || s.parentElement).innerText.replace(/\n+/g, ' | ').slice(0, 300) : '' }).catch(() => '');
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { await stopAll() } process.exit(code) }
module.exports = { P, PORT, WURL, SURL, T0, sleep, mock, call, invite, startLab, startStranger, strangerLog, phone, skipSetup, restoreFile, closeSettingsUI, st, marks, askText, gear, BREAK, verdict, run };
