// The New colour sheet's drawn item follows the finger (colpick.js cnLive → cnFigLive; the owner's ask, 2026-11-15: "as I move the colour
// around the suit updates live, not just when I lift my finger"): a drag in the square and along the hue bar with several moves and no
// lift recolours "Your suit, drawn" between steps, at most once a frame, with the big swatch and its hex; a hex typed recolours it before
// the field is left; the lift still draws the sheet again as before; nothing is fetched or saved while moving; the figure doesn't move;
// the redraw's cost (Chromium at 4× CPU throttling; WebKit with npm run test:webkit). The worker is stubbed (no paid call).
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  let calls=0;
  await ctx.route('https://w.test/**',route=>{calls++;return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok')});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  // what the figure shows: its fills, the shade it was drawn in, where it sits
  const fig=()=>p.evaluate(()=>{const d=document.querySelector('#col-sheet .cpph.cpfig .cpdraw'),r=d.getBoundingClientRect();
    return {fills:[...d.querySelectorAll('[fill]')].map(e=>e.getAttribute('fill')).filter(f=>/^#/.test(f)).join(),hex:d.dataset.hex||null,cur:colPick.newc.hex,rgb:'rgb('+hexRgb(colPick.newc.hex).join(',')+')',
      big:document.querySelector('#col-sheet .cpbig').style.background,cap:document.querySelector('#col-sheet .cpbig figcaption').textContent,field:document.querySelector('#cn-hex').value,
      box:[r.x,r.y,r.width,r.height].map(Math.round).join(),y:document.querySelector('#col-sheet').scrollTop}});
  const frame=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{rememberRole({role:'owner'});items=[{id:'s1',type:'suit',primaryColor:'grey',pattern:'solid',added:1}];openColPick('e','s1','primaryColor')});
    await p.click('#cn-open');
    ok(await p.evaluate(()=>/Your suit, drawn/.test(document.querySelector('#col-sheet .cpph figcaption').textContent)&&getComputedStyle(document.querySelector('#cn-sq')).touchAction==='none'&&getComputedStyle(document.querySelector('#cn-hue')).touchAction==='none'),
      'the sheet shows "Your suit, drawn"; the square and the hue bar don\'t scroll the sheet (touch-action none)');
    await p.evaluate(()=>{document.querySelector('#cn-sq').dataset.mark='1';let n=0;const f=cnDrawn;window.cnDrawn=(...a)=>{n++;return f(...a)};window.__draws=()=>n});
    const before=await fig();calls=0;
    // the square: down, four moves, no lift
    const box=await p.locator('#cn-sq').boundingBox(),steps=[[.2,.3],[.45,.25],[.7,.15],[.9,.1],[.55,.6]];
    await p.mouse.move(box.x+box.width*steps[0][0],box.y+box.height*steps[0][1]);await p.mouse.down();await frame();
    const seen=[await fig()];
    for(const [x,y] of steps.slice(1)){await p.mouse.move(box.x+box.width*x,box.y+box.height*y,{steps:4});await frame();seen.push(await fig())}
    const changed=seen.every((s,i)=>!i||s.fills!==seen[i-1].fills),follows=seen.every(s=>s.hex===s.cur&&s.fills.includes(s.cur)),diff=seen[0].fills!==before.fills;
    ok(diff&&changed&&follows,`dragging in the square recolours the drawn suit at every step, before the finger lifts (${seen.map(s=>s.cur).join(' → ')})`);
    ok(seen.every(s=>s.field===s.cur.toUpperCase()&&s.cap===s.cur.toUpperCase()&&s.big.replace(/\s/g,'')===s.rgb),'the big swatch, its hex label and the Hex field follow too');
    ok(seen.every(s=>s.box===before.box&&s.y===before.y),`the figure doesn't move or resize while dragging (${before.box})`);
    ok(await p.evaluate(()=>document.querySelector('#cn-sq').dataset.mark==='1'&&items[0].primaryColor==='grey'),'while moving the sheet isn\'t drawn again and nothing is saved');
    const draws=await p.evaluate(()=>window.__draws());
    ok(draws<=seen.length+4*(steps.length-1)&&draws>=seen.length-1,`one redraw a frame at most (${draws} redraws for ${1+4*(steps.length-1)} moves)`);
    // the lift: the sheet is drawn again as before, in the last shade
    const last=seen.at(-1).cur;await p.mouse.up();await settle(p,100);
    let e=await p.evaluate(()=>({mark:document.querySelector('#cn-sq').dataset.mark||null,hex:colPick.newc.hex,th:document.querySelector('#cn-sq .cnthumb').style.left,s:Math.round(colPick.newc.s),field:document.querySelector('#cn-hex').value,saved:items[0].primaryColor}));
    const after=await fig();
    ok(!e.mark&&e.hex===last&&e.field===last.toUpperCase()&&e.s===55&&after.fills.includes(last)&&e.saved==='grey','the lift draws the sheet again in the last shade, as before, still unsaved until Add');
    // the hue bar: three moves, no lift
    const hb=await p.locator('#cn-hue').boundingBox(),hues=[];
    await p.mouse.move(hb.x+hb.width*.1,hb.y+hb.height/2);await p.mouse.down();await frame();hues.push(await fig());
    for(const x of [.35,.6,.85]){await p.mouse.move(hb.x+hb.width*x,hb.y+hb.height/2,{steps:3});await frame();hues.push(await fig())}
    ok(hues.every((s,i)=>(!i||s.fills!==hues[i-1].fills)&&s.fills.includes(s.cur)),`dragging the hue bar recolours the suit at every step (${hues.map(s=>s.cur).join(' → ')})`);
    // a burst of moves inside one frame (a 120 Hz screen, coalesced touches): one redraw, in the last shade
    e=await p.evaluate(async()=>{const el=document.querySelector('#cn-hue'),r=el.getBoundingClientRect(),n0=window.__draws();
      for(let i=0;i<10;i++)el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width*(.86-i*.02),clientY:r.top+r.height/2,pointerId:1}));
      await new Promise(f=>requestAnimationFrame(()=>requestAnimationFrame(f)));const d=document.querySelector('#col-sheet .cpph.cpfig .cpdraw');
      return {n:window.__draws()-n0,last:d.dataset.hex===colPick.newc.hex}});
    ok(e.n===1&&e.last,`ten moves in one frame redraw the suit once, in the last shade (${e.n})`);
    await p.mouse.up();await settle(p,100);
    // the hex field: typed, not yet left
    await p.fill('#cn-hex','#2a6e3f');await frame();const hx=await fig();
    ok(hx.cur==='#2a6e3f'&&hx.fills.includes('#2a6e3f')&&hx.cap==='#2A6E3F','a valid hex typed recolours the suit before the field is left');
    await p.fill('#cn-hex','#2a6e');await frame();
    ok((await fig()).fills.includes('#2a6e3f'),'a half-typed hex leaves the suit as it was');
    ok(calls===0,`nothing is fetched while moving or typing (${calls})`);
    // the cost of one redraw: the figure's drawing, put in and laid out (Chromium throttled 4×, as a slower phone)
    let cdp=null;try{cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})}catch{cdp=null}
    const cost=await p.evaluate(async()=>{const d=document.querySelector('#col-sheet .cpph.cpfig .cpdraw'),it=colTarget(),t=[];
      for(let i=0;i<40;i++){const t0=performance.now();d.innerHTML=cnDrawn(it,cnFromHsv(i*9,60,55),'primaryColor');d.getBoundingClientRect();t.push(performance.now()-t0);await new Promise(r=>requestAnimationFrame(r))}
      t.sort((a,b)=>a-b);return {med:t[20],p90:t[36]}});
    if(cdp)await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    console.log(`    redraw per frame${cdp?' (4× CPU throttling)':''}: median ${cost.med.toFixed(1)} ms, 90th ${cost.p90.toFixed(1)} ms`);
    ok(cost.p90<12,`a redraw fits well inside a 60 fps frame (90th percentile ${cost.p90.toFixed(1)} ms)`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};
