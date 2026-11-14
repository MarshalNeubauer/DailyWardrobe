// sw.js installs every file in ASSETS: one missing file fails the whole install, so phones silently never update (while "A new
// version is ready" still shows). Every listed file must exist, and every file the app loads (index.html's scripts, stylesheet,
// manifest and icons; the workers' importScripts; the manifest's icons) must be listed, or it is fetched from the network and the
// app isn't whole offline. (audit 2026-11-13)
const fs=require('fs'),path=require('path');
module.exports=async({ok,ROOT})=>{
  const R=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const sw=R('sw.js'),a=/const ASSETS=\[([^\]]*)\]/.exec(sw),assets=a?[...a[1].matchAll(/'([^']+)'/g)].map(m=>m[1]):[];
  ok(assets.length>20,`sw.js lists its files (${assets.length})`);
  const missing=assets.filter(f=>f!=='./'&&!fs.existsSync(path.join(ROOT,f)));
  ok(!missing.length,`every file in ASSETS exists (${missing.join(', ')||'all there'})`);
  const html=R('index.html'),need=new Set();
  for(const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g))need.add(m[1]);
  for(const m of html.matchAll(/<link[^>]*\shref="([^"]+)"/g))if(!/^https?:/.test(m[1]))need.add(m[1]);
  for(const f of fs.readdirSync(ROOT).filter(f=>/worker\.js$/.test(f)&&f!=='worker.js')){need.add(f);for(const m of R(f).matchAll(/importScripts\(([^)]*)\)/g))for(const s of m[1].matchAll(/'([^']+)'/g))need.add(s[1])}
  for(const ic of JSON.parse(R('manifest.webmanifest')).icons||[])need.add(ic.src);
  const unlisted=[...need].filter(f=>!assets.includes(f));
  ok(!unlisted.length,`every script, stylesheet, icon, manifest and worker the app loads is in ASSETS (${unlisted.join(', ')||'all listed'})`);
  ok(/cache:'no-cache'/.test(sw)&&!/cache:'reload'/.test(sw),"the install revalidates (cache:'no-cache': an unchanged file is a small 304) instead of downloading everything again");
};
