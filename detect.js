/* Daily Wardrobe: pattern detection from item photos (main thread: needs canvas) */
/* Pattern detection from the item photo.
   - stripes:     1-D band sequence + angle            (stripe, pinstripe, chalk stripe)
   - checks:      two perpendicular band sequences      (check, gingham, tattersall, windowpane, glen check)
   Fine weaves (herringbone, birdseye, nailhead, sharkskin, twill) are not measured: a phone photo of a whole
   garment doesn't resolve them reliably, so they use drawn tiles with the correct orientation.
   Colours always come from the item's tagged colours, matched by brightness rank, so photo colour casts don't leak in. */
const STRIPE_PATS=['stripe','pinstripe','fine-stripe','chalk-stripe'],CHECK_PATS=['check','gingham','tattersall','windowpane','glen-check'];
const DETECT_PATS=[...STRIPE_PATS,...CHECK_PATS];
/* small figures on a grid (a neat / foulard, dots): no band reader can draw them, only Claude's motif reading (tagging.js) */
const MOTIF_PATS=['foulard','polka-dot'];
/* a dress shirt whose pattern is in the weave (dobby diamonds, herringbone, oxford): only Claude's texture reading draws it */
const TEXTURE_PATS=['dobby','woven','textured','fine-texture','oxford','pinpoint','royal-oxford','twill','end-on-end','herringbone','chambray'];
const texPat=(t,p)=>t==='shirt'&&TEXTURE_PATS.includes(patBase(p)||'');
/* an item's pattern reading, unless it is a band reading of a motif pattern (an older reading turned a neat into a plaid), or
   a texture reading on a pattern that is no longer a weave texture (or the reverse) */
const usableSett=i=>{const s=i&&i.sett,p=patBase(i&&i.pattern)||'';if(!s||(MOTIF_PATS.includes(p)&&!s.motif))return null;return texPat(i.type,i.pattern)?(s.tex||s.motif?s:null):(s.tex?null:s)};   // a weave pattern takes a texture or a figure (motif) reading
/* what a pattern reading looks like, for photo keys: the band colours, or the motif's ground, figures and colours */
const settSig=s=>!s?'':s.tex?'t'+s.tex.grid.join('')+Math.round(s.tex.rel*100)+'/'+(s.tex.aspect||''):s.motif?'m'+[s.motif.grid,s.motif.ground,s.motif.aspect||1,s.motif.off||0,...s.motif.figs.map(f=>[f.shape,f.place,Math.round(f.size*100),...f.cols,f.centre||'',(f.bmp||[]).join('/')].join(','))].join(';'):(s.bands||[]).map(b=>b[0]).join('');

/* region -> luminance grid (downscaled to at most 256px) */
function lumGrid(src,sx,sy,size){
  const N=Math.max(48,Math.round(Math.min(256,size)));
  const cv=document.createElement('canvas');cv.width=cv.height=N;
  const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(src,sx,sy,size,size,0,0,N,N);
  const d=g.getImageData(0,0,N,N).data,L=new Float32Array(N*N);
  for(let i=0;i<N*N;i++)L[i]=(.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2])/255;
  return {N,L,scale:size/N};
}
const boxBlur=(a,N)=>{const o=new Float32Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){let s=0,c=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X>=0&&Y>=0&&X<N&&Y<N){s+=a[Y*N+X];c++}}o[y*N+x]=s/c}return o};
function sobel(B,N){const gx=new Float32Array(N*N),gy=new Float32Array(N*N);
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){const p=(X,Y)=>B[Y*N+X];
    gx[y*N+x]=(p(x+1,y-1)+2*p(x+1,y)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x-1,y)+p(x-1,y+1));
    gy[y*N+x]=(p(x-1,y+1)+2*p(x,y+1)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x,y-1)+p(x+1,y-1));}
  return {gx,gy}}
/* average a per-pixel map along lines perpendicular to angle -> 1-D profile along the angle */
function project(M,N,ang){const R=Math.ceil(N*Math.SQRT1_2)+1,len=2*R,sum=new Float64Array(len),cnt=new Float64Array(len),cs=Math.cos(ang),sn=Math.sin(ang);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const t=Math.floor((x-N/2)*cs+(y-N/2)*sn+R);sum[t]+=M[y*N+x];cnt[t]++}
  const pr=[];for(let i=0;i<len;i++)if(cnt[i]>=N/3)pr.push(sum[i]/cnt[i]);return pr}
const variance=pr=>{const m=pr.reduce((a,b)=>a+b,0)/pr.length;return pr.reduce((a,v)=>a+(v-m)**2,0)/pr.length};
const normAng=t=>{while(t<=-Math.PI/2)t+=Math.PI;while(t>Math.PI/2)t-=Math.PI;return t};
/* repeat length of a profile via autocorrelation (sub-sample precision) */
function period(prof,minLag=6){return periodCh([prof],[1],minLag)}
/* the same over several channels at once (L*, a*, b*): a red line and a green one of the same lightness are told apart */
/* how alike a multi-channel profile is to itself shifted by one lag (normalised) */
function corrAt(chs,wts,l){let a=0,b=0,c=0;chs.forEach((ch,k)=>{const m=ch.reduce((x,y)=>x+y,0)/ch.length,w=wts[k];for(let i=0;i+l<ch.length;i++){const p=ch[i]-m,q=ch[i+l]-m;a+=w*p*q;b+=w*p*p;c+=w*q*q}});return a/(Math.sqrt(b*c)||1)}
function periodCh(chs,wts,minLag=6){
  // (typed arrays and a plain loop: the sums are added in the same order, so the same numbers, in less time)
  const Ps=chs.map(ch=>{const m=ch.reduce((a,b)=>a+b,0)/ch.length;return Float64Array.from(ch,v=>v-m)}),N=Ps[0].length;
  const ac=l=>{let a=0,b=0,c=0;for(let k=0;k<Ps.length;k++){const P=Ps[k],w=wts[k];for(let i=0;i+l<N;i++){a+=w*P[i]*P[i+l];b+=w*P[i]*P[i];c+=w*P[i+l]*P[i+l]}}return a/(Math.sqrt(b*c)||1)};
  const P=Ps[0];
  const maxLag=Math.floor(P.length*.67),r=[];for(let l=0;l<=maxLag;l++)r.push(l<minLag-1?-1:ac(l));
  let best=-1,T=0;for(let l=minLag;l<maxLag;l++)if(r[l]>r[l-1]&&r[l]>=r[l+1]&&r[l]>best){best=r[l];T=l}
  if(!T||best<.35)return null;
  // a clean pattern matches itself almost as well at two or three repeats: take the shortest whole fraction that matches nearly as well
  for(let k=6;k>=2;k--){const f=Math.round(T/k);if(f<minLag)continue;let m=f;for(let d=-2;d<=2;d++)if(r[f+d]>r[m])m=f+d;if(r[m]>.9*best&&r[m]>=r[m-1]&&r[m]>=(r[m+1]??-1)){T=m;break}}
  const y0=r[T-1],y1=r[T],y2=r[T+1]??y1,den=y0-2*y1+y2;
  return {T:T+(den?.5*(y0-y2)/den:0),corr:best};
}
/* fold one repeat and cluster it into k brightness levels -> [[rank, fraction], ...] (rank 0 = darkest) */
function foldBands(prof,nColors){
  const pd=period(prof);if(!pd)return null;const Tf=pd.T;
  const M=Math.max(12,Math.round(Tf)),fs=new Float64Array(M),fc=new Float64Array(M);
  prof.forEach((v,i)=>{const k=Math.floor(((i%Tf)/Tf)*M)%M;fs[k]+=v;fc[k]++});
  const F=[...fs].map((v,k)=>v/(fc[k]||1));
  const k=Math.max(2,Math.min(3,nColors)),lo=Math.min(...F),hi=Math.max(...F);
  if(hi-lo<.04)return null;
  let C=k===2?[lo,hi]:[lo,(lo+hi)/2,hi],lab=new Array(M).fill(0);
  for(let it=0;it<20;it++){
    lab=F.map(v=>{let bi=0;for(let j=1;j<k;j++)if(Math.abs(v-C[j])<Math.abs(v-C[bi]))bi=j;return bi});
    C=C.map((c,j)=>{const m=F.filter((_,i)=>lab[i]===j);return m.length?m.reduce((a,b)=>a+b,0)/m.length:c});
  }
  const order=C.map((c,j)=>[c,j]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]),rank=[];order.forEach((j,ri)=>rank[j]=ri);
  lab=lab.map(j=>rank[j]);
  let runs=[];for(let i=0;i<M;i++){if(runs.length&&runs[runs.length-1][0]===lab[i])runs[runs.length-1][1]++;else runs.push([lab[i],1])}
  if(runs.length>1&&runs[0][0]===runs[runs.length-1][0])runs[0][1]+=runs.pop()[1];
  const minW=Math.max(1,M*.025);
  for(let pass=0;pass<3;pass++){
    runs=runs.filter((rn,i)=>{if(rn[1]<minW&&runs.length>2){runs[(i+runs.length-1)%runs.length][1]+=rn[1];return false}return true});
    const m=[];for(const rn of runs){if(m.length&&m[m.length-1][0]===rn[0])m[m.length-1][1]+=rn[1];else m.push(rn)}
    if(m.length>1&&m[0][0]===m[m.length-1][0])m[0][1]+=m.pop()[1];runs=m;
  }
  if(runs.length<2||runs.length>14)return null;
  let out=runs.map(([c,w])=>[c,w/M]),T=Tf;
  // the autocorrelation sometimes locks onto two repeats: collapse a sequence that is its own half twice
  const h=out.length/2;
  if(out.length>=4&&out.length%2===0&&out.slice(0,h).every((r,i)=>r[0]===out[i+h][0]&&Math.abs(r[1]-out[i+h][1])<.06)){
    const half=out.slice(0,h).map((r,i)=>[r[0],r[1]+out[i+h][1]]);out=half;T=Tf/2;
  }
  return {runs:out,T};
}

function analyzeStripes(src,sx,sy,size,nColors){
  const {N,L,scale}=lumGrid(src,sx,sy,size),B=boxBlur(boxBlur(L,N),N),{gx,gy}=sobel(B,N);
  let jxx=0,jyy=0,jxy=0;for(let i=0;i<N*N;i++){jxx+=gx[i]*gx[i];jyy+=gy[i]*gy[i];jxy+=gx[i]*gy[i]}
  const coh=Math.sqrt((jxx-jyy)**2+4*jxy*jxy)/((jxx+jyy)||1);if(coh<.25)return null;
  // tensor angle can be 1-2 degrees off, which smears thin lines: keep the sharpest projection nearby.
  // Profiles use the unblurred image: averaging along the stripe already removes the weave texture.
  let th=.5*Math.atan2(2*jxy,jxx-jyy),bt=th,bv=-1;
  for(let dd=-4;dd<=4;dd+=.25){const a=th+dd*Math.PI/180,v=variance(project(L,N,a));if(v>bv){bv=v;bt=a}}
  th=normAng(bt);
  const f=foldBands(project(L,N,th),nColors);if(!f)return null;
  return {kind:'stripes',a:Math.round(th*180/Math.PI),runs:f.runs,Tpx:f.T*scale};
}

function analyzeChecks(src,sx,sy,size,nColors){
  const {N,L,scale}=lumGrid(src,sx,sy,size);
  // the axis pair whose two projections are jointly sharpest
  const score=a=>variance(project(L,N,a))+variance(project(L,N,a+Math.PI/2));
  let ba=0,bs=-1;for(let d=0;d<90;d+=2){const a=d*Math.PI/180,s=score(a);if(s>bs){bs=s;ba=a}}
  for(let dd=-2;dd<=2;dd+=.25){const a=ba+dd*Math.PI/180,s=score(a);if(s>bs){bs=s;ba=a}}
  const pu=project(L,N,ba),pv=project(L,N,ba+Math.PI/2),vu=variance(pu),vv=variance(pv);
  const fu=foldBands(pu,nColors),fv=foldBands(pv,nColors);
  // one strong axis only -> it's really a stripe
  if(fu&&(!fv||vv<.2*vu))return {kind:'stripes',a:Math.round(normAng(ba)*180/Math.PI),runs:fu.runs,Tpx:fu.T*scale};
  if(fv&&(!fu||vu<.2*vv))return {kind:'stripes',a:Math.round(normAng(ba+Math.PI/2)*180/Math.PI),runs:fv.runs,Tpx:fv.T*scale};
  if(!fu||!fv)return null;
  return {kind:'check',a:Math.round(normAng(ba)*180/Math.PI),runs:fu.runs,vruns:fv.runs,ratio:fv.T/fu.T,Tpx:fu.T*scale};
}

/* map brightness ranks onto colour roles. A missing secondary still gets the auto accent colour (role 's'),
   so a grey suit tagged with one colour keeps a lighter pinstripe. */
function mapRuns(runs,item){
  const roles=[['p',COLORS[primaryCol(item)]]];
  roles.push(['s',item.secondaryColor&&COLORS[item.secondaryColor]||accentOf(item)]);
  if(item.tertiaryColor&&COLORS[item.tertiaryColor])roles.push(['t',COLORS[item.tertiaryColor]]);
  roles.sort((a,b)=>lum(a[1])-lum(b[1]));
  const k=Math.max(...runs.map(r=>r[0]))+1;
  const use=k>=roles.length?roles:roles.filter(r=>r[0]!=='t').slice(0,k);
  const pick=rk=>use[Math.round(rk*(use.length-1)/Math.max(1,k-1))][0];
  let bands=runs.map(([rk,f])=>[pick(rk),+f.toFixed(3)]);
  let si=0,bw=-1;bands.forEach((b,i)=>{if(b[0]==='p'&&b[1]>bw){bw=b[1];si=i}});
  return bands.slice(si).concat(bands.slice(0,si));
}
function detectPattern(item,src,sx,sy,size){
  const p=item.pattern,n=[primaryCol(item),item.secondaryColor,item.tertiaryColor].filter(Boolean).length;
  let r=null;
  if(CHECK_PATS.includes(p))r=analyzeChecks(src,sx,sy,size,n);
  else if(STRIPE_PATS.includes(p))r=analyzeStripes(src,sx,sy,size,n);
  if(!r)return null;
  const out={kind:r.kind,a:r.a,b:mapRuns(r.runs,item)};
  if(r.kind==='check'){out.v=mapRuns(r.vruns,item);out.r=+Math.max(.33,Math.min(3,r.ratio)).toFixed(2)}
  return out;
}
/* for a queued item: swatch region first, then a larger area */
function detectQueued(q,it){
  if(!DETECT_PATS.includes(it.pattern))return null;
  const src=q.big;if(!src)return null;
  const W=src.width,H=src.height,mn=Math.min(W,H),cx=(Number(q.cx)||.5)*W,cy=(Number(q.cy)||.5)*H;
  for(const sz of [mn*(.5/(Number(q.zoom)||1)),mn*.7]){
    const sx=Math.max(0,Math.min(W-sz,cx-sz/2)),sy=Math.max(0,Math.min(H-sz,cy-sz/2));
    const r=detectPattern(it,src,sx,sy,sz);if(r)return r;
  }
  return null;
}


/* ---- the full sett from a close-up (a woven stripe, check or plaid, in its real colours) ----
   The close-up is white-balanced and taken for its colour, so here the colours DO come from the photo: the bands of one
   repeat across the main stripes (median CIELAB per band, merged until neighbours differ visibly), and the lines that cross
   them in the other direction (what is left once the main stripes are taken out). Result (item.sett):
   {v:2, a: angle across the main stripes (deg, in the close-up), bands:[[hex,w]...] (w: share of one repeat),
    cross: {d: angle between the two directions, bands:[[hex|null,w]...], r: cross repeat / main repeat} or null,
    cr: repeats across the close-up's width (the swatch draws the same scale), src:'closeup'} */
function labGrid(src,sx,sy,sw,sh,N=280){
  const k=N/Math.max(sw,sh),W=Math.max(16,Math.round(sw*k)),H=Math.max(16,Math.round(sh*k));
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(src,sx,sy,sw,sh,0,0,W,H);
  const d=g.getImageData(0,0,W,H).data,n=W*H,L=new Float32Array(n),A=new Float32Array(n),Bb=new Float32Array(n),Y=new Float32Array(n);
  // rgbLab (core.js) worked out inline, with its sRGB curve from a table: the same numbers in a fraction of the time on a 900px grid
  const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
  for(let i=0;i<n;i++){const r=LAB_LIN[d[i*4]],gg=LAB_LIN[d[i*4+1]],b=LAB_LIN[d[i*4+2]],
      X=f((r*.4124+gg*.3576+b*.1805)/.95047),Yl=f(r*.2126+gg*.7152+b*.0722),Z=f((r*.0193+gg*.1192+b*.9505)/1.08883);
    L[i]=116*Yl-16;A[i]=500*(X-Yl);Bb[i]=200*(Yl-Z);Y[i]=(.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2])/255}
  return {W,H,L,A,B:Bb,Y}}
/* rgbLab's linear value of each sRGB byte, worked out as rgbLab does */
const LAB_LIN=Float64Array.from({length:256},(_,u)=>{u/=255;return u>.04045?((u+.055)/1.055)**2.4:u/12.92});
/* the projection index of every pixel along an angle, for a W x H grid */
function projIdx(W,H,ang){const R=Math.ceil(Math.hypot(W,H)/2)+1,cs=Math.cos(ang),sn=Math.sin(ang),idx=new Int32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)idx[y*W+x]=Math.floor((x-W/2)*cs+(y-H/2)*sn+R);return {idx,len:2*R}}
function projAvg(M,P){const s=new Float64Array(P.len),c=new Float64Array(P.len);for(let i=0;i<M.length;i++){s[P.idx[i]]+=M[i];c[P.idx[i]]++}
  return {avg:[...s].map((v,i)=>c[i]?v/c[i]:0),cnt:[...c]}}
const boxBlurWH=(a,W,H)=>{const o=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0,c=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X>=0&&Y>=0&&X<W&&Y<H){s+=a[Y*W+X];c++}}o[y*W+x]=s/c}return o};
/* fold a Lab profile on its repeat (or take it whole) and merge it into bands */
/* one repeat in M steps, each the median colour of its pixels (a median, so lines crossing the band don't tint it) */
function foldMedian(G,P,first,len,okIdx,T,skip){const M=Math.max(24,Math.min(400,Math.round(T))),bin=new Int32Array(G.L.length).fill(-1);
  for(let i=0;i<G.L.length;i++){const pi=P.idx[i],t=pi-first;if(t<0||t>=len||!okIdx[pi]||skip&&skip[i])continue;bin[i]=Math.floor(((t%T)/T)*M)%M}
  return binMedians(G,bin,M).filter(Boolean)}
/* the median Lab of each bin's pixels (bin[i]: 0…M-1, or -1 = left out); null for an empty bin. The pixels are grouped into one
   typed array per channel and each bin sorted numerically: sorting plain arrays with a comparator took half of a reading's time */
function binMedians(G,bin,M){const cnt=new Int32Array(M+1);for(let i=0;i<bin.length;i++)if(bin[i]>=0)cnt[bin[i]+1]++;
  for(let b=0;b<M;b++)cnt[b+1]+=cnt[b];const at=cnt.slice(0,M),tot=cnt[M],L=new Float32Array(tot),A=new Float32Array(tot),B=new Float32Array(tot);
  for(let i=0;i<bin.length;i++){const b=bin[i];if(b<0)continue;const k=at[b]++;L[k]=G.L[i];A[k]=G.A[i];B[k]=G.B[i]}
  const out=new Array(M);for(let b=0;b<M;b++){const s=cnt[b],e=cnt[b+1];if(e===s){out[b]=null;continue}const m=s+((e-s)>>1);
    out[b]=[L.subarray(s,e).sort()[m-s],A.subarray(s,e).sort()[m-s],B.subarray(s,e).sort()[m-s]]}
  return out}
function settBands(labs,minShare){
  let bands=labs.map(lab=>({lab,w:1,steps:[lab]}));
  const mergeInto=(to,k)=>{const x=bands[to],y=bands[k],w=x.w+y.w;bands[to]={lab:x.lab.map((v,i)=>(v*x.w+y.lab[i]*y.w)/w),w,steps:to<k?[...x.steps,...y.steps]:[...y.steps,...x.steps]};bands.splice(k,1)};
  const nb=i=>(i+1)%bands.length,merge=i=>{const j=nb(i);if(j===0){bands.unshift(bands.pop());mergeInto(0,1)}else mergeInto(i,j)};
  // merge the most alike neighbours while they are hard to tell apart, or while there are too many
  for(;;){if(bands.length<3)break;let bi=-1,bd=1e9;for(let i=0;i<bands.length;i++){const d=dE00(bands[i].lab,bands[nb(i)].lab);if(d<bd){bd=d;bi=i}}
    if(bd>=5&&bands.length<=24)break;merge(bi)}
  // a band one or two steps wide whose colour lies between its two neighbours is the blur where they meet, not a band of its own
  // (a real pinline is darker or lighter than both and stays)
  const between=(c,a,b)=>{const ab=a.map((v,i)=>b[i]-v),t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(c[i]-a[i]),0)/(ab.reduce((s,v)=>s+v*v,0)||1)));
    return Math.hypot(...c.map((v,i)=>v-(a[i]+t*ab[i])))<Math.max(6,.25*Math.hypot(...ab))&&t>.1&&t<.9};   // a camera's blend of two colours bows away from the straight line in Lab
  for(let pass=0;pass<40&&bands.length>2;pass++){const k=bands.findIndex((b,i)=>b.w<=2.5&&between(b.lab,bands[(i+bands.length-1)%bands.length].lab,bands[nb(i)].lab));if(k<0)break;
    const p=(k+bands.length-1)%bands.length,q=nb(k);mergeInto(dE00(bands[k].lab,bands[p].lab)<dE00(bands[k].lab,bands[q].lab)?p:q,k)}
  // slivers (the blur between two bands) join the neighbour they look most like; then neighbours that became alike merge
  for(let pass=0;pass<12;pass++){const tot=bands.reduce((s,b)=>s+b.w,0);const k=bands.findIndex(b=>b.w/tot<minShare);if(k<0||bands.length<3)break;
    const p=(k+bands.length-1)%bands.length,q=nb(k),to=dE00(bands[k].lab,bands[p].lab)<dE00(bands[k].lab,bands[q].lab)?p:q;mergeInto(to,k)}
  for(let i=0;i<bands.length&&bands.length>2;){if(dE00(bands[i].lab,bands[nb(i)].lab)<5)merge(i);else i++}
  // a sequence that is k copies of itself (the repeat was taken k times over) keeps one copy
  for(let k=4;k>=2;k--){if(bands.length%k)continue;const n=bands.length/k;
    if(bands.every((b,i)=>i<n||dE00(b.lab,bands[i%n].lab)<6&&Math.abs(b.w-bands[i%n].w)<=Math.max(2,bands[i%n].w*.25))){bands=bands.slice(0,n).map((b,i)=>({lab:b.lab,w:bands.filter((_,j)=>j%n===i).reduce((s,x)=>s+x.w,0),steps:b.steps}));break}}
  // a narrow band (a pinstripe, a pinline) is blurred into its neighbours by the camera: its colour is its strongest step
  // (the one furthest from the colour around it) and its width the steps at half that contrast or more
  if(bands.length>=2)bands=bands.map((b,i)=>{if(b.w/bands.reduce((s,x)=>s+x.w,0)>.2)return b;
    const nb2=[bands[(i+bands.length-1)%bands.length],bands[(i+1)%bands.length]],ground=nb2[0].w>=nb2[1].w?nb2[0].lab:nb2[1].lab;
    const con=b.steps.map(st=>dE00(st,ground)),pk=Math.max(...con),k=con.indexOf(pk);if(pk<5)return b;   // (a blue line on khaki linen is about 7)
    return {lab:b.steps[k],w:Math.max(1,con.filter(c=>c>=pk*.5).length),steps:b.steps}});
  const tot=bands.reduce((s,b)=>s+b.w,0);return bands.map(b=>({lab:b.lab,w:b.w/tot}))}
/* the sett of a rectangle of a canvas (sx, sy, sw, sh in its pixels). The directions are found on a 320px copy; the bands and
   lines are measured on a sharper one (up to 900px), so a pinstripe a pixel or two wide keeps its width and colour. */
const detrend=(a,w)=>{const n=a.length,pre=[0];for(const v of a)pre.push(pre[pre.length-1]+v);   // minus a moving average: slow light falloff and folds go
  return a.map((v,i)=>{const lo=Math.max(0,i-w),hi=Math.min(n,i+w+1);return v-(pre[hi]-pre[lo])/(hi-lo)})};
function analyzeSett(src,sx,sy,sw,sh,opt={}){
  const g0=labGrid(src,sx,sy,sw,sh,320),n0=g0.L.length;
  // how far each pixel is from the cloth's own colour: a light-blue line on khaki linen barely differs in lightness, but here it
  // stands out (directions are read from this, not from lightness alone)
  const med=a=>{const v=Float32Array.from(a).sort();return v[v.length>>1]},m0=[med(g0.L),med(g0.A),med(g0.B)],E=new Float32Array(n0);
  for(let i=0;i<n0;i++)E[i]=Math.hypot(g0.L[i]-m0[0],g0.A[i]-m0[1],g0.B[i]-m0[2]);
  const Bl=boxBlurWH(boxBlurWH(E,g0.W,g0.H),g0.W,g0.H);
  let jxx=0,jyy=0,jxy=0;for(let y=1;y<g0.H-1;y++)for(let x=1;x<g0.W-1;x++){const p=(X,Y)=>Bl[Y*g0.W+X];
    const gx=(p(x+1,y-1)+2*p(x+1,y)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x-1,y)+p(x-1,y+1)),gy=(p(x-1,y+1)+2*p(x,y+1)+p(x+1,y+1))-(p(x-1,y-1)+2*p(x,y-1)+p(x+1,y-1));
    jxx+=gx*gx;jyy+=gy*gy;jxy+=gx*gy}
  const coh=Math.sqrt((jxx-jyy)**2+4*jxy*jxy)/((jxx+jyy)||1);
  const keepOf=(c,G)=>c.map(v=>v>=Math.min(G.W,G.H)/3);
  // the main direction: the projection whose colour (L*, chroma at half weight) varies most. A jacket's, shirt's or trousers'
  // pattern is straight in the photo, so only upright and level are tried (a few degrees either way); a tie's can be any angle
  const colVar=ang=>{const P=projIdx(g0.W,g0.H,ang),l=projAvg(g0.L,P),a=projAvg(g0.A,P),b=projAvg(g0.B,P),k=keepOf(l.cnt,g0),pick=v=>v.avg.filter((_,i)=>k[i]);return variance(pick(l))+.5*(variance(pick(a))+variance(pick(b)))};
  const starts=opt.straight?[0,Math.PI/2]:coh<.1?[.5*Math.atan2(2*jxy,jxx-jyy),0,Math.PI/2]:[.5*Math.atan2(2*jxy,jxx-jyy)];
  let th=starts[0],bv=-1;for(const t0 of starts)for(let dd=opt.straight?-6:-8;dd<=(opt.straight?6:8);dd+=.5){const a=t0+dd*Math.PI/180,v=colVar(a);if(v>bv){bv=v;th=a}}th=normAng(th);
  if(bv<.4)return null;   // nothing varies across the cloth: a plain one
  // the crossing direction, on the small copy: the residual (each pixel minus its main band, in colour), detrended, varies most
  // across it (in colour: a light-blue line on khaki barely differs in lightness)
  const P0=projIdx(g0.W,g0.H,th),L0=projAvg(g0.L,P0),A0=projAvg(g0.A,P0),B0=projAvg(g0.B,P0),r0=[new Float32Array(n0),new Float32Array(n0),new Float32Array(n0)];
  for(let i=0;i<n0;i++){const pi=P0.idx[i];r0[0][i]=g0.L[i]-L0.avg[pi];r0[1][i]=g0.A[i]-A0.avg[pi];r0[2][i]=g0.B[i]-B0.avg[pi]}
  const resProj=(G,res,d,Q=projIdx(G.W,G.H,th+d*Math.PI/180))=>{const r=projAvg(res,Q),k=keepOf(r.cnt,G),f0=k.indexOf(true),f1=k.lastIndexOf(true),rp=r.avg.slice(f0,f1+1);
    return {Q,f0,rp:detrend(rp,Math.max(9,Math.round(rp.length*.2)))}};
  const colourVar=(G,rs,d)=>{const Q=projIdx(G.W,G.H,th+d*Math.PI/180),v=rs.map(r=>variance(resProj(G,r,d,Q).rp));return v[0]+.5*(v[1]+v[2])};
  let ca=0,cv=-1;for(let d=30;d<=150;d+=2){const v=colourVar(g0,r0,d);if(v>cv){cv=v;ca=d}}
  // the sharp copy, read in strips running along the lines: a draped cloth's lines wave, so one straight projection across the
  // whole picture smears them into nothing (a linen windowpane close-up showed no repeat at all). Within a strip a line is nearly
  // straight; the repeat is found from all the strips together, and each strip is shifted to line up with the others.
  const G=labGrid(src,sx,sy,sw,sh,Math.max(320,Math.min(900,Math.round(Math.max(sw,sh))))),{W,H}=G,n=W*H,K=8,w3=[1,.7,.7];
  const SP=stripProfiles(G,[G.L,G.A,G.B],th,K),first=SP.first,len=SP.len,prof={L:SP.whole[0],A:SP.whole[1],B:SP.whole[2]};
  // the repeat, in colour, with and without the slow drift (light falling off across a photo can look like a short repeat); the
  // drift-free one wins only when it is clearly the better match, both being scored on the drift-free strips (the drift itself
  // makes any short lag look alike); without a plain repeat it counts only above 0.75 (a plaid tie with no full repeat in view)
  const dt=v=>detrend(v,Math.max(9,Math.round(v.length*.35))),minLag=Math.max(8,Math.round(len*.02));   // not the weave's own texture
  const allC=SP.strips.flat(),allW=SP.strips.flatMap(()=>w3),D3=allC.map(dt);
  const pRaw=periodCh(allC,allW,minLag),pDt=periodCh(D3,allW,minLag),score=pp=>pp?corrAt(D3,allW,Math.round(pp.T)):-1;
  const pd=pRaw?(pDt&&score(pDt)>score(pRaw)?pDt:pRaw):(pDt&&pDt.corr>.75?pDt:null);
  const T0=pd&&pd.T<len*.8?pd.T:len;   // no repeat inside the picture: what is seen counts as one repeat
  let T=T0;const shift=stripShifts(SP.strips.map(st=>st.map(dt)),w3,Math.min(Math.floor(T/2),Math.round(len*.08)));
  // where matching the repeat is weak, sparse lines found one by one (lineModel) set the repeat instead
  const LM=(!pd||pd.corr<.6)?lineModel(SP.strips,Math.max(8,Math.round(len*.04))):null;if(LM)T=LM.T;
  const tAdj=new Float32Array(n);for(let i=0;i<n;i++){const pi=SP.P.idx[i],t=pi-first;tAdj[i]=t<0||t>=len||!SP.ok[pi]?-1:LM?LM.off(SP.grp[i],t):t+shift[SP.grp[i]]}
  // a line's peak can land on its core or on a lighter edge strip by strip: each strip's folded repeat is nudged (a few steps)
  // to match the most distinct one, so the line comes out sharp
  if(LM){const Mf=Math.max(24,Math.min(400,Math.round(T))),f=Array.from({length:K},()=>[0,1,2].map(()=>new Float64Array(Mf))),fc=Array.from({length:K},()=>new Float64Array(Mf));
    for(let i=0;i<n;i++){if(tAdj[i]<0)continue;const g=SP.grp[i],q=Math.floor(tAdj[i]/T*Mf)%Mf;f[g][0][q]+=G.L[i];f[g][1][q]+=G.A[i];f[g][2][q]+=G.B[i];fc[g][q]++}
    const folds=f.map((ch,g)=>ch.map(a=>{const v=[...a].map((x,q)=>fc[g][q]?x/fc[g][q]:NaN),m=v.filter(x=>!isNaN(x)),mm=m.reduce((a,b)=>a+b,0)/(m.length||1);return v.map(x=>isNaN(x)?mm:x)}));
    // circular: three copies so a shift wraps round
    const nudge=stripShifts(folds.map(ch=>ch.map(a=>[...a,...a,...a])),w3,Math.max(2,Math.round(Mf*.06)));
    for(let i=0;i<n;i++)if(tAdj[i]>=0)tAdj[i]=((tAdj[i]+nudge[SP.grp[i]]*T/Mf)%T+T)%T}
  // each pixel's band (the median of its step in the lined-up repeat), so what is left over is the crossing lines
  const F0=foldBins(G,tAdj,T,null),M0=F0.labs.length,_dbg=self.SETT_DEBUG&&console.log('fold b*',F0.labs.map(l=>l?Math.round(l[2]):'-').join(','),' L',F0.labs.map(l=>l?Math.round(l[0]):'-').join(',')),binOf=t=>Math.floor((((t%T)+T)%T)/T*M0)%M0;
  const cvMain=variance(prof.L)+.5*(variance(prof.A)+variance(prof.B));let cross=null,inLine=null;
  if(self.SETT_DEBUG)console.log('sett',JSON.stringify({W,H,coh:+coh.toFixed(2),bv:+bv.toFixed(2),th:Math.round(th*180/Math.PI),T:+T.toFixed(1),lines:LM&&{T:LM.T,cv:+LM.cv.toFixed(2),n:LM.pk.map(p=>p.length)},len,cv:+cv.toFixed(2),ca,cvMain:+cvMain.toFixed(1),shift}));
  if(cv>Math.max(1,cvMain*.005)){   // lines of about 1 unit of colour or more stand out, whatever the main stripes do
    const rs=[new Float32Array(n),new Float32Array(n),new Float32Array(n)];
    for(let i=0;i<n;i++){const lab=tAdj[i]<0?[G.L[i],G.A[i],G.B[i]]:F0.labs[binOf(tAdj[i])];rs[0][i]=G.L[i]-lab[0];rs[1][i]=G.A[i]-lab[1];rs[2][i]=G.B[i]-lab[2]}
    const cang=th+ca*Math.PI/180,SC=stripProfiles(G,rs,cang,K),lenC=SC.len,DC=SC.strips.map(st=>st.map(v=>detrend(v,Math.max(9,Math.round(v.length*.2)))));
    const cp=periodCh(DC.flat(),DC.flatMap(()=>w3),Math.max(8,Math.round(lenC*.04))),   // crossing lines are never as close as the weave's texture
      LC=(!cp||cp.corr<.6)?lineModel(DC,Math.max(8,Math.round(lenC*.04))):null,
      Tc=LC?LC.T:cp&&cp.T<lenC*.8?cp.T:lenC,shC=stripShifts(DC,w3,Math.min(Math.floor(Tc/2),Math.round(lenC*.08)));
    const tc=new Float32Array(n);for(let i=0;i<n;i++){const pi=SC.P.idx[i],t=pi-SC.first;tc[i]=t<0||t>=lenC||!SC.ok[pi]?-1:LC?LC.off(SC.grp[i],t):t+shC[SC.grp[i]]}
    // one repeat of the residual, lined up, in colour and smoothed: where it stands out are the lines. Each step's kind is its
    // strongest direction of change (lighter, darker, bluer, yellower, redder, greener), so neighbouring lines stay apart
    const M=Math.max(24,Math.min(400,Math.round(Tc))),fold=[0,1,2].map(()=>new Float64Array(M)),fc=new Float64Array(M),qOf=t=>Math.floor((((t%Tc)+Tc)%Tc)/Tc*M)%M;
    for(let i=0;i<n;i++){if(tc[i]<0)continue;const q=qOf(tc[i]);fold[0][q]+=rs[0][i];fold[1][q]+=rs[1][i];fold[2][q]+=rs[2][i];fc[q]++}
    const sm=f=>{const v=[...f].map((x,q)=>x/(fc[q]||1)),mv=v.reduce((a,b)=>a+b,0)/M;return v.map((_,q)=>(v[(q+M-1)%M]+2*v[q]+v[(q+1)%M])/4-mv)},fl=fold.map(sm);
    const mag=fl[0].map((v,q)=>Math.hypot(v,.85*fl[1][q],.85*fl[2][q])),mm=mag.reduce((a,b)=>a+b,0)/M,msd=Math.sqrt(variance(mag));
    const thr=Math.min(mm+1.1*msd,.6*Math.max(...mag));   // (a gingham's even square wave is all lines: .6 of the peak)
    const kindOf=q=>{const c=[fl[0][q],.85*fl[1][q],.85*fl[2][q]];let k=0;for(let j=1;j<3;j++)if(Math.abs(c[j])>Math.abs(c[k]))k=j;return (k+1)*Math.sign(c[k])};
    const lvl=mag.map((m,q)=>m>thr?kindOf(q):0);
    for(let q=0;q<M;q++)if(lvl[q]&&lvl[(q+M-1)%M]!==lvl[q]&&lvl[(q+1)%M]!==lvl[q])lvl[q]=0;   // a line is at least two steps wide
    // runs of one kind; each line run gets its own thread colour (a tattersall's red and green lines stay apart):
    // a crossing is about half band, half thread, so thread = 2 x pixel - band
    const rid=new Int32Array(M).fill(-1),runs=[];for(let q=0;q<M;q++){if(q&&lvl[q]===lvl[q-1])rid[q]=runs.length-1;else{runs.push({l:lvl[q],w:0,s:[0,0,0,0],v:[0,0,0]});rid[q]=runs.length-1}runs[rid[q]].w++;
      const ru=runs[rid[q]];ru.v[0]+=fl[0][q];ru.v[1]+=fl[1][q];ru.v[2]+=fl[2][q]}
    if(runs.length>1&&runs[0].l===runs[runs.length-1].l){const a=runs.pop();runs[0].w+=a.w;runs[0].v=runs[0].v.map((x,j)=>x+a.v[j]);for(let q=0;q<M;q++)if(rid[q]===runs.length)rid[q]=0}
    // the pixels under the lines are left out when the bands are measured; with lines nearly all across (a gingham's
    // alternating weft) only those of the scarcer kinds are, or nothing would be left
    const lineW=runs.filter(r=>r.l).reduce((a,r)=>a+r.w,0),kinds={};for(const r of runs)if(r.l)kinds[r.l]=(kinds[r.l]||0)+r.w;
    const keepKind=lineW>.6*M?+Object.entries(kinds).sort((a,b)=>b[1]-a[1])[0][0]:null;
    inLine=new Uint8Array(n);
    for(let i=0;i<n;i++){if(tc[i]<0)continue;const ru=runs[rid[qOf(tc[i])]];if(!ru||!ru.l)continue;
      if(ru.l!==keepKind)inLine[i]=1;
      if(rs[0][i]*ru.v[0]+rs[1][i]*ru.v[1]+rs[2][i]*ru.v[2]<=0)continue;   // this pixel leans the line's way
      const b=[G.L[i]-rs[0][i],G.A[i]-rs[1][i],G.B[i]-rs[2][i]];ru.s[0]+=2*G.L[i]-b[0];ru.s[1]+=2*G.A[i]-b[1];ru.s[2]+=2*G.B[i]-b[2];ru.s[3]++}
    const labOfRun=ru=>{if(!ru.s[3])return null;const a=ru.s[1]/ru.s[3],b=ru.s[2]/ru.s[3],C=Math.hypot(a,b),k=C>70?70/C:1;   // capped: a cloth is not neon
      return [Math.max(0,Math.min(100,ru.s[0]/ru.s[3])),a*k,b*k]};
    // threads that look alike share one colour (so the drawing isn't speckled with near-identical shades)
    const cols=[];for(const ru of runs){const lab=ru.l&&labOfRun(ru);if(!lab){ru.hex=null;continue}let c=cols.find(c=>dE00(c.lab,lab)<10);if(!c){c={lab,n:0,sum:[0,0,0]};cols.push(c)}c.n++;c.sum=c.sum.map((v,k)=>v+lab[k]);ru.c=c}
    for(const c of cols)c.hex=labHex(c.sum.map(v=>v/c.n));
    const out=[];for(const ru of runs){const h=ru.l&&ru.c?ru.c.hex:null;if(out.length&&out[out.length-1][0]===h)out[out.length-1][1]+=ru.w;else out.push([h,ru.w])}
    if(out.some(x=>x[0]))cross={d:ca,bands:out.map(([c,w])=>[c,+(w/M).toFixed(3)]),r:+Math.max(.2,Math.min(5,Tc/T)).toFixed(2)};else inLine=null;
    if(self.SETT_DEBUG)console.log('cross',JSON.stringify({Tc:+Tc.toFixed(1),lines:!!LC,len:lenC,thr:+thr.toFixed(2),runs:runs.length,cols:cols.map(c=>c.hex),shC}));
  }
  // the bands: per-step medians of the lined-up repeat, leaving out the pixels under crossing lines (a gingham's white stays white)
  const bands=settBands(foldBins(G,tAdj,T,inLine).labs.filter(Boolean),.008);if(bands.length<2)return null;
  // start the repeat at its widest band, so the drawing and the description agree on where it begins
  let si=0;bands.forEach((b,i)=>{if(b.w>bands[si].w)si=i});const ord=bands.slice(si).concat(bands.slice(0,si));
  return {v:2,a:Math.round(th*180/Math.PI),bands:ord.map(b=>[labHex(b.lab),+b.w.toFixed(3)]),cross,cr:+Math.max(.3,Math.min(60,Math.min(W,H)/T)).toFixed(2)}}
/* sparse lines (a windowpane, a pinstripe): each line found on its own in every strip. A draped cloth spaces its lines a little
   unevenly (a linen windowpane's panes ran 165 +- 15 px), which defeats matching the whole repeat; lining every pixel up on its
   own nearest line does not care. Lines are where the colour stands out from its surroundings (a moving average), at least
   minSep apart, and found in at least three of the strips; the model holds when there are two or more per strip and their gaps
   vary by under 25%. */
function linePeaks(chs,minSep){const n=chs[0].length,w=Math.max(9,Math.round(n*.12)),base=chs.map(ch=>{const d=detrend(ch,w);return d});
  const e0=base[0].map((v,i)=>Math.hypot(v,.85*base[1][i],.85*base[2][i])),e=e0.map((v,i)=>((e0[i-1]??v)+2*v+(e0[i+1]??v))/4);
  const m=e.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(variance(e)),thr=Math.max(2.5,m+1.5*sd),cand=[];
  for(let i=1;i<n-1;i++)if(e[i]>thr&&e[i]>=e[i-1]&&e[i]>=e[i+1])cand.push(i);
  cand.sort((a,b)=>e[b]-e[a]);const keep=[];for(const c of cand)if(keep.every(k=>Math.abs(k-c)>=minSep))keep.push(c);return keep.sort((a,b)=>a-b)}
function lineModel(strips,minSep){const raw=strips.map(st=>linePeaks(st,minSep)),tol=Math.max(minSep,Math.round(strips[0][0].length*.05));
  // a line runs through the cloth: it is kept only where several strips have it at about the same place (a slub, a fold or
  // moire shows in one); with fewer than three strips any peak counts
  const need=Math.max(2,Math.ceil(strips.length*.4)-1);   // other strips that must have it too (3 of 4, 4 of 8)
  const pk=raw.map((p,g)=>strips.length<3?p:p.filter(v=>raw.filter((q,h)=>h!==g&&q.some(w=>Math.abs(w-v)<=tol)).length>=need));
  if(pk.some(p=>p.length<2))return null;
  const gaps=pk.flatMap(p=>p.slice(1).map((v,i)=>v-p[i])).sort((a,b)=>a-b),T=gaps[gaps.length>>1],mean=gaps.reduce((a,b)=>a+b,0)/gaps.length;
  // a gap that skips one line (a faint line missed) counts as two
  const norm=gaps.map(g=>g/T>1.7?g/Math.round(g/T):g),sd=Math.sqrt(variance(norm)),cv=sd/(norm.reduce((a,b)=>a+b,0)/norm.length);
  if(cv>.25||T<minSep)return null;
  // each position's offset from its nearest line in its strip (the line at 0, both sides wrapping into one repeat)
  const near=(p,t)=>{let b=p[0];for(const v of p)if(Math.abs(v-t)<Math.abs(b-t))b=v;return b};
  return {T,pk,cv,off:(g,t)=>{const o=t-near(pk[g],t);return ((o%T)+T)%T}}}
/* profiles of a grid along an angle, whole and in K strips running along the lines (within a strip a wavy line is nearly
   straight). Steps without enough pixels in a strip take the whole profile's value. */
function stripProfiles(G,chans,ang,K){
  const {W,H}=G,n=W*H,P=projIdx(W,H,ang),cs=Math.cos(ang),sn=Math.sin(ang),u=new Float32Array(n);let lo=1e9,hi=-1e9;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=-(x-W/2)*sn+(y-H/2)*cs;u[y*W+x]=v;if(v<lo)lo=v;if(v>hi)hi=v}
  const grp=new Uint8Array(n),span=(hi-lo)/K||1;for(let i=0;i<n;i++)grp[i]=Math.max(0,Math.min(K-1,Math.floor((u[i]-lo)/span)));   // (u is single precision: its smallest can fall a hair below lo)
  const C=chans.length,sum=chans.map(()=>new Float64Array(P.len)),cnt=new Float64Array(P.len),ss=Array.from({length:K},()=>chans.map(()=>new Float64Array(P.len))),sc=Array.from({length:K},()=>new Float64Array(P.len));
  for(let i=0;i<n;i++){const t=P.idx[i],g=grp[i];cnt[t]++;sc[g][t]++;for(let c=0;c<C;c++){const v=chans[c][i];sum[c][t]+=v;ss[g][c][t]+=v}}
  const minC=Math.min(W,H)/3,ok=[...cnt].map(v=>v>=minC),first=ok.indexOf(true),last=ok.lastIndexOf(true),len=last-first+1;
  const whole=chans.map((_,c)=>{const a=[];for(let t=first;t<=last;t++)a.push(sum[c][t]/cnt[t]);return a});
  const strips=ss.map((sg,g)=>chans.map((_,c)=>{const a=[];for(let t=first;t<=last;t++)a.push(sc[g][t]>=minC/K/2?sg[c][t]/sc[g][t]:whole[c][t-first]);return a}));
  return {P,grp,first,len,whole,strips,ok}}
/* how far to shift each strip (at most max steps) to line up with the most varied one */
function stripShifts(strips,wts,max){
  const v0=s=>s.reduce((a,ch,c)=>a+wts[c]*variance(ch),0),ref=strips.reduce((b,s,k)=>v0(s)>v0(strips[b])?k:b,0),R=strips[ref];
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,Rm=R.map(mean);
  return strips.map((s,k)=>{if(k===ref||max<1)return 0;const Sm=s.map(mean);let best=0,bv=-1e18;
    for(let d=-max;d<=max;d++){let v=0;for(let c=0;c<s.length;c++){const ch=s[c],r=R[c];for(let i=Math.max(0,-d);i<ch.length&&i+d<r.length;i++)v+=wts[c]*(ch[i]-Sm[c])*(r[i+d]-Rm[c])}if(v>bv){bv=v;best=d}}return best})}
/* one repeat in M steps from pixels' lined-up positions (t; -1 = outside), each step the median colour of its pixels (a median,
   so lines crossing the band don't tint it); steps with no pixels are null */
function foldBins(G,tAdj,T,skip){const M=Math.max(24,Math.min(400,Math.round(T))),bin=new Int32Array(G.L.length).fill(-1);
  for(let i=0;i<G.L.length;i++){const t=tAdj[i];if(t<0||skip&&skip[i])continue;bin[i]=Math.floor((((t%T)+T)%T)/T*M)%M}
  let labs=binMedians(G,bin,M);
  if(labs.every(l=>!l))return {labs};const fill=labs.slice();for(let q=0;q<M;q++)if(!fill[q]){let d=1;while(!labs[(q+d)%M]&&!labs[(q-d+M)%M])d++;fill[q]=labs[(q+d)%M]||labs[(q-d+M)%M]}
  return {labs:skip?labs:fill}}
/* a sett from a whole canvas (its middle 90%): a close-up */
function settFromCanvas(c,box,opt){if(box){const b={x:box.x/1000*c.width,y:box.y/1000*c.height,w:box.w/1000*c.width,h:box.h/1000*c.height};return analyzeSett(c,b.x,b.y,b.w,b.h,opt)}
  return analyzeSett(c,c.width*.05,c.height*.05,c.width*.9,c.height*.9,opt)}
