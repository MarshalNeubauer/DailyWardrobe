// Deep taupe: a suiting colour (suits, blazers, trousers), darker and greyer than taupe. It has its own swatch and name,
// the tagger is told about it, shop names map to it, and the planner treats it as a brown (shoes, ties, jacket rotation).
const path=require('path'),fs=require('fs');
module.exports=async({ok,chromium,url,ROOT})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const o=t=>COLOR_OPTS(t).map(x=>x[0]);
      const S=c=>({id:'s'+c,type:'suit',primaryColor:c,pattern:'solid'}),Sh=c=>({id:'h'+c,type:'shoes',primaryColor:c,leather:'calf'});
      const dt=S('deeptaupe');
      return {suit:o('suit').includes('deeptaupe'),blazer:o('blazer').includes('deeptaupe'),pants:o('pants').includes('deeptaupe'),
        notTie:!o('tie').includes('deeptaupe')&&!o('shirt').includes('deeptaupe'),
        hex:COLORS.deeptaupe,name:colName('deeptaupe'),pretty:prettyCols('a deeptaupe suit'),
        keep:normColFor('suit','deeptaupe'),alias:['Deep Taupe','dark taupe','mink','taupe'].map(c=>normColFor('suit',c)).join(),
        lum:[lumOf('taupe'),lumOf('deeptaupe'),lumOf('black')],
        fam:fam('deeptaupe'),grp:jacketGroup(dt),
        shoes:['brown','black'].map(c=>shoeScore(dt,dt,Sh(c))),
        rules:PLAN_RULES}});
    ok(r.suit&&r.blazer&&r.pants,'deep taupe is offered for suits, blazers and trousers');
    ok(r.notTie,'shirts and ties do not get it');
    ok(/^#[0-9a-f]{6}$/.test(r.hex)&&r.name==='deep taupe'&&r.pretty==='a deep taupe suit','it has a swatch and reads as "deep taupe"');
    ok(r.keep==='deeptaupe'&&r.alias==='deeptaupe,deeptaupe,deeptaupe,taupe',`tags and shop names map to it; plain taupe stays taupe (${r.alias})`);
    ok(r.lum[0]>r.lum[1]&&r.lum[1]>r.lum[2],'deep taupe is darker than taupe and lighter than black');
    ok(r.fam==='brown'&&r.grp==='brown','the planner treats deep taupe as a brown (colour family and jacket rotation group)');
    ok(r.shoes[0]>r.shoes[1],`a deep taupe suit prefers brown shoes over black (${r.shoes})`);
    ok(r.rules>=9,'PLAN_RULES was bumped so upcoming days are planned again');
    // a deep taupe suit is planned, drawn and scored
    const d=await p.evaluate(()=>{const I=(id,type,primaryColor,x)=>({id,type,primaryColor,pattern:'solid',...x});
      items=[I('st','suit','deeptaupe'),I('sh','shirt','white'),I('tb','tie','burgundy'),I('tn','tie','navy'),I('bs','shoes','brown',{leather:'calf'}),I('bk','shoes','black',{leather:'calf'}),I('bb','belt','brown',{leather:'calf'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};
      const o=planMonth(2026,10)['2026-11-10'];const div=document.createElement('div');div.innerHTML=figureSvg({suitDay:true,top:items[0],shirt:items[1],tie:items[2]},'q-');
      return {top:o.top&&o.top.id,shoes:o.shoes&&o.shoes.id,drawn:div.innerHTML.includes(COLORS.deeptaupe),score:rateOutfit(o).score}});
    ok(d.top==='st'&&d.shoes==='bs',`the planner dresses a deep taupe suit with brown shoes (${d.top}/${d.shoes})`);
    ok(d.drawn,'the figure draws the deep taupe suit');
    ok(d.score>=6,`the outfit scores reasonably (${d.score})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
  const src=fs.readFileSync(path.join(ROOT,'worker.js'),'utf8');
  ok(/COLOR_LIST = \[[^\]]*'deeptaupe'/.test(src)&&/deeptaupe is a/.test(src),'the tagger may answer deeptaupe and is told what it looks like');
};
