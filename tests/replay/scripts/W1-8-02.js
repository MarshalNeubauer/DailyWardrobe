// W1-8-02: with a location (Kuwait City) but no climate history (Open-Meteo's archive unreachable), days past the forecast
// fall to the temperate calendar: a Kuwait January is "cold" and the overcoat is planned. Real clock (setup needs the geocoder).
const V=require('./_verify8-lib.js');
V.run('W1-8-02',async(phones)=>{
  const ph=await V.phone('clim');phones.push(ph);
  await ph.ctx.route(/archive-api\.open-meteo\.com/,r=>r.abort());   // stands in for the archive request failing (offline, 429, outage)
  // the route alone no longer caught the request in WebKit (climate came back "loaded" on aa24910 too), so the page's fetch fails it as well
  await ph.ctx.addInitScript(()=>{const f=window.fetch;window.fetch=function(u,...a){if(/archive-api\.open-meteo\.com/.test(String(u&&u.url||u)))return Promise.reject(new TypeError('Load failed'));return f.call(this,u,...a)}});
  await ph.page.goto(V.URL);await ph.ready();await V.sleep(1200);
  await ph.tapText(/Get started/,'#setup button');for(let i=0;i<3;i++){await V.sleep(400);await ph.tapText(/^Next$/,'#setup button')}
  await ph.tap('#su-city');await ph.page.keyboard.type('Kuwait City');await ph.tap('#su-find');
  await ph.tapText(/Kuwait City, Al Asimah/,'#setup button');await V.sleep(1200);
  for(let i=0;i<2;i++){await V.sleep(400);await ph.tapText(/^Next$/,'#setup button')}
  await V.sleep(400);await ph.tapText(/Try a sample wardrobe/,'#setup button');await V.sleep(2500);
  await ph.tapText(/^Wardrobe$/,'nav button');await ph.tap('#ward-add');await V.sleep(700);await ph.tapText(/Import from a spreadsheet/);
  await ph.page.fill('#kit-paste','Type,Colour\nOvercoat,Camel');await ph.page.dispatchEvent('#kit-paste','input');await V.sleep(700);
  await ph.tapText(/Add 1 item/,'#kitsheet button');await V.sleep(1500);await ph.tapText(/^Today$/,'nav button');await V.sleep(1500);await ph.guard();
  const D=[[2026,11,6],[2027,0,10],[2027,1,9]];
  const look=()=>ph.page.evaluate(D=>{const out={};for(const [y,m,d] of D){const x=new Date(y,m,d),o=HOOK.planMonth(y,m)[HOOK.key(x)];out[HOOK.key(x)]={coat:o&&o.coat?o.coat.name||o.coat.id:null,season:HOOK.dayClimate(x).season}}
    return {loc:HOOK.settings.location&&{name:HOOK.settings.location.name,cc:HOOK.settings.location.cc},climate:HOOK.climate?'loaded':null,holidayCC:HOOK.settings.holidays&&HOOK.settings.holidays.country,days:out}},D);
  const a=await look();
  for(let i=0;i<90;i++){if(await ph.page.evaluate(()=>HOOK.key(HOOK.sel))==='2027-1-10')break;await ph.tap('#today .day button[aria-label*="ext"], #today .day button:has-text("›")');await V.sleep(250)}
  await V.sleep(1000);const tiles=await ph.page.evaluate(()=>[HOOK.key(HOOK.sel),[...document.querySelectorAll('#today .below .tile small')].map(e=>e.innerText).join(', ')]);
  const ok=a.loc&&!a.climate&&Object.values(a.days).every(d=>d.season==='cold'&&d.coat)&&/Overcoat/i.test(tiles[1]);
  V.verdict(!!ok,{withLocation:a,todayJan10:tiles,note:'CC_TMAX.KW Jan high is 19 C (mild); dayClimate only uses it when !settings.location'});
});
