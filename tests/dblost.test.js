// The database connection lost while the app runs (2026-11-14, a tester's iPhone 17 Pro: iOS Safari closes it when the app has been in
// the background, and every transaction then throws InvalidStateError): the sample wardrobe, Confirm on Add and the rest did nothing,
// silently, and a navy suit card was left on Add at each tap of the sample. Now the connection is opened again and the save goes
// through; if storage stays broken, Confirm says so, the card stays, and the sample leaves nothing on Add.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  const open=async()=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);return p};
  const card=()=>({id:crypto.randomUUID(),manual:true,type:'shirt',primaryColor:'white',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf'});
  try{
    // the connection closed under the app (closed by script: no close event, as when Safari drops it): the next save opens it again
    const p=await open();
    const a=await p.evaluate(async()=>{dbConn.close();await kitSampleLoad();const stored=await tx('readonly',s=>s.count());return {items:items.length,queue:queue.length,stored}});
    ok(a.items===24&&a.queue===0&&a.stored===24,`the sample wardrobe loads after the connection was lost (${JSON.stringify(a)})`);
    const b=await p.evaluate(async c=>{dbConn.close();queue.unshift(c);await save(0);return {queue:queue.length,stored:!!await tx('readonly',s=>s.get(c.id))}},await p.evaluate(card));
    ok(b.queue===0&&b.stored,'Confirm on a card without a photo saves after the connection was lost');
    ok(!p.errs.length,'no page errors: '+p.errs.join(' | '));await p.context().close();
    // storage that stays broken: said, never silent
    const q=await open();
    await q.evaluate(()=>{const T=IDBDatabase.prototype.transaction;window.__T=T;IDBDatabase.prototype.transaction=function(){throw new DOMException('The database connection is closing.','InvalidStateError')}});
    await q.evaluate(async()=>{queue.unshift({id:'c1',manual:true,type:'shirt',primaryColor:'white',secondaryColor:null,tertiaryColor:null,pattern:'solid',metal:'silver',leather:'calf'});show('add');await save(0)});
    const c=await q.evaluate(()=>({queue:queue.map(x=>x.id).join(),items:items.length,toast:document.querySelector('#toast').textContent}));
    ok(c.queue==='c1'&&c.items===0&&/Couldn’t save/.test(c.toast)&&/open it again/.test(c.toast),`Confirm says it couldn't save and the card stays (${c.toast})`);
    await q.evaluate(async()=>{queue.length=0;await new Promise(r=>setTimeout(r,1600));await kitSampleLoad()});
    const d=await q.evaluate(()=>({queue:queue.length,items:items.length,toast:document.querySelector('#toast').textContent}));
    ok(d.queue===0&&d.items===0&&/Couldn’t save/.test(d.toast),`the sample says so and leaves no card on Add (${JSON.stringify(d)})`);
    ok(!q.errs.length,'no page errors: '+q.errs.join(' | '));await q.context().close();
  }finally{await browser.close()}
};
