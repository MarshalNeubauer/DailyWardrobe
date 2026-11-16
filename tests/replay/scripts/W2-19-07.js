// W2-19-07: dark theme, the red confirm button of "Remove the sample" is white on #e2695f, 3.27:1 (15 px, under 4.5:1).
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-07');
  const ph = await L.phone('d', { colorScheme: 'dark' }); const p = ph.page;
  await ph.tap('button:has-text("Remove the sample")'); await L.sleep(900);
  const ev = await p.evaluate(() => { const b = document.querySelector('#ask-sheet.on .ask-danger'); if (!b) return { found: false }; const cs = getComputedStyle(b); return { found: true, text: b.textContent.trim(), fg: cs.color, bg: cs.backgroundColor, px: cs.fontSize, weight: cs.fontWeight, ratio: __v19.ratio(cs.color, cs.backgroundColor) } });
  L.verdict(ev.found && ev.ratio < 4.5 && parseFloat(ev.px) < 18.66, ev);
});
