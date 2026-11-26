/* Daily Wardrobe: Today's gestures: swiping to another day (fly, todayBusy, todayFree; stepDay is in today.js) and moving an outfit to
   another day in the open month (outfitMove, moveRecs, showPlan; planWith is in today.js)
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of today.js on 2026-11-17, Round C.) */
/* fast swipes one after another (audit 2026-11-14: five quick swipes moved three days): a swipe made while the last one's fly-out is still
   running is added to it (fly.n), and the day is drawn only once no finger is down: drawing Today removes the element a touch started on,
   and the browser then stops sending that touch's moves and its end, so the swipe under way was lost */
import {foldAll,planWith,renderToday,stepDay} from './today.js';
import {picker} from './history.js';
import {$,dayRecs} from './core.js';
import {monthDrag,monthPanel,monthRelease,mvSig,stackSVG} from './month.js';
import {hasOutfit,planDirty,planFor,planMonth} from './today-plan.js';
import {idsOf,keyDate,saveDay} from './days.js';
import {toast} from './toast.js';
const fly={n:0,t:null,wait:false,from:0};
function flyGo(){clearTimeout(fly.t);fly.t=null;fly.wait=false;const n=fly.n;fly.n=0;if(n)stepDay(Math.sign(n),fly.from,Math.abs(n));todayFree()}
/* a layer over Today: Settings, the piece picker, What to buy, or anything that makes main inert (a sheet, a question) */
const todayCovered=()=>!!((typeof settingsOpen==='function'&&settingsOpen())||picker||(typeof shopOpen!=='undefined'&&shopOpen)||document.querySelector('main[inert]'));
/* a finger is on Today (a swipe under way, a month cell held or moved) or a swipe's fly-out is still to be drawn: a sync's redraw waits
   (sync.js syncRedraw, syncLater; CR-4-11), as drawing Today removes the element the touch started on and the gesture stops */
let todayTouch=()=>false;
const todayBusy=()=>!!(todayTouch()||outfitMove||fly.t||fly.wait);
/* the gesture ended: a sync's redraw that waited runs now */
const todayFree=()=>{if(!todayBusy()&&typeof syncLaterRun==='function')setTimeout(()=>{if(!todayBusy())syncLaterRun('today')},0)};
(()=>{const el=$('#today');let st=null;todayTouch=()=>!!st;
  const slide=()=>$('#slide');
  el.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    // ignore multi-touch and touches that start at the screen edge (iOS back/forward gesture)
    // the gesture can start anywhere on Today (e.g. a Saturday shows only a one-line message); only the outfit moves
    // nor while the picture is zoomed: then a drag on it pans the picture
    // inside the open month a sideways drag changes the month instead (the day stays)
    st=e.touches.length>1||t.clientX<24||t.clientX>innerWidth-24||(zoom&&e.target.closest('#mannequin-container'))?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0,month:!!e.target.closest('#mpanel-in')};
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(outfitMove)st=null;if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8)){st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';if(st.lock==='x'&&!st.month)foldAll()}
    if(st.lock!=='x')return;
    e.preventDefault(); // horizontal drag is ours: no page pan, no zoom bounce
    if(st.month){st.dx=dx;monthDrag(dx);return}
    st.dx=dx;const sl=slide();if(sl){sl.style.transition='none';sl.style.transform=`translateX(${dx}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t,month}=st;st=null;
    try{if(month){if(lock==='x')monthRelease(dx,Date.now()-t);return}const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5;
    if(Math.abs(dx)>70||(fast&&Math.abs(dx)>30)){
      const n=dx<0?1:-1,w=sl.offsetWidth||innerWidth;
      if(noMotion()){fly.n+=n;fly.from=0;fly.wait=true;return}   // reduced motion: no fly-out and slide-in (drawn below)
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      fly.n+=n;fly.from=(dx<0?1:-1)*w*.6;fly.wait=false;clearTimeout(fly.t);
      fly.t=setTimeout(()=>{fly.t=null;if(st)fly.wait=true;else flyGo()},160);   // a finger down again: drawn when it lifts
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}}
    finally{if(fly.wait&&!fly.t)flyGo();todayFree()}
  };
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  // a mouse drag inside the open month does the same on a computer; the click that ends a drag doesn't open a day
  let md=null,noClick=false;
  el.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||!e.target.closest('#mpanel-in'))return;md={x:e.clientX,y:e.clientY,t:Date.now(),on:false}});
  addEventListener('pointermove',e=>{if(outfitMove)md=null;if(!md)return;const dx=e.clientX-md.x;if(!md.on&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(e.clientY-md.y))md.on=true;if(md.on){e.preventDefault();monthDrag(dx)}});
  addEventListener('pointerup',e=>{if(!md)return;const m=md;md=null;if(!m.on)return;noClick=true;setTimeout(()=>noClick=false,0);monthRelease(e.clientX-m.x,Date.now()-m.t)});
  el.addEventListener('click',e=>{if(noClick&&e.target.closest('#mpanel-in')){e.stopPropagation();e.preventDefault()}},true);
  // not while a layer is over Today (Settings, the picker, a sheet, a question: main is inert): the arrows stepped the day underneath and
  // the redraw closed Settings without saving and closed the picker (CR-4-08)
  document.addEventListener('keydown',e=>{if(el.hidden||e.target.closest('input,select,textarea')||todayCovered())return;if(e.key==='ArrowRight')stepDay(1);if(e.key==='ArrowLeft')stepDay(-1)});
})();

/* ---- moving an outfit to another day in the month: long-press a day (like an icon on an iPhone home screen), drag it over
   another day and the planner re-plans the month live as if the outfit were pinned there (the day it left is planned afresh, and
   every later day adjusts for rest and repeats); outfits that changed day slide from their old cell to their new one. Drop to
   keep it (the target day gets the outfit's pieces as pins, `kind` keeps it a suit or blazer day), drop anywhere else to cancel.
   Only today and later workdays that aren't worn and have no occasion take part. ---- */
let outfitMove=null;
/* (mvSig, a day's outfit signed for the cells, is month.js's since the restructure S3e, 2026-11-26: read here as a global) */
const MOVE_HOLD=380,MOVE_SLOP=8;
function moveRecs(src,dst,plan){const o=(plan||planFor())[src];if(!o)return null;const ids=idsOf(o),force={};
  for(const [s,v] of Object.entries(ids))if(v&&s!=='coat')force[s]=v;   // the coat is the weather's choice
  // pieces taken off (rec.off) and rolled sleeves (rec.roll) go with the outfit: the pieces that came off stay pinned (setOff pinned
  // them) and a suit with its jacket off is still a suit day; the day it left is planned afresh, and the target's own go (R4 N-2)
  const sr=dayRecs[src]||{},off=sr.off&&(sr.off.top||sr.off.tie||sr.off.pocket)?{...sr.off}:null;
  if(off){for(const s of ['top','tie','pocket'])if(off[s]&&sr.force&&sr.force[s])force[s]=sr.force[s];if(o.suitBot)delete force.bot}
  const recs={...dayRecs},keep=r=>{const n={...(r||{})};delete n.force;delete n.skip;delete n.ids;delete n.vest;delete n.kind;delete n.auto;delete n.lock;delete n.off;delete n.roll;return n};
  recs[dst]={...keep(dayRecs[dst]),date:dst,force,vest:!!o.vest,kind:o.offKind||(o.suitDay?'suit':'blazer'),...(off?{off}:{}),...(sr.roll?{roll:true}:{})};
  const s=keep(dayRecs[src]);if(Object.keys(s).filter(k=>k!=='date'&&k!=='updated').length)recs[src]={...s,date:src};else delete recs[src];
  return recs}
/* put a plan into the grid: a cell whose outfit changed gets its new stack, sliding in from the cell that showed it before */
function showPlan(p){const grid=document.querySelector('#mpanel-in .mgrid:not(.mdow)');if(!grid)return;
  const cells=[...grid.querySelectorAll('.mc[data-k]')],was=new Map(),ease='cubic-bezier(.2,.8,.2,1)',still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const c of cells){const st=c.querySelector('.stack');if(c.dataset.sig&&st&&!was.has(c.dataset.sig))was.set(c.dataset.sig,st.getBoundingClientRect())}
  for(const c of cells){const o=p[c.dataset.k];if(!o||!hasOutfit(o))continue;const sg=mvSig(o);if(sg===c.dataset.sig)continue;
    const old=c.querySelector('.stack');if(!old)continue;const box=document.createElement('span');box.innerHTML=stackSVG(o);const nw=box.firstElementChild;
    // the lifted day's drawing may be what the finger is on: it stays in the page, hidden, or the browser stops sending that touch
    if(c.classList.contains('lifted')){old.classList.replace('stack','mv-held');old.after(nw)}else old.replaceWith(nw);c.dataset.sig=sg;
    if(still||!nw.animate)continue;const from=was.get(sg),to=nw.getBoundingClientRect();
    if(from)nw.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px)`,zIndex:3},{transform:'none',zIndex:3}],{duration:340,easing:ease});
    else nw.animate([{opacity:0,transform:'scale(.82)'},{opacity:1,transform:'none'}],{duration:260,easing:ease})}}
(()=>{const root=$('#today');let hold=null,mv=null,noClick=false;
  const cellAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&el.closest('#mpanel-in .mc[data-mv]')};
  const start=(cell,x,y)=>{clearTimeout(hold&&hold.t);hold={cell,x,y,t:setTimeout(()=>lift(cell,x,y),MOVE_HOLD)}};
  const cancelHold=()=>{if(hold){clearTimeout(hold.t);hold=null}};
  function lift(cell,x,y){hold=null;if(!monthPanel)return;const r=cell.getBoundingClientRect(),g=document.createElement('div');
    const base=planMonth(monthPanel.y,monthPanel.m),o=base[cell.dataset.k];if(!o)return;
    // its own drawing (fresh pattern ids): the lifted cell's may be hidden while the month is re-planned, and its patterns with it
    g.className='mv-ghost';g.innerHTML=`<span class="dn">${keyDate(cell.dataset.k).getDate()}</span>${stackSVG(o)}`;g.style.width=r.width+'px';g.style.height=r.height+'px';document.body.appendChild(g);
    mv={src:cell.dataset.k,over:null,ghost:g,dx:x-r.left-r.width/2,dy:y-r.top-r.height/2,y:monthPanel.y,m:monthPanel.m,base};
    outfitMove=mv;cell.classList.add('lifted');document.querySelector('#mpanel-in').classList.add('mv-on');if(navigator.vibrate)try{navigator.vibrate(12)}catch{}
    place(x,y)}
  function place(x,y){if(!mv)return;mv.ghost.style.transform=`translate(${x-mv.dx-mv.ghost.offsetWidth/2}px,${y-mv.dy-mv.ghost.offsetHeight*.85}px) scale(1.14)`;   // held a little above the fingertip, so the day under it shows
    const c=cellAt(x,y),k=c?c.dataset.k:null;if(k===mv.over)return;mv.over=k;
    document.querySelectorAll('#mpanel-in .mc.drop').forEach(e=>e.classList.remove('drop'));
    if(k&&k!==mv.src){c.classList.add('drop');const recs=moveRecs(mv.src,k,mv.base);if(recs){mv.recs=recs;showPlan(planWith(recs,mv.y,mv.m))}}
    else{mv.recs=null;showPlan(mv.base)}}
  async function drop(){if(!mv)return;const m=mv;mv=null;outfitMove=null;todayFree();m.ghost.remove();noClick=true;setTimeout(()=>noClick=false,350);
    const pan=document.querySelector('#mpanel-in');if(pan)pan.classList.remove('mv-on');document.querySelectorAll('#mpanel-in .mc.drop,#mpanel-in .mc.lifted').forEach(e=>e.classList.remove('drop','lifted'));
    if(!m.recs||!m.over){showPlan(m.base);return}
    const before={src:dayRecs[m.src]?{...dayRecs[m.src]}:null,dst:dayRecs[m.over]?{...dayRecs[m.over]}:null},src=m.src,dst=m.over;
    await saveDay(m.recs[dst]);if(m.recs[src])await saveDay(m.recs[src]);else if(dayRecs[src])await saveDay({date:src});
    planDirty();renderToday();
    const nm=k=>keyDate(k).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
    toast(`${nm(src)}'s outfit moved to ${nm(dst)}.`,6000,{label:'Undo',fn:async()=>{await saveDay(before.dst||{date:dst});await saveDay(before.src||{date:src});planDirty();renderToday()}})}
  // touch: hold still, then drag; scrolling first (moving before the hold ends) cancels
  root.addEventListener('touchstart',e=>{const c=e.touches.length===1&&e.target.closest('#mpanel-in .mc[data-mv]');if(c){const t=e.touches[0];start(c,t.clientX,t.clientY)}},{passive:true});
  root.addEventListener('touchmove',e=>{const t=e.touches[0];if(hold&&Math.hypot(t.clientX-hold.x,t.clientY-hold.y)>MOVE_SLOP)cancelHold();if(mv){e.preventDefault();place(t.clientX,t.clientY)}},{passive:false});
  root.addEventListener('touchend',e=>{cancelHold();if(mv){e.preventDefault();drop()}},{passive:false});
  root.addEventListener('touchcancel',()=>{cancelHold();if(mv){mv.over=null;mv.recs=null;drop()}});
  // mouse: the same with a held button
  root.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;const c=e.target.closest('#mpanel-in .mc[data-mv]');if(c)start(c,e.clientX,e.clientY)});
  addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>MOVE_SLOP)cancelHold();if(mv){e.preventDefault();place(e.clientX,e.clientY)}});
  addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')return;cancelHold();if(mv)drop()});
  // the click that ends a hold or a move doesn't open the day; nor does the long press's context menu show
  root.addEventListener('click',e=>{if(noClick&&e.target.closest('#mpanel-in')){e.stopPropagation();e.preventDefault()}},true);
  root.addEventListener('contextmenu',e=>{if(e.target.closest('#mpanel-in .mc[data-mv]'))e.preventDefault()});
})();
/* the bridge (tests/bridge.test.js): sync.js, a classic script, asks todayBusy before it redraws (mvSig went to month.js, restructure
   S3e); tests/moveoutfit.test.js calls moveRecs and reads outfitMove, which only this file writes: a getter; a module imports them */
Object.assign(globalThis,{todayBusy});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,moveRecs,get outfitMove(){return outfitMove}};
export {todayBusy,outfitMove,moveRecs};
