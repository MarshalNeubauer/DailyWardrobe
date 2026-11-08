// List swatches are drawn from the tagged colours (not cropped photos), and colour names are shown with spaces.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  // a brownish photo crop on a grey suit and a light-blue shirt (what warm indoor light does to a photo)
  const brown='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  await p.evaluate(b=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','grey',{pattern:'herringbone',swatch:b,photo:b}),I('suit','darkgrey',{swatch:b}),I('shirt','lightblue',{swatch:b}),I('shirt','lightgrey'),I('tie','navy',{pattern:'stripe',secondaryColor:'white',tertiaryColor:'lightgrey',swatch:b}),
      I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('watch','grey',{metal:'silver'}),I('socks','darkgrey')];
    dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')},brown);
  const sw=await p.evaluate(()=>[...document.querySelectorAll('#today .list .dot')].map(d=>({bg:d.getAttribute('style')||'',svg:!!d.querySelector('svg'),html:d.innerHTML})));
  ok(sw.length>=6&&sw.every(d=>d.svg&&!d.bg.includes('url(')),'every list swatch is drawn, none uses the photo crop');
  const suitSw=sw[0].html;
  const suitHex=await p.evaluate(()=>COLORS[planFor()[key(sel)].top.primaryColor]);
  ok(suitSw.includes(suitHex)&&!suitSw.includes('data:image'),'the suit swatch uses its tagged grey, not the brown photo crop');
  const shirt=await p.evaluate(()=>{const o=planFor()[key(sel)];return o.shirt.primaryColor});
  const shirtSw=await p.evaluate(()=>{const r=[...document.querySelectorAll('#today .list .row')].find(r=>r.querySelector('.mut').textContent==='Shirt');return r.querySelector('.dot').innerHTML});
  ok(shirtSw.includes(await p.evaluate(c=>COLORS[c],shirt)),'the shirt swatch uses the shirt\'s tagged colour');
  // colour names with spaces everywhere they are shown
  await p.click('.score summary');
  const texts=await p.evaluate(()=>{const t=[document.querySelector('#today').innerText];
    sel=new Date(2026,10,16);items.push({id:'x1',type:'shoes',primaryColor:'brown',leather:'suede'});cache={};renderToday();t.push(document.querySelector('#today').innerText);
    show('add');addManual();t.push([...document.querySelectorAll('#queue select option')].map(o=>o.textContent).join(' '));
    t.push(runAnalysis(items,todayDate(),2).recs.map(r=>r.name+' '+r.why.join(' ')).join(' '));
    return t.join('\n')});
  ok(!/lightblue|lightgrey|darkgrey/i.test(texts),'no run-together colour names on Today, in the score, notes, dropdowns or recommendations');
  ok(/light blue/i.test(texts)&&/dark grey/i.test(texts),'colour names read "light blue", "dark grey"');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
