/* Daily Wardrobe: the Add page: photo cards (white balance, close-ups, pasted photos and links, several items in one photo), typing an item in by hand, saving
   (An ES module since 2026-11-23, at its place in index.html's order; split out of app.js on 2026-11-14.) */
/* Its other parts (Round C, 2026-11-17: split by job, no behavior change), loaded right after it in index.html's order:
   add-paste.js (pasted photos, photo links, drag & drop), add-card.js (a card's fields and its drawing: setq, the shade rows, the
   checklist's sections, formCard), add-more.js (How many, Bought on the way and its Arrives date, checkArrivals), add-sheet.js (Today's
   "Add one" type and the "Add without a photo" sheet), sheet-swipe.js (sheetSwipe: the swipe down of every sheet), add-save.js (Confirm
   and Save all) and add-keep.js (the cards kept when the app is closed). This file keeps the photos (white balance, close-ups, One
   item, Several items, reading again once online), the double-tap guard and renderAdd. */
/* ---- automatic white balance (wbRead/wbGains in measure.js): the light's colour is read from the brightest near-neutral pixels (a white wall, backdrop,
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
function toggleWb(i){const q=cardOf(i);if(!q||!q.raw)return;q.wbOff=!q.wbOff;cardPics(q);renderAdd()}
/* a picture too small to read (an 8×8 thumbnail was sent to Claude and became the item's photo: audit 2026-11-15): refused before any reading */
const ADD_MIN_PX=32;
const TEX_MIN_PX=200;
const TEX_MAX=1536;   // the synced close-up (2026-11-13, the owner: "the zoom-in pictures are still stored at 640"): as sharp as the device-only copy (CLOSE_MAX), now that photos are stored one by one on the server and fetched when needed (it was 640)
/* the fabric close-up for an Add card: corrected with the same light reading as the card's item photo (taken together) */
/* read: the close-up came through "Add close-up and read texture/color" (colpick.js rdStart), whose reading replaces the automatic
   re-tag (the owner: no second paid call); the color is still measured from it (measureCard) */
async function addTexture(i,f,read){const q=cardOf(i);if(!q||!f)return;
  try{const img=await loadImg(f);
    if(Math.min(img.width,img.height)<TEX_MIN_PX){toast(`That close-up is too small to show the weave (${img.width}×${img.height} pixels). Take it close to the cloth, at full size.`,6000);return}
    q.raw=q.raw||{};delete q.texDone;delete q.refineCut;delete q.patternCut;q.raw.tex=shrink(img,Math.max(TEX_MAX,CLOSE_MAX));q.texCanvas=applyWb(q.raw.tex,texGains(q));q.texture=q.texCanvas.toDataURL('image/jpeg',.85);q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);q.refineNote='';renderAdd();
    if(read){measureCard(q);renderAdd();if(typeof addKeep==='function')addKeep();return}
    refineFromCloseup(queue.indexOf(q))}   // tag again with both photos (tagging.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
function dropTexture(i){const q=cardOf(i);if(!q)return;if(typeof readAbort==='function')readAbort(q);delete q.texture;delete q.texCanvas;delete q.texDone;delete q.refineCut;delete q.patternCut;q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);if(q.raw)delete q.raw.tex;q.refineNote='';measureCard(q);renderAdd()}
/* (the close-up step of a card, "Step 2 · Fabric close-up", is now the checklist's Texture match section: addCkSecs below) */
const wbNote=(q,i)=>q.wb&&q.raw?`<p class="wbnote mut"><small>${q.wbOff?'Original colors.':'Colors corrected for the light.'}</small> <button type="button" class="linkbtn" data-act="cardWb" ${cardAt(q)}>${q.wbOff?'Correct them':'Show original'}</button></p>`
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
      const out={},aiResult=await ask(q.tagImg,{wb:!!(q.wb&&!q.wbOff),out,...(ac?{signal:ac.signal}:{})});q.abort=null;   // wb: whether the photo was white-balanced (the tagger is told)
      if(q.stopped){delete q.stopped;fill(q,null);q.unread=1;q.tagErr=STOPPED}
      else{fill(q,aiResult);if(aiResult){takeExtras(q,aiResult);measureAndApply(q)}else{q.unread=1;tagFailed(q,out.err)}}   // out.err: this card's own reason (CR-2-07)
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
function refineAgain(i){const q=cardOf(i);if(!q)return;if(!(isConnected())){toast('Connect in ⚙ Settings first.',4000);return}
  delete q.refineCut;delete q.patternCut;refineFromCloseup(queue.indexOf(q))}
function patternAgain(i){const q=cardOf(i);if(!q)return;if(!(isConnected())){toast('Connect in ⚙ Settings first.',4000);return}
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
/* the colour is then measured from the middle of the photo (measureCloth, measure.js) once the type is known */
function measureGuess(q){if(!q||!q.raw||!q.raw.big||(q.edited&&q.edited.primaryColor)||typeof measureCloth!=='function')return;
  try{const m=measureCloth(q.raw.big,q.clothBox||null,{gains:q.wbOff?null:q.wb}),n=nearestCols(q.type,m.lab,false)[0];if(n&&COLORS[n.c])q.primaryColor=n.c}catch(e){console.warn('color not measured',e)}}
/* an image that couldn't be opened can still be added by hand */
function errToHand(id){const q=queue.find(x=>x.id===id);if(!q)return;const wo=watchOpts({});
  for(const k of ['err','errWh','busy'])delete q[k];Object.assign(q,{manual:true,type:'suit',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf',dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style});renderAdd()}
/* Skip, Cancel and Dismiss find their card by its id: by its place, a double tap skipped the next card too */
function skipCard(id){const k=queue.findIndex(q=>q.id===id);if(k<0)return;const q=queue[k];if(q.abort)try{q.abort.abort()}catch{}if(typeof readAbort==='function')readAbort(q);queue.splice(k,1);   // (readAbort: tagging again and the pattern reading too, CR-2-10)
  if((q.multiBusy||q.multiErr)&&!queue.some(x=>x.multi||x.multiBusy||x.multiErr))multiNote(false);   // "Each item in the photo gets its own card…" stayed over no card
  renderAdd()}

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
      body:JSON.stringify({image:img.toDataURL('image/jpeg',.9),types:tagTypesNow(),custom:customForTag(),corrections:tagFixes(),wb:!!wb}),...(ac?{signal:ac.signal}:{})});
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
  const ready=queue.filter(cardReady).length,reading=queue.some(cardReading);if($('#save-all'))$('#save-all').innerHTML=ready>1?`<button class="btn pri" data-act="saveAllTap"${reading||saveAllOn?` disabled title="${saveAllOn?'Saving…':'Claude is still reading a card'}"`:''}>${saveAllOn?'Saving…':`Save all ${ready} items`}</button>`:'';
  if(typeof addGate==='function')addGate();
  addKeepSoon();
  if($('#queue')){keepFocus($('#queue'),()=>{$('#queue').innerHTML=queue.map((q,i)=>q.id===npsId?'':cardSafe(q,i,()=>q.busy?busyCard(q):q.multiErr?multiErrCard(q):q.err?errCard(q):needType(q)?typeCard(q,i):formCard(q,i))).join('')});   // (the field changed keeps the keyboard: W2-19-01)
    if(typeof cmpMount==='function')cmpMount($('#queue'))}
  if(npsId)npsDraw();
  if(typeof colPick!=='undefined'&&colPick&&colPick.src==='q'&&!cardOf(colPick.ref))closeColPick();   // the color or pattern sheet of a card that went (CR-1-02)
}
function addBackOnline(){if(typeof tagNetText==='function'&&tagNetText(aiError))aiError='';
  for(const q of queue.slice())if(q.tagNet&&q.tagErr&&!q.busy&&q.tagImg)retryTag(queue.indexOf(q));
  for(const q of queue.slice())if(q.multiNet&&q.multiErr&&!q.busy&&q.file)multiAgain(q.id);   // "Several items" too (it waited for a tap)
  const a=$('#add');if(a&&!a.hidden)renderAdd()}
/* what its controls do (act.js): a card's "Show original" / "Correct them" (the card by its id: add-save.js cardIx), and Save all */
function cardWb(el){toggleWb(cardIx(el))}
function saveAllTap(){saveAll()}
/* the markup's handler (act.js): the photos picked with "One item" or "Several items" (data-multi), the field emptied so the same
   photo can be picked again */
function addPhotosPick(el){addFiles([...el.files],el.dataset.multi==='1');el.value=''}
/* the bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use as globals. Above the file's
   one top-level call that can throw (acts, when act.js did not load): the names are then still the page's */
Object.assign(globalThis,{applyWb,cardPics,TEX_MIN_PX,TEX_MAX,addTexture,dropTexture,wbNote,addFiles,STOPPED,stopRead,refineAgain,patternAgain,needType,measureGuess,errToHand,skipCard,multiMsg,PAIR_TYPES,countWord,multiAgain,addNoteText,renderAdd,addBackOnline});
Object.defineProperties(globalThis,{addCalm:{get:()=>addCalm}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,addNoteText,cardPics,countWord};
export {applyWb,cardPics,TEX_MIN_PX,TEX_MAX,addTexture,dropTexture,wbNote,addFiles,STOPPED,stopRead,refineAgain,patternAgain,addCalm,needType,measureGuess,errToHand,skipCard,multiMsg,PAIR_TYPES,countWord,multiAgain,addNoteText,renderAdd,addBackOnline};
acts({cardWb,saveAllTap,addPhotosPick});
