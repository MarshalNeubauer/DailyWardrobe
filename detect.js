/* Daily Wardrobe: pattern detection from item photos (main thread: needs canvas) */
/* Pattern detection from the item photo.
   - stripes:     1-D band sequence + angle            (stripe, pinstripe, chalk stripe)
   - checks:      two perpendicular band sequences      (check, gingham, tattersall, windowpane, glen check)
   Fine weaves (herringbone, birdseye, nailhead, sharkskin, twill) are not measured: a phone photo of a whole
   garment doesn't resolve them reliably, so they use drawn tiles with the correct orientation.
   Colours always come from the item's tagged colours, matched by brightness rank, so photo colour casts don't leak in. */
const STRIPE_PATS=['stripe','pinstripe','chalk-stripe'],CHECK_PATS=['check','gingham','tattersall','windowpane','glen-check'];
const DETECT_PATS=[...STRIPE_PATS,...CHECK_PATS];

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
function period(prof,minLag=6){
  const m=prof.reduce((a,b)=>a+b,0)/prof.length,P=prof.map(v=>v-m);
  const ac=l=>{let a=0,b=0,c=0;for(let i=0;i+l<P.length;i++){a+=P[i]*P[i+l];b+=P[i]*P[i];c+=P[i+l]*P[i+l]}return a/(Math.sqrt(b*c)||1)};
  const maxLag=Math.floor(P.length*.67),r=[];for(let l=0;l<=maxLag;l++)r.push(l<minLag-1?-1:ac(l));
  let best=-1,T=0;for(let l=minLag;l<maxLag;l++)if(r[l]>r[l-1]&&r[l]>=r[l+1]&&r[l]>best){best=r[l];T=l}
  if(!T||best<.35)return null;
  const half=Math.round(T/2);if(half>=minLag&&r[half]>.9*best&&r[half]>=r[half-1]&&r[half]>=r[half+1])T=half;
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

