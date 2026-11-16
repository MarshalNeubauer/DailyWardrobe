// W1-6-01: the owner's "Delete everything" on phone A is undone by his second owner phone B on its next sync.
const L=require('./_verify6-lib.js');
async function ownerConnect(ph){
  await ph.page.evaluate(()=>openSettings('connection'));await L.sleep(800);
  await L.tapText(ph,'I run the server');await L.sleep(400);
  await ph.page.fill('#cfg-url',L.W);await ph.page.fill('#cfg-token','owner-secret');
  await ph.page.evaluate(()=>saveSettings());   // (as tests/connkeep.test.js does; Done saves the same fields)
  await ph.page.evaluate(()=>typeof closeSettings==='function'&&closeSettings()).catch(()=>{});await L.sleep(3000);await L.checkWorker(ph);
}
async function deleteEverything(ph){
  await ph.page.evaluate(()=>openSettings());await L.sleep(900);
  if(await ph.page.evaluate(()=>document.querySelector('#sc-about .scat-head').getAttribute('aria-expanded'))!=='true'){await ph.page.evaluate(()=>document.querySelector('#sc-about .scat-head').scrollIntoView({block:'center'}));await ph.tap('#sc-about .scat-head');await L.sleep(1200)}
  for(let k=0;k<4&&await ph.page.evaluate(()=>document.querySelector('#del-confirm').hidden);k++){await L.tapText(ph,'Delete my data','#sc-about');await L.sleep(700)}
  const card=await ph.page.evaluate(()=>document.querySelector('#del-confirm').innerText);
  await L.tapText(ph,'Delete everything');await L.sleep(5000);return card}
const own=d=>Object.keys(d).filter(k=>/^(wardrobe:v1|snap:)/.test(k));
L.main(async()=>{
  await L.startLab('W1-6-01','2026-11-15T09:00:00+03:00');
  const A=await L.open('01-A');await ownerConnect(A);await L.importRows(A);await L.sleep(4000);   // the owner backs up 2.5 s after a change
  const B=await L.open('01-B');await ownerConnect(B);await L.sleep(2000);
  const bItems=(await L.names(B)).length;L.log('B items',bItems,'server keys',own(await L.kv()));
  const card=await deleteEverything(A);L.log('delete card',card.replace(/\s+/g,' ').slice(0,300));
  const aSays=(await A.page.evaluate(()=>document.body.innerText)).includes('deleted from this device and from the server');
  const k1=own(await L.kv());L.log('A says deleted',aSays,'server keys right after',k1);
  await L.later(B);await L.sleep(3000);
  const d=await L.kv();const k2=own(d);const bText=await B.page.evaluate(()=>document.body.innerText);
  L.log('B items',(await L.names(B)).length,'B mentions deletion',/deleted/i.test(bText),'server keys after B synced',k2);
  await L.finish(bItems===13&&aSays&&k1.length===0&&k2.includes('wardrobe:v1'),{keysAfterDelete:k1,keysAfterBSync:k2,wardrobeBytes:d['wardrobe:v1']?JSON.stringify(d['wardrobe:v1']).length:0});
});
