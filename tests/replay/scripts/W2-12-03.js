// W2-12-03: an own color or pattern named in Arabic (letters of any script are allowed by CLAUDE.md / OWN_NAME_OK) is refused
// with "Give it a name of at least two letters.", because its key keeps only a-z. "Café" is accepted for comparison.
const L = require('./_verify12-lib.js');
L.run(async () => {
  await L.startLab('w2-12-03');
  const ph = await L.phone('a'), pg = ph.page, res = {};
  await ph.tap('header .hbtns button[onclick^="openSettings"]'); await L.sleep(700);
  if (await pg.getAttribute('#sc-tagging .scat-head', 'aria-expanded') !== 'true') { await ph.tap('#sc-tagging .scat-head'); await L.sleep(700) }   // Photo tagging
  for (const [btn, nm] of [['#cust-newcol', 'بني فاتح'], ['#cust-newpat', 'حياكة'], ['#cust-newcol', 'Café']]) {
    await ph.tap(btn); await L.sleep(800);
    await pg.fill('#cn-name', ''); await pg.focus('#cn-name');   // the field sits under the sheet's sticky top, so focus it directly
    await pg.keyboard.insertText(nm); await pg.dispatchEvent('#cn-name', 'change'); await L.sleep(400);
    const disabled = await pg.$eval('#cn-add', b => b.disabled);
    if (!disabled) { await ph.tap('#cn-add'); await L.sleep(900) }
    res[nm] = { addDisabled: disabled, error: await pg.evaluate(() => (document.querySelector('#cn-error') || {}).innerText || null),
      saved: await pg.evaluate(n => [...(settings.custom?.colors || []), ...(settings.custom?.patterns || [])].some(c => c.name === n), nm) };
    await pg.evaluate(() => typeof closeColPick === 'function' && closeColPick()); await L.sleep(400);
  }
  const ar1 = res['بني فاتح'], ar2 = res['حياكة'], cafe = res['Café'];
  const ok = !ar1.saved && /two letters/.test(ar1.error || '') && !ar2.saved && /two letters/.test(ar2.error || '') && cafe.saved;
  await ph.shot('w2-12-03');
  L.verdict(ok, res);
});

