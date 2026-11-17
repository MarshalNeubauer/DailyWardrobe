/* Daily Wardrobe: the Wardrobe's item sheet and editor (the item's photo: replace, rotate, crop) and the Wardrobe grid
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
let editing=null;
const E=(id,k,list,v,lab)=>`<label>${lab?lab:k==='primaryColor'?'Color':k==='secondaryColor'?'Second color':k==='tertiaryColor'?'Third color':k==='watchStyle'||k==='shoeStyle'?'Style':k==='trouserKind'?'Kind':k[0].toUpperCase()+k.slice(1)} <select onchange="sete('${jsq(id)}','${k}',this.value)">${list.map(x=>`<option value="${x[0]}" ${x[0]===v?'selected':''}>${cap1(x[1])}</option>`).join('')}</select></label>`;
/* ---- Wardrobe editor: replace, rotate, zoom-crop the item's photo. Only the picture changes: the tags (colour, pattern...)
   and the item itself stay, so the plan and the outfit history are untouched. Each change's toast has Undo (picUndo; phEdit.undo holds the editor's steps). ---- */
let phEdit={id:null,undo:[],crop:null};
const PH_MAX=1536;   // the item photo (2026-11-13, the owner: "upgrade the main photo size stored as well"; it was 720, before that 360)
/* the photo's small copy for grids and lists (the wardrobe, stats, the piece picker): PH_SM px, kept on the item with the photo's signature
   (photoSm, phSig) and made again whenever the photo changes (makeSmall); every redraw of the wardrobe would otherwise carry the full photos */
const PH_SM=480;
const phSm=i=>i&&i.photo?(i.photoSm&&i.phSig===phSigOf(i.photo)?i.photoSm:i.photo):null;
const phSigOf=u=>u?u.length+':'+u.slice(-48):'';
async function makeSmall(it){if(!it)return false;if(!it.photo){const had=!!it.photoSm;delete it.photoSm;delete it.phSig;return had}
  const sig=phSigOf(it.photo);if(it.photoSm&&it.phSig===sig)return false;
  try{const im=await imgOf(it.photo);let sm=it.photo;if(Math.max(im.naturalWidth,im.naturalHeight)>PH_SM){const c=shrink(im,PH_SM);if(deadCanvas(c))return false;sm=c.toDataURL('image/jpeg',.82)}   // drawn black: keep the old copy
    it.photoSm=sm;it.phSig=sig;return true}catch{return false}}
/* at start-up: items whose small copy is missing or old (added before it, or changed on a device with an older app) */
/* (a connected phone makes at most the day's remakes, migrate.js remakeLeft: each small copy can be a new server value; the rest the next days) */
async function smallPhotos(){let n=0;for(const it of items){if(!it.photo||(it.photoSm&&it.phSig===phSigOf(it.photo)))continue;if(typeof remakeLeft==='function'&&remakeLeft()<1)break;
  if(await makeSmall(it)&&stillCur(it)){await put(it);if(typeof remakeSpend==='function')remakeSpend(1);n++}}if(n)fixupRedraw();return n}
/* ---- the photo tools (2026-11-15, edit-photos-mockups option B, the owner's choice; they were folded under "Edit photos"): one row of
   icon-and-label buttons right under the pictures, Replace (the photo's file window), Rotate, Crop (zoom & crop) and Close-up (on a touch
   screen the close-up chooser: Take / Choose / Remove / Cancel; without touch the file window itself, with Remove close-up under the row).
   Each change says so in a toast with Undo (picUndo); the row's own Undo button went with the fold. With no photo: Add photo. The close-up's
   reading lives in the "Color & texture" card under the row (itemBody). ---- */
const PT_ICON={replace:'<path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  rotate:'<path d="M20 11a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',crop:'<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
  closeup:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/><path d="M8 9l6 4M8 13l6-4" opacity=".6"/>'};
const ptIcon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${PT_ICON[k]}</svg>`;
function photoTools(i){if(phEdit.crop)return '';const tex=lookCu(i.type),id=i.id;   // (look.js lookCu: TEXTURE_TYPES, more types with the Look beta on)
  const rm=tex&&i.texture?`setTexture('${jsq(id)}',null,'Close-up removed.')`:'';
  return `<div class="phtools" role="group" aria-label="Photo tools"><label class="btn ptbtn pt-replace">${ptIcon('replace')}<span>${i.photo?'Replace':'Add photo'}</span><input type="file" accept="image/*" class="vfile" aria-label="${i.photo?'Replace photo':'Add photo'}" onchange="replacePhoto('${jsq(id)}',this.files[0]);this.value=''"></label>`+
    (i.photo?`<button type="button" class="ptbtn pt-rotate" onclick="rotatePhoto('${jsq(id)}')" aria-label="Rotate the photo a quarter turn clockwise">${ptIcon('rotate')}<span>Rotate</span></button><button type="button" class="ptbtn pt-crop" onclick="startCrop('${jsq(id)}')" aria-label="Zoom and crop the photo">${ptIcon('crop')}<span>Crop</span></button>`:'')+
    (tex?closeupBtn({label:`${ptIcon('closeup')}<span>Close-up</span>`,cls:'btn ptbtn pt-closeup',mode:i.texture?'replace':'add',aria:i.texture?'Replace close-up':'Add fabric close-up',file:`f=>replaceTexture('${jsq(id)}',f)`,remove:rm,cloth:paperCloth(i)}):'')+`</div>`+
    (rm&&!cuTouch()?`<div class="ptmore"><button type="button" class="ptrm" onclick="${rm}">Remove close-up</button></div>`:'')}   // on a touch screen Remove is in the close-up chooser (ui.js)
/* ---- white paper in the close-up (2026-11-15, the owner's choice: option A "juiced up" + screens 04-06, photo-wb-mockups): one line of help
   under the close-up buttons with a small drawing beside it (the item's cloth with a strip of white paper along one edge and the
   tap on it, drawn in CSS: no picture to download, both themes); the drawing opens the short tip (PAPER_CARD in kit.js). After a close-up
   is added or replaced here, a line under the photos says whether paper was found (paperOf in measure.js), with Retake close-up. ---- */
/* the hint as "3 tiny steps" (2026-11-15, paper-hint-proposals A, the owner's choice; it was a sentence and a "Tips for a good close-up"
   link): "True color in 3 steps", Paper on an edge › Tap the paper › Take the photo, each with a small drawing (the owner's, at 40 px).
   The whole card is one button that opens the short tip (paperTip; its last line opens the full guide). Also in the Add card's Step 2. */
const paperCloth=i=>{try{return COLORS[primaryCol(i)]?colOf(i):'#5d6478'}catch{return '#5d6478'}};
const PAPER_CAM='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>';
const paperSteps=cloth=>{const pic=cls=>`<span class="wbpic ${cls}" style="--cloth:${cloth}"><i></i></span>`;
  return `<div class="wbsteps"><button type="button" class="wbstcard" onclick="paperTip()" aria-label="True color in 3 steps: lay white paper along one edge, tap the paper on screen, take the photo. Open tips.">
<span class="hd" aria-hidden="true"><span class="eb">True color in 3 steps</span><span class="more">Tips ›</span></span>
<span class="ol" aria-hidden="true"><span class="li"><span class="n"><b>1</b>${pic('nobox noring')}</span>Paper on an edge</span><span class="arr">›</span>
<span class="li"><span class="n"><b>2</b>${pic('')}<span class="tap"></span></span>Tap the paper</span><span class="arr">›</span>
<span class="li"><span class="n"><b>3</b><span class="cam">${PAPER_CAM}</span></span>Take the photo</span></span></button></div>`};
const paperHint=i=>paperSteps(paperCloth(i));
function paperTip(){if(typeof kitOpen==='function')kitOpen([PAPER_CARD])}
const paperRetake=(id,fn)=>closeupBtn({label:'Retake close-up',cls:'linkbtn wbretake',mode:'retake',file:`f=>${fn}('${jsq(id)}',f)`,cloth:paperCloth(items.find(x=>x.id===id)||{})});
function paperLine(i){if(!i.texture||!lookCu(i.type)||phEdit.paper!==texSig(i.texture))return '';const r=paperNow(i);if(!r)return '';
  return r.ref?`<div class="wbst ok" id="ivwb" role="status"><span class="ic" aria-hidden="true">✓</span><span class="tx">White paper found<small>Colors set from it.</small></span></div>`
    :`<div class="wbst no" id="ivwb" role="status"><span class="ic" aria-hidden="true">!</span><span class="tx">${r.warm?'No white paper, and the light looks warm<small>Colors may come out yellower than the cloth.</small>':'No white paper<small>Colors may be off.</small>'}</span>${paperRetake(i.id,'replaceTexture')}</div>`}
const imgOf=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src});
/* (msg: a toast's text, which gets Undo (picUndo), or toast()'s arguments; the editor's Undo only for the item it is open on: a crop kept as
   the sheet closed lands later) */
/* a new photo or close-up the browser drew pure black is refused with DEAD_MSG (app.js), nothing saved: crop, rotate and replace all
   come through here (2026-11-15) */
async function setPic(id,k,url,msg){const it=items.find(x=>x.id===id);if(!it)return;if(url&&await deadPic(url)){toast(DEAD_MSG,8000);return false}
  const prev=it[k]||null;if(phEdit.id===id||!phEdit.id){phEdit.undo.push({k,v:prev});if(phEdit.undo.length>10)phEdit.undo.shift()}
  if(url)it[k]=url;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);planDirty();renderWardrobe();
  if(msg)Array.isArray(msg)?toast(...msg):toast(msg,4000,{label:'Undo',fn:()=>picUndo(id,k,prev)})}
/* a toast's Undo: the editor's own Undo while the sheet is still on this item and that change is the last one, else the picture as it was
   (the sheet may be closed or on another item by then) */
async function picUndo(id,k,prev){const it=items.find(x=>x.id===id);if(!it)return;const top=phEdit.undo[phEdit.undo.length-1];
  if(editing===id&&phEdit.id===id&&top&&top.k===k&&top.v===(prev||null)){await undoPhoto(id);return}
  if(prev)it[k]=prev;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);planDirty();renderWardrobe()}
const setPhoto=(id,url,msg)=>setPic(id,'photo',url,msg),setTexture=(id,url,msg)=>setPic(id,'texture',url,msg);
/* a close-up added later stays as taken: the item photo's light reading may not hold for another moment */
/* a close-up under TEX_MIN_PX on its short side is refused, as on the Add card (2026-11-15, the re-audit: the editor took a 40×40 one) */
async function replaceTexture(id,f){if(!f)return;try{const img=await loadImg(f);
  if(Math.min(img.width,img.height)<TEX_MIN_PX){toast(`That close-up is too small to show the weave (${img.width}×${img.height} pixels). Take it close to the cloth, at full size.`,6000);return}
  const sharp=shrink(img,CLOSE_MAX).toDataURL('image/jpeg',TAG_Q),tex=shrink(img,TEX_MAX).toDataURL('image/jpeg',.85),cur=items.find(x=>x.id===id);
  if(cur){await paperOf({texture:tex,photo:cur.photo,photoSm:cur.photoSm,phSig:cur.phSig});if(phEdit.id===id)phEdit.paper=texSig(tex)}   // the paper line under the photos (paperLine)
  if(await setTexture(id,tex,'Close-up added.')===false)return;   // drawn black (setPic): nothing saved, no sharp copy kept. (outfit photos are no longer made: "the realistic photos use it" promised nothing, 2026-11-15)
  const it=items.find(x=>x.id===id);if(it&&it.texture)await keepCloseImg(id,sharp,it.texture)}   // the sharp copy for pattern and colour readings (tag-request.js)
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
/* the toast's Undo after Replace or Rotate: the photo back, with the sharp copy and the pattern's box it had (when Undo put the photo back) */
const photoUndoAct=(id,prev,sharp,pbox)=>({label:'Undo',fn:async()=>{await picUndo(id,'photo',prev);const it=items.find(x=>x.id===id);if(!it||!prev||it.photo!==prev)return;
  if(pbox){it.pbox=pbox;await put(it)}if(sharp)await keepTagImg(id,sharp,prev)}});
async function replacePhoto(id,f){if(!f)return;try{const img=await loadImg(f),sharp=shrink(img,TAG_MAX).toDataURL('image/jpeg',TAG_Q),it=items.find(x=>x.id===id);
  const prev=it&&it.photo||null,pbox=it&&it.pbox,old=prev&&typeof tagImgOf==='function'?await tagImgOf(id,it):null;if(it)delete it.pbox;   // the pattern's box was on the old picture
  if(await setPhoto(id,shrink(img,PH_MAX).toDataURL('image/jpeg',.85),['Photo replaced. The item’s tags and your plan are unchanged.',4000,photoUndoAct(id,prev,old,pbox)])===false){if(it&&pbox)it.pbox=pbox;return}   // drawn black: nothing saved, the box stays
  const now=items.find(x=>x.id===id);if(now&&now.photo)await keepTagImg(id,sharp,now.photo)}   // the new sharp copy (tag-request.js), signed with the new photo
  catch{toast('That picture couldn’t be read. Try a JPEG or PNG.')}}
async function rotatePhoto(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const prev=it.photo,im=await imgOf(it.photo),c=document.createElement('canvas');
  c.width=im.height;c.height=im.width;const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);
  // the kept sharp copy turns with it, and the pattern's box (thousandths of the picture) with the copy
  const sharp=typeof tagImgOf==='function'?await tagImgOf(id,it):null,b=it.pbox;
  if(b)it.pbox={x:1000-(b.y+b.h),y:b.x,w:b.h,h:b.w};
  if(await setPhoto(id,c.toDataURL('image/jpeg',.9),['Photo rotated.',4000,photoUndoAct(id,prev,sharp,b)])===false){it.pbox=b;return}   // drawn black: the box stays as it was
  if(sharp)try{const si=await imgOf(sharp),sc=document.createElement('canvas');sc.width=si.naturalHeight;sc.height=si.naturalWidth;const sx=sc.getContext('2d');sx.translate(sc.width,0);sx.rotate(Math.PI/2);sx.drawImage(si,0,0);await keepTagImg(id,sc.toDataURL('image/jpeg',TAG_Q),it.photo)}catch(e){console.warn('sharp copy not turned',e)}}
async function undoPhoto(id){const it=items.find(x=>x.id===id);if(!it||!phEdit.undo.length)return;const {k,v}=phEdit.undo.pop();
  if(v)it[k]=v;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);planDirty();renderWardrobe()}
/* zoom & crop: a square frame; the slider zooms (about the centre), dragging moves the picture */
async function startCrop(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo);
  phEdit.crop={w:im.naturalWidth,h:im.naturalHeight,z:1,cx:.5,cy:.5};renderWardrobe();const b=$('#ivbody');if(b)b.scrollTop=0;requestAnimationFrame(layoutCrop)}
/* the best copy to crop from: the sharp copy kept on this device when the photo was read (tag-request.js, up to 2048px), turned as the
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
function cropEditor(i){const c=phEdit.crop;return `<div class="cropwrap"><div class="cropbox" id="cropbox" onpointerdown="cropDrag(event)"><img id="cropimg" src="${srcOk(i.photo)}" alt="Photo being cropped" draggable="false"></div>
  <label class="cropzoom">Zoom <input type="range" min="1" max="4" step="0.05" value="${c.z}" oninput="phEdit.crop.z=+this.value;layoutCrop()" aria-label="Zoom"></label>
  <p class="mut" style="margin:2px 0 6px;font-size:13px">Drag the picture to position it.</p>
  <div class="btns"><button class="pri" type="button" onclick="applyCrop('${jsq(i.id)}')">Apply</button><button type="button" class="cropdiscard" onclick="cropDiscard()">Discard</button></div></div>`}
/* leaving the crop any other way than Discard keeps it (2026-11-15, the owner: "if I zoom and crop, but instead of hitting Apply I hit close,
   I want it to save"): Done, the backdrop, swiping the sheet down, the phone's Back, Esc and ‹ › apply a frame that was moved or zoomed, with
   "Crop saved." and Undo in a toast (the sheet may be gone, and its Undo with it); a frame left as it opened changes nothing. Discard drops it. */
const cropDirty=()=>{const c=phEdit.crop;return !!c&&(Math.abs(c.z-1)>.001||Math.abs(c.cx-.5)>.001||Math.abs(c.cy-.5)>.001)};
function cropDiscard(){phEdit.crop=null;renderWardrobe()}
/* the crop left without Apply: kept when changed (applyCrop measures the frame at once, so the sheet may close or redraw right after) */
function cropKeep(){if(!phEdit.crop)return null;const id=phEdit.id;if(!cropDirty()){phEdit.crop=null;return null}return applyCrop(id,true)}
/* the toast's Undo: the editor's own Undo while the sheet is still on this item, else the photo as it was; the sharp copy is the same picture again */
async function cropUndo(id,prev){const it=items.find(x=>x.id===id);if(!it||!prev)return;await picUndo(id,'photo',prev);
  if(typeof resignTagImg==='function')await resignTagImg(id,it.photo)}
function cropGeom(){const c=phEdit.crop,box=$('#cropbox');if(!c||!box)return null;const V=box.clientWidth,s=V/Math.min(c.w,c.h)*c.z,W=c.w*s,H=c.h*s;
  // keep the frame inside the picture
  const hx=V/2/W,hy=V/2/H;c.cx=Math.min(1-hx,Math.max(hx,c.cx));c.cy=Math.min(1-hy,Math.max(hy,c.cy));
  return {V,s,W,H,x:V/2-c.cx*W,y:V/2-c.cy*H}}
function layoutCrop(){const g=cropGeom(),img=$('#cropimg');if(!g||!img)return;Object.assign(img.style,{width:g.W+'px',height:g.H+'px',left:g.x+'px',top:g.y+'px'})}
function cropDrag(e){const c=phEdit.crop;if(!c)return;e.preventDefault();const box=e.currentTarget;box.setPointerCapture&&box.setPointerCapture(e.pointerId);let lx=e.clientX,ly=e.clientY;
  const mv=ev=>{const g=cropGeom();if(!g)return;c.cx-=(ev.clientX-lx)/g.W;c.cy-=(ev.clientY-ly)/g.H;lx=ev.clientX;ly=ev.clientY;layoutCrop()};
  const up=()=>{box.removeEventListener('pointermove',mv);box.removeEventListener('pointerup',up);box.removeEventListener('pointercancel',up)};
  box.addEventListener('pointermove',mv);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up)}
/* (left: the crop was left without Apply, cropKeep: say so, with Undo. The frame is read before the first await, so the sheet may go) */
async function applyCrop(id,left){const it=items.find(x=>x.id===id),g=cropGeom(),cr=phEdit.crop;if(!it||!g||!cr)return;phEdit.crop=null;const prev=it.photo;
  const im=await cropSource(it),f=(im.naturalWidth||im.width)/cr.w;   // the frame is measured on the photo; f scales it to the source
  const side=g.V/g.s*f,sx=-g.x/g.s*f,sy=-g.y/g.s*f,out=Math.min(PH_MAX,Math.round(side)),c=document.createElement('canvas');c.width=c.height=out;
  c.getContext('2d').drawImage(im,sx,sy,side,side,0,0,out,out);if(await setPhoto(id,c.toDataURL('image/jpeg',.9),[left?'Crop saved.':'Photo cropped.',4000,{label:'Undo',fn:()=>cropUndo(id,prev)}])===false){renderWardrobe();return}   // drawn black: nothing saved
  if(typeof resignTagImg==='function')await resignTagImg(id,it.photo)}   // the same picture, cropped: the sharp copy (and the pattern's box on it) still holds
/* the item page's body (see "Wardrobe item page" below): the photo beside the drawn swatch with the row of photo tools under it, the
   "Color & texture" card (fabrics), then a card for the tags, one for rotation, and Delete on its own at the very end */
function itemBody(i){
  if(phEdit.id!==i.id)phEdit={id:i.id,undo:[],crop:null};
  const pic=i.photo||wardPic(i);
  // the photo beside the split swatch (drawing | close-up), plain pictures: the comparison lives in Look & compare (2026-11-16, the
  // owner took the old tap-to-compare out of Pictures)
  const pair=!pic?`<div class="ivdraw">${itemThumb(i)}</div>`:photoPair(pic,i,'tagsw-'+i.id);
  // the checklist (2026-11-16, the owner's approved redesign "2B Checklist", checklist.js): a summary line (photo, rotation and care pills),
  // then sections that fold, each with a status mark and a one-line summary: Look & compare (fabrics: the close-up beside the drawing, the
  // match bar, Match close-up, the paper line, True color in 3 steps, Read color and texture), Color, Pattern, Material, Details, Planning &
  // care, Name & notes, Pictures (the photos and the row of photo tools, Edit photos option B), then Duplicate and Delete. While cropping
  // the crop frame takes the summary's place at the top. From 600px two columns: the summary and Look & compare on the left.
  const id=i.id,tex=lookCu(i.type),fab=FABRIC.includes(i.type),scope='e',L=lookOn();   // (lookCu: TEXTURE_TYPES; with the Look beta on more types: look.js)
  if(phEdit.crop)return `<div class="ivin ivck">${cropEditor(i)}</div>`;   // cropping: the frame alone, everything else steps aside
  const top=ivSummary(i,pic);
  let look='';
  if(tex){const lab=i.texture?cmpLab('e',i):null,d=i.texture?cmpDiff(i,lab):null,p=i.texture?cmpPaper('e',i):null;
    const mark=!i.texture?'opt':d===null?'todo':d===0?'good':'warn';
    const sum=!i.texture?'Not yet · add a close-up to compare':d===null?'Close-up vs drawing':d===0?'Close-up vs drawing · they match':`Close-up vs drawing · ${cmpSteps(Math.abs(d))} off`;
    const body=i.texture?cmpHtml(id,i.texture,cmpDrawn(i),!!(p&&p.ref))+cmpMatchHtml('e',id,i,lab)+(paperLine(i)||cmpPaperLine(p,paperRetake(id,'replaceTexture')))+paperHint(i)+rdEditorBtn(i)
      :`<p class="shelp">Put a close-up of the cloth beside the drawing, and have Claude read its color and weave.</p>${paperHint(i)}${rdEditorBtn(i)}<div class="ckadds">${closeupBtn({label:'Add close-up',cls:'btn ckadd',mode:'add',aria:'Add fabric close-up',file:`f=>replaceTexture('${jsq(id)}',f)`,cloth:paperCloth(i)})}</div>`;
    look=ckSec(scope,'look',{mark,title:'Look &amp; compare',sum,body,open:true,id:'ivct',cls:'ivct'})}
  // the Look beta (look.js): one Look section in place of Color, Pattern, Material and Details' leather, metal and dial
  const lk=L?lookSection('e',i):null,lkSec=lk?ckSec(scope,'lk',{mark:lk.mark,title:lk.title,sum:lk.sum,body:lk.body,open:true,cls:'cklook'}):'';
  const cr=L?'':colRows('e',id,i),shade=!L&&COLORS[primaryCol(i)]&&colShows(i,'primaryColor')?shadeRow(i,`stepShadeE.bind(null,'${jsq(id)}')`,`matchShadeE('${jsq(id)}')`,!tex&&!!(i.meas&&i.meas.src==='closeup')):'';
  const color=cr||shade?ckSec(scope,'color',{mark:'good',title:'Color',sum:ckColSum(i,primaryCol(i))+(i.shade?` · drawn ${esc(shadeName(i.shade).toLowerCase())}`:''),body:cr+accRow('e',id,i)+shade}):'';
  const layout=fab&&(DETECT_PATS.includes(patBase(i.pattern))||settable(i.type,i.pattern,i.weave)||claudeOnly(i.type,i.pattern)||i.sett)?`<div class="ivpat"><p class="shelp">Pattern layout: ${patSummary(i)}</p><div class="btns">${!i.photo&&!i.texture?'<p class="shelp nopatpic">Add a photo above to read its pattern from it.</p>':claudeOnly(i.type,i.pattern)&&!isConnected()?'':`<button id="readpat-btn" onclick="${i.texture||i.pbox||claudeOnly(i.type,i.pattern)?`rereadSett('${jsq(id)}')`:`redetect('${jsq(id)}')`}">Read pattern from photo</button>`}${i.stripes||i.sett?`<button onclick="clearStripes('${jsq(id)}')">Use generic</button>`:''}</div></div>`:'';
  const gap=typeof asmGapNote==='function'?asmGapNote(i):'';
  const pattern=!L&&hasPat(i.type)?ckSec(   // (a pocket square or a casual garment too: its pattern, no layout reading)
scope,'pattern',{mark:'good',title:'Pattern',sum:esc(cap1(patName(normPat(i.type,i.pattern))))+(usableSett(i)?' · layout read':''),body:EP(id,i)+layout+gap}):'';
  const mat=!L&&MATERIALS_BY[i.type]?ckSec(scope,'material',{mark:i.material?'good':'opt',title:'Material',sum:i.material?esc(matLabel(i.material)):'Not set',body:matRow(i.type,i.material,`setItemField('${jsq(id)}','material',`)}):'';
  const det=E(id,'type',Object.entries(TYPES),i.type)+(!L&&METAL_TYPES.includes(i.type)?E(id,'metal',metalOptsFor(i.type),i.metal||'silver',i.type==='belt'?'Buckle':''):'')+
    (i.type==='shirt'?E(id,'cuff',CUFFS,i.cuff||'button'):'')+(i.type==='suit'?E(id,'vest',VESTS,hasVest(i)?'yes':'no'):'')+(SEASON_TYPES.includes(i.type)?E(id,'season',SEASONS,i.season||'all'):'')+
    (i.type==='pants'?E(id,'trouserKind',TROUSER_KINDS,trouserKindShown(i)):'')+(i.type==='shoes'?E(id,'shoeStyle',SHOE_STYLES,shoeStyle(i)):'')+(!L&&(i.type==='shoes'||i.type==='belt')?E(id,'leather',leathersFor(i).map(c=>[c,cap1(leatherWord(i,c))]),i.leather||'calf',leatherLabel(i)):'')+
    (i.type==='watch'?`<label class="wdetails">Details <input type="text" maxlength="${WATCH_DETAILS_MAX}" dir="auto" value="${esc(String(i.details||'').slice(0,WATCH_DETAILS_MAX))}" placeholder="e.g. three subdials, 12 and 6 numerals" onchange="sete('${jsq(id)}','details',this.value.trim().slice(0,WATCH_DETAILS_MAX)||'none')"></label>`+(L?'':E(id,'dial',DIAL_OPTS(watchOpts(i).dial),watchOpts(i).dial))+E(id,'band',BANDS,watchOpts(i).band)+E(id,'bezel',BEZELS,watchOpts(i).bezel)+E(id,'watchStyle',WATCH_STYLES,watchOpts(i).style):'');
  const details=ckSec(scope,'details',{mark:'good',title:'Details',sum:esc(ivDetailSum(i)),body:det+(fab||L?'':gap),cls:'ivtags'});
  const cs=CARE_ABLE.includes(i.type)&&!i.order&&typeof careState==='function'?careState(i):null;
  const rotIn=`${i.paused?(i.order?`<div class="rotnote ordrow"><p class="shelp">On the way: it isn't in your outfits yet.</p><label class="ordate">Arrives (optional) <input type="date" value="${i.arrives||''}" min="${isoKey(todayDate())}" onchange="setItemArrives('${jsq(id)}',this.value)"></label><small class="mut ordhint">${orderHint(i.arrives)}</small></div>`:i.away?'<p class="shelp rotnote">Away being cleaned: it is out of your outfits until it is back (see Care below).</p>':'<p class="shelp rotnote">Out of rotation: the planner won\'t pick it, and it isn\'t offered when you change a piece. Outfits you already wore keep it.</p>'):'<p class="shelp">In rotation: the planner picks it for your outfits.</p>'}
  ${i.away?'':`<div class="btns"><button class="rotbtn${i.paused?' on':''}" onclick="togglePause('${jsq(id)}',${!i.paused})" aria-pressed="${!!i.paused}">${i.paused?(i.order?'It arrived: put in rotation':'Put back in rotation'):'Take out of rotation'}</button></div>`}${typeof careCard==='function'?careCard(i):''}`;
  const care=ckSec(scope,'care',{mark:cs&&cs.due?'warn':'good',title:'Planning &amp; care',sum:esc(ivCareSum(i,cs)),body:rotIn,open:!!(cs&&cs.due),cls:'ivrot'});
  const filled=['name','brand','notes'].filter(k=>String(i[k]||'').trim());
  const names=ckSec(scope,'names',{mark:filled.length?'good':'opt',title:'Name &amp; notes',sum:filled.length?esc(cap1(filled.join(', ')))+' filled in'+(filled.length<3?` · no ${['name','brand','notes'].filter(k=>!filled.includes(k)).join(' or ')}`:''):'Name, brand, notes · optional',body:wardFieldsTop(i)+notesRow(i.notes,ivOn(id))});
  const pics=ckSec(scope,'pics',{mark:'opt',title:'Pictures',sum:esc(cap1([i.photo?'photo':'no photo',tex&&i.texture?'close-up':''].filter(Boolean).join(', ')))+' · replace, rotate, crop',body:`<div class="ivhero">${pair}</div>${photoTools(i)}`,cls:'ivpics'});
  const acts=`<div class="ivdup"><button type="button" id="iv-dup" onclick="wardDuplicate('${jsq(id)}')">Duplicate this item</button></div><div class="ivdel"><button class="danger" onclick="rm('${jsq(id)}')">Delete item</button></div>`;
  const sample=typeof kitSampleNote==='function'?kitSampleNote(i):'';
  return `<div class="ivin ivck"><div class="ivcols"><div class="ivcl">${top}${sample}${look||pics}</div><div class="ivcr">${lkSec}${color}${pattern}${mat}${details}${care}${names}${look?pics:''}</div></div>${acts}</div>`;
}
/* the summary line at the top of the item sheet: the photo (or the drawing), "In rotation" / "Out of rotation" / "On the way", how many
   wears are left before cleaning (or "Due for cleaning"), the material and the season */
const optLab=(list,v)=>{const o=list.find(x=>x[0]===v);return o?cap1(o[1]):''};
function ivSummary(i,pic){const s=CARE_ABLE.includes(i.type)&&!i.order&&typeof careState==='function'?careState(i):null,left=s?s.limit-s.wears:0;
  const rot=i.paused?`<span class="ivpill${i.order?'':' warn'}">${i.order?'On the way':i.away?(i.away.why==='laundry'?'In the laundry':'At the cleaner’s'):'Out of rotation'}</span>`:'<span class="ivpill good">In rotation</span>';
  const care=s&&!i.away&&s.limit>1?(s.due?`<span class="ivpill warn">Due for ${careWord(i.type)}</span>`:`<span class="ivpill">${careWashed(i.type)?'Wash':'Clean'} in ${left} wear${left===1?'':'s'}</span>`):'';
  const meta=[i.material?matLabel(i.material):'',SEASON_TYPES.includes(i.type)&&i.season&&i.season!=='all'?optLab(SEASONS,i.season):''].filter(Boolean).join(' · ');
  const th=pic?`<img class="ivsumph" src="${srcOk(i.photo?phSm(i):pic)}" alt="">`:`<div class="ivsumph">${itemThumb(i)}</div>`;
  return `<div class="ivsum">${th}<div class="ivsumt"><div class="ivpills">${rot}${care}</div>${meta?`<p class="ivmeta">${esc(meta)}</p>`:''}</div></div>`}
/* the Details section's summary: "Suit · Cold weather · matching vest" */
function ivDetailSum(i){const t=i.type,a=[TYPES[t]||'Item'];
  if(SEASON_TYPES.includes(t))a.push(optLab(SEASONS,i.season||'all'));
  if(t==='suit')a.push(hasVest(i)?'matching vest':'no vest');if(t==='shirt')a.push(optLab(CUFFS,i.cuff||'button').toLowerCase());
  if(t==='pants')a.push(optLab(TROUSER_KINDS,trouserKindShown(i)).toLowerCase());if(t==='shoes')a.push(optLab(SHOE_STYLES,shoeStyle(i)).toLowerCase());
  if(METAL_TYPES.includes(t))a.push(optLab(metalOptsFor(t),i.metal||'silver').toLowerCase());
  return a.filter(Boolean).join(' · ')}
/* Planning & care's summary: "In rotation · worn 3 of 5 since cleaning" */
function ivCareSum(i,s){const r=i.paused?(i.order?'On the way':i.away?'Away being cleaned':'Out of rotation'):'In rotation';
  if(!s||i.away)return r;if(s.due)return `${r} · due for ${careWord(i.type)}`;
  return s.limit>1?`${r} · worn ${s.wears} of ${s.limit} since ${careWord(i.type)}`:s.wears?`${r} · worn ${careTimes(s.wears)}`:`${r} · not worn yet`}
async function sete(id,k,v){
  const it=items.find(x=>x.id===id);if(!it){itemGoneTell(id);return}
  it[k]=v==='none'&&k!=='toeColor'?null:v;   // (a sock's toe cap keeps 'none': a sock with no toeColor at all is from before, core.js sockToe)
  if(k==='shoeStyle'&&!leathersFor(it).includes(it.leather))it.leather='calf';   // a sneaker can't be cordovan: back to plain leather
  if(k==='type'){it.pattern=normPat(v,it.pattern);shirtColFix(it);if(METAL_TYPES.includes(v)&&!it.metal)it.metal='silver';if((v==='shoes'||v==='belt')&&!it.leather)it.leather='calf';typeTidy(it)}
  if(k==='primaryColor')delete it.color;
  if((k==='primaryColor'||k==='type')&&it.swSrc==='tex')await refreshSwatch(it);   // the close-up swatch takes its lightness from the colour
  await put(it);planDirty();renderWardrobe();
}
/* a type change drops what the new type has no field for (2026-11-15, the new-user audit: a raincoat made cufflinks was "· warm weather",
   as socks "Green, white toe · warm weather" in waxed cotton): season, material not in its list, metal, leather, cuffs, vest, kind, style,
   the watch's options, and a second or third colour it can't show; the photos stay */
const TYPE_FIELDS={season:t=>SEASON_TYPES.includes(t),metal:t=>METAL_TYPES.includes(t),leather:t=>t==='shoes'||t==='belt',cuff:t=>t==='shirt',vest:t=>t==='suit',
  trouserKind:t=>t==='pants',shoeStyle:t=>t==='shoes',dial:t=>t==='watch',band:t=>t==='watch',bezel:t=>t==='watch',watchStyle:t=>t==='watch',details:t=>t==='watch',toeColor:t=>t==='socks'};
/* a material its type can't have goes; a typed "Other" material stays where the type has a list (an own material of another type goes, like a
   listed one). Also the Add card's type change and save (CR-1-06: a jacket read as tweed and changed to a tie was saved "Other · tweed") */
function matTidy(it){const ml=matsFor(it.type);if(it.material&&!(ml&&(ml.includes(it.material)||!Object.keys(MATERIALS_BY).some(x=>matsFor(x).includes(it.material)))))delete it.material;return it}
function typeTidy(it){const t=it.type;for(const [f,ok] of Object.entries(TYPE_FIELDS))if(f in it&&!ok(t))delete it[f];
  matTidy(it);
  if(t==='shoes'&&it.leather&&!leathersFor(it).includes(it.leather))it.leather='calf';
  if(!FABRIC.includes(t))for(const f of ['sett','stripes','patternSpec','weave','patternText','pbox'])delete it[f];
  if(t==='socks'&&it.toeColor===undefined)it.toeColor='none';   // made socks now: a second colour is the pattern's, never read as a toe cap
  return colTidy(it)}
/* (2026-11-16, the owner's camouflage shirt: the sheet wouldn't open, so it couldn't be deleted either: a pattern drawn from a fallback
   (a camouflage with no reading of its own, camoLook; an own pattern's look) has no i.sett, and this described i.sett. It describes what is
   drawn, and a camouflage drawn in its own colors says how to get its real ones) */
function patSummary(i){const u=usableSett(i);
  if(u&&u.camo&&!(i.sett&&i.sett.camo))return 'camouflage drawn in its own colors (Read pattern from photo takes the real colors from the close-up)';
  if(u)return settSummary(u);
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
  it.stripes=st;await put(it);planDirty();renderWardrobe();
}
/* take an item out of rotation, or put it back. Taking it out also lets go of the upcoming days it was pinned to (a swap or a
   hand pick), so those days are planned again without it; past days and days marked worn keep it. */
async function setItemArrives(id,v){const it=items.find(x=>x.id===id);if(!it)return;const a=arriveVal(v);
  if(a==='past'){renderWardrobe();toast(ARRIVE_PAST,4500);return}   // (the date it had stays)
  if(a)it.arrives=a;else delete it.arrives;await put(it);planDirty();
  if(await checkArrivals())return renderWardrobe();renderWardrobe()}
/* want: what the button said when it was drawn (true = "Take out of rotation"): a sheet drawn before another phone's change arrived does
   what it says, never the opposite (fix round 3, W1-5-04); nothing to do when the piece is already that way */
async function togglePause(id,want){const it=items.find(x=>x.id===id);if(!it){itemGoneTell(id);return}
  if(typeof want==='boolean'&&!!it.paused===want){renderWardrobe();toast(want?'It was already taken out of rotation on another phone.':'It was already back in rotation.');return}
  it.paused=!it.paused;if(!it.paused){delete it.paused;delete it.order;delete it.arrives}
  let n=0;if(it.paused){const T=todayDate();
    for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<T||r.worn===true||!r.force)continue;const f={...r.force};let hit=false;
      for(const [s,v] of Object.entries(f))if(v===id){delete f[s];hit=true}
      if(hit){const nr={...r,force:f};if(!Object.keys(f).length)delete nr.force;delete nr.ids;await saveDay(nr,true);n++}}}
  // out of rotation doesn't make a sample piece his (kit.js kitNoMine; put reads it at once)
  const kn=typeof kitNoMine!=='undefined';if(kn)kitNoMine=true;const pw=put(it);if(kn)kitNoMine=false;await pw;planDirty();renderWardrobe();
  toast(it.paused?`Out of rotation: the planner won't pick it${n?`, and ${n} upcoming day${n===1?' was':'s were'} planned again without it`:''}.`:'Back in rotation.')}
async function clearStripes(id){const it=items.find(x=>x.id===id);if(!it)return;delete it.stripes;delete it.sett;await put(it);planDirty();renderWardrobe()}
async function rm(id){return wardDelete(id)}   // at once, with Undo in a toast (wardrobe.js)


/* ---- Wardrobe item sheet ----
   Tapping an item opens it in a sheet that slides up over the Wardrobe: the full width of a phone, to just under the top of the
   screen (a centred panel from 600px). The grid behind never moves, so closing puts you back exactly where you were. Ways out:
   swipe the sheet down (by its header at any time; by its content once that is scrolled to the top), Done in the bar at the
   bottom, a tap on the strip of Wardrobe left above it, the phone's Back button or gesture, Esc. ‹ › beside Done, a sideways
   swipe or the arrow keys go to the previous / next item of the list on screen. */
const WARD_EASE='cubic-bezier(.2,.8,.2,1)',WARD_MS=320;
/* the filtered, sorted list on screen (wardrobe.js), with the open item kept in it at the place it had (ivAt) when an edit took it out of the
   filter (CR-1-05: a suit made a blazer under the Suit chip lost "n of m", ‹ ›, the sideways swipe and its focus on closing) */
let ivAt=0;
const wardList=()=>{const l=wardView();if(!editing||l.some(x=>x.id===editing))return l;const it=items.find(x=>x.id===editing);if(!it)return l;
  const c=l.slice();c.splice(Math.min(ivAt,c.length),0,it);return c};
const noMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate;
let itemFrom=null;   // the item the sheet was opened on: closing on another one brings that one's box into view first
/* the phone's Back closes the sheet: it has its own history entry while it is open (back.js histPush/histDrop, kind 'item'); one asked for
   while a step back of ours was on its way is made once it lands. Back in the crop frame keeps the crop (cropKeep: when moved or zoomed)
   and leaves it, and the sheet keeps its entry (the Back audit, 2026-11-15: it closed the sheet) */
backLand(()=>{if(editing)histPush()});
backOn('item',()=>{if(editing&&phEdit.crop){cropKeep();renderWardrobe();histPush()}else if(editing)closeItem(true)});
/* show or hide the sheet; while it is up the app behind it takes no taps or keyboard focus */
function itemShown(on){const v=$('#item-view'),bd=$('#item-backdrop');if(!v)return;const was=v.classList.contains('on');
  v.classList.toggle('on',on);if(bd)bd.classList.toggle('on',on);document.body.classList.toggle('iv-on',on);
  if(typeof layerInert==='function')layerInert();else for(const el of document.querySelectorAll('body>header,main,body>nav'))el.inert=on;   // (ui.js: counts Settings and the sheets too)
  if(was&&!on&&typeof syncLaterRun==='function')setTimeout(()=>syncLaterRun('wardrobe'),0)}   // a sync's redraw that waited for the sheet (sync.js)
/* ---- a sync changed the piece open in the sheet (fix round 3, 2026-11-16) ----
   The sync's redraw of the Wardrobe waits while the sheet is up (sync.js syncLater), so the sheet kept the old state and its buttons acted
   on the new one: "Take out of rotation" put a piece taken out on the other phone back in (W1-5-04). Now the sheet is drawn again from the
   new copy at once, or, while a field in it is being typed in, once that field is left. A piece deleted on another phone (W1-6-02) is
   said in a toast and a line at the top of the sheet; the sheet stays until closed (redrawn it would vanish under the finger), and a
   change made in it says it wasn't kept (itemGoneTell). was: the copy shown before the sync */
let itemGone=null;
function itemSynced(was){if(!editing)return;const id=editing,now=items.find(x=>x.id===id);
  if(!now){if(itemGone===id)return;itemGone=id;const n=was&&(itemName(was)||nm(was));
    tell(n?`“${n}” was deleted on another phone.`:'This piece was deleted on another phone.');
    const b=$('#ivbody');if(b&&!b.querySelector('.ivgone'))b.insertAdjacentHTML('afterbegin','<p class="ivgone" role="status">This piece was deleted on another phone. Changes made here aren’t kept.</p>');return}
  if(was&&stamp(was)===stamp(now))return;
  const v=$('#item-view'),a=document.activeElement;
  if(v&&a&&v.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!/^(button|checkbox|radio|range)$/.test(a.type||'')){a.addEventListener('blur',()=>setTimeout(()=>{if(editing===id&&!(v.contains(document.activeElement)&&/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)))renderItem()},0),{once:true});return}
  if(!phEdit.crop)renderItem()}
/* a change made to a piece no longer here (deleted on another phone while its sheet was open): said, once per tap -> true when said */
function itemGoneTell(id){if(items.some(x=>x.id===id))return false;tell('This piece was deleted on another phone, so the change wasn’t kept.');return true}
/* draws the open item (called by renderWardrobe, so every edit redraws it; the scroll position stays) */
function renderItem(){
  const v=$('#item-view');if(!v)return;const i=editing&&items.find(x=>x.id===editing);
  if(!i){editing=null;itemShown(false);return}
  const l=wardList(),k=l.findIndex(x=>x.id===i.id);if(k>=0)ivAt=k;
  $('#ivhead').innerHTML=`<div class="ivt"><small class="gtype">${TYPES[i.type]||'Item'}</small><h2 id="iv-title" class="${titleCls(i)}">${esc(itemTitle(i)||TYPES[i.type]||'Item')}</h2></div>${k>=0?`<span class="pcount">${k+1} of ${l.length}</span>`:''}`;
  keepFocus($('#ivbody'),()=>{$('#ivbody').innerHTML=itemBody(i)});   // every edit redraws it: the field or button used keeps the focus (W2-19-01)
  if(typeof cmpMount==='function')cmpMount($('#ivbody'));
  $('#iv-prev').disabled=k<=0;$('#iv-next').disabled=k<0||k>=l.length-1;
  itemShown(true)}
const sheetSlides=()=>innerWidth<600;   // a phone: the sheet slides up from the bottom; wider, the panel fades in
function openItem(id){
  if(!items.some(i=>i.id===id))return;const v=$('#item-view'),bd=$('#item-backdrop'),was=editing;
  editing=id;itemGone=null;if(!was)itemFrom=id;if(lookOn())lookOpenFresh();/* (the Look beta: Look opens unfolded on every item opened) */histPush();ivSwipe();renderItem();$('#ivbody').scrollTop=0;if(!was&&typeof layerOpen==='function')layerOpen(v);   // the focus goes into the sheet and comes back on closing (W2-19-02)
  for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}
  if(was||noMotion())return;const o={duration:WARD_MS,easing:WARD_EASE};
  v.animate(sheetSlides()?[{transform:'translateY(100%)'},{transform:'none'}]:[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'none'}],o);
  bd.animate([{opacity:0},{opacity:1}],{duration:WARD_MS})}
/* fromPop: the Back button did it (its history entry is gone already); dragged: how far down the sheet was let go, in px */
function closeItem(fromPop,dragged){
  const id=editing,v=$('#item-view'),bd=$('#item-backdrop');if(!id||!v)return;const moved=id!==itemFrom;
  if(phEdit.crop)cropKeep();   // closed in the crop frame: a moved or zoomed frame is kept (the owner: closing should save it)
  editing=null;itemFrom=null;if(!fromPop)histDrop();
  const y=dragged||0,op=+bd.style.opacity||1;v.style.transform=bd.style.opacity='';
  if(noMotion()){renderItem();itemFocusBack(id);return}
  v.classList.add('closing');bd.classList.add('closing');renderItem();itemFocusBack(id);   // the sheet stays up, drawn as it was, while it slides away
  const t=document.getElementById('gi-'+id);if(t&&moved)t.scrollIntoView({block:'center'});   // it was reached with ‹ ›: show where it lives
  const o={duration:WARD_MS-60,easing:dragged?'ease-out':'cubic-bezier(.4,0,.8,.4)',fill:'forwards'};
  const an=v.animate(sheetSlides()?[{transform:`translateY(${y}px)`},{transform:'translateY(100%)'}]:[{opacity:1,transform:`translateY(${y}px)`},{opacity:0,transform:`translateY(${y+24}px)`}],o);
  bd.animate([{opacity:op},{opacity:0}],{duration:WARD_MS-60,fill:'forwards'});
  an.finished.catch(()=>{}).then(()=>{if(editing)return;for(const el of [v,bd]){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing')}})}
/* the focus back after closing (fix round 3, W2-19-02: it stayed on <body>, at the top of the Wardrobe): on the item's own box in the
   grid (the one shown last, when ‹ › moved on; the grid is drawn again on every edit, so the box that opened it may be gone), else on
   what opened the sheet */
function itemFocusBack(id){const v=$('#item-view'),f=typeof layerFrom!=='undefined'&&v?layerFrom.get(v):null;if(f!==null&&v)layerFrom.delete(v);
  const a=document.activeElement;if(a&&a!==document.body&&!(v&&v.contains(a)))return;
  const gi=document.getElementById('gi-'+id),g=gi&&gi.querySelector('.giopen'),ch=document.querySelector('#wardrobe .chip[aria-pressed="true"]');   // (the box gone from the filter: its chip)
  const to=g&&!g.closest('[inert]')?g:f&&f.isConnected&&!f.closest('[inert]')?f:ch&&!ch.closest('[inert]')?ch:null;
  if(to)try{to.focus({preventScroll:true})}catch{}}
/* closing with nothing to slide away from: the item was deleted, or another tab is shown */
function dropItem(){editing=null;itemFrom=null;histDrop();if(typeof layerFrom!=='undefined')layerFrom.delete($('#item-view'));for(const el of [$('#item-view'),$('#item-backdrop')])if(el){for(const a of el.getAnimations())a.cancel();el.classList.remove('closing');el.style.transform=el.style.opacity=''}itemShown(false)}
/* swiping the sheet down closes it. The header is a handle at any time; the content is one only while it is scrolled to the
   top (further down, a downward swipe scrolls it back up, as it must). The choice is made on the first move of a touch, before
   the browser starts scrolling. The sheet follows the finger and the Wardrobe behind brightens; let go past a quarter of the
   sheet's height, or with a flick, and it closes, else it springs back. While cropping only by the header (the crop frame is
   dragged), and closing keeps the crop (cropKeep).
   A mouse, trackpad or Pencil (Pointer Events, not touches) drags it by the header the same way; a finger's pointer events are
   left to the touch listeners. (2026-11-15, the owner's Duo unfolded: the centred panel sat at 4vh, under the status bar, and a
   pull on its grabber went to iOS; the panel now starts below the status bar, `--ivtop` in styles.css.) The gesture is add.js sheetSwipe,
   put on the sheet when it first opens; ivDrag is true while the sheet follows a finger (the sideways swipe below leaves it alone). */
let ivDrag=false;
function ivSwipe(){const v=$('#item-view'),b=$('#ivbody');if(!v||!b)return;
  sheetSwipe(v,{head:'.ivhead',body:()=>b,backdrop:()=>$('#item-backdrop'),skip:'.ivbar',live:(el,head)=>!!editing&&!v.classList.contains('closing')&&!(phEdit.crop&&!head),
    close:d=>closeItem(false,d),spring:true,fadeBack:true,drag:on=>{ivDrag=on}})}
/* the previous / next item of the list on screen; the new one slides in from the side it lies on */
function stepItem(n,from){
  const l=wardList(),k=l.findIndex(x=>x.id===editing),t=l[k+n];if(k<0||!t)return false;
  if(phEdit.crop)cropKeep();   // the crop frame left for the next item: kept when moved or zoomed
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
    if(e.key==='Escape'){if(phEdit.crop){cropKeep();renderWardrobe()}else closeItem();return}   // Esc leaves the crop as Back does: a moved frame is kept
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
  // (2026-11-16) a casual type's chip shows once one is owned (or its chip is the one chosen)
  const chips=['all',...Object.keys(TYPES).filter(t=>!HANDPICK_TYPES.includes(t)||flt===t||items.some(i=>i.type===t))].map(t=>`<button class="chip ${flt===t?'on':''}" aria-pressed="${flt===t}" onclick="flt='${t}';renderWardrobe()">${t==='all'?'All':TYPES[t]} ${cnt(t)}</button>`).join('');
  const list=wardFresh();
  keepFocus($('#wardrobe'),()=>{$('#wardrobe').innerHTML=`<h2 class="vh">Wardrobe</h2><span class="vh" id="wcount" role="status">${wardCount(list)}</span>${items.length?wardBar()+`<div class="chips">${chips}</div>`:''}<div class="wslide" id="wslide">`+wardGrid(list)+'</div>'});   // (the chip or field pressed keeps the focus: W2-19-01)
  const on=document.querySelector('#wardrobe .chip.on');if(on){const c=on.parentElement;c.scrollLeft=Math.max(0,on.offsetLeft-c.offsetLeft-(c.clientWidth-on.offsetWidth)/2)}
  renderItem();wardBack(wf);
}

