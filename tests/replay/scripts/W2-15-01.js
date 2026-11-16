// W2-15-01: a "Description" column (pinstripe, gingham, knit, paisley, chinos, penny loafers…) is dropped without a word:
// the preview doesn't mention it and every piece is imported plain, unnamed, chinos as dress trousers, loafers as oxfords.
const L = require('./lib-verify15.js');
const ROWS = `Category\tDescription\tColor\tBrand
Suit\tcharcoal pinstripe\tcharcoal\tM&S
Shirt\tpink gingham\tpink/white\t
Shirt\tbengal stripe\tblue & white\tHilditch
Tie\tknit\tnavy\t
Tie\trepp stripe\tburgundy & navy\tDrake's
Tie\tpaisley\tgold\t
Tie\tpolka dot\tnavy\t
Trousers\tchinos\tkhaki\tGap
Shoes\tpenny loafers\toxblood\t
Shoes\tbrogues\ttan\t`;
L.run(async () => {
  await L.start('w2-15-01');
  const pv = await L.paste(ROWS);
  const mentions = /descri|not used|column/i.test(pv.prev);
  await L.addItems();
  const its = await L.itemsNow();
  const allSolid = its.every(i => !i.p || i.p === 'solid');
  const noNames = its.every(i => !i.n && !i.notes);
  const chinos = its.find(i => i.t === 'pants'), loafers = its.find(i => i.t === 'shoes' && i.c === 'oxblood');
  const navyTies = its.filter(i => i.t === 'tie' && i.c === 'navy' && !i.c2).length;
  const ok = its.length === 10 && !mentions && allSolid && noNames && chinos && (!chinos.k || chinos.k === 'dress') && loafers && (!loafers.s || loafers.s === 'oxford') && navyTies === 2;   // no kind/style stored = dress trousers / oxfords (core.js)
  L.verdict(ok, { preview: pv.prev.slice(0, 700), previewMentionsDescription: mentions, n: its.length, allSolid, noNames, chinosKind: chinos && (chinos.k || 'dress (none stored)'), loafersStyle: loafers && (loafers.s || 'oxford (none stored)'), identicalNavyTies: navyTies, items: its });
});
