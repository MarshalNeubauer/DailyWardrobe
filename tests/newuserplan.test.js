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
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844},locale:'en-US'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      window.fresh=(t='2026-11-15T12:00:00')=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='never';delete settings.darkShirts;delete settings.dress;delete settings.location;settings.holidays=null;settings.daysOff=[];settings.laundryDays=1;settings.learn=null;
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
    ok(h7.noJ===0&&h7.noJn>20,`without jackets, stone trousers are not worn with the only (black) shoes while charcoal ones are free (${h7.noJ} of ${h7.noJn} days with a hard Shoes check)`);
    ok(h7.blazer===0&&h7.blazerN>20,`blazer days: chinos that no shoes suit are left for the grey trousers (${h7.blazer} of ${h7.blazerN} days with a hard Shoes check)`);
    ok(h7.only&&/None of your shoes suit stone trousers/.test(h7.onlyNote),'with nothing else they are still planned, with the note');

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
      await recordDays(planMonth(2026,10));await new Promise(r=>setTimeout(r,700));return document.querySelector('#toast').textContent});
    ok(/4 past workdays you didn’t open the app \(Sun, Nov 15 – Wed, Nov 18\) were counted as worn/.test(gap),`back after days away, the app says the missed workdays were counted as worn ("${gap}")`);
    await p.click('#toast button');
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
      await lockUpcoming();let was=week();const B=items.find(i=>i.type==='tie'&&i.id!==was[0].tie).id;
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
module.exports.realPlanner=true;   // it checks what the planner chooses, not the fixed test plan
