/* Daily Wardrobe: storage, forms, screens and gestures */
let flt='all',queue=[];const now=new Date();let view={y:now.getFullYear(),m:now.getMonth()},sel=new Date(now.getFullYear(),now.getMonth(),now.getDate());

/* storage */
// stores: items (wardrobe), days (outfit history, keyed by date), meta (key/value: deletion tombstones, settings, sync state)
const db=new Promise((ok,no)=>{const r=indexedDB.open('wardrobe',2);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('items'))d.createObjectStore('items',{keyPath:'id'});
    if(!d.objectStoreNames.contains('days'))d.createObjectStore('days',{keyPath:'date'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'})};
  r.onsuccess=()=>ok(r.result);r.onerror=no});
const txs=async(store,m,f)=>{const d=await db;return new Promise((ok,no)=>{const t=d.transaction(store,m);const q=f(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result);t.onerror=no})};
const tx=(m,f)=>txs('items',m,f);
const metaGet=async k=>{const r=await txs('meta','readonly',s=>s.get(k));return r?r.v:undefined},metaPut=(k,v)=>txs('meta','readwrite',s=>s.put({k,v}));
/* read-modify-write inside ONE transaction, so a sync finishing at the same moment can't overwrite it */
const atomic=async(store,key,fn)=>{const d=await db;return new Promise((ok,no)=>{const t=d.transaction(store,'readwrite'),s=t.objectStore(store);let out;
  const q=s.get(key);q.onsuccess=()=>{out=fn(q.result);if(out&&out.put)s.put(out.put);if(out&&out.del)s.delete(key)};t.oncomplete=()=>ok(out&&out.value);t.onerror=no})};
const addTombstones=add=>atomic('meta','tombstones',r=>{const v={...(r&&r.v||{})};for(const [id,t] of Object.entries(add))v[id]=Math.max(v[id]||0,t);return {put:{k:'tombstones',v},value:v}});
// every local edit is timestamped and triggers a (debounced) backup; deletions leave a tombstone so they sync too
const putRaw=i=>tx('readwrite',s=>s.put(i));
const put=i=>{i.updated=Date.now();const r=putRaw(i);r.then(()=>window.scheduleSync&&scheduleSync());return r};
const del=async id=>{await tx('readwrite',s=>s.delete(id));await addTombstones({[id]:Date.now()});window.scheduleSync&&scheduleSync()};

/* settings management */
function openSettings(section){
  if(section)setTimeout(()=>{const el=$('#wx-section');if(el)el.scrollIntoView({block:'start'})},0);
  if($('#cfg-url')) $('#cfg-url').value=localStorage.getItem('worker_url')||'';
  if($('#cfg-token')) $('#cfg-token').value=localStorage.getItem('app_token')||'';
  if(window.showSyncStatus)showSyncStatus();
  renderSettingsExtras();
  if($('#settings-modal')){ $('#settings-modal').style.display='block'; $('#settings-modal').style.pointerEvents='auto'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='block'; $('#modal-backdrop').style.pointerEvents='auto'; }
}
let todayStale=false;   // a change made in Settings that Today should show once Settings closes
const settingsOpen=()=>!!$('#settings-modal')&&$('#settings-modal').style.display==='block';
function closeSettings(){
  if($('#settings-modal')){ $('#settings-modal').style.display='none'; $('#settings-modal').style.pointerEvents='none'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='none'; $('#modal-backdrop').style.pointerEvents='none'; }
  if(todayStale){todayStale=false;renderToday()}
}
function saveSettings(){
  if($('#cfg-url')) localStorage.setItem('worker_url',$('#cfg-url').value.trim());
  if($('#cfg-token')) localStorage.setItem('app_token',$('#cfg-token').value.trim());
  closeSettings();
  renderAdd();
  if(window.syncNow)syncNow();
}

/* precision swatch generator */
function generateSwatch(q){
  if(!q.big) return '';
  const canvas=q.big;
  const zoom=Number(q.zoom)||1;
  const cx=Number(q.cx)||0.5;
  const cy=Number(q.cy)||0.5;
  const sampleSize=Math.min(canvas.width,canvas.height)*(0.5/zoom);
  const o=document.createElement('canvas');
  o.width=o.height=128;
  const sx=Math.max(0,Math.min(canvas.width-sampleSize,cx*canvas.width-sampleSize/2));
  const sy=Math.max(0,Math.min(canvas.height-sampleSize,cy*canvas.height-sampleSize/2));
  o.getContext('2d').drawImage(canvas, sx, sy, sampleSize, sampleSize, 0, 0, 128, 128);
  q.swatch=o.toDataURL('image/png');
  return q.swatch;
}

function updateSwatchParam(i, param, val){
  queue[i][param]=Number(val);
  generateSwatch(queue[i]);
  const swEl=$(`#swatch-img-${i}`);
  if(swEl) swEl.style.backgroundImage=`url(${queue[i].swatch})`;
}

let aiError='',aiModel='';
const aiLabel=q=>!q.ai?'Not tagged by AI: fill in the details.':!q.model?'Tagged by AI.':/^claude/.test(q.model)?`Tagged by Claude (${q.model}).`:`Tagged by Workers AI (${q.model.replace(/^@cf\//,'')}).`;
async function ask(c){
  try {
    const workerUrl=localStorage.getItem('worker_url');
    if(!workerUrl) return null;
    const dataUrl=c.toDataURL('image/jpeg',.8);
    const res=await fetch(workerUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image:dataUrl,appToken:localStorage.getItem('app_token')||''})
    });
    if(!res.ok){let e='';try{const j=await res.json();e=j.detail||j.error||''}catch{}aiError=`Photo tagging failed: ${e||'HTTP '+res.status}. Fill in the details below.`;return null}
    aiError='';
    const result=await res.json();aiModel=result.model||'';
    let parsed;
    try {
      const cleanText=(result.response||'').replace(/```json/g,'').replace(/```/g, '').trim();
      parsed=JSON.parse(cleanText);
    } catch(e) {
      parsed=result;
    }
    return normTag(parsed,result.model);
  } catch(e) {
    return null;
  }
}
/* an AI tag -> the fields the Add form uses (type-checked, colours and patterns normalised) */
function normTag(parsed,model){
    return {
      type:TYPES[parsed.type]?parsed.type:'suit',
      pattern:normPat(TYPES[parsed.type]?parsed.type:'suit',parsed.pattern),
      primaryColor:normColFor(parsed.type,parsed.primaryColor||parsed.color)||'grey',
      secondaryColor:normColFor(parsed.type,parsed.secondaryColor,true),
      tertiaryColor:normColFor(parsed.type,parsed.tertiaryColor,true),
      metal:METAL[parsed.metal]?parsed.metal:'silver',
      leather:LEATHERS.includes(String(parsed.leather||'').toLowerCase().replace(/\s+/g,'-'))?String(parsed.leather).toLowerCase().replace(/\s+/g,'-'):null,
      model:model||'',
      dial:normCol(parsed.dial),band:['bracelet','leather'].includes(parsed.band)?parsed.band:null,bezel:['fluted','smooth'].includes(parsed.bezel)?parsed.bezel:null
    };
}

const loadImg=f=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(f)});
function shrink(img,max){const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c}

async function fill(q,ai){
  q.zoom=1; q.cx=0.5; q.cy=0.5;
  generateSwatch(q);
  q.ai=!!(ai&&ai.type);q.model=ai&&ai.model||'';
  q.type=q.ai?ai.type:'suit';
  q.primaryColor=ai&&COLORS[ai.primaryColor]?ai.primaryColor:'grey';
  q.secondaryColor=ai&&ai.secondaryColor&&ai.secondaryColor!=='none'?ai.secondaryColor:null;
  q.tertiaryColor=ai&&ai.tertiaryColor&&ai.tertiaryColor!=='none'?ai.tertiaryColor:null;
  q.pattern=ai?normPat(q.type,ai.pattern):'solid';
  q.metal=ai&&METAL[ai.metal]?ai.metal:'silver';
  q.leather=ai&&ai.leather||'calf';
  const wo=watchOpts(ai||{});q.dial=wo.dial;q.band=wo.band;q.bezel=wo.bezel;q.watchStyle=wo.style;
}

async function addFiles(files){
  if($('#multi-items')&&$('#multi-items').checked){for(const f of files)await addMulti(f);return}
  for(const f of files){
    const q={id:crypto.randomUUID(),busy:1};
    queue.push(q);
    renderAdd();
    try{
      const img=await loadImg(f);
      q.big=shrink(img,800);
      q.photo=shrink(img,360).toDataURL('image/jpeg',.8);
      const aiResult=await ask(q.big);
      fill(q,aiResult);
    }catch(e){q.err=1}
    q.busy=0;
    renderAdd();
  }
}

/* ---- pasted photos, photo links and drag & drop ---- */
const pasteMsg=t=>{const e=$('#paste-status');if(e)e.textContent=t||''};
const isLink=t=>/^(https?:\/\/|data:image\/)\S+$/i.test((t||'').trim());
function addBlobs(blobs){
  const files=blobs.filter(b=>b&&/^image\//.test(b.type)).map((b,n)=>b instanceof File&&b.name?b:new File([b],`pasted-${Date.now()}-${n}.${(b.type.split('/')[1]||'png').replace(/\W.*/,'')}`,{type:b.type}));
  if(files.length){pasteMsg('');addFiles(files)}return files.length;
}
/* download a photo link: directly if the site allows it, otherwise through the worker (which also reads a shop page's photo) */
async function fetchPhoto(link){
  const u=link.trim();
  if(/^data:image\//i.test(u))return (await fetch(u)).blob();
  let url;try{url=new URL(u)}catch{throw new Error('That is not a valid link.')}
  if(!/^https?:$/.test(url.protocol))throw new Error('Only http and https links are supported.');
  try{const r=await fetch(url.href,{mode:'cors',credentials:'omit'});
    if(r.ok){const b=await r.blob();if(/^image\//.test(b.type))return b}}catch(e){/* blocked by the site (no CORS): use the worker */}
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');
  if(!w||!tok)throw new Error('That site doesn’t let the app download the photo directly. Set the Worker URL and App Token in ⚙ Settings to fetch it through your worker, or save the photo and use Choose photos.');
  let r;try{r=await fetch(new URL('fetch',w.replace(/\/*$/,'/')).href+'?url='+encodeURIComponent(url.href),{headers:{'x-app-token':tok}})}
  catch{throw new Error('Couldn’t reach your worker to fetch the photo.')}
  if(!r.ok){let m='';try{m=(await r.json()).error}catch{}
    if(r.status===404||r.status===405)m='Your worker doesn’t support photo links yet: redeploy it with the latest worker.js.';
    throw new Error(m||`The worker couldn’t fetch the photo (${r.status}).`)}
  const b=await r.blob();if(!/^image\//.test(b.type))throw new Error('That link is not a photo.');return b;
}
async function addFromUrl(link){
  pasteMsg('Fetching the photo…');
  try{const b=await fetchPhoto(link);addBlobs([b]);const i=$('#photo-url');if(i)i.value='';return true}
  catch(e){pasteMsg(e.message||'Couldn’t fetch that photo.');return false}
}
function addLink(){const i=$('#photo-url'),v=(i&&i.value||'').trim();if(!v){pasteMsg('Paste a photo or a link into the box first.');return}
  if(!isLink(v)){pasteMsg('That doesn’t look like a link. It should start with http:// or https://.');return}return addFromUrl(v)}
async function pasteFromClipboard(){
  if(!navigator.clipboard||!navigator.clipboard.read){pasteMsg('Your browser blocks the Paste button: long-press (or right-click) the box and choose Paste.');$('#photo-url')?.focus();return}
  try{const its=await navigator.clipboard.read(),blobs=[];let text='';
    for(const it of its){const t=it.types.find(x=>x.startsWith('image/'));if(t)blobs.push(await it.getType(t));
      else if(!text&&it.types.includes('text/plain'))text=await (await it.getType('text/plain')).text()}
    if(addBlobs(blobs))return;
    if(isLink(text))return addFromUrl(text.trim());
    pasteMsg('The clipboard has no photo or photo link. Copy an image (or its address) first.');
  }catch(e){pasteMsg('Couldn’t read the clipboard: long-press (or right-click) the box and choose Paste.');$('#photo-url')?.focus()}
}
const clipImages=dt=>[...(dt&&dt.items||[])].filter(x=>x.kind==='file'&&x.type.startsWith('image/')).map(x=>x.getAsFile()).filter(Boolean);
/* Ctrl+V / ⌘V: a copied image anywhere in the app goes to Add; a pasted link goes in when the Add screen is open */
document.addEventListener('paste',e=>{
  const imgs=clipImages(e.clipboardData),tgt=e.target,inBox=tgt&&tgt.id==='photo-url';
  const typing=tgt&&/^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)&&!inBox;
  if(imgs.length){if(typing&&tgt.type!=='url'&&tgt.type!=='text')return;e.preventDefault();if($('#add').hidden)show('add');addBlobs(imgs);return}
  const text=(e.clipboardData&&e.clipboardData.getData('text/plain')||'').trim();
  if(!typing&&!$('#add').hidden&&isLink(text)){e.preventDefault();const i=$('#photo-url');if(i)i.value=text;addFromUrl(text)}
});
/* drag & drop photos (or an image dragged from another tab) onto the app */
document.addEventListener('dragover',e=>{if([...(e.dataTransfer&&e.dataTransfer.types||[])].some(t=>t==='Files'||t==='text/uri-list')){e.preventDefault();document.body.classList.add('dragging')}});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('dragging')});
document.addEventListener('drop',e=>{const dt=e.dataTransfer;if(!dt)return;document.body.classList.remove('dragging');
  const files=[...dt.files].filter(f=>f.type.startsWith('image/'));
  const link=(dt.getData('text/uri-list')||'').split(/\r?\n/).find(l=>l&&!l.startsWith('#'))||dt.getData('text/plain');
  if(!files.length&&!isLink(link))return;e.preventDefault();if($('#add').hidden)show('add');
  if(files.length)addBlobs(files);else addFromUrl(link.trim())});

/* ---- several items in one photo: the worker lists every item with a rough box; each becomes its own card ---- */
const multiMsg=t=>{const e=$('#multi-status');if(e)e.textContent=t||''};
function multiNote(){multiMsg($('#multi-items').checked?'Photos you add now are split into one card per item. Check each card: colours and textures from a rail photo need a look, especially whites.':'')}
/* crop the box (thousandths of the image) with a little margin, keeping at least a usable size */
function cropBox(img,box,max){
  const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,pad=.04;
  let x=(box.x/1000-pad*box.w/1000)*W,y=(box.y/1000-pad*box.h/1000)*H,w=box.w/1000*W*(1+2*pad),h=box.h/1000*H*(1+2*pad);
  const minS=Math.min(W,H)*.08;if(w<minS){x-=(minS-w)/2;w=minS}if(h<minS){y-=(minS-h)/2;h=minS}
  x=Math.max(0,x);y=Math.max(0,y);w=Math.min(W-x,w);h=Math.min(H-y,h);
  const k=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  c.getContext('2d').drawImage(img,x,y,w,h,0,0,c.width,c.height);return c;
}
async function addMulti(f){
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token')||'';
  if(!w){multiMsg('Set the Worker URL in ⚙ Settings first: finding several items needs your worker.');return}
  const holder={id:crypto.randomUUID(),busy:1,multiBusy:1};queue.push(holder);renderAdd();
  try{
    const img=await loadImg(f);
    const r=await fetch(new URL('tag-many',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},
      body:JSON.stringify({image:shrink(img,1568).toDataURL('image/jpeg',.85)})});
    const j=await r.json().catch(()=>({}));
    queue.splice(queue.indexOf(holder),1);
    if(!r.ok){multiMsg(r.status===404||r.status===405?'Your worker doesn’t support several items yet: it needs the latest worker.js.':`Couldn’t find the items: ${j.detail||j.error||'HTTP '+r.status}`);renderAdd();return}
    const list=j.items||[];
    if(!list.length){multiMsg('No clothing items were found in that photo.');renderAdd();return}
    list.forEach((it,n)=>{
      const q={id:crypto.randomUUID(),multi:{n:n+1,of:list.length,confidence:it.confidence||'medium'}};
      q.big=cropBox(img,it.box,800);q.photo=cropBox(img,it.box,360).toDataURL('image/jpeg',.8);
      fill(q,normTag(it,j.model));queue.push(q);
    });
    aiModel=j.model||aiModel;aiError='';
    const counts={};for(const it of list){const t=TYPES[it.type]?it.type:'item';counts[t]=(counts[t]||0)+1}
    multiMsg(`Found ${list.length} item${list.length===1?'':'s'} (${Object.entries(counts).map(([t,c])=>{const n=(TYPES[t]||'item').toLowerCase();return `${c} ${n}${c>1&&!n.endsWith('s')?'s':''}`}).join(', ')}). Check each card, then Save all or confirm them one by one.`);
  }catch(e){const k=queue.indexOf(holder);if(k>=0)queue.splice(k,1);multiMsg('Couldn’t read that photo: '+(e.message||e))}
  renderAdd();
}
/* save every finished card in the queue (Skip the ones you don't want first) */
async function saveAll(){const n=queue.filter(q=>!q.busy&&!q.err).length;for(let i=queue.length-1;i>=0;i--){const q=queue[i];if(!q.busy&&!q.err)await save(i)}
  multiMsg(`Saved ${n} item${n===1?'':'s'} to your wardrobe.`);renderAdd()}
const shirtColFix=o=>{for(const f of ['primaryColor','secondaryColor','tertiaryColor'])if(o[f])o[f]=normColFor(o.type,o[f],f!=='primaryColor')};
const setq=(i,k,v)=>{const q=queue[i];q[k]=v==='none'?null:v;if(k==='type'){q.pattern=normPat(v,q.pattern);shirtColFix(q)}if(k==='type'||q.manual)renderAdd()};
/* an item described with the dropdowns only; the wardrobe shows a drawn thumbnail instead of a photo */
function addManual(){
  const wo=watchOpts({});
  queue.unshift({id:crypto.randomUUID(),manual:true,type:'suit',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf',dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style});
  renderAdd();
}
async function save(i){
  const q=queue[i],f=FABRIC.includes(q.type);
  generateSwatch(q);
  const it={id:q.id,type:q.type,primaryColor:q.primaryColor,secondaryColor:q.secondaryColor,tertiaryColor:q.tertiaryColor,pattern:f?q.pattern:'solid',photo:q.photo,added:Date.now()};
  if(f)it.swatch=q.swatch;
  if(METAL_TYPES.includes(q.type))it.metal=q.metal||'silver';
  if(q.type==='shirt')it.cuff=q.cuff||'button';
  if(q.type==='suit'&&q.vest==='no')it.vest='no';
  if(SEASON_TYPES.includes(q.type)&&q.season&&q.season!=='all')it.season=q.season;
  if(q.type==='shoes'||q.type==='belt')it.leather=q.leather||'calf';
  if(q.type==='watch'){const wo=watchOpts(q);Object.assign(it,{dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style})}
  if(!it.photo)delete it.photo;
  try{const st=detectQueued(q,it);if(st)it.stripes=st}catch(e){console.warn('pattern detection failed',e)}
  await put(it);items.push(it);queue.splice(i,1);renderAdd();
}
let editing=null;
const E=(id,k,list,v)=>`<label>${k==='primaryColor'?'Primary':k==='secondaryColor'?'Secondary':k==='tertiaryColor'?'Third colour':k==='watchStyle'?'Style':k[0].toUpperCase()+k.slice(1)} <select onchange="sete('${id}','${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${x[1]}</option>`).join('')}</select></label>`;
function editForm(i){
  const cols=COLOR_OPTS(i.type,primaryCol(i)),acc=c=>[['none','None'],...COLOR_OPTS(i.type,c,true)];
  return `<div class="card" style="margin:8px 0 0;padding:8px">${E(i.id,'type',Object.entries(TYPES),i.type)}${E(i.id,'primaryColor',cols,primaryCol(i))}${E(i.id,'secondaryColor',acc(i.secondaryColor),i.secondaryColor||'none')}${E(i.id,'tertiaryColor',acc(i.tertiaryColor),i.tertiaryColor||'none')}
  ${FABRIC.includes(i.type)?E(i.id,'pattern',(PATS_BY[i.type]||['solid']).map(c=>[c,patLabel(c)]),normPat(i.type,i.pattern)):''}${METAL_TYPES.includes(i.type)?E(i.id,'metal',Object.keys(METAL).map(c=>[c,c]),i.metal||'silver'):''}
  ${i.type==='shirt'?E(i.id,'cuff',CUFFS,i.cuff||'button'):''}${i.type==='suit'?E(i.id,'vest',VESTS,i.vest==='no'?'no':'yes'):''}${SEASON_TYPES.includes(i.type)?E(i.id,'season',SEASONS,i.season||'all'):''}
  ${i.type==='shoes'||i.type==='belt'?E(i.id,'leather',LEATHERS.map(c=>[c,patLabel(c)]),i.leather||'calf'):''}
  ${i.type==='watch'?E(i.id,'dial',DIAL_OPTS(watchOpts(i).dial),watchOpts(i).dial)+E(i.id,'band',BANDS,watchOpts(i).band)+E(i.id,'bezel',BEZELS,watchOpts(i).bezel)+E(i.id,'watchStyle',WATCH_STYLES,watchOpts(i).style):''}
  ${DETECT_PATS.includes(i.pattern)?`<p class="mut" style="margin:6px 0;font-size:14px">Pattern layout: ${patSummary(i)}</p><div class="btns"><button onclick="redetect('${i.id}')">Read pattern from photo</button>${i.stripes?`<button onclick="clearStripes('${i.id}')">Use generic</button>`:''}</div>`:''}
  <div class="btns"><button class="pri" onclick="editing=null;renderWardrobe()">Done</button></div></div>`;
}
async function sete(id,k,v){
  const it=items.find(x=>x.id===id);if(!it)return;
  it[k]=v==='none'?null:v;
  if(k==='type'){it.pattern=normPat(v,it.pattern);shirtColFix(it);if((v==='watch'||v==='tieclip')&&!it.metal)it.metal='silver';if((v==='shoes'||v==='belt')&&!it.leather)it.leather='calf';if(v==='belt'&&!it.metal)it.metal='silver'}
  if(k==='primaryColor')delete it.color;
  await put(it);cache={};renderWardrobe();
}
function patSummary(i){
  const st=i.stripes;if(!st)return 'generic';
  if(st.kind==='check')return `check read from photo (${st.b.length}×${st.v.length} bands)`;
  return `stripes read from photo (${st.b.length} bands, ${Math.abs(st.a)}°)`;
}
async function redetect(id){
  const it=items.find(x=>x.id===id);if(!it)return;
  const load=src=>new Promise(r=>{if(!src)return r(null);const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src});
  let st=null;
  const sw=await load(it.swatch);if(sw)st=detectPattern(it,sw,0,0,sw.width);
  if(!st){const ph=await load(it.photo);if(ph){const mn=Math.min(ph.width,ph.height)*.7;st=detectPattern(it,ph,(ph.width-mn)/2,(ph.height-mn)/2,mn)}}
  if(!st){alert('Could not find a clear repeating pattern in the photo. Re-adding it with the swatch centred on the fabric usually works.');return}
  it.stripes=st;await put(it);cache={};renderWardrobe();
}
async function clearStripes(id){const it=items.find(x=>x.id===id);if(!it)return;delete it.stripes;await put(it);cache={};renderWardrobe()}
async function rm(id){if(!confirm('Delete this item?'))return;await del(id);items=items.filter(i=>i.id!==id);renderWardrobe()}

let cache={}; const planFor=()=>cache[view.y+'-'+view.m]||(cache[view.y+'-'+view.m]=buildPlan(view.y,view.m));

/* views */
const vestRow=o=>!(o.suitDay&&hasVest(o.top))?'':`<div class="row vest-row"><span class="mut">Vest</span>${o.vest?`<span class="dot">${swatchSVG(o.top)}</span><span class="cap">Matching vest</span>`:'<span class="mut none">Not today</span>'}${o.frozen?'':`<button class="swap" onclick="setVest(${!o.vest})" aria-label="${o.vest?'Leave off the vest':'Wear the vest'}" title="${o.vest?'Leave off the vest':'Wear the vest'}">${o.vest?'−':'+'}</button>`}</div>`;
const slots=o=>[[o.suitDay?'Suit':'Blazer',o.top,'top'],...(o.suitDay?[]:[['Pants',o.bot,'bot']]),['Shirt',o.shirt,'shirt'],['Tie',o.tie,'tie'],['Tie clip',o.clip,'clip'],...(o.links||(o.shirt&&o.shirt.cuff==='french')?[['Cufflinks',o.links,'links']]:[]),['Watch',o.watch,'watch'],['Belt',o.belt,'belt'],['Socks',o.socks,'socks'],['Shoes',o.shoes,'shoes'],...(o.coat||(o.clim&&(o.clim.cold||o.clim.rain))?[[o.coat?TYPES[o.coat.type]:'Coat',o.coat,'coat']]:[])]
.map(([l,i,s])=>`<div class="row"><span class="mut">${l}</span>${i?`<span class="dot">${swatchSVG(i)}</span><span class="cap">${desc(i)}</span>${o.frozen?'':`<button class="swap" onclick="swapSlot('${s}')" aria-label="Swap ${l.toLowerCase()}" title="Swap">↻</button>`}`:`<span class="mut none">${s==='clip'&&o.vest?'Not with the vest':'Add one on the Add tab'}</span>`}</div>`).join('').replace('</div>',`</div>${vestRow(o)}`);

/* ---- outfit history: freeze past days, swap pieces, record what was worn ---- */
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
let swapMsg='';
async function saveDay(rec,quiet){rec.updated=Date.now();dayRecs[rec.date]=rec;await txs('days','readwrite',s=>s.put(rec));cache={};if(!quiet&&window.scheduleSync)scheduleSync()}
/* remember what each day showed: past days become fixed, and today's record follows the screen until the day ends */
async function recordDays(p){
  const T=todayDate(),tk=key(T);let changed=false;
  for(const [k,o] of Object.entries(p)){
    if(!SLOTS.some(s=>o[s])||o.frozen)continue;const d=keyDate(k);
    if(d<T&&!dayRecs[k]){await saveDay({date:k,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest,auto:true},true);changed=true}
    else if(k===tk){const r=dayRecs[k],ids=idsOf(o);if(!r||JSON.stringify(r.ids)!==JSON.stringify(ids)||!!r.vestOn!==!!o.vest){await saveDay({...(r||{date:k}),ids,suitDay:o.suitDay,vestOn:!!o.vest},true);changed=true}}
  }
  if(changed&&window.scheduleSync)scheduleSync();
}
async function swapSlot(slot){
  const k=key(sel),o=planFor()[k];if(!o||o.frozen)return;
  const cur=o[slot]&&o[slot].id,pool=items.filter(i=>slot==='coat'?i.type==='overcoat'||i.type==='raincoat':i.type===SLOT_TYPE(slot,o.suitDay));
  if(pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to swap.`;renderToday();return}
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest};
  const skip={...(rec.skip||{})};skip[slot]=[...new Set([...(skip[slot]||[]),cur].filter(Boolean))];
  if(pool.every(i=>skip[slot].includes(i.id)))skip[slot]=[cur];       // tried them all: start the cycle again
  // keep the rest of the outfit; pieces that must follow the swapped one are re-picked
  const follow={top:['bot','shirt','tie','shoes','belt','socks','watch','clip'],shoes:['belt','socks']}[slot]||[];
  const force={};for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  rec.skip=skip;rec.force=force;swapMsg='';await saveDay(rec);renderToday();
}
async function setFormal(v,k){k=k||key(sel);const r={...(dayRecs[k]||{date:k})};delete r.force;delete r.skip;delete r.vest;if(v)r.formal=true;else delete r.formal;if(k===key(sel))swapMsg='';await saveDay(r);if(settingsOpen()){todayStale=true;renderFormalUI()}else renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.force;delete n.skip;delete n.worn;delete n.vest;swapMsg='';await saveDay(n);renderToday()}
async function setWorn(v){const k=key(sel),o=planFor()[k];if(!o)return;const r=dayRecs[k]||{date:k};await saveDay({...r,ids:r.ids&&o.frozen?r.ids:idsOf(o),suitDay:o.suitDay,vestOn:o.frozen?!!r.vestOn:!!o.vest,worn:v});renderToday()}
async function setVest(v){const k=key(sel),o=planFor()[k];if(!o||o.frozen)return;const r={...(dayRecs[k]||{date:k})};r.vest=v;swapMsg='';await saveDay(r);renderToday()}
function dayActions(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),past=d<T,isToday=+d===+T;
  let h='';
  // did you wear it: a two-way toggle; tapping the chosen side again clears it
  if(past||isToday)h+=`<div class="seg" role="group" aria-label="Did you wear this outfit?"><button class="${o.worn===true?'on':''}" aria-pressed="${o.worn===true}" onclick="setWorn(${o.worn===true?'undefined':'true'})" aria-label="Wore this">✓ Worn</button><button class="${o.worn===false?'on':''}" aria-pressed="${o.worn===false}" onclick="setWorn(${o.worn===false?'undefined':'false'})" aria-label="Didn't wear">Not worn</button></div>`;
  if(o.formal)h+=`<span class="ftag" title="Set in Settings, Formal days">Formal day</span>`;
  if(!o.frozen&&(o.overrides||o.vestOverride))h+=`<button class="reset" aria-label="Reset changes" title="Undo your changes to this day" onclick="resetDay()">↺</button>`;
  return (h?`<div class="dayact">${h}</div>`:'')+(past&&o.frozen&&o.worn!==true?'<p class="mut"><small>Past day: kept as it was planned.</small></p>':'')+(swapMsg?`<p class="mut"><small>${swapMsg}</small></p>`:'');
}

/* outfit score card with an expandable breakdown */
function scoreCard(o){
  const r=rateOutfit(o),tone=r.score>=80?'good':r.score>=65?'ok':'low';
  return `<details class="score ${tone}"><summary><span class="num">${r.score}</span><span class="lbl"><b>${r.label}</b><small>Outfit score · tap for why</small></span></summary><ul>${r.checks.map(c=>`<li class="${c.pts===c.max?'ok':'miss'}"><span>${c.pts===c.max?'✓':'•'} ${c.label}</span><span class="pts">${c.pts}/${c.max}</span>${c.why?`<small>${c.why}</small>`:''}</li>`).join('')}</ul></details>`;
}
/* ---- month view (wear plan): a calendar of fabric stacks, from the design concept ---- */
/* stacked bands for one outfit: jacket, trousers on blazer days, shirt, tie (drawn from the tagged fabrics) */
let stkN=0;
function stackSVG(o,cls=''){
  const P='st'+(stkN++)+'-',parts=[[o.top,'top',22],...(!o.suitDay&&o.bot?[[o.bot,'bot',9]]:[]),[o.shirt,'shirt',9],[o.tie,'tie',9]].filter(x=>x[0]);
  const H=parts.reduce((h,x)=>h+x[2],0)+(parts.length-1)*2;let y=0;
  const body=parts.map(([i,role,h],k)=>{const id=P+k,r=`<rect y="${y}" width="40" height="${h}" rx="2.5" fill="url(#${id})"/><rect y="${y}" width="40" height="${h}" rx="2.5" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".6"/>`;y+=h+2;return `<defs>${fabricDef(id,i,role)}</defs>${r}`}).join('');
  return `<svg class="stack ${cls}" viewBox="0 0 40 ${H}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
const planOn=d=>{const keep=view;view={y:d.getFullYear(),m:d.getMonth()};const o=planFor()[key(d)];view=keep;return o};
const nextWorkday=d=>{const x=new Date(d);let g=0;do x.setDate(x.getDate()+1);while(!isWorkday(x)&&++g<7);return x};
const shortTop=o=>{const t=o.top;if(!t)return '';const p=t.pattern&&t.pattern!=='solid'&&t.pattern!=='other'?' '+patLabel(t.pattern):'',n=colName(primaryCol(t))+p;
  const s=n.charAt(0).toUpperCase()+n.slice(1);return o.suitDay?s:`${s} blazer${o.bot?' + '+colName(primaryCol(o.bot))+' trousers':''}`};
const tieWord=p=>({'polka-dot':'dot',stripe:'stripe',paisley:'paisley',check:'check',foulard:'foulard',knit:'knit'})[p]||'';
const shortRest=o=>[o.shirt&&colName(primaryCol(o.shirt))+' shirt',o.tie&&[colName(primaryCol(o.tie)),tieWord(o.tie.pattern),'tie'].filter(Boolean).join(' ')].filter(Boolean).join(' · ').replace(/^./,c=>c.toUpperCase());
/* the month plan unfolds in place from the box on Today (no separate page) */
let monthOpen=false,monthPanel=null;
const monthPlan=(y,m)=>{const keep=view;view={y,m};const p=planFor();view=keep;return p};
function monthGridHtml(){
  const {y,m}=monthPanel,p=monthPlan(y,m),f=new Date(y,m,1),T=todayDate(),cells=[];let n=0;
  for(let k=0;k<f.getDay();k++)cells.push('<span class="mc blank"></span>');
  for(const d=new Date(f);d.getMonth()===m;d.setDate(d.getDate()+1)){const k=key(d),o=p[k],wd=isWorkday(d),work=wd&&o&&o.top,isT=+d===+T,past=d<T;
    const label=`${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}: ${work?`${shortTop(o)}, ${shortRest(o)}`:wd?'no outfit recorded':'day off'}`;
    cells.push(`<button class="mc ${!wd?'rest':past?'worn':'planned'}${isT?' today':''}${k===key(sel)?' sel':''}" style="--i:${n++}" aria-label="${esc(label)}" onclick="openDay(${d.getTime()})"><span class="dn">${d.getDate()}</span>${work?stackSVG(o):wd?'<span class="stack none"></span>':'<span class="stack rest"></span>'}</button>`)}
  return `<div class="mhead"><h3>${f.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><div class="mbtns"><button onclick="monthStep(-1)" aria-label="Previous month">‹</button><button onclick="monthStep(1)" aria-label="Next month">›</button></div></div>
    <div class="mgrid mdow" aria-hidden="true">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="mgrid">${cells.join('')}</div>
    <div class="mlegend"><span><i class="lg worn"></i>Worn</span><span><i class="lg today"></i>Today</span><span><i class="lg planned"></i>Planned</span><span><i class="lg rest"></i>Rest</span></div>`;
}
function toggleMonth(){const box=$('#mbox');if(!box)return;monthOpen=!monthOpen;
  if(monthOpen){monthPanel={y:sel.getFullYear(),m:sel.getMonth()};$('#mpanel-in').innerHTML=monthGridHtml();box.classList.remove('instant');void box.offsetHeight}
  box.classList.toggle('open',monthOpen);$('#mbox .month-link').setAttribute('aria-expanded',monthOpen);
  const sm=$('#mbox .mltxt small');if(sm)sm.textContent=sm.textContent.replace(/tap to .*/,monthOpen?'tap to fold away':'tap to see the month');
  if(monthOpen)setTimeout(()=>box.scrollIntoView({behavior:'smooth',block:'nearest'}),120)}
function monthStep(n){let {y,m}=monthPanel;m+=n;if(m>11){m=0;y++}if(m<0){m=11;y--}monthPanel={y,m};const el=$('#mpanel-in');if(el){el.innerHTML=monthGridHtml();$('#mbox').classList.add('instant')}}
function openDay(t){sel=new Date(t);view={y:sel.getFullYear(),m:sel.getMonth()};monthOpen=false;renderToday();scrollTo({top:0,behavior:'smooth'})}
/* the box on Today: the next few workdays as small stacks; tap it and the month unfolds below */
function monthLink(){
  const days=[];for(let d=new Date(sel),g=0;days.length<5&&g<14;g++,d.setDate(d.getDate()+1))if(isWorkday(d)){const o=planOn(d);if(o&&o.top)days.push([new Date(d),o])}
  const f=new Date(view.y,view.m,1),n=Object.keys(planFor()).filter(k=>keyDate(k).getMonth()===view.m).length;
  if(monthOpen&&!monthPanel)monthPanel={y:view.y,m:view.m};
  return `<section class="mbox${monthOpen?' open instant':''}" id="mbox"><button class="month-link" onclick="toggleMonth()" aria-expanded="${monthOpen}" aria-controls="mpanel"><span class="mlstrip">${days.map(([d,o])=>`<span class="mli"><small>${d.toLocaleDateString(undefined,{weekday:'narrow'})}</small>${stackSVG(o)}</span>`).join('')}</span>
    <span class="mltxt"><b>${f.toLocaleDateString(undefined,{month:'long'})} wear plan</b><small>${n} outfit${n===1?'':'s'} · ${monthOpen?'tap to fold away':'tap to see the month'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="mpanel"><div class="mpanel-in" id="mpanel-in">${monthOpen?monthGridHtml():''}</div></div></section>`;
}

/* ---- Today figure: torso in the day's fabrics, tap targets, selected-piece card, below-the-waist tiles ---- */
let figSel='top';
const FIG_PIECES=[['top','suit'],['shirt','shirt'],['tie','tie'],['clip','clip'],['vest','vest'],['watch','watch']];
const slotLabel=(s,o)=>({top:o.suitDay?'Suit':'Blazer',bot:'Trousers',shirt:'Shirt',tie:'Tie',clip:'Tie clip',vest:'Vest',watch:'Watch',belt:'Belt',shoes:'Shoes',socks:'Socks',coat:o.coat?TYPES[o.coat.type]:'Coat',links:'Cufflinks'})[s]||s;
function pieceCard(o){
  if(figSel==='vest'){if(!o.vest)return '';return `<div class="piece" id="piece"><span class="chip-sw">${swatchSVG(o.top)}</span><div><small class="mut">Vest</small><b class="cap">Matching vest · ${desc(o.top)}</b></div>${o.frozen?'':`<button class="swap" onclick="setVest(false)">Leave off</button>`}</div>`}
  const i=o[figSel];if(!i)return '';
  return `<div class="piece" id="piece"><span class="chip-sw">${itemPicHtml(i,swatchSVG(i))}</span><div><small class="mut">${slotLabel(figSel,o)}</small><b class="cap">${desc(i)||nm(i)}</b></div>${o.frozen?'':`<button class="swap" onclick="swapSlot('${figSel}')">Swap</button>`}</div>`;
}
function figureStage(o){
  const hs=FIG_PIECES.filter(([s])=>o[s]&&!(s==='clip'&&!o.tie)).map(([s,k])=>{const h=k==='vest'?{x:174,y:200}:FIG_HOTSPOTS[k];
    return `<button class="hot${figSel===s?' on':''}" style="left:${(h.x/390*100).toFixed(2)}%;top:${(h.y/400*100).toFixed(2)}%" aria-label="${slotLabel(s,o)}: ${s==='vest'?'matching vest':desc(o[s])||nm(o[s])}" aria-pressed="${figSel===s}" onclick="pickPiece('${s}')"></button>`}).join('');
  const below=[...(o.suitDay?[]:[['bot',o.bot]]),['belt',o.belt],['shoes',o.shoes],['socks',o.socks],...(o.coat?[['coat',o.coat]]:[])].filter(([,i])=>i);
  const tiles=below.map(([s,i])=>{const bg=itemPic(i)&&picBgs[itemKey(i)];return `<button class="tile${s==='coat'?' coat-tile':''}${bg?' has-pic':''}"${bg?` style="background:${bg}"`:''}${s==='coat'?` data-coat="${i.type}"`:''} onclick="pickPiece('${s}')" aria-label="${slotLabel(s,o)}: ${desc(i)}">${itemPicHtml(i,itemThumb(i))}<small>${slotLabel(s,o)}</small></button>`}).join('');
  const r=renderFor(o),photo=!!r;
  setTimeout(()=>fetchRemoteRender(o,key(sel)),0);   // missing here: fetch it; only here: share it
  // a photo replaces the illustration; the button is only there while a day has none (regenerating lives in Settings)
  const ctl=(!r||rendering?`<div class="render-ctl"><button class="btn render-btn" onclick="generateRender()"${rendering?' disabled':''}>${rendering?'Generating photo…':'Generate realistic photo'}</button></div>`:'')+`<p class="mut render-msg" id="render-msg">${renderMsg}</p>`;
  return (photo?`<div class="fig photo" id="mannequin-container"><img src="${r.img}" alt="Photo of ${esc(figureLabel(o))}"><small class="mut">${(()=>{const d=lastWorn(o);return d?`Last worn ${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}`:'Not worn yet'})()}</small></div>`
    :`<div class="fig" id="mannequin-container">${figureSvg(o)}${hs}</div>`)+ctl+
    `<div id="piece-wrap">${pieceCard(o)}</div>`+(tiles?`<p class="below-h mut">${o.coat?'Coat and below the waist':'Below the waist'}</p><div class="below" style="--n:${below.length}">${tiles}</div>`:'');
}
/* ---- realistic photo: the figure + item photos -> worker /render (OpenAI image edit).
   Photos are saved per outfit combination, not per day: any day that wears the same pieces reuses the photo.
   The worker keeps a copy (KV) so every device can show it. ---- */
let renders={},rendering=false,renderMsg='';
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const figureLabel=o=>[o.top,o.shirt,o.tie,o.clip,o.watch].filter(Boolean).map(i=>nm(i)).join(', ');
/* the combination a photo shows: which pieces, and everything about them that changes how they look */
/* Which look a photo shows. The shirt counts only by its base colour (any white shirt shares the photo made with another
   white shirt); the jacket, tie, clip and watch count by how they look (colours, pattern, metal, dial), not by which item it
   is, so identical items share too. */
const LOOK_FIELDS=['primaryColor','secondaryColor','tertiaryColor','pattern','metal','dial','band','bezel','watchStyle'];
const comboSig=o=>(o.vest?'vest|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];if(!i)return '-';
  return s==='shirt'?'shirt/'+primaryCol(i):[i.type,...LOOK_FIELDS.map(f=>i[f]??'')].join('/')}).join('|');
const fnv64=t=>{let h=0xcbf29ce484222325n;for(const c of new TextEncoder().encode(t)){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}return h.toString(16).padStart(16,'0')};
const comboKey=o=>'c'+fnv64(comboSig(o));
/* the key photos were saved under before shirts counted by colour only; moved over on first use */
const comboSigV1=o=>(o.vest?'vest|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];return i?[i.id,...LOOK_FIELDS.map(f=>i[f]??''),i.cuff??'',i.stripes?JSON.stringify(i.stripes):''].join('/'):'-'}).join('|');
const comboKeyV1=o=>'c'+fnv64(comboSigV1(o));
const figSig=comboSig;
/* photos saved before combinations were used were keyed by date with this signature; they are moved over on first use */
const legacySig=o=>(o.vest?'vest|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];return i?[i.id,i.primaryColor,i.secondaryColor,i.tertiaryColor,i.pattern,i.metal,i.updated||0].join('/'):'-'}).join('|');
async function keepRender(ck,rec,share){renders[ck]=rec;await metaPut('render:'+ck,rec);if(share)shareRender(ck,rec)}
const workerBase=()=>{const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');return w&&tok?{url:new URL('render',w.replace(/\/*$/,'/')).href,tok}:null};
function shareRender(ck,rec){const W=workerBase();if(W)fetch(W.url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({key:ck,rec})}).catch(()=>{})}
const renderFor=o=>{const ck=comboKey(o);if(renders[ck])return renders[ck];
  const v1=renders[comboKeyV1(o)];if(v1){const rec={...v1,sig:comboSig(o)};keepRender(ck,rec,true);return rec}
  const old=renders[key(sel)];if(old&&old.sig===legacySig(o)){const rec={...old,sig:comboSig(o)};keepRender(ck,rec,true);return rec}
  return null};
/* a combination with no photo here: ask the worker (another device may have made it); one with a photo only here: share it */
const renderTried=new Set();
async function fetchRemoteRender(o,day){
  const W=workerBase(),ck=comboKey(o);if(!W||renderTried.has(ck)||rendering)return;renderTried.add(ck);
  try{
    const get=async q=>{const r=await fetch(W.url+'?'+q,{headers:{'x-app-token':W.tok},cache:'no-store'});return r.ok?r.json():null};
    const cur=renders[ck];let j=await get('key='+ck);
    if(!j){if(cur){shareRender(ck,cur);return}
      // a photo the worker kept under the earlier combination key, or for this date before combinations were used
      const v1=await get('key='+comboKeyV1(o));if(v1&&v1.img)j={...v1,sig:comboSig(o),legacy:true};
      else{const old=await get('day='+encodeURIComponent(day));if(old&&old.img&&old.sig===legacySig(o))j={...old,sig:comboSig(o),legacy:true}}}
    if(!j||!j.img)return;
    if(cur&&cur.t>(j.t||0)){shareRender(ck,cur);return}if(cur&&cur.t===(j.t||0))return;
    await keepRender(ck,{sig:comboSig(o),img:await shrinkUrl(j.img,900),model:j.model||'',t:j.t||Date.now()},!!j.legacy);
    if(planFor()[key(sel)]&&comboKey(planFor()[key(sel)])===ck&&!$('#today').hidden)renderToday();
  }catch(e){console.warn('remote photo unavailable',e)}
}
async function loadRenders(){try{const all=await txs('meta','readonly',s=>s.getAll());renders={};for(const x of all||[])if(String(x.k).startsWith('render:'))renders[x.k.slice(7)]=x.v}catch(e){console.warn(e)}}
function outfitText(o){
  const parts=[o.top&&`a ${nm(o.top)}`,o.shirt&&`a plain ${colName(primaryCol(o.shirt))} dress shirt`,o.vest&&`a matching five-button waistcoat (vest) in the same fabric as the suit, buttoned, its V opening visible above the jacket button`,o.tie&&`a ${nm(o.tie)}`,o.clip&&`a ${o.clip.metal||'silver'} tie bar`,
    o.watch&&`a wristwatch with a ${o.watch.metal||'steel'} case, ${watchOpts(o.watch).dial} dial and ${watchOpts(o.watch).band==='bracelet'?'metal bracelet':`${colName(primaryCol(o.watch))} leather strap`}`,o.links&&`${o.links.metal||'silver'} cufflinks`];
  return prettyCols(parts.filter(Boolean).join('; '));
}
/* draw the figure SVG onto a canvas and return a PNG data URL */
function figurePng(o,w=780){
  const svg=figureSvg(o,'r-').replace('width="100%"',`width="${w}" height="${Math.round(w*400/390)}"`).replace('style="display:block;height:auto"','');
  return new Promise((ok,no)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=Math.round(w*400/390);const x=c.getContext('2d');
    x.fillStyle=figBg();x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/png'))};im.onerror=()=>no(new Error('could not draw the illustration'));
    im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
}
const shrinkUrl=(u,max,q=.85)=>new Promise(ok=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',q))};im.onerror=()=>ok(u);im.src=u});
/* generate and keep the photo for one outfit; throws with a readable message */
async function renderCombo(o){
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');
  if(!w||!tok)throw new Error('Set the Worker URL and App Token in ⚙ Settings first.');
  const image=await figurePng(o);
  const refs=['top','tie'].map(s=>o[s]&&o[s].photo).filter(Boolean);   // no shirt photo: the photo is shared by every shirt of that colour
  const r=await fetch(new URL('render',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},body:JSON.stringify({image,refs,outfit:outfitText(o),key:comboKey(o),sig:comboSig(o)})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error((r.status===404||r.status===405)?'Your worker doesn’t support photos yet: redeploy it with the latest worker.js.':(j.error||`HTTP ${r.status}`));
  const rec={sig:comboSig(o),img:await shrinkUrl(j.image,900),model:j.model||'',t:Date.now()};
  await keepRender(comboKey(o),rec,false);   // the worker already kept a copy
  return rec;
}
async function generateRender(){
  const o=planFor()[key(sel)];if(!o||rendering)return;
  const day=key(sel);rendering=true;renderMsg='This takes about 30–90 seconds.';renderToday();
  try{await renderCombo(o);renderMsg=''}
  catch(e){renderMsg=/Worker URL|worker doesn/.test(e.message)?e.message:'Couldn’t generate the photo: '+(e.message||e)}
  finally{rendering=false;if(key(sel)===day)renderToday()}
}
/* when this look (same suit, tie, clip, watch, vest; any shirt of the same colour) was last worn, before the shown day */
function lastWorn(o){
  const ck=comboKey(o),T=todayDate(),lim=Math.min(+keyDate(key(sel)),+T);let best=null;
  for(const r of Object.values(dayRecs)){if(!r.ids||r.worn===false)continue;const d=keyDate(r.date);if(+d>=lim||(best&&d<=best))continue;
    const get=id=>id&&items.find(i=>i.id===id)||null,x={suitDay:!!r.suitDay,top:get(r.ids.top),shirt:get(r.ids.shirt),tie:get(r.ids.tie),clip:get(r.ids.clip),watch:get(r.ids.watch),vest:!!r.vestOn};
    if(x.top&&comboKey(x)===ck)best=d}
  return best;
}
/* ---- item pictures: product photos of shoes, belts, socks, trousers and coats for the tiles under the figure.
   Generated once per look (OpenAI, through the worker), kept like outfit photos and shared between devices. ---- */
const ITEM_PIC_TYPES=['shoes','belt','socks','pants','overcoat','raincoat'];
const aAn=w=>(/^[aeiou]/i.test(w)?'an ':'a ')+w;
function itemDesc(i){const c=colName(primaryCol(i)),lea=patLabel(i.leather||'calf'),pat=i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?patLabel(i.pattern)+' ':'';
  switch(i.type){
    case 'shoes':return `a pair of ${c} ${lea} leather cap-toe oxford dress shoes, side three-quarter view`;
    case 'belt':return `${aAn(c)} ${lea} leather dress belt, loosely coiled, with a polished ${i.metal==='gold'?'gold':i.metal==='other'?'gunmetal':'silver'} buckle`;
    case 'socks':return `a pair of ${c} ${pat}fine ribbed over-the-calf dress socks, laid flat side by side`;
    case 'pants':return `a pair of ${c} ${pat}${primaryCol(i)==='khaki'?'cotton twill':'wool'} dress trousers, neatly folded`;
    case 'overcoat':return `${aAn(c)} wool overcoat on an invisible mannequin`;
    case 'raincoat':return `${aAn(c)} trench coat on an invisible mannequin`}
  return ''}
const itemKey=i=>'c'+fnv64('item|'+itemDesc(i));
const itemPic=i=>i&&ITEM_PIC_TYPES.includes(i.type)&&renders[itemKey(i)]||null;
/* the colour of a product photo's backdrop (the average of its outer edge), so a tile wider than the photo is filled to match;
   the picture's edges are feathered (CSS mask) so there is no visible seam */
const picBgs={};
function picBg(img,k){if(!picBgs[k])try{const N=16,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.drawImage(img,0,0,N,N);
    const d=x.getImageData(0,0,N,N).data,s=[0,0,0];let n=0;for(let y=0;y<N;y++)for(let X=0;X<N;X++)if(y===0||X===0||y===N-1||X===N-1){const o=(y*N+X)*4;s[0]+=d[o];s[1]+=d[o+1];s[2]+=d[o+2];n++}
    picBgs[k]=`rgb(${s.map(v=>Math.round(v/n)).join(',')})`}catch{return}
  const t=img.closest('.tile');if(t){t.style.background=picBgs[k];t.classList.add('has-pic')}}
const itemPicHtml=(i,fallback)=>{const p=itemPic(i);if(p)return `<img class="item-pic" src="${p.img}" alt="" onload="picBg(this,'${itemKey(i)}')">`;if(i&&ITEM_PIC_TYPES.includes(i.type))setTimeout(()=>fetchItemPic(i),0);return fallback};
async function fetchItemPic(i){const W=workerBase(),k=itemKey(i);if(!W||renderTried.has(k)||renders[k])return;renderTried.add(k);
  try{const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});if(!r.ok)return;const j=await r.json();if(!j||!j.img)return;
    await keepRender(k,{sig:'item',img:await shrinkUrl(j.img,400),model:j.model||'',t:j.t||Date.now()},false);if(!$('#today').hidden)renderToday()}catch(e){console.warn('item picture unavailable',e)}}
async function renderItemPic(i){
  const W=workerBase();if(!W)throw new Error('Set the Worker URL and App Token in ⚙ Settings first.');
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'item',item:itemDesc(i),key:itemKey(i)})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
  await keepRender(itemKey(i),{sig:'item',img:await shrinkUrl(j.image,400),model:j.model||'',t:Date.now()},false);
}
const missingItemPics=()=>{const seen=new Set();return items.filter(i=>{if(!ITEM_PIC_TYPES.includes(i.type))return false;const k=itemKey(i);if(seen.has(k)||renders[k])return false;seen.add(k);return true})};
let itemBatch=false;
function renderItemPicUI(){const b=$('#itempic-btn');if(!b||itemBatch)return;const n=missingItemPics().length;
  b.textContent=n?`Generate ${n} item picture${n===1?'':'s'}`:'Every shoe, belt and sock has a picture';b.disabled=!n}
async function startItemPics(){if(itemBatch)return;const todo=missingItemPics();if(!todo.length)return;
  if(!confirm(`Generate ${todo.length} product picture${todo.length===1?'':'s'} for your shoes, belts, socks, trousers and coats?\n\nAbout $${(todo.length*.05).toFixed(2)} at roughly 5¢ each.`))return;
  itemBatch=true;const st=$('#itempic-status'),b=$('#itempic-btn');let done=0,fail=0,err='';
  for(const i of todo){if(st)st.textContent=`Generating ${done+fail+1} of ${todo.length}…`;if(b)b.disabled=true;
    try{renderTried.delete(itemKey(i));await fetchItemPic(i);if(!renders[itemKey(i)])await renderItemPic(i);done++}catch(e){fail++;err=e.message;if(/Worker URL|OPENAI_API_KEY|forbidden/i.test(err))break}}
  itemBatch=false;if(st)st.textContent=`Done: ${done} picture${done===1?'':'s'} ready${fail?`, ${fail} failed (${err})`:''}`;renderItemPicUI();if(!$('#today').hidden)renderToday()}
/* ---- Settings: generate the month's missing photos in one go ---- */
let batch=null;
function batchCombos(){
  const p=planFor(),seen=new Set(),todo=[];
  for(const [k,o] of Object.entries(p)){const d=keyDate(k);if(d.getMonth()!==view.m||d.getFullYear()!==view.y||!o.top||!o.shirt)continue;
    const ck=comboKey(o);if(seen.has(ck))continue;seen.add(ck);if(!renders[ck])todo.push(o)}
  return todo;
}
const monthName=()=>new Date(view.y,view.m,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
function renderBatchUI(){const el=$('#batch-status'),btn=$('#batch-btn');if(!el||!btn)return;
  if(batch){el.textContent=batch.msg;btn.textContent='Stop';btn.onclick=()=>{batch.stop=true;batch.msg='Stopping after the current photo…';renderBatchUI()};return}
  const n=batchCombos().length;btn.textContent=n?`Generate ${n} photo${n===1?'':'s'} for ${monthName()}`:`All of ${monthName()} has photos`;btn.disabled=!n;btn.onclick=startBatch;
  if(!el.dataset.keep)el.textContent=n?`Outfits in ${monthName()} that don’t have a photo yet. Each costs about 7¢ (OpenAI); outfits that share a look share a photo.`:''}
async function startBatch(){
  if(batch)return;let todo=batchCombos();if(!todo.length){renderBatchUI();return}
  if(!confirm(`Generate ${todo.length} realistic photo${todo.length===1?'':'s'} for ${monthName()}?\n\nAbout $${(todo.length*.07).toFixed(2)} at roughly 7¢ each. Keep the app open: each takes 30–90 seconds.`))return;
  batch={done:0,fail:0,n:todo.length,stop:false,msg:'Starting…'};renderBatchUI();
  // a photo another device already made is fetched instead of generated
  for(const o of todo){if(batch.stop)break;const ck=comboKey(o);
    batch.msg=`Generating ${batch.done+batch.fail+1} of ${batch.n}…`;renderBatchUI();
    try{if(!renders[ck]){renderTried.delete(ck);await fetchRemoteRender(o,'');if(!renders[ck])await renderCombo(o)}batch.done++}
    catch(e){batch.fail++;batch.err=e.message;if(/Worker URL|worker doesn|OPENAI_API_KEY|forbidden/i.test(e.message)){batch.stop=true}}
  }
  const b=batch;batch=null;const el=$('#batch-status');
  if(el){el.dataset.keep=1;el.textContent=`Done: ${b.done} photo${b.done===1?'':'s'} ready${b.fail?`, ${b.fail} failed (${b.err})`:''}${b.stop&&b.done+b.fail<b.n?'. Stopped early.':''}`;setTimeout(()=>{delete el.dataset.keep},4000)}
  renderBatchUI();if(!$('#today').hidden)renderToday();
}
function pickPiece(s){figSel=s;const o=planFor()[key(sel)];if(!o)return;
  document.querySelectorAll('#mannequin-container .hot').forEach(b=>{const on=b.getAttribute('onclick').includes(`'${s}'`);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  const w=$('#piece-wrap');if(w)w.innerHTML=pieceCard(o)}
function renderToday(){
  closeSettings();
  const p=planFor();
  const o=p[key(sel)]||{suitDay:true,top:null,bot:null,shirt:null,tie:null,shoes:null,belt:null,socks:null,watch:null,clip:null};
  const nav=`<div class="nav day"><button onclick="stepDay(-1)" aria-label="Previous day">‹</button><h2>${sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}<small class="wx">${settings.location?(wxChip(sel)||'&nbsp;'):'<a href="#" onclick="openSettings(\'weather\');return false">Set your location for weather</a>'}</small></h2><button onclick="stepDay(1)" aria-label="Next day">›</button></div>`;
  // only the stage (the figure) slides on a swipe; the date bar and the item list stay put and just update
  let stage='',side='';
  if(!isWorkday(sel))stage=`<p class="mut empty">${DAY_NAMES[sel.getDay()]} isn't a workday. You can change your workdays in Settings.</p>`;
  else if(!items.length)stage='<p class="mut empty">Your wardrobe is empty. Add photos on the Add tab to get an outfit.</p>';
  else{stage=figureStage(o);
    // the rest warning goes below the list so the list never shifts when it appears or disappears
    side=`${scoreCard(o)}<div class="list">${slots(o)}</div>${dayActions(o)}${(o.notes||[]).map(t=>`<p class="warn">${t}</p>`).join('')}${o.top&&o.top.rest<COOL?`<p class="warn">This ${o.suitDay?'suit':'blazer'} was worn ${o.top.rest} day${o.top.rest===1?'':'s'} ago. Add more ${o.suitDay?'suits':'blazers'} to get a ${COOL}-day rest.</p>`:''}`}
  $('#today').innerHTML=nav+`<div class="daygrid"><div class="stage" id="stage"><div class="slide" id="slide">${stage}</div></div><div class="side">${side}${items.length?monthLink():''}</div></div>`;
  if(items.length){recordDays(p);
  }
}

/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed */
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed.
   from: where the new day's outfit slides in from (px, sign = side); 0 = no animation */
function stepDay(n,from){
  const d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate());
  let g=0;do d.setDate(d.getDate()+n);while(!isWorkday(d)&&++g<7);
  sel=d;view={y:d.getFullYear(),m:d.getMonth()};renderToday();
  const sl=$('#slide');if(!sl)return;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x)return;
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';
  void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';
}
(()=>{const el=$('#today');let st=null;
  const slide=()=>$('#slide');
  el.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    // ignore multi-touch and touches that start at the screen edge (iOS back/forward gesture)
    // the gesture can start anywhere on Today (e.g. a Saturday shows only a one-line message); only the outfit moves
    st=e.touches.length>1||t.clientX<24||t.clientX>innerWidth-24?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0};
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;
    e.preventDefault(); // horizontal drag is ours: no page pan, no zoom bounce
    st.dx=dx;const sl=slide();if(sl){sl.style.transition='none';sl.style.transform=`translateX(${dx}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5;
    if(Math.abs(dx)>70||(fast&&Math.abs(dx)>30)){
      const n=dx<0?1:-1,w=sl.offsetWidth||innerWidth;
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepDay(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}
  };
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(el.hidden||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepDay(1);if(e.key==='ArrowLeft')stepDay(-1)});
})();

function renderWardrobe(){
  closeSettings();
  const cnt=t=>t==='all'?items.length:items.filter(i=>i.type===t).length;
  const chips=['all',...Object.keys(TYPES)].map(t=>`<button class="chip ${flt===t?'on':''}" onclick="flt='${t}';renderWardrobe()">${t==='all'?'All':TYPES[t]} ${cnt(t)}</button>`).join('');
  const list=items.filter(i=>flt==='all'||i.type===flt).sort((a,b)=>a.type.localeCompare(b.type)||b.added-a.added);
  $('#wardrobe').innerHTML=`<h2>Wardrobe</h2>${shopCard()}<div class="chips">${chips}</div>`+(list.length?`<div class="grid">${list.map(i=>`<div class="gi"${editing===i.id?' style="grid-column:1/-1"':''}>${i.photo?`<img class="ph" src="${i.photo}" alt="">`:itemThumb(i)}<b>${TYPES[i.type]||'Item'}</b><br><small class="cap">${desc(i)}</small><div class="btns"><button onclick="editing=editing==='${i.id}'?null:'${i.id}';renderWardrobe()">${editing===i.id?'Close':'Edit'}</button><button onclick="rm('${i.id}')">Delete</button></div>${editing===i.id?editForm(i):''}</div>`).join('')}</div>`:'<p class="mut">Nothing here yet. Add photos on the Add tab.</p>');
}

const S=(list,v,k,i)=>`<select onchange="setq(${i},'${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${x[1]}</option>`).join('')}</select>`;

function renderAdd(){
  closeSettings();
  const workerSet = !!localStorage.getItem('worker_url');
  if($('#note')) $('#note').textContent = !workerSet ? 'Worker URL not set! Tap ⚙ in the top right to configure your Cloudflare Worker.' : aiError || (aiModel?`Last photo tagged by ${/^claude/.test(aiModel)?'Claude':'Workers AI'} (${aiModel}).`:'Photos are tagged by AI through your Cloudflare Worker.');
  const ready=queue.filter(q=>!q.busy&&!q.err).length;if($('#save-all'))$('#save-all').innerHTML=ready>1?`<button class="btn pri" onclick="saveAll()">Save all ${ready} items</button>`:'';
  if($('#queue')) $('#queue').innerHTML=queue.map((q,i)=>q.busy?`<div class="card">${q.multiBusy?'Finding every item in the photo… (this can take up to a minute)':'Analyzing photo…'}</div>`:q.err?`<div class="card">That image couldn’t be read. <button onclick="queue.splice(${i},1);renderAdd()">Dismiss</button></div>`:
`<div class="card">${q.multi?`<p class="multi-h"><b>Item ${q.multi.n} of ${q.multi.of}</b> <span class="conf ${q.multi.confidence}">${q.multi.confidence} confidence</span></p>`:''}
<div class="rv">${q.photo?`<img class="ph" src="${q.photo}" alt="">`:itemThumb(q)}</div>
${FABRIC.includes(q.type)&&q.big?`
<div class="sw-box">
  <div id="swatch-img-${i}" class="sw" style="background-image:url(${q.swatch})"></div>
  <div style="flex:1;font-size:13px">
    <b>Precision Swatch Inspector</b>
    <label>Zoom: <input type="range" min="1" max="4" step="0.1" value="${q.zoom||1}" oninput="updateSwatchParam(${i}, 'zoom', this.value)"></label>
    <label>X-Pos: <input type="range" min="0" max="1" step="0.05" value="${q.cx||0.5}" oninput="updateSwatchParam(${i}, 'cx', this.value)"></label>
    <label>Y-Pos: <input type="range" min="0" max="1" step="0.05" value="${q.cy||0.5}" oninput="updateSwatchParam(${i}, 'cy', this.value)"></label>
  </div>
</div>`:''}
<label>Item ${S(Object.entries(TYPES),q.type,'type',i)}</label>
<label>Primary Colour ${S(COLOR_OPTS(q.type,q.primaryColor),q.primaryColor,'primaryColor',i)}</label>
<label>Secondary Colour ${S([['none','None'], ...COLOR_OPTS(q.type,q.secondaryColor,true)],q.secondaryColor||'none','secondaryColor',i)}</label>
<label>Tertiary Colour ${S([['none','None'], ...COLOR_OPTS(q.type,q.tertiaryColor,true)],q.tertiaryColor||'none','tertiaryColor',i)}</label>
${FABRIC.includes(q.type)?`<label>Pattern ${S((PATS_BY[q.type]||['solid']).map(c=>[c,patLabel(c)]),q.pattern,'pattern',i)}</label>`:''}${METAL_TYPES.includes(q.type)?`<label>${q.type==='belt'?'Buckle':'Metal'} ${S(Object.keys(METAL).map(c=>[c,c]),q.metal,'metal',i)}</label>`:''}
${q.type==='shirt'?`<label>Cuffs ${S(CUFFS,q.cuff||'button','cuff',i)}</label>`:''}${q.type==='suit'?`<label>Vest ${S(VESTS,q.vest==='no'?'no':'yes','vest',i)}</label>`:''}${SEASON_TYPES.includes(q.type)?`<label>Season ${S(SEASONS,q.season||'all','season',i)}</label>`:''}
${q.type==='shoes'||q.type==='belt'?`<label>Leather ${S(LEATHERS.map(c=>[c,patLabel(c)]),q.leather||'calf','leather',i)}</label>`:''}
${q.type==='watch'?`<label>Dial ${S(DIAL_OPTS(watchOpts(q).dial),watchOpts(q).dial,'dial',i)}</label><label>Band ${S(BANDS,watchOpts(q).band,'band',i)}</label><label>Bezel ${S(BEZELS,watchOpts(q).bezel,'bezel',i)}</label><label>Style ${S(WATCH_STYLES,watchOpts(q).style,'watchStyle',i)}</label>`:''}
<div class="btns"><button class="pri" onclick="save(${i})">Confirm</button><button onclick="queue.splice(${i},1);renderAdd()">${q.manual?'Cancel':'Skip'}</button></div>${q.manual?'':`<small>${aiLabel(q)}</small>`}</div>`).join('');
}

function show(t){
  closeSettings();
  for(const s of['today','wardrobe','add']){const el=$('#'+s);if(el)el.hidden=s!==t;const btn=$('#n-'+s);if(btn)btn.classList.toggle('on',s===t)}
  const f={today:renderToday,wardrobe:renderWardrobe,add:renderAdd};if(f[t])f[t]();
}

db.then(()=>Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings')])).then(([r,d,st])=>{items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};show('today');window.appReady=true;loadWeather();loadRenders().then(()=>{if(Object.keys(renders).length&&!$('#today').hidden)renderToday()})}).catch(e=>{console.warn(e);items=[];show('today');window.appReady=true});

/* service worker: fresh files on every load, offline fallback (only over http/https) */
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(e=>console.warn('service worker not registered',e));
/* sync brought new data: refresh the in-memory outfit history too */
function onSyncedData(m){dayRecs=Object.fromEntries((m.days||[]).map(d=>[d.date,d]));if(m.settings)settings={...settings,...m.settings};loadWeather()}

/* ---- settings: schedule, weather location, units ---- */
const unit=()=>settings.units||(/^en-(US|LR|MM)/.test(navigator.language||'')?'F':'C');
const temp=c=>Math.round(unit()==='F'?c*9/5+32:c);
const wxIcon=c=>c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌦️':c<=86?'🌨️':'⛈️';
function wxChip(d){const w=weather[key(d)];if(!w)return '';return `${wxIcon(w.code)} ${temp(w.tmax)}°/${temp(w.tmin)}°${(w.pop||0)>=30?` · ☂ ${w.pop}%`:''}`}
async function saveUserSettings(){settings.updated=Date.now();await metaPut('settings',settings);cache={};if(window.scheduleSync)scheduleSync()}
/* ---- Settings: formal days (any upcoming workday) and regenerating the shown day's photo ---- */
const shortDate=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function renderFormalUI(msg){const list=$('#formal-list'),inp=$('#cfg-formal-date');if(!list)return;
  const T=todayDate();if(inp){inp.min=isoDate(T);if(!inp.value)inp.value=isoDate(nextWorkday?nextWorkday(T):T)}
  const up=Object.values(dayRecs).filter(r=>r.formal&&keyDate(r.date)>=T).sort((a,b)=>keyDate(a.date)-keyDate(b.date));
  list.innerHTML=up.length?up.map(r=>{const l=shortDate(keyDate(r.date));return `<span class="fchip">${l}<button type="button" aria-label="Make ${l} a regular day" onclick="setFormal(false,'${r.date}')">×</button></span>`}).join(''):'<small class="mut">No formal days coming up.</small>';
  if(msg!==undefined&&$('#formal-msg'))$('#formal-msg').textContent=msg}
async function addFormalDay(){const v=($('#cfg-formal-date')||{}).value;if(!v)return renderFormalUI('Pick a date first.');
  const [y,m,dd]=v.split('-').map(Number),d=new Date(y,m-1,dd),k=key(d),l=shortDate(d);
  if(d<todayDate())return renderFormalUI(`${l} has passed.`);
  const o=monthPlan(y,m-1)[k];if(!o)return renderFormalUI(`${l} is a day off, so there's no outfit to change.`);
  if(o.frozen)return renderFormalUI(`${l} is already locked in.`);
  if(o.formal)return renderFormalUI(`${l} is already a formal day.`);
  await setFormal(true,k);renderFormalUI(`${l} is now a formal day: dark suit, white shirt, quiet tie.`)}
function renderRegenUI(){const btn=$('#regen-btn'),st=$('#regen-status');if(!btn)return;const o=planFor()[key(sel)],l=shortDate(sel);
  const r=o&&renderFor(o);btn.disabled=!o||rendering;btn.textContent=rendering?'Generating photo…':o?`${r?'Regenerate':'Generate'} photo for ${l}`:`No outfit on ${l}`;
  if(st)st.textContent=o?(r?'Makes a new realistic photo of the day shown on Today (about 7¢); it replaces the current one for every day with this look.':'The day shown on Today has no photo yet (about 7¢).'):'Pick a workday on Today first.'}
function renderSettingsExtras(){
  renderBatchUI();renderItemPicUI();renderFormalUI();renderRegenUI();
  const tog=(id,list)=>{const el=$(id);if(el)el.innerHTML=DAY_NAMES.map((n,i)=>`<button type="button" class="dtog ${list.includes(i)?'on':''}" onclick="toggleDay('${id}',${i})" aria-pressed="${list.includes(i)}">${n.slice(0,3)}</button>`).join('')};
  tog('#cfg-workdays',settings.workdays);tog('#cfg-blazer',settings.blazerDays.filter(d=>settings.workdays.includes(d)));
  if($('#wx-loc'))$('#wx-loc').textContent=settings.location?`Weather for ${settings.location.name}`:'No location set: outfits follow the calendar season.';
  if($('#cfg-units'))$('#cfg-units').value=unit();
  if($('#cfg-vest'))$('#cfg-vest').value=settings.vestMode||'auto';
}
function setVestMode(v){settings.vestMode=v;saveUserSettings()}
function toggleDay(id,i){const k=id==='#cfg-workdays'?'workdays':'blazerDays',l=new Set(settings[k]);l.has(i)?l.delete(i):l.add(i);
  if(k==='workdays'&&l.size===0)return;settings[k]=[...l].sort();if(k==='workdays')settings.blazerDays=settings.blazerDays.filter(d=>l.has(d));
  renderSettingsExtras();saveUserSettings()}
function setUnits(v){settings.units=v;saveUserSettings()}
function setLocation(loc){settings.location=loc;localStorage.removeItem('wx');weather={};saveUserSettings().then(()=>loadWeather(true));renderSettingsExtras();if($('#city-results'))$('#city-results').innerHTML=''}
function useMyLocation(){if(!navigator.geolocation){alert('Location is not available on this device.');return}
  navigator.geolocation.getCurrentPosition(p=>setLocation({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3),name:'your current location'}),()=>alert('Location permission was denied. Search for your city instead.'))}
async function findCity(){const q=($('#cfg-city')&&$('#cfg-city').value||'').trim();if(!q)return;
  try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name='+encodeURIComponent(q));const j=await r.json();
    const res=(j.results||[]).map(c=>({lat:c.latitude,lon:c.longitude,name:[c.name,c.admin1,c.country_code].filter(Boolean).join(', ')}));
    window._cities=res;$('#city-results').innerHTML=res.length?res.map((c,i)=>`<button type="button" onclick="setLocation(_cities[${i}])">${c.name}</button>`).join(''):'<small class="mut">No matches.</small>'}
  catch(e){$('#city-results').innerHTML='<small class="mut">City search is unavailable right now.</small>'}}
/* 16-day forecast from Open-Meteo (free, no key); cached for 3 hours */
/* header ↻: sync with the worker (if set up), reload everything from storage, refresh the forecast and redraw */
let toastTimer=null;
function toast(t,ms=2500){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('on'),ms)}
let refreshing=false;
async function refreshAll(){
  if(refreshing)return;refreshing=true;const b=$('#refresh-btn');if(b)b.classList.add('spin');
  let msg='';
  try{
    const n0=items.length;
    if(window.syncNow&&localStorage.getItem('worker_url')&&localStorage.getItem('app_token')){
      const ok=await syncNow();if(!ok)msg=localStorage.getItem('sync_status')||'Sync failed.'}
    const [r,d,st]=await Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings')]);
    items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};cache={};
    await loadWeather(true);
    if(typeof renderTried!=='undefined')renderTried.clear();
    const v=['today','wardrobe','add'].find(t=>!$('#'+t).hidden)||'today';show(v);
    if(!msg){const diff=items.length-n0;msg=`Refreshed · ${items.length} item${items.length===1?'':'s'}${diff>0?` (${diff} new)`:diff<0?` (${-diff} removed)`:''}`}
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(g=>g&&g.update()).catch(()=>{});
  }catch(e){msg='Refresh failed: '+(e.message||e)}
  finally{refreshing=false;if(b)b.classList.remove('spin');toast(msg)}
}
async function loadWeather(force){
  const L=settings.location;if(!L)return;
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');
    if(!force&&c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3){weather=c.days;cache={};if(!$('#today').hidden)renderToday();return}}catch{}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&timezone=auto&forecast_days=16`);
    const d=(await r.json()).daily;if(!d||!d.time)return;const days={};
    d.time.forEach((t,i)=>{const [y,m,dd]=t.split('-').map(Number);days[key(new Date(y,m-1,dd))]={tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],pop:d.precipitation_probability_max[i]??0,rain:d.precipitation_sum[i]??0,code:d.weather_code[i]??0}});
    weather=days;localStorage.setItem('wx',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),days}));cache={};if(!$('#today').hidden)renderToday()}
  catch(e){console.warn('weather unavailable',e)}
}

/* ---- what to buy ---- */
let shop=null,shopBusy=null;
const shopSig=()=>items.map(i=>i.id+':'+stamp(i)).sort().join(',')+'|'+JSON.stringify([settings.workdays,settings.blazerDays]);
function shopCard(){
  let body='';
  if(shopBusy)body=`<p class="mut"><small>${shopBusy}</small></p>`;
  else if(shop&&shop.sig===shopSig()){const r=shop.res,b=r.base;
    body=`<p class="mut"><small>Next 8 weeks (${b.days} workdays): average score ${b.avg}, ${b.problems} day${b.problems===1?'':'s'} with a problem, ${b.rest} day${b.rest===1?'':'s'} where a suit hasn't rested ${COOL} days.</small></p>`+
      (r.recs.length?`<p class="mut"><small>In order of need: each step assumes you bought the ones above it. Buying all ${r.recs.length}: average ${r.after.avg}, ${r.after.problems} problem day${r.after.problems===1?'':'s'}, ${r.after.rest} short-rest day${r.after.rest===1?'':'s'}.</small></p><ol class="recs">${r.recs.map((x,i)=>`<li><div class="rec-img">${itemThumb(x.items[0])}</div><div class="rec-txt"><b class="cap">${x.name}</b><small>${x.why.join(' · ')}</small>
        <button onclick="boughtRec(${i})">I bought this</button></div><span class="sc ${x.gain>=5?'good':x.gain>=2?'ok':'low'}" title="improvement">${i+1}</span></li>`).join('')}</ol>`
      :'<p><small>Nothing on the standard list would make a real difference. Your wardrobe covers the next 8 weeks well.</small></p>');
  }else if(items.length)body='<p class="mut"><small>Plans your next 8 weeks with each likely purchase and ranks what would improve your outfits most.</small></p>';
  return items.length?`<div class="card shop"><div class="shop-head"><b>What to buy</b><button onclick="analyzeWardrobe()" ${shopBusy?'disabled':''}>${shop&&shop.sig===shopSig()?'Re-check':'Analyze my wardrobe'}</button></div>${body}</div>`:'';
}
function analyzeWardrobe(){
  const sig=shopSig(),payload={list:items,settings,weather,today:TODAY_OVERRIDE,weeks:8};
  const finish=res=>{shopBusy=null;shop={sig,res};if(!$('#wardrobe').hidden)renderWardrobe()};
  const progress=(i,n)=>{shopBusy=`Checking ${i+1} of ${n} possible purchases…`;const el=$('#wardrobe .shop small');if(el)el.textContent=shopBusy};
  shopBusy='Starting…';renderWardrobe();
  let w=null;try{w=new Worker('analysis-worker.js')}catch(e){}
  if(w){w.onmessage=e=>{const d=e.data;if(d.progress)progress(...d.progress);else{w.terminate();if(d.error){shopBusy=null;alert('Analysis failed: '+d.error);renderWardrobe()}else finish(d.done)}};
    w.onerror=()=>{w.terminate();runOnMainThread()};w.postMessage(JSON.parse(JSON.stringify(payload)));}
  else runOnMainThread();
  function runOnMainThread(){setTimeout(()=>finish(runAnalysis(items,todayDate(),8,progress)),30)}  // fallback where workers aren't available
}
async function boughtRec(i){
  const rec=shop&&shop.res.recs[i];if(!rec)return;
  for(const x of rec.items){const it={...x,id:crypto.randomUUID(),added:Date.now()};await put(it);items.push(it)}
  cache={};shop=null;renderWardrobe();analyzeWardrobe();
}

/* ---- theme: Auto (follow the device) → Light → Dark; saved per device ---- */
const THEMES={auto:['◐','automatic'],light:['☀︎','light'],dark:['☾','dark']};
function applyTheme(t){
  if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else{delete document.documentElement.dataset.theme;t='auto'}
  const b=$('#theme-btn');if(b){b.textContent=THEMES[t][0];b.setAttribute('aria-label','Theme: '+THEMES[t][1]);b.title='Theme: '+THEMES[t][1]+' (tap to change)'}
  if(window.appReady&&$('#today')&&!$('#today').hidden&&$('.fig'))renderToday();   // the figure fades into the page colour
}
function cycleTheme(){
  let cur='auto';try{cur=localStorage.getItem('theme')||'auto'}catch{}
  const next={auto:'light',light:'dark',dark:'auto'}[cur]||'auto';
  try{next==='auto'?localStorage.removeItem('theme'):localStorage.setItem('theme',next)}catch{}
  applyTheme(next);
}
try{applyTheme(localStorage.getItem('theme')||'auto')}catch{applyTheme('auto')}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(window.appReady&&!$('#today').hidden&&$('.fig'))renderToday()})}catch{}
