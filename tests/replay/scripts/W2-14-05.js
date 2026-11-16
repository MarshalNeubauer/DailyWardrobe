// W2-14-05: one suit past its 5 wears: Today's picture has the red "Overdue · Suit – worn 6 of 5" banner; tapping it does nothing
// (no sheet, no question, no way to "Cleaned today"), and nothing on Today leads to Settings → Laundry & cleaning.
const V = require('./lib-verify14.js');
V.run(async () => {
  await V.start('w2-14-05');
  await V.wardrobe('Type\tColour\nSuit\tgrey\nShirt\twhite\nShirt\tlight blue\nTie\tburgundy\nShoes\tblack');
  await V.ph.background(); await V.sleep(1500);   // (as a person: the phone goes in the pocket)
  for (const d of ['16', '17', '18', '19', '22']) {   // open the app each workday morning, then put the phone away
    await V.setWorld(`2026-11-${d}T07:40:00+03:00`); await V.ph.page.reload(); await V.ph.ready(); await V.sleep(2500);
    if (d !== '22') { await V.ph.background(); await V.sleep(800) }
  }
  const band = await V.ph.page.evaluate(() => { const b = document.querySelector('#cband'); return b && { text: b.innerText.trim().replace(/\s+/g, ' '), role: b.getAttribute('role'), onclick: !!b.onclick || b.hasAttribute('onclick'), red: !!document.querySelector('.care-over') } });
  const state = () => V.ph.page.evaluate(() => ({ dialogs: [...document.querySelectorAll('[role=dialog],[role=alertdialog],.sheet')].filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight }).map(e => e.id || e.className), y: scrollY, url: location.hash }));
  const s0 = await state();
  await V.ph.tap('#cband'); await V.sleep(1000);
  const s1 = await state();
  const today = await V.text('#today');
  const leadsToCare = /clean(er|ed today)|Laundry/i.test(today.replace(/to the cleaner today/g, ''));
  await V.ph.shot('v14-overdue');
  V.verdict(!!band && /Overdue/.test(band.text) && JSON.stringify(s0.dialogs) === JSON.stringify(s1.dialogs) && !leadsToCare, { band, before: s0, afterTap: s1, todayMentionsCleaningAction: leadsToCare });
});
