// W2-19-05: the current tab and the active Wardrobe chip are marked only with class "on" (no aria-current / aria-pressed / aria-selected).
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-05');
  const ph = await L.phone('a'); const p = ph.page;
  await L.kbd(ph, '#n-wardrobe', 800);
  await p.locator('#wardrobe .chip').nth(1).click(); await L.sleep(700);
  const st = el => ({ t: el.textContent.trim().slice(0, 20), on: el.classList.contains('on'), state: ['aria-current', 'aria-pressed', 'aria-selected', 'aria-checked'].map(a => el.getAttribute(a)).filter(x => x != null) });
  const ev = await p.evaluate(st => ({ tab: (new Function('return ' + st))()(document.querySelector('#n-wardrobe')), chip: (new Function('return ' + st))()(document.querySelectorAll('#wardrobe .chip')[1]) }), st.toString());
  L.verdict(ev.tab.on && ev.chip.on && !ev.tab.state.length && !ev.chip.state.length, ev);
});
