/* Daily Wardrobe: storage, forms, screens and gestures */
let flt='all',queue=[];const now=new Date();let view={y:now.getFullYear(),m:now.getMonth()},sel=new Date(now.getFullYear(),now.getMonth(),now.getDate());

/* storage */
// stores: items (wardrobe), days (outfit history, keyed by date), meta (key/value: deletion tombstones, settings, sync state)
const db=new Promise((ok,no)=>{const r=indexedDB.open('wardrobe',2);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('items'))d.createObjectStore('items',{keyPath:'id'});
    if(!d.objectStoreNames.contains('days'))d.createObjectStore('days',{keyPath:'date'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'})};
  r.onsuccess=()=>ok(r.result);r.onerror=no});
const txs=async(store,m,f)=>{const d=await db;return new Promise((ok,no)=>{const t=d.transaction(store,m);const q=f(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result);t.onerror=no})};
const tx=(m,f)=>txs('items',m,f);
const metaGet=async k=>{const r=await txs('meta','readonly',s=>s.get(k));return r?r.v:undefined},metaPut=(k,v)=>txs('meta','readwrite',s=>s.put({k,v}));
// every local edit is timestamped and triggers a (debounced) backup; deletions leave a tombstone so they sync too
const putRaw=i=>tx('readwrite',s=>s.put(i));
const put=i=>{i.updated=Date.now();const r=putRaw(i);r.then(()=>window.scheduleSync&&scheduleSync());return r};
const del=async id=>{await tx('readwrite',s=>s.delete(id));const t=await metaGet('tombstones')||{};t[id]=Date.now();await metaPut('tombstones',t);window.scheduleSync&&scheduleSync()};

/* settings management */
function openSettings(){
  if($('#cfg-url')) $('#cfg-url').value=localStorage.getItem('worker_url')||'';
  if($('#cfg-token')) $('#cfg-token').value=localStorage.getItem('app_token')||'';
  if(window.showSyncStatus)showSyncStatus();
  renderSettingsExtras();
  if($('#settings-modal')){ $('#settings-modal').style.display='block'; $('#settings-modal').style.pointerEvents='auto'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='block'; $('#modal-backdrop').style.pointerEvents='auto'; }
}
function closeSettings(){
  if($('#settings-modal')){ $('#settings-modal').style.display='none'; $('#settings-modal').style.pointerEvents='none'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='none'; $('#modal-backdrop').style.pointerEvents='none'; }
}
function saveSettings(){
  if($('#cfg-url')) localStorage.setItem('worker_url',$('#cfg-url').value.trim());
  if($('#cfg-token')) localStorage.setItem('app_token',$('#cfg-token').value.trim());
  closeSettings();
  renderAdd();
  if(window.syncNow)syncNow();
}

/* precision swatch generator */
function generateSwatch(q){
  if(!q.big) return '';
  const canvas=q.big;
  const zoom=Number(q.zoom)||1;
  const cx=Number(q.cx)||0.5;
  const cy=Number(q.cy)||0.5;
  const sampleSize=Math.min(canvas.width,canvas.height)*(0.5/zoom);
  const o=document.createElement('canvas');
  o.width=o.height=128;
  const sx=Math.max(0,Math.min(canvas.width-sampleSize,cx*canvas.width-sampleSize/2));
  const sy=Math.max(0,Math.min(canvas.height-sampleSize,cy*canvas.height-sampleSize/2));
  o.getContext('2d').drawImage(canvas, sx, sy, sampleSize, sampleSize, 0, 0, 128, 128);
  q.swatch=o.toDataURL('image/png');
  return q.swatch;
}

function updateSwatchParam(i, param, val){
  queue[i][param]=Number(val);
  generateSwatch(queue[i]);
  const swEl=$(`#swatch-img-${i}`);
  if(swEl) swEl.style.backgroundImage=`url(${queue[i].swatch})`;
}

async function ask(c){
  try {
    const workerUrl=localStorage.getItem('worker_url');
    if(!workerUrl) return null;
    const dataUrl=c.toDataURL('image/jpeg',.8);
    const res=await fetch(workerUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image:dataUrl,appToken:localStorage.getItem('app_token')||''})
    });
    if(!res.ok) return null;
    const result=await res.json();
    let parsed;
    try {
      const cleanText=(result.response||'').replace(/```json/g,'').replace(/```/g, '').trim();
      parsed=JSON.parse(cleanText);
    } catch(e) {
      parsed=result;
    }
    return {
      type:TYPES[parsed.type]?parsed.type:'suit',
      pattern:normPat(TYPES[parsed.type]?parsed.type:'suit',parsed.pattern),
      primaryColor:normCol(parsed.primaryColor||parsed.color)||'grey',
      secondaryColor:normCol(parsed.secondaryColor),
      tertiaryColor:normCol(parsed.tertiaryColor),
      metal:METAL[parsed.metal]?parsed.metal:'silver',
      leather:LEATHERS.includes(String(parsed.leather||'').toLowerCase().replace(/\s+/g,'-'))?String(parsed.leather).toLowerCase().replace(/\s+/g,'-'):null,
      dial:normCol(parsed.dial),band:['bracelet','leather'].includes(parsed.band)?parsed.band:null,bezel:['fluted','smooth'].includes(parsed.bezel)?parsed.bezel:null
    };
  } catch(e) {
    return null;
  }
}

const loadImg=f=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(f)});
function shrink(img,max){const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c}

async function fill(q,ai){
  q.zoom=1; q.cx=0.5; q.cy=0.5;
  generateSwatch(q);
  q.ai=!!(ai&&ai.type);
  q.type=q.ai?ai.type:'suit';
  q.primaryColor=ai&&COLORS[ai.primaryColor]?ai.primaryColor:'grey';
  q.secondaryColor=ai&&ai.secondaryColor&&ai.secondaryColor!=='none'?ai.secondaryColor:null;
  q.tertiaryColor=ai&&ai.tertiaryColor&&ai.tertiaryColor!=='none'?ai.tertiaryColor:null;
  q.pattern=ai?normPat(q.type,ai.pattern):'solid';
  q.metal=ai&&METAL[ai.metal]?ai.metal:'silver';
  q.leather=ai&&ai.leather||'calf';
  const wo=watchOpts(ai||{});q.dial=wo.dial;q.band=wo.band;q.bezel=wo.bezel;q.watchStyle=wo.style;
}

async function addFiles(files){
  for(const f of files){
    const q={id:crypto.randomUUID(),busy:1};
    queue.push(q);
    renderAdd();
    try{
      const img=await loadImg(f);
      q.big=shrink(img,800);
      q.photo=shrink(img,360).toDataURL('image/jpeg',.8);
      const aiResult=await ask(q.big);
      fill(q,aiResult);
    }catch(e){q.err=1}
    q.busy=0;
    renderAdd();
  }
}

const setq=(i,k,v)=>{const q=queue[i];q[k]=v==='none'?null:v;if(k==='type')q.pattern=normPat(v,q.pattern);if(k==='type'||q.manual)renderAdd()};
/* an item described with the dropdowns only; the wardrobe shows a drawn thumbnail instead of a photo */
function addManual(){
  const wo=watchOpts({});
  queue.unshift({id:crypto.randomUUID(),manual:true,type:'suit',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf',dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style});
  renderAdd();
}
async function save(i){
  const q=queue[i],f=FABRIC.includes(q.type);
  generateSwatch(q);
  const it={id:q.id,type:q.type,primaryColor:q.primaryColor,secondaryColor:q.secondaryColor,tertiaryColor:q.tertiaryColor,pattern:f?q.pattern:'solid',photo:q.photo,added:Date.now()};
  if(f)it.swatch=q.swatch;
  if(METAL_TYPES.includes(q.type))it.metal=q.metal||'silver';
  if(q.type==='shirt')it.cuff=q.cuff||'button';
  if(SEASON_TYPES.includes(q.type)&&q.season&&q.season!=='all')it.season=q.season;
  if(q.type==='shoes'||q.type==='belt')it.leather=q.leather||'calf';
  if(q.type==='watch'){const wo=watchOpts(q);Object.assign(it,{dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style})}
  if(!it.photo)delete it.photo;
  try{const st=detectQueued(q,it);if(st)it.stripes=st}catch(e){console.warn('pattern detection failed',e)}
  await put(it);items.push(it);queue.splice(i,1);renderAdd();
}
let editing=null;
const E=(id,k,list,v)=>`<label>${k==='primaryColor'?'Primary':k==='secondaryColor'?'Secondary':k==='tertiaryColor'?'Third colour':k==='watchStyle'?'Style':k[0].toUpperCase()+k.slice(1)} <select onchange="sete('${id}','${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${x[1]}</option>`).join('')}</select></label>`;
function editForm(i){
  const cols=Object.keys(COLORS).map(c=>[c,c]),opt=[['none','None'],...cols];
  return `<div class="card" style="margin:8px 0 0;padding:8px">${E(i.id,'type',Object.entries(TYPES),i.type)}${E(i.id,'primaryColor',cols,primaryCol(i))}${E(i.id,'secondaryColor',opt,i.secondaryColor||'none')}${E(i.id,'tertiaryColor',opt,i.tertiaryColor||'none')}
  ${FABRIC.includes(i.type)?E(i.id,'pattern',(PATS_BY[i.type]||['solid']).map(c=>[c,patLabel(c)]),normPat(i.type,i.pattern)):''}${METAL_TYPES.includes(i.type)?E(i.id,'metal',Object.keys(METAL).map(c=>[c,c]),i.metal||'silver'):''}
  ${i.type==='shirt'?E(i.id,'cuff',CUFFS,i.cuff||'button'):''}${SEASON_TYPES.includes(i.type)?E(i.id,'season',SEASONS,i.season||'all'):''}
  ${i.type==='shoes'||i.type==='belt'?E(i.id,'leather',LEATHERS.map(c=>[c,patLabel(c)]),i.leather||'calf'):''}
  ${i.type==='watch'?E(i.id,'dial',cols,watchOpts(i).dial)+E(i.id,'band',BANDS,watchOpts(i).band)+E(i.id,'bezel',BEZELS,watchOpts(i).bezel)+E(i.id,'watchStyle',WATCH_STYLES,watchOpts(i).style):''}
  ${DETECT_PATS.includes(i.pattern)?`<p class="mut" style="margin:6px 0;font-size:14px">Pattern layout: ${patSummary(i)}</p><div class="btns"><button onclick="redetect('${i.id}')">Read pattern from photo</button>${i.stripes?`<button onclick="clearStripes('${i.id}')">Use generic</button>`:''}</div>`:''}
  <div class="btns"><button class="pri" onclick="editing=null;renderWardrobe()">Done</button></div></div>`;
}
async function sete(id,k,v){
  const it=items.find(x=>x.id===id);if(!it)return;
  it[k]=v==='none'?null:v;
  if(k==='type'){it.pattern=normPat(v,it.pattern);if((v==='watch'||v==='tieclip')&&!it.metal)it.metal='silver';if((v==='shoes'||v==='belt')&&!it.leather)it.leather='calf';if(v==='belt'&&!it.metal)it.metal='silver'}
  if(k==='primaryColor')delete it.color;
  await put(it);cache={};renderWardrobe();
}
function patSummary(i){
  const st=i.stripes;if(!st)return 'generic';
  if(st.kind==='check')return `check read from photo (${st.b.length}×${st.v.length} bands)`;
  return `stripes read from photo (${st.b.length} bands, ${Math.abs(st.a)}°)`;
}
async function redetect(id){
  const it=items.find(x=>x.id===id);if(!it)return;
  const load=src=>new Promise(r=>{if(!src)return r(null);const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src});
  let st=null;
  const sw=await load(it.swatch);if(sw)st=detectPattern(it,sw,0,0,sw.width);
  if(!st){const ph=await load(it.photo);if(ph){const mn=Math.min(ph.width,ph.height)*.7;st=detectPattern(it,ph,(ph.width-mn)/2,(ph.height-mn)/2,mn)}}
  if(!st){alert('Could not find a clear repeating pattern in the photo. Re-adding it with the swatch centred on the fabric usually works.');return}
  it.stripes=st;await put(it);cache={};renderWardrobe();
}
async function clearStripes(id){const it=items.find(x=>x.id===id);if(!it)return;delete it.stripes;await put(it);cache={};renderWardrobe()}
async function rm(id){if(!confirm('Delete this item?'))return;await del(id);items=items.filter(i=>i.id!==id);renderWardrobe()}

let cache={}; const planFor=()=>cache[view.y+'-'+view.m]||(cache[view.y+'-'+view.m]=buildPlan(view.y,view.m));

/* views */
const slots=o=>[[o.suitDay?'Suit':'Blazer',o.top,'top'],...(o.suitDay?[]:[['Pants',o.bot,'bot']]),['Shirt',o.shirt,'shirt'],['Tie',o.tie,'tie'],['Tie clip',o.clip,'clip'],...(o.links||(o.shirt&&o.shirt.cuff==='french')?[['Cufflinks',o.links,'links']]:[]),['Watch',o.watch,'watch'],['Belt',o.belt,'belt'],['Socks',o.socks,'socks'],['Shoes',o.shoes,'shoes'],...(o.coat||(o.clim&&(o.clim.cold||o.clim.rain))?[[o.coat?TYPES[o.coat.type]:'Coat',o.coat,'coat']]:[])]
.map(([l,i,s])=>`<div class="row"><span class="mut">${l}</span>${i?`<span class="dot" style='background:${bg(i)}'></span><span class="cap">${desc(i)}</span>${o.frozen?'':`<button class="swap" onclick="swapSlot('${s}')" aria-label="Swap ${l.toLowerCase()}" title="Swap">↻</button>`}`:'<span class="mut none">Add one on the Add tab</span>'}</div>`).join('');

/* ---- outfit history: freeze past days, swap pieces, record what was worn ---- */
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
let swapMsg='';
async function saveDay(rec,quiet){rec.updated=Date.now();dayRecs[rec.date]=rec;await txs('days','readwrite',s=>s.put(rec));cache={};if(!quiet&&window.scheduleSync)scheduleSync()}
/* remember what each day showed: past days become fixed, and today's record follows the screen until the day ends */
async function recordDays(p){
  const T=todayDate(),tk=key(T);let changed=false;
  for(const [k,o] of Object.entries(p)){
    if(!SLOTS.some(s=>o[s])||o.frozen)continue;const d=keyDate(k);
    if(d<T&&!dayRecs[k]){await saveDay({date:k,ids:idsOf(o),suitDay:o.suitDay,auto:true},true);changed=true}
    else if(k===tk){const r=dayRecs[k],ids=idsOf(o);if(!r||JSON.stringify(r.ids)!==JSON.stringify(ids)){await saveDay({...(r||{date:k}),ids,suitDay:o.suitDay},true);changed=true}}
  }
  if(changed&&window.scheduleSync)scheduleSync();
}
async function swapSlot(slot){
  const k=key(sel),o=planFor()[k];if(!o||o.frozen)return;
  const cur=o[slot]&&o[slot].id,pool=items.filter(i=>slot==='coat'?i.type==='overcoat'||i.type==='raincoat':i.type===SLOT_TYPE(slot,o.suitDay));
  if(pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to swap.`;renderToday();return}
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay};
  const skip={...(rec.skip||{})};skip[slot]=[...new Set([...(skip[slot]||[]),cur].filter(Boolean))];
  if(pool.every(i=>skip[slot].includes(i.id)))skip[slot]=[cur];       // tried them all: start the cycle again
  // keep the rest of the outfit; pieces that must follow the swapped one are re-picked
  const follow={top:['bot','shirt','tie','shoes','belt','socks','watch','clip'],shoes:['belt','socks']}[slot]||[];
  const force={};for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  rec.skip=skip;rec.force=force;swapMsg='';await saveDay(rec);renderToday();
}
async function setFormal(v){const k=key(sel),r={...(dayRecs[k]||{date:k})};delete r.force;delete r.skip;if(v)r.formal=true;else delete r.formal;swapMsg='';await saveDay(r);renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.force;delete n.skip;delete n.worn;swapMsg='';await saveDay(n);renderToday()}
async function setWorn(v){const k=key(sel),o=planFor()[k];if(!o)return;const r=dayRecs[k]||{date:k};await saveDay({...r,ids:r.ids&&o.frozen?r.ids:idsOf(o),suitDay:o.suitDay,worn:v});renderToday()}
function dayActions(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),past=d<T,isToday=+d===+T;
  let h='';
  if(past||isToday){
    if(o.worn===true)h+=`<span class="chip on">✓ Worn</span><button onclick="setWorn(undefined)">Undo</button>`;
    else if(o.worn===false)h+=`<span class="chip">Not worn</span><button onclick="setWorn(undefined)">Undo</button>`;
    else h+=`<button class="pri" onclick="setWorn(true)">✓ Wore this</button><button onclick="setWorn(false)">Didn't wear</button>`;
  }
  if(!o.frozen)h+=o.formal?`<span class="chip on formal">Formal day</span><button onclick="setFormal(false)">Make regular</button>`:`<button onclick="setFormal(true)">Make formal</button>`;
  if(!o.frozen&&o.overrides)h+=`<button onclick="resetDay()">Reset changes</button>`;
  return (h?`<div class="btns dayact">${h}</div>`:'')+(past&&o.frozen&&o.worn!==true?'<p class="mut"><small>Past day: kept as it was planned.</small></p>':'')+(swapMsg?`<p class="mut"><small>${swapMsg}</small></p>`:'');
}

/* outfit score card with an expandable breakdown */
function scoreCard(o){
  const r=rateOutfit(o),tone=r.score>=80?'good':r.score>=65?'ok':'low';
  return `<details class="score ${tone}"><summary><span class="num">${r.score}</span><span class="lbl"><b>${r.label}</b><small>Outfit score · tap for why</small></span></summary><ul>${r.checks.map(c=>`<li class="${c.pts===c.max?'ok':'miss'}"><span>${c.pts===c.max?'✓':'•'} ${c.label}</span><span class="pts">${c.pts}/${c.max}</span>${c.why?`<small>${c.why}</small>`:''}</li>`).join('')}</ul></details>`;
}
function planHtml(p){
  const f=new Date(view.y,view.m,1),days=[];
  for(const d=new Date(f);d.getMonth()===view.m;d.setDate(d.getDate()+1))if(isWorkday(d))days.push(new Date(d));
  return `<div class="nav"><button onclick="mv(-1)" aria-label="Previous month">‹</button><h2>${f.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button onclick="mv(1)" aria-label="Next month">›</button></div>`+
  days.map(d=>{
    const o=p[key(d)]||{suitDay:true,top:null,bot:null,shirt:null,tie:null};
    const sc=o.shirt||o.top?rateOutfit(o).score:null;
    return `<div class="pl ${key(d)===key(sel)?'on':''}" onclick="pick(${d.getTime()})">${sc===null?'':`<span class="sc ${sc>=80?'good':sc>=65?'ok':'low'}">${sc}</span>`}<b>${d.toLocaleDateString(undefined,{weekday:'short',day:'numeric'})}</b><span class="cap">${o.suitDay?nm(o.top):nm(o.top)+' + '+nm(o.bot)}, ${o.shirt?primaryCol(o.shirt)+' shirt':'no shirt'}, ${o.tie?desc(o.tie)+' tie':'no tie'}</span></div>`;
  }).join('');
}

function renderToday(){
  closeSettings();
  const p=planFor();
  const o=p[key(sel)]||{suitDay:true,top:null,bot:null,shirt:null,tie:null,shoes:null,belt:null,socks:null,watch:null,clip:null};
  const nav=`<div class="nav day"><button onclick="stepDay(-1)" aria-label="Previous day">‹</button><h2>${sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}${settings.location?`<small class="wx">${wxChip(sel)||'&nbsp;'}</small>`:''}</h2><button onclick="stepDay(1)" aria-label="Next day">›</button></div>`;
  // only the stage (the mannequin) slides on a swipe; the date bar and the item list stay put and just update
  let stage='',side='';
  if(!isWorkday(sel))stage=`<p class="mut empty">${DAY_NAMES[sel.getDay()]} isn't a workday. You can change your workdays in Settings.</p>`;
  else if(!items.length)stage='<p class="mut empty">Your wardrobe is empty. Add photos on the Add tab to get an outfit.</p>';
  else{stage='<div class="man" id="mannequin-container"></div>';
    // the rest warning goes below the list so the list never shifts when it appears or disappears
    side=`${scoreCard(o)}<div class="list">${slots(o)}</div>${dayActions(o)}${(o.notes||[]).map(t=>`<p class="warn">${t}</p>`).join('')}${o.top&&o.top.rest<COOL?`<p class="warn">This ${o.suitDay?'suit':'blazer'} was worn ${o.top.rest} day${o.top.rest===1?'':'s'} ago. Add more ${o.suitDay?'suits':'blazers'} to get a ${COOL}-day rest.</p>`:''}`}
  $('#today').innerHTML=nav+`<div class="daygrid"><div class="stage" id="stage"><div class="slide" id="slide">${stage}</div></div><div class="side">${side}${planHtml(p)}</div></div>`;
  if(o && items.length && isWorkday(sel)) {
    renderMannequinCanvas(o, $('#mannequin-container'));
  }
  if(items.length){recordDays(p);
  }
}

function mv(n){view.m+=n;if(view.m>11){view.m=0;view.y++}if(view.m<0){view.m=11;view.y--}const d=new Date(view.y,view.m,1);for(let g=0;g<7&&!isWorkday(d);g++)d.setDate(d.getDate()+1);sel=d;renderToday()}
function pick(t){sel=new Date(t);renderToday();scrollTo(0,0)}
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed */
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed.
   from: where the new day's outfit slides in from (px, sign = side); 0 = no animation */
function stepDay(n,from){
  const d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate());
  let g=0;do d.setDate(d.getDate()+n);while(!isWorkday(d)&&++g<7);
  sel=d;view={y:d.getFullYear(),m:d.getMonth()};renderToday();
  const sl=$('#slide');if(!sl)return;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x)return;
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';
  void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';
}
(()=>{const el=$('#today');let st=null;
  const slide=()=>$('#slide');
  el.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    // ignore multi-touch and touches that start at the screen edge (iOS back/forward gesture)
    // the gesture can start anywhere on Today (e.g. a Saturday shows only a one-line message); only the outfit moves
    st=e.touches.length>1||t.clientX<24||t.clientX>innerWidth-24?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0};
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;
    e.preventDefault(); // horizontal drag is ours: no page pan, no zoom bounce
    st.dx=dx;const sl=slide();if(sl){sl.style.transition='none';sl.style.transform=`translateX(${dx}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5;
    if(Math.abs(dx)>70||(fast&&Math.abs(dx)>30)){
      const n=dx<0?1:-1,w=sl.offsetWidth||innerWidth;
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepDay(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}
  };
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(el.hidden||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepDay(1);if(e.key==='ArrowLeft')stepDay(-1)});
})();

function renderWardrobe(){
  closeSettings();
  const cnt=t=>t==='all'?items.length:items.filter(i=>i.type===t).length;
  const chips=['all',...Object.keys(TYPES)].map(t=>`<button class="chip ${flt===t?'on':''}" onclick="flt='${t}';renderWardrobe()">${t==='all'?'All':TYPES[t]} ${cnt(t)}</button>`).join('');
  const list=items.filter(i=>flt==='all'||i.type===flt).sort((a,b)=>a.type.localeCompare(b.type)||b.added-a.added);
  $('#wardrobe').innerHTML=`<h2>Wardrobe</h2><div class="chips">${chips}</div>`+(list.length?`<div class="grid">${list.map(i=>`<div class="gi"${editing===i.id?' style="grid-column:1/-1"':''}>${i.photo?`<img class="ph" src="${i.photo}" alt="">`:itemThumb(i)}<b>${TYPES[i.type]||'Item'}</b><br><small class="cap">${desc(i)}</small><div class="btns"><button onclick="editing=editing==='${i.id}'?null:'${i.id}';renderWardrobe()">${editing===i.id?'Close':'Edit'}</button><button onclick="rm('${i.id}')">Delete</button></div>${editing===i.id?editForm(i):''}</div>`).join('')}</div>`:'<p class="mut">Nothing here yet. Add photos on the Add tab.</p>');
}

const S=(list,v,k,i)=>`<select onchange="setq(${i},'${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${x[1]}</option>`).join('')}</select>`;

function renderAdd(){
  closeSettings();
  const workerSet = !!localStorage.getItem('worker_url');
  if($('#note')) $('#note').textContent = workerSet ? 'Photos are analyzed securely via your Cloudflare Worker AI.' : 'Worker URL not set! Tap ⚙ in the top right to configure your Cloudflare Worker.';
  if($('#queue')) $('#queue').innerHTML=queue.map((q,i)=>q.busy?'<div class="card">Analyzing photo with Cloudflare AI…</div>':q.err?`<div class="card">That image couldn’t be read. <button onclick="queue.splice(${i},1);renderAdd()">Dismiss</button></div>`:
`<div class="card">
<div class="rv">${q.photo?`<img class="ph" src="${q.photo}" alt="">`:itemThumb(q)}</div>
${FABRIC.includes(q.type)&&q.big?`
<div class="sw-box">
  <div id="swatch-img-${i}" class="sw" style="background-image:url(${q.swatch})"></div>
  <div style="flex:1;font-size:13px">
    <b>Precision Swatch Inspector</b>
    <label>Zoom: <input type="range" min="1" max="4" step="0.1" value="${q.zoom||1}" oninput="updateSwatchParam(${i}, 'zoom', this.value)"></label>
    <label>X-Pos: <input type="range" min="0" max="1" step="0.05" value="${q.cx||0.5}" oninput="updateSwatchParam(${i}, 'cx', this.value)"></label>
    <label>Y-Pos: <input type="range" min="0" max="1" step="0.05" value="${q.cy||0.5}" oninput="updateSwatchParam(${i}, 'cy', this.value)"></label>
  </div>
</div>`:''}
<label>Item ${S(Object.entries(TYPES),q.type,'type',i)}</label>
<label>Primary Colour ${S(Object.keys(COLORS).map(c=>[c,c]),q.primaryColor,'primaryColor',i)}</label>
<label>Secondary Colour ${S([['none','None'], ...Object.keys(COLORS).map(c=>[c,c])],q.secondaryColor||'none','secondaryColor',i)}</label>
<label>Tertiary Colour ${S([['none','None'], ...Object.keys(COLORS).map(c=>[c,c])],q.tertiaryColor||'none','tertiaryColor',i)}</label>
${FABRIC.includes(q.type)?`<label>Pattern ${S((PATS_BY[q.type]||['solid']).map(c=>[c,patLabel(c)]),q.pattern,'pattern',i)}</label>`:''}${METAL_TYPES.includes(q.type)?`<label>${q.type==='belt'?'Buckle':'Metal'} ${S(Object.keys(METAL).map(c=>[c,c]),q.metal,'metal',i)}</label>`:''}
${q.type==='shirt'?`<label>Cuffs ${S(CUFFS,q.cuff||'button','cuff',i)}</label>`:''}${SEASON_TYPES.includes(q.type)?`<label>Season ${S(SEASONS,q.season||'all','season',i)}</label>`:''}
${q.type==='shoes'||q.type==='belt'?`<label>Leather ${S(LEATHERS.map(c=>[c,patLabel(c)]),q.leather||'calf','leather',i)}</label>`:''}
${q.type==='watch'?`<label>Dial ${S(Object.keys(COLORS).map(c=>[c,c]),watchOpts(q).dial,'dial',i)}</label><label>Band ${S(BANDS,watchOpts(q).band,'band',i)}</label><label>Bezel ${S(BEZELS,watchOpts(q).bezel,'bezel',i)}</label><label>Style ${S(WATCH_STYLES,watchOpts(q).style,'watchStyle',i)}</label>`:''}
<div class="btns"><button class="pri" onclick="save(${i})">Confirm</button><button onclick="queue.splice(${i},1);renderAdd()">${q.manual?'Cancel':'Skip'}</button></div>${q.manual?'':'<small>Cloudflare AI.</small>'}</div>`).join('');
}

function show(t){
  closeSettings();
  for(const s of['today','wardrobe','add']){const el=$('#'+s);if(el)el.hidden=s!==t;const btn=$('#n-'+s);if(btn)btn.classList.toggle('on',s===t)}
  const f={today:renderToday,wardrobe:renderWardrobe,add:renderAdd};if(f[t])f[t]();
}

db.then(()=>Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings')])).then(([r,d,st])=>{items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};show('today');window.appReady=true;loadWeather()}).catch(e=>{console.warn(e);items=[];show('today');window.appReady=true});

/* service worker: fresh files on every load, offline fallback (only over http/https) */
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(e=>console.warn('service worker not registered',e));
/* sync brought new data: refresh the in-memory outfit history too */
function onSyncedData(m){dayRecs=Object.fromEntries((m.days||[]).map(d=>[d.date,d]));if(m.settings)settings={...settings,...m.settings};loadWeather()}

/* ---- settings: schedule, weather location, units ---- */
const unit=()=>settings.units||(/^en-(US|LR|MM)/.test(navigator.language||'')?'F':'C');
const temp=c=>Math.round(unit()==='F'?c*9/5+32:c);
const wxIcon=c=>c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌦️':c<=86?'🌨️':'⛈️';
function wxChip(d){const w=weather[key(d)];if(!w)return '';return `${wxIcon(w.code)} ${temp(w.tmax)}°/${temp(w.tmin)}°${(w.pop||0)>=30?` · ☂ ${w.pop}%`:''}`}
async function saveUserSettings(){settings.updated=Date.now();await metaPut('settings',settings);cache={};if(window.scheduleSync)scheduleSync()}
function renderSettingsExtras(){
  const tog=(id,list)=>{const el=$(id);if(el)el.innerHTML=DAY_NAMES.map((n,i)=>`<button type="button" class="dtog ${list.includes(i)?'on':''}" onclick="toggleDay('${id}',${i})" aria-pressed="${list.includes(i)}">${n.slice(0,3)}</button>`).join('')};
  tog('#cfg-workdays',settings.workdays);tog('#cfg-blazer',settings.blazerDays.filter(d=>settings.workdays.includes(d)));
  if($('#wx-loc'))$('#wx-loc').textContent=settings.location?`Weather for ${settings.location.name}`:'No location set: outfits follow the calendar season.';
  if($('#cfg-units'))$('#cfg-units').value=unit();
}
function toggleDay(id,i){const k=id==='#cfg-workdays'?'workdays':'blazerDays',l=new Set(settings[k]);l.has(i)?l.delete(i):l.add(i);
  if(k==='workdays'&&l.size===0)return;settings[k]=[...l].sort();if(k==='workdays')settings.blazerDays=settings.blazerDays.filter(d=>l.has(d));
  renderSettingsExtras();saveUserSettings()}
function setUnits(v){settings.units=v;saveUserSettings()}
function setLocation(loc){settings.location=loc;localStorage.removeItem('wx');weather={};saveUserSettings().then(()=>loadWeather(true));renderSettingsExtras();if($('#city-results'))$('#city-results').innerHTML=''}
function useMyLocation(){if(!navigator.geolocation){alert('Location is not available on this device.');return}
  navigator.geolocation.getCurrentPosition(p=>setLocation({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3),name:'your current location'}),()=>alert('Location permission was denied. Search for your city instead.'))}
async function findCity(){const q=($('#cfg-city')&&$('#cfg-city').value||'').trim();if(!q)return;
  try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name='+encodeURIComponent(q));const j=await r.json();
    const res=(j.results||[]).map(c=>({lat:c.latitude,lon:c.longitude,name:[c.name,c.admin1,c.country_code].filter(Boolean).join(', ')}));
    window._cities=res;$('#city-results').innerHTML=res.length?res.map((c,i)=>`<button type="button" onclick="setLocation(_cities[${i}])">${c.name}</button>`).join(''):'<small class="mut">No matches.</small>'}
  catch(e){$('#city-results').innerHTML='<small class="mut">City search is unavailable right now.</small>'}}
/* 16-day forecast from Open-Meteo (free, no key); cached for 3 hours */
async function loadWeather(force){
  const L=settings.location;if(!L)return;
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');
    if(!force&&c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3){weather=c.days;cache={};if(!$('#today').hidden)renderToday();return}}catch{}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&timezone=auto&forecast_days=16`);
    const d=(await r.json()).daily;if(!d||!d.time)return;const days={};
    d.time.forEach((t,i)=>{const [y,m,dd]=t.split('-').map(Number);days[key(new Date(y,m-1,dd))]={tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],pop:d.precipitation_probability_max[i]??0,rain:d.precipitation_sum[i]??0,code:d.weather_code[i]??0}});
    weather=days;localStorage.setItem('wx',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),days}));cache={};if(!$('#today').hidden)renderToday()}
  catch(e){console.warn('weather unavailable',e)}
}
