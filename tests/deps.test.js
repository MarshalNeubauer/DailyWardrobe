// The dependency ledger (Wave C2, 2026-11-18, MODULES-PLAN.md C2-1): which file uses which other file's top-level names.
// The page scripts share one global scope, so nothing says what a file needs from the others; this is that list, the "imports"
// half of modules with no runtime change. Node only (acorn + eslint-scope, about a second), built like tests/globals.test.js.
//
// For each page script (index.html's, through tests/scriptlist.js) the names it uses but doesn't declare are looked up in the
// other page scripts' top-level declarations (function, class, let, const, var; the first script to declare a name owns it). A use
// is a read, a call, a `typeof X` guard or an assignment. Each Web Worker file gets a row too: what it uses from the files it
// `importScripts` (those files' own rows are the page's, where they see more names).
// A page script that is an ES module (type="module": none yet) owns, for the others, only the names it bridges onto globalThis
// (tests/modscope.js); what it uses is the names it leaves to the global scope and the files it imports from (`import {a} from
// './b.js'` is an edge to b.js like a use of `a` was), so converting a file keeps its row.
//
// tests/deps.json holds every file -> file edge:
// - a new edge fails: use what the file already depends on, move the code to the file that owns the name, or add the edge to
//   tests/deps.json by hand (`--update --add` does it) and say why in the pull request;
// - an edge that went away fails too, until it is taken off (`node tests/deps.test.js --update`): the list only shrinks, so it
//   stays the true picture;
// - LEAVES must use no other file: merge.js (the server imports it), srgb.js (asm-worker.js loads it first), back.js, locale.js.
// Merging two branches that changed one file's line: take either side, then `node tests/deps.test.js --update`.
//
//   node tests/deps.test.js                    the summary: files, edges, the largest cycle, the leaves; what differs from deps.json
//   node tests/deps.test.js --update           take the edges that went away off deps.json (never adds)
//   node tests/deps.test.js --update --add     also add the new edges (each is printed: give the reason in the pull request)
//   node tests/deps.test.js --why a.js [b.js]  the names a.js uses from each file (or from b.js)
const fs=require('fs'),path=require('path');
const acorn=require('acorn'),escope=require('eslint-scope');
const {scriptList,scriptTags}=require('./scriptlist');
const modscope=require('./modscope');
const LEDGER='tests/deps.json';
const LEAVES=['merge.js','srgb.js','back.js','locale.js'];
const WORKERS=['asm-worker.js','analysis-worker.js'];

/* the scopes, as eslint.config.mjs and tests/typecheck.js find them: [{name, files (in load order), rows (the files that get a row)}] */
function scopes(ROOT){
  const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const tags=scriptTags(rd('index.html')),page=tags.map(t=>t.src);
  const out=[{name:'page',files:page,rows:page,mods:tags.filter(t=>t.module).map(t=>t.src)}];
  // (a worker's files: its importScripts, or a module worker's `import './x.js'` lines; a module worker is read as a module)
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;
    const k=modscope.workerFiles(ROOT,w);
    out.push({name:w,files:k.files,rows:[w],mods:k.module?[w]:[]})}
  return out;
}

/* a script's top-level names */
function topNames(ast){
  const out=[],pat=p=>{if(!p)return;
    if(p.type==='Identifier')out.push(p.name);
    else if(p.type==='ObjectPattern')p.properties.forEach(q=>pat(q.type==='RestElement'?q.argument:q.value));
    else if(p.type==='ArrayPattern')p.elements.forEach(pat);
    else if(p.type==='RestElement')pat(p.argument);
    else if(p.type==='AssignmentPattern')pat(p.left)};
  for(const st of ast.body){
    if(st.type==='FunctionDeclaration'||st.type==='ClassDeclaration')out.push(st.id.name);
    else if(st.type==='VariableDeclaration')st.declarations.forEach(d=>pat(d.id))}
  return out;
}

/* {scopes, names: top-level names in the page, uses: {file: {other file: [names]}}} */
function measure(ROOT){
  const S=scopes(ROOT),parsed={},uses={},mods=new Set(S.flatMap(s=>s.mods));
  // (a module is read as one in the page's scope only: a worker can't importScripts it, which tests/bridge.test.js checks)
  const info=f=>{if(!parsed[f]){const m=mods.has(f),src=fs.readFileSync(path.join(ROOT,f),'utf8');
    const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:m?'module':'script',ranges:true});
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:m?'module':'script'}).globalScope,own=new Set(g.variables.map(v=>v.name));
    parsed[f]={top:m?[...modscope.bridged(ast,src).names.keys()]:topNames(ast),free:[...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n)),
      imports:m?modscope.imports(ast,f):[]}}
    return parsed[f]};
  let names=0;
  for(const s of S){
    const owner=new Map();
    for(const f of s.files)for(const n of info(f).top)if(!owner.has(n))owner.set(n,f);
    if(s.name==='page')names=owner.size;
    for(const f of s.rows){const u=uses[f]={};
      for(const n of info(f).free){const o=owner.get(n);if(o&&o!==f)(u[o]=u[o]||[]).push(n)}
      if(s.name==='page')for(const i of info(f).imports)if(i.from!==f)u[i.from]=[...new Set([...(u[i.from]||[]),...i.names])];
      for(const o of Object.keys(u))u[o].sort()}
  }
  return {scopes:S,names,uses};
}
const edgesOf=uses=>Object.fromEntries(Object.keys(uses).sort().map(f=>[f,Object.keys(uses[f]).sort()]));
const count=e=>Object.values(e).reduce((a,l)=>a+l.length,0);

/* the ratchet: edges the ledger doesn't have (fresh), edges it has that are gone (gone) */
function compare(now,base){
  const fresh=[],gone=[];
  for(const [f,l] of Object.entries(now))for(const d of l)if(!(base[f]||[]).includes(d))fresh.push(f+' -> '+d);
  for(const [f,l] of Object.entries(base))for(const d of l)if(!(now[f]||[]).includes(d))gone.push(f+' -> '+d);
  return {fresh,gone};
}

/* strongly connected components of {file: [files]} over `files` (Tarjan), largest first */
function cycles(files,edges){
  let idx=0;const st=[],on=new Set(),I={},L={},out=[];
  const sc=v=>{I[v]=L[v]=idx++;st.push(v);on.add(v);
    for(const w of edges[v]||[]){if(!(w in edges))continue;if(I[w]===undefined){sc(w);L[v]=Math.min(L[v],L[w])}else if(on.has(w))L[v]=Math.min(L[v],I[w])}
    if(L[v]===I[v]){const c=[];let w;do{w=st.pop();on.delete(w);c.push(w)}while(w!==v);out.push(c)}};
  for(const f of files)if(I[f]===undefined)sc(f);
  return out.filter(c=>c.length>1).sort((a,b)=>b.length-a.length);
}

const readLedger=ROOT=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,LEDGER),'utf8')).files}catch(e){return null}};
const ledgerText=edges=>'{\n "note": "Which file uses which other file\'s top-level names (tests/deps.test.js). It may only shrink: `node tests/deps.test.js --update` takes off what went away; a new edge is added by hand, with the reason in the pull request.",\n "edges": '+count(edges)+
  ',\n "files": {\n'+Object.keys(edges).sort().map(f=>'  '+JSON.stringify(f)+': '+JSON.stringify(edges[f])).join(',\n')+'\n }\n}\n';

function summary(ROOT){
  const m=measure(ROOT),edges=edgesOf(m.uses),page=m.scopes[0].files;
  const pageEdges=Object.fromEntries(page.map(f=>[f,edges[f]]));
  const cyc=cycles(page,pageEdges),leaves=page.filter(f=>!edges[f].length);
  const usedBy=f=>page.filter(g=>edges[g].includes(f)).length;
  return {m,edges,page,cyc,leaves,usedBy,pageCount:count(pageEdges),
    nameUses:page.reduce((a,f)=>a+Object.values(m.uses[f]).reduce((x,l)=>x+l.length,0),0)};
}

module.exports=async({ok,ROOT})=>{
  /* the shared script list */
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const made='<script>inline()</script>\n<script src="a.js"></script><script  type="module" src="b.js"></script>\n<script src=\'c.js\' type=module defer></script>'+
    '<SCRIPT async SRC="d/e.js"></SCRIPT><!-- <script src="old.js"></script> --><script src="data.json"></script><img src="f.js"><script type="text/plain" src="g.js"></script>';
  const tags=scriptTags(made);
  ok(scriptList(made).join()==='a.js,b.js,c.js,d/e.js,g.js','the script list takes every <script src="….js"> in order, however the tag is written (attributes before or after src, either quote, none), and no inline script, comment or other tag');
  ok(tags.map(t=>+t.module).join('')==='01100','the script list says which tags are type="module"');
  const page=scriptList(html),srcs=[...html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/\bsrc\s*=\s*["']?([^"'\s>]+\.js)\b/gi)].map(x=>x[1]);
  ok(page.length>40&&page.join()===srcs.join()&&new Set(page).size===page.length,`every src="….js" in index.html is in the script list, once (${page.length} page scripts)`);

  /* the ratchet's rule, on made-up edges */
  const base={'a.js':['b.js','c.js'],'b.js':[],'w.js':['a.js']};
  let r=compare({'a.js':['b.js','c.js'],'b.js':[],'w.js':['a.js']},base);
  ok(!r.fresh.length&&!r.gone.length,'the same edges pass');
  r=compare({'a.js':['b.js','c.js'],'b.js':['c.js'],'n.js':['a.js'],'w.js':['a.js']},base);
  ok(r.fresh.join()==='b.js -> c.js,n.js -> a.js'&&!r.gone.length,'a new edge is named, from a listed file or a new one');
  r=compare({'a.js':['b.js'],'b.js':[]},base);
  ok(!r.fresh.length&&r.gone.join()==='a.js -> c.js,w.js -> a.js','an edge that went away is named, a removed file\'s too');
  ok(cycles(['a','b','c','d'],{a:['b'],b:['c'],c:['a'],d:['a']}).map(c=>c.sort().join('')).join()==='abc','a cycle is found, and a file that only reads it is outside it');

  /* the app */
  const s=summary(ROOT),led=readLedger(ROOT);
  ok(s.page.length>40&&s.m.names>1000,`the page scripts and the two workers read (${s.page.length} page scripts, ${s.m.names} top-level names, ${count(s.edges)} file to file edges, ${s.nameUses} names used across page files)`);
  ok(!!led,'tests/deps.json is there'+(led?'':' (make it: node tests/deps.test.js --update --add)'));
  const c=compare(s.edges,led||{});
  ok(!c.fresh.length,'no file uses a file it didn\'t use before'+(c.fresh.length?': '+c.fresh.map(e=>{const [f,d]=e.split(' -> ');return e+' ('+s.m.uses[f][d].slice(0,6).join(', ')+(s.m.uses[f][d].length>6?', …':'')+')'}).join('; ')+
    '. Keep to the files it already uses, or add the edge to tests/deps.json (node tests/deps.test.js --update --add) and say why in the pull request':''));
  ok(!c.gone.length,'the ledger only shrinks: every edge in tests/deps.json is still used'+(c.gone.length?' (take them off with `node tests/deps.test.js --update`: '+c.gone.join('; ')+')':''));
  const bad=LEAVES.filter(f=>!s.page.includes(f)||s.edges[f].length);
  ok(!bad.length,'merge.js, srgb.js, back.js and locale.js use no other file\'s names'+(bad.length?': '+bad.map(f=>s.page.includes(f)?f+' uses '+Object.entries(s.m.uses[f]).map(([d,n])=>d+' ('+n.join(', ')+')').join(', '):f+' is not a page script').join('; '):''));
  ok(WORKERS.every(w=>s.edges[w]&&s.edges[w].length),'each Web Worker\'s row lists the files it uses from its importScripts');
  console.log(`  (deps: largest cycle ${s.cyc[0]?s.cyc[0].length:0} of ${s.page.length} page scripts; ${s.leaves.length} use no other file: ${s.leaves.join(' ')})`);
};
module.exports.measure=measure;module.exports.edgesOf=edgesOf;

if(require.main===module){
  const ROOT=path.resolve(__dirname,'..'),argv=process.argv.slice(2);
  const s=summary(ROOT),led=readLedger(ROOT)||{},c=compare(s.edges,led);
  if(argv[0]==='--why'){
    const u=s.m.uses[argv[1]];if(!u){console.log('deps: no such file in the ledger: '+argv[1]);process.exitCode=1}
    else for(const [d,n] of Object.entries(u).sort())if(!argv[2]||d===argv[2])console.log(`${argv[1]} -> ${d} (${n.length}): ${n.join(' ')}`);
  }else{
    console.log(`deps: ${s.page.length} page scripts, ${s.m.names} top-level names, ${s.pageCount} page edges (${count(s.edges)} with the workers' rows), ${s.nameUses} names used across page files`);
    console.log(`deps: cycles ${s.cyc.map(x=>x.length).join(', ')||'none'}; largest: ${s.cyc[0]?s.cyc[0].slice().sort().join(' '):'-'}`);
    console.log('deps: outside every cycle (uses / used by):');
    for(const f of s.page.filter(f=>!s.cyc.some(x=>x.includes(f))))console.log(`  ${f}  uses ${s.edges[f].join(',')||'-'}  used by ${s.usedBy(f)}`);
    if(argv.includes('--update')){
      const add=argv.includes('--add'),out={};
      for(const f of Object.keys(s.edges))out[f]=s.edges[f].filter(d=>add||(led[f]||[]).includes(d));
      fs.writeFileSync(path.join(ROOT,LEDGER),ledgerText(out));
      console.log(`deps: ${LEDGER} written, ${count(out)} edges`+(c.gone.length?`; taken off: ${c.gone.join('; ')}`:''));
      if(c.fresh.length)console.log((add?'deps: ADDED (say why in the pull request): ':'deps: new edges NOT added (the ledger only shrinks; --update --add adds them, with the reason in the pull request): ')+c.fresh.join('; '));
      if(c.fresh.length&&!add)process.exitCode=1;
    }else{
      if(c.fresh.length)console.log('deps: new edges, not in '+LEDGER+': '+c.fresh.join('; '));
      if(c.gone.length)console.log('deps: edges that went away (run --update): '+c.gone.join('; '));
      console.log(c.fresh.length||c.gone.length?'deps: differs from '+LEDGER:'deps: matches '+LEDGER);
      if(c.fresh.length||c.gone.length)process.exitCode=1;
    }
  }
}
