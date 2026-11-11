// Today: double-tap the picture to zoom in 2.5x on the tapped spot (again to zoom out; a drag pans while zoomed and doesn't change
// the day); a swipe to another day folds every open box as soon as the drag is known to be sideways; a spinning pill shows while
// Claude or OpenAI is working; a shirt whose weave texture was read gets its own photo, described and drawn for the generator.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    let delay=0;const posts=[];
    await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());if(q.method()==='POST')posts.push(u.pathname);
      if(delay)await new Promise(r=>setTimeout(r,delay));
      if(u.pathname==='/pattern')return route.fulfill({status:422,contentType:'application/json',body:'{"error":"no pattern"}'});
      if(u.pathname==='/render'&&q.method()==='POST')return route.fulfill({status:200,contentType:'application/json',body:'{"queued":true}'});
      return route.fulfill({status:404,contentType:'application/json',body:'{}'})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};
      // a photo for the day: a 1024 px square with a grid, so zoom and pan can be measured
      const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#ccd';x.fillRect(0,0,1024,1024);x.strokeStyle='#333';for(let i=0;i<1024;i+=64){x.strokeRect(i,0,64,1024);x.strokeRect(0,i,1024,64)}
      const o=planFor()[key(sel)];renders[comboKey(o)]={sig:comboSig(o),img:c.toDataURL('image/jpeg',.8),model:'m',t:1};show('today')});
    await p.waitForSelector('#mannequin-container img');
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const tap=async(x,y)=>{await T('touchStart',x,y);await T('touchEnd')};
    const dtap=async(x,y)=>{await tap(x,y);await p.waitForTimeout(90);await tap(x,y);await settle(p,300)};
    const day=()=>p.evaluate(()=>document.querySelector('#today .day h2').textContent);
    const box=await p.evaluate(()=>{const b=document.querySelector('#mannequin-container img').getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}});
    // ---- zoom
    const at={x:box.x+box.w*.5,y:box.y+box.h*.4};
    const css=await p.evaluate(()=>getComputedStyle(document.querySelector('#mannequin-container')).touchAction);
    ok(css==='manipulation','the picture opts out of the browser\'s own double-tap zoom');
    await dtap(at.x,at.y);
    const z=await p.evaluate(()=>({on:document.querySelector('#mannequin-container').classList.contains('zoomed'),tf:document.querySelector('#mannequin-container img').style.transform,z:{...zoom},
      marks:getComputedStyle(document.querySelector('.wornbar')).opacity}));
    const px=at.x-box.x,py=at.y-box.y;
    ok(z.on&&/scale\(2\.5\)/.test(z.tf)&&Math.abs(z.z.x-px*(1-2.5))<1&&Math.abs(z.z.y-py*(1-2.5))<1,`a double tap zooms in 2.5x on the tapped spot (${z.tf})`);
    ok(z.marks==='0','the worn marks step aside while zoomed');
    const d0=await day();
    await T('touchStart',at.x,at.y);for(let k=1;k<=5;k++)await T('touchMove',at.x-12*k,at.y-8*k);await T('touchEnd');await settle(p,300);
    const pan=await p.evaluate(()=>({...zoom}));
    ok(Math.abs(pan.x-(z.z.x-60))<1&&Math.abs(pan.y-(z.z.y-40))<1&&await day()===d0,`a drag pans the zoomed picture and doesn't change the day (moved ${Math.round(pan.x-z.z.x)}, ${Math.round(pan.y-z.z.y)})`);
    await T('touchStart',at.x,at.y);for(let k=1;k<=10;k++)await T('touchMove',at.x+200*k,at.y+200*k);await T('touchEnd');
    const cl=await p.evaluate(()=>({...zoom}));
    ok(cl.x<=0&&cl.y<=0,'panning stops at the picture\'s edge');
    await dtap(at.x,at.y);
    ok(await p.evaluate(()=>!zoom&&!document.querySelector('#mannequin-container').classList.contains('zoomed')&&!document.querySelector('#mannequin-container img').style.transform),'a second double tap zooms back out');
    await p.waitForTimeout(750);await p.mouse.dblclick(at.x,at.y);await settle(p,300);
    ok(await p.evaluate(()=>!!zoom),'a double click (computer) zooms too');
    ok(await p.evaluate(()=>{renderToday();return document.querySelector('#mannequin-container').classList.contains('zoomed')}),'the zoom survives the page redrawing (a photo arriving)');
    await p.evaluate(()=>stepDay(1));
    ok(await p.evaluate(()=>!zoom&&!document.querySelector('#mannequin-container.zoomed')),'changing the day zooms back out');
    await p.evaluate(()=>stepDay(-1));
    // ---- a swipe folds every open box, while the drag is still going
    await p.evaluate(()=>{toggleScore();toggleList();toggleRow('tie');pickPiece('shoes');toggleMonth()});await settle(p,400);
    const open=()=>p.evaluate(()=>['#sbox','#ibox','#mbox','#bbox'].filter(s=>{const e=document.querySelector(s);return e&&e.classList.contains('open')}).length+document.querySelectorAll('.ritem.open').length);
    ok(await open()>=5,'score, pieces list, a piece, a below-the-waist photo and the month are open');
    await p.evaluate(()=>scrollTo(0,0));const st=await p.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+Math.min(b.height/2,300)}});
    const d1=await day();
    await T('touchStart',st.x+80,st.y);for(let k=1;k<=3;k++)await T('touchMove',st.x+80-20*k,st.y+2);
    const mid=await open();
    for(let k=4;k<=8;k++)await T('touchMove',st.x+80-25*k,st.y+2);await T('touchEnd');await settle(p,500);
    const after=await p.evaluate(()=>({scoreOpen,listOpen,monthOpen,belowOpen,openRow}));
    ok(mid===0,'the boxes fold as soon as the drag is known to be sideways (during the swipe)');
    ok(await day()!==d1&&await open()===0&&!after.scoreOpen&&!after.listOpen&&!after.monthOpen&&!after.belowOpen&&!after.openRow,'the next day comes in with everything folded');
    // the arrow buttons too
    await p.evaluate(()=>{toggleScore();toggleList()});await settle(p,300);await p.evaluate(()=>stepDay(1));
    ok(await open()===0,'stepping with the arrows folds them as well');
    // ---- working on it
    delay=600;
    const busy=()=>p.evaluate(()=>{const b=document.querySelector('#busy');return b&&b.classList.contains('on')?b.textContent:''});
    const pr=p.evaluate(()=>claudePattern({image:'data:image/png;base64,AA',type:'tie'}));await p.waitForTimeout(250);
    const during=await busy();await pr;await p.waitForTimeout(50);
    ok(/Claude is reading the pattern/.test(during)&&await p.evaluate(()=>!!document.querySelector('#busy .spin')),`a spinning pill shows while Claude works ("${during}")`);
    ok(await busy()==='','it goes away when the answer comes');
    const tg=p.evaluate(()=>ask('data:image/png;base64,AA',{}));await p.waitForTimeout(250);const tagging=await busy();await tg;
    const rd=p.evaluate(()=>fetch('https://w.test/render',{method:'POST',body:JSON.stringify({image:'x',key:'c1'})}));await p.waitForTimeout(250);const making=await busy();await rd;
    const iq=p.evaluate(()=>fetch('https://w.test/render',{method:'POST',body:JSON.stringify({mode:'item',key:'c2'})}));await p.waitForTimeout(250);const itemPic=await busy();await iq;
    ok(/tagging/.test(tagging)&&/Making the photo/.test(making)&&/item picture/.test(itemPic),`tagging, making a photo and an item picture each say so ("${tagging}", "${making}", "${itemPic}")`);
    const two=[p.evaluate(()=>claudePattern({image:'data:image/png;base64,AA',type:'tie'})),p.evaluate(()=>ask('data:image/png;base64,AA',{}))];await p.waitForTimeout(250);const both=await busy();await Promise.all(two);
    ok(/\+1/.test(both),`two at once: the latest, with a count of the rest ("${both}")`);
    const qd=p.evaluate(()=>fetch('https://w.test/render',{method:'POST',body:JSON.stringify({mode:'queue',key:'c3'})}));await p.waitForTimeout(250);const queued=await busy();await qd;
    const syncs=p.evaluate(()=>fetch('https://w.test/sync',{method:'GET'}));await p.waitForTimeout(250);const sync=await busy();await syncs;
    ok(queued===''&&sync==='','handing a job to the queue or syncing shows nothing (no AI is waiting on it)');
    delay=0;
    const bg=await p.evaluate(()=>{rqSet({keys:['c1','c2'],failed:[],total:2});const a=document.querySelector('#busy').textContent;rqSet({keys:[],failed:[],total:2});return {a,off:!document.querySelector('#busy').classList.contains('on')}});
    ok(/Making 2 photos in the background/.test(bg.a)&&bg.off,`photos being made in the background show until they're done ("${bg.a}")`);
    const gen=await p.evaluate(()=>{const o=planFor()[key(sel)];delete renders[comboKey(o)];rendering=true;renderToday();const b=document.querySelector('.render-btn');const r={spin:!!(b&&b.querySelector('.spin')),t:b&&b.textContent};rendering=false;renderToday();return r});
    ok(gen.spin&&/Generating photo/.test(gen.t),'"Generating photo…" on Today spins too');
    const dz=await p.evaluate(()=>{const o=planFor()[key(sel)];delete renders[comboKey(o)];renderToday();const t=zoomTarget(),r=t.getBoundingClientRect();toggleZoom(r.x+r.width/2,r.y+r.height/3);
      const out={tag:t.tagName,tf:t.style.transform};zoomOut();return out});
    ok(dz.tag==='svg'&&/translate\(-?[\d.]+px, ?-?[\d.]+px\) scale\(2\.5\)/.test(dz.tf),`the drawing (no photo yet) zooms too (${dz.tf})`);
    // ---- a textured shirt in the photo
    const tx=await p.evaluate(async()=>{const sh=items.find(i=>i.type==='shirt'),o=planFor()[key(sel)];const plain=comboKey({...o,shirt:sh}),ptxt=outfitText({...o,shirt:sh});
      const grid=['10000001','01000010','00100100','00011000','00011000','00100100','01000010','10000001'];
      const w={...sh,id:'shw',pattern:'woven',texture:'data:image/jpeg;base64,AA',sett:{v:4,tex:{kind:'diamond',grid,aspect:1.4,lighter:true,contrast:'subtle',rel:.2},a:0,cr:20,tr:45,src:'claude+pixels'}};
      const oo={...o,shirt:w},refs=await outfitRefsFull(oo),plainRefs=await outfitRefsFull({...o,shirt:sh}),other={...w,sett:{...w.sett,tex:{...w.sett.tex,kind:'herringbone',grid:['10','01']}}};
      const i=refs.labels.findIndex(l=>/weave texture/.test(l));
      return {plain,tex:comboKey(oo),other:comboKey({...o,shirt:other}),ptxt,text:outfitText(oo),label:refs.labels[i]||'',img:(refs.refs[i]||'').slice(0,22),n:refs.refs.length,plainDia:plainRefs.labels.some(l=>/drawing of the shirt/.test(l))}});
    ok(tx.tex!==tx.plain&&tx.other!==tx.tex,'a shirt with a read weave texture gets its own photo (a plain white shirt\'s photo isn\'t reused), and each texture its own');
    ok(/plain white dress shirt/.test(tx.ptxt)&&/white dress shirt woven with a fine, subtle tone-on-tone small diamond dobby weave/.test(tx.text),`the photo prompt describes the weave ("${tx.text.match(/a white dress shirt[^;]*/)[0].slice(0,90)}…")`);
    ok(/drawing of the shirt's weave texture/.test(tx.label)&&/^data:image\/png/.test(tx.img)&&tx.n<=8&&!tx.plainDia,'a drawing of the texture (contrast exaggerated) goes to the generator with the shirt\'s close-up');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
