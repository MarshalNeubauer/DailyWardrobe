# server stream: notes for CLAUDE.md

Did this change how outfits are chosen? **No** (no `PLAN_RULES` bump).

`sw.js`: `account.js` was added to `ASSETS`; `CACHE` still needs its bump by the lead.

`wrangler.toml`: not changed. `RenderHub` is already declared with `new_sqlite_classes` (migration `v1`), so it has storage; the per-person hubs are more instances of the same class, which needs no migration.

## Bullets to add

### `account.js` (new heading, after `sync.js`)

- who the app is connected as (loaded after sync.js): the server knows the owner and the testers the owner invited; `acct` holds what `GET /me` said
- an invitation link is `<app url>#invite=<code>&w=<encodeURIComponent(server url)>`; `connectFromLink(text)` → Promise<boolean> asks that server `GET /me` with the code and, only when it is accepted, stores `localStorage.worker_url` / `app_token`, toasts "Connected as <name>" and syncs; `acctStart()` calls it at start-up when the address carries `#invite=`
- a link the server refuses changes nothing (an existing connection stays) and says so; the `#invite` part is dropped from the address bar either way, except when the server could not be reached, so opening the app again tries once more
- Settings → Connection: `#acct-box` (index.html) is drawn by `renderAccountUI()` and filled by `loadAccount()` (`GET /me`, and `GET /invites` for the owner); a tester sees today's use against each cap ("Outfit photos today: 3 of 12", `ACCT_CAPS`, `acctUse`), the owner "Invite testers": a name and Create (`createInvite`), the new link shown once with Copy (`copyInvite`; gone when Settings is opened again), and each invitation with today's use and Revoke (`revokeInvite`)
- `acctStart()` wraps `renderSettingsExtras` (app.js) so the box is drawn whenever Settings draws its extras, with no edit to app.js; `loadAccount` asks at most once in 3 s
- an older server answers `/me` 404 or 405: the box stays empty (`acct.state` 'old'); 403 shows that the connection was not accepted
- a daily limit reaches the user as the server's `message`: the Add card and "several items" show it through `detail` (the worker sends the sentence as both), Generate photo shows the sentence alone (`generateRender`'s catch knows "Today’s limit"), `renderCombo`, `renderItemPic`, `queueCombo` and `asmMake` throw `j.message||j.error`, the month batch and the item-picture batch stop at it, and a pattern reading (which falls back to the pixel reader without a word) toasts it through `limitNote` (shown again if another toast replaced it)
- `tests/accounts.test.js` covers the server side and the app (the link, the Connection page at 390px light and 626px dark, each limit message)

### `worker.js`

- people: `whoIs(env, token)` is the one place that says who is calling, from the `x-app-token` header (`POST /` also takes the body's `appToken`, for an older cached app): the owner when the token's SHA-256 equals `APP_TOKEN`'s (`sha256Hex`, `sameText`; never `!==`) → `{id:'owner', role:'owner', ns:'', caps:null}`; a tester when KV has `invite:<sha256 hex of the code>` = `{id, name, caps, created, off}` → `{id, name, role:'tester', ns:'u:<id>:', caps, hash}`; `off` → 403 `{error:'invite off', message}`
- without `APP_TOKEN` every route refuses (403), the three tagging routes included: they used to run open (`if (env.APP_TOKEN && …)`)
- the router is the table `ROUTES` (`'<METHOD> <path>'` → `[handler(req, env, json, who, cors), what to say when APP_TOKEN is unset]`): `fetch()` resolves the caller once and hands `who` to the handler; no handler checks the token itself
- storage per person: every KV key of a person's data starts with `who.ns`: the backup (`<ns>wardrobe:v1`), `<ns>snap:*`, `<ns>render:*`, `<ns>job:*`, `<ns>jobfail:*`, `<ns>jobrun:*`; the owner's ns is the empty string, so the owner's key names are byte for byte what they were (`tests/accounts.test.js` asserts the exact names)
- keys that belong to nobody's namespace: `invite:<hash>`, `invites:index` (the list of invitations, so `GET /invites` reads one document instead of listing KV), `feedback:log`, and `use:<id>:<day>` (the count, only without the Durable Object)
- queue messages: `{key}` for the owner as before, `{key, ns}` for a tester (`jobMsg`); the consumer reads the ns with `msgNs` (a message without one is the owner's; one that is not `u:<id>:` is dropped untouched)
- `RenderHub` is one instance per person (`hubOf(env, ns)`: `renders` for the owner as before, `renders:u:<id>:` for a tester), so a held `/render-wait` can only be answered with the caller's own photos; `tellHub(env, ns, m)`
- `GET /render?list=1`, `/render-queue`, `/render-wait`, `/sync?snaps=1`, `?snap=` and roll back see only the caller's keys; a tester's `/render-queue` without `?keys=` answers empty rather than listing KV
- daily caps, testers only (`DEFAULT_CAPS` `{tag:40, pattern:10, photo:12, item:20}` per UTC day, `utcDay`; an invitation's own `caps` override them, `cleanCaps`): tag = `POST /` and `/tag-many`, pattern = `/pattern`, photo = outfit photos (direct, queued, `replace`), item = item pictures and one-piece edits (`photoCap`: a body with `swap`)
- over a cap: 429 `{error:'limit', what, cap, used, message, detail}`, the message a plain sentence ("Today’s limit of 12 outfit photos is used up. It starts again at midnight UTC.", `CAP_WORDS`); `detail` repeats it because the app's tagging errors show `detail`
- `spend(env, who, what)` counts before the AI call and answers null or `{status, body}`; `unspend` gives the count back when the call fails; a queued job remembers `cap` and `capDay` and `refundJob` gives it back when the consumer gives up, when `/render-queue` gives up on it, or when the photo was already there
- the counting is in the tester's `RenderHub` (`POST /use {what, n, cap, day}` → `{ok, used}`, kept in the object's storage as `use` = `{day, n:{…}}`; `GET /used?day=`): no KV write per AI call, since the free plan allows 1,000 KV writes and 1,000 lists a day for everyone together; without the `RENDER_HUB` binding `useCount` falls back to KV `use:<id>:<day>` with a 3-day TTL
- two more caps the app does not show protect KV's daily writes (`EXTRA_CAPS`): 60 photo uploads (`PUT /render`) and 20 feedback messages a day per tester
- a tester cannot choose `model`, `quality` or `complexity`: `handleRender` deletes them from the body before anything reads it, so a queued job keeps none either
- invitations, owner only (`handleInvites`): `POST /invites {name, caps?}` → `{id, code, name}`, the code 32 URL-safe characters from 24 random bytes, shown once, only its hash stored; `GET /invites` → `{invites:[{id, name, caps, created, off, used}], day}`; `DELETE /invites?id=` switches one off (`MAX_INVITES` 30 active)
- switching off: the tester's hub is told first (`POST /off`), so capped calls stop at once (`spend` answers 403); the `invite:` record is rewritten with `off:true`, which every other route sees as soon as KV shows it (up to a minute in another location)
- `GET /me` → `{id, name, role, caps, used, day}` (`handleMe`, `usedOf`; the owner: `caps` null and `used` all 0, the owner is not counted)
- `POST /feedback {text, version, where}` → `{ok:true}` (text 1–4,000 characters); `GET /feedback` (owner) → `{items:[{t, name, text, version, where}]}` newest first; one document `feedback:log`, messages older than 180 days dropped on every write and read, 500 at most, the key itself expiring 180 days after the last message
- `DELETE /account {confirm:'delete'}` → `{ok:true}` deletes only the caller's: a tester's `u:<id>:*` keys, their `invite:` record and line in `invites:index` (the code stops working), their feedback and their hub's storage; the owner's own families only (`OWNER_FAMILIES`: the backup, `snap:`, `render:`, `job:`, `jobfail:`, `jobrun:`), never `u:*`, `invite:*`, `invites:index` or `feedback:log`
- a Worker may make about 50 KV calls a request on the free plan, so `wipeSome(env, ns, budget)` deletes a part (30 calls in the request) and the queue finishes the rest a part per message (`{wipe:'owner'|'u:<id>:', n}`, `runWipe`); without the queue the answer carries `more:true` and the same call deletes the next part
- lists replaced by reads: `kvMeta(env, key)` reads a key's metadata with `getWithMetadata(key, {type:'stream'})` and never reads the value, so `syncVersion` (every sync) and `keepSnapshots` (every save) no longer list KV; a KV without `getWithMetadata` (the test mocks) lists as before; a queued photo's earlier `jobfail:` is deleted only when it is there (`dropFail`: a delete of nothing still counts as a write)
- `POST /` reads at most 15 MB of body and stops there (`TAG_LIMIT`, `readCapped`) → 413
- `/fetch` refuses anything but a public host (`publicHost`: no IP address in any spelling, no `localhost`, no single-label or `.local` / `.internal` / `.lan` / `.home` / `.corp` name), follows redirects by hand (5 at most) checking each stop, checks the page's share image the same way, and stops reading at its caps (15 MB photo, 600 kB page)
- `ALLOWED_ORIGIN` may be several origins separated by commas: the matching one is echoed in `Access-Control-Allow-Origin` (with `Vary: Origin`), any other origin gets 403
- KV budget with testers, for the record: a queued photo is about 6 KV writes (job, jobrun twice, the photo, two deletes), so a tester using every cap is about 200 writes a day; five such testers reach the free plan's 1,000; moving the job records into the Durable Object would be the next step
- not done here: `GET /render?list=1` is still one KV list per app start per person (a read cannot replace it without an index document that costs a write per photo)

### Testing

- `tests/accounts.test.js`: the owner and two testers against one mocked KV, queue and a Durable Object per name: isolation of sync, snapshots, photos, lists, queue and push; the owner's exact key names; caps (429, clear the next day by moving `Date.now`, refunds, KV fallback); invitations, revoking, `/me`, feedback, account deletion; the hardening; and the app (invitation link, Connection page, limit messages)
- existing tests that still pass unchanged show the owner's path is as it was (`queue`, `todayqueue`, `sync`, `snapshots`, `render`, `render-sync`, `prefetch`, `paste`, `tagging`, `multi`)
