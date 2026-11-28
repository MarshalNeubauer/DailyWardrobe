/* Daily Wardrobe: past workdays the app recorded by itself as worn (the app wasn't opened): the toast and Today's card to undo them
   (An ES module since 2026-11-23, the bridge in its last lines; split out of history.js, Round C 2026-11-17, and loaded right after it.) */
import {dayRecs,isoKey,keyDate,shortDate,todayDate,esc} from './core.js';
import {saveDay} from './days.js';
import {sel} from './app.js';
import {acts} from './act.js';
import {toast} from './toast.js';
import {ask} from './bus.js';
import {homeDay} from './month.js';   // (N5: an import of an earlier today-no-picture file, where it asked the socket home-day)
/* past workdays the app was not opened on are recorded as planned and count as worn: say so once, with a way to mark them not worn
   (2026-11-15, the audit: back after a week away, every missed workday was silently counted as worn, toward the cleaning counts too) */
let missedDays=[],missedT=0;
// the day the app was first used for real (a record it didn't make by itself): the first plan of past days before it is no gap
const firstReal=()=>{const real=Object.values(dayRecs).filter(r=>r.ids&&!r.auto).map(r=>+keyDate(r.date));return real.length?Math.min(...real):Infinity};
const missedSpan=ks=>{const n=ks.length,f=d=>shortDate(keyDate(d));return n===1?f(ks[0]):`${f(ks[0])} – ${f(ks[n-1])}`};
function missedNote(k){missedDays.push(k);clearTimeout(missedT);missedT=setTimeout(missedTell,400)}
function missedTell(){const first=firstReal();
  // only days after the app was first used for real (not the first plan of past days)
  const ks=[...new Set(missedDays)].filter(k=>+keyDate(k)>first).sort((a,b)=>keyDate(a).getTime()-keyDate(b).getTime());missedDays=[];if(!ks.length)return;
  const n=ks.length;
  // the days were recorded after Today was drawn: put their card in (missedCard) without drawing Today again, which would cut off
  // an unfolding box or a swipe. The toast says it only where the card isn't on screen (another day or page shown): both at once said
  // the same thing twice (fix round 3, W2-14-11)
  missedPut();const card=document.querySelector('#missbox');if(card&&!card.closest('[hidden]'))return;
  toast(`${n===1?'A past workday':n+' past workdays'} you didn’t open the app (${missedSpan(ks)}) ${n===1?'was':'were'} counted as worn, as planned.`,12000,{label:`I didn’t wear ${n===1?'it':'them'}`,fn:()=>missedNotWorn(ks)})}
function missedPut(){const h=missedCard(),old=document.querySelector('#missbox');
  if(old){if(h)old.outerHTML=h;else old.remove();return}
  const m=h&&document.querySelector('#today #mbox');if(m)m.insertAdjacentHTML('afterend',h)}
async function missedNotWorn(ks){for(const k of ks){const r=dayRecs[k];if(r&&r.ids&&r.worn!==false)await saveDay({...r,worn:false},true)}
  ask('sync-soon');toast(`Marked as not worn: ${ks.length===1?'that day':'those days'} no longer count${ks.length===1?'s':''} toward rest and cleaning.`,4000);ask('refresh-today')}
/* the missed days also stay on Today as a card (missedCard, under the month) until they are marked not worn or the card is closed
   (the re-audit, 2026-11-15: the 12-second toast was the only way to undo the batch, gone if the user looked away while the app
   started): the days the app recorded by itself (rec.auto) in the last MISSED_KEEP days, after it was first used for real, still
   counted as worn and not corrected by hand; "Keep as worn" hides them on this phone (localStorage missed_ok: the last day it covered) */
const MISSED_KEEP=30;
function missedOpen(){const T=todayDate(),first=firstReal();let ok=null;try{ok=localStorage.getItem('missed_ok')}catch{}
  const okD=ok&&/^\d{4}-\d{1,2}-\d{1,2}$/.test(ok)?+keyDate(ok):-Infinity;
  return Object.values(dayRecs).filter(r=>{if(!r||!r.auto||!r.ids||r.worn===false||r.edited)return false;const d=keyDate(r.date);return d<T&&+d>first&&+d>okD&&T.getTime()-d.getTime()<=MISSED_KEEP*864e5})
    .map(r=>r.date).sort((a,b)=>keyDate(a).getTime()-keyDate(b).getTime())}
/* the card is shown on at most MISSED_DAYS different days for the same missed days (localStorage missed_seen {k: the last missed day,
   d: the dates it was shown}); a newly missed day shows it again (fix round 3, W1-8-04: someone who skips a workday now and then had it on
   Today on 216 of 226 mornings, each skipped day keeping it for 30 days) */
const MISSED_DAYS=3;
function missedSeen(ks){const last=ks[ks.length-1],t=isoKey(todayDate());let s=null;try{s=JSON.parse(localStorage.getItem('missed_seen')||'null')}catch{}
  if(!s||s.k!==last||!Array.isArray(s.d))s={k:last,d:[]};if(s.d.includes(t))return true;if(s.d.length>=MISSED_DAYS)return false;
  s.d.push(t);try{localStorage.setItem('missed_seen',JSON.stringify(s))}catch{}return true}
let missedPick=false;   // the card's day-by-day choice is open (W2-17-18: the card was all or nothing)
function missedCard(){if(isoKey(sel)!==isoKey(homeDay()))return '';const ks=missedOpen(),n=ks.length;if(!n||!missedSeen(ks))return '';
  const one=k=>`<button class="linkbtn missone" data-act="missOneTap" data-day="${k}" aria-label="I didn’t wear the outfit of ${esc(shortDate(keyDate(k)))}">${esc(shortDate(keyDate(k)))} ✕</button>`;
  return `<section class="mbox missbox" id="missbox" aria-label="Days counted as worn"><p class="misstxt">${n===1?'A workday':n+' workdays'} you didn’t open the app (${esc(missedSpan(ks))}) ${n===1?'counts':'count'} as worn, as planned.</p>`+
    `<div class="missbtns"><button class="linkbtn" data-act="missNoTap">I didn’t wear ${n===1?'it':'them'}</button>${n>1?`<button class="linkbtn" data-act="missPickTap" aria-expanded="${missedPick}">Choose days</button>`:''}<button class="linkbtn" data-act="missOkTap">Keep as worn</button></div>`+
    (n>1&&missedPick?`<p class="misstxt mut"><small>Tap a day you didn’t wear its outfit:</small></p><div class="missbtns missdays">${ks.map(one).join('')}</div>`:'')+`</section>`}
function missedPickToggle(){missedPick=!missedPick;missedPut()}
async function missedOne(k){const r=dayRecs[k];if(!r||!r.ids||r.worn===false)return;await saveDay({...r,worn:false},true);ask('sync-soon');
  toast(`Marked as not worn: ${shortDate(keyDate(k))}.`,3000);ask('refresh-today')}
function missedCardNo(){const ks=missedOpen();if(ks.length)missedNotWorn(ks)}
function missedCardOk(){const ks=missedOpen();if(ks.length){try{localStorage.setItem('missed_ok',ks[ks.length-1])}catch{}}missedPut()}
/* the markup's handlers (act.js): the card's "I didn't wear it / them", "Choose days", one day's ✕ (data-day) and "Keep as worn" */
function missNoTap(){missedCardNo()}
function missPickTap(){missedPickToggle()}
function missOneTap(el){missedOne(el.dataset.day)}
function missOkTap(){missedCardOk()}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,missedOne,missedOpen,missedPickToggle,missedPut};
export {firstReal,missedNote,missedPut,missedOpen,missedCard,missedPickToggle,missedOne};
acts({missNoTap,missPickTap,missOneTap,missOkTap});
