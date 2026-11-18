/* Daily Wardrobe: what the markup's controls do (Round C, wave C2, 2026-11-18). Markup names a handler instead of holding script:
   <button data-act="dayTap" data-i="3"> runs ACTS.dayTap(el, ev) on a click, where an inline onclick handler calling
   toggleDay('#cfg-workdays',3) ran before. Nothing from outside is ever compiled as script that way (the code review's C1), and markup no longer reaches code by a
   global name. Loaded right after back.js; a leaf: it names no other script's names.
   - Each file registers its handlers once, as its last statement: acts({dayTap, picsPick}). A handler is a top-level
     function(el, ev): el is the element that carries the attribute (an inline handler's `this`), ev the event (its `event`). It reads
     its arguments from el's data-* attributes (el.dataset) or from the control itself (el.value, el.checked), never from compiled text.
   - One attribute per event type, so one element can answer several: data-act is the click, data-act-<type> any other type
     (data-act-change, data-act-input, data-act-keydown, data-act-keyup, data-act-pointerdown; data-act-focus, data-act-load and
     data-act-toggle for the three that don't bubble). The same handler name may be used under any of them.
   - One listener per type on document stands in for the event bubbling through inline handlers: every element on the event's path
     with the attribute runs its handler, innermost first (the path as it was when the event was sent, so a handler that redraws its
     own list doesn't cut the outer ones off). A disabled control's handler doesn't run.
   - A handler's return value is ignored. An inline handler that ended in `return false` calls ev.preventDefault() instead; one that
     called event.stopPropagation() calls ev.stopPropagation(): the handlers further out are then skipped, and so is every later
     listener on document and window, as when the event stopped below them.
   - The order among listeners is as it was for an inline handler, with one exception: a listener added with addEventListener to an
     element between the control and document now runs BEFORE the handler, not after, and if it stops the event the handler never
     runs. Only a handler that relied on running before such a listener (or on stopping the event before it got there) registers
     with actsFirst({…}) instead: it runs in the capture phase, before every listener below document. Capture listeners on document
     added by scripts loaded later (the tap guards in add.js and setup.js) run after it, so it is not held back by them, and when it
     stops the event nothing else sees it at all: use it only where needed.
   - The three types that don't bubble (focus, load, toggle) are heard in the capture phase and run only the target's own handler.
   - A handler that throws, or a name nothing registered, is reported as a page error (as an inline handler's was) and the handlers
     further out still run.
   - An inline handler and a data-act handler on nested elements don't see each other's stopPropagation the same way as two of a
     kind: convert an element and the elements around it that stop its events together.
   tests/inlinehandlers.test.js counts the inline handlers left in each file (the count may only go down); tests/acts.test.js. */
const ACTS={};   // name -> function(el, ev)
const ACT_FIRST=new Set();   // the names that run in the capture phase (actsFirst)
const ACT_TYPES=['click','change','input','keydown','keyup','pointerdown'];   // the types inline handlers used that bubble
const ACT_OWN=['focus','load','toggle'];   // those that don't: only the target's own handler
const actAttr=type=>type==='click'?'data-act':'data-act-'+type;
/* a file's handlers, registered once at load; a name can't be registered twice (a second one would silently replace the first) */
function acts(map){for(const k of Object.keys(map)){if(ACTS[k])throw new Error(`act.js: two handlers named "${k}"`);
  if(typeof map[k]!=='function')throw new Error(`act.js: the handler "${k}" is not a function`);ACTS[k]=map[k]}}
/* the same, for handlers that must run before every listener below document (the capture phase): see the head of this file */
function actsFirst(map){acts(map);for(const k of Object.keys(map))ACT_FIRST.add(k)}
/* a handler's error is a page error, as an inline handler's was; the event goes on */
function actErr(e){if(typeof reportError==='function')reportError(e);else setTimeout(()=>{throw e})}
/* the elements on the event's path that carry attr, innermost first (own: only the target itself) */
function actPath(ev,attr,own){const out=[];
  for(const n of ev.composedPath()){if(n instanceof Element&&n.hasAttribute(attr))out.push(n);if(own)break}
  return out}
/* runs the event's handlers of one phase (first: the capture phase's, actsFirst; own: a type that doesn't bubble, every handler) */
function actFire(ev,attr,first,own){if(ev.cancelBubble)return;
  for(const el of actPath(ev,attr,own)){const name=el.getAttribute(attr);
    if(!own&&ACT_FIRST.has(name)!==first)continue;
    if(el.matches(':disabled'))continue;
    try{const f=ACTS[name];if(!f)throw new Error(`act.js: no handler named "${name}" (${attr})`);f(el,ev)}catch(e){actErr(e)}
    // stopped by the handler: nothing further out runs, nor document's and window's later listeners (the event never reached them before)
    if(ev.cancelBubble){if(!first)ev.stopImmediatePropagation();return}}}
/* one capture and one bubble listener per type on document, once */
let actOn=false;
function actListen(){if(actOn)return;actOn=true;
  for(const t of ACT_TYPES){const a=actAttr(t);
    document.addEventListener(t,ev=>actFire(ev,a,true,false),true);
    document.addEventListener(t,ev=>actFire(ev,a,false,false))}
  for(const t of ACT_OWN){const a=actAttr(t);document.addEventListener(t,ev=>actFire(ev,a,false,true),true)}}
actListen();
/* A tap becomes a click only on what the browser takes for a control: a button, a link, a field, or an element with a click handler
   of its own (document's listener doesn't count). Safari on a phone sends no click for a tap on anything else, and Chrome on a phone
   hands a tap there to a control nearby (a tap on a sheet's backdrop, just above the sheet, went to the sheet's head). An inline
   handler made its element such a control; a data-act element that isn't one by its tag (a backdrop <div>) gets an empty click
   listener of its own instead. actTaps(root) gives one to every such element under root: called here once for index.html's own
   markup (act.js loads after it), and by a file after it writes such markup (twice on one element is once). */
const ACT_CONTROL='button,a[href],input,select,textarea,summary';   // these take a tap without a handler of their own
function actNone(){}
function actTaps(root){for(const el of root.querySelectorAll('[data-act]'))if(!el.matches(ACT_CONTROL))el.addEventListener('click',actNone)}
actTaps(document);
