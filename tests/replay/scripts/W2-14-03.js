// W2-14-03: Settings → Backup & sync → daily backups on day 2: Monday's copy is labeled with Sunday's time (the time the copy's
// content was saved), so the list reads as two or three "Sun, Nov 15" entries, with no item counts, and the roll-back question
// doesn't say how many items the copy holds. Realistic path: Sunday's items ARE uploaded (phone put away), then a change on Monday.
const V = require('./lib-verify14.js');
V.run(async () => {
  await V.start('w2-14-03');
  await V.wardrobe('Type\tColour\nSuit\tgrey\nShirt\twhite\nShirt\tlight blue\nTie\tburgundy\nShoes\tblack');
  await V.ph.background(); await V.sleep(2000);
  await V.setWorld('2026-11-16T07:40:00+03:00'); await V.ph.page.reload(); await V.ph.ready(); await V.sleep(1500);
  await V.tapText(/^4 pieces/); await V.ph.tap('button.swap[aria-label="Change shirt"]'); await V.sleep(900);   // a change on Monday
  await V.tapText(/Light blue|White/i, '[role=dialog] button'); await V.sleep(1000);
  await V.ph.background(); await V.sleep(2000); await V.ph.foreground(); await V.sleep(500);
  await V.ph.tap('button[aria-label="Settings"]'); await V.sleep(800);
  await V.ph.tap('#sc-backup .scat-head'); await V.sleep(2500);
  const opts = await V.ph.page.evaluate(() => [...document.querySelectorAll('#snap-list option')].map(o => ({ id: o.value, label: o.textContent })));
  const status = await V.text('#snap-status');
  const dump = await V.mock('kv-dump');
  const counts = {};
  for (const [k, e] of Object.entries(dump.kv || dump)) if (/snap:/.test(k)) { let n = '?'; try { const v = JSON.parse(e.v || e); n = ((v.data || v).items || []).length } catch {} counts[k] = n }
  await V.ph.page.selectOption('#snap-list', opts[1].id); await V.ph.tap('#snap-btn'); await V.sleep(800);
  const ask = await V.ph.page.evaluate(() => { const d = [...document.querySelectorAll('[role=alertdialog],[role=dialog]')].find(e => e.getBoundingClientRect().height > 0 && /Roll back to/.test(e.innerText)); return d ? d.innerText.trim() : '' });
  await V.tapText(/^Cancel$/);
  const real = opts.filter(o => o.id);
  const sundayLabels = real.filter(o => /Sun, Nov 15/.test(o.label)).length;
  const mon = real.find(o => o.id === '2026-11-16');
  const noCounts = !real.some(o => /item/i.test(o.label)) && !/item/i.test(ask);
  V.verdict(!!mon && /Sun, Nov 15/.test(mon.label) && sundayLabels === real.length && noCounts, { options: opts, status, itemsInEachCopy: counts, rollBackQuestion: ask });
});
