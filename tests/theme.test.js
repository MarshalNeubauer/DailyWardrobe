// Theme button: Auto (follow the device) → Light → Dark → Auto, saved per device, applied before first paint.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const bg=p=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  const LIGHT='rgb(232, 235, 236)',DARK='rgb(13, 20, 27)';
  // a desktop browser set to light mode
  const ctx=await browser.newContext({colorScheme:'light'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  ok(await bg(p)===LIGHT&&(await p.textContent('#theme-btn'))==='◐','starts on Auto, following the light system setting');
  await p.click('#theme-btn');ok(await bg(p)===LIGHT&&(await p.getAttribute('#theme-btn','aria-label')).includes('light'),'first tap: Light');
  await p.click('#theme-btn');ok(await bg(p)===DARK&&(await p.getAttribute('#theme-btn','aria-label')).includes('dark'),'second tap: Dark (on a light-mode desktop)');
  await p.reload();await p.waitForFunction(()=>window.appReady);
  ok(await bg(p)===DARK&&await p.evaluate(()=>document.documentElement.dataset.theme)==='dark','Dark survives a reload');
  await p.click('#theme-btn');ok(await bg(p)===LIGHT&&await p.evaluate(()=>!document.documentElement.dataset.theme),'third tap: back to Auto');
  // a phone in dark mode can still choose Light
  const ctx2=await browser.newContext({colorScheme:'dark'});const q=await ctx2.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);
  ok(await bg(q)===DARK,'Auto follows a dark system setting');
  await q.click('#theme-btn');ok(await bg(q)===LIGHT,'Light overrides a dark system setting');
  ok(errs.length===0,'no page errors');
  await browser.close();
};
