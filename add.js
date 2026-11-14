/* Daily Wardrobe: the Add page: photo cards (white balance, close-ups, pasted photos and links, several items in one photo), typing an item in by hand, saving
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* ---- automatic white balance (wbRead/wbGains in tagging.js): the light's colour is read from the brightest near-neutral pixels (a white wall, backdrop,
   shirt or label), which should be grey, and every pixel is scaled to make them so. Conservative: no correction when there
   are too few of them, when they fill nearly the whole photo (then they are the item itself, e.g. a close-up of a cream
   shirt; a white backdrop behind an item is fine), or when the cast is under 2%; each channel moves at most -15%/+18%. ---- */
function applyWb(c,g){const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0);
  if(!g)return o;const D=x.getImageData(0,0,o.width,o.height),d=D.data;
  for(let i=0;i<d.length;i+=4){d[i]=Math.min(255,d[i]*g.r);d[i+1]=Math.min(255,d[i+1]*g.g);d[i+2]=Math.min(255,d[i+2]*g.b)}x.putImageData(D,0,0);return o}
/* an Add card's pictures from its uncorrected originals, with or without the correction (Show original toggles it) */
/* an item's photo is kept at PH_MAX (JPEG .85), the size Replace photo keeps: at 360px (JPEG .8) a suit sent to the photo
   generator was a 270px crop of a mirror selfie. It is made from the sharp copy (raw.full, TAG_MAX), not the 800px q.big the
   card measures from: from q.big every new item's photo was 800px, whatever PH_MAX said (audit 2026-11-13) */
function cardPics(q){const g=q.wbOff?null:q.wb;q.big=applyWb(q.raw.big,g);const sharp=q.raw.full?applyWb(q.raw.full,g):null;
  q.photo=shrink(sharp||q.big,PH_MAX).toDataURL('image/jpeg',.85);
  if(sharp)q.tagImg=sharp.toDataURL('image/jpeg',TAG_Q);   // the sharp copy the tagger sees
  if(q.raw.tex){q.texCanvas=applyWb(q.raw.tex,texGains(q));q.texture=q.texCanvas.toDataURL('image/jpeg',.85)}generateSwatch(q)}
/* a close-up with its own white reference (a corner of white paper) is corrected from that; otherwise like its item photo */
function texGains(q){const r=closeRead(q.raw.tex);return r.ref?r.gains:(q.wbOff?null:q.wb)}
function toggleWb(i){const q=queue[i];if(!q||!q.raw)return;q.wbOff=!q.wbOff;cardPics(q);renderAdd()}
const TEX_MAX=1536;   // the synced close-up (2026-11-13, the owner: "the zoom-in pictures are still stored at 640"): as sharp as the device-only copy (CLOSE_MAX), now that photos are stored one by one on the server and fetched when needed (it was 640)
/* the fabric close-up for an Add card: corrected with the same light reading as the card's item photo (taken together) */
async function addTexture(i,f){const q=queue[i];if(!q||!f)return;
  try{const img=await loadImg(f);q.raw=q.raw||{};q.raw.tex=shrink(img,Math.max(TEX_MAX,CLOSE_MAX));q.texCanvas=applyWb(q.raw.tex,texGains(q));q.texture=q.texCanvas.toDataURL('image/jpeg',.85);q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);q.refineNote='';renderAdd();
    refineFromCloseup(queue.indexOf(q))}   // tag again with both photos (tagging.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
function dropTexture(i){const q=queue[i];if(!q)return;delete q.texture;delete q.texCanvas;q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);if(q.raw)delete q.raw.tex;q.refineNote='';measureCard(q);renderAdd()}
/* the second step of a card for suits, blazers, trousers, shirts and ties: the close-up photo */
function texSlot(q,i){if(!TEXTURE_TYPES.includes(q.type))return '';
  const inp=`<input type="file" accept="image/*" class="vfile" onchange="addTexture(${i},this.files[0]);this.value=''">`;
  return q.texture?`<div class="texslot done"><small class="mut">Fabric close-up added: the swatch shows it on the right half, next to the colour as tagged.</small><div class="btns"><label class="btn">Replace close-up${inp}</label><button type="button" onclick="dropTexture(${i})">Remove</button></div></div>`
    :`<div class="texslot"><b>Step 2 · Fabric close-up</b><small class="mut">Hold the camera close to the cloth so the weave and its true colour fill the frame. It makes the realistic photos match better. Optional.</small><small class="mut texpaper">Lay white paper along one edge and tap it on the screen to set the exposure.</small><button type="button" class="linkbtn texguide" onclick="kitCloseupGuide()">Tips for a good close-up</button><label class="btn pri">Add close-up${inp}</label></div>`}
const wbNote=(q,i)=>q.wb&&q.raw?`<p class="wbnote mut"><small>${q.wbOff?'Original colours.':'Colours corrected for the light.'}</small> <button type="button" class="linkbtn" onclick="toggleWb(${i})">${q.wbOff?'Correct them':'Show original'}</button></p>`:'';
/* Add: "One item" (multi false; also paste and drag) makes one card per photo; "Several items" finds every item in it */
async function addFiles(files,multi){
  guardUnsaved();
  if(multi){multiNote(true);for(const f of files)await addMulti(f);return}
  // every photo gets its card at once, and ADD_PAR are tagged at a time (one after another, five photos were five waits in a row)
  const cards=[...files].map(f=>{const q={id:crypto.randomUUID(),busy:1};queue.push(q);return [q,f]});renderAdd();
  const one=async([q,f])=>{
    try{
      const img=await loadImg(f);
      q.raw={big:shrink(img,800),full:shrink(img,TAG_MAX)};q.wb=wbGains(q.raw.big);cardPics(q);   // tagged from the corrected, sharp copy
      const aiResult=await ask(q.tagImg,{wb:!!(q.wb&&!q.wbOff)});   // wb: whether the photo was white-balanced (the tagger is told)
      fill(q,aiResult);if(aiResult){takeExtras(q,aiResult);measureAndApply(q)}else tagFailed(q)
    }catch(e){q.err=1}
    q.busy=0;
    renderAdd();
  };
  let k=0;await Promise.all(Array.from({length:Math.min(ADD_PAR,cards.length)},async()=>{while(k<cards.length)await one(cards[k++])}));
}
const ADD_PAR=3;

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
  if(!w||!tok)throw new Error('That site doesn’t let the app download the photo directly. Connect in ⚙ Settings so the server can fetch it, or save the photo and add it from your device.');
  let r;try{r=await fetch(new URL('fetch',w.replace(/\/*$/,'/')).href+'?url='+encodeURIComponent(url.href),{headers:{'x-app-token':tok}})}
  catch{throw new Error('Couldn’t reach the server to fetch the photo.')}
  if(!r.ok){let m='';try{m=(await r.json()).error}catch{}
    if(r.status===404||r.status===405)m='The server doesn’t support photo links yet: it needs an update.';
    throw new Error(m||`The server couldn’t fetch the photo (${r.status}).`)}
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
  if(imgs.length){if(typing&&tgt.type!=='url'&&tgt.type!=='text')return;e.preventDefault();if($('#add').hidden)openAdd();addBlobs(imgs);return}
  const text=(e.clipboardData&&e.clipboardData.getData('text/plain')||'').trim();
  if(!typing&&!$('#add').hidden&&isLink(text)){e.preventDefault();const i=$('#photo-url');if(i)i.value=text;addFromUrl(text)}
});
/* drag & drop photos (or an image dragged from another tab) onto the app */
document.addEventListener('dragover',e=>{if([...(e.dataTransfer&&e.dataTransfer.types||[])].some(t=>t==='Files'||t==='text/uri-list')){e.preventDefault();document.body.classList.add('dragging')}});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('dragging')});
document.addEventListener('drop',e=>{const dt=e.dataTransfer;if(!dt)return;document.body.classList.remove('dragging');
  const files=[...dt.files].filter(f=>f.type.startsWith('image/'));
  const link=(dt.getData('text/uri-list')||'').split(/\r?\n/).find(l=>l&&!l.startsWith('#'))||dt.getData('text/plain');
  if(!files.length&&!isLink(link))return;e.preventDefault();if($('#add').hidden)openAdd();
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
  if(!w){multiMsg('Connect in ⚙ Settings first: finding several items in one photo needs the server.');return}
  const holder={id:crypto.randomUUID(),busy:1,multiBusy:1};queue.push(holder);renderAdd();
  try{
    const raw=shrink(await loadImg(f),2576),wb=wbGains(raw),img=applyWb(raw,wb);   // one light reading for the whole photo; Claude reads up to 2576px
    const r=await fetch(new URL('tag-many',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},
      body:JSON.stringify({image:img.toDataURL('image/jpeg',.9),custom:customForTag(),corrections:tagFixes(),wb:!!wb})});
    const j=await r.json().catch(()=>({}));
    queue.splice(queue.indexOf(holder),1);
    if(!r.ok){multiMsg(r.status===404||r.status===405?'The server doesn’t support several items yet: it needs an update.':`Couldn’t find the items: ${typeof plainErr==='function'?plainErr(j.detail||j.error||'HTTP '+r.status):j.detail||j.error||'HTTP '+r.status}`);renderAdd();return}
    const list=j.items||[];
    if(!list.length){multiMsg('No clothing items were found in that photo.');renderAdd();return}
    list.forEach((it,n)=>{
      const q={id:crypto.randomUUID(),multi:{n:n+1,of:list.length,confidence:it.confidence||'medium'}};
      q.raw={big:cropBox(raw,it.box,800),full:cropBox(raw,it.box,TAG_MAX)};q.wb=wb;cardPics(q);
      const tg=normTag(it,j.model);fill(q,tg);q.aiTag={...aiFields(tg)};q.tagAI=aiSignals({...tg,confidence:it.confidence},false);queue.push(q);
    });
    aiModel=j.model||aiModel;aiError='';
    const counts={};for(const it of list){const t=TYPES[it.type]?it.type:'item';counts[t]=(counts[t]||0)+1}
    multiMsg(`Found ${list.length} item${list.length===1?'':'s'} (${Object.entries(counts).map(([t,c])=>{const n=(TYPES[t]||'item').toLowerCase();return `${c} ${n}${c>1&&!n.endsWith('s')?'s':''}`}).join(', ')}). Check each card, then Save all or confirm them one by one.`);
  }catch(e){const k=queue.indexOf(holder);if(k>=0)queue.splice(k,1);multiMsg('Couldn’t read that photo: '+(e.message||e))}
  renderAdd();
}
/* save every finished card in the queue (Skip the ones you don't want first) */
/* a card Claude is still reading (tagging again with the close-up, or its pattern) can't be saved yet: saved meanwhile it kept the
   weaker reading and the pattern call was paid for anyway (audit 2026-11-13); Confirm and Save all wait for it */
const cardReading=q=>!!(q&&(q.refining||q.patternReading));
async function saveAll(){if(queue.some(cardReading))return;const n=queue.filter(q=>!q.busy&&!q.err).length;for(let i=queue.length-1;i>=0;i--){const q=queue[i];if(!q.busy&&!q.err)await save(i)}
  multiMsg(`Saved ${n} item${n===1?'':'s'} to your wardrobe.`);renderAdd()}
const shirtColFix=o=>{for(const f of ['primaryColor','secondaryColor','tertiaryColor'])if(o[f])o[f]=normColFor(o.type,o[f],f!=='primaryColor')};
const setq=(i,k,v)=>{const q=queue[i];q[k]=v==='none'?null:v;q.edited={...q.edited,[k]:true};if(k==='shoeStyle'&&!leathersFor(q).includes(q.leather))q.leather='calf';if(k==='shoeStyle'||k==='trouserKind'){renderAdd();return}if((k==='primaryColor'||k==='type')&&q.texCanvas)generateSwatch(q);if(k==='type'){q.pattern=normPat(v,q.pattern);shirtColFix(q)}if(k==='type'||q.manual||k==='primaryColor'||k==='pattern'){if(k==='type'&&q.meas)q.meas.near=nearestCols(q.type,q.meas.lab,q.meas.ref);if(k==='type'||k==='pattern')readSett(q);renderAdd()}else{const t=$('#tagsw-q'+i);if(t)t.innerHTML=tagSwInner(q)}};
/* next to an item's photo: the colour and texture as tagged (what the app draws), so the two can be compared */
/* with a fabric close-up: the drawn swatch on the left half, the close-up on the right, to compare colour and weave */
const tagSwInner=i=>`<div class="swsplit">${itemThumb(i,true)}${i.texture&&TEXTURE_TYPES.includes(i.type)?`<img class="swtex" src="${i.texture}" alt="Fabric close-up">`:''}</div><figcaption>${i.texture&&TEXTURE_TYPES.includes(i.type)?'As tagged · Close-up':'As tagged'}<br><b class="cap">${sentence(desc(i))||TYPES[i.type]||''}</b></figcaption>`;
/* Shade: darker or lighter than the tagged colour's swatch, to match the close-up; "Match close-up" sets it from the measurement */
const shadeRow=(o,onStep,onMatch,canMatch)=>`<div class="shaderow"><span class="shlab">Shade</span><div class="shctl"><button type="button" class="shbtn" aria-label="Darker" onclick="${onStep}(-1)"${(o.shade||0)<=-SHADE_MAX?' disabled':''}>−</button><span class="shval">${shadeName(o.shade||0)}</span><button type="button" class="shbtn" aria-label="Lighter" onclick="${onStep}(1)"${(o.shade||0)>=SHADE_MAX?' disabled':''}>+</button></div>${canMatch?`<button type="button" class="chipbtn" onclick="${onMatch}">Match close-up</button>`:''}</div>`;
function stepShadeQ(i,d){const q=queue[i];if(!q)return;q.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(q.shade||0)+d));if(!q.shade)delete q.shade;renderAdd()}
function matchShadeQ(i){const q=queue[i];if(!q||!q.meas)return;q.shade=shadeFor(q,q.meas.lab);if(!q.shade)delete q.shade;renderAdd();toast(q.shade?`Swatch set ${shadeName(q.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
async function stepShadeE(id,d){const it=items.find(x=>x.id===id);if(!it)return;it.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(it.shade||0)+d));if(!it.shade)delete it.shade;await put(it);cache={};renderWardrobe()}
async function matchShadeE(id){const it=items.find(x=>x.id===id);if(!it)return;let lab=it.meas&&it.meas.src==='closeup'?it.meas.lab:null;
  if(!lab&&it.texture)try{const im=await imgOf(it.texture),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);lab=measureCloth(c,null,{}).lab}catch{}
  if(!lab)return;it.shade=shadeFor(it,lab);if(!it.shade)delete it.shade;await put(it);cache={};renderWardrobe();toast(it.shade?`Swatch set ${shadeName(it.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
const photoPair=(photo,i,id)=>`<div class="pair"><figure class="phfig"><img class="ph" src="${photo}" alt="Photo"><figcaption>Photo</figcaption></figure><figure class="tagsw" id="${id}" aria-live="polite">${tagSwInner(i)}</figure></div>`;
/* an item described with the dropdowns only; the wardrobe shows a drawn thumbnail instead of a photo */
function addManual(){
  guardUnsaved();
  const wo=watchOpts({});
  queue.unshift({id:crypto.randomUUID(),manual:true,type:'suit',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf',dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style});
  renderAdd();
}
/* bought but not here yet: the item goes into the wardrobe out of rotation; with an arrival date it joins the outfits from the day
   after (inRotation in core.js), and once that day comes it is put back in rotation for good (checkArrivals) */
const fmtDay=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
const orderHint=a=>a?`It joins your outfits from the day after ${fmtDay(a)}.`:'It stays out of your outfits until you put it back in rotation from the Wardrobe. Add a date to have that happen by itself.';
/* how many: shirts and socks can be added several at once (2026-11-14, the owner: "white shirts: tap a plus or minus for the amount
   before I add"). Each is an item of its own (its own id, so the planner rotates and the laundry counts them apart), the same tags and
   photo (the server keeps a photo once, by its hash); Undo takes them all back */
const QTY_TYPES=['shirt','socks'],QTY_MAX=12;
const qtyOf=q=>QTY_TYPES.includes(q.type)?Math.min(QTY_MAX,Math.max(1,+q.qty||1)):1;
const qtyLabel=q=>{const n=qtyOf(q);return n>1?'Confirm '+n:'Confirm'};
function qtyRow(q,i){if(!QTY_TYPES.includes(q.type))return '';const n=qtyOf(q);
  return `<div class="qtyrow" role="group" aria-label="How many to add"><span class="qtyl">How many<small class="mut">${q.type==='socks'?'Identical pairs':'Identical shirts'}, each its own item</small></span><span class="qty"><button type="button" class="qtyb" id="qty-m-${i}" aria-label="One fewer" onclick="stepQty(${i},-1)"${n<=1?' disabled':''}>−</button><output id="qty-n-${i}" aria-live="polite">${n}</output><button type="button" class="qtyb" id="qty-p-${i}" aria-label="One more" onclick="stepQty(${i},1)"${n>=QTY_MAX?' disabled':''}>+</button></span></div>`}
/* the number, its buttons and Confirm change in place (no redraw: the card would jump) */
function stepQty(i,d){const q=queue[i];if(!q)return;q.qty=Math.min(QTY_MAX,Math.max(1,qtyOf(q)+d));const n=q.qty;
  const o=$('#qty-n-'+i),m=$('#qty-m-'+i),p=$('#qty-p-'+i),c=$('#qconf-'+i);if(o)o.textContent=n;if(m)m.disabled=n<=1;if(p)p.disabled=n>=QTY_MAX;if(c)c.textContent=qtyLabel(q)}
function orderRow(q,i){return `<div class="ordrow"><button type="button" class="rotbtn${q.order?' on':''}" aria-pressed="${!!q.order}" onclick="setOrder(${i},${!q.order})">${q.order?'✓ ':''}Bought, on the way</button>${q.order?`<label class="ordate">Arrives (optional) <input type="date" value="${q.arrives||''}" min="${isoKey(todayDate())}" onchange="setArrives(${i},this.value)"></label><small class="mut ordhint">${orderHint(q.arrives)}</small>`:''}</div>`}
function setOrder(i,on){const q=queue[i];if(!q)return;q.order=!!on;if(!on)delete q.arrives;renderAdd()}
function setArrives(i,v){const q=queue[i];if(!q)return;if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))q.arrives=v;else delete q.arrives;renderAdd()}
async function checkArrivals(){const T=di(todayDate()),done=items.filter(i=>i.paused&&arriveN(i)!=null&&T>arriveN(i));
  const cb=done.filter(i=>i.away);   // back from the cleaner's or the laundry (care.js): cleaned on the day it was due back
  for(const it of done){if(it.away){it.cleaned=it.away.back||isoKey(todayDate());delete it.away}delete it.paused;delete it.order;delete it.arrives;await put(it)}
  if(done.length){cache={};toast(cb.length===done.length&&typeof careBackText==='function'?careBackText(cb):done.length===1?`Your ${(TYPES[done[0].type]||'item').toLowerCase()} has arrived: it's in rotation now.`:`${done.length} items have arrived: they're in rotation now.`,4000)}return done.length}
async function save(i){
  if(cardReading(queue[i]))return;
  const q=queue[i],f=FABRIC.includes(q.type);
  generateSwatch(q);
  const it={id:q.id,type:q.type,primaryColor:q.primaryColor,secondaryColor:q.secondaryColor,tertiaryColor:q.tertiaryColor,pattern:f?q.pattern:'solid',photo:q.photo,added:Date.now()};
  if(f){it.swatch=q.swatch;it.swSrc=q.swSrc}
  if(q.order){it.paused=true;it.order=true;if(q.arrives)it.arrives=q.arrives}   // bought, on the way
  if(METAL_TYPES.includes(q.type))it.metal=q.metal||'silver';
  if(q.type==='shirt')it.cuff=q.cuff||'button';
  if(q.type==='suit')it.vest=q.vest==='yes'?'yes':'no';if(typeof dressNewItem==='function')dressNewItem();
  if(SEASON_TYPES.includes(q.type)&&q.season&&q.season!=='all')it.season=q.season;
  if(q.type==='shoes'||q.type==='belt')it.leather=q.leather||'calf';
  if(q.type==='pants'&&(q.trouserKind==='chinos'||q.trouserKind==='jeans'))it.trouserKind=q.trouserKind;   // dress trousers: no field (as before kinds)
  if(q.type==='shoes'&&q.shoeStyle&&q.shoeStyle!=='oxford')it.shoeStyle=q.shoeStyle;
  if(q.type==='watch'){const wo=watchOpts(q);Object.assign(it,{dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style})}
  if(!it.photo)delete it.photo;else await makeSmall(it);
  if(q.texture&&TEXTURE_TYPES.includes(q.type))it.texture=q.texture;
  if(q.meas)it.meas={lab:q.meas.lab,ref:!!q.meas.ref,src:q.meas.src,...(q.meas.parts?{parts:q.meas.parts.map(p=>({role:p.role,lab:p.lab,hex:p.hex,share:p.share}))}:{})};   // a patterned cloth's ground and stripe too (colpick.js)
  if(q.tagAI&&!q.manual)it.tagAI=q.tagAI;   // Claude's colour it gave, how sure it was, its runner-ups (tagging.js aiSignals): to calibrate the verdict later
  wardSaveFields(q,it);   // name, brand, material, notes (wardrobe.js)
  if(q.shade)it.shade=q.shade;   // drawn darker or lighter than the swatch, to match the close-up   // the owner's own colour samples (calibLab)
  if(q.sett&&!q.settOff&&readable(it.type,it.pattern,q.weave)){it.sett=q.sett;if(q.patternBox)it.pbox=q.patternBox}   // the full pattern (tagging.js)
  if(q.weave&&FABRIC.includes(it.type)&&it.pattern!=='solid'){it.weave=q.weave;if(q.weave.description)it.patternText=q.weave.description}
  if(q.spec&&it.sett&&it.sett.src==='claude+pixels')it.patternSpec=q.spec;   // Claude's reading of the pattern (tagging.js)
  // the old brightness-only stripe reader: only where the full reader had nothing to go on (no close-up), and never after it turned down a reading as contradicting the tag
  if(!it.sett&&!q.texture&&!q.settReject)try{const st=detectQueued(q,it);if(st)it.stripes=st}catch(e){console.warn('pattern detection failed',e)}
  if(q.sample)it.sample=true;   // the sample wardrobe (kit.js kitSampleLoad)
  await put(it);items.push(it);
  const copies=[];for(let k=1;k<qtyOf(q);k++){const c=JSON.parse(JSON.stringify(it));c.id=crypto.randomUUID();await put(c);items.push(c);copies.push(c)}   // the same shirt or pair again (qtyRow)
  cache={};queue.splice(i,1);renderAdd();
  if(typeof kitSaved==='function')kitSaved(it,q,i,copies);   // Saved, with Undo for all of them (kit.js)
  if(q.tagImg)keepTagImg(it.id,q.tagImg,it.photo);recordTagResult(q,it);askPersist();   // tagging.js: the sharp copy (signed with the photo); what the tagger got wrong
  if(it.texture&&q.raw&&q.raw.tex)closeTagImg(q).then(u=>keepCloseImg(it.id,u,it.texture)).catch(()=>{});   // the sharp close-up for later readings (tagging.js)
  q.raw=null;q.big=null;q.texCanvas=null;   // the card's canvases (a 2048 px photo, its 800 px copy, the close-up) go now, not when the last reply about the card comes back
}

function renderAdd(){
  closeSettings();
  const workerSet = !!localStorage.getItem('worker_url');
  if($('#note')) $('#note').textContent = !workerSet ? 'Photos won’t be read automatically. Paste your invite link in Settings → Connection, or add items by hand.' : aiError || (aiModel?`Last photo read by ${/^claude/.test(aiModel)?'Claude':'AI'} (${aiModel}).`:'Photos are read automatically: the type, colours and pattern are filled in for you.');
  const ready=queue.filter(q=>!q.busy&&!q.err).length,reading=queue.some(cardReading);if($('#save-all'))$('#save-all').innerHTML=ready>1?`<button class="btn pri" onclick="saveAll()"${reading?' disabled title="Claude is still reading a card"':''}>Save all ${ready} items</button>`:'';
  if(typeof addGate==='function')addGate();
  if($('#queue')) $('#queue').innerHTML=queue.map((q,i)=>q.busy?`<div class="card"><span class="spin" aria-hidden="true"></span>${q.multiBusy?'Finding every item in the photo… (this can take up to a minute)':'Analyzing photo…'}</div>`:q.err?`<div class="card">That image couldn’t be read. <button onclick="queue.splice(${i},1);renderAdd()">Dismiss</button></div>`:
`<div class="card">${q.multi?`<p class="multi-h"><b>Item ${q.multi.n} of ${q.multi.of}</b> <span class="conf ${q.multi.confidence}">${q.multi.confidence} confidence</span></p>`:''}
${tagFailNote(q,i)}<div class="rv">${q.photo?photoPair(q.photo,q,'tagsw-q'+i):itemThumb(q)}</div>${COLORS[q.primaryColor]?shadeRow(q,`stepShadeQ.bind(null,${i})`,`matchShadeQ(${i})`,!!(q.meas&&q.meas.src==='closeup')):''}${wbNote(q,i)}${texSlot(q,i)}${tagNotes(q,i)}
${FABRIC.includes(q.type)&&q.big?`
<div class="sw-box">
  <div id="swatch-img-${i}" class="sw" style="background-image:url(${q.swatch})"></div>
  <div style="flex:1;font-size:13px">
    <b>Fabric swatch</b><small class="mut" style="display:block">${q.texCanvas?'From the fabric close-up':'From the photo'}: zoom and move it to a clean patch of cloth</small>
    <label>Zoom <input type="range" min="1" max="4" step="0.1" value="${q.zoom||1}" oninput="updateSwatchParam(${i}, 'zoom', this.value)"></label>
    <label>Left–right <input type="range" min="0" max="1" step="0.05" value="${q.cx||0.5}" oninput="updateSwatchParam(${i}, 'cx', this.value)"></label>
    <label>Up–down <input type="range" min="0" max="1" step="0.05" value="${q.cy||0.5}" oninput="updateSwatchParam(${i}, 'cy', this.value)"></label>
  </div>
</div>`:''}
<label>Type ${S(Object.entries(TYPES),q.type,'type',i)}</label>
<label class="colrow">Colour ${colBtn('q',i,'primaryColor',q.primaryColor)}</label>
<label class="colrow">${q.type==='socks'?'Toe cap':'Second colour'} ${colBtn('q',i,'secondaryColor',q.secondaryColor||'none')}</label>
${q.type==='socks'?'':`<label class="colrow">Third colour ${colBtn('q',i,'tertiaryColor',q.tertiaryColor||'none')}</label>`}
${FABRIC.includes(q.type)?`<label class="colrow">Pattern ${patBtn('q',i,q)}</label>`:''}${METAL_TYPES.includes(q.type)?`<label>${q.type==='belt'?'Buckle':'Metal'} ${S(Object.keys(METAL).map(c=>[c,c]),q.metal,'metal',i)}</label>`:''}
${q.type==='shirt'?`<label>Cuffs ${S(CUFFS,q.cuff||'button','cuff',i)}</label>`:''}${q.type==='suit'?`<label>Vest ${S(VESTS,q.vest==='yes'?'yes':'no','vest',i)}</label>`:''}${SEASON_TYPES.includes(q.type)?`<label>Season ${S(SEASONS,q.season||'all','season',i)}</label>`:''}
${q.type==='pants'?`<label>Kind ${S(TROUSER_KINDS,q.trouserKind||'dress','trouserKind',i)}</label>`:''}${q.type==='shoes'?`<label>Style ${S(SHOE_STYLES,q.shoeStyle||'oxford','shoeStyle',i)}</label>`:''}${q.type==='shoes'||q.type==='belt'?`<label>${leatherLabel(q)} ${S(leathersFor(q).map(c=>[c,cap1(leatherWord(q,c))]),q.leather||'calf','leather',i)}</label>`:''}
${q.type==='watch'?`<label>Dial ${S(DIAL_OPTS(watchOpts(q).dial),watchOpts(q).dial,'dial',i)}</label><label>Band ${S(BANDS,watchOpts(q).band,'band',i)}</label><label>Bezel ${S(BEZELS,watchOpts(q).bezel,'bezel',i)}</label><label>Style ${S(WATCH_STYLES,watchOpts(q).style,'watchStyle',i)}</label>`:''}
${matRow(q.type,q.material,`setQField(${i},'material',`)}${moreRow(q,i)}${orderRow(q,i)}${qtyRow(q,i)}<div class="btns"><button class="pri" id="qconf-${i}" onclick="save(${i})"${cardReading(q)?' disabled title="Claude is still reading this item"':''}>${qtyLabel(q)}</button><button onclick="queue.splice(${i},1);renderAdd()">${q.manual?'Cancel':'Skip'}</button></div>${q.manual?'':`<small>${aiLabel(q)}</small>`}</div>`).join('');
}

