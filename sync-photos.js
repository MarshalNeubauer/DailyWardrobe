/* Daily Wardrobe: photos in a sync (split from sync.js, 2026-11-17): photos sent and kept as references, fetched or sent by the
   small sync, and the uploads split into batches. Loaded after sync.js; used only while a sync runs. */
/* (2026-11-15, the owner's option A for the server's writes) a data string of PH_MIN characters or more is a photo, sent and kept as its
   own server value; a shorter one (the 128 px JPEG swatch, a few KB) stays inline in the record, so an item added costs one write less.
   Strings from PH_OLD (the rule before) may still be references in records saved by an older app or worker (a PNG swatch): they are
   still matched to this device's copy and taken when downloaded. worker/backup.js has the same two numbers */
const PH_MIN=16384,PH_OLD=256,PH_RE=/^dwph:[0-9a-f]{20}$/,PH_BATCH=40;
const isPh=s=>typeof s==='string'&&s.length>=PH_MIN&&s.startsWith('data:');
const isPhOld=s=>typeof s==='string'&&s.length>=PH_OLD&&s.startsWith('data:');
const phMemo=new Map();
async function phHash(s){let h=phMemo.get(s);if(h)return h;
  const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));h=[...d.subarray(0,10)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(phMemo.size>2000)phMemo.clear();phMemo.set(s,h);return h}
function phStrings(x,test,out=new Set()){if(typeof x==='string'){if(test(x))out.add(x)}else if(Array.isArray(x))for(const v of x)phStrings(v,test,out);else if(x&&typeof x==='object')for(const k in x)phStrings(x[k],test,out);return out}
function phMap(x,f){if(typeof x==='string')return f(x);if(Array.isArray(x))return x.map(v=>phMap(v,f));if(x&&typeof x==='object'){const o={};for(const k in x)o[k]=phMap(x[k],f);return o}return x}
/* the references in records from the backup, replaced by the photos: this device's own copy when it has it (the same item's photos are
   compared), else downloaded, PH_BATCH at a time */
async function phIn(recs,local,url,token){
  const refs=[...phStrings(recs,s=>PH_RE.test(s))].map(s=>s.slice(5));if(!refs.length)return recs;
  const ids=new Set((recs.items||[]).map(i=>i.id)),known=new Map();
  for(const s of phStrings([local.items.filter(i=>ids.has(i.id)),local.days,local.settings],isPhOld))known.set(await phHash(s),s);
  const need=refs.filter(h=>!known.has(h));
  for(let i=0;i<need.length;i+=PH_BATCH){const r=await fetch(url+'?ph='+need.slice(i,i+PH_BATCH).join(','),{headers:{'x-app-token':localStorage.getItem('app_token')||token},cache:'no-store'}),j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.message||j.error||'HTTP '+r.status);for(const [h,s] of Object.entries(j.photos||{}))if(isPhOld(s))known.set(h,s)}
  if(refs.some(h=>!known.has(h)))throw new Error('a photo is missing from the backup');
  return phMap(recs,s=>PH_RE.test(s)?known.get(s.slice(5)):s)}
/* records to send: photos as references, and the photos the backup doesn't have (have: its hashes) */
async function phOut(recs,have){const strs=[...phStrings(recs,isPh)],by=new Map(),photos={};
  for(const s of strs){const h=await phHash(s);by.set(s,h);if(!have.has(h))photos[h]=s}
  return {recs:by.size?phMap(recs,s=>by.has(s)?'dwph:'+by.get(s):s):recs,photos}}
/* (2026-11-16, the audit's W2-18-01) photos go up in batches: one POST carries at most SYNC_SEND_MAX of photos and records (the worker
   refuses a body over 48 MB, BACKUP_MAX, and a phone restoring a file onto a new account sent 61 MB at every close, storing nothing).
   The day records, settings and deletions always go in the first batch (small, and the day's wear is what matters most); items go in
   their order until the next one's new photos would pass the budget (one item always goes). -> {up: the batch, left: items held back} */
async function phBatch(up,have,max=SYNC_SEND_MAX){
  let size=JSON.stringify({...up,items:[]}).length;const pick=[],taken=new Set(have);
  for(let k=0;k<up.items.length;k++){const it=up.items[k];let add=0;const hs=[];
    for(const s of phStrings(it,isPh)){const h=await phHash(s);if(!taken.has(h)){hs.push(h);add+=s.length}}
    const own=JSON.stringify(phMap(it,s=>isPh(s)?'dwph:'+'0'.repeat(20):s)).length;
    if(pick.length&&size+add+own>max)return {up:{...up,items:pick},left:up.items.length-k};
    size+=add+own;pick.push(it);for(const h of hs)taken.add(h)}
  return {up,left:0}}
/* An ES module (2026-11-23): its names are its own. The bridge (tests/bridge.test.js lists it): sync.js, a classic script, calls phIn, phOut and phBatch while a sync runs; PH_MIN, isPh, phStrings and phMap are read
   by tests/backup-storage.test.js and the replay script lib-verify18.js. */
Object.assign(globalThis,{phIn,phOut,phBatch});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,PH_MIN,isPh,phMap,phStrings};
export {PH_MIN,isPh,phStrings,phMap,phIn,phOut,phBatch};
