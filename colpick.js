/* colour picker (loaded after wardrobe.js): the colour fields of the Add card and the item sheet are a button showing the colour as a
   chip and its name (colBtn); a tap opens a sheet (#col-sheet) with the item's close-up or photo beside a large chip of the colour being
   looked at (the two touch, so their edges can be compared), the colours nearest the measured cloth first, then every colour the item
   type allows as a chip with its name, grouped by family and light to dark. A tap on a chip only shows it beside the photo; "Use …"
   saves it (setq on the Add card, sete in the editor). */
let colPick=null;   // {src:'q'|'e', ref: queue index or item id, k: field, cur, sel, view:'tex'|'photo'}
const COL_FAMS=['Whites, grays & blacks','Creams, tans & browns','Greens & olives','Blues','Reds, pinks & purples'];
function colFamily(c){const [,a,b]=labOf(c),C=Math.hypot(a,b);let h=Math.atan2(b,a)*180/Math.PI;if(h<0)h+=360;
  return C<9?0:h>=45&&h<100?1:h>=100&&h<200?2:h>=200&&h<298?3:4}   // deep blue (hue 293) is a blue; lavender (302) and purple stay with the purples (W2-16-11)
const colLabel=k=>k==='primaryColor'?'Color':k==='secondaryColor'?'Second color':'Third color';
/* lab: the field's name; the button is named "Color: Mid gray" (W2-19-04: inside its <label> it was named only "Color", the value unsaid) */
const colBtn=(src,ref,k,v,lab)=>{const c=v&&COLORS[v]?v:null;
  return `<button type="button" class="colbtn" data-k="${k}" data-act="colBtnTap" data-src="${src}" data-ref="${esc(String(ref))}" aria-haspopup="dialog" aria-label="${esc(lab||colLabel(k))}: ${c?esc(cap1(colName(c))):'None'}"><span class="colchip${c?'':' none'}"${c?` style="background:${COLORS[c]}"`:''}></span><span class="colnm">${c?esc(cap1(colName(c))):'None'}</span><svg class="colchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`};
/* which colour fields an item shows (2026-11-15, the new-user audit: cufflinks asked for three colours, a bracelet watch's Colour did
   nothing, coats saved "Tan & brown"): only what something draws or names. The main colour always, but not on a watch on a metal bracelet
   (on a leather strap it is the strap's: "Strap colour"); a second colour for patterned cloth (its stripe), socks (the toe cap) and
   sneakers (the sole); a third only for patterned cloth. A field that already holds a colour stays, so it can be cleared. */
const colHas=v=>!!v&&v!=='none';
/* socks (2026-11-17, sock patterns): the toe cap is its own field (toeColor, always shown); a patterned sock's second colour (and a third
   for argyle, stripes and other designs) is the pattern's; a plain or one-colour knit (ribbed, herringbone) has none */
const SOCK_THIRD=['argyle','stripe','other'];
const colShows=(it,k)=>{const t=it&&it.type;if(!t)return true;
  if(k==='primaryColor')return t!=='watch'||strapBand(it);
  if(k==='toeColor')return t==='socks';
  if(t==='socks'&&it.toeColor===undefined&&!sockPatterned(it))return false;   // a sock from before: its second colour is its toe cap (shown as Toe cap)
  if(colHas(it[k]))return true;
  if(t==='socks'){const p=patOf(it)||'solid';return k==='secondaryColor'?p!=='solid':SOCK_THIRD.includes(p)}
  if(k==='secondaryColor')return lookHasPat(t)||(t==='shoes'&&soleStyle(it));
  return lookHasPat(t)};   // (hasPat: patterned cloth, a pocket square's print or border, a casual garment's stripe, heather or cable; look.js lookHasPat: coats too with the Look beta on)
const colFieldLabel=(it,k)=>k==='primaryColor'?(it&&it.type==='watch'?'Strap color':'Color'):k==='toeColor'?'Toe cap':k==='secondaryColor'?(it&&it.type==='shoes'&&soleStyle(it)?'Sole':'Second color'):'Third color';
/* a second or third colour the item can't show is dropped where the item is made (saveCard) or its type changed (sete): an Add card
   shows only the fields its type uses, a saved item keeps one already set until it is cleared or its type changes */
function colTidy(it){for(const k of ['secondaryColor','tertiaryColor'])if(colHas(it[k])&&!colShows({...it,[k]:null},k))delete it[k];return it}
/* the colour rows of the Add card (src 'q', ref the card's id) and the item sheet (src 'e', ref the item's id); a card is never found by its
   place in the list (CR-1-02: a "Several items" answer landing while the sheet was up moved the list, and "Use" colored another card) */
const colRows=(src,ref,it)=>['primaryColor','secondaryColor','tertiaryColor','toeColor'].filter(k=>src==='q'?colShows({...it,[k]:k==='primaryColor'?it[k]:null},k):colShows(it,k)).map(k=>`<label class="colrow">${colFieldLabel(it,k)} ${colBtn(src,ref,k,k==='primaryColor'?(src==='e'?primaryCol(it):it.primaryColor):k==='toeColor'?(src==='e'?sockToeKey(it):it.toeColor)||'none':it[k]||'none',colFieldLabel(it,k))}</label>`).join('');
const colTarget=()=>!colPick?null:colPick.src==='s'?colPick.fake:colPick.src==='q'?cardOf(colPick.ref):items.find(x=>x.id===colPick.ref);
function colChoices(it,k){if(k==='accents')return accChoices(it);if(k==='dial')return DIAL_COLS.slice();if(k==='enamel')return LOOK_ENAMEL.slice();   // (the Look beta's dial and tie clip enamel: look.js)
  const cur=k==='primaryColor'?primaryCol(it):it[k];
  return COLOR_OPTS(it.type,cur,k!=='primaryColor').map(x=>x[0]).filter(c=>COLORS[c])}
/* ---- "Also has" (2026-11-16, accents: core.js accentsOf): "Add a color" opens this sheet with k 'accents' (no current colour, no None,
   no Ask Claude, no New color: a new shade is added from a main colour's sheet first); "Add …" puts the colour picked at the end of the
   item's accents (accSet: Add card or item). Every colour is offered, the owner's own included, but the item's three and its accents ---- */
const accChoices=it=>{const main=[primaryCol(it),it.secondaryColor,it.tertiaryColor],have=accentsOf(it);
  // the Look beta (2026-11-17, the audit's #15): only the colours the type comes in as line colours (and the owner's own), no metal unless the type is metal
  const ok=lookOn()?c=>(colsFor(it.type,true).includes(c)||!!CUSTOM_COL[c])&&(!LOOK_METAL_COLS.includes(c)||LOOK_METALT.includes(it.type)):()=>true;
  return Object.keys(COLORS).filter(c=>!main.includes(c)&&!have.includes(c)&&c!=='cnprev'&&ok(c))};   // (cnprev: a preview's stand-in, never a colour)
const accItem=(src,ref)=>src==='q'?cardOf(ref):items.find(x=>x.id===ref);
async function accSet(src,ref,list){const it=accItem(src,ref);if(!it)return;const a=accentsFor(it,list);if(a.length)it.accents=a;else delete it.accents;
  if(src==='q'){it.edited={...it.edited,accents:true};it.checked={...it.checked,colors:1};queueMicrotask(addKeep);renderAdd();return}
  await put(it);planDirty();renderWardrobe()}
function accDel(src,ref,c){const it=accItem(src,ref);if(it)return accSet(src,ref,accentsOf(it).filter(x=>x!==c))}
/* the three colours nearest the measured cloth (main colour only) */
/* (2026-11-14) a patterned cloth's colours one by one: its ground for the main colour, its stripe for the second (measureParts); with no
   such reading a patterned cloth offers none (the whole picture's median of a white/blue stripe is grey: "Use grey" made it worse) */
function colNear(it,k){const m=it.meas;if(!m||!m.lab||!['primaryColor','secondaryColor'].includes(k))return [];
  const parts=m.parts&&m.parts.length>1?m.parts:null;if(!parts&&(k!=='primaryColor'||multiCol(it)))return [];
  const lab=parts?parts[k==='primaryColor'?0:1].lab:m.lab;
  try{return nearestCols(it.type,lab,m.ref,{kL:measKL(m),skip:it.id,accent:k!=='primaryColor'}).filter(x=>COLORS[x.c])}catch(e){return []}}
function openColPick(src,ref,k){if(src==='q'&&typeof ref==='number'){const q=queue[ref];ref=q?q.id:''}   // (a place, from tagging.js and tests: its card's id from now on)
  colPick={src,ref,k,from:document.activeElement};const it=colTarget();if(!it){colPick=null;return}
  colPick.cur=k==='accents'?'':k==='pattern'?normPat(it.type,it.pattern):LOOK_KS.includes(k)?lookCur(it,k):(k==='primaryColor'?primaryCol(it):k==='toeColor'?sockToeKey(it):it[k])||'none';colPick.sel=colPick.cur;   // (accents: nothing picked yet; the Look beta's own fields: look.js lookCur)
  if(k==='primaryColor'&&lookOn())Object.assign(colPick,{shade:it.shade||0});   // (the beta's Shade is in the colour sheet)
  colPick.view=it.texture&&(k==='primaryColor'||k==='pattern'||k==='accents'||!it.photo)?'tex':'photo';
  renderColPick();$('#col-sheet').classList.add('on');$('#col-backdrop').classList.add('on');$('#col-sheet').scrollTop=0;colSwipe();layerInert();   // the item sheet under it out of reach (W2-19-03)
  const x=$('#col-sheet .pick-x');if(x)x.focus({preventScroll:true})}
/* suits and blazers are shown as their traced figure (SUIT_D, BLAZER_D) in the colour or pattern being looked at, redrawn on every
   tap: in place of the flat swatch without a photo, and as a third view ("Drawing", view 'draw') beside the close-up and the photo */
// every item is shown as its drawing when it has no photo (the owner, 2026-11-13: the traced trousers, shoes, belt… as well as
// suits and blazers; a flat square of cloth was shown for fabric items); with a photo or close-up the photo leads, the drawing a tab
const cpFig=it=>!!it;
function cpViews(it,photo){const v=[];if(it.texture)v.push(['tex','Close-up']);if(photo)v.push(['photo','Whole photo']);if(cpFig(it)&&v.length)v.push(['draw','Drawing']);return v}
const cpSeg=(vs,view)=>vs.length>1?`<div class="cpseg" role="group" aria-label="Compare with">${vs.map(([v,l])=>`<button type="button" class="${view===v?'on':''}" data-act="cpViewTap" data-v="${v}" aria-pressed="${view===v}">${l}</button>`).join('')}</div>`:'';
/* closing gives the focus back to the button that opened it (W2-19-03: it fell to <body>); when that button was drawn again meanwhile,
   to the same field's button (data-k) in the item sheet or on Add */
function closeColPick(){const c=colPick;colPick=null;const s=$('#col-sheet'),b=$('#col-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on');
  layerInert();if(!c)return;const a=document.activeElement;if(a&&a!==document.body&&!(s&&s.contains(a)))return;
  const f=c.from&&c.from.isConnected?c.from:document.querySelector(`#item-view.on .colbtn[data-k="${c.k}"],#nps-sheet.on .colbtn[data-k="${c.k}"],#add .colbtn[data-k="${c.k}"],#item-view.on .lkrow[data-k="${c.k}"],#nps-sheet.on .lkrow[data-k="${c.k}"],#add .lkrow[data-k="${c.k}"]`)||null;
  if(f&&!f.closest('[inert]'))try{f.focus({preventScroll:true})}catch{}}
/* the phone's Back with the color or pattern sheet up closes the sheet only (2026-11-15, the re-audit: Back closed the Add page or the item
   sheet underneath and left the sheet up, and "Use" then changed an item no longer on screen). The sheet has no entry of its own: Back took
   the page's, so it is asked first (back.js backOver), closes (‹ first on a "New" sheet opened from the list, as its own ‹ does) and back.js
   puts that entry back, so the next Back closes the page. A sheet that borrowed the entry over it (a question, the close-up chooser, the
   reading sheet) takes its own Back. */
backOver(top=>{if(!colPick||top==='ask'||top==='cu'||top==='rd')return false;
  if(colPick.newc&&colPick.newc.from==='pick')colNewBack();else closeColPick();return true});
/* ---- swiping a sheet down closes it (2026-11-15, the owner: "When I click on color or texture, the sheet comes up, but I can't swipe it
   down"): the color / pattern sheet with its New color / New pattern states, and the reading sheet, by sheet-swipe.js sheetSwipe (the gesture of
   every sheet): the sheet scrolls itself, its sticky top (grabber, title, the photos) is the handle; let go past the line it closes as its
   × does and slides away from where it was let go. Never from a dropdown, a slider (the New color square and hue bar) or its bottom bar. ---- */
const SW_GRAB='<span class="cpgrab" aria-hidden="true"></span>';
function cpSwipe(s,head,backdrop,on,close){if(s)sheetSwipe(s,{head,backdrop:()=>document.querySelector(backdrop),live:()=>on(),skip:'select,[role=slider],.cpbar,.rdbar',close,slide:true,fadeBack:true})}
function colSwipe(){const s=$('#col-sheet');cpSwipe(s,'.cptop','#col-backdrop',()=>!!colPick&&s.classList.contains('on'),closeColPick)}
function colPickSel(c){if(!colPick)return;colPick.sel=c;renderColPick(true)}
function colPickView(v){if(!colPick)return;colPick.view=v;renderColPick(true)}
async function useColPick(){if(!colPick)return;const {src,ref,k,sel,cur}=colPick,it=colTarget();let v=sel;if(!it){closeColPick();return}   // (its card is gone)
  if(k==='accents'){if(!sel||!COLORS[sel]||!it)return;closeColPick();await accSet(src,ref,[...accentsOf(it),sel]);return}   // "Also has": added at the end
  // the Look beta's own fields (look.js): a material, leather, metal or buckle; a tie clip's enamel; a watch's dial
  if(LOOK_PK.includes(k))return lookUsePick();
  if(k==='enamel'){closeColPick();if(sel!==cur)await lookSetEnamel(src,ref,sel);return}
  if(k==='dial'){closeColPick();if(sel!==cur&&COLORS[sel])await lookWrite(src,ref,{dial:sel});return}
  if(sel===NEW_COL){try{v=k==='pattern'?await patAddNew(it,patNewFor(it)):await colAddNew(it,k,colNewFor(it,k))}catch(e){toast(e.message||'That could not be added.');return}}
  // the beta's Shade (picked in this sheet): kept with the colour, none for a metal
  const sh=colPick.shade!=null&&k==='primaryColor'&&lookOn()?(lookShadeOk(k,v)?colPick.shade:0):null,shCh=sh!==null&&sh!==(it.shade||0);
  closeColPick();if(v===cur&&!shCh)return;
  if(shCh){if(sh)it.shade=sh;else delete it.shade;if(v===cur){if(src==='q'){queueMicrotask(addKeep);renderAdd()}else{await put(it);planDirty();renderWardrobe()}return}}
  // one of the owner's colours not offered for this kind yet ("Your other colors", or "Use …" from New color): offered for it from now on
  const off=k!=='pattern'&&v&&CUSTOM_COL[v]&&it?await ownColOffer(v,it.type,k!=='primaryColor'):null;
  if(src==='q')setq(ref,k,v);else await sete(ref,k,v);
  if(off)toast(off.msg,4000,{label:'Undo',fn:off.undo})}
function renderColPick(keep){if(colPick&&colPick.newc)return colPick.newc.kind==='pattern'?renderPatNew(keep):renderColNew(keep);
  if(colPick&&colPick.k==='pattern')return renderPatPick(keep);if(colPick&&LOOK_PK.includes(colPick.k))return renderLookPick(keep);
  const el=$('#col-sheet'),it=colTarget();if(!el||!it)return;const {k,sel,cur,view}=colPick,y=el.scrollTop;
  // the Look beta (look.js, 2026-11-17): Shade under the preview (not for a metal), Suggested first, no Ask Claude (Read with Claude is in
  // the Look section), "+ New color" at the end; a dial and a tie clip's enamel are picked here too
  const L=lookOn(),lk=L&&(k==='dial'||k==='enamel'),shd=L&&lookShadeOk(k,sel)?colPick.shade||0:0;
  const photo=it.photo||wardPic(it),pic=view==='draw'?null:view==='tex'?it.texture:photo,vs=cpViews(it,photo);
  const acc=k==='accents',nc=acc||lk?null:colNewFor(it,k),name=c=>!c?'':c==='none'?(k==='enamel'?'None · plain metal':'None'):c===NEW_COL?cap1(nc?nc.name:''):cap1(colName(c)),hex=c=>c===NEW_COL?(nc?nc.hex:'transparent'):COLORS[c]||'transparent';  const near=L?[]:colNear(it,k),dWord=d=>d<=4?'Very close':d<=8?'Close':'Nearest';
  const tile=(c,extra='')=>`<button type="button" class="cptile${c===sel?' sel':''}" data-c="${c}" data-act="cpTileTap" aria-pressed="${c===sel}"><span class="cpsw${c==='none'?' none':''}"${c==='none'?'':` style="background:${hex(c)}"`}>${c===cur?'<i class="cpnow" aria-hidden="true">Now</i>':''}</span><span class="cpnm">${esc(name(c))}</span>${c===cur?'<span class="vh">, now</span>':''}${extra}</button>`;
  const fams=COL_FAMS.map(()=>[]);for(const c of colChoices(it,k))fams[colFamily(c)].push(c);
  const groups=fams.map((l,f)=>l.length?`<h4 class="cph">${COL_FAMS[f]}</h4><div class="cpgrid">${l.sort((a,b)=>labOf(b)[0]-labOf(a)[0]).map(c=>tile(c)).join('')}</div>`:'').join('');
  const what=view==='tex'?'Your close-up':'Your photo';
  // with no colors of one's own "Your colors" is one slim line, the heading and a small "+ New color" (fix round 3, W2-14-02: its tile and
  // the Ask Claude card filled the screen above the Keep button, at the largest text with nothing to pick); the editor's order stays
  const mine=lk?[]:colChoices(it,k).filter(c=>CUSTOM_COL[c]),
    ownH=!COLS_BY[it.type]||lk?'':L?`<h4 class="cph">Yours</h4>${mine.length?`<div class="cpgrid cnown">${mine.map(c=>tile(c)).join('')}</div>`:'<p class="cphelp lkyours">Colors you add show here first. “+ New color” is at the end.</p>'}`
      :mine.length?`<h4 class="cph">Your colors</h4><div class="cpgrid cnown">${mine.map(c=>tile(c)).join('')}<button type="button" class="cptile cpnewt" id="cn-open" data-act="cnOpenTap"><span class="cpsw" aria-hidden="true">+</span><span class="cpnm">New color</span></button></div>`
      :`<h4 class="cph cpownh">Your colors</h4><div class="cpgrid cnown cnslim"><button type="button" class="cpnewl" id="cn-open" data-act="cnOpenTap"><span aria-hidden="true">+</span> New color</button></div>`;
  // the owner's colours made for other kinds of item (2026-11-16, the owner's coyote brown T-shirt): picking one offers it for this kind too (useColPick)
  const others=acc||lk||!COLS_BY[it.type]?[]:Object.keys(CUSTOM_COL).filter(c=>COLORS[c]&&!colChoices(it,k).includes(c)),
    otherH=others.length?`<h4 class="cph" id="cp-other-h">Your other colors</h4><small class="cpothx">Made for other kinds of item. Pick one and it is offered for ${esc(typePl(it.type))} too.</small><div class="cpgrid cnown cpother" aria-labelledby="cp-other-h">${others.map(c=>tile(c)).join('')}</div>`:'';
  const sug=L&&!acc&&!lk?lookSugCols(it,k):[],sugH=sug.length?`<h4 class="cph">Suggested</h4><div class="cpgrid cpsug">${sug.map(([c,l])=>tile(c,`<small class="cpd cpaid">${esc(l)}</small>`)).join('')}</div>`:'',
    newH=L&&!acc&&!lk&&COLS_BY[it.type]?`<h4 class="cph">New</h4><div class="cpgrid"><button type="button" class="cptile cpnewt" id="cn-open" data-act="lkNewCol"><span class="cpsw" aria-hidden="true">+</span><span class="cpnm">New color</span></button></div>`:'';
  // without a photo the drawing stands in, drawn in the colour being looked at (Claude's new colour isn't one yet: drawn as it is)
  const drawn=k==='enamel'?{...it,primaryColor:sel==='none'?lookClipMetal(it):sel}:k==='dial'?{...it,dial:sel}:L&&k==='primaryColor'&&sel!==NEW_COL&&(sel!==cur||shd!==(it.shade||0))?{...it,primaryColor:sel,color:undefined,shade:shd||undefined}
    :sel===NEW_COL||sel===cur?it:acc?{...it,accents:[...accentsOf(it),sel]}:{...it,[k]:sel==='none'?null:sel,...(k==='primaryColor'?{color:undefined}:{})};
  const bigHex=c=>shd&&COLORS[c]?shadeHex(COLORS[c],shd):hex(c),shName=shd?' · '+shadeName(shd):'',same=sel===cur&&(!L||k!=='primaryColor'||shd===(lookShadeOk(k,cur)?it.shade||0:0));
  el.innerHTML=`<div class="cptop">${SW_GRAB}<div class="pick-head"><b id="col-title">${acc?'Add a color it also has':k==='dial'?'Choose the dial color':k==='enamel'?'Choose the enamel':k==='toeColor'?'Toe cap color':k==='primaryColor'&&it.type!=='watch'?'Choose the color':'Choose the '+colFieldLabel(it,k).toLowerCase()+(colFieldLabel(it,k)==='Sole'?' color':'')}</b><button class="pick-x" data-act="cpCloseTap" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${pic?`<img src="${srcOk(pic)}" alt="${what}">`:`<div class="cpdraw">${itemThumb(drawn)}</div>`}<figcaption>${pic?what:'As drawn'}</figcaption></figure><figure class="cpbig${sel==='none'?' none':''}"${sel==='none'?'':` style="background:${bigHex(sel)}"`}><figcaption>${esc(name(sel)+shName)}</figcaption></figure></div>
${cpSeg(vs,view)}${L&&lookShadeOk(k,sel)?lookShadeHtml():''}</div>
${acc||L?'':colAskHtml(it,k,tile,name)}
<p class="cphelp">${acc?`Pick a further color you can see in the pattern, beyond its main ${it.tertiaryColor?'three':'colors'}: a speck or a logo doesn’t count.`:pic?`Tap a color to see it right beside your ${view==='tex'?'close-up':'photo'}. Pick the one whose edge you can hardly see.`:cpFig(it)?`Tap a color to see your ${(TYPES[it.type]||'item').toLowerCase()} drawn in it.`:'Tap a color to see it right beside your item. Pick the one whose edge you can hardly see.'}</p>
${sugH}${acc?'':ownH}${otherH}
${near.length?`<h4 class="cph">Closest to your ${it.meas.src==='closeup'?'close-up':'photo'}</h4><div class="cpgrid cpnear">${near.map(x=>tile(x.c,`<small class="cpd">${dWord(x.d)}</small>`)).join('')}</div>`:''}
${k==='primaryColor'||k==='dial'||acc?'':`<div class="cpgrid">${tile('none')}</div>`}${groups}${newH}
<div class="cpbar">${acc?`<button type="button" class="pri" id="acc-use" data-act="cpUseTap"${sel?'':' disabled'}>${sel?esc('Add '+name(sel)):'Pick a color'}</button>`:`<button type="button" class="pri" data-act="cpUseTap">${esc(sel===NEW_COL?'Add '+name(sel)+' to your colors and use it':same?'Keep '+name(sel):'Use '+name(sel)+shName)}</button>`}</div>`;
  if(keep)el.scrollTop=y}
/* (a colour of your own by hand, "+ A colour of my own" at the end of the list, colOwn*, became the "+ New colour" sheet, 2026-11-15) */
/* ---- Ask Claude: the close-up (white-balanced), the sharp photo and the close-up's measurement go to the tagger again, the same
   request as an Add card's tagging from the close-up (refineFromCloseup) or the accuracy check (benchTagOne). The answer is kept
   in memory per item (colAsk, not saved or synced), so the other colour fields show it without asking again; Claude's pick for
   the field being edited is selected at once, so it lies beside the close-up. ---- */
const colAsk={};
const COL_FIELDS=it=>['primaryColor','secondaryColor','tertiaryColor'];   // (a sock's second and third are its pattern's since 2026-11-17; the toe cap is toeColor)
async function colAskImgs(it,src){
  if(src==='q'&&it.raw&&it.raw.tex){measureCard(it);return {img:it.tagImg||it.photo||it.texture,closeup:await closeTagImg(it),measured:measHint(it.meas)}}
  let measured;try{const c=await imgOf(it.texture),cv=document.createElement('canvas');cv.width=c.naturalWidth;cv.height=c.naturalHeight;cv.getContext('2d').drawImage(c,0,0);
    const r=closeRead(cv),m=Object.assign(measureCloth(cv,null,r.ref?{gains:r.gains,refLum:r.refLum}:{}),{src:'closeup'});m.near=nearestCols(it.type,m.lab,m.ref,{kL:measKL(m),skip:it.id});
    m.parts=measureParts(it,m);if(m.parts)m.groundNear=nearestCols(it.type,m.parts[0].lab,m.ref,{kL:measKL(m),skip:it.id});measured=measHint(m)}catch(e){}
  const sharp=src==='e'?await tagImgOf(it.id,it):null;
  return {img:sharp||it.tagImg||it.photo||it.texture,closeup:await sharpCloseOf(it),measured}}
async function colAskRun(){const it=colTarget();if(!it||!it.texture)return;if(!isConnected()){tell(NEED_CONN);return}
  // one of Claude's own readings per request: asked for both, the answer's schema is more than the API compiles ("compiled grammar
  // is too large", found on the live worker 2026-11-13), so a colour sheet asks for its colours and the pattern sheet for its pattern
  const src=colPick.src,pat=colPick.k==='pattern',key=it.id+(pat?'|p':'|c');colAsk[key]={busy:true};renderColPick(true);let ai=null;const out={};
  try{const x=await colAskImgs(it,src);ai=await ask(x.img,{closeup:x.closeup,measured:x.measured,skipId:it.id,freeColors:!pat,freePattern:pat,forType:it.type,out})}catch(e){console.warn('color ask failed',e)}   // forType: fitted to this item's type (CR-2-04); out: this call's own reason (CR-2-07)
  colAsk[key]=ai&&ai.type?{primaryColor:ai.primaryColor,secondaryColor:ai.secondaryColor||'none',tertiaryColor:ai.tertiaryColor||'none',altColor:ai.altColor,conf:ai.conf,newColor:ai.newColor,own:ai.ownColors||null,
      pattern:normPat(it.type,ai.pattern),altPattern:ai.altPattern?normPat(it.type,ai.altPattern):null,newPattern:ai.newPattern,ownPattern:ai.ownPattern||null}
    :{err:(out.err&&out.err.note)||(pat?'Claude couldn’t read the pattern this time.':'Claude couldn’t read the colors this time.')};
  if(!colPick||colTarget()!==it)return;   // closed meanwhile: the answer shows when it is opened again
  const v=colAsk[key][colPick.k];if(colPick.k==='pattern'?v&&patChoices(it).includes(v):v&&(v==='none'||COLORS[v]))colPick.sel=v;renderColPick(true)}
/* a colour Claude named that the app doesn't have (ownColors, asked with freeColors): offered as a "New" chip in the shade Claude
   gave; using it adds it to the owner's colours (addCustomColor, synced) for this kind of item, behaving like the nearest built-in
   colour, an accent colour too when it is a second or third colour. Not offered when the name is already a colour (a built-in's
   name, or the owner's own under the same key) or the shade can't be told from the listed pick (ΔE00 under 2). */
const NEW_COL='+new';
/* is a name already a colour's, built-in or the owner's, as shown or as its key ("Navy", "light blue", "Very dark navy")? Letters only, any
   case: an own colour named "Navy" in pink was accepted beside the built-in navy (2026-11-15, the new-user audit) */
const colLetters=t=>ownKeyNorm(t).replace(/[^\p{L}\p{N}]/gu,'');   // letters and digits of any script (fix round 3: an Arabic own name was '')
/* a grey spelled another way ("Gray", "Dark gray", "Light gray", "Mid gray", "Pale grey": COL_ALIAS's greys) is taken too (2026-11-15, the
   re-audit: "Gray" in pink was accepted beside Grey); other aliases ("Cognac", "Teal") stay free for a shade of one's own */
const colNameTaken=name=>{const n=colLetters(name),g=n.replace(/gray/g,'grey');if(!n)return false;
  if(/grey/.test(g)&&(COLORS[g]||COL_ALIAS[n]||COL_ALIAS[g]))return true;
  return Object.keys(COLORS).some(c=>colLetters(c)===n||colLetters(c)===g||colLetters(colName(c))===n||colLetters(colName(c))===g)};   // (an own colour by its name: a key taken by another name gets a free one, ownFreeKey)
function colNewFor(it,k){const a=it&&colAsk[it.id+'|c'],o=a&&a.own&&a.own[k];if(!o||!o.name||ownNameShort(o.name))return null;
  if(ownColFind(o.name)||Object.keys(COLORS).some(c=>colName(c).toLowerCase()===o.name||c===o.name.replace(/\s/g,'')))return null;
  if(a[k]&&COLORS[a[k]]&&dE00(rgbLab(...hexRgb(o.hex)),labOf(a[k]))<2)return null;
  return o}
async function colAddNew(it,k,nc){if(!nc)throw new Error('Ask Claude again: its color was not kept.');const key=ownColFind(nc.name);
  if(!key){const n=cap1(ownNameClean(nc.name,24)),added=await addCustomColor({name:n,hex:nc.hex,base:colBaseFor(nc.hex,it.type,k!=='primaryColor'),types:groupOf(it.type),accent:k!=='primaryColor'});toast(`${n} added to your colors.`);return added}
  return key}
/* what "Use all" sets in each colour field: Claude's own colour where the app doesn't have it yet (a New chip; colNewFor), else
   its listed pick; null = none */
const colAllOf=(it,a)=>Object.fromEntries(COL_FIELDS(it).map(f=>{const nc=colNewFor(it,f),o=a.own&&a.own[f],had=o&&o.name?ownColFind(o.name):null;   // (added already: the owner's own colour of that name)
  return [f,nc?{nc}:had||(a[f]==='none'||!a[f]?null:a[f])]}));
const colAllDiff=(it,a)=>{const w=colAllOf(it,a);return COL_FIELDS(it).filter(f=>w[f]&&w[f].nc||w[f]!==((f==='primaryColor'?primaryCol(it):it[f])||null))};
/* take every colour Claude named at once, its own new ones too (each added to the owner's colours, as when its chip is picked) */
async function colAskUseAll(){const it=colTarget(),a=it&&colAsk[it.id+'|c'];if(!a||!a.primaryColor)return;const {src,ref}=colPick,w=colAllOf(it,a);
  try{for(const f of COL_FIELDS(it))if(w[f]&&w[f].nc)w[f]=await colAddNew(it,f,w[f].nc)}catch(e){toast(e.message||'That could not be added.');return}
  closeColPick();
  const ch=COL_FIELDS(it).filter(f=>w[f]!==((f==='primaryColor'?primaryCol(it):it[f])||null));if(!ch.length)return;
  const offs=[];for(const f of ch)if(w[f]&&CUSTOM_COL[w[f]]){const o=await ownColOffer(w[f],it.type,f!=='primaryColor');if(o)offs.push(o.msg)}   // an own colour of another kind: offered for this one too
  if(src==='q'){for(const f of ch)setq(ref,f,w[f]||'none');if(offs.length)toast(offs.join(' '),4000);return}
  for(const f of ch)it[f]=w[f];delete it.color;
  if(ch.includes('primaryColor')&&it.swSrc==='tex')await refreshSwatch(it);await put(it);planDirty();renderWardrobe();toast(['Saved Claude’s colors.',...offs].join(' '),offs.length?4000:2500)}
/* "Not sure? Add a close-up": in the item sheet the close-up is added from Pictures, the last section (folded; the checklist redesign
   moved the photos there, so "under the photos" pointed nowhere: picker audit 2026-11-17 #3); the link closes the picker, opens
   Pictures and brings its Close-up button into view. On the Add card the close-up button is on the card itself. */
function cpAskHint(what){const e=colPick&&colPick.src==='e'&&$('#item-view.on .ivpics .pt-closeup');
  return `<div class="cpask cpaskhint"><div class="cpasktx"><b>Not sure?</b> <small>${e?`Add a close-up in <button type="button" class="linkbtn cpgopics" data-act="cpPicsTap">Pictures, at the bottom</button>`:'Add a close-up'} and Claude can ${what}.</small></div></div>`}
function cpGoPics(){closeColPick();const s=$('#item-view.on .ivpics');if(!s)return;const h=s.querySelector('.ckh');if(h&&!s.classList.contains('open'))ckToggle(h,true);
  const b=s.querySelector('.pt-closeup')||s;try{b.scrollIntoView({block:'center',behavior:'smooth'})}catch{b.scrollIntoView()}try{(s.querySelector('button.pt-closeup')||s.querySelector('.pt-closeup input')||h).focus({preventScroll:true})}catch{}}
function colAskHtml(it,k,tile,name){const a=colAsk[it.id+'|c'];
  if(!it.texture&&!TEXTURE_TYPES.includes(it.type))return '';   // shoes, belts, watches, socks, coats, clips, links have no close-up: no dead-end hint (2026-11-15)
  if(!it.texture)return cpAskHint('read the colors');
  if(!a){const cents=Math.max(1,Math.round(benchEstimate(1)*100)),on=isConnected();
    return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>${on?`Claude looks at the close-up again and says which colors it is. About ${cents}¢.`:NEED_CONN}</small></div><button type="button" class="cpaskbtn" data-act="cpAskTap"${on?'':' disabled'}>Ask Claude</button></div>`}
  if(a.busy)return `<div class="cpask"><span class="spin" aria-hidden="true"></span><div class="cpasktx"><b>Claude is looking at the close-up…</b><small>This takes a few seconds.</small></div></div>`;
  if(a.err)return `<div class="cpask"><div class="cpasktx"><b>Claude couldn’t answer</b><small>${esc(a.err)}</small></div><button type="button" class="cpaskbtn" data-act="cpAskTap">Try again</button></div>`;
  const cf=a.conf&&a.conf.primaryColor,fs=COL_FIELDS(it);
  // in Claude's own words where it gave them ("mushroom"), else the listed names
  const said=fs.map(f=>a.own&&a.own[f]?a.own[f].name:a[f]&&a[f]!=='none'?colName(a[f]):null).filter(Boolean).map(s=>`<b>${esc(cap1(s))}</b>`);
  const nc=colNewFor(it,k),pick=[a[k]].concat(k==='primaryColor'&&a.altColor&&a.altColor!==a[k]?[a.altColor]:[]).filter(c=>c==='none'||COLORS[c]);
  // Claude's own name is one of the owner's colours (made for another kind, say: its listed pick is then only the nearest built-in): that one first
  const ow=a.own&&a.own[k]&&a.own[k].name?ownColFind(a.own[k].name):null,had=ow&&COLORS[ow]&&!pick.includes(ow)?ow:null;
  const tiles=(nc?[tile(NEW_COL,`<small class="cpd cpaid">New · Claude’s exact</small>`)]:had?[tile(had,`<small class="cpd cpaid">Your color</small>`)]:[]).concat(pick.map((c,j)=>tile(c,`<small class="cpd cpaid">${j?'Claude’s 2nd':nc?'Closest you have':'Claude’s pick'}</small>`)));
  // more than one colour named: one tap takes them all (offered while any field would change, the one open included)
  const all=said.length>1&&colAllDiff(it,a).length>0;
  return `<div class="cpask done"><div class="cpasktx"><b>Claude reads it as ${said.length>1?said.slice(0,-1).join(', ')+' and '+said[said.length-1]:said[0]}</b>${cf&&k==='primaryColor'?`<small>${cap1(cf)} confidence on the main color.</small>`:''}${a.newColor?`<small>None of the listed colors quite fit: Claude calls it ${esc(a.newColor.name)}${a.newColor.why?`, ${esc(a.newColor.why)}`:''}.</small>`:''}</div>
${nc?`<small class="cpnewtx">${esc(cap1(nc.name))} isn’t one of your colors yet: pick it and it is added to the app (it then behaves like ${esc(colName(colBaseFor(nc.hex,it.type,k!=='primaryColor')))} in your outfits).</small>`:''}
<div class="cpgrid cpai">${tiles.join('')}</div>
<div class="cpaskbtns">${all?`<button type="button" class="cpaskbtn cpall" data-act="cpAskAllTap">${said.length===2?'Use both colors':`Use all ${said.length} colors`}</button>`:''}<button type="button" class="cpaskbtn ghost" data-act="cpAskTap">Ask again</button></div></div>`}
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
const patBtn=(src,ref,it)=>{const p=normPat(it.type,it.pattern);
  return `<button type="button" class="colbtn patbtn" data-k="pattern" data-act="colBtnTap" data-src="${src}" data-ref="${esc(String(ref))}" aria-haspopup="dialog" aria-label="Pattern: ${esc(patTitle(p))}"><span class="colchip patchip">${swatchSVG(patVar(it,p),true)}</span><span class="colnm">${esc(patTitle(p))}</span><svg class="colchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`};
const EP=(id,it)=>`<label class="colrow">Pattern ${patBtn('e',id,it)}</label>`;
const PAT_GROUPS=[[['solid'],'Plain'],[['pinstripe','chalk-stripe','stripe','fine-stripe'],'Stripes'],[['glen-check','windowpane','check','gingham','tattersall','tonal-check','houndstooth'],'Checks'],
  [['herringbone','birdseye','nailhead','sharkskin','twill','tweed','oxford','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture','knit','ribbed'],'Weaves'],[['polka-dot','paisley','foulard','camouflage','argyle','clock'],'Figures']];   // (a sock's ribbed knit, argyle and clock, 2026-11-17)
const patGroupOf=p=>{const b=patBase(p);const g=PAT_GROUPS.findIndex(([l])=>l.includes(b));return g<0?PAT_GROUPS.length:g};
function patNewFor(it){const a=it&&colAsk[it.id+'|p'],o=a&&a.ownPattern;if(!o||o.fits||!o.name||ownNameShort(o.name))return null;
  if(ownPatFind(o.name)||patNameTaken(o.name)||Object.values(PATS_BY).some(l=>l.some(p=>patName(p).toLowerCase()===o.name)))return null;
  return o}
const patNewBase=it=>{const a=colAsk[it.id+'|p'];const b=a&&a.pattern?patBase(a.pattern):'solid';return (PATS_BY[it.type]||[]).includes(b)?b:'solid'};
async function patAddNew(it,o){if(!o)throw new Error('Ask Claude again: its pattern was not kept.');const key=ownPatFind(o.name);
  if(!key){const g=['suit','blazer','pants'].includes(it.type)?['suit','blazer','pants']:[it.type],n=cap1(ownNameClean(o.name,24));
    const added=await addCustomPattern({name:n,desc:o.description||'',base:patNewBase(it),types:g});toast(`${n} added to your patterns.`);return added}
  return key}
/* without a photo the left side is the item drawn in the pattern being looked at (its shape: a tie, a jacket's panel), beside the large swatch */
function renderPatPick(keep){const el=$('#col-sheet'),it=colTarget();if(!el||!it)return;const {sel,cur,view}=colPick,y=el.scrollTop;
  const photo=it.photo||wardPic(it),pic=view==='draw'?null:view==='tex'?it.texture:photo,vs=cpViews(it,photo);
  const np=patNewFor(it),drawAs=p=>p===NEW_COL?patNewBase(it):p,name=p=>p===NEW_COL?cap1(np?np.name:''):patTitle(p);
  const tile=(p,extra='')=>`<button type="button" class="cptile${p===sel?' sel':''}" data-c="${p}" data-act="cpTileTap" aria-pressed="${p===sel}"><span class="cpsw cppat">${swatchSVG(patVar(it,drawAs(p)),true)}${p===cur?'<i class="cpnow" aria-hidden="true">Now</i>':''}</span><span class="cpnm">${esc(name(p))}</span>${p===cur?'<span class="vh">, now</span>':''}${extra}</button>`;
  // the Look beta (look.js): its groups (heather with the plain ones, the knits together, a border with the figures), Suggested first, no
  // Ask Claude (Read with Claude is in the Look section), "+ New pattern or texture" at the end
  const L=lookOn(),PG=L?LOOK_PAT_GROUPS:PAT_GROUPS,pgOf=L?lookPatGroupOf:patGroupOf;
  const gs=[...PG.map(()=>[]),[]];for(const p of patChoices(it))gs[pgOf(p)].push(p);
  const groups=gs.map((l,g)=>l.length?`<h4 class="cph">${g<PG.length?PG[g][1]:'Other'}</h4><div class="cpgrid">${l.map(p=>tile(p)).join('')}</div>`:'').join('');
  const what=view==='tex'?'Your close-up':'Your photo';
  const mine=patChoices(it).filter(p=>CUSTOM_PAT[p]),   // (as the colors: W2-14-02)
    ownH=L?`<h4 class="cph">Yours</h4>${mine.length?`<div class="cpgrid cnown">${mine.map(p=>tile(p)).join('')}</div>`:'<p class="cphelp lkyours">Patterns you add show here first. “+ New pattern” is at the end.</p>'}`
      :mine.length?`<h4 class="cph">Your patterns</h4><div class="cpgrid cnown">${mine.map(p=>tile(p)).join('')}<button type="button" class="cptile cpnewt" id="pn-open" data-act="pnOpenTap"><span class="cpsw" aria-hidden="true">+</span><span class="cpnm">New pattern or texture</span></button></div>`
      :`<h4 class="cph cpownh">Your patterns</h4><div class="cpgrid cnown cnslim"><button type="button" class="cpnewl" id="pn-open" data-act="pnOpenTap"><span aria-hidden="true">+</span> New pattern or texture</button></div>`;
  const sug=L?lookSugPats(it):[],sugH=sug.length?`<h4 class="cph">Suggested</h4><div class="cpgrid cpsug">${sug.map(([p,l])=>tile(p,`<small class="cpd cpaid">${esc(l)}</small>`)).join('')}</div>`:'',
    newH=L?`<h4 class="cph">New</h4><div class="cpgrid"><button type="button" class="cptile cpnewt" id="pn-open" data-act="lkNewPat"><span class="cpsw" aria-hidden="true">+</span><span class="cpnm">New pattern or texture</span></button></div>`:'';
  el.innerHTML=`<div class="cptop">${SW_GRAB}<div class="pick-head"><b id="col-title">Choose the pattern</b><button class="pick-x" data-act="cpCloseTap" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${pic?`<img src="${srcOk(pic)}" alt="${what}">`:`<div class="cpdraw">${itemThumb(patVar(it,drawAs(sel)))}</div>`}<figcaption>${pic?what:'As drawn'}</figcaption></figure><figure class="cpbig cppatbig"><div class="cpdraw">${itemThumb(patVar(it,drawAs(sel)),true)}</div><figcaption>${esc(name(sel))}</figcaption></figure></div>
${cpSeg(vs,view)}</div>
${L?'':patAskHtml(it,tile,name,np)}
<p class="cphelp">Tap a pattern to see it drawn in your item’s colors beside your ${pic?view==='tex'?'close-up':'photo':'item'}.</p>
${sugH}${ownH}${groups}${newH}
<div class="cpbar"><button type="button" class="pri" data-act="cpUseTap">${sel===NEW_COL?'Add '+esc(name(sel))+' to your patterns and use it':sel===cur?'Keep '+esc(name(sel)):'Use '+esc(name(sel))}</button></div>`;
  if(keep)el.scrollTop=y}
function patAskHtml(it,tile,name,np){const a=colAsk[it.id+'|p'];
  if(!it.texture&&!TEXTURE_TYPES.includes(it.type))return '';   // socks, pocket squares and the casual types have no close-up: no dead-end hint (as the colors, picker audit 2026-11-17 #2)
  if(!it.texture)return cpAskHint('name the pattern');
  if(!a){const cents=Math.max(1,Math.round(benchEstimate(1)*100)),on=isConnected();
    return `<div class="cpask"><div class="cpasktx"><b>Not sure? Ask Claude</b><small>${on?`Claude looks at the close-up and names the pattern, even one the app doesn’t have yet. About ${cents}¢.`:NEED_CONN}</small></div><button type="button" class="cpaskbtn" data-act="cpAskTap"${on?'':' disabled'}>Ask Claude</button></div>`}
  if(a.busy)return `<div class="cpask"><span class="spin" aria-hidden="true"></span><div class="cpasktx"><b>Claude is looking at the close-up…</b><small>This takes a few seconds.</small></div></div>`;
  if(a.err)return `<div class="cpask"><div class="cpasktx"><b>Claude couldn’t answer</b><small>${esc(a.err)}</small></div><button type="button" class="cpaskbtn" data-act="cpAskTap">Try again</button></div>`;
  const o=a.ownPattern,cf=a.conf&&a.conf.pattern,ch=patChoices(it);
  const pick=[a.pattern].concat(a.altPattern&&a.altPattern!==a.pattern?[a.altPattern]:[]).filter(p=>p&&ch.includes(p));
  const tiles=(np?[tile(NEW_COL,`<small class="cpd cpaid">New · Claude’s name</small>`)]:[]).concat(pick.map((p,j)=>tile(p,`<small class="cpd cpaid">${j?'Claude’s 2nd':np?'Closest you have':'Claude’s pick'}</small>`)));
  return `<div class="cpask done"><div class="cpasktx"><b>Claude sees ${esc(o?o.name:patName(a.pattern))}</b>${o&&o.description?`<small>${esc(o.description)}</small>`:''}${cf?`<small>${cap1(cf)} confidence.</small>`:''}</div>
${np?`<small class="cpnewtx">${esc(cap1(np.name))} isn’t one of your patterns yet: pick it and it is added to the app (drawn and planned like ${esc(patName(patNewBase(it)))}; your close-up shows the real thing).</small>`:''}
<div class="cpgrid cpai">${tiles.join('')}</div>
<div class="cpaskbtns"><button type="button" class="cpaskbtn ghost" data-act="cpAskTap">Ask again</button></div></div>`}
/* ---- "+ New colour" and "+ New pattern or texture" (2026-11-15, the owner's approved design in C:\code\audit-2026-11-13\custom-colour-texture):
   states of this sheet (colPick.newc = {kind 'colour'|'pattern', from 'pick'|'add'|'settings', hex, h/s/v, name, desc, state, res, base,
   types, accent, look, closeOn, err}), drawn into #col-sheet with ‹ back to the list. "Describe it to Claude" posts to the worker's
   /describe (describeAsk; its answer fills the shade, the name, what it behaves like, and for a pattern its drawing recipe, the look);
   "Pick the shade" is a square and a hue bar with a hex field (all three in step); "Add … and use it" adds it to the owner's colours or
   patterns (addCustomColor / addCustomPattern: settings.custom, synced; testers' own too) and sets the field as a pick does. Opened from
   the "Your colours" / "Your patterns" tile of the picker, from the Add card's offer (Claude's newColor / newPattern, a colour measured
   far from every listed one: openColForm / openPatForm, own-lists.js) and from Settings (openCustomNew: no item, a "For" choice). ---- */
const CN_SAMPLE={suit:'navy',blazer:'navy',pants:'charcoal',shirt:'white',tie:'navy',socks:'navy',shoes:'brown',belt:'brown',overcoat:'charcoal',raincoat:'khaki',pocketsquare:'white',tee:'white',polo:'navy',henley:'cream',sweater:'navy',sweatshirt:'grey',hoodie:'grey',qzip:'navy',cardigan:'charcoal',chore:'navy',blouse:'khaki',tieclip:'silver',cufflinks:'silver',watch:'brown'};
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
  colPick.newc={kind:'colour',from:o.from||'pick',hex,h,s,v,name:o.name?cap1(o.name):'',desc:o.desc||'',state:'idle',res:null,base:null,types:groupOf(it.type),accent,err:'',closeOn:false,closeSet:false};
  cnPaperDefault(colPick.newc);renderColPick();const el=$('#col-sheet');if(el)el.scrollTop=0;const b=$('#col-sheet .cnback');if(b)b.focus({preventScroll:true})}
/* white paper in the close-up (2026-11-15, photo-wb-mockups 07-10): the colour sheet's "Also show Claude my close-up" starts ticked when the
   close-up has white paper and unticked when not (until the owner taps it: closeSet); the paper line under both sheets' boxes */
const cnHasClose=it=>!!(colPick&&colPick.src!=='s'&&it&&it.texture);
function cnPaperDefault(nc){const it=colTarget();if(!cnHasClose(it))return;const set=r=>{if(!nc.closeSet&&nc.kind==='colour')nc.closeOn=!!(r&&r.ref)};const r=paperNow(it);
  if(r){set(r);return}paperOf(it).then(r=>{if(!colPick||colPick.newc!==nc||!r)return;set(r);renderColPick(true)})}
function cnToggleClose(){const nc=colPick&&colPick.newc;if(!nc)return;nc.closeOn=!nc.closeOn;nc.closeSet=true;renderColPick(true)}
const cnRetakeHtml=()=>colPick&&colPick.src==='e'?' '+closeupBtn({label:'Retake close-up',cls:'linkbtn wbretake',mode:'retake',act:' data-act-change="cnRetakeFile"',cloth:paperCloth(colTarget()||{})}):'';   // the close-up chooser on a touch screen (ui.js)
async function cnRetake(f){const nc=colPick&&colPick.newc;if(!nc||colPick.src!=='e'||!f)return;const id=colPick.ref;await replaceTexture(id,f);
  if(!colPick||colPick.newc!==nc)return;nc.closeSet=false;await paperOf(colTarget());if(!colPick||colPick.newc!==nc)return;cnPaperDefault(nc);renderColPick(true)}
function cnPaperLine(kind){const it=colTarget();if(!cnHasClose(it))return '';const r=paperNow(it);if(!r)return '';
  const ok=t=>`<p class="wbst ok" id="cn-paper"><span class="ic" aria-hidden="true">✓</span><span class="tx">${t}</span></p>`,no=t=>`<p class="wbst no" id="cn-paper"><span class="ic" aria-hidden="true">!</span><span class="tx">${t}</span></p>`;
  if(kind==='pattern')return r.ref?ok('White paper found: Claude sees the true colors.'):no('No white paper: the weave reads fine, the colors may be off.');
  return r.ref?ok('White paper found: Claude sees the true color.'):no((r.warm?'No white paper, and the light looks warm: Claude may see it yellower.':'No white paper in this close-up: the color may be off.')+cnRetakeHtml())}
/* on Claude's colour: what the light did to the close-up it was shown (nc.sent, set when asked) */
function cnLightNote(nc){const s=nc.sent;if(!s||s.wb!==false)return '';
  return s.warm?`<div class="cnwarm" id="cn-warm" role="note"><span aria-hidden="true">☀︎</span><span>Taken in warm light — the color may be yellower than the cloth; add white paper for a truer color.${cnRetakeHtml()?'<br>'+cnRetakeHtml():''}</span></div>`
    :`<p class="cnwhy cnnopaper" id="cn-warm">No white paper in the close-up, so this shade is Claude’s best guess from the photo as taken.</p>`}
function openPatNew(o={}){if(!colPick)return;const it=colTarget();if(!it)return;
  colPick.newc={kind:'pattern',from:o.from||'pick',name:o.name?cap1(o.name):'',desc:o.desc||'',state:'idle',res:null,base:o.base||null,look:null,types:CN_SUITING.includes(it.type)?CN_SUITING.slice():[it.type],closeOn:false,err:''};
  cnPaperDefault(colPick.newc);renderColPick();const el=$('#col-sheet');if(el)el.scrollTop=0;const b=$('#col-sheet .cnback');if(b)b.focus({preventScroll:true})}
/* Settings → Your colours & patterns: the sheet with no item, a "For" choice in its place */
function openCustomNew(kind){const t=kind==='pattern'?'suit':'tie';
  colPick={src:'s',ref:null,k:kind==='pattern'?'pattern':'primaryColor',fake:{id:'_cn',type:t,primaryColor:CN_SAMPLE[t],pattern:'solid'},cur:'none',sel:'none',view:'draw'};
  $('#col-sheet').classList.add('on');$('#col-backdrop').classList.add('on');colSwipe();kind==='pattern'?openPatNew({from:'settings'}):openColNew({from:'settings',hex:'#7a3b47'})}
function cnSetType(t){const nc=colPick&&colPick.newc;if(!nc||colPick.src!=='s')return;const f=colPick.fake;f.type=t;f.primaryColor=CN_SAMPLE[t]||'navy';f.pattern='solid';
  nc.types=nc.kind==='pattern'?(CN_SUITING.includes(t)?CN_SUITING.slice():[t]):groupOf(t);nc.base=null;renderColPick(true)}
function colNewBack(){const nc=colPick&&colPick.newc;if(!nc)return;if(nc.from==='pick'){colPick.newc=null;renderColPick();const el=$('#col-sheet');if(el)el.scrollTop=0}else closeColPick()}
/* the shade picked by hand: the square (saturation across, brightness down), the hue bar and the hex field, kept in step; while a finger
   moves only the thumbs, the swatches, the field and the drawn item change (cnLive, cnFigLive), and the sheet is drawn again when it lifts */
/* the drawn item follows the finger and the hex being typed (the owner's ask, 2026-11-15): only the figure is redrawn, at most once a
   frame (requestAnimationFrame); about 3-4 ms in Chromium at 4× CPU throttling, 1 ms in WebKit (tests/colnew.test.js) */
let cnFigRaf=0;
function cnFigLive(){if(cnFigRaf)return;cnFigRaf=requestAnimationFrame(()=>{cnFigRaf=0;const nc=colPick&&colPick.newc,it=nc&&nc.kind==='colour'&&colTarget();
  const d=it&&document.querySelector('#col-sheet .cpph.cpfig .cpdraw');if(!d||d.dataset.hex===nc.hex)return;d.dataset.hex=nc.hex;d.innerHTML=cnDrawn(it,nc.hex,colPick.src==='s'?'primaryColor':colPick.k)})}
function cnLive(){const nc=colPick&&colPick.newc;if(!nc)return;const hx=nc.hex,q=s=>document.querySelector('#col-sheet '+s);
  const sq=q('#cn-sq'),th=q('#cn-sq .cnthumb'),hu=q('#cn-hue i'),hi=q('#cn-hex'),big=q('.cpbig');
  if(sq){sq.style.setProperty('--h',Math.round(nc.h));sq.setAttribute('aria-valuetext',hx.toUpperCase())}if(th){th.style.left=nc.s.toFixed(1)+'%';th.style.top=(100-nc.v).toFixed(1)+'%';th.style.background=hx}
  if(hu){hu.style.left=(nc.h/360*100).toFixed(1)+'%';hu.style.background=`hsl(${Math.round(nc.h)},100%,50%)`;hu.parentNode.setAttribute('aria-valuenow',Math.round(nc.h))}
  if(hi&&document.activeElement!==hi)hi.value=hx.toUpperCase();document.querySelectorAll('#col-sheet [data-cnsw]').forEach(e=>{e.style.background=hx});
  if(big){big.style.background=hx;const c=big.querySelector('figcaption');if(c&&!nc.name.trim())c.textContent=hx.toUpperCase()}cnFigLive()}
function cnSetHsv(h,s,v,redraw){const nc=colPick&&colPick.newc;if(!nc)return;nc.h=Math.max(0,Math.min(359.9,h));nc.s=Math.max(0,Math.min(100,s));nc.v=Math.max(0,Math.min(100,v));nc.hex=cnFromHsv(nc.h,nc.s,nc.v);cnLive();if(redraw){cancelAnimationFrame(cnFigRaf);cnFigRaf=0;renderColPick(true)}}
function cnDrag(e,el,at){e.preventDefault();const a=document.activeElement;if(a&&a.id==='cn-hex')a.blur();   // (preventDefault keeps the focus where it was: a hex being typed is left, so it follows the finger)
try{el.setPointerCapture(e.pointerId)}catch(x){}const r=el.getBoundingClientRect(),mv=ev=>at((ev.clientX-r.left)/r.width,(ev.clientY-r.top)/r.height,false);mv(e);
  const up=ev=>{el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);at((ev.clientX-r.left)/r.width,(ev.clientY-r.top)/r.height,true)};
  el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)}
/* (the square's and the hue bar's handlers, act.js: el is the slider, e the event) */
function cnSqPress(el,e){const nc=colPick&&colPick.newc;if(!nc)return;cnDrag(e,el,(x,y,end)=>cnSetHsv(nc.h,Math.max(0,Math.min(1,x))*100,(1-Math.max(0,Math.min(1,y)))*100,end))}
function cnHuePress(el,e){const nc=colPick&&colPick.newc;if(!nc)return;cnDrag(e,el,(x,y,end)=>cnSetHsv(Math.max(0,Math.min(1,x))*359.9,nc.s,nc.v,end))}
function cnSqKey(el,e){const nc=colPick&&colPick.newc,d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!nc||!d)return;e.preventDefault();e.stopPropagation();cnSetHsv(nc.h,nc.s+d[0],nc.v+d[1],false)}
function cnHueKey(el,e){const nc=colPick&&colPick.newc,d={ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1}[e.key];if(!nc||!d)return;e.preventDefault();e.stopPropagation();cnSetHsv(nc.h+d,nc.s,nc.v,false)}
function cnSlideUp(el,e){if(!/^Arrow/.test(e.key))return;renderColPick(true);const n=document.getElementById(el.id);if(n)n.focus({preventScroll:true})}
/* done 'blur' (the hex field's change, when it loses the focus): updated in place, never by drawing the sheet again. The Name and hex fields
   redrew the whole sheet on change, i.e. on the blur a tap elsewhere causes, between the finger going down and the click: the button under
   the finger ("Add … and use it") was replaced and the first tap did nothing (picker audit 2026-11-17 #1) */
/* (on 'blur' the shade itself was already taken as it was typed, oninput: a change that arrives later, after the square was dragged
   with the field still focused, mustn't put the typed shade back) */
function cnHexIn(v,done){const nc=colPick&&colPick.newc;if(!nc)return;
  if(done==='blur'){const f=$('#cn-hex');if(f)f.value=nc.hex.toUpperCase();cnLive();cnBaseLive();return}
  const h=cnHex(v.startsWith('#')?v:'#'+v);if(!h)return;nc.hex=h;[nc.h,nc.s,nc.v]=cnHsv(h);if(done)renderColPick(true);else cnLive()}
/* "Behaves like" follows the shade (cnColBase) while the owner hasn't chosen it */
function cnBaseLive(){const nc=colPick&&colPick.newc,it=colTarget(),s=$('#cn-base');if(!nc||!it||!s||nc.kind!=='colour')return;const b=cnColBase(it,nc);
  if(![...s.options].some(o=>o.value===b)){const o=document.createElement('option');o.value=b;o.textContent=cap1(colName(b));s.append(o)}s.value=b}
/* the name as it is typed: the button, the big swatch's caption, "Add … anyway" and (a color) "How the app uses it", all in place:
   nothing redraws the sheet, so a tap on Add straight from the field works the first time */
function cnName(v){const nc=colPick&&colPick.newc;if(!nc)return;nc.name=v;const n=cap1(v.trim()),b=$('#cn-add');if(b&&!b.dataset.use){b.disabled=!n;b.textContent=n?`Add ${n}${colPick.src==='s'?'':' and use it'}`:nc.kind==='pattern'?'Add pattern':'Add color'}
  const c=document.querySelector('#col-sheet .cpbig figcaption');if(c)c.textContent=n||(nc.kind==='pattern'?'Not set yet':nc.hex.toUpperCase());
  if(nc.kind!=='colour')return;const a=$('#cn-anyway');if(a){a.disabled=!n;a.textContent=`Add ${n||'it'} anyway`}
  const how=$('#cn-how');if(how)how.hidden=!(nc.res||n||colPick.src==='s')}
function cnToggleType(t){const nc=colPick&&colPick.newc;if(!nc)return;nc.types=nc.types.includes(t)?nc.types.filter(x=>x!==t):[...nc.types,t];renderColPick(true)}
/* ask Claude (POST /describe): the words, the item's kind and colours, the owner's own colours and patterns, the close-up when asked */
async function describeAsk(){const nc=colPick&&colPick.newc,it=colTarget();if(!nc||!it||nc.state==='busy')return;if(!isConnected()){tell(NEED_CONN);return}
  const ta=$('#cn-text');if(ta)nc.desc=ta.value;const text=String(nc.desc||'').replace(/[<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,CN_DESC_MAX);
  if(!text){nc.err='Describe it first, in a few words.';renderColPick(true);return}
  const pat=nc.kind==='pattern',body={what:pat?'pattern':'colour',text,type:it.type,field:!pat&&nc.accent?'accent':'primary',
    colours:{main:primaryCol(it),second:it.secondaryColor||null,third:it.tertiaryColor||null},pattern:normPat(it.type,it.pattern),custom:settings.custom||{}};
  nc.state='busy';nc.err='';renderColPick(true);
  // the close-up when ticked, white-balanced from its paper (wb true) or as taken (wb false); no close-up, no wb (paperCopy, measure.js)
  let sent=null;if(nc.closeOn&&cnHasClose(it)){const c=await paperCopy(it),r=paperNow(it);body.closeup=c.closeup;body.wb=c.wb;sent={wb:c.wb,warm:!c.wb&&!!(r&&r.warm)}}
  if(!colPick||colPick.newc!==nc)return;
  const w=localStorage.getItem('worker_url')||'';let r=null,j={};
  try{r=await fetch(new URL('describe',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':localStorage.getItem('app_token')||''},body:JSON.stringify(body)});j=await r.json().catch(()=>({}))}catch(e){r=null}
  if(!colPick||colPick.newc!==nc)return;   // closed meanwhile
  if(r&&r.ok&&acct&&acct.me&&acct.me.used)acct.me.used.describe=(+acct.me.used.describe||0)+1;
  if(r&&r.status===429){nc.state='limit';nc.limit=j.message||'Today’s color and pattern lookups are used up. They start again at midnight UTC.'}
  else if(!r||!r.ok){nc.state='err';nc.detail=showCost()&&(j.detail||j.message)||''}
  else if(pat?j.kind==='pattern':j.kind==='colour'||j.kind==='several'){nc.res=j;nc.base=null;nc.sent=sent;
    if(pat){nc.name=cap1(j.name||nc.name);nc.look=j.look&&j.look.layout&&j.look.layout!=='none'?j.look:null;nc.state=j.match==='existing'&&patChoices(it).includes(j.existing)&&j.existing!==NEW_COL?'reuse':'result'}
    else{nc.hex=cnHex(j.hex)||nc.hex;[nc.h,nc.s,nc.v]=cnHsv(nc.hex);nc.name=cap1(j.name||nc.name);nc.state=+j.dE<=3&&COLORS[j.existing]?'dup':'result'}}
  else{nc.state='kind';nc.answer=j.kind;nc.ask=j.ask||'';nc.res=null}
  renderColPick(true)}
/* "Describe it to Claude": the box, the cost or what is left, Ask; the limit and connection notes */
function cnAskBox(nc,kind,hint,ph){const on=isConnected(),busy=nc.state==='busy',l=!showCost()?cnLeft():null,spent=l&&l.left<=0;
  const lim=nc.state==='limit'||spent?`<div class="cnlim" role="status"><span aria-hidden="true">⏳</span><span><b>${esc(nc.state==='limit'?nc.limit:`Today’s limit of ${l.cap} color and pattern lookups is used up.`)}</b>${nc.state==='limit'?'':'It starts again at midnight UTC. '}You can still ${kind==='pattern'?'set it yourself':'pick the shade yourself'} below.</span></div>`:'';
  const close=cnHasClose(colTarget())?`<button type="button" class="cnchk" id="${kind==='pattern'?'pn':'cn'}-close" role="checkbox" aria-checked="${!!nc.closeOn}" data-act="cnCloseupTap"${busy?' disabled':''}><i class="${nc.closeOn?'on':''}" aria-hidden="true"></i><span>Also show Claude my close-up</span></button>${cnPaperLine(kind)}`:'';
  const row=busy?`<div class="cnaskrow" role="status"><span class="spin" aria-hidden="true"></span><small><b class="cnbusy">${kind==='pattern'?'Claude is working out the weave…':'Claude is finding the shade…'}</b><br>A few seconds.</small></div>`
    :`<div class="cnaskrow"><small id="cn-cost">${esc(cnCost(kind,!!nc.closeOn&&!!close))}</small><button type="button" class="cpaskbtn${nc.res?' ghost':''}" id="cn-ask" data-act="cnAskTap"${on&&nc.state!=='limit'&&!spent?'':' disabled'}>${nc.res?'Ask again':'Ask Claude'}</button></div>`;
  return `<div class="cpask cnask"><div class="cpasktx"><b>Describe it to Claude</b><small>${hint}</small></div>
<textarea class="cntext" id="cn-text" dir="auto" rows="2" maxlength="${CN_DESC_MAX}" aria-label="Describe it to Claude" placeholder="${ph}"${nc.state==='limit'||spent||busy?' disabled':''} data-act-input="cnDescType" data-act-keydown="cnDescKey">${esc(nc.desc||'')}</textarea>${close}${row}${lim}</div>`}
/* an answer that isn't what this sheet adds (a pattern described on the colour sheet, a material, unclear words) */
function cnKindCard(nc){const k=nc.answer,other=k==='pattern'&&nc.kind==='colour'?'patterns':k==='colour'&&nc.kind==='pattern'?'colors':'';
  const head=k==='pattern'?'That sounds like a pattern':k==='colour'?'That sounds like a color':k==='material'?'That sounds like a material':nc.kind==='pattern'?'That isn’t a pattern yet':'That isn’t a color yet';
  return `<div class="cnres warn" id="cn-kind"><div class="cpasktx"><b>${head}</b><small>${esc(nc.ask||'')}</small></div>${other&&colPick.src!=='s'?`<div class="cnbtns"><button type="button" class="cpaskbtn ghost" data-act="cnKindTap">Open ${other}</button></div>`:''}</div>`}
function cnSwitch(){const nc=colPick&&colPick.newc;if(!nc)return;const {src,ref}=colPick,desc=nc.desc;closeColPick();
  if(nc.kind==='colour'){openColPick(src,ref,'pattern');openPatNew({from:'add',desc})}else{openColPick(src,ref,'primaryColor');openColNew({from:'add',desc})}}
const cnErrCard=(nc,what)=>`<div class="cnres cnerr" id="cn-err"><div class="cpasktx"><b>Claude couldn’t answer</b><small>The ${what==='colour'?'color':what} couldn’t be looked up just now. Try again later, or ${what==='colour'?'pick the shade':'set it'} yourself below.${nc.detail?` (${esc(nc.detail)})`:''}</small></div><div class="cnbtns"><button type="button" class="cpaskbtn" data-act="cnAskTap">Try again</button></div></div>`;
function renderColNew(keep){const el=$('#col-sheet'),it=colTarget(),nc=colPick&&colPick.newc;if(!el||!it||!nc)return;const y=el.scrollTop,src=colPick.src,hex=nc.hex,r=nc.res;
  const ex=r&&r.existing&&COLORS[r.existing]?r.existing:null,exName=ex?cap1(colName(ex)):'',name=cap1(String(nc.name||'').trim());
  const prefer=ex&&(nc.state==='dup'||(nc.state==='result'&&+r.dE<=6&&r.match==='existing'))?'existing':'new',base=cnColBase(it,nc);
  const pic=src!=='s'&&colPick.k==='primaryColor'&&it.texture?it.texture:null;
  const fig=pic?`<img src="${srcOk(pic)}" alt="Your close-up">`:`<div class="cpdraw">${cnDrawn(it,hex,src==='s'?'primaryColor':colPick.k)}</div>`;
  let res='';
  if((nc.state==='result'||nc.state==='dup')&&r){const d=+r.dE||0;
    res=nc.state==='dup'?`<div class="cnres" id="cn-res"><div class="cnreshd"><span class="cnresw" style="background:${COLORS[ex]}"></span><span><span class="cneyebrow">You already have it</span><b>That’s your ${esc(colName(ex))}</b><small>${esc(cap1(r.name||'It'))} is ${d.toFixed(1)} ΔE from ${esc(colName(ex))}: ${cnDWord(d)}.</small></span></div>${cnLightNote(nc)}
${r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:''}<div class="cnbtns"><button type="button" class="cpaskbtn ghost" id="cn-anyway" data-act="cnAddTap"${name?'':' disabled'}>Add ${esc(name||'it')} anyway</button></div></div>`
    :`<div class="cnres" id="cn-res"><div class="cnreshd"><span class="cnresw" style="background:${r.hex}"></span><span><span class="cneyebrow">Claude’s color</span><b>${esc(cap1(r.name||'')||r.hex.toUpperCase())}</b><small>${r.hex.toUpperCase()} · ${esc(r.confidence||'medium')} confidence</small></span></div>
<ul class="cnfacts"><li><span>In outfits</span><span class="cnch" style="background:${COLORS[r.plansAs]||'transparent'}"></span><span>behaves like <b>${esc(colName(r.plansAs))}</b></span></li>
${ex?`<li><span>Nearest yours</span><span class="cnch" style="background:${COLORS[ex]}"></span><span>${esc(exName)}</span><span class="cnde">${cnDWord(d)} · ΔE ${d.toFixed(1)}</span></li>`:''}</ul>${cnLightNote(nc)}
${r.fitsType===false?`<p class="cnwhy">Unusual for ${esc((TYPES[it.type]||'this item').toLowerCase())}, but you can still add it.</p>`:''}${r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:''}${r.ask?`<p class="cnwhy">${esc(r.ask)}</p>`:''}
${ex?`<div class="cnbtns">${prefer==='existing'?`<button type="button" class="cpaskbtn ghost" id="cn-anyway" data-act="cnAddTap"${name?'':' disabled'}>Add ${esc(name||'it')} anyway</button>`:`<button type="button" class="cpaskbtn ghost" id="cn-use" data-act="cnUseOldTap">Use ${esc(exName)} instead</button>`}</div>`:''}</div>`}
  if(nc.state==='err')res=cnErrCard(nc,'colour');if(nc.state==='kind')res=cnKindCard(nc);
  const bases=[...new Set([...(src==='s'||COLS_BY[it.type]?colsFor(it.type,nc.accent):Object.keys(COLORS)).filter(c=>COLORS[c]&&!CUSTOM_COL[c]),base])];
  // (always drawn, hidden until there is a name: cnName shows it as one is typed, so the field's blur needn't redraw the sheet, 2026-11-17)
  const fold=`<div class="cnsec" id="cn-how"${r||name||src==='s'?'':' hidden'}><b>How the app uses it</b>
<label class="cnfld">Behaves like (for the outfit rules)<select id="cn-base" data-act-change="cnBasePick">${bases.map(c=>`<option value="${c}"${c===base?' selected':''}>${esc(cap1(colName(c)))}</option>`).join('')}</select></label>
<span class="cnnote">Outfits treat it like this color; drawings and pictures use its own shade.</span>
<div class="cnfld cnoffer">Offer it for<div class="cnchips">${groupOf(it.type).map(t=>`<button type="button" class="cnchip${nc.types.includes(t)?' on':''}" aria-pressed="${nc.types.includes(t)}" data-act="cnTypeTap" data-t="${t}">${esc(TYPES[t])}</button>`).join('')}</div></div>
<button type="button" class="cnsw" id="cn-accent" role="switch" aria-checked="${!!nc.accent}" data-act="cnAccentTap"><span>Also for stripes and motifs</span><i class="${nc.accent?'on':''}" aria-hidden="true"></i></button></div>`;
  const bar=prefer==='existing'?`<button type="button" class="pri" id="cn-add" data-use="1" data-act="cnUseOldTap">Use ${esc(exName)}</button>`
    :`<button type="button" class="pri" id="cn-add" data-act="cnAddTap"${name?'':' disabled'}>${name?`Add ${esc(name)}${src==='s'?'':' and use it'}`:'Add color'}</button>`;
  el.innerHTML=`<div class="cptop">${SW_GRAB}<div class="pick-head"><button type="button" class="cnback" data-act="cnBackTap" aria-label="${nc.from==='pick'?'Back to colors':'Close'}">‹</button><b id="col-title">New color</b><button class="pick-x" data-act="cpCloseTap" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${fig}<figcaption>${pic?'Your close-up':`Your ${esc((TYPES[it.type]||'item').toLowerCase())}, drawn`}</figcaption></figure><figure class="cpbig" style="background:${hex}"><figcaption>${esc(name||hex.toUpperCase())}</figcaption></figure></div></div>
${src==='s'?`<label class="cnfld cnfor">For<select id="cn-for" data-act-change="cnForPick">${Object.keys(COLS_BY).map(t=>`<option value="${t}"${t===it.type?' selected':''}>${esc(TYPES[t])}</option>`).join('')}</select></label>`:''}
${cnAskBox(nc,'colour','Say it as you’d tell a tailor. Claude finds the shade and checks it against your colors.','e.g. faded burgundy like old wine')}
${res}
<div class="cnsec"><b>${r?'Fine-tune the shade':'Or pick the shade'}</b>
<div class="cnsq" id="cn-sq" style="--h:${Math.round(nc.h)}" tabindex="0" role="slider" aria-label="Shade: saturation across, brightness down" aria-valuetext="${hex.toUpperCase()}" data-act-pointerdown="cnSqPress" data-act-keydown="cnSqKey" data-act-keyup="cnSlideUp"><i class="cnthumb" style="left:${nc.s.toFixed(1)}%;top:${(100-nc.v).toFixed(1)}%;background:${hex}"></i></div>
<div class="cnhue" id="cn-hue" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="359" aria-valuenow="${Math.round(nc.h)}" data-act-pointerdown="cnHuePress" data-act-keydown="cnHueKey" data-act-keyup="cnSlideUp"><i style="left:${(nc.h/360*100).toFixed(1)}%;background:hsl(${Math.round(nc.h)},100%,50%)"></i></div>
<div class="cnrow"><label class="cnfld cnhex">Hex<input id="cn-hex" value="${hex.toUpperCase()}" maxlength="7" autocomplete="off" spellcheck="false" data-act-input="cnHexType" data-act-change="cnHexDone"><i data-cnsw style="background:${hex}"></i></label><label class="cnfld">Name<input id="cn-name" dir="auto" maxlength="24" value="${esc(nc.name||'')}" placeholder="e.g. Faded burgundy" data-act-input="cnNameType"></label></div></div>
${fold}
<div class="cpbar">${nc.err?`<p class="formerr cnbarerr" id="cn-error" role="alert">${esc(nc.err)}</p>`:''}${bar}</div>`;   /* the error sits in the sticky bar, over its button (W2-16-05: above the bar it was cut through by the bar's top edge) */
  if(keep)el.scrollTop=y}
async function colNewAdd(){const nc=colPick&&colPick.newc,it=colTarget();if(!nc||!it)return;const name=cap1(String(nc.name||'').trim());let key;
  // a colour of one's own by that name already (made for another kind, say): that one is used, and offered for this kind (useColPick),
  // not refused as "There is already a color with that name" (2026-11-16, the owner's coyote brown T-shirt)
  const had=nc.kind==='colour'&&colPick.src!=='s'?ownColFind(name):null;if(had){cnDone(had);return}
  try{key=nc.kind==='pattern'?await addCustomPattern({name,desc:(nc.res&&nc.res.description)||nc.desc||'',base:cnPatBase(it,nc),types:nc.types,look:nc.look||null})
    :await addCustomColor({name,hex:nc.hex,base:cnColBase(it,nc),types:nc.types,accent:nc.accent})}
  catch(e){nc.err=e.message||'That could not be added.';renderColPick(true);return}
  toast(`${name} added to your ${nc.kind==='pattern'?'patterns':'colors'}.`);cnDone(key)}
function cnUseExisting(){const nc=colPick&&colPick.newc;if(!nc||!nc.res)return;const ex=nc.res.existing;
  if(colPick.src==='s'){toast(`You already have ${nc.kind==='pattern'?patName(ex):colName(ex)}.`);closeColPick();return}cnDone(ex)}
/* the new colour or pattern (or the one already had) set in the field, as a pick is */
function cnDone(v){const nc=colPick.newc;if(colPick.src==='s'){closeColPick();renderCustomUI();return}
  if(colPick.src==='q'){const q=cardOf(colPick.ref);if(q){if(nc.kind==='pattern')q.newPattern=null;else if(colPick.k==='primaryColor')q.newColor=null}}
  colPick.newc=null;colPick.sel=v;useColPick()}
function renderPatNew(keep){const el=$('#col-sheet'),it=colTarget(),nc=colPick&&colPick.newc;if(!el||!it||!nc)return;const y=el.scrollTop,src=colPick.src,r=nc.res,name=cap1(String(nc.name||'').trim()),base=cnPatBase(it,nc);
  const pic=src!=='s'&&it.texture?it.texture:null,draw=(big)=>cnWithPat(it,nc,x=>itemThumb(x,big)),sw=()=>cnWithPat(it,nc,x=>swatchSVG(x,true));
  let res='';
  if((nc.state==='result'||nc.state==='reuse')&&r){const lk=nc.look,g=lk&&lk.tex&&lk.tex.grid,ex=r.existing;
    const plain=[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS,'houndstooth','paisley','tonal-check'].includes(base)?'counts as a pattern':'counts as plain';
    const from=!lk?`the ${esc(patName(base))} drawing`:g?`Claude’s weave map (${g[0].length} × ${g.length})`:lk.motif?'Claude’s figure, in your colors':lk.layout==='stripes'?'Claude’s stripes, in your colors':'Claude’s check, in your colors';
    const bmp=g?`<span class="cnbmp" aria-hidden="true" style="grid-template-columns:repeat(${g[0].length},7px)">${g.join('').split('').map(c=>`<i class="${c==='1'?'on':''}"></i>`).join('')}</span>`:'';
    res=`<div class="cnres" id="cn-res"><div class="cnreshd"><span class="cnresw cnresp">${sw()}</span><span><span class="cneyebrow">Claude’s pattern</span><b>${esc(cap1(r.name||patName(base)))}</b>${r.description?`<small>${esc(r.description)}</small>`:''}</span></div>
<ul class="cnfacts"><li><span>In outfits</span><span>plans like <b>${esc(patName(base))}</b> <span class="cntag">${plain}</span></span></li>
<li><span>Drawn from</span><span>${from}</span>${bmp?`<span class="cnde">${bmp}</span>`:''}</li>
${ex?`<li><span>Nearest yours</span><span>${esc(cap1(patName(ex)))}</span><span class="cnde">${r.match==='existing'?'names it already':ex===base?'drawn like it':'a different pattern'}</span></li>`:''}</ul>
${r.colourHint?`<p class="cnwhy">${esc(r.colourHint)}</p>`:''}${r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:''}
${ex&&patChoices(it).includes(ex)?`<div class="cnbtns">${nc.state==='reuse'?`<button type="button" class="cpaskbtn ghost" id="cn-anyway" data-act="pnAnywayTap">Add a new pattern anyway</button>`:`<button type="button" class="cpaskbtn ghost" id="cn-use" data-act="cnUseOldTap">Use ${esc(patName(ex))} instead</button>`}</div>`:''}</div>`}
  if(nc.state==='err')res=cnErrCard(nc,'pattern');if(nc.state==='kind')res=cnKindCard(nc);
  const bases=(PATS_BY[it.type]||['solid']).filter(p=>!CUSTOM_PAT[p]),offer=CN_SUITING.includes(it.type)?CN_SUITING:[it.type];
  const details=nc.state==='reuse'?'':`<div class="cnsec" id="pn-details"><b>${r?'Check the details':'Or set it yourself'}</b>
<label class="cnfld">Name<input id="cn-name" dir="auto" maxlength="24" value="${esc(nc.name||'')}" placeholder="e.g. Hopsack" data-act-input="cnNameType"></label>
<label class="cnfld">Planned and drawn like<select id="cn-base" data-act-change="cnBasePick">${bases.map(p=>`<option value="${p}"${p===base?' selected':''}>${esc(cap1(patName(p)))}</option>`).join('')}</select></label>
<div class="cnfld cnoffer">Offer it for<div class="cnchips">${offer.map(t=>`<button type="button" class="cnchip${nc.types.includes(t)?' on':''}" aria-pressed="${nc.types.includes(t)}" data-act="cnTypeTap" data-t="${t}">${esc(TYPES[t])}</button>`).join('')}</div></div></div>`;
  const bar=nc.state==='reuse'&&r?`<button type="button" class="pri" id="cn-add" data-use="1" data-act="cnUseOldTap">Use ${esc(cap1(patName(r.existing)))}</button>`
    :`<button type="button" class="pri" id="cn-add" data-act="cnAddTap"${name?'':' disabled'}>${name?`Add ${esc(name)}${src==='s'?'':' and use it'}`:'Add pattern'}</button>`;
  el.innerHTML=`<div class="cptop">${SW_GRAB}<div class="pick-head"><button type="button" class="cnback" data-act="cnBackTap" aria-label="${nc.from==='pick'?'Back to patterns':'Close'}">‹</button><b id="col-title">New pattern or texture</b><button class="pick-x" data-act="cpCloseTap" aria-label="Close">×</button></div>
<div class="cpcmp"><figure class="cpph${pic?'':' cpfig'}">${pic?`<img src="${srcOk(pic)}" alt="Your close-up">`:`<div class="cpdraw">${draw(false)}</div>`}<figcaption>${pic?'Your close-up':`Your ${esc((TYPES[it.type]||'item').toLowerCase())}, drawn`}</figcaption></figure><figure class="cpbig cppatbig"><div class="cpdraw">${draw(true)}</div><figcaption>${esc(name||'Not set yet')}</figcaption></figure></div></div>
${src==='s'?`<label class="cnfld cnfor">For<select id="cn-for" data-act-change="cnForPick">${Object.keys(PATS_BY).filter(t=>lookOn()||!LOOK_COATS.includes(t)).map(t=>`<option value="${t}"${t===it.type?' selected':''}>${esc(TYPES[t])}</option>`).join('')}</select></label>`:''}
${cnAskBox(nc,'pattern','The weave or pattern in your words. Claude names it, picks how the app plans it, and maps the weave so it can be drawn.','e.g. a small basketweave like a hopsack')}
${res}
${details}
<div class="cpbar">${nc.err?`<p class="formerr cnbarerr" id="cn-error" role="alert">${esc(nc.err)}</p>`:''}${bar}</div>`;   /* the error sits in the sticky bar, over its button (W2-16-05: above the bar it was cut through by the bar's top edge) */
  if(keep)el.scrollTop=y}
/* (the phone's Back with this sheet up closes only the sheet: its backOver, near closeColPick, asked before the pages' own Back) */
window.addEventListener('keydown',e=>{if(!colPick)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(colPick.newc)colNewBack();else closeColPick()}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopImmediatePropagation()},true);

/* ---- "Read color and texture from close-up" (2026-11-15, the owner's variant A of C:\code\audit-2026-11-13\custom-colour-texture\
   closeup-reading-mockups\, with his changes): one tap has Claude read the close-up's color and weave (worker POST /describe
   what:'both', the two lookups side by side) and shows two proposals in a bottom sheet (#rd-sheet): a color card and a pattern &
   texture card, each with Keep / Use, "Use both" pinned at the bottom and the item drawn with both at the top. Nothing changes until a
   tap; a new color or pattern is added as the New color / New pattern sheets add it (addCustomColor / addCustomPattern), one the owner
   has is just set. Undo on the card left on the page and in the toast. In the item editor the button sits under Edit photos (styled
   like it); on the Add card it is "Add close-up and read texture/color" beside Add close-up (its close-up skips the automatic re-tag:
   addTexture(i,f,true)), or "Read color and texture" beside Replace close-up. A tester's press is 2 lookups (the owner's decision). */
let rd=null;      // the sheet: {src:'q'|'e', id, run, state:'busy'|'result'|'err'|'limit', c, p (the halves), sent:{wb,warm}, ac}
let rdLast=null;  // what the last reading set, for Undo: {src, id, run, c:{prev, added, name, kind} | null, p: …}
const RD_LOOKUPS=2;
const RD_COLF=['primaryColor','color','shade','newColor'];
const RD_PATF=['pattern','sett','stripes','patternSpec','weave','newPattern'];
const rdItem=(src,id)=>src==='q'?queue.find(x=>x&&x.id===id):items.find(x=>x.id===id);
/* why the button can't read now ('' when it can): no connection, or a tester with fewer than 2 lookups left */
function rdOff(){if(!isConnected())return NEED_CONN;const l=!showCost()?cnLeft():null;if(!l||l.left>=RD_LOOKUPS)return '';
  return l.left?'Reading color and texture takes 2 lookups and you have 1 left today. They start again at midnight UTC.':`Today’s ${l.cap} color and pattern lookups are used up. They start again at midnight UTC.`}
/* the cost: the owner the cents (readEstimate, tag-request.js), a tester "2 lookups · N of M left today" (no cents for testers) */
function rdCost(){if(!isConnected())return 'Connect in ⚙ Settings first.';
  if(!showCost()){const l=cnLeft();return l?`2 lookups · ${l.left} of ${l.cap} left today`:'2 lookups'}
  return `About ${Math.max(1,Math.round(readEstimate()*100))}¢`}
const rdCostLine=()=>`<small class="rdcost">${esc(rdCost())}</small>`;
/* the item editor's button: under Edit photos, the same full-width button, its label and no icon (the owner's ask) */
/* (after: what goes right under it, before the done card: the editor's "True color in 3 steps", paperHint) */
function rdEditorBtn(i,after=''){if(!TEXTURE_TYPES.includes(i.type)||lookOn())return '';const off=rdOff();   // (the Look beta: "Read with Claude" in the Look section replaces it)
  return `<div class="ivrd"><button type="button" class="ivrdbtn" id="iv-read" data-act="rdReadTap" data-src="e" data-id="${esc(i.id)}"${off?' aria-disabled="true"':''}>Read color and texture from close-up</button>${rdCostLine()}</div>${after}${rdDoneHtml('e',i.id,i)}`}
/* the Add card's second button, beside Add close-up / Replace close-up (same shape, the plain weight beside the filled Add close-up) */
const rdAddBtn=(q,label)=>`<button type="button" class="btn rdgo" data-act="rdReadTap" data-src="q" data-id="${esc(q.id)}"${rdOff()?' aria-disabled="true"':''}>${label}</button>`;
/* a tap: with no close-up the close-up chooser first (mode 'read'; the file window without touch), then the reading */
function rdStart(src,id){const it=rdItem(src,id);if(!it)return;const off=rdOff();if(off){tell(off);return}
  if(it.texture){rdRun(src,id);return}
  const file=f=>rdWithClose(src,id,f);
  if(cuTouch()){closeupPick({mode:'read',cloth:paperCloth(it),file});return}
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=()=>{const f=inp.files&&inp.files[0];if(f)file(f)};inp.click()}
/* the close-up chosen (or retaken): kept as the Add card / editor keep one (on the Add card without the automatic re-tag), then read */
async function rdWithClose(src,id,f){if(!f)return;const was=(rdItem(src,id)||{}).texture||'';
  if(src==='q'){const i=queue.findIndex(x=>x&&x.id===id);if(i<0)return;await addTexture(i,f,true)}else await replaceTexture(id,f);
  const it=rdItem(src,id);if(it&&it.texture&&it.texture!==was)rdRun(src,id)}
function rdRetake(f){const me=rd;if(me)rdWithClose(me.src,me.id,f)}
/* ask: {what:'both'} with the close-up as the New color sheet sends it (paperCopy: white-balanced from the paper, wb true; as taken, wb false) */
async function rdRun(src,id){const it=rdItem(src,id);if(!it||!it.texture)return;if(rd&&rd.ac)try{rd.ac.abort()}catch{}
  const me=rd={src,id,run:Date.now()+Math.random(),state:'busy',c:null,p:null,sent:null,ac:typeof AbortController==='function'?new AbortController():null};
  rdOpen();rdRender();
  const body={what:'both',type:it.type,colours:{main:primaryCol(it),second:it.secondaryColor||null,third:it.tertiaryColor||null},pattern:normPat(it.type,it.pattern),custom:settings.custom||{}};
  const om=ownMats(it.type);if(om.length)body.ownMaterials={[it.type]:om};   // the person's own materials for this type (2026-11-16): Claude may name them
  await paperOf(it);const cp=await paperCopy(it),pr=paperNow(it);body.closeup=cp.closeup;body.wb=cp.wb;me.sent={wb:cp.wb,warm:!cp.wb&&!!(pr&&pr.warm)};
  if(rd!==me)return;
  const w=localStorage.getItem('worker_url')||'';let r=null,j={};
  try{r=await fetch(new URL('describe',w.replace(/\/*$/,'/')).href,{method:'POST',headers:{'content-type':'application/json','x-app-token':localStorage.getItem('app_token')||''},body:JSON.stringify(body),...(me.ac?{signal:me.ac.signal}:{})});j=await r.json().catch(()=>({}))}catch(e){r=null}
  if(rd!==me)return;   // closed or Stopped meanwhile: nothing changes
  if(r&&r.ok&&acct&&acct.me&&acct.me.caps&&acct.me.used)acct.me.used.describe=(+acct.me.used.describe||0)+(j.lookups!=null?+j.lookups||0:RD_LOOKUPS);
  if(r&&r.status===429){me.state='limit';me.limit=j.message||'Today’s color and pattern lookups are used up. They start again at midnight UTC.'}
  else if(!r||!r.ok||!j.colour||!j.pattern){me.state='err';me.detail=showCost()&&(j.detail||j.message)||''}
  else{const now=rdItem(src,id)||it;me.state='result';me.c=rdColOf(j.colour);me.p=rdPatOf(now,j.pattern);me.m=rdMatOf(now,j.pattern&&j.pattern.material);me.a=rdAccOf(now,j.colour)}
  rdRender(true);rdRefresh(src,id)}
/* the material (2026-11-15, the materials audit; the worker's pattern half gives it, held to its tier): a third card only when Claude is
   high or medium on one of the type's materials that the item doesn't already have; null otherwise (low, "none", an older worker) */
/* (2026-11-16, the owner's approved additions) one of the person's own materials counts as listed; a material on no list (m.new, medium or
   high) is offered to add ("Add cupro as a material", isNew); a listed one at low confidence is Claude's guess (guess) with its own Use */
function rdMatOf(it,m){const l=matsFor(it.type);if(!m||m.error||!l||!m.key||m.key==='none')return null;const key=String(m.key).toLowerCase().trim(),hi=m.confidence==='high'||m.confidence==='medium';
  const cur=String(it.material||'').trim();if(cur.toLowerCase()===key)return null;const base={r:m,key,name:cap1(key),cur:cur==='other'?'':cur,done:null};
  if(l.includes(key))return hi?base:{...base,guess:true};
  return m.new===true&&hi&&ownMatName(key)===key?{...base,isNew:true}:null}
/* its action for "Use all": set it when the item has no material; one the owner set is never changed by Use all (the card's own Use does);
   a guess or a new material never (adding or a guess is always its own tap) */
const rdMatMain=(it,x)=>x.cur||x.guess||x.isNew?null:'use';
/* the halves, as the New color / New pattern sheets read them: {na} when it failed or isn't cloth */
/* (2026-11-16, the owner's camouflage: "Claude couldn't read the color" on patterned cloth) a colour half that says pattern, material or
   unclear is not a failure: it is a cloth of several colours (na 'several': "This cloth has several colors", its colours offered as Also
   has, rdAccOf); the failure text is for a real error, and "not a close-up of cloth" for not-clothing */
function rdColOf(c){if(!c||c.error)return {na:'fail'};if(c.kind!=='colour'&&c.kind!=='several')return {na:c.kind==='not-clothing'?'cloth':'several'};
  const hex=cnHex(c.hex);if(!hex)return {na:'fail'};const ex=c.existing&&COLORS[c.existing]?c.existing:null,d=+c.dE||0;
  return {r:c,hex,name:cap1(String(c.name||'').trim())||cap1(colName(c.plansAs||'grey'))+' tone',ex,d,dup:!!ex&&d<=3,done:null}}
function rdPatOf(it,p){if(!p||p.error)return {na:'fail'};if(p.kind!=='pattern')return {na:p.kind==='not-clothing'?'cloth':'fail'};
  const ex=p.existing&&patChoices(it).includes(p.existing)?p.existing:null,look=p.look&&p.look.layout&&p.look.layout!=='none'?p.look:null;
  return {r:p,name:cap1(String(p.name||'').trim())||cap1(patName(p.plansAs||'solid')),look,ex,reuse:!!ex&&p.match==='existing',done:null}}
const rdColBase=(it,x)=>cnColBase(it,{base:null,res:x.r,hex:x.hex,accent:false});
const rdPatBase=(it,x)=>cnPatBase(it,{base:null,res:x.r});
/* each card's main action: Claude's new one, or the one already had when it is the same to the eye (ΔE00 ≤ 3, as the New color sheet), null when that is the item's already */
const rdColMain=(it,x)=>x.dup?(x.ex===primaryCol(it)?null:'existing'):'new';
const rdPatMain=(it,x)=>x.reuse?(x.ex===normPat(it.type,it.pattern)?null:'existing'):'new';
const rdActName=(it,me,[h,a])=>h==='a'?'these colors':h==='m'?me.m.name:h==='c'?(a==='existing'?cap1(colName(me.c.ex)):me.c.name):(a==='existing'?cap1(patName(me.p.ex)):me.p.name);
/* the item drawn in a shade and/or pattern not added yet (stand-in keys, as cnDrawn / cnWithPat), taken out again */
function rdDraw(it,o,sw){const P='cnprev',PP='own-cnprev';let x={...it,photo:undefined,texture:undefined,swatch:undefined,swSrc:undefined};
  try{if(o.hex){COLORS[P]=o.hex;delete LUMS[P];x={...x,primaryColor:P,color:undefined,shade:0}}else if(o.col)x={...x,primaryColor:o.col,color:undefined,shade:0};
    if(o.look){CUSTOM_PAT[PP]={key:PP,name:o.name||'new pattern',base:o.base||'solid',look:o.look,types:[]};x=patVar(x,PP)}else if(o.pat)x=patVar(x,o.pat);
    return sw?swatchSVG(x,true):itemThumb(x)}
  finally{delete COLORS[P];delete LUMS[P];delete CUSTOM_PAT[PP]}}
/* what "Use both" would give, for the drawing at the top */
function rdPreview(it,me){const o={},c=me.c,p=me.p;
  if(c&&!c.na&&!c.done){const a=rdColMain(it,c);if(a==='new')o.hex=c.hex;else if(a==='existing')o.col=c.ex}
  if(p&&!p.na&&!p.done){const a=rdPatMain(it,p);if(a==='existing')o.pat=p.ex;else if(a==='new'){if(p.look){o.look=p.look;o.base=rdPatBase(it,p);o.name=p.name}else o.pat=rdPatBase(it,p)}}
  return o}
function rdEls(){let b=document.querySelector('#rd-backdrop'),s=document.querySelector('#rd-sheet');
  if(!s){b=document.createElement('div');b.id='rd-backdrop';b.onclick=()=>rdClose();
    s=document.createElement('div');s.id='rd-sheet';s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-labelledby','rd-title');s.tabIndex=-1;document.body.append(b,s);
    window.addEventListener('keydown',e=>{if(!rd||cuOpen||!document.querySelector('#rd-sheet.on'))return;   // Escape closes it (ahead of the item sheet's)
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();rdClose()}else if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopImmediatePropagation()},true);
    cpSwipe(s,'.rdtop','#rd-backdrop',()=>!!rd&&s.classList.contains('on'),()=>rdClose())}   // swiped down it closes as × does
  return {b,s}}
/* the phone's Back closes it as × does (the Back audit, 2026-11-15: Back closed the item sheet or Add under it and left the sheet up):
   it borrows the Back entry of the page under it, or makes its own (back.js backBorrow 'rd', kept in rdHist while it is up; a reading
   run again in the open sheet keeps it); × gives it back, and closed by Back the page under it gets its entry again (as the chooser) */
let rdHist;
backOn('rd',()=>rdBack());
function rdOpen(){const {b,s}=rdEls();b.classList.add('on');s.classList.add('on');s.scrollTop=0;layerOpen(s);
  if(rdHist===undefined)rdHist=backBorrow('rd')}
function rdClose(fromBack){const me=rd;rd=null;if(me&&me.state==='busy'&&me.ac)try{me.ac.abort()}catch{}
  const {b,s}=rdEls();b.classList.remove('on');s.classList.remove('on');layerClose(s);
  const h=rdHist;rdHist=undefined;if(h!==undefined)backReturn('rd',h,fromBack);
  if(me)rdRefresh(me.src,me.id)}
function rdBack(){if(rdHist!==undefined||rd)rdClose(true)}
/* the page under it, redrawn (the done card, the cost line) */
function rdRefresh(src,id){if(src==='q'){renderAdd()}else if(editing===id)renderWardrobe()}
const rdPaperHtml=pr=>!pr?'':pr.ref?'<span class="rdpaper ok" id="rd-paper">✓ White paper found: true color</span>':`<span class="rdpaper no" id="rd-paper">! No white paper${pr.warm?', warm light':''}</span>`;
const rdRetakeHtml=it=>closeupBtn({label:'Retake close-up',cls:'linkbtn wbretake',mode:'retake',act:' data-act-change="rdRetakeFile"',cloth:paperCloth(it)});
function rdLightNote(it,me){const s=me.sent;if(!s||s.wb!==false)return '';
  return s.warm?`<div class="cnwarm" id="rd-warm" role="note"><span aria-hidden="true">☀︎</span><span>Taken in warm light — the color may be yellower than the cloth; add white paper for a truer color.<br>${rdRetakeHtml(it)}</span></div>`
    :`<p class="cnwhy cnnopaper" id="rd-warm">No white paper in the close-up, so this shade is Claude’s best guess from the photo as taken. ${rdRetakeHtml(it)}</p>`}
function rdNaCard(it,h,x){const what=h==='c'?'color':'weave';
  if(x.na==='several')return `<div class="rdcard na" id="rd-col"><span class="cneyebrow">Color</span><p class="cnwhy" id="rd-several"><b>This cloth has several colors.</b> Claude didn’t name one main color, so ${esc(cap1(colName(primaryCol(it))))} stays${rd&&rd.a?'; the colors it saw are under Also has':''}.</p></div>`;
  return `<div class="rdcard na" id="${h==='c'?'rd-col':'rd-pat'}"><span class="cneyebrow">${h==='c'?'Color':'Pattern &amp; texture'}</span><p class="cnwhy">${x.na==='cloth'?`That doesn’t look like a close-up of cloth. ${rdRetakeHtml(it)}`:`Claude couldn’t read the ${what} this time.`}</p></div>`}
function rdDoneCard(it,h,x){const id=h==='c'?'rd-col':'rd-pat',cur=h==='c'?cap1(colName(primaryCol(it))):cap1(patName(normPat(it.type,it.pattern)));
  const sw=h==='c'?`<span class="cnresw rdsm" style="background:${COLORS[primaryCol(it)]||'transparent'}"></span>`:`<span class="cnresw cnresp rdsm">${swatchSVG(it,true)}</span>`;
  return `<div class="rdcard done" id="${esc(id)}">${sw}<span class="rddtx"><span class="cneyebrow">${h==='c'?'Color':'Pattern &amp; texture'}</span><b>${x.done==='keep'?`Kept ${esc(cur)}`:`${esc(x.usedName||cur)} set`}</b></span>${x.done==='keep'?`<button type="button" class="rdlink" data-act="rdChangeTap" data-h="${h}">Change</button>`:`<button type="button" class="rdlink" id="${id}-undo" data-act="rdUndoTap" data-h="${h}">Undo</button>`}</div>`}
function rdColCard(it,me){const x=me.c;if(x.na)return rdNaCard(it,'c',x);if(x.done)return rdDoneCard(it,'c',x);
  const cur=primaryCol(it),curN=cap1(colName(cur)),ex=x.ex,exN=ex?cap1(colName(ex)):'',d=x.d,word=cnDWord(d),r=x.r,why=r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:'';
  const keep=`<button type="button" class="cpaskbtn ghost" id="rd-ckeep" data-act="rdKeepTap" data-h="c">Keep ${esc(curN)}</button>`;
  if(x.dup)return `<div class="rdcard" id="rd-col"><div class="cnreshd"><span class="cnresw" style="background:${COLORS[ex]}"></span><span><span class="cneyebrow">Color <span class="rdtag have">You have it</span></span><b>That’s your ${esc(exN)}</b><small>Claude’s ${esc(x.name)} (${x.hex.toUpperCase()}) is ${d.toFixed(1)} ΔE from ${esc(exN)}: ${word}.</small></span></div>
<ul class="cnfacts"><li><span>Now</span><span class="cnch" style="background:${COLORS[cur]||'transparent'}"></span><span>${esc(curN)}</span></li><li><span>In outfits</span><span class="cnch" style="background:${COLORS[r.plansAs]||COLORS[ex]}"></span><span>behaves like <b>${esc(cap1(colName(COLORS[r.plansAs]?r.plansAs:ex)))}</b></span></li></ul>${rdLightNote(it,me)}${why}
<div class="rdbtns">${ex===cur?keep:`${keep}<button type="button" class="cpaskbtn" id="rd-cuse" data-act="rdUseTap" data-h="c" data-how="existing">Use ${esc(exN)}</button>`}</div><button type="button" class="rdalt" id="rd-calt" data-act="rdUseTap" data-h="c" data-how="new">Add ${esc(x.name)} as a new color instead</button></div>`;
  return `<div class="rdcard" id="rd-col"><div class="cnreshd"><span class="cnresw" style="background:${x.hex}"></span><span><span class="cneyebrow">Color <span class="rdtag">New</span></span><b>${esc(x.name)}</b><small>${x.hex.toUpperCase()} · ${esc(r.confidence||'medium')} confidence</small></span></div>
<ul class="cnfacts"><li><span>Now</span><span class="cnch" style="background:${COLORS[cur]||'transparent'}"></span><span>${esc(curN)}</span>${ex===cur?`<span class="cnde">${word} · ΔE ${d.toFixed(1)}</span>`:''}</li>
<li><span>In outfits</span><span class="cnch" style="background:${COLORS[r.plansAs]||'transparent'}"></span><span>behaves like <b>${esc(cap1(colName(rdColBase(it,x))))}</b></span></li>
${ex&&ex!==cur?`<li><span>Nearest yours</span><span class="cnch" style="background:${COLORS[ex]}"></span><span>${esc(exN)}</span><span class="cnde">${word} · ΔE ${d.toFixed(1)}</span></li>`:''}</ul>${rdLightNote(it,me)}
${r.fitsType===false?`<p class="cnwhy">Unusual for ${esc((TYPES[it.type]||'this item').toLowerCase())}, but you can still use it.</p>`:''}${why}
<div class="rdbtns">${keep}<button type="button" class="cpaskbtn" id="rd-cuse" data-act="rdUseTap" data-h="c" data-how="new">Use ${esc(x.name)}</button></div>
${ex&&ex!==cur&&d<=6?`<button type="button" class="rdalt" id="rd-calt" data-act="rdUseTap" data-h="c" data-how="existing">Use ${esc(exN)} instead</button>`:`<p class="rdfoot">Use adds ${esc(x.name)} to your colors.</p>`}</div>`}
function rdPatCard(it,me){const x=me.p;if(x.na)return rdNaCard(it,'p',x);if(x.done)return rdDoneCard(it,'p',x);
  const cur=normPat(it.type,it.pattern),curN=cap1(patName(cur)),r=x.r,ex=x.ex,have=x.reuse,base=have?ex:rdPatBase(it,x),col=me.c&&!me.c.na&&!me.c.done?rdPreview(it,{c:me.c}):{};
  const sw=rdDraw(it,{...col,...(have?{pat:ex}:x.look?{look:x.look,base,name:x.name}:{pat:base})},true),g=!have&&x.look&&x.look.tex&&x.look.tex.grid;
  const plain=[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS,'houndstooth','paisley','tonal-check'].includes(patBase(base))?'counts as a pattern':'counts as plain';
  const from=have||!x.look?`the ${esc(patName(base))} drawing, in your colors`:g?'Claude’s weave map, in your colors':x.look.motif?'Claude’s figure, in your colors':x.look.layout==='stripes'?'Claude’s stripes, in your colors':'Claude’s check, in your colors';
  const bmp=g?`<span class="cnde"><span class="cnbmp" aria-hidden="true" style="grid-template-columns:repeat(${g[0].length},7px)">${g.join('').split('').map(c=>`<i class="${c==='1'?'on':''}"></i>`).join('')}</span></span>`:'';
  const keep=`<button type="button" class="cpaskbtn ghost" id="rd-pkeep" data-act="rdKeepTap" data-h="p">Keep ${esc(curN)}</button>`,nm=have?cap1(patName(ex)):x.name;
  const btns=have&&ex===cur?keep:`${keep}<button type="button" class="cpaskbtn" id="rd-puse" data-act="rdUseTap" data-h="p" data-how="${have?'existing':'new'}">Use ${esc(nm)}</button>`;
  const alt=!have&&ex&&ex!==cur?`<button type="button" class="rdalt" id="rd-palt" data-act="rdUseTap" data-h="p" data-how="existing">Use ${esc(cap1(patName(ex)))} instead</button>`:have?'':`<p class="rdfoot">Use adds ${esc(x.name)} to your patterns.</p>`;
  return `<div class="rdcard" id="rd-pat"><div class="cnreshd"><span class="cnresw cnresp">${sw}</span><span><span class="cneyebrow">Pattern &amp; texture ${have?'<span class="rdtag have">You have it</span>':'<span class="rdtag">New</span>'}</span><b>${have?`That’s ${esc(nm)}`:esc(nm)}</b>${r.description?`<small>${esc(r.description)}</small>`:''}</span></div>
<ul class="cnfacts"><li><span>Now</span><span>${esc(curN)}</span></li><li><span>In outfits</span><span>planned like <b>${esc(cap1(patName(base)))}</b> <span class="cntag">${plain}</span></span></li><li><span>Drawn from</span><span>${from}</span>${bmp}</li></ul>
${me.sent&&me.sent.wb===false?'<p class="cnwhy">No white paper needed for this: the weave reads fine without it.</p>':''}${r.colourHint?`<p class="cnwhy">${esc(r.colourHint)}</p>`:''}${r.why?`<p class="cnwhy">“${esc(r.why)}”</p>`:''}
<div class="rdbtns">${btns}</div>${alt}</div>`}
/* the material card: "Material: Flannel" with Keep / Use and Claude's line; when the item already has another material, "Yours: Wool ·
   Claude: Flannel" (Use switches it; Use all leaves it) */
function rdMatCard(it,me){const x=me.m;if(!x)return '';
  if(x.done){const cur=String(it.material||'').trim();return `<div class="rdcard done" id="rd-mat"><span class="rddtx"><span class="cneyebrow">Material</span><b>${x.done==='keep'?(cur?`Kept ${esc(cap1(cur))}`:'Left blank'):`${esc(x.name)} set`}</b></span>${x.done==='keep'?`<button type="button" class="rdlink" data-act="rdChangeTap" data-h="m">Change</button>`:`<button type="button" class="rdlink" id="rd-mat-undo" data-act="rdUndoTap" data-h="m">Undo</button>`}</div>`}
  const why=x.r.why?`<p class="cnwhy">“${esc(x.r.why)}”</p>`:'',yours=x.cur?cap1(x.cur):'';
  const keepB=`<button type="button" class="cpaskbtn ghost" id="rd-mkeep" data-act="rdKeepTap" data-h="m">${yours?`Keep ${esc(yours)}`:'Keep blank'}</button>`;
  if(x.isNew)return `<div class="rdcard rdmatnew" id="rd-mat"><div class="cnreshd"><span><span class="cneyebrow">Material <span class="rdtag">New</span> <span class="rdtag">${esc(x.r.confidence)} confidence</span></span><b>Claude calls it ${esc(x.key)}</b><small>None of the ${esc(matTypeWord(it.type))} materials fit${yours?`; yours is ${esc(yours)}`:''}.</small></span></div>${why}
<div class="rdbtns">${keepB}<button type="button" class="cpaskbtn" id="rd-muse" data-act="rdUseTap" data-h="m" data-how="add">Add ${esc(x.key)} as a material</button></div><p class="rdfoot">Adding puts it in the list for every ${esc(matTypeOne(it.type))} you add, on all your devices. Use all leaves it.</p></div>`;
  if(x.guess)return `<div class="rdcard rdmatguess" id="rd-mat"><div class="cnreshd"><span><span class="cneyebrow">Material <span class="rdtag">Guess</span></span><b>Claude’s guess: ${esc(x.key)}</b><small>${x.r.why&&String(x.r.why).length<=60?esc(String(x.r.why).replace(/[.\s]+$/,'')):'Can’t be sure from a photo'}. Use all leaves it.</small></span></div>
<div class="rdbtns">${keepB}<button type="button" class="cpaskbtn" id="rd-muse" data-act="rdUseTap" data-h="m" data-how="use">Use ${esc(x.key)}</button></div></div>`;
  return `<div class="rdcard" id="rd-mat"><div class="cnreshd"><span><span class="cneyebrow">Material <span class="rdtag">${esc(x.r.confidence)} confidence</span></span><b>${yours?`Yours: ${esc(yours)} · Claude: ${esc(x.name)}`:`Material: ${esc(x.name)}`}</b>${yours?'<small>Use switches it to Claude’s; Use all keeps yours.</small>':''}</span></div>${why}
<div class="rdbtns"><button type="button" class="cpaskbtn ghost" id="rd-mkeep" data-act="rdKeepTap" data-h="m">${yours?`Keep ${esc(yours)}`:'Keep blank'}</button><button type="button" class="cpaskbtn" id="rd-muse" data-act="rdUseTap" data-h="m" data-how="use">Use ${esc(x.name)}</button></div></div>`}
/* the colours beyond the three (accents, 2026-11-16: the colour half's accents, the worker's cleaned list): a fourth card "Also has" with
   Keep / Use these; its Use is part of Use all (like the material's, it only adds what the item doesn't say yet). null when Claude saw none,
   or exactly the item's own already */
function rdAccOf(it,c){if(!c||c.error||!Array.isArray(c.accents))return null;const list=accentsFor(it,c.accents),cur=accentsOf(it);
  return !list.length||list.join()===cur.join()?null:{list,cur,done:null}}
const rdAccWords=l=>l.map(c=>colName(c).toLowerCase()).join(', ');
function rdAccCard(it,me){const x=me.a;if(!x)return '';
  if(x.done)return `<div class="rdcard done" id="rd-acc"><span class="rddtx"><span class="cneyebrow">Also has</span><b>${x.done==='keep'?(x.cur.length?`Kept ${esc(rdAccWords(x.cur))}`:'Left out'):`Also has ${esc(rdAccWords(x.list))} set`}</b></span>${x.done==='keep'?`<button type="button" class="rdlink" data-act="rdChangeTap" data-h="a">Change</button>`:`<button type="button" class="rdlink" id="rd-acc-undo" data-act="rdUndoTap" data-h="a">Undo</button>`}</div>`;
  return `<div class="rdcard" id="rd-acc"><div class="cnreshd"><span><span class="cneyebrow">Also has</span><b>${esc(cap1(rdAccWords(x.list)))}</b><small>Further colors Claude sees in the pattern${x.cur.length?`; the item says ${esc(rdAccWords(x.cur))} now`:''}.</small></span></div>
<div class="accchips rdacc">${x.list.map(c=>`<span class="accchip">${ckChip(c)}<span>${esc(cap1(colName(c)))}</span></span>`).join('')}</div>
<div class="rdbtns"><button type="button" class="cpaskbtn ghost" id="rd-akeep" data-act="rdKeepTap" data-h="a">${x.cur.length?'Keep the item’s':'Leave out'}</button><button type="button" class="cpaskbtn" id="rd-ause" data-act="rdUseTap" data-h="a" data-how="use">Use these</button></div></div>`}
async function rdSetAcc(src,id,v){if(src==='q'){const i=queue.findIndex(x=>x&&x.id===id);if(i>=0)await accSet('q',i,v)}else await accSet('e',id,v)}
const RD_HALVES=['c','p','m','a'];
const rdMain=(it,me,h)=>h==='c'?rdColMain(it,me.c):h==='p'?rdPatMain(it,me.p):h==='a'?'use':rdMatMain(it,me.m);
function rdBar(it,me){const left=RD_HALVES.filter(h=>me[h]&&!me[h].na&&!me[h].done),acts=left.map(h=>[h,rdMain(it,me,h)]).filter(a=>a[1]);
  const lab=acts.length>=3?'Use all':acts.length===2?'Use both':acts.length===1?`Use ${esc(rdActName(it,me,acts[0]))}`:left.length?'Keep as it is':'Done';
  return `<div class="rdbar"><button type="button" class="pri" id="rd-both" data-act="rdBothTap"${me.applying?' disabled':''}>${lab}</button>${left.length?'<small>Nothing changes until you tap. You can undo it after.</small>':''}</div>`}
function rdRender(top){const me=rd;if(!me)return;const {s}=rdEls(),it=rdItem(me.src,me.id);if(!it){rdClose();return}
  const y=s.scrollTop,pr=paperNow(it),res=me.state==='result';
  const head=`<div class="rdtop"><span class="rdgrab" aria-hidden="true"></span><div class="rdhead"><b id="rd-title">Claude’s reading</b><button type="button" class="rdx" data-act="rdCloseTap" aria-label="Close">×</button></div>
<div class="rdsrc"><figure><img src="${srcOk(it.texture)}" alt="Your close-up"><figcaption>Close-up</figcaption></figure><figure><div class="rddraw">${rdDraw(it,res?rdPreview(it,me):{})}</div><figcaption>${res?'With both':'Now'}</figcaption></figure>
<div class="rdmeta"><b>${me.state==='busy'?'Reading your close-up':'Read from your close-up'}</b>${me.state==='busy'?'Two lookups side by side: the color and the weave.':me.m?'Claude gives a color, a weave and the material. Pick any of them.':'Claude gives a color and a weave. Pick either, or both.'}<br>${rdPaperHtml(pr)}</div></div></div>`;
  let body='';
  if(me.state==='busy')body=`<div class="rdbusy" role="status"><span class="spin" aria-hidden="true"></span><span><b>Claude is reading the color and the weave…</b><small>About 15 seconds. Nothing changes until you choose.</small></span></div>
<div class="rdbar"><button type="button" class="ghost" id="rd-stop" data-act="rdCloseTap">Stop</button><small>Stopping changes nothing. · <span id="rd-cost">${esc(rdCost())}</span></small></div>`;
  else if(me.state==='limit')body=`<div class="cnlim" id="rd-limit" role="status"><span aria-hidden="true">⏳</span><span><b>${esc(me.limit)}</b>You can still set the color and pattern yourself.</span></div><div class="rdbar"><button type="button" class="pri" data-act="rdCloseTap">Close</button></div>`;
  else if(me.state==='err')body=`<div class="cnres cnerr" id="rd-err"><div class="cpasktx"><b>Claude couldn’t answer</b><small>The color and weave couldn’t be read just now. Try again later, or set them yourself.${me.detail?` (${esc(me.detail)})`:''}</small></div><div class="cnbtns"><button type="button" class="cpaskbtn" data-act="rdAgainTap">Try again</button></div></div><div class="rdbar"><button type="button" class="ghost" data-act="rdCloseTap">Close</button></div>`;
  else body=rdColCard(it,me)+rdAccCard(it,me)+rdPatCard(it,me)+rdMatCard(it,me)+rdBar(it,me);
  s.innerHTML=head+body;s.scrollTop=top?0:y}
function rdKeep(h){const me=rd;if(!me||!me[h])return;me[h].done='keep';rdAfter()}
function rdChange(h){const me=rd;if(!me||!me[h])return;me[h].done=null;rdRender()}
/* Use: a new color or pattern is added (synced) as the New sheets add it, then set; one the owner has is only set */
async function rdAddCol(it,x){const base=rdColBase(it,x);
  for(const n of [x.name,`${x.name} tone`]){const k=ownColFind(n);if(k)return {key:k,added:false};if(colNameTaken(n))continue;
    return {key:await addCustomColor({name:n,hex:x.hex,base,types:groupOf(it.type),accent:false}),added:true}}
  throw new Error('That color’s name is taken: add it from the color sheet with a name of your own.')}
async function rdAddPat(it,x){const base=rdPatBase(it,x),types=CN_SUITING.includes(it.type)?CN_SUITING.slice():[it.type];
  for(const n of [x.name,`${x.name} weave`]){const k=ownPatFind(n);if(k)return {key:k,added:false};if(patNameTaken(n))continue;
    return {key:await addCustomPattern({name:n,desc:x.r.description||'',base,types,look:x.look||null}),added:true}}
  throw new Error('That pattern’s name is taken: add it from the pattern sheet with a name of your own.')}
const rdPick=(it,fields)=>Object.fromEntries(fields.map(k=>[k,it[k]==null?it[k]:JSON.parse(JSON.stringify(it[k]))]));
async function rdSet(src,id,k,v){if(src==='q'){const i=queue.findIndex(x=>x&&x.id===id);if(i<0)return;const q=queue[i];if(k==='primaryColor')q.newColor=null;else q.newPattern=null;setq(i,k,v)}else await sete(id,k,v)}
async function rdUse(parts){const me=rd;if(!me||me.state!=='result'||me.applying)return;const it=rdItem(me.src,me.id);if(!it)return;me.applying=true;
  try{for(const [h,how] of parts){const x=me[h];if(!x||x.na||x.done)continue;const now=rdItem(me.src,me.id)||it,prev=rdPick(now,h==='c'?RD_COLF:h==='m'?['material']:h==='a'?['accents']:RD_PATF);let v,added=false,name;
      if(h==='a'){v=x.list;name='also '+rdAccWords(x.list);await rdSetAcc(me.src,me.id,v)}
      else if(h==='m'){v=x.key;name=x.name;if(x.isNew){const had=matsFor(now.type).includes(v);if(!await addOwnMaterial(now.type,v))throw new Error('That material couldn’t be added.');added=!had}await rdSetMat(me.src,me.id,v)}
      else{if(how==='existing'){v=x.ex;name=h==='c'?cap1(colName(v)):cap1(patName(v))}else{const a=h==='c'?await rdAddCol(now,x):await rdAddPat(now,x);v=a.key;added=a.added;name=x.name}
        if(h==='c'&&CUSTOM_COL[v])await ownColOffer(v,now.type,false);   // an own colour of another kind: offered for this one too
        await rdSet(me.src,me.id,h==='c'?'primaryColor':'pattern',v)}
      x.done='used';x.usedName=name;
      if(!rdLast||rdLast.run!==me.run)rdLast={src:me.src,id:me.id,run:me.run,c:null,p:null,m:null,a:null};rdLast[h]={prev,added:added?v:null,name,kind:h==='c'?'colors':h==='m'?'materials':h==='a'?'accents':'patterns',type:now.type}}}
  catch(e){me.applying=false;toast(e.message||'That could not be set.');rdRender();return}
  me.applying=false;rdAfter()}
/* the material set by the reading: the Add card's field (setQField: it then counts as chosen) or the item's (setItemField) */
async function rdSetMat(src,id,v){if(src==='q'){const i=queue.findIndex(x=>x&&x.id===id);if(i>=0)setQField(i,'material',v)}else await setItemField(id,'material',v)}
/* "Use both" / "Use all": every card's main action; a card with none (the item's own already, a material the owner set) is kept */
async function rdBoth(){const me=rd;if(!me||me.applying)return;const it=rdItem(me.src,me.id);if(!it)return;
  const acts=RD_HALVES.filter(h=>me[h]&&!me[h].na&&!me[h].done).map(h=>[h,rdMain(it,me,h)]);
  for(const [h,a] of acts)if(!a)me[h].done='keep';const use=acts.filter(a=>a[1]);if(use.length)await rdUse(use);else rdAfter()}
/* after a tap: every card decided closes the sheet (the toast says what changed, with Undo); otherwise the sheet shows what is left */
function rdAfter(){const me=rd;if(!me)return;const left=RD_HALVES.filter(h=>me[h]&&!me[h].na&&!me[h].done);
  if(left.length){rdRender();rdRefresh(me.src,me.id);return}
  const L=rdLast&&rdLast.run===me.run?rdLast:null;rdClose();
  const ch=L?[L.c&&'color',L.a&&'also-has colors',L.p&&'texture',L.m&&'material'].filter(Boolean):[];
  if(ch.length)toast(cap1(ch.length>1?ch.slice(0,-1).join(', ')+' and '+ch.at(-1):ch[0])+' updated.',4000,{label:'Undo',fn:rdUndoAll})}
/* Undo: the fields as they were, and a color or pattern this reading added taken out again when nothing else uses it */
async function rdRestore(src,id,half){const it=rdItem(src,id);
  if(it){for(const [k,v] of Object.entries(half.prev)){if(v===undefined)delete it[k];else it[k]=v}
    if(src==='q'){if(it.texCanvas)generateSwatch(it);queueMicrotask(addKeep)}else{if(it.swSrc==='tex')await refreshSwatch(it);await put(it);planDirty()}}
  if(half.kind==='accents')return;
  if(half.kind==='materials'){if(half.added&&![...items,...queue].some(x=>x&&x.type===half.type&&x.material===half.added))await removeOwnMaterial(half.type,half.added);return}   // (an own material this reading added)
  if(half.added&&![...items,...queue].some(x=>x&&[x.primaryColor,x.secondaryColor,x.tertiaryColor,x.pattern].includes(half.added)))await removeCustom(half.kind,half.added)}
async function rdUndo(h){const L=rdLast;if(!L||!L[h])return;const half=L[h];L[h]=null;await rdRestore(L.src,L.id,half);
  if(rd&&rd.run===L.run&&rd[h])rd[h].done=null;if(!L.c&&!L.p&&!L.m&&!L.a&&rdLast===L)rdLast=null;rdRefresh(L.src,L.id);if(rd)rdRender()}
async function rdUndoAll(){const L=rdLast;if(!L)return;for(const h of ['a','m','p','c'])if(L[h])await rdUndo(h);toast('Put back as it was.')}
/* the card left on the page after a reading set something: the new drawing, what changed, Undo */
function rdDoneHtml(src,id,it){const L=rdLast;if(!L||L.src!==src||L.id!==id||(!L.c&&!L.p&&!L.m&&!L.a)||(rd&&rd.run===L.run))return '';it=it||rdItem(src,id);if(!it)return '';
  const names=[L.c&&L.c.name,L.a&&L.a.name,L.p&&L.p.name,L.m&&L.m.name].filter(Boolean),add=[L.c&&L.c.added&&'colors',L.p&&L.p.added&&'patterns',L.m&&L.m.added&&'materials'].filter(Boolean);
  return `<div class="rddone" id="rd-done" role="status"><span class="rddraw" aria-hidden="true">${itemThumb({...it,photo:undefined})}</span><span class="rddtx"><b>${esc(names.join(' and '))} set</b>${add.length?`<small>Added to your ${add.join(' and ')}.</small>`:''}</span><button type="button" class="rdlink" id="rd-undo" data-act="rdUndoAllTap">Undo</button></div>`}
/* ---- what the markup's controls do (act.js: data-act names a handler; el is the control, ev the event). The color and pattern
   buttons of the Add card and the item sheet, the sheet's tiles, views, Use, Ask Claude, × ---- */
function colBtnTap(el){openColPick(el.dataset.src,el.dataset.ref,el.dataset.k)}
function cpViewTap(el){colPickView(el.dataset.v)}
function cpTileTap(el){colPickSel(el.dataset.c)}
function cpCloseTap(){closeColPick()}
function cpUseTap(){useColPick()}
function cpPicsTap(){cpGoPics()}
function cpAskTap(){colAskRun()}
function cpAskAllTap(){colAskUseAll()}
/* "+ New color" / "+ New pattern or texture": the tiles that open them, ‹, Describe it to Claude, the shade's fields, How the app uses it, Add */
function cnOpenTap(){openColNew()}
function pnOpenTap(){openPatNew()}
function cnBackTap(){colNewBack()}
function cnCloseupTap(){cnToggleClose()}
function cnAskTap(){describeAsk()}
function cnDescType(el){colPick.newc.desc=el.value}
function cnDescKey(el,ev){if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();describeAsk()}}
function cnKindTap(){cnSwitch()}
function cnAddTap(){colNewAdd()}
function cnUseOldTap(){cnUseExisting()}
function pnAnywayTap(){colPick.newc.state='result';renderColPick(true)}
function cnBasePick(el){colPick.newc.base=el.value;renderColPick(true)}
function cnTypeTap(el){cnToggleType(el.dataset.t)}
function cnAccentTap(){colPick.newc.accent=!colPick.newc.accent;renderColPick(true)}
function cnForPick(el){cnSetType(el.value)}
function cnHexType(el){cnHexIn(el.value,false)}
function cnHexDone(el){cnHexIn(el.value,'blur')}
function cnNameType(el){cnName(el.value)}
/* "Read color and texture from close-up": the button, the reading sheet's cards, its bar, the card left on the page */
function rdReadTap(el){rdStart(el.dataset.src,el.dataset.id)}
function rdKeepTap(el){rdKeep(el.dataset.h)}
function rdChangeTap(el){rdChange(el.dataset.h)}
function rdUndoTap(el){rdUndo(el.dataset.h)}
function rdUseTap(el){rdUse([[el.dataset.h,el.dataset.how]])}
function rdBothTap(){rdBoth()}
function rdCloseTap(){rdClose()}
function rdAgainTap(){rdRun(rd.src,rd.id)}
function rdUndoAllTap(){rdUndoAll()}
/* index.html's (act.js): the color sheet's backdrop */
function colBackdropTap(){closeColPick()}
/* a close-up retaken from the New color sheet and from the reading sheet (ui.js closeupBtn, cuGot) */
function cnRetakeFile(el,ev,f){cuGot(el,f,x=>cnRetake(x))}
function rdRetakeFile(el,ev,f){cuGot(el,f,x=>rdRetake(x))}
acts({colBtnTap,cpViewTap,cpTileTap,cpCloseTap,cpUseTap,cpPicsTap,cpAskTap,cpAskAllTap,cnOpenTap,pnOpenTap,cnBackTap,cnCloseupTap,cnAskTap,cnDescType,cnDescKey,
  cnKindTap,cnAddTap,cnUseOldTap,pnAnywayTap,cnBasePick,cnTypeTap,cnAccentTap,cnForPick,cnSqPress,cnHuePress,cnSqKey,cnHueKey,cnSlideUp,cnHexType,cnHexDone,cnNameType,
  rdReadTap,rdKeepTap,rdChangeTap,rdUndoTap,rdUseTap,rdBothTap,rdCloseTap,rdAgainTap,rdUndoAllTap,colBackdropTap,cnRetakeFile,rdRetakeFile});
