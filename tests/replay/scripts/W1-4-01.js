// W1-4-01: a phone still on the 15 Nov a app (PLAN_RULES 14) saves a setting and backs up; today's phone (PLAN_RULES 15)
// takes the synced settings with planRules 14 and, at its next start, re-plans the week again ("The planner was updated").
// Standalone (verifier 4): lab on port 9640, fresh profiles verify4-r01-*, kv .work/kv/verify4-r01.json.
// node tests/replay/run.js --only W1-4-01
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const { openPhone, mock: mk } = require(H + 'phone.js');
const PORT = 9640, KV = RP.SCRATCH + '/kv/verify4-r01.json';
const OLD = RP.old('c4a549b'), NEW = RP.APP;
const TIME = '2026-11-16T07:30:00+03:00';
const PICS = fs.readdirSync(RP.SAMPLES_A).filter(f => /\.jpg$/i.test(f)).sort().slice(0, 7).map(f => RP.SAMPLES_A + '/' + f);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mock = (w, b) => mk(PORT, w, b);
let lab = null;
async function startLab(app) {
  if (lab) await stopLab();
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--app', app, '--worker', NEW, '--kv', KV], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 100; i++) { await sleep(150); if (fs.existsSync(RP.labInfo(PORT))) { try { const j = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')); await mock('clock', { at: new Date(TIME).toISOString() }); return j } catch {} } }
  throw new Error('lab did not start');
}
async function stopLab() { if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) }) }
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
// record every toast text from page start (init script, so an early toast at start-up is not missed)
const TOASTS = () => { window.__toasts = []; const go = () => { const t = document.querySelector('#toast'); if (!t) return setTimeout(go, 50);
  new MutationObserver(() => { const s = t.innerText.trim(); if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s) }).observe(t, { childList: true, subtree: true, characterData: true }) }; go() };
const phone = async name => { const p = await openPhone({ profile: 'verify4-r01-' + name, fresh: true, time: TIME }); await p.ctx.addInitScript(TOASTS);
  const o = p.open; p.open = async () => { const pg = await o(); await p.ctx.addInitScript(TOASTS); return pg }; return p };   // reopen makes a new context
const guard = async p => { const u = await p.page.evaluate(() => localStorage.worker_url); if (u && u !== `http://127.0.0.1:${PORT + 1}/`) throw new Error('worker_url wrong: ' + u) };
async function tapBtn(p, re, scope = 'body') { const l = p.page.locator(scope).getByRole('button', { name: re }).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); const b = await l.boundingBox(); if (!b) throw new Error('no button ' + re); await p.tapAt(b.x + b.width / 2, b.y + b.height / 2); await sleep(500) }
async function skipSetup(p) { for (let i = 0; i < 4; i++) { let hit = false; for (const re of [/^Skip$/, /^Not now$/, /^Later$/]) if (await p.page.getByRole('button', { name: re }).first().isVisible().catch(() => false)) { await tapBtn(p, re); hit = true } if (!hit) break } }
const sync = p => p.page.evaluate(async () => { for (let i = 0; i < 100 && (window.syncing || window.syncRun); i++) await new Promise(r => setTimeout(r, 200)); return syncNow() });
const rules = p => p.page.evaluate(async () => ({ mem: settings.planRules, idb: ((await metaGet('settings')) || {}).planRules, PLAN_RULES }));
const toasts = p => p.page.evaluate(() => window.__toasts || []);
const planned = t => t.some(s => /planner was updated/i.test(s));
async function setLaundry(p, v) { await p.page.evaluate(() => openSettings('care')); await sleep(600); await p.page.selectOption('#cfg-laundry', String(v)); await sleep(300); await tapBtn(p, /^Done$/, '#settings-modal'); await sleep(600) }
async function restart(p) { await p.reopen(`http://127.0.0.1:${PORT}/index.html`); await p.ready().catch(() => {}); await sleep(6000); return { toasts: await toasts(p), rules: await rules(p) } }
const out = {};
(async () => {
  fs.rmSync(KV, { force: true });
  // 1. 15 Nov a app (today's server): P joins, skips setup, adds 7 photos as One item, Save all, backs up
  const info = await startLab(OLD); const LINK = info.inviteLink;
  const P = await phone('P'); await P.page.goto(LINK); await P.ready(); await sleep(3500); await guard(P); await skipSetup(P);
  await tapBtn(P, /^Wardrobe$/); await P.tap('#ward-add'); await sleep(600);
  await P.page.setInputFiles('#add-one input[type=file]', PICS);
  for (let i = 0; i < 120; i++) { await sleep(500); if (i > 4 && await P.page.evaluate(() => !queue.some(q => q.busy || q.refining || q.patternReading))) break }
  await tapBtn(P, /Save all/); for (let i = 0; i < 40 && await P.page.evaluate(() => queue.length); i++) await sleep(500);
  await tapBtn(P, /^Today$/); await sleep(1500); await sync(P);
  out.P = { items: await P.page.evaluate(() => items.length), rules: await rules(P) };
  // 2. app and server updated (same port, same kv); P's page stays open on the old code. Q joins on today's app
  await startLab(NEW);
  const Q = await phone('Q'); await Q.page.goto(LINK); await Q.ready(); await sleep(5000); await guard(Q); await skipSetup(Q);
  await sync(Q); await sleep(1500); await sync(Q);
  out.Qjoined = { items: await Q.page.evaluate(() => items.length), rules: await rules(Q) };
  out.Qstart1 = await restart(Q);            // the one expected re-plan (the backup said 14)
  await sync(Q);
  out.Qstart2_quiet = await restart(Q);      // baseline: nothing happened elsewhere, should be quiet
  // 3. the old phone changes Laundry through Settings and backs up; Q backs up
  await setLaundry(P, 2); await sync(P); out.Pafter = await rules(P);
  await sync(Q); out.QafterPsave = await rules(Q);
  // 4. Q restarts: re-plans again
  out.Qstart3 = await restart(Q);
  // repeat with Laundry 1
  await sync(Q); await setLaundry(P, 1); await sync(P); await sync(Q); out.QafterPsave2 = await rules(Q);
  out.Qstart4 = await restart(Q);
  out.Qstart5_info = await restart(Q);       // informational: P idle; a re-plan here = the 14 came back after start 4's re-plan
  out.errors = { P: P.errors.filter(e => !/open-meteo|nager|Failed to load/i.test(e)).slice(0, 5), Q: Q.errors.filter(e => !/open-meteo|nager|Failed to load/i.test(e)).slice(0, 5) };
  await P.kill(); await Q.kill(); await stopLab();
  console.log(JSON.stringify(out, null, 1));
  const rep = out.QafterPsave.idb === 14 && planned(out.Qstart3.toasts) && !planned(out.Qstart2_quiet.toasts) && out.QafterPsave2.idb === 14 && planned(out.Qstart4.toasts);
  console.log(rep ? 'REPRODUCED' : 'NOT REPRODUCED');
  process.exit(0);
})().catch(async e => { console.log(JSON.stringify(out, null, 1)); console.log('ERROR ' + (e.stack || e)); console.log('NO VERDICT (error)'); await stopLab(); process.exit(1) });
