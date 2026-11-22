// Cost per wear (cost.js, 2026-11-17): an item's price and the day it was bought (Add card's More, the item sheet's Planning & care),
// the currency (Settings → Care, else the holiday country or the phone's language) formatted by Intl.NumberFormat, what a cleaning costs,
// cleanings counted from the records (item.cleans, item.cleaned) or estimated from wears ÷ wears per cleaning, the cost per wear
// (nothing without a price, "Not worn yet" with no wears), Insights' card only with CPW_MIN priced items, the price synced field by
// field between two devices, and the sizes at 320 and 390 px in both themes with no sideways scroll.
const path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');
const {appSrc}=require('./appsrc');
module.exports=async({ok,chromium,url,settle,ROOT})=>{
  {// the merge rule: a price set on one phone and a rename on the other both stay (merge.js mergeItem, field stamps from core.js itemFields)
    const ctx={console,localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return null}}};vm.createContext(ctx);
    vm.runInContext(appSrc(ROOT,'merge.js','core.js')+';this.K={itemFields,mergeState,cleanRecord}',ctx);
    const K=ctx.K,J=o=>JSON.parse(JSON.stringify(o)),base={id:'s1',type:'suit',primaryColor:'navy',pattern:'solid',added:1000,updated:2000};
    const a=K.itemFields({...J(base),price:450,bought:'2025-03-02',updated:5000},J(base)),b=K.itemFields({...J(base),name:'Navy birdseye',updated:6000},J(base));
    const m=[K.mergeState({items:[a]},{items:[b]}).items[0],K.mergeState({items:[b]},{items:[a]}).items[0]];
    ok(m.every(i=>i.price===450&&i.bought==='2025-03-02'&&i.name==='Navy birdseye'),'a price set on one phone and a rename on the other: both kept, either way round');
    const c=K.itemFields({...J(a),price:420,updated:7000},J(a));
    ok(K.mergeState({items:[a]},{items:[c]}).items[0].price===420,'the price changed on both: the later one wins');
    const r=K.cleanRecord({...J(base),price:450,bought:'2025-03-02',cleans:['2026-10-01','2026-11-02']});
    ok(r.price===450&&r.bought==='2025-03-02'&&r.cleans.join()==='2026-10-01,2026-11-02','a record coming in keeps its price, day bought and cleanings as they are');}
  const browser=await chromium.launch();
  // a wardrobe with a worn history (Oct 22 to Nov 10): navy suit 10 wears, grey suit 6 wears then cleaned Nov 6 and 2 more, blazer 3,
  // white shirt 5, a tie and shoes; the suits and the blazer priced
  const SETUP=`(()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:+new Date(2026,9,20,12),...x});
    items=[I('navy','suit','navy',{price:600}),I('grey','suit','grey',{price:450,cleans:['2026-11-06']}),I('bz','blazer','navy',{price:300}),I('p1','pants','grey'),
      I('sh1','shirt','white',{price:60}),I('sh2','shirt','lightblue'),I('t1','tie','burgundy'),I('bs','shoes','black',{leather:'calf'}),I('bb','belt','black',{leather:'calf',metal:'silver'}),I('so','socks','charcoal',{price:12})];
    settings.workdays=[1,2,3,4,5];settings.blazerDays=[5];delete settings.care;delete settings.cleanCost;delete settings.currency;settings.holidays={country:'US',list:[],skip:[]};TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};
    const W=(m,d,top,sh)=>{const k=key(new Date(2026,m,d)),suit=top!=='bz';dayRecs[k]={date:k,ids:{top,bot:suit?null:'p1',shirt:sh,tie:'t1',shoes:'bs',belt:'bb',socks:'so'},suitDay:suit,worn:true}};
    [[9,22,'navy'],[9,23,'grey'],[9,26,'navy'],[9,27,'grey'],[9,28,'navy'],[9,29,'grey'],[9,30,'bz'],[10,2,'grey'],[10,3,'navy'],[10,4,'grey'],[10,5,'navy'],[10,6,'bz'],
     [10,9,'navy'],[10,10,'grey'],[9,21,'navy'],[9,20,'navy'],[9,24,'grey'],[9,31,'navy'],[10,1,'navy'],[10,7,'grey'],[10,8,'bz']].forEach(([m,d,t],n)=>W(m,d,t,n%4?'sh2':'sh1'));
    cache={};sel=new Date(2026,10,11);view={y:2026,m:10}})()`;
  const open=async(vp={width:390,height:844},scheme='light')=>{const p=await (await browser.newContext({viewport:vp,colorScheme:scheme})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});await p.evaluate(SETUP);return {p,errs}};
  try{
    const {p,errs}=await open();
    // ---- currency and formatting
    const f=await p.evaluate(()=>{const o={};o.us=[cpwCur(),cpwMoney(12.4),cpwMoney(186,true),cpwMoney(7.5,true)];
      settings.holidays.country='KW';o.kw=[cpwCur(),cpwMoney(12.4)];settings.holidays.country='DE';o.de=cpwCur();settings.currency='GBP';o.gb=[cpwCur(),cpwMoney(1234.5,true)];
      settings.currency='XX1';o.bad=cpwCur();delete settings.currency;settings.holidays.country='US';
      o.parse=['120','89.50','89,90','1,234.50','1.234,50','12,500','$1 299','abc','','-5','٤٥'].map(cpwParse);return o});
    ok(f.us.join('|')==='USD|$12.40|$186|$7.50','the currency from the holiday country, formatted by Intl: "$12.40", a total of 10 or more without cents "$186" '+f.us.join(' '));
    ok(f.kw[0]==='KWD'&&/KWD|KD|د\.ك/.test(f.kw[1])&&/12\.400/.test(f.kw[1])&&f.de==='EUR'&&f.gb[0]==='GBP'&&f.gb[1]==='£1,235'&&f.bad==='EUR','Kuwait in dinars with three decimals ('+f.kw[1]+'), Germany in euros, the one chosen in Settings wins, a bad code falls back to the country’s '+JSON.stringify(f));
    ok(JSON.stringify(f.parse)===JSON.stringify([120,89.5,89.9,1234.5,1234.5,12500,1299,null,null,5,45]),'typed prices read as numbers in either decimal style '+JSON.stringify(f.parse));
    // ---- cleanings: estimated, recorded, washed after every wear
    const c=await p.evaluate(()=>{const g=id=>cpwOf(items.find(i=>i.id===id));const n=g('navy'),gr=g('grey'),sh=g('sh1'),so=g('so'),bz=g('bz');
      return {n:[n.wears,n.cl.how,n.cl.n,n.clean,n.per],g:[gr.wears,gr.cl.how,gr.cl.n,gr.cl.rec,gr.cl.extra],sh:[sh.wears,sh.cl.how,sh.cl.n],so:[so.wears,so.cl.how,so.cl.n],bz:[bz.wears,bz.cl.how,bz.cl.n],
        none:cpwOf(items.find(i=>i.id==='p1')),tie:cpwOf({...items.find(i=>i.id==='t1'),price:80})}});
    ok(c.n.join()==='10,est,2,0,60','no cleaning recorded: about 10 ÷ 5 = 2 cleanings, no cost set so nothing added, $600 ÷ 10 wears '+c.n.join());
    ok(c.g.join()==='8,mix,2,1,1','one cleaning recorded (Nov 6) after 6 wears: that one and about one more before it '+c.g.join());
    ok(c.sh.join()==='6,each,6'&&c.so.join()==='21,each,21','shirts and socks: one wash per wear '+c.sh+' / '+c.so);
    ok(c.bz.join()==='3,est,0'&&c.none===null&&c.tie.cl.how==='none','a blazer under its limit has none yet; no price, nothing at all; a tie (no limit) counts none');
    // ---- costs set: cost per wear
    const d=await p.evaluate(()=>{settings.cleanCost={suit:15,load:3,perLoad:12};cache={};const n=cpwOf(items.find(i=>i.id==='navy')),s=cpwOf(items.find(i=>i.id==='sh1'));
      return {n:cpwText(n),per:n.per,s:cpwText(s),hint:cpwHint(cpwOf(items.find(i=>i.id==='bz'))),year:cpwCleanYear(items.find(i=>i.id==='navy')),zero:cpwText(cpwOf({id:'zz',type:'suit',primaryColor:'navy',price:250})),zh:cpwHint(cpwOf({id:'zz',type:'suit',primaryColor:'navy',price:250}))}});
    ok(d.n==='$63.00 a wear · 10 wears · $600 + $30 cleaning'&&Math.abs(d.per-63)<1e-9,'the line: "'+d.n+'"');
    ok(d.s==='$10.25 a wear · 6 wears · $60 + $1.50 washing','a shirt: six home washes at $3 a load of 12: "'+d.s+'"');
    ok(d.hint==='Wear it 4 more times to get under $50 a wear.'&&d.zero==='Not worn yet · $250'&&d.zh==='Wear it 2 times to get under $200 a wear.','a hint for an expensive piece worn rarely ("'+d.hint+'"); none worn: "'+d.zero+'"');
    ok(d.year===30,'cleaning spent this year');
    // ---- the item sheet
    const sheet=async id=>{await p.evaluate(id=>{flt='all';show('wardrobe');openItem(id)},id);await settle(p,450);
      return p.evaluate(()=>({price:(document.querySelector('#iv-price')||{}).value,line:(document.querySelector('#cpw-line')||{}).textContent||'',how:!!document.querySelector('#ivcpw .cpwhow'),
        sum:(document.querySelector('#item-view .ivrot .ckh small')||{}).textContent||'',sym:(document.querySelector('#ivcpw .cpwsym')||{}).textContent}))};
    {const s=await sheet('navy');ok(s.price==='600'&&s.line==='$63.00 a wear · 10 wears · $600 + $30 cleaning'&&s.how&&/\$63\.00 a wear$/.test(s.sum)&&s.sym==='$','the item sheet: Price $600 and the line in Planning & care, its summary ends "'+s.sum+'"')}
    {const s=await sheet('p1');ok(s.price===''&&!s.line&&!/\$/.test(s.sum),'no price: an empty Price field and no cost line, no "$0"')}
    await p.fill('#iv-price','1.234,50');await p.locator('#iv-price').dispatchEvent('change');await settle(p,200);
    {const r=await p.evaluate(()=>({price:items.find(i=>i.id==='p1').price,line:document.querySelector('#cpw-line').textContent,stored:null}));
      ok(r.price===1234.5&&/^\$\d+\.\d\d a wear · \d+ wears · \$1,235/.test(r.line),'a price typed in the sheet is saved and the line follows: "'+r.line+'"')}
    await p.fill('#iv-price','lots');await p.locator('#iv-price').dispatchEvent('change');await settle(p,200);
    ok(await p.evaluate(()=>items.find(i=>i.id==='p1').price===1234.5&&/number/.test(document.querySelector('#toast').textContent)),'not a number: kept as it was, and a toast says how to type it');
    await p.fill('#iv-price','');await p.locator('#iv-price').dispatchEvent('change');await settle(p,200);
    ok(await p.evaluate(()=>!('price' in items.find(i=>i.id==='p1'))&&!document.querySelector('#cpw-line')),'an emptied field takes the price off: nothing shown');
    await p.fill('#iv-price','99');await p.waitForTimeout(1000);
    ok(await p.evaluate(()=>items.find(i=>i.id==='p1').price===99),'typing alone saves after a moment (a sheet swiped away keeps it)');
    await p.evaluate(()=>{items.find(i=>i.id==='p1').price=99});
    await p.fill('#iv-bought','2025-04-05');await p.locator('#iv-bought').dispatchEvent('change');await settle(p,200);
    ok(await p.evaluate(()=>items.find(i=>i.id==='p1').bought==='2025-04-05'&&/Bought Apr 5, 2025/.test(document.querySelector('#ivcpw .cpwhow').textContent)),'the day bought is saved and named in "How it’s worked out"');
    {const s=await sheet('grey');const how=await p.evaluate(()=>document.querySelector('#ivcpw .cpwhow').textContent);
      ok(/1 cleaning recorded, and about 1 more before it/.test(how)&&/\$15/.test(how),'"How it’s worked out" says which cleanings are recorded and which estimated: '+how.slice(0,160))}
    {await p.evaluate(()=>{delete settings.cleanCost;cache={}});const s=await sheet('navy');const how=await p.evaluate(()=>document.querySelector('#ivcpw .cpwhow').textContent);
      ok(s.line==='$60.00 a wear · 10 wears · $600'&&/About 2 cleanings/.test(how)&&/isn’t set/.test(how),'no cleaning cost: price alone, and it says the cost isn’t set ("'+s.line+'")')}
    // ---- the cleanings log
    await p.evaluate(()=>closeItem());
    const lg=await p.evaluate(async()=>{show('today');await careCleaned('bz');const a=[...items.find(i=>i.id==='bz').cleans];const t=document.querySelector('#toast button');if(t)t.click();await new Promise(r=>setTimeout(r,200));
      return {a,after:items.find(i=>i.id==='bz').cleans||null}});
    ok(lg.a.join()==='2026-11-11'&&lg.after===null,'"Cleaned today" records the cleaning; Undo takes it back');
    // ---- Insights: only with CPW_MIN priced items
    const ins=async()=>{await p.evaluate(()=>{cache={};show('stats');renderStats()});await settle(p,300);
      return p.evaluate(()=>{const c=document.querySelector('#st-cpw');return c?{h:[...c.querySelectorAll('.cpw-h')].map(x=>x.textContent),rows:[...c.querySelectorAll('.cpw-row')].map(r=>r.querySelector('.st-main small').textContent),tiles:[...c.querySelectorAll('.st-tile')].map(t=>t.textContent)}:null})};
    await p.evaluate(()=>{for(const i of items)if(!['navy','grey'].includes(i.id))delete i.price});
    ok(await ins()===null,'two priced items: no Cost per wear card in Insights');
    await p.evaluate(()=>{items.find(i=>i.id==='bz').price=300;items.find(i=>i.id==='sh1').price=60;settings.cleanCost={suit:15}});
    {const s=await ins();ok(s&&s.h.join()==='Best value,Most per wear'&&s.rows.length===4&&/^\$10\.00 a wear/.test(s.rows[0])&&/^\$100\.00 a wear/.test(s.rows[2])&&/^\$63\.00 a wear/.test(s.rows[3])&&s.tiles[0]==='$1,410spent on these items'&&/^\$60on cleaning in 2026/.test(s.tiles[1]),
      'four priced items: the card, best value first, most per wear, total spent, cleaning this year '+JSON.stringify(s))}
    await p.evaluate(()=>document.querySelector('#st-cpw .cpw-row').click());await settle(p,500);
    ok(await p.evaluate(()=>editing==='sh1'&&!document.querySelector('#wardrobe').hidden),'a row opens the item');
    await p.evaluate(()=>closeItem());
    // ---- the Add card: Price and Bought in More, saved with the item; with "Bought, on the way" too
    const add=await p.evaluate(async()=>{queue=[];openAdd();addManual();setq(0,'type','tie');const q=queue[0];setOrder(qAt(q.id),true);
      const has=!!document.querySelector('#nps-q .wf-price');cpwQSet(qAt(q.id),'price','45.50');cpwQSet(qAt(q.id),'bought','2026-11-10');const ok1=await save(q.id);const it=items.find(i=>i.id===q.id);
      return {has,ok1,price:it&&it.price,bought:it&&it.bought,order:it&&it.order}});
    ok(add.has&&add.ok1&&add.price===45.5&&add.bought==='2026-11-10'&&add.order,'the Add card takes a price and the day bought, "Bought, on the way" too '+JSON.stringify(add));
    // ---- Settings → Care: the currency and the costs
    await p.evaluate(()=>{show('today');openSettings('care')});await p.waitForFunction(()=>document.querySelector('#cpw-cur'));
    await p.fill('#cpw-blazer','12.50');await p.locator('#cpw-blazer').dispatchEvent('change');await p.selectOption('#cpw-cur','EUR');await settle(p,200);
    ok(await p.evaluate(()=>settings.cleanCost.blazer===12.5&&settings.currency==='EUR'&&document.querySelector('#sc-care .cpwsym').textContent==='€'),'Settings → Care sets what a dry cleaning costs and the currency');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await p.context().close();
    // ---- sizes and themes: the item sheet, Insights' card and Settings → Care, no sideways scroll
    const shots=process.env.CPW_SHOTS;
    for(const w of [320,390])for(const th of ['light','dark']){
      const {p:q,errs:e2}=await open({width:w,height:844},th);
      await q.evaluate(()=>{settings.cleanCost={suit:15,load:3,perLoad:12};items.find(i=>i.id==='navy').bought='2025-03-02';cache={};flt='all';show('wardrobe');openItem('navy')});await settle(q,500);
      await q.evaluate(()=>{const s=document.querySelector('#ivcpw .cpwhow');s.open=true;document.querySelector('#ivcpw').scrollIntoView({block:'start'})});await settle(q,200);
      const iv=await q.evaluate(()=>{const v=document.querySelector('#ivbody'),vr=document.querySelector('#item-view').getBoundingClientRect(),b=document.querySelector('#ivcpw');
        const out=[...b.querySelectorAll('*')].filter(x=>{const r=x.getBoundingClientRect();return r.width&&(r.right>vr.right+.5||r.left<vr.left-.5)}).length;
        return {side:v.scrollWidth-v.clientWidth,out,page:document.documentElement.scrollWidth-innerWidth,inp:Math.round(document.querySelector('#iv-price').getBoundingClientRect().height),sum:Math.round(document.querySelector('#ivcpw summary').getBoundingClientRect().height)}});
      ok(iv.side<=0&&iv.out===0&&iv.page<=0&&iv.inp>=38&&iv.sum>=44,`item sheet at ${w}px, ${th}: the price block stays inside, no sideways scroll ${JSON.stringify(iv)}`);
      if(shots)await q.screenshot({path:path.join(shots,`sheet-${w}-${th}.png`)});
      await q.evaluate(()=>{closeItem();show('stats');renderStats()});await settle(q,500);
      await q.evaluate(()=>document.querySelector('#st-cpw').scrollIntoView({block:'start'}));await settle(q,200);
      const st=await q.evaluate(()=>{const c=document.querySelector('#st-cpw'),r=c.getBoundingClientRect();return {page:document.documentElement.scrollWidth-innerWidth,
        out:[...c.querySelectorAll('*')].filter(x=>{const b=x.getBoundingClientRect();return b.width&&(b.right>r.right+.5||b.left<r.left-.5)}).length,rows:[...c.querySelectorAll('.cpw-row')].map(b=>Math.round(b.getBoundingClientRect().height))}});
      ok(st.page<=0&&st.out===0&&st.rows.length&&st.rows.every(h=>h>=44),`Insights' card at ${w}px, ${th}: inside, 44px rows ${JSON.stringify(st)}`);
      if(shots)await q.screenshot({path:path.join(shots,`insights-${w}-${th}.png`)});
      await q.evaluate(()=>{show('today');openSettings('care')});await q.waitForFunction(()=>document.querySelector('#cpw-cur'));await settle(q,600);
      await q.evaluate(()=>document.querySelector('#cpw-set').scrollIntoView({block:'start'}));await settle(q,200);
      const se=await q.evaluate(()=>{const m=document.querySelector('#settings-modal'),mr=m.getBoundingClientRect();return {side:m.scrollWidth-m.clientWidth,
        out:[...document.querySelectorAll('#cpw-set *')].filter(x=>{const r=x.getBoundingClientRect();return r.width&&(r.right>mr.right+.5||r.left<mr.left-.5)}).length}});
      ok(se.side<=0&&se.out===0,`Settings → Care's costs at ${w}px, ${th}: nothing past the edge ${JSON.stringify(se)}`);
      if(shots)await q.screenshot({path:path.join(shots,`settings-${w}-${th}.png`)});
      ok(e2.length===0,`no page errors at ${w}px, ${th} (${e2.join('; ')})`);
      await q.context().close()}
  }finally{await browser.close()}

  // ---- two devices: the price travels with the item, field by field
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
    const sync=p=>p.evaluate(()=>syncNow()),get=p=>p.evaluate(()=>{const i=items.find(x=>x.id==='s1');return i?{price:i.price??null,name:i.name||null,cleans:i.cleans||null}:null});
    const A=await device(),B=await device();
    await A.evaluate(async()=>{const it={id:'s1',type:'suit',primaryColor:'navy',pattern:'solid',vest:'no',added:1};await put(it);items.push(it)});
    await sync(A);await sync(B);
    await A.evaluate(()=>cpwSetPrice('s1','450',false));await B.evaluate(()=>setItemField('s1','name','Navy birdseye'));
    await sync(A);await sync(B);await sync(A);
    const a=await get(A),b=await get(B);
    ok(a&&b&&a.price===450&&b.price===450&&a.name==='Navy birdseye'&&b.name==='Navy birdseye','a price set on one device and a rename on the other: both on both devices '+JSON.stringify([a,b]));
    await B.evaluate(()=>careCleaned('s1'));await sync(B);await sync(A);
    ok((await get(A)).cleans.join()==='2026-11-11','a cleaning recorded on one device is on the other');
  }finally{await b2.close()}
};
