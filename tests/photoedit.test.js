// Wardrobe editor photo tools: replace the photo (the item, its tags and the plan stay), rotate a quarter turn, zoom & crop
// to a square, undo while the editor is open.
const fs=require('fs'),path=require('path'),os=require('os');
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  // a 300x200 test photo: left half red, right half blue
  const mk=async(w,h,draw)=>p.evaluate(([w,h,draw])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');new Function('x','w','h',draw)(x,w,h);return c.toDataURL('image/png')},[w,h,draw]);
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const photo=await mk(300,200,"x.fillStyle='#f00';x.fillRect(0,0,w/2,h);x.fillStyle='#00f';x.fillRect(w/2,0,w/2,h)");
    await p.evaluate(ph=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:k,...x});
      items=[I('suit','navy',{photo:ph}),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.planRules=PLAN_RULES;dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};view={y:2026,m:10};flt='all';editing='suit0';show('wardrobe')},photo);
    const before=await p.evaluate(()=>({plan:JSON.stringify(Object.values(planFor()).map(o=>o.top&&o.top.id)),tags:JSON.stringify(Object.entries({...items[0],photo:0,updated:0,photoSm:0,phSig:0}).sort())}));
    const dims=()=>p.evaluate(()=>new Promise(r=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
      const px=(a,b)=>[...x.getImageData(Math.floor(a*im.width),Math.floor(b*im.height),1,1).data].slice(0,3).map(v=>v>128?1:0).join('');r({w:im.width,h:im.height,tl:px(.1,.1),tr:px(.9,.1),bl:px(.1,.9)})};im.src=items[0].photo}));
    ok(await p.evaluate(()=>/Replace photo/.test(document.querySelector('.phtools').textContent)&&/Rotate/.test(document.querySelector('.phtools').textContent)&&/Zoom/.test(document.querySelector('.phtools').textContent)),'an opened item offers Replace photo, Rotate and Zoom & crop');
    ok(await p.evaluate(()=>{const f=document.querySelector('#ivph'),t=document.querySelector('.phtools');return !f.classList.contains('open')&&getComputedStyle(t.parentElement).visibility==='hidden'&&t.parentElement.getBoundingClientRect().height<1}),'the photo tools are folded away under Edit photos, right below the photo');
    await p.click('#ivph .ivphbtn');await p.waitForFunction(()=>document.querySelector('.phtools').parentElement.getBoundingClientRect().height>80);
    ok(await p.evaluate(()=>{const h=document.querySelector('#item-view .pair').getBoundingClientRect(),t=document.querySelector('.phtools').getBoundingClientRect();return document.querySelector('#ivph .ivphbtn').getAttribute('aria-expanded')==='true'&&t.top>h.bottom&&t.top-h.bottom<90&&h.top>=0}),'Edit photos unfolds them beside the photo they change');
    // rotate: 300x200 red|blue becomes 200x300 red on top
    await p.click('.phtools >> text=Rotate');await p.waitForFunction(()=>!/^data:image\/png/.test(items[0].photo));
    let d=await dims();ok(d.w===200&&d.h===300&&d.tl==='100'&&d.bl==='001','Rotate turns the photo a quarter clockwise');
    ok(await p.evaluate(()=>document.querySelector('#ivph').classList.contains('open')),'the tools stay unfolded after a change');
    // undo
    await p.click('.phtools >> text=Undo');await p.waitForFunction(()=>/^data:image\/png/.test(items[0].photo));
    d=await dims();ok(d.w===300&&d.h===200,'Undo brings the previous photo back');
    // zoom & crop: zoom 2x, drag right (shows more of the left = red), apply -> square, all red
    await p.click('.phtools >> text=Zoom');await p.waitForSelector('#cropbox');await p.waitForTimeout(100);
    await p.evaluate(()=>{const r=document.querySelector('.cropzoom input');r.value=2;r.dispatchEvent(new Event('input'))});
    const bx=await p.evaluate(()=>{const b=document.querySelector('#cropbox').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}});
    await p.mouse.move(bx.x,bx.y);await p.mouse.down();await p.mouse.move(bx.x+150,bx.y,{steps:5});await p.mouse.up();
    await p.click('.cropwrap >> text=Apply');await p.waitForFunction(()=>!document.querySelector('#cropbox')&&!/^data:image\/png/.test(items[0].photo));
    d=await dims();ok(d.w===d.h&&d.tl==='100'&&d.tr==='100','Zoom & crop saves a square of the chosen part (dragged to the red half)');
    // replace with a new picture (green)
    const green=await mk(800,600,"x.fillStyle='#0f0';x.fillRect(0,0,w,h)");
    const file=path.join(os.tmpdir(),'dw-green.png');fs.writeFileSync(file,Buffer.from(green.split(',')[1],'base64'));
    await p.setInputFiles('.phtools input[type=file]',file);await p.waitForFunction(()=>items[0].photo&&items[0].photo.length>0&&document.querySelector('#toast').textContent.includes('replaced'));
    d=await dims();ok(d.tl==='010'&&Math.max(d.w,d.h)===800,'Replace photo takes a new picture (kept whole up to 1536 px: PH_MAX, 2026-11-13; it was 720)');
    const after=await p.evaluate(()=>{cache={};return {plan:JSON.stringify(Object.values(planFor()).map(o=>o.top&&o.top.id)),tags:JSON.stringify(Object.entries({...items[0],photo:0,updated:0,photoSm:0,phSig:0}).sort()),id:items[0].id,n:items.length}});
    ok(after.plan===before.plan&&after.tags===before.tags&&after.id==='suit0'&&after.n===7,'the item keeps its id and tags, and the plan does not change'+(after.tags===before.tags?'':' TAGS '+before.tags+' | '+after.tags)+(after.plan===before.plan?'':' PLAN'));
    ok(await p.evaluate(async()=>{const s=await tx('readonly',st=>st.get('suit0'));return s&&s.photo===items[0].photo}),'the new photo is saved (and syncs with the item)');
    // Add keeps an item's photo at 720px, as Replace does (it was 360px: a suit cropped later went to the photo generator at 270px)
    const added=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#888';x.fillRect(0,0,800,600);
      const q={raw:{big:c},wb:null,wbOff:true,zoom:1,cx:.5,cy:.5};cardPics(q);return new Promise(r=>{const im=new Image();im.onload=()=>r([im.width,im.height]);im.src=q.photo})});
    ok(added[0]===800&&added[1]===600,`Add keeps the photo whole up to 1536px (${added.join('x')})`);
    // crop from the best copy: the sharp copy kept when the photo was read (1600x1200), when it is the same picture as the photo
    const sharp=await mk(1600,1200,"x.fillStyle='#f00';x.fillRect(0,0,w/2,h);x.fillStyle='#00f';x.fillRect(w/2,0,w/2,h);x.fillStyle='#ff0';x.fillRect(0,0,w/4,h/4)");
    const crop=async(photo,keep)=>p.evaluate(async([photo,keep])=>{await keepTagImg('suit0',keep);items[0].photo=photo;phEdit.undo=[];renderWardrobe();
      await startCrop('suit0');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));phEdit.crop.z=4;layoutCrop();await applyCrop('suit0');
      return new Promise(r=>{const im=new Image();im.onload=()=>r(im.width);im.src=items[0].photo})},[photo,keep]);
    const small=await p.evaluate(u=>new Promise(r=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=360;c.height=270;c.getContext('2d').drawImage(im,0,0,360,270);r(c.toDataURL('image/jpeg',.8))};im.src=u}),sharp);
    const turned=await p.evaluate(u=>new Promise(r=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.height;c.height=im.width;const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);r(c.toDataURL('image/jpeg',.9))};im.src=u}),small);
    const other=await mk(1600,1200,"x.fillStyle='#0a0';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(w/3,h/3,w/3,h/3)");
    const w1=await crop(small,sharp),w2=await crop(turned,sharp),w3=await crop(small,other);
    ok(w1===300,`a crop is cut from the sharp copy: zoomed 4x on a 360px photo it keeps 300px, not 68 (${w1})`);
    ok(w2===300,`after Rotate the sharp copy still matches (turned the same way) and is used (${w2})`);
    ok(w3>=60&&w3<=70,`a sharp copy of another picture (a replaced photo) is not used: the crop comes from the photo itself (${w3})`);
    // a big photo has a small copy (PH_SM) for the wardrobe grid, made again when the photo changes
    const big=await mk(1536,1152,"x.fillStyle='#246';x.fillRect(0,0,w,h);x.fillStyle='#fc0';x.fillRect(0,0,w/2,h/2)");
    const sm=await p.evaluate(async u=>{await setPhoto('suit0',u);const it=items[0],im=await imgOf(it.photoSm);editing=null;renderWardrobe();const g=document.querySelector('#gi-suit0 img.ph');
      return {w:im.naturalWidth,h:im.naturalHeight,sig:it.phSig===phSigOf(it.photo),grid:!!g&&g.getAttribute('src')===it.photoSm,stored:!!(await tx('readonly',st=>st.get('suit0'))).photoSm}},big);
    ok(sm.w===480&&sm.h===360&&sm.sig&&sm.grid&&sm.stored,`a 1536 px photo has a 480 px copy, shown in the wardrobe grid and saved with the item (${sm.w}x${sm.h})`);
    // photos saved at 720 before: made again at 1536 from this device's sharp copy of the same picture, in the old photo's colour, once
    const up=await p.evaluate(async([sharp,other])=>{const shrinkTo=(u,w,h)=>new Promise(r=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.filter='brightness(.85)';x.drawImage(im,0,0,w,h);r(c.toDataURL('image/jpeg',.85))};im.src=u});
      const a={id:'pa',type:'shirt',primaryColor:'white',pattern:'solid',photo:await shrinkTo(sharp,720,540)},b={id:'pb',type:'shirt',primaryColor:'white',pattern:'solid',photo:await shrinkTo(sharp,720,540)};
      items=[a,b];await keepTagImg('pa',sharp);await keepTagImg('pb',other);localStorage.removeItem('photo_up');const av=async u=>{const i=await imgOf(u),c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(i,0,0,16,16);const d=x.getImageData(0,0,16,16).data;let s=[0,0,0];for(let k=0;k<d.length;k+=4)for(let q=0;q<3;q++)s[q]+=d[k+q];return s.map(v=>Math.round(v/256))};
      const old=await av(a.photo),n=await upgradePhotos(),im=await imgOf(a.photo);return {n,w:im.naturalWidth,old,now:await av(a.photo),small:!!a.photoSm&&a.phSig===phSigOf(a.photo),otherKept:(await imgOf(b.photo)).naturalWidth===720,again:await upgradePhotos()}},[sharp,other]);
    ok(up.n===1&&up.w===1536&&up.small&&up.otherKept,`a 720 px photo is made again at 1536 px from the sharp copy of the same picture, with its small copy; one whose sharp copy shows another picture is left (${up.n}, ${up.w})`);
    ok(up.old.every((v,q)=>Math.abs(v-up.now[q])<=8)&&up.again===0,`it keeps the old photo's colour (${up.old} -> ${up.now}) and runs once`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
