/* Daily Wardrobe: Today: the weather kept on the device, the pieces list and its rows (slots, toggleRow, setOff, the pieces box), the
   figure and its tiles, the worn pill and the date bar, a new calendar day, renderToday, what a screen reader hears, folding everything
   on a swipe (foldAll), stepping a day (stepDay) and the month planned with other records (planWith)
   (An ES module, at its place in index.html's order; split out of app.js on 2026-11-14, and on
   2026-11-17 (Round C) into today-plan.js, today.js, today-photofold.js, today-picture.js and today-gestures.js, in that order.) */
import {on,emit,serve} from './bus.js';
/* the day records and the week's locks a drawing of Today writes (recordDays, lockUpcoming) run in the background; recordRun is the latest
   run, so a test can wait until a device has finished writing before it counts its syncs (tests/sync.test.js quiet) */
let recordRun=Promise.resolve();
// once the phone is idle: plan the month for real; Today is redrawn only if it differs, and the day records and locks are written then
function planSnapCheck(){const k=cache.snap;if(!k)return;const shown=cache[k];delete cache[k];cache.snap=null;const [y,m]=k.split('-').map(Number);
  const real=planMonth(y,m),same=Object.keys(real).length===Object.keys(shown).length&&Object.keys(real).every(d=>outSig(real[d])===outSig(shown[d]));
  if($('#today').hidden)return;if(!same||(typeof pulledYet==='function'&&!pulledYet()))return refreshToday();   // (before the first sync is merged, renderToday waits for it to record)
  if(items.length)recordRun=recordDays(real).then(lockUpcoming).then(planSnapSoon)}
/* the forecast and the climate kept on the device, read before Today is first drawn: loadWeather and loadClimate then find them
   unchanged, so start-up plans once instead of three times (without them, again with the climate, again with the forecast) */
function wxPreload(){const L=settings.location;if(!L)return;
  try{const c=JSON.parse(localStorage.getItem('wx_norm')||'null');if(c&&c.lat===L.lat&&c.lon===L.lon&&Array.isArray(c.months))setClimate(c.months)}catch{}
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');if(c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3)setWeather(c.days)}catch{}}

/* views */
/* (hasOutfit is today-plan.js's, canPick and slotLabel history.js's and homeDay month.js's since the restructure S3e, 2026-11-26: read
   here as globals) */
// no waistcoat without a tie: the vest row (and its +) goes with the tie
const vestRow=o=>!(o.suitDay&&hasVest(o.top)&&o.tie)?'':`<div class="row vest-row"><span class="mut">Vest</span>${o.vest?`<span class="dot">${swatchSVG(o.top,true)}</span><span class="cap">Matching vest</span>`:'<span class="mut none">Not today</span>'}${!canPick(o)?'':`<button class="swap" data-act="vestTap" data-on="${o.vest?0:1}" aria-label="${o.vest?'Leave off the vest':'Wear the vest'}" title="${o.vest?'Leave off the vest':'Wear the vest'}">${o.vest?'−':'+'}</button>`}</div>`;
/* the outfit list: tapping a piece's swatch or name unfolds its photo inside the list (the actual item, so you can see
   exactly which shirt it is); one at a time; items without a photo show their product picture or drawing */
let openRow=null;
const rowPic=i=>i.photo?`<img class="rpic" src="${srcOk(i.photo)}" alt="Photo of ${esc(desc(i)||nm(i))}">`:itemPic(i)?`<img class="rpic" src="${srcOk(itemPic(i).img)}" alt="Picture of ${esc(desc(i)||nm(i))}">`:`<div class="rpic draw">${itemThumb(i,true)}</div>`;
const rowPanel=i=>rowPic(i)+(i.photo?'':`<small class="mut rnote">No photo of this item yet${itemPic(i)?': a generated picture of it.':': this is how the app draws it.'}</small>`);
/* taking a piece off for the day (the owner's ask, 2026-11-13): the jacket (with its waistcoat; a suit's trousers stay) or the tie (with
   its clip), on today and the coming days; − beside the piece takes it off, + on its "Taken off" row puts it back (setOff). With a suit's
   jacket off its pants have ⇄ like any pants (the owner, 2026-11-16: "my pants are locked"): other pants are a pick (force.bot), the
   picker offers the suit's own pants back, and the jacket back on brings the whole suit */
const offOn=o=>!o.frozen&&o.occasion!=='casual';
const offBtn=(s,o)=>offOn(o)&&o[s]&&(s==='top'||s==='tie'||s==='pocket')?`<button class="swap offb" data-act="offTap" data-slot="${s}" data-on="1" aria-label="Take off the ${s==='top'?(o.suitDay?'suit jacket':'blazer'):s==='pocket'?'pocket square':'tie'}" title="Take off for the day">−</button>`:'';
/* the jacket taken off: a casual jacket picked by hand (a chore jacket, the uniform blouse) is called by its type (2026-11-17), from the
   day's pinned top */
const offTop=()=>{const r=dayRecs[key(sel)],id=r&&r.force&&r.force.top,i=id&&items.find(x=>x.id===id);return i&&isHandPick(i)?i:null};
const offRow=(s,o)=>{const ht=s==='top'&&offTop(),l=s==='top'?(ht?TYPES[ht.type]:o.offKind==='suit'?'Suit':'Blazer'):s==='pocket'?'Pocket square':'Tie',w=s==='top'?(ht?TYPES[ht.type].toLowerCase():o.offKind==='suit'?'suit jacket':'blazer'):s==='pocket'?'pocket square':'tie';
  return `<div class="ritem off-row" id="ri-${s}"><div class="row"><span class="mut">${l}</span><span class="mut none">Taken off${s==='top'&&o.suitBot?': the pants stay':''}</span>${o.frozen?'':`<button class="swap" data-act="offTap" data-slot="${s}" data-on="0" aria-label="Put the ${w} back on" title="Put it back on">+</button>`}</div></div>`};
async function setOff(slot,on){const k=key(sel),o=planFor()[k];if(!o||o.frozen||(slot!=='top'&&slot!=='tie'&&slot!=='pocket'))return;
  const r={...(dayRecs[k]||{date:k})},off={...(r.off||{})};
  if(on){if(!o[slot])return;
    // the rest of the outfit is pinned, so taking a piece off changes nothing else (and putting it back brings the same piece)
    const force={...(r.force||{})};for(const s of SLOTS)if(o[s]&&!(s==='bot'&&(o.suitDay||o.suitBot)))force[s]=o[s].id;
    if(o.top)r.kind=o.suitDay?'suit':'blazer';r.force=force;off[slot]=true}
  // the suit jacket back on is the whole suit again: other pants picked while it was off (⇄ on the pants) let go
  else{delete off[slot];if(slot==='top'&&o.offKind==='suit'&&r.force&&r.force.bot){r.force={...r.force};delete r.force.bot}}
  if(off.top||off.tie||off.pocket)r.off=off;else delete r.off;delete r.lock;setSwapMsg('');await saveDay(r);renderToday()}
/* the uniform blouse's sleeves (2026-11-17, the owner: "he wears it with sleeves rolled sometimes"): a row under the blouse, per day
   (rec.roll), on today, the coming days and a past day being corrected; the drawings show the sleeves rolled (the painted master,
   2026-11-20 from the owner's photo, has them down) */
/* (2026-11-18, the third review) the rolled sleeves' bare forearms can't be made convincing from the sport-coat master (its arms are
   posed inside sleeves): the row stays off until a master with real bare forearms exists; a day already rolled shows it, to roll back */
let BLOUSE_ROLL_ON=false;
const rollRow=o=>!(o.top&&o.top.type==='blouse')||!(BLOUSE_ROLL_ON||o.rolled)?'':`<div class="row roll-row"><span class="mut">Sleeves</span><span class="cap">${o.rolled?'Rolled up':'Down'}</span>${!canPick(o)?'':`<button class="swap" data-act="rollTap" data-on="${o.rolled?0:1}" aria-label="${o.rolled?'Roll the sleeves down':'Roll the sleeves up'}" title="${o.rolled?'Roll them down':'Roll them up'}">${o.rolled?'↓':'↑'}</button>`}</div>`;
const rolledOf=(i,s,o)=>s==='top'&&o.rolled&&i&&i.type==='blouse'?{...i,rolled:true}:i;   // the row's drawing with the sleeves rolled (draw.js)
function rollTap(el){setRoll(el.dataset.on==='1')}   // (act.js: the Sleeves row's button)
async function setRoll(on){if(on&&!BLOUSE_ROLL_ON)return;const k=key(sel),o=planFor()[k];if(!o||!o.top||o.top.type!=='blouse'||!canPick(o))return;
  const r={...(dayRecs[k]||{date:k})};if(on)r.roll=true;else delete r.roll;await saveDay(r);renderToday()}
/* a jacket worn again too soon (rest under COOL days): "Add more suits" only when the suits in rotation that day (not away at the cleaner,
   not paused) are too few for a COOL-day rest; on a day the owner chose the jacket (a pick, a correction) it says only when it was last
   worn; otherwise (the planner's trade-off with three or more suits: an occasion, the season, the week's lock) nothing (W2-17-06: "Add
   more suits" with three suits owned) */
function restWarn(o){if(!o||!o.top||!(o.top.rest<COOL))return '';const kind=o.top.type==='suit'?'suit':'blazer',n=o.top.rest,ago=`${n} day${n===1?'':'s'} ago`;
  const have=items.filter(i=>i.type===o.top.type&&inRotation(i,di(sel))).length;if(isHandPick(o.top))return '';   // (a casual jacket picked by hand: no rest warning)
  if(have<COOL)return `<p class="warn">This ${kind} was worn ${ago}. Add more ${kind}s to get a ${COOL}-day rest.</p>`;
  const r=dayRecs[key(sel)],mine=o.frozen?!!(r&&r.edited):!!(r&&r.force&&r.force.top===o.top.id);
  return mine?`<p class="warn">You wore this ${kind} ${ago} too.</p>`:''}
/* the pocket square's row (2026-11-16): only with a jacket on, and only for someone who owns one (in rotation that day), or when the day has
   one or had it taken off; none planned: "Not today" with + to choose one (the picker); with one: ⇄ and − like the jacket and the tie */
const pocketRow=o=>!!o.top&&!!(o.pocket||(o.off&&o.off.pocket)||items.some(i=>i.type==='pocketsquare'&&(o.frozen||inRotation(i,di(sel)))));
const pocketNone=o=>`<div class="ritem" id="ri-pocket"><div class="row"><span class="mut">Pocket square</span><span class="mut none">${o.frozen?'None':'Not today'}</span>${canPick(o)?`<button class="swap" data-act="pickTap" data-s="pocket" aria-label="${o.frozen?'Choose the pocket square worn':'Wear a pocket square'}" title="${o.frozen?'Choose':'Choose one'}">${o.frozen?'⇄':'+'}</button>`:''}</div></div>`;
const slots=o=>{const nj=!o.top&&!needsJacket(o)&&!(o.off&&o.off.top),nt=!o.tie&&!needsTie(o)&&!(o.off&&o.off.tie)&&!(o.frozen&&pastEdit===key(sel));const rows=([...(nj?[]:[[slotLabel('top',o),o.top,'top']]),...(o.suitDay?[]:[['Pants',o.bot,'bot']]),[slotLabel('shirt',o),o.shirt,'shirt'],...(nt?[]:[['Tie',o.tie,'tie'],['Tie clip',o.clip,'clip']]),...(o.links||(o.shirt&&o.shirt.cuff==='french')?[['Cufflinks',o.links,'links']]:[]),...(pocketRow(o)?[['Pocket square',o.pocket,'pocket']]:[]),['Watch',o.watch,'watch'],['Belt',o.belt,'belt'],['Socks',o.socks,'socks'],['Shoes',o.shoes,'shoes'],...(o.coat||(o.clim&&(o.clim.cold||o.clim.rain))?[[o.coat?TYPES[o.coat.type]:'Coat',o.coat,'coat']]:[])])
  .filter(([l,i,s])=>!(s==='clip'&&!i&&(o.vest||!(o.frozen&&pastEdit===key(sel)))))   // no tie clip that day: no row (kept while correcting a past day, to add the one worn, but not on a vest day: the vest holds the tie, W2-17-20)
.filter(([l,i,s])=>!(s==='clip'&&o.off&&o.off.tie))
.map(([l,i,s])=>{if((s==='top'||s==='tie'||s==='pocket')&&!i&&o.off&&o.off[s])return offRow(s,o);if(s==='pocket'&&!i)return pocketNone(o);const open=!!i&&openRow===s;
  return `<div class="ritem${open?' open instant':''}" id="ri-${s}"><div class="row"><span class="mut">${l}</span>${i?`<button class="rowtap" data-act="rowTap" data-s="${s}" aria-expanded="${open}" aria-controls="rp-${s}" aria-label="${l}: ${esc(itemTitle(i)||nm(i))}. ${open?'Hide':'Show'} the photo"><span class="dot">${swatchSVG(i,true)}</span><span class="${titleCls(i)}">${esc(itemTitle(i))}</span></button>${canPick(o)?`<button class="swap" data-act="pickTap" data-s="${s}" aria-label="Change ${l.toLowerCase()}" title="Choose another">⇄</button>`:''}${offBtn(s,o)}`:`<span class="mut none">${s==='clip'&&o.vest?'Not with the vest':o.frozen?'None':`<button type="button" class="linkbtn addone" data-act="addOneTap" data-type="${addForSlot(s,o.suitDay)||''}" aria-label="${l}: none yet. Add one">Add one</button>`}</span>${o.frozen&&canPick(o)?`<button class="swap" data-act="pickTap" data-s="${s}" aria-label="Choose ${l.toLowerCase()}" title="Choose">⇄</button>`:''}`}</div>`+
    (i?`<div class="rpanel" id="rp-${s}"><div class="rpanel-in" data-act="rowTap" data-s="${s}">${open?rowPanel(rolledOf(i,s,o)):''}</div></div>`:'')+`</div>`});
  rows.splice(nj?0:1,0,vestRow(o)+rollRow(o));return rows.join('')};
function toggleRow(s){const el=$('#ri-'+s),o=planFor()[key(sel)];if(!el||!o||!o[s])return;const opening=!el.classList.contains('open');
  // another open photo (a row, or the tile's photo above the list) shuts at once; one above the tapped row is made up for by the scroll, so the row stays under the finger
  document.querySelectorAll('.ritem.open').forEach(r=>{if(r!==el){picSnap(r,el);const b=r.querySelector('.rowtap');if(b)b.setAttribute('aria-expanded','false')}});
  if(opening)el.querySelector('.rpanel-in').innerHTML=rowPanel(rolledOf(o[s],s,o));
  openRow=opening?s:null;const b=el.querySelector('.rowtap');b.setAttribute('aria-expanded',opening);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/(Show|Hide) the photo/,opening?'Hide the photo':'Show the photo'));
  if(opening)picOpenReady(el,el,()=>openRow===s);else picShut(el)}


/* ---- Today figure: torso in the day's fabrics, tap targets, selected-piece card, below-the-waist tiles ---- */
/* a tile under the figure unfolds the item's photo below the tiles, like the pieces list; tap it again (or the photo) to fold it */
let belowOpen=null;
const belowBox=(o,below)=>{const i=below.some(([s])=>s===belowOpen)&&o[belowOpen];if(!i)belowOpen=null;
  return `<div class="ritem bbox${i?' open instant':''}" id="bbox"><div class="rpanel" id="bpanel"><div class="rpanel-in" data-act="belowPicTap">${i?rowPanel(i):''}</div></div></div>`};
/* did you wear it: ✗ and ✓ over the picture's bottom corners (today and past days); tapping the chosen one again clears it.
   Between them, a small pill says when this look was last worn (nothing when it never was). */
/* (no share button on the picture: the owner, 2026-11-14, "the user can just send a screenshot") */
function swatchStack(o,up){const ps=[['top',o.top],['shirt',o.shirt],['tie',o.tie]].filter(([,i])=>i);if(!ps.length)return '';
  // each swatch is a button: it opens that piece up close (swTap)
  return `<div class="swstack${up?' up':''}" role="group" aria-label="${esc(ps.map(([s,i])=>slotLabel(s,o)+': '+itemTitle(i)).join('; '))}">${ps.map(([s,i])=>`<button type="button" class="ovsw" data-s="${s}" data-act="swatchTap" aria-pressed="false" aria-label="See the ${esc(slotLabel(s,o).toLowerCase())} up close: ${esc(itemTitle(i))}">${ovlPiece(i)}</button>`).join('')}</div>`}
/* (wardShort, the wardrobe can't dress a day yet, is month.js's since the restructure S3e, 2026-11-26: read here as a global) */
function wornBar(o){if(wardShort())return '';
  const lw=lastWorn(o);
  // "This look": the same jacket, shirt colour and tie (lastWorn), not the suit alone; "Last worn" read as the suit's own last wear, beside a
  // cleaning banner about the suit (audit 2026-11-14)
  const pill=lw?`<small class="lastworn">${typeof favLastIcon==='function'?favLastIcon(o):''}This look last worn ${lw.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</small>`:'';
  // (2026-11-14, the owner) no ✕ / ✓ circles on the picture any more: worn or not is the pill in the date bar (wornPill); only "Last worn"
  return pill?`<div class="wornbar">${pill}</div>`:''}
/* the date bar's pill, at the right end of the weather line, on today and past workdays with an outfit (the owner's design, 2026-11-14):
   a day is worn unless marked not (rec.worn false), so it starts "✓ Wore"; a tap makes it "✕ Didn't" (grey), a tap goes back. Back is
   the default (no mark), not rec.worn true, which would freeze today's outfit as worn */
function wornPill(o){const T=todayDate(),d=dayOnly(sel);if(+d>+T||!isWorkday(sel)||!hasOutfit(o))return '';
  const no=o.worn===false,pill=`<button type="button" class="wpill ${no?'no':'yes'}" id="wpill" aria-pressed="${!no}" data-act="wornTap" aria-label="Wore this outfit">${no?'✕ Didn\'t':'✓ Wore'}</button>`;
  // (favorites, 2026-11-18: a ♡ joined to the pill on a worn day loves the look, fav.js favPillSeg)
  const fav=typeof favPillSeg==='function'?favPillSeg(o):'';
  return fav?`<span class="wpgrp">${pill}${fav}</span>`:pill}
/* the date bar's weather line with the pill: the weather (or "Set location") sits centred between two pill-wide sides, unless that cuts
   it (Larger Text, page zoom: "Set loc…", then nothing; re-audit 2026-11-15); then it takes the line alone and the pill goes under it
   (.wxwrap). Measured after each drawing and when Today's size changes (the text size or the zoom changed) */
let wxFitOn=false,wxFitW=0,wxFitRaf=0;
function wxFit(){const w=document.querySelector('#today .day h2 .wx.haspill');
  // (from the observer: in the next frame, and only when the width changed; a class changed inside the observer's own callback was a
  // "ResizeObserver loop" error)
  if(!wxFitOn&&typeof ResizeObserver!=='undefined'){wxFitOn=true;new ResizeObserver(es=>{const x=Math.round(es[0].contentRect.width*100)+'|'+getComputedStyle(document.documentElement).fontSize;
    if(x===wxFitW)return;wxFitW=x;cancelAnimationFrame(wxFitRaf);wxFitRaf=requestAnimationFrame(wxFit)}).observe($('#today'))}
  if(!w||!w.offsetWidth)return;const s=w.querySelector('.wxc'),c=s&&(s.querySelector('.wxl')||s);w.classList.remove('wxwrap');
  const cut=!!c&&c.textContent.trim()!==''&&(c.scrollWidth>c.clientWidth+1||c.clientWidth<1);if(cut)w.classList.add('wxwrap')}
function toggleWorn(){const o=planFor()[key(sel)];if(!o)return;const no=o.worn!==false;
  // a line says what changed (W2-14-09: the pill turned gray with no word; W2-19-01: nothing was said); the toast is a status region, so it is read out too
  return setWorn(no?false:undefined).then(()=>toast(no?'Marked as not worn: this day won’t count as a wear. Tap again if you wore it.':'Marked as worn.',no?5000:2500))}
function figureStage(o){
  const below=[...(o.suitDay?[]:[['bot',o.bot]]),['belt',o.belt],['shoes',o.shoes],['socks',o.socks],...(o.coat?[['coat',o.coat]]:[])].filter(([,i])=>i);
  const tiles=below.map(([s,i])=>{const bg=itemPic(i)&&(picBgs[itemKey(i)]||PIC_BG);return `<button class="tile${s==='coat'?' coat-tile':''}${bg?' has-pic':''}" data-type="${i.type}"${bg?` style="background:${bg}"`:''}${s==='coat'?` data-coat="${i.type}"`:''} data-act="tileTap" data-s="${s}" aria-expanded="${belowOpen===s}" aria-controls="bpanel" aria-label="${slotLabel(s,o)}: ${shortDesc(i)}. ${belowOpen===s?'Hide':'Show'} the photo">${itemPicHtml(i,itemThumb(i))}<small>${slotLabel(s,o)}</small></button>`}).join('');
  const r=renderFor(o),photo=!!r;
  setTimeout(()=>fetchRemoteRender(o,key(sel)),0);   // missing here: fetch it; only here: share it
  if(asmLive())setTimeout(()=>asmEnsure(o),0);   // and its item photos, to put the outfit's picture together here
  schedulePrefetch();   // and the rest of the month's photos, nearest first
  // a painted (or kept) picture replaces the drawing; until it is ready the traced mannequin of the same pose shows (draw.js figureSvg).
  // Nothing paid is ever made from here (the drawn-figure photo was retired 2026-11-14)
  const cf=typeof careFrame==='function'?careFrame(o):null,cc=cf?cf.cls:'',ch=cf?cf.html:'';   // a suit or blazer coming due for cleaning (care.js)
  return (photo?`<div class="fig photo${cc}" id="mannequin-container"><img data-act-load="figLoad" src="${srcOk(r.img)}" alt="Photo of ${esc(figureLabel(o))}">${swatchStack(o)}${wornBar(o)}${ch}</div>`
    :`<div class="fig${cc}" id="mannequin-container">${figureSvg(o)}${wornBar(o)}${ch}</div>`)+
    (tiles?`<div class="below" style="--n:${below.length}" aria-label="${o.coat?'Coat and below the waist':'Below the waist'}" role="group">${tiles}</div>`+belowBox(o,below):'');
}
/* the painter's cloth for an item's mannequin is ready (draw.js figCuGet): Today's figure is drawn again with it, only while the day shown
   still wears that item as its jacket (or trousers with no jacket) and shows the mannequin; with Settings open, once it closes (todayStale) */
function figCuDone(id){const o=planFor()[key(sel)];if(!o||!((o.top&&o.top.id===id)||(!o.top&&o.bot&&o.bot.id===id)))return;
  if(settingsOpen()){todayDirty();return}
  const t=$('#today'),c=$('#mannequin-container'),svg=c&&c.querySelector(':scope > svg');if(!t||t.hidden||!svg||c.classList.contains('photo'))return;
  svg.outerHTML=figureSvg(o);applyZoom(false)}

let dayShown=null;   // the calendar day the app last drew, and whether it was showing "today's" outfit then
/* a new calendar day (the app brought back from the background, or left open past midnight): Today moves on to the new day's outfit (or the
   next workday's) when it was showing the old one, or a day that is now past. It used to move only when the day shown was the home day,
   and a weekend or day off shown as the calendar day never counted: opened on Friday, it still showed Friday on Sunday morning (audit
   2026-11-14, H8). A coming day the user stepped to stays. */
function newDayCheck(){const T=todayDate(),tk=key(T);if(!dayShown){dayShown={k:tk,home:true};return}
  if(dayShown.k===tk)return;const home=dayShown.home;dayShown={k:tk,home:true};planDirty();checkArrivals().then(n=>{if(n&&!$('#today').hidden)refreshToday()});
  const h=homeDay();if(home||isoKey(sel)<=isoKey(h)){setSel(new Date(h));setView({y:h.getFullYear(),m:h.getMonth()});setMonthOpen(false)}
  if(!$('#today').hidden)refreshToday()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;
  newDayCheck();try{const c=JSON.parse(localStorage.getItem('wx')||'null');if(settings.location&&(!c||Date.now()-c.t>3*3600e3))loadWeather()}catch{}
  setRemoteKeys(null);schedulePrefetch()});   // photos made on another device meanwhile
setInterval(()=>{if(document.visibilityState==='visible'&&window.appReady)newDayCheck()},60e3);   // left open across midnight: no visibility event comes
/* Today showing the home day (today, or the next workday) when a Settings change moves it (a workday or day off taken away): it follows
   (closeSettings, before Today is drawn again) */
function keepHome(){if(!dayShown||!dayShown.home||dayShown.k!==key(todayDate()))return;const h=homeDay();if(key(h)===key(sel))return;
  setSel(new Date(h));setView({y:h.getFullYear(),m:h.getMonth()});setMonthOpen(false)}
function pickPiece(s){const o=planFor()[key(sel)],el=$('#bbox');if(!o||!el||!s||!o[s])return;const opening=belowOpen!==s,was=el.classList.contains('open');
  belowOpen=opening?s:null;
  document.querySelectorAll('.below .tile').forEach(t=>{const on=opening&&t.getAttribute('data-s')===s;t.setAttribute('aria-expanded',on);
    t.setAttribute('aria-label',t.getAttribute('aria-label').replace(/(Show|Hide) the photo/,on?'Hide the photo':'Show the photo'))});
  const inn=el.querySelector('.rpanel-in');
  if(opening&&was){picStop(el);inn.innerHTML=rowPanel(o[s]);if(!noMotion())inn.animate([{opacity:0},{opacity:1}],{duration:200});return}   // another tile while one is open: its photo takes the place
  if(opening){inn.innerHTML=rowPanel(o[s]);picOpenReady(el,$('.below'),()=>belowOpen===s)}else picShut(el)}
/* where to add a piece (there is no Add tab: Add is the round + on the Wardrobe) */
/* a location is set but the day within the forecast's 16 days has no weather (it couldn't be fetched): say so, with a way to try again
   (fix round 3, W2-14-14: "Set location" went and the line stayed blank) */
function wxMissing(d,pill){const T=todayDate(),n=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()-T.getTime())/864e5);if(n<0||n>15)return '';
  return `<a href="#" class="wxl wxretry" data-act="wxRetryTap">${pill?'No forecast · retry':'No forecast yet: tap to try again'}</a>`}
const ADD_HINT='Add one with the + in the Wardrobe';
/* a missing piece's "Add one" opens Add for that type (openAdd(type), add.js addFor; W2-14-01): the jacket's by the day, a suit or a blazer */
const ADD_FOR_SLOT={bot:'pants',shirt:'shirt',tie:'tie',clip:'tieclip',pocket:'pocketsquare',links:'cufflinks',watch:'watch',belt:'belt',socks:'socks',shoes:'shoes',coat:'overcoat'};
const addForSlot=(s,suitDay)=>s==='top'?(suitDay?'suit':'blazer'):ADD_FOR_SLOT[s]||null;
/* a day before the wardrobe existed (planTrim leaves it out of the month): no outfit, and the page says why */
const preWardrobe=d=>{const s=planStartDay();return !!s&&d<s&&d<todayDate()};
/* a past day whose piece was deleted since (planner.js frozenOutfit, o.gone): the drawing can't show it, so the page says so */
const GONE_WORD={top:'jacket',bot:'pants',shirt:'shirt',tie:'tie',shoes:'shoes',belt:'belt',socks:'socks',watch:'watch',clip:'tie clip',links:'cufflinks',coat:'coat',pocket:'pocket square'};
const goneNote=o=>{const g=Object.keys(o.gone||{}).filter(s=>o.gone[s]&&GONE_WORD[s]&&!(s==='bot'&&o.gone.top&&o.suitDay!==false));if(!g.length)return '';const w=g.map(s=>s==='top'&&o.suitDay!==false?'suit':GONE_WORD[s]),l=w.length>1?w.slice(0,-1).join(', ')+' and '+w[w.length-1]:w[0];
  return `<p class="mut gonenote">The ${l} worn this day ${w.length>1||/s$/.test(l)?'are':'is'} no longer in your wardrobe, so the picture can’t show ${w.length>1||/s$/.test(l)?'them':'it'}.</p>`};
function goToday(){const h=homeDay();setSel(new Date(h));setView({y:h.getFullYear(),m:h.getMonth()});setMonthOpen(false);show('today');scrollTo({top:0,behavior:'smooth'})}
/* ---- the day's pieces: a folded box (a strip of fabric chips, like the month box) that unfolds into the full list ---- */
let listOpen=false;
function piecesBox(o){
  const pcs=[['top',o.top],['vest',o.vest?o.top:null],['bot',o.suitDay?null:o.bot],['shirt',o.shirt],['tie',o.tie],['clip',o.clip],['links',o.links],['pocket',o.pocket],['watch',o.watch],['belt',o.belt],['socks',o.socks],['shoes',o.shoes],['coat',o.coat]].filter(([,i])=>i);
  const chips=pcs.map(([s,i])=>`<span class="pchip${s==='vest'?' vest':''}" title="${slotLabel(s,o)}: ${esc(s==='vest'?'matching vest':shortDesc(i)||nm(i))}">${swatchSVG(i,true)}</span>`).join('');
  const pp=piecesParts(o),sum=pp.map((t,k)=>nameHtml(k?t:sentence(t))).join(' · ');   // each name kept in its place in an English line (<bdi>, W2-16-10)
  return `<section class="mbox ibox${listOpen?' open instant':''}" id="ibox"><button class="month-link" data-act="listTap" aria-expanded="${listOpen}" aria-controls="ipanel" aria-label="Outfit pieces: ${pcs.length}. ${listOpen?'Fold away':'Show the list'}">
    <span class="pstrip" aria-hidden="true" style="--pc:${pcs.length<=6?pcs.length:Math.ceil(pcs.length/2)}">${chips}</span><span class="mltxt"><b>${pcs.length} piece${pcs.length===1?'':'s'}</b><small class="cap">${sum||'Tap to see the list'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="ipanel"><div class="mpanel-in" data-act="listFoldTap"><div class="list">${slots(o)}</div>${canPick(o)&&!o.frozen?`<p class="plegend" aria-hidden="true"><span>⇄</span> choose another${offOn(o)&&(o.top||o.tie||o.pocket)?' · <span>−</span> take off for today':''}</p>`:''}</div></div></section>`}   // (the icons in words, W2-14-10; the buttons have their names already)
/* a tap inside the open pieces list that is not on a button, a link or a photo (e.g. on the names on the left) folds the list */
function foldListTap(e){if(!listOpen||e.target.closest('button,a,input,select,label,.rpanel'))return;toggleList()}
function toggleList(){const box=$('#ibox');if(!box)return;listOpen=!listOpen;
  const b=$('#ibox .month-link');b.setAttribute('aria-expanded',listOpen);b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show the list/,listOpen?'Fold away':'Show the list'));
  if(listOpen)boxUnfold(box);else boxFold(box,'#ipanel .list>*')}
function renderToday(){
  closeSettings();if(pastEdit&&pastEdit!==key(sel))setPastEdit(null);if(picker)closePicker();dayShown={k:key(todayDate()),home:key(sel)===key(homeDay())};
  const p=planFor(),snapped=!!(cache.snap&&p===cache[cache.snap]);
  // the day records are written before the drawing (recordDays puts them in memory at once, then saves): the missed days it records count
  // in this drawing's "last worn" and cleaning frame (fix round 3, W2-14-12: they changed a moment after opening)
  if(!snapped&&items.length&&typeof pulledYet==='function'&&pulledYet())recordRun=recordDays(p).then(lockUpcoming).then(()=>{planSnapSoon()});
  const o=p[key(sel)]||{suitDay:true,top:null,bot:null,shirt:null,tie:null,shoes:null,belt:null,socks:null,watch:null,clip:null};
  const nav=`<div class="nav day"><button data-act="dayStepTap" data-n="-1" aria-label="Previous day">‹</button><h2 aria-label="${esc(sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}))}"><span class="dlong">${sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><span class="dshort">${sel.toLocaleDateString(undefined,{weekday:'short',month:'long',day:'numeric'})}</span>${(()=>{const wp=wornPill(o);return `<small class="wx${wp?' haspill':''}"><span class="wxc${settings.location?'':' wxlk'}">${settings.location?(wxChip(sel)||wxMissing(sel,wp)):`<a href="#" class="wxl" data-act="wxSetTap">${wp?'Set location':'Set your location for weather'}</a>`}</span>${wp}</small>`})()}</h2><button data-act="dayStepTap" data-n="1" aria-label="Next day">›</button></div>`;
  // only the stage (the figure) slides on a swipe; the date bar and the item list stay put and just update
  let stage='',side='';const first=(typeof setupToday==='function'?setupToday():'')+(typeof kitSampleBanner==='function'?kitSampleBanner():'');   // what is still needed for a first outfit (setup.js)
  if(!isWorkday(sel))stage=first+(offName(sel)&&settings.workdays.includes(sel.getDay())?`<p class="mut empty">A day off: ${esc(offName(sel))}. You can change your days off in Settings.</p>`
    :`<p class="mut empty">${DAY_NAMES[sel.getDay()]} isn't a workday. You can change your workdays in Settings.</p>`);   // the checklist comes first on every day, above the figure or the day's note
  else if(items.length&&!p[key(sel)]&&preWardrobe(sel))stage=first+`<p class="mut empty" id="prewd">No outfit: your wardrobe starts on ${planStartDay().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}.</p>`;   // (it used to show a red "0 · Incomplete" and an empty figure)
  else if(items.length&&!p[key(sel)]&&sel<todayDate()&&dayRecs[key(sel)]&&dayRecs[key(sel)].noOutfit)stage=first+`<p class="mut empty" id="nooutfit">No outfit recorded: this day was dressed from the sample wardrobe, which you removed.</p>`;   // (kit.js kitSampleDay)
  else if(!items.length||(first&&!hasOutfit(o)))stage=first||`<p class="mut empty">Your wardrobe is empty. ${ADD_HINT} to get an outfit.</p>`;
  else{stage=first+figureStage(o);
    // the rest warning goes below the list so the list never shifts when it appears or disappears
    side=`${wardShort()?'':scoreCard(o)}${piecesBox(o)}${dayActions(o)}${goneNote(o)}${(o.notes||[]).map(t=>`<p class="warn">${t}</p>`).join('')}${restWarn(o)}${typeof careNote==='function'?careNote(o):''}`}
  if(typeof calBanner==='function')stage=calBanner(sel)+stage;   // new calendar events, a trip kept (calendar.js)
  keepFocus($('#today'),()=>{$('#today').innerHTML=nav+`<div class="daygrid"><div class="stage" id="stage"><div class="slide" id="slide">${stage}</div></div><div class="side">${side}${items.length?monthLink()+missedCard()+resetCard(isWorkday(sel)?o:null):''}</div></div>`;actTaps($('#today'))});applyZoom(false);swApply(false);fitNavSoon();wxFit();
  todaySay(o);
  if(snapped){const idle=self.requestIdleCallback||(f=>setTimeout(f,50));idle(planSnapCheck,{timeout:600})}   // the kept month: planned for real once idle (planSnapCheck records and locks then)
  else if(items.length&&!(typeof pulledYet==='function'&&pulledYet())&&!todayPullWait){setTodayPullWait(true);whenPulled(()=>{setTodayPullWait(false);if(!$('#today').hidden)refreshToday()})}   // (recorded above when pulled; else drawn again once the backup is merged, and recorded then)
}

/* what a screen reader hears after Today is drawn again (fix round 3, W2-19-01): another day, its date and outfit ("Tuesday, November 17:
   Navy suit, white shirt…"); the same day with other pieces (a pick, Suggest another, Reset, a piece taken off, a sync), the new pieces.
   Nothing on the first drawing, nor when nothing changed (a tab switch). */
let todaySaid=null;
function todaySay(o){const k=key(sel),h=$('#today .day h2 .dlong'),e=$('#slide .empty');
  const s=items.length&&isWorkday(sel)&&hasOutfit(o)&&typeof piecesLine==='function'?sentence(piecesLine(o)||''):e?e.textContent:'';
  const was=todaySaid;todaySaid={k,s};if(!was||!$('#today')||$('#today').hidden)return;
  if(was.k!==k)announce(`${h?h.textContent:''}: ${s}`);else if(was.s!==s&&s)announce('Now: '+s)}
/* a swipe to another day folds whatever is open (score, pieces list and its rows, a below-the-waist photo, the month) and zooms
   the picture back out: it starts as soon as the drag is known to be sideways, so the boxes fold while the day slides; meanwhile the folds
   are quiet (boxfold.js foldQuiet, told through bus.js: without boxfold.js the day still steps) */
function foldAll(){emit('folding-all',true);try{if(openRow)toggleRow(openRow);if(belowOpen)pickPiece(belowOpen);if(scoreOpen)toggleScore();if(listOpen)toggleList();if(monthOpen)toggleMonth()}
  catch(e){console.warn(e)}finally{emit('folding-all',false)}setMonthOpen(false);listOpen=false;setScoreOpen(false);belowOpen=openRow=null;zoomOut();if(typeof swClose==='function')swClose()}
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed (month.js nextWorkday).
   from: where the new day's outfit slides in from (px, sign = side); 0 = no animation */
function stepDay(n,from,times=1){
  let d=dayOnly(sel);for(let k=0;k<times;k++){const x=nextWorkday(d,n<0?-1:1);if(!x)break;d=x}
  foldAll();setSel(d);setView({y:d.getFullYear(),m:d.getMonth()});renderToday();
  const sl=$('#slide');if(!sl)return;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x||noMotion())return;   // reduced motion: the new day just shows
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';
  void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';
}
/* the month as it would be planned with these records (the real ones and the cache stay as they are) */
function planWith(recs,y,m){const keep=dayRecs;setWardrobe({days:recs});try{return planTrim(buildPlan(y,m))}finally{setWardrobe({days:keep})}}   // (trimmed like the month: the days before the wardrobe existed flashed invented outfits during a drag)
/* the markup's handlers (act.js). Today's markup has <div>s that take a tap (a row's photo, the photo under the tiles, the open list's
   own ground; scorecard.js's panel and swaps): renderToday calls actTaps on the page after writing it, so a phone's tap there is a click */
function todayTabTap(){if(typeof show==='function')goToday()}   // the Today tab (index.html); tapped before start.js has run (the scripts are deferred) it does nothing: start-up opens on Today
function vestTap(el){setVest(el.dataset.on==='1')}   // the Vest row's + / −
function offTap(el){setOff(el.dataset.slot,el.dataset.on==='1')}   // − beside the jacket, tie or pocket square (data-on 1), + on its "Taken off" row (0)
function pickTap(el){openPicker(el.dataset.s)}   // a row's ⇄ (and the pocket square's +): the picker for its slot
function rowTap(el){toggleRow(el.dataset.s)}   // a row's swatch and name, and its unfolded photo
function addOneTap(el){openAdd(el.dataset.type)}   // a missing piece's "Add one" (data-type: the type to add, '' when none)
function belowPicTap(){pickPiece(belowOpen)}   // the photo unfolded under the tiles
function tileTap(el){pickPiece(el.dataset.s)}   // a tile under the figure
function swatchTap(el){swTap(el.dataset.s)}   // a cloth swatch on the picture (today-picture.js)
function wornTap(){toggleWorn()}   // the date bar's Wore pill
function figLoad(){fitNavSoon()}   // the day's picture has loaded (data-act-load)
function wxRetryTap(el,ev){loadWeather(true);ev.preventDefault()}   // "No forecast · retry" (a link: it goes nowhere)
function wxSetTap(el,ev){openSettings('weather');ev.preventDefault()}   // "Set location"
function listTap(){toggleList()}   // the pieces box's head
function listFoldTap(el,ev){foldListTap(ev)}   // the open list's own ground
function dayStepTap(el){stepDay(+el.dataset.n)}   // the date bar's ‹ and ›
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setListOpen(v){listOpen=v}
/* The bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use as globals. Above acts({…}),
   the file's only top-level call that can throw: without act.js its names are still the page's */
Object.assign(globalThis,{wxPreload,figCuDone,keepHome,goToday,renderToday,foldAll,stepDay,planWith,setListOpen});
Object.defineProperties(globalThis,{recordRun:{get:()=>recordRun}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,get BLOUSE_ROLL_ON(){return BLOUSE_ROLL_ON},set BLOUSE_ROLL_ON(v){BLOUSE_ROLL_ON=v},get belowOpen(){return belowOpen},set belowOpen(v){belowOpen=v},get dayShown(){return dayShown},set dayShown(v){dayShown=v},figureStage,get openRow(){return openRow},set openRow(v){openRow=v},pickPiece,piecesBox,restWarn,setOff,setRoll,swatchStack,todayTabTap,toggleList,toggleRow,get listOpen(){return listOpen},set listOpen(v){listOpen=v}};
/* history.js (a swap, a pick, a mark, an occasion, Reset …) and month.js (a day opened) announce 'day-changed': Today is drawn again
   (bus.js; the restructure S3e, 2026-11-26: they run before this file). Above acts({…}), as the bridge */
on('day-changed',()=>renderToday());
/* nav.js (required, it runs before this file) draws Today when it is shown through the socket 'today-show' (the restructure S3e) */
serve('today-show',renderToday);
export {recordRun,wxPreload,openRow,setOff,BLOUSE_ROLL_ON,setRoll,restWarn,toggleRow,belowOpen,swatchStack,figureStage,figCuDone,dayShown,keepHome,pickPiece,goToday,listOpen,piecesBox,toggleList,renderToday,foldAll,stepDay,planWith,todayTabTap,setListOpen};
acts({rollTap,todayTabTap,vestTap,offTap,pickTap,rowTap,addOneTap,belowPicTap,tileTap,swatchTap,wornTap,figLoad,wxRetryTap,wxSetTap,listTap,listFoldTap,dayStepTap});
