// W2-15-02: pasting the same sheet again with a Pattern column added offers the re-patterned rows as new pieces
// ("Add 7 items", no hint that they match pieces already owned) and tapping it doubles them; there is no update path.
const L = require('./lib-verify15.js');
const BASE = [['Suit', 'charcoal', 'M&S', 'pinstripe'], ['Shirt', 'pink/white', '', 'gingham'], ['Shirt', 'blue & white', 'Hilditch', 'stripe'],
  ['Tie', 'navy', '', 'knit'], ['Tie', 'burgundy & navy', "Drake's", 'repp stripe'], ['Tie', 'gold', '', 'paisley'], ['Tie', 'navy', '', 'polka dot'],
  ['Trousers', 'khaki', 'Gap', ''], ['Shoes', 'oxblood', '', ''], ['Shoes', 'tan', '', '']];
const first = 'Category\tColor\tBrand\n' + BASE.map(r => r.slice(0, 3).join('\t')).join('\n');
const second = 'Category\tColor\tBrand\tPattern\n' + BASE.map(r => r.join('\t')).join('\n');
L.run(async () => {
  await L.start('w2-15-02');
  await L.paste(first); await L.addItems();
  const n1 = (await L.itemsNow()).length;
  await L.openImport();
  const pv = await L.paste(second);
  const newRows = pv.rows.filter(r => r.on && !r.dup);
  await L.addItems();
  const its = await L.itemsNow();
  const ties = its.filter(i => i.t === 'tie').map(i => `${i.c}${i.c2 ? '&' + i.c2 : ''}/${i.p}`);
  const ok = n1 === 10 && newRows.length === 7 && /Add 7 items/.test(pv.btn) && !/pattern|update|same piece/i.test(pv.prev.split('\n')[0]) && its.length === 17;
  L.verdict(ok, { afterFirst: n1, summary: pv.prev.split('\n')[0], button: pv.btn, rowsTickedNew: newRows.map(r => `${r.type}/${r.c}/${r.p}`), afterSecond: its.length, ties });
});
