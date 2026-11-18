// W1-5-03: Settings -> Care changed on two phones (B offline): the Care object is one setting, so one phone's limit is lost.
// Extra (not in the verdict): Workdays toggled on both phones (A adds Fri, B adds Sat).
const V = require('./lib-verify5.js');
V.run(async () => {
  const { A, B } = await V.startTwo('w03');
  const sets = ph => ph.page.evaluate(() => ({ units: settings.units, care: settings.care || {}, blazer: (settings.blazerDays || []).join(''), work: (settings.workdays || []).join('') }));
  await V.offline(B, true);
  await V.openSettings(A); await V.cat(A, 'care'); await V.choose(A, '#care-lim-tie', '5');
  await V.cat(A, 'weather'); await V.choose(A, '#cfg-units', 'F');
  await V.cat(A, 'schedule'); await V.tapL(A, A.page.locator('#cfg-workdays button[data-i="5"]'));
  await V.settingsDone(A);
  await V.openSettings(B); await V.cat(B, 'care'); await V.choose(B, '#care-lim-blazer', '8');
  await V.cat(B, 'schedule'); await V.tapL(B, B.page.locator('#cfg-blazer button[data-i="0"]'));
  await V.tapL(B, B.page.locator('#cfg-workdays button[data-i="6"]'));
  await V.settingsDone(B);
  const before = { A: await sets(A), B: await sets(B) };
  await V.sync(A); await V.offline(B, false); await V.sync(B); await V.sync(A);
  const s = (await V.kvData()).settings;
  const after = { A: await sets(A), B: await sets(B), server: { units: s.units, care: s.care, blazer: (s.blazerDays || []).join(''), work: (s.workdays || []).join('') } };
  const all = [after.A, after.B, after.server];
  const careLost = all.every(x => !(x.care.tie === 5 && x.care.blazer === 8));
  const otherKept = all.every(x => x.units === 'F' && x.blazer.includes('0'));
  const workLost = all.every(x => !(x.work.includes('5') && x.work.includes('6')));
  V.verdict(careLost && before.A.care.tie === 5 && before.B.care.blazer === 8, { before, after, careLost, unitsAndBlazerDayKept: otherKept, workdaysOneLost: workLost });
});
