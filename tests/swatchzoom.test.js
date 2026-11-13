// A swatch on Today's picture tapped (app.js swTap, the owner's pick 2026-11-13): it opens large at the top left with no name (the owner's
// ask), the small swatches shrink to 44 px in their column at the bottom left (36 px under 350 px; the open one outlined), the photo zooms
// so the piece lands on the right, ringed (no label); nothing overlaps; another swatch switches; the same swatch, a tap on the picture or
// another day close it.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};
      for(const d of [new Date(2026,10,11),new Date(2026,10,12)]){const o=planOn(d);renders[comboKey(o)]={img:'${PH}',sig:comboSig(o)}}   // a kept photo for each day, so the picture is drawn
      sel=new Date(2026,10,11);view={y:2026,m:10};show('today')})()`);
    await p.waitForSelector('#mannequin-container.photo .swstack .ovsw');
    const st=()=>p.evaluate(()=>{const c=$('#mannequin-container'),R=c.getBoundingClientRect(),rel=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {l:b.left-R.left,t:b.top-R.top,r:b.right-R.left,b:b.bottom-R.top}};
      const sws=[...c.querySelectorAll('.swstack .ovsw')];return {W:R.width,open:c.classList.contains('swopen'),t:zoomTarget().style.transform,lens:rel(c.querySelector('.swlens')),lab:rel(c.querySelector('.swlab')),
        labText:(c.querySelector('.swlab')||{}).textContent||'',ring:rel(c.querySelector('.swring')),scroll:c.scrollTop+c.scrollLeft,stack:rel(c.querySelector('.swstack')),sw:sws.map(rel),on:sws.filter(b=>b.classList.contains('on')).map(b=>b.dataset.s),
        pressed:sws.map(b=>b.getAttribute('aria-pressed')),slots:sws.map(b=>b.dataset.s),painted:/as painted/i.test(c.textContent),onShadow:(()=>{const b=sws.find(x=>x.classList.contains('on'));return b?getComputedStyle(b).boxShadow:''})(),share:getComputedStyle(c.querySelector('.wshare')||c).opacity}});
    const a=await st();
    ok(!a.open&&a.slots.join()==='top,shirt,tie'&&a.sw.every(s=>Math.round(s.r-s.l)===64),`the stack is three tappable 64 px swatches (${a.slots.join()})`);
    const over=(x,y)=>x&&y&&x.l<y.r&&y.l<x.r&&x.t<y.b&&y.t<x.b;
    for(const s of ['top','shirt','tie']){
      await p.click(`#mannequin-container .ovsw[data-s="${s}"]`);await settle(p,900);
      const b=await st();
      ok(b.open&&/scale\(2\.3\)/.test(b.t)&&b.on.join()===s&&b.pressed.filter(x=>x==='true').length===1,`${s}: the photo zooms and the tapped swatch is outlined (${b.t})`);
      ok(b.lens&&Math.abs(b.lens.l-12)<2&&Math.abs(b.lens.t-12)<2&&Math.abs((b.lens.r-b.lens.l)-.46*b.W)<3&&!b.lab&&!b.labText&&!b.painted,`${s}: the swatch is large at the top left, with no name and no "as painted"`);
      ok(b.sw.every(x=>Math.round(x.r-x.l)===44)&&b.stack&&Math.abs(b.W-b.stack.b-10)<2,`${s}: the small swatches shrink to 44 px, still a column at the bottom left`);
      ok(b.ring&&b.ring.l>=-1&&b.ring.r<=b.W+1&&b.ring.t>=-1&&b.ring.b<=b.W+1&&!over(b.ring,b.lens)&&!over(b.ring,b.stack)&&!over(b.lens,b.stack)&&b.scroll===0,
        `${s}: the ring on the piece, the big swatch and the small swatches don't overlap (ring ${Math.round(b.ring.l)}-${Math.round(b.ring.r)} x ${Math.round(b.ring.t)}-${Math.round(b.ring.b)}; big swatch to ${Math.round(b.lens.b)}, small from ${Math.round(b.stack.t)})`);
      ok(+b.share===0,`${s}: share, ✕ and ✓ step out of the way`);
      ok(/rgba\(255, 255, 255, 0\.7\) 0px 0px 0px 1\.5px/.test(b.onShadow),`${s}: the open small swatch has a thin, soft white outline (${b.onShadow})`)}
    // narrower phones, opened by real taps: a tap focuses the swatch, and that once scrolled the zoomed picture inside its frame, pushing the
    // big swatch and the ring out of place (seen in the owner's preview at 375 px)
    await p.click('#mannequin-container .ovsw[data-s="tie"]');await settle(p,500);   // (the tie, still open from above, closes)
    for(const [vw,px] of [[375,44],[330,36]]){await p.setViewportSize({width:vw,height:812});await p.evaluate(()=>renderToday());await settle(p,400);
      for(const s of ['top','shirt','tie']){await p.click(`#mannequin-container .ovsw[data-s="${s}"]`);await settle(p,900);const n=await st();
        ok(n.open&&n.scroll===0&&n.lens&&Math.abs(n.lens.t-12)<2&&n.ring&&n.sw.every(x=>Math.round(x.r-x.l)===px)&&!over(n.lens,n.stack)&&!over(n.ring,n.lens)&&!over(n.ring,n.stack)&&n.ring.t>=-1,
          `${vw} px, ${s}: ${px} px small swatches, nothing moves out of place or overlaps (frame scrolled ${n.scroll} px; big swatch to ${n.lens&&Math.round(n.lens.b)}, small from ${n.stack&&Math.round(n.stack.t)})`)}
      await p.click('#mannequin-container .ovsw[data-s="tie"]');await settle(p,600)}
    await p.setViewportSize({width:390,height:844});await p.evaluate(()=>renderToday());await settle(p,300);
    // the same swatch closes; a tap on the picture closes; another day closes
    await p.click('#mannequin-container .ovsw[data-s="tie"]');await settle(p,700);
    await p.click('#mannequin-container .ovsw[data-s="tie"]');await settle(p,700);
    const c=await st();ok(!c.open&&!c.lens&&!c.ring&&c.t===''&&c.sw.every(x=>Math.round(x.r-x.l)===64),'tapping the open swatch again closes it and the swatches grow back');
    await p.click('#mannequin-container .ovsw[data-s="shirt"]');await settle(p,600);
    await p.mouse.click(...await p.evaluate(()=>{const b=$('#mannequin-container').getBoundingClientRect();return [b.left+b.width*.8,b.top+b.height*.85]}));await settle(p,600);
    ok(!(await st()).open,'a tap on the picture closes it');
    await p.click('#mannequin-container .ovsw[data-s="shirt"]');await settle(p,600);
    await p.evaluate(()=>stepDay(1,0));await settle(p,600);
    const d=await st();ok(!d.open&&d.t===''&&!d.lens,'moving to another day closes it');
    // a redraw of the same day keeps it open
    await p.click('#mannequin-container .ovsw[data-s="top"]');await settle(p,600);await p.evaluate(()=>renderToday());await settle(p,300);
    const e=await st();ok(e.open&&e.on.join()==='top'&&e.lens&&/scale\(2\.3\)/.test(e.t),'a redraw of the same day keeps the swatch open');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
