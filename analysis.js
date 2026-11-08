/* Daily Wardrobe: "what to buy" analysis (no DOM; runs in a Web Worker, see analysis-worker.js).
   Plans the coming weeks with the current wardrobe, then again with each candidate purchase added, and ranks the
   purchases by how much they improve the outfits: average score, days with a problem (no matching belt, French cuffs
   without cufflinks, no coat for the weather...) and days where a suit hasn't had enough rest. */

function horizonKeys(T,weeks){const out=[],end=new Date(T);end.setDate(end.getDate()+weeks*7);
  for(const d=new Date(T);d<end;d.setDate(d.getDate()+1))if(isWorkday(d))out.push(key(d));return out}

/* what kind of problem a planner note describes */
function noteKind(n){
  const k=[['belts match','no matching belt'],['cufflinks','French cuffs without cufflinks'],['no raincoat','rain with no raincoat'],['no overcoat','cold with no overcoat'],
    ["isn't darker",'no tie darker than the shirt'],['darker than the jacket','shirt darker than the jacket'],['patterns','too many patterns'],['shoes suit','no shoes that suit the trousers'],
    ['patent','only patent shoes'],['different metals','mismatched metals'],['suede','suede in the rain'],['weather piece','out-of-season suit']];
  for(const [m,label] of k)if(n.includes(m))return label;return 'other';
}

/* plan the horizon with a given wardrobe (history and the user's day overrides are left out) */
function evaluateWardrobe(list,T,weeks){
  const keepItems=items,keepRecs=dayRecs;items=list;dayRecs={};
  try{
    const ks=horizonKeys(T,weeks),plans={};
    for(const m of [...new Set(ks.map(k=>k.split('-').slice(0,2).join('-')))]){const [y,mm]=m.split('-').map(Number);Object.assign(plans,buildPlan(y,mm-1))}
    let sum=0,val=0,problems=0,rest=0;const kinds={};
    for(const k of ks){const o=plans[k];if(!o)continue;
      const score=rateOutfit(o).score,bad=(o.notes||[]).length>0,short=!!(o.top&&o.top.rest<COOL);
      sum+=score;val+=score-(bad?8:0)-(short?6:0);if(bad)problems++;if(short)rest++;
      for(const n of o.notes||[]){const kd=noteKind(n);kinds[kd]=(kinds[kd]||0)+1}}
    const n=ks.length||1;return {days:ks.length,avg:sum/n,value:val/n,problems,rest,kinds};
  }finally{items=keepItems;dayRecs=keepRecs}
}

/* standard purchases the wardrobe doesn't have yet; items that only work in pairs are bundled */
function purchaseCandidates(list){
  const has=(type,f=()=>true)=>list.some(i=>i.type===type&&f(i));let n=0;const C=[];
  const mk=(name,...its)=>C.push({name:prettyCols(name),items:its.map(x=>({id:'cand-'+(n++),pattern:'solid',added:0,...x}))});
  const metal=(list.find(i=>i.type==='watch')||{}).metal||'silver',smooth=i=>finish(i.leather)==='smooth';
  for(const [c,p] of [['navy','solid'],['charcoal','solid'],['grey','solid'],['navy','pinstripe']])
    if(!has('suit',i=>pcol(i)===fam(c)&&(i.pattern||'solid')===p))mk(`${c} ${p==='solid'?'':'pinstripe '}suit`,{type:'suit',primaryColor:c,pattern:p,...(p==='pinstripe'?{secondaryColor:'white'}:{})});
  if(settings.blazerDays.some(d=>settings.workdays.includes(d))){
    for(const c of ['navy','tan'])if(!has('blazer',i=>pcol(i)===c))mk(`${c} blazer`,{type:'blazer',primaryColor:c});
    for(const c of ['grey','charcoal','tan'])if(!has('pants',i=>pcol(i)===c))mk(`${c} trousers`,{type:'pants',primaryColor:c});
  }
  const links=has('cufflinks')?[]:[{type:'cufflinks',primaryColor:metal==='gold'?'gold':'silver',metal}];
  for(const [c,cuff] of [['white','button'],['lightblue','button'],['white','french'],['pink','button']])
    if(!has('shirt',i=>primaryCol(i)===c&&!patInfo(i,'shirt')&&(i.cuff||'button')===cuff))
      mk(`${c==='lightblue'?'light blue':c} ${cuff==='french'?'French-cuff ':''}shirt${cuff==='french'&&links.length?' + cufflinks':''}`,{type:'shirt',primaryColor:c,cuff},...(cuff==='french'?links:[]));
  for(const [c,p,s2] of [['navy','solid'],['burgundy','solid'],['navy','stripe','white'],['burgundy','paisley','navy'],['green','solid'],['grey','solid'],['navy','polka-dot','white']])
    if(!has('tie',i=>pcol(i)===c&&(i.pattern||'solid')===p))mk(`${c} ${p==='solid'?'':patLabel(p)+' '}tie`,{type:'tie',primaryColor:c,pattern:p,...(s2?{secondaryColor:s2}:{})});
  for(const [c,l] of [['black','calf'],['brown','calf'],['oxblood','cordovan']]){
    const g=leatherGroup(c);if(has('shoes',i=>leatherGroup(primaryCol(i))===g&&smooth(i)))continue;
    const belt=has('belt',i=>leatherGroup(primaryCol(i))===g&&smooth(i))?[]:[{type:'belt',primaryColor:g==='burgundy'?'burgundy':c,leather:'calf',metal}];
    mk(`${c} ${l} shoes${belt.length?` + ${g==='burgundy'?'burgundy':c} belt`:''}`,{type:'shoes',primaryColor:c,leather:l},...belt);
  }
  for(const c of ['black','brown','burgundy']){const g=leatherGroup(c);
    if(has('shoes',i=>leatherGroup(primaryCol(i))===g&&smooth(i))&&!has('belt',i=>leatherGroup(primaryCol(i))===g&&smooth(i)))mk(`${c} calf belt`,{type:'belt',primaryColor:c,leather:'calf',metal})}
  for(const c of ['navy','charcoal','brown'])if(!has('socks',i=>pcol(i)===c))mk(`${c} socks`,{type:'socks',primaryColor:c});
  if(links.length&&has('shirt',i=>i.cuff==='french'))mk(`${metal} cufflinks`,...links);
  if(!has('tieclip'))mk(`${metal} tie clip`,{type:'tieclip',primaryColor:metal==='gold'?'gold':'silver',metal});
  if(!has('overcoat'))mk('charcoal overcoat',{type:'overcoat',primaryColor:'charcoal'});
  if(!has('raincoat'))mk('tan raincoat',{type:'raincoat',primaryColor:'tan'});
  return C;
}

/* rank purchases in order of need: pick the single best one, then re-check everything else as if it had been bought,
   and so on, so each recommendation shows what it adds on top of the earlier ones (no double counting when two items
   fix the same problem, e.g. an overcoat and a raincoat). progress(i, n) reports work done. */
function runAnalysis(list,T,weeks,progress,maxPicks=6){
  const C=purchaseCandidates(list),start=evaluateWardrobe(list,T,weeks),out=[];
  let cur=list,base=start,left=[...C],done=0;const total=C.length*Math.min(maxPicks,C.length);
  for(let step=0;step<maxPicks&&left.length;step++){
    let best=null;
    for(const c of left){progress&&progress(Math.min(done++,total-1),total);
      const r=evaluateWardrobe([...cur,...c.items],T,weeks),gain=r.value-base.value;
      if(!best||gain>best.gain)best={c,r,gain}}
    if(!best||best.gain<=.3)break;
    const {c,r,gain}=best,why=[];
    for(const [k,v] of Object.entries(base.kinds)){const fixed=v-(r.kinds[k]||0);if(fixed>0&&k!=='other')why.push(`fixes ${fixed} day${fixed>1?'s':''}: ${k}`)}
    if(base.rest-r.rest>0)why.push(`gives your suits proper rest on ${base.rest-r.rest} more day${base.rest-r.rest>1?'s':''}`);
    if(r.avg-base.avg>=.5)why.push(`average outfit score ${Math.round(base.avg)} → ${Math.round(r.avg)}`);
    if(!why.length)why.push('makes the outfits a little better overall');
    out.push({name:prettyCols(c.name),items:c.items,gain:+gain.toFixed(1),why:why.map(prettyCols)});
    cur=[...cur,...c.items];base=r;left=left.filter(x=>x!==c);
  }
  return {base:{days:start.days,avg:Math.round(start.avg),problems:start.problems,rest:start.rest},after:{avg:Math.round(base.avg),problems:base.problems,rest:base.rest},recs:out,checked:C.length};
}
