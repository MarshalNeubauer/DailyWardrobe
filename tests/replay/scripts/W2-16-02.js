// W2-16-02: a color name with the Arabic comma "،" (U+060C, the comma on an Arabic keyboard) is refused with
// "Use only letters, numbers, spaces and - ’ . , ( ) / + in the name." (core.js OWN_NAME_OK lists only the Latin comma).
// For comparison the same name with a Latin comma passes the character check (and then fails W2-16-01's key rule).
const V = require('./lib-verify16.js');
async function tryAdd(name) {
  const pg = V.ph.page;
  await V.ph.tap('#cust-newcol'); await V.sleep(900);
  if (await pg.$('#cn-hex')) { await pg.fill('#cn-hex', '#1f4e5a'); await pg.dispatchEvent('#cn-hex', 'input'); await pg.dispatchEvent('#cn-hex', 'change'); await V.sleep(300) }
  await pg.fill('#cn-name', ''); await pg.focus('#cn-name'); await pg.keyboard.insertText(name);
  await pg.dispatchEvent('#cn-name', 'input'); await pg.dispatchEvent('#cn-name', 'change'); await V.sleep(400);
  if (!await pg.$eval('#cn-add', b => b.disabled)) { await V.ph.tap('#cn-add'); await V.sleep(1000) }
  const r = await pg.evaluate(n => ({ error: ((document.querySelector('#cn-error') || {}).innerText || '').trim() || null,
    saved: (HOOK.settings.custom?.colors || []).some(c => c.name === n) }), name);
  await pg.evaluate(() => 'closeColPick' in HOOK && HOOK.closeColPick()); await V.sleep(400);
  return r;
}
V.run(async () => {
  await V.start('w02'); await V.skipSetup();
  await V.openSettings(); await V.openCat('tagging');
  const res = { arabicComma: await tryAdd('Petrol، dark'), latinComma: await tryAdd('Petrol, dark'),
    arabicNameArabicComma: await tryAdd('أزرق بترولي، غامق') };
  await V.ph.shot('w2-16-02');
  const ok = /Use only letters/.test(res.arabicComma.error || '') && !res.arabicComma.saved && res.latinComma.saved && /Use only letters/.test(res.arabicNameArabicComma.error || '');
  V.verdict(ok, res);
});
