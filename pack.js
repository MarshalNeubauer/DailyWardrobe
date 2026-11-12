/* ---- Packing list for a trip (loaded after app.js and stats.js) ----
   The app plans an outfit for every workday; this page turns the outfits of a date range into a list of what to pack:
   every distinct piece once, with how many days it is worn, plus what the outfits imply (one belt per shoe colour, cufflinks
   for French cuffs, a coat when a day needs one). "Pack lighter" plans the trip's days again with at most so many jackets
   and pairs of shoes (on a copy of the day records, like the month's drag preview), and "Keep these outfits" locks the
   trip's days with the planner's own lock (rec.lock), so the list stays true when other days change.
   The trip and its limits are kept on the device in localStorage.pack_trip, ticks and travel wear per trip in pack_marks. */
const PACK_MAX=31;        // a trip is at most this many days
const PACK_TRIPS=8;       // ticks are remembered for this many trips
const PACK_TRIES=3;       // sets of jackets / of shoes tried for a lighter plan
const PACK_NOUN={suit:['suit','suits'],blazer:['blazer','blazers'],pants:['pair of dress pants','pairs of dress pants'],shirt:['shirt','shirts'],tie:['tie','ties'],tieclip:['tie clip','tie clips'],watch:['watch','watches'],shoes:['pair of shoes','pairs of shoes'],belt:['belt','belts'],socks:['pair of socks','pairs of socks'],cufflinks:['pair of cufflinks','pairs of cufflinks'],overcoat:['overcoat','overcoats'],raincoat:['raincoat','raincoats']};
const PACK_TITLE={suit:'Suits',blazer:'Blazers',pants:'Dress pants',shirt:'Shirts',tie:'Ties',tieclip:'Tie clips',watch:'Watch',shoes:'Shoes',belt:'Belts',socks:'Socks',cufflinks:'Cufflinks',overcoat:'Coats',raincoat:'Coats'};
const PACK_COUNTED=['suit','blazer','pants','shirt','tie','shoes','socks'];   // the count line at the top
let packT=null;           // the trip on screen: {a, b (YYYY-MM-DD), j, s (most jackets / pairs of shoes, 0 = no limit)}
let packMemo=null;        // the lighter plan last worked out
let packLines=[];         // the lines on screen, by index (for the buttons)
let packNow=null;         // what the page shows: {days, list, text}

const packN=(n,t)=>`${n} ${PACK_NOUN[t][n===1?0:1]}`;
const packName=i=>{const n=String(i.name||'').trim()||nm(i);return n.charAt(0).toUpperCase()+n.slice(1)};
const packDaysTxt=n=>n===1?'1 day':`${n} days`;
const packDate=d=>d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
const packRead=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
const packWrite=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};

/* the next working week: the workdays of the week that starts on the next Monday */
function packDefault(){const T=todayDate(),m=new Date(T);do m.setDate(m.getDate()+1);while(m.getDay()!==1);
  let a=null,b=null;for(let g=0;g<7;g++){const d=new Date(m.getFullYear(),m.getMonth(),m.getDate()+g);if(isWorkday(d)){a=a||d;b=d}}
  if(!a){a=m;b=new Date(m.getFullYear(),m.getMonth(),m.getDate()+4)}
  return {a:isoKey(a),b:isoKey(b),j:0,s:0}}
function packTrip(){if(packT)return packT;const s=packRead('pack_trip'),ok=s&&/^\d{4}-\d\d-\d\d$/.test(s.a||'')&&/^\d{4}-\d\d-\d\d$/.test(s.b||'')&&s.a<=s.b&&s.b>=isoKey(todayDate());   // a trip that is over makes way for the next week
  return packT=ok?{a:s.a,b:s.b,j:+s.j||0,s:+s.s||0}:packDefault()}
const packMarkKey=()=>{const t=packTrip();return t.a+'_'+t.b};
function packMark(){const m=(packRead('pack_marks')||{})[packMarkKey()]||{};return {t:m.t||[],w:m.w||[]}}
function packSetMark(f){const M=packRead('pack_marks')||{},k=packMarkKey(),m={t:[],w:[],...(M[k]||{})};f(m);m.at=Date.now();M[k]=m;
  for(const x of Object.keys(M).sort((p,q)=>(M[q].at||0)-(M[p].at||0)).slice(PACK_TRIPS))delete M[x];packWrite('pack_marks',M)}

/* the plan up to a day as it would be with these day records (the real records and the cache stay as they are) */
function packPlanOf(recs,end){const T=todayDate(),keep=dayRecs;dayRecs=recs;try{return planSim(planStart(T.getFullYear(),T.getMonth())).upTo(end)}finally{dayRecs=keep}}
/* every day of the trip: {d, k, o (its outfit, or null on a day off or a day with nothing planned), wd, off} */
function packDays(t,plan){const out=[],a=keyDate(t.a),E=di(keyDate(t.b));
  for(const d=new Date(a);di(d)<=E&&out.length<PACK_MAX;d.setDate(d.getDate()+1)){const k=key(d),o=(plan||planMonth(d.getFullYear(),d.getMonth()))[k],wd=isWorkday(d);
    out.push({d:new Date(d),k,o:wd&&hasOutfit(o)?o:null,wd,off:offName(d)})}
  return out}
const packUses=(days,slot)=>new Set(days.filter(x=>x.o&&x.o[slot]).map(x=>x.o[slot].id)).size;

/* what to pack for these days. wear = ids worn on the travel day (not packed).
   → {groups:[{type,title,lines}], worn:[lines], counts:{type:n}, total}; a line is {key, i, type, name, n} (i is null for something the outfits
   need that the wardrobe lacks) */
function packList(days,wear){const live=days.filter(x=>x.o),by=new Map(),W=new Set(wear||[]);
  for(const x of live)for(const s of SLOTS){const i=x.o[s];if(!i||s==='belt'||(s==='bot'&&x.o.suitDay))continue;   // (a suit's trousers are the suit)
    let e=by.get(i.id);if(!e)by.set(i.id,e={key:i.id,i,type:i.type,n:0,vest:false});e.n++;if(s==='top'&&x.o.vest)e.vest=true}
  // one belt per shoe colour worn: the belt planned most often with shoes of that colour
  const belts=new Map(),extra=[];
  for(const x of live){const o=x.o;if(!o.shoes)continue;const g=leatherGroup(planCol(o.shoes));let e=belts.get(g);if(!e)belts.set(g,e={n:0,c:new Map(),shoes:o.shoes});e.n++;if(o.belt){const c=e.c.get(o.belt.id)||{i:o.belt,n:0};c.n++;e.c.set(o.belt.id,c)}}
  for(const [g,e] of belts){const b=[...e.c.values()].sort((p,q)=>q.n-p.n)[0];
    if(b){const have=by.get(b.i.id);if(have)have.n+=e.n;else by.set(b.i.id,{key:b.i.id,i:b.i,type:'belt',n:e.n})}
    else extra.push({key:'x-belt-'+g,i:null,type:'belt',name:`A ${colName(g)} belt for the ${colName(primaryCol(e.shoes))} shoes (none of yours matches)`,n:e.n})}
  const fr=live.filter(x=>x.o.shirt&&x.o.shirt.cuff==='french'&&!x.o.links).length;
  if(fr)extra.push({key:'x-links',i:null,type:'cufflinks',name:'Cufflinks for the French-cuff shirt (none in your wardrobe)',n:fr});
  const cold=live.filter(x=>!x.o.coat&&x.o.clim&&(x.o.clim.cold||x.o.clim.rain)).length;
  if(cold)extra.push({key:'x-coat',i:null,type:'overcoat',name:'A coat or umbrella (cold or wet weather; no coat in your wardrobe)',n:cold});
  const lines=[...by.values()].map(e=>({key:e.key,i:e.i,type:e.type,n:e.n,name:packName(e.i)+(e.vest?' with its vest':'')})).concat(extra);
  const groups=[],counts={},worn=[];let total=0;
  for(const t of Object.keys(TYPES)){const ls=lines.filter(l=>l.type===t).sort((p,q)=>q.n-p.n||(p.key<q.key?-1:1));
    const pk=ls.filter(l=>!W.has(l.key));worn.push(...ls.filter(l=>W.has(l.key)));if(!pk.length)continue;
    const last=groups[groups.length-1];if(last&&last.title===PACK_TITLE[t])last.lines.push(...pk);else groups.push({type:t,title:PACK_TITLE[t],lines:pk});
    counts[t]=pk.filter(l=>l.i).length;total+=pk.length}
  return {groups,worn,counts,total}}
const packCount=c=>PACK_COUNTED.filter(t=>c[t]).map(t=>packN(c[t],t)).join(' · ');

/* ---- pack lighter: the trip's days planned again with at most J jackets and S pairs of shoes ---- */
/* the pieces a slot uses on the trip, the ones that can't change (worn already, picked by hand) first, then by days worn */
function packTally(days,slot){const m=new Map();days.forEach((x,ix)=>{const i=x.o&&x.o[slot];if(!i)return;const r=dayRecs[x.k],pin=!!x.o.frozen||!!(r&&r.force&&r.force[slot]);
    let e=m.get(i.id);if(!e)m.set(i.id,e={i,n:0,pin:false,at:ix});e.n++;e.pin=e.pin||pin});
  return [...m.values()].sort((p,q)=>q.pin-p.pin||q.n-p.n||p.at-q.at)}
/* up to `max` ways of taking n of the pieces, the most worn first; fixed pieces are in every one */
function packSets(tally,n,max){if(!n)return [null];if(tally.length<=n)return [new Map(tally.map(e=>[e.i.id,e.i]))];   // within the limit: the pieces it has now, no others
  const pins=tally.filter(e=>e.pin).slice(0,n),rest=tally.filter(e=>!pins.includes(e)),need=n-pins.length,out=[];
  const go=(from,got)=>{if(out.length>=max)return;if(got.length===need){out.push(new Map([...pins,...got].map(e=>[e.i.id,e.i])));return}for(let k=from;k<rest.length;k++)go(k+1,[...got,rest[k]])};
  go(0,[]);return out}
/* day records that hold the trip's days to these jackets and shoes: every other one is ruled out for the day (rec.skip), and a day
   whose kind of jacket is not among them takes the other kind (rec.kind); the locks are dropped so the days are planned afresh */
function packLightRecs(days,AJ,AS){const recs={...dayRecs},kinds=AJ?new Set([...AJ.values()].map(i=>i.type)):null,
    out=(type,A)=>items.filter(i=>i.type===type&&!A.has(i.id)).map(i=>i.id);
  for(const x of days){if(!x.o||x.o.frozen)continue;const r={...(dayRecs[x.k]||{date:x.k})},skip={...(r.skip||{})},f=r.force||{};delete r.lock;
    if(AJ&&x.o.top&&!f.top){let kind=x.o.suitDay?'suit':'blazer';
      if(!kinds.has(kind)&&!occOf(r)){kind=kind==='suit'?'blazer':'suit';r.kind=kind}
      if(kinds.has(kind))skip.top=[...new Set([...(skip.top||[]),...out(kind,AJ)])]}
    if(AS&&x.o.shoes&&!f.shoes)skip.shoes=[...new Set([...(skip.shoes||[]),...out('shoes',AS)])];
    r.skip=skip;recs[x.k]=r}
  return recs}
const packComplete=o=>!!(o&&o.shirt&&o.shoes&&(o.suitDay?o.top:o.bot)&&(o.top||o.occasion==='casual'));
/* how good a set of days is: the outfits' scores, a real mistake and a missing piece counted heavily, and going over the limit most */
function packRate(days,J,S){let v=0;for(const x of days){if(!x.o)continue;if(!packComplete(x.o)){v-=1000;continue}const r=rateOutfit(x.o);v+=r.score-(r.hard&&r.hard.length?50:0)}
  if(J)v-=3000*Math.max(0,packUses(days,'top')-J);if(S)v-=3000*Math.max(0,packUses(days,'shoes')-S);return v}
const packAvg=days=>{const l=days.filter(x=>x.o);return l.length?Math.round(l.reduce((s,x)=>s+rateOutfit(x.o).score,0)/l.length):0};
/* the lighter plan for the trip, or null when no limit is set or the plan is within it already → {days, recs, j, s} */
function packLight(t,base){const J=t.j,S=t.s,nj=packUses(base,'top'),ns=packUses(base,'shoes');
  if(!(J&&nj>J)&&!(S&&ns>S))return null;
  const sig=[t.a,t.b,J,S].join();if(packMemo&&packMemo.c===cache&&packMemo.recs===dayRecs&&packMemo.sig===sig)return packMemo.res;
  const tj=packTally(base,'top'),jSets=packSets(tj,J,PACK_TRIES),sSets=packSets(packTally(base,'shoes'),S,PACK_TRIES),end=keyDate(t.b);
  // with room for two jackets on a trip with suit days and blazer days, one of each comes first
  if(J>=2&&jSets[0]&&new Set(tj.map(e=>e.i.type)).size>1&&new Set([...jSets[0].values()].map(i=>i.type)).size<2){
    const keep=tj.filter(e=>jSets[0].has(e.i.id)),other=tj.find(e=>e.i.type!==keep[0].i.type),drop=[...keep].reverse().find(e=>!e.pin);
    if(other&&drop)jSets.unshift(new Map(keep.filter(e=>e!==drop).concat(other).map(e=>[e.i.id,e.i])))}
  let best=null;
  for(const AJ of jSets.slice(0,PACK_TRIES))for(const AS of sSets){const recs=packLightRecs(base,AJ,AS),days=packDays(t,packPlanOf(recs,end)),v=packRate(days,J,S);
    if(!best||v>best.v)best={v,days,recs}}
  const res={days:best.days,recs:best.recs,j:packUses(best.days,'top'),s:packUses(best.days,'shoes')};
  packMemo={c:cache,recs:dayRecs,sig,res};return res}
/* what the lighter list saves against the usual one: "2 suits · 1 pair of shoes" */
function packSaved(a,b){const n=(l,t)=>l.groups.reduce((s,g)=>s+g.lines.filter(x=>x.type===t&&x.i).length,0)+l.worn.filter(x=>x.type===t).length;
  const less=[],more=[];for(const t of Object.keys(TYPES)){const d=n(a,t)-n(b,t);if(d>0)less.push(packN(d,t));if(d<0)more.push(packN(-d,t))}
  return {less:less.join(' · '),more:more.join(' · ')}}

/* ---- keep these outfits: the planner's lock on every day of the trip ---- */
const packLive=days=>days.filter(x=>x.o&&!x.o.frozen);
function packLockState(days){const live=packLive(days);let n=0;
  for(const x of live){const r=dayRecs[x.k],l=lockIds(x.o);if(r&&r.lock&&Object.keys(l).every(s=>(r.lock[s]||null)===(l[s]||null)))n++}
  return {n,of:live.length}}
async function packLockDays(days,light){
  for(const x of packLive(days)){const r={...(dayRecs[x.k]||{date:x.k}),lock:lockIds(x.o)};
    if(light&&x.o.top&&(r.kind||light[x.k]&&light[x.k].kind))r.kind=x.o.suitDay?'suit':'blazer';   // a day that took the other kind of jacket keeps it
    await saveDay(r,true)}
  if(window.scheduleSync)scheduleSync()}
async function packLock(){if(!packNow)return;await packLockDays(packNow.days,packNow.light&&packNow.light.recs);const kept=!!packNow.light;renderPack();
  toast(kept?'Lighter plan kept: these outfits now stay as shown.':'These outfits now stay as shown.')}
async function packRelease(){if(!packNow)return;let n=0;
  for(const x of packLive(packNow.days)){const r=dayRecs[x.k];if(!r||!r.lock)continue;const c={...r};delete c.lock;await saveDay(c,true);n++}
  if(n&&window.scheduleSync)scheduleSync();renderPack();toast('Released: the plan can change these days again.')}

/* ---- the trip's settings, ticks and travel wear ---- */
function packSetDate(which,v){if(!/^\d{4}-\d\d-\d\d$/.test(v||''))return renderPack();const t={...packTrip(),[which]:v};
  if(t.a>t.b)t[which==='a'?'b':'a']=v;
  const last=new Date(keyDate(t.a));last.setDate(last.getDate()+PACK_MAX-1);
  if(t.b>isoKey(last)){t.b=isoKey(last);toast(`A trip can be up to ${PACK_MAX} days here.`)}
  packT=t;packWrite('pack_trip',t);renderPack()}
function packSetCap(which,v){packT={...packTrip(),[which]:+v||0};packWrite('pack_trip',packT);renderPack()}
function packNoCap(){packT={...packTrip(),j:0,s:0};packWrite('pack_trip',packT);renderPack()}
function packTick(ix,on){const l=packLines[ix];if(!l)return;packSetMark(m=>{m.t=m.t.filter(k=>k!==l.key);if(on)m.t.push(l.key)});packProgress()}
function packProgress(){const el=$('#pk-done');if(!el||!packNow)return;const T=new Set(packMark().t),all=packNow.list.groups.flatMap(g=>g.lines),n=all.filter(l=>T.has(l.key)).length;
  el.textContent=all.length?`${n} of ${all.length} packed`:''}
function packWear(ix,on){const l=packLines[ix];if(!l||!l.i)return;packSetMark(m=>{m.w=m.w.filter(k=>k!==l.key);if(on){m.w.push(l.key);m.t=m.t.filter(k=>k!==l.key)}});renderPack()}
/* an outfit's pieces as the list has them: the belt is the list's belt for those shoes' colour */
function packWornIds(o){const ids=new Set(SLOTS.filter(s=>s!=='belt'&&o[s]).map(s=>o[s].id));
  if(o.shoes&&packNow){const g=leatherGroup(planCol(o.shoes)),b=packNow.list.groups.flatMap(x=>x.lines).concat(packNow.list.worn).find(l=>l.type==='belt'&&l.i&&leatherGroup(planCol(l.i))===g);if(b)ids.add(b.key)}
  return [...ids]}
/* wear one day's whole outfit on the way (or pack it again) */
function packWearDay(k){if(!packNow)return;const x=packNow.days.find(y=>y.k===k);if(!x||!x.o)return;const ids=packWornIds(x.o),W=new Set(packMark().w),all=ids.every(i=>W.has(i));
  packSetMark(m=>{m.w=m.w.filter(i=>!ids.includes(i));if(!all){m.w.push(...ids);m.t=m.t.filter(i=>!ids.includes(i))}});renderPack()}

/* ---- the list as plain text ---- */
function packText(t,days,list){const live=days.filter(x=>x.o),out=[`Packing list · ${packDate(keyDate(t.a))} – ${packDate(keyDate(t.b))}`];
  const c=packCount(list.counts);if(c)out.push(c);
  for(const g of list.groups){out.push('',g.title);for(const l of g.lines)out.push(`- ${l.name}${live.length>1||l.n>1?' · '+packDaysTxt(l.n):''}`)}
  if(list.worn.length){out.push('','Wearing on the way (not packed)');for(const l of list.worn)out.push(`- ${l.name}`)}
  out.push('','Outfits');
  for(const x of days)out.push(`- ${packDate(x.d)}: ${x.o?[shortTop(x.o),shortRest(x.o),x.o.shoes&&colName(primaryCol(x.o.shoes))+' shoes'].filter(Boolean).join(' · '):x.wd?'nothing planned':'day off'+(x.off?' ('+x.off+')':'')}`);
  return out.join('\n')}
async function packCopy(){if(!packNow)return;const text=packNow.text;let ok=false;
  try{await navigator.clipboard.writeText(text);ok=true}catch(e){
    try{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(ta);ta.select();ok=document.execCommand('copy');ta.remove()}catch(e2){}}
  toast(ok?'List copied.':'Could not copy the list here.')}
async function packShare(){if(!packNow||!navigator.share)return;try{await navigator.share({title:'Packing list',text:packNow.text})}catch(e){}}

/* ---- the page ---- */
function packShow(t){const el=$('#pack');if(!el)return;el.hidden=t!=='pack';if(t==='pack')renderPack()}
function openPack(){closeSettings();show('pack');scrollTo({top:0})}
function renderPack(){
  const el=$('#pack');if(!el)return;
  const head=n=>`<div class="phead"><button class="pback" onclick="show('today')" aria-label="Back to Today">‹</button><h2>Packing list</h2>${n?`<span class="pcount">${n}</span>`:''}</div>`;
  if(!items.length){packNow=null;el.innerHTML=head('')+`<p class="mut empty">Your wardrobe is empty. Add some items first.</p>`;return}
  const t=packTrip(),base=packDays(t),light=packLight(t,base),days=light?light.days:base,mark=packMark(),list=packList(days,mark.w),live=days.filter(x=>x.o),T=new Set(mark.t),W=new Set(mark.w);
  packNow={days,list,light,text:packText(t,days,list)};packLines=[];
  const capSel=(id,which,v,word)=>`<label class="pk-f">${word}<select id="${id}" onchange="packSetCap('${which}',this.value)">${[0,1,2,3,4].map(n=>`<option value="${n}"${n===v?' selected':''}>${n||'No limit'}</option>`).join('')}</select></label>`;
  // pack lighter
  const nj=packUses(base,'top'),ns=packUses(base,'shoes'),uses=(j,s)=>`${j} jacket${j===1?'':'s'} and ${packN(s,'shoes')}`;
  let lightTxt,lightBtns='';
  if(!live.length&&!light)lightTxt='';
  else if(light){const sv=packSaved(packList(base,mark.w),list),over=(t.j&&light.j>t.j)||(t.s&&light.s>t.s),a0=packAvg(base),a1=packAvg(days);
    lightTxt=`<p class="pk-note" id="pk-light"><b>${over?'The closest plan':'A lighter plan'}: ${uses(light.j,light.s)}</b> instead of ${uses(nj,ns)}. ${sv.less?`It saves ${sv.less}`:'It packs the same number of pieces'}${sv.more?` and adds ${sv.more}`:''}. Outfit score ${a1} on average${a1!==a0?` (${a0} before)`:''}. The outfits below show it; nothing is changed until you keep it.</p>`;
    lightBtns=`<div class="btns"><button type="button" class="pri" id="pk-keep" onclick="packLock()">Keep this plan</button><button type="button" id="pk-nocap" onclick="packNoCap()">Don’t limit</button></div>`}
  else lightTxt=`<p class="pk-note" id="pk-light">${t.j||t.s?'Within your limit: the':'The'} trip uses ${uses(nj,ns)}.</p>`;
  // the days
  const dayRow=x=>`<div class="pk-day${x.o?'':' off'}"><span class="pk-dn">${packDate(x.d)}</span>${x.o?`${stackSVG(x.o,'pk-stack')}<span class="pk-what"><b>${esc(shortTop(x.o))}</b><small>${esc([shortRest(x.o),x.o.shoes&&colName(primaryCol(x.o.shoes))+' shoes'].filter(Boolean).join(' · '))}</small></span>`:`<span class="pk-what"><small>${x.wd?'Nothing planned':esc('Day off'+(x.off?': '+x.off:''))}</small></span>`}</div>`;
  // to pack
  const line=l=>{const ix=packLines.push(l)-1,one=live.length<2&&l.n<2;
    return `<div class="pk-line"><label class="pk-tick"><input type="checkbox" ${T.has(l.key)?'checked':''} onchange="packTick(${ix},this.checked)"><span class="pk-sw">${l.i?swatchSVG(l.i,true):''}</span><span class="pk-nm">${esc(l.name)}${one?'':` <small>· ${packDaysTxt(l.n)}</small>`}</span></label>${l.i?`<button type="button" class="pk-wear" aria-pressed="false" aria-label="Wear the ${esc(l.name)} on the way" onclick="packWear(${ix},true)">Wear</button>`:''}</div>`};
  const wornLine=l=>{const ix=packLines.push(l)-1;return `<div class="pk-line worn"><span class="pk-tick"><span class="pk-sw">${swatchSVG(l.i,true)}</span><span class="pk-nm">${esc(l.name)}</span></span><button type="button" class="pk-wear" aria-pressed="true" aria-label="Pack the ${esc(l.name)} instead" onclick="packWear(${ix},false)">Pack</button></div>`};
  const first=live[0],firstAll=first&&packWornIds(first.o).every(i=>W.has(i));
  const lock=packLockState(days),allLocked=lock.of>0&&lock.n===lock.of;
  const span=days.length;
  el.innerHTML=head(packDaysTxt(span))+
    `<div class="card pk-card pk-dates"><label class="pk-f">First day<input type="date" id="pk-a" value="${t.a}" onchange="packSetDate('a',this.value)"></label><label class="pk-f">Last day<input type="date" id="pk-b" value="${t.b}" min="${t.a}" onchange="packSetDate('b',this.value)"></label></div>`+
    `<div class="card pk-card" id="pk-lighter"><h3>Pack lighter</h3><p class="mut pk-help">Limit how many jackets (suits and blazers) and pairs of shoes the trip uses.</p><div class="pk-caps">${capSel('pk-j','j',t.j,'Jackets')}${capSel('pk-s','s',t.s,'Pairs of shoes')}</div>${lightTxt}${lightBtns}</div>`+
    `<div class="card pk-card" id="pk-days"><h3>Outfits${light?' <small class="pk-tag">Lighter plan</small>':''}</h3>${days.map(dayRow).join('')}</div>`+
    (live.length?`<div class="card pk-card" id="pk-list"><div class="pk-h"><h3>To pack</h3><small class="mut" id="pk-done"></small></div><p class="pk-count" id="pk-count">${esc(packCount(list.counts)||'Nothing left to pack')}</p>`+
      list.groups.map(g=>`<div class="pk-group"><h4>${g.title}</h4>${g.lines.map(line).join('')}</div>`).join('')+
      `<div class="pk-group pk-travel"><h4>Wearing on the way</h4>${list.worn.length?list.worn.map(wornLine).join(''):''}<p class="mut pk-help">${list.worn.length?'Not counted as packed.':'Tap Wear on what you travel in, and it isn’t counted as packed.'}</p>${first?`<button type="button" id="pk-wearday" onclick="packWearDay('${first.k}')">${firstAll?`Pack ${esc(packDate(first.d))}’s outfit instead`:`Travel in ${esc(packDate(first.d))}’s outfit`}</button>`:''}</div>`+
      `<div class="btns pk-out"><button type="button" class="pri" id="pk-copy" onclick="packCopy()">Copy list</button>${navigator.share?`<button type="button" id="pk-share" onclick="packShare()">Share</button>`:''}</div></div>`
      :`<p class="mut empty" id="pk-none">No outfits are planned for these days.</p>`)+
    (lock.of&&!light?`<div class="card pk-card" id="pk-lock"><h3>Keep these outfits</h3><p class="pk-note" id="pk-lockmsg">${allLocked?'<b>Locked.</b> These outfits stay as shown, whatever you change on other days.':lock.n?`<b>${lock.n} of ${lock.of} days locked.</b> The others can still change when another day changes or you add an item.`:'<b>Not locked.</b> The list is only right while the plan doesn’t move: a change on another day or a new item can still change these outfits.'}</p><div class="btns">${allLocked?'':`<button type="button" class="pri" id="pk-lockbtn" onclick="packLock()">Keep these outfits</button>`}${lock.n?`<button type="button" id="pk-release" onclick="packRelease()">Let the plan change again</button>`:''}</div><p class="mut pk-help">The app keeps the next 7 days as shown by itself. A swap you make on one of these days re-plans that day only.</p></div>`:'');
  packProgress()}
