/* Daily Wardrobe: getting started (2026-11-14, the owner's ask after the audit's new-user walkthrough). Loaded before setup.js (the restructure S3f, 2026-11-26: setup.js draws its Home Screen step and its last step from this file).
   - the quick tour: four short cards on the score, the close-up, Shade and patterns (tourOpen); shown once to a new user between the
     setup and the first Add, offered on the setup's last step, on Today's first-outfit checklist and in Settings → About
   - the close-up guide: how to take a good close-up, with white paper along one edge (kitCloseupGuide), from the Add card's close-up step
     and the item sheet's photo tools
   - Undo after Confirm on Add (kitSaved, called by app.js save): the item comes out of the wardrobe and its card goes back on Add
   - Duplicate on the item sheet (kitDuplicate): a second identical piece, opened for any difference
   - import from a spreadsheet (kitImportOpen): CSV or rows pasted from Excel or Google Sheets, a template to fill in, a preview before
     anything is saved, each row saved as an item added by hand would be (app.js save), with Undo
   - a sample wardrobe to try the app with (kitSampleLoad): 22 pieces marked sample, a note on Today while they are there, removed in one tap */

/* ---- one sheet for the tour and the guide: cards with a picture, Back and Next, the last one closes it ---- */
import {$,COLORS,CUSTOM_COL,CUSTOM_PAT,MATERIALS_BY,METAL_TYPES,PATS_BY,PAT_ALIAS,SEASON_TYPES,SHIRT_WEAVE_MAT,TYPES,accentsFor,accentsOf,colName,colsFor,dayRecs,dressOut,fitCol,hasPat,itemFields,itemName,itemTitle,items,leatherWord,leathersFor,matAlias,mergeState,metalWord,nextStamp,normCol,nowMs,patLabel,patName,sentence,setWardrobe,settings,shortDesc,todayDate,typeWord,watchOpts,wearsJacket,wearsTie} from './core.js';
import {askConfirm,inviteOver,isConnected,layerInert,noMotion} from './ui.js';
import {backBorrow,backOn,backPush,backReturn} from './back.js';
import {closeSettings,openSettings,refreshToday,todayDirty} from './settings.js';
import {toast} from './toast.js';
import {cap1,dbMark,dbRetry,metaGet,put,queue,tx,txFail} from './app.js';
import {planDirty} from './today-plan.js';
import {esc} from './photo-keys.js';
import {swatchSVG} from './draw.js';
import {openAdd,show} from './nav.js';
import {keyDate} from './days.js';
import {acts} from './act.js';
let kit=null;   // {cards, at, then}
let kitImpBusy=false;   // an import being written (kitImportGo)
const KIT_TOUR='tour_seen';
const tourSeen=()=>{try{return localStorage.getItem(KIT_TOUR)==='1'}catch{return false}};
function kitEl(){let e=$('#kitsheet');if(!e){e=document.createElement('div');e.id='kitsheet';e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');e.setAttribute('aria-labelledby','kit-title');document.body.appendChild(e)}return e}
function kitInert(on){for(const el of document.querySelectorAll('body>header,main,body>nav'))el.inert=on;if(!on)layerInert()}
/* the phone's Back closes the sheet (fix round 2, 2026-11-15: it left the app from the tour and the Home Screen sheet, and closed Add
   under the import sheet): the sheet takes a history entry (back.js kind 'kit'), or borrows Add's (kitHist keeps whose it was) */
function kitHist(){if(kit&&kit.hist===undefined)kit.hist=backBorrow('kit')}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setKitNoMine(v){kitNoMine=v}
/* An ES module since 2026-11-23. The bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use
   as globals. Above the file's first top-level call that can throw (backOn): its functions are then still the page's. A getter reads its
   `let` when asked, so the ones declared below are here too; the consts declared below are handed over above homeAbout() */
Object.assign(globalThis,{tourSeen,kitOpen,kitClose,tourOpen,kitSaved,kitDuplicate,kitImportOpen,kitFixOldImports,kitSampleMigrate,kitSampleLoad,kitShareDone,kitShareFilter,kitSampleBanner,homeSteps,safariRemind,homeOpen,homeAbout,setKitNoMine});
Object.defineProperties(globalThis,{kit:{get:()=>kit},kitQuiet:{get:()=>kitQuiet},kitNoMine:{get:()=>kitNoMine,set:v=>{kitNoMine=v}}});
/* the notice board (bus.js): "Try a sample wardrobe" on an empty Insights or Packing list (stats.js no longer names this file) */
import {on} from './bus.js';
on('sample-asked',kitSampleLoad);
backOn('kit',()=>{if(kit)kitClose(true)});
function kitOpen(cards,then){const prev=kit?kit.hist:undefined;kit={cards,at:0,then:then||null,from:document.activeElement};if(prev!==undefined)kit.hist=prev;kitBs(false);kitDraw();kitEl().classList.add('on');kitInert(true);kitHist();
  const t=$('#kit-next');if(t)t.focus({preventScroll:true})}
/* fromBack: the phone's Back did it (its entry is gone already) */
function kitClose(fromBack){if(kitImpBusy){if(fromBack)backPush('kit');return}   // (the import is being written: a moment, then the sheet closes itself; Back keeps it, with its entry made again)
  const e=$('#kitsheet');if(e){const bs=e.classList.contains('kbs');e.classList.remove('on');if(bs)kitBsAway(e);else e.innerHTML=''}const k=kit;kit=null;kitInert(false);
  if(k&&k.hist!==undefined)backReturn('kit',k.hist,fromBack);   // the entry goes, or back to Add; after Back, Add gets a new one
  if(k&&k.cards===TOUR_CARDS){try{localStorage.setItem(KIT_TOUR,'1')}catch{}}
  if(k&&k.then)k.then();else if(k&&k.from&&k.from.isConnected)try{k.from.focus({preventScroll:true})}catch{}}
/* a tap on Next or Back within KIT_TAP_MS of the last one is the second tap of a double tap (fix round 3, W2-14-06: a double tap skipped
   the close-up card, a second one closed the tour); keys and taps from code are not held back */
const KIT_TAP_MS=350;
function kitGo(n){if(!kit)return;const ev=window.event,tap=!!(ev&&ev.isTrusted&&ev.type==='click'&&ev.detail>0),now=performance.now();
  if(tap){if(now-(kit.tapAt||-1e9)<KIT_TAP_MS)return;kit.tapAt=now}
  const at=kit.at+n;if(at>=kit.cards.length)return kitClose();if(at<0)return;kit.at=at;kitDraw();const t=$('#kit-next');if(t)t.focus({preventScroll:true})}
function kitDraw(){if(!kit)return;const c=kit.cards[kit.at],n=kit.cards.length,last=kit.at===n-1;
  kitEl().innerHTML=`<div class="kit-head"><div><h2 id="kit-title">${c.title}</h2>${n>1?`<small>${kit.at+1} of ${n}</small>`:''}</div><button type="button" class="kit-x" data-act="kitShut" aria-label="Close">✕</button></div>
${n>1?`<div class="su-prog kit-prog" aria-hidden="true">${kit.cards.map((x,i)=>`<i class="${i<=kit.at?'on':''}"></i>`).join('')}</div>`:''}
<div class="kit-body" data-card="${c.key}">${kit.lead&&!kit.at?`<p class="kit-lead">${kit.lead}</p>`:''}<div class="kit-pic" aria-hidden="true">${c.pic()}</div>${c.body}</div>
<div class="kit-bar">${kit.at?`<button type="button" id="kit-back" data-act="kitBackTap">Back</button>`:''}<button type="button" class="pri" id="kit-next" data-act="kitNextTap">${last?(kit.lastLabel||c.last||'Got it'):'Next'}</button></div>`}
/* the sheet's controls (act.js): ✕ and Cancel, Back and Next (kitGo reads the tap from window.event, which is the click here too), and
   the tour's and the paper tip's link to the close-up guide */
function kitShut(){kitClose()}
function kitBackTap(){kitGo(-1)}
function kitNextTap(){kitGo(1)}
function kitGuideTap(){kitClose();kitCloseupGuide()}
// ← → step the cards only: not in the import (no cards: → closed it and lost the pasted rows) nor while typing in a field (re-audit 2026-11-15)
addEventListener('keydown',e=>{if(!kit)return;if(e.key==='Escape'){e.preventDefault();kitClose();return}
  if(!kit.cards.length||(e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]')))return;
  if(e.key==='ArrowRight')kitGo(1);else if(e.key==='ArrowLeft')kitGo(-1)});

/* the pictures: drawn, in the app's own colours (no photos to download) */
/* the tour speaks of what this person wears (audit 2026-11-15: ties and suits to someone who wears neither) */
const kitWears=k=>k==='tie'?wearsTie():wearsJacket();
const kitScorePic=()=>`<svg viewBox="0 0 300 150"><rect x="20" y="22" width="260" height="62" rx="14" class="kp-card"/><rect x="34" y="34" width="70" height="38" rx="10" class="kp-good"/><text x="69" y="60" class="kp-num">96</text><text x="118" y="50" class="kp-t">Excellent</text><text x="118" y="70" class="kp-s">Outfit score · tap for why</text>
<rect x="20" y="96" width="260" height="38" rx="10" class="kp-card"/><text x="34" y="120" class="kp-s">−2</text><text x="62" y="120" class="kp-t2">The same ${kitWears('tie')?'tie':'shirt'} color as yesterday</text></svg>`;
const kitClothPic=(paper=true,box=true)=>`<svg viewBox="0 0 200 260"><defs><pattern id="kp-weave" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#3b4256"/><path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke="#4b5370" stroke-width="1.6"/></pattern></defs>
<rect x="10" y="10" width="180" height="240" rx="12" fill="url(#kp-weave)"/>${paper?`<path d="M10 204 H190 V238 A12 12 0 0 1 178 250 H22 A12 12 0 0 1 10 238 Z" fill="#f4f3ef"/>`:''}
${box?`<rect x="37" y="46" width="126" height="148" rx="3" fill="none" stroke="#efb446" stroke-width="2.4" stroke-dasharray="7 5"/>`:''}</svg>`;
const kitShadePic=()=>{const s=['#2c3d66','#253558','#1f2d4a','#19253d','#131c30'];return `<svg viewBox="0 0 300 120">${s.map((c,i)=>`<rect x="${22+i*52}" y="${i===2?18:26}" width="${i===2?50:44}" height="${i===2?60:44}" rx="9" fill="${c}"${i===2?' class="kp-sel"':''}/>`).join('')}
<text x="47" y="104" class="kp-s" text-anchor="middle">lighter</text><text x="150" y="104" class="kp-t2" text-anchor="middle">as tagged</text><text x="253" y="104" class="kp-s" text-anchor="middle">darker</text></svg>`};
const kitPatternPic=()=>`<svg viewBox="0 0 300 150"><defs><pattern id="kp-gen" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#2a3047"/><rect x="6" width="2" height="14" fill="#8d93a8"/></pattern>
<pattern id="kp-read" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#2b2733"/><rect x="5" width="1.2" height="22" fill="#9a8fa6"/><rect x="15" width="1.2" height="22" fill="#7d4a59"/></pattern></defs>
<rect x="22" y="14" width="116" height="100" rx="12" fill="url(#kp-gen)"/><rect x="162" y="14" width="116" height="100" rx="12" fill="url(#kp-read)"/>
<text x="80" y="136" class="kp-s" text-anchor="middle">generic pinstripe</text><text x="220" y="136" class="kp-t2" text-anchor="middle">read from your cloth</text></svg>`;

/* ---- the quick tour ---- */
const TOUR_CARDS=[
  {key:'score',title:'The score',pic:kitScorePic,get body(){return `<p>Every outfit gets a score out of 100.</p><p>Points come off only for things you can put right: shoes that don't suit the ${kitWears('jacket')?'suit':'pants'}, a color worn two days running, socks lighter than the pants.</p><p class="kit-tip">Tap the score on Today to see why, and the swaps that would raise it.</p>`}},
  {key:'closeup',title:'The close-up',pic:()=>kitClothPic(true,false),body:`<p>After the photo of the whole piece, take one close-up of the cloth: hold the phone close so the weave fills the screen.</p><p>It gives the true color and the real size of the pattern. A sheet of plain white paper along one edge lets the app correct for the light: tap the paper on the camera screen before you take the picture.</p><p><button type="button" class="linkbtn" data-act="kitGuideTap">How to take a good close-up</button></p>`},
  {key:'shade',title:'Shade',pic:kitShadePic,body:`<p>If a piece is drawn lighter or darker than the real thing, Shade nudges it, up to six steps either way.</p><p><b>Match close-up</b> sets it from your close-up for you.</p><p class="kit-tip">Shade changes only the drawing. The color the planner matches stays the one you tagged.</p>`},
  {key:'patterns',title:'Patterns',pic:kitPatternPic,body:`<p>Stripes, checks and weaves are read too.</p><p>With a close-up the app measures the stripes' widths and colors, so the drawing and the outfit pictures show your cloth, not a generic one.</p><p class="kit-tip">If a reading looks wrong, tap <b>Use the simple pattern</b> on the card, or <b>Read pattern from photo</b> on the item later.</p>`}];
/* then: what happens after the last card (the setup's "Add my first item" goes on to Add) */
/* lastLabel: the setup's "Add my first item" opens the tour first; its first card says so (fix round 3, W2-14-07: the button promised Add
   and a tour came up) */
function tourOpen(then,lastLabel){kitOpen(TOUR_CARDS,then);if(lastLabel){kit.lastLabel=lastLabel;kit.lead=`First, four quick cards about how the app works. Then you add your first item (✕ skips straight there).`;kitDraw()}}
/* Settings → About's "Take the tour" and "Add to Home Screen": closing the sheet goes back to About, not to Today (audit 2026-11-15) */
function tourAgain(){closeSettings();tourOpen(()=>openSettings('about'))}
function homeAgain(){closeSettings();kitOpen([HOME_CARD],()=>openSettings('about'))}

/* ---- the close-up guide ---- */
const GUIDE_CARD={key:'guide',title:'A good close-up',pic:()=>kitClothPic(true,true),last:'Got it',body:`<ol class="kit-list">
<li><b>Fill the screen with cloth.</b> Hold the phone a hand's width away, straight down, so the weave is sharp.</li>
<li><b>Lay plain white paper along one edge</b>, about a fifth of the picture, on the cloth or right beside it. Keep it out of the middle: the middle (dashed) is where the color is measured.</li>
<li><b>Same light on both.</b> Daylight or room light; no flash, no patch of sun, no shadow of your phone across the paper.</li>
<li><b>Tap the paper on the camera screen</b> before you take the picture. The phone sets its exposure there, so the paper comes out white instead of glowing, and the app can read the light from it.</li></ol>
<p class="kit-tip">No paper? It still works: the color is then corrected like the main photo, and lightness counts for less.</p>`};
function kitCloseupGuide(){kitOpen([GUIDE_CARD])}
/* the short white-paper tip (photo-wb-mockups variant B's words), opened from the drawing beside the item sheet's close-up hint (paperTip) */
const PAPER_CARD={key:'paper',title:'White paper, true colors',pic:()=>kitClothPic(true,true),last:'Got it',body:`<p>Lay a sheet of plain white paper along one edge of the cloth, about a fifth of the picture.</p>
<p>Tap the paper on the camera screen, then take the picture. The app reads the light from the paper, so the color comes out true, even under warm lamps.</p>
<p><button type="button" class="linkbtn" data-act="kitGuideTap">Tips for a good close-up</button></p>`};

/* ---- Undo after Confirm (app.js save calls this for each card saved) ----
   Cards saved within a moment of each other (Save all, an import) are one Undo. Undo takes the items out (a tombstone each, as Delete
   does) and puts their cards back on Add, in their places */
let kitBatch=null,kitQuiet=false;
const KIT_UNDO_MS=8000;
function kitSaved(it,q,i,copies){if(kitQuiet)return;const now=Date.now(),more=(copies||[]).map(c=>c.id);
  if(!kitBatch||now-kitBatch.at>1500)kitBatch={its:[],qs:[],at:now};kitBatch.its.push(it.id,...more);kitBatch.qs.push({q,i});kitBatch.at=now;const b=kitBatch,n=b.its.length;
  // one card with copies (add-more.js qtyRow): "Saved 3: White."
  const t=savedTitle(it);   // "Saved: Grey suit." (it said "Saved: Grey.": add-save.js)
  toast(n===1?`Saved: ${t}.`:b.qs.length===1?`Saved ${n}: ${t}.`:`Saved ${n} items.`,KIT_UNDO_MS,{label:'Undo',fn:()=>kitUnsave(b)})}
async function kitUnsave(b){if(!b)return;
  if(b.its.length>30)toast(`Taking out ${b.its.length} items…`,15000);   // (an import's Undo: said at once, done in one go)
  // the cards go back on Add and are kept (add-keep.js addKeep) BEFORE the items are deleted: deleted first, a kill within the keep's timer
  // lost the item from both (audit 2026-11-15 re-run); a kill between the two leaves the items, and the kept cards of saved items are dropped
  const back=[];for(const {q,i} of b.qs.slice().reverse()){if(!q||queue.includes(q))continue;delete q.busy;queue.splice(Math.min(i,queue.length),0,q);back.push(q)}
  for(const q of back)if(!q.raw)await addRevive(q);   // its canvases, let go when it was saved (add-save.js saveCard): the swatch box and the close-up's reading come back (CR-1-03)
  if(back.length)await addKeep();
  try{await kitDelMany(b.its,b.olds||[])}catch(e){for(const q of back){const k=queue.indexOf(q);if(k>=0)queue.splice(k,1)}if(back.length)addKeep();throw e}
  if(kitBatch===b)kitBatch=null;planDirty();todayDirty();if(b.qs.length)multiMsg('');   // ("Saved 5 items to your wardrobe." stayed over the cards Undo brought back)
  if(b.qs.length&&$('#add')&&!$('#add').hidden)renderAdd();else if($('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  const ol=(b.olds||[]).length;   // (b.olds: pieces an import updated, put back as they were)
  toast(ol?`Undone: ${b.its.length?`${b.its.length} item${b.its.length===1?'':'s'} taken out, `:''}${ol} piece${ol===1?'':'s'} as ${ol===1?'it was':'they were'}.`:b.its.length===1?'Undone: the item is back on Add.':`Undone: ${b.its.length} items taken out.`,3000)}

/* ---- many items at once (the import, the sample, their Undo and removal), each in ONE transaction (2026-11-15, the new-user audit:
   saved or deleted one by one, a double tap ran the loop twice, iOS killing Safari part-way left part of an import or a sample, and
   500 rows took 18 s). The items, their tombstones and any day records go together: all of it is stored, or none. ---- */
const kitTx=(stores,f)=>dbRetry('readwrite',d=>new Promise((ok,no)=>{const t=d.transaction(stores,'readwrite');t.onerror=t.onabort=txFail(t,no,'readwrite');
  try{f(t)}catch(e){try{t.abort()}catch{}no(dbMark(e,'readwrite'));return}t.oncomplete=()=>ok()}));   // (a write that throws part-way stores none of it)
function kitTombs(t,ids,now){if(!ids.length)return;const m=t.objectStore('meta'),q=m.get('tombstones');
  q.onsuccess=()=>{const v={...(q.result&&q.result.v||{})};for(const id of ids)v[id]=Math.max(v[id]||0,now);m.put({k:'tombstones',v})}}
/* a failed write is said, as Confirm says it (add-save.js save) */
function kitFail(e){console.warn('save failed',e);if(storeFailure(e))saveFailed(e);else toast('Couldn’t save: '+String(e&&e.message||e).replace(/\.$/,'')+'. Try again.',7000)}
/* an item made from a card with no photo, as add-save.js saveCard makes one (a hand-added card: the fields it keeps for each type) */
function kitItem(c){const f=hasPat(c.type),it={id:c.id||crypto.randomUUID(),type:c.type,primaryColor:c.primaryColor,secondaryColor:c.secondaryColor||null,tertiaryColor:c.tertiaryColor||null,pattern:f?c.pattern||'solid':'solid',added:nowMs()};
  {const a=accentsOf(c);if(a.length)it.accents=a}   // an import's "Also has" colours
  // socks (2026-11-17): a plain sock's second colour is its toe cap, as a spreadsheet and the sample have always meant it; a patterned
  // sock's is its pattern's (a card set by hand on Add already has toeColor)
  if(c.type==='socks'){if(c.toeColor!==undefined)it.toeColor=c.toeColor&&COLORS[c.toeColor]?c.toeColor:'none';else{const plain=it.pattern==='solid';it.toeColor=plain&&it.secondaryColor&&COLORS[it.secondaryColor]?it.secondaryColor:'none';if(plain){it.secondaryColor=null;it.tertiaryColor=null}}}
  if(METAL_TYPES.includes(c.type))it.metal=c.metal||'silver';
  if(c.type==='shirt')it.cuff=c.cuff==='french'?'french':'button';
  if(c.type==='suit')it.vest=c.vest==='yes'?'yes':'no';
  if(SEASON_TYPES.includes(c.type)&&c.season&&c.season!=='all')it.season=c.season;
  if(c.type==='shoes'||c.type==='belt')it.leather=c.leather||'calf';
  if(c.type==='pants'&&(c.trouserKind==='chinos'||c.trouserKind==='jeans'||c.trouserKind==='cargo'))it.trouserKind=c.trouserKind;
  if(c.type==='shoes'&&c.shoeStyle&&c.shoeStyle!=='oxford')it.shoeStyle=c.shoeStyle;
  if(c.type==='watch'){const wo=watchOpts(c);Object.assign(it,{dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style})}
  wardSaveFields(c,it);   // name, brand, material, notes (wardrobe.js)
  if(c.sample)it.sample=true;return it}
/* store new items, and changed ones (upd: the import's updates) in the same transaction (false, said, when storage refused them: nothing was
   stored); an updated piece is stamped as put() stamps an edit (core.js itemFields against the stored copy: only the fields the import changed
   get the new stamp, so they merge field by field with another phone's edits) */
async function kitStore(list,prog,upd){upd=upd||[];if(!list.length&&!upd.length)return true;const now=nowMs();let k=0;
  try{await kitTx(['items'],t=>{const s=t.objectStore('items');for(const it of list){it.updated=now;const r=s.put(it);if(prog)r.onsuccess=()=>prog(++k,list.length)}
    for(const it of upd){it.updated=nextStamp(stamp(it));const g=s.get(it.id);g.onsuccess=()=>{itemFields(it,g.result);s.put(it)}}})}catch(e){kitFail(e);return false}
  items.push(...list);for(const it of upd){const j=items.findIndex(x=>x.id===it.id);if(j>=0)items[j]=it}planDirty();todayDirty();if(list.length)dressNewItem();
  if(window.scheduleSync)scheduleSync();askPersist();return true}
/* delete items (each with a tombstone, as Delete does), with changed items (put) and day records (days) in the same transaction */
async function kitDelMany(ids,put=[],days=[]){ids=[...new Set(ids)];const now=nowMs(),gone=new Set(ids);
  await kitTx(['items','meta','days'],t=>{const s=t.objectStore('items');for(const id of ids)s.delete(id);for(const it of put){it.updated=now;s.put(it)}
    const d=t.objectStore('days');for(const r of days){if(r.updated!==KIT_YIELD)r.updated=now;delete r.lockOnly;delete r.base;d.put(r)}kitTombs(t,ids,now)});   // (KIT_YIELD: a sample-only day keeps its stamp of 1, kitSampleRemove)
  setWardrobe({items:items.filter(x=>!gone.has(x.id))});for(const it of put){const k=items.findIndex(x=>x.id===it.id);if(k>=0)items[k]=it}
  for(const r of days)dayRecs[r.date]=r;planDirty();todayDirty();if(window.scheduleSync)scheduleSync()}

/* ---- Duplicate (the item sheet): the same piece again, with a new id and no history, opened for any difference ---- */
const KIT_NO_COPY=['id','added','updated','paused','order','arrives','away','cleaned','cleans','sample','sampleMine'];
async function kitDuplicate(id){const it=items.find(x=>x.id===id);if(!it)return;const c=JSON.parse(JSON.stringify(it));for(const k of KIT_NO_COPY)delete c[k];
  c.id=crypto.randomUUID();c.added=nowMs();await put(c);items.push(c);planDirty();todayDirty();
  if($('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  openItem(c.id);toast('Duplicated. Change anything that differs, like its name.',3500)}

/* ---- import from a spreadsheet ----
   A CSV file (Excel, Numbers and Google Sheets all save one) or rows pasted straight from the spreadsheet (tab-separated). The first row
   names the columns, in any order and case; only Type and Colour are needed. Words are matched to the app's own lists: type names, plurals
   and common words for them (trousers, pants, slacks, chinos, jeans; necktie; tie bar; loafers; blazers…), colour names as the app shows
   them and everyday ones (sky blue, charcoal grey, maroon: core.js COL_ALIAS), the owner's own colours by name, pattern names. A colour a
   type isn't offered in moves to the nearest one it is (fitCol), and the preview says so. A row that can't be read is shown with why and
   left out; a row matching a piece already in the wardrobe is shown unticked (2026-11-15, the new-user audit).
   Fix round 3 (2026-11-16, the third audit: W2-15-01..07, W2-12-05, W2-16-06, W2-18-04): a Description / Details / Item column, Notes and
   the name are read for the pattern, the trousers' kind, the shoes' style, a three-piece suit, French cuffs and the material when their own
   columns don't say; words of a description left over become the name (or go to the notes when the row has a name); the preview names the
   columns it didn't use; a Qty column or "x3" makes that many pieces; the column names may sit under a title row; a list with no column
   names ("Navy suit", "White shirt x3") is read line by line; "lt."/"dk", "brn", "wht" and the like, small typos ("Shrit") and Arabic type
   and color words are read; long fields are cut to what is kept, and the preview says so. */
const KIT_COLS={type:['type','category','item type','type of item','kind of item','clothing type','clothing','clothes','garment','piece','article','what','item','النوع','الصنف','القطعه'],
  primaryColor:['colour','color','colours','colors','main colour','main color','primary colour','primary color','colour 1','color 1','اللون','الالوان'],
  secondaryColor:['second colour','second color','secondary colour','secondary color','colour 2','color 2'],tertiaryColor:['third colour','third color','colour 3','color 3'],
  accents:['also has','accent colors','accent colours','accent color','accent colour','accents','other colors','other colours','more colors','more colours'],   // (2026-11-16) up to 4 more colours, in one cell
  pattern:['pattern','patterns','print'],name:['name','label','nickname','الاسم'],brand:['brand','maker','make','الماركه'],material:['material','fabric','cloth'],notes:['notes','note','comments','comment','remarks','ملاحظات'],
  desc:['description','desc','details','detail','item description','style description','item'],qty:['qty','quantity','count','how many','amount','pieces','units','no of pieces'],
  vest:['vest','waistcoat','three-piece','3-piece'],cuff:['cuffs','cuff'],kind:['kind','trouser kind','trousers kind','fit'],style:['style','shoe style'],leather:['leather'],season:['season'],metal:['metal','buckle','metal colour','metal color','case']};
/* a metal word → {k: 'gold' | 'silver' | 'other' (gunmetal), read} (read: not one of the app's three by name), else null */
function kitMetal(word){const w=kitNorm(word).replace(/-/g,' ');if(!w)return null;
  if(/^(gold|yellow gold|gold tone|gilt|brass)$/.test(w))return {k:'gold',read:w!=='gold'};if(/^(rose gold|pink gold|red gold)$/.test(w))return {k:'gold',read:true};
  if(/^(silver|steel|stainless|stainless steel|silver tone|chrome|platinum|white gold|sterling|sterling silver)$/.test(w))return {k:'silver',read:w!=='silver'};
  if(/^(gunmetal|gun metal|black metal|titanium|grey metal)$/.test(w))return {k:'other',read:w!=='gunmetal'&&w!=='gun metal'};return null}
/* type words (Arabic ones as kitNorm leaves them: ة → ه, the hamza on alif dropped) */
const KIT_TYPE_WORDS={suit:['suit','suits','two-piece','three-piece','suit jacket','بدله','بدلات'],blazer:['blazer','sport coat','sports coat','sportcoat','jacket','sport jacket','بليزر','جاكيت','جاكت','ستره'],
  pants:['trousers','trouser','pants','slacks','chinos','jeans','dress trousers','dress pants','khakis','بنطلون','بنطال','سروال','بناطيل'],
  shirt:['shirt','dress shirt','shirts','oxford shirt','قميص','قمصان'],tie:['tie','necktie','ties','ربطه عنق','ربطه','كرافته','كرفته','كرافات'],tieclip:['tie clip','tie bar','tieclip','tie pin','مشبك ربطه','دبوس ربطه'],
  pocketsquare:['pocket square','pocket squares','pocket-square','pocket-squares','pocketsquare','hank','hanks','hankie','hanky','handkerchief','handkerchiefs','pochette','pocket handkerchief','منديل','منديل جيب'],   // (2026-11-16)
  watch:['watch','wristwatch','ساعه','ساعه يد'],
  shoes:['shoes','shoe','oxfords','oxford','derbies','derby','loafers','loafer','boots','boot','sneakers','trainers','brogues','brogue','wingtips','monk','monks','monk straps','monkstraps','moccasins','dress shoes','حذاء','احذيه','جزمه'],
  belt:['belt','حزام'],socks:['socks','sock','جوارب','شراب'],cufflinks:['cufflinks','cuff links','cufflink','cuff link','ازرار اكمام','كبك'],overcoat:['overcoat','coat','topcoat','top coat','wool coat','معطف','بالطو'],
  raincoat:['raincoat','trench','trench coat','mac','معطف مطر','ترنش'],
  // the casual garments (2026-11-16)
  tee:['t-shirt','t-shirts','tee','tees','tshirt','t shirt','crew neck tee','crewneck tee','v-neck tee','long sleeve tee','تيشيرت','تي شيرت'],polo:['polo','polos','polo shirt','polo shirts','pique polo','knit polo','بولو'],
  henley:['henley','henleys','henley shirt'],sweater:['sweater','sweaters','jumper','jumpers','pullover','crewneck','crew neck','crewneck sweater','crew neck sweater','v-neck sweater','v-neck','vneck','roll neck','rollneck','turtleneck','knit','knitwear','كنزه','بلوفر'],
  sweatshirt:['sweatshirt','sweatshirts','crewneck sweatshirt','sweat shirt','sweat'],hoodie:['hoodie','hoodies','hooded sweatshirt','hoody','zip hoodie','هودي'],
  qzip:['quarter-zip','quarter zip','1/4 zip','1/4-zip','quarter zip pullover','quarter-zip pullover','half zip','half-zip','1/2 zip','zip neck','qzip'],cardigan:['cardigan','cardigans','cardi','كارديجان'],
  chore:['chore jacket','chore coat','chore','field jacket','work jacket','barn jacket','overshirt','shirt jacket','shacket'],
  blouse:['uniform blouse','ocp blouse','ocp coat','ocp top','uniform coat','uniform top','acu coat','utility coat','blouse']};
KIT_TYPE_WORDS.pants.push('cargos','cargo pants','cargo trousers','cargo');   // (cargo pants: kind 'cargo', kitTrouserKind)
const KIT_PLANS='suits, blazers, pants, shirts, ties, tie clips, pocket squares, shoes, belts, socks, watches, cufflinks and coats';
const kitNorm=s=>String(s??'').normalize('NFKC').trim().toLowerCase().replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
  .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[_\s]+/g,' ').replace(/grey|gray/g,'grey');
/* rows of cells; each row keeps its place in the text (r.ln, from 1, empty rows counted: "Row 23" is the 23rd row pasted, W2-15-04) */
function kitSplit(text){text=String(text||'').replace(/^﻿/,'').replace(/\r\n?/g,'\n');const first=text.split('\n',6).join('\n');   // (the first lines: a title above the column names has no tab)
  const d=first.includes('\t')?'\t':(first.split(';').length>first.split(',').length?';':',');const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c;continue}
    if(c==='"'&&f==='')q=true;else if(c===d){row.push(f);f=''}else if(c==='\n'){row.push(f);rows.push(row);row=[];f=''}else f+=c}
  if(f!==''||row.length){row.push(f);rows.push(row)}rows.forEach((r,i)=>{r.ln=i+1});return rows.filter(r=>r.some(v=>String(v).trim()))}
/* one type word: the app's own words, then the word as a singular (Blazers, Watches, Dress shirts, Tie clips) */
function kitTypeOne(w){const find=x=>Object.keys(KIT_TYPE_WORDS).find(t=>KIT_TYPE_WORDS[t].includes(x))||Object.keys(TYPES).find(t=>kitNorm(TYPES[t])===x);
  return find(w)||(/es$/.test(w)&&find(w.slice(0,-2)))||(/s$/.test(w)&&find(w.slice(0,-1)))||null}
/* a type cell: the words as a whole, else a known word among others ("Shoes - Oxford", "Linen trouser"): the last word first (the noun) */
function kitType(tw){const ws=tw.split(/[^\p{L}]+/u).filter(Boolean);
  // (no single word: a two-word type among others, the last pair first: "White linen pocket square", 2026-11-16)
  const pairs=()=>ws.length>2?ws.slice(1).map((w,k)=>ws[k]+' '+w).reverse().map(kitTypeOne).find(Boolean):null;
  return kitTypeOne(tw)||(ws.length>1?[...ws].reverse().map(kitTypeOne).find(Boolean):null)||pairs()||null}
/* two words one typo apart (a letter added, dropped, changed or two swapped: "Shrit") */
function kitNear(a,b){if(a===b)return true;const la=a.length,lb=b.length;if(Math.abs(la-lb)>1)return false;let i=0;while(i<la&&i<lb&&a[i]===b[i])i++;
  if(la===lb)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));return la>lb?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1)}
const kitTypeNear=tw=>tw.length<5?null:Object.keys(KIT_TYPE_WORDS).find(t=>KIT_TYPE_WORDS[t].some(w=>w.length>=5&&/^[a-z ]+$/.test(w)&&kitNear(tw,w)))||null;
/* short forms and Arabic color words, word by word (W2-15-03, W2-15-07, W2-16-06) */
const KIT_COL_ABBR={lt:'light',lite:'light',dk:'dark',drk:'dark',med:'mid',md:'mid',blk:'black',wht:'white',brn:'brown',brwn:'brown',nvy:'navy',gry:'grey',grn:'green',bge:'beige',burg:'burgundy',chrcl:'charcoal'};
const KIT_AR_COL={'اسود':'black','سوداء':'black','ابيض':'white','بيضاء':'white','ازرق':'blue','زرقاء':'blue','كحلي':'navy','رمادي':'grey','بني':'brown','احمر':'red','حمراء':'red','اخضر':'green','خضراء':'green',
  'بيج':'beige','زيتي':'olive','عنابي':'burgundy','خمري':'wine','وردي':'pink','زهري':'pink','بنفسجي':'purple','ذهبي':'gold','فضي':'silver','كريمي':'cream','سماوي':'light blue','فحمي':'charcoal','اصفر':'pale yellow','صفراء':'pale yellow'};
const KIT_AR_MOD={'فاتح':'light','غامق':'dark','داكن':'dark'};
/* a colour word → {k, read, part} (read: matched to the nearest name rather than named exactly; part: only that last word was understood),
   null when empty, undefined when unknown. The app's own color names come before the owner's own colours: own colours named "Navy" or
   "Gray" on an older version took "Suit, Navy" and "Suit, Grey" (W1-2-02). strict: no last-word guess and no typo match */
function kitColour(word,strict){const raw=kitNorm(word);if(!raw||raw==='none'||raw==='-')return null;let ab=false;const mod=[],ws=[];
  for(const x of raw.replace(/\./g,' ').split(/\s+/).filter(Boolean)){if(KIT_AR_MOD[x]){mod.push(KIT_AR_MOD[x]);ab=true;continue}const y=KIT_COL_ABBR[x]||KIT_AR_COL[x];if(y){ab=true;ws.push(y)}else ws.push(x)}
  const w=[...mod,...ws].join(' ').replace(/-/g,' ').replace(/^sky$/,'sky blue').replace(/^navy blue$/,'navy').replace(/^off white$/,'ivory').replace(/^mauve$/,COLORS.lavender?'lavender':'purple').replace(/^(fuchsia|magenta)$/,'pink');
  const nm=x=>kitNorm(x).replace(/-/g,' '),keys=Object.keys(COLORS).filter(c=>!CUSTOM_COL[c]),exact=x=>keys.find(c=>nm(colName(c))===x||kitNorm(c)===x||kitNorm(c)===x.replace(/ /g,''));
  let k=exact(w);if(k)return ab?{k,read:true}:{k};
  // the owner's own colours by name (core.js CUSTOM_COL; settings.custom.colors is a list, and its index was taken as the colour: "0 isn't one of the tie colours")
  const own=Object.values(CUSTOM_COL).find(c=>c&&nm(c.name)===w);if(own)return {k:own.key};
  k=normCol(w);if(k)return {k,read:true};   // everyday names: sky blue, dark brown, maroon, midnight blue, cognac (core.js COL_ALIAS)
  if(strict)return undefined;
  const p=w.split(' ');if(p.length>1){const a=p.slice(0,-1).join(' ');if(p[p.length-1]==='grey'&&(k=exact(a)||normCol(a)))return {k,read:true};   // charcoal grey
    const l=p[p.length-1];k=exact(l)||normCol(l);if(k)return {k,read:true,part:l}}   // heather grey, royal navy: only the last word understood, said so
  if(w.length>=5&&!w.includes(' ')&&(k=keys.find(c=>kitNear(w,nm(colName(c)))||kitNear(w,c))))return {k,read:true};   // a typo: "burgandy"
  return undefined}
const kitColList=type=>colsFor(type).filter(c=>!CUSTOM_COL[c]).map(c=>colName(c).toLowerCase()).join(', ');
function kitPattern(word,type){const w=kitNorm(word).replace(/-/g,' ');if(!w||w==='plain'||w==='none'||w==='solid')return 'solid';
  const list=(PATS_BY[type]||[]);const own=list.find(p=>CUSTOM_PAT[p]&&kitNorm(CUSTOM_PAT[p].name)===w);if(own)return own;   // the owner's own patterns offered for the type (core.js CUSTOM_PAT)
  const syn={striped:'stripe',stripes:'stripe',stripe:'stripe',checked:'check',checks:'check','pin stripe':'pinstripe','pinstripes':'pinstripe','chalkstripe':'chalk-stripe','chalk stripe':'chalk-stripe','glen plaid':'glen-check','glen check':'glen-check','prince of wales':'glen-check','polka dots':'polka-dot','polka dot':'polka-dot',dots:'polka-dot',
    repp:'stripe','repp stripe':'stripe',rep:'stripe','rep stripe':'stripe',regimental:'stripe','regimental stripe':'stripe',bengal:'stripe','bengal stripe':'stripe','candy stripe':'stripe',camo:'camouflage',camouflage:'camouflage',multicam:'camouflage',ocp:'camouflage',woodland:'camouflage','woodland camo':'camouflage'};
  const al=PAT_ALIAS[type==='blazer'||type==='pants'?'suit':type]||{},s=syn[w],h=w.replace(/ /g,'-');
  const k=list.find(p=>kitNorm(patLabel(p))===w||p===h)||(s&&(list.includes(s)?s:list.includes(al[s])?al[s]:null))||(list.includes(al[h])?al[h]:null);return k||undefined}
/* what a row's Material says: one of the type's own materials (any case), the leather of shoes and belts; else left out, said */
/* (2026-11-15, the materials audit) other words for a material are read as the listed one (core.js MAT_ALIAS: Merino, Fresco, Broadcloth,
   Lisle, Wool-linen…, said as "read as"); a shirt's weave in the Material column (oxford, twill, end-on-end…) is its pattern when the row's
   pattern is plain; anything else is kept as typed (Other) */
function kitMaterial(card,word){const m=kitNorm(word),w=String(word).trim();if(!m)return null;const list=MATERIALS_BY[card.type];
  const p=card.type==='shirt'&&(SHIRT_WEAVE_MAT[m]||SHIRT_WEAVE_MAT[m.replace(/-/g,' ')]);
  if(list){if(p){
      if((card.pattern||'solid')==='solid'&&(PATS_BY.shirt||[]).includes(p)){card.pattern=p;return `material “${w}” read as the ${patName(p)} pattern`}
      return `material “${w}” left out (a weave: the pattern says it)`}
    const a=matAlias(card.type,m);card.material=a||w;return a&&a!==m?`material “${w}” read as ${a}`:null}   // (one not on the list shows as Other, as typed)
  if(card.type==='shoes'||card.type==='belt'){const k=kitLeather(card,m);if(k){card.leather=k.k;return k.read?`material “${w}” read as ${leatherWord(card,k.k)}`:null}}
  return `material “${w}” left out`}
/* a leather word for shoes or a belt -> {k, read}: the style's own leathers ("pebble grain" with a space is pebble-grain, not calf: the
   audit's bug), nubuck (suede on a style that isn't made in it), braided, else "leather"/"calf" as calf; null when none */
function kitLeather(card,m){const ls=leathersFor(card),d=m.replace(/\s+/g,'-');let k=ls.find(l=>d.includes(l));if(k)return {k};
  if(/nubuck/.test(m))return ls.includes('nubuck')?{k:'nubuck'}:ls.includes('suede')?{k:'suede',read:true}:null;
  if(/braid/.test(m)&&ls.includes('braided'))return {k:'braided'};
  return /leather|calf/.test(m)&&ls.includes('calf')?{k:'calf'}:null}
/* the words of a cell, for reading a description ("w/" is "with") */
const kitWords=t=>kitNorm(String(t||'').replace(/\bw\//gi,' with ')).replace(/([\/&+])/g,' $1 ').replace(/[^\p{L}\p{N}&\/+'’-]+/gu,' ').split(' ').filter(Boolean);
/* the first pattern named in some words (the longest phrase first): {p, s, l} (where it is), else null; "other" and plain don't count */
function kitPatWords(ws,type){if(!hasPat(type))return null;for(let l=3;l>=1;l--)for(let s=0;s+l<=ws.length;s++){const p=kitPattern(ws.slice(s,s+l).join(' '),type);if(p&&p!=='solid'&&p!=='other')return {p,s,l}}return null}
const KIT_FILL=new Set(['and','&','/','+','with','in','the','a','an','of','-','–','on','x','×','french','double','cuff','cuffs','piece']);
const KIT_CONJ=new Set(['and','&','/','+','with']);
const KIT_MORE_W=/^(brogues?|wingtips?|monks?|monkstraps?|moccasins?|straps?)$/;   // shoe words that say more than the type: kept in the name
const KIT_KIND_W=/^(chinos?|jeans?|denims?|khakis|cargos?)$/,KIT_STYLE_W=/^(derby|derbies|loafers?|boots?|sneakers?|trainers?|oxfords?)$/,KIT_MOD_W=/^(light|dark|mid|medium|pale|deep|bright|lt|dk)$/;
/* the words of a description nothing was read from (the colour, type, pattern, kind, style, material and small words are read) */
function kitLeft(ws,type,pat){const used=new Set();if(pat)for(let i=pat.s;i<pat.s+pat.l;i++)used.add(i);
  const mats=(MATERIALS_BY[type]||[]).flatMap(m=>m.split(' ')).concat(type==='shoes'||type==='belt'?['leather','calf','suede','patent','cordovan']:[]);
  ws.forEach((w,i)=>{if(KIT_FILL.has(w)||KIT_MOD_W.test(w)||/^[x×]?\d+$/.test(w)||KIT_KIND_W.test(w)||KIT_STYLE_W.test(w)||mats.includes(w)||(kitTypeOne(w)&&!KIT_MORE_W.test(w))||kitColour(w,true))used.add(i)});
  return ws.filter((_,i)=>!used.has(i))}
/* a quantity in some text: "x3", "3x" */
const KIT_QTY_RE=/(?:^|[\s,(])[x×]\s?(\d{1,3})\b|\b(\d{1,3})\s?[x×](?=[\s,)]|$)/i,KIT_QTY_MAX=12;
const kitQtyIn=s=>{const m=kitNorm(s).match(KIT_QTY_RE);return m?+(m[1]||m[2]):0},kitQtyOut=s=>String(s||'').replace(KIT_QTY_RE,' ').replace(/\s+/g,' ').trim();
/* the cells of a sheet → {col: key → column, used: the columns read} (the first name of each list that is there; Type takes "Item" only when
   no other column names the type, else "Item" is a description) */
const kitHead=h=>kitNorm(h).replace(/\(s\)/g,'s').replace(/[:*?]+$/,'').trim();
function kitCols(row){const head=row.map(kitHead),col={},used=new Set();
  for(const [k,names] of Object.entries(KIT_COLS))for(const n of names){const j=head.findIndex((h,x)=>h===n&&!used.has(x));if(j>=0){col[k]=j;used.add(j);break}}
  return {col,used}}
const KIT_HEAD_ERR='Name the columns in the first row, with at least “Type” and “Color”, or paste a list with one piece per line, like “Navy suit”. Download the template to see how.';
/* one row's cells (by KIT_COLS key) → {line, ok, card, probs, qty, given} or {line, ok:false, why}; given: the fields the row itself says
   (an update changes only those) */
function kitRow(c,line){const probs=[],given=new Set();
  const tw=kitNorm(c.type);if(!tw)return {line,ok:false,raw:'(empty)',why:'Type is empty'};
  let type=kitType(tw);const near=!type&&kitTypeNear(tw);if(near)type=near;
  if(!type){const cu=c.primaryColor&&kitColour(c.primaryColor)===undefined,ar=/[؀-ۿ]/.test(c.type);
    return {line,ok:false,raw:c.type,why:`“${c.type}” isn't a type the app plans. It plans ${KIT_PLANS}${ar?' (write the type in English if it isn’t found)':''}.${cu?` “${c.primaryColor}” isn't a color the app knows either.`:''}`}}   // both problems at once (W2-15-07)
  if(near)probs.push(`“${c.type}” read as ${TYPES[type].toLowerCase()}`);
  // several colours in one cell ("light blue, white", "Blue/white"): the first is the main colour, the others fill empty second and third
  // colour columns (re-audit 2026-11-15: the second colour was lost and the row read as white)
  let pw=c.primaryColor||'';const more={};{const parts=pw.split(/\s*(?:,|\/|&|\+|\band\b|\bw\/|\bwith\b)\s*/i).filter(Boolean);
    if(parts.length>1&&parts.length<=3&&parts.every(x=>kitColour(x))){pw=parts[0];if(!c.secondaryColor)more.secondaryColor=parts[1];if(parts[2]&&!c.tertiaryColor)more.tertiaryColor=parts[2]}}
  // a watch's or cufflinks' metal named as the colour ("Watch, Gold", "Cufflinks, Rose gold"): the metal (they imported as silver)
  const mtl=(type==='watch'||type==='cufflinks')&&kitMetal(pw);
  const m=mtl?{k:mtl.k==='gold'?'gold':'silver'}:kitColour(pw);
  if(!m)return {line,ok:false,raw:c.type,why:m===null?'Color is empty':`“${c.primaryColor}” isn't a color the app knows. ${TYPES[type]} colors: ${kitColList(type)}.`};
  const col=fitCol(type,m.k)||m.k;
  if(mtl){given.add('metal');if(mtl.read)probs.push(`“${pw}” read as ${metalWord(mtl.k)}`)}
  else if(col!==m.k)probs.push(`${colName(m.k).toLowerCase()} isn't one of the ${TYPES[type].toLowerCase()} colors: read as ${colName(col).toLowerCase()}`);
  else if(m.part)probs.push(`only “${m.part}” of “${pw}” was understood: read as ${colName(col).toLowerCase()}`);
  else if(m.read)probs.push(`“${pw}” read as ${colName(col).toLowerCase()}`);
  const acc=k=>{const w=more[k]||c[k],x=kitColour(w);if(x===undefined){probs.push(`${k==='secondaryColor'?'second':'third'} color “${w}” left out`);return null}return x?fitCol(type,x.k,true)||x.k:null};
  const c2=acc('secondaryColor'),c3=acc('tertiaryColor');if(c3)given.add('tertiaryColor');
  // the words: a description, the notes, the name and the type cell say what their own columns don't (W2-15-01)
  const srcs=[c.desc,c.notes,c.name,c.type].filter(Boolean),txt=srcs.map(kitNorm).join(' | '),dws=kitWords(c.desc),dpat=kitPatWords(dws,type);
  let pattern='solid';if(hasPat(type)){if(c.pattern){const p=kitPattern(c.pattern,type);if(p===undefined)probs.push(`pattern “${c.pattern}” read as plain`);else{pattern=p;given.add('pattern')}}
    else{const f=dpat||[c.notes,c.name,c.type].filter(Boolean).map(s=>kitPatWords(kitWords(s),type)).find(Boolean);if(f){pattern=f.p;given.add('pattern')}}}
  const card={id:crypto.randomUUID(),manual:true,type,primaryColor:col,secondaryColor:c2||null,tertiaryColor:c3||null,pattern,metal:mtl?mtl.k:'silver',leather:'calf'};
  if(type==='socks'){const plain=pattern==='solid';card.toeColor=plain&&c2?c2:null;if(plain){card.secondaryColor=null;card.tertiaryColor=null}}   // a plain sock's second colour is its toe cap (2026-11-17: its own field)
  // an "Also has" column (accents, 2026-11-16): its colours in one cell ("red, gold"), the item's own three left out, at most 4 (a new
  // piece only: a re-import's update of a piece he has leaves its accents, KIT_UPD)
  if(c.accents){const ks=[];for(const w of String(c.accents).split(/\s*(?:,|\/|&|\+|;|\band\b)\s*/i).filter(Boolean)){const x=kitColour(w);if(x)ks.push(x.k);else if(x===undefined)probs.push(`also-has color “${w}” left out`)}
    const a=accentsFor(card,ks);if(a.length)card.accents=a;if(new Set(ks.filter(k=>![col,c2,c3].includes(k))).size>a.length)probs.push(`only ${a.length===1?'one also-has color':`${a.length} also-has colors`} kept`)}
  // a Metal (or Buckle) column for watches, belts and cufflinks
  if(METAL_TYPES.includes(type)&&c.metal){const x=kitMetal(c.metal);if(x){card.metal=x.k;given.add('metal');if(x.read)probs.push(`metal “${c.metal}” read as ${metalWord(x.k)}`)}else probs.push(`metal “${c.metal}” left out`)}
  const yes=s=>/^(y|yes|true|1|x|matching|with)/i.test(String(s).trim());
  if(type==='suit'){if(c.vest){card.vest=yes(c.vest)?'yes':'no';given.add('vest')}else if(/three[ -]?piece|3[ -]?piece|\bwith (a )?(vest|waistcoat)\b/.test(txt)){card.vest='yes';given.add('vest')}else card.vest='no'}
  if(type==='shirt'){if(c.cuff){card.cuff=/french|double/i.test(c.cuff)?'french':'button';given.add('cuff')}else if(/\b(french|double) cuffs?\b/.test(txt)){card.cuff='french';given.add('cuff')}else card.cuff='button'}
  if(type==='pants'){const k=kitNorm(c.kind),s=k||txt;card.trouserKind=/cargo/.test(s)?'cargo':/jean|denim/.test(s)?'jeans':/chino|\bkhakis\b/.test(s)?'chinos':'dress';if(k||card.trouserKind!=='dress')given.add('trouserKind')}
  if(type==='shoes'){const k=kitNorm(c.style||c.kind),s=k||txt;card.shoeStyle=/derb|monk/.test(s)?'derby':/loaf|penny|moccasin/.test(s)?'loafer':/combat|tactical|jungle/.test(s)?'combat':/boot|chelsea|chukka/.test(s)?'boot':/sneak|train/.test(s)?'sneaker':'oxford';
    if(k||card.shoeStyle!=='oxford'||/oxford|brogue|wingtip/.test(s))given.add('shoeStyle')}
  if(type==='shoes'||type==='belt'){const l=kitNorm(c.leather);if(l){const k=kitLeather(card,l);if(k){card.leather=k.k;given.add('leather');if(k.read)probs.push(`leather “${c.leather}” read as ${leatherWord(card,k.k)}`)}}
    else if(!c.material){const ws=kitWords(txt),k=leathersFor(card).find(x=>x!=='calf'&&ws.includes(x));if(k){card.leather=k;given.add('leather')}}}
  if(SEASON_TYPES.includes(type)){const s=kitNorm(c.season);if(/^(summer|warm)/.test(s)){card.season='warm';given.add('season')}else if(/^(winter|cold)/.test(s)){card.season='cold';given.add('season')}}
  for(const k of ['name','brand','notes'])if(c[k]){card[k]=k==='name'?kitQtyOut(c[k])||c[k]:c[k];given.add(k)}
  if(c.material&&!(c.leather&&(type==='shoes'||type==='belt'))){const pat0=card.pattern,lt0=card.leather,p=kitMaterial(card,c.material);if(p)probs.push(p);if(card.material)given.add('material');if(card.leather!==lt0)given.add('leather');if(card.pattern!==pat0)given.add('pattern')}
  else if(!c.material&&MATERIALS_BY[type]){const s=' '+kitWords(txt).join(' ')+' ',mt=MATERIALS_BY[type].filter(x=>x!=='other').sort((a,b)=>b.length-a.length).find(x=>s.includes(' '+x+' '));if(mt){card.material=mt;given.add('material')}}
  // a description's other words: the name ("Penny loafers", "Brogues"), or the notes when the row has a name (W2-15-01: two navy ties alike)
  const left=kitLeft(dws,type,dpat);if(left.length){const d=kitQtyOut(c.descName||c.desc);if(!card.name){card.name=cap1(d);given.add('name')}else if(!c.descName){card.notes=card.notes?card.notes+' · '+d:d;given.add('notes')}}
  // how many (W2-15-06): a Qty column, or "x3" in the description, name or type
  let qty=1;const qs=String(c.qty||'').trim();
  if(qs){const n=parseInt(kitNorm(qs),10);if(n===0)return {line,ok:false,raw:c.type,why:'Quantity is 0'};if(n>0)qty=n;else probs.push(`quantity “${qs}” left out`)}
  else{const n=[c.desc,c.name,c.type,c.notes].map(kitQtyIn).find(x=>x>0);if(n)qty=n}
  if(qty>KIT_QTY_MAX){probs.push(`${qty} asked for: ${KIT_QTY_MAX} added at most`);qty=KIT_QTY_MAX}
  // what is kept of long text (wardrobe.js WARD_MAX), said (W2-12-05)
  const MX=WARD_MAX;
  for(const k of ['name','brand','material','notes'])if(card[k]&&card[k].length>MX[k]){card[k]=card[k].slice(0,MX[k]).trim();probs.push(`${k} cut to ${MX[k]} characters`)}
  return {line,ok:true,card,probs,qty,given}}
/* a line of a list with no column names ("Navy suit", "White shirt x3", "Charcoal pinstripe suit") → {line, qty, type, col, col2, rest} */
function kitFree(t){let s=String(t||'').trim();if(!s)return null;let qty=kitQtyIn(s);s=kitQtyOut(s);
  const lead=s.match(/^(\d{1,3})\s+(?=\D)/);if(!qty&&lead){qty=+lead[1];s=s.slice(lead[0].length)}
  const ws=kitWords(s);let ts=-1,tl=0;
  for(let e=ws.length;e>0&&ts<0;e--)for(let l=Math.min(3,e);l>=1;l--)if(kitTypeOne(ws.slice(e-l,e).join(' '))){ts=e-l;tl=l;break}
  if(ts<0)return {line:s,qty};
  const type=ws.slice(ts,ts+tl).join(' '),rest=ws.filter((_,i)=>i<ts||i>=ts+tl);let cs=-1,cl=0;
  for(let l=Math.min(3,rest.length);l>=1&&cs<0;l--)for(let a=0;a+l<=rest.length;a++)if(kitColour(rest.slice(a,a+l).join(' '),true)){cs=a;cl=l;break}
  if(cs<0)return {line:s,qty,type};
  const used=new Set();for(let i=cs;i<cs+cl;i++)used.add(i);let col2='';const j=cs+cl;
  if(KIT_CONJ.has(rest[j]))for(let l=Math.min(3,rest.length-j-1);l>=1;l--){const w=rest.slice(j+1,j+1+l).join(' ');if(kitColour(w,true)){col2=w;for(let i=j;i<=j+l;i++)used.add(i);break}}
  return {line:s,qty,type,col:rest.slice(cs,cs+cl).join(' '),col2,rest:rest.filter((_,i)=>!used.has(i)).join(' ')}}
/* a list with no column names, one piece per line (W2-15-05): read when at least half its lines name a type and a colour */
function kitReadList(rows){const out=rows.map(r=>{const t=r.map(v=>String(v).trim()).filter(Boolean).join(', '),f=kitFree(t);
    if(!f||!f.type||!f.col)return {line:r.ln,ok:false,raw:t,why:`“${t}”: write the color and the type, like “Navy suit”`};
    return kitRow({type:f.type,primaryColor:f.col,secondaryColor:f.col2,desc:f.rest,descName:f.line,qty:f.qty?String(f.qty):''},r.ln)});
  const good=out.filter(x=>x.ok).length;if(!good||good*2<out.length)return {err:KIT_HEAD_ERR};return {rows:out,list:true,unused:[],descCols:[]}}
/* the rows of a sheet: the column names in the first row, or in one of the first rows under a title (W2-15-05), else a list */
function kitRead(text){const rows=kitSplit(text);if(!rows.length)return {err:'Nothing to read.'};
  let hi=-1,map=null;for(let i=0;i<Math.min(rows.length,6);i++){const m=kitCols(rows[i]);if(m.col.type!=null&&m.col.primaryColor!=null){hi=i;map=m;break}}
  if(hi<0)return kitReadList(rows);
  const {col,used}=map,h=rows[hi],out=[];
  for(const r of rows.slice(hi+1)){const c={};for(const k of Object.keys(col))c[k]=String(r[col[k]]??'').trim();out.push(kitRow(c,r.ln))}
  return {rows:out,head:h.ln>1?h.ln:0,unused:h.map((x,j)=>used.has(j)?'':String(x).trim()).filter(Boolean),descCols:col.desc!=null?[String(h[col.desc]).trim()]:[]}}
const KIT_TEMPLATE='Type,Color,Second color,Pattern,Name,Brand,Material,Notes,Vest\nSuit,Navy,,Pinstripe,Navy pinstripe,,Wool,,Yes\nDress shirt,Light blue,,Solid,,,Poplin,,\nTie,Burgundy,Navy,Stripe,,,Silk,Repp stripe,\nShoes,Black,,,Black oxfords,,Calf,,\nPants,Mid gray,,Solid,,,Flannel,,\n';
/* the template as a data link: nothing to revoke (a blob link revoked a second after the tap can fail on an iPhone, where Safari first
   asks whether to download) */
function kitTemplate(){const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(KIT_TEMPLATE);a.download='wardrobe-template.csv';document.body.appendChild(a);a.click();a.remove()}
/* a file's text: UTF-8 (with or without its mark), UTF-16 (Excel's "Unicode text"), else Windows-1252 (Excel's "CSV (Comma delimited)") */
function kitDecode(buf){const b=new Uint8Array(buf);
  if(b[0]===0xFF&&b[1]===0xFE)return new TextDecoder('utf-16le').decode(b);if(b[0]===0xFE&&b[1]===0xFF)return new TextDecoder('utf-16be').decode(b);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(b)}catch{return new TextDecoder('windows-1252').decode(b)}}
let kitImp=null;   // {rows} once read; each good row has on (ticked) and dup (already in the wardrobe)
const KIT_IMP_LAST='kit_import_last';   // the last import's ids and time (localStorage): "Take them out" in the sheet, after Undo's toast has gone
const KIT_IMP_UNDO_MS=20000;
/* "Take them out" is for an import just made: offered for KIT_IMP_KEEP_MS, and a piece changed since (renamed, its photo added) is his and
   stays (re-audit 2026-11-15: a renamed piece went too, weeks later) -> {ids (to take out), kept (changed since), at} */
const KIT_IMP_KEEP_MS=7*864e5;
function kitLastImp(){try{const l=JSON.parse(localStorage.getItem(KIT_IMP_LAST)||'null');if(!l||!Array.isArray(l.ids))return null;
  if(!(Date.now()-(+l.at||0)<KIT_IMP_KEEP_MS)){localStorage.removeItem(KIT_IMP_LAST);return null}
  const its=l.ids.map(id=>items.find(i=>i.id===id)).filter(Boolean),ch=i=>(i.updated||0)-(+l.at||0)>KIT_EDIT_MS;
  const ids=its.filter(i=>!ch(i)).map(i=>i.id);return ids.length?{ids,kept:its.length-ids.length,at:l.at}:null}catch{return null}}
function kitLastRow(){const l=kitLastImp();if(!l)return '';const when=new Date(l.at).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  return `<p class="kit-last" id="kit-last">Your last import (${when}): ${l.ids.length} item${l.ids.length===1?'':'s'} in your wardrobe${l.kept?` you haven't changed since`:''}. <button type="button" class="linkbtn" data-act="kitUnimportTap">Take ${l.ids.length===1?'it':'them'} out</button></p>`}
/* the import is a bottom sheet over Add (2026-11-15, the owner's choice from add-page-mockups): grabber, the table icon, the backdrop,
   a swipe down closes it as ✕ (sheet-swipe.js sheetSwipe), at most 640 px wide; its content is as before */
const KIT_TABLE='<svg class="kit-hic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/></svg>';
let kitBsT=0,kitSwipeOn=false;
function kitBd(){let b=$('#kit-backdrop');if(!b){b=document.createElement('div');b.id='kit-backdrop';b.onclick=()=>{if(kit&&!kitImpBusy)kitClose()};document.body.appendChild(b)}return b}
function kitBs(on){const e=kitEl();clearTimeout(kitBsT);e.classList.remove('going');e.inert=false;e.style.transform='';e.classList.toggle('kbs',!!on);const b=$('#kit-backdrop');if(on)kitBd().classList.add('on');else if(b)b.classList.remove('on')}
/* the import sheet slides away, then is emptied */
function kitBsAway(e){const b=$('#kit-backdrop');if(b)b.classList.remove('on');e.inert=true;e.classList.add('going');clearTimeout(kitBsT);
  kitBsT=setTimeout(()=>{if(e.classList.contains('on'))return;e.classList.remove('going','kbs');e.inert=false;e.innerHTML=''},noMotion()?0:320)}
function kitImportSwipe(){if(kitSwipeOn)return;kitSwipeOn=true;const e=kitEl();
  sheetSwipe(e,{head:'.kit-head',body:()=>e.querySelector('.kit-body'),backdrop:()=>$('#kit-backdrop'),live:()=>!!kit&&e.classList.contains('kbs')&&!kitImpBusy,close:()=>kitClose()})}
function kitImportOpen(){kitImp=null;const e=kitEl(),prev=kit?kit.hist:undefined;kit={cards:[],at:0,then:null,from:document.activeElement};if(prev!==undefined)kit.hist=prev;kitBs(true);kitImportSwipe();
  e.innerHTML=`<div class="kit-head"><span class="kit-grab" aria-hidden="true"></span><div class="kit-ht">${KIT_TABLE}<h2 id="kit-title">Import from a spreadsheet</h2></div><button type="button" class="kit-x" data-act="kitShut" aria-label="Close">✕</button></div>
<div class="kit-body" data-card="import"><p>One row per piece. The first row names the columns; only <b>Type</b> and <b>Color</b> are needed (a Description column is read for patterns and styles, a Qty column for how many; a list with one piece per line, like “Navy suit”, works too). Importing the sheet again updates the pieces it changed. From Numbers, Excel or Google Sheets, export the sheet as CSV, or copy the rows and paste them below.</p>
${kitLastRow()}<div class="btns"><button type="button" data-act="kitTemplateTap">Download a template</button><label class="btn">Choose a CSV file<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" class="vfile" data-act-change="kitFilePick"></label></div>
<label class="kit-paste">Or paste the rows<textarea id="kit-paste" rows="5" data-act-focus="kitPasteFocus" placeholder="Type, Color, Pattern…" data-act-input="kitPasteType"></textarea></label>
<div id="kit-prev" aria-live="polite"></div></div>
<div class="kit-bar"><button type="button" id="kit-cancel" data-act="kitShut">Cancel</button><button type="button" class="pri" id="kit-imp" disabled data-act="kitImpTap">Add items</button></div>`;
  e.classList.add('on');kitInert(true);kitHist();e.tabIndex=-1;try{e.focus({preventScroll:true})}catch{}}   // the focus goes into the sheet (it stayed on <body>, outside the dialog)
/* the import sheet's controls (act.js): the last import's "Take them out", the template, a picked file (the field is emptied, so the
   same file can be picked again), the paste field, Add items, and a preview row's check and "Add as new" (data-k: its place in kitImp.rows) */
function kitUnimportTap(){kitUnimport()}
function kitTemplateTap(){kitTemplate()}
function kitFilePick(el){kitImportFile(el.files[0]);el.value=''}
function kitPasteFocus(el){kitPasteShow(el)}
function kitPasteType(el){kitImportText(el.value)}
function kitImpTap(){kitImportGo()}
function kitTickPick(el){kitImpTick(+el.dataset.k,el.checked)}
function kitAsNewTap(el){kitAsNew(+el.dataset.k)}
/* the paste field comes into view below the sheet's header once the keyboard is up (re-audit 2026-11-15: with the preview scrolled it
   stayed under the header) */
function kitPasteShow(t){setTimeout(()=>{if(!t.isConnected)return;const b=t.closest('.kit-body');if(!b)return;const r=t.getBoundingClientRect(),br=b.getBoundingClientRect(),vh=window.visualViewport?visualViewport.height:innerHeight;
  if(r.top<br.top+8||r.top>vh-60)b.scrollTop+=r.top-br.top-8},350)}
/* a picked file's text; a file that can't be read (an iCloud file not downloaded, one moved after picking) is said, not thrown (W2-20-01) */
async function kitImportFile(f){if(!f)return;let t='';
  try{t=kitDecode(await f.arrayBuffer())}catch{try{t=await f.text()}catch(e){console.warn('file not read',e);kitImp=null;const el=$('#kit-prev');if(el)el.innerHTML='<p class="kit-err">This file couldn’t be read. Try again, or open it and paste the rows.</p>';kitImpBtn();return}}
  const ta=$('#kit-paste');if(ta)ta.value='';kitImportText(t,true)}
const kitDupKey=i=>[i.type,i.primaryColor,i.secondaryColor||'',hasPat(i.type)?i.pattern||'solid':'solid',kitNorm(i.name||'')].join('|');
/* what a row would change on a piece he has (the fields the row says, kitRow's given), in KIT_UPD's order */
const KIT_UPD=[['pattern','solid'],['name',''],['brand',''],['material',''],['notes',''],['vest','no'],['cuff','button'],['trouserKind','dress'],['shoeStyle','oxford'],['leather','calf'],['season','all'],['metal','silver'],['tertiaryColor','']];
const KIT_TEXT=['name','brand','material','notes'];
function kitDiff(it,x){const c=x.card,g=x.given||new Set();
  return KIT_UPD.filter(([k,d])=>g.has(k)&&c[k]!=null&&c[k]!==''&&(k!=='pattern'||hasPat(it.type))&&(k!=='material'||MATERIALS_BY[it.type])&&
    (KIT_TEXT.includes(k)?kitNorm(it[k]||'')!==kitNorm(c[k]):String(it[k]??d)!==String(c[k]))).map(([k])=>k)}
const KIT_UPD_WORD={trouserKind:'kind',shoeStyle:'style',cuff:'cuffs',tertiaryColor:'third color'};
function kitDiffText(it,x){const sh=s=>{s=String(s||'');return s.length>40?s.slice(0,39)+'…':s};
  return x.diff.map(k=>{const o=it[k],n=x.card[k];if(k==='pattern')return `pattern ${patName(o||'solid')} → ${patName(n)}`;
    if(KIT_TEXT.includes(k))return o?`${k} “${sh(o)}” → “${sh(n)}”`:`${k} “${sh(n)}”`;
    if(k==='tertiaryColor')return `third color ${colName(n).toLowerCase()}`;return `${KIT_UPD_WORD[k]||k} ${o||KIT_UPD.find(u=>u[0]===k)[1]} → ${n}`})}
/* the rows set against the wardrobe (sample pieces he hasn't made his don't count, re-audit 2026-11-15 N5):
   1. a piece already there (type, colours, pattern, name: kitDupKey) starts unticked as "already in your wardrobe" (importing the same
      sheet again doubled it); a row of 3 with 1 there adds 2;
   2. a piece of the same type and colours whose row says another pattern, name or details is offered as an update of that piece, keeping
      its history (the owner's decision 5, 2026-11-16, W2-15-02: re-importing the sheet with a Pattern column added doubled ten pieces); a row
      that says nothing new about such a piece is that piece. Each piece is matched once. A piece with another name is another piece, and a
      row whose only news is a name for an unnamed piece is a new piece ("Tie, Burgundy, Sheet tie" beside his burgundy tie is added). */
function kitDupMark(rows){const mine=items.filter(i=>!(i.sample&&!kitEdited(i))),used=new Set(),by={};
  for(const i of mine)(by[kitDupKey(i)]=by[kitDupKey(i)]||[]).push(i);
  const good=rows.filter(x=>x.ok);
  for(const x of good){const n=x.qty||1,l=(by[kitDupKey(x.card)]||[]).filter(i=>!used.has(i.id)).slice(0,n);for(const i of l)used.add(i.id);x.have=l.length;x.upd=null;x.diff=null;x.asNew=false}
  const ck=i=>[i.type,i.primaryColor,i.secondaryColor||''].join('|');
  for(const x of good){const n=x.qty||1;
    while(x.have<n&&!x.upd){const c=x.card,score=i=>(c.name&&kitNorm(i.name)===kitNorm(c.name)?4:0)+(c.brand&&kitNorm(i.brand)===kitNorm(c.brand)?2:0)+(x.given&&x.given.has('pattern')&&(i.pattern||'solid')===c.pattern?1:0);
      const cand=mine.filter(i=>!used.has(i.id)&&ck(i)===ck(c)&&!(c.name&&i.name&&kitNorm(i.name)!==kitNorm(c.name))).sort((a,b)=>score(b)-score(a));if(!cand.length)break;
      const i=cand[0],d=kitDiff(i,x);if(d.length===1&&d[0]==='name')break;used.add(i.id);if(d.length){x.upd=i.id;x.diff=d}else x.have++}
    x.add=n-x.have-(x.upd?1:0);x.dup=!x.upd&&x.have>=n;x.on=!x.dup}}
/* what a row adds (new pieces) and updates, ticked */
const kitAdds=x=>!x.ok||!x.on?0:x.dup?(x.qty||1):x.add+(x.upd&&x.asNew?1:0),kitUpds=x=>x.ok&&x.on&&x.upd&&!x.asNew?1:0;
function kitImportText(t,file){const r=kitRead(t),el=$('#kit-prev');if(!el)return;
  if(file&&!String(t).trim()){kitImp=null;el.innerHTML='<p class="kit-err">The file is empty.</p>';kitImpBtn();return}
  if(r.err){kitImp=null;el.innerHTML=String(t).trim()?`<p class="kit-err">${esc(r.err)}</p>`:'';kitImpBtn();return}
  kitDupMark(r.rows);kitImp=r;kitPrevDraw()}
/* the preview: what was read and what wasn't (a description read, columns not used, a title row skipped, a list), the rows left out
   first, then each piece with a tick; a named piece shows its colour and pattern too; an update says what changes on which piece */
function kitPrevDraw(){const r=kitImp,el=$('#kit-prev');if(!r||!el)return;const good=r.rows.filter(x=>x.ok),bad=r.rows.filter(x=>!x.ok),dup=good.filter(x=>x.dup).length,upd=good.filter(x=>x.upd).length,n=good.reduce((s,x)=>s+(x.qty||1),0);
  const row=(x,k)=>{const it=x.upd&&items.find(i=>i.id===x.upd),t=sentence(itemTitle(x.card));
    const info=[TYPES[x.card.type],x.card.name?sentence(shortDesc(x.card)):'',(x.qty||1)>1?`${x.qty} of them`:'',x.dup?'already in your wardrobe':x.have?`${x.have} already in your wardrobe`:'',
      it?(x.asNew?'added as a new piece':`updates your ${itemName(it)?`“${itemName(it)}”`:shortDesc(it)+' '+typeWord(it)}: ${kitDiffText(it,x).join(', ')}`):'',...x.probs].filter(Boolean).join(' · ');
    return `<li class="ok${x.dup?' dup':''}${it&&!x.asNew?' upd':''}"><label class="kit-row"><input type="checkbox" class="kit-tick" ${x.on?'checked':''} data-act-change="kitTickPick" data-k="${k}"><span class="kit-dot">${swatchSVG(x.card,true)}</span><span><b>${esc(t)}</b><small>${esc(info)}</small></span></label>${it?`<button type="button" class="linkbtn kit-asnew" data-act="kitAsNewTap" data-k="${k}">${x.asNew?'Update it instead':'Add as new'}</button>`:''}</li>`};
  const pl=(k,a,b)=>k===1?a:b,read=[];
  if(r.list)read.push('Read as a list, one piece per line.');
  if(r.head)read.push(`The column names are in row ${r.head}; the rows above it were skipped.`);
  if(r.descCols&&r.descCols.length)read.push(`${r.descCols.join(', ')}: read for patterns, kinds, styles and names.`);
  if(r.unused&&r.unused.length)read.push(`Not used: ${r.unused.join(', ')}.`);
  el.innerHTML=`<p class="kit-sum"><b>${n} item${n===1?'':'s'} ready</b>${bad.length?`, ${bad.length} row${bad.length===1?'':'s'} left out`:''}${dup?`. ${dup===1?'One is':dup+' are'} already in your wardrobe: check ${dup===1?'it':'them'} to add another`:''}${upd?`. ${upd===1?'One matches a piece':upd+' match pieces'} you have with another pattern, name or details: ${pl(upd,'it is','they are')} updated, keeping ${pl(upd,'its','their')} history`:''}</p>${read.length?`<p class="kit-cols">${esc(read.join(' '))}</p>`:''}
<ul class="kit-rows">${bad.map(x=>`<li class="bad"><span class="kit-dot kit-no" aria-hidden="true">!</span><span><b>Row ${x.line}</b><small>${esc(x.why)}</small></span></li>`).join('')}${r.rows.map((x,k)=>x.ok?row(x,k):'').join('')}</ul>`;
  kitImpBtn()}
function kitImpTick(n,on){const x=kitImp&&kitImp.rows[n];if(x)x.on=!!on;kitImpBtn()}
function kitAsNew(n){const x=kitImp&&kitImp.rows[n];if(!x||!x.upd)return;x.asNew=!x.asNew;x.on=true;kitPrevDraw()}
function kitImpBtn(){const b=$('#kit-imp');if(!b)return;const rs=kitImp?kitImp.rows:[],a=rs.reduce((s,x)=>s+kitAdds(x),0),u=rs.reduce((s,x)=>s+kitUpds(x),0);b.disabled=!(a+u)||kitImpBusy;
  b.textContent=a&&u?`Add ${a}, update ${u}`:u?`Update ${u} piece${u===1?'':'s'}`:a?`Add ${a} item${a===1?'':'s'}`:'Add items'}
/* an update applied to a copy of the piece (the fields kitDiff found), as the item sheet would set them */
function kitApply(it,x){const c=x.card;for(const k of x.diff){
  if(k==='trouserKind'){if(c.trouserKind==='dress')delete it.trouserKind;else it.trouserKind=c.trouserKind}
  else if(k==='shoeStyle'){if(c.shoeStyle==='oxford')delete it.shoeStyle;else it.shoeStyle=c.shoeStyle;if(!leathersFor(it).includes(it.leather))it.leather='calf'}
  else if(k==='season'){if(c.season==='all')delete it.season;else it.season=c.season}
  else it[k]=c[k]}return it}
/* Add N items: written in one go (a second tap does nothing, a kill stores all or nothing), then one Undo; Cancel and ✕ wait for it */
async function kitImportGo(){if(!kitImp||kitImpBusy)return;const rows=kitImp.rows.filter(x=>x.ok&&x.on&&!items.some(i=>i.id===x.card.id));
  const cards=[],olds=[],news=[];
  for(const x of rows){const n=kitAdds(x);for(let k=0;k<n;k++)cards.push(k?{...x.card,id:crypto.randomUUID()}:x.card);
    const it=kitUpds(x)&&items.find(i=>i.id===x.upd);if(it){olds.push(JSON.parse(JSON.stringify(it)));news.push(kitApply(JSON.parse(JSON.stringify(it)),x))}}
  if(!cards.length&&!news.length)return;
  kitImpBusy=true;const b=$('#kit-imp'),cx=[$('#kit-cancel'),$('#kitsheet .kit-x')],all=cards.length+news.length;if(b){b.disabled=true;b.textContent=`Saving ${all} item${all===1?'':'s'}…`}for(const x of cx)if(x)x.disabled=true;
  const prog=(k,n)=>{if(b&&(k%20===0||k===n))b.textContent=`Adding ${k} of ${n}…`};   // (all of it is kept only once the last is written)
  let ok=false,list=[];try{list=cards.map(kitItem);ok=await kitStore(list,cards.length>40?prog:null,news)}finally{kitImpBusy=false;for(const x of cx)if(x)x.disabled=false}
  if(!ok){kitImpBtn();return}
  const ids=list.map(i=>i.id);kitImp=null;if(ids.length)try{localStorage.setItem(KIT_IMP_LAST,JSON.stringify({ids,at:Date.now()}))}catch{}
  kitClose();if($('#add')&&!$('#add').hidden)renderAdd();else if($('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  const said=[ids.length?`Imported ${ids.length} item${ids.length===1?'':'s'}`:'',news.length?`${ids.length?'updated':'Updated'} ${news.length} piece${news.length===1?'':'s'}`:''].filter(Boolean).join(' and ');
  toast(`${said}.`,KIT_IMP_UNDO_MS,{label:'Undo',fn:()=>kitUnsave({its:ids,qs:[],olds})})}
/* imports made on the 14 Nov version saved a row naming an own colour as its place in settings.custom.colors ("0", "1"), shown as "None",
   drawn grey and planned as no colour (W1-2-01): such a colour becomes the one its own colour's name means today (kitColour: "Gray" and
   "Navy" the app's gray and navy, W1-2-02; "Mocha" the own Mocha), fitted to the type. Run once the first sync is merged (start.js
   whenPulled: a copy changed on another phone comes in first), stamped so it syncs; nothing to do afterwards (no colour is a number) */
async function kitFixOldImports(){const list=settings.custom&&Array.isArray(settings.custom.colors)?settings.custom.colors:[],num=v=>typeof v==='string'&&/^\d+$/.test(v);
  let all=[];try{all=await tx('readonly',s=>s.getAll())||[]}catch(e){return 0}
  let n=0;for(const r of all){const ks=['primaryColor','secondaryColor','tertiaryColor'].filter(k=>num(r[k]));if(!ks.length)continue;
    const it=items.find(x=>x.id===r.id)||r;let ch=false;
    for(const k of ks){if(!num(it[k]))continue;const o=list[+it[k]];if(!o)continue;const own=CUSTOM_COL[o.key],m=kitColour(own?own.name:o.name);const c=m?m.k:own?o.key:null;
      if(c){it[k]=fitCol(it.type,c,k!=='primaryColor')||c;ch=true}}
    if(ch){await put(it);n++}}
  if(n){planDirty();todayDirty()}return n}
/* the last import taken out again, after its Undo has gone (from the import sheet) */
/* (fix round 3, W1-6-05: judged on this phone's copy alone, a piece renamed on another phone went too) a connected phone syncs first, so
   "changed since" counts changes made anywhere; offline it goes on with what it has */
async function kitUnimport(){if(syncUrl()&&localStorage.getItem('app_token')&&!inviteOver())try{await syncNow()}catch{}
  const l=kitLastImp();if(!l){const r=$('#kit-last');if(r)r.remove();return}
  if(!await askConfirm(`Take out the ${l.ids.length} item${l.ids.length===1?'':'s'} of your last import?\n\nAnything you added another way stays${l.kept?`, and so ${l.kept===1?'does the imported piece':`do the ${l.kept} imported pieces`} you changed since`:''}.`,{ok:'Take them out',danger:true}))return;
  try{await kitDelMany(l.ids)}catch(e){kitFail(e);return}
  try{localStorage.removeItem(KIT_IMP_LAST)}catch{}const r=$('#kit-last');if(r)r.remove();if(kitImp){kitDupMark(kitImp.rows);kitPrevDraw()}
  toast(`Taken out: ${l.ids.length} item${l.ids.length===1?'':'s'}.`,3000)}

/* ---- a sample wardrobe to try the app with: plain and patterned pieces enough for a varied month, marked sample ----
   It follows the dress code (no suits or blazers without jackets, then two more trousers; no ties without ties), is written in one go
   (a second tap is ignored, a kill stores all or nothing), and a tap after a partial sample from before adds only the pieces missing
   (matched by type, colours, pattern and cuffs). From the setup's last step it finishes the setup first (holidays, the vest default).
   A sample piece the owner changed is his: Remove the sample keeps it (kitEdited). (2026-11-15, the new-user audit) */
const KIT_SAMPLE=[
  ['suit','navy',null,'solid',{vest:'no',name:'Navy suit'}],['suit','charcoal',null,'pinstripe',{vest:'yes',name:'Charcoal pinstripe'}],['suit','midgrey',null,'herringbone',{vest:'no'}],
  ['blazer','navy',null,'solid',{name:'Navy blazer'}],['blazer','tan',null,'windowpane',{}],
  ['pants','grey',null,'solid',{}],['pants','stone',null,'solid',{trouserKind:'chinos'}],
  ['shirt','white',null,'solid',{}],['shirt','lightblue',null,'solid',{}],['shirt','white','blue','stripe',{}],['shirt','pink',null,'solid',{}],['shirt','white',null,'solid',{cuff:'french'}],
  ['tie','burgundy',null,'solid',{}],['tie','navy','white','polka-dot',{}],['tie','green',null,'solid',{}],['tie','silver',null,'solid',{}],['tie','navy','burgundy','stripe',{}],
  ['shoes','black',null,'solid',{shoeStyle:'oxford'}],['shoes','brown',null,'solid',{shoeStyle:'derby'}],
  ['belt','black',null,'solid',{}],['belt','brown',null,'solid',{}],['socks','navy',null,'solid',{}],['socks','charcoal',null,'solid',{}],['watch','silver',null,'solid',{metal:'silver'}]];
const KIT_SAMPLE_NOJKT=[['pants','navy',null,'solid',{}],['pants','charcoal',null,'solid',{}]];   // without jackets: trousers enough to judge (shop.js SHOP_MIN)
const KIT_EDIT_MS=3000;
const kitHasSample=()=>items.some(i=>i.sample&&!kitEdited(i));   // (pieces he made his alone are no sample wardrobe: a phone joining got the banner for them)
/* a sample piece he changed is his now. Only an edit he makes in the item sheet makes it his: app.js put sets item.sampleMine while the item sheet is open on it (kitUserEdit);
   a new stamp alone doesn't (re-audit 2026-11-15: a roll back or a start-up fix-up such as migrateVests or checkArrivals restamped an
   untouched sample piece, which was then uploaded and kept on Remove the sample), nor does out of rotation (itemsheet.js togglePause sets
   kitNoMine around its save: paused sample shoes stayed after Remove the sample) */
let kitNoMine=false;
const kitUserEdit=i=>{if(i&&i.sample&&!kitNoMine&&editing===i.id)i.sampleMine=1};
const kitEdited=i=>!!i.sample&&!!i.sampleMine;
/* the sample pieces the earlier rule counted as his (fix round 3, W1-3-01: an edit, a pause or a cleaning on 14-15 Nov builds made a piece
   his, updated more than KIT_EDIT_MS after added; the rule above turned them back into sample, and Remove the sample took them with their
   history). Once per device after the first pull, a sample piece added before the rule changed (KIT_MINE_CUT, when #454 was deployed)
   and stamped by the old rule is made his (no longer a sample piece, as Keep it as mine does, with a new stamp, so it goes up and other phones take it) */
const KIT_MINE_CUT=Date.UTC(2026,10,15,12);
const kitOldMine=i=>!!i&&!!i.sample&&!i.sampleMine&&(i.added||0)<KIT_MINE_CUT&&(i.updated||0)-Math.max(i.added||0,i.sampleBase||0)>KIT_EDIT_MS;
async function kitSampleMigrate(){try{if(localStorage.getItem('kit_mine'))return}catch{return}
  const l=items.filter(kitOldMine).map(i=>{const c={...i};delete c.sample;delete c.sampleMine;delete c.sampleBase;return c});   // (his, as Keep it as mine makes it)
  if(l.length){const now=Date.now();
    try{await kitTx(['items'],t=>{const s=t.objectStore('items');for(const it of l){it.updated=now;s.put(it)}})}catch(e){console.warn('sample pieces not kept as his',e);return}
    for(const it of l){const k=items.findIndex(x=>x.id===it.id);if(k>=0)items[k]=it}
    planDirty();todayDirty();if(window.scheduleSync)scheduleSync();
    toast(`${l.length===1?'The sample piece':`The ${l.length} sample pieces`} you changed ${l.length===1?'is':'are'} yours: Remove the sample keeps ${l.length===1?'it':'them'}.`,6000)}
  try{localStorage.setItem('kit_mine','1')}catch{}}
/* does a day's record, with the sample's pieces taken out (kitSampleDay), still hold anything of his? His own pieces, a pick, the week's
   lock of his own pieces, an occasion, a kind, a skip, a piece taken off, a trip. A record that holds nothing else was made from the
   sample: it never goes up (kitShareFilter below), and Remove the sample gives it the stamp KIT_YIELD, so the account's own record of that
   day, made on another phone, wins over it (fix round 3, W1-6-04: Remove the sample on a phone that tried the sample before joining
   stamped its sample days new and wiped the other phone's real days) */
const KIT_YIELD=1;
const KIT_OWN=['force','lock','occasion','formal','kind','skip','off','trip'];
const kitDayOwn=c=>!!(c.ids&&Object.values(c.ids).some(Boolean))||KIT_OWN.some(k=>c[k]&&(typeof c[k]!=='object'||Object.keys(c[k]).length));
const kitSampleSig=i=>[i.type,i.primaryColor,i.secondaryColor||'',hasPat(i.type)?i.pattern||'solid':'solid',i.cuff==='french'?'f':''].join('|');
function kitSampleCards(){const l=KIT_SAMPLE.filter(x=>!dressOut(x[0]));if(!wearsJacket())l.push(...KIT_SAMPLE_NOJKT);
  return l.map(([type,c,c2,p,x])=>({id:crypto.randomUUID(),manual:true,type,primaryColor:c,secondaryColor:c2,tertiaryColor:null,pattern:hasPat(type)?p:'solid',metal:'silver',leather:'calf',sample:true,...x}))}
let kitSampling=false;
/* items another tab stored that this one doesn't hold yet (each tab keeps its own `items`): taken in before the sample is counted */
async function kitAdopt(){let all=[];try{all=await tx('readonly',s=>s.getAll())||[]}catch(e){console.warn('wardrobe not read',e);return}
  const have=new Set(items.map(i=>i.id)),add=all.filter(i=>i&&i.id&&!have.has(i.id));if(!add.length)return;
  let tomb={};try{tomb=await metaGet('tombstones')||{}}catch{}
  const live=add.filter(i=>!(tomb[i.id]>=(i.updated||0)));if(live.length){items.push(...live);planDirty();todayDirty()}}
function kitSampleBusy(on){for(const b of document.querySelectorAll('#kit-sample-link,[onclick^="kitSampleLoad"],#kit-sample button')){b.disabled=on;if(on)b.setAttribute('aria-busy','true');else b.removeAttribute('aria-busy')}}
async function kitSampleLoad(){if(kitSampling)return;kitSampling=true;kitSampleBusy(true);
  try{await kitAdopt();   // what another tab of the app stored meanwhile (re-audit 2026-11-15: a stale second tab loaded a second sample, 48 pieces)
    const have=new Set(items.filter(i=>i.sample).map(kitSampleSig)),missing=kitSampleCards().filter(c=>!have.has(kitSampleSig(c)));
    if(!missing.length){kitSampleDone();toast('The sample wardrobe is already here: swipe through the days to see outfits.',4000);return}
    if(!have.size&&items.length&&!await askConfirm('Add the sample wardrobe next to your own clothes?',{ok:'Add the sample'}))return;
    // (connected: the sample stays on this phone, never backed up, kitShareFilter)
    if(!await kitStore(missing.map(kitItem)))return;   // (said why; nothing stored)
    kitSampleDone();
    toast(have.size?`The rest of the sample wardrobe is here: ${missing.length} more piece${missing.length===1?'':'s'}.`:`A sample wardrobe of ${missing.length} pieces: swipe through the days to see outfits.`,4500)}
  finally{kitSampling=false;kitSampleBusy(false)}}
/* then Today on the next workday; from the setup's last step the setup finishes first, as Skip and "Add my first item" finish it */
function kitSampleDone(){if(setupShown())setupFinish(false);
  planDirty();todayDirty();show('today');goToday()}   // on a weekend, the next workday's outfit
/* Remove the sample: every sample piece the owner didn't change goes, with what the days recorded of them (worn days, locks, picks;
   occasions stay), in one transaction; a changed one stays as his */
async function kitSampleRemove(quiet){if(kitSampling)return;   // quiet: already asked (account.js, connecting with the sample loaded)
  const s=items.filter(i=>i.sample);if(!s.length)return;
  const keep=s.filter(kitEdited),gone=s.filter(i=>!kitEdited(i)),kn=keep.length;
  const also=kn?`, and so ${kn===1?'does the sample piece':`do the ${kn} sample pieces`} you changed: ${kn===1?'it is':'they are'} yours now`:'';
  if(!quiet&&gone.length&&!await askConfirm(`Remove the ${gone.length} sample piece${gone.length===1?'':'s'}?\n\nYour own clothes stay${also}.`,{ok:'Remove',danger:true}))return;
  kitSampling=true;kitSampleBusy(true);if(!quiet)toast('Removing the sample…',8000);
  try{if(recordRun)await Promise.resolve(recordRun).catch(()=>{});   // (a recording of today from the plan with the sample, still running, would write its pieces back after)
    const ids=new Set(gone.map(i=>i.id)),mine=keep.map(i=>{const c={...i};delete c.sample;delete c.sampleMine;return c}),T=todayDate();
    const orig=Object.values(dayRecs).filter(r=>[...ids].some(id=>JSON.stringify(r).includes(id)));
    // a day made only from the sample keeps the stamp KIT_YIELD: the account's own record of it (another phone's) wins (kitDayOwn)
    const days=orig.map(r=>{const c=kitSampleDay(r,ids,T);if(!kitDayOwn(c))c.updated=KIT_YIELD;return c});
    const undo={items:s.map(i=>JSON.parse(JSON.stringify(i))),days:orig.map(r=>JSON.parse(JSON.stringify(r)))};
    await kitDelMany([...ids],mine,days);await clearLocks();
    undo.wrote=Object.fromEntries(days.map(c=>[c.date,c.updated]));kitRmUndo=undo;
    // connected: the account's records of those days come in before Today records anything from the plan (kitSampleUndo)
    if(isConnected()&&window.syncNow)await Promise.race([syncNow().catch(()=>{}),new Promise(r=>setTimeout(r,KIT_RM_SYNC))])}
  catch(e){kitFail(e);return}finally{kitSampling=false;kitSampleBusy(false)}
  if(quiet){planDirty();todayDirty();if(!$('#today').hidden)refreshToday();return}
  show(items.length?'today':'wardrobe');toast(kn?`The sample wardrobe is gone. The ${kn===1?'piece':`${kn} pieces`} you changed stayed.`:'The sample wardrobe is gone.',8000,{label:'Undo',fn:kitSampleUndo})}
/* Undo of Remove the sample (fix round 3): the pieces come back (a new stamp, newer than their deletion marks) as they were, and each day
   record still as Remove left it is put back as it was before; a day the account's record replaced meanwhile (a sync) keeps that. A day
   that went back to the sample keeps its old stamp when Remove had given it KIT_YIELD (it never went up), else takes a new one */
let kitRmUndo=null;const KIT_RM_SYNC=8000;
async function kitSampleUndo(){const u=kitRmUndo;if(!u||kitSampling)return;kitRmUndo=null;kitSampling=true;kitSampleBusy(true);
  try{const now=Date.now(),its=u.items.map(i=>({...i,updated:now}));
    const days=u.days.filter(r=>dayRecs[r.date]&&dayRecs[r.date].updated===u.wrote[r.date]).map(r=>({...r,updated:u.wrote[r.date]===KIT_YIELD?r.updated:now}));
    await kitTx(['items','days'],t=>{const s=t.objectStore('items'),d=t.objectStore('days');for(const it of its)s.put(it);for(const r of days)d.put(r)});
    const back=new Map(its.map(i=>[i.id,i]));setWardrobe({items:items.filter(i=>!back.has(i.id)).concat(its)});for(const r of days)dayRecs[r.date]=r;
    planDirty();todayDirty();if(window.scheduleSync)scheduleSync()}
  catch(e){kitFail(e);return}finally{kitSampling=false;kitSampleBusy(false)}
  show('today');toast('The sample wardrobe is back.',3000)}
/* a day's record with the sample's pieces taken out (re-audit 2026-11-15, N2: the record was cut to its occasion, and history.js recordDays
   then filled the past day again from today's plan: "Didn't" days became worn, a suit bought later was worn before it came, real wears were
   replaced). Everything else the day recorded stays: worn or not, a corrected day, the occasion, the own pieces.
   - a past day (or one marked worn): the sample's slots are emptied and marked gone (planner.js frozenOutfit rates the day without them, as
     after a Delete); a day that wore only sample pieces keeps no outfit (noOutfit: recordDays leaves it, the planner and Insights skip it,
     Today says so)
   - today and the coming days: their pieces, lock and picks of sample pieces go, and the day is planned again from what is left */
function kitSampleDay(r,ids,T){const c=JSON.parse(JSON.stringify(r)),hit=o=>!!o&&Object.values(o).some(v=>ids.has(v));
  const strip=k=>{if(!hit(c[k]))return;for(const [s,v] of Object.entries(c[k]))if(ids.has(v))delete c[k][s];if(!Object.keys(c[k]).length)delete c[k]};
  if(hit(c.lock)){delete c.lock;delete c.lockAt}strip('force');
  if(hit(c.ids)){
    if(keyDate(c.date)<T||c.worn===true){const g={};for(const [s,v] of Object.entries(c.ids))if(ids.has(v)){c.ids[s]=null;g[s]=1}
      if(Object.values(c.ids).some(Boolean))c.gone={...(c.gone||{}),...g};
      else{for(const k of ['ids','suitDay','vestOn','gone','auto'])delete c[k];c.noOutfit=1}}
    else for(const k of ['ids','suitDay','vestOn','auto'])delete c[k]}
  return c}
/* ---- what of the sample goes up with a backup (moved here from sync.js, the code review's CR-5-10: sync.js reached into this file's
   rules; it now calls kitShareFilter as it calls cleanState, kitSentStamp for a day's stamp and kitShareDone after a save went through) ---- */
/* the sample wardrobe stays on this phone (re-audit 2026-11-15, N7: loaded while connected, it was backed up into the person's real
   wardrobe and showed on his other phones): uploads leave out the sample pieces he hasn't made his (kitEdited) and the day records
   naming one; Remove the sample rewrites those records (kitSampleDay) with a new stamp, and they go up then. Applied to what is
   sent only: the merge and this phone's copy are unchanged */
/* fix round 3 (W1-3-02, W1-6-04): a day naming a sample piece goes up with the sample's pieces taken out (kitSampleDay, today
   counted as a past day so its own pieces stay), when that still holds anything of his (kitDayOwn): a "Didn't" or a swap on a day with one
   sample piece was held back for good, and a phone joining was told he hadn't opened the app. A day made only from the sample, and one
   Remove the sample left to yield (KIT_YIELD), never goes up: it would replace the account's own record of that day; except a "Didn't" /
   "Wore" or a correction he made on it after this phone joined the account (join: sync.js syncJoinAt): it goes up with no outfit (noOutfit), so his
   mark reaches his other phones (W1-3-02: a phone updated from 15 Nov with the sample in its backup), while a phone that tried the sample
   before joining (W1-6-04) sends none of its sample days.
   remote (the whole backup, PUT only): a day left out keeps the backup's copy, since a PUT replaces the whole backup */
/* today and the coming days follow the plan, which differs between a phone with the sample and one without: each re-locked and recorded
   the other's copy, a save at every sync (measured in the lab: a write every other background, 0 before). So such a day (sent without the
   sample) goes up once per change of what he decided on it (kitSdSig: worn, a correction, his picks, the occasion, a piece off...), not
   for the app's own locks and records; localStorage sync_sd keeps what was sent per date (kitShareDone after a save went through) */
let kitSdNew={};
const KIT_SD=['worn','edited','noOutfit','force','occasion','formal','kind','skip','off','trip','vest'];
const kitSdSig=c=>JSON.stringify(KIT_SD.map(k=>c[k]===undefined?null:c[k]));
function kitSdGet(){try{return JSON.parse(localStorage.getItem('sync_sd')||'{}')||{}}catch{return {}}}
function kitShareDone(){const n=kitSdNew;kitSdNew={};if(!Object.keys(n).length)return;const T=todayDate(),m={...kitSdGet(),...n},old=new Date(T.getFullYear(),T.getMonth(),T.getDate()-KIT_SD_DAYS);
  for(const k of Object.keys(m))if(keyDate(k)<old)delete m[k];try{localStorage.setItem('sync_sd',JSON.stringify(m))}catch{}}
/* W1-3-03: a day he opened the app on in the account (recorded after this phone joined) but dressed only from the sample went
   nowhere, and a phone joining later recorded it from its own plan and said "you didn't open the app". It goes up with no outfit and the
   stamp KIT_YIELD: the backup takes it only where it has no record of that day, or only the app's lock built on nothing (core.js dayWins,
   base 0); any real record of the day, another phone's, wins. kitOrig: the record's own stamp, which decides whether it is sent */
const KIT_SD_DAYS=60,kitOrig=new WeakMap();
const kitSentStamp=d=>kitOrig.has(d)?kitOrig.get(d):(d.updated||0);
/* a piece that goes up: his own, or a sample piece he made his */
const kitSends=i=>!(i&&i.sample)||kitEdited(i);
/* st as sent (the merge and this phone's copy are unchanged); remote: the whole backup (PUT only), else null; join: when this phone joined
   the account (sync.js syncJoinAt), 0 if not known */
function kitShareFilter(st,remote,join){kitSdNew={};const off=new Set((st.items||[]).filter(i=>!kitSends(i)).map(i=>i.id)),yd=d=>d.updated===KIT_YIELD;
  if(!off.size&&!(st.days||[]).some(yd))return st;
  const names=r=>[r.ids,r.lock,r.force].some(o=>o&&Object.values(o).some(v=>off.has(v)));
  const T=todayDate(),T1=new Date(T.getFullYear(),T.getMonth(),T.getDate()+1),rd=new Map(((remote&&remote.days)||[]).map(d=>[d.date,d])),days=[];
  const said=(c,d)=>(c.worn!==undefined||!!c.edited)&&join>0&&(d.updated||0)>join,sd=kitSdGet();
  for(const d of st.days||[]){let c=d,y=false;
    if(yd(d))c=null;else if(names(d))c=kitSampleDay(d,off,T1);
    if(c&&c!==d&&!kitDayOwn(c)&&!said(c,d)){
      // (a day he used the app on in the account, dressed only from the sample: a yielding copy, see kitOrig)
      if(join>0&&(d.updated||0)>join&&keyDate(d.date)<T1){c={...c,updated:KIT_YIELD};y=true}else c=null}
    if(c&&c!==d&&(y||keyDate(d.date)>=T)){const g=(y?'y':'')+kitSdSig(c);if(sd[d.date]===g)c=null;else{kitSdNew[d.date]=g;if(y)kitOrig.set(c,d.updated||0)}}   // (today, coming days, yielding copies: once per change of his)
    if(c&&y&&rd.has(d.date))c=mergeState({days:[rd.get(d.date)]},{days:[c]}).days[0];   // (a PUT: the backup's copy unless it is only a lock built on nothing)
    if(c)days.push(c);else if(rd.has(d.date))days.push(rd.get(d.date))}
  return {...st,items:st.items.filter(i=>!off.has(i.id)),days}}
/* a sample piece kept as the owner's own (the item sheet) */
async function kitKeepSample(id){const it=items.find(i=>i.id===id);if(!it||!it.sample)return;delete it.sample;delete it.sampleMine;await put(it);planDirty();todayDirty();
  if($('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();toast('It’s yours now: Remove the sample keeps it.',3000)}
/* marks: the Wardrobe grid's tag and the item sheet's note */
const kitSampleTag=i=>i.sample&&!kitEdited(i)?'<span class="pausetag sampletag">Sample</span>':'';
const kitSampleNote=i=>i.sample&&!kitEdited(i)?`<section class="card ivsec ivsample"><p class="shelp">A piece of the sample wardrobe: Remove the sample takes it away. Change anything on it, or keep it, and it stays as yours.</p><div class="btns"><button type="button" id="iv-keep" data-act="kitKeepTap" data-id="${esc(i.id)}">Keep it as mine</button></div></section>`:'';
/* Today, while sample pieces are there */
function kitSampleBanner(){if(!kitHasSample())return '';const own=items.filter(i=>!i.sample||kitEdited(i)).length;
  return `<div class="kit-banner" id="kit-sample"><b>You're trying a sample wardrobe</b><small>${own?`Your ${own} own piece${own===1?' is':'s are'} mixed in. `:''}Swipe through the days, tap the score, try a swap. Add your own clothes whenever you like.</small>
<div class="btns"><button type="button" data-act="kitAddOwnTap">Add my own</button><button type="button" data-act="kitSampleRemoveTap">Remove the sample</button></div></div>`}
/* the setup's last step, Today's checklist and the empty Wardrobe: the ways in for a new user */
const kitStartRow=inSetup=>`<div class="kit-start"><button type="button" class="linkbtn" id="kit-tour-link" data-act="kitTourTap">Take the 1-minute tour</button><span aria-hidden="true">·</span><button type="button" class="linkbtn" id="kit-sample-link"${inSetup?' data-act="kitSetupSampleTap"':' data-act="kitSampleTap"'}>Try a sample wardrobe</button></div>`;
/* the sample's and the ways-in's controls (act.js): the item sheet's "Keep it as mine" (data-id), Today's banner, the tour link, and "Try a
   sample wardrobe" (on the setup's last step it goes through setup.js setupSample, with the tap for its double-tap guard) */
function kitKeepTap(el){kitKeepSample(el.dataset.id)}
function kitAddOwnTap(){openAdd()}
function kitSampleRemoveTap(){kitSampleRemove()}
function kitTourTap(){tourOpen()}
function kitSampleTap(){kitSampleLoad()}
function kitSetupSampleTap(el,ev){setupSample(ev)}

/* ---- Add to Home Screen (2026-11-14, the owner: show a new person on an iPhone how to add it as a web app) ----
   iPhone and iPad only, in a browser tab (homeNeeded): the setup's Home Screen step (setup.js) and Settings → About (#home-again). The app
   on the Home Screen opens full screen, and it is the only way iOS lets a web app show notifications (the morning reminder). It keeps its
   own storage apart from Safari's, so the step comes before anything is set up. window.DW_STANDALONE / DW_IOS: tests */
const homeIOS=()=>window.DW_IOS===true||/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const homeStandalone=()=>window.DW_STANDALONE===true||navigator.standalone===true||(typeof matchMedia==='function'&&matchMedia('(display-mode: standalone)').matches);
/* Android (2026-11-14, the owner: "the same thing for android with an install button"): Chrome and other Android browsers offer the install
   themselves (beforeinstallprompt, kept in homeEvt): the step's Install button opens the browser's own dialog; where the browser gives none
   (Firefox, an install dismissed, a browser that never offers it) the step shows the menu steps instead. The installed app shares the
   browser's storage, so nothing is said about setting up first. window.DW_ANDROID: tests */
const homeAndroid=()=>window.DW_ANDROID===true||(!homeIOS()&&/Android/i.test(navigator.userAgent));
const homeNeeded=()=>(homeIOS()||homeAndroid())&&!homeStandalone();
let homeEvt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();homeEvt=e;homeSync()});
addEventListener('appinstalled',()=>{homeEvt=null;homeSync();toast('Installed. Open Daily Wardrobe from its new icon.')});
/* the Install button where the browser offers it, the menu steps where it doesn't (updated in place: the offer can come after the step is drawn) */
function homeSync(){const can=!!homeEvt;document.querySelectorAll('.home-install').forEach(b=>b.hidden=!can);document.querySelectorAll('.home-manual').forEach(m=>m.hidden=can)}
async function homeInstall(){const e=homeEvt;if(!e)return homeSync();homeEvt=null;   // (the browser's offer can be used once)
  try{await e.prompt();const r=await e.userChoice;if(r&&r.outcome==='accepted'){toast('Installing… open Daily Wardrobe from its new icon.')}}catch(_){}
  homeSync()}
const homeIPad=()=>/iPad/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
/* which browser the app is open in on an iPhone or iPad (2026-11-16, a tester used Chrome and was shown Safari's steps): every iOS browser
   draws with Safari's engine but has its own buttons, and a Home Screen app added from any of them keeps its own storage. window.DW_BROWSER: tests */
const homeBrowser=()=>window.DW_BROWSER||(/CriOS/.test(navigator.userAgent)?'Chrome':/FxiOS/.test(navigator.userAgent)?'Firefox':/EdgiOS/.test(navigator.userAgent)?'Edge':'Safari');
/* the first step, per browser: Chrome's Share is at the right end of its address bar (in its ⋯ menu when not); Firefox's and Edge's are in their menu */
function homeShareStep(pad){const b=homeBrowser();
  if(b==='Chrome')return '<li><span class="home-n">1</span><span>Tap Share '+HOME_SHARE+' at the right end of Chrome\'s address bar.<small>Not there? Tap <b>⋯</b>, then <b>Share</b>.</small></span></li>';
  if(b!=='Safari')return '<li><span class="home-n">1</span><span>Open '+b+'\'s menu and tap <b>Share</b> '+HOME_SHARE+'.</span></li>';
  return pad?'<li><span class="home-n">1</span><span>Tap Share '+HOME_SHARE+' at the top right of Safari.</span></li>'
    :'<li><span class="home-n">1</span><span>Tap <b>⋯</b> at the bottom right of Safari, then <b>Share</b> '+HOME_SHARE+'.<small>If you see Share '+HOME_SHARE+' there instead, tap it.</small></span></li>'}
/* the same in a few words, for a line elsewhere (Settings → reminders) */
const homeShareShort=()=>{const b=homeBrowser();return b==='Chrome'?'tap Share in Chrome’s address bar, then “Add to Home Screen”':b==='Safari'?'tap ⋯, then Share, then “Add to Home Screen”':`open ${b}’s menu, tap Share, then “Add to Home Screen”`};
const HOME_SHARE='<svg viewBox="0 0 24 24" class="home-ico" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10H5v11h14V10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const HOME_DL='<svg viewBox="0 0 24 24" class="home-ico" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HOME_ADD='<svg viewBox="0 0 24 24" class="home-ico" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
/* the picture: the phone's screen with the app's own icon (icon-192.png) on it */
const homePic=()=>'<svg viewBox="0 0 120 160" class="home-pic" aria-hidden="true"><rect x="22" y="6" width="76" height="148" rx="14" class="hp-phone"/><rect x="28" y="20" width="64" height="120" rx="4" class="hp-screen"/>'+
  [[34,30],[52,30],[70,30],[34,50],[52,50],[70,50],[34,70]].map(([x,y],i)=>i===6?'<clipPath id="hp-clip"><rect x="'+x+'" y="'+y+'" width="14" height="14" rx="3.5"/></clipPath><image href="icon-192.png" x="'+x+'" y="'+y+'" width="14" height="14" clip-path="url(#hp-clip)"/>':'<rect x="'+x+'" y="'+y+'" width="14" height="14" rx="3.5" class="hp-icon"/>').join('')+
  '<text x="41" y="94" class="hp-label">Wardrobe</text></svg>';
function homeStepsAndroid(inSetup){
  return '<div class="home-wrap">'+homePic()+'<p class="su-lead home-lead">Install Daily Wardrobe on your phone: it gets its own icon and opens full screen like an app, straight to today\'s outfit.</p>'+
    '<p class="home-cta"><button type="button" class="pri home-install"'+(homeEvt?'':' hidden')+' data-act="homeInstallTap">'+HOME_DL+' Install the app</button></p>'+
    '<div class="home-manual"'+(homeEvt?' hidden':'')+'><ol class="home-steps"><li><span class="home-n">1</span><span>Tap the menu <b>⋮</b> at the top right of your browser.</span></li>'+
    '<li><span class="home-n">2</span><span>Tap <b>Install app</b> or <b>Add to Home screen</b>.</span></li>'+
    '<li><span class="home-n">3</span><span>Tap <b>Install</b>, then open Daily Wardrobe from its new icon.</span></li></ol></div>'+
    (inSetup?'<p class="su-note home-note">Everything you set up here comes with it.</p><p class="su-help">Or tap Next to carry on here.</p>':'')+'</div>'}
/* (audit 2026-11-15, H12) the one explanation of the Home Screen app on an iPhone: the setup's step, About's button and the sheet a tester
   gets after connecting from a link (account.js homeScreenGuide) all show this. iOS 26's Safari shows ⋯ at the bottom (Share is in its
   menu); the Home Screen app keeps its own storage and starts unconnected, so a tester copies the invitation link here to paste there */
const homeTester=()=>isTester()&&!!myInviteLink();
const homeCopyBtn=()=>'<p class="home-cta"><button type="button" class="pri home-copy" data-act="homeCopyTap">Copy my invitation link</button></p><input type="text" class="home-mylink" readonly hidden aria-label="Your invitation link">';
async function homeCopy(){const l=myInviteLink();if(!l)return false;
  try{await navigator.clipboard.writeText(l);toast('Your invitation link is copied. Paste it in the Home Screen app.',4500);return true}
  catch{document.querySelectorAll('.home-mylink').forEach(f=>{f.hidden=false;f.value=l;f.select()});toast('Copy the link shown under the button.',5000);return false}}
function homeNote(){const conn=isConnected(),b=homeBrowser();
  if(homeTester())return '<p class="su-note home-note"><b>'+b+' is connected already.</b> The Home Screen app keeps its own storage, apart from '+b+'\'s, so it starts empty: paste your invitation link when it asks, and your wardrobe comes across.</p>';
  if(conn)return '<p class="su-note home-note"><b>'+b+' is connected already.</b> The Home Screen app keeps its own storage, apart from '+b+'\'s: connect it too, in its Settings → Connection.</p>';
  if(items.length)return '<p class="su-note home-note"><b>Your wardrobe stays here in '+b+'.</b> The Home Screen app keeps its own storage and starts empty. To take your wardrobe along, tap <b>Download backup</b> in Settings → Backup &amp; sync here, then <b>Restore file</b> in the Home Screen app.</p>';
  return '<p class="su-note home-note"><b>The Home Screen app keeps its own storage</b>, apart from '+b+'\'s: if you add it now, set it up there rather than here.</p>'}
function homeSteps(inSetup){if(homeAndroid())return homeStepsAndroid(inSetup);const pad=homeIPad(),t=homeTester();
  return '<div class="home-wrap">'+homePic()+'<p class="su-lead home-lead">Put Daily Wardrobe on your Home Screen: it opens full screen like an app, and it is the only way your '+(pad?'iPad':'iPhone')+' lets it send the morning reminder.</p>'+
    '<ol class="home-steps">'+homeShareStep(pad)+
    '<li><span class="home-n">2</span><span>Tap <b>Add to Home Screen</b> '+HOME_ADD+'.<small>Not in the list? Scroll down, or tap '+(homeBrowser()==='Safari'?'View More':'Edit Actions')+'.</small></span></li>'+
    '<li><span class="home-n">3</span><span>Leave <b>Open as Web App</b> on and tap <b>Add</b>.</span></li>'+
    '<li><span class="home-n">4</span><span>Open Daily Wardrobe from its new icon'+(t?' and paste your invitation link at the setup\'s Connection step.':'.')+'</span></li></ol>'+
    (t?homeCopyBtn():'')+homeNote()+homeRisk(pad)+(inSetup?'<p class="su-help">Or tap Next to carry on here.</p>':'')+'</div>'}
/* (2026-11-16, the owner's decision 2 for W1-11-04) someone using the app in a Safari tab with no connection is told once, here (the
   setup's Home Screen step, also About's sheet), that Safari can clear it; Backup & sync says it under its status (sync-status.js safariWord), and
   safariRemind reminds such a person once there are SAFARI_MIN items that were never backed up */
function homeRisk(pad){if(isConnected())return '';
  return `<p class="su-help home-risk">In a ${homeBrowser()} tab, your ${pad?'iPad':'iPhone'} can clear the app’s data when it isn’t opened for about a week or runs short of space. The Home Screen app isn’t cleared that way, and <b>Download backup</b> in Settings → Backup &amp; sync keeps a copy in Files.</p>`}
const SAFARI_MIN=10,SAFARI_EVERY=30*864e5;
/* a Safari-only wardrobe (an iPhone or iPad tab, not connected) of SAFARI_MIN+ items never backed up (no backup ever, no backup file
   downloaded): a reminder with Download backup, at start-up, at most once every SAFARI_EVERY (localStorage safari_remind) */
function safariRemind(){try{if(!homeIOS()||homeStandalone()||isConnected())return false;
  if(items.filter(i=>!i.sample).length<SAFARI_MIN||localStorage.getItem('last_sync')||localStorage.getItem('backup_file_at'))return false;
  if(Date.now()-(+localStorage.getItem('safari_remind')||0)<SAFARI_EVERY)return false;
  if(setupShown())return false;
  const t=$('#toast');if(t&&t.classList.contains('on')){setTimeout(safariRemind,6000);return false}   // (not over another message)
  localStorage.setItem('safari_remind',Date.now());
  toast(`Your ${items.filter(i=>!i.sample).length} items are only in ${homeBrowser()} on this ${homeIPad()?'iPad':'iPhone'}, and ${homeBrowser()} can clear a website’s data. Download a backup to keep a copy in Files.`,12000,{label:'Download backup',fn:downloadBackup});return true}
  catch{return false}}
const homeLabel=()=>homeAndroid()?'Install the app':'Add to Home Screen';
const HOME_CARD={key:'home',get title(){return homeLabel()},pic:()=>'',last:'Got it',get body(){return homeSteps(false)}};
function homeOpen(){kitOpen([HOME_CARD])}
/* Settings → About: the button only where it helps */
function homeAbout(){const b=$('#home-again');if(b){b.hidden=!homeNeeded();b.textContent=homeLabel()}}
Object.assign(globalThis,{PAPER_CARD,kitUserEdit,kitEdited,kitSentStamp,kitSampleTag,kitSampleNote,kitStartRow,homeIOS,homeStandalone,homeAndroid,homeNeeded,homeBrowser,homeShareShort,homeTester,homeCopyBtn,HOME_CARD});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,KIT_IMP_LAST,KIT_IMP_UNDO_MS,KIT_MINE_CUT,KIT_TEMPLATE,KIT_YIELD,homeAgain,kitDelMany,kitDraw,kitDupMark,kitEdited,kitEl,get kitImp(){return kitImp},get kitImpBusy(){return kitImpBusy},kitImportFile,kitImportGo,kitImportText,kitItem,kitLastImp,kitRead,kitSampleRemove,kitSampleSig,get kitSampling(){return kitSampling},get kitSdNew(){return kitSdNew},set kitSdNew(v){kitSdNew=v},kitSends,kitStore,kitTemplate,kitTx,kitType,kitUnimport,kitUnsave,tourAgain};
export {kit,kitImpBusy,tourSeen,kitEl,kitOpen,kitClose,kitDraw,tourOpen,tourAgain,homeAgain,PAPER_CARD,kitQuiet,kitSaved,kitUnsave,kitTx,kitItem,kitStore,kitDelMany,kitDuplicate,kitType,kitRead,KIT_TEMPLATE,kitTemplate,kitImp,KIT_IMP_LAST,KIT_IMP_UNDO_MS,kitLastImp,kitImportOpen,kitImportFile,kitDupMark,kitImportText,kitImportGo,kitFixOldImports,kitUnimport,kitNoMine,kitUserEdit,kitEdited,KIT_MINE_CUT,kitSampleMigrate,KIT_YIELD,kitSampleSig,kitSampling,kitSampleLoad,kitSampleRemove,kitSdNew,kitShareDone,kitSentStamp,kitSends,kitShareFilter,kitSampleTag,kitSampleNote,kitSampleBanner,kitStartRow,homeIOS,homeStandalone,homeAndroid,homeNeeded,homeBrowser,homeShareShort,homeTester,homeCopyBtn,homeSteps,safariRemind,HOME_CARD,homeOpen,homeAbout,setKitNoMine};
homeAbout();   // (once at start: the device doesn't change; Settings can open straight on About, where renderAbout doesn't run)
/* the Home Screen step's Install and "Copy my invitation link" (act.js) */
function homeInstallTap(){homeInstall()}
function homeCopyTap(){homeCopy()}
/* index.html's (act.js): Add's "Import from a spreadsheet", and Settings' "Take the tour" and "Add to Home Screen" */
function importOpenTap(){kitImportOpen()}
function tourAgainTap(){tourAgain()}
function homeAgainTap(){homeAgain()}
acts({kitShut,kitBackTap,kitNextTap,kitGuideTap,kitUnimportTap,kitTemplateTap,kitFilePick,kitPasteFocus,kitPasteType,kitImpTap,kitTickPick,kitAsNewTap,
  kitKeepTap,kitAddOwnTap,kitSampleRemoveTap,kitTourTap,kitSampleTap,kitSetupSampleTap,homeInstallTap,homeCopyTap,
  importOpenTap,tourAgainTap,homeAgainTap});
