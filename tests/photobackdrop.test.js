// Transparent item photos (2026-11-14, the owner's socks: a cut-out PNG whose photo showed on black): shrink() puts a picture on white
// before it is saved as a JPEG, and fixBlackBackdrops (tagging.js) once makes white the black backdrop of a photo saved before; a dark
// item, or a photo whose edge isn't black, is left alone.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{
      const px=async(u,x,y)=>{const im=await imgOf(u),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);return [...g.getImageData(x,y,1,1).data].slice(0,3)};
      // a cut-out: a beige sock shape on a clear picture
      const cut=document.createElement('canvas');cut.width=cut.height=200;const g=cut.getContext('2d');g.fillStyle='#b8ab98';g.beginPath();g.ellipse(100,100,50,80,0,0,7);g.fill();
      const im=new Image();im.src=cut.toDataURL('image/png');await im.decode();
      const saved=shrink(im,1536).toDataURL('image/jpeg',.85),newCorner=await px(saved,3,3),newMid=await px(saved,100,100);
      // the same as it used to be saved: clear parts black
      const blk=document.createElement('canvas');blk.width=blk.height=200;blk.getContext('2d').drawImage(im,0,0);const old=blk.toDataURL('image/jpeg',.85);
      const sock={id:'bs1',type:'socks',primaryColor:'beige',photo:old},dark={id:'bs2',type:'socks',primaryColor:'black',photo:old};
      const wall=document.createElement('canvas');wall.width=wall.height=200;const w=wall.getContext('2d');w.fillStyle='#d8d4ce';w.fillRect(0,0,200,200);w.drawImage(im,0,0);
      const real={id:'bs3',type:'socks',primaryColor:'beige',photo:wall.toDataURL('image/jpeg',.85)},realBefore=real.photo;
      items=[sock,dark,real];localStorage.removeItem('black_bd');
      const n=await fixBlackBackdrops(),again=await fixBlackBackdrops();
      return {newCorner,newMid,n,again,corner:await px(sock.photo,3,3),mid:await px(sock.photo,100,100),small:!!sock.photoSm&&sock.phSig===phSigOf(sock.photo),
        darkKept:dark.photo===old,realKept:real.photo===realBefore}});
    ok(r.newCorner.every(v=>v>=250)&&Math.abs(r.newMid[0]-0xb8)<8,`a transparent picture is saved on white (corner ${r.newCorner}, the item ${r.newMid} kept)`);
    ok(r.n===1&&r.corner.every(v=>v>=250)&&Math.abs(r.mid[0]-0xb8)<8&&r.small,`a photo saved before with a black backdrop is made white once (corner ${r.corner}, the item ${r.mid}; its small copy made again)`);
    ok(r.darkKept&&r.realKept&&r.again===0,'a dark item and a photo with a real backdrop are left alone, and it runs only once');
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
