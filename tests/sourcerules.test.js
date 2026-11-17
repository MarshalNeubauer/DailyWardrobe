// Rules read from the app's sources as text, in Node, with no browser (CR-10-07, 2026-11-17): moved here from about.test.js (the
// localStorage keys named directly), invitefix.test.js (the keys named through a constant) and ui.test.js (no browser dialogs; ui.js
// loaded and kept). Reading a file as text puts it in the impact map whole, so those three page tests (11-15 s each) ran for every
// change to any script; this file takes about a second. about.js's own rule (ABOUT_KEYS, ABOUT_KEY_PREFIXES, aboutOwnKey) is taken
// from its source and run here as it is written, not copied.
const fs=require('fs'),path=require('path'),vm=require('vm');
module.exports=async({ok,ROOT})=>{
  const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const scripts=fs.readdirSync(ROOT).filter(f=>/\.js$/.test(f)).sort();
  // about.js's key rule: its three top-level lines, run in a sandbox
  const ab=src('about.js'),line=re=>{const m=re.exec(ab);if(!m)throw new Error('about.js: '+re+' not found');return m[0]};
  const box={};vm.runInNewContext([line(/^const ABOUT_KEYS=.*$/m),line(/^const ABOUT_KEY_PREFIXES=.*$/m),line(/^const aboutOwnKey=.*$/m),'this.aboutOwnKey=aboutOwnKey;'].join('\n'),box);
  const aboutOwnKey=box.aboutOwnKey;

  /* every localStorage key the app uses is one Delete removes (from about.test.js) */
  {const keys=new Set();
    for(const f of scripts.filter(f=>!['worker.js','sw.js'].includes(f))){const s=src(f);
      for(const m of s.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"`])([^'"`]+)\1/g))keys.add(m[2]);
      for(const m of s.matchAll(/localStorage\.(?!getItem|setItem|removeItem|clear|key\b|length)([A-Za-z_]\w*)/g))keys.add(m[1]);
      for(const m of s.matchAll(/localStorage\[\s*(['"`])([^'"`]+)\1/g))keys.add(m[2])}
    const miss=[...keys].filter(k=>!aboutOwnKey(k));
    ok(keys.size>10&&miss.length===0,'every localStorage key named in the app’s scripts is in ABOUT_KEYS / ABOUT_KEY_PREFIXES (missing: '+miss.join(', ')+')');
    ok(aboutOwnKey('render_queue')&&aboutOwnKey('nav_fit2:1x1')&&aboutOwnKey('nav_fit:1x1')&&!aboutOwnKey('someone_elses_key'),'the photo queue and the per-screen keys too, and nothing else')}

  /* every localStorage key the app uses through a constant is one Delete removes (from invitefix.test.js) */
  {const keys=new Set();
    for(const f of scripts){const s=src(f),consts={};
      for(const m of s.matchAll(/const ([A-Z_]+)\s*=\s*'([a-z_0-9]+)'/g))consts[m[1]]=m[2];
      for(const m of s.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([A-Z_]+)\b/g))if(consts[m[1]])keys.add(consts[m[1]])}
    const miss=[...keys].filter(x=>!aboutOwnKey(x));
    ok(keys.has('tour_seen')&&miss.length===0,`keys kept through a constant (tour_seen, tex_up, photo_up…) are deleted too (missing: ${miss.join()||'none'})`)}

  /* no browser dialogs left in the app's scripts (from ui.test.js) */
  {const files=scripts.filter(f=>f!=='worker.js').concat('index.html'),hits=[];
    for(const f of files){const t=src(f);for(const m of t.matchAll(/(^|[^.\w$])(confirm|alert|prompt)\s*\(/g))hits.push(f+': '+t.slice(m.index,m.index+50).replace(/\s+/g,' '))}
    ok(!hits.length,`no confirm(), alert() or prompt() in the app's scripts${hits.length?' ('+hits.slice(0,3).join(' | ')+')':''}`);
    ok(/'ui\.js'/.test(src('sw.js'))&&/<script src="ui\.js">/.test(src('index.html')),'ui.js is loaded by the page and kept by the service worker')}
};
