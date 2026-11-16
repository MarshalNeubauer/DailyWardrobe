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
function texGains(q){if(q.texDone)return null;const r=closeRead(q.raw.tex);return r.ref?r.gains:(q.wbOff?null:q.wb)}   // (texDone: a card brought back after a kill, its close-up already corrected)
function toggleWb(i){const q=queue[i];if(!q||!q.raw)return;q.wbOff=!q.wbOff;cardPics(q);renderAdd()}
/* a picture too small to read (an 8×8 thumbnail was sent to Claude and became the item's photo: audit 2026-11-15): refused before any reading */
const ADD_MIN_PX=32;
const TEX_MIN_PX=200;
const TEX_MAX=1536;   // the synced close-up (2026-11-13, the owner: "the zoom-in pictures are still stored at 640"): as sharp as the device-only copy (CLOSE_MAX), now that photos are stored one by one on the server and fetched when needed (it was 640)
/* the fabric close-up for an Add card: corrected with the same light reading as the card's item photo (taken together) */
/* read: the close-up came through "Add close-up and read texture/color" (colpick.js rdStart), whose reading replaces the automatic
   re-tag (the owner: no second paid call); the color is still measured from it (measureCard) */
async function addTexture(i,f,read){const q=queue[i];if(!q||!f)return;
  try{const img=await loadImg(f);
    if(Math.min(img.width,img.height)<TEX_MIN_PX){toast(`That close-up is too small to show the weave (${img.width}×${img.height} pixels). Take it close to the cloth, at full size.`,6000);return}
    q.raw=q.raw||{};delete q.texDone;delete q.refineCut;delete q.patternCut;q.raw.tex=shrink(img,Math.max(TEX_MAX,CLOSE_MAX));q.texCanvas=applyWb(q.raw.tex,texGains(q));q.texture=q.texCanvas.toDataURL('image/jpeg',.85);q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);q.refineNote='';renderAdd();
    if(read){measureCard(q);renderAdd();if(typeof addKeep==='function')addKeep();return}
    refineFromCloseup(queue.indexOf(q))}   // tag again with both photos (tagging.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
function dropTexture(i){const q=queue[i];if(!q)return;delete q.texture;delete q.texCanvas;delete q.texDone;delete q.refineCut;delete q.patternCut;q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);if(q.raw)delete q.raw.tex;q.refineNote='';measureCard(q);renderAdd()}
/* (the close-up step of a card, "Step 2 · Fabric close-up", is now the checklist's Texture match section: addCkSecs below) */
const wbNote=(q,i)=>q.wb&&q.raw?`<p class="wbnote mut"><small>${q.wbOff?'Original colors.':'Colors corrected for the light.'}</small> <button type="button" class="linkbtn" onclick="toggleWb(${i})">${q.wbOff?'Correct them':'Show original'}</button></p>`
  :q.wbWas&&q.photo?'<p class="wbnote mut"><small>Colors corrected for the light.</small></p>':'';   // a card brought back after a kill: still corrected, no original kept (addRevive)
/* Add: "One item" (multi false; also paste and drag) makes one card per photo; "Several items" finds every item in it */
async function addFiles(files,multi){
  addWatch();
  if(multi){multiNote(true);const agg={n:0,counts:{},capped:false};for(const f of files)await addMulti(f,agg);return}
  // every photo gets its card at once, at the top in the order picked (where a card typed in by hand goes too), and ADD_PAR are tagged
  // at a time (one after another, five photos were five waits in a row)
  const cards=[...files].map(f=>[{id:crypto.randomUUID(),busy:1},f]);queue.unshift(...cards.map(c=>c[0]));renderAdd();if(cards.length)addShowCard(cards[0][0].id);
  const one=async([q,f])=>{
    // the picture itself: only a file that can't be opened, or is too small to read, is refused (nothing is asked for it)
    let img=null;try{img=await loadImg(f)}catch(e){console.warn('photo not opened',e);q.err='open'}
    if(img&&Math.min(img.width,img.height)<ADD_MIN_PX){q.err='small';q.errWh=[img.width,img.height]}
    if(q.err){q.busy=0;renderAdd();return}
    // from here the card keeps its photo whatever happens: no connection, a dropped one or a server error leave it to fill in by hand,
    // with Try again (a failed request used to land in the same catch as a broken file: "That image couldn't be read", photo gone)
    try{
      q.raw={big:shrink(img,800),full:shrink(img,TAG_MAX)};q.wb=wbGains(q.raw.big);cardPics(q);if(addRestoreState==='done')addKeep();   // tagged from the corrected, sharp copy; kept on the phone at once, before the reading
      // Stop on the card ends the wait (a stalled connection kept "Reading the photo…" with no button for about 75 s): the photo stays, to fill in by hand or try again
      const ac=typeof AbortController==='function'?new AbortController():null;q.abort=ac;if(ac)renderAdd();
      const aiResult=await ask(q.tagImg,{wb:!!(q.wb&&!q.wbOff),...(ac?{signal:ac.signal}:{})});q.abort=null;   // wb: whether the photo was white-balanced (the tagger is told)
      if(q.stopped){delete q.stopped;fill(q,null);q.unread=1;q.tagErr=STOPPED}
      else{fill(q,aiResult);if(aiResult){takeExtras(q,aiResult);measureAndApply(q)}else{q.unread=1;tagFailed(q)}}
    }catch(e){console.warn('photo card',e);if(typeof errNote==='function')errNote(e,'Photo card'+(q.type?' ('+q.type+')':''));if(!q.photo){q.err='open'}else{if(!q.type)fill(q,null);if(!q.ai)q.unread=1;q.tagErr=q.tagErr||'Something went wrong while reading it.'}}
    q.busy=0;q.abort=null;
    addKeep();   // the reading kept at once: a kill in the next moment brought the card back as "closed before it was read", and Try again paid again
    renderAdd();if(q===cards[0][0])addShowCard(q.id);   // (the small "Reading" card fitted; the full one grows below the screen)
  };
  let k=0;await Promise.all(Array.from({length:Math.min(ADD_PAR,cards.length)},async()=>{while(k<cards.length)await one(cards[k++])}));
}
const ADD_PAR=3;
const STOPPED='You stopped the reading.';
/* Stop on a card being read (one item, or Try again): the request is called off and the card keeps its photo */
function stopRead(id){const q=queue.find(x=>x.id===id);if(!q||!q.abort||q.multiBusy)return;q.stopped=1;try{q.abort.abort()}catch{}}
/* a reading cut off by a kill (addRevive: refineCut, patternCut), read again on a tap */
function refineAgain(i){const q=queue[i];if(!q)return;if(!(typeof isConnected==='function'?isConnected():localStorage.getItem('worker_url'))){toast('Connect in ⚙ Settings first.',4000);return}
  delete q.refineCut;delete q.patternCut;refineFromCloseup(i)}
function patternAgain(i){const q=queue[i];if(!q)return;if(!(typeof isConnected==='function'?isConnected():localStorage.getItem('worker_url'))){toast('Connect in ⚙ Settings first.',4000);return}
  delete q.patternCut;readPatternWithClaude(q)}
/* a double tap on Confirm: the card saves once, then the list closes up under the finger and the second tap landed on what moved
   there (the last card's: "Import from a spreadsheet", whose sheet then covered Add). A tap within ADD_CALM ms of a Confirm and near
   the same spot is let go */
const ADD_CALM=450;let addCalm=null;
document.addEventListener('click',e=>{const t=e.target&&e.target.closest?e.target:null;if(!t||!t.closest('#add'))return;
  if(addCalm&&addCalm.ok&&e.isTrusted&&Date.now()-addCalm.t<ADD_CALM&&Math.hypot(e.clientX-addCalm.x,e.clientY-addCalm.y)<40){e.preventDefault();e.stopPropagation();return}
  if(e.isTrusted)addCalm=t.closest('[id^="qconf-"]')?{t:Date.now(),x:e.clientX,y:e.clientY}:null},true);   // (any other tap ends it)
/* a new card is brought into view (it used to land below the One item / Several items buttons, out of sight under the tab bar) */
function addShowCard(id){requestAnimationFrame(()=>{const a=$('#add'),el=document.querySelector(`#queue [data-q="${id}"]`);if(!a||a.hidden||!el)return;
  el.scrollIntoView({behavior:typeof noMotion==='function'&&noMotion()?'auto':'smooth',block:'start'})})}
/* a card not read by Claude (not connected, or the reading failed) doesn't pretend to know the type: it asks for it first (it said
   "Suit · Grey" for a photo of a white shirt, and Confirm saved a grey suit); a type chosen by hand ends it */
const needType=q=>!!q&&!!q.unread&&!q.manual&&!q.ai&&!q.busy&&!q.err&&!q.multiBusy&&!q.multiErr&&!(q.edited&&q.edited.type);
/* the colour is then measured from the middle of the photo (measureCloth, tagging.js) once the type is known */
function measureGuess(q){if(!q||!q.raw||!q.raw.big||(q.edited&&q.edited.primaryColor)||typeof measureCloth!=='function')return;
  try{const m=measureCloth(q.raw.big,q.clothBox||null,{gains:q.wbOff?null:q.wb}),n=nearestCols(q.type,m.lab,false)[0];if(n&&COLORS[n.c])q.primaryColor=n.c}catch(e){console.warn('color not measured',e)}}
/* an image that couldn't be opened can still be added by hand */
function errToHand(id){const q=queue.find(x=>x.id===id);if(!q)return;const wo=watchOpts({});
  for(const k of ['err','errWh','busy'])delete q[k];Object.assign(q,{manual:true,type:'suit',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf',dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style});renderAdd()}
/* Skip, Cancel and Dismiss find their card by its id: by its place, a double tap skipped the next card too */
function skipCard(id){const k=queue.findIndex(q=>q.id===id);if(k<0)return;const q=queue[k];if(q.abort)try{q.abort.abort()}catch{}queue.splice(k,1);
  if((q.multiBusy||q.multiErr)&&!queue.some(x=>x.multi||x.multiBusy||x.multiErr))multiNote(false);   // "Each item in the photo gets its own card…" stayed over no card
  renderAdd()}

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
  if(!w||!tok||(typeof inviteOver==='function'&&inviteOver()))throw new Error('That site doesn’t let the app download the photo directly. Connect in ⚙ Settings so the server can fetch it, or save the photo and add it from your device.');
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
function multiNote(on){multiMsg(on?'Each item in the photo gets its own card. Check each card: colors and textures from a rail photo need a look, especially whites.':'')}
/* crop the box (thousandths of the image) with a little margin, keeping at least a usable size */
function cropBox(img,box,max){
  const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,pad=.04;
  let x=(box.x/1000-pad*box.w/1000)*W,y=(box.y/1000-pad*box.h/1000)*H,w=box.w/1000*W*(1+2*pad),h=box.h/1000*H*(1+2*pad);
  const minS=Math.min(W,H)*.08;if(w<minS){x-=(minS-w)/2;w=minS}if(h<minS){y-=(minS-h)/2;h=minS}
  x=Math.max(0,x);y=Math.max(0,y);w=Math.min(W-x,w);h=Math.min(H-y,h);
  const k=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  c.getContext('2d').drawImage(img,x,y,w,h,0,0,c.width,c.height);return c;
}
/* "1 pair of shoes", "2 dress shirts", "1 trousers" no more */
const PAIR_TYPES=['pants','shoes','socks','cufflinks'];
function countWord(t,c){const n=(TYPES[t]||'item').toLowerCase();if(PAIR_TYPES.includes(t))return `${c} pair${c===1?'':'s'} of ${n}`;return `${c} ${n}${c===1?'':/(s|x|ch|sh)$/.test(n)?'es':'s'}`}   // "4 watches" ("4 watchs")
/* the most items one photo gives (worker/tag.js keeps the first 40) */
const MULTI_CAP=40;
/* why "Several items" didn't work, in plain words: offline, the server's own sentence (its message), or a plain fallback; never a code */
function multiFail(status,j,e){if(!status){const off=navigator.onLine===false;
    return off||e instanceof TypeError?MULTI_NET:'Something went wrong while reading the photo. Try again.'}
  if(status===404||status===405)return 'The server doesn’t support several items yet: it needs an update.';
  const m=j&&(typeof j.message==='string'&&j.message.trim()||j.detail)||'',pe=m&&typeof plainErr==='function'?plainErr(m):m;
  // the server's "Try again later, or add the item by hand." is left out, as on a one-item card: the card has Try again right there
  const t=pe&&/\s/.test(pe)?String(pe).trim().replace(/\s*Try again later\b[^.]*\.?\s*$/i,'').trim():'';
  return t&&/\s/.test(t)?t.replace(/([^.!?])$/,'$1.'):'The photo couldn’t be read just now. Try again in a moment.'}
const MULTI_NET='You’re offline, or the server couldn’t be reached. The photo is kept: it is read again once you’re connected.';
/* a type the app doesn't plan (a hat) is left out: normTag made it a suit, and Save all saved a black suit */
const oddWord=list=>[...new Set(list.map(it=>String(it.type||'').toLowerCase().replace(/[^a-z -]/g,'').trim().slice(0,20)).filter(Boolean))].slice(0,3).join(', ');
async function addMulti(f,agg,again){
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token')||'';
  if(!w||(typeof inviteOver==='function'&&inviteOver())){multiMsg('Connect in ⚙ Settings first: finding several items in one photo needs the server.');return}
  // the photo's card while it is read: it has Cancel, and if the reading fails it stays with the reason, Try again and Dismiss (the
  // photo was dropped: it had to be picked again)
  const holder=again||{id:crypto.randomUUID()};Object.assign(holder,{busy:1,multiBusy:1,file:f});delete holder.multiErr;delete holder.multiNet;delete holder.multiCut;if(!again){queue.unshift(holder);addShowCard(holder.id)}
  const ac=typeof AbortController==='function'?new AbortController():null;holder.abort=ac;renderAdd();
  const fail=(t,net)=>{delete holder.busy;delete holder.multiBusy;holder.abort=null;holder.multiErr=t;if(net)holder.multiNet=1;addKeep();if(queue.includes(holder))renderAdd()};
  let raw,wb,img;try{raw=shrink(await (typeof f==='string'?imgOf(f):loadImg(f)),2576);wb=wbGains(raw);img=applyWb(raw,wb)}   // one light reading for the whole photo; Claude reads up to 2576px
  catch(e){console.warn('photo not opened',e);fail('That photo couldn’t be opened. Try a JPEG or PNG.');return}
  // the photo is kept on the phone before the reading, like a one-item card's (multiPic, addKeep): a kill while it was read, or while it
  // waited for Try again, lost it with no word, though the card said "The photo is kept"
  if(!holder.multiPic)try{holder.multiPic=raw.toDataURL('image/jpeg',.9);holder.file=holder.multiPic}catch(e){console.warn('photo not kept',e)}
  addKeep();
  let r,j;try{r=await fetch(new URL('tag-many',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},
      body:JSON.stringify({image:img.toDataURL('image/jpeg',.9),custom:customForTag(),corrections:tagFixes(),wb:!!wb}),...(ac?{signal:ac.signal}:{})});
    j=await r.json().catch(()=>({}))}
  catch(e){if(!queue.includes(holder))return;console.warn('several items',e);fail(multiFail(0,null,e),navigator.onLine===false||e instanceof TypeError);return}   // (Cancel took it off Add: nothing more to say)
  if(!queue.includes(holder))return;   // cancelled while the answer came
  if(!r.ok){fail(multiFail(r.status,j));return}
  const all=j.items||[],list=all.filter(it=>it&&TYPES[it.type]),odd=all.filter(it=>it&&!TYPES[it.type]),at=queue.indexOf(holder);queue.splice(at,1);
  const oddTxt=odd.length?` ${odd.length===1?'One thing':odd.length+' things'} the app doesn’t plan (${oddWord(odd)}) ${odd.length===1?'was':'were'} left out.`:'';
  if(!list.length){multiMsg('No clothing items were found in that photo.'+oddTxt);renderAdd();return}
  const made=list.map((it,n)=>{
    const q={id:crypto.randomUUID(),multi:{n:n+1,of:list.length,confidence:it.confidence||'medium'}};
    q.raw={big:cropBox(raw,it.box,800),full:cropBox(raw,it.box,TAG_MAX)};q.wb=wb;cardPics(q);
    const tg=normTag(it,j.model);fill(q,tg);q.aiTag={...aiFields(tg)};q.tagAI=aiSignals({...tg,confidence:it.confidence},false);return q});
  queue.splice(at,0,...made);   // where the photo's card was
  aiModel=j.model||aiModel;aiError='';
  // two photos picked at once: one summary for both (the second photo's line replaced the first's)
  agg=agg||{n:0,counts:{},capped:false};agg.n+=list.length;if(list.length>=MULTI_CAP)agg.capped=true;
  for(const it of list){const t=TYPES[it.type]?it.type:'item';agg.counts[t]=(agg.counts[t]||0)+1}
  multiMsg(`Found ${agg.n} item${agg.n===1?'':'s'} (${Object.entries(agg.counts).map(([t,c])=>countWord(t,c)).join(', ')}).${oddTxt}${agg.capped?` One photo gives at most ${MULTI_CAP}: if there are more, take another photo of the rest.`:''} Check each card, then Save all or confirm them one by one.`);
  renderAdd();addKeep();addShowCard(made[0].id);
}
/* Try again on a "Several items" photo that couldn't be read: the same photo, no picking again */
function multiAgain(id){const q=queue.find(x=>x.id===id);if(!q||!q.file||q.busy)return;multiNote(true);addMulti(q.file,null,q)}
/* save every finished card in the queue (Skip the ones you don't want first) */
/* a card Claude is still reading (tagging again with the close-up, or its pattern) can't be saved yet: saved meanwhile it kept the
   weaker reading and the pattern call was paid for anyway (audit 2026-11-13); Confirm and Save all wait for it */
const cardReading=q=>!!(q&&(q.refining||q.patternReading));
/* a card that can be saved now (Save all and its count) */
const cardReady=q=>!!q&&!q.busy&&!q.err&&!q.multiErr&&!q.saving&&!needType(q);
/* one Save all at a time: a double tap ran two loops over the same cards, and the Wardrobe showed every piece twice (deleting the
   "copy" deleted the only real one); each card is saved by its id, last first, so Undo puts them back in their places */
let saveAllOn=false;
async function saveAll(){if(saveAllOn||queue.some(cardReading))return;saveAllOn=true;renderAdd();let n=0;
  try{const cards=queue.filter(cardReady);for(let k=cards.length-1;k>=0;k--){const q=cards[k];if(queue.includes(q)&&await save(q.id)===true)n++}}
  finally{saveAllOn=false}
  const left=queue.filter(needType).length;
  if(n||left)multiMsg(`${n?`Saved ${n} item${n===1?'':'s'} to your wardrobe.`:''}${left?`${n?' ':''}${left===1?'One card needs its type':`${left} cards need their type`} first.`:''}`);renderAdd()}
const shirtColFix=o=>{for(const f of ['primaryColor','secondaryColor','tertiaryColor'])if(o[f])o[f]=normColFor(o.type,o[f],f!=='primaryColor')};
const setq=(i,k,v)=>{const q=queue[i];if(!q)return;const asked=k==='type'&&needType(q);q[k]=v==='none'?null:v;q.edited={...q.edited,[k]:true};const ck=CK_FIELD[k]&&!(q.checked&&q.checked[CK_FIELD[k]]);if(ck)q.checked={...q.checked,[CK_FIELD[k]]:1};queueMicrotask(addKeep);
  if(asked){measureGuess(q);q.pattern=normPat(v,q.pattern);shirtColFix(q);renderAdd();return}   /* the type asked for (needType): the colour measured, the full card */
if(k==='shoeStyle'&&!leathersFor(q).includes(q.leather))q.leather='calf';if(k==='shoeStyle'||k==='trouserKind'||k==='band'){renderAdd();return}if((k==='primaryColor'||k==='type')&&q.texCanvas)generateSwatch(q);if(k==='type'){q.pattern=normPat(v,q.pattern);shirtColFix(q)}if(k==='type'||q.manual||k==='primaryColor'||k==='pattern'){if(k==='type'&&q.meas)q.meas.near=nearestCols(q.type,q.meas.lab,q.meas.ref);if(k==='type'||k==='pattern')readSett(q);renderAdd()}else if(ck)renderAdd();else{const t=$('#tagsw-q'+i);if(t)t.innerHTML=tagSwInner(q)}};   // (a section newly checked: its mark and the count follow)
/* next to an item's photo: the colour and texture as tagged (what the app draws), so the two can be compared */
/* with a fabric close-up: the drawn swatch on the left half, the close-up on the right, to compare colour and weave */
const tagSwInner=i=>`<div class="swsplit">${itemThumb(i,true)}${i.texture&&TEXTURE_TYPES.includes(i.type)?`<img class="swtex" src="${srcOk(i.texture)}" alt="Fabric close-up">`:''}</div><figcaption>${i.texture&&TEXTURE_TYPES.includes(i.type)?'As tagged · Close-up':'As tagged'}<br><b class="cap">${sentence(desc(i))||TYPES[i.type]||''}</b></figcaption>`;
/* Shade: darker or lighter than the tagged colour's swatch, to match the close-up; "Match close-up" sets it from the measurement */
const shadeRow=(o,onStep,onMatch,canMatch)=>`<div class="shaderow"><span class="shlab">Shade</span><div class="shctl"><button type="button" class="shbtn" aria-label="Darker" onclick="${onStep}(-1)"${(o.shade||0)<=-SHADE_MAX?' disabled':''}>−</button><span class="shval">${shadeName(o.shade||0)}</span><button type="button" class="shbtn" aria-label="Lighter" onclick="${onStep}(1)"${(o.shade||0)>=SHADE_MAX?' disabled':''}>+</button></div>${canMatch?`<button type="button" class="chipbtn" onclick="${onMatch}">Match close-up</button>`:''}</div>`;
function stepShadeQ(i,d){const q=queue[i];if(!q)return;q.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(q.shade||0)+d));if(!q.shade)delete q.shade;renderAdd()}
function matchShadeQ(i){const q=queue[i];if(!q||!q.meas)return;q.shade=shadeFor(q,q.meas.lab);if(!q.shade)delete q.shade;renderAdd();toast(q.shade?`Swatch set ${shadeName(q.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
async function stepShadeE(id,d){const it=items.find(x=>x.id===id);if(!it)return;it.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(it.shade||0)+d));if(!it.shade)delete it.shade;await put(it);cache={};renderWardrobe()}
async function matchShadeE(id){const it=items.find(x=>x.id===id);if(!it)return;let lab=it.meas&&it.meas.src==='closeup'?it.meas.lab:null;
  if(!lab&&it.texture)try{const im=await imgOf(it.texture),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);lab=measureCloth(c,null,{}).lab}catch{}
  if(!lab)return;it.shade=shadeFor(it,lab);if(!it.shade)delete it.shade;await put(it);cache={};renderWardrobe();toast(it.shade?`Swatch set ${shadeName(it.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
const photoPair=(photo,i,id)=>`<div class="pair"><figure class="phfig"><img class="ph" src="${srcOk(photo)}" alt="Photo"><figcaption>Photo</figcaption></figure>${needType(i)?'':`<figure class="tagsw" id="${esc(id)}" aria-live="polite">${tagSwInner(i)}</figure>`}</div>`;
/* an item described with the dropdowns only; the wardrobe shows a drawn thumbnail instead of a photo */
/* "Add without a photo" (2026-11-15, the owner's choice: variant A of add-page-mockups) opens the card in a sheet from the bottom over Add,
   not in the list; a second call while the sheet holds a card shows that card again */
function addManual(){
  addWatch();
  if(npsId&&queue.some(q=>q.id===npsId)){npsOpen(npsId);return}
  const wo=watchOpts({}),id=crypto.randomUUID(),q={id,manual:true,type:'suit',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf',dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style};
  if(addFor&&TYPES[addFor]){q.type=addFor;q.pattern=normPat(addFor,q.pattern);shirtColFix(q);addFor=null;renderAddFor()}   // Today's "Add one" beside a belt: a belt (W2-14-01)
  queue.unshift(q);
  npsOpen(id);
}
/* ---- Today's "Add one" beside a missing piece (fix round 3, W2-14-01; start.js openAdd(type)): the item type asked for. Add's line under
   its title says so ("Adding a belt: …") and the next card without a photo starts as that type; a photo's card takes the type Claude reads.
   Cleared once used, or when Add is left. ---- */
let addFor=null;
function renderAddFor(){const n=$('#add-for');if(!n)return;const t=addFor&&TYPES[addFor];n.hidden=!t;
  const pl=['pants','shoes','socks','cufflinks'].includes(addFor);
  n.innerHTML=t?`Adding ${pl?'':/^[aeiou]/i.test(t)?'an ':'a '}<b>${esc(t.toLowerCase())}</b>: take a photo of ${pl?'them':'it'}, or tap “Add without a photo”.`:''}
/* ---- the "Add without a photo" sheet (#nps-sheet, in #add so the card keeps Add's styles): grabber, the title with the hanger icon, ×
   in the header (the card's own × is left out), the card in the middle, Confirm and Cancel pinned at the bottom (#nps-bar). The card stays
   in `queue` (its place there is its index, as for every card); only its drawing moves (renderAdd → npsDraw).
   Closing without saving (×, Cancel, a swipe down, the backdrop, Escape, the phone's Back) drops the card; once anything on it was
   changed it asks "Discard this item?" first. Confirm saves it, and the sheet closes when the card leaves the queue (npsDraw).
   Back: the sheet borrows Add's history entry (start.js appBorrow('nps'), kept in npsWas); closed by a tap it hands it back. ---- */
let npsId=null,npsWas,npsSnap='',npsAsking=false,npsFrom=null,npsSwipeOn=false;
/* what the card holds, to tell whether anything was changed (its form as kept, its close-up) */
const npsSig=q=>{if(!q)return '';const o=addCardRec(q);delete o.swatch;delete o.swSrc;delete o.checked;return JSON.stringify(o)+'|'+(q.texture?q.texture.length:0)};
const npsCard=()=>npsId?queue.find(q=>q.id===npsId):null;
function npsOpen(id){const s=$('#nps-sheet'),b=$('#nps-backdrop');if(!s)return;const again=!!npsId;npsId=id;
  if(!again){npsFrom=document.activeElement;npsWas=typeof appBorrow==='function'?appBorrow('nps'):'';}
  renderAdd();npsSnap=npsSig(npsCard());npsSwipe();
  s.classList.add('on');b.classList.add('on');document.body.classList.add('nps-on');npsInert(true);
  const body=$('#nps-q');if(body&&!again)body.scrollTop=0;
  if(!again)try{s.focus({preventScroll:true})}catch{}}
/* the page under the sheet (header, the tab bar, the rest of Add) can't be reached while it is up */
function npsInert(on){for(const el of document.querySelectorAll('body>header,body>nav'))el.inert=on;const a=$('#add');if(!a)return;
  for(const el of a.children)if(el.id!=='nps-sheet'&&el.id!=='nps-backdrop')el.inert=on}
/* the card and its bar; the card gone (saved, or taken away) closes the sheet */
function npsDraw(){const q=npsCard(),s=$('#nps-sheet');if(!s)return;if(!q){npsClose();return}const i=queue.indexOf(q),body=$('#nps-q'),bar=$('#nps-bar');
  if(body){const y=body.scrollTop;keepFocus(body,()=>{body.innerHTML=cardSafe(q,i,()=>formCard(q,i,true))});body.scrollTop=y;if(typeof cmpMount==='function')cmpMount(body)}
  if(bar)bar.innerHTML=`${cardSafe(q,i,()=>ckLeftLine(q))}${confBtn(q,i)}<button type="button" id="nps-cancel" onclick="npsCancel()">Cancel</button>`}
/* fromBack: the phone's Back did it (its entry is gone already) */
function npsClose(fromBack){if(!npsId&&npsWas===undefined)return;const s=$('#nps-sheet'),b=$('#nps-backdrop');npsId=null;npsAsking=false;
  if(s)s.classList.remove('on');if(b)b.classList.remove('on');document.body.classList.remove('nps-on');npsInert(false);if(typeof layerInert==='function')layerInert();
  const was=npsWas;npsWas=undefined;if(typeof appGiveBack==='function'){if(!fromBack)appGiveBack('nps',was);else if(was)appPush(was)}
  const f=npsFrom;npsFrom=null;const to=f&&f.isConnected&&!f.closest('[inert]')&&f!==document.body?f:$('#add-manual');
  if(to&&$('#add')&&!$('#add').hidden)try{to.focus({preventScroll:true})}catch{}
  setTimeout(()=>{if(!npsId){const body=$('#nps-q'),bar=$('#nps-bar');if(body)body.innerHTML='';if(bar)bar.innerHTML=''}},320)}   // (emptied once it has slid away)
/* ×, Cancel, a swipe, the backdrop, Escape, Back: asks first when the card was changed; -> whether it closed */
async function npsCancel(fromBack){const q=npsCard();if(!npsId||npsAsking)return false;
  if(q&&(q.saving||cardReading(q))){if(fromBack&&typeof appPush==='function')appPush('nps');return false}   // (being saved or read: it stays, and Back's entry is made again)
  if(q&&npsSig(q)!==npsSnap){if(fromBack&&typeof appPush==='function')appPush('nps');   // the sheet stays while it asks: its entry again, for the question to borrow
    npsAsking=true;const go=await askConfirm('Discard this item?\n\nWhat you picked on it is not saved.',{ok:'Discard',cancel:'Keep editing',danger:true});npsAsking=false;
    if(!go||npsCard()!==q)return false;npsClose();skipCard(q.id);return true}
  const id=npsId;npsClose(fromBack);if(q)skipCard(id);return true}
function npsBack(){if(npsId)npsCancel(true)}
/* Add left while the sheet is up (start.js show): the sheet closes; a card with changes stays on Add as a card of the list, an
   untouched one goes */
function npsLeave(){if(!npsId)return;const q=npsCard(),changed=!!q&&npsSig(q)!==npsSnap;if(npsAsking&&typeof asking!=='undefined'&&asking)askAnswer(false);
  npsClose();if(q&&!changed)skipCard(q.id)}
/* swiping the sheet down closes it, as What to buy and the item sheet: its header is a handle at any time, the card only while it is
   scrolled to the top; past a quarter of its height or a flick it closes (asking first when changed), else it springs back */
function npsSwipe(){if(npsSwipeOn)return;const s=$('#nps-sheet');if(!s)return;npsSwipeOn=true;
  sheetSwipe(s,{head:'.nps-head',body:()=>$('#nps-q'),backdrop:()=>$('#nps-backdrop'),live:()=>!!npsId&&!npsAsking,close:()=>npsCancel()});
  s.addEventListener('keydown',e=>{if(e.key==='Escape'&&npsId&&!npsAsking){e.preventDefault();e.stopPropagation();npsCancel()}})}
/* the swipe-down of a bottom sheet (the no-photo sheet, the import sheet): o.head is the handle's selector, o.body() the scrolling part,
   o.live() whether it may start, o.close() what letting go past the line does; the sheet follows the finger by its own transform */
function sheetSwipe(v,o){let st=null;
  const put=d=>{v.style.transform=d?`translateY(${d}px)`:'';const bd=o.backdrop&&o.backdrop();if(bd)bd.style.opacity=d?String(Math.max(.15,1-d/v.offsetHeight)):''};
  const held=on=>{const bd=o.backdrop&&o.backdrop();for(const el of [v,bd])if(el)el.style.transition=on?'none':''};
  v.addEventListener('touchstart',e=>{const t=e.touches[0],head=!!e.target.closest(o.head),b=o.body();
    st=!o.live()||e.touches.length>1||e.target.closest('input,textarea')||(!head&&b&&b.scrollTop>0)||(!head&&!(b&&b.contains(e.target)))?null:{x:t.clientX,y:t.clientY,on:false,d:0,ly:t.clientY,lt:e.timeStamp,vy:0}},{passive:true});
  v.addEventListener('touchmove',e=>{if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.on){if(dy>0&&dy>=Math.abs(dx)){st.on=true;held(true)}else{st=null;return}}
    e.preventDefault();const now=e.timeStamp;if(now>st.lt){st.vy=(t.clientY-st.ly)/(now-st.lt);st.ly=t.clientY;st.lt=now}
    st.d=Math.max(0,dy);put(st.d)},{passive:false});
  const end=()=>{if(!st)return;const {on,d,vy}=st;st=null;if(!on)return;held(false);
    if(d>v.offsetHeight*.25||(vy>.5&&d>30))o.close();
    put(0)};
  v.addEventListener('touchend',end,{passive:true});v.addEventListener('touchcancel',end,{passive:true})}
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
function stepQty(i,d){const q=queue[i];if(!q)return;q.qty=Math.min(QTY_MAX,Math.max(1,qtyOf(q)+d));const n=q.qty;queueMicrotask(addKeep);
  const o=$('#qty-n-'+i),m=$('#qty-m-'+i),p=$('#qty-p-'+i),c=$('#qconf-'+i);if(o)o.textContent=n;if(m)m.disabled=n<=1;if(p)p.disabled=n>=QTY_MAX;if(c)c.textContent=qtyLabel(q)}
function orderRow(q,i){return `<div class="ordrow"><button type="button" class="rotbtn${q.order?' on':''}" aria-pressed="${!!q.order}" onclick="setOrder(${i},${!q.order})">${q.order?'✓ ':''}Bought, on the way</button>${q.order?`<label class="ordate">Arrives (optional) <input type="date" value="${q.arrives||''}" min="${isoKey(todayDate())}" onchange="setArrives(${i},this.value)"></label><small class="mut ordhint">${orderHint(q.arrives)}</small>`:''}</div>`}
function setOrder(i,on){const q=queue[i];if(!q)return;q.order=!!on;if(!on)delete q.arrives;renderAdd()}
/* a day already gone isn't an arrival date (the date field's min only limits its picker: 2020-01-01 typed in read "joins your outfits
   from the day after Jan 1") */
function setArrives(i,v){const q=queue[i];if(!q)return;const ok=/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  if(ok&&v<isoKey(todayDate())){delete q.arrives;renderAdd();toast('That day has passed. Pick today or a later day, or leave it empty.',4500);return}
  if(ok)q.arrives=v;else delete q.arrives;renderAdd()}
async function checkArrivals(){const T=di(todayDate()),done=items.filter(i=>i.paused&&arriveN(i)!=null&&T>arriveN(i));
  const cb=done.filter(i=>i.away);   // back from the cleaner's or the laundry (care.js): cleaned on the day it was due back
  if(cb.length&&typeof careUnlock==='function')await careUnlock(null,Math.min(...cb.map(i=>+keyDate(i.away.since||isoKey(todayDate())))));   // the locks made while away let go (history.js)
  for(const it of done){if(it.away){it.cleaned=it.away.back||isoKey(todayDate());delete it.away}delete it.paused;delete it.order;delete it.arrives;await put(it)}
  if(done.length){cache={};toast(cb.length===done.length&&typeof careBackText==='function'?careBackText(cb):done.length===1?`Your ${(TYPES[done[0].type]||'item').toLowerCase()} has arrived: it's in rotation now.`:`${done.length} items have arrived: they're in rotation now.`,4000)}return done.length}
/* Confirm (and the sample, the import, Save all): a failure is said and the card stays (a tester's Confirm did nothing at all, 2026-11-14) */
/* what the Saved toast calls the item: its own name, else its colours with what it is ("Grey suit", "Navy tie", "Gold watch · white dial
   · bracelet"; it said "Saved: Grey." for a suit and "Saved: Navy." for a tie and for socks) */
function savedTitle(it){const nm=itemName(it);if(nm)return nameIso(nm);const d=String(desc(it)||'').trim(),t=(TYPES[it.type]||'item').toLowerCase();
  if(!d)return sentence(t);const k=d.indexOf(' · ');return sentence(k<0?`${d} ${t}`:`${d.slice(0,k)} ${t}${d.slice(k)}`)}
/* a card by its id (Confirm, Save all) or, as before, its place (the sample, the import, tests) */
const cardOf=k=>typeof k==='string'?queue.find(q=>q.id===k):queue[k];
/* one save per card (audit 2026-11-15, C2: a double tap on Confirm saved the card twice and, the list having moved up, threw away the
   next card unsaved): the card is found by its id, marked while it saves (a second tap does nothing) and its Confirm switched off;
   -> true once saved, false when it couldn't be */
async function save(k){const q=cardOf(k);if(!q||q.saving||cardReading(q))return false;
  if(needType(q)){toast('Choose what it is first: pick its Type.',4000);return false}
  q.saving=1;const b=$('#qconf-'+queue.indexOf(q));if(b)b.disabled=true;
  if(!saveAllOn)await addKeep();   // the card as it is now (a kill right after Confirm brought back How many one lower: the last + waited for the timer)
  try{return await saveCard(q)}catch(e){console.warn('save failed',e);if(typeof errNote==='function')errNote(e,'Confirm on Add ('+q.type+')');
    if(typeof storeFailure==='function'&&storeFailure(e))saveFailed(e);else toast('Couldn’t save: '+String(e&&e.message||e).replace(/\.$/,'')+'. Try again.',7000);return false}
  finally{delete q.saving;if(queue.includes(q)&&$('#add')&&!$('#add').hidden)renderAdd()}}
async function saveCard(q){
  if(!q||cardReading(q))return false;
  const f=FABRIC.includes(q.type);
  generateSwatch(q);
  const it={id:q.id,type:q.type,primaryColor:q.primaryColor,secondaryColor:q.secondaryColor,tertiaryColor:q.tertiaryColor,pattern:f?q.pattern:'solid',photo:q.photo,added:nowMs()};
  if(f){it.swatch=q.swatch;it.swSrc=q.swSrc}
  {const a=accentsOf(q);if(a.length)it.accents=a}   // its colours beyond the three (core.js accentsOf)
  if(q.order){it.paused=true;it.order=true;if(q.arrives)it.arrives=q.arrives}   // bought, on the way
  if(METAL_TYPES.includes(q.type))it.metal=q.metal||'silver';
  if(q.type==='shirt')it.cuff=q.cuff||'button';
  if(q.type==='suit')it.vest=(q.vest||(typeof newSuitVest==='function'?newSuitVest():'no'))==='yes'?'yes':'no';if(typeof dressNewItem==='function')dressNewItem();
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
  colTidy(it);   // no second or third colour its type can't show (colpick.js)
  if(q.sample)it.sample=true;   // the sample wardrobe (kit.js kitSampleLoad)
  // the item and its copies (the same shirt or pair again, qtyRow) in one transaction: all of them or none (a kill right after
  // "Confirm 12" saved 3, and the card was gone)
  const copies=[];for(let k=1;k<qtyOf(q);k++){const c=JSON.parse(JSON.stringify(it));c.id=crypto.randomUUID();copies.push(c)}
  const all=[it,...copies],at=nowMs();for(const x of all)x.updated=at;
  await txs('items','readwrite',s=>{for(const x of all)s.put(x)});if(window.scheduleSync)scheduleSync();
  items.push(...all);
  const i=queue.indexOf(q);cache={};if(i>=0)queue.splice(i,1);if(addCalm)addCalm.ok=1;renderAdd();   // (only a card that really went closes up the list: a failed save's Confirm can be tapped again at once)
  if(typeof kitSaved==='function')kitSaved(it,q,Math.max(0,i),copies);   // Saved, with Undo for all of them (kit.js)
  if(q.tagImg)keepTagImg(it.id,q.tagImg,it.photo);recordTagResult(q,it);askPersist();   // tagging.js: the sharp copy (signed with the photo); what the tagger got wrong
  if(it.texture&&q.raw&&q.raw.tex)closeTagImg(q).then(u=>keepCloseImg(it.id,u,it.texture)).catch(()=>{});   // the sharp close-up for later readings (tagging.js)
  q.raw=null;q.big=null;q.texCanvas=null;   // the card's canvases (a 2048 px photo, its 800 px copy, the close-up) go now, not when the last reply about the card comes back
  return true;
}

/* Add's note while not connected: an invitation still being checked (or waiting to be, offline) is not "won't be read" */
function addNoteText(){const workerSet=typeof isConnected==='function'?isConnected():!!localStorage.getItem('worker_url');   // (an ended invitation reads nothing: ui.js)
  // (no model name: a tester read "Last photo read by Claude (claude-…)")
  if(workerSet)return aiError||'Photos are read automatically: the type, colors and pattern are filled in for you.';
  if(typeof inviteChecking!=='undefined'&&inviteChecking)return 'Checking your invitation… Photos you add meanwhile can be read once it’s done.';
  if(typeof acctWhy!=='undefined'&&acctWhy==='offline'&&typeof hasInviteHash==='function'&&hasInviteHash())return 'Your invitation is checked once you’re back online. Photos you add meanwhile can be read then.';
  if(typeof inviteOver==='function'&&inviteOver())return 'Your invitation has ended, so photos aren’t read automatically: add items by hand, or paste a new invitation link in Settings → Connection.';
  return 'Photos won’t be read automatically. Paste your invite link in Settings → Connection, or add items by hand.'}
/* (it no longer closes Settings: a reading coming back or the connection returning redrew Add and shut Settings mid-use; the pages
   that open Add close it themselves, show() and saveSettings) */
function renderAdd(){
  if($('#note')) $('#note').textContent = addNoteText();
  renderAddFor();
  const ready=queue.filter(cardReady).length,reading=queue.some(cardReading);if($('#save-all'))$('#save-all').innerHTML=ready>1?`<button class="btn pri" onclick="saveAll()"${reading||saveAllOn?` disabled title="${saveAllOn?'Saving…':'Claude is still reading a card'}"`:''}>${saveAllOn?'Saving…':`Save all ${ready} items`}</button>`:'';
  if(typeof addGate==='function')addGate();
  addKeepSoon();
  if($('#queue')){keepFocus($('#queue'),()=>{$('#queue').innerHTML=queue.map((q,i)=>q.id===npsId?'':cardSafe(q,i,()=>q.busy?busyCard(q):q.multiErr?multiErrCard(q):q.err?errCard(q):needType(q)?typeCard(q,i):formCard(q,i))).join('')});   // (the field changed keeps the keyboard: W2-19-01)
    if(typeof cmpMount==='function')cmpMount($('#queue'))}
  if(npsId)npsDraw();
}
/* one card drawn on its own (2026-11-16, a tester's first item: her iPhone, out of picture memory, refused a canvas while the card's swatch
   was drawn, so the whole redraw stopped and Confirm stayed switched off): a card that can't be drawn becomes a plain one that still
   saves, says what happened, and is reported (safety.js errNote) */
function cardSafe(q,i,draw){try{return draw()}catch(e){console.warn('Add card not drawn',e);if(typeof errNote==='function')errNote(e,'Add card drawn ('+(q.type||'?')+')');return plainCard(q,i)}}
function plainCard(q,i){return `<div class="card qcard" data-q="${esc(q.id)}"><button type="button" class="qx" aria-label="Close" title="Close" onclick="skipCard('${esc(q.id)}')">×</button>
  ${q.photo?`<img class="ph" src="${srcOk(q.photo)}" alt="Photo" style="max-width:160px;border-radius:12px">`:''}<p class="tagnote"><small>Part of this card couldn’t be drawn: your phone may be short of memory for pictures. It still saves as it is${q.type?` (${esc(TYPES[q.type]||q.type)})`:''}; you can change it afterwards in the Wardrobe.</small></p>
  <div class="btns">${confBtn(q,i)}<button onclick="skipCard('${esc(q.id)}')">${q.manual?'Cancel':'Skip'}</button></div></div>`}
/* an item card's form (a photo's card in the list, or the "Add without a photo" sheet's card: inSheet leaves out the card's own × and its
   Confirm / Cancel, which the sheet has in its header and its pinned bar) */
/* the card is a checklist (2026-11-16, the owner's approved redesign "2B Checklist", checklist.js): "N of M checked" pinned at the top of its
   scroll area the whole way down (a direct child of the card, so not inside a column; from 600px over both columns), the photo, what
   Claude's reading said (tagNotes), then sections filled from Claude's reading: Texture match (fabrics: the close-up and the drawing side by
   side, or, before a close-up, "Add close-up and read color, texture & material" and "Add close-up"), Type, Colors, Pattern (Claude's pick
   and its second choice drawn), Fabric & fit (or Details), More (name, brand, notes, Bought on the way, How many). Each counted section has
   "Looks right" (Texture match "Fine as is"); a field changed by hand checks its section too. Sections Claude was unsure about get "!" and
   open first. Confirm is never blocked by unchecked parts ("2 left to check · you can still confirm"), only while Claude reads (confBtn). */
const CK_FIELD={type:'type',primaryColor:'colors',secondaryColor:'colors',tertiaryColor:'colors',pattern:'pattern',metal:'fabric',cuff:'fabric',vest:'fabric',season:'fabric',
  trouserKind:'fabric',shoeStyle:'fabric',leather:'fabric',dial:'fabric',band:'fabric',bezel:'fabric',watchStyle:'fabric',material:'fabric',accents:'colors'};
/* ---- the material's extras under the Add card's Material (2026-11-16, the owner's approved design): Claude's new material offered
   ("Add cupro as a material": tagging.js matOffer), the note once added, and Claude's low-confidence guess with "Use wool" (matGuessUse).
   MAT_ASK: the types whose material matters for planning; empty, Fabric & fit is "!" (worth a look; Confirm still works) */
const MAT_ASK=['suit','blazer','pants'];
const matNewOf=q=>q.matNew&&MATERIALS_BY[q.type]&&!q.material&&!matsFor(q.type).includes(q.matNew.key)&&q.matNew.conf!=='low'?q.matNew:null;
const matGuessOf=q=>q.matGuess&&!q.material&&(matsFor(q.type)||[]).includes(q.matGuess.key)?q.matGuess:null;
const matWhy=w=>{const s=String(w||'').replace(/[.\s]+$/,'');return /^[A-Z][a-z]/.test(s)?s[0].toLowerCase()+s.slice(1):s};   // (mid-sentence: "cupro, silky drape")
function matExtras(q,i){if(!MATERIALS_BY[q.type])return '';let h='';const t=matTypeOne(q.type);
  if(q.matAdded&&q.material===q.matAdded)h+=`<p class="tagnote matadded"><small>Now one of your materials: it’s in the list for every ${esc(t)} you add, on all your devices.</small></p>`;
  const nm=matNewOf(q);
  if(nm)h+=`<div class="offer matnew"><small>None of the materials fit: Claude calls it <b>${esc(nm.key)}</b>${matWhy(nm.why)?`, ${esc(matWhy(nm.why))}`:''} (${esc(nm.conf)} confidence).</small><button type="button" class="chipbtn" onclick="matOffer(${i})">Add ${esc(nm.key)} as a material</button></div>`;
  const g=matGuessOf(q);
  if(g){const w=String(g.why||'').replace(/[.\s]+$/,'');h+=`<p class="tagnote mut matguess"><small>Claude’s guess: <b>${esc(g.key)}</b> · ${w&&w.length<=60?esc(w):'can’t be sure from a photo'}</small><button type="button" class="chipbtn" onclick="matGuessUse(${i})">Use ${esc(g.key)}</button></p>`}
  return h}
const ckLr=(q,i,k)=>{const on=!!(q.checked&&q.checked[k]);return `<button type="button" class="cklr" aria-pressed="${on}" onclick="ckCheck(${i},'${k}')">${on?'<span aria-hidden="true">✓ </span>Checked':k==='tex'?'Fine as is':'Looks right'}</button>`};
/* "Looks right": the section checked (or not again); checked, it folds and the next unchecked one opens */
function ckCheck(i,k){const q=queue[i];if(!q)return;const on=!(q.checked&&q.checked[k]);q.checked={...q.checked,[k]:on?1:0};
  if(on){const sc='q|'+q.id;CK_OPEN[sc+'|'+k]=false;const nx=addCkSecs(q,i).find(s=>s.n&&!q.checked[s.k]);if(nx)CK_OPEN[sc+'|'+nx.k]=true}
  queueMicrotask(addKeep);renderAdd()}
/* the card's sections: [{k, n (counted), mark, title, sum, body, warn}] */
function addCkSecs(q,i){const man=!!q.manual||!q.ai,c=q.conf||{},chk=q.checked||{},tex=TEXTURE_TYPES.includes(q.type),fab=FABRIC.includes(q.type),hasCu=tex&&!!q.texture;
  const unsure=v=>!man&&!!v&&v!=='high',out=[];
  // Texture match: counted once there is a close-up
  if(tex){const rd=cardReading(q),cloth=paperCloth(q),lab=hasCu?cmpLab('q',q):null,d=hasCu?cmpDiff(q,lab):null,p=hasCu?cmpPaper('q',q):null;
    const blur=q.manual&&q.meas&&q.meas.src==='closeup'&&q.meas.sharp!=null&&q.meas.sharp<BLUR_SHARP?'<p class="tagnote blurnote"><small>The close-up is too blurry to read the weave: retake it?</small></p>':'';
    const pick=(label,cls,mode)=>closeupBtn({label,cls,mode,file:`f=>addTexture(${i},f)`,remove:mode==='replace'?`dropTexture(${i})`:'',cloth});
    const body=hasCu?cmpHtml(q.id,q.texture,cmpDrawn(q),!!(p&&p.ref))+cmpMatchHtml('q',i,q,lab)+cmpPaperLine(p,pick('Retake close-up','linkbtn wbretake','retake'))+blur+
        `<div class="btns ckcu">${pick('Replace close-up','btn','replace')}${cuTouch()?'':`<button type="button" class="ckrm" onclick="dropTexture(${i})">Remove close-up</button>`}</div>`+
        `<div class="ckread">${rdAddBtn(q,'Read color and texture')}${rdCostLine()}</div>${rdDoneHtml('q',q.id,q)}${ckLr(q,i,'tex')}`
      :`<p class="shelp">Texture match puts a close-up of the cloth beside the drawing and sets the true color from white paper.${q.photo?'':' The close-up is saved with the item.'}</p>${paperSteps(cloth)}`+
        `<div class="ckadds"><button type="button" class="btn pri rdgo ckreadadd" onclick="rdStart('q','${jsq(q.id)}')"${rdOff()?' aria-disabled="true"':''}><span>Add close-up and read color, texture &amp; material</span><small class="rdcost">${esc(rdCost())}</small></button>${pick('Add close-up','btn ckadd','add')}</div>`+
        '<p class="shelp ckcheap">Reading counts as 2 lookups for testers. Nothing changes until you choose.</p>';
    out.push({k:'tex',cls:'cktex'+(hasCu?' cktexon':''),n:hasCu,warn:hasCu&&!chk.tex&&!!d,mark:rd?'ai':!hasCu?'opt':chk.tex?'good':d?'warn':'todo',title:'Texture match',
      sum:rd?'Reading the close-up…':!hasCu?'Not yet · add a close-up to compare':cmpDiffText(d)||'Close-up added',body,open:true})}
  // Type
  const tw=unsure(c.type);
  out.push({k:'type',n:true,warn:tw,mark:chk.type?'good':tw?'warn':'todo',title:'Type',sum:esc(TYPES[q.type]||'Item')+(ckSure(c.type)&&!man?' · '+ckSure(c.type):''),
    body:`<label>Type ${S(Object.entries(TYPES),q.type,'type',i)}</label>`+ckLr(q,i,'type')});
  // Colors
  const rows=colRows('q',i,q),shade=COLORS[q.primaryColor]&&colShows(q,'primaryColor')?shadeRow(q,`stepShadeQ.bind(null,${i})`,`matchShadeQ(${i})`,!tex&&!!(q.meas&&q.meas.src==='closeup')):'';
  if(rows||shade){const cw=unsure(c.primaryColor)||(!man&&(!!q.newColor||Object.keys(q.auto||{}).length>0||(q.measV||[]).some(v=>v.mode==='flag'&&!(q.edited&&q.edited[v.f]))));
    out.push({k:'colors',n:!!rows,warn:cw,mark:chk.colors?'good':cw?'warn':'todo',title:'Colors',sum:ckColSum(q,q.primaryColor)+(ckSure(c.primaryColor)&&!man?' · '+ckSure(c.primaryColor):''),body:rows+accRow('q',i,q)+shade+(rows?ckLr(q,i,'colors'):'')})}
  // Pattern: Claude's pick and its second choice drawn in the item's colors, then every pattern (the picker)
  if(fab){const p=normPat(q.type,q.pattern),ai=q.aiTag&&q.aiTag.pattern,alt=q.altPattern&&(PATS_BY[q.type]||[]).includes(q.altPattern)?q.altPattern:null,pw=unsure(c.pattern)||(!man&&!!q.newPattern);
    const tiles=[];if(!man){const first=ai&&(PATS_BY[q.type]||[]).includes(ai)?ai:p;tiles.push([first,'Claude’s pick']);if(alt&&alt!==first)tiles.push([alt,'Claude’s 2nd']);if(!tiles.some(t=>t[0]===p))tiles.push([p,'Your choice'])}
    const tile=([v,lab])=>`<button type="button" class="ckpt" role="radio" aria-checked="${v===p}" onclick="setq(${i},'pattern','${v}')"><span class="ckptsw">${swatchSVG(patVar(q,v),true)}</span><b>${esc(cap1(patName(v)))}</b><small>${lab}</small></button>`;
    out.push({k:'pattern',n:true,warn:pw,mark:chk.pattern?'good':pw?'warn':'todo',title:'Pattern',sum:esc(cap1(patName(p)))+(pw&&!chk.pattern?'?':'')+(ckSure(c.pattern)&&!man?' · '+ckSure(c.pattern):''),
      body:(tiles.length?`<div class="ckpts" role="radiogroup" aria-label="Claude’s patterns">${tiles.map(tile).join('')}</div>`:'')+`<label class="colrow">${tiles.length?'All patterns':'Pattern'} ${patBtn('q',i,q)}</label>`+ckLr(q,i,'pattern')})}
  // Fabric & fit (Details for the rest): the per-type fields, the material (with Claude's suggestion) and the swatch's patch of cloth
  const f=(METAL_TYPES.includes(q.type)?`<label>${q.type==='belt'?'Buckle':'Metal'} ${S(metalOptsFor(q.type),q.metal,'metal',i)}</label>`:'')+
    (q.type==='shirt'?`<label>Cuffs ${S(CUFFS,q.cuff||'button','cuff',i)}</label>`:'')+(q.type==='suit'?`<label>Vest ${S(VESTS,(q.vest||(typeof newSuitVest==='function'?newSuitVest():'no'))==='yes'?'yes':'no','vest',i)}</label>`:'')+(SEASON_TYPES.includes(q.type)?`<label>Season ${S(SEASONS,q.season||'all','season',i)}</label>`:'')+
    (q.type==='pants'?`<label>Kind ${S(TROUSER_KINDS,q.trouserKind||'dress','trouserKind',i)}</label>`:'')+(q.type==='shoes'?`<label>Style ${S(SHOE_STYLES,q.shoeStyle||'oxford','shoeStyle',i)}</label>`:'')+(q.type==='shoes'||q.type==='belt'?`<label>${leatherLabel(q)} ${S(leathersFor(q).map(c=>[c,cap1(leatherWord(q,c))]),q.leather||'calf','leather',i)}</label>`:'')+
    (q.type==='watch'?`<label>Dial ${S(DIAL_OPTS(watchOpts(q).dial),watchOpts(q).dial,'dial',i)}</label><label>Band ${S(BANDS,watchOpts(q).band,'band',i)}</label><label>Bezel ${S(BEZELS,watchOpts(q).bezel,'bezel',i)}</label><label>Style ${S(WATCH_STYLES,watchOpts(q).style,'watchStyle',i)}</label>`:'')+
    matRow(q.type,q.material,`setQField(${i},'material',`,q.matAI)+matExtras(q,i);
  const swb=fab&&q.big?`<div class="sw-box"><div id="swatch-img-${i}" class="sw" style="background-image:url(${q.swatch})"></div><div style="flex:1;font-size:13px"><b>Fabric swatch</b><small class="mut" style="display:block">${q.texCanvas?'From the fabric close-up':'From the photo'}: zoom and move it to a clean patch of cloth</small>
    <label>Zoom <input type="range" min="1" max="4" step="0.1" value="${q.zoom||1}" oninput="updateSwatchParam(${i}, 'zoom', this.value)"></label><label>Left–right <input type="range" min="0" max="1" step="0.05" value="${q.cx||0.5}" oninput="updateSwatchParam(${i}, 'cx', this.value)"></label><label>Up–down <input type="range" min="0" max="1" step="0.05" value="${q.cy||0.5}" oninput="updateSwatchParam(${i}, 'cy', this.value)"></label></div></div>`:'';
  if(f||swb){const sug=!!(q.matAI&&q.matAI.key&&q.material===q.matAI.key),bits=[q.material?cap1(matLabel(q.material)):'',SEASON_TYPES.includes(q.type)&&q.season&&q.season!=='all'?optLab(SEASONS,q.season):'',q.type==='suit'?((q.vest||(typeof newSuitVest==='function'?newSuitVest():'no'))==='yes'?'matching vest':'no vest'):''].filter(Boolean);
    // (2026-11-16) suits, blazers and pants ask for their material: empty, the section is "!" (worth a look; never blocks Confirm), with Claude's guess in the summary
    const ask=MAT_ASK.includes(q.type)&&!q.material&&!chk.fabric,g=matGuessOf(q),nm=matNewOf(q);
    const sum=ask?`Material not set${g?` · Claude’s guess: ${g.key}`:nm?` · Claude calls it ${nm.key}`:''}`:sug&&!chk.fabric?`${bits.join(' · ')} · suggested by Claude`:bits.join(' · ')||'Optional';
    out.push({k:'fabric',n:!!f,warn:false,mark:chk.fabric?'good':ask?'warn':sug?'ai':'todo',title:fab?'Fabric &amp; fit':'Details',sum:esc(sum),body:f+swb+(f?ckLr(q,i,'fabric'):'')})}
  // More: name, brand, notes, bought and on the way, how many (not counted)
  const on=k=>`oninput="setQField(${i},'${k}',this.value)"`,named=['name','brand','notes'].filter(k=>q[k]&&String(q[k]).trim()),n=qtyOf(q);
  out.push({k:'more',n:false,warn:false,mark:'opt',title:'More',sum:esc((named.length?cap1(named.join(', '))+' filled in':'Name, brand, notes')+(q.order?' · on the way':' · on the way?')+(n>1?` · ${n} of them`:'')),
    body:`<div class="morein">${fldRow('name','Name',q.name,on,'Optional')}${fldRow('brand','Brand',q.brand,on,'Optional')}${notesRow(q.notes,on)}</div>${orderRow(q,i)}${qtyRow(q,i)}`});
  // open first: Texture match, and whatever Claude was unsure about; with nothing unsure, the first part not checked yet
  const anyWarn=out.some(s=>s.warn&&!chk[s.k]);for(const s of out)if(s.k!=='tex')s.open=s.warn&&!chk[s.k];
  if(!anyWarn){const first=out.find(s=>s.n&&s.k!=='tex'&&!chk[s.k]);if(first)first.open=true}
  return out}
const addCkCount=(q,secs)=>{const c=secs.filter(s=>s.n),n=c.filter(s=>q.checked&&q.checked[s.k]).length;return {n,M:c.length}};
const ckLeftLine=(q,secs)=>{const {n,M}=addCkCount(q,secs||addCkSecs(q,queue.indexOf(q))),left=M-n;return `<p class="ckleft" role="status">${left?`${left} left to check · you can still confirm`:`All ${M} checked · ready to confirm`}</p>`};
/* (a section's first open-or-folded is kept for the card: a section doesn't fold under the finger when a change moves the default) */
function formCard(q,i,inSheet){const secs=addCkSecs(q,i),{n,M}=addCkCount(q,secs),sc='q|'+q.id,sec=k=>{const s=secs.find(x=>x.k===k);if(!s)return '';if(CK_OPEN[sc+'|'+k]===undefined)CK_OPEN[sc+'|'+k]=ckIsOpen(sc,k,s.open);return ckSec(sc,k,s)};
  return `<div class="card qcard ckcard" data-q="${esc(q.id)}">${inSheet?'':`<button type="button" class="qx" aria-label="Close" title="Close" onclick="skipCard('${esc(q.id)}')">×</button><div class="ckhd"><small>New item · check and confirm</small><b>${esc(savedTitle(q))}</b></div>`}`+
    `<div class="ckprog"><b>${n} of ${M} checked</b><span class="cktrack" aria-hidden="true"><i style="width:${M?Math.round(n/M*100):0}%"></i></span></div>`+
    `<div class="ckcols"><div class="ckcol">${q.multi?`<p class="multi-h"><b>Item ${q.multi.n} of ${q.multi.of}</b> <span class="conf ${q.multi.confidence}">${q.multi.confidence} confidence</span></p>`:''}${tagFailNote(q,i)}${unreadNote(q,i)}`+
    `<div class="ckintro"><div class="rv">${q.photo?photoPair(q.photo,q,'tagsw-q'+i):itemThumb(q)}</div>${wbNote(q,i)}<p class="shelp ckhelp">${q.manual||!q.ai?'Pick the type and the colors, then confirm.':'Claude filled these in. Check each part, or fix it.'}</p></div>${tagNotes(q,i)}${sec('tex')}</div>`+
    `<div class="ckcol">${sec('type')}${sec('colors')}${sec('pattern')}${sec('fabric')}${sec('more')}</div></div>`+
    `${inSheet?'':`<div class="ckfoot">${ckLeftLine(q,secs)}<div class="btns">${confBtn(q,i)}<button onclick="skipCard('${esc(q.id)}')">${q.manual?'Cancel':'Skip'}</button></div></div>`}${q.manual?'':`<small class="ckai">${aiLabel(q)}</small>`}</div>`}
const confBtn=(q,i)=>`<button class="pri" id="qconf-${i}" onclick="save('${esc(q.id)}')"${cardReading(q)?' disabled title="Claude is still reading this item"':q.saving||saveAllOn?' disabled':''}>${qtyLabel(q)}</button>`;
/* the cards that are not (yet) a form: being read, a "Several items" photo that couldn't be read, a file that couldn't be opened,
   and a photo nobody read, which asks for its type first */
const busyCard=q=>`<div class="card" data-q="${esc(q.id)}"><span class="spin" aria-hidden="true"></span>${q.multiBusy?`Finding every item in the photo… (this can take up to a minute) <button type="button" onclick="skipCard('${esc(q.id)}')">Cancel</button>`:`Reading the photo…${q.abort?` <button type="button" class="stopread" onclick="stopRead('${esc(q.id)}')">Stop</button>`:''}`}</div>`;
const multiErrCard=q=>`<div class="card" data-q="${esc(q.id)}"><div class="tagfail" role="alert"><p><b>${q.multiCut?'This photo wasn’t read.':'The items in this photo weren’t found.'}</b> ${esc(q.multiErr)}</p></div><div class="btns">${typeof inviteOver==='function'&&inviteOver()?'':`<button type="button" class="pri" onclick="multiAgain('${esc(q.id)}')">Try again</button>`}<button type="button" onclick="skipCard('${esc(q.id)}')">Dismiss</button></div></div>`;
const errCard=q=>`<div class="card" data-q="${esc(q.id)}" role="alert"><p>${q.err==='small'?`This picture is too small to read (${(q.errWh||[]).join('×')} pixels). Use a larger photo of the item.`:'That photo couldn’t be opened. Try a JPEG or PNG, or fill the item in by hand.'}</p><div class="btns"><button type="button" onclick="errToHand('${esc(q.id)}')">Fill it in by hand</button><button type="button" onclick="skipCard('${esc(q.id)}')">Dismiss</button></div></div>`;
function typeCard(q,i){const none=typeof isConnected==='function'?!isConnected():!localStorage.getItem('worker_url');   // (an ended invitation reads nothing either)
  return `<div class="card typeask" data-q="${esc(q.id)}">${tagFailNote(q,i)}${unreadNote(q,i)}<div class="rv">${q.photo?photoPair(q.photo,q,'tagsw-q'+i):''}</div>
<p class="typeq">${none&&!q.tagErr?'<b>What is it?</b> Photos aren’t read automatically here: pick the type and the color is measured from the photo.':'<b>What is it?</b> Pick the type, then check the colors.'}</p>
<label>Type <select onchange="setq(${i},'type',this.value)" aria-label="Type"><option value="" selected disabled>Choose…</option>${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
<div class="btns"><button onclick="skipCard('${esc(q.id)}')">Skip</button></div></div>`}
/* a photo added while the app wasn't connected yet (an invitation still being checked): once it is, the card offers the reading */
const unreadNote=(q,i)=>!q.ai&&!q.manual&&!q.tagErr&&!q.busy&&q.tagImg&&(typeof isConnected==='function'?isConnected():localStorage.getItem('worker_url'))?`<div class="tagfail"><p>This photo was added before the app was connected, so it wasn’t read.</p><button type="button" class="tagfail-btn" onclick="retryTag(${i})">Read it now</button></div>`:'';

/* ---- waiting cards survive iOS closing Safari (audit 2026-11-15, H1: they lived only in memory, beforeunload never fires on an iPhone,
   and reading them again was paid again). Every card on Add is kept in the database's meta store, never synced: the form as `addq`, each
   card's pictures (photo, sharp tagging copy, close-up) once as `addpic:<id>`, written a moment after a change and whenever the app
   goes to the background. At the next start they come back as they were, readings and all; a card whose reading was cut off says so,
   with Try again. A card already saved (its id in the wardrobe) is not brought back. ---- */
const ADDQ_KEY='addq',ADDPIC='addpic:';
/* what is in flight is never kept as it is (audit 2026-11-15 re-run, N3: a card killed while its close-up was read came back with
   `refining` set, "Tagging again with the close-up…" for good, Confirm off and Save all off for every card): a reading cut off is kept as
   cut (busy -> cut, refining -> refineCut, patternReading -> patternCut) and comes back saying so, with a button to read it again */
const ADDQ_SKIP=['raw','big','texCanvas','busy','multiBusy','saving','file','abort','stopped','missed','measV','refining','patternReading','texDone'];   // canvases, the photo file, what is in flight
const ADDQ_PICS=['photo','tagImg','texture','multiPic'];   // (multiPic: a "Several items" photo, kept before it is read)
const ADDQ_SOON=100;   // ms after a change (it was 400: a reload or a crash in that window lost the last change, How many one lower)
let addKeepT=0,addKeptPics=new Map(),addRestoreState='';
function addKeepSoon(){if(addRestoreState!=='done')return;clearTimeout(addKeepT);addKeepT=setTimeout(addKeep,ADDQ_SOON)}
const addKeepable=q=>!!q&&!q.err&&(q.manual||!!q.photo||!!q.multiPic);
function addCardRec(q){const o={};for(const [k,v] of Object.entries(q))if(!ADDQ_SKIP.includes(k)&&!ADDQ_PICS.includes(k))o[k]=v;if(q.busy)o.cut=1;
  if(q.refining)o.refineCut=1;if(q.patternReading)o.patternCut=1;if(q.wb&&!q.wbOff)o.wbWas=1;
  return JSON.parse(JSON.stringify(o,(k,v)=>typeof HTMLCanvasElement!=='undefined'&&v instanceof HTMLCanvasElement?undefined:v))}
async function addKeep(){clearTimeout(addKeepT);if(addRestoreState!=='done')return;
  if(typeof kitQuiet!=='undefined'&&kitQuiet){addKeepSoon();return}   // the sample or an import passes its cards through Add one by one: not kept
  try{const cards=queue.filter(addKeepable),recs=cards.map(addCardRec),pics=[],ids=new Set(cards.map(q=>q.id)),gone=[...addKeptPics.keys()].filter(id=>!ids.has(id));
    for(const q of cards){const was=addKeptPics.get(q.id)||{},p={};let ch=false;for(const k of ADDQ_PICS){p[k]=q[k]||null;if(p[k]!==(was[k]||null))ch=true}if(ch)pics.push([q.id,p])}
    await txs('meta','readwrite',s=>{for(const [id,p] of pics)s.put({k:ADDPIC+id,v:p});for(const id of gone)s.delete(ADDPIC+id);return s.put({k:ADDQ_KEY,v:recs})});
    for(const [id,p] of pics)addKeptPics.set(id,p);for(const id of gone)addKeptPics.delete(id)}
  catch(e){console.warn('Add cards not kept',e)}}
/* the card's canvases again from its kept pictures (already corrected for the light: no Show original on a card brought back) */
async function addRevive(q){
  // a reading of the close-up or the pattern cut off by the kill (records kept before the N3 fix still carry the in-flight flags)
  if(q.refining){delete q.refining;q.refineCut=1}if(q.patternReading){delete q.patternReading;q.patternCut=1}
  // a "Several items" photo: back as a card with Try again (read again by itself once online when it failed for want of a connection)
  if(q.multiPic){q.file=q.multiPic;if(q.cut||!q.multiErr){q.multiErr='The app was closed before this photo was read.';q.multiCut=1}delete q.cut;delete q.busy;return}
  try{if(q.tagImg){const im=await imgOf(q.tagImg);q.raw={big:shrink(im,800),full:shrink(im,TAG_MAX)};q.big=q.raw.big}}catch(e){console.warn('card photo not reopened',e)}
  try{if(q.texture){const im=await imgOf(q.texture),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);q.texCanvas=c;q.raw=q.raw||{};q.raw.tex=c;q.texDone=1}}catch(e){console.warn('close-up not reopened',e)}   // (raw.tex: the close-up can be read again; texDone: already corrected)
  if(q.wb&&!q.wbOff)q.wbWas=1;delete q.wb;delete q.wbOff;   // (wbWas: the card says its colours were corrected, without Show original)
  if(q.cut){delete q.cut;if(!q.ai&&!q.manual)q.tagErr='The app was closed before this photo was read.'}
  if(!q.type&&!q.manual){fill(q,null);q.unread=1;if(q.texCanvas||q.big)generateSwatch(q)}}   // (the fields a card gets when nothing was read)
/* at start-up (safety.js safetyStart): the cards kept last time, back on Add */
async function addRestore(){if(addRestoreState)return;addRestoreState='busy';let n=0;
  try{const recs=await metaGet(ADDQ_KEY);
    if(Array.isArray(recs)&&recs.length){const have=new Set(queue.map(q=>q.id)),saved=new Set(items.map(i=>i.id));
      for(const o of recs){if(!o||!o.id||have.has(o.id)||saved.has(o.id))continue;
        const p=await metaGet(ADDPIC+o.id).catch(()=>null)||{};const q={...o};for(const k of ADDQ_PICS)if(p[k])q[k]=p[k];
        addKeptPics.set(o.id,p);await addRevive(q);queue.push(q);n++}}
    // the pictures of cards saved or dropped since (a kill between the save and the next keep) go
    const old=(await txs('meta','readonly',s=>s.getAllKeys(IDBKeyRange.bound(ADDPIC,'addpic;',false,true))))||[],drop=old.filter(k=>!addKeptPics.has(String(k).slice(ADDPIC.length)));
    if(drop.length)await txs('meta','readwrite',s=>{let r;for(const k of drop)r=s.delete(k);return r})}
  catch(e){console.warn('Add cards not read back',e)}
  addRestoreState='done';
  if(!n){addKeep();return 0}
  addWatch();addKeepSoon();
  const a=$('#add');if(a&&!a.hidden)renderAdd();
  toast(n===1?'The card you hadn’t saved is back on Add.':`The ${n} cards you hadn’t saved are back on Add.`,8000,a&&!a.hidden?null:{label:'Open',fn:()=>openAdd()});
  return n}
/* installed with the first card: keep the cards when the app goes to the background (iOS may close it there), ask before a desktop
   tab closes (safety.js guardUnsaved), and read again, once back online, the photos that failed for want of a connection */
let addWatchOn=false;
function addWatch(){if(addWatchOn)return;addWatchOn=true;if(typeof guardUnsaved==='function')guardUnsaved();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')addKeep()});
  addEventListener('pagehide',()=>addKeep());
  addEventListener('online',addBackOnline)}
function addBackOnline(){if(typeof tagNetText==='function'&&tagNetText(aiError))aiError='';
  for(const q of queue.slice())if(q.tagNet&&q.tagErr&&!q.busy&&q.tagImg)retryTag(queue.indexOf(q));
  for(const q of queue.slice())if(q.multiNet&&q.multiErr&&!q.busy&&q.file)multiAgain(q.id);   // "Several items" too (it waited for a tap)
  const a=$('#add');if(a&&!a.hidden)renderAdd()}

