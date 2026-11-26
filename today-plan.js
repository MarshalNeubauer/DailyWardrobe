/* Daily Wardrobe: Today's plan: the month's plan (planMonth, planFor, the plan cache and planDirty), the days before the wardrobe existed
   (planStartDay, planTrim) and the month kept on the device so start-up draws Today at once (PLAN_SNAP: planSig, snapOut/snapIn,
   planSnapUse, planSnapSoon; planSnapCheck, which records the days, is in today.js)
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of today.js on 2026-11-17, Round C.) */
/* the plan for a month. Every month from two months back shares one simulation (kept in the cache, so anything that clears
   the cache starts it again): another month only plans the days not planned yet. Earlier months are built on their own. */
import {climate,dayRecs,isoKey,items,settings,todayDate,weather} from './core.js';
import {idsOf,keyDate} from './days.js';
import {metaPut,view} from './app.js';
let cache={};
/* the one way to throw the plan away (Round B, CR-7-07: `cache={}` was written from 16 files): anything that changes what the planner
   sees (the wardrobe, the history, the settings, the weather) calls it */
function planDirty(){cache={}}
const planRuns=[];   // the months worked out (not from the cache) since start-up (tests/speed.test.js)
function planMonth(y,m){const k=y+'-'+m;if(cache[k])return cache[k];if(planRuns.length<200)planRuns.push(k);
  if(window.TEST_PLAN)return cache[k]=TEST_PLAN.plan(y,m);   // tests that don't need the planner (tests/fixedplan.js)
  const start=planStart(y,m),T=todayDate();
  if(+start!==+planStart(T.getFullYear(),T.getMonth()))return cache[k]=planTrim(buildPlan(y,m));
  return cache[k]=planTrim((cache.sim||(cache.sim=planSim(start))).upTo(new Date(y,m+1,0)))}
/* no outfit is shown for a day before the wardrobe existed (the day the first item was added; items from before `added` existed set no
   start): a new user saw two weeks of planned past days with ✕ and ✓ and "22 outfits" in the month (audit 2026-11-13). The planner
   still plans them (rest and variety carry on from them); they are only left out of the month's plan, and a day with a record stays */
function planStartDay(){let s=Infinity;for(const i of items){if(!i.added)return null;if(i.added<s)s=i.added}if(!isFinite(s))return null;const d=new Date(s);d.setHours(0,0,0,0);return d}
function planTrim(plan){const s=planStartDay();if(!s)return plan;const T=todayDate();
  for(const k of Object.keys(plan)){const d=keyDate(k);if(d<s&&d<T&&!(dayRecs[k]&&dayRecs[k].ids))delete plan[k]}return plan}
const planFor=()=>planMonth(view.y,view.m);
/* (from today.js, the restructure S3e, 2026-11-26: Today, the month, the score card, the pictures and the rest ask it of a planned day) */
const hasOutfit=o=>!!o&&!!(o.top||o.shirt);   // a day without a jacket (the no-jacket occasion) still has an outfit
/* ---- Today's month as last planned, kept in IndexedDB (meta PLAN_SNAP), so start-up draws Today without waiting for the planner
   (200-390 ms frozen at phone speed, audit 2026-11-13). Used only when nothing it depends on changed (planSig: the day, the items' and
   day records' stamps, the settings' stamp, the forecast and climate); the month is planned again as soon as the phone is idle
   (planSnapCheck) and Today redrawn only if it differs. While the kept month is on screen nothing is recorded or locked from it
   (recordDays/lockUpcoming wait for the real plan). Pieces are kept as their ids plus what the planner added (rest), not as copies
   of the items (their photos). ---- */
const PLAN_SNAP='plan_snap';
const strHash=t=>{let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(36)};
const planSig=()=>strHash(JSON.stringify([isoKey(todayDate()),items.map(i=>[i.id,i.updated||0]),Object.values(dayRecs).map(r=>[r.date,r.updated||0]).sort((a,b)=>a[0]<b[0]?-1:1),settings.updated||0,weather,climate]));
function snapOut(x,byId,seen=new Map()){if(!x||typeof x!=='object'||x instanceof Date)return x;if(seen.has(x))return seen.get(x);
  const it=x.id!=null&&typeof x.type==='string'&&byId.get(x.id);
  if(it&&it.type===x.type){const extra={};for(const k of Object.keys(x))if(x[k]!==it[k])extra[k]=snapOut(x[k],byId,seen);const r={$i:x.id,$x:extra};seen.set(x,r);return r}
  const r=Array.isArray(x)?[]:{};seen.set(x,r);for(const k of Object.keys(x))r[k]=snapOut(x[k],byId,seen);return r}
function snapIn(x,byId){if(!x||typeof x!=='object'||x instanceof Date)return x;
  if(x.$i!=null&&x.$x){const it=byId.get(x.$i);if(!it)throw new Error('kept plan names a missing item');const r={...it};for(const k of Object.keys(x.$x))r[k]=snapIn(x.$x[k],byId);return r}
  for(const k of Object.keys(x))x[k]=snapIn(x[k],byId);return x}
// at start-up, before Today is first drawn: the kept month, if it still holds
function planSnapUse(s){try{if(!s||!s.plan||s.sig!==planSig()||window.TEST_PLAN)return false;const byId=new Map(items.map(i=>[i.id,i]));
    cache[s.k]=snapIn(s.plan,byId);cache.snap=s.k;planSnapUsed=s.k;return true}catch(e){console.warn('kept plan not used',e);return false}}
let planSnapUsed=null;   // the month start-up drew from the kept plan (read by tests/speed.test.js)
const outSig=o=>o&&JSON.stringify([idsOf(o),!!o.vest,!!o.suitDay,o.notes||[]]);
let planSnapT=0;
function planSnapSoon(){clearTimeout(planSnapT);planSnapT=setTimeout(()=>{const T=todayDate(),k=T.getFullYear()+'-'+T.getMonth(),p=cache[k];if(!p||cache.snap||window.TEST_PLAN||!items.length)return;
  try{metaPut(PLAN_SNAP,{k,sig:planSig(),plan:snapOut(p,new Map(items.map(i=>[i.id,i]))),t:Date.now()}).catch(e=>console.warn('plan not kept',e))}catch(e){console.warn('plan not kept',e)}},1500)}
/* the bridge (tests/bridge.test.js): what the classic scripts and the tests still use as globals. planDirty is called by 25 page
   scripts, planFor by 14 and planMonth by 9; cache is read by nine page scripts and set by 95 tests (cache={}): a getter and a
   setter; today.js and stats.js ask planStartDay, today.js planTrim, outSig and planSnapSoon, start.js PLAN_SNAP and planSnapUse,
   shop.js strHash; planRuns, planSig and planSnapUsed (a let only this file writes: a getter) are read by tests/speed.test.js; a
   module imports them. The file has no top-level call, so the bridge is its last lines */
Object.assign(globalThis,{planDirty,planMonth,planStartDay,planTrim,planFor,hasOutfit,PLAN_SNAP,strHash,planSnapUse,outSig,planSnapSoon});
Object.defineProperties(globalThis,{cache:{get:()=>cache,set:v=>{cache=v}}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,planRuns,planSig,get planSnapUsed(){return planSnapUsed},get cache(){return cache},set cache(v){cache=v}};
export {cache,planDirty,planRuns,planMonth,planStartDay,planTrim,planFor,hasOutfit,PLAN_SNAP,strHash,planSig,planSnapUse,planSnapUsed,outSig,planSnapSoon};
