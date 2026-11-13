/* Daily Wardrobe: SVG drawings (procedural fabrics, accessories, thumbnails, glue for the torso figure) */

/* a herringbone stripe's plain band, read from Claude's one-repeat bitmap: columns the same all the way down (all 1: a shiny satin
   line; all 0: plain ground) are not twill. Its share of the repeat, and whether it shines; null for plain herringbone. */
function texPlainBand(grid){if(!grid||!grid.length)return null;const M=grid[0].length,u=[];
  for(let x=0;x<M;x++){const c=grid.map(r=>r[x]);if(c.every(v=>v===c[0]))u.push(c[0])}
  const share=u.length/M;return share>0&&share<=.5&&u.length<M?{share,light:u.filter(v=>v==='1').length>=u.length/2}:null}
/* a weave texture's two tones around the tagged colour: the ground cells and the raised ones (tagging.js texFromSpec). The swing is
   the close-up's, softened (a macro shot's raking light exaggerates the relief: the cloth itself reads only faintly textured)
   and capped, and the tones keep the cloth's average at the tagged colour, so a white shirt stays white. Raised threads that read
   darker swap the roles. Returns [ground, raised]. */
/* a tie's weave painted on the model (ctx 'asmtie', assemble.js asmTieTile): silk shows its raised weave far more than shirting; at the
   shirt's swing the owner's black tonal-check tie read about 3.5 L*, nearly flat beside its close-up (2026-11-13) */
const TIE_TEX_K=2.6;
/* a very dark tie's figured weave (L* under TIE_DARK_L) is drawn TIE_DARK_X stronger still: on the phone the owner's black tonal-check tie read
   as flat black at 2.6 (2026-11-13); twills and lighter ties keep 2.6 */
const TIE_DARK_L=20,TIE_DARK_X=1.55;
function texTones(b,t,k=1){const gl=rgbLab(...hexRgb(b)),g=t.grid.join(''),f1=[...g].filter(c=>c==='1').length/g.length,d=Math.max(2.5,Math.min(7,.4*t.rel*Math.max(gl[0],25)))*k;
  const sg=t.lighter?1:-1;let Lr=gl[0]+sg*d*(1-f1),Lg=gl[0]-sg*d*f1;const top=Math.max(Lr,Lg)-99.5;if(top>0){Lr-=top;Lg-=top}
  return [labHex([Lg,gl[1],gl[2]]),labHex([Lr,gl[1],gl[2]])]}
/* the bitmap as a small soft image (6 px a cell, each pixel the average of the cells around it, wrapping at the edges so the tile
   stays seamless): threads read woven, not as a staircase of squares. Cached; null without a DOM. */
const TEX_TILES=new Map();
function texTileUrl(grid,lo,hi){if(typeof document==='undefined')return null;const key=grid.join('/')+lo+hi;if(TEX_TILES.has(key))return TEX_TILES.get(key);
  const M=grid[0].length,N=grid.length,S=6,W=M*S,H=N*S,r=2,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),D=x.createImageData(W,H),A=hexRgb(lo),B=hexRgb(hi);
  const on=(px,py)=>grid[((Math.floor(py/S)%N)+N)%N][((Math.floor(px/S)%M)+M)%M]==='1'?1:0;
  for(let y=0;y<H;y++)for(let q=0;q<W;q++){let s=0,n=0;for(let dy=-r;dy<=r;dy+=1)for(let dx=-r;dx<=r;dx+=1){s+=on(q+dx,y+dy);n++}const w=s/n,i=4*(y*W+q);
    for(let k=0;k<3;k++)D.data[i+k]=Math.round(A[k]+(B[k]-A[k])*w);D.data[i+3]=255}
  x.putImageData(D,0,0);const url=c.toDataURL('image/png');if(TEX_TILES.size>40)TEX_TILES.clear();TEX_TILES.set(key,url);return url}
/* the same bitmap at higher fidelity, for Today's swatch overlay (the owner's choice, 2026-11-13: "Smooth + thread grain" from four
   mockups; the soft tile read blurry and a sharp one as pixel steps): 24 px a cell, blurred by a wrapping Gaussian TEX_SMOOTH_SIG of a cell
   and cut by a narrow smoothstep, so the figures' outlines are rounded and anti-aliased; then a faint diagonal thread grain (±TEX_GRAIN,
   a third of a cell apart). Cached; null without a DOM. */
const TEX_SMOOTH_S=24,TEX_SMOOTH_SIG=.32,TEX_GRAIN=.035;
function texTileSmooth(grid,lo,hi){if(typeof document==='undefined')return null;const key='s'+grid.join('/')+lo+hi;if(TEX_TILES.has(key))return TEX_TILES.get(key);
  const S=TEX_SMOOTH_S,M=grid[0].length,N=grid.length,W=M*S,H=N*S,f=new Float32Array(W*H),g=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let q=0;q<W;q++)f[y*W+q]=grid[Math.floor(y/S)][Math.floor(q/S)]==='1'?1:0;
  const sg=TEX_SMOOTH_SIG*S,R=Math.ceil(3*sg),k=[];for(let o=-R;o<=R;o++)k.push(Math.exp(-o*o/(2*sg*sg)));const ks=k.reduce((a,b)=>a+b);
  for(let y=0;y<H;y++)for(let q=0;q<W;q++){let s=0;for(let o=-R;o<=R;o++)s+=k[o+R]*f[y*W+((q+o)%W+W)%W];g[y*W+q]=s/ks}
  for(let y=0;y<H;y++)for(let q=0;q<W;q++){let s=0;for(let o=-R;o<=R;o++)s+=k[o+R]*g[(((y+o)%H+H)%H)*W+q];f[y*W+q]=s/ks}
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),D=x.createImageData(W,H),A=hexRgb(lo),B=hexRgb(hi),P=Math.round(S/3);
  for(let y=0;y<H;y++)for(let q=0;q<W;q++){const t=Math.min(1,Math.max(0,(f[y*W+q]-.42)/.16)),w=t*t*(3-2*t),gr=1+TEX_GRAIN*(((q+y)%P)/P<.5?1:-1),i=4*(y*W+q);
    for(let j=0;j<3;j++)D.data[i+j]=Math.max(0,Math.min(255,Math.round((A[j]+(B[j]-A[j])*w)*gr)));D.data[i+3]=255}
  x.putImageData(D,0,0);const url=c.toDataURL('image/png');if(TEX_TILES.size>40)TEX_TILES.clear();TEX_TILES.set(key,url);return url}
/* Pattern tile per garment role. Scale differs by role so a pinstripe suit and a striped shirt read correctly. */
function fabricDef(id,item,role,ctx){
  const b=colOf(item),a=accentOf(item),t3=thirdOf(item),c=t3||a,p=patBase(item.pattern)||'solid',wool=role==='top'||role==='bot';
  const dk='#000',lt='#fff',ink=lum(b)>.5?'#000':'#fff';
  const twill=`<path d="M-2,2 L2,-2 M0,4 L4,0 M2,6 L6,2" stroke="${ink}" stroke-opacity="${wool?.07:.04}" stroke-width=".6"/>`;
  const tile=(w,h,body,tf='')=>`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"${tf?` patternTransform="${tf}"`:''}><rect width="${w}" height="${h}" fill="${b}"/>${body}</pattern>`;
  const fine=role==='shirt'||role==='tie';
  /* herringbone: columns of steep twill lines whose slant alternates, with a half-step break at each column edge */
  /* k: contrast (1 as drawn generically; more where the drawing is small, or for the photo generator) */
  /* band: a herringbone stripe's plain band ({w: its width, light: a satin sheen}), after every twill column: slant one way, band,
     slant the other way, band (each V split by a band, as on the user's pink shirt); without it the columns meet at a break line */
  const herringboneTile=(cw,lineDeg,tf,k=1,band)=>{
    const t=Math.tan(lineDeg*Math.PI/180),sv=+(cw*.55).toFixed(3),bw=band?+band.w.toFixed(3):0,W=2*cw+2*bw,kmax=Math.ceil(t*cw/sv)+2,o=v=>Math.min(1,v*k).toFixed(3);
    const fam=(dir,off)=>{let d='';for(let k=-kmax;k<=kmax;k++){const y0=k*sv+off;d+=dir>0?`M0,${(y0+t*cw).toFixed(3)} L${cw},${y0.toFixed(3)} `:`M0,${y0.toFixed(3)} L${cw},${(y0+t*cw).toFixed(3)} `}return d};
    const col=(dir,off)=>`<path d="${fam(dir,off)}" stroke="${lt}" stroke-opacity="${o(.17)}" stroke-width="${(sv*.38).toFixed(3)}"/><path d="${fam(dir,off+sv/2)}" stroke="${dk}" stroke-opacity="${o(.2)}" stroke-width="${(sv*.3).toFixed(3)}"/>`;
    const brk=Math.max(.24,cw*.06),f=v=>(+v).toFixed(3),edge=x=>`<rect x="${f(x-brk/2)}" width="${f(brk)}" height="${sv}" fill="${dk}" opacity="${o(.16)}"/>`;
    const plain=x=>bw?`<rect x="${f(x)}" width="${f(bw)}" height="${sv}" fill="${band.light?lt:dk}" opacity="${o(band.light?.14:.05)}"/>`:'';
    const x2=cw+bw;   // where the second column starts
    return tile(W,sv,`<svg width="${cw}" height="${sv}" overflow="hidden">${col(1,0)}</svg>${plain(cw)}<svg x="${f(x2)}" width="${cw}" height="${sv}" overflow="hidden">${col(-1,sv/2)}</svg>${plain(x2+cw)}`+
      edge(cw)+edge(x2+cw)+(bw?edge(x2)+edge(W):''),tf);
  };
  /* layouts read from the item's photo take precedence over the generic tiles.
     Ties keep the photographed angle; garments snap to vertical/horizontal. */
  const st=item.stripes,col={p:b,s:a,t:c},angOf=x=>role==='tie'?x:Math.round(x/90)*90,rot=x=>{const r=angOf(x);return r?`rotate(${r})`:''};
  const bandRects=(bands,T,H,vertical,skipP)=>{let x=0;return bands.map(([r,f])=>{const w=f*T,x0=x;x+=w;if(skipP&&r==='p')return '';
    return vertical?`<rect x="${x0.toFixed(3)}" width="${(w+.05).toFixed(3)}" height="${H}" fill="${col[r]||b}"${skipP?' opacity=".55"':''}/>`:`<rect y="${x0.toFixed(3)}" height="${(w+.05).toFixed(3)}" width="${H}" fill="${col[r]||b}"/>`}).join('')};
  /* a sett read in full colour (detect.js analyzeSett): its own band colours and the lines that cross them. The repeat is
     sized from what was seen: in a swatch at least one whole repeat shows; on the figure the repeat keeps its share of the
     item's width (sett.tw, or Claude's repeats across). */
  const se=usableSett(item);
  /* a motif read by Claude (tagging.js motifFromSpec): its figures on a grid two cells square (so two colours can alternate like a
     checkerboard), turned 45° for a diagonal grid. Scaled like a sett: in a swatch as many cells as the close-up shows, on the
     figure as many as fit across the item. */
  /* a weave texture read by Claude (tagging.js texFromSpec): its one-repeat bitmap in the tagged colour, the raised cells lighter
     (or darker) by the swing measured in the close-up; on a near-white ground the ground cells go darker instead. In a swatch as
     many repeats as the close-up shows; on the figure no finer than 6 units a repeat (finer only shimmers). */
  /* Claude's herringbone or twill reading: a small bitmap of one repeat can't hold them (a herringbone's one V, tiled, joins into
     horizontal zigzags, where the cloth has columns of dense twill lines turning at each column edge), so these are drawn with the
     woven tiles, kept to the measured contrast; Claude's bitmap stays for figured weaves (diamond dobby, birdseye, honeycomb). A swatch
     shows at most 20 column pairs: Claude's count can be the chevrons along a column (60 for the user's blue shirt), not the columns. */
  if(se&&se.tex&&p!=='solid'&&(se.tex.kind==='herringbone'||se.tex.kind==='twill')){
    const k=(ctx==='dot'?2.2:ctx==='dia'?3:ctx==='asmtie'?TIE_TEX_K:1)*Math.max(.8,Math.min(ctx==='dot'||ctx==='dia'?1.6:1.2,(se.tex.rel||.1)/.1));
    if(se.tex.kind==='herringbone'){const band=texPlainBand(se.tex.grid),cw=ctx==='dot'?16/6:ctx==='dia'?200/24:ctx==='fig'?(role==='shirt'?1.3:2.2):Math.max(2.5,Math.min(5,50/Math.max(.9,se.cr||8)));return herringboneTile(cw,55,'',k,band&&{w:2*cw*band.share/(1-band.share),light:band.light})}
    const s=ctx==='dot'?16/5:ctx==='dia'?200/30:3,o=v=>Math.min(1,v*k).toFixed(3);
    return tile(s,s,`<path d="M0,${s} L${s},0" stroke="#000" stroke-opacity="${o(.14)}" stroke-width="${(s*.23).toFixed(3)}"/><path d="M-1,1 L1,-1 M${s-1},${s+1} L${s+1},${s-1}" stroke="#fff" stroke-opacity="${o(.08)}" stroke-width="${(s*.17).toFixed(3)}"/>`)}
  if(se&&se.tex&&p!=='solid'){const g=se.tex.grid,M=g[0].length,N=g.length,T=ctx==='dot'?16/2.5:ctx==='dia'?200/14:ctx==='fig'?Math.max(6,Math.min(40,180/Math.max(.5,se.tr||100))):Math.max(4,Math.min(60,100/Math.max(.9,se.cr||8)));
    const Tv=T*(se.tex.aspect||N/M),f2=v=>+v.toFixed(3),[lo,hi]=texTones(b,se.tex,ctx==='fig'?.8:ctx==='dia'?2.5:ctx==='dot'?1.7:ctx==='asmtie'?TIE_TEX_K*(rgbLab(...hexRgb(b))[0]<TIE_DARK_L?TIE_DARK_X:1):1),url=texTileUrl(g,lo,hi);
    const body=url?`<image href="${url}" width="${f2(T)}" height="${f2(Tv)}" preserveAspectRatio="none"/>`:g.map((row,y)=>[...row].map((v,x)=>v==='1'?`<rect x="${f2(x*T/M)}" y="${f2(y*T/M)}" width="${f2(T/M+.02)}" height="${f2(T/M+.02)}"/>`:'').join('')).join('');
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f2(T)}" height="${f2(Tv)}"><rect width="${f2(T)}" height="${f2(Tv)}" fill="${lo}"/>${url?body:`<g fill="${hi}">${body}</g>`}</pattern>`;
  }
  if(se&&se.motif&&p!=='solid'){const m=se.motif;
    const T=ctx==='dot'?16/3:ctx==='fig'?Math.max(1.5,Math.min(40,(role==='tie'?29:role==='shirt'?180:200)/Math.max(.5,se.tr||8))):Math.max(3,Math.min(80,100/Math.max(.9,se.cr||1)));
    const f2=v=>+v.toFixed(3),fig=(f,x,y,col)=>{const s=f.size*T,h=s/2;
      switch(f.shape){
        case 'square':return `<rect x="${f2(x-h)}" y="${f2(y-h)}" width="${f2(s)}" height="${f2(s)}" rx="${f2(s*.1)}" fill="${col}"/>`;
        case 'square-with-dot':{const d=s*.34;return `<rect x="${f2(x-h)}" y="${f2(y-h)}" width="${f2(s)}" height="${f2(s)}" rx="${f2(s*.1)}" fill="${col}"/><rect x="${f2(x-d/2)}" y="${f2(y-d/2)}" width="${f2(d)}" height="${f2(d)}" fill="${f.centre||b}"/>`}
        case 'diamond':return `<path d="M${f2(x)},${f2(y-h)} L${f2(x+h)},${f2(y)} L${f2(x)},${f2(y+h)} L${f2(x-h)},${f2(y)} Z" fill="${col}"/>`;
        case 'ring':return `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(h*.8)}" fill="none" stroke="${col}" stroke-width="${f2(s*.2)}"/>`;
        case 'cross':{const w=s*.3;return `<rect x="${f2(x-w/2)}" y="${f2(y-h)}" width="${f2(w)}" height="${f2(s)}" fill="${col}"/><rect x="${f2(x-h)}" y="${f2(y-w/2)}" width="${f2(s)}" height="${f2(w)}" fill="${col}"/>`}
        case 'flower':{const r=s*.26,o=s*.24;return [[o,0],[-o,0],[0,o],[0,-o]].map(([u,v])=>`<circle cx="${f2(x+u)}" cy="${f2(y+v)}" r="${f2(r)}" fill="${col}"/>`).join('')+`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r*.7)}" fill="${f.centre||m.ground}"/>`}
        case 'figure':{   // Claude's bitmap of the figure, its own proportions, s wide; each row's runs of 1 drawn as one rect
          const B=f.bmp||['1'],C=B[0].length,R=B.length,px=s/C,top=y-R*px/2,left=x-h;let o='';
          B.forEach((row,r)=>{let k=0;while(k<C){if(row[k]!=='1'){k++;continue}let e=k;while(e<C&&row[e]==='1')e++;
            o+=`<rect x="${f2(left+k*px)}" y="${f2(top+r*px)}" width="${f2((e-k)*px+.02)}" height="${f2(px+.02)}" fill="${col}"/>`;k=e}});return o}
        default:return `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(h)}" fill="${col}"/>`}};
    // a cell is T wide and Tv tall (columns further apart than the figures are stacked: Tv < T); with an offset every other row
    // is shifted half a cell. The tile is two cells each way; a figure is drawn again a tile's width away where it crosses an edge.
    const Tv=T*(m.aspect||1),W2=2*T,H2=2*Tv;
    let body='';
    for(const f of m.figs){const corner=f.place==='corner',n=corner?3:2;
      for(let i=0;i<n;i++)for(let j=0;j<n;j++){const alt=(i+j)%2;if(f.place==='alternate-cells'&&alt)continue;
        const col=f.cols[f.cols.length>1?alt:0],y=(corner?j:j+.5)*Tv,x=(corner?i:i+.5)*T+(m.off&&j%2?T/2:0);
        body+=fig(f,x,y,col);if(x+f.size*T/2>W2)body+=fig(f,x-W2,y,col)}}
    // (no tie sheen line here: repeated every tile and turned with the pattern, it showed as faint light bands across the swatch)
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f2(W2)}" height="${f2(H2)}"${se.a?` patternTransform="rotate(${se.a})"`:''}><rect width="${f2(W2)}" height="${f2(H2)}" fill="${m.ground}"/>${body}</pattern>`;
  }
  if(se&&se.v===2&&se.bands&&se.bands.length>1&&p!=='solid'){
    const across=se.tr||(se.tw?1/se.tw:1.5),T=ctx==='dot'?8:ctx==='fig'?Math.max(2,Math.min(60,(role==='tie'?29:role==='shirt'?180:200)/across)):Math.max(14,Math.min(110,100/Math.max(.9,se.cr||1)));
    const cx=se.cross&&Math.abs(Math.abs(se.cross.d)-90)<=20?se.cross:null,Tv=cx?T*(cx.r||1):T;
    const minW=ctx==='fig'?.35:ctx==='dot'?.5:.6;   // a windowpane's or pinstripe's hairline stays visible
    let x=0;const main=se.bands.map(([h,f])=>{const w=f*T,x0=x;x+=w;return `<rect x="${x0.toFixed(3)}" width="${(Math.max(w,minW)+.06).toFixed(3)}" height="${Tv.toFixed(3)}" fill="${h}"/>`}).join('');
    let y=0;const over=cx?cx.bands.map(([h,f])=>{const w=f*Tv,y0=y;y+=w;return h?`<rect y="${y0.toFixed(3)}" height="${(Math.max(w,minW)+.06).toFixed(3)}" width="${T.toFixed(3)}" fill="${h}" opacity=".5"/>`:''}).join(''):'';
    // (no tie sheen line: one per repeat, turned 45° with the stripes it lay almost level, light grey bands across the owner's
    // navy & white & grey stripe tie in the item sheet, 2026-11-12)
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${T.toFixed(3)}" height="${Tv.toFixed(3)}"${rot(se.a)?` patternTransform="${rot(se.a)}"`:''}>${main}${over}</pattern>`;
  }
  if(st&&(!st.kind||st.kind==='stripes')&&[...STRIPE_PATS,...CHECK_PATS].includes(p)&&st.b&&st.b.length>1){
    const T=role==='tie'?8:role==='shirt'?5:10;
    return tile(T,T,(wool?twill:'')+bandRects(st.b,T,T,true,false),rot(st.a));
  }
  if(st&&st.kind==='check'&&CHECK_PATS.includes(p)){
    // woven check: weft bands underneath, warp bands over them at partial opacity so crossings mix
    const T=role==='tie'?8:role==='shirt'?6:14,Tv=T*(st.r||1);
    return tile(T,Tv,(wool?twill:'')+bandRects(st.v,Tv,T,false,false)+bandRects(st.b,T,Tv,true,true),rot(st.a));
  }
  switch(p){
    /* --- stripes --- */
    case 'pinstripe':
      if(fine)return t3?tile(6,3,`<rect width=".5" height="3" fill="${a}" opacity=".9"/><rect x="3" width=".5" height="3" fill="${c}" opacity=".9"/>`):tile(3,3,`<rect width=".5" height="3" fill="${a}" opacity=".9"/>`);
      return t3?tile(16,4,`${twill}<rect width=".55" height="4" fill="${a}" opacity=".85"/><rect x="8" width=".55" height="4" fill="${c}" opacity=".85"/>`):tile(8,4,`${twill}<rect width=".55" height="4" fill="${a}" opacity=".85"/>`);
    case 'chalk-stripe':
      return t3?tile(24,4,`${twill}<rect x="-.2" width="1.4" height="4" fill="${a}" opacity=".38"/><rect x="11.8" width="1.4" height="4" fill="${c}" opacity=".38"/>`):tile(12,4,`${twill}<rect x="-.2" width="1.4" height="4" fill="${a}" opacity=".38"/><rect x=".2" width=".6" height="4" fill="${a}" opacity=".3"/>`);
    case 'stripe':
      if(role==='tie')return t3?tile(13,13,`<rect width="4.5" height="13" fill="${a}"/><rect x="6.5" width="1.6" height="13" fill="${c}"/><rect x="10" width="1.6" height="13" fill="${c}"/>`,'rotate(40)')
                              :tile(12,12,`<rect width="4" height="12" fill="${a}"/><rect x="6" width="1" height="12" fill="${a}" opacity=".7"/>`,'rotate(40)');
      if(role==='shirt')return t3?tile(8,4,`<rect width="1.4" height="4" fill="${a}" opacity=".85"/><rect x="4" width="1.4" height="4" fill="${c}" opacity=".85"/>`):tile(4,4,`<rect width="1.4" height="4" fill="${a}" opacity=".85"/>`);
      return t3?tile(16,4,`${twill}<rect width=".6" height="4" fill="${a}" opacity=".8"/><rect x="8" width=".6" height="4" fill="${c}" opacity=".8"/>`):tile(8,4,`${twill}<rect width=".6" height="4" fill="${a}" opacity=".8"/>`);
    case 'fine-stripe':
      return t3?tile(4,2,`<rect width=".3" height="2" fill="${a}" opacity=".85"/><rect x="2" width=".3" height="2" fill="${c}" opacity=".85"/>`):tile(2,2,`<rect width=".3" height="2" fill="${a}" opacity=".85"/>`);
    /* --- dress-shirt weaves and textures (tone on tone; a second colour, if tagged, shows in the weave) --- */
    case 'end-on-end':{const c2=item.secondaryColor&&COLORS[item.secondaryColor]||mix(b,'#fff',.5);
      return tile(1,1,`<rect width=".5" height="1" fill="${c2}" opacity=".6"/>`)}
    case 'chambray':
      return tile(1.4,1.4,`<rect x=".1" width=".5" height="1.4" fill="${dk}" opacity=".06"/><rect y=".7" width="1.4" height=".35" fill="${lt}" opacity=".24"/>`);
    case 'pinpoint':
      return tile(1.2,1.2,`<rect width=".6" height=".6" fill="${lt}" opacity=".18"/><rect x=".6" y=".6" width=".6" height=".6" fill="${lt}" opacity=".18"/>`);
    case 'royal-oxford':
      return tile(3,3,`<rect width="1.5" height="1.5" fill="${lt}" opacity=".26"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="${lt}" opacity=".26"/><path d="M0,.75 H1.5 M1.5,2.25 H3 M2.25,0 V1.5 M.75,1.5 V3" stroke="${dk}" stroke-opacity=".1" stroke-width=".3"/>`);
    case 'dobby':{const m=item.secondaryColor&&COLORS[item.secondaryColor];
      return tile(4,4,`<path d="M2,.9 L3.1,2 L2,3.1 L.9,2 Z" fill="${m||(lum(b)>.6?dk:lt)}" opacity="${m?.5:.08}"/><circle cx="2" cy="2" r=".35" fill="${lt}" opacity=".35"/>`)}
    case 'woven':{const w2=item.secondaryColor&&COLORS[item.secondaryColor];
      // two-tone basket weave (e.g. a navy tie with bright blue threads): small raised squares of the second colour on the base
      if(w2){const s=role==='tie'?1.6:1.2,q=s/2,k=.7,o=(1-k)/2;const sq=(x,y,f,op)=>`<rect width="${q*k}" height="${q*k}" x="${x+q*o}" y="${y+q*o}" rx="${q*.2}" fill="${f}" opacity="${op}"/>`;
        return tile(s,s,sq(0,0,w2,.55)+sq(q,q,w2,.55)+sq(q,0,dk,.4)+sq(0,q,dk,.4))}
      return tile(2,2,`<path d="M0,.5 H2 M0,1.5 H2" stroke="${dk}" stroke-opacity=".07" stroke-width=".35"/><path d="M.5,0 V2 M1.5,0 V2" stroke="${lt}" stroke-opacity=".2" stroke-width=".35"/>`)}
    case 'textured':
      return tile(5,5,[[.6,.8,1.4],[2.8,.4,1],[1.6,2.4,1.2],[3.6,2.9,1.3],[.4,3.9,.9],[2.4,4.3,1.1]].map(([x,y,w],k)=>`<rect x="${x}" y="${y}" width="${w}" height=".35" rx=".17" fill="${k%2?dk:lt}" opacity="${k%2?.07:.24}"/>`).join(''));
    case 'fine-texture':
      return tile(1.6,1.6,`<circle cx=".4" cy=".4" r=".22" fill="${lt}" opacity=".22"/><circle cx="1.2" cy="1.2" r=".22" fill="${dk}" opacity=".07"/>`);
    /* --- weaves (read as near-solid at a distance) --- */
    case 'herringbone':
      return herringboneTile(role==='tie'?1.6:role==='shirt'?1.3:2.2,55,'');
    case 'birdseye':
      return tile(3,3,`<circle cx=".75" cy=".75" r=".55" fill="${a}" opacity=".45"/><circle cx="2.25" cy="2.25" r=".55" fill="${a}" opacity=".45"/><circle cx=".75" cy=".75" r=".2" fill="${b}"/><circle cx="2.25" cy="2.25" r=".2" fill="${b}"/>`);
    case 'nailhead':
      return tile(2.6,2.6,`<rect x=".9" y=".9" width=".7" height=".7" fill="${a}" opacity=".5"/>`);
    case 'sharkskin':
      return tile(2,2,`<path d="M0,2 L2,0" stroke="${lt}" stroke-opacity=".18" stroke-width=".55"/><path d="M-1,1 L1,-1 M1,3 L3,1" stroke="${dk}" stroke-opacity=".22" stroke-width=".55"/>`);
    case 'twill':case 'texture':
      return tile(3,3,`<path d="M0,3 L3,0" stroke="#000" stroke-opacity=".14" stroke-width=".7"/><path d="M-1,1 L1,-1 M2,4 L4,2" stroke="#fff" stroke-opacity=".08" stroke-width=".5"/>`);
    case 'oxford':
      return tile(2,2,`<rect width="1" height="1" fill="${lt}" opacity=".22"/><rect x="1" y="1" width="1" height="1" fill="${lt}" opacity=".22"/>`);
    case 'knit':
      return tile(3,2.4,`<path d="M0,0 L1.5,1.2 L3,0" fill="none" stroke="${dk}" stroke-opacity=".28" stroke-width=".55"/><path d="M0,1.2 L1.5,2.4 L3,1.2" fill="none" stroke="${lt}" stroke-opacity=".12" stroke-width=".45"/>`);
    case 'tweed':{
      const fleck=[[1,2,a],[6,1,lt],[3,7,'#000'],[8,5,c],[5,4,lt],[9,9,'#000'],[2,9,c],[7,8,a]];
      return tile(10,10,`${twill}${fleck.map(([x,y,c])=>`<rect x="${x}" y="${y}" width="1.1" height=".5" fill="${c}" opacity=".35" transform="rotate(${(x*37)%60-30} ${x} ${y})"/>`).join('')}`);
    }
    /* --- checks --- */
    case 'houndstooth':{
      /* classic construction: 2x2 block = solid dark, solid light, and two diagonally striped quadrants forming the teeth */
      const st=`<path d="M-1,1 L1,-1 M-1,3 L3,-1 M-1,5 L5,-1 M1,5 L5,1 M3,5 L5,3" stroke="${a}" stroke-width=".72"/>`;
      return tile(8,8,`<rect width="4" height="4" fill="${a}"/><svg x="4" y="0" width="4" height="4">${st}</svg><svg x="0" y="4" width="4" height="4">${st}</svg>`,role==='shirt'?'scale(.32)':fine?'scale(.6)':'scale(.85)');
    }
    case 'glen-check':
      return tile(16,16,`<path d="M0,1 H8 M0,3 H8 M0,5 H8 M0,7 H8 M9,8 V16 M11,8 V16 M13,8 V16 M15,8 V16" stroke="${ink}" stroke-opacity=".18" stroke-width=".8"/><path d="M8,0 L16,8 M10,0 L16,6 M12,0 L16,4 M8,2 L14,8 M8,4 L12,8 M0,8 L8,16 M0,10 L6,16 M0,12 L4,16 M2,8 L8,14 M4,8 L8,12" stroke="${ink}" stroke-opacity=".14" stroke-width=".6"/><rect x="15.4" width=".6" height="16" fill="${a}" opacity=".7"/><rect y="15.4" width="16" height=".6" fill="${c}" opacity=".7"/>`);
    case 'windowpane':
      return tile(18,18,`${twill}<rect width=".7" height="18" fill="${a}" opacity=".8"/><rect width="18" height=".7" fill="${c}" opacity=".8"/>`);
    case 'gingham':
      return tile(6,6,`<rect width="3" height="6" fill="${a}" opacity=".45"/><rect width="6" height="3" fill="${c}" opacity=".45"/>`);
    case 'tattersall':{
      const c2=item.tertiaryColor&&COLORS[item.tertiaryColor]||mix(a,b,.4);
      return tile(8,8,`<rect width=".6" height="8" fill="${a}"/><rect width="8" height=".6" fill="${a}"/><rect x="4" width=".6" height="8" fill="${c2}"/><rect y="4" width="8" height=".6" fill="${c2}"/>`);
    }
    case 'tonal-check':{const t2=c!==b?c:a!==b?a:mix(b,'#fff',.18);
      // glen-check structure in two close shades: blocks of fine checks alternating with blocks of fine lines, a faint overcheck
      const q=[0,1,2,3];return tile(8,8,q.map(y=>q.map(x=>(x+y)%2?'':`<rect x="${x}" y="${y}" width="1" height="1" fill="${t2}" opacity=".6"/><rect x="${x+4}" y="${y+4}" width="1" height="1" fill="${t2}" opacity=".6"/>`).join('')).join('')+
        q.map(y=>`<rect x="4" y="${y+.35}" width="4" height=".35" fill="${t2}" opacity=".5"/><rect x="${y+.35}" y="4" width=".35" height="4" fill="${t2}" opacity=".5"/>`).join('')+
        `<rect width=".3" height="8" fill="${t2}" opacity=".35"/><rect width="8" height=".3" fill="${t2}" opacity=".35"/>`,role==='tie'?'rotate(45)':'')}
    case 'check':
      if(role==='shirt')return tile(6,6,`<rect width="3" height="6" fill="${a}" opacity=".45"/><rect width="6" height="3" fill="${c}" opacity=".45"/>`);
      if(role==='tie')return tile(6,6,`<rect width="2" height="6" fill="${a}" opacity=".6"/><rect width="6" height="2" fill="${c}" opacity=".6"/>`,'rotate(45)');
      return tile(16,16,`${twill}<rect width=".7" height="16" fill="${a}" opacity=".75"/><rect width="16" height=".7" fill="${a}" opacity=".75"/><rect x="8" width=".4" height="16" fill="${c}" opacity=".45"/><rect y="8" width="16" height=".4" fill="${c}" opacity=".45"/>`);
    /* --- tie motifs --- */
    case 'polka-dot':{
      const s=role==='tie'?9:role==='shirt'?5:10,r=role==='tie'?1.4:role==='shirt'?.7:.9;
      return tile(s,s,`<circle cx="${s/4}" cy="${s/4}" r="${r}" fill="${a}"/><circle cx="${s*3/4}" cy="${s*3/4}" r="${r}" fill="${c}"/>`);
    }
    case 'foulard':{
      const m=`<path d="M0,-1.8 L1.8,0 L0,1.8 L-1.8,0 Z" fill="${a}"/><circle r=".6" fill="${t3||b}"/>`;
      return tile(8,8,`<g transform="translate(2,2)">${m}</g><g transform="translate(6,6)">${m}</g>`);
    }
    case 'paisley':{
      const drop=`<path d="M0,-3.2 C2.6,-3.2 3.2,0 1.6,2 C0.4,3.4 -2.4,3.2 -2.6,1 C-2.8,-1 -1.2,-1.4 -0.6,-0.6 C0.2,0.4 -1.2,1 -1.4,0.4" fill="none" stroke="${a}" stroke-width=".7"/><circle cx="0.3" cy="0.2" r=".6" fill="${c}"/>`;
      return tile(14,14,`<g transform="translate(4,4)">${drop}</g><g transform="translate(11,11) rotate(180)">${drop}</g>`);
    }
  }
  return wool?tile(4,4,twill):tile(4,4,'');
}

/* ---------- accessory drawings for the wardrobe thumbnails and tiles ----------
   Every function takes an id prefix P so several drawings can live on one page without id clashes. */

/* leather surface: base colour, grain texture and a highlight whose strength depends on the leather */
function leatherLayers(P,item,d,toe){
  const L=item&&item.leather||'calf',base=item?colOf(item):'#2b2b2e';
  const col=L==='suede'?mix(base,'#fff',.07):L==='cordovan'?mix(base,'#1e0808',.15):base;
  const hi={calf:.32,cordovan:.42,patent:.9,suede:0,'pebble-grain':.12,'scotch-grain':.2,canvas:0,knit:0}[L]??.32;
  let defs=`<radialGradient id="${P}hl" gradientUnits="userSpaceOnUse" cx="${toe.x}" cy="${toe.y}" r="${toe.r*(L==='patent'?.7:1)}"><stop offset="0" stop-color="${L==='cordovan'?'#fff3ec':'#fff'}" stop-opacity="${hi}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  let tex='',extra='';
  if(L==='suede'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="1.5" height="1.5"><circle cx=".4" cy=".5" r=".36" fill="#000" opacity=".18"/><circle cx="1.15" cy="1.1" r=".3" fill="#fff" opacity=".12"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  if(L==='pebble-grain'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="2.2" height="1.9"><circle cx=".6" cy=".55" r=".55" fill="#fff" fill-opacity=".06" stroke="#000" stroke-opacity=".3" stroke-width=".22"/><circle cx="1.7" cy="1.45" r=".5" fill="#fff" fill-opacity=".06" stroke="#000" stroke-opacity=".3" stroke-width=".22"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  if(L==='scotch-grain'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="1.2" height="1.1"><circle cx=".35" cy=".3" r=".3" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".16"/><circle cx=".95" cy=".85" r=".26" fill="#fff" fill-opacity=".1"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  // sneakers' textiles: canvas a fine plain weave, knit rows of small Vs; neither shines
  if(L==='canvas'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="1.4" height="1.4"><path d="M0,.35 H1.4 M0,1.05 H1.4" stroke="#000" stroke-opacity=".16" stroke-width=".3"/><path d="M.35,0 V1.4 M1.05,0 V1.4" stroke="#fff" stroke-opacity=".1" stroke-width=".3"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  if(L==='knit'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="2" height="1.6"><path d="M0,.2 L1,1.2 L2,.2" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".35"/><path d="M0,.7 L1,1.7 L2,.7" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width=".3"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  const gl=toe.g??1;   // the glint's size (the traced oxford pair takes a smaller one)
  if(L==='patent')extra=`<ellipse cx="${toe.x}" cy="${toe.y-toe.r*.18}" rx="${toe.r*.55*gl}" ry="${toe.r*.09*gl}" transform="rotate(${toe.rot||0} ${toe.x} ${toe.y})" fill="#fff" opacity=".75"/>`;
  if(L==='cordovan')extra=`<ellipse cx="${toe.x}" cy="${toe.y-toe.r*.15}" rx="${toe.r*.4*gl}" ry="${toe.r*.12*gl}" transform="rotate(${toe.rot||0} ${toe.x} ${toe.y})" fill="#fff" opacity="${gl<1?.18:.3}"/>`;
  // (the last outline: a faint light edge on the dark theme, --shoe-edge, so a black shoe doesn't vanish into the dark card)
  return {defs,body:`<path d="${d}" fill="${col}" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>${tex}<path d="${d}" fill="url(#${P}hl)"/>${extra}<path d="${d}" fill="none" style="stroke:var(--shoe-edge,transparent)" stroke-width=".6"/>`,sole:mix(base,'#000',.6)};
}

/* cap-toe oxford: the pair as the realistic item pictures show it (the owner wanted the drawing traced from them, as the sock was):
   traced on 2026-11-13 from the item picture of his black calf oxfords, each line placed on 3x crops of the picture and snapped to
   its edge or seam (back shoe, front shoe, soles, linings, the quarter and facing seams, cap toes, laces); toe right, heel left,
   the back shoe a little darker. Box 0..96 x 0..48.6, in the picture's own proportions (1 unit = 9.47 px of the 1024 px picture). */
const SHOE_OX={bout:'M22.9,10.2 C22.2,9.2 22.4,8.8 22.4,8 C22.4,7.1 22.7,6.1 22.9,5.1 C23,4.1 23.2,2.9 23.6,2.1 C24,1.3 24.5,0.8 25.3,0.6 C26.1,0.4 27.3,0.6 28.4,0.8 C29.5,1.1 30.8,1.7 32,2.2 C33.2,2.6 34.3,3.1 35.4,3.6 C36.4,4.1 37.5,4.6 38.4,5.1 C39.3,5.5 40.2,6 41,6.1 C41.8,6.3 42.6,6.1 43.4,5.8 C44.1,5.4 45,4.7 45.7,4.1 C46.5,3.6 47.2,2.9 47.9,2.4 C48.6,1.9 49.3,1.5 50.1,1.3 C50.8,1.2 51.6,1.2 52.5,1.4 C53.3,1.6 54.2,2.2 55,2.7 C55.8,3.3 56.6,4.1 57.3,4.9 C58,5.7 58.8,6.5 59.5,7.3 C60.3,8.1 61,8.9 61.7,9.7 C62.4,10.5 63,11.3 63.7,12 C64.4,12.8 65.1,13.4 65.7,14 C66.4,14.7 67.1,15.2 67.7,15.8 C68.3,16.5 68.8,17.4 69.5,18.1 C70.3,18.9 71.1,19.7 72.2,20.4 C73.4,21.1 74.9,21.5 76.5,22.1 C78.1,22.6 80.1,23 81.7,23.5 C83.4,24 85.1,24.6 86.6,25.1 C88,25.6 89.3,26.2 90.4,26.8 C91.5,27.4 92.4,28 93.1,28.6 C93.8,29.2 94.3,29.8 94.7,30.4 C95,30.9 95.3,31.4 95.4,31.9 C95.6,32.4 95.8,32.8 95.9,33.2 C96,33.6 96,34.1 95.9,34.4 C95.8,34.8 95.6,35.2 95.3,35.5 C94.8,35.7 94.3,36 93.5,36.2 C92.7,36.4 91.6,36.5 90.5,36.6 C89.3,36.7 87.9,36.8 86.5,36.8 C85,36.9 83.2,36.9 81.6,36.9 C80.1,36.9 78.4,36.9 76.9,36.8 C75.4,36.6 74.6,36.5 72.7,35.9 C70.8,35.3 68.9,34.5 65.5,33.1 C62.2,31.6 57.2,29.5 52.6,27.2 C47.9,25 41.8,22.1 37.5,19.9 C33.3,17.6 29.4,15.4 26.9,13.8 C24.5,12.1 23.7,11.2 22.9,10.2 Z',
  blin:'M25.8,0.8 C26.3,0.7 27.4,0.9 28.5,1.2 C29.5,1.5 30.8,2 32,2.5 C33.2,3 34.3,3.5 35.3,4.1 C36.4,4.5 37.5,5 38.2,5.4 C39,5.8 39.7,6.2 39.8,6.5 C39.8,6.8 39.3,7.1 38.6,7.2 C37.9,7.2 36.6,7.2 35.5,6.9 C34.4,6.7 33.2,6.2 32,5.8 C30.8,5.3 29.6,4.7 28.7,4.2 C27.7,3.6 26.8,3 26.2,2.6 C25.6,2.1 25.1,1.7 25.1,1.4 C25,1.1 25.2,0.8 25.8,0.8 Z',
  bwelt:'M72.9,33.8 C73.8,33.8 76.5,33.8 78.3,33.8 C80.2,33.8 82.1,33.8 84,33.7 C85.8,33.7 88,33.5 89.6,33.4 C91.1,33.2 92.5,33 93.5,32.7 C94.4,32.4 95,32.1 95.4,31.9',
  bfac:'M46.8,3.2 C46.9,3.4 47.4,4 47.9,4.5 C48.3,5 49,5.7 49.5,6.4 C50.1,7.1 50.7,8 51.3,8.8 C51.8,9.6 52.3,10.3 52.6,11.1 C53,11.9 53.3,12.6 53.4,13.3 C53.5,14 53.4,14.7 53.4,15.3 C53.4,15.8 53.2,16.6 53.1,16.9',
  bqtr:'M42.6,14.9 C43,14.9 44.5,14.8 45.4,14.9 C46.3,15 47.1,15.2 48,15.5 C48.9,15.7 49.7,16.2 50.6,16.6 C51.6,17 52.8,17.5 53.9,17.8 C54.9,18.2 56.1,18.5 57.2,18.6 C58.2,18.7 59.2,18.6 60.1,18.4 C61,18.3 61.8,17.8 62.6,17.5 C63.4,17.2 64.2,16.8 65,16.5 C65.7,16.1 66.8,15.6 67.2,15.4',
  bcap:'M77.4,20.7 C76.9,20.9 75.5,21.4 74.7,21.9 C73.8,22.3 73,22.8 72.2,23.4 C71.5,24 70.8,24.7 70.2,25.5 C69.7,26.1 69.3,26.9 68.9,27.7 C68.5,28.5 68.4,29.2 68.2,29.9 C67.9,30.7 67.7,31.8 67.6,32.2',
  fout:'M2.7,7.6 C3.3,6.8 4.1,6.2 5.1,6 C6.1,5.7 7.4,5.9 8.6,6.1 C9.8,6.3 11.1,6.8 12.2,7.1 C13.3,7.4 14.3,7.9 15.2,8.2 C16.2,8.6 17.1,8.8 18,9.1 C18.9,9.3 19.7,9.7 20.6,9.8 C21.4,10 22.2,10.2 23,10.1 C23.9,10.1 24.7,9.8 25.6,9.5 C26.5,9.1 27.4,8.6 28.3,8.1 C29.1,7.6 29.9,7 30.7,6.6 C31.4,6.2 31.9,5.9 32.5,5.9 C33.1,5.8 33.6,6 34.4,6.4 C35.1,6.9 36.1,7.6 36.8,8.3 C37.6,9 38.3,10 39,10.9 C39.7,11.7 40.2,12.6 40.8,13.4 C41.5,14.2 42.1,14.9 42.9,15.7 C43.6,16.4 44.5,17.3 45.3,18.1 C46.2,18.9 47,19.7 47.7,20.6 C48.5,21.4 49.1,22.3 49.8,23.1 C50.6,23.9 51.2,24.7 52,25.3 C52.9,26 53.7,26.6 54.7,27.1 C55.7,27.7 56.9,28.1 58,28.4 C59,28.8 60.2,28.9 61.2,29.3 C62.2,29.5 63,29.8 63.9,30.3 C64.8,30.8 65.7,31.5 66.7,32.2 C67.7,32.8 68.9,33.6 70,34.3 C71,35 72,35.6 72.9,36.2 C73.7,36.9 74.4,37.5 75,38.1 C75.5,38.8 75.9,39.3 76.3,39.9 C76.6,40.4 76.8,40.9 76.9,41.4 C77.1,41.9 77.4,42.3 77.4,42.8 C77.5,43.2 77.5,43.7 77.3,44.1 C77.1,44.5 76.8,44.9 76.4,45.3 C76,45.6 75.5,45.9 74.8,46.3 C74.1,46.6 73.4,46.8 72.3,47.1 C71.3,47.4 70,47.7 68.5,47.9 C67.1,48.1 65.4,48.2 63.7,48.3 C62,48.4 60.1,48.4 58.4,48.4 C56.7,48.4 54.9,48.4 53.2,48.3 C51.5,48.2 50,48.1 48.4,47.9 C46.8,47.7 45.3,47.5 43.7,47.3 C42.2,47 40.8,46.7 39.4,46.4 C38,46 36.8,45.7 35.4,45.3 C34.1,44.8 32.9,44.3 31.4,43.7 C29.8,43 28.1,42.1 26.1,41.2 C24.2,40.3 21.8,39.1 19.7,38.1 C17.7,37.1 15.6,36 14.2,35.2 C12.7,34.4 10.8,33.2 10.8,33.2 C10.8,33.2 10.7,37.8 10.7,37.8 C10.7,37.8 8.2,37 7,36.5 C5.8,36.1 4.6,35.6 3.4,35 C2.3,34.4 0.2,33 0.2,33 C0.2,33 0.1,31.6 0.1,30.6 C0,29.5 0,26.7 0,26.7 C0,26.7 0.1,24.5 0.2,23.3 C0.3,22 0.3,20.6 0.4,19.2 C0.5,17.8 0.6,16.4 0.8,15 C1,13.6 1.2,12.2 1.5,11 C1.8,9.8 2.2,8.4 2.7,7.6 Z',
  flin:'M4.1,7.2 C4.1,6.7 4.5,6.4 5.3,6.3 C6.1,6.2 7.4,6.5 8.6,6.8 C9.7,7 11,7.4 12.1,7.8 C13.2,8.1 14.2,8.5 15.1,8.9 C16.1,9.2 17,9.5 18,9.7 C18.9,10 19.8,10.1 20.5,10.3 C21.2,10.5 22,10.6 22.2,10.8 C22.5,11 22.5,11.2 22.2,11.6 C21.9,12 21.1,12.5 20.4,12.9 C19.6,13.4 18.7,13.8 17.8,14.2 C17,14.5 16,14.7 15.1,14.7 C14.2,14.8 13.3,14.8 12.4,14.6 C11.5,14.5 10.7,14.2 9.8,13.8 C9,13.4 8.1,12.7 7.4,12 C6.6,11.3 5.7,10.3 5.1,9.5 C4.6,8.7 4,7.8 4.1,7.2 Z',
  fwelt:'M0.3,26.7 C1,27 2.7,27.7 4,28.3 C5.3,28.8 6.9,29.3 8.3,29.8 C9.7,30.3 11,30.7 12.3,31.3 C13.5,31.8 14.6,32.4 15.8,33.1 C17,33.7 18.2,34.4 19.3,35.2 C20.5,36 21.7,36.8 22.9,37.6 C24,38.4 25.1,39.2 26.1,39.9 C27.1,40.6 28,41.2 29,41.8 C30,42.2 30.9,42.7 32.3,43.1 C33.6,43.5 35.2,43.8 37.3,44 C39.3,44.3 42.1,44.6 44.7,44.8 C47.2,45 50.1,45.1 52.6,45.2 C55.1,45.3 57.3,45.3 59.5,45.3 C61.6,45.2 63.7,45.1 65.5,45 C67.4,44.8 69.2,44.7 70.5,44.4 C72,44.1 73,43.8 73.9,43.5 C74.8,43.1 75.4,42.7 75.9,42.3 C76.4,41.9 76.7,41.4 76.9,41.2',
  fheel:'M0.3,30.9 C1,31.1 3.2,31.7 4.5,32 C5.9,32.3 7.2,32.6 8.2,32.9 C9.2,33.1 10.2,33.3 10.7,33.4',
  fcnt:'M1.4,15.4 C1.8,15.7 3,16.6 3.9,17.2 C4.6,17.8 5.5,18.4 6.2,19.1 C7,19.7 7.7,20.4 8.3,21.1 C9,21.8 9.6,22.4 10,23.2 C10.5,23.9 11,24.7 11.2,25.5 C11.5,26.2 11.6,27 11.6,27.8 C11.6,28.6 11.2,29.9 11.2,30.3',
  fqtr:'M11.9,25.9 C12.3,25.6 13.3,24.6 14,24.1 C14.6,23.6 15.2,23.1 15.9,22.8 C16.6,22.4 17.4,22.2 18.2,22 C19.1,21.9 20.1,21.8 21.1,21.9 C22.1,21.9 23.2,22 24.2,22.3 C25.2,22.5 26.1,22.9 27.1,23.3 C28,23.8 28.9,24.5 29.9,25.1 C30.8,25.6 31.9,26.3 32.9,26.7 C34,27.1 35.1,27.5 36.1,27.6 C37.1,27.6 38.1,27.5 39,27.2 C39.9,26.9 40.7,26.4 41.5,25.9 C42.3,25.5 43.1,24.8 43.8,24.3 C44.6,23.7 45.6,22.8 45.9,22.5',
  ffac:'M25.7,9.7 C25.9,10 26.7,10.9 27.2,11.6 C27.8,12.3 28.3,13 28.8,13.8 C29.4,14.5 29.9,15.4 30.4,16.3 C30.8,17.1 31.2,18.1 31.5,18.9 C31.8,19.8 31.9,20.6 32,21.5 C32,22.3 31.8,23.1 31.7,23.9 C31.5,24.6 31,25.6 30.9,25.9',
  fcap:'M46,45.1 C46.1,44.6 46.3,43.2 46.5,42.3 C46.6,41.3 46.8,40.3 47,39.4 C47.4,38.5 47.7,37.5 48.2,36.6 C48.6,35.8 49.2,35 49.8,34.2 C50.4,33.4 51.1,32.7 51.9,32 C52.7,31.3 53.7,30.7 54.5,30.2 C55.4,29.7 56.3,29.4 57.1,29.2 C57.9,29 58.9,28.9 59.2,28.8',
  fslit:'M33.3,6.2 C34.3,7.6 37.3,11.8 39.4,14.6 C41.4,17.4 44.4,21.6 45.4,23',
  flace:'M30.2,10 L35.7,7.8 M32.7,12.7 L38,10.3 M34.9,15.3 L40.3,12.9 M37,18 L42.6,15.4 M39.1,20.7 L44.7,18.3 M41.2,23.3 L46.8,20.9',
  blace:'M51.3,3.7 L55.2,2.6 M53.4,5.8 L57.1,4.8 M55.6,8 L59.2,7 M57.7,10.6 L61.4,9.3 M59.8,12.8 L63.7,11.6 M61.9,15.3 L66.1,14',
  fsole:'M0.3,26.7 L4,28.3 L8.3,29.8 L12.3,31.3 L15.8,33 L19.3,35.2 L22.8,37.6 L26.1,39.9 L29,41.7 L32.3,43.1 L37.3,44 L44.7,44.8 L52.6,45.2 L59.5,45.3 L65.5,45 L70.5,44.4 L73.9,43.5 L75.9,42.3 L76.9,41.2 L78.5,40.4 L78.5,51 L-1.8,51 L-1.8,25.7 Z',
  bsole:'M72.9,33.8 L78.3,33.8 L83.9,33.7 L89.6,33.3 L93.4,32.7 L95.4,31.9 L97.5,29.9 L97.5,40.4 L72.1,40.4 Z',
  fstitch:'M4,29 L8.3,30.5 L12.3,32 L15.8,33.8 L19.3,35.9 L22.8,38.3 L26.1,40.7 L29,42.5 L32.3,43.8 L37.3,44.8 L44.7,45.5 L52.6,45.9 L59.5,46 L65.5,45.7 L70.5,45.1 L73.9,44.2 L75.9,43.1',
  bstitch:'M72.9,34.4 L78.3,34.5 L83.9,34.4 L89.6,34 L93.4,33.3'};
/* the other styles: the same traced pair with only what differs redrawn in the picture's frame (the owner chose this, 2026-11-13, over
   making a picture of each style): the derby's tongue between open facings and the quarter's flap edge, the loafer's lower opening,
   moccasin apron and penny strap, the chelsea boot's shaft, elastic gusset and pull tab (the sneaker is a tracing of its own, below). Each entry replaces the oxford's paths of the same name. */
const SHOE_ST={derby:{fflap:'M46.3,22.7 C46.4,23.2 46.9,24.5 46.9,25.6 C47,26.6 46.9,27.9 46.6,29.1 C46.4,30.4 45.8,31.9 45.4,33.3 C44.8,34.6 44.2,36.1 43.7,37.5 C43.2,38.9 42.8,40.2 42.5,41.5 C42.1,42.7 41.8,44.3 41.7,44.9',
    bflap:'M67.2,15.4 C67.4,15.9 68,17.2 68.3,18.1 C68.6,19.1 68.9,20.1 69.1,21.3 C69.2,22.4 69.3,23.7 69.3,25 C69.3,26.2 69.2,27.6 69.1,29 C69,30.4 68.8,32.4 68.8,33.1',
    ftong:'M32.4,5.6 C32.4,5.6 35.1,5.2 35.1,5.2 C35.1,5.2 46.7,22.3 46.7,22.3 C46.7,22.3 45.3,23.4 45.3,23.4 C45.3,23.4 32.4,5.6 32.4,5.6 Z',
    btong:'M51.7,1.2 C51.7,1.2 53.3,1.2 53.3,1.2 C53.3,1.2 65.2,14.6 65.2,14.6 C65.2,14.6 63.9,15.4 63.9,15.4 C63.9,15.4 51.7,1.2 51.7,1.2 Z'},
  loafer:{fout:'M2.9,7.7 C3.4,6.9 4.2,6.3 5.1,6.1 C6.1,5.9 7.4,6.1 8.6,6.3 C9.8,6.5 11,7 12.1,7.4 C13.2,7.7 14.2,8.2 15.1,8.5 C16.1,8.8 17,9.1 18,9.4 C18.9,9.7 19.7,9.8 20.5,10 C21.4,10.1 22.1,10.2 23,10.4 C23.9,10.5 24.8,10.7 25.8,10.8 C26.7,11 27.8,11.1 28.8,11.4 C29.9,11.5 30.9,11.7 32,12 C33.1,12.3 34.1,12.5 35.2,12.8 C36.2,13.1 37.3,13.5 38.2,13.8 C39.2,14.2 40,14.6 40.9,15 C41.7,15.4 42.5,15.9 43.2,16.5 C43.9,17.1 44.7,17.7 45.4,18.4 C46.1,19.1 46.8,20 47.5,20.8 C48.2,21.5 48.9,22.5 49.6,23.3 C50.4,24 51.1,24.8 51.9,25.5 C52.8,26.1 53.7,26.6 54.7,27 C55.7,27.5 57,27.8 58.1,28.1 C59.1,28.5 60.3,28.7 61.3,29.1 C62.2,29.4 62.9,29.8 63.9,30.3 C64.8,30.8 65.7,31.5 66.7,32.2 C67.7,32.8 68.9,33.6 69.9,34.4 C70.9,35.1 71.9,35.8 72.7,36.5 C73.5,37.1 74.2,37.8 74.8,38.3 C75.3,38.9 75.7,39.5 76,40 C76.4,40.6 76.6,41 76.8,41.5 C77,41.9 77.2,42.3 77.3,42.8 C77.3,43.2 77.3,43.7 77.1,44.1 C77,44.5 76.8,44.9 76.4,45.3 C76,45.7 75.5,46 74.9,46.3 C74.2,46.6 73.4,46.9 72.3,47.2 C71.3,47.4 70,47.6 68.6,47.8 C67.1,47.9 65.4,48.1 63.7,48.2 C62,48.2 60.1,48.3 58.4,48.3 C56.7,48.2 54.9,48.2 53.3,48.1 C51.6,47.9 50,47.8 48.4,47.7 C46.8,47.5 45.3,47.4 43.8,47.2 C42.2,46.9 40.8,46.7 39.4,46.4 C38,46 36.8,45.7 35.4,45.3 C34.1,44.8 33,44.3 31.4,43.6 C29.8,42.9 28.1,42 26.2,41.1 C24.3,40.1 21.9,38.9 19.9,37.9 C17.9,36.9 15.7,35.8 14.3,35.1 C12.7,34.3 10.9,33.3 10.9,33.3 C10.9,33.3 10.6,37.6 10.6,37.6 C10.6,37.6 8.2,36.9 7,36.4 C5.9,35.9 4.7,35.4 3.6,34.8 C2.5,34.2 0.4,32.8 0.4,32.8 C0.4,32.8 0.4,31.5 0.4,30.5 C0.3,29.5 0.3,26.7 0.3,26.7 C0.3,26.7 0.4,24.6 0.5,23.3 C0.6,22 0.6,20.6 0.7,19.3 C0.8,17.8 1,16.4 1.1,15 C1.3,13.7 1.5,12.3 1.8,11 C2.1,9.8 2.3,8.5 2.9,7.7 Z',
    flin:'M4.1,7.2 C4.1,6.7 4.5,6.4 5.3,6.3 C6.1,6.2 7.4,6.5 8.6,6.8 C9.7,7 11,7.4 12.1,7.8 C13.2,8.1 14.2,8.5 15.1,8.9 C16.1,9.2 17,9.5 18,9.8 C18.9,10 19.7,10.2 20.5,10.4 C21.4,10.6 22.1,10.7 23,10.8 C23.9,10.9 24.8,11 25.8,11.1 C26.7,11.3 27.8,11.5 28.8,11.7 C29.8,11.8 31.1,12 31.9,12.3 C32.7,12.6 33.5,12.8 33.7,13.1 C33.8,13.4 33.5,13.7 32.8,14 C32.2,14.3 31,14.6 30,14.8 C28.9,14.9 27.7,15.1 26.6,15.2 C25.3,15.3 24.2,15.2 23,15.2 C21.8,15.2 20.5,15.2 19.3,15.2 C18.1,15.2 16.8,15.2 15.7,15.1 C14.6,15 13.5,15 12.5,14.8 C11.5,14.6 10.7,14.4 9.8,13.9 C9,13.5 8.1,12.8 7.4,12.1 C6.6,11.4 5.7,10.3 5.1,9.5 C4.6,8.7 4,7.8 4.1,7.2 Z',
    fapron:'M36.5,14.3 C36.9,15.1 37.8,17.5 38.8,19.2 C39.7,20.8 40.8,22.5 42.2,24 C43.6,25.5 45.4,27 47.3,28.3 C49.2,29.5 51.4,30.5 53.5,31.4 C55.7,32.3 58.1,33 60.3,33.6 C62.4,34.2 64.6,34.6 66.5,35.1 C68.3,35.4 70,35.7 71.3,36.1 C72.6,36.4 73.5,36.8 74.3,37.2 C75,37.7 75.7,38.5 75.9,38.8',
    fstrap:'M43.2,16.7 C43.2,16.7 46.4,19.3 46.4,19.3 C46.4,19.3 41.1,24.2 41.1,24.2 C41.1,24.2 38.3,20 38.3,20 C38.3,20 43.2,16.7 43.2,16.7 Z',
    fslot:'M40.9,20.4 C41.3,20 43.1,18.5 43.6,18.2',
    bout:'M22.9,10.3 C22.5,9.5 22.5,8.9 22.5,8 C22.6,7.1 22.9,6.1 23.1,5.2 C23.3,4.2 23.4,3 23.9,2.2 C24.2,1.4 24.7,0.8 25.4,0.6 C26.1,0.4 27.3,0.6 28.4,0.9 C29.5,1.1 30.8,1.7 32,2.2 C33.2,2.6 34.3,3.2 35.3,3.7 C36.4,4.2 37.4,4.8 38.3,5.2 C39.3,5.7 40.2,6.2 41.1,6.6 C42,7 42.9,7.4 43.8,7.7 C44.8,8 45.8,8.3 46.8,8.6 C47.8,8.9 48.9,9.1 50,9.3 C51,9.6 52.1,9.9 53.1,10.2 C54.2,10.6 55.2,10.9 56.3,11.4 C57.3,11.8 58.4,12.3 59.5,12.7 C60.5,13.1 61.5,13.6 62.5,14 C63.5,14.5 64.4,14.8 65.2,15.3 C66,15.7 66.7,16.1 67.4,16.6 C68.1,17.1 68.6,17.7 69.4,18.4 C70.2,19 71,19.8 72.2,20.4 C73.3,21.1 74.9,21.7 76.5,22.2 C78,22.8 80,23.3 81.6,23.8 C83.3,24.3 85,24.8 86.5,25.4 C87.9,25.9 89.2,26.5 90.2,27.1 C91.3,27.6 92.2,28.3 92.9,28.8 C93.6,29.4 94,30 94.5,30.5 C94.9,31 95.1,31.5 95.3,32 C95.5,32.4 95.6,32.8 95.7,33.3 C95.8,33.6 95.8,34.1 95.7,34.4 C95.6,34.7 95.5,35.1 95.2,35.4 C94.8,35.6 94.2,35.9 93.5,36.1 C92.7,36.3 91.6,36.4 90.5,36.5 C89.3,36.6 87.9,36.7 86.5,36.8 C85,36.8 83.2,36.8 81.6,36.8 C80.1,36.8 78.4,36.9 76.9,36.7 C75.4,36.5 74.1,36.4 72.7,36 C71.2,35.5 67.9,34.1 67.9,34.1 C67.9,34.1 53.1,27.8 53.1,27.8 C53.1,27.8 36.2,19.3 36.2,19.3 C36.2,19.3 24.6,13 24.6,13 C24.6,13 23.2,11.1 22.9,10.3 Z',
    blin:'M25.8,0.8 C26.3,0.7 27.4,0.9 28.5,1.2 C29.5,1.5 30.8,2 32,2.5 C33.2,3 34.3,3.5 35.3,4.1 C36.4,4.5 37.4,5 38.3,5.5 C39.3,6 40.2,6.4 41.1,6.8 C42,7.1 42.9,7.5 43.8,7.8 C44.8,8.1 45.8,8.4 46.8,8.7 C47.8,9 48.9,9.2 50,9.5 C51,9.7 52.2,10 53,10.3 C53.8,10.6 54.6,10.9 54.8,11.2 C55,11.4 54.6,11.7 54.1,11.8 C53.5,11.9 52.4,11.8 51.5,11.7 C50.5,11.5 49.4,11.2 48.4,10.9 C47.3,10.6 46.3,10.2 45.2,9.9 C44.1,9.5 43.1,9.1 42.1,8.8 C41,8.4 40,8.1 38.9,7.8 C37.8,7.5 36.6,7.3 35.5,7 C34.4,6.7 33.2,6.2 32,5.8 C30.8,5.3 29.6,4.7 28.7,4.2 C27.7,3.6 26.8,3 26.2,2.6 C25.6,2.1 25.1,1.7 25.1,1.4 C25,1.1 25.2,0.8 25.8,0.8 Z',
    bapron:'M57.3,12.7 C57.8,13.3 59.1,15.3 60.3,16.5 C61.5,17.7 62.8,19 64.5,20 C66.2,21.1 68.3,21.9 70.4,22.7 C72.5,23.5 75,24 77.3,24.7 C79.5,25.2 81.9,25.7 83.9,26.2 C85.9,26.8 87.7,27.4 89.1,28 C90.6,28.5 91.6,29.1 92.6,29.7 C93.5,30.3 94.2,30.9 94.5,31.2',
    bstrap:'M62.1,13.9 C62.1,13.9 65,15.3 65,15.3 C65,15.3 62.2,19.6 62.2,19.6 C62.2,19.6 59.6,16.7 59.6,16.7 C59.6,16.7 62.1,13.9 62.1,13.9 Z',
    bslot:'M60.6,17.4 C61.1,17.1 62.9,15.9 63.4,15.6'},
  boot:{fout:'M1.9,10 C2.1,8.4 2.3,6.9 2.5,5.3 C2.6,3.7 2.8,2.1 3,0.5 C3.1,-1.2 3.3,-2.9 3.5,-4.2 C3.6,-5.6 3.9,-6.8 4,-7.8 C4.2,-8.8 4.5,-10.2 4.5,-10.2 C4.5,-10.2 7.4,-10.7 9,-10.8 C10.6,-10.9 12.4,-11 14,-11 C15.8,-11 17.6,-10.9 19.3,-10.8 C21.1,-10.7 22.8,-10.6 24.3,-10.5 C25.9,-10.3 28.8,-10 28.8,-10 C28.8,-10 29.2,-7.3 29.4,-6 C29.6,-4.6 29.9,-3.2 30.2,-1.9 C30.5,-0.6 30.9,0.7 31.4,1.9 C31.8,3.1 32.4,4.3 33.1,5.4 C33.8,6.5 34.6,7.7 35.5,8.7 C36.3,9.8 37.4,10.8 38.3,11.7 C39.2,12.6 40,13.3 40.9,14 C41.7,14.8 42.5,15.4 43.2,16.2 C43.9,16.9 44.7,17.6 45.4,18.4 C46.1,19.1 46.8,20 47.5,20.8 C48.2,21.6 48.9,22.5 49.6,23.3 C50.4,24 51.1,24.8 51.9,25.5 C52.8,26.1 53.7,26.6 54.7,27 C55.7,27.5 57,27.8 58.1,28.1 C59.1,28.5 60.3,28.7 61.3,29.1 C62.2,29.4 62.9,29.8 63.9,30.3 C64.8,30.8 65.7,31.5 66.7,32.2 C67.7,32.8 68.9,33.6 69.9,34.4 C70.9,35.1 71.9,35.8 72.7,36.5 C73.5,37.1 74.2,37.8 74.8,38.3 C75.3,38.9 75.7,39.5 76,40 C76.4,40.6 76.6,41 76.8,41.5 C77,41.9 77.2,42.3 77.3,42.8 C77.3,43.2 77.3,43.7 77.1,44.1 C77,44.5 76.8,44.9 76.4,45.3 C76,45.7 75.5,46 74.9,46.3 C74.2,46.6 73.4,46.9 72.3,47.2 C71.3,47.4 70,47.6 68.6,47.8 C67.1,47.9 65.4,48.1 63.7,48.2 C62,48.2 60.1,48.3 58.4,48.3 C56.7,48.2 54.9,48.2 53.3,48.1 C51.6,47.9 50,47.8 48.4,47.7 C46.8,47.5 45.3,47.4 43.8,47.2 C42.2,46.9 40.8,46.7 39.4,46.4 C38,46 36.8,45.7 35.4,45.3 C34.1,44.8 33,44.3 31.4,43.6 C29.8,42.9 28.1,42 26.2,41.1 C24.3,40.1 21.9,38.9 19.9,37.9 C17.9,36.9 15.7,35.8 14.3,35.1 C12.7,34.3 10.9,33.3 10.9,33.3 C10.9,33.3 10.6,37.6 10.6,37.6 C10.6,37.6 8.2,36.9 7,36.4 C5.9,35.9 4.7,35.4 3.6,34.8 C2.5,34.2 0.4,32.8 0.4,32.8 C0.4,32.8 0.4,31.5 0.4,30.5 C0.3,29.5 0.3,26.7 0.3,26.7 C0.3,26.7 0.4,24.6 0.5,23.3 C0.6,22 0.6,20.7 0.7,19.3 C0.8,17.8 1,16.2 1.2,14.7 C1.4,13.1 1.7,11.6 1.9,10 Z',
    flin:'M6.1,-10 C6.5,-10.2 7.8,-10.5 9.1,-10.6 C10.5,-10.7 12.4,-10.8 14,-10.8 C15.7,-10.8 17.6,-10.7 19.3,-10.6 C21,-10.5 23,-10.4 24.2,-10.2 C25.5,-10.1 26.7,-9.9 26.8,-9.7 C26.9,-9.6 26.1,-9.3 25,-9.2 C24,-9.1 22,-9 20.4,-8.9 C18.7,-8.9 16.8,-8.9 15.1,-8.9 C13.4,-9 11.6,-9 10.1,-9.1 C8.7,-9.2 7.2,-9.3 6.6,-9.5 C5.9,-9.6 5.7,-9.9 6.1,-10 Z',
    fgus:'M11.7,-10.8 C11.7,-10.8 19.1,-10.7 19.1,-10.7 C19.1,-10.7 18.2,-5.6 17.7,-3.2 C17.2,-0.8 15.9,3.5 15.9,3.5 C15.9,3.5 14.7,-0.8 14,-3.2 C13.4,-5.6 11.7,-10.8 11.7,-10.8 Z',
    ftab:'M4.1,-9.6 C4.1,-9.6 4.2,-13.8 4.2,-13.8 C4.2,-13.8 7,-14 7,-14 C7,-14 6.9,-10 6.9,-10 C6.9,-10 4.1,-9.6 4.1,-9.6 Z',
    bout:'M22.9,9.6 C22.6,8.3 22.7,6.9 22.8,5.3 C22.9,3.8 23.3,2 23.6,0.3 C23.8,-1.3 24,-3.1 24.2,-4.5 C24.4,-6 24.6,-7.2 24.8,-8.3 C25,-9.5 25.2,-11.1 25.2,-11.1 C25.2,-11.1 28.4,-11.8 30,-11.9 C31.7,-12.1 33.5,-12.3 35.2,-12.3 C36.9,-12.4 38.7,-12.3 40.2,-12.2 C41.7,-12.1 43.1,-11.9 44.4,-11.8 C45.7,-11.7 47.8,-11.3 47.8,-11.3 C47.8,-11.3 48.2,-9 48.4,-7.9 C48.7,-6.7 48.9,-5.5 49.3,-4.4 C49.6,-3.3 50.1,-2.3 50.7,-1.3 C51.2,-0.3 52,0.6 52.8,1.5 C53.5,2.4 54.4,3.2 55.2,4.1 C56.1,5 57,5.9 57.9,6.8 C58.8,7.7 59.7,8.6 60.5,9.4 C61.4,10.2 62.3,11.2 63.1,12 C63.9,12.8 64.7,13.5 65.4,14.2 C66.2,14.8 66.8,15.4 67.5,16.1 C68.1,16.7 68.6,17.5 69.4,18.3 C70.2,19 71,19.7 72.2,20.4 C73.3,21.1 74.9,21.7 76.5,22.2 C78,22.8 80,23.3 81.6,23.8 C83.3,24.3 85,24.8 86.5,25.4 C87.9,25.9 89.2,26.5 90.2,27.1 C91.3,27.6 92.2,28.3 92.9,28.8 C93.6,29.4 94,30 94.5,30.5 C94.9,31 95.1,31.5 95.3,32 C95.5,32.4 95.6,32.8 95.7,33.3 C95.8,33.6 95.8,34.1 95.7,34.4 C95.6,34.7 95.5,35.1 95.2,35.4 C94.8,35.6 94.2,35.9 93.5,36.1 C92.7,36.3 91.6,36.4 90.5,36.5 C89.3,36.6 87.9,36.7 86.5,36.8 C85,36.8 83.2,36.8 81.6,36.8 C80.1,36.8 78.4,36.9 76.9,36.7 C75.4,36.5 74.1,36.4 72.7,36 C71.2,35.5 67.9,34.1 67.9,34.1 C67.9,34.1 53.1,27.8 53.1,27.8 C53.1,27.8 36.2,19.3 36.2,19.3 C36.2,19.3 24.6,13 24.6,13 C24.6,13 23.2,10.8 22.9,9.6 Z',
    blin:'M26.8,-11.3 C27.4,-11.5 28.8,-11.8 30.2,-11.9 C31.5,-12 33.5,-12.1 35.2,-12.1 C36.9,-12.1 38.7,-12.1 40.2,-12 C41.7,-11.9 43.4,-11.7 44.3,-11.6 C45.3,-11.5 46,-11.2 46,-11.1 C46,-11 45.3,-10.9 44.3,-10.8 C43.4,-10.7 41.7,-10.8 40.2,-10.8 C38.7,-10.8 36.8,-10.8 35.2,-10.8 C33.5,-10.8 31.6,-10.8 30.3,-10.8 C28.9,-10.8 27.5,-10.8 26.9,-10.8 C26.3,-10.9 26.3,-11.1 26.8,-11.3 Z',
    bgus:'M36,-12.4 C36,-12.4 42.1,-12 42.1,-12 C42.1,-12 41.4,-7.1 40.9,-5 C40.4,-2.8 39.4,0.8 39.4,0.8 C39.4,0.8 38.4,-2.9 37.8,-5 C37.2,-7.2 36,-12.4 36,-12.4 Z',
    btab:'M25.7,-11.1 C25.7,-11.1 25.6,-15.1 25.6,-15.1 C25.6,-15.1 28.1,-15.3 28.1,-15.3 C28.1,-15.3 28.2,-11.5 28.2,-11.5 C28.2,-11.5 25.7,-11.1 25.7,-11.1 Z'}};
/* a pair of shoes in style st (oxford, derby, loafer, boot, sneaker), toe right; box 0..96 wide, the boot's shaft rising above 0 */
function drawShoePair(item,P,st){
  const S={...SHOE_OX,...(SHOE_ST[st]||{})},base=item?colOf(item):'#2b2b2e',L=item&&item.leather||'calf',ox=st==='oxford';
  const f=leatherLayers(P+'f',item,S.fout,{x:67.9,y:39.4,r:17,rot:-8,g:.5}),b=leatherLayers(P+'b',item,S.bout,{x:88,y:29.9,r:12,rot:-8,g:.5});
  const lace=item?mix(base,'#000',.45):'#111',laceHi=mix(lace,'#fff',lum(base)>.35?.15:.3);
  const lin=mix('#a86a3e','#000',.18),linD=mix(lin,'#000',.35),edge=mix(base,'#000',.45);
  const seam=d=>d?`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".42" stroke-width=".45"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".28" stroke-dasharray=".7 .5" transform="translate(.35 .3)"/>`:'';
  const fill=(d,c,w=.4)=>`<path d="${d}" fill="${c}" stroke="${edge}" stroke-width="${w}"/>`;
  const laces=(d,w)=>`<path d="${d}" stroke="${lace}" stroke-width="${w}" stroke-linecap="round"/><path d="${d}" stroke="${laceHi}" stroke-width="${w*.3}" stroke-linecap="round" transform="translate(0 -.25)"/>`;
  const five=d=>d.split(' M').slice(0,5).join(' M');   // a derby has five pairs of eyelets
  const ribs=d=>{const n=d.match(/-?\d+(?:\.\d+)?/g).map(Number),xs=n.filter((_,i)=>i%2===0),ys=n.filter((_,i)=>i%2);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);let r='';
    for(let k=1;k<6;k++){const x=x0+(x1-x0)*k/6;r+=`M${x.toFixed(1)},${y0.toFixed(1)} L${x.toFixed(1)},${(y0+(y1-y0)*.75).toFixed(1)} `}return r};
  const shine=L==='suede'||L==='canvas'||L==='knit'?0:L==='patent'?.3:.13;
  // one shoe's parts after its leather, back (k 'b') or front ('f')
  const parts=k=>{const g=n=>S[k+n];let h='';
    h+=`<g clip-path="url(#${P}${k}c)"><path d="${g('sole')}" fill="${(k==='f'?f:b).sole}"/><path d="${g('stitch')}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".3" stroke-dasharray=".6 .5"/></g>`;
    h+=`<path d="${g('welt')}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".42"/>`+(k==='f'?`<path d="${S.fheel}" fill="none" stroke="#000" stroke-opacity=".4" stroke-width=".4"/>`:'');
    h+=`<path d="${g('lin')}" fill="url(#${P}ln)" stroke="${linD}" stroke-width=".35"/>`;
    if(st==='boot')h+=fill(g('gus'),mix(base,'#000',.3),.3)+`<path d="${ribs(g('gus'))}" stroke="#000" stroke-opacity=".22" stroke-width=".28"/>`+`<path d="${g('tab')}" fill="none" stroke="${mix(base,'#000',.3)}" stroke-width=".8" stroke-linejoin="round"/>`;   // the elastic gusset with its ribs; the pull tab a loop
    if(k==='f')h+=seam(S.fcnt);
    if(ox)h+=seam(g('fac'))+seam(g('qtr'));
    if(ox)h+=seam(g('cap'));
    if(st==='derby')h+=seam(g('flap'));
    if(st==='loafer')h+=`<path d="${g('apron')}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width=".7"/>`+seam(g('apron'))+fill(g('strap'),mix(base,'#000',.1),.4)+`<path d="${g('slot')}" stroke="#000" stroke-opacity=".7" stroke-width=".75" stroke-linecap="round"/>`;
    if(st==='derby')h+=fill(g('tong'),mix(base,'#000',.28),.35);
    if(ox&&k==='f')h+=`<path d="${S.fslit}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width=".7"/>`;
    if(ox||st==='derby'){const d=g('lace');h+=laces(st==='derby'?five(d):d,k==='f'?1.05:1)}
    return h};
  return `<g transform="translate(0 ${st==='boot'?8:2})"><defs>${b.defs}${f.defs}<clipPath id="${P}bc"><path d="${S.bout}"/></clipPath><clipPath id="${P}fc"><path d="${S.fout}"/></clipPath>`+
    `<linearGradient id="${P}ln" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lin}"/><stop offset="1" stop-color="${linD}"/></linearGradient>`+
    `<radialGradient id="${P}q" gradientUnits="userSpaceOnUse" cx="34" cy="22.5" r="12"><stop offset="0" stop-color="#fff" stop-opacity="${shine}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`+
    // the back shoe, a little darker, then the shadow the front shoe casts on it; then the front shoe
    b.body+`<path d="${S.bout}" fill="#000" opacity=".14"/>`+parts('b')+`<g clip-path="url(#${P}bc)"><path d="${S.fout}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2.6"/></g>`+
    f.body+`<path d="${S.fout}" fill="url(#${P}q)"/>`+parts('f')+'</g>';
}
/* sneaker: a tracing of its own (2026-11-13, the owner: "a normal pair of Nike sneakers"): Nike's product photo of the Air Force 1 '07
   in black, the pair seen from the front quarter, mirrored so the toes point right like the other shoes; the outline of the pair
   from the photo's pixels (the back shoe is the whole silhouette, the front one drawn over it), the rest placed on zoomed crops and
   snapped to its seam: cupsole and outsole, toe box stitching, heel seam, collars, tongues, laces, lace tags. No Swoosh, no
   lettering (Nike's marks). The sole takes the second colour, else white. Box 0..96 x 0..43.9. */
const SHOE_SN={bout:'M53,0 L52.6,0.1 L51.7,0.6 L49.4,1.4 L47.8,2.2 L46.7,2.7 L45.8,3.4 L45.1,4 L44.5,5.1 L44.3,5.5 L44.3,6.5 L44.2,6.9 L43.5,7.6 L43.1,7.8 L42.8,7.6 L41,5.8 L39.6,5 L38.8,4.8 L37.1,4.5 L35.3,4.5 L33.9,4.8 L33.5,5 L33,5.4 L32.8,5.8 L32.9,6.5 L32.7,7.7 L32.6,7.9 L32.5,7.9 L31.8,7.1 L31.2,6.7 L30.6,5.4 L30.1,4.9 L29.6,4.7 L29.1,4.3 L28.4,4.1 L27.8,4.2 L27.2,4.7 L27,4.7 L25.3,2.9 L23.8,1.8 L22.9,1.4 L22.5,1.5 L21,2 L19.4,2.4 L16.3,3.8 L14.9,4.8 L13.9,6 L12.9,6.5 L12.6,6.5 L11.9,6 L10.9,5.6 L9.9,5.4 L7.9,5.1 L6.2,5.1 L4.7,5.3 L3.7,5.6 L3.2,6 L2.9,6.9 L2.8,8.6 L2,13.2 L1.9,14.3 L2,15.2 L2,15.9 L2.1,16.6 L2,18.5 L1.3,24.4 L1.2,25.5 L1.3,26.7 L0.8,27.9 L0.8,28.4 L0.6,29.4 L0.4,31.4 L0.4,32.5 L0.1,33.5 L0.4,35 L0.3,36.1 L0.4,37.1 L0.3,37.3 L0,37.6 L0,38.1 L0.1,38.2 L0.2,38.2 L0.3,37.7 L0.5,37.5 L0.6,37.7 L0.8,38.2 L1,38.4 L3.6,39.2 L12,40.7 L15.9,41.3 L19.8,42 L25.9,42.8 L33.5,43.6 L39.9,43.9 L42.2,43.9 L43.4,43.9 L44.7,43.8 L45.7,43.9 L48.5,43.6 L49.6,43.4 L50.2,43.5 L54.4,42.8 L55.1,42.9 L57.2,42.6 L59.4,42.2 L59.9,42.1 L60.4,41.7 L62.7,40.9 L63.4,40.5 L64.6,40.4 L64.7,40.3 L64.7,39.6 L64.9,39.4 L67.3,39.5 L69.2,39.7 L72.7,39.9 L75.6,39.9 L81.4,39.5 L84.6,39.1 L87,39 L94,38.1 L94.8,37.7 L95.8,36.7 L96,36.1 L95.8,33.7 L95.5,32.9 L95.3,31.6 L95,31.1 L94.9,30.5 L94.8,30.2 L94,29.6 L93.7,28.3 L93.2,26.9 L92.6,25.9 L91.6,24.8 L91.3,24.6 L90.3,24.4 L88.4,23.7 L84.3,22.5 L80.5,20.8 L79.8,20.1 L78.3,19.3 L78,18.7 L77.7,18.3 L77,17.7 L76.2,17.3 L75.8,17 L75.5,16.6 L75.2,15.8 L74.7,15.4 L73.5,14.6 L72.3,14.2 L70.3,13.1 L69.8,12.4 L69.5,12 L67.8,11.3 L66.9,10.6 L65.7,9.9 L64.6,8.7 L63.3,7.9 L62.2,6.5 L61.6,5.4 L61.2,4.9 L60.6,4.6 L60.1,4.1 L59.7,3.9 L59.2,3.8 L58.5,3.9 L56.8,2 L55.8,1.2 L54.6,0.5 L53,0 Z',
  fout:'M63.6,33.2 C63.5,32.4 63.3,31.8 63,31.1 C62.7,30.5 62.4,30 62,29.4 C61.5,28.9 61,28.3 60.4,27.8 C59.7,27.3 59,26.8 58.2,26.3 C57.4,25.9 56.5,25.4 55.5,25 C54.5,24.5 53.4,24.1 52.3,23.6 C51.2,23.2 50,22.7 49,22.3 C47.9,21.8 46.8,21.4 45.9,20.8 C45,20.3 44.3,19.6 43.5,19 C42.8,18.3 42.2,17.5 41.5,16.8 C40.8,16 40.1,15.2 39.3,14.5 C38.5,13.7 37.6,12.9 36.8,12.1 C36,11.3 35.2,10.6 34.5,9.8 C33.7,9 32.9,8.2 32,7.4 C31.2,6.6 30.1,5.6 29.1,4.9 C28.1,4.1 27,3.4 26,3 C25,2.5 24.1,2.2 23.2,2.2 C22.2,2.2 21.4,2.6 20.4,3 C19.6,3.4 18.6,4 17.7,4.4 C16.8,4.9 15.9,5.4 15,5.7 C14.2,5.9 13.3,6 12.5,6 C11.6,6 10.7,5.7 9.7,5.6 C8.8,5.4 7.6,5.2 6.7,5.3 C5.7,5.3 4.8,5.3 4.2,5.7 C3.6,6.1 3.3,6.4 3,7.6 C2.6,8.8 2.5,10.6 2.3,12.8 C2.1,14.9 1.9,18.2 1.7,20.4 C1.5,22.6 1.4,24.6 1.2,26.1 C1.1,27.6 0.9,28.2 0.8,29.4 C0.7,30.6 0.5,31.9 0.5,33.1 C0.4,34.3 0.4,35.7 0.6,36.7 C0.9,37.5 1.2,38 2,38.5 C2.8,38.9 4,39.1 5.6,39.5 C7.2,39.9 9.4,40.2 11.6,40.6 C13.7,41 16.1,41.3 18.4,41.7 C20.6,42 22.9,42.3 25.2,42.6 C27.4,42.9 29.7,43.1 31.9,43.3 C34.2,43.5 36.5,43.6 38.8,43.6 C41,43.7 43.3,43.6 45.6,43.5 C47.8,43.3 50.1,43.1 52,42.9 C53.9,42.7 55.7,42.5 57.1,42.2 C58.5,42 59.5,41.7 60.4,41.3 C61.2,41 61.7,40.6 62.2,40.1 C62.7,39.6 63.1,39.1 63.3,38.4 C63.6,37.6 63.7,36.7 63.8,35.8 C63.8,35 63.8,33.9 63.6,33.2 Z',
  fmid:'M63.2,33.7 C62.5,33.6 60.4,33.3 58.8,33.2 C57.2,33.2 55.5,33.4 53.7,33.6 C51.9,33.8 50.1,34.1 48.1,34.3 C46.2,34.5 44.1,34.7 42,34.7 C39.9,34.7 37.6,34.5 35.4,34.2 C33.1,34 30.8,33.6 28.6,33.4 C26.4,33.2 24.2,33.1 22.3,32.9 C20.3,32.7 18.6,32.5 16.9,32.2 C15.1,31.9 13.4,31.5 11.6,31.1 C9.9,30.8 8,30.4 6.3,30 C4.6,29.7 2.2,29.1 1.3,28.9',
  ftread:'M63.8,36.5 L55.2,36.7 L46.4,36.5 L37.9,36.3 L28.6,36.3 L18.4,36.2 L9,35.9 L1,36.3 L-3.3,35.3 L-3.3,48.9 L67.3,48.9 L67.3,35.3 Z',
  fmud:'M62.4,28.8 C61.7,28.8 59.9,28.8 58.3,28.9 C56.6,28.9 54.4,29 52.3,29.1 C50.2,29.2 47.8,29.4 45.6,29.4 C43.3,29.5 41,29.4 38.8,29.4 C36.5,29.3 34.3,29.1 32,29 C29.7,28.8 27.5,28.6 25.2,28.4 C22.9,28.2 20.7,28 18.4,28 C16.2,27.9 13.7,27.9 11.6,27.9 C9.5,27.9 7.4,28 5.7,27.9 C4.1,27.8 2.4,27.5 1.7,27.4',
  fheels:'M12.5,11 C12.3,11.7 11.7,13.7 11.3,15 C10.9,16.4 10.4,17.7 9.9,19 C9.6,20.4 9.2,21.8 9,23.1 C8.7,24.3 8.5,25.6 8.4,26.4 C8.2,27.3 8.2,28.1 8.1,28.4',
  fcol:'M10.7,7 C10.2,6.4 9.1,5.9 8.2,5.7 C7.3,5.5 6,5.5 5.3,5.6 C4.5,5.7 3.9,6.1 3.5,6.6 C3.1,7.1 3,7.8 3,8.6 C3,9.3 3.2,10.2 3.4,10.9 C3.7,11.5 4.2,12.2 4.8,12.6 C5.3,13 6.1,13.2 6.7,13.3 C7.3,13.3 8,13.1 8.6,12.8 C9.2,12.5 9.7,11.9 10.1,11.3 C10.6,10.7 11,9.8 11.1,9.1 C11.2,8.4 11.2,7.5 10.7,7 Z',
  ftong:'M25.8,3.9 C25.9,3.3 25.4,2.5 24.8,2.2 C24.3,1.8 23.5,1.7 22.8,1.8 C22.1,1.9 21.4,2.4 20.7,2.9 C20.1,3.4 19.3,4.3 18.9,5 C18.5,5.7 18.2,6.5 18.3,7 C18.4,7.5 18.8,7.8 19.4,7.8 C20,7.9 20.9,7.6 21.8,7.3 C22.6,7 23.8,6.4 24.4,5.9 C25.1,5.3 25.7,4.5 25.8,3.9 Z',
  bmid:'M94.8,30 C94,30 91.5,30.1 89.8,30.2 C88.2,30.3 86.6,30.3 84.9,30.4 C83.1,30.6 81.3,30.7 79.5,30.8 C77.7,30.9 75.8,31 74,31.2 C72.1,31.3 70.5,31.4 68.6,31.5 C66.7,31.6 64.9,31.7 62.6,31.8 C60.3,31.9 57.6,32.1 54.7,32.2 C51.9,32.4 48.6,32.5 45.4,32.6 C42.2,32.6 37,32.7 35.4,32.7',
  btread:'M95,31.8 L89.9,31.9 L84.9,32.1 L79.5,32.5 L74,32.8 L68.6,33.2 L62.6,33.5 L54.7,33.9 L45.4,34.3 L35.4,34.5 L32,34.6 L32,48.9 L98.5,48.9 L98.5,31.2 Z',
  bmud:'M92.7,25.3 C92.1,25.4 90.3,25.5 88.9,25.6 C87.6,25.7 86.3,25.8 84.7,25.9 C83.1,26 81.3,26.2 79.5,26.3 C77.7,26.4 75.8,26.5 74,26.7 C72.1,26.9 70.4,27 68.6,27.2 C66.8,27.3 64.2,27.6 63.3,27.6',
  bcol:'M40.9,7.6 C40.7,6.9 40.1,6.2 39.4,5.7 C38.8,5.3 37.6,5 36.7,5 C35.8,4.9 34.6,5.1 34,5.6 C33.4,6.1 32.9,7 33.1,7.9 C33.2,8.8 34.2,10.1 35,10.7 C35.9,11.3 37.3,11.6 38.3,11.5 C39.2,11.4 40,10.7 40.5,10 C40.9,9.4 41,8.4 40.9,7.6 Z',
  btong:'M58.1,3.4 C58.5,3 58,2.4 57.4,2 C56.8,1.7 55.4,1.2 54.4,1.1 C53.4,1.1 52.1,1.3 51.3,1.6 C50.5,1.9 49.8,2.6 49.8,3 C49.8,3.4 50.3,3.8 51.2,4 C52,4.1 53.9,4.1 55.1,4 C56.2,3.9 57.7,3.7 58.1,3.4 Z',
  fsole:'M63.2,33.7 L58.8,33.2 L53.7,33.6 L48.1,34.3 L42,34.7 L35.4,34.2 L28.6,33.4 L22.3,32.9 L16.9,32.2 L11.6,31.1 L6.3,30 L1.3,28.9 L-3.3,28.5 L-3.3,48.9 L67.3,48.9 L67.3,31.9 Z',
  bsole:'M94.8,30 L89.8,30.2 L84.9,30.4 L79.5,30.8 L74,31.1 L68.6,31.5 L62.6,31.8 L54.7,32.2 L45.4,32.5 L35.4,32.7 L32,32.6 L32,48.9 L98.5,48.9 L98.5,29.2 Z',
  flace:'M31.3,7.5 L19.4,6.9 M34.6,10.3 L21.8,9.6 M37.3,13 L23.7,12.4 M39.3,15.9 L25.7,15.3 M41.3,18.9 L28.4,18.5',
  blace:'M63.2,6.8 L52.7,6.1 M66.6,9.5 L54.7,9 M70,12.4 L56.8,11.9 M72.7,15.3 L58.8,14.8 M74.7,18.2 L61.9,17.8',
  ftag:'M42.5,17.9 L38.4,17.9 L38.4,19.4 L42.5,19.4 Z',
  btag:'M76.8,17.1 L72.7,17.1 L72.7,18.3 L76.8,18.3 Z'};
function drawSneakerPair(item,P){
  const S=SHOE_SN,base=item?colOf(item):'#eee',lt=lum(base)>.6;
  const f=leatherLayers(P+'f',item,S.fout,{x:59,y:27,r:14,rot:-6,g:.5}),b=leatherLayers(P+'b',item,S.bout,{x:90,y:26,r:10,rot:-6,g:.5});
  const sc=item&&item.secondaryColor&&item.secondaryColor!=='none'&&COLORS[item.secondaryColor]?COLORS[item.secondaryColor]:'#f4f2ec',se=mix(sc,'#000',.3),tr=mix(sc,'#000',.12),rib=mix(sc,'#000',.32);
  const lace=mix(base,lt?'#000':'#fff',lt?.22:.16),laceHi=mix(lace,'#fff',.25),lin=mix(base,'#000',lt?.18:.45),edge=mix(base,'#000',.45);
  const seam=d=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".38" stroke-width=".4"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".25" stroke-dasharray=".6 .45" transform="translate(0 -.35)"/>`;
  const parts=k=>{const g=n=>S[k+n];
    return `<g clip-path="url(#${P}${k}c)"><path d="${g('sole')}" fill="${sc}"/><path d="${g('tread')}" fill="${tr}"/><path d="${g('tread')}" fill="url(#${P}rb)"/></g>`+
      `<path d="${g('mid')}" fill="none" stroke="${se}" stroke-width=".45"/><path d="${g('tread')}" fill="none" stroke="${se}" stroke-width=".35" clip-path="url(#${P}${k}c)"/>`+seam(g('mud'))+(k==='f'?seam(S.fheels):'')+
      `<path d="${g('col')}" fill="${lin}" stroke="${edge}" stroke-width=".9"/><path d="${g('tong')}" fill="${mix(base,'#000',.08)}" stroke="${edge}" stroke-width=".35"/>`+
      `<path d="${g('lace')}" stroke="${lace}" stroke-width="1.45" stroke-linecap="round"/><path d="${g('lace')}" stroke="${laceHi}" stroke-width=".4" stroke-linecap="round" transform="translate(0 -.3)"/>`+
      `<path d="${g('tag')}" fill="#c9ccd1" stroke="#6e737a" stroke-width=".25"/>`};
  return `<g transform="translate(0 4)"><defs>${b.defs}${f.defs}<clipPath id="${P}bc"><path d="${S.bout}"/></clipPath><clipPath id="${P}fc"><path d="${S.fout}"/></clipPath>`+
    `<pattern id="${P}rb" patternUnits="userSpaceOnUse" width="1.1" height="4"><rect width=".45" height="4" fill="${rib}"/></pattern></defs>`+
    b.body+`<path d="${S.bout}" fill="#000" opacity=".12"/>`+parts('b')+`<g clip-path="url(#${P}bc)"><path d="${S.fout}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.4"/></g>`+
    f.body+parts('f')+'</g>';
}
const drawOxfordSide=(item,P)=>drawShoePair(item,P,'oxford');
/* the drawing for a pair of shoes, by its style (shoeStyle in core.js; none = oxford) */
const drawShoeSide=(item,P)=>shoeStyle(item)==='sneaker'?drawSneakerPair(item,P):drawShoePair(item,P,SHOE_ST[shoeStyle(item)]?shoeStyle(item):'oxford');

/* dress sock, side view, traced from the item picture of the owner's charcoal sock with a burgundy toe (2026-11-13, as the shoes and
   belt were; it replaces the catalogue-photo tracing): the slanted cuff, the leg leaning back, the heel, the foot pointing right and
   the flat knitted toe cap, whose colour (the sock's secondary colour) also edges the cuff as on his socks; outline from the
   picture's pixels with the sole read by hand (the contact shadow made it ragged). Box 0..62.2 x 0..72. */
const SOCK_D={out:'M0.1,52.5 C0,52.3 0,51.2 0,50.8 C0,50.3 0,50.2 0.1,49.6 C0.3,49.1 0.4,48.5 0.8,47.4 C1.2,46.3 2.3,44.2 2.7,43.1 C3.2,42 3.4,41.5 3.6,40.7 C3.8,39.9 4,39.1 4.1,38.3 C4.3,37.6 4.3,37.5 4.4,36.3 C4.6,35.2 4.7,34.3 4.8,31.5 C5,28.7 5.1,23.1 5.2,19.5 C5.2,15.8 5.2,11.5 5.2,9.4 C5.2,7.3 5.2,8.4 5.1,6.9 C5,5.3 4.6,1.2 4.5,0.1 C4.4,-1 4.4,0.1 4.5,0.1 C4.6,0 3.6,-0.1 4.8,0 C6.1,0.1 9.1,0.4 12.1,0.7 C15.1,1 19.7,1.5 22.9,1.9 C26.1,2.3 29.9,2.9 31.4,3.1 C32.9,3.4 31.9,3.2 32,3.3 C32.1,3.4 32.3,2.9 32.1,3.7 C31.9,4.5 31.2,6.3 30.6,8.2 C30,10.2 29.5,11.7 28.5,15.3 C27.5,19 25.2,27.4 24.5,30.3 C23.8,33.2 24.3,32 24.2,32.7 C24.2,33.4 24.2,33.8 24.3,34.5 C24.4,35.3 24.5,36.4 24.7,37.2 C24.9,38 25.2,38.7 25.6,39.5 C26,40.3 26.6,41.4 27.1,42.1 C27.5,42.7 27.7,42.9 28.1,43.5 C28.6,44.1 28.6,44.2 29.9,45.5 C31.1,46.8 33.6,49.5 35.6,51.4 C37.6,53.3 40.1,55.7 41.7,57 C43.3,58.4 44.2,58.9 45.2,59.6 C46.2,60.2 46.9,60.6 47.6,61 C48.4,61.4 49.1,61.6 49.7,61.9 C50.4,62.2 50.6,62.3 51.6,62.5 C52.5,62.8 54.3,63.2 55.4,63.5 C56.4,63.8 57.4,64.1 58,64.3 C58.7,64.6 59,64.7 59.3,64.9 C59.7,65 59.8,65.1 60.1,65.3 C60.4,65.5 60.9,65.9 61.2,66.3 C61.5,66.6 61.8,67 61.9,67.4 C62.1,67.8 62.4,68.1 62.2,68.6 C62,69.1 61.3,70.1 60.7,70.5 C60.1,71 59.5,71.2 58.3,71.4 C57.1,71.5 55.3,71.6 53.4,71.7 C51.6,71.7 49,71.8 47,71.8 C45,71.8 43.1,71.7 41.3,71.7 C39.6,71.6 38,71.6 36.4,71.5 C34.8,71.4 33.1,71.2 31.8,71 C30.5,70.7 29.8,70.4 28.8,69.7 C27.8,69.1 26.8,68 25.7,67.2 C24.7,66.3 23.9,65.5 22.8,64.7 C21.6,63.8 20.2,62.9 18.7,62.2 C17.2,61.4 15.3,60.6 13.6,59.9 C12,59.2 10.3,58.7 8.6,58.1 C7,57.5 4.7,56.9 3.6,56.3 C2.4,55.7 2.1,55.3 1.5,54.6 C1,53.9 0.6,52.4 0.3,52.1 C0.1,51.7 0.1,52.7 0.1,52.5 Z',
  cuff:'M3.4,-0.6 L32.9,2.7 L32.9,4.4 L3.4,1.1 Z',
  cuffl:'M3.4,1.1 L32.9,4.4',
  toe:'M50.5,61.3 C49.9,63.8 49.4,67 49.3,72.6 L66.3,72.6 L66.3,60.5 Z',
  toel:'M50.5,61.3 C49.9,63.8 49.4,67 49.3,72.6',
  heel:'M-1.5,49.2 C5,49.2 7.8,53.3 7,57.7 L-1.5,58.9 Z',
  sole:'M1,55 C13.1,59.7 25.2,67 34.1,70.6 L66.3,71.2 L66.3,73.5 L-1.5,73.5 Z',
  ribs:'M6,0.2 L3.1,42.1 M7.5,0.4 L4.4,41.4 M9,0.6 L5.7,40.8 M10.6,0.8 L7,40.1 M12.1,0.9 L8.3,39.4 M13.6,1.1 L9.6,38.7 M15.2,1.3 L10.9,38.1 M16.7,1.5 L12.2,37.4 M18.2,1.7 L13.5,36.7 M19.8,1.9 L14.8,36.1 M21.3,2.1 L16.1,35.4 M22.8,2.3 L17.4,34.7 M24.4,2.4 L18.7,34 M25.9,2.6 L20,33.4 M27.4,2.8 L21.3,32.7 M29,3 L22.6,32 M30.5,3.2 L23.9,31.3'};
function drawSock(color,P,toe){
  const S=SOCK_D,ink=lum(color)>.55?'#000':'#fff',welt=mix(color,'#fff',lum(color)>.55?.12:.42);
  return `<defs><linearGradient id="${P}sh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="62" y2="12"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".3" stop-color="#fff" stop-opacity=".07"/><stop offset=".6" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`+
    `<clipPath id="${P}sk"><path d="${S.out}"/></clipPath></defs>`+
    `<path d="${S.out}" fill="${color}"/>`+
    `<g clip-path="url(#${P}sk)">`+
      // fine knit lines that follow the leg's lean
      `<path d="${S.ribs}" stroke="${ink}" stroke-opacity=".07" stroke-width=".3"/>`+
      // the cuff's edge: the toe's colour where there is one (as on his socks), else a heathered welt
      `<path d="${S.cuff}" fill="${toe||welt}"/><path d="${S.cuffl}" stroke="${ink}" stroke-opacity=".12" stroke-width=".3"/>`+
      // the heel pocket and a soft shadow along the sole
      `<path d="${S.heel}" fill="#000" opacity=".08"/><path d="${S.sole}" fill="#000" opacity=".08"/>`+
      (toe?`<path class="sock-toe" d="${S.toe}" fill="${toe}"/><path d="${S.toel}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".35"/>`:'')+
      `<path d="M-2,-2 L66,-2 L66,76 L-2,76 Z" fill="url(#${P}sh)"/>`+
    `</g>`+
    `<path d="${S.out}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".5"/>`;
}

/* wristwatch seen from above, centred on 0,0; case radius ~15, bracelet to about +/-49.
   Options: dial colour, metal bracelet or leather strap, fluted or smooth bezel, and a dual-time/annual-calendar
   dial (off-centre 24h disc, month apertures, cyclops date). No maker's name or logo is drawn. */
function drawWatch(w,P){
  const o=watchOpts(w),[mL,mM,mD]=METAL_TONES[w&&w.metal]||METAL_TONES.silver,dial=COLORS[o.dial]||'#f6f6f3';
  const ink=lum(dial)<.45?'#e9eaec':'#1d2125',f=n=>+n.toFixed(2),now=new Date();
  let s=`<defs>
   <linearGradient id="${P}br" x1="0" x2="1"><stop offset="0" stop-color="${mD}"/><stop offset=".28" stop-color="${mL}"/><stop offset=".55" stop-color="${mM}"/><stop offset=".8" stop-color="${mL}"/><stop offset="1" stop-color="${mD}"/></linearGradient>
   <linearGradient id="${P}po" x1="0" x2="1"><stop offset="0" stop-color="${mD}"/><stop offset=".35" stop-color="#fff"/><stop offset=".6" stop-color="${mM}"/><stop offset=".85" stop-color="${mL}"/><stop offset="1" stop-color="${mD}"/></linearGradient>
   <radialGradient id="${P}cs" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${mL}"/><stop offset="1" stop-color="${mD}"/></radialGradient>
   <radialGradient id="${P}dl" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${mix(dial,'#fff',.4)}"/><stop offset="1" stop-color="${mix(dial,'#000',.07)}"/></radialGradient>
   <linearGradient id="${P}gl" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>`;
  if(o.band==='bracelet'||o.band==='integrated'){
    // three-piece links: brushed outer links, polished centre link; an integrated bracelet starts wide, flowing from the case
    const integ=o.band==='integrated';
    for(const sg of [-1,1])for(let k=0;k<6;k++){
      const wd=(integ?(k===0?22:k===1?19.5:17.6):16.6)-k*.45,h=4.9,y=sg>0?17.3+k*5.3:-17.3-k*5.3-h,ow=wd*.36,cw=wd*.25,g=.35;
      s+=`<rect x="${f(-wd/2)}" y="${f(y)}" width="${f(ow-g)}" height="${h}" rx=".7" fill="url(#${P}br)" stroke="${mD}" stroke-width=".12"/>`+
         `<rect x="${f(-cw/2)}" y="${f(y)}" width="${f(cw)}" height="${h}" rx=".7" fill="url(#${P}po)" stroke="${mD}" stroke-width=".12"/>`+
         `<rect x="${f(wd/2-ow+g)}" y="${f(y)}" width="${f(ow-g)}" height="${h}" rx=".7" fill="url(#${P}br)" stroke="${mD}" stroke-width=".12"/>`;
    }
  }else{
    const sc=w?colOf(w):'#3a2414',st=mix(sc,'#fff',.35);
    for(const sg of [-1,1]){const p=`M-8.4,${16*sg} L8.4,${16*sg} L7.2,${44*sg} Q0,${50*sg} -7.2,${44*sg} Z`;
      s+=`<path d="${p}" fill="${sc}" stroke="#000" stroke-opacity=".35" stroke-width=".3"/><path d="M-6.9,${17.5*sg} L-6,${43*sg} M6.9,${17.5*sg} L6,${43*sg}" stroke="${st}" stroke-width=".3" stroke-dasharray=".9 .6"/><path d="${p}" fill="url(#${P}gl)" opacity=".4"/>`}
  }
  s+=`<path d="M-11.6,-10 C-10.6,-13 -9.4,-15.6 -8.6,-17.6 L8.6,-17.6 C9.4,-15.6 10.6,-13 11.6,-10 Z" fill="url(#${P}br)" stroke="${mD}" stroke-width=".15"/><path d="M-11.6,10 C-10.6,13 -9.4,15.6 -8.6,17.6 L8.6,17.6 C9.4,15.6 10.6,13 11.6,10 Z" fill="url(#${P}br)" stroke="${mD}" stroke-width=".15"/>`;
  s+=`<rect x="14.9" y="-2.4" width="3.6" height="4.8" rx=".9" fill="url(#${P}cs)" stroke="${mD}" stroke-width=".2"/>`;
  if(o.style==='chronograph')for(const a of [-38,38])s+=`<g transform="rotate(${a})"><rect x="14.6" y="-1.5" width="3.2" height="3" rx=".7" fill="url(#${P}cs)" stroke="${mD}" stroke-width=".2"/><rect x="17.4" y="-1.8" width="1.1" height="3.6" rx=".4" fill="url(#${P}po)" stroke="${mD}" stroke-width=".15"/></g>`;   // chronograph pushers at 2 and 4
  for(let y=-1.8;y<=1.81;y+=.6)s+=`<line x1="15.4" x2="18.1" y1="${f(y)}" y2="${f(y)}" stroke="${mD}" stroke-width=".14"/>`;
  s+=`<circle r="15.4" fill="url(#${P}cs)" stroke="${mD}" stroke-width=".3"/>`;
  if(o.bezel==='fluted'){for(let i=0;i<96;i++){const a=i/96*Math.PI*2,c=Math.cos(a),n=Math.sin(a),lit=(Math.cos(a+2.4)+1)/2;
    s+=`<line x1="${f(12.95*c)}" y1="${f(12.95*n)}" x2="${f(15.15*c)}" y2="${f(15.15*n)}" stroke="${i%2?mD:mix(mM,'#fff',lit*.8)}" stroke-width=".7"/>`}}
  else{s+=`<circle r="14.05" fill="none" stroke="url(#${P}po)" stroke-width="2.1"/>`;
    // engraved numerals around a polished bezel
    if(o.bezel==='engraved')for(let i=1;i<=12;i++)s+=`<g transform="rotate(${i*30})"><text y="-13.55" font-size="1.15" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" fill="${mD}" fill-opacity=".85" transform="rotate(0)">${i*5}</text></g>`}
  s+=`<circle r="12.9" fill="none" stroke="${mD}" stroke-width=".3"/><circle r="12.75" fill="url(#${P}dl)"/>`;
  for(let i=0;i<60;i++)if(i%5)s+=`<g transform="rotate(${i*6})"><line y1="-12.1" y2="-12.55" stroke="${ink}" stroke-opacity=".4" stroke-width=".14"/></g>`;
  if(o.style==='annual-calendar'){
    // month apertures next to each hour marker (January at 1 o'clock); the current month shows red
    for(let m=0;m<12;m++)s+=`<g transform="rotate(${(m+1)*30})"><rect x="-.75" y="-12.1" width="1.5" height="1" rx=".15" fill="${m===now.getMonth()?'#c8102e':mix(dial,'#000',.1)}" stroke="${ink}" stroke-opacity=".35" stroke-width=".1"/></g>`;
  }
  const chrono=o.style==='chronograph',SUBS=[[-5.4,-3.6,2.9],[4.9,-4.2,3],[0,4.3,4.6]];
  for(let h=0;h<12;h++){if(h===3&&o.style!=='no-date'&&!chrono)continue;
    if(chrono){const a=h*Math.PI/6,mx=9.4*Math.sin(a),my=-9.4*Math.cos(a);if(h===0||h===6||(h>=4&&h<=5)||SUBS.some(([x,y,r])=>Math.hypot(mx-x,my-y)<r+1.6))continue}
    const bar=x=>`<rect x="${x}" y="-10.6" width=".95" height="2.4" rx=".2" fill="url(#${P}po)" stroke="${mD}" stroke-width=".12"/>`;
    s+=`<g transform="rotate(${h*30})">${h===0?bar(-1.3)+bar(.35):bar(-.48)}</g>`}
  if(o.style==='annual-calendar'){
    // off-centre 24-hour disc with a red pointer
    s+=`<circle cy="4.7" r="3.9" fill="${mix(dial,'#000',.05)}" stroke="${ink}" stroke-opacity=".35" stroke-width=".15"/>`;
    for(let i=0;i<24;i++)s+=`<g transform="translate(0 4.7) rotate(${i*15})"><line y1="-3.3" y2="${i%2?-3.6:-3.8}" stroke="${ink}" stroke-opacity=".55" stroke-width=".12"/></g>`;
    s+=`<path d="M-.65,.45 L.65,.45 L0,1.45 Z" fill="#c8102e"/>`;
  }
  if(chrono){
    // like a sporty kinetic chronograph: small seconds at 10, a 15/30/45 minute counter at 2 (blue segment at 45), and the time
    // itself on a large subdial at 6 with applied 12 and 6; a long dark chronograph seconds hand in the centre; date at 4:30
    SUBS.forEach(([x,y,r],n)=>{s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${mix(dial,'#000',n===2?.03:.06)}" stroke="${mD}" stroke-width=".22"/><circle cx="${x}" cy="${y}" r="${f(r-.5)}" fill="none" stroke="${ink}" stroke-opacity=".18" stroke-width=".12"/>`;
      for(let t=0;t<12;t++)s+=`<g transform="translate(${x} ${y}) rotate(${t*30})"><line y1="${f(-r+.2)}" y2="${f(-r+(t%3?.6:1))}" stroke="${ink}" stroke-opacity=".6" stroke-width="${t%3?.1:.18}"/></g>`;
      if(n===1)s+=`<path d="M${f(x-r+.25)},${y} A${f(r-.25)},${f(r-.25)} 0 0 1 ${f(x-(r-.25)*Math.cos(Math.PI/6))},${f(y-(r-.25)*.5)}" fill="none" stroke="#1f4fa8" stroke-width=".45"/>`;
      if(n<2){const ang=[250,20][n];s+=`<g transform="translate(${x} ${y}) rotate(${ang})"><path d="M-.22,.5 L0,${f(-r+.6)} L.22,.5 Z" fill="${n?'#1d2125':ink}"/></g><circle cx="${x}" cy="${y}" r=".35" fill="${mD}"/>`}});
    const num=(t,y,sz)=>`<text x="0" y="${y}" font-size="${sz}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="url(#${P}po)" stroke="${mD}" stroke-width=".12">${t}</text>`;
    s+=num('12',1.9,2.2)+num('6',8.6,2.2);
    s+=`<g transform="rotate(135)"><rect x="-1.5" y="-11" width="3" height="2.4" fill="#fff" stroke="${ink}" stroke-opacity=".4" stroke-width=".12" transform="rotate(-135 0 -9.8)"/></g>`;
  }
  else if(o.style!=='no-date')s+=`<rect x="7.3" y="-1.6" width="3.7" height="3.2" fill="#fff" stroke="${ink}" stroke-opacity=".4" stroke-width=".12"/><text x="9.15" y=".98" font-size="2.7" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#111">${now.getDate()}</text><rect x="6.5" y="-2.5" width="5.3" height="5" rx="1.1" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".7" stroke-width=".2"/>`;
  const hand=(deg,len,wid,tail)=>`<g transform="rotate(${deg})"><path d="M${-wid/2},${tail} L${-wid/2},${f(-len+wid)} L0,${-len} L${wid/2},${f(-len+wid)} L${wid/2},${tail} Z" fill="url(#${P}po)" stroke="${mD}" stroke-width=".16"/><rect x="${f(-wid*.22)}" y="${f(-len+wid*1.7)}" width="${f(wid*.44)}" height="${f(len*.55)}" fill="#f5f7ef"/></g>`;
  if(chrono){const [x,y]=SUBS[2];
    s+=`<g transform="translate(${x} ${y}) scale(.42)">${hand(305,6.6,1.3,1.4)+hand(240,10.6,1.05,1.6)}</g><circle cx="${x}" cy="${y}" r=".45" fill="url(#${P}po)" stroke="${mD}" stroke-width=".1"/>`;
    s+=`<g transform="rotate(0)"><path d="M-.18,2.6 L-.12,-11.8 L.12,-11.8 L.18,2.6 Z" fill="#1d2125"/></g><circle r=".75" fill="#1d2125"/>`}
  else{s+=hand(305,6.6,1.3,1.4)+hand(60,10.6,1.05,1.6);
  s+=`<g transform="rotate(210)"><line y1="2.8" y2="-11.6" stroke="${mD}" stroke-width=".22"/></g><circle r=".8" fill="url(#${P}po)" stroke="${mD}" stroke-width=".12"/>`}
  s+=`<circle r="12.75" fill="url(#${P}gl)" opacity=".55"/>`;
  return s;
}


/* a buckled section of belt: buckle in the middle with a little leather either side, centred on 0,0 (about 62 x 20) */
/* belt: traced from the item picture of the owner's oxblood cordovan belt (2026-11-13, as the shoes were): the coil behind, the darker
   inner face showing at its top, the front strap with its stitching, holes and pointed tip, the leather keeper, and the buckle's
   frame and prong in the belt's metal; every edge placed on gridded crops of the picture and snapped. Box 0..96 x 0..44.6. */
const BELT_D={back:'M5.3,16.3 C5.6,14.9 6,13 6.3,11.4 C6.7,9.7 7,7.6 7.3,6.1 C7.7,4.6 7.7,3.5 8.3,2.6 C9,1.6 9.7,1.1 11.4,0.7 C13.1,0.3 15.8,0.3 18.7,0.3 C21.7,0.2 25.6,0.4 28.8,0.6 C32.2,0.8 35.4,1.1 38.7,1.4 C41.9,1.7 44.7,2.1 48.3,2.7 C51.9,3.3 56,4.1 60,5.1 C64.1,6.2 68.7,7.7 72.4,8.9 C76.1,10.1 79.5,11.5 82.2,12.5 C84.8,13.6 86.8,14.4 88.3,15.3 C89.8,16.1 90.6,16.8 91.1,17.6 C91.7,18.4 92.9,19.2 91.9,20.1 C91,21 89.8,21.9 85.4,22.9 C81.1,23.9 65.8,26.3 65.8,26.3 C65.8,26.3 23.6,26.3 23.6,26.3 C23.6,26.3 4.5,22.1 4.5,22.1 C4.5,22.1 4.6,20.3 4.7,19.4 C4.8,18.4 5,17.6 5.3,16.3 Z',
  inner:'M11.7,1.4 C12.8,1.1 15.7,1 18.5,1 C21.4,0.9 25.5,1 28.8,1.2 C32.2,1.3 35.4,1.5 38.6,1.8 C41.8,2.2 44.7,2.4 48.3,3.1 C51.8,3.6 56,4.5 60,5.5 C64,6.5 68.7,7.9 72.4,9.1 C76,10.3 79.5,11.7 82.1,12.8 C84.8,13.8 86.7,14.7 88.1,15.6 C89.5,16.4 90.2,17.2 90.8,17.9 C91.4,18.5 91.4,19.2 91.4,19.4 C91.4,19.6 91.1,19.4 90.7,19.1 C90.3,18.8 90,18.2 89.1,17.7 C88.2,17.3 87.4,16.9 85.4,16.5 C83.3,16.1 80.3,15.7 76.6,15.3 C73,14.8 68.1,14.3 63.7,13.9 C59.4,13.4 54.9,13 50.5,12.4 C46,11.8 41.3,11.1 37,10.3 C32.7,9.5 28,8.4 24.6,7.5 C21.2,6.5 18.6,5.4 16.4,4.6 C14.3,3.8 12.5,3.1 11.7,2.5 C10.9,2 10.5,1.7 11.7,1.4 Z',
  bstitch:'M10.7,4.1 C11.7,4.5 14.5,5.7 16.9,6.5 C19.3,7.3 21.5,8.2 24.9,9.1 C28.3,10 32.7,11 37,11.8 C41.3,12.6 46,13.3 50.5,13.9 C54.9,14.5 59.4,14.9 63.7,15.4 C68.1,15.8 73,16.3 76.6,16.7 C80.3,17.2 83.4,17.5 85.6,18 C87.9,18.4 89.3,19.1 90.1,19.3',
  strap:'M3.2,22.1 C4.9,20.4 8,20 10.4,19.7 C12.8,19.4 15.3,20.1 17.6,20.2 C20,20.3 21.9,20.3 24.6,20.3 C27.4,20.3 30.7,20.3 34.1,20.3 C37.4,20.3 41.3,20.3 44.7,20.3 C48,20.3 51.2,20.2 54,20.3 C56.8,20.4 58.7,20.6 61.3,20.9 C63.8,21.2 66.3,21.7 69.3,22 C72.4,22.4 76.3,22.7 79.4,22.9 C82.5,23.2 85.8,23.3 88,23.6 C90.2,23.8 91.5,24 92.6,24.6 C93.7,25 94,25.7 94.6,26.5 C95.2,27.4 95.9,29.5 95.9,29.5 C95.9,29.5 94.4,31.7 93.5,32.7 C92.7,33.7 91.7,34.6 90.9,35.5 C90.1,36.3 89.5,37 88.6,37.7 C87.7,38.4 87.1,39.1 85.3,39.6 C83.6,40.1 81.4,40.5 78.1,40.9 C74.9,41.2 70.2,41.6 65.8,41.9 C61.5,42.1 56.3,42.6 51.9,42.7 C47.4,42.9 43.2,42.9 39,42.8 C34.9,42.8 30.8,42.6 26.8,42.3 C22.9,42 18.6,41.8 15.2,41.3 C11.8,40.9 8.6,40.6 6.3,39.8 C4.1,39 2.6,38.3 1.7,36.6 C0.7,34.9 0.2,32 0.4,29.6 C0.7,27.1 1.6,23.8 3.2,22.1 Z',
  tstitch:'M1.6,21 C3.3,21.1 7.9,21.3 11.9,21.5 C15.9,21.8 20.4,22 25.7,22.2 C30.9,22.3 37.8,22.3 43.3,22.5 C48.8,22.6 54.3,22.6 58.6,22.8 C62.9,23 65.9,23.4 69.4,23.7 C72.8,24 76.3,24.3 79.4,24.7 C82.5,24.9 85.8,25.2 88,25.5 C90.2,25.7 91.9,26.1 92.7,26.3',
  lstitch:'M1.6,37.3 C3.7,37.7 10.2,39 14.4,39.6 C18.6,40.1 22.7,40.4 26.8,40.7 C30.9,41 34.9,41 39,41.1 C43.2,41.1 47.4,41.1 51.9,40.9 C56.3,40.8 61.5,40.4 65.9,40.2 C70.2,39.9 74.8,39.6 78.1,39.2 C81.4,38.8 83.7,38.3 85.8,37.6 C87.8,36.8 89.1,35.6 90.3,34.7 C91.5,33.7 92.3,32.4 92.9,31.6 C93.6,30.7 93.9,29.8 94.1,29.5',
  keeper:'M60.3,21.2 C60.3,21.2 61.6,20.6 62.6,20.6 C63.7,20.5 65.5,20.5 66.6,20.8 C67.7,20.9 69.3,21.7 69.3,21.7 C69.3,21.7 69.1,42.8 69.1,42.8 C69.1,42.8 67.7,43.5 66.7,43.6 C65.7,43.7 63.9,43.7 62.9,43.6 C61.8,43.5 60.3,42.8 60.3,42.8 C60.3,42.8 60.3,21.2 60.3,21.2 Z',
  kstitch:'M61.6,21.2 C61.6,23.1 61.5,28.7 61.5,32.3 C61.5,35.9 61.6,41 61.6,42.8',
  kstitch2:'M68.1,21.4 C68.1,23.3 68.1,28.8 68.1,32.4 C68.1,35.9 68,41 68,42.8',
  frame:'M55.2,19.7 L28.5,19.7 Q27,19.7 27,21.2 L27,42.3 Q27,43.8 28.5,43.8 L55.2,43.8 L55.2,41.7 L31.8,41.7 Q30.7,41.7 30.7,40.7 L30.7,23.6 Q30.7,22.5 31.8,22.5 L55.2,22.5 Z',
  prong:'M28.4,31.8 L33.9,31.8 Q34.6,32.7 33.9,33.7 L28.4,33.7 Q27.8,32.7 28.4,31.8 Z',
  holes:'2.6,28.8 8.6,30.4 18.3,32.1 45.1,32.4'};
function drawBelt(item,P){
  const S=BELT_D,c=item?colOf(item):'#3a2414',metal=item&&item.metal||'silver',[mL,mM,mD]=METAL_TONES[metal]||METAL_TONES.silver;
  const edge=mix(c,'#000',.45),st=mix(c,'#fff',.35),lay=leatherLayers(P+'s',item||{leather:'calf'},S.strap,{x:38,y:22,r:30,rot:0,g:.25}),back=leatherLayers(P+'k',item||{leather:'calf'},S.back,{x:45,y:8,r:26,rot:0,g:.2});
  const stitch=d=>`<path d="${d}" fill="none" stroke="${st}" stroke-opacity=".7" stroke-width=".32" stroke-dasharray=".8 .55"/>`;
  const holes=S.holes.split(' ').map((p,k)=>{const [x,y]=p.split(',');return `<ellipse cx="${x}" cy="${y}" rx="${k===3?.8:.7}" ry="${k===3?1.1:1}" fill="${mix(c,'#000',.75)}" stroke="${mix(c,'#fff',.2)}" stroke-width=".15"/>`}).join('');
  return `<defs>${back.defs}${lay.defs}<linearGradient id="${P}sv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>`+
    `<clipPath id="${P}sc"><path d="${S.strap}"/></clipPath><linearGradient id="${P}mt" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${mL}"/><stop offset=".55" stop-color="${mM}"/><stop offset="1" stop-color="${mD}"/></linearGradient></defs>`+
    // the coil behind: its outer face, the inner face at the top (darker), its stitching
    back.body+`<path d="${S.inner}" fill="${mix(c,'#000',.4)}" stroke="${edge}" stroke-width=".3"/>`+stitch(S.bstitch)+
    // the strap; its stitching and holes; the keeper
    lay.body+`<path d="${S.strap}" fill="url(#${P}sv)"/>`+`<g clip-path="url(#${P}sc)">`+stitch(S.tstitch)+stitch(S.lstitch)+'</g>'+holes+
    `<path d="${S.keeper}" fill="${mix(c,'#000',.08)}" stroke="${edge}" stroke-width=".4"/><path d="${S.keeper}" fill="url(#${P}sv)"/>`+stitch(S.kstitch)+stitch(S.kstitch2)+
    // the buckle's frame (top, bottom and the wide left bar: a U, its right bar hidden under the strap's tail) and its prong over the strap
    `<path d="${S.frame}" fill="url(#${P}mt)" fill-rule="evenodd" stroke="${mD}" stroke-width=".3"/>`+
    `<path d="${S.prong}" fill="url(#${P}mt)" stroke="${mD}" stroke-width=".25"/>`;
}

/* small colour swatch for the item list: the precision swatch cut from the fabric close-up when the item has one (the cloth as it
   really is, white-balanced), else drawn from the tagged colours and pattern (like the mannequin), never cropped from the item photo,
   which the room's light tints */
let swN=0;
/* drawn: Today's pieces list, vest row and outfit chips show the drawn swatch (the pattern and weave readings) even for an item with
   a close-up. Every drawn swatch is scaled to read at this size ('dot' in fabricDef): two repeats of a stripe or windowpane, three
   motif cells, two and a half weave repeats with their contrast raised. */
function swatchSVG(i,drawn){
  const P='sw'+(swN++)+'-';let body;
  if(!drawn&&FABRIC.includes(i.type)&&i.swatch&&i.swSrc==='tex'&&i.texture&&TEXTURE_TYPES.includes(i.type))body=`<image href="${i.swatch}" width="16" height="16" preserveAspectRatio="xMidYMid slice"/>`;
  else if(FABRIC.includes(i.type)){const role=i.type==='tie'?'tie':i.type==='shirt'?'shirt':i.type==='pants'?'bot':'top';
    body=`<defs>${fabricDef(P+'f',i,role,'dot')}<linearGradient id="${P}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient></defs><rect width="16" height="16" fill="url(#${P}f)"/><rect width="16" height="16" fill="url(#${P}g)"/>`}
  else{const metal=(i.type==='watch'&&watchOpts(i).band!=='leather')||i.type==='cufflinks'||i.type==='tieclip';
    const [mL,mM,mD]=METAL_TONES[i.metal]||METAL_TONES.silver,c=metal?mM:colOf(i);
    body=`<defs><linearGradient id="${P}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${metal?.45:.15}"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs><rect width="16" height="16" fill="${c}"/><rect width="16" height="16" fill="url(#${P}g)"/>`}
  return `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

/* what tells chinos and jeans from dress trousers on the fabric square (box 10..90): jeans a denim twill, gold double
   topstitching along a seam and a copper rivet; chinos a fine cotton twill and a slanted pocket's seam. Dress trousers: nothing */
function trouserMarks(i,P){const k=typeof trouserKind==='function'?trouserKind(i):'dress';if(k==='dress')return '';
  const tw=`<pattern id="${P}tw" patternUnits="userSpaceOnUse" width="${k==='jeans'?2.4:1.8}" height="${k==='jeans'?2.4:1.8}" patternTransform="rotate(-35)"><rect width="${k==='jeans'?1:.7}" height="${k==='jeans'?2.4:1.8}" fill="#fff" opacity="${k==='jeans'?.16:.08}"/></pattern>`;
  const twill=`<defs>${tw}</defs><rect x="10" y="10" width="80" height="80" fill="url(#${P}tw)"/>`;
  if(k==='jeans')return twill+`<path d="M62,10 C60,40 61,66 66,90" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.2"/>`+
    `<path d="M64.2,10 C62.2,40 63.2,66 68.2,90 M66.4,10 C64.4,40 65.4,66 70.4,90" fill="none" stroke="#d9a441" stroke-width=".7" stroke-dasharray="1.6 1"/>`+
    `<path d="M10,26 C24,24 40,25 58,30" fill="none" stroke="#d9a441" stroke-width=".7" stroke-dasharray="1.6 1"/><circle cx="58" cy="30" r="2.3" fill="#b87333" stroke="#6e4220" stroke-width=".6"/><circle cx="57.4" cy="29.4" r=".8" fill="#f1c48a"/>`;
  return twill+`<path d="M58,10 L72,40" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".9"/><path d="M60,10 L74,40" fill="none" stroke="#000" stroke-opacity=".18" stroke-width=".4" stroke-dasharray="1.2 .8"/>`}
/* a suit, as worn in Brooks Brothers' product photo of their navy stripe suit (2026-11-13, the owner's pick and his ask: "trace his arms
   pose, his legs, everything"): the outline of jacket and trousers from the photo's pixels (the gaps between arms and body left
   open), his left arm hanging, his right arm bent with the hand in the trouser pocket, the jacket's right front pushed back; the
   lapels, notches, front edges, hems, sleeve seam, cuff, pockets and buttons placed on zoomed crops and checked on the photo; the
   shirt, tie and pocket square in the V. His head and hands are left out. Box 0..100, the trousers end where the photo does. */
const SUIT_D={out:'M28.3,74.9 L28.1,74.6 L27.2,74.5 L26.3,74.6 L25,75 L22.7,75.4 L22.2,75.1 L21.7,75.1 L21.6,75 L21.6,73.4 L21.6,70.8 L21.3,66 L21.2,61 L20.9,57 L20.9,53.5 L21.1,49.3 L20.9,45.4 L21.1,44 L21.5,42.4 L22.3,40 L22.5,37.3 L22.7,35.3 L22.5,32.9 L22.7,30.1 L23.5,25.3 L24.1,20.8 L25.2,16.6 L25.7,13.5 L26,12.6 L26.5,12.1 L27.2,11.9 L28.5,11.2 L31.5,9.9 L37.7,6.8 L38.5,6.3 L40,5.3 L41.9,3 L41.9,3 L42,3.2 L41.5,5.1 L41.8,7 L43.1,11.9 L43.3,13.3 L44.4,18.1 L45.7,22.7 L46.8,26.1 L47.1,25.2 L47,24.3 L47.2,23.7 L47.1,21.8 L47.3,20.2 L47.2,19.8 L47.3,18.5 L47.2,17.9 L47.4,17.5 L47.4,16.4 L47.6,15.8 L47.8,14.1 L48,13.9 L48.1,13.3 L48.8,12.3 L48.9,11.9 L48.7,11.5 L48.1,11.1 L47.9,11.2 L48,12 L47.3,11.9 L47,11.6 L46.9,10.8 L45.3,10.5 L46.8,9.4 L48.5,8.4 L48.9,8.3 L49.4,8.5 L49.8,8.4 L49.9,8.3 L49.9,8.2 L49.2,8.1 L49,7.9 L49.1,7.8 L49.8,7.2 L50.9,7.1 L51.5,6.8 L50.2,8.1 L51,8.2 L51.3,8.3 L51.3,8.5 L52,8.7 L55.1,10.9 L55,11.1 L54.7,11 L54,10.5 L53.2,10.5 L51.8,9.9 L51.2,10.2 L50.6,11.1 L50.5,11.5 L50.6,11.7 L50.5,12 L50.8,12.1 L52,13.8 L52.1,14.5 L52.5,14.9 L52.6,15.3 L52.5,15.7 L52.9,16.3 L53,17.1 L52.6,17 L52.5,17.3 L52.6,17.5 L53,17.4 L53.1,17.6 L53.2,18.8 L53.2,19.3 L53.3,19.9 L53.3,20.7 L53.5,21.4 L53.4,22.2 L53.6,22.7 L53.6,23.8 L53.8,24.5 L53.9,27.6 L54.2,28.7 L54.2,30.1 L54.3,30.4 L54.4,30.3 L54.7,29.1 L55.6,23.7 L55.9,21.5 L55.8,20.3 L56.1,17.1 L56.1,11.6 L56,11.3 L55.6,11.2 L55.8,11 L55.9,10.4 L55.8,9.7 L55.9,5.9 L55.4,3 L55.5,3.1 L56.4,4.1 L57,4.7 L59.2,5.8 L68.6,9.5 L70.2,10.3 L70.9,11.4 L72.4,14.1 L73.7,17.5 L77.4,34.4 L78.3,36.5 L78.5,37.4 L78.5,38.1 L79.1,39.2 L79.1,40 L78.9,40.8 L79,41.8 L78.7,42.8 L78.2,46.1 L77.9,47.6 L77.7,49.8 L77.4,50.7 L77,51.4 L76.8,53 L76.5,54 L75.4,56.5 L74.1,60.6 L73.6,63.6 L73.2,67.5 L71.9,69.6 L70.7,70.9 L69.8,71.7 L69.6,72.1 L69.4,75.9 L69.9,77.7 L69.7,79.3 L70.1,80.6 L70.3,82.7 L70.6,84.1 L71.2,90.5 L71.1,96.6 L71,96.8 L70.9,96.9 L55.5,96.9 L55.5,96 L54.7,93.7 L53.5,90.7 L49.6,81.3 L48.6,77.5 L48.1,76.8 L47.9,76.6 L47.8,76.9 L48.3,78.7 L48.3,79.6 L47.9,80.6 L46.6,83.3 L46.1,85.8 L46,87.4 L45.6,89.3 L45.6,90.3 L45.3,92 L45.3,94.5 L44.9,95.9 L44.7,96.9 L30.8,97 L30.6,90.9 L30.2,83.4 L29.8,76 Z M67.2,32.6 L67.7,33.4 L68.1,35.2 L68.7,36.6 L68.6,38 L68.6,40.6 L69,41.3 L69.6,42.5 L69.3,44.5 L69.1,44.5 L69,44.6 L69,45.1 L69.2,45.5 L69.3,48 L68.8,50.7 L68.4,51.7 L68.2,51.7 L68,51.2 L67.5,51 L66.9,50.5 L65.9,49.2 L65.7,48.8 L65.6,47.7 L65.6,45.1 L65.8,42.6 L66,37.3 L66.6,34.3 L67.1,32.7 Z M53.5,16.3 L55.9,16.2 L56,16.4 L55.7,20.3 L55.8,21.5 L54.9,27.4 L54.8,27.4 L54.8,27.3 L54.7,26.7 L55,26 L55.1,23.7 L55,23.4 L54.8,23.4 L54.6,24.2 L54.3,24.3 L54.1,24.2 L53.8,23.2 L53.8,21.7 L53.9,21.2 L53.7,20.6 L53.9,20.1 L53.6,19.1 L53.4,17.7 L53.5,16.3 Z',
  shirt:'M41.8,3.1 L43.1,11.7 L45,21.6 L47.3,32 L49.9,38.6 L51.6,43.9 L52.1,43.9 L53.7,35.5 L54.9,27.4 L55.4,16.1 L56,3.6 Z',
  knot:'M47.4,8.6 C47.4,8.6 52,8.6 52,8.6 C52,8.6 51.5,13.4 51.5,13.4 C51.5,13.4 47.9,13.4 47.9,13.4 C47.9,13.4 47.4,8.6 47.4,8.6 Z',
  blade:'M47.9,13.1 C47.9,13.1 51.5,13.1 51.5,13.1 C51.5,13.1 53.3,18.4 53.7,21.6 C54.1,24.7 54.2,28.8 54,32 C53.7,35.3 52.5,39.2 52.1,41.1 C51.7,43 51.6,43.5 51.6,43.5 C51.6,43.5 50.5,40.5 49.9,38.6 C49.3,36.7 48.5,34.9 48.1,32 C47.6,29.2 47.2,24.7 47.2,21.6 C47.2,18.4 47.9,13.1 47.9,13.1 Z',
  square:'M60.8,22.9 L66.2,23.2 L65.9,23.9 L61,23.7 Z',
  cuff:'M22.9,74.8 L28.3,75 L28.2,76.1 L23.1,76 Z',
  llap:'M35.4,8.4 C35.8,9.1 36.7,10.8 37.5,12.5 C38.3,14.2 39.4,16.5 40.3,18.7 C41.2,20.9 41.9,23.3 42.8,25.5 C43.8,27.8 45.2,30.2 46.2,32.4 C47.3,34.6 48.2,36.6 49.1,38.6 C50.1,40.6 51.3,43.3 51.7,44.2',
  lnotch:'M34.6,7.5 C34.7,7.6 35,8.4 35.4,8.4 C35.9,8.5 36.9,7.9 37.2,7.9',
  rlap:'M65.2,9 C65,9.9 64.5,12.2 64.1,14.3 C63.6,16.5 63.2,19.1 62.6,21.8 C61.9,24.5 61.2,28.1 60.2,30.8 C59.2,33.5 57.9,35.9 56.8,38 C55.6,40.1 53.8,42.7 53.2,43.6',
  rnotch:'M66.4,8.1 C66.3,8.3 65.9,9.3 65.5,9.3 C65.1,9.4 64.1,8.7 63.8,8.6',
  frontl:'M52,45.4 C51.8,46.2 51.3,48.7 50.7,50.5 C50.2,52.3 49.2,54.4 48.8,56 C48.3,57.6 48.1,58.4 47.9,60.1 C47.8,61.8 47.7,64.2 47.6,66.2 C47.5,68.3 47.4,70.6 47.3,72.2 C47.2,73.9 47.1,75.6 47,76.3',
  heml:'M28.1,75 C28.4,75.1 28.7,75.3 29.7,75.5 C30.7,75.6 32.3,75.8 34.2,76 C36.1,76.2 39.3,76.5 40.9,76.7 C42.6,76.9 43.1,77.1 44.1,77.1 C45.1,77 46.5,76.6 47,76.5',
  frontr:'M52.9,46 C53.1,46.8 53.7,49.4 54.1,50.7 C54.5,52.1 54.9,52.7 55.5,53.9 C56.2,55.1 57.4,56.5 58,57.9 C58.7,59.3 59.3,60.7 59.6,62.3 C59.9,63.8 59.9,65.6 59.9,67.2 C59.9,68.9 59.6,71.1 59.6,71.9',
  hemr:'M59.6,71.9 C60.4,72 63,72.2 64.6,72.2 C66.2,72.3 68.5,72.1 69.2,72.1',
  sleevel:'M31.4,34.9 C31.4,36.4 31.1,41.6 31,44.2 C30.8,46.8 31,48.1 30.6,50.4 C30.3,52.8 29.3,55.7 28.9,58.3 C28.5,60.9 28.6,63.3 28.5,66 C28.3,68.7 28.1,73.3 28.1,74.8',
  cuffl:'M21.9,74.7 C23,74.8 27.1,75 28.1,75',
  elbow:'M69.2,39.5 C70,39.5 72.4,39.2 73.9,39.2 C75.4,39.3 77.5,39.7 78.3,39.9',
  vl:'M41.8,3.1 C42,4.6 42.6,8.6 43.1,11.7 C43.6,14.8 44.3,18.2 45,21.6 C45.7,24.9 46.5,29.2 47.3,32 C48.1,34.9 49.2,36.6 49.9,38.6 C50.7,40.6 51.3,43 51.6,43.9',
  vr:'M56,3.6 C55.9,5.7 55.6,12.1 55.4,16.1 C55.2,20 55.1,24.2 54.9,27.4 C54.6,30.6 54.1,32.7 53.7,35.5 C53.2,38.2 52.4,42.5 52.1,43.9',
  flapl:'M31.8,51.3 L38.5,52.7 L38,57.5 L29.5,55.8 Z',
  flapr:'M62.1,51.2 L67.7,52 L67.6,55.7 L61.8,54.9 Z',
  breast:'M60.3,23.2 L66.6,23.8 L66.4,24.7 L60.2,24 Z',
  trousers:'M19.7,97.7 L19.7,74.7 L28.1,75 L29.7,75.5 L34.2,76 L40.9,76.7 L44.1,77.1 L47,76.5 L47,76.3 L47.3,72.2 L47.6,66.2 L47.9,60.1 L48.8,56.7 L55.5,53.9 L58,57.9 L59.6,62.3 L59.9,67.2 L59.6,71.9 L64.6,72.2 L69.2,72.1 L79.5,72.1 L79.5,97.7 Z',
  buttons:'52,45.4 48.8,56.7'};
/* the suit's cloth at a suit's scale: the figure on Today draws a jacket about 125 pattern units across (200 units at FIG_SCALE 1.6),
   this drawing's jacket about 55; matched to the photo it was traced from, whose pinstripes are 36 px apart (2.2 units, about 26
   across the suit; the pinstripe tile is 8 units), the tile is drawn at 0.28 (at the square's own scale a pinstripe was 8 stripes across
   the whole suit and the weave's diagonals looked like a print: the owner, 2026-11-13) */
const SUIT_FAB=.28;
function suitFabric(id,i){const p=fabricDef(id,i,'top'),m=p.match(/ patternTransform="([^"]*)"/),tf=m?m[1]:'';
  return (m?p.replace(m[0],''):p).replace('patternUnits="userSpaceOnUse"',`patternUnits="userSpaceOnUse" patternTransform="scale(${SUIT_FAB})${tf?' '+tf:''}"`)}
function suitMarks(i,P){const S=SUIT_D,c=colOf(i),e=mix(c,'#000',.42),hi=mix(c,'#fff',.2);
  const ln=(d,w=.42,o=1)=>`<path d="${d}" fill="none" stroke="${e}" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
  return `<path d="${S.trousers}" fill="#000" opacity=".12" clip-path="url(#${P}so)"/>`+
    `<path d="${S.shirt}" fill="#dfe6ee" stroke="${e}" stroke-width=".35"/><path d="${S.blade}" fill="${mix(c,'#000',.5)}"/><path d="${S.knot}" fill="${mix(c,'#000',.45)}"/>`+
    `<path d="${S.blade}" fill="none" stroke="${mix(c,'#000',.7)}" stroke-width=".25"/><path d="${S.square}" fill="#f7f6f2"/><path d="${S.cuff}" fill="#dfe6ee"/>`+
    ln(S.llap,.45)+ln(S.rlap,.45)+ln(S.lnotch)+ln(S.rnotch)+ln(S.vl,.35)+ln(S.vr,.35)+ln(S.frontl,.5)+ln(S.frontr,.5)+ln(S.heml,.5)+ln(S.hemr,.5)+ln(S.sleevel,.45,.8)+ln(S.cuffl,.4)+ln(S.elbow,.35,.7)+
    ln(S.flapl,.4)+ln(S.flapr,.4)+ln(S.breast,.35)+
    S.buttons.split(' ').map(p=>{const [x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r=".6" fill="${mix(c,'#000',.6)}" stroke="${hi}" stroke-width=".12"/>`}).join('')}
/* blazer, front view with the model: traced from Brooks Brothers' photo of their classic-fit wool hopsack sport coat
   (MM01244, 2026-11-13, the owner's pick), as photographed (his left hand in his trouser pocket): the outlines of the coat, head,
   hair, hands and trousers taken from the photo's pixels (colour classes, traced and simplified); lapels, collar, pockets,
   seams, buttons, the polo's stripes and the face's features placed on zoomed crops and snapped to the picture's edges.
   Box: X=(x-835)*.052+50, Y=(y-40)*.052 in the 1648x2000 photo. The cloth fills the coat; skin, hair, polo and trousers keep their tones. */
const BLAZER_D={pants:'M67.6,76.9 C67.3,77.3 65.9,77.9 65.9,79.4 C65.8,80.9 67.2,84.9 67.2,86.1 C67.2,87.3 66.4,86.4 65.9,86.4 C65.4,86.3 64.6,85.8 64.4,85.8 C64.1,85.9 64.3,86.6 64.1,86.6 C64,86.7 63.5,86.2 63.4,86.1 C63.2,86.1 63.1,86.2 63.1,86.4 C63,86.7 63,87.4 63.2,87.6 C63.3,87.9 63.8,87.7 64,87.8 C64.1,87.9 64.2,87.3 64.1,88.2 C64.1,89.1 64,92.3 63.9,93.2 C63.8,94.2 63.6,92.7 63.6,93.9 C63.7,95.2 64.1,99.5 64.2,100.8 C64.3,102.1 66.5,101.6 64,101.7 C61.4,101.9 51.6,102.1 49,101.7 C46.3,101.3 48.5,100.3 48.1,99.5 C47.7,98.7 47,97.2 46.7,96.9 C46.3,96.6 46.2,97.5 46.1,97.8 C46,98.1 46.1,98.4 46,98.7 C45.9,99 45.6,99 45.3,99.5 C45,100 46.8,101.3 44.3,101.7 C41.7,102.1 32.4,101.8 30,101.7 C27.6,101.6 29.9,101.4 30,101.2 C30,101.1 30.4,101 30.4,100.8 C30.5,100.5 30.3,100 30.3,99.7 C30.3,99.4 30.6,99.2 30.6,98.9 C30.6,98.6 30.5,98.2 30.4,98 C30.4,97.8 30.3,97.7 30.2,97.7 C30.1,97.7 29.8,97.8 29.7,97.7 C29.6,97.6 29.7,97.3 29.5,96.9 C29.2,96.5 28.6,96 28.3,95.4 C27.9,94.7 27.6,93.7 27.4,93 C27.2,92.2 27.2,91.6 27,90.9 C26.9,90.3 26.4,90.5 26.3,89.2 C26.2,87.9 26.8,84.4 26.5,83.3 C26.2,82.1 24.7,82.9 24.4,82.5 C24.1,82.1 24.7,81.3 24.7,80.9 C24.7,80.5 24.3,80.2 24.3,80.1 C24.3,80 24.7,80.5 24.8,80.1 C24.9,79.7 25,78.2 25.1,77.8 Z',
  coat:'M55.6,23.9 L56.9,25.1 L57.8,26.4 L58.9,27.4 L61.7,29.2 L63.4,29.8 L67.4,32.1 L68.4,32.5 L69.4,33.5 L70.5,35.7 L71.9,39.6 L73.1,43.9 L74.8,51.7 L75.6,58.9 L75.6,61.7 L75.2,64.3 L74.3,66.4 L73,68.3 L71.3,71.5 L68,75.9 L65.9,79.1 L65.8,79.8 L66.2,81.2 L67.2,86.1 L67,86.2 L66,86.2 L64.6,85.8 L64,84.6 L63.2,83.8 L62.8,83.8 L62.2,84.3 L61.4,84 L60.5,83.1 L56.9,80.3 L56.5,80.5 L56.3,81.3 L55.9,84 L55.7,84.3 L55.2,84.3 L52.4,83.5 L51.2,83 L49,81.3 L48,80.7 L47.1,79.7 L44.1,79.7 L43.1,79.5 L42.9,79.7 L42.4,82.3 L41.5,85.3 L40.2,88.4 L39.3,89.4 L38.4,89.9 L37.5,90.1 L35.6,89.6 L33.4,88.5 L32.1,87.7 L31.8,87.2 L31.7,84.8 L31.5,83.4 L31.3,83 L30.6,82.8 L25.2,82.8 L24.8,82.7 L24.6,82.4 L24.9,79.5 L25.5,76.5 L25.7,72.6 L26,70.9 L26.1,69.2 L26.3,68.3 L26.5,64.7 L26.8,64.1 L26.8,61.8 L27.4,58.7 L27.4,57.1 L27.7,56.3 L28,52.7 L28.4,50.5 L28.9,46.2 L29.3,45 L29.9,38 L31.2,32.5 L32.2,31.5 L35,30.4 L39.7,28.2 L41.6,27.5 L42.8,26.3 L43.2,26.7 L43.7,32 L44.8,33.9 L43.8,34.1 L43.3,35.6 L44,40.8 L44,41.3 L43.7,41.5 L43.8,42.1 L43.6,43 L43.7,43.8 L43.4,44.3 L43.5,44.7 L43.2,45.7 L43.4,46.3 L43.4,49 L43.3,51.1 L43.5,51.8 L43.8,51.9 L44,50.9 L44,48 L44.2,46.3 L44,45.2 L44.4,44.5 L44.3,43.8 L44.6,43.4 L44.7,41.8 L44.6,41.2 L44.8,40.5 L44.8,39.8 L44.5,39.3 L44.6,38.7 L44.2,37.6 L44,34.8 L44.2,34.4 L44.8,34.5 L45,37.7 L45.6,39.1 L45.9,38.9 L45.3,37.6 L45.3,36.5 L45.1,35.9 L45.1,34.4 L45.3,34.4 L46.1,35.6 L46.6,37.3 L47.1,37.4 L45.8,39.6 L45.9,39.8 L46.1,39.8 L47.6,37.2 L47.8,36.6 L48.7,35.4 L49.5,33.8 L50.3,33.5 L51,33.5 L50.8,33.2 L52,32.1 L55.2,26.7 L55.5,25.8 L55.6,23.9 Z M64.4,52.8 L64.7,53.1 L64.9,54.9 L65.1,55 L65.7,58.3 L66.4,61 L65.9,63.6 L66,64.6 L64,67.1 L63.8,67 L63.7,65.6 L63.4,64.2 L63.1,59 L64,56.2 L64.1,53.4 L64.4,52.9 Z',
  polo:'M45.2,23.4 C44.1,23.7 43.8,24.2 43.3,25 C42.9,25.7 42.8,26.9 42.6,28 C42.4,29.1 42.1,30.4 42,31.5 C41.8,32.7 41.7,33.8 41.7,35 C41.6,36.2 41.5,37.6 41.5,38.9 C41.5,40.2 41.5,41.4 41.6,42.7 C41.7,44 41.9,45.2 42.2,46.6 C42.5,48.1 43,50.1 43.4,51.4 C43.9,52.6 44.5,54 45.1,54 C45.7,54 46.4,52.8 47.1,51.4 C47.7,50 48.5,47.6 49.2,45.7 C49.9,43.8 50.8,41.7 51.5,39.8 C52.2,37.9 53,36 53.6,34.4 C54.2,32.8 54.6,31.6 55,30.3 C55.4,29.1 55.9,28 55.7,26.9 C55.6,25.8 55.3,24.7 54.3,24 C53.4,23.3 51.2,23 49.7,22.9 C48.2,22.8 46.2,23 45.2,23.4 Z M43.7,73.9 C43.7,73.9 45.2,73.9 45.2,73.9 C45.2,73.9 45.4,75.3 45.5,76 C45.6,76.7 45.8,77.4 45.9,78.1 C46,78.7 46.4,79.8 46.4,79.8 C46.4,79.8 43.1,79.8 43.1,79.8 C43.1,79.8 43.7,73.9 43.7,73.9 Z',
  stripes:'M45.2,39.8 L47.8,33.9 M47.5,40.3 L50.9,34.4 M46.9,49.6 L51.3,34.2 M43.6,51.8 L44,34.7 M42,34.8 L42,43.8 M45.2,53.8 L46.6,39.9',
  ptrim:'M41.6,34.2 C42.2,34.1 44.6,33.9 45.2,33.8 M51.6,33.4 C52,33.5 53.4,34 53.8,34.1',
  pline:'M44.1,24.2 C44.1,25.1 44.1,27.8 44.2,29.2 C44.2,30.6 44.3,31.6 44.5,32.4 C44.7,33.1 45.2,33.5 45.3,33.7 M55.3,23.5 C55.1,24.2 54.5,26.5 54.1,27.8 C53.6,29.1 53.1,30 52.6,31 C52.2,31.9 51.4,32.9 51.2,33.3 M44.7,34.1 C44.9,35 45.8,39.6 45.8,39.6 C45.8,39.6 47.5,40.1 47.5,40.1 C47.5,40.1 50.4,34.6 50.9,33.4',
  head:'M50.6,2.2 C50.7,2.2 51.1,2 51.5,2.2 C52,2.4 52.6,2.9 53.2,3.2 C53.8,3.6 54.6,4.1 55.1,4.5 C55.6,5 56.1,5.5 56.5,6 C56.8,6.5 57.1,7.1 57.2,7.5 C57.4,8 57.5,8.3 57.5,8.6 C57.5,8.9 57.1,8.9 57.1,9.2 C57.1,9.5 57.5,9.7 57.5,10.4 C57.5,11.1 57.1,13 57.2,13.6 C57.3,14.2 57.9,13.8 58,14 C58.2,14.2 58.2,14.5 58.1,15 C58,15.6 57.7,16.7 57.6,17.2 C57.4,17.7 57.3,17.9 57,18.3 C56.8,18.6 56.1,19 55.9,19.6 C55.7,20.1 56,21 55.9,21.5 C55.7,22.1 55.3,22.5 55.2,22.8 C55.1,23.1 55.5,22.5 55.3,23.5 C55.1,24.4 54.9,26.7 54.2,28.3 C53.5,30 52,32.2 51.2,33.3 C50.4,34.3 49.9,33.9 49.2,34.6 C48.5,35.2 47.5,37.4 46.8,37.2 C46.2,37.1 45.7,34.4 45.3,33.7 C44.9,33 44.5,33.7 44.3,33 C44.1,32.4 44.1,31.5 44.1,29.7 C44,28 44.1,23.9 44,22.3 C43.9,20.6 43.8,20.4 43.6,19.9 C43.4,19.5 43,19.8 42.7,19.5 C42.4,19.3 42.1,19.2 41.8,18.7 C41.5,18.2 41.1,17.2 40.9,16.5 C40.7,15.9 40.7,15.2 40.8,14.8 C40.8,14.4 41.3,14.5 41.3,14.1 C41.4,13.8 40.9,13.6 40.8,12.6 C40.8,11.6 40.9,9.1 41,8.2 C41.1,7.3 41.1,7.7 41.3,7.4 C41.5,7 41.9,6.5 42.2,6.1 C42.5,5.7 42.8,5.5 43.1,5.2 C43.5,5 43.8,4.9 44.2,4.6 C44.6,4.3 45,3.6 45.5,3.3 C45.9,3 46,2.9 46.8,2.7 C47.7,2.5 49.9,2.3 50.5,2.2 C51.1,2.1 50.4,2.1 50.6,2.2 Z',
  hair:'M50.6,2.2 C50.7,2.2 51.1,2.1 51.3,2.2 C51.5,2.2 51.4,2.1 52,2.5 C52.7,2.9 54.4,4 55.1,4.5 C55.8,5.1 56,5.4 56.4,5.9 C56.7,6.4 57,6.9 57.2,7.4 C57.3,7.8 57.5,8.3 57.5,8.6 C57.5,8.9 57.1,8.9 57.1,9.2 C57.1,9.5 57.5,9.7 57.5,10.4 C57.5,11.1 57.5,12.4 57.3,13.2 C57.1,13.9 56.6,14.9 56.4,15 C56.1,15.1 56,14.4 55.9,13.7 C55.7,13.1 55.8,11.7 55.7,11 C55.6,10.3 55.4,10.1 55.2,9.7 C55,9.3 54.8,8.9 54.4,8.7 C54,8.5 53.5,8.3 52.9,8.3 C52.3,8.2 51.4,8.3 50.8,8.4 C50.2,8.5 50,8.7 49.2,8.8 C48.5,8.9 47.2,8.7 46.3,8.8 C45.4,8.8 44.5,9 44,9.1 C43.6,9.3 43.7,9.4 43.6,9.9 C43.6,10.4 43.7,11.4 43.6,12.2 C43.6,13.1 43.4,14.5 43.1,14.9 C42.9,15.4 42.5,15.1 42.2,15 C41.9,14.9 41.6,14.6 41.4,14.2 C41.2,13.8 40.9,13.6 40.8,12.6 C40.8,11.7 40.9,9.5 41,8.6 C41,7.8 41,8 41.2,7.6 C41.4,7.2 41.8,6.6 42.1,6.2 C42.4,5.8 42.8,5.5 43.1,5.2 C43.5,4.9 43.9,4.9 44.2,4.6 C44.5,4.3 44.8,3.9 45.1,3.6 C45.4,3.4 45.6,3.2 46,3 C46.4,2.9 46.6,2.8 47.3,2.6 C48.1,2.5 50,2.2 50.5,2.2 C51.1,2.1 50.4,2.2 50.6,2.2 Z',
  neckShade:'M44.8,23.7 L46.1,24.9 L48.2,25.7 L50.5,26 L52.6,25.4 L54.2,24.4 L55.4,23.4 L56,39 L43.5,39 Z',
  brows:'M44.5,14.9 C44.7,14.8 45.2,14.6 45.5,14.5 C45.8,14.5 46.1,14.4 46.4,14.4 C46.8,14.4 47.1,14.5 47.3,14.5 C47.6,14.6 48.1,14.7 48.2,14.8 M51.4,14.8 C51.6,14.7 52,14.5 52.3,14.5 C52.5,14.4 52.9,14.4 53.2,14.4 C53.5,14.4 53.8,14.5 54.1,14.6 C54.4,14.7 54.9,15 55,15.1',
  eyes:'M45.4,15.7 C45.4,15.6 45.6,15.5 45.8,15.4 C45.9,15.4 46.3,15.3 46.5,15.3 C46.7,15.3 47,15.4 47.2,15.5 C47.3,15.5 47.5,15.7 47.4,15.8 C47.4,15.9 47.2,16 47,16 C46.8,16.1 46.5,16.1 46.3,16.1 C46.1,16.1 45.8,16 45.7,16 C45.5,15.9 45.3,15.8 45.4,15.7 Z M52,15.6 C52,15.5 52.1,15.4 52.3,15.3 C52.4,15.2 52.7,15.2 52.9,15.2 C53.2,15.2 53.5,15.2 53.7,15.3 C53.9,15.3 54.2,15.5 54.2,15.5 C54.2,15.6 54,15.7 53.8,15.8 C53.6,15.9 53.2,15.9 53,15.9 C52.7,15.9 52.4,15.8 52.3,15.8 C52.1,15.7 52,15.7 52,15.6 Z',
  irises:'46.8,15.7 52.7,15.4',
  nose:'M49,17 C49,17.1 48.9,17.8 48.9,18.1 C48.9,18.5 48.8,18.9 48.8,19.1 M48.8,19.3 C48.9,19.4 49,19.6 49.2,19.7 C49.4,19.8 49.6,19.9 49.8,20 C50,20 50.3,20 50.5,20 C50.8,20 51,20 51.3,19.9 C51.5,19.8 51.7,19.8 51.9,19.7 C52,19.5 52.2,19.3 52.2,19.2',
  nostrils:'49.5,19.8 51.4,19.7',
  lips:'M48.1,22 C48.2,21.9 48.6,21.8 48.9,21.7 C49.2,21.7 49.6,21.6 49.9,21.6 C50.2,21.6 50.3,21.6 50.6,21.6 C50.8,21.6 51.1,21.6 51.4,21.7 C51.6,21.7 52,21.7 52.3,21.8 C52.5,21.8 52.8,21.9 52.9,22 C52.9,22.1 52.9,22.2 52.7,22.4 C52.5,22.5 52.1,22.7 51.7,22.8 C51.3,22.9 50.8,23 50.4,23 C49.9,23 49.4,22.9 49.1,22.8 C48.7,22.7 48.3,22.5 48.2,22.4 C48,22.3 47.9,22.1 48.1,22 Z',
  lipline:'M47.6,22.1 C47.8,22.1 48.4,22.2 48.8,22.3 C49.3,22.3 49.8,22.4 50.3,22.4 C50.8,22.4 51.3,22.3 51.8,22.3 C52.2,22.2 52.9,22 53.1,22',
  jaw:'M44.8,23.7 C45.1,23.8 45.7,24.4 46.3,24.8 C46.9,25.1 47.6,25.4 48.3,25.6 C48.9,25.7 49.7,25.8 50.5,25.8 C51.2,25.7 51.9,25.6 52.5,25.3 C53.1,25.1 53.6,24.8 54.1,24.4 C54.6,24.1 55.1,23.6 55.4,23.4',
  ears:'M41.8,15.1 C41.8,15.4 41.7,16.2 41.8,16.7 C41.9,17.3 42.1,17.8 42.3,18.2 C42.5,18.7 43,19.2 43.1,19.3 M57.7,14.8 C57.7,15.1 57.7,16.1 57.6,16.7 C57.5,17.2 57.3,17.8 57.2,18.2 C56.9,18.6 56.6,18.9 56.4,19.1',
  hands:'M29.8,82.9 C29.9,82.9 30.1,82.9 30.3,82.9 C30.5,83 30.7,83.1 30.9,83.2 C31,83.3 31,83.4 31.1,83.5 C31.2,83.7 31.2,83.7 31.3,84.1 C31.4,84.6 31.5,85.4 31.5,86.1 C31.5,86.8 31.3,87.8 31.3,88.4 C31.3,89 31.4,89.3 31.5,89.6 C31.6,90 31.7,90.2 31.8,90.6 C31.9,91 31.8,91.5 31.8,91.9 C31.8,92.3 31.7,92.6 31.6,92.8 C31.4,93 31.3,93 31.1,93.1 C31,93.1 30.8,93.1 30.7,93.1 C30.5,93 30.5,93 30.4,92.9 C30.2,92.8 30.1,92.7 30,92.4 C29.9,92 30,91.5 30,90.8 C29.9,90.2 29.9,89.2 29.7,88.7 C29.6,88.1 29.2,87.7 29,87.5 C28.9,87.3 28.8,87.3 28.8,87.5 C28.8,87.7 28.9,88.2 29,88.5 C29,88.8 28.9,89.1 28.8,89.3 C28.8,89.5 28.6,89.6 28.6,89.8 C28.6,90 28.8,89.9 28.9,90.2 C28.9,90.5 28.7,91.2 28.8,91.6 C28.8,92 29.1,92.2 29.2,92.6 C29.2,92.9 29.1,93.2 29.2,93.5 C29.2,93.9 29.6,94.2 29.7,94.5 C29.8,94.8 29.7,95 29.8,95.2 C29.9,95.4 30.1,95.4 30.3,95.6 C30.4,95.9 30.6,96.5 30.7,96.7 C30.7,96.9 30.7,96.9 30.6,97 C30.5,97 30.2,97 30.2,97.1 C30.1,97.2 30.3,97.4 30.3,97.5 C30.3,97.6 30.2,97.6 30.2,97.6 C30.1,97.6 30,97.6 29.9,97.4 C29.8,97.3 29.6,97 29.5,96.8 C29.5,96.7 29.7,96.7 29.6,96.4 C29.5,96.2 29,95.8 28.7,95.4 C28.5,95 28.2,94.4 28,93.9 C27.8,93.4 27.8,93 27.5,92.2 C27.3,91.5 26.7,90.3 26.5,89.5 C26.3,88.8 26.5,87.9 26.5,87.5 C26.6,87.1 26.7,87.2 26.7,87 C26.7,86.9 26.6,86.8 26.5,86.6 C26.5,86.3 26.5,85.8 26.6,85.6 C26.7,85.4 26.8,85.3 26.9,85.2 C27,85.1 27.2,85.1 27.3,85 C27.4,84.9 27.3,84.8 27.4,84.5 C27.5,84.2 27.6,83.7 28,83.4 C28.3,83.2 29.4,83 29.7,82.9 C30,82.8 29.7,82.9 29.8,82.9 Z M56.7,81.3 C56.8,81.3 56.9,81.2 57.1,81.4 C57.3,81.5 57.8,81.9 58,82 C58.1,82.2 58.1,82.2 58.1,82.3 C58,82.4 58,82.5 57.9,82.5 C57.8,82.6 57.5,82.7 57.3,82.7 C57.1,82.8 56.7,82.7 56.6,82.7 C56.4,82.7 56.3,82.7 56.3,82.6 C56.3,82.4 56.4,82 56.4,81.7 C56.5,81.5 56.6,81.4 56.7,81.3 C56.7,81.2 56.6,81.3 56.7,81.3 Z',
  fingers:'M29.6,88.9 C29.6,89.2 29.7,90.3 29.7,90.8 C29.9,91.3 30,91.8 30.1,92.1 C30.3,92.5 30.5,92.8 30.6,93 M29.4,92 C29.4,92.5 29.7,93.7 29.9,94.5 C30.1,95.3 30.3,96.4 30.4,96.7',
  nail:'31.1,92.2',
  lapels:'M60.6,30.6 C60.6,31.1 60.8,32.7 60.7,33.6 C60.5,34.4 60.1,35.1 59.8,35.9 C59.3,36.7 58.8,37.3 58.3,38.1 C57.8,38.9 57.4,39.9 56.9,40.8 C56.4,41.7 55.8,42.7 55.3,43.6 C54.8,44.5 54.4,45.3 54,46 C53.5,46.8 53.2,47.4 52.7,48.1 C52.1,48.9 51.4,49.7 50.7,50.6 C49.9,51.5 49,52.5 48.2,53.6 C47.4,54.6 46.2,56.1 45.8,56.7 M38.8,29.2 C38.7,29.6 38.1,30.7 37.9,31.6 C37.7,32.5 37.6,33.5 37.6,34.6 C37.5,35.8 37.5,37.1 37.6,38.4 C37.7,39.7 37.8,41 38,42.2 C38.2,43.4 38.5,44.7 38.8,45.9 C39.2,47.1 39.7,48.3 40.1,49.4 C40.6,50.5 41,51.5 41.5,52.4 C41.9,53.3 42.4,54.1 42.9,54.8 C43.4,55.4 44.5,56.2 44.8,56.5 M56.3,28.1 C56.7,28.3 57.8,28.9 58.6,29.2 C59.3,29.5 60.3,29.9 60.7,30 M43.4,25.5 C43.1,25.8 42.1,26.9 41.5,27.6 C40.8,28.3 39.7,29.3 39.3,29.6',
  notches:'M58.9,31.1 C59.2,31 60.3,30.7 60.6,30.6 M38.8,29.1 C39.2,29 40.8,28.5 41.2,28.4',
  fronts:'M44.6,56.7 C44.6,57.1 44.3,58.5 44.1,59.5 C44,60.6 43.9,61.8 43.8,63.1 C43.8,64.3 43.8,65.8 43.8,67.2 C43.8,68.6 43.9,70.2 43.9,71.6 C43.8,73.1 43.7,74.5 43.6,75.8 C43.4,77.1 43.1,79 43,79.6 M45,56.7 C45,57.3 45.2,59.3 45.2,60.7 C45.2,62.1 45.2,63.9 45.2,65.3 C45.1,66.7 45,68 45,69.2 C45,70.3 44.9,71.2 45,72.3 C45.2,73.4 45.5,74.6 46,75.6 C46.5,76.7 47.1,77.8 47.9,78.7 C48.6,79.6 50,80.7 50.4,81',
  seams:'M32.6,31.9 C32.5,32.8 32.1,35.6 32.2,37.8 C32.3,40.1 32.7,42.8 33,45.2 C33.4,47.7 33.9,50.4 34.1,52.7 C34.4,55 34.5,57.2 34.5,59.2 C34.5,61.2 34.3,63.1 34.1,64.6 C33.9,66.2 33.7,67.2 33.5,68.5 C33.3,69.8 33,70.8 32.8,72.3 C32.7,73.8 32.4,75.6 32.2,77.4 C32.1,79.1 31.9,81.8 31.8,82.7 M68.6,33.3 C68.4,33.9 67.8,35.4 67.3,36.8 C66.9,38.1 66.3,39.8 65.9,41.5 C65.4,43.2 65,45.5 64.7,47.1 C64.4,48.7 64.3,50.2 64.1,51.2 C63.9,52.2 63.7,52.8 63.6,53.1 M63.9,67.2 C63.6,67.7 62.5,69.1 61.9,69.9 C61.2,70.8 60.6,71.7 60.1,72.5 C59.6,73.3 59.2,74 58.8,74.9 C58.5,75.7 58.2,76.6 58.1,77.5 C58,78.5 57.9,80 57.9,80.5 M57.8,80.5 C58.3,80.8 59.7,81.8 60.6,82.4 C61.5,83 62.8,83.9 63.3,84.2 M63.7,80.1 C63.7,80.4 63.6,81.5 63.5,82.2 C63.5,82.8 63.4,83.9 63.4,84.2',
  pockets:'M55.4,43.7 C55.4,43.7 63.2,43.1 63.2,43.1 C63.2,43.1 62.7,45.6 62.7,45.6 C62.7,45.6 53.9,46.2 53.9,46.2 C53.9,46.2 55.4,43.7 55.4,43.7 Z M63.6,67.3 C62.8,67.5 60.6,68.1 59.1,68.5 C57.6,68.9 54.7,69.7 54.7,69.7 C54.7,69.7 55.5,70.8 55.8,71.3 C56.2,71.9 56.8,72.9 56.8,72.9 C56.8,72.9 57.8,72.8 58.3,72.8 C58.8,72.7 59.5,72.7 59.7,72.6 M33.7,67.5 C33.7,67.5 34.5,67.6 34.9,67.8 C35.3,67.9 36.1,68.4 36.1,68.4 C36.1,68.4 35.5,72.8 35.5,72.8 C35.5,72.8 33.7,71.3 33.7,71.3',
  holes:'M45.6,60.9 L47,61.4 M45.8,70.7 L47.6,70.8 M57.6,34.1 L58.9,35.4',
  buttons:'44.7,61.3 43.1,70.9',
  pantsLines:'M43,79.9 C43.1,80.8 43.2,83.4 43.3,85.2 C43.3,86.9 43.4,89.4 43.5,90.3 M43.2,92.9 C43.6,93.2 44.5,94 45.1,94.7 C45.6,95.4 46.2,96.1 46.6,96.8 C47,97.6 47.3,98.4 47.7,99.2 C47.9,100 48.3,101.3 48.4,101.7'};
/* the cloth at a coat's scale, as the suit's (SUIT_FAB .28 for its 55-unit jacket): this coat is about 51 units across, so .26 (at the
   square's own scale a windowpane was a few panes across the whole coat: the owner, 2026-11-13) */
const BLAZER_FAB=.26;
function blazerFabric(id,i){const p=fabricDef(id,i,'top'),m=p.match(/ patternTransform="([^"]*)"/),tf=m?m[1]:'';
  return (m?p.replace(m[0],''):p).replace('patternUnits="userSpaceOnUse"',`patternUnits="userSpaceOnUse" patternTransform="scale(${BLAZER_FAB})${tf?' '+tf:''}"`)}
function blazerMarks(i,P){const S=BLAZER_D,c=colOf(i),e=mix(c,'#000',.42),hi=mix(c,'#fff',.2),SK='#d49c80',SKD='#a5694f',HR='#2f241b',
    ln=(d,col,w,op)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${op?` stroke-opacity="${op}"`:''} stroke-linecap="round" stroke-linejoin="round"/>`,
    dots=(s,r,fill)=>s.split(' ').map(p=>{const [x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`}).join('');
  return `<defs>${blazerFabric(P+'f',i)}<linearGradient id="${P}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>`+
    `<path d="${S.pants}" fill="#d9cdb3" fill-rule="evenodd" stroke="#a89a7e" stroke-width=".35"/>`+ln(S.pantsLines,'#b0a184',.35,.8)+
    `<path d="${S.coat}" fill="url(#${P}f)" fill-rule="evenodd" stroke="${mix(c,'#000',.55)}" stroke-width=".45"/><path d="${S.coat}" fill="url(#${P}s)" fill-rule="evenodd"/>`+
    `<path d="${S.polo}" fill="#1d2634"/>`+ln(S.stripes,'#e6e1d6',.32,.9)+ln(S.pline,'#0e141d',.3)+ln(S.ptrim,'#e6e1d6',.3)+
    `<clipPath id="${P}h"><path d="${S.head}"/></clipPath><path d="${S.head}" fill="${SK}" stroke="${SKD}" stroke-width=".25"/><path d="${S.neckShade}" fill="${SKD}" fill-opacity=".28" clip-path="url(#${P}h)"/><path d="${S.head}" fill="url(#${P}s)" opacity=".7"/><path d="${S.hair}" fill="${HR}" stroke="${HR}" stroke-width=".3"/>`+
    ln(S.ears,SKD,.3,.8)+ln(S.jaw,SKD,.3,.55)+ln(S.brows,HR,.4)+`<path d="${S.eyes}" fill="#e9ddd3" stroke="#3a2a20" stroke-width=".24"/>`+dots(S.irises,.33,'#3a2a20')+
    ln(S.nose,SKD,.3,.85)+dots(S.nostrils,.2,'#7d4a37')+`<path d="${S.lips}" fill="#c27f72"/>`+ln(S.lipline,'#7e463c',.28)+
    `<path d="${S.hands}" fill="${SK}" stroke="${SKD}" stroke-width=".3"/>`+ln(S.fingers,SKD,.3)+dots(S.nail,.42,'#e8c3b0')+
    ln(S.lapels,e,.4)+ln(S.lapels,hi,.25,.45).replace('<path','<path transform="translate(.3 0)"')+ln(S.notches,mix(c,'#000',.6),.5)+ln(S.fronts,e,.4)+
    ln(S.seams,e,.38,.75)+ln(S.pockets,e,.38)+ln(S.holes,mix(c,'#000',.6),.35)+dots(S.buttons,.7,'#3b2f2a')+dots(S.buttons,.25,'#6b5a50')}
/* trousers, front view: traced from the product photo of grey office trousers the owner sent (2026-11-13): the outline snapped to
   the photo's edges (his hands and shoes left out; the space between his legs is open from just below the crotch to the hems, each leg's inner edge snapped to the photo), the waistband, belt loops, button
   tab and fly, the slant pockets, the creases and the knee fold placed on zoomed crops. Box 0..100,
   waist to hem. The cloth is drawn at PANTS_FAB: the trousers span waist to hem (about 42 in) where the suit drawing spans about
   34, so the same cloth is 0.22 here against the suit's 0.28. */
const PANTS_D={out:'M32.3,3.2 C32.3,3.2 39.5,3.2 43,3.1 C46.4,3.1 50,3.1 53,3.1 C56,3.1 61.1,3.1 61.1,3.1 C61.1,3.1 62.4,5.5 62.9,6.9 C63.4,8.3 63.9,9.8 64.1,11.5 C64.4,13.2 64.5,15 64.6,16.9 C64.8,18.7 64.7,20.5 64.9,22.5 C65,24.6 65.2,26.6 65.5,29.1 C65.8,31.5 66.3,34.5 66.7,37.3 C67.1,40.1 67.5,43.2 67.8,45.8 C68.1,48.4 68.2,50.5 68.1,52.7 C68,54.9 67.7,56.8 67.4,59.1 C67.1,61.5 66.6,64.2 66.1,66.9 C65.6,69.6 65,72.8 64.5,75.5 C63.9,78.3 63.4,80.9 62.9,83.2 C62.5,85.5 62.2,87.4 61.9,89.2 C61.6,91 61.1,94.1 61.1,94.1 C61.1,94.1 57.9,94.6 56.4,94.7 C54.9,94.8 53.4,94.9 52,95 C50.6,95.1 48,95.2 48,95.2 C48,95.2 48.5,93.5 48.8,92.5 C49.1,91.4 49.5,90.4 50,89.1 C50.5,87.8 51,86.3 51.4,84.7 C51.8,83 52.1,81.2 52.4,79.3 C52.7,77.5 53,75.5 53.2,73.7 C53.4,71.7 53.6,69.9 53.7,68 C53.9,66.1 53.9,64.2 54,62.3 C54,60.4 54,58.5 53.9,56.6 C53.9,54.7 53.8,52.9 53.6,51.1 C53.5,49.4 53.2,47.8 53,46.3 C52.6,44.7 52.2,43.2 51.7,41.7 C51.2,40.1 50.6,38.5 50.1,36.8 C49.6,35.2 48.5,31.6 48.5,31.6 C48.5,31.6 48.1,34.7 48,36.4 C47.8,38.1 47.6,40 47.4,41.8 C47.2,43.7 47,45.7 46.8,47.8 C46.6,49.9 46.4,52.1 46.1,54.3 C45.9,56.5 45.7,58.9 45.5,61.1 C45.3,63.4 45.2,65.7 45.1,67.9 C44.9,70.2 44.8,72.5 44.8,74.7 C44.8,77 44.7,79.4 44.8,81.6 C44.8,83.7 44.8,85.9 44.9,87.8 C44.9,89.7 45,91.3 45,92.8 C44.9,94.3 44.8,97 44.8,97 C44.8,97 41.9,97.2 40.6,97.2 C39.3,97.2 36.8,96.9 36.8,96.9 C36.8,96.9 36,91.8 35.6,89.1 C35.4,86.4 35.1,83.4 34.9,80.5 C34.7,77.5 34.6,74.5 34.4,71.3 C34.3,68.2 34.3,65.1 34.3,61.7 C34.2,58.3 34.3,54.6 34.1,50.9 C34,47.2 33.8,43.2 33.5,39.6 C33.3,35.9 32.7,32.3 32.5,29.1 C32.2,25.8 31.8,22.8 31.7,20 C31.5,17.1 31.5,14.3 31.6,12 C31.7,9.8 31.9,7.8 32,6.3 C32.1,4.9 32.3,3.2 32.3,3.2 Z',
  band:'M32.3,7.1 C34,7.1 39.4,7 43,7 C46.5,6.9 50.1,6.9 53.5,6.9 C56.8,6.8 61.4,6.7 62.9,6.7',
  fly:'M51.4,7.5 C51.4,8.7 51.5,12.4 51.5,14.5 C51.5,16.6 51.5,18.7 51.4,20.1 C51.2,21.6 51,22.3 50.7,22.9 C50.5,23.5 49.8,23.7 49.5,23.9',
  loopl:'M41,3.5 C41,3.5 42.4,3.5 42.4,3.5 C42.4,3.5 42.4,9.6 42.4,9.6 C42.4,9.6 41,9.6 41,9.6 C41,9.6 41,3.5 41,3.5 Z',
  loopr:'M58.2,3.3 C58.2,3.3 59.4,3.3 59.4,3.3 C59.4,3.3 59.4,8.7 59.4,8.7 C59.4,8.7 58.2,8.7 58.2,8.7 C58.2,8.7 58.2,3.3 58.2,3.3 Z',
  tab:'M45.2,5.3 C45.2,5.3 49.8,5.2 49.8,5.2 C49.8,5.2 49.8,7.1 49.8,7.1 C49.8,7.1 45.2,7.2 45.2,7.2 C45.2,7.2 45.2,5.3 45.2,5.3 Z',
  pockl:'M33,4.6 C33.1,5.4 33.7,7.7 34,9.2 C34.3,10.8 34.7,12.6 35.1,14.1 C35.4,15.5 35.8,17.5 35.9,18.2',
  pockr:'M61.8,7.3 C62,8.1 62.6,10.2 62.9,11.6 C63.3,13 63.6,14.6 63.9,15.7 C64.2,16.9 64.4,18 64.5,18.4',
  creasel:'M40.7,23.9 C40.7,26.6 40.9,34.6 41,40.2 C41.1,45.8 41.3,51.8 41.4,57.7 C41.5,63.6 41.6,69.8 41.7,75.6 C41.8,81.4 42,90 42.1,92.9',
  creaser:'M56.9,28.2 C57.1,30.3 57.6,36.9 57.9,40.7 C58.2,44.5 58.5,49.2 58.6,50.9',
  knee:'M58.6,51.5 C59.2,51.9 61,53.3 62.2,54.1 C63.4,54.9 65.4,56 66,56.4',
  hemr:'M48,93.1 C49,93.1 52.2,93.1 54.4,93.1 C56.7,93 60.4,92.7 61.6,92.7',
  button:'47.6,6.2'};
const PANTS_FAB=.22;
function pantsFabric(id,i){const p=fabricDef(id,i,'bot'),m=p.match(/ patternTransform="([^"]*)"/),tf=m?m[1]:'';
  return (m?p.replace(m[0],''):p).replace('patternUnits="userSpaceOnUse"',`patternUnits="userSpaceOnUse" patternTransform="scale(${PANTS_FAB})${tf?' '+tf:''}"`)}
function pantsMarks(i,P){const S=PANTS_D,c=colOf(i),e=mix(c,'#000',.42),hi=mix(c,'#fff',.22),k=typeof trouserKind==='function'?trouserKind(i):'dress';
  const ln=(d,w=.4,o=1,col=e)=>`<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
  // jeans and chinos: their twill over the cloth (trouserMarks' weave, clipped to the trousers; its seams belong to the square)
  const tw=k==='dress'?'':(()=>{const t=trouserMarks(i,P),m=t.match(/^<defs>[\s\S]*?<\/defs>/);return m?m[0]+`<g clip-path="url(#${P}pc)"><rect x="0" y="0" width="100" height="100" fill="url(#${P}tw)"/></g>`:''})();
  return tw+ln(S.band,.4)+`<path d="${S.loopl}" fill="${mix(c,'#000',.25)}" stroke="${e}" stroke-width=".3"/><path d="${S.loopr}" fill="${mix(c,'#000',.25)}" stroke="${e}" stroke-width=".3"/><path d="${S.tab}" fill="none" stroke="${e}" stroke-width=".3"/>`+
    `<circle cx="${S.button.split(',')[0]}" cy="${S.button.split(',')[1]}" r=".6" fill="${mix(c,'#000',.6)}" stroke="${hi}" stroke-width=".12"/>`+
    ln(S.fly,.45)+ln(S.pockl,.4)+ln(S.pockr,.4)+ln(S.creasel,.35,.8,hi)+ln(S.creaser,.3,.6,hi)+ln(S.knee,.3,.5)+ln(S.hemr,.3,.5)+
    (k==='jeans'?`<path d="${S.pockl}" fill="none" stroke="#d9a441" stroke-width=".35" stroke-dasharray="1 .7" transform="translate(.7 0)"/><path d="${S.pockr}" fill="none" stroke="#d9a441" stroke-width=".35" stroke-dasharray="1 .7" transform="translate(-.7 0)"/>`+[[35.9,18.2],[64.5,18.4]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r=".75" fill="#b87333" stroke="#6e4220" stroke-width=".2"/>`).join(''):'')}
/* shirt, folded: traced from Brooks Brothers' photo of their black pinpoint oxford dress shirt (ME04469, 2026-11-13, the owner's pick):
   the outline from the photo's pixels (the dark cloth, holes filled; the tie's tip past the hem cut off), the collar's leaves, band,
   shoulder seams, the cuff with its button, the folded sleeve, the pocket and the side fold placed on zoomed crops and snapped to the
   picture's edges; the tie and the maker's label left out, the placket and its buttons drawn on where the tie hid them.
   Box: X=(x-823.5)*.0632+50, Y=(y-271)*.0632+4 in the 1648x2000 photo. */
const SHIRT_D={out:'M32.8,93.7 L23.7,93.4 L19.5,93.6 L19.1,93.3 L19,92.8 L19,86 L18.7,85.7 L17.3,85.6 L17,85.1 L17.4,76.3 L17.1,72 L17,63.2 L17.2,58.6 L17.5,58.3 L18.8,57.9 L19.1,57.5 L19.1,35.1 L19.4,16.5 L20.3,15.7 L21.5,15.2 L30.7,12.4 L35.7,11.1 L36.1,10.6 L36.8,7.9 L37.2,7.1 L38.3,6 L39.7,5.2 L41.9,4.6 L44.1,4.3 L54.2,4 L59.3,4.3 L62.2,4.7 L64.3,5.3 L65.7,6 L66.6,7 L67.2,8.4 L68.1,11.8 L81.6,16 L82.5,16.5 L83,17.1 L82.9,38.4 L82.6,58.4 L82.6,69.7 L82.8,71.6 L82.3,82.6 L82.4,93 L82.2,93.7 L81.9,93.9 L78.2,93.8 L69.4,93.9 L67.2,94.1 L65.9,94 Z',
  inside:'M38.9,12.2 L42.2,19.9 L45.6,26.7 L48.2,30.8 L50.2,32.6 L51.8,33.4 L52.5,33.4 L54.5,32 L56.9,29.2 L59.7,24.4 L62.8,17.9 L65.7,10.9 L65.6,11.1 L58.8,10.9 L52.3,10.7 L45.7,10.7 L38.4,10.9 Z',
  collar:'M37.3,11.1 C37.1,11.8 36.4,13.9 36.1,15.4 C35.7,16.9 35.3,18.5 35.2,20.2 C35.1,22 35.1,24.1 35.2,26 C35.4,27.9 35.7,29.9 35.9,31.7 C36.2,33.3 36.4,34.9 36.6,36.1 C36.8,37.3 37,39 37,39 M37,39 C37,39 40.5,37.8 42.3,37.1 C44,36.5 46.6,35.4 47.5,35.1 M38.9,12.2 C39.5,13.5 41.1,17.5 42.2,20 C43.3,22.4 44.6,24.9 45.6,26.7 C46.6,28.6 47.5,29.8 48.2,30.9 C49,31.8 49.6,32.2 50.2,32.6 C50.8,33.1 51.8,33.5 51.8,33.5 M65.7,10.9 C65.2,12.1 63.7,15.7 62.8,17.9 C61.8,20.2 60.7,22.5 59.7,24.4 C58.8,26.3 57.8,27.9 56.9,29.2 C56,30.4 55.2,31.3 54.5,32 C53.8,32.7 52.5,33.4 52.5,33.4 M67.5,11.5 C67.6,12.2 67.8,14.2 67.7,16.1 C67.7,18 67.6,20.2 67.4,22.7 C67.2,25.2 67,28.2 66.8,31 C66.5,33.9 65.8,39.6 65.8,39.6 M65.6,39.5 C65.6,39.5 62.2,38.1 60.6,37.4 C58.9,36.7 56.4,35.7 55.6,35.3',
  band:'M38.4,10.9 C39.6,10.9 43.4,10.7 45.7,10.7 C48,10.6 50.1,10.6 52.3,10.7 C54.5,10.7 56.6,10.8 58.8,10.9 C61,11 64.4,11 65.6,11.1 M42.4,19.8 C43.7,19.8 47.1,19.9 50.3,19.9 C53.6,19.9 60,20 61.9,20.1',
  seams:'M19.9,24.4 C21.1,24.1 24.7,23.2 27.2,22.7 C29.6,22.1 33.4,21.1 34.6,20.8 M69.6,22 C70.7,22.3 73.9,23.1 76,23.6 C78.1,24.1 81.3,24.9 82.4,25.2 M52.4,19.8 C52.4,22 52.4,31 52.4,33.3 M52.2,33.8 C52.2,38.7 52.2,53.3 52.2,63.4 C52.3,73.5 52.3,89.2 52.3,94.3 M64.8,76.1 C64.8,77.5 64.8,82.2 64.9,84.7 C64.9,87.2 65.1,89.7 65.4,91.2 C65.6,92.7 66.2,93.5 66.4,93.9',
  cuff:'M20.6,76.2 C20.6,76.2 20.5,70.6 20.6,67.8 C20.6,65 20.6,59.3 20.6,59.3 C20.6,59.3 25.3,59.4 27.5,59.4 C29.8,59.4 34.1,59.4 34.1,59.4 C34.1,59.4 34.1,63.7 34.1,65.7 C34.1,67.6 34.1,69.6 34,71 C33.8,72.5 33.7,73.7 33.2,74.5 C32.7,75.4 32,75.7 31.2,76.1 C30.3,76.4 29.2,76.4 28.1,76.5 C27,76.6 25.7,76.6 24.5,76.6 C23.3,76.6 20.7,76.4 20.7,76.4',
  sleeve:'M20.4,76.2 C20.4,77.7 20.4,85.3 20.4,85.3 C20.4,85.3 24.8,85.3 27.1,85.3 C29.3,85.2 33.7,85.1 33.7,85.1 C33.7,85.1 33.9,82.4 33.9,81 C34,79.6 34.1,77.3 34.1,76.6 M17.2,58.7 C17.8,58.8 20.1,59.3 20.7,59.4 M18.6,69.5 C19,69.6 20.4,69.6 20.7,69.7',
  pocket:'M82.8,70.4 C82.8,70.4 76.8,70.5 73.8,70.5 C70.8,70.5 64.9,70.5 64.9,70.5 C64.9,70.5 64.9,72.4 64.9,73.4 C65,74.3 65,76 65,76 C65,76 69.2,77.7 71.3,78.5 C73.4,79.4 77.7,81.1 77.7,81.1 C77.7,81.1 79.3,80.7 80.1,80.5 C81,80.3 82.8,80.1 82.8,80.1',
  hole:'M25.3,70.4 C25.3,70.6 25.3,71.6 25.3,71.8',
  button:'25.1,73.3',
  fronts:'52.3,50.7 52.3,69 52.3,87.4',
  shadow:'M37,39.3 L42.2,37.4 L47.4,35.2 M65.6,39.9 L60.5,37.7 L55.7,35.5'};
/* the cloth at a folded shirt's scale: the shirt is about 66 units for ~30 cm of cloth (the blazer's ~51 units for ~60 cm is .26) */
const SHIRT_FAB=.55;
function shirtFabric(id,i){const p=fabricDef(id,i,'shirt'),m=p.match(/ patternTransform="([^"]*)"/),tf=m?m[1]:'';
  return (m?p.replace(m[0],''):p).replace('patternUnits="userSpaceOnUse"',`patternUnits="userSpaceOnUse" patternTransform="scale(${SHIRT_FAB})${tf?' '+tf:''}"`)}
function shirtMarks(i,P){const S=SHIRT_D,c=colOf(i),[r,g,b]=hexRgb(c),dark=(.299*r+.587*g+.114*b)<70,
    e=dark?mix(c,'#fff',.22):mix(c,'#000',.32),sh=dark?'#000':mix(c,'#000',.45),
    ln=(d,col,w,op)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${op?` stroke-opacity="${op}"`:''} stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<defs>${shirtFabric(P+'f',i)}<linearGradient id="${P}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".14"/><stop offset=".45" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs>`+
    `<path d="${S.out}" fill="url(#${P}f)" stroke="${dark?mix(c,'#fff',.15):mix(c,'#000',.4)}" stroke-width=".45"/><path d="${S.out}" fill="url(#${P}s)"/>`+
    `<path d="${S.inside}" fill="#000" fill-opacity="${dark?.3:.06}"/>`+ln(S.shadow,sh,1.1,dark?.5:.18)+
    ln(S.collar,e,.42)+ln(S.band,e,.3,.8)+ln(S.seams,e,.3,.75)+ln(S.cuff,e,.4)+ln(S.sleeve,e,.32,.8)+ln(S.pocket,e,.36)+ln(S.hole,e,.35)+
    [S.button,...S.fronts.split(' ')].map(q=>{const [bx,by]=q.split(',').map(Number);return `<circle cx="${bx}" cy="${by}" r="1.25" fill="#e7e4dc" stroke="#9a968c" stroke-width=".2"/>`+[[-.35,-.35],[.35,-.35],[-.35,.35],[.35,.35]].map(([x,y])=>`<circle cx="${(bx+x).toFixed(2)}" cy="${(by+y).toFixed(2)}" r=".16" fill="#8a867c"/>`).join('')}).join('')}
/* wristwatch, three-quarter view: traced from the owner's item picture of his watch (the realistic product shot made for it, a
   steel chronograph on an integrated bracelet; 2026-11-13, the owner's ask): the outline from the picture's pixels (the plain ground
   flooded from the edges; where it ran into the soft shadow at the lower right and the bottom, points placed on 1.3x crops), the
   bezel, dial and subdials as ellipses fitted to edge points found along rays (ellfit), the bracelet's link gaps measured column by
   column from the dark lines, the crown, pushers, date window, hands and printed figures placed on 2-3x crops; no maker's name.
   The case and bracelet take the metal (METAL_TONES), the dial its colour; a leather strap replaces the links; a fluted or smooth
   bezel, and three hands (with or without the date) instead of the subdials, follow watchOpts. Box: X=(x-510)*.103+50, Y=(y-66)*.103+4
   in the 1024 px picture. */
const WATCH_D={out:'M36.03,89.59 C36.04,89.3 36.23,89.35 36.01,88.77 C35.79,88.19 35.04,86.97 34.71,86.09 C34.39,85.22 34.15,84.25 34.03,83.52 C33.92,82.78 34.12,82.18 34.01,81.66 C33.9,81.15 33.63,81.16 33.38,80.43 C33.12,79.69 32.7,78.42 32.47,77.23 C32.24,76.05 32.16,74.11 31.98,73.32 C31.79,72.53 31.64,73.06 31.38,72.49 C31.11,71.93 31.09,71.96 30.39,69.92 C29.69,67.88 28,62.8 27.2,60.24 C26.39,57.68 25.97,56.36 25.57,54.57 C25.17,52.79 24.89,51.24 24.79,49.53 C24.69,47.81 24.85,45.63 24.97,44.27 C25.09,42.92 24.91,43.33 25.53,41.39 C26.15,39.45 27.28,35.91 28.7,32.63 C30.12,29.36 32.95,23.83 34.06,21.72 C35.16,19.6 34.9,20.87 35.31,19.97 C35.72,19.06 36.12,17.27 36.53,16.26 C36.94,15.24 37.44,14.44 37.78,13.89 C38.13,13.34 38.3,13.65 38.61,12.96 C38.91,12.27 39.2,10.75 39.62,9.77 C40.03,8.79 40.68,7.71 41.1,7.09 C41.53,6.47 41.92,6.37 42.17,6.06 C42.43,5.75 42.45,5.47 42.63,5.24 C42.8,5 42.92,4.85 43.2,4.66 C43.49,4.47 43.22,4.24 44.34,4.08 C45.45,3.92 47.84,3.67 49.9,3.69 C51.96,3.71 55.24,4.12 56.7,4.19 C58.15,4.25 57.69,4.05 58.65,4.1 C59.61,4.16 61.33,4.33 62.46,4.51 C63.6,4.7 64.81,4.96 65.45,5.22 C66.09,5.47 65.95,5.27 66.32,6.06 C66.68,6.85 67.26,8.39 67.61,9.97 C67.97,11.55 68.2,13.22 68.44,15.54 C68.68,17.85 68.92,21.17 69.06,23.88 C69.19,26.59 68.93,29.97 69.26,31.81 C69.59,33.65 70.59,34.02 71.01,34.9 C71.44,35.78 71.73,36.58 71.82,37.06 C71.9,37.54 71.71,37.56 71.51,37.78 C71.3,38.01 70.79,38.25 70.6,38.42 C70.41,38.59 70.07,38.1 70.39,38.81 C70.72,39.53 72.15,41.85 72.54,42.73 C72.93,43.6 72.5,43.67 72.74,44.07 C72.98,44.46 73.73,44.79 73.98,45.1 C74.22,45.41 74.17,45.39 74.21,45.92 C74.24,46.45 74.27,47.64 74.21,48.29 C74.14,48.94 74.1,49.39 73.81,49.84 C73.53,50.28 72.74,50.57 72.5,50.97 C72.25,51.36 72.63,51.55 72.33,52.2 C72.03,52.86 70.95,53.85 70.68,54.88 C70.41,55.91 70.78,57.37 70.7,58.38 C70.63,59.4 70.87,60.17 70.25,60.96 C69.63,61.75 67.79,60.15 67,63.12 C66.2,66.09 65.78,75.1 65.45,78.78 C65.12,82.45 65.24,83.17 65.04,85.16 C64.83,87.16 64.54,89.15 64.21,90.73 C63.89,92.31 63.8,93.8 63.08,94.64 C62.36,95.48 62.24,95.57 59.89,95.77 C57.54,95.98 52.51,96 48.97,95.88 C45.43,95.76 40.59,95.34 38.67,95.05 C36.75,94.76 37.88,94.88 37.43,94.13 C36.99,93.37 36.23,91.28 35.99,90.52 C35.76,89.76 36.03,89.88 36.03,89.59 Z',
  colT:'M48.97,4.62 L48.66,8.53 L48.25,12.65 L47.84,17.8 L47.22,24.19 L52.16,24.19 L53.19,17.8 L54.02,12.65 L54.33,8.53 L54.43,4.41 Z',
  colB:'M42.48,68.27 L42.79,74.45 L43.31,79.6 L43.82,84.75 L44.34,89.9 L44.64,95.67 L50.31,95.67 L50,89.9 L49.69,84.75 L49.28,79.6 L48.97,74.45 L48.66,68.27 Z',
  darkT:'M47.32,23.36 L52.16,23.36 L52.16,25.84 L47.32,25.84 Z',
  darkB:'M42.48,67.35 L48.66,67.35 L48.66,70.74 L42.48,70.74 Z',
  far:'M64.63,4.93 L66.38,6.78 L67.61,8.64 L68.54,13.68 L68.85,19.45 L68.85,27.07 L66.69,28.1 L65.45,19.86 L64.94,11.62 Z M64.63,65.18 L67,64.56 L66.27,70.85 L65.45,78.78 L65.04,85.16 L64.21,90.73 L63.08,94.64 L61.33,95.05 L62.15,85.78 L62.98,75.48 L63.39,68.27 Z',
  gaps:'M36.61,6.68 L43.82,5.85 L46.4,5.65 L48.66,5.65 M54.43,5.44 L57.21,5.75 L60.3,6.16 L63.39,6.78 L69.57,7.71 M38.67,12.96 L40.73,12.76 L43.82,12.34 L46.4,12.14 L48.25,12.03 M54.02,12.34 L57.21,12.55 L60.3,13.17 L63.39,13.99 L69.57,15.43 M36.61,19.66 L40.73,19.45 L43.82,19.35 L46.4,19.35 L47.84,19.35 M53.19,19.76 L57.21,19.97 L60.3,20.48 L63.39,21.3 L69.57,22.75 M31.46,73.73 L35.58,73.94 L38.67,74.45 L41.25,74.66 L42.79,74.66 M48.97,75.17 L52.06,75.28 L56.18,75.07 L59.27,74.76 L68.54,74.04 M32.49,81.87 L35.58,82.07 L38.67,82.9 L41.25,83.41 L43.31,83.52 M49.28,84.03 L52.06,84.03 L56.18,83.72 L59.27,83.21 L68.54,82.49 M34.55,89.39 L38.67,89.59 L41.25,90.21 L44.03,90.42 M50,91.14 L52.06,91.14 L56.18,90.73 L59.27,90.31 L68.54,89.7 M48.66,8.22 L54.33,8.22 M48.25,12.34 L54.02,12.34 M47.94,16.26 L53.61,16.26 M47.73,19.86 L53.19,19.86 M43,78.68 L49.38,78.68 M44.03,87.74 L49.9,87.74',
  lugT:'M31.46,22.95 L38.67,20.07 L46.91,19.35 L55.15,19.86 L64.42,21.51 L68.54,22.95',
  lugB:'M30.43,68.27 L34.55,73.63 L42.79,74.66 L55.15,75.17 L65.45,74.25',
  bezelOut:'46.07 46.3 20.34 21.19 34.3',
  bezelIn:'46.23 46.39 17.75 18.44 12.26',
  sec:'40.32 40.08 4.52 4.65 22.08',
  time:'46.5 55.46 8.16 8.44 22.6',
  minC:'50.62 42.01',
  minR:'7.93 7.31 5.77 5.36',
  crown:'68.75 43.76 5.15 6.39',
  pushU:'M66.69,31.4 L68.54,30.88 L70.81,35.11 L71.22,37.78 L69.57,38.5 L68.13,36.96 Z',
  slotU:'M68.54,35.52 L70.6,35.11 L71.01,37.37 L69.36,37.78 Z',
  pushL:'M66.69,59.21 L68.85,57.77 L70.29,59.21 L69.98,63.12 L67.92,64.36 L66.48,63.12 Z',
  date:'M56.7,54.57 L58.76,54.78 L58.45,56.84 L56.18,56.53 Z',
  hub:'46.81,44.07',
  chTip:'47.43,30.16',
  chTail:'46.6,46.85',
  secHub:'40.32,40.08',
  secTip:'36.4,39.33',
  minHub:'50.72,41.9',
  minTip:'50.82,35',
  tHub:'46.91,55.19',
  tMin:'51.03,51.69',
  tHour:'48.97,60.03',
  tSec:'49.18,61.27',
  txt:'SEC.|40.32|42.63|0.93;MIN.|57.83|49.42|1.24;15|53.81|39.64|1.03;30|54.64|42.73|1.03;45|53.61|45.51|1.03',
  num:'12|47.12|50.14|1.96;6|47.12|61.68|1.96'};
function drawWatchTraced(w,P){const S=WATCH_D,o=watchOpts(w),[mL,mM,mD]=METAL_TONES[w&&w.metal]||METAL_TONES.silver,dial=COLORS[o.dial]||'#f6f6f3',
    ink=lum(dial)<.45?'#e9eaec':'#1d2125',navy='#1d2b4f',strap=o.band==='leather',chrono=o.style==='chronograph',
    el=(s,a)=>{const [cx,cy,rx,ry,an]=s.split(' ');return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${an} ${cx} ${cy})" ${a}/>`},
    // a point at screen angle t on an ellipse turned by an, at k of its size
    ep=(s,k,t)=>{const [cx,cy,rx,ry,an]=s.split(' ').map(Number),a=an*Math.PI/180,u=Math.atan2(rx*Math.sin(t-a),ry*Math.cos(t-a)),x=rx*k*Math.cos(u),y=ry*k*Math.sin(u);return [cx+x*Math.cos(a)-y*Math.sin(a),cy+x*Math.sin(a)+y*Math.cos(a)]},
    ln=(d,c,w,op)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${op?` stroke-opacity="${op}"`:''} stroke-linecap="round" stroke-linejoin="round"/>`,
    hand=(a,b,w,c)=>{const [x1,y1]=a.split(',').map(Number),[x2,y2]=b.split(',').map(Number),L=Math.hypot(x2-x1,y2-y1),nx=-(y2-y1)/L*w,ny=(x2-x1)/L*w;
      return `<path d="M${f2(x1+nx)},${f2(y1+ny)} L${f2(x2)},${f2(y2)} L${f2(x1-nx)},${f2(y1-ny)} Z" fill="${c}"/>`},f2=n=>+n.toFixed(2);
  const [bx,by]=S.bezelIn.split(' ').map(Number);let s=`<defs>
   <linearGradient id="${P}br" x1="0" x2="1"><stop offset="0" stop-color="${mD}"/><stop offset=".22" stop-color="${mM}"/><stop offset=".42" stop-color="${mL}"/><stop offset=".62" stop-color="${mM}"/><stop offset=".85" stop-color="${mL}"/><stop offset="1" stop-color="${mD}"/></linearGradient>
   <linearGradient id="${P}po" x1="0" x2="1"><stop offset="0" stop-color="${mD}"/><stop offset=".3" stop-color="#fff"/><stop offset=".55" stop-color="${mM}"/><stop offset=".8" stop-color="${mL}"/><stop offset="1" stop-color="${mD}"/></linearGradient>
   <radialGradient id="${P}bz" cx=".3" cy=".25" r=".95"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="${mL}"/><stop offset=".85" stop-color="${mM}"/><stop offset="1" stop-color="${mD}"/></radialGradient>
   <radialGradient id="${P}dl" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${mix(dial,'#fff',.45)}"/><stop offset="1" stop-color="${mix(dial,'#000',.08)}"/></radialGradient>
   <clipPath id="${P}c"><path d="${S.out}"/></clipPath><clipPath id="${P}bt"><rect x="0" y="0" width="100" height="${(222-66)*.103+4}"/><rect x="0" y="${(748-66)*.103+4}" width="100" height="40"/></clipPath>
  </defs>`;
  s+=`<path d="${S.out}" fill="url(#${P}br)" stroke="${mD}" stroke-width=".3"/><g clip-path="url(#${P}c)">`;
  if(strap){const sc=w?colOf(w):'#3a2414';
    s+=`<g clip-path="url(#${P}bt)"><rect width="100" height="100" fill="${sc}"/><rect width="100" height="100" fill="url(#${P}br)" opacity=".18"/></g>`+ln(S.lugT,'#000',.35,.4)+ln(S.lugB,'#000',.35,.4)+
      `<path d="${S.out}" fill="none" stroke="${mix(sc,'#fff',.4)}" stroke-width=".25" stroke-dasharray=".8 .55" clip-path="url(#${P}bt)" transform="translate(50 50) scale(.93) translate(-50 -50)"/>`}
  else s+=`<path d="${S.colT}" fill="url(#${P}po)"/><path d="${S.colB}" fill="url(#${P}po)"/><path d="${S.darkT}" fill="#15171a"/><path d="${S.darkB}" fill="#15171a"/>`+ln(S.gaps,'#202327',.4,.7);
  s+=`<path d="${S.far}" fill="#000" opacity=".16"/></g>`;
  // crown and pushers on the right
  const [cx,cy,cw,ch]=S.crown.split(' ').map(Number);
  s+=`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="1.3" fill="url(#${P}po)" stroke="${mD}" stroke-width=".25"/>`+[1,2,3,4,5].map(k=>`<line x1="${f2(cx+.6)}" x2="${f2(cx+cw-.4)}" y1="${f2(cy+ch*k/6)}" y2="${f2(cy+ch*k/6)}" stroke="${mD}" stroke-width=".2" stroke-opacity=".7"/>`).join('');
  if(chrono)s+=`<path d="${S.pushU}" fill="url(#${P}po)" stroke="${mD}" stroke-width=".25"/><path d="${S.slotU}" fill="#202327"/><path d="${S.pushL}" fill="url(#${P}po)" stroke="${mD}" stroke-width=".25"/>`;
  // bezel: polished ring, engraved figures or flutes, the dark reflection low on the right
  s+=el(S.bezelOut,`fill="url(#${P}bz)" stroke="${mD}" stroke-width=".3"`);
  if(o.bezel==='fluted')for(let i=0;i<120;i++){const t=i/120*2*Math.PI,[x1,y1]=ep(S.bezelIn,1.02,t),[x2,y2]=ep(S.bezelOut,.97,t);s+=`<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${i%2?mD:'#fff'}" stroke-width=".45" stroke-opacity=".7"/>`}
  {const P1=[],P2=[];for(let i=0;i<=24;i++){const t=(22+78*i/24)*Math.PI/180;P1.push(ep(S.bezelIn,1,t));P2.push(ep(S.bezelIn,1.075,t))}
    s+=`<path d="M${P1.map(p=>p.map(f2).join(',')).join(' L')} L${P2.reverse().map(p=>p.map(f2).join(',')).join(' L')} Z" fill="#111" opacity=".85"/>`}
  if(o.bezel==='engraved')for(let i=1;i<=12;i++){const t=(i*30-90)*Math.PI/180,[x,y]=ep(S.bezelIn,1.07,t),dark=i>=4&&i<=6;
    s+=`<text x="${f2(x)}" y="${f2(y)}" font-size="1.75" text-anchor="middle" dominant-baseline="central" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="${dark?'#e9eaec':mD}" fill-opacity=".8" transform="rotate(${i*30} ${f2(x)} ${f2(y)})">${i*5}</text>`}
  // dial, its minute track
  s+=el(S.bezelIn,`fill="url(#${P}dl)" stroke="${mD}" stroke-width=".35"`);
  for(let i=0;i<60;i++){const t=(i*6-90)*Math.PI/180,[x1,y1]=ep(S.bezelIn,.965,t),[x2,y2]=ep(S.bezelIn,i%5?.935:.9,t);s+=`<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${ink}" stroke-opacity="${i%5?.45:.8}" stroke-width="${i%5?.12:.22}"/>`}
  const bar=h=>{const t=(h*30-90)*Math.PI/180,[x1,y1]=ep(S.bezelIn,.87,t),[x2,y2]=ep(S.bezelIn,.79,t);return `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${ink}" stroke-width=".5" stroke-linecap="round"/>`};
  const tx=(spec,fill,w)=>spec.split(';').map(q=>{const [t,x,y,sz]=q.split('|');return `<text x="${x}" y="${y}" font-size="${sz}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="${w}" fill="${fill}">${t}</text>`}).join('');
  if(chrono){
    [1,2,4,5,7,8,10,11].forEach(h=>s+=bar(h));
    s+=el(S.sec,`fill="${mix(dial,'#000',.05)}" stroke="${mD}" stroke-width=".3"`)+el(S.time,`fill="${mix(dial,'#000',.02)}" stroke="${mD}" stroke-width=".3"`);
    // small seconds: a fine track at the rim; the time subdial: short bars half way in, none at 12 and 6 (the applied numerals)
    for(const [ss,n] of [[S.sec,60],[S.time,12]])for(let i=0;i<n;i++){if(n===12&&i%6===0)continue;const t=(i*360/n-90)*Math.PI/180,[x1,y1]=ep(ss,n===12?.8:.95,t),[x2,y2]=ep(ss,n===12?.64:i%5?.88:.8,t);s+=`<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${ink}" stroke-width="${n===12?.42:.12}" stroke-opacity=".85"/>`}
    const [mx,my]=S.minC.split(' ').map(Number),[r1,r2,r3,r4]=S.minR.split(' ').map(Number),arc=(a0,a1)=>{const p=(rx,ry,a)=>f2(mx+rx*Math.cos(a))+','+f2(my+ry*Math.sin(a)),A0=a0*Math.PI/180,A1=a1*Math.PI/180,big=a1-a0>180?1:0;
      return `M${p(r1,r2,A0)} A${r1},${r2} 0 ${big} 1 ${p(r1,r2,A1)} L${p(r3,r4,A1)} A${r3},${r4} 0 ${big} 0 ${p(r3,r4,A0)} Z`};
    s+=`<path d="${arc(-90,62)}" fill="${mix(dial,'#000',.22)}" stroke="${mD}" stroke-width=".2"/><path d="${arc(35,62)}" fill="#1f4fa8"/>`;
    for(let i=0;i<=30;i++){const a=(-90+152*i/30)*Math.PI/180;s+=`<line x1="${f2(mx+r1*.97*Math.cos(a))}" y1="${f2(my+r2*.97*Math.sin(a))}" x2="${f2(mx+r3*1.05*Math.cos(a))}" y2="${f2(my+r4*1.05*Math.sin(a))}" stroke="${i%5?'#fff':ink}" stroke-width=".12" stroke-opacity=".6"/>`}
    s+=tx(S.txt,ink,700)+tx(S.num,`url(#${P}po)`,700).replace(/<text /g,`<text stroke="${mD}" stroke-width=".12" `);
    s+=`<path d="${S.date}" fill="#fff" stroke="${ink}" stroke-opacity=".5" stroke-width=".15"/>`;
    s+=hand(S.tHub,S.tMin,.35,mM)+hand(S.tHub,S.tHour,.5,mM)+`<line x1="${S.tHub.split(',')[0]}" y1="${S.tHub.split(',')[1]}" x2="${S.tSec.split(',')[0]}" y2="${S.tSec.split(',')[1]}" stroke="#c0392b" stroke-width=".12"/>`+
      hand(S.secHub,S.secTip,.18,mD)+hand(S.minHub,S.minTip,.5,navy)+hand(S.hub,S.chTip,.32,navy)+hand(S.hub,S.chTail,.55,navy);
    for(const [h,r] of [[S.hub,.85],[S.minHub,.95],[S.secHub,.45],[S.tHub,.6]]){const [x,y]=h.split(',');s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${h===S.secHub||h===S.tHub?mM:navy}" stroke="${mD}" stroke-width=".12"/>`}
  }else{
    // three hands: every hour bar (two at 12), the date at 3 unless it has none, hands from the dial's centre
    for(let h=0;h<12;h++){if(h===3&&o.style!=='no-date')continue;s+=bar(h)}
    const [ccx,ccy]=[bx,by],t3=0,[dx,dy]=ep(S.bezelIn,.8,t3);
    if(o.style!=='no-date')s+=`<rect x="${f2(dx-1.1)}" y="${f2(dy-.9)}" width="2.2" height="1.8" fill="#fff" stroke="${ink}" stroke-opacity=".5" stroke-width=".15"/>`;
    const tip=(k,deg)=>ep(S.bezelIn,k,(deg-90)*Math.PI/180).map(f2).join(',');
    s+=hand(ccx+','+ccy,tip(.55,300),.55,ink)+hand(ccx+','+ccy,tip(.8,60),.4,ink)+hand(ccx+','+ccy,tip(.85,170),.1,'#c0392b')+`<circle cx="${ccx}" cy="${ccy}" r=".7" fill="${ink}"/>`}
  // the crystal's glint
  s+=el(S.bezelIn,`fill="#fff" fill-opacity=".07"`);
  return s}
/* tie, laid flat with its narrow end rolled up beside the blade: traced from Brooks Brothers' photo of their solid rep tie in blue
   (MA03183, 2026-11-13, the owner's pick; the blue, not the black, so the roll's folds show): the outline from the photo's pixels
   (its blueness against the cream ground), the roll's two folds found as dark dips in its columns' mean brightness and snapped to
   them, the roll's steps at the top and its ends at the bottom in the outline. Box: X=(x-825)*.053+50, Y=(y-133)*.053+4 in the
   1648x2000 photo. The cloth is the tie's own pattern; the roll's turns are shaded darker going in. */
const TIE_D={out:'M46.9,4 L61.2,4.1 L61.6,4.2 L61.8,4.5 L61.9,6.1 L62.1,6.4 L65.2,6.6 L65.6,6.9 L65.7,8.4 L65.8,8.6 L68,8.8 L68.3,9 L68.6,10.6 L68.8,19.3 L69.3,26.8 L69.6,39.5 L69.4,43.6 L69.2,45.2 L68.9,46.6 L68.5,46.8 L66.1,46.7 L65.8,47 L65.4,47.7 L65,48.1 L64.2,48.3 L63,48.2 L62.7,48.6 L62.9,60.7 L63.1,70.5 L63.5,76.8 L63.4,78.7 L61.9,80.9 L58.8,84.3 L47.8,95.5 L47.4,95.8 L47,95.7 L46.3,95 L44,92.7 L36.9,85.5 L30.9,79.3 L30.5,78.7 L30.4,78.3 L30.5,56.5 L31.1,22.1 L31.2,6.4 L31.4,4.7 L31.6,4.3 L32.1,4.2 L46.9,4 Z',
  roll1:'M61.6,6.6 L61.6,10.6 L61.7,15 L61.9,20 L62.3,26.1 L62.7,33 L62.9,39.5 L63,44.5 L63.1,48.2 L69.9,48.9 L69.9,3.3 Z',
  roll2:'M65.1,8.6 L65.8,11.1 L65.9,15 L66,20 L66.2,26.1 L66.4,33 L66.5,39.6 L66.3,44.1 L65.7,46.5 L69.9,48.9 L69.9,3.3 Z',
  folds:'M61.6,6.6 C61.6,6.6 61.6,9.2 61.6,10.6 C61.6,12 61.7,13.4 61.7,15 C61.8,16.5 61.8,18.2 62,20 C62,21.9 62.2,24 62.3,26.1 C62.5,28.3 62.6,30.7 62.7,33 C62.8,35.2 62.9,37.6 62.9,39.5 C63,41.5 63,43 63,44.5 C63,45.9 63.1,48.1 63.1,48.1 M65.1,8.6 C65.1,8.6 65.7,10 65.8,11.1 C65.9,12.2 65.9,13.5 65.9,15 C66,16.5 65.9,18.2 66,20 C66,21.9 66.1,23.9 66.2,26.1 C66.3,28.3 66.4,30.7 66.4,33 C66.5,35.2 66.5,37.7 66.5,39.6 C66.4,41.4 66.4,42.9 66.3,44.1 C66.1,45.2 65.7,46.5 65.7,46.5'};
/* the cloth at a real tie's scale: the blade is about 33 units for 8.5 cm; at 1 a repp stripe repeats about 6 times across it and a
   polka dot about 6 (at 1.5, a guess from the old diamond's size, it was 4: too large) */
const TIE_FAB=1;
function tieFabric(id,i){const p=fabricDef(id,i,'tie'),m=p.match(/ patternTransform="([^"]*)"/),tf=m?m[1]:'';
  return (m?p.replace(m[0],''):p).replace('patternUnits="userSpaceOnUse"',`patternUnits="userSpaceOnUse" patternTransform="scale(${TIE_FAB})${tf?' '+tf:''}"`)}
function tieMarks(i,P){const S=TIE_D,c=colOf(i),[r,g,b]=hexRgb(c),dark=(.299*r+.587*g+.114*b)<60,e=dark?mix(c,'#fff',.18):mix(c,'#000',.4);
  return `<defs>${tieFabric(P+'f',i)}<clipPath id="${P}c"><path d="${S.out}"/></clipPath>
    <linearGradient id="${P}s" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
    <linearGradient id="${P}r" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".3" stop-color="#000" stop-opacity=".05"/><stop offset=".8" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>`+
    `<path d="${S.out}" fill="url(#${P}f)"/><g clip-path="url(#${P}c)"><path d="${S.out}" fill="url(#${P}s)"/>`+
    `<path d="${S.roll1}" fill="url(#${P}r)"/><path d="${S.roll2}" fill="url(#${P}r)"/><path d="${S.roll2}" fill="#000" fill-opacity=".08"/></g>`+
    `<path d="${S.folds}" fill="none" stroke="${e}" stroke-width=".55" stroke-opacity=".8" stroke-linecap="round"/><path d="${S.out}" fill="none" stroke="${e}" stroke-width=".45"/>`}
/* square thumbnail for items saved without a photo (also used as the live preview while adding one) */
let thumbN=0;
/* full: a fabric item drawn as a plain, edge-to-edge sample (no outline or shading), for comparing with its photo */
function itemThumb(i,full){
  const P='th'+(thumbN++)+'-';let g='';
  if(full&&FABRIC.includes(i.type)){const role=i.type==='tie'?'tie':i.type==='shirt'?'shirt':i.type==='pants'?'bot':'top';
    g=`<defs>${fabricDef(P+'f',i,role)}</defs><rect width="100" height="100" fill="url(#${P}f)"/>`}
  else if(i.type==='blazer')g=blazerMarks(i,P);
  else if(i.type==='tie')g=tieMarks(i,P);   /* the traced tie with its rolled end (TIE_D) */
  else if(i.type==='shirt')g=shirtMarks(i,P);   /* the traced folded shirt (SHIRT_D) */   /* the traced coat with its model (BLAZER_D) */
  else if(FABRIC.includes(i.type)){
    const role=i.type==='tie'?'tie':i.type==='shirt'?'shirt':i.type==='pants'?'bot':'top';
    const jk=i.type==='suit',pk=i.type==='pants',shape=i.type==='tie'?'M42,8 L58,8 L55,22 L62,78 L50,92 L38,78 L45,22 Z':jk?SUIT_D.out:pk?PANTS_D.out:'M10,10 H90 V90 H10 Z';
    g=`<defs>${jk?suitFabric(P+'f',i):pk?pantsFabric(P+'f',i):fabricDef(P+'f',i,role)}<linearGradient id="${P}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs>${jk?`<clipPath id="${P}so"><path d="${shape}" clip-rule="evenodd"/></clipPath>`:pk?`<clipPath id="${P}pc"><path d="${shape}"/></clipPath>`:''}<path d="${shape}" fill-rule="evenodd" fill="url(#${P}f)" stroke="#000" stroke-opacity=".25" stroke-width="${jk||pk?.3:.6}"/><path d="${shape}" fill-rule="evenodd" fill="url(#${P}s)"/>`+(jk?suitMarks(i,P):pk?pantsMarks(i,P):trouserMarks(i,P));
  }else if(i.type==='watch')g=drawWatchTraced(i,P);   /* the traced watch (WATCH_D); drawWatch, the old top view, is kept */
  else if(i.type==='shoes')g=`<g transform="translate(2 22)">${drawShoeSide(i,P)}</g>`;
  else if(i.type==='socks')g=`<g transform="translate(20 14)">${drawSock(colOf(i),P,sockToe(i)&&COLORS[sockToe(i)])}</g>`;
  else if(i.type==='belt')g=`<g transform="translate(2 28)">${drawBelt(i,P)}</g>`;
  else if(i.type==='overcoat'||i.type==='raincoat'){const c=colOf(i),e=mix(c,'#000',.35),rain=i.type==='raincoat';
    g=`<path d="M38,14 L50,20 L62,14 L78,22 L84,90 L16,90 L22,22 Z" fill="${c}" stroke="${e}" stroke-width=".8"/><path d="M38,14 L50,40 L62,14" fill="none" stroke="${e}" stroke-width=".8"/>`+
      `<path d="M50,40 L50,90" stroke="${e}" stroke-width=".8"/>${rain?`<path d="M18,52 L82,52" stroke="${e}" stroke-width="2.4"/><rect x="45" y="49" width="10" height="6" rx="1" fill="none" stroke="${METAL.silver}" stroke-width="1.2"/>`:''}`+
      [46,58,70].map(y=>`<circle cx="45" cy="${y}" r="1.4" fill="${e}"/><circle cx="55" cy="${y}" r="1.4" fill="${e}"/>`).join('')}
  else if(i.type==='cufflinks'){const [mL,mM,mD]=METAL_TONES[i.metal]||METAL_TONES.silver;
    g=[32,68].map(x=>`<circle cx="${x}" cy="50" r="12" fill="${mM}" stroke="${mD}" stroke-width="1.2"/><circle cx="${x-3}" cy="47" r="4" fill="${mL}"/><circle cx="${x}" cy="50" r="7.5" fill="none" stroke="${mD}" stroke-width=".6"/>`).join('')}
  else if(i.type==='tieclip'){const m=colOf(i);   /* its colour: a tie clip has no metal field */g=`<rect x="12" y="45" width="76" height="9" rx="3" fill="${m}" stroke="#000" stroke-opacity=".3"/><rect x="14" y="47" width="72" height="2" rx="1" fill="#fff" opacity=".45"/>`}
  else g=`<rect x="10" y="10" width="80" height="80" rx="8" fill="${colOf(i)}"/>`;
  return `<div class="ph thumb"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${TYPES[i.type]||'Item'}">${g}</svg></div>`;
}

/* ---------- torso figure (figure.js), worn with the app's tagged-colour fabrics ----------
   The figure is drawn in a 390x400 box, about 2.7x the mannequin's scale; these factors size each weave so a
   pinstripe suit shows ~25 stripes across the body and a polka-dot tie 3-4 dots across. */
const FIG_SCALE={top:1.6,shirt:1.7,tie:1.5};
function figFabric(item,role){
  if(!item)return null;const k=FIG_SCALE[role];
  return {def:(id,rot)=>{let p=fabricDef(id,item,role,'fig');const m=p.match(/ patternTransform="([^"]*)"/),tf=m?m[1]:'';if(m)p=p.replace(m[0],'');
    return p.replace('patternUnits="userSpaceOnUse"',`patternUnits="userSpaceOnUse" patternTransform="${rot?`rotate(${rot}) `:''}scale(${k})${tf?' '+tf:''}"`)}};
}
/* the page colour the figure fades into. Reading a computed style right after the screen was redrawn makes the browser work
   out every style again (it was 40% of a swipe), so it is read once per theme: it only changes with light/dark */
let figBgMemo=null;
const figBg=()=>{const k=(document.documentElement.dataset.theme||'')+'|'+(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'d':'l');
  if(figBgMemo&&figBgMemo.k===k)return figBgMemo.v;
  const v=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),c=/^#[0-9a-f]{3,8}$/i.test(v)?v:'#e8ebec';figBgMemo={k,v:c};return c};
/* photo:true = the drawing the photo generator starts from (figurePng): the watch's face is its own photo (the owner's, else its
   product picture), turned as worn; the generator edits this drawing, so it starts from the real dial in the right place and size
   (from its references and words alone it drew a stock chronograph). With no photo the dial is left blank, not three drawn hands */
function figureSvg(o,prefix='fig-',{photo=false,face=null}={}){   // face: the watch photo's dial crop (dialCrop), given by figurePng
  let watch=null;
  if(o.watch){const wo=watchOpts(o.watch),tones=METAL_TONES[o.watch.metal]||METAL_TONES.silver,dial=COLORS[wo.dial]||'#12151A';
    watch={metal:tones,dial,strap:wo.band!=='leather'?tones[1]:colOf(o.watch),marks:lum(dial)<.45?'#D9DEE6':'#1D2125',blank:photo,img:photo&&face||null}}
  return outfitFigureSvg({
    suit:figFabric(o.top||o.shirt,o.top?'top':'shirt'),shirt:figFabric(o.shirt,'shirt'),tie:figFabric(o.tie,'tie'),
    watch,clip:o.clip&&!o.vest?{color:colOf(o.clip)}:null,vest:!!(o.vest&&o.top),jacket:!!o.top,bg:figBg(),idPrefix:prefix,
    ariaLabel:`Torso wearing ${[o.top&&nm(o.top)+(o.vest?' with matching vest':''),o.shirt&&nm(o.shirt)+(o.top?'':', no jacket')+(o.tie?'':', open collar'),o.tie&&nm(o.tie)].filter(Boolean).join(', ')}`});
}
