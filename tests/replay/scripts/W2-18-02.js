// W2-18-02: Insights freezes the page for seconds in a big wardrobe (whyUnused's fitMemo scores every jacket x trousers x shirt x tie,
// rebuilt on every renderStats, and each Wear-counts fold re-renders the whole page).
// Two accounts, each joined from its own invitation, setup skipped (defaults: jackets, ties), wardrobe by Add -> Import from a
// spreadsheet -> Choose a CSV file. 30 items (baseline) and 300 items, the same mix as tester 18 (13% suits, 7% blazers, 10% trousers,
// 27% shirts, 23% ties, shoes and small pieces), generated here with a fixed seed. Close and reopen, tap Insights, tap "Dress shirts"
// and "Ties" under Wear counts; the longest animation frame is the time the page could not respond.
// node tests/replay/run.js --only W2-18-02
const RP = require('../harness/paths.js');
const V = require('./lib-verify18.js');
const fs = require('fs'), { rng } = require(RP.H + 'phone.js');
function wardrobe(n, seed) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const MIX = [['Suit', .13, ['Navy', 'Charcoal', 'Grey', 'Mid grey', 'Light grey', 'Brown', 'Black', 'Blue'], ['solid', 'pinstripe', 'glen check']],
    ['Blazer', .07, ['Navy', 'Brown', 'Olive', 'Tan', 'Grey'], ['solid', 'tweed', 'windowpane']],
    ['Trousers', .10, ['Grey', 'Charcoal', 'Navy', 'Tan', 'Light grey', 'Stone'], ['solid']],
    ['Dress shirt', .27, ['White', 'Light blue', 'Pink', 'Blue', 'Lavender', 'Light grey'], ['solid', 'stripes', 'gingham']],
    ['Tie', .23, ['Navy', 'Burgundy', 'Red', 'Green', 'Black', 'Grey', 'Blue', 'Purple', 'Brown', 'Gold'], ['solid', 'stripes', 'polka dot', 'paisley']],
    ['Shoes', .08, ['Black', 'Brown', 'Dark brown', 'Oxblood', 'Tan'], ['']],
    ['Belt', .04, ['Black', 'Brown', 'Dark brown', 'Oxblood', 'Tan'], ['']],
    ['Socks', .04, ['Navy', 'Charcoal', 'Burgundy', 'Black'], ['']],
    ['Watch', .01, ['Black'], ['']], ['Tie clip', .015, ['Silver'], ['']], ['Cufflinks', .015, ['Silver'], ['']]];
  const rows = ['Type\tColour\tPattern\tName'];
  let made = 0;
  for (const [t, share, cols, pats] of MIX) { const k = Math.max(1, Math.round(n * share)); for (let i = 0; i < k && made < n; i++, made++) rows.push(`${t}\t${pick(cols)}\t${pick(pats)}\t${t} ${i + 1}`) }
  while (made < n) { rows.push(`Dress shirt\tWhite\tsolid\tExtra shirt ${made}`); made++ }
  return rows.join('\n');
}
const FRAMES = () => { window.__fr = { max: 0, last: performance.now(), on: true }; const f = t => { const d = t - window.__fr.last; if (d > window.__fr.max) window.__fr.max = d; window.__fr.last = t; if (window.__fr.on) requestAnimationFrame(f) }; requestAnimationFrame(f) };
const framesStop = ph => ph.page.evaluate(() => { window.__fr.on = false; return Math.round(window.__fr.max) });
async function measure(tag, text) {
  const n = text.trim().split('\n').length - 1;
  const ph = await V.joined(tag);
  await ph.tap('#fr-add'); await V.sleep(800); await ph.tap('#add-import'); await V.sleep(800);
  await ph.page.locator('input[type=file][data-act-change="kitFilePick"]').setInputFiles({ name: `w${n}.tsv`, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await V.sleep(1500);
  const bad = await ph.page.evaluate(() => kitImp ? kitImp.rows.filter(r => !r.ok).length : -1);
  await ph.tap('#kit-imp');
  await ph.page.waitForFunction(n => items.length >= n - 2, n, { timeout: 120000, polling: 250 }); await V.sleep(3000);
  const count = await ph.page.evaluate(() => { const c = {}; for (const i of items) c[i.type] = (c[i.type] || 0) + 1; return c });
  await ph.kill(); await V.sleep(400); await ph.reopen(V.lab.appUrl); await ph.ready(); await V.sleep(4000);
  await ph.page.evaluate(FRAMES); let t = Date.now(); await ph.tap('#n-stats');
  await ph.page.waitForFunction(() => { const s = document.querySelector('#stats'); return s && !s.querySelector('.st-wait') && s.querySelector('details.st-type') }, null, { timeout: 300000, polling: 100 });
  await V.sleep(500); const open = { ms: Date.now() - t, worstFrame: await framesStop(ph) };
  const folds = {};
  for (const ty of ['shirt', 'tie']) {
    const s = `#stats details.st-type[data-type="${ty}"] summary`;
    await ph.page.evaluate(FRAMES); t = Date.now(); await ph.tap(s);
    await ph.page.waitForFunction(ty => !!document.querySelector(`#stats details.st-type[data-type="${ty}"] .st-row`), ty, { timeout: 300000, polling: 100 });
    await V.sleep(500); folds[ty] = { ms: Date.now() - t, worstFrame: await framesStop(ph) };
  }
  const prof = await ph.page.evaluate(() => { const T = f => { const t = performance.now(); f(); return Math.round(performance.now() - t) }; const P = {}; for (const [k, o] of plannedDays()) for (const sl of ['shirt', 'tie']) if (o[sl]) P[o[sl].id] = 1;
    return { buildStats: T(() => buildStats()), renderStats: T(() => renderStats()), neverPlanned: { shirt: items.filter(i => i.type === 'shirt' && !P[i.id]).length, tie: items.filter(i => i.type === 'tie' && !P[i.id]).length } } });
  return { n: await ph.page.evaluate(() => items.length), importBadRows: bad, count, open, folds, prof, errors: ph.errors.slice(0, 3) };
}
V.run(async () => {
  await V.startLab('02');
  const base = await measure('02-30', wardrobe(30, 18));
  const mine = await measure('02-300', wardrobe(300, 18));   // every shirt and tie gets planned: no freeze (the slow table is never built)
  const big = await measure('02-t300', fs.readFileSync(RP.FIX + '/W2-18-02-w300.tsv', 'utf8'));   // tester 18's 300 rows (gen.js, seed 18)
  const ok = big.open.worstFrame > 2000 && big.folds.shirt.worstFrame > 2000 && base.open.worstFrame < 500 && base.folds.shirt.worstFrame < 500;
  V.verdict(ok, { baseline30: base, my300_allPlanned: mine, tester300: big });
});
