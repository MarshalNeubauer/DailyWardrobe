/* Daily Wardrobe: the item sheet's photo tools: replace, rotate, zoom-crop and undo the photo, the close-up, the small copy for grids,
   the white-paper steps. (An ES module since 2026-11-23; split out of itemsheet.js on 2026-11-17, no behavior change.) */
/* ---- Wardrobe editor: replace, rotate, zoom-crop the item's photo. Only the picture changes: the tags (colour, pattern...)
   and the item itself stay, so the plan and the outfit history are untouched. Each change's toast has Undo (picUndo; phEdit.undo holds the editor's steps). ---- */
import {serve,ask,askFor,runHooks,register} from './bus.js';   // emit: the Wardrobe's redraw (itemsheet.js, later); ask: the piece open (item-view.js). (No app.js ask() here)
import {DEAD_MSG,deadPic,fixupRedraw,imgOf,loadImg,put,refreshSwatch,shrink,stillCur} from './app.js';
import {$,CLOSE_MAX,PH_MAX,TAG_MAX,TAG_Q,TEX_MAX,TEX_MIN_PX,items,paperCloth,phSigOf,texSig,esc} from './core.js';
import {srcOk} from './photo-keys.js';
import {closeupBtn,cuGot,cuTouch} from './ui.js';
import {toast} from './toast.js';
import {planDirty} from './today-plan.js';
import {acts} from './act.js';
import {cropSource,makeSmall,paperNow,paperOf,paperSteps} from './measure.js';
import {remakeLeft,remakeSpend} from './migrate.js';
import {lookCu} from './look-base.js';
import {keepCloseImg,keepTagImg,resignTagImg,tagImgOf} from './tag-request.js';
/* the photo editor's state for the piece open: its Undo steps and the crop frame (moved here from itemsheet.js, the restructure S3d; only
   itemsheet.js starts it again, with setPhEdit) */
let phEdit={id:null,undo:[],crop:null};
const setPhEdit=v=>{phEdit=v};
/* at start-up: items whose small copy is missing or old (added before it, or changed on a device with an older app) */
/* (a connected phone makes at most the day's remakes, migrate.js remakeLeft: each small copy can be a new server value; the rest the next days) */
async function smallPhotos(){let n=0;for(const it of items){if(!it.photo||(it.photoSm&&it.phSig===phSigOf(it.photo)))continue;if(remakeLeft()<1)break;
  if(await makeSmall(it)&&stillCur(it)){await put(it);remakeSpend(1);n++}}if(n)fixupRedraw();return n}
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
  const rm=!!(tex&&i.texture);
  return `<div class="phtools" role="group" aria-label="Photo tools"><label class="btn ptbtn pt-replace">${ptIcon('replace')}<span>${i.photo?'Replace':'Add photo'}</span><input type="file" accept="image/*" class="vfile" aria-label="${i.photo?'Replace photo':'Add photo'}" data-act-change="photoFile" data-id="${esc(id)}"></label>`+
    (i.photo?`<button type="button" class="ptbtn pt-rotate" data-act="photoRotate" data-id="${esc(id)}" aria-label="Rotate the photo a quarter turn clockwise">${ptIcon('rotate')}<span>Rotate</span></button><button type="button" class="ptbtn pt-crop" data-act="photoCrop" data-id="${esc(id)}" aria-label="Zoom and crop the photo">${ptIcon('crop')}<span>Crop</span></button>`:'')+
    (tex?closeupBtn({label:`${ptIcon('closeup')}<span>Close-up</span>`,cls:'btn ptbtn pt-closeup',mode:i.texture?'replace':'add',aria:i.texture?'Replace close-up':'Add fabric close-up',act:` data-act-change="photoCuFile" data-id="${esc(id)}"`,remove:rm?'photoCuRemove':'',cloth:paperCloth(i)}):'')+`</div>`+
    (rm&&!cuTouch()?`<div class="ptmore"><button type="button" class="ptrm" data-act="photoCuRemove" data-id="${esc(id)}">Remove close-up</button></div>`:'')}   // on a touch screen Remove is in the close-up chooser (ui.js)
const paperHint=i=>paperSteps(paperCloth(i));
function paperTip(){askFor('paper-tip')}
const paperRetake=id=>closeupBtn({label:'Retake close-up',cls:'linkbtn wbretake',mode:'retake',act:` data-act-change="photoCuFile" data-id="${esc(id)}"`,cloth:paperCloth(items.find(x=>x.id===id)||{})});
function paperLine(i){if(!i.texture||!lookCu(i.type)||phEdit.paper!==texSig(i.texture))return '';const r=paperNow(i);if(!r)return '';
  return r.ref?`<div class="wbst ok" id="ivwb" role="status"><span class="ic" aria-hidden="true">✓</span><span class="tx">White paper found<small>Colors set from it.</small></span></div>`
    :`<div class="wbst no" id="ivwb" role="status"><span class="ic" aria-hidden="true">!</span><span class="tx">${r.warm?'No white paper, and the light looks warm<small>Colors may come out yellower than the cloth.</small>':'No white paper<small>Colors may be off.</small>'}</span>${paperRetake(i.id)}</div>`}
/* (msg: a toast's text, which gets Undo (picUndo), or toast()'s arguments; the editor's Undo only for the item it is open on: a crop kept as
   the sheet closed lands later) */
/* a new photo or close-up the browser drew pure black is refused with DEAD_MSG (app.js), nothing saved: crop, rotate and replace all
   come through here (2026-11-15) */
async function setPic(id,k,url,msg){const it=items.find(x=>x.id===id);if(!it)return;if(url&&await deadPic(url)){toast(DEAD_MSG,8000);return false}
  const prev=it[k]||null;if(phEdit.id===id||!phEdit.id){phEdit.undo.push({k,v:prev});if(phEdit.undo.length>10)phEdit.undo.shift()}
  if(url)it[k]=url;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);planDirty();runHooks('wardrobe-changed');
  if(msg)Array.isArray(msg)?toast(...msg):toast(msg,4000,{label:'Undo',fn:()=>picUndo(id,k,prev)})}
/* a toast's Undo: the editor's own Undo while the sheet is still on this item and that change is the last one, else the picture as it was
   (the sheet may be closed or on another item by then) */
async function picUndo(id,k,prev){const it=items.find(x=>x.id===id);if(!it)return;const top=phEdit.undo[phEdit.undo.length-1];
  if(ask('item-open')===id&&phEdit.id===id&&top&&top.k===k&&top.v===(prev||null)){await undoPhoto(id);return}
  if(prev)it[k]=prev;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);planDirty();runHooks('wardrobe-changed')}
const setPhoto=(id,url,msg)=>setPic(id,'photo',url,msg),setTexture=(id,url,msg)=>setPic(id,'texture',url,msg);
/* a close-up added later stays as taken: the item photo's light reading may not hold for another moment */
/* a close-up under TEX_MIN_PX on its short side is refused, as on the Add card (2026-11-15, the re-audit: the editor took a 40×40 one) */
/** @param {*} id @param {*} f */ async function replaceTexture(id,f){if(!f)return;try{const img=await loadImg(f);
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
  if(v)it[k]=v;else delete it[k];if(k==='texture')await refreshSwatch(it);if(k==='photo')await makeSmall(it);await put(it);planDirty();runHooks('wardrobe-changed')}
/* zoom & crop: a square frame; the slider zooms (about the centre), dragging moves the picture */
async function startCrop(id){const it=items.find(x=>x.id===id);if(!it||!it.photo)return;const im=await imgOf(it.photo);
  phEdit.crop={w:im.naturalWidth,h:im.naturalHeight,z:1,cx:.5,cy:.5};runHooks('wardrobe-changed');const b=$('#ivbody');if(b)b.scrollTop=0;requestAnimationFrame(layoutCrop)}
function cropEditor(i){const c=phEdit.crop;return `<div class="cropwrap"><div class="cropbox" id="cropbox" data-act-pointerdown="cropDrag"><img id="cropimg" src="${srcOk(i.photo)}" alt="Photo being cropped" draggable="false"></div>
  <label class="cropzoom">Zoom <input type="range" min="1" max="4" step="0.05" value="${c.z}" data-act-input="cropZoom" aria-label="Zoom"></label>
  <p class="mut" style="margin:2px 0 6px;font-size:13px">Drag the picture to position it.</p>
  <div class="btns"><button class="pri" type="button" data-act="cropApply" data-id="${esc(i.id)}">Apply</button><button type="button" class="cropdiscard" data-act="cropDiscardTap">Discard</button></div></div>`}
/* leaving the crop any other way than Discard keeps it (2026-11-15, the owner: "if I zoom and crop, but instead of hitting Apply I hit close,
   I want it to save"): Done, the backdrop, swiping the sheet down, the phone's Back, Esc and ‹ › apply a frame that was moved or zoomed, with
   "Crop saved." and Undo in a toast (the sheet may be gone, and its Undo with it); a frame left as it opened changes nothing. Discard drops it. */
const cropDirty=()=>{const c=phEdit.crop;return !!c&&(Math.abs(c.z-1)>.001||Math.abs(c.cx-.5)>.001||Math.abs(c.cy-.5)>.001)};
function cropDiscard(){phEdit.crop=null;runHooks('wardrobe-changed')}
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
/* (act.js: box is the frame, #cropbox, an inline handler's event.currentTarget) */
function cropDrag(box,e){const c=phEdit.crop;if(!c)return;e.preventDefault();box.setPointerCapture&&box.setPointerCapture(e.pointerId);let lx=e.clientX,ly=e.clientY;
  const mv=ev=>{const g=cropGeom();if(!g)return;c.cx-=(ev.clientX-lx)/g.W;c.cy-=(ev.clientY-ly)/g.H;lx=ev.clientX;ly=ev.clientY;layoutCrop()};
  const up=()=>{box.removeEventListener('pointermove',mv);box.removeEventListener('pointerup',up);box.removeEventListener('pointercancel',up)};
  box.addEventListener('pointermove',mv);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up)}
/* (left: the crop was left without Apply, cropKeep: say so, with Undo. The frame is read before the first await, so the sheet may go) */
async function applyCrop(id,left){const it=items.find(x=>x.id===id),g=cropGeom(),cr=phEdit.crop;if(!it||!g||!cr)return;phEdit.crop=null;const prev=it.photo;
  const im=await cropSource(it),f=(im.naturalWidth||im.width)/cr.w;   // the frame is measured on the photo; f scales it to the source
  const side=g.V/g.s*f,sx=-g.x/g.s*f,sy=-g.y/g.s*f,out=Math.min(PH_MAX,Math.round(side)),c=document.createElement('canvas');c.width=c.height=out;
  c.getContext('2d').drawImage(im,sx,sy,side,side,0,0,out,out);if(await setPhoto(id,c.toDataURL('image/jpeg',.9),[left?'Crop saved.':'Photo cropped.',4000,{label:'Undo',fn:()=>cropUndo(id,prev)}])===false){runHooks('wardrobe-changed');return}   // drawn black: nothing saved
  if(typeof resignTagImg==='function')await resignTagImg(id,it.photo)}   // the same picture, cropped: the sharp copy (and the pattern's box on it) still holds
/* what the photo tools' and the crop frame's controls do (act.js; the item by its id in data-id) */
function photoFile(el){replacePhoto(el.dataset.id,el.files[0]);el.value=''}
function photoRotate(el){rotatePhoto(el.dataset.id)}
function photoCrop(el){startCrop(el.dataset.id)}
function photoCuRemove(el){setTexture(el.dataset.id,null,'Close-up removed.')}
function photoCuFile(el,ev,f){cuGot(el,f,x=>replaceTexture(el.dataset.id,x))}   // (a close-up chosen or retaken: ui.js closeupBtn, cuGot)
function paperTipTap(){paperTip()}
function cropZoom(el){phEdit.crop.z=+el.value;layoutCrop()}
function cropApply(el){applyCrop(el.dataset.id)}
function cropDiscardTap(){cropDiscard()}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,applyCrop,layoutCrop,paperTip,setPhoto,setTexture,startCrop,undoPhoto,get phEdit(){return phEdit},replaceTexture,smallPhotos};
export {phEdit,setPhEdit,smallPhotos,photoTools,paperHint,paperTip,paperRetake,paperLine,setPhoto,setTexture,replaceTexture,undoPhoto,startCrop,cropEditor,cropKeep,layoutCrop,applyCrop};
acts({photoFile,photoRotate,photoCrop,photoCuRemove,photoCuFile,paperTipTap,cropDrag,cropZoom,cropApply,cropDiscardTap});
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('ph-edit',()=>phEdit);   // the restructure S6b: what required and today-no-picture files ask of this file (bus.js need)
/* the hooks (bus.js register; the notice board made clean, N2): what this feature does at the moments core runs, its file's last statement */
register('item-photo',{'after-pull-fixups':smallPhotos});   // start-up's small photos, after migrate.js's fix-ups (load order)
