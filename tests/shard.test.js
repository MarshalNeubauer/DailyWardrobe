// The cloud run's split (tests/shard.js, `node tests/run.js --shard i/N`, .github/workflows/full-tests.yml): every test in exactly one
// shard, the same split on every runner, balanced by the committed times, WebKit halves on their own shards, and one summary of the logs.
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
module.exports=async({ok,ROOT})=>{
  const S=require('./shard');
  const keys=JSON.parse(execFileSync(process.execPath,[path.join(ROOT,'tests','run.js'),'--keys'],{encoding:'utf8'}));
  ok(keys.length>100&&keys.includes('shard.test.js')&&keys.some(k=>k.endsWith(S.WK_HALF))&&new Set(keys).size===keys.length,`run.js --keys lists every test once (${keys.length}, WebKit halves included)`);
  const times=S.readTimes();
  let bad='';for(let n=1;n<=12&&!bad;n++)for(const w of [0,1,2]){const p=S.plan(keys,n,times,w),why=S.verify(keys,p);if(why||p.length!==n){bad=`${n}/${w}: ${why||p.length+' shards'}`;break}}
  ok(!bad,'every test is in exactly one shard, for 1–12 shards with 0–2 WebKit shards'+(bad?': '+bad:''));
  const a=JSON.stringify(S.plan(keys,10,times,2)),b=JSON.stringify(S.plan(keys.slice(),10,JSON.parse(JSON.stringify(times)),2));
  ok(a===b,'the split is the same each time (every runner computes the same)');
  const p=S.plan(keys,10,times,2),wk=p.map(s=>s.keys.filter(k=>k.endsWith(S.WK_HALF)).length);
  ok(wk.slice(0,8).every(x=>x===0)&&wk.slice(8).every(x=>x>0),`with 2 WebKit shards, only the last two run WebKit halves (${wk.join(',')})`);
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
  ok(/shard 3 · \(the shard did not finish/.test(r.text)&&/c\.test\.js \(shard 2\)/.test(r.text),'a shard with no result line fails the run; flaky tests are listed');
  ok(saved['a.test.js']===3.2&&saved['c.test.js']===7,'the run\'s per-test times are written for tests/shard-times.json');
  fs.rmSync(dir,{recursive:true,force:true});
  // the workflow and the runner agree on how many shards
  const wf=fs.readFileSync(path.join(ROOT,'.github','workflows','full-tests.yml'),'utf8'),n=+/\n  SHARDS: (\d+)/.exec(wf)[1],m=/shard: \[([^\]]*)\]/.exec(wf)[1].split(',').map(Number);
  ok(m.length===n&&m.every((x,i)=>x===i+1),`full-tests.yml: the matrix has shards 1–${n} (SHARDS)`);
  ok(!/pull_request|branches:[^\n]*\bmain\b/.test(wf)&&/cron: '0 1 \* \* \*'/.test(wf)&&/retention-days: 14/.test(wf),'full-tests.yml: nightly at 01:00 UTC and on demand, never on a push or pull request; logs kept 14 days');
};
