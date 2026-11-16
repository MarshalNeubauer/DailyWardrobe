// W2-17-03: the piece picker's "Best match / Weak match" labels disagree with the outfit score: the piece labeled Best match lowers
// the score, a piece labeled lower would raise it. Tester 17's wardrobe; Sun 15 Nov, then the UI: Shoes ⇄ → the Best match → score.
// node tests/replay/run.js --only W2-17-03
const V = require('./lib-verify17.js');
V.run(async () => {
  await V.startLab('03');
  const { ph } = await V.wardrobePhone('03', '2026-11-15T07:30:00+03:00'); await V.inpage(ph);
  // every workday of the next two weeks, Shoes and Suit/Blazer: the labels next to the score each piece would give
  const cases = await ph.page.evaluate(() => { const out = []; for (let d = 15; d <= 30; d++) { const k = '2026-11-' + d, o = planFor()[k]; if (!o || !o.shoes) continue;
    for (const slot of ['shoes', 'top']) { const p = __picker(k, slot), cur = p.find(x => x.cur), best = p.find(x => x.tag === 'Best match' && !x.cur), better = p.filter(x => !x.cur && x.score > cur.score && x.tag !== 'Best match');
      if (best && best.score < cur.score) out.push({ k, slot, kind: 'Best match lowers the score', cur: cur.n + ' ' + cur.score, best: best.n + ' ' + best.score });
      else if (better.length && p[0].cur) out.push({ k, slot, kind: 'a lower-labelled piece scores higher than the Best match', best: cur.n + ' ' + cur.score, better: better.map(x => x.n + ' (' + x.tag + ') ' + x.score) }) } } return out });
  // in the UI: today's shoes picker, tap the Best match, read the score card
  const before = await V.scoreBox(ph);
  const list = await V.openRowPicker(ph, 'Shoes');
  const bestCard = ph.page.locator('#pick-sheet .pick-it:not(.cur)').filter({ hasText: 'Best match' }).first();
  let ui = { list: list.replace(/\n+/g, ' | ') };
  if (await bestCard.count()) { ui.tapped = (await bestCard.innerText()).split('\n')[0]; await V.tapLoc(ph, bestCard); ui.after = await V.scoreBox(ph) }
  else await ph.page.evaluate(() => closePicker());
  const n = s => s && +(s.head.match(/Outfit score (\d+)/) || [])[1];
  const uiWorse = ui.after && n(ui.after) < n(before);
  V.verdict(cases.length > 0, { scoreBefore: before && before.head, ui, uiBestMatchLowered: !!uiWorse, cases });
});
