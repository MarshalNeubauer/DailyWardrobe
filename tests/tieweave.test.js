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
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
