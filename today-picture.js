/* Daily Wardrobe: Today's picture: the cloth swatches over it (ovlPiece and its makers; swatchStack, which lays them out, is in today.js),
   the double-tap zoom (toggleZoom, applyZoom) and a swatch tapped up close (swApply, swTap, swClose), with their touch listeners
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of today.js on 2026-11-17, Round C.) */
/* the cloth over Today's picture (the owner's choice, 2026-11-13): bottom left, the jacket's, the shirt's and the tie's swatches top to
   bottom, 52 px, no rim, no names, above ✕ on days that show it; the app's drawn swatches, with a jacket's or shirt's stripes in Claude's
   own colours as the painter draws them (measured from the photo a thin stripe blurs into the ground and nearly vanishes) and at least
   OVL_LINE of a repeat, and a tie's pattern at half size (more repeats). Pictures only; it takes no touches and fades while zoomed. */
import {CHECK_PATS,MOTIF_PATS,STRIPE_PATS,usableSett} from './detect.js';
import {$,TEXTURE_TYPES,colOf,hexRgb,key,patBase} from './core.js';
import {ask,served,askFor,serve} from './bus.js';
import {swatchSVG,texTileSmooth,texTileUrl,texTones} from './draw.js';
import {srcOk} from './photo-keys.js';
import {sel} from './app.js';
import {planFor} from './today-plan.js';
import {asmCmUse} from './asm-look.js';
import {ASM_ON} from './assemble.js';
const OVL_LINE=.1;
function ovlItem(i){const s=usableSett(i),sp=i.patternSpec&&i.patternSpec.across;if(!s||!s.bands||i.type==='tie')return i;
  let b=s.bands.map(x=>[x[0],x[1]]);if(sp&&sp.bands&&sp.bands.length===b.length)b=b.map((x,k)=>[sp.bands[k].hex||x[0],x[1]]);
  const g=b.reduce((a,x)=>x[1]>a[1]?x:a)[0];let need=0;for(const x of b)if(x[0]&&x[0]!==g&&x[1]<OVL_LINE){need+=OVL_LINE-x[1];x[1]=OVL_LINE}
  const gw=b.filter(x=>!x[0]||x[0]===g).reduce((a,x)=>a+x[1],0);if(gw>need)for(const x of b)if(!x[0]||x[0]===g)x[1]*=1-need/gw;
  return {...i,sett:{...s,bands:b}}}
// a shirt's figured weave: its soft tile swapped for the higher-fidelity one (texTileSmooth: rounded outlines and a thread grain)
const ovlWeave=(i,v)=>{const s=usableSett(i),t=s&&s.tex;if(i.type!=='shirt'||!t||!t.grid||t.kind==='herringbone'||t.kind==='twill'||patBase(i.pattern)==='solid')return v;
  const [lo,hi]=texTones(colOf(i),t,1.7),old=texTileUrl(t.grid,lo,hi),nu=old&&texTileSmooth(t.grid,lo,hi);return old&&nu&&v.includes(old)?v.split(old).join(nu):v};
const ovlSvg=i=>{const v=ovlWeave(i,swatchSVG(ovlItem(i),true));if(i.type!=='tie')return v;
  return v.replace(/<pattern ([^>]*?)>/,(m,a)=>/patternTransform="/.test(a)?`<pattern ${a.replace(/patternTransform="([^"]*)"/,'patternTransform="$1 scale(.5)"')}>`:`<pattern ${a} patternTransform="scale(.5)">`)};
/* the real cloth where it reads (the owner's choice, 2026-11-13): an item's precision swatch (the square cut from its close-up, white-balanced
   and matched to its colour: item.swatch with swSrc 'tex') for a tie, and for a plain or finely woven jacket; a shirt is always drawn, and a
   striped, checked or figured jacket stays drawn, since a close-up of a patch of cloth barely shows its pattern at this size (his ink aubergine
   pinstripe's read as plain dark cloth); an item without a close-up stays drawn */
const ovlCloseup=i=>!!(i.swatch&&i.swSrc==='tex'&&i.texture&&TEXTURE_TYPES.includes(i.type));
const ovlDrawn=i=>{if(i.type==='tie')return false;if(i.type==='shirt')return true;   // a shirt is always drawn (the owner, 2026-11-13: as in the mockup he chose)
  const s=usableSett(i);return !!(s&&(s.bands||s.motif))||[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS].includes(patBase(i.pattern)||'')};
/* a suit's or blazer's cloth, painted (the owner's choice, 2026-11-13, "Stronger grain" from a mockup, and every suit drawn, never its
   close-up): its read bands (in Claude's colours, at least OVL_LINE, as ovlItem) as anti-aliased stripes two repeats across, crossing lines
   over them, and the cloth's grain (ovlGrain: twill ribs, herringbone columns, linen slubs, else a fine plain weave) at OVL_GRAIN times
   the mockup's base strength; a suit with a stripe, check or figure but no band reading keeps the drawn tile. A PNG, cached. */
const OVL_PX=260,OVL_GRAIN=2.2,OVL_CROSS=.06,OVL_CROSS_A=.75,OVL_SUITS=new Map();
/* (2026-11-15, the materials audit) corduroy's wales, seersucker's puckered stripe and velvet's soft pile, from the material */
const ovlGrain=i=>{const t=((i.patternSpec&&i.patternSpec.description)||i.patternText||'')+' '+(i.material||'')+' '+(i.pattern||''),m=String(i.material||'');
  return /linen/i.test(t)?'linen':/corduroy/i.test(m)?'cord':/seersucker/i.test(m)?'sucker':/velvet/i.test(m)?'velvet':/herringbone/i.test(t)?'herringbone':/twill|serge|gabardine/i.test(t)?'twill':'plain'};
function ovlSuitPng(i){if(typeof document==='undefined')return null;const o=ovlItem(i),s=usableSett(o),bands=s&&s.v===2&&s.bands&&s.bands.length>1?s.bands:null;
  if(!bands&&(s&&s.motif||[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS].includes(patBase(i.pattern)||'')))return null;
  const kind=ovlGrain(i),cx=bands&&s.cross&&s.cross.bands&&Math.abs(Math.abs(s.cross.d)-90)<=20?s.cross:null,flip=bands&&Math.abs(Math.abs(s.a||0)-90)<20;
  const key=JSON.stringify([bands,cx,flip,kind,colOf(i)]);if(OVL_SUITS.has(key))return OVL_SUITS.get(key);
  const S=OVL_PX,P=S/2,Pc=P*(cx&&cx.r||1),Q=8,ground=hexRgb(colOf(i));
  const cum=b=>{let a=0;return b.map(([h,w])=>{const r=[a,a+w,h];a+=w;return r})},at=(B,u)=>{u=((u%1)+1)%1;for(const b of B)if(u>=b[0]&&u<b[1])return b[2];return null};
  // along: the stripes' colour in each column, the share of each column point inside a band (anti-aliased by Q points)
  const vb=bands&&cum(bands),col=[];for(let p=0;p<S;p++){const a=[0,0,0];for(let q=0;q<Q;q++){const c=vb?hexRgb(at(vb,(p+(q+.5)/Q)/P)||'#000'):ground;for(let j=0;j<3;j++)a[j]+=c[j]/Q}col.push(a)}
  const cb=cx&&cum(cx.bands.map(([h,w])=>[h,h?Math.max(w,OVL_CROSS):w])),row=[];
  for(let p=0;p<S;p++){const a=[0,0,0];let n=0;if(cb)for(let q=0;q<Q;q++){const h=at(cb,(p+(q+.5)/Q)/Pc);if(h){const c=hexRgb(h);for(let j=0;j<3;j++)a[j]+=c[j];n++}}row.push(n?{c:a.map(v=>v/n),k:n/Q*OVL_CROSS_A}:null)}
  const hash=(x,y)=>{let h=(x*374761393+y*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296},m=OVL_GRAIN;
  const c=document.createElement('canvas');c.width=c.height=S;const X=c.getContext('2d'),D=X.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const u=flip?y:x,v=flip?x:y,b=col[u],r=row[v],px=r?b.map((w,j)=>w+(r.c[j]-w)*r.k):b;let g;
    if(kind==='twill')g=1+m*(.055*Math.sin(2*Math.PI*(x+y)/7)+.03*(hash(x+y,(y-x)>>2)-.5));
    else if(kind==='herringbone'){const k=Math.floor(x/26),d=k%2?x+y:x-y;g=1+m*(.07*Math.sin(2*Math.PI*d/7)+.03*(hash(d,k)-.5))}
    else if(kind==='linen')g=1+m*(.05*(hash(x>>1,7)-.5)+.05*(hash(13,y>>1)-.5)+.03*(hash(x,y)-.5));
    else if(kind==='cord'){const u=flip?y:x;g=1+m*(.09*Math.pow(Math.sin(Math.PI*u/10),2)-.045+.025*(hash(u,(flip?x:y)>>3)-.5))}   // the wales run with the stripes
    else if(kind==='sucker'){const u=flip?y:x,pk=Math.floor(u/14)%2;g=1+m*(pk?.05*(hash(u>>2,(flip?x:y)>>2)-.5)+.03*Math.sin((flip?x:y)/2.5):.02*(hash(x,y)-.5)+.012)}
    else if(kind==='velvet')g=1+m*(.04*(hash(x>>4,y>>4)-.5)+.03*(hash(x>>2,y>>2)-.5)+.012*(hash(x,y)-.5));
    else g=1+m*(.025*Math.sin(Math.PI*x/2)*Math.sin(Math.PI*y/2)+.035*(hash(x,y)-.5));
    const k=4*(y*S+x);for(let j=0;j<3;j++)D.data[k+j]=Math.max(0,Math.min(255,Math.round(px[j]*g)));D.data[k+3]=255}
  X.putImageData(D,0,0);const url=c.toDataURL('image/png');if(OVL_SUITS.size>12)OVL_SUITS.clear();OVL_SUITS.set(key,url);return url}
// a plain or finely woven jacket with a close-up shows it again (the owner's choice, 2026-11-13, "the mix": at 64 px the painted grain of
// a twill was a flat square, its close-up real cloth); a striped, checked or figured one stays painted (its close-up lost the stripes)
/* a herringbone shirt's swatch (2026-11-14, the owner's pick "D" from mockups of his pink herringbone): cut from the painter's own cloth
   (asm-color.js asmCmTile: the colour held, every other column lighter, as in the picture), about OVL_HB_PAIRS column pairs across, a
   OVL_HB_PX square PNG (the enlarged swatch is 46% of the picture). The drawn swatch (the list dot's tile at 2.2x strength) read as harsh
   charcoal zigzags on near-white. The tile is rasterised, so it is made once per look, asynchronously: until then a plain patch of the
   shirt's colour (data-hb), replaced where it shows when ready; if it can't be made, the drawn swatch as before */
const OVL_HB_PAIRS=5,OVL_HB_PX=512,OVL_HB=new Map();let ovlHbN=0;   // (CR-8-05) ids from a counter: the cache's size repeats after an eviction
const ovlHbKey=i=>JSON.stringify([colOf(i),usableSett(i),i.pattern,served('asm-hb-lift')?ask('asm-hb-lift'):0,OVL_HB_PAIRS]);
function ovlHbShirt(i){if(!i||i.type!=='shirt'||typeof document==='undefined'||!served('asm-hb-shirt')||!served('asm-cm-tile')||!ask('asm-hb-shirt',i))return null;
  const k=ovlHbKey(i);let e=OVL_HB.get(k);
  if(!e){e={id:'hb'+(++ovlHbN),url:null,fail:false};OVL_HB.set(k,e);
    const put=h=>document.querySelectorAll(`[data-hb="${e.id}"]`).forEach(x=>{x.outerHTML=h});
    e.p=ask('asm-cm-tile',i,'shirt').then(T=>{if(!T)throw new Error('no tile');
      const g=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055),tc=document.createElement('canvas');tc.width=T.TW;tc.height=T.TH;
      const tx=tc.getContext('2d'),d=tx.createImageData(T.TW,T.TH);for(let n=0;n<T.TW*T.TH;n++){for(let q=0;q<3;q++)d.data[4*n+q]=g(Math.max(0,Math.min(1,T.t[3*n+q])));d.data[4*n+3]=255}tx.putImageData(d,0,0);
      const S=OVL_HB_PX,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),s=S/(OVL_HB_PAIRS*T.TW);x.imageSmoothingQuality='high';
      x.save();x.scale(s,s);x.fillStyle=x.createPattern(tc,'repeat');x.fillRect(0,0,S/s,S/s);x.restore();
      const gr=x.createLinearGradient(0,0,S,S);gr.addColorStop(0,'rgba(255,255,255,.08)');gr.addColorStop(1,'rgba(0,0,0,.10)');x.fillStyle=gr;x.fillRect(0,0,S,S);   // the light, as the drawn swatches have
      e.url=c.toDataURL('image/png');if(OVL_HB.size>16){const first=OVL_HB.keys().next().value;if(first!==k)OVL_HB.delete(first)}put(`<img src="${e.url}" alt="">`)})
      .catch(err=>{console.warn('herringbone swatch not made',err);e.fail=true;put(ovlSvg(i))})}
  if(e.url)return `<img src="${e.url}" alt="">`;if(e.fail)return null;
  return `<svg data-hb="${e.id}" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" fill="${colOf(i)}"/></svg>`}
/* a twill suit's or blazer's swatch (2026-11-14, the owner: "show the block of pattern the painter uses for the texture now, not the close
   up"): the very tile the colour-coded painter lays over the jacket (asm-color.js asmCuTile: the close-up's cleanest square, its light
   flattened, made to tile, in the tagged colour, its grain brought up to show), the whole block (ASM_CU.T, 256 px a side), with the drawn swatches'
   light. Only where the painter takes it (asmCuWants: a twill with a close-up, not near-black cloth); made once per look, asynchronously,
   a plain patch of the jacket's colour meanwhile (data-hb, as the herringbone shirt's); with no tile (no clean patch in the close-up) the
   swatch is as before (the close-up) */
const OVL_CU=new Map();let ovlCuN=0;
const ovlCuKey=i=>JSON.stringify([i.id,colOf(i),i.pattern,(i.texture||'').length,(i.texture||'').slice(-12),served('asm-cu-v')?ask('asm-cu-v'):0]);
const ovlCuWants=i=>!!i&&(i.type==='suit'||i.type==='blazer')&&typeof document!=='undefined'&&served('asm-cu-tile')&&served('asm-cm-route')&&ask('asm-cm-route',i,'jacket').how==='twill'&&ask('asm-cu-wants',i,'twill');
const ovlSuitOld=i=>{if(ovlCloseup(i)&&!ovlDrawn(i))return `<img src="${srcOk(i.swatch)}" alt="">`;const u=ovlSuitPng(i);return u?`<img src="${u}" alt="">`:ovlSvg(i)};
function ovlCuSuit(i){if(!ovlCuWants(i))return null;const k=ovlCuKey(i);let e=OVL_CU.get(k);
  if(!e){e={id:'cu'+(++ovlCuN),url:null,fail:false};OVL_CU.set(k,e);
    const put=h=>document.querySelectorAll(`[data-hb="${e.id}"]`).forEach(x=>{x.outerHTML=h});
    e.p=ask('asm-cu-tile',i).then(T=>{if(!T||!T.t)throw new Error('no tile');
      const g=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055),S=T.TW,c=document.createElement('canvas');c.width=S;c.height=T.TH;
      const x=c.getContext('2d'),d=x.createImageData(S,T.TH);for(let n=0;n<S*T.TH;n++){for(let q=0;q<3;q++)d.data[4*n+q]=g(Math.max(0,Math.min(1,T.t[3*n+q])));d.data[4*n+3]=255}x.putImageData(d,0,0);
      const gr=x.createLinearGradient(0,0,S,T.TH);gr.addColorStop(0,'rgba(255,255,255,.08)');gr.addColorStop(1,'rgba(0,0,0,.10)');x.fillStyle=gr;x.fillRect(0,0,S,T.TH);   // the light, as the drawn swatches have
      e.url=c.toDataURL('image/png');if(OVL_CU.size>16){const first=OVL_CU.keys().next().value;if(first!==k)OVL_CU.delete(first)}put(`<img src="${e.url}" alt="">`)})
      .catch(err=>{if(String(err&&err.message)!=='no tile')console.warn('twill swatch not made',err);e.fail=true;put(ovlSuitOld(i))})}
  if(e.url)return `<img src="${e.url}" alt="">`;if(e.fail)return null;
  return `<svg data-hb="${e.id}" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" fill="${colOf(i)}"/></svg>`}
const ovlPiece=i=>{if(i.type==='suit'||i.type==='blazer')return ovlCuSuit(i)||ovlSuitOld(i);
  if(i.type==='shirt'){const h=ovlHbShirt(i);if(h)return h}
  return ovlCloseup(i)&&!ovlDrawn(i)?`<img src="${srcOk(i.swatch)}" alt="">`:ovlSvg(i)};
/* ---- double-tap the Today picture (the photo, or the drawing) to zoom in on the tie and shirt, again to zoom back out; while
   zoomed, a drag pans it (and doesn't change the day). 2.5x: the outfit photo is 1024 px square and fills about 390 px on a phone,
   so 2.5x shows it at about its own resolution (any more is only blur), with a collar, tie knot or shirt front filling the frame. ---- */
const ZOOM=2.5;let zoom=null,zoomPan=null,lastTap=null,zoomTouchAt=0;
const zoomTarget=()=>{const c=$('#mannequin-container');return c&&c.querySelector(':scope > img, :scope > svg')};
function applyZoom(anim){const c=$('#mannequin-container'),t=zoomTarget();if(!c||!t)return;const on=!!zoom&&zoom.k===key(sel);if(!on)zoom=null;
  c.classList.toggle('zoomed',on);t.style.transformOrigin='0 0';t.style.transition=anim&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'transform .28s cubic-bezier(.2,.8,.2,1)':'none';
  t.style.transform=on?`translate(${zoom.x.toFixed(1)}px,${zoom.y.toFixed(1)}px) scale(${ZOOM})`:''}
function clampZoom(){const c=$('#mannequin-container');if(!c||!zoom)return;const W=c.clientWidth,H=c.clientHeight;   // the frame, which the picture fills (an <svg> has no offsetWidth)
  zoom.x=Math.min(0,Math.max(W*(1-ZOOM),zoom.x));zoom.y=Math.min(0,Math.max(H*(1-ZOOM),zoom.y))}
/* wherever it is tapped, it zooms in on the tie and the shirt: centred across, the top of the picture (the collar and the knot)
   at the top of the frame, as the owner asked; a drag then pans from there */
function toggleZoom(){const c=$('#mannequin-container'),t=zoomTarget();if(!c||!t)return;
  if(swOpen){swClose();return}   // a swatch open up close: the double tap closes it
  if(zoom)zoom=null;else{zoom={k:key(sel),x:c.clientWidth*(1-ZOOM)/2,y:0};clampZoom()}
  applyZoom(true)}
function zoomOut(){if(zoom){zoom=null;applyZoom(true)}}
/* ---- a swatch tapped (the owner's pick, 2026-11-13, from mockups: "C", revised twice): the swatch opens large at the top left with the
   piece's name under it, the small swatches shrink in their column at the bottom left, and the photo zooms (SW_Z) and moves so the piece
   lands at SW_AT on the right, ringed (no label: the owner's ask). Another swatch switches, the same swatch or a tap on the picture
   closes it, and so do a swipe to another day and the double-tap zoom. Photos only (the drawn figure has no stack). ---- */
const SW_Z=2.3,SW_AT=[.7,.4];
// where each piece is on each colour-coded master (fractions of the picture): the point deepest inside it, measured from the masters'
// masks at 512 (the jacket's body without its sleeves and lapels); r its inscribed radius, which sizes the ring. A picture made another
// way (an outfit photo, the earlier assembler) takes the suit master's, or the open-collar shirt master's without a jacket
const SW_SPOT={suit:{top:[.341,.606,.106],shirt:[.419,.12,.043],tie:[.481,.315,.053]},vest:{top:[.341,.604,.106],shirt:[.544,.052,.039],tie:[.483,.247,.049]},
  'suit-open':{top:[.341,.606,.106],shirt:[.478,.261,.072]},'shirt-tie':{shirt:[.335,.224,.129],tie:[.497,.519,.039]},'shirt-open':{shirt:[.364,.206,.144]}};
let swOpen=null;
const swKind=o=>{let k=null;try{k=typeof asmCmUse==='function'&&typeof ASM_ON!=='undefined'&&ASM_ON?asmCmUse(o):null}catch(e){}return SW_SPOT[k]?k:o.top?(o.vest?'vest':'suit'):o.tie?'shirt-tie':'shirt-open'};
const swSpot=(o,s)=>(SW_SPOT[swKind(o)]||{})[s]||SW_SPOT.suit[s]||SW_SPOT['shirt-tie'][s];
function swApply(anim){const c=$('#mannequin-container'),t=zoomTarget(),o=planFor()[key(sel)];if(!c)return;
  askFor('care-band-soon');   // the cleaning banner's cut follows the swatches as they move (care.js)
  const on=!!(swOpen&&swOpen.k===key(sel)&&t&&o&&o[swOpen.s]&&c.classList.contains('photo')&&c.querySelector('.swstack'));if(!on)swOpen=null;
  c.scrollTop=0;c.scrollLeft=0;   // (a zoomed photo made the frame scrollable, and the tapped swatch's focus scrolled it: styles.css clips it too)
  c.classList.toggle('swopen',on);c.querySelectorAll('.swstack .ovsw').forEach(b=>{const me=on&&b.dataset.s===swOpen.s;b.classList.toggle('on',me);b.setAttribute('aria-pressed',me)});
  const motion=anim&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!on){c.querySelectorAll('.swlens,.swlab,.swring').forEach(e=>e.remove());if(t&&!zoom){t.style.transition=motion?'transform .45s cubic-bezier(.2,.8,.2,1)':'none';t.style.transform=''}return}
  const W=c.clientWidth,H=c.clientHeight,[fx,fy,r]=swSpot(o,swOpen.s),cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  // the piece moved to SW_AT, but never past the picture's edges (no blank space shows)
  const tx=cl(SW_AT[0]*W-SW_Z*fx*W,W-SW_Z*W,0),ty=cl(SW_AT[1]*H-SW_Z*fy*H,H-SW_Z*H,0);
  t.style.transformOrigin='0 0';t.style.transition=motion?'transform .45s cubic-bezier(.2,.8,.2,1)':'none';t.style.transform=`translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${SW_Z})`;
  const it=o[swOpen.s],mk=(cls,html)=>{let e=c.querySelector(':scope > .'+cls);if(!e){e=document.createElement('div');e.className=cls;e.setAttribute('aria-hidden','true');c.appendChild(e)}if(html!=null)e.innerHTML=html;return e};
  mk('swlens',ovlPiece(it));   // (no name under it: the owner's ask, 2026-11-13, so the small swatches keep more of their size)
  const ring=mk('swring'),d=cl(2*r*SW_Z,.16,.26)*W;ring.style.width=ring.style.height=d+'px';ring.style.left=(tx+SW_Z*fx*W)+'px';ring.style.top=(ty+SW_Z*fy*H)+'px'}
function swTap(s){const k=key(sel);if(zoom){zoom=null;applyZoom(false)}swOpen=swOpen&&swOpen.k===k&&swOpen.s===s?null:{k,s};swApply(true)}
function swClose(){if(swOpen){swOpen=null;swApply(true)}}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,OVL_CU,OVL_HB,ovlCuKey,ovlGrain,ovlHbKey,ovlHbShirt,ovlItem,ovlSuitPng,ovlSvg,ovlWeave,get swOpen(){return swOpen},set swOpen(v){swOpen=v},toggleZoom,zoomTarget,ovlPiece,swTap,get zoom(){return zoom},zoomOut};
export {ovlItem,ovlWeave,ovlSvg,ovlGrain,ovlSuitPng,OVL_HB,ovlHbKey,ovlHbShirt,OVL_CU,ovlCuKey,ovlPiece,zoom,zoomTarget,applyZoom,toggleZoom,zoomOut,swOpen,swApply,swTap,swClose};
// a tap on the picture (not on a swatch or another button) closes it
$('#today').addEventListener('click',e=>{if(!swOpen)return;const c=e.target.closest&&e.target.closest('#mannequin-container');if(c&&!e.target.closest('button,a'))swClose()});
(()=>{const el=$('#today'),inPic=e=>{const c=e.target.closest&&e.target.closest('#mannequin-container');return c&&!e.target.closest('button,a')?c:null};
  el.addEventListener('touchstart',e=>{const c=inPic(e);if(!c||e.touches.length>1){zoomPan=null;return}const t=e.touches[0];
    zoomPan={x0:t.clientX,y0:t.clientY,t:Date.now(),zx:zoom?zoom.x:0,zy:zoom?zoom.y:0,moved:false}},{passive:true});
  el.addEventListener('touchmove',e=>{if(!zoomPan)return;const t=e.touches[0],dx=t.clientX-zoomPan.x0,dy=t.clientY-zoomPan.y0;if(Math.abs(dx)>8||Math.abs(dy)>8)zoomPan.moved=true;
    if(!zoom)return;e.preventDefault();zoom.x=zoomPan.zx+dx;zoom.y=zoomPan.zy+dy;clampZoom();applyZoom(false)},{passive:false});
  el.addEventListener('touchend',e=>{const p=zoomPan;zoomPan=null;if(!p||p.moved||Date.now()-p.t>300){lastTap=null;return}const t=e.changedTouches[0],now=Date.now();
    if(lastTap&&now-lastTap.t<320&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<40){lastTap=null;zoomTouchAt=now;e.preventDefault();toggleZoom(t.clientX,t.clientY)}
    else lastTap={t:now,x:t.clientX,y:t.clientY}},{passive:false});
  el.addEventListener('dblclick',e=>{if(!inPic(e)||Date.now()-zoomTouchAt<700)return;e.preventDefault();toggleZoom(e.clientX,e.clientY)});
})();
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('zoomed',()=>zoom);
serve('zoom-apply',applyZoom);serve('ovl-piece',ovlPiece);serve('sw-apply',swApply);serve('sw-tap',swTap);serve('zoom-out',zoomOut);   // the restructure S6b: what required and today-no-picture files ask of this file (bus.js need)
serve('sw-close',swClose);   // the restructure S6f: today.js closes an open swatch
