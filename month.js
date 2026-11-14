/* Daily Wardrobe: the month view (wear plan): the calendar of fabric stacks
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* ---- month view (wear plan): a calendar of fabric stacks, from the design concept ---- */
/* stacked bands for one outfit: jacket, trousers on blazer days, shirt, tie (drawn from the tagged fabrics) */
let stkN=0;
function stackSVG(o,cls=''){
  const P='st'+(stkN++)+'-',parts=[[o.top,'top',22],...(!o.suitDay&&o.bot?[[o.bot,'bot',9]]:[]),[o.shirt,'shirt',9],[o.tie,'tie',9]].filter(x=>x[0]);
  const H=parts.reduce((h,x)=>h+x[2],0)+(parts.length-1)*2;let y=0;
  const body=parts.map(([i,role,h],k)=>{const id=P+k,r=`<rect y="${y}" width="40" height="${h}" rx="2.5" fill="url(#${id})"/><rect y="${y}" width="40" height="${h}" rx="2.5" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".6"/>`;y+=h+2;return `<defs>${fabricDef(id,i,role)}</defs>${r}`}).join('');
  return `<svg class="stack ${cls}" viewBox="0 0 40 ${H}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
const planOn=d=>planMonth(d.getFullYear(),d.getMonth())[key(d)];
const nextWorkday=d=>{const x=new Date(d);let g=0;do x.setDate(x.getDate()+1);while(!isWorkday(x)&&++g<7);return x};
const shortTop=o=>{const t=o.top;if(!t)return o.bot?(wearsJacket()?`No jacket: ${colName(primaryCol(o.bot))} trousers`:`${colName(primaryCol(o.bot))} trousers`.replace(/^./,c=>c.toUpperCase())):'No jacket';const p=t.pattern&&t.pattern!=='solid'&&t.pattern!=='other'?' '+patLabel(t.pattern):'',n=colName(primaryCol(t))+p;
  const s=n.charAt(0).toUpperCase()+n.slice(1);return o.suitDay?s:`${s} blazer${o.bot?' + '+colName(primaryCol(o.bot))+' trousers':''}`};
const tieWord=p=>({'polka-dot':'dot',stripe:'stripe',paisley:'paisley',check:'check',foulard:'foulard',knit:'knit'})[p]||'';
const shortRest=o=>[o.shirt&&colName(primaryCol(o.shirt))+' shirt',o.tie&&[colName(primaryCol(o.tie)),tieWord(o.tie.pattern),'tie'].filter(Boolean).join(' ')].filter(Boolean).join(' · ').replace(/^./,c=>c.toUpperCase());
/* the outfit in a few words, the same everywhere it is named in one line (Today's pieces card, sharing, the morning reminder):
   "navy suit · white shirt · burgundy stripe tie" (sentence() capitalises it where it starts a line) */
/* the folded pieces box's line: jacket (or trousers), shirt and tie; a piece the owner named is called by its name, exactly as typed (2026-11-14,
   the owner: "Medium Grey suit", not "mid grey worsted suit"), the others by colour */
const piecesLine=o=>{const nmd=i=>itemName(i);return [o.top?nmd(o.top)||`${colName(primaryCol(o.top))} ${o.suitDay?'suit':'blazer'}`:o.bot&&(nmd(o.bot)||`${colName(primaryCol(o.bot))} trousers`),o.shirt&&(nmd(o.shirt)||`${colName(primaryCol(o.shirt))} shirt`),
  o.tie&&(nmd(o.tie)||`${colName(primaryCol(o.tie))}${o.tie.pattern&&!['solid','other'].includes(o.tie.pattern)?' '+patLabel(o.tie.pattern):''} tie`)].filter(Boolean).join(' · ')};/* the month plan unfolds in place from the box on Today (no separate page) */
let monthOpen=false,monthPanel=null;
const monthPlan=planMonth;
function monthGridHtml(){
  const {y,m}=monthPanel,p=monthPlan(y,m),f=new Date(y,m,1),T=todayDate(),cells=[];let n=0;
  for(let k=0;k<f.getDay();k++)cells.push('<span class="mc blank"></span>');
  for(const d=new Date(f);d.getMonth()===m;d.setDate(d.getDate()+1)){const k=key(d),o=p[k],wd=isWorkday(d),off=offName(d),work=wd&&hasOutfit(o),isT=+d===+T,past=d<T;
    const label=`${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}: ${work?`${shortTop(o)}, ${shortRest(o)}`:wd?'no outfit recorded':off?'day off: '+off:'day off'}`;
    const mv=work&&!past&&!o.frozen&&!occOf(dayRecs[k]);   // a day whose outfit can be picked up and moved, or a day it can be dropped on
    cells.push(`<button class="mc ${!wd?'rest':past?'worn':'planned'}${off&&!wd?' hol':''}${isT?' today':''}${k===key(sel)?' sel':''}" style="--i:${n++}" data-k="${k}"${work?` data-sig="${mvSig(o)}"`:''}${mv?' data-mv="1"':''} aria-label="${esc(label)}" onclick="openDay(${d.getTime()})"><span class="dn">${d.getDate()}</span>${work?stackSVG(o):wd?'<span class="stack none"></span>':'<span class="stack rest"></span>'}</button>`)}
  // no arrows, hint or legend: a swipe (or a mouse drag) inside the box moves between months (monthDrag); the title is centred; the cells still
  // show worn / today / planned / rest by their own look
  return `<div class="mswipe" id="mswipe"><div class="mhead"><h3>${f.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3></div>
    <div class="mgrid mdow" aria-hidden="true">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="mgrid">${cells.join('')}</div></div>
    <button class="foldbar" onclick="toggleMonth()" aria-label="Fold away the month"><span class="fchev" aria-hidden="true">›</span>Fold away</button>`;
}
/* after a box unfolds: scroll down just far enough to show what opened, but never past the point where the tapped box
   (top: the tapped element, e.g. the tile row for a tile's photo) reaches the top of the screen. Follows the box while it
   grows, so the page moves with the unfolding; a touch or wheel by the user stops it. */
let revealRun=0;
/* how far to scroll so el shows above the tab bar, without the top of `top` going past the top of the screen (sat: the notch's inset) */
function revealNeed(el,top,sat){if(sat===undefined){const probe=document.createElement('div');probe.style.cssText='position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden';document.body.appendChild(probe);sat=parseFloat(getComputedStyle(probe).paddingTop)||0;probe.remove()}
  const nav=document.querySelector('body>nav'),bottom=(nav?nav.getBoundingClientRect().top:innerHeight)-12,need=el.getBoundingClientRect().bottom-bottom,cap=(top||el).getBoundingClientRect().top-(sat+8);return Math.max(0,Math.min(need,cap))}
function reveal(el,top){top=top||el;const run=++revealRun,t0=performance.now(),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const probe=document.createElement('div');probe.style.cssText='position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden';document.body.appendChild(probe);
  const sat=parseFloat(getComputedStyle(probe).paddingTop)||0;probe.remove();
  const stop=()=>{revealRun++;off()},off=()=>{removeEventListener('touchstart',stop);removeEventListener('wheel',stop)};
  addEventListener('touchstart',stop,{passive:true,once:true});addEventListener('wheel',stop,{passive:true,once:true});
  const want=()=>revealNeed(el,top,sat);
  const step=now=>{if(run!==revealRun)return;const d=want(),done=now-t0>(reduce?0:700);
    if(reduce||done){if(d>.5)scrollBy(0,d);off();return}
    if(d>.5)scrollBy(0,Math.max(1,d*.2));requestAnimationFrame(step)};
  requestAnimationFrame(step)}
function toggleMonth(){const box=$('#mbox');if(!box)return;monthOpen=!monthOpen;const pin=$('#mpanel-in');
  if(monthOpen){monthPanel={y:sel.getFullYear(),m:sel.getMonth()};monthFill();box.classList.remove('instant')}
  if(pin)pin.inert=!monthOpen;
  $('#mbox .month-link').setAttribute('aria-expanded',monthOpen);
  const sm=$('#mbox .mltxt small');if(sm)sm.textContent=sm.textContent.replace(/tap to .*/,monthOpen?'tap to fold away':'tap to see the month');
  if(monthOpen)monthUnfold(box);else{revealRun++;monthFold(box)}}
/* the page's scroll during an unfold or a fold, on the animations' own curve (MONTH_EASE), duration and delay, so the page and the clip
   move together. The page is scrolled once, at the start, and Today is slid back by the same amount and eased to rest with the cards:
   one more animation the browser runs with the others, no script on any frame. (The browser's own smooth scroll kept its own pace, and
   WebKit covered a 1,000 px scroll in one frame; a scrollTo on every frame from script, the next try, ran out of step with the clip and
   the slide on an iPhone, whose scrolling and animations aren't drawn by the page's script, and the cards juddered.) A second call while
   one runs starts from where the page is drawn, so nothing jumps. */
function pageScroll(to,ms,delay=0){const pg=$('#today'),from=scrollY;
  let left=0;if(pg&&pg._ps){const m=/matrix.*,\s*([-\d.e]+)\)$/.exec(getComputedStyle(pg).transform);left=m?+m[1]:0;pg._ps.cancel();pg._ps=null}
  scrollTo(0,to);const off=scrollY-from+left;   // the browser stops at the page's end: slide by what it really scrolled
  if(!pg||noMotion()||Math.abs(off)<1||pg.hidden)return;
  const a=pg._ps=pg.animate([{transform:`translateY(${off}px)`},{transform:'none'}],{duration:ms,delay,easing:MONTH_EASE,fill:'backwards'});
  a.finished.then(()=>{if(pg._ps===a)pg._ps=null},()=>{})}
/* Unfolding and folding the month without animating its height: an animated height laid the page out and repainted every day's
   drawing on every frame (30 layouts and 285 paints for one unfold), which was choppy on a phone. The page is laid out once, at the
   start of an unfold or the end of a fold, and the movement is the card's edge sliding (a strip, foldEdge: a clip-path here was
   repainted every frame by Safari and drifted from the slides), a slide for whatever is below it and a fade of the days, all of which
   the GPU draws; the scroll is pageScroll's. */
const MONTH_MS=420;
const MONTH_EASE='cubic-bezier(.2,.8,.2,1)';
const MONTH_LIFT=8;   // ms between the days lifting out when the month folds
let monthAnim=null;   // {list: running animations, end: what finishing early must still do}
function monthStop(){const a=monthAnim;monthAnim=null;if(!a)return;for(const x of a.list)x.cancel();if(a.end)a.end()}
const monthBelow=box=>{const k=[...box.parentNode.children];return k.slice(k.indexOf(box)+1)};
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
function openDay(t){sel=new Date(t);view={y:sel.getFullYear(),m:sel.getMonth()};monthOpen=false;renderToday();scrollTo({top:0,behavior:'smooth'})}
/* the box on Today: the next few workdays as small stacks; tap it and the month unfolds below */
function monthLink(){
  const days=[];for(let d=new Date(sel),g=0;days.length<5&&g<14;g++,d.setDate(d.getDate()+1))if(isWorkday(d)){const o=planOn(d);if(hasOutfit(o))days.push([new Date(d),o])}
  const f=new Date(view.y,view.m,1),n=Object.keys(planFor()).filter(k=>{const d=keyDate(k);return d.getMonth()===view.m&&d.getFullYear()===view.y}).length;
  if(monthOpen&&!monthPanel)monthPanel={y:view.y,m:view.m};
  if(!monthOpen)monthFillSoon();
  return `<section class="mbox${monthOpen?' open instant':''}" id="mbox"><button class="month-link" onclick="toggleMonth()" aria-expanded="${monthOpen}" aria-controls="mpanel"><span class="mlstrip">${days.map(([d,o])=>`<span class="mli"><small>${d.toLocaleDateString(undefined,{weekday:'narrow'})}</small>${stackSVG(o)}</span>`).join('')}</span>
    <span class="mltxt"><b>${f.toLocaleDateString(undefined,{month:'long'})} wear plan</b><small>${n} outfit${n===1?'':'s'} · ${monthOpen?'tap to fold away':'tap to see the month'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="mpanel"><div class="mpanel-in" id="mpanel-in"${monthOpen?` data-fill="${monthPanel.y+'-'+monthPanel.m+'|'+key(sel)}">${monthGridHtml()}`:' inert>'}</div></div></section>`;
}

