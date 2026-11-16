// W2-17-02: with tester 17's wardrobe (gold-case watch on a brown leather strap, brown suede belt with a gold buckle, black and
// oxblood calf belts with silver buckles), the brown suede loafers are planned on almost every workday, two days running even where
// another pair scores as well, and the oxblood calf loafers almost never.
// node tests/replay/run.js --only W2-17-02
const V = require('./lib-verify17.js');
V.run(async () => {
  await V.startLab('02');
  const { ph, importNotes } = await V.wardrobePhone('02', '2026-11-15T07:30:00+03:00'); await V.inpage(ph);
  const r = await ph.page.evaluate(() => {
    const c = {}, seq = []; let n = 0; const T = todayDate();
    for (let g = 1; n < 125 && g < 300; g++) { const d = new Date(T.getFullYear(), T.getMonth(), T.getDate() + g); const o = planMonth(d.getFullYear(), d.getMonth())[key(d)]; if (!o || !o.shoes) continue; n++;
      const s = o.shoes.name || nm(o.shoes); c[s] = (c[s] || 0) + 1; seq.push({ k: key(d), s, suit: !!o.suitDay }) }
    let runs = 0; for (let i = 1; i < seq.length; i++) if (seq[i].s === seq[i - 1].s) runs++;
    // a day in the next three weeks with suede the day after suede, where the oxblood pair would score as well or better
    let tie = null; for (let i = 1; i < 15 && !tie; i++) if (seq[i].s === seq[i - 1].s && seq[i].s === 'Brown suede loafers') {
      const ox = items.find(x => x.name === 'Oxblood calf'), cur = rateOutfit(__pm(seq[i].k)).score, alt = __sim(seq[i].k, 'shoes', ox.id);
      if (alt && alt.score >= cur && !alt.hard.length) tie = { day: seq[i].k, suedeScore: cur, oxbloodScore: alt.score } }
    const suitSuede = seq.filter(x => x.suit && x.s === 'Brown suede loafers').length, suitDays = seq.filter(x => x.suit).length;
    return { workdays: n, counts: c, twoDaysRunning: runs, suitDaysInSuede: suitSuede + ' of ' + suitDays, tie };
  });
  const suede = r.counts['Brown suede loafers'] || 0, ox = r.counts['Oxblood calf'] || 0;
  V.verdict(suede >= 0.7 * r.workdays && ox <= 3 && !!r.tie, { importNotes, ...r });
});
