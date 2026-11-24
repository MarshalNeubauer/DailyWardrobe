// classic, deferred: uses the modules' bridged names (label, cache, px) and a.js's
function show(){return label(1)+' '+px(2)+' '+bump()}
function reset(){cache={n:0};count=5}
// three mistakes on purpose: hidden is m.js's own (exported, not bridged)
function broken(){return hidden()}                               // 1: reported by ESLint and the type check
function guarded(){return typeof hidden==='function'?1:0}        // 2: a guard no-undef can't see: tests/bridge.test.js's check finds it
// 3: a wrong use of a bridged name's type (label gives a string): reported by the type check, which types it as m.js's export
function wrong(){return label(1).toFixed(2)}
