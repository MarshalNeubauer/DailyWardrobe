/* Daily Wardrobe: "what to buy" (no DOM; runs in a Web Worker, see analysis-worker.js).
   1. Plans the next six months with the wardrobe as it is (real history and occasions; pieces on the way count as owned,
      pieces out of rotation don't) and measures it: scores, rule problems, rest, repeats, what is never planned, shoe load.
   2. Suits, blazers, trousers, shirts and ties: every colour and pattern class a type comes in is a candidate. Each is
      ranked by fit (how many of the owner's jackets, shirts and ties it makes a good outfit with, by the planner's own
      scores: within QWIN of that jacket's best) and by gap (a colour family or pattern class the wardrobe lacks; staples
      first; a bonus for pairing with pieces that are never planned). Ranking by simulation alone is noise in a full
      wardrobe (one more suit reshuffles the whole rotation), so the simulation only supplies the facts for the best few:
      how often it would be worn, how its outfits score, sample outfits, and any rule problem it fixes.
   3. Shoes, belts, socks, tie clip, cufflinks and coats: few options and a direct effect, so each is simulated and
      ranked by that effect (problem days fixed, checks no longer marked down, first-choice shoes, pairs worn two days running).
   4. Formal, wedding, funeral and no-jacket days are dressed once each to see what is missing. */
const SHOP_WEEKS=26,SHOP_PER_CAT=5,SHOP_TOP=10;
const keyDate2=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
function horizonKeys(T,weeks){const out=[],end=new Date(T);end.setDate(end.getDate()+weeks*7);
  for(const d=new Date(T);d<end;d.setDate(d.getDate()+1))if(isWorkday(d))out.push(key(d));return out}

/* what kind of problem a planner note describes */
function noteKind(n){
  const k=[['belts match','no matching belt'],['cufflinks','French cuffs without cufflinks'],['no raincoat','rain with no raincoat'],['no overcoat','cold with no overcoat'],
    ["isn't darker",'no tie darker than the shirt'],["isn't lighter",'no tie lighter than the dark shirt'],['darker than the jacket','shirt darker than the jacket'],['patterns','too many patterns'],['shoes suit','no shoes that suit the trousers'],
    ['patent','only patent shoes'],['different metals','mismatched metals'],['suede','suede in the rain'],['weather piece','out-of-season suit'],['separate trousers','no trousers for a day without a jacket']];
  for(const [m,label] of k)if(n.includes(m))return label;return 'other';
}
/* bought and on its way: owned, as far as the next purchase goes */
const shopList=list=>list.map(i=>{if(!(i.order&&i.paused))return i;const {paused,arrives,...r}=i;return r});
const CLOTHES=['suit','blazer','pants','shirt','tie'];

/* plan the horizon with a given wardrobe and measure it */
function evalPlan(list,T,weeks){
  const keep=items;items=list;
  try{
    const ks=horizonKeys(T,weeks),inH=new Set(ks),end=keyDate2(ks[ks.length-1]||key(T));
    const plans=planSim(planStart(T.getFullYear(),T.getMonth())).upTo(end),order=Object.keys(plans).sort((a,b)=>keyDate2(a)-keyDate2(b));
    const use={},when={},lost={},marked={},kinds={},looks=new Set(),want={},score={};
    let sum=0,n=0,sumS=0,nS=0,problems=0,rest=0,jrep=0,trep=0,lrep=0,b2b=0,first=0,prev=null,prev2=null,pShoe=null,pN=null;
    for(const k of order){const o=plans[k];if(!o)continue;const dn=di(keyDate2(k));
      const s=o.top?{jg:jacketGroup(o.top),sl:shirtLook(o.shirt),tl:tieLook(o.tie),tg:o.tie?tieGroup(o.tie):null}:null;
      if(inH.has(k)){n++;const r=rateOutfit(o);sum+=r.score;score[k]=r.score;if(o.suitDay){sumS+=r.score;nS++}
        for(const c of r.checks)if(c.pts<c.max){lost[c.label]=(lost[c.label]||0)+(c.max-c.pts);marked[c.label]=(marked[c.label]||0)+1}
        if((o.notes||[]).length){problems++;for(const nt of o.notes){const kd=noteKind(nt);kinds[kd]=(kinds[kd]||0)+1}}
        if(o.top&&!o.frozen&&o.top.rest<COOL)rest++;
        if(s&&prev){if(prev.jg===s.jg)jrep++;if(s.tg&&prev.tg===s.tg)trep++}
        if(s&&[prev,prev2].some(p=>p&&p.jg===s.jg&&p.sl===s.sl&&p.tl===s.tl))lrep++;
        if(o.shoes&&pShoe===o.shoes.id&&dn-pN<=1)b2b++;
        if(s)looks.add(s.jg+'|'+s.sl+'|'+s.tl);
        const tr=o.bot||o.top;if(o.shoes&&tr){const w=(SH[pcol(tr)]||['black','brown'])[0],x=want[w]||(want[w]={want:0,got:0});x.want++;if(pcol(o.shoes)===w){x.got++;first++}}
        for(const sl of SLOTS){const it=o[sl];if(!it||(sl==='bot'&&o.suitDay))continue;use[it.id]=(use[it.id]||0)+1;(when[it.id]||(when[it.id]=[])).push(k)}}
      if(s){prev2=prev;prev=s}if(o.shoes){pShoe=o.shoes.id;pN=dn}}
    const idle=list.filter(i=>[...CLOTHES,'shoes'].includes(i.type)&&inRotation(i)&&!use[i.id]).map(i=>i.id);
    return {days:n,avg:n?sum/n:0,avgSuit:nS?sumS/nS:0,avgOdd:n-nS?(sum-sumS)/(n-nS):0,problems,rest,jrep,trep,lrep,b2b,first,looks:looks.size,idle,use,when,lost,marked,kinds,want,score,plans};
  }finally{items=keep}
}

/* ---- how a piece reads: its colour group and its pattern class ---- */
const jClass=i=>{const p=patInfo(i,'top');return p?p.type:'plain'};                 // solid and the fine weaves are one class: the planner treats them alike
const sClass=i=>{const p=patInfo(i,'shirt');return p?p.type:'plain'};
const tClass=i=>{const p=patInfo(i,'tie');return p?p.type:patOf(i)==='knit'?'knit':patOf(i)==='woven'?'tex':'plain'};
const shopClass=i=>i.type==='tie'?tClass(i):i.type==='shirt'?sClass(i):i.type==='shoes'||i.type==='belt'?finish(i.leather):jClass(i);
const shopGroup=i=>i.type==='tie'?tieGroup(i):i.type==='shirt'?shirtGroup(i):i.type==='shoes'||i.type==='belt'?leatherGroup(planCol(i)):jacketGroup(i);
const CLASS_NAMES={plain:'plain',tex:'woven',knit:'knit',stripe:'striped',check:'checked',motif:'dotted or figured',smooth:'smooth leather',suede:'suede',grain:'grain leather',patent:'patent'};
const GROUP_LABELS={tie:{black:'black / charcoal',grey:'grey / silver',red:'burgundy / red',purple:'purple',brown:'brown / tan'},shirt:{lightblue:'light blue',purple:'lavender',yellow:'pale yellow',green:'mint',red:'burgundy',white:'white / cream'},
  jacket:{red:'burgundy',charcoal:'slate',tan:'tan / khaki',green:'green / olive',brown:'brown / taupe'},leather:{burgundy:'oxblood / burgundy'}};
const GROUP_HEX={red:'burgundy',lightblue:'lightblue',yellow:'paleyellow',beige:'beige',charcoal:'slate',gold:'gold',cream:'cream'};
const groupKind=t=>t==='tie'||t==='shirt'?t:t==='shoes'||t==='belt'?'leather':'jacket';
const groupLabel=(t,g)=>(GROUP_LABELS[groupKind(t)]||{})[g]||colName(g);
const groupHex=(t,g)=>COLORS[t==='shirt'&&g==='green'?'mint':t==='shirt'&&g==='purple'?'lavender':GROUP_HEX[g]||g]||'#8b8f96';
const TYPE_WORD={suit:['suit','suits'],blazer:['blazer','blazers'],pants:['trousers','trousers'],shirt:['shirt','shirts'],tie:['tie','ties'],shoes:['shoes','shoes'],belt:['belt','belts'],socks:['socks','socks'],
  tieclip:['tie clip','tie clips'],cufflinks:['cufflinks','cufflinks'],overcoat:['overcoat','overcoats'],raincoat:['raincoat','raincoats']};
const several=(n,t)=>`${n} ${TYPE_WORD[t][n===1?0:1]}`;
const listAnd=a=>(a=[...new Set(a)]).length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];

/* ---- fit: which owned pieces a candidate makes a good outfit with ---- */
function compatBase(L,season){
  const R=L.filter(i=>inRotation(i)),lists={},by=t=>lists[t]||(lists[t]=R.filter(i=>i.type===t));
  const suitDays=settings.workdays.some(d=>!settings.blazerDays.includes(d)),blazerDays=settings.workdays.some(d=>settings.blazerDays.includes(d));
  const day={formal:false,clim:{season:season||'mild',rain:false,cold:false},hasLinks:by('cufflinks').length>0};
  const jackets=[...(suitDays||!by('blazer').length?by('suit'):[]),...(blazerDays||!by('suit').length?by('blazer'):[])];
  const pairs=(j,ps)=>ps.map(p=>[pairScore(j,p)+patternScore([[j,'top'],[p,'bot']]),p]).sort((a,b)=>b[0]-a[0]).slice(0,3).map(x=>x[1]);   // a blazer's three best trousers
  const P={};for(const j of jackets)P[j.id]=j.type==='suit'?[j]:pairs(j,by('pants'));
  const q=(j,pt,sh,x)=>clothesScore(j,pt,sh,x,j.type==='suit',day);
  const qmax={};for(const j of jackets){let m=-1e9;for(const pt of P[j.id].length?P[j.id]:[null])for(const sh of by('shirt').length?by('shirt'):[null])for(const x of by('tie').length?by('tie'):[null]){const v=q(j,pt,sh,x);if(v>m)m=v}qmax[j.id]=m}
  const qs=Object.values(qmax).sort((a,b)=>a-b),qmed=qs.length?qs[qs.length>>1]:0;
  return {by,day,jackets,P,q,qmax,qmed,pairs,suitDays,blazerDays};
}
function compat(B,it){
  const {by,jackets,P,q,qmax,pairs}=B,J=new Set(),Sh=new Set(),Ti=new Set(),Pt=new Set(),lift=[];let combos=0;
  const none=a=>a.length?a:[null];
  // every outfit with the candidate that is within QWIN of the best one for that jacket (the planner's own window)
  const scan=(j,pts,shs,xs,base)=>{const cs=[];let own=-1e9;for(const pt of none(pts))for(const sh of none(shs))for(const x of none(xs)){const v=q(j,pt,sh,x);if(v>own)own=v;cs.push([v,pt,sh,x])}
    const m=Math.max(own,base);for(const [v,pt,sh,x] of cs)if(v>=m-QWIN){combos++;J.add(j.id);if(sh)Sh.add(sh.id);if(x)Ti.add(x.id);if(pt&&pt!==j)Pt.add(pt.id)}
    lift.push(Math.max(-2*QWIN,own-(base>-1e8?base:B.qmed)))};
  if(it.type==='tie')for(const j of jackets)scan(j,P[j.id],by('shirt'),[it],qmax[j.id]);
  else if(it.type==='shirt')for(const j of jackets)scan(j,P[j.id],[it],by('tie'),qmax[j.id]);
  else if(it.type==='suit')scan(it,[it],by('shirt'),by('tie'),-1e9);
  else if(it.type==='blazer')scan(it,pairs(it,by('pants')),by('shirt'),by('tie'),-1e9);
  else if(it.type==='pants')for(const j of jackets.filter(j=>j.type==='blazer'))if(pairs(j,[...by('pants'),it]).includes(it))scan(j,[it],by('shirt'),by('tie'),qmax[j.id]);
  return {combos,quality:lift.length?lift.reduce((a,b)=>a+b,0)/lift.length:-2*QWIN,J:[...J],Sh:[...Sh],Ti:[...Ti],Pt:[...Pt]};
}

/* ---- candidates ---- */
const SHOP_COLS={suit:['navy','charcoal','grey','lightgrey','blue','brown','tan','olive','black','cream'],
  blazer:['navy','blue','brown','tan','olive','green','burgundy','grey','lightgrey','charcoal','cream'],
  pants:['grey','lightgrey','charcoal','navy','tan','brown','olive','cream','black'],
  shirt:['white','lightblue','pink','lavender','ivory','paleyellow','mint','blue','periwinkle','lightgrey'],
  tie:['navy','blue','lightblue','burgundy','red','pink','purple','lavender','green','olive','brown','rust','gold','grey','silver','black','tan']};
/* the staples a business wardrobe starts from: [colour family, pattern classes that count] */
const STAPLES={suit:[['navy',['plain']],['charcoal',['plain']],['grey',['plain']]],blazer:[['navy',['plain']]],shirt:[['white',['plain']],['lightblue',['plain']]],
  tie:[['navy',['plain','tex']],['burgundy',['plain','tex']],['navy',['stripe']]],pants:[['grey',['plain']]]};
const shopKey=it=>it.type+'|'+shopGroup(it)+'|'+shopClass(it);
function clothesCandidates(B){
  let n=0;const C=[],mk=(x)=>C.push({cat:x.type,items:[{id:'cand-'+(n++),pattern:'solid',added:0,...x}]}),cols=t=>SHOP_COLS[t].filter(c=>COLS_BY[t].p.includes(c));
  const other=(c,l)=>l.filter(a=>fam(a)!==fam(c));
  for(const c of cols('suit'))for(const [p,a] of [['solid'],['pinstripe','white'],['glen-check'],['windowpane','lightblue']])mk({type:'suit',primaryColor:c,pattern:p,...(a?{secondaryColor:a}:{})});
  if(B.blazerDays||!B.by('suit').length){
    for(const c of cols('blazer'))for(const [p,a] of [['solid'],['glen-check'],['windowpane','lightblue']])mk({type:'blazer',primaryColor:c,pattern:p,...(a?{secondaryColor:a}:{})});
    if(B.by('blazer').length)for(const c of cols('pants'))for(const p of ['solid','glen-check'])mk({type:'pants',primaryColor:c,pattern:p})}
  for(const c of cols('shirt')){mk({type:'shirt',primaryColor:c,cuff:'button'});
    for(const p of ['stripe','gingham'])mk({type:'shirt',primaryColor:c,pattern:p,secondaryColor:c==='white'?'blue':'white',cuff:'button'})}
  for(const c of cols('tie')){for(const p of ['solid','woven','knit'])mk({type:'tie',primaryColor:c,pattern:p});
    for(const p of ['stripe','polka-dot','check'])for(const a of other(c,['white','navy','burgundy']))mk({type:'tie',primaryColor:c,pattern:p,secondaryColor:a})}
  return C;
}
/* a candidate in words: its name, and what else would do the same job */
function shopName(it){const c=colName(primaryCol(it)),p=patOf(it)||'solid';
  switch(it.type){
    case 'tie':return p==='solid'?`${c} tie`:p==='woven'?`${c} woven tie`:p==='knit'?`${c} knit tie`:p==='stripe'?`${c} striped tie`:p==='polka-dot'?`${c} dotted tie`:`${c} checked tie`;
    case 'shirt':return (p==='solid'?`${c} shirt`:p==='stripe'?`${c} striped shirt`:`${c} checked shirt`)+(it.cuff==='french'?', French cuffs':'');
    case 'suit':case 'blazer':case 'pants':return p==='solid'?`plain ${c} ${TYPE_WORD[it.type][0]}`:`${c} ${patLabel(p)} ${TYPE_WORD[it.type][0]}`;
    case 'shoes':return `${c} ${finish(it.leather)==='suede'?'suede':finish(it.leather)==='grain'?'grain-leather':'leather'} shoes`;
    case 'belt':return `${c} ${finish(it.leather)==='suede'?'suede ':''}belt`;
    case 'tieclip':return `${it.metal} tie clip`;case 'cufflinks':return `${it.metal} cufflinks`;
    default:return `${c} ${TYPE_WORD[it.type]?TYPE_WORD[it.type][0]:it.type}`}}
function shopDetail(it,L){const p=patOf(it)||'solid',a=it.secondaryColor&&colName(it.secondaryColor);
  if(it.type==='tie')return p==='stripe'?`With ${a} stripes.`:p==='polka-dot'?`With ${a} dots; a small figured pattern (foulard, paisley) does the same job.`:p==='check'?`With ${a} in the check.`
    :p==='woven'?'A textured weave, such as grenadine.':p==='knit'?'A square-ended knit: best on blazer days.':'Smooth silk.';
  if(it.type==='shirt')return p==='stripe'?`With ${a} stripes.`:p==='gingham'?`A small ${a} check (gingham or tattersall).`:'';
  if(['suit','blazer','pants'].includes(it.type)){
    if(p!=='solid')return p==='pinstripe'?'Pinstripe or chalk stripe.':p==='glen-check'?'Glen check or houndstooth.':a?`With a ${a} pane.`:'';
    // the fine weaves count as plain for every outfit rule, so name the ones the owner doesn't have yet
    const have=new Set(L.filter(i=>['suit','blazer','pants'].includes(i.type)&&inRotation(i)).map(i=>patOf(i))),fresh=['birdseye','sharkskin','nailhead','herringbone','twill'].filter(x=>!have.has(x)).slice(0,2);
    return fresh.length?`Solid, or a fine texture you don't have yet: ${fresh.join(' or ')}.`:'Solid or any fine texture.'}
  return ''}

/* ---- rank one clothing category: fit with what is owned, then gaps ---- */
function rankClothes(L,B,C,cat,base,skip){
  const own=L.filter(i=>i.type===cat&&inRotation(i)),gc={},cc={},cell={};
  for(const i of own){const g=shopGroup(i),k=shopClass(i);gc[g]=(gc[g]||0)+1;cc[k]=(cc[k]||0)+1;cell[g+':'+k]=(cell[g+':'+k]||0)+1}
  const nJ=B.jackets.length||1,nS=B.by('shirt').length||1,nT=B.by('tie').length||1,nBl=B.jackets.filter(j=>j.type==='blazer').length||1,out=[];
  const stapleGap=it=>(STAPLES[cat]||[]).some(([f,cls])=>f===pcol(it)&&cls.includes(shopClass(it))&&!own.some(o=>pcol(o)===f&&cls.includes(shopClass(o))));
  for(const c of C){if(c.cat!==cat)continue;const it=c.items[0];if(skip.has(shopKey(it)))continue;
    const k=compat(B,it),g=shopGroup(it),cl=shopClass(it);
    const share=cat==='tie'?Math.sqrt(k.J.length/nJ*k.Sh.length/nS):cat==='shirt'?Math.sqrt(k.J.length/nJ*k.Ti.length/nT):cat==='pants'?k.J.length/nBl:Math.sqrt(k.Sh.length/nS*k.Ti.length/nT);
    if(!k.combos||share<.2)continue;
    const idle=[...k.J,...k.Sh,...k.Ti,...k.Pt].filter(id=>id!==it.id&&!base.use[id]),newG=!gc[g],newCell=!cell[g+':'+cl],staple=stapleGap(it);
    const bold=cat==='tie'?0:cl==='check'?10:cl==='stripe'?8:0;   // a bold cloth is the second suit in a colour, not the first
    const score=50*share+(newG?30:10/(1+gc[g])+(newCell?12:0))+(cc[cl]?0:6)+(staple?60:0)+Math.min(12,4*idle.length)+1.5*k.quality-bold;
    out.push({c,it,g,cl,score,share,newG,newCell,staple,k,idle})}
  out.sort((a,b)=>b.score-a.score||(a.it.id<b.it.id?-1:1));
  const seen=[],stap=new Set(),top=[];for(const r of out){if(seen.includes(r.g+':'+r.cl)||seen.filter(s=>s.startsWith(r.g+':')).length>=2||(r.staple&&stap.has(pcol(r.it))))continue;seen.push(r.g+':'+r.cl);if(r.staple)stap.add(pcol(r.it));top.push(r);if(top.length>=SHOP_PER_CAT+5)break}
  return {own,gc,cc,cell,top};
}
/* what the owner has in a category: colour groups and pattern classes, and the classes that are missing */
function ownMix(cat,r){const t=cat,all=cat==='tie'?['plain','tex','knit','stripe','motif','check']:cat==='shoes'?['smooth','suede','grain']:['plain','stripe','check'];
  return {n:r.own.length,groups:Object.entries(r.gc).sort((a,b)=>b[1]-a[1]).map(([g,n])=>[groupLabel(t,g),groupHex(t,g),n]),
    classes:Object.entries(r.cc).sort((a,b)=>b[1]-a[1]).map(([k,n])=>[CLASS_NAMES[k]||k,n]),none:all.filter(k=>!r.cc[k]).map(k=>CLASS_NAMES[k]||k)}}

/* ---- the facts of one candidate, from a simulation ---- */
const FIX_LABELS={shoes:['Shoes','Belt','Leather formality','Weather'],belt:['Belt','Metals'],socks:['Socks'],tieclip:['Metals'],cufflinks:['Shirt'],overcoat:['Weather'],raincoat:['Weather']};
function simFacts(L,T,weeks,base,its){
  const r=evalPlan([...L,...its],T,weeks),id=its[0].id,ks=r.when[id]||[],sc=ks.map(k=>r.score[k]);
  const fixed=[];for(const [k,v] of Object.entries(base.kinds)){const f=v-(r.kinds[k]||0);if(f>0&&k!=='other')fixed.push([k,f])}
  const pts=(FIX_LABELS[its[0].type]||[]).reduce((a,l)=>a+(base.lost[l]||0)-(r.lost[l]||0),0);
  // two sample outfits: its best-scoring days, with different shirts
  const samples=[],seen=new Set();for(const k of [...ks].sort((a,b)=>r.score[b]-r.score[a]||keyDate2(a)-keyDate2(b))){const o=r.plans[k],sh=o.shirt&&o.shirt.id;if(seen.has(sh))continue;seen.add(sh);
    const ids={};for(const s of SLOTS)if(o[s])ids[s]=o[s].id;samples.push({ids,suitDay:!!o.suitDay,vest:!!o.vest,score:r.score[k]});if(samples.length>=2)break}
  return {worn:ks.length,ownAvg:sc.length?sc.reduce((a,b)=>a+b,0)/sc.length:null,dAvg:r.avg-base.avg,dProb:base.problems-r.problems,dRest:base.rest-r.rest,dB2B:base.b2b-r.b2b,dFirst:r.first-base.first,
    pts,fixed,samples,marked:r.marked,use:r.use};
}
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
function fixWhy(f){const why=f.fixed.map(([k,n])=>`Fixes ${plural(n,'day')}: ${k}.`);if(f.dRest>0)why.push(`Gives your jackets proper rest on ${plural(f.dRest,'more day')}.`);return why}

/* ---- the analysis ---- */
function runAnalysis(list,T,weeks,progress,onCat){
  weeks=weeks||SHOP_WEEKS;const L=shopList(list),skip=new Set(settings.shopSkip||[]);
  const base=evalPlan(L,T,weeks),D=base.days;
  const seasons={};for(const k of horizonKeys(T,weeks)){const s=dayClimate(keyDate2(k)).season;seasons[s]=(seasons[s]||0)+1}
  const season=(Object.entries(seasons).sort((a,b)=>b[1]-a[1])[0]||['mild'])[0];
  const B=compatBase(L,season),C=clothesCandidates(B),nmOf=id=>{const i=L.find(x=>x.id===id);return i?nm(i):''};
  const inRot=t=>L.filter(i=>i.type===t&&inRotation(i)),idleOf=t=>base.idle.filter(id=>L.find(i=>i.id===id).type===t);
  const cats=[];let checked=C.length,sims=1,done=0;
  const ranked={};for(const cat of CLOTHES)ranked[cat]=rankClothes(L,B,C,cat,base,skip);
  const small=smallCandidates(L,B,base,skip);checked+=small.length;
  const total=CLOTHES.reduce((a,c)=>a+Math.min(ranked[c].top.length,SHOP_PER_CAT+1),0)+small.length+4,tick=label=>{progress&&progress(Math.min(done++,total-1),Math.max(total,done),label)};
  const rec=(c,f,x)=>({key:shopKey(c.items[0]),type:c.items[0].type,name:prettyCols(shopName(c.items[0])+(c.items[1]?' + '+shopName(c.items[1]):'')),detail:prettyCols(shopDetail(c.items[0],L)),items:c.items,
    worn:f.worn,ownAvg:f.ownAvg==null?null:Math.round(f.ownAvg),samples:f.samples,...x,why:x.why.map(prettyCols)});

  /* suits, blazers, trousers, shirts, ties */
  const TITLES={suit:'Suits',blazer:'Blazers',pants:'Trousers',shirt:'Shirts',tie:'Ties'};
  for(const cat of CLOTHES){const R=ranked[cat],recs=[],idle=idleOf(cat),covered=idle.length>=2,W=TYPE_WORD[cat];
    if(cat==='blazer'&&!B.blazerDays&&B.by('suit').length)continue;
    if(cat==='pants'&&(!B.blazerDays||!B.by('blazer').length))continue;
    let tried=0;for(const x of R.top){if(recs.length>=SHOP_PER_CAT||tried++>=SHOP_PER_CAT+3)break;tick(TITLES[cat]);const f=simFacts(L,T,weeks,base,x.c.items);sims++;
      const fix=f.dProb>=1||f.dRest>=2;
      // not worth buying if the planner would hardly wear it, or its outfits would be worse than the usual ones
      const usual=cat==='suit'?base.avgSuit:cat==='blazer'||cat==='pants'?base.avgOdd:base.avg,edge=f.ownAvg==null?0:f.ownAvg-(usual||base.avg);
      if(!fix&&!x.staple&&(f.worn<2||edge<-1.5))continue;
      const why=fix?fixWhy(f):[],k=x.k,gl=groupLabel(cat,x.g),cn=CLASS_NAMES[x.cl],n=R.gc[x.g]||0;
      if(x.staple){const f=pcol(x.it),same=R.own.filter(o=>pcol(o)===f),fn=colName(f);
        why.push(`A staple you don't have: ${same.length?`your ${same.length===1?'one':same.length} ${fn} ${W[same.length===1?0:1]} ${same.length===1&&cat!=='pants'?'is':'are'} ${listAnd(same.map(o=>CLASS_NAMES[shopClass(o)]))}`:`no ${fn} ${W[0]}`}.`)}
      else if(x.newG)why.push(`A colour you don't have: no ${gl} ${W[1]} now.`);
      else if(x.newCell)why.push(`You have ${several(n,cat)} in ${gl}, none ${cn}.`);
      else why.push(`You have ${several(R.cell[x.g+':'+x.cl],cat)} like it; another spreads the wear.`);
      const nJ=B.jackets.length,nS=B.by('shirt').length,nT=B.by('tie').length;
      if(cat==='tie')why.push(`Works with ${k.J.length} of your ${plural(nJ,'jacket')} and ${k.Sh.length} of your ${plural(nS,'shirt')}.`);
      else if(cat==='shirt')why.push(`Works with ${k.J.length} of your ${plural(nJ,'jacket')} and ${k.Ti.length} of your ${plural(nT,'tie')}.`);
      else if(cat==='pants')why.push(`Pairs with ${listAnd(k.J.map(nmOf))}.`);
      else{const it=x.c.items[0],wantS=SH[pcol(it)]||['black','brown'],shoe=cat==='suit'?wantS.map(w=>inRot('shoes').find(s=>pcol(s)===w&&shoeScore(it,it,s)>-50)).find(Boolean):null;
        why.push(`Dresses well with ${k.Sh.length} of your ${plural(nS,'shirt')} and ${k.Ti.length} of your ${plural(nT,'tie')}`+(cat==='blazer'&&k.Pt.length?`; trousers: ${listAnd(k.Pt.map(nmOf))}`:'')
          +(cat==='suit'?(shoe?`; shoes: your ${nm(shoe)}`:`; it needs ${wantS[0]} shoes, which you don't have`):'')+'.')}
      if(x.idle.length)why.push(`Pairs with ${x.idle.length===1?'a piece':plural(x.idle.length,'piece')} you own that ${x.idle.length===1?"isn't":"aren't"} planned at all in the next ${Math.round(weeks/4.33)} months: ${listAnd(x.idle.slice(0,3).map(nmOf))}${x.idle.length>3?' and more':''}.`);
      why.push(`Planned on ${f.worn} of the next ${D} workdays${f.ownAvg!=null?`; those outfits score ${Math.round(f.ownAvg)} on average (your ${cat==='suit'?'suit days':cat==='blazer'||cat==='pants'?'blazer days':'outfits'} now: ${Math.round(usual||base.avg)})`:''}.`);
      const tier=fix?'fix':x.staple?'gap':covered?'optional':x.newG||x.newCell?'variety':'optional';
      recs.push(rec(x.c,f,{tier,why,rank:fix?8*Math.max(0,f.dProb)+6*Math.max(0,f.dRest):x.score+4*Math.max(-3,Math.min(3,edge))}))}
    const note=!R.own.length?`You have no ${W[1]} in rotation.`:covered?`${idle.length} of your ${several(R.own.length,cat)} ${idle.length===1?"isn't":"aren't"} planned at all in the next ${Math.round(weeks/4.33)} months, so nothing here is needed.`
      :`Each is planned about ${Math.round(R.own.reduce((a,i)=>a+(base.use[i.id]||0),0)/R.own.length)} times in the next ${D} workdays.`;
    const cat1={key:cat,title:TITLES[cat],own:ownMix(cat,R),notes:[note],recs};cats.push(cat1);onCat&&onCat(cat1)}

  /* shoes and belts, socks, accessories and coats: simulate each */
  const SM={shoes:{key:'shoes',title:'Shoes and belts',notes:shoeNotes(L,B,base),recs:[]},extra:{key:'extra',title:'Socks, accessories and coats',notes:[],recs:[]}};
  {const sh=inRot('shoes'),gc={},cc={};for(const s of sh){gc[shopGroup(s)]=(gc[shopGroup(s)]||0)+1;cc[shopClass(s)]=(cc[shopClass(s)]||0)+1}SM.shoes.own=ownMix('shoes',{own:sh,gc,cc})}
  for(const c of small){const it=c.items[0],t=it.type;tick(t==='shoes'||t==='belt'?'Shoes':'Accessories');const f=simFacts(L,T,weeks,base,c.items);sims++;
    const fix=f.dProb>=1,why=fix?fixWhy(f):[];let tier,rank;
    if(t==='shoes'||(t==='belt'&&c.forShoes)){const need=8*Math.max(0,f.dProb)+Math.max(0,f.dFirst)+2*Math.max(0,f.dB2B),g=groupLabel('shoes',shopGroup(it));
      if(t==='belt'){if(!fix&&need<2)continue;why.push(`Lets you wear your ${c.forShoes}: none of your belts matches them${base.use[c.forId]?'':', so they are never planned'}.`)}
      else{
      if(!fix&&(f.worn<Math.max(2,D*.05)||need<2)&&!c.newFinish)continue;if(!fix&&f.worn<2)continue;
      if(c.newFinish)why.push(`Your first ${CLASS_NAMES[finish(it.leather)]} pair: a more relaxed shoe for blazer days.`);
      else if(inRot('shoes').some(s=>shopGroup(s)===shopGroup(it)))why.push(`A second ${g} pair lets each rest between wears.`);else why.push(`A colour you don't have: no ${g} shoes now.`);
      if(f.dFirst>0)why.push(`The first-choice shoe colour on ${plural(f.dFirst,'more day')} (now ${base.first} of ${D}).`);
      if(f.dB2B>0)why.push(base.b2b-f.dB2B<=0?`No pair is worn two days running (${plural(base.b2b,'time')} now).`:`A pair is worn two days running ${plural(f.dB2B,'time')} less often.`);
      if(c.items[1])why.push('It needs its own belt: none of yours matches it.')}
      if(t==='belt'){if(f.dFirst>0)why.push(`The first-choice shoe colour on ${plural(f.dFirst,'more day')} (now ${base.first} of ${D}).`);if(f.dB2B>0)why.push(`A pair of shoes is worn two days running ${plural(f.dB2B,'time')} less often.`)}
      why.push(`Planned on ${f.worn} of the next ${D} workdays.`);
      tier=fix?'fix':need>=Math.max(6,D*.06)?'better':'optional';rank=fix?8*f.dProb:need+(c.newFinish?1:0)}
    else{const days=t==='socks'?(base.marked.Socks||0)-(f.marked.Socks||0):t==='tieclip'||t==='belt'?(base.marked.Metals||0)-(f.marked.Metals||0):0;
      if(!fix&&f.pts<Math.max(4,D*.04))continue;
      if(t==='socks')why.push(`Matches your ${c.forFam} trousers: your socks are marked down there on ${plural(days,'day')} now.`);
      else if(t==='tieclip')why.push(`Matches your watch and belt buckles: the metals are marked down on ${plural(days,'day')} now.`);
      if(!fix||f.worn)why.push(`Planned on ${f.worn} of the next ${D} workdays.`);
      tier=fix?'fix':'better';rank=fix?8*f.dProb:f.pts}
    SM[t==='shoes'||t==='belt'?'shoes':'extra'].recs.push(rec(c,f,{tier,why,rank}))}
  for(const s of [SM.shoes,SM.extra]){s.recs.sort((a,b)=>TIER_ORDER[a.tier]-TIER_ORDER[b.tier]||b.rank-a.rank);
    // one idea per shoe colour and finish
    const seen=new Set();s.recs=s.recs.filter(r=>!seen.has(r.key)&&seen.add(r.key)).slice(0,SHOP_PER_CAT);
    if(s.key==='extra'&&!s.recs.length)s.notes.push('Socks, tie clip, cufflinks and coats: nothing would improve an outfit in the plan.');
    cats.push(s);onCat&&onCat(s)}

  /* two purchases that fix the same days are not both needed: keep the best, then re-check the rest as if it had been bought */
  {const catOf=r=>cats.find(c=>c.recs.includes(r));let fixes=cats.flatMap(c=>c.recs.filter(r=>r.tier==='fix')).sort((a,b)=>b.rank-a.rank),cur=L,b2=base;
    for(let round=0;round<4&&fixes.length>1;round++){const [pick,...restF]=fixes;cur=[...cur,...pick.items];b2=evalPlan(cur,T,weeks);sims++;fixes=[];
      for(const r of restF){tick('Checking overlaps');const f=simFacts(cur,T,weeks,b2,r.items);sims++;
        if(f.dProb>=1||f.dRest>=2){r.rank=8*Math.max(0,f.dProb)+6*Math.max(0,f.dRest);r.why=[...fixWhy(f).map(prettyCols),...r.why.filter(w=>!/^(Fixes|Gives your jackets)/.test(w))];fixes.push(r)}
        else if(catOf(r)===catOf(pick)&&!['overcoat','raincoat','cufflinks','belt'].includes(r.type))r.dup=true;   // one or the other: both stay in their section, one is a top pick
        else{r.tier=['overcoat','raincoat','cufflinks','belt'].includes(r.type)?'drop':'optional';r.why=[`Not needed once you have the ${pick.name}: it fixes the same days.`,...r.why.filter(w=>!/^(Fixes|Gives your jackets)/.test(w))]}}
      fixes.sort((a,b)=>b.rank-a.rank)}
    for(const c of cats)c.recs=c.recs.filter(r=>r.tier!=='drop')}
  for(const c of cats){c.recs.sort((a,b)=>TIER_ORDER[a.tier]-TIER_ORDER[b.tier]||b.rank-a.rank);
    c.verdict=c.recs.some(r=>r.tier==='fix')?'needed':c.recs.some(r=>r.tier!=='optional')?'worth':'covered'}

  tick('Occasions');const occasions=occasionCheck(L,season);done+=3;
  const top=cats.flatMap(c=>c.recs.filter(r=>r.tier!=='optional'&&!r.dup).map(r=>({cat:c.key,key:r.key,tier:r.tier,rank:r.rank})))
    .sort((a,b)=>TIER_ORDER[a.tier]-TIER_ORDER[b.tier]||b.rank-a.rank);
  // the top picks take turns between categories within a tier, so five ties don't crowd out the suit
  const picks=[],per={};for(const t of ['fix','better','gap','variety']){const pool=top.filter(x=>x.tier===t);while(pool.length){const seen=new Set();for(let i=0;i<pool.length;)if(seen.has(pool[i].cat))i++;else{const x=pool.splice(i,1)[0];seen.add(x.cat);
    if((per[x.cat]=(per[x.cat]||0)+1)<=(x.cat==='extra'?3:2))picks.push(x)}}}
  return {v:2,weeks,months:Math.round(weeks/4.33),season,checked,sims,
    base:{days:D,avg:Math.round(base.avg),problems:base.problems,rest:base.rest,looks:base.looks,b2b:base.b2b,
      idle:base.idle.map(id=>{const i=L.find(x=>x.id===id);return {id,type:i.type,name:prettyCols(nm(i))}}),
      marked:Object.entries(base.marked).sort((a,b)=>b[1]-a[1]).map(([l,n])=>[l,n])},
    cats,top:picks.slice(0,SHOP_TOP).map(({cat,key})=>({cat,key})),occasions,hidden:[...skip]};
}
const TIER_ORDER={fix:0,better:1,gap:2,variety:3,optional:4,drop:5};

/* shoes, belts, socks, tie clip, cufflinks, coats worth simulating */
function smallCandidates(L,B,base,skip){
  let n=0;const C=[],by=B.by,mk=(its,x)=>{const c={cat:its[0].type,items:its.map(i=>({id:'cand-s'+(n++),pattern:'solid',added:0,...i})),...x};if(!skip.has(shopKey(c.items[0])))C.push(c)};
  const metal=(by('watch')[0]||{}).metal||'silver',fin=i=>finish(i.leather);
  const beltFor=(c,l)=>by('belt').some(b=>beltFit({primaryColor:c,leather:l},b)!==null)?[]:[{type:'belt',primaryColor:c,leather:l==='suede'?'suede':'calf',metal}];
  const cols=COLS_BY.shoes.p,blazerDays=B.blazerDays&&by('blazer').length;
  // (where the owner's pair only lacks a belt, the belt is the answer, not another pair)
  const unbelted=(c,l)=>by('shoes').some(s=>leatherGroup(planCol(s))===leatherGroup(c)&&(fin(s)==='suede')===(l==='suede')&&fin(s)!=='patent'&&!by('belt').some(b=>beltFit(s,b)!==null));
  for(const c of ['black','brown','tan','oxblood'])if(cols.includes(c)&&!unbelted(c,'calf'))mk([{type:'shoes',primaryColor:c,leather:'calf'},...beltFor(c,'calf')]);
  if(blazerDays)for(const c of ['brown','tan'])if(cols.includes(c)&&!unbelted(c,'suede'))mk([{type:'shoes',primaryColor:c,leather:'suede'},...beltFor(c,'suede')],{newFinish:!by('shoes').some(s=>fin(s)==='suede')});
  // a belt for shoes that have none
  const seenB=new Set();for(const s of by('shoes')){const k=leatherGroup(planCol(s))+fin(s);if(seenB.has(k)||fin(s)==='patent'||by('belt').some(b=>beltFit(s,b)!==null))continue;seenB.add(k);
    mk([{type:'belt',primaryColor:COLS_BY.belt.p.includes(primaryCol(s))?primaryCol(s):leatherGroup(planCol(s)),leather:fin(s)==='suede'?'suede':'calf',metal}],{forShoes:nm(s),forId:s.id})}
  // socks for trousers that have no matching pair
  const have=new Set(by('socks').map(pcol)),fams=new Set([...by('suit'),...(B.blazerDays?by('pants'):[])].map(pcol));
  for(const f of fams){if(have.has(f))continue;const c=COLS_BY.socks.p.find(x=>fam(x)===f&&!CUSTOM_COL[x]);if(c)mk([{type:'socks',primaryColor:c}],{forFam:colName(f)})}
  const clips=by('tieclip');if(!clips.some(c=>metalOf(c)===metal)&&metal!=='other')mk([{type:'tieclip',primaryColor:metal==='gold'?'gold':'silver',metal}]);
  if(!by('cufflinks').length&&by('shirt').some(s=>s.cuff==='french'))mk([{type:'cufflinks',primaryColor:metal==='gold'?'gold':'silver',metal}]);
  if(!by('overcoat').length&&(base.kinds['cold with no overcoat']||base.kinds['rain with no raincoat']))mk([{type:'overcoat',primaryColor:'charcoal'}]);
  if(!by('raincoat').length&&(base.kinds['rain with no raincoat']||base.kinds['cold with no overcoat']))mk([{type:'raincoat',primaryColor:'tan'}]);
  return C;
}
/* the shoe situation in words: what the plan leans on */
function shoeNotes(L,B,base){
  const sh=B.by('shoes'),D=base.days,out=[];if(!sh.length)return ['You have no shoes in rotation.'];
  out.push(sh.map(s=>`${nm(s).replace(/ shoes$/,'')} ${base.use[s.id]||0}`).join(', ')+` of the next ${D} workdays.`);
  const w=Object.entries(base.want).sort((a,b)=>b[1].want-a[1].want)[0];
  if(w){const [g,x]=w,n=sh.filter(s=>pcol(s)===g).length;
    out.push(n?`${colName(g).replace(/^./,c=>c.toUpperCase())} is the first-choice colour on ${x.want} of those days; your ${n===1?'one pair':n+' pairs'} can take ${x.got} of them${x.want-x.got>0?' (a pair rests a day between wears)':''}.`
      :`${colName(g).replace(/^./,c=>c.toUpperCase())} is the first-choice colour on ${x.want} of those days, and you have none.`)}
  if(base.b2b)out.push(`A pair is worn two days running ${plural(base.b2b,'time')}.`);
  const fins=new Set(sh.map(s=>finish(s.leather)));if(fins.size===1&&sh.length>1)out.push(`All ${sh.length} pairs are ${CLASS_NAMES[[...fins][0]]}.`);
  return out.map(prettyCols);
}
/* one formal day, one wedding, one funeral and one day without a jacket, dressed from the wardrobe: what is missing? */
function occasionCheck(L,season){
  const keep=items;items=L;
  try{const by=t=>L.filter(i=>i.type===t&&inRotation(i)).sort((a,b)=>a.id<b.id?-1:1),n=di(todayDate())+30,out=[];
    for(const [occ,label] of OCCASIONS){const casual=occ==='casual';
      const o=outfit(!casual,n,by,{},null,{formal:occ==='formal',occ:occ==='formal'?null:occ,clim:{season,rain:false,cold:false},hasLinks:by('cufflinks').length>0,prev:[]});
      const r=rateOutfit(o),gaps=[...o.notes,...r.checks.filter(c=>c.pts<c.max&&c.why).map(c=>c.why.replace(/^./,x=>x.toUpperCase())+'.')];
      out.push({occ,label,score:r.score,ready:r.score>=90&&!o.notes.length,pieces:[o.top,o.suitDay?null:o.bot,o.shirt,o.tie,o.shoes].filter(Boolean).map(i=>prettyCols(nm(i))),gaps:[...new Set(gaps)].map(prettyCols)})}
    return out}
  finally{items=keep}
}
