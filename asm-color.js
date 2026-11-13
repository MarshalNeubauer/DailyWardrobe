/* Daily Wardrobe: assembled pictures from colour-coded masters (2026-11-13, the owner's restart of the assembler).

   A colour-coded master is a photo of the pose in which every garment is one strong, flat colour (jacket or trousers blue, waistcoat
   or belt violet, tie pink, shirt white, a chroma-green wall), made by gpt-image-2 at 2880. Its zones were read from those colours on a
   computer (C:\code\watch-test\colormaster\colormaster.js: soft masks at 2048 that add up to one at every pixel, edges unmixed and
   smoothed along each zone's shape), and its sleeves and lapels cut out with SAM. Every garment of an outfit is then painted here: its
   cloth (a solid colour, the app's drawing of its reading, or for a patterned suit the app's own suit cloth, asmSuitTex) times the
   master's light at each pixel, measured against the zone's lit level. Skin, the watch, the buckle and dark details (buttons) are the
   master's own pixels. Nothing is photographed per item.

   Four masters, by the day's dress (asmCmKind):
     suit        a jacket and a tie                  (the waistcoat master, 'vest', on a waistcoat day)
     shirt-tie   no jacket, a tie                     (framed to the upper thigh: the belt and trousers show)
     shirt-open  no jacket, no tie, an open collar
     suit-open   a jacket and no tie, an open collar  ('vest-open' on a waistcoat day; 2026-11-13: used once their masters are on
                 the worker, until then such a day keeps the earlier way or its drawing)

   They are photo records on the worker (asmCmKey, put there by tools/asm-cm-upload.js), downloaded once like the other masters.
   A phone paints at 2048; the computer's pre-build (npm run assemble) sets ASM_CM_SIZE to 2880 and scales the picture to 2048.
   Settings → Realistic photos → Item photos: "Colour-coded masters" turns this off on a phone (localStorage asm_cm = '0'). */
const ASM_CMV=1;   // the colour-coded masters' version: in their keys and every picture's key
const ASM_CM_KINDS={
  suit:{zones:['jacket','tie','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  vest:{zones:['jacket','waistcoat','tie','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  'shirt-tie':{zones:['trousers','belt','tie','buckle','background','skin','shirt','dark','watch'],sleeves:1,lapels:0,pxmm:116/174},
  'shirt-open':{zones:['trousers','belt','buckle','background','skin','shirt','dark','watch'],sleeves:1,lapels:0,pxmm:116/174*1.05},
  // a jacket with no tie (Today's "Take off" on the tie, 2026-11-13), made like the suit and waistcoat masters
  'suit-open':{zones:['jacket','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  'vest-open':{zones:['jacket','waistcoat','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1}};
// (pxmm: the shirt masters are framed wider; measured: the tie 116 px wide at 2048 against 174 on the suit master, the open collar's
// shirt about 5% wider again)
const asmCmKey=(kind,name)=>asmKey('cm'+ASM_CMV+'/'+kind+'/'+name);
const asmCmAssets=kind=>{const K=ASM_CM_KINDS[kind];if(!K)return [];return [asmCmKey(kind,'master'),...K.zones.map(z=>asmCmKey(kind,'mask/'+z)),
  ...(K.sleeves?['sleeveR','sleeveL'].map(s=>asmCmKey(kind,'part/'+s)):[]),...(K.lapels?['lapelR','lapelL'].map(s=>asmCmKey(kind,'part/'+s)):[])]};
const ASM_CM='asm_cm';   // localStorage: '0' = this phone puts pictures together the earlier way
const asmCmPref=()=>{try{return localStorage.getItem(ASM_CM)!=='0'}catch{return true}};
/* which master an outfit is painted on, or null (the earlier assembler, or the outfit's own photo) */
function asmCmKind(o){if(!o||!o.shirt||!asmCmPref())return null;
  if(o.top)return o.tie?(o.vest?'vest':'suit'):(o.vest?'vest-open':'suit-open');
  if(!o.bot||!o.belt)return null;   // the shirt masters show the trousers and the belt
  return o.tie?'shirt-tie':'shirt-open'}
/* the outfit's kind when its master is on this device (downloaded) */
const asmCmReady=o=>{const k=asmCmKind(o);return k&&renders[asmCmKey(k,'master')]?k:null};
/* the cloth of each garment, as it goes into the picture's key: a new colour, reading or drawing makes a new picture */
const ASM_CM_PAINTV=8;   // 2: jackets and trousers without a stripe or check reading are their colour; 3: a plain twill jacket has its ribs (asmTwillTex); 4: woven shirts at full swing, measured repeat, 3x3 points; 5: the sleeves reach the jacket's outer edge (ASM_CM_RIM); 6: the cloth look (#304, rolled back: its pictures are still on the worker under p6); 7: the cloth look and lighting as chosen (ASM_CM_LOOK, ASM_CM_LIGHT); 8: the same on trousers, the shirt's buttons drawn (ASM_CM_BTN), the tie's sheen dialled back (the owner: too glossy); 8: the half-hidden button drawn as a button, no purple skin edge (the button smudge)
/* the cloth look (the owner's choice, 2026-11-13, after several rounds of mockups against an OpenAI picture of his black suit, which the
   painter drew as a flat black silhouette), for jackets, waistcoats and shirts (not trousers, not tried):
   - a dark cloth (luminance under `dark`: his black twill and chocolate brown, and any dark colour later) takes the full look: kept above
     real black wool (ymin, a lift smaller on a coloured cloth so a navy stays navy, `fp` deeper in the folds), a neutral sheen where the
     master is lit (s0..s1, the same for every colour; the old above-lit gain was a share of the cloth's own brightness, nothing on black),
     the weave in that sheen and lift (sk, wk) and bolder than life (`boost` up to `dk` below `dy`), a fine grain on plain cloth, a soft
     tone curve (`toe`, `sh`)
   - a lighter cloth keeps its colour exactly (the owner: "the colors are good, I just need lighting fixes"): only its large folds get more
     contrast around the zone's own mean (`lgam` on the shading blurred `lr` px at 2048; on the shading itself it also strengthened the
     master's blotchy grain, which smudged the weave)
   - a jacket painted with stripes (a band tile with stripe breakup, T.k: his two pinstripes) is left exactly as before (the bolder weave
     broke the pinstripes' lines; the owner: leave them out) */
const ASM_CM_LOOK={ymin:.012,fp:1.7,chroma:.55,wk:4,sk:5,cmax:.8,grain:.05,sheen:.035,s0:.85,s1:1.5,dy:.03,dk:2,toe:.025,sh:.06,dark:.035,lgam:1.3,lr:12};
/* the lighting (same choice, on top of the look): contact shadows where a layer lies on another (the shirt under the tie, waistcoat,
   jacket and hands; the jacket's body under its sleeves and lapels; each layer's outline moved adx,ady px at 2048 down and to the right,
   away from the window, blurred `ar` px, `ak` deep); a window light from the left (`win` across the picture, `wd` of it on a dark cloth,
   where the full fall-off sank the black suit's right side back to black); lit edges where a sleeve, lapel or the jacket faces the light
   (`rw` px, `rim`); a silk tie's darker edges (`te`) and sheen (`ts` at `tp` across the blade, `tsw` wide); warmth in the shadows and a
   cooler lit window side (`warm`, `cool`, brightness kept); a fine film grain (`grain`) so the cloth matches the photographed hands */
/* a tie's sheen follows its own brightness (2026-11-13, the owner: "the black tie is still super glossy"): the band of light down the blade
   (ts) was the same amount of light on every tie: at .05 three times a black tie's own (22 at its edges, 66 in the band, 0-255), and still about twice at .018; below
   ASM_TIE_SHEEN_Y (linear luminance, about a mid-tone) it shrinks in step with the tie, never under ASM_TIE_SHEEN_MIN of the full band */
const ASM_TIE_SHEEN_Y=.18,ASM_TIE_SHEEN_MIN=.15;
const asmTieSheenK=y=>Math.max(ASM_TIE_SHEEN_MIN,Math.min(1,y/ASM_TIE_SHEEN_Y));
/* only the ties it changes get a new picture key */
const asmCmTieTag=(z,i)=>{if(z!=='tie'||typeof colOf!=='function')return '';const h=String(colOf(i)).replace('#',''),L=ASM_LIN||null;if(!L)return '';
  const y=.2126*L[parseInt(h.slice(0,2),16)||0]+.7152*L[parseInt(h.slice(2,4),16)||0]+.0722*L[parseInt(h.slice(4,6),16)||0];return asmTieSheenK(y)<1?'/tsh1':''};
const ASM_CM_LIGHT={adx:5,ady:8,ar:12,ak:.45,win:.08,wd:.5,rw:3,rim:.022,te:.2,tp:.36,tsw:.2,ts:.018,warm:.08,cool:.05,grain:.035};
/* the shirt's buttons, drawn (the owner, 2026-11-13: the open collar's placket buttons should look like real buttons): painted with the
   cloth they were ghost discs of the shirt's colour with its weave running through them. Each master's visible buttons, measured by eye on
   the 2048 painting ([x, y, radius] px at 2048; under the hand or the tie not listed); a button whose centre isn't shirt is skipped */
const ASM_CM_BTN={'shirt-open':[[1029,428,10.5],[1015,835,10.5],[1014,1031,10.5],[1013,1224,10.5]],'shirt-tie':[[1299,870,10],[1440,955,9]],
  // the jacket over an open collar (suit-open, built from the suit and open-collar masters, no image generator): the placket's three in the V
  'suit-open':[[919,312,12],[974,508,12],[954,714,12]]};
// a button: pearl on a light shirt, tonal (a little lighter than the cloth) on a dark one; a raised rim lit from the upper left, a slightly
// dished middle, four holes with the thread between them, a soft shadow below and to the right; in the cloth's own light
function asmCmButtons(o,P,shirt,L,gam){const pts=ASM_CM_BTN[P.kind];if(!pts)return;const S=P.S,A=P.A,f=S/2048,lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2];
  const light=lum(shirt)>.2,btn=light?[.86,.84,.80]:shirt.map(v=>Math.min(1,v*1.35+.012)),hole=btn.map(v=>v*.35),thr=light?btn.map(v=>v*.82):shirt.map(v=>v*.8);
  for(const [bx,by,br] of pts){const cx=bx*f,cy=by*f,r=br*f,k0=Math.round(cy)*S+Math.round(cx);if(!(A.shirt[k0]>200))continue;
    const sl=Math.min(1.25,Math.max(.45,P.shade.shirt[k0]/40000)),Rr=Math.ceil(r*1.7),H=[[-.27,-.27],[.27,-.27],[-.27,.27],[.27,.27]];
    for(let y=Math.floor(cy-Rr);y<=Math.ceil(cy+Rr);y++)for(let x=Math.floor(cx-Rr);x<=Math.ceil(cx+Rr);x++){if(x<0||y<0||x>=S||y>=S)continue;const k=y*S+x,j=4*k;if(A.shirt[k]<128)continue;
      const c0=[L[o[j]],L[o[j+1]],L[o[j+2]]],sx=(x+.5-cx-.16*r)/(1.2*r),sy=(y+.5-cy-.26*r)/(1.2*r),ds=Math.hypot(sx,sy),sh=Math.max(0,Math.min(1,(1.15-ds)/.45)),shad=1-.3*sh*sh;
      let cov=0,acc=[0,0,0];
      for(let a=0;a<4;a++)for(let e=0;e<4;e++){const dx=(x+(e+.5)/4-cx)/r,dy=(y+(a+.5)/4-cy)/r,d=Math.hypot(dx,dy);if(d>1)continue;cov++;
        const lt=-(dx+dy)/Math.SQRT2;let b=d>.66?1+.2*lt:1-.08*lt;if(d>.9)b*=.86;let col=btn;
        for(const [hx,hy] of H)if(Math.hypot(dx-hx,dy-hy)<.12){col=hole;b=1;break}
        if(col===btn&&((Math.abs(dy-dx)<.05||Math.abs(dy+dx)<.05)&&Math.abs(dx)<.27&&Math.abs(dy)<.27))col=thr;
        for(let q=0;q<3;q++)acc[q]+=col[q]*b*sl}
      const cv=cov/16;for(let q=0;q<3;q++){const v=c0[q]*shad*(1-cv)+(cov?acc[q]/cov:0)*cv;o[j+q]=gam(v)}}}}
/* the hand's outline against the shirt, from the master's own colour (2026-11-13): the soft skin and shirt masks are rounded, so on the
   shirt masters the skin mask took in the master's white shirt between the fingers (white wedges on any coloured shirt) and the shirt mask
   the nail tips (painted the shirt's colour). Within ASM_CM_HAND_R px (at 2048) of where the two meet, a pixel's share between them follows
   its colour: warm (red well above blue, as skin) goes to the skin, near-neutral and light (the master's white shirt) to the shirt. Only
   shares between skin and shirt move, so a coloured jacket beside a hand is never taken for skin. */
const ASM_CM_HAND_R=6;
function asmCmHandEdge(A,M,S,N){if(!A.skin||!A.shirt)return;const R=Math.max(2,Math.round(ASM_CM_HAND_R*S/2048)),sk=new Float32Array(N),sh=new Float32Array(N);
  for(let k=0;k<N;k++){sk[k]=A.skin[k]?1:0;sh[k]=A.shirt[k]?1:0}const nsk=asmCmBlur(sk,S,R),nsh=asmCmBlur(sh,S,R);
  for(let k=0;k<N;k++){const a=A.skin[k],b=A.shirt[k];if(!(nsk[k]>0&&nsh[k]>0)||a+b<200)continue;   // only where both are near, and they make up the pixel
    const j=4*k,r=M[j],g=M[j+1],bl=M[j+2],warm=r-bl,lt=(r+g+bl)/3;let t;   // t: the share that is skin
    // (a pixel half skin, half white shirt is warm but paler: it gets a share of each, and its skin colour comes from the clean skin beside it)
    if(warm>=52)t=1;else if(warm<=18&&lt>120)t=0;else if(lt<=120)continue;else t=(warm-18)/34;
    const tot=a+b,ns=Math.round(tot*t);A.skin[k]=ns;A.shirt[k]=tot-ns}}
/* the parts of the lighting that depend only on the master (its zones and shading): worked out once per master in a session */
function asmCmLightPrep(P){const {S,N,A,geo}=P,LI=ASM_CM_LIGHT,LK=ASM_CM_LOOK,sc=S/2048,X={sm:{},smb:{},ao:{},aob:null,rim:null,tl:null,tr:null};
  const dvn=(m,R)=>{let g=m;for(let i=0;i<2;i++){const b=asmCmBlur(g,S,R),d=(2*R+1)*(2*R+1),o=new Float32Array(N);for(let k=0;k<N;k++)o[k]=b[k]/d;g=o}return g};
  const shift=(m,dx,dy)=>{const o=new Float32Array(N);for(let y=0;y<S;y++){const yy=y-dy;if(yy<0||yy>=S)continue;for(let x=0;x<S;x++){const xx=x-dx;if(xx>=0&&xx<S)o[y*S+x]=m[yy*S+xx]}}return o};
  // a zone's mean light and its large folds (the shading smoothed, normalised by the zone's own coverage)
  for(const z of ['jacket','waistcoat','shirt','trousers']){const sh=P.shade[z];if(!sh||!A[z])continue;let t=0,n=0;for(let k=0;k<N;k+=3)if(A[z][k]>=248){t+=sh[k]/40000;n++}if(!n)continue;X.sm[z]=t/n;
    const R=Math.max(2,Math.round(LK.lr*sc)),v=new Float32Array(N),w=new Float32Array(N);for(let k=0;k<N;k++)if(A[z][k]>127){v[k]=sh[k]/40000;w[k]=1}
    let bv=asmCmBlur(v,S,R),bw=asmCmBlur(w,S,R);for(let k=0;k<N;k++)v[k]=bw[k]>0?bv[k]/bw[k]*w[k]:0;bv=asmCmBlur(v,S,R);bw=asmCmBlur(w,S,R);
    const o=new Float32Array(N);for(let k=0;k<N;k++)o[k]=bw[k]>0?bv[k]/bw[k]:0;X.smb[z]=o}
  const OVER={shirt:['tie','waistcoat','jacket','skin'],waistcoat:['jacket','skin'],jacket:['skin'],tie:['skin'],trousers:['belt','buckle','skin']};
  const dx=Math.round(LI.adx*sc),dy=Math.round(LI.ady*sc),R=Math.max(2,Math.round(LI.ar*sc));
  for(const z in OVER){if(!A[z])continue;const m=new Float32Array(N);for(const o of OVER[z])if(A[o])for(let k=0;k<N;k++){const v=A[o][k]/255;if(v>m[k])m[k]=v}X.ao[z]=dvn(shift(m,dx,dy),R)}
  if(geo&&geo.gar==='jacket'&&A.jacket){const m=new Float32Array(N);for(let k=0;k<N;k++)if(geo.seg[k]&&A.jacket[k]>127)m[k]=1;if(A.skin)for(let k=0;k<N;k++){const v=A.skin[k]/255;if(v>m[k])m[k]=v}X.aob=dvn(shift(m,dx,dy),R)}
  if(A.jacket){const o=Math.max(2,Math.round(LI.rw*sc)),off=o*S+o,m=new Float32Array(N);
    for(let k=off;k<N;k++){if(A.jacket[k]<200)continue;const q=k-off,sg=geo?geo.seg[k]:0;if(A.jacket[q]<128||(geo&&sg&&geo.seg[q]!==sg&&A.jacket[q]>127))m[k]=1}
    X.rim=dvn(m,Math.max(1,Math.round(1.5*sc)))}
  if(A.tie){X.tl=new Int32Array(S).fill(-1);X.tr=new Int32Array(S).fill(-1);for(let y=0;y<S;y++)for(let x=0;x<S;x++)if(A.tie[y*S+x]>127){if(X.tl[y]<0)X.tl[y]=x;X.tr[y]=x}}
  return X}
const ASM_CM_RIM=24;   // px at 2048: how far from the wall a jacket (or shirt-master) pixel outside the SAM sleeve outline still joins the sleeve beside it
/* a jacket whose weave the 2026-11-13 audit added (a herringbone, or an own pattern based on solid named twill): marked in its look's key,
   so only those looks are painted again (a new ASM_CM_PAINTV would repaint every look) */
const asmCmWeaveTag=(z,i)=>{const how=asmCmRoute(i,z).how;
  // the painters added after the routing test (2026-11-13): small woven figures on jackets and trousers, knit and paisley ties
  if(ASM_MICRO[how])return '/m'+how+'-'+JSON.stringify(ASM_MICRO[how]).replace(/\W+/g,'');
  if(how==='knit')return '/knit'+ASM_KNIT_ACROSS;if(how==='paisley')return '/paisley'+ASM_PAISLEY_ACROSS;
  if(z==='trousers'){const h=asmCmRoute(i,z).how;return ['twill','herringbone','tweed'].includes(h)?'/t'+h+(h==='herringbone'?ASM_HB_MM+'-'+ASM_HB_AMP+'-'+ASM_HB_RIB+'-'+ASM_HB_FLECK+'-'+ASM_HB_YARN+'-'+ASM_HB_BREAK+'s'+ASM_HB_THIN+'m'+ASM_HB_MOTTLE+'f'+ASM_HB_FLOAT+'/'+ASM_HB_FLOATL+'o'+ASM_HB_SOFT+'g'+ASM_HB_GRAIN+'n'+ASM_HB_SNAP+'p'+ASM_HB_PBRK:''):''}
  if((z==='jacket'||z==='waistcoat')&&asmCmRoute(i,z).how==='tweed'&&!asmSuitTweed(i))return '/ttweed';   // an own pattern named tweed
  if((z!=='jacket'&&z!=='waistcoat')||typeof asmSuitWeave!=='function'||!asmSuitTwill(i))return '';
  const w=asmSuitWeave(i);return w==='herringbone'?'/hb'+ASM_HB_MM+'-'+ASM_HB_AMP+'-'+ASM_HB_RIB+'-'+ASM_HB_FLECK+'-'+ASM_HB_YARN+'-'+ASM_HB_BREAK+'s'+ASM_HB_THIN+'m'+ASM_HB_MOTTLE+'f'+ASM_HB_FLOAT+'/'+ASM_HB_FLOATL+'o'+ASM_HB_SOFT+'g'+ASM_HB_GRAIN+'n'+ASM_HB_SNAP+'p'+ASM_HB_PBRK:patBase(i.pattern)!=='twill'?'/tw':''};
/* which painter paints a garment (2026-11-13, the owner's rule: every pattern Claude can tag is either painted or says why not): the one
   place asmCmJob, the item sheet, Settings' "Painted plain" list, the pre-build's report and tests/asmroute.test.js all ask.
   -> {how, gap, why}: how 'flat' (a plain colour), 'bands' (a jacket's read stripes or checks), 'twill', 'herringbone', 'tweed',
   'tile' (a drawing of its reading or pattern: shirts, read trousers), 'tie' (the tie painter's reading) or 'plain' (a pattern painted
   as its colour); gap '' (painted as it is), 'reading' (painted once its pattern is read: "Read pattern from photo") or 'painter' (no
   painter for it yet); why says so in words */
const ASM_NO_PAINTER={jacket:['other'],trousers:['other'],tie:[]};   // "other" on a jacket or trousers names no cloth to paint (Claude reads only stripes and checks there)
function asmCmRoute(i,z){if(!i)return {how:'flat',gap:'',why:''};const s=typeof usableSett==='function'?usableSett(i):null,b=patBase(i.pattern)||'solid',pn=(typeof patName==='function'?patName(i.pattern):b).toLowerCase();
  const w=typeof asmSuitWeave==='function'?asmSuitWeave(i):'',canRead=typeof readable==='function'?readable(i.type,i.pattern,i.weave):false;
  const plain=(gap,why)=>({how:'plain',gap,why}),needs=()=>plain('reading',`its ${pn} is painted once its pattern is read (Read pattern from photo)`);
  if(z==='belt')return {how:'flat',gap:'',why:''};
  if(z==='jacket'||z==='waistcoat'||z==='trousers'){
    if(z!=='trousers'&&asmSuitBands(i))return {how:'bands',gap:'',why:''};
    // a suit's own trousers (its jacket taken off on Today, 2026-11-13): the jacket's cloth, so a pinstripe or check reads as on the jacket
    if(z==='trousers'&&i.type==='suit'&&asmSuitBands(i))return {how:'bands',gap:'',why:''};
    if(z==='trousers'&&s&&s.bands)return {how:'tile',gap:'',why:''};
    if(w&&!(s&&s.bands))return {how:w,gap:'',why:''};
    if(b==='tweed'||(/^own/.test(i.pattern||'')&&/tweed/i.test(i.pattern)))return {how:'tweed',gap:'',why:''};
    const mk=typeof asmMicroKind==='function'?asmMicroKind(i):'';if(mk&&!(s&&s.bands))return {how:mk,gap:'',why:''};   // houndstooth, sharkskin, birdseye, nailhead
    if(b==='solid')return {how:'flat',gap:'',why:''};
    if([...STRIPE_PATS,...CHECK_PATS].includes(b))return needs();
    return plain('painter',`no painter for ${pn} ${z==='trousers'?'trousers':'jackets'} yet`)}
  if(z==='shirt'){if(b==='solid'&&!s)return {how:'flat',gap:'',why:''};
    return s?{how:'tile',gap:'',why:''}:{how:'tile',gap:canRead?'reading':'',why:canRead?`its ${pn} is a generic drawing until its pattern is read (Read pattern from photo)`:''}}
  if(z==='tie'){if(s&&(s.bands||s.motif||s.tex))return {how:'tie',gap:'',why:''};if(b==='solid')return {how:'flat',gap:'',why:''};
    if(canRead)return needs();
    if(b==='knit'||b==='paisley')return {how:b,gap:'',why:''};
    return plain('painter',`no painter for ${pn} ties yet`)}
  return {how:'flat',gap:'',why:''}}
/* the garments in rotation whose pattern the colour-coded painter paints plain or generic (Settings, the pre-build's report) */
const ASM_CM_ZONE={suit:'jacket',blazer:'jacket',pants:'trousers',shirt:'shirt',tie:'tie'};
const asmCmGaps=()=>items.filter(i=>ASM_CM_ZONE[i.type]&&inRotation(i)&&!dressOut(i.type)).map(i=>({i,r:asmCmRoute(i,ASM_CM_ZONE[i.type])})).filter(x=>x.r.gap);
/* trousers painted with the suit cloth (a suit's own trousers, or a twill, tweed or small woven figure) are drawn at the shirt master's
   own scale since 2026-11-13 (they were at the jacket master's, about 1.5 times too large): marked in only those looks' keys */
const asmCmTrSc=(z,i)=>{if(z!=='trousers')return '';const h=asmCmRoute(i,z).how;return h==='bands'||h==='twill'||h==='herringbone'||h==='tweed'||ASM_MICRO[h]?'/sc/lg'+ASM_LEGV:h==='tile'?'/lg'+ASM_LEGV:''};   // (/lg: the lines follow the legs, asmLegsPrep)
const ASM_LEGV=1;
function asmCmSig(o){const k=asmCmKind(o);if(!k)return '';const it=asmCmItems(o,k),s=[k,'p'+ASM_CM_PAINTV];
  for(const z of Object.keys(it).sort()){const i=it[z];s.push(z+':'+colOf(i)+'/'+(i.pattern||'')+'/'+(typeof usableSett==='function'?settSig(usableSett(i)):'')+(i.patternSpec?'/ps'+fnv64(JSON.stringify([i.patternSpec.across,i.patternSpec.along])).slice(0,6):'')+(i.material?'/'+i.material:'')+asmCmWeaveTag(z,i)+asmCmTrSc(z,i)+asmCmTieTag(z,i))}
  if(o.clip&&k!=='vest'&&typeof asmBarSig==='function')s.push('bar:'+asmBarSig(o.clip));
  const bg=renders[asmCmBgKey()];if(bg)s.push('bg:'+bg.t+'/'+ASM_CM_BG_SHADOW);
  return s.join('|')}
const ASM_CM_JACKET=new Set(['suit','vest','suit-open','vest-open']);
const asmCmItems=(o,k)=>{const z={shirt:o.shirt};if(ASM_CM_JACKET.has(k)){z.jacket=o.top;if(k==='vest'||k==='vest-open')z.waistcoat=o.top}else{z.trousers=o.bot;z.belt=o.belt}if(o.tie&&ASM_CM_KINDS[k].zones.includes('tie'))z.tie=o.tie;return z};
const asmCmOutKey=o=>asmKey('out/cm'+ASM_CMV+'/'+fnv64(asmCmSig(o)));
const asmCmStamp=o=>{const k=asmCmKind(o);return k?asmCmAssets(k).reduce((t,key)=>Math.max(t,renders[key]&&renders[key].t||0),0):0};
/* bring the kind's master, masks and parts onto the device (true when all are here); the background too, when the worker has one */
async function asmCmGet(kind){const keys=asmCmAssets(kind);if(!keys.length)return false;if(!await asmGet(keys[0],true))return false;
  await asmCmBgGet();return (await Promise.all(keys.slice(1).map(k=>asmGet(k)))).every(Boolean)}
/* the background behind every master (2026-11-13, the owner's choice: a blurred office the colour of his earlier masters, made with
   ChatGPT as an empty room and its desk carried further left so its end hides behind the trousers on the shirt masters): one picture on
   the worker (`npm run cm-upload -- --bg <file>`), shared by the four masters; without it the wall is the flat ASM_CM_WALL as before.
   It goes in each look's key (its record's date), so a new background paints every look again. */
const asmCmBgKey=()=>asmCmKey('all','background');
async function asmCmBgGet(){const k=asmCmBgKey();if(!renders[k])await asmGet(k);return !!renders[k]}
const ASM_CM_BG_SHADOW=.22;   // the figure's soft shadow on the wall behind (moved down and right, blurred wide), at most this much darker

/* ---- page side: the job (what the picture needs, as plain data the worker can take) ---- */
const ASM_CM_SOFT={top:.3,bot:.3,shirt:.45};   // a swatch drawing's contrast on full-size cloth (toward its ground): jackets and trousers 30%, shirts 45%
/* one repeat of the app's drawing of an item (fabricDef), in linear light, softened toward its ground (each channel's median), and how
   many mm one repeat is on the cloth -> {t, TW, TH, mm} or null */
async function asmCmTile(i,role){const s=usableSett(i),pat=patBase(i.pattern)||'solid';if(pat==='solid'&&!s)return null;
  const def=fabricDef('cmt',i,role).replace(/ patternTransform="[^"]*"/,'').replace(/<path [^>]*stroke="#fff"[^>]*\/>/g,''),num=a=>+((def.match(new RegExp(' '+a+'="([\\d.]+)"'))||[])[1]||0),w=num('width'),h=num('height');
  if(!w||!h)return null;const TW=128,TH=Math.max(4,Math.min(512,Math.round(TW*h/w))),L=ASM_LIN;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${3*TW}" height="${3*TH}" viewBox="0 0 ${3*w} ${3*h}"><defs>${def}</defs><rect width="${3*w}" height="${3*h}" fill="url(#cmt)"/></svg>`;
  const im=await asmImg('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),cv=document.createElement('canvas');cv.width=3*TW;cv.height=3*TH;
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,3*TW,3*TH);const d=x.getImageData(TW,TH,TW,TH).data,t=new Float32Array(3*TW*TH);
  for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)t[3*k+q]=L[d[4*k+q]];
  // a woven shirt (dobby, basket, herringbone…: asmWeave's tile) keeps the earlier painter's rules, which the owner chose on 2026-11-12:
  // the drawing's full swing (texTones' 2.5..7 L*, not softened again: at 45% his white woven diamond was 3 L*, invisible), its
  // repeat measured from the close-up (asmTexMm) or a herringbone's count, and 3x3 points a pixel when painted (fine)
  const wv=role==='shirt'&&typeof asmWeave==='function'?asmWeave(i):null,fine=!!(wv&&wv.f==='tile');
  const kk=fine?1:ASM_CM_SOFT[role]??1;if(kk!==1){const g=[0,1,2].map(q=>{const v=[];for(let k=0;k<TW*TH;k++)v.push(t[3*k+q]);v.sort((a,b)=>a-b);return v[v.length>>1]});for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)t[3*k+q]=g[q]+kk*(t[3*k+q]-g[q])}
  // a repeat's size: the reading's count across (a jacket or shirt about 550 mm), a weave's own rules, else the drawing's (200 units across)
  let mm=0;if(s&&s.tex)mm=pat==='herringbone'?(s.tr&&s.tr<80?ASM_SHIRT_MM/s.tr:12):3;else if(s&&s.motif)mm=Math.max(ASM_TEX_MIN_MM,2*ASM_CLOSEUP_MM/Math.max(1,+s.cr||20));else if(s&&+s.tr)mm=ASM_SHIRT_MM/s.tr;else mm=w*ASM_SHIRT_MM/200;
  if(fine)mm=wv.hb?wv.mm:await asmTexMm(i);
  return {t,TW,TH,mm,fine}}
/* ties with no reading that the reader can't read (2026-11-13, the routing test's last gaps): a knit tie's stitches (rows of small V
   loops, ASM_KNIT_ACROSS columns across the blade) and a paisley (teardrops in the second colour, a third colour inside, on the tie's
   colour; ASM_PAISLEY_ACROSS repeats across). Each is a tile of the tie's linear colour, as the tie painter takes */
const ASM_KNIT_ACROSS=14,ASM_PAISLEY_ACROSS=2.6;
function asmKnitTile(i){const L=ASM_LIN,h=String(colOf(i)).replace('#',''),c=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),TW=24,TH=20,t=new Float32Array(3*TW*TH),b=new Float32Array(TW*TH);let m=0;
  for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){const u=(x+.5)/TW,v=(y+.5)/TH,hx=u<.5?u/.5:(1-u)/.5,ph=((v+.45*hx)%1+1)%1;   // each half a loop leaning in: a V
    const val=.55+.6*Math.sin(Math.PI*hx)*Math.pow(Math.sin(Math.PI*ph),.7);b[y*TW+x]=val;m+=val}
  m/=TW*TH;for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)t[3*k+q]=c[q]*b[k]/m;
  return {c:t,TW,TH,motif:false,across:ASM_KNIT_ACROSS,ang:0}}
async function asmPaisleyTile(i){const T=128,cv=document.createElement('canvas');cv.width=cv.height=T;const x=cv.getContext('2d',{willReadFrequently:true});
  const g=colOf(i),rgb=[1,3,5].map(k=>parseInt(String(g).slice(k,k+2),16)||0),lum=.299*rgb[0]+.587*rgb[1]+.114*rgb[2],c2=COLORS[i.secondaryColor]||(lum<110?'#d9cdb4':'#3a2f45');
  const mixHex=(a,b,t)=>'#'+[1,3,5].map(k=>Math.round(parseInt(a.slice(k,k+2),16)*(1-t)+parseInt(b.slice(k,k+2),16)*t).toString(16).padStart(2,'0')).join(''),c3=COLORS[i.thirdColor]||mixHex(g,c2,.45);
  x.fillStyle=g;x.fillRect(0,0,T,T);
  // a teardrop: a round body with its tip curling to one side, a smaller drop of the third colour inside, and an eye
  const drop=(cx,cy,r,rot)=>{for(const [dx,dy] of [[0,0],[T,0],[-T,0],[0,T],[0,-T]]){x.save();x.translate(cx+dx,cy+dy);x.rotate(rot);
      const path=(s,oy)=>{const P=(a,b)=>[a*r*s,b*r*s+oy*r];x.beginPath();x.moveTo(...P(.7,-1.9));x.bezierCurveTo(...P(.9,-1),...P(1.1,.2),...P(.2,1));
        x.bezierCurveTo(...P(-.7,1.6),...P(-1.3,.3),...P(-.8,-.4));x.bezierCurveTo(...P(-.4,-1),...P(.3,-.9),...P(.7,-1.9));x.closePath()};
      x.fillStyle=c2;path(1,0);x.fill();x.fillStyle=c3;path(.55,.2);x.fill();x.fillStyle=c2;x.beginPath();x.arc(-.05*r,.35*r,.18*r,0,2*Math.PI);x.fill();
      x.restore()}};
  drop(.3*T,.32*T,.17*T,.5);drop(.78*T,.8*T,.17*T,.5+Math.PI);
  x.fillStyle=c2;for(const [px,py] of [[.75*T,.25*T],[.25*T,.78*T]]){x.beginPath();x.arc(px,py,.035*T,0,2*Math.PI);x.fill()}   // small dots between
  const d=x.getImageData(0,0,T,T).data,t=new Float32Array(3*T*T),L=ASM_LIN;for(let k=0;k<T*T;k++)for(let q=0;q<3;q++)t[3*k+q]=L[d[4*k+q]];
  return {c:t,TW:T,TH:T,motif:false,across:ASM_PAISLEY_ACROSS,ang:0}}
/* the job for asmCmBuild, or null when the kind's master or masks are not on the device */
async function asmCmJob(o){const kind=asmCmKind(o),K=ASM_CM_KINDS[kind];if(!K)return null;const keys=asmCmAssets(kind);if(keys.some(k=>!renders[k]))return null;
  const masks={};for(const z of K.zones)masks[z]=renders[asmCmKey(kind,'mask/'+z)].img;
  const parts={};for(const s of ['sleeveR','sleeveL','lapelR','lapelL']){const r=renders[asmCmKey(kind,'part/'+s)];if(r)parts[s]=r.img}
  const it=asmCmItems(o,kind),cloth={};
  for(const [z,i] of Object.entries(it)){if(!i)continue;const c={hex:colOf(i)},how=asmCmRoute(i,z).how;
    try{
      if(how==='tie'){const T=await asmTieFor(i);if(T&&T.c)c.tie={c:T.c,TW:T.TW,TH:T.TH,motif:T.motif,across:T.across,ang:T.ang}}
      else if(how==='bands')c.suit=await asmSuitTex(i);   // a jacket's read stripes or checks: the app's suit cloth
      else if(how==='twill'||how==='herringbone')c.suit=asmTwillTex(i);   // the weave's ribs (jacket or trousers)
      else if(how==='tweed')c.suit=asmTweedTex(i);
      else if(ASM_MICRO[how])c.suit=asmMicroTex(i,how);   // houndstooth, sharkskin, birdseye, nailhead
      else if(how==='knit')c.tie=asmKnitTile(i);
      else if(how==='paisley')c.tie=await asmPaisleyTile(i);
      // a shirt, or read trousers: one repeat of the app's drawing; anything else is its colour (the swatch's drawing of a fine weave,
      // tiled over a whole jacket, was a field of dots and dashes: the owner's light grey twill)
      else if(how==='tile'){const T=await asmCmTile(i,z==='shirt'?'shirt':'bot');if(T)c.tile=T}
    }catch(e){console.warn('cloth',z,e)}
    cloth[z]=c}
  const bg=renders[asmCmBgKey()];
  return {cm:kind,size:self.ASM_CM_SIZE||ASM_SIZE,mk:keys[0],mt:renders[keys[0]].t,master:renders[keys[0]].img,masks,parts,cloth,bg:bg?bg.img:null,bgt:bg?bg.t:0,
    bar:o.clip&&kind!=='vest'?asmBarRgb(o.clip):null}}

/* ---- the pixel work (page or worker): the colour-free part once per master (asmCmPrep), then each outfit (asmCmBuild) ---- */
let asmCmMem=null;
const asmCmCanvas=(w,h)=>{if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c};
/* a float box blur, borders clamped (radius R) */
function asmCmBlur(src,S,R){const N=S*S,t=new Float32Array(N),o=new Float32Array(N),cl=v=>v<0?0:v>S-1?S-1:v;
  for(let y=0;y<S;y++){const r0=y*S;let s=0;for(let x=-R;x<=R;x++)s+=src[r0+cl(x)];for(let x=0;x<S;x++){t[r0+x]=s;s+=src[r0+cl(x+R+1)]-src[r0+cl(x-R)]}}
  for(let x=0;x<S;x++){let s=0;for(let y=-R;y<=R;y++)s+=t[cl(y)*S+x];for(let y=0;y<S;y++){o[y*S+x]=s;s+=t[cl(y+R+1)*S+x]-t[cl(y-R)*S+x]}}return o}
/* the colour-free part of a master: its pixels, the zones' shares (0-255, adding up to 255), each painted zone's light (its clean
   pixels' own, pushed out over its edge so no zone's light reaches into another), the kept zones' colours along their edges, the
   jacket's (or shirt's) sleeves and lapels, the tie's knot and lean, the shirt's cuffs */
async function asmCmPrep(job){const S=job.size,N=S*S,K=ASM_CM_KINDS[job.cm],L=ASM_LIN;
  const M=(await asmData(job.master,S)).data,Y=new Float32Array(N);for(let k=0;k<N;k++){const j=4*k;Y[k]=.2126*L[M[j]]+.7152*L[M[j+1]]+.0722*L[M[j+2]]}
  const names=K.zones.filter(z=>job.masks[z]),A={};for(const z of names){const d=(await asmData(job.masks[z],S)).data,a=new Uint8Array(N);for(let k=0;k<N;k++)a[k]=d[4*k];A[z]=a}
  for(let k=0;k<N;k++){let s=0;for(const z of names)s+=A[z][k];if(s&&s!==255){let left=255;for(let q=0;q<names.length;q++){const z=names[q],v=q===names.length-1?left:Math.round(A[z][k]*255/s);A[z][k]=Math.max(0,Math.min(left,v));left-=A[z][k]}}}
  asmCmHandEdge(A,M,S,N);
  const CLEAN=248,KEEP=new Set(['skin','watch','buckle','dark']);
  // a zone's value at every pixel: its clean pixels' own, pushed out over the edge band (a normalised blur, widening)
  const pushOut=(a,val)=>{const clean=new Float32Array(N),num=new Float32Array(N),out=new Float32Array(N),done=new Uint8Array(N);
    for(let k=0;k<N;k++)if(a[k]>=CLEAN){clean[k]=1;num[k]=val[k];out[k]=val[k];done[k]=1}
    for(const R0 of [3,8,20]){const R=Math.max(1,Math.round(R0*S/2880)),bn=asmCmBlur(num,S,R),bd=asmCmBlur(clean,S,R);for(let k=0;k<N;k++)if(!done[k]&&a[k]&&bd[k]>0){out[k]=bn[k]/bd[k];done[k]=1}}
    for(let k=0;k<N;k++)if(!done[k]&&a[k])out[k]=val[k];return out};
  // a garment's colour is its colour where the cloth is lit: light = the pixel's brightness over the zone's lit level (75th
  // percentile, a white shirt's 90th), at most 1.6 (a shirt 1.15); against the median half of every garment came out too light
  const pct=(a,p)=>{const v=[];for(let k=0;k<N;k+=7)if(a[k]>=CLEAN)v.push(Y[k]);v.sort((x,y)=>x-y);return v.length?v[Math.min(v.length-1,Math.floor(v.length*p))]:1};
  const shade={},keep={};
  for(const z of names){const a=A[z];
    if(KEEP.has(z)){const idx=[];for(let k=0;k<N;k++)if(a[k]&&a[k]<CLEAN)idx.push(k);const I=Int32Array.from(idx),C=new Float32Array(3*I.length);
      for(let q=0;q<3;q++){const v=new Float32Array(N);for(let k=0;k<N;k++)v[k]=L[M[4*k+q]];const o=pushOut(a,v);for(let i=0;i<I.length;i++)C[3*i+q]=o[I[i]]}
      keep[z]={I,C};continue}   // (the edge pixels in order: looked up by binary search, a map over every pixel was 33 MB a zone at 2880)
    const sh=z==='shirt',ref=pct(a,sh?.9:.75)||1,cap=sh?1.15:1.6,v=new Float32Array(N);for(let k=0;k<N;k++)v[k]=Math.min(cap,Y[k]/ref);
    const o=pushOut(a,v),u=new Uint16Array(N);for(let k=0;k<N;k++)u[k]=Math.round(Math.max(0,o[k])*40000);shade[z]=u}
  const P={kind:job.cm,S,N,M,A,names,shade,keep,geo:null,tieGeo:null,cuff:null,cuffAng:[0],pxmm:ASM_PX_MM*S/ASM_SIZE*K.pxmm,bgShadow:null};
  // the figure's shadow on the wall behind (for a background picture): everything but the wall, moved down and to the right and blurred
  // wide (three box blurs ~ a gaussian); 0..255
  if(A.background){const f=S/2048,dx=Math.round(34*f),dy=Math.round(20*f),R=Math.max(2,Math.round(50*f));let g=new Float32Array(N);
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){const sx=x-dx,sy=y-dy;g[y*S+x]=sx>=0&&sy>=0?1-A.background[sy*S+sx]/255:0}
    for(let i=0;i<3;i++){const b=asmCmBlur(g,S,R),d=(2*R+1)*(2*R+1);for(let k=0;k<N;k++)g[k]=b[k]/d}
    const u=new Uint8Array(N);for(let k=0;k<N;k++)u[k]=Math.round(Math.min(1,g[k])*255);P.bgShadow=u}
  // the sleeves and lapels: the jacket's (or on the shirt masters the shirt's; its body stays upright, the body's flow is a jacket's)
  const GAR=A.jacket?'jacket':A.shirt?'shirt':null,sm=[],lm=[];
  for(const s of ['sleeveR','sleeveL'])if(job.parts[s]){const d=(await asmData(job.parts[s],S)).data,m=new Uint8Array(N);for(let k=0;k<N;k++)m[k]=d[4*k]>127?1:0;sm.push(m)}
  for(const s of ['lapelR','lapelL'])if(job.parts[s]&&GAR==='jacket'){const d=(await asmData(job.parts[s],S)).data,m=new Uint8Array(N);for(let k=0;k<N;k++)m[k]=d[4*k]>127?1:0;lm.push({m,one:true})}
  if(GAR&&sm.length===2){const zj=new Uint8Array(N);for(let k=0;k<N;k++)zj[k]=A[GAR][k]>127?1:0;
    const sg=asmSleeveSegs([...sm,...lm],S,N);asmCmRefit(sg,sm,S,N);
    // the learned drift along sleeves (ASM_SLEEVE_FLOW) was fitted to the earlier master's arms: here it folds a hanging arm's stripes
    // back on themselves, so it is left out; tubes, the crease, cylinders and the forearm's scale stay
    for(const g of sg.segs)if(g.parts)for(const pp of g.parts)if(pp.fd){const n=pp.fd.D.length;pp.fd={D:new Float32Array(n),G:new Float32Array(n),k:pp.fd.k}}
    // the soft edge outside a part takes the part beside it, and so does the garment's rim against the wall (within ASM_CM_RIM): the SAM
    // sleeve outlines stop up to ~20 px short of the jacket zone's outer edge, and that stepped strip was painted as body cloth (the
    // body's stripes running upright along each sleeve's outer edge)
    const RR=Math.max(2,Math.round(ASM_CM_RIM*S/2048));let wall=null;
    if(A.background){const w=new Float32Array(N);for(let k=0;k<N;k++)w[k]=A.background[k]>127?1:0;wall=asmCmBlur(w,S,RR)}
    const seg=sg.seg;let todo=[];for(let k=0;k<N;k++)if(!seg[k]&&A[GAR][k]&&(!zj[k]||(wall&&wall[k]>0)))todo.push(k);
    for(let it=0;it<Math.max(8,RR+2)&&todo.length;it++){const set=[],left=[];for(const k of todo){const x=k%S,v=(x>0&&seg[k-1])||(x<S-1&&seg[k+1])||(k>=S&&seg[k-S])||seg[k+S]||0;if(v)set.push(k,v);else left.push(k)}for(let q=0;q<set.length;q+=2)seg[set[q]]=set[q+1];todo=left}
    P.geo={seg,segs:sg.segs,flow:GAR==='jacket'?asmBodyFlow(zj,sm,S,S):null,gar:GAR}}
  // the trousers on the shirt masters: their lines follow the legs (asmLegsPrep), as a jacket's follow its sleeves and body
  if(A.trousers&&P.shade.trousers)P.legs=asmLegsPrep(A,P.shade.trousers,S,N);
  // the tie (asmTiePrep's rules): the knot, the blade's lean and width
  if(A.tie){const wid=new Int32Array(S);let y0=S,y1=0;for(let k=0;k<N;k++)if(A.tie[k]>127){const y=(k/S)|0;wid[y]++;if(y<y0)y0=y;if(y>y1)y1=y}
    // the knot is searched in the tie's top 30%, but no lower than 1.5 of its widest row below its top: on the shirt-and-tie master the
    // tie is long and the hand grips it at 30%, where the narrowest row (taken for the knot's end) put a turned stripe down to the hand
    if(y1>y0){let mw=0;for(let y=y0;y<=y1;y++)mw=Math.max(mw,wid[y]);const top=y0+Math.round(Math.min((y1-y0)*.3,1.5*mw));
      // the knot's end is its neck: the narrowest row from a third of the widest row's width below the top (past the knot's own taper)
      // to there (the widest row of that stretch can be the blade, which widens on down; the neck was then put on the blade)
      let yk=-1;for(let y=y0+Math.round(.3*mw);y<top;y++)if(wid[y]&&(yk<0||wid[y]<wid[yk]))yk=y;if(yk<0)yk=y0;
      const gap=Math.round(S/50);let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0,bw=0;for(let k=0;k<N;k++){if(A.tie[k]<=127)continue;const x=k%S,y=(k-x)/S;if(y<=yk+gap)continue;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y}
      for(let y=yk+gap;y<=y1;y++)bw=Math.max(bw,wid[y]);let lean=0;if(n){const mx=sx/n,my=sy/n;lean=.5*Math.atan2(2*(sxy/n-mx*my),(sxx/n-mx*mx)-(syy/n-my*my))-Math.PI/2;while(lean>Math.PI/2)lean-=Math.PI;while(lean<-Math.PI/2)lean+=Math.PI}
      P.tieGeo={yk,lean,bw:bw||S/10}}}
  // the shirt's cuffs on the jacket masters: the shirt's connected parts, the biggest the front (upright); in a cuff the weave's width
  // runs along the band's long axis, so its threads run along the arm (asmShirtAngles' rule)
  if(GAR==='jacket'&&A.shirt){const lab=new Uint8Array(N).fill(255),comps=[];
    for(let s0=0;s0<N;s0++){if(lab[s0]!==255||A.shirt[s0]<=127||comps.length>=250)continue;const id=comps.length,st=[s0];lab[s0]=id;let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
      while(st.length){const k=st.pop(),x=k%S,y=(k-x)/S;n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;for(const q of [k-1,k+1,k-S,k+S])if(q>=0&&q<N&&lab[q]===255&&A.shirt[q]>127&&Math.abs((q%S)-x)<=1){lab[q]=id;st.push(q)}}
      const mx=sx/n,my=sy/n;comps.push({n,th:.5*Math.atan2(2*(sxy/n-mx*my),(sxx/n-mx*mx)-(syy/n-my*my))})}
    const front=comps.reduce((b,c,i)=>c.n>comps[b].n?i:b,0),min=2000*N/(2880*2880);P.cuff=lab;P.cuffAng=comps.map((c,i)=>i===front||c.n<min?0:c.th)}
  return P}
/* The elbow fit (asmSleeveSegs) was tuned on the earlier master's arms; here it put the forearm across the chest 24° off. A creased
   sleeve whose forearm a fit from its own mask turns by over 15° is fitted again: the upper arm from its top 40%, the forearm from its
   bottom 35%, each pixel to the nearer line (8 rounds), each line through the middles of the cloth across it, the forearm's direction
   the one in which it is narrowest; the crease, widths and cylinders rebuilt as the app builds them. */
function asmCmRefit(sg,sm,S,N){const nrm=v=>{const l=Math.hypot(v[0],v[1])||1;return [v[0]/l,v[1]/l]};
  const pca=pts=>{let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;for(const [x,y] of pts){n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y}
    const mx=sx/n,my=sy/n,cxx=sxx/n-mx*mx,cyy=syy/n-my*my,cxy=sxy/n-mx*my,th=.5*Math.atan2(2*cxy,cxx-cyy),tr=cxx+cyy,det=cxx*cyy-cxy*cxy,lmin=tr/2-Math.sqrt(Math.max(0,tr*tr/4-det));
    return {x:mx,y:my,dx:Math.cos(th),dy:Math.sin(th),r:Math.sqrt(3*Math.max(0,lmin))}};
  const prof=(L,P,dx,dy)=>{const tu=P.map(p=>[(p[0]-L.x)*dx+(p[1]-L.y)*dy,(p[0]-L.x)*-dy+(p[1]-L.y)*dx]);let t0=Infinity,t1=-Infinity;for(const [t] of tu){if(t<t0)t0=t;if(t>t1)t1=t}
    const NB=20,lo=new Float32Array(NB).fill(Infinity),hi=new Float32Array(NB).fill(-Infinity);for(const [t,u] of tu){const i=Math.min(NB-1,Math.floor((t-t0)/(t1-t0+1e-6)*NB));if(u<lo[i])lo[i]=u;if(u>hi[i])hi[i]=u}return {t0,t1,NB,lo,hi}};
  const mid=(L,P)=>{for(let r=0;r<3;r++){const nx=-L.dy,ny=L.dx,{t0,t1,NB,lo,hi}=prof(L,P,L.dx,L.dy);let n=0,sa=0,sc=0,saa=0,sac=0;
      for(let i=3;i<NB-3;i++){if(!(hi[i]>lo[i]))continue;const a=t0+(i+.5)*(t1-t0)/NB,c=(lo[i]+hi[i])/2;n++;sa+=a;sc+=c;saa+=a*a;sac+=a*c}
      if(n<4)break;const sl=(n*sac-sa*sc)/Math.max(1e-6,n*saa-sa*sa),c0=(sc-sl*sa)/n,d=nrm([L.dx+sl*nx,L.dy+sl*ny]);L={...L,x:L.x+c0*nx,y:L.y+c0*ny,dx:d[0],dy:d[1]}}return L};
  const narrow=(L,P)=>{let best=null;for(let dg=-35;dg<=35;dg++){const th=Math.atan2(L.dy,L.dx)+dg*Math.PI/180,dx=Math.cos(th),dy=Math.sin(th),{NB,lo,hi}=prof(L,P,dx,dy);
      let w=0,n=0;for(let i=4;i<NB-4;i++)if(hi[i]>lo[i]){w+=hi[i]-lo[i];n++}if(n&&(!best||w/n<best.w))best={w:w/n,dx,dy}}return best?{...L,dx:best.dx,dy:best.dy}:L};
  for(let si=1;si<sg.segs.length;si++){const g=sg.segs[si];if(!g.crease)continue;const mf=sm[si-1];if(!mf)continue;
    const pts=[];let y0=S,y1=0;for(let k=0;k<N;k+=3)if(mf[k]){const x=k%S,y=(k-x)/S;pts.push([x,y]);if(y<y0)y0=y;if(y>y1)y1=y}
    const up=pts.filter(p=>p[1]<y0+.4*(y1-y0)),dn0=pts.filter(p=>p[1]>y1-.35*(y1-y0));if(up.length<50||dn0.length<50)continue;
    let U=pca(up),Lo=pca(dn0);const d=(L,p)=>Math.abs((p[0]-L.x)*L.dy-(p[1]-L.y)*L.dx);
    for(let it=0;it<8;it++){const a=[],b=[];for(const p of pts)(d(U,p)<=d(Lo,p)?a:b).push(p);if(a.length<50||b.length<50)break;U=pca(a);Lo=pca(b)}
    {const a=[],b=[];for(const p of pts)(d(U,p)<=d(Lo,p)?a:b).push(p);U=mid(U,a);Lo=narrow(mid(narrow(Lo,b),b),b)}
    const old=g.parts[1];if(Math.acos(Math.min(1,Math.abs(old.dx*Lo.dx+old.dy*Lo.dy)))*180/Math.PI<15)continue;
    const dn=U.dx*Lo.dy-U.dy*Lo.dx;if(Math.abs(dn)<.2)continue;const t0=((Lo.x-U.x)*Lo.dy-(Lo.y-U.y)*Lo.dx)/dn,E=[U.x+U.dx*t0,U.y+U.dy*t0];
    const S0=pts.reduce((m,p)=>p[1]<m[1]?p:m),near=pts.filter(p=>d(Lo,p)<Lo.r);if(!near.length)continue;const C0=near.reduce((m,p)=>Math.hypot(p[0]-E[0],p[1]-E[1])>Math.hypot(m[0]-E[0],m[1]-E[1])?p:m);
    let ud=[U.dx,U.dy],ld=[Lo.dx,Lo.dy];if((E[0]-S0[0])*ud[0]+(E[1]-S0[1])*ud[1]<0)ud=[-ud[0],-ud[1]];if((C0[0]-E[0])*ld[0]+(C0[1]-E[1])*ld[1]<0)ld=[-ld[0],-ld[1]];
    const cb=ud[0]*ld[0]+ud[1]*ld[1],nU=nrm([cb*ud[0]-ld[0],cb*ud[1]-ld[1]]),nL=nrm([ud[0]-cb*ld[0],ud[1]-cb*ld[1]]);
    const b1=nU[0]*U.x+nU[1]*U.y-U.r,b2=nL[0]*Lo.x+nL[1]*Lo.y-Lo.r,dd=nU[0]*nL[1]-nU[1]*nL[0],Kc=Math.abs(dd)>.2?[(b1*nL[1]-b2*nU[1])/dd,(nU[0]*b2-nL[0]*b1)/dd]:E;
    const q=nrm([nU[0]-ld[0],nU[1]-ld[1]]);let mv=[-q[1],q[0]];if(mv[0]*(C0[0]-Kc[0])+mv[1]*(C0[1]-Kc[1])<0)mv=[-mv[0],-mv[1]];
    sg.segs[si]=asmSleeveFlow(asmTubeTabs({crease:{x:Kc[0],y:Kc[1],mx:mv[0],my:mv[1],r0:U.r,r1:Lo.r},parts:[{x:U.x,y:U.y,dx:ud[0],dy:ud[1],nx:nU[0],ny:nU[1]},{x:Lo.x,y:Lo.y,dx:ld[0],dy:ld[1],nx:nL[0],ny:nL[1]}]},mf,S,N))}}
/* a tile in repeats (u, v; bilinear, wrapping), rotated by ang -> [r,g,b] linear */
/* The trousers' lines (2026-11-13, the owner: "apply the line tracing we have for the jackets to the pants"; their stripes ran dead straight
   and even across both legs and read as printed on): the jacket's rules carried over to a pair of trousers on a shirt master.
   - two panels meeting at the fly; below the crotch each leg is a cylinder about its own middle (the crease), above it the hips are one
     cylinder about the fly, blended over ASM_LEG_BLEND px either side of the crotch; as on a sleeve (asmTubeAt) a point x from the middle
     is R·asin(x/R) of cloth from it, R = ASM_LEG_K × half the width, so the lines close up where the cloth turns away at the sides and
     stay parallel to the crease (a tapering leg loses lines at its edges, as cut cloth does)
   - an outer edge with the hand right beside it is not the cloth's edge: filled in from the rows above and below; every row's edges, the
     fly and the crotch are smoothed over ASM_LEG_SMOOTH px
   - the lines bend with the folds: the cloth's large-scale light (the master's shading on the trousers, blurred) moves each point along its
     slope, ASM_LEG_FOLD px² per unit of relative slope, at most ASM_LEG_FOLD_MAX px (as the atlas trial bent a jacket's)
   All sizes are px at 2048. -> {y0,y1,xf,co,R,du,dv} (per row: the fly; per row and side: the cylinder's middle from the fly and radius;
   per pixel: the fold's shift in 1/16 px) */
const ASM_LEG_K=1.15,ASM_LEG_BLEND=140,ASM_LEG_SMOOTH=40,ASM_LEG_FOLD=150,ASM_LEG_FOLD_MAX=4,ASM_LEG_HAND=5;
function asmLegsPrep(A,SH,S,N){const T=A.trousers,ls=S/2048,on=k=>T[k]>127,sk=A.skin,minRun=Math.max(3,Math.round(6*ls));
  const nan=()=>new Float32Array(S).fill(NaN),OL=nan(),OR=nan(),GA=nan(),GB=nan(),OKL=new Uint8Array(S),OKR=new Uint8Array(S);let y0=-1,y1=-1;
  for(let y=0;y<S;y++){const runs=[];let a=-1;for(let x=0;x<=S;x++){const v=x<S&&on(y*S+x);if(v&&a<0)a=x;else if(!v&&a>=0){if(x-a>=minRun)runs.push([a,x-1]);a=-1}}
    if(!runs.length)continue;if(y0<0)y0=y;y1=y;const l=runs[0][0],r=runs[runs.length-1][1];OL[y]=l;OR[y]=r;
    // the hand beside the outer edge: not the cloth's edge
    const H=Math.round(ASM_LEG_HAND*ls),skin=x=>x>=0&&x<S&&sk&&sk[y*S+x]>127;let hl=false,hr=false;for(let d=1;d<=H;d++){if(skin(l-d))hl=true;if(skin(r+d))hr=true}
    OKL[y]=hl?0:1;OKR[y]=hr?0:1;
    // the gap between the legs: the widest gap between runs whose middle lies in the middle half of the trousers
    let best=0;for(let i=1;i<runs.length;i++){const ga=runs[i-1][1]+1,gb=runs[i][0]-1,m=(ga+gb)/2;if(m<l+(r-l)*.25||m>l+(r-l)*.75)continue;if(gb-ga+1>best){best=gb-ga+1;GA[y]=ga;GB[y]=gb}}}
  if(y0<0)return null;
  // the crotch: the first row from which the legs stay apart for a while
  const run=Math.round(12*ls);let yc=S;for(let y=y0;y<=y1-run&&yc===S;y++){let all=true;for(let d=0;d<run;d++)if(isNaN(GA[y+d])){all=false;break}if(all)yc=y}
  // fill what is missing or hidden (linear between the nearest good rows) and smooth over ASM_LEG_SMOOTH rows
  const fill=(V,ok,a,b)=>{let last=-1;for(let y=a;y<=b;y++){if(!isNaN(V[y])&&(!ok||ok[y])){if(last<0)for(let z=a;z<y;z++)V[z]=V[y];else for(let z=last+1;z<y;z++)V[z]=V[last]+(V[y]-V[last])*(z-last)/(y-last);last=y}}
      if(last<0)return false;for(let z=last+1;z<=b;z++)V[z]=V[last];return true};
  const smooth=(V,a,b)=>{const R=Math.max(1,Math.round(ASM_LEG_SMOOTH*ls/2)),o=new Float32Array(V);for(let y=a;y<=b;y++){let s=0,n=0;for(let d=-R;d<=R;d++){const z=Math.min(b,Math.max(a,y+d));s+=V[z];n++}o[y]=s/n}for(let y=a;y<=b;y++)V[y]=o[y]};
  fill(OL,OKL,y0,y1);fill(OR,OKR,y0,y1);smooth(OL,y0,y1);smooth(OR,y0,y1);
  const legs=yc<y1;if(legs){fill(GA,null,yc,y1);fill(GB,null,yc,y1);smooth(GA,yc,y1);smooth(GB,yc,y1)}
  // the fly: the gap's middle below the crotch; above it, that middle moved by half the trousers' own drift sideways
  const mid=y=>(OL[y]+OR[y])/2,xf=new Float32Array(S),yr=legs?Math.min(y1,yc+Math.round(20*ls)):y1,gc=legs?(GA[yr]+GB[yr])/2:mid(yr);
  for(let y=y0;y<=y1;y++)xf[y]=legs&&y>=yc?(GA[y]+GB[y])/2:gc+(mid(y)-mid(Math.min(yr,y1)))*.5;smooth(xf,y0,y1);
  // each row's two cylinders: the hips' (about the fly) blended into each leg's (about its middle) around the crotch
  const co=new Float32Array(2*S),Rr=new Float32Array(2*S),B=ASM_LEG_BLEND*ls,ss=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
  for(let y=y0;y<=y1;y++){const w=legs?ss((y-(yc-B))/(2*B)):0,yl=legs?Math.max(yc,y):y;
    for(let s=0;s<2;s++){const out=s?OR[y]:OL[y],hp=Math.max(4,Math.abs(out-xf[y]));
      let lc=0,lh=hp;if(legs){const inn=s?GB[yl]:GA[yl],o2=s?OR[yl]:OL[yl],c=(inn+o2)/2;lc=Math.abs(c-xf[y]);lh=Math.max(4,Math.abs(o2-inn)/2)}
      co[2*y+s]=w*lc;Rr[2*y+s]=ASM_LEG_K*((1-w)*hp+w*lh)}}
  // the folds: the trousers' light, blurred (only their own pixels), its slope over the mean moves the cloth
  const F=new Float32Array(N),W=new Float32Array(N);let ms=0,mn=0;for(let k=0;k<N;k++)if(T[k]>200){F[k]=SH[k]/40000;W[k]=1;ms+=F[k];mn++}
  const r=Math.max(2,Math.round(6*ls));let Fb=asmCmBlur(F,S,r),Wb=asmCmBlur(W,S,r);Fb=asmCmBlur(Fb,S,r);Wb=asmCmBlur(Wb,S,r);
  const mean=mn?ms/mn:1,K=ASM_LEG_FOLD*ls/Math.max(.05,mean),MX=ASM_LEG_FOLD_MAX*ls,du=new Int16Array(N),dv=new Int16Array(N),at=k=>Wb[k]>1e-6?Fb[k]/Wb[k]:mean;
  for(let k=0;k<N;k++){if(!T[k])continue;const x=k%S,y=(k-x)/S;if(x<1||x>S-2||y<1||y>S-2)continue;
    const gx=(at(k+1)-at(k-1))/2,gy=(at(k+S)-at(k-S))/2,cl=v=>v<-MX?-MX:v>MX?MX:v;du[k]=Math.round(16*cl(-K*gx));dv[k]=Math.round(16*cl(-K*gy))}
  return {y0,y1,yc,xf,co,R:Rr,du,dv}}
/* a trousers pixel's [across, along]: across is cloth from the fly (left of it negative), along the row, both moved with the folds */
function asmLegsAt(G,X,Y,k){const y=Math.max(G.y0,Math.min(G.y1,Math.floor(Y))),xf=G.xf[y],s=X<xf?0:1,t=Math.abs(X-xf),co=G.co[2*y+s],R=G.R[2*y+s],Q=.95,q=(t-co)/R;
  const u=q>Q?co+R*(Math.asin(Q)+(q-Q)/Math.sqrt(1-Q*Q)):q<-Q?co+R*(-Math.asin(Q)+(q+Q)/Math.sqrt(1-Q*Q)):co+R*Math.asin(q);
  return [(s?u:-u)+(k!=null?G.du[k]/16:0),Y+(k!=null?G.dv[k]/16:0)]}
function asmCmAt(T,u,v,o){const x=(u-Math.floor(u))*T.TW-.5,y=(v-Math.floor(v))*T.TH-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,c=T.t||T.c,TW=T.TW,TH=T.TH;
  const ix0=(x0+TW)%TW,ix1=(x0+1+TW)%TW,iy0=(y0+TH)%TH,iy1=(y0+1+TH)%TH;
  for(let q=0;q<3;q++)o[q]+=(c[3*(iy0*TW+ix0)+q]*(1-fx)+c[3*(iy0*TW+ix1)+q]*fx)*(1-fy)+(c[3*(iy1*TW+ix0)+q]*(1-fx)+c[3*(iy1*TW+ix1)+q]*fx)*fy}
/* the picture: the master with every garment painted, at the job's size, then at 2048 as a JPEG data URL */
/* the masters' colour-free parts are kept: one on a phone (2048: about 80 MB each), all four on the computer's pre-build (2880),
   where looks of several masters come one after another and each part took about 10 s to work out again */
/* (the computer's pre-build, job.diskCache) a master's colour-free part is also saved in this browser's IndexedDB, so a restart reads it
   back in a few seconds instead of working it out again (about 15 s a master at 2880). Its key carries the source of the functions that
   make it, so a change to how it is worked out never reads an old one; a master's older parts are deleted when a new one is saved. */
const asmCmHash=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(36)};
let asmCmSrc=null;
const asmCmSrcSig=()=>asmCmSrc||(asmCmSrc=asmCmHash([asmCmPrep,asmLegsPrep,asmCmRefit,asmSleeveSegs,asmTubeTabs,asmSleeveFlow,asmBodyFlow,asmData].map(String).join('|')));
function asmCmDb(){return new Promise((ok,no)=>{const q=indexedDB.open('dw-asm-prep',1);q.onupgradeneeded=()=>q.result.createObjectStore('p');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function asmCmDiskGet(k){try{const db=await asmCmDb();return await new Promise(ok=>{const q=db.transaction('p').objectStore('p').get(k);q.onsuccess=()=>{ok(q.result||null);db.close()};q.onerror=()=>{ok(null);db.close()}})}catch{return null}}
async function asmCmDiskPut(k,P,prefix){try{const db=await asmCmDb();await new Promise(ok=>{const t=db.transaction('p','readwrite'),st=t.objectStore('p');
    const q=st.getAllKeys();q.onsuccess=()=>{for(const x of q.result||[])if(String(x).startsWith(prefix)&&x!==k)st.delete(x);st.put(P,k)};t.oncomplete=()=>{db.close();ok()};t.onerror=t.onabort=()=>{db.close();ok()}})}catch(e){console.warn('could not save the master',e)}}
/* a master's colour-free part, packed for keeping: its large arrays (the zones' shares and light, the sleeves' cells…) side by side and
   gzipped (80 MB -> about 5 MB: mostly zeros and smooth light), the rest as it is; the master's own pixels (M) are left out and decoded
   again from its photo (about 0.2 s). -> {meta, gz} or null (no CompressionStream: nothing is kept) */
const ASM_CM_PACKV=1,ASM_CM_BIG=65536;
async function asmCmPack(P){if(typeof CompressionStream==='undefined')return null;
  try{const bufs=[];let n=0;
    const walk=x=>{if(ArrayBuffer.isView(x)){if(x.byteLength<ASM_CM_BIG)return x;const off=n;n+=(x.byteLength+7)&~7;bufs.push([off,x]);return {__b:[x.constructor.name,off,x.length]}}
      if(Array.isArray(x))return x.map(walk);if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype){const o={};for(const [k,v] of Object.entries(x))o[k]=walk(v);return o}return x};
    const meta=walk({...P,M:null}),all=new Uint8Array(n);for(const [off,x] of bufs)all.set(new Uint8Array(x.buffer,x.byteOffset,x.byteLength),off);
    const gz=await new Response(new Blob([all]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();return {meta,gz,n}}
  catch(e){console.warn('could not pack the master',e);return null}}
async function asmCmUnpack(rec,job){if(!rec||!rec.meta||!rec.gz||typeof DecompressionStream==='undefined')return null;
  try{const buf=await new Response(new Blob([rec.gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(buf.byteLength!==rec.n)return null;
    const T={Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,Uint8ClampedArray};
    const back=x=>{if(x&&x.__b){const [t,off,len]=x.__b;return new T[t](buf,off,len)}if(Array.isArray(x))return x.map(back);
      if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype){const o={};for(const [k,v] of Object.entries(x))o[k]=back(v);return o}return x};
    const P=back(rec.meta);P.M=(await asmData(job.master,job.size)).data;return P}
  catch(e){console.warn('could not read the kept master',e);return null}}
async function asmCmBuild(job){const key=job.cm+'|'+job.mk+'|'+job.mt+'|'+job.size,keep=job.size>ASM_SIZE?4:1;
  if(!asmCmMem||!asmCmMem.list)asmCmMem={list:[]};let hit=asmCmMem.list.find(e=>e.key===key);
  if(!hit){while(asmCmMem.list.length>=keep)asmCmMem.list.shift();const dk=job.cm+'|v'+ASM_CMV+'|'+asmCmSrcSig()+'|z'+ASM_CM_PACKV+'|'+key;
    // (2026-11-13) on every device, phones included: kept packed (asmCmPack, about 5 MB a master); a phone used to work it out again at
    // every start and every change of master (about 23 s at phone speed); read back it is about 0.6 s
    const disk=job.diskCache!==false&&typeof indexedDB!=='undefined';let P=disk?await asmCmUnpack(await asmCmDiskGet(dk),job):null;
    if(!P){P=await asmCmPrep(job);if(disk)asmCmPack(P).then(x=>x&&asmCmDiskPut(dk,x,job.cm+'|'))}   // saved while the picture is painted
    hit={key,P};asmCmMem.list.push(hit)}
  const P=hit.P,S=P.S,N=P.N,L=ASM_LIN,M=P.M,A=P.A,names=P.names,geo=P.geo,tg=P.tieGeo,ls=S/ASM_SIZE,o=new Uint8ClampedArray(4*N);
  // the background picture at this size (kept while the same picture and size come back)
  let BG=null;if(job.bg&&P.bgShadow){const bk=job.bgt+'|'+S;if(!asmCmMem.bg||asmCmMem.bg.k!==bk)asmCmMem.bg={k:bk,d:(await asmData(job.bg,S)).data};BG=asmCmMem.bg.d}
  const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},hexLin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
  const WALL=hexLin('#E6E2DC'),KEEP=new Set(['skin','watch','buckle','dark']),CLEAN=248;
  // the cloth look (ASM_CM_LOOK; job.look false leaves it out): per garment its lift and how much bolder its weave is drawn
  const LK=job.look===false?null:ASM_CM_LOOK,GARZ={jacket:1,waistcoat:1,shirt:1,trousers:1},lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2],lb=[0,0,0];let SUITTW=1;
  // the lighting (ASM_CM_LIGHT) on the jacket, waistcoat, shirt and tie; its master-only part kept with the master's setup
  const LI=ASM_CM_LIGHT,LZ={jacket:1,waistcoat:1,shirt:1,tie:1,trousers:1},LXP=LK?(hit.lx||(hit.lx=asmCmLightPrep(P))):null;
  const lxF=(z,k,x,y,e)=>{let f=1;const a=LXP.ao[z];if(a){let v=a[k];if(z==='jacket'&&LXP.aob&&geo&&!geo.seg[k])v=Math.max(v,LXP.aob[k]);f*=1-LI.ak*v}
    f*=1+LI.win*(e.look?LI.wd:1)*(1-2*x/S);
    if(z==='tie'&&LXP.tl&&LXP.tl[y]>=0){const w=LXP.tr[y]-LXP.tl[y];if(w>4){const t=(x-LXP.tl[y])/w;f*=1-LI.te*Math.pow(Math.abs(t-.5)*2,3)}}return f};
  const lxPost=(c,z,k,x,y,s)=>{let h=0;const sl=Math.min(s,1.3);if(z==='jacket'&&LXP.rim)h+=LI.rim*LXP.rim[k]*sl;
    if(z==='tie'&&LXP.tl&&LXP.tl[y]>=0){const w=LXP.tr[y]-LXP.tl[y];if(w>4){const u=((x-LXP.tl[y])/w-LI.tp)/LI.tsw;h+=LI.ts*tieK()*Math.exp(-u*u)*sl}}c[0]+=h;c[1]+=h;c[2]+=h;
    const d=Math.min(1,Math.max(0,1-s/.85)),l=Math.min(1,Math.max(0,(s-.95)/.5))*(1-x/S),y0=lum(c);
    c[0]*=1+LI.warm*d*.9-LI.cool*l*.5;c[1]*=1+LI.warm*d*.15;c[2]*=1-LI.warm*d*.9+LI.cool*l*1.2;const y1=lum(c);if(y1>0){const f=y0/y1;c[0]*=f;c[1]*=f;c[2]*=f}
    const h1=((Math.imul(k,2246822519)^Math.imul(k>>>7,3266489917))>>>0)/4294967296,h2=((Math.imul(k+977,2654435761)^(k>>>3))>>>0)/4294967296,g=1+LI.grain*(h1+h2-1);c[0]*=g;c[1]*=g;c[2]*=g};
  let TIEK=null;const tieK=()=>TIEK!=null?TIEK:(TIEK=asmTieSheenK(cl.tie&&cl.tie.flat?lum(cl.tie.flat):1));   // the tie's sheen follows its own brightness (asmTieSheenK)
  const lookOf=f=>{const mx=Math.max(f[0],f[1],f[2]),mn=Math.min(f[0],f[1],f[2]),sat=mx>0?(mx-mn)/mx:0,y=lum(f);
    return {lift:LK.ymin*(1-LK.chroma*Math.min(1,sat/.7)),boost:1+LK.dk*Math.max(0,1-y/LK.dy)}};
  const lookBase=(b,e)=>{lb[0]=b[0];lb[1]=b[1];lb[2]=b[2];const y=lum(lb);if(y<e.look.lift){const d=e.look.lift-y;lb[0]+=d;lb[1]+=d;lb[2]+=d}
    const m=Math.max(lb[0],lb[1],lb[2]);if(m>LK.cmax){const f=LK.cmax/m;lb[0]*=f;lb[1]*=f;lb[2]*=f}return lb};
  const lookAfter=(c,s,z,x,y,plain,tw,bo)=>{
    if(plain&&LK.grain&&z!=='shirt'){const u=x/ls,v=y/ls,h=((Math.imul(Math.floor((u+v)/2)|0,73856093)^Math.imul(Math.floor(v/3)|0,19349663))>>>0)%1024/512-1;
      tw=1+LK.grain*bo*(.6*Math.cos(2*Math.PI*(u+v)/4)+.5*h);c[0]*=tw;c[1]*=tw;c[2]*=tw}
    const t=Math.min(1,Math.max(0,(s-LK.s0)/(LK.s1-LK.s0))),sp=LK.sheen*t*t*(3-2*t)*(z==='shirt'?.25:1)*Math.max(0,1+LK.sk*(tw-1));c[0]+=sp;c[1]+=sp;c[2]+=sp;
    for(let q=0;q<3;q++){let v=c[q]<=0?0:Math.pow(c[q],1/2.2);v=v+LK.toe*Math.pow(1-v,3)-LK.sh*Math.pow(v,4);c[q]=Math.pow(Math.max(0,v),2.2)}};
  // a jacket pixel's [across, along] (px): a sleeve's tube, a lapel's own axis, the body's stripe flow, or upright
  let ZC='';   // the zone being painted: a trousers pixel follows the legs (asmLegsAt)
  const uvAt=(k,X,Yv)=>{if(ZC==='trousers'&&P.legs)return asmLegsAt(P.legs,X,Yv,k);if(!geo)return [X,Yv];const si=geo.seg[k],g=geo.segs[si];if(g&&g.parts)return asmTubeAt(g,X,Yv);
    if(si&&g&&g.cs!=null)return [(X-g.cx)*g.cs+(Yv-g.cy)*g.sn,(Yv-g.cy)*g.cs-(X-g.cx)*g.sn];return geo.flow&&geo.gar==='jacket'?asmFlowAt(geo.flow,X,Yv):[X,Yv]};
  const cl={};for(const [z,c] of Object.entries(job.cloth||{})){const e={flat:hexLin(c.hex)};
    if(c.suit)e.suit=c.suit;else if(c.tie&&tg){e.tie=c.tie;e.rep=(c.tie.motif?2:1)*tg.bw/Math.max(.5,c.tie.across||1.5);e.repv=e.rep*c.tie.TH/c.tie.TW}
    else if(c.tile){e.tile=c.tile;e.rep=c.tile.mm*P.pxmm;e.repv=e.rep*c.tile.TH/c.tile.TW}
    // a striped jacket is left as it was; a dark cloth takes the full look; a lighter one its folds' lighting only
    if(LK&&GARZ[z]){if(c.suit&&c.suit.k!=null)e.keep=1;else if(lum(e.flat)<LK.dark)e.look=lookOf(e.flat);else e.light=1}
    // trousers fill a large, evenly lit area on the shirt masters: the full look's bolder weave read as diagonal lines down each leg and
    // its sheen turned the window-side leg a blotchy grey beside a black one, so trousers of any colour take the folds' lighting only
    if(z==='trousers'&&e.look){delete e.look;e.light=1}cl[z]=e}
  const lin2=Object.values(cl).some(e=>e.suit&&e.suit.linen)?asmLinenTile():null,td2=Object.values(cl).some(e=>e.suit&&e.suit.tweed)?asmTweedTile():null,cm=[0,0,0],tmp=[0,0,0];
  // the app's suit cloth (asmSuitPaintTex) with this picture's coordinates and light
  // (a suit's cloth on a shirt master's trousers, 2026-11-13: that master is framed wider, so its cloth is drawn at the master's own scale)
  const lsc=ls*(ASM_CM_KINDS[job.cm]?ASM_CM_KINDS[job.cm].pxmm:1);
  const suitCol=(T,k,x,y,sh,out)=>{const rep=T.mm*ASM_PX_MM*lsc,repv=rep*T.TH/T.TW;cm[0]=cm[1]=cm[2]=0;
    for(let a=0;a<2;a++)for(let e=0;e<2;e++){const c=uvAt(k,x+(e+.5)/2,y+(a+.5)/2);asmCmAt(T,c[0]/rep,c[1]/repv,cm)}
    let tw=1;const C=T.cloth,hb=C&&(C.kind==='herringbone'||C.kind==='twill');
    if(T.k!=null){const c=uvAt(k,x+.5,y+.5),si=Math.floor(c[0]/rep-T.loff+.5),tt=c[1]/(T.blen*lsc),j0=Math.floor(tt),f0=tt-j0,fs=f0*f0*(3-2*f0),
        hh=j=>((Math.imul(si|0,374761393)^Math.imul(j|0,668265263))>>>0)%2048/1024-1,nz=Math.max(0,1+T.brk*(hh(j0)*(1-fs)+hh(j0+1)*fs));
      for(let q=0;q<3;q++)cm[q]=4*T.g[q]+(cm[q]-4*T.g[q])*T.k*nz;sh=T.gain*Math.pow(sh,T.gam)}
    if(T.linen&&lin2||T.tweed&&td2||hb){const c=uvAt(k,x+.5,y+.5);
      // a tweed (asmSuitPaintTex's rule): sampled upright in the picture, its flecks in the second colour
      if(T.tweed&&td2){const u=Math.floor(x/lsc),v=Math.floor(y/lsc),li=(((v%td2.T)+td2.T)%td2.T)*td2.T+(((u%td2.T)+td2.T)%td2.T);sh*=td2.r[li];
        if(T.c2&&td2.f[li])for(let q=0;q<3;q++)cm[q]=cm[q]*(1-T.fmix)+4*T.c2[q]*T.fmix}
      else if(T.linen&&lin2){const u=Math.floor(c[0]/lsc),v=Math.floor(c[1]/lsc);sh*=lin2.r[(((v%lin2.T)+lin2.T)%lin2.T)*lin2.T+(((u%lin2.T)+lin2.T)%lin2.T)]}
      else{const pitch=(C.pitch||4)*lsc,cw=C.cw?C.cw*lsc:0,off=C.off?C.off*lsc:0,col=C.kind==='herringbone'&&cw?Math.floor((c[0]-off)/cw):0,dir=col&1?-1:1,
          h=(Math.imul(Math.floor((c[0]+dir*c[1])/2)|0,73856093)^Math.imul(Math.floor(c[1]/3)|0,19349663))>>>0;
        // (asmSuitPaintTex's rules: a plain twill averages its rib over four points a pixel, its own fleck, and a two-colour twill's ribs lean toward its second colour)
        const bo=C.brk&&(col&1)?C.brk*pitch:C.pbrk?C.pbrk*pitch*Math.floor(col/2):0;   // the herringbone's break (ASM_HB_BREAK): without it the ribs met at each column edge and read as jagged V's
        let ph=0;if(C.ss){for(let a=0;a<2;a++)for(let e=0;e<2;e++){const s=uvAt(k,x+(e+.5)/2,y+(a+.5)/2);ph+=Math.cos(2*Math.PI*(s[1]+dir*s[0]+bo)/pitch)/4}}else ph=Math.cos(2*Math.PI*(c[1]+dir*c[0]+bo)/pitch);
        if(C.soft&&cw){const fx=(c[0]-off)/cw-col,de=Math.min(fx,1-fx)*cw,sw=C.soft*ls;if(de<sw){const nb=fx<.5?col-1:col+1,d2=nb&1?-1:1,b2=C.brk&&(nb&1)?C.brk*pitch:C.pbrk?C.pbrk*pitch*Math.floor(nb/2):0,w=.5-.5*de/sw;
          ph=ph*(1-w)+Math.cos(2*Math.PI*(c[1]+d2*c[0]+b2)/pitch)*w}}
        let yn=1;if(C.yarn){const r0=Math.floor((c[1]+dir*c[0]+bo)/pitch+.5),t=(c[1]-dir*c[0])/(pitch*1.7),s0=Math.floor(t),f=t-s0,fs=f*f*(3-2*f),hv=s=>((Math.imul(r0|0,2246822519)^Math.imul(s|0,3266489917)^Math.imul(col|0,668265263))>>>0)%1024/1024;
          yn=1-C.yarn/2+C.yarn*(hv(s0)*(1-fs)+hv(s0+1)*fs)}
        if(C.float){const r0=Math.floor((c[1]+dir*c[0]+bo)/pitch+.5),hf=((Math.imul(r0|0,374761393)^Math.imul(col|0,668265263))>>>0)%4096/4096,s=(c[1]-dir*c[0])/(pitch*C.floatL)+hf*7,f=s-Math.floor(s),sn=Math.sin(Math.PI*f);yn*=1-C.float+C.float*sn*sn}
        if(C.grain){const gs=.6*ASM_PX_MM*ls,gi=Math.floor(c[0]/gs),gj=Math.floor(c[1]/gs),gv=((Math.imul(gi|0,2654435761)^Math.imul(gj|0,2246822519))>>>0)%4096/4096;tw*=1;yn*=1-C.grain+2*C.grain*Math.pow(gv,1.6)}
        let mo=0;if(C.mottle){const vn=(u,v)=>{const i0=Math.floor(u),j0=Math.floor(v),fu=u-i0,fv=v-j0,su=fu*fu*(3-2*fu),sv=fv*fv*(3-2*fv),hh=(i,j)=>((Math.imul(i|0,1597334677)^Math.imul(j|0,3812015801))>>>0)%2048/1024-1;
          return (hh(i0,j0)*(1-su)+hh(i0+1,j0)*su)*(1-sv)+(hh(i0,j0+1)*(1-su)+hh(i0+1,j0+1)*su)*sv},m1=4*ASM_PX_MM*ls,m2=11*ASM_PX_MM*ls;mo=C.mottle*(.55*vn(c[0]/m1,c[1]/m1)+.45*vn(c[0]/m2+17.3,c[1]/m2+5.1))}
        const pr=C.thin?2*Math.pow((ph+1)/2,2)-.75:ph;
        tw=1+mo+C.amp*pr*yn+(C.fleck!=null?C.fleck:.08)*((h%1024)/512-1);if(C.c2){const m=C.mix*(1+ph)/2;for(let e=0;e<3;e++)cm[e]=cm[e]*(1-m)+4*C.c2[e]*m}}}
    // a small woven figure (asmMicroTex: houndstooth, sharkskin, birdseye, nailhead): its thread grid along the cloth (uvAt), 4x4 points
    // a pixel (the cloth's direction from the pixel's own and its neighbours' positions: three lookups, not sixteen)
    if(T.wv){const W=T.wv,tp=W.thr*ASM_PX_MM*lsc,p0=uvAt(k,x,y),px=uvAt(k,x+1,y),py=uvAt(k,x,y+1),N=W.N;let v=0;
      for(let a=0;a<4;a++)for(let e=0;e<4;e++){const fx=(e+.5)/4,fy=(a+.5)/4,u=p0[0]+(px[0]-p0[0])*fx+(py[0]-p0[0])*fy,w=p0[1]+(px[1]-p0[1])*fx+(py[1]-p0[1])*fy;
        const ix=Math.floor(u/tp),iy=Math.floor(w/tp);v+=W.g[(((iy%N)+N)%N)*N+(((ix%N)+N)%N)]}v/=16;
      tw*=1+W.amp*v;if(W.c2){const m=W.mix*(1-v)/2;for(let q=0;q<3;q++)cm[q]=cm[q]*(1-m)+4*W.c2[q]*m}}
    SUITTW=tw;const f=sh*Math.pow(Math.max(0,tw),2.2);out[0]=cm[0]/4*f;out[1]=cm[1]/4*f;out[2]=cm[2]/4*f};
  const rot=(X,Yv,th,e,out)=>{const c=Math.cos(th),s=Math.sin(th);out[0]=out[1]=out[2]=0;asmCmAt(e.tile||e.tie,(X*c+Yv*s)/e.rep,(Yv*c-X*s)/e.repv,out)};
  const c=[0,0,0];
  // each piece of the dark zone small enough to be a button (under 160 px across) is drawn as one: its centre and size from its mask
  let BL=null,BT=[];if(A.dark){BL=new Int32Array(N).fill(-1);const st=[];
    for(let s0=0;s0<N;s0++){if(A.dark[s0]<=96||BL[s0]>=0)continue;const id=BT.length;let n=0,sx=0,sy=0,x0=1e9,x1=-1,y0=1e9,y1=-1;st.push(s0);BL[s0]=id;
      while(st.length){const q=st.pop(),x=q%S,y=(q-x)/S;n++;sx+=x;sy+=y;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        for(const nb of [q-1,q+1,q-S,q+S])if(nb>=0&&nb<N&&BL[nb]<0&&A.dark[nb]>96&&Math.abs(nb%S-x)<=1){BL[nb]=id;st.push(nb)}}
      BT.push(n>20&&x1-x0<160&&y1-y0<160?{cx:sx/n,cy:sy/n,R:Math.max(x1-x0,y1-y0)/2+2}:null)}
    // the soft edge (alpha 1..96) belongs to the nearest piece within 3 px
    for(let k=0;k<N;k++)if(A.dark[k]&&BL[k]<0){const x=k%S;for(let r=1;r<=3&&BL[k]<0;r++)for(const nb of [k-r,k+r,k-r*S,k+r*S])if(nb>=0&&nb<N&&BL[nb]>=0&&Math.abs(nb%S-x)<=r){BL[k]=BL[nb];break}}}
  for(let k=0;k<N;k++){let r=0,g=0,b=0;const x=k%S,y=(k-x)/S,j=4*k;
    for(let zi=0;zi<names.length;zi++){const z=names[zi],a8=A[z][k];if(!a8)continue;const a=a8/255;ZC=z;
      // the background picture, its share of the pixel as it is (not the master's light: the master's wall was a flat colour whose
      // blotches showed through), darker by the figure's shadow, dithered a fraction of a level (an 8-bit picture enlarged bands)
      if(z==='background'&&BG){const s=1-ASM_CM_BG_SHADOW*P.bgShadow[k]/255,h=((Math.imul(k,2654435761)>>>0)%1024)/1024;
        for(let q=0;q<3;q++){const v=BG[j+q],lo=L[v],hi=L[v<255?v+1:255];c[q]=(lo+(hi-lo)*h)*s}r+=a*c[0];g+=a*c[1];b+=a*c[2];continue}
      if(KEEP.has(z)){const K=P.keep[z];let i=-1;if(a8<CLEAN){let lo=0,hi=K.I.length-1;while(lo<=hi){const m=(lo+hi)>>1,v=K.I[m];if(v===k){i=m;break}if(v<k)lo=m+1;else hi=m-1}}if(i<0){c[0]=L[M[j]];c[1]=L[M[j+1]];c[2]=L[M[j+2]]}else{c[0]=K.C[3*i];c[1]=K.C[3*i+1];c[2]=K.C[3*i+2]}
        if(z==='skin'&&c[2]>c[0]*.92)c[2]=c[0]*.92;   // skin is never bluer than red: its edge beside the button read purple (the button smudge)
        if(c[1]>Math.max(c[0],c[2]))c[1]=Math.max(c[0],c[2]);   // the chroma-green wall left in a kept zone's edge (a green line along a fingertip)
        // the dark zone is the jacket's button, half hidden between finger and thumb (2026-11-13: the owner saw a smudge): the master's
        // flat grey oval with a white dot and a purple rim against the fingertip. Each piece of the dark zone under 160 px across is drawn
        // as a horn button in the jacket's colour (centre and size from its mask, BL/BT): domed, a raised rim, four holes, the fingers' shadow
        const bt=z==='dark'&&BL&&BL[k]>=0?BT[BL[k]]:null;
        if(bt){const BT=bt,J=cl.jacket||cl.trousers,f=J&&J.flat?J.flat:[.02,.02,.02],Lf=Math.max(1e-4,.2126*f[0]+.7152*f[1]+.0722*f[2]);
          const dx=(x+.5-BT.cx)/BT.R,dy=(y+.5-BT.cy)/BT.R,d=Math.hypot(dx,dy);
          let L0=.016+.05*Math.pow(Math.max(0,1-Math.hypot(dx+.3,dy+.35)/.75),2);   // a dark horn button, domed: lighter toward the upper left
          if(d>.74&&d<.96)L0+=.03*(1-Math.abs(d-.85)/.11);                 // its raised rim
          for(const [hx,hy] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){const hd=Math.hypot(dx-hx,dy-hy);if(hd<.12)L0*=.15+.85*hd/.12}   // four thread holes
          const Lm=.2126*c[0]+.7152*c[1]+.0722*c[2],sh=Math.min(1,Math.max(.35,Lm/.02));   // the fingers' shadow on it, from the master
          for(let e=0;e<3;e++)c[e]=(f[e]/Lf*.6+.4)*L0*sh}
        r+=a*c[0];g+=a*c[1];b+=a*c[2];continue}
      let s=P.shade[z][k]/40000;const e=cl[z],lit=!!(LXP&&e&&!e.keep&&LZ[z]);let base;
      if(e&&e.light&&LXP.sm[z]){const sl=LXP.smb[z][k];if(sl>.01)s=LXP.sm[z]*Math.pow(sl/LXP.sm[z],LK.lgam)*(s/sl)}   // a lighter cloth: its large folds deeper
      if(lit)s*=lxF(z,k,x,y,e);
      if(e&&e.suit){SUITTW=1;suitCol(e.suit,k,x,y,s,c);
        if(e.look){const L=e.look,tw=1+L.boost*(SUITTW-1);if(L.boost>1){const f=Math.max(0,1+(L.boost-1)*2.2*(SUITTW-1));c[0]*=f;c[1]*=f;c[2]*=f}   // a dark cloth's weave, bolder than life
          const yy=lum(c),fl=L.lift*Math.pow(Math.min(s,1),LK.fp);if(yy<fl){const d=(fl-yy)*Math.max(0,1+LK.wk*(tw-1));c[0]+=d;c[1]+=d;c[2]+=d}
          lookAfter(c,s,z,x,y,false,tw,L.boost)}
        if(lit)lxPost(c,z,k,x,y,s);
        r+=a*c[0];g+=a*c[1];b+=a*c[2];continue}
      if(z==='background')base=WALL;else if(!e){base=tmp;tmp[0]=L[M[j]];tmp[1]=L[M[j+1]];tmp[2]=L[M[j+2]]}else if(!e.tile&&!e.tie)base=e.flat;
      else{base=tmp;tmp[0]=tmp[1]=tmp[2]=0;
        if(z==='tie'&&e.tie&&tg){const th=tg.lean+(e.tie.ang||0)+(y<tg.yk?Math.PI/2:0),cs=Math.cos(th),sn=Math.sin(th);
          for(let aa=0;aa<2;aa++)for(let ee=0;ee<2;ee++){const X=x+(ee+.5)/2,Yv=y+(aa+.5)/2;asmCmAt(e.tie,(X*cs+Yv*sn)/e.rep,(Yv*cs-X*sn)/e.repv,tmp)}tmp[0]/=4;tmp[1]/=4;tmp[2]/=4}
        else if(z==='jacket'||z==='waistcoat'||(z==='shirt'&&geo&&geo.gar==='shirt')){const n=e.tile.fine?3:2;for(let aa=0;aa<n;aa++)for(let ee=0;ee<n;ee++){const uv=uvAt(k,x+(ee+.5)/n,y+(aa+.5)/n);asmCmAt(e.tile,uv[0]/e.rep,uv[1]/e.repv,tmp)}tmp[0]/=n*n;tmp[1]/=n*n;tmp[2]/=n*n}
        else if(z==='shirt'&&e.tile.fine){const ci=P.cuff?P.cuff[k]:255,th=ci<255?P.cuffAng[ci]||0:0,cs=Math.cos(th),sn=Math.sin(th);   // a woven shirt: 3x3 points a pixel (a 3 mm weave is ~10 px; one point skipped its steps)
          for(let aa=0;aa<3;aa++)for(let ee=0;ee<3;ee++){const X=x+(ee+.5)/3,Yv=y+(aa+.5)/3;asmCmAt(e.tile,(X*cs+Yv*sn)/e.rep,(Yv*cs-X*sn)/e.repv,tmp)}tmp[0]/=9;tmp[1]/=9;tmp[2]/=9}
        else if(z==='shirt'&&P.cuff){const ci=P.cuff[k];rot(x+.5,y+.5,ci<255?P.cuffAng[ci]||0:0,e,tmp)}
        else if(z==='trousers'&&P.legs){for(let aa=0;aa<2;aa++)for(let ee=0;ee<2;ee++){const uv=uvAt(k,x+(ee+.5)/2,y+(aa+.5)/2);asmCmAt(e.tile,uv[0]/e.rep,uv[1]/e.repv,tmp)}tmp[0]/=4;tmp[1]/=4;tmp[2]/=4}   // read trousers: along the legs
        else asmCmAt(e.tile,(x+.5)/e.rep,(y+.5)/e.repv,tmp)}
      // above its usual brightness a cloth gains neutral light (a sheen), not more of its own colour
      const plain=!!e&&base===e.flat;if(e&&e.look)base=lookBase(base,e);
      if(s<=1){c[0]=base[0]*s;c[1]=base[1]*s;c[2]=base[2]*s}else{const yb=.2126*base[0]+.7152*base[1]+.0722*base[2];c[0]=base[0]+(s-1)*yb;c[1]=base[1]+(s-1)*yb;c[2]=base[2]+(s-1)*yb}
      if(e&&e.look)lookAfter(c,s,z,x,y,plain,1,e.look.boost);
      if(lit)lxPost(c,z,k,x,y,s);
      r+=a*c[0];g+=a*c[1];b+=a*c[2]}
    const m=Math.max(r,g,b);if(m>1){const w=Math.min(1,(m-1)/m);r=r/m+(1-r/m)*w;g=g/m+(1-g/m)*w;b=b/m+(1-b/m)*w}   // past full brightness: toward white, keeping the hue
    o[j]=gam(r);o[j+1]=gam(g);o[j+2]=gam(b);o[j+3]=255}
  if(LK&&cl.shirt&&A.shirt)asmCmButtons(o,P,cl.shirt.flat,L,gam);   // the shirt's buttons, drawn (ASM_CM_BTN)
  if(job.bar&&A.tie){const tm=new Uint8Array(N);for(let k=0;k<N;k++)tm[k]=A.tie[k]>127?1:0;asmBarDraw(o,tm,S,job.bar,null)}   // a tie clip, drawn as the earlier assembler draws it
  let img=new ImageData(o,S,S);
  if(S>ASM_SIZE){const big=asmCmCanvas(S,S);big.getContext('2d').putImageData(img,0,0);const sm=asmCmCanvas(ASM_SIZE,ASM_SIZE),x=sm.getContext('2d',{willReadFrequently:true});
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(big,0,0,ASM_SIZE,ASM_SIZE);img=x.getImageData(0,0,ASM_SIZE,ASM_SIZE)}
  return {url:await asmJpeg(img)}}

/* ---- Today: the colour-coded way of asmEnsure / asmPrebuildOne ---- */
/* a look the computer hasn't built: when this phone first saw it missing, and whether that is long enough ago to paint it here */
const ASM_PC_WAIT=10*60e3,asmCmMissing=new Map();
const asmCmLate=k=>{if(!asmCmMissing.has(k))asmCmMissing.set(k,Date.now());return Date.now()-asmCmMissing.get(k)>ASM_PC_WAIT};
async function asmCmEnsure(o,ahead){const kind=asmCmKind(o);if(!kind)return;if(asmFullWins(o)||asmFor(o))return;const bk='cm|'+comboKey(o);if(asmBusy.has(bk))return;asmBusy.add(bk);
  try{const k=asmOutKey(o),L=await asmListGet(),showIf=()=>{const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)asmShow()};
    // (2026-11-13) the computer's picture first, before any of the master's photos: it nearly always has it, and the master, its masks
    // and parts (2.8 MB, about 7 s on 4G) are only needed to paint here. The list says whether it has it; without a list, ask anyway
    if((!L||L.has(k))&&await asmGetPre(o,!!L)){showIf();return}
    // not built: while building ahead, left to the computer (it builds changed looks every few minutes) unless it hasn't for
    // ASM_PC_WAIT (the computer is off); the day on screen is painted here at once
    if(ahead&&L&&!asmCmLate(k))return;
    if(!await asmCmGet(kind)||asmFullWins(o))return;
    const img=await asmPhoto(o,!ahead);if(!img)return;
    const rec={img,stamp:asmStamp(o),t:Date.now()};asmOut[k]=rec;await metaPut('asm:out:'+k,rec);asmTrim();showIf()}
  catch(e){console.warn('could not paint',e)}finally{asmBusy.delete(bk)}}
async function asmCmPrebuild(o){const kind=asmCmKind(o);if(!kind||!await asmCmGet(kind))return null;
  const img=await asmPhoto(o,true);return img?{key:asmOutKey(o),sig:`asm/out/z${ASM_ZV}/${asmStamp(o)}`,img}:null}
/* Settings → Realistic photos → Item photos: the switch */
function asmCmUI(){const grp=$('#asm-group');if(!grp)return;let b=$('#cm-box');if(!b){b=document.createElement('div');b.id='cm-box';b.className='sgroup';grp.appendChild(b)}
  b.innerHTML=`<div class="slabel">Colour-coded masters</div><label class="srow">On this phone <select id="cfg-cm" onchange="asmCmSet(this.value)"><option value="on">On: every garment painted</option><option value="off">Off: as before</option></select></label>
    <div class="snote">Suit, waistcoat, shirt-and-tie and open-collar days are painted on their own master. A jacket worn without a tie keeps its own photo.</div>`;
  $('#cfg-cm').value=asmCmPref()?'on':'off';asmGapUI()}
/* "Painted plain": every garment in rotation whose pattern the pictures don't show yet, why, and one tap to read the readable ones
   (Claude, one call each: never by itself) */
let asmGapRun=null;
function asmGapUI(){const b=$('#cm-box');if(!b)return;let g=$('#cm-gaps');if(!g){g=document.createElement('div');g.id='cm-gaps';b.appendChild(g)}
  const gaps=asmCmGaps(),rd=gaps.filter(x=>x.r.gap==='reading');
  g.innerHTML=!gaps.length?'<div class="snote">Every patterned piece in rotation is painted with its pattern.</div>':
    `<div class="slabel">Painted plain (${gaps.length})</div><ul class="cmgaps">${gaps.map(x=>`<li><span class="${titleCls(x.i)}">${esc(sentence(itemTitle(x.i)))}</span>: <small class="mut">${esc(x.r.why)}</small></li>`).join('')}</ul>`+
    (asmGapRun?`<p class="mut"><small>Reading ${asmGapRun.done+1} of ${asmGapRun.n}…</small></p>`:rd.length?`<div class="btns"><button type="button" id="cm-readall" onclick="asmReadGaps()"${isConnected()?'':` disabled class="needconn" title="${NEED_CONN}"`}>Read ${rd.length} pattern${rd.length===1?'':'s'}</button></div><div class="snote">Claude reads each one from its photo and close-up (one call each).</div>`:'')}
async function asmReadGaps(){const list=asmCmGaps().filter(x=>x.r.gap==='reading').map(x=>x.i);if(!list.length||asmGapRun)return;asmGapRun={n:list.length,done:0};asmGapUI();
  try{for(const it of list){await rereadSett(it.id);asmGapRun.done++;asmGapUI()}}finally{asmGapRun=null;asmGapUI()}
  asmOut={};asmTried.clear();refreshToday()}
/* the item sheet's line when the pictures paint this piece plain or generic */
function asmGapNote(i){if(typeof ASM_ON!=='undefined'&&!ASM_ON)return '';const z=ASM_CM_ZONE[i.type];if(!z)return '';const r=asmCmRoute(i,z);
  return r.gap?`<p class="shelp asmgap">Outfit pictures: ${esc(r.why)}.</p>`:''}
function asmCmSet(v){try{if(v==='off')localStorage.setItem(ASM_CM,'0');else localStorage.removeItem(ASM_CM)}catch{}asmOut={};asmTried.clear();refreshToday()}
