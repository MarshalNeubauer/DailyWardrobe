// The PC pre-build on the graphics card (tools/asm-prebuild.js --gpu, stage 6): end to end against a worker on this machine holding a
// wardrobe of suits and the suit master (tests/fixtures/cm/suit, painted at 512 here), with WebGL2 on SwiftShader: never the real card.
// The covered looks are painted in the one GPU worker, one after another (no GPU guard since 2026-11-14, the owner's ask); a WebGL2 that
// isn't the card sends them to the CPU pool, and every look is still built.
const fs=require('fs'),os=require('os'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const FIX=path.join(__dirname,'fixtures','cm','suit'),s=path.join(__dirname,'..','tools','asm-prebuild.js');
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
  const run=(name,args,envx={})=>new Promise(res=>{
    const c=require('child_process').spawn(process.execPath,[s,'--dry','--days','4','--cm-size','512','--jobs','2','--origin','http://127.0.0.1:9/dw/','--gpu','--gpu-angle','swiftshader','--gpu-match',envx.match||'SwiftShader',...args],
      {env:{...process.env,DW_WORKER:W,DW_TOKEN:'owner-code'}});
    let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>res({code,out}))});
  try{
    const [a,sw]=await Promise.all([run('gpu',[]),run('sw',[],{match:'NVIDIA'})]);
    const num=(o,re)=>+((o.match(re)||[])[1]||-1),looks=num(a.out,/(\d+) looks in the next/),covered=num(a.out,/GPU: (\d+) look\(s\) the graphics chip covers/);
    const tail=o=>(o.match(/Done.*/)||[o.slice(-400)])[0];
    ok(a.code===0&&looks>=2&&covered===looks,`the wardrobe's coming looks are on the suit master, all of them covered by the graphics chip (${looks} looks, ${covered} covered)`);
    ok(/GPU: ANGLE .*SwiftShader.*, largest texture \d+/.test(a.out),`the renderer is checked before any look is painted on it (${(a.out.match(/GPU: ANGLE[^\n]*/)||[''])[0]})`);
    ok(num(a.out,/Painted on the GPU: (\d+)/)===looks&&/on the CPU: 0/.test(a.out)&&(a.out.match(/colour-coded suit, GPU \d+ ms\)/g)||[]).length===looks,`every look painted on the GPU, the log says so per look (${tail(a.out)})`);
    ok(!/gpu guard|burst|rest/i.test(a.out.replace(/the rest of this cycle/g,'')),'no guard: no bursts, rests or card readings in the log');
    ok(sw.code===0&&/GPU painting off for this run: WebGL2 here is ANGLE .*SwiftShader.*not the graphics card \(NVIDIA\)/.test(sw.out)&&num(sw.out,/on the CPU: (\d+)/)===looks&&num(sw.out,/Painted on the GPU: (\d+)/)===0,
      `WebGL2 that isn't the graphics card (SwiftShader, not NVIDIA): no look painted on it, all on the CPU (${tail(sw.out)})`);
    ok(puts===0,'a dry run uploads nothing');
  }finally{srv.close();fs.rmSync(dir,{recursive:true,force:true})}
};
module.exports.assembled=true;   // it runs the colour-coded painter (asm-color.js, asm-gl.js) through the pre-build script
