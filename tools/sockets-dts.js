// The typed socket registry, types/sockets.d.ts (the notice board made clean, N1, 2026-11-27): written from the page files' own
// serve(...) lines, so it can't drift from them. Nothing in it runs: bus.js names it only in JSDoc, and tsc (tests/typecheck.js) reads it.
//
//   node tools/sockets-dts.js            write types/sockets.d.ts
//   node tools/sockets-dts.js --check    exit 1 when the committed copy is not what the files give (tests/bus.test.js runs the same)
//
// Each socket's entry is the served function's own type: `typeof import('../x.js').fn` when the file serves a name it exports; an
// inline answer `()=>name` (a constant or a `let` the file exports) is `() => typeof import('../x.js').name`, `(...a)=>fn(...a)` is fn's
// own; any other inline arrow is written out below (WRITTEN). Each entry carries tests/bus.test.js SOCKETS' `what` as its JSDoc.
//   interface Sockets   every socket (serve, ask, askFor, served take its names)
//   interface Needs     the sockets asked with need or needFn (they take only these names, so a required call stays visible)
//   interface Hooks     the lifecycle moments of bus.js register/runHooks (HOOKS below), with the arguments each hook is called with
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),OUT='types/sockets.d.ts';

/* inline answers whose type can't be read from an export: written out */
const WRITTEN={
  'fav-ward':'() => boolean',
  'ward-pending-restore':'() => void',
  'ward-synced':'(m: any) => void',
  'sync-stop':'() => void',
  'paper-tip':'() => void',
  'kit-shown':'() => boolean',
  'kit-home-close':'() => void',
  'setup-conn-draw':'() => void',
  'asm-hb-lift':'() => [number, number]',
};

/* the lifecycle moments (bus.js register/runHooks; owner decision D1: a feature that didn't load registered nothing and is absent).
   N2 moves the survey's lifecycle sockets and topics onto them; the signature is what core passes each feature's hook. P is the part's
   named slots, filled in by each feature (P.calBanner = …), so core places them where they are on main */
const HOOKS=[
  ['start-checks','() => void','start-up, before Today is drawn: the one-time checks and moves (plan rules, learn drop, vests, old imports, the sample)'],
  ['start-jobs','() => void','start-up, after Today is drawn: the background jobs (setup, holidays, the painter\'s load and sync)'],
  ['start-safety','() => void','safety.js safetyStart\'s parts: an Add card or a Wardrobe change put back, the Safari reminder'],
  ['after-pull-fixups','() => any','the start-up fix-ups that wait for the first pull, awaited one by one in load order (runHooksSeq): recolor, close-ups, photos, backdrops, small photos'],
  ['synced','(m: any) => void','a sync brought changes (m: the merged data): each feature takes its part'],
  ['settings-open','() => void','Settings is opening'],
  ['settings-draw','() => void','Settings is drawn: each part draws its own rows'],
  ['settings-parts','() => void','the Settings parts drawn last'],
  ['settings-summary','(S: Record<string, any>) => void','the category summaries are written: each part fills in S what only it knows'],
  ['settings-category','(key: string) => void','a Settings category opened (its key)'],
  ['settings-saved','() => void','the settings were stored'],
  ['connection-saved','() => void','Done stored the connection'],
  ['connection-typed','(url: string, token: string) => void','another address or code typed in Connection'],
  ['pictures-switched','() => void','Painted pictures or Drawing only chosen'],
  ['page-shown','(page: string) => void','a page is shown (its name)'],
  ['today-parts','(P: Record<string, any>, o: any, day: any) => void','Today is drawn (o: the outfit, day: the day shown): each feature fills its named slot in P'],
  ['today-fold','() => void','Today folds everything (another day, a swipe)'],
  ['insights-cards','(P: Record<string, any>) => void','Insights is drawn: each feature fills its named card slot in P'],
  ['item-sheet-parts','(P: Record<string, any>, it: any) => void','the item sheet is drawn for the piece it: each feature fills its named slot in P'],
  ['wardrobe-tile','(P: Record<string, any>, it: any) => void','a Wardrobe tile is drawn for the piece it: each feature fills its named slot in P'],
  ['add-card-sections','(P: Record<string, any>, q: any) => void','an Add card\'s sections are drawn for the card q: each feature fills its named slot in P'],
  ['card-saved','(q: any, it: any) => void','an Add card q was saved as the piece it'],
  ['sync-send','(st: any) => void','a sync is sending the state st: each feature takes its part (the kit\'s share filter and stamps)'],
];

const pageFiles=root=>[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
const parse=src=>{const acorn=require('acorn');try{return acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'})}catch(e){return acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'})}};
const walk=(n,f)=>{if(!n||typeof n.type!=='string')return;f(n);for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(x=>walk(x,f));else if(v&&typeof v.type==='string')walk(v,f)}};
/* the names a module exports under their own name */
function exportsOf(ast){const out=new Set();
  for(const st of ast.body){if(st.type!=='ExportNamedDeclaration'||st.source)continue;
    for(const s of st.specifiers){const l=s.local.name,e=s.exported.name;if(l===e)out.add(e)}
    const d=st.declaration;if(!d)continue;
    if(d.id)out.add(d.id.name);for(const v of d.declarations||[])if(v.id.type==='Identifier')out.add(v.id.name)}
  return out}

/* every socket on the checkout: {name: {file, type, need}} in page order, then line order */
function survey(root=ROOT){
  const S=new Map(),needs=new Set(),errs=[];
  for(const f of pageFiles(root)){if(f==='bus.js')continue;const src=fs.readFileSync(path.join(root,f),'utf8');let ast;try{ast=parse(src)}catch(e){continue}
    const imp=new Map(ast.body.filter(s=>s.type==='ImportDeclaration'&&s.source.value==='./bus.js').flatMap(s=>s.specifiers.map(x=>[x.local.name,x.imported?x.imported.name:x.local.name])));
    if(!imp.size)continue;const ex=exportsOf(ast);
    // (where a name comes from: the file's own export, or an import of another page file's export under its own name)
    const from=new Map(ast.body.filter(s=>s.type==='ImportDeclaration'&&/^\.\/[\w./-]+\.js$/.test(s.source.value))
      .flatMap(s=>s.specifiers.filter(x=>x.imported&&x.imported.name===x.local.name).map(x=>[x.local.name,`'../${s.source.value.slice(2)}'`])));
    for(const n of ex)from.set(n,`'../${f}'`);
    const has={has:n=>from.has(n)},ti=n=>`typeof import(${from.get(n)}).${n}`;
    // (a `let` that starts as null or undefined has no type tsc can hand to another file (`typeof` gives unknown there): its answer is any)
    const loose=new Set();
    for(const st of ast.body){const d=st.type==='ExportNamedDeclaration'?st.declaration:st;if(!d||d.type!=='VariableDeclaration'||d.kind!=='let')continue;
      for(const v of d.declarations)if(v.id.type==='Identifier'&&(!v.init||(v.init.type==='Literal'&&v.init.value===null)||(v.init.type==='Identifier'&&v.init.name==='undefined')))loose.add(v.id.name)}
    const ans=n=>loose.has(n)&&from.get(n)===`'../${f}'`?'any':ti(n);
    walk(ast,n=>{if(n.type!=='CallExpression'||n.callee.type!=='Identifier')return;const op=imp.get(n.callee.name),a=n.arguments[0];
      if(!op||!a||a.type!=='Literal'||typeof a.value!=='string')return;
      if(op==='need'||op==='needFn')needs.add(a.value);
      if(op!=='serve')return;const fn=n.arguments[1],name=a.value;let type=null;
      if(WRITTEN[name])type=WRITTEN[name];
      else if(fn.type==='Identifier'&&has.has(fn.name))type=ti(fn.name);
      else if(fn.type==='ArrowFunctionExpression'&&!fn.params.length&&fn.body.type==='Identifier'&&has.has(fn.body.name))type=`() => ${ans(fn.body.name)}`;
      else if(fn.type==='ArrowFunctionExpression'&&!fn.params.length&&fn.body.type==='MemberExpression'&&!fn.body.computed&&fn.body.object.type==='Identifier'&&has.has(fn.body.object.name))
        type=`() => ${ti(fn.body.object.name)}['${fn.body.property.name}']`;
      else if(fn.type==='ArrowFunctionExpression'&&fn.params.length===1&&fn.params[0].type==='RestElement'&&fn.body.type==='CallExpression'&&fn.body.callee.type==='Identifier'&&has.has(fn.body.callee.name))
        type=ti(fn.body.callee.name);
      if(!type)errs.push(`${f}: serve('${name}', ${src.slice(fn.start,Math.min(fn.end,fn.start+60))}) serves no exported name: export it, or write its type in tools/sockets-dts.js WRITTEN`);
      if(S.has(name))errs.push(`'${name}' is served by ${S.get(name).file} and ${f}`);
      else S.set(name,{file:f,type})})}
  for(const n of Object.keys(WRITTEN))if(!S.has(n))errs.push(`tools/sockets-dts.js WRITTEN has '${n}', which nothing serves`);
  return {S,needs,errs};
}

const doc=s=>'  /** '+String(s).replace(/\*\//g,'* /').replace(/\s+/g,' ').trim()+' */\n';
/* the file's text, or {errs} */
function generate(root=ROOT){
  const {S,needs,errs}=survey(root);if(errs.length)return {errs};
  let what={};try{what=require(path.join(root,'tests','bus.test.js')).SOCKETS||{}}catch(e){}
  const q=n=>`'${n}'`;
  let t='// Generated by `node tools/sockets-dts.js` from the page files\' serve(...) lines: do not edit by hand (tests/bus.test.js fails while\n'+
    '// it differs). The typed registry of bus.js\'s sockets and hooks: nothing here runs, bus.js names it only in JSDoc.\n'+
    '// One entry per socket, in the serving file\'s load order: the served function\'s own type, so a wrong name, a missing or extra\n'+
    '// argument, an argument of the wrong type or a misspelled answer field is a type error at the caller (npm run typecheck).\n\n';
  t+='/** the arguments a caller must pass to F: a parameter typed any (`@param {*} x`) is {} here, since in a JS file without strict\n'+
    ' * null checks tsc lets a call leave out an argument typed any; {} takes every value, but a left-out argument is an error */\n'+
    'export type Args<F> = F extends (...a: infer P) => any ? {[I in keyof P]: unknown extends P[I] ? {} : P[I]} : never;\n\n';
  t+='/** every socket: serve, ask, askFor and served take these names */\nexport interface Sockets {\n';
  for(const [n,s] of S)t+=doc(`${(what[n]&&what[n].what)||''} (${s.file})`)+`  ${q(n)}: ${s.type};\n`;
  t+='}\n\n/** the sockets asked with need or needFn, which take only these names (a required call stays visible) */\nexport interface Needs {\n';
  for(const n of [...S.keys()].filter(n=>needs.has(n)))t+=`  ${q(n)}: Sockets[${q(n)}];\n`;
  t+='}\n\n/** the lifecycle moments: bus.js register(feature, {name: fn}) and runHooks(name, ...args) */\nexport interface Hooks {\n';
  for(const [n,sig,w] of HOOKS)t+=doc(w)+`  ${q(n)}: ${sig};\n`;
  t+='}\n';
  return {text:t,count:S.size,needs:[...needs].length,hooks:HOOKS.length};
}

if(require.main===module){const r=generate();
  if(r.errs){console.log('sockets-dts:\n  '+r.errs.join('\n  '));process.exitCode=1}
  else{const file=path.join(ROOT,OUT),old=fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'):'';
    if(process.argv.includes('--check')){if(old!==r.text){console.log(`sockets-dts: ${OUT} is not what the serve lines give: run \`node tools/sockets-dts.js\` and commit it.`);process.exitCode=1}
      else console.log(`sockets-dts: ${OUT} is up to date (${r.count} sockets, ${r.needs} needs, ${r.hooks} hooks)`)}
    else{fs.writeFileSync(file,r.text);console.log(`sockets-dts: wrote ${OUT} (${r.count} sockets, ${r.needs} needs, ${r.hooks} hooks)`)}}}
module.exports={generate,survey,HOOKS,WRITTEN,OUT};
