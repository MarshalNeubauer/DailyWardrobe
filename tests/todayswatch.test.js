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
    // the real cloth where it reads: a tie's and a plain or finely woven jacket's or shirt's close-up swatch; a striped jacket stays drawn
    const pick=await p.evaluate(ph=>{const cu={swatch:ph,swSrc:'tex',texture:ph},kind=i=>/^<img /.test(ovlPiece(i))?'close-up':'drawn';
      return {tie:kind({id:'a',type:'tie',primaryColor:'navy',secondaryColor:'white',pattern:'stripe',...cu}),pin:kind({id:'b',type:'suit',primaryColor:'navy',pattern:'pinstripe',...cu}),
        twill:kind({id:'c',type:'suit',primaryColor:'brown',pattern:'twill',...cu}),dobby:kind({id:'d',type:'shirt',primaryColor:'white',pattern:'dobby',...cu}),
        gingham:kind({id:'e',type:'shirt',primaryColor:'lightblue',pattern:'gingham',...cu}),bare:kind({id:'f',type:'tie',primaryColor:'navy',pattern:'solid'}),photo:kind({id:'g',type:'suit',primaryColor:'navy',pattern:'solid',swatch:ph,swSrc:'photo'})}},PH);
    ok(pick.tie==='close-up'&&pick.twill==='close-up'&&pick.dobby==='close-up',`a tie, a twill suit and a dobby shirt show their close-up (${JSON.stringify(pick)})`);
    ok(pick.pin==='drawn'&&pick.gingham==='drawn'&&pick.bare==='drawn'&&pick.photo==='drawn','a pinstripe suit and a gingham shirt stay drawn, as does an item with no close-up or a swatch cut from its photo');
    const css=await p.evaluate(()=>{const d=document.createElement('div');d.className='fig';d.innerHTML=swatchStack({top:items.find(i=>i.type==='suit'),shirt:items.find(i=>i.type==='shirt'),tie:items.find(i=>i.type==='tie')},true);
      document.body.appendChild(d);const s=getComputedStyle(d.querySelector('.swstack')),b=d.querySelector('.ovsw').getBoundingClientRect(),c=getComputedStyle(d.querySelector('.ovsw'));
      const o={pe:s.pointerEvents,bottom:s.bottom,w:Math.round(b.width),border:c.borderTopWidth};d.remove();return o});
    ok(css.pe==='none'&&css.bottom==='58px'&&css.w===52&&css.border==='0px',`52 px, no rim, takes no touches, above ✕ (${JSON.stringify(css)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
