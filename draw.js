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
    const Tv=T*(se.tex.aspect||N/M),f2=v=>+v.toFixed(3),[lo,hi]=texTones(b,se.tex,ctx==='fig'?.8:ctx==='dia'?2.5:ctx==='dot'?1.7:ctx==='asmtie'?TIE_TEX_K:1),url=texTileUrl(g,lo,hi);
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
function drawOxfordSide(item,P){
  const S=SHOE_OX,base=item?colOf(item):'#2b2b2e',L=item&&item.leather||'calf';
  const f=leatherLayers(P+'f',item,S.fout,{x:67.9,y:39.4,r:17,rot:-8,g:.5}),b=leatherLayers(P+'b',item,S.bout,{x:88,y:29.9,r:12,rot:-8,g:.5});
  const lace=item?mix(base,'#000',.45):'#111',laceHi=mix(lace,'#fff',lum(base)>.35?.15:.3),lin=mix('#a86a3e','#000',.18),linD=mix(lin,'#000',.35);
  const seam=d=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".42" stroke-width=".45"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".28" stroke-dasharray=".7 .5" transform="translate(.35 .3)"/>`;
  const shine=L==='suede'||L==='canvas'||L==='knit'?0:L==='patent'?.3:.13;
  return `<g transform="translate(0 2)"><defs>${b.defs}${f.defs}<clipPath id="${P}bc"><path d="${S.bout}"/></clipPath><clipPath id="${P}fc"><path d="${S.fout}"/></clipPath>`+
    `<linearGradient id="${P}ln" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lin}"/><stop offset="1" stop-color="${linD}"/></linearGradient><radialGradient id="${P}q" gradientUnits="userSpaceOnUse" cx="34" cy="22.5" r="12"><stop offset="0" stop-color="#fff" stop-opacity="${shine}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`+
    // the back shoe: leather, a little darker, its sole, lining, seams and laces, and the shadow the front shoe casts on it
    b.body+`<path d="${S.bout}" fill="#000" opacity=".14"/>`+
    `<g clip-path="url(#${P}bc)"><path d="${S.bsole}" fill="${b.sole}"/><path d="${S.bstitch}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".3" stroke-dasharray=".6 .5"/></g>`+
    `<path d="${S.bwelt}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".4"/>`+
    `<path d="${S.blin}" fill="url(#${P}ln)" stroke="${linD}" stroke-width=".35"/>`+seam(S.bfac)+seam(S.bqtr)+seam(S.bcap)+
    `<path d="${S.blace}" stroke="${lace}" stroke-width="1" stroke-linecap="round"/><path d="${S.blace}" stroke="${laceHi}" stroke-width=".3" stroke-linecap="round" transform="translate(0 -.25)"/>`+
    `<g clip-path="url(#${P}bc)"><path d="${S.fout}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2.6"/></g>`+
    // the front shoe
    f.body+`<path d="${S.fout}" fill="url(#${P}q)"/>`+
    `<g clip-path="url(#${P}fc)"><path d="${S.fsole}" fill="${f.sole}"/><path d="${S.fstitch}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".3" stroke-dasharray=".7 .5"/></g>`+
    `<path d="${S.fwelt}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".45"/><path d="${S.fheel}" fill="none" stroke="#000" stroke-opacity=".4" stroke-width=".4"/>`+
    `<path d="${S.flin}" fill="url(#${P}ln)" stroke="${linD}" stroke-width=".35"/>`+seam(S.fcnt)+seam(S.fqtr)+seam(S.ffac)+seam(S.fcap)+
    `<path d="${S.fslit}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width=".7"/>`+
    `<path d="${S.flace}" stroke="${lace}" stroke-width="1.05" stroke-linecap="round"/><path d="${S.flace}" stroke="${laceHi}" stroke-width=".32" stroke-linecap="round" transform="translate(0 -.27)"/></g>`;
}

/* the other shoe styles, in the same side profile and box as the oxford (toe left, sole on y≈39–45): each must read as what it is */
/* derby: open lacing (the quarters sewn on top of the vamp, their edge visible), a plain toe */
function drawDerbySide(item,P){
  const U='M5,39 C2,34 4,30 12,28.5 C24,26.5 34,23 41,18 C45,15 48,13 52,12.5 L83,11 C90,10.8 94.5,14 95,21 L95,39 Z';
  const lay=leatherLayers(P,item,U,{x:16,y:31,r:16,rot:-12}),lace=item?(lum(colOf(item))>.35?mix(colOf(item),'#000',.6):mix(colOf(item),'#fff',.55)):'#111',edge=item?mix(colOf(item),'#000',.5):'#000';
  let eyelets='';for(let k=0;k<4;k++){const x=56+k*3.2,y=13.6-k*.12;eyelets+=`<circle cx="${x}" cy="${y+1.4}" r=".6" fill="#000" opacity=".6"/>`}
  return `<defs>${lay.defs}</defs>`+
    `<path d="M4,39 C4,43.5 6.5,45.5 12,45.5 L58,45.5 C64,43 70,43 74,45.5 L94,45.5 L95.5,39 Z" fill="${lay.sole}"/>${lay.body}`+
    `<path d="M6,39.6 L94,39.6" stroke="#fff" stroke-opacity=".22" stroke-width=".35" stroke-dasharray=".8 .6"/>`+
    // the quarter's flap over the vamp, open at the front: its edge runs down and back to the heel seam
    `<path d="M53.5,12.6 C53,17 55,20.5 60,22.5 C66,25 72,27.5 77,31 C80,33.5 82,36 83,39" fill="none" stroke="${edge}" stroke-width=".9"/>`+
    `<path d="M54.6,13 C54.4,16.6 56.2,19.6 60.4,21.4" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".35" stroke-dasharray=".7 .5"/>`+
    `<path d="M52,12.6 L83,11.1" stroke="#000" stroke-opacity=".5" stroke-width=".7"/>`+eyelets+
    `<path d="M55,15.2 L59.6,14.2 M58.4,15.6 L62.8,14 M61.6,15.4 L66,13.8 M54.8,14.4 L66,14" stroke="${lace}" stroke-width=".55"/>`;
}
/* loafer: no laces, a low throat, a moccasin apron seam over the toe and a penny strap across the saddle */
function drawLoaferSide(item,P){
  const U='M5,39 C2,34 4,30 12,28.5 C24,26.5 34,23.5 41,20.5 C46,18.6 52,18.3 58,18.6 L84,17 C90,16.8 94.5,19 95,24 L95,39 Z';
  const lay=leatherLayers(P,item,U,{x:16,y:31,r:16,rot:-12}),edge=item?mix(colOf(item),'#000',.38):'#222',strap=item?mix(colOf(item),'#000',.12):'#333';
  return `<defs>${lay.defs}</defs>`+
    `<path d="M4,39 C4,43.5 6.5,45.5 12,45.5 L58,45.5 C64,43 70,43 74,45.5 L94,45.5 L95.5,39 Z" fill="${lay.sole}"/>${lay.body}`+
    `<path d="M6,39.6 L94,39.6" stroke="#fff" stroke-opacity=".22" stroke-width=".35" stroke-dasharray=".8 .6"/>`+
    // the apron: a raised seam from the toe round to the throat
    `<path d="M14,29 C22,24.6 32,22 42,21 C47,20.6 51,20.5 55,20.6" fill="none" stroke="${edge}" stroke-width=".8"/>`+
    `<path d="M14.6,30.4 C22.6,26 32.6,23.4 42.4,22.4" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".35" stroke-dasharray=".6 .5"/>`+
    // the penny strap with its slot, and the throat's dark opening
    `<path d="M50,21.2 C56,20.4 64,20.2 72,21.4 L72,25.6 C64,24.4 56,24.6 50,25.4 Z" fill="${strap}" stroke="${edge}" stroke-width=".6"/>`+
    `<path d="M57,22.4 C59.6,22 62.4,22 65,22.4" stroke="#000" stroke-opacity=".7" stroke-width="1.1" stroke-linecap="round"/>`+
    `<path d="M58,18.6 L84,17" stroke="#000" stroke-opacity=".55" stroke-width=".8"/>`;
}
/* chelsea boot: the shaft up above the ankle, an elastic gusset at the side, a pull tab at the back */
function drawBootSide(item,P){
  const U='M5,39 C2,34 4,30 12,28.5 C24,26.5 33,23.5 40,19 C44,16 46.5,10 47.5,3 L84,3 C85,10 88.5,15 95,20 L95,39 Z';
  const lay=leatherLayers(P,item,U,{x:16,y:31,r:16,rot:-12}),c=item?colOf(item):'#3a2a20',gus=mix(c,'#000',.55),edge=mix(c,'#000',.35);
  let ribs='';for(let k=0;k<6;k++){const x=63+k*1.7;ribs+=`<path d="M${x},${5+k*.2} L${x+.6},${24-k*.1}" stroke="#000" stroke-opacity=".35" stroke-width=".35"/>`}
  return `<defs>${lay.defs}</defs>`+
    `<path d="M4,39 C4,43.5 6.5,45.5 12,45.5 L58,45.5 C64,43 70,43 74,45.5 L94,45.5 L95.5,39 Z" fill="${lay.sole}"/>${lay.body}`+
    `<path d="M6,39.6 L94,39.6" stroke="#fff" stroke-opacity=".22" stroke-width=".35" stroke-dasharray=".8 .6"/>`+
    `<path d="M61,4 C61,12 62,20 66,26 L72,26 C75,20 76,12 76,4 Z" fill="${gus}"/>`+ribs+
    `<path d="M61,4 C61,12 62,20 66,26 L72,26 C75,20 76,12 76,4" fill="none" stroke="${edge}" stroke-width=".6"/>`+
    `<path d="M80,3 L80,-3 C80,-4.2 82.6,-4.2 82.6,-3 L82.6,3" fill="${edge}" stroke="#000" stroke-opacity=".35" stroke-width=".4"/>`+
    `<path d="M47.5,3 L84,3" stroke="#000" stroke-opacity=".5" stroke-width=".8"/>`;
}
/* sneaker: a thick rubber cupsole (its second colour, else white) with a toe bumper, a rounded toe, a padded collar that rises at
   the ankle with the tongue standing above the laces, a lace panel with wide laces crossing it, a side stripe and a heel tab */
function drawSneakerSide(item,P){
  const U='M8,35.5 C4.5,33 5,26.5 13,25 C22,23.4 30,21 37,17 C41,14.8 44,13.2 47.5,12.6 L70,12.6 C73,10.6 77,9.2 81,9.2 C86,9.2 90.5,10.6 92.5,14 C94.2,18 94.6,26 94.2,35.5 Z';
  const lay=leatherLayers(P,item,U,{x:17,y:30,r:15,rot:-10}),c=item?colOf(item):'#eee',lt=lum(c)>.6;
  const sc=item&&item.secondaryColor&&item.secondaryColor!=='none'&&COLORS[item.secondaryColor]?COLORS[item.secondaryColor]:'#f4f2ec',se=mix(sc,'#000',.28);
  const edge=mix(c,'#000',lt?.28:.45),panel=mix(c,lt?'#000':'#fff',lt?.06:.1),lace=lt?mix(c,'#000',.55):mix(c,'#fff',.82),stripe=lt?mix(c,'#000',.18):mix(c,'#fff',.22);
  let laces='';for(let k=0;k<5;k++){const x=50+k*4.1;laces+=`<path d="M${x},${15.4+k*.1} L${x+3.3},${12.8+k*.08}" stroke="${lace}" stroke-width="1.5" stroke-linecap="round"/><path d="M${x+.2},${12.9+k*.08} L${x+3.1},${15.3+k*.1}" stroke="${mix(lace,'#000',.25)}" stroke-width="1" stroke-linecap="round" opacity=".7"/>`}
  return `<defs>${lay.defs}</defs>`+
    // the cupsole: taller than a dress shoe's, rising round the toe; a line where the sidewall meets the outsole
    `<path d="M5.5,34 C2.5,36 3,43 7.5,45.5 C9,46.3 11,46.6 13,46.6 L91,46.6 C94.5,46.6 96,44.6 96,41.5 L95.6,34 Z" fill="${sc}" stroke="${se}" stroke-width=".6"/>`+
    `<path d="M4.6,42 C10,42.4 50,42.4 95.8,42" fill="none" stroke="${se}" stroke-width=".7"/>`+
    `<path d="M6,35.4 C7.5,32.6 11,31.6 16,31.8" fill="none" stroke="${se}" stroke-width=".6"/>`+lay.body+
    // the toe cap and the side stripe
    `<path d="M7.6,32 C9,28.2 13,26.4 19,25.6 C23,25.1 26,24.4 28.4,23.6" fill="none" stroke="${edge}" stroke-width=".8"/>`+
    `<path d="M40,31.5 C50,27 60,22.6 72,20.4 C74,22.4 74.4,24.8 73,27 C63,28.6 53,31.6 44,35.4 Z" fill="${stripe}" stroke="${edge}" stroke-width=".5"/>`+
    // the lace panel, the tongue standing above it, and the laces
    `<path d="M46,13 C48,12.5 68,12.4 71,12.6 C72.4,16 72.4,19 71,21.4 C64,20 54,20 47.6,21.6 C46,18.6 45.4,15.6 46,13 Z" fill="${panel}" stroke="${edge}" stroke-width=".6"/>`+
    `<path d="M66,12.8 C66.6,9.4 68.6,7.6 71.4,7.8 C73.4,8 74.2,9.8 73.6,12.4 Z" fill="${mix(c,'#000',.08)}" stroke="${edge}" stroke-width=".6"/>`+laces+
    // the padded collar and the heel tab
    `<path d="M73.6,12.2 C77,10.4 82,9.6 86.4,10 C89.4,10.4 91.6,11.8 92.4,14.2" fill="none" stroke="${edge}" stroke-width="1.1"/>`+
    `<path d="M90,10.6 C91.6,7.6 94.4,7.8 94.8,11.2 L94.6,16 L92.6,14 Z" fill="${edge}"/>`;
}/* the drawing for a pair of shoes, by its style (shoeStyle in core.js; none = oxford) */
const drawShoeSide=(item,P)=>({derby:drawDerbySide,loafer:drawLoaferSide,boot:drawBootSide,sneaker:drawSneakerSide})[shoeStyle(item)]?.(item,P)||drawOxfordSide(item,P);

/* dress sock, side view, traced from a catalogue photo of a fine merino dress sock: slanted cuff with a heathered welt,
   leg leaning back, heel pocket, foot pointing right, flat knitted toe cap (the sock's secondary colour); box ~0..60 x 0..72 */
const SOCK_D='M6.2,0 C10.2,0.4 25.5,2.4 29.7,2.9 C31,3.05 31.6,3.3 31.4,4.1 C31,5.5 29.6,9.3 28.9,11.6 C28.2,13.9 27.9,14.7 27.1,17.9 C26.3,21.2 24.4,28.2 23.8,31.1 C23.2,34 23.5,34.1 23.6,35.5 C23.7,36.8 23.9,38 24.3,39.2 C24.7,40.3 25,41.1 25.8,42.4 C26.6,43.7 27.7,45 29.2,46.8 C30.7,48.5 32.9,50.8 34.9,52.8 C36.9,54.7 39.7,57.3 41.2,58.6 C42.7,59.9 42.9,60 44,60.6 C45,61.3 45.4,61.8 47.5,62.6 C49.6,63.3 54.7,64.7 56.5,65.3 C58.2,65.9 57.6,65.7 58,66 C58.4,66.2 58.6,66.4 58.9,66.8 C59.2,67.2 59.6,68 59.7,68.5 C59.8,69 59.7,69.4 59.6,69.8 C59.4,70.2 59.3,70.4 58.9,70.7 C58.5,71 58,71.4 57.1,71.6 C56.1,71.9 56.8,72 53.3,72 C49.8,72 39.8,71.9 36,71.8 C32.3,71.6 32.1,71.4 31,71.1 C29.8,70.9 30.3,71.1 29.2,70.4 C28.2,69.6 26.2,67.5 24.7,66.4 C23.3,65.3 22.1,64.5 20.4,63.6 C18.8,62.8 17.4,62.1 14.7,61.1 C11.9,60.1 6.1,58.5 3.9,57.7 C1.8,56.9 2.4,57 1.9,56.6 C1.3,56.2 1,55.9 0.7,55.3 C0.4,54.7 0.1,53.8 0,52.9 C-0.1,52 0.1,51 0.3,50 C0.5,49 0.7,48.3 1.3,47 C1.8,45.6 2.9,43.9 3.6,42 C4.2,40 4.9,38.9 5.3,35.2 C5.7,31.6 6,24.8 6.1,20.3 C6.3,15.8 6.4,11.3 6.4,8 C6.3,4.7 5.9,1.8 5.9,0.5 C5.9,-0.2 6,0 6.2,0Z';
function drawSock(color,P,toe){
  const ink=lum(color)>.55?'#000':'#fff',welt=mix(color,'#fff',lum(color)>.55?.12:.42);let ribs='';
  // fine knit lines that follow the leg's lean: from the cuff (6,0)-(31,3.2) down to the ankle (4.6,40)-(24.2,36)
  for(let k=1;k<16;k++){const t=k/16,x1=6+25*t,y1=3.2*t,x2=4.6+19.6*t,y2=40-4*t;ribs+=`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} `}
  return `<defs><linearGradient id="${P}sh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="60" y2="12"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".3" stop-color="#fff" stop-opacity=".07"/><stop offset=".6" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`+
    `<clipPath id="${P}sk"><path d="${SOCK_D}"/></clipPath></defs>`+
    `<path d="${SOCK_D}" fill="${color}"/>`+
    `<g clip-path="url(#${P}sk)">`+
      `<path d="${ribs}" stroke="${ink}" stroke-opacity=".06" stroke-width=".3"/>`+
      // heathered welt along the slanted cuff
      `<path d="M4,-0.6 L33,2.6" stroke="${welt}" stroke-width="1.6"/><path d="M4,1.1 L33,4.3" stroke="${ink}" stroke-opacity=".12" stroke-width=".3"/>`+
      // heel pocket: a darker patch under the ankle seam, closed by the diagonal gusset line
      `<path d="M-1,42.9 L12.4,42.9 L12.9,47.6 L0.4,53.4 Z" fill="#000" opacity=".08"/>`+
      `<path d="M-1,42.9 L12.4,42.9 M12.9,47.6 L0.4,53.4" fill="none" stroke="#000" stroke-opacity=".14" stroke-width=".3"/>`+
      // sole: a soft shadow along the bottom of the foot
      `<path d="M1,55.5 C12,59.5 22,63.5 30,70.8 L58,71.8 L58,74 L-2,74 Z" fill="#000" opacity=".08"/>`+
      (toe?`<path class="sock-toe" d="M48.6,61.2 C47.3,64.5 46.5,68.2 46.3,73 L63,73 L63,60 Z" fill="${toe}"/>`+
        `<path d="M48.6,61.2 C47.3,64.5 46.5,68.2 46.3,73" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".35"/>`+
        `<path d="M50,73 C52,69 55,66.5 60,66" fill="none" stroke="#000" stroke-opacity=".1" stroke-width=".9"/>`:'')+
      `<path d="M-2,-2 L64,-2 L64,76 L-2,76 Z" fill="url(#${P}sh)"/>`+
    `</g>`+
    `<path d="${SOCK_D}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".5"/>`;
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

/* polished buckle metal: diagonal gradient in the buckle's metal (silver, gold or gunmetal) */
const buckleDefs=(P,metal)=>{const [mL,mM,mD]=METAL_TONES[metal]||METAL_TONES.silver;
  return `<linearGradient id="${P}bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mL}"/><stop offset=".35" stop-color="#fff"/><stop offset=".55" stop-color="${mM}"/><stop offset="1" stop-color="${mD}"/></linearGradient>`};

/* a buckled section of belt: buckle in the middle with a little leather either side, centred on 0,0 (about 62 x 20) */
function drawBelt(item,P){
  const c=item?colOf(item):'#3a2414',metal=item&&item.metal||'silver',[mL,mM,mD]=METAL_TONES[metal]||METAL_TONES.silver;
  const edge=mix(c,'#000',.45),st=mix(c,'#fff',.4);
  const strap='M-31,-4.6 Q0,-6.4 31,-4.6 L31,5.6 Q0,3.8 -31,5.6 Z';
  return `<defs>${buckleDefs(P,metal)}
    <linearGradient id="${P}sv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
    <linearGradient id="${P}sh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>`+
    ``+
    `<path d="${strap}" fill="${c}" stroke="${edge}" stroke-width=".5"/>`+
    `<path d="M-30,-2.9 Q0,-4.6 30,-2.9 M-30,3.9 Q0,2.2 30,3.9" fill="none" stroke="${st}" stroke-opacity=".6" stroke-width=".3" stroke-dasharray=".9 .6"/>`+
    `<ellipse cx="-17" cy=".2" rx=".9" ry="1.15" fill="${edge}"/><ellipse cx="-22" cy=".4" rx=".9" ry="1.15" fill="${edge}"/>`+
    `<path d="M11.6,-6.2 L15.2,-6.2 L15.2,6.6 L11.6,6.6 Z" fill="${mix(c,'#000',.15)}" stroke="${edge}" stroke-width=".45"/>`+
    `<path d="${strap}" fill="url(#${P}sv)"/><path d="${strap}" fill="url(#${P}sh)"/>`+
    // buckle frame, inner highlight and prong
    `<rect x="-8" y="-8.2" width="16" height="16.4" rx="3" fill="none" stroke="${mD}" stroke-width="3.1"/>`+
    `<rect x="-8" y="-8.2" width="16" height="16.4" rx="3" fill="none" stroke="url(#${P}bm)" stroke-width="2.4"/>`+
    `<rect x="-7.1" y="-7.3" width="14.2" height="14.6" rx="2.4" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".35"/>`+
    `<path d="M-8,.4 L3.2,.4" stroke="${mD}" stroke-width="1.5" stroke-linecap="round"/><path d="M-8,.1 L3,.1" stroke="url(#${P}bm)" stroke-width="1" stroke-linecap="round"/>`;
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
/* square thumbnail for items saved without a photo (also used as the live preview while adding one) */
let thumbN=0;
/* full: a fabric item drawn as a plain, edge-to-edge sample (no outline or shading), for comparing with its photo */
function itemThumb(i,full){
  const P='th'+(thumbN++)+'-';let g='';
  if(full&&FABRIC.includes(i.type)){const role=i.type==='tie'?'tie':i.type==='shirt'?'shirt':i.type==='pants'?'bot':'top';
    g=`<defs>${fabricDef(P+'f',i,role)}</defs><rect width="100" height="100" fill="url(#${P}f)"/>`}
  else if(FABRIC.includes(i.type)){
    const role=i.type==='tie'?'tie':i.type==='shirt'?'shirt':i.type==='pants'?'bot':'top';
    const shape=i.type==='tie'?'M42,8 L58,8 L55,22 L62,78 L50,92 L38,78 L45,22 Z':'M10,10 H90 V90 H10 Z';
    g=`<defs>${fabricDef(P+'f',i,role)}<linearGradient id="${P}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs><path d="${shape}" fill="url(#${P}f)" stroke="#000" stroke-opacity=".25" stroke-width=".6"/><path d="${shape}" fill="url(#${P}s)"/>`+trouserMarks(i,P);
  }else if(i.type==='watch')g=`<g transform="translate(48 50) scale(.95)">${drawWatch(i,P)}</g>`;
  else if(i.type==='shoes')g=`<g transform="translate(2 22)">${drawShoeSide(i,P)}</g>`;
  else if(i.type==='socks')g=`<g transform="translate(20 14)">${drawSock(colOf(i),P,sockToe(i)&&COLORS[sockToe(i)])}</g>`;
  else if(i.type==='belt')g=`<g transform="translate(50 50) scale(1.42)">${drawBelt(i,P)}</g>`;
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
