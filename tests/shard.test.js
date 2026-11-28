// The cloud run's split (tests/shard.js, `node tests/run.js --shard i/N`, .github/workflows/full-tests.yml): every test in exactly one
// shard, the same split on every runner, balanced by the committed times, WebKit halves on their own shards, and one summary of the logs.
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
module.exports=async({ok,ROOT})=>{
  const S=require('./shard');
  ok(false,'PLANT: a planted failing check (mailfix proof, removed next commit)');
  const keys=JSON.parse(execFileSync(process.execPath,[path.join(ROOT,'tests','run.js'),'--keys'],{encoding:'utf8'}));
  ok(keys.length>100&&keys.includes('shard.test.js')&&keys.some(k=>k.endsWith(S.WK_HALF))&&new Set(keys).size===keys.length,`run.js --keys lists every test once (${keys.length}, WebKit halves included)`);
  const times=S.readTimes();
  let bad='';for(let n=1;n<=12&&!bad;n++)for(const w of [0,1,2]){const p=S.plan(keys,n,times,w),why=S.verify(keys,p);if(why||p.length!==n){bad=`${n}/${w}: ${why||p.length+' shards'}`;break}}
  ok(!bad,'every test is in exactly one shard, for 1–12 shards with 0–2 WebKit shards'+(bad?': '+bad:''));
  const a=JSON.stringify(S.plan(keys,10,times,2)),b=JSON.stringify(S.plan(keys.slice(),10,JSON.parse(JSON.stringify(times)),2));
  ok(a===b,'the split is the same each time (every runner computes the same)');
  const p=S.plan(keys,10,times,2),wk=p.map(s=>s.keys.filter(k=>k.endsWith(S.WK_HALF)).length);
  ok(wk.slice(0,8).every(x=>x===0)&&wk.slice(8).every(x=>x>0),`with 2 WebKit shards, only the last two run WebKit halves (${wk.join(',')})`);
  {const a=p.find(s=>s.keys.some(k=>S.ALONE.has(k)));ok(!a||a.keys.length===1,`a test that needs a runner to itself gets one (asmgl's shard holds ${a?a.keys.length:0} test)`)}
  ok(p.every(s=>s.keys.every((k,i)=>!i||keys.indexOf(s.keys[i-1])<keys.indexOf(k))),'each shard keeps the run order');
  // balance by the times: one long test gets a shard nearly to itself, the rest share the others evenly
  const K=['a','b','c','d','e','f','g','h','i','j','k','l'],T={a:120,b:10,c:10,d:10,e:10,f:10,g:10,h:10,i:10,j:10,k:10,l:10};
  const q=S.plan(K,3,T,0),est=q.map(s=>s.est);
  ok(Math.max(...est)===120&&q.find(s=>s.keys.includes('a')).keys.length<=q.find(s=>!s.keys.includes('a')).keys.length,`balanced by time: the 120 s test's shard takes fewer of the others (estimates ${est.map(Math.round).join('/')} s)`);
  ok(S.plan(['x','y','z','w'],2,{},0).every(s=>s.keys.length===2),'without times, equal counts');
  ok(S.parse('2/8').i===2&&S.parse(' 8 / 8 ').n===8&&!S.parse('0/8')&&!S.parse('9/8')&&!S.parse('x'),'--shard i/N is read and checked');
  // the summary: failures with their shard, flaky tests, a shard that never finished
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dw-shard-'));
  const put=(i,log,t)=>{fs.mkdirSync(path.join(dir,'shard-'+i));fs.writeFileSync(path.join(dir,'shard-'+i,'tests.log'),log);if(t)fs.writeFileSync(path.join(dir,'shard-'+i,'times.json'),JSON.stringify(t))};
  put(1,'\n• a.test.js\n  ✓ one\n\n• b.test.js\n  ✓ two\n  ✗ three broke\n\n10 passed, 1 failed (shard 1/3: 2 tests)\n',{times:{'a.test.js':3.2,'b.test.js':4},wall:9});
  put(2,'\n• c.test.js\n  (failed while other tests were running:\n    ✗ old\n   run again by itself:)\n  ✓ fine\n\nfailed with other tests running, passed by itself (a check there depends on timing: make it wait for its condition): c.test.js\n\n5 passed, 0 failed, 1 flaky (passed on retry)\n',{times:{'c.test.js':7},wall:8});
  put(3,'\n• d.test.js\n  ✓ half\n');
  const r=S.summary(dir,3),saved=JSON.parse(fs.readFileSync(path.join(dir,'shard-times.json'),'utf8'));
  ok(!r.ok&&r.all.passes===15&&r.all.failures===1&&r.all.flaky===1,'the summary adds up the shards');
  ok(/shard 1 · b\.test\.js\n  ✗ three broke/.test(r.text)&&!/✗ old/.test(r.text),'each failure is named with its test and shard (a retried test\'s first failures are not)');
  ok(/shard 3 · \(the shard did not finish/.test(r.text)&&r.text.includes('passed by itself): c.test.js (shard 2)'),'a shard with no result line fails the run; flaky tests are listed');
  ok(saved['a.test.js']===3.2&&saved['c.test.js']===7,'the run\'s per-test times are written for tests/shard-times.json');
  {const v=JSON.parse(fs.readFileSync(path.join(dir,'verdict.json'),'utf8'));
    ok(v.ok===false&&v.failed===2&&v.passes===15&&v.failures.some(f=>f.shard===1&&f.test==='b.test.js')&&v.failures.some(f=>f.shard===3)&&r.text.split('\n')[0]==='## FAILED',
      'a failed summary starts "## FAILED" and writes verdict.json with every failure and its shard (tools/cloud-tests.js reads it)')}
  {const d2=fs.mkdtempSync(path.join(os.tmpdir(),'dw-shard-'));fs.mkdirSync(path.join(d2,'shard-1'));fs.writeFileSync(path.join(d2,'shard-1','tests.log'),'\n• a.test.js\n  ✓ one\n\n1 passed, 0 failed\n');
    const r2=S.summary(d2,1),v2=JSON.parse(fs.readFileSync(path.join(d2,'verdict.json'),'utf8'));
    ok(r2.ok&&v2.ok===true&&v2.failed===0&&!/FAILED/.test(r2.text),'a passing summary has no FAILED line and its verdict is ok');fs.rmSync(d2,{recursive:true,force:true})}
  // tools/cloud-tests.js's exit code comes from the verdict, not from the run's conclusion (a branch's failed run ends as successful)
  {const C=require('../tools/cloud-tests.js'),ran={conclusion:'success',jobs:[{conclusion:'success'}]};
    ok(C.readVerdict(dir).ok===false&&!C.passed(C.readVerdict(dir),ran),'cloud-tests: a FAILED verdict exits non-zero though GitHub shows the run as successful');
    ok(C.passed({ok:true},{conclusion:'failure',jobs:[]})&&C.passed(null,ran)&&!C.passed(null,{conclusion:'success',jobs:[{conclusion:'failure'}]})&&!C.passed(null,{conclusion:'failure',jobs:[]})&&C.readVerdict(path.join(dir,'none'))===null,
      'cloud-tests: a passing verdict passes; without one (a workflow from before) the run\'s and every job\'s conclusion decide')}
  fs.rmSync(dir,{recursive:true,force:true});
  // the workflow and the runner agree on how many shards
  const wf=fs.readFileSync(path.join(ROOT,'.github','workflows','full-tests.yml'),'utf8'),n=+/\n  SHARDS: (\d+)/.exec(wf)[1],m=/shard: \[([^\]]*)\]/.exec(wf)[1].split(',').map(Number);
  ok(m.length===n&&m.every((x,i)=>x===i+1),`full-tests.yml: the matrix has shards 1–${n} (SHARDS)`);
  ok(!/pull_request|branches:[^\n]*\bmain\b/.test(wf)&&/cron: '0 1 \* \* \*'/.test(wf)&&/retention-days: 14/.test(wf),'full-tests.yml: nightly at 01:00 UTC and on demand, never on a push or pull request; logs kept 14 days');
  // STRICT: only the nightly and a run testing main fail on GitHub (and email whoever started them); a branch's run never does
  {const st=(/\n  STRICT: \$\{\{ (.+) \}\}\n/.exec(wf)||[])[1],coe=[...wf.matchAll(/\n    continue-on-error: \$\{\{ !\((.+)\) \}\}\n/g)].map(m=>m[1]);
    ok(st&&coe.length===2&&coe.every(e=>e===st)&&/\n  shard:\n(?:    .*\n)*?    continue-on-error:/.test(wf)&&/\n  summary:\n(?:    .*\n)*?    continue-on-error:/.test(wf),
      'full-tests.yml: env STRICT and the shard and summary jobs\' continue-on-error are the same condition');
    // a dry run of the expression (GitHub's || gives the first truthy value, as JS; == on strings)
    const js=String(st||'false').replace(/github\.event_name/g,'c.event').replace(/inputs\.ref/g,'c.ref').replace(/github\.ref_name/g,'c.refName').replace(/==/g,'===');
    const strict=new Function('c','return !!('+js+')'),CASES=[
      [{event:'schedule',refName:'main'},true,'the nightly'],
      [{event:'workflow_dispatch',refName:'main',ref:''},true,'npm run test:cloud -- --ref main'],
      [{event:'workflow_dispatch',refName:'main',ref:'main'},true,"main's workflow with ref=main"],
      [{event:'workflow_dispatch',refName:'claude/x',ref:''},false,'a branch with its own workflow'],
      [{event:'workflow_dispatch',refName:'main',ref:'claude/x'},false,"main's workflow on a branch"],
      [{event:'workflow_dispatch',refName:'main',ref:'530592f'},false,"main's workflow on a commit"]];
    const wrong=CASES.filter(([c,want])=>strict(c)!==want).map(x=>x[2]);
    ok(!wrong.length,'full-tests.yml: STRICT (fails and emails) for the nightly and main only, not for a branch or commit'+(wrong.length?': wrong for '+wrong.join(', '):''));
    ok(/if \[ "\$ok" != true \] && \[ "\$STRICT" = true \]; then exit 1; fi\n\s+exit 0\n/.test(wf)&&/name: \$\{\{ needs\.summary\.outputs\.ok == 'true' && 'verdict passed' \|\| format\('verdict FAILED/.test(wf)&&/cp "\$RUNNER_TEMP\/summary\.md" "\$V"/.test(wf),
      'full-tests.yml: the summary fails only a STRICT run, keeps verdict.json in test-summary, and the verdict job is named FAILED on a failure')}
  // WebKit's system packages come from a cache (tools/ci-browser-deps.sh), apt only on a miss, only on the shards with a WebKit half
  {const w=+(/\n  SHARD_WEBKIT: (\d+)/.exec(wf)||[])[1],P=S.plan(keys,n,S.readTimes(),w),P0=S.plan(keys,n,S.readTimes(),0),runs=p=>p.filter(s=>s.keys.some(k=>k.endsWith(S.WK_HALF))).length,top=p=>Math.max(...p.map(s=>s.est));
    ok(w>0&&runs(P)<=w&&top(P)<=top(P0)*1.1,`full-tests.yml: SHARD_WEBKIT ${w} puts the WebKit halves on fewer runners (${runs(P)} against ${runs(P0)}) with no slower shard (about ${Math.round(top(P))} s against ${Math.round(top(P0))} s)`);
    ok(!/install-deps/.test(wf)&&/if: steps\.plan\.outputs\.webkit == 'true'\n\s+run: bash tools\/ci-browser-deps\.sh install ~\/\.cache\/browser-apt \d+ webkit\n/.test(wf)&&/uses: actions\/cache\/restore@v\d+/.test(wf)&&/uses: actions\/cache\/save@v\d+/.test(wf),
      "full-tests.yml: WebKit's system packages are installed from the cache (apt only on a miss) on the shards with a WebKit half");}
};
