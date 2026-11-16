/* What the replay tests may reach outside this machine: nothing.

   The app asks two public data services: Open-Meteo (weather, climate, city search) and Nager.Date (public holidays).
   Their answers are recorded once into fixtures/net/<host>/<hash>.json and played back from there, so the tests run
   offline and give the same answer every day. Everything else that isn't 127.0.0.1 (the real server, OpenAI, Anthropic,
   any other host) is refused, and each refusal is printed and noted in .work/logs/net-blocked.log, which
   tests/replay/run.js reads back into its summary. Pages are guarded twice: Playwright routes, and a browser proxy that
   refuses every connection (backstopProxy). The lab's worker gets nodeAnswer for every outside fetch; the scripts'
   own Node fetch is limited to 127.0.0.1 by paths.js.

   DW_REPLAY_RECORD=1 (`node tests/replay/run.js --record-net`): an answer not recorded yet is fetched from the service
   itself and saved. Without it, an unrecorded question is answered 503 and noted as "unrecorded" (the app then behaves
   as when that service is down). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = require('./paths.js');
const DATA_HOSTS = /^https:\/\/([a-z-]+\.)?open-meteo\.com\/|^https:\/\/date\.nager\.at\//i;
const NETDIR = path.join(R.REPLAY, 'fixtures', 'net');
const LOG = path.join(R.SCRATCH, 'logs', 'net-blocked.log');
const RECORD = process.env.DW_REPLAY_RECORD === '1';
const who = () => process.env.DW_REPLAY_ID || path.basename(process.argv[1] || 'node');
const note = (kind, url, where) => {
  const line = `${new Date().toISOString()}\t${who()}\t${where}\t${kind}\t${url}`;
  console.error(`[replay-net] ${kind.toUpperCase()} ${where} request to ${url}`);
  try { fs.appendFileSync(LOG, line + '\n') } catch {}
};
const fileOf = url => { const u = new URL(url); return path.join(NETDIR, u.hostname, crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.json') };
/* only in record mode, and only to the two data services */
function liveFetch(url) {
  return new Promise((resolve, reject) => {
    require('https').get(url, { headers: { 'user-agent': 'replay-recorder' } }, res => {
      const ch = []; res.on('data', d => ch.push(d)); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || 'application/json', body: Buffer.concat(ch).toString('utf8') }));
    }).on('error', reject);
  });
}
/* the recorded answer to a data-service URL: {status, type, body}, or null when it isn't recorded (and not recording) */
async function answer(url, where) {
  const f = fileOf(url);
  if (fs.existsSync(f)) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j }
  if (!RECORD) { note('unrecorded', url, where); return null }
  const r = await liveFetch(url);
  const j = { url, status: r.status, type: r.type, body: r.body, recorded: new Date().toISOString().slice(0, 10) };
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp' + process.pid, JSON.stringify(j, null, 1)); fs.renameSync(f + '.tmp' + process.pid, f);
  console.error(`[replay-net] recorded ${url}`);
  return j;
}
const isLocal = url => R.LOCAL.test(url) || /^(data|blob|about):/i.test(url);
const isData = url => DATA_HOSTS.test(url);

/* Pages ask the data services through this local server: GET /net?u=<url> gives the recorded answer. With the app's
   service worker in control, WebKit sends a page's cross-origin fetch past Playwright's routes (the backstop proxy then
   refuses it), so an init script points the page's fetch for those two services here instead. */
let replay = null;
function replayServer() {
  if (!replay) replay = new Promise(resolve => {
    const http = require('http');
    const srv = http.createServer(async (q, r) => {
      const cors = { 'access-control-allow-origin': '*' };
      const url = new URL(q.url, 'http://x').searchParams.get('u') || '';
      if (q.method === 'OPTIONS') { r.writeHead(204, { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET' }); return r.end() }
      if (!isData(url)) { note('blocked', url, 'phone'); r.writeHead(403, cors); return r.end('blocked in the replay tests') }
      const a = await answer(url, 'phone').catch(e => { note('record-failed ' + e.message, url, 'phone'); return null });
      if (!a) { r.writeHead(503, { ...cors, 'content-type': 'text/plain' }); return r.end('not recorded (replay tests are offline)') }
      r.writeHead(a.status, { ...cors, 'content-type': a.type }); r.end(a.body);
    });
    srv.listen(0, '127.0.0.1', () => { srv.unref(); resolve('http://127.0.0.1:' + srv.address().port) });
  });
  return replay;
}

/* For a Playwright browser context: every request the pages and their workers make goes through here */
async function guardContext(ctx) {
  await ctx.addInitScript(([base, re]) => {
    const R = new RegExp(re, 'i'), f0 = window.fetch;
    window.fetch = function (u, o) {
      const s = String(u && u.url || u);
      return R.test(s) ? f0.call(this, base + '/net?u=' + encodeURIComponent(s), o) : f0.apply(this, arguments);
    };
  }, [await replayServer(), DATA_HOSTS.source]);
  await ctx.route('**/*', async route => {
    const url = route.request().url();
    if (isLocal(url)) return route.fallback();
    if (isData(url)) {
      const a = await answer(url, 'phone').catch(e => { note('record-failed ' + e.message, url, 'phone'); return null });
      if (a) return route.fulfill({ status: a.status, contentType: a.type, body: a.body, headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ status: 503, contentType: 'text/plain', body: 'not recorded (replay tests are offline)', headers: { 'access-control-allow-origin': '*' } });
    }
    note('blocked', url, 'phone');
    return route.abort('blockedbyclient');
  });
}

/* A second wall behind the routes: the browser is launched with this local proxy, which refuses every connection.
   127.0.0.1 bypasses it, and the routes above answer everything else first, so it sees only a request that got past
   Playwright's routing (WebKit doesn't route every request a service worker makes). */
let proxy = null;
function backstopProxy() {
  if (!proxy) proxy = new Promise(resolve => {
    const http = require('http');
    const px = http.createServer((q, r) => { note('blocked (proxy)', q.url, 'phone'); r.writeHead(403); r.end('blocked in the replay tests') });
    px.on('connect', (q, sock) => { note('blocked (proxy)', 'https://' + q.url + '/', 'phone'); sock.end('HTTP/1.1 403 Forbidden\r\n\r\n') });
    px.listen(0, '127.0.0.1', () => { px.unref(); resolve({ server: 'http://127.0.0.1:' + px.address().port, bypass: '127.0.0.1,localhost,[::1]' }) });
  });
  return proxy;
}

/* For the lab's worker (Node): returns a Response for a data-service URL or a refusal for anything else */
async function nodeAnswer(url) {
  if (isData(url)) {
    const a = await answer(url, 'server');
    if (a) return new Response(a.body, { status: a.status, headers: { 'content-type': a.type } });
    return new Response('not recorded (replay tests are offline)', { status: 503 });
  }
  note('blocked', url, 'server');
  return new Response('blocked in the replay lab', { status: 404 });
}

module.exports = { guardContext, backstopProxy, nodeAnswer, isLocal, isData, LOG };
