// Edit photos option B (2026-11-15, edit-photos-mockups, the owner's go): the "Edit photos" fold is gone. Under the pictures, one row of
// four icon-and-label buttons, Replace · Rotate · Crop · Close-up (44 px or more, one row, light and dark, phone 390 and the unfolded 690);
// each does its job (Close-up opens the close-up chooser: Take / Choose / Remove / Cancel); every photo change has Undo in its toast (no
// Undo button). Then the "Color & texture" card: its title and line, "True color in 3 steps" ABOVE Read color and texture (seen on a
// phone's first screen, before the Read tap), the cost. Touch screen, Chromium and WebKit, the worker stubbed (no paid call), the mink suit
// from tests/fixtures.
const {wrapBrowser}=require('./webkit');
module.exports=async({ok,chromium,url,settle})=>{
  const engines=[['Chromium',()=>chromium.launch()],['WebKit',async()=>{const pw=require('playwright');return wrapBrowser(await pw.webkit.launch())}]];
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
async function run(eng,browser,{ok,url,settle}){
  for(const [w,h] of [[390,844],[690,960]]){const phone=w===390;
    const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:eng==='Chromium'});
    await ctx.route('https://w.test/**',route=>{const q=route.request();
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
      return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
    await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const F=await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
      const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
      const cv=(im,k)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)};
      rememberRole({role:'owner'});settings.custom={colors:[],patterns:[]};applyCustom(settings.custom);
      const f={photo:cv(pi,1),close:cv(ci,3)};
      items=[{id:'m1',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:f.photo,texture:f.close,added:2,name:'Mink suit'},{id:'k1',type:'shoes',primaryColor:'black',leather:'calf',photo:f.photo,added:1}];
      settings.workdays=[0,1,2,3,4];settings.setupDone=1;cache={};flt='all';editing=null;show('wardrobe');return f});
    await settle(p,300);await p.evaluate(()=>openItem('m1'));await settle(p,500);
    const T=`${eng} ${w}×${h}: `,ev=(f,a)=>p.evaluate(f,a);
    const file=(name,u)=>({name,mimeType:'image/jpeg',buffer:Buffer.from(u.split(',')[1],'base64')});
    const toastNow=()=>ev(()=>{const t=document.querySelector('#toast.on');return t?t.textContent:''});
    const undo=()=>ev(()=>[...document.querySelectorAll('#toast.on button')].find(b=>b.textContent==='Undo').click());
    // ---- the row
    const row=()=>ev(()=>{const r=document.querySelector('#item-view .phtools'),pair=document.querySelector('#item-view .ivhero').getBoundingClientRect(),kids=r?[...r.children]:[];
      return {fold:!!document.querySelector('#ivph,.ivphbtn,#ivphp')||typeof togglePhotoTools!=='undefined',n:kids.length,
        labels:kids.map(x=>x.textContent.trim()),names:kids.map(x=>x.getAttribute('aria-label')||(x.querySelector('input')?x.querySelector('input').getAttribute('aria-label'):'')),
        cls:kids.map(x=>(x.className.match(/pt-\w+/)||[''])[0]),svg:kids.every(x=>!!x.querySelector('svg')),
        hw:kids.map(x=>{const b=x.getBoundingClientRect();return [Math.round(b.width),Math.round(b.height)]}),tops:kids.map(x=>Math.round(x.getBoundingClientRect().top)),
        gap:r?Math.round(r.getBoundingClientRect().top-pair.bottom):-1,right:r?r.getBoundingClientRect().right:0,undo:kids.some(x=>/Undo/.test(x.textContent)),
        fit:document.documentElement.scrollWidth<=innerWidth,bg:kids.map(x=>getComputedStyle(x).backgroundColor),ink:kids.map(x=>getComputedStyle(x).color)}});
    let r=await row();
    ok(!r.fold,T+'no "Edit photos" fold (nor togglePhotoTools)');
    ok(r.n===4&&r.labels.join('|')==='Replace|Rotate|Crop|Close-up'&&r.cls.join('|')==='pt-replace|pt-rotate|pt-crop|pt-closeup'&&r.svg&&!r.undo,T+`under the pictures: Replace · Rotate · Crop · Close-up, each an icon and a label, no Undo button (${r.labels.join(', ')})`);
    ok(r.names.join('|')==='Replace photo|Rotate the photo a quarter turn clockwise|Zoom and crop the photo|Replace close-up',T+`each has a full name for a screen reader (${r.names.join(' | ')})`);
    ok(r.hw.every(([bw,bh])=>bw>=44&&bh>=44)&&new Set(r.tops).size===1&&r.gap>=0&&r.gap<=24&&r.right<=w&&r.fit,T+`44 px or more each, one row right under the pictures, inside the screen (${JSON.stringify({hw:r.hw,tops:r.tops,gap:r.gap})})`);
    for(const theme of ['light','dark']){await ev(t=>{document.documentElement.dataset.theme=t},theme);await settle(p,100);r=await row();
      const c=await ev(()=>({ct:getComputedStyle(document.querySelector('#ivct')).backgroundColor,tags:getComputedStyle(document.querySelector('#item-view .ivtags')).backgroundColor}));
      ok(r.bg.every((b,k)=>b!==r.ink[k])&&c.ct===c.tags,T+`${theme}: the buttons' text stands off their background, the Color & texture card is a card like Details (${JSON.stringify({bg:r.bg[0],ink:r.ink[0],...c})})`)}
    await ev(()=>{delete document.documentElement.dataset.theme});
    // ---- the Color & texture card: the 3 steps before Read
    const cd=await ev(()=>{const c=document.querySelector('#ivct'),row=document.querySelector('#item-view .phtools'),kids=c?[...c.children]:[],k=s=>kids.findIndex(x=>x.matches(s));
      const st=c.querySelector('.wbsteps').getBoundingClientRect(),rd=c.querySelector('#iv-read').getBoundingClientRect(),bar=document.querySelector('.ivbar').getBoundingClientRect(),cr=c.getBoundingClientRect(),rr=row.getBoundingClientRect();
      return {h:c.querySelector('h3').textContent,line:c.querySelector('.shelp').textContent,order:[k('h3'),k('.shelp'),k('.wbsteps'),k('.ivrd')],afterRow:row.nextElementSibling===c,
        above:st.bottom<=rd.top,stepsSeen:st.bottom<=bar.top,cost:(c.querySelector('.rdcost')||{}).textContent,w:[Math.round(cr.left),Math.round(cr.right),Math.round(rr.left),Math.round(rr.right)]}});
    ok(cd.h==='Color & texture'&&cd.line==='Claude reads them from your close-up.'&&cd.afterRow&&cd.order.join()==='0,1,2,3'&&cd.above&&/^About \d+¢$/.test(cd.cost),T+`the Color & texture card under the row: its title and line, then "True color in 3 steps", then Read color and texture and its cost (${JSON.stringify(cd)})`);
    ok(cd.w[0]===cd.w[2]&&cd.w[1]===cd.w[3],T+`the row and the card share the same width (${cd.w.join(',')})`);
    if(phone)ok(cd.stepsSeen,T+'the 3 steps are on the first screen, above the bottom bar, before any scroll or tap');
    ok(await ev(()=>{openItem('k1');const none=!document.querySelector('#ivct')&&!document.querySelector('#item-view .pt-closeup')&&document.querySelectorAll('#item-view .phtools>*').length===3;openItem('m1');return none}),T+'shoes: no Color & texture card and no Close-up button (Replace · Rotate · Crop)');
    await settle(p,300);
    if(phone){
      // ---- each button does its job, with Undo in the toast
      const ph0=await ev(()=>items.find(x=>x.id==='m1').photo),dims=()=>ev(async()=>{const im=await imgOf(items.find(x=>x.id==='m1').photo);return [im.naturalWidth,im.naturalHeight]});
      const d0=await dims();
      await p.click('#item-view .pt-rotate');await p.waitForFunction(ph0=>items.find(x=>x.id==='m1').photo!==ph0,ph0);await settle(p,200);
      const d1=await dims(),t1=await toastNow();
      ok(d1[0]===d0[1]&&d1[1]===d0[0]&&/^Photo rotated\.\s*Undo$/.test(t1),T+`Rotate turns the photo a quarter, "Photo rotated." with Undo (${d0} → ${d1}; ${t1})`);
      await undo();await p.waitForFunction(ph0=>items.find(x=>x.id==='m1').photo===ph0,ph0);
      ok(await ev(()=>!phEdit.undo.length),T+'the toast’s Undo puts the photo back, through the editor’s Undo (phEdit.undo emptied)');
      await settle(p,200);await p.click('#item-view .pt-crop');await p.waitForSelector('#cropbox');
      ok(await ev(()=>!!phEdit.crop&&!document.querySelector('#item-view .phtools')&&!document.querySelector('#ivct')),T+'Crop opens the zoom & crop frame (the row and the card step aside)');
      await p.click('#item-view .cropdiscard');await settle(p,300);
      const green=await ev(()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const x=c.getContext('2d');x.fillStyle='#3a6';x.fillRect(0,0,600,400);return c.toDataURL('image/jpeg',.9)});
      await (await p.$('#item-view .pt-replace input[type=file]')).setInputFiles(file('green.jpg',green));
      await p.waitForFunction(ph0=>items.find(x=>x.id==='m1').photo!==ph0,ph0);await settle(p,200);
      ok(/Photo replaced\..*Undo$/.test(await toastNow()),T+`Replace takes a new photo, "Photo replaced." with Undo (${await toastNow()})`);
      await undo();await p.waitForFunction(ph0=>items.find(x=>x.id==='m1').photo===ph0,ph0);ok(true,T+'…and its Undo puts the old photo back');
      await settle(p,200);
      // Close-up: the chooser
      await p.click('#item-view .pt-closeup');await p.waitForSelector('#cu-sheet.on');
      const s=await ev(()=>{const q=x=>document.querySelector('#cu-sheet '+x);return {title:q('#cu-title').textContent,take:q('#cu-take').closest('label').textContent.trim(),lib:q('#cu-lib').closest('label').textContent.trim(),rm:(q('#cu-rm')||{}).textContent,cancel:q('#cu-cancel').textContent}});
      ok(s.title==='Replace close-up'&&s.take==='Take close-up'&&s.lib==='Choose from photos'&&s.rm==='Remove close-up'&&s.cancel==='Cancel',T+`Close-up opens the close-up chooser: Take / Choose / Remove / Cancel (${JSON.stringify(s)})`);
      await p.click('#cu-cancel');await p.waitForFunction(()=>!document.querySelector('#cu-sheet.on'));await settle(p,300);
      const tx0=await ev(()=>texSig(items.find(x=>x.id==='m1').texture));
      await p.click('#item-view .pt-closeup');await p.waitForSelector('#cu-sheet.on');await (await p.$('#cu-lib')).setInputFiles(file('c.jpg',F.close));
      await p.waitForFunction(tx0=>{const it=items.find(x=>x.id==='m1');return it.texture&&texSig(it.texture)!==tx0},tx0).catch(()=>{});await settle(p,300);
      const t2=await toastNow();
      if(await ev(tx0=>texSig(items.find(x=>x.id==='m1').texture)!==tx0,tx0)){
        ok(/Close-up added\..*Undo$/.test(t2),T+`a close-up chosen there: "Close-up added." with Undo (${t2})`);
        await undo();await p.waitForFunction(tx0=>texSig(items.find(x=>x.id==='m1').texture||'')===tx0,tx0);ok(true,T+'…and its Undo puts the old close-up back')}
      await settle(p,300);await p.click('#item-view .pt-closeup');await p.waitForSelector('#cu-sheet.on');await p.click('#cu-rm');await p.waitForFunction(()=>!items.find(x=>x.id==='m1').texture);await settle(p,200);
      ok(/Close-up removed\..*Undo$/.test(await toastNow())&&await ev(()=>document.querySelector('#item-view .pt-closeup').getAttribute('aria-label')==='Add fabric close-up'),T+'Remove close-up in the chooser removes it, with Undo; the button is then named Add fabric close-up');
      await undo();await p.waitForFunction(()=>!!items.find(x=>x.id==='m1').texture);ok(true,T+'…and its Undo brings the close-up back')}
    ok(!errs.length,T+'no page errors ('+errs.join(' | ')+')');
    await ctx.close()}
}
