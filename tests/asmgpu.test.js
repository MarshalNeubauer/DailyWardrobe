// The PC pre-build on the graphics card (tools/asm-prebuild.js --gpu, stage 6): end to end against a worker on this machine holding a
// wardrobe of suits and the suit master (tests/fixtures/cm/suit, painted at 512 here), with WebGL2 on SwiftShader and a simulated
// nvidia-smi (tests/fixtures/fake-smi.js): never the real card or the real gpu.lock. The covered looks are painted in the one GPU worker
// inside the guard's bursts and rests; the card hot, the lock held by another GPU job, a lost card or a WebGL2 that isn't the card each
// send them to the CPU pool, and every look is still built.
const fs=require('fs'),os=require('os'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const FIX=path.join(__dirname,'fixtures','cm','suit'),SMI=path.join(__dirname,'fixtures','fake-smi.js'),s=path.join(__dirname,'..','tools','asm-prebuild.js');
  // the worker's records: the suit master and its masks under the app's keys, a background, and a wardrobe of suits, shirts and ties
  const browser=await chromium.launch();let seed;
  try{const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route('https://w.test/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rev:0,saved:0,data:null})}));
    const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const recs={};for(const f of fs.readdirSync(FIX)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');
      recs[n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(FIX,f)).toString('base64'),model:'colormaster',t:1000}}
    seed=await p.evaluate(recs=>{const out={};for(const [n,r] of Object.entries(recs))out[asmCmKey('suit',n)]=r;
      const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#e9e3d9';x.fillRect(0,0,512,512);x.fillStyle='#fbf8f2';x.fillRect(20,45,125,280);
      out[asmCmBgKey()]={sig:'asm/cm-bg test',img:c.toDataURL('image/png'),model:'colormaster',t:4242};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const its=[I('watch','silver',{metal:'silver'}),I('suit','navy'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'silver'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      return {renders:out,items:its,settings:{...settings,dress:undefined,workdays:[0,1,2,3,4,5,6],blazerDays:[0,1,2,3,4,5,6],vestMode:'never'}}},recs);
  }finally{await browser.close()}
  const {pathToFileURL}=require('url'),http=require('http'),worker=(await import(pathToFileURL(path.join(__dirname,'..','worker.js')).href)).default;
  const store=new Map(),meta=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},delete:async k=>{store.delete(k)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  store.set('wardrobe:v1',JSON.stringify({rev:1,saved:1,data:{items:seed.items,days:[],tombstones:{},settings:{...seed.settings,setupDone:1,updated:1}}}));meta.set('wardrobe:v1',{rev:1,saved:1});
  for(const [k,r] of Object.entries(seed.renders))store.set('render:'+k,JSON.stringify(r));
  const env={APP_TOKEN:'owner-code',WARDROBE:KV};let puts=0;
  const srv=http.createServer(async(q,r)=>{let b='';for await(const c of q)b+=c;if(q.method==='PUT'&&/\/render/.test(q.url))puts++;
    const res=await worker.fetch(new Request('http://w'+q.url,{method:q.method,headers:q.headers,body:['GET','HEAD','OPTIONS'].includes(q.method)?undefined:b}),env);
    r.writeHead(res.status,Object.fromEntries(res.headers));r.end(Buffer.from(await res.arrayBuffer()))});
  await new Promise(x=>srv.listen(0,'127.0.0.1',x));const W=`http://127.0.0.1:${srv.address().port}/`;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dw-asmgpu-'));
  const run=(name,args,envx={})=>new Promise(res=>{const lock=path.join(dir,name+'.lock');if(envx.lockBy)fs.writeFileSync(lock,`{"pid": ${envx.lockBy}, "name": "py-job", "since": "10:00:00"}`);
    const c=require('child_process').spawn(process.execPath,[s,'--dry','--days','4','--cm-size','512','--jobs','2','--origin','http://127.0.0.1:9/dw/','--gpu','--gpu-angle','swiftshader','--gpu-match',envx.match||'SwiftShader',...args],
      {env:{...process.env,DW_WORKER:W,DW_TOKEN:'owner-code',DW_GPU_SMI:SMI,DW_GPU_LOCK:lock,DW_GPU_TEST_REST:'0.3',DW_FAKE_SMI:envx.smi||'ok'}});
    let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out,lock:fs.existsSync(lock)?fs.readFileSync(lock,'utf8'):null}))});
  try{
    const [a,busy,lost,hot,sw]=await Promise.all([run('gpu',['--burst','1']),run('busy',[],{lockBy:process.pid}),run('lost',[],{smi:'lost'}),run('hot',[],{smi:'hot'}),run('sw',[],{match:'NVIDIA'})]);
    const num=(o,re)=>+((o.match(re)||[])[1]||-1),looks=num(a.out,/(\d+) looks in the next/),covered=num(a.out,/GPU: (\d+) look\(s\) the graphics chip covers/);
    const tail=o=>(o.match(/Done.*/)||[o.slice(-400)])[0];
    ok(a.code===0&&looks>=2&&covered===looks,`the wardrobe's coming looks are on the suit master, all of them covered by the graphics chip (${looks} looks, ${covered} covered)`);
    ok(/GPU: ANGLE .*SwiftShader.*, largest texture \d+/.test(a.out),`the renderer is checked inside the first burst before any look is painted on it (${(a.out.match(/GPU: ANGLE[^\n]*/)||[''])[0]})`);
    ok(num(a.out,/Painted on the GPU: (\d+)/)===looks&&/on the CPU: 0/.test(a.out)&&(a.out.match(/colour-coded suit, GPU \d+ ms\)/g)||[]).length===looks,`every look painted on the GPU, the log says so per look (${tail(a.out)})`);
    ok(/gpu guard: \d\d:\d\d:\d\d start dw-assemble: 48 C, 35 W of 575 W limit, 2100 MB used/.test(a.out)&&/gpu guard: \d\d:\d\d:\d\d end dw-assemble: peaks 48 C, 35 W, 2100 MB/.test(a.out),'the guard is taken for the GPU work and logs its start and its peaks at the end');
    const bursts=(a.out.match(/gpu guard: \S+ suit: \d+ look\(s\) in [\d.]+ s: [\d.]+ s, peaks 48 C, 35 W, 2100 MB/g)||[]).length;
    ok(bursts>=1&&num(a.out,/(\d+) GPU burst\(s\)/)>=bursts,`each burst (one master's looks, at most --burst seconds) logs its time and peaks, then rests (${bursts} bursts: ${tail(a.out).replace(/.*; /,'')})`);
    ok(a.lock===null,'the lock is let go after the GPU work');
    ok(busy.code===0&&/GPU busy: another GPU job is running \(py-job, pid \d+\): one at a time: painting on the CPU this cycle/.test(busy.out)&&num(busy.out,/on the CPU: (\d+)/)===looks&&/"name": "py-job"/.test(busy.lock||''),
      `another GPU job holding gpu.lock (the owner's Python scripts): every look painted on the CPU pool, and its lock left alone (${tail(busy.out)})`);
    ok(lost.code===0&&/!!!!! THE GRAPHICS CARD WAS LOST: nvidia-smi: .*GPU is lost/.test(lost.out)&&/No GPU painting again until the watcher restarts/.test(lost.out)&&num(lost.out,/on the CPU: (\d+)/)===looks&&lost.lock===null,
      `a lost card (nvidia-smi says so): logged loudly, every look painted on the CPU, no lock left (${tail(lost.out)})`);
    ok(hot.code===0&&/GPU: the card is hot or near its power cap .*: the rest of this cycle on the CPU/.test(hot.out)&&num(hot.out,/on the CPU: (\d+)/)===looks&&num(hot.out,/Painted on the GPU: (\d+)/)===0,
      `the card hot (85 C): the guard says wait, and the looks are painted on the CPU instead (${tail(hot.out)})`);
    ok(sw.code===0&&/GPU painting off for this run: WebGL2 here is ANGLE .*SwiftShader.*not the graphics card \(NVIDIA\)/.test(sw.out)&&num(sw.out,/on the CPU: (\d+)/)===looks&&num(sw.out,/Painted on the GPU: (\d+)/)===0,
      `WebGL2 that isn't the graphics card (SwiftShader, not NVIDIA): no look painted on it, all on the CPU (${tail(sw.out)})`);
    ok(puts===0,'a dry run uploads nothing');
  }finally{srv.close();fs.rmSync(dir,{recursive:true,force:true})}
};
module.exports.assembled=true;   // it runs the colour-coded painter (asm-color.js, asm-gl.js) through the pre-build script
