/* Daily Wardrobe: the Wardrobe tab's search and sort, an item's own name, brand, material and notes, and Delete with Undo.
   Loaded after app.js and stats.js (an ES module since 2026-11-23); app.js calls in here from renderWardrobe, wardList,
   itemBody, save and rm. */
import {askFor,served,serve,emit,ask} from './bus.js';   // the Wardrobe's redraw: itemsheet.js, loaded after this file, pins renderWardrobe for 'wardrobe-changed'
import {$,MATERIALS_BY,MAT_ALIAS,TYPES,accentsOf,colName,colorDesc,dayRecs,desc,fmtDay,hasPat,isCargo,itemFields,itemName,itemTitle,items,lumCol,matAlias,nameIso,nextStamp,nm,noBidi,patName,phSm,planCol,primaryCol,setWardrobe,sockPatterned,sockToeKey,strapBand,titleCls,trouserKind,esc} from './core.js';
import {fam,favItemSet,isFavItem} from './planner.js';
import {wornDays} from './stats.js';
import {atomic,cap1,del,editing,fixupRedraw,flt,put,putRaw,setFlt,tx} from './app.js';
import {srcOk} from './photo-keys.js';
import {wardPic} from './photos.js';
import {itemThumb} from './draw.js';
import {dropItem,openItem} from './item-view.js';
import {whenPulled} from './history.js';
import {planDirty} from './today-plan.js';
import {toast} from './toast.js';
import {saveDay} from './days.js';
import {show} from './nav.js';
import {acts} from './act.js';
import {itemGoneTell} from './ui.js';
import {WARD_FIELDS,WARD_MAX,fldRow,matPicked,matRow,notesRow} from './fields.js';

/* ---- an item's own name (its fields, sizes and rows are fields.js's since the restructure S3c: WARD_FIELDS, WARD_MAX) ---- */
const WATCH_DETAILS_MAX=120;   // a watch's Details (itemsheet.js; W2-12-04: 5,036 letters were kept and synced)
/* itemName / itemTitle / titleCls are in core.js: Today is drawn at start-up, which can be before this file has loaded */

/* ---- search ---- */
let wardQ='';        // what is typed in the search field
let wardMemo=null;   // the list on screen, kept until the next redraw (the sheet's swipe asks for it on every touch move)
/* (fix round 3, W2-16-07) every combining mark goes (Arabic hamza and short vowels too: ابيض finds أبيض, إ آ ؤ ئ their plain letters),
   ة finds ه and ى ي, tatweel goes, and Arabic-Indic and Persian digits are 0-9 (2 finds ٢) */
const wardNorm=t=>String(t??'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'')
  .replace(/[٠-٩]/g,d=>d.charCodeAt(0)-0x660).replace(/[۰-۹]/g,d=>d.charCodeAt(0)-0x6f0).replace(/\s+/g,' ').trim();
/* everything a search looks through: name, brand, notes, material, the type, the colours' names and the pattern */
/* (2026-11-15, American English) the British words still find what they used to: "grey" finds the gray pieces, "trousers" the pants */
/* (2026-11-16) its accents too: a paisley tie with a red accent is found by "red" (core.js accentsOf) */
/* (2026-11-16) the casual garments' other names: "tee" finds the T-shirts, "jumper" the sweaters, "1/4 zip" the quarter-zips, "field jacket"
   the chore jackets, "cargos" the cargo pants; "casual" finds every piece picked by hand only */
const CASUAL_HAY={tee:'tee tees tshirt t-shirt casual',polo:'polo shirt casual',henley:'henley casual',sweater:'jumper pullover crewneck knit knitwear casual',
  sweatshirt:'sweat crewneck casual',hoodie:'hooded hoody casual',qzip:'quarter zip 1/4 zip half zip pullover knit casual',cardigan:'cardi knit knitwear casual',chore:'chore coat field jacket work jacket overshirt casual',blouse:'ocp uniform coat blouse military camouflage camo scorpion acu casual'};
const wardHay=i=>{const h=wardNorm([i.name,i.brand,i.notes,i.material==='other'?'':i.material,TYPES[i.type],i.type,desc(i),colorDesc(i),hasPat(i.type)?patName(i.pattern||'solid'):'',CASUAL_HAY[i.type]||(isCargo(i)?'cargo cargos casual':''),matSyn(i),i.type==='pocketsquare'?'hank handkerchief pochette':'',...accentsOf(i).map(colName)].join(' '));   // (a pocket square's other names, 2026-11-16)
  return h+(h.includes('gray')?' grey':'')+(i.type==='pants'?' trousers':'')};
/* (2026-11-15, the materials audit) a material's other words, from core.js MAT_ALIAS: "fresco" finds tropical wool, "lisle" mercerized
   cotton, "broadcloth" poplin, "nylon" a performance stretch shirt; a stored name off the list finds by the listed one it means ("Merino"
   socks by merino wool). A narrower word for a broader name ("knitted silk" for silk) is left out, or every silk tie would match it */
const matSyn=i=>{const m=String(i.material||'').toLowerCase().trim();if(!m||m==='other'||!MATERIALS_BY[i.type])return '';const canon=matAlias(i.type,m)||m,out=canon===m?[]:[canon];
  for(const tbl of [MAT_ALIAS['*'],MAT_ALIAS[i.type]||{}])for(const [w,t] of Object.entries(tbl))if(t===canon&&!/knit/.test(w))out.push(w);return out.join(' ')};
const wardMatch=(i,q)=>{const h=wardHay(i);return q.split(' ').every(w=>h.includes(w))};   // every word typed must be there

/* ---- sort ---- */
const WARD_SORTS=[['type','By type'],['new','Newest first'],['worn','Most worn'],['rest','Longest since worn'],['colour','Color'],['az','A to Z']];
const wardSort=()=>{try{const s=localStorage.getItem('ward_sort');return WARD_SORTS.some(x=>x[0]===s)?s:'type'}catch{return 'type'}};
function setWardSort(s){try{localStorage.setItem('ward_sort',s)}catch{}wardRefresh()}
/* colour families for the Colour order, each shown light to dark */
const WARD_FAMS=['neutral','blue','brown','green','red','purple','metal'];
const WARD_FAM={white:'neutral',silver:'neutral',grey:'neutral',charcoal:'neutral',black:'neutral',lightblue:'blue',blue:'blue',navy:'blue',cream:'brown',tan:'brown',brown:'brown',gold:'brown',
  green:'green',olive:'green',pink:'red',red:'red',burgundy:'red',purple:'purple'};
const wardNoCol=i=>(i.type==='watch'&&!strapBand(i))||i.type==='cufflinks'||i.type==='tieclip';   // shown by their metal, not a colour
const wardFam=i=>{if(wardNoCol(i))return WARD_FAMS.indexOf('metal');const c=planCol(i),k=WARD_FAMS.indexOf(WARD_FAM[fam(c)]||WARD_FAM[c]);return k<0?WARD_FAMS.length:k};
/* how often and when each item was really worn: {n:{id:count}, last:{id:Date}} */
function wardWear(){const n={},last={};
  for(const d of wornDays())for(const id of Object.values(d.ids||{})){if(!id||typeof id!=='string')continue;n[id]=(n[id]||0)+1;last[id]=d.d}
  return {n,last}}
function wardOrder(list,sort,wear){
  const T=Object.keys(TYPES),ti=i=>{const k=T.indexOf(i.type);return k<0?T.length:k},nw=(a,b)=>(b.added||0)-(a.added||0),byType=(a,b)=>ti(a)-ti(b)||nw(a,b);
  const nmOf=i=>itemTitle(i)||nm(i);
  const f=sort==='new'?nw:
    sort==='az'?(a,b)=>nmOf(a).localeCompare(nmOf(b),undefined,{sensitivity:'base',numeric:true})||byType(a,b):
    sort==='colour'?(a,b)=>wardFam(a)-wardFam(b)||lumCol(primaryCol(b))+(b.shade||0)*4-lumCol(primaryCol(a))-(a.shade||0)*4||byType(a,b):
    sort==='worn'?(a,b)=>(wear.n[b.id]||0)-(wear.n[a.id]||0)||byType(a,b):
    sort==='rest'?(a,b)=>(+wear.last[a.id]||0)-(+wear.last[b.id]||0)||byType(a,b):   // never worn first, then the longest ago
    byType;
  return list.slice().sort(f)}
/* the Wardrobe list on screen: the chip's type, what the search matches, in the chosen order. The item sheet steps through it. */
/* the chip chosen: 'all', a type, or 'fav' (the favorite pieces: fav.js favWard), which goes back to the type chip once no piece is a favorite */
const wardFlt=()=>askFor('fav-ward')?'fav':flt;
function wardView(){
  const ft=wardFlt(),q=wardNorm(wardQ),s=wardSort(),k=ft+'|'+s+'|'+q+(ft==='fav'?'|'+[...favItemSet()].join():'');
  if(wardMemo&&wardMemo.items===items&&wardMemo.n===items.length&&wardMemo.k===k)return wardMemo.list;
  const wear=s==='worn'||s==='rest'?wardWear():null;
  const list=wardOrder(items.filter(i=>(ft==='all'||i.type===ft||(ft==='fav'&&isFavItem(i.id)))&&(!q||wardMatch(i,q))),s,wear);
  wardMemo={items,n:items.length,k,list,wear,sort:s,q};return list}
const wardFresh=()=>{wardMemo=null;return wardView()};

/* ---- the Wardrobe's top: count, search field, sort ---- */
const wardCount=list=>list.length===items.length?`${items.length} item${items.length===1?'':'s'}`:`${list.length} of ${items.length} item${items.length===1?'':'s'}`;
function wardBar(){
  const s=wardSort();
  return `<div class="wfind"><div class="wsearch"><svg class="wsicon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`+
    `<input type="text" id="wsearch" dir="auto" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Search your wardrobe" placeholder="Search" value="${esc(wardQ)}" data-act-input="wardSearchType" data-act-keydown="wardSearchKey">`+
    `<button type="button" class="wclear" id="wclear" aria-label="Clear search" data-act="wardClearTap"${wardQ?'':' hidden'}>×</button></div>`+
    `<select class="wsort" id="wsort" aria-label="Sort the wardrobe" data-act-change="wardSortPick">${WARD_SORTS.map(([k,l])=>`<option value="${k}"${k===s?' selected':''}>${l}</option>`).join('')}</select></div>`}
/* a box's tag: Sample, Out of rotation, On the way, away being cleaned, due for cleaning */
function giTag(i){return i.paused?`<span class="pausetag">${i.order?`On the way${i.arrives?' · '+fmtDay(i.arrives):''}`:i.away?ask('care-tag',i)??'Out of rotation':'Out of rotation'}</span>`:i.sample&&served('kit-sample-tag')?askFor('kit-sample-tag',i):ask('care-badge',i)??''}
/* ...read out with the box's name: the aria-label took its place, so a sample piece sounded like one's own (re-audit 2026-11-15) */
function giNote(tag){const t=String(tag||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();return t?', '+t:''}
/* the grid, or what to say when there is nothing to show */
function wardGrid(list){
  if(list.length){const m=wardMemo&&wardMemo.list===list?wardMemo:null,w=m&&m.wear,
      wl=i=>!w?'':`<small class="wwear">${m.sort==='worn'?(w.n[i.id]?`Worn ${w.n[i.id]} time${w.n[i.id]===1?'':'s'}`:'Not worn yet'):w.last[i.id]?`Last worn ${w.last[i.id].toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:'Not worn yet'}</small>`;
    return `<div class="grid">${list.map(i=>{const tag=giTag(i),wp=wardPic(i);return `<div class="gi${i.paused?' paused':''}" id="gi-${esc(i.id)}"><button class="giopen" data-act="wardOpenTap" data-id="${esc(i.id)}" aria-label="Open ${esc(TYPES[i.type]||'item')}: ${esc(itemTitle(i))}${giNote(tag)}${isFavItem(i.id)?', favorite':''}">${askFor('fav-mark',i)??''}${wp?`<img class="ph" src="${srcOk(wp)}" alt="">`:i.photo?`<img class="ph" src="${srcOk(phSm(i))}" alt="">`:itemThumb(i)}<span class="gimeta"><small class="gtype">${isCargo(i)?'Cargo pants':i.type==='pants'&&trouserKind(i)!=='dress'?cap1(trouserKind(i)):TYPES[i.type]||'Item'}</small><b class="${titleCls(i)}">${esc(itemTitle(i))}</b>${wl(i)}</span>${tag}</button></div>`}).join('')}</div>`}   // (wardPic once a box: each call schedules the picture's download)
  const q=wardNorm(wardQ);
  if(!items.length&&served('setup-ward-empty'))return askFor('setup-ward-empty');   // setup.js: the empty Wardrobe's card
  if(!q||!items.length)return '<p class="mut">Nothing here yet. Add one with the + button.</p>';
  const all=flt==='all'?0:items.filter(i=>wardMatch(i,q)).length,tl=(TYPES[flt]||'').toLowerCase();
  return `<div class="wnone" id="wnone"><b>Nothing matches “${esc(wardQ.trim())}”${flt==='all'?'':` in ${esc(tl)}`}</b><p class="mut">${all?`${all} item${all===1?' matches':'s match'} in the rest of your wardrobe.`:'Search looks at names, brands, notes, materials, types, colors and patterns.'}</p>`+
    `<div class="btns">${all?`<button type="button" class="pri" data-act="wardAllTap">Search all types</button>`:''}<button type="button" data-act="wardClearTap">Clear search</button></div></div>`}
/* redraws only the grid and the count: the search field is left alone, so typing keeps its focus and the keyboard */
function wardRefresh(){
  const sl=$('#wslide');if(!sl)return;const list=wardFresh();sl.innerHTML=wardGrid(list);
  const c=$('#wcount');if(c)c.textContent=wardCount(list);const x=$('#wclear');if(x)x.hidden=!wardQ}
function wardSearch(v){wardQ=String(v??'');wardRefresh()}
function wardClear(){wardQ='';const el=$('#wsearch');if(el){el.value='';el.focus()}wardRefresh()}
/* a full redraw of the Wardrobe (a sync arriving, an edit) while the field is in use: put the focus and the caret back */
function wardKeep(){const el=document.activeElement;return el&&el.id==='wsearch'?{s:el.selectionStart,e:el.selectionEnd}:null}
function wardBack(f){if(!f)return;const el=$('#wsearch');if(!el)return;el.focus({preventScroll:true});try{el.setSelectionRange(f.s,f.e)}catch{}}

/* ---- name, brand, material, notes (their rows: fields.js matLabel, matRow, fldRow, notesRow) ---- */
/* the item sheet's Details card: name and brand at its top, material and notes at its end. A text field saves when it is left,
   and a moment after the last keystroke too (a sheet swiped away never tells a field it was left) */
/* what is typed is also kept at once in localStorage (ward_pending {id,k,v,at}) until it is saved, and saved straight away when the page goes
   to the background or is closed (2026-11-15, the new-user audit: a name typed and Safari swiped away within 0.6 s was lost when iOS later
   killed it: a hidden page's timers stop). A copy left by a kill is put back at the next start (wardPendingRestore, from safetyStart) when
   that field still holds what it held before the typing began (was; another device's change since wins) */
let wardTypeT=null,wardPend=null;
const WARD_PEND='ward_pending';
function wardPendSet(p){wardPend=p;try{if(p)localStorage.setItem(WARD_PEND,JSON.stringify(p));else localStorage.removeItem(WARD_PEND)}catch{}}
function itemFieldSoon(id,k,v){clearTimeout(wardTypeT);const it=items.find(x=>x.id===id),was=wardPend&&wardPend.id===id&&wardPend.k===k?wardPend.was:String(it&&it[k]||'');   // was: the field before this typing began
  wardPendSet({id,k,v:String(v??'').slice(0,WARD_MAX[k]||500),was,at:Date.now()});wardTypeT=setTimeout(wardFlush,600)}
// (the kept copy is not cleared here: a write begun as the page closes can be cut off after it reported success; the next start finds
// the item stamped after the copy and drops it)
function wardFlush(){clearTimeout(wardTypeT);wardTypeT=null;const p=wardPend;if(!p)return;wardPend=null;return setItemField(p.id,p.k,p.v)}
function itemFieldNow(id,k,v){clearTimeout(wardTypeT);wardPend=null;return setItemField(id,k,v)}
addEventListener('pagehide',()=>wardFlush());
document.addEventListener('visibilitychange',()=>{if(document.hidden)wardFlush()});
async function wardPendingRestore(){let p=null;try{p=JSON.parse(localStorage.getItem(WARD_PEND)||'null')}catch{}if(!p||!p.id||!WARD_FIELDS.includes(p.k)||wardPend)return false;
  const it=items.find(x=>x.id===p.id),cur=String(it&&it[p.k]||'');wardPendSet(null);
  if(!it||cur===String(p.v).trim()||cur!==String(p.was??''))return false;   // saved already, or changed since (on another device): left alone
  await setItemField(p.id,p.k,p.v);return true}
const ivOn=id=>k=>`data-id="${esc(id)}" data-f="${k}" data-act-input="itemFieldType" data-act-change="itemFieldDone"`;
/* the Material control's attributes, for matRow, on the item sheet (the item's id; an Add card's: add-card.js matOn) */
const matOnItem=id=>`data-id="${esc(id)}" data-act-change="matItemPick"`;
function wardFieldsTop(i){return fldRow('name','Name',i.name,ivOn(i.id),'Optional')+fldRow('brand','Brand',i.brand,ivOn(i.id),'Optional')}
function wardFieldsEnd(i){return matRow(i.type,i.material,matOnItem(i.id))+notesRow(i.notes,ivOn(i.id))}
/* saving one of them. Text fields don't redraw the sheet (the next field tapped would lose its focus): only the title and the grid follow */
async function setItemField(id,k,v){
  const it=items.find(x=>x.id===id);if((!it)&&itemGoneTell(id))return;if(!it||!WARD_FIELDS.includes(k))return;v=noBidi(v).trim().slice(0,WARD_MAX[k]);if((it[k]||'')===v)return;   // (noBidi: no right-to-left overrides, W2-12-06, core.js)
  if(v)it[k]=v;else delete it[k];if(it.sample)it.sampleMine=1;   // his edit (also when typed text is saved after the sheet closed: kit.js kitEdited)
  await put(it);
  if(k==='material'){emit('wardrobe-changed');return}   // Other shows or hides its field
  wardRefresh();const h=$('#iv-title');if(h&&editing===id){h.textContent=itemTitle(it)||TYPES[it.type]||'Item';h.className=titleCls(it)}}
/* (the Add card's name, brand, notes and Material are kept on the card by add-card.js setQField) */

/* ---- one-time rename of the owner's stretch shirts (2026-11-15, his decision on the materials audit) ----
   He typed his 10 stretch shirts (74% nylon, 26% spandex) as "nylon/spandex", and they were then moved to "nylon"; the list's entry is now
   "performance stretch". Exactly those words on a shirt (any case) are renamed, through the normal save and sync (his own wording, so in
   the app rather than written to the server); idempotent, and run again when a sync brings an old copy in (dress.js dressSynced) */
const MAT_RENAME={shirt:{'nylon/spandex':'performance stretch',nylon:'performance stretch'}};
const matRenameTo=i=>!!i&&(MAT_RENAME[i.type]||{})[String(i.material||'').toLowerCase().trim()]||'';
let matMigrating=false;
async function matMigrate(){if(matMigrating)return 0;matMigrating=true;let n=0;
  try{const stored=((await tx('readonly',s=>s.getAll()))||[]).filter(matRenameTo);
    for(const r of stored){const i=items.find(x=>x.id===r.id)||r,to=matRenameTo(i);if(!to)continue;i.material=to;i.updated=nextStamp(stamp(i));
      await atomic('items',i.id,cur=>{itemFields(i,cur);return {put:i}});n++}   // (CR-5-08: the material alone stamped, by the corrected clock, as app.js put does; it was the whole item at Date.now())
    if(n){askFor('sync-soon');wardMemo=null;fixupRedraw()}}
  catch(e){console.warn('material rename',e)}finally{matMigrating=false}
  return n}
whenPulled(()=>matMigrate());
/* ---- a sock's toe cap moves to its own field (2026-11-17, sock patterns) ----
   Until now a sock's secondaryColor was its toe cap; now the second and third colours are the pattern's (an argyle's diamonds and lines) and
   the toe cap is item.toeColor. Each sock with no toeColor (from before, or from an older app by sync) gets it from its secondaryColor, or
   'none', and a plain sock's secondaryColor and tertiaryColor go; only those fields are stamped, by the corrected clock (as matMigrate), so
   the move syncs and merges field by field. Idempotent (a migrated sock has toeColor), run after the first pull and again when a sync
   brings in a sock from an older app (dress.js dressSynced). Until it has run, core.js sockToe reads such a sock the old way, so the
   drawing and the words never change */
const sockLegacy=i=>!!i&&i.type==='socks'&&i.toeColor===undefined;
let sockMigrating=false;
async function sockToeMigrate(){if(sockMigrating)return 0;sockMigrating=true;let n=0;
  try{const stored=((await tx('readonly',s=>s.getAll()))||[]).filter(sockLegacy);
    for(const r of stored){const i=items.find(x=>x.id===r.id)||r;if(!sockLegacy(i))continue;
      i.toeColor=sockToeKey(i)||'none';if(!sockPatterned(i)){delete i.secondaryColor;delete i.tertiaryColor}i.updated=nextStamp(stamp(i));
      await atomic('items',i.id,cur=>{itemFields(i,cur);return {put:i}});n++}
    if(n){askFor('sync-soon');wardMemo=null;fixupRedraw()}}
  catch(e){console.warn('sock toe move',e)}finally{sockMigrating=false}
  return n}
whenPulled(()=>sockToeMigrate());
/* (copying them from the Add card onto the item being saved: fields.js wardSaveFields) */

/* ---- Delete, with Undo ----
   Delete removes the item at once (a tombstone, so it goes from every device) and offers Undo for WARD_UNDO_MS. Undo writes the
   item back as it was under a stamp newer than its tombstone: in a merge the newest of the two wins (mergeState in core.js), so
   it comes back on every device, including one that had already taken the deletion. */
const WARD_UNDO_MS=8000;
const wardBusy=new Set();   // an item being deleted or duplicated: a second tap meanwhile does nothing (2026-11-15: a double tap made two toasts, two copies)
async function wardOnce(key,f){if(wardBusy.has(key))return;wardBusy.add(key);try{return await f()}finally{setTimeout(()=>wardBusy.delete(key),400)}}
const wardDuplicate=id=>wardOnce('dup',()=>askFor('kit-duplicate',id));   // (one key: the sheet moves to the copy, whose Duplicate the second tap would hit)
const wardDelete=id=>wardOnce('del:'+id,()=>wardDeleteNow(id));
async function wardDeleteNow(id){
  const k=items.findIndex(i=>i.id===id);if(k<0)return;const it=items[k],snap=JSON.parse(JSON.stringify(it));
  const days=Object.values(dayRecs).filter(r=>JSON.stringify(r).includes(id)).map(r=>JSON.parse(JSON.stringify(r)));   // the days that refer to it, as they are now
  const at=await del(id);setWardrobe({items:items.filter(i=>i.id!==id)});planDirty();if(editing===id)dropItem();emit('wardrobe-changed');
  toast(`Deleted ${nameIso(itemName(it)||nm(it))}`,WARD_UNDO_MS,{label:'Undo',fn:()=>wardUndelete(snap,k,days,at)})}
async function wardUndelete(it,k,days,at){
  if(items.some(i=>i.id===it.id))return;
  it.updated=nextStamp(at);await putRaw(it);   // newer than the tombstone: the item wins the merge (restamped whole: its field stamps no longer match, core.js fsOk)
  items.splice(Math.min(k,items.length),0,it);
  for(const r of days){const cur=dayRecs[r.date];if(!cur||JSON.stringify(cur)!==JSON.stringify(r))await saveDay(r,true)}   // a day re-planned without it meanwhile
  planDirty();askFor('sync-soon');
  const v=['today','wardrobe','stats'].find(t=>$('#'+t)&&!$('#'+t).hidden);if(v)show(v);
  toast(`${nameIso(cap1(itemName(it)||nm(it)))} is back`)}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,WARD_UNDO_MS,itemFieldSoon,setWardSort,wardClear,wardDeleteNow,wardHay,wardMatch,wardNorm,wardOrder,get wardQ(){return wardQ},set wardQ(v){wardQ=v},wardSearch,wardSort,wardFresh,wardKeep,matMigrate,setItemField,sockToeMigrate,wardPendingRestore};
export {WATCH_DETAILS_MAX,wardQ,wardNorm,wardHay,wardMatch,wardSort,setWardSort,wardOrder,wardFlt,wardView,wardFresh,wardCount,wardBar,wardGrid,wardSearch,wardClear,wardKeep,wardBack,itemFieldSoon,wardPendingRestore,ivOn,matOnItem,wardFieldsTop,setItemField,matRenameTo,matMigrate,sockLegacy,sockToeMigrate,WARD_UNDO_MS,wardDuplicate,wardDelete,wardDeleteNow};
/* what the controls do (act.js). The Wardrobe's top and grid: the search field (typing; Escape empties a field that holds something, and goes no
   further), its ×, the sort, a piece's box (data-id), and the two buttons under "Nothing matches" */
function wardSearchType(el){wardSearch(el.value)}
function wardSearchKey(el,ev){if(ev.key==='Escape'&&el.value){ev.stopPropagation();wardClear()}}
function wardClearTap(){wardClear()}
function wardSortPick(el){setWardSort(el.value)}
function wardOpenTap(el){openItem(el.dataset.id)}
function wardAllTap(){setFlt('all');emit('wardrobe-changed')}   // (setFlt: itemsheet.js, the one place the type filter is set)
/* the item sheet's Name, Brand and Notes (ivOn: data-id, data-f), as they are typed and when the field is left; Material on the item sheet
   (fields.js matPicked; an Add card's: add-card.js matCardPick) */
function itemFieldType(el){itemFieldSoon(el.dataset.id,el.dataset.f,el.value)}
function itemFieldDone(el){itemFieldNow(el.dataset.id,el.dataset.f,el.value)}
function matItemPick(el){setItemField(el.dataset.id,'material',matPicked(el))}
acts({wardSearchType,wardSearchKey,wardClearTap,wardSortPick,wardOpenTap,wardAllTap,itemFieldType,itemFieldDone,matItemPick});
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('item-field',setItemField);serve('ward-view',wardView);serve('ward-pending-restore',()=>whenPulled(wardPendingRestore));serve('ward-synced',m=>{if(m&&(m.items||[]).some(matRenameTo))matMigrate();if(m&&(m.items||[]).some(sockLegacy))sockToeMigrate()});
