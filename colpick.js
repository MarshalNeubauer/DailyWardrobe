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
  colPick.cur=(k==='primaryColor'?primaryCol(it):it[k])||'none';colPick.sel=colPick.cur;
  colPick.view=it.texture&&(k==='primaryColor'||!it.photo)?'tex':'photo';
  renderColPick();$('#col-sheet').classList.add('on');$('#col-backdrop').classList.add('on');$('#col-sheet').scrollTop=0;
  const x=$('#col-sheet .pick-x');if(x)x.focus({preventScroll:true})}
function closeColPick(){colPick=null;const s=$('#col-sheet'),b=$('#col-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on')}
function colPickSel(c){if(!colPick)return;colPick.sel=c;renderColPick(true)}
function colPickView(v){if(!colPick)return;colPick.view=v;renderColPick(true)}
async function useColPick(){if(!colPick)return;const {src,ref,k,sel,cur}=colPick;closeColPick();if(sel===cur)return;
  if(src==='q')setq(ref,k,sel);else await sete(ref,k,sel)}
function renderColPick(keep){const el=$('#col-sheet'),it=colTarget();if(!el||!it)return;const {k,sel,cur,view}=colPick,y=el.scrollTop;
  const photo=it.photo||(typeof wardPic==='function'?wardPic(it):null),pic=view==='tex'?it.texture:photo,both=!!(it.texture&&photo);
  const name=c=>c==='none'?'None':cap1(colName(c)),hex=c=>COLORS[c]||'transparent';
  const near=colNear(it,k),dWord=d=>d<=4?'Very close':d<=8?'Close':'Nearest';
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
<div class="cpbar"><button type="button" class="pri" onclick="useColPick()">${sel===cur?'Keep '+name(sel):'Use '+name(sel)}</button></div>`;
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
  return {img:sharp||it.tagImg||it.photo||it.texture,closeup:it.texture,measured}}
async function colAskRun(){const it=colTarget();if(!it||!it.texture)return;if(!isConnected()){tell(NEED_CONN);return}
  const src=colPick.src;colAsk[it.id]={busy:true};renderColPick(true);let ai=null;
  try{const x=await colAskImgs(it,src);ai=await ask(x.img,{closeup:x.closeup,measured:x.measured,skipId:it.id})}catch(e){console.warn('colour ask failed',e)}
  colAsk[it.id]=ai&&ai.type?{primaryColor:ai.primaryColor,secondaryColor:ai.secondaryColor||'none',tertiaryColor:ai.tertiaryColor||'none',altColor:ai.altColor,conf:ai.conf,newColor:ai.newColor}
    :{err:aiError||'Claude couldn’t read the colours this time.'};
  if(!colPick||colTarget()!==it)return;   // closed meanwhile: the answer shows when it is opened again
  const v=colAsk[it.id][colPick.k];if(v&&(v==='none'||COLORS[v]))colPick.sel=v;renderColPick(true)}
/* take Claude's colours for every colour field at once */
async function colAskUseAll(){const it=colTarget(),a=it&&colAsk[it.id];if(!a||!a.primaryColor)return;const {src,ref}=colPick;closeColPick();
  const ch=COL_FIELDS(it).filter(f=>(a[f]==='none'?null:a[f])!==((f==='primaryColor'?primaryCol(it):it[f])||null));if(!ch.length)return;
  if(src==='q'){for(const f of ch)setq(ref,f,a[f]);return}
  for(const f of ch)it[f]=a[f]==='none'?null:a[f];delete it.color;
  if(ch.includes('primaryColor')&&it.swSrc==='tex')await refreshSwatch(it);await put(it);cache={};renderWardrobe();toast('Saved Claude’s colours.')}
function colAskHtml(it,k,tile,name){const a=colAsk[it.id];
  if(!it.texture)return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>Add a close-up of the fabric${colPick.src==='e'?' (Edit photos)':''} and Claude can read the colours from it.</small></div></div>`;
  if(!a){const cents=typeof benchEstimate==='function'?Math.max(1,Math.round(benchEstimate(1)*100)):1,on=isConnected();
    return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>${on?`Claude looks at the close-up again and says which colours it is. About ${cents}¢.`:NEED_CONN}</small></div><button type="button" class="cpaskbtn" onclick="colAskRun()"${on?'':' disabled'}>Ask Claude</button></div>`}
  if(a.busy)return `<div class="cpask"><span class="spin" aria-hidden="true"></span><div class="cpasktx"><b>Claude is looking at the close-up…</b><small>This takes a few seconds.</small></div></div>`;
  if(a.err)return `<div class="cpask"><div class="cpasktx"><b>Claude couldn’t answer</b><small>${esc(a.err)}</small></div><button type="button" class="cpaskbtn" onclick="colAskRun()">Try again</button></div>`;
  const cf=a.conf&&a.conf.primaryColor,fs=COL_FIELDS(it),said=fs.map(f=>a[f]).filter(c=>c&&c!=='none').map(c=>`<b>${esc(name(c))}</b>`);
  const pick=[a[k]].concat(k==='primaryColor'&&a.altColor&&a.altColor!==a[k]?[a.altColor]:[]).filter(c=>c==='none'||COLORS[c]);
  const differs=fs.some(f=>f!==k&&(a[f]==='none'?null:a[f])!==((f==='primaryColor'?primaryCol(it):it[f])||null));   // "Use …" below already covers this field
  return `<div class="cpask done"><div class="cpasktx"><b>Claude reads it as ${said.length>1?said.slice(0,-1).join(', ')+' and '+said[said.length-1]:said[0]}</b>${cf&&k==='primaryColor'?`<small>${cap1(cf)} confidence on the main colour.</small>`:''}${a.newColor?`<small>None of the listed colours quite fit: Claude calls it ${esc(a.newColor.name)}${a.newColor.why?`, ${esc(a.newColor.why)}`:''}.</small>`:''}</div>
<div class="cpgrid cpai">${pick.map((c,j)=>tile(c,`<small class="cpd cpaid">${j?'Claude’s 2nd':'Claude’s pick'}</small>`)).join('')}</div>
<div class="cpaskbtns">${differs&&fs.length>1?`<button type="button" class="cpaskbtn" onclick="colAskUseAll()">Use all of Claude’s colours</button>`:''}<button type="button" class="cpaskbtn ghost" onclick="colAskRun()">Ask again</button></div></div>`}
window.addEventListener('keydown',e=>{if(!colPick)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeColPick()}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopImmediatePropagation()},true);
