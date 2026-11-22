// The planner's rules on whole wardrobes, with the real planner: odd trousers, shoes, enamel clips, khaki, the new-user and fix-round choices.
// Joined by feature from 5 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/rules8.test.js ---- */
// Planner rules 8: odd trousers rotate (their rest counts over months, since blazer days are weekly); shoes get a day off
// when another pair suits; steel blue is a mid-tone shirt (worn under a darker jacket with a darker tie), not a "dark shirt".
const rules8=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('suit','brown'),I('suit','tan'),I('blazer','navy'),I('blazer','charcoal'),I('blazer','tan'),
        I('pants','grey'),I('pants','charcoal'),I('pants','tan'),I('pants','khaki'),I('pants','navy'),I('pants','black'),
        I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','steelblue'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','brown'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('shoes','oxblood',{leather:'calf'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','oxblood',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='never';weather={};climate=null;dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};
      const seq=[];for(let m=10;m<17;m++){const y=2026+Math.floor(m/12),mm=m%12,pl=planMonth(y,mm);for(const [d,o] of Object.entries(pl)){const dt=keyDate(d);if(dt.getMonth()===mm&&dt.getFullYear()===y&&dt>=todayDate()&&o.top)seq.push([d,o])}}
      const pants={};seq.forEach(([,o])=>{if(!o.suitDay&&o.bot)pants[o.bot.primaryColor]=(pants[o.bot.primaryColor]||0)+1});
      const b2b=seq.filter((x,n)=>n&&x[1].shoes.id===seq[n-1][1].shoes.id&&keyDate(x[0])-keyDate(seq[n-1][0])<1.5*864e5);
      const forced=b2b.filter(([d,o])=>{const alt=items.filter(i=>i.type==='shoes'&&i.id!==o.shoes.id);return alt.every(s=>shoeScore(o.top,o.bot,s)<=-50)}).length;
      const sb=seq.filter(([,o])=>o.shirt.primaryColor==='steelblue');
      const sbi=items.find(i=>i.primaryColor==='steelblue');
      return {pants,blazerDays:seq.filter(([,o])=>!o.suitDay).length,b2b:b2b.length,forced,n:seq.length,minScore:Math.min(...seq.map(([,o])=>rateOutfit(o).score)),
        sb:sb.length,sbOk:sb.every(([,o])=>LUM(o.top)<LUM(o.shirt)-20&&LUM(o.tie)<LUM(o.shirt)-25),sbScore:sb.length?Math.min(...sb.map(([,o])=>rateOutfit(o).score)):0,
        dark:[darkShirt(sbi),darkShirt({primaryColor:'slate'}),darkShirt({primaryColor:'navy'}),darkShirt({primaryColor:'blue'})].join()}});
    ok(['grey','charcoal','tan','khaki','navy'].every(c=>r.pants[c]>=2)&&!r.pants.black,`every pair of trousers that suits a blazer gets worn, not just each blazer's best match (${JSON.stringify(r.pants)} over ${r.blazerDays} blazer days); black odd trousers stay out`);
    ok(Math.max(...Object.values(r.pants))<=r.blazerDays*.5,`no single pair takes over the blazer days (${Math.max(...Object.values(r.pants))} of ${r.blazerDays})`);
    ok(r.b2b===r.forced,`shoes are not worn two days running when another pair suits the outfit (${r.b2b} repeats, ${r.forced} with no alternative)`);
    ok(r.dark==='false,true,true,false',`steel blue is not a "dark shirt"; slate and navy still are (${r.dark})`);
    ok(r.sb>=3&&r.sbOk&&r.sbScore>=80,`a steel blue shirt gets worn, under a darker jacket with a darker tie (${r.sb} days, lowest score ${r.sbScore})`);
    ok(r.minScore>=80,`the new rotation never costs a good outfit (lowest score ${r.minScore})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) runs the real planner (it checks planning rules); other tests get tests/fixedplan.js

/* ---- was tests/enamelclip.test.js ---- */
// Enamel tie clips are planned by the tie (2026-11-14, the owner: 7 of his 9 clips were never planned; an enamel clip scored 0 against a
// silver watch-and-buckle match's 9). planner.js enamelPref: an accent of the tie wins, the tie's own colour or a near one comes round,
// a clash stays off; gold stays off against a silver watch and buckle (the owner: "keep gold off").
const enamelclip=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      const T1=I('tie','taupe',{pattern:'stripe',secondaryColor:'cream',tertiaryColor:'steelblue'}),T2=I('tie','burgundy'),T3=I('tie','green'),T4=I('tie','navy',{pattern:'stripe',secondaryColor:'white'});
      const silver=I('tieclip','silver'),blue=I('tieclip','blue'),red=I('tieclip','red'),navy=I('tieclip','navy'),gold=I('tieclip','gold');
      const prefs={accent:enamelPref(blue,T1),tone:enamelPref(red,T2),toneNavy:enamelPref(navy,T4),near:enamelPref(blue,T4),clash:enamelPref(blue,T3),clashRed:enamelPref(red,T1),none:enamelPref(blue,null)};
      items=[I('blazer','navy'),I('blazer','charcoal'),I('pants','grey'),I('pants','tan'),I('shirt','white'),I('shirt','lightblue'),T1,T2,T3,T4,
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal'),
        I('watch','silver',{metal:'silver'}),silver,blue,red,navy,gold];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[0,1,2,3,4];settings.vestMode='never';weather={};climate=null;dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};
      // the same day with each tie picked
      const on=t=>{dayRecs={'2026-11-16':{date:'2026-11-16',force:{tie:t.id}}};cache={};const o=planMonth(2026,10)['2026-11-16'];return o.clip?o.clip.primaryColor:null};
      const picks={T1:on(T1),T3:on(T3)};dayRecs={};cache={};
      // six months: every clip but gold comes round
      const n={};for(let m=10;m<16;m++){const pl=planMonth(2026+Math.floor(m/12),m%12);for(const [d,o] of Object.entries(pl))if(keyDate(d).getMonth()===m%12&&keyDate(d)>=todayDate()&&o.clip)n[o.clip.primaryColor]=(n[o.clip.primaryColor]||0)+1}
      return {prefs,picks,n}});
    const P=r.prefs;
    ok(P.accent===11&&P.tone===8&&P.toneNavy===8&&P.near===8&&P.clash===-5&&P.clashRed===-5&&P.none===0,`an enamel clip: an accent of the tie 11, its colour or a near one 8, a clash -5 (${JSON.stringify(P)})`);
    ok(r.picks.T1==='blue',`on a taupe, cream and steel blue stripe the blue enamel clip is chosen over silver (${r.picks.T1})`);
    ok(r.picks.T3==='silver',`on a green tie, where every enamel clip clashes, silver (${r.picks.T3})`);
    ok(r.n.blue>0&&r.n.red>0&&r.n.navy>0&&r.n.silver>0&&!r.n.gold,`six months: the enamel clips come round, gold never with a silver watch and buckle (${JSON.stringify(r.n)})`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
// (realPlanner) it checks what the planner chooses (planMonth), not the fixed test plan

/* ---- was tests/nu2plan.test.js ---- */
// The planner and history findings of the re-audit (2026-11-15, fix round 2, Fixer 6):
// - H7: a real mistake (a hard check, score 69) is not planned while another choice avoids it: the jacket rotation would choose takes its
//   turn only when the day's trousers, shirts and ties make a clean outfit with it (a pinstripe suit, the only clean shirt a stripe and
//   the only tie a stripe: the plain suit goes), the clothes window falls back to a clean combination, and shoes that don't suit the
//   trousers lose to a pair with no matching belt (khaki chinos with black calf shoes while the oxblood loafers suit them)
// - ties: the very tie of the workday before costs TIE_NEXT more, so three ties don't repeat on consecutive workdays (one in three
//   before), also after a tie swap with the week locked
// - "I didn't wear them" has a lasting place: a card on Today under the month until the days are marked or kept
const nu2plan=async({ok,chromium,url})=>{
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
// (realPlanner) it checks what the planner chooses, not the fixed test plan

/* ---- was tests/newuserplan.test.js ---- */
// The planner and history findings of the new-user audit (2026-11-15, Fixer 6):
// - the week's locks let go once a new wardrobe outgrows a type it was locked with too few of (lockAt, lockStale); an old lock and an
//   established wardrobe keep theirs
// - trousers or a suit with no shoes that suit them are planned only when nothing else can be (NO_SHOES): no "real mistake" while a
//   better outfit exists
// - shoes held back for want of a matching belt are named (beltWait): the score's Variety line and Insights
// - the days before the wardrobe began are not planned (no rest or repeats from them); a gap in use is said once, with "I didn't wear them"
// - an item's season from its material; with no location the holiday country gives a Gulf climate or the southern hemisphere
// - the jacket worn the workday before costs JKT_AGAIN (a wedding no longer takes it two days running); every shirt in the wash gives the
//   one washed longest ago; a tie swap releases the next days' locks holding that tie; a funeral without a black tie takes a stripe over dots
// - "Every suit day" gives a new suit its vest; a dress-code switch is saved before the week's locks are released
const newuserplan=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844},locale:'en-US'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      window.fresh=(t='2026-11-15T12:00:00')=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='never';delete settings.darkShirts;delete settings.dress;delete settings.location;settings.holidays=null;settings.daysOff=[];settings.laundryDays=1;
        dayRecs={};weather={};climate=null;TODAY_OVERRIDE=t;cache={};sel=todayDate();view={y:sel.getFullYear(),m:sel.getMonth()}};
      window.months=n=>{const T=todayDate(),pl=planSim(planStart(T.getFullYear(),T.getMonth())).upTo(new Date(T.getFullYear(),T.getMonth()+n,0));return Object.entries(pl).filter(([k])=>keyDate(k)>=T)};
      window.week=()=>{const T=todayDate(),out=[];for(let g=0;g<7;g++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+g);if(!isWorkday(d))continue;const o=planMonth(d.getFullYear(),d.getMonth())[key(d)];out.push({k:key(d),dow:d.getDay(),top:o&&o.top&&o.top.id,type:o&&o.top&&o.top.type,tie:o&&o.tie&&o.tie.id,lock:dayRecs[key(d)]&&dayRecs[key(d)].lock})}return out}});

    // ---- H6: a new wardrobe's first locked week lets go once a second suit and a blazer come in
    const h6=await p.evaluate(async()=>{fresh();const t0=Date.now()-60000;
      items=[I('suit','navy',{added:t0}),I('shirt','white',{added:t0}),I('shoes','black',{leather:'calf',added:t0}),I('tie','burgundy',{added:t0})];
      await lockUpcoming();const before=week();
      items.push(I('suit','grey',{added:Date.now()+5}),I('blazer','charcoal',{added:Date.now()+5}),I('pants','grey',{added:Date.now()+5}),I('shirt','lightblue',{added:Date.now()+5}));cache={};
      const after=week();await lockUpcoming();const relocked=week();
      return {before,after,relocked}});
    ok(h6.before.length===5&&h6.before.every(d=>d.top==='suit000'&&d.lock&&d.lock.top==='suit000'),'the first week is locked with the only suit, its blazer day too');
    const thu=h6.after.find(d=>d.dow===4);
    ok(thu&&thu.type==='blazer'&&h6.after.filter(d=>d.top==='suit000').length<4,`once a second suit and a blazer are added, the blazer day gets the blazer and the suits take turns (${h6.after.map(d=>d.top).join(', ')})`);
    ok(h6.relocked.every(d=>d.lock&&d.lock.top===d.top),'the week is locked again as it now shows');
    // an established wardrobe (three of each) and a lock from before lockAt keep their locks
    const keep=await p.evaluate(async()=>{fresh();const t0=Date.now()-60000;
      items=['navy','grey','charcoal'].map(c=>I('suit',c,{added:t0})).concat(['white','lightblue','pink'].map(c=>I('shirt',c,{added:t0})),['burgundy','navy','green'].map(c=>I('tie',c,{added:t0})),[I('shoes','black',{leather:'calf',added:t0}),I('blazer','navy',{added:t0}),I('pants','grey',{added:t0})]);
      await lockUpcoming();const a=week().map(d=>d.top+d.tie).join();items.push(I('suit','brown',{added:Date.now()+5}),I('tie','purple',{added:Date.now()+5}));cache={};const b=week().map(d=>d.top+d.tie).join();
      for(const r of Object.values(dayRecs))delete r.lockAt;items.push(I('suit','tan',{added:Date.now()+5}));cache={};const c=week().map(d=>d.top+d.tie).join();
      return {a,b,c}});
    ok(keep.a===keep.b,'with three or more of each, a new suit and tie leave the locked week as shown');
    ok(keep.a===keep.c,'a lock made before locks noted their time keeps the week as shown');

    // ---- H7: no "real mistake" while a better outfit exists
    const h7=await p.evaluate(()=>{fresh();settings.dress={jacket:false,tie:true};
      items=[I('shirt','white'),I('tie','navy'),I('pants','charcoal'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('shirt','pink'),I('tie','burgundy',{pattern:'stripe',secondaryColor:'navy'}),I('pants','stone',{trouserKind:'chinos'})];
      const hard=pl=>pl.filter(([k,o])=>rateOutfit(o).hard.includes('Shoes')).length,a=months(2);
      settings.dress=null;delete settings.dress;settings.blazerDays=[0,1,2,3,4];
      items=[I('blazer','navy',{pattern:'hopsack'}),I('pants','stone',{trouserKind:'chinos'}),I('pants','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','green',{pattern:'knit'}),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'})];cache={};
      const b=months(2);items=items.filter(i=>!(i.type==='pants'&&i.primaryColor==='grey'));cache={};const c=months(1);
      return {noJ:hard(a),noJn:a.length,blazer:hard(b),blazerN:b.length,only:c.length>0&&c.every(([k,o])=>o.bot&&o.bot.primaryColor==='stone'),onlyNote:c.length&&c[0][1].notes.join(' ')}});
    ok(h7.noJ===0&&h7.noJn>20,`without jackets, stone pants are not worn with the only (black) shoes while charcoal ones are free (${h7.noJ} of ${h7.noJn} days with a hard Shoes check)`);
    ok(h7.blazer===0&&h7.blazerN>20,`blazer days: chinos that no shoes suit are left for the gray pants (${h7.blazer} of ${h7.blazerN} days with a hard Shoes check)`);
    ok(h7.only&&/None of your shoes suit stone pants/.test(h7.onlyNote),'with nothing else they are still planned, with the note');

    // ---- black shoes waiting for a belt are named
    const bw=await p.evaluate(()=>{fresh();items=[I('suit','navy'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','brown',{leather:'calf'}),I('shoes','black',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'})];
      const blk=items.find(i=>i.type==='shoes'&&i.primaryColor==='black'),pl=months(1),v=pl.map(([k,o])=>(rateOutfit(o).checks.find(c=>c.label==='Variety')||{}).why||'').find(w=>/same shoes as yesterday/.test(w))||'';
      return {wait:beltWait(blk),brown:beltWait(items.find(i=>i.type==='shoes'&&i.primaryColor==='brown')),v,why:whyUnused(blk)}});
    ok(bw.wait==='black smooth leather belt'&&bw.brown==='','black oxfords with only a brown belt wait for a black smooth leather belt; the brown pair waits for nothing');
    ok(/your black shoes wait for a black smooth leather belt/.test(bw.v),`the score's Variety line says why the same shoes come again ("${bw.v}")`);
    ok(/None of your belts match them.*black smooth leather belt/.test(bw.why),`Insights says why they are never worn ("${bw.why}")`);

    // ---- the days before the wardrobe began
    const ps=await p.evaluate(()=>{fresh();const t=+todayDate()+8*3600e3;items=[I('suit','navy',{added:t}),I('shirt','white',{added:t}),I('tie','burgundy',{added:t}),I('shoes','black',{leather:'calf',added:t})];
      const pl=planSim(planStart(2026,10)).upTo(new Date(2026,10,30)),o=pl['2026-11-15'],r=rateOutfit(o);
      return {before:Object.keys(pl).filter(k=>keyDate(k)<todayDate()).length,rest:o.top.rest,variety:r.checks.some(c=>c.label==='Variety')}});
    ok(ps.before===0&&ps.rest>=3&&!ps.variety,`no day before the first item is planned: the first outfit has no made-up wear (rest ${ps.rest}) and no Variety deduction`);

    // ---- a gap in use is said once, with a way to mark the days not worn
    const gap=await p.evaluate(async()=>{fresh('2026-11-19T12:00:00');const t=+new Date(2026,10,12,8);items=[I('suit','navy',{added:t}),I('suit','grey',{added:t}),I('shirt','white',{added:t}),I('tie','burgundy',{added:t}),I('shoes','black',{leather:'calf',added:t})];
      const o=planMonth(2026,10)['2026-11-12'];dayRecs['2026-11-12']={date:'2026-11-12',ids:idsOf(o),suitDay:true};cache={};
      await recordDays(planMonth(2026,10));await new Promise(r=>setTimeout(r,700));
      // the toast, or the card when it is on screen (fix round 3: not both)
      const c=document.querySelector('#missbox');return c&&!c.closest('[hidden]')?c.textContent:document.querySelector('#toast').textContent});
    ok(/4 (past )?workdays you didn’t open the app \(Sun, Nov 15 – Wed, Nov 18\) (were counted|count) as worn/.test(gap),`back after days away, the app says the missed workdays were counted as worn ("${gap}")`);
    await p.evaluate(()=>{const c=document.querySelector('#missbox');(c&&!c.closest('[hidden]')?[...c.querySelectorAll('button')].find(b=>/didn.t wear/i.test(b.textContent)):document.querySelector('#toast button')).click()});
    const gap2=await p.evaluate(async()=>{await new Promise(r=>setTimeout(r,300));return ['2026-11-15','2026-11-16','2026-11-17','2026-11-18'].map(k=>dayRecs[k].worn).concat(dayRecs['2026-11-12'].worn)});
    ok(gap2.slice(0,4).every(w=>w===false)&&gap2[4]!==false,'"I didn’t wear them" marks just those days not worn');

    // ---- seasons from the material and the holiday country
    const se=await p.evaluate(()=>{fresh();const s=x=>itemSeason(I('suit','brown',x));
      const r={flannel:s({material:'flannel'}),linen:s({material:'linen'}),wool:s({material:'wool'}),set:s({material:'flannel',season:'all'}),tie:itemSeason(I('socks','grey',{material:'cashmere blend'}))};
      r.temperate=dayClimate(new Date(2026,11,10)).season;settings.holidays={country:'KW',list:[]};const kw=dayClimate(new Date(2026,11,10));r.kw=kw.season+(kw.cold?':cold':'');r.kwJul=dayClimate(new Date(2027,6,10)).season;
      settings.holidays={country:'AU',list:[]};r.au=dayClimate(new Date(2027,0,15)).season;settings.location={lat:29.4,lon:48,name:'Kuwait City'};r.loc=dayClimate(new Date(2027,0,15)).season;
      settings.holidays=null;delete settings.location;
      const fl=I('suit','brown',{material:'flannel'});items=[fl,I('suit','navy'),I('shirt','white'),I('tie','burgundy'),I('shoes','brown',{leather:'calf'})];weather['2026-11-16']={tmax:29,tmin:16,pop:0,rain:0};cache={};
      const o=months(1).find(([k])=>k==='2026-11-16')[1];r.hot=o.top.id!==fl.id;weather={};return r});
    ok(se.flannel==='cold'&&se.linen==='warm'&&se.wool==='all'&&se.set==='all'&&se.tie==='all','a flannel suit is a cold-weather piece and a linen one a warm-weather one; a season set on the item wins');
    ok(se.hot,'a flannel suit is not planned on a 29°C day while another suit is there');
    ok(se.temperate==='cold'&&se.kw==='mild'&&se.kwJul==='warm',`with no location, a Kuwait phone's December is mild, not cold (${se.kw}; the calendar says ${se.temperate})`);
    ok(se.au==='warm'&&se.loc==='cold','with no location an Australian January is summer; a location still decides the hemisphere');

    // ---- the jacket worn the workday before; shirts in the wash; funeral ties
    const jk=await p.evaluate(()=>{fresh();const mg=I('suit','midgrey'),ch=I('suit','charcoal',{pattern:'pinstripe',secondaryColor:'white'}),br=I('suit','brown');
      items=[mg,ch,br,I('shirt','white'),I('tie','silver'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'})];const by=t=>items.filter(i=>i.type===t);
      const day={formal:false,occ:'wedding',clim:{season:'mild',rain:false,cold:false},hasLinks:false,prev:[{jid:mg.id,jg:jacketGroup(mg),jc:planCol(mg),sl:'white',tl:'grey',n:99}]};
      const o=outfit(true,100,by,{[mg.id]:99,[ch.id]:95,[br.id]:95},null,day);
      const r=rateOutfit({...o,top:mg,bot:mg,ctx:{prev:[{jid:mg.id,jg:'grey',sl:'x',tl:'y',n:99}],n:100}});
      return {top:o.top.id===mg.id?'same':'other',why:(r.checks.find(c=>c.label==='Variety')||{}).why||''}});
    ok(jk.top==='other','a wedding no longer takes the suit worn the workday before when another suit can go');
    ok(/the same suit as the workday before/.test(jk.why),`the score marks the same jacket two workdays running ("${jk.why}")`);
    const wash=await p.evaluate(()=>{fresh();settings.laundryDays=3;settings.blazerDays=[];items=[I('suit','navy'),I('suit','grey'),I('shirt','white'),I('shirt','pink'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('shoes','black',{leather:'calf'})];
      const pl=months(1);let again=0;for(let n=1;n<pl.length;n++)if(pl[n][1].shirt.id===pl[n-1][1].shirt.id)again++;return {again,n:pl.length}});
    ok(wash.again===0&&wash.n>10,`with every shirt in the wash the one washed longest ago is taken, never the same shirt two workdays running (${wash.again} of ${wash.n})`);
    const fu=await p.evaluate(()=>{fresh();const st=I('tie','navy',{pattern:'stripe',secondaryColor:'burgundy'}),dot=I('tie','navy',{pattern:'polka-dot',secondaryColor:'white'});
      items=[I('suit','charcoal'),I('shirt','white'),dot,st,I('tie','burgundy'),I('tie','green'),I('shoes','black',{leather:'calf'})];const by=t=>items.filter(i=>i.type===t);
      const o=outfit(true,100,by,{},null,{formal:false,occ:'funeral',clim:{season:'mild',rain:false,cold:false},hasLinks:false,prev:[]});return {tie:o.tie.id===st.id,note:o.notes.join(' ')}});
    ok(fu.tie&&/most sober one you have/.test(fu.note),`a funeral with no black tie takes the navy stripe over navy dots, and says a plain black tie is right ("${fu.note}")`);

    // ---- a tie swapped today releases the next days' locks holding it
    const sw=await p.evaluate(async()=>{fresh();items=[I('suit','navy'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','green'),I('tie','burgundy'),I('shoes','black',{leather:'calf'})];show('today');
      await recordRun;/* the past days the drawing records, saved in the background */await lockUpcoming();let was=week();const B=items.find(i=>i.type==='tie'&&i.id!==was[0].tie).id;
      for(const d of was.slice(1,3)){dayRecs[d.k].lock.tie=B}cache={};was=week();   // as in the audit: the next two days locked with the tie today is swapped to
      await swapSlot('tie');await recordRun;const now=week();return {was:was.map(d=>d.tie),now:now.map(d=>d.tie)}});
    ok(sw.now[0]!==sw.was[0]&&sw.now[1]!==sw.now[0],`after today's tie is swapped the next workday doesn't keep that tie (${sw.was.join(',')} -> ${sw.now.join(',')})`);

    // ---- waistcoats and the dress code
    const vs=await p.evaluate(()=>{fresh();settings.vestMode='always';const a=newSuitVest();settings.dress={jacket:true,tie:false};const b=newSuitVest();delete settings.dress;settings.vestMode='auto';const c=newSuitVest();settings.vestMode='always';
      queue.length=0;show('wardrobe');openAdd();addManual();const sel=[...document.querySelectorAll('#add select')].find(s=>[...s.options].some(o=>o.value==='yes'&&/vest/i.test(o.text)));return {a,b,c,card:sel&&sel.value}});
    ok(vs.a==='yes'&&vs.b==='no'&&vs.c==='no'&&vs.card==='yes',`"Every suit day" gives a new suit its vest on the Add card (${vs.card}); not with ties off or by default`);
    await p.evaluate(()=>{queue.length=0;settings.vestMode='never';show('today');openSettings('schedule')});
    const dc=await p.evaluate(async()=>{const real=window.clearLocks;window.clearLocks=()=>new Promise(()=>{});document.querySelector('#dress-tie').click();
      for(let i=0;i<40;i++){const s=await metaGet('settings');if(s&&s.dress&&s.dress.tie===false)break;await new Promise(r=>setTimeout(r,25))}
      const s=await metaGet('settings'),sw=document.querySelector('#dress-tie').getAttribute('aria-checked');window.clearLocks=real;return {stored:s&&s.dress&&s.dress.tie,sw}});
    ok(dc.stored===false&&dc.sw==='false','a dress-code switch is saved and shown at once, before the week\'s locks are released');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) it checks what the planner chooses, not the fixed test plan

/* ---- was tests/fix8r3.test.js ---- */
// Fix round 3 (2026-11-16, Fixer 8): planner choices and wording, Insights, What to buy.
// - shoes with a suit: formality wins over a matching strap and buckle (the owner's decision), and not yesterday's pair when another suits (W2-17-02)
// - the picker's labels follow the score each piece would give (W2-17-03), "Choose shoes" (W2-17-13), two alike pieces told apart (W2-15-09)
// - an own color is spoken by its own name (W2-17-04); the Metals reason names only what is worn (W2-17-10)
// - Suggest another doesn't bring a real mistake while a clean piece is left (W2-17-07)
// - "chosen for variety" not after the owner's own pick (W2-17-08); a belt that matches no shoes costs nothing (W2-14-08)
// - Insights keeps its reasons table and fills a fold without drawing the page again (W2-18-02); weeks named from the first day (W2-15-08)
// - What to buy: the funeral line, the metals point once, "Ready" only when the occasion's own check is full, a second pair's reason (W2-17-09)
const fix8r3=async({ok,chromium,url})=>{
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
    // (the days before today recorded as shown, as an app in use has them: unrecorded, they were planned again after the pick, which fixed
    // today's shirt and tie ahead of them (fixedAhead), and recorded only then, so the day's Variety could differ from the picker's peek,
    // which plans the day alone: with the look in the plan, PLAN_RULES 26, 95 shown and 93 after the pick)
    const pk=await p.evaluate(async()=>{fresh('2026-11-15T08:00:00');items=w17();{const P=planFor(),T=todayDate();for(const k of Object.keys(P))if(keyDate(k)<T&&P[k].shirt)dayRecs[k]={date:k,ids:idsOf(P[k]),suitDay:P[k].suitDay,vestOn:!!P[k].vest,auto:true};cache={}}show('today');const out=[];
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
    // ---- a belt picked from the picker on a day marked worn is recorded as worn (2026-11-18: outside "Correct what you wore" it did nothing)
    const wp=await p.evaluate(async()=>{fresh('2026-11-18T08:00:00');items=w17();const s=items,b2=I('belt','brown',{leather:'calf',metal:'silver'});items.push(b2);
      const belt=s.find(i=>i.type==='belt');dayRecs['2026-11-18']={date:'2026-11-18',ids:{top:s[0].id,bot:s[0].id,shirt:s[3].id,tie:s[7].id,shoes:s[12].id,belt:belt&&belt.id},suitDay:true,worn:true};cache={};
      sel=new Date(2026,10,18);view={y:2026,m:10};pastEdit=null;show('today');await pickItem('belt',b2.id);await new Promise(r=>setTimeout(r,200));
      return {belt:dayRecs['2026-11-18'].ids.belt===b2.id,worn:dayRecs['2026-11-18'].worn,msg:swapMsg}});
    ok(wp.belt&&wp.worn===true&&/Corrected/.test(wp.msg),`a belt picked on a worn day is recorded as what was worn (${JSON.stringify(wp)})`);

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

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['rules8',rules8],['enamelclip',enamelclip],['nu2plan',nu2plan],['newuserplan',newuserplan],['fix8r3',fix8r3]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.realPlanner=true;   // runs the real planner (every part checks the planner's choices); other tests get tests/fixedplan.js
