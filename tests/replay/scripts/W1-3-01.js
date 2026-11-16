// W1-3-01: a sample piece renamed on 15 Nov a (counted as his then) is "Sample" again after the update, and "Remove the sample"
// deletes it, with only "Your own clothes stay." as warning.
const L=require('./_verify3-lib.js');
L.main(async()=>{
  const {A,suitId,before}=await L.buildLegacy('W1-3-01');
  L.log('15 Nov a',before);
  const after=await A.page.evaluate(id=>{const i=items.find(x=>x.id===id);return {name:i&&i.name,sample:!!(i&&i.sample),edited:!!(i&&kitEdited(i)),
    banner:(document.querySelector('#kit-sample')||{}).innerText||''}},suitId);
  await L.openItemId(A,suitId);
  const note=await A.page.evaluate(()=>{const e=document.querySelector('#item-view .ivsample');return e?e.innerText.replace(/\s+/g,' '):''});
  await L.done(A);await L.today(A);
  let ask='';A.onDialog=null;
  await L.tapText(A,'Remove the sample','#kit-sample');await L.sleep(600);
  ask=await A.page.evaluate(()=>{const t=document.querySelector('#ask-title');return t?t.parentElement.innerText.replace(/\s+/g,' '):''});
  await A.tap('#ask-ok');await L.sleep(4000);
  const toast=await A.page.evaluate(()=>document.querySelector('#toast').innerText.replace(/\s+/g,' '));
  const gone=await A.page.evaluate(id=>!items.some(i=>i.id===id),suitId);
  const ok=before.old.editedOldRule&&!after.edited&&after.sample&&/sample wardrobe/i.test(note)&&!/you changed/i.test(ask)&&gone;
  await L.finish(ok,{afterUpdate:after,sheetNote:note,removeAsks:ask,toast,myNavySuitDeleted:gone});
});
