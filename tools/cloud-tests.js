// `npm run test:cloud`: the whole suite on GitHub's runners, split over several at once (.github/workflows/full-tests.yml), for the
// branch checked out here; waits for it and prints the summary (every failure with its shard). Needs `gh`, signed in.
//   npm run test:cloud                         the current branch as pushed (say so when HEAD isn't pushed)
//   npm run test:cloud -- --ref <branch|sha>   another branch or commit (with main's workflow when that one has none)
//   npm run test:cloud -- --no-wait            start it and print its address only
//   npm run test:cloud -- --save-times         also write the run's per-test seconds to tests/shard-times.json (the shards' balance)
// Exit code 0 when every check passed.
const {execFileSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),WF='full-tests.yml';
const args=process.argv.slice(2),flag=f=>args.includes(f),opt=f=>{const i=args.indexOf(f);return i>=0?args[i+1]:null};
const sh=(cmd,a,o={})=>execFileSync(cmd,a,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],...o}).trim();
const gh=a=>sh('gh',a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const secs=(a,b)=>(new Date(b)-new Date(a))/1000;
const mmss=s=>{s=Math.round(s);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
// the run's real result: the summary job's verdict.json (in `test-summary`), not the run's conclusion, since a run on any ref but main
// ends as successful on GitHub whatever it found (full-tests.yml STRICT: no failure email for a branch). A workflow from before the
// verdict (a branch made earlier, run with its own workflow) has none: then the run's conclusion, and every job's, decide
function readVerdict(dir){try{const v=JSON.parse(fs.readFileSync(path.join(dir,'verdict.json'),'utf8'));return v&&typeof v.ok==='boolean'?v:null}catch(e){return null}}
function passed(verdict,run){if(verdict)return verdict.ok===true;
  return run.conclusion==='success'&&(run.jobs||[]).every(j=>['success','skipped'].includes(j.conclusion))}
module.exports={readVerdict,passed};

if(require.main===module)(async()=>{
  try{gh(['--version'])}catch(e){console.log('`gh` (GitHub CLI) is needed: https://cli.github.com, then `gh auth login`.');process.exit(2)}
  const repo=(()=>{const u=sh('git',['remote','get-url','origin']);const m=/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(u);return m?m[1]:null})();
  if(!repo){console.log('origin is not a GitHub repository');process.exit(2)}
  let ref=opt('--ref');
  if(!ref){ref=sh('git',['rev-parse','--abbrev-ref','HEAD']);
    if(ref==='HEAD'){console.log('HEAD is detached: give --ref <branch or commit>');process.exit(2)}
    const head=sh('git',['rev-parse','HEAD']);let remote='';try{remote=sh('git',['ls-remote','origin','refs/heads/'+ref]).split(/\s/)[0]}catch(e){}
    if(!remote){console.log(`${ref} is not on GitHub yet: push it first (git push -u origin ${ref}).`);process.exit(2)}
    if(remote!==head)console.log(`note: GitHub's ${ref} is at ${remote.slice(0,7)}, this checkout at ${head.slice(0,7)}: the cloud tests what is pushed.`)}
  const tag=Math.random().toString(16).slice(2,8),T0=Date.now();
  // the branch's own workflow when it has one (its tests/run.js knows --shard); else main's, checking the branch out
  let how;try{gh(['workflow','run',WF,'-R',repo,'--ref',ref,'-f','tag='+tag]);how=ref}
  catch(e){gh(['workflow','run',WF,'-R',repo,'--ref','main','-f','ref='+ref,'-f','tag='+tag]);how='main\'s workflow on '+ref}
  console.log(`started the full test run (${how})`);
  let run=null;
  for(let i=0;i<40&&!run;i++){await sleep(3000);
    const L=JSON.parse(gh(['run','list','-R',repo,'--workflow',WF,'--event','workflow_dispatch','--limit','30','--json','databaseId,displayTitle,url,createdAt']));
    run=L.find(r=>r.displayTitle.endsWith(' '+tag))}
  if(!run){console.log('started, but the run did not show up within two minutes: see GitHub > Actions > Full test run');process.exit(1)}
  console.log(run.url);
  if(flag('--no-wait'))return;
  let seen=-1,v;
  for(;;){v=JSON.parse(gh(['run','view',String(run.databaseId),'-R',repo,'--json','status,conclusion,jobs,createdAt,updatedAt']));
    const shards=v.jobs.filter(j=>j.name.startsWith('shard')),done=shards.filter(j=>j.status==='completed');
    if(done.length!==seen&&shards.length){seen=done.length;const bad=done.filter(j=>j.conclusion!=='success').length;
      console.log(`${mmss((Date.now()-T0)/1000)}  ${done.length}/${shards.length} shards done`+(bad?` (${bad} failed)`:''))}
    if(v.status==='completed')break;
    await sleep(10000)}
  // the summary job's result
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dw-cloud-'));let text='';
  try{gh(['run','download',String(run.databaseId),'-R',repo,'-n','test-summary','-D',dir]);text=fs.readFileSync(path.join(dir,'summary.md'),'utf8')}
  catch(e){text='(no summary: the summary job did not finish; see '+run.url+')'}
  const verdict=readVerdict(dir);
  console.log('\n'+text.trim()+'\n');
  const jobs=v.jobs.filter(j=>j.startedAt&&j.completedAt),mins=jobs.reduce((a,j)=>a+secs(j.startedAt,j.completedAt),0)/60;
  const billed=jobs.reduce((a,j)=>a+Math.max(1,Math.ceil(secs(j.startedAt,j.completedAt)/60)),0);
  const slow=jobs.filter(j=>j.name.startsWith('shard')).sort((a,b)=>secs(b.startedAt,b.completedAt)-secs(a.startedAt,a.completedAt))[0];
  console.log(`wall clock ${mmss((Date.now()-T0)/1000)} from start to summary (run ${mmss(secs(v.createdAt,v.updatedAt))}); slowest: ${slow?slow.name+' '+mmss(secs(slow.startedAt,slow.completedAt)):'–'}; runner time ${mins.toFixed(1)} min (${billed} billed minutes, jobs rounded up)`);
  if(flag('--save-times')){try{fs.copyFileSync(path.join(dir,'shard-times.json'),path.join(ROOT,'tests','shard-times.json'));console.log('wrote tests/shard-times.json: commit it')}catch(e){console.log('no shard-times.json in the run')}}
  const pass=passed(verdict,v);
  console.log(pass?'✓ passed':'✗ '+(verdict?`FAILED (${verdict.failed} failed`+(v.conclusion==='success'?'; GitHub shows the run as successful: it is not on main':'')+')':v.conclusion)+': '+run.url);
  process.exit(pass?0:1);
})().catch(e=>{console.log(String(e.stderr||e.message||e).trim());process.exit(1)});
