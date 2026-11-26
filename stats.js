/* Daily Wardrobe: the stats page (the Insights tab).
   Two sources: what was really worn (the day history from the first day the wardrobe existed; days marked "Not worn" and
   the planner's warm-up days are left out) and what is planned for the next six months. From them: wear counts per item,
   the pieces that never get worn and why, what costs outfits points, the colour balance, the most-worn pairings, rest
   between wears.
   The page's parts in other files (the setup's checklist, the sample wardrobe, What to buy's button, the favorites and cost-per-wear
   cards) are reached through bus.js (the restructure S3f): without the file nothing is asked, as the `typeof f==='function'` guards did. */
import {emit,heard,ask} from './bus.js';   // (this file reads nothing of app.js's own ask(), the server request)
import {$,COLORS,CUSTOM_COL,SLOTS,TYPES,avgText,colName,dayRecs,di,dressOut,isHandPick,isWorkday,itemName,itemSeason,items,nameHtml,nm,prettyCols,primaryCol,sentence,settings,shortDesc,titleCls,todayDate,wearsJacket,wearsTie} from './core.js';
import {keyDate} from './days.js';
import {cache,hasOutfit,planMonth,planStartDay} from './today-plan.js';
import {HARD_CAP,QWIN,beltFit,beltWait,clothesScore,darkShirt,finish,jacketGroup,pairScore,patternScore,planSim,planStart,rateOutfit,shirtGroup,shirtScore,shoeSuits,tieGroup} from './planner.js';
import {comboKey,esc,srcOk} from './photo-keys.js';
import {itemPic} from './photos.js';
import {itemThumb,swatchSVG} from './draw.js';
import {afterScripts,keepFocus} from './app.js';
import {closeSettings} from './settings.js';
import {openAdd,show} from './nav.js';
import {openDay} from './month.js';
import {acts} from './act.js';
const STATS_MONTHS=6,TREND_WEEKS=8;
let statsOpen={};   // which item-type sections are unfolded
/* the workdays really worn so far: [{date, d, ids, suitDay, vestOn}] */
function wornDays(){const T=todayDate(),out=[];
  for(const r of Object.values(dayRecs)){if(!r.ids||r.worn===false)continue;const d=keyDate(r.date);if(d>T)continue;
    const pcs=Object.values(r.ids).map(id=>id&&items.find(i=>i.id===id)).filter(Boolean);
    if(!pcs.length||(!r.edited&&r.worn!==true&&pcs.some(i=>(i.added||0)>+d+864e5)))continue;   // dated before a piece was in the wardrobe: a planner warm-up day (one recorded by the app; a day corrected or marked worn by hand counts, CR-3-11)
    if(+d===+T&&r.worn!==true)continue;                            // today counts once it is marked worn
    out.push({date:r.date,d,ids:r.ids,suitDay:!!r.suitDay,vestOn:!!r.vestOn})}
  return out.sort((a,b)=>a.d.getTime()-b.d.getTime())}
/* the planned outfits of the next six months: [[key, outfit]]. The same workdays What to buy measures (analysis.js horizonKeys:
   SHOP_WEEKS weeks from tomorrow), so the two count the same outfits; they counted 122 and 126 (re-audit 2026-11-15) */
const statsDays=()=>horizonKeys(todayDate(),SHOP_WEEKS);
function plannedDays(){const out=[];
  for(const k of statsDays()){const d=keyDate(k),o=planMonth(d.getFullYear(),d.getMonth())[k];if(hasOutfit(o))out.push([k,o])}
  return out}
/* the wardrobe can't dress a day yet (Today shows the "Get your first outfit" checklist, setup.js setupNeeds): the plan's numbers would
   score half-outfits ("121 outfits planned, 50.0 average", re-audit 2026-11-15), so Insights leaves them out and says what is missing */
const statsShort=()=>{const n=ask('setup-needs');return n?n.filter(r=>!r.ok).map(r=>r.short):[]};
/* why a piece is never worn, in a sentence (by the planner's own rules) */
function whyUnused(i){
  if(i.paused&&i.away)return (i.away.why==='laundry'?'It\'s in the laundry':'It\'s at the cleaner\'s')+(i.away.back?`: it joins your outfits again after ${fmtDay(i.away.back)}.`:': it joins your outfits again once you mark it back.');
  if(i.paused&&i.order)return i.arrives?`It's on the way: it joins your outfits after ${fmtDay(i.arrives)}.`:'It\'s on the way: put it back in rotation once it arrives.';
  if(i.paused)return 'You took it out of rotation, so the planner leaves it out.';
  if(dressOut(i.type))return `Your dress code leaves out ${i.type==='tie'||i.type==='tieclip'?'ties':'jackets'} (Settings, Schedule), so it is planned only for a formal day, a wedding or a funeral.`;
  if(!wearsJacket()){const w=dressWhyUnused(i);if(w)return w}
  const by=t=>items.filter(x=>x.type===t),suitDays=settings.workdays.some(d=>!settings.blazerDays.includes(d)),blazerDays=settings.workdays.some(d=>settings.blazerDays.includes(d));
  const day={formal:false,clim:{season:'mild',rain:false,cold:false},hasLinks:by('cufflinks').length>0},jackets=[...(suitDays||!by('blazer').length?by('suit'):[]),...(blazerDays||!by('suit').length?by('blazer'):[])];
  // each jacket's best outfit, and its best with the one shirt or tie asked about, worked out only for the pieces that need a reason and
  // kept while the plan stays the same (fitMemo: until the plan cache is cleared, so a fold or reopening doesn't work it out again). Every
  // jacket x trousers x shirt x tie froze Insights for 4.5 s at 300 items, on opening and on every fold (W2-18-02); now a blazer is tried
  // with its FIT_PANTS best trousers, and its best outfit with its FIT_SHIRTS best shirts (as the planner keeps a shortlist, outfit())
  const M=fitMemoFor(),tie0=wearsTie()?by('tie'):[null],legs=j=>M.legs[j.id]||(M.legs[j.id]=j.type==='suit'?[j]:topBy(by('pants'),FIT_PANTS,p=>pairScore(j,p)+patternScore([[j,'top'],[p,'bot']])));
  const best=(j,shs,xs)=>{let b=-1e9;for(const pt of legs(j).length?legs(j):[null])for(const sh of shs)for(const x of xs){const q=clothesScore(j,pt,sh,x,j.type==='suit',day);if(q>b)b=q}return b};
  const allOf=j=>M.all[j.id]??(M.all[j.id]=best(j,topBy(by('shirt'),FIT_SHIRTS,sh=>shirtScore(j,sh)+patternScore([[j,'top'],[sh,'shirt']])),tie0));
  const withOf=(kind,id,j)=>{const k=kind+'|'+id+'|'+j.id;if(M.w[k]!==undefined)return M.w[k];const it=items.find(x=>x.id===id);
    return M.w[k]=kind==='shirt'?best(j,[it],tie0):best(j,by('shirt'),[it])};
  const gap=(kind,id)=>Math.min(...jackets.map(j=>{const w=withOf(kind,id,j);return Math.max(allOf(j),w)-w}));
  const n=v=>Math.round(v),pts=v=>n(v)===1?'1 point':n(v)+' points';
  switch(i.type){
    case 'pants':{if(!blazerDays)return 'You have no blazer days, so separate pants are never needed.';if(!by('blazer').length)return 'There is no blazer to wear them with.';
      const g=Math.min(...by('blazer').map(j=>Math.max(...by('pants').map(p=>pairScore(j,p)+patternScore([[j,'top'],[p,'bot']])))-(pairScore(j,i)+patternScore([[j,'top'],[i,'bot']]))));
      return g>QWIN?`They don't suit any of your blazers well enough: ${pts(g)} behind the best pair at the closest.`:'They suit a blazer, but other pairs suit your outfits a little better or have rested longer, so they aren\'t in the next six months\' plan.'}
    case 'shirt':{const g=gap('shirt',i.id);if(g<=QWIN)return 'It works, but your other shirts suit your outfits a little better or have rested longer, so it isn\'t in the next six months\' plan.';
      return darkShirt(i)?`A dark shirt needs a light jacket${wearsTie()?' and a tie lighter than itself':''}; the best such outfit is ${pts(g)} behind your others.`:`With every jacket it is at least ${pts(g)} behind your other shirts.`}
    case 'tie':{const g=gap('tie',i.id);return g<=QWIN?'It works, but other ties suit your outfits a little better or have rested longer, so it isn\'t in the next six months\' plan.':`With every jacket and shirt it is at least ${pts(g)} behind your other ties.`}
    case 'suit':return !suitDays?'Every workday is a blazer day, so suits are never planned.':itemSeason(i)!=='all'?`It is tagged for ${itemSeason(i)} weather, which the next six months don't bring.`:'Your other suits take every suit day first: it has the lowest priority for color variety.';
    case 'blazer':return !blazerDays?'You have no blazer days set in Settings.':itemSeason(i)!=='all'?`It is tagged for ${itemSeason(i)} weather, which the next six months don't bring.`:'Your other blazers take every blazer day first.';
    case 'shoes':return shoesWhyUnused(i,jackets.some(j=>(j.type==='suit'?[j]:by('pants')).some(b=>shoeSuits(j,b,i))),'suits or pants',finish(i.leather)==='suede'&&!blazerDays);
    case 'belt':return by('shoes').some(s=>beltFit(s,i)!==null)?'Another belt matches the shoes better each time.':'None of your shoes match it in color and finish.';
    case 'socks':return 'Your other socks match your pants better every day.';
    case 'cufflinks':return by('shirt').some(s=>s.cuff==='french')?'Another pair matches your watch and buckle better.':'You have no French-cuff shirt to wear them with.';
    case 'pocketsquare':return !jackets.length?'A pocket square is worn only with a jacket, and none is planned.':'It is worn only with a jacket on: another square picks up the tie, shirt or jacket better, or its colors and pattern repeat the tie\'s.';
    case 'tieclip':return (settings.vestMode||'auto')==='always'&&!blazerDays?'With a vest on every suit day there is never a tie clip.':'Another clip matches your watch better, or a vest holds the tie.';
    case 'overcoat':case 'raincoat':return i.type==='raincoat'?'No rain in the forecast, and days beyond it are planned without rain.':'No day in the next six months is cold enough for a coat.';
    case 'watch':return 'Another watch matches the shoes and buckle better every day.'}
  return 'The planner never needs it.'}
/* never-worn shoes, in a sentence: whyUnused, and dress.js dressWhyUnused for a wardrobe without jackets (ok: they suit some of the
   suits or pants named by `what`; suedeKept: suede waits for blazer days and there are none) */
const shoesWhyUnused=(i,ok,what,suedeKept)=>!ok?`${colName(primaryCol(i))} shoes don't suit any of your ${what}.`:finish(i.leather)==='patent'?'Patent shoes are for black tie only.'
  :beltWait(i)?`None of your belts match them, so the planner keeps them back: add a ${beltWait(i)} and they come into your outfits.`:suedeKept?'Suede is kept for blazer days, and you have none.':'Another pair always suits the outfit better.';
const FIT_PANTS=3,FIT_SHIRTS=8;
let fitMemo=null;
const fitMemoFor=()=>fitMemo&&fitMemo.c===cache&&fitMemo.n===items.length&&fitMemo.s===fitSettingsSig()?fitMemo:(fitMemo={c:cache,n:items.length,s:fitSettingsSig(),legs:{},all:{},w:{}});
const fitSettingsSig=()=>JSON.stringify([settings.workdays,settings.blazerDays,settings.dress,settings.custom,settings.darkShirts]);
const topBy=(arr,n,f)=>arr.length<=n?arr:arr.map(i=>[f(i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1)).slice(0,n).map(x=>x[1]);
function buildStats(){
  const short=statsShort(),worn=wornDays(),plan=short.length?[]:plannedDays(),W={},P={},last={},next={};
  for(const w of worn)for(const s of SLOTS){const id=w.ids[s];if(!id||(s==='bot'&&w.suitDay))continue;W[id]=(W[id]||0)+1;last[id]=w.d}
  for(const [k,o] of plan)for(const s of SLOTS){const it=o[s];if(!it||(s==='bot'&&o.suitDay))continue;P[it.id]=(P[it.id]||0)+1;if(!next[it.id])next[it.id]=keyDate(k)}
  // (a piece picked by hand only is not in the rotation's rows: core.js isHandPick, 2026-11-16)
  const rows=items.filter(i=>!isHandPick(i)).map(i=>({i,worn:W[i.id]||0,planned:P[i.id]||0,last:last[i.id]||null,next:next[i.id]||null}));
  // what costs points, over the planned days
  const miss={},rates=plan.map(([k,o])=>[k,o,rateOutfit(o)]);
  for(const [,,r] of rates)for(const c of r.checks)if(c.pts<c.max){const m=miss[c.label]||(miss[c.label]={n:0,lost:0,why:{}});m.n++;m.lost+=c.max-c.pts;if(c.why)m.why[c.why]=(m.why[c.why]||0)+1}
  const scores=rates.map(x=>x[2].score),avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
  const lowest=[...rates].sort((a,b)=>a[2].score-b[2].score).slice(0,3).filter(x=>x[2].score<90);
  // colours and pairings
  const tally=(f)=>{const t={};for(const [,o] of plan){const k=f(o);if(k)t[k]=(t[k]||0)+1}return Object.entries(t).sort((a,b)=>b[1]-a[1])};
  // an owner's color is its own row, by its own name ("Dusty pink"), not the group of the color it behaves like ("Tan", W2-17-04)
  const own=(i,g)=>CUSTOM_COL[primaryCol(i)]?primaryCol(i):g(i);
  const jackets=tally(o=>o.top&&own(o.top,jacketGroup)),shirts=tally(o=>o.shirt&&own(o.shirt,shirtGroup)),ties=tally(o=>o.tie&&own(o.tie,tieGroup));
  const pairs=tally(o=>o.top&&o.tie&&o.top.id+'|'+o.tie.id).slice(0,5).map(([k,n])=>{const [a,b]=k.split('|').map(id=>items.find(i=>i.id===id));return {a,b,n}}).filter(p=>p.a&&p.b);
  // rest
  let minRest=null,b2b=0;const lastTop={};plan.forEach(([k,o],n)=>{if(o.top){if(lastTop[o.top.id]!==undefined)minRest=Math.min(minRest??1e9,n-lastTop[o.top.id]);lastTop[o.top.id]=n}
    if(n&&o.shoes&&plan[n-1][1].shoes&&o.shoes.id===plan[n-1][1].shoes.id&&keyDate(k).getTime()-keyDate(plan[n-1][0]).getTime()<1.5*864e5)b2b++});
  const looks=new Set(plan.map(([,o])=>comboKey(o))).size;
  // the score of what was really worn, week by week for the last TREND_WEEKS weeks (oldest first; a week with nothing worn has n 0)
  const T=todayDate(),wk=d=>Math.floor((di(T)-di(d))/7),trend=Array.from({length:TREND_WEEKS},(_,n)=>({from:new Date(T.getFullYear(),T.getMonth(),T.getDate()-7*(TREND_WEEKS-n)+1),n:0,sum:0,hard:0}));
  for(const w of worn){const a=wk(w.d);if(a<0||a>=TREND_WEEKS)continue;const o=planMonth(w.d.getFullYear(),w.d.getMonth())[w.date];if(!o||!hasOutfit(o))continue;
    const r=rateOutfit(o),t=trend[TREND_WEEKS-1-a];t.n++;t.sum+=r.score;if(r.hard.length)t.hard++}
  // weeks that ended before the wardrobe existed are left out (six empty "–" weeks read as missing data, audit 2026-11-14)
  const s0=planStartDay();if(s0)while(trend.length>1&&!trend[0].n&&new Date(trend[0].from.getFullYear(),trend[0].from.getMonth(),trend[0].from.getDate()+6)<s0)trend.shift();
  // each week is named by its first workday on or after the day the wardrobe began: "Nov 13", a Friday before the first day, read as
  // scores from before the app was installed (W2-15-08)
  for(const t of trend){t.label=t.from;for(let g=0;g<7;g++){const d=new Date(t.from.getFullYear(),t.from.getMonth(),t.from.getDate()+g);if(d>T)break;if(isWorkday(d)&&(!s0||d>=s0)){t.label=d;break}}}
  const tn=trend.reduce((a,t)=>a+t.n,0),wornAvg=tn?Math.round(trend.reduce((a,t)=>a+t.sum,0)/tn):null,wornHard=trend.reduce((a,t)=>a+t.hard,0);
  const planHard=rates.filter(x=>x[2].hard.length).length;
  return {short,worn,plan,rows,miss,avg,lowest,trend,wornAvg,wornHard,trendDays:tn,planHard,jackets,shirts,ties,pairs,minRest,b2b,looks,unused:rows.filter(r=>!r.worn&&!r.planned&&!dressOut(r.i.type))}}
/* a piece as Insights names it: its own name exactly as typed, else its description (Insights showed "Charcoal pinstripe" for the owner's
   "My charcoal pinstripe", audit 2026-11-14) */
const statName=i=>itemName(i)||sentence(shortDesc(i)||nm(i)),statName1=i=>itemName(i)||sentence(nm(i)),statName2=i=>itemName(i)||nm(i);   // (statName1/2: with the type, "Navy suit"; statName2 later in a line, not capitalised)
/* an empty wardrobe's pages (Insights, Packing list, Laundry & cleaning): the way to start, as on the empty Wardrobe */
const emptyAdd=()=>`<div class="btns emptyadd"><button type="button" class="pri" data-act="emptyAddTap">Add your first item</button>${heard('sample-asked')?'<button type="button" data-act="emptySampleTap">Try a sample wardrobe</button>':''}</div>`;
const statDate=d=>d?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
const statPic=i=>`<span class="st-pic">${i.photo?`<img src="${phSm(i)}" alt="">`:itemPic(i)?`<img src="${srcOk(itemPic(i).img)}" alt="">`:itemThumb(i,true)}</span>`;
const GROUP_NAMES={grey:'Gray',navy:'Navy',blue:'Blue',brown:'Brown',tan:'Tan',black:'Black',green:'Green',red:'Burgundy / red',white:'White',lightblue:'Light blue',pink:'Pink',purple:'Purple',yellow:'Yellow',beige:'Beige',gold:'Gold',cream:'Cream',charcoal:'Charcoal'};
const groupName=g=>GROUP_NAMES[g]||colName(g).replace(/^./,c=>c.toUpperCase());
const groupCol=g=>COLORS[({red:'burgundy',yellow:'paleyellow',beige:'beige',purple:'purple',green:'green'})[g]||g]||'#8b8f96';
const statBar=(n,max,cls='')=>`<span class="st-bar ${cls}"><i style="width:${max?Math.max(2,Math.round(100*n/max)):0}%"></i></span>`;
const statTypeRows=(S,t)=>S.rows.filter(r=>r.i.type===t).sort((a,b)=>(b.worn+b.planned)-(a.worn+a.planned)||(a.i.id<b.i.id?-1:1));
/* one Wear counts section's rows: drawn when the section is open, or filled in when it is unfolded (statsToggle) */
function statRowsHtml(S,t){const rs=statTypeRows(S,t),max=Math.max(1,...rs.map(r=>Math.max(r.worn,r.planned))),bar=statBar;
  return rs.map(r=>`<div class="st-row${!r.worn&&!r.planned?' idle':''}">${statPic(r.i)}<div class="st-main"><span class="${titleCls(r.i)} st-nm">${esc(statName(r.i))}</span>
        <span class="st-bars">${bar(r.worn,max,'w')}${bar(r.planned,max,'p')}</span>
        <small class="mut">${r.worn?`worn ${r.worn}×${r.last?' · last '+statDate(r.last):''}`:'not worn yet'} · ${r.planned?`planned ${r.planned}×${r.next?' · next '+statDate(r.next):''}`:'not planned'}</small></div></div>`).join('')}
let statsLast=null;   // the numbers the page was last drawn from, with the plan they came from (a fold fills its rows from them)
/* Insights drawn again keeps the focus where it was (What to buy's button lost it to <body> when a redraw came after its sheet closed: CR-9-04) */
function renderStats(){const el=$('#stats');if(!el)return;keepFocus(el,statsDraw);}
function statsDraw(){
  const el=$('#stats');if(!el)return;
  if(!items.length){el.innerHTML=`<div class="phead"><h2>Insights</h2></div><p class="mut empty">Your wardrobe is empty.</p>${emptyAdd()}`;return}
  const S=buildStats(),nPlan=S.plan.length,bar=statBar;statsLast={S,c:cache,n:items.length};
  const tile=(v,l)=>`<div class="st-tile"><b>${v}</b><small>${l}</small></div>`;
  const first=S.worn.length?S.worn[0].d:null;
  // wear counts, one foldable section per type
  const types=Object.keys(TYPES).filter(t=>items.some(i=>i.type===t));
  const sect=t=>{const rs=statTypeRows(S,t),open=statsOpen[t]??(statsOpen[t]=t==='suit');
    // a type the dress code leaves out (blazers with jackets off) isn't "never worn": it isn't asked for (re-audit 2026-11-15)
    const out=dressOut(t),idle=out||S.short.length?0:rs.filter(r=>!r.worn&&!r.planned).length;
    // a folded section holds no rows (and so none of its photos) until it is opened
    return `<details class="st-type" data-type="${t}"${open?' open':''} data-act-toggle="statsFold"><summary><b>${TYPES[t]}${rs.length>1&&!/s$/.test(TYPES[t])?'s':''}</b><small class="mut">${rs.length} · ${out?'left out by your dress code':S.short.length?'nothing planned yet':idle?`${idle} never worn`:'all in use'}</small></summary>
      <div class="st-rows">${!open?'':statRowsHtml(S,t)}</div></details>`};
  const mix=(title,list)=>!list.length?'':`<div class="st-mix"><small class="mut">${title}</small>${list.slice(0,7).map(([g,n])=>`<div class="st-mixrow"><span class="st-dot" style="background:${groupCol(g)}"></span><span class="st-mixnm">${esc(groupName(g))}</span>${bar(n,list[0][1])}<small class="mut">${Math.round(100*n/nPlan)}%</small></div>`).join('')}</div>`;
  const missList=Object.entries(S.miss).sort((a,b)=>b[1].lost-a[1].lost).slice(0,6);
  const planLine=S.short.length?'':` The plan for the next ${STATS_MONTHS} months averages ${nPlan?avgText(S.avg):'–'}${S.planHard?`, with ${S.planHard} day${S.planHard===1?'':'s'} your wardrobe can't get right`:''}.`;
  el.innerHTML=`<div class="phead"><h2>Insights</h2></div>${ask('shop-button')||''}
  <div class="st-tiles">${tile(items.length,items.length===1?'item':'items')}${tile(S.worn.length,`day${S.worn.length===1?'':'s'} worn${first?' since '+statDate(first):''}`)}${S.short.length?'':tile(nPlan,`outfit${nPlan===1?'':'s'} planned, next ${STATS_MONTHS} months`)+tile(S.looks,`different outfit${S.looks===1?'':'s'} planned`)+tile(nPlan?avgText(S.avg):'–','average outfit score')+tile(S.unused.length,`item${S.unused.length===1?'':'s'} never worn`)}</div>
  ${ask('fav-stats-card',S)||''}
  ${S.short.length?`<section class="card st-card" id="st-short"><h3>Not a full outfit yet</h3><p class="mut"><small>Your wardrobe still needs ${listAnd(S.short)} for a complete outfit. The plan for the next ${STATS_MONTHS} months, its scores and what is never worn show here once Today can dress a workday.</small></p><div class="btns"><button type="button" class="pri" data-act="emptyAddTap">Add an item</button></div></section>`:`

  <section class="card st-card" id="st-unused"><h3>Never worn</h3>
  ${S.unused.length?`<p class="mut"><small>Not worn so far and not in any outfit for the next ${STATS_MONTHS} months, with the reason.</small></p>${S.unused.map(r=>`<div class="st-row">${statPic(r.i)}<div class="st-main"><span class="st-nm">${TYPES[r.i.type]}: <span class="${titleCls(r.i)}">${esc(statName(r.i))}</span></span><small class="mut">${prettyCols(whyUnused(r.i))}</small></div></div>`).join('')}`
    :`<p class="mut"><small>Every item is worn or planned in the next ${STATS_MONTHS} months.</small></p>`}</section>`}

  <section class="card st-card" id="st-trend"><h3>Your scores</h3>
  ${S.trendDays?`<p class="mut"><small>What you really wore, week by week: the average outfit score of each ${S.trend.length===1?'week':'of the last '+S.trend.length+' weeks'}.</small></p>
    <div class="st-trend" role="img" aria-label="Average score of the outfits worn in each ${S.trend.length===1?'week':'of the last '+S.trend.length+' weeks'}: ${S.trend.map(t=>t.n?Math.round(t.sum/t.n):'none').join(', ')}">${S.trend.map(t=>{const a=t.n?Math.round(t.sum/t.n):0;
      return `<div class="st-wk${t.n?'':' none'}"><b>${t.n?a:'–'}</b><span class="st-col"><i class="${t.hard?'low':a>=80?'good':'ok'}" style="height:${t.n?Math.max(6,a):0}%"></i></span><small>${statDate(t.label||t.from)}</small></div>`}).join('')}</div>
    <p class="mut"><small>Average ${S.wornAvg} over ${S.trendDays} day${S.trendDays===1?'':'s'}${S.wornHard?`; ${S.wornHard} had a real mistake (a score of ${HARD_CAP} or less)`:'; none had a real mistake'}.${planLine}</small></p>`
    :`<p class="mut"><small>Nothing worn in the last ${TREND_WEEKS} weeks yet.${planLine}</small></p>`}</section>

  <section class="card st-card" id="st-wear"><h3>Wear counts</h3>
  <p class="mut"><small><span class="st-key w"></span>worn so far <span class="st-key p"></span>planned for the next ${STATS_MONTHS} months</small></p>${types.map(sect).join('')}</section>
  ${ask('cpw-stats-card')||''}
${S.short.length?'':`
  <section class="card st-card" id="st-points"><h3>Small deductions</h3>
  ${missList.length?`<p class="mut"><small>Over the ${nPlan} planned outfits: where the score is marked down most, and the usual reason.</small></p>${missList.map(([l,m])=>{const why=Object.entries(m.why).sort((a,b)=>b[1]-a[1])[0];
      return `<div class="st-miss"><b>${l}</b><span class="mut">${m.n} of ${nPlan} days</span>${bar(m.n,nPlan)}${why?`<small class="mut">Mostly: ${why[0]}.</small>`:''}</div>`}).join('')}`:'<p class="mut"><small>Nothing: every planned outfit scores full marks.</small></p>'}
  ${S.lowest.length?`<p class="mut" style="margin-top:10px"><small>Lowest-scoring days: ${S.lowest.map(([k,,r])=>`<a href="#" data-act="statsDayTap" data-t="${keyDate(k).getTime()}">${statDate(keyDate(k))} (${r.score})</a>`).join(', ')}.</small></p>`:''}</section>

  <section class="card st-card" id="st-colours"><h3>Color balance</h3><p class="mut"><small>Share of the planned days by color.</small></p>
  ${mix('Jackets',S.jackets)}${mix('Shirts',S.shirts)}${mix('Ties',S.ties)}</section>

  <section class="card st-card" id="st-pairs"><h3>Pairings and rest</h3>
  ${S.pairs.length?`<p class="mut"><small>The jacket and tie pairings planned most often.</small></p>${S.pairs.map(p=>`<div class="st-pair"><span class="dot">${swatchSVG(p.a)}</span><span class="dot">${swatchSVG(p.b)}</span><span class="st-nm">${nameHtml(statName1(p.a))} · ${nameHtml(statName2(p.b))}</span><b>${p.n}×</b></div>`).join('')}`:''}
  <p class="mut" style="margin-top:10px"><small>${S.minRest!=null?`A jacket rests at least ${S.minRest} workday${S.minRest===1?'':'s'} before it is worn again. `:''}${S.b2b?`The same shoes are worn two days running ${S.b2b} time${S.b2b===1?'':'s'}: ${(w=>w?`your ${esc(nm(w))} would give them a rest with a ${beltWait(w)} to match.`:'another pair in that color would give them a rest.')(items.find(x=>x.type==='shoes'&&beltWait(x)))}`:'Shoes always get a day off between wears.'}</small></p></section>`}

  ${tagStatsCard()}`;
}
/* unfolding a section fills in only its rows, from the numbers the page was drawn from while the plan is the same (it re-drew the whole
   page, W2-18-02); after a change it draws the page again */
function statsToggle(d){const t=d.dataset.type;if(statsOpen[t]===d.open)return;statsOpen[t]=d.open;if(!d.open||d.querySelector('.st-row'))return;
  const L=statsLast,box=d.querySelector('.st-rows');if(L&&L.c===cache&&L.n===items.length&&box){box.innerHTML=statRowsHtml(L.S,t);return}
  const y=scrollY;renderStats();scrollTo(0,y)}
function openStats(){closeSettings();show('stats');scrollTo({top:0})}   // Insights is a tab now (it was a page opened from Settings)
/* ---- the next six months are planned a week at a time while the phone is idle (statsPlan), not all at once when Insights opens: that
   froze a phone for 1.3 s (audit 2026-11-13). Opening the tab (statsShow, from show()) draws the page at once when they are planned,
   else its top with a line saying so, and the rest as soon as the slices are done. It also starts a few seconds after start-up, so
   the tab is usually ready. renderStats() called directly still works it out at once (the tests, a change made on the page). ---- */
const STATS_SLICE=7;   // days planned per idle slice
let statsWarm=null;
function statsMonths(){const T=todayDate(),end=new Date(T.getFullYear(),T.getMonth(),T.getDate()+SHOP_WEEKS*7),out=[];   // (the months statsDays reaches)
  for(let y=T.getFullYear(),m=T.getMonth();new Date(y,m,1)<=end;m===11?(m=0,y++):m++)out.push([y,m]);return out}
const statsPlanned=()=>!!window.TEST_PLAN||statsMonths().every(([y,m])=>cache[y+'-'+m]);
function statsPlan(){if(statsWarm)return statsWarm;if(statsPlanned())return Promise.resolve();
  const idle=f=>self.requestIdleCallback?requestIdleCallback(f,{timeout:250}):setTimeout(f,16);
  return statsWarm=new Promise(done=>{const step=()=>{
    try{if(statsPlanned()){statsWarm=null;return done()}
      const T=todayDate(),[y,m]=statsMonths().find(([y,m])=>!cache[y+'-'+m]),start=planStart(y,m);
      if(+start!==+planStart(T.getFullYear(),T.getMonth()))planMonth(y,m);   // a month built on its own (planMonth's other branch): in one go
      else{const sim=cache.sim||(cache.sim=planSim(start)),me=new Date(y,m+1,0),at=sim._at?new Date(sim._at):start,next=new Date(at.getFullYear(),at.getMonth(),at.getDate()+STATS_SLICE);
        if(next>=me)planMonth(y,m);else{sim.upTo(next);sim._at=+next}}}   // (planMonth then only plans the days left; the sim is resumable)
    catch(e){console.warn('planning ahead for Insights stopped',e);statsWarm=null;return done()}
    idle(step)};idle(step)})}
function statsShow(){const el=$('#stats');if(!el)return;
  if(!items.length||statsPlanned())return renderStats();
  el.innerHTML=`<div class="phead"><h2>Insights</h2></div>${ask('shop-button')||''}<p class="mut st-wait" role="status"><span class="spin" aria-hidden="true"></span> Planning your next ${STATS_MONTHS} months…</p>`;
  statsPlan().then(()=>{if(!el.hidden&&el.querySelector('.st-wait'))renderStats()})}
/* An ES module since 2026-11-23. The bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use
   as globals: start.js (renderStats, statsShow), wardrobe, care and cost (wornDays), dress (shoesWhyUnused), fav (statName, statDate,
   statPic), cost (statName1, statPic), care (statPic), pack (emptyAdd); the rest are read by tests; statsOpen and fitMemo are lets only
   this file writes: getters. Above the file's first call that can throw (afterScripts, then acts): the names are then still the page's */
Object.assign(globalThis,{wornDays,shoesWhyUnused,statName,statName1,emptyAdd,statDate,statPic,renderStats,statsShow});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,buildStats,get fitMemo(){return fitMemo},groupName,openStats,plannedDays,get statsOpen(){return statsOpen},statsToggle,whyUnused};
export {statsOpen,wornDays,plannedDays,whyUnused,shoesWhyUnused,fitMemo,buildStats,statName,statName1,emptyAdd,statDate,statPic,groupName,renderStats,statsToggle,openStats,statsShow};
// a few seconds after start-up, while nothing else is going on
afterScripts(()=>setTimeout(()=>{if(items.length&&!document.hidden)statsPlan()},4000));
/* what the controls do (act.js): an empty page's two buttons and "Add an item" (emptyAdd: Insights, the Packing list), a Wear counts section folded
   or unfolded, and a lowest-scoring day's link (data-t: the day; a link: its jump to # is called off) */
function emptyAddTap(){openAdd()}
function emptySampleTap(){emit('sample-asked')}   // (kit.js loads it)
function statsFold(el){statsToggle(el)}
function statsDayTap(el,ev){openDay(+el.dataset.t);show('today');ev.preventDefault()}
acts({emptyAddTap,emptySampleTap,statsFold,statsDayTap});
