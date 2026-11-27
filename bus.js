/* Daily Wardrobe: the notice board (the restructure, step 0's pilot, 2026-11-25). How a file low in the layers tells a screen
   something without naming it.

   A screen (or a part of one) pins a note: on('settings-draw', fn) means "when Settings is drawn, call me". The file where it
   happens reads the notes: emit('settings-draw') calls every fn pinned for that topic, in the order they were pinned (the files'
   load order), and passes along anything it was given. The file that emits never names the screens, so it never reads a file
   that runs after it, and a screen that didn't load (or doesn't exist) simply pinned nothing.

     on(topic, fn)          pin fn for topic (the same fn twice is pinned once)
     emit(topic, ...args)   call each pinned fn with args; how many were called. One that throws doesn't stop the others; once
                            all have run, the first error is thrown on to the caller (as a direct call would have thrown it)
     heard(topic)           whether anything is pinned for topic (for "is that feature here?", where the code asked
                            `typeof f==='function'` before)

   A topic is named for what happened ('settings-saved'), not for who acts on it. Every topic, who emits it and who listens, is listed
   in tests/bus.test.js (TOPICS), which fails on a topic emitted with no listener in the app or pinned with no emitter.

   Sockets (the restructure, step 2, 2026-11-26): how a required file calls into an optional one ("show a toast", "open the color
   picker") without importing it, so that file failing to load loses only its own feature (tests/load-contract.json).
     serve(name, fn)        the feature offers fn under name; the last one served is the one asked
     ask(name, ...args)     call what is served under name with args and give back its answer; when nothing is served (the feature's
                            file didn't load), nothing is called and the answer is undefined, as the `typeof f==='function'` guards did.
                            An error the served fn throws reaches the caller, as a direct call's would
     served(name)           whether anything is served under name (where the code asked `typeof f==='function'` before a call it
                            makes with other arguments, or to choose another way; the restructure S6p, 2026-11-27)
     need(name, ...args)    as ask, but when nothing is served it throws (a ReferenceError), as the direct call did when the feature's
                            file was missing: for a call with no `typeof` guard, so a missing file still stops the caller where it
                            stopped before (start-up's startFailed, a Settings part, a swap); the restructure S6b, 2026-11-27
     needFn(name)           for a name handed on as a value (`.then(f)`, `whenPulled(f)`): throws at once when nothing is served, as
                            the bare name did, else gives a fn that asks the socket
   Every socket, who serves it and who asks, is listed in tests/bus.test.js (SOCKETS).
   This file reads no other file and is read by nothing at load: it can sit first in the list. */
const BOARD=new Map();   // topic -> [fn], in pin order
function on(topic,fn){let l=BOARD.get(topic);if(!l)BOARD.set(topic,l=[]);if(!l.includes(fn))l.push(fn)}
function heard(topic){const l=BOARD.get(topic);return !!(l&&l.length)}
function emit(topic,...args){const l=BOARD.get(topic);if(!l)return 0;let err,bad=false,n=0;
  for(const fn of [...l]){n++;try{fn(...args)}catch(e){if(!bad){bad=true;err=e}}}
  if(bad)throw err;return n}
const SOCKETS=new Map();   // name -> fn
function serve(name,fn){if(typeof fn==='function')SOCKETS.set(name,fn)}
function ask(name,...args){const fn=SOCKETS.get(name);return fn?fn(...args):undefined}
function served(name){return SOCKETS.has(name)}
function need(name,...args){const fn=SOCKETS.get(name);if(!fn)throw new ReferenceError(name+' is not served');return fn(...args)}
function needFn(name){if(!SOCKETS.has(name))throw new ReferenceError(name+' is not served');return (...args)=>ask(name,...args)}
const askFor=ask;   // the same, for a file that also uses app.js's own ask() (the server request): colpick.js
/* the settings' stamps, never a setting (merge.js's SET_META, the same table): core.js cleanSettings and takeSettings skip them, also when
   merge.js didn't load (the restructure S6h, 2026-11-27: its 404 failed start-up and the stored settings weren't applied) */
const SET_META=['updated','ks','kh','kse','khe'];
export {on,heard,emit,serve,ask,askFor,served,need,needFn,SET_META};
