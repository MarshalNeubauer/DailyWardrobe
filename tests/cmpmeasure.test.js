// The close-up comparison under the item sheet's photos (checklist.js; fix round A, 2026-11-17, the code review's CR-4-13 and CR-4-14):
// a close-up that can't be measured (the picture doesn't load, the phone refuses a canvas) says so instead of "Measuring the close-up…"
// for good, and each drawing's size observer is let go once the drawing has left the page (every redraw made one that watched forever).
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  // count the size observers that are watching something: observe() adds, disconnect() takes away
  await ctx.addInitScript(()=>{const R=window.ResizeObserver;if(!R)return;window.__ro={live:0};window.ResizeObserver=class extends R{constructor(f){super(f);this.__on=false}
    observe(...a){if(!this.__on){this.__on=true;window.__ro.live++}return super.observe(...a)}disconnect(){if(this.__on){this.__on=false;window.__ro.live--}return super.disconnect()}}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // a suit whose close-up is a broken picture and has no measurement of its own
    await p.evaluate(()=>{CK_OPEN['*']=true;items=[{id:'suit001',type:'suit',primaryColor:'navy',pattern:'solid',texture:'data:image/jpeg;base64,AAAA',added:1}];cache={};show('wardrobe');openItem('suit001')});
    await settle(p,500);
    const line=await p.waitForFunction(()=>{const e=document.querySelector('#item-view .cmpmt');return e&&!/Measuring/.test(e.textContent)?e.textContent:null},null,{timeout:5000}).then(h=>h.jsonValue(),()=>p.evaluate(()=>(document.querySelector('#item-view .cmpmt')||{}).textContent||''));
    ok(/Couldn’t measure the close-up/.test(line),`a close-up that can't be measured says so ("${line}"), not "Measuring the close-up…" for good`);
    const n0=await p.evaluate(()=>window.__ro.live);
    for(let i=0;i<6;i++)await p.evaluate(()=>renderItem());
    await p.setViewportSize({width:380,height:844});await settle(p,400);await p.setViewportSize({width:390,height:844});await settle(p,400);
    const n1=await p.evaluate(()=>window.__ro.live);
    ok(n1<=n0+1,`six redraws of the sheet leave no extra size observer watching (${n0} before, ${n1} after a resize)`);
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};
