# Daily Wardrobe

A phone-first web app that plans what to wear to work. You photograph your suits, blazers, trousers, shirts, ties, shoes and accessories; the app reads each photo, then plans an outfit for every working day: pieces that go together, rotated so nothing is worn too often, adjusted to the weather forecast and to occasions such as a wedding or a formal day.

What it does:

- **Today**: the day's outfit as a picture, its pieces, a score with what could be put right, and the month's plan. Swap any piece, mark the day worn or not, move an outfit to another day.
- **Wardrobe**: every item with its photo, colour, pattern and fabric close-up; take a piece out of rotation or add one that is on its way.
- **Add**: one photo per item, or one photo of several items. Colour, pattern and type are read for you and can be corrected.
- **What to buy**: what the wardrobe is missing, tested against the next six months of planning.
- **Stats**: what was really worn, and what never is.
- **Settings**: working days, days off and occasions, weather, photos, backup and sync, and About (version and updates, feedback, deleting your data, privacy).

It installs to the home screen (Share → Add to Home Screen) and works offline once opened.

## Joining as a tester

Testers join with an **invite link** from the app's owner. Open the link on your phone: it opens the app and connects it to the owner's server, so photo reading, outfit pictures and your own backup work without any setup. Then add the app to your home screen.

- Your wardrobe is yours: it lives on your device and in your own backup on the server.
- When a new version is out the app says so and offers **Update**; it never restarts by itself.
- **Settings → About** is where you send feedback, and where you can delete your data, from the device alone or from the server too.

Without an invite the app still runs on its own: outfits are planned and drawn, but photos are not read for you, no outfit pictures are made and nothing is backed up.

## Privacy

The wardrobe is kept on the device and in the person's own backup on the server (a Cloudflare Worker and its storage). What leaves the device, and where it goes:

- **Anthropic (Claude)**: item photos and close-ups, to read their type, colour and pattern.
- **Cloudflare Workers AI**: the same photos, only on a server with no Anthropic key (a fallback reader, `@cf/meta/llama-3.2-11b-vision-instruct` unless `MODEL` says otherwise).
- **OpenAI**: item photos and the outfit, only when the person taps Generate photo or Generate item pictures.
- **Open-Meteo**: the place set for the weather (the name typed in its search, then its coordinates), for the forecast and the usual weather by month. Sent from the device, with no account.
- **Nager.Date**: the country chosen for public holidays, sent from the device; for countries it doesn't cover the server asks **Google**'s public holiday calendar for that country instead.
- **Apple or Google push services**: with the morning reminder on, the phone's push address goes to the server, which sends an empty push through the phone maker's service (Apple's for an iPhone, Google's for Chrome on Android); the outfit lines stay on the phone.
- **Cloudflare**: as the server's host, it sees each request to the server (address, time, size) in its usual logs.

Nothing else is shared.

## Hosting

Two parts, no build step.

**The app** is a set of static files (`index.html`, `styles.css`, the scripts, `sw.js`) served by **GitHub Pages** from the `main` branch: Settings → Pages → Deploy from a branch → `main` / root. A merge to `main` is a release. Every release bumps the number in `sw.js` (`CACHE='dw-v<n>'`): that number is the version the app shows, and it is how installed copies learn there is something new.

**The server** is one **Cloudflare Worker** (`worker.js`, configured by `wrangler.toml`). It reads photos, makes the outfit pictures, keeps each person's backup and daily copies, and handles invites and feedback. It needs:

| Setting | Kind | What for |
| --- | --- | --- |
| `APP_TOKEN` | secret | the owner's key to the server; any long random string |
| `ANTHROPIC_API_KEY` | secret | reading photos with Claude |
| `OPENAI_API_KEY` | secret | making outfit and item pictures |
| `ALLOWED_ORIGIN` | variable | the app's address, e.g. `https://NAME.github.io` (no path) |
| `CLAUDE_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` | variables, optional | which models to use |
| `MODEL` | variable, optional | the Workers AI model that reads photos when there is no Anthropic key |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | secrets, optional | sign the morning reminder's pushes: the public key is the base64url P-256 public point, the private one the base64url 32-byte private scalar; without them the reminder can't be switched on |
| `VAPID_SUBJECT` | variable, optional | the contact sent with each push (the app's https address or a `mailto:`) |
| `TESTER_DAILY_TOTAL` | variable, optional | JSON, e.g. `{"photo":20}`: changes the daily ceilings for all testers together (`tag`, `pattern`, `photo`, `item`, `upload`, `feedback`, `backup`, `push`), on top of each tester's own |
| `WARDROBE` | KV namespace | backups, kept pictures, feedback |
| `RENDER_QUEUE` | Queue `wardrobe-renders` | pictures made in the background |
| `RENDER_HUB` | Durable Object | tells an open app its picture is ready |
| `AI` | Workers AI binding, optional | photo reading when there is no Anthropic key |

Secrets are set once in the Cloudflare dashboard (or `wrangler secret put NAME`) and never live in this repository. `.github/workflows/deploy-worker.yml` deploys the worker whenever a merge to `main` changes it; for that the repository needs the secret `CLOUDFLARE_API_TOKEN` and the variables `CLOUDFLARE_ACCOUNT_ID` and `WARDROBE_KV_ID`. Until they are set the workflow skips and the worker is deployed by hand (`npx wrangler deploy`).

The owner connects their own device under Settings → Connection with the server's address and `APP_TOKEN`, and sends each tester an invite link.

## Pre-building the assembled outfit pictures

An assembled outfit picture is put together from the master photo and one photo per piece. A phone can do that itself, but it takes a few seconds a look, and longer with large masters. A computer can build every look ahead of time and upload it, so phones only download the finished picture.

**When:** after the masters, the calibration photos and the item pieces are made, and again whenever a piece is made again, or after a release that changes how pictures are assembled (`ASM_ZV` in `assemble.js`). Pictures built before such a change are ignored by phones until it is run again.

**How**, in PowerShell from the repository folder (after `npm install` and `npx playwright install chromium`, as for the tests):

```
$env:DW_WORKER='https://<your worker>.workers.dev/'; $env:DW_TOKEN='<APP_TOKEN>'; npm run assemble
```

Options go after `--`, e.g. `npm run assemble -- --dry --days 60`:

| Option | What it does |
| --- | --- |
| `--days N` | how far ahead to plan (default 120) |
| `--jobs N` | how many pictures are painted at once (default half the computer's logical cores, at most 16) |
| `--profile FOLDER` | keep the browser's data there between runs (wardrobe, masters, each master's worked-out part, the record of uploads), so the next run starts warm |
| `--watch M` | keep running: every M minutes (default 5) rebuild only what changed; ends with code 10 when `main` moves on GitHub |
| `--save FOLDER` | keep a copy of every picture there |
| `--worker URL` | the server's address, instead of `DW_WORKER` |
| `--dry` | build and report, upload nothing |
| `--origin URL` | the app's address, if it isn't `https://marshalneubauer.github.io/DailyWardrobe/` |

**What it does:**
1. It runs the app in a headless browser, connected as the owner.
2. It loads the wardrobe from the backup. The backup is never written.
3. It builds the picture of every look in the coming workdays with the same code a phone runs, from the same photos.
4. It uploads each picture to the server, tagged with the photos it was built from. A look whose picture on the server is already current is skipped, so a second run uploads nothing.

**On a phone:**
- It asks for a look's picture before downloading its pieces, and uses it if it is at least as new as every photo the phone holds.
- If a piece was made again since the upload, or nothing was uploaded for the look (a swap, a new look), the phone builds it itself, as before.

**Costs:**
- Each upload is one write on the server's storage. The free plan allows 1,000 a day for everything, so run it once after making pieces, not in a loop.
- The code (`DW_TOKEN`) is only read from the environment: never put it in a file in the repository.

## The colour-coded masters and the master atlas

Two more scripts for the computer, with `DW_WORKER` and `DW_TOKEN` set as for `npm run assemble`:

- `npm run cm-upload -- --dir <folder>` puts the colour-coded masters (each kind's master, zone masks, sleeve and lapel masks, from the folder `colormaster.js` writes) on the server under the keys the app asks for. `--kinds suit,vest` limits it to some kinds, `--bg <file>` uploads the background behind every master (alone, or with the masters), `--dry` says what would go up. A record already there with the same signature is not written again.
- `npm run atlas` measures every pixel of the masters once: it uploads the phones' share (three pictures, none when the server already has them) and writes the full atlas for work on the computer to `--out` (default `./atlas`, which git ignores). `--parts <folder>` adds finer SAM part pictures, `--dry` uploads nothing, `--origin` as above. Run it again after a master, the black calibration shirt or a zone picture is made again. `node tools/atlas.js <folder> list` reads it back.

## Running the tests

```
npm install
npx playwright install chromium
npm test            # only the checks the current change can affect
npm run test:all    # every check
npm run test:webkit # every check on WebKit (Safari's engine; needs `npx playwright install webkit`)
node tests/run.js about   # the test files whose name contains "about"
npm run lint        # ESLint over every script (the push check runs it on the changed ones)
npm run gaps        # the functions and CSS rules no test reaches, from tests/impact.map
```

On Windows, in PowerShell, `npm` may be blocked by the script policy (`npm.ps1 cannot be loaded`): type `npm.cmd` instead (`npm.cmd test`, `npm.cmd run assemble`), or run the scripts with `node` directly (`node tests/run.js --changed`).

The tests serve the repository locally, drive the app in headless Chromium at phone sizes, and run `worker.js` with mocked bindings: nothing touches a real server. `npm test` compares the branch with `origin/main` and uses `tests/impact.map` (what each test uses) to pick the tests; commit the map with the change. Before a push, `.githooks/pre-push` (switched on by the first test run) refuses it while the map has uncommitted changes, while the branch changed app files without a `CACHE` in `sw.js` above `main`'s, or while ESLint finds a name that doesn't exist in a changed script. `CLAUDE.md` describes every file and the working rules in detail.
