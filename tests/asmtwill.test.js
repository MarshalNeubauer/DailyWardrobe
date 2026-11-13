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
        sig:[asmSuitSig(tw)!==asmSuitSig({...tw,secondaryColor:null}),asmSuitSig(tw)!==asmSuitSig({...tw,pattern:'solid'})],cut:asmSuitCut(tw),
        hbTile:(c=>({kind:c.kind,cw:c.cw,amp:c.amp}))(asmTwillTex(hb).cloth),hbSig:asmSuitSig(hb)!==asmSuitSig({...hb,pattern:'twill'})}});
    ok(r.tw&&!r.pinTwill&&r.paint.join()==='true,true,true,true','a twill suit and blazer and a herringbone are painted, a read pinstripe keeps its band painter');
    ok(r.parts.join()==='true'&&!r.photo.includes('jacket')&&r.needs===0&&!r.needHb,'no item photo is asked for a twill or herringbone jacket or its waistcoat');
    ok(r.hbTile.kind==='herringbone'&&Math.abs(r.hbTile.cw-4.4*3.2)<.5&&r.hbTile.amp>.25&&r.hbSig,`a herringbone with no reading has the herringbone cloth, columns 4.4 mm, thin ribs 1.7 mm apart and a woollen mottle (matched to the owner's reference picture), much stronger than a twill's ribs (${JSON.stringify(r.hbTile)}), and its own key`);
    // the owner's own patterns: a weave named in the pattern counts though its base is solid; a plain own pattern stays flat; the colour-coded key marks them
    const own=await p.evaluate(()=>{const mk=(id,pattern)=>({id,type:'suit',primaryColor:'black',pattern});
      const a=mk('o1','own-fine-worsted-twill'),h=mk('o2','own-fine-tonal-herringbone'),m=mk('o3','own-worsted-melange-plain-weave'),t=mk('o4','twill');
      return {w:[a,h,m,t].map(asmSuitWeave),tw:[a,h,m,t].map(asmSuitTwill),tag:[a,h,m,t].map(i=>asmCmWeaveTag('jacket',i)),shirt:asmCmWeaveTag('shirt',a)}});
    ok(own.w.join()==='twill,herringbone,,twill'&&own.tw.join()==='true,true,false,true',`own patterns named twill or herringbone get their weave (${own.w})`);
    ok(own.tag[0]==='/tw'&&own.tag[1].startsWith('/hb')&&own.tag[2]===''&&own.tag[3]===''&&own.shirt==='',`only the looks the audit changed get a new key (${own.tag})`);
    ok(r.tile.TW===1&&r.tile.kind==='twill'&&r.tile.ss&&r.tile.c2&&r.tile.mix>0&&r.tile.amp<.16&&r.tile.fleck<.08,`the tile is one colour with fine, supersampled twill ribs, fainter than under a stripe (${JSON.stringify(r.tile)})`);
    ok(r.tile1.c2===null&&r.tile1.mix===0,'a one-colour twill has no second colour in its ribs');
    ok(r.sig.every(Boolean)&&r.cut,'the second colour and the pattern are in the painted picture\'s key; the ribs follow the sleeves');
    // tweed: painted with the tweed tile (a melange of short light and dark picks, a few nubs and flecks), its flecks in a second colour
    const w=await p.evaluate(()=>{const td={id:'td',type:'blazer',primaryColor:'slate',pattern:'tweed'},dg={...td,id:'dg',secondaryColor:'white'},chk={id:'ck',type:'blazer',primaryColor:'brown',pattern:'windowpane',sett:{v:2,a:0,bands:[['#5a3a22',.95],['#cccccc',.05]],tr:8,src:'hand'}};
      const t=asmTweedTex(td),t2=asmTweedTex(dg),tile=asmTweedTile(),again=asmTweedTile();let m=0,s=0,fl=0,run=0,maxRun=0;
      for(const v of tile.r)m+=v;m/=tile.r.length;for(const v of tile.r)s+=(v-m)**2;s=Math.sqrt(s/tile.r.length);for(const v of tile.f)fl+=v;
      for(let x=1;x<tile.T;x++){const a=tile.r[100*tile.T+x],b=tile.r[100*tile.T+x-1];run=Math.abs(a-b)<1e-6?run+1:0;maxRun=Math.max(maxRun,run)}
      items.push(td);const need=asmNeeds().some(n=>n.kind==='piece'&&n.item&&n.item.id==='td');items.pop();
      return {paint:[asmSuitPaintable(td),asmSuitTweed(td),asmSuitTweed(chk),asmSuitTwill(td)],need,tex:{tweed:t.tweed,c2:t.c2,c22:!!t2.c2,fmix:t2.fmix},mean:+m.toFixed(3),sd:+s.toFixed(3),fl:+(fl/tile.f.length).toFixed(3),maxRun,same:tile===again,
        sig:asmSuitSig(td)!==asmSuitSig(dg)&&asmSuitSig(td)!==asmSuitSig({...td,pattern:'solid'}),cut:asmSuitCut(td)}});
    ok(w.paint.join()==='true,true,false,false'&&!w.need,'a tweed blazer is painted and needs no item photo (a tweed read as a check keeps the band painter)');
    ok(w.tex.tweed&&w.tex.c2===null&&w.tex.c22&&w.tex.fmix>0,'its tile is the tweed texture, its flecks in a second colour when it has one');
    ok(Math.abs(w.mean-1)<.06&&w.sd>.1&&w.sd<.25&&w.fl>.02&&w.fl<.12&&w.maxRun<12&&w.same,`the texture is a fine melange around the cloth's light, with flecks and no long streaks (mean ${w.mean}, sd ${w.sd}, flecks ${w.fl}, longest run ${w.maxRun} px), made once`);
    ok(w.sig&&w.cut,'the second colour and the pattern are in the painted picture\'s key');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
