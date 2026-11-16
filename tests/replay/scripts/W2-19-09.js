// W2-19-09: Larger Text is capped at 150% (index.html), and at Safari's 200% page zoom (201 CSS px) with 150% text Today's
// card titles ("Excellent", "November wear plan") are squeezed to about 20 px wide, one or two letters per line.
const L = require('./_verify19-lib.js');
L.run(async () => {
  await L.startLab('w2-19-09');
  const ph = await L.phone('a'); const p = ph.page; const ev = {};
  ev.capInIndex = await p.evaluate(() => /Math\.min\(1\.5,/.test(document.head.innerHTML));
  await p.setViewportSize({ width: 201, height: 437 });
  await p.evaluate(() => { document.documentElement.style.setProperty('--tscale', '1.5'); dispatchEvent(new Event('resize')) }); await L.sleep(800);
  const sb = p.locator('#sbox .month-link').first(); if (await sb.getAttribute('aria-expanded') === 'false') { await sb.click(); await L.sleep(800) }
  ev.squeezed = await p.evaluate(() => { const o = []; for (const el of document.querySelectorAll('#today *')) { if (!el.getClientRects().length) continue; const own = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim().length > 4); const r = el.getBoundingClientRect(); if (own && r.width > 0 && r.width < 30) o.push({ t: el.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }) } return o.slice(0, 6) });
  L.verdict(ev.capInIndex && ev.squeezed.length > 0, ev);
});
