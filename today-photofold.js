/* Daily Wardrobe: Today: a piece's photo opening and shutting (picOpen, picShut, picSnap), in the pieces list and under the tiles
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of today.js on 2026-11-17, Round C.) */
/* A piece's photo (a row of the pieces list, or a tile's photo under the tiles) opens and shuts like the cards (boxUnfold/boxFold):
   the page is laid out once; the photo's own area is clipped open downward while what lies below it on the page slides down in step
   (picBelow: the rows after it, the cards under its card, the cards under the stage), and the card it is in (the pieces list) is
   clipped to its old edge and grows with it; the photo drops in with the days' bounce. Shutting is the same backwards: the photo
   lifts out with the days' dip, then the space closes. A row's running animations are kept on it (el._pa). */
import {$,MONTH_EASE} from './core.js';
import {foldEdge,foldQuiet,keepInView,pageScroll,revealNeed} from './ui.js';
const PIC_MS=380;
function picStop(el){const a=el._pa;el._pa=null;if(!a)return;for(const x of a.list)x.cancel();if(a.end)a.end()}
/* what lies below el on Today (top at or under `bottom`), and the cards el sits in */
function picBelow(el,bottom){const out=[],root=$('#today');for(let n=el;n&&n!==root&&n.parentElement;n=n.parentElement)for(let s=n.nextElementSibling;s;s=s.nextElementSibling)if(s.getBoundingClientRect().top>=bottom-1)out.push(s);return out}
function picCards(el){const out=[],root=$('#today');for(let n=el.parentElement;n&&n!==root;n=n.parentElement)if(n.classList.contains('mbox'))out.push(n);return out}
/* the photo must be decoded first, or its height isn't known yet and the rest of it would jump in afterwards */
async function picOpenReady(el,top,still){const im=el.querySelector('.rpanel-in img');
  if(im&&!(im.complete&&im.naturalWidth))await Promise.race([im.decode().catch(()=>{}),new Promise(r=>setTimeout(r,300))]);
  if(el.isConnected&&still())picOpen(el,top)}
function picOpen(el,top){picStop(el);const b0=el.getBoundingClientRect(),below=picBelow(el,b0.bottom),cards=picCards(el),c0=cards.map(c=>c.getBoundingClientRect().height);
  el.classList.remove('instant');el.classList.add('pfast','open');
  const b1=el.getBoundingClientRect(),g=b1.bottom-b0.bottom,d=revealNeed(el,top);
  if(noMotion()||g<1){if(d>.5)scrollBy(0,d);return}
  // the photo's own edge and its card's edge are strips that slide (foldEdge), like the cards' own: no clip-path for Safari to repaint
  const o={duration:PIC_MS,easing:MONTH_EASE},edges=[foldEdge(el,Math.max(0,b1.height-b0.height),0,o),...cards.map((c,i)=>foldEdge(c,c.getBoundingClientRect().height-c0[i],0,o))];
  const list=edges.map(e=>e.anim),drop=()=>edges.forEach(e=>e.drop());
  for(const e of below)list.push(e.animate([{transform:`translateY(${-g}px)`},{transform:'none'}],o));
  const pin=el.querySelector('.rpanel-in');if(pin)list.push(pin.animate([{opacity:0,transform:'translateY(-10px) scale(.96)'},{opacity:1,transform:'none'}],{duration:440,delay:40,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'backwards'}));
  const a=el._pa={list,end:drop};list[0].finished.then(()=>{if(el._pa===a){el._pa=null;drop()}},()=>{});
  if(d>.5)pageScroll(scrollY+d,o.duration)}
function picShut(el){picStop(el);const close=()=>{el.classList.add('pfast');el.classList.remove('open','instant')};
  if(noMotion()||foldQuiet||!el.classList.contains('open')){close();keepInView(el);return}
  // the sizes shut, read before anything moves (two layouts, nothing drawn in between)
  const b1=el.getBoundingClientRect(),below=picBelow(el,b1.bottom),cards=picCards(el),c1=cards.map(c=>c.getBoundingClientRect().height);
  el.classList.add('pfast');el.classList.remove('open');const b0=el.getBoundingClientRect(),c0=cards.map(c=>c.getBoundingClientRect().height);el.classList.add('open');
  const g=b1.bottom-b0.bottom;if(g<1){close();return}
  const top=el.getBoundingClientRect().top,max=Math.max(0,document.documentElement.scrollHeight-g-innerHeight);
  let want=top<8?scrollY+top-8:scrollY;want=Math.min(want,max);
  const pin=el.querySelector('.rpanel-in'),wait=150,o={duration:PIC_MS-40,delay:wait,easing:MONTH_EASE,fill:'forwards'};
  if(want<scrollY-.5)pageScroll(want,o.duration,o.delay);
  const edges=[foldEdge(el,0,Math.max(0,b1.height-b0.height),o),...cards.map((c,i)=>foldEdge(c,0,c1[i]-c0[i],o))],list=edges.map(e=>e.anim);
  for(const e of below)list.push(e.animate([{transform:'none'},{transform:`translateY(${-g}px)`}],o));
  if(pin)list.push(pin.animate([{opacity:1,transform:'none'},{opacity:1,offset:.25},{opacity:0,transform:'translateY(-10px) scale(.96)'}],{duration:280,easing:'cubic-bezier(.36,0,.66,-.56)',fill:'forwards'}));
  const end=()=>{edges.forEach(e=>e.drop());if(scrollY>max)scrollTo(0,max);close()},a=el._pa={list,end};
  list[0].finished.then(()=>{if(el._pa!==a)return;el._pa=null;end();for(const x of list)x.cancel()},()=>{})}
/* shut at once (another photo is opening): when it lay above `keep`, scroll by what it gave back, so `keep` doesn't move */
function picSnap(r,keep){picStop(r);const above=keep&&r.getBoundingClientRect().bottom<=keep.getBoundingClientRect().top+1,h0=r.getBoundingClientRect().height;
  r.classList.add('pfast');r.classList.remove('open','instant');if(above){const dh=h0-r.getBoundingClientRect().height;if(dh>0)scrollBy(0,-dh)}}
/* the bridge (tests/bridge.test.js): today.js, a classic script, opens and shuts a piece's photo with these; a module imports them */
Object.assign(globalThis,{picStop,picOpenReady,picShut,picSnap});
export {picStop,picOpenReady,picShut,picSnap};
