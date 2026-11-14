// The packing list (pack.js): a page of its own that turns the outfits planned for a trip's days into what to pack. Every distinct
// piece once with the days it is worn, a count line, one belt per shoe colour; ticks and travel wear are remembered per trip on the
// device; "Pack lighter" re-plans the trip's days under a limit of jackets and shoes; "Keep these outfits" locks the trip's days
// with the planner's lock; the list can be copied and shared. PACK_SHOTS=<folder> saves pictures of the page.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'en-US'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=()=>p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic.map(i=>({...i}));settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];settings.daysOff=[];delete settings.darkShirts;weather={};climate=null;TODAY_OVERRIDE='2026-11-11T12:00:00';
      localStorage.removeItem('pack_trip');localStorage.removeItem('pack_marks');packT=null;dayRecs={};cache={};sel=new Date(2026,10,11);view={y:2026,m:10};show('today');
      window.sigOf=o=>o?SLOTS.filter(s=>s!=='coat').map(s=>o[s]?o[s].id:'').join('|'):'';
      window.trip=(a,b)=>{const out={};for(let d=a;d<=b;d++){const k='2026-11-'+d,o=planMonth(2026,10)[k];if(o)out[k]=sigOf(o)}return out};
      window.lines=()=>[...document.querySelectorAll('#pk-list .pk-group:not(.pk-travel) .pk-line')].map(l=>l.querySelector('.pk-nm').textContent.trim());
      // what the plan says, worked out apart from pack.js: every piece of the days' outfits, belts aside
      window.expect=(a,b)=>{const n={},t={};for(let d=a;d<=b;d++){const o=planMonth(2026,10)['2026-11-'+d];if(!o||!isWorkday(new Date(2026,10,d)))continue;for(const i of new Set(SLOTS.filter(s=>s!=='belt'&&o[s]).map(s=>o[s]))){n[i.id]=(n[i.id]||0)+1;t[i.id]=i.type}}
        const c={};for(const id in t)c[t[id]]=(c[t[id]]||0)+1;return {n,c}}})()`);
    await setup();

    // ---- the two ways in, and the page
    await p.evaluate(()=>openSettings());await p.click('#pack-btn');await p.waitForFunction(()=>!document.querySelector('#pack').hidden&&!settingsOpen());
    const h=await p.evaluate(()=>({title:document.querySelector('#pack .phead h2').textContent,back:!!document.querySelector('#pack .phead .pback'),today:document.querySelector('#today').hidden,
      a:document.querySelector('#pk-a').value,b:document.querySelector('#pk-b').value,count:document.querySelector('#pack .pcount').textContent,prev:document.querySelector('#pack-btn').parentElement.firstElementChild.id}));
    ok(h.title==='Packing list'&&h.back&&h.today&&h.prev==='pack-btn',`Settings has a Packing list link, first under Your wardrobe; it opens a page of its own with a back button`);
    ok(h.a==='2026-11-16'&&h.b==='2026-11-20'&&h.count==='5 days',`the trip defaults to the next working week (${h.a} to ${h.b}, ${h.count})`);
    // (2026-11-14, the audit: it always started on a Monday) a Sunday-Thursday week starts on the next Sunday
    const st=await p.evaluate(()=>{const w=settings.workdays;settings.workdays=[0,1,2,3,4];const d=packDefault();settings.workdays=[6,0,1,2,3];const e=packDefault();settings.workdays=w;return {a:d.a,b:d.b,ea:e.a,eb:e.b}});
    ok(st.a==='2026-11-15'&&st.b==='2026-11-19'&&st.ea==='2026-11-14'&&st.eb==='2026-11-18',`the default trip follows the work week: Sunday-Thursday ${st.a} to ${st.b}, Saturday-Wednesday ${st.ea} to ${st.eb}`);
    await p.click('#pack .pback');
    ok(await p.evaluate(()=>document.querySelector('#pack').hidden&&!document.querySelector('#today').hidden&&settingsOpen()),'the back button returns to Settings, where it was opened, over Today');
    await p.evaluate(()=>closeSettings());
    await p.evaluate(()=>{if(!monthOpen)toggleMonth()});await p.waitForSelector('#mpanel-in .mhead');await settle(p,600);
    ok(await p.evaluate(()=>!document.querySelector('#mpanel-in .pack-open')&&!/Packing list/.test(document.querySelector('#mpanel-in').textContent)),'the open month on Today has no packing-list button (the owner took it out); the page is in Settings');
    await p.evaluate(()=>{monthOpen=false;openPack()});await p.waitForFunction(()=>!document.querySelector('#pack').hidden);

    // ---- the days and the list for a fixed wardrobe and range
    const d1=await p.evaluate(()=>({rows:[...document.querySelectorAll('#pk-days .pk-day')].map(r=>({t:r.querySelector('.pk-dn').textContent,stack:!!r.querySelector('svg.stack'),what:r.querySelector('.pk-what').textContent})),
      plan:[16,17,18,19,20].map(d=>shortTop(planMonth(2026,10)['2026-11-'+d]))}));
    ok(d1.rows.length===5&&d1.rows.every((r,i)=>r.stack&&r.what.includes(d1.plan[i]))&&/Mon/.test(d1.rows[0].t)&&/16/.test(d1.rows[0].t),`each day of the trip is listed with its outfit: the stack drawing and the piece names (${d1.rows[0].t}: ${d1.rows[0].what})`);
    const l1=await p.evaluate(()=>{const e=expect(16,20),L=packNow.list,all=L.groups.flatMap(g=>g.lines),P=planMonth(2026,10);
      const groups=new Set([16,17,18,19,20].map(d=>leatherGroup(planCol(P['2026-11-'+d].shoes))));
      return {ids:all.filter(l=>l.type!=='belt').map(l=>l.key).sort().join(),want:Object.keys(e.n).sort().join(),days:all.filter(l=>l.type!=='belt').every(l=>l.n===e.n[l.key]),
        belts:all.filter(l=>l.type==='belt').length,groups:groups.size,titles:L.groups.map(g=>g.title),count:document.querySelector('#pk-count').textContent,c:e.c,
        dom:lines().length,total:all.length,once:new Set(all.map(l=>l.key)).size===all.length,order:L.groups.map(g=>Object.keys(TYPES).indexOf(g.type))}});
    ok(l1.ids===l1.want&&l1.days&&l1.once,`To pack has every distinct piece of the five outfits once, with the days it is worn (${l1.total} lines)`);
    ok(l1.belts===l1.groups&&l1.belts>=1,`one belt per shoe colour worn (${l1.belts} for ${l1.groups} colour${l1.groups===1?'':'s'})`);
    ok(l1.order.every((v,i)=>!i||v>l1.order[i-1])&&l1.titles[0]==='Suits'&&l1.dom===l1.total,`grouped by type in the Wardrobe's order (${l1.titles.join(', ')})`);
    const want=[['suit','suit','suits'],['blazer','blazer','blazers'],['pants','pair of trousers','pairs of trousers'],['shirt','shirt','shirts'],['tie','tie','ties'],['shoes','pair of shoes','pairs of shoes'],['socks','pair of socks','pairs of socks']]
      .filter(([t])=>l1.c[t]).map(([t,one,many])=>`${l1.c[t]} ${l1.c[t]===1?one:many}`).join(' · ');
    ok(l1.count===want&&/suits? · /.test(want),`the count line at the top: ${l1.count}`);
    ok(await p.evaluate(()=>packNow.list.groups.some(g=>g.type==='watch')&&document.querySelectorAll('#pk-list .pk-line input[type=checkbox]').length===packNow.list.total),'the watch is on the list, and every line has a checkbox');

    // ---- a piece worn twice appears once, with "2 days"
    const tw=await p.evaluate(()=>{const s=items.find(i=>i.type==='suit'&&i.primaryColor==='navy'&&i.pattern==='solid');dayRecs['2026-11-16']={date:'2026-11-16',force:{top:s.id}};dayRecs['2026-11-18']={date:'2026-11-18',force:{top:s.id}};cache={};renderPack();
      const hit=lines().filter(t=>/^Navy suit/.test(t));return {hit,copy:packNow.text.split('\n').filter(t=>/^- Navy suit/.test(t))}});
    ok(tw.hit.length===1&&/^Navy suit( with its vest)? · 2 days$/.test(tw.hit[0]),`a suit worn on two days is one line: "${tw.hit[0]}"`);

    // ---- copy and share
    await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:t=>{window.copied=t;return Promise.resolve()}}});renderPack()});
    ok(await p.evaluate(()=>!document.querySelector('#pk-share')),'no Share button where the device cannot share');
    await p.click('#pk-copy');await p.waitForFunction(()=>window.copied);
    const cp=await p.evaluate(()=>({t:window.copied,toast:document.querySelector('#toast').textContent,count:document.querySelector('#pk-count').textContent}));
    const L=cp.t.split('\n');
    ok(/^Packing list · Mon, Nov 16 – Fri, Nov 20$/.test(L[0])&&L[1]===cp.count&&L.includes('Suits')&&tw.copy.length===1&&L.includes(tw.copy[0])&&/2 days$/.test(tw.copy[0])&&L.includes('Outfits')&&L.filter(x=>/^- (Mon|Tue|Wed|Thu|Fri), Nov \d+: /.test(x)).length===5&&!/<|&amp;/.test(cp.t)&&/copied/i.test(cp.toast),
      `Copy list puts a plain-text list on the clipboard (${L.length} lines, first "${L[0]}")`);
    await p.evaluate(()=>{navigator.share=d=>{window.shared=d;return Promise.resolve()};renderPack()});
    await p.click('#pk-share');await p.waitForFunction(()=>window.shared);
    ok(await p.evaluate(()=>window.shared.text===packNow.text),'where the device can share, Share hands over the same text');
    await p.evaluate(()=>{delete navigator.share;dayRecs={};cache={};renderPack()});

    // ---- ticks are remembered for the trip
    await p.click('#pk-list .pk-group .pk-line:nth-of-type(1) input');await p.click('#pk-list .pk-group:nth-of-type(3) .pk-line input');
    const t1=await p.evaluate(()=>({done:document.querySelector('#pk-done').textContent,n:document.querySelectorAll('#pk-list input:checked').length,keys:JSON.parse(localStorage.getItem('pack_marks'))['2026-11-16_2026-11-20'].t}));
    ok(t1.n===2&&t1.keys.length===2&&/^2 of \d+ packed$/.test(t1.done),`ticking a line counts it (${t1.done})`);
    await p.evaluate(()=>{show('today');packT=null;packNow=null;openPack()});
    const t2=await p.evaluate(()=>[...document.querySelectorAll('#pk-list input:checked')].length);
    await p.fill('#pk-b','2026-11-19');await p.dispatchEvent('#pk-b','change');
    const t3=await p.evaluate(()=>({n:document.querySelectorAll('#pk-list input:checked').length,days:document.querySelectorAll('#pk-days .pk-day').length}));
    await p.fill('#pk-b','2026-11-20');await p.dispatchEvent('#pk-b','change');
    const t4=await p.evaluate(()=>document.querySelectorAll('#pk-list input:checked').length);
    ok(t2===2&&t3.n===0&&t3.days===4&&t4===2,'the ticks are still there after leaving the page, belong to that trip only, and come back with its dates');

    // ---- travel wear
    const w0=await p.evaluate(()=>({total:packNow.list.total,shirts:packNow.list.counts.shirt,name:document.querySelector('#pk-list .pk-group:nth-of-type(3) .pk-nm').textContent.trim(),type:packNow.list.groups[0].type}));
    await p.click('#pk-list .pk-group:has(h4:text-is("Shirts")) .pk-line:nth-of-type(1) .pk-wear');
    const w1=await p.evaluate(()=>({total:packNow.list.total,shirts:packNow.list.counts.shirt,worn:[...document.querySelectorAll('.pk-travel .pk-line.worn .pk-nm')].map(x=>x.textContent.trim()),count:document.querySelector('#pk-count').textContent,copy:packNow.text}));
    ok(w1.total===w0.total-1&&w1.shirts===w0.shirts-1&&w1.worn.length===1&&new RegExp(`\\b${w1.shirts} shirts?\\b`).test(w1.count)&&/Wearing on the way \(not packed\)\n- /.test(w1.copy),`a piece marked Wear moves to "Wearing on the way" and is not counted (${w0.shirts} shirts → ${w1.shirts})`);
    await p.click('.pk-travel .pk-line.worn .pk-wear');
    ok(await p.evaluate(n=>packNow.list.total===n&&!document.querySelector('.pk-line.worn'),w0.total),'Pack puts it back on the list');
    await p.click('#pk-wearday');
    const w2=await p.evaluate(()=>{const o=planMonth(2026,10)['2026-11-16'],ids=[...new Set(SLOTS.filter(s=>s!=='belt'&&o[s]).map(s=>o[s].id))],W=new Set(packNow.list.worn.map(l=>l.key)),belt=packNow.list.worn.filter(l=>l.type==='belt');return {all:ids.every(i=>W.has(i))&&belt.length===1&&beltFit(o.shoes,belt[0].i)!==null,n:W.size,ids:ids.length+1,btn:document.querySelector('#pk-wearday').textContent,packed:packNow.list.groups.flatMap(g=>g.lines).some(l=>ids.includes(l.key))}});
    ok(w2.all&&w2.n===w2.ids&&!w2.packed&&/^Pack /.test(w2.btn),`"Travel in Monday's outfit" marks all ${w2.ids} of its pieces as worn on the way`);
    await p.click('#pk-wearday');
    ok(await p.evaluate(()=>packNow.list.worn.length===0),'and the same button packs them again');

    // ---- days off
    const off=await p.evaluate(()=>{settings.daysOff=[{d:'2026-11-17',n:'Founders day'}];cache={};packSetDate('a','2026-11-14');const rows=[...document.querySelectorAll('#pk-days .pk-day')].map(r=>r.textContent);
      const e=expect(14,20),all=packNow.list.groups.flatMap(g=>g.lines).filter(l=>l.type!=='belt');
      return {rows,n:rows.length,off:[...document.querySelectorAll('#pk-days .pk-day.off')].length,same:all.map(l=>l.key).sort().join()===Object.keys(e.n).sort().join(),text:packNow.text,count:document.querySelector('#pack .pcount').textContent}});
    ok(off.n===7&&off.off===3&&/Day off$/.test(off.rows[0])&&/Day off$/.test(off.rows[1])&&/Day off: Founders day/.test(off.rows[3])&&off.count==='7 days',`a weekend and a day off inside the trip are listed as days off (${off.rows[3]})`);
    ok(off.same&&/- Sat, Nov 14: day off\n/.test(off.text)&&/- Tue, Nov 17: day off \(Founders day\)/.test(off.text),'days off add nothing to the list, and the copied text names them');
    const none=await p.evaluate(()=>{packSetDate('a','2026-11-14');packSetDate('b','2026-11-15');return {none:!!document.querySelector('#pk-none'),list:!!document.querySelector('#pk-list'),lock:!!document.querySelector('#pk-lock')}});
    ok(none.none&&!none.list&&!none.lock,'a trip of days off only says no outfits are planned');
    const lim=await p.evaluate(()=>{packSetDate('b','2027-03-01');return {b:packT.b,n:document.querySelectorAll('#pk-days .pk-day').length}});
    ok(lim.b==='2026-12-14'&&lim.n===31,'a trip is at most 31 days');

    // ---- pack lighter
    await p.evaluate(()=>{settings.daysOff=[];cache={};packSetDate('a','2026-11-16');packSetDate('b','2026-11-20')});
    const g0=await p.evaluate(()=>({j:packUses(packNow.days,'top'),s:packUses(packNow.days,'shoes'),msg:document.querySelector('#pk-light').textContent,before:trip(16,20),keep:!!document.querySelector('#pk-keep')}));
    ok(g0.j>=4&&g0.s>=2&&!g0.keep&&g0.msg.includes(`${g0.j} jackets and ${g0.s} pairs of shoes`),`with no limit the page says what the trip uses (${g0.msg})`);
    const t0=Date.now();
    await p.selectOption('#pk-j','2');await p.selectOption('#pk-s','1');await p.waitForSelector('#pk-keep');
    const g1=await p.evaluate(()=>{const L=packNow.light,live=L.days.filter(x=>x.o);return {j:L.j,s:L.s,jackets:new Set(live.map(x=>x.o.top.id)).size,shoes:new Set(live.map(x=>x.o.shoes.id)).size,n:live.length,
      complete:live.every(x=>x.o.top&&x.o.shirt&&x.o.tie&&x.o.shoes&&x.o.socks&&(x.o.suitDay||x.o.bot)),hard:live.filter(x=>rateOutfit(x.o).hard.length).length,scores:live.map(x=>rateOutfit(x.o).score),
      msg:document.querySelector('#pk-light').textContent,tag:!!document.querySelector('#pk-days .pk-tag'),lockCard:!!document.querySelector('#pk-lock'),real:trip(16,20),recs:Object.keys(dayRecs).filter(k=>dayRecs[k].skip).length,
      rows:[...document.querySelectorAll('#pk-days .pk-what b')].map(b=>b.textContent),shown:L.days.map(x=>shortTop(x.o)),suits:packNow.list.counts.suit||0,blz:packNow.list.counts.blazer||0,sh:packNow.list.counts.shoes}});
    ok(g1.jackets<=2&&g1.shoes<=1&&g1.j===g1.jackets&&g1.s===g1.shoes,`a limit of 2 jackets and 1 pair of shoes: the lighter plan uses ${g1.jackets} and ${g1.shoes} (${Date.now()-t0} ms)`);
    ok(g1.n===5&&g1.complete,`and still gives every day a complete outfit (scores ${g1.scores.join(', ')}; ${g1.hard} with a real mistake)`);
    ok(g1.tag&&g1.rows.join()===g1.shown.join()&&g1.suits+g1.blz<=2&&g1.sh===1&&!g1.lockCard,'the page shows the lighter plan: its outfits and its list');
    ok(/A lighter plan: 2 jackets and 1 pair of shoes instead of/.test(g1.msg)&&/It saves [^.]*\b(suit|blazer)/.test(g1.msg)&&/pairs? of shoes/.test(g1.msg),`and says what it saves (${g1.msg.replace(/\s+/g,' ').slice(0,150)})`);
    ok(JSON.stringify(g1.real)===JSON.stringify(g0.before)&&g1.recs===0,'nothing is changed until it is kept');
    await p.click('#pk-keep');await p.waitForFunction(()=>!document.querySelector('#pk-keep')&&document.querySelector('#pk-lock'));
    const g2=await p.evaluate(()=>{const P=planMonth(2026,10),ks=[16,17,18,19,20].map(d=>'2026-11-'+d);return {j:new Set(ks.map(k=>P[k].top.id)).size,s:new Set(ks.map(k=>P[k].shoes.id)).size,locks:ks.every(k=>dayRecs[k]&&dayRecs[k].lock),
      skips:ks.some(k=>dayRecs[k].skip),msg:document.querySelector('#pk-light').textContent,lock:document.querySelector('#pk-lockmsg').textContent,real:trip(16,20)}});
    ok(g2.j<=2&&g2.s<=1&&g2.locks&&!g2.skips&&/Within your limit/.test(g2.msg)&&/^Locked\./.test(g2.lock),`Keep this plan makes it the plan for those days and locks them (${g2.msg})`);
    const g3=await p.evaluate(async()=>{show('today');await new Promise(r=>setTimeout(r,0));return JSON.stringify(trip(16,20))});
    await p.waitForFunction(()=>dayRecs['2026-11-11']&&dayRecs['2026-11-11'].lock);
    ok(g3===JSON.stringify(g2.real)&&await p.evaluate(s=>JSON.stringify(trip(16,20))===s,g3),'Today shows the same lighter outfits, and its own lock of the coming week leaves them');
    // a limit the wardrobe can't meet any better is said
    const g4=await p.evaluate(()=>{openPack();packSetCap('j',1);const L=packNow.light;return {light:!!L,msg:document.querySelector('#pk-light').textContent,j:L&&L.j,complete:L&&L.days.filter(x=>x.o).every(x=>x.o.top&&x.o.shirt&&x.o.shoes&&(x.o.suitDay||x.o.bot))}});
    ok(g4.light&&g4.j===1&&g4.complete&&/1 jacket and 1 pair of shoes/.test(g4.msg),`one jacket for the whole trip is planned too, the blazer day taking the suit (${g4.msg.replace(/\s+/g,' ').slice(0,90)})`);
    await p.click('#pk-nocap');
    ok(await p.evaluate(()=>packT.j===0&&packT.s===0&&!packNow.light&&JSON.parse(localStorage.getItem('pack_trip')).j===0),'"Don’t limit" takes the limits off');

    // ---- keep these outfits: the lock
    await setup();await p.evaluate(()=>{openPack();packSetDate('a','2026-11-23');packSetDate('b','2026-11-27')});
    const k0=await p.evaluate(()=>({msg:document.querySelector('#pk-lockmsg').textContent,btn:!!document.querySelector('#pk-lockbtn'),rel:!!document.querySelector('#pk-release'),before:trip(23,27)}));
    ok(/^Not locked\./.test(k0.msg)&&k0.btn&&!k0.rel,'a trip beyond the coming week says it is not locked');
    // the change on an earlier day: Friday the 20th takes the suit planned for the trip's Monday
    const change=()=>p.evaluate(()=>{const o=planMonth(2026,10)['2026-11-23'];dayRecs['2026-11-20']={date:'2026-11-20',force:{top:o.top.id}};cache={};return trip(23,27)});
    const undo=()=>p.evaluate(()=>{delete dayRecs['2026-11-20'];cache={};return trip(23,27)});
    const free=await change();await undo();
    const moved=(a,b)=>Object.keys(a).filter(k=>a[k]!==b[k]);
    ok(moved(k0.before,free).length>=1,`(unlocked, a change on the Friday before moves ${moved(k0.before,free).length} of the trip's outfits)`);
    await p.click('#pk-lockbtn');await p.waitForFunction(()=>/^Locked\./.test((document.querySelector('#pk-lockmsg')||{}).textContent||''));
    const k1=await p.evaluate(()=>({locks:[23,24,25,26,27].every(d=>{const r=dayRecs['2026-11-'+d],o=planMonth(2026,10)['2026-11-'+d];return r&&r.lock&&r.lock.top===o.top.id&&r.lock.tie===o.tie.id&&!('coat' in r.lock)}),
      btn:!!document.querySelector('#pk-lockbtn'),rel:!!document.querySelector('#pk-release'),same:trip(23,27),toast:document.querySelector('#toast').textContent}));
    ok(k1.locks&&!k1.btn&&k1.rel&&moved(k0.before,k1.same).length===0&&/stay as shown/.test(k1.toast),'Keep these outfits locks every day of the trip to what is shown, and the page says Locked');
    const held=await change();
    ok(moved(k0.before,held).length===0,'locked, the same change on the Friday before leaves all five outfits as they were');
    await p.evaluate(()=>renderPack());
    ok(/^Locked\./.test(await p.textContent('#pk-lockmsg')),'the page still says Locked');
    await p.click('#pk-release');await p.waitForFunction(()=>/^Not locked\./.test((document.querySelector('#pk-lockmsg')||{}).textContent||''));
    const k2=await p.evaluate(()=>({locks:[23,24,25,26,27].some(d=>dayRecs['2026-11-'+d]&&dayRecs['2026-11-'+d].lock),now:trip(23,27)}));
    ok(!k2.locks&&moved(k0.before,k2.now).length>=1,`released, the outfits move again (${moved(k0.before,k2.now).length} changed)`);
    const part=await p.evaluate(()=>{delete dayRecs['2026-11-20'];cache={};const o=planMonth(2026,10)['2026-11-24'];dayRecs['2026-11-24']={date:'2026-11-24',lock:lockIds(o)};cache={};renderPack();return document.querySelector('#pk-lockmsg').textContent});
    ok(/^1 of 5 days locked\./.test(part),`a trip locked in part says so (${part.slice(0,24)})`);

    // ---- an item out of rotation, an empty wardrobe
    const pz=await p.evaluate(()=>{const o=planMonth(2026,10)['2026-11-23'],id=o.shirt.id;items.find(i=>i.id===id).paused=true;cache={};renderPack();
      const r={gone:!packNow.list.groups.flatMap(g=>g.lines).some(l=>l.key===id),days:packNow.days.filter(x=>x.o&&x.o.shirt).length};items=[];cache={};renderPack();r.empty=document.querySelector('#pack .empty').textContent;return r});
    ok(pz.gone&&pz.days===5&&/empty/.test(pz.empty),'a piece taken out of rotation drops off the list and the days stay dressed; an empty wardrobe says so');

    // ---- sizes, both themes, no sideways scroll
    for(const [w,hh] of [[320,640],[390,844],[626,900]]){
      await p.setViewportSize({width:w,height:hh});await setup();
      await p.evaluate(()=>{navigator.share=()=>Promise.resolve();packT={a:'2026-11-14',b:'2026-11-20',j:2,s:1};openPack();packWear(0,true)});await p.waitForSelector('#pk-keep');
      for(const theme of ['light','dark']){
        await p.evaluate(t=>{document.documentElement.dataset.theme=t},theme);await settle(p,200);
        const m=await p.evaluate(()=>{const q=s=>[...document.querySelectorAll('#pack '+s)],hOf=e=>Math.round(e.getBoundingClientRect().height),cs=e=>getComputedStyle(e);
          const lum=c=>{const [r,g,b]=c.match(/\d+/g).map(Number);return .2126*r+.7152*g+.0722*b},card=q('.pk-card')[0];
          return {side:document.documentElement.scrollWidth-innerWidth,over:q('*').filter(e=>e.getBoundingClientRect().right>innerWidth+.5).length,
            btn:Math.min(...q('button').map(hOf)),inp:[...q('input[type=date]'),...q('select')].map(hOf),tick:Math.min(...q('.pk-tick').map(hOf)),
            title:cs(q('.phead h2')[0]).fontSize,rad:cs(card).borderTopLeftRadius,ctl:cs(q('#pk-copy')[0]).borderTopLeftRadius,border:cs(card).borderTopWidth,
            cardL:lum(cs(card).backgroundColor),inkL:lum(cs(q('.pk-nm')[0]).color),pri:lum(cs(q('#pk-copy')[0]).backgroundColor),priInk:lum(cs(q('#pk-copy')[0]).color),
            names:q('.pk-nm').every(e=>e.getBoundingClientRect().width>60),share:q('#pk-share').length}});
        ok(m.side<=0&&m.over===0,`${w}px ${theme}: nothing scrolls sideways or runs off the screen`);
        ok(m.btn>=44&&m.inp.every(x=>x===44)&&m.tick>=44&&m.title==='22px'&&m.rad==='14px'&&m.ctl==='12px'&&m.border==='1px'&&m.names&&m.share===1,`${w}px ${theme}: 22px title, 44px buttons, inputs and tick rows, 14px cards, 12px controls (${JSON.stringify({btn:m.btn,inp:m.inp[0],tick:m.tick})})`);
        ok(theme==='dark'?m.cardL<60&&m.inkL>170&&m.pri>170&&m.priInk<60:m.cardL>200&&m.inkL<60&&m.pri<60&&m.priInk>200,`${w}px ${theme}: the cards, text and filled button follow the theme`);
        if(process.env.PACK_SHOTS)await p.screenshot({path:`${process.env.PACK_SHOTS}/pack-${w}-${theme}.png`,fullPage:true});
      }
      await p.evaluate(()=>{delete document.documentElement.dataset.theme;delete navigator.share});
    }
    ok(errs.length===0,`no page errors (${errs.slice(0,2).join(' | ')})`);
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (a trip packs the planned outfits); other tests get tests/fixedplan.js
