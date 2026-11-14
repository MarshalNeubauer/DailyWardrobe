// Day view: the pieces list folds into a box of fabric chips (unfolds in place), the swap card sits between the score and that box,
// and a back-to-today button (date bar pill and the Today tab) returns from any other day or month.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'pink'}),
        I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=false;show('today')});
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
    await p.evaluate(()=>{sel=new Date(2026,11,8);view={y:2026,m:11};renderToday()});
    ok(await p.evaluate(()=>!document.querySelector('.gotoday')&&/December 8/.test($('#today .day h2').textContent)),'on another day the date bar has no Today / Next outfit button');
    await p.evaluate(()=>{sel=new Date(2026,11,15);view={y:2026,m:11};show('wardrobe')});await p.click('#n-today');
    ok(await p.evaluate(()=>key(sel)==='2026-11-9'&&view.m===10&&!$('#today').hidden),'the Today tab returns to today\'s outfit');
    await p.evaluate(()=>{sel=new Date(2026,11,8);view={y:2026,m:11};renderToday()});await p.click('#n-today');
    ok(await p.evaluate(()=>key(sel)==='2026-11-9'),'also when Today is already the tab on screen');
    await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-13T12:00:00';cache={};sel=new Date(2026,11,8);renderToday()});await p.click('#n-today');
    ok(await p.evaluate(()=>key(sel)==='2026-11-15'),'when today is a day off the Today tab goes to the next outfit');
    await p.evaluate(()=>{TODAY_OVERRIDE=null;cache={}});
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
