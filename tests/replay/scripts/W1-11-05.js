// W1-11-05: a phone joining an account while its storage is full shows an empty app and the Welcome; the failure is only in Settings'
// backup status, in the browser's words, never the app's plain "storage is full" sentence.
// Lab stand-in for a full disk: an init script makes IDBObjectStore put/add throw QuotaExceededError while cookie dwfail=1 is set
// (real WebKit aborts the transaction asynchronously instead).
const L = require('./_verify11-lib.js');
async function installFail(ph) {
  const add = () => ph.ctx.addInitScript(() => { const P = IDBObjectStore.prototype;
    for (const m of ['put', 'add']) { const o = P[m]; P[m] = function (...a) { if (/(^|; )dwfail=1/.test(document.cookie)) { window.__failN = (window.__failN || 0) + 1; throw new DOMException('The quota has been exceeded.', 'QuotaExceededError') } return o.apply(this, a) } } });
  await add(); const open = ph.open; ph.open = async () => { const p = await open(); await add(); return p };
}
const setFail = (ph, on) => ph.ctx.addCookies([{ name: 'dwfail', value: on ? '1' : '0', url: `http://127.0.0.1:${L.PORT}/` }]);
(async () => {
  const ev = []; let ok = true;
  await L.startLab('verify11-05');
  try {
    const inv = await L.invite('v05');
    const a = await L.phone('05a');
    await L.world(a, '2026-11-15T07:30:00+03:00');
    await a.page.goto(inv.link); await a.ready(); await L.sleep(2500); await L.checkWorker(a);
    await L.tapSel(a, '#su-skip'); await L.sleep(600);
    await L.addPhotos(a, L.PHOTOS.slice(0, 5));
    await L.goTab(a, 'Today'); await a.background(); await L.sleep(3000);
    const sa = await L.state(a); ev.push(`phone A: ${sa.n} items, backed up ${!!sa.last}`); await a.kill();
    if (sa.n !== 5 || !sa.last) { ok = false; ev.push('setup failed') }
    // second phone, storage full, opens the invitation link
    const b = await L.phone('05b'); await installFail(b); await setFail(b, true);
    await L.world(b, '2026-11-15T09:00:00+03:00');
    const toasts = [];
    await b.page.goto(inv.link); await b.ready();
    for (let i = 0; i < 32; i++) { await L.sleep(250); const t = await b.page.evaluate(() => { const e = document.querySelector('#toast'); return e && e.classList.contains('on') ? e.innerText : '' }).catch(() => ''); if (t && !toasts.includes(t)) toasts.push(t) }
    await L.checkWorker(b);
    const sb = await L.state(b), fails = await b.page.evaluate(() => window.__failN || 0);
    ev.push(`storage full: ${sb.n} items in the app, setup shown ${sb.setupShown}, ${fails} failed writes`);
    ev.push('toasts: ' + JSON.stringify(toasts));
    ev.push('backup status: ' + sb.sync);
    const plain = toasts.some(t => /storage is full/i.test(t));
    if (sb.n !== 0 || plain || !/^Backup failed/.test(sb.sync || '')) ok = false;
    // space freed: the next start restores everything by itself
    await setFail(b, false); await b.reopen(L.APP); await b.ready(); await L.sleep(7000);
    const sc = await L.state(b); ev.push(`after freeing space and reopening: ${sc.n} items`);
    await b.kill();
  } catch (e) { ok = false; ev.push('ERROR ' + e.message) }
  await L.stopLab(); L.done(ok, ev); process.exit(0);
})();
