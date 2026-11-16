// W2-18-01: a phone holding many photo items the server doesn't have yet can never back up: every backup is ONE POST /sync carrying
// every missing photo; over 48 MiB the worker answers 413 and the app sends the same body again at every background, storing nothing.
// Also finds the smallest number of photo items that triggers it, with photos made as Add makes them from the 16 sample photos.
//  A (own account): N-1 photo items added at once, then the app goes to the background -> one POST, 200 (just under 48 MiB)
//  B (own account): N photo items added at once, background, then background twice more -> 413 every time, nothing stored
// SETUP (impossible by hand): the items are stored with the app's kitStore, as an import stores them (see lib-verify18.js).
// node tests/replay/run.js --only W2-18-01
const V = require('./lib-verify18.js');
const LIMIT = 48 * 1024 * 1024, OVER = 2600;   // OVER: the POST's own bytes beyond its items (baseRev, day, the setup's day records), measured 2448
const sum = a => a.reduce((p, c) => p + c, 0);
V.run(async () => {
  await V.startLab('01');
  const A = await V.joined('01a');
  const sizes = (await V.addPhotoItems(A, 200, { store: false })).per;
  let N = 1; while (sum(sizes.slice(0, N)) + OVER <= LIMIT) N++;
  const withClose = (await V.addPhotoItems(A, 160, { store: false, closeups: true })).per;
  let NC = 1; while (sum(withClose.slice(0, NC)) + OVER <= LIMIT) NC++;
  // A: N-1 items
  const a = await V.addPhotoItems(A, N - 1);
  const aPosts = await V.backgroundAndWait(A);
  const k0 = (await V.mock('log')).kvPut;
  // B: N items, then two more closes of the app
  const B = await V.joined('01b');
  const kvB0 = (await V.mock('log')).kvPut;
  const b = await V.addPhotoItems(B, N);
  const b1 = await V.backgroundAndWait(B), b2 = await V.backgroundAndWait(B), b3 = await V.backgroundAndWait(B);
  const kvB = (await V.mock('log')).kvPut - kvB0;
  const bAll = [...b1, ...b2, ...b3];
  const sentMB = Math.round(sum(bAll.map(p => p.up)) / 1e6);
  const ok = aPosts.some(p => p.st === 200 && p.up > 40e6) && bAll.length >= 3 && bAll.every(p => p.st === 413 && p.up > LIMIT) && kvB === 0;
  V.verdict(ok, {
    perItemKB: { photoOnly_avg: Math.round(sum(sizes) / sizes.length / 1024), photoKB: a.photoKB, smallKB: a.smKB, withCloseup_avg: Math.round(sum(withClose) / withClose.length / 1024) },
    smallestTriggering: { photoOnly: N, withCloseups: NC, at171KBperItem_ownerAverage: Math.ceil(LIMIT / (171 * 1024)) },
    A_justUnder: { items: N - 1, posts: aPosts.map(p => `${p.st} up ${p.up}`) },
    B_atN: { items: N, closes: [b1, b2, b3].map(x => x.map(p => `${p.st} up ${p.up}`)), uploadedMB: sentMB, kvWritesForB: kvB, status: await V.status(B) },
    errors: [...A.errors, ...B.errors].slice(0, 5)
  });
});
