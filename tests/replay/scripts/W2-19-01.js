// W2-19-01: after Next day, the Wore pill and opening an item (by keyboard), the control used is destroyed by the redraw,
// focus falls to <body>, and no live region announces the new day or the new state.
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-01');
  const ph = await L.phone('a'); const p = ph.page; const ev = {};
  const press = async (k, sel, ms = 1100) => {
    await p.locator(sel).first().evaluate(el => { window.__pressed = el }); await p.evaluate(() => __v19.live());
    await L.kbd(ph, sel, ms);
    ev[k] = await p.evaluate(() => ({ focus: __v19.act(), controlStillInPage: window.__pressed.isConnected, announced: __v19.live() }));
  };
  const h0 = await p.evaluate(() => document.querySelector('#today h2')?.textContent.slice(0, 30));
  await press('nextDay', 'button[aria-label="Next day"]');
  ev.dayChanged = h0 !== await p.evaluate(() => document.querySelector('#today h2')?.textContent.slice(0, 30));
  await press('previousDay', 'button[aria-label="Previous day"]');   // back to today, which has the Wore pill
  await press('worePill', '#wpill', 900);
  await L.kbd(ph, '#n-wardrobe', 800);
  await press('openItem', '#wardrobe .giopen >> nth=2', 900);
  const bad = ['nextDay', 'previousDay', 'worePill', 'openItem'].every(k => ev[k].focus === 'BODY' && ev[k].announced.length === 0);
  L.verdict(ev.dayChanged && bad, ev);
});
