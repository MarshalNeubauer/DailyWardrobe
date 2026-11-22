/* Daily Wardrobe: Add, the cards kept when the app is closed (split from add.js, Round C 2026-11-17): every card's form and
   pictures in the database's meta store, brought back at the next start (addRestore, addRevive), and the listeners that keep them. */

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
