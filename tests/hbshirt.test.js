// A herringbone shirt's weave tile (asmHbShirtLook, the owner's pick 2026-11-13: "every other column lighter", for every herringbone
// shirt): its average held at ASM_HB_SHIRT_Y of the tagged colour, and its second column ASM_HB_COL_LIFT brighter; other shirts untouched.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{const grid=[[1,0,0,1],[0,1,1,0],[1,0,0,1],[0,1,1,0]];
      const mk=(id,col,kind,rel)=>({id,type:'shirt',primaryColor:col,pattern:kind==='dobby'?'dobby':'herringbone',sett:{v:4,tex:{kind,grid,lighter:true,contrast:'medium',rel},a:0,cr:20,tr:80,src:'claude+pixels'}});
      const pink=mk('p','pink','herringbone',.35),blue=mk('b','blue','herringbone',.35),dob=mk('d','pink','dobby',.2),plain={id:'g',type:'shirt',primaryColor:'pink',pattern:'herringbone'};
      const stat=async i=>{const T=await asmCmTile(i,'shirt'),h=String(colOf(i)).replace('#',''),tag=[0,2,4].map(k=>ASM_LIN[parseInt(h.slice(k,k+2),16)]),n=T.TW*T.TH,half=T.TW/2;let m=[0,0,0],a=0,b=0,na=0,nb=0;
        for(let y=0;y<T.TH;y++)for(let x=0;x<T.TW;x++){const k=3*(y*T.TW+x),Y=.2126*T.t[k]+.7152*T.t[k+1]+.0722*T.t[k+2];for(let q=0;q<3;q++)m[q]+=T.t[k+q];if(x<half-1){a+=Y;na++}else if(x>half+1){b+=Y;nb++}}
        return {ratio:m.map((v,q)=>v/n/tag[q]),lift:(b/nb)/(a/na)}};
      return {pink:await stat(pink),blue:await stat(blue),generic:await stat(plain),dobby:await stat(dob),is:[asmHbShirt(pink),asmHbShirt(plain),asmHbShirt(dob)],tag:asmCmWeaveTag('shirt',pink),Y:ASM_HB_SHIRT_Y,L:ASM_HB_COL_LIFT}});
    const near=(v,w,e)=>Math.abs(v-w)<=e;
    ok(r.is.join()==='true,true,false'&&/^\/hbs1/.test(r.tag),'herringbone shirts (read or not) take the look and a new picture key; a dobby does not');
    for(const k of ['pink','blue','generic'])ok(r[k].lift>1.04&&r[k].lift<1.12&&r[k].ratio.every(v=>near(v,r.Y*(1+r.L/2),.03)),`${k}: every other column about 7% brighter (${r[k].lift.toFixed(3)}), the colour held (${r[k].ratio.map(v=>v.toFixed(3))})`);
    ok(near(r.dobby.lift,1,.02),`a dobby shirt is unchanged (${r.dobby.lift.toFixed(3)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // it asks the colour-coded painter for its tiles (asm-color.js)
