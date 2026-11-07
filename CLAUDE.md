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

- `index.html`: the entire app (HTML, CSS, JS in one file, no build step). Wardrobe items are stored in the browser's IndexedDB on the user's device.
  - **Outfit planning:** `outfit()` / `buildPlan()` choose each day's outfit.
  - **Mannequin:** `renderMannequinCanvas()` draws the outfit as an SVG figure. `fabricDef()` builds each garment's fabric pattern.
  - **Pattern detection:** `detectPattern()` reads stripe and check layouts from the item photo when an item is saved. Colours always come from the item's tagged colours, matched by brightness rank, never from the photo.
  - **Pattern lists:** `PATS_BY` holds the per-type pattern lists. Keep them in sync with the prompt in `worker.js`.
- `worker.js`: Cloudflare Worker using Workers AI (`env.AI`, Llama 3.2 Vision) to tag photos. The user deploys it manually in the Cloudflare dashboard; merging doesn't deploy it.

## Testing

There is no test suite. Verify changes by loading `index.html` in headless Chromium (Playwright is preinstalled), seeding `items`, calling `renderToday()`, and checking screenshots and console errors.

The user's phone may run the Dark Reader extension. The page opts out via the `darkreader-lock` meta tag; keep it.
