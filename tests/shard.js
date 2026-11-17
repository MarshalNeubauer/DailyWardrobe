// Splitting the whole suite into shards for the cloud run (.github/workflows/full-tests.yml, `npm run test:cloud`).
//   node tests/run.js --shard i/N        (or TEST_SHARD=i/N) runs shard i of N (1-based) of every test
//   node tests/shard.js --plan N [W]     prints the shards: their tests and estimated times, and checks that every test is in exactly one
//   node tests/shard.js --summary <dir> <N> [W]   (the workflow's last job) reads each shard's log and times from <dir>, prints one
//                                        summary (every failure with its shard) and writes <dir>/shard-times.json; exit 1 if any failed
//   node tests/shard.js --needs-webkit i/N [W]   prints "true" when shard i runs a WebKit half (it then installs WebKit)
// Shards are balanced by the per-test seconds in tests/shard-times.json (from a cloud run: `npm run test:cloud -- --save-times`);
// a test not in it counts as the median. W of the N shards (the last ones) take the WebKit halves (' · WebKit'), so only those
// runners install WebKit. The split depends only on the list of tests, the times file, N and W: every runner computes the same.
const fs=require('fs'),path=require('path');
const TIMES_FILE=path.join(__dirname,'shard-times.json');
const WK_HALF=' · WebKit';
const JOBS=3;   // tests at once on one runner (GitHub's runner has 4 processors; tests/run.js runs one fewer)

const readTimes=(f=TIMES_FILE)=>{try{const t=JSON.parse(fs.readFileSync(f,'utf8'));return t&&typeof t==='object'?(t.times||t):{}}catch(e){return {}}};
const median=a=>{if(!a.length)return 30;const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1]};

/* keys: every test in run order; → shards: [[key…]…] (N lists). Largest first, each to the shard whose estimated time grows least;
   a shard's estimate is the longer of its total over JOBS and its longest test (JOBS at a time on one runner) */
function plan(keys,n,times=readTimes(),w=0){
  n=Math.max(1,n|0);w=Math.max(0,Math.min(n-1,w|0));
  const known=keys.map(k=>times[k]).filter(v=>typeof v==='number'&&v>0),dflt=median(known);
  const sec=k=>typeof times[k]==='number'&&times[k]>0?times[k]:dflt;
  const shards=Array.from({length:n},()=>({keys:[],sum:0,max:0}));
  const est=s=>Math.max(s.sum/JOBS,s.max);
  const groups=w?[[keys.filter(k=>!k.endsWith(WK_HALF)),shards.slice(0,n-w)],[keys.filter(k=>k.endsWith(WK_HALF)),shards.slice(n-w)]]:[[keys,shards]];
  for(const [list,pool] of groups){
    const order=list.slice().sort((a,b)=>sec(b)-sec(a)||(a<b?-1:a>b?1:0));
    for(const k of order){const t=sec(k);let best=null,bc=0;
      for(const s of pool){const c=Math.max((s.sum+t)/JOBS,Math.max(s.max,t));if(!best||c<bc-1e-9||(Math.abs(c-bc)<=1e-9&&s.sum<best.sum)){best=s;bc=c}}
      best.keys.push(k);best.sum+=t;best.max=Math.max(best.max,t)}}
  // each shard keeps the run order of the full list
  const pos=new Map(keys.map((k,i)=>[k,i]));
  return shards.map(s=>({keys:s.keys.sort((a,b)=>pos.get(a)-pos.get(b)),sum:s.sum,est:est(s)}));
}
/* 'i/N' → {i, n} (1 ≤ i ≤ N), or null */
const parse=s=>{const m=/^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(s||'');if(!m)return null;const i=+m[1],n=+m[2];return i>=1&&n>=1&&i<=n?{i,n}:null};
/* every key in exactly one shard → '' or what is wrong */
const verify=(keys,shards)=>{const seen=new Map();for(const [j,s] of shards.entries())for(const k of s.keys){if(seen.has(k))return `${k} is in shards ${seen.get(k)+1} and ${j+1}`;seen.set(k,j)}
  const miss=keys.filter(k=>!seen.has(k));if(miss.length)return 'not in any shard: '+miss.join(', ');
  const extra=[...seen.keys()].filter(k=>!keys.includes(k));return extra.length?'not a test: '+extra.join(', '):''};
/* how many of the N shards take the WebKit halves: SHARD_WEBKIT, else 0 (they are spread like the others) */
const wkShards=()=>{const v=parseInt(process.env.SHARD_WEBKIT,10);return v>=0?v:0};

/* one shard's log (tests/run.js output) → {passes, failures, flaky, done, failed:[{test, lines}], flakyNames} */
function readLog(text){const r={passes:0,failures:0,flaky:0,done:false,failed:[],flakyNames:[]};let cur=null,bad=null;
  for(const line of text.split(/\r?\n/)){let m;
    if((m=/^• (.+)$/.exec(line))){cur=m[1];bad=null;continue}
    if(/^  ✗ /.test(line)){if(!bad){bad={test:cur||'(before the first test)',lines:[]};r.failed.push(bad)}bad.lines.push(line.trim());continue}
    if((m=/^failed with other tests running, passed by (?:itself|themselves) [^:]*: (.+)$/.exec(line)))r.flakyNames=m[1].split(', ');
    if((m=/^(\d+) passed, (\d+) failed(?:, (\d+) flaky)?/.exec(line))){r.passes=+m[1];r.failures=+m[2];r.flaky=+(m[3]||0);r.done=true}}
  return r}

/* the workflow's last job: dir holds shard-<i>/tests.log and shard-<i>/times.json (each shard's artifact) */
function summary(dir,n){const out=[],all={passes:0,failures:0,flaky:0},times={},rows=[],fails=[],flaky=[];let bad=0;
  for(let i=1;i<=n;i++){const d=path.join(dir,'shard-'+i);let text='';try{text=fs.readFileSync(path.join(d,'tests.log'),'utf8')}catch(e){}
    let secs=null;try{const t=JSON.parse(fs.readFileSync(path.join(d,'times.json'),'utf8'));Object.assign(times,t.times||{});secs=t.wall}catch(e){}
    const r=readLog(text);all.passes+=r.passes;all.failures+=r.failures;all.flaky+=r.flaky;
    if(!r.done){bad++;fails.push({shard:i,test:'(the shard did not finish: no result line in its log)',lines:[]})}
    for(const f of r.failed)fails.push({shard:i,...f});for(const f of r.flakyNames)flaky.push(`${f} (shard ${i})`);
    rows.push(`| ${i} | ${r.done?r.passes:'–'} | ${r.done?r.failures:'–'} | ${r.flaky||''} | ${secs!=null?Math.round(secs)+' s':'–'} |`)}
  const ok=!bad&&!all.failures;
  out.push(ok?`### All ${all.passes} checks passed`+(all.flaky?` (${all.flaky} flaky, passed on retry)`:''):`### ${all.failures+bad} failed`+` · ${all.passes} passed`+(all.flaky?` · ${all.flaky} flaky`:''));
  out.push('',`${all.passes} passed, ${all.failures} failed`+(all.flaky?`, ${all.flaky} flaky (passed on retry)`:'')+` in ${n} shards`);
  if(fails.length){out.push('','#### Failures','```');for(const f of fails){out.push(`shard ${f.shard} · ${f.test}`);for(const l of f.lines.slice(0,20))out.push('  '+l);if(f.lines.length>20)out.push(`  … ${f.lines.length-20} more`)}out.push('```')}
  if(flaky.length)out.push('','Flaky (failed with other tests running, passed by itself): '+flaky.join(', '));
  out.push('','| shard | passed | failed | flaky | tests took |','|---|---|---|---|---|',...rows);
  const rounded=Object.fromEntries(Object.entries(times).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,Math.round(v*10)/10]));
  fs.writeFileSync(path.join(dir,'shard-times.json'),JSON.stringify(rounded,null,1)+'\n');
  return {ok,text:out.join('\n'),all}}

module.exports={plan,parse,verify,readLog,summary,readTimes,wkShards,TIMES_FILE,WK_HALF,JOBS};

if(require.main===module){const a=process.argv.slice(2);
  // the test list as tests/run.js has it (without starting a run)
  const keys=()=>JSON.parse(require('child_process').execFileSync(process.execPath,[path.join(__dirname,'run.js'),'--keys'],{encoding:'utf8'}));
  if(a[0]==='--plan'){const n=+a[1]||8,w=a[2]!=null?+a[2]:wkShards(),K=keys(),S=plan(K,n,readTimes(),w),why=verify(K,S);
    S.forEach((s,i)=>console.log(`shard ${i+1}/${n}: ${s.keys.length} tests, ${Math.round(s.sum)} s in all, about ${Math.round(s.est)} s at ${JOBS} at a time\n  `+s.keys.join(', ')));
    console.log(why?'✗ '+why:`✓ all ${K.length} tests, each in exactly one of ${n} shards`);process.exit(why?1:0)}
  if(a[0]==='--needs-webkit'){const p=parse(a[1]),w=a[2]!=null?+a[2]:wkShards();if(!p){console.error('usage: --needs-webkit i/N');process.exit(2)}
    console.log(String(plan(keys(),p.n,readTimes(),w)[p.i-1].keys.some(k=>k.endsWith(WK_HALF))));process.exit(0)}
  if(a[0]==='--summary'){const r=summary(a[1],+a[2]);console.log(r.text);process.exit(r.ok?0:1)}
  console.error('usage: node tests/shard.js --plan N [W] | --needs-webkit i/N [W] | --summary <dir> N');process.exit(2)}
