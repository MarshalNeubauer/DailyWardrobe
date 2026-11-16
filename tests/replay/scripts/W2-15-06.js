// W2-15-06: a Qty column of 3 (or "x3" in the text) imports one piece, with nothing said about the quantity.
const L = require('./lib-verify15.js');
L.run(async () => {
  await L.start('w2-15-06');
  const pv = await L.paste('Type\tColour\tQty\nShirt\tWhite\t3');
  const said = /qty|quantit|left out|3/i.test(pv.prev.replace(/^1 item ready/, ''));
  await L.addItems();
  const its = await L.itemsNow();
  const ok = its.length === 1 && /Add 1 item\b/.test(pv.btn) && !said;
  L.verdict(ok, { button: pv.btn, preview: pv.prev, mentionsQuantity: said, itemsAfter: its.length });
});
