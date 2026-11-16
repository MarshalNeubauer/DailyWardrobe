// W2-19-06: after the "Saved ... Undo" toast has faded (opacity 0), its text and Undo stay focusable, and pressing the
// invisible Undo 10 s later still undoes the save.
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-06');
  const ph = await L.phone('a'); const p = ph.page; const ev = {};
  await L.kbd(ph, '#n-wardrobe', 800); await L.kbd(ph, '#ward-add', 900);
  const n0 = await p.evaluate(() => items.length);
  await L.kbd(ph, '#add button:has-text("Add without")', 900);
  await L.kbd(ph, '#add button:has-text("Confirm")', 1200);
  const n1 = await p.evaluate(() => items.length);
  await L.sleep(10000);
  ev.toast = await p.evaluate(() => { const t = document.querySelector('#toast'), b = t.querySelector('button'); return { text: t.textContent, opacity: getComputedStyle(t).opacity, hidden: t.hidden || getComputedStyle(t).visibility === 'hidden' || t.getAttribute('aria-hidden') === 'true', undoFocusable: !!b && b.tabIndex >= 0 } });
  if (ev.toast.undoFocusable) { await p.locator('#toast button').focus(); await p.keyboard.press('Enter'); await L.sleep(1200) }
  const n2 = await p.evaluate(() => items.length);
  ev.items = { before: n0, afterConfirm: n1, afterInvisibleUndo: n2 };
  L.verdict(ev.toast.opacity === '0' && !ev.toast.hidden && ev.toast.undoFocusable && n1 === n0 + 1 && n2 === n0, ev);
});
