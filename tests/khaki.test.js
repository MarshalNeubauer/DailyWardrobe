// Khaki: a light chino colour for trousers (and any non-shirt item), lighter than tan; the planner treats it as the tan family,
// the tagger knows it, and its item picture asks for cotton twill.
const path=require('path'),fs=require('fs');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>({pants:COLOR_OPTS('pants').some(x=>x[0]==='khaki'),shirt:COLOR_OPTS('shirt').some(x=>x[0]==='khaki'),
      norm:['Khaki','chino','stone'].map(c=>normColFor('pants',c)).join(),camel:normCol('camel'),
      lighter:lumOf('khaki')>lumOf('tan')+10,fam:fam('khaki'),belt:leatherGroup('khaki'),
      desc:itemDesc({type:'pants',primaryColor:'khaki',pattern:'solid'}),wool:itemDesc({type:'pants',primaryColor:'tan',pattern:'solid'})}));
    ok(r.pants&&r.shirt,'khaki is offered as a colour');
    ok(r.norm==='khaki,khaki,khaki'&&r.camel==='tan','khaki, chino and stone tag as khaki; camel stays tan');
    ok(r.lighter&&r.fam==='tan'&&r.belt==='tan','khaki is lighter than tan and follows the tan rules');
    ok(/khaki cotton twill dress trousers/.test(r.desc)&&/tan wool dress trousers/.test(r.wool),'the khaki item picture asks for cotton twill');
    // a blazer day with a navy blazer wears the khaki trousers
    const bot=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('blazer','navy'),I('pants','khaki'),I('pants','black'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),
        I('shoes','brown',{leather:'calf'}),I('shoes','black',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};view={y:2026,m:10};
      const o=planFor()['2026-11-12'];return o&&o.bot&&o.bot.primaryColor});
    ok(bot==='khaki','a navy blazer is paired with the khaki trousers ('+bot+')');
    const w=fs.readFileSync(path.join(ROOT,'worker.js'),'utf8');
    ok(/brown, tan, khaki, olive/.test(w)&&/khaki is the light sandy beige/.test(w),'the tagging prompt lists and explains khaki');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
