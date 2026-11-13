// A close-up added in the editor keeps a sharp copy (CLOSE_MAX) on the device; "Read pattern from photo" and the colour picker's
// Ask Claude send it instead of the 640 px synced one (a fine twill aliased into a false check at that size). A replaced, removed or
// undone close-up never sends the old sharp copy.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const sent=[];
    await p.route('**/fakeworker/**',async r=>{const b=r.request().postDataJSON()||{};sent.push({path:new URL(r.request().url()).pathname,closeup:b.closeup||null});
      await r.fulfill({json:{model:'m',response:JSON.stringify({type:'blazer',primaryColor:'midgrey',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null})}})});
    await p.evaluate(()=>{localStorage.setItem('worker_url',location.origin+'/fakeworker/');localStorage.setItem('app_token','t');
      items=[{id:'b1',type:'blazer',primaryColor:'midgrey',pattern:'solid',photo:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC',added:1}];flt='all';editing='b1';show('wardrobe')});
    // a 1932x2576 close-up, added from the editor
    const add=()=>p.evaluate(async()=>{const c=document.createElement('canvas');c.width=1932;c.height=2576;const x=c.getContext('2d');for(let y=0;y<c.height;y+=6){x.fillStyle=y%12?'#777':'#999';x.fillRect(0,y,c.width,3)}
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));await replaceTexture('b1',new File([b],'c.jpg',{type:'image/jpeg'}))});
    await add();
    const size=u=>p.evaluate(async u=>{const im=await imgOf(u);return [im.naturalWidth,im.naturalHeight]},u);
    const it=await p.evaluate(()=>items[0].texture);
    ok((await size(it)).join()==='480,640','the synced close-up stays 640 px');
    const sharp=await p.evaluate(()=>sharpCloseOf(items[0]));
    ok((await size(sharp)).join()==='1152,1536','a sharp 1536 px copy is kept on the device');
    await p.evaluate(()=>colAskImgs(items[0],'e').then(x=>window._x=x));
    ok((await size(await p.evaluate(()=>window._x.closeup))).join()==='1152,1536','Ask Claude sends the sharp copy');
    await p.evaluate(()=>{const s=settable;window.settable=()=>true;return rereadSett('b1').catch(()=>{}).finally(()=>{window.settable=s})});
    const pat=sent.find(s=>s.path.endsWith('/pattern'));
    ok(!!pat&&!!pat.closeup&&(await size(pat.closeup)).join()==='1152,1536','"Read pattern from photo" sends the sharp copy');
    // removed: no close-up at all; replaced by a small one through undo: the old sharp copy is not used
    await p.evaluate(()=>setTexture('b1',null,''));
    ok(await p.evaluate(()=>sharpCloseOf(items[0]))===null,'a removed close-up sends nothing');
    await p.evaluate(()=>undoPhoto('b1'));
    ok(await p.evaluate(async()=>items[0].texture&&(await sharpCloseOf(items[0]))!==null),'undone, the close-up is back');
    await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=300;c.height=300;c.getContext('2d').fillRect(0,0,300,300);await setTexture('b1',c.toDataURL('image/jpeg',.85),'')});
    ok(await p.evaluate(async()=>(await sharpCloseOf(items[0]))===items[0].texture),'a different close-up (set without a sharp copy) sends itself, not the old sharp copy');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
