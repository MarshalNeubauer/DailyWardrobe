// Jackets: colours and an even rotation of a lopsided wardrobe (the fixed plan; each check calls the planner itself).
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/jacketcolour.test.js ---- */
// Jacket colour variety: no two consecutive workdays (weekends skipped) in the same jacket colour group when the wardrobe
// has another choice; every jacket stays in rotation; a one-colour wardrobe still plans; neighbouring months agree and
// recording past days does not change the plan ahead.
const jacketcolour=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      const base=[I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),I('tie','gold'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),I('socks','charcoal')];
      const jackets=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','navy'),I('suit','lightgrey'),I('suit','midgrey'),I('suit','grey',{pattern:'herringbone'}),I('suit','brown'),I('suit','black'),I('suit','tan'),
        I('blazer','lightgrey'),I('blazer','steelblue'),I('blazer','tan'),I('pants','charcoal'),I('pants','grey'),I('pants','khaki')];
      items=[...base,...jackets];settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];weather={};dayRecs={};TODAY_OVERRIDE='2026-11-09T12:00:00';
      // shirts and ties like the real wardrobe: staples plus a few greys, and several navy and black ties
      base.push(I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','charcoal'),I('shirt','midgrey'),I('shirt','lightgrey'),I('shirt','periwinkle'),I('shirt','lavender'),
        I('tie','navy'),I('tie','black'),I('tie','black',{pattern:'check',secondaryColor:'grey'}),I('tie','deepblue'),I('tie','brown',{pattern:'stripe',secondaryColor:'cream'}));
      items=[...base,...jackets];
      const seq=[];for(let m=10;m<16;m++){const pl=buildPlan(2026+Math.floor(m/12),m%12);for(const [d,o] of Object.entries(pl))if(keyDate(d).getMonth()===m%12&&o.top)seq.push([d,o.top.id,jacketGroup(o.top),shirtGroup(o.shirt),o.tie.id,tieGroup(o.tie),rateOutfit(o).score,jacketGroup(o.top)+'/'+shirtLook(o.shirt)+'/'+tieLook(o.tie)])}
      const after=f=>seq.filter((s,n)=>n&&f(seq[n-1],s)).map(s=>s[0]);
      const shirtRep=after((a,b)=>a[3]===b[3]&&!['white','lightblue'].includes(b[3])),tieSame=after((a,b)=>a[4]===b[4]),tieGroupRep=after((a,b)=>a[5]===b[5]);
      // the same look (jacket colour, shirt look, tie look) within two workdays
      const lookRep=seq.filter((x,n)=>[1,2].some(b=>n>=b&&seq[n-b][7]===x[7])).map(x=>x[0]+' '+x[7]);
      const tieUse={};seq.forEach(s=>tieUse[s[4]]=(tieUse[s[4]]||0)+1);
      // each jacket's wearings: the same tie with the same shirt colour should not come back on the next wearing
      const byTop={};seq.forEach(x=>(byTop[x[1]]=byTop[x[1]]||[]).push(x[4]+'/'+x[3]));let comboRep=0,wear=0,distinct=0;
      for(const a of Object.values(byTop)){distinct+=new Set(a).size;for(let i=1;i<a.length;i++){wear++;if(a[i]===a[i-1])comboRep++}}const tieIds=base.filter(i=>i.type==='tie').map(i=>i.id);
      const same=after((a,b)=>a[2]===b[2]);
      const used={},gap={},last={};seq.forEach(([d,id],n)=>{used[id]=(used[id]||0)+1;if(last[id]!==undefined)gap[id]=Math.max(gap[id]||0,n-last[id]);last[id]=n});
      const jk=jackets.filter(j=>j.type!=='pants');
      // a one-colour wardrobe still gets planned (repeats allowed)
      items=[...base,I('suit','lightgrey'),I('suit','midgrey'),I('suit','grey'),I('blazer','grey'),I('pants','charcoal')];
      const grey=buildPlan(2026,11),greyDays=Object.entries(grey).filter(([d,o])=>keyDate(d).getMonth()===11&&o.top).length;
      // consistency: neighbouring months agree; recording past days leaves the future alone
      items=[...base,...jackets];dayRecs={};
      const N=buildPlan(2026,10),D=buildPlan(2026,11);const dis=Object.keys(D).filter(k=>N[k]&&D[k].top&&JSON.stringify(idsOf(N[k]))!==JSON.stringify(idsOf(D[k])));
      const T=todayDate();for(const [d,o] of Object.entries(N))if(keyDate(d)<T&&o.top)dayRecs[d]={date:d,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest};
      const N2=buildPlan(2026,10),moved=Object.keys(N2).filter(k=>keyDate(k)>=T&&N2[k].top&&JSON.stringify(idsOf(N[k]))!==JSON.stringify(idsOf(N2[k])));
      return {lookRep,comboRep,wear,distinct,shirtRep,tieSame,tieGroupRep,tiesUnused:tieIds.filter(t=>!tieUse[t]).length,minScore:Math.min(...seq.map(x=>x[6])),n:seq.length,same,unused:jk.filter(j=>!used[j.id]).map(j=>j.primaryColor),maxSuit:Math.max(...jk.filter(j=>j.type==='suit').map(j=>gap[j.id]||0)),maxBlazer:Math.max(...jk.filter(j=>j.type==='blazer').map(j=>gap[j.id]||0)),greyDays,dis,moved,
        groups:['lightgrey','midgrey','grey','darkgrey','charcoal','navy','darknavy','deepblue','steelblue','tan','khaki','brown'].map(c=>jacketGroup({primaryColor:c})).join()}});
    ok(r.groups==='grey,grey,grey,grey,grey,navy,navy,navy,blue,tan,tan,brown',`colour groups read like the eye does: every grey from light grey to charcoal is one (${r.groups})`);
    ok(r.n>100&&r.same.length===0,`over six months no two consecutive workdays share a jacket colour group (${r.same.length} of ${r.n}: ${r.same.slice(0,4).join(' ')})`);
    ok(r.shirtRep.length===0,`no shirt colour group (e.g. dark grey then light grey) on consecutive workdays, apart from white and light blue (${r.shirtRep.join(' ')})`);
    // (2026-11-14: with JKT_SAME raised from 40 this nine-tie wardrobe meets a squeeze three times in six months, e.g. a black suit after a brown
    // one when its other good ties were all worn in the last three workdays: one tie-colour repeat each time. On the owner's real wardrobe the
    // same change took tie-colour repeats over 124 workdays from 1 to 0. Held at 3 so it can't get worse unnoticed)
    ok(r.tieSame.length===0&&r.tieGroupRep.length<=3,`never the same tie on consecutive workdays, and the same tie colour at most in the 3 known squeezes (${r.tieSame.length} / ${r.tieGroupRep.length}: ${r.tieGroupRep.join(' ')})`);
    ok(r.tiesUnused===0,'every tie gets worn');
    ok(r.lookRep.length===0,`no look (jacket colour, light or dark shirt, tie colour family) comes back within two workdays (${r.lookRep.slice(0,4).join(' | ')})`);
    ok(r.comboRep===0&&r.distinct>=r.wear*.6,`a jacket is not worn with the same tie and shirt colour on its next wearing (${r.comboRep} of ${r.wear}; ${r.distinct} distinct combinations)`);
    ok(r.minScore>=80,`variety never costs a good outfit (lowest score ${r.minScore})`);
    ok(!r.unused.length&&r.maxSuit<=14&&r.maxBlazer<=20,`every jacket stays in rotation: 8 suits on 4 days a week come back within 14 workdays, 3 blazers on 1 day a week within 4 weeks (longest ${r.maxSuit} / ${r.maxBlazer}${r.unused.length?', unused: '+r.unused.join():''})`);
    ok(r.greyDays>=20&&r.greyDays<=23,`a wardrobe of only grey jackets is still planned (${r.greyDays} days in December)`);
    ok(r.dis.length===0,`November and December agree on the days they share (${r.dis.join(' ')})`);
    ok(r.moved.length===0,`recording past days does not change the plan ahead (${r.moved.join(' ')})`);
    // your Nov 17/18 case: a navy suit unworn for weeks must not follow the other navy; a pinned next day is respected
    const c=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:'x'+type+(k++),type,primaryColor,pattern:'solid',...x});
      const navyA=I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),navyB=I('suit','navy'),g1=I('suit','lightgrey'),br=I('suit','brown'),bl=I('suit','black'),tn=I('suit','tan');
      items=[navyA,navyB,g1,br,bl,tn,I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','green'),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),
        I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[];weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';
      // history: navy B last worn in September; the others in early November; navy A pinned for Nov 17
      dayRecs={'2026-9-29':{date:'2026-9-29',ids:{top:navyB.id},suitDay:true,worn:true},'2026-11-17':{date:'2026-11-17',force:{top:navyA.id}}};
      ['2026-11-1','2026-11-2','2026-11-3','2026-11-4','2026-11-5','2026-11-8'].forEach((d,n)=>dayRecs[d]={date:d,ids:{top:[g1,br,bl,tn,g1,br][n].id},suitDay:true,worn:true});
      // the days before are pinned to the other suits (swaps), so navy B builds up weeks of rest
      ['2026-11-9','2026-11-10','2026-11-11','2026-11-12','2026-11-15','2026-11-16'].forEach((d,n)=>dayRecs[d]={date:d,force:{top:[bl,tn,g1,br,bl,tn][n].id}});
      const pl=buildPlan(2026,10),t=d=>pl[d]&&pl[d].top&&pl[d].top.id;
      // a pinned navy on Nov 23: the Sunday before must not be navy
      dayRecs['2026-11-23']={date:'2026-11-23',force:{top:navyB.id}};const pl2=buildPlan(2026,10);
      return {n17:t('2026-11-17')===navyA.id,n18:t('2026-11-18')!==navyB.id&&t('2026-11-16')!==navyB.id,n22:pl2['2026-11-22'].top.primaryColor,n23:pl2['2026-11-23'].top.id===navyB.id}});
    ok(c.n17&&c.n18,'a navy suit left unworn for weeks still does not come right before or after the other navy');
    ok(c.n23&&c.n22!=='navy',`the day before a pinned navy day is not navy (${c.n22})`);
    const JKT_SAME_T=await p.evaluate(()=>HOOK.JKT_SAME);
    const dk=await p.evaluate(()=>{const J=c=>({id:'j'+c,type:'suit',primaryColor:c,pattern:'solid'}),P=c=>({g:jacketGroup(J(c)),c});
      return {bc:HOOK.colourRepeat(J('black'),[P('charcoal')]),bd:HOOK.colourRepeat(J('darkgrey'),[P('black')]),gl:HOOK.colourRepeat(J('lightgrey'),[P('darkgrey')]),bn:HOOK.colourRepeat(J('black'),[P('navy')])}});
    ok(dk.gl===JKT_SAME_T&&dk.bc>=20&&dk.bd>=20&&dk.bn===0,`dark grey then light grey is a repeat; black next to charcoal or dark grey nearly one; black next to navy is fine (${JSON.stringify(dk)})`);
    // your Dec 1 / Dec 3 case: grey suit, black shirt, grey woven tie; then a light grey blazer with a dark navy shirt and a black check tie
    const lk=await p.evaluate(()=>{const I=(type,primaryColor,x={})=>({id:type+primaryColor,type,primaryColor,pattern:'solid',...x});
      const d1={top:I('suit','midgrey',{pattern:'twill'}),shirt:I('shirt','black'),tie:I('tie','grey',{pattern:'woven',secondaryColor:'black'})};
      const prev=[{jg:'navy',sl:'white',tl:'red'},{jg:jacketGroup(d1.top),sl:shirtLook(d1.shirt),tl:tieLook(d1.tie)}],bl=I('blazer','lightgrey');
      return {same:HOOK.lookRepeat(bl,I('shirt','darknavy'),I('tie','black',{pattern:'check',secondaryColor:'grey'}),prev),half:HOOK.lookRepeat(bl,I('shirt','slate'),I('tie','navy'),prev),
        white:HOOK.lookRepeat(bl,I('shirt','white'),I('tie','black'),prev),looks:[shirtLook(I('shirt','navy')),shirtLook(I('shirt','charcoal')),shirtLook(I('shirt','lightblue')),tieLook(I('tie','silver')),tieLook(I('tie','charcoal')),tieLook(I('tie','navy'))].join(),
        sr:HOOK.shirtRepeat(I('shirt','darknavy'),[{sg:'black',sl:'dark'}]),tr:HOOK.tieRepeat(I('tie','black'),[{tg:'grey',tl:'mono',tid:'z'}])}});
    ok(lk.same>=20&&lk.half>0&&lk.half<lk.same&&lk.white===0,`a grey jacket, dark shirt and grey/black tie two workdays after the same look is a repeat; another tie is half one; a white shirt is fine (${JSON.stringify(lk)})`);
    ok(lk.looks==='dark,dark,lightblue,mono,mono,navy'&&lk.sr>0&&lk.tr>0,`dark shirts read as one look, black/charcoal/grey/silver ties as one (${lk.looks}; shirt ${lk.sr}, tie ${lk.tr})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/jacketshare.test.js ---- */
// A lopsided wardrobe still rotates its jackets evenly (2026-11-14, the audit's walkthrough: three grey suits and one brown, and the brown
// one was planned 35 times in six months against 19-20 for each grey, every other suit day, because a grey after a grey cost the full
// JKT_SAME). The same-group cost is scaled by how avoidable the repeat is (planner.js topGw: the other jackets over the group's own, at most
// 1), so a wardrobe whose groups are balanced keeps the full rule: no two workdays running in one colour group.
const jacketshare=async({ok,chromium,url})=>{
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

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['jacketcolour',jacketcolour],['jacketshare',jacketshare]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
