/* the keys of the owner's own colours and patterns: ONE rule for the server, the same as the app's core.js OWN_COL_RE / OWN_PAT_RE
   (fix round 3, 2026-11-16: digits kept, a name in any script gets a short hash; keys stay ASCII). Used by the tagger's and describe's
   lists (tag.js, describe.js) and by the backup's record check (records.js); tests/w3ownnames.test.js checks app and server agree */
export const OWN_COL_RE = /^own[a-z0-9]{1,28}$/, OWN_PAT_RE = /^own-[a-z0-9-]{1,28}$/;
