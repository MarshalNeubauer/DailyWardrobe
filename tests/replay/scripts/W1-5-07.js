// W1-5-07: phone B's clock 3 minutes slow. A renames Tan chinos and backs up; B syncs (sees A's name), renames it again and
// backs up; A syncs. B's later rename carries an older stamp than A's and vanishes, from B too.
const V = require('./lib-verify5.js');
V.run(async () => {
  const { A, B } = await V.startTwo('w07', { bOffsetMs: 180000 });
  const skew = Math.round((A.now() - B.now()) / 1000);
  const id = await V.openItem(A, 'Tan chinos'); await V.rename(A, 'Tan chinos (A)'); await V.closeItem(A);
  await V.sync(A); await V.sleep(3000);
  await V.sync(B); const Bsaw = await V.item(B, id);
  await V.openItem(B, 'Tan chinos (A)'); await V.rename(B, 'Tan chinos (B, later)'); await V.closeItem(B);
  const Bafter = await V.item(B, id);
  await V.sync(B); await V.sync(A); await V.sync(B);
  const kv = (await V.kvData()).items.find(i => i.id === id);
  const end = { A: await V.item(A, id), B: await V.item(B, id), server: kv.name };
  V.verdict(Bsaw.n === 'Tan chinos (A)' && Bafter.n === 'Tan chinos (B, later)' && end.A.n === 'Tan chinos (A)' && end.B.n === 'Tan chinos (A)' && end.server === 'Tan chinos (A)', { clockSkewSeconds: skew, Bsaw, Bafter, end });
});
