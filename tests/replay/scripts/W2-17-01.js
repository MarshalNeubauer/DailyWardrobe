// W2-17-01: a tie picked by hand for a coming workday is lost once that day is past, when the app isn't opened on the day itself.
// Phone A: Sun 15 Nov 07:30 Kuwait, sample wardrobe, step to Mon 16, Tie ⇄ → another tie. Next opened Wed 18 Nov: Monday's tie?
// Phone B (control): the same pick, but the app is opened on Mon 16 Nov 07:30 too, then Wed 18.
// node tests/replay/run.js --only W2-17-01
const V = require('./lib-verify17.js');
const SUN = '2026-11-15T07:30:00+03:00', MON = '2026-11-16T07:30:00+03:00', WED = '2026-11-18T07:30:00+03:00', K = '2026-11-16';
async function pickMonday(tag) {
  const ph = await V.phone(tag, SUN);
  await V.step(ph, 1); const day = await V.dateShown(ph);
  const before = await V.planned(ph, K, 'tie');
  const picked = await V.pickOther(ph, 'tie', 'Tie');
  const after = await V.planned(ph, K, 'tie'), r = await V.rec(ph, K);
  return { ph, day, before, picked, after, recAfterPick: { idsTie: r && r.ids && r.ids.tie, forceTie: r && r.force && r.force.tie } };
}
async function mondayOnWed(ph) {
  await V.world(ph, WED); await V.reopen(ph);
  const r = await V.rec(ph, K), p = await V.planned(ph, K, 'tie');
  const worn = await ph.page.evaluate(k => { const o = HOOK.planFor()[k]; return { frozen: !!(o && o.frozen) } }, K);
  return { mondayTie: p, frozen: worn.frozen, recIdsTie: r && r.ids && r.ids.tie, recForceTie: r && r.force && r.force.tie, auto: !!(r && r.auto) };
}
V.run(async () => {
  await V.startLab('01');
  const a = await pickMonday('01a');
  const aWed = await mondayOnWed(a.ph);
  const b = await pickMonday('01b');
  await V.world(b.ph, MON); await V.reopen(b.ph);
  const bMon = await V.planned(b.ph, K, 'tie');
  const bWed = await mondayOnWed(b.ph);
  const lost = a.after && a.after.id === a.picked && aWed.mondayTie && aWed.mondayTie.id !== a.picked && aWed.mondayTie.id === a.before.id;
  const control = bWed.mondayTie && bWed.mondayTie.id === b.picked;
  V.verdict(!!lost, {
    notOpenedOnMonday: { shown: a.day, plannedTie: a.before, picked: a.picked, afterPick: a.after, recAfterPick: a.recAfterPick, onWed: aWed },
    control_openedOnMonday: { plannedTie: b.before, picked: b.picked, onMonday: bMon, onWed: bWed, kept: !!control },
    errors: [...a.ph.errors, ...b.ph.errors].slice(0, 5)
  });
});
