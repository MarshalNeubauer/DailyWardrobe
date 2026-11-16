/* Daily Wardrobe: the app's state and storage (IndexedDB), and helpers every page uses: the busy pill, the tab bar's fit, questions,
   colour names, photo loading and the precision swatch. Load order of the app's own scripts: app.js, add.js, itemsheet.js, history.js,
   today.js, month.js, photos.js, settings.js, start.js (the start-up chain last).
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
let flt='all',queue=[];const now=new Date();let view={y:now.getFullYear(),m:now.getMonth()},sel=new Date(now.getFullYear(),now.getMonth(),now.getDate());

/* storage */
// stores: items (wardrobe), days (outfit history, keyed by date), meta (key/value: deletion tombstones, settings, sync state)
/* The connection can be lost while the app runs (2026-11-14, a tester's iPhone 17 Pro: the sample wardrobe, Confirm on Add and every
   other save did nothing, and a navy suit card was left on Add at each tap): iOS Safari closes a page's database connection when the
   app has been in the background (switching to Messages for the invite link, the Share sheet), and every transaction then throws
   InvalidStateError at once, which was not seen as a storage failure, so nothing said so. Now the connection is opened again and the
   transaction retried once (dbLive, txs, atomic); a failure that remains is a storage failure and is said. `db` stays the first opening
   (start-up and safety.js wait on it). */
let dbCur=null,dbConn=null;
function dbOpen(){const p=new Promise((ok,no)=>{const r=indexedDB.open('wardrobe',2);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('items'))d.createObjectStore('items',{keyPath:'id'});
    if(!d.objectStoreNames.contains('days'))d.createObjectStore('days',{keyPath:'date'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'})};
  r.onsuccess=()=>{const d=r.result;dbConn=d;d.onclose=()=>dbDrop(d);d.onversionchange=()=>{try{d.close()}catch{}dbDrop(d)};ok(d)};r.onerror=()=>no(r.error)});
  dbCur=p;p.catch(()=>{if(dbCur===p)dbCur=null});return p}
function dbDrop(d){if(dbConn===d){dbConn=null;dbCur=null}}
const db=dbOpen();
const dbLive=()=>dbCur||dbOpen();
// the browser closed the connection (iOS Safari's "Connection to Indexed Database server lost", a closing database)
const dbGone=e=>!!e&&(e.name==='InvalidStateError'||e.name==='UnknownError'||/connection|closing|closed/i.test(e.message||''));
// run one transaction; when the connection is gone, open it again and run it once more (an aborted transaction stored nothing)
async function dbRetry(m,run){const d=await dbLive();try{return await run(d)}catch(e){
  if(!dbGone(e)||e.name==='QuotaExceededError')throw dbMark(e,m);try{d.close()}catch{}dbDrop(d);console.warn('storage connection lost: opening it again',e);
  try{return await run(await dbLive())}catch(e2){throw dbMark(e2,m)}}}
const dbMark=(e,m)=>{try{if(e&&typeof e==='object'&&!e.dwStore)e.dwStore=m==='readonly'?'read':'write'}catch{}return e};
/* a transaction that fails or is aborted (storage full) rejects with the browser's error, marked as a storage failure (safety.js shows it) */
const txFail=(t,no,m)=>ev=>{let e=t.error||(ev&&ev.target&&ev.target.error)||new Error('the browser stopped it');try{e.dwStore=m==='readonly'?'read':'write'}catch{}no(e)};
const txs=(store,m,f)=>dbRetry(m,d=>new Promise((ok,no)=>{const t=d.transaction(store,m);t.onerror=t.onabort=txFail(t,no,m);const q=f(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result)}));
const tx=(m,f)=>txs('items',m,f);
const metaGet=async k=>{const r=await txs('meta','readonly',s=>s.get(k));return r?r.v:undefined},metaPut=(k,v)=>txs('meta','readwrite',s=>s.put({k,v}));
/* ---- the connection kept in the database too (2026-11-14: on the owner's iPhone the Home Screen app's localStorage lost the server
   address and the code after the app was force-closed during an update; the database, with the wardrobe, was untouched; Safari kept
   both). A copy of these keys is kept in meta 'conn' and put back at start-up where localStorage lost them, before anything reads them
   (start.js and sync.js wait for connRestored). The copy follows localStorage: written after the restore, when Settings closes, when a
   connection is made and whenever the app goes to the background (an address cleared on purpose is copied as cleared); Delete my data
   deletes the database and the copy with it. ---- */
const CONN_KEEP=['worker_url','app_token','remind'];
let connReady=false;
async function connKeep(){if(!connReady)return;try{const v={};for(const k of CONN_KEEP){const x=localStorage.getItem(k);if(x!=null)v[k]=x}await metaPut('conn',v)}catch(e){console.warn('connection copy not kept',e)}}
const connRestored=db.then(async()=>{let n=0;
  // (not during a "Delete everything" that was cut off: about.js aboutResumeDelete)
  try{const v=localStorage.getItem('del_pending')?null:await metaGet('conn');if(v)for(const k of CONN_KEEP)if(v[k]&&!localStorage.getItem(k)){localStorage.setItem(k,v[k]);n++}}catch(e){console.warn('connection copy not read',e)}
  connReady=true;await connKeep();if(n)console.warn(`put back ${n} connection setting(s) this browser's storage had lost`);return n}).catch(()=>{connReady=true;return 0});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')connKeep()});
/* read-modify-write inside ONE transaction, so a sync finishing at the same moment can't overwrite it */
const atomic=(store,key,fn)=>dbRetry('readwrite',d=>new Promise((ok,no)=>{const t=d.transaction(store,'readwrite'),s=t.objectStore(store);let out;
  const q=s.get(key);q.onsuccess=()=>{out=fn(q.result);if(out&&out.put)s.put(out.put);if(out&&out.del)s.delete(key)};t.oncomplete=()=>ok(out&&out.value);t.onerror=t.onabort=txFail(t,no)}));
const addTombstones=add=>atomic('meta','tombstones',r=>{const v={...(r&&r.v||{})};for(const [id,t] of Object.entries(add))v[id]=Math.max(v[id]||0,t);return {put:{k:'tombstones',v},value:v}});
// every local edit is timestamped and triggers a (debounced) backup; deletions leave a tombstone so they sync too
const putRaw=i=>tx('readwrite',s=>s.put(i));
/* a start-up fix-up saves an item only while it is still the copy on screen: an edit or a sync may have replaced it meanwhile, and saving the
   old copy (stamped newest) would undo that change (2026-11-14) */
const stillCur=it=>items.find(x=>x.id===it.id)===it;
/* and redraws the Wardrobe only when it is on screen and Settings is not open (renderWardrobe closes Settings; these now run after the first
   pull, which can be while Settings is open); the Wardrobe is drawn afresh when it is opened */
const fixupRedraw=()=>{if(typeof settingsOpen==='function'&&settingsOpen())return;const w=$('#wardrobe');if(w&&!w.hidden)renderWardrobe()};
const put=i=>{i.updated=Date.now();if(typeof kitUserEdit==='function')kitUserEdit(i);   // (an edit in the item sheet makes a sample piece his: kit.js)
const r=putRaw(i);r.then(()=>{window.scheduleSync&&scheduleSync()});return r};
const del=async id=>{await tx('readwrite',s=>s.delete(id));await addTombstones({[id]:Date.now()});window.scheduleSync&&scheduleSync()};


/* precision swatch: a 128 px square of the cloth, cut from the fabric close-up when the card has one (the cloth up close, white-
   balanced), else from the item photo; the Add card's sliders choose the zoom and the spot. Items with a close-up show it as their
   small fabric square across the app (swatchSVG in draw.js). */
function cropSwatch(canvas,zoom=1,cx=.5,cy=.5,light){
  const sampleSize=Math.min(canvas.width,canvas.height)*(0.5/(Number(zoom)||1)),o=document.createElement('canvas');o.width=o.height=128;
  const sx=Math.max(0,Math.min(canvas.width-sampleSize,(Number(cx)||.5)*canvas.width-sampleSize/2)),sy=Math.max(0,Math.min(canvas.height-sampleSize,(Number(cy)||.5)*canvas.height-sampleSize/2));
  o.getContext('2d').drawImage(canvas,sx,sy,sampleSize,sampleSize,0,0,128,128);if(deadCanvas(o))return null;   // drawn black: no swatch (callers keep the one they had)
  if(light)matchLight(o,light);return o.toDataURL('image/jpeg',SW_Q)}
/* a small JPEG (2026-11-15, the owner's option A for the server's writes): a 128 px PNG of cloth was about 38 KB, too big to keep in
   the backup's own text, so every new item cost one more server write for its swatch; as a JPEG it is a few KB, under sync.js PH_MIN,
   and rides inside the backup. Swatches saved before as PNG stay as they are (still shown, still synced by reference) */
const SW_Q=.8;
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
  const sw=cropSwatch(canvas,q.zoom,q.cx,q.cy,q.texCanvas&&q.primaryColor?colOf(q):null);if(!sw)return q.swatch||'';
  q.swatch=sw;q.swSrc=q.texCanvas?'tex':'photo';
  return q.swatch;
}
/* a saved item's swatch, cut from the middle of its close-up (or, without one, its photo) */
async function refreshSwatch(it){if(!FABRIC.includes(it.type))return;const src=it.texture&&TEXTURE_TYPES.includes(it.type)?it.texture:it.photo;if(!src){delete it.swatch;delete it.swSrc;return}
  try{const im=await imgOf(src),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
    const tex=src!==it.photo,sw=cropSwatch(c,1,.5,.5,tex&&it.primaryColor?colOf(it):null);if(!sw){console.warn('swatch not cut: drawn black');return}
    it.swatch=sw;it.swSrc=tex?'tex':'photo'}catch(e){console.warn('swatch not cut',e)}}
/* once: items that already have a close-up get their swatch cut from it, lightness set from the tagged colour (tex_swatch2) */
async function texSwatches(){if(localStorage.getItem('tex_swatch2')==='1')return 0;let n=0;
  for(const it of items)if(it.texture&&TEXTURE_TYPES.includes(it.type)){await refreshSwatch(it);if(it.swSrc==='tex'&&stillCur(it)){await put(it);n++}}
  localStorage.setItem('tex_swatch2','1');if(n)cache={};return n}

function updateSwatchParam(i, param, val){
  queue[i][param]=Number(val);
  generateSwatch(queue[i]);
  const swEl=$(`#swatch-img-${i}`);
  if(swEl) swEl.style.backgroundImage=`url(${queue[i].swatch})`;
}

let aiError='',aiModel='';
/* ---- working on it: while a call to Claude or OpenAI runs (tagging, reading a pattern, making an item picture), a spinning pill
   at the top of the screen says what is happening. Every call
   to the worker's AI endpoints goes through fetch, so one hook catches them all, including new ones. ---- */
const busyJobs=new Map();let busySeq=0;
function busyStart(label){const id=++busySeq;busyJobs.set(id,label);renderBusy();return ()=>{busyJobs.delete(id);renderBusy()}}
function busyLabelFor(u,o){if(!o||String(o.method||'GET').toUpperCase()!=='POST')return null;const w=localStorage.getItem('worker_url');if(!w)return null;
  let a,b;try{a=new URL(u,location.href);b=new URL(w.replace(/\/*$/,'/'))}catch{return null}if(a.origin!==b.origin)return null;
  const p=a.pathname.replace(b.pathname,'/').replace(/\/+$/,'')||'/',body=typeof o.body==='string'?o.body.slice(0,4000):'';
  if(p==='/')return 'Claude is tagging the photo…';if(p==='/tag-many')return 'Claude is finding the items…';if(p==='/pattern')return 'Claude is reading the pattern…';
  if(p==='/describe')return /"what":"pattern"/.test(body)?'Claude is working out the weave…':'Claude is finding the shade…';
  if(p==='/render')return /"mode":"item"/.test(body)?'Making the item picture…':null;   // (item pictures: the only thing POST /render makes now)
  return null}
if(typeof window!=='undefined'&&window.fetch&&!window.fetch.busy){const f0=window.fetch.bind(window);
  window.fetch=function(u,o){const l=busyLabelFor(typeof u==='string'?u:u&&u.url,o);if(!l)return f0(u,o);const end=busyStart(l);const r=f0(u,o);r.then(end,end);return r};window.fetch.busy=1}
function renderBusy(){let el=document.getElementById('busy');if(!el){if(!document.body)return;el=document.createElement('div');el.id='busy';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}
  const live=[...busyJobs.values()];
  document.body.classList.toggle('busy-on',!!live.length);if(!live.length){el.classList.remove('on');return}
  el.innerHTML=`<span class="spin" aria-hidden="true"></span><span>${esc(live[live.length-1])}${live.length>1?` <small>+${live.length-1}</small>`:''}</span>`;el.classList.add('on')}
/* the tab bar grows upward until its top is one design gap (--gap, 12px) below Today's below-the-waist tiles, so nothing peeks out
   between them (the score card's top used to); at most 64px, and never shorter than its 38px buttons. Measured with the page at the
   top, from where the tiles end and where the bar's natural top is; kept while on other pages and on days whose tiles sit lower. */
const NAV_MAX=58;   // (the bar is 44px at least since 2026-11-14, a tap target's size; it was 38 and grew up to 64, so the tallest is the same 102)
function fitNav(){const b=document.querySelector('#today:not([hidden]) .below'),nav=document.querySelector('body>nav');if(!nav)return;
  // the fit is measured only on a day whose photo has loaded: before it loads the photo has no height, the tiles sit right under the
  // date, and the bar grew to its 64px cap (and was kept there). That measurement is kept per screen size and used everywhere else
  // (a day with only the drawing and its Generate button, whose tiles sit lower; a weekend with no tiles), so the bar keeps one size.
  const k='nav_fit2:'+innerWidth+'x'+innerHeight;let kept=0;try{kept=+localStorage.getItem(k)||0}catch{}
  const img=document.querySelector('#today:not([hidden]) #mannequin-container > img'),ready=!!(b&&img&&img.complete&&img.naturalHeight>0&&img.getBoundingClientRect().height>60);
  let x=kept;
  if(ready){const gap=parseFloat(getComputedStyle(document.querySelector('#today')).getPropertyValue('--gap'))||12;
    const cs=getComputedStyle(nav),natural=innerHeight-44-(parseFloat(cs.paddingBottom)||0)-(parseFloat(cs.borderTopWidth)||0);   // the bar's top without the growth (not measured: its height may be mid-transition)
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
const aiLabel=q=>!q.ai?'Not tagged by AI: fill in the details.':/^claude/.test(q.model||'')?'Tagged by Claude.':'Tagged by AI.';   // (no model name: a tester read "Tagged by Claude (claude-mock)")
/* tag one item: its photo (a data URL, or a canvas), plus the close-up, the measurement and the rest (tagExtras in tagging.js) */
async function ask(c,extra){
  const {signal,...ex}=extra||{};   // signal: Stop on an Add card calls the reading off (add.js stopRead)
  try {
    const workerUrl=localStorage.getItem('worker_url');
    if(!workerUrl) return null;
    if(typeof inviteOver==='function'&&inviteOver())return null;   // an ended invitation: the photo isn't sent (it was, and refused; re-audit 2026-11-15)
    const dataUrl=typeof c==='string'?c:c.toDataURL('image/jpeg',TAG_Q);
    const res=await fetch(workerUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-app-token':localStorage.getItem('app_token')||''},
      body:JSON.stringify({image:dataUrl,appToken:localStorage.getItem('app_token')||'',...tagExtras(ex)}),
      ...(signal?{signal}:{})
    });
    if(!res.ok){let e='',j={};try{j=await res.json();e=j.detail||j.error||''}catch{}
      if(typeof endedAnswer==='function'&&endedAnswer(res.status,j)){inviteEnded(localStorage.getItem('app_token')||'',j);aiError='';return null}   // found out here: said as ended (sync.js), the card has no Try again
      aiError=tagFailText(res.status,j,e);return null}
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
    if(e&&e.name==='AbortError')return null;   // stopped on purpose: no failure to report
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

/* the picture of a file; its object URL is let go once it has loaded (each one held the file's bytes until the page closed) */
const loadImg=f=>new Promise((ok,no)=>{const i=new Image(),u=URL.createObjectURL(f);i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=e=>{URL.revokeObjectURL(u);no(e)};i.src=u});
// on white: a transparent picture (a product cut-out) is saved as a JPEG, which has no transparency, and its clear parts turned black
// (2026-11-14, the owner's socks); white is what such a cut-out is meant to sit on, and reads as the white reference it is
/* a canvas the browser drew as pure black (2026-11-15, the owner's desktop browser: once its graphics failed every picture drawn came out
   black, and a crop and a swatch were saved that way): every pixel's channels at most DEAD_MAX, read at 16x16. A real photo of black cloth
   still has texture and noise well above it (his Black suit's darkest swatch reads up to 26) */
const DEAD_MAX=3,DEAD_MSG='Your browser stopped drawing pictures (its graphics failed), so nothing was saved. Reload the page and try again.';
function deadCanvas(c){try{const N=16,t=document.createElement('canvas');t.width=t.height=N;const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,N,N);
  const d=x.getImageData(0,0,N,N).data;for(let k=0;k<d.length;k+=4)if(d[k]>DEAD_MAX||d[k+1]>DEAD_MAX||d[k+2]>DEAD_MAX)return false;return true}catch{return false}}
async function deadPic(url){try{const im=await imgOf(url);return deadCanvas(im)}catch{return false}}
function shrink(img,max){const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);return c}

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


const cap1=t=>{t=String(t??'');return t&&t[0].toUpperCase()+t.slice(1)};   // option labels start with a capital ("Grey", "Solid"); values stay as they are
const S=(list,v,k,i)=>`<select onchange="setq(${i},'${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${cap1(x[1])}</option>`).join('')}</select>`;


/* ---- what a screen reader hears, and where the keyboard stays, when part of the page is drawn again (fix round 3, W2-19-01: after
   Next day, the Wore pill or a pick, the control pressed was replaced by the redraw, focus fell to <body>, and nothing said the outfit
   had changed) ----
   announce(text): said once by the polite live region #sr-live (index.html; out of sight). Emptied first, then written in the next
   frame, so the same words are said again.
   keepFocus(root, draw): runs draw(); when the focus was on a control inside root that the redraw replaced, the control with the same
   id, or else the same handler (onclick / onchange / oninput) and data-k / data-c, gets it back (the same words first when there are
   several). Here, not in ui.js: Today is drawn by the start-up chain, which can run before ui.js has loaded. */
let srLiveT=0;
function announce(text){const el=document.querySelector('#sr-live');if(!el)return;const t=String(text||'').replace(/\s+/g,' ').trim();clearTimeout(srLiveT);el.textContent='';
  if(t)srLiveT=setTimeout(()=>{el.textContent=t},60)}
const FOCUS_ATTRS=['onclick','onchange','oninput','data-k','data-c','data-s'];
function focusKey(el){if(!el||el===document.body||!el.tagName)return null;
  return {el,id:el.id||'',tag:el.tagName,at:FOCUS_ATTRS.map(a=>el.getAttribute(a)||''),label:el.getAttribute('aria-label')||'',text:(el.textContent||'').trim().slice(0,60)}}
function focusFind(root,k){if(!k||!root)return null;
  if(k.id){const e=document.getElementById(k.id);if(e&&root.contains(e))return e}
  if(!k.at.some(Boolean))return null;
  const same=[...root.querySelectorAll(k.tag)].filter(e=>FOCUS_ATTRS.every((a,j)=>(e.getAttribute(a)||'')===k.at[j]));
  return same.find(e=>(e.getAttribute('aria-label')||'')===k.label&&(e.textContent||'').trim().slice(0,60)===k.text)||same.find(e=>(e.getAttribute('aria-label')||'')===k.label)||same[0]||null}
function keepFocus(root,draw){const a=document.activeElement,k=root&&a&&a!==document.body&&root.contains(a)?focusKey(a):null;
  const r=draw();
  if(k&&!(k.el.isConnected&&root.contains(k.el))){const e=focusFind(root,k);if(e&&!e.closest('[inert]'))try{e.focus({preventScroll:true})}catch{}}
  return r}
