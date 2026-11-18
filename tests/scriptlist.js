// index.html's page scripts, read one way by every checker (Wave C2, 2026-11-18): eslint.config.mjs, tests/typecheck.js,
// tests/globals.test.js and tests/deps.test.js each had their own regex for `<script src="…">`, and a tag written any other way
// (`<script type="module" src=…>`, `defer`, single quotes, another attribute first) would have dropped its file out of a checker
// without a word. This takes every <script> tag with a `src` ending in .js, whatever its other attributes and their order.
//   scriptTags(html)  [{src, module}] in document order (module: the tag has type="module")
//   scriptList(html)  the srcs
// Inline scripts (no src) and comments are left out. tests/deps.test.js checks it against index.html.
const TAG=/<script\b([^>]*)>/gi,ATTR=/([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
function scriptTags(html){
  const out=[];
  for(const m of String(html).replace(/<!--[\s\S]*?-->/g,'').matchAll(TAG)){
    const a={};for(const x of m[1].matchAll(ATTR))a[x[1].toLowerCase()]=x[2]!==undefined?x[2]:x[3]!==undefined?x[3]:x[4]!==undefined?x[4]:'';
    if(a.src&&/\.js$/.test(a.src))out.push({src:a.src,module:(a.type||'').toLowerCase()==='module'})}
  return out;
}
const scriptList=html=>scriptTags(html).map(t=>t.src);
module.exports={scriptList,scriptTags};
