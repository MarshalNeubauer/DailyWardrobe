// Shared helpers for verifier 17's repro scripts (tester 17's fashion findings, lab port 9770).
// startLab(tag): fresh lab, fresh kv file kv/verify17-<tag>.json. phone(tag, iso): a fresh phone (profile verify17-<tag>)
// at that time (phone and server), not connected, setup skipped, sample wardrobe loaded, on Today.
const RP = require('../harness/paths.js');
const fs = require('fs'), { spawn } = require('child_process');
const H = RP.H;
const P = require(H + 'phone.js');
const PORT = 9770, WURL = `http://127.0.0.1:${PORT + 1}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lab = null, L = null; const phones = [];
async function startLab(tag) {
  const kv = `${RP.SCRATCH}/kv/verify17-${tag}.json`; try { fs.unlinkSync(kv) } catch {}
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch {}
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  for (let i = 0; i < 150; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) { try { return L = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')) } catch {} } }
  throw new Error('lab did not start');
}
async function stopAll() {
  for (const ph of phones) try { await ph.kill() } catch {}
  if (!lab) return; await sleep(1200); const p = lab; lab = null; p.kill(); await new Promise(r => { p.once('exit', r); setTimeout(r, 3000) });
}
process.on('exit', () => { if (lab) try { lab.kill() } catch {} });
const mock = (w, b) => P.mock(PORT, w, b);
const world = (ph, iso) => P.setWorldTime(ph, PORT, iso);
async function tapText(ph, re) {
  const l = ph.page.locator('button:visible').filter({ hasText: re }).first();
  if (!(await l.count())) return false;
  await l.evaluate(e => e.scrollIntoView({ block: 'center' })); const b = await l.boundingBox(); await ph.tapAt(b.x + b.width / 2, b.y + b.height / 2); await sleep(600); return true;
}
// item ids from a fixed sequence (crypto.randomUUID seeded per page load): the planner breaks ties by id, so random ids gave
// different plans run to run
async function seedIds(ph) {
  await ph.ctx.addInitScript(() => { let n = 0; const base = (localStorage.getItem('v17seed') | 0); localStorage.setItem('v17seed', base + 1);
    crypto.randomUUID = () => { n++; const h = (base * 100000 + n).toString(16).padStart(12, '0'); return `00000000-0000-4000-8000-${h}` } });
}
async function checkUrl(ph) { const w = await ph.page.evaluate(() => localStorage.worker_url || null); if (w && w !== WURL) throw new Error('WORKER URL WRONG ' + w) }
async function phone(tag, iso) {
  const ph = await P.openPhone({ profile: `verify17-${tag}`, fresh: true, time: iso }); phones.push(ph); await seedIds(ph);
  await mock('clock', { at: new Date(iso).toISOString() });
  await ph.page.goto(L.appUrl); await ph.ready(); await sleep(1500); await checkUrl(ph);
  await tapText(ph, /^Skip$/); await sleep(800);
  if (!(await tapText(ph, /Try a sample wardrobe/))) throw new Error('no sample button');
  await sleep(4000);
  for (let i = 0; i < 3; i++) await tapText(ph, /^(Keep it|OK|Got it|Close)$/);
  await ph.page.locator('#n-today').click(); await sleep(1200);
  return ph;
}
// (waits for a toast to go: the missed-days toast lies over the picker's lower cards and takes the tap)
const toastUp = ph => ph.page.evaluate(() => { const t = document.querySelector('#toast'); if (!t) return false; const s = getComputedStyle(t); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && t.textContent.trim() !== '' });
async function reopen(ph) { await ph.reopen(L.appUrl); await ph.ready(); await sleep(2500); await checkUrl(ph); await ph.page.locator('#n-today').click(); await sleep(1000);
  for (let i = 0; i < 30 && await toastUp(ph); i++) await sleep(500) }
const dateShown = ph => ph.page.evaluate(() => (document.body.innerText.match(/(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day, \w+ \d+/) || [''])[0]);
const step = async (ph, dir) => { await tapText(ph, dir > 0 ? /^›$/ : /^‹$/); await sleep(700) };
// a slot row's text in the pieces box ("Tie: Silver" etc.)
const rowText = (ph, label) => ph.page.evaluate(lb => { const r = [...document.querySelectorAll('#ibox .row')].find(r => new RegExp('^' + lb + '(?! clip)').test(r.textContent.trim())); return r ? r.textContent.replace(/[⇄−+↻]/g, ' ').replace(/\s+/g, ' ').trim() : 'none' }, label);
const planned = (ph, k, slot) => ph.page.evaluate(([k, slot]) => { const d = keyDate(k), o = planMonth(d.getFullYear(), d.getMonth())[k]; return o && o[slot] ? { id: o[slot].id, n: nm(o[slot]) } : null }, [k, slot]);
const rec = (ph, k) => ph.page.evaluate(k => dayRecs[k] ? JSON.parse(JSON.stringify(dayRecs[k])) : null, k);
// open the picker of a slot on the day shown and tap a card that isn't the current one (the last listed); returns its item id
async function pickOther(ph, slot, label) {
  const open = await ph.page.$eval('#ibox', e => e.classList.contains('open')).catch(() => false);
  if (!open) { await ph.tap('#ibox .month-link'); await sleep(900) }
  const row = ph.page.locator('#ibox .row').filter({ hasText: new RegExp('^\\s*' + label + '(?! clip)') }).first();
  const b = row.locator('button', { hasText: '⇄' }).first(); await b.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const bb = await b.boundingBox(); await ph.tapAt(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(900);
  const id = await ph.page.evaluate(() => { const c = [...document.querySelectorAll('#pick-sheet .pick-it:not(.cur)')]; const x = c[c.length - 1]; return x ? x.dataset.id : null });
  const card = ph.page.locator('#pick-sheet .pick-it:not(.cur)').last(); await card.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const cb = await card.boundingBox(); await ph.tapAt(cb.x + cb.width / 2, cb.y + cb.height / 2); await sleep(1200);
  return id;
}
// tester 17's wardrobe (35 pieces), by Add → Import from a spreadsheet (pasted). Two things the import can't say are set in the page
// (said in the verify report): the own color "Dusty pink" (#D8A1A8, behaves like tan; tester made it with Add as a new color) and
// the watch's brown leather strap; and the vest on every suit day (setup's choice; setup was skipped).
const WARDROBE = `Type,Colour,Second colour,Pattern,Name,Style,Leather,Metal,Vest,Kind
Suit,Dusty pink,,Solid,Rose summer suit,,,,Yes,
Suit,Navy,White,Chalk stripe,Navy chalk stripe,,,,Yes,
Suit,Charcoal,,Glen check,Prince of Wales,,,,Yes,
Blazer,Brown,,Tweed,,,,,,
Blazer,Mid grey,,Windowpane,,,,,,
Blazer,Navy,,Solid,,,,,,
Trousers,Mid grey,,Glen check,,,,,,dress
Trousers,Stone,,Solid,Stone,,,,,chinos
Trousers,Navy,,Solid,,,,,,dress
Dress shirt,White,,Solid,,,,,,
Dress shirt,Light blue,,Solid,,,,,,
Dress shirt,Black,,Solid,Black shirt,,,,,
Dress shirt,Pink,White,Gingham,Pink gingham,,,,,
Dress shirt,Mint,,End-on-end,Mint end-on-end,,,,,
Dress shirt,Lavender,,Solid,Lavender dress shirt,,,,,
Tie,Black,,Solid,Black tie,,,,,
Tie,Navy,Burgundy,Paisley,,,,,,
Tie,Navy,,Knit,,,,,,
Tie,Navy,White,Polka dot,,,,,,
Tie,Burgundy,Gold,Foulard,,,,,,
Tie,Pink,,Solid,Pink,,,,,
Shoes,Black,,,Black calf,Oxford,Calf,,,
Shoes,Brown,,,Brown suede loafers,Loafer,Suede,,,
Shoes,Oxblood,,,Oxblood calf,Loafer,Calf,,,
Shoes,Tan,,,Tan calf,Derby,Calf,,,
Shoes,White,,,White leather,Sneaker,Calf,,,
Belt,Brown,,,,,Suede,Gold,,
Belt,Black,,,,,Calf,Silver,,
Belt,Oxblood,,,,,Calf,Silver,,
Socks,Navy,,,,,,,,
Socks,Charcoal,,,,,,,,
Socks,Burgundy,,,,,,,,
Cufflinks,Gold,,,,,,Gold,,
Tie clip,Silver,,,,,,,,
Watch,Brown,,,,,,Gold,,`;
async function wardrobePhone(tag, iso) {
  const ph = await P.openPhone({ profile: `verify17-${tag}`, fresh: true, time: iso }); phones.push(ph); await seedIds(ph);
  await mock('clock', { at: new Date(iso).toISOString() });
  await ph.page.goto(L.appUrl); await ph.ready(); await sleep(1500); await checkUrl(ph);
  await tapText(ph, /^Skip$/); await sleep(800);
  await ph.page.evaluate(async () => { await addCustomColor({ name: 'Dusty pink', hex: '#D8A1A8', base: 'tan', types: ['suit'] }); settings.vestMode = 'always'; await saveUserSettings() });
  await ph.tap('#fr-add'); await sleep(800); await ph.tap('#add-import'); await sleep(800);
  await ph.page.fill('#kit-paste', ''); await ph.tap('#kit-paste'); await ph.page.keyboard.insertText(WARDROBE); await sleep(1200);
  const bad = await ph.page.evaluate(() => kitImp ? kitImp.rows.filter(r => !r.ok || (r.probs && r.probs.length)).map(r => r.line + ':' + (r.why || r.probs.join('; '))) : ['no import']);
  await ph.tap('#kit-imp'); await sleep(3000);
  for (let i = 0; i < 3; i++) await tapText(ph, /^(Keep it|OK|Got it|Close|Done)$/);
  await ph.page.evaluate(async () => { const w = items.find(i => i.type === 'watch'); w.band = 'leather'; w.primaryColor = 'brown'; w.metal = 'gold'; w.updated = Date.now(); await txs('items', 'readwrite', s => s.put(w)); cache = {} });
  await ph.page.locator('#n-today').click(); await sleep(1500);
  return { ph, importNotes: bad, n: await ph.page.evaluate(() => items.length) };
}
// read-only helpers put in the page (inspection only): a day's outfit and score, the picker's labels next to the score each
// piece would give if picked (planned with the pick in memory only, as history.js beltless does; nothing saved)
const INPAGE = `
window.__pm=k=>{const d=keyDate(k);return planMonth(d.getFullYear(),d.getMonth())[k]};   // the day in its own month, whatever month Today shows
window.__sim=(k,slot,id)=>{const o=__pm(k);const prev=dayRecs[k];const rec={...(prev||{date:k})},follow=FOLLOW[slot]||[],force={};
 for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;force[slot]=id;rec.force=force;delete rec.lock;
 dayRecs[k]=rec;cache={};let r;try{const n=__pm(k);const rr=rateOutfit(n);r={score:rr.score,hard:rr.hard,o:__sum(n)}}finally{if(prev)dayRecs[k]=prev;else delete dayRecs[k];cache={}}return r};
window.__sum=o=>o?SLOTS.filter(s=>o[s]).map(s=>s+'='+(o[s].name||nm(o[s]))).join(', '):null;
window.__day=k=>{const o=__pm(k);if(!o||!SLOTS.some(s=>o[s]))return null;const r=rateOutfit(o);return {k,frozen:!!o.frozen,top:o.top&&(o.top.name||nm(o.top)),o:__sum(o),score:r.score,hard:r.hard,miss:r.checks.filter(c=>c.pts<c.max).map(c=>c.label+' '+c.pts+'/'+c.max+': '+(c.why||''))}};
window.__picker=(k,slot)=>{const s0=sel;sel=keyDate(k);try{const o=__pm(k);const pool=slotPool(slot,o);const sc=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1));const best=sc[0][0];
 return sc.map(([f,i])=>({n:i.name||nm(i),tag:fitTag(best-f)[1],cur:!!(o[slot]&&o[slot].id===i.id),score:o[slot]&&o[slot].id===i.id?rateOutfit(o).score:(__sim(k,slot,i.id)||{}).score}))}finally{sel=s0}};
`;
const inpage = ph => ph.page.evaluate(INPAGE);
async function openRowPicker(ph, label) {
  const open = await ph.page.$eval('#ibox', e => e.classList.contains('open')).catch(() => false);
  if (!open) { await ph.tap('#ibox .month-link'); await sleep(900) }
  const row = ph.page.locator('#ibox .row').filter({ hasText: new RegExp('^\\s*' + label + '(?! clip)') }).first();
  const b = row.locator('button', { hasText: '⇄' }).first(); await b.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const bb = await b.boundingBox(); await ph.tapAt(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(900);
  return ph.page.locator('#pick-sheet').innerText();
}
async function tapLoc(ph, l) { await l.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(500); const b = await l.boundingBox();
  // tap a point of the element that nothing covers (dw-v416's storage toast lies over the lower half of the picker's tiles), else its center
  const y = await l.evaluate((e, b) => { for (let f = .5; f > .05; f -= .1) { const y = b.y + b.height * f, h = document.elementFromPoint(b.x + b.width / 2, y); if (h && e.contains(h)) return y } return b.y + b.height / 2 }, b);
  await ph.tapAt(b.x + b.width / 2, y); await sleep(1200) }
async function pickByName(ph, label, re) { const list = await openRowPicker(ph, label); await tapLoc(ph, ph.page.locator('#pick-sheet .pick-it').filter({ has: ph.page.locator('.pick-nm', { hasText: re }) }).first()); return list }
const scoreBox = ph => ph.page.evaluate(() => { const b = document.querySelector('#sbox'); if (!b) return null; const fix = b.querySelector('.sfix small'); return { head: b.querySelector('.month-link').getAttribute('aria-label'), fix: fix && fix.textContent, fixes: [...b.querySelectorAll('.sfixbtn')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), why: [...b.querySelectorAll('li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).filter(t => !t.startsWith('✓')) } });
async function goDay(ph, k) { await ph.page.evaluate(k => { sel = keyDate(k); renderToday() }, k); await sleep(800) }   // (stands in for tapping › several times)
function verdict(ok, ev) { console.log(ok ? 'REPRODUCED' : 'NOT REPRODUCED'); console.log(JSON.stringify(ev, null, 1)) }
async function run(fn) { let code = 0; try { await fn() } catch (e) { console.log('ERROR', e && e.stack || e); code = 2 } finally { await stopAll() } process.exit(code) }
module.exports = { PORT, sleep, mock, world, startLab, wardrobePhone, useLab: l => { L = l }, get lab() { return L }, inpage, openRowPicker, tapLoc, pickByName, scoreBox, goDay, phone, reopen, tapText, dateShown, step, rowText, planned, rec, pickOther, verdict, run };
