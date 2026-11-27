/* Daily Wardrobe: dates in the app's language (appLocale, run at load, before anything draws a date)
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of settings.js on 2026-11-17.) */

/* dates in the app's language (audit 2026-11-15: an Arabic-language iPhone showed "الأحد، ١٥ نوفمبر" inside the English app): every
   toLocale…String(undefined, …) uses the phone's language when it is English, else American English (the app's language; Latin digits) */
const APP_LOC=/^en\b/i.test(navigator.language||'en')?navigator.language:'en-US';
function appLocale(){if(/** @type {any} */(Date.prototype)._dwLoc)return;for(const m of ['toLocaleDateString','toLocaleString','toLocaleTimeString']){const f=Date.prototype[m];
  Date.prototype[m]=function(loc,o){return f.call(this,loc===undefined||(Array.isArray(loc)&&!loc.length)?APP_LOC:loc,o)}}Object.defineProperty(Date.prototype,'_dwLoc',{value:true})}   // ([] too, "the browser's language", as sync-status.js's backup-pause times pass: CR-7-05)
appLocale();
globalThis.HOOK={__proto__:globalThis.HOOK||null,APP_LOC};
export {APP_LOC};
