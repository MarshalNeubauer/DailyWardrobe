/* Daily Wardrobe: the Wardrobe tab's search and sort, an item's own name, brand, material and notes, and Delete with Undo.
   Loaded after app.js and stats.js (classic script, one shared scope); app.js calls in here from renderWardrobe, wardList,
   itemBody, save and rm. */

/* ---- an item's own name ---- */
const WARD_FIELDS=['name','brand','material','notes'];
const WARD_MAX={name:60,brand:40,material:40,notes:500};
/* itemName / itemTitle / titleCls are in core.js: Today is drawn at start-up, which can be before this file has loaded */

/* ---- search ---- */
let wardQ='';        // what is typed in the search field
let wardMemo=null;   // the list on screen, kept until the next redraw (the sheet's swipe asks for it on every touch move)
const wardNorm=t=>String(t??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
/* everything a search looks through: name, brand, notes, material, the type, the colours' names and the pattern */
const wardHay=i=>wardNorm([i.name,i.brand,i.notes,i.material==='other'?'':i.material,TYPES[i.type],i.type,desc(i),colorDesc(i),FABRIC.includes(i.type)?patName(i.pattern||'solid'):''].join(' '));
const wardMatch=(i,q)=>{const h=wardHay(i);return q.split(' ').every(w=>h.includes(w))};   // every word typed must be there

/* ---- sort ---- */
const WARD_SORTS=[['type','By type'],['new','Newest first'],['worn','Most worn'],['rest','Longest since worn'],['colour','Colour'],['az','A to Z']];
const wardSort=()=>{try{const s=localStorage.getItem('ward_sort');return WARD_SORTS.some(x=>x[0]===s)?s:'type'}catch{return 'type'}};
function setWardSort(s){try{localStorage.setItem('ward_sort',s)}catch{}wardRefresh()}
/* colour families for the Colour order, each shown light to dark */
const WARD_FAMS=['neutral','blue','brown','green','red','purple','metal'];
const WARD_FAM={white:'neutral',silver:'neutral',grey:'neutral',charcoal:'neutral',black:'neutral',lightblue:'blue',blue:'blue',navy:'blue',cream:'brown',tan:'brown',brown:'brown',gold:'brown',
  green:'green',olive:'green',pink:'red',red:'red',burgundy:'red',purple:'purple'};
const wardNoCol=i=>(i.type==='watch'&&watchOpts(i).band!=='leather')||i.type==='cufflinks'||i.type==='tieclip';   // shown by their metal, not a colour
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
    `<input type="text" id="wsearch" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Search your wardrobe" placeholder="Search" value="${esc(wardQ)}" oninput="wardSearch(this.value)" onkeydown="if(event.key==='Escape'&&this.value){event.stopPropagation();wardClear()}">`+
    `<button type="button" class="wclear" id="wclear" aria-label="Clear search" onclick="wardClear()"${wardQ?'':' hidden'}>×</button></div>`+
    `<select class="wsort" id="wsort" aria-label="Sort the wardrobe" onchange="setWardSort(this.value)">${WARD_SORTS.map(([k,l])=>`<option value="${k}"${k===s?' selected':''}>${l}</option>`).join('')}</select></div>`}
/* the grid, or what to say when there is nothing to show */
function wardGrid(list){
  if(list.length){const m=wardMemo&&wardMemo.list===list?wardMemo:null,w=m&&m.wear,
      wl=i=>!w?'':`<small class="wwear">${m.sort==='worn'?(w.n[i.id]?`Worn ${w.n[i.id]} time${w.n[i.id]===1?'':'s'}`:'Not worn yet'):w.last[i.id]?`Last worn ${w.last[i.id].toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:'Not worn yet'}</small>`;
    return `<div class="grid">${list.map(i=>`<div class="gi${i.paused?' paused':''}" id="gi-${i.id}"><button class="giopen" onclick="openItem('${i.id}')" aria-label="Open ${esc(TYPES[i.type]||'item')}: ${esc(itemTitle(i))}">${wardPic(i)?`<img class="ph" src="${wardPic(i)}" alt="">`:i.photo?`<img class="ph" src="${phSm(i)}" alt="">`:itemThumb(i)}<span class="gimeta"><small class="gtype">${TYPES[i.type]||'Item'}</small><b class="${titleCls(i)}">${esc(itemTitle(i))}</b>${wl(i)}</span>${i.paused?`<span class="pausetag">${i.order?`On the way${i.arrives?' · '+fmtDay(i.arrives):''}`:i.away&&typeof careTag==='function'?careTag(i):'Out of rotation'}</span>`:typeof careBadge==='function'?careBadge(i):''}</button></div>`).join('')}</div>`}
  const q=wardNorm(wardQ);
  if(!items.length&&typeof setupWardEmpty==='function')return setupWardEmpty();   // setup.js: the empty Wardrobe's card
  if(!q||!items.length)return '<p class="mut">Nothing here yet. Add photos on the Add tab.</p>';
  const all=flt==='all'?0:items.filter(i=>wardMatch(i,q)).length,tl=(TYPES[flt]||'').toLowerCase();
  return `<div class="wnone" id="wnone"><b>Nothing matches “${esc(wardQ.trim())}”${flt==='all'?'':` in ${esc(tl)}`}</b><p class="mut">${all?`${all} item${all===1?' matches':'s match'} in the rest of your wardrobe.`:'Search looks at names, brands, notes, materials, types, colours and patterns.'}</p>`+
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
function matRow(type,cur,call){
  const l=MATERIALS_BY[type];if(!l)return '';const m=String(cur||'').trim(),other=!!m&&!l.includes(m);
  return `<label>Material <select class="wmat" onchange="${call}this.value)">${[['','None'],...l.map(x=>[x,x]),['other','Other']].map(([v,t])=>`<option value="${v}"${v===(other?'other':m)?' selected':''}>${cap1(t)}</option>`).join('')}</select></label>`+
    (other?`<label class="wmat-o">Which material? <input type="text" class="wfld wmat-t" maxlength="${WARD_MAX.material}" value="${esc(m==='other'?'':m)}" placeholder="e.g. alpaca" onchange="${call}this.value.trim()||'other')"></label>`:'')}
const fldRow=(k,lab,v,on,ph)=>`<label>${lab} <input type="text" class="wfld wf-${k}" maxlength="${WARD_MAX[k]}" value="${esc(v||'')}" placeholder="${ph}" autocomplete="off" ${on(k)}></label>`;
const notesRow=(v,on)=>`<label class="wnotes">Notes <textarea class="wf-notes" rows="2" maxlength="${WARD_MAX.notes}" placeholder="Size, where it came from, how it fits…" ${on('notes')}>${esc(v||'').replace(/>/g,'&gt;')}</textarea></label>`;
/* the item sheet's Details card: name and brand at its top, material and notes at its end. A text field saves when it is left,
   and a moment after the last keystroke too (a sheet swiped away never tells a field it was left) */
let wardTypeT=null;
function itemFieldSoon(id,k,v){clearTimeout(wardTypeT);wardTypeT=setTimeout(()=>setItemField(id,k,v),600)}
const ivOn=id=>k=>`oninput="itemFieldSoon('${id}','${k}',this.value)" onchange="clearTimeout(wardTypeT);setItemField('${id}','${k}',this.value)"`;
function wardFieldsTop(i){return fldRow('name','Name',i.name,ivOn(i.id),'Optional')+fldRow('brand','Brand',i.brand,ivOn(i.id),'Optional')}
function wardFieldsEnd(i){return matRow(i.type,i.material,`setItemField('${i.id}','material',`)+notesRow(i.notes,ivOn(i.id))}
/* saving one of them. Text fields don't redraw the sheet (the next field tapped would lose its focus): only the title and the grid follow */
async function setItemField(id,k,v){
  const it=items.find(x=>x.id===id);if(!it||!WARD_FIELDS.includes(k))return;v=String(v??'').trim().slice(0,WARD_MAX[k]);if((it[k]||'')===v)return;
  if(v)it[k]=v;else delete it[k];await put(it);
  if(k==='material')return renderWardrobe();   // Other shows or hides its field
  wardRefresh();const h=$('#iv-title');if(h&&editing===id){h.textContent=itemTitle(it)||TYPES[it.type]||'Item';h.className=titleCls(it)}}
/* the Add card: name, brand and notes behind "More details", folded until asked for (the Material is out with the other fields, above it); each keystroke is kept on the card (nothing is redrawn) */
function toggleMore(i){const q=queue[i];if(!q)return;q.more=!q.more;renderAdd()}
function setQField(i,k,v){const q=queue[i];if(!q||!WARD_FIELDS.includes(k))return;v=String(v??'').slice(0,WARD_MAX[k]);if(v.trim())q[k]=v;else delete q[k];if(k==='material')renderAdd()}
function moreRow(q,i){
  const n=WARD_FIELDS.filter(k=>k!=='material'&&q[k]&&String(q[k]).trim()).length,on=k=>`oninput="setQField(${i},'${k}',this.value)"`;
  return `<div class="morefold${q.more?' open':''}"><button type="button" class="morebtn" aria-expanded="${!!q.more}" onclick="toggleMore(${i})"><span>More details${n?` <small class="mut">· ${n} filled in</small>`:''}</span><svg class="morechev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`+
    (q.more?`<div class="morein">${fldRow('name','Name',q.name,on,'Optional')}${fldRow('brand','Brand',q.brand,on,'Optional')}${notesRow(q.notes,on)}</div>`:'')+`</div>`}
/* copies them from the Add card onto the item being saved */
function wardSaveFields(q,it){for(const k of WARD_FIELDS){const v=String(q[k]??'').trim().slice(0,WARD_MAX[k]);if(v&&(k!=='material'||MATERIALS_BY[it.type]))it[k]=v}}

/* ---- Delete, with Undo ----
   Delete removes the item at once (a tombstone, so it goes from every device) and offers Undo for WARD_UNDO_MS. Undo writes the
   item back as it was under a stamp newer than its tombstone: in a merge the newest of the two wins (mergeState in core.js), so
   it comes back on every device, including one that had already taken the deletion. */
const WARD_UNDO_MS=8000;
async function wardDelete(id){
  const k=items.findIndex(i=>i.id===id);if(k<0)return;const it=items[k],snap=JSON.parse(JSON.stringify(it));
  const days=Object.values(dayRecs).filter(r=>JSON.stringify(r).includes(id)).map(r=>JSON.parse(JSON.stringify(r)));   // the days that refer to it, as they are now
  await del(id);const at=Date.now();items=items.filter(i=>i.id!==id);cache={};if(editing===id)dropItem();renderWardrobe();
  toast(`Deleted ${itemName(it)||nm(it)}`,WARD_UNDO_MS,{label:'Undo',fn:()=>wardUndelete(snap,k,days,at)})}
async function wardUndelete(it,k,days,at){
  if(items.some(i=>i.id===it.id))return;
  it.updated=Math.max(Date.now(),at+1);await putRaw(it);   // newer than the tombstone: the item wins the merge
  items.splice(Math.min(k,items.length),0,it);
  for(const r of days){const cur=dayRecs[r.date];if(!cur||JSON.stringify(cur)!==JSON.stringify(r))await saveDay(r,true)}   // a day re-planned without it meanwhile
  cache={};if(window.scheduleSync)scheduleSync();
  const v=['today','wardrobe','stats'].find(t=>$('#'+t)&&!$('#'+t).hidden);if(v)show(v);
  toast(`${cap1(itemName(it)||nm(it))} is back`)}
