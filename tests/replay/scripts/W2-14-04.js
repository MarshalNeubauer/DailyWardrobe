// W2-14-04: choose another shirt with the shirt row's ⇄, then "↺ Reset": the outfit goes back, but the planner keeps the votes
// from the undone change (settings.learn, shown in Insights as "Avoids…" / "Prefers…").
const V = require('./lib-verify14.js');
V.run(async () => {
  await V.start('w2-14-04');
  await V.wardrobe('Type\tColour\nSuit\tgrey\nShirt\twhite\nShirt\tlight blue\nTie\tburgundy\nShoes\tblack');
  await V.setWorld('2026-11-16T07:40:00+03:00'); await V.ph.page.reload(); await V.ph.ready(); await V.sleep(1500);
  const shirt = () => V.ph.page.evaluate(() => { const b = document.querySelector('.rowtap[aria-label^="Shirt"]'); return b && b.getAttribute('aria-label') });
  await V.tapText(/^4 pieces/);
  const before = await shirt();
  const other = /White/.test(before) ? /Light blue/ : /White/;
  await V.ph.tap('button.swap[aria-label="Change shirt"]'); await V.sleep(900);
  await V.tapText(new RegExp(other.source, 'i'), '.pick button, [role=dialog] button, .sheet button, button'); await V.sleep(1200);
  const swapped = await shirt();
  const toast = await V.ph.page.evaluate(() => document.body.innerText.match(/Noted:[^\n]*/) ? document.body.innerText.match(/Noted:[^\n]*/)[0] : '');
  const learnAfterSwap = await V.ph.page.evaluate(() => JSON.stringify(HOOK.settings.learn || {}));
  await V.tapText(/Reset/); await V.sleep(1500);
  if (!await V.byText(/^4 pieces/)) {} else { const open = await V.ph.page.evaluate(() => !!document.querySelector('.rowtap[aria-label^="Shirt"]') && document.querySelector('.rowtap[aria-label^="Shirt"]').getBoundingClientRect().height > 0); if (!open) await V.tapText(/^4 pieces/) }
  const afterReset = await shirt();
  const learnAfterReset = await V.ph.page.evaluate(() => JSON.stringify(HOOK.settings.learn || {}));
  await V.ph.tap('#n-stats'); await V.sleep(2000);
  const ins = (await V.text()).split('\n').filter(l => /^(Avoids|Prefers)/.test(l.trim()));
  const kept = learnAfterReset !== '{}' && /"p":\{"/.test(learnAfterReset);
  V.verdict(swapped !== before && afterReset === before && kept && ins.length > 0, { before, swapped, toast, afterReset, learnAfterSwap, learnAfterReset, insights: ins });
});
