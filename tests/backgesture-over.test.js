// The phone's Back across every layer of the app, in Chromium and WebKit (tests/backgesture-parts.js holds the checks; this file:
// the layers over Settings and over Add, "Add without a photo" and a card being filled in).
module.exports=async({ok,engines,url,WARDROBES,settle})=>require('./backgesture-parts').run(['settings','add'],{ok,engines,url,WARDROBES,settle});
