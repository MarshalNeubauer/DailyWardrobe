// Woven shirts' rules (assemble.js asmWeave / asmTexMm / asmShirtAngles, used by the colour-coded painter's shirt tiles, asm-color.js
// asmCmTile): the owner's rules of 2026-11-12. Herringbone at Claude's count across the shirt (12 mm when the count is at the cap or
// missing); a figured weave (dobby, basket…) at the repeat measured in its close-up, never finer than 2.9 mm; end-on-end and unread weaves
// as a faint fleck; the cuffs' weave along the arm. tests/fixtures/shirt-diamond-closeup.jpg is the owner's white woven diamond (16 px a
// diamond in 440 px: 2.9 mm). (The earlier assembler's own shirt painter, asmPaint, was deleted 2026-11-14.)
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const closeup='data:image/jpeg;base64,'+fs.readFileSync(path.join(ROOT,'tests/fixtures/shirt-diamond-closeup.jpg')).toString('base64');
    const r=await p.evaluate(async cu=>{const S=(pattern,x={})=>({id:'s'+Math.random(),type:'shirt',primaryColor:'pink',pattern,...x});
      const hbG=['1000000110','0100001010','0010010010','0001100010'],tex=(kind,grid,tr,rel=.18)=>({v:4,tex:{kind,grid,lighter:true,rel},a:0,cr:13,tr});
      const hb30=S('herringbone',{sett:tex('herringbone',hbG,30)}),hb80=S('herringbone',{sett:tex('herringbone',hbG,80)}),hbNone=S('herringbone');
      const dia=S('woven',{primaryColor:'white',sett:{...tex('diamond',['01111110','10111101','11011011','11100111','11100111','11011011','10111101','01111110'],65,.31),cr:22},texture:cu});
      const fine=S('dobby',{sett:tex('diamond',['10000001','01000010','00100100','00011000','00011000','00100100','01000010','10000001'],80,.22)});   // no close-up
      const eoe=S('end-on-end',{sett:tex('end-on-end',['1010','0101','1010','0101'],80)}),ox=S('oxford'),solid=S('solid');
      const w=i=>{const v=asmWeave(i);return v?v.f+(v.hb?':'+v.mm.toFixed(1):''):'plain'};
      const out={rules:[hb30,hb80,hbNone,dia,fine,eoe,ox,solid].map(w).join(' '),mmDia:await asmTexMm(dia),mmFine:await asmTexMm(fine)};
      // which way the threads run: a shirt's big front and a narrow upright cuff
      const W=120,N=W*W,A=new Float32Array(N),idx=[];for(let k=0;k<N;k++){const x=k%W,y=(k/W)|0;if((x>=10&&x<70&&y>=10&&y<110)||(x>=90&&x<100&&y>=20&&y<100)){A[k]=1;idx.push(k)}}
      const ang=asmShirtAngles(A,idx,W,W),at=(x,y)=>ang[idx.indexOf(y*W+x)];out.ang=[at(40,60),at(95,60)];
      return out},closeup);
    ok(r.rules==='tile:18.3 tile:12.2 tile:12.2 tile tile fleck fleck plain',`herringbone is sized by Claude's count (30 across: 18 mm), 12 mm at the cap or without one; read figured weaves are tiles; end-on-end and unread weaves fleck; solid is plain (${r.rules})`);
    ok(Math.abs(r.mmDia-2.9)<.4&&r.mmFine===2.9,`a figured weave's repeat is measured in its close-up (the owner's white diamond: ${r.mmDia.toFixed(2)} mm), never finer than 2.9 mm (no close-up: ${r.mmFine} mm)`);
    ok(r.ang[0]===0&&Math.abs(Math.abs(r.ang[1])-Math.PI/2)<.05,`the front's weave is upright, a cuff's runs along the arm (across its band: ${r.ang.map(a=>a==null?'-':(a*180/Math.PI).toFixed(0)).join(', ')} degrees)`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
