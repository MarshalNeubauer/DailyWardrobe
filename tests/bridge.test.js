// The bridge (the ES-module move, MODULES-PLAN.md "If the owner wants the full move anyway", step 3, 2026-11-23; the recipe for
// converting a file is C:\code\cr-2026-11-16\MODULES-RECIPE.md).
// A page script that becomes an ES module keeps its top-level names to itself. While other files, the tests' page.evaluate() and
// the checkers still use some of them as globals, the module hands those over at its end (tests/modscope.js reads the statements):
//   Object.assign(globalThis, {name, …})                                   a function or a constant
//   Object.defineProperties(globalThis, {name: {get: () => name}})           a `let` others only read: always the value of the moment
//   … {name: {get: () => name, set: v => {name = v}}}                        a `let` another file or a test assigns: the write
//                                                                            reaches the module's own variable
// BRIDGE below lists every bridged name, per file.
// - a bridged name that isn't listed fails: add the file's row in the pull request that converts the file, and say why each name
//   is still needed (who reads it);
// - a listed name that is no longer bridged fails until it is taken off: after a file's conversion its row only shrinks, down to
//   nothing when every reader imports the name and no test assigns it. The bridge is temporary;
// - a row that origin/main already has may not gain a name (compared with main's copy of this file through git): only the pull
//   request that converts a file writes its row. A name a later change really has to add goes in GROWN too, with the reason.
// And the mistakes that would otherwise show only as a blank page or a silent `undefined` (Node only, a few seconds):
// - a file uses, as a global, a name that a module declares and doesn't bridge (`typeof name==='function'` guards too, which
//   ESLint's no-undef can't see in a classic script): import it or bridge it;
// - a module's tag without an import or export in its text (TypeScript and tests/appsrc.js go by the text: `export {}` will do);
// - a bridge statement the checkers can't read (a spread, a computed key), a name bridged twice, or one a classic script also
//   declares at its top level (the classic `let` would hide the bridged value);
// - a `let` handed over with Object.assign (the global would keep the value it had at that moment), an accessor that isn't plainly
//   `get: () => name` on the file's own `let` of that name, or a setter that assigns another name;
// - a write nobody would see: another page script, a test or a tool assigns a bridged name (`name = …`, `name++`, `window.name = …`)
//   that has a getter and no setter (the assignment does nothing, or throws in strict code), or that was handed over with
//   Object.assign (the global is replaced and the module goes on using its own: a test's stub of a function never runs for the
//   module's own calls);
// - an import that isn't a plain relative path to a page script that is itself a module with its own tag in index.html (the tag
//   is what fetches it in parallel on iOS 16.4, which has no modulepreload, and what puts it in every checker's list), or one
//   under another name, a default or a namespace import (tests/appsrc.js can't run those for the Node tests);
// - a Web Worker that importScripts a module (`export` is a syntax error there: the worker and its files move together);
// - a module missing from sw.js ASSETS under the exact spelling of its tag and of every import of it (a cold offline start with one
//   module missing fails the whole graph).
// Not checked here: that a bridged name is still needed by someone (a test's page.evaluate may be its only reader); that comes
// with the bridge's removal (step 5). A write inside a string handed to page.evaluate('…') isn't seen either.
// The tests' access point, HOOK (T2, 2026-11-25; tests/hook.js): each module puts the names only the tests use on HOOK too, so the
// tests can stop using them as globals and those names can come off the bridge. Checked here: each HOOK statement (one per module,
// names of its own, a `let` behind a getter, a setter for what a test assigns), every name only the tests use is on HOOK, every
// HOOK.name a test uses is there, the app never reads HOOK. The tests' uses (testUses) count strings too: the code inside a string
// (page.evaluate('…'), a SETUP template), and a sentence's words (safe side; not an ok() message). `--hook` lists the names the
// tests use through HOOK alone (they can come off BRIDGE) and the files still using the rest as globals; `--to-hook <file>` rewrites one.
// Since S6t0 (2026-11-27) every bridged name a test reads is on its owner's HOOK too, `--to-hook` rewrites those reads as well, and
// `--reads` lists the reads left per file; the check that fails on one (BARE_READS_CHECK) is switched on by the last group, S6t4.
const fs=require('fs'),path=require('path');
const acorn=require('acorn'),escope=require('eslint-scope');
const modscope=require('./modscope');

/* file -> the names it bridges onto globalThis. Rows are added by the pull request that converts the file; after that they only shrink.
   T2 phase 3 (2026-11-25) took off the 468 names the tests alone used, through HOOK alone. The restructure S6f (2026-11-27, the owner's
   full teardown) took off the rest: every page file reads what it uses with import, or through a bus.js announcement or socket, and the
   tests through HOOK. What a module still puts on globalThis is the documented set below (GLOBALS): start.js's startUp alone. */
const BRIDGE={
  'bus.js':[],
  'core.js':[],
  'planner.js':[],
  'analysis.js':[],
  'detect.js':[],
  'srgb.js':[],
  'who.js':[],
  'photo-keys.js':[],
  'tag-request.js':[],
  'app.js':[],
  'back.js':[],
  'act.js':[],
  'days.js':[],
  'today-plan.js':[],
  'locks.js':[],
  'toast.js':[],
  'ui.js':[],
  'measure.js':[],
  'add-ids.js':[],
  'pattern-read.js':[],
  'look-base.js':[],
  'tagging.js':[],
  'pickscore.js':[],
  'asm-keys.js':[],
  'assemble.js':[],
  'asm-watch.js':[],
  'asm-pocket.js':[],
  'asm-color.js':[],
  'asm-gl.js':[],
  'asm-kinds.js':[],
  'mannequin.js':[],
  'mq/vest.js':[],
  'mq/suit.js':[],
  'mq/suit-open.js':[],
  'mq/shirt-tie.js':[],
  'mq/shirt-open.js':[],
  'draw.js':[],
  'asm-ocp.js':[],
  'asm-look.js':[],
  'asm-cm-job.js':[],
  'asm-today.js':[],
  'asm-cm-page.js':[],
  'nav.js':[],
  'fields.js':[],
  'checklist.js':[],
  'photos.js':[],
  'month.js':[],
  'missed.js':[],
  'history.js':[],
  'scorecard.js':[],
  'today-photofold.js':[],
  'today-picture.js':[],
  'today.js':[],
  'today-gestures.js':[],
  'locale.js':[],
  'settings.js':[],
  'daysoff.js':[],
  'weather.js':[],
  'theme.js':[],
  'start.js':['startUp'],
  'safety.js':[],
  'dress.js':[],
  'add-keep.js':[],
  'own-lists.js':[],
  'colpick.js':[],
  'add-more.js':[],
  'add-save.js':[],
  'add-card.js':[],
  'add-sheet.js':[],
  'add.js':[],
  'add-paste.js':[],
  'look.js':[],
  'migrate.js':[],
  'stats.js':[],
  'fav.js':[],
  'pack.js':[],
  'item-photo.js':[],
  'item-view.js':[],
  'wardrobe.js':[],
  'care.js':[],
  'cost.js':[],
  'itemsheet.js':[],
  'shop.js':[],
  'sync.js':[],
  'sync-status.js':[],
  'sync-photos.js':[],
  'snapshots.js':[],
  'backupfile.js':[],
  'account.js':[],
  'kit.js':[],
  'setup.js':[],
  'calendar.js':[],
  'remind.js':[],
  'about.js':[],
};
/* file -> names its row gained after its conversion (each with the reason beside it); every one is in BRIDGE too */
const GROWN={};   // (emptied by the restructure S6f with the rows: nothing is bridged but the documented set)
const WORKERS=['asm-worker.js','analysis-worker.js'];
let PLATFORM=null;
const platform=()=>{if(!PLATFORM){PLATFORM=new Set();try{const g=require('globals');for(const n of Object.keys({...g.browser,...g.worker}))PLATFORM.add(n)}catch(e){}}return PLATFORM};

/* the Node files whose functions run in the page (page.evaluate): tests/ (not the fixtures, not the old builds) and tools/ */
function nodeFiles(ROOT){
  const out=[],walk=d=>{let l=[];try{l=fs.readdirSync(path.join(ROOT,d),{withFileTypes:true})}catch(e){}
    for(const e of l){const f=d+'/'+e.name;
      if(e.isDirectory()){if(f!=='tests/fixtures'&&f!=='tests/replay/.work'&&e.name!=='node_modules')walk(f)}
      else if(e.name.endsWith('.js'))out.push(f)}};
  walk('tests');walk('tools');return out;
}
/* the names a file assigns without declaring them (`name = …`, `name++`, destructuring), and `window.name = …`: Map name -> count */
function writesOf(src,module){
  let ast;const opt={ecmaVersion:'latest',ranges:true,allowReturnOutsideFunction:!module,allowHashBang:true};
  try{ast=acorn.parse(src,{...opt,sourceType:module?'module':'script'})}catch(e){try{ast=acorn.parse(src,{...opt,sourceType:'module',allowReturnOutsideFunction:false});module=true}catch(e2){return null}}
  const out=new Map(),add=n=>out.set(n,(out.get(n)||0)+1);
  const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:module?'module':'script'}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
  // (r.init: a declaration's own initializer, which escope leaves unresolved in a function that has a direct eval: tests/sample.test.js's
  // `const key=` sat beside an eval(pd) and read as a write of core.js's key)
  for(const r of g.through)if(r.isWrite()&&!r.init&&!own.has(r.identifier.name))add(r.identifier.name);
  for(const m of src.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/g))add(m[1]);
  return out;
}

/* the names a text uses without declaring them (reads, calls, typeof guards, writes), or null when it doesn't parse */
function freeNames(src,module){
  let ast;const o={ecmaVersion:'latest',ranges:true,allowReturnOutsideFunction:!module,allowHashBang:true};
  try{ast=acorn.parse(src,{...o,sourceType:module?'module':'script'})}catch(e){try{ast=acorn.parse(src,{...o,sourceType:'module',allowReturnOutsideFunction:false});module=true}catch(e2){return null}}
  const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:module?'module':'script'}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
  return [...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n));
}
const ON_GLOBAL=/\b(?:window|self|globalThis)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\])/g;
const VIA_HOOK=/\bHOOK\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\])/g;
const IN_HOOK=/['"]([A-Za-z_$][\w$]*)['"]\s+in\s+HOOK\b(?!\s*[.[])/g;   // (not `'k' in HOOK.items[0]`)
const ASSIGN_AFTER=/^\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/;   // (what follows window.name when it is assigned)
const HOOK_WRITE=/\bHOOK\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\])\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/g;
/* T2 phase 3 (2026-11-25): strings that are not code though they parse as code: a file name ('shop.js' is `shop.js`), a host name
   ('shop.test'), an id or key ('rd-camo' is `rd - camo`; a whole string of words joined by hyphens, no space); and in a string that
   doesn't parse, what is markup or data: an attribute selector's value (`[data-act="setOpenTap"]`), a tab-separated record (a
   tests/impact.map line). None of them is a use of a page name, and the rewrite leaves them alone. */
const FILE_NAME=/^[\w$.\/*-]*\.(?:m?js|cjs|html?|css|json|png|jpe?g|webp|gif|svg|ico|txt|md|csv|ics|webmanifest|wasm|ya?ml|toml|ps1|sh)$/i;
const HOST_NAME=/^(?:[\w-]+\.)+(?:test|localhost|invalid|example|com|org|net)(?::\d+)?$/i;
const ID_LIKE=/^[\w$]+(?:-[\w$]+)+$/;
const CLI_FLAG=/^--[A-Za-z][\w-]*(?:=\S*)?$/;   // (a command-line flag: '--show' parses as a decrement of show, '--save-times' as save less times; S1a)
const notCode=t=>FILE_NAME.test(t)||HOST_NAME.test(t)||ID_LIKE.test(t)||CLI_FLAG.test(t);
const ATTR_SEL=/\[\s*[\w-]+\s*[~|^$*]?=\s*(?:"[^"]*"|'[^']*'|[^\]\s]*)\s*\]/g;
const markup=t=>/\t/.test(t)?'':t.replace(ATTR_SEL,s=>' '.repeat(s.length));   // (a non-code string's words, the markup and data blanked)
/* S1f (2026-11-25): two more kinds of string that parse as code and are not: a string searched for in another (the first argument
   of includes, indexOf, lastIndexOf, startsWith, endsWith: tests/motif.test.js's `m.def.includes(\`fill="${…}"\`)`, SVG markup, read
   as an assignment of fill), and a call's label: a string that is one call (`'loadSnapshots()'`, `'findCity()'`: what a wrapper
   records, tests/actsindex.test.js `step(what, act, 'findCity()')`) handed straight to a helper of the file (a plain name called)
   that is not inside a call that runs code (page.evaluate, addInitScript, waitForFunction, vm's runIn…Context, Function, eval). A
   one-call string anywhere else is code as before: `p.evaluate('rd()')`, and one kept in a list or a variable to be run later
   (tests/folds.test.js `[['score','toggleScore()','#sbox']]`, tools/cssdiff.js's screens). */
const SEARCHED=new Set(['includes','indexOf','lastIndexOf','startsWith','endsWith']);
const RUNS_CODE=new Set(['evaluate','evaluateHandle','$eval','$$eval','addInitScript','waitForFunction','runInContext','runInNewContext','runInThisContext','Script','Function','eval','compileFunction']);
const CALL_LABEL=/^\s*[A-Za-z_$][\w$]*\((?:[^()'"`]|'[^']*'|"[^"]*")*\)\s*$/;
const calleeName=c=>c.type==='Identifier'?c.name:c.type==='MemberExpression'&&!c.computed&&c.property.type==='Identifier'?c.property.name:null;
/* S6t0 (2026-11-27): code a test hands to Node's vm (vm.runInContext('planFor(d)', ctx), new vm.Script(…)) runs in a context where the
   app files ran as classic scripts (tests/appsrc.js): their names are that context's own, with no bridge involved, so it is no use of
   a bridged name and the rewrite leaves it, as a string joined after appSrc(…) */
const VM_RUN=new Set(['runInContext','runInNewContext','runInThisContext','Script','compileFunction']);
const vmArgs=n=>(n.type==='CallExpression'||n.type==='NewExpression')&&n.callee&&VM_RUN.has(calleeName(n.callee))?n.arguments:null;
/* S6t0: the names the platform gives (the browser's, a worker's, Node's, the language's): a bare one in a test is the platform's own
   (`open`, `name`, `status`, `fetch`), never rewritten to HOOK even if a page module ever bridges the same name */
let PLATFORM_ALL=null;
const platformAll=()=>{if(!PLATFORM_ALL){PLATFORM_ALL=new Set();try{const g=require('globals');for(const k of ['browser','worker','node','builtin','nodeBuiltin','commonjs'])for(const n of Object.keys(g[k]||{}))PLATFORM_ALL.add(n)}catch(e){}}return PLATFORM_ALL};
/* the string nodes of a parsed file that are not code by those two rules (searched for, or a call's label outside code) */
function notCodeStrings(ast){const out=new Set();
  const str=n=>n&&(n.type==='Literal'&&typeof n.value==='string'||n.type==='TemplateLiteral');
  const walk=(n,ev)=>{if(!n||typeof n.type!=='string')return;
    // (S6t0: a string compared with another is data, an expected value: `hits.join()==='c.key,esc(k)'`)
    if(n.type==='BinaryExpression'&&/^[!=]==?$/.test(n.operator))for(const s of [n.left,n.right])if(str(s))out.add(s);
    if((n.type==='CallExpression'||n.type==='NewExpression')&&n.callee){const c=calleeName(n.callee);
      if(n.callee.type==='MemberExpression'&&SEARCHED.has(c)&&str(n.arguments[0]))out.add(n.arguments[0]);
      if(RUNS_CODE.has(c))ev=true;
      else if(!ev&&n.callee.type==='Identifier')for(const a of n.arguments)if(a.type==='Literal'&&typeof a.value==='string'&&CALL_LABEL.test(a.value))out.add(a)}
    for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(x=>walk(x,ev));else if(v&&typeof v.type==='string')walk(v,ev)}};
  walk(ast,false);return out}
/* S6t0 (2026-11-27): the string nodes that may be a piece of code that doesn't parse alone: inside what is handed to a call that runs
   code (page.evaluate('a('+b+')'), addInitScript, waitForFunction …), joined with `+` or not. A string that doesn't parse anywhere else
   is words (a log line, a message, a key, markup), not code: no use of a page name, and nothing for a person to reword */
function joinedStrings(ast){const out=new Set();
  const str=n=>n&&(n.type==='Literal'&&typeof n.value==='string'||n.type==='TemplateLiteral');
  const walk=(n,ev)=>{if(!n||typeof n.type!=='string')return;
    if(ev&&str(n))out.add(n);
    if((n.type==='CallExpression'||n.type==='NewExpression')&&n.callee&&RUNS_CODE.has(calleeName(n.callee))){walk(n.callee,ev);for(const a of n.arguments)walk(a,true);return}
    if(ev&&/Function/.test(n.type))ev=false;   // (a function handed to the page is code of the file itself)
    for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(x=>walk(x,ev));else if(v&&typeof v.type==='string')walk(v,ev)}};
  walk(ast,false);return out}
/* A test's or tool's uses of page names (T2, 2026-11-25): {global: Set (bare or on window/self/globalThis), hook: Set (`HOOK.name`),
   globalWrites: Set, hookWrites: Set}. Its code (the functions handed to page.evaluate are code like any other) and the code inside
   its strings (page.evaluate('…'), addInitScript, a SETUP template: a string is parsed as JS, a template with each ${…} as 0; one that
   doesn't parse is read word by word, a word after a dot left out, so a name in an ok() message counts too: the safe side). Not a
   string joined after appSrc(…)/asScript(…): the vm tests run that in the files' own scope, where no bridge is involved. */
function testUses(src,words){
  const out={global:new Set(),hook:new Set(),globalWrites:new Set(),hookWrites:new Set()};
  const take=(text,code,joined=true)=>{if(!code&&/^\s*[A-Za-z_$][\w$]*\s*$/.test(text))return;   // (one word alone is a key: metaGet('shop'); no test evaluates one)
    const f=freeNames(text,false);
    if(f){for(const n of f)if(words.has(n))out.global.add(n);for(const [n] of writesOf(text,false)||[])if(words.has(n))out.globalWrites.add(n)}
    else if(!code&&joined)for(const m of markup(text).matchAll(/(?<![\w$.#-])[A-Za-z_$][\w$]*(?![\w$-])/g))if(words.has(m[0]))out.global.add(m[0]);   // (not a CSS name: #shop-btn)
    for(const m of text.matchAll(ON_GLOBAL))if(words.has(m[1]||m[2]))out.global.add(m[1]||m[2])};
  take(src,true);
  let ast=null,cm=[];const o={ecmaVersion:'latest',ranges:true,allowHashBang:true,onComment:(b,t,a,z)=>cm.push([a,z])};
  try{ast=acorn.parse(src,{...o,sourceType:'script',allowReturnOutsideFunction:true})}catch(e){cm=[];try{ast=acorn.parse(src,{...o,sourceType:'module'})}catch(e2){cm=[]}}
  let code=src;for(const [a,z] of cm)code=code.slice(0,a)+code.slice(a,z).replace(/[^\r\n]/g,' ')+code.slice(z);   // (HOOK.name in a comment is no use)
  for(const m of code.matchAll(VIA_HOOK))out.hook.add(m[1]||m[2]);
  for(const m of code.matchAll(IN_HOOK))out.hook.add(m[1]);   // (S6t3: `'name' in HOOK`, what --to-hook asks for a typeof, uses the name too)
  for(const m of code.matchAll(HOOK_WRITE))out.hookWrites.add(m[1]||m[2]);
  if(!ast)return out;
  const lexical=new Set(),strs=[];
  const left=e=>{while(e&&e.type==='BinaryExpression'&&e.operator==='+')e=e.left;return e};
  const prose=n=>{if(!n||typeof n.type!=='string')return;if(n.type==='Literal'||n.type==='TemplateQuasi'||n.type==='TemplateLiteral')lexical.add(n);
    for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(prose);else if(v&&typeof v.type==='string')prose(v)}};
  const walk=n=>{if(!n||typeof n.type!=='string')return;
    // (an ok() message is words for a person: tests/run.js ok(cond, message))
    if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='ok'&&n.arguments[1])prose(n.arguments[1]);
    {const va=vmArgs(n);if(va)va.forEach(prose)}   // (code run in a vm context: the files' own scope, S6t0)
    if(n.type==='BinaryExpression'&&n.operator==='+'){const l=left(n);
      if(l&&l.type==='CallExpression'&&l.callee.type==='Identifier'&&/^(?:appSrc|asScript)$/.test(l.callee.name)){let e=n;while(e.type==='BinaryExpression'&&e.operator==='+'){lexical.add(e.right);e=e.left}}}
    if(n.type==='Literal'&&typeof n.value==='string')strs.push([n,n.value]);
    else if(n.type==='TemplateLiteral')strs.push([n,n.quasis.map(q=>q.value.cooked==null?q.value.raw:q.value.cooked).join('0')]);
    for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v)}};
  walk(ast);
  for(const n of notCodeStrings(ast))lexical.add(n);
  const J=joinedStrings(ast);
  for(const [n,text] of strs){if(lexical.has(n)||text.length<2||notCode(text))continue;
    let any=false;for(const m of text.matchAll(/[A-Za-z_$][\w$]*/g))if(words.has(m[0])){any=true;break}
    if(any)take(text,false,J.has(n))}
  return out;
}
/* T2 phase 2's rewrite of one test or tool file: each global use of a name in `names` (a bare name, `window.name`, in the code and in
   the code of its strings, as testUses reads them) becomes `HOOK.name` (`{name}` becomes `{name:HOOK.name}`). {out, n (uses
   rewritten), manual: [text]}: what it leaves for a person: a `typeof name` (HOOK.name throws for a missing name in a test's page;
   write `'name' in HOOK`), a string with an escape in it, a string that isn't code (a sentence: reword it, or leave it, the name then
   stays on BRIDGE). `node tests/bridge.test.js --to-hook <file> [--write]` runs it with the names only the tests use. */
function toHook(src,names,writes=new Set(),noSet=new Set()){
  {const P=platformAll();if([...names].some(n=>P.has(n)))names=new Set([...names].filter(n=>!P.has(n)))}   // (the platform's own names stay bare, S6t0)
  const edits=[],manual=[],any=w=>names.has(w)||writes.has(w)||noSet.has(w);
  const line=at=>src.slice(0,at).split('\n').length;
  const code=(text,base,top)=>{let ast;const o={ecmaVersion:'latest',ranges:true,allowHashBang:true};
    try{ast=acorn.parse(text,{...o,sourceType:'script',allowReturnOutsideFunction:true})}catch(e){try{ast=acorn.parse(text,{...o,sourceType:'module'})}catch(e2){return null}}
    const short=new Set(),tyof=new Set(),strs=[],skip=new Set();
    const mark=n=>{if(!n||typeof n.type!=='string')return;if(n.type==='Literal'||n.type==='TemplateLiteral')skip.add(n);for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(mark);else if(v&&typeof v.type==='string')mark(v)}};
    const walk=n=>{if(!n||typeof n.type!=='string')return;
      if(n.type==='Property'&&n.shorthand&&n.value.type==='Identifier')short.add(n.value);
      if(n.type==='Property'&&n.shorthand&&n.value.type==='AssignmentPattern'&&n.value.left.type==='Identifier')short.add(n.value.left);   // ({x=1}=o)
      if(n.type==='UnaryExpression'&&n.operator==='typeof'&&n.argument.type==='Identifier')tyof.add(n.argument);
      if(top&&n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='ok'&&n.arguments[1])mark(n.arguments[1]);
      if(top){const va=vmArgs(n);if(va)va.forEach(mark)}   // (code run in a vm context: the files' own scope, S6t0)
      if(top&&n.type==='BinaryExpression'&&n.operator==='+'){let l=n;while(l.type==='BinaryExpression'&&l.operator==='+')l=l.left;
        if(l.type==='CallExpression'&&l.callee.type==='Identifier'&&/^(?:appSrc|asScript)$/.test(l.callee.name)){let e=n;while(e.type==='BinaryExpression'&&e.operator==='+'){mark(e.right);e=e.left}}}
      if(top&&(n.type==='Literal'&&typeof n.value==='string'||n.type==='TemplateLiteral'))strs.push(n);
      for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v)}};
    walk(ast);
    if(top)for(const n of notCodeStrings(ast))mark(n);
    const joined=top?joinedStrings(ast):null;
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:ast.sourceType}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
    for(const r of g.through){const id=r.identifier,n=id.name;if(own.has(n))continue;
      // (a name the tests assign, S1a: only where it is assigned, `x=`, `x+=`, `x++`, a destructuring target; a read, `x.y=` and `x[k]=`
      // (a change to the object, not the name) stay as they are)
      if(!names.has(n)){if(!r.isWrite()||r.init)continue;
        if(noSet.has(n)){manual.push(`line ${line(base+id.range[0])}: assigns ${n}, which has no HOOK setter (not a \`let\`: replace the function another way)`);continue}
        if(!writes.has(n))continue}
      if(tyof.has(id)){manual.push(`line ${line(base+id.range[0])}: typeof ${n} (write '${n}' in HOOK, or HOOK.${n} where it must be there)`);continue}
      edits.push([base+id.range[0],base+id.range[1],short.has(id)?`${n}:HOOK.${n}`:`HOOK.${n}`])}
    for(const m of text.matchAll(/\b(?:window|self|globalThis)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])/g)){const n=m[1]||m[3];
      const set=()=>ASSIGN_AFTER.test(text.slice(m.index+m[0].length));
      if(names.has(n)||writes.has(n)&&set())edits.push([base+m.index,base+m.index+m[0].length,`HOOK.${n}`]);
      else if(noSet.has(n)&&set())manual.push(`line ${line(base+m.index)}: assigns ${m[0]}, which has no HOOK setter (not a \`let\`: replace the function another way)`)}
    return {strs,skip,joined}};
  const t=code(src,0,true);if(!t)return {out:src,n:0,manual:['the file does not parse']};
  for(const s of t.strs){if(t.skip.has(s))continue;let text,base;
    const words=s.type==='Literal'?s.value:s.quasis.map(q=>q.value.cooked==null?q.value.raw:q.value.cooked).join('0');
    if(!t.joined.has(s)&&freeNames(words,false)==null)continue;   // (words, not code: neither joined to code nor handed to the page, S6t0)
    if(s.type==='Literal'){const raw=src.slice(s.range[0]+1,s.range[1]-1);if(!/[A-Za-z_$]/.test(raw))continue;
      let hit=false;for(const m of raw.matchAll(/[A-Za-z_$][\w$]*/g))if(any(m[0])){hit=true;break}if(!hit)continue;
      if(raw!==s.value&&/\t/.test(s.value)&&freeNames(s.value,false)==null)continue;   // (a tab-separated record: data)
      if(raw!==s.value){const u=[...raw.matchAll(/[A-Za-z_$][\w$]*/g)].map(m=>m[0]).filter(w=>names.has(w)),wr=[...(writesOf(s.value,false)||[]).keys()].filter(w=>writes.has(w)||noSet.has(w));
        if(u.length||wr.length)manual.push(`line ${line(s.range[0])}: a string with an escape in it `+(u.length?`uses ${u.join(', ')}`:`assigns ${wr.join(', ')}`));continue}
      if(/^\s*[A-Za-z_$][\w$]*\s*$/.test(raw)||notCode(raw))continue;
      text=raw;base=s.range[0]+1}
    else{const a=s.range[0]+1,b=s.range[1]-1,q=s.quasis;text=src.slice(a,b);
      for(let i=0;i+1<q.length;i++){const x=q[i].range[1]-a,y=q[i+1].range[0]-a;text=text.slice(0,x)+'0'.padEnd(y-x,' ')+text.slice(y)}   // (each ${…} a 0, the same length)
      let hit=false;for(const m of text.matchAll(/[A-Za-z_$][\w$]*/g))if(any(m[0])){hit=true;break}if(!hit||notCode(text))continue;
      base=a}
    if(!code(text,base,false)){const w=[...new Set([...markup(text).matchAll(/(?<![\w$.#-])[A-Za-z_$][\w$]*(?![\w$-])/g)].map(m=>m[0]).filter(x=>names.has(x)))];
      if(w.length)manual.push(`line ${line(s.range[0])}: a string that isn't code uses ${w.join(', ')} (reword it if it is a sentence)`)}}
  edits.sort((x,y)=>y[0]-x[0]);let out=src,last=Infinity,n=0;
  for(const [a,b,r] of edits){if(b>last)continue;out=out.slice(0,a)+r+out.slice(b);last=a;n++}
  return {out,n,manual};
}
/* T2 (2026-11-25): who uses each bridged name.{name: {file, app: [files], tests: [files], hook: [files], testWrites: [files],
   hookWrites: [files]}}. The app: the page scripts but the name's own file, index.html's inline scripts, the Web Workers' own files
   and lab/ (a read, a call, a typeof guard, a write, `window.name`). The tests: tests/ and tools/ (testUses). A name the app doesn't
   use and the tests use only through HOOK can come off BRIDGE (T2 phase 3); one the tests still use as a global can't yet. */
function readers(ROOT,m){
  m=m||measure(ROOT);const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),owner=new Map(),out={},viaHook={},hookWrites={};
  for(const [f,l] of Object.entries(m.bridge))for(const n of l){owner.set(n,f);out[n]={file:f,app:[],tests:[],hook:[],testWrites:[],hookWrites:[]}}
  /* the restructure S6f: with the bridge down, every name a module exports (a test can reach it only through HOOK) */
  for(const [f,l] of Object.entries(m.exported||{}))for(const n of l)if(!owner.has(n)){owner.set(n,f);out[n]={file:f,app:[],tests:[],hook:[],testWrites:[],hookWrites:[]}}
  const words=new Set(owner.keys());
  const app=(f,src,module)=>{const s=new Set(freeNames(src,module)||[]);for(const x of src.matchAll(ON_GLOBAL))s.add(x[1]||x[2]);
    for(const n of s)if(words.has(n)&&owner.get(n)!==f)out[n].app.push(f)};
  const tags=modscope.pageScripts(ROOT);
  for(const t of tags)app(t.src,rd(t.src),t.module);
  const html=rd('index.html');let i=0;
  for(const x of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))app('index.html (inline script '+(++i)+')',x[1],false);
  for(const w of [...WORKERS,'cal-worker.js'])if(fs.existsSync(path.join(ROOT,w)))app(w,rd(w),true);
  let lab=[];try{lab=fs.readdirSync(path.join(ROOT,'lab'))}catch(e){}
  for(const f of lab){const p='lab/'+f;
    if(f.endsWith('.js'))app(p,rd(p),false);
    else if(f.endsWith('.html')){let j=0;for(const x of rd(p).matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))app(p+' (inline script '+(++j)+')',x[1],false)}}
  for(const f of nodeFiles(ROOT)){if(f==='tests/bridge.test.js'||f==='tests/hook.js')continue;   // (its rows name every bridged name as a string; the access point's own root)
    const u=testUses(rd(f),words);
    for(const n of u.global)out[n].tests.push(f);
    for(const n of u.globalWrites)out[n].testWrites.push(f);
    for(const n of u.hook){if(out[n])out[n].hook.push(f);(viaHook[n]=viaHook[n]||[]).push(f)}
    for(const n of u.hookWrites){if(out[n])out[n].hookWrites.push(f);(hookWrites[n]=hookWrites[n]||[]).push(f)}}
  Object.defineProperties(out,{viaHook:{value:viaHook},hookWrites:{value:hookWrites}});   // (every name a test reads or writes as HOOK.name, bridged or not)
  return out;
}
/* S1a (2026-11-25): the bridged names --to-hook rewrites where a test assigns them: {writes: those a module puts on HOOK with a setter,
   noSet: those a test assigns that have none (a function: the rewrite names them for a person)} */
function writeSets(r,hk){const writes=new Set(),noSet=new Set();
  for(const l of Object.values(hk.hooked))for(const [n,x] of l)if(x.set&&r[n]&&!OLD_BUILD.has(n))writes.add(n);
  for(const n of Object.keys(r))if(r[n].testWrites.length&&!writes.has(n)&&!OLD_BUILD.has(n))noSet.add(n);
  /* S6t0 (2026-11-27): and every bridged name a test reads as a global whose owner puts it on HOOK (a function or a constant as
     itself, a `let` behind a getter, which reads the module's variable of the moment), not only the names the tests alone use, so
     no test reads the bridge and it can come down (restructure step 6). The platform's names stay bare (toHook) */
  const P=platformAll(),names=new Set(hk.testOnly.filter(n=>!OLD_BUILD.has(n)));
  for(const l of Object.values(hk.hooked))for(const [n] of l)if(r[n]&&r[n].tests.length&&!OLD_BUILD.has(n)&&!P.has(n))names.add(n);
  return {names,writes,noSet}}
/* S6t0: per test or tool file, the bridged names it still reads as globals (bare, window.name, in its code or the code of its strings;
   a word of a sentence counts, the safe side: reword it). Allowed: the names a test also uses on an older build, which has no HOOK,
   in the files that run one (READS_KEPT), and the platform's own names. {file: [names]} */
function bareReads(r,allowed=READS_KEPT){const P=platformAll(),out={};
  for(const [n,x] of Object.entries(r))if(!P.has(n))for(const f of x.tests)if(!(allowed[f]||[]).includes(n))(out[f]=out[f]||[]).push(n);
  for(const l of Object.values(out))l.sort();
  return out}
/* S6t0: the check that no test reads a bridged name as a global. Off until the last of the four groups (S6t4, C:\code\cr-2026-11-16\
   STEP6T.md) has rewritten its files: S6t4 sets it to true, and from then on a bare read of a bridged name fails like a write (S1f) */
const BARE_READS_CHECK=true;   // (switched on by the restructure S6f, with the bridge down)
/* the files that read a bridged name on an older build (tests/replay R.old(sha), which has no HOOK), and the names: they stay bare
   there. The groups fill this in for the uses that really run on an old build; every other use is rewritten */
const READS_KEPT={
  // S6t1: phones A and B run the app of 40dbc2c (module bridge, no HOOK) to connect the calendar; C runs today's through HOOK
  'tests/replay/scripts/CR-6-20.js':['openSettings','settings'],
  // S6t1: buildLegacy's phone runs c4a549b (classic scripts, no HOOK) until the update; openItemByName runs only there
  'tests/replay/scripts/_verify3-lib.js':['items','kitEdited','settings'],
  'tests/garmentpaint.test.js':['ASM_CM_BTN','ASM_CM_KINDS','SLOTS','asmCmCodeSig','asmCmMf','asmCmSig','asmCmSrcSig','dayClimate','dayRecs','di',
    'hasVest','inRotation','isWorkday','items','key','occOf','settings','todayDate'],   // S6t2: the page of #511's base (before HOOK) gets a HOOK of its own from its globals, for keysOf and the fixed plan
  'tests/replay/scripts/W1-1-02.js':['appVersion'],   // S6t2: the first open after the update runs the old cached app (12 Nov, no HOOK)
  'tests/replay/scripts/lib-verify1.js':['items'],   // S6t2: buildOld counts the pieces on the old build (26cd8b1, no HOOK)
  'tools/fill-material.js':['itemFields'],   // S6t2: not the page's: the string handed to Function declares itemFields (core.js's text) and returns it
  /* S6t3: its old phone runs 26cd8b1, 7a28f96 and c4a549b (RP.old), which have no HOOK; today's phone reads them through HOOK */
  'tests/replay/scripts/CR-6-12.js':['items','syncNow','syncRun'],
  /* S6t4: phone P runs the 15 Nov c4a549b app (no HOOK) and Q today's: sync() and rules() read HOOK when the page has one, else
     these globals; P's Add steps and setLaundry run on the old app alone */
  'tests/replay/scripts/W1-4-01.js':['PLAN_RULES','items','metaGet','openSettings','queue','settings','syncNow','syncRun','syncing'],
  /* S6t4: oldAddCards runs on the 14 Nov 7a28f96 app (no HOOK); reopenNew reads PLAN_RULES bare only while the page is still that app */
  'tests/replay/scripts/_verify2-lib.js':['PLAN_RULES','items','queue','settings'],
  /* S6t4: the 14 Nov import's result is read on that app (7a28f96, no HOOK), before the update */
  'tests/replay/scripts/W1-2-01.js':['items'],
  /* S6t4: origin/main's draw.js run in a scope of its own (new Function): the two names are that source's own declarations, not the page's */
  'tests/garmentdraw.test.js':['itemThumb','swatchSVG'],
};
/* the names a test also uses on an older build, which has no HOOK (T2 phase 3): they stay globals there, so --to-hook leaves them */
const OLD_BUILD=new Set(['syncing','kitEdited','asmCmMf','asmCmCodeSig','asmCmSig','asmCmSrcSig']);
/* of those, the ones a test assigns there, and the file (S1f): garmentpaint.test.js gives origin/main's page a HOOK of its own whose
   setter writes asmCmMf, the page's global on that build */
const OLD_BUILD_WRITES={asmCmMf:['tests/garmentpaint.test.js']};
/* the restructure S6f (2026-11-27): the documented global set. Every name the app's own files (the page scripts, the Web Workers, lab/)
   put on the global object or read from it by name, beside the platform's: a module's bridge, `window.x`, `self.x`, `globalThis.x`.
   A name not listed here fails (import it, or ask for it through bus.js), and so does one listed that nothing uses any more.
   Not listed: merge.js's own top-level names, the page's last classic script (the owner's choice: the server imports it as it is) */
const GLOBALS={
  // what the page itself names: index.html's last script calls startUp(); its start-up catcher waits for startBusy and appReady and looks
  // for window.startUp (tests read appReady and startBusy too)
  startUp:'index.html: its last script calls it; the start-up catcher looks for window.startUp',
  appReady:'start.js sets it when start-up is done: index.html\'s start-up catcher and the tests wait for it',
  startBusy:'start.js sets it while start-up runs: index.html\'s start-up catcher waits for it',
  // the painter's drawings (mannequin.js and its pose files put them on self; draw.js reads the two functions): files the painting worker
  // and lab/gl-bench.html load too
  outfitMannequinSvg:'mannequin.js puts it on self: draw.js draws the figure with it',
  mqData:'mannequin.js puts it on self: draw.js reads a pose\'s parts',
  MQ_RAW:'each mq/*.js pose file adds its pose to it; mannequin.js reads them',
  // merge.js, classic: the server's copy (worker/backup.js) and analysis-worker.js run it as a module, where its names are this one object
  DW_MERGE:'merge.js hands its rules over as one object where it runs as a module (worker/backup.js, analysis-worker.js)',
  // switches a test or a tool sets before the app runs, which the app reads by name
  ASM_CM_SIZE:'a test\'s size for the painted masters (asm-cm-job.js, asm-cm-page.js): tests/modload.test.js, the labs',
  ASM_NO_WORKER:'a test paints on the page, not in the painting worker (assemble.js)',
  ASM_TEST_OFF:'a test turns the painter off (assemble.js)',
  DW_ANDROID:'a test says the phone is an Android one (core.js homeAndroid)',
  DW_BROWSER:'a test names the browser (core.js homeBrowser)',
  DW_IOS:'a test says the phone is an iPhone (core.js homeIOS)',
  DW_STANDALONE:'a test says the app runs from the Home Screen (core.js homeStandalone)',
  SETT_DEBUG:'a lab asks detect.js for its readings\' working',
  SETUP_AUTO:'a test lets the setup open by itself (setup.js)',
  SYNC_OLD:'a test makes this phone an older app for the backup (sync.js)',
  SYNC_SEND_TEST:'a test watches what a backup sends (sync.js)',
  TEST_PLAN:'a test holds the planner\'s simulation (history, month, pickscore, scorecard, stats, today-plan)',
  // the tests' access point: every module adds its names; the app never reads it (hookCheck)
  HOOK:'the tests\' access point (tests/hook.js): written by each module, read only by the tests',
};
/* the names the app's own files put on the global object or read from it by name ({name: [files]}): a bridge, window.x, self.x,
   globalThis.x (not the platform's: the browser's and a worker's own) */
function globalNames(ROOT,m){const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),out={},plat=platform();
  const add=(n,f)=>{if(plat.has(n))return;(out[n]=out[n]||new Set()).add(f)};
  for(const [f,l] of Object.entries(m.bridge))for(const n of l)add(n,f);
  const files=modscope.pageScripts(ROOT).map(t=>t.src).concat([...WORKERS,'cal-worker.js'].filter(w=>fs.existsSync(path.join(ROOT,w))));
  for(const f of files){const src=rd(f).replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`\\])\/\/[^\n]*/g,'$1');
    for(const x of src.matchAll(/(?<![\w$.])(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)/g))add(x[1],f)}   // (no space after the dot: "the window. Close it" is a sentence)
  for(const [n,l] of Object.entries(out))out[n]=[...l].sort();
  return out}
/* T2: every module's HOOK statement checked against what the tests use. {hooked: {file: Map name -> {value, get, set}}, problems,
   missing: names only the tests use that their file doesn't put on HOOK, ready: those the tests use through HOOK alone (they can
   come off BRIDGE), testOnly: [names]} */
function hookCheck(ROOT,m,r){
  const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),tags=modscope.pageScripts(ROOT),problems=[],hooked={},where=new Map();
  const blankHook=(src,ranges)=>{let s=src;for(const [a,b] of ranges)s=s.slice(0,a)+s.slice(a,b).replace(/[^\r\n]/g,' ')+s.slice(b);return s};
  const noHook=(f,src)=>{if(/\bHOOK\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'')))problems.push(`${f} reads HOOK: the app must not depend on the tests' access point`)};
  for(const t of tags){const f=t.src,src=rd(f);let ast;try{ast=modscope.parse(src,t.module)}catch(e){continue}
    const h=modscope.hooked(ast,src);noHook(f,blankHook(src,h.ranges));
    if(!h.count)continue;
    if(!t.module){problems.push(`${f} is a classic script: its top-level names are the page's already, it has no HOOK statement`);continue}
    if(h.count>1)problems.push(`${f} has ${h.count} HOOK statements: one, after its bridge`);
    for(const o of h.odd)problems.push(`${f}: a HOOK property the checkers can't read: ${o}`);
    hooked[f]=h.names;
    const at=h.ranges[0][0],decl=new Map();
    for(const st of ast.body){const s=st.type==='ExportNamedDeclaration'&&st.declaration?st.declaration:st;
      for(const d of modscope.declared({body:[s]}))if(!decl.has(d.name))decl.set(d.name,{kind:d.kind,at:st.range[0]})}
    for(const [n,x] of h.names){const d=decl.get(n),mut=d&&/^(?:let|var)$/.test(d.kind);
      if(where.has(n))problems.push(`${n} is on HOOK from ${where.get(n)} and ${f}`);else where.set(n,f);
      if(!d){problems.push(`${f} puts ${n} on HOOK, but ${n} is not one of its top-level names`);continue}
      if(x.value&&(x.get||x.set))problems.push(`${f}: ${n} is on HOOK twice (a value and an accessor)`);
      if(x.value&&mut)problems.push(`${f}: ${n} is a \`${d.kind}\` put on HOOK as a value (the copy keeps the value of that moment): write \`get ${n}(){return ${n}}\``);
      if((x.get||x.set)&&!mut)problems.push(`${f}: ${n} has a HOOK accessor but is not a \`let\` of ${f}: write it as \`${n}\``);
      if(x.set&&!x.get)problems.push(`${f}: ${n} has a HOOK setter and no getter`);
      if(x.value&&d.kind!=='function'&&d.at>at)problems.push(`${f}: ${n} is declared after the HOOK statement, which would throw at load: put the statement after the bridge, at the end`)}}
  for(const w of [...WORKERS,'cal-worker.js'])if(fs.existsSync(path.join(ROOT,w)))noHook(w,rd(w));
  const html=rd('index.html').replace(/<!--[\s\S]*?-->/g,'');for(const x of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))noHook('index.html (an inline script)',x[1]);
  let lab=[];try{lab=fs.readdirSync(path.join(ROOT,'lab')).filter(f=>/\.(?:js|html)$/.test(f))}catch(e){}
  for(const f of lab)noHook('lab/'+f,rd('lab/'+f));
  const testOnly=Object.keys(r).filter(n=>!r[n].app.length&&(r[n].tests.length||r[n].hook.length)).sort();
  const on=n=>where.has(n)?hooked[where.get(n)].get(n):null;
  const missing=testOnly.filter(n=>!on(n)).map(n=>`${r[n].file}: ${n}`);
  const ready=testOnly.filter(n=>on(n)&&!r[n].tests.length);
  for(const [n,l] of Object.entries(r.viaHook))if(!on(n))problems.push(`${[...new Set(l)].join(', ')} ${l.length>1?'read':'reads'} HOOK.${n}, which no module puts on HOOK`);
  for(const n of testOnly){const h=on(n),w=[...new Set([...r[n].testWrites,...r[n].hookWrites])];if(h&&w.length&&!h.set)problems.push(`${n} is assigned by ${w.join(', ')}, but ${where.get(n)} puts it on HOOK without \`set ${n}(v){${n}=v}\``)}
  for(const [n,l] of Object.entries(r.hookWrites)){const h=on(n);if(h&&!h.set)problems.push(`${[...new Set(l)].join(', ')} assign${l.length>1?'':'s'} HOOK.${n}, which ${where.get(n)} puts on HOOK without a setter (the write would only hide it)`)}
  for(const [n,f] of where)if(!(r[n]&&(r[n].tests.length||r[n].hook.length))&&!r.viaHook[n])problems.push(`${f} puts ${n} on HOOK, but no test uses it: take it off`);
  return {hooked,problems,missing,ready,testOnly};
}

/* {page, mods, bridge: {file: [names]}, problems: [text], unbridged: [text], unseen: [text], assets: [text]} for the app in ROOT */
function measure(ROOT){
  const tags=modscope.pageScripts(ROOT),page=tags.map(t=>t.src),mods=tags.filter(t=>t.module).map(t=>t.src),isMod=new Set(mods);
  const problems=[],bridge={},exported={},info={},srcs={},how={},spelled={};
  for(const f of page){const m=isMod.has(f),src=srcs[f]=fs.readFileSync(path.join(ROOT,f),'utf8');let ast;
    try{ast=modscope.parse(src,m)}catch(e){if(m)problems.push(`${f} doesn't parse as a module: ${e.message}`);continue}   // (a classic script that doesn't parse is ESLint's to report)
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:m?'module':'script'}).globalScope,own=new Set(g.variables.map(v=>v.name));
    info[f]={top:modscope.declared(ast).map(d=>d.name),free:[...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
    if(!m)continue;
    const b=modscope.bridged(ast,src),kind=new Map(modscope.declared(ast).map(d=>[d.name,d.kind]));bridge[f]=[...b.names.keys()].sort();
    for(const o of b.odd)problems.push(`${f}: a bridge statement the checkers can't read (name each property plainly): ${o}`);
    if(!modscope.hasModuleSyntax(ast))problems.push(`${f} is loaded as a module but has no import or export: add \`export {}\`, so TypeScript and tests/appsrc.js see a module too`);
    /* restructure S5a (2026-11-26): every name a module bridges is exported too, so another page file can import it in place of the bridge */
    {const ex=new Set();for(const st of ast.body)if(st.type==='ExportNamedDeclaration'){for(const s of st.specifiers)ex.add(s.exported.name||s.exported.value);if(st.declaration)for(const d of modscope.declared({body:[st.declaration]}))ex.add(d.name)}
      exported[f]=[...ex].sort();const miss=bridge[f].filter(n=>kind.has(n)&&!ex.has(n));if(miss.length)problems.push(`${f} bridges ${miss.join(', ')} without exporting ${miss.length>1?'them':'it'}: add ${miss.length>1?'them':'it'} to its \`export {…}\``)}
    /* each name is handed over the way its declaration needs */
    for(const [n,k] of b.names){const a=b.acc.get(n),mut=/^(?:let|var)$/.test(kind.get(n)||'');how[n]={file:f,set:!!(a&&a.set),assign:k==='assign',own:kind.has(n)};
      if(k==='assign'){if(mut)problems.push(`${f}: ${n} is a \`${kind.get(n)}\` handed over with Object.assign, so the global keeps the value it had then: bridge it with a getter (Object.defineProperties(globalThis, {${n}: {get: () => ${n}}}))`);continue}
      if(!a)continue;
      if(!a.get||a.reads!==n)problems.push(`${f}: the bridge of ${n} needs \`get: () => ${n}\``+(a.get?' (its getter gives something else back, or more than that)':' (it has no getter)'));
      else if(!mut)problems.push(`${f}: ${n} has a getter but is not a \`let\` of ${f}: hand a function or a constant over with Object.assign(globalThis, {${n}})`);
      else if(a.set&&a.writes!==n)problems.push(`${f}: the setter of ${n} must be \`set: v => {${n} = v}\``)}
    for(const i of modscope.imports(ast,f)){
      if(i.odd)problems.push(`${f}: its import from ${i.from} is ${i.odd}`);
      else if(!isMod.has(i.from))problems.push(`${f} imports ${i.from}, which is not a type="module" script in index.html (every module has its own tag)`);
      else (spelled[i.from]=spelled[i.from]||new Set()).add(i.from)}}
  /* who gives the page each global name: a classic script its top-level names, a module its bridge */
  const giver=new Map(),kept=new Map();
  for(const f of page){if(!info[f])continue;
    if(!isMod.has(f)){for(const n of info[f].top)if(!giver.has(n))giver.set(n,f);continue}
    for(const n of bridge[f]){const o=giver.get(n);
      if(o&&o!==f)problems.push(`${n} is bridged by ${f} and also ${isMod.has(o)?'bridged':'declared at its top level'} by ${o}`);else giver.set(n,f)}}
  for(const f of page)if(info[f]&&!isMod.has(f))for(const n of info[f].top){const o=giver.get(n);if(o&&o!==f&&isMod.has(o))problems.push(`${n} is bridged by ${o} and also declared at its top level by ${f}`)}
  for(const f of mods)if(info[f])for(const n of info[f].top)if(!giver.has(n)&&!kept.has(n))kept.set(n,f);
  /* a global use of a name only a module has, kept to itself */
  const unbridged=[],plat=platform();
  for(const f of page)if(info[f])for(const n of info[f].free){const o=kept.get(n);if(o&&o!==f&&!plat.has(n))unbridged.push(`${f} uses ${n}, which ${o} declares and doesn't bridge`)}
  /* a classic worker can't importScripts a module; a module worker (analysis-worker.js, asm-worker.js) imports its files by plain relative paths, and
     what its files read as globals there must be some file's of its own list: a classic one's top-level name or a module's bridge */
  const wfiles={};
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;
    const k=modscope.workerFiles(ROOT,w);
    if(!k.module){for(const x of k.files)if(x!==w&&isMod.has(x))problems.push(`${w} importScripts ${x}, which the page loads as a module`);continue}
    const src=srcs[w]=fs.readFileSync(path.join(ROOT,w),'utf8');let ast;
    try{ast=modscope.parse(src,true)}catch(e){problems.push(`${w} doesn't parse as a module: ${e.message}`);continue}
    for(const i of modscope.imports(ast,w)){
      if(i.odd)problems.push(`${w}: its import from ${i.from} is ${i.odd}`);
      else if(!page.includes(i.from))problems.push(`${w} imports ${i.from}, which is not a page script (the worker's files are the page's, cached under their tags' names)`);
      else (spelled[i.from]=spelled[i.from]||new Set()).add(i.from)}   // (named imports too: since the restructure S6p, 2026-11-27, asm-worker.js imports the painter's names it calls, its files bridge nothing)
    if(modscope.bridged(ast,src).names.size)problems.push(`${w} bridges names: a worker's own names are its own`);
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:'module'}).globalScope,own=new Set(g.variables.map(v=>v.name));
    info[w]={top:[],free:[...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
    wfiles[w]=k.files}
  for(const [w,files] of Object.entries(wfiles)){const give=new Set(),keep=new Map();
    for(const f of files){if(!info[f])continue;if(isMod.has(f)){for(const n of bridge[f])give.add(n);for(const n of info[f].top)if(!keep.has(n))keep.set(n,f)}else for(const n of info[f].top)give.add(n)}
    for(const f of files)if(info[f])for(const n of info[f].free){const o=keep.get(n);if(o&&o!==f&&!give.has(n)&&!plat.has(n))unbridged.push(`${f} uses ${n} in ${w}, which ${o} declares and doesn't bridge`)}}
  /* a write to a bridged name from outside its file: seen by the module only through a setter */
  const unseen=[];
  if(Object.keys(how).length){const by={};
    const note=(f,w)=>{if(w)for(const [n,c] of w){const h=how[n];if(h&&h.file!==f&&!h.set&&(h.own||!h.assign))(by[n]=by[n]||[]).push(f+(c>1?' ('+c+')':''))}};
    for(const f of page)if(srcs[f]!=null)note(f,writesOf(srcs[f],isMod.has(f)));
    for(const w of Object.keys(wfiles))note(w,writesOf(srcs[w],true));
    for(const f of nodeFiles(ROOT))note(f,writesOf(fs.readFileSync(path.join(ROOT,f),'utf8'),false));
    for(const [n,l] of Object.entries(by)){const h=how[n];
      unseen.push(h.assign?`${n} is assigned by ${l.join(', ')}, but ${h.file} hands it over with Object.assign: the global is replaced and ${h.file} goes on using its own (make it a \`let\` with a getter and a setter, or give ${h.file} a function for it)`
        :`${n} is assigned by ${l.join(', ')}, but ${h.file} bridges it with a getter only: add \`set: v => {${n} = v}\``)}}
  /* every module is in sw.js ASSETS as its tag and its importers spell it */
  const assets=[];
  if(mods.length&&fs.existsSync(path.join(ROOT,'sw.js'))){const a=/const ASSETS=\[([^\]]*)\]/.exec(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8')),list=new Set(a?[...a[1].matchAll(/'([^']+)'/g)].map(m=>m[1]):[]);
    for(const f of mods)for(const s of new Set([f,...(spelled[f]||[])]))if(!list.has(s))assets.push(`${s} is a module and not in sw.js ASSETS under that spelling`)}
  return {page,mods,bridge,exported,problems,unbridged,unseen,assets};
}
/* the ratchet: bridged names the list doesn't have (fresh), listed names no longer bridged (gone) */
function compare(now,base){
  const fresh=[],gone=[];
  for(const [f,l] of Object.entries(now))for(const n of l)if(!(base[f]||[]).includes(n))fresh.push(f+': '+n);
  for(const [f,l] of Object.entries(base))for(const n of l)if(!(now[f]||[]).includes(n))gone.push(f+': '+n);
  return {fresh,gone};
}
/* a row only shrinks once it is on main: names a row has that main's copy of the row lacks, less those allowed (grown) */
function grew(list,main,allowed={}){
  const out=[];
  for(const [f,l] of Object.entries(list))if(main[f])for(const n of l)if(!main[f].includes(n)&&!(allowed[f]||[]).includes(n))out.push(f+': '+n);
  return out;
}
/* BRIDGE as a text of this file has it (main's copy); null when it can't be read */
function rowsOf(text){
  const m=/\nconst BRIDGE=(\{[\s\S]*?\n\});/.exec(text||'');if(!m)return null;
  try{const o=Function('"use strict";return ('+m[1]+')')();return o&&typeof o==='object'?o:null}catch(e){return null}
}
function mainRows(ROOT){
  try{return rowsOf(require('child_process').execFileSync('git',['show','origin/main:tests/bridge.test.js'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:15000}))}catch(e){return null}
}

module.exports=async({ok,ROOT})=>{
  /* the ratchet's rule, on made-up rows */
  const base={'a.js':['f','g'],'b.js':['h']};
  let r=compare({'a.js':['f','g'],'b.js':['h']},base);
  ok(!r.fresh.length&&!r.gone.length,'the same bridged names pass');
  r=compare({'a.js':['f','g','x'],'b.js':['h'],'n.js':['y']},base);
  ok(r.fresh.join()==='a.js: x,n.js: y'&&!r.gone.length,'a bridged name that isn\'t listed is named, in a listed file or a new one');
  r=compare({'a.js':['f']},base);
  ok(!r.fresh.length&&r.gone.join()==='a.js: g,b.js: h','a listed name that is no longer bridged is named, a whole file\'s too');
  ok(grew({'a.js':['f','g','x'],'b.js':[],'n.js':['y','z']},base).join()==='a.js: x'&&!grew({'a.js':['f','x'],'n.js':['y']},base,{'a.js':['x']}).length,
    'a row main already has may shrink but not gain a name, unless the name is in GROWN; a file main has no row for (the pull request converting it) brings its whole row');
  ok(JSON.stringify(rowsOf('x\nconst BRIDGE={\n  // why\n  \'a.js\':[\'f\'],\n};\n'))==='{"a.js":["f"]}'&&rowsOf('nothing')===null,'main\'s rows are read from its copy of this file');

  /* the app */
  const m=measure(ROOT),c=compare(m.bridge,BRIDGE),n=Object.values(m.bridge).reduce((a,l)=>a+l.length,0);
  ok(m.page.length>40,`the page scripts read (${m.page.length} scripts, ${m.mods.length} of them ES modules, ${n} bridged names)`);
  ok(m.mods.join()===Object.keys(BRIDGE).filter(f=>m.mods.includes(f)).join()&&Object.keys(BRIDGE).every(f=>m.mods.includes(f)),`BRIDGE has a row for every module, in index.html's order, and for nothing else (${m.mods.join(', ')||'no module'})`);
  ok(Object.values(BRIDGE).every(l=>l.join()===[...l].sort().join()),'each row is in a-z order (two branches taking a name off the same row merge cleanly)');
  ok(!c.fresh.length,'every bridged name is listed in BRIDGE'+(c.fresh.length?' (add it in tests/bridge.test.js with who still reads it: '+c.fresh.join('; ')+')':''));
  ok(!c.gone.length,'the bridge only shrinks: every listed name is still bridged'+(c.gone.length?' (take them off BRIDGE in tests/bridge.test.js: '+c.gone.join('; ')+')':''));
  const main=mainRows(ROOT),g=main?grew(BRIDGE,main,GROWN):[];
  ok(!g.length,(main?'no row that main already has gained a name':'(origin/main\'s rows could not be read here: not compared)')+(g.length?': '+g.join('; ')+' (only the pull request that converts a file writes its row; a name that must be added later goes in GROWN with the reason)':''));
  const stale=Object.entries(GROWN).flatMap(([f,l])=>l.filter(x=>!(BRIDGE[f]||[]).includes(x)).map(x=>f+': '+x));
  ok(!stale.length,'every name in GROWN is still in BRIDGE'+(stale.length?' (take them off GROWN: '+stale.join('; ')+')':''));
  ok(!m.unbridged.length,'no file uses, as a global, a name a module keeps to itself'+(m.unbridged.length?': '+m.unbridged.join('; ')+' (import it, or bridge it and list it)':''));
  ok(!m.problems.length,'every module has module syntax, a bridge the checkers can read (a function or constant assigned, a `let` behind `get: () => name`), plain relative imports of other page modules, and no Web Worker importScripts it'+(m.problems.length?': '+m.problems.join('; '):''));
  ok(!m.unseen.length,'no page script, test or tool assigns a bridged name that has no setter'+(m.unseen.length?': '+m.unseen.join('; '):''));
  ok(!m.assets.length,'every module is in sw.js ASSETS under the spelling of its tag and of each import of it'+(m.assets.length?': '+m.assets.join('; '):''));

  /* the tests' access point (T2, 2026-11-25; tests/hook.js): HOOK, on made-up files, then on the app */
  {const P=s=>modscope.hooked(modscope.parse(s,true),s);
    let h=P('let a=1;function f(){}const C=2;\nObject.assign(globalThis,{f});\nglobalThis.HOOK={__proto__:globalThis.HOOK||null,f,C,get a(){return a},set a(v){a=v}};\nexport {f};');
    ok(h.count===1&&!h.odd.length&&JSON.stringify([...h.names].map(([n,x])=>[n,x.value,x.get,x.set]))==='[["f",true,false,false],["C",true,false,false],["a",false,true,true]]'
      &&!modscope.bridged(modscope.parse('globalThis.HOOK={__proto__:globalThis.HOOK||null,f};',true)).names.size,
      'a HOOK statement is read name by name (a value, a getter, a setter), and it isn\'t a bridge: HOOK is not a page name');
    h=P('globalThis.HOOK={f};globalThis.HOOK={__proto__:globalThis.HOOK||null,get a(){return b},[k]:1,set a(v){a=v+1}};');
    ok(h.count===2&&h.odd.length===4,'a HOOK statement without its __proto__ first, a getter giving back another name, a computed key or a setter that doesn\'t plainly assign is named');
    const u=testUses("await p.evaluate(()=>{HOOK.a=1;b();window.c=2});p.evaluate('d(HOOK.e)');log('f is gone');ok(1,`h ${1} too`);vm.runInContext(appSrc(R,'x.js')+';this.K={g}',ctx);",new Set('abcdefgh'));
    ok([...u.global].sort().join()==='b,c,d'&&[...u.hook].sort().join()==='a,e'&&[...u.hookWrites].join()==='a'&&[...u.globalWrites].join()==='c',
      'a test\'s uses: bare names and window.name in its code and in the code of its strings are global (a sentence, an ok() message, is not: S6t0), HOOK.name is the access point, a string joined after appSrc is the files\' own scope');
    const ui=testUses("await p.evaluate(()=>!('a' in HOOK)&&\"b\" in HOOK&&'c' in HOOK.d)",new Set('abcd'));
    ok([...ui.hook].sort().join()==='a,b,d'&&!ui.global.size,'a test\'s `\'name\' in HOOK` (what --to-hook asks for in place of a typeof) is a use of the name through HOOK, `\'key\' in HOOK.x` is not (S6t3)'+` (got ${[...ui.hook]}; global ${[...ui.global]})`)
    /* strings that are not code (T2 phase 3): each is no use, and the rewrite leaves it as it is */
    const W=new Set(['shop','rd','setOpenTap','tieScore','a']);
    const NOT={'a file name':"src('shop.js');p.route('**/shop.js',r=>r.abort());",'an id':"p.click('#'+'rd-camo');tapAt('shop-backdrop');S('lock-shop');",
      'a data-act selector':"p.click('header .hbtns button[data-act=\"setOpenTap\"]');p.tap(`[data-act=setOpenTap]`);",'a host name':"p.goto('http://x/'+'shop.test');fetch(`shop.test:9210`);",
      'a tab-separated record':"fs.writeFileSync(f,'a.test.js\\tplanner.js\\t'+L+'\\toutfit\\ttieScore');",
      'a command-line flag':"if(argv.includes('--shop'))go(arg('--rd-x'));flag('--a=1');"};
    for(const [what,s] of Object.entries(NOT)){const u=testUses(s,W),x=toHook(s,W);
      ok(!u.global.size&&x.out===s&&!x.n&&!x.manual.length,`${what} in a string is not a use of a page name, and --to-hook leaves it alone`+(u.global.size||x.out!==s||x.manual.length?` (counted: ${[...u.global]}; rewritten: ${x.out!==s}; left: ${x.manual.join('; ')})`:''))}
    const y=testUses("p.evaluate('shop.x+1');p.evaluate('rd()');p.evaluate('setOpenTap(a)');log('the shop is open');",W),z=toHook("p.evaluate('rd()');p.evaluate(`shop.x-1`)",W);
    ok([...y.global].sort().join()==='a,rd,setOpenTap,shop'&&z.out==="p.evaluate('HOOK.rd()');p.evaluate(`HOOK.shop.x-1`)",'and code in a string, or a sentence, still counts and is still rewritten (the same names: shop.x+1, rd(), setOpenTap(a), "the shop is open")')
    /* S1f: a string searched for, and a call's label handed to a helper, are not code; a one-call string run or kept to be run is */
    const W3=new Set([...W,'fill']),NS3=new Set(['fill']);
    const srch="ok(m.def.includes(`fill=\"${c}\"`)&&d.startsWith('fill=1')&&d.indexOf('rd()')<0,'drawn');",lbl="await step('one tap',()=>tap('#b'),'rd()');want('shop()','x');";
    const s1=testUses(srch,W3),s2=toHook(srch,W3,new Set(),NS3),l1=testUses(lbl,W3),l2=toHook(lbl,W3,new Set(),NS3);
    ok(!s1.global.size&&!s1.globalWrites.size&&s2.out===srch&&!s2.manual.length,'a string searched for in another (includes, startsWith, indexOf: SVG markup like fill="…") is no use or write of a page name, and --to-hook leaves it'+(s1.global.size||s2.out!==srch||s2.manual.length?` (counted: ${[...s1.global]}; rewritten: ${s2.out!==srch}; left: ${s2.manual.join('; ')})`:''));
    ok(!l1.global.size&&l2.out===lbl,'a call\'s label handed to a helper (step(…, \'rd()\'), a wrapper\'s record) is no use of a page name, and --to-hook leaves it'+(l2.out===lbl?'':` (got ${l2.out})`));
    const run="p.evaluate('rd()');await p.waitForFunction('shop()');const L=[['score','rd()']];go(p.evaluate('shop()'));",r3=toHook(run,W3);
    ok(r3.out==="p.evaluate('HOOK.rd()');await p.waitForFunction('HOOK.shop()');const L=[['score','HOOK.rd()']];go(p.evaluate('HOOK.shop()'));",'and a one-call string run in the page, or kept in a list to be run, is still code and still rewritten'+(r3.manual.length?` (left: ${r3.manual})`:''))}
  /* S1a (2026-11-25): --to-hook rewrites a name the tests assign (one with a HOOK setter) where it is assigned, and only there */
  {const Wn=new Set(['x','cache']),NS=new Set(['f']),T=s=>toHook(s,new Set(),Wn,NS);
    const CASES=[
      ['a plain assignment','cache={};x=1;','HOOK.cache={};HOOK.x=1;'],
      ['a compound assignment, ++ and --','x+=2;x++;--x;cache??={};','HOOK.x+=2;HOOK.x++;--HOOK.x;HOOK.cache??={};'],
      ['a destructuring target','[a,x]=l;({x}=o);({x=1}=o);','[a,HOOK.x]=l;({x:HOOK.x}=o);({x:HOOK.x=1}=o);'],
      ['window.name assigned','window.x=1;globalThis.cache={};self.x++;','HOOK.x=1;HOOK.cache={};HOOK.x++;'],
      ['an assignment in the code of a string',"p.evaluate('cache={};f(x)');p.evaluate(`x=${1}`)","p.evaluate('HOOK.cache={};f(x)');p.evaluate(`HOOK.x=${1}`)"],
      ['a read stays a read','f(x);g(cache.y);const z=window.x;','f(x);g(cache.y);const z=window.x;'],
      ['x.y= and x[k]= change the object, not the name','cache.y=1;cache[k]=2;x.a.b=3;window.cache.y=4;delete cache[k];',
        'cache.y=1;cache[k]=2;x.a.b=3;window.cache.y=4;delete cache[k];'],
      ['a local of the same name','let x;x=1;function g(cache){cache={}}for(const x of l)x;','let x;x=1;function g(cache){cache={}}for(const x of l)x;'],
      ['an ok() message and a sentence',"ok(1,'cache={} is set');log('x= is the width')","ok(1,'cache={} is set');log('x= is the width')"],
    ];
    for(const [what,src,want] of CASES){const r=T(src);ok(r.out===want&&!r.manual.length,`--to-hook, a name the tests assign: ${what}`+(r.out===want?'':` (got ${r.out})`)+(r.manual.length?` (left: ${r.manual})`:''))}
    const a=T("f=()=>1;window.f=g;p.evaluate('f=h')"),b=T("p.evaluate('cache={}\\n')"),c=T('typeof x;x=1');
    ok(a.out==="f=()=>1;window.f=g;p.evaluate('f=h')"&&a.manual.length===3&&b.out==="p.evaluate('cache={}\\n')"&&b.manual.length===1&&/assigns cache/.test(b.manual[0])&&c.out==='typeof x;HOOK.x=1'&&!c.manual.length,
      '--to-hook leaves for a person an assigned name with no HOOK setter (a function) and a string with an escape that assigns one; a typeof of a name only assigned is no use to rewrite');
    const m2=measure(ROOT),r2=readers(ROOT,m2),w2=writeSets(r2,hookCheck(ROOT,m2,r2));
    ok(['items','dayRecs','TODAY_OVERRIDE','cache','sel','view','weather','monthOpen','editing'].every(n=>w2.writes.has(n))&&[...w2.noSet].every(n=>!w2.writes.has(n)),
      `every let the tests assign has a HOOK setter, so --to-hook can rewrite it (${w2.writes.size} names; without one: ${[...w2.noSet].sort().join(', ')||'none'})`);
    ok([...OLD_BUILD].every(n=>!w2.writes.has(n)&&!w2.names.has(n)&&!w2.noSet.has(n)),`--to-hook leaves the names a test also uses on an older build, which has no HOOK (${[...OLD_BUILD].join(', ')})`)}
  /* S6t0 (2026-11-27): --to-hook rewrites a bridged name a test reads (on its owner's HOOK) wherever it is read, and leaves call labels,
     strings that aren't code, property names, a local of the same name, code run in a vm context and the platform's own names */
  {const Wr=new Set(['items','planFor','cache','open','name']),T=s=>toHook(s,Wr);
    const READS=[
      ['a bare read and a call','f(items);const d=planFor(k);','f(HOOK.items);const d=HOOK.planFor(k);'],
      ['in a function handed to the page','await p.evaluate(()=>items.length+planFor(d).ids.length);','await p.evaluate(()=>HOOK.items.length+HOOK.planFor(d).ids.length);'],
      ['in the code of a string',"p.evaluate('planFor(d)');p.waitForFunction(`items.length>${n}`);","p.evaluate('HOOK.planFor(d)');p.waitForFunction(`HOOK.items.length>${n}`);"],
      ['window.name and a shorthand property','const x=window.items;g({items});','const x=HOOK.items;g({items:HOOK.items});'],
      ['a write as well as a read','items=[];items.push(1);','HOOK.items=[];HOOK.items.push(1);'],
    ];
    const LEAVE=[
      ['a call\'s label',"await step('one tap',()=>tap('#b'),'planFor()');"],
      ['strings that are not code',"p.click('#items');metaGet('cache');src('items.js');ok(1,`planFor(d) ${1}`);"],
      ['property names','o.items;o?.planFor(d);const q={items:1,planFor(){}};class C{items(){}}x["cache"];'],
      ['a local of the same name','const items=[];items.push(1);function g(planFor){return planFor()}for(const cache of l)cache.x;'],
      ['code run in a vm context',"vm.runInContext('planFor(d)+items.length',ctx);new vm.Script(`cache=${1}`);vm.runInContext(appSrc(R,'a.js')+';items',ctx);"],
      ['the platform\'s own names',"open('x');const t=name;window.open('y');p.evaluate('name+open()');"],
    ];
    for(const [what,src,want] of READS){const r=T(src);ok(r.out===want&&!r.manual.length,`--to-hook, a bridged name a test reads: ${what}`+(r.out===want?'':` (got ${r.out})`)+(r.manual.length?` (left: ${r.manual})`:''))}
    for(const [what,src] of LEAVE){const r=T(src),u=testUses(src,Wr);
      ok(r.out===src&&!r.manual.length&&![...u.global].some(n=>!platformAll().has(n)),`--to-hook and the reads check leave ${what}`+(r.out===src?'':` (got ${r.out})`)+([...u.global].some(n=>!platformAll().has(n))?` (counted: ${[...u.global]})`:'')+(r.manual.length?` (left: ${r.manual})`:''))}
    const se="log('the items are drawn');ok(hits.join()==='c.key,planFor(k)','x');",sj="p.evaluate('items.filter(x=>'+c+')');",s1=T(se),s2=T(sj),u1=testUses(se,Wr),u2=testUses(sj,Wr);
    ok(s1.out===se&&!s1.manual.length&&!u1.global.size&&s2.out===sj&&s2.manual.length===1&&/isn't code uses items/.test(s2.manual[0])&&[...u2.global].join()==='items',
      'a sentence, and a string compared with another (an expected value), are words: no use, left alone; a piece of code that doesn\'t parse alone, joined with + to the rest, still counts and is named for a person'+(s1.manual.length||s2.manual.length!==1?` (left: ${[...s1.manual,...s2.manual].join('; ')})`:''));
    const pl=testUses("p.evaluate(()=>items.length);log(`x`)",Wr),br2=bareReads({items:{tests:['tests/a.test.js','tests/old.test.js']},open:{tests:['tests/a.test.js']}},{'tests/old.test.js':['items']});
    ok([...pl.global].join()==='items'&&JSON.stringify(br2)==='{"tests/a.test.js":["items"]}',
      'the reads check names a test reading a bridged name as a global (a planted read), but not the platform\'s names or an old build\'s read listed in READS_KEPT')}
  const rs=readers(ROOT,m),hk=hookCheck(ROOT,m,rs);
  ok(!hk.problems.length,'every HOOK statement is in a module, once, after its bridge, with names of the file\'s own (a `let` behind a getter, a setter for what a test assigns), none twice; no test uses a name that isn\'t on HOOK through it; the app never reads HOOK'+(hk.problems.length?': '+hk.problems.join('; '):''));
  ok(!hk.missing.length,`every name only the tests use is on its file's HOOK (${hk.testOnly.length} names)`+(hk.missing.length?': add '+hk.missing.join('; '):''));
  /* S1f (2026-11-25), the goal of restructure step 1: no test or tool assigns a bridged name (bare, window.name, in its code or the code
     of its strings): it sets the app's state through HOOK.name, a setter the owner puts on HOOK. The
     one exception: a name a test also writes on an older build, which has no HOOK (OLD_BUILD_WRITES) */
  const tw=Object.entries(rs).flatMap(([n,x])=>x.testWrites.filter(f=>!(OLD_BUILD_WRITES[n]||[]).includes(f)).map(f=>`${f} assigns ${n}`));
  ok(!tw.length,'no test or tool assigns a bridged name (it writes HOOK.name: node tests/bridge.test.js --to-hook <file> rewrites it)'+(tw.length?': '+tw.join('; '):''));
  /* S6t0 (2026-11-27), before the bridge comes down: no test or tool reads a bridged name as a global either (it reads HOOK.name).
     Off until S6t4 switches it on (BARE_READS_CHECK); until then it says how many reads are left */
  {const br3=bareReads(rs),files=Object.keys(br3),pairs=Object.values(br3).reduce((a,l)=>a+l.length,0);
    if(BARE_READS_CHECK)ok(!files.length,`no test or tool reads a module's name as a global (it reads HOOK.name: node tests/bridge.test.js --to-hook <file> rewrites it; ${Object.keys(rs).length} names, the old builds' reads in READS_KEPT aside)`+(files.length?': '+files.map(f=>`${f} reads ${br3[f].join(', ')}`).join('; '):''));
    else ok(true,`(the reads check is off until S6t4: ${files.length} test and tool files still read ${pairs} bridged name${pairs===1?'':'s'} as globals, file by file; \`node tests/bridge.test.js --reads\` lists them)`)}
  /* the restructure S6f: the app's global names are the documented set (GLOBALS), no more and no fewer */
  {const G=globalNames(ROOT,m),extra=Object.keys(G).filter(n=>!(n in GLOBALS)).sort(),stale=Object.keys(GLOBALS).filter(n=>!(n in G));
    ok(!extra.length&&!stale.length,`the app's files put on the global object or read from it by name only the documented set (${Object.keys(GLOBALS).length} names: GLOBALS)`+(extra.length?': not listed: '+extra.map(n=>n+' ('+G[n].join(', ')+')').join('; ')+' (import it, or ask for it through bus.js)':'')+(stale.length?'; listed but used by nothing: '+stale.join(', '):''));
    const bridged=Object.entries(m.bridge).flatMap(([f,l])=>l.map(n=>f+': '+n));
    ok(bridged.join()==='start.js: startUp',`no module hands a name to globalThis but start.js's startUp (${bridged.join('; ')||'none'})`);
    const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'dw-hook-'));
    try{fs.writeFileSync(path.join(tmp,'index.html'),'<script type="module" src="a.js"></script><script type="module">HOOK.x()</script>');
      fs.writeFileSync(path.join(tmp,'a.js'),"const f=()=>HOOK.y;\nglobalThis.HOOK={__proto__:globalThis.HOOK||null,f};\nwindow.zz=1;\nexport {f};\n");
      const hp=hookCheck(tmp,{bridge:{'a.js':[]}},Object.defineProperties({},{viaHook:{value:{}},hookWrites:{value:{}}})).problems,gn=globalNames(tmp,{bridge:{'a.js':[]}});
      ok(hp.some(p=>/^a\.js reads HOOK/.test(p))&&hp.some(p=>/inline script\) reads HOOK/.test(p))&&JSON.stringify(gn)==='{"HOOK":["a.js"],"zz":["a.js"]}',
        'a planted app file and inline script that read HOOK are named (the app never reads the tests\' access point), and a planted window.zz is seen as an app global'+` (${hp.join('; ')}; ${JSON.stringify(gn)})`)}
    finally{fs.rmSync(tmp,{recursive:true,force:true})}}
  ok(true,`${hk.ready.length} of the ${hk.testOnly.length} names only the tests use are used through HOOK alone and can come off BRIDGE (T2 phase 3; \`node tests/bridge.test.js --hook\` lists them and the tests still using the rest as globals)`);
};
module.exports.measure=measure;module.exports.compare=compare;module.exports.grew=grew;module.exports.writesOf=writesOf;
module.exports.readers=readers;module.exports.testUses=testUses;module.exports.toHook=toHook;module.exports.hookCheck=hookCheck;module.exports.writeSets=writeSets;
module.exports.bareReads=bareReads;

/* `node tests/bridge.test.js --plan file.js`: what a page script would have to bridge if it became a module today. For each of its
   top-level names: the page scripts that use it (a read, a call, a `typeof` guard), the tests and tools that do, and who assigns it.
   Prints the bridge lines to paste at the file's end, its BRIDGE row, and what needs a decision first. */
function plan(ROOT,file){
  const tags=modscope.pageScripts(ROOT),tag=tags.find(t=>t.src===file);if(!tag)throw new Error(file+' is not a page script of index.html');
  const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const decl=modscope.declared(modscope.parse(rd(file),tag.module)),kind=new Map(decl.map(d=>[d.name,d.kind])),use={};
  const at=n=>use[n]=use[n]||{page:[],node:[],wpage:[],wnode:[]};
  const free=(src,module)=>{let ast;const o={ecmaVersion:'latest',ranges:true,allowReturnOutsideFunction:!module,allowHashBang:true};
    try{ast=acorn.parse(src,{...o,sourceType:module?'module':'script'})}catch(e){try{ast=acorn.parse(src,{...o,sourceType:'module',allowReturnOutsideFunction:false});module=true}catch(e2){return []}}
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:module?'module':'script'}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
    return [...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
  for(const t of tags){if(t.src===file)continue;const src=rd(t.src);
    for(const n of free(src,t.module))if(kind.has(n))at(n).page.push(t.src);
    for(const [n] of writesOf(src,t.module)||[])if(kind.has(n))at(n).wpage.push(t.src)}
  for(const w of WORKERS)if(fs.existsSync(path.join(ROOT,w))&&new RegExp("importScripts\\([^)]*'"+file.replace(/[.\\/]/g,'\\$&')+"'").test(rd(w)))at('').page.push(w);
  // a module worker that imports the file reads its names as globals too (analysis-worker.js: through the file's bridge)
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;const k=modscope.workerFiles(ROOT,w);if(!k.module||!k.files.includes(file))continue;
    const src=rd(w);for(const n of free(src,true))if(kind.has(n))at(n).page.push(w);
    for(const [n] of writesOf(src,true)||[])if(kind.has(n))at(n).wpage.push(w)}
  for(const f of nodeFiles(ROOT)){const src=rd(f);
    for(const n of free(src,false))if(kind.has(n))at(n).node.push(f);
    for(const [n] of writesOf(src,false)||[])if(kind.has(n))at(n).wnode.push(f)}
  const names=decl.filter(d=>d.kind!=='import').map(d=>d.name),used=names.filter(n=>use[n]&&(use[n].page.length||use[n].node.length||use[n].wpage.length||use[n].wnode.length));
  const written=n=>use[n].wpage.length+use[n].wnode.length>0,mut=n=>/^(?:let|var)$/.test(kind.get(n));
  return {file,importScripts:(use['']||{page:[]}).page,names,kind,use,used,kept:names.filter(n=>!used.includes(n)),
    assign:used.filter(n=>!mut(n)),getters:used.filter(n=>mut(n)&&!written(n)),setters:used.filter(n=>mut(n)&&written(n)),stubbed:used.filter(n=>!mut(n)&&written(n))};
}
module.exports.plan=plan;
if(require.main===module){
  const ROOT=path.join(__dirname,'..'),i=process.argv.indexOf('--plan'),file=i>0&&process.argv[i+1];
  /* `node tests/bridge.test.js --hook [--json]`: the names only the tests use, those ready to come off BRIDGE (used through HOOK alone),
     and per test file the names it still uses as globals */
  const th=process.argv.indexOf('--to-hook');
  if(th>0){const f=process.argv[th+1],m=measure(ROOT),r=readers(ROOT,m),hk=hookCheck(ROOT,m,r),p=path.resolve(f);
    const w=writeSets(r,hk),x=toHook(fs.readFileSync(p,'utf8'),w.names,w.writes,w.noSet);
    if(process.argv.includes('--write'))fs.writeFileSync(p,x.out);
    console.log(`${f}: ${x.n} use${x.n===1?'':'s'} ${process.argv.includes('--write')?'rewritten':'to rewrite (--write writes them)'} to HOOK.name`+(x.manual.length?'\nLeft for you:\n  '+x.manual.join('\n  '):''));
    process.exit(0)}
  /* `node tests/bridge.test.js --reads [--json]` (S6t0): per test or tool file, the bridged names it still reads as globals */
  if(process.argv.includes('--reads')){const m=measure(ROOT),r=readers(ROOT,m),b=bareReads(r),l=Object.entries(b).sort((x,y)=>x[0]<y[0]?-1:1);
    if(process.argv.includes('--json')){console.log(JSON.stringify(b,null,1));process.exit(0)}
    console.log(`${l.length} test and tool files read ${l.reduce((a,[,n])=>a+n.length,0)} bridged names as globals (file-name pairs):`);for(const [f,n] of l)console.log(`  ${f}: ${n.join(', ')}`);
    process.exit(0)}
  if(process.argv.includes('--hook')){const m=measure(ROOT),r=readers(ROOT,m),hk=hookCheck(ROOT,m,r),files={};
    for(const n of hk.testOnly)for(const f of r[n].tests)(files[f]=files[f]||[]).push(n);
    if(process.argv.includes('--json')){console.log(JSON.stringify({ready:hk.ready,testOnly:hk.testOnly,missing:hk.missing,problems:hk.problems,files},null,1));process.exit(0)}
    console.log(`${hk.testOnly.length} bridged names are used by the tests only; ${hk.ready.length} of them through HOOK alone (ready to come off BRIDGE)`+(hk.ready.length?':\n  '+hk.ready.join(', '):''));
    if(hk.missing.length)console.log('\nNot on HOOK yet: '+hk.missing.join('; '));
    if(hk.problems.length)console.log('\nProblems:\n  '+hk.problems.join('\n  '));
    const l=Object.entries(files).sort((a,b)=>a[0]<b[0]?-1:1);
    console.log(`\n${l.length} test and tool files still use some of them as globals:`);for(const [f,n] of l)console.log(`  ${f}: ${n.join(', ')}`);
    process.exit(0)}
  if(!file){console.log('node tests/bridge.test.js --plan <file.js>   what the file would bridge as a module (the test itself runs with: node tests/run.js bridge.test)');process.exit(1)}
  const p=plan(ROOT,file),short=l=>l.length>6?l.slice(0,6).join(', ')+' and '+(l.length-6)+' more':l.join(', ');
  console.log(`${file}: ${p.names.length} top-level names, ${p.used.length} used outside it, ${p.kept.length} it can keep to itself`);
  if(p.importScripts.length)console.log(`\nSTOP: ${p.importScripts.join(', ')} importScripts ${file}: it can't have \`export\` until that worker and its files move together`);
  for(const n of p.used){const u=p.use[n];console.log(`  ${n} (${p.kind.get(n)}): `+[u.page.length&&'used by '+short(u.page),u.node.length&&u.node.length+' test/tool file'+(u.node.length>1?'s':'')+' ('+short(u.node)+')',u.wpage.length&&'ASSIGNED by '+short(u.wpage),u.wnode.length&&'ASSIGNED by '+short(u.wnode)].filter(Boolean).join('; '))}
  if(p.stubbed.length)console.log(`\nDecide first: ${p.stubbed.join(', ')} ${p.stubbed.length>1?'are':'is'} assigned from outside but not a \`let\`: after Object.assign the write would replace the global only (see MODULES-RECIPE.md, "A stubbed function")`);
  console.log('\nThe file\'s last lines:');
  if(p.assign.length)console.log(`Object.assign(globalThis,{${p.assign.join(',')}});`);
  if(p.getters.length||p.setters.length)console.log(`Object.defineProperties(globalThis,{${[...p.getters.map(n=>`${n}:{get:()=>${n}}`),...p.setters.map(n=>`${n}:{get:()=>${n},set:v=>{${n}=v}}`)].join(',')}});`);
  console.log(p.used.length?`export {${p.used.join(',')}};`:'export {};');
  console.log(`\nIts row in BRIDGE:\n  '${file}':[${[...p.used].sort().map(n=>"'"+n+"'").join(',')}],`);
}
