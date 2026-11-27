// W2-19-04: the item sheet's Color / Second color / Third color / Pattern buttons sit inside a <label>, so their accessible
// name (Playwright's spec-following tree) is just the label word and the value is not in the name.
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-04');
  const ph = await L.phone('a'); const p = ph.page; const ev = {};
  await L.kbd(ph, '#n-wardrobe', 800);
  await p.evaluate(() => { if ('CK_OPEN' in HOOK) HOOK.CK_OPEN['*'] = true });   // #497: the color buttons are in folded sections (hidden from the tree)
  await p.locator('#wardrobe .giopen').nth(2).click(); await L.sleep(900);
  ev.buttons = await p.evaluate(() => [...document.querySelectorAll('#item-view .colbtn')].map(b => ({ text: b.textContent.trim(), insideLabel: !!b.closest('label'), ariaLabel: b.getAttribute('aria-label') })));
  ev.tree = (await p.locator('#item-view').ariaSnapshot()).split('\n').filter(l => /button "(Colou?r|Second colou?r|Third colou?r|Pattern)"/.test(l)).map(s => s.trim());
  L.verdict(ev.tree.length >= 4 && ev.buttons.every(b => b.insideLabel && !b.ariaLabel), ev);
});
