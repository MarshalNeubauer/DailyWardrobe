// The load model and the load-failure contract (tests/modload-parts.js holds the checks; this file: the markup, the contract's static
// checks, the load model on both engines, and the survey's whole-page cases). tests/modload-404a.test.js and modload-404b.test.js
// 404 each page file, one half each (the notice board made clean, N7, 2026-11-28: one file's WebKit half took 825 s of its 900 s).
module.exports=async({ok,engines,url,settle})=>require('./modload-parts').run('main',{ok,engines,url,settle});
// the planner and the painter run as on a phone: the contract's 404 outcomes were measured with them
module.exports.realPlanner=true;
module.exports.assembled=true;
