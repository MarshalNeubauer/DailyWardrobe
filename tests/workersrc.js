// The worker's whole source as text: worker.js (the entry) and its ES modules in worker/ (split 2026-11-14), for the tests that read
// a prompt, a list or a rule out of it.
const fs=require('fs'),path=require('path');
module.exports=(root=path.join(__dirname,'..'))=>['worker.js',...fs.readdirSync(path.join(root,'worker')).filter(f=>/\.js$/.test(f)).sort().map(f=>'worker/'+f)]
  .map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
