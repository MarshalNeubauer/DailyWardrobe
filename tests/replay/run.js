#!/usr/bin/env node
/* The audit's replay scripts (tests/replay/scripts/W*.js) as one command: `npm run test:replay`.
   Each script starts its own lab (the real worker.js on an in-memory KV, AI services mocked), drives a WebKit iPhone and
   prints REPRODUCED (the bug is back) or NOT REPRODUCED (still fixed).

   node tests/replay/run.js [--only <prefix>[,<prefix>…]] [--jobs <n>] [--app <dir>] [--record-net] [--no-retry] [--list]
     --only     run only the scripts whose id starts with one of these (W2-13-, W1-9-06)
     --jobs     how many script groups run at once (default: a quarter of the processor threads, 2 to 8)
     --app      test another copy of the app (and its worker.js) instead of this checkout
     --record-net  fetch and save weather/holiday answers not yet in fixtures/net (see harness/net.js); offline otherwise
     --no-retry    don't run a failed script again
     --list     print the groups and scripts and stop

   Scripts of one verifier group share a lab port (verifier N: 9610+10*(N-1)), so a group's scripts run one after another
   and different groups run side by side. A script that doesn't pass is run once more by itself after the rest; the summary
   names it. The exit code is 1 when any script reproduced its bug, gave no verdict, or a kept behavior changed. */
const fs = require('fs'), path = require('path'), os = require('os'), { spawn, spawnSync } = require('child_process');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null };
const flag = k => process.argv.includes('--' + k);
if (arg('app')) process.env.DW_APP = path.resolve(arg('app'));
if (flag('record-net')) process.env.DW_REPLAY_RECORD = '1';
const RP = require('./harness/paths.js');
const NET = require('./harness/net.js');

/* Kept on purpose by the owner: REPRODUCED is the expected result. NOT REPRODUCED means the kept behavior changed. */
const KEPT = { 'W2-19-09': 'the text-size cap at 150% (kept on purpose by the owner)' };

const DIR = RP.SCRIPTS, LOGS = path.join(RP.SCRATCH, 'logs');
const only = (arg('only') || '').split(',').map(s => s.trim()).filter(Boolean);
const ids = fs.readdirSync(DIR).filter(f => /^W\d-\d+-\d+(-[a-z]+)?\.js$/.test(f)).map(f => f.slice(0, -3))
  .filter(id => !only.length || only.some(p => id.startsWith(p)))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const groupOf = id => +id.match(/^W\d-(\d+)-/)[1];
const groups = new Map(); for (const id of ids) { const g = groupOf(id); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(id) }
const TIMES = path.join(LOGS, 'times.json');
let times = {}; try { times = JSON.parse(fs.readFileSync(TIMES, 'utf8')) } catch {}
const est = id => times[id] || (/^W2-18-01/.test(id) ? 300 : 45);
const order = [...groups.entries()].map(([g, list]) => ({ g, list, t: list.reduce((a, id) => a + est(id), 0) })).sort((a, b) => b.t - a.t);
const threads = (os.availableParallelism ? os.availableParallelism() : os.cpus().length);
const JOBS = Math.max(1, +(arg('jobs') || Math.min(8, Math.max(2, Math.floor(threads / 4)))));
const TIMEOUT = 15 * 60e3;

if (flag('list')) {
  for (const o of order) console.log(`group ${o.g} (port ${9610 + 10 * (o.g - 1)}, about ${Math.round(o.t)} s): ${o.list.join(' ')}`);
  process.exit(0);
}
if (!ids.length) { console.log('No replay script matches ' + only.join(', ')); process.exit(1) }

/* the old builds the selected scripts (and their helpers) name, extracted from git before anything starts */
function prepare() {
  const seen = new Set(), shas = new Set();
  const scan = f => { if (seen.has(f)) return; seen.add(f); const s = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const m of s.matchAll(/RP\.old\('([0-9a-f]+)'\)/g)) shas.add(m[1]);
    for (const m of s.matchAll(/require\('\.\/([^']+\.js)'\)/g)) if (fs.existsSync(path.join(DIR, m[1]))) scan(m[1]) };
  for (const id of ids) scan(id + '.js');
  for (const sha of shas) { process.stdout.write(`old build ${sha}: `); try { console.log(RP.old(sha)) } catch (e) { console.log('NOT AVAILABLE: ' + e.message) } }
  RP.ensurePhotos();
}

const killTree = pid => { try { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }); else process.kill(-pid, 'SIGKILL') } catch {} };
const children = new Set();
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { for (const c of children) killTree(c.pid); process.exit(130) });

function runOne(id, attempt) {
  return new Promise(resolve => {
    const t0 = Date.now(), log = path.join(LOGS, `${id}${attempt ? '.retry' : ''}.log`);
    const out = fs.openSync(log, 'w');
    const ch = spawn(process.execPath, [path.join(DIR, id + '.js')], { cwd: DIR, env: { ...process.env, DW_APP: RP.APP, DW_REPLAY_ID: id }, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    children.add(ch);
    let text = '', timedOut = false;
    const take = d => { text += d; fs.writeSync(out, d) };
    ch.stdout.on('data', take); ch.stderr.on('data', take);
    const timer = setTimeout(() => { timedOut = true; killTree(ch.pid) }, TIMEOUT);
    ch.on('close', code => {
      clearTimeout(timer); children.delete(ch); fs.closeSync(out);
      const so = text.replace(/NOT REPRODUCED/g, '');
      const not = /NOT REPRODUCED/.test(text), rep = /\bREPRODUCED\b/.test(so);
      const verdict = timedOut ? 'NO VERDICT (timed out)' : rep ? 'REPRODUCED' : not ? 'NOT REPRODUCED' : `NO VERDICT (exit ${code})`;
      const kept = KEPT[id];
      const ok = kept ? verdict === 'REPRODUCED' : verdict === 'NOT REPRODUCED';
      const why = ok ? (kept ? 'expected (kept)' : 'fixed') : kept && verdict === 'NOT REPRODUCED' ? `KEPT BEHAVIOR CHANGED: ${kept}` : verdict === 'REPRODUCED' ? 'BUG IS BACK' : 'no verdict';
      resolve({ id, verdict, ok, why, s: Math.round((Date.now() - t0) / 1000), log, attempt });
    });
  });
}

(async () => {
  const start = Date.now();
  console.log(`Replay: ${ids.length} script${ids.length === 1 ? '' : 's'} in ${groups.size} group${groups.size === 1 ? '' : 's'}, ${Math.min(JOBS, groups.size)} at a time, app ${RP.APP}`);
  prepare();
  const netStart = fs.existsSync(NET.LOG) ? fs.statSync(NET.LOG).size : 0;
  const results = new Map(), queue = order.slice();
  const lane = async () => { for (let o; (o = queue.shift());) for (const id of o.list) {
    const r = await runOne(id, 0); results.set(id, [r]);
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${id.padEnd(12)} ${r.verdict}${r.ok ? '' : ' - ' + r.why} (${r.s} s)`);
  } };
  await Promise.all(Array.from({ length: Math.min(JOBS, groups.size) }, lane));
  const failed = ids.filter(id => !results.get(id)[0].ok);
  if (failed.length && !flag('no-retry')) {
    console.log(`\nRunning ${failed.length} that didn't pass again, one at a time:`);
    for (const id of failed) { const r = await runOne(id, 1); results.get(id).push(r); console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${id.padEnd(12)} ${r.verdict}${r.ok ? ' (passed on retry)' : ' - ' + r.why} (${r.s} s)`) }
  }
  for (const id of ids) { const r = results.get(id)[0]; times[id] = r.s }
  try { fs.writeFileSync(TIMES, JSON.stringify(times, null, 1)) } catch {}

  // what the network guard refused or couldn't answer during this run, by script
  const net = {};
  try { const buf = fs.readFileSync(NET.LOG, 'utf8').slice(netStart);
    for (const l of buf.split('\n').filter(Boolean)) { const [, id, where, kind, url] = l.split('\t'); let host = url; try { host = new URL(url).host } catch {}
      const k = `${kind} ${where} ${host}`; ((net[id] = net[id] || {})[k] = (net[id][k] || 0) + 1) } } catch {}

  const wall = Math.round((Date.now() - start) / 1000);
  const rows = ids.map(id => { const rs = results.get(id), last = rs[rs.length - 1]; return { id, first: rs[0], last, flaky: !rs[0].ok && last.ok } });
  console.log('\nScript        First run               Result                        Seconds');
  for (const r of rows) console.log(`${r.id.padEnd(13)} ${r.first.verdict.padEnd(23)} ${(r.last.ok ? (r.flaky ? 'ok (flaky: passed on retry)' : r.last.why) : 'FAIL: ' + r.last.why).padEnd(29)} ${r.first.s}${r.flaky ? ' + ' + r.last.s : ''}`);
  const byKind = {};
  for (const [id, m] of Object.entries(net)) for (const [k, n] of Object.entries(m)) { const e = byKind[k] = byKind[k] || { n: 0, ids: [] }; e.n += n; e.ids.push(id) }
  if (Object.keys(byKind).length) { console.log('\nRequests the network guard refused or had no recording for (harness/net.js; the lab\'s worker asking Google Calendar for holidays is expected):');
    for (const [k, e] of Object.entries(byKind)) console.log(`  ${k}: ${e.n} in ${e.ids.length} script${e.ids.length === 1 ? '' : 's'}${e.ids.length <= 6 ? ' (' + e.ids.join(', ') + ')' : ''}`) }
  const bad = rows.filter(r => !r.last.ok), flaky = rows.filter(r => r.flaky);
  fs.writeFileSync(path.join(LOGS, 'summary.tsv'), 'id\tfirst\tresult\tseconds\n' + rows.map(r => `${r.id}\t${r.first.verdict}\t${r.last.ok ? (r.flaky ? 'flaky' : 'ok') : r.last.why}\t${r.first.s}`).join('\n') + '\n');
  console.log(`\n${rows.length - bad.length} of ${rows.length} passed${flaky.length ? `, ${flaky.length} flaky (passed on retry: ${flaky.map(r => r.id).join(', ')})` : ''}; wall clock ${Math.floor(wall / 60)} min ${wall % 60} s with ${Math.min(JOBS, groups.size)} at a time. Logs: ${LOGS}`);
  if (bad.length) { console.log(`FAILED: ${bad.map(r => `${r.id} (${r.last.why})`).join(', ')}`); process.exitCode = 1 }
})().catch(e => { console.error(e && e.stack || e); process.exitCode = 1 });
