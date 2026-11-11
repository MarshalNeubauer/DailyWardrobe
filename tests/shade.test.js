// Shade: the owner can draw an item darker or lighter than its tagged colour's swatch (steps of SHADE_STEP L*), or set it from the
// close-up in one tap ("Match close-up"), on the Add card and in the Wardrobe editor. Only the drawing changes: the tag, the
// planner's brightness rules and the photo key stay as tagged. The user's mink suit (deep taupe) matches its close-up at Darker 2.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const core=await p.evaluate(()=>{const L=h=>rgbLab(...hexRgb(h))[0],it={id:'x',type:'suit',primaryColor:'deeptaupe',pattern:'solid'};
      return {base:L(colOf(it)),dark:L(colOf({...it,shade:-2})),light:L(colOf({...it,shade:3})),tag:primaryCol({...it,shade:-2}),lum:lumOf('deeptaupe'),
        key:comboKey({suitDay:true,top:it})===comboKey({suitDay:true,top:{...it,shade:-2}}),name:[shadeName(0),shadeName(-2),shadeName(1)].join('|')}});
    ok(Math.abs(core.base-core.dark-8)<1&&Math.abs(core.light-core.base-12)<1,`each step moves the drawn colour ${4} L* (deep taupe L* ${core.base.toFixed(1)} → ${core.dark.toFixed(1)} darker 2, ${core.light.toFixed(1)} lighter 3)`);
    ok(core.tag==='deeptaupe'&&core.key,'the tag and the photo key stay as tagged');
    ok(core.name==='As tagged|Darker 2|Lighter 1','the steps are named "As tagged", "Darker 2", "Lighter 1"');
    // the Add card, with the user's suit and its close-up
    const card=await p.evaluate(async()=>{const ld=async s=>{const im=new Image();im.src=s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c};
      show('add');addManual();const q=queue[0];q.manual=false;q.photo='tests/fixtures/suit-mink.jpg';q.texture='tests/fixtures/suit-mink-closeup.png';q.type='suit';q.primaryColor='deeptaupe';
      q.meas={...measureCloth(await ld(q.texture),null,{}),src:'closeup'};q.meas.near=nearestCols('suit',q.meas.lab,false);renderAdd();
      const r=document.querySelector('#queue .shaderow');return r&&{txt:r.textContent,match:!!r.querySelector('.chipbtn')}});
    ok(card&&/Shade.*As tagged/.test(card.txt)&&card.match,'the Add card has a Shade row with − / + and Match close-up');
    await p.click('#queue .shaderow .shbtn[aria-label="Darker"]');
    const st=await p.evaluate(()=>({s:queue[0].shade,v:document.querySelector('#queue .shval').textContent,drawn:document.querySelector('#queue .tagsw').innerHTML.includes(colOf(queue[0]))}));
    ok(st.s===-1&&st.v==='Darker 1'&&st.drawn,'− makes it one step darker, and the swatch is drawn in the new shade');
    await p.click('#queue .shaderow .chipbtn');
    const m=await p.evaluate(()=>({s:queue[0].shade,L:rgbLab(...hexRgb(colOf(queue[0])))[0],meas:queue[0].meas.lab[0]}));
    ok(m.s===-2&&Math.abs(m.L-m.meas)<=2.5,`Match close-up sets the shade from the close-up's lightness (Darker 2: drawn L* ${m.L.toFixed(1)}, close-up ${m.meas})`);
    await p.evaluate(async()=>{queue[0].id='mink';await save(0)});
    ok(await p.evaluate(()=>items.find(i=>i.id==='mink').shade===-2),'saving keeps the shade on the item');
    // the Wardrobe editor
    await p.evaluate(()=>{flt='all';editing=null;show('wardrobe');openItem('mink')});await settle(p,500);
    ok(/Darker 2/.test(await p.textContent('#gi-mink .shaderow')),'the open item shows its shade');
    await p.click('#gi-mink .shaderow .shbtn[aria-label="Lighter"]');await p.waitForFunction(()=>items.find(i=>i.id==='mink').shade===-1);
    await p.evaluate(()=>{const it=items.find(i=>i.id==='mink');delete it.meas});   // the close-up measured afresh from the item's own picture
    await p.click('#gi-mink .shaderow .chipbtn');await p.waitForFunction(()=>items.find(i=>i.id==='mink').shade===-2,null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>items.find(i=>i.id==='mink').shade===-2),'in the editor, + steps it and Match close-up measures the saved close-up again');
    // the planner reads the tag, not the shade
    ok(await p.evaluate(()=>{const it=items.find(i=>i.id==='mink');return planCol(it)==='deeptaupe'&&lumOf(primaryCol(it))===lumOf('deeptaupe')}),'the planner still reads the tagged colour');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
