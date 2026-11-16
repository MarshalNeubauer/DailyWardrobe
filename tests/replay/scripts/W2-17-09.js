// W2-17-09: What to buy contradicts the wardrobe. Tester 17's wardrobe (a charcoal glen-check suit and a navy chalk-stripe suit),
// Sun 15 Nov: Insights → What to buy, read the sheet. Checks: the funeral line says there is no black, charcoal or navy suit; the
// metals point is made twice in one occasion; "A second … pair lets each rest" for a pair planned at most a few times.
// node tests/replay/run.js --only W2-17-09
const V = require('./lib-verify17.js');
V.run(async () => {
  await V.startLab('09');
  const { ph } = await V.wardrobePhone('09', '2026-11-15T07:30:00+03:00');
  await ph.page.locator('#n-stats').click(); await V.sleep(1500);
  await ph.tap('#shop-btn');
  let t = ''; for (let i = 0; i < 120; i++) { await V.sleep(1000); t = await ph.page.evaluate(() => document.querySelector('#shop-sheet').innerText); if (/possible purchases compared/.test(t)) break }
  const occ = t.slice(t.indexOf('\nOccasions'));
  const funeral = (occ.match(/Funeral[\s\S]*?(?=\nNo jacket or tie|$)/) || [''])[0];
  const suits = await ph.page.evaluate(() => items.filter(i => i.type === 'suit').map(i => i.name + ' (' + colName(i.primaryColor) + ', ' + i.pattern + ')'));
  const noDarkSuit = /No black, charcoal or navy suit for a funeral/.test(funeral);
  const metalsTwice = /different metals/.test(occ) && /metals differ/.test(occ);
  const second = (t.match(/[^\n]*\n(A second [^\n]*)/) || [null, null, null]);
  const shoesLine = (t.match(/[^\n]*of the next \d+ workdays\./) || [null])[0];
  V.verdict(noDarkSuit && metalsTwice, { suits, funeral: funeral.split('\n'), metalsTwice, secondPair: second[0] && second[0].split('\n'), shoesLine, occasions: occ.split('\n').slice(0, 30) });
});
