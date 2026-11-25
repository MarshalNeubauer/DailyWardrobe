// The tests' access point to the page modules' names (T2, 2026-11-25; C:\code\cr-2026-11-16\T2-QUEUE.md). The only place it is written.
//
// The bridge (tests/bridge.test.js) puts a module's names on the page's global scope for the classic scripts and the tests. 474
// of them (2026-11-25) are there for the tests alone. Each module also puts those on HOOK, in one statement after its bridge
// (tests/modscope.js `hooked`):
//   globalThis.HOOK={__proto__:globalThis.HOOK||null, fnA, CONST_B, get flag(){return flag}, set flag(v){flag=v}};
// so HOOK is a chain of plain objects, one per module that loaded, and `HOOK.fnA` finds the name in whichever module has it. A test
// reaches those names through HOOK, and then they can come off the bridge (T2 phase 3) without the test changing again:
//   page.evaluate(()=>HOOK.cardSafe(c))           a function or a constant (the value the module handed over)
//   page.evaluate(()=>HOOK.shopBusy)              a `let`: its getter gives the module's value of the moment
//   page.evaluate(()=>{HOOK.shopBusy=false})      a `let` a test assigns: its setter reaches the module's own variable
//   page.evaluate('HOOK.figureStage()')           the same inside a string
//   'themeTap' in HOOK                            whether a module put the name there (it never throws)
// Always write it `HOOK.name` (no `const H=HOOK`): tests/bridge.test.js finds a test's uses of the access point by that spelling.
// The app never reads HOOK (tests/bridge.test.js fails if a page script, a worker, an inline script or lab/ does), so nothing a
// person sees depends on it, and a statement made of names already declared can't throw: a module that loads, or fails to, does
// exactly what it did before. It is no file and no request, so the service worker and a cold offline start are as they were, and
// it is outside the paint fingerprint (asmCmCodeSig hashes function texts; the statement is none of them).
//
// As strong as a bare name: a bare name a module doesn't give throws a ReferenceError, and so does HOOK.name here. In every page
// the test runner hands a test (tests/run.js adds `INIT` to every context) and in a vm context after `vmHook(ctx)`, the chain ends
// in a root that throws on a name no module put on HOOK (a typo, or the module failed to load), and on a write to one. Without it
// (a page opened some other way) HOOK still works, with `undefined` for a missing name, like the app's own (it ends in null).
//
//   INIT          the script that gives the page's HOOK its strict root: context.addInitScript(INIT) (tests/run.js does it)
//   vmHook(ctx)   the same in a vm context, before the app files run in it; then ctx.HOOK.name, as in the page
const vm=require('vm');

/* runs in the page (or the vm context): a strict root for the chain, set before any module adds its object to it */
function hookRoot(){
  if(globalThis.HOOK)return;
  const quiet=new Set(['then','toJSON','constructor','toString','valueOf','inspect','nodeType','$$typeof','asymmetricMatch']);
  const no=k=>new ReferenceError(`HOOK.${k}: no module put ${k} on HOOK (its file didn't load, or the name is spelled differently; tests/hook.js)`);
  Object.defineProperty(globalThis,'HOOK',{configurable:true,writable:true,value:new Proxy(Object.create(null),{
    get(t,k){if(typeof k!=='string'||quiet.has(k))return undefined;throw no(k)},
    set(t,k){throw no(String(k))},
    has(){return false}})});
}
const INIT='('+hookRoot+')();';
const vmHook=ctx=>{vm.runInContext(INIT,ctx);return ctx};
module.exports={INIT,vmHook};
