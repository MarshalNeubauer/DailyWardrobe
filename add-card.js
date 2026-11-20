/* Daily Wardrobe: Add, one card (split from add.js, Round C 2026-11-17): a field changed (setq), the "As tagged" swatch and the
   photo pair, the shade rows (the Add card's and the item sheet's), and the card's drawing: the checklist's sections, formCard, and the
   cards that are not a form yet (being read, couldn't be read, asking for the type). */
const shirtColFix=o=>{for(const f of ['primaryColor','secondaryColor','tertiaryColor'])if(o[f])o[f]=normColFor(o.type,o[f],f!=='primaryColor')};
const setq=(i,k,v)=>{const q=cardOf(i);if(!q)return;i=queue.indexOf(q);const asked=k==='type'&&needType(q);q[k]=v==='none'?null:v;if(k==='type')matTidy(q);q.edited={...q.edited,[k]:true};const ck=CK_FIELD[k]&&!(q.checked&&q.checked[CK_FIELD[k]]);if(ck)q.checked={...q.checked,[CK_FIELD[k]]:1};queueMicrotask(addKeep);
  if(asked){measureGuess(q);q.pattern=normPat(v,q.pattern);shirtColFix(q);renderAdd();return}   /* the type asked for (needType): the colour measured, the full card */
if(k==='shoeStyle'&&v==='combat'&&!(q.edited&&q.edited.leather)&&(q.manual||!q.leather||q.leather==='calf'))q.leather='suede';   /* a combat boot added by hand is suede and nylon (the owner, 2026-11-18) */
if(k==='shoeStyle'&&!leathersFor(q).includes(q.leather))q.leather='calf';if(k==='shoeStyle'||k==='trouserKind'||k==='band'){renderAdd();return}if((k==='primaryColor'||k==='type')&&q.texCanvas)generateSwatch(q);if(k==='type'){q.pattern=normPat(v,q.pattern);shirtColFix(q)}if(k==='type'||q.manual||k==='primaryColor'||k==='pattern'){if(k==='type'&&q.meas)q.meas.near=nearestCols(q.type,q.meas.lab,q.meas.ref);if(k==='type'||k==='pattern')readSett(q);renderAdd()}else if(ck)renderAdd();else{const t=$('#tagsw-q'+i);if(t)t.innerHTML=tagSwInner(q)}};   // (a section newly checked: its mark and the count follow)
/* next to an item's photo: the colour and texture as tagged (what the app draws), so the two can be compared */
/* with a fabric close-up: the drawn swatch on the left half, the close-up on the right, to compare colour and weave */
const tagSwInner=i=>`<div class="swsplit">${itemThumb(i,true)}${i.texture&&TEXTURE_TYPES.includes(i.type)?`<img class="swtex" src="${srcOk(i.texture)}" alt="Fabric close-up">`:''}</div><figcaption>${i.texture&&TEXTURE_TYPES.includes(i.type)?'As tagged · Close-up':'As tagged'}<br><b class="cap">${sentence(desc(i))||TYPES[i.type]||''}</b></figcaption>`;
/* Shade: darker or lighter than the tagged colour's swatch, to match the close-up; "Match close-up" sets it from the measurement */
const shadeRow=(o,onStep,onMatch,canMatch)=>`<div class="shaderow"><span class="shlab">Shade</span><div class="shctl"><button type="button" class="shbtn" aria-label="Darker" onclick="${onStep}(-1)"${(o.shade||0)<=-SHADE_MAX?' disabled':''}>−</button><span class="shval">${shadeName(o.shade||0)}</span><button type="button" class="shbtn" aria-label="Lighter" onclick="${onStep}(1)"${(o.shade||0)>=SHADE_MAX?' disabled':''}>+</button></div>${canMatch?`<button type="button" class="chipbtn" onclick="${onMatch}">Match close-up</button>`:''}</div>`;
function stepShadeQ(i,d){const q=cardOf(i);if(!q)return;q.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(q.shade||0)+d));if(!q.shade)delete q.shade;renderAdd()}
function matchShadeQ(i){const q=cardOf(i);if(!q||!q.meas)return;q.shade=shadeFor(q,q.meas.lab);if(!q.shade)delete q.shade;renderAdd();toast(q.shade?`Swatch set ${shadeName(q.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
async function stepShadeE(id,d){const it=items.find(x=>x.id===id);if(!it)return;it.shade=Math.max(-SHADE_MAX,Math.min(SHADE_MAX,(it.shade||0)+d));if(!it.shade)delete it.shade;await put(it);planDirty();renderWardrobe()}
async function matchShadeE(id){const it=items.find(x=>x.id===id);if(!it)return;let lab=it.meas&&it.meas.src==='closeup'?it.meas.lab:null;
  if(!lab&&it.texture)try{const im=await imgOf(it.texture),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);lab=measureCloth(c,null,{}).lab}catch{}
  if(!lab)return;it.shade=shadeFor(it,lab);if(!it.shade)delete it.shade;await put(it);planDirty();renderWardrobe();toast(it.shade?`Swatch set ${shadeName(it.shade).toLowerCase()} to match the close-up.`:'The swatch already matches the close-up.')}
const photoPair=(photo,i,id)=>`<div class="pair"><figure class="phfig"><img class="ph" src="${srcOk(photo)}" alt="Photo"><figcaption>Photo</figcaption></figure>${needType(i)?'':`<figure class="tagsw" id="${esc(id)}" aria-live="polite">${tagSwInner(i)}</figure>`}</div>`;
/* one card drawn on its own (2026-11-16, a tester's first item: her iPhone, out of picture memory, refused a canvas while the card's swatch
   was drawn, so the whole redraw stopped and Confirm stayed switched off): a card that can't be drawn becomes a plain one that still
   saves, says what happened, and is reported (safety.js errNote) */
function cardSafe(q,i,draw){try{return draw()}catch(e){console.warn('Add card not drawn',e);if(typeof errNote==='function')errNote(e,'Add card drawn ('+(q.type||'?')+')');return plainCard(q,i)}}
function plainCard(q,i){return `<div class="card qcard" data-q="${esc(q.id)}"><button type="button" class="qx" aria-label="Close" title="Close" onclick="skipCard('${esc(q.id)}')">×</button>
  ${q.photo?`<img class="ph" src="${srcOk(q.photo)}" alt="Photo" style="max-width:160px;border-radius:12px">`:''}<p class="tagnote"><small>Part of this card couldn’t be drawn: your phone may be short of memory for pictures. It still saves as it is${q.type?` (${esc(TYPES[q.type]||q.type)})`:''}; you can change it afterwards in the Wardrobe.</small></p>
  <div class="btns">${confBtn(q,i)}<button onclick="skipCard('${esc(q.id)}')">${q.manual?'Cancel':'Skip'}</button></div></div>`}
/* an item card's form (a photo's card in the list, or the "Add without a photo" sheet's card: inSheet leaves out the card's own × and its
   Confirm / Cancel, which the sheet has in its header and its pinned bar) */
/* the card is a checklist (2026-11-16, the owner's approved redesign "2B Checklist", checklist.js): "N of M checked" pinned at the top of its
   scroll area the whole way down (a direct child of the card, so not inside a column; from 600px over both columns), the photo, what
   Claude's reading said (tagNotes), then sections filled from Claude's reading: Texture match (fabrics: the close-up and the drawing side by
   side, or, before a close-up, "Add close-up and read color, texture & material" and "Add close-up"), Type, Colors, Pattern (Claude's pick
   and its second choice drawn), Fabric & fit (or Details), More (name, brand, notes, Bought on the way, How many). Each counted section has
   "Looks right" (Texture match "Fine as is"); a field changed by hand checks its section too. Sections Claude was unsure about get "!" and
   open first. Confirm is never blocked by unchecked parts ("2 left to check · you can still confirm"), only while Claude reads (confBtn). */
const CK_FIELD={type:'type',primaryColor:'colors',secondaryColor:'colors',tertiaryColor:'colors',pattern:'pattern',metal:'fabric',cuff:'fabric',vest:'fabric',season:'fabric',
  trouserKind:'fabric',shoeStyle:'fabric',leather:'fabric',dial:'fabric',band:'fabric',bezel:'fabric',watchStyle:'fabric',material:'fabric',accents:'colors'};
/* ---- the material's extras under the Add card's Material (2026-11-16, the owner's approved design): Claude's new material offered
   ("Add cupro as a material": own-lists.js matOffer), the note once added, and Claude's low-confidence guess with "Use wool" (matGuessUse).
   MAT_ASK: the types whose material matters for planning; empty, Fabric & fit is "!" (worth a look; Confirm still works) */
const MAT_ASK=['suit','blazer','pants'];
const matNewOf=q=>q.matNew&&MATERIALS_BY[q.type]&&!q.material&&!matsFor(q.type).includes(q.matNew.key)&&q.matNew.conf!=='low'?q.matNew:null;
const matGuessOf=q=>q.matGuess&&!q.material&&(matsFor(q.type)||[]).includes(q.matGuess.key)?q.matGuess:null;
const matWhy=w=>{const s=String(w||'').replace(/[.\s]+$/,'');return /^[A-Z][a-z]/.test(s)?s[0].toLowerCase()+s.slice(1):s};   // (mid-sentence: "cupro, silky drape")
function matExtras(q,i){if(!MATERIALS_BY[q.type])return '';let h='';const t=matTypeOne(q.type);
  if(q.matAdded&&q.material===q.matAdded)h+=`<p class="tagnote matadded"><small>Now one of your materials: it’s in the list for every ${esc(t)} you add, on all your devices.</small></p>`;
  const nm=matNewOf(q);
  if(nm)h+=`<div class="offer matnew"><small>None of the materials fit: Claude calls it <b>${esc(nm.key)}</b>${matWhy(nm.why)?`, ${esc(matWhy(nm.why))}`:''} (${esc(nm.conf)} confidence).</small><button type="button" class="chipbtn" onclick="matOffer(${qh(q)})">Add ${esc(nm.key)} as a material</button></div>`;
  const g=matGuessOf(q);
  if(g){const w=String(g.why||'').replace(/[.\s]+$/,'');h+=`<p class="tagnote mut matguess"><small>Claude’s guess: <b>${esc(g.key)}</b> · ${w&&w.length<=60?esc(w):'can’t be sure from a photo'}</small><button type="button" class="chipbtn" onclick="matGuessUse(${qh(q)})">Use ${esc(g.key)}</button></p>`}
  return h}
const ckLr=(q,i,k)=>{const on=!!(q.checked&&q.checked[k]);return `<button type="button" class="cklr" aria-pressed="${on}" onclick="ckCheck(${qh(q)},'${k}')">${on?'<span aria-hidden="true">✓ </span>Checked':k==='tex'?'Fine as is':'Looks right'}</button>`};
/* "Looks right": the section checked (or not again); checked, it folds and the next unchecked one opens */
function ckCheck(i,k){const q=cardOf(i);if(!q)return;i=queue.indexOf(q);const on=!(q.checked&&q.checked[k]);q.checked={...q.checked,[k]:on?1:0};
  if(on){const sc='q|'+q.id;CK_OPEN[sc+'|'+k]=false;const nx=addCkSecs(q,i).find(s=>s.n&&!q.checked[s.k]);if(nx)CK_OPEN[sc+'|'+nx.k]=true}
  queueMicrotask(addKeep);renderAdd()}
/* the card's sections: [{k, n (counted), mark, title, sum, body, warn}] */
function addCkSecs(q,i){const man=!!q.manual||!q.ai,c=q.conf||{},chk=q.checked||{},tex=lookCu(q.type),fab=FABRIC.includes(q.type),hasCu=tex&&!!q.texture,L=lookOn();   // (lookCu: TEXTURE_TYPES, and with the Look beta on knits, polos, socks, pocket squares and coats too: look.js)
  const unsure=v=>!man&&!!v&&v!=='high',out=[];
  // Texture match: counted once there is a close-up
  if(tex){const rd=cardReading(q),cloth=paperCloth(q),lab=hasCu?cmpLab('q',q):null,d=hasCu?cmpDiff(q,lab):null,p=hasCu?cmpPaper('q',q):null;
    const blur=q.manual&&q.meas&&q.meas.src==='closeup'&&q.meas.sharp!=null&&q.meas.sharp<BLUR_SHARP?'<p class="tagnote blurnote"><small>The close-up is too blurry to read the weave: retake it?</small></p>':'';
    const pick=(label,cls,mode)=>closeupBtn({label,cls,mode,file:`f=>addTexture(${qh(q)},f)`,remove:mode==='replace'?`dropTexture(${qh(q)})`:'',cloth});
    // while Claude reads the close-up, no Replace, Retake, Remove or Read: one reading per card (CR-2-03: a second close-up paid twice and
    // switched Confirm back on half way)
    const body=hasCu?cmpHtml(q.id,q.texture,cmpDrawn(q),!!(p&&p.ref))+cmpMatchHtml('q',q.id,q,lab)+cmpPaperLine(p,rd?'':pick('Retake close-up','linkbtn wbretake','retake'))+blur+
        (rd?'<p class="tagnote mut ckcuwait"><small>You can replace the close-up once Claude has read it.</small></p>':`<div class="btns ckcu">${pick('Replace close-up','btn','replace')}${cuTouch()?'':`<button type="button" class="ckrm" onclick="dropTexture(${qh(q)})">Remove close-up</button>`}</div>`+
        (L?'':`<div class="ckread">${rdAddBtn(q,'Read color and texture')}${rdCostLine()}</div>`))+`${rdDoneHtml('q',q.id,q)}${ckLr(q,i,'tex')}`   // (the Look beta reads in the Look section)
      :`<p class="shelp">Texture match puts a close-up of the cloth beside the drawing and sets the true color from white paper.${q.photo?'':' The close-up is saved with the item.'}</p>${paperSteps(cloth)}`+
        (L?`<div class="ckadds">${pick('Add close-up','btn ckadd','add')}</div>`:`<div class="ckadds"><button type="button" class="btn pri rdgo ckreadadd" onclick="rdStart('q','${jsq(q.id)}')"${rdOff()?' aria-disabled="true"':''}><span>Add close-up and read color, texture &amp; material</span><small class="rdcost">${esc(rdCost())}</small></button>${pick('Add close-up','btn ckadd','add')}</div>`+
        '<p class="shelp ckcheap">Reading counts as 2 lookups for testers. Nothing changes until you choose.</p>');
    out.push({k:'tex',cls:'cktex'+(hasCu?' cktexon':''),n:hasCu,warn:hasCu&&!chk.tex&&!!d,mark:rd?'ai':!hasCu?'opt':chk.tex?'good':d?'warn':'todo',title:'Texture match',
      sum:rd?'Reading the close-up…':!hasCu?'Not yet · add a close-up to compare':cmpDiffText(d)||'Close-up added',body,open:true})}
  // Type
  const tw=unsure(c.type);
  out.push({k:'type',n:true,warn:tw,mark:chk.type?'good':tw?'warn':'todo',title:'Type',sum:esc(TYPES[q.type]||'Item')+(ckSure(c.type)&&!man?' · '+ckSure(c.type):''),
    body:`<label>Type ${S(Object.entries(TYPES),q.type,'type',qh(q))}</label>`+ckLr(q,i,'type')});
  // the Look beta (look.js): one Look section (Color, Pattern, Material rows; Claude's suggestions on them; Read with Claude) in place of
  // Colors, Pattern and Fabric & fit's material, leather, metal and dial
  if(L){const s=lookSection('q',q,i);out.push({k:'lk',n:true,warn:s.warn,mark:s.mark,title:s.title,sum:s.sum,body:s.body,cls:'cklook'})}
  // Colors
  const rows=L?'':colRows('q',q.id,q),shade=!L&&COLORS[q.primaryColor]&&colShows(q,'primaryColor')?shadeRow(q,`stepShadeQ.bind(null,${qh(q)})`,`matchShadeQ(${qh(q)})`,!tex&&!!(q.meas&&q.meas.src==='closeup')):'';
  if(rows||shade){const cw=unsure(c.primaryColor)||(!man&&(!!q.newColor||Object.keys(q.auto||{}).length>0||(q.measV||[]).some(v=>v.mode==='flag'&&!(q.edited&&q.edited[v.f]))));
    out.push({k:'colors',n:!!rows,warn:cw,mark:chk.colors?'good':cw?'warn':'todo',title:'Colors',sum:ckColSum(q,q.primaryColor)+(ckSure(c.primaryColor)&&!man?' · '+ckSure(c.primaryColor):''),body:rows+accRow('q',q.id,q)+shade+(rows?ckLr(q,i,'colors'):'')})}
  // Pattern: Claude's pick and its second choice drawn in the item's colors, then every pattern (the picker)
  if(!L&&hasPat(q.type)){const p=normPat(q.type,q.pattern),ai=q.aiTag&&q.aiTag.pattern,alt=q.altPattern&&(PATS_BY[q.type]||[]).includes(q.altPattern)?q.altPattern:null,pw=unsure(c.pattern)||(!man&&!!q.newPattern);
    const tiles=[];if(!man){const first=ai&&(PATS_BY[q.type]||[]).includes(ai)?ai:p;tiles.push([first,'Claude’s pick']);if(alt&&alt!==first)tiles.push([alt,'Claude’s 2nd']);if(!tiles.some(t=>t[0]===p))tiles.push([p,'Your choice'])}
    const tile=([v,lab])=>`<button type="button" class="ckpt" role="radio" aria-checked="${v===p}" onclick="setq(${qh(q)},'pattern','${v}')"><span class="ckptsw">${swatchSVG(patVar(q,v),true)}</span><b>${esc(cap1(patName(v)))}</b><small>${lab}</small></button>`;
    out.push({k:'pattern',n:true,warn:pw,mark:chk.pattern?'good':pw?'warn':'todo',title:'Pattern',sum:esc(cap1(patName(p)))+(pw&&!chk.pattern?'?':'')+(ckSure(c.pattern)&&!man?' · '+ckSure(c.pattern):''),
      body:(tiles.length?`<div class="ckpts" role="radiogroup" aria-label="Claude’s patterns">${tiles.map(tile).join('')}</div>`:'')+`<label class="colrow">${tiles.length?'All patterns':'Pattern'} ${patBtn('q',q.id,q)}</label>`+ckLr(q,i,'pattern')})}
  // Fabric & fit (Details for the rest): the per-type fields, the material (with Claude's suggestion) and the swatch's patch of cloth
  // (the Look beta: metal, buckle, leather, dial and material are in Look)
  const f=(!L&&METAL_TYPES.includes(q.type)?`<label>${q.type==='belt'?'Buckle':'Metal'} ${S(metalOptsFor(q.type),q.metal,'metal',qh(q))}</label>`:'')+
    (q.type==='shirt'?`<label>Cuffs ${S(CUFFS,q.cuff||'button','cuff',qh(q))}</label>`:'')+(q.type==='suit'?`<label>Vest ${S(VESTS,(q.vest||(typeof newSuitVest==='function'?newSuitVest():'no'))==='yes'?'yes':'no','vest',qh(q))}</label>`:'')+(SEASON_TYPES.includes(q.type)?`<label>Season ${S(SEASONS,q.season||'all','season',qh(q))}</label>`:'')+
    (q.type==='pants'?`<label>Kind ${S(TROUSER_KINDS,q.trouserKind||'dress','trouserKind',qh(q))}</label>`:'')+(q.type==='shoes'?`<label>Style ${S(SHOE_STYLES,q.shoeStyle||'oxford','shoeStyle',qh(q))}</label>`:'')+(!L&&(q.type==='shoes'||q.type==='belt')?`<label>${leatherLabel(q)} ${S(leathersFor(q).map(c=>[c,cap1(leatherWord(q,c))]),q.leather||'calf','leather',qh(q))}</label>`:'')+
    // the uniform blouse's tapes and rank (2026-11-18; core.js blouseTapes)
    (q.type==='blouse'?['tapeName','tapeService'].map(k=>`<label>${k==='tapeName'?'Name tape':'Service tape'} <input type="text" maxlength="${BLOUSE_TAPE_MAX}" autocapitalize="characters" spellcheck="false" value="${esc(tapeText(q[k]))}" placeholder="${k==='tapeName'?'e.g. SMITH':'e.g. U.S. AIR FORCE'}" data-act-change="tapeQ" data-q="${esc(q.id)}" data-k="${k}"></label>`).join('')+`<label>Rank ${S(OCP_RANKS,q.rank||'none','rank',qh(q))}</label>`:'')+(q.type==='shoes'?`<label>Style ${S(SHOE_STYLES,q.shoeStyle||'oxford','shoeStyle',qh(q))}</label>`:'')+(q.type==='shoes'||q.type==='belt'?`<label>${leatherLabel(q)} ${S(leathersFor(q).map(c=>[c,cap1(leatherWord(q,c))]),q.leather||'calf','leather',qh(q))}</label>`:'')+
    (q.type==='watch'?`${L?'':`<label>Dial ${S(DIAL_OPTS(watchOpts(q).dial),watchOpts(q).dial,'dial',qh(q))}</label>`}<label>Band ${S(BANDS,watchOpts(q).band,'band',qh(q))}</label><label>Bezel ${S(BEZELS,watchOpts(q).bezel,'bezel',qh(q))}</label><label>Style ${S(WATCH_STYLES,watchOpts(q).style,'watchStyle',qh(q))}</label>`:'')+
    (L?'':matRow(q.type,q.material,`setQField(${qh(q)},'material',`,q.matAI)+matExtras(q,i));
  const swb=fab&&q.big?`<div class="sw-box"><div id="swatch-img-${i}" class="sw" style="background-image:url(${q.swatch})"></div><div style="flex:1;font-size:13px"><b>Fabric swatch</b><small class="mut" style="display:block">${q.texCanvas?'From the fabric close-up':'From the photo'}: zoom and move it to a clean patch of cloth</small>
    <label>Zoom <input type="range" min="1" max="4" step="0.1" value="${q.zoom||1}" oninput="updateSwatchParam(${qh(q)}, 'zoom', this.value)"></label><label>Left–right <input type="range" min="0" max="1" step="0.05" value="${q.cx||0.5}" oninput="updateSwatchParam(${qh(q)}, 'cx', this.value)"></label><label>Up–down <input type="range" min="0" max="1" step="0.05" value="${q.cy||0.5}" oninput="updateSwatchParam(${qh(q)}, 'cy', this.value)"></label></div></div>`:'';
  if(f||swb){const sug=!L&&!!(q.matAI&&q.matAI.key&&q.material===q.matAI.key),bits=[!L&&q.material?cap1(matLabel(q.material)):'',SEASON_TYPES.includes(q.type)&&q.season&&q.season!=='all'?optLab(SEASONS,q.season):'',q.type==='suit'?((q.vest||(typeof newSuitVest==='function'?newSuitVest():'no'))==='yes'?'matching vest':'no vest'):''].filter(Boolean);
    // (2026-11-16) suits, blazers and pants ask for their material: empty, the section is "!" (worth a look; never blocks Confirm), with Claude's guess in the summary
    const ask=!L&&MAT_ASK.includes(q.type)&&!q.material&&!chk.fabric,g=matGuessOf(q),nm=matNewOf(q);
    const sum=ask?`Material not set${g?` · Claude’s guess: ${g.key}`:nm?` · Claude calls it ${nm.key}`:''}`:sug&&!chk.fabric?`${bits.join(' · ')} · suggested by Claude`:bits.join(' · ')||'Optional';
    out.push({k:'fabric',n:!!f,warn:false,mark:chk.fabric?'good':ask?'warn':sug?'ai':'todo',title:fab?(L?'Fit &amp; details':'Fabric &amp; fit'):'Details',sum:esc(sum),body:f+swb+(f?ckLr(q,i,'fabric'):'')})}
  // More: name, brand, notes, bought and on the way, how many (not counted)
  const on=k=>`oninput="setQField(${qh(q)},'${k}',this.value)"`,named=['name','brand','notes'].filter(k=>q[k]&&String(q[k]).trim()),n=qtyOf(q);
  out.push({k:'more',n:false,warn:false,mark:'opt',title:'More',sum:esc((named.length?cap1(named.join(', '))+' filled in':'Name, brand, notes')+(q.order?' · on the way':' · on the way?')+(n>1?` · ${n} of them`:'')),
    body:`<div class="morein">${fldRow('name','Name',q.name,on,'Optional')}${fldRow('brand','Brand',q.brand,on,'Optional')}${notesRow(q.notes,on)}</div>${orderRow(q,i)}${typeof cpwQRow==='function'?cpwQRow(q):''}${qtyRow(q,i)}`});
  // open first: Texture match, and whatever Claude was unsure about; with nothing unsure, the first part not checked yet
  const anyWarn=out.some(s=>s.warn&&!chk[s.k]);for(const s of out)if(s.k!=='tex')s.open=s.warn&&!chk[s.k];
  if(!anyWarn){const first=out.find(s=>s.n&&s.k!=='tex'&&!chk[s.k]);if(first)first.open=true}
  const lk=out.find(s=>s.k==='lk');if(lk&&!chk.lk)lk.open=true;   // (the Look beta: Look opens unfolded until checked)
  return out}
const addCkCount=(q,secs)=>{const c=secs.filter(s=>s.n),n=c.filter(s=>q.checked&&q.checked[s.k]).length;return {n,M:c.length}};
const ckLeftLine=(q,secs)=>{const {n,M}=addCkCount(q,secs||addCkSecs(q,queue.indexOf(q))),left=M-n;return `<p class="ckleft" role="status">${left?`${left} left to check · you can still confirm`:`All ${M} checked · ready to confirm`}</p>`};
/* (a section's first open-or-folded is kept for the card: a section doesn't fold under the finger when a change moves the default) */
function formCard(q,i,inSheet){const secs=addCkSecs(q,i),{n,M}=addCkCount(q,secs),sc='q|'+q.id,sec=k=>{const s=secs.find(x=>x.k===k);if(!s)return '';if(CK_OPEN[sc+'|'+k]===undefined)CK_OPEN[sc+'|'+k]=ckIsOpen(sc,k,s.open);return ckSec(sc,k,s)};
  return `<div class="card qcard ckcard" data-q="${esc(q.id)}">${inSheet?'':`<button type="button" class="qx" aria-label="Close" title="Close" onclick="skipCard('${esc(q.id)}')">×</button><div class="ckhd"><small>New item · check and confirm</small><b>${esc(savedTitle(q))}</b></div>`}`+
    `<div class="ckprog"><b>${n} of ${M} checked</b><span class="cktrack" aria-hidden="true"><i style="width:${M?Math.round(n/M*100):0}%"></i></span></div>`+
    `<div class="ckcols"><div class="ckcol">${q.multi?`<p class="multi-h"><b>Item ${q.multi.n} of ${q.multi.of}</b> <span class="conf ${q.multi.confidence}">${q.multi.confidence} confidence</span></p>`:''}${tagFailNote(q,qh(q))}${unreadNote(q,qh(q))}`+
    `<div class="ckintro"><div class="rv">${q.photo?photoPair(q.photo,q,'tagsw-q'+i):itemThumb(q)}</div>${wbNote(q,i)}<p class="shelp ckhelp">${q.manual||!q.ai?'Pick the type and the colors, then confirm.':'Claude filled these in. Check each part, or fix it.'}</p></div>${tagNotes(q,qh(q))}${sec('tex')}</div>`+
    `<div class="ckcol">${sec('type')}${sec('lk')}${sec('colors')}${sec('pattern')}${sec('fabric')}${sec('more')}</div></div>`+
    `${inSheet?'':`<div class="ckfoot">${ckLeftLine(q,secs)}<div class="btns">${confBtn(q,i)}<button onclick="skipCard('${esc(q.id)}')">${q.manual?'Cancel':'Skip'}</button></div></div>`}${q.manual?'':`<small class="ckai">${aiLabel(q)}</small>`}</div>`}
const confBtn=(q,i)=>`<button class="pri" id="qconf-${i}" onclick="save('${esc(q.id)}')"${cardReading(q)?' disabled title="Claude is still reading this item"':q.saving||saveAllOn?' disabled':''}>${qtyLabel(q)}</button>`;
/* the cards that are not (yet) a form: being read, a "Several items" photo that couldn't be read, a file that couldn't be opened,
   and a photo nobody read, which asks for its type first */
const busyCard=q=>`<div class="card" data-q="${esc(q.id)}"><span class="spin" aria-hidden="true"></span>${q.multiBusy?`Finding every item in the photo… (this can take up to a minute) <button type="button" onclick="skipCard('${esc(q.id)}')">Cancel</button>`:`Reading the photo…${q.abort?` <button type="button" class="stopread" onclick="stopRead('${esc(q.id)}')">Stop</button>`:''}`}</div>`;
const multiErrCard=q=>`<div class="card" data-q="${esc(q.id)}"><div class="tagfail" role="alert"><p><b>${q.multiCut?'This photo wasn’t read.':'The items in this photo weren’t found.'}</b> ${esc(q.multiErr)}</p></div><div class="btns">${typeof inviteOver==='function'&&inviteOver()?'':`<button type="button" class="pri" onclick="multiAgain('${esc(q.id)}')">Try again</button>`}<button type="button" onclick="skipCard('${esc(q.id)}')">Dismiss</button></div></div>`;
const errCard=q=>`<div class="card" data-q="${esc(q.id)}" role="alert"><p>${q.err==='small'?`This picture is too small to read (${(q.errWh||[]).join('×')} pixels). Use a larger photo of the item.`:'That photo couldn’t be opened. Try a JPEG or PNG, or fill the item in by hand.'}</p><div class="btns"><button type="button" onclick="errToHand('${esc(q.id)}')">Fill it in by hand</button><button type="button" onclick="skipCard('${esc(q.id)}')">Dismiss</button></div></div>`;
function typeCard(q,i){const none=typeof isConnected==='function'?!isConnected():!localStorage.getItem('worker_url');   // (an ended invitation reads nothing either)
  return `<div class="card typeask" data-q="${esc(q.id)}">${tagFailNote(q,qh(q))}${unreadNote(q,qh(q))}<div class="rv">${q.photo?photoPair(q.photo,q,'tagsw-q'+i):''}</div>
<p class="typeq">${none&&!q.tagErr?'<b>What is it?</b> Photos aren’t read automatically here: pick the type and the color is measured from the photo.':'<b>What is it?</b> Pick the type, then check the colors.'}</p>
<label>Type <select onchange="setq(${qh(q)},'type',this.value)" aria-label="Type"><option value="" selected disabled>Choose…</option>${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
<div class="btns"><button onclick="skipCard('${esc(q.id)}')">Skip</button></div></div>`}
/* a photo added while the app wasn't connected yet (an invitation still being checked): once it is, the card offers the reading */
const unreadNote=(q,i)=>!q.ai&&!q.manual&&!q.tagErr&&!q.busy&&q.tagImg&&(typeof isConnected==='function'?isConnected():localStorage.getItem('worker_url'))?`<div class="tagfail"><p>This photo was added before the app was connected, so it wasn’t read.</p><button type="button" class="tagfail-btn" onclick="retryTag(${qh(q)})">Read it now</button></div>`:'';
function tapeQ(el){setq(qAt(el.dataset.q),el.dataset.k,tapeText(el.value)||'none')}   // (the Add card's tape fields)
acts({tapeQ});   // (act.js)
