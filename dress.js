/* Daily Wardrobe: the dress code and the waistcoat default (loaded after app.js).
   settings.dress = {jacket, tie}; a missing object or key means yes, so a wardrobe that never touched it is planned as
   before. The rules themselves are in core.js (wearsJacket, wearsTie, needsJacket, needsTie, dressOut) and planner.js
   (outfit: without jackets every workday is a shirt and trousers, without ties none is picked; a formal day, a wedding
   or a funeral is still dressed in full from what is owned). This file holds the Settings switches and the one-time
   change of the waistcoat default. */

/* ---- Settings → Schedule → Dress code: two switches ---- */
const DRESS_ROWS=[['jacket','Jackets (suits and blazers)','Off if you don\'t wear a suit or blazer to work: workdays are planned as a shirt and trousers.'],
  ['tie','Ties','Off if you don\'t wear a tie: outfits get an open collar and no tie clip.'],
  ['jeans','Jeans with a blazer','On if jeans are fine at work under a blazer. Without a jacket, jeans are always fine.']];
/* settings.dress.jeans: off unless switched on (jeans are planned only on days without a jacket); shown while jackets are worn */
const dressOn=k=>k==='jacket'?wearsJacket():k==='tie'?wearsTie():!!(settings.dress&&settings.dress.jeans);
function renderDressUI(){const el=$('#cfg-dress');if(!el)return;const j=wearsJacket(),t=wearsTie();
  el.innerHTML=DRESS_ROWS.filter(([k])=>k!=='jeans'||j).map(([k,label,help])=>{const on=dressOn(k);
    return `<div class="dress-row"><span class="dress-txt"><b id="dress-l-${k}">${label}</b><small id="dress-h-${k}">${help}</small></span><button type="button" class="dress-sw${on?' on':''}" id="dress-${k}" role="switch" aria-checked="${on}" aria-labelledby="dress-l-${k}" aria-describedby="dress-h-${k}" onclick="setDress('${k}',${!on})"><i></i></button></div>`}).join('')
    +(j?t?'':'<p class="shelp dress-note">The suit vest is hidden: a waistcoat is only worn with a tie.</p>':'<p class="shelp dress-note">Blazer days and the suit vest don\'t apply without jackets, so they are hidden. A day you mark as formal, a wedding or a funeral is still dressed in full from what you own.</p>');
  // (2026-11-13) the suit vest also hides without ties: no waistcoat is ever planned without a tie (planner.js outfit)
  const e=$('#blazer-group');if(e)e.classList.toggle('dress-hide',!j);const v=$('#vest-row');if(v)v.classList.toggle('dress-hide',!j||!t)}
/* a change re-plans the coming week too (clearLocks), like the other planner settings */
async function setDress(k,on){settings.dress={jacket:wearsJacket(),tie:wearsTie(),...(settings.dress&&settings.dress.jeans?{jeans:true}:{}),[k]:!!on};if(!settings.dress.jeans)delete settings.dress.jeans;await clearLocks();await saveUserSettings();todayStale=true;renderDressUI();settingsSummaries()}
/* the Schedule category's one-line summary, when the dress code is not the usual one ('' otherwise: app.js writes its own) */
function dressSummary(){const j=wearsJacket(),t=wearsTie();return j&&t?'':j?'no ties':t?'no jackets':'no jackets or ties'}
/* why a piece is never worn, for a wardrobe without jackets (stats.js whyUnused; null = its usual answer) */
function dressWhyUnused(i){
  if(i.type==='pants')return 'Your other trousers go better with your shirts, or have rested longer.';
  if(i.type==='shirt')return 'Your other shirts go better with your trousers, or have rested longer.';
  if(i.type==='shoes'){const ok=items.some(b=>b.type==='pants'&&shoeScore(null,b,i)>-50);
    return !ok?`${colName(primaryCol(i))} shoes don't suit any of your trousers.`:finish(i.leather)==='patent'?'Patent shoes are for black tie only.':'Another pair always suits the outfit better.'}
  return null}

/* ---- waistcoats: a suit has one only when it says so ----
   Until this version a suit with no `vest` value had a waistcoat. Now it has one only with vest:'yes' (hasVest in core.js),
   and every new suit is saved with 'yes' or 'no'. A wardrobe from before keeps its three-piece suits: once, each suit with no
   value is given vest:'yes' (saved and stamped, so it syncs) and settings.vestDef is set. The flag is part of the synced
   settings, so it is once per wardrobe: another device receives the flag with the suits and has nothing to do. Until the
   flag is there hasVest reads a suit with no value the old way, so nothing changes while a device waits.
   With backup switched on the suits are changed only right after a sync: re-stamping this device's copy of a suit or of the
   settings before that would let an out-of-date copy win over a newer one from another device.
   A wardrobe with no such suit (a new one) is flagged when an item is added to it (dressNewItem, from save() and "Bought
   it"), without a new stamp on the settings: default settings stamped on a new device would win over the real ones of an
   account connected afterwards. An empty wardrobe is left alone at start-up, since one from before may still arrive by sync
   or from a backup file. */
const legacyVest=i=>i.type==='suit'&&i.vest==null;
let vestMigrating=false;
async function migrateVests(synced){
  if(settings.vestDef||vestMigrating)return 0;
  // (the stored wardrobe is what counts: it is what syncs)
  const old=((await tx('readonly',s=>s.getAll()))||[]).filter(legacyVest);if(!old.length||settings.vestDef||vestMigrating)return 0;
  if(!synced&&typeof syncUrl==='function'&&syncUrl()&&localStorage.getItem('app_token')){
    // wait for a sync that went through; it calls back here (dressSynced) only if it changed something, so ask again after it
    vestMigrating=true;let ok=false;try{ok=await syncNow()}catch(e){}vestMigrating=false;
    return ok&&!settings.vestDef?migrateVests(true):0}
  vestMigrating=true;
  try{for(const r of old){const i=items.find(x=>x.id===r.id)||r;i.vest='yes';await put(i)}
    settings.vestDef=1;await saveUserSettings();   // stamped, so the flag travels with the suits
  }finally{vestMigrating=false}
  return old.length}
/* an item is being added: a wardrobe with no suit from before is from now on read the new way */
function dressNewItem(){if(settings.vestDef||vestMigrating||items.some(legacyVest))return;settings.vestDef=1;metaPut('settings',settings).catch(()=>{})}
/* after a sync brought data in (app.js onSyncedData): the stored settings are the merged ones, so a flag or a dress code
   they don't have is dropped from memory too; then the suits that came in are looked at */
function dressSynced(m){
  if(m&&m.settings){if(!m.settings.vestDef)delete settings.vestDef;if(!m.settings.dress)delete settings.dress}
  if(!vestMigrating)migrateVests(true)}
