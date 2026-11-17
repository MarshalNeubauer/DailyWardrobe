/* One test run at a time on this machine, across every worktree (the owner's choice, 2026-11-17: several sessions testing at once
   each started 16 worker processes and Chromiums on his 32 threads). tests/run.js takes a lock file in the OS temp folder before it
   runs anything (`npm test`, `npm run test:all`, `npm run test:webkit`, `node tests/run.js <name>`; not `--list`, not a worker):
   - the lock (`os.tmpdir()/dw-test.lock`, or TEST_LOCK_FILE) holds the holder's pid, start time, worktree and branch; it is made
     with an exclusive create, so two runs starting at once can't both get it; the holder touches it every 15 s (`beat`)
   - a run that finds it held waits, says who holds it and for how long ("waiting for the test run in <worktree> (<branch>, pid …, 4 min)"),
     and looks again every 3 s
   - a lock whose holder is gone (its pid is dead), that wasn't touched for 5 minutes (a frozen holder, or its pid reused) or that is
     older than TEST_LOCK_MAX_AGE minutes (90) is stale: it is taken over, and said so
   - after TEST_LOCK_WAIT minutes of waiting (5; 0 = don't wait), or when the lock can't be used at all (the temp folder not writable),
     the run goes ahead without it, with fewer tests at once (`fallbackJobs`: at most 8, fewer when other runs are going ahead the
     same way) and says so; such a run is listed beside the lock (`dw-test.lock.<pid>`) so the others count it
   - released when the run exits, fails, is stopped with Ctrl+C or is killed (a killed holder's lock is stale at once: its pid is dead;
     its worker processes leave when their parent goes: run.js's worker exits on 'disconnect')
   - TEST_LOCK=0 runs without the lock (and without the busy-machine cap); a run inside a run (TEST_LOCK_HELD, set for the children)
     never waits for its own parent
   `busyCap` is the other half: just before the tests start, how busy the processors already are (two samples of os.cpus() 0.5 s
   apart); when more than a third of them are in use, fewer tests run at once, so the run doesn't pile onto others' work. */
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const LOCK=process.env.TEST_LOCK_FILE||path.join(os.tmpdir(),'dw-test.lock');
const minutes=(v,d)=>{const n=parseFloat(v);return Number.isFinite(n)&&n>=0?n:d};
const WAIT_MAX=minutes(process.env.TEST_LOCK_WAIT,5)*60e3,MAX_AGE=minutes(process.env.TEST_LOCK_MAX_AGE,90)*60e3,BEAT=15e3,DEAD_BEAT=5*60e3,POLL=3e3;
const CORES=os.availableParallelism?os.availableParallelism():os.cpus().length;
const alive=pid=>{if(!(pid>0))return false;try{process.kill(pid,0);return true}catch(e){return e.code==='EPERM'}};
const read=f=>{try{const t=fs.readFileSync(f,'utf8'),st=fs.statSync(f);return {...JSON.parse(t),text:t,mtime:st.mtimeMs}}catch(e){return null}};
const ago=ms=>ms<60e3?Math.max(0,Math.round(ms/1000))+' s':Math.round(ms/60e3)+' min';
const who=h=>`${h.dir||'?'}${h.branch?' ('+h.branch+')':''}, pid ${h.pid}, ${ago(Date.now()-h.start)}`;
/* why a holder no longer counts, or null while it does */
const staleWhy=h=>!h||!(h.pid>0)?'it cannot be read':!alive(h.pid)?'its run (pid '+h.pid+') is gone':Date.now()-h.mtime>DEAD_BEAT?'it was not touched for '+ago(Date.now()-h.mtime):Date.now()-h.start>MAX_AGE?'it is '+ago(Date.now()-h.start)+' old':null;
const branchOf=root=>{try{return execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{cwd:root,stdio:['ignore','pipe','ignore']}).toString().trim()}catch(e){return ''}};
/* the runs going ahead without the lock (fallback), still alive */
const extras=()=>{let L=[];try{L=fs.readdirSync(path.dirname(LOCK)).filter(f=>f.startsWith(path.basename(LOCK)+'.'))}catch(e){}
  const out=[];for(const f of L){const p=path.join(path.dirname(LOCK),f),h=read(p);if(h&&h.pid!==process.pid&&!staleWhy(h))out.push(h);else if(h&&h.pid!==process.pid)try{fs.unlinkSync(p)}catch(e){}}return out};
const fallbackJobs=()=>Math.max(2,Math.min(8,Math.floor(CORES/(2+extras().length))));

let mine=null,timer=null;   // {file, text} of what this process wrote
const write=(file,excl)=>{const me={pid:process.pid,start:Date.now(),dir:ROOT_,branch:BRANCH_,host:os.hostname()},text=JSON.stringify(me);
  fs.writeFileSync(file,text,{flag:excl?'wx':'w'});mine={file,text,me};
  timer=setInterval(()=>{try{const now=new Date();fs.utimesSync(file,now,now)}catch(e){}},BEAT);timer.unref();return me};
let ROOT_='',BRANCH_='';
const release=()=>{if(timer)clearInterval(timer);timer=null;if(!mine)return;
  try{if(fs.readFileSync(mine.file,'utf8')===mine.text)fs.unlinkSync(mine.file)}catch(e){}mine=null};
let hooked=false;
const hook=()=>{if(hooked)return;hooked=true;process.on('exit',release);
  // Ctrl+C, a closed console, a kill: let go of the lock and end (the worker processes leave on 'disconnect')
  for(const s of ['SIGINT','SIGTERM','SIGHUP','SIGBREAK'])try{process.on(s,()=>{release();console.log('\n(test run stopped: '+s+')');process.exit(130)})}catch(e){}};

/* → {how:'held'|'off'|'nested'|'fallback', cap: number|null, note} once the run may start */
const acquire=async(root,log=console.log)=>{ROOT_=root;
  if(process.env.TEST_LOCK==='0')return {how:'off',cap:null,note:'TEST_LOCK=0: running without the machine-wide test lock'};
  if(process.env.TEST_LOCK_HELD&&alive(+process.env.TEST_LOCK_HELD))return {how:'nested',cap:null,note:null};
  BRANCH_=branchOf(root);hook();
  const t0=Date.now();let lastSaid=0,lastWho='';
  for(;;){
    try{write(LOCK,true);process.env.TEST_LOCK_HELD=String(process.pid);
      return {how:'held',cap:null,note:Date.now()-t0>1000?'got the test lock after '+ago(Date.now()-t0)+' of waiting':null}}
    catch(e){if(e.code!=='EEXIST'){const cap=fallbackJobs();try{write(LOCK+'.'+process.pid,false)}catch(e2){}
      return {how:'fallback',cap,note:'the test lock ('+LOCK+') cannot be used ('+e.code+'): running anyway, '+cap+' at a time'}}}
    const h=read(LOCK),why=staleWhy(h);
    if(why){   // take it over, unless someone else just did: remove it only while it still holds what was judged stale
      try{const now=fs.readFileSync(LOCK,'utf8');if(!h||now===h.text){fs.unlinkSync(LOCK);log('taking over a stale test lock ('+(h?who(h):LOCK)+'): '+why)}}catch(e){}
      continue}
    const waited=Date.now()-t0;
    if(waited>=WAIT_MAX){const cap=fallbackJobs();write(LOCK+'.'+process.pid,false);
      return {how:'fallback',cap,note:'waited '+ago(waited)+' for the test run in '+who(h)+': running anyway, '+cap+' at a time instead of up to 16 (TEST_LOCK_WAIT='+WAIT_MAX/60e3+' min)'}}
    if(who(h).split(', pid')[0]!==lastWho||Date.now()-lastSaid>=30e3){lastSaid=Date.now();lastWho=who(h).split(', pid')[0];
      log('waiting for the test run in '+who(h)+(extras().length?'; '+extras().length+' more running without the lock':'')+' (one test run at a time on this machine; TEST_LOCK=0 skips this; going ahead anyway, with fewer at once, after '+ago(WAIT_MAX)+')')}
    await new Promise(r=>setTimeout(r,POLL))}};

/* how busy the processors are now (0–1), from two samples 0.5 s apart */
const busy=async()=>{const s=()=>os.cpus().reduce((a,c)=>{const t=c.times;a.idle+=t.idle;a.all+=t.user+t.nice+t.sys+t.irq+t.idle;return a},{idle:0,all:0});
  const a=s();await new Promise(r=>setTimeout(r,500));const b=s(),all=b.all-a.all;return all>0?1-(b.idle-a.idle)/all:0};
/* the number of tests at once the machine has room for now, or null when it is free enough (more than two thirds idle) */
const busyCap=async jobs=>{if(process.env.TEST_LOCK==='0')return null;const b=await busy();if(b<=1/3)return null;
  const room=Math.max(2,Math.floor(CORES*(1-b))-1);return room<jobs?{cap:room,busy:b}:null};

module.exports={acquire,release,busy,busyCap,fallbackJobs,LOCK,staleWhy,alive};
