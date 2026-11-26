/* Daily Wardrobe: how Today's cards unfold and fold (the score box and the pieces list; the month and the piece photos use foldEdge)
   (An ES module since 2026-11-23; split out of history.js, Round C 2026-11-17, and loaded after it.) */
/* the score box and the pieces list unfold and fold like the month (monthUnfold / monthFold): the page is laid out once and the card's
   edge (a strip, foldEdge) and what is under it slide; their own entry cascades (the checks and their bars, the pieces) still play.
   Folding is that cascade backwards: the last check or piece lifts out first (BOX_LIFT ms apart, styles.css .blift), the card closes
   once about half are gone. A box's running animations are kept on it (box._fa) so a tap in the middle finishes the last move. */
/* The motion helpers the month, the cards and the piece photos share (the restructure S3a, 2026-11-26: revealNeed, pageScroll and
   monthBelow from month.js, keepInView and foldQuiet from today.js; their timing, MONTH_MS and MONTH_EASE, is core.js's) */
import {on} from './bus.js';
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
/* the bridge (tests/bridge.test.js): scorecard.js and today.js (boxUnfold, boxFold), today-photofold.js and month.js (foldEdge, revealNeed,
   pageScroll, monthBelow, keepInView, foldQuiet) read them as globals; a module imports them */
Object.assign(globalThis,{boxUnfold,foldEdge,boxFold,revealNeed,pageScroll,monthBelow,keepInView});
Object.defineProperties(globalThis,{foldQuiet:{get:()=>foldQuiet}});
export {boxUnfold,foldEdge,boxFold,revealNeed,pageScroll,monthBelow,keepInView,foldQuiet};
