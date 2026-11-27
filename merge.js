/* Daily Wardrobe: the merge rules, one copy for the app and the server (the code review's CR-6-12 / CR-5-12, Round B, 2026-11-17).
   Two wardrobe snapshots {items, tombstones, days, settings} merge record by record: items and days field by field by their field
   stamps, settings setting by setting and entry by entry, a deletion (tombstone) over any older edit.
   - The app loads it as a classic script before core.js (index.html, analysis-worker.js): its names are globals, as they were in core.js.
   - The worker imports it (worker/backup.js: `import '../merge.js'`) and takes the same functions from globalThis.DW_MERGE.
   No DOM, no storage and no other file's names, so it runs in the page, a Web Worker, the Cloudflare worker and Node alike.
   Where the two sides always differed, the caller says so (mergeStateBy's `o`, the `num` and `lax` flags); called as the app always
   called them, every function gives exactly what core.js's did. tests/mergeshared.test.js runs the same cases through both. */

const stamp=i=>i&&(i.updated||i.added)||0;
/* ---- items field by field (fix round 3, 2026-11-16, the audit's W1-5-01: two phones changed different fields of one piece, a rename on
   one and "Take out of rotation" on the other, and the later save's whole item won: the rename was gone without a word). An item saved by
   put() (app.js) carries fs = {u, b, s}: u = the item's stamp when fs was worked out, b = the stamp of every field not in s, s = the stamp
   of each field changed after b (a removed field too). itemFields (core.js) works them out against the stored copy the edit was made on.
   A copy whose fs.u isn't its own stamp (saved by an older app, or restamped whole: Undo of a delete, a roll-back, the sample) counts its
   one stamp for every field, as before. mergeItem takes each field from the copy with the newer stamp for it, ties to the newer copy; when
   it takes anything from the copy with the older stamp, the result's stamp is one above both, so the phone holding it uploads it and it
   wins on the other phones too (one upload, as before). */
const ITEM_META=['id','added','updated','fs'];
const fsOk=i=>!!(i&&i.fs&&typeof i.fs==='object'&&i.fs.u===stamp(i)&&i.fs.s&&typeof i.fs.s==='object');
const fieldStamp=(i,k)=>fsOk(i)?(Object.prototype.hasOwnProperty.call(i.fs.s,k)?+i.fs.s[k]||0:+i.fs.b||0):stamp(i);
/* the oldest field of a copy: an edit made on a copy from before a deletion keeps the fields it didn't touch at their old stamps (W1-6-06,
   W1-5-05: a phone that hadn't heard of a delete or a roll-back brought the piece back by editing it); a whole restamp (Undo) is new */
const itemBase=i=>fsOk(i)?+i.fs.b||0:stamp(i);
/* a deletion wins over a copy whose oldest field is no newer than it: an edit made on a copy from before the deletion doesn't bring the
   piece back (the phone that made it is told: sync.js applyMerged); Undo of a delete, restamped whole after it, does */
const tombWins=(t,i)=>!!t&&t>=itemBase(i);
const sameVal=(x,y)=>x===y||(x!=null&&y!=null&&typeof x==='object'&&typeof y==='object'&&JSON.stringify(x)===JSON.stringify(y));
const fsPack=(u,s)=>{const v=Object.values(s),b=v.length?Math.min(...v):u,o={};for(const [k,t] of Object.entries(s))if(t>b)o[k]=t;return {u,b,s:o}};
function mergeItem(a,b){
  const ua=stamp(a),ub=stamp(b),hi=ua>=ub?a:b;
  if(a===b||(!fsOk(a)&&!fsOk(b)))return hi;   // two copies without field stamps: the newer whole, as always
  const out={},s={};let mixed=false;
  for(const k of new Set([...Object.keys(a),...Object.keys(b),...(fsOk(a)?Object.keys(a.fs.s):[]),...(fsOk(b)?Object.keys(b.fs.s):[])])){if(ITEM_META.includes(k))continue;
    const sa=fieldStamp(a,k),sb=fieldStamp(b,k),w=sa===sb?hi:sa>sb?a:b;
    if(w!==hi&&!sameVal(w[k],hi[k]))mixed=true;
    if(w[k]!==undefined)out[k]=w[k];s[k]=Math.max(sa,sb)}
  if(!mixed)return hi;
  const u=Math.max(ua,ub)+1,added=hi.added??(hi===a?b:a).added;
  return {id:hi.id,...(added!=null?{added}:{}),...out,updated:u,fs:fsPack(u,s)}}
/* a snapshot's list: the app's `x||[]`; with lax (the server: what it is sent comes from anywhere) only an array counts */
const mergeList=(x,lax)=>lax?(Array.isArray(x)?x:[]):(x||[]);
/* two snapshots merged. o (the side's own ways, always so):
   now()  the clock that forgets deletions older than 180 days (the app: nowMs, the server's corrected time; the server: Date.now)
   old(s) what two settings copies from before setting stamps (no ks) give: the newer whole, as it is, or keyed (the app: keySettings)
   num    a setting's stamp read as a number (the server)
   lax    a record that isn't one (no id, no date, not an object) is passed over and a deletion mark read as a number (the server)
   drop(item)  a piece never kept (the server: a sample piece the person hasn't made his, worker/backup.js sampleOnly) */
function mergeStateBy(a,b,o){
  a=a||{};b=b||{};const L=o.lax,items={},tomb={...(a.tombstones||{})};
  for(const [id,t] of Object.entries(b.tombstones||{}))tomb[id]=Math.max(tomb[id]||0,L?+t||0:t);
  for(const it of [...mergeList(a.items,L),...mergeList(b.items,L)]){if(L&&(!it||it.id==null))continue;const cur=items[it.id];items[it.id]=cur?mergeItem(cur,it):it}
  for(const id of Object.keys(items))if(tombWins(tomb[id],items[id])||(o.drop&&o.drop(items[id])))delete items[id];
  const cutoff=o.now()-180*864e5;for(const id of Object.keys(tomb))if(tomb[id]<cutoff)delete tomb[id];   // forget old deletions
  const days={};for(const d of [...mergeList(a.days,L),...mergeList(b.days,L)]){if(L&&(!d||!d.date))continue;const cur=days[d.date];days[d.date]=cur?mergeDay(cur,d):d}
  const settings=a.settings&&b.settings?mergeSettingsBy(a.settings,b.settings,o):(a.settings||b.settings||null);
  return {items:Object.values(items),tombstones:tomb,days:Object.values(days),settings};
}
/* ---- settings, setting by setting (2026-11-14, the audit: two phones each changing a different setting, the later save dropped the
   other's change, as whole copies won by their one stamp). Each setting has its own stamp (settings.ks) and a fingerprint of the value
   it was stamped with (settings.kh): stampSettings (core.js), called wherever the settings are saved, stamps only the settings whose value
   changed since (a new or a removed one too). mergeSettingsBy takes each setting from the copy with the newer stamp for it; a copy saved
   before (no ks) counts its one stamp for every setting, so two old copies merge as before. When the merge takes anything from the copy
   with the older overall stamp, the result's overall stamp is one above both, so it is uploaded (sync.js sends settings newer than the
   server's) and wins on the other devices too. */
const SET_META=['updated','ks','kh','kse','khe'];
const setHash=v=>{const s=JSON.stringify(v===undefined?null:v);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
const setKeys=s=>Object.keys(s||{}).filter(k=>!SET_META.includes(k));
/* ---- a setting made of entries, entry by entry (fix round 3, 2026-11-16, the audit's W1-5-06 and W1-5-03: an own color made on each of
   two phones, or Care's "Ties after 5" on one and "Blazers after 8" on the other: each setting was one value with one stamp, so the later
   phone's whole list won; the lost color left its tie "Color: None", drawn gray). Own colors and patterns (by key), Care and the dress code
   (by name), workdays, blazer days and hidden What to buy ideas (each in or out) and own days off (by date) keep a stamp per entry,
   settings.kse[k] ({'': the stamp of every entry not listed, entry: its stamp}), and each entry's fingerprint when stamped, settings.khe[k]
   ('-' = removed; '#' = the whole value's, so a copy changed by an older app, which doesn't know them, is seen and counted whole).
   stampSettings stamps the entries that changed; mergeSettingsBy merges such a setting entry by entry when the two copies differ on it.
   A copy without them counts the setting's one stamp for every entry, as before. */
// (own materials, 2026-11-16: ownMaterials {type: [name]}, entry by entry as 'type/name')
// (the calendar's kept and dismissed events, 2026-11-17: calSeen {id: 'k'|'x'}, entry by entry, so two phones' choices both stay)
// (favorites, 2026-11-18: fav {looks:[{j,sh,tie,at}], items:[id]}, entry by entry as 'l/j|sh|tie' and 'i/id', so a look loved on one phone
// and a piece on the other both stay, and a heart taken back on one phone goes on the other)
const SET_SPLIT={custom:'custom',care:'obj',dress:'obj',workdays:'set',blazerDays:'set',shopSkip:'set',daysOff:'list',ownMaterials:'mats',calSeen:'obj',fav:'fav'};
/* the entries of setting k's value v (a Map), or null for a value of another shape (then it is merged whole) */
function setEntries(k,v){const t=SET_SPLIT[k],m=new Map();if(v==null)return m;
  if(t==='obj'){if(typeof v!=='object'||Array.isArray(v))return null;for(const e of Object.keys(v))m.set(e,v[e])}
  else if(t==='set'){if(!Array.isArray(v))return null;for(const x of v)if(x!=null&&typeof x!=='object')m.set(String(x),x);else return null}
  else if(t==='list'){if(!Array.isArray(v))return null;for(const x of v){if(!x||typeof x!=='object'||!x.d)return null;m.set(String(x.d),x)}}
  else if(t==='mats'){if(typeof v!=='object'||Array.isArray(v))return null;for(const g of Object.keys(v)){const l=v[g];if(!Array.isArray(l))return null;for(const x of l){if(typeof x!=='string')return null;m.set(g+'/'+x,x)}}}
  else if(t==='fav'){if(typeof v!=='object'||Array.isArray(v))return null;const L=v.looks??[],I=v.items??[];if(!Array.isArray(L)||!Array.isArray(I))return null;
    for(const l of L){if(!l||typeof l!=='object'||typeof l.sh!=='string')return null;m.set('l/'+(l.j||'-')+'|'+l.sh+'|'+(l.tie||'-'),l)}
    for(const x of I){if(typeof x!=='string')return null;m.set('i/'+x,x)}}
  else if(t==='custom'){if(typeof v!=='object'||Array.isArray(v))return null;
    for(const g of Object.keys(v)){const l=v[g];if(g!=='colors'&&g!=='patterns'){m.set('@'+g,l);continue}if(!Array.isArray(l))return null;for(const x of l){if(!x||typeof x!=='object'||!x.key)return null;m.set(g+'/'+x.key,x)}}}
  else return null;
  return m}
function setJoin(k,m){const t=SET_SPLIT[k],v=[...m.values()];
  if(t==='obj')return Object.fromEntries(m);
  if(t==='set')return v.every(x=>typeof x==='number')?v.sort((a,b)=>a-b):v.sort();
  if(t==='list')return v.sort((a,b)=>String(a.d)<String(b.d)?-1:String(a.d)>String(b.d)?1:0);
  if(t==='fav'){const looks=[],items=[];for(const [e,x] of m)(e[0]==='l'?looks:items).push(x);   // (looks in the order they were loved)
    looks.sort((a,b)=>(+a.at||0)-(+b.at||0)||(String(a.sh)<String(b.sh)?-1:String(a.sh)>String(b.sh)?1:0));items.sort();return {looks,items}}
  if(t==='mats'){const o={};for(const [e,x] of m){const g=e.slice(0,e.indexOf('/'));(o[g]=o[g]||[]).push(x)}for(const g of Object.keys(o))o[g].sort();return o}
  const o={colors:[],patterns:[]};for(const [e,x] of m){if(e[0]==='@')o[e.slice(1)]=x;else o[e.slice(0,e.indexOf('/'))].push(x)}return o}
/* setting k's stamp in copy s (num: read as a number, the server's way; the app takes it as stored) */
const setStampOf=(s,k,num)=>s.ks?(num?+s.ks[k]||0:s.ks[k]||0):(s.updated||0);
const subOk=(s,k)=>!!(s&&s.kse&&s.kse[k]&&s.khe&&s.khe[k]&&s.khe[k]['#']===setHash(s[k]));
const subStampOf=(s,k,e,num)=>subOk(s,k)?(Object.prototype.hasOwnProperty.call(s.kse[k],e)?+s.kse[k][e]||0:+s.kse[k]['']||0):setStampOf(s,k,num);
/* setting k of a and b (they differ) entry by entry -> {v, mixed, se, he}, or null when a value isn't of its shape */
function mergeSplit(a,b,k,hi,num){const ma=setEntries(k,a[k]),mb=setEntries(k,b[k]);if(!ma||!mb)return null;
  const mh=hi===a?ma:mb,lo=hi===a?b:a,ml=hi===a?mb:ma,m=new Map(),se={},he={};let mixed=false;
  const keys=new Set([...mh.keys(),...ml.keys(),...Object.keys(subOk(a,k)?a.khe[k]:{}),...Object.keys(subOk(b,k)?b.khe[k]:{})]);keys.delete('#');keys.delete('');
  for(const e of keys){const xh=subStampOf(hi,k,e,num),xl=subStampOf(lo,k,e,num),mw=xl>xh?ml:mh;
    if(mw!==mh&&(mw.has(e)!==mh.has(e)||(mw.has(e)&&setHash(mw.get(e))!==setHash(mh.get(e)))))mixed=true;
    if(mw.has(e)){m.set(e,mw.get(e));he[e]=setHash(mw.get(e))}else he[e]='-';se[e]=Math.max(xh,xl)}
  const v=mixed?setJoin(k,m):hi[k],st=Object.values(se),base=st.length?Math.min(...st):Math.max(setStampOf(a,k,num),setStampOf(b,k,num)),cs={'':base};
  for(const [e,x] of Object.entries(se))if(x>base)cs[e]=x;
  return {v,mixed,se:cs,he:{...he,'#':setHash(v)}}}
/* two settings copies merged (o as mergeStateBy's: old, num) */
function mergeSettingsBy(a,b,o){
  const ua=a.updated||0,ub=b.updated||0,hi=ua>=ub?a:b,n=o.num;if(!a.ks&&!b.ks)return o.old?o.old(hi):hi;   // two copies from before: the newer whole, as always
  const out={},ks={},kh={},kse={},khe={};let mixed=false;
  for(const k of new Set([...setKeys(a),...setKeys(b),...Object.keys(a.ks||{}),...Object.keys(b.ks||{})])){
    const sa=setStampOf(a,k,n),sb=setStampOf(b,k,n);
    // a setting of entries both copies changed: entry by entry (own colors, Care, workdays …)
    const r=SET_SPLIT[k]&&(subOk(a,k)||subOk(b,k))&&setHash(a[k])!==setHash(b[k])?mergeSplit(a,b,k,hi,n):null;
    if(r){if(r.mixed)mixed=true;if(r.v!==undefined)out[k]=r.v;ks[k]=Math.max(sa,sb);kh[k]=r.v===undefined?'-':setHash(r.v);kse[k]=r.se;khe[k]=r.he;continue}
    const w=sa===sb?hi:sa>sb?a:b;
    if(w!==hi&&setHash(w[k])!==setHash(hi[k]))mixed=true;
    if(k in w)out[k]=w[k];ks[k]=Math.max(sa,sb);kh[k]=w.kh&&w.kh[k]||setHash(w[k]);
    if(SET_SPLIT[k]&&subOk(w,k)){kse[k]=w.kse[k];khe[k]=w.khe[k]}}
  out.ks=ks;out.kh=kh;if(Object.keys(kse).length){out.kse=kse;out.khe=khe}out.updated=mixed?Math.max(ua,ub)+1:Math.max(ua,ub);
  return mixed?out:(hi.ks?hi:Object.assign(out,{updated:hi.updated||0}))}
/* of two copies of a day, the newer (n) wins, unless it is only the app's lock of the week (app.js lockUpcoming: lockOnly, base = the
   version of the record it was built on) and the older (o) was changed after that version: then the older wins whole, with its own
   lock or none, and the app locks the day again around it (2026-11-14: a phone two days behind locked Nov 17 on its old copy and its
   newer stamp replaced the owner's pick made on another device). */
/* (when the older is itself only a lock, what counts is the version it was built on: two locks of one day don't override each other's
   base, so the newer lock wins unless the older was built on a newer version) */
const dayWins=(o,n)=>!o||o===n||!n.lockOnly?n:((o.lockOnly?o.base:o.updated)||0)>(n.base||0)?o:n;
/* ---- a day field by field (fix round 3, 2026-11-16, the audit's W1-5-02: a tie picked for a day on one phone and a shirt on the other, or
   "Didn't wear" on one and a belt on the other: the day saved last won whole and the other phone's choice was lost). A day saved by
   saveDay or the week's lock (history.js) carries fs like an item (core.js dayFields, against the stored copy); the picks, the pieces
   skipped or taken off and the pieces recorded count slot by slot (DAY_SUB: 'force.tie'). A pick fixes every other slot to what the day
   showed too: such an entry, the piece already recorded for that slot, is not counted as a change. A copy without fs counts its one stamp
   for every field, as before, except the app's lock of the week (lockOnly), whose fields other than the lock are the version it was built
   on (base), as dayWins says; and the lock itself keeps dayWins' rule. */
const DAY_META=['date','updated','fs','lockOnly','base','lockAt'],DAY_SUB=['force','skip','off','ids'];
function dayFlat(d){const o={};for(const k of Object.keys(d||{})){if(DAY_META.includes(k))continue;const v=d[k];
  if(DAY_SUB.includes(k)&&v&&typeof v==='object'&&!Array.isArray(v)){for(const s of Object.keys(v))o[k+'.'+s]=v[s]}else o[k]=v}return o}
function dayUnflat(o){const r={};for(const [k,v] of Object.entries(o)){const i=k.indexOf('.'),g=i>0?k.slice(0,i):'';
  if(g&&DAY_SUB.includes(g)){if(!r[g]||typeof r[g]!=='object')r[g]={};r[g][k.slice(i+1)]=v}else if(!(k in r))r[k]=v}return r}
const dayStamp=(d,k)=>fsOk(d)?fieldStamp(d,k):d.lockOnly?(k==='lock'?stamp(d):+d.base||0):stamp(d);
function mergeDay(a,b){
  if(a===b)return a;const ua=a.updated||0,ub=b.updated||0;
  if(!fsOk(a)&&!fsOk(b))return ub>ua?dayWins(a,b):dayWins(b,a);   // as before
  const hi=ua>=ub?a:b,fa=dayFlat(a),fb=dayFlat(b),fh=hi===a?fa:fb,out={},s={};let mixed=false,lockW=null;
  for(const k of new Set([...Object.keys(fa),...Object.keys(fb),...(fsOk(a)?Object.keys(a.fs.s):[]),...(fsOk(b)?Object.keys(b.fs.s):[])])){
    const sa=dayStamp(a,k),sb=dayStamp(b,k);let w=sa===sb?hi:sa>sb?a:b;
    if(k==='lock'){const o=w===a?b:a;if(w.lockOnly&&dayWins(o,w)===o)w=o;lockW=w}   // the week's lock: dayWins' rule
    const fw=w===a?fa:fb;if(w!==hi&&!sameVal(fw[k],fh[k]))mixed=true;
    if(fw[k]!==undefined)out[k]=fw[k];s[k]=Math.max(sa,sb)}
  if(!mixed)return hi;
  const u=Math.max(ua,ub)+1,r=/** @type {Record<string, any>} */ ({date:hi.date,...dayUnflat(out),updated:u});
  if(r.lock&&lockW&&lockW.lockAt!=null)r.lockAt=lockW.lockAt;r.fs=fsPack(u,s);return r}
/* compact fingerprint of a snapshot, to tell whether a merge changed anything (lax: as mergeStateBy's) */
function stateSig(s,lax){
  s=s||{};const by=(arr,k,v)=>mergeList(arr,lax).map(x=>x[k]+':'+v(x)).sort().join(',');
  return [by(s.items,'id',stamp),Object.entries(s.tombstones||{}).map(e=>e.join(':')).sort().join(','),by(s.days,'date',d=>d.updated||0),s.settings?s.settings.updated||0:''].join('|');
}
/* for the worker, an ES module, where the names above stay inside this file */
globalThis.DW_MERGE={stamp,ITEM_META,fsOk,fieldStamp,itemBase,tombWins,sameVal,fsPack,mergeItem,mergeStateBy,SET_META,setHash,setKeys,SET_SPLIT,setEntries,setJoin,setStampOf,subOk,subStampOf,mergeSplit,mergeSettingsBy,dayWins,DAY_META,DAY_SUB,dayFlat,dayUnflat,dayStamp,mergeDay,stateSig};
