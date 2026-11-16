// W1-5-02: changes to different parts of the same day on two phones; the day record of the phone that saved last wins whole.
// Part 1: A picks a tie, B (not synced) picks a shirt.  Part 2: A taps "Wore" -> "Didn't", B picks a belt.  Sync A, B, A each time.
const V = require('./lib-verify5.js');
const D = '2026-11-16';
V.run(async () => {
  const { A, B } = await V.startTwo('w02');
  const cur = async (ph, slot) => (await V.dayRec(ph, D) || {}).ids?.[slot];
  const other = (now, list) => list.find(n => n !== now);
  // part 1
  const tieA = other(await cur(A, 'tie'), ['Green tie', 'Burgundy tie']);
  const shirtB = other(await cur(B, 'shirt'), ['White shirt', 'Blue shirt']);
  await V.pickTo(A, 'tie', tieA); await V.pickTo(B, 'shirt', shirtB);
  const p1before = { A: await V.dayRec(A, D), B: await V.dayRec(B, D) };
  await V.sync(A); await V.sync(B); await V.sync(A);
  const p1 = { A: await V.dayRec(A, D), B: await V.dayRec(B, D) };
  const lost1 = p1.A.ids.tie !== tieA && p1.B.ids.tie !== tieA && p1.A.ids.shirt === shirtB;
  // part 2
  await V.tapL(A, A.page.locator('#wpill')); await V.sleep(600);
  const pillA = await A.page.locator('#wpill').innerText();
  const beltB = other(await cur(B, 'belt'), ['Black belt', 'Brown belt']);
  await V.pickTo(B, 'belt', beltB);
  const p2before = { A: await V.dayRec(A, D), B: await V.dayRec(B, D) };
  await V.sync(A); await V.sync(B); await V.sync(A);
  const p2 = { A: await V.dayRec(A, D), B: await V.dayRec(B, D), pillA: await A.page.locator('#wpill').innerText(), pillB: await B.page.locator('#wpill').innerText() };
  const lost2 = /Didn/.test(pillA) && p2.A.worn !== false && p2.B.worn !== false && p2.A.ids.belt === beltB;
  V.verdict(lost1 && lost2, { part1: { tieA, shirtB, before: p1before, after: p1, lost: lost1 }, part2: { pillA, beltB, before: p2before, after: p2, lost: lost2 } });
});
