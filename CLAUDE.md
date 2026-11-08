# CLAUDE.md

## Workflow

- **Merge automatically.** When a task is finished and tested, commit, push, open a pull request against `main`, and merge it without asking. Then tell the user what was merged and link the PR.
- **Don't merge when:**
  - tests fail or a change couldn't be verified;
  - the result is uncertain or only partly works;
  - the user says to wait.

  In those cases, push the branch, report the problem, and leave the PR unmerged.
- If the working branch's earlier PR is already merged, start the next change on top of the latest `main`. Merge `main` into the branch rather than force-pushing.
- The app is served from `main` by GitHub Pages, so a merge is a deploy.

## Project

Static app served from `main` by GitHub Pages (no build step). Classic scripts loaded in order, sharing one global scope:

| File | Contents |
|---|---|
| `index.html` | markup and script tags |
| `styles.css` | styles |
| `core.js` | colours, types, item helpers (no DOM; also loaded by background workers) |
| `planner.js` | outfit rules, `outfit()` / `buildPlan()`, `rateOutfit()` (no DOM) |
| `detect.js` | stripe/check detection from photos (canvas) |
| `figure.js` | Today's torso figure (from the design handoff; don't redraw it). Fabrics come in as ready-made `<pattern>`s from `figFabric()` in draw.js |
| `draw.js` | procedural fabric patterns (`fabricDef`), `figureSvg()` glue for the torso figure, accessories, wardrobe thumbnails |
| `analysis.js` | "what to buy" analysis (no DOM; runs in `analysis-worker.js`, a Web Worker) |
| `app.js` | IndexedDB storage (items, day history, settings; generated photos in `meta` as `render:<combination key>`), forms, screens, swipe gestures, weather |
| `sync.js` | backup/sync through the worker's `/sync` endpoint (KV), backup file download/restore |
| `sw.js` | service worker: network-first app files, offline fallback. Add new app files to `ASSETS` and bump `CACHE` |
| `worker.js` | Cloudflare Worker: photo tagging via the Claude API (secret `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL`; falls back to Workers AI binding `AI`), `/sync` (KV binding `WARDROBE`, requires `APP_TOKEN`) `/fetch` (downloads photo links for the app, requires `APP_TOKEN`) and `/render` (POST: realistic outfit photo via OpenAI's image edit API, secret `OPENAI_API_KEY`, optional `OPENAI_IMAGE_MODEL` (default `gpt-image-2`), `OPENAI_IMAGE_QUALITY`; photos are saved per outfit combination (`comboKey()` in app.js, a hash of the pieces and how they look) as `render:c<16 hex>` in KV (no expiry) and in `meta`, so a combination is never generated twice and GET/PUT `/render?key=` share it between devices; older `render:<date>` copies are migrated on first use; requires `APP_TOKEN`); the user deploys it by hand, merging doesn't deploy it |

Colours always come from the item's tagged colours, matched by brightness rank, never from the photo. Pattern lists in `PATS_BY` (core.js) must stay in sync with the prompt in `worker.js`.

## Testing

`npm test` (or `node tests/run.js`) serves the repo, drives it in headless Chromium and checks rendering, swipe/layout on phone and iPhone Duo viewports, the planner against an independent rule checklist, belts/leather/metals, the outfit score, photo-less adding, pattern detection, and `worker.js` with mocked bindings. GitHub Actions runs it on every PR (`.github/workflows/test.yml`). Add a check for every behaviour you change; extra suites can go in `tests/*.test.js`.

The user's phone may run the Dark Reader extension. The page opts out via the `darkreader-lock` meta tag; keep it.
