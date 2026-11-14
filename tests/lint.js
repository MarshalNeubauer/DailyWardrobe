// ESLint over the scripts (rules in eslint.config.mjs: names that don't exist, names declared twice, unused variables).
//   node tests/lint.js             every script as it is in the folder (`npm run lint`)
//   node tests/lint.js --changed   the scripts the commits since origin/main changed, as committed (.githooks/pre-push): an error
//                                  anywhere in them refuses the push; an unused variable is shown only on a line the change touched
// Without ESLint installed (a checkout from before it was added: run `npm install`) it says so and passes.
const path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const git=(...a)=>{try{return execFileSync('git',a,{cwd:ROOT,maxBuffer:1<<28,stdio:['ignore','pipe','ignore']}).toString('utf8')}catch(e){return null}};
const LINTED=f=>/\.js$/.test(f)&&!f.startsWith('tests/fixtures/')&&!f.startsWith('node_modules/')&&!f.startsWith('atlas/');

(async()=>{
  let ESLint;try{({ESLint}=require('eslint'))}catch(e){console.log('ESLint is not installed in this checkout (run `npm install`): lint skipped.');return}
  const eslint=new ESLint({cwd:ROOT});
  let results;const touched=new Map();   // file → Set of line numbers the change added or changed
  if(process.argv.includes('--changed')){
    const base=(git('merge-base','HEAD','origin/main')||'').trim();if(!base){console.log('lint: no origin/main to compare with; skipped.');return}
    const files=(git('diff','--name-only','--diff-filter=AMR','--no-renames',base,'HEAD')||'').split('\n').filter(f=>f&&LINTED(f));
    results=[];if(!files.length)return;
    // two git calls for all the files (each call costs about 50-100 ms on Windows): the lines each changed, and their committed text
    for(const part of (git('diff','-U0','--no-renames',base,'HEAD','--',...files)||'').split(/^diff --git /m).slice(1)){
      const f=(/^\+\+\+ b\/(.+)$/m.exec(part)||[])[1];if(!f)continue;const lines=new Set();
      for(const m of part.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)){const a=+m[1],n=m[2]==null?1:+m[2];for(let i=a;i<a+n;i++)lines.add(i)}
      touched.set(f,lines)}
    let batch=Buffer.alloc(0);try{batch=execFileSync('git',['cat-file','--batch'],{cwd:ROOT,input:files.map(f=>'HEAD:'+f).join('\n')+'\n',maxBuffer:1<<28,stdio:['pipe','pipe','ignore']})}catch(e){}
    const text=new Map();for(let at=0,k=0;at<batch.length&&k<files.length;k++){const nl=batch.indexOf(10,at),head=batch.slice(at,nl).toString(),m=/ blob (\d+)$/.exec(head);
      if(!m){at=nl+1;continue}const n=+m[1];text.set(files[k],batch.slice(nl+1,nl+1+n).toString('utf8'));at=nl+1+n+1}
    for(const f of files){if(!text.has(f)||await eslint.isPathIgnored(path.join(ROOT,f)))continue;if(!touched.has(f))touched.set(f,new Set());
      results.push(...await eslint.lintText(text.get(f),{filePath:path.join(ROOT,f)}))}
  }else results=await eslint.lintFiles(['.']);
  let errors=0,warnings=0,hidden=0;const out=[];
  for(const r of results){const f=path.relative(ROOT,r.filePath).split(path.sep).join('/'),T=touched.get(f);
    for(const m of r.messages){const err=m.fatal||m.severity===2;
      if(!err&&T&&!T.has(m.line)){hidden++;continue}
      err?errors++:warnings++;out.push(`${f}:${m.line}:${m.column}  ${err?'error':'warning'}  ${m.message}${m.ruleId?'  ('+m.ruleId+')':''}`)}}
  if(out.length)console.log(out.join('\n'));
  if(errors||warnings||!touched.size)console.log(`lint: ${errors} error${errors===1?'':'s'}, ${warnings} warning${warnings===1?'':'s'}`+(hidden?` (and ${hidden} on lines this change didn't touch)`:'')+` in ${results.length} file${results.length===1?'':'s'}`);
  if(errors){console.log('A name that doesn\'t exist, or one declared twice, breaks the script when that line runs: fix it, commit, and push again.');process.exitCode=1}
})().catch(e=>{console.log('lint could not run: '+(e&&e.message||e));});
