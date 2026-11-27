/* Daily Wardrobe: the month view (wear plan): the calendar of fabric stacks
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of app.js on 2026-11-14.) */
/* a day opened from the month says emit('day-changed') (bus.js; the restructure S3e, 2026-11-26): today.js, which runs after this file,
   pins renderToday for it */
import {emit} from './bus.js';
import {fabricDef} from './draw.js';
import {$,MONTH_EASE,MONTH_MS,colName,dayRecs,isWorkday,itemName,key,keyDate,occOf,offName,patName,primaryCol,shortCol,todayDate,wearsJacket} from './core.js';
import {cache,hasOutfit,planFor,planMonth} from './today-plan.js';
import {PAIR_DAYS,pairSeen,rateOutfit} from './planner.js';
import {sel,setSel,setView,view} from './app.js';
import {esc} from './photo-keys.js';
import {acts} from './act.js';
import {foldEdge,foldQuiet,keepInView,monthBelow,pageScroll,revealNeed} from './ui.js';
/* ---- month view (wear plan): a calendar of fabric stacks, from the design concept ---- */
/* stacked bands for one outfit: jacket, trousers on blazer days, shirt, tie (drawn from the tagged fabrics) */
let stkN=0;
/* rep: the shirt and tie bands get a gold border on the band's edge (the color stays visible): that shirt color and tie were together within
   the PAIR_DAYS workdays before (dayMarks) */
function stackSVG(o,cls='',rep=false){
  const P='st'+(stkN++)+'-',parts=[[o.top,'top',22],...(!o.suitDay&&o.bot?[[o.bot,'bot',9]]:[]),[o.shirt,'shirt',9],[o.tie,'tie',9]].filter(x=>x[0]);
  const H=parts.reduce((h,x)=>h+x[2],0)+(parts.length-1)*2;let y=0;
  const body=parts.map(([i,role,h],k)=>{const id=P+k,gold=rep&&(role==='shirt'||role==='tie'),r=`<rect y="${y}" width="40" height="${h}" rx="2.5" fill="url(#${id})"/>`+(gold?`<rect class="strep" x="-.6" y="${y-.6}" width="41.2" height="${h+1.2}" rx="3" fill="none" vector-effect="non-scaling-stroke"/>`:`<rect y="${y}" width="40" height="${h}" rx="2.5" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".6"/>`);y+=h+2;return `<defs>${fabricDef(id,i,role)}</defs>${r}`}).join('');
  return `<svg class="stack ${cls}" viewBox="0 0 40 ${H}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
/* the calendar's marks for a workday (2026-11-17, the score dials; the owner's approved design): rep, the same shirt color and tie as one of
   the PAIR_DAYS workdays before (planner.js pairSeen, the planner's pairRepeat rule; gold on the shirt and tie bands), bad, a broken rule
   (a hard check of rateOutfit; a red ring on the day). A day marked not worn has neither. Kept per day until the plan changes (cache.marks) */
function dayMarks(d,o){const k=key(d),m=cache.marks||(cache.marks={});if(m[k])return m[k];const r=dayRecs[k];let v={rep:false,bad:false};
  if(o&&hasOutfit(o)&&!(r&&r.worn===false))v={rep:pairSeen(o,recentWork(d))>=0,bad:(window.TEST_PLAN?TEST_PLAN.rate(o):rateOutfit(o)).hard.length>0};
  return m[k]=v}
const planOn=d=>planMonth(d.getFullYear(),d.getMonth())[key(d)];
/* the next workday after d (dir -1: the one before), at most NEXT_CAP days away; null when there is none (no workdays at all). The one
   step rule for the home day, ‹ and › and the formal-day form (CR-4-06: it gave up after 7 days, so a vacation or a long Eid break of
   own days off opened Today on a day off and stopped › inside it) */
const NEXT_CAP=400;
const nextWorkday=(d,dir=1)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());for(let g=0;g<NEXT_CAP;g++){x.setDate(x.getDate()+dir);if(isWorkday(x))return x}return null};
/* ---- back to today: the day to return to is today, or the next workday when today is off (from today.js, the restructure S3e,
   2026-11-26: history.js, missed.js, today.js, start.js and calendar.js ask it) ---- */
const homeDay=()=>{const T=todayDate();return isWorkday(T)?T:nextWorkday(T)||T};   // (no workday at all: today)
/* (dayWord and recentWork from scorecard.js, mvSig from today-gestures.js and wardShort from today.js, the restructure S3e,
   2026-11-26: the month, the score card, the picker's favorites, the move and Today read them) */
const dayWord=()=>key(sel)===key(todayDate())?'today':'this day';
/* the latest workdays before d with an outfit (a day marked not worn left out, as the planner's history does), latest first: [{d, o}] */
function recentWork(d,n=PAIR_DAYS){const out=[],x=dayOnly(d);for(let g=0;g<n*3+14&&out.length<n;g++){x.setDate(x.getDate()-1);if(!isWorkday(x))continue;
  const r=dayRecs[key(x)];if(r&&r.worn===false)continue;const o=planOn(x);if(o&&hasOutfit(o))out.push({d:new Date(x),o})}return out}
const mvSig=o=>o?[o.top&&o.top.id,o.bot&&o.bot.id,o.shirt&&o.shirt.id,o.tie&&o.tie.id].join('|'):'';
/* the wardrobe can't dress a day yet (setup.js setupNeeds: the "Get your first outfit" checklist shows): a half-outfit gets no score,
   no "This look last worn" and no outfit count (after removing the sample a suit and a shirt showed a red "50 Incomplete", "last worn
   Thu, Nov 19" and "12 outfits", re-audit 2026-11-15) */
const wardShort=()=>typeof setupNeeds==='function'&&setupNeeds().some(r=>!r.ok);
/* a date's calendar day, at midnight */
const dayOnly=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const shortTop=o=>{const t=o.top;if(!t)return o.bot?(wearsJacket()?`No jacket: ${colName(primaryCol(o.bot))} pants`:`${colName(primaryCol(o.bot))} pants`.replace(/^./,c=>c.toUpperCase())):'No jacket';const p=t.pattern&&t.pattern!=='solid'&&t.pattern!=='other'?' '+patName(t.pattern):'',n=colName(primaryCol(t))+p;
  const s=n.charAt(0).toUpperCase()+n.slice(1);return o.suitDay?s:`${s} blazer${o.bot?' + '+colName(primaryCol(o.bot))+' pants':''}`};
const tieWord=p=>({'polka-dot':'dot',stripe:'stripe',paisley:'paisley',check:'check',foulard:'foulard',knit:'knit'})[p]||'';
/* a shirt in a few words: a striped or checked one with its colours and pattern ("white & blue stripe shirt"; "white shirt" under a picture
   of blue stripes read as a mistake, audit 2026-11-14), a plain one by its colour */
const shirtWords=s=>s.pattern&&!['solid','other'].includes(s.pattern)?`${shortCol(s)} ${patName(s.pattern)}`:colName(primaryCol(s));
const shortRest=o=>[o.shirt&&shirtWords(o.shirt)+' shirt',o.tie&&[colName(primaryCol(o.tie)),tieWord(o.tie.pattern),'tie'].filter(Boolean).join(' ')].filter(Boolean).join(' · ').replace(/^./,c=>c.toUpperCase());
/* the outfit in a few words, the same everywhere it is named in one line (Today's pieces card, sharing, the morning reminder):
   "navy suit · white shirt · burgundy stripe tie" (sentence() capitalises it where it starts a line) */
/* the folded pieces box's line: jacket (or trousers), shirt and tie; a piece the owner named is called by its name, exactly as typed (2026-11-14,
   the owner: "Medium Grey suit", not "mid grey worsted suit"), the others by colour */
const piecesLine=o=>piecesParts(o).join(' · ');
/* the line's pieces one by one (Today draws each in its own <bdi> when it is a right-to-left name: nameHtml) */
const piecesParts=o=>{const nmd=i=>itemName(i);return [o.top?nmd(o.top)||`${colName(primaryCol(o.top))} ${o.suitDay?'suit':'blazer'}`:o.bot&&(nmd(o.bot)||`${colName(primaryCol(o.bot))} pants`),o.shirt&&(nmd(o.shirt)||`${shirtWords(o.shirt)} shirt`),
  o.tie&&(nmd(o.tie)||`${colName(primaryCol(o.tie))}${o.tie.pattern&&!['solid','other'].includes(o.tie.pattern)?' '+patName(o.tie.pattern):''} tie`)].filter(Boolean)};/* the month plan unfolds in place from the box on Today (no separate page) */
let monthOpen=false,monthPanel=null;
const monthPlan=planMonth;
function monthGridHtml(){
  const {y,m}=monthPanel,p=monthPlan(y,m),f=new Date(y,m,1),T=todayDate(),cells=[];let n=0;
  const w0=typeof weekFirst==='function'?weekFirst():0;   // the week starts on the work week's first day (settings.js weekFirst; audit 2026-11-15)
  for(let k=0;k<(f.getDay()-w0+7)%7;k++)cells.push('<span class="mc blank"></span>');
  for(const d=new Date(f);d.getMonth()===m;d.setDate(d.getDate()+1)){const k=key(d),o=p[k],wd=isWorkday(d),off=offName(d),work=wd&&hasOutfit(o),isT=+d===+T,past=d<T;
    // a past day marked "✕ Didn't" is not shown as worn (it was, exactly like one, audit 2026-11-14): faded, its number struck through;
    // a past workday with no outfit (before the wardrobe existed) is not "worn" either
    const skip=past&&work&&dayRecs[k]&&dayRecs[k].worn===false;
    const label=`${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}: ${work?`${skip?'not worn: ':''}${shortTop(o)}, ${shortRest(o)}`:wd?'no outfit recorded':off?'day off: '+off:'day off'}`;
    const mv=work&&!past&&!o.frozen&&!occOf(dayRecs[k]);   // a day whose outfit can be picked up and moved, or a day it can be dropped on
    const mk=work?dayMarks(d,o):{},mark=(mk.bad?', a rule broken':'')+(mk.rep?', the same shirt and tie within 10 workdays':'');
    cells.push(`<button class="mc ${!wd?'rest':skip?'skip':past&&work?'worn':past?'past':'planned'}${off&&!wd?' hol':''}${isT?' today':''}${k===key(sel)?' sel':''}${mk.bad?' bad':''}${mk.rep?' rep':''}" style="--i:${n++}" data-k="${k}"${work?` data-sig="${mvSig(o)}"`:''}${mv?' data-mv="1"':''} aria-label="${esc(label+mark)}"${k===key(sel)?' aria-current="date"':''} data-act="dayCellTap" data-t="${d.getTime()}"><span class="dn">${d.getDate()}</span>${work?stackSVG(o,'',mk.rep):wd?'<span class="stack none"></span>':'<span class="stack rest"></span>'}</button>`)}
  // no arrows, hint or legend: a swipe (or a mouse drag) inside the box moves between months (monthDrag); the title is centred; the cells still
  // show worn / today / planned / rest by their own look
  return `<div class="mswipe" id="mswipe"><div class="mhead"><h3>${f.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3></div>
    <div class="mgrid mdow" aria-hidden="true">${[0,1,2,3,4,5,6].map(i=>'SMTWTFS'[(i+w0)%7]).map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="mgrid">${cells.join('')}</div></div>
    <button class="foldbar" data-act="monthTap" aria-label="Fold away the month"><span class="fchev" aria-hidden="true">›</span>Fold away</button>`;
}
function toggleMonth(){const box=$('#mbox');if(!box)return;monthOpen=!monthOpen;const pin=$('#mpanel-in');
  if(monthOpen){monthPanel={y:sel.getFullYear(),m:sel.getMonth()};monthFill();box.classList.remove('instant')}
  if(pin)pin.inert=!monthOpen;
  $('#mbox .month-link').setAttribute('aria-expanded',monthOpen);
  const sm=$('#mbox .mltxt small');if(sm)sm.textContent=sm.textContent.replace(/tap to .*/,monthOpen?'tap to fold away':'tap to see the month');
  if(monthOpen)monthUnfold(box);else monthFold(box)}
/* Unfolding and folding the month without animating its height: an animated height laid the page out and repainted every day's
   drawing on every frame (30 layouts and 285 paints for one unfold), which was choppy on a phone. The page is laid out once, at the
   start of an unfold or the end of a fold, and the movement is the card's edge sliding (a strip, foldEdge: a clip-path here was
   repainted every frame by Safari and drifted from the slides), a slide for whatever is below it and a fade of the days, all of which
   the GPU draws; the scroll is pageScroll's (boxfold.js, with revealNeed and monthBelow; MONTH_MS and MONTH_EASE are core.js's). */
const MONTH_LIFT=8;  // ms between the days lifting out when the month folds
let monthAnim=null;   // {list: running animations, end: what finishing early must still do}
function monthStop(){const a=monthAnim;monthAnim=null;if(!a)return;for(const x of a.list)x.cancel();if(a.end)a.end()}
function monthUnfold(box){monthStop();const pan=$('#mpanel'),pin=$('#mpanel-in');box.classList.remove('mshut');box.classList.add('mfast','open');
  const g=pan?pan.offsetHeight:0,d=revealNeed(box,box);
  if(noMotion()||!g){if(d>.5)scrollBy(0,d);return}
  const o={duration:MONTH_MS,easing:MONTH_EASE},c=foldEdge(box,g,0,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:`translateY(${-g}px)`},{transform:'none'}],o));
  if(pin)list.push(pin.animate([{opacity:0},{opacity:1}],{...o,duration:240,fill:'backwards'}));   // the title, weekdays and buttons fade in; the days drop in (.mdrop)
  monthDrop(box);
  const a=monthAnim={list,end:c.drop};list[0].finished.then(()=>{if(monthAnim===a){monthAnim=null;c.drop()}},()=>{});
  if(d>.5)pageScroll(scrollY+d,o.duration)}
function monthFold(box){monthStop();clearTimeout(monthDropT);box.classList.remove('mdrop');const pan=$('#mpanel'),pin=$('#mpanel-in'),g=pan?pan.offsetHeight:0;
  const close=()=>{box.classList.add('mfast');box.classList.remove('open','instant','mshut','mdrop','mlift')};
  if(noMotion()||!g||foldQuiet||!box.classList.contains('open')){close();keepInView(box);return}
  // the page gets shorter at the end: scroll now to where it can stay, so it doesn't jump then (and bring the card's top back into view)
  const top=box.getBoundingClientRect().top,max=Math.max(0,document.documentElement.scrollHeight-g-innerHeight);
  let want=top<8?scrollY+top-8:scrollY;want=Math.min(want,max);
  // the days lift out last first (styles.css .mlift, MONTH_LIFT ms apart, 280 ms each); the card starts closing once about half
  // of them are gone
  const n=box.querySelectorAll('.mc:not(.blank)').length,wait=Math.round((n*MONTH_LIFT+280)*.55);
  box.style.setProperty('--mn',n);box.classList.add('mfast','mshut','mlift');
  const o={duration:MONTH_MS-60,delay:wait,easing:MONTH_EASE,fill:'forwards'},c=foldEdge(box,0,g,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:'none'},{transform:`translateY(${-g}px)`}],o));
  if(want<scrollY-.5)pageScroll(want,o.duration,o.delay);
  if(pin)list.push(pin.animate([{opacity:1},{opacity:0}],{...o,delay:wait+Math.round((MONTH_MS-60)*.35),duration:200}));   // the title and weekdays, once the days are gone (a fade of the whole panel any earlier hid the days lifting out)
  const end=()=>{c.drop();if(scrollY>max)scrollTo(0,max);close()},a=monthAnim={list,end};
  list[0].finished.then(()=>{if(monthAnim!==a)return;monthAnim=null;end();for(const x of list)x.cancel()},()=>{})}
/* the days drop in one after another while the box unfolds (styles.css .mdrop): the class stays only as long as that takes, so a
   month swiped to, a re-plan or a move doesn't play it again */
let monthDropT=0;
function monthDrop(box){clearTimeout(monthDropT);box.classList.remove('mdrop');void box.offsetWidth;box.classList.add('mdrop');
  const n=box.querySelectorAll('.mc:not(.blank)').length;monthDropT=setTimeout(()=>box.classList.remove('mdrop'),n*12+60+440+50)}
/* the month's days are put into the folded box while the app is idle (monthFillSoon, from monthLink), so a tap only unfolds it */
function monthFill(){const el=$('#mpanel-in');if(!el||!monthPanel)return;const sig=monthPanel.y+'-'+monthPanel.m+'|'+key(sel);
  if(el.dataset.fill===sig&&el.firstElementChild)return;el.innerHTML=monthGridHtml();el.dataset.fill=sig}
let monthFillT=0;
function monthFillSoon(){clearTimeout(monthFillT);monthFillT=setTimeout(()=>{
  const run=()=>{if(monthOpen||!$('#mpanel-in'))return;monthPanel={y:sel.getFullYear(),m:sel.getMonth()};monthFill()};
  if(window.requestIdleCallback)requestIdleCallback(run,{timeout:1500});else run()},600)}
function monthStep(n,from){let {y,m}=monthPanel;m+=n;if(m>11){m=0;y++}if(m<0){m=11;y--}monthPanel={y,m};const el=$('#mpanel-in');if(!el)return;el.innerHTML=monthGridHtml();el.dataset.fill='';$('#mbox').classList.remove('mdrop');$('#mbox').classList.add('instant');
  const sw=$('#mswipe');if(!sw||!from||matchMedia('(prefers-reduced-motion: reduce)').matches)return;   // the new month slides in from the side it was swiped from
  sw.style.transition='none';sw.style.transform=`translateX(${from}px)`;sw.style.opacity='0';void sw.offsetWidth;
  sw.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sw.style.transform='translateX(0)';sw.style.opacity='1'}
/* a sideways drag inside the open month: the month follows the finger, and past 70 px (or a quick flick) the next or previous
   month slides in; anything shorter springs back. Shared by touch (the Today swipe handler hands it over) and the mouse. */
function monthDrag(dx){const sw=$('#mswipe');if(!sw)return;sw.style.transition='none';sw.style.transform=`translateX(${dx}px)`;sw.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth))}
function monthRelease(dx,ms){const sw=$('#mswipe');if(!sw)return false;const fast=Math.abs(dx)/Math.max(1,ms)>.5;
  if(Math.abs(dx)>70||(fast&&Math.abs(dx)>30)){const n=dx<0?1:-1,w=sw.offsetWidth||innerWidth;
    sw.style.transition='transform .16s ease-in,opacity .16s';sw.style.transform=`translateX(${dx<0?-w:w}px)`;sw.style.opacity='0';
    setTimeout(()=>monthStep(n,(dx<0?1:-1)*w*.6),160);return true}
  sw.style.transition='transform .2s ease-out,opacity .2s';sw.style.transform='translateX(0)';sw.style.opacity='1';return false}
function openDay(t){setSel(new Date(t));setView({y:sel.getFullYear(),m:sel.getMonth()});setMonthOpen(false);emit('day-changed');scrollTo({top:0,behavior:'smooth'})}
/* the box on Today: the next few workdays as small stacks; tap it and the month unfolds below */
function monthLink(){
  const days=[];for(let d=new Date(sel),g=0;days.length<5&&g<14;g++,d.setDate(d.getDate()+1))if(isWorkday(d)){const o=planOn(d);if(hasOutfit(o))days.push([new Date(d),o])}
  const f=new Date(view.y,view.m,1),n=Object.keys(planFor()).filter(k=>{const d=keyDate(k);return d.getMonth()===view.m&&d.getFullYear()===view.y}).length;
  if(monthOpen&&!monthPanel)monthPanel={y:view.y,m:view.m};
  if(!monthOpen)monthFillSoon();
  return `<section class="mbox${monthOpen?' open instant':''}" id="mbox"><button class="month-link" data-act="monthTap" aria-expanded="${monthOpen}" aria-controls="mpanel"><span class="mlstrip" aria-hidden="true">${days.map(([d,o])=>{const mk=dayMarks(d,o);return `<span class="mli${mk.bad?' bad':''}${mk.rep?' rep':''}"><small>${d.toLocaleDateString(undefined,{weekday:'narrow'})}</small>${stackSVG(o,'',mk.rep)}</span>`}).join('')}</span>
    <span class="mltxt"><b>${f.toLocaleDateString(undefined,{month:'long'})} wear plan</b><small>${wardShort()?'pieces still missing':`${n} outfit${n===1?'':'s'}`} · ${monthOpen?'tap to fold away':'tap to see the month'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="mpanel"><div class="mpanel-in" id="mpanel-in"${monthOpen?` data-fill="${monthPanel.y+'-'+monthPanel.m+'|'+key(sel)}">${monthGridHtml()}`:' inert>'}</div></div></section>`;
}
/* the setters other files call to assign these lets (restructure S1a, 2026-11-25): once files import each other an imported binding is read-only */
function setMonthOpen(v){monthOpen=v}
/* the bridge (tests/bridge.test.js): the classic scripts that draw with the month's pieces: today.js (the box, the pieces line, the home
   day), today-gestures.js and today-photofold.js (the drags, the scroll), boxfold.js, scorecard.js, history.js, fav.js, daysoff.js,
   pack.js, remind.js, stats.js, start.js and the painter (planOn); monthGridHtml and monthStep are called by tests only. today.js and
   the tests set monthOpen, tests/setup.test.js sets monthPanel: setters; a module imports them.
   Before acts(), the file's one call that can throw (act.js not loaded): the names are then still the page's, as a classic script's were */
Object.assign(globalThis,{stackSVG,planOn,nextWorkday,homeDay,dayWord,recentWork,mvSig,wardShort,dayOnly,shortTop,shortRest,piecesLine,piecesParts,monthPlan,toggleMonth,monthDrag,monthRelease,openDay,monthLink,setMonthOpen});
Object.defineProperties(globalThis,{monthOpen:{get:()=>monthOpen,set:v=>{monthOpen=v}},monthPanel:{get:()=>monthPanel,set:v=>{monthPanel=v}}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,monthGridHtml,monthStep,get monthOpen(){return monthOpen},set monthOpen(v){monthOpen=v},get monthPanel(){return monthPanel},set monthPanel(v){monthPanel=v},monthPlan,openDay,shortRest,shortTop,toggleMonth,homeDay,piecesLine,planOn};
export {stackSVG,planOn,nextWorkday,homeDay,dayWord,recentWork,mvSig,wardShort,dayOnly,shortTop,shortRest,piecesLine,piecesParts,monthOpen,monthPanel,monthPlan,monthGridHtml,toggleMonth,monthStep,monthDrag,monthRelease,openDay,monthLink,setMonthOpen};
/* the markup's handlers (act.js): the month box's head and its "Fold away" bar, and a day of the month (data-t: its time) */
function monthTap(){toggleMonth()}
function dayCellTap(el){openDay(+el.dataset.t)}
acts({monthTap,dayCellTap});
