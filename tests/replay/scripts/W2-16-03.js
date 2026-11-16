// W2-16-03 (same cause as W1-1-05 / W1-8-02): a phone set up with the Arabic city search "الكويت" -> "Kuwait, KW", whose
// climate-history request fails (Open-Meteo's archive aborted here with page.route, standing in for the tester's real 429 /
// offline / outage), plans Kuwait's 20 Dec 2026 and 24 Feb 2027 as cold: Today says "It will be cold and there is no overcoat".
// core.js:197 uses CC_TMAX (Kuwait Dec 21 / Feb 22 C highs) only when !settings.location.
// V16NOROUTE=1 runs the same steps without blocking the archive (a control: then the climate history should load).
const V = require('./lib-verify16.js');
const btns = () => V.ph.page.evaluate(() => [...document.querySelectorAll('#setup button')].filter(b => b.offsetParent).map(b => b.innerText.trim()));
V.run(async () => {
  const archive = [], block = !process.env.V16NOROUTE;
  // page.route doesn't see it (the service worker fetches it), so the page's own fetch refuses the archive URL instead
  await V.start('w03', block ? { route: ph => ph.ctx.addInitScript(() => { const f = window.fetch; window.__arch = 0;
    window.fetch = function (u, o) { if (/archive-api\.open-meteo\.com/.test(String(u && u.url || u))) { window.__arch++; return Promise.reject(new TypeError('Load failed')) } return f.apply(this, arguments) } }) } : {});
  const steps = [];
  await V.tapText(/Get started/, '#setup button');
  for (let i = 0; i < 3; i++) { steps.push(await btns()); await V.tapText(/^Next$/, '#setup button') }
  await V.ph.tap('#su-city'); await V.ph.page.keyboard.insertText('الكويت'); await V.ph.tap('#su-find'); await V.sleep(2500);
  const cities = await V.ph.page.evaluate(() => [...document.querySelectorAll('#su-cities button')].map(b => b.innerText.trim()));
  await V.tapText(/^Kuwait, KW/, '#su-cities button'); await V.sleep(1500);
  for (let i = 0; i < 2; i++) { steps.push(await btns()); await V.tapText(/^Next$/, '#setup button') }
  steps.push(await btns());
  await V.tapText(/^Add my first item$/, '#setup button'); await V.sleep(1200);
  // the tour runs before Add: close it with its ✕
  for (let i = 0; i < 8; i++) { if (!await V.byText(/^✕$/, 'button')) break; await V.ph.tap('[data-v16]'); await V.sleep(600) }
  await V.wardrobe('Type\tColour\tName\nsuit\tnavy\tبدلة كحلي رسمية\nsuit\tcharcoal\tبدلة رمادية\nshirt\twhite\tقميص أبيض\nshirt\tlight blue\tقميص سماوي\ntie\tburgundy\tربطة خمرية\ntie\tnavy\tربطة كحلي\nshoes\tblack\tحذاء أسود\nbelt\tblack\tحزام أسود');
  await V.sleep(3000);
  const loc = await V.ph.page.evaluate(() => ({ archiveCallsRefused: window.__arch, loc: settings.location && { name: settings.location.name, cc: settings.location.cc }, climate: climate ? climate.map(m => m.tmax) : null, holidayCC: settings.holidays && settings.holidays.country }));
  const days = {};
  for (const at of ['2026-12-20T07:30:00+03:00', '2027-02-24T07:30:00+03:00']) {
    await V.setWorld(at); await V.ph.page.reload(); await V.ph.ready(); await V.sleep(2500);
    const t = await V.text('#today');
    days[at.slice(0, 10)] = { shown: (t.match(/^[A-Z][a-z]+day \d+ [A-Z][a-z]+/m) || [''])[0], cold: /It will be cold and there is no overcoat/.test(t),
      climate: await V.ph.page.evaluate(() => dayClimate(todayDate()).season) };
    await V.ph.shot('w2-16-03-' + at.slice(0, 10));
  }
  const ok = block && loc.loc && loc.loc.cc === 'KW' && !loc.climate && Object.values(days).every(d => d.cold && d.climate === 'cold');
  V.verdict(!!ok, { blockedArchive: block,cities, ...loc, days, setupSteps: steps.map(s => s.join(' | ')),
    note: 'CC_TMAX.KW Dec 21 C, Feb 22 C (mild) is used only without a location' });
});
