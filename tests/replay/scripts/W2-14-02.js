// W2-14-02: "Choose the colour" from the Add card: without scrolling, no standard color is visible above the "Keep <colour>" bar
// (at the largest text size, 1.5x, only "Your colours" + "New colour"; the first standard color starts below the bar's top).
// Runs at 1.5x (the tester's size, forced with --tscale as CLAUDE.md suggests) and at 1x.
const RP = require('../harness/paths.js');
const V = require('./lib-verify14.js');
async function measure(big) {
  await V.start(big ? 'w2-14-02-big' : 'w2-14-02', { big });
  await V.mock('next-tag', { type: 'suit', primaryColor: 'navy', secondaryColor: 'none', thirdColor: 'none', pattern: 'solid', material: 'wool', texture: 'smooth', formality: 'business', season: 'all' });
  await V.ph.tap('#n-wardrobe'); await V.sleep(400); await V.ph.tap('#ward-add'); await V.sleep(600);
  await V.ph.page.evaluate(() => { if (typeof CK_OPEN !== 'undefined') CK_OPEN['*'] = true });   // #497: the card's color button is in a folded section
  await V.ph.page.setInputFiles('#add-one input[type=file]', RP.SAMPLES_A + '/c35c0d6d866b9ebe6.jpg');
  await V.ph.page.waitForSelector('#add .colbtn[data-k=primaryColor]', { timeout: 30000 }); await V.sleep(1500);
  await V.ph.tap('#add .colbtn[data-k=primaryColor]'); await V.sleep(1200);
  const m = await V.ph.page.evaluate(() => {
    const sh = document.querySelector('#col-sheet'), bar = sh.querySelector('.cpbar'), barTop = bar.getBoundingClientRect().top;
    const seen = e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top < barTop && r.bottom > 0 && r.top < innerHeight };
    const tiles = [...sh.querySelectorAll('.cptile')].filter(seen).map(e => e.innerText.trim().replace(/\s+/g, ' '));
    const std = [...sh.querySelectorAll('.cpgrid:not(.cnown) .cptile')];
    return { tscale: getComputedStyle(document.documentElement).getPropertyValue('--tscale').trim(), viewport: innerHeight, title: (sh.querySelector('#col-title') || {}).innerText,
      barTop: Math.round(barTop), barText: bar.innerText.trim(), tilesVisible: tiles, firstStandard: std[0] && { name: std[0].innerText.trim(), top: Math.round(std[0].getBoundingClientRect().top) },
      scrollH: sh.scrollHeight, clientH: sh.clientHeight };
  });
  await V.ph.shot(big ? 'v14-colpick-1.5' : 'v14-colpick-1');
  return m;
}
V.run(async () => {
  const big = await measure(true); await V.stop();
  const one = await measure(false);
  const noStdBig = !big.tilesVisible.some(t => !/New colou?r/.test(t)) || big.firstStandard.top >= big.barTop;
  const noStdOne = one.firstStandard.top >= one.barTop - 20;   // the first standard color starts under (or at) the bar
  V.verdict(noStdBig && noStdOne, { at1_5x: big, at1x: one });
});
