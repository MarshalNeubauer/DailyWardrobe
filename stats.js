/* Daily Wardrobe: the stats page (Settings → Wardrobe stats).
   Two sources: what was really worn (the day history from the first day the wardrobe existed; days marked "Not worn" and
   the planner's warm-up days are left out) and what is planned for the next six months. From them: wear counts per item,
   the pieces that never get worn and why, what costs outfits points, the colour balance, the most-worn pairings, rest
   between wears, and what the planner has learned from the user's changes (each can be forgotten). */
const STATS_MONTHS=6,TREND_WEEKS=8;
let statsOpen={};   // which item-type sections are unfolded
/* the workdays really worn so far: [{date, d, ids, suitDay, vestOn}] */
function wornDays(){const T=todayDate(),out=[];
  for(const r of Object.values(dayRecs)){if(!r.ids||r.worn===false)continue;const d=keyDate(r.date);if(d>T)continue;
    const pcs=Object.values(r.ids).map(id=>id&&items.find(i=>i.id===id)).filter(Boolean);
    if(!pcs.length||pcs.some(i=>(i.added||0)>+d+864e5))continue;   // dated before a piece was in the wardrobe: a planner warm-up day
    if(+d===+T&&r.worn!==true)continue;                            // today counts once it is marked worn
    out.push({date:r.date,d,ids:r.ids,suitDay:!!r.suitDay,vestOn:!!r.vestOn})}
  return out.sort((a,b)=>a.d-b.d)}
/* the planned outfits from tomorrow for STATS_MONTHS months: [[key, outfit]] */
function plannedDays(){const T=todayDate(),end=new Date(T.getFullYear(),T.getMonth()+STATS_MONTHS,T.getDate()),out=[];
  for(let y=T.getFullYear(),m=T.getMonth();new Date(y,m,1)<=end;m===11?(m=0,y++):m++){const p=planMonth(y,m);
    for(const [k,o] of Object.entries(p)){const d=keyDate(k);if(d.getMonth()!==m||d.getFullYear()!==y||d<=T||d>end||!hasOutfit(o))continue;out.push([k,o])}}
  return out.sort((a,b)=>keyDate(a[0])-keyDate(b[0]))}
/* why a piece is never worn, in a sentence (by the planner's own rules) */
function whyUnused(i){
  if(i.paused&&i.away)return (i.away.why==='laundry'?'It\'s in the laundry':'It\'s at the cleaner\'s')+(i.away.back?`: it joins your outfits again after ${fmtDay(i.away.back)}.`:': it joins your outfits again once you mark it back.');
  if(i.paused&&i.order)return i.arrives?`It's on the way: it joins your outfits after ${fmtDay(i.arrives)}.`:'It\'s on the way: put it back in rotation once it arrives.';
  if(i.paused)return 'You took it out of rotation, so the planner leaves it out.';
  const by=t=>items.filter(x=>x.type===t),suitDays=settings.workdays.some(d=>!settings.blazerDays.includes(d)),blazerDays=settings.workdays.some(d=>settings.blazerDays.includes(d));
  const day={formal:false,clim:{season:'mild',rain:false,cold:false},hasLinks:by('cufflinks').length>0},jackets=[...(suitDays||!by('blazer').length?by('suit'):[]),...(blazerDays||!by('suit').length?by('blazer'):[])];
  // every jacket's best outfit, overall and with each shirt and each tie: worked out once for the page (fitMemo), not once per unused piece
  // (a wardrobe of 250 took a minute and a half)
  const table=()=>fitMemo||(fitMemo=Object.fromEntries(jackets.map(j=>{const t={all:-1e9,shirt:{},tie:{}},pants=j.type==='suit'?[j]:by('pants');
    for(const pt of pants.length?pants:[null])for(const sh of by('shirt'))for(const x of by('tie')){const q=clothesScore(j,pt,sh,x,j.type==='suit',day);if(q>t.all)t.all=q;if(!(q<=t.shirt[sh.id]))t.shirt[sh.id]=q;if(!(q<=t.tie[x.id]))t.tie[x.id]=q}
    return [j.id,t]})));
  const gap=(kind,id)=>{const T=table();return Math.min(...jackets.map(j=>T[j.id].all-(T[j.id][kind][id]??-1e9)))};
  const n=v=>Math.round(v);
  switch(i.type){
    case 'pants':{if(!blazerDays)return 'You have no blazer days, so odd trousers are never needed.';if(!by('blazer').length)return 'There is no blazer to wear them with.';
      const g=Math.min(...by('blazer').map(j=>Math.max(...by('pants').map(p=>pairScore(j,p)+patternScore([[j,'top'],[p,'bot']])))-(pairScore(j,i)+patternScore([[j,'top'],[i,'bot']]))));
      return g>QWIN?`They don't suit any of your blazers well enough: ${n(g)} points behind the best pair at the closest.`:'They suit a blazer, but other pairs have rested longer: they come up later than six months.'}
    case 'shirt':{const g=gap('shirt',i.id);if(g<=QWIN)return 'It works, but your other shirts have rested longer: it comes up later than six months.';
      return darkShirt(i)?`A dark shirt needs a light jacket and a tie lighter than itself; the best such outfit is ${n(g)} points behind your others.`:`With every jacket it is at least ${n(g)} points behind your other shirts.`}
    case 'tie':{const g=gap('tie',i.id);return g<=QWIN?'It works, but other ties have rested longer: it comes up later than six months.':`With every jacket and shirt it is at least ${n(g)} points behind your other ties.`}
    case 'suit':return !suitDays?'Every workday is a blazer day, so suits are never planned.':itemSeason(i)!=='all'?`It is tagged for ${itemSeason(i)} weather, which the next six months don't bring.`:'Your other suits take every suit day first: it has the lowest priority for colour variety.';
    case 'blazer':return !blazerDays?'You have no blazer days set in Settings.':itemSeason(i)!=='all'?`It is tagged for ${itemSeason(i)} weather, which the next six months don't bring.`:'Your other blazers take every blazer day first.';
    case 'shoes':{const ok=jackets.some(j=>(j.type==='suit'?[j]:by('pants')).some(b=>shoeScore(j,b,i)>-50));
      return !ok?`${colName(primaryCol(i))} shoes don't suit any of your suits or trousers.`:finish(i.leather)==='patent'?'Patent shoes are for black tie only.':finish(i.leather)==='suede'&&!blazerDays?'Suede is kept for blazer days, and you have none.':'Another pair always suits the outfit better.'}
    case 'belt':return by('shoes').some(s=>beltFit(s,i)!==null)?'Another belt matches the shoes better each time.':'None of your shoes match it in colour and finish.';
    case 'socks':return 'Your other socks match your trousers better every day.';
    case 'cufflinks':return by('shirt').some(s=>s.cuff==='french')?'Another pair matches your watch and buckle better.':'You have no French-cuff shirt to wear them with.';
    case 'tieclip':return (settings.vestMode||'auto')==='always'&&!blazerDays?'With a vest on every suit day there is never a tie clip.':'Another clip matches your watch better, or a vest holds the tie.';
    case 'overcoat':case 'raincoat':return i.type==='raincoat'?'No rain in the forecast, and days beyond it are planned without rain.':'No day in the next six months is cold enough for a coat.';
    case 'watch':return 'Another watch matches the shoes and buckle better every day.'}
  return 'The planner never needs it.'}
let fitMemo=null;
function buildStats(){fitMemo=null;
  const worn=wornDays(),plan=plannedDays(),W={},P={},last={},next={};
  for(const w of worn)for(const s of SLOTS){const id=w.ids[s];if(!id||(s==='bot'&&w.suitDay))continue;W[id]=(W[id]||0)+1;last[id]=w.d}
  for(const [k,o] of plan)for(const s of SLOTS){const it=o[s];if(!it||(s==='bot'&&o.suitDay))continue;P[it.id]=(P[it.id]||0)+1;if(!next[it.id])next[it.id]=keyDate(k)}
  const rows=items.map(i=>({i,worn:W[i.id]||0,planned:P[i.id]||0,last:last[i.id]||null,next:next[i.id]||null}));
  // what costs points, over the planned days
  const miss={},rates=plan.map(([k,o])=>[k,o,rateOutfit(o)]);
  for(const [,,r] of rates)for(const c of r.checks)if(c.pts<c.max){const m=miss[c.label]||(miss[c.label]={n:0,lost:0,why:{}});m.n++;m.lost+=c.max-c.pts;if(c.why)m.why[c.why]=(m.why[c.why]||0)+1}
  const scores=rates.map(x=>x[2].score),avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;
  const lowest=[...rates].sort((a,b)=>a[2].score-b[2].score).slice(0,3).filter(x=>x[2].score<90);
  // colours and pairings
  const tally=(f)=>{const t={};for(const [,o] of plan){const k=f(o);if(k)t[k]=(t[k]||0)+1}return Object.entries(t).sort((a,b)=>b[1]-a[1])};
  const jackets=tally(o=>o.top&&jacketGroup(o.top)),shirts=tally(o=>o.shirt&&shirtGroup(o.shirt)),ties=tally(o=>o.tie&&tieGroup(o.tie));
  const pairs=tally(o=>o.top&&o.tie&&o.top.id+'|'+o.tie.id).slice(0,5).map(([k,n])=>{const [a,b]=k.split('|').map(id=>items.find(i=>i.id===id));return {a,b,n}}).filter(p=>p.a&&p.b);
  // rest
  let minRest=null,b2b=0;const lastTop={};plan.forEach(([k,o],n)=>{if(o.top){if(lastTop[o.top.id]!==undefined)minRest=Math.min(minRest??1e9,n-lastTop[o.top.id]);lastTop[o.top.id]=n}
    if(n&&o.shoes&&plan[n-1][1].shoes&&o.shoes.id===plan[n-1][1].shoes.id&&keyDate(k)-keyDate(plan[n-1][0])<1.5*864e5)b2b++});
  const looks=new Set(plan.map(([,o])=>comboKey(o))).size;
  // the score of what was really worn, week by week for the last TREND_WEEKS weeks (oldest first; a week with nothing worn has n 0)
  const T=todayDate(),wk=d=>Math.floor((di(T)-di(d))/7),trend=Array.from({length:TREND_WEEKS},(_,n)=>({from:new Date(T.getFullYear(),T.getMonth(),T.getDate()-7*(TREND_WEEKS-n)+1),n:0,sum:0,hard:0}));
  for(const w of worn){const a=wk(w.d);if(a<0||a>=TREND_WEEKS)continue;const o=planMonth(w.d.getFullYear(),w.d.getMonth())[w.date];if(!o||!hasOutfit(o))continue;
    const r=rateOutfit(o),t=trend[TREND_WEEKS-1-a];t.n++;t.sum+=r.score;if(r.hard.length)t.hard++}
  const tn=trend.reduce((a,t)=>a+t.n,0),wornAvg=tn?Math.round(trend.reduce((a,t)=>a+t.sum,0)/tn):null,wornHard=trend.reduce((a,t)=>a+t.hard,0);
  const planHard=rates.filter(x=>x[2].hard.length).length;
  return {worn,plan,rows,miss,avg,lowest,trend,wornAvg,wornHard,trendDays:tn,planHard,jackets,shirts,ties,pairs,minRest,b2b,looks,unused:rows.filter(r=>!r.worn&&!r.planned)}}
const statDate=d=>d?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
const statPic=i=>`<span class="st-pic">${i.photo?`<img src="${i.photo}" alt="">`:typeof itemPic==='function'&&itemPic(i)?`<img src="${itemPic(i).img}" alt="">`:itemThumb(i,true)}</span>`;
const GROUP_NAMES={grey:'Grey',navy:'Navy',blue:'Blue',brown:'Brown',tan:'Tan',black:'Black',green:'Green',red:'Burgundy / red',white:'White',lightblue:'Light blue',pink:'Pink',purple:'Purple',yellow:'Yellow',beige:'Beige',gold:'Gold',cream:'Cream',charcoal:'Charcoal'};
const groupName=g=>GROUP_NAMES[g]||colName(g).replace(/^./,c=>c.toUpperCase());
const groupCol=g=>COLORS[({red:'burgundy',yellow:'paleyellow',beige:'beige',purple:'purple',green:'green'})[g]||g]||'#8b8f96';
function renderStats(){
  const el=$('#stats');if(!el)return;
  if(!items.length){el.innerHTML=`<div class="phead nav"><button class="pback" onclick="show('today')" aria-label="Back to Today">‹</button><h2>Wardrobe stats</h2></div><p class="mut empty">Your wardrobe is empty. Add some items first.</p>`;return}
  const S=buildStats(),nPlan=S.plan.length,bar=(n,max,cls='')=>`<span class="st-bar ${cls}"><i style="width:${max?Math.max(2,Math.round(100*n/max)):0}%"></i></span>`;
  const tile=(v,l)=>`<div class="st-tile"><b>${v}</b><small>${l}</small></div>`;
  const first=S.worn.length?S.worn[0].d:null;
  // wear counts, one foldable section per type
  const types=Object.keys(TYPES).filter(t=>items.some(i=>i.type===t));
  const sect=t=>{const rs=S.rows.filter(r=>r.i.type===t).sort((a,b)=>(b.worn+b.planned)-(a.worn+a.planned)||(a.i.id<b.i.id?-1:1)),max=Math.max(1,...rs.map(r=>Math.max(r.worn,r.planned))),open=statsOpen[t]??(statsOpen[t]=t==='suit');
    const idle=rs.filter(r=>!r.worn&&!r.planned).length;
    // a folded section holds no rows (and so none of its photos) until it is opened
    return `<details class="st-type" data-type="${t}"${open?' open':''} ontoggle="statsToggle(this)"><summary><b>${TYPES[t]}${rs.length>1&&!/s$/.test(TYPES[t])?'s':''}</b><small class="mut">${rs.length} · ${idle?`${idle} never worn`:'all in use'}</small></summary>
      <div class="st-rows">${!open?'':rs.map(r=>`<div class="st-row${!r.worn&&!r.planned?' idle':''}">${statPic(r.i)}<div class="st-main"><span class="cap st-nm">${desc(r.i)||nm(r.i)}</span>
        <span class="st-bars">${bar(r.worn,max,'w')}${bar(r.planned,max,'p')}</span>
        <small class="mut">${r.worn?`worn ${r.worn}×${r.last?' · last '+statDate(r.last):''}`:'not worn yet'} · ${r.planned?`planned ${r.planned}×${r.next?' · next '+statDate(r.next):''}`:'not planned'}</small></div></div>`).join('')}</div></details>`};
  const mix=(title,list)=>!list.length?'':`<div class="st-mix"><small class="mut">${title}</small>${list.slice(0,7).map(([g,n])=>`<div class="st-mixrow"><span class="st-dot" style="background:${groupCol(g)}"></span><span class="st-mixnm">${groupName(g)}</span>${bar(n,list[0][1])}<small class="mut">${Math.round(100*n/nPlan)}%</small></div>`).join('')}</div>`;
  const missList=Object.entries(S.miss).sort((a,b)=>b[1].lost-a[1].lost).slice(0,6);
  const L=settings.learn||{},lp=Object.entries(L.p||{}),li=Object.entries(L.i||{}),byId=id=>items.find(i=>i.id===id);
  const learned=[...lp.map(([k,v])=>{const [a,b]=k.split('|').map(byId);return a&&b?{k,kind:'p',v,txt:`${nm(a)} with ${nm(b)}`}:null}),...li.map(([k,v])=>{const a=byId(k);return a?{k,kind:'i',v,txt:nm(a)}:null})].filter(Boolean).sort((a,b)=>a.v-b.v);
  el.innerHTML=`<div class="phead nav"><button class="pback" onclick="show('today')" aria-label="Back to Today">‹</button><h2>Wardrobe stats</h2></div>
  <div class="st-tiles">${tile(items.length,'items')}${tile(S.worn.length,`day${S.worn.length===1?'':'s'} worn${first?' since '+statDate(first):''}`)}${tile(nPlan,`outfits planned, next ${STATS_MONTHS} months`)}${tile(S.looks,'different looks planned')}${tile(nPlan?S.avg:'–','average outfit score')}${tile(S.unused.length,'items never worn')}</div>

  <section class="card st-card" id="st-unused"><h3>Never worn</h3>
  ${S.unused.length?`<p class="mut"><small>Not worn so far and not in any outfit for the next ${STATS_MONTHS} months, with the reason.</small></p>${S.unused.map(r=>`<div class="st-row">${statPic(r.i)}<div class="st-main"><span class="cap st-nm">${TYPES[r.i.type]}: ${desc(r.i)||nm(r.i)}</span><small class="mut">${prettyCols(whyUnused(r.i))}</small></div></div>`).join('')}`
    :`<p class="mut"><small>Every item is worn or planned in the next ${STATS_MONTHS} months.</small></p>`}</section>

  <section class="card st-card" id="st-trend"><h3>Your scores</h3>
  ${S.trendDays?`<p class="mut"><small>What you really wore, week by week: the average outfit score of each of the last ${TREND_WEEKS} weeks.</small></p>
    <div class="st-trend" role="img" aria-label="Average score of the outfits worn in each of the last ${TREND_WEEKS} weeks: ${S.trend.map(t=>t.n?Math.round(t.sum/t.n):'none').join(', ')}">${S.trend.map(t=>{const a=t.n?Math.round(t.sum/t.n):0;
      return `<div class="st-wk${t.n?'':' none'}"><b>${t.n?a:'–'}</b><span class="st-col"><i class="${t.hard?'low':a>=80?'good':'ok'}" style="height:${t.n?Math.max(6,a):0}%"></i></span><small>${statDate(t.from)}</small></div>`}).join('')}</div>
    <p class="mut"><small>Average ${S.wornAvg} over ${S.trendDays} day${S.trendDays===1?'':'s'}${S.wornHard?`; ${S.wornHard} had a real mistake (a score of ${HARD_CAP} or less)`:'; none had a real mistake'}. The plan for the next ${STATS_MONTHS} months averages ${S.avg}${S.planHard?`, with ${S.planHard} day${S.planHard===1?'':'s'} your wardrobe can't get right`:''}.</small></p>`
    :`<p class="mut"><small>Nothing worn in the last ${TREND_WEEKS} weeks yet. The plan for the next ${STATS_MONTHS} months averages ${nPlan?S.avg:'–'}${S.planHard?`, with ${S.planHard} day${S.planHard===1?'':'s'} your wardrobe can't get right`:''}.</small></p>`}</section>

  <section class="card st-card" id="st-wear"><h3>Wear counts</h3>
  <p class="mut"><small><span class="st-key w"></span>worn so far <span class="st-key p"></span>planned for the next ${STATS_MONTHS} months</small></p>${types.map(sect).join('')}</section>

  <section class="card st-card" id="st-points"><h3>What costs you points</h3>
  ${missList.length?`<p class="mut"><small>Over the ${nPlan} planned outfits: where the score is marked down most, and the usual reason.</small></p>${missList.map(([l,m])=>{const why=Object.entries(m.why).sort((a,b)=>b[1]-a[1])[0];
      return `<div class="st-miss"><b>${l}</b><span class="mut">${m.n} of ${nPlan} days</span>${bar(m.n,nPlan)}${why?`<small class="mut">Mostly: ${why[0]}.</small>`:''}</div>`}).join('')}`:'<p class="mut"><small>Nothing: every planned outfit scores full marks.</small></p>'}
  ${S.lowest.length?`<p class="mut" style="margin-top:10px"><small>Lowest-scoring days: ${S.lowest.map(([k,,r])=>`<a href="#" onclick="openDay(${keyDate(k).getTime()});show('today');return false">${statDate(keyDate(k))} (${r.score})</a>`).join(', ')}.</small></p>`:''}</section>

  <section class="card st-card" id="st-colours"><h3>Colour balance</h3><p class="mut"><small>Share of the planned days by colour.</small></p>
  ${mix('Jackets',S.jackets)}${mix('Shirts',S.shirts)}${mix('Ties',S.ties)}</section>

  <section class="card st-card" id="st-pairs"><h3>Pairings and rest</h3>
  ${S.pairs.length?`<p class="mut"><small>The jacket and tie pairings planned most often.</small></p>${S.pairs.map(p=>`<div class="st-pair"><span class="dot">${swatchSVG(p.a)}</span><span class="dot">${swatchSVG(p.b)}</span><span class="cap st-nm">${nm(p.a)} · ${nm(p.b)}</span><b>${p.n}×</b></div>`).join('')}`:''}
  <p class="mut" style="margin-top:10px"><small>${S.minRest!=null?`A jacket rests at least ${S.minRest} workday${S.minRest===1?'':'s'} before it is worn again. `:''}${S.b2b?`The same shoes are worn two days running ${S.b2b} time${S.b2b===1?'':'s'}: another pair in that colour would give them a rest.`:'Shoes always get a day off between wears.'}</small></p></section>

  ${typeof tagStatsCard==='function'?tagStatsCard():''}

  <section class="card st-card" id="st-learn"><h3>What the planner has learned</h3>
  ${learned.length?`<p class="mut"><small>From your swaps, picks and corrections. Forget one and the planner goes back to its own judgement.</small></p>${learned.map(x=>`<div class="st-learn"><span class="st-tag ${x.v<0?'down':'up'}">${x.v<0?(x.kind==='p'?'Avoids':'Wears less'):(x.kind==='p'?'Prefers':'Wears more')}</span><span class="st-nm">${x.txt.replace(/^./,c=>c.toUpperCase())}</span><button type="button" onclick="forgetLearned('${x.kind}','${x.k}')" aria-label="Forget: ${esc(x.txt)}">Forget</button></div>`).join('')}
    <div class="btns"><button type="button" onclick="forgetLearned()">Forget everything</button></div>`
    :'<p class="mut"><small>Nothing yet. When you swap a piece away or choose one yourself, the planner remembers the pairing.</small></p>'}</section>`;
}
async function forgetLearned(kind,k){
  if(!kind){if(!confirm('Forget everything the planner learned from your changes?'))return;settings.learn=null}
  else{const L={p:{...(settings.learn&&settings.learn.p)},i:{...(settings.learn&&settings.learn.i)}};delete L[kind][k];settings.learn=L}
  await saveUserSettings();renderStats()}
function statsToggle(d){const t=d.dataset.type;if(statsOpen[t]===d.open)return;statsOpen[t]=d.open;if(d.open&&!d.querySelector('.st-row')){const y=scrollY;renderStats();scrollTo(0,y)}}
function openStats(){closeSettings();show('stats');scrollTo({top:0})}
