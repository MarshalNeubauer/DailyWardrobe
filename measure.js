/* Daily Wardrobe: photo tagging, measuring (split from tagging.js, Round B CR-2-17): white balance and white paper, the cloth's
   measured colour (a patterned cloth colour by colour), the close-up's sharpness, and the verdict on each colour with Claude's own
   signals. sRGB <-> linear is srgb.js's (srgbLin8, linSrgb8). */

/* ---- the light reading of a picture: white-balance gains from its brightest near-neutral pixels, whether such a white
   reference is there at all, and how bright it is once corrected (for the exposure of a close-up with white paper in it) ---- */
function wbRead(c,{strict=false}={}){
  const k=Math.min(1,200/Math.max(c.width,c.height)),w=Math.max(1,Math.round(c.width*k)),h=Math.max(1,Math.round(c.height*k)),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,w,h);const d=x.getImageData(0,0,w,h).data,n=w*h,lums=new Float32Array(n);
  for(let i=0,j=0;i<d.length;i+=4,j++)lums[j]=(d[i]+d[i+1]+d[i+2])/3;
  const sorted=[...lums].sort((a,b)=>a-b),thr=Math.max(150,sorted[Math.floor(n*.95)]-12),p25=sorted[Math.floor(n*.25)];let R=0,G=0,B=0,m=0;
  for(let i=0,j=0;i<d.length;i+=4,j++){if(lums[j]<thr)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
    if(mx>=250&&mn>=250)continue;   // clipped highlights say nothing about the light
    if((mx-mn)/mx<.35){R+=d[i];G+=d[i+1];B+=d[i+2];m++}}   // a white wall under tungsten light reads about 30% saturated
  if(m<n*.005||m>n*.85)return {gains:null,ref:false,refLum:0,frac:m/n};
  // a white reference is one solid area clearly brighter than the cloth (a wall, a white shirt under a tie, paper); the light
  // slubs and highlights of a khaki or beige cloth are scattered specks only a little brighter, and taking them for white would
  // turn the cloth grey
  const isRef=new Uint8Array(n);for(let i=0,j=0;i<d.length;i+=4,j++){if(lums[j]<thr)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);if(!(mx>=250&&mn>=250)&&(mx-mn)/mx<.35)isRef[j]=1}
  let solid=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const j=y*w+x;if(isRef[j]&&isRef[j-1]+isRef[j+1]+isRef[j-w]+isRef[j+w]>=3)solid++}
  if(solid<m*.5||(R+G+B)/3/m<1.15*p25)return {gains:null,ref:false,refLum:0,frac:m/n};
  const st=strict?wbSolidStats(d,lums,isRef,w,h,(R+G+B)/3/m):null;
  if(st&&!wbSolidOk(st))return {gains:null,ref:false,refLum:0,frac:m/n,st};
  const g=(R+G+B)/3/m,cl=v=>Math.min(1.18,Math.max(.85,v)),gains={r:cl(g/(R/m)),g:cl(g/(G/m)),b:cl(g/(B/m))};
  const sig=Math.max(...Object.values(gains).map(v=>Math.abs(v-1)))>=.02;
  return {gains:sig?gains:null,ref:true,refLum:(R/m*gains.r+G/m*gains.g+B/m*gains.b)/3,frac:m/n,...(st?{st}:{})}}
const wbGains=c=>wbRead(c).gains;
/* a close-up's white reference must be a real patch of paper (or a white shirt's front), not the cloth's own light parts (2026-11-14,
   the new-user walkthrough: "white paper" was found in close-ups of a light blue shirt, cream trousers, a white/blue stripe and a check
   blazer, and their exposure was corrected the wrong way). Three tests on the reference pixels (isRef, at most 200 px):
   - a solid core: what is left after taking 2 px off every edge covers WB_CORE (1%) of the picture (a check's light lines, a stripe's
     narrow white and a fold's highlight are thinner than that);
   - set apart in lightness: the reference is WB_GAP (28 levels) brighter than the cloth's median, and few pixels (under WB_TRANS, 7%)
     lie between half way and the reference (paper's edge is a thin line; a light cloth's own highlights shade into it).
   (Its hue is not tested: under warm light white paper leans the same way as a brown cloth.) Each of the walkthrough's false references
   fails the core, the gap or the in-between test. */
const WB_CORE=.01,WB_GAP=28,WB_TRANS=.07;
function wbSolidStats(d,lums,isRef,w,h,refLum){const n=w*h;let core=0;
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){let all=1;for(let j=-2;j<=2&&all;j++)for(let i=-2;i<=2;i++)if(!isRef[(y+j)*w+x+i]){all=0;break}core+=all}
  const cl=[];let ra=0,rb=0,rn=0;const ca=[],cb=[];
  for(let j=0;j<n;j++){if(isRef[j]){const l=rgbLab(d[4*j],d[4*j+1],d[4*j+2]);ra+=l[1];rb+=l[2];rn++}else{cl.push(lums[j]);if(j%3===0){const l=rgbLab(d[4*j],d[4*j+1],d[4*j+2]);ca.push(l[1]);cb.push(l[2])}}}
  cl.sort((a,b)=>a-b);const med=cl.length?cl[cl.length>>1]:0,gap=refLum-med;
  let trans=0;for(const v of cl)if(v>med+gap*.5)trans++;
  const md=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[s.length>>1]:0},cA=md(ca),cB=md(cb),Cc=Math.hypot(cA,cB),rA=rn?ra/rn:0,rB=rn?rb/rn:0,Cr=Math.hypot(rA,rB);
  let hue=180;if(Cc>0&&Cr>0){hue=Math.abs(Math.atan2(rB,rA)-Math.atan2(cB,cA))*180/Math.PI;if(hue>180)hue=360-hue}
  return {core:core/n,gap,trans:trans/n,Cc,Cr,hue}}
function wbSolidOk(s){
  return !(s.core<WB_CORE||s.gap<WB_GAP||s.trans>WB_TRANS)}
/* the light reading of a close-up: strict about what counts as white paper */
const closeRead=c=>wbRead(c,{strict:true});
/* ---- white paper in the close-up (2026-11-15, the owner's choice from mockups, photo-wb-mockups option A + 04-10): whether the
   item's close-up has white paper (closeRead), and, when it hasn't, whether the item photo's looser light reading (wbRead, a white
   wall or shirt) shows a warm cast (blue gain at least PAPER_WARM times the red). The app can't tell dim light (the phone brightens
   every picture): that only ever shows as "no paper". Kept in memory by the close-up's and photo's signatures; nothing is stored. ---- */
const PAPER_WARM=1.08,PAPER={};
const paperKey=it=>it&&it.texture?texSig(it.texture)+'|'+texSig(it.photo||''):'';
async function urlCanvas(u){const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c}
async function paperOf(it){const k=paperKey(it);if(!k)return null;if(PAPER[k])return PAPER[k].then?await PAPER[k]:PAPER[k];
  const job=(async()=>{try{const r=closeRead(await urlCanvas(it.texture));let warm=false;
    if(!r.ref&&it.photo)try{const g=wbRead(await urlCanvas(phSm(it))).gains;warm=!!g&&g.b>=PAPER_WARM*g.r}catch{}
    return {ref:!!r.ref,warm}}catch{return null}})();
  PAPER[k]=job;const v=await job;if(v)PAPER[k]=v;else delete PAPER[k];return v}
const paperNow=it=>{const v=PAPER[paperKey(it)];return v&&!v.then?v:null};
/* the close-up sent to Claude (/describe): a close-up added in the item sheet is stored as taken (replaceTexture) and the sharp copy is
   never corrected, so with paper in it the copy is white-balanced from the paper here (applyWb, closeRead's gains) and goes with wb:true
   ("already corrected, don't adjust"); without paper it goes as taken with wb:false (worker/tag.js wbOf, lightText). Correcting an
   already corrected picture changes nothing (no gains under a 2% cast). */
async function paperCopy(it){const u=(await sharpCloseOf(it))||it.texture;
  try{const cv=await urlCanvas(u),r=closeRead(cv);if(!r.ref)return {closeup:u,wb:false};
    return {closeup:r.gains?applyWb(cv,r.gains).toDataURL('image/jpeg',TAG_Q):u,wb:true}}catch{return {closeup:u,wb:false}}}

/* ---- measuring the cloth: the median CIELAB colour of a region (a box in thousandths, or the middle of the picture), after
   the white-balance gains; with a white reference (paper in the close-up) the exposure is also set from it, so lightness is
   trustworthy. Shadows and highlights (the darkest and brightest tenth) and the reference itself are left out. ---- */
function measureCloth(c,box,{gains=null,refLum=0}={}){
  const W=c.width,H=c.height,bx=box?{x:box.x/1000*W,y:box.y/1000*H,w:box.w/1000*W,h:box.h/1000*H}:{x:W*.15,y:H*.15,w:W*.7,h:H*.7};
  const k=Math.min(1,120/Math.max(bx.w,bx.h)),w=Math.max(1,Math.round(bx.w*k)),h=Math.max(1,Math.round(bx.h*k)),t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,bx.x,bx.y,bx.w,bx.h,0,0,w,h);const d=x.getImageData(0,0,w,h).data;
  const g=gains||{r:1,g:1,b:1},ex=refLum?srgbLin8(243)/srgbLin8(Math.min(250,refLum)):1;
  let px=[];for(let i=0;i<d.length;i+=4){const rgb=[d[i]*g.r,d[i+1]*g.g,d[i+2]*g.b].map(v=>linSrgb8(Math.min(1,srgbLin8(Math.min(255,v))*ex)));px.push(rgb)}
  const ok=new Uint8Array(px.length).fill(1);
  if(refLum){let n=0;const no=px.map(([r,gg,b])=>{const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);return mx>225&&(mx-mn)/mx<.12});for(const v of no)if(!v)n++;if(n>=px.length*.2)no.forEach((v,j)=>{if(v)ok[j]=0})}   // not the paper
  const all=px.map(p=>rgbLab(...p)),edge=measEdgeCut(all,ok,w,h);
  const labs=all.filter((_,j)=>ok[j]).sort((a,b)=>a[0]-b[0]),cut=Math.floor(labs.length*.1),mid=labs.slice(cut,labs.length-cut||labs.length);
  const med=j=>{const v=mid.map(l=>l[j]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};
  const lab=[med(0),med(1),med(2)].map(v=>Math.round(v*10)/10),dl=labs.map(l=>Math.hypot(l[0]-lab[0],l[1]-lab[1],l[2]-lab[2])).sort((a,b)=>a-b);
  const out={lab,hex:labHex(lab),ref:!!refLum,spread:Math.round(10*(dl[dl.length>>1]||0))/10,edge:Math.round(100*edge)/100};
  Object.defineProperty(out,'px',{value:labs,enumerable:false});   // the cloth's pixels (for the pattern's colours), never saved or sent
  return out}
/* the background, or a collar or shirt caught at the crop's edge (2026-11-14: the walkthrough's belt measured the wall behind it): pixels
   far from the cloth's own colour (ΔE76 over 14, or 3 times the usual distance) that are joined to the region's edge are left out, when
   they are under MEAS_EDGE_MAX (45%) of it (more than that is the cloth itself, a stripe touching the edge everywhere) */
const MEAS_EDGE_MAX=.45;
function measEdgeCut(all,ok,w,h){const n=all.length,idx=[];for(let j=0;j<n;j++)if(ok[j])idx.push(j);if(idx.length<50)return 0;
  const md=k=>{const v=idx.map(j=>all[j][k]).sort((a,b)=>a-b);return v[v.length>>1]},m=[md(0),md(1),md(2)];
  const d=new Float32Array(n);for(const j of idx)d[j]=Math.hypot(all[j][0]-m[0],all[j][1]-m[1],all[j][2]-m[2]);
  const ds=idx.map(j=>d[j]).sort((a,b)=>a-b),thr=Math.max(14,3*ds[ds.length>>1]),far=j=>ok[j]&&d[j]>thr;
  const cut=new Uint8Array(n),st=[];for(let x=0;x<w;x++)for(const y of [0,h-1]){const j=y*w+x;if(far(j)&&!cut[j]){cut[j]=1;st.push(j)}}
  for(let y=0;y<h;y++)for(const x of [0,w-1]){const j=y*w+x;if(far(j)&&!cut[j]){cut[j]=1;st.push(j)}}
  let c=st.length;while(st.length){const j=st.pop(),x=j%w,y=(j/w)|0;for(const k of [x>0?j-1:-1,x<w-1?j+1:-1,y>0?j-w:-1,y<h-1?j+w:-1])if(k>=0&&!cut[k]&&far(k)){cut[k]=1;c++;st.push(k)}}
  if(c>idx.length*MEAS_EDGE_MAX||!c)return 0;for(let j=0;j<n;j++)if(cut[j])ok[j]=0;return c/idx.length}
/* the colour each name has in this wardrobe: the median of the owner's own measured items of that colour (the same kind of
   item), once there are two; otherwise the app's swatch. Measurements with a white reference count first. */
/* (2026-11-14) only plain cloth teaches it: a solid, or a one-colour weave (twill, herringbone, a shirt's dobby) with no second colour.
   The walkthrough's plain brown tie measured nearest navy after two navy patterned ties had taught "navy" their stripes' average. An
   item never teaches its own measurement (skip: its id), so a card or the calibration can't confirm itself. */
const typeGroup=t=>['suit','blazer','pants','overcoat','raincoat'].includes(t)?'cloth':t;
const ONE_COL_WEAVES=['solid','twill','herringbone','birdseye','nailhead','sharkskin','oxford','pinpoint','royal-oxford','end-on-end','chambray','dobby','woven','textured','fine-texture','knit','tweed'];
const plainCloth=i=>!!i&&ONE_COL_WEAVES.includes(patBase(i.pattern)||'solid')&&!i.secondaryColor;
function calibLab(c,type,skip){const ms=items.filter(i=>i.id!==skip&&primaryCol(i)===c&&i.meas&&i.meas.lab&&plainCloth(i)&&typeGroup(i.type)===typeGroup(type)).map(i=>i.meas),good=ms.filter(m=>m.ref),use=good.length>=2?good:ms;
  if(use.length<2)return null;const med=j=>{const v=use.map(m=>m.lab[j]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]};return [med(0),med(1),med(2)]}
/* how much lightness counts: fully with a white reference; a close-up without one is exposed by the phone to a mid tone whatever
   the cloth (a white shirt reads light grey, navy reads lighter), so its lightness counts a third; a photo's half */
const measKL=m=>m&&m.ref?1:m&&m.src==='closeup'?MEAS_KL_CLOSE:2,MEAS_KL_CLOSE=3;
const colRef=(c,type,skip,accent)=>(!accent&&calibLab(c,type,skip))||labOf(c);
function nearestCols(type,lab,ref,o={}){const kL=o.kL||(ref?1:2);return colsFor(type,o.accent).filter(c=>COLORS[c]).map(c=>({c,d:Math.round(dE00(lab,colRef(c,type,o.skip,o.accent),kL)*10)/10})).sort((a,b)=>a.d-b.d).slice(0,3)}
const FAR_DE=12;   // further than this from every allowed colour: offer to add a new one
/* the measured colour disagrees with the tag: the closest listed colour is near (ΔE ≤ 8) and the tagged one is clearly further
   (4+ ΔE more). Claude once kept "brown" on a muted, almost grey mink suit whose close-up measured deep taupe at ΔE 4 (brown 12).
   Only a close-up or a measurement with a white reference counts: the same suit's photo alone, too dark, measured nearest black. */
/* (2026-11-14) now one verdict per colour (colourVerdicts): measuredAlt is the main colour's, when it disagrees enough to say so */
const MEAS_NEAR=8,MEAS_GAP=4;
function measuredAlt(q){const v=(q.measV||colourVerdicts(q)).find(x=>x.f==='primaryColor');return v&&v.mode?{c:v.to,d:v.d,tagged:v.dTag,mode:v.mode,conf:v.conf}:null}
/* the card's measurement: the close-up when there is one (with its own white reference if it has one, else the item photo's
   light reading), otherwise the plain-cloth box Claude pointed at in the item photo */
/* (2026-11-14) with both, the photo is measured too (photo: its box) so the two can be compared (one of the confidence's parts); the
   close-up's white reference must be a real patch (closeRead); its sharpness is kept (sharp) */
function measureCard(q){
  let m=null;
  if(q.raw&&q.raw.tex){const r=closeRead(q.raw.tex);
    m=Object.assign(measureCloth(q.raw.tex,null,r.ref?{gains:r.gains,refLum:r.refLum}:{gains:q.wbOff?null:q.wb}),{src:'closeup',sharp:sharpness(q.raw.tex)})}
  if(q.clothBox&&q.raw&&q.raw.big){const p=Object.assign(measureCloth(q.raw.big,q.clothBox,{gains:q.wbOff?null:q.wb}),{src:'photo'});
    if(m)m.photo={lab:p.lab,hex:p.hex,spread:p.spread};else m=p}
  if(m){m.near=nearestCols(q.type,m.lab,m.ref,{kL:measKL(m),skip:q.id});m.parts=measureParts(q,m);if(m.parts)m.groundNear=nearestCols(q.type,m.parts[0].lab,m.ref,{kL:measKL(m),skip:q.id})}
  q.meas=m;q.measV=m?colourVerdicts(q):[];return m}
/* what the tagger is told: for a patterned cloth its ground (the whole picture's median of a white/blue stripe is a grey nobody wears) */
const measHint=m=>m&&{lab:m.parts?m.parts[0].lab:m.lab,hex:m.parts?m.parts[0].hex:m.hex,ref:m.ref,src:m.src,near:m.parts&&m.groundNear?m.groundNear:m.near};   // (the ground's; the parts are no longer sent: the worker never read them, CR-2-05)

/* ---- a patterned cloth's colours, measured one by one (2026-11-14, the owner's design): a white/blue stripe must read white and blue,
   not the grey in between. With a band reading (detect.js analyzeSett, or Claude's reading coloured from the pixels) the widest band
   is the ground and the band furthest from it the stripe or check; with none yet, the cloth's pixels are split in two (measSplit). The
   ground is compared with the main colour, the stripe with the second. A one-colour weave (twill, a dobby) is measured whole. ---- */
const MULTI_PATS=()=>[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS,'paisley','tonal-check'];
const multiCol=i=>!!i&&MULTI_PATS().includes(patBase(i.pattern)||'solid');
function measureParts(q,m){if(!multiCol(q)||!m||!m.px)return null;const L=h=>rgbLab(...hexRgb(h));
  const s=q.sett&&!q.settOff?q.sett:null;let seed=null;
  // the reading's colours come from another picture or exposure (the item photo's box, Claude's hexes): they only seed the split of
  // this picture's own pixels, moved by the difference between the two medians
  if(s&&s.bands&&s.bands.length>=2){const g=s.bands.reduce((a,b)=>b[1]>a[1]?b:a),gl=L(g[0]);let ln=null,bd=-1;
    for(const b of s.bands)if(b!==g){const dd=dE00(L(b[0]),gl);if(dd>bd){bd=dd;ln=b}}
    if(ln&&bd>=6)seed=[gl,L(ln[0])]}
  else if(s&&s.motif&&s.motif.figs[0])seed=[L(s.motif.ground),L(s.motif.figs[0].cols[0])];
  const parts=measSplit(m.px,seed);if(!parts)return null;
  // two colours in about equal shares (a repp tie's navy and blue): which is the "ground" is the tagger's call, so the parts are named
  // in the order nearest the tags
  if(parts[0].share<.65&&q.secondaryColor&&COLORS[q.secondaryColor]&&COLORS[primaryCol(q)]){const P=labOf(primaryCol(q)),S=labOf(q.secondaryColor),[a,b]=parts;
    if(dE00(a.lab,S)+dE00(b.lab,P)<dE00(a.lab,P)+dE00(b.lab,S))return [{...b,role:'ground'},{...a,role:'line'}]}
  return parts}
/* the cloth's pixels in two groups (k-means in Lab, from its two most different tenths, or from the reading's two colours): the larger
   is the ground; a thin stripe is blurred with the ground beside it, so of the other group the half furthest from the ground gives its
   colour */
function measSplit(px,seed){if(px.length<60)return null;const n=px.length,st=Math.max(1,Math.floor(n/4000)),P=[];for(let j=0;j<n;j+=st)P.push(px[j]);
  const md=k=>{const v=P.map(p=>p[k]).sort((a,b)=>a-b);return v[v.length>>1]},m=[md(0),md(1),md(2)],dm=p=>Math.hypot(p[0]-m[0],p[1]-m[1],p[2]-m[2]);
  const far=P.slice().sort((a,b)=>dm(b)-dm(a)),c1=far[Math.floor(far.length*.05)];let A=m.slice(),B=c1.slice(),lab=new Uint8Array(P.length);
  if(seed){const sm=[0,1,2].map(k=>seed[0][k]*.8+seed[1][k]*.2),off=m.map((v,k)=>v-sm[k]);A=seed[0].map((v,k)=>v+off[k]);B=seed[1].map((v,k)=>v+off[k])}
  for(let it=0;it<10;it++){const sa=[0,0,0,0],sb=[0,0,0,0];P.forEach((p,j)=>{const da=Math.hypot(p[0]-A[0],p[1]-A[1],p[2]-A[2]),db=Math.hypot(p[0]-B[0],p[1]-B[1],p[2]-B[2]);lab[j]=db<da?1:0;const s=lab[j]?sb:sa;s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++});
    if(!sa[3]||!sb[3])return null;A=sa.slice(0,3).map(v=>v/sa[3]);B=sb.slice(0,3).map(v=>v/sb[3])}
  let nb=lab.reduce((s,v)=>s+v,0);if(nb>P.length/2){[A,B]=[B,A];lab=lab.map(v=>1-v);nb=P.length-nb}
  if(dE00(A,B)<8||nb<P.length*.04)return null;   // one colour, or a few specks
  const G=P.filter((_,j)=>!lab[j]),gm=[0,1,2].map(k=>{const v=G.map(p=>p[k]).sort((a,b)=>a-b);return v[v.length>>1]});
  const Ls=P.filter((_,j)=>lab[j]).sort((a,b)=>Math.hypot(b[0]-gm[0],b[1]-gm[1],b[2]-gm[2])-Math.hypot(a[0]-gm[0],a[1]-gm[1],a[2]-gm[2])),half=Ls.slice(0,Math.max(6,Ls.length>>1));
  const lm=[0,1,2].map(k=>half.reduce((s,p)=>s+p[k],0)/half.length),r=v=>v.map(x=>Math.round(x*10)/10);
  return [{role:'ground',lab:r(gm),hex:labHex(gm),share:Math.round(100*(1-nb/P.length))/100,src:'pixels'},{role:'line',lab:r(lm),hex:labHex(lm),share:Math.round(100*nb/P.length)/100,src:'pixels'}]}

/* ---- the close-up's sharpness (0-1): the fine detail's share of the detail at four times the scale, on a 400 px copy. A soft close-up
   (a crop of a web photo, a shaken phone) has lost its fine detail; a plain cloth photographed sharply still has its grain and noise.
   Under BLUR_SHARP the card warns that the weave can't be read (the walkthrough's pinstripe close-up was read as a check). ---- */
const BLUR_SHARP=.25,sharpMemo=new WeakMap();
function sharpness(c){if(!c||!c.width)return null;if(sharpMemo.has(c))return sharpMemo.get(c);
  const grey=(S)=>{const k=Math.min(1,S/Math.max(c.width,c.height)),w=Math.max(8,Math.round(c.width*k)),h=Math.max(8,Math.round(c.height*k)),t=document.createElement('canvas');t.width=w;t.height=h;
    const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,w,h);const d=x.getImageData(0,0,w,h).data,g=new Float32Array(w*h);for(let j=0;j<w*h;j++)g[j]=.299*d[4*j]+.587*d[4*j+1]+.114*d[4*j+2];return {g,w,h}};
  const lap=({g,w,h})=>{let s=0,n=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const j=y*w+x;s+=Math.abs(4*g[j]-g[j-1]-g[j+1]-g[j-w]-g[j+w]);n++}return n?s/n:0};
  const fine=lap(grey(400)),coarse=lap(grey(100)),v=Math.round(100*fine/(fine+coarse+1e-6))/100;sharpMemo.set(c,v);return v}

/* ---- the verdict on each colour: does the measurement agree with the tag, and how sure is it (2026-11-14, the owner's design: colour
   recognition runs on every item and, when confident, overrules the tag; when unsure it only asks). The confidence (0-1) comes from:
   a white reference in the picture, the close-up's sharpness, how even the cloth (or the band) is, how much nearer the measured colour
   is than the tagged one (ΔE00), how near it is at all, and whether the item photo agrees with the close-up. MEAS_AUTO is the
   confidence that changes the colour, chosen on the owner's wardrobe so auto-changes were right 95% of the time; between MEAS_FLAG_GAP
   and that, the card asks ("Measured: charcoal?") without changing it. A field set by hand (q.edited) is never overruled. ---- */
/* calibrated 2026-11-14 on the owner's 42 items with a close-up (a read-only copy of his backup) and the walkthrough's 24: each item
   measured as tagged and as tagged with its nearest other colour, and his own corrections replayed. No confidence reached 95% right:
   the most confident wrong change (his pale pink herringbone shirt "white", 0.69) sat above every right one, so MEAS_AUTO is above
   all of them (no colour changed by itself on either set) and stays there until the measuring earns it; MEAS_FLAG (0.4) asks about 4
   of his 42 correct main colours (the old "Use …" offer came on 13 of them; on the walkthrough 1 of 24, was 14) */
const MEAS_AUTO=.75,MEAS_FLAG=.4,MEAS_FLAG_GAP=3;
const clamp01=v=>Math.max(0,Math.min(1,v));
function measConf({gap,best,spread,sharp,ref,src,agree,part,cal}){
  const g=clamp01((gap-1)/8),nr=clamp01((12-best)/8),u=spread==null?.6:clamp01((16-spread)/12),s=sharp==null?.7:clamp01((sharp-BLUR_SHARP*.8)/(.55-BLUR_SHARP*.8));
  // cal: how many of the two colours (the tag's, the measured one's) are known from the owner's own plain items; a bare swatch is only
  // a name's usual shade (the owner's pale pink shirt measured far from the app's pink, and nearest white)
  const base=Math.sqrt(g*nr)*(.65+.35*u)*(.55+.45*s)*(ref?1:src==='closeup'?.88:.6)*(agree===true?1.1:agree===false?.6:1)*(part?.85:1)*[.6,.8,1][cal??2];
  return Math.round(100*clamp01(base))/100}
function colourVerdicts(q){const m=q.meas;if(!m||!m.lab||!q.type)return [];const out=[],kL=measKL(m);
  const parts=m.parts,fields=[['primaryColor',parts?parts.find(p=>p.role==='ground'):null]];
  if(parts&&q.secondaryColor)fields.push(['secondaryColor',parts.find(p=>p.role==='line')]);
  for(const [f,part] of fields){const tag=f==='primaryColor'?primaryCol(q):q[f];if(!tag||!COLORS[tag])continue;const accent=f!=='primaryColor',lab=part?part.lab:m.lab;
    const near=nearestCols(q.type,lab,m.ref,{kL,skip:q.id,accent}),best=near[0];if(!best)continue;
    const dTag=Math.round(dE00(lab,colRef(tag,q.type,q.id,accent),kL)*10)/10,gap=Math.round((dTag-best.d)*10)/10;
    let agree=null;if(m.photo&&!part){const pn=nearestCols(q.type,m.photo.lab,false,{kL:2,skip:q.id})[0];agree=!!pn&&(pn.c===best.c||dE00(m.photo.lab,m.lab,3)<5)}
    const cal=(accent?0:!!calibLab(tag,q.type,q.id)+!!calibLab(best.c,q.type,q.id));
    const conf=best.c===tag?0:measConf({gap,best:best.d,spread:part?null:m.spread,sharp:m.sharp,ref:m.ref,src:m.src,agree,part:!!part,cal});
    const ai=aiFor(q,f,tag,best.c),mode=verdictMode({same:best.c===tag,inList:colsFor(q.type,accent).includes(best.c),trusted:m.src==='closeup'||!!m.ref,ref:!!m.ref,conf,canFlag:gap>=MEAS_FLAG_GAP&&best.d<=FAR_DE},ai);
    out.push({f,from:tag,to:best.c,d:best.d,dTag,gap,conf,mode,part:part?part.role:null,lab,cal,...(ai?{ai:ai.c}:{})})}
  return out}
/* ---- Claude's own signals in the verdict (2026-11-14, the owner's "Do 2"): how sure Claude was of the colour and its runner-up
   (q.tagAI, from the same answer: no extra call) weigh with the measurement. Only while the field still holds Claude's answer.
   - Claude unsure (low) and its runner-up is the measured colour: the measurement decides from AI_LOW_AUTO (close-up or white
     reference), and asks from AI_LOW_FLAG
   - Claude sure (high) and no white reference: never changed; asked only from AI_HIGH_FLAG
   - otherwise (medium, no signals, a runner-up that is a third colour): the measurement alone, as before (MEAS_AUTO, MEAS_FLAG)
   A runner-up that agrees is no evidence by itself: tagging again with the close-up tells Claude the measurement and asks it to
   name the measured colour as runner-up when it picks another (worker.js), so it nearly always agrees. ---- */
/* calibrated 2026-11-14 by replaying mocked answers over the owner's 42 close-up items and the walkthrough's 24 (no saved item had
   Claude's confidence yet): 0 wrong changes on both when Claude, right, says high or medium; recall is small (the measuring itself
   matches his tags 40% of the time) and is an estimate until items are tagged with the signals saved (item.tagAI) */
const AI_LOW_AUTO=.55,AI_LOW_FLAG=.25,AI_HIGH_FLAG=.6;
function aiFor(q,f,tag,to){const t=q.tagAI;if(f!=='primaryColor'||!t||t.col!==tag||!t.conf||!t.conf.primaryColor)return null;
  return {c:t.conf.primaryColor,agree:!!t.alt&&t.alt===to}}
function verdictMode(x,ai){if(x.same||!x.inList)return null;const c=ai&&ai.c;
  if(c==='high'&&!x.ref)return x.canFlag&&x.conf>=AI_HIGH_FLAG?'flag':null;
  if(c==='low'&&ai.agree&&x.trusted&&x.conf>=AI_LOW_AUTO)return 'auto';
  if(x.trusted&&x.conf>=MEAS_AUTO)return 'auto';
  return x.canFlag&&x.conf>=(c==='low'?AI_LOW_FLAG:MEAS_FLAG)?'flag':null}
/* what of Claude's answer is kept (on the card, then the saved item): the colour it gave, how sure it was of each field, its
   runner-ups, and whether it was told the measurement (seen). tag-many gives one confidence for the whole item */
function aiSignals(ai,seen){if(!ai)return null;const c=ai.conf||(typeof ai.confidence==='string'?{type:ai.confidence,primaryColor:ai.confidence,pattern:ai.confidence}:null);
  return {col:aiFields(ai).primaryColor,conf:c?{type:c.type||null,primaryColor:c.primaryColor||null,pattern:c.pattern||null}:null,alt:ai.altColor||null,altPat:ai.altPattern||null,seen:!!seen}}
/* the card takes a confident measurement: the colour changes and the card says so with an Undo; a field set by hand, or one whose
   change was undone, stays */
function applyMeasured(q){if(!q||q.manual)return [];const done=[];q.auto=q.auto||{};
  for(const f of Object.keys(q.auto))if(q[f]!==q.auto[f].to)delete q.auto[f];   // Claude's answer (tagging again) or the owner changed it since
  for(const v of q.measV||[]){if(v.mode!=='auto'||(q.edited&&q.edited[v.f])||(q.autoUndo&&q.autoUndo[v.f]===v.to)||q[v.f]===v.to)continue;
    q.auto[v.f]={from:q[v.f],to:v.to,src:q.meas.src,conf:v.conf,...(v.ai?{ai:v.ai}:{})};q[v.f]=v.to;done.push(v.f)}
  if(done.length){if(q.texCanvas)generateSwatch(q);q.measV=colourVerdicts(q)}
  return done}
function undoMeasured(i,f){const q=queue[i];if(!q||!q.auto||!q.auto[f])return;const a=q.auto[f];q[f]=a.from;delete q.auto[f];q.autoUndo={...q.autoUndo,[f]:a.to};q.edited={...q.edited,[f]:true};
  if(q.texCanvas)generateSwatch(q);q.measV=colourVerdicts(q);renderAdd()}
/* measure the card and take what is sure (the first tag, tagging again from the close-up, Try again) */
function measureAndApply(q){measureCard(q);missedPattern(q);return applyMeasured(q)}
