// W2-13-02: imported wardrobe records are inserted into the page without escaping. A crafted "Restore file" backup whose item
// fields carry an attribute-breakout inserts inert marker elements (<i data-v13>) on Today and in the Wardrobe grid.
// Passive proof only: the markers run no script. Lab 9730/9731, fresh unconnected phone.
const RP = require('../harness/paths.js');
const L = require('./lib-verify13.js'), fs = require('fs');
L.run(async () => {
  const lab = await L.startLab('02');
  const t = Date.parse(L.T0) - 864e5 * 20, B = L.BREAK;
  const it = o => ({ pattern: 'solid', secondaryColor: 'none', tertiaryColor: 'none', added: t, updated: t, ...o });
  const backup = { app: 'daily-wardrobe', version: 1, items: [
    it({ id: 'id1' + B('id'), type: 'suit', primaryColor: 'navy' }),                                   // id -> onclick="openItem('..')" / id="gi-.."
    it({ id: 'ph1', type: 'shirt', primaryColor: 'white', photo: 'data:image/jpeg;base64,AAAA' + B('photo') }), // photo -> src=".."
    it({ id: 'col1', type: 'tie', primaryColor: 'burgundy' + B('color'), name: 'odd colour' }),          // primaryColor
    it({ id: 'set1', type: 'shirt', primaryColor: 'light blue', pattern: 'stripes',
         sett: { v: 2, a: 90, bands: [['#ffffff' + B('sett'), 1], ['#0000ff', 1]], cr: 4, tr: 20, src: 'claude' } }),  // sett band -> SVG fill
    it({ id: 'nm1', type: 'shoes', primaryColor: 'black', name: B('name') }) ],                           // name (tester: escaped)
    days: [], tombstones: {} };
  const file = RP.SCRATCH + '/kv/verify13-02-backup.json'; fs.writeFileSync(file, JSON.stringify(backup));
  const ph = await L.phone('02');
  await ph.page.goto(lab.appUrl); await ph.ready(); await L.sleep(1200);
  await L.skipSetup(ph);
  await L.restoreFile(ph, file); await L.sleep(1000);
  const afterRestore = await L.marks(ph);
  await L.closeSettingsUI(ph); await L.sleep(1200);
  const onToday = await L.marks(ph);
  // swipe a couple of coming days (the item sheet / stats sinks the tester cites draw on navigation)
  for (let i = 0; i < 2; i++) { await ph.swipe(330, 300, 60, 300); await L.sleep(600); }
  await ph.tap('#n-wardrobe').catch(() => {}); await L.sleep(1500);
  const onWardrobe = await L.marks(ph);
  const all = [...new Set([...afterRestore, ...onToday, ...onWardrobe])];
  const ok = all.length > 0 && (all.includes('id') || all.includes('photo') || all.includes('sett') || all.includes('color'));
  L.verdict(ok, { markersSeen: all, fieldsThatInjected: all, nameEscaped: !all.includes('name'),
    afterRestore, onToday, onWardrobe, note: 'each marker is an inert <i data-v13> element inserted because that field reached innerHTML unescaped' });
});
