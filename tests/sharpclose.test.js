// A close-up added in the editor keeps a sharp copy (CLOSE_MAX) on the device; "Read pattern from photo" and the colour picker's
// Ask Claude send it instead of the synced one (640 px until 2026-11-13) (a fine twill aliased into a false check at that size). A replaced, removed or
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
    ok((await size(it)).join()==='1152,1536','the synced close-up is 1536 px (TEX_MAX, 2026-11-13: it was 640)');
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
    // a close-up saved at 640 before, with its sharp copy on this device: made again from the sharp copy once, in the old one's colour
    const up=await p.evaluate(async()=>{const mk=(w,h,fill)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=fill;x.fillRect(0,0,w,h);
        for(let y=0;y<h;y+=Math.max(2,h/160|0)){x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,y,w,1)}return c.toDataURL('image/jpeg',.9)};
      const old=mk(480,640,'#6a7f9c'),sharp=mk(1152,1536,'#8aa0c0');items=[{id:'u1',type:'blazer',primaryColor:'steelblue',pattern:'solid',texture:old,added:1},{id:'u2',type:'blazer',primaryColor:'navy',pattern:'solid',texture:old,added:1}];
      await keepCloseImg('u1',sharp,old);localStorage.removeItem('tex_up');const n=await upgradeCloseups(),it=items[0],im=await imgOf(it.texture),av=async u=>{const i=await imgOf(u),c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(i,0,0,16,16);const d=x.getImageData(0,0,16,16).data;let s=[0,0,0];for(let k=0;k<d.length;k+=4)for(let q=0;q<3;q++)s[q]+=d[k+q];return s.map(v=>Math.round(v/256))};
      return {n,w:im.naturalWidth,h:im.naturalHeight,oldAv:await av(old),newAv:await av(it.texture),kept:(await sharpCloseOf(it))===sharp,other:items[1].texture===old,again:await upgradeCloseups(),flag:localStorage.getItem('tex_up')}});
    ok(up.n===1&&up.w===1152&&up.h===1536&&up.kept&&up.other,`an old 640 px close-up is made again at 1536 px from this device's sharp copy, which is kept for it; one with no sharp copy is left (${up.n}, ${up.w}x${up.h})`);
    ok(up.oldAv.every((v,q)=>Math.abs(v-up.newAv[q])<=6),`it keeps the old close-up's colour (${up.oldAv} -> ${up.newAv})`);
    ok(up.again===0&&up.flag==='1536','it runs once');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
