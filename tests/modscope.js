// What a page script that is an ES module shares with the others (the ES-module move, step 1: tooling, 2026-11-22).
// A classic script's top-level names are the page's globals. A module's are its own: the other scripts, the tests' page.evaluate
// and the checkers see only what it puts on the global object (its bridge) or exports. Every checker asks here, so they agree:
// eslint.config.mjs, tests/typecheck.js, tests/globals.test.js, tests/deps.test.js, tests/bridge.test.js.
//
// A page script is a module when its tag says so (`<script type="module" src=…>`: tests/scriptlist.js), never by its text.
// The bridge is read only where it is written as a statement at the top level of the file:
//   Object.assign(globalThis, {name, other: value})        'assign': the name's value at that moment (functions, constants)
//   globalThis.name = value                                 'assign'
//   Object.defineProperty(globalThis, 'name', {get, set})   'accessor': a `let` others or the tests write
//   Object.defineProperties(globalThis, {name: {get, set}}) 'accessor'
// (globalThis, window or self.) Anything else there (a spread, a computed key) is `odd`: tests/bridge.test.js fails on it, since
// a name the checkers can't read is a name they would lose without a word.
//
//   pageScripts(root)        [{src, module}] of index.html, in order
//   parse(src, module, opt)  acorn's tree (ranges on)
//   declared(ast)            [{name, kind}] the file's top-level names (kind: function, class, let, const, var, import), exported or not
//   bridged(ast)             {names: Map name -> 'assign'|'accessor', odd: [text], acc: Map name -> {get, set, reads, writes}}
//                            (acc: each accessor as written: whether it has a getter and a setter, and the one name each hands on;
//                            tests/bridge.test.js wants `get:()=>name`, and `set:v=>{name=v}` when anything outside the file writes it)
//   imports(ast, file)       [{from, names, odd}] its `import … from` and `export … from` (from: the path from the root, '/' separated)
//   hasModuleSyntax(ast)     it has an import or an export (what TypeScript and Node go by)
//   shared(root, file, module)  the names the file gives the page's global scope: every top-level name of a classic script, a
//                            module's bridge; [] when it doesn't parse (ESLint reports the syntax error)
const fs=require('fs'),path=require('path');
const acorn=require('acorn');
const {scriptTags}=require('./scriptlist');
const G=n=>!!n&&n.type==='Identifier'&&/^(?:globalThis|window|self)$/.test(n.name);

const pageScripts=root=>scriptTags(fs.readFileSync(path.join(root,'index.html'),'utf8'));
const parse=(src,module,opt)=>acorn.parse(src,{ecmaVersion:'latest',sourceType:module?'module':'script',ranges:true,...opt});

const patNames=(p,out)=>{if(!p)return out;
  if(p.type==='Identifier')out.push(p.name);
  else if(p.type==='ObjectPattern')p.properties.forEach(q=>patNames(q.type==='RestElement'?q.argument:q.value,out));
  else if(p.type==='ArrayPattern')p.elements.forEach(q=>patNames(q,out));
  else if(p.type==='RestElement')patNames(p.argument,out);
  else if(p.type==='AssignmentPattern')patNames(p.left,out);
  return out};
function declared(ast){
  const out=[];
  for(let st of ast.body){
    if(st.type==='ImportDeclaration'){for(const s of st.specifiers)out.push({name:s.local.name,kind:'import'});continue}
    if((st.type==='ExportNamedDeclaration'||st.type==='ExportDefaultDeclaration')&&st.declaration)st=st.declaration;
    if((st.type==='FunctionDeclaration'||st.type==='ClassDeclaration')&&st.id)out.push({name:st.id.name,kind:st.type==='ClassDeclaration'?'class':'function'});
    else if(st.type==='VariableDeclaration')for(const d of st.declarations)for(const n of patNames(d.id,[]))out.push({name:n,kind:st.kind})}
  return out;
}

const keyOf=p=>p.type==='Property'&&!p.computed?(p.key.type==='Identifier'?p.key.name:p.key.type==='Literal'&&typeof p.key.value==='string'?p.key.value:null):null;
/* an accessor's descriptor, as written: {get, set (it has one), reads (the name `get:()=>name` or `get(){return name}` gives back, else
   null), writes (the name `set:v=>{name=v}` / `set:v=>name=v` / `set(v){name=v}` assigns its argument to, else null)}; null when the
   descriptor isn't an object written out */
function accessorOf(d){
  if(!d||d.type!=='ObjectExpression')return null;
  const a={get:false,set:false,reads:null,writes:null};
  const one=f=>{if(!f||!/^(?:Arrow)?FunctionExpression$/.test(f.type))return null;
    if(f.body.type!=='BlockStatement')return f.body;
    const s=f.body.body.length===1?f.body.body[0]:null;return s&&(s.type==='ReturnStatement'?s.argument:s.type==='ExpressionStatement'?s.expression:null)};
  for(const p of d.properties){const k=keyOf(p);if(k!=='get'&&k!=='set')continue;
    const f=p.value,e=one(f);a[k]=true;
    if(k==='get'){if(e&&e.type==='Identifier'&&!f.params.length)a.reads=e.name}
    else if(e&&e.type==='AssignmentExpression'&&e.operator==='='&&e.left.type==='Identifier'&&f.params.length===1&&f.params[0].type==='Identifier'&&e.right.type==='Identifier'&&e.right.name===f.params[0].name)a.writes=e.left.name}
  return a;
}
function bridged(ast,src){
  const names=new Map(),odd=[],acc=new Map();
  const text=n=>src?src.slice(n.range[0],Math.min(n.range[1],n.range[0]+80)).replace(/\s+/g,' '):n.type;
  const obj=(o,kind,st)=>{if(!o||o.type!=='ObjectExpression'){odd.push(text(st));return}
    for(const p of o.properties){const k=keyOf(p);if(k==null)odd.push(text(st));else{names.set(k,kind);
      if(kind==='accessor'){const a=accessorOf(p.value);if(a)acc.set(k,a);else odd.push(text(st))}}}};
  for(const st of ast.body){
    if(st.type!=='ExpressionStatement')continue;const e=st.expression;
    if(e.type==='AssignmentExpression'&&e.left.type==='MemberExpression'&&G(e.left.object)){
      if(e.left.computed||e.operator!=='=')odd.push(text(st));else names.set(e.left.property.name,'assign');continue}
    if(e.type!=='CallExpression'||e.callee.type!=='MemberExpression'||e.callee.computed||e.callee.object.type!=='Identifier'||e.callee.object.name!=='Object'||!G(e.arguments[0]))continue;
    const fn=e.callee.property.name,a=e.arguments;
    if(fn==='assign')for(const o of a.slice(1))obj(o,'assign',st);
    else if(fn==='defineProperties')obj(a[1],'accessor',st);
    else if(fn==='defineProperty'){if(a[1]&&a[1].type==='Literal'&&typeof a[1].value==='string'){names.set(a[1].value,'accessor');
      const d=accessorOf(a[2]);if(d)acc.set(a[1].value,d);else odd.push(text(st))}else odd.push(text(st))}}
  return {names,odd,acc};
}

function imports(ast,file){
  const out=[],dir=path.posix.dirname(file);
  for(const st of ast.body){
    if(st.type!=='ImportDeclaration'&&!((st.type==='ExportNamedDeclaration'||st.type==='ExportAllDeclaration')&&st.source))continue;
    const spec=String(st.source.value),rel=/^\.{1,2}\//.test(spec);
    const from=rel?path.posix.normalize(path.posix.join(dir,spec.replace(/[?#].*$/,''))):spec;
    const names=[];let odd=rel&&spec===spec.replace(/[?#].*$/,'')?null:'not a plain relative path: '+spec;
    if(st.type==='ImportDeclaration')for(const s of st.specifiers){
      if(s.type==='ImportSpecifier'){const n=s.imported.name||s.imported.value;names.push(n);if(n!==s.local.name)odd=odd||'under another name ('+n+' as '+s.local.name+')'}else odd=odd||(s.type==='ImportDefaultSpecifier'?'a default import':'a namespace import')}
    else if(st.type==='ExportNamedDeclaration')for(const s of st.specifiers)names.push(s.local.name||s.local.value);
    else odd=odd||'export * from';
    out.push({from,names,odd})}
  return out;
}
const hasModuleSyntax=ast=>ast.body.some(st=>/^(?:Import|Export)/.test(st.type));

function shared(root,file,module){
  let src,ast;try{src=fs.readFileSync(path.join(root,file),'utf8');ast=parse(src,module)}catch(e){return[]}
  return module?[...bridged(ast,src).names.keys()]:declared(ast).map(d=>d.name);
}

module.exports={pageScripts,parse,declared,bridged,imports,hasModuleSyntax,shared};
