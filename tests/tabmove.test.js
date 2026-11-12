// Moving between pages (app.js pageIn): the page arriving eases in from the side its tab is on (Today, Wardrobe, Add left to right) with a
// fade, a page opened from Settings rises in, the tab bar's marker slides to the tab, and with reduced motion it all changes at once.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await settle(p,300);
    const go=t=>p.evaluate(t=>{const nav=document.querySelector('body>nav');show(t);const el=document.querySelector('#'+t),a=el.getAnimations()[0];
      const k=a?a.effect.getKeyframes():[];return {t,from:k[0]?k[0].transform:'',op:k[0]?k[0].opacity:null,ms:a?a.effect.getTiming().duration:0,ti:nav.style.getPropertyValue('--ti'),none:nav.classList.contains('tab-none'),
        shown:['today','wardrobe','add','stats'].filter(s=>!document.querySelector('#'+s).hidden)}},t);
    const w=await go('wardrobe');
    ok(w.from==='translateX(28px)'&&w.op==0&&w.ms>=250&&w.ms<=450&&w.shown.join()==='wardrobe',`Today → Wardrobe: Wardrobe eases in from the right with a fade (${w.from}, ${w.ms} ms), Today gone at once`);
    await settle(p,500);
    const marker=await p.evaluate(()=>{const nav=document.querySelector('body>nav'),b=document.querySelector('#n-wardrobe').getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(nav,'::before').transform);
      return {x:Math.round(m.m41),left:Math.round(b.left),w:Math.round(parseFloat(getComputedStyle(nav,'::before').width)),bw:Math.round(b.width),anim:getComputedStyle(nav,'::before').transitionProperty}});
    ok(Math.abs(marker.x-marker.left)<=1&&Math.abs(marker.w-marker.bw)<=1&&/transform/.test(marker.anim),`the tab bar's marker slides to Wardrobe and sits over it (${marker.x}px, the tab at ${marker.left}px)`);
    const a=await go('add');ok(a.from==='translateX(28px)'&&a.ti==='2',`Wardrobe → Add: from the right again (${a.from}), the marker on the third tab`);
    await settle(p,400);
    const t=await go('today');ok(t.from==='translateX(-28px)'&&t.ti==='0'&&!t.none,`Add → Today: Today comes from the left (${t.from})`);
    await settle(p,400);
    const s=await go('stats');ok(s.from==='translateY(14px)'&&s.none,`a page opened from Settings (stats) rises in, and the marker fades as no tab is showing (${s.from})`);
    await settle(p,400);
    const same=await p.evaluate(()=>{show('stats');return document.querySelector('#stats').getAnimations().length});
    ok(same===0,'showing the page that is already there doesn\'t move it');
    // a tap during the move: the page takes it (it is never covered)
    await p.evaluate(()=>show('today'));await p.click('#n-wardrobe',{timeout:2000});
    ok(await p.evaluate(()=>!document.querySelector('#wardrobe').hidden),'a tab tapped while the page is still easing in works at once');
    await settle(p,400);
    await p.emulateMedia({reducedMotion:'reduce'});
    const rm=await go('add');ok(rm.from===''&&rm.shown.join()==='add','with reduced motion the page just changes');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
