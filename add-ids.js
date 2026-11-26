/* Daily Wardrobe: Add, a card found by its id, and what state it is in (the restructure S3c, 2026-11-26: moved here from add-save.js and
   add.js, so the files that draw and read a card, loaded before those two, find it in a file that ran before them). Nothing here draws. */
/* a card by its id (Confirm, Save all) or, as before, its place (the sample, the import, tests) */
const cardOf=k=>typeof k==='string'?queue.find(q=>q.id===k):queue[k];
/* every handler drawn on a card finds it by its id when tapped (CR-1-08): qAt(id) is the card's place in the list at that moment (-1 once
   gone), qh(q) writes that call into the markup; a place written in when the card was drawn pointed at another card once the list moved */
const qAt=id=>queue.findIndex(q=>q.id===id);
const qh=q=>`qAt('${jsq(q.id)}')`;
/* a data-act control (act.js) carries its card's id as data-card (cardAt(q) writes it); cardIx(el) is that card's place, as qAt('id') was */
const cardAt=q=>`data-card="${esc(q.id)}"`;
const cardIx=el=>qAt(el.dataset.card);
/* a card Claude is still reading (tagging again with the close-up, or its pattern) can't be saved yet: saved meanwhile it kept the
   weaker reading and the pattern call was paid for anyway (audit 2026-11-13); Confirm and Save all wait for it */
const cardReading=q=>!!(q&&(q.refining||q.patternReading));
/* a card not read by Claude (not connected, or the reading failed) doesn't pretend to know the type: it asks for it first (it said
   "Suit · Grey" for a photo of a white shirt, and Confirm saved a grey suit); a type chosen by hand ends it */
const needType=q=>!!q&&!!q.unread&&!q.manual&&!q.ai&&!q.busy&&!q.err&&!q.multiBusy&&!q.multiErr&&!(q.edited&&q.edited.type);
/* An ES module: the bridge (tests/bridge.test.js lists it). Every Add file, tagging.js, pattern-read.js, colpick.js, look.js,
   checklist.js, own-lists.js and kit.js read these as globals; the tests call cardOf, qAt, needType and cardReading. No top-level call */
Object.assign(globalThis,{cardOf,qAt,qh,cardAt,cardIx,cardReading,needType});
export {cardOf,qAt,qh,cardAt,cardIx,cardReading,needType};
