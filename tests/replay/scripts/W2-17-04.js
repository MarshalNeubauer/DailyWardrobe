// W2-17-04: an own color is described by the color it behaves like: the "Dusty pink" suit (behaves like tan) is a "tan jacket" in
// the score's reasons. Tester 17's wardrobe; on a workday the plan gives the rose suit, Tie ⇄ → Pink; read the score's reasons.
// node tests/replay/run.js --only W2-17-04
const V = require('./lib-verify17.js');
V.run(async () => {
  await V.startLab('04');
  const { ph } = await V.wardrobePhone('04', '2026-11-15T07:30:00+03:00'); await V.inpage(ph);
  const k = await ph.page.evaluate(() => { for (let d = 15; d <= 30; d++) { const k = '2026-11-' + d, o = planFor()[k]; if (o && o.top && o.top.name === 'Rose summer suit') return k } return null });
  if (!k) throw new Error('no rose-suit day in the next two weeks');
  await V.goDay(ph, k);
  const tieBefore = await V.rowText(ph, 'Tie');
  if (!/Pink/.test(tieBefore)) await V.pickByName(ph, 'Tie', /^Pink$/);
  const box = await V.scoreBox(ph);
  const tanWords = (box.why || []).filter(t => /\btan\b/i.test(t));
  const suit = await ph.page.evaluate(() => { const s = items.find(i => i.name === 'Rose summer suit'); return { primaryColor: s.primaryColor, shownAs: colName(s.primaryColor), planCol: planCol(s), desc: desc(s) } });
  V.verdict(tanWords.length > 0, { day: k, suit, tie: await V.rowText(ph, 'Tie'), score: box.head, tanWords, why: box.why });
});
