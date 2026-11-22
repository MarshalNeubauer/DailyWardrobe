/* Daily Wardrobe: toasts and the Wardrobe's round Undo button
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of settings.js on 2026-11-17.) */
let toastTimer=null;
const TOAST_ACT_MS=8000;   // a toast with Undo stays at least this long (audit 2026-11-14: gone after 5 s, and Delete has no question)
/* on the Wardrobe, where the + is, an Undo is a round button above it, a glowing ring running down its seconds, instead of the toast
   (2026-11-17, the owner's pick "A with the glowing countdown", no line saying what it undoes): its words are read out (announce) and
   are its label ("Undo: Deleted …"); another Undo replaces it; it goes with the toast's rules (toastDrop, the keyboard on it keeps it up) */
let undoTimer=null;
const undoHere=()=>{const w=$('#wardrobe'),m=document.querySelector('main');return !!w&&!w.hidden&&!(m&&m.inert)&&!editing&&!!$('#undo-fab')};   // (not while the item sheet is open: an Undo made there is the toast over it)
function undoFab(t,ms,act){const b=$('#undo-fab'),e=$('#toast');if(e&&e.classList.contains('act')){clearTimeout(toastTimer);e.classList.remove('on','act');e.textContent=''}
  announce(t+'. Undo is above the add button.');
  b.setAttribute('aria-label','Undo: '+t);b.tabIndex=0;b.style.setProperty('--ud',ms+'ms');b.classList.remove('on');void b.offsetWidth;b.classList.add('on');
  b.onclick=()=>{undoOff(true);act.fn()};clearTimeout(undoTimer);undoTimer=setTimeout(function off(){if(b.contains(document.activeElement)){undoTimer=setTimeout(off,1500);return}undoOff()},ms)}
function undoOff(now){const b=$('#undo-fab');if(!b)return;clearTimeout(undoTimer);if(document.activeElement===b)b.blur();b.classList.remove('on');b.tabIndex=-1;b.onclick=null}
function toast(t,ms=2500,act){if(act&&act.label==='Undo'&&undoHere())return undoFab(t,Math.max(ms,TOAST_ACT_MS),act);
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
