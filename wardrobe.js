/* Daily Wardrobe: the Wardrobe tab's search and sort, an item's own name, brand, material and notes, and Delete with Undo.
   Loaded after app.js and stats.js (classic script, one shared scope); app.js calls in here from renderWardrobe, wardList,
   itemBody, save and rm. */

/* ---- an item's own name ---- */
const WARD_FIELDS=['name','brand','material','notes'];
const WARD_MAX={name:60,brand:40,material:40,notes:500};
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
const wardHay=i=>{const h=wardNorm([i.name,i.brand,i.notes,i.material==='other'?'':i.material,TYPES[i.type],i.type,desc(i),colorDesc(i),FABRIC.includes(i.type)?patName(i.pattern||'solid'):'',matSyn(i)].join(' '));
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
const wardFam=i=>{if(wardNoCol(i))return WARD_FAMS.indexOf('metal');const c=planCol(i),k=WARD_FAMS.indexOf(WARD_FAM[typeof fam==='function'?fam(c):c]||WARD_FAM[c]);return k<0?WARD_FAMS.length:k};
/* how often and when each item was really worn: {n:{id:count}, last:{id:Date}} */
function wardWear(){const n={},last={};
  for(const d of typeof wornDays==='function'?wornDays():[])for(const id of Object.values(d.ids||{})){if(!id||typeof id!=='string')continue;n[id]=(n[id]||0)+1;last[id]=d.d}
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
function wardView(){
  const q=wardNorm(wardQ),s=wardSort(),k=flt+'|'+s+'|'+q;
  if(wardMemo&&wardMemo.items===items&&wardMemo.n===items.length&&wardMemo.k===k)return wardMemo.list;
  const wear=s==='worn'||s==='rest'?wardWear():null;
  const list=wardOrder(items.filter(i=>(flt==='all'||i.type===flt)&&(!q||wardMatch(i,q))),s,wear);
  wardMemo={items,n:items.length,k,list,wear,sort:s,q};return list}
const wardFresh=()=>{wardMemo=null;return wardView()};

/* ---- the Wardrobe's top: count, search field, sort ---- */
const wardCount=list=>list.length===items.length?`${items.length} item${items.length===1?'':'s'}`:`${list.length} of ${items.length} item${items.length===1?'':'s'}`;
function wardBar(){
  const s=wardSort();
  return `<div class="wfind"><div class="wsearch"><svg class="wsicon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`+
    `<input type="text" id="wsearch" dir="auto" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Search your wardrobe" placeholder="Search" value="${esc(wardQ)}" oninput="wardSearch(this.value)" onkeydown="if(event.key==='Escape'&&this.value){event.stopPropagation();wardClear()}">`+
    `<button type="button" class="wclear" id="wclear" aria-label="Clear search" onclick="wardClear()"${wardQ?'':' hidden'}>×</button></div>`+
    `<select class="wsort" id="wsort" aria-label="Sort the wardrobe" onchange="setWardSort(this.value)">${WARD_SORTS.map(([k,l])=>`<option value="${k}"${k===s?' selected':''}>${l}</option>`).join('')}</select></div>`}
/* the grid, or what to say when there is nothing to show */
function wardGrid(list){
  if(list.length){const m=wardMemo&&wardMemo.list===list?wardMemo:null,w=m&&m.wear,
      wl=i=>!w?'':`<small class="wwear">${m.sort==='worn'?(w.n[i.id]?`Worn ${w.n[i.id]} time${w.n[i.id]===1?'':'s'}`:'Not worn yet'):w.last[i.id]?`Last worn ${w.last[i.id].toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:'Not worn yet'}</small>`;
    return `<div class="grid">${list.map(i=>{const tag=giTag(i);return `<div class="gi${i.paused?' paused':''}" id="gi-${esc(i.id)}"><button class="giopen" onclick="openItem('${jsq(i.id)}')" aria-label="Open ${esc(TYPES[i.type]||'item')}: ${esc(itemTitle(i))}${giNote(tag)}">${wardPic(i)?`<img class="ph" src="${srcOk(wardPic(i))}" alt="">`:i.photo?`<img class="ph" src="${srcOk(phSm(i))}" alt="">`:itemThumb(i)}<span class="gimeta"><small class="gtype">${i.type==='pants'&&trouserKind(i)!=='dress'?cap1(trouserKind(i)):TYPES[i.type]||'Item'}</small><b class="${titleCls(i)}">${esc(itemTitle(i))}</b>${wl(i)}</span>${tag}</button></div>`}).join('')}</div>`}
/* a box's tag: Sample, Out of rotation, On the way, away being cleaned, due for cleaning */
function giTag(i){return i.paused?`<span class="pausetag">${i.order?`On the way${i.arrives?' · '+fmtDay(i.arrives):''}`:i.away&&typeof careTag==='function'?careTag(i):'Out of rotation'}</span>`:i.sample&&typeof kitSampleTag==='function'?kitSampleTag(i):typeof careBadge==='function'?careBadge(i):''}
/* ...read out with the box's name: the aria-label took its place, so a sample piece sounded like one's own (re-audit 2026-11-15) */
function giNote(tag){const t=String(tag||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();return t?', '+t:''}
  const q=wardNorm(wardQ);
  if(!items.length&&typeof setupWardEmpty==='function')return setupWardEmpty();   // setup.js: the empty Wardrobe's card
  if(!q||!items.length)return '<p class="mut">Nothing here yet. Add one with the + button.</p>';
  const all=flt==='all'?0:items.filter(i=>wardMatch(i,q)).length,tl=(TYPES[flt]||'').toLowerCase();
  return `<div class="wnone" id="wnone"><b>Nothing matches “${esc(wardQ.trim())}”${flt==='all'?'':` in ${esc(tl)}`}</b><p class="mut">${all?`${all} item${all===1?' matches':'s match'} in the rest of your wardrobe.`:'Search looks at names, brands, notes, materials, types, colors and patterns.'}</p>`+
    `<div class="btns">${all?`<button type="button" class="pri" onclick="flt='all';renderWardrobe()">Search all types</button>`:''}<button type="button" onclick="wardClear()">Clear search</button></div></div>`}
/* redraws only the grid and the count: the search field is left alone, so typing keeps its focus and the keyboard */
function wardRefresh(){
  const sl=$('#wslide');if(!sl)return;const list=wardFresh();sl.innerHTML=wardGrid(list);
  const c=$('#wcount');if(c)c.textContent=wardCount(list);const x=$('#wclear');if(x)x.hidden=!wardQ}
function wardSearch(v){wardQ=String(v??'');wardRefresh()}
function wardClear(){wardQ='';const el=$('#wsearch');if(el){el.value='';el.focus()}wardRefresh()}
/* a full redraw of the Wardrobe (a sync arriving, an edit) while the field is in use: put the focus and the caret back */
function wardKeep(){const el=document.activeElement;return el&&el.id==='wsearch'?{s:el.selectionStart,e:el.selectionEnd}:null}
function wardBack(f){if(!f)return;const el=$('#wsearch');if(!el)return;el.focus({preventScroll:true});try{el.setSelectionRange(f.s,f.e)}catch{}}

/* ---- name, brand, material, notes ---- */
const matLabel=m=>m==='other'?'Other':cap1(m);
/* the Material dropdown for a type (none for types without a list): its own materials, then Other (with a field to say which) and None */
/* ai: Claude's suggestion on an Add card (tagging.js takeMaterial: {key, conf, why}), said under the field while the field still holds it */
// (2026-11-16) the list is the type's own plus the person's own materials (core.js matsFor); one removed from those shows as Other with its name
function matRow(type,cur,call,ai){
  const l=matsFor(type);if(!l)return '';const m=String(cur||'').trim(),other=!!m&&!l.includes(m),sug=ai&&ai.key&&ai.key===m;
  return `<label>Material <select class="wmat" onchange="${call}this.value)">${[['','None'],...l.map(x=>[x,x]),['other','Other']].map(([v,t])=>`<option value="${v}"${v===(other?'other':m)?' selected':''}>${cap1(t)}</option>`).join('')}</select></label>`+
    (sug?`<p class="tagnote matai"><small>Material suggested by Claude (${esc(ai.conf||'medium')} confidence)${ai.why?`: ${esc(String(ai.why).replace(/[.\s]+$/,''))}`:''}. Change it if it’s wrong.</small></p>`:'')+
    (other?`<label class="wmat-o">Which material? <input type="text" class="wfld wmat-t" dir="auto" maxlength="${WARD_MAX.material}" value="${esc(m==='other'?'':m)}" placeholder="e.g. alpaca" onchange="${call}this.value.trim()||'other')"></label>`:'')}
const fldRow=(k,lab,v,on,ph)=>`<label>${lab} <input type="text" class="wfld wf-${k}" dir="auto" maxlength="${WARD_MAX[k]}" value="${esc(v||'')}" placeholder="${ph}" autocomplete="off" ${on(k)}></label>`;
const notesRow=(v,on)=>`<label class="wnotes">Notes <textarea class="wf-notes" dir="auto" rows="2" maxlength="${WARD_MAX.notes}" placeholder="Size, where it came from, how it fits…" ${on('notes')}>${esc(v||'').replace(/>/g,'&gt;')}</textarea></label>`;
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
const ivOn=id=>k=>`oninput="itemFieldSoon('${jsq(id)}','${k}',this.value)" onchange="itemFieldNow('${jsq(id)}','${k}',this.value)"`;
function wardFieldsTop(i){return fldRow('name','Name',i.name,ivOn(i.id),'Optional')+fldRow('brand','Brand',i.brand,ivOn(i.id),'Optional')}
function wardFieldsEnd(i){return matRow(i.type,i.material,`setItemField('${jsq(i.id)}','material',`)+notesRow(i.notes,ivOn(i.id))}
/* saving one of them. Text fields don't redraw the sheet (the next field tapped would lose its focus): only the title and the grid follow */
async function setItemField(id,k,v){
  const it=items.find(x=>x.id===id);if(!it&&typeof itemGoneTell==='function'&&itemGoneTell(id))return;if(!it||!WARD_FIELDS.includes(k))return;v=noBidi(v).trim().slice(0,WARD_MAX[k]);if((it[k]||'')===v)return;   // (noBidi: no right-to-left overrides, W2-12-06, core.js)
  if(v)it[k]=v;else delete it[k];if(it.sample)it.sampleMine=1;   // his edit (also when typed text is saved after the sheet closed: kit.js kitEdited)
  await put(it);
  if(k==='material')return renderWardrobe();   // Other shows or hides its field
  wardRefresh();const h=$('#iv-title');if(h&&editing===id){h.textContent=itemTitle(it)||TYPES[it.type]||'Item';h.className=titleCls(it)}}
/* the Add card: name, brand and notes behind "More details", folded until asked for (the Material is out with the other fields, above it); each keystroke is kept on the card (nothing is redrawn) */
function toggleMore(i){const q=queue[i];if(!q)return;q.more=!q.more;renderAdd()}
function setQField(i,k,v){const q=queue[i];if(!q||!WARD_FIELDS.includes(k))return;v=String(v??'').slice(0,WARD_MAX[k]);if(v.trim())q[k]=v;else delete q[k];
  if(k==='material'){delete q.matAI;q.matSet=1;q.checked={...q.checked,fabric:1}}   // chosen by hand (and so its checklist section is checked, add.js addCkSecs): no longer Claude's suggestion, and a later reading leaves it (tagging.js takeMaterial)
  if(typeof addKeepSoon==='function')addKeepSoon();if(k==='material')renderAdd()}

/* ---- one-time rename of the owner's stretch shirts (2026-11-15, his decision on the materials audit) ----
   He typed his 10 stretch shirts (74% nylon, 26% spandex) as "nylon/spandex", and they were then moved to "nylon"; the list's entry is now
   "performance stretch". Exactly those words on a shirt (any case) are renamed, through the normal save and sync (his own wording, so in
   the app rather than written to the server); idempotent, and run again when a sync brings an old copy in (dress.js dressSynced) */
const MAT_RENAME={shirt:{'nylon/spandex':'performance stretch',nylon:'performance stretch'}};
const matRenameTo=i=>!!i&&(MAT_RENAME[i.type]||{})[String(i.material||'').toLowerCase().trim()]||'';
let matMigrating=false;
async function matMigrate(){if(matMigrating)return 0;matMigrating=true;let n=0;
  try{const stored=((await tx('readonly',s=>s.getAll()))||[]).filter(matRenameTo);
    for(const r of stored){const i=items.find(x=>x.id===r.id)||r,to=matRenameTo(i);if(!to)continue;i.material=to;i.updated=Date.now();await putRaw(i);n++}
    if(n){if(window.scheduleSync)scheduleSync();wardMemo=null;if(typeof fixupRedraw==='function')fixupRedraw()}}
  catch(e){console.warn('material rename',e)}finally{matMigrating=false}
  return n}
if(typeof whenPulled==='function')whenPulled(()=>matMigrate());
function moreRow(q,i){
  const n=WARD_FIELDS.filter(k=>k!=='material'&&q[k]&&String(q[k]).trim()).length,on=k=>`oninput="setQField(${i},'${k}',this.value)"`;
  return `<div class="morefold${q.more?' open':''}"><button type="button" class="morebtn" aria-expanded="${!!q.more}" onclick="toggleMore(${i})"><span>More details${n?` <small class="mut">· ${n} filled in</small>`:''}</span><svg class="morechev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`+
    (q.more?`<div class="morein">${fldRow('name','Name',q.name,on,'Optional')}${fldRow('brand','Brand',q.brand,on,'Optional')}${notesRow(q.notes,on)}</div>`:'')+`</div>`}
/* copies them from the Add card onto the item being saved */
function wardSaveFields(q,it){for(const k of WARD_FIELDS){const v=noBidi(q[k]).trim().slice(0,WARD_MAX[k]);if(v&&(k!=='material'||MATERIALS_BY[it.type]))it[k]=v}}

/* ---- Delete, with Undo ----
   Delete removes the item at once (a tombstone, so it goes from every device) and offers Undo for WARD_UNDO_MS. Undo writes the
   item back as it was under a stamp newer than its tombstone: in a merge the newest of the two wins (mergeState in core.js), so
   it comes back on every device, including one that had already taken the deletion. */
const WARD_UNDO_MS=8000;
const wardBusy=new Set();   // an item being deleted or duplicated: a second tap meanwhile does nothing (2026-11-15: a double tap made two toasts, two copies)
async function wardOnce(key,f){if(wardBusy.has(key))return;wardBusy.add(key);try{return await f()}finally{setTimeout(()=>wardBusy.delete(key),400)}}
const wardDuplicate=id=>wardOnce('dup',()=>kitDuplicate(id));   // (one key: the sheet moves to the copy, whose Duplicate the second tap would hit)
const wardDelete=id=>wardOnce('del:'+id,()=>wardDeleteNow(id));
async function wardDeleteNow(id){
  const k=items.findIndex(i=>i.id===id);if(k<0)return;const it=items[k],snap=JSON.parse(JSON.stringify(it));
  const days=Object.values(dayRecs).filter(r=>JSON.stringify(r).includes(id)).map(r=>JSON.parse(JSON.stringify(r)));   // the days that refer to it, as they are now
  const at=await del(id);items=items.filter(i=>i.id!==id);cache={};if(editing===id)dropItem();renderWardrobe();
  toast(`Deleted ${nameIso(itemName(it)||nm(it))}`,WARD_UNDO_MS,{label:'Undo',fn:()=>wardUndelete(snap,k,days,at)})}
async function wardUndelete(it,k,days,at){
  if(items.some(i=>i.id===it.id))return;
  it.updated=nextStamp(at);await putRaw(it);   // newer than the tombstone: the item wins the merge (restamped whole: its field stamps no longer match, core.js fsOk)
  items.splice(Math.min(k,items.length),0,it);
  for(const r of days){const cur=dayRecs[r.date];if(!cur||JSON.stringify(cur)!==JSON.stringify(r))await saveDay(r,true)}   // a day re-planned without it meanwhile
  cache={};if(window.scheduleSync)scheduleSync();
  const v=['today','wardrobe','stats'].find(t=>$('#'+t)&&!$('#'+t).hidden);if(v)show(v);
  toast(`${nameIso(cap1(itemName(it)||nm(it)))} is back`)}
