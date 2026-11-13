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
${near.length?`<h4 class="cph">Closest to your ${it.meas.src==='closeup'?'close-up':'photo'}</h4><div class="cpgrid cpnear">${near.map(x=>tile(x.c,`<small class="cpd">${dWord(x.d)}</small>`)).join('')}</div>`:''}
${k==='primaryColor'?'':`<div class="cpgrid">${tile('none')}</div>`}${groups}
<div class="cpbar"><button type="button" class="pri" onclick="useColPick()">${sel===cur?'Keep '+name(sel):'Use '+name(sel)}</button></div>`;
  if(keep)el.scrollTop=y}
window.addEventListener('keydown',e=>{if(!colPick)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeColPick()}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopImmediatePropagation()},true);
