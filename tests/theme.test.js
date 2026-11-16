// Theme button: Auto (follow the device) → the other theme → the device's own → Auto, saved per device, applied before first paint;
// the first tap always changes what is on screen (fix round 3, W2-14-13: on a light phone it chose Light and nothing changed).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const bg=p=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  const LIGHT='rgb(232, 235, 236)',DARK='rgb(13, 20, 27)';
  // a desktop browser set to light mode
  const ctx=await browser.newContext({colorScheme:'light'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  ok(await bg(p)===LIGHT&&(await p.textContent('#theme-btn'))==='◐','starts on Auto, following the light system setting');
  await p.click('#theme-btn');ok(await bg(p)===DARK&&(await p.getAttribute('#theme-btn','aria-label')).includes('dark'),'first tap: Dark (on a light-mode desktop), so the screen changes');
  ok(/Dark theme/.test(await p.textContent('#toast')),'and a line says so');
  await p.reload();await p.waitForFunction(()=>window.appReady);
  ok(await bg(p)===DARK&&await p.evaluate(()=>document.documentElement.dataset.theme)==='dark','Dark survives a reload');
  await p.click('#theme-btn');ok(await bg(p)===LIGHT&&(await p.getAttribute('#theme-btn','aria-label')).includes('light'),'second tap: Light');
  await p.click('#theme-btn');ok(await bg(p)===LIGHT&&await p.evaluate(()=>!document.documentElement.dataset.theme),'third tap: back to Auto');
  // a phone in dark mode can still choose Light
  const ctx2=await browser.newContext({colorScheme:'dark'});const q=await ctx2.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);
  ok(await bg(q)===DARK,'Auto follows a dark system setting');
  await q.click('#theme-btn');ok(await bg(q)===LIGHT,'Light overrides a dark system setting');
  ok(errs.length===0,'no page errors');
  await browser.close();
};
