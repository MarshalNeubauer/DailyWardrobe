/* Daily Wardrobe: Add, the More section's rows (split from add.js, Round C 2026-11-17): How many, Bought on the way and its
   Arrives date (one rule with the item sheet), and checkArrivals, which puts items back in rotation once they arrive or are back. */
/* bought but not here yet: the item goes into the wardrobe out of rotation; with an arrival date it joins the outfits from the day
   after (inRotation in core.js), and once that day comes it is put back in rotation for good (checkArrivals) */
const fmtDay=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
const orderHint=a=>a?`It joins your outfits from the day after ${fmtDay(a)}.`:'It stays out of your outfits until you put it back in rotation from the Wardrobe. Add a date to have that happen by itself.';
/* how many: shirts and socks can be added several at once (2026-11-14, the owner: "white shirts: tap a plus or minus for the amount
   before I add"). Each is an item of its own (its own id, so the planner rotates and the laundry counts them apart), the same tags and
   photo (the server keeps a photo once, by its hash); Undo takes them all back */
const QTY_TYPES=['shirt','socks'],QTY_MAX=12;
const qtyOf=q=>QTY_TYPES.includes(q.type)?Math.min(QTY_MAX,Math.max(1,+q.qty||1)):1;
const qtyLabel=q=>{const n=qtyOf(q);return n>1?'Confirm '+n:'Confirm'};
function qtyRow(q,i){if(!QTY_TYPES.includes(q.type))return '';const n=qtyOf(q);
  return `<div class="qtyrow" role="group" aria-label="How many to add"><span class="qtyl">How many<small class="mut">${q.type==='socks'?'Identical pairs':'Identical shirts'}, each its own item</small></span><span class="qty"><button type="button" class="qtyb" id="qty-m-${i}" aria-label="One fewer" data-act="cardQty" ${cardAt(q)} data-d="-1"${n<=1?' disabled':''}>−</button><output id="qty-n-${i}" aria-live="polite">${n}</output><button type="button" class="qtyb" id="qty-p-${i}" aria-label="One more" data-act="cardQty" ${cardAt(q)} data-d="1"${n>=QTY_MAX?' disabled':''}>+</button></span></div>`}
/* the number, its buttons and Confirm change in place (no redraw: the card would jump) */
function stepQty(i,d){const q=cardOf(i);if(!q)return;i=queue.indexOf(q);q.qty=Math.min(QTY_MAX,Math.max(1,qtyOf(q)+d));const n=q.qty;queueMicrotask(addKeep);
  const o=$('#qty-n-'+i),m=$('#qty-m-'+i),p=$('#qty-p-'+i),c=$('#qconf-'+i);if(o)o.textContent=n;if(m)m.disabled=n<=1;if(p)p.disabled=n>=QTY_MAX;if(c)c.textContent=qtyLabel(q)}
function orderRow(q,i){return `<div class="ordrow"><button type="button" class="rotbtn${q.order?' on':''}" aria-pressed="${!!q.order}" data-act="cardOrder" ${cardAt(q)} data-on="${q.order?0:1}">${q.order?'✓ ':''}Bought, on the way</button>${q.order?`<label class="ordate">Arrives (optional) <input type="date" value="${q.arrives||''}" min="${isoKey(todayDate())}" data-act-change="cardArrives" ${cardAt(q)}></label><small class="mut ordhint">${orderHint(q.arrives)}</small>`:''}</div>`}
function setOrder(i,on){const q=cardOf(i);if(!q)return;q.order=!!on;if(!on)delete q.arrives;renderAdd()}
/* a day already gone isn't an arrival date (the date field's min only limits its picker: 2020-01-01 typed in read "joins your outfits
   from the day after Jan 1") */
/* one rule for the Add card and the item sheet (CR-1-07: the sheet took a past day and put the piece in rotation at once): '' (no date),
   'past', or the date */
const arriveVal=v=>!/^\d{4}-\d{2}-\d{2}$/.test(v||'')?'':v<isoKey(todayDate())?'past':v;
const ARRIVE_PAST='That day has passed. Pick today or a later day, or leave it empty.';
function setArrives(i,v){const q=cardOf(i);if(!q)return;const a=arriveVal(v);
  if(a==='past'){delete q.arrives;renderAdd();toast(ARRIVE_PAST,4500);return}
  if(a)q.arrives=a;else delete q.arrives;renderAdd()}
async function checkArrivals(){const T=di(todayDate()),done=items.filter(i=>i.paused&&arriveN(i)!=null&&T>arriveN(i));
  const cb=done.filter(i=>i.away);   // back from the cleaner's or the laundry (care.js): cleaned on the day it was due back
  if(cb.length&&typeof careUnlock==='function')await careUnlock(null,Math.min(...cb.map(i=>+keyDate(i.away.since||isoKey(todayDate())))));   // the locks made while away let go (history.js)
  for(const it of done){if(it.away){it.cleaned=it.away.back||isoKey(todayDate());if(typeof careLog==='function')careLog(it,it.cleaned);delete it.away}delete it.paused;delete it.order;delete it.arrives;await put(it)}
  if(done.length){planDirty();toast(cb.length===done.length&&typeof careBackText==='function'?careBackText(cb):done.length===1?`Your ${(TYPES[done[0].type]||'item').toLowerCase()} has arrived: it's in rotation now.`:`${done.length} items have arrived: they're in rotation now.`,4000)}return done.length}
/* what the More section's controls do (act.js; the card by its id in data-card: add-save.js cardAt, cardIx) */
function cardQty(el){stepQty(cardIx(el),+el.dataset.d)}
function cardOrder(el){setOrder(cardIx(el),el.dataset.on==='1')}
function cardArrives(el){setArrives(cardIx(el),el.value)}
/* An ES module since 2026-11-23: its other names are its own. The bridge (tests/bridge.test.js lists it): add-card.js and add-save.js (the
   How many and On the way rows), itemsheet.js (the Arrives rule), stats, wardrobe, care and shop (fmtDay), and today, start and care
   (checkArrivals); setOrder, setArrives and checkArrivals are also called by the tests. Before acts(), the file's one call that can
   throw (act.js not loaded): the names are then still the page's, as a classic script's were (start-up calls checkArrivals) */
Object.assign(globalThis,{fmtDay,orderHint,qtyOf,qtyLabel,qtyRow,orderRow,setOrder,arriveVal,ARRIVE_PAST,setArrives,checkArrivals});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,setArrives,setOrder};
export {fmtDay,orderHint,qtyOf,qtyLabel,qtyRow,orderRow,setOrder,arriveVal,ARRIVE_PAST,setArrives,checkArrivals};
acts({cardQty,cardOrder,cardArrives});
