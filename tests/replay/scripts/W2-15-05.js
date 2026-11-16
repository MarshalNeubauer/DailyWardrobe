// W2-15-05: a Notes list (no header), a title line above the header, and everyday headers ("Item type", "Colours",
// "Clothing", "Piece") are all refused as a whole with the "first row must name the columns" message.
const L = require('./lib-verify15.js');
const CASES = {
  notesList: 'Navy suit\nWhite shirt x3\nBurgundy tie',
  titleRow: 'My clothes (updated Oct)\nType\tColour\nSuit\tnavy\nShirt\twhite',
  itemTypeColours: 'Item type\tColours\nSuit\tnavy\nShirt\twhite',
  clothingColour: 'Clothing\tColour\nSuit\tnavy',
  pieceColour: 'Piece,Colour\nSuit,navy',
  control: 'Category\tColor\nSuit\tnavy'
};
L.run(async () => {
  await L.start('w2-15-05');
  const out = {};
  for (const [k, t] of Object.entries(CASES)) { const pv = await L.paste(t); out[k] = { refused: /first row must name the columns/.test(pv.prev), button: pv.btn } }
  const ok = ['notesList', 'titleRow', 'itemTypeColours', 'clothingColour', 'pieceColour'].every(k => out[k].refused && /^Add items$/.test(out[k].button)) && !out.control.refused;
  L.verdict(ok, out);
});
