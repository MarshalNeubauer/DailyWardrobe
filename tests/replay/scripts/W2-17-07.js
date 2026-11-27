// W2-17-07: "Suggest another" offers an outfit the score calls a real mistake while clean shirts are left, and every tap is learned
// as a dislike. Tester 17's wardrobe, Wed 18 Nov: Suit ⇄ → Navy chalk stripe, then Shirt ⇄ → "Suggest another ↻" up to five times.
// node tests/replay/run.js --only W2-17-07
const V = require('./lib-verify17.js');
const K = '2026-11-18';
V.run(async () => {
  await V.startLab('07');
  const { ph } = await V.wardrobePhone('07', '2026-11-15T07:30:00+03:00');
  await V.world(ph, '2026-11-18T07:30:00+03:00'); await V.reopen(ph); await V.inpage(ph);
  const top0 = await ph.page.evaluate(k => __day(k).top, K);
  if (top0 !== 'Navy chalk stripe') await V.pickByName(ph, 'Suit', /^Navy chalk stripe$/);
  const top1 = await ph.page.evaluate(k => __day(k).top, K); if (top1 !== 'Navy chalk stripe') throw new Error('suit pick failed: ' + top1);
  const votes = () => ph.page.evaluate(() => Object.values((HOOK.settings.learn && HOOK.settings.learn.p) || {}).filter(v => v < 0).length);
  const v0 = await votes();
  const seq = [{ ...(await ph.page.evaluate(k => { const d = __day(k); return { shirt: (d.o.match(/shirt=([^,]+)/) || [])[1], score: d.score, hard: d.hard } }, K)) }];
  let mistake = null;
  for (let i = 0; i < 5 && !mistake; i++) {
    await V.openRowPicker(ph, 'Shirt'); await V.tapLoc(ph, ph.page.locator('#pick-next'));
    const s = await ph.page.evaluate(k => { const d = __day(k); return { shirt: (d.o.match(/shirt=([^,]+)/) || [])[1], score: d.score, hard: d.hard, msg: HOOK.swapMsg } }, K);
    seq.push(s);
    if (s.hard.length) {   // were clean shirts left that hadn't been shown?
      const seen = seq.map(x => x.shirt);
      const left = await ph.page.evaluate(([k, seen]) => HOOK.items.filter(i => i.type === 'shirt' && !seen.includes(i.name || HOOK.nm(i))).map(i => ({ n: i.name || HOOK.nm(i), r: __sim(k, 'shirt', i.id) })).map(x => ({ n: x.n, score: x.r.score, hard: x.r.hard })), [K, seen]);
      mistake = { at: i + 1, shirt: s.shirt, score: s.score, hard: s.hard, cleanLeft: left.filter(x => !x.hard.length) };
    }
  }
  const v1 = await votes();
  // the planner no longer learns (#465), so only the real-mistake half is the bug; the dislike votes stay as evidence
  V.verdict(!!(mistake && mistake.cleanLeft.length), { suit: 'Navy chalk stripe', sequence: seq, mistake, downVotesAdded: v1 - v0 });
});
