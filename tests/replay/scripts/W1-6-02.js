// W1-6-02: phone B has the item sheet open on "Pink shirt" while phone A deletes it; after B's sync the sheet stays open,
// takes a new name, and on Done the piece and the typed name are gone with no message.
const L=require('./_verify6-lib.js');
L.main(async()=>{
  await L.startLab('W1-6-02','2026-11-15T09:00:00+03:00');
  const link=await L.newInvite('v6-02');
  const A=await L.open('02-A',link);await L.importRows(A);await L.backup(A);
  const B=await L.open('02-B',link);await L.sleep(2500);
  L.log('B items',(await L.names(B)).length);
  await L.openItem(B,'Pink shirt');
  // A: Wardrobe -> Pink shirt -> Delete item, backed up
  await L.openItem(A,'Pink shirt');await L.tapText(A,'Delete item');await L.sleep(800);await L.backup(A);
  // B: a minute later, background and back, sheet still open
  await L.later(B);await L.sleep(1500);
  const mid=await B.page.evaluate(()=>({open:!document.querySelector('#item-view').hidden&&!!HOOK.editing,title:(document.querySelector('#iv-title')||{}).textContent,count:(document.querySelector('#ivhead .pcount')||{}).textContent,inItems:HOOK.items.some(i=>i.name==='Pink shirt'),n:HOOK.items.length}));
  L.log('B sheet after sync',mid);
  const inp=L.nameInput(B);await inp.fill('Pink shirt (fav)');await inp.press('Tab');await L.sleep(500);
  const toastBefore=await B.page.evaluate(()=>(document.querySelector('#toast')||{}).innerText||'');
  await L.done(B);await L.sleep(800);
  const after=await B.page.evaluate(()=>({names:HOOK.items.map(i=>i.name),toast:(document.querySelector('#toast')||{}).innerText||'',body:document.body.innerText.includes('Pink shirt (fav)')}));
  L.log('B after Done',after,'toast while typing',toastBefore);
  const told=/deleted|another (phone|device)/i.test(after.toast+toastBefore);
  await L.finish(mid.open&&!mid.inItems&&!after.names.some(n=>/Pink shirt/.test(n))&&!told,{sheetAfterSync:mid,afterDone:after.names.length+' items, no Pink shirt',toast:after.toast});
});
