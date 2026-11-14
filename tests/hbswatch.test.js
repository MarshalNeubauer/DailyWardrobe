// Today's swatch of a herringbone shirt (2026-11-14, the owner's pick "D"): the painter's own cloth (asmCmTile), its colour held and every
// other column lighter, about 5 column pairs across, instead of the list dot's harsh drawing; other shirts are drawn as before.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const grid=['00011000','00100100','01000010','10000001'];
      const pink={id:'hp',type:'shirt',primaryColor:'pink',pattern:'herringbone',sett:{v:4,tex:{kind:'herringbone',grid,lighter:true,contrast:'medium',rel:.35,aspect:.6},a:0,cr:20,tr:80,src:'claude+pixels'}};
      const plainHb={id:'hq',type:'shirt',primaryColor:'lightblue',pattern:'herringbone'},dobby={id:'hd',type:'shirt',primaryColor:'white',pattern:'dobby'};
      const first=ovlPiece(pink),host=document.createElement('div');host.innerHTML=first;document.body.appendChild(host);   // the placeholder where it shows
      const e=OVL_HB.get(ovlHbKey(pink));await e.p;const swapped=host.innerHTML,then=ovlPiece(pink);host.remove();
      const im=await new Promise(res=>{const m=new Image();m.onload=()=>res(m);m.src=e.url});
      const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.drawImage(im,0,0,64,64);const d=x.getImageData(0,0,64,64).data,Y=[];let rr=0,gg=0,bb=0;
      for(let k=0;k<d.length;k+=4){Y.push(.2126*d[k]+.7152*d[k+1]+.0722*d[k+2]);rr+=d[k];gg+=d[k+1];bb+=d[k+2]}Y.sort((a,b)=>a-b);const n=Y.length;
      const drawn=swatchSVG(pink,true);
      const pq=ovlPiece(plainHb);await (OVL_HB.get(ovlHbKey(plainHb))||{}).p;
      return {placeholder:/data-hb=/.test(first)&&/<rect[^>]*fill=/.test(first),swapped:/^<img src="data:image\/png/.test(swapped),cached:then===`<img src="${e.url}" alt="">`,size:[im.naturalWidth,im.naturalHeight],
        p5:Y[Math.floor(n*.05)],p95:Y[Math.floor(n*.95)],pinkish:rr/n>gg/n+6&&bb/n>gg/n,drawnDark:/stroke-opacity="0\.[6-9]/.test(drawn),
        plainHb:/^<img/.test(ovlPiece(plainHb))||/data-hb=/.test(pq),dobby:!/data-hb=|^<img src="data:image\/png/.test(ovlPiece(dobby))}});
    ok(r.placeholder&&r.swapped&&r.cached,'a herringbone shirt\'s swatch shows a plain patch of its colour first, and the painted cloth replaces it where it shows; then it is kept');
    ok(r.size.join()==='512,512'&&r.pinkish,`it is a 512 px square in the shirt's own colour (pink) (${r.size})`);
    ok(r.p5>110&&r.p95-r.p5<70,`and soft: no charcoal lines (luminance 5th percentile ${r.p5.toFixed(0)}, spread ${(r.p95-r.p5).toFixed(0)}), where the drawn swatch's lines are ${r.drawnDark?'over 60% dark':'?'}`);
    ok(r.plainHb&&r.dobby,'every herringbone shirt takes it (also one never read); a dobby shirt is drawn as before');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it asks the colour-coded painter for its tile (asm-color.js)
