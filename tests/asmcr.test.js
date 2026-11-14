// A figured shirt's cloth as one whole repeat cut from its close-up (asm-color.js asmCr*, 2026-11-14): the repeat is found in a
// close-up shot at a slight angle, the tile is one cell that tiles with no seam, its ground the tagged colour and its figure the
// figure's own colour; a cloth with no sure repeat gives no tile (the strict confidence test), and herringbone, twill and end-on-end
// shirts are left to their own painters.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{
      // grey squares on white, every 30 x 24 px, the whole cloth turned 2 degrees, lit unevenly, a little noise
      const W=600,H=760,mk=(draw)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle='#e9e9e6';g.fillRect(0,0,W,H);draw(g);
        const im=g.getImageData(0,0,W,H);let s=5;const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=4*(y*W+x),l=(.8+.3*x/W)*(1+.06*(rnd()-.5));for(let q=0;q<3;q++)im.data[k+q]=Math.max(0,Math.min(255,im.data[k+q]*l))}
        g.putImageData(im,0,0);return c.toDataURL('image/png')};
      const fig=mk(g=>{g.translate(W/2,H/2);g.rotate(2*Math.PI/180);g.fillStyle='#6c6a72';for(let y=-20;y<=20;y++)for(let x=-14;x<=14;x++)g.fillRect(x*30-7,y*24-6,14,12)});
      const plain=mk(()=>{});
      const shirt=(pattern,texture,id)=>({id,type:'shirt',primaryColor:'white',pattern,texture}),A=shirt('dobby',fig,'crA'),T=await asmCrTile1(A),N=await asmCrTile1(shirt('dobby',plain,'crN')),NA=await asmCrTile1(shirt('dobby',plain,'crN2'),true);
      const lin=h=>hexRgb(h).map(v=>ASM_LIN[v]),base=lin(colOf(A)),n=T?T.TW*T.TH:0;let mx=0,mn=9,seam=0;
      for(let k=0;k<n;k++){const v=T.t[3*k+1];if(v>mx)mx=v;if(v<mn)mn=v}
      // no seam: the step from the last column to the first (and row) is no larger than the largest step inside the tile
      let inner=0;if(T){const at=(x,y)=>T.t[3*(((y+T.TH)%T.TH)*T.TW+((x+T.TW)%T.TW))+1];for(let y=0;y<T.TH;y++)for(let x=0;x<T.TW-1;x++)inner=Math.max(inner,Math.abs(at(x+1,y)-at(x,y)));
        for(let y=0;y<T.TH;y++)seam=Math.max(seam,Math.abs(at(0,y)-at(T.TW-1,y)));for(let x=0;x<T.TW;x++)seam=Math.max(seam,Math.abs(at(x,0)-at(x,T.TH-1)))}
      const sc=480/W;
      return {found:!!T,across:T&&T.cr.across/sc,down:T&&T.cr.down/sc,per:T&&T.cr.per,ground:T&&mx/base[1],figure:T&&mn/mx,seam,inner,mm:T&&T.mm,fine:T&&T.fine,none:N===null,weak:!NA||NA.cr.per<ASM_CR.per||NA.cr.sd<ASM_CR.sd,
        wants:asmCrWants(A),tag:asmCrTag('shirt',A)!==''&&asmCrTag('jacket',A)==='',
        print:asmCrWants(shirt('own-micro-print-neat',fig,'crP')),not:['herringbone','end-on-end','twill'].map(pt=>asmCrWants(shirt(pt,fig,'x'+pt))),noClose:asmCrWants(shirt('dobby','','crZ')),solid:asmCrWants(shirt('solid',fig,'crS'))}});
    ok(r.found&&Math.abs(r.across-30)<.6&&Math.abs(r.down-24)<.6&&r.per>.8,`the repeat of a figured cloth shot at a slight angle and lit unevenly is found (${r.across&&r.across.toFixed(1)} x ${r.down&&r.down.toFixed(1)} px, 30 x 24 drawn; ${r.per} of its contrast explained)`);
    ok(r.ground>.93&&r.ground<1.05&&r.figure>.1&&r.figure<.35,`the tile's ground is the tagged colour and the figure keeps its own grey against it (ground ${r.ground&&r.ground.toFixed(2)} of the tag, figure ${r.figure&&r.figure.toFixed(2)} of the ground; drawn .17)`);
    ok(r.seam<=r.inner*1.05,`the tile is one whole cell: no step at its edges larger than inside it (${r.seam.toFixed(3)} against ${r.inner.toFixed(3)})`);
    ok(r.fine&&Math.abs(r.mm-30/600*80)<.2,`it is an ordinary fine shirt tile at life size (${r.mm&&r.mm.toFixed(2)} mm a repeat, 4 drawn)`);
    ok(r.none&&r.weak,'a cloth with no sure repeat gives no tile (the strict confidence test): the shirt is drawn as before');
    ok(r.wants&&r.print&&r.tag&&!r.noClose&&!r.solid&&r.not.every(v=>!v),'a figured or printed shirt with a close-up takes it (and its key says so); herringbone, twill and end-on-end shirts, a plain one and one without a close-up do not');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
