# Daily Wardrobe

A phone-first web app that plans what to wear to work. You photograph your suits, blazers, pants, shirts, ties, shoes and accessories; the app reads each photo, then plans an outfit for every working day: pieces that go together, rotated so nothing is worn too often, adjusted to the weather forecast and to occasions such as a wedding or a formal day.

What it does:

- **Today**: the day's outfit as a picture, its pieces, a score with what could be put right, and the month's plan. Swap any piece, mark the day worn or not, move an outfit to another day.
- **Wardrobe**: every item with its photo, color, pattern and fabric close-up; take a piece out of rotation or add one that is on its way.
- **Add**: one photo per item, or one photo of several items. Color, pattern and type are read for you and can be corrected.
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

- **Anthropic (Claude)**: item photos and close-ups, to read their type, color and pattern.
- **Cloudflare Workers AI**: the same photos, only on a server with no Anthropic key (a fallback reader, `@cf/meta/llama-3.2-11b-vision-instruct` unless `MODEL` says otherwise).
- **OpenAI**: an item's photo and description, only when the person taps Generate item pictures (product pictures of shoes, belts, socks, pants, coats and watches). Outfit pictures are painted on the device and never go to OpenAI.
- **Open-Meteo**: the place set for the weather (the name typed in its search, then its coordinates), for the forecast and the usual weather by month. Sent from the device, with no account.
- **Nager.Date**: the country chosen for public holidays, sent from the device; for countries it doesn't cover the server asks **Google**'s public holiday calendar for that country instead.
- **A calendar's provider (Apple iCloud, Google, Microsoft…)**: with a calendar connected (Settings → Calendar), the server fetches its subscription link from the provider when the app asks; the link is kept in the person's settings and backup, never logged, and only the next 60 days' dates, titles and places go back to the phone.
- **Apple or Google push services**: with the morning reminder on, the phone's push address goes to the server, which sends an empty push through the phone maker's service (Apple's for an iPhone, Google's for Chrome on Android); the outfit lines stay on the phone.
- **Cloudflare**: as the server's host, it sees each request to the server (address, time, size) in its usual logs.

Nothing else is shared.

## Hosting

Two parts, no build step.

**The app** is a set of static files (`index.html`, `styles.css`, the scripts, `sw.js`) served by **GitHub Pages** from the `main` branch: Settings → Pages → Deploy from a branch → `main` / root. A merge to `main` is a release. Every release bumps the number in `sw.js` (`CACHE='dw-v<n>'`): that number is the version the app shows, and it is how installed copies learn there is something new.

**The server** is one **Cloudflare Worker** (`worker.js`, configured by `wrangler.toml`). It reads photos, makes item pictures, keeps the outfit pictures the owner's computer uploads, keeps each person's backup and daily copies, and handles invites and feedback. It needs:

| Setting | Kind | What for |
| --- | --- | --- |
| `APP_TOKEN` | secret | the owner's key to the server; any long random string |
| `ANTHROPIC_API_KEY` | secret | reading photos with Claude |
| `OPENAI_API_KEY` | secret | making item pictures (optional: without it only that button fails) |
| `ALLOWED_ORIGIN` | variable | the app's address, e.g. `https://NAME.github.io` (no path) |
| `CLAUDE_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` | variables, optional | which models to use |
| `MODEL` | variable, optional | the Workers AI model that reads photos when there is no Anthropic key |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | secrets, optional | sign the morning reminder's pushes: the public key is the base64url P-256 public point, the private one the base64url 32-byte private scalar; without them the reminder can't be switched on |
| `VAPID_SUBJECT` | variable, optional | the contact sent with each push (the app's https address or a `mailto:`) |
| `TESTER_DAILY_TOTAL` | variable, optional | JSON, e.g. `{"item":20}`: changes the daily ceilings for all testers together (`tag`, `pattern`, `item`, `upload`, `feedback`, `backup`, `push`), on top of each tester's own |
| `WARDROBE` | KV namespace | backups, kept pictures, feedback |
| `RENDER_QUEUE` | Queue `wardrobe-renders` | finishes deleting a large account in the background |
| `RENDER_HUB` | Durable Object | counts each tester's daily use |
| `AI` | Workers AI binding, optional | photo reading when there is no Anthropic key |

Secrets are set once in the Cloudflare dashboard (or `wrangler secret put NAME`) and never live in this repository. `.github/workflows/deploy-worker.yml` deploys the worker whenever a merge to `main` changes it; for that the repository needs the secret `CLOUDFLARE_API_TOKEN` and the variables `CLOUDFLARE_ACCOUNT_ID` and `WARDROBE_KV_ID`. Until they are set the workflow skips and the worker is deployed by hand (`npx wrangler deploy`).

The owner connects their own device under Settings → Connection with the server's address and `APP_TOKEN`, and sends each tester an invite link. Invite links open only on the app's own server: if you host the worker yourself, put its address in `APP_SERVERS` in account.js, or links to it are refused. A tester who lost the link gets a new one from the owner's list (Settings → Connection → New link); it opens the same wardrobe.

## The color-coded masters and the master atlas

An assembled outfit picture is painted on a color-coded master photo (one per kind of dress), from each garment's color and pattern. Each phone paints its own looks, on its graphics chip where it can (about 90 ms a look) or on the processor.

Two scripts for the computer, in PowerShell from the repository folder (after `npm install` and `npx playwright install chromium`, as for the tests), with the server's address and code in the environment: `$env:DW_WORKER='https://<your worker>.workers.dev/'; $env:DW_TOKEN='<APP_TOKEN>'`. The code is only read from the environment: never put it in a file in the repository. Each upload is one write on the server's storage (the free plan allows 1,000 a day for everything), and this computer uploads at most 300 a day (`tools/upload-budget.js`).

- `npm run cm-upload -- --dir <folder>` puts the color-coded masters (each kind's master, zone masks, sleeve and lapel masks, from the folder `colormaster.js` writes) on the server under the keys the app asks for. `--kinds suit,vest` limits it to some kinds, `--bg <file>` uploads the background behind every master (alone, or with the masters), `--dry` says what would go up. A record already there with the same signature is not written again.
- `npm run atlas` measures every pixel of the masters once and writes the full atlas for work on the computer to `--out` (default `./atlas`, which git ignores); it uploads nothing. `--parts <folder>` adds finer SAM part pictures, `--origin` as above. Run it again after a master or a mask is made again. `node tools/atlas.js <folder> list` reads it back.

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

On Windows, in PowerShell, `npm` may be blocked by the script policy (`npm.ps1 cannot be loaded`): type `npm.cmd` instead (`npm.cmd test`, `npm.cmd run cm-upload`), or run the scripts with `node` directly (`node tests/run.js --changed`).

The tests serve the repository locally, drive the app in headless Chromium at phone sizes, and run `worker.js` with mocked bindings: nothing touches a real server. `npm test` compares the branch with `origin/main` and uses `tests/impact.map` (what each test uses) to pick the tests; commit the map with the change. Before a push, `.githooks/pre-push` (switched on by the first test run) refuses it while the map has uncommitted changes, while the branch changed app files without a `CACHE` in `sw.js` above `main`'s, or while ESLint finds a name that doesn't exist in a changed script. `CLAUDE.md` describes every file and the working rules in detail.
