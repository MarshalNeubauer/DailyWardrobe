// tools/fill-material.js (CR-8-12, fix round A of the 2026-11-16 code review): its header says --apply saves to the wardrobe (it said
// nothing was ever saved), and a saved item carries field stamps worked out as the app's own itemFields does: only `material` takes the
// new stamp, so another field changed on a phone and not yet synced still wins (the old fs, kept as downloaded, made the tool's copy win
// whole). A local stand-in for the worker; nothing leaves this computer.
module.exports=async({ok})=>{
  const http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
  const tool=path.join(__dirname,'..','tools','fill-material.js'),src=fs.readFileSync(tool,'utf8');
  ok(/--apply SAVES to the wardrobe/.test(src.slice(0,600))&&!/Read-only on the server: it downloads the backup and writes a report; nothing is\s+saved/.test(src),'the header says --apply saves to the wardrobe');
  const items=[{id:'s1',type:'shirt',name:'Blue oxford',primaryColor:'lightblue',added:100,updated:300,fs:{u:300,b:100,s:{name:300}}},
    {id:'t1',type:'tie',name:'Navy grenadine',primaryColor:'navy',added:100,updated:200}];
  let posted=null;const srv=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{r.setHeader('content-type','application/json');
    if(q.method==='POST'){posted=JSON.parse(b);r.end(JSON.stringify({rev:2}));return}
    const cur=posted?items.map(i=>posted.delta.items.find(x=>x.id===i.id)||i):items;r.end(JSON.stringify({rev:posted?2:1,saved:1,items:cur}))})});
  await require('./safeport').listenSafe(srv,'127.0.0.1');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dw-fill-')),want=path.join(dir,'want.json');
  fs.writeFileSync(want,JSON.stringify([{id:'s1',material:'cotton'},{id:'t1',material:'silk'}]));
  try{
    const out=await new Promise(done=>{const c=spawn(process.execPath,[tool,'--apply',want],{env:{...process.env,DW_WORKER:`http://127.0.0.1:${srv.address().port}/`,DW_TOKEN:'test',ANTHROPIC_API_KEY:''}});
      let s='';c.stdout.on('data',d=>s+=d);c.stderr.on('data',d=>s+=d);c.on('close',code=>done({code,s}))});
    const s1=posted&&posted.delta.items.find(i=>i.id==='s1'),t1=posted&&posted.delta.items.find(i=>i.id==='t1');
    ok(out.code===0&&s1&&t1&&/all 2 saved/.test(out.s),`--apply saves both and reads them back (code ${out.code}) ${out.code?out.s.slice(-300):''}`);
    const u=s1&&s1.updated;
    ok(s1&&s1.material==='cotton'&&u>300&&s1.fs&&s1.fs.u===u&&s1.fs.b===100&&s1.fs.s.name===300&&s1.fs.s.material===u,
      `only the material takes the new stamp; the name keeps its own and every other field the old base (${JSON.stringify(s1&&s1.fs)})`);
    ok(t1&&t1.material==='silk'&&t1.fs&&t1.fs.u===t1.updated&&t1.fs.b===200&&t1.fs.s.material===t1.updated,`an item saved without field stamps gets them, as a phone's save gives (${JSON.stringify(t1&&t1.fs)})`);
  }finally{srv.close();fs.rmSync(dir,{recursive:true,force:true})}
};
