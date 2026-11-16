// W2-19-02: the item sheet doesn't take focus when it opens, and doesn't give it back to the item when closed (Done or Escape).
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-02');
  const ph = await L.phone('a'); const p = ph.page; const ev = {};
  await L.kbd(ph, '#n-wardrobe', 800);
  const it = p.locator('#wardrobe [onclick^="openItem"]').nth(2);
  await it.focus(); ev.opener = await L.act(ph); await p.keyboard.press('Enter'); await L.sleep(900);
  ev.open = await p.evaluate(() => ({ focus: __v19.act(), focusInSheet: document.querySelector('#item-view').contains(document.activeElement), sheetOpen: !!document.querySelector('#item-view.on') }));
  await L.kbd(ph, '#item-view button:has-text("Done")', 900); ev.afterDone = await L.act(ph);
  await it.focus(); await p.keyboard.press('Enter'); await L.sleep(900); await p.keyboard.press('Escape'); await L.sleep(900);
  ev.afterEscape = await p.evaluate(() => ({ focus: __v19.act(), sheetOpen: !!document.querySelector('#item-view.on') }));
  L.verdict(ev.open.sheetOpen && !ev.open.focusInSheet && ev.afterDone === 'BODY' && !ev.afterEscape.sheetOpen && ev.afterEscape.focus === 'BODY', ev);
});
