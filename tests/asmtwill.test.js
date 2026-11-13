// A twill suit or blazer with no band reading is painted (asmSuitTwill): no item photo is asked for, its tile is its colour with the
// twill ribs (and a two-colour twill's second colour), and a stripe or check reading still takes the band painter.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{
      const tw={id:'s1',type:'suit',primaryColor:'midgrey',secondaryColor:'brown',pattern:'twill',vest:'yes'},
        bz={id:'b1',type:'blazer',primaryColor:'charcoal',pattern:'twill'},hb={id:'s2',type:'suit',primaryColor:'darkgrey',pattern:'herringbone'},
        pin={id:'s3',type:'suit',primaryColor:'navy',pattern:'pinstripe',sett:{v:2,a:0,bands:[['#1b2a4a',.95],['#cccccc',.05]],tr:40,src:'claude+pixels'}};
      items=[tw,bz,hb,pin,{id:'sh',type:'shirt',primaryColor:'white',pattern:'solid'},{id:'t',type:'tie',primaryColor:'navy',pattern:'solid'},{id:'w',type:'watch',primaryColor:'silver',metal:'silver'}];
      const o={top:tw,shirt:items[4],tie:items[5],watch:items[6],vest:true},t=asmTwillTex(tw),t1=asmTwillTex(bz);
      return {tw:asmSuitTwill(tw),paint:[tw,bz,hb,pin].map(asmSuitPaintable),pinTwill:asmSuitTwill(pin),
        parts:asmParts(o).filter(p=>p.slot==='jacket').map(p=>!!p.sp),photo:asmPhotoParts(o).map(p=>p.slot),
        needs:asmNeeds().filter(n=>n.kind==='piece'&&n.item&&(n.item.id==='s1'||n.item.id==='b1')).length,needHb:asmNeeds().some(n=>n.kind==='piece'&&n.item&&n.item.id==='s2'),
        tile:{TW:t.TW,kind:t.cloth.kind,ss:t.cloth.ss,c2:!!t.cloth.c2,mix:t.cloth.mix,amp:t.cloth.amp,fleck:t.cloth.fleck},tile1:{c2:t1.cloth.c2,mix:t1.cloth.mix},
        sig:[asmSuitSig(tw)!==asmSuitSig({...tw,secondaryColor:null}),asmSuitSig(tw)!==asmSuitSig({...tw,pattern:'solid'})],cut:asmSuitCut(tw)}});
    ok(r.tw&&!r.pinTwill&&r.paint.join()==='true,true,false,true','a twill suit and blazer are painted, a herringbone is still photographed, a read pinstripe keeps its band painter');
    ok(r.parts.join()==='true'&&!r.photo.includes('jacket')&&r.needs===0&&r.needHb,'no item photo is asked for a twill jacket or its waistcoat (the herringbone still needs one)');
    ok(r.tile.TW===1&&r.tile.kind==='twill'&&r.tile.ss&&r.tile.c2&&r.tile.mix>0&&r.tile.amp<.16&&r.tile.fleck<.08,`the tile is one colour with fine, supersampled twill ribs, fainter than under a stripe (${JSON.stringify(r.tile)})`);
    ok(r.tile1.c2===null&&r.tile1.mix===0,'a one-colour twill has no second colour in its ribs');
    ok(r.sig.every(Boolean)&&r.cut,'the second colour and the pattern are in the painted picture\'s key; the ribs follow the sleeves');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
