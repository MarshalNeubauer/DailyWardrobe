/* Daily Wardrobe: laundry and dry cleaning (loaded after stats.js).
   Kept light: nothing has to be logged. Three things only:
   - away: a piece sent to the cleaner or put in the laundry (item.away {why, since, back}) is out of rotation exactly like a piece
     bought and on the way: item.paused, and item.arrives = the day it is back, so inRotation(i, n) in core.js, the planner, the
     picker and the locked week all leave it out and take it back the day after that date (checkArrivals in app.js, which also sets
     item.cleaned). "It's back" does the same by hand.
   - wears since cleaning: counted from the days really worn (wornDays in stats.js) after item.cleaned; a type's limit
     (settings.care, CARE_DEF) makes a piece due. Types washed after every wear (a limit of 1: shirts) are never flagged one by
     one: the Care page shows them as one line with "All washed today".
   - the Care page (#care, from Settings), a quiet tag in the Wardrobe grid and one line on Today when today's wear reaches the limit.
   The shirt rule (settings.laundryDays) is in planner.js outfit(). */
const CARE_TYPES=['suit','blazer','pants','shirt','tie','overcoat','raincoat'];   // the types with a wear limit in Settings
const CARE_ABLE=['suit','blazer','pants','shirt','tie','overcoat','raincoat','socks'];   // what can be sent away
const CARE_DEF={suit:5,blazer:6,pants:4,shirt:1};   // wears before cleaning; a type not listed is never due
const CARE_PLURAL={suit:'Suits',blazer:'Blazers',pants:'Trousers',shirt:'Shirts',tie:'Ties',overcoat:'Overcoats',raincoat:'Raincoats',socks:'Socks'};
const CARE_MAX=10;
const LAUNDRY_OPTS=[0,1,2,3,5,7];
const careLimit=t=>{const v=(settings.care||{})[t];return v==null?(CARE_DEF[t]||0):Math.max(0,Math.min(CARE_MAX,Math.round(+v)||0))};
const laundryDays=()=>Math.max(0,+(settings.laundryDays??1)||0);
const careWashed=t=>t==='shirt'||t==='socks';   // washed at home rather than cleaned: the wording, and which way "send" goes
const careWord=t=>careWashed(t)?'washing':'cleaning';
const careNoun=i=>i.type==='pants'?'trousers':(TYPES[i.type]||'item').toLowerCase().replace('dress ','');
const careTimes=n=>n===1?'once':n===2?'twice':n+' times';
const careName=i=>`${TYPES[i.type]||'Item'}: ${typeof esc==='function'&&String(i.name||'').trim()?esc(String(i.name).trim()):sentence(desc(i)||careNoun(i))}`;
/* wears since cleaning for every item: {id: count}. Kept on the plan cache, which is dropped whenever items, days or settings change */
function careCounts(){if(cache.careW)return cache.careW;const w={},by=Object.fromEntries(items.map(i=>[i.id,i]));
  for(const r of wornDays()){const k=isoKey(r.d);
    for(const id of new Set(Object.values(r.ids))){const i=id&&by[id];if(!i||(i.cleaned&&k<=i.cleaned))continue;w[id]=(w[id]||0)+1}}
  return cache.careW=w}
/* where a piece stands: wears, its type's limit, and due (at the limit) / near (one wear short, for limits of 3 and more).
   each = washed after every wear: counted, but never flagged by itself */
function careState(i){const wears=careCounts()[i.id]||0,limit=careLimit(i.type),each=limit===1,live=limit>1&&!i.away&&!i.order;
  return {wears,limit,each,due:live&&wears>=limit,near:live&&limit>2&&wears===limit-1,over:wears-limit}}
const careWornLine=i=>{const s=careState(i),w=careWord(i.type),since=i.cleaned?` since ${w} (${fmtDay(i.cleaned)})`:'';
  return (s.wears?`Worn ${careTimes(s.wears)}${since}`:i.cleaned?`Not worn${since}`:'Not worn yet')+(s.each?` · ${careWashed(i.type)?'washed':'cleaned'} after every wear`:s.limit?` · due after ${s.limit}`:'')};
/* the Wardrobe grid: the tag of a piece that is away, and a quiet one on a piece that is due */
const careTag=i=>i.away?(i.away.why==='laundry'?'In the laundry':'At the cleaner\'s')+(i.away.back?' · back '+fmtDay(i.away.back):''):'';
const careBadge=i=>careState(i).due?`<span class="caretag">Due for ${careWord(i.type)}</span>`:'';
const careBackHint=b=>b?`It joins your outfits again from the day after ${fmtDay(b)}.`:'It stays out of your outfits until you tap "It\'s back". Add a date to have that happen by itself.';
const careBackText=l=>l.length===1?`Your ${careNoun(l[0])} is back: it's in rotation again.`:`${l.length} pieces are back: they're in rotation again.`;
/* the item sheet's Care card (after the Rotation card) */
function careCard(i){if(!CARE_ABLE.includes(i.type)||i.order)return '';
  const id=i.id,a=i.away,first=careWashed(i.type)?['laundry','cleaner']:['cleaner','laundry'],lab={cleaner:'Send to the dry cleaner',laundry:'In the laundry'},s=careState(i);
  const body=a?`<p class="shelp carewhere">${a.why==='laundry'?'In the laundry':'At the cleaner\'s'} since ${fmtDay(a.since)}: it is out of your outfits.</p>`+
      `<div class="ordrow careback"><label class="ordate">Back on (optional) <input type="date" value="${a.back||''}" min="${isoKey(todayDate())}" onchange="careSetBack('${id}',this.value)"></label><small class="mut ordhint">${careBackHint(a.back)}</small></div>`+
      `<div class="btns"><button type="button" class="pri careitsback" onclick="careBack('${id}')">It's back</button></div>`
    :`<div class="btns">${i.paused?'':first.map(w=>`<button type="button" class="caresend" data-why="${w}" onclick="careSend('${id}','${w}')">${lab[w]}</button>`).join('')}${s.wears?`<button type="button" class="caredone" onclick="careCleaned('${id}')">${careWashed(i.type)?'Washed':'Cleaned'} today</button>`:''}</div>`;
  return `<section class="card ivsec ivcare" id="ivcare"><h3>Care</h3><p class="shelp carecount${s.due?' due':''}">${careWornLine(i)}${s.due?' · due now':''}</p>${body}</section>`}
/* redraw whichever page the change was made on */
function careRedraw(){const c=$('#care');if(c&&!c.hidden)renderCare();else if($('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();else if($('#today')&&!$('#today').hidden)refreshToday()}
/* upcoming days the piece was pinned to (a swap, a hand pick) let go of it, as when it is taken out of rotation: they are planned again */
async function careRelease(id){const T=todayDate();let n=0;
  for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if(d<T||r.worn===true||!r.force)continue;const f={...r.force};let hit=false;
    for(const [s,v] of Object.entries(f))if(v===id){delete f[s];hit=true}
    if(hit){const nr={...r,force:f};if(!Object.keys(f).length)delete nr.force;delete nr.ids;await saveDay(nr,true);n++}}
  return n}
/* send a piece away: out of rotation until it is back */
async function careSend(id,why,back){const it=items.find(x=>x.id===id);if(!it||it.away||it.paused||!CARE_ABLE.includes(it.type))return;
  const ok=/^\d{4}-\d{2}-\d{2}$/.test(back||'');
  it.away={why:why==='laundry'?'laundry':'cleaner',since:isoKey(todayDate()),back:ok?back:null};it.paused=true;if(ok)it.arrives=back;else delete it.arrives;
  await careRelease(id);await put(it);cache={};careRedraw();
  toast(it.away.why==='laundry'?'In the laundry.':'At the cleaner\'s.',5000,{label:'Undo',fn:()=>careUnsend(id)})}
async function careUnsend(id){const it=items.find(x=>x.id===id);if(!it||!it.away)return;delete it.away;delete it.paused;delete it.arrives;await put(it);cache={};careRedraw()}
/* the day it is back (empty = no date: it waits for "It's back") */
async function careSetBack(id,v){const it=items.find(x=>x.id===id);if(!it||!it.away)return;const ok=/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  it.away={...it.away,back:ok?v:null};if(ok)it.arrives=v;else delete it.arrives;await put(it);cache={};await checkArrivals();careRedraw()}
/* it is back: in rotation again, cleaned today */
async function careBack(id){const it=items.find(x=>x.id===id);if(!it||!it.away)return;
  it.cleaned=isoKey(todayDate());delete it.away;delete it.paused;delete it.arrives;await put(it);cache={};careRedraw();toast('Back in rotation, freshly cleaned.')}
/* cleaned without being sent away: the count starts again */
async function careCleaned(id){const it=items.find(x=>x.id===id);if(!it)return;const was=it.cleaned;
  it.cleaned=isoKey(todayDate());await put(it);cache={};careRedraw();
  toast(`${careWashed(it.type)?'Washed':'Cleaned'} today.`,5000,{label:'Undo',fn:async()=>{const x=items.find(y=>y.id===id);if(!x)return;if(was)x.cleaned=was;else delete x.cleaned;await put(x);cache={};careRedraw()}})}
/* every worn piece of a type washed after every wear (the shirts) in one tap */
async function careCleanedType(t){const day=isoKey(todayDate()),w=careCounts(),l=items.filter(i=>i.type===t&&w[i.id]&&!i.away);
  for(const it of l){it.cleaned=day;await put(it)}cache={};careRedraw();if(l.length)toast(`${l.length} ${l.length===1?careNoun(l[0]):(CARE_PLURAL[t]||'pieces').toLowerCase()} washed today.`)}
/* what the Care page lists */
function careLists(){const st=items.filter(i=>!i.order).map(i=>({i,s:careState(i)}));
  const ord=(a,b)=>b.s.over-a.s.over||b.s.wears-a.s.wears||(a.i.id<b.i.id?-1:1);
  return {due:st.filter(x=>x.s.due).sort(ord),near:st.filter(x=>x.s.near).sort(ord),
    each:CARE_ABLE.filter(t=>careLimit(t)===1).map(t=>({t,list:st.filter(x=>x.i.type===t&&x.s.wears>0&&!x.i.away).map(x=>x.i)})).filter(g=>g.list.length),
    away:items.filter(i=>i.away).sort((a,b)=>(a.away.back||'9')<(b.away.back||'9')?-1:1)}}
/* the Care page */
function renderCare(){const el=$('#care');if(!el)return;
  const head=`<div class="phead nav"><button class="pback" onclick="subBack()" aria-label="Back">‹</button><h2>Laundry &amp; cleaning</h2></div>`;
  if(!items.length){el.innerHTML=head+'<p class="mut empty">Your wardrobe is empty. Add some items first.</p>';return}
  const L=careLists(),pic=i=>typeof statPic==='function'?statPic(i):'';
  const row=(x,btns)=>`<div class="care-row" id="care-${x.id}">${pic(x)}<div class="care-main"><span class="cap care-nm">${careName(x)}</span><small class="mut">${x.away?careTag(x)+' · since '+fmtDay(x.away.since):careWornLine(x)}</small></div><div class="care-acts">${btns}</div></div>`;
  const acts=x=>{const w=careWashed(x.type)?'laundry':'cleaner';return `<button type="button" class="caresend" onclick="careSend('${x.id}','${w}')">${w==='laundry'?'In the laundry':'Send to the cleaner'}</button><button type="button" class="caredone" onclick="careCleaned('${x.id}')">${careWashed(x.type)?'Washed':'Cleaned'} today</button>`};
  const card=(id,title,sub,rows)=>`<section class="card care-card" id="${id}"><h3>${title}</h3>${sub?`<p class="shelp">${sub}</p>`:''}${rows}</section>`;
  const quiet=!L.due.length&&!L.near.length;
  el.innerHTML=head+`<p class="psub">What is due for cleaning, counted from the days you wore each piece. Nothing to log: tap only when something goes out or comes back.</p>`+
    (L.due.length?card('care-due','Due for cleaning',`${L.due.length} piece${L.due.length===1?' has':'s have'} reached ${L.due.length===1?'its':'their'} number of wears.`,L.due.map(x=>row(x.i,acts(x.i))).join('')):'')+
    (L.near.length?card('care-near','Nearly due','One more wear and these are due.',L.near.map(x=>row(x.i,acts(x.i))).join('')):'')+
    (quiet?card('care-none','Nothing is due','No suit, blazer or pair of trousers has reached its number of wears yet.',''):'')+
    (L.each.length?card('care-each','Washed after every wear','',L.each.map(g=>`<div class="care-row care-group" id="care-each-${g.t}"><div class="care-main"><span class="care-nm">${g.list.length} ${g.list.length===1?careNoun(g.list[0]):(CARE_PLURAL[g.t]||'pieces').toLowerCase()} worn since washing</span><small class="mut">${laundryDays()&&g.t==='shirt'?`A worn shirt is not planned again for ${laundryDays()} day${laundryDays()===1?'':'s'}.`:'Tap when the wash is done, or leave it: nothing depends on it.'}</small></div><div class="care-acts"><button type="button" class="caredone" onclick="careCleanedType('${g.t}')">All washed today</button></div></div>`).join('')):'')+
    (L.away.length?card('care-away','Away now','Out of your outfits until they are back.',L.away.map(x=>row(x,`<button type="button" class="pri careitsback" onclick="careBack('${x.id}')">It's back</button>`)).join('')):'')+
    `<p class="care-foot"><button type="button" class="linkbtn" onclick="openSettings('care')">Change how many wears each piece takes</button></p>`}
function openCare(){subOpen();closeSettings();show('care');scrollTo({top:0})}
/* called by show() in app.js for every page: the Care page is a section of its own beside the others */
function careShow(t){const el=$('#care');if(!el)return;el.hidden=t!=='care';if(t==='care')renderCare()}
/* Today: one quiet line when today's suit, blazer or odd trousers reaches its limit with this wear (or is past it) */
function careNote(o){if(!o||!isWorkday(sel)||key(sel)!==key(todayDate()))return '';
  const r=dayRecs[key(sel)],counted=!!(r&&r.worn===true),w=careCounts(),out=[];
  for(const p of o.bot&&o.top&&o.bot.id===o.top.id?[o.top]:[o.top,o.bot]){if(!p||!['suit','blazer','pants'].includes(p.type))continue;const limit=careLimit(p.type);if(limit<2)continue;
    const n=(w[p.id]||0)+(counted?0:1);if(n<limit)continue;
    out.push(n===limit?`This is the ${careNoun(p)}'s ${n+(n===2?'nd':n===3?'rd':'th')} wear since cleaning: ${p.type==='pants'?'they are':'it is'} due for the cleaner after today.`:`${p.type==='pants'?'These trousers are':'This '+careNoun(p)+' is'} due for the cleaner: worn ${careTimes(n-(counted?0:1))} since cleaning, due after ${limit}.`)}
  return out.length?`<p class="carenote" id="carenote">${out.join(' ')} <a href="#" onclick="openCare();return false">See what is due</a></p>`:''}
/* Settings → Care */
function renderCareUI(){const el=$('#care-limits');
  if(el)el.innerHTML=CARE_TYPES.map(t=>{const v=careLimit(t);return `<label class="srow">${CARE_PLURAL[t]} <select id="care-lim-${t}" onchange="setCareLimit('${t}',this.value)"><option value="0"${v===0?' selected':''}>Never</option><option value="1"${v===1?' selected':''}>After every wear</option>${Array.from({length:CARE_MAX-1},(_,k)=>k+2).map(n=>`<option value="${n}"${v===n?' selected':''}>After ${n} wears</option>`).join('')}</select></label>`}).join('');
  const s=$('#cfg-laundry');if(s){const d=laundryDays(),opts=[...new Set([...LAUNDRY_OPTS,d])].sort((a,b)=>a-b);
    s.innerHTML=opts.map(n=>`<option value="${n}"${n===d?' selected':''}>${n?`${n} day${n===1?'':'s'}`:'Not at all'}</option>`).join('')}
  const sum=$('#sum-care');if(sum){const lim=t=>{const v=careLimit(t);return v?`${CARE_PLURAL[t].toLowerCase()} after ${v} wear${v===1?'':'s'}`:''},parts=[lim('suit'),lim('blazer')].filter(Boolean);
    const d=laundryDays();sum.textContent=cap1((parts.length?parts.join(', '):'no wear limits')+` · a worn shirt waits ${d?d+' day'+(d===1?'':'s'):'no time'}`)}}
async function setCareLimit(t,v){if(!CARE_TYPES.includes(t))return;settings.care={...(settings.care||{}),[t]:Math.max(0,Math.min(CARE_MAX,Math.round(+v)||0))};await saveUserSettings();todayStale=true;renderCareUI()}
/* the shirt rule changes the plan: the days shown for the coming week are planned again with it */
async function setLaundryDays(v){settings.laundryDays=Math.max(0,Math.min(14,Math.round(+v)||0));await clearLocks();await saveUserSettings();todayStale=true;renderCareUI()}
