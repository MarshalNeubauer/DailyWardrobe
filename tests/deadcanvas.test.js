// A browser whose graphics have failed draws every picture pure black (2026-11-15, the owner's desktop browser: a zoom & crop came out
// black and a suit's swatch was saved black). Crop, rotate, replace, the swatch and the small copy refuse a picture drawn pure black and
// keep what the item had; a dark but real photo (black cloth) still saves.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const mk=(w,h,draw)=>p.evaluate(([w,h,draw])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');new Function('x','w','h',draw)(x,w,h);return c.toDataURL('image/png')},[w,h,draw]);
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    const photo=await mk(600,800,"x.fillStyle='#8a6';x.fillRect(0,0,w,h);x.fillStyle='#246';x.fillRect(0,0,w/2,h/2)");
    const tex=await mk(400,400,"for(let y=0;y<h;y+=4)for(let X=0;X<w;X+=4){x.fillStyle=((X+y)/4)%2?'#654':'#432';x.fillRect(X,y,4,4)}");
    // a dark but real picture: near-black cloth with texture up to about 20
    const dark=await mk(300,300,"for(let y=0;y<h;y+=3)for(let X=0;X<w;X+=3){const v=4+((X*7+y*13)%17);x.fillStyle=`rgb(${v},${v},${v+2})`;x.fillRect(X,y,3,3)}");
    await p.evaluate(([ph,tx])=>{items=[{id:'s1',type:'suit',primaryColor:'brown',pattern:'solid',added:1,photo:ph,texture:tx},{id:'t1',type:'tie',primaryColor:'navy',pattern:'solid',added:2},{id:'h1',type:'shirt',primaryColor:'white',pattern:'solid',added:3}];
      settings.workdays=[0,1,2,3,4];settings.planRules=PLAN_RULES;dayRecs={};cache={};flt='all'},[photo,tex]);
    await p.evaluate(async()=>{const it=items[0];await refreshSwatch(it);await makeSmall(it);await put(it);editing='s1';show('wardrobe')});
    const keep=await p.evaluate(()=>({photo:items[0].photo,swatch:items[0].swatch,sm:items[0].photoSm}));
    ok(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');x.fillStyle='#345';x.fillRect(0,0,8,8);
      const b=document.createElement('canvas');b.width=b.height=8;const y=b.getContext('2d');y.fillStyle='#000';y.fillRect(0,0,8,8);return !deadCanvas(c)&&deadCanvas(b)}),'a colored picture is not taken for a dead one; a pure black one is');
    ok(await p.evaluate(async d=>!(await deadPic(d)),dark),'a dark but real photo (black cloth, texture up to about 20) is not taken for a dead one');

    // the graphics fail: every drawImage paints black
    await p.evaluate(()=>{window._di=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(){this.fillStyle='#000';this.fillRect(0,0,this.canvas.width,this.canvas.height)}});
    await p.click('.phtools .pt-crop');await p.waitForSelector('#cropbox');await p.waitForTimeout(100);
    await p.click('.cropwrap >> text=Apply');await p.waitForFunction(()=>!document.querySelector('#cropbox'));await p.waitForTimeout(300);
    let now=await p.evaluate(()=>({photo:items[0].photo,toast:document.querySelector('#toast').textContent}));
    ok(now.photo===keep.photo&&/stopped drawing pictures/.test(now.toast),'a crop drawn black is not saved: the photo stays and the toast says to reload ('+now.toast.slice(0,60)+')');
    await p.click('.phtools .pt-rotate');await p.waitForTimeout(400);
    ok(await p.evaluate(k=>items[0].photo===k,keep.photo),'a rotation drawn black is not saved');
    const sw=await p.evaluate(async()=>{const it=items[0];it.texture=it.texture+'';await refreshSwatch(it);return it.swatch});
    ok(sw===keep.swatch,'a swatch cut black keeps the swatch the item had');
    const sm=await p.evaluate(async()=>{const it={...items[0],phSig:'old'};const r=await makeSmall(it);return {r,sm:it.photoSm}});
    ok(sm.r===false&&sm.sm===keep.sm,'a small copy drawn black is not made: the old one stays');
    const q=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;const q={texCanvas:c,swatch:'kept',primaryColor:'navy',zoom:1,cx:.5,cy:.5};generateSwatch(q);return q.swatch});
    ok(q==='kept','an Add card keeps its swatch when the new cut comes out black');

    // the graphics work again: the crop saves
    await p.evaluate(()=>{CanvasRenderingContext2D.prototype.drawImage=window._di});
    await p.click('.phtools .pt-crop');await p.waitForSelector('#cropbox');await p.waitForTimeout(100);
    await p.click('.cropwrap >> text=Apply');await p.waitForFunction(k=>!document.querySelector('#cropbox')&&items[0].photo!==k,keep.photo);
    ok(await p.evaluate(async()=>!(await deadPic(items[0].photo))),'with working graphics the crop saves as before');
    ok(!errs.length,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}};
