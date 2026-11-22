// The bridge (the ES-module move, MODULES-PLAN.md "If the owner wants the full move anyway", step 3; this scaffold is step 1, 2026-11-22).
// A page script that becomes an ES module keeps its top-level names to itself. While other files, the tests' page.evaluate() and
// the checkers still use some of them as globals, the module hands those over at its end (tests/modscope.js reads the statements):
//   Object.assign(globalThis, {name, …})                           a function or constant
//   Object.defineProperty(globalThis, 'name', {get, set})          a `let` that another file or a test assigns
// BRIDGE below lists every bridged name, per file. No file is a module yet, so it is empty.
// - a bridged name that isn't listed fails: add the file's row in the pull request that converts the file, and say why each name
//   is still needed (who reads it);
// - a listed name that is no longer bridged fails until it is taken off: after a file's conversion its row only shrinks, down to
//   nothing when every reader imports the name and no test assigns it. The bridge is temporary.
// And the mistakes that would otherwise show only as a blank page or a silent `undefined` (Node only, about a second):
// - a file uses, as a global, a name that a module declares and doesn't bridge (`typeof name==='function'` guards too, which
//   ESLint's no-undef can't see in a classic script): import it or bridge it;
// - a module's tag without an import or export in its text (TypeScript and tests/appsrc.js go by the text: `export {}` will do);
// - a bridge statement the checkers can't read (a spread, a computed key), a name bridged twice, or one a classic script also
//   declares at its top level (the classic `let` would hide the bridged value);
// - an import that isn't a plain relative path to a page script that is itself a module with its own tag in index.html (the tag
//   is what fetches it in parallel on iOS 16.4, which has no modulepreload, and what puts it in every checker's list), or one
//   under another name, a default or a namespace import (tests/appsrc.js can't run those for the Node tests);
// - a Web Worker that importScripts a module (`export` is a syntax error there: the worker and its files move together).
// Not checked here: that a bridged name is still needed by someone (a test's page.evaluate may be its only reader); that comes
// with the bridge's removal (step 5).
const fs=require('fs'),path=require('path');
const escope=require('eslint-scope');
const modscope=require('./modscope');

/* file -> the names it bridges onto globalThis. Rows are added by the pull request that converts the file; after that they only shrink */
const BRIDGE={
};
const WORKERS=['asm-worker.js','analysis-worker.js'];
let PLATFORM=null;
const platform=()=>{if(!PLATFORM){PLATFORM=new Set();try{const g=require('globals');for(const n of Object.keys({...g.browser,...g.worker}))PLATFORM.add(n)}catch(e){}}return PLATFORM};

/* {page, mods, bridge: {file: [names]}, problems: [text], unbridged: [text]} for the app in ROOT */
function measure(ROOT){
  const tags=modscope.pageScripts(ROOT),page=tags.map(t=>t.src),mods=tags.filter(t=>t.module).map(t=>t.src),isMod=new Set(mods);
  const problems=[],bridge={},info={};
  for(const f of page){const m=isMod.has(f),src=fs.readFileSync(path.join(ROOT,f),'utf8');let ast;
    try{ast=modscope.parse(src,m)}catch(e){if(m)problems.push(`${f} doesn't parse as a module: ${e.message}`);continue}   // (a classic script that doesn't parse is ESLint's to report)
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:m?'module':'script'}).globalScope,own=new Set(g.variables.map(v=>v.name));
    info[f]={top:modscope.declared(ast).map(d=>d.name),free:[...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
    if(!m)continue;
    const b=modscope.bridged(ast,src);bridge[f]=[...b.names.keys()].sort();
    for(const o of b.odd)problems.push(`${f}: a bridge statement the checkers can't read (name each property plainly): ${o}`);
    if(!modscope.hasModuleSyntax(ast))problems.push(`${f} is loaded as a module but has no import or export: add \`export {}\`, so TypeScript and tests/appsrc.js see a module too`);
    for(const i of modscope.imports(ast,f)){
      if(i.odd)problems.push(`${f}: its import from ${i.from} is ${i.odd}`);
      else if(!isMod.has(i.from))problems.push(`${f} imports ${i.from}, which is not a type="module" script in index.html (every module has its own tag)`)}}
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
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;
    const m=/importScripts\(([^)]*)\)/.exec(fs.readFileSync(path.join(ROOT,w),'utf8'));
    for(const x of m?[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]):[])if(isMod.has(x))problems.push(`${w} importScripts ${x}, which the page loads as a module`)}
  return {page,mods,bridge,problems,unbridged};
}
/* the ratchet: bridged names the list doesn't have (fresh), listed names no longer bridged (gone) */
function compare(now,base){
  const fresh=[],gone=[];
  for(const [f,l] of Object.entries(now))for(const n of l)if(!(base[f]||[]).includes(n))fresh.push(f+': '+n);
  for(const [f,l] of Object.entries(base))for(const n of l)if(!(now[f]||[]).includes(n))gone.push(f+': '+n);
  return {fresh,gone};
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

  /* the app */
  const m=measure(ROOT),c=compare(m.bridge,BRIDGE),n=Object.values(m.bridge).reduce((a,l)=>a+l.length,0);
  ok(m.page.length>40,`the page scripts read (${m.page.length} scripts, ${m.mods.length} of them ES modules, ${n} bridged names)`);
  ok(!c.fresh.length,'every bridged name is listed in BRIDGE'+(c.fresh.length?' (add it in tests/bridge.test.js with who still reads it: '+c.fresh.join('; ')+')':''));
  ok(!c.gone.length,'the bridge only shrinks: every listed name is still bridged'+(c.gone.length?' (take them off BRIDGE in tests/bridge.test.js: '+c.gone.join('; ')+')':''));
  ok(!m.unbridged.length,'no file uses, as a global, a name a module keeps to itself'+(m.unbridged.length?': '+m.unbridged.join('; ')+' (import it, or bridge it and list it)':''));
  ok(!m.problems.length,'every module has module syntax, a bridge the checkers can read, plain relative imports of other page modules, and no Web Worker importScripts it'+(m.problems.length?': '+m.problems.join('; '):''));
};
module.exports.measure=measure;module.exports.compare=compare;
