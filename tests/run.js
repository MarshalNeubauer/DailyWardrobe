// Daily Wardrobe test suite. Run: node tests/run.js   (needs Playwright + Chromium)
// Serves the repo over HTTP, drives the app in headless Chromium and checks rendering, gestures, layout,
// the outfit rules (with an independent checklist), pattern detection and the Cloudflare worker.
const http=require('http'),fs=require('fs'),path=require('path'),{chromium,devices}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});r.end(d)})});

let failures=0,passes=0;
const ok=(cond,msg)=>{if(cond){passes++;console.log('  ✓ '+msg)}else{failures++;console.log('  ✗ '+msg)}};
const suites=[];const suite=(name,fn)=>suites.push([name,fn]);

/* shared test wardrobes, built inside the page */
const WARDROBES=`(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
 const common=[I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','burgundy',{leather:'calf',metal:'silver'}),I('watch','grey',{metal:'silver'}),I('socks','navy'),I('socks','charcoal'),I('socks','brown')];
 return {
  realistic:[I('suit','navy'),I('suit','charcoal'),I('suit','grey',{pattern:'herringbone'}),I('suit','navy',{pattern:'pinstripe'}),I('suit','lightgrey'),I('suit','darkgrey'),I('blazer','navy'),I('blazer','tan'),I('blazer','brown',{pattern:'tweed'}),I('pants','grey'),I('pants','charcoal'),I('pants','tan'),I('pants','cream'),
   I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white',{pattern:'pinstripe',secondaryColor:'blue'}),I('shirt','lightblue',{pattern:'gingham',secondaryColor:'white'}),I('shirt','cream'),
   I('tie','navy',{pattern:'stripe',secondaryColor:'white',tertiaryColor:'grey'}),I('tie','burgundy'),I('tie','burgundy',{pattern:'paisley',secondaryColor:'navy'}),I('tie','green'),I('tie','navy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','gold'),I('tie','purple'),I('tie','red',{pattern:'stripe',secondaryColor:'navy'}),I('tie','grey'),I('tie','black',{pattern:'knit'}),I('tie','pink'),...common],
  awkward:[I('suit','navy',{pattern:'windowpane',secondaryColor:'lightblue'}),I('suit','black'),I('suit','brown',{pattern:'chalk-stripe'}),I('blazer','grey',{pattern:'glen-check'}),I('pants','grey'),I('pants','black'),I('pants','navy'),
   I('shirt','navy'),I('shirt','black'),I('shirt','pink',{pattern:'stripe',secondaryColor:'white'}),I('shirt','lightblue',{pattern:'check',secondaryColor:'navy'}),I('shirt','lightblue',{pattern:'stripe',secondaryColor:'white'}),
   I('tie','pink'),I('tie','red',{pattern:'stripe',secondaryColor:'gold'}),I('tie','navy',{pattern:'check',secondaryColor:'white'}),I('tie','lightblue'),I('tie','purple',{pattern:'paisley',secondaryColor:'gold'}),I('tie','silver'),...common],
  leather:[I('suit','navy'),I('suit','charcoal'),I('suit','darkgrey',{pattern:'herringbone'}),I('suit','brown'),I('suit','lightgrey'),I('blazer','navy'),I('blazer','tan'),I('pants','grey'),I('pants','lightgrey'),I('pants','tan'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
   I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'suede'}),I('shoes','oxblood',{leather:'cordovan'}),I('shoes','black',{leather:'patent'}),I('shoes','tan',{leather:'pebble-grain'}),
   I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'suede',metal:'gold'}),I('belt','burgundy',{leather:'calf',metal:'silver'}),
   I('watch','grey',{metal:'silver',band:'bracelet'}),I('watch','brown',{metal:'gold',band:'leather'}),I('tieclip','grey',{metal:'silver'}),I('tieclip','gold',{metal:'gold'}),I('socks','navy'),I('socks','charcoal'),I('socks','brown'),I('socks','burgundy')],
  noBelt:[I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('tie','burgundy'),I('shoes','black',{leather:'calf'}),I('belt','brown',{leather:'calf'})],
  patentOnly:[I('suit','navy'),I('shirt','white'),I('shoes','black',{leather:'patent'}),I('belt','black',{leather:'patent'})],
 }})()`;
const MONTHS=[[2026,10],[2026,11],[2027,0]];

suite('renders the outfit without errors',async({page,errs})=>{
  await page.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today')})()`);
  ok(await page.$('#mannequin-container.fig > svg')!==null,'outfit figure SVG is drawn');
  ok(await page.$('.score .num')!==null,'score card is shown');
  ok((await page.$$('#today .month-link .mli')).length===5,'Today links to the month plan with the next 5 outfits');
  ok(errs.length===0,'no console errors ('+errs.join('; ')+')');
});

suite('figure draws the tie, and the shirt when there is no jacket',async({page})=>{
  const r=await page.evaluate(`(()=>{const o={suitDay:true,top:{type:'suit',primaryColor:'grey',pattern:'solid'},bot:{type:'suit',primaryColor:'grey',pattern:'solid'},shirt:{type:'shirt',primaryColor:'white',pattern:'solid'},tie:{type:'tie',primaryColor:'navy',pattern:'solid'}};
    const d=document.createElement('div');d.innerHTML=figureSvg(o,'t1-');const a=!!d.querySelector('use[href="#t1-bladeP"]')&&d.querySelector('#t1-suitB').innerHTML.includes(COLORS.grey);
    o.top=null;d.innerHTML=figureSvg(o,'t2-');const b=d.querySelector('#t2-suitB').innerHTML.includes(COLORS.white);return [a,b]})()`);
  ok(r[0],'tie drawn over the suit');ok(r[1],'without a jacket the body is drawn in the shirt fabric');
});

suite('swipe moves only the outfit, across viewports',async({browser,url})=>{
  const views={'iPhone 13':[390,844],'Duo folded':[466,678],'Duo unfolded':[626,890],'Duo landscape':[890,626]};
  for(const [name,[w,h]] of Object.entries(views)){
    const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today')})()`);await p.waitForTimeout(150);
    const probe=()=>p.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return Math.round(b.x)+','+Math.round(b.y)};return {date:document.querySelector('#today .day h2').textContent,nav:r('#today .day'),list:r('#today .score'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,slide:document.querySelector('#slide').style.transform}});
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const st=await p.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+Math.min(b.height/2,300)}});
    const before=await probe();let mid;await T('touchStart',st.x+80,st.y);for(let k=1;k<=8;k++){await T('touchMove',st.x+80-25*k,st.y+2);await p.waitForTimeout(16);if(k===6)mid=await probe()}await T('touchEnd');await p.waitForTimeout(450);
    const after=await probe();
    ok(after.date!==before.date&&mid.slide.includes('translateX(-'),`${name}: swipe changes the day and the outfit follows the finger`);
    ok(mid.nav===before.nav&&after.nav===before.nav&&mid.list===before.list&&after.list===before.list,`${name}: date bar and item list stay put`);
    ok(mid.overflow===0&&after.overflow===0,`${name}: page never wider than the screen`);
    if(w>=600)ok(parseInt(before.list)>w/3,`${name}: two-column layout`);
    await ctx.close();
  }
});

suite('swipe edge cases and month crossing',async({page,ctx})=>{
  await page.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;cache={};sel=new Date(2026,10,7);view={y:2026,m:10};show('today')})()`);
  const cdp=await ctx.newCDPSession(page);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  const swipe=async(x0,x1)=>{await T('touchStart',x0,420);for(let k=1;k<=6;k++)await T('touchMove',x0+(x1-x0)*k/6,422);await T('touchEnd');await page.waitForTimeout(400)};
  const day=()=>page.evaluate(()=>document.querySelector('#today .day h2').textContent);
  await swipe(300,120);ok((await day()).startsWith('Sunday'),'swipe works from a non-workday');
  const d=await day();await swipe(10,250);ok(await day()===d,'swipes starting at the screen edge are ignored');
  const r=await page.evaluate(()=>{sel=new Date(2026,11,31);view={y:2026,m:11};renderToday();stepDay(1);return document.querySelector('#today .day h2').textContent});
  ok(r.includes('January 3'),'stepping past Dec 31 lands on the next workday in January');
});

suite('planner: independent outfit checklist',async({page})=>{
  const res=await page.evaluate(`(()=>{const W=${WARDROBES};
   const F={darkgrey:'charcoal',lightgrey:'grey',oxblood:'burgundy'},f=c=>F[c]||c,L=c=>{const h=COLORS[c];return parseInt(h.slice(1,3),16)*.3+parseInt(h.slice(3,5),16)*.59+parseInt(h.slice(5,7),16)*.11};
   const T={stripe:'S',pinstripe:'S','chalk-stripe':'S',check:'C',gingham:'C',tattersall:'C',windowpane:'C','glen-check':'C',houndstooth:'C','polka-dot':'M',paisley:'M',foulard:'M'};
   const sc=(i,r)=>r==='tie'?({stripe:3,check:2,'polka-dot':2,paisley:2,foulard:1})[i.pattern]??2:r==='shirt'?(i.pattern==='pinstripe'?1:2):({pinstripe:1,windowpane:3})[i.pattern]??2;
   const BT={navy:['grey','charcoal','tan','cream','olive'],tan:['navy','brown','charcoal','olive'],brown:['grey','charcoal','tan','navy','cream'],grey:['charcoal','navy','black'],olive:['tan','brown','charcoal','cream']};
   const audit=o=>{const v=[];const top=o.top,bot=o.suitDay?null:o.bot,sh=o.shirt,t=o.tie;
    // option B: a dark shirt (brightness < 100) may go under a light jacket (>= 130); its tie must then read lighter than it,
    // judging a patterned tie by base 65% + its accent colours 35%
    const dk=sh&&L(sh.primaryColor)<100,tl=x=>{const a=x.pattern&&!['solid','knit'].includes(x.pattern)?[x.secondaryColor,x.tertiaryColor].filter(c=>c&&COLORS[c]):[];return a.length?L(x.primaryColor)*.65+a.reduce((s,c)=>s+L(c),0)/a.length*.35:L(x.primaryColor)};
    if(sh&&t&&dk&&tl(t)-L(sh.primaryColor)<25)v.push('tie not lighter than dark shirt');
    if(sh&&t&&!dk&&L(sh.primaryColor)-L(t.primaryColor)<25)v.push('tie not darker than shirt');
    if(sh&&t&&f(sh.primaryColor)===f(t.primaryColor))v.push('tie same colour as shirt');
    if(sh&&top&&!(dk&&L(top.primaryColor)>=130)&&L(sh.primaryColor)<L(top.primaryColor)+20)v.push('shirt not lighter than jacket');
    const P=[[top,'top'],[bot,'bot'],[sh,'shirt'],[t,'tie']].filter(([i])=>i&&T[i.pattern]).map(([i,r])=>({t:T[i.pattern],s:sc(i,r)}));
    if(P.length>=3)v.push('three bold patterns');
    for(let a=0;a<P.length;a++)for(let c=a+1;c<P.length;c++)if(P[a].t===P[c].t&&P[a].s===P[c].s)v.push('same pattern type and scale');
    if(bot&&top){const l=BT[f(top.primaryColor)];if(l&&!l.includes(f(bot.primaryColor)))v.push('trousers not a classic pairing');if(Math.abs(L(top.primaryColor)-L(bot.primaryColor))<35)v.push('no jacket/trouser contrast')}
    if(new Set([top,bot,sh,t].filter(Boolean).map(i=>f(i.primaryColor))).size>4)v.push('more than 4 main colours');
    if(top&&sh&&t&&new Set([top,sh,t].map(i=>f(i.primaryColor))).size===1)v.push('monochrome');
    return v};
   const out={};
   for(const name of ['realistic','awkward']){items=W[name];cache={};const by=t=>items.filter(i=>i.type===t);let days=0,viol=0,avoidable=0;const shirts=new Set(),ties=new Set();
    for(const [y,m] of ${JSON.stringify(MONTHS)}){const plan=buildPlan(y,m);
     for(const [d,o] of Object.entries(plan)){const [yy,mm]=d.split('-').map(Number);if(yy!==y||mm!==m+1)continue;days++;
      if(m===10){o.shirt&&shirts.add(o.shirt.id);o.tie&&ties.add(o.tie.id)}
      const v=audit(o);if(!v.length)continue;viol++;
      let exists=false;const Ps=o.suitDay?[o.top]:by('pants');
      outer:for(const pt of Ps)for(const sh of by('shirt'))for(const t of by('tie'))if(!audit({...o,bot:pt,shirt:sh,tie:t}).length){exists=true;break outer}
      if(exists)avoidable++}}
    out[name]={days,viol,avoidable,shirts:shirts.size,ties:ties.size}}
   return out})()`);
  ok(res.realistic.days>=60&&res.realistic.viol===0,`realistic wardrobe: ${res.realistic.days} workdays, ${res.realistic.viol} rule violations`);
  ok(res.realistic.shirts>=6&&res.realistic.ties>=6,`realistic wardrobe rotates (${res.realistic.shirts} shirts, ${res.realistic.ties} ties in a month)`);
  ok(res.awkward.avoidable===0,`awkward wardrobe: ${res.awkward.viol} violations, ${res.awkward.avoidable} of them avoidable`);
});

suite('planner: shoes, belts, leather and metals',async({page})=>{
  const res=await page.evaluate(`(()=>{const W=${WARDROBES};const out={};
   for(const name of ['leather','noBelt','patentOnly']){items=W[name];cache={};const st={days:0,patent:0,badBelt:0,noBelt:0,noBeltNoted:0,suedeWithSuit:0,badShoe:0,metal:0,strap:0,patentNoted:0};
    for(const [y,m] of ${JSON.stringify(MONTHS)}){const plan=buildPlan(y,m);
     for(const [d,o] of Object.entries(plan)){const [yy,mm]=d.split('-').map(Number);if(yy!==y||mm!==m+1)continue;st.days++;
      if(!o.shoes)continue;
      if(finish(o.shoes.leather)==='patent'){st.patent++;if(o.notes.some(n=>n.includes('black tie')))st.patentNoted++}
      if(o.suitDay&&finish(o.shoes.leather)==='suede')st.suedeWithSuit++;
      if(shoeScore(o.top,o.bot,o.shoes)<=-50)st.badShoe++;
      if(o.belt){if(beltFit(o.shoes,o.belt)===null)st.badBelt++}else if(items.some(i=>i.type==='belt')){st.noBelt++;if(o.notes.some(n=>n.includes('belts match')))st.noBeltNoted++}
      if(o.watch&&o.belt&&metalOf(o.watch)!==metalOf(o.belt))st.metal++;
      if(o.watch&&watchOpts(o.watch).band==='leather'&&leatherGroup(o.watch.primaryColor)!==leatherGroup(o.shoes.primaryColor))st.strap++}}
    out[name]=st}
   return out})()`);
  const L=res.leather;
  ok(L.badBelt===0&&L.noBelt===0,'belts always match the shoes');
  ok(L.patent===0,'no patent shoes on workdays when other shoes exist');
  ok(L.suedeWithSuit===0,'no suede shoes with suits');
  ok(L.badShoe===0,'shoe colour always suits the trousers');
  ok(L.metal===0&&L.strap===0,'watch, buckle and strap coordinate');
  ok(res.noBelt.noBelt===res.noBelt.days&&res.noBelt.noBeltNoted===res.noBelt.days,'missing matching belt: none picked, note shown every day');
  ok(res.patentOnly.patent===res.patentOnly.days&&res.patentOnly.patentNoted===res.patentOnly.days,'patent-only wardrobe: patent used with a black-tie note');
});

suite('outfit score',async({page})=>{
  const r=await page.evaluate(`(()=>{const W=${WARDROBES};const out={};for(const n of ['realistic','awkward']){items=W[n];cache={};const sc=Object.entries(buildPlan(2026,10)).filter(([d])=>d.startsWith('2026-11-')).map(([,o])=>rateOutfit(o));
    out[n]={avg:sc.reduce((a,b)=>a+b.score,0)/sc.length,explained:sc.every(r=>r.checks.every(c=>c.pts===c.max||c.why))}}return out})()`);
  ok(r.realistic.avg>=90,`realistic wardrobe averages ${r.realistic.avg.toFixed(0)}`);
  ok(r.awkward.avg<r.realistic.avg-8,`awkward wardrobe scores clearly lower (${r.awkward.avg.toFixed(0)})`);
  ok(r.realistic.explained&&r.awkward.explained,'every lost point has a reason');
});

suite('add an item without a photo; it persists',async({page})=>{
  await page.click('#n-add');await page.click('text=Add without photo');
  await page.selectOption('#queue .card >> nth=0 >> select[onchange*="\'type\'"]','belt');
  await page.selectOption('#queue .card >> nth=0 >> select[onchange*="\'leather\'"]','suede');
  await page.click('#queue .card >> nth=0 >> text=Confirm');
  await page.waitForFunction(()=>items.some(i=>i.type==='belt'));await page.waitForTimeout(200);
  await page.reload();await page.waitForFunction(()=>window.appReady);
  const it=await page.evaluate(()=>items.find(i=>i.type==='belt'));
  ok(it&&it.leather==='suede'&&!it.photo,'photo-less belt saved with its leather and survives a reload');
  await page.click('#n-wardrobe');ok(await page.$('.gi .thumb svg')!==null,'wardrobe shows a drawn thumbnail');
});

suite('pattern detection on synthetic fabric photos',async({page})=>{
  const r=await page.evaluate(()=>{
    const synth=(W,H,rot,draw)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.translate(W/2,H/2);g.rotate(rot*Math.PI/180);g.translate(-W,-H);draw(g,W*2,H*2);return c};
    const bands=(g,W,H,seq,vertical,alpha=1)=>{g.globalAlpha=alpha;let x=0;while(x<(vertical?W:H)){for(const [col,w] of seq){if(col){g.fillStyle=col;vertical?g.fillRect(x,0,w,H):g.fillRect(0,x,W,w)}x+=w}}g.globalAlpha=1};
    const tie=synth(800,800,0,(g,W,H)=>{g.fillStyle='#1b2a4a';g.fillRect(0,0,W,H);g.rotate(-.65);bands(g,W*2,H*2,[[null,60],['#f0f0f0',6],['#9aa0a8',22],['#f0f0f0',6]],true)});
    const ging=synth(800,800,2,(g,W,H)=>{g.fillStyle='#fff';g.fillRect(0,0,W,H);bands(g,W,H,[['#3f6fb5',30],[null,30]],true,.5);bands(g,W,H,[['#3f6fb5',30],[null,30]],false,.5)});
    const pin=synth(800,800,1.5,(g,W,H)=>{g.fillStyle='#5f6268';g.fillRect(0,0,W,H);bands(g,W,H,[[null,52],['#d8d8d8',4]],true)});
    const T=detectPattern({type:'tie',primaryColor:'navy',secondaryColor:'white',tertiaryColor:'grey',pattern:'stripe'},tie,200,200,400);
    const G=detectPattern({type:'shirt',primaryColor:'white',secondaryColor:'blue',pattern:'gingham'},ging,200,200,400);
    const P=detectPattern({type:'suit',primaryColor:'charcoal',pattern:'pinstripe'},pin,200,200,400);
    return {T,G,P}});
  ok(r.T&&r.T.kind==='stripes'&&r.T.b.length===4&&r.T.b[0][0]==='p','diagonal tie stripes: 4 bands starting with the base colour');
  ok(r.G&&r.G.kind==='check'&&r.G.b.length===2,'gingham read as a two-band check');
  ok(r.P&&r.P.kind==='stripes'&&r.P.a%180===0||r.P&&Math.abs(r.P.a)<=3,'pinstripe read as vertical stripes');
});

/* worker.js in Node with a mocked Workers AI binding */
async function workerTests(){
  console.log('\n• Cloudflare worker (mocked bindings)');
  const mod=await import(require('url').pathToFileURL(path.join(ROOT,'worker.js')).href);const w=mod.default;
  let agreed=false;const AI={run:async(m,inp)=>{if(inp.prompt==='agree'){agreed=true;return{response:'ok'}}if(!agreed)throw new Error('5016: agree first');return{response:'{"type":"tie","primaryColor":"navy","pattern":"stripe"}'}}};
  const env={AI,APP_TOKEN:'t',ALLOWED_ORIGIN:'https://x.github.io'};
  const req=(tok,body,origin='https://x.github.io',method='POST',p='/')=>new Request('https://w'+p,{method,headers:{'content-type':'application/json',Origin:origin,'x-app-token':tok},body:body&&JSON.stringify(body)});
  let r=await w.fetch(req('t',{image:'data:image/jpeg;base64,AAAA'}),env);ok(r.status===200&&(await r.json()).type==='tie','photo tagging works (and accepts the model licence once)');
  r=await w.fetch(req('bad',{image:'data:image/jpeg;base64,AAAA'}),env);ok(r.status===403,'wrong token is refused');
  r=await w.fetch(req('t',{image:'data:image/jpeg;base64,AAAA'},'https://evil.example'),env);ok(r.status===403,'wrong origin is refused');
  return w;
}

(async()=>{
  await new Promise(r=>server.listen(0,r));const url=`http://127.0.0.1:${server.address().port}/index.html`;
  const browser=await chromium.launch();
  // `node tests/run.js name` (or TEST_ONLY=name) runs just the tests/*.test.js files whose name contains it
  const ONLY=process.env.TEST_ONLY||process.argv[2];
  for(const [name,fn] of ONLY?[]:suites){
    console.log('\n• '+name);
    const ctx=await browser.newContext({...devices['iPhone 13']});const page=await ctx.newPage();const errs=[];
    page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await page.goto(url);await page.waitForFunction(()=>window.appReady);
    try{await fn({page,ctx,browser,url,errs})}catch(e){failures++;console.log('  ✗ threw: '+e.message)}
    if(errs.length&&name!=='renders the outfit without errors'){failures++;console.log('  ✗ console errors: '+errs.join('; '))}
    await ctx.close();
  }
  await browser.close();
  if(!ONLY)try{await workerTests()}catch(e){failures++;console.log('  ✗ worker tests threw: '+e.message)}
  // extra suites contributed by other files (tests/*.test.js)
  for(const f of fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')&&(!ONLY||f.includes(ONLY))).sort()){
    console.log('\n• '+f);try{await require(path.join(__dirname,f))({ok,url,chromium,devices,WARDROBES,ROOT})}catch(e){failures++;console.log('  ✗ threw: '+e.message)}
  }
  server.close();
  console.log(`\n${passes} passed, ${failures} failed`);process.exit(failures?1:0);
})();
