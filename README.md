# Daily Wardrobe

Phone-friendly wardrobe app. `index.html` is the whole front end. `worker.js` is the small server that reads photos with Claude so your API key never sits in the repo.

## Deploy

1. **Front end.** Put `index.html` in the root of your repo. In GitHub: Settings → Pages → Deploy from a branch → `main` / root. The app is then at `https://YOURNAME.github.io/REPO/`.
2. **Photo reading.** Create a Cloudflare Worker, paste in `worker.js`, and add these settings:
   - `ANTHROPIC_API_KEY` (secret): your key from console.anthropic.com
   - `APP_TOKEN` (secret): any long random string
   - `ALLOWED_ORIGIN`: `https://YOURNAME.github.io` (no path, no trailing slash)
   - `MODEL` (optional): defaults to `claude-sonnet-5-5`
3. **Connect the phone.** Open the site, tap ⚙, enter the worker URL and the `APP_TOKEN`. Both are stored only in that browser.
4. **Install.** Share → Add to Home Screen.

Without step 2 the app still works: colour and pattern come from the pixels and you pick the item type yourself.

## Behaviour

- Wardrobe data (photos, swatches) is stored in the browser on that phone. It is not synced between devices. Clearing site data deletes it.
- Today is the home tab. Sunday–Wednesday are full suits, Thursday is blazer + dress pants + shirt + tie, Friday and Saturday are empty.
- A suit or blazer is not repeated within 3 days when you own enough of them. Change `COOL` in `index.html` to adjust.
- Thursday needs items of type Blazer and Dress pants. Add them like anything else.
