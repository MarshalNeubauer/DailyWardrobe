/* Daily Wardrobe: small pieces of interface every page shares (loaded after app.js; everything here runs when called, not at load, but the Back registrations: back.js backOn, and the folds' bus.js pin for 'folding-all').
   Since the restructure S6a (2026-11-27) also the shared helpers of the screens, moved here with their text unchanged so every class
   may import them: the swipe that closes a sheet (sheetSwipe, all of sheet-swipe.js), how Today's cards fold and unfold (all of boxfold.js:
   boxFold, boxUnfold, foldEdge, revealNeed, pageScroll, monthBelow, keepInView, foldQuiet) and itemGoneTell (from item-view.js).
   - askConfirm(message, {ok, cancel, danger}) -> Promise<boolean>: the app's own question, a sheet from the bottom like the piece picker
   - tell(message): a plain notice (a toast that stays long enough to read)
   - isConnected(), needConn(): what the buttons that need the server show while the app is not connected
   - advToggle(button), advClose(): the "Advanced" folds in Settings */
import {on} from './bus.js';
import {backBorrow,backOn,backReturn,backSettled} from './back.js';
import {$,MONTH_EASE,MONTH_MS,inviteOver,isConnected,items,settingsOpen} from './core.js';
/* the person asked for less motion, or the browser can't animate (moved here from item-view.js, the restructure S3d: the pages, sheets
   and cards all ask it) */
const noMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate;
const ASK_NONE={ok:'OK',cancel:'Cancel',danger:false};
const ASK_SETTLE=450;   // ms after a question opens in which a real tap outside it doesn't cancel it: it is the double tap's second tap (re-audit 2026-11-15)
let asking=null;   // the question on screen: {done(answer), last (what had the focus)}
const uiEsc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function askEls(){let b=document.querySelector('#ask-backdrop'),s=document.querySelector('#ask-sheet');
  if(!s){b=document.createElement('div');b.id='ask-backdrop';b.onclick=e=>{if(e.isTrusted&&asking&&performance.now()-asking.at<ASK_SETTLE)return;askAnswer(false)};   // (the second tap of a double tap on the button that asked)
    s=document.createElement('div');s.id='ask-sheet';s.setAttribute('role','alertdialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-labelledby','ask-title');s.tabIndex=-1;
    s.addEventListener('keydown',askKey);document.body.append(b,s)}
  return {b,s}}
/* Escape answers no; Tab stays inside the sheet */
function askKey(e){if(!asking)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();askAnswer(false);return}
  if(e.key!=='Tab')return;const f=[...document.querySelectorAll('#ask-sheet button')];if(!f.length)return;
  const at=f.indexOf(document.activeElement),to=e.shiftKey?(at<=0?f.length-1:at-1):(at===f.length-1?0:at+1);e.preventDefault();f[to].focus()}
/* fromBack: the phone's Back closed it (askBack): its history entry is gone already */
function askAnswer(v,fromBack){const a=asking;if(!a)return;asking=null;const {b,s}=askEls();b.classList.remove('on');s.classList.remove('on');{const iv=document.querySelector('#item-view');if(iv&&iv.inert)layerInert()}   // (the item sheet made inert under it by another layer's call: given back; a question itself doesn't toggle inert, which is slow on WebKit and has its own Tab trap)
  backReturn('ask',a.was,fromBack);   // the entry goes, or goes back to the page under the question; after Back the page gets a new one
  try{if(a.last&&a.last.isConnected)a.last.focus({preventScroll:true})}catch{}
  const w=backSettled();if(w)w.then(()=>a.done(!!v));else a.done(!!v)}   // (after the question's own step back has landed)
/* the phone's Back with a question up answers it no, as Cancel, Escape and a tap outside do (fix round 2, 2026-11-15: Back closed
   Settings under "Roll back to …?", the question stayed over Today, and "Roll back" then emptied the wardrobe with no message; with
   nothing under it Back left the app). The question takes a history entry (back.js backBorrow: its own, or the page's under it). */
function askBack(){if(asking)askAnswer(false,true)}
/* (moved from item-view.js with its text unchanged, the restructure S6a) */
/* a change made to a piece no longer here (deleted on another phone while its sheet was open): said, once per tap -> true when said */
function itemGoneTell(id){if(items.some(x=>x.id===id))return false;tell('This piece was deleted on another phone, so the change wasn’t kept.');return true}
/* (moved from boxfold.js with its text unchanged, the restructure S6a) */
/* how Today's cards unfold and fold (the score box and the pieces list; the month and the piece photos use foldEdge)
   (An ES module since 2026-11-23; split out of history.js, Round C 2026-11-17, and loaded after it.) */
/* the score box and the pieces list unfold and fold like the month (monthUnfold / monthFold): the page is laid out once and the card's
   edge (a strip, foldEdge) and what is under it slide; their own entry cascades (the checks and their bars, the pieces) still play.
   Folding is that cascade backwards: the last check or piece lifts out first (BOX_LIFT ms apart, styles.css .blift), the card closes
   once about half are gone. A box's running animations are kept on it (box._fa) so a tap in the middle finishes the last move. */
/* The motion helpers the month, the cards and the piece photos share (the restructure S3a, 2026-11-26: revealNeed, pageScroll and
   monthBelow from month.js, keepInView and foldQuiet from today.js; their timing, MONTH_MS and MONTH_EASE, is core.js's) */
/* how far to scroll so el shows above the tab bar, without the top of `top` going past the top of the screen (sat: the notch's inset) */
function revealNeed(el,top,sat){if(sat===undefined){const probe=document.createElement('div');probe.style.cssText='position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden';document.body.appendChild(probe);sat=parseFloat(getComputedStyle(probe).paddingTop)||0;probe.remove()}
  const nav=document.querySelector('body>nav'),bottom=(nav?nav.getBoundingClientRect().top:innerHeight)-12,need=el.getBoundingClientRect().bottom-bottom,cap=(top||el).getBoundingClientRect().top-(sat+8);return Math.max(0,Math.min(need,cap))}
/* the page's scroll during an unfold or a fold, on the animations' own curve (MONTH_EASE), duration and delay, so the page and the clip
   move together. The page is scrolled once, at the start, and Today is slid back by the same amount and eased to rest with the cards:
   one more animation the browser runs with the others, no script on any frame. (The browser's own smooth scroll kept its own pace, and
   WebKit covered a 1,000 px scroll in one frame; a scrollTo on every frame from script, the next try, ran out of step with the clip and
   the slide on an iPhone, whose scrolling and animations aren't drawn by the page's script, and the cards juddered.) A second call while
   one runs starts from where the page is drawn, so nothing jumps. */
function pageScroll(to,ms,delay=0){const pg=$('#today'),from=scrollY;
  let left=0;if(pg&&pg._ps){const m=/matrix.*,\s*([-\d.e]+)\)$/.exec(getComputedStyle(pg).transform);left=m?+m[1]:0;pg._ps.cancel();pg._ps=null}
  scrollTo(0,to);const off=scrollY-from+left;   // the browser stops at the page's end: slide by what it really scrolled
  if(!pg||noMotion()||Math.abs(off)<1||pg.hidden)return;
  const a=pg._ps=pg.animate([{transform:`translateY(${off}px)`},{transform:'none'}],{duration:ms,delay,easing:MONTH_EASE,fill:'backwards'});
  a.finished.then(()=>{if(pg._ps===a)pg._ps=null},()=>{})}
/* what lies after a card in its column (it slides with the card's edge) */
const monthBelow=box=>{const k=[...box.parentNode.children];return k.slice(k.indexOf(box)+1)};
/* while a swipe to another day folds everything at once (today.js foldAll), the folds are quiet: no animation, no scroll. foldAll says
   so through bus.js ('folding-all': true, then false), so a day still steps when this file didn't load */
let foldQuiet=false;
on('folding-all',v=>{foldQuiet=v});
/* folding a box whose top is above the screen (folded from its bottom): bring the card back into view */
function keepInView(box){if(foldQuiet)return;const r=box.getBoundingClientRect();if(r.top<8)scrollBy({top:r.top-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
const BOX_LIFT=20;
function boxStop(box){const a=box._fa;box._fa=null;if(!a)return;for(const x of a.list)x.cancel();if(a.end)a.end()}
function boxUnfold(box){boxStop(box);const pan=box.querySelector('.mpanel');box.classList.remove('instant','bshut','blift');box.classList.add('bfast','open');
  const g=pan?pan.offsetHeight:0,d=revealNeed(box,box);
  if(noMotion()||!g){if(d>.5)scrollBy(0,d);return}
  const o={duration:MONTH_MS,easing:MONTH_EASE},c=foldEdge(box,g,0,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:`translateY(${-g}px)`},{transform:'none'}],o));
  const a=box._fa={list,end:c.drop};list[0].finished.then(()=>{if(box._fa===a){box._fa=null;c.drop()}},()=>{});
  if(d>.5)pageScroll(scrollY+d,o.duration)}
/* A card's moving bottom edge, while it unfolds or folds: a strip laid over the card (.fedge) drawing the card's rounded bottom border
   with the page's background under it, sliding with what is below the card, from `from` px above the card's bottom to `to`. It replaces
   a clip-path on the card: Safari repaints a clip on the page's own thread every frame but slides the cards below on its compositor, so
   on a phone the edge and the cards drifted apart and the folding juddered; now every moving part is a slide the browser runs together.
   drop() takes it away, where the card's own edge then is. */
/* The same strip serves a piece's photo row (a straight bottom line, the card's colour under it) and the tile photo under the stage (no
   border, the page under it): it draws whatever bottom border the element has and fills with what is behind the element. */
function foldEdge(box,from,to,o){const cs=getComputedStyle(box),px=v=>parseFloat(v)||0,R=px(cs.borderBottomLeftRadius),bw=px(cs.borderBottomWidth),H=box.offsetHeight,eh=Math.max(R,bw);
  let under='';for(let n=box.parentElement;n&&!under;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(c&&!/^(transparent|rgba\(.*,\s*0\))$/.test(c))under=c}
  const w=document.createElement('div');w.className='fedge';w.setAttribute('aria-hidden','true');
  w.style.inset=`${-px(cs.borderTopWidth)}px ${-px(cs.borderRightWidth)}px ${-bw}px ${-px(cs.borderLeftWidth)}px`;w.style.borderRadius=cs.borderRadius;
  const s=document.createElement('i');s.style.cssText=`top:${H-eh}px;height:${eh+Math.max(from,to)+2}px;--fr:${R}px;--fh:${eh}px;--fl:${cs.borderBottomColor};--fw:${bw}px;--fs:${px(cs.borderLeftWidth)}px;--fb:${under||'var(--bg)'}`;w.appendChild(s);
  box.classList.add('fedge-on');if(cs.overflow!=='visible')box.classList.add('fedge-bfc');box.appendChild(w);   // a card stays its own formatting context, a row is left as it is
  const anim=s.animate([{transform:`translateY(${-from}px)`},{transform:`translateY(${-to}px)`}],o);
  return {anim,drop:()=>{w.remove();box.classList.remove('fedge-on','fedge-bfc')}}}
function boxFold(box,items){boxStop(box);const pan=box.querySelector('.mpanel'),pin=box.querySelector('.mpanel-in'),g=pan?pan.offsetHeight:0;
  const close=()=>{box.classList.add('bfast');box.classList.remove('open','instant','bshut','blift')};
  if(noMotion()||!g||foldQuiet||!box.classList.contains('open')){close();keepInView(box);return}
  // the page gets shorter at the end: scroll now to where it can stay (and bring the card's top back into view)
  const top=box.getBoundingClientRect().top,max=Math.max(0,document.documentElement.scrollHeight-g-innerHeight);
  let want=top<8?scrollY+top-8:scrollY;want=Math.min(want,max);
  const its=[...box.querySelectorAll(items)];its.forEach((e,i)=>{e.classList.add('bli');e.style.setProperty('--bi',i)});box.style.setProperty('--bn',its.length);
  const wait=Math.round((its.length*BOX_LIFT+260)*.55);box.classList.add('bfast','bshut','blift');
  const o={duration:MONTH_MS-60,delay:wait,easing:MONTH_EASE,fill:'forwards'},c=foldEdge(box,0,g,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:'none'},{transform:`translateY(${-g}px)`}],o));
  if(pin)list.push(pin.animate([{opacity:1},{opacity:0}],{...o,delay:wait+Math.round((MONTH_MS-60)*.35),duration:200}));
  if(want<scrollY-.5)pageScroll(want,o.duration,o.delay);
  const end=()=>{c.drop();if(scrollY>max)scrollTo(0,max);close()},a=box._fa={list,end};
  list[0].finished.then(()=>{if(box._fa!==a)return;box._fa=null;end();for(const x of list)x.cancel()},()=>{})}
/* (moved from sheet-swipe.js with its text unchanged, the restructure S6a) */
/* ---- swiping a sheet down closes it: the one gesture of every sheet but What to buy's (CR-1-09: there were four copies): the no-photo and
   the import sheets, the color, pattern and reading sheets (colpick.js) and the item sheet (itemsheet.js). Its handle (o.head, a selector) at
   any time, the rest only while its scrolling part (o.body(), else the sheet) is at the top (further down a downward swipe scrolls it back
   up); decided on the first move of a touch, before the browser scrolls; the sheet follows the finger by its own transform and the backdrop
   lightens; let go past a quarter of its height or with a flick and it closes (o.close(d), d: how far down it was let go), else it springs
   back. A mouse, trackpad or Pencil drags it by its handle (Pointer Events, a 4px dead zone, captured only once it moves, so a click on a
   button there still lands); a finger's pointer events are left to the touch listeners. Never from a text field or o.skip.
   o: {head, body(), backdrop(), live(target, onHead): it may start, skip, close(d), slide: it slides away from where it was let go after
   close (the sheet's state goes at once), spring: an animation back (else the sheet's own transition), fadeBack: the backdrop fades back
   in by an animation (else by its own transition, held while the sheet follows), drag(on): told when the sheet starts and stops following} ---- */
function sheetSwipe(v,o){if(!v||v.dataset.swipe)return;v.dataset.swipe='1';let st=null;
  const bd=()=>o.backdrop?o.backdrop():null,dim=d=>String(Math.max(.15,1-d/v.offsetHeight));
  const put=d=>{v.style.transform=d?`translateY(${d}px)`:'';const b=bd();if(b)b.style.opacity=d?dim(d):''};
  const held=on=>{v.style.transition=on?'none':'';const b=!o.fadeBack&&bd();if(b)b.style.transition=on?'none':''};
  const can=(el,head)=>{if(!o.live(el,head)||v.classList.contains('cpgoing')||el.closest('input,textarea'+(o.skip?','+o.skip:'')))return false;
    if(head)return true;const b=o.body?o.body():v;return !!b&&b.contains(el)&&b.scrollTop<=0};
  const begin=(x,y,ts)=>({x,y,on:false,d:0,ly:y,lt:ts,vy:0});
  // false: not a pull (upward or sideways), let go of it; true: the sheet follows
  const move=(x,y,ts)=>{const dx=x-st.x,dy=y-st.y;
    if(!st.on&&st.pid!==undefined&&Math.abs(dx)<4&&Math.abs(dy)<4)return false;   // a mouse reports every pixel: decided after a few
    if(!st.on){if(dy>0&&dy>=Math.abs(dx)){st.on=true;held(true);if(o.drag)o.drag(true);if(st.pid!==undefined)try{v.setPointerCapture(st.pid)}catch{}}else{st=null;return false}}
    if(ts>st.lt){st.vy=(y-st.ly)/(ts-st.lt);st.ly=y;st.lt=ts}   // the speed from when each move happened (e.timeStamp), not when it was handled: on a busy phone a flick handled late read as a slow pull
    st.d=Math.max(0,dy);put(st.d);return true};
  const slide=d=>{const b=bd(),op=b&&b.style.opacity?+b.style.opacity:1;held(false);put(0);o.close(d);
    if(typeof noMotion==='function'&&noMotion())return;v.classList.add('cpgoing');if(b)b.classList.add('cpgoing');
    const a=v.animate([{transform:`translateY(${d}px)`},{transform:'translateY(102%)'}],{duration:200,easing:'ease-out'});if(b)b.animate([{opacity:op},{opacity:0}],{duration:200});
    a.finished.catch(()=>{}).then(()=>{v.classList.remove('cpgoing');if(b)b.classList.remove('cpgoing')})};
  const end=()=>{if(!st)return;const {on,d,vy}=st;st=null;if(!on)return;if(o.drag)o.drag(false);
    if(d>v.offsetHeight*.25||(vy>.5&&d>30)){if(o.slide){slide(d);return}held(false);o.close(d);put(0);return}
    held(false);put(0);if(typeof noMotion==='function'&&noMotion())return;
    if(o.spring)v.animate([{transform:`translateY(${d}px)`},{transform:'none'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
    const b=o.fadeBack&&bd();if(b)b.animate([{opacity:dim(d)},{opacity:1}],{duration:220})};
  v.addEventListener('touchstart',e=>{const t=e.touches[0];st=e.touches.length>1||!can(e.target,!!e.target.closest(o.head))?null:begin(t.clientX,t.clientY,e.timeStamp)},{passive:true});
  v.addEventListener('touchmove',e=>{if(!st||st.pid!==undefined)return;const t=e.touches[0];if(move(t.clientX,t.clientY,e.timeStamp))e.preventDefault()},{passive:false});
  v.addEventListener('touchend',()=>{if(st&&st.pid===undefined)end()},{passive:true});v.addEventListener('touchcancel',()=>{if(st&&st.pid===undefined)end()},{passive:true});
  if(!window.PointerEvent)return;
  v.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0||st||!e.target.closest(o.head)||e.target.closest('button,a,label')||!can(e.target,true))return;st=begin(e.clientX,e.clientY,e.timeStamp);st.pid=e.pointerId});
  v.addEventListener('pointermove',e=>{if(!st||st.pid!==e.pointerId)return;if(move(e.clientX,e.clientY,e.timeStamp))e.preventDefault()});
  const pend=e=>{if(!st||st.pid!==e.pointerId)return;try{v.releasePointerCapture(e.pointerId)}catch{}end()};
  v.addEventListener('pointerup',pend);v.addEventListener('pointercancel',pend);v.addEventListener('dragstart',e=>{if(st&&st.pid!==undefined)e.preventDefault()})}   // (a photo in the handle would be dragged off as a picture)
/* An ES module since 2026-11-24. The bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use
   as globals. Above the file's first top-level call that can throw (backOn): its functions are then still the page's. A getter reads its
   `let` when asked, so the ones declared below are here too; the consts declared below are handed over above acts({…}) */
Object.assign(globalThis,{noMotion,askAnswer,askConfirm,closeupBtn,cuGot,closeupPick,tell,layerInert,layerOpen,layerClose,plainErr,needConn,connSummary,renderConnUI,addGate,advClose,itemGoneTell,boxUnfold,foldEdge,boxFold,revealNeed,pageScroll,monthBelow,keepInView,sheetSwipe});
Object.defineProperties(globalThis,{asking:{get:()=>asking},cuOpen:{get:()=>cuOpen},foldQuiet:{get:()=>foldQuiet}});
/* the notice board (bus.js): what this file does when Settings announces it (settings.js no longer names this file) */
on('settings-open',()=>advClose());   // the Advanced folds start closed every time Settings opens
on('settings-draw',()=>renderConnUI());
on('settings-summaries',S=>{S.connected=isConnected;S.conn=connSummary});
backOn('ask',()=>askBack());
/* the first paragraph of the message is the question (bold), the rest the explanation; a question asked while another is up answers that one no */
function askConfirm(message,opt){const o={...ASK_NONE,...(opt||{})};if(asking)askAnswer(false);
  const parts=String(message).split(/\n\s*\n/),{b,s}=askEls();
  s.innerHTML=`<p class="ask-q" id="ask-title">${uiEsc(parts[0])}</p>${parts.slice(1).map(t=>`<p class="ask-more">${uiEsc(t)}</p>`).join('')}
<div class="ask-btns">${o.cancel?`<button type="button" id="ask-cancel" data-act="askNoTap">${uiEsc(o.cancel)}</button>`:''}<button type="button" id="ask-ok" class="${o.danger?'ask-danger':'pri'}" data-act="askYesTap">${uiEsc(o.ok)}</button></div>`;
  return new Promise(done=>{asking={done,last:document.activeElement,at:performance.now(),was:backBorrow('ask')};b.classList.add('on');s.classList.add('on');
    const f=s.querySelector(o.danger&&o.cancel?'#ask-cancel':'#ask-ok');if(f)f.focus({preventScroll:true})})}
/* ---- the close-up chooser (2026-11-15, closeup-chooser-mockups variant A, the owner's choice): a close-up button went straight to the
   phone's own picture picker, with no clear way back out. On a touch screen it now opens a sheet from the bottom in the questions' style:
   the cloth-and-white-paper drawing, Take close-up (the camera: capture="environment"), Choose from photos, Remove close-up (a quiet red
   line, when there is one) and Cancel. Its two choices are labels around their file inputs, so the person's own tap opens the camera or the
   photos (iPhone needs a tap; a click from code can be blocked). Cancel, a tap outside (not in the first ASK_SETTLE ms), Escape and the
   phone's Back close it with nothing changed. Without a touch screen (pointer: fine) capture does nothing, so the button stays today's file
   window, and Remove stays a button of its own.
   closeupBtn({label, cls, mode:'add'|'replace'|'retake', act, remove:'…'|'', cloth, aria}) -> the button's HTML. act is the
   attributes of the caller's file handler (act.js: its data-act-change name and data-* written out by the caller; a function(el, ev, f)
   that hands the file to cuGot), remove the
   name of its registered Remove handler, run with the button; label may hold markup, aria names the button or the file input when the label
   is short ---- */
const CU_COPY={add:['Fabric close-up','Hold the camera close so the weave fills the frame.'],
  replace:['Replace close-up','The new close-up takes the place of the one you have.'],
  read:['Close-up for Claude','Claude reads the color and the weave from it. Hold the camera close so the weave fills the frame.'],
  retake:['Retake close-up','Lay white paper along one edge this time, so the colors come out true.']};
const CU_CAM='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>';
const CU_LIB='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="M20.5 16l-5-5L6 19.5"/></svg>';
const cuTouch=()=>{try{return matchMedia('(pointer: coarse)').matches}catch{return false}};
let cuOpen=null;   // the chooser on screen: {o, at, last (what had the focus), was (whose Back entry it borrowed)}
function closeupBtn(o){const ar=o.aria?` aria-label="${uiEsc(o.aria)}"`:'';
  if(!cuTouch())return `<label class="${o.cls}">${o.label}<input type="file" accept="image/*" class="vfile"${ar}${o.act}></label>`;
  return `<button type="button" class="${o.cls} cubtn" aria-haspopup="dialog"${ar} data-act="cuBtnTap" data-mode="${uiEsc(o.mode)}" data-cloth="${uiEsc(o.cloth||'')}"${o.remove?` data-rm="${o.remove}"`:''}${o.act}>${o.label}</button>`}
/* a tap on that button (act.js): the chooser, with the button's own file handler (its data-act-change name, which a button never fires
   itself) and, when it has one, its Remove handler (data-rm) */
function cuBtnTap(el){const d=el.dataset,file=ACTS[d.actChange],rm=d.rm?ACTS[d.rm]:null;
  closeupPick({mode:d.mode,cloth:d.cloth,file:f=>file(el,null,f),...(rm?{remove:()=>rm(el)}:{})})}
/* a close-up's file handler hands its file on: the chooser's (f), or without a touch screen the field's own, which is then emptied
   so the same picture can be chosen again */
function cuGot(el,f,use){if(f){use(f);return}use(el.files[0]);el.value=''}
function cuEls(){let b=document.querySelector('#cu-backdrop'),s=document.querySelector('#cu-sheet');
  if(!s){b=document.createElement('div');b.id='cu-backdrop';b.onclick=e=>{if(e.isTrusted&&cuOpen&&performance.now()-cuOpen.at<ASK_SETTLE)return;closeupClose()};
    s=document.createElement('div');s.id='cu-sheet';s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-labelledby','cu-title');s.setAttribute('aria-describedby','cu-sub');s.tabIndex=-1;
    document.body.append(b,s)}
  return {b,s}}
function closeupPick(o){if(cuOpen)closeupClose();const c=CU_COPY[o.mode]||CU_COPY.add,{b,s}=cuEls(),cloth=/^#[0-9a-f]{3,8}$/i.test(o.cloth||'')?o.cloth:'#5d6478';
  s.innerHTML=`<div class="cu-head"><span class="wbpic cu-pic" style="--cloth:${cloth}" aria-hidden="true"><i></i></span><div><p class="cu-title" id="cu-title">${c[0]}</p><p class="cu-sub" id="cu-sub">${c[1]}</p></div></div>
<label class="cu-btn pri">${CU_CAM}<span>Take close-up</span><input type="file" accept="image/*" capture="environment" class="vfile" id="cu-take"></label>
${o.mode==='retake'?'':'<p class="cu-tip">Lay white paper along one edge, then tap the paper on screen.</p>'}<label class="cu-btn">${CU_LIB}<span>Choose from photos</span><input type="file" accept="image/*" class="vfile" id="cu-lib"></label>
${o.remove?'<button type="button" class="cu-rm" id="cu-rm">Remove close-up</button>':''}<button type="button" class="cu-cancel" id="cu-cancel">Cancel</button>`;
  for(const inp of s.querySelectorAll('input[type=file]'))inp.onchange=()=>{const f=inp.files&&inp.files[0];inp.value='';closeupClose();if(f&&o.file)o.file(f)};   // the same handler the button had (addTexture, replaceTexture, cnRetake)
  const rm=s.querySelector('#cu-rm');if(rm)rm.onclick=()=>{closeupClose();o.remove()};
  s.querySelector('#cu-cancel').onclick=()=>closeupClose();
  cuOpen={o,at:performance.now(),last:document.activeElement,was:backBorrow('cu')};b.classList.add('on');s.classList.add('on');layerInert();
  try{s.querySelector('#cu-take').focus({preventScroll:true})}catch{}}
/* fromBack: the phone's Back closed it: its history entry is gone already (as askAnswer) */
function closeupClose(fromBack){const a=cuOpen;if(!a)return;cuOpen=null;const {b,s}=cuEls();b.classList.remove('on');s.classList.remove('on');layerInert();
  backReturn('cu',a.was,fromBack);
  try{if(a.last&&a.last.isConnected&&!a.last.closest('[inert]'))a.last.focus({preventScroll:true})}catch{}}
function closeupBack(){if(cuOpen)closeupClose(true)}
backOn('cu',()=>closeupBack());
/* Escape closes it; Tab stays inside it (ahead of the item sheet's and the colour sheet's own keys) */
window.addEventListener('keydown',e=>{if(!cuOpen||(e.key!=='Escape'&&e.key!=='Tab'))return;e.preventDefault();e.stopImmediatePropagation();
  if(e.key==='Escape'){closeupClose();return}
  const f=[...document.querySelectorAll('#cu-sheet input,#cu-sheet button')],at=f.indexOf(document.activeElement);if(!f.length)return;
  f[e.shiftKey?(at<=0?f.length-1:at-1):(at<0||at===f.length-1?0:at+1)].focus()},true);

/* a notice: nothing to answer, so a toast, kept up long enough to read (about 15 characters a second, 4 to 9 seconds) */
function tell(message,ms){toast(String(message),ms||Math.min(9000,Math.max(4000,String(message).length*70)))}

/* ---- Settings, the piece picker, What to buy and the item sheet are dialogs (audit 2026-11-13: Tab wandered to the page behind
   Settings, the picker and What to buy, and Escape didn't close Settings or the picker): while one is up the page behind it (header,
   main, the tab bar) is inert, as the item sheet already did; opening moves the focus into it and closing gives it back; Tab and
   Shift+Tab go round inside the top one; Escape closes Settings and the picker (What to buy, the item sheet, the colour sheet and a
   question have their own) ---- */
const layerFrom=new Map();   // dialog -> what had the focus when it opened
const layerFromId=new Map();   // dialog -> that control's id: a redraw while the dialog was up (What to buy redraws Insights) replaces it, and closing finds the new one
/* the open layers, top one first: listed by z-index (a question, the close-up chooser, the tour and import sheet, the reading sheet, the
   color sheet, "Add without a photo", the picker, What to buy), then Settings, then the item sheet; read in this order, not the page's */
const LAYER_Q=['#ask-sheet.on','#cu-sheet.on','#kitsheet.on','#rd-sheet.on','#col-sheet.on','#nps-sheet.on','#pick-sheet.on','#shop-sheet.on'];
function layerUp(){const l=LAYER_Q.map(q=>document.querySelector(q)).filter(Boolean);if(settingsOpen())l.push(document.querySelector('#settings-modal'));
  const iv=document.querySelector('#item-view.on');if(iv)l.push(iv);return l}
function layerInert(){const up=layerUp(),on=up.length>0||!!document.querySelector('#setup.on,#nostore'),npsTop=!!up[0]&&up[0].id==='nps-sheet';
  // "Add without a photo" is inside main: on top, main stays reachable and npsInert closes off the rest of Add around it
  for(const el of document.querySelectorAll('body>header,main,body>nav'))el.inert=on&&!(npsTop&&el.tagName==='MAIN');
  // the item sheet under a sheet of its own (the color sheet, the close-up chooser, the reading sheet, a question, the picker): out of
  // reach too (fix round 3, W2-19-03: 18 of 40 Tabs from the color sheet landed in the item sheet behind it)
  const iv=document.querySelector('#item-view');if(iv)iv.inert=!!up.length&&up[0]!==iv&&iv.classList.contains('on');
  if((!on||npsTop)&&npsId)npsInert(true)}   // the "Add without a photo" sheet (in main) still up: the page around it stays out of reach (add-sheet.js)
function layerOpen(el){if(!el)return;if(!layerFrom.has(el)){const a=document.activeElement;layerFrom.set(el,a);if(a&&a.id)layerFromId.set(el,a.id);else layerFromId.delete(el)}
  if(!el.hasAttribute('tabindex'))el.tabIndex=-1;layerInert();
  if(!el.contains(document.activeElement))try{el.focus({preventScroll:true})}catch{}}
function layerClose(el){layerInert();let f=el&&layerFrom.get(el);const fid=el&&layerFromId.get(el);if(el){layerFrom.delete(el);layerFromId.delete(el)}
  if(f&&!f.isConnected&&fid)f=document.getElementById(fid);   // the opener was drawn again while the dialog was up
  const lost=!document.activeElement||document.activeElement===document.body||(el&&el.contains(document.activeElement));
  if(f&&lost&&f.isConnected&&!f.closest('[inert]'))try{f.focus({preventScroll:true})}catch{}}
const LAYER_FOCUS='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const layerFocusables=el=>[...el.querySelectorAll(LAYER_FOCUS)].filter(x=>x.getClientRects().length&&getComputedStyle(x).visibility!=='hidden'&&!x.closest('[inert]'));
window.addEventListener('keydown',e=>{if(e.key!=='Tab'&&e.key!=='Escape')return;
  const top=layerUp()[0];if(!top||top.id==='ask-sheet'||top.id==='col-sheet'&&e.key==='Escape')return;   // a question handles its own keys, the color sheet its Escape (its Tab stays inside it here)
  if(e.key==='Escape'){if(e.defaultPrevented)return;
    if(top.id==='settings-modal'){e.preventDefault();e.stopPropagation();closeSettings()}
    else if(top.id==='pick-sheet'){e.preventDefault();e.stopPropagation();closePicker()}
    else if(top.id==='nps-sheet'){e.preventDefault();e.stopPropagation();if(!npsAsking)npsCancel()}   // (here, not on the sheet: with the focus on <body> the sheet's own listener never heard it)
    return}   // What to buy, the item sheet and the tour close on their own listeners
  const f=layerFocusables(top);if(!f.length){e.preventDefault();return}
  const at=f.indexOf(document.activeElement);
  if(e.shiftKey?(at<=0):(at===f.length-1||at<0&&!top.contains(document.activeElement))){e.preventDefault();(e.shiftKey?f[f.length-1]:f[0]).focus()}},true);

/* ---- the server's set-up errors in plain words: "Add an OPENAI_API_KEY secret to the worker…" reached a new user's Today (audit
   2026-11-13). Only the owner (acctRole 'owner', account.js) sees the technical sentence, which says what to set up. ---- */
const TECH_RE=/\bAPI key\b|\bsecret\b|\bbinding\b|\bworker\b|Workers AI|Cloudflare|\btoken\b/i,TECH_NAMES=/[A-Z]+_API_KEY|\bKV\b|\bWARDROBE\b|APP_TOKEN|RENDER_QUEUE|RENDER_HUB|VAPID/;   // (the names case-sensitive: "your wardrobe" is plain English)
const ownerHere=()=>typeof acctRole==='function'&&acctRole()==='owner';
/* the browser's own words for a request that never reached the server (Safari "Load failed", Chrome "Failed to fetch", Firefox
   "NetworkError…") -> a plain sentence for everyone, or null (2026-11-15, the audit: "Backup failed: Load failed", "4 failed (Load failed)") */
const NET_RE=/^(TypeError: )?(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?|Network request failed|The network connection was lost\.?|The Internet connection appears to be offline\.?)$/i;
const netErr=m=>NET_RE.test(String(m==null?'':m).trim())?(navigator.onLine===false?'you’re offline. Try again when you’re back online':'the server couldn’t be reached. Try again in a moment'):null;
function plainErr(m){m=String(m==null?'':m);const n=netErr(m);if(n)return n;
  if(!(TECH_RE.test(m)||TECH_NAMES.test(m))||ownerHere())return m;
  if(/ANTHROPIC|Claude|Several items|pattern|\bAI\b|tagg/i.test(m))return 'Reading photos isn’t available on this server yet.';
  if(/OPENAI|photo|render|image|picture/i.test(m))return 'Outfit pictures aren’t available on this server yet.';
  if(/KV|WARDROBE|backup|sync/i.test(m))return 'Backups aren’t available on this server yet.';
  return 'The server isn’t set up for this yet.'}

/* ---- connection ---- */
const NEED_CONN='Needs a connection (Settings → Connection).';
/* a button that needs the server: its row is hidden while the app is not connected -> true when it was hidden. A switched-off
   button with "Needs a connection" under it made the app look broken to someone who had not connected yet; the sections that
   only work connected say once, at their top, what connecting turns on (renderConnUI, body.nocon in styles.css). */
function needConn(btn){if(!btn)return false;const off=!isConnected(),box=btn.closest('.sactions,.btns,.render-ctl')||btn;
  box.classList.toggle('connhide',off);
  if(btn.classList.contains('needconn')){btn.classList.remove('needconn');btn.removeAttribute('title')}
  return off}
/* the reason as a line of text ('' when connected) */
/* Settings → Connection: its one-line summary, and the box at its top. Not connected: what a connection adds, and a field for the
   invite link (the address and the code themselves are under Advanced). Who is connected is the account box under it (account.js). */
function connSummary(){if(typeof inviteChecking!=='undefined'&&inviteChecking)return 'Checking your invitation…';if(inviteOver())return 'Invitation ended';if(!isConnected())return 'Not connected';const m=typeof acct!=='undefined'&&acct&&acct.me;
  return m?(m.role==='owner'?'Connected as the owner':'Connected as '+(m.name||'a tester')):'Connected'}
let connMsg='',connBusy=false;
function renderConnUI(){const el=document.querySelector('#conn-box');if(!el)return;const typed=el.querySelector('#conn-link')?el.querySelector('#conn-link').value:'';
  const checking=typeof inviteChecking!=='undefined'&&inviteChecking,waiting=!checking&&typeof acctWhy!=='undefined'&&acctWhy==='offline'&&typeof hasInviteHash==='function'&&hasInviteHash();
  el.innerHTML=checking?'<p class="shelp" id="conn-state" role="status">Checking your invitation…</p>'
   :isConnected()?`<p class="shelp" id="conn-state"><span class="conn-tick" aria-hidden="true">✓</span> Photos of your clothes are read automatically, item pictures can be made, and ${typeof backedUpWords==='function'?backedUpWords():'your wardrobe is backed up'}.</p>`+
     // (audit 2026-11-15, W1-7-02) the owner's phone moved to a tester's invitation keeps the owner's way back (account.js acctOwnerPhone)
     (typeof isTester==='function'&&isTester()&&localStorage.getItem('acct_was_owner')==='1'?'<p class="shelp conn-own" id="conn-own"><button type="button" class="linkbtn" data-act="connOwnTap">I run the server: connect with its address and code</button></p>':'')
   :`<p class="shelp" id="conn-state">${inviteOver()?'Your invitation has ended, so photos aren’t read automatically and nothing is backed up. Your wardrobe stays on this phone, and the app keeps working without a connection. If you were given a new invitation link, paste it here.'
     :waiting?'Your invitation link couldn’t be checked: the server couldn’t be reached. It is tried again when you come back to the app or your connection returns, or tap Connect.'
     :'The app works without a connection: you add your items by hand. With an invite link, photos of your clothes are read automatically, item pictures can be made, and your wardrobe is backed up.'}</p>
<div class="sform"><input type="text" id="conn-link" placeholder="Paste your invite link" aria-label="Invite link" autocomplete="off" autocapitalize="off" spellcheck="false" data-act-keydown="connLinkKey"><button type="button" class="pri" id="conn-go" data-act="connGoTap"${connBusy?' disabled':''}>${connBusy?'Connecting…':'Connect'}</button></div>
<p class="shelp conn-msg" id="conn-msg" role="status">${uiEsc(connMsg)}</p>
<p class="shelp conn-own" id="conn-own"><button type="button" class="linkbtn" data-act="connOwnTap">I run the server: connect with its address and code</button></p>`;
  const f=el.querySelector('#conn-link');if(f)f.value=typed||(waiting?location.href:'');
  for(const ph of document.querySelectorAll('.conn-off-note'))ph.innerHTML=isConnected()?'':`${uiEsc(ph.dataset.what||'This')} needs a connection. <button type="button" class="linkbtn" data-act="connOffTap">Connect</button>`;
  if(typeof applyRole==='function')applyRole()}
/* not connected, the owner's fold (the server's address and code) stays out of sight until asked for: a new tester was invited to type
   into "Code" (audit 2026-11-14). The owner connecting a new phone taps this line (styles.css: body.nocon:not(.srv-open)) */
function connOwn(){document.body.classList.add('srv-open');const f=document.querySelector('#adv-connection');if(f&&!f.classList.contains('open')){const b=f.querySelector('.adv-head');if(b)advToggle(b)}
  const o=document.querySelector('#conn-own');if(o)o.hidden=true}
/* from a section that needs the server: open Connection and put the cursor in the invite-link field */
function goConnect(){const c=document.querySelector('#sc-connection');if(c&&!c.classList.contains('open'))toggleCat('connection');
  setTimeout(()=>{const f=document.querySelector('#conn-link');if(f){f.scrollIntoView({block:'center',behavior:'smooth'});f.focus({preventScroll:true})}},350)}
/* the Add tab: "Several items" finds the items in one photo on the server, so it is switched off (with the reason) while not connected */
const ADD_GROUP_SUB='One photo of a rail, a pile or a few on hangers';
function addGate(){const l=document.querySelector('#add-group'),s=document.querySelector('#add-group-sub'),inp=l&&l.querySelector('input');if(!l||!s||!inp)return;const off=!isConnected();
  l.classList.toggle('connhide',off);l.classList.remove('needconn');l.removeAttribute('aria-disabled');inp.disabled=off;s.textContent=ADD_GROUP_SUB;   // not connected: the card is not shown
  // ...and a line says why, before any photo is picked (audit 2026-11-13: a new user found out only after picking one)
  let n=document.querySelector('#add-group-off');if(!n&&off){n=document.createElement('p');n.id='add-group-off';n.className='mut addoff';l.parentElement.after(n)}
  if(n){n.hidden=!off;n.innerHTML=off?'Several items in one photo are found by the server, so that needs a connection. <button type="button" class="linkbtn" data-act="addConnTap">Connect</button>':''}}
async function connPaste(){const inp=document.querySelector('#conn-link'),t=(inp&&inp.value||'').trim();if(!t||connBusy)return;
  connBusy=true;connMsg='';renderConnUI();let ok=false;
  try{ok=typeof connectFromLink==='function'&&!!(await connectFromLink(t))}catch(e){ok=false}
  // why it didn't connect, in this line (offline isn't a wrong link; a kept connection was said by its toast)
  connBusy=false;connMsg=ok?'':typeof acctFailText==='function'?acctFailText():'That link didn’t work. Check that you copied all of it.';renderConnUI();
  if(ok)renderSettingsExtras()}

/* ---- Settings: what only the owner needs sits in an "Advanced" fold inside its category, closed until tapped ---- */
function advToggle(btn){const f=btn.closest('.adv');if(!f)return;const open=!f.classList.contains('open');f.classList.toggle('open',open);btn.setAttribute('aria-expanded',open)}
function advClose(){for(const f of document.querySelectorAll('#settings-modal .adv.open')){f.classList.remove('open');const b=f.querySelector('.adv-head');if(b)b.setAttribute('aria-expanded','false')}}
/* index.html's (act.js): the head of an Advanced fold in Settings */
function advTap(el){advToggle(el)}
/* what this file's own controls do (act.js): a question's two buttons, Connection's invite field (Enter connects), Connect and the
   owner's line, "Connect" in a section that needs the server and under Add's "Several items" */
function askNoTap(){askAnswer(false)}
function askYesTap(){askAnswer(true)}
function connOwnTap(){connOwn()}
function connLinkKey(el,ev){if(ev.key==='Enter'){ev.preventDefault();connPaste()}}
function connGoTap(){connPaste()}
function connOffTap(){goConnect()}
function addConnTap(){openSettings('connection');goConnect()}
Object.assign(globalThis,{cuTouch,layerFrom,netErr,NEED_CONN});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,closeupClose,get connBusy(){return connBusy},get connMsg(){return connMsg},set connMsg(v){connMsg=v},askAnswer,get asking(){return asking},closeupPick,get cuOpen(){return cuOpen},cuTouch,renderConnUI,NEED_CONN,askConfirm,plainErr,tell};
export {noMotion,asking,askAnswer,askConfirm,cuTouch,cuOpen,closeupBtn,cuGot,closeupPick,closeupClose,tell,layerFrom,layerInert,layerOpen,layerClose,netErr,plainErr,NEED_CONN,needConn,connSummary,connMsg,connBusy,renderConnUI,addGate,advClose,itemGoneTell,boxUnfold,foldEdge,boxFold,revealNeed,pageScroll,monthBelow,keepInView,foldQuiet,sheetSwipe,BOX_LIFT,boxStop};
acts({advTap,askNoTap,askYesTap,cuBtnTap,connOwnTap,connLinkKey,connGoTap,connOffTap,addConnTap});
