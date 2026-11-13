// The day before a workday whose tie and shirt are fixed (an outfit moved there, pieces picked, a day shown and locked) avoids that tie
// and shirt like it avoids the workday before's (fixedAhead's nx). Found 2026-11-13: an outfit moved from Nov 23 to Nov 24, and
// Nov 23, planned afresh, took the same black tie and check shirt, since repeats were only checked against the days before.
module.exports=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // as a drag in the month does: the outfit pinned on the next workday (moveRecs), the day it left planned afresh (planWith)
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};
      const base=planMonth(2026,10),out=[];
      for(const [a,b] of [['2026-11-16','2026-11-17'],['2026-11-23','2026-11-24'],['2026-11-24','2026-11-25']]){const pl=planWith(moveRecs(a,b,base),2026,10),prev=pl[a],fixed=pl[b];
        out.push({a,held:fixed.tie.id===base[a].tie.id,tie:prev.tie.id===fixed.tie.id,tieGroup:tieGroup(prev.tie)===tieGroup(fixed.tie),shirt:prev.shirt.id===fixed.shirt.id,
          was:base[a].tie.id+'/'+base[a].shirt.id,now:prev.tie.id+'/'+prev.shirt.id})}
      // the case that repeated on the owner's wardrobe: the next day fixed to exactly the tie and shirt this day would choose (its best
      // match), so only the forward check keeps it off them
      const pin=[];for(const [a,b] of [['2026-11-17','2026-11-18'],['2026-11-24','2026-11-25'],['2026-11-10','2026-11-11']]){dayRecs={};cache={};const b0=planMonth(2026,10),x=b0[a].tie.id,y=b0[a].shirt.id;
        dayRecs[b]={date:b,force:{tie:x,shirt:y}};cache={};const pl=planMonth(2026,10);pin.push({a,keep:pl[b].tie.id===x&&pl[b].shirt.id===y,tie:pl[a].tie.id===x,shirt:pl[a].shirt.id===y,was:x+'/'+y,now:pl[a].tie.id+'/'+pl[a].shirt.id})}
      dayRecs={};cache={};
      return {out,pin}})()`);
    for(const x of r.out)ok(x.held&&!x.tie&&!x.tieGroup&&!x.shirt,`moved ${x.a} onto the next day: that day keeps the tie, the day it left plans another tie (not even its colour) and another shirt (${x.was} -> ${x.now})`);
    for(const x of r.pin)ok(x.keep&&!x.tie&&!x.shirt,`the next day fixed to ${x.a}'s own best tie and shirt: ${x.a} plans others (${x.was} -> ${x.now})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses (planMonth), not the fixed test plan
