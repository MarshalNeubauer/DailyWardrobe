/* Daily Wardrobe: Add, saving (split from add.js, Round C 2026-11-17): Save all, the Saved toast's title, a card found by its id
   (cardOf, qAt, qh), and Confirm (save, saveCard). */
/* save every finished card in the queue (Skip the ones you don't want first) */
/* a card Claude is still reading (tagging again with the close-up, or its pattern) can't be saved yet: saved meanwhile it kept the
   weaker reading and the pattern call was paid for anyway (audit 2026-11-13); Confirm and Save all wait for it */
const cardReading=q=>!!(q&&(q.refining||q.patternReading));
/* a card that can be saved now (Save all and its count) */
const cardReady=q=>!!q&&!q.busy&&!q.err&&!q.multiErr&&!q.saving&&!needType(q);
/* one Save all at a time: a double tap ran two loops over the same cards, and the Wardrobe showed every piece twice (deleting the
   "copy" deleted the only real one); each card is saved by its id, last first, so Undo puts them back in their places */
let saveAllOn=false;
async function saveAll(){if(saveAllOn||queue.some(cardReading))return;saveAllOn=true;renderAdd();let n=0;
  try{const cards=queue.filter(cardReady);for(let k=cards.length-1;k>=0;k--){const q=cards[k];if(queue.includes(q)&&await save(q.id)===true)n++}}
  finally{saveAllOn=false}
  const left=queue.filter(needType).length;
  if(n||left)multiMsg(`${n?`Saved ${n} item${n===1?'':'s'} to your wardrobe.`:''}${left?`${n?' ':''}${left===1?'One card needs its type':`${left} cards need their type`} first.`:''}`);renderAdd()}
/* Confirm (and the sample, the import, Save all): a failure is said and the card stays (a tester's Confirm did nothing at all, 2026-11-14) */
/* (2026-11-17, the title audit) the short title, shortDesc: "Saved: Navy argyle socks." */
/* what the Saved toast calls the item: its own name, else its colours with what it is ("Grey suit", "Navy tie", "Gold watch · white dial
   · bracelet"; it said "Saved: Grey." for a suit and "Saved: Navy." for a tie and for socks) */
function savedTitle(it){const nm=itemName(it);if(nm)return nameIso(nm);const sw=styleWord(it).trim(),d=String(shortDesc(it)||'').trim(),t=sw||(TYPES[it.type]||'item').toLowerCase();   // (a shoe's style or a trouser's kind as the noun: "Oxblood scotch grain loafers", not "… shoes")
  if(!d)return sentence(t);const k=d.indexOf(' · ');return sentence(k<0?`${d} ${t}`:`${d.slice(0,k)} ${t}${d.slice(k)}`)}
/* a card by its id (Confirm, Save all) or, as before, its place (the sample, the import, tests) */
const cardOf=k=>typeof k==='string'?queue.find(q=>q.id===k):queue[k];
/* every handler drawn on a card finds it by its id when tapped (CR-1-08): qAt(id) is the card's place in the list at that moment (-1 once
   gone), qh(q) writes that call into the markup; a place written in when the card was drawn pointed at another card once the list moved */
const qAt=id=>queue.findIndex(q=>q.id===id);
const qh=q=>`qAt('${jsq(q.id)}')`;
/* one save per card (audit 2026-11-15, C2: a double tap on Confirm saved the card twice and, the list having moved up, threw away the
   next card unsaved): the card is found by its id, marked while it saves (a second tap does nothing) and its Confirm switched off;
   -> true once saved, false when it couldn't be */
async function save(k){const q=cardOf(k);if(!q||q.saving||cardReading(q))return false;
  if(needType(q)){toast('Choose what it is first: pick its Type.',4000);return false}
  q.saving=1;const b=$('#qconf-'+queue.indexOf(q));if(b)b.disabled=true;
  if(!saveAllOn)await addKeep();   // the card as it is now (a kill right after Confirm brought back How many one lower: the last + waited for the timer)
  try{return await saveCard(q)}catch(e){console.warn('save failed',e);if(typeof errNote==='function')errNote(e,'Confirm on Add ('+q.type+')');
    if(typeof storeFailure==='function'&&storeFailure(e))saveFailed(e);else toast('Couldn’t save: '+String(e&&e.message||e).replace(/\.$/,'')+'. Try again.',7000);return false}
  finally{delete q.saving;if(queue.includes(q)&&$('#add')&&!$('#add').hidden)renderAdd()}}
async function saveCard(q){
  if(!q||cardReading(q))return false;
  const f=FABRIC.includes(q.type);
  generateSwatch(q);
  const it={id:q.id,type:q.type,primaryColor:q.primaryColor,secondaryColor:q.secondaryColor,tertiaryColor:q.tertiaryColor,pattern:hasPat(q.type)?q.pattern:'solid',photo:q.photo,added:nowMs()};
  if(f){it.swatch=q.swatch;it.swSrc=q.swSrc}
  {const a=accentsOf(q);if(a.length)it.accents=a}   // its colours beyond the three (core.js accentsOf)
  // a sock's toe cap: its own field, always set (a sock without it is from before: core.js sockToe). A card that never had the field (an
  // import's row: kit.js) keeps a plain sock's second colour as its toe cap, as a spreadsheet means it
  if(q.type==='socks'){const plain=(patBase(it.pattern)||'solid')==='solid',old=q.toeColor===undefined&&plain&&it.secondaryColor&&COLORS[it.secondaryColor]?it.secondaryColor:null;
    it.toeColor=q.toeColor&&COLORS[q.toeColor]?q.toeColor:old||'none';if(old)it.secondaryColor=null}
  if(q.order){it.paused=true;it.order=true;if(q.arrives)it.arrives=q.arrives}   // bought, on the way
  if(METAL_TYPES.includes(q.type))it.metal=q.metal||'silver';
  if(q.type==='shirt')it.cuff=q.cuff||'button';
  if(q.type==='suit')it.vest=(q.vest||(typeof newSuitVest==='function'?newSuitVest():'no'))==='yes'?'yes':'no';if(typeof dressNewItem==='function')dressNewItem();
  if(SEASON_TYPES.includes(q.type)&&q.season&&q.season!=='all')it.season=q.season;
  if(q.type==='shoes'||q.type==='belt')it.leather=q.leather||'calf';
  if(q.type==='pants'&&(q.trouserKind==='chinos'||q.trouserKind==='jeans'||q.trouserKind==='cargo'))it.trouserKind=q.trouserKind;   // dress trousers: no field (as before kinds)
  if(q.type==='shoes'&&q.shoeStyle&&q.shoeStyle!=='oxford')it.shoeStyle=q.shoeStyle;
  if(q.type==='watch'){const wo=watchOpts(q);Object.assign(it,{dial:wo.dial,band:wo.band,bezel:wo.bezel,watchStyle:wo.style})}
  if(!it.photo)delete it.photo;else await makeSmall(it);
  if(q.texture&&TEXTURE_TYPES.includes(q.type))it.texture=q.texture;
  if(q.meas)it.meas={lab:q.meas.lab,ref:!!q.meas.ref,src:q.meas.src,...(q.meas.parts?{parts:q.meas.parts.map(p=>({role:p.role,lab:p.lab,hex:p.hex,share:p.share}))}:{})};   // a patterned cloth's ground and stripe too (colpick.js)
  if(q.tagAI&&!q.manual)it.tagAI=q.tagAI;   // Claude's colour it gave, how sure it was, its runner-ups (measure.js aiSignals): to calibrate the verdict later
  wardSaveFields(q,it);matTidy(it);if(typeof cpwSaveFields==='function')cpwSaveFields(q,it);   // (cost.js: the price and the day bought)   // name, brand, material, notes (wardrobe.js); no material the type can't have (CR-1-06)
  if(q.shade)it.shade=q.shade;   // drawn darker or lighter than the swatch, to match the close-up   // the owner's own colour samples (calibLab)
  if(q.sett&&!q.settOff&&readable(it.type,it.pattern,q.weave)){it.sett=q.sett;if(q.patternBox)it.pbox=q.patternBox}   // the full pattern (pattern-read.js)
  if(q.weave&&FABRIC.includes(it.type)&&it.pattern!=='solid'){it.weave=q.weave;if(q.weave.description)it.patternText=q.weave.description}
  if(q.spec&&it.sett&&it.sett.src==='claude+pixels')it.patternSpec=q.spec;   // Claude's reading of the pattern (pattern-read.js)
  // the old brightness-only stripe reader: only where the full reader had nothing to go on (no close-up), and never after it turned down a reading as contradicting the tag
  if(!it.sett&&!q.texture&&!q.settReject)try{const st=detectQueued(q,it);if(st)it.stripes=st}catch(e){console.warn('pattern detection failed',e)}
  lookSave(q,it);   // the Look beta's fields (look.js: a coat's pattern, a knit's close-up, Looks right, Claude's runner-ups, own leather or metal); nothing with it off
  colTidy(it);   // no second or third colour its type can't show (colpick.js)
  if(q.sample)it.sample=true;   // the sample wardrobe (kit.js kitSampleLoad)
  // the item and its copies (the same shirt or pair again, qtyRow) in one transaction: all of them or none (a kill right after
  // "Confirm 12" saved 3, and the card was gone)
  const copies=[];for(let k=1;k<qtyOf(q);k++){const c=JSON.parse(JSON.stringify(it));c.id=crypto.randomUUID();copies.push(c)}
  const all=[it,...copies],at=nowMs();for(const x of all)x.updated=at;
  await txs('items','readwrite',s=>{for(const x of all)s.put(x)});if(window.scheduleSync)scheduleSync();
  items.push(...all);
  const i=queue.indexOf(q);planDirty();if(i>=0)queue.splice(i,1);if(addCalm)addCalm.ok=1;renderAdd();   // (only a card that really went closes up the list: a failed save's Confirm can be tapped again at once)
  if(typeof kitSaved==='function')kitSaved(it,q,Math.max(0,i),copies);   // Saved, with Undo for all of them (kit.js)
  if(q.tagImg)for(const x of all)keepTagImg(x.id,q.tagImg,it.photo);recordTagResult(q,it);askPersist();   // tag-request.js: the sharp copy (signed with the photo), for every copy too (CR-1-04); what the tagger got wrong
  if(it.texture&&q.raw&&q.raw.tex)closeTagImg(q).then(u=>{for(const x of all)keepCloseImg(x.id,u,it.texture)}).catch(()=>{});   // the sharp close-up for later readings (tag-request.js)
  q.raw=null;q.big=null;q.texCanvas=null;   // the card's canvases (a 2048 px photo, its 800 px copy, the close-up) go now, not when the last reply about the card comes back
  return true;
}
