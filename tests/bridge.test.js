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
const fs=require('fs'),path=require('path');
const acorn=require('acorn'),escope=require('eslint-scope');
const modscope=require('./modscope');

/* file -> the names it bridges onto globalThis. Rows are added by the pull request that converts the file; after that they only shrink */
const BRIDGE={
  // the pages and sheets that Back closes are classic scripts: add-sheet, colpick, history, item-view, kit, settings, setup, shop,
  // start, ui and account call these. appHist, appKind and itemHist are read by the tests only (back, backgesture, shellfix): getters
  'back.js':['appHist','appKind','backBorrow','backDrop','backHold','backKind','backLand','backOn','backOver','backPush','backReturn','backSettled','backWanted','histDrop','histPush','itemHist'],
  // history.js (firstReal, missedNote) and today.js (missedCard) are classic scripts; the rest are called by the todayacts and weeklock tests
  'missed.js':['firstReal','missedCard','missedNote','missedOne','missedOpen','missedPickToggle','missedPut'],
  // cost.js formats money in the app's language
  'locale.js':['APP_LOC'],
  // settings.js, stats.js, start.js, add-card.js, add-save.js, shop.js and kit.js are classic scripts; vestMigrating is read by the
  // dress test only: a getter
  'dress.js':['dressNewItem','dressSummary','dressSynced','dressWhyUnused','migrateVests','newSuitVest','renderDressUI','vestMigrating'],
  // settings.js (calSummary) and today.js (calBanner) are classic scripts; the rest are read by the calendar test, calBusy by the
  // restacts test only: a getter
  'calendar.js':['CAL_GUIDES','CAL_X','calBanner','calBusy','calGuide','calNew','calPlan','calSummary','renderCalUI'],
};
/* file -> names its row gained after its conversion (each with the reason beside it); every one is in BRIDGE too */
const GROWN={
};
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
  for(const r of g.through)if(r.isWrite()&&!own.has(r.identifier.name))add(r.identifier.name);
  for(const m of src.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/g))add(m[1]);
  return out;
}

/* {page, mods, bridge: {file: [names]}, problems: [text], unbridged: [text], unseen: [text], assets: [text]} for the app in ROOT */
function measure(ROOT){
  const tags=modscope.pageScripts(ROOT),page=tags.map(t=>t.src),mods=tags.filter(t=>t.module).map(t=>t.src),isMod=new Set(mods);
  const problems=[],bridge={},info={},srcs={},how={},spelled={};
  for(const f of page){const m=isMod.has(f),src=srcs[f]=fs.readFileSync(path.join(ROOT,f),'utf8');let ast;
    try{ast=modscope.parse(src,m)}catch(e){if(m)problems.push(`${f} doesn't parse as a module: ${e.message}`);continue}   // (a classic script that doesn't parse is ESLint's to report)
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:m?'module':'script'}).globalScope,own=new Set(g.variables.map(v=>v.name));
    info[f]={top:modscope.declared(ast).map(d=>d.name),free:[...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
    if(!m)continue;
    const b=modscope.bridged(ast,src),kind=new Map(modscope.declared(ast).map(d=>[d.name,d.kind]));bridge[f]=[...b.names.keys()].sort();
    for(const o of b.odd)problems.push(`${f}: a bridge statement the checkers can't read (name each property plainly): ${o}`);
    if(!modscope.hasModuleSyntax(ast))problems.push(`${f} is loaded as a module but has no import or export: add \`export {}\`, so TypeScript and tests/appsrc.js see a module too`);
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
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;
    const m=/importScripts\(([^)]*)\)/.exec(fs.readFileSync(path.join(ROOT,w),'utf8'));
    for(const x of m?[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]):[])if(isMod.has(x))problems.push(`${w} importScripts ${x}, which the page loads as a module`)}
  /* a write to a bridged name from outside its file: seen by the module only through a setter */
  const unseen=[];
  if(Object.keys(how).length){const by={};
    const note=(f,w)=>{if(w)for(const [n,c] of w){const h=how[n];if(h&&h.file!==f&&!h.set&&(h.own||!h.assign))(by[n]=by[n]||[]).push(f+(c>1?' ('+c+')':''))}};
    for(const f of page)if(srcs[f]!=null)note(f,writesOf(srcs[f],isMod.has(f)));
    for(const f of nodeFiles(ROOT))note(f,writesOf(fs.readFileSync(path.join(ROOT,f),'utf8'),false));
    for(const [n,l] of Object.entries(by)){const h=how[n];
      unseen.push(h.assign?`${n} is assigned by ${l.join(', ')}, but ${h.file} hands it over with Object.assign: the global is replaced and ${h.file} goes on using its own (make it a \`let\` with a getter and a setter, or give ${h.file} a function for it)`
        :`${n} is assigned by ${l.join(', ')}, but ${h.file} bridges it with a getter only: add \`set: v => {${n} = v}\``)}}
  /* every module is in sw.js ASSETS as its tag and its importers spell it */
  const assets=[];
  if(mods.length&&fs.existsSync(path.join(ROOT,'sw.js'))){const a=/const ASSETS=\[([^\]]*)\]/.exec(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8')),list=new Set(a?[...a[1].matchAll(/'([^']+)'/g)].map(m=>m[1]):[]);
    for(const f of mods)for(const s of new Set([f,...(spelled[f]||[])]))if(!list.has(s))assets.push(`${s} is a module and not in sw.js ASSETS under that spelling`)}
  return {page,mods,bridge,problems,unbridged,unseen,assets};
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
};
module.exports.measure=measure;module.exports.compare=compare;module.exports.grew=grew;module.exports.writesOf=writesOf;

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
