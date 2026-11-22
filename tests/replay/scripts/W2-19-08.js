// W2-19-08: text fields' outlines are under 3:1 against what surrounds them (light: Wardrobe search/sort and the item sheet's fields;
// dark: the same fields).
const L = require('./_verify19-lib.js');
const FIELDS = () => [...document.querySelectorAll('#item-view.on input[type=text], #item-view.on select, #wardrobe input#wsearch, #wardrobe select#wsort')].filter(e => e.getClientRects().length).map(e => {
  const cs = getComputedStyle(e); let par = e.parentElement, bg = null;
  while (par) { const c = getComputedStyle(par).backgroundColor; if (__v19.col(c)[3] > 0.99) { bg = c; break } par = par.parentElement }
  return { el: e.tagName + (e.id ? '#' + e.id : ''), border: cs.borderTopColor, around: bg, best: Math.max(__v19.ratio(cs.borderTopColor, bg), __v19.ratio(cs.backgroundColor, bg)) } });
L.run(async () => {
  await L.startLab('w2-19-08');
  const ev = {};
  for (const scheme of ['light', 'dark']) {
    const ph = await L.phone(scheme, { colorScheme: scheme }); const p = ph.page;
    await L.kbd(ph, '#n-wardrobe', 800);
    const ward = await p.evaluate(FIELDS);
    await p.locator('#wardrobe .giopen').nth(2).click(); await L.sleep(900);
    const item = (await p.evaluate(FIELDS)).filter(f => !/wsearch|wsort/.test(f.el));
    ev[scheme] = { wardrobe: ward, itemSheet: item.slice(0, 4), worst: Math.max(...ward.concat(item).map(f => f.best)) };
  }
  L.verdict(ev.light.worst < 3 && ev.dark.worst < 3, ev);
});
