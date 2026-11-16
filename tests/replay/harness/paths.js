/* Where the replay scripts find things, and where they put their scratch output.
   Every script and helper requires this first (`const R = require('../harness/paths.js')`).

   R.REPO      the checkout this file is in
   R.APP       the app under test: DW_APP (set by tests/replay/run.js --app <dir>), else the checkout itself
   R.H         this folder (lab.js, phone.js), with a trailing slash
   R.SCRIPTS   tests/replay/scripts (the W* scripts and their helper libraries)
   R.FIX       tests/replay/fixtures (committed inputs)
   R.SCRATCH   tests/replay/.work (git-ignored): kv files, browser profiles, screenshots, lab info files, old builds, photos
   R.labInfo(port)  the file a lab writes its invitation link and token to
   R.old(sha)  an older build of the app, made from git on demand (see oldBuild below)
   R.SAMPLES_A / R.SAMPLES_B  generated stand-in photos (two folders of 9), made on first use by make-photos.js

   It also stops the script's own Node process from reaching anything but this machine: a fetch to another host throws. */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..');
const REPLAY = path.join(REPO, 'tests', 'replay');
const SCRATCH = process.env.DW_REPLAY_SCRATCH ? path.resolve(process.env.DW_REPLAY_SCRATCH) : path.join(REPLAY, '.work');
const slash = p => p.split(path.sep).join('/');
for (const d of ['kv', 'profiles', 'shots', 'labs', 'builds', 'photos', 'logs']) fs.mkdirSync(path.join(SCRATCH, d), { recursive: true });

const APP = slash(path.resolve(process.env.DW_APP || REPO));

/* An older build, extracted from git into .work/builds/<sha>. Scripts that replay "the phone was still on the old app"
   need these. Without the commit in this clone's history (a shallow clone, a fork without it) this throws with a message
   that says so: the script then gives NO VERDICT, it never passes. Fetch the history (`git fetch --unshallow`) to fix it. */
function oldBuild(sha) {
  const dir = path.join(SCRATCH, 'builds', sha);
  if (fs.existsSync(path.join(dir, 'index.html')) && fs.existsSync(path.join(dir, 'worker.js'))) return slash(dir);
  const full = spawnSync('git', ['rev-parse', '--verify', '--quiet', sha + '^{commit}'], { cwd: REPO, encoding: 'utf8' });
  if (full.status !== 0) throw new Error(`old build ${sha} is not in this clone's git history (shallow clone?): run \`git fetch --unshallow origin\` and try again`);
  const tmp = dir + '.tmp-' + process.pid, tar = tmp + '.tar';
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  const a = spawnSync('git', ['archive', '--format=tar', '-o', tar, sha], { cwd: REPO, encoding: 'utf8' });
  if (a.status !== 0) throw new Error(`git archive ${sha} failed: ${a.stderr}`);
  const x = spawnSync('tar', ['-xf', tar, '-C', tmp], { encoding: 'utf8' });
  fs.rmSync(tar, { force: true });
  if (x.status !== 0) throw new Error(`could not extract ${sha}: ${x.stderr || x.error}`);
  try { fs.renameSync(tmp, dir) } catch (e) {   // another script extracted it at the same time
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!fs.existsSync(path.join(dir, 'index.html'))) throw e;
  }
  return slash(dir);
}

/* Stand-in photos (never the owner's own): drawn by make-photos.js the first time they are needed */
const PHOTOS = path.join(SCRATCH, 'photos');
const photosReady = () => fs.existsSync(path.join(PHOTOS, 'done-v1'));
function ensurePhotos() {
  if (photosReady()) return;
  const r = spawnSync(process.execPath, [path.join(__dirname, 'make-photos.js')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!photosReady()) throw new Error('could not make the stand-in photos: ' + (r.stderr || r.stdout || r.error));
}

/* Node's own fetch in a script: this machine only */
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//i;
if (globalThis.fetch && !globalThis.fetch.__replayGuard) {
  const real = globalThis.fetch;
  const guarded = (u, o) => {
    const href = String(u && u.url || u);
    if (!LOCAL.test(href)) {
      const msg = `[replay] BLOCKED a script's own request to ${href}: the replay tests talk to 127.0.0.1 only`;
      console.error(msg);
      return Promise.reject(new Error(msg));
    }
    return real(u, o);
  };
  guarded.__replayGuard = true;
  globalThis.fetch = guarded;
}

module.exports = {
  REPO: slash(REPO), REPLAY: slash(REPLAY), APP, SCRATCH: slash(SCRATCH),
  H: slash(__dirname) + '/',
  SCRIPTS: slash(path.join(REPLAY, 'scripts')),
  FIX: slash(path.join(REPLAY, 'fixtures')),
  labInfo: port => slash(path.join(SCRATCH, 'labs', `lab-${port}.json`)),
  old: oldBuild,
  get SAMPLES_A() { ensurePhotos(); return slash(path.join(PHOTOS, 'a')) },
  get SAMPLES_B() { ensurePhotos(); return slash(path.join(PHOTOS, 'b')) },
  ensurePhotos,
  LOCAL,
};
