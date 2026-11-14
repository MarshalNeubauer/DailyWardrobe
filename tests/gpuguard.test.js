// The Node port of the owner's GPU guard (tools/gpu-guard.js, of C:\code\watch-test\geo3d\gpu_guard.py), checked on a simulated card
// with a virtual clock, as test_gpu_guard.py checks the Python one: nothing here touches the graphics card or the real gpu.lock.
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
module.exports=async({ok})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dw-gpuguard-')),LOCK=path.join(dir,'gpu.lock');
  process.env.DW_GPU_LOCK=LOCK;   // (read when the module loads: the default lock of every Guard in this test is the test's own)
  delete require.cache[require.resolve('../tools/gpu-guard.js')];
  const G=require('../tools/gpu-guard.js'),C=G.K;
  ok(G.LOCK===LOCK,'the tests use their own lock file, never the real one');
  // the constants: read from gpu_guard.py where it is (this PC), and its copy the same; the lock beside it
  const PY=G.GUARD_PY,hasPy=fs.existsSync(PY);
  if(hasPy){const c=G.constants(PY);ok(c.source==='gpu_guard.py'&&Object.keys(G.COPY).every(k=>c[k]===G.COPY[k]),`the constants are read from gpu_guard.py, and the copy in gpu-guard.js matches them (${Object.keys(G.COPY).map(k=>k+' '+c[k]).join(', ')})`)}
  else ok(true,'gpu_guard.py is not on this computer: the copy of its constants is used');
  ok(C.HOT_C===80&&C.COOL_C===68&&C.NEAR_CAP===.9&&C.MEM_STOP_MB===22*1024&&C.REST_S===20&&C.BUSY_MAX_S===90&&C.LONG_REST_S===60,'the rules: pause over 80 C or at 90% of the power limit until under 68 C, stop over 22 GB, 20 s rests, 60 s after 90 s of work');
  const fake=path.join(dir,'gpu_guard.py');fs.writeFileSync(fake,"import os\nHOT_C, COOL_C = 81, 67   # x\nNEAR_CAP = 0.85\nIDLE_W = 100\nMEM_STOP_MB = 20 * 1024\nREST_S, BUSY_MAX_S, LONG_REST_S = 25, 80, 70\nPOLL_S = 0.5\nQ = 'a,b'\n");
  const fc=G.constants(fake);ok(fc.source==='gpu_guard.py'&&fc.HOT_C===81&&fc.COOL_C===67&&fc.MEM_STOP_MB===20480&&fc.REST_S===25&&fc.LONG_REST_S===70&&fc.Q==='a,b','a change in gpu_guard.py reaches the Node guard (the constants are parsed, not copied)');
  ok(G.constants(path.join(dir,'none.py')).source==='copy','without gpu_guard.py the copy is used');
  {const env={...process.env};delete env.DW_GPU_LOCK;delete env.DW_GPU_GUARD_PY;
    const r=spawnSync(process.execPath,['-e',"console.log(require('./tools/gpu-guard.js').LOCK)"],{cwd:path.join(__dirname,'..'),encoding:'utf8',env});
    ok(r.stdout.trim().toLowerCase()===path.join(path.dirname(G.GUARD_PY),'gpu.lock').toLowerCase(),`the real lock is gpu.lock beside gpu_guard.py (${r.stdout.trim()})`)}

  // a simulated card whose readings follow a script of (temp, power, mem) as virtual time passes
  const Card=(fn,limit=575)=>{const c={t:0,lost:false,reads:0};
    c.read=async()=>{c.reads++;if(c.lost)throw new G.GpuLost('GPU is lost (simulated)');const [temp,power,mem]=fn(c.t);return {temp,power,limit,mem,util:50}};
    c.sleep=async s=>{c.t+=s;await new Promise(r=>setImmediate(r))};c.clock=()=>c.t;return c};
  const lines=[],guard=(c,name,o={})=>new G.Guard(name,{reader:c.read,sleep:c.sleep,clock:c.clock,print:l=>lines.push(l),...o});
  const tick=async(n=20)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r))};
  if(fs.existsSync(LOCK))fs.unlinkSync(LOCK);
  // 1. a calm card: each burst is followed by the rest; after 90 s of work, a long rest
  {const c=Card(()=>[55,300,9000]),g=guard(c,'calm');await g.enter();
    const t0=c.t;await g.before();c.t+=10;await g.after('one');
    ok(c.t-t0>=10+C.REST_S,`a ${C.REST_S} s rest follows each burst (${(c.t-t0).toFixed(0)} s for a 10 s burst)`);
    {const t1=c.t;await g.before();c.t+=10;await g.after('final',{last:true});ok(c.t-t1<10+1,`no rest after a job's last burst ({last:true}): ${(c.t-t1).toFixed(0)} s for a 10 s burst`)}
    ok(fs.existsSync(LOCK)&&G.readLock().pid===process.pid,'the lock is held while the guard is');
    const n0=lines.length;for(let i=0;i<12;i++){await g.before();c.t+=10;await g.after('b'+i)}
    const longs=lines.slice(n0).filter(l=>/ long rest /.test(l));
    ok(longs.length>=1,`after ${C.BUSY_MAX_S} s of work a ${C.LONG_REST_S} s long rest (${longs.length} in 13 bursts of 10 s: ${longs[0]})`);
    ok(lines.some(l=>/ b0: 10\.0 s, peaks 55 C, 300 W, 9000 MB/.test(l)),'each burst logs its time and peaks');
    await g.exit();ok(!fs.existsSync(LOCK),'the lock is released at the end');
    ok(/ end calm: peaks 55 C, 300 W, 9000 MB$/.test(lines[lines.length-1]),'the whole run\'s peaks are logged at the end')}
  // 2. heat: over 80 C the next burst waits until under 68 C; with wait:false it says no instead (the builder then paints on the CPU)
  {const c=Card(t=>t<40?[85,200,9000]:t<60?[70,100,9000]:[60,80,9000]),g=guard(c,'hot');await g.enter();await tick();
    const no=await g.before({wait:false});ok(no===false&&c.t<40,'a hot card (85 C): before({wait:false}) says no at once');
    ok(await g.before()===true&&c.t>=60,`... and before() waits it out until under ${C.COOL_C} C (resumed at ${c.t.toFixed(0)} s)`);await g.after('x');await g.exit()}
  // 3. power near the cap pauses too
  {const c=Card(t=>t<30?[60,540,9000]:[55,90,9000]),g=guard(c,'power');await g.enter();await tick();
    await g.before();ok(c.t>=30,`power at 94% of the limit pauses until idle (resumed at ${c.t.toFixed(0)} s)`);await g.after('x');await g.exit()}
  // 4. memory over the stop line stops
  {const c=Card(()=>[60,300,23000]),g=guard(c,'mem');let e=null;await g.enter();await tick();try{await g.before()}catch(x){e=x}await g.exit(e);
    ok(e instanceof G.GpuLost&&e.kind==='memory'&&/memory/.test(e.message),'memory over 22 GB stops the job (GpuLost, kind memory)')}
  // 5. the GPU disappearing stops at the next step, even mid-rest
  {const c=Card(()=>[60,300,9000]),g=guard(c,'lost');let e=null;await g.enter();
    try{await g.before();c.lost=true;await tick();await g.after('x')}catch(x){e=x}await g.exit(e);
    ok(e instanceof G.GpuLost&&e.kind==='lost','a lost GPU stops the job at once');ok(!fs.existsSync(LOCK),'the lock is released after a stop too');
    const c2=Card(()=>[60,300,9000]);c2.lost=true;let e2=null;try{await guard(c2,'lost-at-start').enter()}catch(x){e2=x}
    ok(e2 instanceof G.GpuLost&&!fs.existsSync(LOCK),'a card already lost: entering fails and leaves no lock')}
  // 6. one job at a time, in gpu_guard.py's lock format; a stale lock (dead process) doesn't block
  {const c=Card(()=>[50,80,5000]),g=guard(c,'first');await g.enter();
    const txt=fs.readFileSync(LOCK,'utf8');ok(new RegExp(`^\\{"pid": ${process.pid}, "name": "first", "since": "\\d\\d:\\d\\d:\\d\\d"\\}$`).test(txt),`the lock is written as gpu_guard.py writes it (${txt})`);
    let e=null;try{await guard(c,'second').enter()}catch(x){e=x}ok(e instanceof G.LockBusy&&/one at a time/.test(e.message),'a second GPU job is refused while one runs');
    await g.exit();
    fs.writeFileSync(LOCK,JSON.stringify({pid:999999,name:'dead'}));const g2=guard(c,'after-stale');await g2.enter();ok(G.readLock().name==='after-stale','a stale lock from a finished process does not block');await g2.exit();
    fs.writeFileSync(LOCK,'{not json');const g3=guard(c,'after-junk');await g3.enter();ok(G.readLock().name==='after-junk','an unreadable lock is stale too (as gpu_guard.py)');await g3.exit();
    fs.writeFileSync(LOCK,JSON.stringify({pid:4,name:'python-job',since:'10:00:00'}));let e3=null;try{await guard(c,'x',{isAlive:()=>true}).enter()}catch(x){e3=x}
    ok(e3 instanceof G.LockBusy&&e3.other.name==='python-job'&&fs.existsSync(LOCK),'a Python job\'s lock is respected and left in place');fs.unlinkSync(LOCK)}
  // 7. the Python guard and this one share the lock both ways (where python and gpu_guard.py are: this PC; a simulated card, no torch)
  const py=hasPy&&['python','py'].find(p=>{try{return spawnSync(p,['--version'],{encoding:'utf8'}).status===0}catch{return false}});
  if(py){const code=`import sys,json;sys.path.insert(0,r'${path.dirname(PY)}');import gpu_guard as G
G.LOCK=r'${LOCK}'
r=lambda:{'temp':50,'power':80,'limit':575,'mem':5000,'util':0}
try:
  with G.Guard('py-job',reader=r,use_torch=False,sleep=lambda s:None): pass
  print('ran')
except RuntimeError as e: print('refused', e)`;
    const c=Card(()=>[50,80,5000]),g=guard(c,'node-job');await g.enter();const a=spawnSync(py,['-c',code],{encoding:'utf8'});await g.exit();
    ok(/^refused .*node-job/.test(a.stdout.trim()),`gpu_guard.py refuses to start while the Node guard holds the lock (${a.stdout.trim()||a.stderr.trim().slice(-200)})`);
    const hold=`import sys,json,os,time;sys.path.insert(0,r'${path.dirname(PY)}');import gpu_guard as G
json.dump({'pid': os.getpid(), 'name': 'py-job', 'since': time.strftime('%H:%M:%S')}, open(r'${LOCK}', 'w'))
print('held');sys.stdout.flush();time.sleep(30)`;
    const {spawn}=require('child_process'),ch=spawn(py,['-c',hold]);await new Promise(r=>ch.stdout.once('data',r));
    let e=null;try{await guard(c,'node-job2').enter()}catch(x){e=x}ch.kill();
    ok(e instanceof G.LockBusy&&e.other.name==='py-job','the Node guard refuses to start while a Python job holds the lock');
    try{fs.unlinkSync(LOCK)}catch{}}
  else ok(true,'python or gpu_guard.py is not here: the shared-lock check runs on the owner\'s PC');
  // 8. the simulated nvidia-smi the builder's tests use reads like the real one, and a lost card reads as lost
  {const smi=path.join(__dirname,'fixtures','fake-smi.js');
    const r=await G.read(smi);ok(r.limit===575&&r.temp>0&&r.mem>0,`a reading: ${JSON.stringify(r)}`);
    process.env.DW_FAKE_SMI='lost';let e=null;try{await G.read(smi)}catch(x){e=x}delete process.env.DW_FAKE_SMI;
    ok(e instanceof G.GpuLost&&/lost/i.test(e.message),`nvidia-smi reporting the GPU lost: GpuLost (${e&&e.message})`);
    let e2=null;try{await G.read(path.join(dir,'no-such-smi.exe'))}catch(x){e2=x}ok(e2 instanceof G.GpuLost,'nvidia-smi missing or failing: GpuLost')}
  delete process.env.DW_GPU_LOCK;delete require.cache[require.resolve('../tools/gpu-guard.js')];
  fs.rmSync(dir,{recursive:true,force:true});
};
