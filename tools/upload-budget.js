// This computer's daily cap on uploads to the worker (the owner's ask, 2026-11-14: "limit the pc to only upload 300 items per day").
// Each upload (PUT /render) is one KV write, and the free plan allows 1,000 a day for everything, phones' backups included; on
// 2026-11-14 the PC's picture uploads used them all and every backup failed until the reset. Every PC tool that writes a record asks
// here first (tools/asm-prebuild.js, asm-cm-upload.js; asm-atlas.js uploads nothing since 2026-11-14).
//
// One ledger for every checkout and process on this computer (the watcher's C:\code\dw-assemble, assemble.ps1's copy, a session's
// worktree): a JSON file outside the repo, written under a lock file so two processes can't both take the last write.
//   DW_UPLOAD_LIMIT   writes a day (default 300)
//   DW_UPLOAD_LEDGER  the ledger file (default <home>\.dw-upload-budget.json)
// The day is the UTC date: the worker's allowance resets at 00:00 UTC (03:00 in Kuwait). A write is counted when it is asked for,
// whether or not the worker takes it (a refused write may still have cost one).
const fs=require('fs'),path=require('path'),os=require('os');
const LIMIT=Math.max(0,Math.floor(+(process.env.DW_UPLOAD_LIMIT??300)));
const FILE=process.env.DW_UPLOAD_LEDGER||path.join(os.homedir(),'.dw-upload-budget.json');
const LOCK=FILE+'.lock';
const day=(t=Date.now())=>new Date(t).toISOString().slice(0,10);
const nap=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
function locked(fn){
  for(let i=0;i<400;i++){
    let fd;try{fd=fs.openSync(LOCK,'wx')}catch(e){
      if(e.code!=='EEXIST')throw e;
      try{if(Date.now()-fs.statSync(LOCK).mtimeMs>15000)fs.unlinkSync(LOCK)}catch{}   // a lock left by a process that died
      nap(25);continue}
    try{return fn()}finally{fs.closeSync(fd);try{fs.unlinkSync(LOCK)}catch{}}}
  throw new Error('upload budget: the ledger stayed locked ('+LOCK+')')}
function read(){const d=day();try{const j=JSON.parse(fs.readFileSync(FILE,'utf8'));if(j&&j.day===d&&Number.isFinite(+j.used))return {day:d,used:+j.used}}catch{}return {day:d,used:0}}
function write(j){const tmp=FILE+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify({...j,at:new Date().toISOString()}));fs.renameSync(tmp,FILE)}
// take n writes from today's budget: all of them or none (true / false)
function take(n=1){n=Math.max(0,Math.floor(n));return locked(()=>{const j=read();if(j.used+n>LIMIT)return false;j.used+=n;write(j);return true})}
// give back writes taken but not made (a reserved batch that turned out smaller)
function give(n=1){n=Math.max(0,Math.floor(n));if(!n)return;locked(()=>{const j=read();j.used=Math.max(0,j.used-n);write(j)})}
const used=()=>read().used;
const left=()=>Math.max(0,LIMIT-read().used);
const resetAt=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)};
const why=()=>`this computer's daily upload limit (${LIMIT}) is used up: uploads wait until ${new Date(resetAt()).toLocaleString()} (00:00 UTC)`;
module.exports={take,give,used,left,resetAt,why,LIMIT,FILE,day};
