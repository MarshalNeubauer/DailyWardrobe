// Fix round 3 (2026-11-16, Fixer 8): planner choices and wording, Insights, What to buy.
// - shoes with a suit: formality wins over a matching strap and buckle (the owner's decision), and not yesterday's pair when another suits (W2-17-02)
// - the picker's labels follow the score each piece would give (W2-17-03), "Choose shoes" (W2-17-13), two alike pieces told apart (W2-15-09)
// - an own color is spoken by its own name (W2-17-04); the Metals reason names only what is worn (W2-17-10)
// - Suggest another doesn't bring a real mistake while a clean piece is left (W2-17-07)
// - "chosen for variety" not after the owner's own pick (W2-17-08); a belt that matches no shoes costs nothing (W2-14-08)
// - Insights keeps its reasons table and fills a fold without drawing the page again (W2-18-02); weeks named from the first day (W2-15-08)
// - What to buy: the funeral line, the metals point once, "Ready" only when the occasion's own check is full, a second pair's reason (W2-17-09)
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:900},locale:'en-US'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      window.fresh=(t)=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';delete settings.darkShirts;delete settings.dress;delete settings.location;settings.holidays=null;settings.daysOff=[];settings.laundryDays=1;
        dayRecs={};weather={};climate=null;TODAY_OVERRIDE=t;cache={};sel=todayDate();view={y:sel.getFullYear(),m:sel.getMonth()}};
      window.seqOf=n=>{const T=todayDate(),seen=new Set(),out=[];for(let mo=0;mo<n;mo++){const d=new Date(T.getFullYear(),T.getMonth()+mo,1),P=planMonth(d.getFullYear(),d.getMonth());
        for(const k of Object.keys(P))if(!seen.has(k)&&keyDate(k)>=T&&P[k]&&hasOutfit(P[k])){seen.add(k);out.push([k,P[k]])}}return out.sort((a,b)=>keyDate(a[0])-keyDate(b[0]))};
      // tester 17's shoes and accessories: a gold watch on a brown strap, a brown suede belt with a gold buckle, black and oxblood calf belts with silver buckles
      window.w17=()=>[I('suit','navy',{pattern:'chalk-stripe',secondaryColor:'white'}),I('suit','charcoal',{pattern:'glen-check'}),I('suit','grey'),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','lavender'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','silver'),
        I('shoes','brown',{leather:'suede',shoeStyle:'loafer'}),I('shoes','black',{leather:'calf'}),I('shoes','oxblood',{leather:'calf',shoeStyle:'loafer'}),
        I('belt','brown',{leather:'suede',metal:'gold'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','oxblood',{leather:'calf',metal:'silver'}),
        I('watch','brown',{metal:'gold',band:'leather'}),I('socks','navy'),I('socks','charcoal')]});

    // ---- W2-17-02: suede loafers not with a suit most days; no pair two days running when another suits
    const sh=await p.evaluate(()=>{fresh('2026-11-15T08:00:00');items=w17();
      const s=seqOf(4),suit=s.filter(([k,o])=>o.suitDay),suede=suit.filter(([k,o])=>o.shoes&&o.shoes.leather==='suede').length;
      let b2b=0;for(let i=1;i<s.length;i++)if(s[i][1].shoes&&s[i-1][1].shoes&&s[i][1].shoes.id===s[i-1][1].shoes.id&&keyDate(s[i][0])-keyDate(s[i-1][0])<1.5*864e5)b2b++;
      const c={};for(const [k,o] of s)if(o.shoes)c[o.shoes.primaryColor]=(c[o.shoes.primaryColor]||0)+1;
      return {days:s.length,suitDays:suit.length,suede,b2b,c,watchBand:watchOpts(items.find(i=>i.type==='watch')).band}});
    ok(sh.watchBand==='leather'&&sh.suitDays>60&&sh.suede<=sh.suitDays*.1,`with a brown strap and a gold buckle, suede loafers go with a suit on ${sh.suede} of ${sh.suitDays} suit days (82 of 101 before) (${JSON.stringify(sh.c)})`);
    ok(sh.b2b<=sh.days*.1,`a pair two days running ${sh.b2b} times in ${sh.days} workdays (87 of 125 before)`);
    const sc=await p.evaluate(()=>{const s=items.find(i=>i.leather==='suede'&&i.type==='shoes'),bl=items.find(i=>i.type==='shoes'&&i.primaryColor==='black'),sb=items.find(i=>i.type==='belt'&&i.leather==='suede'),bb=items.find(i=>i.type==='belt'&&i.primaryColor==='black');
      const base={suitDay:true,top:items[0],bot:items[0],shirt:items[3],tie:items[7],watch:items.find(i=>i.type==='watch'),socks:items.find(i=>i.type==='socks')};
      return {suede:rateOutfit({...base,shoes:s,belt:sb}).score,black:rateOutfit({...base,shoes:bl,belt:bb}).score}});
    ok(sc.black>sc.suede,`the score agrees: black calf with a suit ${sc.black}, brown suede loafers ${sc.suede}`);

    // ---- W2-17-03: the picker's Best match is what the score says; picking it gives the score shown
    const pk=await p.evaluate(async()=>{fresh('2026-11-15T08:00:00');items=w17();show('today');const out=[];
      for(const slot of ['shoes','top','tie']){const o=planFor()[key(sel)],cur=rateOutfit(o).score,pool=slotPool(slot,o),sc=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]),best=sc[0][0];
        const tags=sc.map(([f,i])=>[fitTag(best-f)[1],f,i.id===(o[slot]&&o[slot].id)]);
        out.push({slot,cur,bad:tags.filter(([t,f,c])=>!c&&t==='Best match'&&f<cur).length+tags.filter(([t,f,c])=>!c&&t!=='Best match'&&f>best).length})}
      // a real pick of a non-current piece: the score after the pick is the one the picker worked out
      const o=planFor()[key(sel)],pool=slotPool('shoes',o).filter(i=>i.id!==o.shoes.id),i=pool[0],pred=fitOf('shoes',o,i);
      await pickItem('shoes',i.id);await new Promise(r=>setTimeout(r,200));cache={};const got=rateOutfit(planFor()[key(sel)]).score;
      return {out,pred,got,title:(openPicker('shoes'),document.querySelector('#pick-title').textContent),line:document.querySelector('#pick-sheet p').textContent}});
    ok(pk.out.every(x=>!x.bad),`no Best match lowers the score and no lower label scores higher (${JSON.stringify(pk.out)})`);
    ok(pk.pred===pk.got,`picking a pair gives the score the picker showed for it (${pk.pred} → ${pk.got})`);
    ok(pk.title==='Choose shoes'&&/^All the shoes you own/.test(pk.line),`the shoes picker says "${pk.title}" / "${pk.line}" (it said "Choose a shoes", "Every shoes")`);
    await p.evaluate(()=>closePicker());

    // ---- W2-15-09: two navy ties are told apart in the picker
    const dup=await p.evaluate(()=>{const a=I('tie','navy',{brand:'Drake'}),b=I('tie','navy');return [pickSub(a,[a,b]),pickSub(b,[a,b]),pickSub(items[7],[items[7]])]});
    ok(dup[0]==='Drake'&&dup[1]==='2 of 2'&&dup[2]==='',`two pieces named alike get a second line (${dup.join(' | ')})`);

    // ---- W2-17-15: a shoe's style and a trouser's kind in a described title
    const tt=await p.evaluate(()=>[itemTitle(I('shoes','oxblood',{leather:'calf',shoeStyle:'loafer'})),itemTitle(I('pants','stone',{trouserKind:'chinos'})),itemTitle(I('shoes','black',{leather:'calf'}))]);
    ok(tt[0]==='Oxblood calf loafers'&&tt[1]==='Stone chinos'&&tt[2]==='Black calf',`style and kind in names (${tt.join(' | ')})`);

    // ---- W2-17-04: an own color is spoken by its own name, in the reasons and in Insights' color balance
    const own=await p.evaluate(()=>{fresh('2026-11-15T08:00:00');settings.custom={colors:[{key:'owndustypink',name:'Dusty pink',hex:'#d8a1a8',base:'tan',types:['suit']}],patterns:[]};applyCustom(settings.custom);
      const pink=I('suit','owndustypink');items=[pink,...w17().filter(i=>i.type!=='suit'),I('tie','pink')];cache={};
      const r=rateOutfit({suitDay:true,top:pink,bot:pink,shirt:items.find(i=>i.primaryColor==='white'),tie:items.find(i=>i.type==='tie'&&i.primaryColor==='pink'),shoes:items.find(i=>i.type==='shoes'&&i.primaryColor==='oxblood')});
      const why=r.checks.map(c=>c.why).join(' | '),S=buildStats();return {why,jackets:S.jackets.map(x=>x[0]),names:S.jackets.map(x=>groupName(x[0]))}});
    ok(!/\btan\b/.test(own.why)&&/dusty pink jacket/.test(own.why),`the reasons call the suit dusty pink, not tan (${own.why})`);
    ok(own.jackets.includes('owndustypink')&&own.names.includes('Dusty pink')&&!own.jackets.includes('tan'),`Insights' color balance lists Dusty pink (${own.names.join(', ')})`);
    await p.evaluate(()=>{settings.custom={colors:[],patterns:[]};applyCustom(settings.custom)});

    // ---- W2-17-10: the Metals reason names only what is worn; W2-14-08: a belt that matches no shoes costs nothing
    const mt=await p.evaluate(()=>{const w=I('watch','silver',{metal:'gold'}),b=I('belt','black',{leather:'calf',metal:'silver'}),s=I('shoes','black',{leather:'calf'}),su=I('suit','navy'),grey=I('belt','grey',{leather:'calf',metal:'silver'});
      items=[su,s,b,w,grey,I('shirt','white'),I('tie','burgundy')];const o={suitDay:true,top:su,bot:su,shirt:items[5],tie:items[6],shoes:s,belt:b,watch:w,vest:true};
      const m=rateOutfit(o).checks.find(c=>c.label==='Metals');
      items=[su,s,I('shirt','white'),I('tie','burgundy')];const before=rateOutfit({suitDay:true,top:su,bot:su,shirt:items[2],tie:items[3],shoes:s}).score;
      items.push(grey);const after=rateOutfit({suitDay:true,top:su,bot:su,shirt:items[2],tie:items[3],shoes:s}).score;
      return {metals:m&&m.why,before,after}});
    ok(mt.metals==='watch and buckle metals differ',`a vest day's Metals reason names no tie clip ("${mt.metals}")`);
    ok(mt.before===mt.after,`adding a gray belt that matches none of the shoes leaves the score as it was (${mt.before} → ${mt.after}; it lost 15)`);

    // ---- W2-17-07: Suggest another skips a black shirt under a navy suit while lavender (in the wash) is clean
    const sg=await p.evaluate(async()=>{fresh('2026-11-17T08:00:00');
      const su=I('suit','navy'),wh=I('shirt','white'),lav=I('shirt','lavender'),bl=I('shirt','black'),t=I('tie','burgundy');
      items=[su,I('suit','charcoal'),wh,lav,bl,t,I('tie','navy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf'})];
      dayRecs['2026-11-16']={date:'2026-11-16',ids:{top:items[1].id,bot:items[1].id,shirt:lav.id,tie:items[6].id,shoes:items[7].id},suitDay:true};
      dayRecs['2026-11-17']={date:'2026-11-17',force:{top:su.id,shirt:wh.id,tie:t.id}};cache={};show('today');
      const o0=planFor()[key(sel)];await swapSlot('shirt');await new Promise(r=>setTimeout(r,200));cache={};const o=planFor()[key(sel)],r=rateOutfit(o);
      return {from:o0.shirt.primaryColor,shirt:o.shirt.primaryColor,score:r.score,hard:r.hard}});
    ok(sg.from==='white'&&sg.shirt==='lavender'&&!sg.hard.length,`Suggest another after the white shirt gives ${sg.shirt} (${sg.score}), not the black shirt (69)`);

    // ---- W2-17-08: no "chosen for variety" after the owner's own pick, and a coming day isn't "Today's"
    const vr=await p.evaluate(()=>{const o=planFor()[key(sel)];return {over:!!o.overrides,html:scoreCard({...o})}});
    ok(vr.over&&!/chosen for variety/.test(vr.html),'after a pick the score card no longer says the pieces were chosen for variety');

    // ---- W2-18-02: the reasons table is kept, and a fold fills its rows without drawing the page again
    const st=await p.evaluate(()=>{fresh('2026-11-15T08:00:00');items=[...w17(),I('tie','purple',{pattern:'paisley',secondaryColor:'gold'}),I('shirt','black')];cache={};show('stats');renderStats();
      whyUnused(items.find(i=>i.pattern==='paisley'));const m1=fitMemo;let calls=0;const keep=window.renderStats;renderStats();const m2=fitMemo;
      window.renderStats=(...a)=>{calls++;return keep(...a)};statsOpen.tie=false;const d=document.querySelector('#stats details.st-type[data-type="tie"]');d.open=true;statsToggle(d);window.renderStats=keep;
      return {same:m1===m2&&!!m1,calls,rows:d.querySelectorAll('.st-row').length,unused:document.querySelectorAll('#st-unused .st-row').length}});
    ok(st.same,'opening Insights again keeps the never-worn reasons worked out (fitMemo), until the plan changes');
    ok(st.calls===0&&st.rows>=5,`unfolding Ties fills its ${st.rows} rows without drawing the page again (${st.calls} redraws)`);

    // ---- W2-15-08: weeks are named from the first workday the wardrobe had, not a Friday before it
    const wk=await p.evaluate(()=>{fresh('2026-11-18T08:00:00');items=w17().map(i=>({...i,added:+new Date(2026,10,16,9)}));const s=items;
      dayRecs['2026-11-16']={date:'2026-11-16',ids:{top:s[0].id,bot:s[0].id,shirt:s[3].id,tie:s[7].id,shoes:s[12].id},suitDay:true,worn:true};cache={};
      const S=buildStats();return S.trend.map(t=>key(t.label))});
    ok(wk[0]==='2026-11-16',`the first week is named Nov 16, the day the wardrobe began (${wk.join(', ')})`);

    // ---- W2-17-09: What to buy's occasions: a charcoal glen check is dark, not missing; the metals point once; Ready means ready
    const oc=await p.evaluate(()=>{fresh('2026-11-15T08:00:00');items=[I('suit','charcoal',{pattern:'glen-check'}),I('suit','navy',{pattern:'chalk-stripe',secondaryColor:'white'}),...w17().filter(i=>i.type!=='suit')];
      const r=occasionCheck(items,'mild'),f=r.find(x=>x.occ==='funeral'),all=r.map(x=>x.gaps.join(' ')).join(' | ');
      const twice=r.some(x=>x.gaps.some(g=>/different metals/.test(g))&&x.gaps.some(g=>/metals differ/.test(g)));
      const odd=r.some(x=>x.ready&&x.gaps.some(g=>/suit a wedding|right for a funeral|formal (choice|shirt)/.test(g)));
      return {fun:f.gaps.join(' | '),twice,odd,all}});
    ok(!/No black, charcoal or navy suit/.test(oc.fun),`the funeral doesn't say there is no dark suit with a charcoal glen check owned (${oc.fun})`);
    ok(!oc.twice&&!oc.odd,`the metals point is made once and no occasion reads Ready over its own missing points (${oc.all})`);

    // ---- W2-17-20: correcting a vest day shows no tie clip row
    const vc=await p.evaluate(async()=>{fresh('2026-11-18T08:00:00');items=w17().map(i=>i.type==='suit'?{...i,vest:'yes'}:i);items.push(I('tieclip','silver'));const s=items;
      dayRecs['2026-11-17']={date:'2026-11-17',ids:{top:s[0].id,bot:s[0].id,shirt:s[3].id,tie:s[7].id,shoes:s[12].id},suitDay:true,vestOn:true,worn:true};cache={};
      sel=new Date(2026,10,17);view={y:2026,m:10};listOpen=true;show('today');togglePastEdit();await new Promise(r=>setTimeout(r,100));
      return {clip:!!document.querySelector('#ri-clip'),vest:planFor()['2026-11-17'].vest}});
    ok(vc.vest&&!vc.clip,'correcting a vest day offers no tie clip');

    // ---- W2-17-06 (part): "Add more suits" only when there aren't enough suits in rotation for the rest
    const rw=await p.evaluate(()=>{fresh('2026-11-18T08:00:00');const s=[I('suit','navy'),I('suit','grey'),I('suit','charcoal',{paused:true,away:{why:'cleaner'}})];items=[...s];
      const o=(r)=>({suitDay:true,top:{...s[0],rest:1},frozen:false});
      const two=restWarn(o());items.push(I('suit','brown'));const three=restWarn(o());
      dayRecs[key(sel)]={date:key(sel),force:{top:s[0].id}};const pick=restWarn(o());return {two,three,pick}});
    ok(/Add more suits/.test(rw.two),`two suits in rotation (one at the cleaner): "Add more suits" (${rw.two.replace(/<[^>]+>/g,'')})`);
    ok(rw.three==='','three suits in rotation and the planner chose it: no "Add more suits"');
    ok(/You wore this suit 1 day ago too/.test(rw.pick)&&!/Add more/.test(rw.pick),`picked by hand: it says only when it was worn (${rw.pick.replace(/<[^>]+>/g,'')})`);

    // ---- W2-18-03: What to buy says about how long is left
    const lf=await p.evaluate(()=>{shopBusy={i:4,n:20,label:'Suits',t0:Date.now()-25000};const a=shopBusyText();shopBusy=null;return a});
    ok(/About 1 minute left|About \d+ seconds left/.test(lf),`What to buy's progress says how long is left ("${lf}")`);

    ok(!errs.length,`no page errors (${errs.join('; ')})`);
  }finally{await browser.close()}
};
module.exports.realPlanner=true;
