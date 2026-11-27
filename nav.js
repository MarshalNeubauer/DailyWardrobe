/* Daily Wardrobe: moving between pages (show), the pages opened over another (subOpen, subBack, openAdd) and whether start-up lets a
   page be shown yet (pagesOn). The router, split out of start.js (the restructure S3f, 2026-11-26; the owner's choice of 2026-11-25):
   start.js keeps the start-up chain. An ES module in the ui kit, before the screens that move between pages. */
import {on,emit,ask,need,needFn,served} from './bus.js';   // (this file reads nothing of app.js's own ask(), the server request)
import {$,MONTH_EASE,TYPES} from './core.js';
import {backDrop,backHold,backPush} from './back.js';
import {noMotion} from './ui.js';
import {toastDrop} from './toast.js';
/* moving between pages: the page arriving eases in from the side its tab is on (Today, Wardrobe, Add left to right), a short slide and a
   fade on the cards' curve; a page opened from Settings (stats, packing, care) rises in instead. The tab bar's marker slides to the tab
   (styles.css nav::before, --ti). Only the page arriving moves: the one leaving goes at once, so nothing is laid out twice. */
const PAGES=['today','wardrobe','add','stats','pack'],TABS=['today','wardrobe','stats'],PAGE_MS=320;
function pageIn(t,from){const el=$('#'+t),nav=/** @type {HTMLElement} */(document.querySelector('body>nav')),ti=TABS.indexOf(t);
  if(nav){nav.style.setProperty('--ti',String(Math.max(0,ti)));nav.classList.toggle('tab-none',ti<0)}
  if(!el||!from||from===t||noMotion())return;
  if(el._ps){el._ps.cancel();el._ps=null}   // a scroll slide left from an unfold (pageScroll) on Today
  const a=TABS.indexOf(from),dx=a>=0&&ti>=0?(ti>a?28:-28):0;if(el._pg)el._pg.cancel();
  const an=el._pg=el.animate([{opacity:0,transform:dx?`translateX(${dx}px)`:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:PAGE_MS,easing:MONTH_EASE});
  an.finished.then(()=>{if(el._pg===an)el._pg=null},()=>{})}
/* a page opened from Settings or from Today (stats, packing, care: openStats, openPack, openCare call subOpen first) goes back with its ‹
   (subBack) to where it was opened from: Settings as it was, the same categories open and scrolled the same, over the page under it; or
   the page it came from, scrolled where it was. (The ‹ always went to Today, out of Settings entirely.) */
let subFrom=null;
/* The phone's Back (button or swipe) steps back one level: on one of these pages it does what the ‹ does, in Settings what Done does.
   Settings and such a page share the one app entry (back.js, kind 'set' or 'sub'): opening a page from Settings hands Settings' entry on
   to the page ('set' → 'sub') and its ‹ hands it back (backHold), so Back never needs two presses; left any other way (Done, a tab, the ‹
   to Today) the entry goes (backDrop). */
const SUBS=['add','pack'];
const subShown=()=>SUBS.some(s=>{const e=$('#'+s);return e&&!e.hidden});
function pageBack(kind){if(kind==='sub'&&subShown())subBack();else emit('page-back')}   // (Settings, when open, saves and closes: settings.js)
/* a page asked for before start-up has drawn Today (a tap on a tab while later scripts are still loading: renderWardrobe needs
   wardrobe.js, the Insights page stats.js, and the stored wardrobe isn't read yet) is only noted; start-up shows it once Today is up
   (showWanted). It threw before, and start-up then went to Today whatever was tapped. start.js sets pagesOn (setPagesOn) once Today
   can be drawn, and a failed start-up drops what was asked for (setPageWant(null)). */
let pagesOn=false,pageWant=null;
function setPagesOn(v){pagesOn=v}
function setPageWant(v){pageWant=v}
globalThis.HOOK={__proto__:globalThis.HOOK||null,subBack,openAdd,show};
/* the notice board (bus.js): what this file does when Settings announces it (settings.js no longer names this file) */
on('settings-closed',v=>{if(v&&!$('#'+v).hidden)show(v)});   // the Wardrobe or stats page a sync changed while Settings was open
export {PAGES,pageBack,subShown,subOpen,subBack,openAdd,pagesOn,setPagesOn,setPageWant,show,showWanted};
/* Settings, when open, fills in how it is (S.set: its open categories and scroll: settings.js on 'sub-opening') and is put back so
   (settings.js on 'sub-back') */
function subOpen(){backPush('sub');
  let page=PAGES.find(s=>{const e=$('#'+s);return e&&!e.hidden})||'today';
  if(!TABS.includes(page))page='today';   // one of these pages opened from another: its ‹ goes to Today
  const S={set:null};emit('sub-opening',S);subFrom={page,y:scrollY,set:S.set}}
function subBack(){const f=subFrom||{page:'today',y:0,set:null};subFrom=null;
  backHold(!!f.set,()=>show(f.page));scrollTo(0,f.y);   // back to Settings: the entry stays, for Settings now
  if(!f.set)return;emit('sub-back',f.set)}
/* Add is a page of the Wardrobe (its round + button, #ward-add), with a ‹ back to where it was opened from (subBack) */
/* type: Today's "Add one" beside a missing piece passes its type (fix round 3, W2-14-01: "Belt: Add one" then "Add without a photo"
   saved a suit): Add says what is being added and the next card without a photo starts as that type (add-sheet.js addFor) */
function openAdd(type){ask('add-for',typeof type==='string'&&TYPES[type]?type:null);subOpen();show('add');scrollTo({top:0})}
function showWanted(){const t=pageWant;pageWant=null;if(t&&t!=='today'&&TABS.includes(t))show(t)}   // (then start.js opens Settings when the gear was tapped)
/* the setup, What to buy and the packing list are reached through bus.js sockets (setup.js, shop.js and pack.js serve them): without
   the file nothing is asked, as the `typeof f==='function'` guards did */
function show(t){
  if(!pagesOn){pageWant=t;return}
  const from=PAGES.find(s=>{const e=$('#'+s);return e&&!e.hidden});
  if(from==='add'&&t!=='add')ask('nps-leave');   // the "Add without a photo" sheet goes with the page, its entry handed back first (add-sheet.js, a socket since the restructure S3c)
  if(!SUBS.includes(t))backDrop('sub');   // a page left by the ‹ (to Today) or a tab: its Back entry goes
  if(from==='add'&&t!=='add')ask('add-for',null);   // (what Today's "Add one" asked for goes with the page)
  if(from==='add'&&t!=='add')toastDrop();   // Add's "Saved … Undo" goes with the page: it lay over Today's month card for 8 s
  ask('setup-yield',t);
  emit('page-showing',t);if(!SUBS.includes(t))backDrop('sub');   // Settings closes (settings.js); (again: Settings over Add hands Add's entry back as it closes, CR-7-04)
  if(from!==t)ask('shop-close');if(t!=='wardrobe'&&ask('item-open'))ask('item-drop');   // (What to buy stays open over its own tab redrawn by a sync, CR-4-04)
  for(const s of['today','wardrobe','add','stats']){const el=$('#'+s);if(el)el.hidden=s!==t;const btn=$('#n-'+s);if(btn){btn.classList.toggle('on',s===t);if(s===t)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')}}   // (spoken, not only shown: W2-19-05)
  if(from==='wardrobe'&&t!=='wardrobe'&&!ask('item-open')){const w=$('#wardrobe');if(w)w.textContent=''}   // the grid (about 4,900 elements at 107 items) is drawn again on coming back: kept, it stayed in memory and in every style recalculation (audit 2026-11-13)
  const f={today:needFn('today-draw'),wardrobe:()=>ask('wardrobe-draw'),add:()=>ask('add-draw'),stats:()=>served('stats-show')?ask('stats-show'):need('stats-draw')};if(f[t])f[t]();
  ask('pack-show',t);   // the packing list page (pack.js)
  if(t!=='wardrobe')ask('item-draw');   // the item page belongs to the Wardrobe
  pageIn(t,from);
}
