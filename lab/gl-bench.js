/* DailyWardrobe lab (not part of the app): the page side of lab/gl-bench.html, the WebGL2 painter bench for a phone. It reports the
   device, builds the four looks' jobs from the suit fixtures (tests/fixtures/cm/suit, 512 px, enlarged to the chosen size), runs the
   bench in a Web Worker (lab/gl-bench-run.js), and on the page thread when the Worker has no WebGL, then shows the results with a
   "Copy results" button. Nothing is sent anywhere and nothing heavy runs before Start is tapped. */
/* global asmCmKey, asmCmBgKey, asmCmJob, glbRun, GLB_WORKER_SRC, GLB_APP_VERSION, glbErrors, items:writable */
const GLB_VER='2026-11-14.2';
/* the CPU painter compared against: the app's own asm-color.js against the app's own asm-gl.js (since stage 1 of the port, both from main:
   their random cloth details share one 32-bit hash, asmH32 / asmCellV, so they agree within 2 levels; before, the bench pinned a copy of
   asm-color.js from 66b6295 beside the prototype asm-gl.js of PR #355) */
const GLB_PAINTER='asm-color.js from main (the app\'s CPU painter)';
const GLB_FIX=['master.jpg','mask-background.png','mask-dark.png','mask-jacket.png','mask-shirt.png','mask-skin.png','mask-tie.png','mask-watch.png','part-lapelL.png','part-lapelR.png','part-sleeveL.png','part-sleeveR.png'];
const GLB_LS='dw_lab_glbench_run';   // this page's own note of a run in progress (a run that kills the tab is reported at the next load)
var renders={};   // asm-color.js reads the masters from the app's `renders` (app.js, not loaded here)
/* app.js's record key hash (app.js is not loaded here): only names the records in `renders` */
function fnv64(t){let h=0xcbf29ce484222325n;for(const c of new TextEncoder().encode(t)){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}return h.toString(16).padStart(16,'0')}
const glb$=id=>document.getElementById(id);
const glbEsc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const glbLsSet=v=>{try{v?localStorage.setItem(GLB_LS,JSON.stringify(v)):localStorage.removeItem(GLB_LS)}catch{}};
const glbLsGet=()=>{try{return JSON.parse(localStorage.getItem(GLB_LS)||'null')}catch{return null}};
let GLB_DEV=null,GLB_PROBE=null,GLB_PROBE_P=Promise.resolve(null),GLB_PREV=null,GLB_RES=null,glbBusy=false;

/* ---- the device ---- */
function glbGlInfo(gl){if(!gl)return null;const x=gl.getExtension('WEBGL_debug_renderer_info');
  const r={renderer:x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:x?gl.getParameter(x.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
    version:gl.getParameter(gl.VERSION),maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE),debugInfo:!!x};
  const lx=gl.getExtension('WEBGL_lose_context');if(lx)lx.loseContext();return r}
function glbDevice(){const n=navigator,d={ua:n.userAgent,platform:n.platform||null,dpr:window.devicePixelRatio,cores:n.hardwareConcurrency||null,
    deviceMemoryGB:n.deviceMemory||null,screen:screen.width+'x'+screen.height,viewport:innerWidth+'x'+innerHeight};
  if(performance.memory){const m=performance.memory,mb=v=>Math.round(v/1048576);d.memory={jsHeapSizeLimitMB:mb(m.jsHeapSizeLimit),totalJSHeapSizeMB:mb(m.totalJSHeapSize),usedJSHeapSizeMB:mb(m.usedJSHeapSize)}}
  else d.memory=null;
  try{const c=document.createElement('canvas');c.width=c.height=8;d.pageWebGL2=glbGlInfo(c.getContext('webgl2'))}catch(e){d.pageWebGL2=null;d.pageWebGL2Err=String(e.message||e)}
  try{d.pageOffscreenWebGL2=typeof OffscreenCanvas!=='undefined'?!!glbGlInfo(new OffscreenCanvas(8,8).getContext('webgl2')):false}catch{d.pageOffscreenWebGL2=false}
  return d}
function glbWorker(){return new Worker(URL.createObjectURL(new Blob([GLB_WORKER_SRC],{type:'text/javascript'})))}
function glbProbeWorker(){return new Promise(ok=>{let w=null,done=false;const end=r=>{if(done)return;done=true;clearTimeout(to);try{w&&w.terminate()}catch{}ok(r)};
  const to=setTimeout(()=>end({worker:false,err:'the Worker did not answer in 20 s'}),20000);
  try{w=glbWorker()}catch(e){end({worker:false,err:String(e.message||e)});return}
  w.onerror=e=>{e.preventDefault&&e.preventDefault();end({worker:false,err:'Worker error: '+(e.message||'could not start')})};
  w.onmessage=e=>{const d=e.data||{};if(d.type==='ready')w.postMessage({type:'probe'});else if(d.type==='probe')end({worker:true,...d.probe});else if(d.type==='error')end({worker:false,err:d.error})}})}
const glbYes=v=>v?'<b class="ok">yes</b>':'<b class="no">no</b>';
function glbShowDevice(){const d=GLB_DEV,p=GLB_PROBE,rows=[['Browser',d.ua],['Page WebGL2',d.pageWebGL2?glbYes(1)+' '+glbEsc(d.pageWebGL2.renderer)+' ('+glbEsc(d.pageWebGL2.vendor)+'), max texture '+d.pageWebGL2.maxTex:glbYes(0)],
    ['Page OffscreenCanvas WebGL2',glbYes(d.pageOffscreenWebGL2)],
    ['Worker',p?(p.worker?glbYes(1)+(p.offscreen?'':' no OffscreenCanvas'):glbYes(0)+' '+glbEsc(p.err||'')):'checking…'],
    ['Worker WebGL2 (OffscreenCanvas)',p?(p.webgl2?glbYes(1)+' '+glbEsc(p.renderer)+', max texture '+p.maxTex:glbYes(0)+(p.err?' '+glbEsc(p.err):'')):'checking…'],
    ['Pixel ratio',d.dpr],['Cores (hardwareConcurrency)',d.cores==null?'not given':d.cores],
    ['performance.memory',d.memory?`limit ${d.memory.jsHeapSizeLimitMB} MB, used ${d.memory.usedJSHeapSizeMB} MB`:'not available (Safari has none)'],
    ['App scripts',glbEsc(GLB_APP_VERSION||'?')+' (from main, past the app’s offline cache); the CPU painter: '+GLB_PAINTER]];
  glb$('device').innerHTML=rows.map(([k,v])=>`<div class="kv"><span>${glbEsc(k)}</span><span>${k==='Browser'?glbEsc(v):v}</span></div>`).join('')}

/* ---- the looks: the suit fixtures as the app's records, a stand-in background, four outfits ---- */
const glbDataUrl=async u=>{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(u.split('/').pop()+': HTTP '+r.status);const b=await r.blob();
  return {url:await new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>no(new Error('could not read '+u));f.readAsDataURL(b)}),bytes:b.size}};
/* a cream wall, a window on the left, a desk and laptop at the lower right, blurred (tools/asm-gl-bench.js's, with fixed noise) */
function glbBackground(){const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');let g=x.createLinearGradient(0,0,1024,0);
  g.addColorStop(0,'#efe9df');g.addColorStop(1,'#d9d1c4');x.fillStyle=g;x.fillRect(0,0,1024,1024);
  x.fillStyle='#fbf8f2';x.fillRect(40,90,250,560);x.fillStyle='#cfc6b8';for(let i=0;i<4;i++)x.fillRect(40,90+i*140,250,8);x.fillStyle='#7a5c40';x.fillRect(600,760,424,40);x.fillStyle='#5a4330';x.fillRect(640,800,40,224);
  x.fillStyle='#2b2d31';x.fillRect(760,640,190,120);x.fillStyle='#45484e';x.fillRect(740,752,230,10);
  const id=x.getImageData(0,0,1024,1024);let s=12345;const rnd=()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s/4294967296};
  for(let k=0;k<id.data.length;k+=4){const v=(rnd()-.5)*6;id.data[k]+=v;id.data[k+1]+=v;id.data[k+2]+=v}x.putImageData(id,0,0);
  const b=document.createElement('canvas');b.width=b.height=1024;const bx=b.getContext('2d');bx.filter='blur(6px)';bx.drawImage(c,0,0);return b.toDataURL('image/jpeg',.9)}
async function glbJobs(S,status){const base=new URL('../tests/fixtures/cm/suit/',location.href).href;renders={};let bytes=0,n=0;
  await Promise.all(GLB_FIX.map(async f=>{const d=await glbDataUrl(base+f);bytes+=d.bytes;status(`Downloading the suit master's files ${++n}/${GLB_FIX.length}`);
    const name=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');renders[asmCmKey('suit',name)]={img:d.url,t:1000,sig:'asm/cm lab'}}));
  renders[asmCmBgKey()]={img:glbBackground(),t:4242,sig:'asm/cm-bg lab'};
  let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
  const W={watch:I('watch','silver',{metal:'silver'}),navy:I('suit','navy'),grey:I('suit','midgrey'),twn:I('suit','navy',{pattern:'twill'}),tw2:I('suit','tan',{pattern:'twill',secondaryColor:'brown'}),
    shirt:I('shirt','pink'),shirtw:I('shirt','white'),tie:I('tie','burgundy'),tien:I('tie','navy')};
  items=Object.values(W);
  const looks=[['plain-navy',W.navy,W.shirt,W.tie],['plain-midgrey',W.grey,W.shirtw,W.tien],['twill-navy',W.twn,W.shirtw,W.tie],['twill2-tan-brown',W.tw2,W.shirt,W.tien]],jobs=[];
  for(const [name,top,shirt,tie] of looks){const j=await asmCmJob({shirt,watch:W.watch,top,tie});if(!j)throw new Error('no job for '+name+' (the master files did not load)');
    j.diskCache=false;j.name=name;j.size=S;jobs.push(j)}
  return {jobs,bytes}}

/* ---- running ---- */
function glbProgress(where,p){const pct=p.total?Math.min(100,Math.round(100*p.done/p.total)):0;glb$('bar').style.width=pct+'%';glb$('step').textContent=`${where}: ${p.msg}`;
  const s=glbLsGet();if(s)glbLsSet({...s,at:where+': '+p.msg,t:Date.now()})}
function glbLog(msg,bad){const li=document.createElement('li');li.textContent=msg;if(bad)li.className='bad';glb$('log').appendChild(li)}
/* the bench in a Web Worker; a Worker that stops answering for 3 minutes is reported (iOS can end one without a word when memory runs out) */
function glbInWorker(o){return new Promise(ok=>{let w,done=false,last=Date.now();const end=r=>{if(done)return;done=true;clearInterval(dog);try{w.terminate()}catch{}ok(r)};
  const dog=setInterval(()=>{if(Date.now()-last>180000)end({error:'the Worker stopped answering for 3 minutes (out of memory?)'})},2000);
  try{w=glbWorker()}catch(e){end({error:'could not start the Worker: '+(e.message||e)});return}
  w.onerror=e=>{e.preventDefault&&e.preventDefault();end({error:'Worker error: '+(e.message||'it stopped (out of memory?)')})};
  w.onmessageerror=()=>end({error:'a Worker message could not be read'});
  w.onmessage=e=>{const d=e.data||{};last=Date.now();
    if(d.type==='ready')w.postMessage({type:'run',o});
    else if(d.type==='progress')glbProgress('Worker',d);
    else if(d.type==='result')end({out:d.out,thumbs:d.thumbs});
    else if(d.type==='error')end({error:d.error})}})}
async function glbOnPage(o){try{return await glbRun(o,p=>glbProgress('Page thread',p))}catch(e){return {error:String(e&&e.message||e)}}}

async function glbStart(){if(glbBusy)return;glbBusy=true;
  const S=+document.querySelector('input[name=size]:checked').value,runs=+glb$('runs').value,half=false,alsoPage=glb$('alsopage').checked;
  for(const el of document.querySelectorAll('#opts input,#opts select,#start'))el.disabled=true;
  glb$('results').hidden=true;glb$('progress').hidden=false;glb$('log').innerHTML='';glb$('bar').style.width='0%';
  const t0=Date.now(),tick=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);glb$('elapsed').textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`},1000);
  glb$('step').textContent='Checking the Worker…';GLB_PROBE=await GLB_PROBE_P;
  let lock=null;try{if(navigator.wakeLock)lock=await navigator.wakeLock.request('screen')}catch{}
  const R={bench:'DailyWardrobe WebGL2 painter (lab/gl-bench.html, '+GLB_VER+')',app:GLB_APP_VERSION,cpuPainter:GLB_PAINTER,when:new Date().toISOString(),options:{size:S,runs,half,alsoPage},
    device:GLB_DEV,workerProbe:GLB_PROBE,previousRunStopped:GLB_PREV,wakeLock:!!lock,errors:[]};
  GLB_RES=R;glbLsSet({size:S,at:'starting',t:Date.now()});
  try{
    glb$('step').textContent='Building the looks…';let t=performance.now();const J=await glbJobs(S,m=>{glb$('step').textContent=m});R.jobsMs=Math.round(performance.now()-t);R.fixtureBytes=J.bytes;
    glbLog(`Looks ready in ${R.jobsMs} ms (${J.jobs.length} looks, ${Math.round(J.bytes/1024)} KB of master files)`);
    const P=GLB_PROBE||{};
    if(P.worker&&P.offscreen&&P.canvas2d&&P.bitmap&&P.frs){glbLog('Worker: CPU, then GL'+(P.webgl2?'':' (no WebGL2 there: CPU only)'));
      R.worker=await glbInWorker({jobs:J.jobs,S,runs,cpuRuns:runs,half,gl:true,thumb:180});
      if(R.worker.error){R.errors.push('worker: '+R.worker.error);glbLog('Worker failed: '+R.worker.error,true)}
      else{for(const e of R.worker.out.errors)R.errors.push('worker: '+e);glbLog(`Worker done (${R.worker.out.errors.length} errors)`,R.worker.out.errors.length>0)}}
    else{R.worker={skipped:'this Worker cannot paint (needs OffscreenCanvas 2D, createImageBitmap and FileReaderSync)'};glbLog('Worker skipped: '+R.worker.skipped,true)}
    const wo=R.worker&&R.worker.out,workerGL=!!(wo&&wo.looks.some(l=>l.gl!=null)),workerCPU=!!(wo&&wo.looks.some(l=>l.cpu!=null));
    if(!workerGL||alsoPage){glbLog('Page thread: '+(workerCPU?'GL (and one CPU run per look, for the comparison)':'CPU and GL'));glbLsSet({...glbLsGet(),at:'page thread'});
      R.page=await glbOnPage({jobs:J.jobs,S,runs,cpuRuns:workerCPU?1:runs,half,gl:true,thumb:180});
      if(R.page.error){R.errors.push('page: '+R.page.error);glbLog('Page thread failed: '+R.page.error,true)}
      else{for(const e of R.page.out.errors)R.errors.push('page: '+e);glbLog(`Page thread done (${R.page.out.errors.length} errors)`,R.page.out.errors.length>0)}}
  }catch(e){R.errors.push('bench: '+String(e&&e.message||e));glbLog('Stopped: '+(e&&e.message||e),true)}
  finally{clearInterval(tick);R.totalSeconds=Math.round((Date.now()-t0)/1000);if(lock)try{await lock.release()}catch{}
    R.pageErrors=glbErrors.slice();glbLsSet(null);glbBusy=false;
    for(const el of document.querySelectorAll('#opts input,#opts select,#start'))el.disabled=false;glb$('start').textContent='Run again';
    glb$('step').textContent=`Finished in ${R.totalSeconds} s`+(R.errors.length?` with ${R.errors.length} error${R.errors.length>1?'s':''}`:'');glb$('bar').style.width='100%';
    glbShow(R)}}

/* ---- the results ---- */
const glbMs=v=>v==null?'–':(v>=100?Math.round(v):(+v).toFixed(1));
function glbShow(R){const W=R.worker&&R.worker.out,P=R.page&&R.page.out,names=((W||P)||{looks:[]}).looks.map(l=>l.name);
  const lk=(o,n)=>o&&o.looks.find(l=>l.name===n)||{};
  const dif=l=>l&&l.diff?`${l.diff.mean} / ${l.diff.max} / ${l.diff.over2}`:'–';
  let h='<table><thead><tr><th>Look</th><th>CPU Worker</th><th>GL Worker</th>'+(P?'<th>CPU page</th><th>GL page</th>':'')+'<th>Diff mean / max / &gt;2</th></tr></thead><tbody>';
  for(const n of names){const w=lk(W,n),p=lk(P,n),d=w.diff?w:p;
    h+=`<tr><td>${glbEsc(n)}${w.error||p.error?`<div class="bad">${glbEsc(w.error||p.error)}</div>`:''}${w.path&&w.path!=='GL'?`<div class="note">${glbEsc(w.path)}</div>`:''}</td><td>${glbMs(w.cpu)}</td><td>${glbMs(w.gl)}${w.speedup?`<div class="note">${w.speedup}x</div>`:''}</td>`+
      (P?`<td>${glbMs(p.cpu)}${p.cpu!=null&&R.page.out.cpuRuns===1?'<div class="note">1 run</div>':''}</td><td>${glbMs(p.gl)}${p.speedup&&!w.gl?`<div class="note">${p.speedup}x</div>`:''}</td>`:'')+`<td>${dif(d)}</td></tr>`}
  h+='</tbody></table><p class="note">Medians in ms (CPU without its JPEG). Diff: CPU against GL, 0-255 per channel; &gt;2 = pixels differing by more than 2 levels.</p>';
  const setup=(o,label)=>o?`<div class="kv"><span>${label} setup (master + lighting)</span><span>${glbMs(o.cpuPrep)} + ${glbMs(o.cpuLight)} ms</span></div>`+
    (o.glSetup!=null?`<div class="kv"><span>${label} GL first time (init + pack + upload + first look)</span><span>${glbMs(o.glInit)} + ${glbMs(o.glPack)} + ${glbMs(o.glUpload)} + ${glbMs(o.glFirst)} = ${glbMs(o.glSetup)} ms</span></div>`
      :`<div class="kv"><span>${label} GL</span><span class="bad">${glbEsc(o.glWhy||'not run')}</span></div>`)+(o.renderer?`<div class="kv"><span>${label} renderer</span><span>${glbEsc(o.renderer)} (${o.glCanvas})</span></div>`:''):'';
  h+=setup(W,'Worker')+setup(P,'Page')+`<div class="kv"><span>Looks built</span><span>${glbMs(R.jobsMs)} ms</span></div><div class="kv"><span>Total</span><span>${R.totalSeconds} s</span></div>`;
  if(R.errors.length)h+='<h3>Errors</h3><ul class="errs">'+R.errors.map(e=>`<li>${glbEsc(e)}</li>`).join('')+'</ul>';
  glb$('table').innerHTML=h;
  // the pictures, small: CPU | GL per look
  const th=k=>(R.worker&&R.worker.thumbs&&R.worker.thumbs[k])||(R.page&&R.page.thumbs&&R.page.thumbs[k]);glb$('pics').innerHTML='';
  for(const n of names){const fig=document.createElement('div');fig.className='pic';fig.innerHTML=`<div class="pn">${glbEsc(n)}</div>`;const row=document.createElement('div');row.className='pr';
    for(const s of ['cpu','gl']){const t=th(n+'|'+s),box=document.createElement('figure');
      if(t){const c=document.createElement('canvas');c.width=t.w;c.height=t.h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(t.data),t.w,t.h),0,0);box.appendChild(c)}
      else{const e=document.createElement('div');e.className='none';e.textContent='none';box.appendChild(e)}
      const cap=document.createElement('figcaption');cap.textContent=s.toUpperCase();box.appendChild(cap);row.appendChild(box)}
    fig.appendChild(row);glb$('pics').appendChild(fig)}
  // the JSON (without the pictures)
  const J={...R,worker:R.worker&&(R.worker.out||R.worker),page:R.page&&(R.page.out||R.page)};
  glb$('json').value=glbSummary(R)+'\n'+JSON.stringify(J,null,1);glb$('results').hidden=false;glb$('copied').textContent=''}
function glbSummary(R){const W=R.worker&&R.worker.out,P=R.page&&R.page.out,o=W||P;if(!o)return 'gl-bench: no results ('+R.errors.join('; ')+')';
  const dev=(W&&W.renderer)||(P&&P.renderer)||(R.device&&R.device.pageWebGL2&&R.device.pageWebGL2.renderer)||'no WebGL2';
  return `gl-bench ${R.options.size}px x${R.options.runs} on ${dev}: `+o.looks.map(l=>{const p=P&&P.looks.find(x=>x.name===l.name)||{},gl=l.gl!=null?l.gl:p.gl;
    return `${l.name} CPU ${glbMs(l.cpu)} / GL ${glbMs(gl)} ms`}).join('; ')+(R.errors.length?` [${R.errors.length} errors]`:'')}
async function glbCopy(){const ta=glb$('json'),txt=ta.value;
  try{await navigator.clipboard.writeText(txt);glb$('copied').textContent='Copied. Paste it into the chat.';return}catch{}
  ta.focus();ta.select();try{ta.setSelectionRange(0,txt.length)}catch{}
  let ok=false;try{ok=document.execCommand('copy')}catch{}
  glb$('copied').textContent=ok?'Copied. Paste it into the chat.':'Selected: tap Copy on the menu (or press and hold the box, Select All, Copy).'}

/* ---- start-up: the device only; nothing heavy until Start ---- */
(async()=>{
  GLB_PREV=glbLsGet();if(GLB_PREV){glb$('prev').hidden=false;glb$('prev').textContent=`The last run (${GLB_PREV.size} px) did not finish: it stopped at "${GLB_PREV.at}". The page probably ran out of memory and reloaded`+(GLB_PREV.size>1024?'; try 1024.':'.');glbLsSet(null)}
  try{GLB_DEV=glbDevice()}catch(e){GLB_DEV={err:String(e.message||e)}}
  glbShowDevice();glb$('start').disabled=false;
  glb$('start').addEventListener('click',glbStart);glb$('copy').addEventListener('click',glbCopy);
  GLB_PROBE_P=glbProbeWorker();GLB_PROBE=await GLB_PROBE_P;glbShowDevice()})();
