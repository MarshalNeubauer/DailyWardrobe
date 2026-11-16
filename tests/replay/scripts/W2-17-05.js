// W2-17-05: "Add as a new colour" on an Add card fills Claude's suggested name with the shade of the color it tagged: "Dusty pink"
// over a cream swatch. A phone joins by the tester invitation, skips the setup, Add → One item with a photo whose (mocked) tag is a
// cream suit, low confidence, newColor "dusty pink", no clothBox and no close-up; then "Add as a new colour".
// node tests/replay/run.js --only W2-17-05
const RP = require('../harness/paths.js');
const V = require('./lib-verify17.js');
const P = require(RP.H + 'phone.js');
V.run(async () => {
  const L = await V.startLab('05');
  const T = '2026-11-15T07:30:00+03:00';
  await V.mock('clock', { at: new Date(T).toISOString() });
  const ph = await P.openPhone({ profile: 'verify17-05', fresh: true, time: T });
  try {
    await ph.page.goto(L.inviteLink); await ph.ready(); await V.sleep(2500);
    const w = await ph.page.evaluate(() => localStorage.worker_url); if (w !== `http://127.0.0.1:${V.PORT + 1}/`) throw new Error('worker_url ' + w);
    await V.tapText(ph, /^Skip$/); await V.sleep(800);
    await ph.tap('#fr-add'); await V.sleep(800);
    await V.mock('next-tag', { type: 'suit', primaryColor: 'cream', secondaryColor: null, tertiaryColor: null, pattern: 'solid', confidence: { type: 'high', primaryColor: 'low', pattern: 'high' },
      altColor: null, altPattern: null, newColor: { name: 'dusty pink', why: 'a muted rose' }, newPattern: null, clothBox: null, patternBox: null, weave: null });
    await ph.page.locator('#add-one input[type=file]').setInputFiles(RP.SAMPLES_A + '/c35c0d6d866b9ebe6.jpg');
    let offer = null; for (let i = 0; i < 40 && !offer; i++) { await V.sleep(500); if (await ph.page.locator('button:visible', { hasText: /Add as a new colou?r/ }).count()) offer = true }   // "colour" (aa24910) or "color" (#462)
    const offerText = await ph.page.evaluate(() => { const o = document.querySelector('.offer'); return o && o.textContent.trim() });
    if (!offer) throw new Error('no "Add as a new colour" offer; card: ' + offerText);
    await V.tapText(ph, /Add as a new colou?r/); await V.sleep(1000);
    const sheet = await ph.page.evaluate(() => { const n = colPick && colPick.newc; const q = queue[0]; return { name: n && n.name, hex: n && n.hex, creamHex: COLORS.cream, cardColour: q && q.primaryColor, meas: q && q.meas ? q.meas.hex : null } });
    const log = await V.mock('log'); await ph.shot('w2-17-05-sheet');
    V.verdict(/pink/i.test(sheet.name || '') && sheet.hex && sheet.hex.toLowerCase() === String(sheet.creamHex).toLowerCase(),
      { offerText, sheet, openai: log.openai, claude: log.claude, errors: ph.errors.slice(0, 3) });
  } finally { await ph.kill() }
});
