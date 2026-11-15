/* colour picker (loaded after wardrobe.js): the colour fields of the Add card and the item sheet are a button showing the colour as a
   chip and its name (colBtn); a tap opens a sheet (#col-sheet) with the item's close-up or photo beside a large chip of the colour being
   looked at (the two touch, so their edges can be compared), the colours nearest the measured cloth first, then every colour the item
   type allows as a chip with its name, grouped by family and light to dark. A tap on a chip only shows it beside the photo; "Use …"
   saves it (setq on the Add card, sete in the editor). */
let colPick=null;   // {src:'q'|'e', ref: queue index or item id, k: field, cur, sel, view:'tex'|'photo'}
const COL_FAMS=['Whites, greys & blacks','Creams, tans & browns','Greens & olives','Blues','Reds, pinks & purples'];
function colFamily(c){const [,a,b]=labOf(c),C=Math.hypot(a,b);let h=Math.atan2(b,a)*180/Math.PI;if(h<0)h+=360;
  return C<9?0:h>=45&&h<100?1:h>=100&&h<200?2:h>=200&&h<290?3:4}
const colLabel=k=>k==='primaryColor'?'Colour':k==='secondaryColor'?'Second colour':'Third colour';
const colBtn=(src,ref,k,v)=>{const c=v&&COLORS[v]?v:null,r=src==='q'?ref:`'${ref}'`;
  return `<button type="button" class="colbtn" data-k="${k}" onclick="openColPick('${src}',${r},'${k}')" aria-haspopup="dialog"><span class="colchip${c?'':' none'}"${c?` style="background:${COLORS[c]}"`:''}></span><span class="colnm">${c?esc(cap1(colName(c))):'None'}</span><svg class="colchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`};
/* the editor's colour row, labelled as E() labels it */
const EC=(id,k,v,lab)=>`<label class="colrow">${lab||colLabel(k)} ${colBtn('e',id,k,v)}</label>`;
/* which colour fields an item shows (2026-11-15, the new-user audit: cufflinks asked for three colours, a bracelet watch's Colour did
   nothing, coats saved "Tan & brown"): only what something draws or names. The main colour always, but not on a watch on a metal bracelet
   (on a leather strap it is the strap's: "Strap colour"); a second colour for patterned cloth (its stripe), socks (the toe cap) and
   sneakers (the sole); a third only for patterned cloth. A field that already holds a colour stays, so it can be cleared. */
const colHas=v=>!!v&&v!=='none';
const colShows=(it,k)=>{const t=it&&it.type;if(!t)return true;
  if(k==='primaryColor')return t!=='watch'||watchOpts(it).band==='leather';
  if(colHas(it[k]))return true;
  if(k==='secondaryColor')return FABRIC.includes(t)||t==='socks'||(t==='shoes'&&shoeStyle(it)==='sneaker');
  return FABRIC.includes(t)};
const colFieldLabel=(it,k)=>k==='primaryColor'?(it&&it.type==='watch'?'Strap colour':'Colour'):k==='secondaryColor'?(it&&it.type==='socks'?'Toe cap':it&&it.type==='shoes'&&shoeStyle(it)==='sneaker'?'Sole':'Second colour'):'Third colour';
/* a second or third colour the item can't show is dropped where the item is made (saveCard) or its type changed (sete): an Add card
   shows only the fields its type uses, a saved item keeps one already set until it is cleared or its type changes */
function colTidy(it){for(const k of ['secondaryColor','tertiaryColor'])if(colHas(it[k])&&!colShows({...it,[k]:null},k))delete it[k];return it}
/* the colour rows of the Add card (src 'q', ref its index) and the item sheet (src 'e', ref the item's id) */
const colRows=(src,ref,it)=>['primaryColor','secondaryColor','tertiaryColor'].filter(k=>src==='q'?colShows({...it,[k]:k==='primaryColor'?it[k]:null},k):colShows(it,k)).map(k=>`<label class="colrow">${colFieldLabel(it,k)} ${colBtn(src,ref,k,k==='primaryColor'?(src==='e'?primaryCol(it):it.primaryColor):it[k]||'none')}</label>`).join('');
const colTarget=()=>!colPick?null:colPick.src==='s'?colPick.fake:colPick.src==='q'?queue[colPick.ref]:items.find(x=>x.id===colPick.ref);
function colChoices(it,k){const cur=k==='primaryColor'?primaryCol(it):it[k];
  return COLOR_OPTS(it.type,cur,k!=='primaryColor').map(x=>x[0]).filter(c=>COLORS[c])}
/* the three colours nearest the measured cloth (main colour only) */
/* (2026-11-14) a patterned cloth's colours one by one: its ground for the main colour, its stripe for the second (measureParts); with no
   such reading a patterned cloth offers none (the whole picture's median of a white/blue stripe is grey: "Use grey" made it worse) */
function colNear(it,k){const m=it.meas;if(!m||!m.lab||!['primaryColor','secondaryColor'].includes(k)||typeof nearestCols!=='function')return [];
  const parts=m.parts&&m.parts.length>1?m.parts:null;if(!parts&&(k!=='primaryColor'||multiCol(it)))return [];
  const lab=parts?parts[k==='primaryColor'?0:1].lab:m.lab;
  try{return nearestCols(it.type,lab,m.ref,{kL:measKL(m),skip:it.id,accent:k!=='primaryColor'}).filter(x=>COLORS[x.c])}catch(e){return []}}
function openColPick(src,ref,k){colPick={src,ref,k};const it=colTarget();if(!it){colPick=null;return}
  colPick.cur=k==='pattern'?normPat(it.type,it.pattern):(k==='primaryColor'?primaryCol(it):it[k])||'none';colPick.sel=colPick.cur;
  colPick.view=it.texture&&(k==='primaryColor'||k==='pattern'||!it.photo)?'tex':'photo';
  renderColPick();$('#col-sheet').classList.add('on');$('#col-backdrop').classList.add('on');$('#col-sheet').scrollTop=0;
  const x=$('#col-sheet .pick-x');if(x)x.focus({preventScroll:true})}
/* suits and blazers are shown as their traced figure (SUIT_D, BLAZER_D) in the colour or pattern being looked at, redrawn on every
   tap: in place of the flat swatch without a photo, and as a third view ("Drawing", view 'draw') beside the close-up and the photo */
// every item is shown as its drawing when it has no photo (the owner, 2026-11-13: the traced trousers, shoes, belt… as well as
// suits and blazers; a flat square of cloth was shown for fabric items); with a photo or close-up the photo leads, the drawing a tab
const cpFig=it=>!!it;
function cpViews(it,photo){const v=[];if(it.texture)v.push(['tex','Close-up']);if(photo)v.push(['photo','Whole photo']);if(cpFig(it)&&v.length)v.push(['draw','Drawing']);return v}
const cpSeg=(vs,view)=>vs.length>1?`<div class="cpseg" role="group" aria-label="Compare with">${vs.map(([v,l])=>`<button type="button" class="${view===v?'on':''}" onclick="colPickView('${v}')" aria-pressed="${view===v}">${l}</button>`).join('')}</div>`:'';
function closeColPick(){colPick=null;const s=$('#col-sheet'),b=$('#col-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on')}
function colPickSel(c){if(!colPick)return;colPick.sel=c;renderColPick(true)}
function colPickView(v){if(!colPick)return;colPick.view=v;renderColPick(true)}
async function useColPick(){if(!colPick)return;const {src,ref,k,sel,cur}=colPick,it=colTarget();let v=sel;
  if(sel===NEW_COL){try{v=k==='pattern'?await patAddNew(it,patNewFor(it)):await colAddNew(it,k,colNewFor(it,k))}catch(e){toast(e.message||'That could not be added.');return}}
  closeColPick();if(v===cur)return;
  if(src==='q')setq(ref,k,v);else await sete(ref,k,v)}
function renderColPick(keep){if(colPick&&colPick.newc)return colPick.newc.kind==='pattern'?renderPatNew(keep):renderColNew(keep);
  if(colPick&&colPick.k==='pattern')return renderPatPick(keep);const el=$('#col-sheet'),it=colTarget();if(!el||!it)return;const {k,sel,cur,view}=colPick,y=el.scrollTop;
  const photo=it.photo||(typeof wardPic==='function'?wardPic(it):null),pic=view==='draw'?null:view==='tex'?it.texture:photo,vs=cpViews(it,photo);
  const nc=colNewFor(it,k),name=c=>c==='none'?'None':c===NEW_COL?cap1(nc?nc.name:''):cap1(colName(c)),hex=c=>c===NEW_COL?(nc?nc.hex:'transparent'):COLORS[c]||'transparent';  const near=colNear(it,k),dWord=d=>d<=4?'Very close':d<=8?'Close':'Nearest';
  const tile=(c,extra='')=>`<button type="button" class="cptile${c===sel?' sel':''}" data-c="${c}" onclick="colPickSel('${c}')" aria-pressed="${c===sel}"><span class="cpsw${c==='none'?' none':''}"${c==='none'?'':` style="background:${hex(c)}"`}>${c===cur?'<i class="cpnow">Now</i>':''}</span><span class="cpnm">${esc(name(c))}</span>${extra}</button>`;
  const fams=COL_FAMS.map(()=>[]);for(const c of colChoices(it,k))fams[colFamily(c)].push(c);
  const groups=fams.map((l,f)=>l.length?`<h4 class="cph">${COL_FAMS[f]}</h4><div class="cpgrid">${l.sort((a,b)=>labOf(b)[0]-labOf(a)[0]).map(c=>tile(c)).join('')}</div>`:'').join('');
  const what=view==='tex'?'Your close-up':'Your photo';
  // without a photo the drawing stands in, drawn in the colour being looked at (Claude's new colour isn't one yet: drawn as it is)
  const drawn=sel===NEW_COL||sel===cur?it:{...it,[k]:sel==='none'?null:sel,...(k==='primaryColor'?{color:undefined}:{})};
  el.innerHTML=`<div class="cptop"><div class="pick-head"><b id="col-title">${k==='secondaryColor'&&it.type==='socks'?'Toe cap colour':k==='primaryColor'&&it.type!=='watch'?'Choose the colour':'Choose the '+colFieldLabel(it,k).toLowerCase()+(colFieldLabel(it,k)==='Sole'?' colour':'')}</b><button class="pick-x" onclick="closeColPick()" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${pic?`<img src="${pic}" alt="${what}">`:`<div class="cpdraw">${itemThumb(drawn)}</div>`}<figcaption>${pic?what:'As drawn'}</figcaption></figure><figure class="cpbig${sel==='none'?' none':''}"${sel==='none'?'':` style="background:${hex(sel)}"`}><figcaption>${esc(name(sel))}</figcaption></figure></div>
${cpSeg(vs,view)}</div>
<p class="cphelp">${pic?`Tap a colour to see it right beside your ${view==='tex'?'close-up':'photo'}. Pick the one whose edge you can hardly see.`:cpFig(it)?`Tap a colour to see your ${(TYPES[it.type]||'item').toLowerCase()} drawn in it.`:'Tap a colour to see it right beside your item. Pick the one whose edge you can hardly see.'}</p>
${COLS_BY[it.type]?`<h4 class="cph">Your colours</h4><div class="cpgrid cnown">${colChoices(it,k).filter(c=>CUSTOM_COL[c]).map(c=>tile(c)).join('')}<button type="button" class="cptile cpnewt" id="cn-open" onclick="openColNew()"><span class="cpsw" aria-hidden="true">+</span><span class="cpnm">New colour</span></button></div>`:''}
${colAskHtml(it,k,tile,name)}
${near.length?`<h4 class="cph">Closest to your ${it.meas.src==='closeup'?'close-up':'photo'}</h4><div class="cpgrid cpnear">${near.map(x=>tile(x.c,`<small class="cpd">${dWord(x.d)}</small>`)).join('')}</div>`:''}
${k==='primaryColor'?'':`<div class="cpgrid">${tile('none')}</div>`}${groups}
<div class="cpbar"><button type="button" class="pri" onclick="useColPick()">${esc(sel===NEW_COL?'Add '+name(sel)+' to your colours and use it':sel===cur?'Keep '+name(sel):'Use '+name(sel))}</button></div>`;
  if(keep)el.scrollTop=y}
/* (a colour of your own by hand, "+ A colour of my own" at the end of the list, colOwn*, became the "+ New colour" sheet, 2026-11-15) */
/* ---- Ask Claude: the close-up (white-balanced), the sharp photo and the close-up's measurement go to the tagger again, the same
   request as an Add card's tagging from the close-up (refineFromCloseup) or the accuracy check (benchTagOne). The answer is kept
   in memory per item (colAsk, not saved or synced), so the other colour fields show it without asking again; Claude's pick for
   the field being edited is selected at once, so it lies beside the close-up. ---- */
const colAsk={};
const COL_FIELDS=it=>it.type==='socks'?['primaryColor','secondaryColor']:['primaryColor','secondaryColor','tertiaryColor'];
async function colAskImgs(it,src){
  if(src==='q'&&it.raw&&it.raw.tex){measureCard(it);return {img:it.tagImg||it.photo||it.texture,closeup:await closeTagImg(it),measured:measHint(it.meas)}}
  let measured;try{const c=await imgOf(it.texture),cv=document.createElement('canvas');cv.width=c.naturalWidth;cv.height=c.naturalHeight;cv.getContext('2d').drawImage(c,0,0);
    const r=closeRead(cv),m=Object.assign(measureCloth(cv,null,r.ref?{gains:r.gains,refLum:r.refLum}:{}),{src:'closeup'});m.near=nearestCols(it.type,m.lab,m.ref,{kL:measKL(m),skip:it.id});
    m.parts=measureParts(it,m);if(m.parts)m.groundNear=nearestCols(it.type,m.parts[0].lab,m.ref,{kL:measKL(m),skip:it.id});measured=measHint(m)}catch(e){}
  const sharp=src==='e'&&typeof tagImgOf==='function'?await tagImgOf(it.id,it):null;
  return {img:sharp||it.tagImg||it.photo||it.texture,closeup:typeof sharpCloseOf==='function'?await sharpCloseOf(it):it.texture,measured}}
async function colAskRun(){const it=colTarget();if(!it||!it.texture)return;if(!isConnected()){tell(NEED_CONN);return}
  // one of Claude's own readings per request: asked for both, the answer's schema is more than the API compiles ("compiled grammar
  // is too large", found on the live worker 2026-11-13), so a colour sheet asks for its colours and the pattern sheet for its pattern
  const src=colPick.src,pat=colPick.k==='pattern',key=it.id+(pat?'|p':'|c');colAsk[key]={busy:true};renderColPick(true);let ai=null;
  try{const x=await colAskImgs(it,src);ai=await ask(x.img,{closeup:x.closeup,measured:x.measured,skipId:it.id,freeColors:!pat,freePattern:pat})}catch(e){console.warn('colour ask failed',e)}
  colAsk[key]=ai&&ai.type?{primaryColor:ai.primaryColor,secondaryColor:ai.secondaryColor||'none',tertiaryColor:ai.tertiaryColor||'none',altColor:ai.altColor,conf:ai.conf,newColor:ai.newColor,own:ai.ownColors||null,
      pattern:normPat(it.type,ai.pattern),altPattern:ai.altPattern?normPat(it.type,ai.altPattern):null,newPattern:ai.newPattern,ownPattern:ai.ownPattern||null}
    :{err:aiError||(pat?'Claude couldn’t read the pattern this time.':'Claude couldn’t read the colours this time.')};
  if(!colPick||colTarget()!==it)return;   // closed meanwhile: the answer shows when it is opened again
  const v=colAsk[key][colPick.k];if(colPick.k==='pattern'?v&&patChoices(it).includes(v):v&&(v==='none'||COLORS[v]))colPick.sel=v;renderColPick(true)}
/* a colour Claude named that the app doesn't have (ownColors, asked with freeColors): offered as a "New" chip in the shade Claude
   gave; using it adds it to the owner's colours (addCustomColor, synced) for this kind of item, behaving like the nearest built-in
   colour, an accent colour too when it is a second or third colour. Not offered when the name is already a colour (a built-in's
   name, or the owner's own under the same key) or the shade can't be told from the listed pick (ΔE00 under 2). */
const NEW_COL='+new';
/* is a name already a colour's, built-in or the owner's, as shown or as its key ("Navy", "light blue", "Very dark navy")? Letters only, any
   case: an own colour named "Navy" in pink was accepted beside the built-in navy (2026-11-15, the new-user audit) */
const colLetters=t=>String(t||'').toLowerCase().replace(/[^a-z]/g,'');
/* a grey spelled another way ("Gray", "Dark gray", "Light gray", "Mid gray", "Pale grey": COL_ALIAS's greys) is taken too (2026-11-15, the
   re-audit: "Gray" in pink was accepted beside Grey); other aliases ("Cognac", "Teal") stay free for a shade of one's own */
const colNameTaken=name=>{const n=colLetters(name),g=n.replace(/gray/g,'grey');if(!n)return false;
  if(/grey/.test(g)&&(COLORS[g]||COL_ALIAS[n]||COL_ALIAS[g]))return true;
  return Object.keys(COLORS).some(c=>colLetters(c)===n||colLetters(c)===g||colLetters(colName(c))===n||colLetters(colName(c))===g||colLetters(c.replace(/^own-?/,''))===n)};
function colNewFor(it,k){const a=it&&colAsk[it.id+'|c'],o=a&&a.own&&a.own[k];if(!o||!o.name||ownColKey(o.name).length<5)return null;
  if(COLORS[ownColKey(o.name)]||Object.keys(COLORS).some(c=>colName(c).toLowerCase()===o.name||c===o.name.replace(/\s/g,'')))return null;
  if(a[k]&&COLORS[a[k]]&&dE00(rgbLab(...hexRgb(o.hex)),labOf(a[k]))<2)return null;
  return o}
async function colAddNew(it,k,nc){if(!nc)throw new Error('Ask Claude again: its colour was not kept.');const key=ownColKey(ownNameClean(nc.name));
  if(!COLORS[key]){const n=cap1(ownNameClean(nc.name,24)),added=await addCustomColor({name:n,hex:nc.hex,base:colBaseFor(nc.hex,it.type,k!=='primaryColor'),types:groupOf(it.type),accent:k!=='primaryColor'});toast(`${n} added to your colours.`);return added}
  return key}
/* what "Use all" sets in each colour field: Claude's own colour where the app doesn't have it yet (a New chip; colNewFor), else
   its listed pick; null = none */
const colAllOf=(it,a)=>Object.fromEntries(COL_FIELDS(it).map(f=>{const nc=colNewFor(it,f),o=a.own&&a.own[f],had=o&&o.name&&CUSTOM_COL[ownColKey(o.name)]?ownColKey(o.name):null;   // (added already: the owner's own colour of that name)
  return [f,nc?{nc}:had||(a[f]==='none'||!a[f]?null:a[f])]}));
const colAllDiff=(it,a)=>{const w=colAllOf(it,a);return COL_FIELDS(it).filter(f=>w[f]&&w[f].nc||w[f]!==((f==='primaryColor'?primaryCol(it):it[f])||null))};
/* take every colour Claude named at once, its own new ones too (each added to the owner's colours, as when its chip is picked) */
async function colAskUseAll(){const it=colTarget(),a=it&&colAsk[it.id+'|c'];if(!a||!a.primaryColor)return;const {src,ref}=colPick,w=colAllOf(it,a);
  try{for(const f of COL_FIELDS(it))if(w[f]&&w[f].nc)w[f]=await colAddNew(it,f,w[f].nc)}catch(e){toast(e.message||'That could not be added.');return}
  closeColPick();
  const ch=COL_FIELDS(it).filter(f=>w[f]!==((f==='primaryColor'?primaryCol(it):it[f])||null));if(!ch.length)return;
  if(src==='q'){for(const f of ch)setq(ref,f,w[f]||'none');return}
  for(const f of ch)it[f]=w[f];delete it.color;
  if(ch.includes('primaryColor')&&it.swSrc==='tex')await refreshSwatch(it);await put(it);cache={};renderWardrobe();toast('Saved Claude’s colours.')}
function colAskHtml(it,k,tile,name){const a=colAsk[it.id+'|c'];
  if(!it.texture&&!TEXTURE_TYPES.includes(it.type))return '';   // shoes, belts, watches, socks, coats, clips, links have no close-up: no dead-end hint (2026-11-15)
  if(!it.texture)return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>Add a close-up of the fabric${colPick.src==='e'?' (Edit photos)':''} and Claude can read the colours from it.</small></div></div>`;
  if(!a){const cents=typeof benchEstimate==='function'?Math.max(1,Math.round(benchEstimate(1)*100)):1,on=isConnected();
    return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>${on?`Claude looks at the close-up again and says which colours it is. About ${cents}¢.`:NEED_CONN}</small></div><button type="button" class="cpaskbtn" onclick="colAskRun()"${on?'':' disabled'}>Ask Claude</button></div>`}
  if(a.busy)return `<div class="cpask"><span class="spin" aria-hidden="true"></span><div class="cpasktx"><b>Claude is looking at the close-up…</b><small>This takes a few seconds.</small></div></div>`;
  if(a.err)return `<div class="cpask"><div class="cpasktx"><b>Claude couldn’t answer</b><small>${esc(a.err)}</small></div><button type="button" class="cpaskbtn" onclick="colAskRun()">Try again</button></div>`;
  const cf=a.conf&&a.conf.primaryColor,fs=COL_FIELDS(it);
  // in Claude's own words where it gave them ("mushroom"), else the listed names
  const said=fs.map(f=>a.own&&a.own[f]?a.own[f].name:a[f]&&a[f]!=='none'?colName(a[f]):null).filter(Boolean).map(s=>`<b>${esc(cap1(s))}</b>`);
  const nc=colNewFor(it,k),pick=[a[k]].concat(k==='primaryColor'&&a.altColor&&a.altColor!==a[k]?[a.altColor]:[]).filter(c=>c==='none'||COLORS[c]);
  const tiles=(nc?[tile(NEW_COL,`<small class="cpd cpaid">New · Claude’s exact</small>`)]:[]).concat(pick.map((c,j)=>tile(c,`<small class="cpd cpaid">${j?'Claude’s 2nd':nc?'Closest you have':'Claude’s pick'}</small>`)));
  // more than one colour named: one tap takes them all (offered while any field would change, the one open included)
  const all=said.length>1&&colAllDiff(it,a).length>0;
  return `<div class="cpask done"><div class="cpasktx"><b>Claude reads it as ${said.length>1?said.slice(0,-1).join(', ')+' and '+said[said.length-1]:said[0]}</b>${cf&&k==='primaryColor'?`<small>${cap1(cf)} confidence on the main colour.</small>`:''}${a.newColor?`<small>None of the listed colours quite fit: Claude calls it ${esc(a.newColor.name)}${a.newColor.why?`, ${esc(a.newColor.why)}`:''}.</small>`:''}</div>
${nc?`<small class="cpnewtx">${esc(cap1(nc.name))} isn’t one of your colours yet: pick it and it is added to the app (it then behaves like ${esc(colName(colBaseFor(nc.hex,it.type,k!=='primaryColor')))} in your outfits).</small>`:''}
<div class="cpgrid cpai">${tiles.join('')}</div>
<div class="cpaskbtns">${all?`<button type="button" class="cpaskbtn cpall" onclick="colAskUseAll()">${said.length===2?'Use both colours':`Use all ${said.length} colours`}</button>`:''}<button type="button" class="cpaskbtn ghost" onclick="colAskRun()">Ask again</button></div></div>`}
/* ---- the pattern picker (the same sheet, k 'pattern'): the field is a button with a small drawn swatch (patBtn, EP in the editor);
   the sheet puts the close-up beside a large drawing of the item in the pattern looked at (its colours, the pattern's tile), then
   every pattern the type allows, drawn. Ask Claude (the same request and answer as the colours, with freePattern) shows Claude's
   own name and description of the pattern (ownPattern); when the listed pattern doesn't name it fully (fits false) and nothing of
   that name exists, it is offered as a New chip drawn like Claude's listed pick; "Add … to your patterns and use it" adds it
   (addCustomPattern, synced: drawn and planned like that listed pattern, for this kind of item) and sets it. ---- */
const patChoices=it=>{const l=(PATS_BY[it.type]||['solid']).slice(),c=normPat(it.type,it.pattern);return l.includes(c)?l:[...l,c]};
/* the item as it would be drawn in pattern p: a reading belongs to its own pattern, so another pattern is drawn without it */
const patVar=(it,p)=>p===it.pattern?it:{...it,pattern:p,sett:undefined,stripes:undefined,patternSpec:undefined,weave:undefined,swatch:undefined,swSrc:undefined,texture:undefined};
const patTitle=p=>cap1(patName(p));
const patBtn=(src,ref,it)=>{const p=normPat(it.type,it.pattern),r=src==='q'?ref:`'${ref}'`;
  return `<button type="button" class="colbtn patbtn" data-k="pattern" onclick="openColPick('${src}',${r},'pattern')" aria-haspopup="dialog"><span class="colchip patchip">${swatchSVG(patVar(it,p),true)}</span><span class="colnm">${esc(patTitle(p))}</span><svg class="colchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`};
const EP=(id,it)=>`<label class="colrow">Pattern ${patBtn('e',id,it)}</label>`;
const PAT_GROUPS=[[['solid'],'Plain'],[['pinstripe','chalk-stripe','stripe','fine-stripe'],'Stripes'],[['glen-check','windowpane','check','gingham','tattersall','tonal-check','houndstooth'],'Checks'],
  [['herringbone','birdseye','nailhead','sharkskin','twill','tweed','oxford','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture','knit'],'Weaves'],[['polka-dot','paisley','foulard'],'Figures']];
const patGroupOf=p=>{const b=patBase(p);const g=PAT_GROUPS.findIndex(([l])=>l.includes(b));return g<0?PAT_GROUPS.length:g};
function patNewFor(it){const a=it&&colAsk[it.id+'|p'],o=a&&a.ownPattern;if(!o||o.fits||!o.name)return null;const key=ownPatKey(o.name);if(key.length<6)return null;
  if(CUSTOM_PAT[key]||Object.values(PATS_BY).some(l=>l.includes(key))||Object.values(PATS_BY).some(l=>l.some(p=>patName(p).toLowerCase()===o.name)))return null;
  return o}
const patNewBase=it=>{const a=colAsk[it.id+'|p'];const b=a&&a.pattern?patBase(a.pattern):'solid';return (PATS_BY[it.type]||[]).includes(b)?b:'solid'};
async function patAddNew(it,o){if(!o)throw new Error('Ask Claude again: its pattern was not kept.');const key=ownPatKey(ownNameClean(o.name));
  if(!CUSTOM_PAT[key]){const g=['suit','blazer','pants'].includes(it.type)?['suit','blazer','pants']:[it.type],n=cap1(ownNameClean(o.name,24));
    const added=await addCustomPattern({name:n,desc:o.description||'',base:patNewBase(it),types:g});toast(`${n} added to your patterns.`);return added}
  return key}
/* without a photo the left side is the item drawn in the pattern being looked at (its shape: a tie, a jacket's panel), beside the large swatch */
function renderPatPick(keep){const el=$('#col-sheet'),it=colTarget();if(!el||!it)return;const {sel,cur,view}=colPick,y=el.scrollTop;
  const photo=it.photo||(typeof wardPic==='function'?wardPic(it):null),pic=view==='draw'?null:view==='tex'?it.texture:photo,vs=cpViews(it,photo);
  const np=patNewFor(it),drawAs=p=>p===NEW_COL?patNewBase(it):p,name=p=>p===NEW_COL?cap1(np?np.name:''):patTitle(p);
  const tile=(p,extra='')=>`<button type="button" class="cptile${p===sel?' sel':''}" data-c="${p}" onclick="colPickSel('${p}')" aria-pressed="${p===sel}"><span class="cpsw cppat">${swatchSVG(patVar(it,drawAs(p)),true)}${p===cur?'<i class="cpnow">Now</i>':''}</span><span class="cpnm">${esc(name(p))}</span>${extra}</button>`;
  const gs=[...PAT_GROUPS.map(()=>[]),[]];for(const p of patChoices(it))gs[patGroupOf(p)].push(p);
  const groups=gs.map((l,g)=>l.length?`<h4 class="cph">${g<PAT_GROUPS.length?PAT_GROUPS[g][1]:'Other'}</h4><div class="cpgrid">${l.map(p=>tile(p)).join('')}</div>`:'').join('');
  const what=view==='tex'?'Your close-up':'Your photo';
  el.innerHTML=`<div class="cptop"><div class="pick-head"><b id="col-title">Choose the pattern</b><button class="pick-x" onclick="closeColPick()" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${pic?`<img src="${pic}" alt="${what}">`:`<div class="cpdraw">${itemThumb(patVar(it,drawAs(sel)))}</div>`}<figcaption>${pic?what:'As drawn'}</figcaption></figure><figure class="cpbig cppatbig"><div class="cpdraw">${itemThumb(patVar(it,drawAs(sel)),true)}</div><figcaption>${esc(name(sel))}</figcaption></figure></div>
${cpSeg(vs,view)}</div>
<p class="cphelp">Tap a pattern to see it drawn in your item’s colours beside your ${pic?view==='tex'?'close-up':'photo':'item'}.</p>
<h4 class="cph">Your patterns</h4><div class="cpgrid cnown">${patChoices(it).filter(p=>CUSTOM_PAT[p]).map(p=>tile(p)).join('')}<button type="button" class="cptile cpnewt" id="pn-open" onclick="openPatNew()"><span class="cpsw" aria-hidden="true">+</span><span class="cpnm">New pattern or texture</span></button></div>
${patAskHtml(it,tile,name,np)}${groups}
<div class="cpbar"><button type="button" class="pri" onclick="useColPick()">${sel===NEW_COL?'Add '+esc(name(sel))+' to your patterns and use it':sel===cur?'Keep '+esc(name(sel)):'Use '+esc(name(sel))}</button></div>`;
  if(keep)el.scrollTop=y}
function patAskHtml(it,tile,name,np){const a=colAsk[it.id+'|p'];
  if(!it.texture)return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>Add a close-up of the fabric${colPick.src==='e'?' (Edit photos)':''} and Claude can name the pattern from it.</small></div></div>`;
  if(!a){const cents=typeof benchEstimate==='function'?Math.max(1,Math.round(benchEstimate(1)*100)):1,on=isConnected();
    return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>${on?`Claude looks at the close-up and names the pattern, even one the app doesn’t have yet. About ${cents}¢.`:NEED_CONN}</small></div><button type="button" class="cpaskbtn" onclick="colAskRun()"${on?'':' disabled'}>Ask Claude</button></div>`}
  if(a.busy)return `<div class="cpask"><span class="spin" aria-hidden="true"></span><div class="cpasktx"><b>Claude is looking at the close-up…</b><small>This takes a few seconds.</small></div></div>`;
  if(a.err)return `<div class="cpask"><div class="cpasktx"><b>Claude couldn’t answer</b><small>${esc(a.err)}</small></div><button type="button" class="cpaskbtn" onclick="colAskRun()">Try again</button></div>`;
  const o=a.ownPattern,cf=a.conf&&a.conf.pattern,ch=patChoices(it);
  const pick=[a.pattern].concat(a.altPattern&&a.altPattern!==a.pattern?[a.altPattern]:[]).filter(p=>p&&ch.includes(p));
  const tiles=(np?[tile(NEW_COL,`<small class="cpd cpaid">New · Claude’s name</small>`)]:[]).concat(pick.map((p,j)=>tile(p,`<small class="cpd cpaid">${j?'Claude’s 2nd':np?'Closest you have':'Claude’s pick'}</small>`)));
  return `<div class="cpask done"><div class="cpasktx"><b>Claude sees ${esc(o?o.name:patName(a.pattern))}</b>${o&&o.description?`<small>${esc(o.description)}</small>`:''}${cf?`<small>${cap1(cf)} confidence.</small>`:''}</div>
${np?`<small class="cpnewtx">${esc(cap1(np.name))} isn’t one of your patterns yet: pick it and it is added to the app (drawn and planned like ${esc(patName(patNewBase(it)))}; your close-up shows the real thing).</small>`:''}
<div class="cpgrid cpai">${tiles.join('')}</div>
<div class="cpaskbtns"><button type="button" class="cpaskbtn ghost" onclick="colAskRun()">Ask again</button></div></div>`}
/* ---- "+ New colour" and "+ New pattern or texture" (2026-11-15, the owner's approved design in C:\code\audit-2026-11-13\custom-colour-texture):
   states of this sheet (colPick.newc = {kind 'colour'|'pattern', from 'pick'|'add'|'settings', hex, h/s/v, name, desc, state, res, base,
   types, accent, look, closeOn, err}), drawn into #col-sheet with ‹ back to the list. "Describe it to Claude" posts to the worker's
   /describe (describeAsk; its answer fills the shade, the name, what it behaves like, and for a pattern its drawing recipe, the look);
   "Pick the shade" is a square and a hue bar with a hex field (all three in step); "Add … and use it" adds it to the owner's colours or
   patterns (addCustomColor / addCustomPattern: settings.custom, synced; testers' own too) and sets the field as a pick does. Opened from
   the "Your colours" / "Your patterns" tile of the picker, from the Add card's offer (Claude's newColor / newPattern, a colour measured
   far from every listed one: openColForm / openPatForm, tagging.js) and from Settings (openCustomNew: no item, a "For" choice). ---- */
const CN_SAMPLE={suit:'navy',blazer:'navy',pants:'charcoal',shirt:'white',tie:'navy',socks:'navy',shoes:'brown',belt:'brown',overcoat:'charcoal',raincoat:'khaki',tieclip:'silver',cufflinks:'silver',watch:'brown'};
const CN_DESC_MAX=120,CN_SUITING=['suit','blazer','pants'];
const cnHex=h=>/^#[0-9a-f]{6}$/i.test(String(h||'').trim())?String(h).trim().toLowerCase():null;
const cnHsv=hex=>{const [r,g,b]=hexRgb(hex).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;
  if(d){h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return [h,mx?d/mx*100:0,mx*100]};
const cnFromHsv=(h,s,v)=>{s/=100;v/=100;const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return '#'+[f(5),f(3),f(1)].map(x=>Math.round(Math.max(0,Math.min(1,x))*255).toString(16).padStart(2,'0')).join('')};
const cnDWord=d=>d<=3?'the same to the eye':d<=6?'a slight difference':d<=10?'a clear difference':'quite different';
/* the item drawn in a shade or a pattern not added yet: a stand-in key for the one drawing (COLORS / CUSTOM_PAT), taken out again */
function cnDrawn(it,hex,k,big){const P='cnprev',f=!k||k==='pattern'?'primaryColor':k;COLORS[P]=hex;delete LUMS[P];
  try{return itemThumb({...it,[f]:P,...(f==='primaryColor'?{color:undefined,shade:0,swatch:undefined,swSrc:undefined}:{})},big)}finally{delete COLORS[P];delete LUMS[P]}}
function cnWithPat(it,nc,fn){const P='own-cnprev';CUSTOM_PAT[P]={key:P,name:nc.name||'new pattern',base:cnPatBase(it,nc),look:nc.look||null,types:[]};
  try{return fn(patVar(it,P))}finally{delete CUSTOM_PAT[P]}}
const cnColBase=(it,nc)=>nc.base&&COLORS[nc.base]&&!CUSTOM_COL[nc.base]?nc.base:nc.res&&nc.res.plansAs&&COLORS[nc.res.plansAs]?nc.res.plansAs:colBaseFor(nc.hex,it.type,nc.accent)||'grey';
const cnPatBase=(it,nc)=>{const l=(PATS_BY[it.type]||['solid']).filter(p=>!CUSTOM_PAT[p]),b=nc.base||(nc.res&&nc.res.plansAs)||patBase(normPat(it.type,it.pattern))||'solid';return l.includes(b)?b:'solid'};
/* what a lookup costs: the owner sees cents (describeEstimate), a tester the lookups left today (no costs for testers: showCost) */
function cnLeft(){const m=typeof acct==='object'&&acct&&acct.me;return m&&m.caps&&m.caps.describe!=null?{left:Math.max(0,m.caps.describe-(+(m.used&&m.used.describe)||0)),cap:m.caps.describe}:null}
function cnCost(kind,close){if(!isConnected())return NEED_CONN;
  if(!showCost()){const l=cnLeft();return l?`${l.left} of ${l.cap} lookup${l.cap===1?'':'s'} left today`:'Counts toward today’s lookups'}
  return `About ${Math.max(1,Math.round(describeEstimate(kind,close)*100))}¢${close?' with the close-up':''}`}
function openColNew(o={}){if(!colPick)return;const it=colTarget();if(!it)return;
  const accent=colPick.src==='s'?!!o.accent:colPick.k!=='primaryColor',m=it.meas&&cnHex(it.meas.hex),sel=colPick.sel;
  const hex=cnHex(o.hex)||(sel&&sel!=='none'&&sel!==NEW_COL&&COLORS[sel]?COLORS[sel]:null)||m||'#7a3b47',[h,s,v]=cnHsv(hex);
  colPick.newc={kind:'colour',from:o.from||'pick',hex,h,s,v,name:o.name?cap1(o.name):'',desc:o.desc||'',state:'idle',res:null,base:null,types:groupOf(it.type),accent,err:''};
  renderColPick();const el=$('#col-sheet');if(el)el.scrollTop=0;const b=$('#col-sheet .cnback');if(b)b.focus({preventScroll:true})}
function openPatNew(o={}){if(!colPick)return;const it=colTarget();if(!it)return;
  colPick.newc={kind:'pattern',from:o.from||'pick',name:o.name?cap1(o.name):'',desc:o.desc||'',state:'idle',res:null,base:o.base||null,look:null,types:CN_SUITING.includes(it.type)?CN_SUITING.slice():[it.type],closeOn:false,err:''};
  renderColPick();const el=$('#col-sheet');if(el)el.scrollTop=0;const b=$('#col-sheet .cnback');if(b)b.focus({preventScroll:true})}
/* Settings → Your colours & patterns: the sheet with no item, a "For" choice in its place */
function openCustomNew(kind){const t=kind==='pattern'?'suit':'tie';
  colPick={src:'s',ref:null,k:kind==='pattern'?'pattern':'primaryColor',fake:{id:'_cn',type:t,primaryColor:CN_SAMPLE[t],pattern:'solid'},cur:'none',sel:'none',view:'draw'};
  $('#col-sheet').classList.add('on');$('#col-backdrop').classList.add('on');kind==='pattern'?openPatNew({from:'settings'}):openColNew({from:'settings',hex:'#7a3b47'})}
function cnSetType(t){const nc=colPick&&colPick.newc;if(!nc||colPick.src!=='s')return;const f=colPick.fake;f.type=t;f.primaryColor=CN_SAMPLE[t]||'navy';f.pattern='solid';
  nc.types=nc.kind==='pattern'?(CN_SUITING.includes(t)?CN_SUITING.slice():[t]):groupOf(t);nc.base=null;renderColPick(true)}
function colNewBack(){const nc=colPick&&colPick.newc;if(!nc)return;if(nc.from==='pick'){colPick.newc=null;renderColPick();const el=$('#col-sheet');if(el)el.scrollTop=0}else closeColPick()}
/* the shade picked by hand: the square (saturation across, brightness down), the hue bar and the hex field, kept in step; while a finger
   moves only the thumbs, the swatches and the field change (cnLive), and the sheet is drawn again when it lifts */
function cnLive(){const nc=colPick&&colPick.newc;if(!nc)return;const hx=nc.hex,q=s=>document.querySelector('#col-sheet '+s);
  const sq=q('#cn-sq'),th=q('#cn-sq .cnthumb'),hu=q('#cn-hue i'),hi=q('#cn-hex'),big=q('.cpbig');
  if(sq){sq.style.setProperty('--h',Math.round(nc.h));sq.setAttribute('aria-valuetext',hx.toUpperCase())}if(th){th.style.left=nc.s.toFixed(1)+'%';th.style.top=(100-nc.v).toFixed(1)+'%';th.style.background=hx}
  if(hu){hu.style.left=(nc.h/360*100).toFixed(1)+'%';hu.style.background=`hsl(${Math.round(nc.h)},100%,50%)`;hu.parentNode.setAttribute('aria-valuenow',Math.round(nc.h))}
  if(hi&&document.activeElement!==hi)hi.value=hx.toUpperCase();document.querySelectorAll('#col-sheet [data-cnsw]').forEach(e=>{e.style.background=hx});
  if(big){big.style.background=hx;const c=big.querySelector('figcaption');if(c&&!nc.name.trim())c.textContent=hx.toUpperCase()}}
function cnSetHsv(h,s,v,redraw){const nc=colPick&&colPick.newc;if(!nc)return;nc.h=Math.max(0,Math.min(359.9,h));nc.s=Math.max(0,Math.min(100,s));nc.v=Math.max(0,Math.min(100,v));nc.hex=cnFromHsv(nc.h,nc.s,nc.v);cnLive();if(redraw)renderColPick(true)}
function cnDrag(e,el,at){e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch(x){}const r=el.getBoundingClientRect(),mv=ev=>at((ev.clientX-r.left)/r.width,(ev.clientY-r.top)/r.height,false);mv(e);
  const up=ev=>{el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);at((ev.clientX-r.left)/r.width,(ev.clientY-r.top)/r.height,true)};
  el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)}
function cnSqDown(e){const nc=colPick&&colPick.newc;if(!nc)return;cnDrag(e,e.currentTarget,(x,y,end)=>cnSetHsv(nc.h,Math.max(0,Math.min(1,x))*100,(1-Math.max(0,Math.min(1,y)))*100,end))}
function cnHueDown(e){const nc=colPick&&colPick.newc;if(!nc)return;cnDrag(e,e.currentTarget,(x,y,end)=>cnSetHsv(Math.max(0,Math.min(1,x))*359.9,nc.s,nc.v,end))}
function cnSqKey(e){const nc=colPick&&colPick.newc,d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!nc||!d)return;e.preventDefault();e.stopPropagation();cnSetHsv(nc.h,nc.s+d[0],nc.v+d[1],false)}
function cnHueKey(e){const nc=colPick&&colPick.newc,d={ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1}[e.key];if(!nc||!d)return;e.preventDefault();e.stopPropagation();cnSetHsv(nc.h+d,nc.s,nc.v,false)}
function cnKeyUp(e,id){if(!/^Arrow/.test(e.key))return;renderColPick(true);const el=document.getElementById(id);if(el)el.focus({preventScroll:true})}
function cnHexIn(v,done){const nc=colPick&&colPick.newc,h=cnHex(v.startsWith('#')?v:'#'+v);if(!nc||!h)return;nc.hex=h;[nc.h,nc.s,nc.v]=cnHsv(h);if(done)renderColPick(true);else cnLive()}
function cnName(v){const nc=colPick&&colPick.newc;if(!nc)return;nc.name=v;const b=$('#cn-add');if(b&&!b.dataset.use){const n=cap1(v.trim());b.disabled=!n;b.textContent=n?`Add ${n}${colPick.src==='s'?'':' and use it'}`:nc.kind==='pattern'?'Add pattern':'Add colour'}
  const c=document.querySelector('#col-sheet .cpbig figcaption');if(c)c.textContent=v.trim()?cap1(v.trim()):nc.kind==='pattern'?'Not set yet':nc.hex.toUpperCase()}
function cnToggleType(t){const nc=colPick&&colPick.newc;if(!nc)return;nc.types=nc.types.includes(t)?nc.types.filter(x=>x!==t):[...nc.types,t];renderColPick(true)}
/* ask Claude (POST /describe): the words, the item's kind and colours, the owner's own colours and patterns, the close-up when asked */
async function describeAsk(){const nc=colPick&&colPick.newc,it=colTarget();if(!nc||!it||nc.state==='busy')return;if(!isConnected()){tell(NEED_CONN);return}
  const ta=$('#cn-text');if(ta)nc.desc=ta.value;const text=String(nc.desc||'').replace(/[<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,CN_DESC_MAX);
  if(!text){nc.err='Describe it first, in a few words.';renderColPick(true);return}
  const pat=nc.kind==='pattern',body={what:pat?'pattern':'colour',text,type:it.type,field:!pat&&nc.accent?'accent':'primary',
    colours:{main:primaryCol(it),second:it.secondaryColor||null,third:it.tertiaryColor||null},pattern:normPat(it.type,it.pattern),custom:settings.custom||{}};
  if(pat&&nc.closeOn&&it.texture&&colPick.src!=='s'){try{body.closeup=(typeof sharpCloseOf==='function'?await sharpCloseOf(it):null)||it.texture}catch(e){body.closeup=it.texture}}
  nc.state='busy';nc.err='';renderColPick(true);
  const w=localStorage.getItem('worker_url')||'';let r=null,j={};
  try{r=await fetch(new URL('describe',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':localStorage.getItem('app_token')||''},body:JSON.stringify(body)});j=await r.json().catch(()=>({}))}catch(e){r=null}
  if(!colPick||colPick.newc!==nc)return;   // closed meanwhile
  if(r&&r.ok&&typeof acct==='object'&&acct&&acct.me&&acct.me.used)acct.me.used.describe=(+acct.me.used.describe||0)+1;
  if(r&&r.status===429){nc.state='limit';nc.limit=j.message||'Today’s colour and pattern lookups are used up. They start again at midnight UTC.'}
  else if(!r||!r.ok){nc.state='err';nc.detail=showCost()&&(j.detail||j.message)||''}
  else if(pat?j.kind==='pattern':j.kind==='colour'||j.kind==='several'){nc.res=j;nc.base=null;
    if(pat){nc.name=cap1(j.name||nc.name);nc.look=j.look&&j.look.layout&&j.look.layout!=='none'?j.look:null;nc.state=j.match==='existing'&&patChoices(it).includes(j.existing)&&j.existing!==NEW_COL?'reuse':'result'}
    else{nc.hex=cnHex(j.hex)||nc.hex;[nc.h,nc.s,nc.v]=cnHsv(nc.hex);nc.name=cap1(j.name||nc.name);nc.state=+j.dE<=3&&COLORS[j.existing]?'dup':'result'}}
  else{nc.state='kind';nc.answer=j.kind;nc.ask=j.ask||'';nc.res=null}
  renderColPick(true)}
/* "Describe it to Claude": the box, the cost or what is left, Ask; the limit and connection notes */
function cnAskBox(nc,kind,hint,ph){const on=isConnected(),busy=nc.state==='busy',l=!showCost()?cnLeft():null,spent=l&&l.left<=0;
  const lim=nc.state==='limit'||spent?`<div class="cnlim" role="status"><span aria-hidden="true">⏳</span><span><b>${esc(nc.state==='limit'?nc.limit:`Today’s limit of ${l.cap} colour and pattern lookups is used up.`)}</b>${nc.state==='limit'?'':'It starts again at midnight UTC. '}You can still ${kind==='pattern'?'set it yourself':'pick the shade yourself'} below.</span></div>`:'';
  const close=kind==='pattern'&&colPick.src!=='s'&&colTarget().texture?`<button type="button" class="cnchk" id="pn-close" role="checkbox" aria-checked="${!!nc.closeOn}" onclick="colPick.newc.closeOn=!colPick.newc.closeOn;renderColPick(true)"><i class="${nc.closeOn?'on':''}" aria-hidden="true"></i><span>Also show Claude my close-up</span></button>`:'';
  const row=busy?`<div class="cnaskrow" role="status"><span class="spin" aria-hidden="true"></span><small><b class="cnbusy">${kind==='pattern'?'Claude is working out the weave…':'Claude is finding the shade…'}</b><br>A few seconds.</small></div>`
    :`<div class="cnaskrow"><small id="cn-cost">${esc(cnCost(kind,kind==='pattern'&&!!nc.closeOn&&!!close))}</small><button type="button" class="cpaskbtn${nc.res?' ghost':''}" id="cn-ask" onclick="describeAsk()"${on&&nc.state!=='limit'&&!spent?'':' disabled'}>${nc.res?'Ask again':'Ask Claude'}</button></div>`;
  return `<div class="cpask cnask"><div class="cpasktx"><b>Describe it to Claude</b><small>${hint}</small></div>
<textarea class="cntext" id="cn-text" rows="2" maxlength="${CN_DESC_MAX}" aria-label="Describe it to Claude" placeholder="${ph}"${nc.state==='limit'||spent||busy?' disabled':''} oninput="colPick.newc.desc=this.value" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();describeAsk()}">${esc(nc.desc||'')}</textarea>${close}${row}${lim}</div>`}
/* an answer that isn't what this sheet adds (a pattern described on the colour sheet, a material, unclear words) */
function cnKindCard(nc){const k=nc.answer,other=k==='pattern'&&nc.kind==='colour'?'patterns':k==='colour'&&nc.kind==='pattern'?'colours':'';
  const head=k==='pattern'?'That sounds like a pattern':k==='colour'?'That sounds like a colour':k==='material'?'That sounds like a material':nc.kind==='pattern'?'That isn’t a pattern yet':'That isn’t a colour yet';
  return `<div class="cnres warn" id="cn-kind"><div class="cpasktx"><b>${head}</b><small>${esc(nc.ask||'')}</small></div>${other&&colPick.src!=='s'?`<div class="cnbtns"><button type="button" class="cpaskbtn ghost" onclick="cnSwitch()">Open ${other}</button></div>`:''}</div>`}
function cnSwitch(){const nc=colPick&&colPick.newc;if(!nc)return;const {src,ref}=colPick,desc=nc.desc;closeColPick();
  if(nc.kind==='colour'){openColPick(src,ref,'pattern');openPatNew({from:'add',desc})}else{openColPick(src,ref,'primaryColor');openColNew({from:'add',desc})}}
const cnErrCard=(nc,what)=>`<div class="cnres cnerr" id="cn-err"><div class="cpasktx"><b>Claude couldn’t answer</b><small>The ${what} couldn’t be looked up just now. Try again later, or ${what==='colour'?'pick the shade':'set it'} yourself below.${nc.detail?` (${esc(nc.detail)})`:''}</small></div><div class="cnbtns"><button type="button" class="cpaskbtn" onclick="describeAsk()">Try again</button></div></div>`;
function renderColNew(keep){const el=$('#col-sheet'),it=colTarget(),nc=colPick&&colPick.newc;if(!el||!it||!nc)return;const y=el.scrollTop,src=colPick.src,hex=nc.hex,r=nc.res;
  const ex=r&&r.existing&&COLORS[r.existing]?r.existing:null,exName=ex?cap1(colName(ex)):'',name=cap1(String(nc.name||'').trim());
  const prefer=ex&&(nc.state==='dup'||(nc.state==='result'&&+r.dE<=6&&r.match==='existing'))?'existing':'new',base=cnColBase(it,nc);
  const pic=src!=='s'&&colPick.k==='primaryColor'&&it.texture?it.texture:null;
  const fig=pic?`<img src="${pic}" alt="Your close-up">`:`<div class="cpdraw">${cnDrawn(it,hex,src==='s'?'primaryColor':colPick.k)}</div>`;
  let res='';
  if((nc.state==='result'||nc.state==='dup')&&r){const d=+r.dE||0;
    res=nc.state==='dup'?`<div class="cnres" id="cn-res"><div class="cnreshd"><span class="cnresw" style="background:${COLORS[ex]}"></span><span><span class="cneyebrow">You already have it</span><b>That’s your ${esc(colName(ex))}</b><small>${esc(cap1(r.name||'It'))} is ${d.toFixed(1)} ΔE from ${esc(colName(ex))}: ${cnDWord(d)}.</small></span></div>
${r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:''}<div class="cnbtns"><button type="button" class="cpaskbtn ghost" id="cn-anyway" onclick="colNewAdd()"${name?'':' disabled'}>Add ${esc(name||'it')} anyway</button></div></div>`
    :`<div class="cnres" id="cn-res"><div class="cnreshd"><span class="cnresw" style="background:${r.hex}"></span><span><span class="cneyebrow">Claude’s colour</span><b>${esc(cap1(r.name||'')||r.hex.toUpperCase())}</b><small>${r.hex.toUpperCase()} · ${esc(r.confidence||'medium')} confidence</small></span></div>
<ul class="cnfacts"><li><span>In outfits</span><span class="cnch" style="background:${COLORS[r.plansAs]||'transparent'}"></span><span>behaves like <b>${esc(colName(r.plansAs))}</b></span></li>
${ex?`<li><span>Nearest yours</span><span class="cnch" style="background:${COLORS[ex]}"></span><span>${esc(exName)}</span><span class="cnde">${cnDWord(d)} · ΔE ${d.toFixed(1)}</span></li>`:''}</ul>
${r.fitsType===false?`<p class="cnwhy">Unusual for ${esc((TYPES[it.type]||'this item').toLowerCase())}, but you can still add it.</p>`:''}${r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:''}${r.ask?`<p class="cnwhy">${esc(r.ask)}</p>`:''}
${ex?`<div class="cnbtns">${prefer==='existing'?`<button type="button" class="cpaskbtn ghost" id="cn-anyway" onclick="colNewAdd()"${name?'':' disabled'}>Add ${esc(name||'it')} anyway</button>`:`<button type="button" class="cpaskbtn ghost" id="cn-use" onclick="cnUseExisting()">Use ${esc(exName)} instead</button>`}</div>`:''}</div>`}
  if(nc.state==='err')res=cnErrCard(nc,'colour');if(nc.state==='kind')res=cnKindCard(nc);
  const bases=[...new Set([...(src==='s'||COLS_BY[it.type]?colsFor(it.type,nc.accent):Object.keys(COLORS)).filter(c=>COLORS[c]&&!CUSTOM_COL[c]),base])];
  const fold=r||name||src==='s'?`<div class="cnsec" id="cn-how"><b>How the app uses it</b>
<label class="cnfld">Behaves like (for the outfit rules)<select id="cn-base" onchange="colPick.newc.base=this.value;renderColPick(true)">${bases.map(c=>`<option value="${c}"${c===base?' selected':''}>${esc(cap1(colName(c)))}</option>`).join('')}</select></label>
<span class="cnnote">Outfits treat it like this colour; drawings and pictures use its own shade.</span>
<div class="cnfld cnoffer">Offer it for<div class="cnchips">${groupOf(it.type).map(t=>`<button type="button" class="cnchip${nc.types.includes(t)?' on':''}" aria-pressed="${nc.types.includes(t)}" onclick="cnToggleType('${t}')">${esc(TYPES[t])}</button>`).join('')}</div></div>
<button type="button" class="cnsw" id="cn-accent" role="switch" aria-checked="${!!nc.accent}" onclick="colPick.newc.accent=!colPick.newc.accent;renderColPick(true)"><span>Also for stripes and motifs</span><i class="${nc.accent?'on':''}" aria-hidden="true"></i></button></div>`:'';
  const bar=prefer==='existing'?`<button type="button" class="pri" id="cn-add" data-use="1" onclick="cnUseExisting()">Use ${esc(exName)}</button>`
    :`<button type="button" class="pri" id="cn-add" onclick="colNewAdd()"${name?'':' disabled'}>${name?`Add ${esc(name)}${src==='s'?'':' and use it'}`:'Add colour'}</button>`;
  el.innerHTML=`<div class="cptop"><div class="pick-head"><button type="button" class="cnback" onclick="colNewBack()" aria-label="${nc.from==='pick'?'Back to colours':'Close'}">‹</button><b id="col-title">New colour</b><button class="pick-x" onclick="closeColPick()" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${fig}<figcaption>${pic?'Your close-up':`Your ${esc((TYPES[it.type]||'item').toLowerCase())}, drawn`}</figcaption></figure><figure class="cpbig" style="background:${hex}"><figcaption>${esc(name||hex.toUpperCase())}</figcaption></figure></div></div>
${src==='s'?`<label class="cnfld cnfor">For<select id="cn-for" onchange="cnSetType(this.value)">${Object.keys(COLS_BY).map(t=>`<option value="${t}"${t===it.type?' selected':''}>${esc(TYPES[t])}</option>`).join('')}</select></label>`:''}
${cnAskBox(nc,'colour','Say it as you’d tell a tailor. Claude finds the shade and checks it against your colours.','e.g. faded burgundy like old wine')}
${res}
<div class="cnsec"><b>${r?'Fine-tune the shade':'Or pick the shade'}</b>
<div class="cnsq" id="cn-sq" style="--h:${Math.round(nc.h)}" tabindex="0" role="slider" aria-label="Shade: saturation across, brightness down" aria-valuetext="${hex.toUpperCase()}" onpointerdown="cnSqDown(event)" onkeydown="cnSqKey(event)" onkeyup="cnKeyUp(event,'cn-sq')"><i class="cnthumb" style="left:${nc.s.toFixed(1)}%;top:${(100-nc.v).toFixed(1)}%;background:${hex}"></i></div>
<div class="cnhue" id="cn-hue" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="359" aria-valuenow="${Math.round(nc.h)}" onpointerdown="cnHueDown(event)" onkeydown="cnHueKey(event)" onkeyup="cnKeyUp(event,'cn-hue')"><i style="left:${(nc.h/360*100).toFixed(1)}%;background:hsl(${Math.round(nc.h)},100%,50%)"></i></div>
<div class="cnrow"><label class="cnfld cnhex">Hex<input id="cn-hex" value="${hex.toUpperCase()}" maxlength="7" autocomplete="off" spellcheck="false" oninput="cnHexIn(this.value,false)" onchange="cnHexIn(this.value,true)"><i data-cnsw style="background:${hex}"></i></label><label class="cnfld">Name<input id="cn-name" maxlength="24" value="${esc(nc.name||'')}" placeholder="e.g. Faded burgundy" oninput="cnName(this.value)" onchange="renderColPick(true)"></label></div></div>
${fold}
${nc.err?`<p class="mut formerr" id="cn-error" role="alert">${esc(nc.err)}</p>`:''}
<div class="cpbar">${bar}</div>`;
  if(keep)el.scrollTop=y}
async function colNewAdd(){const nc=colPick&&colPick.newc,it=colTarget();if(!nc||!it)return;const name=cap1(String(nc.name||'').trim());let key;
  try{key=nc.kind==='pattern'?await addCustomPattern({name,desc:(nc.res&&nc.res.description)||nc.desc||'',base:cnPatBase(it,nc),types:nc.types,look:nc.look||null})
    :await addCustomColor({name,hex:nc.hex,base:cnColBase(it,nc),types:nc.types,accent:nc.accent})}
  catch(e){nc.err=e.message||'That could not be added.';renderColPick(true);return}
  toast(`${name} added to your ${nc.kind==='pattern'?'patterns':'colours'}.`);cnDone(key)}
function cnUseExisting(){const nc=colPick&&colPick.newc;if(!nc||!nc.res)return;const ex=nc.res.existing;
  if(colPick.src==='s'){toast(`You already have ${nc.kind==='pattern'?patName(ex):colName(ex)}.`);closeColPick();return}cnDone(ex)}
/* the new colour or pattern (or the one already had) set in the field, as a pick is */
function cnDone(v){const nc=colPick.newc;if(colPick.src==='s'){closeColPick();if(typeof renderCustomUI==='function')renderCustomUI();return}
  if(colPick.src==='q'){const q=queue[colPick.ref];if(q){if(nc.kind==='pattern')q.newPattern=null;else if(colPick.k==='primaryColor')q.newColor=null}}
  colPick.newc=null;colPick.sel=v;useColPick()}
function renderPatNew(keep){const el=$('#col-sheet'),it=colTarget(),nc=colPick&&colPick.newc;if(!el||!it||!nc)return;const y=el.scrollTop,src=colPick.src,r=nc.res,name=cap1(String(nc.name||'').trim()),base=cnPatBase(it,nc);
  const pic=src!=='s'&&it.texture?it.texture:null,draw=(big)=>cnWithPat(it,nc,x=>itemThumb(x,big)),sw=()=>cnWithPat(it,nc,x=>swatchSVG(x,true));
  let res='';
  if((nc.state==='result'||nc.state==='reuse')&&r){const lk=nc.look,g=lk&&lk.tex&&lk.tex.grid,ex=r.existing;
    const plain=[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS,'houndstooth','paisley','tonal-check'].includes(base)?'counts as a pattern':'counts as plain';
    const from=!lk?`the ${esc(patName(base))} drawing`:g?`Claude’s weave map (${g[0].length} × ${g.length})`:lk.motif?'Claude’s figure, in your colours':lk.layout==='stripes'?'Claude’s stripes, in your colours':'Claude’s check, in your colours';
    const bmp=g?`<span class="cnbmp" aria-hidden="true" style="grid-template-columns:repeat(${g[0].length},7px)">${g.join('').split('').map(c=>`<i class="${c==='1'?'on':''}"></i>`).join('')}</span>`:'';
    res=`<div class="cnres" id="cn-res"><div class="cnreshd"><span class="cnresw cnresp">${sw()}</span><span><span class="cneyebrow">Claude’s pattern</span><b>${esc(cap1(r.name||patName(base)))}</b>${r.description?`<small>${esc(r.description)}</small>`:''}</span></div>
<ul class="cnfacts"><li><span>In outfits</span><span>plans like <b>${esc(patName(base))}</b> <span class="cntag">${plain}</span></span></li>
<li><span>Drawn from</span><span>${from}</span>${bmp?`<span class="cnde">${bmp}</span>`:''}</li>
${ex?`<li><span>Nearest yours</span><span>${esc(cap1(patName(ex)))}</span><span class="cnde">${r.match==='existing'?'names it already':ex===base?'drawn like it':'a different pattern'}</span></li>`:''}</ul>
${r.colourHint?`<p class="cnwhy">${esc(r.colourHint)}</p>`:''}${r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:''}
${ex&&patChoices(it).includes(ex)?`<div class="cnbtns">${nc.state==='reuse'?`<button type="button" class="cpaskbtn ghost" id="cn-anyway" onclick="colPick.newc.state='result';renderColPick(true)">Add a new pattern anyway</button>`:`<button type="button" class="cpaskbtn ghost" id="cn-use" onclick="cnUseExisting()">Use ${esc(patName(ex))} instead</button>`}</div>`:''}</div>`}
  if(nc.state==='err')res=cnErrCard(nc,'pattern');if(nc.state==='kind')res=cnKindCard(nc);
  const bases=(PATS_BY[it.type]||['solid']).filter(p=>!CUSTOM_PAT[p]),offer=CN_SUITING.includes(it.type)?CN_SUITING:[it.type];
  const details=nc.state==='reuse'?'':`<div class="cnsec" id="pn-details"><b>${r?'Check the details':'Or set it yourself'}</b>
<label class="cnfld">Name<input id="cn-name" maxlength="24" value="${esc(nc.name||'')}" placeholder="e.g. Hopsack" oninput="cnName(this.value)" onchange="renderColPick(true)"></label>
<label class="cnfld">Planned and drawn like<select id="cn-base" onchange="colPick.newc.base=this.value;renderColPick(true)">${bases.map(p=>`<option value="${p}"${p===base?' selected':''}>${esc(cap1(patName(p)))}</option>`).join('')}</select></label>
<div class="cnfld cnoffer">Offer it for<div class="cnchips">${offer.map(t=>`<button type="button" class="cnchip${nc.types.includes(t)?' on':''}" aria-pressed="${nc.types.includes(t)}" onclick="cnToggleType('${t}')">${esc(TYPES[t])}</button>`).join('')}</div></div></div>`;
  const bar=nc.state==='reuse'&&r?`<button type="button" class="pri" id="cn-add" data-use="1" onclick="cnUseExisting()">Use ${esc(cap1(patName(r.existing)))}</button>`
    :`<button type="button" class="pri" id="cn-add" onclick="colNewAdd()"${name?'':' disabled'}>${name?`Add ${esc(name)}${src==='s'?'':' and use it'}`:'Add pattern'}</button>`;
  el.innerHTML=`<div class="cptop"><div class="pick-head"><button type="button" class="cnback" onclick="colNewBack()" aria-label="${nc.from==='pick'?'Back to patterns':'Close'}">‹</button><b id="col-title">New pattern or texture</b><button class="pick-x" onclick="closeColPick()" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${pic?`<img src="${pic}" alt="Your close-up">`:`<div class="cpdraw">${draw(false)}</div>`}<figcaption>${pic?'Your close-up':`Your ${esc((TYPES[it.type]||'item').toLowerCase())}, drawn`}</figcaption></figure><figure class="cpbig cppatbig"><div class="cpdraw">${draw(true)}</div><figcaption>${esc(name||'Not set yet')}</figcaption></figure></div></div>
${src==='s'?`<label class="cnfld cnfor">For<select id="cn-for" onchange="cnSetType(this.value)">${Object.keys(PATS_BY).map(t=>`<option value="${t}"${t===it.type?' selected':''}>${esc(TYPES[t])}</option>`).join('')}</select></label>`:''}
${cnAskBox(nc,'pattern','The weave or pattern in your words. Claude names it, picks how the app plans it, and maps the weave so it can be drawn.','e.g. a small basketweave like a hopsack')}
${res}
${details}
${nc.err?`<p class="mut formerr" id="cn-error" role="alert">${esc(nc.err)}</p>`:''}
<div class="cpbar">${bar}</div>`;
  if(keep)el.scrollTop=y}
/* (the phone's Back with this sheet up closes only the sheet: colBackFirst in itemsheet.js, registered before the pages' own listeners) */
window.addEventListener('keydown',e=>{if(!colPick)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(colPick.newc)colNewBack();else closeColPick()}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopImmediatePropagation()},true);
