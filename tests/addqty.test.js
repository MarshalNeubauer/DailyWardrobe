// Add several at once (2026-11-14, the owner): a shirt or socks card has a How many stepper (1-12) above Confirm; Confirm then saves that
// many identical items, each with its own id; Undo takes them all back; other types have no stepper and save one.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{if(document.querySelector('#setup.on'))setupClose();openAdd();addManual();setq(0,'type','shirt');setq(0,'primaryColor','white')});
    const s0=await p.evaluate(()=>({row:!!document.querySelector('#queue .qtyrow'),n:document.querySelector('#qty-n-0').textContent,minus:document.querySelector('#qty-m-0').disabled,conf:document.querySelector('#qconf-0').textContent}));
    ok(s0.row&&s0.n==='1'&&s0.minus&&s0.conf==='Confirm','a shirt card has "How many": 1, minus off, Confirm');
    const box=await p.evaluate(()=>{const b=document.querySelector('#qty-p-0').getBoundingClientRect(),r=document.querySelector('#queue .qtyrow').getBoundingClientRect();return {h:Math.round(b.height),w:Math.round(b.width),fit:r.right<=innerWidth+0.5&&document.documentElement.scrollWidth<=innerWidth}});
    ok(box.h>=44&&box.w>=44&&box.fit,`the − and + are ${box.w}×${box.h} px and the row fits the phone`);
    await p.click('#qty-p-0');await p.click('#qty-p-0');
    const s1=await p.evaluate(()=>({n:document.querySelector('#qty-n-0').textContent,minus:document.querySelector('#qty-m-0').disabled,conf:document.querySelector('#qconf-0').textContent,q:queue[0].qty}));
    ok(s1.n==='3'&&!s1.minus&&s1.conf==='Confirm 3'&&s1.q===3,`+ twice: 3, Confirm reads "${s1.conf}"`);
    await p.click('#qty-m-0');ok(await p.evaluate(()=>document.querySelector('#qty-n-0').textContent==='2'),'− takes one off');
    await p.click('#qty-p-0');
    const n0=await p.evaluate(()=>items.length);await p.click('#qconf-0');await p.waitForFunction(n=>items.length===n+3,n0);
    const sv=await p.evaluate(n=>{const add=items.slice(n),db=Promise.all(add.map(i=>tx('readonly',s=>s.get(i.id))));return db.then(d=>({ids:new Set(add.map(i=>i.id)).size,same:add.every(i=>i.type==='shirt'&&i.primaryColor==='white'&&i.cuff===add[0].cuff),stored:d.every(Boolean),toast:document.querySelector('#toast').textContent}))},n0);
    ok(sv.ids===3&&sv.same&&sv.stored,'Confirm 3 saves three white shirts, each its own item, all stored');
    ok(/^Saved 3: White\./.test(sv.toast),`the toast says so with Undo (${sv.toast})`);
    await p.click('#toast button');await p.waitForFunction(n=>items.length===n&&queue.length===1,n0);
    ok(await p.evaluate(()=>queue[0].qty===3&&document.querySelector('#qty-n-0').textContent==='3'),'Undo takes all three back and the card returns with its 3');
    // the top: 12
    await p.evaluate(()=>{queue[0].qty=11;renderAdd()});await p.click('#qty-p-0');
    ok(await p.evaluate(()=>document.querySelector('#qty-n-0').textContent==='12'&&document.querySelector('#qty-p-0').disabled),'at most 12');
    // socks too; other types none, and a number set before changing type is ignored
    await p.evaluate(()=>{setq(0,'type','socks')});ok(await p.evaluate(()=>!!document.querySelector('#queue .qtyrow')&&/pairs/.test(document.querySelector('#queue .qtyl').textContent)),'socks have it ("Identical pairs")');
    await p.evaluate(()=>{setq(0,'type','tie')});ok(await p.evaluate(()=>!document.querySelector('#queue .qtyrow')&&document.querySelector('#qconf-0').textContent==='Confirm'),'a tie has no stepper');
    const n1=await p.evaluate(()=>items.length);await p.click('#qconf-0');await p.waitForFunction(n=>items.length>n,n1);await p.waitForTimeout(200);
    ok(await p.evaluate(n=>items.length===n+1,n1),'and saves one, though 12 was set while it was a shirt');
    ok(!errs.length,'no page errors: '+errs.join(' | '));
    await ctx.close();
  }finally{await browser.close()}
};
