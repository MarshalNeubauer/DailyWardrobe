// W1-3-05: an own pattern can take a built-in pattern's name. Settings -> Your colors & patterns -> "+ New pattern", name
// "Birdseye", Add: accepted as own-birdseye, and a suit's pattern list then has two "Birdseye". (Colors refuse the same.)
const L=require('./_verify3-lib.js');
async function newPattern(ph,name){
  await ph.tap('header button:has(svg.hgear)');await L.sleep(900);
  if(await ph.page.evaluate(()=>document.querySelector('[aria-controls="sp-tagging"]').getAttribute('aria-expanded')!=='true')){
    await ph.tap('[aria-controls="sp-tagging"]');await L.sleep(1200)}
  await ph.tap('#cust-newpat');await L.sleep(900);
  const n=ph.page.locator('#cn-name');await n.fill(name);await n.dispatchEvent('input');await n.dispatchEvent('change');await L.sleep(600);
  await ph.tap('#cn-add');await L.sleep(1200);
  const err=await ph.page.evaluate(()=>{const e=document.querySelector('#cn-error');return e?e.innerText:''});
  await ph.page.keyboard.press('Escape');await L.sleep(400);await ph.page.keyboard.press('Escape');await L.sleep(600);
  return err}
L.main(async()=>{
  await L.startLab('W1-3-05',L.NEW,'2026-11-15T08:00:00+03:00');
  const A=await L.open('W1-3-05-A');await L.skipSetup(A);await L.sleep(1000);
  const e1=await newPattern(A,'Birdseye');const e2=await newPattern(A,'Herringbone');
  const r=await A.page.evaluate(()=>({own:(HOOK.settings.custom&&HOOK.settings.custom.patterns||[]).map(p=>p.key+':'+p.name),
    suitList:HOOK.patChoices({type:'suit',pattern:'solid'}).map(p=>HOOK.patName(p)).filter(n=>/birdseye|herringbone/i.test(n))}));
  const ok=!e1&&r.own.some(x=>/^own-birdseye:Birdseye$/.test(x))&&r.suitList.filter(n=>/^birdseye$/i.test(n)).length===2;
  await L.finish(ok,{errors:{Birdseye:e1,Herringbone:e2},...r});
});
