// A lopsided wardrobe still rotates its jackets evenly (2026-11-14, the audit's walkthrough: three grey suits and one brown, and the brown
// one was planned 35 times in six months against 19-20 for each grey, every other suit day, because a grey after a grey cost the full
// JKT_SAME). The same-group cost is scaled by how avoidable the repeat is (planner.js topGw: the other jackets over the group's own, at most
// 1), so a wardrobe whose groups are balanced keeps the full rule: no two workdays running in one colour group.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      const base=[I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),I('tie','gold'),I('tie','silver'),
        I('shoes','black',{leather:'calf'}),I('shoes','black',{leather:'calf',shoeStyle:'derby'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal')];
      const run=jk=>{items=[...base,...jk];settings.workdays=[0,1,2,3,4];settings.blazerDays=[];settings.vestMode='never';weather={};climate=null;dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};
        const seq=[];for(let m=10;m<16;m++){const pl=buildPlan(2026+Math.floor(m/12),m%12);for(const [d,o] of Object.entries(pl))if(keyDate(d).getMonth()===m%12&&keyDate(d)>=todayDate()&&o.top)seq.push(o.top)}
        const n={};seq.forEach(t=>n[t.id]=(n[t.id]||0)+1);const groupRep=seq.filter((t,i)=>i&&jacketGroup(seq[i-1])===jacketGroup(t)).length;
        return {n:jk.map(j=>n[j.id]||0),days:seq.length,groupRep,gap:Math.min(...jk.map(j=>{let g=1e9,l=-1;seq.forEach((t,i)=>{if(t.id===j.id){if(l>=0)g=Math.min(g,i-l);l=i}});return g}))}};
      // the walkthrough's suits: brown chalk-stripe, charcoal pinstripe, grey herringbone, charcoal plain
      const lop=run([I('suit','brown',{pattern:'chalk-stripe',secondaryColor:'cream'}),I('suit','charcoal',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','grey',{pattern:'herringbone'}),I('suit','charcoal')]);
      // balanced: two grey, two navy
      const bal=run([I('suit','charcoal'),I('suit','grey'),I('suit','navy'),I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'})]);
      return {lop,bal}});
    const L=r.lop,avg=L.days/4,spread=Math.max(...L.n)/Math.min(...L.n);
    ok(L.n[0]<=avg*1.15,`three grey suits and one brown: the brown one is planned about its share, ${L.n[0]} of ${L.days} suit days (a quarter is ${Math.round(avg)}; it was 35 of 94 before)`);
    ok(spread<=1.3,`and the four suits within 30% of each other (${L.n.join(', ')}; grey after grey on ${L.groupRep} of ${L.days} days; a suit back after ${L.gap} suit days at the soonest)`);
    ok(r.bal.groupRep===0,`a balanced wardrobe (two grey, two navy) keeps the full rule: no two suit days running in one colour group (${r.bal.groupRep}; ${r.bal.n.join(', ')})`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
