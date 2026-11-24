// The checkers are ready for a page script that is an ES module (the ES-module move, step 1: tooling, 2026-11-22). The app's
// first modules came with step 3 (back.js, locale.js); this runs every checker on a made-up app (tests/fixtures/modtools: two classic scripts, two modules, a deferred tag,
// mistakes on purpose) and checks each finds every file and reports exactly the mistakes:
//   the shared script list and tests/modscope.js; ESLint with eslint.config.mjs's own rules; the type check (tests/typecheck.js);
//   the cross-file write check (tests/globals.test.js); the dependency ledger (tests/deps.test.js); the bridge (tests/bridge.test.js);
//   tests/appsrc.js (a module's text run as a script by the Node vm tests).
// And the app itself: every checker reads the same list and takes the same files as modules, and appSrc hands the vm tests a
// classic file's exact text (a module's with only its import and export statements blanked).
const fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');
const {scriptTags,scriptList}=require('./scriptlist');
const modscope=require('./modscope');
const {appSrc,asScript,isModule}=require('./appsrc');

module.exports=async({ok,ROOT})=>{
  const FIX=path.join(ROOT,'tests','fixtures','modtools');
  const rd=(f,root=ROOT)=>fs.readFileSync(path.join(root,f),'utf8');

  /* ---- the list: every checker reads it, and it takes module and deferred tags ---- */
  const tags=modscope.pageScripts(FIX);
  ok(tags.map(t=>t.src+(t.module?':m':'')).join()==='a.js,lib/n.js:m,m.js:m,c.js','the made-up app\'s tags are all found: a classic one, type=module written two ways, a deferred one; not the inline script or the comment');
  const readers=['eslint.config.mjs','tests/typecheck.js','tests/globals.test.js','tests/deps.test.js','tests/bridge.test.js','tests/assets.test.js'];
  const own=readers.filter(f=>{const s=rd(f);return !/require\(['"]\.\/(?:tests\/)?(?:scriptlist|modscope)(?:\.js)?['"]\)/.test(s)});
  ok(!own.length,'every checker that needs index.html\'s scripts takes them from tests/scriptlist.js (straight or through tests/modscope.js)'+(own.length?': '+own.join(', '):''));
  const html=rd('index.html'),page=scriptList(html);
  const appMods=scriptTags(html).filter(t=>t.module).map(t=>t.src);
  const wMods=['asm-worker.js','analysis-worker.js'].filter(w=>modscope.workerFiles(ROOT,w).module);   // (module workers: analysis-worker.js since 2026-11-24)
  ok(page.length>40&&appMods.length<page.length&&!appMods.includes('merge.js'),`the app's page scripts are read, its modules marked (${page.length} scripts, ${appMods.length} of them modules; merge.js, which the server imports, is not)`);

  /* ---- tests/modscope.js: what a module shares ---- */
  const src=rd('m.js',FIX),ast=modscope.parse(src,true),b=modscope.bridged(ast,src);
  ok([...b.names].map(([n,k])=>n+':'+k).join()==='label:assign,cache:accessor'&&!b.odd.length,'a module\'s bridge is read: Object.assign(globalThis, {…}) and Object.defineProperty(globalThis, name, …)');
  ok(modscope.declared(ast).map(d=>d.name+':'+d.kind).join()==='px:import,cache:let,SECRET:const,label:function,hidden:function','its own top-level names are read, exported or not, imports too');
  ok(JSON.stringify(modscope.imports(ast,'m.js'))==='[{"from":"lib/n.js","names":["px"],"odd":null}]'&&modscope.hasModuleSyntax(ast),'its imports are read, as paths from the root');
  ok(modscope.shared(FIX,'m.js',true).join()==='label,cache'&&modscope.shared(FIX,'a.js',false).join()==='count,LIMIT,bump','a module shares its bridge, a classic script every top-level name');
  const odd=s=>modscope.bridged(modscope.parse(s,true),s);
  ok(odd('Object.assign(window,{a,"b":1});self.c=2;Object.defineProperties(globalThis,{d:{get(){}}});').names.size===4&&odd('const o={};Object.assign(globalThis,o);Object.assign(globalThis,{...o});globalThis[k]=1;Object.defineProperty(globalThis,k,{})').odd.length===4,
    'window and self count too, and a bridge that can\'t be read (an object by name, a spread, a computed name) is said to be odd');
  ok(modscope.imports(modscope.parse('import d from "./x.js";import * as n from "./y.js";import {a as b} from "./z.js";import {c} from "lib";export * from "./w.js"',true),'m.js').every(i=>i.odd),'a default, namespace or renamed import, a bare path and export * are each said to be odd');

  /* ---- ESLint, with eslint.config.mjs's own rules on the made-up app ---- */
  let ESLint=null;try{({ESLint}=require('eslint'))}catch(e){}
  if(!ESLint)ok(true,'(ESLint is not installed in this checkout: its module scope was not run)');
  else{
    const cfg=(await import(pathToFileURL(path.join(ROOT,'eslint.config.mjs')).href+'?root='+encodeURIComponent(FIX))).default;
    const res=await new ESLint({cwd:FIX,overrideConfigFile:true,overrideConfig:cfg}).lintFiles(['.']);
    const by={};for(const r of res){const f=path.relative(FIX,r.filePath).split(path.sep).join('/');by[f]=r.messages.filter(m=>m.fatal||m.severity===2).map(m=>`${m.line} ${m.ruleId}${m.fatal?' '+m.message:''}`)}
    ok(Object.keys(by).sort().join()==='a.js,c.js,lib/n.js,m.js,tests/t.js','ESLint lints every file of the made-up app, the modules and the deferred script too ('+Object.keys(by).sort().join(', ')+')');
    ok(by['a.js'].length===0&&by['lib/n.js'].length===0,'a classic script and a clean module pass: import, export and the bridge are understood'+(by['a.js'].length+by['lib/n.js'].length?': '+JSON.stringify([by['a.js'],by['lib/n.js']]):''));
    ok(by['m.js'].join()==='10 no-undef,11 no-undef,11 no-undef,12 no-restricted-syntax','in a module: an assignment to an undeclared name, a typeof guard on a name that isn\'t global and `this` outside a function are errors; its import, the classic scripts\' names and its own are fine ('+by['m.js'].join(', ')+')');
    ok(by['c.js'].join()==='5 no-undef','a classic script may use what a module bridges (label, cache, px), not a name the module keeps (hidden) ('+by['c.js'].join(', ')+')');
    ok(by['tests/t.js'].join()==='2 no-undef','a test\'s page function too: bridged names are the page\'s, a module\'s own name is not ('+by['tests/t.js'].join(', ')+')');
    const strict=await new ESLint({cwd:FIX,overrideConfigFile:true,overrideConfig:cfg}).lintText('export {};\nwith(Math){}\n',{filePath:path.join(FIX,'m.js')});
    ok(strict[0].messages.some(m=>m.fatal&&/strict mode/i.test(m.message)),'a module is parsed strict (a `with` statement is a syntax error there)');
    const real=(await import(pathToFileURL(path.join(ROOT,'eslint.config.mjs')).href)).default;
    const scoped=new Set(real.filter(c=>c.files&&c.files.length===1&&c.languageOptions).map(c=>c.files[0]));
    ok(page.every(f=>scoped.has(f))&&real.every(c=>!c.files||c.files.length!==1||c.languageOptions.sourceType===(appMods.includes(c.files[0])||wMods.includes(c.files[0])?'module':'script'))&&wMods.every(f=>scoped.has(f)),'the app\'s own config gives every page script its scope: a module\'s tag makes it a module there, the others are classic (and a module worker is a module: '+(wMods.join(', ')||'none')+')');
  }

  /* ---- the type check ---- */
  let ts=null;try{ts=require('typescript')}catch(e){}
  const tc=require('./typecheck');
  ok(tc.scopes().page.files.join()===page.join()&&tc.scopes().page.mods.join()===appMods.join(),'the type check\'s page scope is the same list, with the same modules');
  if(!ts)ok(true,'(TypeScript is not installed in this checkout: its module scope was not run)');
  else{
    const r=tc.check(ts,FIX),of=f=>r.diags.filter(d=>d.file===f).map(d=>d.text.replace(/^\S+\s+/,''));
    ok(Object.keys(r.counts).join()==='page'&&!of('a.js').length&&!of('lib/n.js').length,'the type check takes the made-up app\'s modules in the page\'s program: the classic script and the clean module have no error'+(of('a.js').length+of('lib/n.js').length?': '+[...of('a.js'),...of('lib/n.js')].join(' | '):''));
    const names=l=>[...new Set(l.flatMap(t=>(t.match(/'([A-Za-z_$][\w$]*)'/g)||[]).map(x=>x.slice(1,-1))))].sort().join();
    ok(names(of('m.js').filter(t=>/TS2304|TS2552/.test(t)))==='gone,undeclared'&&!/bump|LIMIT|px|count/.test(of('m.js').join()),'in a module the undeclared names are errors, and its import and the classic scripts\' globals resolve ('+of('m.js').join(' | ')+')');
    ok(names(of('c.js'))==='hidden','a classic script sees the bridged names and not the module\'s own ('+of('c.js').join(' | ')+')');
    const dts=r.dts.split('\n').filter(l=>/^declare/.test(l)).map(l=>l.replace(/^declare var (\S+): any;$/,'$1'));
    ok(['cache','label','px'].every(n=>dts.includes(n))&&!['hidden','SECRET','UNIT','bump','count'].some(n=>dts.includes(n)),'globals.d.ts would declare the bridged names, and not a module\'s own names or a classic script\'s ('+dts.join(', ')+')');
  }

  /* ---- the cross-file write check, the ledger and the bridge ---- */
  const g=require('./globals.test.js').measure(FIX);
  ok(g.owner.count==='a.js'&&g.owner.bump==='a.js'&&g.owner.label==='m.js'&&g.owner.cache==='m.js'&&g.owner.px==='lib/n.js'&&!('hidden' in g.owner)&&!('LIMIT' in g.owner),'shared state has an owner across the move: a classic script its `let`s and functions, a module what it bridges');
  ok(JSON.stringify(g.seen)==='{"count":{"m.js":1,"c.js":1},"cache":{"c.js":1}}','a write to another file\'s state is counted from a module, and to a module\'s bridged `let` ('+JSON.stringify(g.seen)+')');
  const D=require('./deps.test.js'),d=D.measure(FIX),inOrder=o=>Object.fromEntries(Object.entries(o).sort().map(([k,v])=>[k,Array.isArray(v)?v:inOrder(v)]));
  ok(JSON.stringify(inOrder(d.uses))==='{"a.js":{},"c.js":{"a.js":["bump","count"],"lib/n.js":["px"],"m.js":["cache","label"]},"lib/n.js":{},"m.js":{"a.js":["LIMIT","bump","count"],"lib/n.js":["px"]}}',
    'the ledger keeps a module\'s row: the globals it uses, the file it imports from, and what others use of its bridge ('+JSON.stringify(d.uses)+')');
  ok(JSON.stringify(D.edgesOf(D.measure(ROOT).uses))===JSON.stringify(JSON.parse(rd('tests/deps.json')).files),'and the app\'s ledger is as committed');
  const B=require('./bridge.test.js'),m=B.measure(FIX);
  ok(JSON.stringify(m.bridge)==='{"lib/n.js":["px"],"m.js":["cache","label"]}'&&m.mods.join()==='lib/n.js,m.js','the bridge lists each module\'s bridged names');
  ok(m.unbridged.join()==='c.js uses hidden, which m.js declares and doesn\'t bridge'&&!m.problems.length,'a global use of a name a module keeps to itself is found, the typeof guard ESLint can\'t see included ('+m.unbridged.join('; ')+')');
  /* the structural mistakes, each in a copy of the made-up app */
  const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'dw-modtools-'));
  try{
    const put=(f,s)=>{fs.mkdirSync(path.dirname(path.join(tmp,f)),{recursive:true});fs.writeFileSync(path.join(tmp,f),s)};
    put('index.html','<script src="a.js"></script><script type="module" src="p.js"></script><script type="module" src="q.js"></script><script src="r.js"></script>');
    put('a.js','let count=0;function bump(){}');
    put('p.js','function f(){}\nconst o={f};\nObject.assign(globalThis,{...o});\nObject.assign(globalThis,{bump:f,dup:1});');
    put('q.js','import {x} from "./r.js";import y from "./p.js";import {z} from "./gone.js?v=2";\nObject.assign(globalThis,{dup:2});');
    put('r.js','function late(){}');
    put('analysis-worker.js',"importScripts('a.js','q.js');");
    const p=B.measure(tmp).problems,has=re=>p.some(t=>re.test(t));
    ok(has(/^p\.js is loaded as a module but has no import or export/)&&has(/^p\.js: a bridge statement the checkers can't read/)&&has(/^bump is bridged by p\.js and also declared at its top level by a\.js/)&&has(/^dup is bridged by q\.js and also bridged by p\.js/)
      &&has(/^q\.js imports r\.js, which is not a type="module" script/)&&has(/^q\.js: its import from p\.js is a default import/)&&has(/^q\.js: its import from gone\.js is not a plain relative path/)&&has(/^analysis-worker\.js importScripts q\.js/)&&p.length===8,
      'the bridge check names a module tag without module syntax, an unreadable bridge, a name bridged twice or over a classic script\'s, an import of a classic script, a default import, a path with a query, and a worker that importScripts a module ('+p.join(' | ')+')');
    /* the bridge's own mistakes (step 3): how a name is handed over, a write nobody would see, a module the service worker lacks */
    for(const f of ['p.js','q.js','r.js','analysis-worker.js'])fs.rmSync(path.join(tmp,f));
    put('index.html','<script src="a.js"></script><script type="module" src="s.js"></script><script type="module" src="lib/u.js"></script><script src="t.js" defer></script>');
    put('s.js','import {deep} from "./lib/u.js";\nlet n=0,open=false,w=0,seen=1,kept=2;const K=1;function f(){return deep}function stub(){}\n'
      +'Object.assign(globalThis,{n,f,stub});\n'
      +'Object.defineProperties(globalThis,{open:{get:()=>open},K:{get:()=>K},g:{get:()=>n+1},w:{get:()=>w,set:v=>{n=v}},seen:{get(){return seen},set(v){seen=v}},kept:{get:()=>kept}});\n'
      +'Object.defineProperty(globalThis,"late",{set:v=>{w=v}});\nexport {f};');
    put('lib/u.js','export const deep=1;');
    put('t.js','function go(){open=true;seen=2;stub=null;return kept}');
    put('tests/x.test.js','const local=()=>{let seen=0;seen++;return seen};\nmodule.exports=async p=>{await p.evaluate(()=>{open=false;seen=3;window.stub=()=>1;f();bump()});local()};');
    put('tests/fixtures/y.js','open=1;kept=1;');put('tools/z.js','module.exports=p=>p.evaluate(()=>{open++})');
    put('sw.js',"const ASSETS=['./','index.html','a.js','s.js','u.js','t.js'];");
    const s=B.measure(tmp),hasS=re=>s.problems.some(t=>re.test(t));
    ok(hasS(/^s\.js: n is a `let` handed over with Object\.assign/)&&hasS(/^s\.js: K has a getter but is not a `let`/)&&hasS(/^s\.js: the bridge of g needs `get: \(\) => g`/)&&hasS(/^s\.js: the setter of w must be/)&&hasS(/^s\.js: the bridge of late needs .*no getter/)&&s.problems.length===5,
      'the bridge check names a `let` handed over as a copy, a getter on a constant, a getter that gives something else back, a setter that assigns another name, and a setter with no getter; a plain getter, with or without a setter, passes ('+s.problems.join(' | ')+')');
    ok(s.unseen.length===2&&s.unseen.some(t=>/^open is assigned by t\.js, tests\/x\.test\.js, tools\/z\.js, but s\.js bridges it with a getter only/.test(t))&&s.unseen.some(t=>/^stub is assigned by t\.js, tests\/x\.test\.js, but s\.js hands it over with Object\.assign/.test(t)),
      'a write to a bridged name with no setter is found in a classic script, a test\'s page function and a tool (name = …, name++, window.name = …), not in the fixtures; a write through a setter, a read and a test\'s own variable of that name are fine ('+s.unseen.join(' | ')+')');
    ok(s.assets.join()==='lib/u.js is a module and not in sw.js ASSETS under that spelling','a module that sw.js ASSETS lacks under its exact spelling is named ('+s.assets.join(' | ')+')');
    const acc=modscope.bridged(modscope.parse(fs.readFileSync(path.join(tmp,'s.js'),'utf8'),true)).acc;
    ok(JSON.stringify(acc.get('open'))==='{"get":true,"set":false,"reads":"open","writes":null}'&&JSON.stringify(acc.get('seen'))==='{"get":true,"set":true,"reads":"seen","writes":"seen"}'&&acc.get('g').reads===null&&acc.get('w').writes==='n',
      'tests/modscope.js reads each accessor as written: whether it has a getter and a setter, and the name each hands on');
  }finally{fs.rmSync(tmp,{recursive:true,force:true})}

  /* ---- tests/appsrc.js: app files as scripts for the Node vm tests ---- */
  const all=[...new Set([...page,'analysis-worker.js','asm-worker.js','sw.js'])],mods=[...appMods,...wMods];
  ok(all.filter(f=>!mods.includes(f)).every(f=>{const s=rd(f);return asScript(s,f)===s&&!isModule(s)}),`every classic app script comes back from asScript as the very same text (${all.length-mods.length} files)`);
  ok(mods.every(f=>{const s=rd(f),o=asScript(s,f);return isModule(s)&&o!==s&&o.length===s.length&&o.split('\n').length===s.split('\n').length&&!/^\s*(?:import|export)\b/m.test(o)&&(()=>{try{new vm.Script(o);return true}catch(e){return false}})()}),
    `each of the app's modules comes back with only its import and export statements blanked, a script the Node tests can run (${mods.join(', ')||'none'})`);
  ok(appSrc(ROOT,'merge.js')===rd('merge.js')&&appSrc(ROOT,'merge.js','srgb.js')===rd('merge.js')+asScript(rd('srgb.js'),'srgb.js')&&appSrc(ROOT,'merge.js','core.js')===rd('merge.js')+asScript(rd('core.js'),'core.js'),'appSrc joins the files as the vm tests did: a classic script as it is (merge.js), a module as asScript gives it (merge.js + srgb.js, merge.js + core.js)');
  const tpl='const t=`\nexport const a=1\nimport x from "y"\n`;// export {t}';
  ok(asScript(tpl)===tpl&&!isModule(tpl),'a script with the words at the start of a line inside a template is left alone');
  const mod=rd('m.js',FIX),out=asScript(mod,'m.js');
  ok(isModule(mod)&&out.length===mod.length&&out.split('\n').length===mod.split('\n').length&&!/^\s*(?:import|export)\b/m.test(out)&&/^       function label\(n\)/m.test(out),
    'a module\'s import and export statements are blanked with spaces: the declarations stay, on the same lines and columns');
  const ctx=vm.createContext({});
  vm.runInContext(appSrc(FIX,'a.js','lib/n.js','m.js','c.js')+';this.K={show,reset,read:()=>[cache.n,count],px,UNIT}',ctx);
  const first=ctx.K.show();ctx.K.reset();
  ok(first==='2px/3 2px 2'&&JSON.stringify(ctx.K.read())==='[0,5]'&&ctx.cache.n===0&&ctx.K.UNIT==='px','the made-up app\'s scripts and modules run together in one vm context, imported names and the bridge working ('+first+')');
  const thrown=s=>{try{asScript(s,'x.js');return ''}catch(e){return e.message}};
  ok([['export default function(){}','a default export'],['import d from "./a.js"','a default import'],['import * as n from "./a.js"','a namespace import'],['import {a as b} from "./a.js"','an import under another name'],
    ['const a=1;export {a as b}','an export under another name'],['export * from "./a.js"','export \\* from'],['export {a} from "./a.js"','export … from']].every(([s,why])=>new RegExp("can't run x\\.js as a script: "+why).test(thrown(s))),
    'what a script can\'t stand in for (a default or renamed export or import, a namespace import, export from) throws, naming the file');
  const users=fs.readdirSync(path.join(ROOT,'tests')).filter(f=>f.endsWith('.test.js')&&f!=='modtools.test.js'&&/vm\.runIn(?:New)?Context\(/.test(rd('tests/'+f))&&/readFileSync\([^)]*ROOT[^)]*\.js'/.test(rd('tests/'+f).split('\n').filter(l=>/vm\.runIn/.test(l)).join('\n')));
  ok(!users.length,'no vm test reads an app script straight into vm any more: they go through appSrc'+(users.length?' ('+users.join(', ')+')':''));
};
