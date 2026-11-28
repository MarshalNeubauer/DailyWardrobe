// The load-failure survey, second half (tests/modload-parts.js PARTS '404b'): each page file of the second half of index.html's list
// can't be loaded (404), on Chromium and WebKit, and shows what tests/load-contract.json says, takes down just the files that import
// it, and never fails start-up. The other half: tests/modload-404a.test.js; the rest of the checks: tests/modload.test.js.
module.exports=async({ok,engines,url,settle})=>require('./modload-parts').run('404b',{ok,engines,url,settle});
// the planner and the painter run as on a phone: the contract's 404 outcomes were measured with them
module.exports.realPlanner=true;
module.exports.assembled=true;
