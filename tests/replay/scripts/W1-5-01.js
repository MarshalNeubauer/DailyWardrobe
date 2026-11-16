// W1-5-01: two phones change different fields of the same item before either backs up; one change is silently lost.
// A renames Pink shirt -> "Pink oxford"; B takes Pink shirt out of rotation; A backs up, B backs up, A syncs.
const V = require('./lib-verify5.js');
V.run(async () => {
  const { A, B } = await V.startTwo('w01');
  const id = await V.openItem(A, 'Pink shirt'); await V.rename(A, 'Pink oxford'); await V.closeItem(A);
  await V.openItem(B, 'Pink shirt'); await V.rot(B); await V.closeItem(B);
  const before = { A: await V.item(A, id), B: await V.item(B, id) };
  await V.bgfg(A); await V.bgfg(B); await V.sync(A);
  const kv = (await V.kvData()).items.find(i => i.id === id);
  const after = { A: await V.item(A, id), B: await V.item(B, id), server: { n: kv.name, paused: !!kv.paused } };
  const both = x => x.n === 'Pink oxford' && x.paused;
  const lost = [after.A, after.B, after.server].some(x => !both(x));
  V.verdict(lost && before.A.n === 'Pink oxford' && before.B.paused, { before, after, toastA: await A.page.locator('#toast').innerText().catch(() => '') });
});
