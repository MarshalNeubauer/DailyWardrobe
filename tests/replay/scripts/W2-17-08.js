// W2-17-08: after the user picks a piece by hand, the score card says "Today's pieces were chosen for variety. These would score
// higher:", on a coming day too. Tester 17's wardrobe, viewed Sun 15 Nov: go to Mon 16, Tie ⇄ → another tie (the Pink one, else the
// last listed); unfold the score.
// node tests/replay/run.js --only W2-17-08
const V = require('./lib-verify17.js');
V.run(async () => {
  await V.startLab('08');
  const { ph } = await V.wardrobePhone('08', '2026-11-15T07:30:00+03:00');
  await V.goDay(ph, '2026-11-16'); const shown = await V.dateShown(ph);
  const tie0 = await V.rowText(ph, 'Tie');
  if (!/Pink/.test(tie0)) await V.pickByName(ph, 'Tie', /^Pink$/); else await V.pickOther(ph, 'tie', 'Tie');
  const tie1 = await V.rowText(ph, 'Tie'), box = await V.scoreBox(ph);
  const r = await V.rec(ph, '2026-11-16');
  V.verdict(!!box && /^Today's pieces were chosen for variety/.test(box.fix || '') && !!(r && r.force && r.force.tie),
    { shown, tieBefore: tie0, tieAfter: tie1, handPicked: !!(r && r.force && r.force.tie), score: box && box.head, fixLine: box && box.fix, fixes: box && box.fixes });
});
