// W2-15-03: "lt. blue" / "lt blue" import as mid blue and "dk grey" as grey (the key), shown as a correct reading ("read as blue").
const L = require('./lib-verify15.js');
L.run(async () => {
  await L.start('w2-15-03');
  const pv = await L.paste('Type\tColour\nShirt\tlt. blue\nShirt\tlt blue\nTrousers\tdk grey\nShirt\tlight blue\nTrousers\tdark grey');
  const c = pv.rows.map(r => r.c);
  const ok = c[0] === 'blue' && c[1] === 'blue' && c[2] === 'grey' && c[3] === 'lightblue' && c[4] !== 'grey';
  L.verdict(ok, { read: { 'lt. blue': c[0], 'lt blue': c[1], 'dk grey': c[2], 'light blue': c[3], 'dark grey': c[4] }, preview: pv.prev.slice(0, 500) });
});
