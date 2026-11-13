// The same tie is not planned again within three workdays (the owner's choice, 2026-11-13: one tie on Dec 6 and Dec 8 cost only 4, two
// workdays back); the score names a repeat three workdays back. Tie colours keep their own two-day rule.
module.exports=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};
      const seq=[];for(const [y,m] of [[2026,10],[2026,11],[2027,0]]){const P=planMonth(y,m);for(const k of Object.keys(P).sort((a,b)=>keyDate(a)-keyDate(b)))if(keyDate(k)>=todayDate()&&P[k].tie)seq.push({k,o:P[k]})}
      const near=[];for(let a=0;a<seq.length;a++)for(let g=1;g<=3&&a+g<seq.length;g++)if(seq[a].o.tie.id===seq[a+g].o.tie.id)near.push(seq[a].k+'+'+g);
      const ties=new Set(seq.map(x=>x.o.tie.id)).size;
      // the score: a tie worn three workdays back
      const o=seq[5].o,s=rateOutfit({...o,ctx:{...o.ctx,prev:[o.ctx.prev[0],o.ctx.prev[1]],prev3:{tid:o.tie.id}}}).checks.find(c=>c.label==='Variety');
      // the case that repeated on the owner's wardrobe: a day's own best tie worn two or three workdays before it (fixed there by hand)
      const wd=seq.map(x=>x.k),pin=[];for(const [i,g] of [[12,2],[20,2],[28,3],[36,3]]){dayRecs={};cache={};const b0=planMonth(2026,11);const a=wd[i],b=wd[i-g],x=(b0[a]||planMonth(2027,0)[a]).tie.id;
        dayRecs[b]={date:b,force:{tie:x}};cache={};const pl={...planMonth(2026,10),...planMonth(2026,11),...planMonth(2027,0)};pin.push({a,g,kept:pl[b].tie.id===x,again:pl[a].tie.id===x})}
      // few ties (four: just enough for three workdays apart): the rule has to hold the strongest match back
      const keep=W.realistic.filter(i=>i.type==='tie').slice(0,4).map(i=>i.id);items=W.realistic.filter(i=>i.type!=='tie'||keep.includes(i.id));dayRecs={};cache={};
      const s4=[];for(const [y,m] of [[2026,10],[2026,11]]){const P=planMonth(y,m);for(const k of Object.keys(P).sort((a,b)=>keyDate(a)-keyDate(b)))if(keyDate(k)>=todayDate()&&P[k].tie)s4.push(P[k].tie.id)}
      let few=0;for(let a=0;a<s4.length;a++)for(let g=1;g<=3&&a+g<s4.length;g++)if(s4[a]===s4[a+g])few++;
      items=W.realistic;dayRecs={};cache={};
      return {days:seq.length,near,ties,pin,few,fewDays:s4.length,owned:items.filter(i=>i.type==='tie').length,why:s&&s.why,pts:s&&s.pts}})()`);
    ok(r.days>40&&r.near.length===0,`over ${r.days} workdays no tie comes back within three workdays (${r.near.join(', ')||'none'})`);
    for(const x of r.pin)ok(x.kept&&!x.again,`a day's best tie, worn ${x.g} workdays before it, is not planned again on ${x.a}`);
    // (16 before the rule; a few stay: not every tie suits every jacket, and a hard mismatch costs more than a repeat)
    ok(r.few<=4&&r.fewDays>30,`with only four ties a tie comes back within three workdays at most a few times (${r.few} in ${r.fewDays} days; 16 before)`);
    ok(r.ties>=r.owned-2,`the ties still rotate (${r.ties} of ${r.owned} worn)`);
    ok(/three workdays ago/.test(r.why||'')&&r.pts<5,`the score names a tie worn three workdays back (${r.why})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses, not the fixed test plan
