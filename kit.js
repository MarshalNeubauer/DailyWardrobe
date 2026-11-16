/* Daily Wardrobe: getting started (2026-11-14, the owner's ask after the audit's new-user walkthrough). Loaded after setup.js.
   - the quick tour: four short cards on the score, the close-up, Shade and patterns (tourOpen); shown once to a new user between the
     setup and the first Add, offered on the setup's last step, on Today's first-outfit checklist and in Settings → About
   - the close-up guide: how to take a good close-up, with white paper along one edge (kitCloseupGuide), from the Add card's close-up step
     and the item sheet's photo tools
   - Undo after Confirm on Add (kitSaved, called by app.js save): the item comes out of the wardrobe and its card goes back on Add
   - Duplicate on the item sheet (kitDuplicate): a second identical piece, opened for any difference
   - import from a spreadsheet (kitImportOpen): CSV or rows pasted from Excel or Google Sheets, a template to fill in, a preview before
     anything is saved, each row saved as an item added by hand would be (app.js save), with Undo
   - a sample wardrobe to try the app with (kitSampleLoad): 22 pieces marked sample, a note on Today while they are there, removed in one tap */

/* ---- one sheet for the tour and the guide: cards with a picture, Back and Next, the last one closes it ---- */
let kit=null;   // {cards, at, then}
let kitImpBusy=false;   // an import being written (kitImportGo)
const KIT_TOUR='tour_seen';
const tourSeen=()=>{try{return localStorage.getItem(KIT_TOUR)==='1'}catch{return false}};
function kitEl(){let e=$('#kitsheet');if(!e){e=document.createElement('div');e.id='kitsheet';e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');e.setAttribute('aria-labelledby','kit-title');document.body.appendChild(e)}return e}
function kitInert(on){for(const el of document.querySelectorAll('body>header,main,body>nav'))el.inert=on;if(!on&&typeof layerInert==='function')layerInert()}
/* the phone's Back closes the sheet (fix round 2, 2026-11-15: it left the app from the tour and the Home Screen sheet, and closed Add
   under the import sheet): the sheet takes a history entry (start.js kind 'kit'), or borrows Add's (kitHist keeps whose it was) */
function kitHist(){if(kit&&kit.hist===undefined&&typeof appBorrow==='function')kit.hist=appBorrow('kit')}
function kitOpen(cards,then){const prev=kit?kit.hist:undefined;kit={cards,at:0,then:then||null,from:document.activeElement};if(prev!==undefined)kit.hist=prev;kitBs(false);kitDraw();kitEl().classList.add('on');kitInert(true);kitHist();
  const t=$('#kit-next');if(t)t.focus({preventScroll:true})}
/* fromBack: the phone's Back did it (its entry is gone already) */
function kitClose(fromBack){if(kitImpBusy){if(fromBack&&typeof appPush==='function')appPush('kit');return}   // (the import is being written: a moment, then the sheet closes itself; Back keeps it, with its entry made again)
  const e=$('#kitsheet');if(e){const bs=e.classList.contains('kbs');e.classList.remove('on');if(bs)kitBsAway(e);else e.innerHTML=''}const k=kit;kit=null;kitInert(false);
  if(k&&k.hist!==undefined&&typeof appGiveBack==='function'){if(!fromBack)appGiveBack('kit',k.hist);else if(k.hist)appPush(k.hist)}   // the entry goes, or back to Add; after Back, Add gets a new one
  if(k&&k.cards===TOUR_CARDS){try{localStorage.setItem(KIT_TOUR,'1')}catch{}}
  if(k&&k.then)k.then();else if(k&&k.from&&k.from.isConnected)try{k.from.focus({preventScroll:true})}catch{}}
function kitGo(n){if(!kit)return;const at=kit.at+n;if(at>=kit.cards.length)return kitClose();if(at<0)return;kit.at=at;kitDraw();const t=$('#kit-next');if(t)t.focus({preventScroll:true})}
function kitDraw(){if(!kit)return;const c=kit.cards[kit.at],n=kit.cards.length,last=kit.at===n-1;
  kitEl().innerHTML=`<div class="kit-head"><div><h2 id="kit-title">${c.title}</h2>${n>1?`<small>${kit.at+1} of ${n}</small>`:''}</div><button type="button" class="kit-x" onclick="kitClose()" aria-label="Close">✕</button></div>
${n>1?`<div class="su-prog kit-prog" aria-hidden="true">${kit.cards.map((x,i)=>`<i class="${i<=kit.at?'on':''}"></i>`).join('')}</div>`:''}
<div class="kit-body" data-card="${c.key}"><div class="kit-pic" aria-hidden="true">${c.pic()}</div>${c.body}</div>
<div class="kit-bar">${kit.at?`<button type="button" id="kit-back" onclick="kitGo(-1)">Back</button>`:''}<button type="button" class="pri" id="kit-next" onclick="kitGo(1)">${last?(kit.lastLabel||c.last||'Got it'):'Next'}</button></div>`}
// ← → step the cards only: not in the import (no cards: → closed it and lost the pasted rows) nor while typing in a field (re-audit 2026-11-15)
addEventListener('keydown',e=>{if(!kit)return;if(e.key==='Escape'){e.preventDefault();kitClose();return}
  if(!kit.cards.length||(e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]')))return;
  if(e.key==='ArrowRight')kitGo(1);else if(e.key==='ArrowLeft')kitGo(-1)});

/* the pictures: drawn, in the app's own colours (no photos to download) */
/* the tour speaks of what this person wears (audit 2026-11-15: ties and suits to someone who wears neither) */
const kitWears=k=>k==='tie'?typeof wearsTie!=='function'||wearsTie():typeof wearsJacket!=='function'||wearsJacket();
const kitScorePic=()=>`<svg viewBox="0 0 300 150"><rect x="20" y="22" width="260" height="62" rx="14" class="kp-card"/><rect x="34" y="34" width="70" height="38" rx="10" class="kp-good"/><text x="69" y="60" class="kp-num">96</text><text x="118" y="50" class="kp-t">Excellent</text><text x="118" y="70" class="kp-s">Outfit score · tap for why</text>
<rect x="20" y="96" width="260" height="38" rx="10" class="kp-card"/><text x="34" y="120" class="kp-s">−2</text><text x="62" y="120" class="kp-t2">The same ${kitWears('tie')?'tie':'shirt'} color as yesterday</text></svg>`;
const kitClothPic=(paper=true,box=true)=>`<svg viewBox="0 0 200 260"><defs><pattern id="kp-weave" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#3b4256"/><path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke="#4b5370" stroke-width="1.6"/></pattern></defs>
<rect x="10" y="10" width="180" height="240" rx="12" fill="url(#kp-weave)"/>${paper?`<path d="M10 204 H190 V238 A12 12 0 0 1 178 250 H22 A12 12 0 0 1 10 238 Z" fill="#f4f3ef"/>`:''}
${box?`<rect x="37" y="46" width="126" height="148" rx="3" fill="none" stroke="#efb446" stroke-width="2.4" stroke-dasharray="7 5"/>`:''}</svg>`;
const kitShadePic=()=>{const s=['#2c3d66','#253558','#1f2d4a','#19253d','#131c30'];return `<svg viewBox="0 0 300 120">${s.map((c,i)=>`<rect x="${22+i*52}" y="${i===2?18:26}" width="${i===2?50:44}" height="${i===2?60:44}" rx="9" fill="${c}"${i===2?' class="kp-sel"':''}/>`).join('')}
<text x="47" y="104" class="kp-s" text-anchor="middle">lighter</text><text x="150" y="104" class="kp-t2" text-anchor="middle">as tagged</text><text x="253" y="104" class="kp-s" text-anchor="middle">darker</text></svg>`};
const kitPatternPic=()=>`<svg viewBox="0 0 300 150"><defs><pattern id="kp-gen" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#2a3047"/><rect x="6" width="2" height="14" fill="#8d93a8"/></pattern>
<pattern id="kp-read" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#2b2733"/><rect x="5" width="1.2" height="22" fill="#9a8fa6"/><rect x="15" width="1.2" height="22" fill="#7d4a59"/></pattern></defs>
<rect x="22" y="14" width="116" height="100" rx="12" fill="url(#kp-gen)"/><rect x="162" y="14" width="116" height="100" rx="12" fill="url(#kp-read)"/>
<text x="80" y="136" class="kp-s" text-anchor="middle">generic pinstripe</text><text x="220" y="136" class="kp-t2" text-anchor="middle">read from your cloth</text></svg>`;

/* ---- the quick tour ---- */
const TOUR_CARDS=[
  {key:'score',title:'The score',pic:kitScorePic,get body(){return `<p>Every outfit gets a score out of 100.</p><p>Points come off only for things you can put right: shoes that don't suit the ${kitWears('jacket')?'suit':'pants'}, a color worn two days running, socks lighter than the pants.</p><p class="kit-tip">Tap the score on Today to see why, and the swaps that would raise it.</p>`}},
  {key:'closeup',title:'The close-up',pic:()=>kitClothPic(true,false),body:`<p>After the photo of the whole piece, take one close-up of the cloth: hold the phone close so the weave fills the screen.</p><p>It gives the true color and the real size of the pattern. A sheet of plain white paper along one edge lets the app correct for the light: tap the paper on the camera screen before you take the picture.</p><p><button type="button" class="linkbtn" onclick="kitClose();kitCloseupGuide()">How to take a good close-up</button></p>`},
  {key:'shade',title:'Shade',pic:kitShadePic,body:`<p>If a piece is drawn lighter or darker than the real thing, Shade nudges it, up to six steps either way.</p><p><b>Match close-up</b> sets it from your close-up for you.</p><p class="kit-tip">Shade changes only the drawing. The color the planner matches stays the one you tagged.</p>`},
  {key:'patterns',title:'Patterns',pic:kitPatternPic,body:`<p>Stripes, checks and weaves are read too.</p><p>With a close-up the app measures the stripes' widths and colors, so the drawing and the outfit pictures show your cloth, not a generic one.</p><p class="kit-tip">If a reading looks wrong, tap <b>Use the simple pattern</b> on the card, or <b>Read pattern from photo</b> on the item later.</p>`}];
/* then: what happens after the last card (the setup's "Add my first item" goes on to Add) */
function tourOpen(then,lastLabel){kitOpen(TOUR_CARDS,then);if(lastLabel){kit.lastLabel=lastLabel;kitDraw()}}
/* Settings → About's "Take the tour" and "Add to Home Screen": closing the sheet goes back to About, not to Today (audit 2026-11-15) */
function tourAgain(){closeSettings();tourOpen(()=>openSettings('about'))}
function homeAgain(){closeSettings();kitOpen([HOME_CARD],()=>openSettings('about'))}

/* ---- the close-up guide ---- */
const GUIDE_CARD={key:'guide',title:'A good close-up',pic:()=>kitClothPic(true,true),last:'Got it',body:`<ol class="kit-list">
<li><b>Fill the screen with cloth.</b> Hold the phone a hand's width away, straight down, so the weave is sharp.</li>
<li><b>Lay plain white paper along one edge</b>, about a fifth of the picture, on the cloth or right beside it. Keep it out of the middle: the middle (dashed) is where the color is measured.</li>
<li><b>Same light on both.</b> Daylight or room light; no flash, no patch of sun, no shadow of your phone across the paper.</li>
<li><b>Tap the paper on the camera screen</b> before you take the picture. The phone sets its exposure there, so the paper comes out white instead of glowing, and the app can read the light from it.</li></ol>
<p class="kit-tip">No paper? It still works: the color is then corrected like the main photo, and lightness counts for less.</p>`};
function kitCloseupGuide(){kitOpen([GUIDE_CARD])}
/* the short white-paper tip (photo-wb-mockups variant B's words), opened from the drawing beside the item sheet's close-up hint (paperTip) */
const PAPER_CARD={key:'paper',title:'White paper, true colors',pic:()=>kitClothPic(true,true),last:'Got it',body:`<p>Lay a sheet of plain white paper along one edge of the cloth, about a fifth of the picture.</p>
<p>Tap the paper on the camera screen, then take the picture. The app reads the light from the paper, so the color comes out true, even under warm lamps.</p>
<p><button type="button" class="linkbtn" onclick="kitClose();kitCloseupGuide()">Tips for a good close-up</button></p>`};

/* ---- Undo after Confirm (app.js save calls this for each card saved) ----
   Cards saved within a moment of each other (Save all, an import) are one Undo. Undo takes the items out (a tombstone each, as Delete
   does) and puts their cards back on Add, in their places */
let kitBatch=null,kitQuiet=false;
const KIT_UNDO_MS=8000;
function kitSaved(it,q,i,copies){if(kitQuiet)return;const now=Date.now(),more=(copies||[]).map(c=>c.id);
  if(!kitBatch||now-kitBatch.at>1500)kitBatch={its:[],qs:[],at:now};kitBatch.its.push(it.id,...more);kitBatch.qs.push({q,i});kitBatch.at=now;const b=kitBatch,n=b.its.length;
  // one card with copies (add.js qtyRow): "Saved 3: White."
  const t=typeof savedTitle==='function'?savedTitle(it):sentence(itemTitle(it));   // "Saved: Grey suit." (it said "Saved: Grey.": add.js)
  toast(n===1?`Saved: ${t}.`:b.qs.length===1?`Saved ${n}: ${t}.`:`Saved ${n} items.`,KIT_UNDO_MS,{label:'Undo',fn:()=>kitUnsave(b)})}
async function kitUnsave(b){if(!b)return;
  if(b.its.length>30)toast(`Taking out ${b.its.length} items…`,15000);   // (an import's Undo: said at once, done in one go)
  // the cards go back on Add and are kept (add.js addKeep) BEFORE the items are deleted: deleted first, a kill within the keep's timer
  // lost the item from both (audit 2026-11-15 re-run); a kill between the two leaves the items, and the kept cards of saved items are dropped
  const back=[];for(const {q,i} of b.qs.slice().reverse()){if(!q||queue.includes(q))continue;delete q.busy;queue.splice(Math.min(i,queue.length),0,q);back.push(q)}
  if(back.length&&typeof addKeep==='function')await addKeep();
  try{await kitDelMany(b.its)}catch(e){for(const q of back){const k=queue.indexOf(q);if(k>=0)queue.splice(k,1)}if(back.length&&typeof addKeep==='function')addKeep();throw e}
  if(kitBatch===b)kitBatch=null;cache={};todayStale=true;if(b.qs.length&&typeof multiMsg==='function')multiMsg('');   // ("Saved 5 items to your wardrobe." stayed over the cards Undo brought back)
  if(b.qs.length&&$('#add')&&!$('#add').hidden)renderAdd();else if(typeof renderWardrobe==='function'&&$('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  toast(b.its.length===1?'Undone: the item is back on Add.':`Undone: ${b.its.length} items taken out.`,3000)}

/* ---- many items at once (the import, the sample, their Undo and removal), each in ONE transaction (2026-11-15, the new-user audit:
   saved or deleted one by one, a double tap ran the loop twice, iOS killing Safari part-way left part of an import or a sample, and
   500 rows took 18 s). The items, their tombstones and any day records go together: all of it is stored, or none. ---- */
const kitTx=(stores,f)=>dbRetry('readwrite',d=>new Promise((ok,no)=>{const t=d.transaction(stores,'readwrite');t.onerror=t.onabort=txFail(t,no,'readwrite');
  try{f(t)}catch(e){try{t.abort()}catch{}no(dbMark(e,'readwrite'));return}t.oncomplete=()=>ok()}));   // (a write that throws part-way stores none of it)
function kitTombs(t,ids,now){if(!ids.length)return;const m=t.objectStore('meta'),q=m.get('tombstones');
  q.onsuccess=()=>{const v={...(q.result&&q.result.v||{})};for(const id of ids)v[id]=Math.max(v[id]||0,now);m.put({k:'tombstones',v})}}
/* a failed write is said, as Confirm says it (add.js save) */
function kitFail(e){console.warn('save failed',e);if(typeof storeFailure==='function'&&storeFailure(e))saveFailed(e);else toast('Couldn’t save: '+String(e&&e.message||e).replace(/\.$/,'')+'. Try again.',7000)}
/* an item made from a card with no photo, as add.js saveCard makes one (a hand-added card: the fields it keeps for each type) */
function kitItem(c){const f=FABRIC.includes(c.type),it={id:c.id||crypto.randomUUID(),type:c.type,primaryColor:c.primaryColor,secondaryColor:c.secondaryColor||null,tertiaryColor:c.tertiaryColor||null,pattern:f?c.pattern||'solid':'solid',added:Date.now()};
  if(METAL_TYPES.includes(c.type))it.metal=c.metal||'silver';
  if(c.type==='shirt')it.cuff=c.cuff==='french'?'french':'button';
  if(c.type==='suit')it.vest=c.vest==='yes'?'yes':'no';
  if(SEASON_TYPES.includes(c.type)&&c.season&&c.season!=='all')it.season=c.season;
  if(c.type==='shoes'||c.type==='belt')it.leather=c.leather||'calf';
  if(c.type==='pants'&&(c.trouserKind==='chinos'||c.trouserKind==='jeans'))it.trouserKind=c.trouserKind;
  if(c.type==='shoes'&&c.shoeStyle&&c.shoeStyle!=='oxford')it.shoeStyle=c.shoeStyle;
  if(c.type==='watch'){const wo=watchOpts(c);Object.assign(it,{dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style})}
  if(typeof wardSaveFields==='function')wardSaveFields(c,it);   // name, brand, material, notes (wardrobe.js)
  if(c.sample)it.sample=true;return it}
/* store new items (false, said, when storage refused them: nothing was stored) */
async function kitStore(list,prog){if(!list.length)return true;const now=Date.now();let k=0;
  try{await kitTx(['items'],t=>{const s=t.objectStore('items');for(const it of list){it.updated=now;const r=s.put(it);if(prog)r.onsuccess=()=>prog(++k,list.length)}})}catch(e){kitFail(e);return false}
  items.push(...list);cache={};todayStale=true;if(typeof dressNewItem==='function')dressNewItem();
  if(window.scheduleSync)scheduleSync();if(typeof askPersist==='function')askPersist();return true}
/* delete items (each with a tombstone, as Delete does), with changed items (put) and day records (days) in the same transaction */
async function kitDelMany(ids,put=[],days=[]){ids=[...new Set(ids)];const now=Date.now(),gone=new Set(ids);
  await kitTx(['items','meta','days'],t=>{const s=t.objectStore('items');for(const id of ids)s.delete(id);for(const it of put){it.updated=now;s.put(it)}
    const d=t.objectStore('days');for(const r of days){if(r.updated!==KIT_YIELD)r.updated=now;delete r.lockOnly;delete r.base;d.put(r)}kitTombs(t,ids,now)});   // (KIT_YIELD: a sample-only day keeps its stamp of 1, kitSampleRemove)
  items=items.filter(x=>!gone.has(x.id));for(const it of put){const k=items.findIndex(x=>x.id===it.id);if(k>=0)items[k]=it}
  for(const r of days)dayRecs[r.date]=r;cache={};todayStale=true;if(window.scheduleSync)scheduleSync()}

/* ---- Duplicate (the item sheet): the same piece again, with a new id and no history, opened for any difference ---- */
const KIT_NO_COPY=['id','added','updated','paused','order','arrives','away','cleaned','sample','sampleMine'];
async function kitDuplicate(id){const it=items.find(x=>x.id===id);if(!it)return;const c=JSON.parse(JSON.stringify(it));for(const k of KIT_NO_COPY)delete c[k];
  c.id=crypto.randomUUID();c.added=Date.now();await put(c);items.push(c);cache={};todayStale=true;
  if(typeof renderWardrobe==='function'&&$('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  openItem(c.id);toast('Duplicated. Change anything that differs, like its name.',3500)}

/* ---- import from a spreadsheet ----
   A CSV file (Excel, Numbers and Google Sheets all save one) or rows pasted straight from the spreadsheet (tab-separated). The first row
   names the columns, in any order and case; only Type and Colour are needed. Words are matched to the app's own lists: type names, plurals
   and common words for them (trousers, pants, slacks, chinos, jeans; necktie; tie bar; loafers; blazers…), colour names as the app shows
   them and everyday ones (sky blue, charcoal grey, maroon: core.js COL_ALIAS), the owner's own colours by name, pattern names. A colour a
   type isn't offered in moves to the nearest one it is (fitCol), and the preview says so. A row that can't be read is shown with why and
   left out; a row matching a piece already in the wardrobe is shown unticked (2026-11-15, the new-user audit). */
const KIT_COLS={type:['type','item','category','what','kind of item'],primaryColor:['colour','color','main colour','main color','primary colour','primary color'],
  secondaryColor:['second colour','second color','secondary colour','secondary color','colour 2','color 2'],tertiaryColor:['third colour','third color','colour 3','color 3'],
  pattern:['pattern'],name:['name','label','nickname'],brand:['brand','maker'],material:['material','fabric','cloth'],notes:['notes','note','comments'],
  vest:['vest','waistcoat','three-piece','3-piece'],cuff:['cuffs','cuff'],kind:['kind','trouser kind','trousers kind','fit'],style:['style','shoe style'],leather:['leather'],season:['season'],metal:['metal','buckle','metal colour','metal color','case']};
/* a metal word → {k: 'gold' | 'silver' | 'other' (gunmetal), read} (read: not one of the app's three by name), else null */
function kitMetal(word){const w=kitNorm(word).replace(/-/g,' ');if(!w)return null;
  if(/^(gold|yellow gold|gold tone|gilt|brass)$/.test(w))return {k:'gold',read:w!=='gold'};if(/^(rose gold|pink gold|red gold)$/.test(w))return {k:'gold',read:true};
  if(/^(silver|steel|stainless|stainless steel|silver tone|chrome|platinum|white gold|sterling|sterling silver)$/.test(w))return {k:'silver',read:w!=='silver'};
  if(/^(gunmetal|gun metal|black metal|titanium|grey metal)$/.test(w))return {k:'other',read:w!=='gunmetal'&&w!=='gun metal'};return null}
const KIT_TYPE_WORDS={suit:['suit','suits','two-piece','three-piece','suit jacket'],blazer:['blazer','sport coat','sports coat','sportcoat','jacket','sport jacket'],pants:['trousers','trouser','pants','slacks','chinos','jeans','dress trousers','dress pants'],
  shirt:['shirt','dress shirt','shirts','oxford shirt'],tie:['tie','necktie','ties'],tieclip:['tie clip','tie bar','tieclip','tie pin'],watch:['watch','wristwatch'],shoes:['shoes','shoe','oxfords','oxford','derbies','derby','loafers','loafer','boots','boot','sneakers','trainers'],
  belt:['belt'],socks:['socks','sock'],cufflinks:['cufflinks','cuff links','cufflink','cuff link'],overcoat:['overcoat','coat','topcoat','top coat','wool coat'],raincoat:['raincoat','trench','trench coat','mac']};
const KIT_PLANS='suits, blazers, pants, shirts, ties, tie clips, shoes, belts, socks, watches, cufflinks and coats';
const kitNorm=s=>String(s??'').trim().toLowerCase().replace(/[_\s]+/g,' ').replace(/grey|gray/g,'grey');
function kitSplit(text){text=String(text||'').replace(/^﻿/,'').replace(/\r\n?/g,'\n');const first=text.split('\n',1)[0];
  const d=first.includes('\t')?'\t':(first.split(';').length>first.split(',').length?';':',');const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c;continue}
    if(c==='"'&&f==='')q=true;else if(c===d){row.push(f);f=''}else if(c==='\n'){row.push(f);rows.push(row);row=[];f=''}else f+=c}
  if(f!==''||row.length){row.push(f);rows.push(row)}return rows.filter(r=>r.some(v=>String(v).trim()))}
/* a type word: the app's own words, then the word as a singular (Blazers, Watches, Dress shirts, Tie clips) */
function kitType(tw){const find=w=>Object.keys(KIT_TYPE_WORDS).find(t=>KIT_TYPE_WORDS[t].includes(w))||Object.keys(TYPES).find(t=>kitNorm(TYPES[t])===w);
  const one=w=>find(w)||(/es$/.test(w)&&find(w.slice(0,-2)))||(/s$/.test(w)&&find(w.slice(0,-1)))||null;
  // else a known word among others ("Shoes - Oxford", "Linen trouser"): the last word first (the noun), then the others
  const ws=tw.split(/[^a-z]+/).filter(Boolean);return one(tw)||(ws.length>1?[...ws].reverse().map(one).find(Boolean):null)||null}
/* a colour word → {k, read} (read: matched to the nearest name rather than named exactly), null when empty, undefined when unknown */
function kitColour(word){const w=kitNorm(word).replace(/-/g,' ').replace(/^navy blue$/,'navy').replace(/^off white$/,'ivory').replace(/^mauve$/,COLORS.lavender?'lavender':'purple').replace(/^(fuchsia|magenta)$/,'pink');if(!w||w==='none'||w==='-')return null;
  // the owner's own colours by name (core.js CUSTOM_COL; settings.custom.colors is a list, and its index was taken as the colour: "0 isn't one of the tie colours")
  const own=Object.values(CUSTOM_COL).find(c=>kitNorm(c&&c.name)===w);if(own)return {k:own.key};
  const keys=Object.keys(COLORS),exact=x=>keys.find(c=>kitNorm(colName(c))===x||kitNorm(c)===x||kitNorm(c)===x.replace(/ /g,''));
  let k=exact(w);if(k)return {k};
  k=normCol(w);if(k)return {k,read:true};   // everyday names: sky blue, dark brown, maroon, midnight blue, cognac (core.js COL_ALIAS)
  const ws=w.split(' ');if(ws.length>1){const a=ws.slice(0,-1).join(' ');if(ws[ws.length-1]==='grey'&&(k=exact(a)||normCol(a)))return {k,read:true};   // charcoal grey
    k=exact(ws[ws.length-1])||normCol(ws[ws.length-1]);if(k)return {k,read:true}}   // heather grey, royal navy
  return undefined}
const kitColList=type=>colsFor(type).filter(c=>!CUSTOM_COL[c]).map(c=>colName(c).toLowerCase()).join(', ');
function kitPattern(word,type){const w=kitNorm(word).replace(/-/g,' ');if(!w||w==='plain'||w==='none'||w==='solid')return 'solid';
  const list=(PATS_BY[type]||[]);const own=list.find(p=>CUSTOM_PAT[p]&&kitNorm(CUSTOM_PAT[p].name)===w);if(own)return own;   // the owner's own patterns offered for the type (core.js CUSTOM_PAT)
  const syn={striped:'stripe',stripes:'stripe',stripe:'stripe',checked:'check',checks:'check','pin stripe':'pinstripe','pinstripes':'pinstripe','chalkstripe':'chalk-stripe','chalk stripe':'chalk-stripe','glen plaid':'glen-check','glen check':'glen-check','prince of wales':'glen-check','polka dots':'polka-dot','polka dot':'polka-dot',dots:'polka-dot',
    repp:'stripe','repp stripe':'stripe',rep:'stripe','rep stripe':'stripe',regimental:'stripe','regimental stripe':'stripe',bengal:'stripe','bengal stripe':'stripe','candy stripe':'stripe'};
  const al=PAT_ALIAS[type==='blazer'||type==='pants'?'suit':type]||{},s=syn[w],h=w.replace(/ /g,'-');
  const k=list.find(p=>kitNorm(patLabel(p))===w||p===h)||(s&&(list.includes(s)?s:list.includes(al[s])?al[s]:null))||(list.includes(al[h])?al[h]:null);return k||undefined}
/* what a row's Material says: one of the type's own materials (any case), the leather of shoes and belts; else left out, said */
function kitMaterial(card,word){const m=kitNorm(word);if(!m)return null;const list=MATERIALS_BY[card.type];
  if(list){card.material=list.find(x=>x===m)||String(word).trim();return null}   // (one not on the list shows as Other, as typed)
  if(card.type==='shoes'||card.type==='belt'){const ls=leathersFor(card),k=ls.find(l=>m.includes(l))||(/leather|calf/.test(m)&&ls.includes('calf')?'calf':null);if(k){card.leather=k;return null}}
  return `material “${String(word).trim()}” left out`}
function kitRead(text){const rows=kitSplit(text);if(!rows.length)return {err:'Nothing to read.'};
  const head=rows[0].map(kitNorm),col={};for(const [k,names] of Object.entries(KIT_COLS)){const j=head.findIndex(h=>names.includes(h));if(j>=0)col[k]=j}
  if(col.type==null||col.primaryColor==null)return {err:'The first row must name the columns, with at least “Type” and “Color”. Download the template to see how.'};
  const out=[];
  rows.slice(1).forEach((r,n)=>{const v=k=>col[k]==null?'':String(r[col[k]]??'').trim(),line=n+2,probs=[];
    const tw=kitNorm(v('type'));if(!tw){out.push({line,ok:false,raw:'(empty)',why:'Type is empty'});return}
    const type=kitType(tw);
    if(!type){out.push({line,ok:false,raw:v('type'),why:`“${v('type')}” isn't a type the app plans. It plans ${KIT_PLANS}.`});return}
    // several colours in one cell ("light blue, white", "Blue/white"): the first is the main colour, the others fill empty second and third
    // colour columns (re-audit 2026-11-15: the second colour was lost and the row read as white)
    let pw=v('primaryColor');const more={};{const parts=pw.split(/\s*(?:,|\/|&|\+|\band\b)\s*/i).filter(Boolean);
      if(parts.length>1&&parts.length<=3&&parts.every(x=>kitColour(x))){pw=parts[0];if(!v('secondaryColor'))more.secondaryColor=parts[1];if(parts[2]&&!v('tertiaryColor'))more.tertiaryColor=parts[2]}}
    // a watch's or cufflinks' metal named as the colour ("Watch, Gold", "Cufflinks, Rose gold"): the metal (they imported as silver)
    const mtl=(type==='watch'||type==='cufflinks')&&kitMetal(pw);
    const m=mtl?{k:mtl.k==='gold'?'gold':'silver'}:kitColour(pw);
    if(!m){out.push({line,ok:false,raw:v('type'),why:m===null?'Color is empty':`“${v('primaryColor')}” isn't a color the app knows. ${TYPES[type]} colors: ${kitColList(type)}.`});return}
    const c=fitCol(type,m.k)||m.k;
    if(mtl){if(mtl.read)probs.push(`“${pw}” read as ${metalWord(mtl.k)}`)}
    else if(c!==m.k)probs.push(`${colName(m.k).toLowerCase()} isn't one of the ${TYPES[type].toLowerCase()} colors: read as ${colName(c).toLowerCase()}`);
    else if(m.read)probs.push(`“${pw}” read as ${colName(c).toLowerCase()}`);
    const acc=k=>{const w=more[k]||v(k),x=kitColour(w);if(x===undefined){probs.push(`${k==='secondaryColor'?'second':'third'} color “${w}” left out`);return null}return x?fitCol(type,x.k,true)||x.k:null};
    const c2=acc('secondaryColor'),c3=acc('tertiaryColor');
    let pattern='solid';if(FABRIC.includes(type)){const p=kitPattern(v('pattern'),type);if(p===undefined)probs.push(`pattern “${v('pattern')}” read as plain`);else pattern=p}
    const card={id:crypto.randomUUID(),manual:true,type,primaryColor:c,secondaryColor:c2||null,tertiaryColor:c3||null,pattern,metal:mtl?mtl.k:'silver',leather:'calf'};
    // a Metal (or Buckle) column for watches, belts and cufflinks
    if(METAL_TYPES.includes(type)&&v('metal')){const x=kitMetal(v('metal'));if(x){card.metal=x.k;if(x.read)probs.push(`metal “${v('metal')}” read as ${metalWord(x.k)}`)}else probs.push(`metal “${v('metal')}” left out`)}
    const yes=s=>/^(y|yes|true|1|x|matching|with)/i.test(String(s).trim());
    if(type==='suit')card.vest=yes(v('vest'))?'yes':'no';
    if(type==='shirt')card.cuff=/french|double/i.test(v('cuff'))?'french':'button';
    if(type==='pants'){const k=kitNorm(v('kind')||tw);card.trouserKind=/jean|denim/.test(k)?'jeans':/chino/.test(k)?'chinos':'dress'}
    if(type==='shoes'){const s=kitNorm(v('style')||v('kind')||tw);card.shoeStyle=/derb/.test(s)?'derby':/loaf/.test(s)?'loafer':/boot/.test(s)?'boot':/sneak|train/.test(s)?'sneaker':'oxford'}
    if(type==='shoes'||type==='belt'){const l=kitNorm(v('leather'));if(l){const k=leathersFor(card).find(x=>l.includes(x));if(k)card.leather=k}}
    if(SEASON_TYPES.includes(type)){const s=kitNorm(v('season'));if(/^(summer|warm)/.test(s))card.season='warm';else if(/^(winter|cold)/.test(s))card.season='cold'}
    for(const k of ['name','brand','notes'])if(v(k))card[k]=v(k);
    if(v('material')&&!(v('leather')&&(type==='shoes'||type==='belt'))){const p=kitMaterial(card,v('material'));if(p)probs.push(p)}
    out.push({line,ok:true,card,probs})});
  return {rows:out}}
const KIT_TEMPLATE='Type,Color,Second color,Pattern,Name,Brand,Material,Notes,Vest\nSuit,Navy,,Pinstripe,Navy pinstripe,,Wool,,Yes\nDress shirt,Light blue,,Solid,,,Poplin,,\nTie,Burgundy,Navy,Stripe,,,Silk,Repp stripe,\nShoes,Black,,,Black oxfords,,Calf,,\nPants,Mid gray,,Solid,,,Flannel,,\n';
/* the template as a data link: nothing to revoke (a blob link revoked a second after the tap can fail on an iPhone, where Safari first
   asks whether to download) */
function kitTemplate(){const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(KIT_TEMPLATE);a.download='wardrobe-template.csv';document.body.appendChild(a);a.click();a.remove()}
/* a file's text: UTF-8 (with or without its mark), UTF-16 (Excel's "Unicode text"), else Windows-1252 (Excel's "CSV (Comma delimited)") */
function kitDecode(buf){const b=new Uint8Array(buf);
  if(b[0]===0xFF&&b[1]===0xFE)return new TextDecoder('utf-16le').decode(b);if(b[0]===0xFE&&b[1]===0xFF)return new TextDecoder('utf-16be').decode(b);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(b)}catch{return new TextDecoder('windows-1252').decode(b)}}
let kitImp=null;   // {rows} once read; each good row has on (ticked) and dup (already in the wardrobe)
const KIT_IMP_LAST='kit_import_last';   // the last import's ids and time (localStorage): "Take them out" in the sheet, after Undo's toast has gone
const KIT_IMP_UNDO_MS=20000;
/* "Take them out" is for an import just made: offered for KIT_IMP_KEEP_MS, and a piece changed since (renamed, its photo added) is his and
   stays (re-audit 2026-11-15: a renamed piece went too, weeks later) -> {ids (to take out), kept (changed since), at} */
const KIT_IMP_KEEP_MS=7*864e5;
function kitLastImp(){try{const l=JSON.parse(localStorage.getItem(KIT_IMP_LAST)||'null');if(!l||!Array.isArray(l.ids))return null;
  if(!(Date.now()-(+l.at||0)<KIT_IMP_KEEP_MS)){localStorage.removeItem(KIT_IMP_LAST);return null}
  const its=l.ids.map(id=>items.find(i=>i.id===id)).filter(Boolean),ch=i=>(i.updated||0)-(+l.at||0)>KIT_EDIT_MS;
  const ids=its.filter(i=>!ch(i)).map(i=>i.id);return ids.length?{ids,kept:its.length-ids.length,at:l.at}:null}catch{return null}}
function kitLastRow(){const l=kitLastImp();if(!l)return '';const when=new Date(l.at).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  return `<p class="kit-last" id="kit-last">Your last import (${when}): ${l.ids.length} item${l.ids.length===1?'':'s'} in your wardrobe${l.kept?` you haven't changed since`:''}. <button type="button" class="linkbtn" onclick="kitUnimport()">Take ${l.ids.length===1?'it':'them'} out</button></p>`}
/* the import is a bottom sheet over Add (2026-11-15, the owner's choice from add-page-mockups): grabber, the table icon, the backdrop,
   a swipe down closes it as ✕ (add.js sheetSwipe), at most 640 px wide; its content is as before */
const KIT_TABLE='<svg class="kit-hic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/></svg>';
let kitBsT=0,kitSwipeOn=false;
function kitBd(){let b=$('#kit-backdrop');if(!b){b=document.createElement('div');b.id='kit-backdrop';b.onclick=()=>{if(kit&&!kitImpBusy)kitClose()};document.body.appendChild(b)}return b}
function kitBs(on){const e=kitEl();clearTimeout(kitBsT);e.classList.remove('going');e.inert=false;e.style.transform='';e.classList.toggle('kbs',!!on);const b=$('#kit-backdrop');if(on)kitBd().classList.add('on');else if(b)b.classList.remove('on')}
/* the import sheet slides away, then is emptied */
function kitBsAway(e){const b=$('#kit-backdrop');if(b)b.classList.remove('on');e.inert=true;e.classList.add('going');clearTimeout(kitBsT);
  kitBsT=setTimeout(()=>{if(e.classList.contains('on'))return;e.classList.remove('going','kbs');e.inert=false;e.innerHTML=''},typeof noMotion==='function'&&noMotion()?0:320)}
function kitImportSwipe(){if(kitSwipeOn||typeof sheetSwipe!=='function')return;kitSwipeOn=true;const e=kitEl();
  sheetSwipe(e,{head:'.kit-head',body:()=>e.querySelector('.kit-body'),backdrop:()=>$('#kit-backdrop'),live:()=>!!kit&&e.classList.contains('kbs')&&!kitImpBusy,close:()=>kitClose()})}
function kitImportOpen(){kitImp=null;const e=kitEl(),prev=kit?kit.hist:undefined;kit={cards:[],at:0,then:null,from:document.activeElement};if(prev!==undefined)kit.hist=prev;kitBs(true);kitImportSwipe();
  e.innerHTML=`<div class="kit-head"><span class="kit-grab" aria-hidden="true"></span><div class="kit-ht">${KIT_TABLE}<h2 id="kit-title">Import from a spreadsheet</h2></div><button type="button" class="kit-x" onclick="kitClose()" aria-label="Close">✕</button></div>
<div class="kit-body" data-card="import"><p>One row per piece. The first row names the columns; only <b>Type</b> and <b>Color</b> are needed. From Numbers, Excel or Google Sheets, export the sheet as CSV, or copy the rows and paste them below.</p>
${kitLastRow()}<div class="btns"><button type="button" onclick="kitTemplate()">Download a template</button><label class="btn">Choose a CSV file<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" class="vfile" onchange="kitImportFile(this.files[0]);this.value=''"></label></div>
<label class="kit-paste">Or paste the rows<textarea id="kit-paste" rows="5" onfocus="kitPasteShow(this)" placeholder="Type, Color, Pattern…" oninput="kitImportText(this.value)"></textarea></label>
<div id="kit-prev" aria-live="polite"></div></div>
<div class="kit-bar"><button type="button" id="kit-cancel" onclick="kitClose()">Cancel</button><button type="button" class="pri" id="kit-imp" disabled onclick="kitImportGo()">Add items</button></div>`;
  e.classList.add('on');kitInert(true);kitHist()}
/* the paste field comes into view below the sheet's header once the keyboard is up (re-audit 2026-11-15: with the preview scrolled it
   stayed under the header) */
function kitPasteShow(t){setTimeout(()=>{if(!t.isConnected)return;const b=t.closest('.kit-body');if(!b)return;const r=t.getBoundingClientRect(),br=b.getBoundingClientRect(),vh=window.visualViewport?visualViewport.height:innerHeight;
  if(r.top<br.top+8||r.top>vh-60)b.scrollTop+=r.top-br.top-8},350)}
async function kitImportFile(f){if(!f)return;let t='';try{t=kitDecode(await f.arrayBuffer())}catch{t=await f.text()}const ta=$('#kit-paste');if(ta)ta.value='';kitImportText(t,true)}
const kitDupKey=i=>[i.type,i.primaryColor,i.secondaryColor||'',FABRIC.includes(i.type)?i.pattern||'solid':'solid',kitNorm(i.name||'')].join('|');
/* rows matching pieces already in the wardrobe (type, colours, pattern, name) start unticked: importing the same sheet again doubled it */
/* the sample wardrobe's pieces aren't his: a row matching one stays ticked (re-audit 2026-11-15: his own white shirt, navy suit, belt and
   socks were left unticked as "already in your wardrobe", and gone once he removed the sample) */
function kitDupMark(rows){const have={};for(const i of items){if(i.sample&&!kitEdited(i))continue;const k=kitDupKey(i);have[k]=(have[k]||0)+1}
  for(const x of rows)if(x.ok){const k=kitDupKey(x.card);if(have[k]>0){have[k]--;x.dup=true;x.on=false}else{x.dup=false;x.on=true}}}
function kitImportText(t,file){const r=kitRead(t),el=$('#kit-prev');if(!el)return;
  if(file&&!String(t).trim()){kitImp=null;el.innerHTML='<p class="kit-err">The file is empty.</p>';kitImpBtn();return}
  if(r.err){kitImp=null;el.innerHTML=String(t).trim()?`<p class="kit-err">${esc(r.err)}</p>`:'';kitImpBtn();return}
  kitDupMark(r.rows);kitImp=r;kitPrevDraw()}
/* the preview: the rows left out first, then each piece with a tick; a named piece shows its colour and pattern too */
function kitPrevDraw(){const r=kitImp,el=$('#kit-prev');if(!r||!el)return;const good=r.rows.filter(x=>x.ok),bad=r.rows.filter(x=>!x.ok),dup=good.filter(x=>x.dup).length;
  const row=(x,n)=>{const t=sentence(itemTitle(x.card)),info=[TYPES[x.card.type],x.card.name?sentence(desc(x.card)):'',x.dup?'already in your wardrobe':'',...x.probs].filter(Boolean).join(' · ');
    return `<li class="ok${x.dup?' dup':''}"><label class="kit-row"><input type="checkbox" class="kit-tick" ${x.on?'checked':''} onchange="kitImpTick(${n},this.checked)"><span class="kit-dot">${swatchSVG(x.card,true)}</span><span><b>${esc(t)}</b><small>${esc(info)}</small></span></label></li>`};
  el.innerHTML=`<p class="kit-sum"><b>${good.length} item${good.length===1?'':'s'} ready</b>${bad.length?`, ${bad.length} row${bad.length===1?'':'s'} left out`:''}${dup?`. ${dup===1?'One is':dup+' are'} already in your wardrobe: check ${dup===1?'it':'them'} to add another`:''}</p>
<ul class="kit-rows">${bad.map(x=>`<li class="bad"><span class="kit-dot kit-no" aria-hidden="true">!</span><span><b>Row ${x.line}</b><small>${esc(x.why)}</small></span></li>`).join('')}${r.rows.map((x,n)=>x.ok?row(x,n):'').join('')}</ul>`;
  kitImpBtn()}
function kitImpTick(n,on){const x=kitImp&&kitImp.rows[n];if(x)x.on=!!on;kitImpBtn()}
function kitImpBtn(){const b=$('#kit-imp');if(!b)return;const n=kitImp?kitImp.rows.filter(x=>x.ok&&x.on).length:0;b.disabled=!n||kitImpBusy;b.textContent=n?`Add ${n} item${n===1?'':'s'}`:'Add items'}
/* Add N items: written in one go (a second tap does nothing, a kill stores all or nothing), then one Undo; Cancel and ✕ wait for it */
async function kitImportGo(){if(!kitImp||kitImpBusy)return;const cards=kitImp.rows.filter(x=>x.ok&&x.on).map(x=>x.card).filter(c=>!items.some(i=>i.id===c.id));if(!cards.length)return;
  kitImpBusy=true;const b=$('#kit-imp'),cx=[$('#kit-cancel'),$('#kitsheet .kit-x')];if(b){b.disabled=true;b.textContent=`Adding ${cards.length} item${cards.length===1?'':'s'}…`}for(const x of cx)if(x)x.disabled=true;
  const prog=(k,n)=>{if(b&&(k%20===0||k===n))b.textContent=`Adding ${k} of ${n}…`};   // (all of it is kept only once the last is written)
  let ok=false,list=[];try{list=cards.map(kitItem);ok=await kitStore(list,cards.length>40?prog:null)}finally{kitImpBusy=false;for(const x of cx)if(x)x.disabled=false}
  if(!ok){kitImpBtn();return}
  const ids=list.map(i=>i.id);kitImp=null;try{localStorage.setItem(KIT_IMP_LAST,JSON.stringify({ids,at:Date.now()}))}catch{}
  kitClose();if($('#add')&&!$('#add').hidden)renderAdd();else if(typeof renderWardrobe==='function'&&$('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();
  toast(`Imported ${ids.length} item${ids.length===1?'':'s'}.`,KIT_IMP_UNDO_MS,{label:'Undo',fn:()=>kitUnsave({its:ids,qs:[]})})}
/* the last import taken out again, after its Undo has gone (from the import sheet) */
async function kitUnimport(){const l=kitLastImp();if(!l)return;
  if(!await askConfirm(`Take out the ${l.ids.length} item${l.ids.length===1?'':'s'} of your last import?\n\nAnything you added another way stays${l.kept?`, and so ${l.kept===1?'does the imported piece':`do the ${l.kept} imported pieces`} you changed since`:''}.`,{ok:'Take them out',danger:true}))return;
  try{await kitDelMany(l.ids)}catch(e){kitFail(e);return}
  try{localStorage.removeItem(KIT_IMP_LAST)}catch{}const r=$('#kit-last');if(r)r.remove();if(kitImp){kitDupMark(kitImp.rows);kitPrevDraw()}
  toast(`Taken out: ${l.ids.length} item${l.ids.length===1?'':'s'}.`,3000)}

/* ---- a sample wardrobe to try the app with: plain and patterned pieces enough for a varied month, marked sample ----
   It follows the dress code (no suits or blazers without jackets, then two more trousers; no ties without ties), is written in one go
   (a second tap is ignored, a kill stores all or nothing), and a tap after a partial sample from before adds only the pieces missing
   (matched by type, colours, pattern and cuffs). From the setup's last step it finishes the setup first (holidays, the vest default).
   A sample piece the owner changed is his: Remove the sample keeps it (kitEdited). (2026-11-15, the new-user audit) */
const KIT_SAMPLE=[
  ['suit','navy',null,'solid',{vest:'no',name:'Navy suit'}],['suit','charcoal',null,'pinstripe',{vest:'yes',name:'Charcoal pinstripe'}],['suit','midgrey',null,'herringbone',{vest:'no'}],
  ['blazer','navy',null,'solid',{name:'Navy blazer'}],['blazer','tan',null,'windowpane',{}],
  ['pants','grey',null,'solid',{}],['pants','stone',null,'solid',{trouserKind:'chinos'}],
  ['shirt','white',null,'solid',{}],['shirt','lightblue',null,'solid',{}],['shirt','white','blue','stripe',{}],['shirt','pink',null,'solid',{}],['shirt','white',null,'solid',{cuff:'french'}],
  ['tie','burgundy',null,'solid',{}],['tie','navy','white','polka-dot',{}],['tie','green',null,'solid',{}],['tie','silver',null,'solid',{}],['tie','navy','burgundy','stripe',{}],
  ['shoes','black',null,'solid',{shoeStyle:'oxford'}],['shoes','brown',null,'solid',{shoeStyle:'derby'}],
  ['belt','black',null,'solid',{}],['belt','brown',null,'solid',{}],['socks','navy',null,'solid',{}],['socks','charcoal',null,'solid',{}],['watch','silver',null,'solid',{metal:'silver'}]];
const KIT_SAMPLE_NOJKT=[['pants','navy',null,'solid',{}],['pants','charcoal',null,'solid',{}]];   // without jackets: trousers enough to judge (shop.js SHOP_MIN)
const KIT_EDIT_MS=3000;
const kitHasSample=()=>items.some(i=>i.sample&&!kitEdited(i));   // (pieces he made his alone are no sample wardrobe: a phone joining got the banner for them)
/* a sample piece he changed is his now. Only an edit he makes in the item sheet makes it his: app.js put sets item.sampleMine while the item sheet is open on it (kitUserEdit);
   a new stamp alone doesn't (re-audit 2026-11-15: a roll back or a start-up fix-up such as migrateVests or checkArrivals restamped an
   untouched sample piece, which was then uploaded and kept on Remove the sample), nor does out of rotation (itemsheet.js togglePause sets
   kitNoMine around its save: paused sample shoes stayed after Remove the sample) */
let kitNoMine=false;
const kitUserEdit=i=>{if(i&&i.sample&&!kitNoMine&&typeof editing!=='undefined'&&editing===i.id)i.sampleMine=1};
const kitEdited=i=>!!i.sample&&!!i.sampleMine;
/* the sample pieces the earlier rule counted as his (fix round 3, W1-3-01: an edit, a pause or a cleaning on 14-15 Nov builds made a piece
   his, updated more than KIT_EDIT_MS after added; the rule above turned them back into sample, and Remove the sample took them with their
   history). Once per device after the first pull, a sample piece added before the rule changed (KIT_MINE_CUT, when #454 was deployed)
   and stamped by the old rule is made his (no longer a sample piece, as Keep it as mine does, with a new stamp, so it goes up and other phones take it) */
const KIT_MINE_CUT=Date.UTC(2026,10,15,12);
const kitOldMine=i=>!!i&&!!i.sample&&!i.sampleMine&&(i.added||0)<KIT_MINE_CUT&&(i.updated||0)-Math.max(i.added||0,i.sampleBase||0)>KIT_EDIT_MS;
async function kitSampleMigrate(){try{if(localStorage.getItem('kit_mine'))return}catch{return}
  const l=items.filter(kitOldMine).map(i=>{const c={...i};delete c.sample;delete c.sampleMine;delete c.sampleBase;return c});   // (his, as Keep it as mine makes it)
  if(l.length){const now=Date.now();
    try{await kitTx(['items'],t=>{const s=t.objectStore('items');for(const it of l){it.updated=now;s.put(it)}})}catch(e){console.warn('sample pieces not kept as his',e);return}
    for(const it of l){const k=items.findIndex(x=>x.id===it.id);if(k>=0)items[k]=it}
    cache={};todayStale=true;if(window.scheduleSync)scheduleSync();
    toast(`${l.length===1?'The sample piece':`The ${l.length} sample pieces`} you changed ${l.length===1?'is':'are'} yours: Remove the sample keeps ${l.length===1?'it':'them'}.`,6000)}
  try{localStorage.setItem('kit_mine','1')}catch{}}
/* does a day's record, with the sample's pieces taken out (kitSampleDay), still hold anything of his? His own pieces, a pick, the week's
   lock of his own pieces, an occasion, a kind, a skip, a piece taken off, a trip. A record that holds nothing else was made from the
   sample: it never goes up (sync.js syncShare), and Remove the sample gives it the stamp KIT_YIELD, so the account's own record of that
   day, made on another phone, wins over it (fix round 3, W1-6-04: Remove the sample on a phone that tried the sample before joining
   stamped its sample days new and wiped the other phone's real days) */
const KIT_YIELD=1;
const KIT_OWN=['force','lock','occasion','formal','kind','skip','off','trip'];
const kitDayOwn=c=>!!(c.ids&&Object.values(c.ids).some(Boolean))||KIT_OWN.some(k=>c[k]&&(typeof c[k]!=='object'||Object.keys(c[k]).length));
const kitSampleSig=i=>[i.type,i.primaryColor,i.secondaryColor||'',FABRIC.includes(i.type)?i.pattern||'solid':'solid',i.cuff==='french'?'f':''].join('|');
function kitSampleCards(){const l=KIT_SAMPLE.filter(x=>!dressOut(x[0]));if(!wearsJacket())l.push(...KIT_SAMPLE_NOJKT);
  return l.map(([type,c,c2,p,x])=>({id:crypto.randomUUID(),manual:true,type,primaryColor:c,secondaryColor:c2,tertiaryColor:null,pattern:FABRIC.includes(type)?p:'solid',metal:'silver',leather:'calf',sample:true,...x}))}
let kitSampling=false;
/* items another tab stored that this one doesn't hold yet (each tab keeps its own `items`): taken in before the sample is counted */
async function kitAdopt(){let all=[];try{all=await tx('readonly',s=>s.getAll())||[]}catch(e){console.warn('wardrobe not read',e);return}
  const have=new Set(items.map(i=>i.id)),add=all.filter(i=>i&&i.id&&!have.has(i.id));if(!add.length)return;
  let tomb={};try{tomb=await metaGet('tombstones')||{}}catch{}
  const live=add.filter(i=>!(tomb[i.id]>=(i.updated||0)));if(live.length){items.push(...live);cache={};todayStale=true}}
function kitSampleBusy(on){for(const b of document.querySelectorAll('#kit-sample-link,[onclick^="kitSampleLoad"],#kit-sample button')){b.disabled=on;if(on)b.setAttribute('aria-busy','true');else b.removeAttribute('aria-busy')}}
async function kitSampleLoad(){if(kitSampling)return;kitSampling=true;kitSampleBusy(true);
  try{await kitAdopt();   // what another tab of the app stored meanwhile (re-audit 2026-11-15: a stale second tab loaded a second sample, 48 pieces)
    const have=new Set(items.filter(i=>i.sample).map(kitSampleSig)),missing=kitSampleCards().filter(c=>!have.has(kitSampleSig(c)));
    if(!missing.length){kitSampleDone();toast('The sample wardrobe is already here: swipe through the days to see outfits.',4000);return}
    if(!have.size&&items.length&&!await askConfirm('Add the sample wardrobe next to your own clothes?',{ok:'Add the sample'}))return;
    // (connected: the sample stays on this phone, never backed up, sync.js syncShare)
    if(!await kitStore(missing.map(kitItem)))return;   // (said why; nothing stored)
    kitSampleDone();
    toast(have.size?`The rest of the sample wardrobe is here: ${missing.length} more piece${missing.length===1?'':'s'}.`:`A sample wardrobe of ${missing.length} pieces: swipe through the days to see outfits.`,4500)}
  finally{kitSampling=false;kitSampleBusy(false)}}
/* then Today on the next workday; from the setup's last step the setup finishes first, as Skip and "Add my first item" finish it */
function kitSampleDone(){if(typeof setupShown==='function'&&setupShown()&&typeof setupFinish==='function')setupFinish(false);
  cache={};todayStale=true;show('today');if(typeof goToday==='function')goToday()}   // on a weekend, the next workday's outfit
/* Remove the sample: every sample piece the owner didn't change goes, with what the days recorded of them (worn days, locks, picks;
   occasions stay), in one transaction; a changed one stays as his */
async function kitSampleRemove(quiet){if(kitSampling)return;   // quiet: already asked (account.js, connecting with the sample loaded)
  const s=items.filter(i=>i.sample);if(!s.length)return;
  const keep=s.filter(kitEdited),gone=s.filter(i=>!kitEdited(i)),kn=keep.length;
  const also=kn?`, and so ${kn===1?'does the sample piece':`do the ${kn} sample pieces`} you changed: ${kn===1?'it is':'they are'} yours now`:'';
  if(!quiet&&gone.length&&!await askConfirm(`Remove the ${gone.length} sample piece${gone.length===1?'':'s'}?\n\nYour own clothes stay${also}.`,{ok:'Remove',danger:true}))return;
  kitSampling=true;kitSampleBusy(true);if(!quiet)toast('Removing the sample…',8000);
  try{if(typeof recordRun!=='undefined'&&recordRun)await Promise.resolve(recordRun).catch(()=>{});   // (a recording of today from the plan with the sample, still running, would write its pieces back after)
    const ids=new Set(gone.map(i=>i.id)),mine=keep.map(i=>{const c={...i};delete c.sample;delete c.sampleMine;return c}),T=todayDate();
    const orig=Object.values(dayRecs).filter(r=>[...ids].some(id=>JSON.stringify(r).includes(id)));
    // a day made only from the sample keeps the stamp KIT_YIELD: the account's own record of it (another phone's) wins (kitDayOwn)
    const days=orig.map(r=>{const c=kitSampleDay(r,ids,T);if(!kitDayOwn(c))c.updated=KIT_YIELD;return c});
    const undo={items:s.map(i=>JSON.parse(JSON.stringify(i))),days:orig.map(r=>JSON.parse(JSON.stringify(r)))};
    await kitDelMany([...ids],mine,days);if(typeof clearLocks==='function')await clearLocks();
    undo.wrote=Object.fromEntries(days.map(c=>[c.date,c.updated]));kitRmUndo=undo;
    // connected: the account's records of those days come in before Today records anything from the plan (kitSampleUndo)
    if(typeof isConnected==='function'&&isConnected()&&window.syncNow)await Promise.race([syncNow().catch(()=>{}),new Promise(r=>setTimeout(r,KIT_RM_SYNC))])}
  catch(e){kitFail(e);return}finally{kitSampling=false;kitSampleBusy(false)}
  if(quiet){cache={};todayStale=true;if(typeof refreshToday==='function'&&!$('#today').hidden)refreshToday();return}
  show(items.length?'today':'wardrobe');toast(kn?`The sample wardrobe is gone. The ${kn===1?'piece':`${kn} pieces`} you changed stayed.`:'The sample wardrobe is gone.',8000,{label:'Undo',fn:kitSampleUndo})}
/* Undo of Remove the sample (fix round 3): the pieces come back (a new stamp, newer than their deletion marks) as they were, and each day
   record still as Remove left it is put back as it was before; a day the account's record replaced meanwhile (a sync) keeps that. A day
   that went back to the sample keeps its old stamp when Remove had given it KIT_YIELD (it never went up), else takes a new one */
let kitRmUndo=null;const KIT_RM_SYNC=8000;
async function kitSampleUndo(){const u=kitRmUndo;if(!u||kitSampling)return;kitRmUndo=null;kitSampling=true;kitSampleBusy(true);
  try{const now=Date.now(),its=u.items.map(i=>({...i,updated:now}));
    const days=u.days.filter(r=>dayRecs[r.date]&&dayRecs[r.date].updated===u.wrote[r.date]).map(r=>({...r,updated:u.wrote[r.date]===KIT_YIELD?r.updated:now}));
    await kitTx(['items','days'],t=>{const s=t.objectStore('items'),d=t.objectStore('days');for(const it of its)s.put(it);for(const r of days)d.put(r)});
    const back=new Map(its.map(i=>[i.id,i]));items=items.filter(i=>!back.has(i.id)).concat(its);for(const r of days)dayRecs[r.date]=r;
    cache={};todayStale=true;if(window.scheduleSync)scheduleSync()}
  catch(e){kitFail(e);return}finally{kitSampling=false;kitSampleBusy(false)}
  show('today');toast('The sample wardrobe is back.',3000)}
/* a day's record with the sample's pieces taken out (re-audit 2026-11-15, N2: the record was cut to its occasion, and history.js recordDays
   then filled the past day again from today's plan: "Didn't" days became worn, a suit bought later was worn before it came, real wears were
   replaced). Everything else the day recorded stays: worn or not, a corrected day, the occasion, the own pieces.
   - a past day (or one marked worn): the sample's slots are emptied and marked gone (planner.js frozenOutfit rates the day without them, as
     after a Delete); a day that wore only sample pieces keeps no outfit (noOutfit: recordDays leaves it, the planner and Insights skip it,
     Today says so)
   - today and the coming days: their pieces, lock and picks of sample pieces go, and the day is planned again from what is left */
function kitSampleDay(r,ids,T){const c=JSON.parse(JSON.stringify(r)),hit=o=>!!o&&Object.values(o).some(v=>ids.has(v));
  const strip=k=>{if(!hit(c[k]))return;for(const [s,v] of Object.entries(c[k]))if(ids.has(v))delete c[k][s];if(!Object.keys(c[k]).length)delete c[k]};
  if(hit(c.lock)){delete c.lock;delete c.lockAt}strip('force');
  if(hit(c.ids)){
    if(keyDate(c.date)<T||c.worn===true){const g={};for(const [s,v] of Object.entries(c.ids))if(ids.has(v)){c.ids[s]=null;g[s]=1}
      if(Object.values(c.ids).some(Boolean))c.gone={...(c.gone||{}),...g};
      else{for(const k of ['ids','suitDay','vestOn','gone','auto'])delete c[k];c.noOutfit=1}}
    else for(const k of ['ids','suitDay','vestOn','auto'])delete c[k]}
  return c}
/* a sample piece kept as the owner's own (the item sheet) */
async function kitKeepSample(id){const it=items.find(i=>i.id===id);if(!it||!it.sample)return;delete it.sample;delete it.sampleMine;await put(it);cache={};todayStale=true;
  if(typeof renderWardrobe==='function'&&$('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();toast('It’s yours now: Remove the sample keeps it.',3000)}
/* marks: the Wardrobe grid's tag and the item sheet's note */
const kitSampleTag=i=>i.sample&&!kitEdited(i)?'<span class="pausetag sampletag">Sample</span>':'';
const kitSampleNote=i=>i.sample&&!kitEdited(i)?`<section class="card ivsec ivsample"><p class="shelp">A piece of the sample wardrobe: Remove the sample takes it away. Change anything on it, or keep it, and it stays as yours.</p><div class="btns"><button type="button" id="iv-keep" onclick="kitKeepSample('${i.id}')">Keep it as mine</button></div></section>`:'';
/* Today, while sample pieces are there */
function kitSampleBanner(){if(!kitHasSample())return '';const own=items.filter(i=>!i.sample||kitEdited(i)).length;
  return `<div class="kit-banner" id="kit-sample"><b>You're trying a sample wardrobe</b><small>${own?`Your ${own} own piece${own===1?' is':'s are'} mixed in. `:''}Swipe through the days, tap the score, try a swap. Add your own clothes whenever you like.</small>
<div class="btns"><button type="button" onclick="openAdd()">Add my own</button><button type="button" onclick="kitSampleRemove()">Remove the sample</button></div></div>`}
/* the setup's last step, Today's checklist and the empty Wardrobe: the ways in for a new user */
const kitStartRow=inSetup=>`<div class="kit-start"><button type="button" class="linkbtn" id="kit-tour-link" onclick="tourOpen()">Take the 1-minute tour</button><span aria-hidden="true">·</span><button type="button" class="linkbtn" id="kit-sample-link" onclick="${inSetup?'setupSample(event)':'kitSampleLoad()'}">Try a sample wardrobe</button></div>`;

/* ---- Add to Home Screen (2026-11-14, the owner: show a new person on an iPhone how to add it as a web app) ----
   iPhone and iPad only, in a browser tab (homeNeeded): the setup's Home Screen step (setup.js) and Settings → About (#home-again). The app
   on the Home Screen opens full screen, and it is the only way iOS lets a web app show notifications (the morning reminder). It keeps its
   own storage apart from Safari's, so the step comes before anything is set up. window.DW_STANDALONE / DW_IOS: tests */
const homeIOS=()=>window.DW_IOS===true||/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const homeStandalone=()=>window.DW_STANDALONE===true||navigator.standalone===true||(typeof matchMedia==='function'&&matchMedia('(display-mode: standalone)').matches);
/* Android (2026-11-14, the owner: "the same thing for android with an install button"): Chrome and other Android browsers offer the install
   themselves (beforeinstallprompt, kept in homeEvt): the step's Install button opens the browser's own dialog; where the browser gives none
   (Firefox, an install dismissed, a browser that never offers it) the step shows the menu steps instead. The installed app shares the
   browser's storage, so nothing is said about setting up first. window.DW_ANDROID: tests */
const homeAndroid=()=>window.DW_ANDROID===true||(!homeIOS()&&/Android/i.test(navigator.userAgent));
const homeNeeded=()=>(homeIOS()||homeAndroid())&&!homeStandalone();
let homeEvt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();homeEvt=e;homeSync()});
addEventListener('appinstalled',()=>{homeEvt=null;homeSync();if(typeof toast==='function')toast('Installed. Open Daily Wardrobe from its new icon.')});
/* the Install button where the browser offers it, the menu steps where it doesn't (updated in place: the offer can come after the step is drawn) */
function homeSync(){const can=!!homeEvt;document.querySelectorAll('.home-install').forEach(b=>b.hidden=!can);document.querySelectorAll('.home-manual').forEach(m=>m.hidden=can)}
async function homeInstall(){const e=homeEvt;if(!e)return homeSync();homeEvt=null;   // (the browser's offer can be used once)
  try{await e.prompt();const r=await e.userChoice;if(r&&r.outcome==='accepted'){if(typeof toast==='function')toast('Installing… open Daily Wardrobe from its new icon.')}}catch(_){}
  homeSync()}
const homeIPad=()=>/iPad/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const HOME_SHARE='<svg viewBox="0 0 24 24" class="home-ico" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10H5v11h14V10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const HOME_DL='<svg viewBox="0 0 24 24" class="home-ico" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HOME_ADD='<svg viewBox="0 0 24 24" class="home-ico" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
/* the picture: the phone's screen with the app's own icon (icon-192.png) on it */
const homePic=()=>'<svg viewBox="0 0 120 160" class="home-pic" aria-hidden="true"><rect x="22" y="6" width="76" height="148" rx="14" class="hp-phone"/><rect x="28" y="20" width="64" height="120" rx="4" class="hp-screen"/>'+
  [[34,30],[52,30],[70,30],[34,50],[52,50],[70,50],[34,70]].map(([x,y],i)=>i===6?'<clipPath id="hp-clip"><rect x="'+x+'" y="'+y+'" width="14" height="14" rx="3.5"/></clipPath><image href="icon-192.png" x="'+x+'" y="'+y+'" width="14" height="14" clip-path="url(#hp-clip)"/>':'<rect x="'+x+'" y="'+y+'" width="14" height="14" rx="3.5" class="hp-icon"/>').join('')+
  '<text x="41" y="94" class="hp-label">Wardrobe</text></svg>';
function homeStepsAndroid(inSetup){
  return '<div class="home-wrap">'+homePic()+'<p class="su-lead home-lead">Install Daily Wardrobe on your phone: it gets its own icon and opens full screen like an app, straight to today\'s outfit.</p>'+
    '<p class="home-cta"><button type="button" class="pri home-install"'+(homeEvt?'':' hidden')+' onclick="homeInstall()">'+HOME_DL+' Install the app</button></p>'+
    '<div class="home-manual"'+(homeEvt?' hidden':'')+'><ol class="home-steps"><li><span class="home-n">1</span><span>Tap the menu <b>⋮</b> at the top right of your browser.</span></li>'+
    '<li><span class="home-n">2</span><span>Tap <b>Install app</b> or <b>Add to Home screen</b>.</span></li>'+
    '<li><span class="home-n">3</span><span>Tap <b>Install</b>, then open Daily Wardrobe from its new icon.</span></li></ol></div>'+
    (inSetup?'<p class="su-note home-note">Everything you set up here comes with it.</p><p class="su-help">Or tap Next to carry on here.</p>':'')+'</div>'}
/* (audit 2026-11-15, H12) the one explanation of the Home Screen app on an iPhone: the setup's step, About's button and the sheet a tester
   gets after connecting from a link (account.js homeScreenGuide) all show this. iOS 26's Safari shows ⋯ at the bottom (Share is in its
   menu); the Home Screen app keeps its own storage and starts unconnected, so a tester copies the invitation link here to paste there */
const homeTester=()=>typeof isTester==='function'&&isTester()&&typeof myInviteLink==='function'&&!!myInviteLink();
const homeCopyBtn=()=>'<p class="home-cta"><button type="button" class="pri home-copy" onclick="homeCopy()">Copy my invitation link</button></p><input type="text" class="home-mylink" readonly hidden aria-label="Your invitation link">';
async function homeCopy(){const l=typeof myInviteLink==='function'?myInviteLink():'';if(!l)return false;
  try{await navigator.clipboard.writeText(l);toast('Your invitation link is copied. Paste it in the Home Screen app.',4500);return true}
  catch{document.querySelectorAll('.home-mylink').forEach(f=>{f.hidden=false;f.value=l;f.select()});toast('Copy the link shown under the button.',5000);return false}}
function homeNote(){const conn=typeof isConnected==='function'?isConnected():false;
  if(homeTester())return '<p class="su-note home-note"><b>Safari is connected already.</b> The Home Screen app keeps its own storage, apart from Safari\'s, so it starts empty: paste your invitation link when it asks, and your wardrobe comes across.</p>';
  if(conn)return '<p class="su-note home-note"><b>Safari is connected already.</b> The Home Screen app keeps its own storage, apart from Safari\'s: connect it too, in its Settings → Connection.</p>';
  if(items.length)return '<p class="su-note home-note"><b>Your wardrobe stays here in Safari.</b> The Home Screen app keeps its own storage and starts empty. To take your wardrobe along, tap <b>Download backup</b> in Settings → Backup &amp; sync here, then <b>Restore file</b> in the Home Screen app.</p>';
  return '<p class="su-note home-note"><b>The Home Screen app keeps its own storage</b>, apart from Safari\'s: if you add it now, set it up there rather than here.</p>'}
function homeSteps(inSetup){if(homeAndroid())return homeStepsAndroid(inSetup);const pad=homeIPad(),t=homeTester();
  return '<div class="home-wrap">'+homePic()+'<p class="su-lead home-lead">Put Daily Wardrobe on your Home Screen: it opens full screen like an app, and it is the only way your '+(pad?'iPad':'iPhone')+' lets it send the morning reminder.</p>'+
    '<ol class="home-steps">'+(pad?'<li><span class="home-n">1</span><span>Tap Share '+HOME_SHARE+' at the top right of Safari.</span></li>'
      :'<li><span class="home-n">1</span><span>Tap <b>⋯</b> at the bottom right of Safari, then <b>Share</b> '+HOME_SHARE+'.<small>If you see Share '+HOME_SHARE+' there instead, tap it.</small></span></li>')+
    '<li><span class="home-n">2</span><span>Tap <b>Add to Home Screen</b> '+HOME_ADD+'.<small>Not in the list? Scroll down, or tap View More.</small></span></li>'+
    '<li><span class="home-n">3</span><span>Leave <b>Open as Web App</b> on and tap <b>Add</b>.</span></li>'+
    '<li><span class="home-n">4</span><span>Open Daily Wardrobe from its new icon'+(t?' and paste your invitation link at the setup\'s Connection step.':'.')+'</span></li></ol>'+
    (t?homeCopyBtn():'')+homeNote()+(inSetup?'<p class="su-help">Or tap Next to carry on here.</p>':'')+'</div>'}
const homeLabel=()=>homeAndroid()?'Install the app':'Add to Home Screen';
const HOME_CARD={key:'home',get title(){return homeLabel()},pic:()=>'',last:'Got it',get body(){return homeSteps(false)}};
function homeOpen(){kitOpen([HOME_CARD])}
/* Settings → About: the button only where it helps */
function homeAbout(){const b=$('#home-again');if(b){b.hidden=!homeNeeded();b.textContent=homeLabel()}}
homeAbout();   // (once at start: the device doesn't change; Settings can open straight on About, where renderAbout doesn't run)
