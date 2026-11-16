// W2-15-04: after an empty row, the preview's "Row N" for a left-out row is one too low (the blank line isn't counted).
const L = require('./lib-verify15.js');
// line 1 header, 2 suit, 3 tie, 4 empty, 5 pocket square (refused), 6 belt
L.run(async () => {
  await L.start('w2-15-04');
  const pv = await L.paste('Type\tColour\nSuit\tnavy\nTie\tnavy\n\t\nPocket square\twhite\nBelt\tbrown');
  const bad = pv.rows.find(r => r.bad);
  const ok = bad && bad.line === 4 && /Row 4/.test(pv.prev);
  L.verdict(ok, { pocketSquareIsOnLine: 5, previewSays: (pv.prev.match(/Row \d+[^\n]*\n[^\n]*/) || [''])[0], bad });
});
