/* Daily Wardrobe: SVG drawings (mannequin, accessories, thumbnails) */
/* Vector mannequin: resolution-independent SVG with procedural fabric patterns */
const mirror=d=>d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,(_,x,y)=>`${+(240-x).toFixed(2)},${y}`);

/* Pattern tile per garment role. Scale differs by role so a pinstripe suit and a striped shirt read correctly. */
function fabricDef(id,item,role){
  const b=colOf(item),a=accentOf(item),t3=thirdOf(item),c=t3||a,p=item.pattern||'solid',wool=role==='top'||role==='bot';
  const dk='#000',lt='#fff',ink=lum(b)>.5?'#000':'#fff';
  const twill=`<path d="M-2,2 L2,-2 M0,4 L4,0 M2,6 L6,2" stroke="${ink}" stroke-opacity="${wool?.07:.04}" stroke-width=".6"/>`;
  const tile=(w,h,body,tf='')=>`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"${tf?` patternTransform="${tf}"`:''}><rect width="${w}" height="${h}" fill="${b}"/>${body}</pattern>`;
  const fine=role==='shirt'||role==='tie';
  /* herringbone: columns of steep twill lines whose slant alternates, with a half-step break at each column edge */
  const herringboneTile=(cw,lineDeg,tf)=>{
    const t=Math.tan(lineDeg*Math.PI/180),sv=+(cw*.55).toFixed(3),W=2*cw,kmax=Math.ceil(t*cw/sv)+2;
    const fam=(dir,off)=>{let d='';for(let k=-kmax;k<=kmax;k++){const y0=k*sv+off;d+=dir>0?`M0,${(y0+t*cw).toFixed(3)} L${cw},${y0.toFixed(3)} `:`M0,${y0.toFixed(3)} L${cw},${(y0+t*cw).toFixed(3)} `}return d};
    const col=(dir,off)=>`<path d="${fam(dir,off)}" stroke="${lt}" stroke-opacity=".17" stroke-width="${(sv*.38).toFixed(3)}"/><path d="${fam(dir,off+sv/2)}" stroke="${dk}" stroke-opacity=".2" stroke-width="${(sv*.3).toFixed(3)}"/>`;
    return tile(W,sv,`<svg width="${cw}" height="${sv}" overflow="hidden">${col(1,0)}</svg><svg x="${cw}" width="${cw}" height="${sv}" overflow="hidden">${col(-1,sv/2)}</svg><rect x="${(cw-.12).toFixed(3)}" width=".24" height="${sv}" fill="${dk}" opacity=".16"/><rect x="${(W-.12).toFixed(3)}" width=".24" height="${sv}" fill="${dk}" opacity=".16"/>`,tf);
  };
  /* layouts read from the item's photo take precedence over the generic tiles.
     Ties keep the photographed angle; garments snap to vertical/horizontal. */
  const st=item.stripes,col={p:b,s:a,t:c},angOf=x=>role==='tie'?x:Math.round(x/90)*90,rot=x=>{const r=angOf(x);return r?`rotate(${r})`:''};
  const bandRects=(bands,T,H,vertical,skipP)=>{let x=0;return bands.map(([r,f])=>{const w=f*T,x0=x;x+=w;if(skipP&&r==='p')return '';
    return vertical?`<rect x="${x0.toFixed(3)}" width="${(w+.05).toFixed(3)}" height="${H}" fill="${col[r]||b}"${skipP?' opacity=".55"':''}/>`:`<rect y="${x0.toFixed(3)}" height="${(w+.05).toFixed(3)}" width="${H}" fill="${col[r]||b}"/>`}).join('')};
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
      return tile(8,8,`<rect width="4" height="4" fill="${a}"/><svg x="4" y="0" width="4" height="4">${st}</svg><svg x="0" y="4" width="4" height="4">${st}</svg>`,fine?'scale(.6)':'scale(.85)');
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

/* ---------- accessory drawings, shared by the mannequin and the wardrobe thumbnails ----------
   Every function takes an id prefix P so several drawings can live on one page without id clashes. */

/* leather surface: base colour, grain texture and a highlight whose strength depends on the leather */
function leatherLayers(P,item,d,toe){
  const L=item&&item.leather||'calf',base=item?colOf(item):'#2b2b2e';
  const col=L==='suede'?mix(base,'#fff',.07):L==='cordovan'?mix(base,'#1e0808',.15):base;
  const hi={calf:.32,cordovan:.42,patent:.9,suede:0,'pebble-grain':.12,'scotch-grain':.2}[L]??.32;
  let defs=`<radialGradient id="${P}hl" gradientUnits="userSpaceOnUse" cx="${toe.x}" cy="${toe.y}" r="${toe.r*(L==='patent'?.7:1)}"><stop offset="0" stop-color="${L==='cordovan'?'#fff3ec':'#fff'}" stop-opacity="${hi}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  let tex='',extra='';
  if(L==='suede'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="1.5" height="1.5"><circle cx=".4" cy=".5" r=".36" fill="#000" opacity=".18"/><circle cx="1.15" cy="1.1" r=".3" fill="#fff" opacity=".12"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  if(L==='pebble-grain'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="2.2" height="1.9"><circle cx=".6" cy=".55" r=".55" fill="#fff" fill-opacity=".06" stroke="#000" stroke-opacity=".3" stroke-width=".22"/><circle cx="1.7" cy="1.45" r=".5" fill="#fff" fill-opacity=".06" stroke="#000" stroke-opacity=".3" stroke-width=".22"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  if(L==='scotch-grain'){defs+=`<pattern id="${P}tx" patternUnits="userSpaceOnUse" width="1.2" height="1.1"><circle cx=".35" cy=".3" r=".3" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".16"/><circle cx=".95" cy=".85" r=".26" fill="#fff" fill-opacity=".1"/></pattern>`;tex=`<path d="${d}" fill="url(#${P}tx)"/>`}
  if(L==='patent')extra=`<ellipse cx="${toe.x}" cy="${toe.y-toe.r*.18}" rx="${toe.r*.55}" ry="${toe.r*.09}" transform="rotate(${toe.rot||0} ${toe.x} ${toe.y})" fill="#fff" opacity=".75"/>`;
  if(L==='cordovan')extra=`<ellipse cx="${toe.x}" cy="${toe.y-toe.r*.15}" rx="${toe.r*.4}" ry="${toe.r*.12}" transform="rotate(${toe.rot||0} ${toe.x} ${toe.y})" fill="#fff" opacity=".3"/>`;
  return {defs,body:`<path d="${d}" fill="${col}" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>${tex}<path d="${d}" fill="url(#${P}hl)"/>${extra}`,sole:mix(base,'#000',.6)};
}

/* cap-toe oxford, front three-quarter view (left foot, toe turned out); the trouser hem covers the top */
function drawOxfordFront(item,P){
  const U='M86,545 L118,545 L119,560 C119,566 116,568 110,568 L73,568 C65,568 62,563.5 65,558.5 C68,553.5 76,550 86,548.5 Z';
  const lay=leatherLayers(P,item,U,{x:77,y:557,r:14,rot:-10}),lace=item?mix(colOf(item),'#000',.45):'#111';
  return `<defs>${lay.defs}</defs><path d="${U}" transform="translate(0,2.6)" fill="${lay.sole}"/>${lay.body}`+
    `<path d="M118.6,565.8 C117,567.4 114,567.6 110,567.6 L73,567.6 C67,567.6 63.8,564.4 64.8,560.4" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".35" stroke-dasharray=".7 .5"/>`+
    `<path d="M80,550.2 C75.5,554 75,562 79.3,567.6" fill="none" stroke="#000" stroke-opacity=".4" stroke-width=".6"/>`+
    `<path d="M81.5,549.8 C77,553.8 76.5,562 80.8,567.6" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".35" stroke-dasharray=".7 .5"/>`+
    `<path d="M95.5,553.5 L100.5,559.4 L105.5,553.5" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".55"/>`+
    `<path d="M97.2,555.4 L103.8,555.4 M98.7,557.2 L102.3,557.2" stroke="${lace}" stroke-width=".65"/>`;
}

/* cap-toe oxford in side profile (toe left), for wardrobe thumbnails; box 0..100 x 0..50 */
function drawOxfordSide(item,P){
  const U='M5,39 C2,34 4,30 12,28.5 C24,26.5 34,23 41,18 C45,15 48,13 52,12.5 L83,11 C90,10.8 94.5,14 95,21 L95,39 Z';
  const lay=leatherLayers(P,item,U,{x:16,y:31,r:16,rot:-12}),lace=item?mix(colOf(item),'#000',.45):'#111';
  let eyelets='';for(let k=0;k<5;k++){const x=53+k*2.6,y=13.4-k*.12;eyelets+=`<circle cx="${x}" cy="${y+1.4}" r=".55" fill="#000" opacity=".55"/>`}
  return `<defs>${lay.defs}</defs>`+
    `<path d="M4,39 C4,43.5 6.5,45.5 12,45.5 L58,45.5 C64,43 70,43 74,45.5 L94,45.5 L95.5,39 Z" fill="${lay.sole}"/>${lay.body}`+
    `<path d="M6,39.6 L94,39.6" stroke="#fff" stroke-opacity=".22" stroke-width=".35" stroke-dasharray=".8 .6"/>`+
    `<path d="M21,27.3 C19,31 19,36 21,39" fill="none" stroke="#000" stroke-opacity=".4" stroke-width=".6"/>`+
    `<path d="M22.6,27 C20.6,31 20.6,36 22.6,39" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".35" stroke-dasharray=".7 .5"/>`+
    `<path d="M47,15.4 C50,24 56,32 62,39" fill="none" stroke="#000" stroke-opacity=".38" stroke-width=".6"/>`+
    `<path d="M84,11 C82,22 83,32 86,39" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".5"/>`+
    `<path d="M52,12.6 L83,11.1" stroke="#000" stroke-opacity=".5" stroke-width=".7"/>`+eyelets+
    `<path d="M53.5,14.2 L56,15.6 M56,14.1 L58.6,15.5 M58.6,14 L61.2,15.4 M61.2,13.8 L63.8,15.2" stroke="${lace}" stroke-width=".55"/>`;
}

/* dress sock, side view: welt, ribbed leg, reinforced heel and toe; box ~0..40 x 0..70 */
function drawSock(color,P){
  const d='M4,0 L20,0 L20,44 C20,50 23,53 29,55 L33,56.5 C39.5,58.5 40.5,68 32,69 L11,69 C3,69 1,63 4,56 Z';
  const ink=lum(color)>.55?'#000':'#fff';let ribs='';for(let x=6;x<19;x+=1.6)ribs+=`M${x.toFixed(1)},7 L${x.toFixed(1)},46 `;
  return `<defs><linearGradient id="${P}sh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".4" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>`+
    ``+
    `<path d="${d}" fill="${color}" stroke="#000" stroke-opacity=".3" stroke-width=".5"/>`+
    `<path d="${ribs}" stroke="${ink}" stroke-opacity=".13" stroke-width=".5"/>`+
    `<path d="M4,0 L20,0 L20,6 L4,6 Z" fill="#000" opacity=".1"/><path d="M4,6 L20,6" stroke="${ink}" stroke-opacity=".2" stroke-width=".5"/>`+
    `<path d="M4,53 C1.5,61 4,68.5 11,69 L14,69 C9.5,66 8.5,59 9.6,53 Z" fill="#000" opacity=".14"/>`+
    `<path d="M33,56.5 C39.5,58.5 40.5,68 32,69 L29,69 C33.5,66 33.5,59 30,55.6 Z" fill="#000" opacity=".14"/>`+
    `<path d="${d}" fill="url(#${P}sh)"/>`;
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
  if(o.band==='bracelet'){
    // three-piece links: brushed outer links, polished centre link
    for(const sg of [-1,1])for(let k=0;k<6;k++){
      const wd=16.6-k*.45,h=4.9,y=sg>0?17.3+k*5.3:-17.3-k*5.3-h,ow=wd*.36,cw=wd*.25,g=.35;
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
  for(let y=-1.8;y<=1.81;y+=.6)s+=`<line x1="15.4" x2="18.1" y1="${f(y)}" y2="${f(y)}" stroke="${mD}" stroke-width=".14"/>`;
  s+=`<circle r="15.4" fill="url(#${P}cs)" stroke="${mD}" stroke-width=".3"/>`;
  if(o.bezel==='fluted'){for(let i=0;i<96;i++){const a=i/96*Math.PI*2,c=Math.cos(a),n=Math.sin(a),lit=(Math.cos(a+2.4)+1)/2;
    s+=`<line x1="${f(12.95*c)}" y1="${f(12.95*n)}" x2="${f(15.15*c)}" y2="${f(15.15*n)}" stroke="${i%2?mD:mix(mM,'#fff',lit*.8)}" stroke-width=".7"/>`}}
  else s+=`<circle r="14.05" fill="none" stroke="url(#${P}po)" stroke-width="2.1"/>`;
  s+=`<circle r="12.9" fill="none" stroke="${mD}" stroke-width=".3"/><circle r="12.75" fill="url(#${P}dl)"/>`;
  for(let i=0;i<60;i++)if(i%5)s+=`<g transform="rotate(${i*6})"><line y1="-12.1" y2="-12.55" stroke="${ink}" stroke-opacity=".4" stroke-width=".14"/></g>`;
  if(o.style==='annual-calendar'){
    // month apertures next to each hour marker (January at 1 o'clock); the current month shows red
    for(let m=0;m<12;m++)s+=`<g transform="rotate(${(m+1)*30})"><rect x="-.75" y="-12.1" width="1.5" height="1" rx=".15" fill="${m===now.getMonth()?'#c8102e':mix(dial,'#000',.1)}" stroke="${ink}" stroke-opacity=".35" stroke-width=".1"/></g>`;
  }
  for(let h=0;h<12;h++){if(h===3&&o.style!=='no-date')continue;
    const bar=x=>`<rect x="${x}" y="-10.6" width=".95" height="2.4" rx=".2" fill="url(#${P}po)" stroke="${mD}" stroke-width=".12"/>`;
    s+=`<g transform="rotate(${h*30})">${h===0?bar(-1.3)+bar(.35):bar(-.48)}</g>`}
  if(o.style==='annual-calendar'){
    // off-centre 24-hour disc with a red pointer
    s+=`<circle cy="4.7" r="3.9" fill="${mix(dial,'#000',.05)}" stroke="${ink}" stroke-opacity=".35" stroke-width=".15"/>`;
    for(let i=0;i<24;i++)s+=`<g transform="translate(0 4.7) rotate(${i*15})"><line y1="-3.3" y2="${i%2?-3.6:-3.8}" stroke="${ink}" stroke-opacity=".55" stroke-width=".12"/></g>`;
    s+=`<path d="M-.65,.45 L.65,.45 L0,1.45 Z" fill="#c8102e"/>`;
  }
  if(o.style!=='no-date')s+=`<rect x="7.3" y="-1.6" width="3.7" height="3.2" fill="#fff" stroke="${ink}" stroke-opacity=".4" stroke-width=".12"/><text x="9.15" y=".98" font-size="2.7" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#111">${now.getDate()}</text><rect x="6.5" y="-2.5" width="5.3" height="5" rx="1.1" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".7" stroke-width=".2"/>`;
  const hand=(deg,len,wid,tail)=>`<g transform="rotate(${deg})"><path d="M${-wid/2},${tail} L${-wid/2},${f(-len+wid)} L0,${-len} L${wid/2},${f(-len+wid)} L${wid/2},${tail} Z" fill="url(#${P}po)" stroke="${mD}" stroke-width=".16"/><rect x="${f(-wid*.22)}" y="${f(-len+wid*1.7)}" width="${f(wid*.44)}" height="${f(len*.55)}" fill="#f5f7ef"/></g>`;
  s+=hand(305,6.6,1.3,1.4)+hand(60,10.6,1.05,1.6);
  s+=`<g transform="rotate(210)"><line y1="2.8" y2="-11.6" stroke="${mD}" stroke-width=".22"/></g><circle r=".8" fill="url(#${P}po)" stroke="${mD}" stroke-width=".12"/>`;
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

/* small colour swatch for the item list: drawn from the tagged colours and pattern (like the mannequin), never cropped
   from the photo, so it always matches the outfit and isn't tinted by the photo's lighting */
let swN=0;
function swatchSVG(i){
  const P='sw'+(swN++)+'-';let body;
  if(FABRIC.includes(i.type)){const role=i.type==='tie'?'tie':i.type==='shirt'?'shirt':i.type==='pants'?'bot':'top';
    body=`<defs>${fabricDef(P+'f',i,role)}<linearGradient id="${P}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs><rect width="16" height="16" fill="url(#${P}f)"/><rect width="16" height="16" fill="url(#${P}g)"/>`}
  else{const metal=(i.type==='watch'&&watchOpts(i).band==='bracelet')||i.type==='cufflinks'||i.type==='tieclip';
    const [mL,mM,mD]=METAL_TONES[i.metal]||METAL_TONES.silver,c=metal?mM:colOf(i);
    body=`<defs><linearGradient id="${P}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${metal?.45:.15}"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs><rect width="16" height="16" fill="${c}"/><rect width="16" height="16" fill="url(#${P}g)"/>`}
  return `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

/* square thumbnail for items saved without a photo (also used as the live preview while adding one) */
let thumbN=0;
function itemThumb(i){
  const P='th'+(thumbN++)+'-';let g='';
  if(FABRIC.includes(i.type)){
    const role=i.type==='tie'?'tie':i.type==='shirt'?'shirt':i.type==='pants'?'bot':'top';
    const shape=i.type==='tie'?'M42,8 L58,8 L55,22 L62,78 L50,92 L38,78 L45,22 Z':'M10,10 H90 V90 H10 Z';
    g=`<defs>${fabricDef(P+'f',i,role)}<linearGradient id="${P}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs><path d="${shape}" fill="url(#${P}f)" stroke="#000" stroke-opacity=".25" stroke-width=".6"/><path d="${shape}" fill="url(#${P}s)"/>`;
  }else if(i.type==='watch')g=`<g transform="translate(48 50) scale(.95)">${drawWatch(i,P)}</g>`;
  else if(i.type==='shoes')g=`<g transform="translate(2 22)">${drawOxfordSide(i,P)}</g>`;
  else if(i.type==='socks')g=`<g transform="translate(28 13) scale(1.05)">${drawSock(colOf(i),P)}</g>`;
  else if(i.type==='belt')g=`<g transform="translate(50 50) scale(1.42)">${drawBelt(i,P)}</g>`;
  else if(i.type==='overcoat'||i.type==='raincoat'){const c=colOf(i),e=mix(c,'#000',.35),rain=i.type==='raincoat';
    g=`<path d="M38,14 L50,20 L62,14 L78,22 L84,90 L16,90 L22,22 Z" fill="${c}" stroke="${e}" stroke-width=".8"/><path d="M38,14 L50,40 L62,14" fill="none" stroke="${e}" stroke-width=".8"/>`+
      `<path d="M50,40 L50,90" stroke="${e}" stroke-width=".8"/>${rain?`<path d="M18,52 L82,52" stroke="${e}" stroke-width="2.4"/><rect x="45" y="49" width="10" height="6" rx="1" fill="none" stroke="${METAL.silver}" stroke-width="1.2"/>`:''}`+
      [46,58,70].map(y=>`<circle cx="45" cy="${y}" r="1.4" fill="${e}"/><circle cx="55" cy="${y}" r="1.4" fill="${e}"/>`).join('')}
  else if(i.type==='cufflinks'){const [mL,mM,mD]=METAL_TONES[i.metal]||METAL_TONES.silver;
    g=[32,68].map(x=>`<circle cx="${x}" cy="50" r="12" fill="${mM}" stroke="${mD}" stroke-width="1.2"/><circle cx="${x-3}" cy="47" r="4" fill="${mL}"/><circle cx="${x}" cy="50" r="7.5" fill="none" stroke="${mD}" stroke-width=".6"/>`).join('')}
  else if(i.type==='tieclip'){const m=METAL[i.metal]||METAL.other;g=`<rect x="12" y="45" width="76" height="9" rx="3" fill="${m}" stroke="#000" stroke-opacity=".3"/><rect x="14" y="47" width="72" height="2" rx="1" fill="#fff" opacity=".45"/>`}
  else g=`<rect x="10" y="10" width="80" height="80" rx="8" fill="${colOf(i)}"/>`;
  return `<div class="ph thumb"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${TYPES[i.type]||'Item'}">${g}</svg></div>`;
}

function renderMannequinCanvas(o, containerEl){
  const FORM='#dcd6cb';
  const defs=[],fill={};
  for(const [role,item] of [['top',o.top],['bot',o.bot],['shirt',o.shirt],['tie',o.tie]]){
    if(!item)continue;
    defs.push(fabricDef('fab-'+role,item,role));fill[role]=`url(#fab-${role})`;
  }
  if(o.coat){defs.push(fabricDef('fab-coat',o.coat,'top'));fill.coat='url(#fab-coat)'}
  const F=r=>fill[r]||(r==='shirt'?'#f4f3ee':FORM);
  const shade='url(#shade)',seam='stroke="#000" stroke-opacity=".28" stroke-width=".8" stroke-linejoin="round"';
  const both=d=>d+' '+mirror(d);
  const part=(d,f,extra='')=>`<path d="${d}" fill="${f}" ${seam} ${extra}/><path d="${d}" fill="${shade}" pointer-events="none"/>`;

  /* geometry (viewBox 240x600, figure centred on x=120) */
  const torso='M106,90 C92,93 76,98 63,105 C58,140 64,190 75,240 C79,270 78,300 76,336 L164,336 C162,300 161,270 165,240 C176,190 182,140 177,105 C164,98 148,93 134,90 Z';
  const sleeveL='M63,105 C53,109 49,122 47,142 L41,312 L67,316 L74,172 C77,142 75,118 63,105 Z';
  const legL='M79,302 L120,302 L118,553 Q102,557.5 86,553 Z'; // hem breaks slightly over the shoe
  const cuffL='M41,307 L67,311 L66,323 L41,319 Z';
  const lapelL='M108,92 L120,228 C108,206 97,178 89,150 L86,124 L96,121 L93,112 L103,97 Z';
  const collarL='M120,97 L109,84 L103,89 L110,116 Z';
  const vee='M106,90 L134,90 L120,230 Z';
  /* ghost mannequin: no head or hands; show the inside back of the collar and dark sleeve openings instead */
  const neckBack=()=>`<path d="M104,91 C106,79 134,79 136,91 L133,92 C130,84 110,84 107,92 Z" fill="${F('shirt')}" ${seam}/><path d="M104,91 C106,79 134,79 136,91 L133,92 C130,84 110,84 107,92 Z" fill="#000" opacity=".12"/><ellipse cx="120" cy="90.5" rx="13" ry="4.2" fill="#1b1d21" opacity=".78"/>`;
  const opening=(cx,cy,rx,tilt)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="2.3" transform="rotate(${tilt} ${cx} ${cy})" fill="#1b1d21" opacity=".8"/>`;
  const hemGap='M120,298 C119,316 114,328 104,337 L136,337 C126,328 121,316 120,298 Z';

  let s=`<svg viewBox="-40 70 314 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Outfit preview"><defs>
  <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".32" stop-color="#fff" stop-opacity=".10"/>
    <stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
  <radialGradient id="shine" cx=".35" cy=".35" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <pattern id="silk" patternUnits="userSpaceOnUse" width="1.4" height="1.4" patternTransform="rotate(45)"><rect width=".7" height=".7" fill="#000" opacity=".16"/><rect x=".7" y=".7" width=".7" height=".7" fill="#fff" opacity=".07"/></pattern>
  ${defs.join('')}</defs>`;


  /* oxfords first, then the trousers resting on them with a slight break */
  s+=drawOxfordFront(o.shoes,'shL')+`<g transform="translate(240,0) scale(-1,1)">${drawOxfordFront(o.shoes,'shR')}</g>`;
  s+=part(both(legL),F('bot'));
  s+=`<path d="${both('M100,330 L102,548')}" stroke="#000" stroke-opacity=".22" stroke-width=".8" fill="none"/>`;
  s+=`<path d="${both('M101,330 L103,548')}" stroke="#fff" stroke-opacity=".12" stroke-width=".6" fill="none"/>`;
  /* floating accessories, positioned from the wearer's point of view:
     sock beside the right foot (viewer's left) with its toe pointing the same way as that shoe;
     watch beside the left wrist with the buckled belt just below it */
  if(o.socks)s+=`<g transform="translate(58,433) scale(-2,2)">${drawSock(colOf(o.socks),'sk-')}</g>`;
  if(o.belt)s+=`<g transform="translate(231,386)">${drawBelt(o.belt,'bt-')}</g>`; // just below the watch

  if(o.top){
    /* shirt cuffs under the sleeves */
    s+=part(both(cuffL),F('shirt'));
    s+=opening(53.5,321,12.4,9)+opening(186.5,321,12.4,-9);
    /* jacket body */
    s+=part(torso,F('top'));
    /* shirt V, tie, collar */
    s+=`<path d="${vee}" fill="${F('shirt')}"/><path d="${vee}" fill="url(#shade)" opacity=".5"/>`;
    s+=neckBack();
    s+=`<path d="M120,118 L120,230" stroke="#000" stroke-opacity=".15" stroke-width=".7"/>`;
  }else{
    /* no jacket: shirt is the outer layer */
    s+=part(both(sleeveL),F('shirt'));
    s+=opening(54,314,12.8,9)+opening(186,314,12.8,-9);
    s+=neckBack();
    // no jacket: the shirt is tucked in, so it stops at the waistband and the belt shows
    s+=`<clipPath id="tuck"><rect x="0" y="0" width="240" height="304"/></clipPath><g clip-path="url(#tuck)">${part(torso,F('shirt'))}</g>`;
    s+=`<path d="M120,112 L120,302" stroke="#000" stroke-opacity=".2" stroke-width="1"/>`;
    for(let y=140;y<300;y+=34)s+=`<circle cx="120" cy="${y}" r="1.6" fill="#fff" stroke="#000" stroke-opacity=".25" stroke-width=".4"/>`;
    if(o.belt){const bc=colOf(o.belt),[bL,bM,bD]=METAL_TONES[o.belt.metal]||METAL_TONES.silver;
      s+=`<path d="M78.6,298.4 L161.4,298.4 L161.2,305.6 L78.8,305.6 Z" fill="${bc}" ${seam}/><path d="M80,299.6 H160 M80,304.4 H160" stroke="${mix(bc,'#fff',.4)}" stroke-opacity=".5" stroke-width=".3" stroke-dasharray=".9 .6"/>`+
         `<path d="M78.6,298.4 L161.4,298.4 L161.2,305.6 L78.8,305.6 Z" fill="url(#shade)"/>`+
         `<defs>${buckleDefs('wb-',o.belt.metal)}</defs><rect x="114" y="297.4" width="11" height="9.2" rx="1.8" fill="none" stroke="${bD}" stroke-width="2"/><rect x="114" y="297.4" width="11" height="9.2" rx="1.8" fill="none" stroke="url(#wb-bm)" stroke-width="1.5"/><path d="M114.2,302 L121,302" stroke="url(#wb-bm)" stroke-width=".9"/>`;}
  }
  if(o.tie){
    const knot='M112,94 L128,94 L125,110 L115,110 Z';
    const blade='M115,110 L125,110 L130,212 L120,224 L110,212 Z';
    // with a jacket on, the tie is only visible through the V opening; clip it so the tip never pokes past the lapels
    s+=o.top?`<clipPath id="vee-clip"><path d="${vee}"/></clipPath><g clip-path="url(#vee-clip)">`:'<g>';
    s+=part(blade,F('tie'));s+=part(knot,F('tie'));
    s+=`<path d="${blade}" fill="url(#silk)"/><path d="${knot}" fill="url(#silk)"/>`;
    s+=`<path d="M119,111 C119,118 120,124 120,130" stroke="#000" stroke-opacity=".3" stroke-width=".8" fill="none"/>`;
    s+='</g>';
  }
  s+=part(both(collarL),F('shirt'));

  if(o.top){
    /* lapels, closure, hem opening */
    s+=part(both(lapelL),F('top'));
    s+=`<path d="${both('M109,98 C111,140 115,190 120,228')}" stroke="#fff" stroke-opacity=".18" stroke-width="1" fill="none"/>`;
    s+=`<path d="${hemGap}" fill="${F('bot')}"/>`;
    s+=`<path d="M120,228 L120,298 C119,316 114,328 104,337 M120,298 C121,316 126,328 136,337" stroke="#000" stroke-opacity=".38" stroke-width=".9" fill="none"/>`;
    /* pockets */
    s+=`<path d="${both('M80,286 L106,288 L106,296 L80,294 Z')}" fill="${F('top')}" ${seam}/>`;
    s+=`<path d="M138,160 L160,157 L160,161 L138,164 Z" fill="${F('top')}" ${seam}/>`;
    /* buttons */
    const btn=lum(colOf(o.top))>.5?'#3a3530':'#141414';
    for(const y of [242,276])s+=`<circle cx="122" cy="${y}" r="2.6" fill="${btn}"/><circle cx="121.4" cy="${y-.6}" r="1" fill="#fff" opacity=".18"/>`;
    /* sleeves last so they overlap the body */
    s+=part(both(sleeveL),F('top'));
    for(const x of [58,61,64])s+=`<circle cx="${x}" cy="${306-(x-58)*.2}" r="1.1" fill="${btn}"/><circle cx="${240-x}" cy="${306-(x-58)*.2}" r="1.1" fill="${btn}"/>`;
  }

  /* coat worn open over the outfit: covers the shoulders, sleeves and sides, leaves the suit, shirt and tie visible */
  if(o.coat){
    const c=colOf(o.coat),edge=mix(c,'#000',.4),lining=mix(c,'#000',.5),rain=o.coat.type==='raincoat';
    const panelL='M97,91 C86,94 70,98 55,105 C49,150 52,220 56,300 L60,448 L88,452 L86,300 C85,230 84,170 85,150 Z';
    const liningL='M97,91 L85,150 C84,170 85,230 86,300 L88,452 L83,452 L81,300 C80,230 80,170 81,152 L94,92 Z';
    const lapelL=rain?'M97,91 L85,150 L72,128 L74,112 L84,110 L82,100 Z':'M97,91 L85,150 L74,126 L77,112 L87,111 L85,101 Z';
    const sleeveC='M55,105 C45,109 40,122 38,142 L33,312 L66,317 L74,170 C76,142 70,118 55,105 Z';
    s+=`<g class="coat-layer" data-coat="${o.coat.type}">`;
    s+=part(both(panelL),F('coat'))+`<path d="${both(liningL)}" fill="${lining}" opacity=".85"/>`;
    s+=part(both(sleeveC),F('coat'))+part(both(lapelL),F('coat'));
    s+=`<path d="${both('M97,91 L85,150 C84,170 85,230 86,300 L88,452')}" fill="none" stroke="${edge}" stroke-width=".7"/>`;
    s+=`<path d="${both('M84,110 L74,112 M86,111 L77,112')}" stroke="${edge}" stroke-width=".6" fill="none"/>`;
    if(rain){
      // trench: epaulettes, storm flap, belt with a hanging end, double-breasted buttons
      s+=`<path d="${both('M62,104 L82,99 L83,103 L63,108 Z')}" fill="${F('coat')}" stroke="${edge}" stroke-width=".5"/>`;
      s+=`<path d="M57,110 L83,114 L82,150 L56,146 Z" fill="${F('coat')}" stroke="${edge}" stroke-width=".5"/><path d="M57,110 L83,114 L82,150 L56,146 Z" fill="url(#shade)" opacity=".6"/>`;
      s+=`<path d="${both('M55,276 L86,277 L86,285 L56,284 Z')}" fill="${F('coat')}" stroke="${edge}" stroke-width=".6"/>`;
      s+=`<path d="M64,284 L70,284 L72,338 L66,340 Z" fill="${F('coat')}" stroke="${edge}" stroke-width=".5"/>`;
      s+=`<rect x="167" y="275.5" width="8" height="10" rx="1" fill="none" stroke="${mix(c,'#000',.55)}" stroke-width="1.1"/>`;
      for(const y of [190,230,320,360])s+=`<circle cx="78" cy="${y}" r="1.6" fill="${edge}"/><circle cx="162" cy="${y}" r="1.6" fill="${edge}"/>`;
    }else{
      // overcoat: single-breasted, buttons on one front, pocket flaps
      for(const y of [200,250,300,350])s+=`<circle cx="79" cy="${y}" r="1.8" fill="${edge}"/>`;
      s+=`<path d="${both('M60,330 L84,332 L84,338 L60,336 Z')}" fill="${F('coat')}" stroke="${edge}" stroke-width=".5"/>`;
    }
    s+='</g>';
  }
  /* accessories */
  if(o.links){const [mL,mM,mD]=METAL_TONES[o.links.metal]||METAL_TONES.silver,y=o.top?317:310;
    for(const x of [44.5,195.5])s+=`<circle cx="${x}" cy="${y}" r="2.4" fill="${mM}" stroke="${mD}" stroke-width=".5"/><circle cx="${x-.7}" cy="${y-.7}" r=".8" fill="${mL}"/>`}
  if(o.watch)s+=`<g transform="translate(231,318) scale(.8)">${drawWatch(o.watch,'wt-')}</g>`;
  if(o.clip&&o.tie){const m=METAL[o.clip.metal]||METAL.other;s+=`<rect x="111" y="170" width="18" height="2.4" rx="1" fill="${m}" stroke="#000" stroke-opacity=".3" stroke-width=".4"/>`}

  containerEl.innerHTML=s+'</svg>';
}


/* ---------- torso figure (figure.js), worn with the app's tagged-colour fabrics ----------
   The figure is drawn in a 390x400 box, about 2.7x the mannequin's scale; these factors size each weave so a
   pinstripe suit shows ~25 stripes across the body and a polka-dot tie 3-4 dots across. */
const FIG_SCALE={top:1.6,shirt:1.7,tie:1.5};
function figFabric(item,role){
  if(!item)return null;const k=FIG_SCALE[role];
  return {def:(id,rot)=>{let p=fabricDef(id,item,role);const m=p.match(/ patternTransform="([^"]*)"/),tf=m?m[1]:'';if(m)p=p.replace(m[0],'');
    return p.replace('patternUnits="userSpaceOnUse"',`patternUnits="userSpaceOnUse" patternTransform="${rot?`rotate(${rot}) `:''}scale(${k})${tf?' '+tf:''}"`)}};
}
const figBg=()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();return /^#[0-9a-f]{3,8}$/i.test(v)?v:'#e8ebec'};
function figureSvg(o,prefix='fig-'){
  let watch=null;
  if(o.watch){const wo=watchOpts(o.watch),tones=METAL_TONES[o.watch.metal]||METAL_TONES.silver,dial=COLORS[wo.dial]||'#12151A';
    watch={metal:tones,dial,strap:wo.band==='bracelet'?tones[1]:colOf(o.watch),marks:lum(dial)<.45?'#D9DEE6':'#1D2125'}}
  return outfitFigureSvg({
    suit:figFabric(o.top||o.shirt,o.top?'top':'shirt'),shirt:figFabric(o.shirt,'shirt'),tie:figFabric(o.tie,'tie'),
    watch,clip:o.clip?{color:METAL[o.clip.metal]||METAL.other}:null,bg:figBg(),idPrefix:prefix,
    ariaLabel:`Torso wearing ${[o.top&&nm(o.top),o.shirt&&nm(o.shirt),o.tie&&nm(o.tie)].filter(Boolean).join(', ')}`});
}
