// Gentle GPU use from Node: a port of the owner's C:\code\watch-test\geo3d\gpu_guard.py (the RTX 5090 was lost twice on 2026-11-14 under
// sustained load at only 11.5 GB of memory: not memory, most likely power delivery). The picture builder (tools/asm-prebuild.js --gpu)
// paints on the graphics card only inside this guard:
//
//   const {Guard,GpuLost,LockBusy}=require('./gpu-guard');
//   const g=new Guard('dw-assemble');await g.enter();      // the lock (one GPU job at a time) and a first reading; throws LockBusy / GpuLost
//   try{for(const batch of batches){
//     if(!await g.before({wait:false}))break;             // false: the card is hot or near its power cap (wait:true waits, as the Python one)
//     paint(batch);                                        // one short burst
//     await g.after(name)}}                                // logs the burst's peaks, then the REST_S rest (LONG_REST_S after BUSY_MAX_S of work)
//   finally{await g.exit()}
//
// The same rules as gpu_guard.py, read from it (constants() below) so the two never drift; a copy is kept for a computer without it
// (tests/gpuguard.test.js compares the two). The same lock file (gpu.lock beside gpu_guard.py) in the same format ({"pid": .., "name": ..,
// "since": "HH:MM:SS"}, json.dump's spacing), refused while its process lives, taken over when that process is gone (a stale lock), so the
// builder and the owner's Python GPU scripts never overlap. A watchdog reads nvidia-smi every POLL_S while the guard is held: over HOT_C,
// or power within NEAR_CAP of the limit, pauses (until under COOL_C and below IDLE_W); memory over MEM_STOP_MB, nvidia-smi failing or
// reporting the GPU lost stops (GpuLost; .kind 'memory' or 'lost'). Peaks (temperature, power, memory) are logged per burst and per hold.
const fs=require('fs'),path=require('path'),{execFile,execFileSync}=require('child_process');

const GUARD_PY=process.env.DW_GPU_GUARD_PY||'C:\\code\\watch-test\\geo3d\\gpu_guard.py';
// gpu_guard.py's constants as of 2026-11-14 (used only where that file can't be read; the test fails when they differ)
const COPY={HOT_C:80,COOL_C:68,NEAR_CAP:0.90,IDLE_W:120,MEM_STOP_MB:22*1024,REST_S:20,BUSY_MAX_S:90,LONG_REST_S:60,POLL_S:1.0,
  Q:'temperature.gpu,power.draw,power.limit,memory.used,utilization.gpu'};
const NAMES=Object.keys(COPY);
/* the constants from gpu_guard.py (top-level "A, B = 1, 2" lines of numbers and simple arithmetic, and Q's string), else the copy */
function constants(file=GUARD_PY){let src;try{src=fs.readFileSync(file,'utf8')}catch{return {...COPY,source:'copy'}}
  const out={};
  for(const m of src.matchAll(/^([A-Z_][A-Z0-9_]*(?:\s*,\s*[A-Z_][A-Z0-9_]*)*)\s*=\s*([^#\r\n]+)/gm)){const ns=m[1].split(',').map(s=>s.trim()),rhs=m[2].trim();
    const str=/^'([^'\\]*)'$|^"([^"\\]*)"$/.exec(rhs);if(str&&ns.length===1){out[ns[0]]=str[1]!=null?str[1]:str[2];continue}
    const vs=rhs.split(',').map(s=>s.trim());if(vs.length!==ns.length||!vs.every(v=>/^[\d.\s*+\-/()]+$/.test(v)))continue;
    ns.forEach((n,i)=>{const v=Function('"use strict";return ('+vs[i]+')')();if(Number.isFinite(v))out[n]=v})}
  const C={source:'gpu_guard.py'};for(const n of NAMES){if(!(n in out)||typeof out[n]!==typeof COPY[n])return {...COPY,source:'copy (gpu_guard.py unreadable: '+n+')'};C[n]=out[n]}
  return C}
const K=constants();
const LOCK=process.env.DW_GPU_LOCK||path.join(path.dirname(GUARD_PY),'gpu.lock');   // (DW_GPU_LOCK: the tests' own lock, never the real one)

class GpuLost extends Error{constructor(msg,kind='lost'){super(msg);this.name='GpuLost';this.kind=kind}}
class LockBusy extends Error{constructor(msg,other){super(msg);this.name='LockBusy';this.other=other}}

const pad=n=>String(n).padStart(2,'0'),hms=(d=new Date())=>`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
/* one reading: {temp, power, limit, mem, util}; throws GpuLost when nvidia-smi can't read the card (gpu_guard.read). smi: the command
   (a .js file runs in Node: the tests' simulated card) */
function read(smi=process.env.DW_GPU_SMI||'nvidia-smi'){
  const [cmd,args]=/\.js$/i.test(smi)?[process.execPath,[smi]]:[smi,[]];
  return new Promise((res,rej)=>{execFile(cmd,[...args,'--query-gpu='+K.Q,'--format=csv,noheader,nounits'],{timeout:10000,windowsHide:true},(err,stdout,stderr)=>{
    const txt=String(stdout||'')+String(stderr||'');
    if(err&&err.code==='ENOENT')return rej(new GpuLost('nvidia-smi failed: '+err.message));
    if(err||/lost|unable/i.test(txt))return rej(new GpuLost('nvidia-smi: '+(txt.trim()||String(err&&err.message)).slice(0,300)));
    const v=String(stdout).trim().split(/\r?\n/)[0].split(',').map(x=>x.trim()),f=s=>['[N/A]','N/A',''].includes(s)||s==null?0:parseFloat(s);
    const r={temp:f(v[0]),power:f(v[1]),limit:f(v[2]),mem:f(v[3]),util:f(v[4])};
    if(Object.values(r).some(x=>!Number.isFinite(x)))return rej(new GpuLost('nvidia-smi: unreadable output '+txt.trim().slice(0,200)));
    res(r)})})}
/* whether a process lives (gpu_guard._alive: tasklist; when tasklist can't tell, alive) */
function alive(pid){if(pid===process.pid)return true;
  // not Windows (the nightly run on Linux; the guard itself runs on the owner's Windows PC): signal 0 tells, EPERM = alive but not ours
  if(process.platform!=='win32'){try{process.kill(pid,0);return true}catch(e){return e.code==='EPERM'}}
  try{const out=execFileSync('tasklist',['/FI',`PID eq ${pid}`,'/NH'],{encoding:'utf8',timeout:10000,windowsHide:true});return new RegExp('\\b'+pid+'\\b').test(out)}catch{return true}}
/* the lock as gpu_guard.py writes it: json.dump of {pid, name, since} (", " and ": " between, no newline) */
const lockText=(pid,name,since)=>`{"pid": ${pid}, "name": ${JSON.stringify(String(name)).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))}, "since": "${since}"}`;
function readLock(file=LOCK){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fs.existsSync(file)?{}:null}}

class Guard{
  constructor(name,{log=null,print=null,reader=read,sleep=s=>new Promise(r=>setTimeout(r,s*1000)),clock=()=>performance.now()/1000,restS=K.REST_S,lock=LOCK,isAlive=alive,consts=K}={}){
    Object.assign(this,{name,logf:log,printer:print,reader,sleep,clock,restS,lockFile:lock,isAlive,C:consts});
    this.peak={temp:0,power:0,mem:0};this.burst=null;this.lastBurst=null;this.busy=0;this.hot=false;this.lost=null;this.lostKind=null;
    this.stopped=true;this.t0=null;this.last=null;this.held=false;this.bursts=0;this.rested=0;this._bye=()=>this._release()}
  // ---- lifecycle
  async enter(){const f=this.lockFile;
    const other=readLock(f);
    if(other&&other.pid&&this.isAlive(other.pid))throw new LockBusy(`another GPU job is running (${other.name}, pid ${other.pid}): one at a time`,other);
    fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,lockText(process.pid,this.name,hms()));
    const mine=readLock(f);if(!mine||mine.pid!==process.pid)throw new LockBusy(`another GPU job took the lock (${mine&&mine.name}): one at a time`,mine);
    this.held=true;process.on('exit',this._bye);
    let r;try{r=await this.reader()}catch(e){this._release();throw e}
    this._note(r);
    this.log(`start ${this.name}: ${r.temp.toFixed(0)} C, ${r.power.toFixed(0)} W of ${r.limit.toFixed(0)} W limit, ${r.mem.toFixed(0)} MB used`);
    this.stopped=false;this.watching=this._watch();return this}
  async exit(err){this.stopped=true;if(this.watching)await this.watching.catch(()=>{});this._release();
    this.log(`end ${this.name}: peaks ${this.peak.temp.toFixed(0)} C, ${this.peak.power.toFixed(0)} W, ${this.peak.mem.toFixed(0)} MB`+(err?` (stopped: ${err.message||err})`:''))}
  _release(){if(!this.held)return;this.held=false;process.removeListener('exit',this._bye);
    try{const l=readLock(this.lockFile);if(l&&l.pid===process.pid)fs.unlinkSync(this.lockFile)}catch{}}
  // ---- the watchdog
  async _watch(){while(!this.stopped){let r;try{r=await this.reader()}catch(e){if(e instanceof GpuLost){this._lose(e.message,e.kind);return}throw e}
    if(this.stopped)return;this._note(r);await this.sleep(this.C.POLL_S)}}
  _lose(msg,kind='lost'){if(!this.lost){this.lost=msg;this.lostKind=kind}this.hot=true}
  _note(r){const C=this.C;this.last=r;for(const k in this.peak)this.peak[k]=Math.max(this.peak[k],r[k]);
    if(this.burst)for(const k in this.burst)this.burst[k]=Math.max(this.burst[k],r[k]);
    if(r.mem>C.MEM_STOP_MB)this._lose(`memory ${r.mem.toFixed(0)} MB over the ${C.MEM_STOP_MB} MB stop line`,'memory');
    else if(r.temp>=C.HOT_C||(r.limit&&r.power>=C.NEAR_CAP*r.limit)){if(!this.hot)this.log(`pause: ${r.temp.toFixed(0)} C, ${r.power.toFixed(0)} W of ${r.limit.toFixed(0)} W`);this.hot=true}}
  _check(){if(this.lost)throw new GpuLost(this.lost,this.lostKind)}
  // ---- around each burst
  /* before a burst: the long rest when due; while the card is hot or near its cap, waits until it is under COOL_C and below IDLE_W
     (wait:false: returns false instead of waiting, so the caller can paint on the processor); throws GpuLost */
  async before({wait=true}={}){const C=this.C;this._check();
    if(this.busy>=C.BUSY_MAX_S){this.log(`long rest ${C.LONG_REST_S} s after ${this.busy.toFixed(0)} s of work`);await this._rest(C.LONG_REST_S);this.busy=0}
    while(this.hot){this._check();const r=await this.reader().catch(e=>{if(e instanceof GpuLost){this._lose(e.message,e.kind);return null}throw e});this._check();this._note(r);this._check();
      if(r.temp<C.COOL_C&&r.power<C.IDLE_W){this.log(`resume: ${r.temp.toFixed(0)} C, ${r.power.toFixed(0)} W`);this.hot=false;break}
      if(!wait)return false;
      await this.sleep(2)}
    this._check();this.burst={temp:0,power:0,mem:0};this.t0=this.clock();return true}
  /* after a burst: its time and peaks logged, then the rest; {last:true} (the owner's choice, 2026-11-14) skips the rest after a job's
     final burst, when nothing more follows it (the lock is let go at once); the rests between bursts and every other rule stay */
  async after(what='',{last=false}={}){const dt=this.t0!=null?this.clock()-this.t0:0;this.busy+=dt;this.bursts++;const b=this.burst||{};
    if(this.last&&this.burst)for(const k in b)b[k]=Math.max(b[k],this.last[k]);   // (a burst shorter than POLL_S still has the latest reading)
    this.log(`${what}: ${dt.toFixed(1)} s, peaks ${(b.temp||0).toFixed(0)} C, ${(b.power||0).toFixed(0)} W, ${(b.mem||0).toFixed(0)} MB`);
    this.lastBurst={s:dt,...b};this.burst=null;this.t0=null;this._check();if(!last)await this._rest(this.restS)}
  async _rest(s){const end=this.clock()+s;this.rested+=s;while(this.clock()<end){this._check();await this.sleep(Math.min(1,end-this.clock()))}this._check()}
  log(msg){const line=hms()+' '+msg;if(this.printer)this.printer(line);else console.log(line);
    if(this.logf)try{fs.mkdirSync(path.dirname(this.logf),{recursive:true});fs.appendFileSync(this.logf,line+'\n')}catch{}}
}
module.exports={Guard,GpuLost,LockBusy,read,alive,constants,lockText,readLock,COPY,K,LOCK,GUARD_PY};
