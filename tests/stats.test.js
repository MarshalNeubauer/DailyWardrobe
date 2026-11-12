// The stats page (Settings → Wardrobe stats): wear counts from what was really worn and from the next six months' plan,
// the pieces that never get worn with a reason, what costs points, colour balance, pairings and rest, and what the planner
// has learned (which can be forgotten).
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900},locale:'en-US'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:+new Date(2026,10,4,12),...x});   // the wardrobe was set up on Nov 4
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('suit','brown'),I('blazer','navy'),I('pants','grey'),I('pants','tan'),I('pants','black'),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'gold'}),I('belt','tan',{leather:'suede',metal:'silver'}),
        I('socks','purple'),I('cufflinks','silver',{metal:'silver'}),I('watch','silver',{metal:'silver'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='never';settings.learn=null;settings.holidays=null;settings.daysOff=null;weather={};climate=null;TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};
      // history: three real days (one marked not worn), and a planner warm-up day from before the items existed
      const ids=(top,shirt,tie)=>({top,bot:top,shirt,tie,shoes:'shoes14',belt:'belt16',socks:'socks19',watch:'watch21'});
      dayRecs={'2026-9-1':{date:'2026-9-1',ids:ids('suit0','shirt8','tie11'),suitDay:true,auto:true},
        '2026-11-4':{date:'2026-11-4',ids:ids('suit0','shirt8','tie11'),suitDay:true},'2026-11-5':{date:'2026-11-5',ids:ids('suit1','shirt9','tie12'),suitDay:true,worn:false},
        '2026-11-8':{date:'2026-11-8',ids:ids('suit0','shirt9','tie11'),suitDay:true,worn:true},'2026-11-9':{date:'2026-11-9',ids:ids('suit2','shirt8','tie13'),suitDay:true}};
      sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    await p.evaluate(()=>openSettings());
    ok(await p.isVisible('#stats-btn'),'Settings has a Wardrobe stats button');
    await p.click('#stats-btn');
    ok(await p.evaluate(()=>!$('#stats').hidden&&$('#today').hidden&&$('#settings-modal').style.display==='none'&&/Wardrobe stats/.test($('#stats h2').textContent)),'it opens the stats page');
    const s=await p.evaluate(()=>{const S=buildStats(),row=id=>S.rows.find(r=>r.i.id===id);
      return {worn:S.worn.map(w=>w.date).join(),navy:row('suit0').worn,ch:row('suit1').worn,tie:row('tie11').worn,last:row('suit0').last&&key(row('suit0').last),plan:S.plan.length,planNavy:row('suit0').planned,next:!!row('suit0').next,
        unused:S.unused.map(r=>r.i.id).sort().join(),avg:S.avg,miss:Object.keys(S.miss),looks:S.looks,minRest:S.minRest,tiles:[...document.querySelectorAll('.st-tile b')].map(b=>b.textContent).join(),
        firstPlan:S.plan[0][0],lastPlan:S.plan[S.plan.length-1][0],sumTop:S.rows.filter(r=>r.i.type==='suit'||r.i.type==='blazer').reduce((a,r)=>a+r.planned,0)}});
    ok(s.worn==='2026-11-4,2026-11-8,2026-11-9'&&s.navy===2&&s.ch===0&&s.tie===2&&s.last==='2026-11-8',`worn counts come from the days really worn: not the day marked "Not worn", not a planner warm-up day from before the items existed (${s.worn})`);
    ok(s.plan>100&&s.plan<140&&s.firstPlan==='2026-11-11'&&/^2027-5-/.test(s.lastPlan)&&s.sumTop===s.plan&&s.planNavy>10&&s.next,`planned counts cover the next six months from tomorrow (${s.plan} outfits, ${s.firstPlan} to ${s.lastPlan})`);
    ok(s.tiles.split(',')[0]==='22'&&s.tiles.split(',')[1]==='3'&&+s.tiles.split(',')[2]===s.plan,`the tiles summarise items, days worn and outfits planned (${s.tiles})`);
    // never worn, with reasons
    const un=await p.evaluate(()=>[...document.querySelectorAll('#st-unused .st-row')].map(r=>r.querySelector('.st-nm').textContent+' → '+r.querySelector('small').textContent));
    const why=n=>(un.find(u=>u.toLowerCase().startsWith(n))||'');
    ok(s.unused==='belt18,cufflinks20,pants7'&&un.length===3,`the pieces never worn are listed (${s.unused})`);
    ok(/don't suit any of your blazers well enough/.test(why('trousers: black'))&&/None of your shoes match it/.test(why('belt: tan'))&&/no French-cuff shirt/.test(why('cufflinks')),`each with its reason (${un.join(' | ')})`);
    // wear counts by type: suits open, others unfold on tap (their rows are only built then)
    const wc=await p.evaluate(()=>({types:[...document.querySelectorAll('#st-wear .st-type summary b')].map(b=>b.textContent).join(),open:[...document.querySelectorAll('#st-wear .st-type[open]')].map(d=>d.dataset.type).join(),
      suitRows:[...document.querySelectorAll('#st-wear .st-type[data-type=suit] .st-row')].map(r=>r.textContent.replace(/\s+/g,' ').trim()),shirtRows:document.querySelectorAll('#st-wear .st-type[data-type=shirt] .st-row').length}));
    ok(/^Suits,Blazer,Trousers,Dress shirts,Ties/.test(wc.types)&&wc.open==='suit'&&wc.shirtRows===0,`wear counts are grouped by type, suits unfolded (${wc.types})`);
    ok(wc.suitRows.length===4&&/worn 2× · last Nov 8 · planned \d+× · next Nov \d+/.test(wc.suitRows.find(r=>/^navy/i.test(r))||''),`a row shows worn, last worn, planned and next (${wc.suitRows.find(r=>/^navy/i.test(r))})`);
    await p.click('#st-wear .st-type[data-type=shirt] summary');await p.waitForFunction(()=>document.querySelectorAll('#st-wear .st-type[data-type=shirt] .st-row').length===3);
    ok(await p.evaluate(()=>document.querySelector('#st-wear .st-type[data-type=shirt]').open&&document.querySelector('#st-wear .st-type[data-type=suit]').open),'tapping a type unfolds it and keeps the others as they were');
    // what costs points, colours, pairings
    const rest=await p.evaluate(()=>({miss:[...document.querySelectorAll('#st-points .st-miss')].map(m=>m.querySelector('b').textContent+': '+m.querySelector('span').textContent+' / '+(m.querySelector('small')||{textContent:''}).textContent),
      mix:[...document.querySelectorAll('#st-colours .st-mix')].map(m=>m.querySelector('small').textContent+'='+[...m.querySelectorAll('.st-mixnm')].map(x=>x.textContent).join('/')).join(' '),
      pct:[...document.querySelectorAll('#st-colours .st-mix')][0].querySelectorAll('.st-mixrow small').length,pairs:document.querySelectorAll('#st-pairs .st-pair').length,restTxt:document.querySelector('#st-pairs p:last-of-type').textContent,learn:document.querySelector('#st-learn').textContent}));
    ok(rest.miss.length>=2&&/^Socks: \d+ of \d+ days \/ Mostly: socks don't match the trousers\./.test(rest.miss[0])&&rest.miss.some(m=>/^Metals/.test(m)),`"What costs you points" ranks the deductions with the usual reason (${rest.miss.slice(0,3).join(' | ')})`);
    ok(/Jackets=.*Navy/.test(rest.mix)&&/Shirts=/.test(rest.mix)&&/Ties=/.test(rest.mix)&&rest.pct>=3,`the colour balance covers jackets, shirts and ties (${rest.mix})`);
    ok(rest.pairs>=3&&/A jacket rests at least \d+ workdays/.test(rest.restTxt)&&/shoes/i.test(rest.restTxt),`pairings and rest are shown (${rest.restTxt.trim()})`);
    ok(/Nothing yet/.test(rest.learn),'with nothing learned yet, it says so');
    // what the planner learned: listed, forgettable
    await p.evaluate(async()=>{settings.learn={p:{[pairKey(items[0],items[11])]:-2,[pairKey(items[1],items[12])]:1},i:{[items[3].id]:-1}};await saveUserSettings();renderStats()});
    const lr=await p.locator('#st-learn .st-learn').allTextContents();
    ok(lr.length===3&&/Avoids.*Navy suit with burgundy tie/i.test(lr[0])&&lr.some(l=>/Wears less.*Brown suit/i.test(l))&&lr.some(l=>/Prefers.*Charcoal suit with navy tie/i.test(l)),`what the planner learned is listed in words (${lr.map(l=>l.replace(/Forget$/,'')).join(' | ')})`);
    await p.click('#st-learn .st-learn button');await p.waitForFunction(()=>document.querySelectorAll('#st-learn .st-learn').length===2);
    ok(await p.evaluate(()=>!settings.learn.p[pairKey(items[0],items[11])]&&Object.keys(settings.learn.p).length===1),'"Forget" removes one thing it learned');
    await p.click('#st-learn .btns button');await p.waitForFunction(()=>/Nothing yet/.test(document.querySelector('#st-learn').textContent));
    ok(await p.evaluate(async()=>!settings.learn&&!(await metaGet('settings')).learn),'"Forget everything" clears it (saved)');
    // lowest days link back to Today; back button; an empty wardrobe
    await p.click('#stats .nav button');
    ok(await p.evaluate(()=>!$('#today').hidden&&$('#stats').hidden),'the back arrow returns to Today');
    ok(await p.evaluate(()=>{const keep=items;items=[];openStats();const t=$('#stats').textContent;items=keep;cache={};show('today');return /wardrobe is empty/i.test(t)}),'an empty wardrobe gets a plain message');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (never-worn reasons and points come from the planner); other tests get tests/fixedplan.js
