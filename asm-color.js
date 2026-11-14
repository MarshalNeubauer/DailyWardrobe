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
   (Settings' switch to turn this off on a phone, localStorage asm_cm = '0', was removed 2026-11-13.) */
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
  ...(K.sleeves?['sleeveR','sleeveL'].map(s=>asmCmKey(kind,'part/'+s)):[]),...(K.lapels?['lapelR','lapelL'].map(s=>asmCmKey(kind,'part/'+s)):[]),...asmCmGeoKeys(kind),...asmCmLightKeys(kind)]};
/* (2026-11-14) the master's light map, part of it once the manifest lists it (a master without one is lit as before): one picture at the
   maps' size made on the computer from the master's surface normals. R: the form light (a window from the left on the body's own shape;
   128 = unchanged, (R-128)/255 added to 1), G: the glow where the cloth turns away from the camera, B: the collar leaves' shadow on the
   shirt and tie under them. asmCmPrep lays R into every cloth's light; asmCmLightPrep takes G into the jacket's lit edges and B into the
   shirt's and tie's contact shadows, so both painters (this one and asm-gl.js) take all three from the setup they already share */
const asmCmLightKeys=kind=>{const l=asmCmKey(kind,'light'),M=asmCmMfNow().keys;return M[l]?[l]:[]};
/* the master's solved cloth positions (asmGeoPrep), part of it once the manifest lists them (a master without them paints as before) */
const asmCmGeoKeys=kind=>{const u=asmCmKey(kind,'geo/u'),v=asmCmKey(kind,'geo/v'),M=asmCmMfNow().keys;return M[u]&&M[v]?[u,v]:[]};
const ASM_CM='asm_cm';   // localStorage: '0' = this phone puts pictures together the earlier way
const asmCmPref=()=>{try{return localStorage.getItem(ASM_CM)!=='0'}catch{return true}};
try{localStorage.removeItem(ASM_CM)}catch{}   // (its Settings switch is gone, 2026-11-13: a phone that had it off paints again; asmCmSet stays for the tests)
/* which master an outfit is painted on, or null (the earlier assembler, or the outfit's own photo) */
function asmCmKind(o){if(!o||!o.shirt||!asmCmPref())return null;
  if(o.top)return o.tie?(o.vest?'vest':'suit'):(o.vest?'vest-open':'suit-open');
  if(!o.bot||!o.belt)return null;   // the shirt masters show the trousers and the belt
  return o.tie?'shirt-tie':'shirt-open'}
/* the outfit's kind when its master is on this device (downloaded) */
const asmCmReady=o=>{const k=asmCmKind(o);return k&&renders[asmCmKey(k,'master')]?k:null};
/* the cloth of each garment, as it goes into the picture's key: a new colour, reading or drawing makes a new picture */
const ASM_CM_PAINTV=9;   // 2: jackets and trousers without a stripe or check reading are their colour; 3: a plain twill jacket has its ribs (asmTwillTex); 4: woven shirts at full swing, measured repeat, 3x3 points; 5: the sleeves reach the jacket's outer edge (ASM_CM_RIM); 6: the cloth look (#304, rolled back: its pictures are still on the worker under p6); 7: the cloth look and lighting as chosen (ASM_CM_LOOK, ASM_CM_LIGHT); 8: the same on trousers, the shirt's buttons drawn (ASM_CM_BTN), the tie's sheen dialled back (the owner: too glossy), the half-hidden button drawn as a button, no purple skin edge (the button smudge); 9: (2026-11-14 audit) the tie sheen, hand edge and trousers lighting shipped under 8 without a bump: repainted; since then the painter's code is hashed into every key (asmCmCodeSig), so a forgotten bump can't leave old pictures
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
const ASM_CM_LOOK={ymin:.012,fp:1.7,chroma:.55,wk:4,sk:5,cmax:.8,grain:.05,sheen:.024,s0:.45,s1:1.5,dy:.03,dk:2,toe:.025,sh:.06,dark:.035,lgam:1.3,lr:12};
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
// the button is the pearl mixed with the shirt's colour like paint (2026-11-13, the owner's pick from mockups: "sheet 2 at 55 percent"):
// ASM_CM_BTN_MIX of the shirt in display (sRGB) values, so it is darker as well as coloured and sits with the shirt; a first version kept the
// pearl's brightness and added 15% of the shirt's hue, which the owner found too light
const ASM_CM_BTN_PEARL=[.86,.84,.80],ASM_CM_BTN_MIX=.55,ASM_CM_BTNV=3;
const asmCmBtnCol=shirt=>{const g=v=>v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055,lg=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
  return ASM_CM_BTN_PEARL.map((v,q)=>lg(g(v)*(1-ASM_CM_BTN_MIX)+g(Math.max(0,Math.min(1,shirt[q])))*ASM_CM_BTN_MIX))};
function asmCmButtons(o,P,shirt,L,gam){const pts=ASM_CM_BTN[P.kind];if(!pts)return;const S=P.S,A=P.A,f=S/2048,lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2];
  // (2026-11-13, the owner: "buttons should be white, just tinted the main color"): every shirt's buttons are pearl white mixed with the
  // shirt's colour (asmCmBtnCol); on a coloured shirt they were the cloth's own colour, a little lighter
  const btn=asmCmBtnCol(shirt),hole=btn.map(v=>v*.35),thr=btn.map(v=>v*.82);
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
const ASM_CM_HAND_R=6,ASM_CM_CUFF_PX=70,ASM_CM_CUFF_STEP=7;
/* (2026-11-14, the owner's "looks terrible": a pinkish band down the tie's right edge and under the collar on the shirt-and-tie master)
   the skin mask has stray shares of 1-9 levels along the tie and the collar, where the master's white shirt picks up the pink tie's
   fringe; any skin share at all used to count as a hand within ASM_CM_HAND_R, so those warm shirt pixels went partly or wholly to skin, which
   keeps the master's own (pinkish grey) colour. Only skin that is most of a pixel (the hand, the neck: over half) is a hand now, and a
   skin share with no such skin within ASM_CM_HAND_STRAY px (at 2048) is a stray: it goes to the pixel's largest other zone. Beside the
   tie (within ASM_CM_HAND_R of it) a warm pixel whose blue is not below its green is the tie's pink fringe on the white shirt, not skin
   (skin runs red > green > blue): it goes to the shirt (the hand's top and bottom beside the tie) */
const ASM_CM_HAND_STRAY=24;
/* (2026-11-14, the owner: a grey-purple band under the wrist on the shirt-and-tie master) the white shirt in the hand's cast shadow is
   lit by the skin beside it, so it reads warm (red 20-35 above blue) and mid-grey (lightness 120-140): the in-between rule above gave it
   a fifth to a half of skin, which keeps the master's own mauve grey under any painted shirt. An in-between pixel darker than
   ASM_CM_HAND_LIT may now only lose skin to the shirt, never gain it from the shirt (the nail tips it was made for are bright) */
const ASM_CM_HAND_LIT=150;
function asmCmHandEdge(A,M,S,N){if(!A.skin||!A.shirt)return;const R=Math.max(2,Math.round(ASM_CM_HAND_R*S/2048)),sk=new Float32Array(N),sh=new Float32Array(N);
  for(let k=0;k<N;k++){sk[k]=A.skin[k]>127?1:0;sh[k]=A.shirt[k]?1:0}const nsk=asmCmBlur(sk,S,R),nsh=asmCmBlur(sh,S,R);
  let ntie=null;if(A.tie){const tm=new Float32Array(N);for(let k=0;k<N;k++)tm[k]=A.tie[k]>127?1:0;ntie=asmCmBlur(tm,S,R)}
  {const far=asmCmBlur(sk,S,Math.max(R+1,Math.round(ASM_CM_HAND_STRAY*S/2048))),own=new Set(['watch','buckle','dark']),zs=Object.keys(A).filter(z=>z!=='skin'),
      pz=zs.filter(z=>!own.has(z)),oz=zs.filter(z=>own.has(z));   // (a painted zone first: a kept one would show the master's own colour again)
    for(let k=0;k<N;k++){const a=A.skin[k];if(!a||far[k]>0)continue;let best=null;for(const z of pz)if(A[z][k]&&(!best||A[z][k]>A[best][k]))best=z;
      if(!best)for(const z of oz)if(A[z][k]&&(!best||A[z][k]>A[best][k]))best=z;if(best){A[best][k]+=a;A.skin[k]=0}}}
  // (2026-11-14, the lighting branch) the tie's own deep shadow against a hand (the master's dark magenta, far from any skin's hue) is tie,
  // not skin: kept as skin it showed as a dark red speck between the thumb and the jacket
  if(ntie)for(let k=0;k<N;k++){const a=A.skin[k];if(!a||!(ntie[k]>0))continue;const j=4*k,r=M[j],g=M[j+1],bl=M[j+2];if(g<.42*r&&bl>g*1.25&&r>40){A.tie[k]=Math.min(255,A.tie[k]+a);A.skin[k]=0}}
  // the inside of the cuff beside the watch: the watch zone is a hull round the watch and took in the cuff's shaded inner face, which then
  // stayed the master's white under any coloured cuff. From the shirt's edge, watch pixels are shirt as far as the master stays smooth and
  // near-neutral (no step of ASM_CM_CUFF_STEP levels: the bracelet's and case's edges stop it), at most ASM_CM_CUFF_PX away
  // (2026-11-14, shirt-open's top links) and cool (blue >= red - 6): the cuff's white is cool, the bracelet's steel warm grey (red 10-25
  // above blue); smooth near-neutral link faces next to the shirt were turned into shirt and painted in the shirt's colour
  if(A.watch){const lv=k=>(M[4*k]+M[4*k+1]+M[4*k+2])/3,neu=k=>Math.max(M[4*k],M[4*k+1],M[4*k+2])-Math.min(M[4*k],M[4*k+1],M[4*k+2])<28&&M[4*k+2]>=M[4*k]-6,D=new Int16Array(N).fill(-1),mx=Math.round(ASM_CM_CUFF_PX*S/2048);let q=[];
    for(let k=S;k<N-S;k++)if(A.watch[k]>127&&neu(k)&&(A.shirt[k-1]>127||A.shirt[k+1]>127||A.shirt[k-S]>127||A.shirt[k+S]>127)){D[k]=0;q.push(k)}
    for(let d=0;d<mx&&q.length;d++){const nx=[];for(const k of q){const x=k%S,l=lv(k);for(const n of [k-1,k+1,k-S,k+S])if(n>=0&&n<N&&D[n]<0&&A.watch[n]>127&&Math.abs(n%S-x)<=1&&neu(n)&&Math.abs(lv(n)-l)<ASM_CM_CUFF_STEP){D[n]=d+1;nx.push(n)}}q=nx}
    for(let k=0;k<N;k++)if(D[k]>=0){A.shirt[k]=Math.min(255,A.shirt[k]+A.watch[k]);A.watch[k]=0}}
  for(let k=0;k<N;k++){const a=A.skin[k],b=A.shirt[k];if(!(nsk[k]>0&&nsh[k]>0)||a+b<200)continue;   // only where both are near, and they make up the pixel
    const j=4*k,r=M[j],g=M[j+1],bl=M[j+2],warm=r-bl,lt=(r+g+bl)/3;let t;   // t: the share that is skin
    // (a pixel half skin, half white shirt is warm but paler: it gets a share of each, and its skin colour comes from the clean skin beside it)
    if(ntie&&ntie[k]>0&&bl>=g-4&&lt>120)t=0;else   // (the tie's pink fringe)
    if(warm>=52)t=1;else if(warm<=18&&lt>120)t=0;else if(lt<=120)continue;else{t=(warm-18)/34;if(lt<ASM_CM_HAND_LIT)t=Math.min(t,a/(a+b))}   // (in the hand's shade: never more skin than the mask)
    const tot=a+b,ns=Math.round(tot*t);A.skin[k]=ns;A.shirt[k]=tot-ns}}
/* the parts of the lighting that depend only on the master (its zones and shading): worked out once per master in a session */
/* (2026-11-14 audit) its large arrays are 16-bit (ao, aob, rim as shares of ASM_CM_U16; smb like the shading, over 40000): 112 MB of
   floats at 2048 -> 56 MB, and it is saved with the packed setup (P.lx) so a phone no longer works it out at every change of master
   (about 1.3 s on a computer, about 5 s on a phone); measured: the picture within one level of the float version */
const ASM_CM_U16=65535;
/* (2026-11-14) the folds' depth, fitted to real photographs (the owner's references: a navy pinstripe suit in a studio, a white shirt
   and tie outdoors): per zone [the median light over the lit level, the least and the greatest power]. Measured on the references: jacket
   p10 .43, median .74, p90 1.33; shirt p10 .67, median .91, p90 1.12. The bench is C:\code\watch-test\light (stats.js) */
const ASM_CM_FOLD={jacket:[.82,.44,.3],waistcoat:[.82,.44,.3],trousers:[.82,.44,.35]};   // (shirts and ties keep their folds: opened, a burgundy shirt lost its sleeves' shadows)   // [median, 10th percentile, least power] (set a little over the references': the contact shadows and the window's light come after)
/* with a light map the window's light is on the body's shape, and the old ramp across the whole picture keeps ASM_CM_WINK of its strength */
const ASM_CM_WINK=.8;
/* a weave shows by the light: its ribs' relief is strongest where the cloth is lit and fades in the folds' shade. A jacket's, waistcoat's
   or trousers' woven ribs (suitCol's SUITTW) are drawn at [least, per unit of light, most] of their strength */
const ASM_CM_WLIGHT=[.5,.6,1.15];
const asmCmWk=s=>{const W=ASM_CM_WLIGHT,k=W[0]+W[1]*s;return k<W[0]?W[0]:k>W[2]?W[2]:k};
const ASM_CM_FOLD_KEEP=.8;
/* how much of a zone's fold power and scale (P.fold) a cloth takes, by its own lightness (linear luminance): all of it at or below
   ASM_CM_FOLD_Y[0] (black, dark navy, a dark pinstripe's ground), none at or above ASM_CM_FOLD_Y[1] (charcoal, a slate tweed, a mid grey and anything lighter);
   asmCmMp: a garment's light = [the power below the lit level, the strength above it, a scale] from that and its material (asmCmMat) */
const ASM_CM_FOLD_Y=[.02,.05];
const ASM_CM_FOLD_MAX=.55;   // at most this much of the power and scale (in full, a navy pinstripe lost its darker far side)
const asmCmFoldW=y=>{const Y=ASM_CM_FOLD_Y,w=(Y[1]-y)/(Y[1]-Y[0]);return ASM_CM_FOLD_MAX*(w<0?0:w>1?1:w)};
function asmCmMp(P,z,c,lin){const f=P.fold&&P.fold[z==='waistcoat'?'jacket':z],m=Array.isArray(c.mat)?c.mat:[1,1],g=c.suit&&c.suit.g?c.suit.g:lin,w=f&&!(c.suit&&c.suit.k!=null)?asmCmFoldW(.2126*g[0]+.7152*g[1]+.0722*g[2]):0;   // (a striped jacket takes none: the owner, 2026-11-14, "no shadowing on the right side": its far side's shadow is its own steeper shading, ASM_STRIPE gam and gain, which stay)
  return [m[0]*(f?1+(f[0]-1)*w:1),m[1],f?Math.pow(f[1],w):1]}
/* (2026-11-14) the material's own light, [the power on a cloth's light below its lit level (over 1: crisper, deeper folds; under 1: softer),
   the strength of its light above the lit level (its highlights and sheen)]: linen creases sharply and is matt; tweed, flannel and
   melange are soft and matt; a worsted has a little sheen; chinos and denim are crisp and matt; an oxford or twill shirt is softer than
   poplin, a sateen shinier; a silk tie is crisp and shiny, a knitted, wool, grenadine or linen one soft and matt. Read from the item's
   material, pattern and description (few items have a material set, so the pattern's name counts) */
const ASM_CM_MAT={linen:[1.15,.8],soft:[.96,.6],worsted:[1,1.15],chino:[1.05,.7],oxford:[.95,.8],sateen:[1,1.3],poplin:[1,1],silk:[1.1,1.3],knit:[.9,.4]};
function asmCmMat(i,z){if(!i)return [1,1];const M=ASM_CM_MAT,t=((i.material||'')+' '+(typeof patName==='function'?patName(i.pattern):i.pattern||'')+' '+(i.patternText||'')).toLowerCase();
  if(z==='tie')return /knit|wool|grenadine|linen|cashmere/.test(t)?M.knit:M.silk;
  if(z==='shirt')return /linen/.test(t)?M.linen:/sateen|satin/.test(t)?M.sateen:/oxford|flannel|twill|chambray/.test(t)?M.oxford:M.poplin;
  if(/linen/.test(t))return M.linen;if(/tweed|flannel|melange|donegal|cashmere/.test(t))return M.soft;
  if(z==='trousers'&&(i.trouserKind||/cotton|chino|denim/.test(t)))return M.chino;return M.worsted}
/* a tie's sheen lies where the tie itself is lit (its knot's dimple and its folds shape it): none below ASM_TIE_LIT[0] of its lit level,
   full ASM_TIE_LIT[1] above that, at most ASM_TIE_LIT[2] (it was one even band down the blade) */
const ASM_TIE_LIT=[.7,.35,1.25];
const asmTieLit=s=>{const T=ASM_TIE_LIT,v=(s-T[0])/T[1];return v<0?0:v>T[2]?T[2]:v};
const ASM_CM_GLOW=.9,ASM_CM_COLLAR=1;   // the light map's glow (of the jacket's lit edge) and collar shadow (of a contact shadow), at full
function asmCmLightPrep(P){const {S,N,A,geo}=P,LI=ASM_CM_LIGHT,LK=ASM_CM_LOOK,sc=S/2048,X={sm:{},smb:{},ao:{},aob:null,rim:null,tl:null,tr:null};
  const q16=(f,s)=>{const u=new Uint16Array(N);for(let k=0;k<N;k++){const v=Math.round(f[k]*s);u[k]=v<0?0:v>65535?65535:v}return u};
  const dvn=(m,R)=>{let g=m;for(let i=0;i<2;i++){const b=asmCmBlur(g,S,R),d=(2*R+1)*(2*R+1),o=new Float32Array(N);for(let k=0;k<N;k++)o[k]=b[k]/d;g=o}return q16(g,ASM_CM_U16)};
  const shift=(m,dx,dy)=>{const o=new Float32Array(N);for(let y=0;y<S;y++){const yy=y-dy;if(yy<0||yy>=S)continue;for(let x=0;x<S;x++){const xx=x-dx;if(xx>=0&&xx<S)o[y*S+x]=m[yy*S+xx]}}return o};
  // a zone's mean light and its large folds (the shading smoothed, normalised by the zone's own coverage)
  for(const z of ['jacket','waistcoat','shirt','trousers']){const sh=P.shade[z];if(!sh||!A[z])continue;let t=0,n=0;for(let k=0;k<N;k+=3)if(A[z][k]>=248){t+=sh[k]/40000;n++}if(!n)continue;X.sm[z]=t/n;
    const R=Math.max(2,Math.round(LK.lr*sc)),v=new Float32Array(N),w=new Float32Array(N);for(let k=0;k<N;k++)if(A[z][k]>127){v[k]=sh[k]/40000;w[k]=1}
    let bv=asmCmBlur(v,S,R),bw=asmCmBlur(w,S,R);for(let k=0;k<N;k++)v[k]=bw[k]>0?bv[k]/bw[k]*w[k]:0;bv=asmCmBlur(v,S,R);bw=asmCmBlur(w,S,R);
    const o=new Float32Array(N);for(let k=0;k<N;k++)o[k]=bw[k]>0?bv[k]/bw[k]:0;X.smb[z]=q16(o,40000)}
  const OVER={shirt:['tie','waistcoat','jacket','skin'],waistcoat:['jacket','skin'],jacket:['skin'],tie:['skin'],trousers:['belt','buckle','skin']};
  const dx=Math.round(LI.adx*sc),dy=Math.round(LI.ady*sc),R=Math.max(2,Math.round(LI.ar*sc));
  for(const z in OVER){if(!A[z])continue;const m=new Float32Array(N);for(const o of OVER[z])if(A[o])for(let k=0;k<N;k++){const v=A[o][k]/255;if(v>m[k])m[k]=v}X.ao[z]=dvn(shift(m,dx,dy),R)}
  if(geo&&geo.gar==='jacket'&&A.jacket){const m=new Float32Array(N);for(let k=0;k<N;k++)if(geo.seg[k]&&A.jacket[k]>127)m[k]=1;if(A.skin)for(let k=0;k<N;k++){const v=A.skin[k]/255;if(v>m[k])m[k]=v}X.aob=dvn(shift(m,dx,dy),R)}
  if(A.jacket){const o=Math.max(2,Math.round(LI.rw*sc)),off=o*S+o,m=new Float32Array(N);
    for(let k=off;k<N;k++){if(A.jacket[k]<200)continue;const q=k-off,sg=geo?geo.seg[k]:0;if(A.jacket[q]<128||(geo&&sg&&geo.seg[q]!==sg&&A.jacket[q]>127))m[k]=1}
    X.rim=dvn(m,Math.max(1,Math.round(1.5*sc)))}
  // the light map (asmCmLightKeys): the glow where the jacket's cloth turns away (wool's soft lit edge) joins its lit edges, and the
  // collar leaves' shadow joins the shirt's and the tie's contact shadows
  const LM=P.lm;if(LM){if(X.rim&&A.jacket)for(let k=0;k<N;k++){if(A.jacket[k]<128)continue;const v=Math.round(ASM_CM_GLOW*LM[4*k+1]*257);if(v>X.rim[k])X.rim[k]=v}
    for(const z of ['shirt','tie'])if(X.ao[z]&&A[z])for(let k=0;k<N;k++){if(!A[z][k])continue;const v=Math.round(ASM_CM_COLLAR*LM[4*k+2]*257);if(v>X.ao[z][k])X.ao[z][k]=v>65535?65535:v}}
  if(A.tie){X.tl=new Int32Array(S).fill(-1);X.tr=new Int32Array(S).fill(-1);for(let y=0;y<S;y++)for(let x=0;x<S;x++)if(A.tie[y*S+x]>127){if(X.tl[y]<0)X.tl[y]=x;X.tr[y]=x}}
  return X}
const ASM_CM_RIM=24;   // px at 2048: how far from the wall a jacket (or shirt-master) pixel outside the SAM sleeve outline still joins the sleeve beside it
/* a jacket whose weave the 2026-11-13 audit added (a herringbone, or an own pattern based on solid named twill): marked in its look's key,
   so only those looks are painted again (a new ASM_CM_PAINTV would repaint every look) */
const asmCmWeaveTag=(z,i)=>{if(z==='shirt'&&asmHbShirt(i))return '/hbs'+ASM_HB_SHIRTV+'-'+ASM_HB_COL_LIFT+'-'+ASM_HB_SHIRT_Y;   // a herringbone shirt's columns and colour hold (asmHbShirtLook)
  const how=asmCmRoute(i,z).how;
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
function asmCmSig(o){const k=asmCmKind(o);if(!k)return '';const it=asmCmItems(o,k),s=[k,'p'+ASM_CM_PAINTV+'.'+asmCmCodeSig()],rev=asmCmRev(k);if(rev)s.push('mf:'+rev);   // the painter's code and the master's record dates (asmCmCode, asmCmRev)
  for(const z of Object.keys(it).sort()){const i=it[z];s.push(z+':'+colOf(i)+'/'+(i.pattern||'')+'/'+(typeof usableSett==='function'?settSig(usableSett(i)):'')+(i.patternSpec?'/ps'+fnv64(JSON.stringify([i.patternSpec.across,i.patternSpec.along])).slice(0,6):'')+(i.material?'/'+i.material:'')+asmCmWeaveTag(z,i)+asmCmTrSc(z,i)+asmCmTieTag(z,i)+asmCuTag(z,i)+asmCrTag(z,i))}
  if(o.clip&&k!=='vest'&&typeof asmBarSig==='function')s.push('bar:'+asmBarSig(o.clip));
  if(typeof asmWatchPaints==='function'&&asmWatchPaints(o.watch))s.push('watch:'+asmWatchSig(o.watch));   // another watch than the master's (asm-watch.js)
  if(ASM_CM_BTN[k])s.push('btn'+ASM_CM_BTNV);   // the masters whose shirt buttons are drawn: a new look of them paints those looks again
  const bg=renders[asmCmBgKey()];if(bg)s.push('bg:'+bg.t+'/'+ASM_CM_BG_SHADOW);
  return s.join('|')}
const ASM_CM_JACKET=new Set(['suit','vest','suit-open','vest-open']);
const asmCmItems=(o,k)=>{const z={shirt:o.shirt};if(ASM_CM_JACKET.has(k)){z.jacket=o.top;if(k==='vest'||k==='vest-open')z.waistcoat=o.top}else{z.trousers=o.bot;z.belt=o.belt}if(o.tie&&ASM_CM_KINDS[k].zones.includes('tie'))z.tie=o.tie;return z};
const asmCmOutKey=o=>asmKey('out/cm'+ASM_CMV+'/'+fnv64(asmCmSig(o)));
const asmCmStamp=o=>{const k=asmCmKind(o);return k?asmCmAssets(k).reduce((t,key)=>Math.max(t,renders[key]&&renders[key].t||0),0):0};
/* bring the kind's master, masks and parts onto the device (true when all are here); the background too, when the worker has one */
async function asmCmGet(kind){if(!asmCmAssets(kind).length)return false;await asmCmMfGet();const keys=asmCmAssets(kind);if(!renders[keys[0]])await asmCmMasterCopy(kind);if(!await asmGet(keys[0],true))return false;   // (keys after the manifest: it says whether the master has solved positions)
  await asmCmBgGet();const all=(await Promise.all(keys.slice(1).map(k=>asmGet(k)))).every(Boolean);if(all)await asmCmSetupFetch(asmCmBaseJob(kind));return all}
/* the background behind every master (2026-11-13, the owner's choice: a blurred office the colour of his earlier masters, made with
   ChatGPT as an empty room and its desk carried further left so its end hides behind the trousers on the shirt masters): one picture on
   the worker (`npm run cm-upload -- --bg <file>`), shared by the four masters; without it the wall is the flat ASM_CM_WALL as before.
   It goes in each look's key (its record's date), so a new background paints every look again. */
const asmCmBgKey=()=>asmCmKey('all','background');
async function asmCmBgGet(){const k=asmCmBgKey();if(!renders[k])await asmGet(k);return !!renders[k]}
const ASM_CM_BG_SHADOW=.22;   // the figure's soft shadow on the wall behind (moved down and right, blurred wide), at most this much darker
/* the masters' manifest (2026-11-14 audit: a master, mask or background uploaded again never reached a device that held it, since a
   photo is downloaded once and kept). `npm run cm-upload` writes one small record, asmCmMfKey(), signed 'asm/cm-manifest {"keys":
   {<key>: <record date>}}', listing every colour-coded record's date. A device reads it once per worker list (asmListGet: every
   ASM_LIST_MS while the app is open) or once a session without a list; a photo it holds that is older than the manifest says is
   dropped and downloaded again, and the dates of a master's records go into its looks' keys (asmCmRev), so the phones and the computer's
   pre-build agree on a look's key whatever copies they hold. Remembered in localStorage.asm_cm_mf, so a restart finds its kept pictures
   before the manifest is read again. No manifest on the worker: the keys are as before and nothing is dropped. */
const asmCmMfKey=()=>asmCmKey('all','manifest'),ASM_CM_MF='asm_cm_mf',ASM_CM_MF_RE=/^asm\/cm-manifest (\{.*\})$/;
let asmCmMf=null,asmCmMfAt=null,asmCmMfGetting=null,asmCmMfRetry=0;
const asmCmMfNow=()=>{if(!asmCmMf){try{asmCmMf=JSON.parse(localStorage.getItem(ASM_CM_MF)||'null')}catch{}if(!asmCmMf||typeof asmCmMf.keys!=='object')asmCmMf={keys:{}}}return asmCmMf};
/* the dates the manifest gives a kind's records (master, masks, parts) and the background, hashed: '' without a manifest */
const asmCmRev=kind=>{const M=asmCmMfNow().keys,ks=[...asmCmAssets(kind),asmCmBgKey()];return ks.some(k=>M[k])?asmCmHash(ks.map(k=>M[k]||0).join(',')):''};
/* read the manifest when the worker's list was read again since (or once a session without a list) and drop the photos it outdates;
   it never asks for the list itself (a list is a scarce request on the worker's plan). force: read it now (the computer's pre-build,
   once a cycle: one small read) */
function asmCmMfGet(force){if(asmCmMfGetting)return asmCmMfGetting;asmCmMfGetting=asmCmMfGet1(force).finally(()=>{asmCmMfGetting=null});return asmCmMfGetting}
async function asmCmMfGet1(force){const W=workerBase();if(!W||(!force&&Date.now()<asmCmMfRetry))return;const L=asmList,at=L?asmListAt:0;if(!force&&asmCmMfAt===at)return;
  if(!force&&L&&!L.has(asmCmMfKey())){asmCmMfAt=at;return}   // the list says there is none: nothing to ask
  try{const r=await fetch(W.url+'?key='+asmCmMfKey(),{headers:{'x-app-token':W.tok},cache:'no-store'});
    if(!r.ok&&r.status!==404){asmCmMfRetry=Date.now()+ASM_RETRY_MS;return}
    asmCmMfAt=at;const j=r.ok?await r.json().catch(()=>null):null,m=j&&ASM_CM_MF_RE.exec(String(j.sig||''));if(!m)return;
    const keys=JSON.parse(m[1]).keys;if(!keys||typeof keys!=='object')return;await asmCmMfApply(keys)}
  catch(e){console.warn('no manifest',e);asmCmMfRetry=Date.now()+ASM_RETRY_MS}}
async function asmCmMfApply(keys){let n=0;
  for(const [k,t] of Object.entries(keys)){const r=renders[k];if(r&&(+r.t||0)<+t){delete renders[k];asmTried.delete(k);n++;try{await txs('meta','readwrite',st=>st.delete('render:'+k))}catch{}}}
  asmCmMf={keys};try{localStorage.setItem(ASM_CM_MF,JSON.stringify(asmCmMf))}catch{}
  if(n)console.info(`manifest: ${n} master photo${n===1?'':'s'} uploaded again, downloading them afresh`);return n}

/* ---- a figured shirt's cloth as one whole repeat cut from its close-up (2026-11-14) ----
   (the owner, from 2048 mockups of his white shirt with grey figures: "Move the repeat finder into the app... any dobby and other figured
   shirts with a close up", then, after sheets of all nine that qualify, "Build it with the strict confidence test") The close-up cloth
   of the suits (asmCuTile1) blends a square's edges to make it repeat, which cuts and doubles a regular figure; here the pattern's own
   repeat is found and exactly one cell is cut, so it tiles with no seam:
   - asmCrFind: on a copy ASM_CR.W wide, the cloth's light with the photo's lighting divided out; its self-similarity over the middle
     window at every shift up to W/ASM_CR.D; the two shortest strong, non-parallel peaks are the repeat's steps (a brick layout gives a
     rectangle two cells tall); the steps are nudged until the cells around the middle, laid over each other, are sharpest
   - the confidence test: per, the share of the cloth's contrast that the repeat explains (the averaged cell's variance over the
     cells' own), and sd, how strong the averaged cell is; under ASM_CR.per or ASM_CR.sd there is no tile and the shirt is drawn as before
     (measured on his nine, per / sd: the grey-figured dobby .89 / .42; White dobby .50 / .07, Lavender dobby .35 / .11, Light blue dobby
     .30 / .05, White woven .25 / .13, Check .04 / .02, two with no repeat at all: on tone-on-tone weaves the finder locks onto threads)
   - asmCrTile1: the cells around the middle averaged into one (sampled along the pattern's own rows and columns, so it is straightened
     and the camera's angle averages out), each colour against the photo's lighting; the ground (the lighter part) becomes the tagged
     colour and the figure keeps its own colour against it; life size, never finer than ASM_TEX_MIN_MM
   - printed patterns (a micro-print lost its dots to the weave under them), herringbone, twill and end-on-end shirts (their own painters
     and the owner's sizes of 2026-11-12) and band readings are left alone (asmCrWants)
   The tile is an ordinary shirt tile ({t,TW,TH,mm,fine}), so both painters paint it as they paint asmCmTile's */
const ASM_CR={W:480,flat:12,D:7,win:.5,peak:.25,nc:3,Q:20,TW:64,ground:.45,per:.6,sd:.12,v:1};
const asmCrWants=i=>{if(!i||i.type!=='shirt'||!i.texture)return false;const s=typeof usableSett==='function'?usableSett(i):null;
  return asmCmRoute(i,'shirt').how==='tile'&&!(s&&s.bands)&&!/herringbone|twill|end-on-end|print|foulard|polka|dot/i.test(String(i.pattern||'')+' '+(patBase(i.pattern)||''))};
const asmCrTag=(z,i)=>z==='shirt'&&asmCrWants(i)?'/cr'+ASM_CR.v+'.'+i.texture.length+i.texture.slice(-12).replace(/[^A-Za-z0-9]/g,''):'';
/* the repeat of a cloth in RGBA pixels d (W x H): {ax,ay,bx,by (the two steps, px), half (a brick layout), per, sd, peaks, R,G,B,Yb} or null */
function asmCrFind(d,W,H){const L=ASM_LIN,N=W*H,R=new Float32Array(N),G=new Float32Array(N),B=new Float32Array(N),Y=new Float32Array(N);
  for(let k=0;k<N;k++){R[k]=L[d[4*k]];G[k]=L[d[4*k+1]];B[k]=L[d[4*k+2]];Y[k]=.2126*R[k]+.7152*G[k]+.0722*B[k]}
  const cx=v=>v<0?0:v>W-1?W-1:v,cy=v=>v<0?0:v>H-1?H-1:v;
  const box=(a,r)=>{const t=new Float32Array(N),q=new Float32Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let k=-r;k<=r;k++)s+=a[y*W+cx(x+k)];t[y*W+x]=s/(2*r+1)}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let k=-r;k<=r;k++)s+=t[cy(y+k)*W+x];q[y*W+x]=s/(2*r+1)}return q};
  let Yb=Y;for(let j=0;j<3;j++)Yb=box(Yb,Math.round(W/ASM_CR.flat));const F=new Float32Array(N);for(let k=0;k<N;k++)F[k]=Y[k]/(Yb[k]||1)-1;
  const D=Math.round(W/ASM_CR.D),M=Math.round(Math.min(W,H)*ASM_CR.win),x0=(W-M)>>1,y0=(H-M)>>1,AW=2*D+1,A=new Float32Array(AW*(D+1));
  for(let dy=0;dy<=D;dy++)for(let dx=-D;dx<=D;dx++){let s=0;for(let y=y0;y<y0+M;y+=2){const r0=y*W,r1=cy(y+dy)*W;for(let x=x0;x<x0+M;x+=2)s+=F[r0+x]*F[r1+cx(x+dx)]}A[dy*AW+dx+D]=s}
  const a0=A[D];if(!(a0>0))return null;const at=(dx,dy)=>dy<0?at(-dx,-dy):(Math.abs(dx)>D||dy>D?-1:A[dy*AW+dx+D]/a0),pk=[];
  for(let dy=0;dy<D;dy++)for(let dx=-D+1;dx<D;dx++){if(dx*dx+dy*dy<16||(dy===0&&dx<0))continue;const v=at(dx,dy);if(v<ASM_CR.peak)continue;let ok=1;for(let j=-1;j<=1&&ok;j++)for(let i=-1;i<=1;i++)if((i||j)&&at(dx+i,dy+j)>v){ok=0;break}
    if(ok){const px=(at(dx+1,dy)-at(dx-1,dy))/(2*(2*v-at(dx+1,dy)-at(dx-1,dy))||1),py=(at(dx,dy+1)-at(dx,dy-1))/(2*(2*v-at(dx,dy+1)-at(dx,dy-1))||1);pk.push({x:dx+Math.max(-.5,Math.min(.5,px)),y:dy+Math.max(-.5,Math.min(.5,py))})}}
  pk.sort((p,q)=>Math.hypot(p.x,p.y)-Math.hypot(q.x,q.y));if(pk.length<2)return null;
  let a=pk[0],b=pk.find(p=>Math.abs(p.x*a.y-p.y*a.x)/(Math.hypot(p.x,p.y)*Math.hypot(a.x,a.y))>.35);if(!b)return null;
  if(Math.abs(a.y)>Math.abs(a.x)){const t=a;a=b;b=t}if(a.x<0)a={x:-a.x,y:-a.y};if(b.y<0)b={x:-b.x,y:-b.y};
  const mx=W/2,my=H/2,nc=ASM_CR.nc,Q=ASM_CR.Q,nn=(2*nc+1)*(2*nc+1);
  const samp=(arr,x,y)=>{x=x<0?0:x>W-1.001?W-1.001:x;y=y<0?0:y>H-1.001?H-1.001:y;const xi=x|0,yi=y|0,fx=x-xi,fy=y-yi,k=yi*W+xi;return (arr[k]*(1-fx)+arr[k+1]*fx)*(1-fy)+(arr[k+W]*(1-fx)+arr[k+W+1]*fx)*fy};
  // the pile of cells: [the averaged cell's variance, the cells' own variance]
  const pile=(ax,ay,bx,by)=>{let m1=0,m2=0,t1=0,t2=0;for(let v=0;v<Q;v++)for(let u=0;u<Q;u++){let s=0;for(let j=-nc;j<=nc;j++)for(let i=-nc;i<=nc;i++){const f=samp(F,mx+(i+u/Q)*ax+(j+v/Q)*bx,my+(i+u/Q)*ay+(j+v/Q)*by);s+=f;t1+=f;t2+=f*f}s/=nn;m1+=s;m2+=s*s}
    const n=Q*Q,nt=n*nn;return [m2/n-(m1/n)*(m1/n),t2/nt-(t1/nt)*(t1/nt)]};
  let P=[a.x,a.y,b.x,b.y],best=pile(P[0],P[1],P[2],P[3])[0];for(const st of [.3,.15,.07,.03])for(let pass=0;pass<3;pass++)for(let q=0;q<4;q++)for(const sg of [-1,1]){const T2=P.slice();T2[q]+=sg*st;const v=pile(T2[0],T2[1],T2[2],T2[3])[0];if(v>best){best=v;P=T2}}
  const pv=pile(P[0],P[1],P[2],P[3]);let ax=P[0],ay=P[1],bx=P[2],by=P[3];const la2=ax*ax+ay*ay,sh=(bx*ax+by*ay)/la2,half=Math.abs(sh-Math.round(sh))>.25;
  if(half){const s=Math.sign(sh-Math.round(sh))||1;bx=2*bx-s*ax;by=2*by-s*ay}{const r=Math.round((bx*ax+by*ay)/la2);bx-=r*ax;by-=r*ay}
  return {ax,ay,bx,by,half,per:pv[1]>0?pv[0]/pv[1]:0,sd:Math.sqrt(Math.max(0,pv[0])),peaks:pk.length,R,G,B,Yb,samp}}
const asmCrMem=new Map();
function asmCrTile(i){if(!i||!i.texture||typeof document==='undefined')return Promise.resolve(null);const key=i.id+'|'+colOf(i)+'|'+i.texture.length+i.texture.slice(-12);let p=asmCrMem.get(key);
  if(!p){if(asmCrMem.size>24)asmCrMem.clear();p=asmCrTile1(i).catch(()=>null);asmCrMem.set(key,p)}return p}
/* the tile: one repeat (two cells of a brick layout) -> {t,TW,TH,mm,fine,cr} or null when no repeat is found or it is not sure enough;
   all=true gives the tile whatever the confidence (the bench, the tests) */
async function asmCrTile1(i,all){const L=ASM_LIN,im=new Image();im.src=i.texture;await im.decode();if(!im.naturalWidth||!im.naturalHeight)return null;
  const W=Math.min(ASM_CR.W,im.naturalWidth),H=Math.max(8,Math.round(W*im.naturalHeight/im.naturalWidth)),cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const g=cv.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(im,0,0,W,H);const f=asmCrFind(g.getImageData(0,0,W,H).data,W,H);if(!f)return null;
  const cr={across:+Math.hypot(f.ax,f.ay).toFixed(2),down:+Math.hypot(f.bx,f.by).toFixed(2),of:W,brick:f.half,per:+f.per.toFixed(3),sd:+f.sd.toFixed(3),peaks:f.peaks};
  if(!all&&!(f.per>=ASM_CR.per&&f.sd>=ASM_CR.sd))return null;
  const la=Math.hypot(f.ax,f.ay),lb=Math.hypot(f.bx,f.by),TW=ASM_CR.TW,TH=Math.max(8,Math.min(512,Math.round(TW*lb/la))),n=TW*TH,t=new Float32Array(3*n),lum=new Float32Array(n),nc=ASM_CR.nc,nb=f.half?2:nc,mx=W/2,my=H/2;
  for(let v=0;v<TH;v++)for(let u=0;u<TW;u++){let r=0,gg=0,bb=0,c=0;for(let j=-nb;j<=nb;j++)for(let ii=-nc;ii<=nc;ii++){const x=mx+(ii+u/TW)*f.ax+(j+v/TH)*f.bx,y=my+(ii+u/TW)*f.ay+(j+v/TH)*f.by;if(x<1||y<1||x>W-2||y>H-2)continue;
      const l=f.samp(f.Yb,x,y)||1;r+=f.samp(f.R,x,y)/l;gg+=f.samp(f.G,x,y)/l;bb+=f.samp(f.B,x,y)/l;c++}
    const k=v*TW+u;if(!c)c=1;t[3*k]=r/c;t[3*k+1]=gg/c;t[3*k+2]=bb/c;lum[k]=.2126*t[3*k]+.7152*t[3*k+1]+.0722*t[3*k+2]}
  // the ground (the lighter part) becomes the tagged colour; the figure keeps its colour against it
  const srt=Array.from(lum).sort((p,q)=>p-q),cut=srt[Math.floor(n*ASM_CR.ground)],gr=[0,0,0];let gn=0;for(let k=0;k<n;k++)if(lum[k]>=cut){gr[0]+=t[3*k];gr[1]+=t[3*k+1];gr[2]+=t[3*k+2];gn++}
  const h=String(colOf(i)).replace('#',''),base=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]);
  for(let k=0;k<n;k++)for(let q=0;q<3;q++)t[3*k+q]=Math.min(1,base[q]*t[3*k+q]/((gr[q]/gn)||1));
  const mm=Math.max(ASM_TEX_MIN_MM,la/W*ASM_CLOSEUP_MM);cr.mm=+mm.toFixed(2);
  return {t,TW,TH,mm,fine:true,cr}}

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
  // a woven shirt (dobby, basket, herringboneâ€¦: asmWeave's tile) keeps the earlier painter's rules, which the owner chose on 2026-11-12:
  // the drawing's full swing (texTones' 2.5..7 L*, not softened again: at 45% his white woven diamond was 3 L*, invisible), its
  // repeat measured from the close-up (asmTexMm) or a herringbone's count, and 3x3 points a pixel when painted (fine)
  const wv=role==='shirt'&&typeof asmWeave==='function'?asmWeave(i):null,fine=!!(wv&&wv.f==='tile');
  const kk=fine?1:ASM_CM_SOFT[role]??1;if(kk!==1){const g=[0,1,2].map(q=>{const v=[];for(let k=0;k<TW*TH;k++)v.push(t[3*k+q]);v.sort((a,b)=>a-b);return v[v.length>>1]});for(let k=0;k<TW*TH;k++)for(let q=0;q<3;q++)t[3*k+q]=g[q]+kk*(t[3*k+q]-g[q])}
  // a repeat's size: the reading's count across (a jacket or shirt about 550 mm), a weave's own rules, else the drawing's (200 units across)
  let mm=0;if(s&&s.tex)mm=pat==='herringbone'?(s.tr&&s.tr<80?ASM_SHIRT_MM/s.tr:12):3;else if(s&&s.motif)mm=Math.max(ASM_TEX_MIN_MM,2*ASM_CLOSEUP_MM/Math.max(1,+s.cr||20));else if(s&&+s.tr)mm=ASM_SHIRT_MM/s.tr;else mm=w*ASM_SHIRT_MM/200;
  if(fine)mm=wv.hb?wv.mm:await asmTexMm(i);
  if(asmHbShirt(i)&&role==='shirt')asmHbShirtLook(t,TW,TH,i,s);
  return {t,TW,TH,mm,fine}}
/* a herringbone shirt (2026-11-13, the owner's pick from mockups of his pink herringbone, "every other column lighter", for every
   herringbone shirt): one slant direction catches the light, as real herringbone does: the tile's second column is ASM_HB_COL_LIFT brighter (linear light; 10% of the
   way to white, as mocked up on the pink, made the blue's columns bold pale stripes). Before that the tile's average is held at ASM_HB_SHIRT_Y of the tagged colour, whatever the weave's
   strength: the pink drawn with the blue's stronger reading went from 0.78 to 0.74 of its colour and read mauve (the pink was 0.78, the
   blue 0.75-0.77). The second column starts half way across the tile (with plain bands too: column, band, column, band) and is
   (1-share)/(2(1+share)) of it wide (texPlainBand's share) */
const ASM_HB_COL_LIFT=.07,ASM_HB_SHIRT_Y=.78,ASM_HB_SHIRTV=1;
const asmHbShirt=i=>!!i&&i.type==='shirt'&&(patBase(i.pattern)==='herringbone'||(()=>{const s=typeof usableSett==='function'?usableSett(i):null;return !!(s&&s.tex&&s.tex.kind==='herringbone')})());
function asmHbShirtLook(t,TW,TH,i,s){const L=ASM_LIN,h=String(colOf(i)).replace('#',''),tag=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),m=[0,0,0],n=TW*TH;
  for(let k=0;k<n;k++)for(let q=0;q<3;q++)m[q]+=t[3*k+q];
  const g=m.map((v,q)=>v>1e-6?ASM_HB_SHIRT_Y*tag[q]*n/v:1);for(let k=0;k<n;k++)for(let q=0;q<3;q++)t[3*k+q]=Math.min(1,t[3*k+q]*g[q]);
  const band=s&&s.tex&&typeof texPlainBand==='function'?texPlainBand(s.tex.grid):null,sh=band?band.share:0,x0=Math.round(TW/2),x1=Math.round(TW*(.5+(1-sh)/(2*(1+sh))));
  for(let y=0;y<TH;y++)for(let x=x0;x<x1;x++)for(let q=0;q<3;q++){const k=3*(y*TW+x);t[k+q]=Math.min(1,t[k+q]*(1+ASM_HB_COL_LIFT))}}
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
/* (2026-11-14) cloth from the close-up (the owner: his three brown suits "just look bland in the photos"; from mockups of each painted with
   a patch of its own close-up he chose this). A plain or finely woven suit, blazer or pair of trousers was painted as a flat colour or
   a generic twill too fine to show at the picture's size, so every such cloth looked alike; its close-up shows what it really is (a
   two-tone twill, a crosshatch of light and dark threads, a smooth worsted). asmCuTile(item): the cleanest square of cloth in the
   close-up (asmCuPatch: no paper, seam or fold), its lighting flattened, made to tile without a seam or a mirror image (asmCuWrap), in
   the tagged colour, at its real size (the close-up taken as ASM_CLOSEUP_MM wide); the painter lays it along the sleeves, body and legs
   like any read cloth (c.suit, a tile). null when there is no close-up, no clean patch, or nothing in it to show: the item is then
   painted as before. ASM_CU: tile texels a side, the patch's sides tried (of the close-up's shorter side), how even a patch must be, how
   much stronger the detail is drawn, the least detail worth drawing */
const ASM_CU={T:256,sides:[.5,.4,.32,.25],even:.16,edge:8,show:.12,kmax:3.5,min:.02,zoom:3,sharp:.6,flat:18,dark:.012,fine:.5,paper:1.3,solid:.6,hb:3,hbs:2,v:9};   // (measured on the owner's three brown close-ups: a window with a seam has a line 10-24 times the cloth's usual, a clean one 4-7 times)
/* (at its real size a fine twill's ribs are under one pixel of the picture and average to a flat colour, exactly what the close-up was
   meant to cure) the cloth is drawn ASM_CU.zoom times its real size, as shirt weaves and ties are drawn larger than life so they show on
   a phone; and a patch must be in focus: its fine detail at least ASM_CU.sharp of the cloth's sharpest tenth (the first build took the
   evenest patch, which on one close-up was its blurred corner) */
/* (the first build drew the detail 1.25x and it was too faint to matter at Today's size on two of the owner's three brown suits) the
   detail is drawn as strong as it takes to show in the picture: its swing (5th to 95th percentile) measured as the picture shows it
   (the tile averaged over a picture pixel, ASM_PX_MM) is brought up to ASM_CU.show, at most ASM_CU.kmax times, never weaker than life.
   A patch is clean when its light is even within ASM_CU.even and its strongest line is under ASM_CU.edge times the cloth's usual */
/* (the owner, 2026-11-14: "Leave the current painter for black solid color suits") cloth darker than ASM_CU.dark (linear light) is not
   taken from the close-up. (His Medium Grey came out a patchwork: the close-up's soft blotches and crease shadows, a quarter of the
   square across, survived a flattening at a seventh of the square and repeated with the tile) the square's light is flattened at
   1/ASM_CU.flat of its side, so only the weave and its grain stay */
const asmCuDark=i=>{const h=String(colOf(i)).replace('#',''),c=[0,2,4].map(k=>ASM_LIN[parseInt(h.slice(k,k+2),16)||0]);return .2126*c[0]+.7152*c[1]+.0722*c[2]<ASM_CU.dark};
/* (the owner, 2026-11-14: "Half strength for medium grey": its close-up's grain, swing 1.02, painted a fine worsted as a flannel) a cloth
   whose pattern or description says fine or worsted shows its detail no stronger than ASM_CU.fine (his Light Grey, .41, is under it) */
const asmCuFine=i=>/\bfine\b|worsted/i.test(String(i.pattern||'').replace(/[-_]/g,' ')+' '+((i.patternSpec&&i.patternSpec.description)||i.patternText||''));
/* (the owner, 2026-11-14, from sheets of his Grey Herringbone at full, double and triple: "put the herringbone on triple") a herringbone
   jacket, waistcoat or trousers with a close-up takes its cloth from it too, its detail ASM_CU.hb times life (its fine tonal chevrons are
   lost at life strength; the fine-cloth cap does not apply); one read in bands (a pinstripe on a herringbone ground) keeps its painter.
   (the same day, from mocks at triple with single, double and triple sleeves: "triple on the body, double on the sleeves": triple read
   rough and streaky on the sleeves) a jacket's sleeves show the detail at ASM_CU.hbs times life: the tile carries slv = hbs/hb, and both
   painters pull a sleeve pixel's tile colour that far toward the tile's colour (suitCol; the shader's uSlv) */
const asmCuWants=(i,how)=>!!(i&&i.texture&&(how==='flat'||how==='twill'||how==='plain'||how==='herringbone')&&!asmCuDark(i));
const asmCuTag=(z,i)=>(z==='jacket'||z==='waistcoat'||z==='trousers')&&asmCuWants(i,asmCmRoute(i,z).how)?'/cu'+ASM_CU.v+'.'+i.texture.length+i.texture.slice(-12).replace(/[^A-Za-z0-9]/g,''):'';
/* the cleanest square of cloth: on a 420 px copy, cloth is what is not the white paper; a window is scored by how uneven its light is
   (the spread of its 8 px blocks' means: a fold, a shadow) and by its strongest line (a seam or crease: the light at 3 px against the
   light at 9 px); the largest side whose best window is clean enough wins, else the cleanest of the smallest */
function asmCuPatch(d,W,H){const L=ASM_LIN,N=W*H,Y=new Float32Array(N),m=new Uint8Array(N);
  for(let k=0;k<N;k++){const r=L[d[4*k]],g=L[d[4*k+1]],b=L[d[4*k+2]],mx=Math.max(r,g,b),mn=Math.min(r,g,b);Y[k]=.2126*r+.7152*g+.0722*b;m[k]=Y[k]>.42&&(mx-mn)/(mx||1)<.16?0:1}
  /* (the owner's new Light Grey close-up, 2026-11-14: "now it's painting without any texture": a well-lit light grey, no paper in it, and
     27% of its pixels, the light threads, counted as paper, so no window was all cloth) paper is a solid area clearly brighter than the
     cloth: ASM_CU.paper times the picture's 30th percentile of light, and ASM_CU.solid of its 13 px surroundings bright too */
  {const ys=[];for(let k=0;k<N;k+=7)ys.push(Y[k]);ys.sort((a,b)=>a-b);const lim=ASM_CU.paper*ys[Math.floor(ys.length*.3)],P=new Float32Array(N);for(let k=0;k<N;k++)P[k]=!m[k]&&Y[k]>lim?1:0;
    const bx=(a,R)=>{const t=new Float32Array(N),o=new Float32Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let q=-R;q<=R;q++)s+=a[y*W+Math.min(W-1,Math.max(0,x+q))];t[y*W+x]=s/(2*R+1)}
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let q=-R;q<=R;q++)s+=t[Math.min(H-1,Math.max(0,y+q))*W+x];o[y*W+x]=s/(2*R+1)}return o};
    const S=bx(P,6);for(let k=0;k<N;k++)m[k]=S[k]>ASM_CU.solid?0:1}
  const box=(a,R)=>{const t=new Float32Array(N),o=new Float32Array(N),cx=v=>v<0?0:v>W-1?W-1:v,cy=v=>v<0?0:v>H-1?H-1:v;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let k=-R;k<=R;k++)s+=a[y*W+cx(x+k)];t[y*W+x]=s/(2*R+1)}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let k=-R;k<=R;k++)s+=t[cy(y+k)*W+x];o[y*W+x]=s/(2*R+1)}return o};
  const b3=box(Y,3),b9=box(Y,9),E=new Float32Array(N);for(let k=0;k<N;k++)E[k]=b9[k]>1e-5?Math.abs(b3[k]/b9[k]-1):0;
  // how sharp the cloth is at each place: its finest detail (each pixel against its 3 px surroundings), smoothed
  const F0=new Float32Array(N);for(let k=0;k<N;k++)F0[k]=b3[k]>1e-5?Math.abs(Y[k]/b3[k]-1):0;const Fd=box(F0,6),fv=[];for(let k=0;k<N;k+=13)if(m[k])fv.push(Fd[k]);fv.sort((a,b)=>a-b);const f90=fv.length?fv[Math.floor(fv.length*.9)]:0;
  const S=Math.min(W,H),B=8;const ev=[];for(let k=0;k<N;k+=13)if(m[k])ev.push(E[k]);ev.sort((a,b)=>a-b);const med=ev.length?ev[ev.length>>1]:0;
  // a window is clean when it is all cloth, its light is even and it holds no line (a seam, a crease, an edge); of the clean windows of a
  // side the sharpest is taken; the largest side with a clean window in focus wins, else the sharpest clean window of any side; none
  // clean: no patch (the item is painted as before)
  let spare=null;
  for(const f of ASM_CU.sides){const P=Math.round(S*f);let best=null;
    for(let y0=6;y0+P<=H-6;y0+=6)for(let x0=6;x0+P<=W-6;x0+=6){let ok=1,s=0,s2=0,n=0,e=0,fs=0;
      for(let y=y0;y<y0+P&&ok;y+=B)for(let x=x0;x<x0+P;x+=B){const k=y*W+x;if(!m[k]||!m[Math.min(N-1,k+B-1)]||!m[Math.min(N-1,k+(B-1)*W)]){ok=0;break}const v=b3[k+3*W+3]||b3[k];s+=v;s2+=v*v;n++;fs+=Fd[k];
        for(let q=0;q<B;q+=2){const e1=E[Math.min(N-1,k+q)],e2=E[Math.min(N-1,k+q*W)],e3=E[Math.min(N-1,k+q*W+q)];if(e1>e)e=e1;if(e2>e)e=e2;if(e3>e)e=e3}}
      if(!ok||!n)continue;const mean=s/n,sd=Math.sqrt(Math.max(0,s2/n-mean*mean))/(mean||1);if(sd>ASM_CU.even||e>ASM_CU.edge*med)continue;
      const sharp=fs/n;if(!best||sharp>best.sharp)best={x0,y0,P,sd,e,sharp,med,f90}}
    if(best&&best.sharp>=ASM_CU.sharp*f90)return best;if(best&&(!spare||best.sharp>spare.sharp))spare=best}
  return spare}
/* a square of detail (each texel over its surroundings, mean 1) made to tile: the square and itself moved half way round are blended,
   each where the other's joins are, with the blend's loss of contrast made up (weights over the root of their squares' sum), so the
   weave keeps its direction and no mirror image shows */
function asmCuWrap(a,T){const o=new Float32Array(T*T),h=T>>1,w1=v=>{const t=Math.abs(v/T-.5)*2;return t<.5?1:t>.9?0:1-(t-.5)/.4};
  for(let y=0;y<T;y++)for(let x=0;x<T;x++){const wa=Math.min(w1(x+.5),w1(y+.5)),wb=1-wa,A=a[y*T+x]-1,Bv=a[((y+h)%T)*T+(x+h)%T]-1;o[y*T+x]=1+(wa*A+wb*Bv)/Math.sqrt(wa*wa+wb*wb)}return o}
const asmCuMem=new Map();
function asmCuTile(i){if(!i||!i.texture||typeof document==='undefined')return Promise.resolve(null);const key=i.id+'|'+colOf(i)+'|'+i.texture.length+i.texture.slice(-12);let p=asmCuMem.get(key);
  if(!p){if(asmCuMem.size>24)asmCuMem.clear();p=asmCuTile1(i).catch(()=>null);asmCuMem.set(key,p)}return p}
async function asmCuTile1(i){const L=ASM_LIN,h=String(colOf(i)).replace('#',''),base=[0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0]),im=new Image();im.src=i.texture;await im.decode();
  const FW=im.naturalWidth,FH=im.naturalHeight,cv=(w,hh)=>{const c=document.createElement('canvas');c.width=w;c.height=hh;return c};if(!FW||!FH)return null;
  const W=420,H=Math.max(8,Math.round(W*FH/FW)),sc=cv(W,H),sg=sc.getContext('2d',{willReadFrequently:true});sg.drawImage(im,0,0,W,H);
  const p=asmCuPatch(sg.getImageData(0,0,W,H).data,W,H);if(!p)return null;
  const T=ASM_CU.T,f=FW/W,pc=cv(T,T),pg=pc.getContext('2d',{willReadFrequently:true});pg.imageSmoothingQuality='high';pg.drawImage(im,Math.round(p.x0*f),Math.round(p.y0*f),Math.round(p.P*f),Math.round(p.P*f),0,0,T,T);
  const pd=pg.getImageData(0,0,T,T).data,n=T*T,cl=v=>v<0?0:v>T-1?T-1:v;
  const blur=(a,R)=>{const t=new Float32Array(n),o=new Float32Array(n);for(let y=0;y<T;y++)for(let x=0;x<T;x++){let s=0;for(let k=-R;k<=R;k++)s+=a[y*T+cl(x+k)];t[y*T+x]=s/(2*R+1)}
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){let s=0;for(let k=-R;k<=R;k++)s+=t[cl(y+k)*T+x];o[y*T+x]=s/(2*R+1)}return o};
  const R=Math.round(T/ASM_CU.flat),rel=[0,1,2].map(q=>{const a=new Float32Array(n);for(let k=0;k<n;k++)a[k]=L[pd[4*k+q]];let b=a;for(let j=0;j<3;j++)b=blur(b,R);const o=new Float32Array(n);for(let k=0;k<n;k++)o[k]=b[k]>1e-5?a[k]/b[k]:1;return asmCuWrap(o,T)});
  const v=Array.from(rel[1]).sort((a,b)=>a-b),swing=v[Math.floor(n*.95)]-v[Math.floor(n*.05)];if(!(swing>=ASM_CU.min))return null;
  // as the picture shows it: the tile averaged over one picture pixel (wrapping)
  const mm=p.P/W*ASM_CLOSEUP_MM*ASM_CU.zoom,fb=Math.max(1,Math.round(T/(mm*ASM_PX_MM))),lo=[];for(let y=0;y<T;y+=fb)for(let x=0;x<T;x+=fb){let s=0;for(let dy=0;dy<fb;dy++)for(let dx=0;dx<fb;dx++)s+=rel[1][((y+dy)%T)*T+(x+dx)%T];lo.push(s/(fb*fb))}
  lo.sort((a,b)=>a-b);const shown=lo[Math.floor(lo.length*.95)]-lo[Math.floor(lo.length*.05)],gain=asmSuitWeave(i)==='herringbone'?ASM_CU.hb:asmCuFine(i)&&shown>ASM_CU.fine?ASM_CU.fine/shown:Math.max(1,Math.min(ASM_CU.kmax,ASM_CU.show/Math.max(1e-4,shown)));
  const t=new Float32Array(3*n);for(let k=0;k<n;k++)for(let q=0;q<3;q++)t[3*k+q]=Math.max(0,base[q]*(1+gain*(rel[q][k]-1)));
  return {t,c:new Float32Array(base),TW:T,TH:T,mm,linen:false,cloth:null,...(asmSuitWeave(i)==='herringbone'?{slv:ASM_CU.hbs/ASM_CU.hb}:{}),cu:{x:p.x0,y:p.y0,side:p.P,of:W,even:+p.sd.toFixed(3),line:+p.e.toFixed(3),usual:+p.med.toFixed(3),sharp:+(p.sharp/(p.f90||1)).toFixed(2),swing:+swing.toFixed(3),shown:+shown.toFixed(3),gain:+gain.toFixed(2)}}}
/* the job for asmCmBuild, or null when the kind's master or masks are not on the device */
async function asmCmJob(o){const kind=asmCmKind(o),K=ASM_CM_KINDS[kind];if(!K)return null;const keys=asmCmAssets(kind);if(keys.some(k=>!renders[k]))return null;
  const masks={};for(const z of K.zones)masks[z]=renders[asmCmKey(kind,'mask/'+z)].img;
  const parts={};for(const s of ['sleeveR','sleeveL','lapelR','lapelL']){const r=renders[asmCmKey(kind,'part/'+s)];if(r)parts[s]=r.img}
  const gks=asmCmGeoKeys(kind),geo=gks.length?{geoU:renders[gks[0]].img,geoV:renders[gks[1]].img,gt:renders[gks[0]].t+'.'+renders[gks[1]].t}:{};
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
      else if(how==='tile'){const T=await asmCmTile(i,z==='shirt'?'shirt':'bot');if(T)c.tile=T;
        if(z==='shirt'&&asmCrWants(i)){const C=await asmCrTile(i);if(C)c.tile=C}}   // a figured shirt: one whole repeat from its close-up, when the finder is sure
    }catch(e){console.warn('cloth',z,e)}
    // a plain or finely woven suit, blazer or trousers with a close-up: a patch of the close-up is its cloth (asmCuTile)
    if((z==='jacket'||z==='waistcoat'||z==='trousers')&&asmCuWants(i,how)){const T=await asmCuTile(i);if(T){c.suit=T;delete c.tile}}
    c.mat=asmCmMat(i,z);
    cloth[z]=c}
  const bg=renders[asmCmBgKey()],lks=asmCmLightKeys(kind);if(lks.length)geo.light=renders[lks[0]].img;
  return {cm:kind,size:self.ASM_CM_SIZE||ASM_SIZE,mk:keys[0],mt:renders[keys[0]].t,rev:asmCmHash(keys.filter(k=>!gks.includes(k)).map(k=>renders[k].t||0).join(',')),master:renders[keys[0]].img,masks,parts,cloth,...geo,bg:bg?bg.img:null,bgt:bg?bg.t:0,
    bar:o.clip&&kind!=='vest'?asmBarRgb(o.clip):null,gl:typeof asmGlPref==='function'?asmGlPref():false}}   // (gl: this phone's graphics-chip switch, asm-gl.js; the worker has no localStorage)

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
  const shade={},keep={},fold={},LM=job.light?(await asmData(job.light,S)).data:null;
  for(const z of names){const a=A[z];
    if(KEEP.has(z)){const idx=[];for(let k=0;k<N;k++)if(a[k]&&a[k]<CLEAN)idx.push(k);const I=Int32Array.from(idx),C=new Float32Array(3*I.length);
      for(let q=0;q<3;q++){const v=new Float32Array(N);for(let k=0;k<N;k++)v[k]=L[M[4*k+q]];const o=pushOut(a,v);for(let i=0;i<I.length;i++)C[3*i+q]=o[I[i]]}
      keep[z]={I,C};continue}   // (the edge pixels in order: looked up by binary search, a map over every pixel was 33 MB a zone at 2880)
    const sh=z==='shirt',ref=pct(a,sh?.9:.75)||1,cap=sh?1.15:1.6,v=new Float32Array(N);
    // (2026-11-14: reading the light along the cloth's own colour was tried for its lower noise and dropped: in the masters' shadows the
    // strong channel falls less than the others, so shadows read about 30% lighter and a navy pinstripe lost its darker far side)
    for(let k=0;k<N;k++)v[k]=Math.min(cap,Y[k]/ref);
    // the form light from the master's light map (the body's own shape toward the window), where there is one
    if(LM)for(let k=0;k<N;k++)if(a[k])v[k]=Math.min(1.63,v[k]*(1+(LM[4*k]-128)/255));   // (1.63: the light is kept in 16 bits over 40000)
    // the folds' depth as in real photographs (ASM_CM_FOLD): below its lit level a cloth's light is raised to the power that puts the
    // zone's median where the reference photos have it (the masters' shadows are far deeper: a jacket's median .55 of its lit level
    // against .74 on a photographed navy suit, and darker still once painted); above the lit level nothing changes
    const tg=ASM_CM_FOLD[z];let gm=1;if(tg){const s=[];for(let k=0;k<N;k+=7)if(a[k]>=CLEAN)s.push(v[k]);s.sort((x,y)=>x-y);const md=s.length?s[s.length>>1]:1;
      const lo=s.length?s[Math.floor(s.length*.1)]:1;   // (the shadows' depth too: the power that lifts the 10th percentile to the references', when that is the smaller)
      if(md>.02&&md<.98)gm=Math.min(1,Math.log(tg[0])/Math.log(md));if(lo>.02&&lo<tg[1])gm=Math.min(gm,Math.log(tg[1])/Math.log(lo));gm=Math.max(tg[2],gm);
      // (the owner, 2026-11-14: "everything looks more washed out") lifting the shadows alone made every garment lighter overall; the
      // zone's mean light is brought back ASM_CM_FOLD_KEEP of the way to what it was, so the cloth keeps its tone and only the folds' shape changes
      if(gm!==1){let m0=0,m1=0,n=0;for(let k=0;k<N;k+=7)if(a[k]>=CLEAN){const x=v[k];m0+=x;m1+=x<1?Math.pow(x,gm):x;n++}
        // (the owner again, on the mid grey suit: "you don't think the lighting totally washes it out here?") the power and the scale are
        // only kept here (P.fold): each look takes as much of them as its cloth is dark (asmCmFoldW), so only dark cloth, whose shadows
        // really went to black, has them opened, and a mid or light cloth keeps the folds it had
        fold[z]=[gm,n&&m1>0?Math.pow(m0/m1,ASM_CM_FOLD_KEEP):1]}}
    const o=pushOut(a,v),u=new Uint16Array(N);for(let k=0;k<N;k++)u[k]=Math.round(Math.max(0,o[k])*40000);shade[z]=u}
  const P={kind:job.cm,S,N,M,A,names,shade,keep,geo:null,tieGeo:null,cuff:null,cuffAng:[0],pxmm:ASM_PX_MM*S/ASM_SIZE*K.pxmm,bgShadow:null,lm:LM,fold};
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
/* The elbow fit (asmSleeveSegs) was tuned on the earlier master's arms; here it put the forearm across the chest 24Â° off. A creased
   sleeve whose forearm a fit from its own mask turns by over 15Â° is fitted again: the upper arm from its top 40%, the forearm from its
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
     is RÂ·asin(x/R) of cloth from it, R = ASM_LEG_K Ã— half the width, so the lines close up where the cloth turns away at the sides and
     stay parallel to the crease (a tapering leg loses lines at its edges, as cut cloth does)
   - an outer edge with the hand right beside it is not the cloth's edge: filled in from the rows above and below; every row's edges, the
     fly and the crotch are smoothed over ASM_LEG_SMOOTH px
   - the lines bend with the folds: the cloth's large-scale light (the master's shading on the trousers, blurred) moves each point along its
     slope, ASM_LEG_FOLD pxÂ² per unit of relative slope, at most ASM_LEG_FOLD_MAX px (as the atlas trial bent a jacket's)
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
/* Solved cloth positions (the owner's ask, 2026-11-14: "a 3D model of the model the painter uses"; his pick from comparisons on his
   pinstripe and windowpane jackets). Per master, on a computer: Meta's Sapiens-2B estimates the surface's normals, and every pixel's
   position on the cloth is solved by least squares so that its steps match the surface's own lengths (C:\code\watch-test\geo3d\flatten:
   flatten.py, flatten_pieces.py). Where the cloth turns away from the camera one pixel holds more cloth, so a pattern closes up there, as
   in a photo; on the owner's reference photo it predicts the sleeves' stripe spacing within about 4% where the painter's cylinders miss by
   8-9%. Two pictures per master on the worker (asmCmKey(kind, 'geo/u'), 'geo/v'): each value round((position + 1024) * 16) in two
   bytes, red high and green low; blue is the piece: 1 the jacket's body, 2 the shirt's front, 3 the trousers (shirt masters), 10..39 a
   sleeve's parts (upper arm and forearm in the painter's own frames, the forearm's lines shifted to meet the upper arm's at the crease),
   40..59 the lapels, 60.. the shirt's cuffs. job.geoU / job.geoV carry them; without them the painter is as before. */
const ASM_GEO_PX=2048;   // the maps' own size
const ASM_CM_AA=.7;   // a rib squeezed finer than where the cloth faces the camera is softened like a Gaussian pixel this wide (px; 0 = off)
/* the rib's softening factor at g2 (its cycles per pixel, squared) against g0 (where the cloth faces the camera), s = pi x the width: a
   Gaussian pixel's response; past ASM_CM_AA_CUT the positions jumped into another piece and the rib is left alone. The cut fades over
   ASM_CM_AA_FADE either side (2026-11-14, WebGL stage 2: a hard cut flipped between float64 here and float32 on the graphics chip; the
   factor there is about e^-21, so only a hair-thin band of pixels moves) */
const ASM_CM_AA_CUT=2.25,ASM_CM_AA_FADE=.05;
const asmAaK=(g2,g0,s)=>{const f=g2>g0*g0?Math.exp(-2*s*s*(g2-g0*g0)):1,t=(g2-ASM_CM_AA_CUT+ASM_CM_AA_FADE)/(2*ASM_CM_AA_FADE);return t<=0?f:t>=1?1:f+(1-f)*t};
async function asmGeoPrep(job,P){if(!job.geoU||!job.geoV)return null;
  // decoded at their own size: a resampled picture would blend the two bytes of a value and the pieces' ids
  const G=ASM_GEO_PX,NG=G*G,du=(await asmData(job.geoU,G)).data,dv=(await asmData(job.geoV,G)).data,U=new Float32Array(NG),V=new Float32Array(NG),R=new Uint8Array(NG);
  for(let k=0;k<NG;k++){const j=4*k;R[k]=du[j+2];if(R[k]){U[k]=((du[j]<<8)|du[j+1])/16-1024;V[k]=((dv[j]<<8)|dv[j+1])/16-1024}}
  const S=P.S;if(S===G)return {U,V,R};
  // another painting size (the PC's 2880): each pixel takes the piece of the nearest map pixel and its position interpolated within
  // that piece, scaled with the picture
  const N=S*S,f=G/S,uv={U,V,R},U2=new Float32Array(N),V2=new Float32Array(N),R2=new Uint8Array(N);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const X=(x+.5)*f,Y=(y+.5)*f,q=Math.min(G-1,Math.floor(Y))*G+Math.min(G-1,Math.floor(X)),k=y*S+x;R2[k]=R[q];
    if(R[q]){const c=asmUvAt(uv,G,q,X,Y);U2[k]=c[0]/f;V2[k]=c[1]/f}}
  return {U:U2,V:V2,R:R2}}
/* a point's solved cloth position (X, Y in the picture), from the four pixel centres around it that belong to the same piece */
function asmUvAt(uv,S,k,X,Y){const x=X-.5,y=Y-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,r=uv.R[k];let su=0,sv=0,sw=0;
  for(let j=0;j<2;j++)for(let i=0;i<2;i++){const xx=x0+i,yy=y0+j;if(xx<0||yy<0||xx>=S||yy>=S)continue;const q=yy*S+xx;if(uv.R[q]!==r)continue;const w=(i?fx:1-fx)*(j?fy:1-fy);su+=w*uv.U[q];sv+=w*uv.V[q];sw+=w}
  return sw>1e-6?[su/sw,sv/sw]:[uv.U[k],uv.V[k]]}
/* a trousers pixel's [across, along]: across is cloth from the fly (left of it negative), along the row, both moved with the folds */
function asmLegsAt(G,X,Y,k){const y=Math.max(G.y0,Math.min(G.y1,Math.floor(Y))),xf=G.xf[y],s=X<xf?0:1,t=Math.abs(X-xf),co=G.co[2*y+s],R=G.R[2*y+s],Q=.95,q=(t-co)/R;
  const u=q>Q?co+R*(Math.asin(Q)+(q-Q)/Math.sqrt(1-Q*Q)):q<-Q?co+R*(-Math.asin(Q)+(q+Q)/Math.sqrt(1-Q*Q)):co+R*Math.asin(q);
  return [(s?u:-u)+(k!=null?G.du[k]/16:0),Y+(k!=null?G.dv[k]/16:0)]}
/* (2026-11-14) filtered tile reads. A tile is about 256 texels a repeat and a repeat is often 10 px of the picture, so the points a pixel
   is read at (2x2 or 3x3) lie many texels apart and each took one bilinear texel: fine figures shimmered and squeezed cloth aliased.
   asmCmMips: the tile halved ASM_CM_MIPS times (box averages; kept per tile). asmCmRead: the n x n points of one pixel (U, V in repeats, row
   by row) -> their mean colour in o, each point read from the level whose texels are as far apart as the points are (the larger of the
   steps across and down, in texels; no level below ASM_CM_LOD0 texels a step, where the reads are exactly as before; blended between two
   levels, so the level never jumps). asm-gl.js reads the same levels (asmGlAtlas, tileRead) */
const ASM_CM_MIPS=4,ASM_CM_LOD0=2,asmCmMipM=new WeakMap(),ASM_CM_T3=[0,0,0];
function asmCmMips(T){const c0=T.t||T.c;let m=asmCmMipM.get(c0);if(m)return m;m=[{c:c0,TW:T.TW,TH:T.TH}];
  for(let L=1;L<=ASM_CM_MIPS;L++){const p=m[L-1],tw=Math.max(1,p.TW>>1),th=Math.max(1,p.TH>>1),d=new Float32Array(3*tw*th),fx=p.TW/tw,fy=p.TH/th;
    for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const x0=Math.floor(x*fx),x1=Math.max(x0+1,Math.floor((x+1)*fx)),y0=Math.floor(y*fy),y1=Math.max(y0+1,Math.floor((y+1)*fy));let r=0,g=0,b=0,n=0;
      for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const s=3*(yy*p.TW+xx);r+=p.c[s];g+=p.c[s+1];b+=p.c[s+2];n++}const q=3*(y*tw+x);d[q]=r/n;d[q+1]=g/n;d[q+2]=b/n}
    m.push({c:d,TW:tw,TH:th})}
  asmCmMipM.set(c0,m);return m}
function asmCmRead(T,U,V,n,o){const N=n*n,m=n-1,ax=Math.abs(U[m]-U[0]),ay=Math.abs(U[n*m]-U[0]),bx=Math.abs(V[m]-V[0]),by=Math.abs(V[n*m]-V[0]);
  const fp=Math.max((ax>ay?ax:ay)*T.TW,(bx>by?bx:by)*T.TH)/m;let lod=fp>ASM_CM_LOD0?Math.log2(fp/ASM_CM_LOD0):0;o[0]=o[1]=o[2]=0;
  if(!(lod>0)){for(let i=0;i<N;i++)asmCmAt(T,U[i],V[i],o)}
  else{if(lod>ASM_CM_MIPS)lod=ASM_CM_MIPS;const M=asmCmMips(T),l0=Math.floor(lod),f=lod-l0,A=M[l0],B=M[l0<ASM_CM_MIPS?l0+1:l0],t=ASM_CM_T3;t[0]=t[1]=t[2]=0;
    for(let i=0;i<N;i++){asmCmAt(A,U[i],V[i],o);asmCmAt(B,U[i],V[i],t)}o[0]=o[0]*(1-f)+t[0]*f;o[1]=o[1]*(1-f)+t[1]*f;o[2]=o[2]*(1-f)+t[2]*f}
  o[0]/=N;o[1]/=N;o[2]/=N}
function asmCmAt(T,u,v,o){const x=(u-Math.floor(u))*T.TW-.5,y=(v-Math.floor(v))*T.TH-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,c=T.t||T.c,TW=T.TW,TH=T.TH;
  const ix0=(x0+TW)%TW,ix1=(x0+1+TW)%TW,iy0=(y0+TH)%TH,iy1=(y0+1+TH)%TH;
  for(let q=0;q<3;q++)o[q]+=(c[3*(iy0*TW+ix0)+q]*(1-fx)+c[3*(iy0*TW+ix1)+q]*fx)*(1-fy)+(c[3*(iy1*TW+ix0)+q]*(1-fx)+c[3*(iy1*TW+ix1)+q]*fx)*fy}
/* the picture: the master with every garment painted, at the job's size, then at 2048 as a JPEG data URL */
/* the masters' colour-free parts are kept: one on a phone (2048: about 80 MB each), all four on the computer's pre-build (2880),
   where looks of several masters come one after another and each part took about 10 s to work out again */
/* (the computer's pre-build, job.diskCache) a master's colour-free part is also saved in this browser's IndexedDB, so a restart reads it
   back in a few seconds instead of working it out again (about 15 s a master at 2880). Its key carries the source of the functions that
   make it, so a change to how it is worked out never reads an old one; a master's older parts are deleted when a new one is saved. */
/* the one rule for random cloth details (2026-11-14, the WebGL port, asm-gl.js): every random detail of the painting goes through asmH32,
   a cell's two integer coordinates hashed in 32-bit integer maths (Math.imul and >>> 0, which a shader's uint multiply reproduces bit for
   bit), and a detail read at a cloth position goes through asmCellV, which also fades a cell's value into its neighbour's within
   ASM_CELL_FADE of the cell's edge: the position comes out of float64 maths here and float32 on the graphics chip, and where the two land
   either side of a cell edge a hard cell flipped (the twill's fleck: up to 8 levels on 13-18 of 4.2 M pixels on the owner's iPhone);
   faded, the value moves by a hair instead. asm-gl.js writes the same two in GLSL (asmGlHashGlsl); a later cloth's random detail uses
   them too, so the two painters keep agreeing */
const ASM_CELL_FADE=.02;   // of a cell, each side of an edge (the value is half each cell's at the edge itself)
const asmH32=(i,j,a,b)=>(Math.imul(i|0,a)^Math.imul(j|0,b))>>>0;
/* the cell value (asmH32 % m, 0..m-1, as a float) at cloth position (u, v) in cells, faded over cell edges */
function asmCellV(u,v,a,b,m){const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,F=ASM_CELL_FADE;
  const di=fu<F?-1:fu>1-F?1:0,dj=fv<F?-1:fv>1-F?1:0,h00=asmH32(i,j,a,b)%m;if(!di&&!dj)return h00;
  const wu=di<0?(F-fu)/(2*F):di>0?(fu-1+F)/(2*F):0,wv=dj<0?(F-fv)/(2*F):dj>0?(fv-1+F)/(2*F):0;
  return (h00*(1-wu)+(asmH32(i+di,j,a,b)%m)*wu)*(1-wv)+((asmH32(i,j+dj,a,b)%m)*(1-wu)+(asmH32(i+di,j+dj,a,b)%m)*wu)*wv}
/* a wrapping T x T texture r read at (u, v) in texels: the texel's value, faded into its neighbour's within ASM_CELL_FADE of its edge as
   asmCellV does (2026-11-14, WebGL stage 2: the linen's threads read at a cloth position) */
function asmCellT(r,T,u,v){const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,F=ASM_CELL_FADE,at=(a,b)=>r[(((b%T)+T)%T)*T+(((a%T)+T)%T)];
  const di=fu<F?-1:fu>1-F?1:0,dj=fv<F?-1:fv>1-F?1:0,h00=at(i,j);if(!di&&!dj)return h00;
  const wu=di<0?(F-fu)/(2*F):di>0?(fu-1+F)/(2*F):0,wv=dj<0?(F-fv)/(2*F):dj>0?(fv-1+F)/(2*F):0;
  return (h00*(1-wu)+at(i+di,j)*wu)*(1-wv)+(at(i,j+dj)*(1-wu)+at(i+di,j+dj)*wu)*wv}
const asmCmHash=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(36)};
/* (2026-11-14 audit) every function and constant the painting reads, so a change to any of them changes the keys by itself: a picture's
   key carries asmCmCodeSig (the job, the setup and the painting: asmCmJob, asmCmPrep, asmCmBuild and everything they call in assemble.js
   and asm-color.js) and the kept setup's key asmCmSrcSig (asmCmPrep and asmCmLightPrep with theirs). ASM_CM_PAINTV was bumped by hand
   and three changes shipped without it. tests/asmcode.test.js reads both files and fails when something these functions reach is
   missing from a list. Not in them: draw.js's drawings (fabricDef) that tiles are made from, and the cloth's own readings (in asmCmSig). */
const asmCmCode=()=>[ASM_CR,asmCrWants,asmCrFind,asmCrTile,asmCrTile1,ASM_CU,asmCuDark,asmCuFine,asmCuWants,asmCuPatch,asmCuWrap,asmCuTile,asmCuTile1,ASM_CM_FOLD_MAX,ASM_CM_FOLD_Y,asmCmFoldW,asmCmMp,ASM_CM_MIPS,ASM_CM_LOD0,asmCmMips,asmCmRead,ASM_CM_MAT,asmCmMat,ASM_TIE_LIT,asmTieLit,ASM_CM_FOLD_KEEP,asmCmFinish,asmCmFinPrep,ASM_CM_FIN,asmCmWk,ASM_CM_WLIGHT,ASM_CM_COLLAR,ASM_CM_GLOW,ASM_CM_WINK,ASM_CM_FOLD,ASM_CM_CUFF_STEP,ASM_CM_CUFF_PX,ASM_CELL_FADE,asmH32,asmCellV,asmCmSetup,ASM_CM_AA,ASM_CM_AA_CUT,ASM_CM_AA_FADE,asmAaK,asmCellT,asmTubePartQ,asmTq,asmTqn,asmTqr,ASM_GEO_PX,asmGeoPrep,asmUvAt,ASM_BAR_AT,ASM_BAR_LEN,ASM_BAR_MM,ASM_CLOSEUP_MM,ASM_CM_BG_SHADOW,ASM_CM_BTN,ASM_CM_BTN_MIX,ASM_CM_BTN_PEARL,ASM_CM_HAND_R,ASM_CM_HAND_STRAY,ASM_CM_HAND_LIT,ASM_CM_JACKET,
  ASM_CM_KINDS,ASM_CM_LIGHT,ASM_CM_LOOK,ASM_CM_RIM,ASM_CM_SOFT,ASM_CM_U16,ASM_CREASE_DEG,ASM_FLOW,ASM_FORE_K,ASM_HB_AMP,ASM_HB_BREAK,ASM_HB_COL_LIFT,ASM_HB_FLECK,ASM_HB_FLOAT,
  ASM_HB_FLOATL,ASM_HB_GRAIN,ASM_HB_MM,ASM_HB_MOTTLE,ASM_HB_PBRK,ASM_HB_RIB,ASM_HB_SHIRT_Y,ASM_HB_SNAP,ASM_HB_SOFT,ASM_HB_THIN,ASM_HB_TR,ASM_HB_YARN,ASM_KNIT_ACROSS,
  ASM_LEG_BLEND,ASM_LEG_FOLD,ASM_LEG_FOLD_MAX,ASM_LEG_HAND,ASM_LEG_K,ASM_LEG_SMOOTH,ASM_LIN,ASM_LINE_PX,ASM_METAL,ASM_MICRO,ASM_MICRO_KINDS,ASM_PAISLEY_ACROSS,ASM_PX_MM,
  ASM_SHIRT_MM,ASM_SIZE,ASM_SLEEVE_FLOW,ASM_STRIPE,ASM_STRIPE_PX,ASM_SUITV,ASM_TEX_MIN_MM,ASM_TIEV,ASM_TIE_FIG_MAX,ASM_TIE_SHEEN_MIN,ASM_TIE_SHEEN_Y,ASM_TIE_TEX_MAX,
  ASM_TR_CAP,ASM_TUBE_K,ASM_TWEED,ASM_TWILL,asmAreas,asmBarDraw,asmBarRgb,asmBodyFlow,asmClothOf,asmCmAssets,asmCmAt,asmCmBlur,asmCmBtnCol,asmCmBuild,asmCmButtons,
  asmCmCanvas,asmCmHandEdge,asmCmItems,asmCmJob,asmCmKind,asmCmLightPrep,asmCmPrep,asmCmRefit,asmCmRoute,asmCmTile,asmData,asmFlowAt,asmHbCw,asmHbShirt,asmHbShirtLook,
  asmImg,asmJpeg,asmKnitTile,asmLegsAt,asmLegsPrep,asmLinen,asmLinenTile,asmMicroGrid,asmMicroKind,asmMicroTex,asmMotif,asmPaisleyTile,asmPolyAt,asmRepeatPx,
  asmSleeveFlow,asmSleeveSegs,asmStripeCount,asmSuitBands,asmSuitSig,asmSuitTex,asmSuitTweed,asmSuitTwill,asmSuitWeave,asmTexMm,asmTieFor,asmTieSheenK,asmTieSig,
  asmTieTile,asmTubeAt,asmTubePart,asmTubeRaw,asmTubeTabs,asmTweedTex,asmTweedTile,asmTwillTex,asmWeave];
const asmCmPrepCode=()=>[ASM_CM_FOLD_KEEP,ASM_CM_CUFF_PX,ASM_CM_CUFF_STEP,ASM_CM_FOLD,ASM_CM_GLOW,ASM_CM_COLLAR,ASM_CM_HAND_R,ASM_CM_HAND_STRAY,ASM_CM_HAND_LIT,ASM_CM_U16,ASM_CM_KINDS,ASM_CM_LIGHT,ASM_CM_LOOK,ASM_CM_RIM,ASM_CREASE_DEG,ASM_FLOW,ASM_FORE_K,ASM_LEG_BLEND,ASM_LEG_FOLD,ASM_LEG_FOLD_MAX,
  ASM_LEG_HAND,ASM_LEG_K,ASM_LEG_SMOOTH,ASM_LIN,ASM_PX_MM,ASM_SIZE,ASM_SLEEVE_FLOW,asmBodyFlow,asmCmBlur,asmCmHandEdge,asmCmLightPrep,asmCmPrep,asmCmRefit,
  asmImg,asmLegsPrep,asmPolyAt,asmSleeveFlow,asmSleeveSegs,asmTubePart,asmTubeRaw,asmTubeTabs];
/* (2026-11-14) asmData, the image decoder, is not in asmCmPrepCode: the Web Worker swaps in its own (asm-worker.js: createImageBitmap on an
   OffscreenCanvas, the same pixels), so the page and the worker computed different setup keys, and a setup kept or downloaded on the page
   (the computer's shared setups, asmCmSetupFetch) was never found by the worker that paints. It stays in asmCmCode (pictures' keys are
   made on the page only) */
const asmCmCodeText=list=>list.map(v=>typeof v==='function'?String(v):JSON.stringify(v,(k,x)=>typeof x==='function'?String(x):x instanceof Set||x instanceof Map?[...x]:ArrayBuffer.isView(x)?Array.from(x):x)).join('|');
let asmCmSrc=null,asmCmCodeH=null;
const asmCmSrcSig=()=>asmCmSrc||(asmCmSrc=asmCmHash(asmCmCodeText(asmCmPrepCode())));
const asmCmCodeSig=()=>asmCmCodeH||(asmCmCodeH=asmCmHash(asmCmCodeText(asmCmCode())));
function asmCmDb(){return new Promise((ok,no)=>{const q=indexedDB.open('dw-asm-prep',1);q.onupgradeneeded=()=>q.result.createObjectStore('p');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function asmCmDiskGet(k){try{const db=await asmCmDb();return await new Promise(ok=>{const q=db.transaction('p').objectStore('p').get(k);q.onsuccess=()=>{ok(q.result||null);db.close()};q.onerror=()=>{ok(null);db.close()}})}catch{return null}}
async function asmCmDiskPut(k,P,prefix){try{const db=await asmCmDb();await new Promise(ok=>{const t=db.transaction('p','readwrite'),st=t.objectStore('p');
    const q=st.getAllKeys();q.onsuccess=()=>{for(const x of q.result||[])if(String(x).startsWith(prefix)&&x!==k)st.delete(x);st.put(P,k)};t.oncomplete=()=>{db.close();ok()};t.onerror=t.onabort=()=>{db.close();ok()}})}catch(e){console.warn('could not save the master',e)}}
/* a master's colour-free part, packed for keeping: its large arrays (the zones' shares and light, the sleeves' cellsâ€¦) side by side and
   gzipped (80 MB -> about 5 MB: mostly zeros and smooth light), the rest as it is; the master's own pixels (M) are left out and decoded
   again from its photo (about 0.2 s). -> {meta, gz} or null (no CompressionStream: nothing is kept) */
const ASM_CM_PACKV=2,ASM_CM_BIG=65536;   // 2: with the lighting (P.lx, 16-bit)
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
/* (2026-11-14) seating the figure in the room, on the finished picture (8-bit, either painter's): the figure's outline was a hard,
   stepped cut against a blurred room. Within ASM_CM_FIN.band px of the outline each pixel is softened over its 3x3 neighbours (soft) and
   a figure pixel takes a little of the room's colour from just beyond the outline (wrap: light from behind bends round an edge); and the
   room, a smooth blurred plate beside grainy cloth and photographed hands, gets the same fine grain (grain, levels). The outline's
   pixels and where each looks for the room are worked out once per master in a session (hit.fin) */
const ASM_CM_FIN={band:3,soft:.55,wrap:.12,reach:9,grain:1.1};
function asmCmFinPrep(P){const {S,N,A}=P;if(!A.background)return null;const F=ASM_CM_FIN,sc=S/2048,R=Math.max(1,Math.round(F.band*sc)),bg=new Float32Array(N);for(let k=0;k<N;k++)bg[k]=A.background[k]/255;
  const d=(2*R+1)*(2*R+1),b1=asmCmBlur(bg,S,R),R2=Math.max(2,Math.round(F.reach*sc)),d2=(2*R2+1)*(2*R2+1),b2=asmCmBlur(bg,S,R2),I=[],T=[],W=[];
  for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){const k=y*S+x,v=b1[k]/d;if(v<.02||v>.98)continue;
    // toward the room: up the slope of the wide blur, ASM_CM_FIN.reach px away (kept inside the picture)
    let gx=b2[k+1]-b2[k-1],gy=b2[k+S]-b2[k-S];const gl=Math.hypot(gx,gy);let t=k;if(gl>0){const tx=Math.min(S-1,Math.max(0,Math.round(x+gx/gl*R2))),ty=Math.min(S-1,Math.max(0,Math.round(y+gy/gl*R2)));t=ty*S+tx}
    I.push(k);T.push(bg[t]>.9?t:k);W.push((1-bg[k])*Math.min(1,b2[k]/d2*2))}
  return {I:Int32Array.from(I),T:Int32Array.from(T),W:Float32Array.from(W)}}
function asmCmFinish(o,hit){const P=hit.P,S=P.S,N=P.N,F=ASM_CM_FIN;if(!P.A.background)return;const fin=hit.fin||(hit.fin=asmCmFinPrep(P));if(!fin)return;
  const I=fin.I,n=I.length,out=new Uint8ClampedArray(3*n);
  for(let i=0;i<n;i++){const k=I[i],j=4*k,t=4*fin.T[i],w=F.wrap*fin.W[i];
    for(let q=0;q<3;q++){let s=0;for(let dy=-S;dy<=S;dy+=S)for(let dx=-1;dx<=1;dx++)s+=o[j+4*(dy+dx)+q];let v=o[j+q]+F.soft*(s/9-o[j+q]);if(w>0&&fin.T[i]!==k)v+=w*(o[t+q]-v);out[3*i+q]=v}}
  for(let i=0;i<n;i++){const j=4*I[i];o[j]=out[3*i];o[j+1]=out[3*i+1];o[j+2]=out[3*i+2]}
  if(F.grain){const B=P.A.background;for(let k=0;k<N;k++){const a=B[k];if(!a)continue;const g=F.grain*a/255*((asmH32(k,k>>>9,2246822519,3266489917)+asmH32(k+31,k>>>5,2654435761,7))/4294967296-1)*2,j=4*k;o[j]+=g;o[j+1]+=g;o[j+2]+=g}}}
/* the master's colour-free part for a job, kept in memory (asmCmMem) and on disk, with its solved cloth positions: {key, P, lx, uv, gk};
   shared by the CPU painter below and the graphics chip's (asm-gl.js) */
async function asmCmSetup(job){const key=job.cm+'|'+job.mk+'|'+job.mt+'|'+(job.rev||'')+'|'+job.size,   // (rev: every record's date: a mask uploaded again is a new setup)
keep=1;   // (2026-11-14 audit) one master in memory everywhere: the PC pre-build gives each pool worker one master's looks, and a switch
            // reads the kept setup back (it kept four at 2880 in each of up to 16 workers: several GB)
  if(!asmCmMem||!asmCmMem.list)asmCmMem={list:[]};let hit=asmCmMem.list.find(e=>e.key===key);
  if(!hit){while(asmCmMem.list.length>=keep)asmCmMem.list.shift();const dk=job.cm+'|v'+ASM_CMV+'|'+asmCmSrcSig()+'|z'+ASM_CM_PACKV+'|'+key;
    // (2026-11-13) on every device, phones included: kept packed (asmCmPack, about 5 MB a master); a phone used to work it out again at
    // every start and every change of master (about 23 s at phone speed); read back it is about 0.6 s
    const disk=job.diskCache!==false&&typeof indexedDB!=='undefined';let P=disk?await asmCmUnpack(await asmCmDiskGet(dk),job):null;
    // (2026-11-14) the lighting's master-only part (asmCmLightPrep) is worked out with the setup and kept in it (P.lx), packed with it
    if(!P){P=await asmCmPrep(job);if(job.look!==false||P.lm)P.lx=asmCmLightPrep(P);P.lm=null;if(disk)asmCmPack(P).then(x=>x&&asmCmDiskPut(dk,x,job.cm+'|'))}   // saved while the picture is painted
    hit={key,P,lx:P.lx||null};asmCmMem.list.push(hit)}
  // the master's solved cloth positions (asmGeoPrep), decoded once per master and maps (kept beside the setup, not packed with it: about
  // 36 MB of floats that don't compress, and the maps decode in well under a second)
  const gk=job.geoU?job.gt||'1':'';if(hit.gk!==gk){hit.uv=gk?await asmGeoPrep(job,hit.P):null;hit.gk=gk}
  return hit}
async function asmCmBuild(job){const hit=await asmCmSetup(job);
  // (2026-11-14) a look the graphics chip covers (asm-gl.js asmGlCovers) is painted there, about ten times faster and within 2 levels
  // of the picture below; anything else, no WebGL2, a lost context or the switch off (job.gl false) is painted here as before
  if(job.gl!==false&&typeof asmGlTry==='function'){const r=await asmGlTry(job,hit);if(r)return r}
  const t0=performance.now(),P=hit.P,S=P.S,N=P.N,L=ASM_LIN,M=P.M,A=P.A,names=P.names,geo=P.geo,tg=P.tieGeo,ls=S/ASM_SIZE,o=new Uint8ClampedArray(4*N);
  // the background picture at this size (kept while the same picture and size come back)
  let BG=null;if(job.bg&&P.bgShadow){const bk=job.bgt+'|'+S;if(!asmCmMem.bg||asmCmMem.bg.k!==bk)asmCmMem.bg={k:bk,d:(await asmData(job.bg,S)).data};BG=asmCmMem.bg.d}
  const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},hexLin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
  const SU=new Float64Array(9),SV=new Float64Array(9);   // one pixel's read points (asmCmRead)
  const WALL=hexLin('#E6E2DC'),KEEP=new Set(['skin','watch','buckle','dark']),CLEAN=248;
  // the cloth look (ASM_CM_LOOK; job.look false leaves it out): per garment its lift and how much bolder its weave is drawn
  const LK=job.look===false?null:ASM_CM_LOOK,GARZ={jacket:1,waistcoat:1,shirt:1,trousers:1},lum=v=>.2126*v[0]+.7152*v[1]+.0722*v[2],lb=[0,0,0];let SUITTW=1;
  // the lighting (ASM_CM_LIGHT) on the jacket, waistcoat, shirt and tie; its master-only part kept with the master's setup
  const LI=ASM_CM_LIGHT,WIN=LI.win*(job.light?ASM_CM_WINK:1),LZ={jacket:1,waistcoat:1,shirt:1,tie:1,trousers:1},LXP=LK?(hit.lx||(hit.lx=P.lx=asmCmLightPrep(P))):null;
  const lxF=(z,k,x,y,e)=>{let f=1;const a=LXP.ao[z];if(a){let v=a[k];if(z==='jacket'&&LXP.aob&&geo&&!geo.seg[k])v=Math.max(v,LXP.aob[k]);f*=1-LI.ak*v/ASM_CM_U16}
    f*=1+WIN*(e.look?LI.wd:1)*(1-2*x/S);
    if(z==='tie'&&LXP.tl&&LXP.tl[y]>=0){const w=LXP.tr[y]-LXP.tl[y];if(w>4){const t=(x-LXP.tl[y])/w;f*=1-LI.te*Math.pow(Math.abs(t-.5)*2,3)}}return f};
  const lxPost=(c,z,k,x,y,s)=>{let h=0;const sl=Math.min(s,1.3);if(z==='jacket'&&LXP.rim)h+=LI.rim*LXP.rim[k]/ASM_CM_U16*sl;
    if(z==='tie'&&LXP.tl&&LXP.tl[y]>=0){const w=LXP.tr[y]-LXP.tl[y];if(w>4){const u=((x-LXP.tl[y])/w-LI.tp)/LI.tsw;h+=LI.ts*tieK()*Math.exp(-u*u)*sl*asmTieLit(s)}}c[0]+=h;c[1]+=h;c[2]+=h;
    const d=Math.min(1,Math.max(0,1-s/.85)),l=Math.min(1,Math.max(0,(s-.95)/.5))*(1-x/S),y0=lum(c);
    c[0]*=1+LI.warm*d*.9-LI.cool*l*.5;c[1]*=1+LI.warm*d*.15;c[2]*=1-LI.warm*d*.9+LI.cool*l*1.2;const y1=lum(c);if(y1>0){const f=y0/y1;c[0]*=f;c[1]*=f;c[2]*=f}
    const h1=asmH32(k,k>>>7,2246822519,3266489917)/4294967296,h2=asmH32(k+977,k>>>3,2654435761,1)/4294967296,g=1+LI.grain*(h1+h2-1);c[0]*=g;c[1]*=g;c[2]*=g};
  let TIEK=null;const tieK=()=>TIEK!=null?TIEK:(TIEK=asmTieSheenK(cl.tie&&cl.tie.flat?lum(cl.tie.flat):1)*(cl.tie&&cl.tie.mp?cl.tie.mp[1]:1));   // the tie's sheen follows its own brightness (asmTieSheenK)
  const lookOf=f=>{const mx=Math.max(f[0],f[1],f[2]),mn=Math.min(f[0],f[1],f[2]),sat=mx>0?(mx-mn)/mx:0,y=lum(f);
    return {lift:LK.ymin*(1-LK.chroma*Math.min(1,sat/.7)),boost:1+LK.dk*Math.max(0,1-y/LK.dy)}};
  const lookBase=(b,e)=>{lb[0]=b[0];lb[1]=b[1];lb[2]=b[2];const y=lum(lb);if(y<e.look.lift){const d=e.look.lift-y;lb[0]+=d;lb[1]+=d;lb[2]+=d}
    const m=Math.max(lb[0],lb[1],lb[2]);if(m>LK.cmax){const f=LK.cmax/m;lb[0]*=f;lb[1]*=f;lb[2]*=f}return lb};
  const lookAfter=(c,s,z,x,y,plain,tw,bo)=>{
    if(plain&&LK.grain&&z!=='shirt'){const u=x/ls,v=y/ls,h=asmH32(Math.floor((u+v)/2),Math.floor(v/3),73856093,19349663)%1024/512-1;   // (pixel cells: whole numbers at a phone's size, the same on the graphics chip)
      tw=1+LK.grain*bo*(.6*Math.cos(2*Math.PI*(u+v)/4)+.5*h);c[0]*=tw;c[1]*=tw;c[2]*=tw}
    const t=Math.min(1,Math.max(0,(s-LK.s0)/(LK.s1-LK.s0))),sp=LK.sheen*t*t*(3-2*t)*(z==='shirt'?.25:1)*Math.max(0,1+LK.sk*(tw-1));c[0]+=sp;c[1]+=sp;c[2]+=sp;
    for(let q=0;q<3;q++){let v=c[q]<=0?0:Math.pow(c[q],1/2.2);v=v+LK.toe*Math.pow(1-v,3)-LK.sh*Math.pow(v,4);c[q]=Math.pow(Math.max(0,v),2.2)}};
  // a jacket pixel's [across, along] (px): a sleeve's tube, a lapel's own axis, the body's stripe flow, or upright
  let ZC='';   // the zone being painted: a trousers pixel follows the legs (asmLegsAt)
  const UV=hit.uv||null;   // solved cloth positions (asmGeoPrep), by piece: 1 the jacket's body, 2 the shirt's front, 3 the trousers, 10.. below
  const uvAt=(k,X,Yv)=>{if(UV&&UV.R[k]){const r=UV.R[k];
      if(r===3&&ZC==='trousers'){const c=asmUvAt(UV,S,k,X,Yv);return P.legs?[c[0]+P.legs.du[k]/16,c[1]+P.legs.dv[k]/16]:c}
      if(r===1&&geo&&geo.flow&&geo.gar==='jacket'&&!geo.seg[k]&&(ZC==='jacket'||ZC==='waistcoat')){const c=asmUvAt(UV,S,k,X,Yv);return asmFlowAt(geo.flow,c[0],c[1])}
      if(r===2&&ZC==='shirt'&&!(geo&&geo.seg[k]))return asmUvAt(UV,S,k,X,Yv);
      // the pieces solved in the painter's own frames (flatten_pieces.py): sleeve parts 10..39 (the jacket's, or on the shirt masters the
      // shirt's), lapels 40..59, the shirt's cuffs on the jacket masters 60..79 (its front in the V is 2, above); the tie, 80 and 81, is
      // read by the tie's own painting
      if(r>=10&&r<40&&(ZC==='jacket'||ZC==='waistcoat'||(ZC==='shirt'&&geo&&geo.gar==='shirt')))return asmUvAt(UV,S,k,X,Yv);
      if(r>=40&&r<60&&(ZC==='jacket'||ZC==='waistcoat'))return asmUvAt(UV,S,k,X,Yv);
      if(r>=60&&r<80&&ZC==='shirt')return asmUvAt(UV,S,k,X,Yv)}
    if(ZC==='trousers'&&P.legs)return asmLegsAt(P.legs,X,Yv,k);
    if(!geo)return [X,Yv];const si=geo.seg[k],g=geo.segs[si];if(g&&g.parts)return asmTubeAt(g,X,Yv);
    if(si&&g&&g.cs!=null)return [(X-g.cx)*g.cs+(Yv-g.cy)*g.sn,(Yv-g.cy)*g.cs-(X-g.cx)*g.sn];
    if(geo.flow&&geo.gar==='jacket')return asmFlowAt(geo.flow,X,Yv);
    return [X,Yv]};
  const cl={};for(const [z,c] of Object.entries(job.cloth||{})){const e={flat:hexLin(c.hex)};
    if(c.suit)e.suit=c.suit;else if(c.tie&&tg){e.tie=c.tie;e.rep=(c.tie.motif?2:1)*tg.bw/Math.max(.5,c.tie.across||1.5);e.repv=e.rep*c.tie.TH/c.tie.TW}
    else if(c.tile){e.tile=c.tile;e.rep=c.tile.mm*P.pxmm;e.repv=e.rep*c.tile.TH/c.tile.TW}
    // a striped jacket is left as it was; a dark cloth takes the full look; a lighter one its folds' lighting only
    if(LK&&LZ[z]){const mp=asmCmMp(P,z,c,e.flat);if(mp[0]!==1||mp[1]!==1||mp[2]!==1)e.mp=mp}   // the folds' depth by the cloth's darkness, the material's folds and highlights (asmCmMp)
    if(LK&&GARZ[z]){if(c.suit&&c.suit.k!=null)e.keep=1;else if(lum(e.flat)<LK.dark)e.look=lookOf(e.flat);else e.light=1}
    // trousers fill a large, evenly lit area on the shirt masters: the full look's bolder weave read as diagonal lines down each leg and
    // its sheen turned the window-side leg a blotchy grey beside a black one, so trousers of any colour take the folds' lighting only
    if(z==='trousers'&&e.look){delete e.look;e.light=1}cl[z]=e}
  const lin2=Object.values(cl).some(e=>e.suit&&e.suit.linen)?asmLinenTile():null,td2=Object.values(cl).some(e=>e.suit&&e.suit.tweed)?asmTweedTile():null,cm=[0,0,0],tmp=[0,0,0];
  // the app's suit cloth (asmSuitPaintTex) with this picture's coordinates and light
  // (a suit's cloth on a shirt master's trousers, 2026-11-13: that master is framed wider, so its cloth is drawn at the master's own scale)
  const lsc=ls*(ASM_CM_KINDS[job.cm]?ASM_CM_KINDS[job.cm].pxmm:1);
  const suitCol=(T,k,x,y,sh,out)=>{const rep=T.mm*ASM_PX_MM*lsc,repv=rep*T.TH/T.TW;cm[0]=cm[1]=cm[2]=0;
    for(let a=0;a<2;a++)for(let e=0;e<2;e++){const c=uvAt(k,x+(e+.5)/2,y+(a+.5)/2),q=2*a+e;SU[q]=c[0]/rep;SV[q]=c[1]/repv}asmCmRead(T,SU,SV,2,cm);cm[0]*=4;cm[1]*=4;cm[2]*=4;
    if(T.slv!=null&&geo&&geo.gar==='jacket'&&(geo.seg[k]===1||geo.seg[k]===2))for(let q=0;q<3;q++)cm[q]=4*T.c[q]+(cm[q]-4*T.c[q])*T.slv;   // a sleeve's calmer detail (ASM_CU.hbs)
    let tw=1;const C=T.cloth,hb=C&&(C.kind==='herringbone'||C.kind==='twill');
    // the stripe's breakup: each stripe (si, counted across) its own strength along its length (smoothly between cells blen long); the
    // stripe's index faded into its neighbour's within ASM_CELL_FADE of a repeat's edge (half way between two stripes, on the ground), so a
    // position a hair either side of the edge (float64 here, float32 on the graphics chip) gives the same pixel (2026-11-14, WebGL stage 2)
    if(T.k!=null){const c=uvAt(k,x+.5,y+.5),su=c[0]/rep-T.loff+.5,si=Math.floor(su),fu=su-si,F=ASM_CELL_FADE,di=fu<F?-1:fu>1-F?1:0,wu=di<0?(F-fu)/(2*F):di>0?(fu-1+F)/(2*F):0,
        tt=c[1]/(T.blen*lsc),j0=Math.floor(tt),f0=tt-j0,fs=f0*f0*(3-2*f0),
        h1=(i,j)=>asmH32(i,j,374761393,668265263)%2048/1024-1,hh=j=>di?h1(si,j)*(1-wu)+h1(si+di,j)*wu:h1(si,j),nz=Math.max(0,1+T.brk*(hh(j0)*(1-fs)+hh(j0+1)*fs));
      for(let q=0;q<3;q++)cm[q]=4*T.g[q]+(cm[q]-4*T.g[q])*T.k*nz;sh=T.gain*Math.pow(sh,T.gam)}
    if(T.linen&&lin2||T.tweed&&td2||hb){const c=uvAt(k,x+.5,y+.5);
      // a tweed (asmSuitPaintTex's rule): sampled upright in the picture, its flecks in the second colour
      if(T.tweed&&td2){const u=Math.floor(x/lsc),v=Math.floor(y/lsc),li=(((v%td2.T)+td2.T)%td2.T)*td2.T+(((u%td2.T)+td2.T)%td2.T);sh*=td2.r[li];
        if(T.c2&&td2.f[li])for(let q=0;q<3;q++)cm[q]=cm[q]*(1-T.fmix)+4*T.c2[q]*T.fmix}
      else if(T.linen&&lin2)sh*=asmCellT(lin2.r,lin2.T,c[0]/lsc,c[1]/lsc);   // its threads' light, faded at each texel's edge (asmCellT)
      else{const pitch=(C.pitch||4)*lsc,cw=C.cw?C.cw*lsc:0,off=C.off?C.off*lsc:0,col=C.kind==='herringbone'&&cw?Math.floor((c[0]-off)/cw):0,dir=col&1?-1:1;
        // (asmSuitPaintTex's rules: a plain twill averages its rib over four points a pixel, its own fleck, and a two-colour twill's ribs lean toward its second colour)
        const boOf=cc=>C.brk&&(cc&1)?C.brk*pitch:C.pbrk?C.pbrk*pitch*Math.floor(cc/2):0;   // the herringbone's break (ASM_HB_BREAK): without it the ribs met at each column edge and read as jagged V's
        const ribAt=cc=>{const d=cc&1?-1:1,b=boOf(cc);let p=0;if(C.ss){for(let a=0;a<2;a++)for(let e=0;e<2;e++){const s=uvAt(k,x+(e+.5)/2,y+(a+.5)/2);p+=Math.cos(2*Math.PI*(s[1]+d*s[0]+b)/pitch)/4}}else p=Math.cos(2*Math.PI*(c[1]+d*c[0]+b)/pitch);return p};
        // (2026-11-14) ribs squeezed finer than the picture can show are softened (ASM_CM_AA): where the solved cloth positions turn a
        // twill's 4 px ribs to 2 px or less they beat into moire, here and again when a phone shrinks the picture. The rib's cycles per
        // pixel (g) come from the positions half a pixel either side; the rib is scaled by a Gaussian pixel's response at g against its
        // response where the cloth faces the camera (g0 = 1/pitch), so the facing cloth is exactly as before and only squeezed ribs fade
        // (asmAaK; a step into another piece reads as a huge jump: left alone)
        const aa=ASM_CM_AA&&job.aa!==false,as=Math.PI*(typeof job.aa==='number'?job.aa:ASM_CM_AA);   // (a number in job.aa: the bench's strength)
        const a1=aa?uvAt(k,x+1,y+.5):null,a0=aa?uvAt(k,x,y+.5):null,b1=aa?uvAt(k,x+.5,y+1):null,b0=aa?uvAt(k,x+.5,y):null;
        const aaOf=cc=>{if(!aa)return 1;const d=cc&1?-1:1,gx=((a1[1]-a0[1])+d*(a1[0]-a0[0]))/pitch,gy=((b1[1]-b0[1])+d*(b1[0]-b0[0]))/pitch;return asmAaK(gx*gx+gy*gy,1/pitch,as)};
        let ph=ribAt(col),fk=asmCellV((c[0]+dir*c[1])/2,c[1]/3,73856093,19349663,1024);   // the fleck's cell (2 x 3 px along the rib), faded at its edges (asmCellV)
        if(C.soft&&cw){const fx=(c[0]-off)/cw-col,de=Math.min(fx,1-fx)*cw,sw=C.soft*ls;if(de<sw){const nb=fx<.5?col-1:col+1,d2=nb&1?-1:1,b2=boOf(nb),w=.5-.5*de/sw;
          ph=ph*(1-w)+Math.cos(2*Math.PI*(c[1]+d2*c[0]+b2)/pitch)*w}}
        ph*=aaOf(col);
        // the yarn breakup and raised floats of column cc: each rib (r, counted across the slant) its own strength along its length; the rib's
        // index faded into its neighbour's within ASM_CELL_FADE of its edge (half way between two ribs, at the rib's trough), as asmCellV
        // does, so float64 here and float32 on the graphics chip give the same pixel (2026-11-14, WebGL stage 3)
        const ynOf=cc=>{const d=cc&1?-1:1,q=(c[1]+d*c[0]+boOf(cc))/pitch+.5,r=Math.floor(q),fq=q-r,F=ASM_CELL_FADE,di=fq<F?-1:fq>1-F?1:0,wq=di<0?(F-fq)/(2*F):di>0?(fq-1+F)/(2*F):0,al=c[1]-d*c[0];
          const one=r0=>{let y=1;if(C.yarn){const t=al/(pitch*1.7),s0=Math.floor(t),f=t-s0,fs=f*f*(3-2*f),hv=s=>((asmH32(r0,s,2246822519,3266489917)^asmH32(cc,0,668265263,0))>>>0)%1024/1024;
              y=1-C.yarn/2+C.yarn*(hv(s0)*(1-fs)+hv(s0+1)*fs)}
            if(C.float){const hf=asmH32(r0,cc,374761393,668265263)%4096/4096,s=al/(pitch*C.floatL)+hf*7,f=s-Math.floor(s),sn=Math.sin(Math.PI*f);y*=1-C.float+C.float*sn*sn}return y};
          return di?one(r)*(1-wq)+one(r+di)*wq:one(r)};
        let yn=C.yarn||C.float?ynOf(col):1;
        // a herringbone's column (2026-11-14, WebGL stage 2): within ASM_CELL_FADE of a column's edge its rib and fleck fade into the next
        // column's (half each at the edge), so float64 here and float32 on the graphics chip landing either side of it give the same pixel
        // (stage 3: the yarn breakup and floats too)
        if(cw){const fx=(c[0]-off)/cw-col,F=ASM_CELL_FADE,nb=fx<F?col-1:fx>1-F?col+1:col;
          if(nb!==col){const w=fx<F?(F-fx)/(2*F):(fx-1+F)/(2*F),d2=nb&1?-1:1;ph=ph*(1-w)+ribAt(nb)*aaOf(nb)*w;fk=fk*(1-w)+asmCellV((c[0]+d2*c[1])/2,c[1]/3,73856093,19349663,1024)*w;
            if(C.yarn||C.float)yn=yn*(1-w)+ynOf(nb)*w}}
        // the fine yarn grain: cells 0.6 mm square, faded at their edges (asmCellV)
        if(C.grain){const gs=.6*ASM_PX_MM*ls,gv=asmCellV(c[0]/gs,c[1]/gs,2654435761,2246822519,4096)/4096;yn*=1-C.grain+2*C.grain*Math.pow(gv,1.6)}
        let mo=0;if(C.mottle){const vn=(u,v)=>{const i0=Math.floor(u),j0=Math.floor(v),fu=u-i0,fv=v-j0,su=fu*fu*(3-2*fu),sv=fv*fv*(3-2*fv),hh=(i,j)=>asmH32(i,j,1597334677,3812015801)%2048/1024-1;
          return (hh(i0,j0)*(1-su)+hh(i0+1,j0)*su)*(1-sv)+(hh(i0,j0+1)*(1-su)+hh(i0+1,j0+1)*su)*sv},m1=4*ASM_PX_MM*ls,m2=11*ASM_PX_MM*ls;mo=C.mottle*(.55*vn(c[0]/m1,c[1]/m1)+.45*vn(c[0]/m2+17.3,c[1]/m2+5.1))}
        const pr=C.thin?2*Math.pow((ph+1)/2,2)-.75:ph;
        tw=1+mo+C.amp*pr*yn+(C.fleck!=null?C.fleck:.08)*(fk/512-1);if(C.c2){const m=C.mix*(1+ph)/2;for(let e=0;e<3;e++)cm[e]=cm[e]*(1-m)+4*C.c2[e]*m}}}
    // a small woven figure (asmMicroTex: houndstooth, sharkskin, birdseye, nailhead): its thread grid along the cloth (uvAt), 4x4 points
    // a pixel (the cloth's direction from the pixel's own and its neighbours' positions: three lookups, not sixteen)
    if(T.wv){const W=T.wv,tp=W.thr*ASM_PX_MM*lsc,p0=uvAt(k,x,y),px=uvAt(k,x+1,y),py=uvAt(k,x,y+1),N=W.N;let v=0;
      for(let a=0;a<4;a++)for(let e=0;e<4;e++){const fx=(e+.5)/4,fy=(a+.5)/4,u=p0[0]+(px[0]-p0[0])*fx+(py[0]-p0[0])*fy,w=p0[1]+(px[1]-p0[1])*fx+(py[1]-p0[1])*fy;
        v+=asmCellT(W.g,N,u/tp,w/tp)}v/=16;   // (the thread crossing faded into its neighbour within ASM_CELL_FADE of its edge: WebGL stage 3)
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
      if(z==='background'&&BG){const s=1-ASM_CM_BG_SHADOW*P.bgShadow[k]/255,h=(asmH32(k,0,2654435761,0)%1024)/1024;
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
      // (2026-11-14) a striped jacket takes the lighting too (contact shadows, the window, lit edges, grain): only the cloth look's bolder
      // weave broke its lines, and without any lighting it was a flat dark shape beside every other jacket
      let s=P.shade[z][k]/40000;const e=cl[z],lit=!!(LXP&&e&&LZ[z]);let base;
      if(e&&e.mp)s=(s<1?Math.pow(s,e.mp[0]):1+(s-1)*e.mp[1])*e.mp[2];   // the material: its folds' depth below the lit level, its highlights above (asmCmMat)
      if(e&&e.light&&LXP.sm[z]){const sl=LXP.smb[z][k]/40000;if(sl>.01)s=LXP.sm[z]*Math.pow(sl/LXP.sm[z],LK.lgam)*(s/sl)}   // a lighter cloth: its large folds deeper
      if(lit)s*=lxF(z,k,x,y,e);
      if(e&&e.suit){SUITTW=1;suitCol(e.suit,k,x,y,s,c);
        if(SUITTW!==1&&SUITTW>0){const f=Math.pow((1+asmCmWk(s)*(SUITTW-1))/SUITTW,2.2);c[0]*=f;c[1]*=f;c[2]*=f}   // the weave by the light (ASM_CM_WLIGHT)
        if(e.look){const L=e.look,tw=1+L.boost*(SUITTW-1);if(L.boost>1){const f=Math.max(0,1+(L.boost-1)*2.2*(SUITTW-1));c[0]*=f;c[1]*=f;c[2]*=f}   // a dark cloth's weave, bolder than life
          const yy=lum(c),fl=L.lift*Math.pow(Math.min(s,1),LK.fp);if(yy<fl){const d=(fl-yy)*Math.max(0,1+LK.wk*(tw-1));c[0]+=d;c[1]+=d;c[2]+=d}
          lookAfter(c,s,z,x,y,false,tw,L.boost)}
        if(lit)lxPost(c,z,k,x,y,s);
        r+=a*c[0];g+=a*c[1];b+=a*c[2];continue}
      if(z==='background')base=WALL;else if(!e){base=tmp;tmp[0]=L[M[j]];tmp[1]=L[M[j+1]];tmp[2]=L[M[j+2]]}else if(!e.tile&&!e.tie)base=e.flat;
      else{base=tmp;tmp[0]=tmp[1]=tmp[2]=0;
        if(z==='tie'&&e.tie&&tg){const tr=UV&&(UV.R[k]===80||UV.R[k]===81);
          // solved: the knot's (80) and the blade's (81) positions are in the painter's frames (the blade's lean, a quarter turn more in
          // the knot) and scaled so the count across the blade is the reading's; the pattern's own angle turns them
          const th=tr?(e.tie.ang||0):tg.lean+(e.tie.ang||0)+(y<tg.yk?Math.PI/2:0),cs=Math.cos(th),sn=Math.sin(th);
          for(let aa=0;aa<2;aa++)for(let ee=0;ee<2;ee++){let X=x+(ee+.5)/2,Yv=y+(aa+.5)/2;if(tr){const c=asmUvAt(UV,S,k,X,Yv);X=c[0];Yv=c[1]}const q=2*aa+ee;SU[q]=(X*cs+Yv*sn)/e.rep;SV[q]=(Yv*cs-X*sn)/e.repv}asmCmRead(e.tie,SU,SV,2,tmp)}
        else if(z==='jacket'||z==='waistcoat'||(z==='shirt'&&geo&&geo.gar==='shirt')||(z==='shirt'&&UV&&(UV.R[k]===2||(UV.R[k]>=60&&UV.R[k]<80)))){const n=e.tile.fine?3:2;for(let aa=0;aa<n;aa++)for(let ee=0;ee<n;ee++){const uv=uvAt(k,x+(ee+.5)/n,y+(aa+.5)/n),q=n*aa+ee;SU[q]=uv[0]/e.rep;SV[q]=uv[1]/e.repv}asmCmRead(e.tile,SU,SV,n,tmp)}
        else if(z==='shirt'&&e.tile.fine){const ci=P.cuff?P.cuff[k]:255,th=ci<255?P.cuffAng[ci]||0:0,cs=Math.cos(th),sn=Math.sin(th);   // a woven shirt: 3x3 points a pixel (a 3 mm weave is ~10 px; one point skipped its steps)
          for(let aa=0;aa<3;aa++)for(let ee=0;ee<3;ee++){const X=x+(ee+.5)/3,Yv=y+(aa+.5)/3,q=3*aa+ee;SU[q]=(X*cs+Yv*sn)/e.rep;SV[q]=(Yv*cs-X*sn)/e.repv}asmCmRead(e.tile,SU,SV,3,tmp)}
        else if(z==='shirt'&&P.cuff){const ci=P.cuff[k];rot(x+.5,y+.5,ci<255?P.cuffAng[ci]||0:0,e,tmp)}
        else if(z==='trousers'&&P.legs){for(let aa=0;aa<2;aa++)for(let ee=0;ee<2;ee++){const uv=uvAt(k,x+(ee+.5)/2,y+(aa+.5)/2),q=2*aa+ee;SU[q]=uv[0]/e.rep;SV[q]=uv[1]/e.repv}asmCmRead(e.tile,SU,SV,2,tmp)}   // read trousers: along the legs
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
  if(LK&&BG)asmCmFinish(o,hit);   // the figure seated in the room (ASM_CM_FIN)
  let img=new ImageData(o,S,S);
  if(S>ASM_SIZE){const big=asmCmCanvas(S,S);big.getContext('2d').putImageData(img,0,0);const sm=asmCmCanvas(ASM_SIZE,ASM_SIZE),x=sm.getContext('2d',{willReadFrequently:true});
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(big,0,0,ASM_SIZE,ASM_SIZE);img=x.getImageData(0,0,ASM_SIZE,ASM_SIZE)}
  const ms=Math.round(performance.now()-t0);return {url:await asmJpeg(img),gl:false,ms}}   // (gl, ms: which painter and how long, for Settings' line, asmGlNote)

/* ---- faster masters on a phone (2026-11-14, the owner's ask: loading a master was the slow part; measured on a simulated phone, CPU 4x
   slower and 4G: a master's first use took about 15.5 s, 6.1 s downloading its 16 files, 7.5 s working out its setup, 1.9 s painting;
   with the setup kept, 2.6 s). Three things, none of which touches the functions in the pictures' code fingerprints:
   1. warming: once Today's look is shown and the days ahead are fetched (asmAhead), the masters the coming looks use are downloaded and
      set up in the background, one at a time (asmCmWarm), so a day nobody built paints in about 2.6 s even the first time
   2. the computer shares each master's setup at the phone's size (npm run assemble: asmCmSetupBlob, uploaded with PUT /blob); a phone
      that lacks it downloads it (asmCmSetupFetch, in asmCmGet) instead of working it out
   3. a 2048 copy of each master (the masters are 2880, the computer's size): a phone downloads it instead (asmCmMasterCopy, about half
      the bytes), kept under the master's own key with the master's date, so keys and setups are the same as from the 2880 master ---- */
/* the master part of a job (asmCmJob's, without the outfit's cloth): enough to work out or read back the master's setup */
function asmCmBaseJob(kind,size){const K=ASM_CM_KINDS[kind];if(!K)return null;const keys=asmCmAssets(kind);if(keys.some(k=>!renders[k]))return null;
  const masks={};for(const z of K.zones)masks[z]=renders[asmCmKey(kind,'mask/'+z)].img;
  const parts={};for(const s of ['sleeveR','sleeveL','lapelR','lapelL']){const r=renders[asmCmKey(kind,'part/'+s)];if(r)parts[s]=r.img}
  const gks=asmCmGeoKeys(kind),geo=gks.length?{geoU:renders[gks[0]].img,geoV:renders[gks[1]].img,gt:renders[gks[0]].t+'.'+renders[gks[1]].t}:{};
  return {cm:kind,size:size||self.ASM_CM_SIZE||ASM_SIZE,mk:keys[0],mt:renders[keys[0]].t,rev:asmCmHash(keys.filter(k=>!gks.includes(k)).map(k=>renders[k].t||0).join(',')),master:renders[keys[0]].img,masks,parts,...geo}}
/* the kept setup's IndexedDB key, as asmCmSetup writes it (tests/masterspeed.test.js checks the two agree) */
const asmCmDiskKey=job=>job.cm+'|v'+ASM_CMV+'|'+asmCmSrcSig()+'|z'+ASM_CM_PACKV+'|'+job.cm+'|'+job.mk+'|'+job.mt+'|'+(job.rev||'')+'|'+job.size;
const asmCmSetupKey=dk=>asmKey('cmsetup/'+asmCmHash(dk));
/* a packed setup as bytes: "DWS1", the length of the JSON part, the JSON part (the disk key it is for, its unpacked size, and the packed
   description, small typed arrays written out), then the gzipped arrays */
const asmB64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const asmUnB64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
const ASM_TA={Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,Uint8ClampedArray};
function asmCmBlobOf(dk,rec){const enc=x=>{if(ArrayBuffer.isView(x))return {__ta:[x.constructor.name,asmB64(new Uint8Array(x.buffer,x.byteOffset,x.byteLength))]};
    if(x instanceof Map)return {__map:[...x].map(([k,v])=>[enc(k),enc(v)])};if(x instanceof Set)return {__set:[...x].map(enc)};
    if(typeof x==='number'&&!Number.isFinite(x))return {__num:String(x)};if(Array.isArray(x))return x.map(enc);
    if(x&&typeof x==='object'){const o={};for(const [k,v] of Object.entries(x))if(v!==undefined)o[k]=enc(v);return o}return x};
  const head=new TextEncoder().encode(JSON.stringify({dk,n:rec.n,meta:enc(rec.meta)})),gz=new Uint8Array(rec.gz),out=new Uint8Array(8+head.length+gz.length);
  out.set([68,87,83,49]);new DataView(out.buffer).setUint32(4,head.length);out.set(head,8);out.set(gz,8+head.length);return out}
function asmCmBlobRead(buf,dk){try{const u=new Uint8Array(buf);if(u.length<8||u[0]!==68||u[1]!==87||u[2]!==83||u[3]!==49)return null;const len=new DataView(u.buffer,u.byteOffset).getUint32(4);
    const h=JSON.parse(new TextDecoder().decode(u.subarray(8,8+len)));if(h.dk!==dk)return null;
    const dec=x=>{if(Array.isArray(x))return x.map(dec);if(x&&typeof x==='object'){if(x.__ta){const b=asmUnB64(x.__ta[1]),T=ASM_TA[x.__ta[0]];return T?new T(b.buffer,0,b.byteLength/T.BYTES_PER_ELEMENT):null}
        if(x.__map)return new Map(x.__map.map(([k,v])=>[dec(k),dec(v)]));if(x.__set)return new Set(x.__set.map(dec));if(x.__num)return Number(x.__num);
        const o={};for(const [k,v] of Object.entries(x))o[k]=dec(v);return o}return x};
    return {meta:dec(h.meta),n:h.n,gz:u.slice(8+len).buffer}}catch(e){console.warn('could not read the shared setup',e);return null}}
/* (the computer) the kind's setup at the phone's size, packed: {key, bytes} or null */
async function asmCmSetupBlob(kind,size){const job=asmCmBaseJob(kind,size||ASM_SIZE);if(!job)return null;const dk=asmCmDiskKey(job);
  const hit=await asmCmSetup({...job,diskCache:false});const rec=await asmCmPack(hit.P);return rec?{key:asmCmSetupKey(dk),dk,bytes:asmCmBlobOf(dk,rec)}:null}
/* (a phone) the shared setup for a job this device hasn't set up: downloaded and kept where asmCmSetup reads it. Not on the computer
   (it paints at 2880 and works out its own); asked once a session per setup */
const asmCmSetupTried=new Set();
async function asmCmSetupFetch(job){if(!job||(self.ASM_CM_SIZE||ASM_SIZE)>ASM_SIZE||typeof indexedDB==='undefined'||typeof workerBase!=='function')return false;
  const dk=asmCmDiskKey(job);if(await asmCmDiskGet(dk))return true;const k=asmCmSetupKey(dk);if(asmCmSetupTried.has(k))return false;asmCmSetupTried.add(k);
  const W=workerBase();if(!W)return false;
  try{const r=await fetch(new URL('blob?key='+k,W.url).href,{headers:{'x-app-token':W.tok},cache:'no-store'});if(!r.ok)return false;
    const rec=asmCmBlobRead(await r.arrayBuffer(),dk);if(!rec)return false;await asmCmDiskPut(dk,rec,job.cm+'|');return true}
  catch(e){console.warn('no shared setup',e);return false}}
/* (a phone) the 2048 copy of a master in place of the 2880 one, when the copy is of the master the manifest lists */
const asmCmCopyKey=kind=>asmCmKey(kind,'master2048'),asmCmCopySig=t=>'asm/cm-copy '+t;
async function asmCmMasterCopy(kind){const mk=asmCmKey(kind,'master');if(renders[mk]||(self.ASM_CM_SIZE||ASM_SIZE)>ASM_SIZE||typeof workerBase!=='function')return false;
  const t=asmCmMfNow().keys[mk],W=workerBase();if(!t||!W)return false;
  try{const r=await fetch(W.url+'?key='+asmCmCopyKey(kind),{headers:{'x-app-token':W.tok},cache:'no-store'});if(!r.ok)return false;const c=await r.json();
    if(!c||c.sig!==asmCmCopySig(t)||!/^data:image\//.test(c.img||''))return false;
    await keepRender(mk,{sig:c.sig,img:c.img,model:c.model||'copy',t},false);return true}catch(e){return false}}
/* (the computer) a master's 2048 copy for phones: {key, rec} */
async function asmCmMasterCopyRec(kind){const mk=asmCmKey(kind,'master'),m=renders[mk];if(!m)return null;const d=await asmData(m.img,ASM_SIZE);
  const c=document.createElement('canvas');c.width=d.width;c.height=d.height;c.getContext('2d').putImageData(d,0,0);
  return {key:asmCmCopyKey(kind),rec:{sig:asmCmCopySig(m.t),img:c.toDataURL('image/jpeg',.92),model:'copy',t:m.t}}}
/* (a phone) warming: the masters the coming looks use, downloaded and set up in the background, one at a time; not on a connection that
   asks to save data or a slow one; once a session per master */
const asmCmWarmed=new Set();let asmCmWarming=false;
async function asmCmWarm(looks){if(asmCmWarming||(self.ASM_CM_SIZE||ASM_SIZE)>ASM_SIZE||typeof indexedDB==='undefined')return 0;
  const cn=navigator.connection;if(cn&&(cn.saveData||/(^|-)2g$/.test(cn.effectiveType||'')))return 0;
  const kinds=[...new Set((looks||[]).map(o=>asmCmKind(o)).filter(k=>k&&!asmCmWarmed.has(k)))];if(!kinds.length)return 0;asmCmWarming=true;let n=0;
  try{for(const kind of kinds){if(document.hidden)break;asmCmWarmed.add(kind);if(!await asmCmGet(kind))continue;const job=asmCmBaseJob(kind);if(!job)continue;
      if(await asmCmDiskGet(asmCmDiskKey(job)))continue;await asmRun({...job,setupOnly:true},false);n++}}
  catch(e){console.warn('warming stopped',e)}finally{asmCmWarming=false}return n}

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
    await asmKeepOut(k,img,{stamp:asmStamp(o),t:Date.now()});showIf()}
  catch(e){console.warn('could not paint',e)}finally{asmBusy.delete(bk)}}
async function asmCmPrebuild(o){const kind=asmCmKind(o);if(!kind||!await asmCmGet(kind))return null;
  const img=await asmPhoto(o,true);return img?{key:asmOutKey(o),sig:asmPreSig(o),img}:null}
/* Settings → Outfit pictures → Advanced: how far the computer's pre-build (npm run assemble) has got, and "Painted plain".
   (2026-11-13: the on/off switch for the colour-coded masters is gone, and so is Photo tagging's "Shirt weaves", whose shirts are in
   "Painted plain" with the other pieces waiting for a reading) */
function asmCmUI(){const grp=$('#asm-group');if(!grp)return;let b=$('#cm-box');if(!b){b=document.createElement('div');b.id='cm-box';b.className='sgroup';grp.appendChild(b)}
  b.innerHTML=`<div class="slabel">Pictures ahead</div><p class="shelp" id="cm-status" role="status"></p>`;
  asmGapUI();asmCmStatus();if(typeof asmGlUI==='function')asmGlUI(b)}
/* the workdays of the next ASM_AHEAD days painted on a colour-coded master: how many looks, how many the computer has built (the
   worker's list, asmListGet: built pictures are uploaded under their look's key) and how many this phone holds; and when the list
   was read. The worker's list has no dates, so "checked" is when this phone asked, not when the computer last built */
let asmCmStatusRun=0;
async function asmCmStatus(){const el=$('#cm-status');if(!el)return;const run=++asmCmStatusRun;
  if(!workerBase()){el.textContent='';return}
  el.textContent='Looking at the coming days…';
  const L=await asmListGet(),T=todayDate(),seen=new Map();
  for(let i=0;i<ASM_AHEAD;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
    if(i%10===9)await new Promise(r=>setTimeout(r,0));if(run!==asmCmStatusRun)return;
    const o=planOn(d);if(!o||!asmCmUse(o))continue;const k=asmOutKey(o);if(!seen.has(k))seen.set(k,o)}
  if(run!==asmCmStatusRun||!$('#cm-status'))return;
  const n=seen.size,built=L?[...seen.keys()].filter(k=>L.has(k)).length:0,here=[...seen.values()].filter(o=>asmFor(o)).length;
  const mins=Math.round((Date.now()-asmListAt)/6e4),ago=mins<1?'just now':mins===1?'a minute ago':mins+' minutes ago';
  el.textContent=!n?`None of the workdays in the next ${ASM_AHEAD} days is painted on a colour-coded master.`:
    !L?`The next ${ASM_AHEAD} days have ${n} look${n===1?'':'s'} to paint; ${here} on this phone. The server couldn’t list its pictures just now, so how many the computer has built isn’t known.`:
    `Next ${ASM_AHEAD} days: ${built} of ${n} look${n===1?'':'s'} built on the computer${built<n?` (the other ${n-built} are painted on this phone when needed)`:''}; ${here} on this phone. Checked ${ago}.`}
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
