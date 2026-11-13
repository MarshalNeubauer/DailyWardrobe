/* The master atlas, the computer's full measurement (tools/asm-atlas.js loads this into the app's page, so it uses the app's own
   decoding and colour maths from assemble.js). One master at a time: every pixel's colour, which part of the outfit it is, how much of
   it is that part, how far it is from the part's edge and which pixel beside it is the next part, how lit it is against its part's lit
   cloth (and, on the shirt, against the black calibration shirt), its fine detail, a rough surface direction from the shading, and the
   direction a weave runs there. Kept in window.__atl as typed arrays, one per property; tools/asm-atlas.js reads them out one by one. */
const ATLAS_PARTS=['background','jacket','lapelL','lapelR','sleeveL','sleeveR','shirt','cuffL','cuffR','tie','watch','waistcoat','skin'];
const ATLAS_PID=Object.fromEntries(ATLAS_PARTS.map((n,i)=>[n,i]));
/* layer -> [type, channels, scale (stored = value x scale), meaning] */
const ATLAS_LAYERS={
  rgb:['u8',3,1,'the photo\'s colour, R G B (sRGB, 0-255)'],
  lab:['i16',3,100,'CIE Lab (D65): L* 0-100, a*, b*'],
  part:['u8',1,1,'which part of the outfit (see parts; L and R as seen in the picture)'],
  cover:['u8',1,255,'share of the 5x5 pixels around it that are the same part (1 inside, less along an edge)'],
  edge:['u8',1,1,'distance to the nearest pixel of another part, in pixels (255 or more)'],
  toward:['i8',2,1,'offset (dx, dy) to the nearest pixel of another part, within 8 px (0, 0 when none is that near)'],
  shade:['u16',1,10000,'linear brightness over the part\'s lit cloth (its 90th percentile): 1 = lit, below 1 = in shadow'],
  black:['u16',1,10000,'shirt only: the black calibration shirt\'s brightness over its own lit cloth (0 elsewhere)'],
  detail:['i16',1,20000,'fine detail: linear brightness less the 7x7 mean around it (grain, weave, creases)'],
  normal:['i8',2,127,'rough surface direction from the shading (nx, ny; which way the surface turns toward the light), an estimate'],
  thread:['i16',1,100,'the direction a weave\'s width runs, degrees clockwise from the picture\'s x axis (y down); 32767 = none']};
window.atlasMeasure=async function({img,parts,calib}){
  const D=await asmData(img),W=D.width,N=W*W,px=D.data,LIN=ASM_LIN,t0=performance.now();
  const Y=new Float32Array(N);for(let k=0;k<N;k++){const j=4*k;Y[k]=.2126*LIN[px[j]]+.7152*LIN[px[j+1]]+.0722*LIN[px[j+2]]}
  // which part: lowest first, each later one over it
  const part=new Uint8Array(N),masks={};for(const [n,u] of Object.entries(parts||{}))if(u)masks[n]=await asmMaskFromImg(u,W);
  for(const n of ['jacket','sleeveL','sleeveR','lapelL','lapelR','shirt','waistcoat','tie','watch'])if(masks[n]){const m=masks[n],id=ATLAS_PID[n];for(let k=0;k<N;k++)if(m[k])part[k]=id}
  // connected regions of one label (4-neighbours): [{n, pix:Int32Array}]
  const regions=(test)=>{const seen=new Uint8Array(N),out=[];for(let s=0;s<N;s++){if(seen[s]||!test(s))continue;const st=[s],pix=[];seen[s]=1;
    while(st.length){const k=st.pop(),x=k%W;pix.push(k);for(const q of [x>0?k-1:-1,x<W-1?k+1:-1,k-W,k+W])if(q>=0&&q<N&&!seen[q]&&test(q)){seen[q]=1;st.push(q)}}out.push(pix)}return out};
  // the shirt's front with its collar is its biggest region; the others are the cuffs, left and right as seen in the picture
  // (a strip of shirt cut off by a waistcoat stays shirt: a cuff lies in the lower half of the picture)
  {const r=regions(k=>part[k]===ATLAS_PID.shirt).sort((a,b)=>b.length-a.length);for(const pix of r.slice(1)){let sx=0,sy=0;for(const k of pix){sx+=k%W;sy+=(k/W)|0}if(sy/pix.length<W*.45)continue;
    const id=sx/pix.length<W/2?ATLAS_PID.cuffL:ATLAS_PID.cuffR;for(const k of pix)part[k]=id}}
  // skin: what no zone claims, skin-coloured, in regions of at least 0.1% of the picture (the hands, the neck)
  const lab=asmLab(D);
  {const skin=k=>{if(part[k])return false;const L=lab[3*k],a=lab[3*k+1],b=lab[3*k+2];return L>20&&L<88&&a>5&&a<38&&b>8&&b<45&&b>a*.6};
    for(const pix of regions(skin))if(pix.length>=N*.001)for(const k of pix)part[k]=ATLAS_PID.skin}
  // cover: the same part around it (5x5)
  const cover=new Uint8Array(N);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const k=y*W+x,p=part[k];let s=0,n=0;
    for(let dy=-2;dy<=2;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-2;dx<=2;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;n++;if(part[yy*W+xx]===p)s++}}cover[k]=Math.round(255*s/n)}
  // edge: distance to another part (chamfer 3-4, from the pixels that touch another part)
  const d=new Float32Array(N).fill(1e9);for(let k=0;k<N;k++){const x=k%W,p=part[k];if((x>0&&part[k-1]!==p)||(x<W-1&&part[k+1]!==p)||(k>=W&&part[k-W]!==p)||(k+W<N&&part[k+W]!==p))d[k]=0}
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const k=y*W+x;let v=d[k];if(x>0)v=Math.min(v,d[k-1]+3);if(y>0){v=Math.min(v,d[k-W]+3);if(x>0)v=Math.min(v,d[k-W-1]+4);if(x<W-1)v=Math.min(v,d[k-W+1]+4)}d[k]=v}
  for(let y=W-1;y>=0;y--)for(let x=W-1;x>=0;x--){const k=y*W+x;let v=d[k];if(x<W-1)v=Math.min(v,d[k+1]+3);if(y<W-1){v=Math.min(v,d[k+W]+3);if(x<W-1)v=Math.min(v,d[k+W+1]+4);if(x>0)v=Math.min(v,d[k+W-1]+4)}d[k]=v}
  const edge=new Uint8Array(N);for(let k=0;k<N;k++)edge[k]=Math.min(255,Math.round(d[k]/3));
  // toward: the nearest pixel of another part within 8 px
  const toward=new Int8Array(2*N),R=8;for(let k=0;k<N;k++){if(edge[k]>R)continue;const x=k%W,y=(k/W)|0,p=part[k];let best=1e9,bx=0,by=0;
    for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=W)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const q=dx*dx+dy*dy;if(q<best&&part[yy*W+xx]!==p){best=q;bx=dx;by=dy}}}
    if(best<1e9){toward[2*k]=bx;toward[2*k+1]=by}}
  // each part's lit cloth (the 90th percentile of its inner pixels), its middle, its long axis
  const stats=ATLAS_PARTS.map((name,id)=>({id,name,pixels:0}));const lit=new Float32Array(ATLAS_PARTS.length).fill(1);
  {const vals=ATLAS_PARTS.map(()=>[]),acc=ATLAS_PARTS.map(()=>({n:0,sx:0,sy:0,sxx:0,syy:0,sxy:0,x0:W,y0:W,x1:0,y1:0,L:[],a:[],b:[]}));
    for(let k=0;k<N;k++){const p=part[k],A=acc[p],x=k%W,y=(k/W)|0;A.n++;A.sx+=x;A.sy+=y;A.sxx+=x*x;A.syy+=y*y;A.sxy+=x*y;if(x<A.x0)A.x0=x;if(x>A.x1)A.x1=x;if(y<A.y0)A.y0=y;if(y>A.y1)A.y1=y;
      if(cover[k]===255){vals[p].push(Y[k]);if((k&7)===0){A.L.push(lab[3*k]);A.a.push(lab[3*k+1]);A.b.push(lab[3*k+2])}}}
    const med=v=>{if(!v.length)return null;v.sort((p,q)=>p-q);return +v[v.length>>1].toFixed(1)};
    for(let p=0;p<ATLAS_PARTS.length;p++){const A=acc[p],v=vals[p];if(!A.n)continue;v.sort((a,b)=>a-b);lit[p]=v.length?v[Math.floor(v.length*.9)]:1;
      const mx=A.sx/A.n,my=A.sy/A.n,th=.5*Math.atan2(2*(A.sxy/A.n-mx*my),(A.sxx/A.n-mx*mx)-(A.syy/A.n-my*my));
      Object.assign(stats[p],{pixels:A.n,share:+(A.n/N).toFixed(5),box:[A.x0,A.y0,A.x1,A.y1],centre:[+mx.toFixed(1),+my.toFixed(1)],axis:+(th*180/Math.PI).toFixed(1),lit:+lit[p].toFixed(4),lab:[med(A.L),med(A.a),med(A.b)]})}}
  // the weave's direction: upright on the front, the collar, the jacket, the lapels and the waistcoat; along the arm on each cuff (its
  // width follows the band round the wrist); along the length of a sleeve and of the tie (their width across it)
  const along=new Set(['sleeveL','sleeveR','tie']),band=new Set(['cuffL','cuffR']),none=new Set(['background','skin','watch']);
  const norm=t=>{while(t>90)t-=180;while(t<=-90)t+=180;return t};
  for(const s of stats){if(!s.pixels||none.has(s.name)){s.thread=null;continue}s.thread=+norm(band.has(s.name)?s.axis:along.has(s.name)?s.axis+90:0).toFixed(1)}
  // the layers
  const rgb=new Uint8Array(3*N),labI=new Int16Array(3*N),shade=new Uint16Array(N),black=new Uint16Array(N),detail=new Int16Array(N),normal=new Int8Array(2*N),thread=new Int16Array(N);
  for(let k=0;k<N;k++){const j=4*k;rgb[3*k]=px[j];rgb[3*k+1]=px[j+1];rgb[3*k+2]=px[j+2];for(let c=0;c<3;c++)labI[3*k+c]=Math.round(lab[3*k+c]*100);
    const p=part[k];shade[k]=Math.min(65535,Math.round(Y[k]/lit[p]*10000));const th=stats[p].thread;thread[k]=th===null||th===undefined?32767:Math.round(th*100)}
  if(calib){const C=(await asmData(calib,W)).data,Yc=new Float32Array(N),sh=[];const isShirt=p=>p===ATLAS_PID.shirt||p===ATLAS_PID.cuffL||p===ATLAS_PID.cuffR;
    for(let k=0;k<N;k++){const j=4*k;Yc[k]=.2126*LIN[C[j]]+.7152*LIN[C[j+1]]+.0722*LIN[C[j+2]];if(isShirt(part[k])&&cover[k]===255)sh.push(Yc[k])}
    sh.sort((a,b)=>a-b);const lc=sh.length?sh[Math.floor(sh.length*.9)]:1;for(let k=0;k<N;k++)if(isShirt(part[k]))black[k]=Math.min(65535,Math.round(Yc[k]/lc*10000))}
  const box=(src,r)=>{const t=new Float32Array(N),o=new Float32Array(N),cl=v=>v<0?0:v>W-1?W-1:v,n=2*r+1;
    for(let y=0;y<W;y++){let s=0;for(let x=-r;x<=r;x++)s+=src[y*W+cl(x)];for(let x=0;x<W;x++){t[y*W+x]=s/n;s+=src[y*W+cl(x+r+1)]-src[y*W+cl(x-r)]}}
    for(let x=0;x<W;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[cl(y)*W+x];for(let y=0;y<W;y++){o[y*W+x]=s/n;s+=t[cl(y+r+1)*W+x]-t[cl(y-r)*W+x]}}return o};
  {const m=box(Y,3);for(let k=0;k<N;k++)detail[k]=Math.max(-32767,Math.min(32767,Math.round((Y[k]-m[k])*20000)))}
  {const lg=new Float32Array(N);for(let k=0;k<N;k++)lg[k]=Math.log(Y[k]+.01);const s=box(box(lg,4),4),sc=W/900;
    for(let y=1;y<W-1;y++)for(let x=1;x<W-1;x++){const k=y*W+x,gx=(s[k+1]-s[k-1])/2*sc,gy=(s[k+W]-s[k-W])/2*sc,nz=.05,l=Math.hypot(gx,gy,nz);normal[2*k]=Math.round(-gx/l*127);normal[2*k+1]=Math.round(-gy/l*127)}}
  window.__atl={rgb,lab:labI,part,cover,edge,toward,shade,black,detail,normal,thread};
  return {W,parts:stats.filter(s=>s.pixels),ms:Math.round(performance.now()-t0),layers:ATLAS_LAYERS,names:ATLAS_PARTS}};
/* one layer's bytes as base64 (little-endian, as typed arrays are on every computer this runs on) */
window.atlasLayer=name=>{const a=window.__atl[name],b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return btoa(s)};
/* pictures of some layers, to look at */
window.atlasPreviews=()=>{const A=window.__atl,W=Math.round(Math.sqrt(A.part.length)),N=W*W,pic=f=>{const c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d'),d=x.createImageData(W,W);
    for(let k=0;k<N;k++){const v=f(k);d.data[4*k]=v[0];d.data[4*k+1]=v[1];d.data[4*k+2]=v[2];d.data[4*k+3]=255}x.putImageData(d,0,0);return c.toDataURL('image/png')};
  const PAL=[[30,30,30],[110,110,120],[160,120,200],[200,120,160],[90,150,200],[90,200,160],[240,240,240],[250,200,80],[250,140,60],[40,170,80],[230,60,60],[150,90,40],[230,180,150]];
  return {part:pic(k=>PAL[A.part[k]]||[255,0,255]),shade:pic(k=>{const v=Math.min(255,A.shade[k]/10000*200);return [v,v,v]}),edge:pic(k=>{const v=255-Math.min(255,A.edge[k]*8);return [v,v,v]}),
    normal:pic(k=>[128+A.normal[2*k],128+A.normal[2*k+1],200]),detail:pic(k=>{const v=128+A.detail[k]/20000*600;return [v,v,v]}),
    thread:pic(k=>{const t=A.thread[k];if(t===32767)return [20,20,20];const h=(t/100+90)/180;return [255*Math.abs(Math.cos(Math.PI*h)),255*Math.abs(Math.sin(Math.PI*h)),160]})}};
