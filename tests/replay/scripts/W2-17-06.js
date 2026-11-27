// W2-17-06: correcting yesterday to the suit today is locked to leaves today on that same suit, and Today then says "This suit was
// worn 1 day ago. Add more suits to get a 3-day rest." with three suits owned. Tester 17's wardrobe, set up Sun 15 Nov; opened again
// Wed 18 Nov: ‹ to Tue 17 → Correct this day → Suit ⇄ → the suit Wednesday shows → Done → › to Wednesday.
// node tests/replay/run.js --only W2-17-06
const V = require('./lib-verify17.js');
V.run(async () => {
  await V.startLab('06');
  const { ph } = await V.wardrobePhone('06', '2026-11-15T07:30:00+03:00');
  await V.world(ph, '2026-11-18T07:30:00+03:00'); await V.reopen(ph); await V.inpage(ph);
  const wed0 = await ph.page.evaluate(() => __day('2026-11-18')), tue0 = await ph.page.evaluate(() => __day('2026-11-17'));
  if (wed0.top === tue0.top) throw new Error('Tuesday already wore Wednesday\'s suit: ' + wed0.top);
  await V.step(ph, -1); const tueShown = await V.dateShown(ph);
  await V.tapText(ph, /^Correct this day$/);
  await V.pickByName(ph, 'Suit', new RegExp('^' + wed0.top + '$'));
  await V.tapText(ph, /^Done$/);
  const tue1 = await ph.page.evaluate(() => __day('2026-11-17'));
  await V.step(ph, 1); const wedShown = await V.dateShown(ph);
  const wed1 = await ph.page.evaluate(() => __day('2026-11-18'));
  const warn = await ph.page.evaluate(() => [...document.querySelectorAll('#today .warn')].map(e => e.textContent));
  const suits = await ph.page.evaluate(() => HOOK.items.filter(i => i.type === 'suit').length);
  V.verdict(tue1.top === wed0.top && wed1.top === wed0.top && warn.some(t => /Add more suits/.test(t)),
    { tueShown, tueBefore: tue0.top, tueAfter: tue1.top, wedShown, wedBefore: wed0.top, wedAfter: wed1.top, wedVariety: wed1.miss.filter(m => /Variety/.test(m)), warn, suitsOwned: suits });
});
