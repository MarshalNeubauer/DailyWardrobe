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
function careRedraw(){if(typeof remindSoon==='function')remindSoon();/* the cleaning reminders follow a piece sent away or cleaned */const c=$('#care');if(c&&!c.hidden)renderCare();else if($('#wardrobe')&&!$('#wardrobe').hidden)renderWardrobe();else if($('#today')&&!$('#today').hidden)refreshToday()}
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
  for(const p of o.bot&&o.top&&o.bot.id===o.top.id?[o.top]:[o.top,o.bot]){if(!p||p.type!=='pants')continue;const limit=careLimit(p.type);if(limit<2)continue;   // (suits and blazers: the frame on the picture, careFrame)
    const n=(w[p.id]||0)+(counted?0:1);if(n<limit)continue;
    out.push(n===limit?`This is the ${careNoun(p)}'s ${n+(n===2?'nd':n===3?'rd':'th')} wear since cleaning: ${p.type==='pants'?'they are':'it is'} due for the cleaner after today.`:`${p.type==='pants'?'These trousers are':'This '+careNoun(p)+' is'} due for the cleaner: worn ${careTimes(n-(counted?0:1))} since cleaning, due after ${limit}.`)}
  return out.length?`<p class="carenote" id="carenote">${out.join(' ')} <a href="#" onclick="openCare();return false">See what is due</a></p>`:''}
/* ---- the cleaning frame on Today's picture (the owner's design, 2026-11-14) ----
   A suit or blazer one wear short of its cleaning limit has a yellow frame round the picture and a banner along its bottom ("1 wear left ·
   Suit – wear 4 of 5", wear dots on the left), on its last wear a red one ("Last wear · Suit – to the cleaner today"), and worn past it
   red "Overdue · Suit – worn 6 of 5". On today and coming days: the wears planned between today and the day are counted too, so a suit
   that is yellow today is red the next time it is planned. Both stay inside the picture: the frame is drawn inside its edge and the
   banner over its bottom, cut out round the tie swatch when the swatches reach down into it; careBandFit measures the swatch, so the cut
   follows it when the swatches shrink (a swatch tapped). On today and past days the ✕/✓ row and the swatches sit above the banner. */
const CARE_FRAME=['suit','blazer'],CARE_BH=40;
function careDayState(o,d){const p=o&&o.top;if(!p||!CARE_FRAME.includes(p.type)||o.frozen||p.away||!d)return null;
  const limit=careLimit(p.type);if(limit<2)return null;
  const T=todayDate(),day=new Date(d.getFullYear(),d.getMonth(),d.getDate());if(+day<+T)return null;
  let n=careCounts()[p.id]||0;   // the days really worn since cleaning (today only once marked worn)
  for(const x=new Date(T);+x<=+day;x.setDate(x.getDate()+1)){const k=key(x),r=dayRecs[k];
    if(r&&(r.worn===false||(+x===+T&&r.worn===true)))continue;   // marked not worn; today marked worn is counted already
    const q=+x===+day?o:planMonth(x.getFullYear(),x.getMonth())[k];if(q&&q.top&&q.top.id===p.id)n++}
  if(n<limit-1)return null;const what=p.type==='suit'?'Suit':'Blazer';
  return n===limit-1?{k:'near',n,limit,bold:'1 wear left',rest:`${what} – wear ${n} of ${limit}`}
    :n===limit?{k:'last',n,limit,bold:'Last wear',rest:`${what} – to the cleaner today`}:{k:'over',n,limit,bold:'Overdue',rest:`${what} – worn ${n} of ${limit}`}}
/* what figureStage (today.js) puts in the picture's frame: {cls, html}, or null */
function careFrame(o){const s=typeof sel!=='undefined'&&careDayState(o,sel);if(!s)return null;
  const dots=Array.from({length:s.limit},(_,i)=>`<i${i<s.n?' class="on"':''}></i>`).join('')+(s.n>s.limit?`<em>+${s.n-s.limit}</em>`:'');
  return {cls:` cb care-${s.k}`,html:`<div class="cframe" aria-hidden="true"></div><div class="cband" id="cband" role="note"><svg aria-hidden="true"><path/></svg><div class="crow"><span class="cdots" aria-hidden="true">${dots}</span><span class="ctxt"><b>${s.bold}</b> · ${esc(s.rest)}</span></div></div>`,s}}
/* lay the banner out: its shape (the cut round the tie swatch when the swatch reaches into it) and its words (13 px, smaller down to 11,
   then the bold words on a line of their own) */
let careRO=null,careObs=[];
function careBandFit(){const fig=document.getElementById('mannequin-container'),band=fig&&fig.querySelector('.cband');if(!band)return;
  const W=fig.clientWidth,H=fig.clientHeight;if(!W||!H)return;const BH=CARE_BH,M=5,F=9,R=14,t=v=>Math.round(v*10)/10;
  const st=fig.querySelector('.swstack'),sws=fig.querySelectorAll('.swstack .ovsw'),sw=sws.length?sws[sws.length-1]:null;let cut=null;
  if(sw&&st&&getComputedStyle(st).opacity!=='0'){const fr=fig.getBoundingClientRect(),r=sw.getBoundingClientRect(),sy=r.top-fr.top;
    if(sy+r.height+M>H-BH)cut={nx:r.left-fr.left+r.width+M,ny:sy-M-(H-BH),cr:(parseFloat(getComputedStyle(sw).borderTopLeftRadius)||13)+M}}
  const d=!cut?`M0 0H${W}V${BH-R}A${R} ${R} 0 0 1 ${W-R} ${BH}H${R}A${R} ${R} 0 0 1 0 ${BH-R}Z`
    :cut.ny<=0?`M${t(cut.nx+F)} 0H${W}V${BH-R}A${R} ${R} 0 0 1 ${W-R} ${BH}H${t(cut.nx)}V${F}A${F} ${F} 0 0 1 ${t(cut.nx+F)} 0Z`
    :`M0 0H${W}V${BH-R}A${R} ${R} 0 0 1 ${W-R} ${BH}H${t(cut.nx)}V${t(cut.ny+cut.cr)}A${cut.cr} ${cut.cr} 0 0 0 ${t(cut.nx-cut.cr)} ${t(cut.ny)}H0Z`;
  const svg=band.querySelector('svg');svg.setAttribute('width',W);svg.setAttribute('height',BH);svg.setAttribute('viewBox',`0 0 ${W} ${BH}`);svg.querySelector('path').setAttribute('d',d);
  const row=band.querySelector('.crow'),txt=row.querySelector('.ctxt');row.style.left=(cut?t(cut.nx+12):14)+'px';
  if(txt.dataset.two){txt.innerHTML=txt.dataset.one;delete txt.dataset.two}row.style.fontSize='';txt.style.lineHeight='';
  for(let fs=13;fs>=11&&row.scrollWidth>row.clientWidth+1;fs-=.5)row.style.fontSize=fs+'px';
  if(row.scrollWidth>row.clientWidth+1){txt.dataset.one=txt.innerHTML;txt.dataset.two='1';txt.innerHTML=txt.innerHTML.replace(' · ','<br>');row.style.fontSize='12.5px';txt.style.lineHeight='1.2'}
  // follow the picture and the tie swatch as they change size (a swatch tapped shrinks the stack; the photo loading sets the height)
  if(typeof ResizeObserver==='function'){if(!careRO)careRO=new ResizeObserver(()=>requestAnimationFrame(careBandFit));
    if(careObs[0]!==fig||careObs[1]!==sw){careRO.disconnect();careRO.observe(fig);if(sw)careRO.observe(sw);careObs=[fig,sw]}}}
/* through a transition (the swatches moving and shrinking, about 0.45 s): laid out again every frame */
function careBandSoon(){if(!document.getElementById('cband'))return;const end=performance.now()+700;const step=()=>{careBandFit();if(performance.now()<end)requestAnimationFrame(step)};requestAnimationFrame(step)}
/* ---- cleaning reminders on the phone (the owner's ask, 2026-11-14; sent by the morning reminder's push, remind.js, sw.js) ----
   {YYYY-MM-DD: text} for the coming workdays: a suit's or blazer's last wear before cleaning, and a wear past it, on the morning it is
   planned (overdue: the first such morning only); and once due (worn up to its limit, not sent away or cleaned), one reminder the next workday
   morning still to come; neither again until it is cleaned (localStorage care_told {id: {c: its cleaned date then, d: due told, o: overdue told}}) */
function careReminders(days,time){const out={},T=todayDate(),add=(d,t)=>{const k=isoKey(d);out[k]=out[k]?out[k]+' '+t:t};
  const now=new Date(),[h,m]=String(time||'07:00').split(':').map(Number),past=now.getHours()*60+now.getMinutes()>=h*60+m&&isoKey(now)===isoKey(T);
  const wd=[];for(let g=0;g<days;g++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+g);if(isWorkday(d)&&!(g===0&&past))wd.push(d)}   // (today's time gone: from tomorrow)
  const plan=d=>planMonth(d.getFullYear(),d.getMonth())[key(d)],last={},nm=i=>{const n=String(i.name||'').trim(),d=desc(i)||'';return n||(new RegExp('\\b'+careNoun(i)+'\\b').test(d)?d:(d+' '+careNoun(i)).trim())};   // (its name as typed, else "navy suit")
  let told={};try{told=JSON.parse(localStorage.getItem('care_told')||'{}')||{}}catch{}
  const tk=isoKey(T),keep={},cOf=i=>i.cleaned||'';
  // a reminder of this kind (d: due, o: overdue) already sent this time round (since the piece was last cleaned), this morning included
  const sent=(i,f)=>{const t=told[i.id];return !!(t&&t.c===cOf(i)&&t[f]&&(t[f]<tk||(t[f]===tk&&past)))};
  const mark=(i,f,v)=>{keep[i.id]={...(keep[i.id]||{c:cOf(i)}),[f]:v}};
  for(const i of items){const t=told[i.id];if(t&&t.c===cOf(i))keep[i.id]={...t}}   // (kept while the piece isn't cleaned)
  wd.forEach((d,j)=>{const o=plan(d),s=o&&careDayState(o,d);if(!s)return;const p=o.top;
    if(s.k==='last'){add(d,`Last wear for the ${nm(p)} before cleaning: it goes to the cleaner after today.`);if(last[p.id]==null)last[p.id]=j}
    // overdue: the first morning it is planned past its limit only (the owner, 2026-11-14), once per cleaning
    else if(s.k==='over'&&!sent(p,'o')&&!(keep[p.id]&&keep[p.id].o&&keep[p.id].o<isoKey(d))){add(d,`The ${nm(p)} is overdue for cleaning: today is wear ${s.n} of ${s.limit}.`);mark(p,'o',isoKey(d))}});
  const w=careCounts();
  for(const i of items){if(!CARE_FRAME.includes(i.type)||i.away||i.order)continue;const L=careLimit(i.type);if(L<2||sent(i,'d'))continue;
    const j=(w[i.id]||0)>=L?0:last[i.id]!=null?last[i.id]+1:null;   // due already: the first morning to come; due after a coming last wear: the morning after
    const d=j!=null&&wd[j];if(!d)continue;const o=plan(d);
    if(o&&o.top&&o.top.id===i.id)continue;   // planned that day: that day's own line says it
    add(d,`The ${nm(i)} is due for the cleaner.`);mark(i,'d',isoKey(d))}
  try{localStorage.setItem('care_told',JSON.stringify(keep))}catch{}
  return out}
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
