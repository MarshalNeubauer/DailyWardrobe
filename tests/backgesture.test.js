// The phone's Back across every layer of the app, in Chromium and WebKit (tests/backgesture-parts.js holds the checks; this file:
// the tabs, and the pages and sheets with nothing of ours under them). backgesture-over and backgesture-item have the rest.
module.exports=async({ok,engines,url,WARDROBES,settle})=>require('./backgesture-parts').run(['tabs','alone'],{ok,engines,url,WARDROBES,settle});
