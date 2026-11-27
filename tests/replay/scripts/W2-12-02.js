// W2-12-02: a day off named with a long unbroken text (a pasted link, 57 characters) makes a chip wider than the screen; its x
// is past the right edge, the Settings sheet doesn't scroll sideways, so the day off can't be removed. The name field has no limit.
const L = require('./_verify12-lib.js');
const NAME = 'https://intranet.example.com/hr/leave/requests/2026/12/21';
L.run(async () => {
  await L.startLab('w2-12-02');
  const ph = await L.phone('a'), pg = ph.page;
  await ph.tap('header .hbtns button[data-act="setOpenTap"]'); await L.sleep(700);
  await ph.tap('#sc-daysoff .scat-head'); await L.sleep(500);
  await pg.fill('#cfg-off-from', '2026-12-21');
  await ph.tap('#cfg-off-name'); await pg.keyboard.insertText(NAME);
  await ph.tap('.offadd button'); await L.sleep(900);
  const geo = await pg.evaluate(() => { const c = [...document.querySelectorAll('#off-list .fchip')][0]; if (!c) return null; const b = c.querySelector('button').getBoundingClientRect(), r = c.getBoundingClientRect(), m = document.querySelector('#settings-modal');
    return { chipW: Math.round(r.width), xLeft: Math.round(b.left), xRight: Math.round(b.right), vw: innerWidth, modalScrollW: m.scrollWidth, modalClientW: m.clientWidth, docScrollW: document.documentElement.scrollWidth, maxlength: document.querySelector('#cfg-off-name').getAttribute('maxlength') } });
  await ph.shot('w2-12-02');
  // a person swipes left to reach it, then taps at the right edge of the chip's row
  const y = await pg.evaluate(() => { const c = document.querySelector('#off-list .fchip'); return c.getBoundingClientRect().y + c.getBoundingClientRect().height / 2 });
  await ph.swipe(350, y, 50, y); await L.sleep(400);
  const afterSwipe = await pg.evaluate(() => Math.round(document.querySelector('#off-list .fchip button').getBoundingClientRect().left));
  await ph.tapAt(geo.vw - 3, y); await L.sleep(700);
  const stillThere = await pg.evaluate(() => (HOOK.settings.daysOff || []).some(x => x.d === '2026-12-21'));
  const ok = geo && geo.xLeft >= geo.vw - 2 && stillThere && afterSwipe >= geo.vw - 2;
  L.verdict(ok, { ...geo, buttonLeftAfterSwipe: afterSwipe, dayOffStillThereAfterEdgeTap: stillThere, stored: await pg.evaluate(() => HOOK.settings.daysOff) });
});
