// A tie's pattern read from its photo with Claude's weave: an underexposed photo is brightened from its white reference first, and
// the tie's scale comes from the photo. (The words and drawing that went to the retired outfit-photo generator were removed 2026-11-14.)
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const CLAUDE='A shiny silk-look tie with broad diagonal stripes rising from lower left to upper right: wide taupe-brown bands edged by narrow dark brown lines, alternating with cream, steel blue and pale icy blue stripes and a wide beige band.';
  const weave={layout:'stripes-with-crossing-lines',direction:'lower-left to upper-right',repeatsAcross:1,colours:[{name:'taupe brown',hex:'#7e7363',width:'wide'},{name:'dark brown',hex:'#5e5446',width:'narrow'},
    {name:'cream',hex:'#e6e1cf',width:'medium'},{name:'steel blue',hex:'#8a9ab2',width:'medium'},{name:'pale blue',hex:'#dce6ee',width:'narrow'},{name:'beige',hex:'#c2b8a6',width:'wide'}],crossing:'',description:CLAUDE};
  const r=await p.evaluate(async([weave])=>{
    const im=new Image();im.src='tests/fixtures/tie-plaid.jpg';await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
    const plain=settFromCanvas(applyWb(c,wbGains(c)),{x:293,y:272,w:339,h:543}),sett=settFrom({full:c,box:{x:293,y:272,w:339,h:543},weave,type:'tie'});
    const L=s=>Math.max(...s.bands.map(b=>rgbLab(...hexRgb(b[0]))[0]));
    return {tr:sett.tr,lighter:L(sett)-L(plain)}},[weave]);
  ok(r.lighter>5,`an underexposed photo is brightened from its white reference before the pattern is read (lightest band +${r.lighter.toFixed(0)} L*)`);
  ok(Math.abs(r.tr-.61)<.08,`a tie's scale comes from its photo (${r.tr} repeats across), not Claude's estimate (1)`);
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
