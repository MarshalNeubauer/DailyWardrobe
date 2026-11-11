// The precision swatch is cut from the fabric close-up when there is one: on the Add card (its zoom and position sliders work on
// the close-up), when saved, in the Wardrobe editor when a close-up is added, replaced or removed, and once for items that already
// have one. Items with a close-up show it as their small fabric square across the app (swatchSVG); others stay drawn.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const file=async(path,name)=>{const b=await (await fetch(path)).blob();return new File([b],name,{type:'image/jpeg'})};
    // ---- Add: the item photo first, then the close-up
    await p.evaluate(async()=>{show('add');const b=await (await fetch('tests/fixtures/blazer-windowpane.jpg')).blob();await addFiles([new File([b],'b.jpg',{type:'image/jpeg'})])});
    await p.waitForFunction(()=>queue[0]&&!queue[0].busy&&queue[0].swatch,null,{timeout:20000});
    const a=await p.evaluate(()=>{const q=queue[0];q.type='suit';renderAdd();return {src:q.swSrc,sw:q.swatch,note:/From the fabric close-up/.test(document.querySelector('#queue').textContent)}});
    ok(a.src==='photo'&&/^data:image\/png/.test(a.sw)&&!a.note,'without a close-up the precision swatch is cut from the item photo');
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([b],'c.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0].swSrc==='tex',null,{timeout:20000});
    const b=await p.evaluate(()=>{const q=queue[0],el=document.querySelector('#swatch-img-0');return {src:q.swSrc,changed:q.swatch,same:q.swatch===cropSwatch(q.texCanvas,q.zoom,q.cx,q.cy),
      shown:el&&el.style.backgroundImage.includes(q.swatch.slice(30,80)),note:/From the fabric close-up/.test(document.querySelector('#queue').textContent)}});
    ok(b.src==='tex'&&b.changed!==a.sw&&b.same,'adding the close-up cuts the precision swatch from it');
    ok(b.shown&&b.note,'the inspector shows it and says it comes from the close-up');
    const z=await p.evaluate(()=>{updateSwatchParam(0,'zoom',3);updateSwatchParam(0,'cx',.2);const q=queue[0];return {same:q.swatch===cropSwatch(q.texCanvas,3,.2,q.cy),src:q.swSrc}});
    ok(z.same&&z.src==='tex','the zoom and position sliders work on the close-up');
    await p.evaluate(()=>{dropTexture(0)});
    ok(await p.evaluate(()=>queue[0].swSrc==='photo'),'removing the close-up goes back to the item photo');
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([b],'c.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0].swSrc==='tex',null,{timeout:20000});
    await p.evaluate(()=>save(0));
    const it=await p.evaluate(()=>{const i=items.find(x=>x.texture);return {id:i.id,src:i.swSrc,sw:/^data:image\/png/.test(i.swatch),svg:swatchSVG(i)}});
    ok(it.src==='tex'&&it.sw,'the saved item keeps the close-up swatch');
    ok(/<image href="data:image\/png/.test(it.svg),'its small fabric square across the app is the close-up swatch');
    const plain=await p.evaluate(()=>swatchSVG({id:'x',type:'suit',primaryColor:'navy',pattern:'solid',swatch:'data:image/png;base64,AA',swSrc:'photo'}));
    ok(!/<image/.test(plain)&&/<pattern/.test(plain),'an item without a close-up stays drawn (never cut from its photo)');
    // Today's pieces list shows it
    const today=await p.evaluate(id=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});const s=items.find(x=>x.id===id);
      items=[s,I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today');
      return [...document.querySelectorAll('#today svg image')].some(im=>im.getAttribute('href')===s.swatch)},it.id);
    ok(today,'Today\'s pieces show the suit by its close-up swatch');
    // ---- Wardrobe editor: removing, re-adding and undoing the close-up re-cut the swatch
    const ed=await p.evaluate(async id=>{const it=items.find(x=>x.id===id),tex=it.texture;await setTexture(id,null);const off={src:it.swSrc,img:/<image/.test(swatchSVG(it))};
      await setTexture(id,tex);const on={src:it.swSrc,img:/<image/.test(swatchSVG(it))};await undoPhoto(id);const undo={src:it.swSrc,tex:!!it.texture};return {off,on,undo}},it.id);
    ok(ed.off.src==='photo'&&!ed.off.img&&ed.on.src==='tex'&&ed.on.img,'the editor re-cuts the swatch when the close-up is removed or added');
    ok(ed.undo.src==='photo'&&!ed.undo.tex,'undo restores the close-up and the swatch with it (back to no close-up here)');
    // ---- once: an item that already had a close-up gets its swatch cut from it
    const mig=await p.evaluate(async id=>{const it=items.find(x=>x.id===id);await setTexture(id,(await (async()=>{const b=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();
        return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})})()));
      it.swatch='data:image/png;base64,OLD';delete it.swSrc;localStorage.removeItem('tex_swatch');const n=await texSwatches(),again=await texSwatches();
      return {n,again,src:it.swSrc,changed:it.swatch!=='data:image/png;base64,OLD'}},it.id);
    ok(mig.n===1&&mig.again===0&&mig.src==='tex'&&mig.changed,'items that already have a close-up get their swatch cut from it, once');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
