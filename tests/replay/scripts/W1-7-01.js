// W1-7-01: a re-invited tester's phone that hasn't yet heard (by any request with its old code) that the old invitation was
// switched off is asked "Switch this phone…? … clear" instead of round 2's N1 "Back up this phone's wardrobe with …'s invitation?",
// and "Clear" wipes the wardrobe; the new account gets nothing and the old one is switched off.
// node W1-7-01.js [variant] [--clear]
//   opentab   (default) the new link opens in the tab already showing the app (a hashchange); clears by default
//   pending   same, with a change made after the last backup (the "Wore" pill tapped): a backup is tried first, gets 403
//   clean     same, after backing up until nothing is waiting (acctPending false): no backup attempt before the question
//   knows     control: Settings is opened first (its GET /me with the old code answers 403 'invite off'), then the link
//   coldslow  Safari closed; the first open is the new link, every server reply delayed 1.5 s
//   coldfast  control: the same with no delay
const L = require('./_verify7-lib.js');
const V = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'opentab';
const CLEAR = V === 'opentab' || V === 'clean' || V === 'pending' || process.argv.includes('--clear');
L.main(async () => {
  const info = await L.startLab('W1-7-01-' + V);
  const E = await L.open('01-' + V);
  await L.joinAndFill(E, info.inviteLink);
  if (V === 'clean') for (let k = 0; k < 4 && await E.page.evaluate(() => acctPending()); k++) { await E.advance(61000); await L.bgfg(E) }
  if (V === 'pending') { await L.tapL(E, L.btn(E, /Wore/)); await L.sleep(800) }   // a change made after the last backup ("✕ Didn't")
  const pend0 =await E.page.evaluate(() => acctPending());   // (read only)
  const s0 = await L.phoneState(E); L.log('before', s0, 'pending', pend0, 'kv', await L.kvItems());
  const r = await L.revokeAndRenew(info.inviteCode); L.log('owner: revoked', r.revoked, 'new invitation made');
  await L.mock('count-reset');
  if (V === 'knows') { await E.page.evaluate(() => openSettings('connection')); await L.sleep(2500); L.log('after Settings: ended known', (await L.phoneState(E)).ended); await E.page.evaluate(() => closeSettings()); await L.sleep(800) }
  if (V === 'coldslow' || V === 'coldfast') {
    await E.kill(); if (V === 'coldslow') await L.mock('delay', { ms: 1500 });
    await E.reopen(r.link); await E.ready().catch(() => { });
  } else await E.page.goto(r.link);   // same page, only the # part changes
  const q = await L.waitAsk(E, 40);
  const atAsk = await L.phoneState(E).catch(() => null);
  const btns = await E.page.evaluate(() => [...document.querySelectorAll('#ask-ok,#ask-cancel')].map(b => b.innerText.trim())).catch(() => []);
  const reqs = (await L.mock('log')).recent.filter(x => /->/.test(x)).map(x => x.replace(/^\S+ /, ''));
  L.log('QUESTION', q ? q.split('\n')[0] : null); L.log('buttons', btns); L.log('state at question', atAsk); L.log('requests until then', reqs);
  await E.shot('W1-7-01-' + V + '-ask');
  await L.mock('reset');
  const wrongQ = !!q && /^Switch this phone/.test(q);
  let after = null, kv = null;
  if (CLEAR && q) {
    await E.page.click('#ask-ok');
    for (let i = 0; i < 40; i++) { await L.sleep(500); try { if (await E.page.evaluate(() => window.appReady)) break } catch { } }
    await L.sleep(6000); await L.checkWorker(E);
    after = await L.phoneState(E); kv = await L.kvItems();
    L.log('AFTER tapping', btns[btns.length - 1] || btns[0], after); L.log('server wardrobes', kv, 'old account', r.oldId);
    await E.shot('W1-7-01-' + V + '-after');
  }
  if (V === 'knows' || V === 'coldfast') {
    console.log(/^Back up this phone/.test(q || '') ? 'NOT REPRODUCED (control: N1 asked correctly: "Back up this phone’s wardrobe…")' : 'REPRODUCED (even the control path got the wrong question)');
    return;
  }
  const lost = after && after.items === 0 && kv && kv[r.oldId] && kv[r.oldId].items === L.N_ITEMS && Object.entries(kv).some(([k, v]) => k !== r.oldId && v.items === 0);
  if (wrongQ && (!CLEAR || lost)) console.log(`REPRODUCED: asked "${q.split('\n')[0]}" (buttons ${JSON.stringify(btns)}) though the old invitation is switched off` + (CLEAR ? `; after clearing the phone holds ${after.items} items, the new account 0, the switched-off account ${L.N_ITEMS}` : ''));
  else console.log('NOT REPRODUCED: question ' + JSON.stringify(q && q.split('\n')[0]) + (after ? ' after ' + JSON.stringify(after) : ''));
});
