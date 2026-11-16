/* The testers' error reports kept by the worker (GET /errors, owner only), newest first: when, who, the app version, the page, what
   broke and the line of code. Read-only.
     DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> node tools/read-errors.js [--name Natasha] [--days 7] */
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] || d };
const W = String(process.env.DW_WORKER || '').replace(/\/?$/, '/'), T = process.env.DW_TOKEN || '';
if (!W.startsWith('http') || !T) { console.log('Usage: DW_WORKER=https://<worker>/ DW_TOKEN=<owner code> node tools/read-errors.js [--name <tester>] [--days 7]'); process.exit(1) }
const NAME = arg('name', ''), DAYS = +arg('days', 30) || 30;
(async () => {
  const r = await fetch(W + 'errors', { headers: { 'x-app-token': T, origin: 'https://marshalneubauer.github.io' } });
  const j = await r.json().catch(() => ({})); if (!r.ok) { console.log('HTTP', r.status, JSON.stringify(j)); process.exit(1) }
  const since = Date.now() - DAYS * 86400000, list = (j.items || []).filter(e => e.t >= since && (!NAME || (e.name || '').toLowerCase() === NAME.toLowerCase()));
  if (!list.length) { console.log('No error reports' + (NAME ? ' from ' + NAME : '') + ' in the last ' + DAYS + ' days.'); return }
  for (const e of list) console.log(`${new Date(e.t).toISOString().slice(0, 16).replace('T', ' ')} ${String(e.name || '?').padEnd(10)} v${e.v || '?'} ${String(e.w || '-').padEnd(8)} ${e.m}${e.at ? '\n      @ ' + e.at : ''}`);
})();
