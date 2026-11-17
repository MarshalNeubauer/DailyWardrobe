// The phone's Back across every layer of the app, in Chromium and WebKit (tests/backgesture-parts.js holds the checks; this file:
// the layers over the item sheet, and the nested stacks closed one Back at a time).
module.exports=async({ok,engines,url,WARDROBES,settle})=>require('./backgesture-parts').run(['item','nested'],{ok,engines,url,WARDROBES,settle});
