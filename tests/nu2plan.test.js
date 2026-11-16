// The planner and history findings of the re-audit (2026-11-15, fix round 2, Fixer 6):
// - H7: a real mistake (a hard check, score 69) is not planned while another choice avoids it: the jacket rotation would choose takes its
//   turn only when the day's trousers, shirts and ties make a clean outfit with it (a pinstripe suit, the only clean shirt a stripe and
//   the only tie a stripe: the plain suit goes), the clothes window falls back to a clean combination, and shoes that don't suit the
//   trousers lose to a pair with no matching belt (khaki chinos with black calf shoes while the oxblood loafers suit them)
// - ties: the very tie of the workday before costs TIE_NEXT more, so three ties don't repeat on consecutive workdays (one in three
//   before), also after a tie swap with the week locked
// - "I didn't wear them" has a lasting place: a card on Today under the month until the days are marked or kept
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844},locale:'en-US'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      window.fresh=(t='2026-11-15T12:00:00')=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='never';delete settings.darkShirts;delete settings.dress;delete settings.location;settings.holidays=null;settings.daysOff=[];settings.laundryDays=1;
        dayRecs={};weather={};climate=null;TODAY_OVERRIDE=t;cache={};sel=todayDate();view={y:sel.getFullYear(),m:sel.getMonth()}};
      // the workdays from today on, each once and in order (planMonth gives the shared simulation's whole plan)
      window.seqOf=n=>{const T=todayDate(),seen=new Set(),out=[];for(let mo=0;mo<n;mo++){const d=new Date(T.getFullYear(),T.getMonth()+mo,1),P=planMonth(d.getFullYear(),d.getMonth());
        for(const k of Object.keys(P))if(!seen.has(k)&&keyDate(k)>=T&&P[k]&&hasOutfit(P[k])){seen.add(k);out.push([k,P[k]])}}return out.sort((a,b)=>keyDate(a[0])-keyDate(b[0]))};
      window.hardDays=s=>s.filter(([k,o])=>rateOutfit(o).hard.length).map(([k,o])=>k+' '+['top','bot','shirt','tie','shoes'].map(x=>o[x]?o[x].id:'-').join('/')+' '+rateOutfit(o).hard.join(','));
      window.nextRep=s=>{let r=0;for(let i=1;i<s.length;i++)if(s[i][1].tie&&s[i-1][1].tie&&s[i][1].tie.id===s[i-1][1].tie.id)r++;return r}});

    // ---- H7: the laundry leaves only the striped shirt, the only tie is a stripe: the plain suit, not the pinstripe (three patterns)
    const h7=await p.evaluate(()=>{fresh('2027-01-19T08:00:00');settings.laundryDays=3;
      const plain=I('suit','charcoal'),pin=I('suit','charcoal',{pattern:'pinstripe',secondaryColor:'white'}),brown=I('suit','brown'),w1=I('shirt','white'),w2=I('shirt','white'),st=I('shirt','lightblue',{pattern:'stripe',secondaryColor:'white'}),
        tie=I('tie','red',{pattern:'stripe',secondaryColor:'navy'}),sh=I('shoes','black',{leather:'calf'}),sh2=I('shoes','brown',{leather:'calf'}),blz=I('blazer','navy'),pt=I('pants','grey');
      items=[plain,pin,brown,w1,w2,st,tie,sh,sh2,blz,pt];
      const rec=(k,o)=>{dayRecs[k]={date:k,ids:{top:o.top,bot:o.top,shirt:o.shirt,tie:tie.id,shoes:o.shoes},suitDay:true}};
      // the pinstripe rested longest; both white shirts worn in the last three days
      rec('2027-1-14',{top:brown.id,shirt:st.id,shoes:sh2.id});rec('2027-1-17',{top:plain.id,shirt:w1.id,shoes:sh.id});rec('2027-1-18',{top:brown.id,shirt:w2.id,shoes:sh2.id});cache={};
      const o=planMonth(2027,0)['2027-1-19'],r=rateOutfit(o);
      return {top:o.top&&o.top.id,shirt:o.shirt&&o.shirt.id,score:r.score,hard:r.hard,pin:pin.id,st:st.id,hardDays:hardDays(seqOf(3))}});
    ok(h7.shirt===h7.st&&h7.top!==h7.pin&&!h7.hard.length,`with only the striped shirt clean and one striped tie, the pinstripe suit waits (${h7.top}, ${h7.shirt}, ${h7.score}${h7.hard.length?' '+h7.hard:''})`);
    ok(!h7.hardDays.length,`no real mistake planned over three months (${h7.hardDays.slice(0,3).join('; ')||'none'})`);

    // ---- H7: blazer days with khaki chinos: oxblood loafers with no matching belt, not black calf shoes that don't suit them
    // (the loafers were worn the day before with the brown suit: their day's rest made the black pair with its matching belt win)
    const kh=await p.evaluate(()=>{fresh('2026-12-17T08:00:00');
      const brown=I('suit','brown'),ox=I('shoes','burgundy',{leather:'calf',shoeStyle:'loafer'}),w=I('shirt','white'),t=I('tie','navy');
      items=[I('suit','charcoal'),brown,I('blazer','navy'),I('pants','tan',{trouserKind:'chinos'}),I('pants','grey',{paused:true}),w,I('shirt','lightblue'),I('tie','burgundy'),t,
        I('shoes','black',{leather:'calf'}),ox,I('shoes','brown',{leather:'calf',paused:true}),I('belt','black',{leather:'calf'})];
      dayRecs['2026-12-16']={date:'2026-12-16',ids:{top:brown.id,bot:brown.id,shirt:w.id,tie:t.id,shoes:ox.id},suitDay:true};cache={};
      const o=planMonth(2026,11)['2026-12-17'],r=rateOutfit(o);
      return {bot:o.bot&&o.bot.primaryColor,shoes:o.shoes&&o.shoes.primaryColor,score:r.score,hard:r.hard,hardDays:hardDays(seqOf(3))}});
    ok(kh.bot==='tan'&&kh.shoes==='burgundy'&&!kh.hard.length,`a blazer day with only khaki chinos takes the oxblood loafers with no belt, not black shoes that don't suit them (${kh.shoes}, ${kh.score}${kh.hard.length?' '+kh.hard:''})`);
    ok(!kh.hardDays.length,`and no real mistake over three months (${kh.hardDays.slice(0,3).join('; ')||'none'})`);

    // ---- ties: three suits, three shirts, three ties (the re-audit's tester): no tie on two workdays running
    const ti=await p.evaluate(async()=>{fresh('2026-12-06T08:00:00');
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','lightgrey'),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue',{pattern:'stripe',secondaryColor:'white'}),I('shirt','lightblue'),
        I('tie','burgundy',{pattern:'stripe',secondaryColor:'navy'}),I('tie','navy'),I('tie','green',{pattern:'stripe',secondaryColor:'navy'}),I('pants','grey'),I('shoes','brown',{leather:'calf'}),I('shoes','black',{leather:'calf'}),I('belt','brown',{leather:'calf'}),I('socks','navy')];
      const a=seqOf(4),plain=nextRep(a);
      // a tie swap today with the week locked: the next workdays don't take the same tie two days running
      sel=todayDate();view={y:sel.getFullYear(),m:sel.getMonth()};await lockUpcoming();const cur=planFor()[key(sel)].tie.id,other=items.filter(i=>i.type==='tie'&&i.id!==cur)[0].id;
      await pickItem('tie',other);await new Promise(r=>setTimeout(r,300));cache={};const c=seqOf(1).slice(0,6);
      return {days:a.length,plain,swap:c.map(([k,o])=>o.tie.id).join(','),swapRep:nextRep(c),avg:Math.round(a.reduce((s,[k,o])=>s+rateOutfit(o).score,0)/a.length)}});
    ok(ti.days>60&&ti.plain<=2,`three ties: the same tie on two workdays running ${ti.plain} times in ${ti.days} (about one day in three before)`);
    ok(ti.swapRep===0,`after a tie swap the next days don't repeat a tie on consecutive workdays (${ti.swap})`);
    ok(ti.avg>=94,`the outfits still score well (average ${ti.avg})`);

    // ---- "I didn't wear them" stays on Today until answered
    const ms=await p.evaluate(async()=>{fresh('2026-11-26T08:00:00');try{localStorage.removeItem('missed_ok')}catch{}
      // (the wardrobe began on Nov 10, so only a few past days are recorded)
      const a={added:+new Date(2026,10,10)},L=[I('suit','navy',a),I('suit','grey',a),I('suit','charcoal',a),I('shirt','white',a),I('shirt','lightblue',a),I('tie','burgundy',a),I('tie','navy',a),I('tie','green',a),I('shoes','black',{leather:'calf',...a}),I('belt','black',{leather:'calf',...a})];items=L;
      // used for real on Nov 18 and 19, then away until today (Thu Nov 26)
      for(const k of ['2026-11-18','2026-11-19'])dayRecs[k]={date:k,ids:{top:L[0].id,shirt:L[3].id,tie:L[5].id,shoes:L[8].id},suitDay:true};cache={};
      const card=()=>{const c=document.querySelector('#missbox');return c?c.innerText.replace(/\s+/g,' '):''};
      const until=async f=>{for(let i=0;i<50&&!f();i++)await new Promise(r=>setTimeout(r,100))};
      show('today');renderToday();await until(()=>card());
      const first=card(),toastNow=document.querySelector('#toast').innerText;
      // a day ahead: no card there
      stepDay(1);await new Promise(r=>setTimeout(r,500));const ahead=card();goToday();await until(()=>card());
      // the toast is long gone: the card is still there, and its button marks the days
      const later=card();[...document.querySelectorAll('#missbox button')].find(b=>/didn.t wear/i.test(b.textContent)).click();await until(()=>!card());
      const marked=Object.values(dayRecs).filter(r=>r.auto&&r.worn===false).map(r=>r.date).sort((a,b)=>keyDate(a)-keyDate(b));const after=card();
      // another gap, kept as worn: the card goes and stays gone
      TODAY_OVERRIDE='2026-12-03T08:00:00';cache={};sel=todayDate();view={y:2026,m:11};/* December's plan: every missed day is recorded before the drawing (fix round 3) */renderToday();await until(()=>card());const gap2=card();
      [...document.querySelectorAll('#missbox button')].find(b=>/keep/i.test(b.textContent)).click();await new Promise(r=>setTimeout(r,400));const kept=card();
      renderToday();const kept2=card();const worn=Object.values(dayRecs).filter(r=>r.auto&&keyDate(r.date)>keyDate('2026-11-26')&&r.worn!==false).length;
      return {first,toastNow,ahead,later,marked,after,gap2,kept,kept2,worn}});
    ok(/4 workdays you didn’t open the app \(Sun, Nov 22 – Wed, Nov 25\) count as worn/.test(ms.first)&&/I didn’t wear them/.test(ms.first),`Today shows a card for the missed days ("${ms.first}")`);
    ok(!ms.ahead,'the card is only on the home day');
    ok(ms.later===ms.first&&ms.marked.join()==='2026-11-22,2026-11-23,2026-11-24,2026-11-25'&&!ms.after,`its "I didn't wear them" marks the four days not worn and the card goes (${ms.marked.join(', ')})`);
    ok(/count as worn/.test(ms.gap2)&&!ms.kept&&!ms.kept2&&ms.worn>0,`"Keep as worn" leaves the days worn and closes the card for good ("${ms.gap2}")`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses, not the fixed test plan
