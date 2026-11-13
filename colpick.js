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
  return `<button type="button" class="colbtn" data-k="${k}" onclick="openColPick('${src}',${r},'${k}')" aria-haspopup="dialog"><span class="colchip${c?'':' none'}"${c?` style="background:${COLORS[c]}"`:''}></span><span class="colnm">${c?cap1(colName(c)):'None'}</span><svg class="colchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`};
/* the editor's colour row, labelled as E() labels it */
const EC=(id,k,v,lab)=>`<label class="colrow">${lab||colLabel(k)} ${colBtn('e',id,k,v)}</label>`;
const colTarget=()=>!colPick?null:colPick.src==='q'?queue[colPick.ref]:items.find(x=>x.id===colPick.ref);
function colChoices(it,k){const cur=k==='primaryColor'?primaryCol(it):it[k];
  return COLOR_OPTS(it.type,cur,k!=='primaryColor').map(x=>x[0]).filter(c=>COLORS[c])}
/* the three colours nearest the measured cloth (main colour only) */
function colNear(it,k){if(k!=='primaryColor'||!it.meas)return [];
  let n=it.meas.near;if(it.meas.lab&&typeof nearestCols==='function')try{n=nearestCols(it.type,it.meas.lab,it.meas.ref)}catch(e){}
  return (n||[]).filter(x=>COLORS[x.c])}
function openColPick(src,ref,k){colPick={src,ref,k};const it=colTarget();if(!it){colPick=null;return}
  colPick.cur=k==='pattern'?normPat(it.type,it.pattern):(k==='primaryColor'?primaryCol(it):it[k])||'none';colPick.sel=colPick.cur;
  colPick.view=it.texture&&(k==='primaryColor'||k==='pattern'||!it.photo)?'tex':'photo';
  renderColPick();$('#col-sheet').classList.add('on');$('#col-backdrop').classList.add('on');$('#col-sheet').scrollTop=0;
  const x=$('#col-sheet .pick-x');if(x)x.focus({preventScroll:true})}
function closeColPick(){colPick=null;const s=$('#col-sheet'),b=$('#col-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on')}
function colPickSel(c){if(!colPick)return;colPick.sel=c;renderColPick(true)}
function colPickView(v){if(!colPick)return;colPick.view=v;renderColPick(true)}
async function useColPick(){if(!colPick)return;const {src,ref,k,sel,cur}=colPick,it=colTarget();let v=sel;
  if(sel===NEW_COL){try{v=k==='pattern'?await patAddNew(it,patNewFor(it)):await colAddNew(it,k,colNewFor(it,k))}catch(e){toast(e.message||'That could not be added.');return}}
  closeColPick();if(v===cur)return;
  if(src==='q')setq(ref,k,v);else await sete(ref,k,v)}
function renderColPick(keep){if(colPick&&colPick.k==='pattern')return renderPatPick(keep);const el=$('#col-sheet'),it=colTarget();if(!el||!it)return;const {k,sel,cur,view}=colPick,y=el.scrollTop;
  const photo=it.photo||(typeof wardPic==='function'?wardPic(it):null),pic=view==='tex'?it.texture:photo,both=!!(it.texture&&photo);
  const nc=colNewFor(it,k),name=c=>c==='none'?'None':c===NEW_COL?cap1(nc?nc.name:''):cap1(colName(c)),hex=c=>c===NEW_COL?(nc?nc.hex:'transparent'):COLORS[c]||'transparent';  const near=colNear(it,k),dWord=d=>d<=4?'Very close':d<=8?'Close':'Nearest';
  const tile=(c,extra='')=>`<button type="button" class="cptile${c===sel?' sel':''}" data-c="${c}" onclick="colPickSel('${c}')" aria-pressed="${c===sel}"><span class="cpsw${c==='none'?' none':''}"${c==='none'?'':` style="background:${hex(c)}"`}>${c===cur?'<i class="cpnow">Now</i>':''}</span><span class="cpnm">${name(c)}</span>${extra}</button>`;
  const fams=COL_FAMS.map(()=>[]);for(const c of colChoices(it,k))fams[colFamily(c)].push(c);
  const groups=fams.map((l,f)=>l.length?`<h4 class="cph">${COL_FAMS[f]}</h4><div class="cpgrid">${l.sort((a,b)=>labOf(b)[0]-labOf(a)[0]).map(c=>tile(c)).join('')}</div>`:'').join('');
  const what=view==='tex'?'Your close-up':'Your photo';
  el.innerHTML=`<div class="cptop"><div class="pick-head"><b id="col-title">${k==='secondaryColor'&&it.type==='socks'?'Toe cap colour':k==='primaryColor'?'Choose the colour':'Choose the '+colLabel(k).toLowerCase()}</b><button class="pick-x" onclick="closeColPick()" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph">${pic?`<img src="${pic}" alt="${what}">`:`<div class="cpdraw">${itemThumb(it,true)}</div>`}<figcaption>${pic?what:'As drawn'}</figcaption></figure><figure class="cpbig${sel==='none'?' none':''}"${sel==='none'?'':` style="background:${hex(sel)}"`}><figcaption>${name(sel)}</figcaption></figure></div>
${both?`<div class="cpseg" role="group" aria-label="Compare with"><button type="button" class="${view==='tex'?'on':''}" onclick="colPickView('tex')" aria-pressed="${view==='tex'}">Close-up</button><button type="button" class="${view==='photo'?'on':''}" onclick="colPickView('photo')" aria-pressed="${view==='photo'}">Whole photo</button></div>`:''}</div>
<p class="cphelp">Tap a colour to see it right beside your ${pic?view==='tex'?'close-up':'photo':'item'}. Pick the one whose edge you can hardly see.</p>
${colAskHtml(it,k,tile,name)}
${near.length?`<h4 class="cph">Closest to your ${it.meas.src==='closeup'?'close-up':'photo'}</h4><div class="cpgrid cpnear">${near.map(x=>tile(x.c,`<small class="cpd">${dWord(x.d)}</small>`)).join('')}</div>`:''}
${k==='primaryColor'?'':`<div class="cpgrid">${tile('none')}</div>`}${groups}
<div class="cpbar"><button type="button" class="pri" onclick="useColPick()">${sel===NEW_COL?'Add '+name(sel)+' to your colours and use it':sel===cur?'Keep '+name(sel):'Use '+name(sel)}</button></div>`;
  if(keep)el.scrollTop=y}
/* ---- Ask Claude: the close-up (white-balanced), the sharp photo and the close-up's measurement go to the tagger again, the same
   request as an Add card's tagging from the close-up (refineFromCloseup) or the accuracy check (benchTagOne). The answer is kept
   in memory per item (colAsk, not saved or synced), so the other colour fields show it without asking again; Claude's pick for
   the field being edited is selected at once, so it lies beside the close-up. ---- */
const colAsk={};
const COL_FIELDS=it=>it.type==='socks'?['primaryColor','secondaryColor']:['primaryColor','secondaryColor','tertiaryColor'];
async function colAskImgs(it,src){
  if(src==='q'&&it.raw&&it.raw.tex){measureCard(it);return {img:it.tagImg||it.photo||it.texture,closeup:await closeTagImg(it),measured:measHint(it.meas)}}
  let measured;try{const c=await imgOf(it.texture),cv=document.createElement('canvas');cv.width=c.naturalWidth;cv.height=c.naturalHeight;cv.getContext('2d').drawImage(c,0,0);
    const r=wbRead(cv),m={...measureCloth(cv,null,r.ref?{gains:r.gains,refLum:r.refLum}:{}),src:'closeup'};m.near=nearestCols(it.type,m.lab,m.ref);measured=measHint(m)}catch(e){}
  const sharp=src==='e'&&typeof tagImgOf==='function'?await tagImgOf(it.id):null;
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
const colBaseFor=hex=>{const lab=rgbLab(...hexRgb(hex));return Object.keys(COLORS).filter(c=>!CUSTOM_COL[c]&&!SHIRT_ONLY.includes(c)).sort((a,b)=>dE00(lab,labOf(a))-dE00(lab,labOf(b)))[0]};
function colNewFor(it,k){const a=it&&colAsk[it.id+'|c'],o=a&&a.own&&a.own[k];if(!o||!o.name||ownColKey(o.name).length<5)return null;
  if(COLORS[ownColKey(o.name)]||Object.keys(COLORS).some(c=>colName(c).toLowerCase()===o.name||c===o.name.replace(/\s/g,'')))return null;
  if(a[k]&&COLORS[a[k]]&&dE00(rgbLab(...hexRgb(o.hex)),labOf(a[k]))<2)return null;
  return o}
async function colAddNew(it,k,nc){if(!nc)throw new Error('Ask Claude again: its colour was not kept.');const key=ownColKey(nc.name);
  if(!COLORS[key]){await addCustomColor({name:cap1(nc.name),hex:nc.hex,base:colBaseFor(nc.hex),types:groupOf(it.type),accent:k!=='primaryColor'});toast(`${cap1(nc.name)} added to your colours.`)}
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
${nc?`<small class="cpnewtx">${esc(cap1(nc.name))} isn’t one of your colours yet: pick it and it is added to the app (it then behaves like ${esc(colName(colBaseFor(nc.hex)))} in your outfits).</small>`:''}
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
  return `<button type="button" class="colbtn patbtn" data-k="pattern" onclick="openColPick('${src}',${r},'pattern')" aria-haspopup="dialog"><span class="colchip patchip">${swatchSVG(patVar(it,p),true)}</span><span class="colnm">${patTitle(p)}</span><svg class="colchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`};
const EP=(id,it)=>`<label class="colrow">Pattern ${patBtn('e',id,it)}</label>`;
const PAT_GROUPS=[[['solid'],'Plain'],[['pinstripe','chalk-stripe','stripe','fine-stripe'],'Stripes'],[['glen-check','windowpane','check','gingham','tattersall','tonal-check','houndstooth'],'Checks'],
  [['herringbone','birdseye','nailhead','sharkskin','twill','tweed','oxford','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture','knit'],'Weaves'],[['polka-dot','paisley','foulard'],'Figures']];
const patGroupOf=p=>{const b=patBase(p);const g=PAT_GROUPS.findIndex(([l])=>l.includes(b));return g<0?PAT_GROUPS.length:g};
function patNewFor(it){const a=it&&colAsk[it.id+'|p'],o=a&&a.ownPattern;if(!o||o.fits||!o.name)return null;const key=ownPatKey(o.name);if(key.length<6)return null;
  if(CUSTOM_PAT[key]||Object.values(PATS_BY).some(l=>l.includes(key))||Object.values(PATS_BY).some(l=>l.some(p=>patName(p).toLowerCase()===o.name)))return null;
  return o}
const patNewBase=it=>{const a=colAsk[it.id+'|p'];const b=a&&a.pattern?patBase(a.pattern):'solid';return (PATS_BY[it.type]||[]).includes(b)?b:'solid'};
async function patAddNew(it,o){if(!o)throw new Error('Ask Claude again: its pattern was not kept.');const key=ownPatKey(o.name);
  if(!CUSTOM_PAT[key]){const g=['suit','blazer','pants'].includes(it.type)?['suit','blazer','pants']:[it.type];
    await addCustomPattern({name:cap1(o.name),desc:o.description||'',base:patNewBase(it),types:g});toast(`${cap1(o.name)} added to your patterns.`)}
  return key}
function renderPatPick(keep){const el=$('#col-sheet'),it=colTarget();if(!el||!it)return;const {sel,cur,view}=colPick,y=el.scrollTop;
  const photo=it.photo||(typeof wardPic==='function'?wardPic(it):null),pic=view==='tex'?it.texture:photo,both=!!(it.texture&&photo);
  const np=patNewFor(it),drawAs=p=>p===NEW_COL?patNewBase(it):p,name=p=>p===NEW_COL?cap1(np?np.name:''):patTitle(p);
  const tile=(p,extra='')=>`<button type="button" class="cptile${p===sel?' sel':''}" data-c="${p}" onclick="colPickSel('${p}')" aria-pressed="${p===sel}"><span class="cpsw cppat">${swatchSVG(patVar(it,drawAs(p)),true)}${p===cur?'<i class="cpnow">Now</i>':''}</span><span class="cpnm">${esc(name(p))}</span>${extra}</button>`;
  const gs=[...PAT_GROUPS.map(()=>[]),[]];for(const p of patChoices(it))gs[patGroupOf(p)].push(p);
  const groups=gs.map((l,g)=>l.length?`<h4 class="cph">${g<PAT_GROUPS.length?PAT_GROUPS[g][1]:'Other'}</h4><div class="cpgrid">${l.map(p=>tile(p)).join('')}</div>`:'').join('');
  const what=view==='tex'?'Your close-up':'Your photo';
  el.innerHTML=`<div class="cptop"><div class="pick-head"><b id="col-title">Choose the pattern</b><button class="pick-x" onclick="closeColPick()" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph">${pic?`<img src="${pic}" alt="${what}">`:`<div class="cpdraw">${itemThumb(it,true)}</div>`}<figcaption>${pic?what:'As drawn'}</figcaption></figure><figure class="cpbig cppatbig"><div class="cpdraw">${itemThumb(patVar(it,drawAs(sel)),true)}</div><figcaption>${esc(name(sel))}</figcaption></figure></div>
${both?`<div class="cpseg" role="group" aria-label="Compare with"><button type="button" class="${view==='tex'?'on':''}" onclick="colPickView('tex')" aria-pressed="${view==='tex'}">Close-up</button><button type="button" class="${view==='photo'?'on':''}" onclick="colPickView('photo')" aria-pressed="${view==='photo'}">Whole photo</button></div>`:''}</div>
<p class="cphelp">Tap a pattern to see it drawn in your item’s colours beside your ${pic?view==='tex'?'close-up':'photo':'item'}.</p>
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
window.addEventListener('keydown',e=>{if(!colPick)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeColPick()}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopImmediatePropagation()},true);
