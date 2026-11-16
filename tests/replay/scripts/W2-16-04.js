// W2-16-04: Packing list, To pack: a row "<Arabic name> · N days" is laid out as "N · <name> days": the bidi algorithm joins
// " · N" to the Arabic run (pack.js renderPack `line`: name and <small>· N days</small> in one LTR run, no <bdi>/dir=auto).
// Measured from the glyph boxes: the day count's digit sits left of the Arabic name, "days" on the right.
const V = require('./lib-verify16.js');
V.run(async () => {
  await V.start('w04'); await V.skipSetup();
  await V.wardrobe('Type\tColour\tName\nsuit\tnavy\tبدلة كحلي رسمية\nsuit\tblack\tبدلة سوداء ٢\nshirt\twhite\tقميص أبيض\nshirt\tlight blue\tقميص سماوي\ntie\tburgundy\tربطة خمرية\ntie\tnavy\tربطة كحلي\nshoes\tblack\tحذاء أسود\nbelt\tblack\tحزام أسود\nsuit\tcharcoal\tGrey suit');
  await V.openSettings(); await V.ph.tap('#pack-btn'); await V.sleep(1500);
  // the name's and the count's glyph boxes from Range rects over the row's text nodes, whatever wraps the name (<bdi>, spans) or the count
  const rows = await V.ph.page.evaluate(() => [...document.querySelectorAll('#pack .pk-nm')].filter(e => e.querySelector('small')).map(e => {
    const sm = e.querySelector('small'), texts = root => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out = []; let n; while ((n = w.nextNode())) out.push(n); return out };
    const nameNodes = texts(e).filter(n => !sm.contains(n) && n.textContent.trim()), smNodes = texts(sm).filter(n => n.textContent.length);
    const box = rs => rs.reduce((u, r) => u ? { left: Math.min(u.left, r.left), right: Math.max(u.right, r.right), top: Math.min(u.top, r.top) } : { left: r.left, right: r.right, top: r.top }, null);
    const rng = (n, x, y) => { const r = document.createRange(); r.setStart(n, x); r.setEnd(n, y); return r.getBoundingClientRect() };
    const nameText = nameNodes.map(n => n.textContent).join('');
    const nm = box(nameNodes.map(n => { const s = n.textContent, st = s.length - s.trimStart().length; return rng(n, st, s.trimEnd().length) }));
    const dn = smNodes.find(n => /\d/.test(n.textContent)), di = dn ? dn.textContent.search(/\d/) : -1, last = smNodes[smNodes.length - 1], lt = last.textContent.trimEnd();
    const dg = rng(dn, di, di + 1), dy = rng(last, lt.length - 3, lt.length);
    return { text: e.innerText.trim(), arabic: /[\u0600-\u06FF]/.test(nameText), nameLeft: Math.round(nm.left), nameRight: Math.round(nm.right),
      digitLeft: Math.round(dg.left), daysLeft: Math.round(dy.left), digitLeftOfName: dg.right <= nm.left + 1, sameLine: Math.abs(dg.top - nm.top) < 4 };
  }));
  await V.ph.shot('w2-16-04');
  const ar = rows.filter(r => r.arabic && r.sameLine), lat = rows.filter(r => !r.arabic && r.sameLine);
  const ok = ar.length > 0 && ar.every(r => r.digitLeftOfName && r.daysLeft >= r.nameRight - 1) && lat.every(r => !r.digitLeftOfName);
  V.verdict(ok, { arabicRows: ar, latinRows: lat, otherRows: rows.filter(r => !r.sameLine).length });
});
