// Today's swatch of a twill suit or blazer (2026-11-14, the owner: "show the block of pattern the painter uses for the texture now, not the
// close up"): the colour-coded painter's own tile (asm-color.js asmCuTile), the whole block, in place of the close-up; a plain patch of
// the jacket's colour until it is made; near-black twill (which the painter doesn't take from the close-up) and a close-up with no clean
// patch keep the close-up, as before; a plain suit with a close-up is unchanged.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const CU='tests/fixtures/suit-mink-closeup.png',PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
      const sw='data:image/png;base64,SWATCH'+'x'.repeat(40);
      const tw={id:'tw1',type:'suit',primaryColor:'deeptaupe',pattern:'twill',texture:CU,swatch:sw,swSrc:'tex'};
      const first=ovlPiece(tw),host=document.createElement('div');host.innerHTML=first;document.body.appendChild(host);   // the placeholder where it shows
      const e=OVL_CU.get(ovlCuKey(tw));await e.p;const swapped=host.innerHTML,then=ovlPiece(tw);host.remove();
      const T=await asmCuTile(tw),im=await new Promise(res=>{const m=new Image();m.onload=()=>res(m);m.src=e.url});
      // the swatch's pixels are the painter's tile (sRGB of its linear values, under the swatches' faint light)
      const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
      const g=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);let diff=0,n=0;const mid=Math.floor(T.TW/2);
      for(let k=0;k<T.TW*T.TH;k++){const yy=Math.floor(k/T.TW),xx=k%T.TW;if(Math.abs(xx-mid)>20||Math.abs(yy-mid)>20)continue;diff+=Math.abs(d[4*k+1]-g(Math.min(1,T.t[3*k+1])));n++}
      const blackTw={id:'tw2',type:'suit',primaryColor:'black',pattern:'twill',texture:CU,swatch:sw,swSrc:'tex'};
      const noPatch={id:'tw3',type:'blazer',primaryColor:'brown',pattern:'twill',texture:PH,swatch:sw,swSrc:'tex'};
      const np0=ovlPiece(noPatch);await (OVL_CU.get(ovlCuKey(noPatch))||{}).p;
      const plain={id:'tw4',type:'suit',primaryColor:'deeptaupe',pattern:'solid',texture:CU,swatch:sw,swSrc:'tex'};
      return {placeholder:/data-hb=/.test(first)&&/<rect[^>]*fill=/.test(first),swapped:/^<img src="data:image\/png/.test(swapped)&&!swapped.includes(sw),cached:then===`<img src="${e.url}" alt="">`,
        size:[im.naturalWidth,im.naturalHeight],tile:[T.TW,T.TH],diff:diff/n,
        black:ovlPiece(blackTw).includes(sw),noPatch:/data-hb=/.test(np0)&&ovlPiece(noPatch).includes(sw),plain:ovlPiece(plain).includes(sw)}});
    ok(r.placeholder&&r.swapped&&r.cached,"a twill suit's swatch shows a plain patch of its colour first, then the painter's tile replaces it where it shows (not the close-up); then it is kept");
    ok(r.size.join()===r.tile.join()&&r.diff<4,`it is the painter's whole tile, ${r.size.join('x')} (mean difference from the tile ${r.diff.toFixed(1)} of 255, the swatches' faint light)`);
    ok(r.black,'a near-black twill keeps its close-up (the painter keeps its own weave for it)');
    ok(r.noPatch,'a close-up with no clean patch for the painter falls back to the close-up');
    ok(r.plain,'a plain suit with a close-up still shows the close-up');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it asks the colour-coded painter for its tile (asm-color.js)
