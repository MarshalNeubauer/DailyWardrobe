// The controls of the Packing list (pack.js), Laundry and cleaning and the Care card (care.js), cost per wear (cost.js), the Wardrobe's
// search, sort and grid and the item sheet's Name, Brand, Notes and Material (wardrobe.js), What to buy (shop.js) and Insights (stats.js),
// by real taps, typing and picks, on Chromium and WebKit (Safari's engine) with touch (Round C, wave C2-8, 2026-11-22: their inline
// on…="…" handlers became data-act handlers, act.js). Every check is the effect a person sees or the app stores; none reads a handler's
// attribute (controls are found by id, class, label or place), so the file passes unchanged on the app from before the move: run there
// to prove "the same effect".
module.exports=async({ok,engines,url,settle})=>{
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{await run(eng,browser,{ok,url,settle})}finally{await browser.close()}}
};
module.exports.realPlanner=true;   // the Packing list and Insights show the planner's own outfits and scores
// a wardrobe with a worn history (Oct 22 to Nov 10): navy 5 wears (due at 5), charcoal 4 (nearly due), grey 1, the blazer 3 with its
// gray pants (nearly due at 4) and once with the tan ones; the shirts worn; the suits and the blazer priced
const SETUP=`(()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:+new Date(2026,9,20,12),...x});
  items=[I('navy','suit','navy',{price:600}),I('char','suit','charcoal'),I('grey','suit','grey',{price:450}),I('bz','blazer','navy',{price:300}),I('p1','pants','grey'),I('p2','pants','tan'),
    I('sh1','shirt','white'),I('sh2','shirt','lightblue'),I('sh3','shirt','pink'),I('sh4','shirt','white',{pattern:'stripe',secondaryColor:'blue'}),I('sh5','shirt','lightblue',{pattern:'check',secondaryColor:'white'}),
    I('t1','tie','burgundy'),I('t2','tie','navy'),I('t3','tie','green'),I('t4','tie','grey'),
    I('bs','shoes','black',{leather:'calf'}),I('br','shoes','brown',{leather:'calf'}),I('bb','belt','black',{leather:'calf',metal:'silver'}),I('bn','belt','brown',{leather:'calf',metal:'silver'}),I('so','socks','charcoal')];
  settings.workdays=[1,2,3,4,5];settings.blazerDays=[5];settings.daysOff=[];settings.setupDone=1;delete settings.care;delete settings.laundryDays;delete settings.cleanCost;delete settings.currency;delete settings.shopSkip;
  settings.holidays={country:'US',list:[],skip:[]};weather={};climate=null;TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};
  const W=(m,d,top,sh,bot)=>{const k=key(new Date(2026,m,d)),suit=top!=='bz';dayRecs[k]={date:k,ids:{top,bot:suit?null:bot||'p1',shirt:sh,tie:'t1',shoes:'bs',belt:'bb',socks:'so'},suitDay:suit,worn:true}};
  W(9,22,'bz','sh3','p2');W(9,23,'bz','sh3');W(9,26,'navy','sh1');W(9,27,'char','sh2');W(9,28,'navy','sh1');W(9,29,'char','sh2');W(9,30,'bz','sh3');
  W(10,2,'char','sh2');W(10,3,'navy','sh1');W(10,4,'char','sh2');W(10,5,'navy','sh1');W(10,6,'bz','sh3');W(10,9,'navy','sh1');W(10,10,'grey','sh3');
  for(const k of ['pack_trip','pack_marks','ward_sort','ward_pending','care_told'])localStorage.removeItem(k);packT=null;
  cache={};sel=new Date(2026,10,11);view={y:2026,m:10};CK_OPEN['*']=true})()`;
async function run(eng,browser,{ok,url,settle}){
  const T=eng+': ';
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:eng==='Chromium',locale:'en-US'});
  await ctx.route('https://w.test/**',route=>route.fulfill({status:503,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:'{"error":"server"}'}));
  await ctx.addInitScript(()=>{localStorage.setItem('tour_seen','1')});
  const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());p.setDefaultTimeout(8000);
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(SETUP);await p.evaluate(()=>show('wardrobe'));await settle(p,400);
  const ev=(f,a)=>p.evaluate(f,a);
  const tap=async(sel,ms)=>{const l=p.locator(sel).first();await l.scrollIntoViewIfNeeded();await l.tap();await settle(p,ms||300)};
  const has=sel=>p.locator(sel).count().then(n=>n>0);
  // (WebKit's Linux date field says `change` only when left)
  const date=async(sel,v)=>{const h=await p.locator(sel).first().elementHandle();await h.fill(v);if(await h.evaluate(e=>e.isConnected))await h.evaluate(e=>e.dispatchEvent(new Event('change',{bubbles:true})));await settle(p,400)};
  const fillTab=async(sel,v)=>{await p.locator(sel).first().scrollIntoViewIfNeeded();await p.locator(sel).first().fill(v);await p.keyboard.press('Tab');await settle(p,400)};
  const pick=async(sel,v)=>{await p.selectOption(sel,v);await settle(p,400)};
  const item=id=>ev(id=>{const i=items.find(x=>x.id===id);return i?JSON.parse(JSON.stringify(i)):null},id);
  const until=(f,a)=>p.waitForFunction(f,a,{timeout:4000}).then(()=>true,()=>false);
  const J=JSON.stringify,TODAY='2026-11-11';

  /* ---- the Wardrobe: search, ×, the buttons under "Nothing matches", sort, a box ---- */
  await ev(()=>{window.__esc=0;window.addEventListener('keydown',e=>{if(e.key==='Escape')window.__esc++})});
  await tap('#wsearch');await p.keyboard.type('navy');await settle(p,300);
  let w=await ev(()=>({q:wardQ,boxes:[...document.querySelectorAll('#wslide .gi')].map(e=>e.id.slice(3)).sort().join(),want:items.filter(i=>wardMatch(i,wardNorm('navy'))).map(i=>i.id).sort().join(),x:!document.querySelector('#wclear').hidden,focus:document.activeElement.id}));
  ok(w.q==='navy'&&w.boxes===w.want&&w.boxes.split(',').length===3&&w.x&&w.focus==='wsearch',T+'typing in the Wardrobe’s search field shows the matching pieces and the ×, and the field keeps the focus ('+J(w)+')');
  await p.keyboard.press('Escape');await settle(p,300);
  w=await ev(()=>({q:wardQ,v:document.querySelector('#wsearch').value,n:document.querySelectorAll('#wslide .gi').length,all:items.length,focus:document.activeElement.id,esc:window.__esc}));
  ok(w.q===''&&w.v===''&&w.n===w.all&&w.focus==='wsearch'&&w.esc===0,T+'Escape in a field that holds something empties it, and the key goes no further ('+J(w)+')');
  await p.keyboard.press('Escape');await settle(p,200);
  ok(await ev(()=>window.__esc===1),T+'Escape in the empty field goes on to the page');
  await p.keyboard.type('tie');await settle(p,300);await tap('#wclear');
  w=await ev(()=>({q:wardQ,v:document.querySelector('#wsearch').value,x:document.querySelector('#wclear').hidden,focus:document.activeElement.id}));
  ok(w.q===''&&w.v===''&&w.x&&w.focus==='wsearch',T+'the × empties the search and puts the focus back in the field ('+J(w)+')');
  await tap('#wardrobe .chips .chip:has-text("Shoes")');await tap('#wsearch');await p.keyboard.type('navy');await settle(p,300);
  w=await ev(()=>({none:!!document.querySelector('#wnone'),all:!!document.querySelector('#wnone .btns .pri'),flt}));
  ok(w.none&&w.all&&w.flt==='shoes',T+'a search with nothing in the chosen type says so and offers "Search all types" ('+J(w)+')');
  await tap('#wnone .btns .pri');
  w=await ev(()=>({flt,q:wardQ,n:document.querySelectorAll('#wslide .gi').length}));
  ok(w.flt==='all'&&w.q==='navy'&&w.n===3,T+'"Search all types" shows the matches in the whole wardrobe ('+J(w)+')');
  await tap('#wsearch');await p.keyboard.type('zzz');await settle(p,300);
  ok(await ev(()=>!!document.querySelector('#wnone')&&!document.querySelector('#wnone .btns .pri')),T+'a search that matches nothing offers only "Clear search"');
  await tap('#wnone .btns button');
  w=await ev(()=>({q:wardQ,n:document.querySelectorAll('#wslide .gi').length,all:items.length}));
  ok(w.q===''&&w.n===w.all,T+'"Clear search" shows everything again ('+J(w)+')');
  await pick('#wsort','az');
  w=await ev(()=>({s:localStorage.getItem('ward_sort'),got:[...document.querySelectorAll('#wslide .gi')].map(e=>e.id.slice(3)).join(),want:wardOrder(items,'az').map(i=>i.id).join(),type:wardOrder(items,'type').map(i=>i.id).join()}));
  ok(w.s==='az'&&w.got===w.want&&w.got!==w.type,T+'a choice in the sort dropdown is kept and puts the boxes in that order');
  await pick('#wsort','type');
  await tap('#gi-navy .giopen',600);
  ok(await ev(()=>editing==='navy'&&document.body.classList.contains('iv-on')),T+'a tap on a piece’s box opens its sheet');
  await ev(()=>closeItem());await settle(p,500);
  await p.locator('#gi-char .giopen').focus();await p.keyboard.press('Enter');await settle(p,600);
  ok(await ev(()=>editing==='char'&&document.body.classList.contains('iv-on')),T+'Enter on a box opens it too');

  /* ---- the item sheet: Name, Notes, Material; the Care card; Price and Bought ---- */
  await p.locator('#ivbody input.wf-name').first().scrollIntoViewIfNeeded();await p.locator('#ivbody input.wf-name').first().click();await p.keyboard.type('Charcoal two');
  const pend=await ev(()=>{try{return JSON.parse(localStorage.getItem('ward_pending'))}catch{return null}});
  await p.keyboard.press('Tab');const named=await until(()=>(items.find(i=>i.id==='char')||{}).name==='Charcoal two');
  const titled=await until(()=>document.querySelector('#iv-title').textContent==='Charcoal two');
  ok(pend&&pend.id==='char'&&pend.k==='name'&&pend.v==='Charcoal two'&&named&&titled,T+'the item sheet’s Name is kept as it is typed, saved when the field is left, and the title follows ('+J(pend)+')');
  await p.locator('#ivbody textarea.wf-notes').first().click();await p.keyboard.type('Fits well');
  ok(await until(()=>(items.find(i=>i.id==='char')||{}).notes==='Fits well'),T+'Notes are saved a moment after the last keystroke, without leaving the field');
  await pick('#ivbody select.wmat','other');
  let it=await item('char');
  ok(it.material==='other'&&await has('#ivbody input.wmat-t'),T+'Material → Other is saved and asks which material');
  await fillTab('#ivbody input.wmat-t','  alpaca ');it=await item('char');const m1=it.material;
  await fillTab('#ivbody input.wmat-t','');it=await item('char');
  ok(m1==='alpaca'&&it.material==='other',T+'the material typed is saved trimmed, and emptying the field leaves Other ('+m1+', '+it.material+')');
  await tap('#ivcare .caredone',500);it=await item('char');
  ok(it.cleaned===TODAY&&!it.away&&await ev(()=>!careCounts().char),T+'the Care card’s "Cleaned today" starts the piece’s count again');
  await tap('#ivcare .caresend:has-text("laundry")',600);it=await item('char');
  ok(it.away&&it.away.why==='laundry'&&it.paused===true&&await has('#ivcare .careitsback'),T+'"In the laundry" sends it away: out of rotation, with "It’s back" on the card ('+J(it.away)+')');
  await date('#ivcare .careback input[type="date"]','2099-01-05');it=await item('char');
  ok(it.away&&it.away.back==='2099-01-05'&&it.arrives==='2099-01-05',T+'the "Back on" date is taken');
  await tap('#ivcare .careitsback',600);it=await item('char');
  ok(!it.away&&!it.paused&&!it.arrives&&it.cleaned===TODAY,T+'"It’s back" puts it in rotation again');
  await p.locator('#iv-price').scrollIntoViewIfNeeded();await p.locator('#iv-price').click();await p.keyboard.type('450');
  const typed=await until(()=>(items.find(i=>i.id==='char')||{}).price===450);
  ok(typed&&await ev(()=>document.activeElement.id==='iv-price'),T+'a price typed is saved a moment later, the field still in use');
  await fillTab('#iv-price','500');it=await item('char');
  ok(it.price===500&&await ev(()=>/Not worn yet|a wear/.test((document.querySelector('#cpw-line')||{}).textContent||'')),T+'the price is saved when the field is left and the cost per wear shows ('+it.price+')');
  await date('#iv-bought','2026-10-01');it=await item('char');
  ok(it.bought==='2026-10-01',T+'the day it was bought is saved');
  const link=await has('#ivcpw .cpwhow .linkbtn');
  if(link){await tap('#ivcpw .cpwhow summary');await tap('#ivcpw .cpwhow .linkbtn',700)}
  ok(link&&await ev(()=>settingsOpen()&&document.querySelector('#sc-care').classList.contains('open')),T+'"Set it in Settings → Care" opens Settings on Care');

  /* ---- Settings → Care: a wear limit, the currency and what a cleaning costs ---- */
  await pick('#care-lim-suit','3');const lim3=await ev(()=>settings.care&&settings.care.suit);await pick('#care-lim-suit','5');
  ok(lim3===3&&await ev(()=>settings.care.suit===5&&document.querySelector('#care-lim-suit').value==='5'),T+'a wear limit picked in Settings → Care is saved');
  await pick('#cpw-cur','EUR');
  ok(await ev(()=>settings.currency==='EUR'&&document.querySelector('#cpw-cur').value==='EUR'),T+'the currency picked is saved');
  await fillTab('#cpw-suit','12.5');await fillTab('#cpw-load','6');await fillTab('#cpw-perLoad','10');
  const cc=await ev(()=>({c:settings.cleanCost,wash:document.querySelector('#cpw-wash').textContent}));
  ok(cc.c&&cc.c.suit===12.5&&cc.c.load===6&&cc.c.perLoad===10&&/a piece/.test(cc.wash),T+'what a dry cleaning and a laundry load cost, and the pieces in a load, are saved ('+J(cc.c)+')');

  /* ---- Laundry & cleaning ---- */
  await ev(()=>openSettings('laundry'));await settle(p,700);
  let c=await ev(()=>({due:[...document.querySelectorAll('#care-due .care-row')].map(e=>e.id),near:[...document.querySelectorAll('#care-near .care-row')].map(e=>e.id),each:!!document.querySelector('#care-each-shirt')}));
  ok(c.due.join()==='care-navy'&&c.near.includes('care-p1')&&c.each,T+'Laundry & cleaning lists what is due, nearly due and washed after every wear ('+J(c)+')');
  await tap('#care-navy .caresend',600);it=await item('navy');
  ok(it.away&&it.away.why==='cleaner'&&it.paused&&await has('#care-away #care-navy .careitsback'),T+'"Send to the cleaner" on a due piece moves it to Away now');
  await tap('#care-away #care-navy .careitsback',600);it=await item('navy');
  ok(!it.away&&!it.paused&&it.cleaned===TODAY,T+'"It’s back" there brings it back, cleaned');
  await tap('#care-p1 .caredone',600);it=await item('p1');
  ok(it.cleaned===TODAY&&!await has('#care-p1'),T+'"Cleaned today" on a nearly due piece takes it off the list');
  const worn=await ev(()=>{const n=careCounts();return items.filter(i=>i.type==='shirt'&&n[i.id]).map(i=>i.id)});
  await tap('#care-each-shirt .caredone',700);await until(()=>!document.querySelector('#care-each-shirt'));
  ok(worn.length>=3&&await ev(([l,d])=>l.every(id=>items.find(i=>i.id===id).cleaned===d)&&!document.querySelector('#care-each-shirt'),[worn,TODAY]),T+'"All washed today" marks every worn shirt washed ('+worn.join(', ')+')');
  await tap('#care-in .care-foot .linkbtn',700);
  ok(await ev(()=>settingsOpen()&&document.querySelector('#sc-care').classList.contains('open')&&!document.querySelector('#sc-laundry').classList.contains('open')),T+'"Change how many wears each piece takes" opens Care');
  await ev(()=>closeSettings());await settle(p,500);if(await ev(()=>!!editing)){await ev(()=>closeItem());await settle(p,500)}

  /* ---- Today: the cleaning banner (a tap, Enter, Space) and "See what is due" ---- */
  await ev(()=>{settings.care={...settings.care,suit:2};dayRecs['2026-11-11']={date:'2026-11-11',force:{top:'grey'}};cache={};sel=new Date(2026,10,11);show('today');renderToday()});await settle(p,700);
  const asked=()=>ev(()=>!!(typeof asking!=='undefined'&&asking));
  const bnd=await ev(()=>({txt:(document.querySelector('#cband')||{}).textContent||'',top:(o=>o&&o.top&&o.top.id)(planFor()[key(sel)]),n:careCounts().grey,sel:key(sel),today:!document.querySelector('#today').hidden}));
  ok(/Last wear|Overdue/.test(bnd.txt),T+'Today’s picture has the cleaning banner on a suit at its limit ('+J(bnd)+')');
  await tap('#cband',600);const a1=await asked();
  await ev(()=>askAnswer(true));await until(d=>(items.find(i=>i.id==='grey')||{}).cleaned===d,TODAY);it=await item('grey');
  ok(a1&&it.cleaned===TODAY,T+'a tap on the banner asks whether it was cleaned, and "Cleaned today" starts its count again');
  await settle(p,500);await ev(()=>{const g=items.find(i=>i.id==='grey');delete g.cleaned;delete g.cleans;cache={};renderToday()});await settle(p,600);   // (due again, for the keys)
  const still=await has('#cband');
  if(still){await p.locator('#cband').focus();await p.keyboard.press('Enter');await settle(p,500)}const a2=await asked();if(a2){await ev(()=>askAnswer(false));await settle(p,400)}
  if(still){await p.locator('#cband').focus();await p.keyboard.press(' ');await settle(p,500)}const a3=await asked();if(a3){await ev(()=>askAnswer(false));await settle(p,400)}
  ok(still&&a2&&a3,T+'Enter and Space on the banner ask too ('+J([still,a2,a3])+')');
  await ev(()=>{settings.care={...settings.care,pants:2};settings.blazerDays=[3,5];dayRecs['2026-11-11']={date:'2026-11-11',force:{top:'bz',bot:'p2'}};cache={};show('today');renderToday()});await settle(p,700);
  const note=await has('#carenote a');
  if(note)await tap('#carenote a',700);
  w=await ev(()=>({open:settingsOpen(),cat:document.querySelector('#sc-laundry').classList.contains('open'),href:location.href}));
  ok(note&&w.open&&w.cat&&!/#$/.test(w.href),T+'"See what is due" under Today’s outfit opens Laundry & cleaning, and the link goes nowhere else ('+J(w)+')');
  await ev(()=>{closeSettings();delete dayRecs['2026-11-11'];settings.blazerDays=[5];delete settings.care;cache={}});await settle(p,500);

  /* ---- the Packing list ---- */
  await ev(()=>{show('today');openPack()});await settle(p,700);
  ok(await ev(()=>!document.querySelector('#pack').hidden&&document.querySelector('#pk-a').value==='2026-11-16'&&document.querySelector('#pk-b').value==='2026-11-20'),T+'the Packing list opens on next week');
  await tap('#pack .phead .pback',600);
  ok(await ev(()=>document.querySelector('#pack').hidden&&!document.querySelector('#today').hidden),T+'its ‹ goes back to where it was opened');
  await ev(()=>openPack());await settle(p,700);
  await date('#pk-b','2026-11-19');const d1=await ev(()=>({b:packTrip().b,days:document.querySelectorAll('#pk-days .pk-day').length}));
  await date('#pk-a','2026-11-17');const d2=await ev(()=>({a:packTrip().a,days:document.querySelectorAll('#pk-days .pk-day').length}));
  ok(d1.b==='2026-11-19'&&d1.days===4&&d2.a==='2026-11-17'&&d2.days===3,T+'the first and last day picked set the trip ('+J([d1,d2])+')');
  await date('#pk-a','2026-11-16');await date('#pk-b','2026-11-20');
  await tap('#pk-list .pk-group .pk-line input',400);
  const t1=await ev(()=>({t:packMark().t.length,done:document.querySelector('#pk-done').textContent,n:document.querySelectorAll('#pk-list input:checked').length}));
  await tap('#pk-list .pk-group .pk-line input',400);
  const t2=await ev(()=>({t:packMark().t.length,done:document.querySelector('#pk-done').textContent}));
  ok(t1.t===1&&t1.n===1&&/^1 of \d+ packed$/.test(t1.done)&&t2.t===0&&/^0 of/.test(t2.done),T+'a line’s checkbox checks it off and the count follows; again takes it off ('+J([t1,t2])+')');
  const n0=await ev(()=>packNow.list.total);
  await tap('#pk-list .pk-group .pk-line .pk-wear',500);
  const w1=await ev(()=>({w:packMark().w.length,total:packNow.list.total,worn:document.querySelectorAll('.pk-travel .pk-line.worn').length}));
  await tap('.pk-travel .pk-line.worn .pk-wear',500);
  const w2=await ev(()=>({w:packMark().w.length,total:packNow.list.total,worn:document.querySelectorAll('.pk-line.worn').length}));
  ok(w1.w===1&&w1.total===n0-1&&w1.worn===1&&w2.w===0&&w2.total===n0&&w2.worn===0,T+'Wear moves a piece to "Wearing on the way", Pack puts it back ('+J([n0,w1,w2])+')');
  await tap('#pk-wearday',500);const wd1=await ev(()=>({n:packNow.list.worn.length,btn:document.querySelector('#pk-wearday').textContent}));
  await tap('#pk-wearday',500);const wd2=await ev(()=>({n:packNow.list.worn.length,btn:document.querySelector('#pk-wearday').textContent}));
  ok(wd1.n>3&&/^Pack /.test(wd1.btn)&&wd2.n===0&&/^Travel in /.test(wd2.btn),T+'"Travel in Monday’s outfit" wears the whole outfit on the way, and the same button packs it again ('+J([wd1,wd2])+')');
  await ev(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:t=>{window.copied=t;return Promise.resolve()}}});navigator.share=d=>{window.shared=d;return Promise.resolve()};renderPack()});
  await tap('#pk-copy',400);await tap('#pk-share',400);
  ok(await ev(()=>window.copied===packNow.text&&!!window.shared&&window.shared.text===packNow.text&&/copied/i.test(document.querySelector('#toast').textContent)),T+'Copy list and Share hand over the list as text');
  await tap('#pk-lockbtn',900);await until(()=>!document.querySelector('#pk-lockbtn')&&!!document.querySelector('#pk-release'));
  const l1=await ev(()=>packLockState(packNow.days));
  await tap('#pk-release',900);await until(()=>!!document.querySelector('#pk-lockbtn'));
  const l2=await ev(()=>packLockState(packNow.days));
  ok(l1.of>0&&l1.n===l1.of&&l2.n===0,T+'"Keep these outfits" locks the trip’s days and "Let the plan change again" lets them go ('+J([l1,l2])+')');
  await pick('#pk-j','1');const cap1=await ev(()=>({j:packTrip().j,keep:!!document.querySelector('#pk-keep'),no:!!document.querySelector('#pk-nocap')}));
  if(cap1.no)await tap('#pk-nocap',600);const cap2=await ev(()=>({j:packTrip().j,s:packTrip().s,keep:!!document.querySelector('#pk-keep'),sel:document.querySelector('#pk-j').value}));
  ok(cap1.j===1&&cap1.keep&&cap1.no&&cap2.j===0&&cap2.s===0&&!cap2.keep&&cap2.sel==='0',T+'a limit on jackets offers a lighter plan, and "Don’t limit" takes the limit off ('+J([cap1,cap2])+')');
  await pick('#pk-s','1');const cap3=await ev(()=>({s:packTrip().s,keep:!!document.querySelector('#pk-keep')}));
  if(cap3.keep){await tap('#pk-keep',900);await until(()=>!document.querySelector('#pk-keep'))}
  const l3=await ev(()=>({l:packLockState(packNow.days),shoes:packUses(packNow.days,'shoes')}));
  ok(cap3.s===1&&cap3.keep&&l3.l.of>0&&l3.l.n===l3.l.of&&l3.shoes===1,T+'a limit on shoes offers a lighter plan and "Keep this plan" locks it in ('+J([cap3,l3])+')');
  await ev(()=>{for(const k of Object.keys(dayRecs))if(k>'2026-11-11')delete dayRecs[k];localStorage.removeItem('pack_trip');packT=null;cache={};show('today')});await settle(p,500);

  /* ---- What to buy ---- */
  await ev(()=>{window.__an=0;const W=window.Worker;window.Worker=function(u,o){if(!/analysis-worker/.test(u))return new W(u,o);window.__an++;   // (the real analyzeWardrobe runs; its worker is counted and hands back the result it has)
      const w={terminate(){},postMessage(){setTimeout(()=>{if(w.onmessage)w.onmessage({data:{done:shop.res}})},0)}};return w};
    const rec={key:'tie|purple|plain',type:'tie',name:'purple tie',tier:'variety',why:['A color your ties lack.','It goes with four of your suits.'],detail:'',items:[{type:'tie',primaryColor:'purple',pattern:'solid'}],samples:[]};
    shopShown={};shop={sig:shopSig(),at:Date.now(),res:{v:2,base:null,cats:[{key:'tie',title:'Ties',verdict:'worth',own:null,notes:[],recs:[rec]}],top:[{key:rec.key}],occasions:[],checked:1,sims:2,months:6}};
    show('stats');renderStats()});await settle(p,600);
  const K='tie|purple|plain';
  await tap('#shop-btn',700);
  ok(await ev(()=>shopOpen&&document.querySelector('#shop-sheet').classList.contains('on')&&window.__an===0),T+'Insights’ "What to buy" card opens the sheet on the kept result');
  await tap('#shop-c-top .shop-toprow',600);
  ok(await ev(k=>shopShown[k]===true&&!!document.querySelector('#shop-c-tie .shop-rec.open'),K),T+'a top pick opens the idea in its section');
  await tap('#shop-c-tie .shop-rechead',400);const f1=await ev(k=>({s:!!shopShown[k],open:!!document.querySelector('#shop-c-tie .shop-rec.open')}),K);
  await tap('#shop-c-tie .shop-rechead',400);const f2=await ev(k=>({s:!!shopShown[k],open:!!document.querySelector('#shop-c-tie .shop-rec.open')}),K);
  ok(!f1.s&&!f1.open&&f2.s&&f2.open,T+'an idea’s head folds and unfolds it');
  await tap('#shop-c-tie .shop-more .btns button:has-text("Bought it")',400);const b1=await ev(()=>({form:shopForm,arr:!!document.querySelector('#shop-arr')}));
  await tap('#shop-c-tie .shop-buy .btns button:has-text("Cancel")',400);const b2=await ev(()=>({form:shopForm,arr:!!document.querySelector('#shop-arr')}));
  ok(b1.form===K&&b1.arr&&b2.form===null&&!b2.arr,T+'"Bought it" asks when it arrives, and Cancel takes the question away ('+J([b1,b2])+')');
  await tap('#shop-c-tie .shop-more .btns button:has-text("Bought it")',400);
  const h=await p.locator('#shop-arr').elementHandle();await h.fill('2099-02-03');
  const nb=await ev(()=>items.length);
  await tap('#shop-c-tie .shop-buy .btns .pri',700);await until(n=>items.length===n+1,nb);
  w=await ev(()=>{const i=items[items.length-1];return {n:items.length,type:i.type,col:i.primaryColor,order:i.order,paused:i.paused,arrives:i.arrives,an:window.__an,form:shopForm}});
  ok(w.n===nb+1&&w.type==='tie'&&w.col==='purple'&&w.order===true&&w.paused===true&&w.arrives==='2099-02-03'&&w.an===1&&w.form===null,T+'"Add as on the way" adds the piece with its date and checks again ('+J(w)+')');
  await tap('#shop-c-tie .shop-more .btns button:has-text("Not for me")',600);
  const s1=await ev(k=>({skip:(settings.shopSkip||[]).includes(k),rec:!!document.querySelector('#shop-c-tie .shop-rec'),hid:!!document.querySelector('#shop-c-hidden button')}),K);
  if(s1.hid)await tap('#shop-c-hidden button',600);
  const s2=await ev(k=>({skip:(settings.shopSkip||[]).includes(k),rec:!!document.querySelector('#shop-c-tie .shop-rec')}),K);
  ok(s1.skip&&!s1.rec&&s1.hid&&!s2.skip&&s2.rec,T+'"Not for me" hides the idea, and "Show again" brings it back ('+J([s1,s2])+')');
  const an0=await ev(()=>window.__an);await tap('#shop-sheet .shop-re button',400);
  ok(await ev(n=>window.__an===n+1,an0),T+'"Check again" starts the check');
  await tap('#shop-sheet .pick-x',600);
  ok(await ev(()=>!shopOpen&&!document.querySelector('#shop-sheet').classList.contains('on')),T+'the sheet’s × closes it');

  /* ---- Insights: a Wear counts section, a Cost per wear row, a lowest-scoring day, the buttons of a short and an empty wardrobe ---- */
  await ev(()=>{items=items.filter(i=>!i.order);cache={};show('stats');renderStats()});await settle(p,700);
  const fold='#st-wear details.st-type[data-type="shirt"] summary';
  await tap(fold,500);const o1=await ev(()=>({open:statsOpen.shirt,rows:document.querySelectorAll('#st-wear details.st-type[open] .st-row').length}));
  await tap(fold,500);const o2=await ev(()=>({open:statsOpen.shirt}));
  ok(o1.open===true&&o1.rows>=5&&o2.open===false,T+'a tap on a Wear counts section unfolds it and fills in its rows; again folds it ('+J([o1,o2])+')');
  const row=await ev(()=>{const b=document.querySelector('#st-cpw .cpw-row');return b?b.querySelector('.st-nm').textContent:null});
  if(row)await tap('#st-cpw .cpw-row',700);
  w=await ev(()=>({ward:!document.querySelector('#wardrobe').hidden,ed:editing,title:editing?itemTitle(items.find(i=>i.id===editing)):null}));
  ok(!!row&&w.ward&&!!w.ed&&cpwOkTitle(row,w.title),T+'a Cost per wear row opens that piece in the Wardrobe ('+J([row,w])+')');
  await ev(()=>closeItem());await settle(p,500);
  // black shoes under a brown and a tan suit: every planned day scores low, so the lowest days are listed
  await ev(()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:+new Date(2026,9,20,12),...x});window.__keep=items;
    items=[I('b1','suit','brown'),I('b2','suit','tan'),I('w1','shirt','white'),I('n1','tie','navy'),I('k1','shoes','black',{leather:'calf'})];dayRecs={};cache={};show('stats');renderStats()});await settle(p,700);
  const low=await ev(()=>{const a=document.querySelector('#st-points a');return a?{k:buildStats().lowest[0][0],txt:a.textContent}:null});
  if(low)await tap('#st-points a',900);
  w=await ev(()=>({today:!document.querySelector('#today').hidden,sel:key(sel),href:location.href}));
  ok(!!low&&w.today&&w.sel===low.k&&!/#$/.test(w.href),T+'a lowest-scoring day’s link opens that day on Today, and goes nowhere else ('+J([low,w])+')');
  await ev(()=>{items=items.filter(i=>i.id==='b1');cache={};show('stats');renderStats()});await settle(p,600);
  const short=await has('#st-short .btns .pri');if(short)await tap('#st-short .btns .pri',700);
  ok(short&&await ev(()=>!document.querySelector('#add').hidden),T+'"Add an item" under "Not a full outfit yet" opens Add');
  await ev(()=>{items=[];cache={};show('stats');renderStats()});await settle(p,600);
  await tap('#stats .emptyadd button:not(.pri)',400);if(await has('#ask-sheet.on #ask-ok'))await tap('#ask-sheet.on #ask-ok',300);await p.waitForFunction(()=>!kitSampling&&items.some(i=>i.sample));const smp=await ev(()=>items.filter(i=>i.sample).length);
  await ev(async()=>{await kitSampleRemove(true);items=[];cache={};show('stats');renderStats()});await settle(p,600);
  await tap('#stats .emptyadd .pri',700);
  ok(smp>0&&await ev(()=>!document.querySelector('#add').hidden),T+'an empty wardrobe’s Insights: "Try a sample wardrobe" loads it and "Add your first item" opens Add ('+smp+')');
  await ev(()=>{show('today');openPack()});await settle(p,600);
  const pe=await has('#pack .emptyadd .pri');if(pe)await tap('#pack .emptyadd .pri',700);
  ok(pe&&await ev(()=>!document.querySelector('#add').hidden),T+'the empty Packing list has the same way to start');

  /* ---- an Add card: Price, Bought and Material ---- */
  await ev(()=>{items=window.__keep;cache={};queue.length=0;openAdd()});await settle(p,400);await tap('#add-manual',600);
  await pick('#nps-q section[data-ck="type"] select','suit');
  const unfold=()=>ev(()=>{for(const k of Object.keys(CK_OPEN))if(k!=='*')delete CK_OPEN[k];renderAdd()});   // (a checked section folds: every section open again)
  await unfold();await settle(p,300);
  await p.locator('#nps-q input.wf-price').first().scrollIntoViewIfNeeded();await p.locator('#nps-q input.wf-price').first().click();await p.keyboard.type('99');await settle(p,200);
  await date('#nps-q input.wf-bought','2026-10-01');
  let q=await ev(()=>({price:queue[0].price,bought:queue[0].bought}));
  ok(q.price==='99'&&q.bought==='2026-10-01',T+'an Add card keeps the price typed and the day bought ('+J(q)+')');
  const mats=await ev(()=>[...document.querySelector('#nps-q select.wmat').options].map(o=>o.value).filter(v=>v&&v!=='other'));
  await pick('#nps-q select.wmat',mats[0]);const qm1=await ev(()=>queue[0].material);
  await unfold();await pick('#nps-q select.wmat','other');await unfold();await settle(p,300);
  const qm2=await ev(()=>queue[0].material);
  await fillTab('#nps-q input.wmat-t','alpaca');const qm3=await ev(()=>queue[0].material);
  ok(qm1===mats[0]&&qm2==='other'&&qm3==='alpaca',T+'an Add card takes the material picked, Other, and the material typed ('+J([qm1,qm2,qm3])+')');
  await ev(()=>{npsClose();queue.length=0;show('today')});await settle(p,300);

  ok(!errs.length,T+'no page errors'+(errs.length?': '+errs.slice(0,4).join(' | '):''));
  await ctx.close();
}
// a Cost per wear row names the piece as Insights does (its name, else its description with the type): the sheet opened is that piece's
function cpwOkTitle(row,title){return !!row&&!!title&&(row===title||row.toLowerCase().includes(String(title).toLowerCase().split(' ')[0]))}
