// Laundry and dry cleaning (care.js): a piece sent away is out of rotation like one bought and on the way, and comes back the day
// after its date with `cleaned` set; wears since cleaning are counted from the days really worn; the Care page lists what is due,
// nearly due and away; a worn shirt is not planned again for settings.laundryDays days unless there is no other; Settings → Care
// changes the limits; two devices share `away` and `cleaned`; the pages keep their sizes at 320, 390 and 626px in both themes.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,WARDROBES,settle,ROOT})=>{
  const browser=await chromium.launch();
  // a small wardrobe with a worn history: navy 5 wears (due at 5), charcoal 4 (nearly due), grey 1 (and one day not worn),
  // the blazer and its trousers 3 each (trousers nearly due at 4), three shirts
  const SETUP=`(()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:+new Date(2026,9,22,12),...x});   // (days before the wardrobe existed are the planner's warm-up, never counted)
    items=[I('navy','suit','navy'),I('char','suit','charcoal'),I('grey','suit','grey'),I('bz','blazer','navy'),I('p1','pants','grey'),I('p2','pants','tan'),
      I('sh1','shirt','white'),I('sh2','shirt','lightblue'),I('sh3','shirt','pink'),I('t1','tie','burgundy'),I('t2','tie','navy'),I('t3','tie','green'),
      I('bs','shoes','black',{leather:'calf'}),I('bb','belt','black',{leather:'calf',metal:'silver'}),I('so','socks','charcoal')];
    settings.workdays=[1,2,3,4,5];settings.blazerDays=[5];delete settings.care;delete settings.laundryDays;TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};
    const W=(m,d,top,sh,x={})=>{const k=key(new Date(2026,m,d)),suit=top!=='bz';dayRecs[k]={date:k,ids:{top,bot:suit?null:'p1',shirt:sh,tie:'t1',shoes:'bs',belt:'bb',socks:'so'},suitDay:suit,worn:true,...x}};
    W(9,22,'grey','sh3',{worn:false});W(9,23,'bz','sh3');W(9,26,'navy','sh1');W(9,27,'char','sh2');W(9,28,'navy','sh1');W(9,29,'char','sh2');W(9,30,'bz','sh3');
    W(10,2,'char','sh2');W(10,3,'navy','sh1');W(10,4,'char','sh2');W(10,5,'navy','sh1');W(10,6,'bz','sh3');W(10,9,'navy','sh1');W(10,10,'grey','sh3');
    cache={};sel=new Date(2026,10,11);view={y:2026,m:10}})()`;
  const open=async(vp={width:390,height:844})=>{const p=await (await browser.newContext({viewport:vp})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(SETUP);return {p,errs}};
  try{
    const {p,errs}=await open();
    // ---- wears since cleaning, from the history
    const c=await p.evaluate(()=>{const w=careCounts();return {navy:w.navy,char:w.char,grey:w.grey,bz:w.bz,p1:w.p1,p2:w.p2||0,sh1:w.sh1,st:careState(items.find(i=>i.id==='navy')),nr:careState(items.find(i=>i.id==='char')),tie:careState(items.find(i=>i.id==='t1'))}});
    ok(c.navy===5&&c.char===4&&c.grey===1&&c.bz===3&&c.p1===3&&c.p2===0&&c.sh1===5,`wears are counted from the days really worn; a day marked not worn doesn't count (navy ${c.navy}, charcoal ${c.char}, grey ${c.grey}, blazer ${c.bz}, trousers ${c.p1})`);
    ok(c.st.limit===5&&c.st.due&&!c.st.near&&c.nr.near&&!c.nr.due&&c.tie.limit===0&&!c.tie.due,'defaults: a suit is due after 5 wears and nearly due at 4; a tie is never due');
    const cl=await p.evaluate(()=>{items.find(i=>i.id==='char').cleaned='2026-10-29';cache={};const a=careCounts().char;delete items.find(i=>i.id==='char').cleaned;cache={};return a});
    ok(cl===2,'only the wears after the day it was cleaned count ('+cl+')');
    // ---- Today: the cleaning frame and banner on the picture (careFrame, the owner's design 2026-11-14): yellow one wear short, red on
    // the last wear and past it; on today and coming days, the wears planned in between counted; suits and blazers only
    const band=async d=>p.evaluate(d=>{if(d)sel=new Date(...d);cache={};show('today');const f=document.querySelector('#mannequin-container'),b=f&&f.querySelector('#cband');
      return {cls:f?f.className:'',text:b?b.querySelector('.ctxt').textContent.replace(/\s+/g,' ').trim():'',dots:b?b.querySelectorAll('.cdots i').length:0,on:b?b.querySelectorAll('.cdots i.on').length:0,
        extra:b&&b.querySelector('.cdots em')?b.querySelector('.cdots em').textContent:'',note:(document.querySelector('#carenote')||{}).textContent||''}},d);
    await p.evaluate(()=>{dayRecs['2026-11-11']={date:'2026-11-11',force:{top:'grey'}}});
    {const b=await band();ok(!b.text&&!/\bcb\b/.test(b.cls)&&!b.note,'nothing about cleaning for a suit that is not near its limit')}
    await p.evaluate(()=>{dayRecs['2026-11-11']={date:'2026-11-11',force:{top:'char'}}});
    {const b=await band();ok(/care-last/.test(b.cls)&&b.text==='Last wear · Suit – to the cleaner today'&&b.dots===5&&b.on===5&&!b.note,`the suit's 5th wear today: a red frame, five dots, "${b.text}" (and no grey line any more)`)}
    await p.evaluate(()=>{dayRecs['2026-11-11']={date:'2026-11-11',force:{top:'navy'}}});
    {const b=await band();ok(/care-over/.test(b.cls)&&b.text==='Overdue · Suit – worn 6 of 5'&&b.on===5&&b.extra==='+1',`worn past its limit: red, "${b.text}", five dots and ${b.extra}`)}
    // coming days: the blazer (3 wears, due after 6) is planned every Friday
    await p.evaluate(()=>{delete dayRecs['2026-11-11']});
    {const f13=await band([2026,10,13]),f20=await band([2026,10,20]),f27=await band([2026,10,27]);
      ok(!f13.text&&/care-near/.test(f20.cls)&&f20.text==='1 wear left · Blazer – wear 5 of 6'&&f20.dots===6&&f20.on===5&&/care-last/.test(f27.cls)&&f27.text==='Last wear · Blazer – to the cleaner today',
        `coming days count the wears planned before them: Friday 13th nothing (4 of 6), the 20th yellow ("${f20.text}"), the 27th red ("${f27.text}")`)}
    // the banner's cut round the tie swatch: none on today (the ✕/✓ row and the swatches sit above the banner), one on a coming day, and
    // it follows the swatch when a tap shrinks the stack
    {const lay=async(d,tap)=>{await band(d);if(tap){await p.evaluate(s=>swTap(s),tap);await settle(p,900)}else await settle(p,300);
        return p.evaluate(()=>{const f=document.querySelector('#mannequin-container'),b=f.querySelector('#cband'),sw=[...f.querySelectorAll('.swstack .ovsw')].pop(),wb=f.querySelector('.wornbar'),fr=f.getBoundingClientRect();
          const path=b.querySelector('path').getAttribute('d'),m=/^M([\d.]+) 0/.exec(path),bt=b.getBoundingClientRect().top;
          return {photo:f.classList.contains('photo'),cut:m?+m[1]:null,sw:sw?sw.getBoundingClientRect().width:0,swRight:sw?sw.getBoundingClientRect().right-fr.left:0,swBottom:sw?sw.getBoundingClientRect().bottom:0,bandTop:bt,wbBottom:wb?wb.getBoundingClientRect().bottom:null}})};
      await p.evaluate(()=>{dayRecs['2026-11-11']={date:'2026-11-11',force:{top:'char'}}});   // (before the pictures: the outfit is their key)
      await p.evaluate(()=>{const ph='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="#556"/></svg>');
        for(const d of [new Date(2026,10,11),new Date(2026,10,20)]){sel=d;cache={};const o=planFor()[key(d)];renders[comboKey(o)]={img:ph,sig:comboSig(o)}}});   // a picture for both days
      const t0=await lay([2026,10,11]),t1=await lay([2026,10,11],'shirt');
      ok(t0.photo&&t0.cut===0&&t0.wbBottom<=t0.bandTop+1&&t0.swBottom<=t0.bandTop,`today: the banner runs the full width, the ✕/✓ row and the swatches above it (row ${Math.round(t0.wbBottom)} ≤ banner ${Math.round(t0.bandTop)})`);
      ok(t1.cut>0&&Math.abs(t1.cut-(t1.swRight+5+9))<1.5,`a swatch tapped on today: the stack comes down and the banner cuts round the tie swatch (cut at ${t1.cut}, swatch edge ${Math.round(t1.swRight)})`);
      await p.evaluate(()=>{delete dayRecs['2026-11-11'];swOpen=null});
      const f0=await lay([2026,10,20]),f1=await lay([2026,10,20],'top');
      ok(f0.cut>0&&Math.abs(f0.cut-(f0.swRight+5+9))<1.5&&f0.sw>60,`a coming day: the cut follows the ${Math.round(f0.sw)} px tie swatch (at ${f0.cut})`);
      ok(f1.cut>0&&f1.sw<f0.sw-4&&Math.abs(f1.cut-(f1.swRight+5+9))<1.5,`a swatch tapped: the swatches shrink to ${Math.round(f1.sw)} px and the cut moves with them (at ${f1.cut})`)}
    await p.evaluate(()=>{delete dayRecs['2026-11-11'];swOpen=null;renders={};sel=new Date(2026,10,11);cache={}});
    // ---- the Wardrobe grid: a quiet tag on due pieces only
    await p.evaluate(()=>{flt='all';editing=null;show('wardrobe')});
    const g=await p.evaluate(()=>({navy:(document.querySelector('#gi-navy .caretag')||{}).textContent||'',n:document.querySelectorAll('#wardrobe .caretag').length}));
    ok(g.navy==='Due for cleaning'&&g.n===1,'the grid marks the one due piece "Due for cleaning" (shirts, washed after every wear, are not marked)');
    // ---- the Care page: from Settings, lists and buttons
    await p.evaluate(()=>openSettings());await p.click('#care-btn');await p.waitForFunction(()=>!document.querySelector('#care').hidden&&document.querySelector('#care-due'));
    const pg=await p.evaluate(()=>({due:[...document.querySelectorAll('#care-due .care-row')].map(r=>r.id),near:[...document.querySelectorAll('#care-near .care-row')].map(r=>r.id),
      dueText:document.querySelector('#care-navy').textContent,each:(document.querySelector('#care-each-shirt')||{}).textContent||'',away:!!document.querySelector('#care-away'),
      hidden:['today','wardrobe','add','stats'].every(s=>document.querySelector('#'+s).hidden),settings:document.querySelector('#settings-modal').style.display}));
    ok(pg.hidden&&pg.settings==='none','Settings → Care opens the Care page');
    ok(pg.due.join()==='care-navy'&&/Worn 5 times · due after 5/.test(pg.dueText),'due: the navy suit, "Worn 5 times · due after 5"');
    ok(pg.near.join()==='care-char,care-p1','nearly due: the charcoal suit (4 of 5) and the trousers (3 of 4), most worn first');
    ok(/3 shirts worn since washing/.test(pg.each)&&!pg.away,'the shirts are one line, not one each; nothing is away yet');
    await p.evaluate(()=>{settings.care={blazer:2};cache={};renderCare()});
    ok((await p.evaluate(()=>[...document.querySelectorAll('#care-due .care-row')].map(r=>r.id).join()))==='care-bz,care-navy','the most overdue comes first (a blazer worn 3 times with a limit of 2, before the suit at its limit)');
    await p.evaluate(()=>{delete settings.care;cache={};renderCare()});
    await p.click('#care-navy .caredone');await p.waitForFunction(()=>!document.querySelector('#care-navy')&&/Undo/.test(document.querySelector('#toast').textContent));
    const cd=await p.evaluate(()=>({cleaned:items.find(i=>i.id==='navy').cleaned,w:careCounts().navy||0,toast:document.querySelector('#toast').textContent}));
    ok(cd.cleaned==='2026-11-11'&&cd.w===0&&/Cleaned today/.test(cd.toast)&&/Undo/.test(cd.toast),'"Cleaned today" sets the day and starts the count again, with Undo');
    await p.click('#care-char .caresend');await p.waitForFunction(()=>document.querySelector('#care-away #care-char'));
    const sent=await p.evaluate(()=>{const i=items.find(x=>x.id==='char');return {away:i.away,paused:i.paused,near:!!document.querySelector('#care-near #care-char'),row:document.querySelector('#care-away #care-char').textContent}});
    ok(sent.away&&sent.away.why==='cleaner'&&sent.away.since==='2026-11-11'&&sent.away.back===null&&sent.paused===true&&!sent.near&&/At the cleaner's/.test(sent.row),'"Send to the cleaner" stores item.away, takes it out of rotation and lists it under Away now');
    await p.click('#care-char .careitsback');await p.waitForFunction(()=>!items.find(i=>i.id==='char').away&&!document.querySelector('#care-away'));
    const bk=await p.evaluate(()=>{const i=items.find(x=>x.id==='char');return {cleaned:i.cleaned,paused:'paused' in i,arr:'arrives' in i,away:!!document.querySelector('#care-away')}});
    ok(bk.cleaned==='2026-11-11'&&!bk.paused&&!bk.arr&&!bk.away,'"It\'s back" puts it in rotation again, cleaned today');
    await p.click('#care-each-shirt .caredone');await p.waitForFunction(()=>!document.querySelector('#care-each-shirt'));
    ok(await p.evaluate(()=>['sh1','sh2','sh3'].every(id=>items.find(i=>i.id===id).cleaned==='2026-11-11')),'"All washed today" resets every worn shirt');
    await p.click('#care .pback');ok(await p.evaluate(()=>document.querySelector('#care').hidden&&settingsOpen()),'the back button leaves the Care page for Settings, where it was opened');
    await p.evaluate(()=>closeSettings());

    // ---- away from the item sheet: the plan, the locked week, the picker, the grid, the stats
    await p.evaluate(SETUP);await p.evaluate(()=>show('today'));
    await p.waitForFunction(()=>Object.values(dayRecs).some(r=>r.lock&&r.lock.top&&r.date!==key(todayDate())));
    const lk=await p.evaluate(()=>{const T=todayDate(),r=Object.values(dayRecs).filter(r=>r.lock&&r.lock.top&&keyDate(r.date)>T).sort((a,b)=>keyDate(a.date)-keyDate(b.date))[0];return {k:r.date,id:r.lock.top}});
    await p.evaluate(id=>{flt='all';show('wardrobe');openItem(id)},lk.id);await settle(p,500);
    const card=await p.evaluate(()=>{const secs=[...document.querySelectorAll('#item-view .ivsec')].map(s=>s.querySelector('h3').textContent);return {secs,btns:[...document.querySelectorAll('#ivcare button')].map(b=>b.textContent),count:document.querySelector('#ivcare .carecount').textContent}});
    ok(card.secs.indexOf('Care')===card.secs.indexOf('Rotation')+1&&card.btns[0]==='Send to the dry cleaner'&&card.btns[1]==='In the laundry','the item sheet has a Care card after Rotation: "Send to the dry cleaner" / "In the laundry"');
    ok(/^(Worn (once|twice|\d+ times)|Not worn yet)( · due after \d+)?/.test(card.count),'it says how often the piece was worn and when it is due ("'+card.count+'")');
    await p.click('#ivcare .caresend[data-why=cleaner]');await p.waitForFunction(id=>!!items.find(i=>i.id===id).away&&document.querySelector('#gi-'+id+' .pausetag')&&document.querySelector('#ivcare .careitsback'),lk.id);
    const aw=await p.evaluate(({k,id})=>{const used=[];for(const m of [10,11])for(const [d,o] of Object.entries(planMonth(2026,m)))if(keyDate(d)>=todayDate()&&o.top&&o.top.id===id)used.push(d);
      sel=keyDate(k);const o=planFor()[k];sel=new Date(2026,10,11);
      return {used,lockTop:planMonth(2026,10)[k].top.id,pool:slotPool('top',o).map(i=>i.id),tag:document.querySelector('#gi-'+id+' .pausetag').textContent,why:whyUnused(items.find(i=>i.id===id)),
        rot:!!document.querySelector('#item-view .ivrot .rotbtn'),where:document.querySelector('#ivcare .carewhere').textContent,back:!!document.querySelector('#ivcare .careitsback')}},lk);
    ok(aw.used.length===0&&aw.lockTop!==lk.id,'sent away, no coming day is planned with it, and the locked day that held it lets go');
    ok(!aw.pool.includes(lk.id),'the picker does not offer it');
    ok(aw.tag==="At the cleaner's"&&/It's at the cleaner's/.test(aw.why),'the grid says "At the cleaner\'s" and the stats give that as the reason it is not worn');
    ok(/At the cleaner's since Nov 11/.test(aw.where)&&aw.back&&!aw.rot,'the card says since when and offers "It\'s back"; the Rotation card has no button of its own meanwhile');
    await p.fill('#ivcare input[type=date]','2026-11-20');await p.dispatchEvent('#ivcare input[type=date]','change');await p.waitForFunction(id=>items.find(i=>i.id===id).arrives==='2026-11-20'&&/Nov 20/.test(document.querySelector('#gi-'+id+' .pausetag').textContent),lk.id);
    const dt=await p.evaluate(id=>{const i=items.find(x=>x.id===id),days=[];for(const m of [10,11])for(const [d,o] of Object.entries(planMonth(2026,m)))if(keyDate(d)>=todayDate()&&o.top&&o.top.id===id)days.push(+keyDate(d));
      return {back:i.away.back,first:days.length?isoKey(new Date(Math.min(...days))):null,tag:document.querySelector('#gi-'+id+' .pausetag').textContent,hint:document.querySelector('#ivcare .ordhint').textContent}},lk.id);
    ok(dt.back==='2026-11-20'&&dt.first&&dt.first>'2026-11-20','with a date it is planned again, but only from the day after ('+dt.first+')');
    ok(dt.tag==="At the cleaner's · back Nov 20"&&/from the day after Nov 20/.test(dt.hint),'the grid reads "At the cleaner\'s · back Nov 20"');
    const ret=await p.evaluate(async id=>{TODAY_OVERRIDE='2026-11-20T12:00:00';const a=await checkArrivals();TODAY_OVERRIDE='2026-11-21T09:00:00';const b=await checkArrivals();const i=items.find(x=>x.id===id);
      const r={a,b,away:'away' in i,paused:'paused' in i,arrives:'arrives' in i,cleaned:i.cleaned,toast:document.querySelector('#toast').textContent};TODAY_OVERRIDE='2026-11-11T12:00:00';cache={};return r},lk.id);
    ok(ret.a===0&&ret.b===1&&!ret.away&&!ret.paused&&!ret.arrives&&ret.cleaned==='2026-11-20'&&/is back: it's in rotation again/.test(ret.toast),'the day after its date it is back in rotation by itself, cleaned on that date, and the app says so');
    // in the laundry, and Undo
    await p.evaluate(()=>{closeItem();openItem('sh2')});await settle(p,500);
    ok((await p.evaluate(()=>document.querySelector('#ivcare .caresend').dataset.why))==='laundry','a shirt offers the laundry first');
    await p.click('#ivcare .caresend[data-why=laundry]');await p.waitForFunction(()=>!!items.find(i=>i.id==='sh2').away&&document.querySelector('#gi-sh2 .pausetag')&&/Undo/.test(document.querySelector('#toast').textContent));
    const la=await p.evaluate(()=>({tag:document.querySelector('#gi-sh2 .pausetag').textContent,why:items.find(i=>i.id==='sh2').away.why,used:Object.entries(planMonth(2026,10)).some(([d,o])=>keyDate(d)>=todayDate()&&o.shirt&&o.shirt.id==='sh2'),toast:document.querySelector('#toast').textContent}));
    ok(la.tag==='In the laundry'&&la.why==='laundry'&&!la.used&&/Undo/.test(la.toast),'"In the laundry": tagged so, out of the plan, with Undo');
    await p.click('#toast button');await p.waitForFunction(()=>!items.find(i=>i.id==='sh2').away);
    ok(await p.evaluate(()=>{const i=items.find(x=>x.id==='sh2');return !i.paused&&!i.cleaned}),'Undo puts it back as it was (not counted as cleaned)');
    // a pinned day lets go; a past outfit keeps the piece; what-to-buy still counts it as owned
    const pin=await p.evaluate(async()=>{dayRecs['2026-11-12']={date:'2026-11-12',force:{top:'grey'}};cache={};await careSend('grey','cleaner');
      const past=planMonth(2026,10)['2026-11-10'];return {force:!!(dayRecs['2026-11-12']||{}).force,top:planMonth(2026,10)['2026-11-12'].top.id,past:past.top&&past.top.id,shop:shopList(items).some(i=>i.id==='grey'&&!i.paused)}});
    ok(!pin.force&&pin.top!=='grey','an upcoming day pinned to the piece is planned again without it');
    ok(pin.past==='grey','an outfit already worn keeps showing it');
    ok(pin.shop,'what-to-buy counts a piece that is away as owned');
    await p.evaluate(()=>careBack('grey'));

    // ---- shirts and the washing cycle
    const sh=await p.evaluate(()=>{dayRecs={};const run=ld=>{if(ld==null)delete settings.laundryDays;else settings.laundryDays=ld;cache={};const out=[];
        for(const m of [10,11])for(const [d,o] of Object.entries(buildPlan(2026,m))){const x=keyDate(d);if(x.getMonth()!==m)continue;out.push([di(x),o.shirt?o.shirt.id:null])}return out.sort((a,b)=>a[0]-b[0])};
      const T=di(todayDate()),two=l=>l.filter(([n])=>n>=T&&n<T+14),clash=(l,ld)=>l.filter(([n,s],i)=>l.some(([m,t],j)=>j<i&&n-m<=ld&&s===t)).length;
      const d1=two(run(null)),d2=two(run(2)),d5=two(run(5));
      // a shirt picked by hand today that tomorrow's lock holds too: the lock lets go
      delete settings.laundryDays;const forced=id=>{dayRecs={'2026-11-11':{date:'2026-11-11',force:{shirt:id}},'2026-11-12':{date:'2026-11-12',lock:{shirt:id}}};cache={};const pl=buildPlan(2026,10);return [pl['2026-11-11'].shirt.id,pl['2026-11-12'].shirt.id]};
      const f1=forced('sh1');settings.laundryDays=0;const f0=forced('sh1');delete settings.laundryDays;
      const keep=items;items=items.filter(i=>i.type!=='shirt'||i.id==='sh1');dayRecs={};cache={};const one=two(Object.entries(buildPlan(2026,10)).map(([d,o])=>[di(keyDate(d)),o.shirt?o.shirt.id:null]));items=keep;dayRecs={};cache={};
      return {n:d1.length,c1:clash(d1,1),c2:clash(d2,2),none5:d5.filter(x=>!x[1]).length,f1,f0,one:one.length>5&&one.every(x=>x[1]==='sh1')}});
    ok(sh.n>=9&&sh.c1===0,`three shirts over two weeks (${sh.n} workdays): none is planned the day after it was worn`);
    ok(sh.c2===0,'with 2 days, none is planned within two days of being worn');
    ok(sh.none5===0,'with more days than the shirts can cover, every day still gets a shirt');
    ok(sh.f1[0]==='sh1'&&sh.f1[1]!=='sh1'&&sh.f0[1]==='sh1','a shirt worn today is not kept for tomorrow, even if tomorrow was already showing it; with the rule off it stays');
    ok(sh.one,'with one shirt it is planned every day (there is no other)');
    const big=await p.evaluate(`(()=>{const W=${WARDROBES};const keep=items;items=W.realistic.map(i=>({...i,added:1}));dayRecs={};
      const run=ld=>{if(ld==null)delete settings.laundryDays;else settings.laundryDays=ld;cache={};return JSON.stringify([[2026,10],[2026,11],[2027,0]].map(([y,m])=>Object.entries(buildPlan(y,m)).map(([d,o])=>[d,idsOf(o)])))};
      const a=run(0),b=run(null);items=keep;delete settings.laundryDays;cache={};return {same:a===b,len:a.length}})()`);
    ok(big.same&&big.len>5000,'a large wardrobe is planned exactly as with the rule off (three months, every piece of every day)');

    // ---- Settings → Care
    await p.evaluate(SETUP);await p.evaluate(()=>{show('today');openSettings('care')});await p.waitForFunction(()=>document.querySelector('#sc-care').classList.contains('open')&&document.querySelector('#care-lim-suit'));
    const s0=await p.evaluate(()=>({suit:document.querySelector('#care-lim-suit').value,blazer:document.querySelector('#care-lim-blazer').value,pants:document.querySelector('#care-lim-pants').value,shirt:document.querySelector('#care-lim-shirt').value,tie:document.querySelector('#care-lim-tie').value,ld:document.querySelector('#cfg-laundry').value,sum:document.querySelector('#sum-care').textContent}));
    ok(s0.suit==='5'&&s0.blazer==='6'&&s0.pants==='4'&&s0.shirt==='1'&&s0.tie==='0'&&s0.ld==='1','Settings → Care shows the defaults: suits 5, blazers 6, trousers 4, shirts every wear, ties never; a worn shirt waits 1 day');
    ok(/Suits after 5 wears/.test(s0.sum)&&/a worn shirt waits 1 day/.test(s0.sum),'its summary says so in words ("'+s0.sum+'")');
    await p.selectOption('#care-lim-suit','4');await p.waitForFunction(()=>settings.care&&settings.care.suit===4&&/after 4 wears/.test(document.querySelector('#sum-care').textContent));
    await p.selectOption('#cfg-laundry','3');await p.waitForFunction(()=>settings.laundryDays===3&&/waits 3 days/.test(document.querySelector('#sum-care').textContent));
    const s1=await p.evaluate(()=>{const L=careLists();return {due:L.due.map(x=>x.i.id).join(),near:L.near.map(x=>x.i.id).join(),sum:document.querySelector('#sum-care').textContent,open:document.querySelector('#settings-modal').style.display}});
    ok(s1.due==='navy,char'&&s1.near==='p1','a limit of 4 makes the charcoal suit due as well');
    ok(/after 4 wears/.test(s1.sum)&&/waits 3 days/.test(s1.sum)&&s1.open==='block','the summary follows, and Settings stays open');
    await p.selectOption('#care-lim-suit','0');await p.waitForFunction(()=>settings.care.suit===0);
    ok(await p.evaluate(()=>careLists().due.length===0&&careBadge(items.find(i=>i.id==='navy'))===''),'"Never" turns the limit off: nothing is due');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await p.context().close();

    // ---- sizes, no sideways scroll, both themes
    for(const w of [320,390,626])for(const th of ['light','dark']){
      const {p:q,errs:e2}=await open({width:w,height:800});
      await q.evaluate(async th=>{document.documentElement.dataset.theme=th;await careSend('char','cleaner','2026-11-20');openCare()},th);await q.waitForFunction(()=>document.querySelector('#care-away'));await settle(q,300);
      const m=await q.evaluate(()=>{const h=s=>[...document.querySelectorAll(s)].map(b=>Math.round(b.getBoundingClientRect().height)),cs=e=>getComputedStyle(e);
        const lum=c=>{const [r,g,b]=c.match(/[\d.]+/g).map(Number);return .2126*r+.7152*g+.0722*b};
        const card=document.querySelector('#care .care-card'),row=document.querySelector('#care .care-nm');
        return {btn:h('#care button:not(.linkbtn)'),side:document.documentElement.scrollWidth-innerWidth,title:cs(document.querySelector('#care .phead h2')).fontSize,radius:cs(card).borderRadius,
          over:[...document.querySelectorAll('#care *')].filter(x=>x.getBoundingClientRect().right>innerWidth+.5).length,contrast:Math.abs(lum(cs(row).color)-lum(cs(card).backgroundColor)),bg:lum(cs(document.body).backgroundColor)}});
      ok(m.btn.length>=4&&m.btn.every(x=>x>=44)&&m.title==='22px'&&m.radius==='14px',`Care page at ${w}px, ${th}: 44px buttons, a 22px title, 14px cards (${[...new Set(m.btn)].join('/')})`);
      ok(m.side<=0&&m.over===0,`Care page at ${w}px, ${th}: no sideways scroll, nothing past the edge`);
      ok(m.contrast>90&&(th==='dark'?m.bg<80:m.bg>170),`Care page at ${w}px, ${th}: text stands out from its card (${Math.round(m.contrast)})`);
      await q.evaluate(()=>{flt='all';show('wardrobe');openItem('char')});await q.waitForFunction(()=>document.querySelector('#ivcare'));await settle(q,500);
      const iv=await q.evaluate(()=>{const v=document.querySelector('#ivbody')||document.querySelector('#item-view'),c=document.querySelector('#ivcare'),r=c.getBoundingClientRect(),vr=document.querySelector('#item-view').getBoundingClientRect();
        const tag=document.querySelector('#gi-navy .caretag'),tg=tag?tag.getBoundingClientRect():null,gi=document.querySelector('#gi-navy').getBoundingClientRect();
        return {btn:[...c.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().height)),inp:Math.round(c.querySelector('input[type=date]').getBoundingClientRect().height),
          side:v.scrollWidth-v.clientWidth,inside:r.left>=vr.left-.5&&r.right<=vr.right+.5,tagIn:!!tg&&tg.right<=gi.right+.5,page:document.documentElement.scrollWidth-innerWidth}});
      ok(iv.btn.length&&iv.btn.every(x=>x>=44)&&iv.inp>=44,`item sheet Care card at ${w}px, ${th}: 44px button and date field`);
      ok(iv.side<=0&&iv.inside&&iv.tagIn&&iv.page<=0,`item sheet and grid at ${w}px, ${th}: the card and the "Due" tag stay inside, no sideways scroll`);
      await q.evaluate(()=>{closeItem();show('today');openSettings('care')});await q.waitForFunction(()=>document.querySelector('#sc-care').classList.contains('open')&&document.querySelector('#care-lim-suit'));await settle(q,300);
      const st=await q.evaluate(()=>{const m=document.querySelector('#settings-modal'),mr=m.getBoundingClientRect();return {sel:[...document.querySelectorAll('#sc-care select')].map(s=>Math.round(s.getBoundingClientRect().height)),side:m.scrollWidth-m.clientWidth,
        out:[...document.querySelectorAll('#sc-care *, #care-btn')].filter(x=>{const r=x.getBoundingClientRect();return r.width&&(r.right>mr.right+.5||r.left<mr.left-.5)}).length,link:Math.round(document.querySelector('#care-btn').getBoundingClientRect().height)}});
      ok(st.sel.length===8&&st.sel.every(x=>x===44)&&st.link>=44&&st.side<=0&&st.out===0,`Settings → Care at ${w}px, ${th}: 44px dropdowns, nothing past the edge`);
      ok(e2.length===0,`no page errors at ${w}px, ${th} (${e2.join('; ')})`);
      await q.context().close()}
  }finally{await browser.close()}

  // ---- two devices: away and cleaned travel with the item
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const store=new Map(),meta=new Map();
  const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
    list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
  const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://wardrobevision.test/';
  const b2=await chromium.launch();
  try{
    const device=async()=>{const ctx=await b2.newContext();
      await ctx.route(HOST+'**',async route=>{const r=route.request();
        const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
        await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
      const p=await ctx.newPage();await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
      await p.reload();await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-11T12:00:00'});return p};
    const sync=p=>p.evaluate(()=>syncNow()),get=p=>p.evaluate(()=>{const i=items.find(x=>x.id==='s1');return i?{away:i.away||null,paused:!!i.paused,arrives:i.arrives||null,cleaned:i.cleaned||null}:null});
    const A=await device(),B=await device();
    await A.evaluate(async()=>{for(const it of [{id:'s1',type:'suit',primaryColor:'navy',pattern:'solid',vest:'no',added:1},{id:'s2',type:'suit',primaryColor:'grey',pattern:'solid',vest:'no',added:1}]){await put(it);items.push(it)}});
    await sync(A);await sync(B);
    await A.evaluate(()=>careSend('s1','cleaner','2026-11-20'));await sync(A);await sync(B);
    const b1=await get(B);
    ok(b1&&b1.away&&b1.away.why==='cleaner'&&b1.away.since==='2026-11-11'&&b1.away.back==='2026-11-20'&&b1.paused&&b1.arrives==='2026-11-20','a piece sent away on one device is away on the other, with its date');
    await B.evaluate(()=>careBack('s1'));await sync(B);await sync(A);
    const a1=await get(A);
    ok(a1&&!a1.away&&!a1.paused&&a1.cleaned==='2026-11-11','marked back on the second device: back in rotation on the first, with the day it was cleaned');
    await A.evaluate(async()=>{settings.care={suit:3};settings.laundryDays=2;await saveUserSettings()});await sync(A);await sync(B);
    ok(await B.evaluate(()=>settings.care&&settings.care.suit===3&&settings.laundryDays===2),'the wear limits and the shirt setting are shared too');
  }finally{await b2.close()}
};
