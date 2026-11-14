/* Daily Wardrobe: the Wardrobe's item sheet and editor (the item's photo: replace, rotate, crop) and the Wardrobe grid
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
let editing=null;
const E=(id,k,list,v,lab)=>`<label>${lab?lab:k==='primaryColor'?'Colour':k==='secondaryColor'?'Second colour':k==='tertiaryColor'?'Third colour':k==='watchStyle'||k==='shoeStyle'?'Style':k==='trouserKind'?'Kind':k[0].toUpperCase()+k.slice(1)} <select onchange="sete('${id}','${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${cap1(x[1])}</option>`).join('')}</select></label>`;
/* ---- Wardrobe editor: replace, rotate, zoom-crop the item's photo. Only the picture changes: the tags (colour, pattern...)
   and the item itself stay, so the plan and the outfit history are untouched. Undo works until the editor is closed. ---- */
let phEdit={id:null,undo:[],crop:null};
const PH_MAX=1536;   // the item photo (2026-11-13, the owner: "upgrade the main photo size stored as well"; it was 720, before that 360)
/* the photo's small copy for grids and lists (the wardrobe, stats, the piece picker): PH_SM px, kept on the item with the photo's signature
   (photoSm, phSig) and made again whenever the photo changes (makeSmall); every redraw of the wardrobe would otherwise carry the full photos */
const PH_SM=480;
const phSm=i=>i&&i.photo?(i.photoSm&&i.phSig===phSigOf(i.photo)?i.photoSm:i.photo):null;
const phSigOf=u=>u?u.length+':'+u.slice(-48):'';
async function makeSmall(it){if(!it)return false;if(!it.photo){const had=!!it.photoSm;delete it.photoSm;delete it.phSig;return had}
  const sig=phSigOf(it.photo);if(it.photoSm&&it.phSig===sig)return false;
  try{const im=await imgOf(it.photo);it.photoSm=Math.max(im.naturalWidth,im.naturalHeight)<=PH_SM?it.photo:shrink(im,PH_SM).toDataURL('image/jpeg',.82);it.phSig=sig;return true}catch{return false}}
/* at start-up: items whose small copy is missing or old (added before it, or changed on a device with an older app) */
async function smallPhotos(){let n=0;for(const it of items)if(it.photo&&!(it.photoSm&&it.phSig===phSigOf(it.photo))&&await makeSmall(it)&&stillCur(it)){await put(it);n++}if(n)fixupRedraw();return n}
function photoTools(i){if(phEdit.crop)return '';const tex=TEXTURE_TYPES.includes(i.type);
  return `<div class="phtools"><label class="btn">${i.photo?'Replace photo':'Add photo'}<input type="file" accept="image/*" class="vfile" onchange="replacePhoto('${i.id}',this.files[0]);this.value=''"></label>`+
    (tex?`<label class="btn">${i.texture?'Replace close-up':'Add fabric close-up'}<input type="file" accept="image/*" class="vfile" onchange="replaceTexture('${i.id}',this.files[0]);this.value=''"></label>`:'')+
    (i.photo?`<button type="button" onclick="rotatePhoto('${i.id}')" aria-label="Rotate the photo a quarter turn clockwise">Rotate ↻</button><button type="button" onclick="startCrop('${i.id}')">Zoom &amp; crop</button>`:'')+
    (tex&&i.texture?`<button type="button" onclick="setTexture('${i.id}',null,'Close-up removed.')">Remove close-up</button>`:'')+
    (phEdit.undo.length?`<button type="button" onclick="undoPhoto('${i.id}')">Undo</button>`:'')+`</div>`}
const imgOf=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src});
async function setPic(id,k,url,msg){const it=items.find(x=>x.id===id);if(!it)return;phEdit.undo.push({k,v:it[k]||null});if(phEdit.undo.length>10)phEdit.undo.shift();
  if(url)it[k]=url;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);cache={};renderWardrobe();if(msg)toast(msg)}
const setPhoto=(id,url,msg)=>setPic(id,'photo',url,msg),setTexture=(id,url,msg)=>setPic(id,'texture',url,msg);
/* a close-up added later stays as taken: the item photo's light reading may not hold for another moment */
async function replaceTexture(id,f){if(!f)return;try{const img=await loadImg(f),sharp=shrink(img,CLOSE_MAX).toDataURL('image/jpeg',TAG_Q);
  await setTexture(id,shrink(img,TEX_MAX).toDataURL('image/jpeg',.85),'Close-up added. The realistic photos use it from the next one made.');
  const it=items.find(x=>x.id===id);if(it&&it.texture)await keepCloseImg(id,sharp,it.texture)}   // the sharp copy for pattern and colour readings (tagging.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
async function replacePhoto(id,f){if(!f)return;try{const img=await loadImg(f),sharp=shrink(img,TAG_MAX).toDataURL('image/jpeg',TAG_Q),it=items.find(x=>x.id===id);if(it)delete it.pbox;   // the pattern's box was on the old picture
  await setPhoto(id,shrink(img,PH_MAX).toDataURL('image/jpeg',.85),'Photo replaced. The item’s tags and your plan are unchanged.');const now=items.find(x=>x.id===id);if(now&&now.photo)await keepTagImg(id,sharp,now.photo)}   // the new sharp copy (tagging.js), signed with the new photo
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
async function rotatePhoto(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo),c=document.createElement('canvas');
  c.width=im.height;c.height=im.width;const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);
  // the kept sharp copy turns with it, and the pattern's box (thousandths of the picture) with the copy
  const sharp=typeof tagImgOf==='function'?await tagImgOf(id,it):null,b=it.pbox;
  if(b)it.pbox={x:1000-(b.y+b.h),y:b.x,w:b.h,h:b.w};
  await setPhoto(id,c.toDataURL('image/jpeg',.9));
  if(sharp)try{const si=await imgOf(sharp),sc=document.createElement('canvas');sc.width=si.naturalHeight;sc.height=si.naturalWidth;const sx=sc.getContext('2d');sx.translate(sc.width,0);sx.rotate(Math.PI/2);sx.drawImage(si,0,0);await keepTagImg(id,sc.toDataURL('image/jpeg',TAG_Q),it.photo)}catch(e){console.warn('sharp copy not turned',e)}}
async function undoPhoto(id){const it=items.find(x=>x.id===id);if(!it||!phEdit.undo.length)return;const {k,v}=phEdit.undo.pop();
  if(v)it[k]=v;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);cache={};renderWardrobe()}
/* zoom & crop: a square frame; the slider zooms (about the centre), dragging moves the picture */
async function startCrop(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo);
  phEdit.crop={w:im.naturalWidth,h:im.naturalHeight,z:1,cx:.5,cy:.5};renderWardrobe();const b=$('#ivbody');if(b)b.scrollTop=0;requestAnimationFrame(layoutCrop)}
/* the best copy to crop from: the sharp copy kept on this device when the photo was read (tagging.js, up to 2048px), turned as the
   photo is now, when it shows the same picture (same shape, and alike at 24x24); else the photo itself. A crop from the kept photo
   alone came out at the size of its piece of a 360px picture (a suit at 270px). A photo replaced, or already cropped, no longer
   matches the sharp copy, so it is cropped from itself */
const CROP_MATCH=12;   // the largest mean grey difference (0-255) at 24x24 that still counts as the same picture
async function cropSource(it){const ph=await imgOf(it.photo);
  let sharp=null;try{const u=typeof tagImgOf==='function'?await tagImgOf(it.id):null;sharp=u?await imgOf(u):null}catch{sharp=null}
  if(!sharp||sharp.naturalWidth<=ph.naturalWidth)return ph;
  const grey=src=>{const N=24,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.drawImage(src,0,0,N,N);
    const d=x.getImageData(0,0,N,N).data,g=[];for(let k=0;k<d.length;k+=4)g.push(.3*d[k]+.59*d[k+1]+.11*d[k+2]);return g};
  const want=grey(ph),ar=ph.naturalWidth/ph.naturalHeight;
  for(let q=0;q<4;q++){const W=q%2?sharp.naturalHeight:sharp.naturalWidth,H=q%2?sharp.naturalWidth:sharp.naturalHeight;if(Math.abs(W/H-ar)>.02*ar)continue;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.translate(W/2,H/2);x.rotate(q*Math.PI/2);x.drawImage(sharp,-sharp.naturalWidth/2,-sharp.naturalHeight/2);
    const g=grey(c);let s=0;for(let k=0;k<g.length;k++)s+=Math.abs(g[k]-want[k]);if(s/g.length<=CROP_MATCH)return c}
  return ph}
function cropEditor(i){const c=phEdit.crop;return `<div class="cropwrap"><div class="cropbox" id="cropbox" onpointerdown="cropDrag(event)"><img id="cropimg" src="${i.photo}" alt="Photo being cropped" draggable="false"></div>
  <label class="cropzoom">Zoom <input type="range" min="1" max="4" step="0.05" value="${c.z}" oninput="phEdit.crop.z=+this.value;layoutCrop()" aria-label="Zoom"></label>
  <p class="mut" style="margin:2px 0 6px;font-size:13px">Drag the picture to position it.</p>
  <div class="btns"><button class="pri" type="button" onclick="applyCrop('${i.id}')">Apply</button><button type="button" onclick="phEdit.crop=null;renderWardrobe()">Cancel</button></div></div>`}
function cropGeom(){const c=phEdit.crop,box=$('#cropbox');if(!c||!box)return null;const V=box.clientWidth,s=V/Math.min(c.w,c.h)*c.z,W=c.w*s,H=c.h*s;
  // keep the frame inside the picture
  const hx=V/2/W,hy=V/2/H;c.cx=Math.min(1-hx,Math.max(hx,c.cx));c.cy=Math.min(1-hy,Math.max(hy,c.cy));
  return {V,s,W,H,x:V/2-c.cx*W,y:V/2-c.cy*H}}
function layoutCrop(){const g=cropGeom(),img=$('#cropimg');if(!g||!img)return;Object.assign(img.style,{width:g.W+'px',height:g.H+'px',left:g.x+'px',top:g.y+'px'})}
function cropDrag(e){const c=phEdit.crop;if(!c)return;e.preventDefault();const box=e.currentTarget;box.setPointerCapture&&box.setPointerCapture(e.pointerId);let lx=e.clientX,ly=e.clientY;
  const mv=ev=>{const g=cropGeom();if(!g)return;c.cx-=(ev.clientX-lx)/g.W;c.cy-=(ev.clientY-ly)/g.H;lx=ev.clientX;ly=ev.clientY;layoutCrop()};
  const up=()=>{box.removeEventListener('pointermove',mv);box.removeEventListener('pointerup',up);box.removeEventListener('pointercancel',up)};
  box.addEventListener('pointermove',mv);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up)}
async function applyCrop(id){const it=items.find(x=>x.id===id),g=cropGeom();if(!it||!g)return;
  const im=await cropSource(it),f=(im.naturalWidth||im.width)/phEdit.crop.w;   // the frame is measured on the photo; f scales it to the source
  const side=g.V/g.s*f,sx=-g.x/g.s*f,sy=-g.y/g.s*f,out=Math.min(PH_MAX,Math.round(side)),c=document.createElement('canvas');c.width=c.height=out;
  c.getContext('2d').drawImage(im,sx,sy,side,side,0,0,out,out);phEdit.crop=null;await setPhoto(id,c.toDataURL('image/jpeg',.9));
  if(typeof resignTagImg==='function')await resignTagImg(id,it.photo)}   // the same picture, cropped: the sharp copy (and the pattern's box on it) still holds
/* the item page's body (see "Wardrobe item page" below): the photo beside the drawn swatch with its tools folded under it, then a
   card for the tags, one for rotation, and Delete on its own at the very end */
function toggleCompare(closeOnly){const el=$('#ivpair');if(!el||(closeOnly&&!phEdit.cmp))return;phEdit.cmp=!phEdit.cmp;el.classList.toggle('cmp',!!phEdit.cmp);el.querySelector('.tagsw').setAttribute('aria-pressed',!!phEdit.cmp)}
function togglePhotoTools(){phEdit.open=!phEdit.open;const el=$('#ivph');if(!el)return;el.classList.toggle('open',!!phEdit.open);el.querySelector('.ivphbtn').setAttribute('aria-expanded',!!phEdit.open)}
function itemBody(i){
  if(phEdit.id!==i.id)phEdit={id:i.id,undo:[],crop:null};
  const cols=COLOR_OPTS(i.type,primaryCol(i)),acc=c=>[['none','None'],...COLOR_OPTS(i.type,c,true)],pic=i.photo||wardPic(i);
  // with a close-up, the split swatch is a button: tapped, the drawing slides over the photo and the close-up fills its square, to
  // compare the two whole; a tap on either square puts them back (toggleCompare; the choice lasts while the item stays open)
  const cmp=pic&&i.texture&&TEXTURE_TYPES.includes(i.type);
  const pair=!pic?`<div class="ivdraw">${itemThumb(i)}</div>`:!cmp?photoPair(pic,i,'tagsw-'+i.id):`<div class="pair cmpable${phEdit.cmp?' cmp':''}" id="ivpair"><figure class="phfig" onclick="toggleCompare(true)"><div class="cmpbox"><img class="ph" src="${pic}" alt="Photo"><div class="cmpdraw" aria-hidden="true">${itemThumb(i,true)}</div></div><figcaption><span class="c0">Photo</span><span class="c1">As tagged</span></figcaption></figure>`+
    `<figure class="tagsw" id="tagsw-${i.id}" role="button" tabindex="0" aria-pressed="${!!phEdit.cmp}" aria-label="Compare the drawing and the close-up side by side" onclick="toggleCompare()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCompare()}">${tagSwInner(i)}<figcaption class="c1">Close-up</figcaption></figure></div>`;
  const hero=phEdit.crop?cropEditor(i):`<div class="ivhero">${pair}</div>`;
  const tags=`<section class="card ivsec ivtags"><h3>Details</h3>${wardFieldsTop(i)}${COLORS[primaryCol(i)]?shadeRow(i,`stepShadeE.bind(null,'${i.id}')`,`matchShadeE('${i.id}')`,!!(i.texture||(i.meas&&i.meas.src==='closeup'))):''}${E(i.id,'type',Object.entries(TYPES),i.type)}${EC(i.id,'primaryColor',primaryCol(i))}${EC(i.id,'secondaryColor',i.secondaryColor||'none',i.type==='socks'?'Toe cap':'')}${i.type==='socks'?'':EC(i.id,'tertiaryColor',i.tertiaryColor||'none')}
  ${FABRIC.includes(i.type)?EP(i.id,i):''}${METAL_TYPES.includes(i.type)?E(i.id,'metal',Object.keys(METAL).map(c=>[c,c]),i.metal||'silver'):''}
  ${i.type==='shirt'?E(i.id,'cuff',CUFFS,i.cuff||'button'):''}${i.type==='suit'?E(i.id,'vest',VESTS,hasVest(i)?'yes':'no'):''}${SEASON_TYPES.includes(i.type)?E(i.id,'season',SEASONS,i.season||'all'):''}
  ${i.type==='pants'?E(i.id,'trouserKind',TROUSER_KINDS,trouserKind(i)):''}${i.type==='shoes'?E(i.id,'shoeStyle',SHOE_STYLES,shoeStyle(i)):''}${i.type==='shoes'||i.type==='belt'?E(i.id,'leather',leathersFor(i).map(c=>[c,cap1(leatherWord(i,c))]),i.leather||'calf',leatherLabel(i)):''}
  ${i.type==='watch'?`<label class="wdetails">Details <input type="text" value="${esc(i.details||'')}" placeholder="e.g. three subdials, 12 and 6 numerals" onchange="sete('${i.id}','details',this.value.trim()||'none')"></label>`:''}${i.type==='watch'?E(i.id,'dial',DIAL_OPTS(watchOpts(i).dial),watchOpts(i).dial)+E(i.id,'band',BANDS,watchOpts(i).band)+E(i.id,'bezel',BEZELS,watchOpts(i).bezel)+E(i.id,'watchStyle',WATCH_STYLES,watchOpts(i).style):''}
  ${DETECT_PATS.includes(patBase(i.pattern))||settable(i.type,i.pattern,i.weave)||claudeOnly(i.type,i.pattern)||i.sett?`<div class="ivpat"><p class="shelp">Pattern layout: ${patSummary(i)}</p><div class="btns">${claudeOnly(i.type,i.pattern)&&!isConnected()?'':`<button id="readpat-btn" onclick="${i.texture||i.pbox||claudeOnly(i.type,i.pattern)?`rereadSett('${i.id}')`:`redetect('${i.id}')`}">Read pattern from photo</button>`}${i.stripes||i.sett?`<button onclick="clearStripes('${i.id}')">Use generic</button>`:''}</div></div>`:''}${['suit','blazer','pants'].includes(i.type)&&i.texture&&typeof asmFabTag==='function'&&asmFabTag(ASM_CM_ZONE[i.type],i)?`<div class="ivpat ivcloth"><p class="shelp">Cloth: ${esc(clothSummary(i))}</p>${isConnected()?`<div class="btns"><button id="readcloth-btn" onclick="readCloth('${i.id}')">Read cloth with Claude</button></div>`:''}</div>`:''}${typeof asmGapNote==='function'?asmGapNote(i):''}${wardFieldsEnd(i)}</section>`;
  // the photo tools stay beside the photos: one row when there is nothing to edit yet, else folded under "Edit photos"
  const photos=phEdit.crop?'':i.photo||i.texture?`<div class="ivph${phEdit.open?' open':''}" id="ivph"><button type="button" class="ivphbtn" onclick="togglePhotoTools()" aria-expanded="${!!phEdit.open}" aria-controls="ivphp">Edit photos<svg class="ivchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="ivphp" id="ivphp"><div>${photoTools(i)}</div></div></div>`:`<div class="ivph bare">${photoTools(i)}</div>`;
  const rot=`<section class="card ivsec ivrot"><h3>Rotation</h3>${i.paused?(i.order?`<div class="rotnote ordrow"><p class="shelp">On the way: it isn't in your outfits yet.</p><label class="ordate">Arrives (optional) <input type="date" value="${i.arrives||''}" onchange="setItemArrives('${i.id}',this.value)"></label><small class="mut ordhint">${orderHint(i.arrives)}</small></div>`:i.away?'<p class="shelp rotnote">Away being cleaned: it is out of your outfits until it is back (see Care below).</p>':'<p class="shelp rotnote">Out of rotation: the planner won\'t pick it, and it isn\'t offered when you change a piece. Outfits you already wore keep it.</p>'):'<p class="shelp">In rotation: the planner picks it for your outfits.</p>'}
  ${i.away?'':`<div class="btns"><button class="rotbtn${i.paused?' on':''}" onclick="togglePause('${i.id}')" aria-pressed="${!!i.paused}">${i.paused?(i.order?'It arrived: put in rotation':'Put back in rotation'):'Take out of rotation'}</button></div>`}</section>${typeof careCard==='function'?careCard(i):''}`;
  return `<div class="ivin">${hero}${photos}${tags}${rot}<div class="ivdup"><button type="button" id="iv-dup" onclick="kitDuplicate('${i.id}')">Duplicate this item</button></div><div class="ivdel"><button class="danger" onclick="rm('${i.id}')">Delete item</button></div></div>`;
}
async function sete(id,k,v){
  const it=items.find(x=>x.id===id);if(!it)return;
  it[k]=v==='none'?null:v;
  if(k==='shoeStyle'&&!leathersFor(it).includes(it.leather))it.leather='calf';   // a sneaker can't be cordovan: back to plain leather
  if(k==='type'){it.pattern=normPat(v,it.pattern);shirtColFix(it);if(v==='watch'&&!it.metal)it.metal='silver';if((v==='shoes'||v==='belt')&&!it.leather)it.leather='calf';if(v==='belt'&&!it.metal)it.metal='silver'}
  if(k==='primaryColor')delete it.color;
  if((k==='primaryColor'||k==='type')&&it.swSrc==='tex')await refreshSwatch(it);   // the close-up swatch takes its lightness from the colour
  await put(it);cache={};renderWardrobe();
}
function patSummary(i){
  if(usableSett(i))return settSummary(i.sett);
  if(i.sett&&i.sett.tex)return `generic (the weave texture read earlier is for a ${TEX_WORDS[i.sett.tex.kind]||'woven'} pattern)`;
  if(i.sett)return `generic (an older reading drew these ${patName(i.pattern).toLowerCase()} figures as stripes; Read pattern from photo reads them as figures)`;
  const st=i.stripes;if(!st)return 'generic';
  if(st.kind==='check')return `check read from photo (${st.b.length}×${st.v.length} bands)`;
  return `stripes read from photo (${st.b.length} bands, ${Math.abs(st.a)}°)`;
}
async function redetect(id){
  const it=items.find(x=>x.id===id);if(!it)return;
  const load=src=>new Promise(r=>{if(!src)return r(null);const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src});
  let st=null;
  const sw=await load(it.swatch);if(sw)st=detectPattern(it,sw,0,0,sw.width);
  if(!st){const ph=await load(it.photo);if(ph){const mn=Math.min(ph.width,ph.height)*.7;st=detectPattern(it,ph,(ph.width-mn)/2,(ph.height-mn)/2,mn)}}
  if(!st){tell('Could not find a clear repeating pattern in the photo. Adding it again with the fabric in the middle of the picture usually works.');return}
  it.stripes=st;await put(it);cache={};renderWardrobe();
}
/* take an item out of rotation, or put it back. Taking it out also lets go of the upcoming days it was pinned to (a swap or a
   hand pick), so those days are planned again without it; past days and days marked worn keep it. */
async function setItemArrives(id,v){const it=items.find(x=>x.id===id);if(!it)return;if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))it.arrives=v;else delete it.arrives;await put(it);cache={};
  if(await checkArrivals())return renderWardrobe();renderWardrobe()}
async function togglePause(id){const it=items.find(x=>x.id===id);if(!it)return;it.paused=!it.paused;if(!it.paused){delete it.paused;delete it.order;delete it.arrives}
  let n=0;if(it.paused){const T=todayDate();
    for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<T||r.worn===true||!r.force)continue;const f={...r.force};let hit=false;
      for(const [s,v] of Object.entries(f))if(v===id){delete f[s];hit=true}
      if(hit){const nr={...r,force:f};if(!Object.keys(f).length)delete nr.force;delete nr.ids;await saveDay(nr,true);n++}}}
  await put(it);cache={};renderWardrobe();
  toast(it.paused?`Out of rotation: the planner won't pick it${n?`, and ${n} upcoming day${n===1?' was':'s were'} planned again without it`:''}.`:'Back in rotation.')}
async function clearStripes(id){const it=items.find(x=>x.id===id);if(!it)return;delete it.stripes;delete it.sett;await put(it);cache={};renderWardrobe()}
async function rm(id){return wardDelete(id)}   // at once, with Undo in a toast (wardrobe.js)


/* ---- Wardrobe item sheet ----
   Tapping an item opens it in a sheet that slides up over the Wardrobe: the full width of a phone, to just under the top of the
   screen (a centred panel from 600px). The grid behind never moves, so closing puts you back exactly where you were. Ways out:
   swipe the sheet down (by its header at any time; by its content once that is scrolled to the top), Done in the bar at the
   bottom, a tap on the strip of Wardrobe left above it, the phone's Back button or gesture, Esc. ‹ › beside Done, a sideways
   swipe or the arrow keys go to the previous / next item of the list on screen. */
const WARD_EASE='cubic-bezier(.2,.8,.2,1)',WARD_MS=320;
const wardList=()=>wardView();   // the filtered, sorted list on screen (wardrobe.js)
const noMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate;
let itemFrom=null;   // the item the sheet was opened on: closing on another one brings that one's box into view first
/* the phone's Back closes the page: one history entry while it is open (itemBack: a history.back() of ours is on its way) */
let itemHist=false,itemBack=false;
try{history.scrollRestoration='manual'}catch{}   // stepping back must not move the Wardrobe (the page scrolls it to the item it closes on)
function histPush(){if(itemHist||itemBack||appPend)return;   // (appPend: a step back that drops Settings' or a stats/packing/care page's entry is on its way; the item gets its entry once it lands)
try{history.pushState({item:1},'');itemHist=true}catch{}}
function histDrop(){if(!itemHist)return;itemHist=false;itemBack=true;try{history.back()}catch{itemBack=false}}
addEventListener('popstate',()=>{
  if(itemBack){itemBack=false;if(editing)histPush();return}   // our own step back; an item opened meanwhile gets its entry now
  if(itemHist){itemHist=false;if(editing)closeItem(true)}});
/* show or hide the sheet; while it is up the app behind it takes no taps or keyboard focus */
function itemShown(on){const v=$('#item-view'),bd=$('#item-backdrop');if(!v)return;const was=v.classList.contains('on');
  v.classList.toggle('on',on);if(bd)bd.classList.toggle('on',on);document.body.classList.toggle('iv-on',on);
  if(typeof layerInert==='function')layerInert();else for(const el of document.querySelectorAll('body>header,main,body>nav'))el.inert=on;   // (ui.js: counts Settings and the sheets too)
  if(was&&!on&&typeof syncLaterRun==='function')setTimeout(()=>syncLaterRun('wardrobe'),0)}   // a sync's redraw that waited for the sheet (sync.js)
/* draws the open item (called by renderWardrobe, so every edit redraws it; the scroll position stays) */
function renderItem(){
  const v=$('#item-view');if(!v)return;const i=editing&&items.find(x=>x.id===editing);
  if(!i){editing=null;itemShown(false);return}
  const l=wardList(),k=l.findIndex(x=>x.id===i.id);
  $('#ivhead').innerHTML=`<div class="ivt"><small class="gtype">${TYPES[i.type]||'Item'}</small><h2 id="iv-title" class="${titleCls(i)}">${esc(itemTitle(i)||TYPES[i.type]||'Item')}</h2></div>${k>=0?`<span class="pcount">${k+1} of ${l.length}</span>`:''}`;
  $('#ivbody').innerHTML=itemBody(i);
  $('#iv-prev').disabled=k<=0;$('#iv-next').disabled=k<0||k>=l.length-1;
  itemShown(true)}
const sheetSlides=()=>innerWidth<600;   // a phone: the sheet slides up from the bottom; wider, the panel fades in
function openItem(id){
  if(!items.some(i=>i.id===id))return;const v=$('#item-view'),bd=$('#item-backdrop'),was=editing;
  editing=id;if(!was)itemFrom=id;histPush();renderItem();$('#ivbody').scrollTop=0;
  for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}
  if(was||noMotion())return;const o={duration:WARD_MS,easing:WARD_EASE};
  v.animate(sheetSlides()?[{transform:'translateY(100%)'},{transform:'none'}]:[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'none'}],o);
  bd.animate([{opacity:0},{opacity:1}],{duration:WARD_MS})}
/* fromPop: the Back button did it (its history entry is gone already); dragged: how far down the sheet was let go, in px */
function closeItem(fromPop,dragged){
  const id=editing,v=$('#item-view'),bd=$('#item-backdrop');if(!id||!v)return;const moved=id!==itemFrom;
  editing=null;itemFrom=null;if(!fromPop)histDrop();
  const y=dragged||0,op=+bd.style.opacity||1;v.style.transform=bd.style.opacity='';
  if(noMotion()){renderItem();return}
  v.classList.add('closing');bd.classList.add('closing');renderItem();   // the sheet stays up, drawn as it was, while it slides away
  const t=$('#gi-'+id);if(t&&moved)t.scrollIntoView({block:'center'});   // it was reached with ‹ ›: show where it lives
  const o={duration:WARD_MS-60,easing:dragged?'ease-out':'cubic-bezier(.4,0,.8,.4)',fill:'forwards'};
  const an=v.animate(sheetSlides()?[{transform:`translateY(${y}px)`},{transform:'translateY(100%)'}]:[{opacity:1,transform:`translateY(${y}px)`},{opacity:0,transform:`translateY(${y+24}px)`}],o);
  bd.animate([{opacity:op},{opacity:0}],{duration:WARD_MS-60,fill:'forwards'});
  an.finished.catch(()=>{}).then(()=>{if(editing)return;for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing')}})}
/* closing with nothing to slide away from: the item was deleted, or another tab is shown */
function dropItem(){editing=null;itemFrom=null;histDrop();for(const el of [$('#item-view'),$('#item-backdrop')])if(el){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}itemShown(false)}
/* swiping the sheet down closes it. The header is a handle at any time; the content is one only while it is scrolled to the
   top (further down, a downward swipe scrolls it back up, as it must). The choice is made on the first move of a touch, before
   the browser starts scrolling. The sheet follows the finger and the Wardrobe behind brightens; let go past a quarter of the
   sheet's height, or with a flick, and it closes, else it springs back. Not while cropping (the crop frame is dragged). */
let ivDrag=false;
(()=>{const v=$('#item-view'),b=$('#ivbody'),bd=$('#item-backdrop');if(!v||!b)return;let st=null;
  const put=d=>{v.style.transform=d?`translateY(${d}px)`:'';if(bd)bd.style.opacity=d?String(Math.max(.15,1-d/v.offsetHeight)):''};
  v.addEventListener('touchstart',e=>{const t=e.touches[0],head=!!e.target.closest('.ivhead');
    st=!editing||e.touches.length>1||v.classList.contains('closing')||phEdit.crop||e.target.closest('input,textarea,.ivbar')||(!head&&b.scrollTop>0)?null:{x:t.clientX,y:t.clientY,t:Date.now(),on:false,d:0,ly:t.clientY,lt:e.timeStamp,vy:0}},{passive:true});
  v.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.on){if(dy>0&&dy>=Math.abs(dx)){st.on=ivDrag=true;v.style.transition='none'}else{st=null;return}}   // downward: ours; anything else is a scroll or a sideways swipe
    // the speed from when each touch happened (e.timeStamp), not when it was handled, as in shop.js: on a busy phone a flick handled late read as a slow pull
    e.preventDefault();const now=e.timeStamp;if(now>st.lt){st.vy=(t.clientY-st.ly)/(now-st.lt);st.ly=t.clientY;st.lt=now}
    st.d=Math.max(0,dy);put(st.d)},{passive:false});
  const end=()=>{
    if(!st)return;const {on,d,vy}=st;st=null;if(!on)return;ivDrag=false;v.style.transition='';
    if(d>v.offsetHeight*.25||(vy>.5&&d>30)){closeItem(false,d);return}
    put(0);if(!noMotion()){v.animate([{transform:`translateY(${d}px)`},{transform:'none'}],{duration:220,easing:WARD_EASE});if(bd)bd.animate([{opacity:Math.max(.15,1-d/v.offsetHeight)},{opacity:1}],{duration:220})}};
  v.addEventListener('touchend',end,{passive:true});v.addEventListener('touchcancel',end,{passive:true});
})();
/* the previous / next item of the list on screen; the new one slides in from the side it lies on */
function stepItem(n,from){
  const l=wardList(),k=l.findIndex(x=>x.id===editing),t=l[k+n];if(k<0||!t)return false;
  editing=t.id;renderItem();const b=$('#ivbody');b.scrollTop=0;
  const el=b.firstElementChild;if(el&&!noMotion())el.animate([{transform:`translateX(${from===undefined?n*56:from}px)`,opacity:0},{transform:'none',opacity:1}],{duration:220,easing:WARD_EASE});
  return true}
(()=>{const b=$('#ivbody');if(!b)return;let st=null;const inn=()=>b.firstElementChild;
  b.addEventListener('touchstart',e=>{const t=e.touches[0];
    st=e.touches.length>1||phEdit.crop||t.clientX<24||t.clientX>innerWidth-24||e.target.closest('input,textarea,.cropwrap')?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}},{passive:true});   // a swipe may start on a dropdown: half the page is dropdowns
  b.addEventListener('touchmove',e=>{
    if(ivDrag)st=null;if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;e.preventDefault();
    const l=wardList(),k=l.findIndex(x=>x.id===editing),edge=k<0||(dx>0&&k<=0)||(dx<0&&k>=l.length-1);   // nothing that way: resist
    st.dx=dx;const el=inn();if(el){const x=edge?dx/4:dx;el.style.transition='none';el.style.transform=`translateX(${x}px)`;el.style.opacity=String(1-Math.min(.5,Math.abs(x)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const el=inn();if(lock!=='x'||!el)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5,n=dx<0?1:-1;
    if(!((Math.abs(dx)>70||(fast&&Math.abs(dx)>30))&&stepItem(n,n*Math.min(innerWidth*.5,220)))){
      el.style.transition='transform .2s ease-out,opacity .2s';el.style.transform='translateX(0)';el.style.opacity='1'}};
  b.addEventListener('touchend',end,{passive:true});b.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(!editing)return;
    if(e.key==='Escape'){if(phEdit.crop){phEdit.crop=null;renderWardrobe()}else closeItem();return}
    if(e.target.closest&&e.target.closest('input,select,textarea'))return;
    if(e.key==='ArrowRight')stepItem(1);if(e.key==='ArrowLeft')stepItem(-1)});
})();
/* swiping the Wardrobe moves between the type filters (All, Suit, Blazer, …) in chip order, skipping types with no items;
   only the grid slides. Not while an item is open (its editor has sliders and the photo crop), nor on the chips row itself. */
const wardTypes=()=>['all',...Object.keys(TYPES).filter(t=>items.some(i=>i.type===t))];
function stepType(n,from){
  const l=wardTypes();let k=l.indexOf(flt);if(k<0)k=0;const j=k+n;if(j<0||j>=l.length)return false;
  flt=l[j];renderWardrobe();const sl=$('#wslide');if(!sl)return true;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x)return true;
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';return true}
(()=>{const el=$('#wardrobe');let st=null;const slide=()=>$('#wslide');
  el.addEventListener('touchstart',e=>{const t=e.touches[0];
    st=e.touches.length>1||editing||t.clientX<24||t.clientX>innerWidth-24||e.target.closest('.chips,input,select,textarea,.cropwrap')?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}},{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8))st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
    if(st.lock!=='x')return;e.preventDefault();
    const l=wardTypes(),k=l.indexOf(flt),edge=(dx>0&&k<=0)||(dx<0&&k>=l.length-1);   // nothing further that way: resist
    st.dx=dx;const sl=slide();if(sl){const v=edge?dx/4:dx;sl.style.transition='none';sl.style.transform=`translateX(${v}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(v)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t}=st;st=null;const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5,n=dx<0?1:-1,l=wardTypes(),k=l.indexOf(flt),j=(k<0?0:k)+n;
    if((Math.abs(dx)>70||(fast&&Math.abs(dx)>30))&&j>=0&&j<l.length){const w=sl.offsetWidth||innerWidth;
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepType(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}};
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  document.addEventListener('keydown',e=>{if(el.hidden||editing||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepType(1);if(e.key==='ArrowLeft')stepType(-1)});
})();
/* in the Wardrobe, shoes, belts and socks show their realistic product picture when there is one */
const WARD_PIC_TYPES=['shoes','belt','socks'];
const wardPic=i=>{if(!WARD_PIC_TYPES.includes(i.type))return null;const p=itemPic(i);if(p)return p.img;setTimeout(()=>fetchItemPic(i),0);return null};
function renderWardrobe(){
  closeSettings();if(editing!==phEdit.id)phEdit={id:null,undo:[],crop:null};   // undo lasts while the item stays open
  const wf=wardKeep();
  const cnt=t=>t==='all'?items.length:items.filter(i=>i.type===t).length;
  const chips=['all',...Object.keys(TYPES)].map(t=>`<button class="chip ${flt===t?'on':''}" onclick="flt='${t}';renderWardrobe()">${t==='all'?'All':TYPES[t]} ${cnt(t)}</button>`).join('');
  const list=wardFresh();
  $('#wardrobe').innerHTML=`<div class="phead"><h2>Wardrobe</h2><span class="pcount" id="wcount">${wardCount(list)}</span><button type="button" class="pri padd" id="ward-add" onclick="openAdd()">+ Add</button></div>${items.length?wardBar()+`<div class="chips">${chips}</div>`:''}<div class="wslide" id="wslide">`+wardGrid(list)+'</div>';
  const on=document.querySelector('#wardrobe .chip.on');if(on){const c=on.parentElement;c.scrollLeft=Math.max(0,on.offsetLeft-c.offsetLeft-(c.clientWidth-on.offsetWidth)/2)}
  renderItem();wardBack(wf);
}

