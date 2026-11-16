// W2-14-01: Today -> "4 pieces" -> Belt "Add one" -> Add without photo opens a card set to Suit; Confirm saves a second suit, no belt.
const V = require('./lib-verify14.js');
V.run(async () => {
  await V.start('w2-14-01');
  await V.wardrobe('Type\tColour\nSuit\tgrey\nShirt\twhite\nShirt\tlight blue\nTie\tburgundy\nShoes\tblack');
  await V.setWorld('2026-11-16T07:40:00+03:00'); await V.ph.page.reload(); await V.ph.ready(); await V.sleep(1500);
  await V.tapText(/^4 pieces/);                                   // unfold the pieces
  await V.ph.tap('button.addone[aria-label^="Belt"]'); await V.sleep(800);
  const page = await V.ph.page.evaluate(() => document.querySelector('section.on, .page.on, [id].on') ? document.querySelector('section.on, .page.on, [id].on').id : '');
  await V.ph.page.evaluate(() => { if (typeof CK_OPEN !== 'undefined') CK_OPEN['*'] = true });   // #497: the card's fields are in folded sections
  await V.tapText(/^Add without (a )?photo/); await V.sleep(600);   // the row (aa24910) or the long button that opens its sheet (#473)
  const selects = await V.ph.page.evaluate(() => [...document.querySelectorAll('#add select')].filter(s => s.getBoundingClientRect().width > 0).map(s => s.options[s.selectedIndex] && s.options[s.selectedIndex].text));
  await V.tapText(/^Confirm/); await V.sleep(1200);
  const toast = await V.ph.page.evaluate(() => [...document.querySelectorAll('.toast,#toast,[role=status]')].map(e => e.innerText.trim()).filter(Boolean).join(' | '));
  const counts = await V.ph.page.evaluate(() => ({ suit: items.filter(i => i.type === 'suit').length, belt: items.filter(i => i.type === 'belt').length, n: items.length }));
  V.verdict(selects[0] === 'Suit' && counts.suit === 2 && counts.belt === 0, { pageAfterAddOne: page, cardSelects: selects, toast, counts });
});
