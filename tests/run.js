// Daily Wardrobe test suite. Run: node tests/run.js   (needs Playwright + Chromium)
//   node tests/run.js             every check
//   node tests/run.js --changed   only the checks the change since origin/main can affect (`npm test`; see tests/impact.js)
//   node tests/run.js --changed --list   say which those are, and run nothing
//   node tests/run.js <name>      the tests/*.test.js files whose name contains <name> (or TEST_ONLY=<name>)
//   node tests/run.js --webkit    on WebKit instead of Chromium (`npm run test:webkit`)
//   TEST_JOBS=<n>                 how many tests run at once (default: the processor cores less one, at most 16, fewer when the machine
//                                 is busy); TEST_JOBS=1 runs them one after another in this process, printing as it goes
//   node tests/run.js --shard i/N shard i of N of the tests (or TEST_SHARD=i/N), balanced by tests/shard-times.json: the cloud run
//                                 (`npm run test:cloud`, .github/workflows/full-tests.yml; tests/shard.js)
//   TEST_LOCK=0                   don't wait for another worktree's test run (one run at a time on this machine: tests/testlock.js)
//   TEST_WEBKIT=1 / 0             with --changed, run the WebKit halves of the files that check both engines / don't (default: only
//                                 when the change touches a page file, `webkitWanted`); TEST_WEBKIT=0 also leaves them out of a run by name
// Serves the repo over HTTP, drives the app in headless Chromium and checks rendering, gestures, layout,
// the outfit rules (with an independent checklist), pattern detection and the Cloudflare worker.
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),{fork}=require('child_process'),{chromium,devices}=require('playwright'),impact=require('./impact');
const ROOT=path.resolve(__dirname,'..'),readFile=fs.readFile;
let rec=null;   // records what each test uses (tests/impact.js); NO_IMPACT=1 turns it off
// --webkit (`npm run test:webkit`) or TEST_BROWSER=webkit runs every test on WebKit (Safari's engine; tests/webkit.js); the
// recorder is Chromium only, so it is off. (The flag sets the variable, which the worker processes inherit: Windows' shells
// have no `VAR=x cmd`.)
if(process.argv.includes('--webkit'))process.env.TEST_BROWSER='webkit';
const WEBKIT=process.env.TEST_BROWSER==='webkit';
if(WEBKIT)process.env.NO_IMPACT='1';
const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
// (a folder's address is its index.html, tested on the address: path.join gives a Windows path a backslash, and `./` was a 404 there
// only, so sw.js's install failed on Windows and the service worker took over every test page on Linux alone)
const server=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);
  readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}if(rec)rec.served(path.relative(ROOT,f).split(path.sep).join('/'));
    r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});r.end(d)})});

let failures=0,passes=0;
const ok=(cond,msg)=>{if(cond){passes++;console.log('  ✓ '+msg)}else{failures++;console.log('  ✗ '+msg)}};
/* wait for the page to come to rest after a tap: no finite animation or transition running and the scroll position unchanged
   for 4 frames, instead of a fixed pause. `max` is the pause it replaced; it may wait up to twice that on a busy machine, so a
   check never runs in the middle of an animation (DEBUG_SETTLE=1 logs each wait and what was still moving) */
const settle=async(page,max=1000)=>{const t0=Date.now();
  // (on WebKit also two still frames 100 ms or more apart: Playwright's WebKit runs a page's frames far apart at times, and its waits ran
  // to their limit with nothing moving, 140 of backgesture's 255 s of waiting; CR-10-02. Chromium's rule is as it was)
  let wk=false;try{const b=page.context().browser();wk=!!b&&b.browserType().name()==='webkit'}catch(e){}
  const r=await page.evaluate(([max,wk])=>new Promise(res=>{let last=scrollY,still=0,why='',t1=0;const t0=performance.now();
    const live=()=>document.getAnimations().filter(a=>(a.playState==='running'||a.pending)&&a.effect&&a.effect.getComputedTiming().endTime!==Infinity);
    const f=()=>{const L=live(),now=performance.now();if(scrollY===last&&!L.length){if(!still++)t1=now}else{still=0;why=L.map(a=>(a.animationName||a.transitionProperty)+'@'+(a.effect.target.id||String(a.effect.target.className).slice(0,20))).join(',')+(scrollY!==last?' scroll':'')}
      last=scrollY;if(still>=4||(wk&&still>=2&&now-t1>=100)||now-t0>2*max)res(why);else requestAnimationFrame(f)};requestAnimationFrame(f)}),[max,wk]).catch(()=>'');
  if(process.env.DEBUG_SETTLE)console.log(`    settle ${Date.now()-t0}/${max} ${r}`)};
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
  ok((await page.$$('.score .dial')).length===6,'score card is shown (six dials)');
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
    if(w>=600&&w>h)ok(parseInt(before.list)>w/3,`${name}: two-column layout`);
    if(w>=600&&w<h){const L=await p.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();const f=r('#mannequin-container'),b=r('.below'),c=r('#sbox');return {f:[f.left,f.width],b:[b.left,b.width,b.top],c:[c.left,c.width,c.top],fb:f.bottom}});
      ok(Math.abs(L.f[0]-L.b[0])<1&&Math.abs(L.f[1]-L.b[1])<1&&Math.abs(L.c[0]-L.b[0])<1&&Math.abs(L.c[1]-L.b[1])<1&&L.b[1]>w-40,`${name}: upright, the outfit, tiles and cards share the full width (${Math.round(L.f[1])}/${Math.round(L.b[1])}/${Math.round(L.c[1])}px of ${w})`);
      ok(L.b[2]>=L.fb&&L.c[2]>L.b[2],`${name}: upright, the outfit is on top, then the tiles, then the cards`)}
    await ctx.close();
  }
});

suite('swipe edge cases and month crossing',async({page,ctx})=>{
  await page.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;cache={};sel=new Date(2026,10,7);view={y:2026,m:10};show('today')})()`);
  const cdp=await ctx.newCDPSession(page);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  const swipe=async(x0,x1)=>{await T('touchStart',x0,420);for(let k=1;k<=6;k++)await T('touchMove',x0+(x1-x0)*k/6,422);await T('touchEnd');await settle(page,400)};
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
  // Add is a page of the Wardrobe since the tabs became Today, Wardrobe, Insights (#225): Wardrobe → + Add
  // "Add without a photo" opens its card in a sheet over Add (#nps-sheet), Confirm pinned at its bottom (#nps-bar)
  // (the card is a checklist since 2026-11-16: its sections open, checklist.js CK_OPEN['*'])
  await page.evaluate(()=>{CK_OPEN['*']=true});await page.click('#n-wardrobe');await page.click('#ward-add');await page.click('#add-manual');
  await page.selectOption('#nps-q .card >> nth=0 >> select[data-f="type"]','belt');
  await page.selectOption('#nps-q .card >> nth=0 >> select[data-f="leather"]','suede');
  await page.click('#nps-bar >> button:has-text("Confirm")');   // (the bar also says "… you can still confirm")
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
const WORKER='Cloudflare worker (mocked bindings)';
async function workerTests(){
  const mod=await import(require('url').pathToFileURL(path.join(ROOT,'worker.js')).href);const w=mod.default;
  let agreed=false;const AI={run:async(m,inp)=>{if(inp.prompt==='agree'){agreed=true;return{response:'ok'}}if(!agreed)throw new Error('5016: agree first');return{response:'{"type":"tie","primaryColor":"navy","pattern":"stripe"}'}}};
  const env={AI,APP_TOKEN:'t',ALLOWED_ORIGIN:'https://x.github.io'};
  const req=(tok,body,origin='https://x.github.io',method='POST',p='/')=>new Request('https://w'+p,{method,headers:{'content-type':'application/json',Origin:origin,'x-app-token':tok},body:body&&JSON.stringify(body)});
  let r=await w.fetch(req('t',{image:'data:image/jpeg;base64,AAAA'}),env);ok(r.status===200&&(await r.json()).type==='tie','photo tagging works (and accepts the model licence once)');
  r=await w.fetch(req('bad',{image:'data:image/jpeg;base64,AAAA'}),env);ok(r.status===403,'wrong token is refused');
  r=await w.fetch(req('t',{image:'data:image/jpeg;base64,AAAA'},'https://evil.example'),env);ok(r.status===403,'wrong origin is refused');
  return w;
}

/* ---------- running ---------- */
// every test has a name: a built-in suite is 'run.js: <its title>', a file its file name
const FILES=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort();
/* A file that checks both engines (it takes `engines`: tests/webkit.js) runs as two tests, its Chromium half under its own name and its
   WebKit half as '<file> · WebKit', handed out separately, so the two run side by side in two worker processes (CR-10-02: backgesture's
   two halves one after the other, 390 s, were the whole suite's critical path). The WebKit half isn't recorded (CDP is Chromium's) and
   has no line in tests/impact.map: it runs whenever its file's Chromium half is chosen. Under --webkit a file is one test again */
const WK_HALF=' · WebKit';
const DUAL=WEBKIT?[]:FILES.filter(f=>/module\.exports\s*=\s*async\s*\(\s*\{[^}]*\bengines\b/.test(fs.readFileSync(path.join(__dirname,f),'utf8')));
const halfOf=key=>key.endsWith(WK_HALF)?key.slice(0,-WK_HALF.length):null;
const ALL=[...suites.map(([n])=>'run.js: '+n),'run.js: '+WORKER,...FILES];   // (what the map and the selection know)
const RUNS=[...ALL,...DUAL.map(f=>f+WK_HALF)];   // (what can run)
const withHalves=(keys,wk=()=>true)=>{const s=new Set(keys);for(const f of DUAL)if(s.has(f)&&wk(f))s.add(f+WK_HALF);return s};
/* `npm test` runs a dual file's WebKit half only when the change can show on a page (the owner's choice, 2026-11-17): when it touches
   a file the phone gets that draws or styles the page (sw.js ASSETS: index.html, styles.css, the page scripts, the figure's pictures),
   the runner, tests/webkit.js, tests/fixedplan.js or package.json, or the test file itself. The scripts that only compute (the planner,
   the color and pattern math, the merge rules, the Web Workers' entries, sw.js) don't. Unknown changes (`files` null) run it.
   `npm run test:all`, `npm run test:webkit` and a run by name always run it. → {wk: file → bool, why} */
const PURE=new Set(['planner.js','core.js','analysis.js','analysis-worker.js','detect.js','srgb.js','merge.js','migrate.js','asm-worker.js','sw.js']);
const WK_HARNESS=new Set(['tests/run.js','tests/webkit.js','tests/fixedplan.js','package.json']);
const pageFiles=()=>{try{const m=/const ASSETS=\[([^\]]*)\]/.exec(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'));return new Set([...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]).filter(f=>f!=='./'&&!PURE.has(f)))}catch(e){return null}};
const webkitWanted=files=>{
  if(process.env.TEST_WEBKIT==='1')return {wk:()=>true,why:'TEST_WEBKIT=1'};
  if(process.env.TEST_WEBKIT==='0')return {wk:()=>false,why:'TEST_WEBKIT=0'};
  if(!files)return {wk:()=>true,why:'what changed is not known'};
  const P=pageFiles(),ui=files.filter(f=>WK_HARNESS.has(f)||(P?P.has(f):/^[^/]+\.(?:html|css|js)$/.test(f)&&!PURE.has(f)));
  if(ui.length)return {wk:()=>true,why:'the change touches '+ui.slice(0,6).join(', ')+(ui.length>6?' and '+(ui.length-6)+' more':'')};
  const own=new Set(files.filter(f=>/^tests\/[^/]+\.test\.js$/.test(f)).map(f=>f.slice(6)));
  return {wk:f=>own.has(f),why:'the change touches no page file'+(own.size?' (only an edited test file\'s own WebKit half runs)':'')+': `npm run test:webkit` or `npm run test:all` runs WebKit',own}};
const label=key=>key.startsWith('run.js: ')?key.slice(8):key;

/* What one process needs to run tests one after another: the local server, one Chromium for every test (a file's
   chromium.launch() gets a view of it whose close() closes only the contexts that file opened: launching a browser per file
   cost about half a second each) and the recorder of what each test uses. With several tests at once, each worker process
   (below) has its own set of these, so no two tests ever share a server, a browser, a recorder or Node's coverage. */
const FIXED_PLAN=path.join(__dirname,'fixedplan.js');
const ASM_OFF={content:'window.ASM_TEST_OFF=true'};   // assembled pictures off in a test page (assemble.js ASM_ON)
const REAL_SUITES=new Set(['renders the outfit without errors','planner: independent outfit checklist','planner: shoes, belts, leather and metals','outfit score']);
const bench=async(eager=true)=>{
  const url=`http://127.0.0.1:${await require('./safeport').listenSafe(server,'127.0.0.1')}/index.html`;   // (never a port Chromium refuses: tests/safeport.js)
  // the process's browser starts while the recorder loads the worker (`prepare`), not when the first test asks for it: the two took
  // one after the other about 1–2 s of every worker's start-up. (A promise is kept, so two asking at once get one browser)
  let shared=null,sharedP=null;const browserOf=()=>sharedP||(sharedP=(async()=>shared=WEBKIT?require('./webkit').wrapBrowser(await require('playwright').webkit.launch()):await chromium.launch())().catch(e=>{sharedP=null;throw e}));
  if(eager)browserOf().catch(()=>{});
  if(!process.env.NO_IMPACT){rec=impact.recorder(ROOT);await rec.prepare()}
  // the WebKit half of the files that check both engines (tests/webkit.js engines): one WebKit per process too, shared like Chromium
  // (under --webkit it is the same browser); launched only when a file asks for it
  let sharedWk=null,sharedWkP=null;const webkitOf=()=>WEBKIT?browserOf():sharedWkP||(sharedWkP=(async()=>sharedWk=require('./webkit').wrapBrowser(await require('playwright').webkit.launch()))().catch(e=>{sharedWkP=null;throw e}));
  // the built-in suites get the fixed plan too, except those about the planner and the start-up check, which keeps the real
  // planner so a planner change that breaks start-up is caught by it
  const builtin=async name=>{const browser=await browserOf(),fn=suites.find(([n])=>n===name)[1],fixed=!REAL_SUITES.has(name);
    const ctx=await browser.newContext({...devices['iPhone 13']});if(fixed)await ctx.addInitScript({path:FIXED_PLAN});await ctx.addInitScript(ASM_OFF);if(rec)rec.context(ctx);const page=await ctx.newPage();const errs=[];
    page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await page.goto(url);await page.waitForFunction(()=>window.appReady);
    // a suite's own contexts are recorded too
    const b=new Proxy(browser,{get:(t,k)=>k==='newContext'?async o=>{const c=await t.newContext(o);if(fixed)await c.addInitScript({path:FIXED_PLAN});await c.addInitScript(ASM_OFF);if(rec)rec.context(c);return c}:typeof t[k]==='function'?t[k].bind(t):t[k]});
    try{await fn({page,ctx,browser:b,url,errs})}catch(e){failures++;console.log('  ✗ threw: '+e.message)}
    if(errs.length&&name!=='renders the outfit without errors'){failures++;console.log('  ✗ console errors: '+errs.join('; '))}
    await ctx.close()};
  // the fixed plan (fixedplan.js) goes into every page of a test file unless the file says module.exports.realPlanner=true: a
  // test that doesn't need the planner's choices then doesn't run the planner, and a planner change doesn't select it
  const file=async key=>{const f=halfOf(key)||key,half=halfOf(key)?'WebKit':DUAL.includes(f)?'Chromium':null;
    const browser=await browserOf(),mine=new Set(),mod=require(path.join(__dirname,f)),fixed=!mod.realPlanner;
    // assembled pictures (assemble.js) are switched off too unless the file says module.exports.assembled=true (ASM_TEST_OFF)
    const asmOff=!mod.assembled;
    // (the recorder is Chromium's: CDP coverage; a WebKit context gets the fixed plan and the painter off, as Chromium's does: CR-10-02)
    const track=async(c,wk)=>{c=await c;if(fixed)await c.addInitScript({path:FIXED_PLAN});if(asmOff)await c.addInitScript(ASM_OFF);if(rec&&!wk&&!WEBKIT)rec.context(c);mine.add(c);return c};
    const view=(t,wk)=>new Proxy(t,{get:(t,k)=>k==='close'?async()=>{for(const c of mine)await c.close().catch(()=>{});mine.clear()}
      :k==='newContext'?o=>track(t.newContext(o),wk):k==='newPage'?async o=>{const c=await track(t.newContext(o),wk);return c.newPage()}
      :typeof t[k]==='function'?t[k].bind(t):t[k]});
    const b=view(browser,false);let wb=null;
    const chr=new Proxy(chromium,{get:(t,k)=>k==='launch'?async()=>b:t[k]});
    const wk={launch:async()=>wb||(wb=view(await webkitOf(),true))};
    const engines=require('./webkit').engines(chr,wk).filter(([n])=>!half||n===half);
    try{await mod({ok,url,chromium:chr,engines,devices,WARDROBES,ROOT,settle,impactRec:rec})}catch(e){failures++;console.log('  ✗ threw: '+e.message)}
    finally{await b.close()}};
  return {
    /* one test, noting what it uses → {ms, res: {m, bad} or null} */
    async run(key){const t0=Date.now();let res=null;const r=rec&&!halfOf(key);   // (a WebKit half isn't recorded)
      if(r)await rec.begin(key,key.startsWith('run.js: ')?null:'tests/'+key);
      try{if(key==='run.js: '+WORKER){try{await workerTests()}catch(e){failures++;console.log('  ✗ worker tests threw: '+e.message)}}
        else if(key.startsWith('run.js: '))await builtin(key.slice(8));else await file(key)}
      finally{if(r)res=await rec.end().catch(()=>({m:new Map(),bad:true}))}
      return {ms:Date.now()-t0,res}},
    async close(){if(sharedP)await sharedP.catch(()=>{});if(shared)await shared.close().catch(()=>{});if(sharedWk)await sharedWk.close().catch(()=>{});server.close()}}};

/* how long each test took last time (kept beside node_modules, never committed): the slow ones start first */
const TIMES=path.join(ROOT,'node_modules','.cache','dw-test-times.json');
const lastTimes=()=>{try{return JSON.parse(fs.readFileSync(TIMES,'utf8'))}catch(e){return {}}};
const keepTimes=times=>{try{fs.mkdirSync(path.dirname(TIMES),{recursive:true});fs.writeFileSync(TIMES,JSON.stringify({...lastTimes(),...Object.fromEntries(times)}))}catch(e){}};
/* how many at once: one fewer than the processor cores (each test is a Node process and a Chromium with its own helpers).
   With one per core, on 4 cores, a check that waits a fixed time failed in each of three runs; with one fewer, none did */
const jobsWanted=()=>{const n=parseInt(process.env.TEST_JOBS,10);return n>=1?n:Math.max(1,Math.min(16,(os.availableParallelism?os.availableParallelism():os.cpus().length)-1))};   // one fewer than the cores: four at a time on four cores starved pages (a 30 s page load) once the suite passed 2000 checks; at most 16: on 32 threads 16 took 27 s, 28 took 26–52 s with a test failing under load

/* a worker process (`node tests/run.js --worker`, started by the parent below): it runs the tests it is handed, one at a
   time, keeps what each prints and sends it back whole with the counts and what the test used */
const worker=async()=>{
  // the parent gone (Ctrl+C, killed, crashed): leave too, which closes this process's browsers (Playwright kills them on exit),
  // instead of running on without anyone to report to and holding the machine
  process.on('disconnect',()=>process.exit(1));
  const B=await bench();let out=null;   // null between tests: anything printed then goes straight out
  for(const k of ['stdout','stderr']){const w=process[k].write.bind(process[k]);process[k].write=(d,...a)=>{if(out==null)return w(d,...a);out+=typeof d==='string'?d:Buffer.from(d).toString();const cb=a[a.length-1];if(typeof cb==='function')cb();return true}}
  let chain=Promise.resolve(),cur=null,last=null;
  /* a promise that fails with nobody waiting for it used to stop the whole process ("the test process stopped"), which named
     no culprit: now it fails the test it happened in, with its stack. One that fails after its test ended is told to the parent */
  process.on('unhandledRejection',e=>{const why=String(e&&e.stack||e).split('\n').slice(0,6).join('\n    ');
    if(cur){failures++;console.log('  ✗ a promise failed with nothing waiting for it: '+why);return}
    process.send({late:true,out:'\n  ✗ a promise failed with nothing waiting for it, after '+(last?label(last):'start-up')+' had finished: '+why+'\n'})});
  process.on('message',m=>{
    // the parent's per-test time limit ran out (`together`): hand back what the test printed so far and leave, which closes this
    // process's browsers (not queued behind the test: that is what hangs)
    if(m.abort){const text=out||'';out=null;try{process.send({partial:text},()=>process.exit(1))}catch(e){process.exit(1)}setTimeout(()=>process.exit(1),3000).unref();return}
    chain=chain.then(async()=>{
    if(m.exit){out=null;await B.close();process.exit(0)}
    out='';passes=0;failures=0;cur=m.run;const r=await B.run(m.run);
    // (a rejection is reported on the next turn of the event loop: give one that the test's last step caused that turn)
    await new Promise(res=>setImmediate(res));cur=null;last=m.run;
    const text=out;out=null;process.send({key:m.run,out:text,passes,failures,ms:r.ms,res:r.res&&{bad:r.res.bad,m:[...r.res.m].map(([f,S])=>[f,[...S]])}})})});
  process.send({ready:true})};

const RETRY_MAX=5;
/* several tests at once: `n` worker processes take the tests from one queue, slowest first. Each test's lines are printed
   together when it finishes */
/* A test that runs longer than TEST_FILE_TIMEOUT seconds (900; 0 = no limit) fails "timed out after N s" with what it printed so far,
   and its worker process is ended (its browsers with it) and replaced (2026-11-17: on a machine crowded by other sessions' runs, single
   workers sat at no CPU for 20–30 minutes and the run never ended). The slowest test took 477 s on that crowded machine */
const FILE_LIMIT=(n=>Number.isFinite(n)&&n>=0?n:900)(parseFloat(process.env.TEST_FILE_TIMEOUT))*1000;
// (a machine with no times of its own, a cloud runner, orders them by the committed tests/shard-times.json, in seconds)
const together=(keys,n,done)=>new Promise(resolve=>{const last={...Object.fromEntries(Object.entries(require('./shard').readTimes()).map(([k,s])=>[k,s*1000])),...lastTimes()},queue=keys.slice().sort((a,b)=>(last[b]||0)-(last[a]||0)),live=new Set();
  const spawn=()=>{const c=fork(__filename,['--worker'],{env:process.env});let job=null,t0=0,timer=null,timedOut=false,partial='';live.add(c);
    const next=()=>{clearTimeout(timer);job=queue.shift();if(job){t0=Date.now();c.send({run:job});
        if(FILE_LIMIT)timer=setTimeout(()=>{timedOut=true;try{c.send({abort:true})}catch(e){}setTimeout(()=>{try{c.kill()}catch(e){}},10e3).unref()},FILE_LIMIT)}
      else{c.send({exit:true})}};
    c.on('message',m=>{if(m.ready){next();return}if(m.late){process.stdout.write(m.out);failures++;return}if('partial' in m){partial=m.partial;return}
      if(timedOut)return;
      job=null;done(m.key,m.out,m.passes,m.failures,m.ms,m.res&&{bad:m.res.bad,m:new Map(m.res.m.map(([f,L])=>[f,new Set(L)]))});next()});
    // a worker that dies takes its test with it: that test has failed, and another worker takes its place
    c.on('exit',code=>{clearTimeout(timer);live.delete(c);if(job){done(job,partial+(timedOut?'  ✗ timed out after '+Math.round((Date.now()-t0)/1000)+' s (TEST_FILE_TIMEOUT='+FILE_LIMIT/1000+'): its worker process and browsers were ended\n':'  ✗ the test process stopped (exit code '+code+')\n'),0,1,Date.now()-t0,{m:new Map(),bad:true});if(queue.length)spawn()}
      if(!live.size)resolve()})};
  for(let i=0;i<Math.min(n,queue.length);i++)spawn()});

(async()=>{
  if(process.argv.includes('--worker')){await worker();return}
  if(process.argv.includes('--keys')){console.log(JSON.stringify(RUNS));return}   // every test, in run order (tests/shard.js)
  const args=process.argv.slice(2),flag=f=>args.includes(f);
  // --shard i/N (or TEST_SHARD=i/N): only shard i of N of the tests chosen (tests/shard.js; the cloud run, full-tests.yml)
  const shardArg=(()=>{const j=args.findIndex(a=>a==='--shard'||a.startsWith('--shard='));if(j<0)return process.env.TEST_SHARD||null;
    const v=args[j].includes('=')?args[j].split('=')[1]:args[j+1];if(!args[j].includes('='))args.splice(j+1,1);return v})();
  const SHARD=shardArg?require('./shard').parse(shardArg):null;
  if(shardArg&&!SHARD){console.log(`--shard ${shardArg}: give it as i/N, 1 ≤ i ≤ N (e.g. --shard 2/8)`);process.exit(2)}
  const ONLY=process.env.TEST_ONLY||args.find(a=>!a.startsWith('--'));
  let want=null;   // null: everything
  if(ONLY)want=withHalves(FILES.filter(f=>f.includes(ONLY)),()=>process.env.TEST_WEBKIT!=='0');
  else if(flag('--changed')){const s=await impact.select(ROOT,ALL);console.log(s.report);
    if(DUAL.length){const W=webkitWanted(s.files||null),sel=s.all?DUAL:DUAL.filter(f=>s.tests.includes(f)),on=sel.filter(W.wk);
      if(sel.length)console.log(on.length===sel.length?`WebKit: the WebKit halves of ${on.length} file${on.length>1?'s':''} run (${W.why}).`
        :`WebKit: ${on.length?'only '+on.join(', ')+' runs its WebKit half':'the WebKit halves of '+sel.join(', ')+' do not run'} (${W.why}).`);
      want=withHalves(s.all?ALL:s.tests,W.wk)}
    else if(!s.all)want=withHalves(s.tests)}
  if(flag('--list'))return;
  impact.installHook(ROOT);   // from now on a push is refused while tests/impact.map has uncommitted changes
  let keys=RUNS.filter(k=>!want||want.has(k));const results=new Map(),times=[];
  if(SHARD){const S=require('./shard'),mine=S.plan(keys,SHARD.n,S.readTimes(),S.wkShards())[SHARD.i-1];keys=mine.keys;
    console.log(`\nshard ${SHARD.i}/${SHARD.n}: ${keys.length} of ${RUNS.filter(k=>!want||want.has(k)).length} tests (about ${Math.round(mine.est)} s by tests/shard-times.json)`)}
  // one test run at a time on this machine (tests/testlock.js): wait for another worktree's run, or go ahead with fewer at once
  let jobs=Math.min(jobsWanted(),keys.length);
  if(keys.length){const L=require('./testlock'),g=await L.acquire(ROOT);if(g.note)console.log('\n'+g.note);
    if(!(parseInt(process.env.TEST_JOBS,10)>=1)&&jobs>1){if(g.cap&&g.cap<jobs)jobs=g.cap;
      if(g.how!=='off'&&jobs>2){const b=await L.busyCap(jobs);if(b){console.log(`\nthe machine is already busy (${Math.round(b.busy*100)}% of the processors in use): ${b.cap} at a time instead of ${jobs} (TEST_JOBS=<n> sets it)`);jobs=b.cap}}}}
  const T0=Date.now();
  const alone=[];   // tests that only passed on a second run by themselves
  if(jobs>1){const again=[],count=(key,out,p,f,ms,res)=>{process.stdout.write(out);passes+=p;failures+=f;times.push([key,ms]);if(res)results.set(key,{...res,ok:!f})};
    await together(keys,jobs,(key,out,p,f,ms,res)=>{if(f)again.push([key,out,p,f,ms,res]);else{console.log('\n• '+label(key));count(key,out,p,f,ms,res)}});
    /* The tests were written to run one at a time, and a few checks are sensitive to a busy machine. A test that failed
       while others were running is therefore run once more by itself, which is how it always ran before; only that run
       counts. It is said so loudly, so the check can be made to wait for its condition. With more than RETRY_MAX failures
       the cause is not the load: they count as they are */
    if(again.length&&again.length<=RETRY_MAX){const first=new Map(again.map(a=>[a[0],a]));
      await together(again.map(a=>a[0]),1,(key,out,p,f,ms,res)=>{
        console.log('\n• '+label(key)+'\n  (failed while other tests were running:\n'+first.get(key)[1].split('\n').filter(l=>/^  ✗/.test(l)).map(l=>'  '+l).join('\n')+'\n   run again by itself:)');
        if(!f)alone.push(key);count(key,out,p,f,ms,res)})}
    else for(const a of again){console.log('\n• '+label(a[0]));count(...a)}
  }else if(keys.length){const B=await bench();let cur=null;
    process.on('unhandledRejection',e=>{failures++;console.log('  ✗ a promise failed with nothing waiting for it'+(cur?'':' (between tests)')+': '+String(e&&e.stack||e).split('\n').slice(0,6).join('\n    '))});
    for(const key of keys){console.log('\n• '+label(key));cur=key;const f0=failures,r=await B.run(key);cur=null;times.push([key,r.ms]);if(r.res)results.set(key,{...r.res,ok:failures===f0})}
    await B.close()}
  keepTimes(times);
  // TEST_TIMES_OUT=<file>: each test's seconds and the run's, for the cloud run's summary (tests/shard.js, tests/shard-times.json)
  if(process.env.TEST_TIMES_OUT)try{fs.writeFileSync(process.env.TEST_TIMES_OUT,JSON.stringify({times:Object.fromEntries(times.map(([k,ms])=>[k,Math.round(ms/100)/10])),wall:Math.round((Date.now()-T0)/1000)}))}catch(e){console.log('could not write '+process.env.TEST_TIMES_OUT+': '+e.message)}
  // what each test used is added to tests/impact.map; when `npm test` or the whole suite passed, so is the fingerprint of the files it passed on
  // (not for one shard: it passed only part of the suite)
  const passed=!failures&&!ONLY&&!SHARD;
  // which tests ran with the fixed plan (their planner.js entries are replaced in the map, not added to)
  // the files a test ran with switched off (the fixed plan: planner.js; assembled pictures off: assemble.js): their entries are replaced
  const fixedOf=key=>{if(key.startsWith('run.js: '))return REAL_SUITES.has(key.slice(8))?['assemble.js']:['planner.js','assemble.js'];
    const src=fs.readFileSync(path.join(__dirname,key),'utf8'),out=[];
    if(!/module\.exports\.realPlanner\s*=\s*true/.test(src))out.push('planner.js');if(!/module\.exports\.assembled\s*=\s*true/.test(src))out.push('assemble.js');return out};
  if(!process.env.NO_IMPACT&&(results.size||passed))try{await impact.save(ROOT,results,ALL,passed,fixedOf)}catch(e){console.log('could not write '+impact.MAP+': '+e.message)}
  // the slowest files, so the suite can be kept quick
  if(times.length)console.log('\nslowest: '+times.sort((a,b)=>b[1]-a[1]).slice(0,10).map(([f,ms])=>`${label(f)} ${(ms/1000).toFixed(1)}s`).join(', ')+` · total ${((Date.now()-T0)/1000).toFixed(0)}s`+(jobs>1?` (${jobs} at a time; one after another ${(times.reduce((a,t)=>a+t[1],0)/1000).toFixed(0)}s)`:''));
  if(alone.length)console.log('\nfailed with other tests running, passed by '+(alone.length>1?'themselves':'itself')+' (a check there depends on timing: make it wait for its condition): '+alone.map(label).join(', '));
  console.log(`\n${passes} passed, ${failures} failed`+(alone.length?`, ${alone.length} flaky (passed on retry)`:'')+(want?` (${keys.length} of ${ALL.length} test files and built-in suites)`:'')+(SHARD?` (shard ${SHARD.i}/${SHARD.n}: ${keys.length} tests)`:''));process.exit(failures?1:0);
})();
