// The cloth over Today's picture (app.js swatchStack): the jacket's, shirt's and tie's drawn swatches bottom left, only for the pieces worn,
// above ✕ on days that show it; a jacket's stripes in Claude's colours and at least OVL_LINE of a repeat; a tie's pattern at half size.
module.exports=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};
      const pin={id:'pin',type:'suit',primaryColor:'navy',secondaryColor:'lightgrey',pattern:'pinstripe',sett:{v:2,a:0,bands:[['#1b2a4a',.97],['#2d3550',.03]],tr:30,src:'claude+pixels'},
        patternSpec:{across:{bands:[{role:'ground',hex:'#1b2a4a',w:.97},{role:'line',hex:'#c8cbd2',w:.03}]}}};
      const tie={id:'tt',type:'tie',primaryColor:'navy',secondaryColor:'white',pattern:'polka-dot'},shirt={id:'sh',type:'shirt',primaryColor:'lightblue',pattern:'solid'};
      const ov=ovlItem(pin),line=ov.sett.bands.find(b=>b[0]!=='#1b2a4a'),tsv=ovlSvg(tie),plain=swatchSVG(tie,true);
      const full=swatchStack({top:pin,shirt,tie},false),noTie=swatchStack({top:pin,shirt,tie:null},true),none=swatchStack({},false);
      const shot=d=>{sel=d;const o=planOn(d);renders[comboKey(o)]={img:'${PH}',sig:comboSig(o)};return figureStage(o)};   // a kept photo for the day, so the picture is drawn
      const past=shot(new Date(2026,10,10)),fut=shot(new Date(2026,10,16));
      return {lineHex:line&&line[0],lineW:line&&line[1],sum:ov.sett.bands.reduce((a,b)=>a+b[1],0),orig:pin.sett.bands[1][0],scaled:/scale\\(\\.5\\)/.test(tsv)&&!/scale\\(\\.5\\)/.test(plain),
        n:(full.match(/class="ovsw"/g)||[]).length,nNo:(noTie.match(/class="ovsw"/g)||[]).length,up:/swstack up/.test(noTie)&&!/swstack up/.test(full),none,label:/Tie: /.test(full)&&!/Tie: /.test(noTie),
        pastUp:/class="swstack up"/.test(past),futFlat:/class="swstack"/.test(fut)&&!/swstack up/.test(fut)}})()`);
    ok(r.lineHex==='#c8cbd2'&&r.lineW>=0.1&&Math.abs(r.sum-1)<1e-9&&r.orig==='#2d3550',`a jacket's stripe is drawn in Claude's colour and at least a tenth of the repeat (${r.lineHex}, ${r.lineW}), the item untouched`);
    ok(r.scaled,'a tie\'s pattern is drawn at half size (more repeats) in the overlay only');
    ok(r.n===3&&r.nNo===2&&r.none===''&&r.label,'one swatch per piece worn: jacket, shirt, tie; none without them');
    ok(r.pastUp&&r.futFlat,'on a day that shows ✕ and ✓ the stack sits above ✕; on a later day it sits in the corner');
    // the real cloth where it reads: a tie's and a plain or finely woven jacket's close-up swatch; a shirt and a striped jacket stay drawn
    const pick=await p.evaluate(ph=>{const cu={swatch:ph,swSrc:'tex',texture:ph},kind=i=>{const v=ovlPiece(i);return v.includes(ph)?'close-up':/^<img src="data:image\/png/.test(v)?'painted':'drawn'};
      return {tie:kind({id:'a',type:'tie',primaryColor:'navy',secondaryColor:'white',pattern:'stripe',...cu}),pin:kind({id:'b',type:'suit',primaryColor:'navy',pattern:'pinstripe',...cu}),
        twill:kind({id:'c',type:'suit',primaryColor:'brown',pattern:'twill',...cu}),dobby:kind({id:'d',type:'shirt',primaryColor:'white',pattern:'dobby',...cu}),
        gingham:kind({id:'e',type:'shirt',primaryColor:'lightblue',pattern:'gingham',...cu}),bare:kind({id:'f',type:'tie',primaryColor:'navy',pattern:'solid'}),photo:kind({id:'g',type:'suit',primaryColor:'navy',pattern:'solid',swatch:ph,swSrc:'photo'})}},PH);
    ok(pick.tie==='close-up',`a tie shows its close-up (${JSON.stringify(pick)})`);
    ok(pick.dobby==='drawn',"a shirt is always drawn, even with a close-up (the owner's choice)");
    ok(pick.twill==='painted'&&pick.photo==='painted',"every suit is its painted cloth, never its close-up (the owner's choice)");
    ok(pick.pin==='drawn'&&pick.gingham==='drawn'&&pick.bare==='drawn','a pinstripe suit with no reading keeps the drawn tile, as does a gingham shirt and a tie with no close-up');
    // the painted suit: read bands as stripes in Claude's colours, a windowpane's crossing line, and the cloth's grain
    const st=await p.evaluate(async()=>{const px=async u=>{const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return {w:im.width,d:x.getImageData(0,0,im.width,im.height).data}};
      const pin={id:'p1',type:'suit',primaryColor:'navy',pattern:'pinstripe',material:'wool twill',sett:{v:2,a:0,bands:[['#1b2a4a',.95],['#c8cbd2',.05]],tr:30}},plain={id:'p2',type:'suit',primaryColor:'charcoal',pattern:'solid'};
      const wp={id:'p3',type:'blazer',primaryColor:'khaki',pattern:'windowpane',material:'linen',sett:{v:2,a:0,bands:[['#c8b48c',.9],['#8fb3dc',.1]],cross:{d:90,r:1,bands:[[null,.97],['#e8e8e8',.03]]},tr:8}};
      const a=await px(ovlSuitPng(pin)),b=await px(ovlSuitPng(plain)),w=await px(ovlSuitPng(wp)),S=a.w;
      const colL=(im,x)=>{let s=0;for(let y=0;y<S;y++){const k=4*(y*S+x);s+=im.d[k]+im.d[k+1]+im.d[k+2]}return s/S},rowL=(im,y)=>{let s=0;for(let x=0;x<S;x++){const k=4*(y*S+x);s+=im.d[k]+im.d[k+1]+im.d[k+2]}return s/S};
      let lines=0,prev=false;for(let x=0;x<S;x++){const on=colL(a,x)>250;if(on&&!prev)lines++;prev=on}
      const ls=new Set();for(let k=0;k<b.d.length;k+=4)ls.add(b.d[k]);let rows=0;for(let y=0;y<S;y++)if(rowL(w,y)>rowL(w,(y+S/4)%S)+30)rows++;
      return {S,lines,tones:ls.size,rows,cached:ovlSuitPng(pin)===ovlSuitPng(pin)}});
    ok(st.S===260&&st.lines===2,`a read pinstripe paints its light line twice across (${st.lines})`);
    ok(st.tones>12,`a plain suit carries the cloth's grain (${st.tones} tones)`);
    ok(st.rows>0&&st.cached,`a windowpane's crossing line is painted (${st.rows} rows) and pictures are cached`);
    // a shirt's figured weave is drawn at higher fidelity in the overlay only (the owner's choice: smooth shapes with a thread grain)
    const wv=await p.evaluate(async()=>{const grid=['10000001','01000010','00100100','00011000','00011000','00100100','01000010','10000001'];
      const sh={id:'dw',type:'shirt',primaryColor:'lightblue',pattern:'dobby',sett:{v:4,tex:{kind:'diamond',grid,lighter:'raised',contrast:.3,rel:.12}}};
      const [lo,hi]=texTones(colOf(sh),sh.sett.tex,1.7),soft=texTileUrl(grid,lo,hi),sm=texTileSmooth(grid,lo,hi),ov=ovlSvg(sh),list=swatchSVG(sh,true);
      const im=new Image();im.src=sm;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
      const d=x.getImageData(0,0,c.width,c.height).data,ls=new Set();for(let k=0;k<d.length;k+=4)ls.add(d[k]+','+d[k+1]+','+d[k+2]);
      const hb={...sh,id:'hb',pattern:'herringbone',sett:{v:4,tex:{kind:'herringbone',grid:['10','01'],rel:.1}}};
      return {smooth:ov.includes(sm)&&!ov.includes(soft),list:list.includes(soft)&&!list.includes(sm),w:im.width,tones:ls.size,hb:ovlWeave(hb,'unchanged')==='unchanged'}});
    ok(wv.smooth&&wv.list,'a shirt weave in the overlay is the smooth tile; the pieces list keeps its own');
    ok(wv.w===8*24&&wv.tones>40,`the smooth tile is 24 px a cell with anti-aliased, grained tones (${wv.w} px, ${wv.tones} tones)`);
    ok(wv.hb,'a herringbone shirt is drawn as before');
    const css=await p.evaluate(()=>{const d=document.createElement('div');d.className='fig';d.innerHTML=swatchStack({top:items.find(i=>i.type==='suit'),shirt:items.find(i=>i.type==='shirt'),tie:items.find(i=>i.type==='tie')},true);
      document.body.appendChild(d);const s=getComputedStyle(d.querySelector('.swstack')),b=d.querySelector('.ovsw').getBoundingClientRect(),c=getComputedStyle(d.querySelector('.ovsw'));
      const o={pe:s.pointerEvents,bottom:s.bottom,w:Math.round(b.width),border:c.borderTopWidth};d.remove();return o});
    ok(css.pe==='none'&&css.bottom==='58px'&&css.w===52&&css.border==='0px',`52 px, no rim, takes no touches, above ✕ (${JSON.stringify(css)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
