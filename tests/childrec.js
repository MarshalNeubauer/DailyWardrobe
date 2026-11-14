// Loaded into every Node process a test starts (NODE_OPTIONS=--require, set by the recorder in tests/impact.js), so what a
// test runs through a child process (`node tools/asm-atlas.js …`) is known too: the repo's files this process reads (its own
// script and what it requires included) are written, when it exits, to a file in DW_REC_DIR; the recorder adds them to the
// test's entry in tests/impact.map. Processes this one starts inherit it.
const fs=require('fs'),path=require('path'),{fileURLToPath}=require('url');
const dir=process.env.DW_REC_DIR,root=process.env.DW_REC_ROOT;
if(dir&&root&&fs.existsSync(dir)){const seen=new Set();
  const note=p=>{try{if(p instanceof URL)p=fileURLToPath(p);if(Buffer.isBuffer(p))p=p.toString();if(typeof p!=='string')return;
    const r=path.relative(root,path.resolve(p));if(r&&!r.startsWith('..')&&!path.isAbsolute(r))seen.add(r.split(path.sep).join('/'))}catch(e){}};
  for(const k of ['readFileSync','readFile','createReadStream']){const o=fs[k];fs[k]=function(p,...a){note(p);return o.call(this,p,...a)}}
  const pr=fs.promises.readFile;fs.promises.readFile=function(p,...a){note(p);return pr.call(this,p,...a)};
  if(process.argv[1])note(process.argv[1]);
  process.on('exit',()=>{try{fs.writeFileSync(path.join(dir,process.pid+'.txt'),[...seen].join('\n'))}catch(e){}});
}
