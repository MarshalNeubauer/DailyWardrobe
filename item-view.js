/* Daily Wardrobe: the item sheet itself: open, close, swipe down, ‹ › and the sideways swipe, the phone's Back, the focus back, and a
   sync's change to the piece open. (A classic script sharing one global scope; split out of itemsheet.js on 2026-11-17, no behavior change.) */
let editing=null;
/* ---- Wardrobe item sheet ----
   Tapping an item opens it in a sheet that slides up over the Wardrobe: the full width of a phone, to just under the top of the
   screen (a centred panel from 600px). The grid behind never moves, so closing puts you back exactly where you were. Ways out:
   swipe the sheet down (by its header at any time; by its content once that is scrolled to the top), Done in the bar at the
   bottom, a tap on the strip of Wardrobe left above it, the phone's Back button or gesture, Esc. ‹ › beside Done, a sideways
   swipe or the arrow keys go to the previous / next item of the list on screen. */
const WARD_EASE='cubic-bezier(.2,.8,.2,1)',WARD_MS=320;
/* the filtered, sorted list on screen (wardrobe.js), with the open item kept in it at the place it had (ivAt) when an edit took it out of the
   filter (CR-1-05: a suit made a blazer under the Suit chip lost "n of m", ‹ ›, the sideways swipe and its focus on closing) */
let ivAt=0;
const wardList=()=>{const l=wardView();if(!editing||l.some(x=>x.id===editing))return l;const it=items.find(x=>x.id===editing);if(!it)return l;
  const c=l.slice();c.splice(Math.min(ivAt,c.length),0,it);return c};
const noMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate;
let itemFrom=null;   // the item the sheet was opened on: closing on another one brings that one's box into view first
/* the phone's Back closes the sheet: it has its own history entry while it is open (back.js histPush/histDrop, kind 'item'); one asked for
   while a step back of ours was on its way is made once it lands. Back in the crop frame keeps the crop (cropKeep: when moved or zoomed)
   and leaves it, and the sheet keeps its entry (the Back audit, 2026-11-15: it closed the sheet) */
backLand(()=>{if(editing)histPush()});
backOn('item',()=>{if(editing&&phEdit.crop){cropKeep();renderWardrobe();histPush()}else if(editing)closeItem(true)});
/* show or hide the sheet; while it is up the app behind it takes no taps or keyboard focus */
function itemShown(on){const v=$('#item-view'),bd=$('#item-backdrop');if(!v)return;const was=v.classList.contains('on');
  v.classList.toggle('on',on);if(bd)bd.classList.toggle('on',on);document.body.classList.toggle('iv-on',on);
  layerInert();   // (ui.js: counts Settings and the sheets too)
  if(was&&!on)setTimeout(()=>syncLaterRun('wardrobe'),0)}   // a sync's redraw that waited for the sheet (sync.js)
/* ---- a sync changed the piece open in the sheet (fix round 3, 2026-11-16) ----
   The sync's redraw of the Wardrobe waits while the sheet is up (sync.js syncLater), so the sheet kept the old state and its buttons acted
   on the new one: "Take out of rotation" put a piece taken out on the other phone back in (W1-5-04). Now the sheet is drawn again from the
   new copy at once, or, while a field in it is being typed in, once that field is left. A piece deleted on another phone (W1-6-02) is
   said in a toast and a line at the top of the sheet; the sheet stays until closed (redrawn it would vanish under the finger), and a
   change made in it says it wasn't kept (itemGoneTell). was: the copy shown before the sync */
let itemGone=null;
function itemSynced(was){if(!editing)return;const id=editing,now=items.find(x=>x.id===id);
  if(!now){if(itemGone===id)return;itemGone=id;const n=was&&(itemName(was)||nm(was));
    tell(n?`“${n}” was deleted on another phone.`:'This piece was deleted on another phone.');
    const b=$('#ivbody');if(b&&!b.querySelector('.ivgone'))b.insertAdjacentHTML('afterbegin','<p class="ivgone" role="status">This piece was deleted on another phone. Changes made here aren’t kept.</p>');return}
  if(was&&stamp(was)===stamp(now))return;
  const v=$('#item-view'),a=document.activeElement;
  if(v&&a&&v.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!/^(button|checkbox|radio|range)$/.test(a.type||'')){a.addEventListener('blur',()=>setTimeout(()=>{if(editing===id&&!(v.contains(document.activeElement)&&/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)))renderItem()},0),{once:true});return}
  if(!phEdit.crop)renderItem()}
/* a change made to a piece no longer here (deleted on another phone while its sheet was open): said, once per tap -> true when said */
function itemGoneTell(id){if(items.some(x=>x.id===id))return false;tell('This piece was deleted on another phone, so the change wasn’t kept.');return true}
/* draws the open item (called by renderWardrobe, so every edit redraws it; the scroll position stays) */
function renderItem(){
  const v=$('#item-view');if(!v)return;const i=editing&&items.find(x=>x.id===editing);
  if(!i){editing=null;itemShown(false);return}
  const l=wardList(),k=l.findIndex(x=>x.id===i.id);if(k>=0)ivAt=k;
  $('#ivhead').innerHTML=`<div class="ivt"><small class="gtype">${TYPES[i.type]||'Item'}</small><h2 id="iv-title" class="${titleCls(i)}">${esc(itemTitle(i)||TYPES[i.type]||'Item')}</h2></div>${k>=0?`<span class="pcount">${k+1} of ${l.length}</span>`:''}`;
  keepFocus($('#ivbody'),()=>{$('#ivbody').innerHTML=itemBody(i)});   // every edit redraws it: the field or button used keeps the focus (W2-19-01)
  cmpMount($('#ivbody'));
  $('#iv-prev').disabled=k<=0;$('#iv-next').disabled=k<0||k>=l.length-1;
  itemShown(true)}
const sheetSlides=()=>innerWidth<600;   // a phone: the sheet slides up from the bottom; wider, the panel fades in
function openItem(id){
  if(!items.some(i=>i.id===id))return;const v=$('#item-view'),bd=$('#item-backdrop'),was=editing;
  editing=id;itemGone=null;if(!was)itemFrom=id;if(lookOn())lookOpenFresh();/* (the Look beta: Look opens unfolded on every item opened) */histPush();ivSwipe();renderItem();$('#ivbody').scrollTop=0;if(!was)layerOpen(v);   // the focus goes into the sheet and comes back on closing (W2-19-02)
  for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}
  if(was||noMotion())return;const o={duration:WARD_MS,easing:WARD_EASE};
  v.animate(sheetSlides()?[{transform:'translateY(100%)'},{transform:'none'}]:[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'none'}],o);
  bd.animate([{opacity:0},{opacity:1}],{duration:WARD_MS})}
/* fromPop: the Back button did it (its history entry is gone already); dragged: how far down the sheet was let go, in px */
function closeItem(fromPop,dragged){
  const id=editing,v=$('#item-view'),bd=$('#item-backdrop');if(!id||!v)return;const moved=id!==itemFrom;
  if(phEdit.crop)cropKeep();   // closed in the crop frame: a moved or zoomed frame is kept (the owner: closing should save it)
  editing=null;itemFrom=null;if(!fromPop)histDrop();
  const y=dragged||0,op=+bd.style.opacity||1;v.style.transform=bd.style.opacity='';
  if(noMotion()){renderItem();itemFocusBack(id);return}
  v.classList.add('closing');bd.classList.add('closing');renderItem();itemFocusBack(id);   // the sheet stays up, drawn as it was, while it slides away
  const t=document.getElementById('gi-'+id);if(t&&moved)t.scrollIntoView({block:'center'});   // it was reached with ‹ ›: show where it lives
  const o={duration:WARD_MS-60,easing:dragged?'ease-out':'cubic-bezier(.4,0,.8,.4)',fill:'forwards'};
  const an=v.animate(sheetSlides()?[{transform:`translateY(${y}px)`},{transform:'translateY(100%)'}]:[{opacity:1,transform:`translateY(${y}px)`},{opacity:0,transform:`translateY(${y+24}px)`}],o);
  bd.animate([{opacity:op},{opacity:0}],{duration:WARD_MS-60,fill:'forwards'});
  an.finished.catch(()=>{}).then(()=>{if(editing)return;for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing')}})}
/* the focus back after closing (fix round 3, W2-19-02: it stayed on <body>, at the top of the Wardrobe): on the item's own box in the
   grid (the one shown last, when ‹ › moved on; the grid is drawn again on every edit, so the box that opened it may be gone), else on
   what opened the sheet */
function itemFocusBack(id){const v=$('#item-view'),f=v?layerFrom.get(v):null;if(f!==null&&v)layerFrom.delete(v);
  const a=document.activeElement;if(a&&a!==document.body&&!(v&&v.contains(a)))return;
  const gi=document.getElementById('gi-'+id),g=gi&&gi.querySelector('.giopen'),ch=document.querySelector('#wardrobe .chip[aria-pressed="true"]');   // (the box gone from the filter: its chip)
  const to=g&&!g.closest('[inert]')?g:f&&f.isConnected&&!f.closest('[inert]')?f:ch&&!ch.closest('[inert]')?ch:null;
  if(to)try{to.focus({preventScroll:true})}catch{}}
/* closing with nothing to slide away from: the item was deleted, or another tab is shown */
function dropItem(){editing=null;itemFrom=null;histDrop();layerFrom.delete($('#item-view'));for(const el of [$('#item-view'),$('#item-backdrop')])if(el){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}itemShown(false)}
/* swiping the sheet down closes it. The header is a handle at any time; the content is one only while it is scrolled to the
   top (further down, a downward swipe scrolls it back up, as it must). The choice is made on the first move of a touch, before
   the browser starts scrolling. The sheet follows the finger and the Wardrobe behind brightens; let go past a quarter of the
   sheet's height, or with a flick, and it closes, else it springs back. While cropping only by the header (the crop frame is
   dragged), and closing keeps the crop (cropKeep).
   A mouse, trackpad or Pencil (Pointer Events, not touches) drags it by the header the same way; a finger's pointer events are
   left to the touch listeners. (2026-11-15, the owner's Duo unfolded: the centred panel sat at 4vh, under the status bar, and a
   pull on its grabber went to iOS; the panel now starts below the status bar, `--ivtop` in styles.css.) The gesture is add.js sheetSwipe,
   put on the sheet when it first opens; ivDrag is true while the sheet follows a finger (the sideways swipe below leaves it alone). */
let ivDrag=false;
function ivSwipe(){const v=$('#item-view'),b=$('#ivbody');if(!v||!b)return;
  sheetSwipe(v,{head:'.ivhead',body:()=>b,backdrop:()=>$('#item-backdrop'),skip:'.ivbar',live:(el,head)=>!!editing&&!v.classList.contains('closing')&&!(phEdit.crop&&!head),
    close:d=>closeItem(false,d),spring:true,fadeBack:true,drag:on=>{ivDrag=on}})}
/* the previous / next item of the list on screen; the new one slides in from the side it lies on */
function stepItem(n,from){
  const l=wardList(),k=l.findIndex(x=>x.id===editing),t=l[k+n];if(k<0||!t)return false;
  if(phEdit.crop)cropKeep();   // the crop frame left for the next item: kept when moved or zoomed
  editing=t.id;renderItem();const b=$('#ivbody');b.scrollTop=0;
  const el=b.firstElementChild;if(el&&!noMotion())el.animate([{transform:`translateX(${from===undefined?n*56:from}px)`,opacity:0},{transform:'none',opacity:1}],{duration:220,easing:WARD_EASE});
  return true}
(()=>{const b=$('#ivbody');if(!b)return;let st=null;const inn=()=>b.firstElementChild;
  b.addEventListener('touchstart',e=>{const t=e.touches[0];
    st=e.touches.length>1||phEdit.crop||t.clientX<24||t.clientX>innerWidth-24||e.target.closest('input,textarea,.cropwrap')?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}},{passive:true});   // a swipe may start on a dropdown: half the page is dropdowns
  b.addEventListener('touchmove',e=>{
    if(ivDrag)st=null;if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;e.preventDefault();
    const l=wardList(),k=l.findIndex(x=>x.id===editing),edge=k<0||(dx>0&&k<=0)||(dx<0&&k>=l.length-1);   // nothing that way: resist
    st.dx=dx;const el=inn();if(el){const x=edge?dx/4:dx;el.style.transition='none';el.style.transform=`translateX(${x}px)`;el.style.opacity=String(1-Math.min(.5,Math.abs(x)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const el=inn();if(lock!=='x'||!el)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5,n=dx<0?1:-1;
    if(!((Math.abs(dx)>70||(fast&&Math.abs(dx)>30))&&stepItem(n,n*Math.min(innerWidth*.5,220)))){
      el.style.transition='transform .2s ease-out,opacity .2s';el.style.transform='translateX(0)';el.style.opacity='1'}};
  b.addEventListener('touchend',end,{passive:true});b.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(!editing)return;
    if(e.key==='Escape'){if(phEdit.crop){cropKeep();renderWardrobe()}else closeItem();return}   // Esc leaves the crop as Back does: a moved frame is kept
    if(e.target.closest&&e.target.closest('input,select,textarea'))return;
    if(e.key==='ArrowRight')stepItem(1);if(e.key==='ArrowLeft')stepItem(-1)});
})();
/* the markup's handlers (act.js): the item sheet's backdrop and Done, and its previous and next buttons (data-n: -1 or 1) */
function itemCloseTap(){closeItem()}
function itemStepTap(el){stepItem(+el.dataset.n)}
acts({itemCloseTap,itemStepTap});
