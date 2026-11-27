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
import {asmData,asmJpeg} from './assemble.js';
import {linSrgb8,srgbLin8} from './srgb.js';
const ASM_POCKETV=2;   // 2: folded cloth (a rolled, slightly uneven crease, two layers at the ends, relaxed creases, corner tucks, silk sheen / weave)
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
  const m=String(p.material||'').toLowerCase();
  return {kind,col:colOf(p),c2:c(p.secondaryColor),c3:c(p.tertiaryColor),pat,linen:/linen/.test(m),silk:/silk/.test(m)}}
/* paint the square on a finished picture: res {url} (a JPEG) or {px, S} (raw RGBA); returns res with the square painted */
async function asmPocketPaint(res,J){if(!res||!J)return res;let img=null,px,S;
  if(res.px){px=res.px;S=res.S}else if(res.url){img=await asmData(res.url);px=img.data;S=img.width}else return res;
  asmPocketDo(px,S,J);
  if(img)res.url=await asmJpeg(img);return res}
function asmPocketDo(px,S,J){const Q=asmPocketQuad(J.kind);if(!Q)return;const f=S/2048,L=srgbLin8;
  const gam=linSrgb8;   // (srgb.js)
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
  // (vv: 2048 px down from the fold, so a print and the border follow the folded edge; the border's lower edge anti-aliased)
  const cloth=(x,v,vv)=>{const X=x/u,Yv=vv;
    if(J.pat==='border'&&C2){const a=Math.min(1,Math.max(0,7.6-vv+.5)),b=Math.min(1,Math.max(0,9.2-vv+.5))*.25;return C.map((c,i)=>c+(C2[i]-c)*Math.max(a,b))}
    if(J.pat==='polka-dot'&&C2){const g=9,row=Math.floor(Yv/g),cx=((X+(row%2)*g/2)%g+g)%g-g/2,cy=(Yv%g)-g/2;return cx*cx+cy*cy<2.3*2.3?C2:C}
    if(J.pat==='stripe'&&C2){const s=((X+Yv)%10+10)%10;return s<3.2?C2:C3&&s>6&&s<7.2?C3:C}
    if(J.pat==='check'&&C2){const a=(X%10+10)%10<1.8,b=(Yv%10+10)%10<1.8;return a||b?(a&&b?C2.map(c=>c*.85):C2):C}
    if((J.pat==='paisley'||J.pat==='foulard')&&C2){const g=12,row=Math.floor(Yv/g),cx=((X+(row%2)*g/2)%g+g)%g-g/2,cy=(Yv%g)-g/2,d=Math.abs(cx)+Math.abs(cy);
      if(J.pat==='foulard')return d<1.2&&C3?C3:d<3.2?C2:C;
      // a paisley: a teardrop (a round body and its curled tail) in the second colour, its eye in the third
      const body=(cx+.6)*(cx+.6)/7+cy*cy/4.4<1,tail=(cx-2.2)*(cx-2.2)+(cy+1.7)*(cy+1.7)<1.4,eye=(cx+.6)*(cx+.6)+cy*cy<1.1;return eye&&C3?C3:body||tail?C2:C}
    if(J.pat==='woven'||J.linen){const n=Math.sin(X*1.7+Math.sin(Yv*.9)*2)*.5+Math.sin(Yv*2.3+X*.31)*.5;return C.map(c=>c*(1+.035*n))}
    return C};
  /* (v2, 2026-11-16, the owner: "add more of a fold, it looks too cartoony") folded cloth, all in 2048 px (uu along the strip from its left
     end, vv down from the welt-parallel line t0-t1):
     - the top is a fold, not a cut: very slightly uneven (dv, about a pixel), a touch lower at the corners where the fold rounds off
     - the crease rolls: a highlight along the edge (vv about 1.3), the underside of the roll a soft shadow just below (about 4.5), then
       flat cloth, darker into the pocket's mouth
     - two layers at each end: the outer edge turning away and the second layer's edge a pixel and a half inside it
     - one or two faint vertical creases where the fold relaxes, lit on their left (the window) and shaded on their right
     - at the bottom corners the cloth tucks into the opening: a small corner shadow inside the strip and on the welt beside it
     - silk a soft sheen along the fold and across the strip; linen and cotton matte with a fine weave */
  const Hh=ASM_POCKET_SHAPE.h,Ww=W/f,ex=Math.exp;
  const dv=uu=>.38*Math.sin(uu*.034+.4)+.22*Math.sin(uu*.093+2.1)+1*ex(-uu/3)+1*ex(-(Ww-uu)/3);   // the fold line's small waver, rounded corners
  const topAt=x=>top(x)+dv((x-b0[0])/f)*f;
  const CREASES=[[.34,1],[.71,.7]];
  const x0=Math.max(0,Math.floor(Math.min(t0[0],b0[0])-8*f)),x1=Math.min(S-1,Math.ceil(Math.max(t1[0],b1[0])+8*f)),y0=Math.max(0,Math.floor(t1[1]-3*f)),y1=Math.min(S-1,Math.ceil(b0[1]+8*f));
  const SS=4,inside=(x,y)=>x>=b0[0]&&x<=b1[0]&&y>=topAt(x)&&y<=bot(x);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=4*(y*S+x);let cov=0;
    for(let a=0;a<SS;a++)for(let b=0;b<SS;b++)if(inside(x+(a+.5)/SS,y+(b+.5)/SS))cov++;cov/=SS*SS;
    const bx=x+.5,by=y+.5,below=(by-bot(bx))/f;
    // on the jacket: the shadow on the welt under the strip (the pocket's mouth), a little to its right (the window is on the left), and
    // the tucks' corner shadows at both ends of the opening
    let sh=0;if(bx>=b0[0]&&bx<=b1[0]&&below>0&&below<4)sh=.28*(1-below/4);
    const right=(bx-b1[0])/f;if(right>0&&right<6&&by>topAt(b1[0])+2*f&&by<bot(b1[0])+3*f)sh=Math.max(sh,.18*(1-right/6));
    for(const c of [b0,b1]){const d=Math.hypot(bx-c[0],by-c[1])/f;if(d<6)sh=Math.max(sh,.22*(1-d/6))}
    if(cov<=0&&sh<=0)continue;
    const lin=[L(px[i]),L(px[i+1]),L(px[i+2])],out=lin.map(c=>c*(1-sh));
    if(cov>0){const uu=(bx-b0[0])/f,vv=(by-topAt(bx))/f,t=Math.min(1,Math.max(0,uu/Ww)),v=Math.min(1,Math.max(0,(by-top(bx))/H)),k=(kl+(kr-kl)*t)*ASM_POCKET_LIT;
      // down the strip: the lit crease, the roll's underside, flat, then into the pocket
      const hi=(J.silk?.32:.24)*ex(-(((vv-1.4)/1.2)**2)),roll=.18*ex(-(((vv-4.8)/1.8)**2)),mouth=vv>Hh*.5?.4*Math.pow(Math.min(1,(vv-Hh*.5)/(Hh*.5)),1.4):0;
      // the two layers at each end: the outer edge, a gap, the inner layer's edge
      const lay=e=>.2*ex(-(((e-.4)/.7)**2))+.2*ex(-(((e-2.6)/.6)**2)),endL=lay(uu),endR=Math.min(.5,lay(Ww-uu)*1.25);
      // where the fold relaxes: faint vertical creases, strongest a third of the way down
      let cr=0;for(const [p,s] of CREASES){const d=uu-p*Ww,w=s*ex(-(((vv-Hh*.4)/(Hh*.35))**2));cr+=w*(.06*ex(-(((d-1.4)/2.8)**2))-.045*ex(-(((d+2)/2.2)**2)))}
      // the tuck at the bottom corners: the cloth turns into the opening
      const tuck=.3*ex(-Math.hypot(uu,Hh-vv)/5)+.34*ex(-Math.hypot(Ww-uu,Hh-vv)/5);
      const side=1.05-.1*t,shade=Math.max(.2,(1+hi)*(1-roll)*(1-mouth)*(1-endL)*(1-endR)*(1-tuck)*(1-cr)*side);
      // the cloth: a fine weave on linen and cotton (matte), a soft sheen on silk
      const weave=J.silk?1:1+(J.linen?.045:.03)*((((Math.floor(uu*1.1)+Math.floor(vv*1.1))&1)?1:-1)*.6+(J.linen?Math.sin(uu*.9+Math.sin(vv*.7)*2)*.6:0));
      const sheen=J.silk?.16*ex(-(((vv-7)/4.5)**2))*(.65+.35*Math.sin(uu*.05+1.3))+.1*hi:0;
      const c=cloth(bx-b0[0],v,vv);
      for(let q=0;q<3;q++){const base=c[q]*k*shade*weave,lit=base+(Math.min(1,k*1.05)-base)*sheen;out[q]=out[q]*(1-cov)+Math.min(1,lit)*cov}}
    for(let q=0;q<3;q++)px[i+q]=gam(out[q])}}
/* the bridge (an ES module since C3, 2026-11-24): what the classic scripts, the other modules, asm-worker.js and the tests still use as globals (tests/bridge.test.js lists who) */
Object.assign(globalThis,{asmPocketQuad,asmPocketSig,asmPocketJob,asmPocketPaint});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,asmPocketDo,asmPocketJob,asmPocketQuad};
export {asmPocketQuad,asmPocketSig,asmPocketJob,asmPocketPaint,asmPocketDo};
