/* Daily Wardrobe: Add without a photo (split from add.js, Round C 2026-11-17): addManual, the type Today's "Add one" asked for
   (addFor), and the bottom sheet the card opens in (#nps-sheet: open, draw, close, Back, swipe). */
/* a card changed: add.js redraws Add on it (bus.js 'card-changed'; the restructure S3c, 2026-11-26: this file loads before add.js) */
import {askFor,serve,emit} from './bus.js';   // serve: nav.js (required) sets and drops what Today's "Add one" asked for, and leaves the sheet, through sockets
import {addCardRec,addWatch} from './add-keep.js';
import {keepFocus,queue} from './app.js';
import {$,PAIR_TYPES,TYPES,normPat,watchOpts} from './core.js';
import {cardSafe,ckLeftLine,confBtn,formCard,shirtColFix} from './add-card.js';
import {esc} from './photo-keys.js';
import {backBorrow,backOn,backPush,backReturn} from './back.js';
import {cmpMount} from './checklist.js';
import {askAnswer,askConfirm,asking,layerInert,sheetSwipe} from './ui.js';
import {cardReading} from './add-ids.js';
import {acts} from './act.js';
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
  const pl=PAIR_TYPES.includes(addFor);
  n.innerHTML=t?`Adding ${pl?'':/^[aeiou]/i.test(t)?'an ':'a '}<b>${esc(t.toLowerCase())}</b>: take a photo of ${pl?'them':'it'}, or tap “Add without a photo”.`:''}
/* ---- the "Add without a photo" sheet (#nps-sheet, in #add so the card keeps Add's styles): grabber, the title with the hanger icon, ×
   in the header (the card's own × is left out), the card in the middle, Confirm and Cancel pinned at the bottom (#nps-bar). The card stays
   in `queue` (its place there is its index, as for every card); only its drawing moves (renderAdd → npsDraw).
   Closing without saving (×, Cancel, a swipe down, the backdrop, Escape, the phone's Back) drops the card; once anything on it was
   changed it asks "Discard this item?" first. Confirm saves it, and the sheet closes when the card leaves the queue (npsDraw).
   Back: the sheet borrows Add's history entry (back.js backBorrow('nps'), kept in npsWas); closed by a tap it hands it back. ---- */
let npsId=null,npsWas,npsSnap='',npsAsking=false,npsFrom=null,npsSwipeOn=false;
/* what the card holds, to tell whether anything was changed (its form as kept, its close-up) */
const npsSig=q=>{if(!q)return '';const o=addCardRec(q);delete o.swatch;delete o.swSrc;delete o.checked;return JSON.stringify(o)+'|'+(q.texture?q.texture.length:0)};
const npsCard=()=>npsId?queue.find(q=>q.id===npsId):null;
function npsOpen(id){const s=$('#nps-sheet'),b=$('#nps-backdrop');if(!s)return;const again=!!npsId;npsId=id;
  if(!again){npsFrom=document.activeElement;npsWas=backBorrow('nps')}
  emit('card-changed');npsSnap=npsSig(npsCard());npsSwipe();
  s.classList.add('on');b.classList.add('on');document.body.classList.add('nps-on');npsInert(true);
  const body=$('#nps-q');if(body&&!again)body.scrollTop=0;
  if(!again)try{s.focus({preventScroll:true})}catch{}}
/* the page under the sheet (header, the tab bar, the rest of Add) can't be reached while it is up */
function npsInert(on){for(const el of document.querySelectorAll('body>header,body>nav'))el.inert=on;const a=$('#add');if(!a)return;
  for(const el of a.children)if(el.id!=='nps-sheet'&&el.id!=='nps-backdrop')el.inert=on}
/* the card and its bar; the card gone (saved, or taken away) closes the sheet */
function npsDraw(){const q=npsCard(),s=$('#nps-sheet');if(!s)return;if(!q){npsClose();return}const i=queue.indexOf(q),body=$('#nps-q'),bar=$('#nps-bar');
  if(body){const y=body.scrollTop;keepFocus(body,()=>{body.innerHTML=cardSafe(q,i,()=>formCard(q,i,true))});body.scrollTop=y;if(typeof cmpMount==='function')cmpMount(body)}
  if(bar)bar.innerHTML=`${cardSafe(q,i,()=>ckLeftLine(q))}${confBtn(q,i)}<button type="button" id="nps-cancel" data-act="npsCancelTap">Cancel</button>`}
function npsCancelTap(){npsCancel()}
/* fromBack: the phone's Back did it (its entry is gone already) */
function npsClose(fromBack){if(!npsId&&npsWas===undefined)return;const s=$('#nps-sheet'),b=$('#nps-backdrop');npsId=null;npsAsking=false;
  if(s)s.classList.remove('on');if(b)b.classList.remove('on');document.body.classList.remove('nps-on');npsInert(false);if(typeof layerInert==='function')layerInert();
  const was=npsWas;npsWas=undefined;backReturn('nps',was,fromBack);
  const f=npsFrom;npsFrom=null;const to=f&&f.isConnected&&!f.closest('[inert]')&&f!==document.body?f:$('#add-manual');
  if(to&&$('#add')&&!$('#add').hidden)try{to.focus({preventScroll:true})}catch{}
  setTimeout(()=>{if(!npsId){const body=$('#nps-q'),bar=$('#nps-bar');if(body)body.innerHTML='';if(bar)bar.innerHTML=''}},320)}   // (emptied once it has slid away)
/* ×, Cancel, a swipe, the backdrop, Escape, Back: asks first when the card was changed; -> whether it closed */
async function npsCancel(fromBack){const q=npsCard();if(!npsId||npsAsking)return false;
  if(q&&(q.saving||cardReading(q))){if(fromBack)backPush('nps');return false}   // (being saved or read: it stays, and Back's entry is made again)
  if(q&&npsSig(q)!==npsSnap){if(fromBack)backPush('nps');   // the sheet stays while it asks: its entry again, for the question to borrow
    npsAsking=true;const go=await askConfirm('Discard this item?\n\nWhat you picked on it is not saved.',{ok:'Discard',cancel:'Keep editing',danger:true});npsAsking=false;
    if(!go||npsCard()!==q)return false;npsClose();askFor('skip-card',q.id);return true}
  const id=npsId;npsClose(fromBack);if(q)askFor('skip-card',id);return true}
function npsBack(){if(npsId)npsCancel(true)}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setAddFor(v){addFor=v}
/* An ES module since 2026-11-23: its other names are its own. The bridge (tests/bridge.test.js lists it): add.js (renderAddFor, npsDraw,
   npsId), ui.js (npsId, npsAsking, npsInert, npsCancel) and start.js (npsLeave); addManual and npsClose are called by the tests.
   npsId and npsAsking are written here only: getters. start.js sets addFor with setAddFor (S1a; the tests read it through HOOK). Before backOn() and
   acts(), the file's two calls that can throw (back.js or act.js not loaded): the names are then still the page's, as a classic
   script's were (every one is a function, or a let declared above) */
Object.assign(globalThis,{renderAddFor,npsInert,npsDraw,npsCancel,npsLeave,setAddFor});
Object.defineProperties(globalThis,{npsId:{get:()=>npsId},npsAsking:{get:()=>npsAsking}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,addManual,npsClose,get addFor(){return addFor},npsCancel,get npsId(){return npsId}};
export {addManual,addFor,renderAddFor,npsId,npsAsking,npsInert,npsDraw,npsClose,npsCancel,npsLeave,setAddFor};
/* the router (nav.js, a required file loaded before this one) reaches these through bus.js sockets (the restructure S3c): opening Add
   with a type ('add-for'), and leaving Add with the sheet open ('nps-leave'); without this file they do nothing */
serve('add-for',setAddFor);serve('nps-leave',npsLeave);
backOn('nps',()=>npsBack());
/* Add left while the sheet is up (start.js show): the sheet closes; a card with changes stays on Add as a card of the list, an
   untouched one goes */
function npsLeave(){if(!npsId)return;const q=npsCard(),changed=!!q&&npsSig(q)!==npsSnap;if(npsAsking&&typeof asking!=='undefined'&&asking)askAnswer(false);
  npsClose();if(q&&!changed)askFor('skip-card',q.id)}
/* swiping the sheet down closes it, as What to buy and the item sheet: its header is a handle at any time, the card only while it is
   scrolled to the top; past a quarter of its height or a flick it closes (asking first when changed), else it springs back */
function npsSwipe(){if(npsSwipeOn)return;const s=$('#nps-sheet');if(!s)return;npsSwipeOn=true;
  sheetSwipe(s,{head:'.nps-head',body:()=>$('#nps-q'),backdrop:()=>$('#nps-backdrop'),live:()=>!!npsId&&!npsAsking,close:()=>npsCancel()});
  s.addEventListener('keydown',e=>{if(e.key==='Escape'&&npsId&&!npsAsking){e.preventDefault();e.stopPropagation();npsCancel()}})}
/* the markup's handlers (act.js): "Add without a photo", and its sheet's backdrop and ✕ */
function addManualTap(){addManual()}
function npsCloseTap(){npsCancel()}
acts({npsCancelTap,addManualTap,npsCloseTap});
