/* Daily Wardrobe: photo tagging on the Add card. Claude's answer taken onto the card (its material too), tagging again from the close-up,
   one reading of each kind per card, and the card's tagging notes. The rest of photo tagging (Round B CR-2-17, split from this file),
   loaded just before it in index.html: tag-request.js (the request, sharp copies, corrections, costs), migrate.js (the start-up remakes),
   measure.js (white balance, paper, measuring, colour verdicts); just after it: own-lists.js (own colours, patterns and materials) and
   pattern-read.js (pattern readings, camouflage). */

/* ---- tagging again once the close-up is in: both photos and the measurement go to the tagger; fields the owner has set by
   hand stay, the rest take the new answer, and the card says what changed ---- */
const TAG_FIELDS=['type','primaryColor','secondaryColor','tertiaryColor','pattern'];
const fieldLabel={type:'item',primaryColor:'color',secondaryColor:'second color',tertiaryColor:'third color',pattern:'pattern'};
const valName=(k,v)=>!v?'none':k==='type'?(TYPES[v]||v).toLowerCase():k==='pattern'?patName(v):colName(v);
/* what the tagger answered, as the card's values (the same normalising as a first tag) */
function aiFields(ai){return {type:ai.type,primaryColor:COLORS[ai.primaryColor]?ai.primaryColor:'grey',secondaryColor:ai.secondaryColor&&ai.secondaryColor!=='none'?ai.secondaryColor:null,
  tertiaryColor:ai.tertiaryColor&&ai.tertiaryColor!=='none'?ai.tertiaryColor:null,pattern:normPat(ai.type,ai.pattern)}}
function takeExtras(q,ai,seen){q.tagAI=aiSignals(ai,seen);Object.assign(q,{conf:ai.conf||null,altColor:ai.altColor||null,altPattern:ai.altPattern||null,newColor:ai.newColor||null,newPattern:ai.newPattern||null,clothBox:ai.clothBox||q.clothBox||null,
    patternBox:ai.patternBox||q.patternBox||null,weave:ai.weave||q.weave||null});
  q.aiTag={...aiFields(ai)};takeMaterial(q,ai);readSett(q)}
/* Claude's material (2026-11-15, app.js matTag: high or medium, on the type's list): it fills the card's Material only when that is empty, or
   still holds Claude's own earlier suggestion (tagging again from the close-up), never one chosen by hand (q.matSet); the field shows it as
   Claude's suggestion (q.matAI, wardrobe.js matRow) until the owner changes it */
/* (2026-11-16, the owner's approved additions) a material on no list (m.new, medium or high) is offered, never filled: q.matNew, "Add cupro
   as a material" under Material (matOffer); one on the list (or the person's own) at low confidence is Claude's guess: q.matGuess, shown
   under Material with "Use wool" (matGuessUse), never filled in */
function takeMaterial(q,ai){const m=ai&&ai.material,l=matsFor(q.type);delete q.matNew;delete q.matGuess;if(!m||!l)return;
  if(!l.includes(m.key)){if(m.new&&m.conf!=='low'&&ownMatName(m.key))q.matNew={key:m.key,conf:m.conf,why:m.why||''};return}
  if(m.conf!=='high'&&m.conf!=='medium'){q.matGuess={key:m.key,conf:'low',why:m.why||''};return}
  if(q.matSet)return;
  if(q.material&&!(q.matAI&&q.material===q.matAI.key))return;
  q.material=m.key;q.matAI={key:m.key,conf:m.conf,why:m.why||''}}
async function closeTagImg(q){if(q.texDone)return q.raw.tex.toDataURL('image/jpeg',TAG_Q);   // a card brought back after a kill: its close-up is already corrected (add-keep.js addRevive)
  const r=closeRead(q.raw.tex),g=r.ref?r.gains:(q.wbOff?null:q.wb);return applyWb(q.raw.tex,g).toDataURL('image/jpeg',TAG_Q)}
/* one reading of each kind per Add card (CR-2-03, CR-2-10): a newer close-up, Skip or Remove calls the earlier one off (its request is
   aborted: the worker gives a tester's count back), and only the latest may apply its answer or clear q.refining / q.patternReading.
   Kept beside the card, not on it (an AbortController is not saved with the card: add-keep.js addKeep) */
const READS=new WeakMap();
function readBegin(q,kind){const r=READS.get(q)||{};if(kind==='refine')readAbort(q);else if(r[kind])try{r[kind].ac&&r[kind].ac.abort()}catch{}
  const me={ac:typeof AbortController==='function'?new AbortController():null};r[kind]=me;READS.set(q,r);return me}
/* the reading is still the card's own (true), and is now over; false: it was called off or replaced, so its answer is dropped */
function readEnd(q,kind,me){const r=READS.get(q);if(!r||r[kind]!==me)return false;delete r[kind];return true}
/* Skip (add.js skipCard), Remove close-up and a newer close-up: the readings in flight are called off, their flags cleared */
function readAbort(q){const r=READS.get(q);if(!r)return;for(const k of ['refine','pattern'])if(r[k]){try{r[k].ac&&r[k].ac.abort()}catch{}delete r[k];q[k==='refine'?'refining':'patternReading']=0}}
const REFINE_FAIL='Tagging again from the close-up didn’t work; the first tags stay.';
async function refineFromCloseup(i){const q=queue[i];if(!q||!q.raw||!q.raw.tex)return;
  try{measureCard(q)}catch(e){console.warn('close-up not measured',e);errNote(e,'Close-up measuring')}   // (a phone out of picture memory: read anyway, unmeasured)
  if(!q.tagImg||!localStorage.getItem('worker_url')){readAbort(q);renderAdd();addKeep();return}
  const me=readBegin(q,'refine');q.refining=1;renderAdd();addKeep();   // the close-up kept at once, as a reading under way (add-keep.js keeps it as cut off: refineCut)
  /* whatever happens from here, the card is drawn again when the reading ends (2026-11-16, a tester: a step that threw after the flag was
     cleared left Confirm switched off until something else redrew the card, so it took "Bought, on the way" to save) */
  // forType: Claude's colours are fitted to the card's own type, not to the type Claude guessed from the close-up (CR-2-04: a burgundy
  // blazer Claude called a suit came back brown); out: this reading's own reason when it fails (CR-2-07: not another card's)
  let ai=null,hint=null;const out={};try{hint=measHint(q.meas);ai=await ask(q.tagImg,{closeup:await closeTagImg(q),measured:hint,wb:!!(q.wb&&!q.wbOff),forType:q.type,out,...(me.ac?{signal:me.ac.signal}:{})})}catch(e){console.warn('close-up reading failed',e);errNote(e,'Close-up reading')}
  if(!readEnd(q,'refine',me))return;   // a newer close-up, Skip or Remove took over: this answer is not used, and the flag is theirs
  const k=queue.indexOf(q);q.refining=0;
  try{refineApply(q,ai,hint,k,out.err)}catch(e){console.warn('close-up answer not applied',e);errNote(e,'Close-up answer not applied ('+q.type+')');q.refineNote=REFINE_FAIL;if(queue.includes(q)){renderAdd();addKeep()}}}
function refineApply(q,ai,hint,k,err){
  // the card is already filled in: its own wording, not the first tag's "Photo tagging failed: … Fill in the details below." (CR-2-07)
  if(!ai||!ai.type){q.refineNote=err&&err.why?`Tagging again from the close-up didn’t work: ${oneStop(err.why)}. The first tags stay.`:REFINE_FAIL;if(k>=0){renderAdd();addKeep()}return}
  const f=aiFields(ai),changes=[],prev={};delete q.refineType;delete q.refineKept;
  // a close-up shows cloth, not what the item is: a new type is offered, never taken (a shirt became a suit); the colours and pattern
  // are read for the card's own type
  if(f.type&&f.type!==q.type&&!(q.edited&&q.edited.type))q.refineType=f.type;
  f.pattern=normPat(q.type,f.pattern);for(const c of ['primaryColor','secondaryColor','tertiaryColor'])if(f[c])f[c]=normColFor(q.type,f[c],c!=='primaryColor')||(c==='primaryColor'?q[c]:null);
  for(const key of TAG_FIELDS){if(key==='type'||(q.edited&&q.edited[key])||f[key]===q[key])continue;
    if(key==='primaryColor'&&refineContradicts(q,f[key])){q.refineKept={c:f[key]};continue}   // the close-up's own measurement says otherwise: kept, and said
    prev[key]=q[key];changes.push(`${fieldLabel[key]} ${valName(key,q[key])} → ${valName(key,f[key])}`);q[key]=f[key]}
  // the colours beyond the three (accents, 2026-11-16): the close-up's reading replaces Claude's first, never ones set by hand
  if(Array.isArray(ai.accents)&&!(q.edited&&q.edited.accents)){const a=accentsFor(q,ai.accents),was=accentsOf(q),w=l=>l.length?l.map(c=>colName(c).toLowerCase()).join(', '):'none';
    if(a.join()!==was.join()){prev.accents=q.accents;changes.push(`also has ${w(was)} → ${w(a)}`);if(a.length)q.accents=a;else delete q.accents}}
  takeExtras(q,ai,!!hint);measureAndApply(q);q.model=ai.model||q.model;
  q.refineUndo=changes.length?prev:null;   // Undo puts the first tags back
  q.refineNote=changes.length?'Updated from the close-up: '+changes.join(', ')+'.':'The close-up confirmed the tags.';if(k>=0)renderAdd();
  addKeep();   // kept at once (add-keep.js): a kill in the next moment lost the paid reading
  readPatternWithClaude(q)}
/* Claude's new colour against the close-up's measurement: the measured colour is clearly nearer the colour the card has (a white shirt
   whose close-up measured cream was turned navy) */
function refineContradicts(q,to){const m=q.meas;if(!m||!m.lab||m.src!=='closeup'||!COLORS[to]||!COLORS[q.primaryColor])return false;const kL=measKL(m);
  const dOld=dE00(m.lab,colRef(q.primaryColor,q.type,q.id),kL),dNew=dE00(m.lab,colRef(to,q.type,q.id),kL);return dOld<=FAR_DE&&dNew-dOld>=2*MEAS_GAP}
function undoRefine(i){const q=queue[i];if(!q||!q.refineUndo)return;for(const [k,v] of Object.entries(q.refineUndo)){q[k]=v;q.edited={...q.edited,[k]:true}}
  q.refineUndo=null;q.refineNote='The first tags are back.';if(q.texCanvas)generateSwatch(q);if(q.meas)measureAndApply(q);renderAdd()}

/* ---- the card's tagging notes: how sure Claude was, its runner-up (one tap to take it), the measured colour, and an offer to
   add a colour or pattern when none of the listed ones fits ---- */
const confTxt=c=>c?['type','primaryColor','pattern'].filter(k=>c[k]==='medium'||c[k]==='low').map(k=>`${fieldLabel[k]}: ${c[k]} confidence`).join(' · '):'';   // (only the two words: W2-13-05)
const tagLive=()=>isConnected();   // (an ended invitation: no button to read again)
function tagNotes(q,i){if(q.manual)return '';const out=[];if(q.meas)q.measV=colourVerdicts(q);   // against the tags as they are now
  if(q.refining)out.push('<p class="tagnote mut"><small>Tagging again with the close-up…</small></p>');
  // a reading cut off when the app was closed (add-keep.js addRevive): said, with a tap to read it again; nothing is read by itself
  else if(q.refineCut)out.push(`<div class="tagfail refcut"><p>The app was closed while the close-up was being read, so the first tags stay.</p>${tagLive()?`<button type="button" class="tagfail-btn" onclick="refineAgain(${i})">Read the close-up again</button>`:''}</div>`);
  else if(q.refineNote)out.push(`<p class="tagnote refnote"><small>${esc(q.refineNote)}</small>${q.refineUndo?`<button type="button" class="chipbtn" onclick="undoRefine(${i})">Undo</button>`:''}</p>`);
  if(q.patternCut&&!q.refineCut&&!q.refining&&!q.patternReading)out.push(`<div class="tagfail patcut"><p>The app was closed while the pattern was being read.</p>${tagLive()?`<button type="button" class="tagfail-btn" onclick="patternAgain(${i})">Read the pattern again</button>`:''}</div>`);
  if(!q.refining&&q.refineType&&q.refineType!==q.type&&TYPES[q.refineType])out.push(`<div class="offer reftype"><small>From the close-up Claude read it as: ${esc(TYPES[q.refineType].toLowerCase())}. A close-up can’t show what the item is, so the type is left as it was.</small><button type="button" class="chipbtn" onclick="setq(${i},'type','${q.refineType}')">Make it ${esc(TYPES[q.refineType].toLowerCase())}</button></div>`);
  if(!q.refining&&q.refineKept&&COLORS[q.refineKept.c]&&q.refineKept.c!==q.primaryColor)out.push(`<div class="offer refkept"><small>From the close-up Claude said ${esc(colName(q.refineKept.c))}, but the close-up measures much nearer ${esc(colName(q.primaryColor))}: kept ${esc(colName(q.primaryColor))}.</small><button type="button" class="chipbtn" onclick="setq(${i},'primaryColor','${q.refineKept.c}')">Use ${esc(colName(q.refineKept.c))}</button></div>`);
  // (the Look beta, look.js: Claude's runner-ups, the measured offers and the new color / pattern offers are on the Look section's rows)
  const L=lookOn(),ct=confTxt(q.conf),alts=L?'':[q.altColor&&q.altColor!==q.primaryColor&&colsFor(q.type).includes(q.altColor)?`<button type="button" class="chipbtn" onclick="setq(${i},'primaryColor','${q.altColor}')">or ${esc(colName(q.altColor))}</button>`:'',
    q.altPattern&&q.altPattern!==q.pattern&&(PATS_BY[q.type]||[]).includes(q.altPattern)?`<button type="button" class="chipbtn" onclick="setq(${i},'pattern','${q.altPattern}')">or ${esc(patName(q.altPattern))}</button>`:''].join('');
  if(ct||alts)out.push(`<p class="tagnote mut"><small>${ct}</small>${alts}</p>`);
  out.push(settNote(q,i));
  const m=q.meas;
  if(m&&m.near&&m.near.length){const n=m.near,pv=(q.measV||[]).filter(v=>v.part);
    out.push(pv.length?`<p class="tagnote measrow">${m.parts.map(p=>`<span class="msw" style="background:${p.hex}" title="${p.hex}"></span>`).join('')}<small>Measured ${m.src==='closeup'?'in the close-up':'in the photo'}${m.ref?' (white reference)':''}: ${pv.map(v=>`${v.part==='ground'?'ground':'stripe'} closest to ${esc(colName(v.to))}`).join(', ')}</small></p>`
      :`<p class="tagnote measrow"><span class="msw" style="background:${m.hex}" title="${m.hex}"></span><small>Measured ${m.src==='closeup'?'in the close-up':'in the photo'}${m.ref?' (white reference)':''}: closest ${n.map(x=>`${esc(colName(x.c))} (ΔE ${x.d})`).join(', ')}</small></p>`)}
  // changed by the measurement (with Undo), or asked about when it is not sure
  if(!L)for(const [f,a] of Object.entries(q.auto||{}))out.push(`<div class="offer measauto" data-f="${f}"><small>Changed ${f==='primaryColor'?'':fieldLabel[f]+' '}${esc(colName(a.from))} → <b>${esc(colName(a.to))}</b> (measured from ${a.src==='closeup'?'your close-up':'your photo'}${a.ai==='low'?'; Claude wasn’t sure':''})</small><button type="button" class="chipbtn" onclick="undoMeasured(${i},'${f}')">Undo</button></div>`);
  if(!L)for(const v of q.measV||[])if(v.mode==='flag'&&!(q.edited&&q.edited[v.f])&&!(q.auto&&q.auto[v.f]))out.push(`<div class="offer measalt" data-f="${v.f}"><small>Measured${v.f==='primaryColor'?'':` ${fieldLabel[v.f]}`}: <b>${esc(colName(v.to))}</b>?</small><button type="button" class="chipbtn" onclick="setq(${i},'${v.f}','${v.to}')">Use ${esc(colName(v.to))}</button></div>`);
  const mp=q.missed&&q.raw&&q.missed.c===q.raw.tex?q.missed.p:null;   // (missedPattern, worked out when the card was measured)
  if(!L&&mp&&(patBase(q.pattern)||'solid')==='solid'&&!(q.edited&&q.edited.pattern))out.push(`<div class="offer measpat"><small>The close-up shows ${/check|pane/.test(mp)?'a check':'stripes'}: <b>${esc(patName(mp))}</b>?</small><button type="button" class="chipbtn" onclick="setq(${i},'pattern','${mp}')">Use ${esc(patName(mp))}</button></div>`);
  if(m&&m.src==='closeup'&&m.sharp!=null&&m.sharp<BLUR_SHARP&&TEXTURE_TYPES.includes(q.type))out.push(`<p class="tagnote blurnote"><small>The close-up is too blurry to read the weave: retake it?</small></p>`);
  if(!L&&(FABRIC.includes(q.type)||COLS_BY[q.type])){const pv=(q.measV||[]).find(v=>v.f==='primaryColor'),far=m&&m.src==='closeup'&&!(m.sharp!=null&&m.sharp<BLUR_SHARP)&&pv&&pv.d>FAR_DE;   // (a blurry or photo-only measurement is no reason to add a colour)
    if(q.newColor||far)out.push(`<div class="offer"><small>${q.newColor?`None of your colors quite fit: Claude calls it <b>${esc(q.newColor.name)}</b>${q.newColor.why?`, ${esc(q.newColor.why)}`:''}.`:'The measured color is far from every color for this item.'}</small><button type="button" class="chipbtn" onclick="openColForm(${i})">Add as a new color</button></div>`)}
  if(!L&&PATS_BY[q.type]){if(q.newPattern)out.push(`<div class="offer"><small>No listed pattern fits: Claude calls it <b>${esc(q.newPattern.name)}</b>${q.newPattern.why?`: ${esc(q.newPattern.why)}`:''}.</small><button type="button" class="chipbtn" onclick="openPatForm(${i})">Add this pattern</button></div>`)}
  return out.join('')}
