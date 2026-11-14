// The folded pieces box's line calls a piece by the name the owner gave it, exactly as typed (2026-11-14: "Medium Grey suit", not "mid grey
// worsted suit"); unnamed pieces keep their colour wording; a name is shown as text, never as markup
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',...x});
      const top=I('s','suit','midgrey',{name:'Medium Grey suit'}),shirt=I('h','shirt','lavender'),tie=I('t','tie','black',{name:'<b>My</b> tie'});
      const o={suitDay:true,top,shirt,tie},named=piecesLine(o),plain=piecesLine({suitDay:true,top:{...top,name:''},shirt,tie:{...tie,name:undefined}});
      const box=document.createElement('div');box.innerHTML=piecesBox({...o,bot:top,shoes:null});const small=box.querySelector('.mltxt small');
      return {named,plain,shown:small&&small.textContent,markup:!!(small&&small.querySelector('b'))}});
    ok(/^Medium Grey suit · lavender shirt · <b>My<\/b> tie$/.test(r.named),`a named suit and tie are called by their names, as typed ("${r.named}")`);
    ok(/^mid grey suit · lavender shirt · black tie$/i.test(r.plain),`unnamed pieces keep the colour wording ("${r.plain}")`);
    ok(/^Medium Grey suit · lavender shirt · <b>My<\/b> tie$/.test(r.shown)&&!r.markup,`the box shows the names as text, never as markup ("${r.shown}")`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
