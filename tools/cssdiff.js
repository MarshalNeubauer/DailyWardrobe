// Computed-style diff of two stylesheets over every screen and sheet of the app (WebKit iPhone 17 Pro, the replay harness).
// One phone with the sample wardrobe; for each matrix cell and scene: open the scene under BEFORE, freeze animations,
// record every computed property of every element (plus ::before/::after with content, ::placeholder, ::marker) and its box,
// swap the page to AFTER, freeze, record again, list each difference. The DOM is the same for both records.
//   node tools/cssdiff.js [--before file] [--after file] [--cells a,b] [--scenes x,y] [--empty] [--shots dir] [--out name] [--port n]
// BEFORE is origin/main's styles.css unless given, AFTER the checkout's. --empty: the app with no wardrobe (the first screens).
// Writes <scratch>/cssdiff/<out>.json (each difference: element, pseudo-element, property, before, after) and prints a summary;
// `node tools/cssdiff.js --show <out>` lists them grouped. A lab on --port (default 9350) and the next port; scratch is
// DW_REPLAY_SCRATCH or tests/replay/.work.
const WT = require('path').resolve(__dirname, '..').split('\\').join('/');
const H = WT + '/tests/replay/harness/';
const RP = require(H + 'paths.js'), P = require(H + 'phone.js');
const fs = require('fs'), path = require('path'), { spawn, execSync } = require('child_process');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null };
const PORT = +(arg('port') || 9350), T0 = '2026-11-16T07:40:00+03:00', sleep = ms => new Promise(r => setTimeout(r, ms));
const OUTDIR = RP.SCRATCH + '/cssdiff'; fs.mkdirSync(OUTDIR, { recursive: true });
const BEFORE = arg('before') ? fs.readFileSync(arg('before'), 'utf8') : execSync('git -C ' + WT + ' show origin/main:styles.css', { encoding: 'utf8', maxBuffer: 1e8 });
const AFTER = fs.readFileSync(arg('after') || WT + '/styles.css', 'utf8');
const SHOTDIR = arg('shots'), SHOTS = !!SHOTDIR;

const MATRIX = [
  { name: 'light-402-100', scheme: 'light', w: 402, ts: 1 },
  { name: 'dark-402-100', scheme: 'dark', w: 402, ts: 1 },
  { name: 'light-320-100', scheme: 'light', w: 320, ts: 1 },
  { name: 'dark-320-100', scheme: 'dark', w: 320, ts: 1 },
  { name: 'light-402-150', scheme: 'light', w: 402, ts: 1.5 },
  { name: 'dark-402-150', scheme: 'dark', w: 402, ts: 1.5 },
  { name: 'light-320-150', scheme: 'light', w: 320, ts: 1.5 },
  { name: 'dark-320-150', scheme: 'dark', w: 320, ts: 1.5 },
  // the theme button (data-theme) against the device's scheme, both ways
  { name: 'btndark-on-light-402', scheme: 'light', theme: 'dark', w: 402, ts: 1 },
  { name: 'btnlight-on-dark-402', scheme: 'dark', theme: 'light', w: 402, ts: 1 },
  // the other media queries: wide (>=600), landscape phone, reduced motion, small text
  { name: 'light-700-100', scheme: 'light', w: 700, h: 900, ts: 1 },
  { name: 'dark-700-100', scheme: 'dark', w: 700, h: 900, ts: 1 },
  { name: 'land-874x402', scheme: 'light', w: 874, h: 402, ts: 1 },
  { name: 'reduce-402', scheme: 'light', w: 402, ts: 1, motion: 'reduce' },
  { name: 'light-402-85', scheme: 'light', w: 402, ts: .85 },
];

// scenes: page-side code run under the BEFORE sheet; closeAll first
const SCENES = [
  ['today', "show('today');scrollTo(0,0)"],
  ['today-open', "show('today');document.querySelectorAll('#today .mbox:not(.open) .month-link').forEach(b=>{try{b.click()}catch{}})"],
  ['today-next', "show('today');const b=document.querySelector('#today .nav button:last-of-type');if(b)b.click()"],
  ['today-swatch', "show('today');const s=document.querySelector('#today .ovsw');if(s)s.click()"],
  ['wardrobe', "show('wardrobe')"],
  ['wardrobe-search', "show('wardrobe');const i=document.querySelector('#wardrobe .wsearch');if(i){i.value='navy';i.dispatchEvent(new Event('input',{bubbles:true}))}"],
  ['stats', "show('stats')"],
  ['stats-open', "show('stats');document.querySelectorAll('#stats details:not([open])').forEach(d=>d.open=true);document.querySelectorAll('#stats .mbox:not(.open) .month-link').forEach(b=>{try{b.click()}catch{}})"],
  ['care', 'HOOK.openCare()'],
  ['pack', 'openPack()'],
  ['add', 'openAdd()'],
  ['nps', 'openAdd();HOOK.addManual()'],
  ['import', 'openAdd();kitImportOpen()'],
  ['tour', 'tourOpen()'],
  ['settings', 'openSettings()'],
  ['settings-open', "openSettings();document.querySelectorAll('#settings-modal .scat-head').forEach(h=>{try{h.click()}catch{}});document.body.classList.add('owner');document.querySelectorAll('#settings-modal .adv-head').forEach(h=>{try{h.click()}catch{}})"],
  ['settings-focus', "openSettings();document.querySelectorAll('#settings-modal .scat-head').forEach(h=>{try{h.click()}catch{}})", 'tab'],
  ['setup', 'HOOK.setupOpen(true)'],
  ['item-suit', "show('wardrobe');if(typeof CK_OPEN!=='undefined')CK_OPEN['*']=true;openItem(items.find(i=>i.type==='suit').id)"],
  ['item-shirt', "show('wardrobe');openItem(items.find(i=>i.type==='shirt').id)"],
  ['item-tie', "show('wardrobe');openItem(items.find(i=>i.type==='tie').id)"],
  ['colsheet', "show('wardrobe');openItem(items.find(i=>i.type==='suit').id);setTimeout(()=>{const b=document.querySelector('#item-view .colbtn');if(b)b.click()},300)"],
  ['patsheet', "show('wardrobe');openItem(items.find(i=>i.type==='shirt').id);setTimeout(()=>{const b=document.querySelector('#item-view .patbtn');if(b)b.click()},300)"],
  ['colnew', "show('wardrobe');const it=items.find(i=>i.type==='shirt');openItem(it.id);openColPick('e',it.id,'primaryColor');setTimeout(()=>{const b=document.querySelector('#cn-open');if(b)b.click()},300)"],
  ['patnew', "show('wardrobe');const it=items.find(i=>i.type==='shirt');openItem(it.id);setTimeout(()=>{const b=document.querySelector('#item-view .patbtn');if(b)b.click();setTimeout(()=>{const c=document.querySelector('#pn-open');if(c)c.click()},300)},300)"],
  ['closeup', "show('wardrobe');closeupPick({mode:'add'})"],
  ['reading', "show('wardrobe');const it=items.find(i=>i.type==='suit');openItem(it.id);const col={kind:'pattern',ask:'That sounds like a pattern.',accents:['olive','brown','black']};HOOK.rd={src:'e',id:it.id,run:7,state:'result',c:HOOK.rdColOf(col),p:{na:'fail'},m:null,a:HOOK.rdAccOf(it,col),sent:{wb:true}};HOOK.rdOpen();HOOK.rdRender(true)"],
  ['picker', "show('today');openPicker('shirt')"],
  ['picker-tie', "show('today');openPicker('tie')"],
  ['shop', "show('stats');HOOK.openShop()"],
  ['ask-danger', "show('wardrobe');askConfirm('Delete the navy suit?\\n\\nIt goes from every device.',{ok:'Delete',danger:true})"],
  ['ask', "show('today');askConfirm('Start the plan over?',{ok:'Start over'})"],
  ['toast', "show('today');toast('Removed the navy tie',99999,{label:'Undo',fn:()=>{}})"],
  ['about', "openSettings();const h=[...document.querySelectorAll('#settings-modal .scat-head')].pop();if(h)h.click();const e=document.querySelector('#settings-modal .sbody,#settings-modal');if(e)e.scrollTop=1e6"],
];
const CLOSE = `window.__close=()=>{
  try{if(typeof asking!=='undefined'&&asking)askAnswer(false)}catch{}
  try{if('rd' in HOOK&&HOOK.rd)HOOK.rdClose()}catch{}
  try{if(typeof cuOpen!=='undefined'&&cuOpen)HOOK.closeupClose()}catch{}
  try{if(typeof kit!=='undefined'&&kit)kitClose()}catch{}
  try{if(typeof colPick!=='undefined'&&colPick)closeColPick()}catch{}
  try{closePicker()}catch{} try{closeShop()}catch{}
  try{if(typeof npsId!=='undefined'&&npsId&&'npsClose' in HOOK)HOOK.npsClose()}catch{}
  try{if(typeof npsCancel==='function'&&document.querySelector('#nps-sheet.on'))npsCancel()}catch{}
  try{if(document.querySelector('#item-view.on'))HOOK.closeItem()}catch{}
  try{closeSettings()}catch{}
  try{if(document.querySelector('#setup.on')&&'setupClose' in HOOK)HOOK.setupClose()}catch{}
  try{const t=document.querySelector('#toast');if(t){t.classList.remove('on','show','act')}}catch{}
  document.body.classList.remove('owner');
  try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur()}catch{}
}`;

// in-page recorder
const REC = () => {
  const W = window.__cd = {};
  W.setCss = t => {
    let st = document.getElementById('cdcss'); const link = document.querySelector('link[rel=stylesheet][href="styles.css"]');
    if (!st) { st = document.createElement('style'); st.id = 'cdcss'; link.after(st) }
    st.textContent = t; link.disabled = true; void document.documentElement.offsetHeight;
  };
  W.freeze = () => {
    for (const a of document.getAnimations()) {
      try { const t = a.effect && a.effect.getComputedTiming(); if (t && isFinite(t.endTime)) a.finish(); else { a.pause(); a.currentTime = 0 } } catch (e) { try { a.cancel() } catch { } }
    }
  };
  let PROPS = null;
  const props = () => { if (PROPS) return PROPS; const cs = getComputedStyle(document.documentElement); PROPS = []; for (let i = 0; i < cs.length; i++) if (!cs[i].startsWith('--')) PROPS.push(cs[i]); return PROPS };
  const PSEUDO = ['::before', '::after', '::placeholder', '::marker', '::-webkit-details-marker'];
  const desc = el => {
    let s = '', e = el;
    for (let k = 0; e && e.nodeType === 1 && k < 4; k++, e = e.parentElement) {
      let t = e.tagName.toLowerCase(); if (e.id) { s = '#' + e.id + (s ? '>' + s : ''); break }
      if (e.classList && e.classList.length) t += '.' + [...e.classList].slice(0, 3).join('.');
      s = t + (s ? '>' + s : '');
    }
    return s;
  };
  const snap = (el, pseudo) => { const cs = getComputedStyle(el, pseudo || null); const t = cs.cssText; if (t) return t; const P = props(); const v = new Array(P.length); for (let i = 0; i < P.length; i++) v[i] = cs.getPropertyValue(P[i]); return v.join('\u0001') };
  const split = s => { if (s.indexOf('\u0001') >= 0 || !/: /.test(s)) { const P = props(), a = s.split('\u0001'), o = {}; P.forEach((p, i) => o[p] = a[i]); return o } const o = {}; for (const part of s.split(/; (?=[-a-z]+: )/)) { const k = part.indexOf(': '); if (k > 0) o[part.slice(0, k)] = part.slice(k + 2).replace(/;$/, '') } return o };
  const cmpStr = (x, y, push, z) => { if (x === y) return 0; const X = split(x), Y = split(y), Z = z == null ? null : split(z); let n = 0; for (const k of new Set([...Object.keys(X), ...Object.keys(Y)])) if (X[k] !== Y[k]) { if (!Z || Z[k] === X[k]) { push(k, X[k], Y[k]); n++ } } return n };
  const hasContent = (el, ps) => { if (ps !== '::before' && ps !== '::after') return true; const c = getComputedStyle(el, ps).content; return c && c !== 'none' && c !== 'normal' };
  const want = (el, ps) => ps === '::before' || ps === '::after' ? true : ps === '::placeholder' ? /^(INPUT|TEXTAREA)$/.test(el.tagName) : ps === '::marker' ? /^(LI|SUMMARY)$/.test(el.tagName) : el.tagName === 'SUMMARY';
  W.record = () => {
    const m = new Map(); const els = [document.documentElement, ...document.documentElement.querySelectorAll('*')];
    for (const el of els) {
      if (el.id === 'cdcss' || el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
      const r = el.getBoundingClientRect();
      const rec = { v: snap(el), r: [r.x, r.y, r.width, r.height].map(x => Math.round(x * 100) / 100).join(','), ps: {} };
      for (const ps of PSEUDO) if (want(el, ps) && hasContent(el, ps)) rec.ps[ps] = snap(el, ps);
      m.set(el, rec);
    }
    return m;
  };
  W.a = null;
  W.recA = () => { W.a = W.record(); return W.a.size };
  W.recB = () => { W.b = W.record(); let n = 0; for (const [el, A] of W.a) { const B = W.b.get(el); if (!B) continue; if (A.v !== B.v || A.r !== B.r || JSON.stringify(A.ps) !== JSON.stringify(B.ps)) n++ } W.sigs = W.sigs || new Set(); for (const el of W.a.keys()) W.sigs.add(el.tagName.toLowerCase() + '|' + (el.id || '') + '|' + [...el.classList].sort().join(' ')); return n };
  W.sigList = () => [...(W.sigs || [])];
  W.diffB = (cap) => {
    const b = W.b, a2 = W.record(), P = props(), out = []; let n = 0, els = 0, unstable = 0;
    const push = (el, ps, prop, x, y) => { n++; if (out.length < cap) out.push([desc(el), ps, prop, x, y]) };
    for (const [el, A] of W.a) {
      const B = b.get(el), C = a2.get(el); if (!B || !C) continue; els++;
      if (A.v !== B.v) { if (A.v === C.v) cmpStr(A.v, B.v, (k, x, y) => push(el, '', k, x, y)); else unstable++ }
      if (A.r !== B.r) { if (A.r === C.r) push(el, '', 'BOX', A.r, B.r); else unstable++ }
      const pss = new Set([...Object.keys(A.ps), ...Object.keys(B.ps)]);
      for (const ps of pss) {
        const x = A.ps[ps], y = B.ps[ps];
        if (!x || !y) { push(el, ps, 'PSEUDO-PRESENCE', x ? 'yes' : 'no', y ? 'yes' : 'no'); continue }
        const z = C.ps[ps]; if (x !== y) { if (z === x) cmpStr(x, y, (k, p, q) => push(el, ps, k, p, q)); else unstable++ }
      }
    }
    return { els, props: P.length, n, out, unstable };
  };
};

let lab = null;
async function main() {
  const kv = `${RP.SCRATCH}/kv/cssdiff.json`; try { fs.unlinkSync(kv) } catch { }
  try { fs.unlinkSync(RP.labInfo(PORT)) } catch { }
  lab = spawn(process.execPath, [H + 'lab.js', '--port', String(PORT), '--kv', kv], { stdio: ['ignore', 'ignore', 'pipe'] });
  lab.stderr.on('data', d => process.stderr.write('[lab] ' + d));
  let info = null; for (let i = 0; i < 200 && !info; i++) { await sleep(100); if (fs.existsSync(RP.labInfo(PORT))) try { info = JSON.parse(fs.readFileSync(RP.labInfo(PORT), 'utf8')) } catch { } }
  if (!info) throw new Error('lab did not start');
  await P.mock(PORT, 'clock', { at: new Date(T0).toISOString() });
  const ph = await P.openPhone({ profile: 'cssdiff' + PORT, fresh: true, time: T0, colorScheme: 'light' });
  const p = ph.page;
  await p.goto(info.inviteLink); await ph.ready(); await sleep(2000);
  if (await p.locator('#su-skip').isVisible().catch(() => false)) { await ph.tap('#su-skip'); await sleep(800) }
  const EMPTY = process.argv.includes('--empty');
  if (!EMPTY) { await ph.tap('#today button:has-text("Try a sample wardrobe")'); await sleep(4000) }
  await p.keyboard.press('Escape'); await sleep(300);
  await p.evaluate(REC); await p.evaluate(CLOSE);
  const onlyCells = arg('cells') ? arg('cells').split(',') : null, onlyScenes = arg('scenes') ? arg('scenes').split(',') : null;
  const report = { when: new Date().toISOString(), cells: {} }; let total = 0, scenesRun = 0, elsTotal = 0;
  if (SHOTS) fs.mkdirSync(SHOTDIR, { recursive: true });
  for (const m of MATRIX) {
    if (onlyCells && !onlyCells.includes(m.name)) continue;
    await p.setViewportSize({ width: m.w, height: m.h || 874 });
    await p.emulateMedia({ colorScheme: m.scheme, reducedMotion: m.motion || 'no-preference' });
    await p.evaluate(([ts, th]) => { const d = document.documentElement; d.style.setProperty('--tscale', String(ts)); d.classList.toggle('bigtext', ts >= 1.3); if (th) d.dataset.theme = th; else delete d.dataset.theme }, [m.ts, m.theme || null]);
    const cell = report.cells[m.name] = {};
    for (const [nm, code, extra] of SCENES) {
      if (onlyScenes && !onlyScenes.includes(nm)) continue;
      if (EMPTY && !['today', 'wardrobe', 'stats', 'add', 'settings-open', 'setup', 'tour', 'import', 'nps', 'care', 'pack', 'about'].includes(nm)) continue;
      await p.evaluate(b => window.__cd.setCss(b), BEFORE);
      await p.evaluate(() => window.__close()); await sleep(250);
      const err = await p.evaluate(c => { try { (0, eval)(c); return null } catch (e) { return String(e && e.message || e) } }, code);
      await sleep(1000);
      if (extra === 'tab') { await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await sleep(200) }
      await p.evaluate(() => window.__cd.freeze()); await sleep(50); await p.evaluate(() => window.__cd.freeze());
      if (SHOTS) await p.screenshot({ path: `${SHOTDIR}/${m.name}-${nm}-before.png` });
      const nEl = await p.evaluate(() => window.__cd.recA());
      await p.evaluate(a => { window.__cd.setCss(a) }, AFTER);
      await p.evaluate(() => window.__cd.freeze()); await sleep(50); await p.evaluate(() => window.__cd.freeze());
      const quick = await p.evaluate(() => window.__cd.recB());
      if (SHOTS) await p.screenshot({ path: `${SHOTDIR}/${m.name}-${nm}-after.png` });
      let d = { els: nEl, n: 0, out: [], unstable: 0 };
      if (quick) {   // something differs: record BEFORE again and keep only what was the same in both BEFORE records
        await p.evaluate(b => window.__cd.setCss(b), BEFORE);
        await p.evaluate(() => window.__cd.freeze()); await sleep(50); await p.evaluate(() => window.__cd.freeze());
        d = await p.evaluate(() => window.__cd.diffB(400));
      }
      cell[nm] = { err, els: d.els, n: d.n, out: d.out, unstable: d.unstable };
      total += d.n; scenesRun++; elsTotal += d.els;
      if (d.n || err) console.log(`${m.name} ${nm}: ${d.n} differences over ${d.els} elements${err ? ' (scene error: ' + err + ')' : ''}`);
    }
    console.log(`cell ${m.name} done`);
  }
  await p.evaluate(b => window.__cd.setCss(b), BEFORE);
  report.total = total; report.scenes = scenesRun; report.elementsCompared = elsTotal; report.props = await p.evaluate(() => getComputedStyle(document.documentElement).length);
  report.pageErrors = ph.errors.slice(0, 30);
  const name = arg('out') || 'diff';
  fs.writeFileSync(`${OUTDIR}/${name}.json`, JSON.stringify(report, null, 1));
  console.log(`TOTAL ${total} differences; ${scenesRun} scene x cell records; ${elsTotal} element records; ${report.props} properties each; page errors ${ph.errors.length}`);
  await ph.kill();
}
if (process.argv.includes('--show')) show(arg('show')); else main().catch(e => { console.log('ERROR', e && e.stack || e); process.exitCode = 2 }).finally(async () => { if (lab) { lab.kill(); await sleep(500) } });



function show(name) {
  const r = JSON.parse(fs.readFileSync(OUTDIR + '/' + name + '.json', 'utf8')), g = {};
  console.log('total', r.total, 'scene records', r.scenes, 'element records', r.elementsCompared, 'properties', r.props);
  for (const [c, sc] of Object.entries(r.cells)) for (const [s, d] of Object.entries(sc)) {
    if (d.err) console.log('scene error', c, s, d.err);
    for (const [el, ps, prop, a, b] of d.out) { const k = el + ps + ' | ' + prop + ': ' + a + ' -> ' + b; (g[k] = g[k] || []).push(c + '/' + s) }
  }
  for (const k of Object.keys(g).sort()) console.log(k.slice(0, 300), ' [' + g[k].length + '] ' + g[k].slice(0, 3).join(' '));
}
