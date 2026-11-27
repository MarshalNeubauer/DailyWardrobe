// TypeScript's checker over the app's and the server's JavaScript (`npm run typecheck`; also in `npm run lint` and the pre-push hook).
// Nothing is written by hand and nothing is built: tsc reads the plain JavaScript (and its JSDoc) with tsconfig.json's options
// (allowJs, checkJs, not strict), and only reports.
//
// The scopes are read from the sources on every run, as eslint.config.mjs reads them, so they can't drift:
//   page      index.html's scripts, in order: one shared global scope (lib DOM). A script whose tag is type="module" (none yet) is
//             checked as an ES module in this same program: its top-level names are its own, and the names it bridges onto
//             globalThis (tests/modscope.js) are declared in globals.d.ts for everyone else with their real type, the module's own
//             export (`declare var toast: typeof import('../toast.js').toast;`), so a wrong use of a bridged name is an error as it
//             was before the file became a module; a bridged name the file doesn't export stays `any`
//   asm       asm-worker.js and what it importScripts (lib WebWorker)
//   analysis  analysis-worker.js and what it importScripts (lib WebWorker)
//   sw        sw.js (lib WebWorker); it reads globals.d.ts with every name `any` (an in-memory copy): a `typeof import` there pulls
//             the page's modules into sw.js's program, about 1,000 errors of page code checked as worker code
//   server    worker.js and its ES modules in worker/ (merge.js comes in through its import)
// A Web Worker's scope and the server report only their own files: the files the page also loads (and merge.js) are counted in the
// page's scope, since code that runs only on the page can't be told from code the worker calls (assemble.js reads the page's
// `renders` in functions the worker never runs).
//
// types/globals.d.ts declares the names no script declares at its top level but the scripts read: those put on window/self/
// globalThis from inside a function (`self.outfitMannequinSvg = …`), by the test runner (TEST_PLAN, ASM_TEST_OFF) or by a test or
// tool. It is generated from the files (--update); the check fails while the committed copy differs.
//
// tests/typecheck-baseline.json: each file's error count, per scope. It may only go down:
//   node tests/typecheck.js                 a file over its count fails (a file not listed counts 0); a file under it is named
//   node tests/typecheck.js --update        write globals.d.ts and the counts afresh; refused when the total would rise (a split
//                                           that moves errors into a new file keeps the total, so it is taken)
//   node tests/typecheck.js --changed       the pre-push check: nothing when the branch changed no script, else the check, and the
//                                           baseline's total must not be above origin/main's
//   node tests/typecheck.js --list [file]   every error (or one file's), then the count per error code
// Without TypeScript installed (a checkout from before it was added: run `npm install`) it says so and passes.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {scriptTags}=require('./scriptlist'),modscope=require('./modscope');
const ROOT=path.resolve(__dirname,'..');
const BASE='tests/typecheck-baseline.json',DTS='types/globals.d.ts';
const rd=(f,root=ROOT)=>fs.readFileSync(path.join(root,f),'utf8');
const rel=(f,root=ROOT)=>path.relative(root,f).split(path.sep).join('/');
const git=(...a)=>{try{return execFileSync('git',a,{cwd:ROOT,maxBuffer:1<<28,stdio:['ignore','pipe','ignore']}).toString('utf8')}catch(e){return null}};
const WEB=['lib.es2023.d.ts','lib.webworker.d.ts'];

/* the scopes, found as eslint.config.mjs finds them (root: another folder laid out like the app, for tests/modtools.test.js) */
function scopes(root=ROOT){
  const tags=scriptTags(rd('index.html',root)),page=tags.map(t=>t.src),mods=tags.filter(t=>t.module).map(t=>t.src);
  const has=f=>fs.existsSync(path.join(root,f));
  // (a worker's files: its importScripts, or a module worker's imports; a module worker's scope resolves them as modules, the page's
  // modules among its files are modules there too, and the bridged names reach it through globals.d.ts as they reach the page)
  const W=f=>{const w=modscope.workerFiles(root,f),files=w.files;
    return{files,own:files.filter(x=>!page.includes(x)),lib:WEB,...(w.module?{mods:[f,...files.filter(x=>mods.includes(x))]}:{})}};
  const S={page:{files:page,mods,lib:['lib.es2023.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']}};
  if(root!==ROOT){for(const [k,f] of [['asm','asm-worker.js'],['analysis','analysis-worker.js']])if(has(f))S[k]=W(f);return S}
  const server=['worker.js',...fs.readdirSync(path.join(ROOT,'worker')).filter(f=>f.endsWith('.js')).sort().map(f=>'worker/'+f)];
  return {...S,
    asm:W('asm-worker.js'),analysis:W('analysis-worker.js'),sw:{files:['sw.js'],lib:WEB,loose:true},
    server:{files:server,own:server,lib:WEB,module:true}};
}

/* the generated declarations: names written on window/self/globalThis anywhere (the scripts, the test runner's page scripts, the
   tests and tools) that no classic script declares at its top level and the platform doesn't have */
function globalsDts(ts,S,root=ROOT){
  const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
  // (a page module's top-level names are not the page's: only its bridge is, added to `put` below)
  const mods=S.page.mods||[],classic=[...new Set(Object.values(S).filter(s=>!s.module).flatMap(s=>s.files))].filter(f=>!mods.includes(f));
  const top=new Set();
  for(const f of classic)for(const st of ts.createSourceFile(f,rd(f),ts.ScriptTarget.Latest,false,ts.ScriptKind.JS).statements){
    if((ts.isFunctionDeclaration(st)||ts.isClassDeclaration(st))&&st.name)top.add(st.name.text);
    else if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)for(const n of bound(ts,d.name))top.add(n)}
  const lib=new Set();const libDir=path.dirname(require.resolve('typescript/lib/lib.d.ts'));
  for(const l of ['lib.dom.d.ts','lib.webworker.d.ts','lib.es5.d.ts'])for(const m of fs.readFileSync(path.join(libDir,l),'utf8').matchAll(/^declare (?:var|function|const|let) ([A-Za-z_$][\w$]*)/gm))lib.add(m[1]);
  const list=d=>fs.existsSync(path.join(root,d))?fs.readdirSync(path.join(root,d),{recursive:true}).map(f=>(d+'/'+f).split(path.sep).join('/'))
    .filter(f=>f.endsWith('.js')&&!/^tests\/(fixtures|replay\/\.work)\//.test(f)):[];
  const put=new Set(['TEST_PLAN','ASM_TEST_OFF']),W=/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
  for(const f of [...classic,...mods,'tests/fixedplan.js'])if(fs.existsSync(path.join(root,f)))for(const m of rd(f).matchAll(W))put.add(m[1]);
  // (a module's bridged name gets the type of the module's export of that name: `typeof import('../x.js').name`)
  const own=new Map();
  for(const f of mods){for(const n of modscope.shared(root,f,true))put.add(n);
    for(const n of exported(root,f))own.set(n,f)}
  // a test's or tool's own page helpers (`window.__t = …`) only when a script reads the name off window/self/globalThis (a test's
  // switch such as ASM_NO_WORKER): declaring them all would hide a typo of a local `base` or `lines` in the app
  const read=new Set([...classic,...mods].flatMap(f=>[...rd(f).matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)/g)].map(m=>m[1])));
  for(const f of [...list('tests'),...list('tools')])for(const m of rd(f).matchAll(W))if(read.has(m[1]))put.add(m[1]);
  // the documented global set (tests/bridge.test.js GLOBALS) that a script reads off window/self/globalThis, also a switch nothing in the
  // repo sets yet (DW_ANDROID, DW_BROWSER, SETT_DEBUG): bridge.test reads those names in the code's text, so the code keeps `window.x`
  {const g=path.join(root,'tests','bridge.test.js'),m=fs.existsSync(g)&&fs.readFileSync(g,'utf8').match(/^const GLOBALS=\{([\s\S]*?)^\};/m);
    if(m)for(const x of m[1].matchAll(/^\s*([A-Za-z_$][\w$]*):/gm))if(read.has(x[1]))put.add(x[1])}
  const names=[...put].filter(n=>!top.has(n)&&!lib.has(n)).sort();
  const head='// Generated by `node tests/typecheck.js --update` from the scripts, tests and tools: do not edit by hand.\n'+
    '// The names put on window/self/globalThis (inside a function, by the test runner, by a test or a tool) that no script declares at its top level;\n'+
    '// a page module\'s bridged name has the type of its export.\n';
  const line=(n,typed)=>`declare var ${n}: ${typed&&own.has(n)?`typeof import('../${own.get(n)}').${n}`:'any'};`;
  // dts: the committed file; loose: every name `any`, for a scope that must not see the modules (sw)
  return {dts:head+names.map(n=>line(n,true)).join('\n')+'\n',loose:head+names.map(n=>line(n,false)).join('\n')+'\n'};
}
/* the names a module exports under their own name (`export {a, b}`, `export function a`, `export const a`) */
function exported(root,f){
  let ast;try{ast=modscope.parse(fs.readFileSync(path.join(root,f),'utf8'),true)}catch(e){return[]}
  const out=[];
  for(const st of ast.body){if(st.type!=='ExportNamedDeclaration'||st.source)continue;
    for(const s of st.specifiers){const l=s.local.name||s.local.value,e=s.exported.name||s.exported.value;if(l===e)out.push(e)}
    if(st.declaration)for(const d of modscope.declared({body:[st.declaration]}))out.push(d.name)}
  return out;
}
function bound(ts,b){if(ts.isIdentifier(b))return[b.text];const o=[];for(const e of b.elements||[])if(e.name)o.push(...bound(ts,e.name));return o}

/* every scope checked: {counts: {scope: {file: n}}, diags: [{scope, file, code, text}], dts} */
function check(ts,root=ROOT){
  const S=scopes(root),{dts,loose}=globalsDts(ts,S,root);
  const cfg=ts.readConfigFile(path.join(ROOT,'tsconfig.json'),ts.sys.readFile);if(cfg.error)throw new Error('tsconfig.json: '+ts.flattenDiagnosticMessageText(cfg.error.messageText,' '));
  const opts=ts.convertCompilerOptionsFromJson(cfg.config.compilerOptions,root).options;
  // the declarations are checked as generated (not as committed), so a stale copy fails only once, on the comparison below
  const dtsPath=path.join(root,DTS),loosePath=path.join(root,'types/globals.loose.d.ts');   // (the loose copy is never written)
  const host=ts.createCompilerHost(opts),parsed=new Map(),get=host.getSourceFile.bind(host);
  host.getSourceFile=(f,lang,...r)=>{const k=f+'|'+(typeof lang==='object'?lang.languageVersion:lang);
    if(path.resolve(f)===dtsPath)return ts.createSourceFile(f,dts,lang);   // (not cached: tiny)
    if(path.resolve(f)===loosePath)return ts.createSourceFile(f,loose,lang);
    if(!parsed.has(k))parsed.set(k,get(f,lang,...r));return parsed.get(k)};   // each file parsed once for all the scopes
  host.fileExists=(f=>p=>path.resolve(p)===dtsPath||path.resolve(p)===loosePath||f(p))(host.fileExists.bind(host));
  const counts={},diags=[];
  for(const [name,s] of Object.entries(S)){
    const o={...opts,lib:s.lib,noEmit:true};
    // (a scope with a page module resolves its imports as the server's does; the files without import or export stay global scripts)
    if(s.module||(s.mods&&s.mods.length))Object.assign(o,{module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});
    const p=ts.createProgram({rootNames:[...s.files.map(f=>path.join(root,f)),...(s.module?[]:[s.loose?loosePath:dtsPath])],options:o,host});
    const c=counts[name]={};
    for(const d of [...p.getGlobalDiagnostics(),...p.getSyntacticDiagnostics(),...p.getSemanticDiagnostics()]){
      const f=d.file?rel(d.file.fileName,root):'(options)';if(f.startsWith('node_modules/'))continue;if(s.own&&d.file&&!s.own.includes(f))continue;
      c[f]=(c[f]||0)+1;let at='';if(d.file&&d.start!=null){const {line,character}=d.file.getLineAndCharacterOfPosition(d.start);at=`:${line+1}:${character+1}`}
      diags.push({scope:name,file:f,code:d.code,text:`${f}${at}  TS${d.code}  ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`})}
  }
  return {counts,diags,dts};
}

const total=c=>Object.values(c||{}).reduce((a,s)=>a+Object.values(s).reduce((x,y)=>x+y,0),0);
/* the ratchet: what is over, what is under, against a baseline {scope: {file: n}} */
function compare(now,base){
  const over=[],under=[];
  for(const [s,files] of Object.entries(now))for(const [f,n] of Object.entries(files)){const b=(base[s]||{})[f]||0;if(n>b)over.push(`${s} ${f}: ${n} errors, ${b} allowed`)}
  for(const [s,files] of Object.entries(base))for(const [f,b] of Object.entries(files)){const n=(now[s]||{})[f]||0;if(n<b)under.push(`${s} ${f}: ${n} now, ${b} in the baseline`)}
  return {over,under};
}
const sorted=c=>Object.fromEntries(Object.keys(c).map(s=>[s,Object.fromEntries(Object.keys(c[s]).sort().map(f=>[f,c[s][f]]))]));
const readBase=()=>{try{return JSON.parse(rd(BASE)).files}catch(e){return null}};

function main(argv){
  let ts;try{ts=require('typescript')}catch(e){console.log('TypeScript is not installed in this checkout (run `npm install`): typecheck skipped.');return 0}
  if(argv.includes('--changed')){
    const base=(git('merge-base','HEAD','origin/main')||'').trim();if(!base){console.log('typecheck: no origin/main to compare with; skipped.');return 0}
    const files=(git('diff','--name-only','--no-renames',base,'HEAD')||'').split('\n').filter(Boolean);
    // (a test or tool counts too: its window.X = … can change globals.d.ts)
    if(!files.some(f=>/\.(js|d\.ts)$/.test(f)||f===BASE||f==='tsconfig.json'||f==='package.json'||f==='index.html'))return 0;
    let mainBase=null;try{mainBase=JSON.parse(git('show','origin/main:'+BASE)||'null')}catch(e){}
    const mine=readBase();
    if(mainBase&&mine&&total(mine)>total(mainBase.files)){console.log(`typecheck: the baseline's total rose from ${total(mainBase.files)} (origin/main) to ${total(mine)}: it may only go down. Fix the new errors instead.`);return 1}
  }
  const t0=Date.now(),r=check(ts),ms=Date.now()-t0,n=total(r.counts);
  if(argv[0]==='--list'){const only=argv[1];for(const d of r.diags)if(!only||d.file===only)console.log(d.scope.padEnd(9)+d.text);
    const by={};for(const d of r.diags)if(!only||d.file===only)by[d.code]=(by[d.code]||0)+1;
    console.log(Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([c,k])=>`TS${c} ${k}`).join(', '));return 0}
  const base=readBase();
  if(argv.includes('--update')){
    if(base&&n>total(base)){console.log(`typecheck: ${n} errors, above the baseline's ${total(base)}: not updated. The count may only go down; fix the new ones (\`node tests/typecheck.js --list\`).`);return 1}
    fs.mkdirSync(path.join(ROOT,path.dirname(DTS)),{recursive:true});fs.writeFileSync(path.join(ROOT,DTS),r.dts);
    fs.writeFileSync(path.join(ROOT,BASE),JSON.stringify({note:'Type errors per file and scope (tests/typecheck.js). May only go down: fix errors, then `node tests/typecheck.js --update`.',total:n,files:sorted(r.counts)},null,1)+'\n');
    console.log(`typecheck: baseline written, ${n} errors (${ms} ms)`+(base?`, was ${total(base)}`:''));return 0}
  let fail=0;
  const committed=fs.existsSync(path.join(ROOT,DTS))?rd(DTS):'';
  if(committed.replace(/\r\n/g,'\n')!==r.dts){console.log(`typecheck: ${DTS} is not what the scripts give (a name put on window was added or went): run \`node tests/typecheck.js --update\` and commit it.`);fail=1}
  if(!base){console.log(`typecheck: no ${BASE}: run \`node tests/typecheck.js --update\`.`);return 1}
  const {over,under}=compare(r.counts,base);
  if(over.length){console.log('typecheck: more type errors than the baseline allows:\n  '+over.join('\n  ')+'\nSee them with `node tests/typecheck.js --list <file>`; fix the new ones (the baseline may only go down).');fail=1}
  if(under.length)console.log('typecheck: fewer errors than the baseline (good): run `node tests/typecheck.js --update` and commit it to lock that in:\n  '+under.join('\n  '));
  console.log(`typecheck: ${n} errors, baseline ${total(base)} (${ms} ms)`);
  return fail;
}

if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={main,compare,total,scopes,check};
