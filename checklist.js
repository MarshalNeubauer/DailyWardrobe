/* Daily Wardrobe: the checklist sections and the close-up / drawing comparison shared by the item sheet (itemsheet.js itemBody) and the Add
   card (add.js formCard). 2026-11-16, the owner's approved redesign: direction "2B Checklist" with the side-by-side compare of
   C:\code\audit-2026-11-13\item-redesign\prototype\compare-side.html (DESIGN.md, INVENTORY.md beside it).
   (A classic script sharing one global scope with the others, loaded in index.html's order; nothing runs at load.) */

/* ---- sections: a status mark (✓ done, ! worth a look, ○ optional or not checked yet, ✦ Claude suggests), a title and a one-line summary;
   a tap on the header folds or unfolds it. Which are open is kept in memory while the app runs (CK_OPEN, by sheet and section): the item
   sheet shares one set ('e'), so a section opened on one item stays open on the next; each Add card has its own ('q|<id>'). ---- */
const CK_OPEN={};   // (CK_OPEN['*'], when set, is the default of every section instead of its own: tests that work inside sections set it true)
const ckIsOpen=(scope,k,def)=>{const v=CK_OPEN[scope+'|'+k];return v===undefined?(CK_OPEN['*']===undefined?!!def:!!CK_OPEN['*']):v};
const CK_ICON={good:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',warn:'<b aria-hidden="true">!</b>',
  ai:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2-1.8-5.2-5.2-1.8 5.2-1.8z"/></svg>',opt:'',todo:''};
const CK_SAY={good:'Done',warn:'Worth a look',ai:'Claude suggests',opt:'Optional',todo:'Not checked yet'};
const ckMark=m=>`<span class="ckm ck-${m}" role="img" aria-label="${CK_SAY[m]||''}">${CK_ICON[m]||''}</span>`;
/* o: {mark, title, sum (HTML), body (HTML), open (the default), id, cls} */
function ckSec(scope,k,o){const open=ckIsOpen(scope,k,o.open);
  return `<section class="cks${open?' open':''}${o.cls?' '+o.cls:''}" data-ck="${k}" data-scope="${esc(scope)}"${o.id?` id="${o.id}"`:''}>`+
    `<button type="button" class="ckh" aria-expanded="${open}" onclick="ckToggle(this)">${ckMark(o.mark)}<span class="ckt"><b>${o.title}</b><small>${o.sum||''}</small></span>`+
    `<svg class="ckchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="ckb">${o.body}</div></section>`}
function ckToggle(b,on){const s=b&&b.closest('.cks');if(!s)return;if(on===undefined)on=!s.classList.contains('open');
  s.classList.toggle('open',on);b.setAttribute('aria-expanded',String(on));CK_OPEN[s.dataset.scope+'|'+s.dataset.ck]=on;if(on)cmpMount(s)}
/* the colors as a summary: a small chip of each and its name ("● Navy · ● white stripes") */
const ckChip=c=>COLORS[c]?`<span class="ckchip" style="background:${COLORS[c]}"></span>`:'';
function ckColSum(it,main){const a=[main,it.secondaryColor,it.tertiaryColor].filter(c=>c&&COLORS[c]),x=accentsOf(it);
  return a.map((c,k)=>`<span class="ckcn">${ckChip(c)}${esc(k?colName(c).toLowerCase():cap1(colName(c)))}</span>`).join(' · ')+(x.length?`<span class="ckcn ckalso"> · also ${esc(x.map(c=>colName(c).toLowerCase()).join(', '))}</span>`:'')}
/* "Also has" under the colour rows (2026-11-16, accents: core.js accentsOf): a chip for each with × to take it off, and "Add a color" (the
   colour sheet, colpick.js accChoices) while there are fewer than ACCENT_MAX. On patterned cloth, or any item that has some. src 'q' (the
   Add card, ref its id) or 'e' (the item sheet, ref its id) */
function accRow(src,ref,it){const a=accentsOf(it);if(!a.length&&!hasPat(it.type))return '';const r=`'${jsq(String(ref))}'`;
  const chip=c=>`<span class="accchip" data-c="${esc(c)}">${ckChip(c)}<span>${esc(cap1(colName(c)))}</span><button type="button" class="accx" aria-label="Remove ${esc(colName(c).toLowerCase())}" onclick="accDel('${src}',${r},'${jsq(c)}')">×</button></span>`;
  return `<div class="accrow" role="group" aria-label="Also has"><span class="acclab">Also has</span><span class="accchips">${a.map(chip).join('')}`+
    `${a.length<ACCENT_MAX?`<button type="button" class="accadd" onclick="openColPick('${src}',${r},'accents')" aria-haspopup="dialog">+ Add a color</button>`:''}</span></div>`}
/* how sure Claude was, in words */
const ckSure=c=>c==='high'?'Claude is sure':c==='medium'?'Claude is fairly sure':c==='low'?'Claude isn’t sure':'';

/* ---- the close-up beside the drawing ("Look & compare" on the item sheet, "Texture match" on the Add card).
   The close-up on the left, the drawing on the right, the same size and the same crop; "Close-up" top left, "Drawn" top right, "White
   paper" on the close-up when white paper was found, the zoom on the drawing's bottom corner. A tap on either slides them toward each
   other (0.38 s ease-out; none with reduced motion): the same size, overlapping by half, the close-up on top. In the overlap both show the
   same spot of cloth (the close-up the left two-thirds of the region shown, the drawing the right two-thirds), the close-up's overlapping
   half see-through (op, 50% to start), solid at the seam and fading to nothing at its own right edge, so neither square's edge shows; the
   inner corners square, no shadow. The slider "Close-up ◀ ▶ Drawn" shows only while they overlap and sets how see-through. A second tap
   slides them apart. Pinch (both squares together), − / + and Ctrl+wheel zoom; a drag pans when zoomed. No lens, no hint text.
   State per item / card while the app runs (CMP); the pictures are drawn from the Image elements (no copies), the drawing from the item's
   own fabric SVG (itemThumb full) rendered once per look. ---- */
const CMP={},CMP_SRC={},CMP_PIC={},CMP_UNDO={},CMP_LAB={},CMP_ASKED={};
const CMP_DW=640;   // the drawing's pixels across
const CMP_KEEP=4;   // pictures kept for this many items / cards
const cmpSt=k=>CMP[k]||(CMP[k]={ov:false,z:1,cu:.5,cv:.5,op:.5});
/* the drawing as tagged, as an SVG of its own (the close-up and the swatch cut from it left out: this is what the app paints) */
function cmpDrawn(it){const h=itemThumb({...it,swatch:undefined,swSrc:undefined,texture:undefined},true),a=h.indexOf('<svg'),b=h.lastIndexOf('</svg>');
  return a<0||b<0?'':h.slice(a,b+6).replace(/th\d+-/g,'cmp-').replace('<svg ',`<svg width="${CMP_DW}" height="${CMP_DW}" `)}
function cmpHtml(key,cu,dw,paper){CMP_SRC[key]={cu,dw};const s=cmpSt(key),zt=(Math.round(s.z*10)/10)+'×',say=s.ov?'apart':'together';
  return `<div class="cmpw" data-cmp="${esc(key)}"><div class="cmpv${s.ov?' ovl':''}">`+
    `<button type="button" class="cmplv cmp-cu" aria-pressed="${s.ov}" aria-label="Your close-up. Tap to slide the two pictures ${say}"><canvas aria-hidden="true"></canvas><span class="cmpl tl" aria-hidden="true">Close-up</span>${paper?'<span class="cmpl bl ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>White paper</span>':''}</button>`+
    `<button type="button" class="cmplv cmp-dw" aria-pressed="${s.ov}" aria-label="The drawing. Tap to slide the two pictures ${say}"><canvas aria-hidden="true"></canvas><span class="cmpl tr" aria-hidden="true">Drawn</span><span class="cmpl br cmpz" aria-hidden="true"${s.z<1.05?' hidden':''}>${zt}</span></button></div>`+
    `<div class="cmptools"><label class="cmpop"${s.ov?'':' hidden'}><span>Close-up</span><input type="range" min="0" max="100" value="${Math.round(s.op*100)}" aria-label="How see-through the close-up is where it overlaps the drawing"><span>Drawn</span></label>`+
    `<span class="cmpsp"${s.ov?' hidden':''}></span><span class="cmpzm" role="group" aria-label="Zoom"><button type="button" class="cmpzo" aria-label="Zoom out">−</button><button type="button" class="cmpzi" aria-label="Zoom in">+</button></span></div></div>`}
/* after a redraw: every comparison not yet wired up gets its listeners and its pictures */
function cmpMount(root){if(!root)return;for(const w of root.querySelectorAll('.cmpw[data-cmp]:not(.on)')){w.classList.add('on');cmpBind(w)}}
function cmpBind(w){const key=w.dataset.cmp,s=cmpSt(key),v=w.querySelector('.cmpv'),views=[...w.querySelectorAll('.cmplv')];
  v.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});   // the sheets' own swipes (down to close, sideways to the next item) don't start on the pictures
  const pts=new Map();let pinch=null,drag=null;
  for(const el of views){
    el.style.touchAction=s.z>1?'none':'pan-y';
    el.addEventListener('pointerdown',e=>{if(e.button>0)return;if(!pts.size)w.dataset.moved='';pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pts.size===2){const [p,q]=[...pts.values()];pinch={d0:Math.hypot(p.x-q.x,p.y-q.y)||1,z0:s.z};drag=null;w.dataset.moved='1'}
      else if(pts.size===1)drag={x:e.clientX,y:e.clientY,cu:s.cu,cv:s.cv,w:el.clientWidth||1};
      if(pts.size===2||s.z>1)try{el.setPointerCapture(e.pointerId)}catch{}});
    el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch&&pts.size>=2){const [p,q]=[...pts.values()];cmpZoom(w,pinch.z0*Math.hypot(p.x-q.x,p.y-q.y)/pinch.d0);e.preventDefault();return}
      if(!drag||s.z<=1)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6)w.dataset.moved='1';
      if(w.dataset.moved){s.cu=drag.cu-dx/(drag.w*s.z);s.cv=drag.cv-dy/(drag.w*s.z);cmpClamp(s);cmpPaint(w);e.preventDefault()}});
    const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size)drag=null};
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
    el.addEventListener('click',()=>{if(w.dataset.moved){w.dataset.moved='';return}cmpOv(w,!s.ov)});
    el.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();cmpZoom(w,s.z*(e.deltaY<0?1.15:1/1.15))},{passive:false});   // a trackpad's pinch; a plain wheel scrolls the sheet
    el.addEventListener('keydown',e=>{const k=e.key,st=.06/s.z;
      if(k==='+'||k==='=')cmpZoom(w,s.z*1.5);else if(k==='-')cmpZoom(w,s.z/1.5);
      else if(s.z>1&&k==='ArrowLeft')s.cu-=st;else if(s.z>1&&k==='ArrowRight')s.cu+=st;else if(s.z>1&&k==='ArrowUp')s.cv-=st;else if(s.z>1&&k==='ArrowDown')s.cv+=st;
      else return;e.preventDefault();e.stopPropagation();cmpClamp(s);cmpPaint(w)})}
  const op=w.querySelector('.cmpop input');if(op)op.addEventListener('input',()=>{s.op=op.value/100;cmpPaint(w)});
  w.querySelector('.cmpzi').addEventListener('click',()=>cmpZoom(w,s.z*1.5));w.querySelector('.cmpzo').addEventListener('click',()=>cmpZoom(w,s.z/1.5));
  const fit=()=>{if(!w.isConnected||!v.clientWidth)return;cmpSize(w);cmpSlide(w,true);cmpPaint(w)};
  // (one observer per drawing, let go once the drawing has left the page: each redraw made another that watched forever, CR-4-14)
  if(window.ResizeObserver){const ro=new ResizeObserver(()=>{if(!w.isConnected){ro.disconnect();return}fit()});ro.observe(v)}
  fit();cmpLoad(key).then(()=>{if(w.isConnected)cmpPaint(w)})}
const cmpClamp=s=>{const h=.5/s.z;s.cu=Math.min(1-h,Math.max(h,s.cu));s.cv=Math.min(1-h,Math.max(h,s.cv))};
function cmpZoom(w,z){const s=cmpSt(w.dataset.cmp);s.z=Math.min(4,Math.max(1,z));cmpClamp(s);
  for(const el of w.querySelectorAll('.cmplv'))el.style.touchAction=s.z>1?'none':'pan-y';
  const t=w.querySelector('.cmpz');if(t){t.hidden=s.z<1.05;t.textContent=(Math.round(s.z*10)/10)+'×'}cmpPaint(w)}
/* slid together (on) or apart */
function cmpOv(w,on){const s=cmpSt(w.dataset.cmp);s.ov=!!on;cmpSlide(w);w.querySelector('.cmpv').classList.toggle('ovl',s.ov);
  const r=w.querySelector('.cmpop'),sp=w.querySelector('.cmpsp');if(r)r.hidden=!s.ov;if(sp)sp.hidden=s.ov;
  for(const el of w.querySelectorAll('.cmplv')){el.setAttribute('aria-pressed',String(s.ov));el.setAttribute('aria-label',el.getAttribute('aria-label').replace(/(together|apart)$/,s.ov?'apart':'together'))}
  cmpPaint(w)}
/* how far each square moves: the gap closes and they overlap by half a square (now: without the slide, after a redraw or a resize) */
function cmpSlide(w,now){const v=w.querySelector('.cmpv'),[a,b]=w.querySelectorAll('.cmplv');if(!a||!b||!a.offsetWidth)return;
  const d=(a.offsetWidth/2+(b.offsetLeft-a.offsetLeft-a.offsetWidth))/2;if(v.style.getPropertyValue('--d')===d+'px')return;
  if(now){v.classList.add('cmpnow');v.style.setProperty('--d',d+'px');void v.offsetWidth;requestAnimationFrame(()=>v.classList.remove('cmpnow'))}else v.style.setProperty('--d',d+'px')}
function cmpSize(w){const dpr=Math.min(window.devicePixelRatio||1,2.5);
  for(const el of w.querySelectorAll('.cmplv')){const c=el.querySelector('canvas'),n=el.clientWidth;if(!n)continue;const px=Math.round(n*dpr);if(c.width!==px){c.width=px;c.height=px}}}
const cmpImg=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src});
/* the two pictures for a key: the close-up as an Image, the drawing as an Image of its SVG (made again only when the drawing changed) */
async function cmpLoad(key){const src=CMP_SRC[key];if(!src)return;let P=CMP_PIC[key];
  if(!P||P.cuSrc!==src.cu){P=CMP_PIC[key]={cuSrc:src.cu,cu:null,cuJob:null,dwSrc:'',dw:null,dwJob:null}}
  delete CMP_PIC[key];CMP_PIC[key]=P;const ks=Object.keys(CMP_PIC);while(ks.length>CMP_KEEP)delete CMP_PIC[ks.shift()];   // the latest last; the oldest go
  if(!P.cu&&!P.cuJob&&src.cu)P.cuJob=cmpImg(src.cu).then(im=>{P.cu=im}).catch(()=>{});
  if(P.dwSrc!==src.dw){P.dwSrc=src.dw;const want=src.dw;P.dwJob=src.dw?cmpImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(src.dw)).then(im=>{if(P.dwSrc===want)P.dw=im}).catch(()=>{}):null}
  await Promise.all([P.cuJob,P.dwJob].filter(Boolean))}
function cmpPaint(w){const key=w.dataset.cmp,s=cmpSt(key),P=CMP_PIC[key];if(!P)return;
  if(P.dwSrc!==(CMP_SRC[key]||{}).dw){cmpLoad(key).then(()=>{if(w.isConnected)cmpPaint(w)});if(!P.dw)return}
  const sw=1/s.z,sx=Math.min(1-sw,Math.max(0,s.cu-sw/2)),sy=Math.min(1-sw,Math.max(0,s.cv-sw/2)),s3=sw*2/3,oy=sy+(sw-s3)/2;
  const put=(x,im,nx,ny,nw,W)=>{const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,side=Math.min(iw,ih),ox=(iw-side)/2,oy2=(ih-side)/2;
    x.drawImage(im,ox+nx*side,oy2+ny*side,nw*side,nw*side,0,0,W,W)};
  for(const el of w.querySelectorAll('.cmplv')){const c=el.querySelector('canvas'),W=c.width,cu=el.classList.contains('cmp-cu'),im=cu?P.cu:P.dw;if(!W||!im)continue;
    const x=c.getContext('2d');if(!x)continue;x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='source-over';x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.clearRect(0,0,W,W);
    if(!s.ov){put(x,im,sx,sy,sw,W);continue}
    put(x,im,cu?sx:sx+sw/3,oy,s3,W);if(!cu)continue;
    // the close-up's overlapping half thinned: solid at the seam (the drawing's edge stays under it), see-through across, gone at its right edge
    const r=Math.max(10,W*.08),k=r/(W/2),g=x.createLinearGradient(W/2,0,W,0);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(k,`rgba(0,0,0,${s.op})`);g.addColorStop(Math.max(k,1-k*1.6),`rgba(0,0,0,${s.op})`);g.addColorStop(1,'rgba(0,0,0,1)');
    x.globalCompositeOperation='destination-out';x.fillStyle=g;x.fillRect(W/2,0,W/2,W);x.globalCompositeOperation='source-over'}}

/* ---- under the pictures: how far the drawing is from the cloth ("Darker · Same · Lighter" and "Drawn 2 steps lighter than the cloth"),
   Match close-up (with Undo) and the white-paper line ---- */
/* the cloth's measured color (Lab): the Add card's measurement, a saved item's when it was measured from its close-up, else measured
   once from the close-up here (then the sheet is drawn again) */
function cmpLab(src,it){const m=it.meas;if(m&&m.src==='closeup'&&m.lab)return m.lab;if(!it.texture)return null;
  const k=texSig(it.texture);if(CMP_LAB[k]!==undefined)return CMP_LAB[k];CMP_LAB[k]=null;const id=it.id;
  const redraw=()=>{if(src==='q'){if(queue.some(q=>q.id===id))renderAdd()}else if(editing===id)renderItem()};
  // false: it couldn't be measured (the picture didn't load, the phone refused a canvas, no color came out); the line then says so
  // instead of "Measuring the close-up…" for good (CR-4-13)
  imgOf(it.texture).then(im=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');if(!x)throw new Error('no canvas');x.drawImage(im,0,0);
    CMP_LAB[k]=measureCloth(c,null,{}).lab||false}).catch(()=>{CMP_LAB[k]=false}).then(redraw);
  return null}
/* drawn steps lighter (+) or darker (−) than the cloth; null when it can't be told */
const cmpDiff=(it,lab)=>lab&&COLORS[primaryCol(it)]?(it.shade||0)-shadeFor(it,lab):null;
const cmpSteps=n=>`${n} step${n===1?'':'s'}`;
const cmpDiffText=d=>d===null?'':d===0?'The drawing matches the cloth':`Drawn ${cmpSteps(Math.abs(d))} ${d>0?'lighter':'darker'} than the cloth`;
function cmpMatchHtml(src,ref,it,lab){const d=cmpDiff(it,lab),key=src==='q'?it.id:ref,r=`'${jsq(String(ref))}'`;
  if(d===null)return !COLORS[primaryCol(it)]?'':lab===false?'<p class="cmpmt mut cmpwait cmpfail">Couldn’t measure the close-up.</p>':'<p class="cmpmt mut cmpwait">Measuring the close-up…</p>';
  const pos=50+Math.max(-SHADE_MAX,Math.min(SHADE_MAX,d))/SHADE_MAX*46,undo=CMP_UNDO[key]!==undefined&&CMP_UNDO[key]!==(it.shade||0);
  return `<div class="cmpmatch"><div class="cmpbar" role="img" aria-label="${cmpDiffText(d)}"><i style="left:${pos}%"></i></div><div class="cmplab" aria-hidden="true"><span>Darker</span><span>Same</span><span>Lighter</span></div>`+
    `<p class="cmpmt" role="status">${cmpDiffText(d)}</p><div class="cmpmb"><button type="button" class="cmpgo" onclick="cmpMatchGo('${src}',${r})">Match close-up</button>${undo?`<button type="button" class="cmpundo" onclick="cmpMatchUndo('${src}',${r})">Undo</button>`:''}</div></div>`}
/* Match close-up: the shade from the close-up's measurement (add.js matchShadeQ / matchShadeE), the shade before kept for Undo */
function cmpMatchGo(src,ref){const it=src==='q'?cardOf(ref):items.find(x=>x.id===ref);if(!it)return;CMP_UNDO[src==='q'?it.id:ref]=it.shade||0;
  if(src==='q'){it.checked={...it.checked,tex:1};matchShadeQ(ref)}else matchShadeE(ref)}
async function cmpMatchUndo(src,ref){const it=src==='q'?cardOf(ref):items.find(x=>x.id===ref);if(!it)return;const key=src==='q'?it.id:ref,v=CMP_UNDO[key];if(v===undefined)return;delete CMP_UNDO[key];
  if(v)it.shade=v;else delete it.shade;if(src==='q'){renderAdd();return}await put(it);planDirty();renderWardrobe()}
/* whether the close-up has white paper: {ref, warm} (measure.js paperOf, kept in memory by the pictures' signatures), worked out once and
   then drawn again; an Add card's measurement says it at once */
function cmpPaper(src,it){const n=paperNow(it);if(n)return n;if(src==='q'&&it.meas&&it.meas.src==='closeup')return {ref:!!it.meas.ref,warm:false};
  const k=paperKey(it);if(k&&!CMP_ASKED[k]){CMP_ASKED[k]=1;const id=it.id;paperOf(it).then(r=>{if(!r)return;if(src==='q'){if(queue.some(x=>x.id===id))renderAdd()}else if(editing===id)renderItem()}).catch(()=>{})}
  return null}
/* the white-paper line under the comparison (retake: the Retake close-up button's HTML) */
function cmpPaperLine(p,retake){if(!p)return '';
  return p.ref?`<div class="wbst ok cmpwb" role="status"><span class="ic" aria-hidden="true">✓</span><span class="tx">White paper found<small>Colors set from it.</small></span></div>`
    :`<div class="wbst no cmpwb" role="status"><span class="ic" aria-hidden="true">!</span><span class="tx">${p.warm?'No white paper, and the light looks warm<small>Colors may come out yellower than the cloth.</small>':'No white paper<small>Colors may be off.</small>'}</span>${retake||''}</div>`}
