// Fabric close-ups and white balance: suits, blazers, trousers, shirts and ties can carry a second photo (a close-up of the
// cloth). Add asks for one item or several; a one-item card asks for the close-up as step 2. Photos are white-balanced from
// their bright near-neutral pixels. The close-up shows as the right half of the "As tagged" swatch.
const path=require('path');
module.exports=async({ok,chromium,url,ROOT,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{HOOK.CK_OPEN['*']=true});
  // ---- white balance
  const wb=await p.evaluate(()=>{const mk=(fn,w=200,h=150)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);return c};
    const px=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data].slice(0,3);
    // a warm (tungsten) cast: a white wall that reads orange, with a navy suit in front
    const warm=mk((x,w,h)=>{x.fillStyle='rgb(240,212,170)';x.fillRect(0,0,w,h);x.fillStyle='rgb(40,42,70)';x.fillRect(50,20,100,130)});
    const g=HOOK.wbGains(warm),fixed=HOOK.applyWb(warm,g);
    const navyOnly=HOOK.wbGains(mk((x,w,h)=>{x.fillStyle='rgb(30,40,90)';x.fillRect(0,0,w,h)}));
    const creamFill=HOOK.wbGains(mk((x,w,h)=>{x.fillStyle='rgb(245,236,212)';x.fillRect(0,0,w,h)}));
    const neutral=HOOK.wbGains(mk((x,w,h)=>{x.fillStyle='rgb(235,235,235)';x.fillRect(0,0,w,h);x.fillStyle='rgb(40,42,70)';x.fillRect(50,20,100,130)}));
    const extreme=HOOK.wbGains(mk((x,w,h)=>{x.fillStyle='rgb(250,200,168)';x.fillRect(0,0,w,h);x.fillStyle='#222';x.fillRect(50,20,100,130)}));
    return {g,wall:px(fixed,5,5),suit:px(fixed,100,80),navyOnly,creamFill,neutral,extreme}});
  const spread=c=>Math.max(...c)-Math.min(...c);
  ok(wb.g&&wb.g.b>1.1&&wb.g.r<1&&spread(wb.wall)<=12,`a warm cast is corrected: the white wall comes out neutral (${wb.wall}; gains ${JSON.stringify(wb.g)})`);
  ok(wb.suit[2]>70&&wb.suit[0]<40,`the suit keeps its navy, slightly bluer once the warm light is taken out (${wb.suit})`);
  ok(wb.navyOnly===null,'a photo with nothing white or gray in it is left alone (a close-up of navy cloth stays navy)');
  ok(wb.creamFill===null,'a close-up of light cloth filling the frame (a cream shirt) is not mistaken for the light and bleached');
  ok(wb.neutral===null,'a photo already in neutral light is left alone');
  ok(wb.extreme&&Math.abs(wb.extreme.r-.85)<1e-9&&Math.abs(wb.extreme.b-1.18)<1e-9,'corrections are capped (at most -15% / +18% per channel)');

  // ---- Add: one item, then its close-up
  ok(await p.evaluate(()=>{HOOK.show('add');return !!document.querySelector('#add-one input[type=file]')&&!!document.querySelector('#add-group input[type=file]')}),'Add asks: one item, or several items in one photo');
  const blob=(r,g,b,wall)=>p.evaluateHandle(([r,g,b,wall])=>new Promise(res=>{const c=document.createElement('canvas');c.width=300;c.height=300;const x=c.getContext('2d');
    if(wall){x.fillStyle=wall;x.fillRect(0,0,300,300)}x.fillStyle=`rgb(${r},${g},${b})`;x.fillRect(wall?80:0,wall?40:0,wall?140:300,wall?260:300);c.toBlob(b=>res(b),'image/png')}),[r,g,b,wall]);
  const file=async(name,r,g,b,wall)=>{const bl=await blob(r,g,b,wall);const buf=await p.evaluate(async b=>[...new Uint8Array(await b.arrayBuffer())],bl);return {name,mimeType:'image/png',buffer:Buffer.from(buf)}};
  await p.setInputFiles('#add-one input[type=file]',await file('suit.png',90,70,50,'rgb(240,212,170)'));
  await p.waitForFunction(()=>HOOK.queue.length===1&&!HOOK.queue[0].busy);
  await p.evaluate(()=>{HOOK.setq(0,'type','suit');HOOK.renderAdd()});
  const c1=await p.evaluate(()=>({step:(document.querySelector('#queue [data-ck="tex"]')||{}).textContent||'',wb:(document.querySelector('#queue .wbnote')||{}).textContent||'',hasWb:!!HOOK.queue[0].wb}));
  ok(/Texture match/.test(c1.step)&&/Not yet · add a close-up to compare/.test(c1.step)&&/Add close-up/.test(c1.step),'a one-item card offers the fabric close-up in Texture match (not counted until there is one)');   // (the checklist redesign, 2026-11-16: it was "Step 2 · Fabric close-up")
  ok(c1.hasWb&&/corrected for the light/.test(c1.wb)&&/Show original/.test(c1.wb),'the photo was color-corrected, and the card says so with a Show original switch');
  const before=await p.evaluate(()=>HOOK.queue[0].photo);await p.click('#queue .wbnote .linkbtn');
  const after=await p.evaluate(()=>({photo:HOOK.queue[0].photo,txt:document.querySelector('#queue .wbnote').textContent}));
  ok(after.photo!==before&&/Original colors/.test(after.txt),'Show original puts the uncorrected photo back');await p.click('#queue .wbnote .linkbtn');
  await p.click('#queue [data-ck="tex"] .ckadd');await p.waitForSelector('#cu-sheet.on');   // a touch screen: the close-up chooser (ui.js)
  await p.setInputFiles('#cu-take',await file('tex.png',200,180,150));
  await p.waitForFunction(()=>HOOK.queue[0].texture);
  const c2=await p.evaluate(async()=>{const q=HOOK.queue[0],im=new Image();im.src=q.texture;await im.decode();const c=document.createElement('canvas');c.width=c.height=4;const x=c.getContext('2d');x.drawImage(im,0,0,4,4);
    const sw=document.querySelector('#queue .swsplit .swtex');
    return {px:[...x.getImageData(1,1,1,1).data].slice(0,3),g:q.wb,split:!!sw&&getComputedStyle(sw).clipPath.includes('50%'),cap:document.querySelector('#queue .tagsw figcaption').textContent,done:!!document.querySelector('#queue [data-ck="tex"].cktexon .ckcu .cubtn')}});
  ok(c2.split&&/As tagged · Close-up/.test(c2.cap),'the swatch splits: the color as tagged on the left half, the close-up on the right');
  ok(Math.abs(c2.px[2]-150*c2.g.b)<=8&&Math.abs(c2.px[0]-200*c2.g.r)<=8,`the close-up gets the same light correction as the item photo (${c2.px})`);
  ok(c2.done,'once added, Texture match offers Replace close-up (Remove is in its chooser)');
  await p.evaluate(()=>{HOOK.setq(0,'type','shoes')});
  ok(await p.evaluate(()=>!document.querySelector('#queue [data-ck="tex"]')&&!document.querySelector('#queue .swtex')),'shoes, belts and the like have no close-up step');
  await p.evaluate(()=>HOOK.setq(0,'type','suit'));
  await p.evaluate(()=>HOOK.save(0));
  const saved=await p.evaluate(()=>({tex:!!HOOK.items[0].texture,type:HOOK.items[0].type,photo:!!HOOK.items[0].photo}));
  ok(saved.tex&&saved.photo&&saved.type==='suit','Confirm saves the item with both photos');
  // a card without a close-up is fine
  await p.setInputFiles('#add-one input[type=file]',await file('tie.png',120,30,40));
  await p.waitForFunction(()=>HOOK.queue.length===1&&!HOOK.queue[0].busy);await p.evaluate(()=>{HOOK.setq(0,'type','tie');return HOOK.save(0)});
  ok(await p.evaluate(()=>HOOK.items.length===2&&!HOOK.items[1].texture),'an item saved without a close-up just has none');

  // ---- Wardrobe: the split swatch, adding and removing a close-up later
  const tieId=await p.evaluate(()=>HOOK.items[1].id),suitId=await p.evaluate(()=>HOOK.items[0].id);
  await p.evaluate(id=>{HOOK.show('wardrobe');HOOK.openItem(id)},suitId);await settle(p,500);
  ok(await p.evaluate(id=>!!document.querySelector(`#item-view .swsplit .swtex`),suitId),'an opened item in the Wardrobe shows the split swatch');
  await p.evaluate(id=>HOOK.openItem(id),tieId);await settle(p,500);
  const lab=await p.evaluate(id=>[...document.querySelectorAll(`#item-view .phtools :is(label,button)`)].map(l=>l.getAttribute('aria-label')||l.textContent.trim()),tieId);
  ok(lab.includes('Add fabric close-up'),`the editor offers a close-up for a tie (${lab.join(', ')})`);
  // a touch screen: the close-up button opens the close-up chooser (ui.js closeupPick); Choose from photos takes the file
  await p.click('#item-view .phtools .cubtn');await p.waitForSelector('#cu-sheet.on');
  await p.setInputFiles('#cu-lib',await file('tt.png',130,40,50));
  await p.waitForFunction(id=>HOOK.items.find(i=>i.id===id).texture&&!!document.querySelector(`#item-view .swtex`),tieId,{timeout:10000}).catch(()=>{});   // the save, then the redraw
  await settle(p,350);await p.click('#item-view .phtools .cubtn');await p.waitForSelector('#cu-sheet.on');
  ok(await p.evaluate(id=>!!document.querySelector(`#item-view .swtex`)&&document.querySelector(`#item-view .phtools .cubtn`).getAttribute('aria-label')==='Replace close-up'&&!!document.querySelector('#cu-rm'),tieId),'adding one shows it in the swatch, with Remove close-up in the close-up chooser');
  await p.click('#cu-cancel');await settle(p,350);
  await p.evaluate(id=>HOOK.undoPhoto(id),tieId);
  ok(await p.evaluate(id=>!HOOK.items.find(i=>i.id===id).texture,tieId),'Undo takes the close-up back off');

  ok(/\{photo,swatch,stripes,texture,sett,patternText,weave,pbox,patternSpec,meas,tagAI,\.\.\.i\}/.test(require('fs').readFileSync(path.join(ROOT,'shop.js'),'utf8')),'the planner worker is not sent the close-ups');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
