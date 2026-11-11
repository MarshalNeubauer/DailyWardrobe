// Fabric close-ups and white balance: suits, blazers, trousers, shirts and ties can carry a second photo (a close-up of the
// cloth). Add asks for one item or several; a one-item card asks for the close-up as step 2. Photos are white-balanced from
// their bright near-neutral pixels. The close-up shows as the right half of the "As tagged" swatch and goes to the
// realistic photo as a labelled reference.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT,settle})=>{
  // worker: up to 8 reference photos reach OpenAI
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null;const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  globalThis.fetch=async(href,init)=>{if(String(href)==='https://api.openai.com/v1/images/edits'){sent=init.body;return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})}return new Response('',{status:404})};
  try{const img='data:image/jpeg;base64,'+JPG,refs=Array(9).fill(img),labels=refs.map((_,k)=>'a close-up of the suit fabric (match its exact colour and weave) '+k);
    await worker.fetch(new Request('https://w.test/render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({image:img,refs,labels,outfit:'x',key:'c0000000000000001'})}),{APP_TOKEN:'t',OPENAI_API_KEY:'k'});
    ok(sent&&sent.getAll('image[]').length===9&&/close-up of the suit fabric \(match its exact colour and weave\) 0/.test(sent.get('prompt'))&&!/ 8\b/.test(sent.get('prompt').split('in this order')[1]||''),'the worker passes up to 8 labelled reference photos (illustration + 8)')}
  finally{globalThis.fetch=realFetch}

  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  // ---- white balance
  const wb=await p.evaluate(()=>{const mk=(fn,w=200,h=150)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);return c};
    const px=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data].slice(0,3);
    // a warm (tungsten) cast: a white wall that reads orange, with a navy suit in front
    const warm=mk((x,w,h)=>{x.fillStyle='rgb(240,212,170)';x.fillRect(0,0,w,h);x.fillStyle='rgb(40,42,70)';x.fillRect(50,20,100,130)});
    const g=wbGains(warm),fixed=applyWb(warm,g);
    const navyOnly=wbGains(mk((x,w,h)=>{x.fillStyle='rgb(30,40,90)';x.fillRect(0,0,w,h)}));
    const creamFill=wbGains(mk((x,w,h)=>{x.fillStyle='rgb(245,236,212)';x.fillRect(0,0,w,h)}));
    const neutral=wbGains(mk((x,w,h)=>{x.fillStyle='rgb(235,235,235)';x.fillRect(0,0,w,h);x.fillStyle='rgb(40,42,70)';x.fillRect(50,20,100,130)}));
    const extreme=wbGains(mk((x,w,h)=>{x.fillStyle='rgb(250,200,168)';x.fillRect(0,0,w,h);x.fillStyle='#222';x.fillRect(50,20,100,130)}));
    return {g,wall:px(fixed,5,5),suit:px(fixed,100,80),navyOnly,creamFill,neutral,extreme}});
  const spread=c=>Math.max(...c)-Math.min(...c);
  ok(wb.g&&wb.g.b>1.1&&wb.g.r<1&&spread(wb.wall)<=12,`a warm cast is corrected: the white wall comes out neutral (${wb.wall}; gains ${JSON.stringify(wb.g)})`);
  ok(wb.suit[2]>70&&wb.suit[0]<40,`the suit keeps its navy, slightly bluer once the warm light is taken out (${wb.suit})`);
  ok(wb.navyOnly===null,'a photo with nothing white or grey in it is left alone (a close-up of navy cloth stays navy)');
  ok(wb.creamFill===null,'a close-up of light cloth filling the frame (a cream shirt) is not mistaken for the light and bleached');
  ok(wb.neutral===null,'a photo already in neutral light is left alone');
  ok(wb.extreme&&Math.abs(wb.extreme.r-.85)<1e-9&&Math.abs(wb.extreme.b-1.18)<1e-9,'corrections are capped (at most -15% / +18% per channel)');

  // ---- Add: one item, then its close-up
  ok(await p.evaluate(()=>{show('add');return !!document.querySelector('#add-one input[type=file]')&&!!document.querySelector('#add-group input[type=file]')}),'Add asks: one item, or several items in one photo');
  const blob=(r,g,b,wall)=>p.evaluateHandle(([r,g,b,wall])=>new Promise(res=>{const c=document.createElement('canvas');c.width=300;c.height=300;const x=c.getContext('2d');
    if(wall){x.fillStyle=wall;x.fillRect(0,0,300,300)}x.fillStyle=`rgb(${r},${g},${b})`;x.fillRect(wall?80:0,wall?40:0,wall?140:300,wall?260:300);c.toBlob(b=>res(b),'image/png')}),[r,g,b,wall]);
  const file=async(name,r,g,b,wall)=>{const bl=await blob(r,g,b,wall);const buf=await p.evaluate(async b=>[...new Uint8Array(await b.arrayBuffer())],bl);return {name,mimeType:'image/png',buffer:Buffer.from(buf)}};
  await p.setInputFiles('#add-one input[type=file]',await file('suit.png',90,70,50,'rgb(240,212,170)'));
  await p.waitForFunction(()=>queue.length===1&&!queue[0].busy);
  await p.evaluate(()=>{setq(0,'type','suit');renderAdd()});
  const c1=await p.evaluate(()=>({step:(document.querySelector('#queue .texslot')||{}).textContent||'',wb:(document.querySelector('#queue .wbnote')||{}).textContent||'',hasWb:!!queue[0].wb}));
  ok(/Step 2 · Fabric close-up/.test(c1.step)&&/Optional/.test(c1.step),'a one-item card asks for the fabric close-up as step 2 (optional)');
  ok(c1.hasWb&&/corrected for the light/.test(c1.wb)&&/Show original/.test(c1.wb),'the photo was colour-corrected, and the card says so with a Show original switch');
  const before=await p.evaluate(()=>queue[0].photo);await p.click('#queue .wbnote .linkbtn');
  const after=await p.evaluate(()=>({photo:queue[0].photo,txt:document.querySelector('#queue .wbnote').textContent}));
  ok(after.photo!==before&&/Original colours/.test(after.txt),'Show original puts the uncorrected photo back');await p.click('#queue .wbnote .linkbtn');
  await p.setInputFiles('#queue .texslot input[type=file]',await file('tex.png',200,180,150));
  await p.waitForFunction(()=>queue[0].texture);
  const c2=await p.evaluate(async()=>{const q=queue[0],im=new Image();im.src=q.texture;await im.decode();const c=document.createElement('canvas');c.width=c.height=4;const x=c.getContext('2d');x.drawImage(im,0,0,4,4);
    const sw=document.querySelector('#queue .swsplit .swtex');
    return {px:[...x.getImageData(1,1,1,1).data].slice(0,3),g:q.wb,split:!!sw&&getComputedStyle(sw).clipPath.includes('50%'),cap:document.querySelector('#queue .tagsw figcaption').textContent,done:!!document.querySelector('#queue .texslot.done')}});
  ok(c2.split&&/As tagged · Close-up/.test(c2.cap),'the swatch splits: the colour as tagged on the left half, the close-up on the right');
  ok(Math.abs(c2.px[2]-150*c2.g.b)<=8&&Math.abs(c2.px[0]-200*c2.g.r)<=8,`the close-up gets the same light correction as the item photo (${c2.px})`);
  ok(c2.done,'once added, step 2 offers Replace and Remove');
  await p.evaluate(()=>{setq(0,'type','shoes')});
  ok(await p.evaluate(()=>!document.querySelector('#queue .texslot')&&!document.querySelector('#queue .swtex')),'shoes, belts and the like have no close-up step');
  await p.evaluate(()=>setq(0,'type','suit'));
  await p.evaluate(()=>save(0));
  const saved=await p.evaluate(()=>({tex:!!items[0].texture,type:items[0].type,photo:!!items[0].photo}));
  ok(saved.tex&&saved.photo&&saved.type==='suit','Confirm saves the item with both photos');
  // a card without a close-up is fine
  await p.setInputFiles('#add-one input[type=file]',await file('tie.png',120,30,40));
  await p.waitForFunction(()=>queue.length===1&&!queue[0].busy);await p.evaluate(()=>{setq(0,'type','tie');return save(0)});
  ok(await p.evaluate(()=>items.length===2&&!items[1].texture),'an item saved without a close-up just has none');

  // ---- Wardrobe: the split swatch, adding and removing a close-up later
  const tieId=await p.evaluate(()=>items[1].id),suitId=await p.evaluate(()=>items[0].id);
  await p.evaluate(id=>{show('wardrobe');openItem(id)},suitId);await settle(p,500);
  ok(await p.evaluate(id=>!!document.querySelector(`#gi-${id} .swsplit .swtex`),suitId),'an opened item in the Wardrobe shows the split swatch');
  await p.evaluate(id=>openItem(id),tieId);await settle(p,500);
  const lab=await p.evaluate(id=>[...document.querySelectorAll(`#gi-${id} .phtools label`)].map(l=>l.textContent.trim()),tieId);
  ok(lab.includes('Add fabric close-up'),`the editor offers a close-up for a tie (${lab.join(', ')})`);
  await p.setInputFiles(`#gi-${tieId} .phtools label:nth-of-type(2) input`,await file('tt.png',130,40,50));
  await p.waitForFunction(id=>items.find(i=>i.id===id).texture&&!!document.querySelector(`#gi-${id} .swtex`),tieId,{timeout:10000}).catch(()=>{});   // the save, then the redraw
  ok(await p.evaluate(id=>!!document.querySelector(`#gi-${id} .swtex`)&&/Remove close-up/.test(document.querySelector(`#gi-${id} .phtools`).textContent),tieId),'adding one shows it in the swatch, with Remove close-up');
  await p.evaluate(id=>undoPhoto(id),tieId);
  ok(await p.evaluate(id=>!items.find(i=>i.id===id).texture,tieId),'Undo takes the close-up back off');

  // ---- realistic photo: the close-ups go along, labelled
  const refs=await p.evaluate(()=>{const s=items[0],t={...items[1],texture:'data:image/jpeg;base64,AAA'},sh={id:'sh',type:'shirt',primaryColor:'white',texture:'data:image/jpeg;base64,BBB'},
      pt={id:'pt',type:'pants',primaryColor:'grey',photo:'data:image/jpeg;base64,CCC',texture:'data:image/jpeg;base64,DDD'};
    const a=outfitRefs({top:s,suitDay:true,shirt:sh,tie:t,bot:pt}),b=outfitRefs({top:null,shirt:sh,bot:pt,tie:t});
    return {a:a.labels,n:a.refs.length,b:b.labels}});
  ok(refs.a.join(' | ')==='the suit | a close-up of the suit fabric (match its exact colour and weave) | a close-up of the shirt fabric (match its exact colour and weave) | the tie | a close-up of the tie fabric (match its exact colour and weave)',`the suit, shirt and tie close-ups follow their photos (${refs.a.length} refs)`);
  ok(refs.b.includes('a close-up of the trouser fabric (match its exact colour and weave)'),'on a no-jacket day the trousers\' close-up goes too');
  ok(/\{photo,swatch,stripes,texture,sett,patternText,weave,pbox,patternSpec,\.\.\.i\}/.test(require('fs').readFileSync(path.join(ROOT,'app.js'),'utf8')),'the planner worker is not sent the close-ups');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
