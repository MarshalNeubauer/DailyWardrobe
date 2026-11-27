// W1-5-04: an item sheet left open on A while B's "Take out of rotation" arrives; A's sheet still says "Take out of rotation",
// and tapping it puts the piece back IN rotation. A's pull comes from going to the background and back after over a minute
// (the phone's clock is moved on 61 s while in the background instead of waiting).
const V = require('./lib-verify5.js');
V.run(async () => {
  const { A, B } = await V.startTwo('w04');
  const id = await V.openItem(A, 'Brown belt');
  await V.openItem(B, 'Brown belt'); await V.rot(B); await V.closeItem(B);
  const B1 = await V.item(B, id);
  await V.bgfg(B);
  await A.background(); await V.sleep(800); await A.advance(61000); await A.foreground();
  await V.sleep(1000); await A.page.waitForFunction(() => !HOOK.syncing, null, { timeout: 20000 }); await V.sleep(800);
  const pulled = { item: await V.item(A, id), label: await A.page.locator('#item-view .rotbtn').innerText(), sheetOpen: await A.page.evaluate(() => !!HOOK.editing) };
  await A.shot('w04-stale');
  await V.rot(A);
  const toast = await A.page.locator('#toast').innerText().catch(() => '');
  const A2 = await V.item(A, id);
  V.verdict(B1.paused && pulled.item.paused && /Take out/.test(pulled.label) && !A2.paused, { B1, pulled, tapped: 'Take out of rotation', A2, toast });
});
