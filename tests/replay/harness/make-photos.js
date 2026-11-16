/* Stand-in photos for the replay scripts, drawn in a headless browser into .work/photos/a and .work/photos/b.
   The audit used the owner's own photos; those never go into the repo. The scripts only need distinct, photo-sized JPEGs:
   tagging is mocked, so what they show doesn't matter, but their size does (W2-18-01 measures how many photo items fit in
   one backup, and assumes each is a few hundred KB at 1536 px as real photos are). So each picture is 1500x2000, a lit
   backdrop with a garment-shaped silhouette and fine grain over everything, which keeps a JPEG about as large as a phone
   photo. The file names are the audit's (opaque ids), so scripts that name a file or sort the folder behave as they did.
   node tests/replay/harness/make-photos.js   (paths.js runs it on first use) */
const fs = require('fs'), path = require('path');
const R = require('./paths.js');
const { webkit } = require('playwright');
const SETS = {
  a: ['c35c0d6d866b9ebe6', 'c7e7304aaf275052e', 'c957da963043b96a3', 'cb62dcdc02879a5f0', 'cb7a20d54cc5a72e9', 'cb90cf59ca12b90c5', 'cd782453196c9f2b8', 'cde6c165cc0ad3333', 'contact-sheet'],
  b: ['c1132fb6a5a0ec93a', 'c231abaf31ee11443', 'c4956e18e7a4486e2', 'c801c50fc04012d61', 'c8045e8d0e21160e6', 'cbf859a3551c1b094', 'cd9e16b8a49e1e4fa', 'cfd6ca94cfa65a52e', 'sheet'],
};
const OUT = path.join(R.SCRATCH, 'photos');
(async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let k = 0;
    for (const [set, names] of Object.entries(SETS)) {
      const dir = path.join(OUT, set); fs.mkdirSync(dir, { recursive: true });
      for (const name of names) {
        const url = await page.evaluate(seed => {
          let a = seed * 2654435761 >>> 0; const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
          const W = 1500, H = 2000, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
          const bg = g.createLinearGradient(0, 0, W * rnd(), H); bg.addColorStop(0, `hsl(${rnd() * 360},12%,${78 + rnd() * 12}%)`); bg.addColorStop(1, `hsl(${rnd() * 360},10%,${55 + rnd() * 15}%)`);
          g.fillStyle = bg; g.fillRect(0, 0, W, H);
          const hue = rnd() * 360, light = 18 + rnd() * 55;
          g.fillStyle = `hsl(${hue},${20 + rnd() * 50}%,${light}%)`;
          g.beginPath(); g.moveTo(W * .3, H * .12); g.lineTo(W * .7, H * .12); g.lineTo(W * .92, H * .35); g.lineTo(W * .82, H * .42); g.lineTo(W * .74, H * .34);
          g.lineTo(W * .74, H * .9); g.lineTo(W * .26, H * .9); g.lineTo(W * .26, H * .34); g.lineTo(W * .18, H * .42); g.lineTo(W * .08, H * .35); g.closePath(); g.fill();
          g.strokeStyle = `hsla(${(hue + 180) % 360},40%,${light > 45 ? 25 : 80}%,.35)`; g.lineWidth = 6;   // a stripe or two, so it isn't flat
          for (let x = W * .26; x < W * .74; x += 40 + rnd() * 80) { g.beginPath(); g.moveTo(x, H * .14); g.lineTo(x, H * .9); g.stroke() }
          const im = g.getImageData(0, 0, W, H), d = im.data;
          for (let i = 0; i < d.length; i += 4) { const n = (rnd() - .5) * 18; d[i] += n; d[i + 1] += n + (rnd() - .5) * 8; d[i + 2] += n + (rnd() - .5) * 8 }
          g.putImageData(im, 0, 0);
          return c.toDataURL('image/jpeg', .9);
        }, ++k);
        fs.writeFileSync(path.join(dir, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
      }
    }
    fs.writeFileSync(path.join(OUT, 'done-v1'), new Date().toISOString());
  } finally { await browser.close() }
})().catch(e => { console.error(e && e.stack || e); process.exit(1) });
