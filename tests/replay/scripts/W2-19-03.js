// W2-19-03: the color sheet over the item sheet: Tab leaves the sheet into the item sheet behind it (not inert),
// and Escape right after opening leaves focus on <body> instead of the Color button.
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-03');
  const ph = await L.phone('a'); const p = ph.page; const ev = {};
  await L.kbd(ph, '#n-wardrobe', 800);
  await p.locator('#wardrobe .giopen').nth(2).click(); await L.sleep(900);
  await L.kbd(ph, '#item-view .colbtn', 900); ev.openFocus = await L.act(ph);
  await p.keyboard.press('Escape'); await L.sleep(700);
  ev.escAtOnce = await p.evaluate(() => ({ focus: __v19.act(), colOpen: !!document.querySelector('#col-sheet.on') }));
  await L.kbd(ph, '#item-view .colbtn', 900);
  ev.itemSheetInert = await p.evaluate(() => !!document.querySelector('#item-view').closest('[inert]'));
  let outside = 0; for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => !document.activeElement.closest('#col-sheet') && !!document.activeElement.closest('#item-view'))) outside++ }
  ev.tabsIntoItemSheetOf40 = outside;
  L.verdict(!ev.escAtOnce.colOpen && ev.escAtOnce.focus === 'BODY' && outside > 0, ev);
});
