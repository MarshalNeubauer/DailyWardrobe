// White paper in the close-up, in the item sheet (itemsheet.js paperHint / paperLine, tagging.js paperOf; the owner's choice from
// photo-wb-mockups, 2026-11-15: option A with a drawing, and screens 04-06): the hint under the close-up buttons with its drawing (which
// opens the short tip), and after Replace close-up the line under the photos: "White paper found", "No white paper" with Retake close-up,
// or the warm wording when the item photo's light reading is warm (blue gain >= 1.08 x red); Retake works from the line; Undo hides it;
// 390 px in both themes, no sideways scroll, no page errors. The close-ups are the mink suit's test pictures, with a band of white
// paper drawn on and/or a warm tint. Nothing goes to the server.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.route('https://w.test/**',route=>{const q=route.request();
    if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
    return route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'})});
  await ctx.addInitScript(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const F=await p.evaluate(async()=>{const load=u=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=u});
      const ci=await load('tests/fixtures/suit-mink-closeup.png'),pi=await load('tests/fixtures/suit-mink.jpg');
      const cv=(im,k,f)=>{const c=document.createElement('canvas');c.width=im.naturalWidth*k;c.height=im.naturalHeight*k;const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);if(f)f(c,x);return c};
      const paper=(c,x)=>{x.fillStyle='#f4f3ef';x.fillRect(0,c.height*.8,c.width,c.height*.2)};
      const warm=(c,x)=>{const D=x.getImageData(0,0,c.width,c.height),d=D.data;for(let i=0;i<d.length;i+=4){d[i]=Math.min(255,d[i]*1.12);d[i+1]=Math.min(255,d[i+1]*1.02);d[i+2]=d[i+2]*.78}x.putImageData(D,0,0)};
      const J=c=>c.toDataURL('image/jpeg',.9);
      return {plain:J(cv(ci,3)),paper:J(cv(ci,3,paper)),photo:J(cv(pi,1)),warmPhoto:J(cv(pi,1,warm))}});
    const file=(name,u)=>({name,mimeType:'image/jpeg',buffer:Buffer.from(u.split(',')[1],'base64')});
    let e=await p.evaluate(async F=>{const c=async u=>closeRead(await urlCanvas(u)).ref,g=async u=>wbRead(await urlCanvas(u)).gains;const w=await g(F.warmPhoto),n=await g(F.photo);
      return {plain:await c(F.plain),paper:await c(F.paper),warm:w&&+(w.b/w.r).toFixed(3),cool:n?+(n.b/n.r).toFixed(3):null}},F);
    ok(!e.plain&&e.paper&&e.warm>=PAPER_WARM_T&&!(e.cool>=PAPER_WARM_T),`the fixtures: paper found only with the band; the warm photo reads warm, the plain one doesn't (${JSON.stringify(e)})`);
    await p.evaluate(F=>{rememberRole({role:'owner'});items=[{id:'m1',type:'suit',primaryColor:'deeptaupe',pattern:'solid',photo:F.photo,texture:F.plain,added:1,name:'Mink suit'},
      {id:'k1',type:'shoes',primaryColor:'black',leather:'calf',photo:F.photo,added:2}];flt='all';editing=null;show('wardrobe');openItem('m1')},F);await settle(p,400);
    // ---- the hint: "True color in 3 steps", one button with three small drawings
    e=await p.evaluate(()=>{const h=document.querySelector('#item-view .wbstcard'),b=h&&h.querySelector('.wbpic'),r=b&&b.getBoundingClientRect(),cr=h&&h.getBoundingClientRect();
      return {tag:h&&h.tagName,text:h&&[...h.querySelectorAll('.eb,.more,.li,.arr')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join(' '),hh:cr&&Math.round(cr.height),pics:h&&h.querySelectorAll('.wbpic').length,cam:!!(h&&h.querySelector('.cam svg')),tap:!!(h&&h.querySelector('.tap')),
        w:r&&Math.round(r.width),h:r&&Math.round(r.height),cloth:b&&b.style.getPropertyValue('--cloth'),old:!!document.querySelector('#item-view .wbhint'),line:!!document.querySelector('#ivwb')}});
    ok(e.tag==='BUTTON'&&/^True color in 3 steps Tips › 1Paper on an edge › 2Tap the paper › 3Take the photo$/.test(e.text)&&e.hh>=44&&e.hh<=130&&!e.old,`under the close-up buttons: the 3-step card, one button (${JSON.stringify(e)})`);
    ok(e.pics===2&&e.cam&&e.tap&&e.w===40&&e.h===e.w&&/^#/.test(e.cloth),`its drawings: the cloth in the item's colour twice (the second with the tap), then a camera (${e.w}×${e.h}, ${e.cloth})`);
    ok(!e.line,'no paper line before a close-up is taken here');
    await p.click('#item-view .wbstcard');await p.waitForSelector('#kitsheet.on');
    e=await p.evaluate(()=>({t:document.querySelector('#kit-title').textContent,b:document.querySelector('#kitsheet .kit-body').textContent,svg:!!document.querySelector('#kitsheet .kit-pic svg')}));
    ok(e.t==='White paper, true colors'&&/about a fifth of the picture/.test(e.b)&&/even under warm lamps/.test(e.b)&&e.svg,'tapping the card opens the short tip with its picture');
    await p.click('#kitsheet .kit-body .linkbtn');await settle(p,300);await p.waitForSelector('#kitsheet.on');
    ok(await p.evaluate(()=>document.querySelector('#kit-title').textContent==='A good close-up'),'the tip\'s "Tips for a good close-up" opens the guide');
    await p.click('#kitsheet .kit-x');await settle(p,200);
    ok(await p.evaluate(()=>{openItem('k1');const none=!document.querySelector('#item-view .wbstcard');openItem('m1');return none}),'no hint for an item without a close-up (shoes)');
    await settle(p,300);
    // ---- after Replace close-up
    const replace=async(name,u,sel='#item-view .phtools label:has(.vfile[onchange*=replaceTexture]) input')=>{const h=await p.$(sel);await p.evaluate(()=>{const l=document.querySelector('#ivwb');if(l)l.remove();phEdit.paper=null});
      await h.setInputFiles(file(name,u));
      await p.waitForFunction(()=>{const it=items.find(x=>x.id==='m1');return it.texture&&phEdit.paper===texSig(it.texture)&&!!document.querySelector('#ivwb')})};
    const line=()=>p.evaluate(()=>{const l=document.querySelector('#ivwb');return {cls:l.className,text:l.textContent,retake:!!l.querySelector('label.wbretake input[type=file]'),under:!!l.closest('#ivct')&&!!l.nextElementSibling&&l.nextElementSibling.classList.contains('wbsteps')}});
    await replace('paper.jpg',F.paper);e=await line();
    ok(/\bok\b/.test(e.cls)&&/White paper found/.test(e.text)&&/Colors set from it\./.test(e.text)&&!e.retake&&e.under,'a close-up with paper: "White paper found · Colors set from it." at the top of the Color & texture card, over the 3 steps');
    await replace('plain.jpg',F.plain);e=await line();
    ok(/\bno\b/.test(e.cls)&&/^!No white paperColors may be off\./.test(e.text)&&e.retake,`no paper: "No white paper · Colors may be off." with Retake close-up (${e.text})`);
    await p.evaluate(F=>{const it=items.find(x=>x.id==='m1');it.photo=F.warmPhoto;delete it.photoSm;renderWardrobe()},F);
    await replace('plain2.jpg',F.plain);e=await line();
    ok(/No white paper, and the light looks warm/.test(e.text)&&/Colors may come out yellower than the cloth\./.test(e.text)&&e.retake,'no paper and a warm photo: the warm wording, with Retake close-up');
    await replace('retake.jpg',F.paper,'#ivwb input[type=file]');e=await line();
    ok(/White paper found/.test(e.text),'Retake close-up from the line takes a new close-up (paper found)');
    ok(await p.evaluate(()=>!items[0].paperRef&&!('paper' in items[0])),'nothing new is stored on the item');
    await p.evaluate(()=>{const b=[...document.querySelectorAll('#toast.on button')].find(x=>x.textContent==='Undo');b.click()});await settle(p,300);
    ok(await p.evaluate(()=>!document.querySelector('#ivwb')),'the toast’s Undo (an older close-up) hides the line');
    // ---- 390 px, both themes
    for(const theme of ['light','dark']){
      await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);await replace('t-'+theme+'.jpg',F.plain);
      e=await p.evaluate(()=>{const v=document.querySelector('#item-view'),b=document.querySelector('#item-view .wbstcard .wbpic'),l=document.querySelector('#ivwb'),cs=getComputedStyle(b),ls=getComputedStyle(l),c=document.querySelector('#item-view .wbstcard'),cr=c.getBoundingClientRect(),
        eb=getComputedStyle(c.querySelector('.eb')),cam=getComputedStyle(c.querySelector('.cam'));
        return {fit:document.documentElement.scrollWidth<=390&&v.scrollWidth<=v.clientWidth+1&&cr.right<=390,img:/gradient/.test(cs.backgroundImage),lineBg:ls.backgroundColor,stBg:getComputedStyle(c).backgroundColor,card:getComputedStyle(document.querySelector('#item-view .ivtags')).backgroundColor,ctBg:getComputedStyle(document.querySelector('#ivct')).backgroundColor,
          eb:eb.color,camBg:cam.backgroundColor,camInk:cam.color,vis:b.offsetWidth>0&&l.offsetHeight>0&&cr.height>=44}});
      ok(e.fit&&e.img&&e.vis&&e.ctBg===e.card&&e.lineBg===e.stBg&&e.stBg!==e.card&&e.camBg!==e.camInk,`${theme}: the 3-step card, its drawings and the paper line show at 390 px without sideways scroll (${JSON.stringify(e)})`)}
    await p.evaluate(()=>{delete document.documentElement.dataset.theme});
    ok(!errs.length,'no page errors ('+errs.join(' | ')+')');
  }finally{await browser.close()}
};
const PAPER_WARM_T=1.08;
