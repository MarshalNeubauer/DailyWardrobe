// An app file's text as a plain script, for the Node tests and tools that run app files with `vm` or `Function` (the ES-module
// move, step 1: tooling, 2026-11-22). `export` and `import` are syntax errors in a script, so a file that has become an ES module
// has them blanked first: no Node flag (vm.SourceTextModule needs --experimental-vm-modules), and the callers keep joining files
// and adding their own last line as before.
//
//   appSrc(ROOT, 'merge.js', 'core.js')   the files' texts joined, exactly `readFileSync(a)+readFileSync(b)` while none is a module
//   asScript(src, name)                   one text
//
// A file with no import or export comes back as the very same string. In a module:
//   export function f / const / let / class …   the word `export` becomes spaces (the declaration stays)
//   export {a, b};  import {a, b} from './x.js';  import './x.js';   the whole statement becomes spaces
// Blanked with spaces, never removed, so every line and column of an error is the file's own. The names an `import` brought are
// then plain names: the caller loads the file that declares them first, into the same context, as it does today (merge.js before
// core.js). What that can't stand in for throws, naming the file: a default export, `export … from`, an import or export under
// another name (`a as b`), a namespace import.
// A module is strict and a joined script is not: a caller that needs strict mode runs the module's text by itself behind
// '"use strict";' (isModule(src) says whether to).
const fs=require('fs'),path=require('path');
const MAYBE=/\b(?:import|export)\b/;   // (the words anywhere: only then is the text parsed)
const blank=(s,a,b)=>s.slice(0,a)+s.slice(a,b).replace(/[^\r\n]/g,' ')+s.slice(b);
let acorn=null;
function tree(src){if(!MAYBE.test(src))return null;
  acorn=acorn||require('acorn');
  try{acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'});return null}catch(e){}   // (a script after all: the words in a string, a comment or a template)
  const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module',ranges:true});
  return ast.body.some(st=>/^(?:Import|Export)/.test(st.type))?ast:null}
const isModule=src=>!!tree(src);
function asScript(src,name='the file'){
  const ast=tree(src);if(!ast)return src;
  const no=(st,what)=>{throw new Error(`tests/appsrc.js can't run ${name} as a script: ${what} (at ${src.slice(st.range[0],st.range[0]+60).split('\n')[0]})`)};
  let out=src;
  for(const st of ast.body){
    if(st.type==='ImportDeclaration'){
      for(const s of st.specifiers){if(s.type!=='ImportSpecifier')no(st,s.type==='ImportDefaultSpecifier'?'a default import':'a namespace import');
        if((s.imported.name||s.imported.value)!==s.local.name)no(st,'an import under another name')}
      out=blank(out,st.range[0],st.range[1])}
    else if(st.type==='ExportNamedDeclaration'){
      if(st.source)no(st,'export … from');
      if(st.declaration)out=blank(out,st.range[0],st.declaration.range[0]);
      else{for(const s of st.specifiers)if((s.exported.name||s.exported.value)!==s.local.name)no(st,'an export under another name');
        out=blank(out,st.range[0],st.range[1])}}
    else if(st.type==='ExportDefaultDeclaration')no(st,'a default export');
    else if(st.type==='ExportAllDeclaration')no(st,'export * from')}
  return out;
}
// (fs.readFileSync is looked up at each call: the test runner's recorder notes the files a test reads through it)
const appSrc=(ROOT,...files)=>files.map(f=>asScript(fs.readFileSync(path.join(ROOT,f),'utf8'),f)).join('');
module.exports={appSrc,asScript,isModule};
