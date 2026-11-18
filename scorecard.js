/* Daily Wardrobe: Today's score card: the five dials, the rank (worked out in analysis-worker.js), the Why, the swaps, the week's
   variety, the weather line and the rules
   (A classic script sharing one global scope with the others; split out of history.js, Round C 2026-11-17, and loaded after it.) */
/* ---- the score card: five dials (2026-11-17, the owner's approved design, C:\code\audit-2026-11-13\score-ideas\score-dials.html) ----
   Folded, one 52px row of five dials (planner.js dialHarmony, dialTexture, dialFreshness, dialVariety, dialOccasion), a broken rule ringing
   its dial red with "!". Unfolded: the rank among the day's outfits (rankFor, worked out in analysis-worker.js and filled in when it comes),
   the rules line, a Why sentence, swaps that rank higher (a tap wears one: applyFix → pickItem), each dial's reason, the week's variety and
   the month's weeks, the weather and the rules. No swaps on past or worn days. It replaced the 0-100 checklist score (nearly always 99-100:
   the planner optimizes the same rateOutfit checks); rateOutfit stays for the rules, the planner and Insights */
let scoreOpen=false;
const dialTone=v=>v>=80?'good':v>=60?'ok':'low';
const ordinal=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const dayWord=()=>key(sel)===key(todayDate())?'today':'this day';
/* the latest workdays before d with an outfit (a day marked not worn left out, as the planner's history does), latest first: [{d, o}] */
function recentWork(d,n=PAIR_DAYS){const out=[],x=dayOnly(d);for(let g=0;g<n*3+14&&out.length<n;g++){x.setDate(x.getDate()-1);if(!isWorkday(x))continue;
  const r=dayRecs[key(x)];if(r&&r.worn===false)continue;const o=planOn(x);if(o&&hasOutfit(o))out.push({d:new Date(x),o})}return out}
/* how many calendar days a piece of a type usually waits between wears (Freshness): the pieces of the type in rotation over the days a week
   that wear the type (suits on the days that aren't blazer days, blazers and pants on blazer days, the rest every workday) */
function dialCycle(d){const n=di(d),wd=Math.max(1,settings.workdays.length),bz=settings.blazerDays.filter(x=>settings.workdays.includes(x)).length,cnt={};
  for(const i of items)if(!isHandPick(i)&&inRotation(i,n))cnt[i.type]=(cnt[i.type]||0)+1;
  const jk=wearsJacket(),per={suit:jk&&cnt.blazer?Math.max(1,wd-bz):wd,blazer:cnt.suit?Math.max(1,bz):wd,pants:jk&&cnt.suit?Math.max(1,bz):wd};
  return t=>Math.max(1,cnt[t]||1)*7/(per[t]||wd)}
/* the day's dials and its rules (rateOutfit), kept per outfit and plan like the picker's scores (the plan cache is cleared by any change) */
let dialMemo={c:null,k:'',v:null};
const outfitKey=o=>key(sel)+JSON.stringify(idsOf(o))+!!o.vest+items.length;
function dialsFor(o){const k=outfitKey(o);if(dialMemo.c===cache&&dialMemo.k===k)return dialMemo.v;let v;
  if(window.TEST_PLAN)v=TEST_PLAN.dials(o);   // (tests/fixedplan.js: fixed dials, no planner)
  else{const rec=recentWork(sel);v={h:dialHarmony(o),t:dialTexture(o),f:dialFreshness(o,dialCycle(sel)),v:dialVariety(o,rec),o:dialOccasion(o),i:dialInterest(o),r:rateOutfit(o)}}
  v.bad={};for(const c of v.r.hard)v.bad[DIAL_OF_CHECK[c]||'o']=c;
  dialMemo={c:cache,k,v};return v}
/* ---- the rank: in analysis-worker.js (planner.js rankLooks), only for the day on screen, kept per day and outfit (rankMemo, like the
   dials); the card shows the dials at once and fills the rank line, the Why and the swaps in when the answer comes (rankFill) ---- */
let rankMemo={c:null,k:'',v:null},rankW=null,rankN=0;const rankWait=new Map();
/* the outfits the day allows: each slot's pieces of the day's kind in rotation that day (not away), no hand-pick pieces */
function rankPools(o){const n=di(sel),pool=t=>items.filter(i=>i.type===t&&!isHandPick(i)&&inRotation(i,n)).sort((a,b)=>a.id<b.id?-1:1);
  return {top:pool(o.top?o.top.type:o.suitDay?'suit':'blazer'),bot:pool('pants'),shirt:pool('shirt'),tie:pool('tie'),shoes:pool('shoes'),belt:pool('belt'),watch:pool('watch'),socks:pool('socks')}}
function rankWorker(){if(rankW!==null)return rankW||null;
  try{rankW=new Worker('analysis-worker.js')}catch(e){rankW=false;return null}
  rankW.onmessage=e=>{const d=e.data||{},w=rankWait.get(d.rank);if(!w)return;rankWait.delete(d.rank);if(d.res)w.done(d.res);else{console.warn('rank: '+d.error);w.done(null)}};
  // a worker that fails: the asks still waiting are worked out here instead, and the next ones too
  rankW.onerror=()=>{rankW=false;const left=[...rankWait.values()];rankWait.clear();for(const w of left)setTimeout(()=>{try{w.done(rankLooks(w.P,w.o))}catch(e){w.done(null)}},30)};
  return rankW}
function rankFor(o){if(!o||!hasOutfit(o))return null;if(window.TEST_PLAN)return TEST_PLAN.rank(o);const k=outfitKey(o);
  if(rankMemo.c===cache&&rankMemo.k===k)return rankMemo.v;   // (null while it is worked out)
  const mine=rankMemo={c:cache,k,v:null},id=k+'#'+(++rankN),P=rankPools(o),list=new Map(),t0=performance.now();
  for(const l of Object.values(P))for(const i of l)list.set(i.id,i);for(const s of SLOTS)if(o[s])list.set(o[s].id,o[s]);
  const strip=({photo,swatch,stripes,texture,sett,patternText,weave,pbox,patternSpec,meas,tagAI,rest,...i})=>i;   // the tags only (as What to buy sends)
  const done=res=>{if(rankMemo!==mine||!res)return;res.wall=Math.round(performance.now()-t0);mine.v=res;rankFill()};
  const w=rankWorker();
  if(w){rankWait.set(id,{done,P,o});w.postMessage(JSON.parse(JSON.stringify({rank:{id,settings,list:[...list.values()].map(strip),pools:Object.fromEntries(Object.entries(P).map(([s,l])=>[s,l.map(i=>i.id)])),
    ids:idsOf(o),day:{suitDay:!!o.suitDay,suitBot:!!o.suitBot,clim:o.clim||null,formal:!!o.formal,occasion:o.occasion||null}}})))}
  else setTimeout(()=>{try{done(rankLooks(P,o))}catch(e){console.warn(e)}},30);   // (where workers aren't available)
  return null}
/* the rank's answer arrived: put it into the card on screen, if it is still this outfit's */
function rankFill(){const box=$('#sbox');if(!box||box.dataset.rk!==rankMemo.k||!rankMemo.v)return;const o=planFor()[key(sel)];if(!o)return;
  const D=dialsFor(o),R=rankMemo.v,put=(s,h)=>{const e=box.querySelector(s);if(e)e.innerHTML=h};
  put('#srank',rankLine(R,D));put('#swhy',whyText(o,D,R));put('#sswaps',swapsHtml(o,D,R));box.classList.add('ranked');
  const b=box.querySelector('.month-link');if(b)b.setAttribute('aria-label',cardLabel(D,R))}
function rankLine(R,D){if(!R)return `<span class="mut">Ranking ${dayWord()==='today'?'today’s':'this day’s'} outfits…</span>`;const w=dayWord();
  if(!R.n)return `No outfit you own meets every rule ${w}`;
  if(R.rank>R.n)return `Below all ${R.n} outfits that meet every rule ${w}`;
  return (R.rank===1?`Best of ${R.n} outfit${R.n===1?'':'s'} ${w}`:`${ordinal(R.rank)} best of ${R.n} outfits ${w}`)+(D.r.hard.length?'':` · Top ${Math.max(1,Math.ceil(100*R.rank/R.n))}%`)}
/* a broken rule in words ("Brown belt with black shoes") */
function failText(o,c){if(c.label==='Belt'&&o.belt&&o.shoes)return `${sentence(dCol(o.belt))} belt with ${dCol(o.shoes)} shoes`;return sentence(c.why||c.label)}
const lowFirst=t=>t?t[0].toLowerCase()+t.slice(1):t;
const itemWord=(i,slot,o)=>`${shortDesc(i)||nm(i)} ${slotLabel(slot,o).toLowerCase()}`;   // (the short titles, as the picker's swaps had them)
/* the Why sentence: a broken rule and what mends it; the pieces' rest when it beat a better-ranked look; else the strongest dial's reason and
   the weakest's */
function whyText(o,D,R){const w=dayWord(),hard=D.r.checks.filter(c=>c.hard);
  if(hard.length){const f=R&&R.swaps.find(s=>s.fix),it=f&&items.find(i=>i.id===f.id);
    return esc(failText(o,hard[0])+'.'+(it?` With the ${itemWord(it,f.slot,o)}, this would be the ${f.rank<=R.n?ordinal(f.rank)+' best':'one'} look ${w}.`:''))}
  const ks=['h','t','o','v','f'],best=ks.reduce((m,k)=>D[k].v>D[m].v?k:m),weak=ks.reduce((m,k)=>D[k].v<D[m].v?k:m),wk=D[weak];
  const tail=wk.v<70&&weak!==best?' '+(wk.weak?`But ${lowFirst(wk.weak)}.`:wk.why):'';
  if(R&&R.rank>1&&D.f.v>=75&&D.f.most)return esc(`Picked because the ${D.f.most.piece} had rested ${D.f.most.rest>=60?'60+':D.f.most.rest} days.`+(weak!=='f'?tail:''));
  return esc((D[best].good?D[best].good+'.':D[best].why)+tail)}
function swapsHtml(o,D,R){if(o.frozen||!canPick(o))return '';if(!R)return '';const hard=D.r.hard.length>0;
  const head=`<p class="ssec">${hard?'These would put it right':'These would rank higher'}</p>`;
  if(!R.swaps.length)return head+`<p class="snone">${hard?'Nothing you own puts it right with one swap.':`Nothing you own makes a better look ${dayWord()}.`}</p>`;
  return head+R.swaps.map(s=>{const it=items.find(i=>i.id===s.id);if(!it)return '';const gain=R.rank-s.rank,place=s.rank>R.n?'meets every rule':s.rank===1?'best':ordinal(s.rank)+' best',w=itemWord(it,s.slot,o);
    return `<button type="button" class="sfixbtn${s.fix?' fix':''}" onclick="event.stopPropagation();applyFix('${jsq(s.slot)}','${jsq(s.id)}')" aria-label="${s.fix?'Fix it: wear the ':'Wear the '}${esc(w)}: ${gain>0?gain+' place'+(gain===1?'':'s')+' higher, ':''}${place}"><span class="dot" aria-hidden="true">${swatchSVG(it,true)}</span><span class="sfixnm">${s.fix?'Fix it: ':'Wear the '}${esc(w)}</span><b>${gain>0?`+${gain} place${gain===1?'':'s'}`:''}<small>${place}</small></b></button>`}).join('')}
function applyFix(slot,id){return pickItem(slot,id)}
function cardLabel(D,R){return DIAL_KEYS.map(k=>`${DIAL_NAMES[k]} ${D.bad[k]?'broken rule':D[k].v}`).join(', ')+'. '+(R?rankLine(R,D).replace(/<[^>]+>/g,'')+'. ':'')+(D.r.hard.length?`${D.r.hard.length} thing${D.r.hard.length===1?'':'s'} to fix`:'All rules met')+'. '+(scoreOpen?'Fold away':'Show why')}
/* one dial: a ring filled to the value, the number inside (or "!" for a broken rule, ringed in red), the name under it; at 0 no arc is
   drawn (its round cap alone was a red dot at the top of the ring, read as a broken rule: the owner, 2026-11-17) */
function dialHtml(k,d,bad){const t=bad?'bad':dialTone(d.v),r=15,c=2*Math.PI*r,p=c*Math.max(0,Math.min(100,d.v))/100;
  const arc=p>=.05?`<circle class="darc" cx="20" cy="20" r="${r}" stroke-dasharray="${p.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/>`:'';
  return `<span class="dial d-${t}"><svg viewBox="0 0 40 40" aria-hidden="true">${bad?'<circle class="dbad" cx="20" cy="20" r="18.6"/>':''}<circle class="dtrack" cx="20" cy="20" r="${r}"/>${arc}<text x="20" y="24.4" text-anchor="middle">${bad?'!':d.v}</text></svg><small>${DIAL_NAMES[k]}</small></span>`}
/* ---- the week's variety (the unfolded card's last part): the work week holding the day, and each week of its month ---- */
function weekOf(d){const w0=typeof weekFirst==='function'?weekFirst():0,s=dayOnly(d);s.setDate(s.getDate()-((s.getDay()-w0+7)%7));const days=[];
  for(let g=0;g<7;g++){const x=new Date(s.getFullYear(),s.getMonth(),s.getDate()+g);if(!isWorkday(x))continue;const r=dayRecs[key(x)];if(r&&r.worn===false)continue;const o=planOn(x);if(o&&hasOutfit(o))days.push({d:x,o})}
  return {start:s,days}}
/* three parts, 0-100 each, and their average: Colors spread (different tie, shirt and jacket colors over the week's days), No pairing
   repeats (a day with the shirt color and tie of one of its PAIR_DAYS workdays before: the calendar's gold), Suits spread (a jacket again
   within the week) */
function weekVariety(wk){const D=wk.days;if(!D.length)return null;
  const share=(f)=>{const v=D.map(x=>f(x.o)).filter(Boolean);return v.length?{n:new Set(v).size,of:v.length}:null};
  const tc=share(o=>o.tie&&tieGroup(o.tie)),sc=share(o=>o.shirt&&shirtGroup(o.shirt)),jc=share(o=>o.top&&jacketGroup(o.top)),parts=[tc,sc,jc].filter(Boolean);
  const colors=parts.length?Math.round(100*parts.reduce((a,p)=>a+p.n/p.of,0)/parts.length):100;
  const reps=D.map(x=>({x,i:pairSeen(x.o,recentWork(x.d))})).filter(r=>r.i>=0),pairs=Math.max(0,100-30*reps.length);
  const seen=new Set(),dup=[];for(const x of D){if(!x.o.top)continue;if(seen.has(x.o.top.id))dup.push(x);seen.add(x.o.top.id)}const suits=Math.max(0,100-30*dup.length);
  const fd=d=>d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const repTxt=reps.length?(()=>{const r=reps[0],p=recentWork(r.x.d)[r.i];return `The ${dCol(r.x.o.shirt)} shirt with the ${dCol(r.x.o.tie)} tie on ${fd(r.x.d)}, as on ${fd(p.d)}${reps.length>1?`, and ${reps.length-1} more`:''}.`})():'No shirt and tie together again within 10 workdays.';
  const dupTxt=dup.length?`The ${dCol(dup[0].o.top)} ${dup[0].o.top.type==='suit'?'suit':'jacket'} twice this week${dup.length>1?`, and ${dup.length-1} more`:''}.`:'A different jacket every day.';
  const cTxt=[tc&&`${tc.n} tie color${tc.n===1?'':'s'}`,sc&&`${sc.n} shirt color${sc.n===1?'':'s'}`,jc&&`${jc.n} jacket color${jc.n===1?'':'s'}`].filter(Boolean).join(', ')+` over ${D.length} day${D.length===1?'':'s'}.`;
  const score=Math.round((colors+pairs+suits)/3);
  const note=reps.length?`${reps.length} shirt-and-tie repeat${reps.length===1?'':'s'}`:dup.length?'A jacket twice':tc&&tc.n===tc.of?'Every tie different':`${tc?tc.n:0} tie colors`;
  return {score,parts:[['Colors spread',colors,cTxt],['No pairing repeats',pairs,repTxt],['Suits spread',suits,dupTxt]],note}}
let weekMemo={c:null,k:'',v:null};
function weeksHtml(){const k=key(sel);if(weekMemo.c===cache&&weekMemo.k===k)return weekMemo.v;
  const T=todayDate(),cur=weekOf(sel),V=weekVariety(cur),bar=(t,v,why,n)=>`<div class="sdl sli" style="--i:${n}"><div class="sdh"><span>${t}</span><b class="c-${dialTone(v)}">${v}</b></div><span class="sdb" aria-hidden="true"><i class="b-${dialTone(v)}" style="--p:${v/100}"></i></span><small>${esc(why)}</small></div>`;
  let h='';if(V){h+=`<p class="ssec sli">This week’s variety · <b class="c-${dialTone(V.score)}">${V.score}</b></p>`+V.parts.map((p,n)=>bar(p[0],p[1],p[2],n+3+DIAL_KEYS.length)).join('');   // (after the dials' bars, --i 3 on)
    const m=sel.getMonth(),y=sel.getFullYear(),last=new Date(y,m+1,0),rows=[];
    for(let s=weekOf(new Date(y,m,1)).start;s<=last;s=new Date(s.getFullYear(),s.getMonth(),s.getDate()+7)){const wk=weekOf(s);wk.days=wk.days.filter(x=>x.d.getMonth()===m);const v=weekVariety(wk);if(!v)continue;
      const a=wk.days[0].d,b=wk.days[wk.days.length-1].d,mo=a.toLocaleDateString('en-US',{month:'short'}),isCur=+cur.start===+wk.start,fut=a>T;
      rows.push(`<li class="${isCur?'cur':''}"><span class="wn b-${dialTone(v.score)}">${v.score}</span><span>${mo} ${a.getDate()}${+a===+b?'':' – '+b.getDate()}<small>${isCur?'This week':fut?'Planned':esc(v.note)}</small></span></li>`)}
    if(rows.length)h+=`<p class="ssec sli">Weeks this month</p><ul class="sweeks sli">${rows.join('')}</ul>`}
  weekMemo={c:cache,k,v:h};return h}
/* the weather in one line: the forecast (or the month's usual highs) and whether the cloth suits it (the Weather check) */
function wxLine(o,D){const c=o.clim;if(!c)return '';const w=c.wx,chk=D.r.checks.find(x=>x.label==='Weather'),tp=v=>typeof temp==='function'?temp(v):Math.round(v);
  const t=w&&typeof w.tmax==='number'?`${tp(w.tmax)}°${c.rain?' · rain likely':''}`:c.norm&&typeof c.norm.tmax==='number'?`Usually ${tp(c.norm.tmax)}° this month`:'';
  return [t,chk&&chk.why?sentence(chk.why):`Cloth for a ${c.season} day`].filter(Boolean).join('. ')+'.'}
function scoreCard(o){
  const D=dialsFor(o),R=rankFor(o),hard=D.r.checks.filter(c=>c.hard),rules=DIAL_RULES.filter(([l])=>l==='Complete outfit'||D.r.checks.some(c=>c.label===l));
  const dials=DIAL_KEYS.map(k=>dialHtml(k,D[k],!!D.bad[k])).join('');
  const rl=hard.length?`<p class="srules bad sli">! ${hard.length} thing${hard.length===1?'':'s'} to fix: ${esc(lowFirst(failText(o,hard[0])))}</p>`:`<p class="srules ok sli">✓ All ${rules.length} rules met</p>`;
  const bars=DIAL_KEYS.map((k,n)=>{const d=D[k],bad=D.bad[k],t=bad?'bad':dialTone(d.v),c=bad&&D.r.checks.find(x=>x.label===bad);
    return `<div class="sdl sli" style="--i:${n+3}"><div class="sdh"><span>${DIAL_NAMES[k]}</span><b class="c-${t}">${bad?'!':d.v}</b></div><span class="sdb" aria-hidden="true"><i class="b-${t}" style="--p:${d.v/100}"></i></span><small>${esc(c?failText(o,c)+'.':d.why)}</small></div>`}).join('');
  const rlist=rules.map(([l,t])=>{const c=D.r.checks.find(x=>x.label===l&&x.hard);return `<li${c?' class="f"':''}>${esc(c?failText(o,c):l==='Shoes'&&o.suitDay?'Shoes suit the suit':t)}</li>`}).join('');
  const wx=wxLine(o,D);
  // unfolds like the pieces list and the month plan (boxUnfold); each part slides in, the bars fill to their value
  return `<section class="mbox score dials${hard.length?' hasbad':''}${scoreOpen?' open instant':''}${R?' ranked':''}" id="sbox" data-rk="${esc(outfitKey(o))}"><button class="month-link" onclick="toggleScore()" aria-expanded="${scoreOpen}" aria-controls="spanel" aria-label="${esc(cardLabel(D,R))}">
    <span class="dialrow" aria-hidden="true">${dials}</span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="spanel"><div class="mpanel-in" onclick="toggleScore()"><p class="srank sli" id="srank" style="--i:0">${rankLine(R,D)}</p>${rl}<p class="swhy sli" id="swhy" style="--i:2">${whyText(o,D,R)}</p><div id="sswaps" class="sswaps" onclick="event.stopPropagation()">${swapsHtml(o,D,R)}</div>
    <p class="ssec sli">Why each dial</p>${bars}${weeksHtml()}${wx?`<p class="ssec sli">Weather</p><p class="swx sli">${esc(wx)}</p>`:''}<p class="ssec sli">Rules</p><ul class="srl sli">${rlist}</ul></div></div></section>`;
}

function toggleScore(){const box=$('#sbox');if(!box)return;scoreOpen=!scoreOpen;
  const b=box.querySelector('.month-link');b.setAttribute('aria-expanded',scoreOpen);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show why/,scoreOpen?'Fold away':'Show why'));
  if(scoreOpen)boxUnfold(box);else boxFold(box,'#spanel .sli, #spanel .sfixbtn')}
