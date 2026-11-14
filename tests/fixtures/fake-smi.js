// A simulated nvidia-smi for the tests (tools/gpu-guard.js runs it in Node when DW_GPU_SMI names a .js file): never the real card.
// DW_FAKE_SMI (or the first word of the file DW_FAKE_SMI_FILE): ok (default), hot (85 C), cap (560 of 575 W), mem (23 GB), lost.
const fs=require('fs');
let mode=process.env.DW_FAKE_SMI||'ok';
try{if(process.env.DW_FAKE_SMI_FILE)mode=fs.readFileSync(process.env.DW_FAKE_SMI_FILE,'utf8').trim().split(/\s+/)[0]||mode}catch{}
if(mode==='lost'){console.log('Unable to determine the device handle for GPU0000:01:00.0: GPU is lost.  Reboot the system to recover this GPU');process.exit(15)}
const [t,p,m]=mode==='hot'?[85,200,4000]:mode==='cap'?[60,560,4000]:mode==='mem'?[60,200,23000]:[48,35,2100];
console.log(`${t}, ${p.toFixed(2)}, 575.00, ${m}, 3`);
