// The day's pieces list: names, photos.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/daypieces.test.js ---- */
// Day view: the pieces list folds into a box of fabric chips (unfolds in place), the swap card sits between the score and that box,
// and a back-to-today button (date bar pill and the Today tab) returns from any other day or month.
const daypieces=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'pink'}),
        I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-09T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,9);HOOK.view={y:2026,m:10};HOOK.listOpen=false;show('today')});
    const c=await p.evaluate(()=>{const box=$('#ibox'),o=planFor()[key(sel)],side=[...document.querySelector('.side').children].map(e=>e.id||e.className.split(' ')[0]);
      const n=['top','shirt','tie','clip','watch','belt','socks','shoes','links','coat'].filter(s=>o[s]).length+(o.vest?1:0)+(!o.suitDay&&o.bot?1:0);
      return {open:box.classList.contains('open'),chips:box.querySelectorAll('.pchip').length,n,h:Math.round($('#ipanel').getBoundingClientRect().height),txt:box.querySelector('.mltxt').textContent,
        exp:box.querySelector('.month-link').getAttribute('aria-expanded'),side,inStage:!!document.querySelector('#stage #piece'),card:!!document.querySelector('#piece')}});
    ok(!c.open&&c.exp==='false'&&c.h===0,'the pieces list starts folded');
    const rows=await p.evaluate(()=>{const ys=[...document.querySelectorAll('#ibox .pchip')].map(e=>Math.round(e.getBoundingClientRect().top));const m={};ys.forEach(y=>m[y]=(m[y]||0)+1);return Object.values(m)});
    ok(rows.length<=2&&Math.max(...rows)-Math.min(...rows)<=1,`the chips are spread evenly over the rows (${rows.join(' + ')})`);
    ok(c.chips===c.n&&c.chips>=7,`the folded box shows one fabric chip per piece (${c.chips})`);
    ok(new RegExp(`^${c.n} pieces`).test(c.txt)&&/suit · .* shirt · .* tie/i.test(c.txt),`and names the suit, shirt and tie (${c.txt})`);
    ok(c.side.indexOf('piece-wrap')<0&&c.side.indexOf('ibox')===c.side.indexOf('sbox')+1&&!c.inStage&&!c.card,`no swap card: the pieces box sits right below the score (${c.side.join(',')})`);
    await p.click('#ibox .month-link');await settle(p,600);
    const o1=await p.evaluate(()=>({open:$('#ibox').classList.contains('open'),h:$('#ipanel').getBoundingClientRect().height,exp:$('#ibox .month-link').getAttribute('aria-expanded'),rows:document.querySelectorAll('#ibox .list .row').length}));
    ok(o1.open&&o1.h>300&&o1.exp==='true'&&o1.rows>=8,`tapping it unfolds the list in place (${Math.round(o1.h)}px, ${o1.rows} rows)`);
    await p.click('#ibox .row button[aria-label="Change tie"]');await p.click('#pick-next');await p.waitForFunction(()=>planFor()[key(sel)].overrides,null,{timeout:5000}).catch(()=>{});
    ok(await p.evaluate(()=>$('#ibox').classList.contains('open')&&planFor()[key(sel)].overrides),'swapping from the list keeps it open');
    await p.click('#ibox .month-link');await settle(p,600);
    ok(await p.evaluate(()=>!$('#ibox').classList.contains('open')&&$('#ipanel').getBoundingClientRect().height<1),'tapping again folds it away');
    // back to today: no button in the date bar (2026-11-14, the owner); the Today tab does it
    await p.evaluate(()=>{HOOK.sel=new Date(2026,11,8);HOOK.view={y:2026,m:11};renderToday()});
    ok(await p.evaluate(()=>!document.querySelector('.gotoday')&&/December 8/.test($('#today .day h2').textContent)),'on another day the date bar has no Today / Next outfit button');
    await p.evaluate(()=>{HOOK.sel=new Date(2026,11,15);HOOK.view={y:2026,m:11};show('wardrobe')});await p.click('#n-today');
    ok(await p.evaluate(()=>key(sel)==='2026-11-9'&&view.m===10&&!$('#today').hidden),'the Today tab returns to today\'s outfit');
    await p.evaluate(()=>{HOOK.sel=new Date(2026,11,8);HOOK.view={y:2026,m:11};renderToday()});await p.click('#n-today');
    ok(await p.evaluate(()=>key(sel)==='2026-11-9'),'also when Today is already the tab on screen');
    await p.evaluate(()=>{HOOK.TODAY_OVERRIDE='2026-11-13T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,11,8);renderToday()});await p.click('#n-today');
    ok(await p.evaluate(()=>key(sel)==='2026-11-15'),'when today is a day off the Today tab goes to the next outfit');
    await p.evaluate(()=>{HOOK.TODAY_OVERRIDE=null;HOOK.cache={}});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/listphoto.test.js ---- */
// Outfit list: tapping a piece's swatch or name unfolds its photo inside the list (one at a time), so you can see exactly
// which shirt it is; pieces without a photo show their drawing with a note; a swap keeps the open piece open.
const listphoto=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(ph=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy',{photo:ph}),I('suit','charcoal',{photo:ph}),I('shirt','white',{photo:ph}),I('shirt','lightblue',{photo:ph}),I('tie','burgundy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.planRules=PLAN_RULES;HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-09T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,10);HOOK.view={y:2026,m:10};HOOK.listOpen=true;HOOK.openRow=null;show('today')},PH);
    const h=s=>p.evaluate(s=>Math.round(document.querySelector('#rp-'+s).getBoundingClientRect().height),s);
    ok(await h('shirt')===0&&await p.evaluate(()=>document.querySelector('#ri-shirt .rowtap').getAttribute('aria-expanded'))==='false','pieces start closed');
    await p.click('#ri-shirt .rowtap .cap');await settle(p,600);
    const a=await p.evaluate(()=>{const o=planFor()[key(sel)],img=document.querySelector('#rp-shirt img.rpic');return {src:img&&img.getAttribute('src')===o.shirt.photo,exp:document.querySelector('#ri-shirt .rowtap').getAttribute('aria-expanded'),inList:!!img&&!!img.closest('#ibox .list')}});
    ok(a.src&&a.exp==='true'&&a.inList&&await h('shirt')>150,'tapping the shirt name unfolds the photo of that exact shirt, inside the list');
    await p.click('#ri-top .rowtap .dot');await settle(p,600);
    ok(await h('top')>150&&await h('shirt')===0,'tapping the suit swatch opens the suit and closes the shirt');
    await p.click('#ri-top .rowtap');await settle(p,600);
    ok(await h('top')===0&&await p.evaluate(()=>HOOK.openRow===null),'tapping it again folds it away');
    await p.click('#ri-tie .rowtap');await settle(p,600);
    ok(await p.evaluate(()=>!!document.querySelector('#rp-tie .rpic.draw svg')&&/No photo of this item yet/.test(document.querySelector('#rp-tie').textContent)),'a piece without a photo shows its drawing and says so');
    await p.click('#ri-tie .swap');await p.click('#pick-next');await settle(p,300);
    ok(await p.evaluate(()=>document.querySelector('#ri-tie').classList.contains('open')&&planFor()[key(sel)].overrides),'swapping the open piece keeps it open, now showing the new one');
    ok(await p.evaluate(()=>!!document.querySelector('#ibox .vest-row')||!planFor()[key(sel)].vest),'the vest row is still in the list');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/piecesname.test.js ---- */
// The folded pieces box's line calls a piece by the name the owner gave it, exactly as typed (2026-11-14: "Medium Grey suit", not "mid grey
// worsted suit"); unnamed pieces keep their colour wording; a name is shown as text, never as markup
const piecesname=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',...x});
      const top=I('s','suit','midgrey',{name:'Medium Grey suit'}),shirt=I('h','shirt','lavender'),tie=I('t','tie','black',{name:'<b>My</b> tie'});
      const o={suitDay:true,top,shirt,tie},named=piecesLine(o),plain=piecesLine({suitDay:true,top:{...top,name:''},shirt,tie:{...tie,name:undefined}});
      const box=document.createElement('div');box.innerHTML=HOOK.piecesBox({...o,bot:top,shoes:null});const small=box.querySelector('.mltxt small');
      return {named,plain,shown:small&&small.textContent,markup:!!(small&&small.querySelector('b'))}});
    ok(/^Medium Grey suit · lavender shirt · <b>My<\/b> tie$/.test(r.named),`a named suit and tie are called by their names, as typed ("${r.named}")`);
    ok(/^mid gray suit · lavender shirt · black tie$/i.test(r.plain),`unnamed pieces keep the color wording ("${r.plain}")`);
    ok(/^Medium Grey suit · lavender shirt · <b>My<\/b> tie$/.test(r.shown)&&!r.markup,`the box shows the names as text, never as markup ("${r.shown}")`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['daypieces',daypieces],['listphoto',listphoto],['piecesname',piecesname]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
