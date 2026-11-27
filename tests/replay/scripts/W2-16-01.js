// W2-16-01: an own color or pattern with an Arabic name (Arabic-Indic digit included) is refused with
// "Give it a name of at least two letters." (its key keeps only a-z: core.js ownColKey/ownPatKey). A Latin name is accepted.
// Same cause as W2-12-03. Phone in ar-KW / Asia/Kuwait, Settings -> Photo tagging -> + New color / + New pattern.
const V = require('./lib-verify16.js');
async function tryAdd(btn, name, hex) {
  const pg = V.ph.page;
  await V.ph.tap(btn); await V.sleep(900);
  if (hex && await pg.$('#cn-hex')) { await pg.fill('#cn-hex', hex); await pg.dispatchEvent('#cn-hex', 'input'); await pg.dispatchEvent('#cn-hex', 'change'); await V.sleep(300) }
  await pg.fill('#cn-name', ''); await pg.focus('#cn-name'); await pg.keyboard.insertText(name);
  await pg.dispatchEvent('#cn-name', 'input'); await pg.dispatchEvent('#cn-name', 'change'); await V.sleep(400);
  const btnTxt = await pg.$eval('#cn-add', b => b.innerText.trim()), disabled = await pg.$eval('#cn-add', b => b.disabled);
  if (!disabled) { await V.ph.tap('#cn-add'); await V.sleep(1000) }
  const r = await pg.evaluate(n => ({ error: ((document.querySelector('#cn-error') || {}).innerText || '').trim() || null,
    saved: [...(HOOK.settings.custom?.colors || []), ...(HOOK.settings.custom?.patterns || [])].filter(c => c.name === n).map(c => c.key),
    keyWouldBe: [HOOK.ownColKey(n), HOOK.ownPatKey(n)] }), name);
  await pg.evaluate(() => 'closeColPick' in HOOK && HOOK.closeColPick()); await V.sleep(400);
  return { button: btnTxt, disabled, ...r };
}
V.run(async () => {
  await V.start('w01'); await V.skipSetup();
  await V.openSettings(); await V.openCat('tagging');
  const res = {
    colourArabic: await tryAdd('#cust-newcol', 'بترولي غامق ٢', '#1f4e5a'),
    patternArabic: await tryAdd('#cust-newpat', 'سدو كويتي'),
    colourLatin: await tryAdd('#cust-newcol', 'Petrol', '#1f4e5a'),
  };
  await V.ph.shot('w2-16-01');
  const refused = r => !r.saved.length && /two letters/.test(r.error || '');
  V.verdict(refused(res.colourArabic) && refused(res.patternArabic) && res.colourLatin.saved.length === 1, res);
});
