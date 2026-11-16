// W1-5-06: own colors made on two phones (B offline) - settings.custom is one setting, so one phone's color disappears and the
// tie it was used on is left with a color key the app no longer knows. The colors are created with addCustomColor() (what the
// New color sheet's Add calls); choosing them on the ties is done with taps in the color picker.
const V = require('./lib-verify5.js');
async function useColour(ph, name, key) {
  await V.openItem(ph, name);
  await V.tapL(ph, ph.page.locator('#item-view .colbtn[data-k="primaryColor"]'));
  await V.tapL(ph, ph.page.locator(`#col-sheet .cptile[data-c="${key}"]`));
  const use = ph.page.locator('#col-sheet .cpbar button').filter({ visible: true }); if (await use.count()) await V.tapL(ph, use.last());
  await V.sleep(400); await V.closeItem(ph);
}
V.run(async () => {
  const { A, B } = await V.startTwo('w06');
  const cols = ph => ph.page.evaluate(() => ((settings.custom || {}).colors || []).map(c => c.name).join(','));
  await V.offline(B, true);
  const kB = await B.page.evaluate(() => addCustomColor({ name: 'Mossy fern', hex: '#0f3d2a', base: 'green', types: ['tie'], accent: false }));
  await useColour(B, 'Green tie', kB);
  const kA = await A.page.evaluate(() => addCustomColor({ name: 'Dusty teal', hex: '#2f6f73', base: 'blue', types: ['tie'], accent: false }));
  await useColour(A, 'Navy dot tie', kA);
  const before = { colsA: await cols(A), colsB: await cols(B), tieA: await V.item(A, 'Navy dot tie'), tieB: await V.item(B, 'Green tie') };
  await V.sync(A); await V.offline(B, false); await V.sync(B); await V.sync(A);
  const show = ph => ph.page.evaluate(() => items.filter(i => /Navy dot tie|Green tie/.test(i.name)).map(i => ({ n: i.name, p: i.primaryColor, known: !!COLORS[i.primaryColor], label: colName(i.primaryColor) })));
  const s = (await V.kvData()).settings;
  const after = { colsA: await cols(A), colsB: await cols(B), server: ((s.custom || {}).colors || []).map(c => c.name).join(','), tiesA: await show(A), tiesB: await show(B) };
  await V.openItem(B, 'Green tie'); const sheetColour = await B.page.locator('#item-view .colbtn[data-k="primaryColor"]').innerText(); await B.shot('w06-sheet');
  const oneLost = [after.colsA, after.colsB, after.server].every(c => !(c.includes('Mossy fern') && c.includes('Dusty teal')));
  const orphan = [...after.tiesA, ...after.tiesB].some(t => t.p.startsWith('own') && !t.known);
  V.verdict(before.tieB.p === kB && before.tieA.p === kA && oneLost && orphan, { kA, kB, before, after, orphanSheetColourOnB: sheetColour });
});
