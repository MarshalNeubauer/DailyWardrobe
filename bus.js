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

   Types (the notice board made clean, N1, 2026-11-27): every socket and its signature is in types/sockets.d.ts (Sockets, written by
   tools/sockets-dts.js from the serve lines), so the type check (npm run typecheck) catches an undeclared name, a missing or extra
   argument, an argument of the wrong type and a misspelled answer field at the caller. need and needFn take only the names in Needs.
   The types are JSDoc and a .d.ts that never loads: nothing here changes at run time.

   Hooks (N1, for the lifecycle moments; owner decision D1, 2026-11-27: a feature that didn't load is just absent, nothing throws):
     register(feature, hooks)       a feature's hooks for the moments, {name: fn} (types/sockets.d.ts Hooks); its first register
                                    sets its place (load order); registering again adds to or replaces its hooks there
     runHooks(name, ...args)        call each registered feature's hook for name, in load order, with args, and give back their
                                    answers (an array; a feature without that hook, or that never registered, is skipped). One that
                                    throws doesn't stop the others; once all have run, the first error is thrown on, as emit does
     runHooksSeq(name, ...args)     the same, one after another: each answer is awaited before the next hook is called, and the
                                    first that throws or rejects stops the rest (a .then chain); a Promise of the answers
     registered(feature)            whether that feature registered (its file loaded)
     slotsOf(name)                  a moment's named slots (N2, 2026-11-27): each registered feature's hook for name answers an object of
                                    its parts ({calBanner}), and slotsOf joins them into one ({} when nobody registered); core calls each
                                    slot where main called that part (P.calBanner?.(day)), so the order and the layout stay as they were,
                                    and a feature that didn't load is just absent (its slot is undefined)
     hooked(name)                   whether any registered feature has a hook for name (where the code asked heard(topic) before)
   Every moment, who registers for it and who runs it, is listed in tests/bus.test.js (HOOKS).
   This file reads no other file and is read by nothing at load: it can sit first in the list. */
/** @typedef {import('./types/sockets.js').Sockets} Sockets */
/** @typedef {import('./types/sockets.js').Needs} Needs */
/** @typedef {import('./types/sockets.js').Hooks} Hooks */
const BOARD=new Map();   // topic -> [fn], in pin order
function on(topic,fn){let l=BOARD.get(topic);if(!l)BOARD.set(topic,l=[]);if(!l.includes(fn))l.push(fn)}
function heard(topic){const l=BOARD.get(topic);return !!(l&&l.length)}
function emit(topic,...args){const l=BOARD.get(topic);if(!l)return 0;let err,bad=false,n=0;
  for(const fn of [...l]){n++;try{fn(...args)}catch(e){if(!bad){bad=true;err=e}}}
  if(bad)throw err;return n}
const SOCKETS=new Map();   // name -> fn
/** @template {keyof Sockets} K @param {K} name @param {Sockets[K]} fn */
function serve(name,fn){if(typeof fn==='function')SOCKETS.set(name,fn)}
/** @template {keyof Sockets} K @param {K} name @param {import('./types/sockets.js').Args<Sockets[K]>} args @returns {ReturnType<Sockets[K]>|undefined} */
function ask(name,...args){const fn=SOCKETS.get(name);return fn?fn(...args):undefined}
/** @param {keyof Sockets} name */
function served(name){return SOCKETS.has(name)}
/** @template {keyof Needs} K @param {K} name @param {import('./types/sockets.js').Args<Needs[K]>} args @returns {ReturnType<Needs[K]>} */
function need(name,...args){const fn=SOCKETS.get(name);if(!fn)throw new ReferenceError(name+' is not served');return fn(...args)}
/** @template {keyof Needs} K @param {K} name @returns {Needs[K]} */
function needFn(name){if(!SOCKETS.has(name))throw new ReferenceError(name+' is not served');return /** @type {any} */((...args)=>ask(/** @type {any} */(name),...args))}
const askFor=ask;   // the same, for a file that also uses app.js's own ask() (the server request): colpick.js
const HOOKS=[];   // [feature, {name: fn}], in the order the features first registered (their load order)
/** @param {string} feature @param {Partial<Hooks>} hooks */
function register(feature,hooks){const h=HOOKS.find(x=>x[0]===feature);if(h)Object.assign(h[1],hooks);else HOOKS.push([feature,{...hooks}])}
/** @template {keyof Hooks} K @param {K} name @param {import('./types/sockets.js').Args<Hooks[K]>} args @returns {ReturnType<Hooks[K]>[]} */
function runHooks(name,...args){const out=[];let err,bad=false;
  for(const [,h] of [...HOOKS]){const fn=h[name];if(typeof fn!=='function')continue;try{out.push(fn(...args))}catch(e){if(!bad){bad=true;err=e}}}
  if(bad)throw err;return out}
/** @template {keyof Hooks} K @param {K} name @param {import('./types/sockets.js').Args<Hooks[K]>} args @returns {Promise<Awaited<ReturnType<Hooks[K]>>[]>} */
async function runHooksSeq(name,...args){const out=[];for(const [,h] of [...HOOKS]){const fn=h[name];if(typeof fn==='function')out.push(await fn(...args))}return out}
/** @param {string} feature */
function registered(feature){return HOOKS.some(x=>x[0]===feature)}
/** @template {keyof import('./types/sockets.js').Slots} K @param {K} name @returns {Partial<import('./types/sockets.js').Slots[K]>} */
function slotsOf(name){const P={};for(const a of runHooks(/** @type {any} */(name)))if(a&&typeof a==='object')Object.assign(P,a);return /** @type {any} */(P)}
/** @param {keyof Hooks} name */
function hooked(name){return HOOKS.some(x=>typeof x[1][name]==='function')}
/* the settings' stamps, never a setting (merge.js's SET_META, the same table): core.js cleanSettings and takeSettings skip them, also when
   merge.js didn't load (the restructure S6h, 2026-11-27: its 404 failed start-up and the stored settings weren't applied) */
const SET_META=['updated','ks','kh','kse','khe'];
export {on,heard,emit,serve,ask,askFor,served,need,needFn,register,runHooks,runHooksSeq,registered,slotsOf,hooked,SET_META};
