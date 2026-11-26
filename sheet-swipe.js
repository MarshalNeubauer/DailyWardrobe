/* Daily Wardrobe: the swipe down that closes a sheet (split from add.js, Round C 2026-11-17): sheetSwipe, used by the
   "Add without a photo" and import sheets, the color, pattern and reading sheets (colpick.js) and the item sheet (itemsheet.js). */
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
import {noMotion} from './ui.js';
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
/* An ES module since 2026-11-23. The bridge (tests/bridge.test.js): the sheets that call sheetSwipe are classic scripts (add-sheet.js, item-view.js,
   colpick.js, kit.js); a module imports it */
Object.assign(globalThis,{sheetSwipe});
export {sheetSwipe};
