/* Daily Wardrobe: favorites (2026-11-18, the owner's approved design "B · Wore pill", C:\code\audit-2026-11-13\favorites):
   - a favorite LOOK is a day's jacket, shirt and tie (by id; no jacket or no tie on a day without one): the ♡ joined to Today's ✓ Wore
     pill on a worn day (today and past days not marked "Didn't") loves or un-loves the day's look, with Undo; a ♥ in the "This look last
     worn" pill shows a favorite; the ⇄ picker's "Favorite looks" strip (once one exists) wears one on the day shown (its pieces become
     the owner's own picks, as the picker's do)
   - a favorite PIECE: the "Favorite, wear it more" switch in the item sheet's Planning & care; a small ♥ on its Wardrobe and picker
     tiles, and Wardrobe's "♥ Favorites" chip once one exists
   - Insights' "Your favorites" card once any exists; the score card's Why names a favorite look
   Stored as settings.fav = {looks:[{j,sh,tie,at}], items:[id]}, synced and merged entry by entry (merge.js SET_SPLIT 'fav'); the planner
   reads it (planner.js favLooks, favItemSet: a look comes back about every three weeks, a piece rests a fifth less). Nothing is learned:
   only what is marked counts.
   (An ES module, run in index.html's order; what the classic scripts still use of it is bridged in its last lines.) */
const FAV_HEART='<svg class="favic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 5 6.4 5c2.1 0 3.6 1.2 4.4 2.5h2.4C14 6.2 15.5 5 17.6 5 21 5 23 8.4 21.6 11.7 19.5 16.4 12 21 12 21z"/></svg>';
const FAV_HEART0='<svg class="favic" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" d="M12 20s-7-4.3-9-8.7C1.7 8.3 3.5 6 6.4 6c2 0 3.4 1.2 4.2 2.5h2.8C14.2 7.2 15.6 6 17.6 6c2.9 0 4.7 2.3 3.4 5.3C19 15.7 12 20 12 20z"/></svg>';
const FAV_UNDO_MS=5000;   // (toast.js keeps a toast with Undo up at least TOAST_ACT_MS)
/* the stored favorites, copied (never changed in place: the plan's memo and the settings' stamps compare by value) */
const favData=()=>{const f=settings&&settings.fav;return {looks:f&&Array.isArray(f.looks)?f.looks.map(l=>({...l})):[],items:f&&Array.isArray(f.items)?f.items.slice():[]}};
const favAny=()=>favLooks().length>0||!!favItemSet();
/* the look an outfit shows, as stored: {j, sh, tie} (null when it has no shirt, or neither a jacket nor a tie) */
const favLookFrom=o=>o&&o.shirt&&(o.top||o.tie)?{j:o.top?o.top.id:null,sh:o.shirt.id,tie:o.tie?o.tie.id:null}:null;
async function favSave(next){settings.fav={looks:next.looks,items:next.items};await saveUserSettings()}   // (stamped and synced; the plan cache cleared)
/* the look's pieces as items (a piece deleted since: null) */
const favPieces=l=>{const g=id=>id&&items.find(i=>i.id===id)||null;return {j:g(l.j),sh:g(l.sh),tie:g(l.tie)}};
const favLookName=l=>{const p=favPieces(l);return [p.j,p.sh,p.tie].filter(Boolean).map(i=>shortDesc(i)||nm(i)).join(', ')};
/* ---- Today: the ♡ on the Wore pill, the ♥ in the last-worn pill ---- */
function favPillSeg(o){const l=favLookFrom(o);if(!l||o.worn===false)return '';const on=!!favLookOf(o);
  return `<button type="button" class="wpfav${on?' on':''}" id="wpfav" aria-pressed="${on}" data-act="favLookTap" aria-label="Love this look">${on?FAV_HEART:FAV_HEART0}</button>`}
const favLastIcon=o=>favLookOf(o)?`<span class="lwfav" role="img" aria-label="Favorite look">${FAV_HEART}</span>`:'';
async function favToggleLook(){const o=planFor()[key(sel)],l=favLookFrom(o);if(!l)return;
  const k=favLookKey(l),had=favLooks().find(x=>favLookKey(x)===k),set=async on=>{const n=favData();n.looks=n.looks.filter(x=>favLookKey(x)!==k);if(on)n.looks.push(had?{...had}:{...l,at:Date.now()});await favSave(n);renderToday()};
  await set(!had);
  toast(had?'Taken out of your favorite looks.':'Added to your favorite looks. The plan brings it back about every three weeks.',FAV_UNDO_MS,{label:'Undo',fn:()=>set(!!had)})}
/* ---- the ⇄ picker: "Favorite looks", one row at its top, once one exists; a tap wears it on the day shown ---- */
function favStrip(o){if(!o||o.frozen)return '';const n=di(sel),ok=i=>i&&inRotation(i,n);
  const L=favLooks().filter(l=>{const p=favPieces(l);return ok(p.sh)&&(!l.j||ok(p.j))&&(!l.tie||ok(p.tie))});if(!L.length)return '';
  const cur=favLookOf(o),last=favLastWorn(),card=l=>{const p=favPieces(l),k=favLookKey(l),on=!!cur&&favLookKey(cur)===k,lw=last[k];
    return `<button type="button" class="favlook${on?' cur':''}" data-act="favWearTap" data-k="${esc(k)}" aria-label="Wear this favorite look${dayWord()==='today'?' today':''}: ${esc(favLookName(l))}${on?', wearing':''}"><span class="favsw" aria-hidden="true">${[p.j,p.sh,p.tie].filter(Boolean).map(i=>`<i>${swatchSVG(i,true)}</i>`).join('')}</span><span class="favnm">${esc(sentence(favLookName(l)))}<small>${on?'Wearing':lw?'Last worn '+statDate(lw):'Not worn yet'}</small></span></button>`};
  return `<div class="favpick" role="group" aria-labelledby="favpick-h"><b id="favpick-h" class="favpick-h">${FAV_HEART}Favorite looks</b><div class="favstrip">${L.map(card).join('')}</div></div>`}
/* when each favorite look was last worn (days not marked "Didn't", before today): {key: Date} */
function favLastWorn(){const out={},T=todayDate(),K=new Set(favLooks().map(favLookKey));if(!K.size)return out;
  for(const r of Object.values(dayRecs)){if(!r.ids||r.worn===false)continue;const d=keyDate(r.date);if(d>=T)continue;const k=favKey(r.ids.top,r.ids.shirt,r.ids.tie);if(K.has(k)&&!(out[k]>=d))out[k]=d}
  return out}
/* ---- favorite pieces: the item sheet's switch, the tiles' ♥, Wardrobe's chip ---- */
function favItemRow(i){if(isHandPick(i))return '';const on=isFavItem(i.id);
  return `<button type="button" class="favtog${on?' on':''}" role="switch" aria-checked="${on}" aria-describedby="favhint" data-act="favItemTap" data-id="${esc(i.id)}">${on?FAV_HEART:FAV_HEART0}<span class="favtog-t">Favorite, wear it more</span><span class="favsw2" aria-hidden="true"></span></button><p class="shelp favhint" id="favhint">${on?'It comes round about a fifth sooner, and wins when outfits tie.':'A shorter rest, and it wins when outfits tie.'}</p>`}
async function favToggleItem(id){const it=items.find(i=>i.id===id);if(!it)return;const set=async on=>{const n=favData();n.items=n.items.filter(x=>x!==id);if(on)n.items.push(id);await favSave(n);renderWardrobe()};
  const had=isFavItem(id),name=sentence(itemTitle(it)||nm(it));await set(!had);
  toast(had?`${name} is no longer a favorite.`:`${name} is a favorite now.`,FAV_UNDO_MS,{label:'Undo',fn:()=>set(had)})}
const favMark=i=>isFavItem(i.id)?`<span class="favmark" role="img" aria-label="Favorite">${FAV_HEART}</span>`:'';
/* (the chip shows only while a piece is a favorite; with none left the Wardrobe shows everything: wardFlt) */
const favChip=()=>{const s=favItemSet();if(!s)return '';const n=items.filter(i=>s.has(i.id)).length,on=wardFlt()==='fav';
  return `<button class="chip favchip ${on?'on':''}" aria-pressed="${on}" data-act="favChipTap"><span aria-hidden="true">♥</span> Favorites ${n}</button>`};
/* ---- the score card's Why: "One of your favorites, last worn 23 days ago (Oct 22). Everything in it has rested." (the last sentence
   when the jacket, shirt and tie have each rested FAV_RESTED days: the planner's rest written on the pieces) ---- */
const FAV_RESTED=10;
function favWhy(o){const l=favLookOf(o);if(!l)return '';const d=dayOnly(sel),k=favLookKey(l);let best=null;
  for(const r of Object.values(dayRecs)){if(!r.ids||r.worn===false)continue;const x=keyDate(r.date);if(x>=d||(best&&x<=best))continue;if(favKey(r.ids.top,r.ids.shirt,r.ids.tie)===k)best=x}
  const n=best?Math.round((+d-+best)/864e5):0,rested=[o.top,o.shirt,o.tie].filter(Boolean).every(i=>typeof i.rest==='number'&&i.rest>=FAV_RESTED)?' Everything in it has rested.':'';
  return best?`One of your favorites, last worn ${n} day${n===1?'':'s'} ago (${statDate(best)}).${rested}`:`One of your favorite looks.${rested}`}
/* ---- Insights: "Your favorites", only when one exists ---- */
function favStatsCard(S){if(!favAny())return '';const L=favLooks(),F=favItemSet(),T=todayDate(),m0=new Date(T.getFullYear(),T.getMonth(),1);
  const wornN={},next={},pw={},pn={};let month=0;
  for(const w of S.worn){const k=favKey(w.ids.top,w.ids.shirt,w.ids.tie);if(L.some(l=>favLookKey(l)===k)){wornN[k]=(wornN[k]||0)+1;if(w.d>=m0)month++}}
  for(const [k,o] of S.plan){const f=favLookOf(o);if(f&&!next[favLookKey(f)])next[favLookKey(f)]=keyDate(k)}
  const pieces=F?items.filter(i=>F.has(i.id)):[];for(const r of S.rows)if(F&&F.has(r.i.id)){pw[r.i.id]=r.worn;pn[r.i.id]=r.next}
  const tile=(v,t)=>`<div class="st-tile"><b>${v}</b><small>${t}</small></div>`;
  const lookRow=l=>{const p=favPieces(l),k=favLookKey(l),w=wornN[k]||0;return `<div class="st-row favrow"><span class="favsw" aria-hidden="true">${[p.j,p.sh,p.tie].filter(Boolean).map(i=>`<i>${swatchSVG(i,true)}</i>`).join('')}</span><div class="st-main"><span class="st-nm">${esc(sentence(favLookName(l)))}</span><small class="mut">${w?`Worn ${w}×`:'Not worn yet'} · ${next[k]?'next planned '+statDate(next[k]):'not planned in the next months'}</small></div></div>`};
  const pieceRow=i=>`<div class="st-row favrow">${statPic(i)}<div class="st-main"><span class="st-nm">${TYPES[i.type]||'Item'}: <span class="${titleCls(i)}">${esc(statName(i))}</span></span><small class="mut">Rests a fifth less · ${pw[i.id]?`worn ${pw[i.id]}×`:'not worn yet'}${pn[i.id]?' · next '+statDate(pn[i.id]):''}</small></div></div>`;
  return `<section class="card st-card st-fav" id="st-fav"><h3>${FAV_HEART}Your favorites</h3>
  <div class="st-tiles">${tile(L.length,L.length===1?'look':'looks')}${tile(pieces.length,pieces.length===1?'piece':'pieces')}${tile(month,'favorite looks worn this month')}</div>
  ${L.map(lookRow).join('')}${pieces.map(pieceRow).join('')}</section>`}

/* ---- the controls (act.js: markup names its handler with data-act) ---- */
let favWard=false;   // Wardrobe's "♥ Favorites" chip chosen (a type chip's tap takes it off: favOff; wardrobe.js wardFlt reads it)
const favOff=()=>{favWard=false};
function favLookTap(){favToggleLook()}
function favWearTap(el){wearFav(el.dataset.k)}
function favItemTap(el){favToggleItem(el.dataset.id)}
function favChipTap(){favWard=true;renderWardrobe()}
acts({favLookTap,favWearTap,favItemTap,favChipTap});
/* An ES module (2026-11-23): its names are its own. The bridge (tests/bridge.test.js lists it): Today, the picker, the item sheet, the Wardrobe, the score card and Insights, classic scripts, call these; favData, favSave and
   favToggleItem are read by the favorites tests. favWard is a `let` only this file writes (wardrobe.js reads it): a getter, no setter. */
Object.assign(globalThis,{FAV_UNDO_MS,favData,favSave,favPieces,favPillSeg,favLastIcon,favStrip,favItemRow,favToggleItem,favMark,favChip,favWhy,favStatsCard,favOff});
Object.defineProperties(globalThis,{favWard:{get:()=>favWard}});
export {FAV_UNDO_MS,favData,favSave,favPieces,favPillSeg,favLastIcon,favStrip,favItemRow,favToggleItem,favMark,favChip,favWhy,favStatsCard,favWard,favOff};
