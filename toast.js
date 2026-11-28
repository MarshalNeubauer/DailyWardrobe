/* Daily Wardrobe: toasts and the Wardrobe's round Undo button
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of settings.js on 2026-11-17.) */
import {ask,serve} from './bus.js';   // the piece open in the item sheet (item-view.js serves it). (This file reads nothing of app.js's ask())
import {$} from './core.js';
import {announce} from './app.js';
let toastTimer=null;
const TOAST_ACT_MS=8000;   // a toast with Undo stays at least this long (audit 2026-11-14: gone after 5 s, and Delete has no question)
/* on the Wardrobe, where the + is, an Undo is a round button above it, a glowing ring running down its seconds, instead of the toast
   (2026-11-17, the owner's pick "A with the glowing countdown", no line saying what it undoes): its words are read out (announce) and
   are its label ("Undo: Deleted …"); another Undo replaces it; it goes with the toast's rules (toastDrop, the keyboard on it keeps it up) */
let undoTimer=null;
const undoHere=()=>{const w=$('#wardrobe'),m=document.querySelector('main');return !!w&&!w.hidden&&!(m&&m.inert)&&!ask('item-open')&&!!$('#undo-fab')};   // (not while the item sheet is open: an Undo made there is the toast over it)
function undoFab(t,ms,act){const b=$('#undo-fab'),e=$('#toast');if(e&&e.classList.contains('act')){clearTimeout(toastTimer);e.classList.remove('on','act');e.textContent=''}
  announce(t+'. Undo is above the add button.');
  b.setAttribute('aria-label','Undo: '+t);b.tabIndex=0;b.style.setProperty('--ud',ms+'ms');b.classList.remove('on');void b.offsetWidth;b.classList.add('on');
  b.onclick=()=>{undoOff(true);act.fn()};clearTimeout(undoTimer);undoTimer=setTimeout(function off(){if(b.contains(document.activeElement)){undoTimer=setTimeout(off,1500);return}undoOff()},ms)}
function undoOff(now){const b=$('#undo-fab');if(!b)return;clearTimeout(undoTimer);if(document.activeElement===b)b.blur();b.classList.remove('on');b.tabIndex=-1;b.onclick=null}
/** @param {*} [t] @param {*} [act] */ function toast(t,ms=2500,act){if(act&&act.label==='Undo'&&undoHere())return undoFab(t,Math.max(ms,TOAST_ACT_MS),act);
  const e=$('#toast');if(!e)return;e.textContent=t;e.classList.toggle('act',!!act);if(act)ms=Math.max(ms,TOAST_ACT_MS);
  if(act){const b=document.createElement('button');b.type='button';b.textContent=act.label;b.onclick=()=>{clearTimeout(toastTimer);e.classList.remove('on','act');e.textContent='';act.fn()};e.append(' ',b)}
  e.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastOff(e),ms)}
/* a toast gone is gone for everyone (fix round 3, W2-19-06: faded to opacity 0, its words and its Undo stayed in the Tab order and
   for VoiceOver, and the invisible Undo still worked 10 s later): once it has faded (styles.css also hides it, visibility) its words and
   button are taken out. While the keyboard is on its button it stays up (2.2.1: time to reach it), going once the focus leaves. */
function toastOff(e){if(e.contains(document.activeElement)&&e.querySelector('button')){toastTimer=setTimeout(()=>toastOff(e),1500);return}
  e.classList.remove('on','act');setTimeout(()=>{if(!e.classList.contains('on'))e.textContent=''},250)}
/* a toast with a button (Undo) taken away at once (start.js show(): leaving Add takes its "Saved … Undo" with it) */
function toastDrop(){undoOff();const e=$('#toast');if(!e||!e.classList.contains('act'))return;clearTimeout(toastTimer);e.classList.remove('on','act');e.textContent=''}
/* a file that fails once the app is running (a worker that can't load, the calendar's lazy parser; all or nothing, A1, the owner's O1 of
   2026-11-28): the feature keeps its own fallback, the app's files are fetched afresh in the background (index.html's start-up catcher,
   window.dwLoad), and a toast offers Reload, once per page; Reload keeps Add's cards (add-keep.js, as Update does) and loads the app
   again, a newer version if one is published */
let loadTold=false;
function loadFailed(){if(loadTold)return;loadTold=true;const L=window.dwLoad;try{if(L)L.refresh()}catch{}
  toast('Something didn’t load.',TOAST_ACT_MS,{label:'Reload',fn:()=>{Promise.resolve().then(()=>ask('add-keep')).catch(()=>{}).then(()=>{if(L)L.reload();else location.reload()})}})}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,TOAST_ACT_MS,toast,toastDrop,get loadTold(){return loadTold},set loadTold(v){loadTold=v}};
export {TOAST_ACT_MS,loadFailed,toast,toastDrop};
serve('toast',toast);   // the restructure S6f: app.js, which loads before this file, says what it set aside
serve('load-failed',loadFailed);   // assemble.js, a painting-worker file, which can't import this one
