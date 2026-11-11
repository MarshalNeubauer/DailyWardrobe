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
  renderSettingsExtras();if(queuedKeys().length)checkQueue();
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
/* tag one item: its photo (a data URL, or a canvas), plus the close-up, the measurement and the rest (tagExtras in tagging.js) */
async function ask(c,extra){
  try {
    const workerUrl=localStorage.getItem('worker_url');
    if(!workerUrl) return null;
    const dataUrl=typeof c==='string'?c:c.toDataURL('image/jpeg',TAG_Q);
    const res=await fetch(workerUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image:dataUrl,appToken:localStorage.getItem('app_token')||'',...tagExtras(extra)})
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
      dial:normCol(parsed.dial),band:['bracelet','leather'].includes(parsed.band)?parsed.band:null,bezel:['fluted','smooth'].includes(parsed.bezel)?parsed.bezel:null,
      // how sure it was, its runner-up, and what it would add when nothing listed fits (single-item tags)
      conf:parsed.confidence&&typeof parsed.confidence==='object'?parsed.confidence:null,
      altColor:normColFor(parsed.type,parsed.altColor),altPattern:parsed.altPattern&&parsed.altPattern!=='none'&&(PATS_BY[parsed.type]||[]).includes(parsed.altPattern)?parsed.altPattern:null,
      newColor:parsed.newColor&&parsed.newColor.name?parsed.newColor:null,newPattern:parsed.newPattern&&parsed.newPattern.name?parsed.newPattern:null,
      clothBox:parsed.clothBox&&typeof parsed.clothBox==='object'?parsed.clothBox:null,
      patternBox:parsed.patternBox&&typeof parsed.patternBox==='object'?parsed.patternBox:null,weave:parsed.weave&&typeof parsed.weave==='object'?parsed.weave:null
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

/* ---- automatic white balance (wbRead/wbGains in tagging.js): the light's colour is read from the brightest near-neutral pixels (a white wall, backdrop,
   shirt or label), which should be grey, and every pixel is scaled to make them so. Conservative: no correction when there
   are too few of them, when they fill nearly the whole photo (then they are the item itself, e.g. a close-up of a cream
   shirt; a white backdrop behind an item is fine), or when the cast is under 2%; each channel moves at most -15%/+18%. ---- */
function applyWb(c,g){const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0);
  if(!g)return o;const D=x.getImageData(0,0,o.width,o.height),d=D.data;
  for(let i=0;i<d.length;i+=4){d[i]=Math.min(255,d[i]*g.r);d[i+1]=Math.min(255,d[i+1]*g.g);d[i+2]=Math.min(255,d[i+2]*g.b)}x.putImageData(D,0,0);return o}
/* an Add card's pictures from its uncorrected originals, with or without the correction (Show original toggles it) */
function cardPics(q){const g=q.wbOff?null:q.wb;q.big=applyWb(q.raw.big,g);q.photo=shrink(q.big,360).toDataURL('image/jpeg',.8);
  if(q.raw.full)q.tagImg=applyWb(q.raw.full,g).toDataURL('image/jpeg',TAG_Q);   // the sharp copy the tagger sees
  if(q.raw.tex)q.texture=applyWb(q.raw.tex,texGains(q)).toDataURL('image/jpeg',.85);generateSwatch(q)}
/* a close-up with its own white reference (a corner of white paper) is corrected from that; otherwise like its item photo */
function texGains(q){const r=wbRead(q.raw.tex);return r.ref?r.gains:(q.wbOff?null:q.wb)}
function toggleWb(i){const q=queue[i];if(!q||!q.raw)return;q.wbOff=!q.wbOff;cardPics(q);renderAdd()}
const TEX_MAX=640;
/* the fabric close-up for an Add card: corrected with the same light reading as the card's item photo (taken together) */
async function addTexture(i,f){const q=queue[i];if(!q||!f)return;
  try{const img=await loadImg(f);q.raw=q.raw||{};q.raw.tex=shrink(img,TEX_MAX);q.raw.texFull=shrink(img,CLOSE_MAX);q.texture=applyWb(q.raw.tex,texGains(q)).toDataURL('image/jpeg',.85);q.refineNote='';renderAdd();
    refineFromCloseup(queue.indexOf(q))}   // tag again with both photos (tagging.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
function dropTexture(i){const q=queue[i];if(!q)return;delete q.texture;if(q.raw){delete q.raw.tex;delete q.raw.texFull}q.refineNote='';measureCard(q);renderAdd()}
/* the second step of a card for suits, blazers, trousers, shirts and ties: the close-up photo */
function texSlot(q,i){if(!TEXTURE_TYPES.includes(q.type))return '';
  const inp=`<input type="file" accept="image/*" hidden onchange="addTexture(${i},this.files[0]);this.value=''">`;
  return q.texture?`<div class="texslot done"><small class="mut">Fabric close-up added: the swatch shows it on the right half, next to the colour as tagged.</small><div class="btns"><label class="btn">Replace close-up${inp}</label><button type="button" onclick="dropTexture(${i})">Remove</button></div></div>`
    :`<div class="texslot"><b>Step 2 · Fabric close-up</b><small class="mut">Hold the camera close to the cloth so the weave and its true colour fill the frame. It makes the realistic photos match better. Optional.</small><label class="btn pri">Add close-up${inp}</label></div>`}
const wbNote=(q,i)=>q.wb&&q.raw?`<p class="wbnote mut"><small>${q.wbOff?'Original colours.':'Colours corrected for the light.'}</small> <button type="button" class="linkbtn" onclick="toggleWb(${i})">${q.wbOff?'Correct them':'Show original'}</button></p>`:'';
/* Add: "One item" (multi false; also paste and drag) makes one card per photo; "Several items" finds every item in it */
async function addFiles(files,multi){
  if(multi){multiNote(true);for(const f of files)await addMulti(f);return}
  for(const f of files){
    const q={id:crypto.randomUUID(),busy:1};
    queue.push(q);
    renderAdd();
    try{
      const img=await loadImg(f);
      q.raw={big:shrink(img,800),full:shrink(img,TAG_MAX)};q.wb=wbGains(q.raw.big);cardPics(q);   // tagged from the corrected, sharp copy
      const aiResult=await ask(q.tagImg);
      fill(q,aiResult);if(aiResult){takeExtras(q,aiResult);measureCard(q)}
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
function multiNote(on){multiMsg(on?'Each item in the photo gets its own card. Check each card: colours and textures from a rail photo need a look, especially whites.':'')}
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
    const raw=shrink(await loadImg(f),2576),wb=wbGains(raw),img=applyWb(raw,wb);   // one light reading for the whole photo; Claude reads up to 2576px
    const r=await fetch(new URL('tag-many',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},
      body:JSON.stringify({image:img.toDataURL('image/jpeg',.9),custom:customForTag(),corrections:tagFixes()})});
    const j=await r.json().catch(()=>({}));
    queue.splice(queue.indexOf(holder),1);
    if(!r.ok){multiMsg(r.status===404||r.status===405?'Your worker doesn’t support several items yet: it needs the latest worker.js.':`Couldn’t find the items: ${j.detail||j.error||'HTTP '+r.status}`);renderAdd();return}
    const list=j.items||[];
    if(!list.length){multiMsg('No clothing items were found in that photo.');renderAdd();return}
    list.forEach((it,n)=>{
      const q={id:crypto.randomUUID(),multi:{n:n+1,of:list.length,confidence:it.confidence||'medium'}};
      q.raw={big:cropBox(raw,it.box,800),full:cropBox(raw,it.box,TAG_MAX)};q.wb=wb;cardPics(q);
      const tg=normTag(it,j.model);fill(q,tg);q.aiTag={...aiFields(tg)};queue.push(q);
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
const setq=(i,k,v)=>{const q=queue[i];q[k]=v==='none'?null:v;q.edited={...q.edited,[k]:true};if(k==='type'){q.pattern=normPat(v,q.pattern);shirtColFix(q)}if(k==='type'||q.manual||k==='primaryColor'||k==='pattern'){if(k==='type'&&q.meas)q.meas.near=nearestCols(q.type,q.meas.lab,q.meas.ref);if(k==='type'||k==='pattern')readSett(q);renderAdd()}else{const t=$('#tagsw-q'+i);if(t)t.innerHTML=tagSwInner(q)}};
/* next to an item's photo: the colour and texture as tagged (what the app draws), so the two can be compared */
/* with a fabric close-up: the drawn swatch on the left half, the close-up on the right, to compare colour and weave */
const tagSwInner=i=>`<div class="swsplit">${itemThumb(i,true)}${i.texture&&TEXTURE_TYPES.includes(i.type)?`<img class="swtex" src="${i.texture}" alt="Fabric close-up">`:''}</div><figcaption>${i.texture&&TEXTURE_TYPES.includes(i.type)?'As tagged · Close-up':'As tagged'}<br><b class="cap">${desc(i)||TYPES[i.type]||''}</b></figcaption>`;
const photoPair=(photo,i,id)=>`<div class="pair"><figure class="phfig"><img class="ph" src="${photo}" alt="Photo"><figcaption>Photo</figcaption></figure><figure class="tagsw" id="${id}" aria-live="polite">${tagSwInner(i)}</figure></div>`;
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
  if(q.texture&&TEXTURE_TYPES.includes(q.type))it.texture=q.texture;
  if(q.meas)it.meas={lab:q.meas.lab,ref:!!q.meas.ref,src:q.meas.src};   // the owner's own colour samples (calibLab)
  if(q.sett&&!q.settOff&&settable(it.type,it.pattern,q.weave)){it.sett=q.sett;if(q.patternBox)it.pbox=q.patternBox}   // the full pattern (tagging.js)
  if(q.weave&&FABRIC.includes(it.type)&&it.pattern!=='solid'){it.weave=q.weave;if(q.weave.description)it.patternText=q.weave.description}
  if(q.spec&&it.sett&&it.sett.src==='claude+pixels')it.patternSpec=q.spec;   // Claude's reading of the pattern (tagging.js)
  if(!it.sett)try{const st=detectQueued(q,it);if(st)it.stripes=st}catch(e){console.warn('pattern detection failed',e)}
  await put(it);items.push(it);cache={};queue.splice(i,1);renderAdd();
  if(q.tagImg)keepTagImg(it.id,q.tagImg);recordTagResult(q,it);   // tagging.js: the sharp copy for the benchmark; what the tagger got wrong
}
let editing=null;
const E=(id,k,list,v,lab)=>`<label>${lab?lab:k==='primaryColor'?'Primary':k==='secondaryColor'?'Secondary':k==='tertiaryColor'?'Third colour':k==='watchStyle'?'Style':k[0].toUpperCase()+k.slice(1)} <select onchange="sete('${id}','${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${x[1]}</option>`).join('')}</select></label>`;
/* ---- Wardrobe editor: replace, rotate, zoom-crop the item's photo. Only the picture changes: the tags (colour, pattern...)
   and the item itself stay, so the plan and the outfit history are untouched. Undo works until the editor is closed. ---- */
let phEdit={id:null,undo:[],crop:null};
const PH_MAX=720;
function photoTools(i){if(phEdit.crop)return '';
  const tex=TEXTURE_TYPES.includes(i.type)?`<label class="btn">${i.texture?'Replace close-up':'Add fabric close-up'}<input type="file" accept="image/*" hidden onchange="replaceTexture('${i.id}',this.files[0]);this.value=''"></label>`+(i.texture?`<button type="button" onclick="setTexture('${i.id}',null,'Close-up removed.')">Remove close-up</button>`:''):'';
  return `<div class="phtools"><label class="btn">${i.photo?'Replace photo':'Add photo'}<input type="file" accept="image/*" hidden onchange="replacePhoto('${i.id}',this.files[0]);this.value=''"></label>`+tex+
    (i.photo?`<button type="button" onclick="rotatePhoto('${i.id}')" aria-label="Rotate the photo a quarter turn clockwise">Rotate ↻</button><button type="button" onclick="startCrop('${i.id}')">Zoom &amp; crop</button>`:'')+
    (phEdit.undo.length?`<button type="button" onclick="undoPhoto('${i.id}')">Undo</button>`:'')+`</div>`}
const imgOf=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src});
async function setPic(id,k,url,msg){const it=items.find(x=>x.id===id);if(!it)return;phEdit.undo.push({k,v:it[k]||null});if(phEdit.undo.length>10)phEdit.undo.shift();
  if(url)it[k]=url;else delete it[k];await put(it);cache={};renderWardrobe();if(msg)toast(msg)}
const setPhoto=(id,url,msg)=>setPic(id,'photo',url,msg),setTexture=(id,url,msg)=>setPic(id,'texture',url,msg);
/* a close-up added later stays as taken: the item photo's light reading may not hold for another moment */
async function replaceTexture(id,f){if(!f)return;try{const img=await loadImg(f);await setTexture(id,shrink(img,TEX_MAX).toDataURL('image/jpeg',.85),'Close-up added. The realistic photos use it from the next one made.')}
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
async function replacePhoto(id,f){if(!f)return;try{const img=await loadImg(f);await setPhoto(id,shrink(img,PH_MAX).toDataURL('image/jpeg',.85),'Photo replaced. The item’s tags and your plan are unchanged.')}
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
async function rotatePhoto(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo),c=document.createElement('canvas');
  c.width=im.height;c.height=im.width;const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);await setPhoto(id,c.toDataURL('image/jpeg',.9))}
async function undoPhoto(id){const it=items.find(x=>x.id===id);if(!it||!phEdit.undo.length)return;const {k,v}=phEdit.undo.pop();
  if(v)it[k]=v;else delete it[k];await put(it);cache={};renderWardrobe()}
/* zoom & crop: a square frame; the slider zooms (about the centre), dragging moves the picture */
async function startCrop(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo);
  phEdit.crop={w:im.naturalWidth,h:im.naturalHeight,z:1,cx:.5,cy:.5};renderWardrobe();requestAnimationFrame(layoutCrop)}
function cropEditor(i){const c=phEdit.crop;return `<div class="cropwrap"><div class="cropbox" id="cropbox" onpointerdown="cropDrag(event)"><img id="cropimg" src="${i.photo}" alt="Photo being cropped" draggable="false"></div>
  <label class="cropzoom">Zoom <input type="range" min="1" max="4" step="0.05" value="${c.z}" oninput="phEdit.crop.z=+this.value;layoutCrop()" aria-label="Zoom"></label>
  <p class="mut" style="margin:2px 0 6px;font-size:13px">Drag the picture to position it.</p>
  <div class="btns"><button class="pri" type="button" onclick="applyCrop('${i.id}')">Apply</button><button type="button" onclick="phEdit.crop=null;renderWardrobe()">Cancel</button></div></div>`}
function cropGeom(){const c=phEdit.crop,box=$('#cropbox');if(!c||!box)return null;const V=box.clientWidth,s=V/Math.min(c.w,c.h)*c.z,W=c.w*s,H=c.h*s;
  // keep the frame inside the picture
  const hx=V/2/W,hy=V/2/H;c.cx=Math.min(1-hx,Math.max(hx,c.cx));c.cy=Math.min(1-hy,Math.max(hy,c.cy));
  return {V,s,W,H,x:V/2-c.cx*W,y:V/2-c.cy*H}}
function layoutCrop(){const g=cropGeom(),img=$('#cropimg');if(!g||!img)return;Object.assign(img.style,{width:g.W+'px',height:g.H+'px',left:g.x+'px',top:g.y+'px'})}
function cropDrag(e){const c=phEdit.crop;if(!c)return;e.preventDefault();const box=e.currentTarget;box.setPointerCapture&&box.setPointerCapture(e.pointerId);let lx=e.clientX,ly=e.clientY;
  const mv=ev=>{const g=cropGeom();if(!g)return;c.cx-=(ev.clientX-lx)/g.W;c.cy-=(ev.clientY-ly)/g.H;lx=ev.clientX;ly=ev.clientY;layoutCrop()};
  const up=()=>{box.removeEventListener('pointermove',mv);box.removeEventListener('pointerup',up);box.removeEventListener('pointercancel',up)};
  box.addEventListener('pointermove',mv);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up)}
async function applyCrop(id){const it=items.find(x=>x.id===id),g=cropGeom();if(!it||!g)return;const im=await imgOf(it.photo);
  const side=g.V/g.s,sx=-g.x/g.s,sy=-g.y/g.s,out=Math.min(PH_MAX,Math.round(side)),c=document.createElement('canvas');c.width=c.height=out;
  c.getContext('2d').drawImage(im,sx,sy,side,side,0,0,out,out);phEdit.crop=null;await setPhoto(id,c.toDataURL('image/jpeg',.9))}
function editForm(i){
  if(phEdit.id!==i.id)phEdit={id:i.id,undo:[],crop:null};
  const cols=COLOR_OPTS(i.type,primaryCol(i)),acc=c=>[['none','None'],...COLOR_OPTS(i.type,c,true)];
  return `<div class="card" style="margin:8px 0 0;padding:8px">${photoTools(i)}${E(i.id,'type',Object.entries(TYPES),i.type)}${E(i.id,'primaryColor',cols,primaryCol(i))}${E(i.id,'secondaryColor',acc(i.secondaryColor),i.secondaryColor||'none',i.type==='socks'?'Toe cap':'')}${i.type==='socks'?'':E(i.id,'tertiaryColor',acc(i.tertiaryColor),i.tertiaryColor||'none')}
  ${FABRIC.includes(i.type)?E(i.id,'pattern',(PATS_BY[i.type]||['solid']).map(c=>[c,patName(c)]),normPat(i.type,i.pattern)):''}${METAL_TYPES.includes(i.type)?E(i.id,'metal',Object.keys(METAL).map(c=>[c,c]),i.metal||'silver'):''}
  ${i.type==='shirt'?E(i.id,'cuff',CUFFS,i.cuff||'button'):''}${i.type==='suit'?E(i.id,'vest',VESTS,i.vest==='no'?'no':'yes'):''}${SEASON_TYPES.includes(i.type)?E(i.id,'season',SEASONS,i.season||'all'):''}
  ${i.type==='shoes'||i.type==='belt'?E(i.id,'leather',LEATHERS.map(c=>[c,patLabel(c)]),i.leather||'calf'):''}
  ${i.type==='watch'?`<label class="wdetails">Details <input type="text" value="${esc(i.details||'')}" placeholder="e.g. three subdials, 12 and 6 numerals" onchange="sete('${i.id}','details',this.value.trim()||'none')"></label>`:''}${i.type==='watch'?E(i.id,'dial',DIAL_OPTS(watchOpts(i).dial),watchOpts(i).dial)+E(i.id,'band',BANDS,watchOpts(i).band)+E(i.id,'bezel',BEZELS,watchOpts(i).bezel)+E(i.id,'watchStyle',WATCH_STYLES,watchOpts(i).style):''}
  ${DETECT_PATS.includes(patBase(i.pattern))||settable(i.type,i.pattern,i.weave)||i.sett?`<p class="mut" style="margin:6px 0;font-size:14px">Pattern layout: ${patSummary(i)}</p><div class="btns"><button onclick="${i.texture||i.pbox||claudeOnly(i.type,i.pattern)?`rereadSett('${i.id}')`:`redetect('${i.id}')`}">Read pattern from photo</button>${i.stripes||i.sett?`<button onclick="clearStripes('${i.id}')">Use generic</button>`:''}</div>`:''}
  <div class="btns"><button class="pri" onclick="closeItem()">Done</button></div></div>`;
}
async function sete(id,k,v){
  const it=items.find(x=>x.id===id);if(!it)return;
  it[k]=v==='none'?null:v;
  if(k==='type'){it.pattern=normPat(v,it.pattern);shirtColFix(it);if((v==='watch'||v==='tieclip')&&!it.metal)it.metal='silver';if((v==='shoes'||v==='belt')&&!it.leather)it.leather='calf';if(v==='belt'&&!it.metal)it.metal='silver'}
  if(k==='primaryColor')delete it.color;
  await put(it);cache={};renderWardrobe();
}
function patSummary(i){
  if(usableSett(i))return settSummary(i.sett);
  if(i.sett&&i.sett.tex)return `generic (the weave texture read earlier is for a ${TEX_WORDS[i.sett.tex.kind]||'woven'} pattern)`;
  if(i.sett)return `generic (an older reading drew these ${patName(i.pattern).toLowerCase()} figures as stripes; Read pattern from photo reads them as figures)`;
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
/* take an item out of rotation, or put it back. Taking it out also lets go of the upcoming days it was pinned to (a swap or a
   hand pick), so those days are planned again without it; past days and days marked worn keep it. */
async function togglePause(id){const it=items.find(x=>x.id===id);if(!it)return;it.paused=!it.paused;if(!it.paused)delete it.paused;
  let n=0;if(it.paused){const T=todayDate();
    for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<T||r.worn===true||!r.force)continue;const f={...r.force};let hit=false;
      for(const [s,v] of Object.entries(f))if(v===id){delete f[s];hit=true}
      if(hit){const nr={...r,force:f};if(!Object.keys(f).length)delete nr.force;delete nr.ids;await saveDay(nr,true);n++}}}
  await put(it);cache={};renderWardrobe();
  toast(it.paused?`Out of rotation: the planner won't pick it${n?`, and ${n} upcoming day${n===1?' was':'s were'} planned again without it`:''}.`:'Back in rotation.')}
async function clearStripes(id){const it=items.find(x=>x.id===id);if(!it)return;delete it.stripes;delete it.sett;await put(it);cache={};renderWardrobe()}
async function rm(id){if(!confirm('Delete this item?'))return;await del(id);items=items.filter(i=>i.id!==id);cache={};if(editing===id){editing=null;editAt=null}renderWardrobe()}

/* the plan for a month. Every month from two months back shares one simulation (kept in the cache, so anything that clears
   the cache starts it again): another month only plans the days not planned yet. Earlier months are built on their own. */
let cache={};
function planMonth(y,m){const k=y+'-'+m;if(cache[k])return cache[k];
  const start=planStart(y,m),T=todayDate();
  if(+start!==+planStart(T.getFullYear(),T.getMonth()))return cache[k]=buildPlan(y,m);
  return cache[k]=(cache.sim||(cache.sim=planSim(start))).upTo(new Date(y,m+1,0))}
const planFor=()=>planMonth(view.y,view.m);

/* views */
const hasOutfit=o=>!!o&&!!(o.top||o.shirt);   // a day without a jacket (the no-jacket occasion) still has an outfit
const canPick=o=>!o.frozen||pastEdit===key(sel);   // a past day only while it is being corrected
const vestRow=o=>!(o.suitDay&&hasVest(o.top))?'':`<div class="row vest-row"><span class="mut">Vest</span>${o.vest?`<span class="dot">${swatchSVG(o.top)}</span><span class="cap">Matching vest</span>`:'<span class="mut none">Not today</span>'}${!canPick(o)?'':`<button class="swap" onclick="setVest(${!o.vest})" aria-label="${o.vest?'Leave off the vest':'Wear the vest'}" title="${o.vest?'Leave off the vest':'Wear the vest'}">${o.vest?'−':'+'}</button>`}</div>`;
/* the outfit list: tapping a piece's swatch or name unfolds its photo inside the list (the actual item, so you can see
   exactly which shirt it is); one at a time; items without a photo show their product picture or drawing */
let openRow=null;
const rowPic=i=>i.photo?`<img class="rpic" src="${i.photo}" alt="Photo of ${esc(desc(i)||nm(i))}">`:itemPic(i)?`<img class="rpic" src="${itemPic(i).img}" alt="Picture of ${esc(desc(i)||nm(i))}">`:`<div class="rpic draw">${itemThumb(i,true)}</div>`;
const rowPanel=i=>rowPic(i)+(i.photo?'':`<small class="mut rnote">No photo of this item yet${itemPic(i)?': a generated picture of it.':': this is how the app draws it.'}</small>`);
const slots=o=>{const nj=o.occasion==='casual'&&!o.top;const rows=([...(nj?[]:[[o.suitDay?'Suit':'Blazer',o.top,'top']]),...(o.suitDay?[]:[['Pants',o.bot,'bot']]),['Shirt',o.shirt,'shirt'],...(nj&&!o.tie?[]:[['Tie',o.tie,'tie'],['Tie clip',o.clip,'clip']]),...(o.links||(o.shirt&&o.shirt.cuff==='french')?[['Cufflinks',o.links,'links']]:[]),['Watch',o.watch,'watch'],['Belt',o.belt,'belt'],['Socks',o.socks,'socks'],['Shoes',o.shoes,'shoes'],...(o.coat||(o.clim&&(o.clim.cold||o.clim.rain))?[[o.coat?TYPES[o.coat.type]:'Coat',o.coat,'coat']]:[])])
.map(([l,i,s])=>{const open=!!i&&openRow===s;
  return `<div class="ritem${open?' open instant':''}" id="ri-${s}"><div class="row"><span class="mut">${l}</span>${i?`<button class="rowtap" onclick="toggleRow('${s}')" aria-expanded="${open}" aria-controls="rp-${s}" aria-label="${l}: ${esc(desc(i)||nm(i))}. ${open?'Hide':'Show'} the photo"><span class="dot">${swatchSVG(i)}</span><span class="cap">${desc(i)}</span></button>${canPick(o)?`<button class="swap" onclick="openPicker('${s}')" aria-label="Change ${l.toLowerCase()}" title="Choose another">⇄</button>`:''}`:`<span class="mut none">${s==='clip'&&o.vest?'Not with the vest':o.frozen?'None':'Add one on the Add tab'}</span>${o.frozen&&canPick(o)?`<button class="swap" onclick="openPicker('${s}')" aria-label="Choose ${l.toLowerCase()}" title="Choose">⇄</button>`:''}`}</div>`+
    (i?`<div class="rpanel" id="rp-${s}"><div class="rpanel-in" onclick="toggleRow('${s}')">${open?rowPanel(i):''}</div></div>`:'')+`</div>`});
  rows.splice(nj?0:1,0,vestRow(o));return rows.join('')};
function toggleRow(s){const el=$('#ri-'+s),o=planFor()[key(sel)];if(!el||!o||!o[s])return;const opening=!el.classList.contains('open');
  document.querySelectorAll('.ritem.open').forEach(r=>{if(r!==el){r.classList.remove('open','instant');const b=r.querySelector('.rowtap');if(b)b.setAttribute('aria-expanded','false')}});
  if(opening){el.querySelector('.rpanel-in').innerHTML=rowPanel(o[s]);el.classList.remove('instant');void el.offsetHeight}
  el.classList.toggle('open',opening);openRow=opening?s:null;const b=el.querySelector('.rowtap');b.setAttribute('aria-expanded',opening);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/(Show|Hide) the photo/,opening?'Hide the photo':'Show the photo'));
  if(opening)reveal(el)}

/* ---- outfit history: freeze past days, swap pieces, record what was worn ---- */
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
let swapMsg='';
async function saveDay(rec,quiet){rec.updated=Date.now();dayRecs[rec.date]=rec;await txs('days','readwrite',s=>s.put(rec));cache={};if(!quiet&&window.scheduleSync)scheduleSync()}
/* remember what each day showed: past days become fixed, and today's record follows the screen until the day ends */
async function recordDays(p){
  const T=todayDate(),tk=key(T),mine=dayRecs;let changed=false;
  for(const [k,o] of Object.entries(p)){
    if(dayRecs!==mine)break;   // the history was replaced meanwhile (sync, restore): this plan is stale, record nothing more
    if(!SLOTS.some(s=>o[s])||o.frozen)continue;const d=keyDate(k);
    if(d<T&&!dayRecs[k]){await saveDay({date:k,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest,auto:true},true);changed=true}
    else if(k===tk){const r=dayRecs[k],ids=idsOf(o);if(!r||JSON.stringify(r.ids)!==JSON.stringify(ids)||!!r.vestOn!==!!o.vest){await saveDay({...(r||{date:k}),ids,suitDay:o.suitDay,vestOn:!!o.vest},true);changed=true}}
  }
  if(changed&&window.scheduleSync)scheduleSync();
}
async function swapSlot(slot){
  const k=key(sel),o=planFor()[k];if(!o||o.frozen)return;
  const cur=o[slot]&&o[slot].id,pool=items.filter(i=>(slot==='coat'?i.type==='overcoat'||i.type==='raincoat':i.type===SLOT_TYPE(slot,o.suitDay))&&inRotation(i));
  if(pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to swap.`;renderToday();return}
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest};
  const skip={...(rec.skip||{})};skip[slot]=[...new Set([...(skip[slot]||[]),cur].filter(Boolean))];
  if(pool.every(i=>skip[slot].includes(i.id)))skip[slot]=[cur];       // tried them all: start the cycle again
  // keep the rest of the outfit; pieces that must follow the swapped one are re-picked
  const follow=FOLLOW[slot]||[];
  const force={};for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  rec.skip=skip;rec.force=force;swapMsg=learnFrom(slot,o,o[slot],null,false);await saveDay(rec);renderToday();
}
const FOLLOW={top:['bot','shirt','tie','shoes','belt','socks','watch','clip'],shoes:['belt','socks']};
/* ---- learning from changes (the votes are read by the planner, see planner.js) ----
   A piece swapped away votes against its pairing with the pieces that stayed (a shirt with the jacket and the tie, a tie
   with the jacket and the shirt, trousers or shoes with the jacket); a piece chosen by hand votes for its pairings. Pieces
   with no partner (a jacket, a belt, socks) get a vote of their own. Kept in the settings, so it syncs. */
const LEARN_PARTNERS={shirt:['top','tie'],tie:['top','shirt'],bot:['top'],shoes:['top']};
function learnVote(kind,k,d){const L=settings.learn={p:{...(settings.learn&&settings.learn.p)},i:{...(settings.learn&&settings.learn.i)}},m=L[kind];
  const v=Math.max(-LEARN_CAP,Math.min(LEARN_CAP,(m[k]||0)+d));if(v)m[k]=v;else delete m[k]}
function learnFrom(slot,o,oldIt,newIt,picked){
  const partners=(LEARN_PARTNERS[slot]||[]).map(s=>o[s]).filter(p=>p&&(!oldIt||p.id!==oldIt.id)&&(!newIt||p.id!==newIt.id));let down=false,up=false;
  if(oldIt&&(!newIt||oldIt.id!==newIt.id)){if(partners.length){for(const p of partners)learnVote('p',pairKey(oldIt,p),-1);down=true}else if(!picked){learnVote('i',oldIt.id,-1);down=true}}
  if(picked&&newIt){if(partners.length)for(const p of partners)learnVote('p',pairKey(newIt,p),1);else learnVote('i',newIt.id,1);up=true}
  if(!down&&!up)return '';
  settings.updated=Date.now();metaPut('settings',settings);cache={};
  return up?'Noted: the planner will reach for this choice more often.':'Noted: the planner will suggest that pairing less often.'}
/* ---- choosing a piece by hand: a sheet with every item for the slot, best match for the rest of the outfit first ---- */
let picker=null,pastEdit=null;
const slotPool=(slot,o)=>(slot==='coat'?items.filter(i=>i.type==='overcoat'||i.type==='raincoat'):slot==='top'&&o.frozen?items.filter(i=>i.type==='suit'||i.type==='blazer'):items.filter(i=>i.type===SLOT_TYPE(slot,o.suitDay))).filter(i=>o.frozen||inRotation(i));
/* how well a candidate suits the rest of the day's outfit (higher is better), by the planner's own rules */
function fitOf(slot,o,c){
  const day={formal:!!o.formal,clim:o.clim||dayClimate(sel),hasLinks:items.some(i=>i.type==='cufflinks')},suit=slot==='top'?c.type==='suit':o.suitDay,top=slot==='top'?c:o.top,bot=suit?top:slot==='bot'?c:o.bot,legs=suit?top:bot;
  switch(slot){
    case 'top':case 'bot':case 'shirt':case 'tie':return clothesScore(top,bot,slot==='shirt'?c:o.shirt,slot==='tie'?c:o.tie,suit,day)+(slot==='top'?seasonFit(c,day.clim.season)*2+(day.formal?formalTop(c)*2:0):0);
    case 'shoes':return legs?shoeScore(top,legs,c)+shoeFormality(c,suit):0;
    case 'belt':{const f=o.shoes?beltFit(o.shoes,c):0;return f===null?-60:f}
    case 'socks':return sockScore(legs,o.shoes,c);
    case 'watch':return watchFit(c,o.shoes,o.belt);
    case 'clip':case 'links':return o.watch?(metalOf(c)===metalOf(o.watch)?6:-4):0}
  return 0}
const fitTag=gap=>gap<=.5?['best','Best match']:gap<=QWIN?['good','Good match']:gap<=18?['ok','Works']:['weak','Weak match'];
const pickPic=i=>i.photo?`<img src="${i.photo}" alt="">`:itemPic(i)?`<img src="${itemPic(i).img}" alt="">`:itemThumb(i,true);
function openPicker(slot){const o=planFor()[key(sel)];if(!o||!canPick(o))return;const pool=slotPool(slot,o),cur=o[slot]&&o[slot].id,label=slotLabel(slot,o).toLowerCase();
  if(!o.frozen&&pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to choose from.`;renderToday();return}
  const scored=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1)),best=scored.length?scored[0][0]:0;
  const card=([f,i])=>{const [cls,txt]=fitTag(best-f),on=i.id===cur;
    return `<button class="pick-it${on?' cur':''}" onclick="pickItem('${slot}','${i.id}')" aria-label="${esc(desc(i)||nm(i))}: ${on?'wearing, ':''}${txt.toLowerCase()}"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span><span class="pick-nm cap">${desc(i)||nm(i)}</span><small class="fit ${cls}">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}${txt}</small></button>`};
  const none=o.frozen&&slot!=='top'&&cur?`<button type="button" onclick="pickItem('${slot}','')">None: I didn't wear one</button>`:'';
  $('#pick-sheet').innerHTML=`<div class="pick-head"><b id="pick-title">${o.frozen?`What ${label} did you wear?`:`Choose ${aAn(label)}`}</b><button class="pick-x" onclick="closePicker()" aria-label="Close">×</button></div>
    <p class="mut"><small>${o.frozen?'Pick what you really wore on '+shortDate(sel)+'.':`Every ${label} you own, the best match for the rest of the outfit first.`}</small></p>
    ${!o.frozen||none?`<div class="btns">${o.frozen?none:`<button type="button" id="pick-next" onclick="pickNext()">Suggest another ↻</button>`}</div>`:''}
    <div class="pick-grid">${scored.map(card).join('')}</div>`;
  picker={slot};$('#pick-sheet').classList.add('on');$('#pick-backdrop').classList.add('on');$('#pick-sheet').scrollTop=0}
function closePicker(){picker=null;const s=$('#pick-sheet'),b=$('#pick-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on')}
function pickNext(){const s=picker&&picker.slot;closePicker();if(s)swapSlot(s)}
async function pickItem(slot,id){const k=key(sel),o=planFor()[k];if(!o)return;closePicker();
  const it=id?items.find(i=>i.id===id)||null:null;
  if(o.frozen)return correctPast(slot,it);
  if(!it||(o[slot]&&o[slot].id===id))return;
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=FOLLOW[slot]||[],force={};
  for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  force[slot]=id;const skip={...(rec.skip||{})};delete skip[slot];rec.force=force;rec.skip=skip;
  swapMsg=learnFrom(slot,o,o[slot],it,true);await saveDay(rec);renderToday()}
/* ---- correcting a past day: what was really worn replaces what was planned, so rest and "last worn" stay true ---- */
function togglePastEdit(){const k=key(sel);pastEdit=pastEdit===k?null:k;if(pastEdit)listOpen=true;swapMsg='';renderToday()}
async function correctPast(slot,it){const k=key(sel),r=dayRecs[k],o=planFor()[k];if(!r||!r.ids||!o||pastEdit!==k)return;
  const ids={...r.ids};let suitDay=!!r.suitDay;
  if(slot==='top'){if(!it)return;ids.top=it.id;if(it.type==='suit'){suitDay=true;ids.bot=it.id}else{if(suitDay||ids.bot===r.ids.top)ids.bot=null;suitDay=false}}
  else ids[slot]=it?it.id:null;
  const rec={...r,ids,suitDay,worn:true,edited:true};delete rec.auto;
  if(!suitDay||!hasVest(items.find(i=>i.id===ids.top)))rec.vestOn=false;
  swapMsg=it?learnFrom(slot,slot==='top'?{...o,top:null}:o,null,it,true)&&'Corrected. The planner counts what you really wore.':'Corrected.';
  await saveDay(rec);renderToday()}
const setFormal=(v,k)=>setOccasion(v?'formal':null,k);
/* give a day an occasion (or none): its swaps are dropped, since the outfit is chosen afresh for the occasion */
async function setOccasion(occ,k){k=k||key(sel);const r={...(dayRecs[k]||{date:k})};delete r.force;delete r.skip;delete r.vest;delete r.formal;delete r.occasion;if(occ==='formal')r.formal=true;else if(occ)r.occasion=occ;if(k===key(sel))swapMsg='';await saveDay(r);if(settingsOpen()){todayStale=true;renderFormalUI()}else renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.force;delete n.skip;delete n.worn;delete n.vest;swapMsg='';await saveDay(n);renderToday()}
async function setWorn(v){const k=key(sel),o=planFor()[k];if(!o)return;const r=dayRecs[k]||{date:k};await saveDay({...r,ids:r.ids&&o.frozen?r.ids:idsOf(o),suitDay:o.suitDay,vestOn:o.frozen?!!r.vestOn:!!o.vest,worn:v});renderToday()}
/* clear what swaps and vest choices pinned on days after today, so the planner picks those days again; formal days stay */
async function replanFuture(){const T=todayDate();let n=0;
  for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<=T||r.worn===true)continue;
    if(!(r.force||r.skip||r.ids||typeof r.vest==='boolean'||r.vestOn!==undefined||r.auto))continue;
    const keep={date:r.date};if(r.formal)keep.formal=true;if(r.occasion)keep.occasion=r.occasion;await saveDay(keep,true);n++}
  cache={};swapMsg='';if(window.scheduleSync)scheduleSync();return n}
/* the planning rules changed since this wardrobe was last planned: re-plan the future once */
async function checkPlanRules(){if((settings.planRules||0)>=PLAN_RULES)return;const n=await replanFuture();
  settings.planRules=PLAN_RULES;await saveUserSettings();if(n)setTimeout(()=>toast(`The planner was updated: upcoming days were planned again (${n} day${n===1?'':'s'} reset).`,4500),400)}
async function replanButton(){const T=todayDate();
  const n=Object.values(dayRecs).filter(r=>keyDate(r.date)>T&&r.worn!==true&&(r.force||r.skip||r.ids||typeof r.vest==='boolean')).length;
  if(!n){renderReplanUI('Nothing to reset: every upcoming day follows the planner.');return}
  if(!confirm(`Undo the swaps on ${n} upcoming day${n===1?'':'s'} and let the planner choose again? Formal days, today and past days stay as they are.`))return;
  const m=await replanFuture();renderReplanUI(`${m} day${m===1?'':'s'} planned again.`);todayStale=true}
function renderReplanUI(msg){const el=$('#replan-status');if(!el)return;const T=todayDate();
  const n=Object.values(dayRecs).filter(r=>keyDate(r.date)>T&&r.worn!==true&&(r.force||r.skip||r.ids||typeof r.vest==='boolean')).length;
  el.textContent=msg||(n?`${n} upcoming day${n===1?' keeps':'s keep'} pieces from a swap.`:'Every upcoming day follows the planner.')}
async function setVest(v){const k=key(sel),o=planFor()[k];if(!o)return;
  if(o.frozen){const r0=dayRecs[k];if(pastEdit!==k||!r0)return;await saveDay({...r0,vestOn:!!v,worn:true,edited:true});renderToday();return}
 const r={...(dayRecs[k]||{date:k})};r.vest=v;swapMsg='';await saveDay(r);renderToday()}
function dayActions(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),past=d<T,isToday=+d===+T;
  let h='';
  // whether it was worn is marked on the picture (wornMarks)
  if(o.occasion)h+=`<span class="ftag" title="Set in Settings, Occasions" aria-label="${o.occasion==='formal'?'Formal day':'Occasion: '+occLabel(o.occasion)}">${o.occasion==='casual'?'No jacket':occLabel(o.occasion)}${o.occasion==='formal'?'<span class="fx"> day</span>':''}</span>`;
  if(past&&o.frozen)h+=`<button class="pastedit${pastEdit===key(sel)?' on':''}" onclick="togglePastEdit()" aria-pressed="${pastEdit===key(sel)}">${pastEdit===key(sel)?'Done':'Correct this day'}</button>`;
  if(!o.frozen&&(o.overrides||o.vestOverride))h+=`<button class="reset" aria-label="Reset changes" title="Undo your changes to this day" onclick="resetDay()">↺</button>`;
  return (h?`<div class="dayact">${h}</div>`:'')+(past&&o.frozen&&pastEdit===key(sel)?'<p class="mut"><small>Tap ⇄ beside a piece to set what you really wore. The planner then counts that, not what was planned.</small></p>':past&&o.frozen&&o.worn!==true?'<p class="mut"><small>Past day: kept as it was planned.</small></p>':'')+(swapMsg?`<p class="mut"><small>${swapMsg}</small></p>`:'');
}

/* outfit score card with an expandable breakdown */
let scoreOpen=false;
function scoreCard(o){
  const r=rateOutfit(o),tone=r.score>=80?'good':r.score>=65?'ok':'low';
  // unfolds like the pieces list and the month plan; each check slides in and its bar fills to the points it scored
  return `<section class="mbox score ${tone}${scoreOpen?' open instant':''}" id="sbox"><button class="month-link" onclick="toggleScore()" aria-expanded="${scoreOpen}" aria-controls="spanel" aria-label="Outfit score ${r.score}, ${r.label}. ${scoreOpen?'Fold away':'Show why'}">
    <span class="num" aria-hidden="true">${r.score}</span><span class="lbl" aria-hidden="true"><b>${r.label}</b><small>Outfit score · ${scoreOpen?'tap to fold away':'tap for why'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="spanel"><div class="mpanel-in" onclick="toggleScore()"><ul>${r.checks.map((c,n)=>`<li class="${c.pts===c.max?'ok':'miss'}" style="--i:${n}"><span>${c.pts===c.max?'✓':'•'} ${c.label}</span><span class="pts">${c.pts}/${c.max}</span><span class="sbar" aria-hidden="true"><i style="--p:${c.max?Math.max(0,c.pts)/c.max:1}"></i></span>${c.why?`<small>${c.why}</small>`:''}</li>`).join('')}</ul></div></div></section>`;
}
function toggleScore(){const box=$('#sbox');if(!box)return;scoreOpen=!scoreOpen;box.classList.remove('instant');void box.offsetHeight;
  box.classList.toggle('open',scoreOpen);const b=box.querySelector('.month-link');b.setAttribute('aria-expanded',scoreOpen);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show why/,scoreOpen?'Fold away':'Show why'));
  const sm=box.querySelector('.lbl small');if(sm)sm.textContent='Outfit score · '+(scoreOpen?'tap to fold away':'tap for why');
  if(scoreOpen)reveal(box);else{revealRun++;keepInView(box)}}
/* ---- month view (wear plan): a calendar of fabric stacks, from the design concept ---- */
/* stacked bands for one outfit: jacket, trousers on blazer days, shirt, tie (drawn from the tagged fabrics) */
let stkN=0;
function stackSVG(o,cls=''){
  const P='st'+(stkN++)+'-',parts=[[o.top,'top',22],...(!o.suitDay&&o.bot?[[o.bot,'bot',9]]:[]),[o.shirt,'shirt',9],[o.tie,'tie',9]].filter(x=>x[0]);
  const H=parts.reduce((h,x)=>h+x[2],0)+(parts.length-1)*2;let y=0;
  const body=parts.map(([i,role,h],k)=>{const id=P+k,r=`<rect y="${y}" width="40" height="${h}" rx="2.5" fill="url(#${id})"/><rect y="${y}" width="40" height="${h}" rx="2.5" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".6"/>`;y+=h+2;return `<defs>${fabricDef(id,i,role)}</defs>${r}`}).join('');
  return `<svg class="stack ${cls}" viewBox="0 0 40 ${H}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
const planOn=d=>planMonth(d.getFullYear(),d.getMonth())[key(d)];
const nextWorkday=d=>{const x=new Date(d);let g=0;do x.setDate(x.getDate()+1);while(!isWorkday(x)&&++g<7);return x};
const shortTop=o=>{const t=o.top;if(!t)return o.bot?`No jacket: ${colName(primaryCol(o.bot))} trousers`:'No jacket';const p=t.pattern&&t.pattern!=='solid'&&t.pattern!=='other'?' '+patLabel(t.pattern):'',n=colName(primaryCol(t))+p;
  const s=n.charAt(0).toUpperCase()+n.slice(1);return o.suitDay?s:`${s} blazer${o.bot?' + '+colName(primaryCol(o.bot))+' trousers':''}`};
const tieWord=p=>({'polka-dot':'dot',stripe:'stripe',paisley:'paisley',check:'check',foulard:'foulard',knit:'knit'})[p]||'';
const shortRest=o=>[o.shirt&&colName(primaryCol(o.shirt))+' shirt',o.tie&&[colName(primaryCol(o.tie)),tieWord(o.tie.pattern),'tie'].filter(Boolean).join(' ')].filter(Boolean).join(' · ').replace(/^./,c=>c.toUpperCase());
/* the month plan unfolds in place from the box on Today (no separate page) */
let monthOpen=false,monthPanel=null;
const monthPlan=planMonth;
function monthGridHtml(){
  const {y,m}=monthPanel,p=monthPlan(y,m),f=new Date(y,m,1),T=todayDate(),cells=[];let n=0;
  for(let k=0;k<f.getDay();k++)cells.push('<span class="mc blank"></span>');
  for(const d=new Date(f);d.getMonth()===m;d.setDate(d.getDate()+1)){const k=key(d),o=p[k],wd=isWorkday(d),off=offName(d),work=wd&&hasOutfit(o),isT=+d===+T,past=d<T;
    const label=`${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}: ${work?`${shortTop(o)}, ${shortRest(o)}`:wd?'no outfit recorded':off?'day off: '+off:'day off'}`;
    cells.push(`<button class="mc ${!wd?'rest':past?'worn':'planned'}${off&&!wd?' hol':''}${isT?' today':''}${k===key(sel)?' sel':''}" style="--i:${n++}" aria-label="${esc(label)}" onclick="openDay(${d.getTime()})"><span class="dn">${d.getDate()}</span>${work?stackSVG(o):wd?'<span class="stack none"></span>':'<span class="stack rest"></span>'}</button>`)}
  return `<div class="mhead"><h3>${f.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><div class="mbtns"><button onclick="monthStep(-1)" aria-label="Previous month">‹</button><button onclick="monthStep(1)" aria-label="Next month">›</button></div></div>
    <div class="mgrid mdow" aria-hidden="true">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="mgrid">${cells.join('')}</div>
    <div class="mfoot"><div class="mlegend"><span><i class="lg worn"></i>Worn</span><span><i class="lg today"></i>Today</span><span><i class="lg planned"></i>Planned</span><span><i class="lg rest"></i>Rest</span></div><button class="foldbtn" onclick="toggleMonth()" aria-label="Fold away the month" title="Fold away"><span aria-hidden="true">›</span></button></div>`;
}
/* after a box unfolds: scroll down just far enough to show what opened, but never past the point where the tapped box
   (top: the tapped element, e.g. the tile row for a tile's photo) reaches the top of the screen. Follows the box while it
   grows, so the page moves with the unfolding; a touch or wheel by the user stops it. */
let revealRun=0;
function reveal(el,top){top=top||el;const run=++revealRun,t0=performance.now(),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const probe=document.createElement('div');probe.style.cssText='position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden';document.body.appendChild(probe);
  const sat=parseFloat(getComputedStyle(probe).paddingTop)||0;probe.remove();
  const stop=()=>{revealRun++;off()},off=()=>{removeEventListener('touchstart',stop);removeEventListener('wheel',stop)};
  addEventListener('touchstart',stop,{passive:true,once:true});addEventListener('wheel',stop,{passive:true,once:true});
  const want=()=>{const nav=document.querySelector('body>nav'),bottom=(nav?nav.getBoundingClientRect().top:innerHeight)-12,
      need=el.getBoundingClientRect().bottom-bottom,cap=top.getBoundingClientRect().top-(sat+8);return Math.max(0,Math.min(need,cap))};
  const step=now=>{if(run!==revealRun)return;const d=want(),done=now-t0>(reduce?0:700);
    if(reduce||done){if(d>.5)scrollBy(0,d);off();return}
    if(d>.5)scrollBy(0,Math.max(1,d*.2));requestAnimationFrame(step)};
  requestAnimationFrame(step)}
function toggleMonth(){const box=$('#mbox');if(!box)return;monthOpen=!monthOpen;
  if(monthOpen){monthPanel={y:sel.getFullYear(),m:sel.getMonth()};$('#mpanel-in').innerHTML=monthGridHtml();box.classList.remove('instant');void box.offsetHeight}
  box.classList.toggle('open',monthOpen);$('#mbox .month-link').setAttribute('aria-expanded',monthOpen);
  const sm=$('#mbox .mltxt small');if(sm)sm.textContent=sm.textContent.replace(/tap to .*/,monthOpen?'tap to fold away':'tap to see the month');
  if(monthOpen)reveal(box);else{revealRun++;keepInView(box)}}
function monthStep(n){let {y,m}=monthPanel;m+=n;if(m>11){m=0;y++}if(m<0){m=11;y--}monthPanel={y,m};const el=$('#mpanel-in');if(el){el.innerHTML=monthGridHtml();$('#mbox').classList.add('instant')}}
function openDay(t){sel=new Date(t);view={y:sel.getFullYear(),m:sel.getMonth()};monthOpen=false;renderToday();scrollTo({top:0,behavior:'smooth'})}
/* the box on Today: the next few workdays as small stacks; tap it and the month unfolds below */
function monthLink(){
  const days=[];for(let d=new Date(sel),g=0;days.length<5&&g<14;g++,d.setDate(d.getDate()+1))if(isWorkday(d)){const o=planOn(d);if(hasOutfit(o))days.push([new Date(d),o])}
  const f=new Date(view.y,view.m,1),n=Object.keys(planFor()).filter(k=>{const d=keyDate(k);return d.getMonth()===view.m&&d.getFullYear()===view.y}).length;
  if(monthOpen&&!monthPanel)monthPanel={y:view.y,m:view.m};
  return `<section class="mbox${monthOpen?' open instant':''}" id="mbox"><button class="month-link" onclick="toggleMonth()" aria-expanded="${monthOpen}" aria-controls="mpanel"><span class="mlstrip">${days.map(([d,o])=>`<span class="mli"><small>${d.toLocaleDateString(undefined,{weekday:'narrow'})}</small>${stackSVG(o)}</span>`).join('')}</span>
    <span class="mltxt"><b>${f.toLocaleDateString(undefined,{month:'long'})} wear plan</b><small>${n} outfit${n===1?'':'s'} · ${monthOpen?'tap to fold away':'tap to see the month'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="mpanel"><div class="mpanel-in" id="mpanel-in">${monthOpen?monthGridHtml():''}</div></div></section>`;
}

/* ---- Today figure: torso in the day's fabrics, tap targets, selected-piece card, below-the-waist tiles ---- */
/* a tile under the figure unfolds the item's photo below the tiles, like the pieces list; tap it again (or the photo) to fold it */
let belowOpen=null;
const slotLabel=(s,o)=>({top:o.suitDay?'Suit':'Blazer',bot:'Trousers',shirt:'Shirt',tie:'Tie',clip:'Tie clip',vest:'Vest',watch:'Watch',belt:'Belt',shoes:'Shoes',socks:'Socks',coat:o.coat?TYPES[o.coat.type]:'Coat',links:'Cufflinks'})[s]||s;
const belowBox=(o,below)=>{const i=below.some(([s])=>s===belowOpen)&&o[belowOpen];if(!i)belowOpen=null;
  return `<div class="ritem bbox${i?' open instant':''}" id="bbox"><div class="rpanel" id="bpanel"><div class="rpanel-in" onclick="pickPiece(belowOpen)">${i?rowPanel(i):''}</div></div></div>`};
/* did you wear it: ✗ and ✓ over the picture's bottom corners (today and past days); tapping the chosen one again clears it.
   Between them, a small pill says when this look was last worn (nothing when it never was). */
function wornMarks(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),can=+d<=+T,lw=lastWorn(o);
  const pill=lw?`<small class="lastworn">Last worn ${lw.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</small>`:'';
  if(!can)return pill?`<div class="wornbar">${pill}</div>`:'';
  return `<div class="wornbar" role="group" aria-label="Did you wear this outfit?"><button class="wmark no${o.worn===false?' on':''}" aria-pressed="${o.worn===false}" onclick="setWorn(${o.worn===false?'undefined':'false'})" aria-label="Didn't wear" title="Didn't wear">✕</button>${pill}<button class="wmark yes${o.worn===true?' on':''}" aria-pressed="${o.worn===true}" onclick="setWorn(${o.worn===true?'undefined':'true'})" aria-label="Wore this" title="Wore this">✓</button></div>`}
function figureStage(o){
  const below=[...(o.suitDay?[]:[['bot',o.bot]]),['belt',o.belt],['shoes',o.shoes],['socks',o.socks],...(o.coat?[['coat',o.coat]]:[])].filter(([,i])=>i);
  const tiles=below.map(([s,i])=>{const bg=itemPic(i)&&(picBgs[itemKey(i)]||PIC_BG);return `<button class="tile${s==='coat'?' coat-tile':''}${bg?' has-pic':''}" data-type="${i.type}"${bg?` style="background:${bg}"`:''}${s==='coat'?` data-coat="${i.type}"`:''} onclick="pickPiece('${s}')" aria-expanded="${belowOpen===s}" aria-controls="bpanel" aria-label="${slotLabel(s,o)}: ${desc(i)}. ${belowOpen===s?'Hide':'Show'} the photo">${itemPicHtml(i,itemThumb(i))}<small>${slotLabel(s,o)}</small></button>`}).join('');
  const r=renderFor(o),photo=!!r;
  setTimeout(()=>fetchRemoteRender(o,key(sel)),0);   // missing here: fetch it; only here: share it
  schedulePrefetch();   // and the rest of the month's photos, nearest first
  // a photo replaces the illustration; the button is only there while a day has none (regenerating lives in Settings)
  const ctl=(!r||rendering?`<div class="render-ctl"><button class="btn render-btn" onclick="generateRender()"${rendering?' disabled':''}>${rendering?'Generating photo…':'Generate realistic photo'}</button></div>`:'')+`<p class="mut render-msg" id="render-msg">${renderMsg}</p>`;
  return (photo?`<div class="fig photo" id="mannequin-container"><img src="${r.img}" alt="Photo of ${esc(figureLabel(o))}">${wornMarks(o)}</div>`
    :`<div class="fig" id="mannequin-container">${figureSvg(o)}${wornMarks(o)}</div>`)+ctl+
    (tiles?`<div class="below" style="--n:${below.length}" aria-label="${o.coat?'Coat and below the waist':'Below the waist'}" role="group">${tiles}</div>`+belowBox(o,below):'');
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
const comboSig=o=>(o.vest?'vest|':'')+(!o.top&&o.bot?'nojacket/'+[o.bot.type,...LOOK_FIELDS.map(f=>o.bot[f]??'')].join('/')+'|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];if(!i)return '-';
  return s==='shirt'?'shirt/'+primaryCol(i)+(shirtPatterned(i)?'/'+i.pattern+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:''):''):[i.type,...LOOK_FIELDS.map(f=>i[f]??'')].join('/')+(i.details?'/'+i.details:'')+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:'')}).join('|');
const fnvMemo=new Map();   // the same looks are hashed over and over (every render, every history record): remember them
const fnv64=t=>{let v=fnvMemo.get(t);if(v)return v;let h=0xcbf29ce484222325n;for(const c of new TextEncoder().encode(t)){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}
  v=h.toString(16).padStart(16,'0');if(fnvMemo.size>4000)fnvMemo.clear();fnvMemo.set(t,v);return v};
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
    const cur=renders[ck];if(cur&&remoteKeys&&remoteKeys.has(ck))return;   // here and on the worker already: nothing to do
    let j=await get('key='+ck);
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
/* photos the worker keeps that this device lacks (a new install, or made on another device): download the ones the plan needs
   for the month on screen and the next, nearest the selected day first, so swiping between days shows them at once */
let prefetching=false,prefetchAgain=false,remoteKeys=null;
const planOf=planMonth;
async function prefetchRenders(){const W=workerBase();if(!W)return;if(prefetching){prefetchAgain=true;return}prefetching=true;
  try{
    if(!remoteKeys){const r=await fetch(W.url+'?list=1',{headers:{'x-app-token':W.tok},cache:'no-store'});const j=r.ok?await r.json().catch(()=>null):null;if(!j||!Array.isArray(j.keys)){remoteKeys=new Set();return}remoteKeys=new Set(j.keys)}   // no list: fetch per day as before
    do{prefetchAgain=false;const c=+sel,near=new Map();   // each combination ranked by its day closest to the one on screen
      for(const [y,m] of [[view.y,view.m],[view.m===11?view.y+1:view.y,(view.m+1)%12]])for(const [k,o] of Object.entries(planOf(y,m))){if(!hasOutfit(o))continue;
        const ck=comboKey(o);if(renders[ck]||!remoteKeys.has(ck)||renderTried.has(ck))continue;const d=Math.abs(+keyDate(k)-c),cur=near.get(ck);if(!cur||d<cur[0])near.set(ck,[d,ck,o])}
      const list=[...near.values()].sort((a,b)=>a[0]-b[0]);let i=0;
      const one=async()=>{while(i<list.length&&!prefetchAgain){const [,ck,o]=list[i++];if(renders[ck])continue;
        try{const r=await fetch(W.url+'?key='+ck,{headers:{'x-app-token':W.tok},cache:'no-store'});const j=r.ok?await r.json().catch(()=>null):null;
          if(!j||!j.img){remoteKeys.delete(ck);continue}
          await keepRender(ck,{sig:comboSig(o),img:await shrinkUrl(j.img,900),model:j.model||'',t:j.t||Date.now()},false);
          const s=planFor()[key(sel)];if(s&&comboKey(s)===ck&&!$('#today').hidden)renderToday()}catch(e){remoteKeys.delete(ck)}}};
      await Promise.all([one(),one(),one()]);
    }while(prefetchAgain)
  }catch(e){console.warn('photo prefetch failed',e)}finally{prefetching=false}}
let prefetchTimer=0;const schedulePrefetch=()=>{clearTimeout(prefetchTimer);prefetchTimer=setTimeout(prefetchRenders,250)};
async function loadRenders(){try{const all=await txs('meta','readonly',s=>s.getAll());renders={};for(const x of all||[])if(String(x.k).startsWith('render:'))renders[x.k.slice(7)]=x.v}catch(e){console.warn(e)}}
/* a metal as words for the photo prompt: 'other' (a dark grey metal) reads as gunmetal */
const metalWord=i=>({gold:'gold',other:'gunmetal'})[i&&i.metal]||'silver';
/* a striped or checked shirt shows in the photo (a plain or finely woven one counts by its colour alone) */
const shirtPatterned=i=>!!i&&[...STRIPE_PATS,...CHECK_PATS,'houndstooth'].includes(patBase(i.pattern));
function outfitText(o){
  const pt=(i,role)=>{const t=patternPrompt(i,role);return t?` (${t})`:''};   // the pattern measured and described (tagging.js)
  const parts=[o.top&&`a ${nm(o.top)}${pt(o.top,'top')}`,o.shirt&&(shirtPatterned(o.shirt)?`a ${colName(primaryCol(o.shirt))} ${patName(o.shirt.pattern)} dress shirt${pt(o.shirt,'shirt')}`:`a plain ${colName(primaryCol(o.shirt))} dress shirt`)+(o.top?'':`, tucked in, ${o.tie?'':'the collar open with no tie, '}no jacket`),!o.top&&o.bot&&`${nm(o.bot)}${pt(o.bot,'bot')} with a leather belt`,o.vest&&`a matching five-button waistcoat (vest) in the same fabric as the suit, buttoned, its V opening visible above the jacket button`,o.tie&&`a ${nm(o.tie)}${pt(o.tie,'tie')}`,o.clip&&`a ${metalWord(o.clip)} tie bar`,
    o.watch&&watchText(o.watch),o.links&&`${metalWord(o.links)} cufflinks`];
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
/* reference photos for an outfit photo, each labelled: the jacket and tie photos, and the watch's own photo or its product
   picture (no shirt photo: an outfit photo is shared by every shirt of that colour) */
function outfitRefs(o){const refs=[],labels=[];const add=(img,l)=>{if(img){refs.push(img);labels.push(l)}};
  const tex=(i,what)=>add(i&&i.texture,`a close-up of the ${what} fabric (match its exact colour and weave)`);   // a fabric close-up, when the item has one
  const top=o.suitDay?'suit':'blazer';add(o.top&&o.top.photo,'the '+top);tex(o.top,top);
  if(!o.top){add(o.bot&&o.bot.photo,'the trousers');tex(o.bot,'trouser')}tex(o.shirt,'shirt');add(o.tie&&o.tie.photo,'the tie');tex(o.tie,'tie');
  if(o.watch)add((itemPic(o.watch)||{}).img||o.watch.photo,'the wristwatch (copy it exactly: case shape, bezel, dial layout and subdials, numerals, hands, bracelet links)');
  return {refs,labels}}
async function renderCombo(o){
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');
  if(!w||!tok)throw new Error('Set the Worker URL and App Token in ⚙ Settings first.');
  const image=await figurePng(o);
  const {refs,labels}=await outfitRefsFull(o);
  const r=await fetch(new URL('render',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},body:JSON.stringify({image,refs,labels,outfit:outfitText(o),key:comboKey(o),sig:comboSig(o),...(o.top?{}:{nojacket:true})})});
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
    const get=id=>id&&items.find(i=>i.id===id)||null,x={suitDay:!!r.suitDay,top:get(r.ids.top),bot:get(r.ids.bot),shirt:get(r.ids.shirt),tie:get(r.ids.tie),clip:get(r.ids.clip),watch:get(r.ids.watch),vest:!!r.vestOn};
    if([x.top,x.shirt,x.tie].some(i=>i&&(i.added||0)>+d+864e5))continue;   // dated before a piece was added: a warm-up day of the planner, never worn
    if((x.top||x.shirt)&&comboKey(x)===ck)best=d}
  return best;
}
/* ---- item pictures: product photos of shoes, belts, socks, trousers and coats for the tiles under the figure.
   Generated once per look (OpenAI, through the worker), kept like outfit photos and shared between devices. ---- */
const ITEM_PIC_TYPES=['shoes','belt','socks','pants','overcoat','raincoat','watch'];
const aAn=w=>(/^[aeiou]/i.test(w)?'an ':'a ')+w;
function itemDesc(i){const c=colName(primaryCol(i)),lea=patLabel(i.leather||'calf'),pat=i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?patLabel(i.pattern)+' ':'';
  switch(i.type){
    case 'shoes':return `a pair of ${c} ${lea} leather cap-toe oxford dress shoes, side three-quarter view`;
    case 'belt':return `${aAn(c)} ${lea} leather dress belt, loosely coiled, with a polished ${i.metal==='gold'?'gold':i.metal==='other'?'gunmetal':'silver'} buckle`;
    case 'socks':{const t=sockToe(i);return `a single ${c} ${pat}fine-knit mid-calf dress sock in side profile, as if on an invisible leg: the cuff at the top, the leg straight down, the heel at the lower left and the foot pointing to the right, smooth fine gauge with a soft sheen${t?`, with a ${colName(t)} knitted toe cap over the toes (only the toe, the heel stays ${c})`:', the toe and heel the same colour as the rest'}`}
    case 'pants':return `a pair of ${c} ${pat}${primaryCol(i)==='khaki'?'cotton twill':'wool'} dress trousers, neatly folded`;
    case 'overcoat':return `${aAn(c)} wool overcoat on an invisible mannequin`;
    case 'raincoat':return `${aAn(c)} trench coat on an invisible mannequin`;
    case 'watch':return `${watchText(i)}, three-quarter view, standing upright on a display cushion, the bracelet closed`}
  return ''}
const itemKey=i=>'c'+fnv64('item|'+itemDesc(i));
const itemPic=i=>i&&ITEM_PIC_TYPES.includes(i.type)&&renders[itemKey(i)]||null;
/* the colour of a product photo's backdrop (the average of its outer edge), so a tile wider than the photo is filled to match;
   the picture's edges are feathered (CSS mask) so there is no visible seam */
const picBgs={},PIC_BG='rgb(220,215,210)';   // the generated photos' backdrops average about this; used until a real reading
/* WebKit (iOS Safari) can hand back blank pixels when an <img> is drawn right at onload, so read from a decoded copy and
   accept only a full-alpha, light result (the backdrops are light grey); anything else keeps PIC_BG */
async function readPicBg(src){try{const im=new Image();im.src=src;await im.decode();const N=16,c=document.createElement('canvas');c.width=c.height=N;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,N,N);const d=x.getImageData(0,0,N,N).data,s=[0,0,0,0];let n=0;
    for(let y=0;y<N;y++)for(let X=0;X<N;X++)if(y===0||X===0||y===N-1||X===N-1){const o=(y*N+X)*4;for(let j=0;j<4;j++)s[j]+=d[o+j];n++}
    const [r,g,b,a]=s.map(v=>Math.round(v/n));return a>=250&&r*.3+g*.59+b*.11>=150?`rgb(${r},${g},${b})`:null}catch{return null}}
/* product photos made on a pure white backdrop (the old sock prompt) glare next to the warm-grey ones: tone the white down to
   PIC_BG (bright pixels are multiplied by it, dark ones kept, so the item and its soft shadow stay). Returns a new data URL,
   or null when the photo's edge isn't near white */
async function greyBackdrop(src){try{const im=new Image();im.src=src;await im.decode();const W=im.naturalWidth,H=im.naturalHeight;if(!W||!H)return null;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
    const D=x.getImageData(0,0,W,H),d=D.data,lum=o=>d[o]*.3+d[o+1]*.59+d[o+2]*.11;let s=0,n=0;
    for(let X=0;X<W;X+=4){s+=lum(X*4)+lum(((H-1)*W+X)*4);n+=2}for(let Y=0;Y<H;Y+=4){s+=lum(Y*W*4)+lum((Y*W+W-1)*4);n+=2}
    if(s/n<240)return null;
    const bg=PIC_BG.match(/\d+/g).map(v=>+v/255);
    for(let o=0;o<d.length;o+=4){const l=lum(o),t=l<=150?0:l>=245?1:((l-150)/95)**2;for(let j=0;j<3;j++)d[o+j]=Math.round(d[o+j]*(1-t+t*bg[j]))}
    x.putImageData(D,0,0);return c.toDataURL('image/jpeg',.88)}catch{return null}}
const itemImg=async u=>{const s=await shrinkUrl(u,400);return await greyBackdrop(s)||s};
/* once per kept product photo: tone down a white backdrop saved before the prompt changed */
async function fixItemBackdrops(){let n=0;for(const [k,r] of Object.entries(renders))if(r&&r.sig==='item'&&!r.grey){const g=await greyBackdrop(r.img);
    await keepRender(k,{...r,...(g?{img:g}:{}),grey:1},false);if(g){n++;delete picBgs[k]}}return n}
function picBg(img,k){if(picBgs[k]!==undefined)return;picBgs[k]=null;
  readPicBg(img.src).then(c=>{if(!c)return;picBgs[k]=c;document.querySelectorAll(`img.item-pic[data-k="${k}"]`).forEach(i=>{const t=i.closest('.tile');if(t)t.style.background=c})})}
const itemPicHtml=(i,fallback)=>{const p=itemPic(i);if(p)return `<img class="item-pic" src="${p.img}" alt="" data-k="${itemKey(i)}" onload="picBg(this,'${itemKey(i)}')">`;if(i&&ITEM_PIC_TYPES.includes(i.type))setTimeout(()=>fetchItemPic(i),0);return fallback};
async function fetchItemPic(i){const W=workerBase(),k=itemKey(i);if(!W||renderTried.has(k)||renders[k])return;renderTried.add(k);
  try{const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});if(!r.ok)return;const j=await r.json();if(!j||!j.img)return;
    await keepRender(k,{sig:'item',img:await itemImg(j.img),model:j.model||'',t:j.t||Date.now(),grey:1},false);if(!$('#today').hidden)renderToday();else if(!$('#wardrobe').hidden&&!phEdit.crop)renderWardrobe()}catch(e){console.warn('item picture unavailable',e)}}
async function renderItemPic(i){
  const W=workerBase();if(!W)throw new Error('Set the Worker URL and App Token in ⚙ Settings first.');
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'item',item:itemDesc(i),key:itemKey(i),...(i.photo?{ref:i.photo}:{})})});   // the item's own photo, when there is one, is the model to copy
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
  await keepRender(itemKey(i),{sig:'item',img:await itemImg(j.image),model:j.model||'',t:Date.now(),grey:1},false);
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
  for(const [k,o] of Object.entries(p)){const d=keyDate(k);if(d.getMonth()!==view.m||d.getFullYear()!==view.y||!o.shirt)continue;
    const ck=comboKey(o);if(seen.has(ck))continue;seen.add(ck);if(!renders[ck]&&!queuedKeys().includes(ck))todo.push(o)}
  return todo;
}
const monthName=()=>new Date(view.y,view.m,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
function renderBatchUI(){const el=$('#batch-status'),btn=$('#batch-btn');if(!el||!btn)return;
  if(batch){el.textContent=batch.msg;btn.textContent='Stop';btn.onclick=()=>{batch.stop=true;batch.msg='Stopping after the current photo…';renderBatchUI()};return}
  const n=batchCombos().length;btn.textContent=n?`Generate ${n} photo${n===1?'':'s'} for ${monthName()}`:`All of ${monthName()} has photos`;btn.disabled=!n;btn.onclick=startBatch;
  const q=rqGet();if(q.keys.length&&!el.dataset.keep){el.textContent=q.msg||`Making ${q.keys.length} photo${q.keys.length===1?'':'s'} on your worker in the background.`;return}
  if(!el.dataset.keep)el.textContent=n?`Outfits in ${monthName()} that don’t have a photo yet. Each costs about 7¢ (OpenAI); outfits that share a look share a photo. They’re made on your worker, so you can close the app once they’re sent.`:''}
async function startBatch(){
  if(batch)return;let todo=batchCombos();if(!todo.length){renderBatchUI();return}
  if(!confirm(`Generate ${todo.length} realistic photo${todo.length===1?'':'s'} for ${monthName()}?\n\nAbout $${(todo.length*.07).toFixed(2)} at roughly 7¢ each. They’re sent to your worker, which makes them in the background: once they’re sent you can close the app.`))return;
  batch={done:0,fail:0,n:todo.length,stop:false,msg:'Starting…'};renderBatchUI();
  let noQueue=false;const queued=[];
  // a photo another device already made is fetched instead of generated; the rest are queued on the worker (or, on a
  // worker without the queue, generated here one by one with the app open)
  for(const o of todo){if(batch.stop)break;const ck=comboKey(o),i=batch.done+batch.fail+queued.length+1;
    batch.msg=noQueue?`Generating ${i} of ${batch.n}… keep the app open.`:`Sending ${i} of ${batch.n}…`;renderBatchUI();
    try{
      if(!renders[ck]){renderTried.delete(ck);await fetchRemoteRender(o,'')}
      if(renders[ck]){batch.done++;continue}
      if(!noQueue){const q=await queueCombo(o);if(q==='queued'){queued.push(ck);continue}if(q==='done'){batch.done++;continue}noQueue=true;
        batch.msg=`Generating ${i} of ${batch.n}… keep the app open (your worker has no background queue).`;renderBatchUI()}
      await renderCombo(o);batch.done++}
    catch(e){batch.fail++;batch.err=e.message;if(/Worker URL|worker doesn|OPENAI_API_KEY|forbidden/i.test(e.message)){batch.stop=true}}
  }
  const b=batch;batch=null;const el=$('#batch-status');
  if(queued.length){const q=rqGet();q.keys=[...new Set([...q.keys,...queued])];q.total=(q.total||0)+queued.length;q.failed=q.failed||[];
    q.msg=`Sent ${queued.length} photo${queued.length===1?'':'s'} to your worker. They’re being made in the background (about a minute each); you can close the app. They appear as they finish.`;rqSet(q);startQueueWatch()}
  else if(el){el.dataset.keep=1;el.textContent=`Done: ${b.done} photo${b.done===1?'':'s'} ready${b.fail?`, ${b.fail} failed (${b.err})`:''}${b.stop&&b.done+b.fail<b.n?'. Stopped early.':''}`;setTimeout(()=>{delete el.dataset.keep},4000)}
  if(queued.length&&b.fail&&el){el.dataset.keep=1;el.textContent=rqGet().msg+` ${b.fail} couldn’t be sent (${b.err}).`;setTimeout(()=>{delete el.dataset.keep},6000)}
  renderBatchUI();if(!$('#today').hidden)renderToday();
}
/* ---- background photos (worker queue): send one outfit's inputs; the worker makes the photo later ---- */
async function queueCombo(o){
  const W=workerBase();if(!W)throw new Error('Set the Worker URL and App Token in ⚙ Settings first.');
  const image=await figurePng(o),{refs,labels}=await outfitRefsFull(o),ck=comboKey(o);
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'queue',image,refs,labels,outfit:outfitText(o),key:ck,sig:comboSig(o),...(o.top?{}:{nojacket:true})})});
  const j=await r.json().catch(()=>({}));
  if(r.ok&&j.queued)return 'queued';
  if(r.ok&&j.exists){renderTried.delete(ck);await fetchRemoteRender(o,'');return renders[ck]?'done':'queued'}
  if(r.ok&&j.image){await keepRender(ck,{sig:comboSig(o),img:await shrinkUrl(j.image,900),model:j.model||'',t:Date.now()},false);return 'done'}   // an older worker made it right away
  if(r.status===501||r.status===404||r.status===405)return 'noqueue';
  throw new Error(j.error||`HTTP ${r.status}`)}
const RQ='render_queue';
const rqGet=()=>{try{const q=JSON.parse(localStorage.getItem(RQ)||'{}');return {keys:[],failed:[],...q}}catch{return {keys:[],failed:[]}}};
const rqSet=q=>{try{q.keys.length?localStorage.setItem(RQ,JSON.stringify(q)):localStorage.removeItem(RQ)}catch{}};
const queuedKeys=()=>rqGet().keys;
/* ask the worker how the queued photos are doing and bring the finished ones home */
let rqTimer=null,rqBusy=false;
async function checkQueue(){const q=rqGet(),W=workerBase();if(!q.keys.length||!W||rqBusy)return;rqBusy=true;
  try{const r=await fetch(W.url+'-queue',{headers:{'x-app-token':W.tok},cache:'no-store'});const st=await r.json().catch(()=>null);if(!r.ok||!st)return;
    const pend=new Set(st.pending||[]),fail=Object.fromEntries((st.failed||[]).map(f=>[f.key,f.error]));let got=0,shown=false;
    for(const k of [...q.keys]){
      if(pend.has(k))continue;
      if(fail[k]){q.failed.push(fail[k]);q.keys=q.keys.filter(x=>x!==k);continue}
      const g=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});const j=g.ok?await g.json().catch(()=>null):null;
      if(j&&j.img){await keepRender(k,{sig:j.sig||'',img:await shrinkUrl(j.img,900),model:j.model||'',t:j.t||Date.now()},false);got++;q.keys=q.keys.filter(x=>x!==k);
        const o=planFor()[key(sel)];if(o&&comboKey(o)===k)shown=true}
      else if(!g.ok&&g.status!==404)continue;
      else q.keys=q.keys.filter(x=>x!==k)}   // neither waiting, failed nor finished: lost (expired), stop waiting for it
    const done=(q.total||0)-q.keys.length-q.failed.length;
    q.msg=q.keys.length?`Making photos on your worker: ${done} of ${q.total} done. You can close the app; they appear as they finish.`
      :`All ${done} photo${done===1?'':'s'} ready${q.failed.length?`; ${q.failed.length} failed (${q.failed[q.failed.length-1]})`:''}.`;
    if(!q.keys.length){const el=$('#batch-status');if(el){el.dataset.keep=1;el.textContent=q.msg;setTimeout(()=>{delete el.dataset.keep;renderBatchUI()},8000)}stopQueueWatch()}
    rqSet(q);renderBatchUI();if(shown&&!$('#today').hidden)renderToday();
  }catch(e){console.warn('queue check failed',e)}finally{rqBusy=false}}
function startQueueWatch(){if(!rqTimer&&queuedKeys().length)rqTimer=setInterval(()=>{if(document.visibilityState==='visible')checkQueue()},45000)}
function stopQueueWatch(){clearInterval(rqTimer);rqTimer=null}
let dayShown=null;   // the calendar day the app last drew, and whether it was showing "today's" outfit then
function newDayCheck(){const T=todayDate(),tk=key(T);if(!dayShown){dayShown={k:tk,home:true};return}
  if(dayShown.k===tk)return;const home=dayShown.home;dayShown={k:tk,home:true};cache={};
  if(home){const h=homeDay();sel=new Date(h);view={y:h.getFullYear(),m:h.getMonth()};monthOpen=false}
  if(!$('#today').hidden)renderToday()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;if(queuedKeys().length){checkQueue();startQueueWatch()}
  newDayCheck();try{const c=JSON.parse(localStorage.getItem('wx')||'null');if(settings.location&&(!c||Date.now()-c.t>3*3600e3))loadWeather()}catch{}
  remoteKeys=null;schedulePrefetch()});   // photos made on another device meanwhile
function pickPiece(s){const o=planFor()[key(sel)],el=$('#bbox');if(!o||!el||!s||!o[s])return;const opening=belowOpen!==s;
  belowOpen=opening?s:null;
  document.querySelectorAll('.below .tile').forEach(t=>{const on=opening&&t.getAttribute('onclick')===`pickPiece('${s}')`;t.setAttribute('aria-expanded',on);
    t.setAttribute('aria-label',t.getAttribute('aria-label').replace(/(Show|Hide) the photo/,on?'Hide the photo':'Show the photo'))});
  const inn=el.querySelector('.rpanel-in');
  if(opening){const was=el.classList.contains('open');inn.innerHTML=rowPanel(o[s]);if(!was){el.classList.remove('instant');void el.offsetHeight}}
  else el.classList.remove('instant');
  el.classList.toggle('open',opening);
  if(opening)reveal(el,$('.below'))}
/* ---- back to today: the day to return to is today, or the next workday when today is off ---- */
const homeDay=()=>{const T=todayDate();return isWorkday(T)?T:nextWorkday(T)};
const todayBtn=()=>{const h=homeDay();if(key(sel)===key(h))return '';const isT=+h===+todayDate();
  return `<button class="gotoday" onclick="goToday()" aria-label="${isT?"Back to today's outfit":'Go to the next outfit'}">${isT?'↩ Today':'↩ Next outfit'}</button>`};
function goToday(){const h=homeDay();sel=new Date(h);view={y:h.getFullYear(),m:h.getMonth()};monthOpen=false;show('today');scrollTo({top:0,behavior:'smooth'})}
/* ---- the day's pieces: a folded box (a strip of fabric chips, like the month box) that unfolds into the full list ---- */
let listOpen=false;
function piecesBox(o){
  const pcs=[['top',o.top],['vest',o.vest?o.top:null],['bot',o.suitDay?null:o.bot],['shirt',o.shirt],['tie',o.tie],['clip',o.clip],['links',o.links],['watch',o.watch],['belt',o.belt],['socks',o.socks],['shoes',o.shoes],['coat',o.coat]].filter(([,i])=>i);
  const chips=pcs.map(([s,i])=>`<span class="pchip${s==='vest'?' vest':''}" title="${slotLabel(s,o)}: ${esc(s==='vest'?'matching vest':desc(i)||nm(i))}">${swatchSVG(i)}</span>`).join('');
  const sum=[o.top?`${colName(primaryCol(o.top))} ${o.suitDay?'suit':'blazer'}`:o.bot&&`${colName(primaryCol(o.bot))} trousers`,o.shirt&&`${colName(primaryCol(o.shirt))} shirt`,o.tie&&`${colName(primaryCol(o.tie))}${o.tie.pattern&&!['solid','other'].includes(o.tie.pattern)?' '+patLabel(o.tie.pattern):''} tie`].filter(Boolean).join(' · ');
  return `<section class="mbox ibox${listOpen?' open instant':''}" id="ibox"><button class="month-link" onclick="toggleList()" aria-expanded="${listOpen}" aria-controls="ipanel" aria-label="Outfit pieces: ${pcs.length}. ${listOpen?'Fold away':'Show the list'}">
    <span class="pstrip" aria-hidden="true" style="--pc:${pcs.length<=6?pcs.length:Math.ceil(pcs.length/2)}">${chips}</span><span class="mltxt"><b>${pcs.length} pieces</b><small class="cap">${sum||'tap to see the list'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="ipanel"><div class="mpanel-in" onclick="foldListTap(event)"><div class="list">${slots(o)}</div></div></div></section>`}
/* a tap inside the open pieces list that is not on a button, a link or a photo (e.g. on the names on the left) folds the list */
function foldListTap(e){if(!listOpen||e.target.closest('button,a,input,select,label,.rpanel'))return;toggleList()}
/* folding a box whose top is above the screen (folded from its bottom): bring the card back into view */
function keepInView(box){const r=box.getBoundingClientRect();if(r.top<8)scrollBy({top:r.top-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
function toggleList(){const box=$('#ibox');if(!box)return;listOpen=!listOpen;box.classList.remove('instant');void box.offsetHeight;
  box.classList.toggle('open',listOpen);const b=$('#ibox .month-link');b.setAttribute('aria-expanded',listOpen);b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show the list/,listOpen?'Fold away':'Show the list'));
  if(listOpen)reveal(box);else{revealRun++;keepInView(box)}}
function renderToday(){
  closeSettings();if(pastEdit&&pastEdit!==key(sel))pastEdit=null;if(picker)closePicker();dayShown={k:key(todayDate()),home:key(sel)===key(homeDay())};
  const p=planFor();
  const o=p[key(sel)]||{suitDay:true,top:null,bot:null,shirt:null,tie:null,shoes:null,belt:null,socks:null,watch:null,clip:null};
  const nav=`<div class="nav day"><button onclick="stepDay(-1)" aria-label="Previous day">‹</button><h2>${sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}<small class="wx">${settings.location?(wxChip(sel)||''):'<a href="#" onclick="openSettings(\'weather\');return false">Set your location for weather</a>'}${todayBtn()}</small></h2><button onclick="stepDay(1)" aria-label="Next day">›</button></div>`;
  // only the stage (the figure) slides on a swipe; the date bar and the item list stay put and just update
  let stage='',side='';
  if(!isWorkday(sel))stage=offName(sel)&&settings.workdays.includes(sel.getDay())?`<p class="mut empty">A day off: ${esc(offName(sel))}. You can change your days off in Settings.</p>`
    :`<p class="mut empty">${DAY_NAMES[sel.getDay()]} isn't a workday. You can change your workdays in Settings.</p>`;
  else if(!items.length)stage='<p class="mut empty">Your wardrobe is empty. Add photos on the Add tab to get an outfit.</p>';
  else{stage=figureStage(o);
    // the rest warning goes below the list so the list never shifts when it appears or disappears
    side=`${scoreCard(o)}${piecesBox(o)}${dayActions(o)}${(o.notes||[]).map(t=>`<p class="warn">${t}</p>`).join('')}${o.top&&o.top.rest<COOL?`<p class="warn">This ${o.suitDay?'suit':'blazer'} was worn ${o.top.rest} day${o.top.rest===1?'':'s'} ago. Add more ${o.suitDay?'suits':'blazers'} to get a ${COOL}-day rest.</p>`:''}`}
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

/* tapping an item opens its editor (and brings it into view) */
/* Opening an item in the Wardrobe: it takes the whole width of its row, starting where it is, so the tapped box keeps its
   place on screen; the items beside it slide down under it (a blank cell keeps the rows below unchanged). Closing (Close,
   Done, or tapping the photo or swatch) reverses it. Every box glides from its old place to its new one (FLIP). */
let editAt=null;   // {id,at,cols}: where the open item is placed in the list, and the grid's column count then
const WARD_EASE='cubic-bezier(.2,.8,.2,1)',WARD_MS=320;
function flipWardrobe(update,anchorId){
  const box=()=>[...document.querySelectorAll('#wardrobe .grid > .gi')],before=new Map(box().map(el=>[el.id,el.getBoundingClientRect()]));
  const anchor=before.get('gi-'+anchorId);update();
  const k=$('#gi-'+anchorId);if(anchor&&k){const d=k.getBoundingClientRect().top-anchor.top;if(Math.abs(d)>1)window.scrollBy(0,d)}   // the tapped box stays put
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate)return;
  if(k){k.style.position='relative';k.style.zIndex='2';setTimeout(()=>{k.style.position='';k.style.zIndex=''},WARD_MS+60)}   // the tapped box stays above the ones sliding past
  for(const el of box()){const a=before.get(el.id);if(!a)continue;const b=el.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;
    if(el.id==='gi-'+anchorId&&(b.width>a.width+1||b.height>a.height+1)){   // opening: grows out of its old box
      const ins=[Math.max(0,a.top-b.top),Math.max(0,b.right-a.right),Math.max(0,b.bottom-a.bottom),Math.max(0,a.left-b.left)].map(v=>v+'px').join(' ');
      el.animate([{clipPath:`inset(${ins} round 14px)`},{clipPath:'inset(0px 0px 0px 0px round 14px)'}],{duration:WARD_MS,easing:WARD_EASE});continue}
    if(Math.abs(dx)<1&&Math.abs(dy)<1)continue;
    el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:WARD_MS,easing:WARD_EASE})}}
function openItem(id){
  const els=[...document.querySelectorAll('#wardrobe .grid > .gi')],el=$('#gi-'+id);
  if(editing&&editing!==id){const top=el&&el.getBoundingClientRect().top;editing=null;editAt=null;renderWardrobe();   // another one is open: fold it first
    const n=$('#gi-'+id);if(n&&top!=null)window.scrollBy(0,n.getBoundingClientRect().top-top);return openItem(id)}
  const g=$('#wardrobe .grid'),cols=g?Math.max(1,getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length):1,idx=els.findIndex(e=>e.id==='gi-'+id);
  editAt=idx>=0?{id,at:idx-idx%cols,cols,flt}:null;
  flipWardrobe(()=>{editing=id;renderWardrobe()},id)}
function closeItem(){const id=editing;if(!id)return;flipWardrobe(()=>{editing=null;editAt=null;renderWardrobe()},id)}
/* swiping the Wardrobe moves between the type filters (All, Suit, Blazer, …) in chip order, skipping types with no items;
   only the grid slides. Not while an item is open (its editor has sliders and the photo crop), nor on the chips row itself. */
const wardTypes=()=>['all',...Object.keys(TYPES).filter(t=>items.some(i=>i.type===t))];
function stepType(n,from){
  const l=wardTypes();let k=l.indexOf(flt);if(k<0)k=0;const j=k+n;if(j<0||j>=l.length)return false;
  flt=l[j];renderWardrobe();const sl=$('#wslide');if(!sl)return true;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x)return true;
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';return true}
(()=>{const el=$('#wardrobe');let st=null;const slide=()=>$('#wslide');
  el.addEventListener('touchstart',e=>{const t=e.touches[0];
    st=e.touches.length>1||editing||t.clientX<24||t.clientX>innerWidth-24||e.target.closest('.chips,input,select,textarea,.cropwrap')?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}},{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;e.preventDefault();
    const l=wardTypes(),k=l.indexOf(flt),edge=(dx>0&&k<=0)||(dx<0&&k>=l.length-1);   // nothing further that way: resist
    st.dx=dx;const sl=slide();if(sl){const v=edge?dx/4:dx;sl.style.transition='none';sl.style.transform=`translateX(${v}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(v)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5,n=dx<0?1:-1,l=wardTypes(),k=l.indexOf(flt),j=(k<0?0:k)+n;
    if((Math.abs(dx)>70||(fast&&Math.abs(dx)>30))&&j>=0&&j<l.length){const w=sl.offsetWidth||innerWidth;
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepType(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}};
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(el.hidden||editing||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepType(1);if(e.key==='ArrowLeft')stepType(-1)});
})();
/* in the Wardrobe, shoes, belts and socks show their realistic product picture when there is one */
const WARD_PIC_TYPES=['shoes','belt','socks'];
const wardPic=i=>{if(!WARD_PIC_TYPES.includes(i.type))return null;const p=itemPic(i);if(p)return p.img;setTimeout(()=>fetchItemPic(i),0);return null};
function renderWardrobe(){
  closeSettings();if(editing!==phEdit.id)phEdit={id:null,undo:[],crop:null};   // undo lasts while the item stays open
  const cnt=t=>t==='all'?items.length:items.filter(i=>i.type===t).length;
  const chips=['all',...Object.keys(TYPES)].map(t=>`<button class="chip ${flt===t?'on':''}" onclick="flt='${t}';renderWardrobe()">${t==='all'?'All':TYPES[t]} ${cnt(t)}</button>`).join('');
  const list=items.filter(i=>flt==='all'||i.type===flt).sort((a,b)=>a.type.localeCompare(b.type)||b.added-a.added);
  // the open item moves to the start of its row; the rest of that row follows it and a blank cell fills the slot it left
  let gapAfter=null;if(editing&&editAt&&editAt.id===editing&&editAt.flt===flt){const k=list.findIndex(i=>i.id===editing);
    if(k>=0){const end=Math.min(editAt.at+editAt.cols,list.length),[it]=list.splice(k,1);list.splice(editAt.at,0,it);if(end-editAt.at===editAt.cols&&editAt.cols>1)gapAfter=list[end-1].id}}
  $('#wardrobe').innerHTML=`<h2>Wardrobe</h2>${shopCard()}<div class="chips">${chips}</div><div class="wslide" id="wslide">`+(list.length?`<div class="grid">${list.map(i=>`<div class="gi${i.paused?' paused':''}"${editing===i.id?' style="grid-column:1/-1"':''} id="gi-${i.id}">${editing===i.id?`${phEdit.crop&&phEdit.id===i.id?cropEditor(i):`<div class="giclose" onclick="closeItem()" role="button" aria-label="Close ${esc(TYPES[i.type]||'item')}">${i.photo?photoPair(i.photo,i,'tagsw-'+i.id):wardPic(i)?photoPair(wardPic(i),i,'tagsw-'+i.id):itemThumb(i)}</div>`}<b>${TYPES[i.type]||'Item'}</b><br><small class="cap">${desc(i)}</small>`
  :`<button class="giopen" onclick="openItem('${i.id}')" aria-label="Edit ${esc(TYPES[i.type]||'item')}: ${esc(desc(i))}">${wardPic(i)?`<img class="ph" src="${wardPic(i)}" alt="">`:i.photo?`<img class="ph" src="${i.photo}" alt="">`:itemThumb(i)}<b>${TYPES[i.type]||'Item'}</b><br><small class="cap">${desc(i)}</small>${i.paused?'<span class="pausetag">Out of rotation</span>':''}</button>`}<div class="btns"><button onclick="${editing===i.id?'closeItem()':`openItem('${i.id}')`}">${editing===i.id?'Close':'Edit'}</button><button onclick="rm('${i.id}')">Delete</button>${editing===i.id?`<button class="rotbtn${i.paused?' on':''}" onclick="togglePause('${i.id}')" aria-pressed="${!!i.paused}">${i.paused?'Put back in rotation':'Take out of rotation'}</button>`:''}</div>${editing===i.id&&i.paused?'<p class="mut rotnote"><small>Out of rotation: the planner won\'t pick it, and it isn\'t offered when you change a piece. Outfits you already wore keep it.</small></p>':''}${editing===i.id?editForm(i):''}</div>${gapAfter===i.id?'<div class="gi-gap" aria-hidden="true"></div>':''}`).join('')}</div>`:'<p class="mut">Nothing here yet. Add photos on the Add tab.</p>')+'</div>';
  const on=document.querySelector('#wardrobe .chip.on');if(on){const c=on.parentElement;c.scrollLeft=Math.max(0,on.offsetLeft-c.offsetLeft-(c.clientWidth-on.offsetWidth)/2)}
}

const S=(list,v,k,i)=>`<select onchange="setq(${i},'${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${x[1]}</option>`).join('')}</select>`;

function renderAdd(){
  closeSettings();
  const workerSet = !!localStorage.getItem('worker_url');
  if($('#note')) $('#note').textContent = !workerSet ? 'Worker URL not set! Tap ⚙ in the top right to configure your Cloudflare Worker.' : aiError || (aiModel?`Last photo tagged by ${/^claude/.test(aiModel)?'Claude':'Workers AI'} (${aiModel}).`:'Photos are tagged by AI through your Cloudflare Worker.');
  const ready=queue.filter(q=>!q.busy&&!q.err).length;if($('#save-all'))$('#save-all').innerHTML=ready>1?`<button class="btn pri" onclick="saveAll()">Save all ${ready} items</button>`:'';
  if($('#queue')) $('#queue').innerHTML=queue.map((q,i)=>q.busy?`<div class="card">${q.multiBusy?'Finding every item in the photo… (this can take up to a minute)':'Analyzing photo…'}</div>`:q.err?`<div class="card">That image couldn’t be read. <button onclick="queue.splice(${i},1);renderAdd()">Dismiss</button></div>`:
`<div class="card">${q.multi?`<p class="multi-h"><b>Item ${q.multi.n} of ${q.multi.of}</b> <span class="conf ${q.multi.confidence}">${q.multi.confidence} confidence</span></p>`:''}
<div class="rv">${q.photo?photoPair(q.photo,q,'tagsw-q'+i):itemThumb(q)}</div>${wbNote(q,i)}${texSlot(q,i)}${tagNotes(q,i)}
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
<label>${q.type==='socks'?'Toe cap':'Secondary Colour'} ${S([['none','None'], ...COLOR_OPTS(q.type,q.secondaryColor,true)],q.secondaryColor||'none','secondaryColor',i)}</label>
${q.type==='socks'?'':`<label>Tertiary Colour ${S([['none','None'], ...COLOR_OPTS(q.type,q.tertiaryColor,true)],q.tertiaryColor||'none','tertiaryColor',i)}</label>`}
${FABRIC.includes(q.type)?`<label>Pattern ${S((PATS_BY[q.type]||['solid']).map(c=>[c,patName(c)]),q.pattern,'pattern',i)}</label>`:''}${METAL_TYPES.includes(q.type)?`<label>${q.type==='belt'?'Buckle':'Metal'} ${S(Object.keys(METAL).map(c=>[c,c]),q.metal,'metal',i)}</label>`:''}
${q.type==='shirt'?`<label>Cuffs ${S(CUFFS,q.cuff||'button','cuff',i)}</label>`:''}${q.type==='suit'?`<label>Vest ${S(VESTS,q.vest==='no'?'no':'yes','vest',i)}</label>`:''}${SEASON_TYPES.includes(q.type)?`<label>Season ${S(SEASONS,q.season||'all','season',i)}</label>`:''}
${q.type==='shoes'||q.type==='belt'?`<label>Leather ${S(LEATHERS.map(c=>[c,patLabel(c)]),q.leather||'calf','leather',i)}</label>`:''}
${q.type==='watch'?`<label>Dial ${S(DIAL_OPTS(watchOpts(q).dial),watchOpts(q).dial,'dial',i)}</label><label>Band ${S(BANDS,watchOpts(q).band,'band',i)}</label><label>Bezel ${S(BEZELS,watchOpts(q).bezel,'bezel',i)}</label><label>Style ${S(WATCH_STYLES,watchOpts(q).style,'watchStyle',i)}</label>`:''}
<div class="btns"><button class="pri" onclick="save(${i})">Confirm</button><button onclick="queue.splice(${i},1);renderAdd()">${q.manual?'Cancel':'Skip'}</button></div>${q.manual?'':`<small>${aiLabel(q)}</small>`}</div>`).join('');
}

function show(t){
  closeSettings();
  for(const s of['today','wardrobe','add','stats']){const el=$('#'+s);if(el)el.hidden=s!==t;const btn=$('#n-'+s);if(btn)btn.classList.toggle('on',s===t)}
  const f={today:renderToday,wardrobe:renderWardrobe,add:renderAdd,stats:()=>renderStats()};if(f[t])f[t]();
}

db.then(()=>Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings')])).then(([r,d,st])=>{items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};applyCustom(settings.custom);checkPlanRules().then(()=>{if(!$('#today').hidden)renderToday()});show('today');window.appReady=true;loadWeather();refreshHolidays();loadRenders().then(()=>{if(Object.keys(renders).length&&!$('#today').hidden)renderToday();fixItemBackdrops().then(n=>{if(n&&!$('#today').hidden)renderToday()});recolourSpecSetts().then(n=>{if(n&&!$('#today').hidden)renderToday()});if(queuedKeys().length){checkQueue();startQueueWatch()}})}).catch(e=>{console.warn(e);items=[];show('today');window.appReady=true});

/* service worker: fresh files on every load, offline fallback (only over http/https) */
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(e=>console.warn('service worker not registered',e));
/* sync brought new data: refresh the in-memory outfit history too */
function onSyncedData(m){dayRecs=Object.fromEntries((m.days||[]).map(d=>[d.date,d]));if(m.settings){settings={...settings,...m.settings};applyCustom(settings.custom)}loadWeather()}

/* ---- settings: schedule, weather location, units ---- */
const unit=()=>settings.units||(/^en-(US|LR|MM)/.test(navigator.language||'')?'F':'C');
const temp=c=>Math.round(unit()==='F'?c*9/5+32:c);
const wxIcon=c=>c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌦️':c<=86?'🌨️':'⛈️';
function wxChip(d){const w=weather[key(d)];if(!w)return '';return `${wxIcon(w.code)} ${temp(w.tmax)}°/${temp(w.tmin)}°${(w.pop||0)>=30?` · ☂ ${w.pop}%`:''}`}
async function saveUserSettings(){settings.updated=Date.now();await metaPut('settings',settings);cache={};if(window.scheduleSync)scheduleSync()}
/* ---- Settings: days off. A country's public holidays (each can be unticked if you work that day) and your own days
   off (a single day or a range, e.g. a holiday trip). They are planned like weekends: no outfit, nothing counted as worn. ---- */
const COUNTRY_CODES='AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS YE YT ZA ZM ZW'.split(' ');
const countryName=cc=>{try{return new Intl.DisplayNames(['en'],{type:'region'}).of(cc)||cc}catch{return cc}};
let holidayMsg='';
/* public holidays of a country for about the next 13 months -> [{d:'YYYY-MM-DD', n:name}]. Nager.Date first (free, no key,
   most countries); the worker's /holidays (Google's public holiday calendars) for the ones it lacks, e.g. the Gulf states */
async function fetchHolidays(cc){
  const T=todayDate(),from=isoKey(new Date(T.getFullYear(),T.getMonth()-1,T.getDate())),to=isoKey(new Date(T.getFullYear()+1,T.getMonth()+1,T.getDate()));
  const tidy=l=>{const m={};for(const x of l)if(x.d>=from&&x.d<=to&&x.n)m[x.d]=m[x.d]&&!m[x.d].includes(x.n)?m[x.d]+', '+x.n:m[x.d]||x.n;return Object.entries(m).sort().map(([d,n])=>({d,n}))};
  try{const out=[];for(const y of new Set([+from.slice(0,4),+to.slice(0,4)])){const r=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`);if(r.status!==200)continue;
      for(const h of await r.json())if(h.global!==false&&(!h.types||h.types.includes('Public')))out.push({d:h.date,n:h.name||h.localName})}
    if(out.length)return tidy(out)}catch(e){/* unreachable or unknown country: try the worker */}
  const W=workerBase();if(!W)throw new Error(`No holiday list for ${countryName(cc)} without your worker: set the Worker URL and App Token above.`);
  let r;try{r=await fetch(new URL('holidays',W.url).href+'?country='+cc,{headers:{'x-app-token':W.tok},cache:'no-store'})}catch{throw new Error('Couldn’t reach your worker for the holiday list.')}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.holidaysError||(r.status===404||r.status===405?'Your worker doesn’t have holiday lists yet: it needs the latest worker.js.':j.error||`HTTP ${r.status}`));
  return tidy((j.holidays||[]).map(h=>({d:h.date,n:h.name})))}
async function setHolidayCountry(cc,quiet){
  if(!cc){settings.holidays=null;holidayMsg='';await saveUserSettings();todayStale=true;renderDaysOffUI();return}
  if(!quiet){holidayMsg=`Loading the public holidays of ${countryName(cc)}…`;renderDaysOffUI()}
  try{const list=await fetchHolidays(cc),old=settings.holidays&&settings.holidays.country===cc?settings.holidays.skip||[]:[];
    settings.holidays={country:cc,list,skip:old.filter(d=>list.some(x=>x.d===d)),fetched:Date.now()};
    holidayMsg=list.length?'':`No public holidays found for ${countryName(cc)}.`;await saveUserSettings();todayStale=true}
  catch(e){if(quiet)return;holidayMsg=e.message||'Couldn’t load the holiday list.'}
  renderDaysOffUI()}
/* the list goes stale (new year, tentative dates confirmed): fetched again once a month, keeping the days you unticked */
function refreshHolidays(){const h=settings.holidays;if(h&&h.country&&Date.now()-(h.fetched||0)>30*864e5)setHolidayCountry(h.country,true)}
async function toggleHoliday(d,on){const h=settings.holidays;if(!h)return;const skip=new Set(h.skip||[]);on?skip.delete(d):skip.add(d);
  settings.holidays={...h,skip:[...skip].sort()};await saveUserSettings();todayStale=true;renderDaysOffUI()}
const isoToDate=v=>{const [y,m,d]=String(v).split('-').map(Number);return new Date(y,m-1,d)};
async function addDayOff(){const f=($('#cfg-off-from')||{}).value,t=($('#cfg-off-to')||{}).value||f,n=(($('#cfg-off-name')||{}).value||'').trim();
  const say=m=>{holidayMsg=m;renderDaysOffUI()};if(!f)return say('Pick a date first.');
  const a=isoToDate(f),b=isoToDate(t);if(b<a)return say('The last day is before the first.');if((b-a)/864e5>92)return say('That is more than three months: add it in parts.');
  const cur=new Map((settings.daysOff||[]).map(x=>[x.d,x]));let k=0;for(const d=new Date(a);d<=b;d.setDate(d.getDate()+1)){cur.set(isoKey(d),{d:isoKey(d),n:n||'Day off'});k++}
  settings.daysOff=[...cur.values()].sort((x,y)=>x.d<y.d?-1:1);holidayMsg=`${k} day${k===1?'':'s'} off added.`;
  for(const id of ['#cfg-off-from','#cfg-off-to','#cfg-off-name'])if($(id))$(id).value='';
  await saveUserSettings();todayStale=true;renderDaysOffUI()}
function renderDaysOffUI(){const box=$('#cfg-country'),list=$('#holiday-list');if(!box||!list)return;
  const h=settings.holidays,cc=h&&h.country||'';
  if(box.options.length<2)box.innerHTML='<option value="">No public holidays</option>'+COUNTRY_CODES.map(c=>[countryName(c),c]).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,c])=>`<option value="${c}">${esc(n)}</option>`).join('');
  box.value=cc;
  const tk=isoKey(todayDate()),skip=new Set(h&&h.skip||[]),up=(h&&h.list||[]).filter(x=>x.d>=tk);
  list.innerHTML=!cc?'':up.length?up.map(x=>{const d=isoToDate(x.d),wk=!settings.workdays.includes(d.getDay());
    return `<label class="hrow${wk?' wk':''}"><input type="checkbox" ${skip.has(x.d)?'':'checked'} onchange="toggleHoliday('${x.d}',this.checked)"><span class="hd">${shortDate(d)}</span><span class="hn">${esc(x.n)}${wk?' <small class="mut">(not a workday anyway)</small>':''}</span></label>`}).join('')
    :'<small class="mut">No public holidays in the next year.</small>';
  const own=(settings.daysOff||[]).filter(x=>x.d>=tk),ol=$('#off-list');
  // consecutive days with one name are shown as one range
  const runs=[];for(const x of own){const r=runs[runs.length-1];if(r&&r.n===x.n&&(isoToDate(x.d)-isoToDate(r.to))/864e5<=1.5)r.to=x.d,r.ds.push(x.d);else runs.push({from:x.d,to:x.d,n:x.n,ds:[x.d]})}
  if(ol)ol.innerHTML=runs.map(r=>{const l=r.from===r.to?shortDate(isoToDate(r.from)):`${shortDate(isoToDate(r.from))} – ${shortDate(isoToDate(r.to))}`;
    return `<span class="fchip">${l}${r.n&&r.n!=='Day off'?' · '+esc(r.n):''}<button type="button" aria-label="Remove ${l}" onclick="removeDaysOff('${r.ds.join(',')}')">×</button></span>`}).join('');
  const m=$('#holiday-msg');if(m)m.textContent=holidayMsg||(cc&&up.length?`${up.filter(x=>!skip.has(x.d)).length} public holiday${up.length===1?'':'s'} of ${countryName(cc)} count as days off. Untick any you work.`:'');
  const f=$('#cfg-off-from');if(f)f.min=tk}
async function removeDaysOff(csv){const ds=new Set(csv.split(','));settings.daysOff=(settings.daysOff||[]).filter(x=>!ds.has(x.d));holidayMsg='';await saveUserSettings();todayStale=true;renderDaysOffUI()}
/* ---- Settings: formal days (any upcoming workday) and regenerating the shown day's photo ---- */
const shortDate=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function renderFormalUI(msg){const list=$('#formal-list'),inp=$('#cfg-formal-date');if(!list)return;
  const T=todayDate();if(inp){inp.min=isoDate(T);if(!inp.value)inp.value=isoDate(nextWorkday?nextWorkday(T):T)}
  const up=Object.values(dayRecs).filter(r=>occOf(r)&&keyDate(r.date)>=T).sort((a,b)=>keyDate(a.date)-keyDate(b.date));
  list.innerHTML=up.length?up.map(r=>{const l=shortDate(keyDate(r.date));return `<span class="fchip">${l} · ${occLabel(occOf(r))}<button type="button" aria-label="Make ${l} a regular day" onclick="setOccasion(null,'${r.date}')">×</button></span>`}).join(''):'<small class="mut">No occasions coming up.</small>';
  const pick=$('#cfg-occasion');if(pick&&!pick.options.length)pick.innerHTML=OCCASIONS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  if(msg!==undefined&&$('#formal-msg'))$('#formal-msg').textContent=msg}
async function addFormalDay(){const v=($('#cfg-formal-date')||{}).value;if(!v)return renderFormalUI('Pick a date first.');
  const [y,m,dd]=v.split('-').map(Number),d=new Date(y,m-1,dd),k=key(d),l=shortDate(d);
  if(d<todayDate())return renderFormalUI(`${l} has passed.`);
  const o=monthPlan(y,m-1)[k];if(!o)return renderFormalUI(`${l} is a day off, so there's no outfit to change.`);
  if(o.frozen)return renderFormalUI(`${l} is already locked in.`);
  const occ=($('#cfg-occasion')||{}).value||'formal',O=OCCASIONS.find(x=>x[0]===occ)||OCCASIONS[0],what=occ==='casual'?'a day without a jacket or tie':`${aAn(O[1].toLowerCase())} day`;
  if(o.occasion===occ)return renderFormalUI(`${l} is already ${what}.`);
  await setOccasion(occ,k);renderFormalUI(`${l} is now ${what}: ${O[2]}.`)}
function renderRegenUI(){const btn=$('#regen-btn'),st=$('#regen-status');if(!btn)return;const o=planFor()[key(sel)],l=shortDate(sel);
  const r=o&&renderFor(o);btn.disabled=!o||rendering;btn.textContent=rendering?'Generating photo…':o?`${r?'Regenerate':'Generate'} photo for ${l}`:`No outfit on ${l}`;
  if(st)st.textContent=o?(r?'Makes a new realistic photo of the day shown on Today (about 7¢); it replaces the current one for every day with this look.':'The day shown on Today has no photo yet (about 7¢).'):'Pick a workday on Today first.'}
function renderSettingsExtras(){
  renderBatchUI();renderItemPicUI();renderFormalUI();renderRegenUI();renderReplanUI();renderDaysOffUI();renderCustomUI();renderBenchUI();renderWeaveUI();
  const tog=(id,list)=>{const el=$(id);if(el)el.innerHTML=DAY_NAMES.map((n,i)=>`<button type="button" class="dtog ${list.includes(i)?'on':''}" onclick="toggleDay('${id}',${i})" aria-pressed="${list.includes(i)}">${n.slice(0,3)}</button>`).join('')};
  tog('#cfg-workdays',settings.workdays);tog('#cfg-blazer',settings.blazerDays.filter(d=>settings.workdays.includes(d)));
  if($('#wx-loc'))$('#wx-loc').textContent=settings.location?`Weather for ${settings.location.name}.`+(climate?` Beyond the 16-day forecast, days are planned from the usual weather there: highs of about ${temp(Math.min(...climate.map(m=>m.tmax)))}° in the coolest month and ${temp(Math.max(...climate.map(m=>m.tmax)))}° in the hottest.`:' Beyond the 16-day forecast, days follow the calendar season.'):'No location set: outfits follow the calendar season.';
  if($('#cfg-units'))$('#cfg-units').value=unit();
  if($('#cfg-vest'))$('#cfg-vest').value=settings.vestMode||'auto';
}
function setVestMode(v){settings.vestMode=v;saveUserSettings()}
function toggleDay(id,i){const k=id==='#cfg-workdays'?'workdays':'blazerDays',l=new Set(settings[k]);l.has(i)?l.delete(i):l.add(i);
  if(k==='workdays'&&l.size===0)return;settings[k]=[...l].sort();if(k==='workdays')settings.blazerDays=settings.blazerDays.filter(d=>l.has(d));
  renderSettingsExtras();saveUserSettings()}
function setUnits(v){settings.units=v;saveUserSettings()}
function setLocation(loc){settings.location=loc;localStorage.removeItem('wx');localStorage.removeItem('wx_norm');weather={};climate=null;saveUserSettings().then(()=>loadWeather(true));renderSettingsExtras();if($('#city-results'))$('#city-results').innerHTML=''}
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
    if(typeof renderTried!=='undefined')renderTried.clear();remoteKeys=null;
    const v=['today','wardrobe','add','stats'].find(t=>!$('#'+t).hidden)||'today';show(v);
    if(!msg){const diff=items.length-n0;msg=`Refreshed · ${items.length} item${items.length===1?'':'s'}${diff>0?` (${diff} new)`:diff<0?` (${-diff} removed)`:''}`}
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(g=>g&&g.update()).catch(()=>{});
  }catch(e){msg='Refresh failed: '+(e.message||e)}
  finally{refreshing=false;if(b)b.classList.remove('spin');toast(msg)}
}
/* the location's usual weather by month, from Open-Meteo's archive (free, no key): the last two full years' daily highs,
   lows and rain, averaged per month. Kept for four months per location; days beyond the 16-day forecast are planned from it. */
async function loadClimate(){
  const L=settings.location;if(!L){climate=null;return}
  try{const c=JSON.parse(localStorage.getItem('wx_norm')||'null');
    if(c&&c.lat===L.lat&&c.lon===L.lon&&Array.isArray(c.months)){const fresh=Date.now()-c.t<120*864e5;if(JSON.stringify(climate)!==JSON.stringify(c.months)){climate=c.months;cache={};if(!$('#today').hidden)renderToday()}if(fresh)return}}catch{}
  try{const y=new Date().getFullYear(),r=await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${L.lat}&longitude=${L.lon}&start_date=${y-2}-01-01&end_date=${y-1}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
    const d=r.ok&&(await r.json()).daily;if(!d||!d.time||!d.temperature_2m_max)return;
    const m=[...Array(12)].map(()=>({n:0,tx:0,tn:0,r:0}));
    d.time.forEach((t,i)=>{const k=+t.slice(5,7)-1,tx=d.temperature_2m_max[i];if(!(k>=0&&k<12)||typeof tx!=='number')return;m[k].n++;m[k].tx+=tx;m[k].tn+=d.temperature_2m_min?.[i]??tx;if((d.precipitation_sum?.[i]||0)>=1)m[k].r++});
    if(m.some(x=>x.n<20))return;   // a month with hardly any readings: keep what we had
    const months=m.map(x=>({tmax:+(x.tx/x.n).toFixed(1),tmin:+(x.tn/x.n).toFixed(1),rainDays:+(x.r/x.n*30).toFixed(1)}));
    const N=settings.location;if(!N||N.lat!==L.lat||N.lon!==L.lon)return;   // the location changed meanwhile
    climate=months;localStorage.setItem('wx_norm',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),months}));cache={};if(!$('#today').hidden)renderToday();if(settingsOpen())renderSettingsExtras()}
  catch(e){console.warn('climate history unavailable',e)}
}
async function loadWeather(force){
  const L=settings.location;if(!L)return;loadClimate();
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
  const sig=shopSig(),payload={list:items.map(({photo,swatch,stripes,texture,sett,patternText,weave,pbox,patternSpec,...i})=>i),settings,weather,climate,today:TODAY_OVERRIDE,weeks:8};   // the planner needs the tags only: no pictures
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
