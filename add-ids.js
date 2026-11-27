/* Daily Wardrobe: Add, a card found by its id, and what state it is in (the restructure S3c, 2026-11-26: moved here from add-save.js and
   add.js, so the files that draw and read a card, loaded before those two, find it in a file that ran before them). Nothing here draws. (cardOf, qAt, cardAt and cardIx are app.js's since the restructure S6a, beside the queue.) */
import {jsq} from './photo-keys.js';
import {TAG_Q,inviteOver,esc} from './core.js';
import {applyWb,closeRead} from './measure.js';
import {cardAt} from './app.js';
const qh=q=>`qAt('${jsq(q.id)}')`;
/* a card Claude is still reading (tagging again with the close-up, or its pattern) can't be saved yet: saved meanwhile it kept the
   weaker reading and the pattern call was paid for anyway (audit 2026-11-13); Confirm and Save all wait for it */
const cardReading=q=>!!(q&&(q.refining||q.patternReading));
/* a card not read by Claude (not connected, or the reading failed) doesn't pretend to know the type: it asks for it first (it said
   "Suit · Grey" for a photo of a white shirt, and Confirm saved a grey suit); a type chosen by hand ends it */
const needType=q=>!!q&&!!q.unread&&!q.manual&&!q.ai&&!q.busy&&!q.err&&!q.multiBusy&&!q.multiErr&&!(q.edited&&q.edited.type);
/* (moved from tagging.js with its text unchanged, the restructure S6c) */
async function closeTagImg(q){if(q.texDone)return q.raw.tex.toDataURL('image/jpeg',TAG_Q);   // a card brought back after a kill: its close-up is already corrected (add-keep.js addRevive)
  const r=closeRead(q.raw.tex),g=r.ref?r.gains:(q.wbOff?null:q.wb);return applyWb(q.raw.tex,g).toDataURL('image/jpeg',TAG_Q)}
/* one reading of each kind per Add card (CR-2-03, CR-2-10): a newer close-up, Skip or Remove calls the earlier one off (its request is
   aborted: the worker gives a tester's count back), and only the latest may apply its answer or clear q.refining / q.patternReading.
   Kept beside the card, not on it (an AbortController is not saved with the card: add-keep.js addKeep) */
const READS=new WeakMap();
function readBegin(q,kind){const r=READS.get(q)||{};if(kind==='refine')readAbort(q);else if(r[kind])try{r[kind].ac&&r[kind].ac.abort()}catch{}
  const me={ac:typeof AbortController==='function'?new AbortController():null};r[kind]=me;READS.set(q,r);return me}
/* the reading is still the card's own (true), and is now over; false: it was called off or replaced, so its answer is dropped */
function readEnd(q,kind,me){const r=READS.get(q);if(!r||r[kind]!==me)return false;delete r[kind];return true}
/* Skip (add.js skipCard), Remove close-up and a newer close-up: the readings in flight are called off, their flags cleared */
function readAbort(q){const r=READS.get(q);if(!r)return;for(const k of ['refine','pattern'])if(r[k]){try{r[k].ac&&r[k].ac.abort()}catch{}delete r[k];q[k==='refine'?'refining':'patternReading']=0}}
/* (moved from safety.js with its text unchanged, the restructure S6c) */
/* the card says what to do once: not when the reason already does ("Try again later, or add the item by hand.") */
const tagFailNote=q=>q.tagErr&&!inviteOver()?`<div class="tagfail" role="alert"><p><b>This photo wasn’t tagged.</b> ${esc(q.tagErr)}${/try again|by hand|yourself/i.test(q.tagErr)?'':' <span class="tagfail-do">Fill in the details yourself, or try again.</span>'}</p><button type="button" class="tagfail-btn" data-act="cardRetryTag" ${cardAt(q)}>Try again</button></div>`:'';
globalThis.HOOK={__proto__:globalThis.HOOK||null,cardReading,needType,tagFailNote};
export {qh,cardReading,needType,closeTagImg,readBegin,readEnd,readAbort,READS,tagFailNote};
