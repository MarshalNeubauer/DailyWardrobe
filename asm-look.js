/* Daily Wardrobe: a look's painted cloth and keys, worked out on the page (the restructure S6p, 2026-11-27: moved out of assemble.js
   and asm-keys.js with their text unchanged, so the painting worker's files read no page file). The cloth tiles a look's job carries
   (suit cloth, twill, tweed, the tie's tile, the bars), the keys of a look and its master's records (asmKey, asmCmKey), the kept
   pictures it reads (renders), and the worker's line on the page (asmRun). It reads core.js, detect.js, draw.js and photo-keys.js;
   lab/gl-bench.html loads it too. */
import {COLORS,colOf,patBase} from './core.js';
import {CHECK_PATS,STRIPE_PATS,settSig,texPat,usableSett} from './detect.js';
import {comboKey,comboSig,fnv64,keepRender,listAt,picsDrawn,renders,workerBase,workerList} from './photo-keys.js';
import {ASM_CMV,ASM_CM_KINDS} from './asm-keys.js';
import {ASM_BARV,ASM_CLOSEUP_MM,ASM_HB_AMP,ASM_HB_BREAK,ASM_HB_FLECK,ASM_HB_FLOAT,ASM_HB_FLOATL,ASM_HB_GRAIN,ASM_HB_MM,ASM_HB_MOTTLE,ASM_HB_PBRK,ASM_HB_RIB,ASM_HB_SNAP,ASM_HB_SOFT,ASM_HB_THIN,ASM_HB_TR,ASM_HB_YARN,ASM_LIN,ASM_LINE_PX,ASM_METAL,ASM_MICRO,ASM_MICRO_KINDS,ASM_ON,ASM_PX_MM,ASM_RETRY_MS,ASM_SHIRT_MM,ASM_STRIPE,ASM_STRIPE_PX,ASM_SUITV,ASM_TEX_MIN_MM,ASM_TIEV,ASM_TIE_FIG_MAX,ASM_TIE_TEX_MAX,ASM_TR_CAP,ASM_TWEED,ASM_TWILL,ASM_VER,asmData,asmGetting,asmHbCw,asmImg,asmImgOf,asmLinen,asmMicroGrid,asmRetryAt,asmRun,asmStripeCount,asmSuitTexMemo,asmTieMemo,asmTried} from './assemble.js';
import {TIE_DARK_L,TIE_DARK_X,TIE_TEX_K,fabricDef} from './draw.js';
import {ask,serve,served} from './bus.js';
// (pxmm: the shirt masters are framed wider; measured: the tie 116 px wide at 2048 against 174 on the suit master, the open collar's
// shirt about 5% wider again)
const asmCmKey=(kind,name)=>asmKey('cm'+ASM_CMV+'/'+kind+'/'+name);
/* Settings → Outfit pictures → "Drawing only" (photos.js picsDrawn): nothing is painted or downloaded for Today (asmEnsure, asmAhead, asmSync,
   renderAsmUI); the lower-level calls (asmCmLook, asmCmGet, asmJob) don't ask */
const asmDrawn=()=>typeof picsDrawn==='function'&&picsDrawn();
const asmBarRgb=i=>{const c=i&&i.primaryColor;if(ASM_METAL[c])return ASM_METAL[c];const h=String(colOf(i)).replace('#','');return [0,2,4].map(k=>parseInt(h.slice(k,k+2),16)||128)};
const asmBarSig=i=>'b'+ASM_BARV+asmBarRgb(i).join('.');
/* ---- keys ---- */
const asmKey=t=>'c'+fnv64('asm/'+ASM_VER+'/'+t);
/* the outfit is painted on a colour-coded master (asm-color.js) when its kind has one on this device or in the worker's list (a phone
   then needn't download a master and its masks just to learn it exists; it downloads them only to paint a look with no picture on the worker,
   asmCmEnsure); else null: the day shows its own photo or the drawing */
/* (and the masters the last list showed are remembered, localStorage.asm_cm_listed: at start a phone holding no master would otherwise
   wait for the list before showing a picture it already keeps) */
let asmCmListed=null;
const asmCmSeen=k=>{if(!asmCmListed){try{asmCmListed=new Set(JSON.parse(localStorage.getItem('asm_cm_listed')||'[]'))}catch{asmCmListed=new Set()}}return asmCmListed.has(k)};
const asmCmHeld=k=>{const m=asmCmKey(k,'master');return !!(renders[m]||(asmList?asmList.has(m):asmCmSeen(m)))};
/* (2026-11-16) a new garment's master (asm-kinds.js) is used only when it and its base master are there: until then the day shows the drawing */
const asmCmUse=o=>{if(!ASM_ON||!served('asm-cm-kind'))return null;const k=ask('asm-kind-of',o);return k&&asmCmHeld(k)&&asmCmHeld(ask('asm-nk-base-of',k))?k:null};
const asmCmAny=()=>Object.keys(ASM_CM_KINDS).some(asmCmHeld);
/* the worker's list of the photos it keeps (GET /render?list=1: keys only, a few KB): which looks have a picture there (uploaded
   by the PC builder until it was removed, 2026-11-16) and which colour-coded masters are there. It is photos.js's one shared list (workerList: one request for the outfit photos
   and for these, kept LIST_MS, not asked again until the next UTC day once refused); null when the worker can't list: then a look is
   asked for by itself, as before */
let asmList=null,asmListAt=0;
function asmListGet(force){if(!workerBase())return Promise.resolve(null);
  return workerList(force).then(L=>{if(L&&L!==asmList){asmList=L;asmListAt=listAt;
      asmCmListed=new Set(Object.keys(ASM_CM_KINDS).map(k=>asmCmKey(k,'master')).filter(m=>asmList.has(m)));try{localStorage.setItem('asm_cm_listed',JSON.stringify([...asmCmListed]))}catch{}}
    return asmList})}
/* a figured shirt (a small figure on a grid, read from its close-up: the owner's grey chevron dobby, his lavender micro-print neat) is
   painted too, in colour: one repeat of the app's own drawing of the reading (two cells each way), each pixel as its colour over the
   reading's ground, so the ground becomes the tagged colour and the figures keep their contrast to it (a dim close-up read the white
   chevron shirt's ground as #c9c9d4). The cell's size from the close-up (ASM_CLOSEUP_MM / cells seen in it), never finer than
   ASM_TEX_MIN_MM: Claude's count across the shirt is the server's cap (80) for both. */
const asmMotif=i=>{const s=usableSett(i);return !!(s&&s.motif&&s.motif.figs&&s.motif.figs.length&&s.cr>0)};
function asmWeave(i){if(i&&i.type==='shirt'&&asmMotif(i)){const s=usableSett(i);return {f:'col',mm:2*Math.max(ASM_TEX_MIN_MM,ASM_CLOSEUP_MM/s.cr),rot:(+s.a||0)*Math.PI/180}}   // mm: the drawing's tile, two cells
  if(!i||!texPat('shirt',i.pattern))return null;const p=patBase(i.pattern),s=usableSett(i),t=s&&s.tex,k=t?t.kind:p;
  if(k==='herringbone'||(!t&&p==='herringbone')){const tr=+(s&&s.tr)||0;return {f:'tile',hb:true,mm:ASM_SHIRT_MM/(tr>0&&tr<ASM_TR_CAP?tr:ASM_HB_TR)}}
  if(!t||k==='end-on-end')return {f:'fleck'};
  return {f:'tile',mm:0}}
/** @param {*} i */ const asmSuitWeave=i=>{if(!i)return '';const b=patBase(i.pattern);if(b==='herringbone')return 'herringbone';if(b==='twill')return 'twill';
  if(b!=='solid'&&!/^own/.test(i.pattern||''))return '';
  const t=(i.pattern||'')+' '+((i.patternSpec&&i.patternSpec.description)||i.patternText||'');
  return /herringbone/i.test(t)?'herringbone':/twill|serge|gabardine/i.test(t)?'twill':''};
const asmSuitTwill=i=>!!i&&(i.type==='suit'||i.type==='blazer')&&!!asmSuitWeave(i)&&!asmSuitBands(i);
function asmTwillTex(i){const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},c2=COLORS[i.secondaryColor]?lin(COLORS[i.secondaryColor]):null;
  const hb=asmSuitWeave(i)==='herringbone';
  return {c:new Float32Array(lin(colOf(i))),TW:1,TH:1,mm:10,linen:asmLinen(i),cloth:{kind:hb?'herringbone':'twill',...(hb?{cw:asmHbCw()*ASM_PX_MM,off:0,pitch:ASM_HB_RIB*ASM_PX_MM,yarn:ASM_HB_YARN,brk:ASM_HB_BREAK,thin:ASM_HB_THIN,mottle:ASM_HB_MOTTLE,float:ASM_HB_FLOAT,floatL:ASM_HB_FLOATL,soft:ASM_HB_SOFT,grain:ASM_HB_GRAIN,pbrk:ASM_HB_PBRK}:{}),amp:hb?ASM_HB_AMP:ASM_TWILL.amp,c2,mix:c2?ASM_TWILL.mix:0,fleck:hb?ASM_HB_FLECK:ASM_TWILL.fleck,ss:true}}}
/* the weave a jacket or trousers is painted with when it is none of the band, twill or tweed painters': from its pattern, or an own
   pattern's name (a "micro houndstooth" drawn like solid) */
const asmMicroKind=i=>{if(!i)return '';const b=patBase(i.pattern);if(ASM_MICRO[b])return b;if(b!=='solid'&&!/^own/.test(i.pattern||''))return '';
  const t=(i.pattern||'')+' '+((i.patternSpec&&i.patternSpec.description)||i.patternText||'');return ASM_MICRO_KINDS.find(k=>new RegExp(k.replace('eye','[ -]?eye').replace('head','[ -]?head').replace('tooth','[ -]?tooth').replace('skin','[ -]?skin'),'i').test(t))||''};
function asmMicroTex(i,kind){const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])},C=ASM_MICRO[kind],c=lin(colOf(i));
  let c2=COLORS[i.secondaryColor]?lin(COLORS[i.secondaryColor]):null;
  // a houndstooth with no second colour is tonal: its teeth a darker shade of the cloth (a dark cloth's lighter)
  if(!c2&&kind==='houndstooth'){const y=.2126*c[0]+.7152*c[1]+.0722*c[2],k=y>.05?.35:2.6;c2=c.map(v=>Math.min(1,v*k))}
  return {c:new Float32Array(c),TW:1,TH:1,mm:10,linen:false,cloth:null,wv:{kind,N:C.N,thr:C.thr,amp:c2&&kind!=='houndstooth'?C.amp*.5:C.amp,mix:c2?C.mix:0,c2:c2?new Float32Array(c2):null,g:asmMicroGrid(kind)}}}
/* a tweed jacket with no band reading (tagged tweed, or the owner's own pattern drawn like tweed) is painted too (2026-11-13, his slate
   blue-grey tweed blazer): its colour with the tweed texture in the shading (asmTweedTile, like the linen's), its flecks in the second
   colour when it has one (a Donegal). A tweed read as a check (CHECK_PATS) stays with the band painter. */
const asmSuitTweed=i=>!!i&&(i.type==='suit'||i.type==='blazer')&&patBase(i.pattern)==='tweed'&&!asmSuitBands(i);
function asmTweedTex(i){const L=ASM_LIN,lin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
  return {c:new Float32Array(lin(colOf(i))),TW:1,TH:1,mm:10,linen:false,tweed:true,cloth:null,c2:COLORS[i.secondaryColor]?lin(COLORS[i.secondaryColor]):null,fmix:.85}}
const asmSuitSig=i=>fnv64(['s'+ASM_SUITV,colOf(i),asmSuitTwill(i)?'tw|'+ASM_TWILL.amp+'|'+ASM_TWILL.mix+'|'+ASM_TWILL.fleck+'|'+(COLORS[i.secondaryColor]||'')+'|'+asmLinen(i)+(asmSuitWeave(i)==='herringbone'?'|hb'+ASM_HB_MM+'|'+ASM_HB_AMP+'|'+ASM_HB_RIB+'|'+ASM_HB_FLECK+'|'+ASM_HB_YARN+'|'+ASM_HB_BREAK+'|s'+ASM_HB_THIN+'|m'+ASM_HB_MOTTLE+'|f'+ASM_HB_FLOAT+'/'+ASM_HB_FLOATL+'|o'+ASM_HB_SOFT+'|g'+ASM_HB_GRAIN+'|n'+ASM_HB_SNAP+'|p'+ASM_HB_PBRK:''):'',asmSuitTweed(i)?'td|'+JSON.stringify(ASM_TWEED)+'|'+(COLORS[i.secondaryColor]||''):'',asmSuitBands(i)?settSig(usableSett(i))+'|'+JSON.stringify(asmClothOf(i,usableSett(i),ASM_SHIRT_MM/(usableSett(i).tr||1)))+'|'+(i.patternSpec?JSON.stringify([i.patternSpec.across,i.patternSpec.along]):''):''].join('|')).slice(0,10);
/* ---- patterned jackets (a windowpane, a check, a stripe read in bands: the owner's khaki windowpane blazer, 2026-11-12) are painted
   too, from the reading: one repeat of the app's own drawing (fabricDef) in the reading's colours, sized by its repeats across the
   jacket (ASM_SHIRT_MM / sett.tr at ASM_PX_MM), upright on the body and along the arm on each sleeve (the sleeve zone pictures, made
   with SAM like the others), each pixel's colour times the suit's shading. Lines are painted bold: no line narrower than ASM_LINE_PX
   at 2048 (widened into the ground beside it), and lines crossing the other way at full strength (fabricDef draws them at half, for a
   swatch); a 2% line on a 5 cm pane was 3 px and read faint. A linen jacket (material, or Claude's description of the cloth) gets a
   linen texture in its shading: threads two pixels wide, each a little lighter or darker, plain-woven, with slubs. */
const asmSuitBands=i=>{const s=usableSett(i);return !!(s&&s.v===2&&s.bands&&s.bands.length>1&&s.tr>0&&(!!s.look||[...CHECK_PATS,...STRIPE_PATS].includes(patBase(i.pattern))))};   // (s.look: an own pattern's stripes or check, detect.js lookSett, whatever it plans as)   // stripes too, since they are drawn at their own width on a herringbone or twill (2026-11-13)
/* the cloth's own weave laid in the shading, from its material or Claude's description: linen (asmLinenTile), herringbone or twill
   (diagonal lines 4 px apart at 2048, 20% (twill 16%) of the visible brightness, with an 8% fleck along each thread; a herringbone's columns turn at each break, half a stripe repeat wide with its
   breaks on the stripes for a stripe, as on the owner's pinstripe, else 8 mm) -> {kind, cw, off, amp} in px at 2048, or null */
function asmClothOf(i,s,mm){const t=((i.patternSpec&&i.patternSpec.description)||i.patternText||'')+' '+(i.material||'')+' '+(i.pattern||'');
  if(asmLinen(i))return {kind:'linen'};
  const stripe=STRIPE_PATS.includes(patBase(i.pattern))&&s&&s.bands;
  if(/herringbone/i.test(t)){let cw=8*ASM_PX_MM,off=0;
    if(stripe){const rp=mm*ASM_PX_MM,g=s.bands.reduce((a,b)=>b[1]>a[1]?b:a)[0];let x=0,c=0;for(const b of s.bands){if(b[0]!==g){c=x+b[1]/2;break}x+=b[1]}cw=rp/2;off=c*rp}
    return {kind:'herringbone',cw,off,amp:stripe?ASM_STRIPE.weave:.2}}
  if(/twill|serge|gabardine/i.test(t))return {kind:'twill',amp:.16};
  return null}
async function asmSuitTex(i){const k=asmSuitSig(i);if(asmSuitTexMemo.has(k))return asmSuitTexMemo.get(k);const s=usableSett(i),mm=ASM_SHIRT_MM/s.tr,px=mm*ASM_PX_MM;
  const bold=bands=>{if(!bands)return bands;const g=bands.reduce((a,b)=>b[1]>a[1]?b:a)[0],min=(STRIPE_PATS.includes(patBase(i.pattern))?ASM_STRIPE_PX:ASM_LINE_PX)/px,out=bands.map(b=>[b[0],b[1]]);let need=0;
      for(const b of out)if(b[0]&&b[0]!==g&&b[1]<min){need+=min-b[1];b[1]=min}
      const gw=out.filter(b=>!b[0]||b[0]===g).reduce((a,b)=>a+b[1],0);if(gw>need)for(const b of out)if(!b[0]||b[0]===g)b[1]*=1-need/gw;return out};
  // Claude's own colours, band by band, where the reading has them (the owner's choice, 2026-11-12): measured from the pixels, a thin
  // line is blurred into the ground and reads weak (his windowpane's off-white #e6ddcf for Claude's #eeeadf, its blue #a1bbd3 for #8eb2d6)
  const sp=i.patternSpec,cl=(bands,spec,cross)=>spec&&spec.bands&&spec.bands.length===bands.length?bands.map((b,k)=>[cross&&!b[0]?null:spec.bands[k].hex,b[1]]):bands;
  const stp=STRIPE_PATS.includes(patBase(i.pattern)),sb=cl(s.bands,sp&&sp.across,false),sc=s.cross?cl(s.cross.bands,sp&&sp.along,true):null;
  const it={...i,sett:{...s,bands:bold(sb),cross:s.cross?{...s.cross,bands:bold(sc)}:null}};
  const def=fabricDef('asmsuit',it,'blazer').replace(/ patternTransform="[^"]*"/,'').replace(/ opacity="\.5"/g,''),num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');
  if(!w||!h)return null;const S=Math.max(1,Math.ceil(256/w)),TW=Math.round(w*S),TH=Math.max(1,Math.round(h*S)),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${3*TW}" height="${3*TH}" viewBox="0 0 ${3*w} ${3*h}"><defs>${def}</defs><rect width="${3*w}" height="${3*h}" fill="url(#asmsuit)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=3*TW;cv.height=3*TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,3*TW,3*TH);const d=x.getImageData(TW,TH,TW,TH).data,c=new Float32Array(3*TW*TH);
  for(let q=0;q<TW*TH;q++)for(let j=0;j<3;j++)c[3*q+j]=L[d[4*q+j]];
  const r={c,TW,TH,mm,linen:asmLinen(i),cloth:asmClothOf(i,s,mm)};
  if(stp){const bb=it.sett.bands,gb=bb.reduce((a,b)=>b[1]>a[1]?b:a),hx=String(gb[0]||'#000').replace('#',''),g=[0,2,4].map(q=>L[parseInt(hx.slice(q,q+2),16)||0]);
    let x0=0,lo=0;for(const b of bb){if(b!==gb&&b[0]){lo=(x0+b[1]/2)/bb.reduce((a,b)=>a+b[1],0);break}x0+=b[1]}
    const Z=ASM_STRIPE,dark=.2126*g[0]+.7152*g[1]+.0722*g[2]<.06,ch=dark?Z.chroma:1,chr=v=>{const Y=.2126*v[0]+.7152*v[1]+.0722*v[2];for(let q=0;q<3;q++)v[q]=Math.max(0,Y+ch*(v[q]-Y))};   // the stripe's place in the repeat (lo), the ground's colour (g)
    if(ch!==1){chr(g);const t=[0,0,0];for(let q=0;q<TW*TH;q++){for(let j=0;j<3;j++)t[j]=c[3*q+j];chr(t);for(let j=0;j<3;j++)c[3*q+j]=t[j]}}
    if(Z.soft>0){const sg=Z.soft*TW/(mm*ASM_PX_MM),R=Math.ceil(3*sg),kw=[];for(let o=-R;o<=R;o++)kw.push(Math.exp(-o*o/(2*sg*sg)));const ks=kw.reduce((a,b)=>a+b),t=new Float32Array(c.length);
      for(let y=0;y<TH;y++)for(let x=0;x<TW;x++)for(let j=0;j<3;j++){let a=0;for(let o=-R;o<=R;o++)a+=kw[o+R]*c[3*(y*TW+((x+o)%TW+TW)%TW)+j];t[3*(y*TW+x)+j]=a/ks}
      c.set(t)}
    Object.assign(r,{g,k:Z.mix,brk:Z.brk,blen:Z.blen,gam:dark?Z.gam:1,gain:dark?Z.gain:1,loff:lo})}if(asmSuitTexMemo.size>20)asmSuitTexMemo.clear();asmSuitTexMemo.set(k,r);return r}
async function asmTieTile(i){const def=fabricDef('asmtie',i,'tie',(usableSett(i)||{}).tex?'asmtie':undefined).replace(/ patternTransform="[^"]*"/,'').replace(/<path [^>]*stroke="#fff"[^>]*\/>/g,''),
    num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');if(!w||!h)return null;
  const S=Math.max(1,Math.ceil(256/w)),TW=Math.round(w*S),TH=Math.max(1,Math.round(h*S)),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${3*TW}" height="${3*TH}" viewBox="0 0 ${3*w} ${3*h}"><defs>${def}</defs><rect width="${3*w}" height="${3*h}" fill="url(#asmtie)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=3*TW;cv.height=3*TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,3*TW,3*TH);const d=x.getImageData(TW,TH,TW,TH).data,c=new Float32Array(3*TW*TH);
  for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)c[3*k+q]=L[d[4*k+q]];return {c,TW,TH}}
async function asmTieFor(i){const k=asmTieSig(i);if(asmTieMemo.has(k))return asmTieMemo.get(k);const s=usableSett(i),hex=colOf(i);let r={hex};
  // a woven tie's weave (tex) too: its raised grid, a tile repeated tr times across
  if(s&&(s.bands||s.motif||s.tex)){const t=await asmTieTile(i);if(t){let across=+s.tr||1.5;if(s.tex)across=Math.min(across,['twill','herringbone'].includes(s.tex.kind)?ASM_TIE_TEX_MAX:ASM_TIE_FIG_MAX);
      if(s.bands&&!s.cross&&i.texture&&s.cr>0)try{const n=asmStripeCount(await asmData(i.texture));if(n&&(n/s.cr>1.35||n/s.cr<.74))across*=n/s.cr}catch{}   // the close-up shows another count
      r={hex,c:t.c,TW:t.TW,TH:t.TH,motif:!!s.motif,across,ang:(+s.a||0)*Math.PI/180}}}
  if(asmTieMemo.size>40)asmTieMemo.clear();asmTieMemo.set(k,r);return r}
const asmTieSig=i=>{const s=usableSett(i),c=i.texture||'';return fnv64(['t'+ASM_TIEV+(s&&s.tex?'k'+TIE_TEX_K+'m'+ASM_TIE_TEX_MAX+'f'+ASM_TIE_FIG_MAX+'d'+TIE_DARK_L+'x'+TIE_DARK_X:''),colOf(i),settSig(s),c.length+c.slice(-40)].join('|')).slice(0,10)};
/* ---- putting the picture together off the page. The pixel work takes about a second on a computer and three or four on a phone,
   in blocks of up to two seconds, which on the page froze swipes and scrolling; it runs in a Web Worker (asm-worker.js, which loads
   this file and swaps in its own asmData and asmJpeg), and on the page only where no worker can (no OffscreenCanvas). ---- */
/* the outfit's picture as a JPEG data URL, or null when it can't be painted (yet): no colour-coded master for it */
let asmPhoto=async function asmPhoto(o,front){const job=await ask('asm-job',o);if(!job)return null;const r=await asmRun(job,front);return r&&r.url||null};
/* ---- on Today: the assembled picture stands in for the outfit's photo ---- */
/* assembled pictures are kept on the device (meta 'asm:out:<key>', the newest ASM_KEEP); a look's key carries everything it is painted
   from (asm-color.js asmCmOutKey), so a changed garment, master or painter is a new key */
let asmOut={};
const asmOutKey=o=>asmCmUse(o)?ask('asm-cm-out-key',o):'';
const asmStamp=o=>asmCmUse(o)?ask('asm-cm-stamp',o):0;
const asmWants=o=>!!asmCmUse(o);
/* a photo made for this very outfit after its master (Settings: Regenerate) wins (the owner's choice): it is shown, and nothing is
   painted for the outfit */
const asmFullWins=o=>{const k=asmCmUse(o),full=renders[comboKey(o)],m=k&&renders[asmCmKey(k,'master')];return !!(full&&m&&full.t>m.t)};
/* the same outfit's last picture while its current one isn't here yet (2026-11-14, the owner: "I'm seeing it swap every time I swipe"):
   a change to the painter, a master or the lighting gives every look a new key, and until the phone has painted it again
   Today showed the drawing and then swapped in the picture. A kept picture carries its outfit (lid: the master and the outfit's own
   combination key, comboKey, which changes with any garment, colour or reading but not with the painter), so the newest picture of this
   very outfit and master is shown meanwhile, and the new one replaces it quietly when it is ready. Only for showing: building ahead and
   "is it painted" still ask asmFor */
const asmLookId=o=>{const k=asmCmUse(o);return k?k+'|'+comboKey(o):''};
function asmStale(o){if(!asmWants(o)||asmFullWins(o))return null;const id=asmLookId(o);if(!id)return null;let best=null,bk=null;
  for(const [k,a] of Object.entries(asmOut))if(a&&a.lid===id&&(!best||(a.t||0)>(best.t||0))){best=a;bk=k}
  return best?{img:asmImgOf(bk,best),model:'assembled',t:best.t,sig:comboSig(o),stale:true}:null}
const asmPreSigOk=(o,m)=>!!m&&!!asmCmUse(o)&&m[1]==='cm'&&+m[2]===ASM_CMV;
/* is a kept picture still right? A colour-coded look's key carries everything it is painted from (each garment's cloth, the painter's
   code, the master's record dates from the manifest, the background's date), so a picture under it is right whoever made it: a fresh
   phone downloading newer copies of the masters than the computer holds used to refuse every picture the computer built (2026-11-14 audit) */
const asmFresh=(o,a)=>!!asmCmUse(o)&&!!a;
function asmGet(key,force){if(renders[key])return Promise.resolve(true);if(asmGetting.has(key))return asmGetting.get(key);
  const p=asmGetOnce(key,force).finally(()=>asmGetting.delete(key));asmGetting.set(key,p);return p}
async function asmGetOnce(key,force){if(renders[key])return true;const W=workerBase();if(!W||asmTried.has(key)||(!force&&asmRetryAt.get(key)>Date.now()))return false;
  // (2026-11-14 audit) marked as tried only on the worker's answer (it has it, or a 404): a network error or a busy worker used to count
  // as "missing" until the app was restarted; now it is asked again after ASM_RETRY_MS
  try{const r=await fetch(W.url+'?key='+key,{headers:{'x-app-token':W.tok},cache:'no-store'});
    if(!r.ok&&r.status!==404){asmRetryAt.set(key,Date.now()+ASM_RETRY_MS);return false}
    asmTried.add(key);const j=r.ok?await r.json().catch(()=>null):null;
    if(j&&j.img){await keepRender(key,{sig:j.sig||'',img:j.img,model:j.model||'',t:j.t||Date.now()},false);return true}}
  catch(e){console.warn('photo unavailable',e);asmRetryAt.set(key,Date.now()+ASM_RETRY_MS)}
  return false}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setAsmOut(v){asmOut=v}
/* sockets (bus.js; the restructure S6p, 2026-11-27): the weave the painter reads, for the drawn figure (draw.js loads before this file) */
serve('asm-suit-weave',asmSuitWeave);
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,asmCmHeld,asmStale,asmWants,get asmOut(){return asmOut},set asmOut(v){asmOut=v},get asmPhoto(){return asmPhoto},set asmPhoto(v){asmPhoto=v},get asmList(){return asmList},set asmList(v){asmList=v},asmBarRgb,asmBarSig,asmCmKey,asmCmUse,asmGet,asmKey,asmListGet,asmLookId,asmMotif,asmOutKey,asmStamp,asmSuitBands,asmSuitSig,asmSuitTex,asmSuitTweed,asmSuitTwill,asmSuitWeave,asmTieFor,asmTieSig,asmTweedTex,asmTwillTex,asmWeave};
export {asmCmKey,asmDrawn,asmBarRgb,asmBarSig,asmKey,asmCmHeld,asmCmUse,asmListGet,asmMotif,asmWeave,asmSuitWeave,asmSuitTwill,asmTwillTex,asmMicroKind,asmMicroTex,asmSuitTweed,asmTweedTex,asmSuitSig,asmSuitBands,asmClothOf,asmSuitTex,asmTieTile,asmTieFor,asmTieSig,asmOutKey,asmStamp,asmWants,asmFullWins,asmLookId,asmGet,asmListAt,asmList,asmOut,asmPhoto,setAsmOut,asmFresh,asmStale,asmPreSigOk,asmCmAny};
