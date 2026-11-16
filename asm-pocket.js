/* The day's pocket square on the painted outfit picture (2026-11-16, the owner's approved feature: "I really just want a square fold, a bit
   out of the pocket"). Loaded after asm-watch.js, on the page and in asm-worker.js. Like the watch (asm-watch.js) it works on the finished
   picture (assemble.js asmBuild: a JPEG, or raw pixels), only in the breast pocket's box and only for a look that has a pocket square, so
   no function in asm-color.js's hashed lists (asmCmCode / asmCmPrepCode) changes: every other look keeps its key and its pixels, and only
   the looks with a square are painted again (its own version ASM_POCKETV and the square's colours and pattern are in the look's key:
   asmPocketSig, from asm-color.js asmCmSig).
   - the fold: the square ("TV" or presidential) fold, a strip with a straight top edge parallel to the pocket's welt, ASM_POCKET_SHAPE.h px
     at 2048 (about 1.2 cm on the masters: the welt is 234 px for about 10.5 cm), from t0 to t1 along the welt's opening (clear of the
     lapel on the left, a little short of the welt's right end), crisp, not puffed, no points
   - where: the wearer's left chest (the viewer's right), the top edge of the breast pocket's welt measured on the masters' photos at 2048
     (C:\code\watch-test\colormaster\out-<kind>\colormaster-*.png): suit and suit-open share one welt, vest its own; the open-collar
     masters take their buttoned master's (ASM_POCKET_MASTER). The shirt masters have no jacket and no square.
   - the light: the jacket's own local light, read from the painted picture just above the pocket (its brightness over the box around the
     pocket, so a dark cloth's lift and a pinstripe don't count), left and right, times ASM_POCKET_LIT; a thin highlight along the fold's
     top edge, darker toward the pocket's mouth, and a slight shadow under the strip on the welt (and a little to its right: the window is
     on the left)
   - the cloth: the square's colour, its border along the top edge (the contrast edge folded to show), dots, a stripe, a check or a small
     figure in its second and third colours, a faint slub for white linen and woven squares
   Nothing of core.js may be read at load time (the picture worker has none): asmPocketJob works the colours out on the page. */
const ASM_POCKETV=1;
const ASM_POCKET_GEO={suit:{l:[1325,532],r:[1559,506]},vest:{l:[1323,532],r:[1558,504]}};   // the welt's top edge (its opening), left and right ends, at 2048
const ASM_POCKET_MASTER={'suit-open':'suit','vest-open':'vest'};
const ASM_POCKET_SHAPE={t0:.12,t1:.94,h:27};
const ASM_POCKET_LIT=.84;   // the strip's light against the chest's just above it (a white square read as a white sticker at .96)
/* the strip's corners at 2048: b0, b1 its bottom (on the welt's opening, left and right), t0, t1 its top; null on a master with no pocket */
function asmPocketQuad(kind){const g=ASM_POCKET_GEO[ASM_POCKET_MASTER[kind]||kind];if(!g)return null;const S=ASM_POCKET_SHAPE,at=t=>[g.l[0]+(g.r[0]-g.l[0])*t,g.l[1]+(g.r[1]-g.l[1])*t];
  const b0=at(S.t0),b1=at(S.t1);return {b0,b1,t0:[b0[0],b0[1]-S.h],t1:[b1[0],b1[1]-S.h]}}
/* what the look's key carries for its square (asm-color.js asmCmSig) */
const asmPocketSig=p=>['q'+ASM_POCKETV,colOf(p),p.pattern||'solid',p.secondaryColor||'',p.tertiaryColor||'',String(p.material||'')].join('/');
/* the job's part (assemble.js asmJob): what to paint, or null (no square, no jacket, a master with no pocket) */
function asmPocketJob(o,kind){const p=o&&o.pocket;if(!p||!o.top||!kind||!asmPocketQuad(kind))return null;
  const c=k=>k&&COLORS[k]?COLORS[k]:null,pat=typeof patBase==='function'?patBase(p.pattern)||'solid':p.pattern||'solid';
  return {kind,col:colOf(p),c2:c(p.secondaryColor),c3:c(p.tertiaryColor),pat,linen:/linen/.test(String(p.material||''))}}
/* paint the square on a finished picture: res {url} (a JPEG) or {px, S} (raw RGBA); returns res with the square painted */
async function asmPocketPaint(res,J){if(!res||!J)return res;let img=null,px,S;
  if(res.px){px=res.px;S=res.S}else if(res.url){img=await asmData(res.url);px=img.data;S=img.width}else return res;
  asmPocketDo(px,S,J);
  if(img)res.url=await asmJpeg(img);return res}
function asmPocketDo(px,S,J){const Q=asmPocketQuad(J.kind);if(!Q)return;const f=S/2048,L=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
  const gam=v=>{v=v<0?0:v>1?1:v;return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)};
  const hex=h=>[1,3,5].map(i=>L(parseInt(String(h).slice(i,i+2),16)||0));
  const P=k=>[Q[k][0]*f,Q[k][1]*f],b0=P('b0'),b1=P('b1'),t0=P('t0'),t1=P('t1'),H=ASM_POCKET_SHAPE.h*f,W=b1[0]-b0[0],slope=(b1[1]-b0[1])/W;
  const Y=(i)=>.2126*L(px[i])+.7152*L(px[i+1])+.0722*L(px[i+2]);
  const mean=(x0,x1,y0,y1)=>{let s=0,n=0;for(let y=Math.max(0,Math.round(y0));y<Math.min(S,Math.round(y1));y++)for(let x=Math.max(0,Math.round(x0));x<Math.min(S,Math.round(x1));x++){s+=Y(4*(y*S+x));n++}return n?s/n:0};
  // the local light: just above the strip (left and right thirds) over the box around the pocket
  const top=x=>t0[1]+(x-t0[0])*slope,bot=x=>b0[1]+(x-b0[0])*slope;
  const big=mean(b0[0]-60*f,b1[0]+40*f,t1[1]-90*f,b0[1]+120*f)||1e-3;
  const near=x=>mean(x-W/6,x+W/6,top(x)-22*f,top(x)-6*f)/big;
  const kl=Math.min(1.15,Math.max(.7,near(b0[0]+W/6))),kr=Math.min(1.15,Math.max(.7,near(b1[0]-W/6)));
  const C=hex(J.col),C2=J.c2?hex(J.c2):null,C3=J.c3?hex(J.c3):C2,u=f;   // u: one 2048 pixel
  // the cloth at a point of the strip (x along it from its left end, v down it 0..1): its colour in linear light
  const cloth=(x,v)=>{const X=x/u,Yv=v*ASM_POCKET_SHAPE.h;
    if(J.pat==='border'&&C2)return v<.3?C2:v<.36?C.map((c,i)=>c*.8+C2[i]*.2):C;
    if(J.pat==='polka-dot'&&C2){const g=9,row=Math.floor(Yv/g),cx=((X+(row%2)*g/2)%g+g)%g-g/2,cy=(Yv%g)-g/2;return cx*cx+cy*cy<2.3*2.3?C2:C}
    if(J.pat==='stripe'&&C2){const s=((X+Yv)%10+10)%10;return s<3.2?C2:C3&&s>6&&s<7.2?C3:C}
    if(J.pat==='check'&&C2){const a=(X%10+10)%10<1.8,b=(Yv%10+10)%10<1.8;return a||b?(a&&b?C2.map(c=>c*.85):C2):C}
    if((J.pat==='paisley'||J.pat==='foulard')&&C2){const g=12,row=Math.floor(Yv/g),cx=((X+(row%2)*g/2)%g+g)%g-g/2,cy=(Yv%g)-g/2,d=Math.abs(cx)+Math.abs(cy);
      if(J.pat==='foulard')return d<1.2&&C3?C3:d<3.2?C2:C;
      // a paisley: a teardrop (a round body and its curled tail) in the second colour, its eye in the third
      const body=(cx+.6)*(cx+.6)/7+cy*cy/4.4<1,tail=(cx-2.2)*(cx-2.2)+(cy+1.7)*(cy+1.7)<1.4,eye=(cx+.6)*(cx+.6)+cy*cy<1.1;return eye&&C3?C3:body||tail?C2:C}
    if(J.pat==='woven'||J.linen){const n=Math.sin(X*1.7+Math.sin(Yv*.9)*2)*.5+Math.sin(Yv*2.3+X*.31)*.5;return C.map(c=>c*(1+.035*n))}
    return C};
  const x0=Math.max(0,Math.floor(Math.min(t0[0],b0[0])-2)),x1=Math.min(S-1,Math.ceil(Math.max(t1[0],b1[0])+8*f)),y0=Math.max(0,Math.floor(t1[1]-2)),y1=Math.min(S-1,Math.ceil(b0[1]+8*f));
  const SS=4,inside=(x,y)=>x>=b0[0]&&x<=b1[0]&&y>=top(x)&&y<=bot(x);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=4*(y*S+x);let cov=0;
    for(let a=0;a<SS;a++)for(let b=0;b<SS;b++)if(inside(x+(a+.5)/SS,y+(b+.5)/SS))cov++;cov/=SS*SS;
    const bx=x+.5,by=y+.5,below=by-bot(bx);
    // the shadow on the welt under the strip's bottom edge (the pocket's mouth), and a little to its right
    let sh=0;if(bx>=b0[0]&&bx<=b1[0]&&below>0&&below<4*f)sh=.28*(1-below/(4*f));
    const right=bx-b1[0];if(right>0&&right<6*f&&by>top(b1[0])+2*f&&by<bot(b1[0])+3*f)sh=Math.max(sh,.16*(1-right/(6*f)));
    if(cov<=0&&sh<=0)continue;
    const lin=[L(px[i]),L(px[i+1]),L(px[i+2])],out=lin.map(c=>c*(1-sh));
    if(cov>0){const v=Math.min(1,Math.max(0,(by-top(bx))/H)),t=Math.min(1,Math.max(0,(bx-b0[0])/W)),k=(kl+(kr-kl)*t)*ASM_POCKET_LIT;
      // the fold's top edge catches the light; the strip darkens into the pocket's mouth; the ends turn a little away
      // the fold rolls over at the top (lit, then turning away), flat below, darker into the mouth; lit from the window on the left; a
      // faint grain so it reads as cloth
      const roll=v<.08?1.12:v<.26?1-.1*Math.sin((v-.08)/.18*Math.PI):1,mouth=v>.55?1-.38*Math.pow((v-.55)/.45,1.3):1,side=1.05-.1*t,ends=t<.025?.88:t>.975?.84:1;
      const gr=1+.025*(Math.sin(bx*2.7+by*.9)*.6+Math.sin(bx*.73-by*3.1)*.4),prof=roll*mouth*side*ends*gr,c=cloth(bx-b0[0],v);
      for(let q=0;q<3;q++)out[q]=out[q]*(1-cov)+Math.min(1,c[q]*k*prof)*cov}
    for(let q=0;q<3;q++)px[i+q]=gam(out[q])}}
