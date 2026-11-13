// A tie tagged woven or tonal check can be read by Claude (claudeOnly): the item sheet offers "Read pattern from photo", and a motif
// reading paints it (the owner's charcoal & grey woven tie, a grid of tiny light dots, was painted plain, 2026-11-13).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>({tie:[claudeOnly('tie','woven'),claudeOnly('tie','tonal-check'),readable('tie','woven')],
      shirt:claudeOnly('shirt','woven'),solid:claudeOnly('tie','solid'),suit:claudeOnly('suit','tweed')}));
    ok(r.tie.every(Boolean)&&r.shirt&&!r.solid&&!r.suit,'a woven or tonal-check tie is read by Claude; a plain tie and other items are unchanged');
    const btn=await p.evaluate(ph=>{localStorage.setItem('worker_url',location.origin+'/w/');localStorage.setItem('app_token','t');
      items=[{id:'t1',type:'tie',primaryColor:'charcoal',secondaryColor:'grey',pattern:'woven',photo:ph,texture:ph,added:1}];flt='all';editing='t1';show('wardrobe');
      const b=document.querySelector('#readpat-btn');return b&&b.textContent},PH);
    ok(btn==='Read pattern from photo','the item sheet offers to read the woven tie\'s pattern');
    // a motif reading (as Claude gave it for the owner's tie) gives the tie painter a tile
    const m=await p.evaluate(async()=>{const t=items[0];t.sett={v:3,motif:{grid:'diagonal',ground:'#20222b',figs:[{shape:'square',place:'cell',size:.5,cols:['#898d96']}]},cr:36,tr:40,a:45,src:'claude+pixels'};
      const f=await asmTieFor(t);return {usable:!!usableSett(t),motif:f.motif,tile:!!f.c&&f.TW>0,across:f.across}});
    ok(m.usable&&m.motif&&m.tile&&m.across===40,`with the reading the tie is painted from its motif (${JSON.stringify(m)})`);
    // the weave itself (a texture reading): kept and painted on a woven or tonal-check tie, a little stronger than on a shirt
    const x=await p.evaluate(async()=>{const tex={v:4,tex:{kind:'diamond',grid:['00011000','00100100','01000010','10000001','10000001','01000010','00100100','00011000'],aspect:1,lighter:true,contrast:'medium',rel:.35},a:0,cr:40,tr:32,src:'claude+pixels'};
      const tc={id:'tc',type:'tie',primaryColor:'black',secondaryColor:'charcoal',pattern:'tonal-check',sett:tex},st={id:'st',type:'tie',primaryColor:'navy',pattern:'stripe',sett:tex},
        sh={id:'sh',type:'shirt',primaryColor:'white',pattern:'dobby',sett:tex};
      const f=await asmTieFor(tc),spec={layout:'texture',texture:{kind:'diamond',grid:tex.tex.grid,raised:{hex:'#333333'},ground:{hex:'#111111'},contrast:'medium',aspect:1},repeatsInCloseup:40,repeatsAcrossItem:32};
      const fromSpec=specSett(spec,{type:'tie'}),dTie=fabricDef('a',tc,'tie','asmtie'),dPlain=fabricDef('b',tc,'tie');
      const tone=d=>(d.match(/fill="(#[0-9a-f]{6})"/)||[])[1];
      return {usable:[!!usableSett(tc),!!usableSett(st),!!usableSett(sh)],tile:!!f.c&&f.TW>0&&f.across===32,spec:!!(fromSpec&&fromSpec.tex),
        stronger:tone(dTie)!==tone(dPlain),sig:asmTieSig(tc)!==asmTieSig({...tc,sett:null})}});
    ok(x.usable.join()==='true,false,true','a tonal-check tie keeps a weave reading; a striped tie does not (a shirt still does)');
    ok(x.spec&&x.tile,'Claude\'s weave answer becomes a tie reading, and the tie painter gets a tile repeated across the tie');
    ok(x.stronger&&x.sig,'on the model the weave is drawn stronger than in the app\'s swatch, and the reading is in the picture\'s key');
    // a twill (drawn by fabricDef's own twill branch) is strengthened on a tie too, and its ribs are no finer than ASM_TIE_TEX_MAX across
    const tw=await p.evaluate(async()=>{const s={v:4,tex:{kind:'twill',grid:['0001','0010','0100','1000'],aspect:1,lighter:true,contrast:'low',rel:.35},a:0,cr:60,tr:80,src:'claude+pixels'};
      const t={id:'bt',type:'tie',primaryColor:'burgundy',pattern:'woven',sett:s},op=d=>+((d.match(/stroke-opacity="([\d.]+)"/)||[])[1]||0);
      const f=await asmTieFor(t);return {stronger:op(fabricDef('a',t,'tie','asmtie'))>op(fabricDef('b',t,'tie')),across:f.across,max:ASM_TIE_TEX_MAX}});
    ok(tw.stronger&&tw.across===tw.max&&tw.max<80,`a twill tie's ribs are drawn stronger on the model and capped at ${tw.max} across (Claude counted 80)`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
