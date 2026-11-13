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
   A jacket worn without a tie has no master yet: such a day keeps a photo of its own.

   They are photo records on the worker (asmCmKey, put there by tools/asm-cm-upload.js), downloaded once like the other masters.
   A phone paints at 2048; the computer's pre-build (npm run assemble) sets ASM_CM_SIZE to 2880 and scales the picture to 2048.
   Settings → Realistic photos → Item photos: "Colour-coded masters" turns this off on a phone (localStorage asm_cm = '0'). */
const ASM_CMV=1;   // the colour-coded masters' version: in their keys and every picture's key
const ASM_CM_KINDS={
  suit:{zones:['jacket','tie','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  vest:{zones:['jacket','waistcoat','tie','background','skin','shirt','dark','watch'],sleeves:1,lapels:1,pxmm:1},
  'shirt-tie':{zones:['trousers','belt','tie','buckle','background','skin','shirt','dark','watch'],sleeves:1,lapels:0,pxmm:116/174},
  'shirt-open':{zones:['trousers','belt','buckle','background','skin','shirt','dark','watch'],sleeves:1,lapels:0,pxmm:116/174*1.05}};
// (pxmm: the shirt masters are framed wider; measured: the tie 116 px wide at 2048 against 174 on the suit master, the open collar's
// shirt about 5% wider again)
const asmCmKey=(kind,name)=>asmKey('cm'+ASM_CMV+'/'+kind+'/'+name);
const asmCmAssets=kind=>{const K=ASM_CM_KINDS[kind];if(!K)return [];return [asmCmKey(kind,'master'),...K.zones.map(z=>asmCmKey(kind,'mask/'+z)),
  ...(K.sleeves?['sleeveR','sleeveL'].map(s=>asmCmKey(kind,'part/'+s)):[]),...(K.lapels?['lapelR','lapelL'].map(s=>asmCmKey(kind,'part/'+s)):[])]};
const ASM_CM='asm_cm';   // localStorage: '0' = this phone puts pictures together the earlier way
const asmCmPref=()=>{try{return localStorage.getItem(ASM_CM)!=='0'}catch{return true}};
/* which master an outfit is painted on, or null (the earlier assembler, or the outfit's own photo) */
function asmCmKind(o){if(!o||!o.shirt||!asmCmPref())return null;
  if(o.top)return o.tie?(o.vest?'vest':'suit'):null;
  if(!o.bot||!o.belt)return null;   // the shirt masters show the trousers and the belt
  return o.tie?'shirt-tie':'shirt-open'}
/* the outfit's kind when its master is on this device (downloaded) */
const asmCmReady=o=>{const k=asmCmKind(o);return k&&renders[asmCmKey(k,'master')]?k:null};
/* the cloth of each garment, as it goes into the picture's key: a new colour, reading or drawing makes a new picture */
const ASM_CM_PAINTV=4;   // 2: jackets and trousers without a stripe or check reading are their colour; 3: a plain twill jacket has its ribs (asmTwillTex); 4: woven shirts at full swing, measured repeat, 3x3 points
/* a jacket whose weave the 2026-11-13 audit added (a herringbone, or an own pattern based on solid named twill): marked in its look's key,
   so only those looks are painted again (a new ASM_CM_PAINTV would repaint every look) */
const asmCmWeaveTag=(z,i)=>{if((z!=='jacket'&&z!=='waistcoat')||typeof asmSuitWeave!=='function'||!asmSuitTwill(i))return '';
  const w=asmSuitWeave(i);return w==='herringbone'?'/hb'+ASM_HB_MM+'-'+ASM_HB_AMP:patBase(i.pattern)!=='twill'?'/tw':''};
function asmCmSig(o){const k=asmCmKind(o);if(!k)return '';const it=asmCmItems(o,k),s=[k,'p'+ASM_CM_PAINTV];
  for(const z of Object.keys(it).sort()){const i=it[z];s.push(z+':'+colOf(i)+'/'+(i.pattern||'')+'/'+(typeof usableSett==='function'?settSig(usableSett(i)):'')+(i.patternSpec?'/ps'+fnv64(JSON.stringify([i.patternSpec.across,i.patternSpec.along])).slice(0,6):'')+(i.material?'/'+i.material:'')+asmCmWeaveTag(z,i))}
  if(o.clip&&k!=='vest'&&typeof asmBarSig==='function')s.push('bar:'+asmBarSig(o.clip));
  return s.join('|')}
const asmCmItems=(o,k)=>{const z={shirt:o.shirt};if(k==='suit'||k==='vest'){z.jacket=o.top;if(k==='vest')z.waistcoat=o.top}else{z.trousers=o.bot;z.belt=o.belt}if(o.tie&&k!=='shirt-open')z.tie=o.tie;return z};
const asmCmOutKey=o=>asmKey('out/cm'+ASM_CMV+'/'+fnv64(asmCmSig(o)));
const asmCmStamp=o=>{const k=asmCmKind(o);return k?asmCmAssets(k).reduce((t,key)=>Math.max(t,renders[key]&&renders[key].t||0),0):0};
/* bring the kind's master, masks and parts onto the device (true when all are here) */
async function asmCmGet(kind){const keys=asmCmAssets(kind);if(!keys.length)return false;if(!await asmGet(keys[0],true))return false;
  return (await Promise.all(keys.slice(1).map(k=>asmGet(k)))).every(Boolean)}

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
/* the job for asmCmBuild, or null when the kind's master or masks are not on the device */
async function asmCmJob(o){const kind=asmCmKind(o),K=ASM_CM_KINDS[kind];if(!K)return null;const keys=asmCmAssets(kind);if(keys.some(k=>!renders[k]))return null;
  const masks={};for(const z of K.zones)masks[z]=renders[asmCmKey(kind,'mask/'+z)].img;
  const parts={};for(const s of ['sleeveR','sleeveL','lapelR','lapelL']){const r=renders[asmCmKey(kind,'part/'+s)];if(r)parts[s]=r.img}
  const it=asmCmItems(o,kind),cloth={};
  for(const [z,i] of Object.entries(it)){if(!i)continue;const c={hex:colOf(i)};
    if(z==='tie'){const T=await asmTieFor(i);if(T&&T.c)c.tie={c:T.c,TW:T.TW,TH:T.TH,motif:T.motif,across:T.across,ang:T.ang}}
    else if((z==='jacket'||z==='waistcoat')&&(asmSuitBands(i)||(typeof asmSuitTwill==='function'&&asmSuitTwill(i))||(typeof asmSuitTweed==='function'&&asmSuitTweed(i)))){try{const T=typeof asmSuitTexFor==='function'?await asmSuitTexFor(i):await asmSuitTex(i);if(T)c.suit=T}catch(e){console.warn('suit cloth',e)}}   // a band reading, a plain twill (its ribs: asmTwillTex) or a tweed (asmTweedTex)
    // a jacket or trousers with no stripe or check reading (and not a plain twill jacket: above) is its colour: the swatch's drawing of
    // a fine weave, tiled over a whole jacket, was a field of dots and dashes (the owner's light grey twill)
    else if(z==='shirt'||(z==='trousers'&&(usableSett(i)||{}).bands)){const T=await asmCmTile(i,z==='shirt'?'shirt':'bot');if(T)c.tile=T}
    cloth[z]=c}
  return {cm:kind,size:self.ASM_CM_SIZE||ASM_SIZE,mk:keys[0],mt:renders[keys[0]].t,master:renders[keys[0]].img,masks,parts,cloth,
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
  const P={kind:job.cm,S,N,M,A,names,shade,keep,geo:null,tieGeo:null,cuff:null,cuffAng:[0],pxmm:ASM_PX_MM*S/ASM_SIZE*K.pxmm};
  // the sleeves and lapels: the jacket's (or on the shirt masters the shirt's; its body stays upright, the body's flow is a jacket's)
  const GAR=A.jacket?'jacket':A.shirt?'shirt':null,sm=[],lm=[];
  for(const s of ['sleeveR','sleeveL'])if(job.parts[s]){const d=(await asmData(job.parts[s],S)).data,m=new Uint8Array(N);for(let k=0;k<N;k++)m[k]=d[4*k]>127?1:0;sm.push(m)}
  for(const s of ['lapelR','lapelL'])if(job.parts[s]&&GAR==='jacket'){const d=(await asmData(job.parts[s],S)).data,m=new Uint8Array(N);for(let k=0;k<N;k++)m[k]=d[4*k]>127?1:0;lm.push({m,one:true})}
  if(GAR&&sm.length===2){const zj=new Uint8Array(N);for(let k=0;k<N;k++)zj[k]=A[GAR][k]>127?1:0;
    const sg=asmSleeveSegs([...sm,...lm],S,N);asmCmRefit(sg,sm,S,N);
    // the learned drift along sleeves (ASM_SLEEVE_FLOW) was fitted to the earlier master's arms: here it folds a hanging arm's stripes
    // back on themselves, so it is left out; tubes, the crease, cylinders and the forearm's scale stay
    for(const g of sg.segs)if(g.parts)for(const pp of g.parts)if(pp.fd){const n=pp.fd.D.length;pp.fd={D:new Float32Array(n),G:new Float32Array(n),k:pp.fd.k}}
    const seg=sg.seg;let todo=[];for(let k=0;k<N;k++)if(!seg[k]&&A[GAR][k]&&!zj[k])todo.push(k);   // the soft edge outside a part takes the part beside it
    for(let it=0;it<8&&todo.length;it++){const set=[],left=[];for(const k of todo){const x=k%S,v=(x>0&&seg[k-1])||(x<S-1&&seg[k+1])||(k>=S&&seg[k-S])||seg[k+S]||0;if(v)set.push(k,v);else left.push(k)}for(let q=0;q<set.length;q+=2)seg[set[q]]=set[q+1];todo=left}
    P.geo={seg,segs:sg.segs,flow:GAR==='jacket'?asmBodyFlow(zj,sm,S,S):null,gar:GAR}}
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
const asmCmSrcSig=()=>asmCmSrc||(asmCmSrc=asmCmHash([asmCmPrep,asmCmRefit,asmSleeveSegs,asmTubeTabs,asmSleeveFlow,asmBodyFlow,asmData].map(String).join('|')));
function asmCmDb(){return new Promise((ok,no)=>{const q=indexedDB.open('dw-asm-prep',1);q.onupgradeneeded=()=>q.result.createObjectStore('p');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function asmCmDiskGet(k){try{const db=await asmCmDb();return await new Promise(ok=>{const q=db.transaction('p').objectStore('p').get(k);q.onsuccess=()=>{ok(q.result||null);db.close()};q.onerror=()=>{ok(null);db.close()}})}catch{return null}}
async function asmCmDiskPut(k,P,prefix){try{const db=await asmCmDb();await new Promise(ok=>{const t=db.transaction('p','readwrite'),st=t.objectStore('p');
    const q=st.getAllKeys();q.onsuccess=()=>{for(const x of q.result||[])if(String(x).startsWith(prefix)&&x!==k)st.delete(x);st.put(P,k)};t.oncomplete=()=>{db.close();ok()};t.onerror=t.onabort=()=>{db.close();ok()}})}catch(e){console.warn('could not save the master',e)}}
async function asmCmBuild(job){const key=job.cm+'|'+job.mk+'|'+job.mt+'|'+job.size,keep=job.size>ASM_SIZE?4:1;
  if(!asmCmMem||!asmCmMem.list)asmCmMem={list:[]};let hit=asmCmMem.list.find(e=>e.key===key);
  if(!hit){while(asmCmMem.list.length>=keep)asmCmMem.list.shift();const dk=job.cm+'|v'+ASM_CMV+'|'+asmCmSrcSig()+'|'+key;
    let P=job.diskCache&&typeof indexedDB!=='undefined'?await asmCmDiskGet(dk):null;
    if(!P){P=await asmCmPrep(job);if(job.diskCache&&typeof indexedDB!=='undefined')await asmCmDiskPut(dk,P,job.cm+'|')}
    hit={key,P};asmCmMem.list.push(hit)}
  const P=hit.P,S=P.S,N=P.N,L=ASM_LIN,M=P.M,A=P.A,names=P.names,geo=P.geo,tg=P.tieGeo,ls=S/ASM_SIZE,o=new Uint8ClampedArray(4*N);
  const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)},hexLin=h=>{h=String(h).replace('#','');return [0,2,4].map(k=>L[parseInt(h.slice(k,k+2),16)||0])};
  const WALL=hexLin('#E6E2DC'),KEEP=new Set(['skin','watch','buckle','dark']),CLEAN=248;
  // a jacket pixel's [across, along] (px): a sleeve's tube, a lapel's own axis, the body's stripe flow, or upright
  const uvAt=(k,X,Yv)=>{if(!geo)return [X,Yv];const si=geo.seg[k],g=geo.segs[si];if(g&&g.parts)return asmTubeAt(g,X,Yv);
    if(si&&g&&g.cs!=null)return [(X-g.cx)*g.cs+(Yv-g.cy)*g.sn,(Yv-g.cy)*g.cs-(X-g.cx)*g.sn];return geo.flow&&geo.gar==='jacket'?asmFlowAt(geo.flow,X,Yv):[X,Yv]};
  const cl={};for(const [z,c] of Object.entries(job.cloth||{})){const e={flat:hexLin(c.hex)};
    if(c.suit)e.suit=c.suit;else if(c.tie&&tg){e.tie=c.tie;e.rep=(c.tie.motif?2:1)*tg.bw/Math.max(.5,c.tie.across||1.5);e.repv=e.rep*c.tie.TH/c.tie.TW}
    else if(c.tile){e.tile=c.tile;e.rep=c.tile.mm*P.pxmm;e.repv=e.rep*c.tile.TH/c.tile.TW}cl[z]=e}
  const lin2=Object.values(cl).some(e=>e.suit&&e.suit.linen)?asmLinenTile():null,td2=Object.values(cl).some(e=>e.suit&&e.suit.tweed)?asmTweedTile():null,cm=[0,0,0],tmp=[0,0,0];
  // the app's suit cloth (asmSuitPaintTex) with this picture's coordinates and light
  const suitCol=(T,k,x,y,sh,out)=>{const rep=T.mm*ASM_PX_MM*ls,repv=rep*T.TH/T.TW;cm[0]=cm[1]=cm[2]=0;
    for(let a=0;a<2;a++)for(let e=0;e<2;e++){const c=uvAt(k,x+(e+.5)/2,y+(a+.5)/2);asmCmAt(T,c[0]/rep,c[1]/repv,cm)}
    let tw=1;const C=T.cloth,hb=C&&(C.kind==='herringbone'||C.kind==='twill');
    if(T.k!=null){const c=uvAt(k,x+.5,y+.5),si=Math.floor(c[0]/rep-T.loff+.5),tt=c[1]/(T.blen*ls),j0=Math.floor(tt),f0=tt-j0,fs=f0*f0*(3-2*f0),
        hh=j=>((Math.imul(si|0,374761393)^Math.imul(j|0,668265263))>>>0)%2048/1024-1,nz=Math.max(0,1+T.brk*(hh(j0)*(1-fs)+hh(j0+1)*fs));
      for(let q=0;q<3;q++)cm[q]=4*T.g[q]+(cm[q]-4*T.g[q])*T.k*nz;sh=T.gain*Math.pow(sh,T.gam)}
    if(T.linen&&lin2||T.tweed&&td2||hb){const c=uvAt(k,x+.5,y+.5);
      // a tweed (asmSuitPaintTex's rule): sampled upright in the picture, its flecks in the second colour
      if(T.tweed&&td2){const u=Math.floor(x/ls),v=Math.floor(y/ls),li=(((v%td2.T)+td2.T)%td2.T)*td2.T+(((u%td2.T)+td2.T)%td2.T);sh*=td2.r[li];
        if(T.c2&&td2.f[li])for(let q=0;q<3;q++)cm[q]=cm[q]*(1-T.fmix)+4*T.c2[q]*T.fmix}
      else if(T.linen&&lin2){const u=Math.floor(c[0]/ls),v=Math.floor(c[1]/ls);sh*=lin2.r[(((v%lin2.T)+lin2.T)%lin2.T)*lin2.T+(((u%lin2.T)+lin2.T)%lin2.T)]}
      else{const pitch=4*ls,cw=C.cw?C.cw*ls:0,off=C.off?C.off*ls:0,col=C.kind==='herringbone'&&cw?Math.floor((c[0]-off)/cw):0,dir=col&1?-1:1,
          h=(Math.imul(Math.floor((c[0]+dir*c[1])/2)|0,73856093)^Math.imul(Math.floor(c[1]/3)|0,19349663))>>>0;
        // (asmSuitPaintTex's rules: a plain twill averages its rib over four points a pixel, its own fleck, and a two-colour twill's ribs lean toward its second colour)
        let ph=0;if(C.ss){for(let a=0;a<2;a++)for(let e=0;e<2;e++){const s=uvAt(k,x+(e+.5)/2,y+(a+.5)/2);ph+=Math.cos(2*Math.PI*(s[1]+dir*s[0])/pitch)/4}}else ph=Math.cos(2*Math.PI*(c[1]+dir*c[0])/pitch);
        tw=1+C.amp*ph+(C.fleck!=null?C.fleck:.08)*((h%1024)/512-1);if(C.c2){const m=C.mix*(1+ph)/2;for(let e=0;e<3;e++)cm[e]=cm[e]*(1-m)+4*C.c2[e]*m}}}
    const f=sh*Math.pow(Math.max(0,tw),2.2);out[0]=cm[0]/4*f;out[1]=cm[1]/4*f;out[2]=cm[2]/4*f};
  const rot=(X,Yv,th,e,out)=>{const c=Math.cos(th),s=Math.sin(th);out[0]=out[1]=out[2]=0;asmCmAt(e.tile||e.tie,(X*c+Yv*s)/e.rep,(Yv*c-X*s)/e.repv,out)};
  const c=[0,0,0];
  for(let k=0;k<N;k++){let r=0,g=0,b=0;const x=k%S,y=(k-x)/S,j=4*k;
    for(let zi=0;zi<names.length;zi++){const z=names[zi],a8=A[z][k];if(!a8)continue;const a=a8/255;
      if(KEEP.has(z)){const K=P.keep[z];let i=-1;if(a8<CLEAN){let lo=0,hi=K.I.length-1;while(lo<=hi){const m=(lo+hi)>>1,v=K.I[m];if(v===k){i=m;break}if(v<k)lo=m+1;else hi=m-1}}if(i<0){c[0]=L[M[j]];c[1]=L[M[j+1]];c[2]=L[M[j+2]]}else{c[0]=K.C[3*i];c[1]=K.C[3*i+1];c[2]=K.C[3*i+2]}
        if(c[1]>Math.max(c[0],c[2]))c[1]=Math.max(c[0],c[2]);   // the chroma-green wall left in a kept zone's edge (a green line along a fingertip)
        r+=a*c[0];g+=a*c[1];b+=a*c[2];continue}
      const s=P.shade[z][k]/40000,e=cl[z];let base;
      if(e&&e.suit){suitCol(e.suit,k,x,y,s,c);r+=a*c[0];g+=a*c[1];b+=a*c[2];continue}
      if(z==='background')base=WALL;else if(!e){base=tmp;tmp[0]=L[M[j]];tmp[1]=L[M[j+1]];tmp[2]=L[M[j+2]]}else if(!e.tile&&!e.tie)base=e.flat;
      else{base=tmp;tmp[0]=tmp[1]=tmp[2]=0;
        if(z==='tie'&&e.tie&&tg){const th=tg.lean+(e.tie.ang||0)+(y<tg.yk?Math.PI/2:0),cs=Math.cos(th),sn=Math.sin(th);
          for(let aa=0;aa<2;aa++)for(let ee=0;ee<2;ee++){const X=x+(ee+.5)/2,Yv=y+(aa+.5)/2;asmCmAt(e.tie,(X*cs+Yv*sn)/e.rep,(Yv*cs-X*sn)/e.repv,tmp)}tmp[0]/=4;tmp[1]/=4;tmp[2]/=4}
        else if(z==='jacket'||z==='waistcoat'||(z==='shirt'&&geo&&geo.gar==='shirt')){const n=e.tile.fine?3:2;for(let aa=0;aa<n;aa++)for(let ee=0;ee<n;ee++){const uv=uvAt(k,x+(ee+.5)/n,y+(aa+.5)/n);asmCmAt(e.tile,uv[0]/e.rep,uv[1]/e.repv,tmp)}tmp[0]/=n*n;tmp[1]/=n*n;tmp[2]/=n*n}
        else if(z==='shirt'&&e.tile.fine){const ci=P.cuff?P.cuff[k]:255,th=ci<255?P.cuffAng[ci]||0:0,cs=Math.cos(th),sn=Math.sin(th);   // a woven shirt: 3x3 points a pixel (a 3 mm weave is ~10 px; one point skipped its steps)
          for(let aa=0;aa<3;aa++)for(let ee=0;ee<3;ee++){const X=x+(ee+.5)/3,Yv=y+(aa+.5)/3;asmCmAt(e.tile,(X*cs+Yv*sn)/e.rep,(Yv*cs-X*sn)/e.repv,tmp)}tmp[0]/=9;tmp[1]/=9;tmp[2]/=9}
        else if(z==='shirt'&&P.cuff){const ci=P.cuff[k];rot(x+.5,y+.5,ci<255?P.cuffAng[ci]||0:0,e,tmp)}
        else asmCmAt(e.tile,(x+.5)/e.rep,(y+.5)/e.repv,tmp)}
      // above its usual brightness a cloth gains neutral light (a sheen), not more of its own colour
      if(s<=1){c[0]=base[0]*s;c[1]=base[1]*s;c[2]=base[2]*s}else{const yb=.2126*base[0]+.7152*base[1]+.0722*base[2];c[0]=base[0]+(s-1)*yb;c[1]=base[1]+(s-1)*yb;c[2]=base[2]+(s-1)*yb}
      r+=a*c[0];g+=a*c[1];b+=a*c[2]}
    const m=Math.max(r,g,b);if(m>1){const w=Math.min(1,(m-1)/m);r=r/m+(1-r/m)*w;g=g/m+(1-g/m)*w;b=b/m+(1-b/m)*w}   // past full brightness: toward white, keeping the hue
    o[j]=gam(r);o[j+1]=gam(g);o[j+2]=gam(b);o[j+3]=255}
  if(job.bar&&A.tie){const tm=new Uint8Array(N);for(let k=0;k<N;k++)tm[k]=A.tie[k]>127?1:0;asmBarDraw(o,tm,S,job.bar,null)}   // a tie clip, drawn as the earlier assembler draws it
  let img=new ImageData(o,S,S);
  if(S>ASM_SIZE){const big=asmCmCanvas(S,S);big.getContext('2d').putImageData(img,0,0);const sm=asmCmCanvas(ASM_SIZE,ASM_SIZE),x=sm.getContext('2d',{willReadFrequently:true});
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(big,0,0,ASM_SIZE,ASM_SIZE);img=x.getImageData(0,0,ASM_SIZE,ASM_SIZE)}
  return {url:await asmJpeg(img)}}

/* ---- Today: the colour-coded way of asmEnsure / asmPrebuildOne ---- */
async function asmCmEnsure(o,ahead){const kind=asmCmKind(o);if(!kind)return;if(asmFullWins(o)||asmFor(o))return;const bk='cm|'+comboKey(o);if(asmBusy.has(bk))return;asmBusy.add(bk);
  try{if(!await asmCmGet(kind)||asmFullWins(o))return;
    if(await asmGetPre(o)){const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)asmShow();return}
    const img=await asmPhoto(o,!ahead);if(!img)return;
    const k=asmOutKey(o),rec={img,stamp:asmStamp(o),t:Date.now()};asmOut[k]=rec;await metaPut('asm:out:'+k,rec);asmTrim();
    const cur=planFor()[key(sel)];if(cur&&comboKey(cur)===comboKey(o)&&!$('#today').hidden)asmShow()}
  catch(e){console.warn('could not paint',e)}finally{asmBusy.delete(bk)}}
async function asmCmPrebuild(o){const kind=asmCmKind(o);if(!kind||!await asmCmGet(kind))return null;
  const img=await asmPhoto(o,true);return img?{key:asmOutKey(o),sig:`asm/out/z${ASM_ZV}/${asmStamp(o)}`,img}:null}
/* Settings → Realistic photos → Item photos: the switch */
function asmCmUI(){const grp=$('#asm-group');if(!grp)return;let b=$('#cm-box');if(!b){b=document.createElement('div');b.id='cm-box';b.className='sgroup';grp.appendChild(b)}
  b.innerHTML=`<div class="slabel">Colour-coded masters</div><label class="srow">On this phone <select id="cfg-cm" onchange="asmCmSet(this.value)"><option value="on">On: every garment painted</option><option value="off">Off: as before</option></select></label>
    <div class="snote">Suit, waistcoat, shirt-and-tie and open-collar days are painted on their own master. A jacket worn without a tie keeps its own photo.</div>`;
  $('#cfg-cm').value=asmCmPref()?'on':'off'}
function asmCmSet(v){try{if(v==='off')localStorage.setItem(ASM_CM,'0');else localStorage.removeItem(ASM_CM)}catch{}asmOut={};asmTried.clear();refreshToday()}
