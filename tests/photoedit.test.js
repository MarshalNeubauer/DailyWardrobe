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
    const before=await p.evaluate(()=>({plan:JSON.stringify(Object.values(planFor()).map(o=>o.top&&o.top.id)),tags:JSON.stringify({...items[0],photo:0,updated:0})}));
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
    d=await dims();ok(d.tl==='010'&&Math.max(d.w,d.h)===720,'Replace photo takes a new picture (kept at up to 720 px)');
    const after=await p.evaluate(()=>{cache={};return {plan:JSON.stringify(Object.values(planFor()).map(o=>o.top&&o.top.id)),tags:JSON.stringify({...items[0],photo:0,updated:0}),id:items[0].id,n:items.length}});
    ok(after.plan===before.plan&&after.tags===before.tags&&after.id==='suit0'&&after.n===7,'the item keeps its id and tags, and the plan does not change');
    ok(await p.evaluate(async()=>{const s=await tx('readonly',st=>st.get('suit0'));return s&&s.photo===items[0].photo}),'the new photo is saved (and syncs with the item)');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
