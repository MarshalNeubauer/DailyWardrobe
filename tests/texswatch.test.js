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
    const b=await p.evaluate(()=>{const q=queue[0],el=document.querySelector('#swatch-img-0');return {src:q.swSrc,changed:q.swatch,same:q.swatch===cropSwatch(q.texCanvas,q.zoom,q.cx,q.cy,colOf(q)),
      shown:el&&el.style.backgroundImage.includes(q.swatch.slice(30,80)),note:/From the fabric close-up/.test(document.querySelector('#queue').textContent)}});
    ok(b.src==='tex'&&b.changed!==a.sw&&b.same,'adding the close-up cuts the precision swatch from it');
    ok(b.shown&&b.note,'the inspector shows it and says it comes from the close-up');
    const z=await p.evaluate(()=>{updateSwatchParam(0,'zoom',3);updateSwatchParam(0,'cx',.2);const q=queue[0];return {same:q.swatch===cropSwatch(q.texCanvas,3,.2,q.cy,colOf(q)),src:q.swSrc}});
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
      const row=document.querySelector('#ri-top .dot'),chip=document.querySelector('.pchip');
      return {row:!!row&&!row.querySelector('image')&&!!row.querySelector('pattern'),chip:!!chip&&!chip.querySelector('image'),size:row&&Math.round(row.getBoundingClientRect().width),
        elsewhere:/<image/.test(swatchSVG(s))}},it.id);
    ok(today.row&&today.chip&&today.elsewhere,'Today\'s pieces list and chips show the drawn swatch; elsewhere it is the close-up');
    ok(today.size===40,`Today's piece swatches are 40px, so the pattern reads (${today.size}px)`);
    const rows=await p.evaluate(()=>{toggleList();const hs=()=>[...document.querySelectorAll('#today .list .ritem>.row')].map(r=>Math.round(r.getBoundingClientRect().height));
      const big=hs(),st=document.createElement('style');st.textContent='#today .row .dot{width:30px!important;height:30px!important}';document.head.appendChild(st);const small=hs();st.remove();return {big,small}});
    ok(rows.big.length>3&&rows.big.every((h,k)=>h===rows.small[k]),`the larger swatches leave every row the same height (${rows.big.join(',')} px, as with 30px squares)`);
    const legible=await p.evaluate(()=>{const w={id:'w',type:'suit',primaryColor:'khaki',pattern:'windowpane',sett:{v:2,a:0,bands:[['#b0a084',.95],['#9db3cf',.05]],cross:{d:90,bands:[[null,.95],['#9db3cf',.05]],r:1},cr:3.5,tr:9}};
      const tile=s=>+(s.match(/<pattern[^>]*width="([\d.]+)"/)||[])[1];
      const sh={id:'s',type:'shirt',primaryColor:'white',pattern:'woven',sett:{v:4,tex:{kind:'diamond',grid:['1001','0110','0110','1001'],aspect:1.4,lighter:true,contrast:'subtle',rel:.2},a:0,cr:24,tr:45}};
      return {wp:tile(swatchSVG(w,true)),tex:tile(swatchSVG(sh,true))}});
    ok(legible.wp===8&&Math.abs(legible.tex-6.4)<.01,`drawn at a readable scale: two windowpane panes across the square (${legible.wp} of 16), two and a half weave repeats (${legible.tex})`);
    // ---- Wardrobe editor: removing, re-adding and undoing the close-up re-cut the swatch
    const ed=await p.evaluate(async id=>{const it=items.find(x=>x.id===id),tex=it.texture;await setTexture(id,null);const off={src:it.swSrc,img:/<image/.test(swatchSVG(it))};
      await setTexture(id,tex);const on={src:it.swSrc,img:/<image/.test(swatchSVG(it))};await undoPhoto(id);const undo={src:it.swSrc,tex:!!it.texture};return {off,on,undo}},it.id);
    ok(ed.off.src==='photo'&&!ed.off.img&&ed.on.src==='tex'&&ed.on.img,'the editor re-cuts the swatch when the close-up is removed or added');
    ok(ed.undo.src==='photo'&&!ed.undo.tex,'undo restores the close-up and the swatch with it (back to no close-up here)');
    // ---- once: an item that already had a close-up gets its swatch cut from it
    const mig=await p.evaluate(async id=>{const it=items.find(x=>x.id===id);await setTexture(id,(await (async()=>{const b=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();
        return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})})()));
      it.swatch='data:image/png;base64,OLD';delete it.swSrc;localStorage.removeItem('tex_swatch2');const n=await texSwatches(),again=await texSwatches();
      return {n,again,src:it.swSrc,changed:it.swatch!=='data:image/png;base64,OLD'}},it.id);
    ok(mig.n===1&&mig.again===0&&mig.src==='tex'&&mig.changed,'items that already have a close-up get their swatch cut from it, once');
    // ---- lightness from the tagged colour: the user's white shirt close-up (shot dim, reads grey) makes a white swatch with its weave
    const lt=await p.evaluate(async()=>{const rd=async u=>{const b=await (await fetch(u)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})};
      const stat=async url=>{const im=await imgOf(url),c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,128,128).data,L=[];
        for(let i=0;i<d.length;i+=4)L.push(rgbLab(d[i],d[i+1],d[i+2])[0]);L.sort((a,b)=>a-b);return {med:L[L.length>>1],swing:L[Math.floor(L.length*.9)]-L[Math.floor(L.length*.1)],top:L[Math.floor(L.length*.99)]}};
      const tex=await rd('tests/fixtures/shirt-diamond-closeup.jpg'),sh={id:'sw1',type:'shirt',primaryColor:'white',pattern:'woven',texture:tex,photo:'data:image/png;base64,PHOTO'};
      const raw=await stat(cropSwatch(await (async()=>{const im=await imgOf(tex),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c})()));
      await refreshSwatch(sh);const w=await stat(sh.swatch),white=rgbLab(...hexRgb(colOf(sh)))[0];
      sh.primaryColor='lightblue';await refreshSwatch(sh);const lb=await stat(sh.swatch),lbL=rgbLab(...hexRgb(colOf(sh)))[0];
      return {raw,w,white,lb,lbL}});
    ok(lt.raw.med<70&&Math.abs(lt.w.med-lt.white)<4,`the white shirt's swatch is white, not the close-up's grey (median L* ${lt.w.med.toFixed(0)} for white ${lt.white.toFixed(0)}; the close-up as shot ${lt.raw.med.toFixed(0)})`);
    ok(lt.w.swing>1.5&&lt.w.top<=100,`its weave still shows (a ${lt.w.swing.toFixed(1)} L* swing), the lightest threads under paper white`);
    ok(Math.abs(lt.lb.med-lt.lbL)<4,`tagged another colour, the swatch takes that colour's lightness (L* ${lt.lb.med.toFixed(0)} for ${lt.lbL.toFixed(0)})`);
    const card=await p.evaluate(async()=>{show('add');const b=await (await fetch('tests/fixtures/blazer-windowpane.jpg')).blob();await addFiles([new File([b],'b.jpg',{type:'image/jpeg'})]);
      const q=queue[0];const c=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([c],'c.jpg',{type:'image/jpeg'}));
      const before=q.swatch;setq(0,'primaryColor','navy');return {changed:q.swatch!==before,same:q.swatch===cropSwatch(q.texCanvas,q.zoom,q.cx,q.cy,colOf(q))}});
    ok(card.changed&&card.same,'changing the colour on the Add card re-cuts the close-up swatch to match');
    const clip=await p.evaluate(()=>{const lab=()=>[...document.querySelectorAll('#today .list .row .mut')].map(m=>m.textContent);const o=planFor()[key(sel)];const none=!o.clip&&!lab().includes('Tie clip');
      items.push({id:'clip1',type:'tieclip',primaryColor:'silver',metal:'silver',pattern:'solid'});items.find(i=>i.type==='suit').vest='no';cache={};renderToday();const o2=planFor()[key(sel)];return {none,has:!!o2.clip&&lab().includes('Tie clip')}});
    ok(clip.none&&clip.has,'a day without a tie clip (a vest day) has no Tie clip row; with one, the row is there');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
