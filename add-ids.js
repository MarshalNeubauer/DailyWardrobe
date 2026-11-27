/* Daily Wardrobe: Add, a card found by its id, and what state it is in (the restructure S3c, 2026-11-26: moved here from add-save.js and
   add.js, so the files that draw and read a card, loaded before those two, find it in a file that ran before them). Nothing here draws. (cardOf, qAt, cardAt and cardIx are app.js's since the restructure S6a, beside the queue.) */
import {queue} from './app.js';
import {esc,jsq} from './photo-keys.js';
const qh=q=>`qAt('${jsq(q.id)}')`;
/* a card Claude is still reading (tagging again with the close-up, or its pattern) can't be saved yet: saved meanwhile it kept the
   weaker reading and the pattern call was paid for anyway (audit 2026-11-13); Confirm and Save all wait for it */
const cardReading=q=>!!(q&&(q.refining||q.patternReading));
/* a card not read by Claude (not connected, or the reading failed) doesn't pretend to know the type: it asks for it first (it said
   "Suit · Grey" for a photo of a white shirt, and Confirm saved a grey suit); a type chosen by hand ends it */
const needType=q=>!!q&&!!q.unread&&!q.manual&&!q.ai&&!q.busy&&!q.err&&!q.multiBusy&&!q.multiErr&&!(q.edited&&q.edited.type);
/* An ES module: the bridge (tests/bridge.test.js lists it). Every Add file, tagging.js, pattern-read.js, colpick.js, look.js,
   checklist.js, own-lists.js and kit.js read these as globals; the tests call needType and cardReading. No top-level call */
Object.assign(globalThis,{qh,cardReading,needType});
globalThis.HOOK={__proto__:globalThis.HOOK||null,cardReading,needType};
export {qh,cardReading,needType};
