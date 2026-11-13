/* Daily Wardrobe: storage, forms, screens and gestures */
let flt='all',queue=[];const now=new Date();let view={y:now.getFullYear(),m:now.getMonth()},sel=new Date(now.getFullYear(),now.getMonth(),now.getDate());

/* storage */
// stores: items (wardrobe), days (outfit history, keyed by date), meta (key/value: deletion tombstones, settings, sync state)
const db=new Promise((ok,no)=>{const r=indexedDB.open('wardrobe',2);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('items'))d.createObjectStore('items',{keyPath:'id'});
    if(!d.objectStoreNames.contains('days'))d.createObjectStore('days',{keyPath:'date'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'})};
  r.onsuccess=()=>ok(r.result);r.onerror=no});
/* a transaction that fails or is aborted (storage full) rejects with the browser's error, marked as a storage failure (safety.js shows it) */
const txFail=(t,no,m)=>ev=>{let e=t.error||(ev&&ev.target&&ev.target.error)||new Error('the browser stopped it');try{e.dwStore=m==='readonly'?'read':'write'}catch{}no(e)};
const txs=async(store,m,f)=>{const d=await db;return new Promise((ok,no)=>{const t=d.transaction(store,m);t.onerror=t.onabort=txFail(t,no,m);const q=f(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result)})};
const tx=(m,f)=>txs('items',m,f);
const metaGet=async k=>{const r=await txs('meta','readonly',s=>s.get(k));return r?r.v:undefined},metaPut=(k,v)=>txs('meta','readwrite',s=>s.put({k,v}));
/* read-modify-write inside ONE transaction, so a sync finishing at the same moment can't overwrite it */
const atomic=async(store,key,fn)=>{const d=await db;return new Promise((ok,no)=>{const t=d.transaction(store,'readwrite'),s=t.objectStore(store);let out;
  const q=s.get(key);q.onsuccess=()=>{out=fn(q.result);if(out&&out.put)s.put(out.put);if(out&&out.del)s.delete(key)};t.oncomplete=()=>ok(out&&out.value);t.onerror=t.onabort=txFail(t,no)})};
const addTombstones=add=>atomic('meta','tombstones',r=>{const v={...(r&&r.v||{})};for(const [id,t] of Object.entries(add))v[id]=Math.max(v[id]||0,t);return {put:{k:'tombstones',v},value:v}});
// every local edit is timestamped and triggers a (debounced) backup; deletions leave a tombstone so they sync too
const putRaw=i=>tx('readwrite',s=>s.put(i));
const put=i=>{i.updated=Date.now();const r=putRaw(i);r.then(()=>{window.scheduleSync&&scheduleSync()});return r};
const del=async id=>{await tx('readwrite',s=>s.delete(id));await addTombstones({[id]:Date.now()});window.scheduleSync&&scheduleSync()};

/* settings management */
/* Settings: a full-screen page of categories that unfold like Today's cards; openSettings('weather') opens one directly */
const SET_CATS=['schedule','daysoff','weather','care','photos','tagging','backup','connection','about'];
function setCatOpen(key,open,instant){const el=$('#sc-'+key);if(!el)return;el.classList.toggle('instant',!!instant);if(!instant){el.classList.remove('instant');void el.offsetHeight}
  el.classList.toggle('open',open);const b=el.querySelector('.scat-head');if(b)b.setAttribute('aria-expanded',open)}
function toggleCat(key){const el=$('#sc-'+key);if(!el)return;const open=!el.classList.contains('open');setCatOpen(key,open);settingsSummaries();const t0=Date.now();
  // the scroll to show what opened gives way to a finger or wheel that moved since the tap: on an iPhone it fought a scroll already under way
  if(open)setTimeout(()=>{const m=$('#settings-modal');if((m._touch||0)>t0)return;const r=el.getBoundingClientRect(),top=m.querySelector('.shead').getBoundingClientRect().bottom;
    const over=r.top+Math.min(el.scrollHeight,m.clientHeight-80)-m.clientHeight;if(over>0)m.scrollBy({top:Math.min(over+16,r.top-top-8),behavior:'smooth'})},460)}
/* the Backup line in Settings says what really happened: the last backup's time, or that the last try failed (sync.js keeps
   sync_status while a try fails and last_sync when one works) */
function backupSummary(w){if(!w)return 'Not backed up yet: needs a connection';
  const last=+localStorage.getItem('last_sync')||0,st=localStorage.getItem('sync_status')||'',when=t=>{const d=new Date(t),days=Math.round((todayDate()-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
    return days<=0?'today':days===1?'yesterday':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})};
  if(/failed/i.test(st))return last?`Last backup failed · last saved ${when(last)}`:'Backup failed: not backed up yet';
  return last?`Backed up ${when(last)}`:'Not backed up yet'}
function settingsSummaries(){const set=(k,t)=>{const e=$('#sum-'+k);if(e)e.textContent=t};if(typeof applyRole==='function')applyRole();if(typeof remindSoon==='function')remindSoon();
  const days=l=>{const s=[...l].sort((a,b)=>((a+6)%7)-((b+6)%7)),n=i=>DAY_NAMES[i].slice(0,3);if(!s.length)return 'none';
    const run=s.length>2&&s.every((d,i)=>!i||(s[i-1]+1)%7===d);return run?`${n(s[0])}–${n(s[s.length-1])}`:s.map(n).join(', ')};
  const bl=settings.blazerDays.filter(d=>settings.workdays.includes(d));
  set('schedule',`${days(settings.workdays)} · ${typeof dressSummary==='function'&&dressSummary()||`${bl.length?'blazers '+days(bl):'suits every day'} · vest ${({auto:'on cooler suit days',always:'every suit day',never:'never'})[settings.vestMode||'auto']}`}`);
  const T=isoKey(todayDate()),h=settings.holidays,offs=(settings.daysOff||[]).filter(x=>x.d>=T).length,occ=Object.values(dayRecs).filter(r=>r.date&&keyDate(r.date)>=todayDate()&&occOf(r)).length;
  set('daysoff',[h&&h.country?`${h.country} holidays`:'No holidays',`${offs} day${offs===1?'':'s'} off`,`${occ} occasion${occ===1?'':'s'}`].join(' · '));
  set('weather',`${settings.location?settings.location.name:'No location set'} · °${unit()}`);
  set('photos',typeof isConnected==='function'&&!isConnected()?'Needs a connection':'This day’s photo, and item pictures');
  const own=Object.keys((settings.custom&&settings.custom.colors)||{}).length+Object.keys((settings.custom&&settings.custom.patterns)||{}).length;
  set('tagging',`${own?own+' colour'+(own===1?'':'s')+' & patterns of your own':'Your own colours & patterns'}`);
  const w=localStorage.getItem('worker_url');let host='';try{host=w?new URL(w).host:''}catch{}
  set('backup',backupSummary(w));set('connection',typeof connSummary==='function'?connSummary():host||'Not connected')}
function openSettings(section){
  const cat=section==='wx'?'weather':section;
  for(const k of SET_CATS)setCatOpen(k,k===cat,true);
  if(typeof advClose==='function')advClose();   // the Advanced folds start closed every time
  if(cat)setTimeout(()=>{const el=$('#sc-'+cat),m=$('#settings-modal');if(el&&m)m.scrollTop=el.offsetTop-m.querySelector('.shead').offsetHeight-8},0);else if($('#settings-modal'))$('#settings-modal').scrollTop=0;
  if($('#cfg-url')) $('#cfg-url').value=localStorage.getItem('worker_url')||'';
  if($('#cfg-token')) $('#cfg-token').value=localStorage.getItem('app_token')||'';
  if(window.showSyncStatus)showSyncStatus();
  renderSettingsExtras();settingsSummaries();if(queuedKeys().length)checkQueue();
  if($('#settings-modal')){ $('#settings-modal').style.display='block'; $('#settings-modal').style.pointerEvents='auto'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='block'; $('#modal-backdrop').style.pointerEvents='auto'; }
  setLock(true);appPush('set');   // the phone's Back closes it (appPush, by show())
}
/* while Settings is up the page behind it can't scroll (html.set-lock): on an iPhone a scroll in Settings near its top or bottom was handed
   to Today underneath, and Settings stood still under the finger until that scroll ended; also notes the last touch for toggleCat */
function setLock(on){document.documentElement.classList.toggle('set-lock',on);const m=$('#settings-modal');
  if(on&&m&&!m._tw){m._tw=true;const mark=()=>{m._touch=Date.now()};m.addEventListener('touchstart',mark,{passive:true});m.addEventListener('wheel',mark,{passive:true})}}
let todayStale=false;   // a change made in Settings that Today should show once Settings closes
let viewStale=null;   // the Wardrobe or stats page, when a sync brought changes while Settings was open (syncRedraw): redrawn once it closes
const settingsOpen=()=>!!$('#settings-modal')&&$('#settings-modal').style.display==='block';
/* a redraw from work done in the background (photos arriving, the weather, the plan rules check at start-up): while Settings is open
   it waits for Settings to close (todayStale), since drawing Today closes Settings, which snapped shut when opened right after launch */
function refreshToday(){if(settingsOpen()){todayStale=true;return}renderToday()}
function closeSettings(){
  if($('#settings-modal')){ $('#settings-modal').style.display='none'; $('#settings-modal').style.pointerEvents='none'; }
  if($('#modal-backdrop')){ $('#modal-backdrop').style.display='none'; $('#modal-backdrop').style.pointerEvents='none'; }
  setLock(false);appDrop('set');   // closed by Done or anything else: its Back entry goes
  if(todayStale){todayStale=false;renderToday()}
  if(viewStale){const v=viewStale;viewStale=null;if(!$('#'+v).hidden)show(v)}
}
function saveSettings(){
  if($('#cfg-url')) localStorage.setItem('worker_url',$('#cfg-url').value.trim());
  if($('#cfg-token')) localStorage.setItem('app_token',$('#cfg-token').value.trim());
  closeSettings();
  renderAdd();
  if(window.syncNow)syncNow();
}

/* precision swatch: a 128 px square of the cloth, cut from the fabric close-up when the card has one (the cloth up close, white-
   balanced), else from the item photo; the Add card's sliders choose the zoom and the spot. Items with a close-up show it as their
   small fabric square across the app (swatchSVG in draw.js). */
function cropSwatch(canvas,zoom=1,cx=.5,cy=.5,light){
  const sampleSize=Math.min(canvas.width,canvas.height)*(0.5/(Number(zoom)||1)),o=document.createElement('canvas');o.width=o.height=128;
  const sx=Math.max(0,Math.min(canvas.width-sampleSize,(Number(cx)||.5)*canvas.width-sampleSize/2)),sy=Math.max(0,Math.min(canvas.height-sampleSize,(Number(cy)||.5)*canvas.height-sampleSize/2));
  o.getContext('2d').drawImage(canvas,sx,sy,sampleSize,sampleSize,0,0,128,128);if(light)matchLight(o,light);return o.toDataURL('image/png')}
/* a close-up's exposure says little (a white shirt shot in dim light reads grey): the swatch's lightness is set from the tagged colour,
   keeping the close-up's texture (each pixel's lightness above or below the cloth's median) and its hue. Near white, the texture's
   swing is narrowed so the lightest threads stay under paper white instead of clipping. */
function matchLight(o,hex){const x=o.getContext('2d',{willReadFrequently:true}),D=x.getImageData(0,0,o.width,o.height),d=D.data,n=d.length/4,lab=new Array(n);
  for(let i=0;i<n;i++)lab[i]=rgbLab(d[4*i],d[4*i+1],d[4*i+2]);
  const Ls=lab.map(l=>l[0]).sort((a,b)=>a-b),med=Ls[n>>1],hi=Ls[Math.floor(n*.97)]-med,lo=med-Ls[Math.floor(n*.03)],Lt=rgbLab(...hexRgb(hex))[0];
  const s=Math.min(1,hi>0?Math.max(.25,(99.5-Lt)/hi):1,lo>0?Math.max(.25,(Lt-.5)/lo):1);
  for(let i=0;i<n;i++){const [L,a,b]=lab[i],c=hexRgb(labHex([Math.max(0,Math.min(100,Lt+(L-med)*s)),a,b]));d[4*i]=c[0];d[4*i+1]=c[1];d[4*i+2]=c[2]}
  x.putImageData(D,0,0)}
function generateSwatch(q){
  const canvas=q.texCanvas||q.big;if(!canvas)return '';
  q.swatch=cropSwatch(canvas,q.zoom,q.cx,q.cy,q.texCanvas&&q.primaryColor?colOf(q):null);q.swSrc=q.texCanvas?'tex':'photo';
  return q.swatch;
}
/* a saved item's swatch, cut from the middle of its close-up (or, without one, its photo) */
async function refreshSwatch(it){if(!FABRIC.includes(it.type))return;const src=it.texture&&TEXTURE_TYPES.includes(it.type)?it.texture:it.photo;if(!src){delete it.swatch;delete it.swSrc;return}
  try{const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
    const tex=src!==it.photo;it.swatch=cropSwatch(c,1,.5,.5,tex&&it.primaryColor?colOf(it):null);it.swSrc=tex?'tex':'photo'}catch(e){console.warn('swatch not cut',e)}}
/* once: items that already have a close-up get their swatch cut from it, lightness set from the tagged colour (tex_swatch2) */
async function texSwatches(){if(localStorage.getItem('tex_swatch2')==='1')return 0;let n=0;
  for(const it of items)if(it.texture&&TEXTURE_TYPES.includes(it.type)){await refreshSwatch(it);if(it.swSrc==='tex'){await put(it);n++}}
  localStorage.setItem('tex_swatch2','1');if(n)cache={};return n}

function updateSwatchParam(i, param, val){
  queue[i][param]=Number(val);
  generateSwatch(queue[i]);
  const swEl=$(`#swatch-img-${i}`);
  if(swEl) swEl.style.backgroundImage=`url(${queue[i].swatch})`;
}

let aiError='',aiModel='';
/* ---- working on it: while a call to Claude or OpenAI runs (tagging, reading a pattern, making a photo or an item picture), and
   while photos are being made in the background, a spinning pill at the top of the screen says what is happening. Every call
   to the worker's AI endpoints goes through fetch, so one hook catches them all, including new ones. ---- */
const busyJobs=new Map();let busySeq=0;
function busyStart(label){const id=++busySeq;busyJobs.set(id,label);renderBusy();return ()=>{busyJobs.delete(id);renderBusy()}}
function busyLabelFor(u,o){if(!o||String(o.method||'GET').toUpperCase()!=='POST')return null;const w=localStorage.getItem('worker_url');if(!w)return null;
  let a,b;try{a=new URL(u,location.href);b=new URL(w.replace(/\/*$/,'/'))}catch{return null}if(a.origin!==b.origin)return null;
  const p=a.pathname.replace(b.pathname,'/').replace(/\/+$/,'')||'/',body=typeof o.body==='string'?o.body.slice(0,4000):'';
  if(p==='/')return 'Claude is tagging the photo…';if(p==='/tag-many')return 'Claude is finding the items…';if(p==='/pattern')return 'Claude is reading the pattern…';
  if(p==='/render'){if(/"mode":"queue"/.test(body))return null;return /"mode":"item"/.test(body)?'Making the item picture…':'Making the photo…'}
  return null}
if(typeof window!=='undefined'&&window.fetch&&!window.fetch.busy){const f0=window.fetch.bind(window);
  window.fetch=function(u,o){const l=busyLabelFor(typeof u==='string'?u:u&&u.url,o);if(!l)return f0(u,o);const end=busyStart(l);const r=f0(u,o);r.then(end,end);return r};window.fetch.busy=1}
function renderBusy(){let el=document.getElementById('busy');if(!el){if(!document.body)return;el=document.createElement('div');el.id='busy';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}
  const live=[...busyJobs.values()],bg=typeof queuedKeys==='function'?queuedKeys().filter(k=>!renderStalled(k)).length:0;   // a stalled photo isn't being made: its day offers Try again
  if(bg)live.push(`Making ${bg} photo${bg===1?'':'s'} in the background…`);
  document.body.classList.toggle('busy-on',!!live.length);if(!live.length){el.classList.remove('on');return}
  el.innerHTML=`<span class="spin" aria-hidden="true"></span><span>${esc(live[live.length-1])}${live.length>1?` <small>+${live.length-1}</small>`:''}</span>`;el.classList.add('on')}
/* the tab bar grows upward until its top is one design gap (--gap, 12px) below Today's below-the-waist tiles, so nothing peeks out
   between them (the score card's top used to); at most 64px, and never shorter than its 38px buttons. Measured with the page at the
   top, from where the tiles end and where the bar's natural top is; kept while on other pages and on days whose tiles sit lower. */
const NAV_MAX=64;
function fitNav(){const b=document.querySelector('#today:not([hidden]) .below'),nav=document.querySelector('body>nav');if(!nav)return;
  // the fit is measured only on a day whose photo has loaded: before it loads the photo has no height, the tiles sit right under the
  // date, and the bar grew to its 64px cap (and was kept there). That measurement is kept per screen size and used everywhere else
  // (a day with only the drawing and its Generate button, whose tiles sit lower; a weekend with no tiles), so the bar keeps one size.
  const k='nav_fit2:'+innerWidth+'x'+innerHeight;let kept=0;try{kept=+localStorage.getItem(k)||0}catch{}
  const img=document.querySelector('#today:not([hidden]) #mannequin-container > img'),ready=!!(b&&img&&img.complete&&img.naturalHeight>0&&img.getBoundingClientRect().height>60);
  let x=kept;
  if(ready){const gap=parseFloat(getComputedStyle(document.querySelector('#today')).getPropertyValue('--gap'))||12;
    const cs=getComputedStyle(nav),natural=innerHeight-38-(parseFloat(cs.paddingBottom)||0)-(parseFloat(cs.borderTopWidth)||0);   // the bar's top without the growth (not measured: its height may be mid-transition)
    // always as if the row had three tiles (belt, shoes, socks): with four (trousers on a blazer day, a coat) each is narrower, and a
    // tile with a product picture (its picture's height follows its width, its label doesn't) is shorter, which made the bar taller on those days; a drawn
    // tile keeps its height whatever the count
    const r=b.getBoundingClientRect(),cg=parseFloat(getComputedStyle(b).columnGap)||8,w3=(r.width-2*cg)/3;
    const h3=Math.max(0,...[...b.querySelectorAll('.tile')].map(t=>{const q=t.getBoundingClientRect(),im=t.querySelector('.item-pic');if(!t.classList.contains('has-pic')||!im)return q.height;
      const ar=im.getBoundingClientRect(),k=ar.width?ar.height/ar.width:.75;return q.height+(w3-q.width)*k}));   // the picture keeps its shape (4:3 in styles.css): it grows with the width
    x=Math.max(0,Math.min(NAV_MAX,Math.round(natural-(r.top+scrollY+h3+gap))));if(x!==kept)try{localStorage.setItem(k,String(x))}catch{}}
  const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navx'))||0;
  if(Math.abs(x-cur)>=1)document.documentElement.style.setProperty('--navx',x+'px')}
try{for(const k of Object.keys(localStorage))if(k.startsWith('nav_fit:'))localStorage.removeItem(k)}catch{}   // the first version could keep a 64px fit measured before the photo loaded
let fitNavRaf=0;const fitNavSoon=()=>{cancelAnimationFrame(fitNavRaf);fitNavRaf=requestAnimationFrame(fitNav)};
if(typeof ResizeObserver!=='undefined')addEventListener('DOMContentLoaded',()=>{const t=document.querySelector('#today');if(t)new ResizeObserver(fitNavSoon).observe(t)});
addEventListener('resize',fitNavSoon);
/* run once every script has loaded: the start-up chain can resolve before tagging.js (loaded after app.js) has run */
const afterScripts=f=>document.readyState==='complete'?f():addEventListener('load',()=>f(),{once:true});
// once every script of the page has run (DOMContentLoaded comes after the last one, and unlike load it doesn't wait for pictures)
const afterDom=f=>document.readyState!=='loading'?f():addEventListener('DOMContentLoaded',()=>f(),{once:true});
const aiLabel=q=>!q.ai?'Not tagged by AI: fill in the details.':!q.model?'Tagged by AI.':/^claude/.test(q.model)?`Tagged by Claude (${q.model}).`:`Tagged by AI (${q.model.replace(/^@cf\//,'')}).`;
/* tag one item: its photo (a data URL, or a canvas), plus the close-up, the measurement and the rest (tagExtras in tagging.js) */
async function ask(c,extra){
  try {
    const workerUrl=localStorage.getItem('worker_url');
    if(!workerUrl) return null;
    const dataUrl=typeof c==='string'?c:c.toDataURL('image/jpeg',TAG_Q);
    const res=await fetch(workerUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image:dataUrl,appToken:localStorage.getItem('app_token')||'',...tagExtras(extra)})
    });
    if(!res.ok){let e='',j={};try{j=await res.json();e=j.detail||j.error||''}catch{}aiError=tagFailText(res.status,j,e);return null}
    aiError='';
    const result=await res.json();aiModel=result.model||'';
    let parsed;
    try {
      const cleanText=(result.response||'').replace(/```json/g,'').replace(/```/g, '').trim();
      parsed=JSON.parse(cleanText);
    } catch(e) {
      parsed=result;
    }
    return normTag(parsed,result.model);
  } catch(e) {
    aiError=tagFailText(0,null,e);return null;
  }
}
/* an AI tag -> the fields the Add form uses (type-checked, colours and patterns normalised) */
const ownColorsOf=o=>{const f=c=>c&&/^#[0-9a-f]{6}$/i.test(c.hex||'')&&/[a-z]{2}/i.test(c.name||'')?{name:String(c.name).toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim().slice(0,24),hex:c.hex.toLowerCase()}:null;
  return o&&typeof o==='object'&&f(o.primary)?{primaryColor:f(o.primary),secondaryColor:f(o.secondary),tertiaryColor:f(o.tertiary)}:null};
function normTag(parsed,model){
    return {
      type:TYPES[parsed.type]?parsed.type:'suit',
      pattern:normPat(TYPES[parsed.type]?parsed.type:'suit',parsed.pattern),
      primaryColor:normColFor(parsed.type,parsed.primaryColor||parsed.color)||'grey',
      secondaryColor:normColFor(parsed.type,parsed.secondaryColor,true),
      tertiaryColor:normColFor(parsed.type,parsed.tertiaryColor,true),
      metal:METAL[parsed.metal]?parsed.metal:'silver',
      leather:[...LEATHERS,...SHOE_TEXTILES].includes(String(parsed.leather||'').toLowerCase().replace(/\s+/g,'-'))?String(parsed.leather).toLowerCase().replace(/\s+/g,'-'):null,
      trouserKind:['chinos','jeans','dress'].includes(parsed.trouserKind)?parsed.trouserKind:null,shoeStyle:SHOE_STYLES.some(([k])=>k===parsed.shoeStyle)?parsed.shoeStyle:null,
      model:model||'',
      dial:normCol(parsed.dial),band:['bracelet','leather'].includes(parsed.band)?parsed.band:null,bezel:['fluted','smooth'].includes(parsed.bezel)?parsed.bezel:null,
      // how sure it was, its runner-up, and what it would add when nothing listed fits (single-item tags)
      conf:parsed.confidence&&typeof parsed.confidence==='object'?parsed.confidence:null,
      altColor:normColFor(parsed.type,parsed.altColor),altPattern:parsed.altPattern&&parsed.altPattern!=='none'&&(PATS_BY[parsed.type]||[]).includes(parsed.altPattern)?parsed.altPattern:null,
      newColor:parsed.newColor&&parsed.newColor.name?parsed.newColor:null,newPattern:parsed.newPattern&&parsed.newPattern.name?parsed.newPattern:null,
      clothBox:parsed.clothBox&&typeof parsed.clothBox==='object'?parsed.clothBox:null,
      patternBox:parsed.patternBox&&typeof parsed.patternBox==='object'?parsed.patternBox:null,weave:parsed.weave&&typeof parsed.weave==='object'?parsed.weave:null,
      // Claude's own colour names and shades, not limited to the list (only when asked with freeColors: colpick.js)
      ownColors:ownColorsOf(parsed.ownColors),
      // Claude's own name and description of the pattern, and whether the listed one fits it (only with freePattern)
      ownPattern:parsed.ownPattern&&typeof parsed.ownPattern==='object'&&/[a-z]{2}/i.test(parsed.ownPattern.name||'')?{name:String(parsed.ownPattern.name).toLowerCase().replace(/[^a-z0-9 '&-]/g,'').replace(/\s+/g,' ').trim().slice(0,60),description:String(parsed.ownPattern.description||'').slice(0,300),fits:parsed.ownPattern.fits===true}:null
    };
}

const loadImg=f=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(f)});
function shrink(img,max){const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c}

async function fill(q,ai){
  q.zoom=1; q.cx=0.5; q.cy=0.5;
  generateSwatch(q);
  q.ai=!!(ai&&ai.type);q.model=ai&&ai.model||'';
  q.type=q.ai?ai.type:'suit';
  q.primaryColor=ai&&COLORS[ai.primaryColor]?ai.primaryColor:'grey';
  q.secondaryColor=ai&&ai.secondaryColor&&ai.secondaryColor!=='none'?ai.secondaryColor:null;
  q.tertiaryColor=ai&&ai.tertiaryColor&&ai.tertiaryColor!=='none'?ai.tertiaryColor:null;
  q.pattern=ai?normPat(q.type,ai.pattern):'solid';
  q.metal=ai&&METAL[ai.metal]?ai.metal:'silver';
  q.leather=ai&&ai.leather||'calf';q.trouserKind=ai&&ai.trouserKind||'dress';q.shoeStyle=ai&&ai.shoeStyle||'oxford';
  const wo=watchOpts(ai||{});q.dial=wo.dial;q.band=wo.band;q.bezel=wo.bezel;q.watchStyle=wo.style;
}

/* ---- automatic white balance (wbRead/wbGains in tagging.js): the light's colour is read from the brightest near-neutral pixels (a white wall, backdrop,
   shirt or label), which should be grey, and every pixel is scaled to make them so. Conservative: no correction when there
   are too few of them, when they fill nearly the whole photo (then they are the item itself, e.g. a close-up of a cream
   shirt; a white backdrop behind an item is fine), or when the cast is under 2%; each channel moves at most -15%/+18%. ---- */
function applyWb(c,g){const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0);
  if(!g)return o;const D=x.getImageData(0,0,o.width,o.height),d=D.data;
  for(let i=0;i<d.length;i+=4){d[i]=Math.min(255,d[i]*g.r);d[i+1]=Math.min(255,d[i+1]*g.g);d[i+2]=Math.min(255,d[i+2]*g.b)}x.putImageData(D,0,0);return o}
/* an Add card's pictures from its uncorrected originals, with or without the correction (Show original toggles it) */
/* an item's photo is kept at PH_MAX (720px, JPEG .85), the size Replace photo keeps: at 360px (JPEG .8) a suit sent to the photo
   generator was a 270px crop of a mirror selfie */
function cardPics(q){const g=q.wbOff?null:q.wb;q.big=applyWb(q.raw.big,g);q.photo=shrink(q.big,PH_MAX).toDataURL('image/jpeg',.85);
  if(q.raw.full)q.tagImg=applyWb(q.raw.full,g).toDataURL('image/jpeg',TAG_Q);   // the sharp copy the tagger sees
  if(q.raw.tex){q.texCanvas=applyWb(q.raw.tex,texGains(q));q.texture=q.texCanvas.toDataURL('image/jpeg',.85)}generateSwatch(q)}
/* a close-up with its own white reference (a corner of white paper) is corrected from that; otherwise like its item photo */
function texGains(q){const r=wbRead(q.raw.tex);return r.ref?r.gains:(q.wbOff?null:q.wb)}
function toggleWb(i){const q=queue[i];if(!q||!q.raw)return;q.wbOff=!q.wbOff;cardPics(q);renderAdd()}
const TEX_MAX=640;
/* the fabric close-up for an Add card: corrected with the same light reading as the card's item photo (taken together) */
async function addTexture(i,f){const q=queue[i];if(!q||!f)return;
  try{const img=await loadImg(f);q.raw=q.raw||{};q.raw.tex=shrink(img,TEX_MAX);q.raw.texFull=shrink(img,CLOSE_MAX);q.texCanvas=applyWb(q.raw.tex,texGains(q));q.texture=q.texCanvas.toDataURL('image/jpeg',.85);q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);q.refineNote='';renderAdd();
    refineFromCloseup(queue.indexOf(q))}   // tag again with both photos (tagging.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
function dropTexture(i){const q=queue[i];if(!q)return;delete q.texture;delete q.texCanvas;q.zoom=1;q.cx=q.cy=.5;generateSwatch(q);if(q.raw){delete q.raw.tex;delete q.raw.texFull}q.refineNote='';measureCard(q);renderAdd()}
/* the second step of a card for suits, blazers, trousers, shirts and ties: the close-up photo */
function texSlot(q,i){if(!TEXTURE_TYPES.includes(q.type))return '';
  const inp=`<input type="file" accept="image/*" hidden onchange="addTexture(${i},this.files[0]);this.value=''">`;
  return q.texture?`<div class="texslot done"><small class="mut">Fabric close-up added: the swatch shows it on the right half, next to the colour as tagged.</small><div class="btns"><label class="btn">Replace close-up${inp}</label><button type="button" onclick="dropTexture(${i})">Remove</button></div></div>`
    :`<div class="texslot"><b>Step 2 · Fabric close-up</b><small class="mut">Hold the camera close to the cloth so the weave and its true colour fill the frame. It makes the realistic photos match better. Optional.</small><label class="btn pri">Add close-up${inp}</label></div>`}
const wbNote=(q,i)=>q.wb&&q.raw?`<p class="wbnote mut"><small>${q.wbOff?'Original colours.':'Colours corrected for the light.'}</small> <button type="button" class="linkbtn" onclick="toggleWb(${i})">${q.wbOff?'Correct them':'Show original'}</button></p>`:'';
/* Add: "One item" (multi false; also paste and drag) makes one card per photo; "Several items" finds every item in it */
async function addFiles(files,multi){
  guardUnsaved();
  if(multi){multiNote(true);for(const f of files)await addMulti(f);return}
  for(const f of files){
    const q={id:crypto.randomUUID(),busy:1};
    queue.push(q);
    renderAdd();
    try{
      const img=await loadImg(f);
      q.raw={big:shrink(img,800),full:shrink(img,TAG_MAX)};q.wb=wbGains(q.raw.big);cardPics(q);   // tagged from the corrected, sharp copy
      const aiResult=await ask(q.tagImg);
      fill(q,aiResult);if(aiResult){takeExtras(q,aiResult);measureCard(q)}else tagFailed(q)
    }catch(e){q.err=1}
    q.busy=0;
    renderAdd();
  }
}

/* ---- pasted photos, photo links and drag & drop ---- */
const pasteMsg=t=>{const e=$('#paste-status');if(e)e.textContent=t||''};
const isLink=t=>/^(https?:\/\/|data:image\/)\S+$/i.test((t||'').trim());
function addBlobs(blobs){
  const files=blobs.filter(b=>b&&/^image\//.test(b.type)).map((b,n)=>b instanceof File&&b.name?b:new File([b],`pasted-${Date.now()}-${n}.${(b.type.split('/')[1]||'png').replace(/\W.*/,'')}`,{type:b.type}));
  if(files.length){pasteMsg('');addFiles(files)}return files.length;
}
/* download a photo link: directly if the site allows it, otherwise through the worker (which also reads a shop page's photo) */
async function fetchPhoto(link){
  const u=link.trim();
  if(/^data:image\//i.test(u))return (await fetch(u)).blob();
  let url;try{url=new URL(u)}catch{throw new Error('That is not a valid link.')}
  if(!/^https?:$/.test(url.protocol))throw new Error('Only http and https links are supported.');
  try{const r=await fetch(url.href,{mode:'cors',credentials:'omit'});
    if(r.ok){const b=await r.blob();if(/^image\//.test(b.type))return b}}catch(e){/* blocked by the site (no CORS): use the worker */}
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');
  if(!w||!tok)throw new Error('That site doesn’t let the app download the photo directly. Connect in ⚙ Settings so the server can fetch it, or save the photo and add it from your device.');
  let r;try{r=await fetch(new URL('fetch',w.replace(/\/*$/,'/')).href+'?url='+encodeURIComponent(url.href),{headers:{'x-app-token':tok}})}
  catch{throw new Error('Couldn’t reach the server to fetch the photo.')}
  if(!r.ok){let m='';try{m=(await r.json()).error}catch{}
    if(r.status===404||r.status===405)m='The server doesn’t support photo links yet: it needs an update.';
    throw new Error(m||`The server couldn’t fetch the photo (${r.status}).`)}
  const b=await r.blob();if(!/^image\//.test(b.type))throw new Error('That link is not a photo.');return b;
}
async function addFromUrl(link){
  pasteMsg('Fetching the photo…');
  try{const b=await fetchPhoto(link);addBlobs([b]);const i=$('#photo-url');if(i)i.value='';return true}
  catch(e){pasteMsg(e.message||'Couldn’t fetch that photo.');return false}
}
function addLink(){const i=$('#photo-url'),v=(i&&i.value||'').trim();if(!v){pasteMsg('Paste a photo or a link into the box first.');return}
  if(!isLink(v)){pasteMsg('That doesn’t look like a link. It should start with http:// or https://.');return}return addFromUrl(v)}
async function pasteFromClipboard(){
  if(!navigator.clipboard||!navigator.clipboard.read){pasteMsg('Your browser blocks the Paste button: long-press (or right-click) the box and choose Paste.');$('#photo-url')?.focus();return}
  try{const its=await navigator.clipboard.read(),blobs=[];let text='';
    for(const it of its){const t=it.types.find(x=>x.startsWith('image/'));if(t)blobs.push(await it.getType(t));
      else if(!text&&it.types.includes('text/plain'))text=await (await it.getType('text/plain')).text()}
    if(addBlobs(blobs))return;
    if(isLink(text))return addFromUrl(text.trim());
    pasteMsg('The clipboard has no photo or photo link. Copy an image (or its address) first.');
  }catch(e){pasteMsg('Couldn’t read the clipboard: long-press (or right-click) the box and choose Paste.');$('#photo-url')?.focus()}
}
const clipImages=dt=>[...(dt&&dt.items||[])].filter(x=>x.kind==='file'&&x.type.startsWith('image/')).map(x=>x.getAsFile()).filter(Boolean);
/* Ctrl+V / ⌘V: a copied image anywhere in the app goes to Add; a pasted link goes in when the Add screen is open */
document.addEventListener('paste',e=>{
  const imgs=clipImages(e.clipboardData),tgt=e.target,inBox=tgt&&tgt.id==='photo-url';
  const typing=tgt&&/^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)&&!inBox;
  if(imgs.length){if(typing&&tgt.type!=='url'&&tgt.type!=='text')return;e.preventDefault();if($('#add').hidden)openAdd();addBlobs(imgs);return}
  const text=(e.clipboardData&&e.clipboardData.getData('text/plain')||'').trim();
  if(!typing&&!$('#add').hidden&&isLink(text)){e.preventDefault();const i=$('#photo-url');if(i)i.value=text;addFromUrl(text)}
});
/* drag & drop photos (or an image dragged from another tab) onto the app */
document.addEventListener('dragover',e=>{if([...(e.dataTransfer&&e.dataTransfer.types||[])].some(t=>t==='Files'||t==='text/uri-list')){e.preventDefault();document.body.classList.add('dragging')}});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('dragging')});
document.addEventListener('drop',e=>{const dt=e.dataTransfer;if(!dt)return;document.body.classList.remove('dragging');
  const files=[...dt.files].filter(f=>f.type.startsWith('image/'));
  const link=(dt.getData('text/uri-list')||'').split(/\r?\n/).find(l=>l&&!l.startsWith('#'))||dt.getData('text/plain');
  if(!files.length&&!isLink(link))return;e.preventDefault();if($('#add').hidden)openAdd();
  if(files.length)addBlobs(files);else addFromUrl(link.trim())});

/* ---- several items in one photo: the worker lists every item with a rough box; each becomes its own card ---- */
const multiMsg=t=>{const e=$('#multi-status');if(e)e.textContent=t||''};
function multiNote(on){multiMsg(on?'Each item in the photo gets its own card. Check each card: colours and textures from a rail photo need a look, especially whites.':'')}
/* crop the box (thousandths of the image) with a little margin, keeping at least a usable size */
function cropBox(img,box,max){
  const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,pad=.04;
  let x=(box.x/1000-pad*box.w/1000)*W,y=(box.y/1000-pad*box.h/1000)*H,w=box.w/1000*W*(1+2*pad),h=box.h/1000*H*(1+2*pad);
  const minS=Math.min(W,H)*.08;if(w<minS){x-=(minS-w)/2;w=minS}if(h<minS){y-=(minS-h)/2;h=minS}
  x=Math.max(0,x);y=Math.max(0,y);w=Math.min(W-x,w);h=Math.min(H-y,h);
  const k=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  c.getContext('2d').drawImage(img,x,y,w,h,0,0,c.width,c.height);return c;
}
async function addMulti(f){
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token')||'';
  if(!w){multiMsg('Connect in ⚙ Settings first: finding several items in one photo needs the server.');return}
  const holder={id:crypto.randomUUID(),busy:1,multiBusy:1};queue.push(holder);renderAdd();
  try{
    const raw=shrink(await loadImg(f),2576),wb=wbGains(raw),img=applyWb(raw,wb);   // one light reading for the whole photo; Claude reads up to 2576px
    const r=await fetch(new URL('tag-many',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},
      body:JSON.stringify({image:img.toDataURL('image/jpeg',.9),custom:customForTag(),corrections:tagFixes()})});
    const j=await r.json().catch(()=>({}));
    queue.splice(queue.indexOf(holder),1);
    if(!r.ok){multiMsg(r.status===404||r.status===405?'The server doesn’t support several items yet: it needs an update.':`Couldn’t find the items: ${j.detail||j.error||'HTTP '+r.status}`);renderAdd();return}
    const list=j.items||[];
    if(!list.length){multiMsg('No clothing items were found in that photo.');renderAdd();return}
    list.forEach((it,n)=>{
      const q={id:crypto.randomUUID(),multi:{n:n+1,of:list.length,confidence:it.confidence||'medium'}};
      q.raw={big:cropBox(raw,it.box,800),full:cropBox(raw,it.box,TAG_MAX)};q.wb=wb;cardPics(q);
      const tg=normTag(it,j.model);fill(q,tg);q.aiTag={...aiFields(tg)};queue.push(q);
    });
    aiModel=j.model||aiModel;aiError='';
    const counts={};for(const it of list){const t=TYPES[it.type]?it.type:'item';counts[t]=(counts[t]||0)+1}
    multiMsg(`Found ${list.length} item${list.length===1?'':'s'} (${Object.entries(counts).map(([t,c])=>{const n=(TYPES[t]||'item').toLowerCase();return `${c} ${n}${c>1&&!n.endsWith('s')?'s':''}`}).join(', ')}). Check each card, then Save all or confirm them one by one.`);
  }catch(e){const k=queue.indexOf(holder);if(k>=0)queue.splice(k,1);multiMsg('Couldn’t read that photo: '+(e.message||e))}
  renderAdd();
}
/* save every finished card in the queue (Skip the ones you don't want first) */
async function saveAll(){const n=queue.filter(q=>!q.busy&&!q.err).length;for(let i=queue.length-1;i>=0;i--){const q=queue[i];if(!q.busy&&!q.err)await save(i)}
  multiMsg(`Saved ${n} item${n===1?'':'s'} to your wardrobe.`);renderAdd()}
const shirtColFix=o=>{for(const f of ['primaryColor','secondaryColor','tertiaryColor'])if(o[f])o[f]=normColFor(o.type,o[f],f!=='primaryColor')};
const setq=(i,k,v)=>{const q=queue[i];q[k]=v==='none'?null:v;q.edited={...q.edited,[k]:true};if(k==='shoeStyle'&&!leathersFor(q).includes(q.leather))q.leather='calf';if(k==='shoeStyle'||k==='trouserKind'){renderAdd();return}if((k==='primaryColor'||k==='type')&&q.texCanvas)generateSwatch(q);if(k==='type'){q.pattern=normPat(v,q.pattern);shirtColFix(q)}if(k==='type'||q.manual||k==='primaryColor'||k==='pattern'){if(k==='type'&&q.meas)q.meas.near=nearestCols(q.type,q.meas.lab,q.meas.ref);if(k==='type'||k==='pattern')readSett(q);renderAdd()}else{const t=$('#tagsw-q'+i);if(t)t.innerHTML=tagSwInner(q)}};
/* next to an item's photo: the colour and texture as tagged (what the app draws), so the two can be compared */
/* with a fabric close-up: the drawn swatch on the left half, the close-up on the right, to compare colour and weave */
const tagSwInner=i=>`<div class="swsplit">${itemThumb(i,true)}${i.texture&&TEXTURE_TYPES.includes(i.type)?`<img class="swtex" src="${i.texture}" alt="Fabric close-up">`:''}</div><figcaption>${i.texture&&TEXTURE_TYPES.includes(i.type)?'As tagged · Close-up':'As tagged'}<br><b class="cap">${sentence(desc(i))||TYPES[i.type]||''}</b></figcaption>`;
/* Shade: darker or lighter than the tagged colour's swatch, to match the close-up; "Match close-up" sets it from the measurement */
const shadeRow=(o,onStep,onMatch,canMatch)=>`<div class="shaderow"><span class="shlab">Shade</span><div class="shctl"><button type="button" class="shbtn" aria-label="Darker" onclick="${onStep}(-1)"${(o.shade||0)<=-SHADE_MAX?' disabled':''}>−</button><span class="shval">${shadeName(o.shade||0)}</span><button type="button" class="shbtn" aria-label="Lighter" onclick="${onStep}(1)"${(o.shade||0)>=SHADE_MAX?' disabled':''}>+</button></div>${canMatch?`<button type="button" class="chipbtn" onclick="${onMatch}">Match close-up</button>`:''}</div>`;
function stepShadeQ(i,d){const q=queue[i];if(!q)return;q.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(q.shade||0)+d));if(!q.shade)delete q.shade;renderAdd()}
function matchShadeQ(i){const q=queue[i];if(!q||!q.meas)return;q.shade=shadeFor(q,q.meas.lab);if(!q.shade)delete q.shade;renderAdd();toast(q.shade?`Swatch set ${shadeName(q.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
async function stepShadeE(id,d){const it=items.find(x=>x.id===id);if(!it)return;it.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(it.shade||0)+d));if(!it.shade)delete it.shade;await put(it);cache={};renderWardrobe()}
async function matchShadeE(id){const it=items.find(x=>x.id===id);if(!it)return;let lab=it.meas&&it.meas.src==='closeup'?it.meas.lab:null;
  if(!lab&&it.texture)try{const im=await imgOf(it.texture),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);lab=measureCloth(c,null,{}).lab}catch{}
  if(!lab)return;it.shade=shadeFor(it,lab);if(!it.shade)delete it.shade;await put(it);cache={};renderWardrobe();toast(it.shade?`Swatch set ${shadeName(it.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
const photoPair=(photo,i,id)=>`<div class="pair"><figure class="phfig"><img class="ph" src="${photo}" alt="Photo"><figcaption>Photo</figcaption></figure><figure class="tagsw" id="${id}" aria-live="polite">${tagSwInner(i)}</figure></div>`;
/* an item described with the dropdowns only; the wardrobe shows a drawn thumbnail instead of a photo */
function addManual(){
  guardUnsaved();
  const wo=watchOpts({});
  queue.unshift({id:crypto.randomUUID(),manual:true,type:'suit',primaryColor:'grey',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf',dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style});
  renderAdd();
}
/* bought but not here yet: the item goes into the wardrobe out of rotation; with an arrival date it joins the outfits from the day
   after (inRotation in core.js), and once that day comes it is put back in rotation for good (checkArrivals) */
const fmtDay=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
const orderHint=a=>a?`It joins your outfits from the day after ${fmtDay(a)}.`:'It stays out of your outfits until you put it back in rotation from the Wardrobe. Add a date to have that happen by itself.';
function orderRow(q,i){return `<div class="ordrow"><button type="button" class="rotbtn${q.order?' on':''}" aria-pressed="${!!q.order}" onclick="setOrder(${i},${!q.order})">${q.order?'✓ ':''}Bought, on the way</button>${q.order?`<label class="ordate">Arrives (optional) <input type="date" value="${q.arrives||''}" min="${isoKey(todayDate())}" onchange="setArrives(${i},this.value)"></label><small class="mut ordhint">${orderHint(q.arrives)}</small>`:''}</div>`}
function setOrder(i,on){const q=queue[i];if(!q)return;q.order=!!on;if(!on)delete q.arrives;renderAdd()}
function setArrives(i,v){const q=queue[i];if(!q)return;if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))q.arrives=v;else delete q.arrives;renderAdd()}
async function checkArrivals(){const T=di(todayDate()),done=items.filter(i=>i.paused&&arriveN(i)!=null&&T>arriveN(i));
  const cb=done.filter(i=>i.away);   // back from the cleaner's or the laundry (care.js): cleaned on the day it was due back
  for(const it of done){if(it.away){it.cleaned=it.away.back||isoKey(todayDate());delete it.away}delete it.paused;delete it.order;delete it.arrives;await put(it)}
  if(done.length){cache={};toast(cb.length===done.length&&typeof careBackText==='function'?careBackText(cb):done.length===1?`Your ${(TYPES[done[0].type]||'item').toLowerCase()} has arrived: it's in rotation now.`:`${done.length} items have arrived: they're in rotation now.`,4000)}return done.length}
async function save(i){
  const q=queue[i],f=FABRIC.includes(q.type);
  generateSwatch(q);
  const it={id:q.id,type:q.type,primaryColor:q.primaryColor,secondaryColor:q.secondaryColor,tertiaryColor:q.tertiaryColor,pattern:f?q.pattern:'solid',photo:q.photo,added:Date.now()};
  if(f){it.swatch=q.swatch;it.swSrc=q.swSrc}
  if(q.order){it.paused=true;it.order=true;if(q.arrives)it.arrives=q.arrives}   // bought, on the way
  if(METAL_TYPES.includes(q.type))it.metal=q.metal||'silver';
  if(q.type==='shirt')it.cuff=q.cuff||'button';
  if(q.type==='suit')it.vest=q.vest==='yes'?'yes':'no';if(typeof dressNewItem==='function')dressNewItem();
  if(SEASON_TYPES.includes(q.type)&&q.season&&q.season!=='all')it.season=q.season;
  if(q.type==='shoes'||q.type==='belt')it.leather=q.leather||'calf';
  if(q.type==='pants'&&(q.trouserKind==='chinos'||q.trouserKind==='jeans'))it.trouserKind=q.trouserKind;   // dress trousers: no field (as before kinds)
  if(q.type==='shoes'&&q.shoeStyle&&q.shoeStyle!=='oxford')it.shoeStyle=q.shoeStyle;
  if(q.type==='watch'){const wo=watchOpts(q);Object.assign(it,{dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style})}
  if(!it.photo)delete it.photo;
  if(q.texture&&TEXTURE_TYPES.includes(q.type))it.texture=q.texture;
  if(q.meas)it.meas={lab:q.meas.lab,ref:!!q.meas.ref,src:q.meas.src};
  wardSaveFields(q,it);   // name, brand, material, notes (wardrobe.js)
  if(q.shade)it.shade=q.shade;   // drawn darker or lighter than the swatch, to match the close-up   // the owner's own colour samples (calibLab)
  if(q.sett&&!q.settOff&&readable(it.type,it.pattern,q.weave)){it.sett=q.sett;if(q.patternBox)it.pbox=q.patternBox}   // the full pattern (tagging.js)
  if(q.weave&&FABRIC.includes(it.type)&&it.pattern!=='solid'){it.weave=q.weave;if(q.weave.description)it.patternText=q.weave.description}
  if(q.spec&&it.sett&&it.sett.src==='claude+pixels')it.patternSpec=q.spec;   // Claude's reading of the pattern (tagging.js)
  if(!it.sett)try{const st=detectQueued(q,it);if(st)it.stripes=st}catch(e){console.warn('pattern detection failed',e)}
  await put(it);items.push(it);cache={};queue.splice(i,1);renderAdd();
  if(q.tagImg)keepTagImg(it.id,q.tagImg);recordTagResult(q,it);askPersist();   // tagging.js: the sharp copy for the benchmark; what the tagger got wrong
  if(it.texture&&q.raw&&q.raw.tex)closeTagImg(q).then(u=>keepCloseImg(it.id,u,it.texture)).catch(()=>{});   // the sharp close-up for later readings (tagging.js)
}
let editing=null;
const E=(id,k,list,v,lab)=>`<label>${lab?lab:k==='primaryColor'?'Colour':k==='secondaryColor'?'Second colour':k==='tertiaryColor'?'Third colour':k==='watchStyle'||k==='shoeStyle'?'Style':k==='trouserKind'?'Kind':k[0].toUpperCase()+k.slice(1)} <select onchange="sete('${id}','${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${cap1(x[1])}</option>`).join('')}</select></label>`;
/* ---- Wardrobe editor: replace, rotate, zoom-crop the item's photo. Only the picture changes: the tags (colour, pattern...)
   and the item itself stay, so the plan and the outfit history are untouched. Undo works until the editor is closed. ---- */
let phEdit={id:null,undo:[],crop:null};
const PH_MAX=720;
function photoTools(i){if(phEdit.crop)return '';const tex=TEXTURE_TYPES.includes(i.type);
  return `<div class="phtools"><label class="btn">${i.photo?'Replace photo':'Add photo'}<input type="file" accept="image/*" hidden onchange="replacePhoto('${i.id}',this.files[0]);this.value=''"></label>`+
    (tex?`<label class="btn">${i.texture?'Replace close-up':'Add fabric close-up'}<input type="file" accept="image/*" hidden onchange="replaceTexture('${i.id}',this.files[0]);this.value=''"></label>`:'')+
    (i.photo?`<button type="button" onclick="rotatePhoto('${i.id}')" aria-label="Rotate the photo a quarter turn clockwise">Rotate ↻</button><button type="button" onclick="startCrop('${i.id}')">Zoom &amp; crop</button>`:'')+
    (tex&&i.texture?`<button type="button" onclick="setTexture('${i.id}',null,'Close-up removed.')">Remove close-up</button>`:'')+
    (phEdit.undo.length?`<button type="button" onclick="undoPhoto('${i.id}')">Undo</button>`:'')+`</div>`}
const imgOf=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src});
async function setPic(id,k,url,msg){const it=items.find(x=>x.id===id);if(!it)return;phEdit.undo.push({k,v:it[k]||null});if(phEdit.undo.length>10)phEdit.undo.shift();
  if(url)it[k]=url;else delete it[k];if(k==='texture')await refreshSwatch(it);await put(it);cache={};renderWardrobe();if(msg)toast(msg)}
const setPhoto=(id,url,msg)=>setPic(id,'photo',url,msg),setTexture=(id,url,msg)=>setPic(id,'texture',url,msg);
/* a close-up added later stays as taken: the item photo's light reading may not hold for another moment */
async function replaceTexture(id,f){if(!f)return;try{const img=await loadImg(f),sharp=shrink(img,CLOSE_MAX).toDataURL('image/jpeg',TAG_Q);
  await setTexture(id,shrink(img,TEX_MAX).toDataURL('image/jpeg',.85),'Close-up added. The realistic photos use it from the next one made.');
  const it=items.find(x=>x.id===id);if(it&&it.texture)await keepCloseImg(id,sharp,it.texture)}   // the sharp copy for pattern and colour readings (tagging.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
async function replacePhoto(id,f){if(!f)return;try{const img=await loadImg(f);await setPhoto(id,shrink(img,PH_MAX).toDataURL('image/jpeg',.85),'Photo replaced. The item’s tags and your plan are unchanged.')}
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
async function rotatePhoto(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo),c=document.createElement('canvas');
  c.width=im.height;c.height=im.width;const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);await setPhoto(id,c.toDataURL('image/jpeg',.9))}
async function undoPhoto(id){const it=items.find(x=>x.id===id);if(!it||!phEdit.undo.length)return;const {k,v}=phEdit.undo.pop();
  if(v)it[k]=v;else delete it[k];if(k==='texture')await refreshSwatch(it);await put(it);cache={};renderWardrobe()}
/* zoom & crop: a square frame; the slider zooms (about the centre), dragging moves the picture */
async function startCrop(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo);
  phEdit.crop={w:im.naturalWidth,h:im.naturalHeight,z:1,cx:.5,cy:.5};renderWardrobe();const b=$('#ivbody');if(b)b.scrollTop=0;requestAnimationFrame(layoutCrop)}
/* the best copy to crop from: the sharp copy kept on this device when the photo was read (tagging.js, up to 2048px), turned as the
   photo is now, when it shows the same picture (same shape, and alike at 24x24); else the photo itself. A crop from the kept photo
   alone came out at the size of its piece of a 360px picture (a suit at 270px). A photo replaced, or already cropped, no longer
   matches the sharp copy, so it is cropped from itself */
const CROP_MATCH=12;   // the largest mean grey difference (0-255) at 24x24 that still counts as the same picture
async function cropSource(it){const ph=await imgOf(it.photo);
  let sharp=null;try{const u=typeof tagImgOf==='function'?await tagImgOf(it.id):null;sharp=u?await imgOf(u):null}catch{sharp=null}
  if(!sharp||sharp.naturalWidth<=ph.naturalWidth)return ph;
  const grey=src=>{const N=24,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.drawImage(src,0,0,N,N);
    const d=x.getImageData(0,0,N,N).data,g=[];for(let k=0;k<d.length;k+=4)g.push(.3*d[k]+.59*d[k+1]+.11*d[k+2]);return g};
  const want=grey(ph),ar=ph.naturalWidth/ph.naturalHeight;
  for(let q=0;q<4;q++){const W=q%2?sharp.naturalHeight:sharp.naturalWidth,H=q%2?sharp.naturalWidth:sharp.naturalHeight;if(Math.abs(W/H-ar)>.02*ar)continue;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.translate(W/2,H/2);x.rotate(q*Math.PI/2);x.drawImage(sharp,-sharp.naturalWidth/2,-sharp.naturalHeight/2);
    const g=grey(c);let s=0;for(let k=0;k<g.length;k++)s+=Math.abs(g[k]-want[k]);if(s/g.length<=CROP_MATCH)return c}
  return ph}
function cropEditor(i){const c=phEdit.crop;return `<div class="cropwrap"><div class="cropbox" id="cropbox" onpointerdown="cropDrag(event)"><img id="cropimg" src="${i.photo}" alt="Photo being cropped" draggable="false"></div>
  <label class="cropzoom">Zoom <input type="range" min="1" max="4" step="0.05" value="${c.z}" oninput="phEdit.crop.z=+this.value;layoutCrop()" aria-label="Zoom"></label>
  <p class="mut" style="margin:2px 0 6px;font-size:13px">Drag the picture to position it.</p>
  <div class="btns"><button class="pri" type="button" onclick="applyCrop('${i.id}')">Apply</button><button type="button" onclick="phEdit.crop=null;renderWardrobe()">Cancel</button></div></div>`}
function cropGeom(){const c=phEdit.crop,box=$('#cropbox');if(!c||!box)return null;const V=box.clientWidth,s=V/Math.min(c.w,c.h)*c.z,W=c.w*s,H=c.h*s;
  // keep the frame inside the picture
  const hx=V/2/W,hy=V/2/H;c.cx=Math.min(1-hx,Math.max(hx,c.cx));c.cy=Math.min(1-hy,Math.max(hy,c.cy));
  return {V,s,W,H,x:V/2-c.cx*W,y:V/2-c.cy*H}}
function layoutCrop(){const g=cropGeom(),img=$('#cropimg');if(!g||!img)return;Object.assign(img.style,{width:g.W+'px',height:g.H+'px',left:g.x+'px',top:g.y+'px'})}
function cropDrag(e){const c=phEdit.crop;if(!c)return;e.preventDefault();const box=e.currentTarget;box.setPointerCapture&&box.setPointerCapture(e.pointerId);let lx=e.clientX,ly=e.clientY;
  const mv=ev=>{const g=cropGeom();if(!g)return;c.cx-=(ev.clientX-lx)/g.W;c.cy-=(ev.clientY-ly)/g.H;lx=ev.clientX;ly=ev.clientY;layoutCrop()};
  const up=()=>{box.removeEventListener('pointermove',mv);box.removeEventListener('pointerup',up);box.removeEventListener('pointercancel',up)};
  box.addEventListener('pointermove',mv);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up)}
async function applyCrop(id){const it=items.find(x=>x.id===id),g=cropGeom();if(!it||!g)return;
  const im=await cropSource(it),f=(im.naturalWidth||im.width)/phEdit.crop.w;   // the frame is measured on the photo; f scales it to the source
  const side=g.V/g.s*f,sx=-g.x/g.s*f,sy=-g.y/g.s*f,out=Math.min(PH_MAX,Math.round(side)),c=document.createElement('canvas');c.width=c.height=out;
  c.getContext('2d').drawImage(im,sx,sy,side,side,0,0,out,out);phEdit.crop=null;await setPhoto(id,c.toDataURL('image/jpeg',.9))}
/* the item page's body (see "Wardrobe item page" below): the photo beside the drawn swatch with its tools folded under it, then a
   card for the tags, one for rotation, and Delete on its own at the very end */
function toggleCompare(closeOnly){const el=$('#ivpair');if(!el||(closeOnly&&!phEdit.cmp))return;phEdit.cmp=!phEdit.cmp;el.classList.toggle('cmp',!!phEdit.cmp);el.querySelector('.tagsw').setAttribute('aria-pressed',!!phEdit.cmp)}
function togglePhotoTools(){phEdit.open=!phEdit.open;const el=$('#ivph');if(!el)return;el.classList.toggle('open',!!phEdit.open);el.querySelector('.ivphbtn').setAttribute('aria-expanded',!!phEdit.open)}
function itemBody(i){
  if(phEdit.id!==i.id)phEdit={id:i.id,undo:[],crop:null};
  const cols=COLOR_OPTS(i.type,primaryCol(i)),acc=c=>[['none','None'],...COLOR_OPTS(i.type,c,true)],pic=i.photo||wardPic(i);
  // with a close-up, the split swatch is a button: tapped, the drawing slides over the photo and the close-up fills its square, to
  // compare the two whole; a tap on either square puts them back (toggleCompare; the choice lasts while the item stays open)
  const cmp=pic&&i.texture&&TEXTURE_TYPES.includes(i.type);
  const pair=!pic?`<div class="ivdraw">${itemThumb(i)}</div>`:!cmp?photoPair(pic,i,'tagsw-'+i.id):`<div class="pair cmpable${phEdit.cmp?' cmp':''}" id="ivpair"><figure class="phfig" onclick="toggleCompare(true)"><div class="cmpbox"><img class="ph" src="${pic}" alt="Photo"><div class="cmpdraw" aria-hidden="true">${itemThumb(i,true)}</div></div><figcaption><span class="c0">Photo</span><span class="c1">As tagged</span></figcaption></figure>`+
    `<figure class="tagsw" id="tagsw-${i.id}" role="button" tabindex="0" aria-pressed="${!!phEdit.cmp}" aria-label="Compare the drawing and the close-up side by side" onclick="toggleCompare()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCompare()}">${tagSwInner(i)}<figcaption class="c1">Close-up</figcaption></figure></div>`;
  const hero=phEdit.crop?cropEditor(i):`<div class="ivhero">${pair}</div>`;
  const tags=`<section class="card ivsec ivtags"><h3>Details</h3>${wardFieldsTop(i)}${COLORS[primaryCol(i)]?shadeRow(i,`stepShadeE.bind(null,'${i.id}')`,`matchShadeE('${i.id}')`,!!(i.texture||(i.meas&&i.meas.src==='closeup'))):''}${E(i.id,'type',Object.entries(TYPES),i.type)}${EC(i.id,'primaryColor',primaryCol(i))}${EC(i.id,'secondaryColor',i.secondaryColor||'none',i.type==='socks'?'Toe cap':'')}${i.type==='socks'?'':EC(i.id,'tertiaryColor',i.tertiaryColor||'none')}
  ${FABRIC.includes(i.type)?EP(i.id,i):''}${METAL_TYPES.includes(i.type)?E(i.id,'metal',Object.keys(METAL).map(c=>[c,c]),i.metal||'silver'):''}
  ${i.type==='shirt'?E(i.id,'cuff',CUFFS,i.cuff||'button'):''}${i.type==='suit'?E(i.id,'vest',VESTS,hasVest(i)?'yes':'no'):''}${SEASON_TYPES.includes(i.type)?E(i.id,'season',SEASONS,i.season||'all'):''}
  ${i.type==='pants'?E(i.id,'trouserKind',TROUSER_KINDS,trouserKind(i)):''}${i.type==='shoes'?E(i.id,'shoeStyle',SHOE_STYLES,shoeStyle(i)):''}${i.type==='shoes'||i.type==='belt'?E(i.id,'leather',leathersFor(i).map(c=>[c,cap1(leatherWord(i,c))]),i.leather||'calf',leatherLabel(i)):''}
  ${i.type==='watch'?`<label class="wdetails">Details <input type="text" value="${esc(i.details||'')}" placeholder="e.g. three subdials, 12 and 6 numerals" onchange="sete('${i.id}','details',this.value.trim()||'none')"></label>`:''}${i.type==='watch'?E(i.id,'dial',DIAL_OPTS(watchOpts(i).dial),watchOpts(i).dial)+E(i.id,'band',BANDS,watchOpts(i).band)+E(i.id,'bezel',BEZELS,watchOpts(i).bezel)+E(i.id,'watchStyle',WATCH_STYLES,watchOpts(i).style):''}
  ${DETECT_PATS.includes(patBase(i.pattern))||settable(i.type,i.pattern,i.weave)||claudeOnly(i.type,i.pattern)||i.sett?`<div class="ivpat"><p class="shelp">Pattern layout: ${patSummary(i)}</p><div class="btns">${claudeOnly(i.type,i.pattern)&&!isConnected()?'':`<button id="readpat-btn" onclick="${i.texture||i.pbox||claudeOnly(i.type,i.pattern)?`rereadSett('${i.id}')`:`redetect('${i.id}')`}">Read pattern from photo</button>`}${i.stripes||i.sett?`<button onclick="clearStripes('${i.id}')">Use generic</button>`:''}</div></div>`:''}${typeof asmGapNote==='function'?asmGapNote(i):''}${wardFieldsEnd(i)}</section>`;
  // the photo tools stay beside the photos: one row when there is nothing to edit yet, else folded under "Edit photos"
  const photos=phEdit.crop?'':i.photo||i.texture?`<div class="ivph${phEdit.open?' open':''}" id="ivph"><button type="button" class="ivphbtn" onclick="togglePhotoTools()" aria-expanded="${!!phEdit.open}" aria-controls="ivphp">Edit photos<svg class="ivchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="ivphp" id="ivphp"><div>${photoTools(i)}</div></div></div>`:`<div class="ivph bare">${photoTools(i)}</div>`;
  const rot=`<section class="card ivsec ivrot"><h3>Rotation</h3>${i.paused?(i.order?`<div class="rotnote ordrow"><p class="shelp">On the way: it isn't in your outfits yet.</p><label class="ordate">Arrives (optional) <input type="date" value="${i.arrives||''}" onchange="setItemArrives('${i.id}',this.value)"></label><small class="mut ordhint">${orderHint(i.arrives)}</small></div>`:i.away?'<p class="shelp rotnote">Away being cleaned: it is out of your outfits until it is back (see Care below).</p>':'<p class="shelp rotnote">Out of rotation: the planner won\'t pick it, and it isn\'t offered when you change a piece. Outfits you already wore keep it.</p>'):'<p class="shelp">In rotation: the planner picks it for your outfits.</p>'}
  ${i.away?'':`<div class="btns"><button class="rotbtn${i.paused?' on':''}" onclick="togglePause('${i.id}')" aria-pressed="${!!i.paused}">${i.paused?(i.order?'It arrived: put in rotation':'Put back in rotation'):'Take out of rotation'}</button></div>`}</section>${typeof careCard==='function'?careCard(i):''}`;
  return `<div class="ivin">${hero}${photos}${tags}${rot}<div class="ivdel"><button class="danger" onclick="rm('${i.id}')">Delete item</button></div></div>`;
}
async function sete(id,k,v){
  const it=items.find(x=>x.id===id);if(!it)return;
  it[k]=v==='none'?null:v;
  if(k==='shoeStyle'&&!leathersFor(it).includes(it.leather))it.leather='calf';   // a sneaker can't be cordovan: back to plain leather
  if(k==='type'){it.pattern=normPat(v,it.pattern);shirtColFix(it);if(v==='watch'&&!it.metal)it.metal='silver';if((v==='shoes'||v==='belt')&&!it.leather)it.leather='calf';if(v==='belt'&&!it.metal)it.metal='silver'}
  if(k==='primaryColor')delete it.color;
  if((k==='primaryColor'||k==='type')&&it.swSrc==='tex')await refreshSwatch(it);   // the close-up swatch takes its lightness from the colour
  await put(it);cache={};renderWardrobe();
}
function patSummary(i){
  if(usableSett(i))return settSummary(i.sett);
  if(i.sett&&i.sett.tex)return `generic (the weave texture read earlier is for a ${TEX_WORDS[i.sett.tex.kind]||'woven'} pattern)`;
  if(i.sett)return `generic (an older reading drew these ${patName(i.pattern).toLowerCase()} figures as stripes; Read pattern from photo reads them as figures)`;
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
  if(!st){tell('Could not find a clear repeating pattern in the photo. Adding it again with the fabric in the middle of the picture usually works.');return}
  it.stripes=st;await put(it);cache={};renderWardrobe();
}
/* take an item out of rotation, or put it back. Taking it out also lets go of the upcoming days it was pinned to (a swap or a
   hand pick), so those days are planned again without it; past days and days marked worn keep it. */
async function setItemArrives(id,v){const it=items.find(x=>x.id===id);if(!it)return;if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))it.arrives=v;else delete it.arrives;await put(it);cache={};
  if(await checkArrivals())return renderWardrobe();renderWardrobe()}
async function togglePause(id){const it=items.find(x=>x.id===id);if(!it)return;it.paused=!it.paused;if(!it.paused){delete it.paused;delete it.order;delete it.arrives}
  let n=0;if(it.paused){const T=todayDate();
    for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<T||r.worn===true||!r.force)continue;const f={...r.force};let hit=false;
      for(const [s,v] of Object.entries(f))if(v===id){delete f[s];hit=true}
      if(hit){const nr={...r,force:f};if(!Object.keys(f).length)delete nr.force;delete nr.ids;await saveDay(nr,true);n++}}}
  await put(it);cache={};renderWardrobe();
  toast(it.paused?`Out of rotation: the planner won't pick it${n?`, and ${n} upcoming day${n===1?' was':'s were'} planned again without it`:''}.`:'Back in rotation.')}
async function clearStripes(id){const it=items.find(x=>x.id===id);if(!it)return;delete it.stripes;delete it.sett;await put(it);cache={};renderWardrobe()}
async function rm(id){return wardDelete(id)}   // at once, with Undo in a toast (wardrobe.js)

/* the plan for a month. Every month from two months back shares one simulation (kept in the cache, so anything that clears
   the cache starts it again): another month only plans the days not planned yet. Earlier months are built on their own. */
let cache={};
function planMonth(y,m){const k=y+'-'+m;if(cache[k])return cache[k];
  if(window.TEST_PLAN)return cache[k]=TEST_PLAN.plan(y,m);   // tests that don't need the planner (tests/fixedplan.js)
  const start=planStart(y,m),T=todayDate();
  if(+start!==+planStart(T.getFullYear(),T.getMonth()))return cache[k]=buildPlan(y,m);
  return cache[k]=(cache.sim||(cache.sim=planSim(start))).upTo(new Date(y,m+1,0))}
const planFor=()=>planMonth(view.y,view.m);

/* views */
const hasOutfit=o=>!!o&&!!(o.top||o.shirt);   // a day without a jacket (the no-jacket occasion) still has an outfit
const canPick=o=>!o.frozen||pastEdit===key(sel);   // a past day only while it is being corrected
const vestRow=o=>!(o.suitDay&&hasVest(o.top))?'':`<div class="row vest-row"><span class="mut">Vest</span>${o.vest?`<span class="dot">${swatchSVG(o.top,true)}</span><span class="cap">Matching vest</span>`:'<span class="mut none">Not today</span>'}${!canPick(o)?'':`<button class="swap" onclick="setVest(${!o.vest})" aria-label="${o.vest?'Leave off the vest':'Wear the vest'}" title="${o.vest?'Leave off the vest':'Wear the vest'}">${o.vest?'−':'+'}</button>`}</div>`;
/* the outfit list: tapping a piece's swatch or name unfolds its photo inside the list (the actual item, so you can see
   exactly which shirt it is); one at a time; items without a photo show their product picture or drawing */
let openRow=null;
const rowPic=i=>i.photo?`<img class="rpic" src="${i.photo}" alt="Photo of ${esc(desc(i)||nm(i))}">`:itemPic(i)?`<img class="rpic" src="${itemPic(i).img}" alt="Picture of ${esc(desc(i)||nm(i))}">`:`<div class="rpic draw">${itemThumb(i,true)}</div>`;
const rowPanel=i=>rowPic(i)+(i.photo?'':`<small class="mut rnote">No photo of this item yet${itemPic(i)?': a generated picture of it.':': this is how the app draws it.'}</small>`);
const slots=o=>{const nj=!o.top&&!needsJacket(o),nt=!o.tie&&!needsTie(o)&&!(o.frozen&&pastEdit===key(sel));const rows=([...(nj?[]:[[o.suitDay?'Suit':'Blazer',o.top,'top']]),...(o.suitDay?[]:[['Pants',o.bot,'bot']]),['Shirt',o.shirt,'shirt'],...(nt?[]:[['Tie',o.tie,'tie'],['Tie clip',o.clip,'clip']]),...(o.links||(o.shirt&&o.shirt.cuff==='french')?[['Cufflinks',o.links,'links']]:[]),['Watch',o.watch,'watch'],['Belt',o.belt,'belt'],['Socks',o.socks,'socks'],['Shoes',o.shoes,'shoes'],...(o.coat||(o.clim&&(o.clim.cold||o.clim.rain))?[[o.coat?TYPES[o.coat.type]:'Coat',o.coat,'coat']]:[])])
  .filter(([l,i,s])=>!(s==='clip'&&!i&&!(o.frozen&&pastEdit===key(sel))))   // no tie clip that day: no row (kept while correcting a past day, to add the one worn)
.map(([l,i,s])=>{const open=!!i&&openRow===s;
  return `<div class="ritem${open?' open instant':''}" id="ri-${s}"><div class="row"><span class="mut">${l}</span>${i?`<button class="rowtap" onclick="toggleRow('${s}')" aria-expanded="${open}" aria-controls="rp-${s}" aria-label="${l}: ${esc(itemTitle(i)||nm(i))}. ${open?'Hide':'Show'} the photo"><span class="dot">${swatchSVG(i,true)}</span><span class="${titleCls(i)}">${esc(itemTitle(i))}</span></button>${canPick(o)?`<button class="swap" onclick="openPicker('${s}')" aria-label="Change ${l.toLowerCase()}" title="Choose another">⇄</button>`:''}`:`<span class="mut none">${s==='clip'&&o.vest?'Not with the vest':o.frozen?'None':'Add one on the Add tab'}</span>${o.frozen&&canPick(o)?`<button class="swap" onclick="openPicker('${s}')" aria-label="Choose ${l.toLowerCase()}" title="Choose">⇄</button>`:''}`}</div>`+
    (i?`<div class="rpanel" id="rp-${s}"><div class="rpanel-in" onclick="toggleRow('${s}')">${open?rowPanel(i):''}</div></div>`:'')+`</div>`});
  rows.splice(nj?0:1,0,vestRow(o));return rows.join('')};
function toggleRow(s){const el=$('#ri-'+s),o=planFor()[key(sel)];if(!el||!o||!o[s])return;const opening=!el.classList.contains('open');
  // another open photo (a row, or the tile's photo above the list) shuts at once; one above the tapped row is made up for by the scroll, so the row stays under the finger
  document.querySelectorAll('.ritem.open').forEach(r=>{if(r!==el){picSnap(r,el);const b=r.querySelector('.rowtap');if(b)b.setAttribute('aria-expanded','false')}});
  if(opening)el.querySelector('.rpanel-in').innerHTML=rowPanel(o[s]);
  openRow=opening?s:null;const b=el.querySelector('.rowtap');b.setAttribute('aria-expanded',opening);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/(Show|Hide) the photo/,opening?'Hide the photo':'Show the photo'));
  if(opening)picOpenReady(el,el,()=>openRow===s);else{revealRun++;picShut(el)}}
/* A piece's photo (a row of the pieces list, or a tile's photo under the tiles) opens and shuts like the cards (boxUnfold/boxFold):
   the page is laid out once; the photo's own area is clipped open downward while what lies below it on the page slides down in step
   (picBelow: the rows after it, the cards under its card, the cards under the stage), and the card it is in (the pieces list) is
   clipped to its old edge and grows with it; the photo drops in with the days' bounce. Shutting is the same backwards: the photo
   lifts out with the days' dip, then the space closes. A row's running animations are kept on it (el._pa). */
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

/* ---- outfit history: freeze past days, swap pieces, record what was worn ---- */
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
let swapMsg='';
async function saveDay(rec,quiet){rec.updated=Date.now();dayRecs[rec.date]=rec;await txs('days','readwrite',s=>s.put(rec));cache={};if(!quiet&&window.scheduleSync)scheduleSync();if(typeof remindSoon==='function')remindSoon()}
/* remember what each day showed: past days become fixed, and today's record follows the screen until the day ends */
async function recordDays(p){
  const T=todayDate(),tk=key(T),mine=dayRecs;let changed=false;
  for(const [k,o] of Object.entries(p)){
    if(dayRecs!==mine)break;   // the history was replaced meanwhile (sync, restore): this plan is stale, record nothing more
    if(!SLOTS.some(s=>o[s])||o.frozen)continue;const d=keyDate(k);
    // a past day with no pieces recorded: none at all, or only the week's lock (lockUpcoming), as on a day the app was not opened;
    // recorded with what the record already has, else it never became history (no wear counts, an outfit that could still change)
    if(d<T&&!(dayRecs[k]&&dayRecs[k].ids)){await saveDay({...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest,auto:true},true);changed=true}
    else if(k===tk){const r=dayRecs[k],ids=idsOf(o);if(!r||JSON.stringify(r.ids)!==JSON.stringify(ids)||!!r.vestOn!==!!o.vest){await saveDay({...(r||{date:k}),ids,suitDay:o.suitDay,vestOn:!!o.vest},true);changed=true}}
  }
  if(changed&&window.scheduleSync)scheduleSync();
}
/* ---- the coming week stays as shown ----
   Each workday from today to LOCK_DAYS-1 days on gets rec.lock, the pieces the plan showed for it (not the coat: that follows the
   forecast). The planner keeps a locked day's pieces (planner.js, outfit()), so swapping today's tie, marking a day not worn or
   adding an item re-plans only the days after the lock, not tomorrow's outfit. A change made by hand on a day (a swap, a pick, an
   occasion, Reset, a move) drops that day's lock: the day is planned again around the change and locked as it then shows. */
const LOCK_DAYS=7,lockIds=o=>{const l=idsOf(o);delete l.coat;return l};
async function lockUpcoming(){
  if(!items.length)return;const T=todayDate(),mine=dayRecs;let n=0;
  for(let g=0;g<LOCK_DAYS;g++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+g);if(!isWorkday(d))continue;
    if(dayRecs!==mine)break;   // the history was replaced meanwhile (sync, restore)
    // the plan is read afresh for each day (it is cached; a change made while an earlier lock was being saved has reset it), and the lock
    // is put on the record before the write is awaited, so a lock never comes from a plan that is no longer the one on screen
    const k=key(d),o=planMonth(d.getFullYear(),d.getMonth())[k];if(!o||o.frozen||!SLOTS.some(s=>o[s]))continue;
    const r=dayRecs[k],l=lockIds(o);if(r&&r.lock&&JSON.stringify(r.lock)===JSON.stringify(l))continue;
    const rec={...(r||{date:k}),lock:l,updated:Date.now()};dayRecs[k]=rec;n++;   // the cached plan stays valid: the lock is what it shows
    await txs('days','readwrite',s=>s.put(rec))}
  if(n&&window.scheduleSync)scheduleSync()}
/* let the planner choose the days after today again (a setting that changes the plan, Re-plan, new planning rules) */
async function clearLocks(){const T=todayDate();let n=0;
  for(const r of Object.values(dayRecs))if(r.lock&&keyDate(r.date)>T&&r.worn!==true){const c={...r};delete c.lock;await saveDay(c,true);n++}
  if(n&&window.scheduleSync)scheduleSync();return n}
async function swapSlot(slot){
  const k=key(sel),o=planFor()[k];if(!o||o.frozen)return;
  const cur=o[slot]&&o[slot].id,pool=items.filter(i=>(slot==='coat'?i.type==='overcoat'||i.type==='raincoat':i.type===SLOT_TYPE(slot,o.suitDay))&&inRotation(i,di(sel)));
  if(pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to swap.`;renderToday();return}
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest};
  const skip={...(rec.skip||{})};skip[slot]=[...new Set([...(skip[slot]||[]),cur].filter(Boolean))];
  if(pool.every(i=>skip[slot].includes(i.id)))skip[slot]=[cur];       // tried them all: start the cycle again
  // keep the rest of the outfit; pieces that must follow the swapped one are re-picked
  const follow=FOLLOW[slot]||[];
  const force={};for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  rec.skip=skip;rec.force=force;delete rec.lock;swapMsg=learnFrom(slot,o,o[slot],null,false);await saveDay(rec);renderToday();
}
const FOLLOW={top:['bot','shirt','tie','shoes','belt','socks','watch','clip'],shoes:['belt','socks']};
/* ---- learning from changes (the votes are read by the planner, see planner.js) ----
   A piece swapped away votes against its pairing with the pieces that stayed (a shirt with the jacket and the tie, a tie
   with the jacket and the shirt, trousers or shoes with the jacket); a piece chosen by hand votes for its pairings. Pieces
   with no partner (a jacket, a belt, socks) get a vote of their own. Kept in the settings, so it syncs. */
const LEARN_PARTNERS={shirt:['top','tie'],tie:['top','shirt'],bot:['top'],shoes:['top']};
function learnVote(kind,k,d){const L=settings.learn={p:{...(settings.learn&&settings.learn.p)},i:{...(settings.learn&&settings.learn.i)}},m=L[kind];
  const v=Math.max(-LEARN_CAP,Math.min(LEARN_CAP,(m[k]||0)+d));if(v)m[k]=v;else delete m[k]}
function learnFrom(slot,o,oldIt,newIt,picked){
  const partners=(LEARN_PARTNERS[slot]||[]).map(s=>o[s]).filter(p=>p&&(!oldIt||p.id!==oldIt.id)&&(!newIt||p.id!==newIt.id));let down=false,up=false;
  if(oldIt&&(!newIt||oldIt.id!==newIt.id)){if(partners.length){for(const p of partners)learnVote('p',pairKey(oldIt,p),-1);down=true}else if(!picked){learnVote('i',oldIt.id,-1);down=true}}
  if(picked&&newIt){if(partners.length)for(const p of partners)learnVote('p',pairKey(newIt,p),1);else learnVote('i',newIt.id,1);up=true}
  if(!down&&!up)return '';
  settings.updated=Date.now();metaPut('settings',settings);cache={};
  return up?'Noted: the planner will reach for this choice more often.':'Noted: the planner will suggest that pairing less often.'}
/* ---- choosing a piece by hand: a sheet with every item for the slot, best match for the rest of the outfit first ---- */
let picker=null,pastEdit=null;
const slotPool=(slot,o)=>(slot==='coat'?items.filter(i=>i.type==='overcoat'||i.type==='raincoat'):slot==='top'&&o.frozen?items.filter(i=>i.type==='suit'||i.type==='blazer'):items.filter(i=>i.type===SLOT_TYPE(slot,o.suitDay))).filter(i=>o.frozen||inRotation(i,di(sel)));
/* how well a candidate suits the rest of the day's outfit (higher is better), by the planner's own rules */
function fitOf(slot,o,c){
  const day={formal:!!o.formal,clim:o.clim||dayClimate(sel),hasLinks:items.some(i=>i.type==='cufflinks')},suit=slot==='top'?c.type==='suit':o.suitDay,top=slot==='top'?c:o.top,bot=suit?top:slot==='bot'?c:o.bot,legs=suit?top:bot;
  switch(slot){
    case 'top':case 'bot':case 'shirt':case 'tie':return clothesScore(top,bot,slot==='shirt'?c:o.shirt,slot==='tie'?c:o.tie,suit,day)+(slot==='top'?seasonFit(c,day.clim.season)*2+(day.formal?formalTop(c)*2:0):0);
    case 'shoes':return legs?shoeScore(top,legs,c)+shoeFormality(c,suit):0;
    case 'belt':{const f=o.shoes?beltFit(o.shoes,c):0;return f===null?-60:f}
    case 'socks':return sockScore(legs,o.shoes,c,sockEcho(o.shirt,o.tie));
    case 'watch':return watchFit(c,o.shoes,o.belt);
    case 'clip':case 'links':return o.watch&&metalOf(c)!==null?(metalOf(c)===metalOf(o.watch)?6:-4):0}
  return 0}
const fitTag=gap=>gap<=.5?['best','Best match']:gap<=QWIN?['good','Good match']:gap<=18?['ok','Works']:['weak','Weak match'];
const pickPic=i=>i.photo?`<img src="${i.photo}" alt="">`:itemPic(i)?`<img src="${itemPic(i).img}" alt="">`:itemThumb(i,true);
function openPicker(slot){const o=planFor()[key(sel)];if(!o||!canPick(o))return;const pool=slotPool(slot,o),cur=o[slot]&&o[slot].id,label=slotLabel(slot,o).toLowerCase();
  if(!o.frozen&&pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to choose from.`;renderToday();return}
  const scored=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1)),best=scored.length?scored[0][0]:0;
  const card=([f,i])=>{const [cls,txt]=fitTag(best-f),on=i.id===cur;
    return `<button class="pick-it${on?' cur':''}" onclick="pickItem('${slot}','${i.id}')" aria-label="${esc(itemTitle(i)||nm(i))}: ${on?'wearing, ':''}${txt.toLowerCase()}"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span><span class="pick-nm ${titleCls(i)}">${esc(itemTitle(i)||sentence(nm(i)))}</span><small class="fit ${cls}">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}${txt}</small></button>`};
  const none=o.frozen&&slot!=='top'&&cur?`<button type="button" onclick="pickItem('${slot}','')">None: I didn't wear one</button>`:'';
  $('#pick-sheet').innerHTML=`<div class="pick-head"><b id="pick-title">${o.frozen?`What ${label} did you wear?`:`Choose ${aAn(label)}`}</b><button class="pick-x" onclick="closePicker()" aria-label="Close">×</button></div>
    <p class="mut"><small>${o.frozen?'Pick what you really wore on '+shortDate(sel)+'.':`Every ${label} you own, the best match for the rest of the outfit first.`}</small></p>
    ${!o.frozen||none?`<div class="btns">${o.frozen?none:`<button type="button" id="pick-next" onclick="pickNext()">Suggest another ↻</button>`}</div>`:''}
    <div class="pick-grid">${scored.map(card).join('')}</div>`;
  picker={slot};$('#pick-sheet').classList.add('on');$('#pick-backdrop').classList.add('on');$('#pick-sheet').scrollTop=0}
function closePicker(){picker=null;const s=$('#pick-sheet'),b=$('#pick-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on')}
function pickNext(){const s=picker&&picker.slot;closePicker();if(s)swapSlot(s)}
async function pickItem(slot,id){const k=key(sel),o=planFor()[k];if(!o)return;closePicker();
  const it=id?items.find(i=>i.id===id)||null:null;
  if(o.frozen)return correctPast(slot,it);
  if(!it||(o[slot]&&o[slot].id===id))return;
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=FOLLOW[slot]||[],force={};
  for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  force[slot]=id;const skip={...(rec.skip||{})};delete skip[slot];rec.force=force;rec.skip=skip;delete rec.lock;
  swapMsg=learnFrom(slot,o,o[slot],it,true);await saveDay(rec);renderToday()}
/* ---- correcting a past day: what was really worn replaces what was planned, so rest and "last worn" stay true ---- */
function togglePastEdit(){const k=key(sel);pastEdit=pastEdit===k?null:k;if(pastEdit)listOpen=true;swapMsg='';renderToday()}
async function correctPast(slot,it){const k=key(sel),r=dayRecs[k],o=planFor()[k];if(!r||!r.ids||!o||pastEdit!==k)return;
  const ids={...r.ids};let suitDay=!!r.suitDay;
  if(slot==='top'){if(!it)return;ids.top=it.id;if(it.type==='suit'){suitDay=true;ids.bot=it.id}else{if(suitDay||ids.bot===r.ids.top)ids.bot=null;suitDay=false}}
  else ids[slot]=it?it.id:null;
  const rec={...r,ids,suitDay,worn:true,edited:true};delete rec.auto;
  if(!suitDay||!hasVest(items.find(i=>i.id===ids.top)))rec.vestOn=false;
  swapMsg=it?learnFrom(slot,slot==='top'?{...o,top:null}:o,null,it,true)&&'Corrected. The planner counts what you really wore.':'Corrected.';
  await saveDay(rec);renderToday()}
const setFormal=(v,k)=>setOccasion(v?'formal':null,k);
/* give a day an occasion (or none): its swaps are dropped, since the outfit is chosen afresh for the occasion, and the coming days are
   released so they are planned around it (the suit that is right for the occasion may be locked on the day before) */
async function setOccasion(occ,k){k=k||key(sel);const r={...(dayRecs[k]||{date:k})};delete r.force;delete r.skip;delete r.vest;delete r.formal;delete r.occasion;delete r.lock;if(occ==='formal')r.formal=true;else if(occ)r.occasion=occ;if(k===key(sel))swapMsg='';await clearLocks();await saveDay(r);if(settingsOpen()){todayStale=true;renderFormalUI()}else renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.force;delete n.skip;delete n.worn;delete n.vest;delete n.lock;swapMsg='';await saveDay(n);renderToday()}
async function setWorn(v){const k=key(sel),o=planFor()[k];if(!o)return;const r=dayRecs[k]||{date:k};await saveDay({...r,ids:r.ids&&o.frozen?r.ids:idsOf(o),suitDay:o.suitDay,vestOn:o.frozen?!!r.vestOn:!!o.vest,worn:v});renderToday()}
/* clear what swaps and vest choices pinned on days after today, so the planner picks those days again; formal days stay */
async function replanFuture(){const T=todayDate();let n=0;
  for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<=T||r.worn===true)continue;
    const mine=r.force||r.skip||r.ids||typeof r.vest==='boolean'||r.vestOn!==undefined||r.auto;if(!mine&&!r.lock)continue;
    const keep={date:r.date};if(r.formal)keep.formal=true;if(r.occasion)keep.occasion=r.occasion;await saveDay(keep,true);if(mine)n++}
  cache={};swapMsg='';if(window.scheduleSync)scheduleSync();return n}
/* the planning rules changed since this wardrobe was last planned: re-plan the future once */
async function checkPlanRules(){if(!window.TEST_PLAN)return planRulesCheck()}   // (PLAN_RULES is read in planRulesCheck only: a bump selects only the tests that plan for real)
async function planRulesCheck(){if((settings.planRules||0)>=PLAN_RULES)return;const n=await replanFuture();
  settings.planRules=PLAN_RULES;await metaPut('settings',settings);   // kept without a new stamp: noting the rules is not a change to the settings, and a stamp made defaults win over the backup's settings
  if(n)setTimeout(()=>toast(`The planner was updated: upcoming days were planned again (${n} day${n===1?'':'s'} reset).`,4500),400)}
async function replanButton(){const T=todayDate();
  const n=Object.values(dayRecs).filter(r=>keyDate(r.date)>T&&r.worn!==true&&(r.force||r.skip||r.ids||typeof r.vest==='boolean')).length;
  const locked=Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>T&&r.worn!==true);
  if(!n&&!locked){renderReplanUI('Nothing to reset: every upcoming day follows the planner.');return}
  if(n&&!await askConfirm(`Undo the swaps on ${n} upcoming day${n===1?'':'s'}?\n\nThe planner chooses ${n===1?'that day':'those days'} again. Formal days, today and past days stay as they are.`,{ok:'Re-plan'}))return;
  const m=await replanFuture();renderReplanUI(m?`${m} day${m===1?'':'s'} planned again.`:'The coming days were planned again.');todayStale=true}
function renderReplanUI(msg){const el=$('#replan-status');if(!el)return;const T=todayDate();
  const n=Object.values(dayRecs).filter(r=>keyDate(r.date)>T&&r.worn!==true&&(r.force||r.skip||r.ids||typeof r.vest==='boolean')).length;
  el.textContent=msg||(n?`${n} upcoming day${n===1?' keeps':'s keep'} pieces from a swap.`:'Every upcoming day follows the planner.')+' The coming week stays as shown when something changes; re-plan to choose it again.'}
async function setVest(v){const k=key(sel),o=planFor()[k];if(!o)return;
  if(o.frozen){const r0=dayRecs[k];if(pastEdit!==k||!r0)return;await saveDay({...r0,vestOn:!!v,worn:true,edited:true});renderToday();return}
 const r={...(dayRecs[k]||{date:k})};r.vest=v;swapMsg='';await saveDay(r);renderToday()}
/* Reset: a card of its own under the month, like the other cards, on a day the user changed (a swap, a pick, the vest); it puts the
   planned outfit back */
function resetCard(o){return o&&!o.frozen&&(o.overrides||o.vestOverride)?`<section class="mbox resetbox" id="rbox"><button class="month-link resetlink" onclick="resetDay()" aria-label="Reset changes" title="Undo your changes to this day"><span class="rsicon" aria-hidden="true">↺</span><b>Reset</b></button></section>`:''}
function dayActions(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),past=d<T,isToday=+d===+T;
  let h='';
  // whether it was worn is marked on the picture (wornMarks)
  if(o.occasion)h+=`<span class="ftag" title="Set in Settings, Occasions" aria-label="${o.occasion==='formal'?'Formal day':'Occasion: '+occLabel(o.occasion)}">${o.occasion==='casual'?'No jacket':occLabel(o.occasion)}${o.occasion==='formal'?'<span class="fx"> day</span>':''}</span>`;
  if(past&&o.frozen)h+=`<button class="pastedit${pastEdit===key(sel)?' on':''}" onclick="togglePastEdit()" aria-pressed="${pastEdit===key(sel)}">${pastEdit===key(sel)?'Done':'Correct this day'}</button>`;
  return (h?`<div class="dayact">${h}</div>`:'')+(past&&o.frozen&&pastEdit===key(sel)?'<p class="mut"><small>Tap ⇄ beside a piece to set what you really wore. The planner then counts that, not what was planned.</small></p>':past&&o.frozen&&o.worn!==true?'<p class="mut"><small>Past day: kept as it was planned.</small></p>':'')+(swapMsg?`<p class="mut"><small>${swapMsg}</small></p>`:'');
}

/* outfit score card with an expandable breakdown */
let scoreOpen=false;
/* the score's advice for a day (planner.js, scoreAdvice): swaps that would raise it, the wardrobe's best with this jacket, and the
   checks nothing owned improves. Worked out once per outfit (kept until the day's pieces change); not for past or worn days */
let adviceMemo={k:'',v:null};
function adviceFor(o){if(!o||o.frozen||!hasOutfit(o))return null;const k=key(sel)+JSON.stringify(idsOf(o))+!!o.vest+items.length;
  if(adviceMemo.k!==k)adviceMemo={k,v:window.TEST_PLAN?TEST_PLAN.advice(o):scoreAdvice(o,slot=>slotPool(slot,o))};return adviceMemo.v}
function applyFix(slot,id){return pickItem(slot,id)}
function scoreCard(o){
  const r=window.TEST_PLAN?TEST_PLAN.rate(o):rateOutfit(o),tone=r.hard.length?'low':r.score>=80?'good':r.score>=65?'ok':'low',A=adviceFor(o);
  const sub=scoreOpen?'tap to fold away':'tap for why',fix=A&&A.fixes.length>0;
  const line=r.hard.length?`${r.hard.length} thing${r.hard.length===1?'':'s'} to put right`:fix&&A.best>r.score?`Could be ${A.best} with what you own`:A&&r.score<100?'The best your wardrobe allows':'Outfit score';
  const fixes=!fix?'':`<div class="sfix" onclick="event.stopPropagation()"><small>${r.hard.length?'These would put it right:':'Today\'s pieces were chosen for variety. These would score higher:'}</small>${A.fixes.map(f=>`<button type="button" class="sfixbtn" onclick="applyFix('${f.slot}','${f.item.id}')" aria-label="Wear the ${esc(desc(f.item)||nm(f.item))} ${esc(slotLabel(f.slot,o).toLowerCase())}: ${f.gain} more points"><span class="dot">${swatchSVG(f.item,true)}</span><span class="cap sfixnm">${sentence(desc(f.item)||nm(f.item))} <span class="mut">${slotLabel(f.slot,o).toLowerCase()}</span></span><b>+${f.gain}</b></button>`).join('')}</div>`;
  // unfolds like the pieces list and the month plan; each check slides in and its bar fills to the points it scored
  return `<section class="mbox score ${tone}${scoreOpen?' open instant':''}" id="sbox"><button class="month-link" onclick="toggleScore()" aria-expanded="${scoreOpen}" aria-controls="spanel" aria-label="Outfit score ${r.score}, ${r.label}. ${line}. ${scoreOpen?'Fold away':'Show why'}">
    <span class="num" aria-hidden="true">${r.score}</span><span class="lbl" aria-hidden="true"><b>${r.label}</b><small>${line} · ${sub}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="spanel"><div class="mpanel-in" onclick="toggleScore()">${fixes}<ul>${r.checks.map((c,n)=>`<li class="${c.pts===c.max?'ok':c.hard?'miss hard':'miss'}" style="--i:${n}"><span>${c.pts===c.max?'✓':c.hard?'!':'•'} ${c.label}</span><span class="pts">${c.pts}/${c.max}</span><span class="sbar" aria-hidden="true"><i style="--p:${c.max?Math.max(0,c.pts)/c.max:1}"></i></span>${c.why?`<small>${c.why}${A&&A.stuck.includes(c.label)?' <span class="lim">Nothing you own does better here.</span>':''}</small>`:''}</li>`).join('')}</ul>${r.hard.length?`<p class="scap">A real mistake keeps the score at ${HARD_CAP} or below, however well the rest matches.</p>`:''}</div></div></section>`;
}

/* the score box and the pieces list unfold and fold like the month (monthUnfold / monthFold): the page is laid out once and the card's
   edge (a strip, foldEdge) and what is under it slide; their own entry cascades (the checks and their bars, the pieces) still play.
   Folding is that cascade backwards: the last check or piece lifts out first (BOX_LIFT ms apart, styles.css .blift), the card closes
   once about half are gone. A box's running animations are kept on it (box._fa) so a tap in the middle finishes the last move. */
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
function toggleScore(){const box=$('#sbox');if(!box)return;scoreOpen=!scoreOpen;
  const b=box.querySelector('.month-link');b.setAttribute('aria-expanded',scoreOpen);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show why/,scoreOpen?'Fold away':'Show why'));
  const sm=box.querySelector('.lbl small');if(sm)sm.textContent='Outfit score · '+(scoreOpen?'tap to fold away':'tap for why');
  if(scoreOpen)boxUnfold(box);else{revealRun++;boxFold(box,'#spanel .sfix, #spanel li, #spanel .scap')}}
/* ---- month view (wear plan): a calendar of fabric stacks, from the design concept ---- */
/* stacked bands for one outfit: jacket, trousers on blazer days, shirt, tie (drawn from the tagged fabrics) */
let stkN=0;
function stackSVG(o,cls=''){
  const P='st'+(stkN++)+'-',parts=[[o.top,'top',22],...(!o.suitDay&&o.bot?[[o.bot,'bot',9]]:[]),[o.shirt,'shirt',9],[o.tie,'tie',9]].filter(x=>x[0]);
  const H=parts.reduce((h,x)=>h+x[2],0)+(parts.length-1)*2;let y=0;
  const body=parts.map(([i,role,h],k)=>{const id=P+k,r=`<rect y="${y}" width="40" height="${h}" rx="2.5" fill="url(#${id})"/><rect y="${y}" width="40" height="${h}" rx="2.5" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".6"/>`;y+=h+2;return `<defs>${fabricDef(id,i,role)}</defs>${r}`}).join('');
  return `<svg class="stack ${cls}" viewBox="0 0 40 ${H}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
const planOn=d=>planMonth(d.getFullYear(),d.getMonth())[key(d)];
const nextWorkday=d=>{const x=new Date(d);let g=0;do x.setDate(x.getDate()+1);while(!isWorkday(x)&&++g<7);return x};
const shortTop=o=>{const t=o.top;if(!t)return o.bot?(wearsJacket()?`No jacket: ${colName(primaryCol(o.bot))} trousers`:`${colName(primaryCol(o.bot))} trousers`.replace(/^./,c=>c.toUpperCase())):'No jacket';const p=t.pattern&&t.pattern!=='solid'&&t.pattern!=='other'?' '+patLabel(t.pattern):'',n=colName(primaryCol(t))+p;
  const s=n.charAt(0).toUpperCase()+n.slice(1);return o.suitDay?s:`${s} blazer${o.bot?' + '+colName(primaryCol(o.bot))+' trousers':''}`};
const tieWord=p=>({'polka-dot':'dot',stripe:'stripe',paisley:'paisley',check:'check',foulard:'foulard',knit:'knit'})[p]||'';
const shortRest=o=>[o.shirt&&colName(primaryCol(o.shirt))+' shirt',o.tie&&[colName(primaryCol(o.tie)),tieWord(o.tie.pattern),'tie'].filter(Boolean).join(' ')].filter(Boolean).join(' · ').replace(/^./,c=>c.toUpperCase());
/* the outfit in a few words, the same everywhere it is named in one line (Today's pieces card, sharing, the morning reminder):
   "navy suit · white shirt · burgundy stripe tie" (sentence() capitalises it where it starts a line) */
const piecesLine=o=>[o.top?`${colName(primaryCol(o.top))} ${o.suitDay?'suit':'blazer'}`:o.bot&&`${colName(primaryCol(o.bot))} trousers`,o.shirt&&`${colName(primaryCol(o.shirt))} shirt`,o.tie&&`${colName(primaryCol(o.tie))}${o.tie.pattern&&!['solid','other'].includes(o.tie.pattern)?' '+patLabel(o.tie.pattern):''} tie`].filter(Boolean).join(' · ');/* the month plan unfolds in place from the box on Today (no separate page) */
let monthOpen=false,monthPanel=null;
const monthPlan=planMonth;
function monthGridHtml(){
  const {y,m}=monthPanel,p=monthPlan(y,m),f=new Date(y,m,1),T=todayDate(),cells=[];let n=0;
  for(let k=0;k<f.getDay();k++)cells.push('<span class="mc blank"></span>');
  for(const d=new Date(f);d.getMonth()===m;d.setDate(d.getDate()+1)){const k=key(d),o=p[k],wd=isWorkday(d),off=offName(d),work=wd&&hasOutfit(o),isT=+d===+T,past=d<T;
    const label=`${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}: ${work?`${shortTop(o)}, ${shortRest(o)}`:wd?'no outfit recorded':off?'day off: '+off:'day off'}`;
    const mv=work&&!past&&!o.frozen&&!occOf(dayRecs[k]);   // a day whose outfit can be picked up and moved, or a day it can be dropped on
    cells.push(`<button class="mc ${!wd?'rest':past?'worn':'planned'}${off&&!wd?' hol':''}${isT?' today':''}${k===key(sel)?' sel':''}" style="--i:${n++}" data-k="${k}"${work?` data-sig="${mvSig(o)}"`:''}${mv?' data-mv="1"':''} aria-label="${esc(label)}" onclick="openDay(${d.getTime()})"><span class="dn">${d.getDate()}</span>${work?stackSVG(o):wd?'<span class="stack none"></span>':'<span class="stack rest"></span>'}</button>`)}
  // no arrows, hint or legend: a swipe (or a mouse drag) inside the box moves between months (monthDrag); the title is centred; the cells still
  // show worn / today / planned / rest by their own look
  return `<div class="mswipe" id="mswipe"><div class="mhead"><h3>${f.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3></div>
    <div class="mgrid mdow" aria-hidden="true">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="mgrid">${cells.join('')}</div></div>
    <button class="foldbar" onclick="toggleMonth()" aria-label="Fold away the month"><span class="fchev" aria-hidden="true">›</span>Fold away</button>`;
}
/* after a box unfolds: scroll down just far enough to show what opened, but never past the point where the tapped box
   (top: the tapped element, e.g. the tile row for a tile's photo) reaches the top of the screen. Follows the box while it
   grows, so the page moves with the unfolding; a touch or wheel by the user stops it. */
let revealRun=0;
/* how far to scroll so el shows above the tab bar, without the top of `top` going past the top of the screen (sat: the notch's inset) */
function revealNeed(el,top,sat){if(sat===undefined){const probe=document.createElement('div');probe.style.cssText='position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden';document.body.appendChild(probe);sat=parseFloat(getComputedStyle(probe).paddingTop)||0;probe.remove()}
  const nav=document.querySelector('body>nav'),bottom=(nav?nav.getBoundingClientRect().top:innerHeight)-12,need=el.getBoundingClientRect().bottom-bottom,cap=(top||el).getBoundingClientRect().top-(sat+8);return Math.max(0,Math.min(need,cap))}
function reveal(el,top){top=top||el;const run=++revealRun,t0=performance.now(),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const probe=document.createElement('div');probe.style.cssText='position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden';document.body.appendChild(probe);
  const sat=parseFloat(getComputedStyle(probe).paddingTop)||0;probe.remove();
  const stop=()=>{revealRun++;off()},off=()=>{removeEventListener('touchstart',stop);removeEventListener('wheel',stop)};
  addEventListener('touchstart',stop,{passive:true,once:true});addEventListener('wheel',stop,{passive:true,once:true});
  const want=()=>revealNeed(el,top,sat);
  const step=now=>{if(run!==revealRun)return;const d=want(),done=now-t0>(reduce?0:700);
    if(reduce||done){if(d>.5)scrollBy(0,d);off();return}
    if(d>.5)scrollBy(0,Math.max(1,d*.2));requestAnimationFrame(step)};
  requestAnimationFrame(step)}
function toggleMonth(){const box=$('#mbox');if(!box)return;monthOpen=!monthOpen;const pin=$('#mpanel-in');
  if(monthOpen){monthPanel={y:sel.getFullYear(),m:sel.getMonth()};monthFill();box.classList.remove('instant')}
  if(pin)pin.inert=!monthOpen;
  $('#mbox .month-link').setAttribute('aria-expanded',monthOpen);
  const sm=$('#mbox .mltxt small');if(sm)sm.textContent=sm.textContent.replace(/tap to .*/,monthOpen?'tap to fold away':'tap to see the month');
  if(monthOpen)monthUnfold(box);else{revealRun++;monthFold(box)}}
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
/* Unfolding and folding the month without animating its height: an animated height laid the page out and repainted every day's
   drawing on every frame (30 layouts and 285 paints for one unfold), which was choppy on a phone. The page is laid out once, at the
   start of an unfold or the end of a fold, and the movement is the card's edge sliding (a strip, foldEdge: a clip-path here was
   repainted every frame by Safari and drifted from the slides), a slide for whatever is below it and a fade of the days, all of which
   the GPU draws; the scroll is pageScroll's. */
const MONTH_MS=420;
const MONTH_EASE='cubic-bezier(.2,.8,.2,1)';
const MONTH_LIFT=8;   // ms between the days lifting out when the month folds
let monthAnim=null;   // {list: running animations, end: what finishing early must still do}
function monthStop(){const a=monthAnim;monthAnim=null;if(!a)return;for(const x of a.list)x.cancel();if(a.end)a.end()}
const monthBelow=box=>{const k=[...box.parentNode.children];return k.slice(k.indexOf(box)+1)};
function monthUnfold(box){monthStop();const pan=$('#mpanel'),pin=$('#mpanel-in');box.classList.remove('mshut');box.classList.add('mfast','open');
  const g=pan?pan.offsetHeight:0,d=revealNeed(box,box);
  if(noMotion()||!g){if(d>.5)scrollBy(0,d);return}
  const o={duration:MONTH_MS,easing:MONTH_EASE},c=foldEdge(box,g,0,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:`translateY(${-g}px)`},{transform:'none'}],o));
  if(pin)list.push(pin.animate([{opacity:0},{opacity:1}],{...o,duration:240,fill:'backwards'}));   // the title, weekdays and buttons fade in; the days drop in (.mdrop)
  monthDrop(box);
  const a=monthAnim={list,end:c.drop};list[0].finished.then(()=>{if(monthAnim===a){monthAnim=null;c.drop()}},()=>{});
  if(d>.5)pageScroll(scrollY+d,o.duration)}
function monthFold(box){monthStop();clearTimeout(monthDropT);box.classList.remove('mdrop');const pan=$('#mpanel'),pin=$('#mpanel-in'),g=pan?pan.offsetHeight:0;
  const close=()=>{box.classList.add('mfast');box.classList.remove('open','instant','mshut','mdrop','mlift')};
  if(noMotion()||!g||foldQuiet||!box.classList.contains('open')){close();keepInView(box);return}
  // the page gets shorter at the end: scroll now to where it can stay, so it doesn't jump then (and bring the card's top back into view)
  const top=box.getBoundingClientRect().top,max=Math.max(0,document.documentElement.scrollHeight-g-innerHeight);
  let want=top<8?scrollY+top-8:scrollY;want=Math.min(want,max);
  // the days lift out last first (styles.css .mlift, MONTH_LIFT ms apart, 280 ms each); the card starts closing once about half
  // of them are gone
  const n=box.querySelectorAll('.mc:not(.blank)').length,wait=Math.round((n*MONTH_LIFT+280)*.55);
  box.style.setProperty('--mn',n);box.classList.add('mfast','mshut','mlift');
  const o={duration:MONTH_MS-60,delay:wait,easing:MONTH_EASE,fill:'forwards'},c=foldEdge(box,0,g,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:'none'},{transform:`translateY(${-g}px)`}],o));
  if(want<scrollY-.5)pageScroll(want,o.duration,o.delay);
  if(pin)list.push(pin.animate([{opacity:1},{opacity:0}],{...o,delay:wait+Math.round((MONTH_MS-60)*.35),duration:200}));   // the title and weekdays, once the days are gone (a fade of the whole panel any earlier hid the days lifting out)
  const end=()=>{c.drop();if(scrollY>max)scrollTo(0,max);close()},a=monthAnim={list,end};
  list[0].finished.then(()=>{if(monthAnim!==a)return;monthAnim=null;end();for(const x of list)x.cancel()},()=>{})}
/* the days drop in one after another while the box unfolds (styles.css .mdrop): the class stays only as long as that takes, so a
   month swiped to, a re-plan or a move doesn't play it again */
let monthDropT=0;
function monthDrop(box){clearTimeout(monthDropT);box.classList.remove('mdrop');void box.offsetWidth;box.classList.add('mdrop');
  const n=box.querySelectorAll('.mc:not(.blank)').length;monthDropT=setTimeout(()=>box.classList.remove('mdrop'),n*12+60+440+50)}
/* the month's days are put into the folded box while the app is idle (monthFillSoon, from monthLink), so a tap only unfolds it */
function monthFill(){const el=$('#mpanel-in');if(!el||!monthPanel)return;const sig=monthPanel.y+'-'+monthPanel.m+'|'+key(sel);
  if(el.dataset.fill===sig&&el.firstElementChild)return;el.innerHTML=monthGridHtml();el.dataset.fill=sig}
let monthFillT=0;
function monthFillSoon(){clearTimeout(monthFillT);monthFillT=setTimeout(()=>{
  const run=()=>{if(monthOpen||!$('#mpanel-in'))return;monthPanel={y:sel.getFullYear(),m:sel.getMonth()};monthFill()};
  if(window.requestIdleCallback)requestIdleCallback(run,{timeout:1500});else run()},600)}
function monthStep(n,from){let {y,m}=monthPanel;m+=n;if(m>11){m=0;y++}if(m<0){m=11;y--}monthPanel={y,m};const el=$('#mpanel-in');if(!el)return;el.innerHTML=monthGridHtml();el.dataset.fill='';$('#mbox').classList.remove('mdrop');$('#mbox').classList.add('instant');
  const sw=$('#mswipe');if(!sw||!from||matchMedia('(prefers-reduced-motion: reduce)').matches)return;   // the new month slides in from the side it was swiped from
  sw.style.transition='none';sw.style.transform=`translateX(${from}px)`;sw.style.opacity='0';void sw.offsetWidth;
  sw.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sw.style.transform='translateX(0)';sw.style.opacity='1'}
/* a sideways drag inside the open month: the month follows the finger, and past 70 px (or a quick flick) the next or previous
   month slides in; anything shorter springs back. Shared by touch (the Today swipe handler hands it over) and the mouse. */
function monthDrag(dx){const sw=$('#mswipe');if(!sw)return;sw.style.transition='none';sw.style.transform=`translateX(${dx}px)`;sw.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth))}
function monthRelease(dx,ms){const sw=$('#mswipe');if(!sw)return false;const fast=Math.abs(dx)/Math.max(1,ms)>.5;
  if(Math.abs(dx)>70||(fast&&Math.abs(dx)>30)){const n=dx<0?1:-1,w=sw.offsetWidth||innerWidth;
    sw.style.transition='transform .16s ease-in,opacity .16s';sw.style.transform=`translateX(${dx<0?-w:w}px)`;sw.style.opacity='0';
    setTimeout(()=>monthStep(n,(dx<0?1:-1)*w*.6),160);return true}
  sw.style.transition='transform .2s ease-out,opacity .2s';sw.style.transform='translateX(0)';sw.style.opacity='1';return false}
function openDay(t){sel=new Date(t);view={y:sel.getFullYear(),m:sel.getMonth()};monthOpen=false;renderToday();scrollTo({top:0,behavior:'smooth'})}
/* the box on Today: the next few workdays as small stacks; tap it and the month unfolds below */
function monthLink(){
  const days=[];for(let d=new Date(sel),g=0;days.length<5&&g<14;g++,d.setDate(d.getDate()+1))if(isWorkday(d)){const o=planOn(d);if(hasOutfit(o))days.push([new Date(d),o])}
  const f=new Date(view.y,view.m,1),n=Object.keys(planFor()).filter(k=>{const d=keyDate(k);return d.getMonth()===view.m&&d.getFullYear()===view.y}).length;
  if(monthOpen&&!monthPanel)monthPanel={y:view.y,m:view.m};
  if(!monthOpen)monthFillSoon();
  return `<section class="mbox${monthOpen?' open instant':''}" id="mbox"><button class="month-link" onclick="toggleMonth()" aria-expanded="${monthOpen}" aria-controls="mpanel"><span class="mlstrip">${days.map(([d,o])=>`<span class="mli"><small>${d.toLocaleDateString(undefined,{weekday:'narrow'})}</small>${stackSVG(o)}</span>`).join('')}</span>
    <span class="mltxt"><b>${f.toLocaleDateString(undefined,{month:'long'})} wear plan</b><small>${n} outfit${n===1?'':'s'} · ${monthOpen?'tap to fold away':'tap to see the month'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="mpanel"><div class="mpanel-in" id="mpanel-in"${monthOpen?` data-fill="${monthPanel.y+'-'+monthPanel.m+'|'+key(sel)}">${monthGridHtml()}`:' inert>'}</div></div></section>`;
}

/* ---- Today figure: torso in the day's fabrics, tap targets, selected-piece card, below-the-waist tiles ---- */
/* a tile under the figure unfolds the item's photo below the tiles, like the pieces list; tap it again (or the photo) to fold it */
let belowOpen=null;
const slotLabel=(s,o)=>({top:o.suitDay?'Suit':'Blazer',bot:'Trousers',shirt:'Shirt',tie:'Tie',clip:'Tie clip',vest:'Vest',watch:'Watch',belt:'Belt',shoes:'Shoes',socks:'Socks',coat:o.coat?TYPES[o.coat.type]:'Coat',links:'Cufflinks'})[s]||s;
const belowBox=(o,below)=>{const i=below.some(([s])=>s===belowOpen)&&o[belowOpen];if(!i)belowOpen=null;
  return `<div class="ritem bbox${i?' open instant':''}" id="bbox"><div class="rpanel" id="bpanel"><div class="rpanel-in" onclick="pickPiece(belowOpen)">${i?rowPanel(i):''}</div></div></div>`};
/* did you wear it: ✗ and ✓ over the picture's bottom corners (today and past days); tapping the chosen one again clears it.
   Between them, a small pill says when this look was last worn (nothing when it never was). */
/* share the day's outfit: a round button at the picture's top right, like ✕ and ✓ (the owner chose this place). The phone's own
   share sheet gets the picture (the photo, or the drawing as a PNG) and a line naming the pieces; without a share sheet the line is
   copied. */
const SHARE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const shareMark=o=>o&&(o.top||o.shirt)?`<button type="button" class="wshare" onclick="shareOutfit()" aria-label="Share this outfit" title="Share this outfit">${SHARE_ICON}</button>`:'';
function shareText(o){const d=sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  return `${d}: ${sentence(piecesLine(o))}`}
async function shareOutfit(){const o=planFor()[key(sel)];if(!o)return;const text=shareText(o);let file=null;
  try{const r=renderFor(o),url=r&&r.img?r.img:await figurePng(o,780),blob=await (await fetch(url)).blob();
    file=new File([blob],`outfit-${key(sel)}.${/png/.test(blob.type)?'png':'jpg'}`,{type:blob.type})}catch(e){console.warn('share picture',e)}
  const data={title:'My outfit',text};if(file&&navigator.canShare&&navigator.canShare({files:[file]}))data.files=[file];
  if(navigator.share){try{await navigator.share(data)}catch(e){if(e&&e.name!=='AbortError')tell('Couldn’t share it.')}return}
  try{await navigator.clipboard.writeText(text);tell('The outfit is copied.')}catch{tell(text)}}
function wornMarks(o){return shareMark(o)+wornBar(o)}
function wornBar(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),can=+d<=+T,lw=lastWorn(o);
  const pill=lw?`<small class="lastworn">Last worn ${lw.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</small>`:'';
  if(!can)return pill?`<div class="wornbar">${pill}</div>`:'';
  return `<div class="wornbar" role="group" aria-label="Did you wear this outfit?"><button class="wmark no${o.worn===false?' on':''}" aria-pressed="${o.worn===false}" onclick="setWorn(${o.worn===false?'undefined':'false'})" aria-label="Didn't wear" title="Didn't wear">✕</button>${pill}<button class="wmark yes${o.worn===true?' on':''}" aria-pressed="${o.worn===true}" onclick="setWorn(${o.worn===true?'undefined':'true'})" aria-label="Wore this" title="Wore this">✓</button></div>`}
function figureStage(o){
  const below=[...(o.suitDay?[]:[['bot',o.bot]]),['belt',o.belt],['shoes',o.shoes],['socks',o.socks],...(o.coat?[['coat',o.coat]]:[])].filter(([,i])=>i);
  const tiles=below.map(([s,i])=>{const bg=itemPic(i)&&(picBgs[itemKey(i)]||PIC_BG);return `<button class="tile${s==='coat'?' coat-tile':''}${bg?' has-pic':''}" data-type="${i.type}"${bg?` style="background:${bg}"`:''}${s==='coat'?` data-coat="${i.type}"`:''} onclick="pickPiece('${s}')" aria-expanded="${belowOpen===s}" aria-controls="bpanel" aria-label="${slotLabel(s,o)}: ${desc(i)}. ${belowOpen===s?'Hide':'Show'} the photo">${itemPicHtml(i,itemThumb(i))}<small>${slotLabel(s,o)}</small></button>`}).join('');
  const r=renderFor(o),photo=!!r;
  setTimeout(()=>fetchRemoteRender(o,key(sel)),0);   // missing here: fetch it; only here: share it
  if(asmLive())setTimeout(()=>asmEnsure(o),0);   // and its item photos, to put the outfit's picture together here
  schedulePrefetch();   // and the rest of the month's photos, nearest first
  // a photo replaces the illustration. Today has no Generate button (the owner, 2026-11-13: pictures that cost money are made only
  // from Settings → This day's photo, "Regenerate photo"); a photo asked for there says here how it is getting on
  const ck=comboKey(o),pend=renderPending(o),fail=renderFail[ck],stalled=!pend&&renderStalled(ck);
  const msg=renderMsg.k===key(sel)&&renderMsg.t?renderMsg.t:pend?(rendering===ck?'Sending it…':'It is being made (about a minute). You can swipe to another day or close the app: it appears here when it’s ready.'):fail?`The photo couldn’t be made. ${/[.!?]$/.test(fail)?fail:fail+'.'}`:stalled?'This photo has been in the making for over 10 minutes, far longer than one takes. Regenerate photo in ⚙ Settings sends it again.':'';
  const ctl=`<p class="mut render-msg" id="render-msg">${pend?'<span class="spin" aria-hidden="true"></span>':''}${esc(msg)}</p>`;
  return (photo?`<div class="fig photo" id="mannequin-container"><img onload="fitNavSoon()" src="${r.img}" alt="Photo of ${esc(figureLabel(o))}">${wornMarks(o)}</div>`
    :`<div class="fig" id="mannequin-container">${figureSvg(o)}${wornMarks(o)}</div>`)+ctl+
    (tiles?`<div class="below" style="--n:${below.length}" aria-label="${o.coat?'Coat and below the waist':'Below the waist'}" role="group">${tiles}</div>`+belowBox(o,below):'');
}
/* ---- realistic photo: the figure + item photos -> worker /render (OpenAI image edit).
   Photos are saved per outfit combination, not per day: any day that wears the same pieces reuses the photo.
   The worker keeps a copy (KV) so every device can show it. ---- */
let renders={},rendering=false,renderMsg={k:'',t:''},renderFail={};   // rendering: an outfit being sent (or, on a worker without a queue, made) now; renderMsg: a note for one day; renderFail: why a queued photo failed, per combination
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const figureLabel=o=>[o.top,o.shirt,o.tie,o.clip,o.watch].filter(Boolean).map(i=>nm(i)).join(', ');
/* the combination a photo shows: which pieces, and everything about them that changes how they look */
/* Which look a photo shows. The shirt counts only by its base colour (any white shirt shares the photo made with another
   white shirt); the jacket, tie, clip and watch count by how they look (colours, pattern, metal, dial), not by which item it
   is, so identical items share too. */
const LOOK_FIELDS=['primaryColor','secondaryColor','tertiaryColor','pattern','metal','dial','band','bezel','watchStyle'];
/* how one piece looks, for photo keys: a shirt by its colour (and its pattern or read texture), anything else by its look fields, details and read pattern */
const lookSig=(s,i)=>s==='shirt'?'shirt/'+primaryCol(i)+(shirtPatterned(i)?'/'+i.pattern+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:''):shirtTextured(i)?'/tex/'+settSig(i.sett):''):[i.type,...LOOK_FIELDS.map(f=>i[f]??'')].join('/')+(i.details?'/'+i.details:'')+(i.sett?'/'+settSig(i.sett):'')+(i.patternText?'/'+i.patternText:'');
const comboSig=o=>(o.vest?'vest|':'')+(!o.top&&o.bot?'nojacket/'+[o.bot.type,...LOOK_FIELDS.map(f=>o.bot[f]??'')].join('/')+'|':'')+['top','shirt','tie','clip','watch'].map(s=>o[s]?lookSig(s,o[s]):'-').join('|');
const fnvMemo=new Map();   // the same looks are hashed over and over (every render, every history record): remember them
const fnv64=t=>{let v=fnvMemo.get(t);if(v)return v;let h=0xcbf29ce484222325n;for(const c of new TextEncoder().encode(t)){h^=BigInt(c);h=(h*0x100000001b3n)&0xffffffffffffffffn}
  v=h.toString(16).padStart(16,'0');if(fnvMemo.size>4000)fnvMemo.clear();fnvMemo.set(t,v);return v};
const comboKey=o=>'c'+fnv64(comboSig(o));
/* the key photos were saved under before shirts counted by colour only; moved over on first use */
const comboSigV1=o=>(o.vest?'vest|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];return i?[i.id,...LOOK_FIELDS.map(f=>i[f]??''),i.cuff??'',i.stripes?JSON.stringify(i.stripes):''].join('/'):'-'}).join('|');
const comboKeyV1=o=>'c'+fnv64(comboSigV1(o));
const figSig=comboSig;
/* photos saved before combinations were used were keyed by date with this signature; they are moved over on first use */
const legacySig=o=>(o.vest?'vest|':'')+['top','shirt','tie','clip','watch'].map(s=>{const i=o[s];return i?[i.id,i.primaryColor,i.secondaryColor,i.tertiaryColor,i.pattern,i.metal,i.updated||0].join('/'):'-'}).join('|');
async function keepRender(ck,rec,share){renders[ck]=rec;await metaPut('render:'+ck,rec);if(share)shareRender(ck,rec)}
const workerBase=()=>{const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');return w&&tok?{url:new URL('render',w.replace(/\/*$/,'/')).href,tok}:null};
function shareRender(ck,rec){const W=workerBase();if(W)fetch(W.url,{method:'PUT',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({key:ck,rec})}).catch(()=>{})}
// assembled pictures (assemble.js) are in use: ASM_ON, which a test switches off unless it tests them; nothing of assemble.js is
// called while they are off, so a change there selects only the tests that use them
const asmLive=()=>typeof ASM_ON!=='undefined'&&ASM_ON;
const renderFor=o=>{const a=asmLive()&&asmFor(o);if(a)return a;   // put together on the device from item photos (assemble.js)
  const ck=comboKey(o);if(renders[ck])return renders[ck];
  const v1=renders[comboKeyV1(o)];if(v1){const rec={...v1,sig:comboSig(o)};keepRender(ck,rec,true);return rec}
  const old=renders[key(sel)];if(old&&old.sig===legacySig(o)){const rec={...old,sig:comboSig(o)};keepRender(ck,rec,true);return rec}
  return null};
/* a combination with no photo here: ask the worker (another device may have made it); one with a photo only here: share it */
const renderTried=new Set();
async function fetchRemoteRender(o,day){
  const W=workerBase(),ck=comboKey(o);if(!W||renderTried.has(ck)||rendering)return;renderTried.add(ck);
  try{
    const get=async q=>{const r=await fetch(W.url+'?'+q,{headers:{'x-app-token':W.tok},cache:'no-store'});return r.ok?r.json():null};
    const cur=renders[ck];if(cur&&remoteKeys&&remoteKeys.has(ck))return;   // here and on the worker already: nothing to do
    let j=await get('key='+ck);
    if(!j){if(cur){shareRender(ck,cur);return}
      // a photo the worker kept under the earlier combination key, or for this date before combinations were used
      const v1=await get('key='+comboKeyV1(o));if(v1&&v1.img)j={...v1,sig:comboSig(o),legacy:true};
      else{const old=await get('day='+encodeURIComponent(day));if(old&&old.img&&old.sig===legacySig(o))j={...old,sig:comboSig(o),legacy:true}}}
    if(!j||!j.img)return;
    if(cur&&cur.t>(j.t||0)){shareRender(ck,cur);return}if(cur&&cur.t===(j.t||0))return;
    await keepRender(ck,{sig:comboSig(o),img:keptPhoto(j.img),model:j.model||'',t:j.t||Date.now()},!!j.legacy);
    if(planFor()[key(sel)]&&comboKey(planFor()[key(sel)])===ck&&!$('#today').hidden)refreshToday();
  }catch(e){console.warn('remote photo unavailable',e)}
}
/* photos the worker keeps that this device lacks (a new install, or made on another device): download the ones the plan needs
   for the month on screen and the next, nearest the selected day first, so swiping between days shows them at once */
let prefetching=false,prefetchAgain=false,remoteKeys=null;
const planOf=planMonth;
async function prefetchRenders(){const W=workerBase();if(!W)return;if(prefetching){prefetchAgain=true;return}prefetching=true;
  try{
    if(!remoteKeys){const r=await fetch(W.url+'?list=1',{headers:{'x-app-token':W.tok},cache:'no-store'});const j=r.ok?await r.json().catch(()=>null):null;if(!j||!Array.isArray(j.keys)){remoteKeys=new Set();return}remoteKeys=new Set(j.keys)}   // no list: fetch per day as before
    do{prefetchAgain=false;const c=+sel,near=new Map();   // each combination ranked by its day closest to the one on screen
      for(const [y,m] of [[view.y,view.m],[view.m===11?view.y+1:view.y,(view.m+1)%12]])for(const [k,o] of Object.entries(planOf(y,m))){if(!hasOutfit(o))continue;
        const ck=comboKey(o);if(renders[ck]||!remoteKeys.has(ck)||renderTried.has(ck))continue;const d=Math.abs(+keyDate(k)-c),cur=near.get(ck);if(!cur||d<cur[0])near.set(ck,[d,ck,o])}
      const list=[...near.values()].sort((a,b)=>a[0]-b[0]);let i=0;
      const one=async()=>{while(i<list.length&&!prefetchAgain){const [,ck,o]=list[i++];if(renders[ck])continue;
        try{const r=await fetch(W.url+'?key='+ck,{headers:{'x-app-token':W.tok},cache:'no-store'});const j=r.ok?await r.json().catch(()=>null):null;
          if(!j||!j.img){remoteKeys.delete(ck);continue}
          await keepRender(ck,{sig:comboSig(o),img:keptPhoto(j.img),model:j.model||'',t:j.t||Date.now()},false);
          const s=planFor()[key(sel)];if(s&&comboKey(s)===ck&&!$('#today').hidden)refreshToday()}catch(e){remoteKeys.delete(ck)}}};
      await Promise.all([one(),one(),one()]);
    }while(prefetchAgain)
  }catch(e){console.warn('photo prefetch failed',e)}finally{prefetching=false}}
let prefetchTimer=0;const schedulePrefetch=()=>{clearTimeout(prefetchTimer);prefetchTimer=setTimeout(prefetchRenders,250)};
async function loadRenders(){try{const all=await txs('meta','readonly',s=>s.getAll());renders={};for(const x of all||[])if(String(x.k).startsWith('render:'))renders[x.k.slice(7)]=x.v}catch(e){console.warn(e)}}
/* a metal as words for the photo prompt: 'other' (a dark grey metal) reads as gunmetal */
const metalWord=i=>({gold:'gold',other:'gunmetal'})[i&&i.metal]||'silver';
/* a tie clip is named by its colour (no metal field): "silver", "rose gold", "black" (enamel) */
const clipWord=i=>colName(primaryCol(i));
/* a striped or checked shirt shows in the photo (a plain or finely woven one counts by its colour alone) */
const shirtPatterned=i=>!!i&&([...STRIPE_PATS,...CHECK_PATS,'houndstooth'].includes(patBase(i.pattern))||!!(usableSett(i)||{}).motif);
/* a shirt whose weave texture was read (dobby diamonds, herringbone…): it gets its own photo, described and drawn for the generator */
const shirtTextured=i=>!!i&&!shirtPatterned(i)&&!!(usableSett(i)||{}).tex;
const shirtTexText=i=>`a ${colName(primaryCol(i))} dress shirt woven with a fine, subtle tone-on-tone ${TEX_WORDS[i.sett.tex.kind]||'woven texture'} (the texture is in the weave itself, one colour, faint but visible up close; not stripes, checks or a print)`;
function outfitText(o){
  const pt=(i,role)=>{const t=patternPrompt(i,role);return t?` (${t})`:''};   // the pattern measured and described (tagging.js)
  const parts=[o.top&&`a ${nm(o.top)}${pt(o.top,'top')}`,o.shirt&&(shirtPatterned(o.shirt)?`a ${colName(primaryCol(o.shirt))} ${patName(o.shirt.pattern)} dress shirt${pt(o.shirt,'shirt')}`:shirtTextured(o.shirt)?shirtTexText(o.shirt):`a plain ${colName(primaryCol(o.shirt))} dress shirt`)+(o.top?(o.tie?'':', worn with the collar open and the top button undone, with no tie'):`, tucked in, ${o.tie?'':'the collar open with no tie, '}no jacket`),!o.top&&o.bot&&`${nm(o.bot)}${pt(o.bot,'bot')} with a leather belt`,o.vest&&`a matching five-button waistcoat (vest) in the same fabric as the suit, buttoned, its V opening visible above the jacket button`,o.tie&&`a ${nm(o.tie)}${pt(o.tie,'tie')}`,o.clip&&`a ${clipWord(o.clip)} tie bar`,
    o.watch&&watchText(o.watch,{worn:true}),o.links&&`${metalWord(o.links)} cufflinks`];
  return prettyCols(parts.filter(Boolean).join('; '));
}
/* draw the figure SVG onto a canvas and return a PNG data URL. With a jacket the picture is the square FIG_CROP of the drawing
   (viewBox units): the shoulders fill its width and it ends just under the pocket flaps, the close framing the photo generator
   copies (sent whole, 390x400, it came back zoomed out, down to the hips). A no-jacket day keeps the whole drawing */
const FIG_CROP={x:11,y:0,s:368};
async function figurePng(o,w=780){
  const crop=o&&o.top?FIG_CROP:null,k=crop?w/crop.s:w/390,W=Math.round(390*k),H=Math.round(400*k);
  // the watch's face on the drawing is its own photo's dial (as the dial reference is cut), turned as worn in figure.js
  const wp=o&&o.watch&&(o.watch.photo||(itemPic(o.watch)||{}).img),face=wp&&typeof dialCrop==='function'?await dialCrop(wp):null;
  const svg=figureSvg(o,'r-',{photo:true,face}).replace('width="100%"',`width="${W}" height="${H}"`).replace('style="display:block;height:auto"','');
  return new Promise((ok,no)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=crop?w:H;const x=c.getContext('2d');
    x.fillStyle=figBg();x.fillRect(0,0,c.width,c.height);x.drawImage(im,crop?-crop.x*k:0,crop?-crop.y*k:0,W,H);ok(c.toDataURL('image/png'))};im.onerror=()=>no(new Error('could not draw the illustration'));
    im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
}
/* an outfit photo is kept on the device as the worker made it: shrunk to 900px (JPEG .85) it was softer than the 1024 original, and
   Today shows it up to 390 points wide on a 3x screen (1170 pixels) and zooms 2.5x. Assembled pictures keep their 900px (assemble.js):
   their kept zones were measured at that size */
const keptPhoto=u=>u;
const shrinkUrl=(u,max,q=.85)=>new Promise(ok=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',q))};im.onerror=()=>ok(u);im.src=u});
/* generate and keep the photo for one outfit; throws with a readable message */
/* reference photos for an outfit photo, each labelled: the jacket and tie photos, and the watch's own photo or its product
   picture (no shirt photo: an outfit photo is shared by every shirt of that colour). A tie with a close-up goes without its
   photo (the owner's choice after a trial: the close-up and the pattern drawing carry the tie, and its place goes to the
   shirt's close-up); a tie without one keeps its photo, its only picture */
function outfitRefs(o){const refs=[],labels=[];const add=(img,l)=>{if(img){refs.push(img);labels.push(l)}};
  const tex=(i,what)=>add(i&&i.texture,`a close-up of the ${what} fabric (match its exact colour and weave)`);   // a fabric close-up, when the item has one
  const top=o.suitDay?'suit':'blazer';add(o.top&&o.top.photo,'the '+top);tex(o.top,top);
  if(!o.top){add(o.bot&&o.bot.photo,'the trousers');tex(o.bot,'trouser')}tex(o.shirt,'shirt');if(!(o.tie&&o.tie.texture))add(o.tie&&o.tie.photo,'the tie');tex(o.tie,'tie');
  // the owner's own photo of the watch first: a product picture is the generator's redrawing, and its dial's details are already lost
  if(o.watch)add(o.watch.photo||(itemPic(o.watch)||{}).img,'the wristwatch (copy it exactly: case shape, bezel, dial layout and subdials, numerals, hands, bracelet links)');
  return {refs,labels}}
async function renderCombo(o){
  const w=localStorage.getItem('worker_url'),tok=localStorage.getItem('app_token');
  if(!w||!tok)throw new Error('Connect in ⚙ Settings first.');
  const image=await figurePng(o);
  const {refs,labels}=await outfitRefsFull(o);
  const r=await fetch(new URL('render',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},body:JSON.stringify({image,refs,labels,outfit:outfitText(o),key:comboKey(o),sig:comboSig(o),...(o.top?{}:{nojacket:true})})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error((r.status===404||r.status===405)?'The server doesn’t support photos yet: it needs an update.':(j.message||j.error||`HTTP ${r.status}`));
  const rec={sig:comboSig(o),img:keptPhoto(j.image),model:j.model||'',t:Date.now()};
  await keepRender(comboKey(o),rec,false);   // the worker already kept a copy
  return rec;
}
/* Generate or Regenerate (Settings → This day's photo; there is no month batch any more) the shown day's photo. It goes to the worker's background queue,
   so the app can be swiped to another day, closed or locked: the worker makes it and the app picks it up when it next looks
   (every 20 s while open, and on opening). Only a worker without the queue makes it while the app waits. */
const renderPending=o=>{const ck=o&&comboKey(o);return !!ck&&(rendering===ck||(queuedKeys().includes(ck)&&!renderStalled(ck))||(asmLive()&&asmPending(o)))};
/* a photo waiting over 10 minutes has stalled (one takes about a minute; retries a few more): the button offers to send it again */
const STALL_MS=10*60000,renderStalled=ck=>{const q=rqGet();return q.keys.includes(ck)&&Date.now()-sentAt(q,ck)>STALL_MS};
async function generateRender(){
  const o=planFor()[key(sel)];if(!o||rendering||renderPending(o))return;
  const day=key(sel),ck=comboKey(o),replace=!!renderFor(o);rendering=ck;delete renderFail[ck];renderMsg={k:day,t:''};renderToday();renderRegenUI();
  // an outfit that is put together from item photos needs only its missing items made (a Regenerate still makes a whole photo)
  try{const q=!replace&&asmLive()&&asmWants(o)?await asmQueueOutfit(o):await queueCombo(o,replace);
    if(q==='queued'){const s=rqGet();s.keys=[...new Set([...s.keys,ck])];s.total=(s.total||0)+1;s.sentAt=Date.now();s.at={...(s.at||{}),[ck]:s.sentAt};s.failed=s.failed||[];rqSet(s);startQueueWatch()}
    else if(q==='noqueue'){renderMsg={k:day,t:'This takes about 30–90 seconds. Keep the app open until it is done.'};renderToday();await renderCombo(o);renderMsg={k:'',t:''}}}
  catch(e){renderMsg={k:day,t:/Connect in|server doesn|Today’s limit/.test(e.message)?e.message:'Couldn’t send the photo: '+(e.message||e)}}
  finally{rendering=false;if(key(sel)===day&&!$('#today').hidden)refreshToday();renderRegenUI()}
}
/* when this look (same suit, tie, clip, watch, vest; any shirt of the same colour) was last worn, before the shown day.
   Only days marked ✓ count: a past day nobody marked was only planned, and "Last worn" on it said more than anyone knew */
function lastWorn(o){
  const ck=comboKey(o),T=todayDate(),lim=Math.min(+keyDate(key(sel)),+T);let best=null;
  for(const r of Object.values(dayRecs)){if(!r.ids||r.worn!==true)continue;const d=keyDate(r.date);if(+d>=lim||(best&&d<=best))continue;
    const get=id=>id&&items.find(i=>i.id===id)||null,x={suitDay:!!r.suitDay,top:get(r.ids.top),bot:get(r.ids.bot),shirt:get(r.ids.shirt),tie:get(r.ids.tie),clip:get(r.ids.clip),watch:get(r.ids.watch),vest:!!r.vestOn};
    if([x.top,x.shirt,x.tie].some(i=>i&&(i.added||0)>+d+864e5))continue;   // dated before a piece was added: a warm-up day of the planner, never worn
    if((x.top||x.shirt)&&comboKey(x)===ck)best=d}
  return best;
}
/* ---- item pictures: product photos of shoes, belts, socks, trousers and coats for the tiles under the figure.
   Generated once per look (OpenAI, through the worker), kept like outfit photos and shared between devices. ---- */
const ITEM_PIC_TYPES=['shoes','belt','socks','pants','overcoat','raincoat','watch'];
const aAn=w=>(/^[aeiou]/i.test(w)?'an ':'a ')+w;
function itemDesc(i){const c=colName(primaryCol(i)),lea=patLabel(i.leather||'calf'),pat=i.pattern&&i.pattern!=='solid'&&i.pattern!=='other'?patLabel(i.pattern)+' ':'';
  switch(i.type){
    case 'shoes':{const st=shoeStyle(i);   // (an oxford's description is the one from before styles, so its picture is kept)
      if(st==='sneaker'){const m=i.leather==='canvas'?'canvas':i.leather==='knit'?'knit':i.leather==='suede'?'suede':'leather',sole=i.secondaryColor&&i.secondaryColor!=='none'?colName(i.secondaryColor):'white';
        return `a pair of ${c} ${m} low-top sneakers with ${aAn(sole)} rubber cupsole, side three-quarter view`}
      return st==='oxford'?`a pair of ${c} ${lea} leather cap-toe oxford dress shoes, side three-quarter view`:`a pair of ${c} ${lea} leather ${({derby:'derby dress shoes',loafer:'penny loafers',boot:'chelsea boots'})[st]}, side three-quarter view`}
    case 'belt':return `${aAn(c)} ${lea} leather dress belt, loosely coiled, with a polished ${i.metal==='gold'?'gold':i.metal==='other'?'gunmetal':'silver'} buckle`;
    case 'socks':{const t=sockToe(i);return `a single ${c} ${pat}fine-knit mid-calf dress sock in side profile, as if on an invisible leg: the cuff at the top, the leg straight down, the heel at the lower left and the foot pointing to the right, smooth fine gauge with a soft sheen${t?`, with a ${colName(t)} knitted toe cap over the toes (only the toe, the heel stays ${c})`:', the toe and heel the same colour as the rest'}`}
    case 'pants':{const k=trouserKind(i);return k==='jeans'?`a pair of ${c} denim jeans, neatly folded`:k==='chinos'?`a pair of ${c} ${pat}cotton chinos, neatly folded`:`a pair of ${c} ${pat}${primaryCol(i)==='khaki'?'cotton twill':'wool'} dress trousers, neatly folded`}
    case 'overcoat':return `${aAn(c)} wool overcoat on an invisible mannequin`;
    case 'raincoat':return `${aAn(c)} trench coat on an invisible mannequin`;
    case 'watch':return `${watchText(i)}, three-quarter view, standing upright on a display cushion, the bracelet closed`}
  return ''}
const itemKey=i=>'c'+fnv64('item|'+itemDesc(i));
const itemPic=i=>i&&ITEM_PIC_TYPES.includes(i.type)&&renders[itemKey(i)]||null;
/* the colour of a product photo's backdrop (the average of its outer edge), so a tile wider than the photo is filled to match;
   the picture's edges are feathered (CSS mask) so there is no visible seam */
const picBgs={},PIC_BG='rgb(220,215,210)';   // the generated photos' backdrops average about this; used until a real reading
/* WebKit (iOS Safari) can hand back blank pixels when an <img> is drawn right at onload, so read from a decoded copy and
   accept only a full-alpha, light result (the backdrops are light grey); anything else keeps PIC_BG */
async function readPicBg(src){try{const im=new Image();im.src=src;await im.decode();const N=16,c=document.createElement('canvas');c.width=c.height=N;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,N,N);const d=x.getImageData(0,0,N,N).data,s=[0,0,0,0];let n=0;
    for(let y=0;y<N;y++)for(let X=0;X<N;X++)if(y===0||X===0||y===N-1||X===N-1){const o=(y*N+X)*4;for(let j=0;j<4;j++)s[j]+=d[o+j];n++}
    const [r,g,b,a]=s.map(v=>Math.round(v/n));return a>=250&&r*.3+g*.59+b*.11>=150?`rgb(${r},${g},${b})`:null}catch{return null}}
/* product photos made on a pure white backdrop (the old sock prompt) glare next to the warm-grey ones: tone the white down to
   PIC_BG (bright pixels are multiplied by it, dark ones kept, so the item and its soft shadow stay). Returns a new data URL,
   or null when the photo's edge isn't near white */
async function greyBackdrop(src){try{const im=new Image();im.src=src;await im.decode();const W=im.naturalWidth,H=im.naturalHeight;if(!W||!H)return null;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
    const D=x.getImageData(0,0,W,H),d=D.data,lum=o=>d[o]*.3+d[o+1]*.59+d[o+2]*.11;let s=0,n=0;
    for(let X=0;X<W;X+=4){s+=lum(X*4)+lum(((H-1)*W+X)*4);n+=2}for(let Y=0;Y<H;Y+=4){s+=lum(Y*W*4)+lum((Y*W+W-1)*4);n+=2}
    if(s/n<240)return null;
    const bg=PIC_BG.match(/\d+/g).map(v=>+v/255);
    for(let o=0;o<d.length;o+=4){const l=lum(o),t=l<=150?0:l>=245?1:((l-150)/95)**2;for(let j=0;j<3;j++)d[o+j]=Math.round(d[o+j]*(1-t+t*bg[j]))}
    x.putImageData(D,0,0);return c.toDataURL('image/jpeg',.88)}catch{return null}}
const itemImg=async u=>{const s=await shrinkUrl(u,400);return await greyBackdrop(s)||s};
/* once per kept product photo: tone down a white backdrop saved before the prompt changed */
async function fixItemBackdrops(){let n=0;for(const [k,r] of Object.entries(renders))if(r&&r.sig==='item'&&!r.grey){const g=await greyBackdrop(r.img);
    await keepRender(k,{...r,...(g?{img:g}:{}),grey:1},false);if(g){n++;delete picBgs[k]}}return n}
function picBg(img,k){if(picBgs[k]!==undefined)return;picBgs[k]=null;
  readPicBg(img.src).then(c=>{if(!c)return;picBgs[k]=c;document.querySelectorAll(`img.item-pic[data-k="${k}"]`).forEach(i=>{const t=i.closest('.tile');if(t)t.style.background=c})})}
const itemPicHtml=(i,fallback)=>{const p=itemPic(i);if(p)return `<img class="item-pic" src="${p.img}" alt="" data-k="${itemKey(i)}" onload="picBg(this,'${itemKey(i)}')">`;if(i&&ITEM_PIC_TYPES.includes(i.type))setTimeout(()=>fetchItemPic(i),0);return fallback};
async function fetchItemPic(i){const W=workerBase(),k=itemKey(i);if(!W||renderTried.has(k)||renders[k])return;renderTried.add(k);
  try{const r=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});if(!r.ok)return;const j=await r.json();if(!j||!j.img)return;
    await keepRender(k,{sig:'item',img:await itemImg(j.img),model:j.model||'',t:j.t||Date.now(),grey:1},false);if(!$('#today').hidden)refreshToday();else if(!$('#wardrobe').hidden&&!phEdit.crop)renderWardrobe()}catch(e){console.warn('item picture unavailable',e)}}
async function renderItemPic(i){
  const W=workerBase();if(!W)throw new Error('Connect in ⚙ Settings first.');
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'item',item:itemDesc(i),key:itemKey(i),...(i.photo?{ref:i.photo}:{})})});   // the item's own photo, when there is one, is the model to copy
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||j.error||`HTTP ${r.status}`);
  await keepRender(itemKey(i),{sig:'item',img:await itemImg(j.image),model:j.model||'',t:Date.now(),grey:1},false);
}
const missingItemPics=()=>{const seen=new Set();return items.filter(i=>{if(!ITEM_PIC_TYPES.includes(i.type))return false;const k=itemKey(i);if(seen.has(k)||renders[k])return false;seen.add(k);return true})};
let itemBatch=false;
function renderItemPicUI(){const b=$('#itempic-btn');if(!b||itemBatch)return;const n=missingItemPics().length;
  b.textContent=n?`Generate ${n} item picture${n===1?'':'s'}`:'Every shoe, belt and sock has a picture';b.disabled=!n;if(typeof needConn==='function')needConn(b)}
async function startItemPics(){if(itemBatch)return;const todo=missingItemPics();if(!todo.length)return;
  if(!await askConfirm(`Generate ${todo.length} product picture${todo.length===1?'':'s'}?\n\nFor your shoes, belts, socks, trousers and coats.${showCost()?` About $${(todo.length*.05).toFixed(2)} at roughly 5¢ each.`:''}`,{ok:'Generate'}))return;
  itemBatch=true;const st=$('#itempic-status'),b=$('#itempic-btn');let done=0,fail=0,err='';
  for(const i of todo){if(st)st.textContent=`Generating ${done+fail+1} of ${todo.length}…`;if(b)b.disabled=true;
    try{renderTried.delete(itemKey(i));await fetchItemPic(i);if(!renders[itemKey(i)])await renderItemPic(i);done++}catch(e){fail++;err=e.message;if(/Connect in|OPENAI_API_KEY|forbidden|Today’s limit/i.test(err))break}}
  itemBatch=false;if(st)st.textContent=`Done: ${done} picture${done===1?'':'s'} ready${fail?`, ${fail} failed (${err})`:''}`;renderItemPicUI();if(!$('#today').hidden)refreshToday()}
/* ---- background photos (worker queue): send one outfit's inputs; the worker makes the photo later ---- */
async function queueCombo(o,replace=false){
  const W=workerBase();if(!W)throw new Error('Connect in ⚙ Settings first.');
  const image=await figurePng(o),{refs,labels}=await outfitRefsFull(o),ck=comboKey(o);
  const r=await fetch(W.url,{method:'POST',headers:{'content-type':'application/json','x-app-token':W.tok},body:JSON.stringify({mode:'queue',image,refs,labels,outfit:outfitText(o),key:ck,sig:comboSig(o),...(o.top?{}:{nojacket:true}),...(replace?{replace:true}:{})})});
  const j=await r.json().catch(()=>({}));
  if(r.ok&&j.queued)return 'queued';
  if(r.ok&&j.exists){renderTried.delete(ck);await fetchRemoteRender(o,'');return renders[ck]?'done':'queued'}
  if(r.ok&&j.image){await keepRender(ck,{sig:comboSig(o),img:keptPhoto(j.image),model:j.model||'',t:Date.now()},false);return 'done'}   // an older worker made it right away
  if(r.status===501||r.status===404||r.status===405)return 'noqueue';
  throw new Error(j.message||j.error||`HTTP ${r.status}`)}
const RQ='render_queue';
const rqGet=()=>{try{const q=JSON.parse(localStorage.getItem(RQ)||'{}');return {keys:[],failed:[],...q}}catch{return {keys:[],failed:[]}}};
const rqSet=q=>{try{q.keys.length?localStorage.setItem(RQ,JSON.stringify(q)):localStorage.removeItem(RQ)}catch{}renderBusy()};
const queuedKeys=()=>rqGet().keys;
/* ask the worker how the queued photos are doing and bring the finished ones home */
let rqTimer=null,rqBusy=false;
async function checkQueue(){const q=rqGet(),W=workerBase();if(!q.keys.length||!W||rqBusy)return;rqBusy=true;const removed=new Set(),newFail=[],fresh={};
  // by key: the worker reads each one, no KV list (lists are capped per day)
  try{const r=await fetch(W.url+'-queue?keys='+q.keys.slice(0,40).join(','),{headers:{'x-app-token':W.tok},cache:'no-store'});const st=await r.json().catch(()=>null);if(!r.ok||!st)return;
    const pend=new Set(st.pending||[]),fail=Object.fromEntries((st.failed||[]).map(f=>[f.key,f.error]));let got=0,shown=false;
    for(const k of [...q.keys]){
      if(pend.has(k)){const run=st.running&&st.running[k];if(run&&run.at>sentAt(q,k))fresh[k]=run.at;continue}   // the worker started it again: wait afresh
      if(fail[k]){newFail.push(fail[k]);renderFail[k]=fail[k];shown=true;removed.add(k);continue}
      const g=await fetch(W.url+'?key='+k,{headers:{'x-app-token':W.tok},cache:'no-store'});const j=g.ok?await g.json().catch(()=>null):null;
      if(j&&j.img){await keepRender(k,{sig:j.sig||'',img:keptPhoto(j.img),model:j.model||'',t:j.t||Date.now()},false);got++;removed.add(k);
        const o=planFor()[key(sel)];if(o&&comboKey(o)===k)shown=true}
      else if(!g.ok&&g.status!==404)continue;
      else if(Date.now()-sentAt(q,k)>LOST_MS)removed.add(k)}   // neither waiting, failed nor finished for a long time: lost (expired), stop waiting for it
      // (a job just sent can be missing from the worker's list for up to a minute: KV lists are only eventually consistent)
    // applied to the list as it is now: a push may have taken some meanwhile, and new photos may have been sent
    const q2=rqGet();q2.keys=q2.keys.filter(k=>!removed.has(k));if(Object.keys(fresh).length)q2.at={...(q2.at||{}),...fresh};if(q2.at)for(const k of removed)delete q2.at[k];q2.failed=[...(q2.failed||[]),...newFail];finishQueueMsg(q2);
    rqSet(q2);renderRegenUI();if((shown||removed.size)&&!$('#today').hidden)refreshToday();
  }catch(e){console.warn('queue check failed',e)}finally{rqBusy=false}}
/* Bringing photos home. The worker pushes: while photos are waiting and the app is on screen, a request to GET /render-wait is held
   open, and the worker answers it the moment a queue job finishes, with the photo itself (waitPush). Polling GET /render-queue
   stays as the backup (a worker without the push, a dropped connection), timed by what a photo takes: none is ready within 40 s
   of sending, so the first look is then; after that every 7 s, every 20 s after 3 minutes (a month batch) and every minute after 15. */
/* when each photo was sent (rqGet().at), and how long one may go unseen before it counts as lost: the queue retries a failing
   photo for several minutes and a month batch makes two at a time, so 45 minutes */
const LOST_MS=45*60000,sentAt=(q,k)=>(q.at&&q.at[k])||q.sentAt||0;
const queueDelay=age=>age<40000?40000-age:age<300000?20000:60000;   // the push brings photos the moment they're made; polling is only the backup
function scheduleQueueCheck(){clearTimeout(rqTimer);rqTimer=null;const q=rqGet();if(!q.keys.length)return;
  rqTimer=setTimeout(async()=>{rqTimer=null;if(document.visibilityState==='visible')await checkQueue();scheduleQueueCheck()},Math.max(1000,queueDelay(Date.now()-(q.sentAt||0))))}
function startQueueWatch(){renderBusy();scheduleQueueCheck();waitPush()}
function stopQueueWatch(){clearTimeout(rqTimer);rqTimer=null}
let PUSH_WAIT=90000,pushOn=false,noPush=false;
async function waitPush(){const W=workerBase(),keys=queuedKeys();if(pushOn||noPush||!W||!keys.length||document.visibilityState!=='visible')return;pushOn=true;let pause=0;
  try{const r=await fetch(W.url+'-wait?keys='+keys.join(',')+'&ms='+PUSH_WAIT,{headers:{'x-app-token':W.tok},cache:'no-store'});
    if(r.status===501||(r.status>=400&&r.status<500)){noPush=true;return}   // an older worker without the push (or no access): polling only
    const res=r.ok?await r.json().catch(()=>[]):[];if(!r.ok)pause=5000;if(Array.isArray(res)&&res.length)await takeQueued(res)}
  catch{pause=5000}   // the connection dropped (the app went to the background): look again shortly
  finally{pushOn=false}
  if(pause)await new Promise(ok=>setTimeout(ok,pause));waitPush()}
/* finished (or failed) queued photos, from the push or from polling */
async function takeQueued(res){res=(res||[]).filter(m=>m&&m.key);if(!res.length)return;
  // every finished photo is kept, even one the app had stopped waiting for: it is for an outfit the user asked for
  for(const m of res)if(m.rec&&m.rec.img)await keepRender(m.key,{sig:m.rec.sig||'',img:keptPhoto(m.rec.img),model:m.rec.model||'',t:m.rec.t||Date.now()},false);
  const q=rqGet(),mine=new Set(q.keys);for(const m of res){if(!mine.has(m.key))continue;if(!m.rec&&m.error){q.failed.push(m.error);renderFail[m.key]=m.error}q.keys=q.keys.filter(k=>k!==m.key)}
  finishQueueMsg(q);rqSet(q);renderRegenUI();if(!$('#today').hidden)refreshToday()}
function finishQueueMsg(q){const done=(q.total||0)-q.keys.length-q.failed.length;
  q.msg=q.keys.length?`Making photos: ${done} of ${q.total} done. You can close the app; they appear as they finish.`
    :`All ${done} photo${done===1?'':'s'} ready${q.failed.length?`; ${q.failed.length} failed (${q.failed[q.failed.length-1]})`:''}.`;
  if(!q.keys.length)stopQueueWatch()}
let dayShown=null;   // the calendar day the app last drew, and whether it was showing "today's" outfit then
function newDayCheck(){const T=todayDate(),tk=key(T);if(!dayShown){dayShown={k:tk,home:true};return}
  if(dayShown.k===tk)return;const home=dayShown.home;dayShown={k:tk,home:true};cache={};checkArrivals().then(n=>{if(n&&!$('#today').hidden)refreshToday()});
  if(home){const h=homeDay();sel=new Date(h);view={y:h.getFullYear(),m:h.getMonth()};monthOpen=false}
  if(!$('#today').hidden)refreshToday()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;if(queuedKeys().length){checkQueue();startQueueWatch()}
  newDayCheck();try{const c=JSON.parse(localStorage.getItem('wx')||'null');if(settings.location&&(!c||Date.now()-c.t>3*3600e3))loadWeather()}catch{}
  remoteKeys=null;schedulePrefetch()});   // photos made on another device meanwhile
function pickPiece(s){const o=planFor()[key(sel)],el=$('#bbox');if(!o||!el||!s||!o[s])return;const opening=belowOpen!==s,was=el.classList.contains('open');
  belowOpen=opening?s:null;
  document.querySelectorAll('.below .tile').forEach(t=>{const on=opening&&t.getAttribute('onclick')===`pickPiece('${s}')`;t.setAttribute('aria-expanded',on);
    t.setAttribute('aria-label',t.getAttribute('aria-label').replace(/(Show|Hide) the photo/,on?'Hide the photo':'Show the photo'))});
  const inn=el.querySelector('.rpanel-in');
  if(opening&&was){picStop(el);inn.innerHTML=rowPanel(o[s]);if(!noMotion())inn.animate([{opacity:0},{opacity:1}],{duration:200});return}   // another tile while one is open: its photo takes the place
  if(opening){inn.innerHTML=rowPanel(o[s]);picOpenReady(el,$('.below'),()=>belowOpen===s)}else{revealRun++;picShut(el)}}
/* ---- back to today: the day to return to is today, or the next workday when today is off ---- */
const homeDay=()=>{const T=todayDate();return isWorkday(T)?T:nextWorkday(T)};
const todayBtn=()=>{const h=homeDay();if(key(sel)===key(h))return '';const isT=+h===+todayDate();
  return `<button class="gotoday" onclick="goToday()" aria-label="${isT?"Back to today's outfit":'Go to the next outfit'}">${isT?'↩ Today':'↩ Next outfit'}</button>`};
function goToday(){const h=homeDay();sel=new Date(h);view={y:h.getFullYear(),m:h.getMonth()};monthOpen=false;show('today');scrollTo({top:0,behavior:'smooth'})}
/* ---- the day's pieces: a folded box (a strip of fabric chips, like the month box) that unfolds into the full list ---- */
let listOpen=false;
function piecesBox(o){
  const pcs=[['top',o.top],['vest',o.vest?o.top:null],['bot',o.suitDay?null:o.bot],['shirt',o.shirt],['tie',o.tie],['clip',o.clip],['links',o.links],['watch',o.watch],['belt',o.belt],['socks',o.socks],['shoes',o.shoes],['coat',o.coat]].filter(([,i])=>i);
  const chips=pcs.map(([s,i])=>`<span class="pchip${s==='vest'?' vest':''}" title="${slotLabel(s,o)}: ${esc(s==='vest'?'matching vest':desc(i)||nm(i))}">${swatchSVG(i,true)}</span>`).join('');
  const sum=piecesLine(o);
  return `<section class="mbox ibox${listOpen?' open instant':''}" id="ibox"><button class="month-link" onclick="toggleList()" aria-expanded="${listOpen}" aria-controls="ipanel" aria-label="Outfit pieces: ${pcs.length}. ${listOpen?'Fold away':'Show the list'}">
    <span class="pstrip" aria-hidden="true" style="--pc:${pcs.length<=6?pcs.length:Math.ceil(pcs.length/2)}">${chips}</span><span class="mltxt"><b>${pcs.length} piece${pcs.length===1?'':'s'}</b><small class="cap">${sentence(sum)||'Tap to see the list'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="ipanel"><div class="mpanel-in" onclick="foldListTap(event)"><div class="list">${slots(o)}</div></div></div></section>`}
/* a tap inside the open pieces list that is not on a button, a link or a photo (e.g. on the names on the left) folds the list */
function foldListTap(e){if(!listOpen||e.target.closest('button,a,input,select,label,.rpanel'))return;toggleList()}
/* folding a box whose top is above the screen (folded from its bottom): bring the card back into view */
function keepInView(box){if(foldQuiet)return;const r=box.getBoundingClientRect();if(r.top<8)scrollBy({top:r.top-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
function toggleList(){const box=$('#ibox');if(!box)return;listOpen=!listOpen;
  const b=$('#ibox .month-link');b.setAttribute('aria-expanded',listOpen);b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show the list/,listOpen?'Fold away':'Show the list'));
  if(listOpen)boxUnfold(box);else{revealRun++;boxFold(box,'#ipanel .list>*')}}
function renderToday(){
  closeSettings();if(pastEdit&&pastEdit!==key(sel))pastEdit=null;if(picker)closePicker();dayShown={k:key(todayDate()),home:key(sel)===key(homeDay())};
  const p=planFor();
  const o=p[key(sel)]||{suitDay:true,top:null,bot:null,shirt:null,tie:null,shoes:null,belt:null,socks:null,watch:null,clip:null};
  const nav=`<div class="nav day"><button onclick="stepDay(-1)" aria-label="Previous day">‹</button><h2><span class="dlong">${sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><span class="dshort">${sel.toLocaleDateString(undefined,{weekday:'short',month:'long',day:'numeric'})}</span><small class="wx">${settings.location?(wxChip(sel)||''):'<a href="#" onclick="openSettings(\'weather\');return false">Set your location for weather</a>'}${todayBtn()}</small></h2><button onclick="stepDay(1)" aria-label="Next day">›</button></div>`;
  // only the stage (the figure) slides on a swipe; the date bar and the item list stay put and just update
  let stage='',side='';const first=typeof setupToday==='function'?setupToday():'';   // what is still needed for a first outfit (setup.js)
  if(!isWorkday(sel))stage=first+(offName(sel)&&settings.workdays.includes(sel.getDay())?`<p class="mut empty">A day off: ${esc(offName(sel))}. You can change your days off in Settings.</p>`
    :`<p class="mut empty">${DAY_NAMES[sel.getDay()]} isn't a workday. You can change your workdays in Settings.</p>`);   // the checklist comes first on every day, above the figure or the day's note
  else if(!items.length||(first&&!hasOutfit(o)))stage=first||'<p class="mut empty">Your wardrobe is empty. Add photos on the Add tab to get an outfit.</p>';
  else{stage=first+figureStage(o);
    // the rest warning goes below the list so the list never shifts when it appears or disappears
    side=`${scoreCard(o)}${piecesBox(o)}${dayActions(o)}${(o.notes||[]).map(t=>`<p class="warn">${t}</p>`).join('')}${o.top&&o.top.rest<COOL?`<p class="warn">This ${o.suitDay?'suit':'blazer'} was worn ${o.top.rest} day${o.top.rest===1?'':'s'} ago. Add more ${o.suitDay?'suits':'blazers'} to get a ${COOL}-day rest.</p>`:''}${typeof careNote==='function'?careNote(o):''}`}
  $('#today').innerHTML=nav+`<div class="daygrid"><div class="stage" id="stage"><div class="slide" id="slide">${stage}</div></div><div class="side">${side}${items.length?monthLink()+resetCard(isWorkday(sel)?o:null):''}</div></div>`;applyZoom(false);fitNavSoon();
  if(items.length){recordDays(p).then(lockUpcoming);
  }
}

/* a swipe to another day folds whatever is open (score, pieces list and its rows, a below-the-waist photo, the month) and zooms
   the picture back out: it starts as soon as the drag is known to be sideways, so the boxes fold while the day slides */
let foldQuiet=false;
function foldAll(){foldQuiet=true;try{if(openRow)toggleRow(openRow);if(belowOpen)pickPiece(belowOpen);if(scoreOpen)toggleScore();if(listOpen)toggleList();if(monthOpen)toggleMonth()}
  catch(e){console.warn(e)}finally{foldQuiet=false}scoreOpen=listOpen=monthOpen=false;belowOpen=openRow=null;zoomOut()}
/* ---- double-tap the Today picture (the photo, or the drawing) to zoom in on the tie and shirt, again to zoom back out; while
   zoomed, a drag pans it (and doesn't change the day). 2.5x: the outfit photo is 1024 px square and fills about 390 px on a phone,
   so 2.5x shows it at about its own resolution (any more is only blur), with a collar, tie knot or shirt front filling the frame. ---- */
const ZOOM=2.5;let zoom=null,zoomPan=null,lastTap=null,zoomTouchAt=0;
const zoomTarget=()=>{const c=$('#mannequin-container');return c&&c.querySelector(':scope > img, :scope > svg')};
function applyZoom(anim){const c=$('#mannequin-container'),t=zoomTarget();if(!c||!t)return;const on=!!zoom&&zoom.k===key(sel);if(!on)zoom=null;
  c.classList.toggle('zoomed',on);t.style.transformOrigin='0 0';t.style.transition=anim&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'transform .28s cubic-bezier(.2,.8,.2,1)':'none';
  t.style.transform=on?`translate(${zoom.x.toFixed(1)}px,${zoom.y.toFixed(1)}px) scale(${ZOOM})`:''}
function clampZoom(){const c=$('#mannequin-container');if(!c||!zoom)return;const W=c.clientWidth,H=c.clientHeight;   // the frame, which the picture fills (an <svg> has no offsetWidth)
  zoom.x=Math.min(0,Math.max(W*(1-ZOOM),zoom.x));zoom.y=Math.min(0,Math.max(H*(1-ZOOM),zoom.y))}
/* wherever it is tapped, it zooms in on the tie and the shirt: centred across, the top of the picture (the collar and the knot)
   at the top of the frame, as the owner asked; a drag then pans from there */
function toggleZoom(){const c=$('#mannequin-container'),t=zoomTarget();if(!c||!t)return;
  if(zoom)zoom=null;else{zoom={k:key(sel),x:c.clientWidth*(1-ZOOM)/2,y:0};clampZoom()}
  applyZoom(true)}
function zoomOut(){if(zoom){zoom=null;applyZoom(true)}}
(()=>{const el=$('#today'),inPic=e=>{const c=e.target.closest&&e.target.closest('#mannequin-container');return c&&!e.target.closest('button,a')?c:null};
  el.addEventListener('touchstart',e=>{const c=inPic(e);if(!c||e.touches.length>1){zoomPan=null;return}const t=e.touches[0];
    zoomPan={x0:t.clientX,y0:t.clientY,t:Date.now(),zx:zoom?zoom.x:0,zy:zoom?zoom.y:0,moved:false}},{passive:true});
  el.addEventListener('touchmove',e=>{if(!zoomPan)return;const t=e.touches[0],dx=t.clientX-zoomPan.x0,dy=t.clientY-zoomPan.y0;if(Math.abs(dx)>8||Math.abs(dy)>8)zoomPan.moved=true;
    if(!zoom)return;e.preventDefault();zoom.x=zoomPan.zx+dx;zoom.y=zoomPan.zy+dy;clampZoom();applyZoom(false)},{passive:false});
  el.addEventListener('touchend',e=>{const p=zoomPan;zoomPan=null;if(!p||p.moved||Date.now()-p.t>300){lastTap=null;return}const t=e.changedTouches[0],now=Date.now();
    if(lastTap&&now-lastTap.t<320&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<40){lastTap=null;zoomTouchAt=now;e.preventDefault();toggleZoom(t.clientX,t.clientY)}
    else lastTap={t:now,x:t.clientX,y:t.clientY}},{passive:false});
  el.addEventListener('dblclick',e=>{if(!inPic(e)||Date.now()-zoomTouchAt<700)return;e.preventDefault();toggleZoom(e.clientX,e.clientY)});
})();
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed */
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed.
   from: where the new day's outfit slides in from (px, sign = side); 0 = no animation */
function stepDay(n,from){
  const d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate());
  let g=0;do d.setDate(d.getDate()+n);while(!isWorkday(d)&&++g<7);
  foldAll();sel=d;view={y:d.getFullYear(),m:d.getMonth()};renderToday();
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
    // nor while the picture is zoomed: then a drag on it pans the picture
    // inside the open month a sideways drag changes the month instead (the day stays)
    st=e.touches.length>1||t.clientX<24||t.clientX>innerWidth-24||(zoom&&e.target.closest('#mannequin-container'))?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0,month:!!e.target.closest('#mpanel-in')};
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(outfitMove)st=null;if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8)){st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';if(st.lock==='x'&&!st.month)foldAll()}
    if(st.lock!=='x')return;
    e.preventDefault(); // horizontal drag is ours: no page pan, no zoom bounce
    if(st.month){st.dx=dx;monthDrag(dx);return}
    st.dx=dx;const sl=slide();if(sl){sl.style.transition='none';sl.style.transform=`translateX(${dx}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t,month}=st;st=null;if(month){if(lock==='x')monthRelease(dx,Date.now()-t);return}const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5;
    if(Math.abs(dx)>70||(fast&&Math.abs(dx)>30)){
      const n=dx<0?1:-1,w=sl.offsetWidth||innerWidth;
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepDay(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}
  };
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  // a mouse drag inside the open month does the same on a computer; the click that ends a drag doesn't open a day
  let md=null,noClick=false;
  el.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||!e.target.closest('#mpanel-in'))return;md={x:e.clientX,y:e.clientY,t:Date.now(),on:false}});
  addEventListener('pointermove',e=>{if(outfitMove)md=null;if(!md)return;const dx=e.clientX-md.x;if(!md.on&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(e.clientY-md.y))md.on=true;if(md.on){e.preventDefault();monthDrag(dx)}});
  addEventListener('pointerup',e=>{if(!md)return;const m=md;md=null;if(!m.on)return;noClick=true;setTimeout(()=>noClick=false,0);monthRelease(e.clientX-m.x,Date.now()-m.t)});
  el.addEventListener('click',e=>{if(noClick&&e.target.closest('#mpanel-in')){e.stopPropagation();e.preventDefault()}},true);
  document.addEventListener('keydown',e=>{if(el.hidden||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepDay(1);if(e.key==='ArrowLeft')stepDay(-1)});
})();

/* ---- moving an outfit to another day in the month: long-press a day (like an icon on an iPhone home screen), drag it over
   another day and the planner re-plans the month live as if the outfit were pinned there (the day it left is planned afresh, and
   every later day adjusts for rest and repeats); outfits that changed day slide from their old cell to their new one. Drop to
   keep it (the target day gets the outfit's pieces as pins, `kind` keeps it a suit or blazer day), drop anywhere else to cancel.
   Only today and later workdays that aren't worn and have no occasion take part. ---- */
let outfitMove=null;
const mvSig=o=>o?[o.top&&o.top.id,o.bot&&o.bot.id,o.shirt&&o.shirt.id,o.tie&&o.tie.id].join('|'):'';
const MOVE_HOLD=380,MOVE_SLOP=8;
function moveRecs(src,dst,plan){const o=(plan||planFor())[src];if(!o)return null;const ids=idsOf(o),force={};
  for(const [s,v] of Object.entries(ids))if(v&&s!=='coat')force[s]=v;   // the coat is the weather's choice
  const recs={...dayRecs},keep=r=>{const n={...(r||{})};delete n.force;delete n.skip;delete n.ids;delete n.vest;delete n.kind;delete n.auto;delete n.lock;return n};
  recs[dst]={...keep(dayRecs[dst]),date:dst,force,vest:!!o.vest,kind:o.suitDay?'suit':'blazer'};
  const s=keep(dayRecs[src]);if(Object.keys(s).filter(k=>k!=='date'&&k!=='updated').length)recs[src]={...s,date:src};else delete recs[src];
  return recs}
/* the month as it would be planned with these records (the real ones and the cache stay as they are) */
function planWith(recs,y,m){const keep=dayRecs;dayRecs=recs;try{return buildPlan(y,m)}finally{dayRecs=keep}}
/* put a plan into the grid: a cell whose outfit changed gets its new stack, sliding in from the cell that showed it before */
function showPlan(p){const grid=document.querySelector('#mpanel-in .mgrid:not(.mdow)');if(!grid)return;
  const cells=[...grid.querySelectorAll('.mc[data-k]')],was=new Map(),ease='cubic-bezier(.2,.8,.2,1)',still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const c of cells){const st=c.querySelector('.stack');if(c.dataset.sig&&st&&!was.has(c.dataset.sig))was.set(c.dataset.sig,st.getBoundingClientRect())}
  for(const c of cells){const o=p[c.dataset.k];if(!o||!hasOutfit(o))continue;const sg=mvSig(o);if(sg===c.dataset.sig)continue;
    const old=c.querySelector('.stack');if(!old)continue;const box=document.createElement('span');box.innerHTML=stackSVG(o);const nw=box.firstElementChild;
    // the lifted day's drawing may be what the finger is on: it stays in the page, hidden, or the browser stops sending that touch
    if(c.classList.contains('lifted')){old.classList.replace('stack','mv-held');old.after(nw)}else old.replaceWith(nw);c.dataset.sig=sg;
    if(still||!nw.animate)continue;const from=was.get(sg),to=nw.getBoundingClientRect();
    if(from)nw.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px)`,zIndex:3},{transform:'none',zIndex:3}],{duration:340,easing:ease});
    else nw.animate([{opacity:0,transform:'scale(.82)'},{opacity:1,transform:'none'}],{duration:260,easing:ease})}}
(()=>{const root=$('#today');let hold=null,mv=null,noClick=false;
  const cellAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&el.closest('#mpanel-in .mc[data-mv]')};
  const start=(cell,x,y)=>{clearTimeout(hold&&hold.t);hold={cell,x,y,t:setTimeout(()=>lift(cell,x,y),MOVE_HOLD)}};
  const cancelHold=()=>{if(hold){clearTimeout(hold.t);hold=null}};
  function lift(cell,x,y){hold=null;if(!monthPanel)return;const r=cell.getBoundingClientRect(),g=document.createElement('div');
    const base=planMonth(monthPanel.y,monthPanel.m),o=base[cell.dataset.k];if(!o)return;
    // its own drawing (fresh pattern ids): the lifted cell's may be hidden while the month is re-planned, and its patterns with it
    g.className='mv-ghost';g.innerHTML=`<span class="dn">${keyDate(cell.dataset.k).getDate()}</span>${stackSVG(o)}`;g.style.width=r.width+'px';g.style.height=r.height+'px';document.body.appendChild(g);
    mv={src:cell.dataset.k,over:null,ghost:g,dx:x-r.left-r.width/2,dy:y-r.top-r.height/2,y:monthPanel.y,m:monthPanel.m,base};
    outfitMove=mv;cell.classList.add('lifted');document.querySelector('#mpanel-in').classList.add('mv-on');if(navigator.vibrate)try{navigator.vibrate(12)}catch{}
    place(x,y)}
  function place(x,y){if(!mv)return;mv.ghost.style.transform=`translate(${x-mv.dx-mv.ghost.offsetWidth/2}px,${y-mv.dy-mv.ghost.offsetHeight*.85}px) scale(1.14)`;   // held a little above the fingertip, so the day under it shows
    const c=cellAt(x,y),k=c?c.dataset.k:null;if(k===mv.over)return;mv.over=k;
    document.querySelectorAll('#mpanel-in .mc.drop').forEach(e=>e.classList.remove('drop'));
    if(k&&k!==mv.src){c.classList.add('drop');const recs=moveRecs(mv.src,k,mv.base);if(recs){mv.recs=recs;showPlan(planWith(recs,mv.y,mv.m))}}
    else{mv.recs=null;showPlan(mv.base)}}
  async function drop(){if(!mv)return;const m=mv;mv=null;outfitMove=null;m.ghost.remove();noClick=true;setTimeout(()=>noClick=false,350);
    const pan=document.querySelector('#mpanel-in');if(pan)pan.classList.remove('mv-on');document.querySelectorAll('#mpanel-in .mc.drop,#mpanel-in .mc.lifted').forEach(e=>e.classList.remove('drop','lifted'));
    if(!m.recs||!m.over){showPlan(m.base);return}
    const before={src:dayRecs[m.src]?{...dayRecs[m.src]}:null,dst:dayRecs[m.over]?{...dayRecs[m.over]}:null},src=m.src,dst=m.over;
    await saveDay(m.recs[dst]);if(m.recs[src])await saveDay(m.recs[src]);else if(dayRecs[src])await saveDay({date:src});
    cache={};renderToday();
    const nm=k=>keyDate(k).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
    toast(`${nm(src)}'s outfit moved to ${nm(dst)}.`,6000,{label:'Undo',fn:async()=>{await saveDay(before.dst||{date:dst});await saveDay(before.src||{date:src});cache={};renderToday()}})}
  // touch: hold still, then drag; scrolling first (moving before the hold ends) cancels
  root.addEventListener('touchstart',e=>{const c=e.touches.length===1&&e.target.closest('#mpanel-in .mc[data-mv]');if(c){const t=e.touches[0];start(c,t.clientX,t.clientY)}},{passive:true});
  root.addEventListener('touchmove',e=>{const t=e.touches[0];if(hold&&Math.hypot(t.clientX-hold.x,t.clientY-hold.y)>MOVE_SLOP)cancelHold();if(mv){e.preventDefault();place(t.clientX,t.clientY)}},{passive:false});
  root.addEventListener('touchend',e=>{cancelHold();if(mv){e.preventDefault();drop()}},{passive:false});
  root.addEventListener('touchcancel',()=>{cancelHold();if(mv){mv.over=null;mv.recs=null;drop()}});
  // mouse: the same with a held button
  root.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;const c=e.target.closest('#mpanel-in .mc[data-mv]');if(c)start(c,e.clientX,e.clientY)});
  addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>MOVE_SLOP)cancelHold();if(mv){e.preventDefault();place(e.clientX,e.clientY)}});
  addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')return;cancelHold();if(mv)drop()});
  // the click that ends a hold or a move doesn't open the day; nor does the long press's context menu show
  root.addEventListener('click',e=>{if(noClick&&e.target.closest('#mpanel-in')){e.stopPropagation();e.preventDefault()}},true);
  root.addEventListener('contextmenu',e=>{if(e.target.closest('#mpanel-in .mc[data-mv]'))e.preventDefault()});
})();

/* ---- Wardrobe item sheet ----
   Tapping an item opens it in a sheet that slides up over the Wardrobe: the full width of a phone, to just under the top of the
   screen (a centred panel from 600px). The grid behind never moves, so closing puts you back exactly where you were. Ways out:
   swipe the sheet down (by its header at any time; by its content once that is scrolled to the top), Done in the bar at the
   bottom, a tap on the strip of Wardrobe left above it, the phone's Back button or gesture, Esc. ‹ › beside Done, a sideways
   swipe or the arrow keys go to the previous / next item of the list on screen. */
const WARD_EASE='cubic-bezier(.2,.8,.2,1)',WARD_MS=320;
const wardList=()=>wardView();   // the filtered, sorted list on screen (wardrobe.js)
const noMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate;
let itemFrom=null;   // the item the sheet was opened on: closing on another one brings that one's box into view first
/* the phone's Back closes the page: one history entry while it is open (itemBack: a history.back() of ours is on its way) */
let itemHist=false,itemBack=false;
try{history.scrollRestoration='manual'}catch{}   // stepping back must not move the Wardrobe (the page scrolls it to the item it closes on)
function histPush(){if(itemHist||itemBack||appPend)return;   // (appPend: a step back that drops Settings' or a stats/packing/care page's entry is on its way; the item gets its entry once it lands)
try{history.pushState({item:1},'');itemHist=true}catch{}}
function histDrop(){if(!itemHist)return;itemHist=false;itemBack=true;try{history.back()}catch{itemBack=false}}
addEventListener('popstate',()=>{
  if(itemBack){itemBack=false;if(editing)histPush();return}   // our own step back; an item opened meanwhile gets its entry now
  if(itemHist){itemHist=false;if(editing)closeItem(true)}});
/* show or hide the sheet; while it is up the app behind it takes no taps or keyboard focus */
function itemShown(on){const v=$('#item-view'),bd=$('#item-backdrop');if(!v)return;
  v.classList.toggle('on',on);if(bd)bd.classList.toggle('on',on);document.body.classList.toggle('iv-on',on);
  for(const el of document.querySelectorAll('body>header,main,body>nav'))el.inert=on}
/* draws the open item (called by renderWardrobe, so every edit redraws it; the scroll position stays) */
function renderItem(){
  const v=$('#item-view');if(!v)return;const i=editing&&items.find(x=>x.id===editing);
  if(!i){editing=null;itemShown(false);return}
  const l=wardList(),k=l.findIndex(x=>x.id===i.id);
  $('#ivhead').innerHTML=`<div class="ivt"><small class="gtype">${TYPES[i.type]||'Item'}</small><h2 id="iv-title" class="${titleCls(i)}">${esc(itemTitle(i)||TYPES[i.type]||'Item')}</h2></div>${k>=0?`<span class="pcount">${k+1} of ${l.length}</span>`:''}`;
  $('#ivbody').innerHTML=itemBody(i);
  $('#iv-prev').disabled=k<=0;$('#iv-next').disabled=k<0||k>=l.length-1;
  itemShown(true)}
const sheetSlides=()=>innerWidth<600;   // a phone: the sheet slides up from the bottom; wider, the panel fades in
function openItem(id){
  if(!items.some(i=>i.id===id))return;const v=$('#item-view'),bd=$('#item-backdrop'),was=editing;
  editing=id;if(!was)itemFrom=id;histPush();renderItem();$('#ivbody').scrollTop=0;
  for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}
  if(was||noMotion())return;const o={duration:WARD_MS,easing:WARD_EASE};
  v.animate(sheetSlides()?[{transform:'translateY(100%)'},{transform:'none'}]:[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'none'}],o);
  bd.animate([{opacity:0},{opacity:1}],{duration:WARD_MS})}
/* fromPop: the Back button did it (its history entry is gone already); dragged: how far down the sheet was let go, in px */
function closeItem(fromPop,dragged){
  const id=editing,v=$('#item-view'),bd=$('#item-backdrop');if(!id||!v)return;const moved=id!==itemFrom;
  editing=null;itemFrom=null;if(!fromPop)histDrop();
  const y=dragged||0,op=+bd.style.opacity||1;v.style.transform=bd.style.opacity='';
  if(noMotion()){renderItem();return}
  v.classList.add('closing');bd.classList.add('closing');renderItem();   // the sheet stays up, drawn as it was, while it slides away
  const t=$('#gi-'+id);if(t&&moved)t.scrollIntoView({block:'center'});   // it was reached with ‹ ›: show where it lives
  const o={duration:WARD_MS-60,easing:dragged?'ease-out':'cubic-bezier(.4,0,.8,.4)',fill:'forwards'};
  const an=v.animate(sheetSlides()?[{transform:`translateY(${y}px)`},{transform:'translateY(100%)'}]:[{opacity:1,transform:`translateY(${y}px)`},{opacity:0,transform:`translateY(${y+24}px)`}],o);
  bd.animate([{opacity:op},{opacity:0}],{duration:WARD_MS-60,fill:'forwards'});
  an.finished.catch(()=>{}).then(()=>{if(editing)return;for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing')}})}
/* closing with nothing to slide away from: the item was deleted, or another tab is shown */
function dropItem(){editing=null;itemFrom=null;histDrop();for(const el of [$('#item-view'),$('#item-backdrop')])if(el){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}itemShown(false)}
/* swiping the sheet down closes it. The header is a handle at any time; the content is one only while it is scrolled to the
   top (further down, a downward swipe scrolls it back up, as it must). The choice is made on the first move of a touch, before
   the browser starts scrolling. The sheet follows the finger and the Wardrobe behind brightens; let go past a quarter of the
   sheet's height, or with a flick, and it closes, else it springs back. Not while cropping (the crop frame is dragged). */
let ivDrag=false;
(()=>{const v=$('#item-view'),b=$('#ivbody'),bd=$('#item-backdrop');if(!v||!b)return;let st=null;
  const put=d=>{v.style.transform=d?`translateY(${d}px)`:'';if(bd)bd.style.opacity=d?String(Math.max(.15,1-d/v.offsetHeight)):''};
  v.addEventListener('touchstart',e=>{const t=e.touches[0],head=!!e.target.closest('.ivhead');
    st=!editing||e.touches.length>1||v.classList.contains('closing')||phEdit.crop||e.target.closest('input,textarea,.ivbar')||(!head&&b.scrollTop>0)?null:{x:t.clientX,y:t.clientY,t:Date.now(),on:false,d:0,ly:t.clientY,lt:Date.now(),vy:0}},{passive:true});
  v.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.on){if(dy>0&&dy>=Math.abs(dx)){st.on=ivDrag=true;v.style.transition='none'}else{st=null;return}}   // downward: ours; anything else is a scroll or a sideways swipe
    e.preventDefault();const now=Date.now();if(now>st.lt){st.vy=(t.clientY-st.ly)/(now-st.lt);st.ly=t.clientY;st.lt=now}
    st.d=Math.max(0,dy);put(st.d)},{passive:false});
  const end=()=>{
    if(!st)return;const {on,d,vy}=st;st=null;if(!on)return;ivDrag=false;v.style.transition='';
    if(d>v.offsetHeight*.25||(vy>.5&&d>30)){closeItem(false,d);return}
    put(0);if(!noMotion()){v.animate([{transform:`translateY(${d}px)`},{transform:'none'}],{duration:220,easing:WARD_EASE});if(bd)bd.animate([{opacity:Math.max(.15,1-d/v.offsetHeight)},{opacity:1}],{duration:220})}};
  v.addEventListener('touchend',end,{passive:true});v.addEventListener('touchcancel',end,{passive:true});
})();
/* the previous / next item of the list on screen; the new one slides in from the side it lies on */
function stepItem(n,from){
  const l=wardList(),k=l.findIndex(x=>x.id===editing),t=l[k+n];if(k<0||!t)return false;
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
    if(e.key==='Escape'){if(phEdit.crop){phEdit.crop=null;renderWardrobe()}else closeItem();return}
    if(e.target.closest&&e.target.closest('input,select,textarea'))return;
    if(e.key==='ArrowRight')stepItem(1);if(e.key==='ArrowLeft')stepItem(-1)});
})();
/* swiping the Wardrobe moves between the type filters (All, Suit, Blazer, …) in chip order, skipping types with no items;
   only the grid slides. Not while an item is open (its editor has sliders and the photo crop), nor on the chips row itself. */
const wardTypes=()=>['all',...Object.keys(TYPES).filter(t=>items.some(i=>i.type===t))];
function stepType(n,from){
  const l=wardTypes();let k=l.indexOf(flt);if(k<0)k=0;const j=k+n;if(j<0||j>=l.length)return false;
  flt=l[j];renderWardrobe();const sl=$('#wslide');if(!sl)return true;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x)return true;
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';return true}
(()=>{const el=$('#wardrobe');let st=null;const slide=()=>$('#wslide');
  el.addEventListener('touchstart',e=>{const t=e.touches[0];
    st=e.touches.length>1||editing||t.clientX<24||t.clientX>innerWidth-24||e.target.closest('.chips,input,select,textarea,.cropwrap')?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}},{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;e.preventDefault();
    const l=wardTypes(),k=l.indexOf(flt),edge=(dx>0&&k<=0)||(dx<0&&k>=l.length-1);   // nothing further that way: resist
    st.dx=dx;const sl=slide();if(sl){const v=edge?dx/4:dx;sl.style.transition='none';sl.style.transform=`translateX(${v}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(v)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5,n=dx<0?1:-1,l=wardTypes(),k=l.indexOf(flt),j=(k<0?0:k)+n;
    if((Math.abs(dx)>70||(fast&&Math.abs(dx)>30))&&j>=0&&j<l.length){const w=sl.offsetWidth||innerWidth;
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepType(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}};
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(el.hidden||editing||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepType(1);if(e.key==='ArrowLeft')stepType(-1)});
})();
/* in the Wardrobe, shoes, belts and socks show their realistic product picture when there is one */
const WARD_PIC_TYPES=['shoes','belt','socks'];
const wardPic=i=>{if(!WARD_PIC_TYPES.includes(i.type))return null;const p=itemPic(i);if(p)return p.img;setTimeout(()=>fetchItemPic(i),0);return null};
function renderWardrobe(){
  closeSettings();if(editing!==phEdit.id)phEdit={id:null,undo:[],crop:null};   // undo lasts while the item stays open
  const wf=wardKeep();
  const cnt=t=>t==='all'?items.length:items.filter(i=>i.type===t).length;
  const chips=['all',...Object.keys(TYPES)].map(t=>`<button class="chip ${flt===t?'on':''}" onclick="flt='${t}';renderWardrobe()">${t==='all'?'All':TYPES[t]} ${cnt(t)}</button>`).join('');
  const list=wardFresh();
  $('#wardrobe').innerHTML=`<div class="phead"><h2>Wardrobe</h2><span class="pcount" id="wcount">${wardCount(list)}</span><button type="button" class="pri padd" id="ward-add" onclick="openAdd()">+ Add</button></div>${items.length?wardBar()+`<div class="chips">${chips}</div>`:''}<div class="wslide" id="wslide">`+wardGrid(list)+'</div>';
  const on=document.querySelector('#wardrobe .chip.on');if(on){const c=on.parentElement;c.scrollLeft=Math.max(0,on.offsetLeft-c.offsetLeft-(c.clientWidth-on.offsetWidth)/2)}
  renderItem();wardBack(wf);
}

const cap1=t=>{t=String(t??'');return t&&t[0].toUpperCase()+t.slice(1)};   // option labels start with a capital ("Grey", "Solid"); values stay as they are
const S=(list,v,k,i)=>`<select onchange="setq(${i},'${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${cap1(x[1])}</option>`).join('')}</select>`;

function renderAdd(){
  closeSettings();
  const workerSet = !!localStorage.getItem('worker_url');
  if($('#note')) $('#note').textContent = !workerSet ? 'Photos won’t be read automatically. Paste your invite link in Settings → Connection, or add items by hand.' : aiError || (aiModel?`Last photo read by ${/^claude/.test(aiModel)?'Claude':'AI'} (${aiModel}).`:'Photos are read automatically: the type, colours and pattern are filled in for you.');
  const ready=queue.filter(q=>!q.busy&&!q.err).length;if($('#save-all'))$('#save-all').innerHTML=ready>1?`<button class="btn pri" onclick="saveAll()">Save all ${ready} items</button>`:'';
  if(typeof addGate==='function')addGate();
  if($('#queue')) $('#queue').innerHTML=queue.map((q,i)=>q.busy?`<div class="card"><span class="spin" aria-hidden="true"></span>${q.multiBusy?'Finding every item in the photo… (this can take up to a minute)':'Analyzing photo…'}</div>`:q.err?`<div class="card">That image couldn’t be read. <button onclick="queue.splice(${i},1);renderAdd()">Dismiss</button></div>`:
`<div class="card">${q.multi?`<p class="multi-h"><b>Item ${q.multi.n} of ${q.multi.of}</b> <span class="conf ${q.multi.confidence}">${q.multi.confidence} confidence</span></p>`:''}
${tagFailNote(q,i)}<div class="rv">${q.photo?photoPair(q.photo,q,'tagsw-q'+i):itemThumb(q)}</div>${COLORS[q.primaryColor]?shadeRow(q,`stepShadeQ.bind(null,${i})`,`matchShadeQ(${i})`,!!(q.meas&&q.meas.src==='closeup')):''}${wbNote(q,i)}${texSlot(q,i)}${tagNotes(q,i)}
${FABRIC.includes(q.type)&&q.big?`
<div class="sw-box">
  <div id="swatch-img-${i}" class="sw" style="background-image:url(${q.swatch})"></div>
  <div style="flex:1;font-size:13px">
    <b>Fabric swatch</b><small class="mut" style="display:block">${q.texCanvas?'From the fabric close-up':'From the photo'}: zoom and move it to a clean patch of cloth</small>
    <label>Zoom <input type="range" min="1" max="4" step="0.1" value="${q.zoom||1}" oninput="updateSwatchParam(${i}, 'zoom', this.value)"></label>
    <label>Left–right <input type="range" min="0" max="1" step="0.05" value="${q.cx||0.5}" oninput="updateSwatchParam(${i}, 'cx', this.value)"></label>
    <label>Up–down <input type="range" min="0" max="1" step="0.05" value="${q.cy||0.5}" oninput="updateSwatchParam(${i}, 'cy', this.value)"></label>
  </div>
</div>`:''}
<label>Type ${S(Object.entries(TYPES),q.type,'type',i)}</label>
<label class="colrow">Colour ${colBtn('q',i,'primaryColor',q.primaryColor)}</label>
<label class="colrow">${q.type==='socks'?'Toe cap':'Second colour'} ${colBtn('q',i,'secondaryColor',q.secondaryColor||'none')}</label>
${q.type==='socks'?'':`<label class="colrow">Third colour ${colBtn('q',i,'tertiaryColor',q.tertiaryColor||'none')}</label>`}
${FABRIC.includes(q.type)?`<label class="colrow">Pattern ${patBtn('q',i,q)}</label>`:''}${METAL_TYPES.includes(q.type)?`<label>${q.type==='belt'?'Buckle':'Metal'} ${S(Object.keys(METAL).map(c=>[c,c]),q.metal,'metal',i)}</label>`:''}
${q.type==='shirt'?`<label>Cuffs ${S(CUFFS,q.cuff||'button','cuff',i)}</label>`:''}${q.type==='suit'?`<label>Vest ${S(VESTS,q.vest==='yes'?'yes':'no','vest',i)}</label>`:''}${SEASON_TYPES.includes(q.type)?`<label>Season ${S(SEASONS,q.season||'all','season',i)}</label>`:''}
${q.type==='pants'?`<label>Kind ${S(TROUSER_KINDS,q.trouserKind||'dress','trouserKind',i)}</label>`:''}${q.type==='shoes'?`<label>Style ${S(SHOE_STYLES,q.shoeStyle||'oxford','shoeStyle',i)}</label>`:''}${q.type==='shoes'||q.type==='belt'?`<label>${leatherLabel(q)} ${S(leathersFor(q).map(c=>[c,cap1(leatherWord(q,c))]),q.leather||'calf','leather',i)}</label>`:''}
${q.type==='watch'?`<label>Dial ${S(DIAL_OPTS(watchOpts(q).dial),watchOpts(q).dial,'dial',i)}</label><label>Band ${S(BANDS,watchOpts(q).band,'band',i)}</label><label>Bezel ${S(BEZELS,watchOpts(q).bezel,'bezel',i)}</label><label>Style ${S(WATCH_STYLES,watchOpts(q).style,'watchStyle',i)}</label>`:''}
${matRow(q.type,q.material,`setQField(${i},'material',`)}${moreRow(q,i)}${orderRow(q,i)}<div class="btns"><button class="pri" onclick="save(${i})">Confirm</button><button onclick="queue.splice(${i},1);renderAdd()">${q.manual?'Cancel':'Skip'}</button></div>${q.manual?'':`<small>${aiLabel(q)}</small>`}</div>`).join('');
}

/* moving between pages: the page arriving eases in from the side its tab is on (Today, Wardrobe, Add left to right), a short slide and a
   fade on the cards' curve; a page opened from Settings (stats, packing, care) rises in instead. The tab bar's marker slides to the tab
   (styles.css nav::before, --ti). Only the page arriving moves: the one leaving goes at once, so nothing is laid out twice. */
const PAGES=['today','wardrobe','add','stats','pack','care'],TABS=['today','wardrobe','stats'],PAGE_MS=320;
function pageIn(t,from){const el=$('#'+t),nav=document.querySelector('body>nav'),ti=TABS.indexOf(t);
  if(nav){nav.style.setProperty('--ti',Math.max(0,ti));nav.classList.toggle('tab-none',ti<0)}
  if(!el||!from||from===t||noMotion())return;
  if(el._ps){el._ps.cancel();el._ps=null}   // a scroll slide left from an unfold (pageScroll) on Today
  const a=TABS.indexOf(from),dx=a>=0&&ti>=0?(ti>a?28:-28):0;if(el._pg)el._pg.cancel();
  const an=el._pg=el.animate([{opacity:0,transform:dx?`translateX(${dx}px)`:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:PAGE_MS,easing:MONTH_EASE});
  an.finished.then(()=>{if(el._pg===an)el._pg=null},()=>{})}
/* a page opened from Settings or from Today (stats, packing, care: openStats, openPack, openCare call subOpen first) goes back with its ‹
   (subBack) to where it was opened from: Settings as it was, the same categories open and scrolled the same, over the page under it; or
   the page it came from, scrolled where it was. (The ‹ always went to Today, out of Settings entirely.) */
let subFrom=null;
/* The phone's Back (button or swipe) steps back one level: on one of these pages it does what the ‹ does, in Settings what Done does.
   There is one history entry while Settings or such a page is open (appHist), and appKind says whose it is: opening a page from Settings
   hands Settings' entry on to the page ('set' → 'sub') and its ‹ hands it back, so Back never needs two presses. Left any other way
   (Done, a tab, the ‹ to Today) the entry is taken away with a history.back() of our own (appPend) that the popstate below lets pass;
   appKeep holds it while subBack moves from the page to Settings. (The item sheet keeps its own entry the same way: histPush.) */
const SUBS=['add','pack','care'];let appHist=false,appKind='',appPend=false,appKeep=false;
function appPush(kind){if(appHist){appKind=kind;return}if(appPend||itemBack)return;try{history.pushState({app:kind},'');appHist=true;appKind=kind}catch{}}
function appDrop(kind){if(!appHist||appKeep||appKind!==kind)return;appHist=false;appPend=true;try{history.back()}catch{appPend=false}}
addEventListener('popstate',()=>{if(appPend){appPend=false;if(editing)histPush();return}   // our own step back; an item opened meanwhile gets its entry now
  if(!appHist)return;appHist=false;
  if(appKind==='sub'&&SUBS.some(s=>{const e=$('#'+s);return e&&!e.hidden}))subBack();else if(settingsOpen())saveSettings()});
function subOpen(){appPush('sub');
  const m=$('#settings-modal');let page=PAGES.find(s=>{const e=$('#'+s);return e&&!e.hidden})||'today';
  if(!TABS.includes(page))page='today';   // one of these pages opened from another: its ‹ goes to Today
  subFrom={page,y:scrollY,set:settingsOpen()&&m?{cats:SET_CATS.filter(k=>{const e=$('#sc-'+k);return e&&e.classList.contains('open')}),top:m.scrollTop}:null}}
function subBack(){const f=subFrom||{page:'today',y:0,set:null};subFrom=null;
  appKeep=!!f.set;try{show(f.page)}finally{appKeep=false}scrollTo(0,f.y);   // back to Settings: the entry stays, for Settings now
  if(!f.set)return;openSettings();for(const k of f.set.cats)setCatOpen(k,true,true);settingsSummaries();const m=$('#settings-modal');if(m)m.scrollTop=f.set.top}
/* Add is a page of the Wardrobe (its + Add button), with a ‹ back to where it was opened from (subBack) */
function openAdd(){subOpen();show('add');scrollTo({top:0})}
function show(t){
  const from=PAGES.find(s=>{const e=$('#'+s);return e&&!e.hidden});
  if(!SUBS.includes(t))appDrop('sub');   // a page left by the ‹ (to Today) or a tab: its Back entry goes
  if(typeof setupYield==='function')setupYield(t);
  closeSettings();if(typeof closeShop==='function')closeShop();if(t!=='wardrobe'&&editing)dropItem();
  for(const s of['today','wardrobe','add','stats']){const el=$('#'+s);if(el)el.hidden=s!==t;const btn=$('#n-'+s);if(btn)btn.classList.toggle('on',s===t)}
  const f={today:renderToday,wardrobe:renderWardrobe,add:renderAdd,stats:()=>renderStats()};if(f[t])f[t]();
  if(typeof packShow==='function')packShow(t);   // the packing list page (pack.js)
  if(t!=='wardrobe')renderItem();   // the item page belongs to the Wardrobe
  if(typeof careShow==='function')careShow(t);   // the Care page (care.js)
  pageIn(t,from);
}

db.then(()=>Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings')])).then(([r,d,st])=>{items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};applyCustom(settings.custom);checkPlanRules().then(checkArrivals).then(()=>{if(!$('#today').hidden)refreshToday()});afterScripts(()=>{if(typeof migrateVests==='function')migrateVests()});show('today');afterScripts(()=>{if(typeof setupStart==='function')setupStart()});loadWeather();afterScripts(()=>refreshHolidays());loadRenders().then(()=>asmLive()?asmLoad():0).then(()=>{afterDom(()=>{window.appReady=true});if(asmLive())afterScripts(()=>asmSync());if(Object.keys(renders).length&&!$('#today').hidden)refreshToday();fixItemBackdrops().then(n=>{if(n&&!$('#today').hidden)refreshToday()});texSwatches().then(n=>{if(n&&!$('#today').hidden)refreshToday()});afterScripts(()=>recolourSpecSetts().then(n=>{if(n&&!$('#today').hidden)refreshToday()}));if(queuedKeys().length){checkQueue();startQueueWatch()}afterScripts(()=>safetyStart())})}).catch(e=>{console.warn(e);items=[];show('today');window.appReady=true;afterScripts(()=>storageDown(e))});

/* (window.appReady also waits for every script to have run (afterDom; afterScripts waits for the load event, pictures too, and held it up 30 s once): on a slow load app.js's start-up finished while about.js
   was still to come, and a test read the page before about.js had shown its note after a restart)
   (window.appReady is set once the kept photos are loaded too (loadRenders, asmLoad): loadRenders starts `renders` afresh, and a test that put a photo there the moment the items were in lost it on a busy machine) */
/* service worker: fresh files on every load, offline fallback (only over http/https) */
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(e=>console.warn('service worker not registered',e));
/* sync brought new data: refresh the in-memory outfit history too */
function onSyncedData(m){dayRecs=Object.fromEntries((m.days||[]).map(d=>[d.date,d]));if(m.settings){settings={...settings,...m.settings};applyCustom(settings.custom)}if(typeof dressSynced==='function')dressSynced(m);loadWeather()}

/* ---- settings: schedule, weather location, units ---- */
const unit=()=>settings.units||(/^en-(US|LR|MM)/.test(navigator.language||'')?'F':'C');
const temp=c=>Math.round(unit()==='F'?c*9/5+32:c);
const wxIcon=c=>c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌦️':c<=86?'🌨️':'⛈️';
function wxChip(d){const w=weather[key(d)];if(!w)return '';return `${wxIcon(w.code)} ${temp(w.tmax)}°/${temp(w.tmin)}°${(w.pop||0)>=30?` · ☂ ${w.pop}%`:''}`}
async function saveUserSettings(){settings.updated=Date.now();cache={};   // the settings have changed already: the cached plan is stale now, not only once they are stored
  await metaPut('settings',settings);cache={};if(window.scheduleSync)scheduleSync()}
/* ---- Settings: days off. A country's public holidays (each can be unticked if you work that day) and your own days
   off (a single day or a range, e.g. a holiday trip). They are planned like weekends: no outfit, nothing counted as worn. ---- */
const COUNTRY_CODES='AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS YE YT ZA ZM ZW'.split(' ');
const countryName=cc=>{try{return new Intl.DisplayNames(['en'],{type:'region'}).of(cc)||cc}catch{return cc}};
let holidayMsg='';
/* public holidays of a country for about the next 13 months -> [{d:'YYYY-MM-DD', n:name}]. Nager.Date first (free, no key,
   most countries); the worker's /holidays (Google's public holiday calendars) for the ones it lacks, e.g. the Gulf states */
async function fetchHolidays(cc){
  const T=todayDate(),from=isoKey(new Date(T.getFullYear(),T.getMonth()-1,T.getDate())),to=isoKey(new Date(T.getFullYear()+1,T.getMonth()+1,T.getDate()));
  const tidy=l=>{const m={};for(const x of l)if(x.d>=from&&x.d<=to&&x.n)m[x.d]=m[x.d]&&!m[x.d].includes(x.n)?m[x.d]+', '+x.n:m[x.d]||x.n;return Object.entries(m).sort().map(([d,n])=>({d,n}))};
  try{const out=[];for(const y of new Set([+from.slice(0,4),+to.slice(0,4)])){const r=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`);if(r.status!==200)continue;
      for(const h of await r.json())if(h.global!==false&&(!h.types||h.types.includes('Public')))out.push({d:h.date,n:h.name||h.localName})}
    if(out.length)return tidy(out)}catch(e){/* unreachable or unknown country: try the worker */}
  const W=workerBase();if(!W)throw new Error(`No holiday list for ${countryName(cc)} until the app is connected: paste your invite link under Connection.`);
  let r;try{r=await fetch(new URL('holidays',W.url).href+'?country='+cc,{headers:{'x-app-token':W.tok},cache:'no-store'})}catch{throw new Error('Couldn’t reach your worker for the holiday list.')}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.holidaysError||(r.status===404||r.status===405?'The server doesn’t have holiday lists yet: it needs an update.':j.error||`HTTP ${r.status}`));
  return tidy((j.holidays||[]).map(h=>({d:h.date,n:h.name})))}
async function setHolidayCountry(cc,quiet){
  if(!cc){settings.holidays=null;holidayMsg='';await saveUserSettings();todayStale=true;renderDaysOffUI();return}
  if(!quiet){holidayMsg=`Loading the public holidays of ${countryName(cc)}…`;renderDaysOffUI()}
  try{const list=await fetchHolidays(cc),old=settings.holidays&&settings.holidays.country===cc?settings.holidays.skip||[]:[];
    settings.holidays={country:cc,list,skip:old.filter(d=>list.some(x=>x.d===d)),fetched:Date.now()};
    holidayMsg=list.length?'':`No public holidays found for ${countryName(cc)}.`;await saveUserSettings();todayStale=true}
  catch(e){if(quiet)return;holidayMsg=e.message||'Couldn’t load the holiday list.'}
  renderDaysOffUI()}
/* the list goes stale (new year, tentative dates confirmed): fetched again once a month, keeping the days you unticked */
/* the monthly refetch saves the settings with a new stamp, and the newest settings win a sync: on a device that had been away
   for a while, stamping its old settings would undo a change made on another device since. So it syncs first, and refetches
   only if the settings it then has still need it (another device may have done it already). Offline: not this time. */
async function refreshHolidays(){const due=()=>{const h=settings.holidays;return !!(h&&h.country&&Date.now()-(h.fetched||0)>30*864e5)};
  if(!due())return;
  if(typeof syncUrl==='function'&&syncUrl()&&localStorage.getItem('app_token')){
    if(!await syncNow())return;
    const st=await metaGet('settings');if(st)settings={...settings,...st};if(!due())return}
  return setHolidayCountry(settings.holidays.country,true)}
/* testers have daily limits instead of costs: no "about 7¢" for them (account.js knows who is connected) */
const showCost=()=>!(typeof isTester==='function'&&isTester());
async function toggleHoliday(d,on){const h=settings.holidays;if(!h)return;const skip=new Set(h.skip||[]);on?skip.delete(d):skip.add(d);
  settings.holidays={...h,skip:[...skip].sort()};await saveUserSettings();todayStale=true;renderDaysOffUI()}
const isoToDate=v=>{const [y,m,d]=String(v).split('-').map(Number);return new Date(y,m-1,d)};
async function addDayOff(){const f=($('#cfg-off-from')||{}).value,t=($('#cfg-off-to')||{}).value||f,n=(($('#cfg-off-name')||{}).value||'').trim();
  const say=m=>{holidayMsg=m;renderDaysOffUI()};if(!f)return say('Pick a date first.');
  const a=isoToDate(f),b=isoToDate(t);if(b<a)return say('The last day is before the first.');if((b-a)/864e5>92)return say('That is more than three months: add it in parts.');
  const cur=new Map((settings.daysOff||[]).map(x=>[x.d,x]));let k=0;for(const d=new Date(a);d<=b;d.setDate(d.getDate()+1)){cur.set(isoKey(d),{d:isoKey(d),n:n||'Day off'});k++}
  settings.daysOff=[...cur.values()].sort((x,y)=>x.d<y.d?-1:1);holidayMsg=`${k} day${k===1?'':'s'} off added.`;
  for(const id of ['#cfg-off-from','#cfg-off-to','#cfg-off-name'])if($(id))$(id).value='';
  await saveUserSettings();todayStale=true;renderDaysOffUI()}
function renderDaysOffUI(){const box=$('#cfg-country'),list=$('#holiday-list');if(!box||!list)return;
  const h=settings.holidays,cc=h&&h.country||'';
  if(box.options.length<2)box.innerHTML='<option value="">No public holidays</option>'+COUNTRY_CODES.map(c=>[countryName(c),c]).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,c])=>`<option value="${c}">${esc(n)}</option>`).join('');
  box.value=cc;
  const tk=isoKey(todayDate()),skip=new Set(h&&h.skip||[]),up=(h&&h.list||[]).filter(x=>x.d>=tk);
  list.innerHTML=!cc?'':up.length?up.map(x=>{const d=isoToDate(x.d),wk=!settings.workdays.includes(d.getDay());
    return `<label class="hrow${wk?' wk':''}"><input type="checkbox" ${skip.has(x.d)?'':'checked'} onchange="toggleHoliday('${x.d}',this.checked)"><span class="hd">${shortDate(d)}</span><span class="hn">${esc(x.n)}${wk?' <small class="mut">(not a workday anyway)</small>':''}</span></label>`}).join('')
    :'<small class="mut">No public holidays in the next year.</small>';
  const own=(settings.daysOff||[]).filter(x=>x.d>=tk),ol=$('#off-list');
  // consecutive days with one name are shown as one range
  const runs=[];for(const x of own){const r=runs[runs.length-1];if(r&&r.n===x.n&&(isoToDate(x.d)-isoToDate(r.to))/864e5<=1.5)r.to=x.d,r.ds.push(x.d);else runs.push({from:x.d,to:x.d,n:x.n,ds:[x.d]})}
  if(ol)ol.innerHTML=runs.map(r=>{const l=r.from===r.to?shortDate(isoToDate(r.from)):`${shortDate(isoToDate(r.from))} – ${shortDate(isoToDate(r.to))}`;
    return `<span class="fchip">${l}${r.n&&r.n!=='Day off'?' · '+esc(r.n):''}<button type="button" aria-label="Remove ${l}" onclick="removeDaysOff('${r.ds.join(',')}')">×</button></span>`}).join('');
  const m=$('#holiday-msg');if(m)m.textContent=holidayMsg||(cc&&up.length?`${up.filter(x=>!skip.has(x.d)).length} public holiday${up.length===1?'':'s'} of ${countryName(cc)} count as days off. Untick any you work.`:'');
  const f=$('#cfg-off-from');if(f)f.min=tk}
async function removeDaysOff(csv){const ds=new Set(csv.split(','));settings.daysOff=(settings.daysOff||[]).filter(x=>!ds.has(x.d));holidayMsg='';await saveUserSettings();todayStale=true;renderDaysOffUI()}
/* ---- Settings: formal days (any upcoming workday) and regenerating the shown day's photo ---- */
const shortDate=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function renderFormalUI(msg){const list=$('#formal-list'),inp=$('#cfg-formal-date');if(!list)return;
  const T=todayDate();if(inp){inp.min=isoDate(T);if(!inp.value)inp.value=isoDate(nextWorkday?nextWorkday(T):T)}
  const up=Object.values(dayRecs).filter(r=>occOf(r)&&keyDate(r.date)>=T).sort((a,b)=>keyDate(a.date)-keyDate(b.date));
  list.innerHTML=up.length?up.map(r=>{const l=shortDate(keyDate(r.date));return `<span class="fchip">${l} · ${occLabel(occOf(r))}<button type="button" aria-label="Make ${l} a regular day" onclick="setOccasion(null,'${r.date}')">×</button></span>`}).join(''):'<small class="mut">No occasions coming up.</small>';
  const pick=$('#cfg-occasion');if(pick&&!pick.options.length)pick.innerHTML=OCCASIONS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  if(msg!==undefined&&$('#formal-msg'))$('#formal-msg').textContent=msg}
async function addFormalDay(){const v=($('#cfg-formal-date')||{}).value;if(!v)return renderFormalUI('Pick a date first.');
  const [y,m,dd]=v.split('-').map(Number),d=new Date(y,m-1,dd),k=key(d),l=shortDate(d);
  if(d<todayDate())return renderFormalUI(`${l} has passed.`);
  const o=monthPlan(y,m-1)[k];if(!o)return renderFormalUI(`${l} is a day off, so there's no outfit to change.`);
  if(o.frozen)return renderFormalUI(`${l} is already locked in.`);
  const occ=($('#cfg-occasion')||{}).value||'formal',O=OCCASIONS.find(x=>x[0]===occ)||OCCASIONS[0],what=occ==='casual'?'a day without a jacket or tie':`${aAn(O[1].toLowerCase())} day`;
  if(o.occasion===occ)return renderFormalUI(`${l} is already ${what}.`);
  await setOccasion(occ,k);renderFormalUI(`${l} is now ${what}: ${O[2]}.`)}
function renderRegenUI(){const btn=$('#regen-btn'),st=$('#regen-status');if(!btn)return;const o=planFor()[key(sel)],l=shortDate(sel);
  const r=o&&renderFor(o),pend=renderPending(o);btn.disabled=!o||!!rendering||pend;btn.textContent=pend?'Making photo…':o?`${r?'Regenerate':'Generate'} photo for ${l}`:`No outfit on ${l}`;
  if(st)st.textContent=o?(r?`Makes a new realistic photo of the day shown on Today${showCost()?' (about 7¢)':''}; it replaces the current one for every day with this look.`:`The day shown on Today has no photo yet${showCost()?' (about 7¢)':''}.`):'Pick a workday on Today first.';if(typeof needConn==='function'&&needConn(btn)&&st)st.textContent=''}
function renderSettingsExtras(){
  if(typeof renderDressUI==='function')renderDressUI();renderItemPicUI();renderFormalUI();renderRegenUI();renderReplanUI();renderDaysOffUI();renderCustomUI();renderBenchUI();renderWeaveUI();if(typeof renderConnUI==='function')renderConnUI();
  if(typeof renderAsmUI==='function'){renderAsmUI();if(asmLive())asmSync()}
  if(typeof renderCareUI==='function')renderCareUI();
  const tog=(id,list)=>{const el=$(id);if(el)el.innerHTML=DAY_NAMES.map((n,i)=>`<button type="button" class="dtog ${list.includes(i)?'on':''}" onclick="toggleDay('${id}',${i})" aria-pressed="${list.includes(i)}">${n.slice(0,3)}</button>`).join('')};
  tog('#cfg-workdays',settings.workdays);tog('#cfg-blazer',settings.blazerDays.filter(d=>settings.workdays.includes(d)));
  if($('#wx-loc'))$('#wx-loc').textContent=settings.location?`Weather for ${settings.location.name}.`+(climate?` Beyond the 16-day forecast, days are planned from the usual weather there: highs of about ${temp(Math.min(...climate.map(m=>m.tmax)))}° in the coolest month and ${temp(Math.max(...climate.map(m=>m.tmax)))}° in the hottest.`:' Beyond the 16-day forecast, days follow the calendar season.'):'No location set: outfits follow the calendar season.';
  if($('#cfg-units'))$('#cfg-units').value=unit();
  if($('#cfg-vest'))$('#cfg-vest').value=settings.vestMode||'auto';if($('#cfg-dark'))$('#cfg-dark').value=settings.darkShirts||'some';
  settingsSummaries();
}
function setVestMode(v){settings.vestMode=v;saveUserSettings();settingsSummaries()}
/* how often dark shirts are planned (planner.js, darkMode): the coming week is planned again with the new choice */
async function setDarkShirts(v){settings.darkShirts=v;await clearLocks();await saveUserSettings();todayStale=true;settingsSummaries()}
function toggleDay(id,i){const k=id==='#cfg-workdays'?'workdays':'blazerDays',l=new Set(settings[k]);l.has(i)?l.delete(i):l.add(i);
  if(k==='workdays'&&l.size===0)return;settings[k]=[...l].sort();if(k==='workdays')settings.blazerDays=settings.blazerDays.filter(d=>l.has(d));
  renderSettingsExtras();clearLocks().then(saveUserSettings)}
function setUnits(v){settings.units=v;saveUserSettings();settingsSummaries()}
function setLocation(loc){settings.location=loc;localStorage.removeItem('wx');localStorage.removeItem('wx_norm');weather={};climate=null;saveUserSettings().then(()=>loadWeather(true));renderSettingsExtras();if($('#city-results'))$('#city-results').innerHTML=''}
function useMyLocation(){if(!navigator.geolocation){tell('Location is not available on this device.');return}
  navigator.geolocation.getCurrentPosition(p=>setLocation({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3),name:'your current location'}),()=>tell('Location permission was denied. Search for your city instead.'))}
async function findCity(){const q=($('#cfg-city')&&$('#cfg-city').value||'').trim();if(!q)return;
  try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name='+encodeURIComponent(q));const j=await r.json();
    const res=(j.results||[]).map(c=>({lat:c.latitude,lon:c.longitude,name:[c.name,c.admin1,c.country_code].filter(Boolean).join(', ')}));
    window._cities=res;$('#city-results').innerHTML=res.length?res.map((c,i)=>`<button type="button" onclick="setLocation(_cities[${i}])">${c.name}</button>`).join(''):'<small class="mut">No matches.</small>'}
  catch(e){$('#city-results').innerHTML='<small class="mut">City search is unavailable right now.</small>'}}
/* 16-day forecast from Open-Meteo (free, no key); cached for 3 hours */
/* header ↻: sync with the worker (if set up), reload everything from storage, refresh the forecast and redraw */
let toastTimer=null;
function toast(t,ms=2500,act){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.toggle('act',!!act);
  if(act){const b=document.createElement('button');b.type='button';b.textContent=act.label;b.onclick=()=>{e.classList.remove('on','act');clearTimeout(toastTimer);act.fn()};e.append(' ',b)}
  e.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('on','act'),ms)}
let refreshing=false;
async function refreshAll(){
  if(refreshing)return;refreshing=true;const b=$('#refresh-btn');if(b)b.classList.add('spin');
  let msg='';
  try{
    const n0=items.length;
    if(window.syncNow&&localStorage.getItem('worker_url')&&localStorage.getItem('app_token')){
      const ok=await syncNow();if(!ok)msg=localStorage.getItem('sync_status')||'Sync failed.'}
    const [r,d,st]=await Promise.all([tx('readonly',s=>s.getAll()),txs('days','readonly',s=>s.getAll()),metaGet('settings')]);
    items=r||[];dayRecs=Object.fromEntries((d||[]).map(x=>[x.date,x]));if(st)settings={...settings,...st};cache={};
    await loadWeather(true);
    if(typeof renderTried!=='undefined')renderTried.clear();remoteKeys=null;
    const v=['today','wardrobe','add','stats','pack','care'].find(t=>$('#'+t)&&!$('#'+t).hidden)||'today';show(v);
    if(!msg){const diff=items.length-n0;msg=`Refreshed · ${items.length} item${items.length===1?'':'s'}${diff>0?` (${diff} new)`:diff<0?` (${-diff} removed)`:''}`}
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(g=>g&&g.update()).catch(()=>{});
  }catch(e){msg='Refresh failed: '+(e.message||e)}
  finally{refreshing=false;if(b)b.classList.remove('spin');toast(msg)}
}
/* the location's usual weather by month, from Open-Meteo's archive (free, no key): the last two full years' daily highs,
   lows and rain, averaged per month. Kept for four months per location; days beyond the 16-day forecast are planned from it. */
async function loadClimate(){
  const L=settings.location;if(!L){climate=null;return}
  try{const c=JSON.parse(localStorage.getItem('wx_norm')||'null');
    if(c&&c.lat===L.lat&&c.lon===L.lon&&Array.isArray(c.months)){const fresh=Date.now()-c.t<120*864e5;if(JSON.stringify(climate)!==JSON.stringify(c.months)){climate=c.months;cache={};if(!$('#today').hidden)refreshToday()}if(fresh)return}}catch{}
  try{const y=new Date().getFullYear(),r=await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${L.lat}&longitude=${L.lon}&start_date=${y-2}-01-01&end_date=${y-1}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
    const d=r.ok&&(await r.json()).daily;if(!d||!d.time||!d.temperature_2m_max)return;
    const m=[...Array(12)].map(()=>({n:0,tx:0,tn:0,r:0}));
    d.time.forEach((t,i)=>{const k=+t.slice(5,7)-1,tx=d.temperature_2m_max[i];if(!(k>=0&&k<12)||typeof tx!=='number')return;m[k].n++;m[k].tx+=tx;m[k].tn+=d.temperature_2m_min?.[i]??tx;if((d.precipitation_sum?.[i]||0)>=1)m[k].r++});
    if(m.some(x=>x.n<20))return;   // a month with hardly any readings: keep what we had
    const months=m.map(x=>({tmax:+(x.tx/x.n).toFixed(1),tmin:+(x.tn/x.n).toFixed(1),rainDays:+(x.r/x.n*30).toFixed(1)}));
    const N=settings.location;if(!N||N.lat!==L.lat||N.lon!==L.lon)return;   // the location changed meanwhile
    climate=months;localStorage.setItem('wx_norm',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),months}));cache={};if(!$('#today').hidden)refreshToday();if(settingsOpen())renderSettingsExtras()}
  catch(e){console.warn('climate history unavailable',e)}
}
async function loadWeather(force){
  const L=settings.location;if(!L)return;loadClimate();
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');
    if(!force&&c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3){weather=c.days;cache={};if(!$('#today').hidden)refreshToday();return}}catch{}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&timezone=auto&forecast_days=16`);
    const d=(await r.json()).daily;if(!d||!d.time)return;const days={};
    d.time.forEach((t,i)=>{const [y,m,dd]=t.split('-').map(Number);days[key(new Date(y,m-1,dd))]={tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],pop:d.precipitation_probability_max[i]??0,rain:d.precipitation_sum[i]??0,code:d.weather_code[i]??0}});
    weather=days;localStorage.setItem('wx',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),days}));cache={};if(!$('#today').hidden)refreshToday()}
  catch(e){console.warn('weather unavailable',e)}
}

/* ---- theme: Auto (follow the device) → Light → Dark; saved per device ---- */
const THEMES={auto:['◐','automatic'],light:['☀︎','light'],dark:['☾','dark']};
function applyTheme(t){
  if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else{delete document.documentElement.dataset.theme;t='auto'}
  const b=$('#theme-btn');if(b){b.textContent=THEMES[t][0];b.setAttribute('aria-label','Theme: '+THEMES[t][1]);b.title='Theme: '+THEMES[t][1]+' (tap to change)'}
  if(window.appReady&&$('#today')&&!$('#today').hidden&&$('.fig'))renderToday();   // the figure fades into the page colour
}
function cycleTheme(){
  let cur='auto';try{cur=localStorage.getItem('theme')||'auto'}catch{}
  const next={auto:'light',light:'dark',dark:'auto'}[cur]||'auto';
  try{next==='auto'?localStorage.removeItem('theme'):localStorage.setItem('theme',next)}catch{}
  applyTheme(next);
}
try{applyTheme(localStorage.getItem('theme')||'auto')}catch{applyTheme('auto')}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(window.appReady&&!$('#today').hidden&&$('.fig'))renderToday()})}catch{}
