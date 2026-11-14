/* Daily Wardrobe: Today: the month's plan and its snapshot, the pieces' rows, the figure and its overlays, the pieces box, zoom, swatches,
   swiping days, moving an outfit, renderToday
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* the plan for a month. Every month from two months back shares one simulation (kept in the cache, so anything that clears
   the cache starts it again): another month only plans the days not planned yet. Earlier months are built on their own. */
let cache={};
const planRuns=[];   // the months worked out (not from the cache) since start-up (tests/speed.test.js)
function planMonth(y,m){const k=y+'-'+m;if(cache[k])return cache[k];if(planRuns.length<200)planRuns.push(k);
  if(window.TEST_PLAN)return cache[k]=TEST_PLAN.plan(y,m);   // tests that don't need the planner (tests/fixedplan.js)
  const start=planStart(y,m),T=todayDate();
  if(+start!==+planStart(T.getFullYear(),T.getMonth()))return cache[k]=planTrim(buildPlan(y,m));
  return cache[k]=planTrim((cache.sim||(cache.sim=planSim(start))).upTo(new Date(y,m+1,0)))}
/* no outfit is shown for a day before the wardrobe existed (the day the first item was added; items from before `added` existed set no
   start): a new user saw two weeks of planned past days with ✕ and ✓ and "22 outfits" in the month (audit 2026-11-13). The planner
   still plans them (rest and variety carry on from them); they are only left out of the month's plan, and a day with a record stays */
function planStartDay(){let s=Infinity;for(const i of items){if(!i.added)return null;if(i.added<s)s=i.added}if(!isFinite(s))return null;const d=new Date(s);d.setHours(0,0,0,0);return d}
function planTrim(plan){const s=planStartDay();if(!s)return plan;const T=todayDate();
  for(const k of Object.keys(plan)){const d=keyDate(k);if(d<s&&d<T&&!(dayRecs[k]&&dayRecs[k].ids))delete plan[k]}return plan}
const planFor=()=>planMonth(view.y,view.m);
/* ---- Today's month as last planned, kept in IndexedDB (meta PLAN_SNAP), so start-up draws Today without waiting for the planner
   (200-390 ms frozen at phone speed, audit 2026-11-13). Used only when nothing it depends on changed (planSig: the day, the items' and
   day records' stamps, the settings' stamp, the forecast and climate); the month is planned again as soon as the phone is idle
   (planSnapCheck) and Today redrawn only if it differs. While the kept month is on screen nothing is recorded or locked from it
   (recordDays/lockUpcoming wait for the real plan). Pieces are kept as their ids plus what the planner added (rest), not as copies
   of the items (their photos). ---- */
const PLAN_SNAP='plan_snap';
const strHash=t=>{let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(36)};
const planSig=()=>strHash(JSON.stringify([isoKey(todayDate()),items.map(i=>[i.id,i.updated||0]),Object.values(dayRecs).map(r=>[r.date,r.updated||0]).sort((a,b)=>a[0]<b[0]?-1:1),settings.updated||0,weather,climate]));
function snapOut(x,byId,seen=new Map()){if(!x||typeof x!=='object'||x instanceof Date)return x;if(seen.has(x))return seen.get(x);
  const it=x.id!=null&&typeof x.type==='string'&&byId.get(x.id);
  if(it&&it.type===x.type){const extra={};for(const k of Object.keys(x))if(x[k]!==it[k])extra[k]=snapOut(x[k],byId,seen);const r={$i:x.id,$x:extra};seen.set(x,r);return r}
  const r=Array.isArray(x)?[]:{};seen.set(x,r);for(const k of Object.keys(x))r[k]=snapOut(x[k],byId,seen);return r}
function snapIn(x,byId){if(!x||typeof x!=='object'||x instanceof Date)return x;
  if(x.$i!=null&&x.$x){const it=byId.get(x.$i);if(!it)throw new Error('kept plan names a missing item');const r={...it};for(const k of Object.keys(x.$x))r[k]=snapIn(x.$x[k],byId);return r}
  for(const k of Object.keys(x))x[k]=snapIn(x[k],byId);return x}
// at start-up, before Today is first drawn: the kept month, if it still holds
function planSnapUse(s){try{if(!s||!s.plan||s.sig!==planSig()||window.TEST_PLAN)return false;const byId=new Map(items.map(i=>[i.id,i]));
    cache[s.k]=snapIn(s.plan,byId);cache.snap=s.k;planSnapUsed=s.k;return true}catch(e){console.warn('kept plan not used',e);return false}}
let planSnapUsed=null;   // the month start-up drew from the kept plan (read by tests/speed.test.js)
const outSig=o=>o&&JSON.stringify([idsOf(o),!!o.vest,!!o.suitDay,o.notes||[]]);
// once the phone is idle: plan the month for real; Today is redrawn only if it differs, and the day records and locks are written then
function planSnapCheck(){const k=cache.snap;if(!k)return;const shown=cache[k];delete cache[k];cache.snap=null;const [y,m]=k.split('-').map(Number);
  const real=planMonth(y,m),same=Object.keys(real).length===Object.keys(shown).length&&Object.keys(real).every(d=>outSig(real[d])===outSig(shown[d]));
  if($('#today').hidden)return;if(!same||(typeof pulledYet==='function'&&!pulledYet()))return refreshToday();   // (before the first sync is merged, renderToday waits for it to record)
  if(items.length)recordDays(real).then(lockUpcoming).then(planSnapSoon)}
let planSnapT=0;
function planSnapSoon(){clearTimeout(planSnapT);planSnapT=setTimeout(()=>{const T=todayDate(),k=T.getFullYear()+'-'+T.getMonth(),p=cache[k];if(!p||cache.snap||window.TEST_PLAN||!items.length)return;
  try{metaPut(PLAN_SNAP,{k,sig:planSig(),plan:snapOut(p,new Map(items.map(i=>[i.id,i]))),t:Date.now()}).catch(e=>console.warn('plan not kept',e))}catch(e){console.warn('plan not kept',e)}},1500)}
/* the forecast and the climate kept on the device, read before Today is first drawn: loadWeather and loadClimate then find them
   unchanged, so start-up plans once instead of three times (without them, again with the climate, again with the forecast) */
function wxPreload(){const L=settings.location;if(!L)return;
  try{const c=JSON.parse(localStorage.getItem('wx_norm')||'null');if(c&&c.lat===L.lat&&c.lon===L.lon&&Array.isArray(c.months))climate=c.months}catch{}
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');if(c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3)weather=c.days}catch{}}

/* views */
const hasOutfit=o=>!!o&&!!(o.top||o.shirt);   // a day without a jacket (the no-jacket occasion) still has an outfit
const canPick=o=>!o.frozen||pastEdit===key(sel);   // a past day only while it is being corrected
// no waistcoat without a tie: the vest row (and its +) goes with the tie
const vestRow=o=>!(o.suitDay&&hasVest(o.top)&&o.tie)?'':`<div class="row vest-row"><span class="mut">Vest</span>${o.vest?`<span class="dot">${swatchSVG(o.top,true)}</span><span class="cap">Matching vest</span>`:'<span class="mut none">Not today</span>'}${!canPick(o)?'':`<button class="swap" onclick="setVest(${!o.vest})" aria-label="${o.vest?'Leave off the vest':'Wear the vest'}" title="${o.vest?'Leave off the vest':'Wear the vest'}">${o.vest?'−':'+'}</button>`}</div>`;
/* the outfit list: tapping a piece's swatch or name unfolds its photo inside the list (the actual item, so you can see
   exactly which shirt it is); one at a time; items without a photo show their product picture or drawing */
let openRow=null;
const rowPic=i=>i.photo?`<img class="rpic" src="${i.photo}" alt="Photo of ${esc(desc(i)||nm(i))}">`:itemPic(i)?`<img class="rpic" src="${itemPic(i).img}" alt="Picture of ${esc(desc(i)||nm(i))}">`:`<div class="rpic draw">${itemThumb(i,true)}</div>`;
const rowPanel=i=>rowPic(i)+(i.photo?'':`<small class="mut rnote">No photo of this item yet${itemPic(i)?': a generated picture of it.':': this is how the app draws it.'}</small>`);
/* taking a piece off for the day (the owner's ask, 2026-11-13): the jacket (with its waistcoat; a suit's trousers stay) or the tie (with
   its clip), on today and the coming days; − beside the piece takes it off, + on its "Taken off" row puts it back (setOff) */
const offOn=o=>!o.frozen&&o.occasion!=='casual';
const offBtn=(s,o)=>offOn(o)&&o[s]&&(s==='top'||s==='tie')?`<button class="swap offb" onclick="setOff('${s}',true)" aria-label="Take off the ${s==='top'?(o.suitDay?'suit jacket':'blazer'):'tie'}" title="Take off for the day">−</button>`:'';
const offRow=(s,o)=>{const l=s==='top'?(o.offKind==='suit'?'Suit':'Blazer'):'Tie',w=s==='top'?(o.offKind==='suit'?'suit jacket':'blazer'):'tie';
  return `<div class="ritem off-row" id="ri-${s}"><div class="row"><span class="mut">${l}</span><span class="mut none">Taken off${s==='top'&&o.suitBot?': the trousers stay':''}</span>${o.frozen?'':`<button class="swap" onclick="setOff('${s}',false)" aria-label="Put the ${w} back on" title="Put it back on">+</button>`}</div></div>`};
async function setOff(slot,on){const k=key(sel),o=planFor()[k];if(!o||o.frozen||(slot!=='top'&&slot!=='tie'))return;
  const r={...(dayRecs[k]||{date:k})},off={...(r.off||{})};
  if(on){if(!o[slot])return;
    // the rest of the outfit is pinned, so taking a piece off changes nothing else (and putting it back brings the same piece)
    const force={...(r.force||{})};for(const s of SLOTS)if(o[s]&&!(s==='bot'&&(o.suitDay||o.suitBot)))force[s]=o[s].id;
    if(o.top)r.kind=o.suitDay?'suit':'blazer';r.force=force;off[slot]=true}
  else delete off[slot];
  if(off.top||off.tie)r.off=off;else delete r.off;delete r.lock;swapMsg='';await saveDay(r);renderToday()}
const slots=o=>{const nj=!o.top&&!needsJacket(o)&&!(o.off&&o.off.top),nt=!o.tie&&!needsTie(o)&&!(o.off&&o.off.tie)&&!(o.frozen&&pastEdit===key(sel));const rows=([...(nj?[]:[[o.suitDay?'Suit':'Blazer',o.top,'top']]),...(o.suitDay?[]:[[o.suitBot?'Trousers':'Pants',o.bot,'bot']]),['Shirt',o.shirt,'shirt'],...(nt?[]:[['Tie',o.tie,'tie'],['Tie clip',o.clip,'clip']]),...(o.links||(o.shirt&&o.shirt.cuff==='french')?[['Cufflinks',o.links,'links']]:[]),['Watch',o.watch,'watch'],['Belt',o.belt,'belt'],['Socks',o.socks,'socks'],['Shoes',o.shoes,'shoes'],...(o.coat||(o.clim&&(o.clim.cold||o.clim.rain))?[[o.coat?TYPES[o.coat.type]:'Coat',o.coat,'coat']]:[])])
  .filter(([l,i,s])=>!(s==='clip'&&!i&&!(o.frozen&&pastEdit===key(sel))))   // no tie clip that day: no row (kept while correcting a past day, to add the one worn)
.filter(([l,i,s])=>!(s==='clip'&&o.off&&o.off.tie))
.map(([l,i,s])=>{if((s==='top'||s==='tie')&&!i&&o.off&&o.off[s])return offRow(s,o);const open=!!i&&openRow===s;
  return `<div class="ritem${open?' open instant':''}" id="ri-${s}"><div class="row"><span class="mut">${l}</span>${i?`<button class="rowtap" onclick="toggleRow('${s}')" aria-expanded="${open}" aria-controls="rp-${s}" aria-label="${l}: ${esc(itemTitle(i)||nm(i))}. ${open?'Hide':'Show'} the photo"><span class="dot">${swatchSVG(i,true)}</span><span class="${titleCls(i)}">${esc(itemTitle(i))}</span></button>${canPick(o)&&!(s==='bot'&&o.suitBot)?`<button class="swap" onclick="openPicker('${s}')" aria-label="Change ${l.toLowerCase()}" title="Choose another">⇄</button>`:''}${offBtn(s,o)}`:`<span class="mut none">${s==='clip'&&o.vest?'Not with the vest':o.frozen?'None':'Add one on the Add tab'}</span>${o.frozen&&canPick(o)?`<button class="swap" onclick="openPicker('${s}')" aria-label="Choose ${l.toLowerCase()}" title="Choose">⇄</button>`:''}`}</div>`+
    (i?`<div class="rpanel" id="rp-${s}"><div class="rpanel-in" onclick="toggleRow('${s}')">${open?rowPanel(i):''}</div></div>`:'')+`</div>`});
  rows.splice(nj?0:1,0,vestRow(o));return rows.join('')};
function toggleRow(s){const el=$('#ri-'+s),o=planFor()[key(sel)];if(!el||!o||!o[s])return;const opening=!el.classList.contains('open');
  // another open photo (a row, or the tile's photo above the list) shuts at once; one above the tapped row is made up for by the scroll, so the row stays under the finger
  document.querySelectorAll('.ritem.open').forEach(r=>{if(r!==el){picSnap(r,el);const b=r.querySelector('.rowtap');if(b)b.setAttribute('aria-expanded','false')}});
  if(opening)el.querySelector('.rpanel-in').innerHTML=rowPanel(o[s]);
  openRow=opening?s:null;const b=el.querySelector('.rowtap');b.setAttribute('aria-expanded',opening);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/(Show|Hide) the photo/,opening?'Hide the photo':'Show the photo'));
  if(opening)picOpenReady(el,el,()=>openRow===s);else{revealRun++;picShut(el)}}
/* A piece's photo (a row of the pieces list, or a tile's photo under the tiles) opens and shuts like the cards (boxUnfold/boxFold):
   the page is laid out once; the photo's own area is clipped open downward while what lies below it on the page slides down in step
   (picBelow: the rows after it, the cards under its card, the cards under the stage), and the card it is in (the pieces list) is
   clipped to its old edge and grows with it; the photo drops in with the days' bounce. Shutting is the same backwards: the photo
   lifts out with the days' dip, then the space closes. A row's running animations are kept on it (el._pa). */
const PIC_MS=380;
function picStop(el){const a=el._pa;el._pa=null;if(!a)return;for(const x of a.list)x.cancel();if(a.end)a.end()}
/* what lies below el on Today (top at or under `bottom`), and the cards el sits in */
function picBelow(el,bottom){const out=[],root=$('#today');for(let n=el;n&&n!==root&&n.parentElement;n=n.parentElement)for(let s=n.nextElementSibling;s;s=s.nextElementSibling)if(s.getBoundingClientRect().top>=bottom-1)out.push(s);return out}
function picCards(el){const out=[],root=$('#today');for(let n=el.parentElement;n&&n!==root;n=n.parentElement)if(n.classList.contains('mbox'))out.push(n);return out}
/* the photo must be decoded first, or its height isn't known yet and the rest of it would jump in afterwards */
async function picOpenReady(el,top,still){const im=el.querySelector('.rpanel-in img');
  if(im&&!(im.complete&&im.naturalWidth))await Promise.race([im.decode().catch(()=>{}),new Promise(r=>setTimeout(r,300))]);
  if(el.isConnected&&still())picOpen(el,top)}
function picOpen(el,top){picStop(el);const b0=el.getBoundingClientRect(),below=picBelow(el,b0.bottom),cards=picCards(el),c0=cards.map(c=>c.getBoundingClientRect().height);
  el.classList.remove('instant');el.classList.add('pfast','open');
  const b1=el.getBoundingClientRect(),g=b1.bottom-b0.bottom,d=revealNeed(el,top);
  if(noMotion()||g<1){if(d>.5)scrollBy(0,d);return}
  // the photo's own edge and its card's edge are strips that slide (foldEdge), like the cards' own: no clip-path for Safari to repaint
  const o={duration:PIC_MS,easing:MONTH_EASE},edges=[foldEdge(el,Math.max(0,b1.height-b0.height),0,o),...cards.map((c,i)=>foldEdge(c,c.getBoundingClientRect().height-c0[i],0,o))];
  const list=edges.map(e=>e.anim),drop=()=>edges.forEach(e=>e.drop());
  for(const e of below)list.push(e.animate([{transform:`translateY(${-g}px)`},{transform:'none'}],o));
  const pin=el.querySelector('.rpanel-in');if(pin)list.push(pin.animate([{opacity:0,transform:'translateY(-10px) scale(.96)'},{opacity:1,transform:'none'}],{duration:440,delay:40,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'backwards'}));
  const a=el._pa={list,end:drop};list[0].finished.then(()=>{if(el._pa===a){el._pa=null;drop()}},()=>{});
  if(d>.5)pageScroll(scrollY+d,o.duration)}
function picShut(el){picStop(el);const close=()=>{el.classList.add('pfast');el.classList.remove('open','instant')};
  if(noMotion()||foldQuiet||!el.classList.contains('open')){close();keepInView(el);return}
  // the sizes shut, read before anything moves (two layouts, nothing drawn in between)
  const b1=el.getBoundingClientRect(),below=picBelow(el,b1.bottom),cards=picCards(el),c1=cards.map(c=>c.getBoundingClientRect().height);
  el.classList.add('pfast');el.classList.remove('open');const b0=el.getBoundingClientRect(),c0=cards.map(c=>c.getBoundingClientRect().height);el.classList.add('open');
  const g=b1.bottom-b0.bottom;if(g<1){close();return}
  const top=el.getBoundingClientRect().top,max=Math.max(0,document.documentElement.scrollHeight-g-innerHeight);
  let want=top<8?scrollY+top-8:scrollY;want=Math.min(want,max);
  const pin=el.querySelector('.rpanel-in'),wait=150,o={duration:PIC_MS-40,delay:wait,easing:MONTH_EASE,fill:'forwards'};
  if(want<scrollY-.5)pageScroll(want,o.duration,o.delay);
  const edges=[foldEdge(el,0,Math.max(0,b1.height-b0.height),o),...cards.map((c,i)=>foldEdge(c,0,c1[i]-c0[i],o))],list=edges.map(e=>e.anim);
  for(const e of below)list.push(e.animate([{transform:'none'},{transform:`translateY(${-g}px)`}],o));
  if(pin)list.push(pin.animate([{opacity:1,transform:'none'},{opacity:1,offset:.25},{opacity:0,transform:'translateY(-10px) scale(.96)'}],{duration:280,easing:'cubic-bezier(.36,0,.66,-.56)',fill:'forwards'}));
  const end=()=>{edges.forEach(e=>e.drop());if(scrollY>max)scrollTo(0,max);close()},a=el._pa={list,end};
  list[0].finished.then(()=>{if(el._pa!==a)return;el._pa=null;end();for(const x of list)x.cancel()},()=>{})}
/* shut at once (another photo is opening): when it lay above `keep`, scroll by what it gave back, so `keep` doesn't move */
function picSnap(r,keep){picStop(r);const above=keep&&r.getBoundingClientRect().bottom<=keep.getBoundingClientRect().top+1,h0=r.getBoundingClientRect().height;
  r.classList.add('pfast');r.classList.remove('open','instant');if(above){const dh=h0-r.getBoundingClientRect().height;if(dh>0)scrollBy(0,-dh)}}


/* ---- Today figure: torso in the day's fabrics, tap targets, selected-piece card, below-the-waist tiles ---- */
/* a tile under the figure unfolds the item's photo below the tiles, like the pieces list; tap it again (or the photo) to fold it */
let belowOpen=null;
const slotLabel=(s,o)=>({top:o.suitDay?'Suit':'Blazer',bot:'Trousers',shirt:'Shirt',tie:'Tie',clip:'Tie clip',vest:'Vest',watch:'Watch',belt:'Belt',shoes:'Shoes',socks:'Socks',coat:o.coat?TYPES[o.coat.type]:'Coat',links:'Cufflinks'})[s]||s;
const belowBox=(o,below)=>{const i=below.some(([s])=>s===belowOpen)&&o[belowOpen];if(!i)belowOpen=null;
  return `<div class="ritem bbox${i?' open instant':''}" id="bbox"><div class="rpanel" id="bpanel"><div class="rpanel-in" onclick="pickPiece(belowOpen)">${i?rowPanel(i):''}</div></div></div>`};
/* did you wear it: ✗ and ✓ over the picture's bottom corners (today and past days); tapping the chosen one again clears it.
   Between them, a small pill says when this look was last worn (nothing when it never was). */
/* share the day's outfit: a round button at the picture's top right, like ✕ and ✓ (the owner chose this place). The phone's own
   share sheet gets the picture (the photo, or the drawing as a PNG) and a line naming the pieces; without a share sheet the line is
   copied. */
const SHARE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const shareMark=o=>o&&(o.top||o.shirt)?`<button type="button" class="wshare" onclick="shareOutfit()" aria-label="Share this outfit" title="Share this outfit">${SHARE_ICON}</button>`:'';
function shareText(o){const d=sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  return `${d}: ${sentence(piecesLine(o))}`}
async function shareOutfit(){const o=planFor()[key(sel)];if(!o)return;const text=shareText(o);let file=null;
  try{const r=renderFor(o),url=r&&r.img?r.img:await figurePng(o,780),blob=await (await fetch(url)).blob();
    file=new File([blob],`outfit-${key(sel)}.${/png/.test(blob.type)?'png':'jpg'}`,{type:blob.type})}catch(e){console.warn('share picture',e)}
  const data={title:'My outfit',text};if(file&&navigator.canShare&&navigator.canShare({files:[file]}))data.files=[file];
  if(navigator.share){try{await navigator.share(data)}catch(e){if(e&&e.name!=='AbortError')tell('Couldn’t share it.')}return}
  try{await navigator.clipboard.writeText(text);tell('The outfit is copied.')}catch{tell(text)}}
function wornMarks(o){return shareMark(o)+wornBar(o)}
/* the cloth over Today's picture (the owner's choice, 2026-11-13): bottom left, the jacket's, the shirt's and the tie's swatches top to
   bottom, 52 px, no rim, no names, above ✕ on days that show it; the app's drawn swatches, with a jacket's or shirt's stripes in Claude's
   own colours as the painter draws them (measured from the photo a thin stripe blurs into the ground and nearly vanishes) and at least
   OVL_LINE of a repeat, and a tie's pattern at half size (more repeats). Pictures only; it takes no touches and fades while zoomed. */
const OVL_LINE=.1;
function ovlItem(i){const s=usableSett(i),sp=i.patternSpec&&i.patternSpec.across;if(!s||!s.bands||i.type==='tie')return i;
  let b=s.bands.map(x=>[x[0],x[1]]);if(sp&&sp.bands&&sp.bands.length===b.length)b=b.map((x,k)=>[sp.bands[k].hex||x[0],x[1]]);
  const g=b.reduce((a,x)=>x[1]>a[1]?x:a)[0];let need=0;for(const x of b)if(x[0]&&x[0]!==g&&x[1]<OVL_LINE){need+=OVL_LINE-x[1];x[1]=OVL_LINE}
  const gw=b.filter(x=>!x[0]||x[0]===g).reduce((a,x)=>a+x[1],0);if(gw>need)for(const x of b)if(!x[0]||x[0]===g)x[1]*=1-need/gw;
  return {...i,sett:{...s,bands:b}}}
// a shirt's figured weave: its soft tile swapped for the higher-fidelity one (texTileSmooth: rounded outlines and a thread grain)
const ovlWeave=(i,v)=>{const s=usableSett(i),t=s&&s.tex;if(i.type!=='shirt'||!t||!t.grid||t.kind==='herringbone'||t.kind==='twill'||patBase(i.pattern)==='solid')return v;
  const [lo,hi]=texTones(colOf(i),t,1.7),old=texTileUrl(t.grid,lo,hi),nu=old&&texTileSmooth(t.grid,lo,hi);return old&&nu&&v.includes(old)?v.split(old).join(nu):v};
const ovlSvg=i=>{const v=ovlWeave(i,swatchSVG(ovlItem(i),true));if(i.type!=='tie')return v;
  return v.replace(/<pattern ([^>]*?)>/,(m,a)=>/patternTransform="/.test(a)?`<pattern ${a.replace(/patternTransform="([^"]*)"/,'patternTransform="$1 scale(.5)"')}>`:`<pattern ${a} patternTransform="scale(.5)">`)};
/* the real cloth where it reads (the owner's choice, 2026-11-13): an item's precision swatch (the square cut from its close-up, white-balanced
   and matched to its colour: item.swatch with swSrc 'tex') for a tie, and for a plain or finely woven jacket; a shirt is always drawn, and a
   striped, checked or figured jacket stays drawn, since a close-up of a patch of cloth barely shows its pattern at this size (his ink aubergine
   pinstripe's read as plain dark cloth); an item without a close-up stays drawn */
const ovlCloseup=i=>!!(i.swatch&&i.swSrc==='tex'&&i.texture&&TEXTURE_TYPES.includes(i.type));
const ovlDrawn=i=>{if(i.type==='tie')return false;if(i.type==='shirt')return true;   // a shirt is always drawn (the owner, 2026-11-13: as in the mockup he chose)
  const s=usableSett(i);return !!(s&&(s.bands||s.motif))||[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS].includes(patBase(i.pattern)||'')};
/* a suit's or blazer's cloth, painted (the owner's choice, 2026-11-13, "Stronger grain" from a mockup, and every suit drawn, never its
   close-up): its read bands (in Claude's colours, at least OVL_LINE, as ovlItem) as anti-aliased stripes two repeats across, crossing lines
   over them, and the cloth's grain (ovlGrain: twill ribs, herringbone columns, linen slubs, else a fine plain weave) at OVL_GRAIN times
   the mockup's base strength; a suit with a stripe, check or figure but no band reading keeps the drawn tile. A PNG, cached. */
const OVL_PX=260,OVL_GRAIN=2.2,OVL_CROSS=.06,OVL_CROSS_A=.75,OVL_SUITS=new Map();
const ovlGrain=i=>{const t=((i.patternSpec&&i.patternSpec.description)||i.patternText||'')+' '+(i.material||'')+' '+(i.pattern||'');
  return /linen/i.test(t)?'linen':/herringbone/i.test(t)?'herringbone':/twill|serge|gabardine/i.test(t)?'twill':'plain'};
function ovlSuitPng(i){if(typeof document==='undefined')return null;const o=ovlItem(i),s=usableSett(o),bands=s&&s.v===2&&s.bands&&s.bands.length>1?s.bands:null;
  if(!bands&&(s&&s.motif||[...STRIPE_PATS,...CHECK_PATS,...MOTIF_PATS].includes(patBase(i.pattern)||'')))return null;
  const kind=ovlGrain(i),cx=bands&&s.cross&&s.cross.bands&&Math.abs(Math.abs(s.cross.d)-90)<=20?s.cross:null,flip=bands&&Math.abs(Math.abs(s.a||0)-90)<20;
  const key=JSON.stringify([bands,cx,flip,kind,colOf(i)]);if(OVL_SUITS.has(key))return OVL_SUITS.get(key);
  const S=OVL_PX,P=S/2,Pc=P*(cx&&cx.r||1),Q=8,ground=hexRgb(colOf(i));
  const cum=b=>{let a=0;return b.map(([h,w])=>{const r=[a,a+w,h];a+=w;return r})},at=(B,u)=>{u=((u%1)+1)%1;for(const b of B)if(u>=b[0]&&u<b[1])return b[2];return null};
  // along: the stripes' colour in each column, the share of each column point inside a band (anti-aliased by Q points)
  const vb=bands&&cum(bands),col=[];for(let p=0;p<S;p++){const a=[0,0,0];for(let q=0;q<Q;q++){const c=vb?hexRgb(at(vb,(p+(q+.5)/Q)/P)||'#000'):ground;for(let j=0;j<3;j++)a[j]+=c[j]/Q}col.push(a)}
  const cb=cx&&cum(cx.bands.map(([h,w])=>[h,h?Math.max(w,OVL_CROSS):w])),row=[];
  for(let p=0;p<S;p++){const a=[0,0,0];let n=0;if(cb)for(let q=0;q<Q;q++){const h=at(cb,(p+(q+.5)/Q)/Pc);if(h){const c=hexRgb(h);for(let j=0;j<3;j++)a[j]+=c[j];n++}}row.push(n?{c:a.map(v=>v/n),k:n/Q*OVL_CROSS_A}:null)}
  const hash=(x,y)=>{let h=(x*374761393+y*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296},m=OVL_GRAIN;
  const c=document.createElement('canvas');c.width=c.height=S;const X=c.getContext('2d'),D=X.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const u=flip?y:x,v=flip?x:y,b=col[u],r=row[v],px=r?b.map((w,j)=>w+(r.c[j]-w)*r.k):b;let g;
    if(kind==='twill')g=1+m*(.055*Math.sin(2*Math.PI*(x+y)/7)+.03*(hash(x+y,(y-x)>>2)-.5));
    else if(kind==='herringbone'){const k=Math.floor(x/26),d=k%2?x+y:x-y;g=1+m*(.07*Math.sin(2*Math.PI*d/7)+.03*(hash(d,k)-.5))}
    else if(kind==='linen')g=1+m*(.05*(hash(x>>1,7)-.5)+.05*(hash(13,y>>1)-.5)+.03*(hash(x,y)-.5));
    else g=1+m*(.025*Math.sin(Math.PI*x/2)*Math.sin(Math.PI*y/2)+.035*(hash(x,y)-.5));
    const k=4*(y*S+x);for(let j=0;j<3;j++)D.data[k+j]=Math.max(0,Math.min(255,Math.round(px[j]*g)));D.data[k+3]=255}
  X.putImageData(D,0,0);const url=c.toDataURL('image/png');if(OVL_SUITS.size>12)OVL_SUITS.clear();OVL_SUITS.set(key,url);return url}
// a plain or finely woven jacket with a close-up shows it again (the owner's choice, 2026-11-13, "the mix": at 64 px the painted grain of
// a twill was a flat square, its close-up real cloth); a striped, checked or figured one stays painted (its close-up lost the stripes)
/* a herringbone shirt's swatch (2026-11-14, the owner's pick "D" from mockups of his pink herringbone): cut from the painter's own cloth
   (asm-color.js asmCmTile: the colour held, every other column lighter, as in the picture), about OVL_HB_PAIRS column pairs across, a
   OVL_HB_PX square PNG (the enlarged swatch is 46% of the picture). The drawn swatch (the list dot's tile at 2.2x strength) read as harsh
   charcoal zigzags on near-white. The tile is rasterised, so it is made once per look, asynchronously: until then a plain patch of the
   shirt's colour (data-hb), replaced where it shows when ready; if it can't be made, the drawn swatch as before */
const OVL_HB_PAIRS=5,OVL_HB_PX=512,OVL_HB=new Map();
const ovlHbKey=i=>JSON.stringify([colOf(i),usableSett(i),i.pattern,typeof ASM_HB_COL_LIFT!=='undefined'?[ASM_HB_COL_LIFT,ASM_HB_SHIRT_Y]:0,OVL_HB_PAIRS]);
function ovlHbShirt(i){if(!i||i.type!=='shirt'||typeof document==='undefined'||typeof asmHbShirt!=='function'||typeof asmCmTile!=='function'||!asmHbShirt(i))return null;
  const k=ovlHbKey(i);let e=OVL_HB.get(k);
  if(!e){e={id:'hb'+OVL_HB.size,url:null,fail:false};OVL_HB.set(k,e);
    const put=h=>document.querySelectorAll(`[data-hb="${e.id}"]`).forEach(x=>{x.outerHTML=h});
    e.p=asmCmTile(i,'shirt').then(T=>{if(!T)throw new Error('no tile');
      const g=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055),tc=document.createElement('canvas');tc.width=T.TW;tc.height=T.TH;
      const tx=tc.getContext('2d'),d=tx.createImageData(T.TW,T.TH);for(let n=0;n<T.TW*T.TH;n++){for(let q=0;q<3;q++)d.data[4*n+q]=g(Math.max(0,Math.min(1,T.t[3*n+q])));d.data[4*n+3]=255}tx.putImageData(d,0,0);
      const S=OVL_HB_PX,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),s=S/(OVL_HB_PAIRS*T.TW);x.imageSmoothingQuality='high';
      x.save();x.scale(s,s);x.fillStyle=x.createPattern(tc,'repeat');x.fillRect(0,0,S/s,S/s);x.restore();
      const gr=x.createLinearGradient(0,0,S,S);gr.addColorStop(0,'rgba(255,255,255,.08)');gr.addColorStop(1,'rgba(0,0,0,.10)');x.fillStyle=gr;x.fillRect(0,0,S,S);   // the light, as the drawn swatches have
      e.url=c.toDataURL('image/png');if(OVL_HB.size>16){const first=OVL_HB.keys().next().value;if(first!==k)OVL_HB.delete(first)}put(`<img src="${e.url}" alt="">`)})
      .catch(err=>{console.warn('herringbone swatch not made',err);e.fail=true;put(ovlSvg(i))})}
  if(e.url)return `<img src="${e.url}" alt="">`;if(e.fail)return null;
  return `<svg data-hb="${e.id}" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" fill="${colOf(i)}"/></svg>`}
const ovlPiece=i=>{if(i.type==='suit'||i.type==='blazer'){if(ovlCloseup(i)&&!ovlDrawn(i))return `<img src="${i.swatch}" alt="">`;const u=ovlSuitPng(i);return u?`<img src="${u}" alt="">`:ovlSvg(i)}
  if(i.type==='shirt'){const h=ovlHbShirt(i);if(h)return h}
  return ovlCloseup(i)&&!ovlDrawn(i)?`<img src="${i.swatch}" alt="">`:ovlSvg(i)};
function swatchStack(o,up){const ps=[['top',o.top],['shirt',o.shirt],['tie',o.tie]].filter(([,i])=>i);if(!ps.length)return '';
  // each swatch is a button: it opens that piece up close (swTap)
  return `<div class="swstack${up?' up':''}" role="group" aria-label="${esc(ps.map(([s,i])=>slotLabel(s,o)+': '+itemTitle(i)).join('; '))}">${ps.map(([s,i])=>`<button type="button" class="ovsw" data-s="${s}" onclick="swTap('${s}')" aria-pressed="false" aria-label="See the ${esc(slotLabel(s,o).toLowerCase())} up close: ${esc(itemTitle(i))}">${ovlPiece(i)}</button>`).join('')}</div>`}
function wornBar(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),can=+d<=+T,lw=lastWorn(o);
  const pill=lw?`<small class="lastworn">Last worn ${lw.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</small>`:'';
  if(!can)return pill?`<div class="wornbar">${pill}</div>`:'';
  return `<div class="wornbar" role="group" aria-label="Did you wear this outfit?"><button class="wmark no${o.worn===false?' on':''}" aria-pressed="${o.worn===false}" onclick="setWorn(${o.worn===false?'undefined':'false'})" aria-label="Didn't wear" title="Didn't wear">✕</button>${pill}<button class="wmark yes${o.worn===true?' on':''}" aria-pressed="${o.worn===true}" onclick="setWorn(${o.worn===true?'undefined':'true'})" aria-label="Wore this" title="Wore this">✓</button></div>`}
function figureStage(o){
  const below=[...(o.suitDay?[]:[['bot',o.bot]]),['belt',o.belt],['shoes',o.shoes],['socks',o.socks],...(o.coat?[['coat',o.coat]]:[])].filter(([,i])=>i);
  const tiles=below.map(([s,i])=>{const bg=itemPic(i)&&(picBgs[itemKey(i)]||PIC_BG);return `<button class="tile${s==='coat'?' coat-tile':''}${bg?' has-pic':''}" data-type="${i.type}"${bg?` style="background:${bg}"`:''}${s==='coat'?` data-coat="${i.type}"`:''} onclick="pickPiece('${s}')" aria-expanded="${belowOpen===s}" aria-controls="bpanel" aria-label="${slotLabel(s,o)}: ${desc(i)}. ${belowOpen===s?'Hide':'Show'} the photo">${itemPicHtml(i,itemThumb(i))}<small>${slotLabel(s,o)}</small></button>`}).join('');
  const r=renderFor(o),photo=!!r;
  setTimeout(()=>fetchRemoteRender(o,key(sel)),0);   // missing here: fetch it; only here: share it
  if(asmLive())setTimeout(()=>asmEnsure(o),0);   // and its item photos, to put the outfit's picture together here
  schedulePrefetch();   // and the rest of the month's photos, nearest first
  // a photo replaces the illustration. Today has no Generate button (the owner, 2026-11-13: pictures that cost money are made only
  // from Settings → This day's photo, "Regenerate photo"); a photo asked for there says here how it is getting on
  const ck=comboKey(o),pend=renderPending(o),fail=renderFail[ck],stalled=!pend&&renderStalled(ck);
  const msg=renderMsg.k===key(sel)&&renderMsg.t?renderMsg.t:pend?(rendering===ck?'Sending it…':'It is being made (about a minute). You can swipe to another day or close the app: it appears here when it’s ready.'):fail?`The photo couldn’t be made. ${/[.!?]$/.test(fail)?fail:fail+'.'}`:stalled?'This photo has been in the making for over 10 minutes, far longer than one takes. Regenerate photo in ⚙ Settings sends it again.':'';
  const ctl=`<p class="mut render-msg" id="render-msg">${pend?'<span class="spin" aria-hidden="true"></span>':''}${esc(msg)}</p>`;
  const T0=todayDate(),marks=+new Date(sel.getFullYear(),sel.getMonth(),sel.getDate())<=+T0;   // ✕ and ✓ show on today and past days
  return (photo?`<div class="fig photo" id="mannequin-container"><img onload="fitNavSoon()" src="${r.img}" alt="Photo of ${esc(figureLabel(o))}">${swatchStack(o,marks)}${wornMarks(o)}</div>`
    :`<div class="fig" id="mannequin-container">${figureSvg(o)}${wornMarks(o)}</div>`)+ctl+
    (tiles?`<div class="below" style="--n:${below.length}" aria-label="${o.coat?'Coat and below the waist':'Below the waist'}" role="group">${tiles}</div>`+belowBox(o,below):'');
}

let dayShown=null;   // the calendar day the app last drew, and whether it was showing "today's" outfit then
function newDayCheck(){const T=todayDate(),tk=key(T);if(!dayShown){dayShown={k:tk,home:true};return}
  if(dayShown.k===tk)return;const home=dayShown.home;dayShown={k:tk,home:true};cache={};checkArrivals().then(n=>{if(n&&!$('#today').hidden)refreshToday()});
  if(home){const h=homeDay();sel=new Date(h);view={y:h.getFullYear(),m:h.getMonth()};monthOpen=false}
  if(!$('#today').hidden)refreshToday()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;if(queuedKeys().length){checkQueue();startQueueWatch()}
  newDayCheck();try{const c=JSON.parse(localStorage.getItem('wx')||'null');if(settings.location&&(!c||Date.now()-c.t>3*3600e3))loadWeather()}catch{}
  remoteKeys=null;schedulePrefetch()});   // photos made on another device meanwhile
function pickPiece(s){const o=planFor()[key(sel)],el=$('#bbox');if(!o||!el||!s||!o[s])return;const opening=belowOpen!==s,was=el.classList.contains('open');
  belowOpen=opening?s:null;
  document.querySelectorAll('.below .tile').forEach(t=>{const on=opening&&t.getAttribute('onclick')===`pickPiece('${s}')`;t.setAttribute('aria-expanded',on);
    t.setAttribute('aria-label',t.getAttribute('aria-label').replace(/(Show|Hide) the photo/,on?'Hide the photo':'Show the photo'))});
  const inn=el.querySelector('.rpanel-in');
  if(opening&&was){picStop(el);inn.innerHTML=rowPanel(o[s]);if(!noMotion())inn.animate([{opacity:0},{opacity:1}],{duration:200});return}   // another tile while one is open: its photo takes the place
  if(opening){inn.innerHTML=rowPanel(o[s]);picOpenReady(el,$('.below'),()=>belowOpen===s)}else{revealRun++;picShut(el)}}
/* ---- back to today: the day to return to is today, or the next workday when today is off ---- */
const homeDay=()=>{const T=todayDate();return isWorkday(T)?T:nextWorkday(T)};
const todayBtn=()=>{const h=homeDay();if(key(sel)===key(h))return '';const isT=+h===+todayDate();
  return `<button class="gotoday" onclick="goToday()" aria-label="${isT?"Back to today's outfit":'Go to the next outfit'}">${isT?'↩ Today':'↩ Next outfit'}</button>`};
function goToday(){const h=homeDay();sel=new Date(h);view={y:h.getFullYear(),m:h.getMonth()};monthOpen=false;show('today');scrollTo({top:0,behavior:'smooth'})}
/* ---- the day's pieces: a folded box (a strip of fabric chips, like the month box) that unfolds into the full list ---- */
let listOpen=false;
function piecesBox(o){
  const pcs=[['top',o.top],['vest',o.vest?o.top:null],['bot',o.suitDay?null:o.bot],['shirt',o.shirt],['tie',o.tie],['clip',o.clip],['links',o.links],['watch',o.watch],['belt',o.belt],['socks',o.socks],['shoes',o.shoes],['coat',o.coat]].filter(([,i])=>i);
  const chips=pcs.map(([s,i])=>`<span class="pchip${s==='vest'?' vest':''}" title="${slotLabel(s,o)}: ${esc(s==='vest'?'matching vest':desc(i)||nm(i))}">${swatchSVG(i,true)}</span>`).join('');
  const sum=piecesLine(o);
  return `<section class="mbox ibox${listOpen?' open instant':''}" id="ibox"><button class="month-link" onclick="toggleList()" aria-expanded="${listOpen}" aria-controls="ipanel" aria-label="Outfit pieces: ${pcs.length}. ${listOpen?'Fold away':'Show the list'}">
    <span class="pstrip" aria-hidden="true" style="--pc:${pcs.length<=6?pcs.length:Math.ceil(pcs.length/2)}">${chips}</span><span class="mltxt"><b>${pcs.length} piece${pcs.length===1?'':'s'}</b><small class="cap">${esc(sentence(sum))||'Tap to see the list'}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="ipanel"><div class="mpanel-in" onclick="foldListTap(event)"><div class="list">${slots(o)}</div></div></div></section>`}
/* a tap inside the open pieces list that is not on a button, a link or a photo (e.g. on the names on the left) folds the list */
function foldListTap(e){if(!listOpen||e.target.closest('button,a,input,select,label,.rpanel'))return;toggleList()}
/* folding a box whose top is above the screen (folded from its bottom): bring the card back into view */
function keepInView(box){if(foldQuiet)return;const r=box.getBoundingClientRect();if(r.top<8)scrollBy({top:r.top-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
function toggleList(){const box=$('#ibox');if(!box)return;listOpen=!listOpen;
  const b=$('#ibox .month-link');b.setAttribute('aria-expanded',listOpen);b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show the list/,listOpen?'Fold away':'Show the list'));
  if(listOpen)boxUnfold(box);else{revealRun++;boxFold(box,'#ipanel .list>*')}}
function renderToday(){
  closeSettings();if(pastEdit&&pastEdit!==key(sel))pastEdit=null;if(picker)closePicker();dayShown={k:key(todayDate()),home:key(sel)===key(homeDay())};
  const p=planFor();
  const o=p[key(sel)]||{suitDay:true,top:null,bot:null,shirt:null,tie:null,shoes:null,belt:null,socks:null,watch:null,clip:null};
  const nav=`<div class="nav day"><button onclick="stepDay(-1)" aria-label="Previous day">‹</button><h2><span class="dlong">${sel.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><span class="dshort">${sel.toLocaleDateString(undefined,{weekday:'short',month:'long',day:'numeric'})}</span><small class="wx">${settings.location?(wxChip(sel)||''):'<a href="#" onclick="openSettings(\'weather\');return false">Set your location for weather</a>'}${todayBtn()}</small></h2><button onclick="stepDay(1)" aria-label="Next day">›</button></div>`;
  // only the stage (the figure) slides on a swipe; the date bar and the item list stay put and just update
  let stage='',side='';const first=(typeof setupToday==='function'?setupToday():'')+(typeof kitSampleBanner==='function'?kitSampleBanner():'');   // what is still needed for a first outfit (setup.js)
  if(!isWorkday(sel))stage=first+(offName(sel)&&settings.workdays.includes(sel.getDay())?`<p class="mut empty">A day off: ${esc(offName(sel))}. You can change your days off in Settings.</p>`
    :`<p class="mut empty">${DAY_NAMES[sel.getDay()]} isn't a workday. You can change your workdays in Settings.</p>`);   // the checklist comes first on every day, above the figure or the day's note
  else if(!items.length||(first&&!hasOutfit(o)))stage=first||'<p class="mut empty">Your wardrobe is empty. Add photos on the Add tab to get an outfit.</p>';
  else{stage=first+figureStage(o);
    // the rest warning goes below the list so the list never shifts when it appears or disappears
    side=`${scoreCard(o)}${piecesBox(o)}${dayActions(o)}${(o.notes||[]).map(t=>`<p class="warn">${t}</p>`).join('')}${o.top&&o.top.rest<COOL?`<p class="warn">This ${o.suitDay?'suit':'blazer'} was worn ${o.top.rest} day${o.top.rest===1?'':'s'} ago. Add more ${o.suitDay?'suits':'blazers'} to get a ${COOL}-day rest.</p>`:''}${typeof careNote==='function'?careNote(o):''}`}
  $('#today').innerHTML=nav+`<div class="daygrid"><div class="stage" id="stage"><div class="slide" id="slide">${stage}</div></div><div class="side">${side}${items.length?monthLink()+resetCard(isWorkday(sel)?o:null):''}</div></div>`;applyZoom(false);swApply(false);fitNavSoon();
  if(cache.snap&&p===cache[cache.snap]){const idle=self.requestIdleCallback||(f=>setTimeout(f,50));idle(planSnapCheck,{timeout:600})}   // the kept month: planned for real once idle (planSnapCheck records and locks then)
  else if(items.length){if(typeof pulledYet==='function'&&pulledYet())recordDays(p).then(lockUpcoming).then(()=>{if(typeof planSnapSoon==='function')planSnapSoon()});
    else if(!todayPullWait){todayPullWait=true;whenPulled(()=>{todayPullWait=false;if(!$('#today').hidden)refreshToday()})}   // (drawn again once the backup is merged, and recorded then)
  }
}

/* a swipe to another day folds whatever is open (score, pieces list and its rows, a below-the-waist photo, the month) and zooms
   the picture back out: it starts as soon as the drag is known to be sideways, so the boxes fold while the day slides */
let foldQuiet=false;
function foldAll(){foldQuiet=true;try{if(openRow)toggleRow(openRow);if(belowOpen)pickPiece(belowOpen);if(scoreOpen)toggleScore();if(listOpen)toggleList();if(monthOpen)toggleMonth()}
  catch(e){console.warn(e)}finally{foldQuiet=false}scoreOpen=listOpen=monthOpen=false;belowOpen=openRow=null;zoomOut();if(typeof swClose==='function')swClose()}
/* ---- double-tap the Today picture (the photo, or the drawing) to zoom in on the tie and shirt, again to zoom back out; while
   zoomed, a drag pans it (and doesn't change the day). 2.5x: the outfit photo is 1024 px square and fills about 390 px on a phone,
   so 2.5x shows it at about its own resolution (any more is only blur), with a collar, tie knot or shirt front filling the frame. ---- */
const ZOOM=2.5;let zoom=null,zoomPan=null,lastTap=null,zoomTouchAt=0;
const zoomTarget=()=>{const c=$('#mannequin-container');return c&&c.querySelector(':scope > img, :scope > svg')};
function applyZoom(anim){const c=$('#mannequin-container'),t=zoomTarget();if(!c||!t)return;const on=!!zoom&&zoom.k===key(sel);if(!on)zoom=null;
  c.classList.toggle('zoomed',on);t.style.transformOrigin='0 0';t.style.transition=anim&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'transform .28s cubic-bezier(.2,.8,.2,1)':'none';
  t.style.transform=on?`translate(${zoom.x.toFixed(1)}px,${zoom.y.toFixed(1)}px) scale(${ZOOM})`:''}
function clampZoom(){const c=$('#mannequin-container');if(!c||!zoom)return;const W=c.clientWidth,H=c.clientHeight;   // the frame, which the picture fills (an <svg> has no offsetWidth)
  zoom.x=Math.min(0,Math.max(W*(1-ZOOM),zoom.x));zoom.y=Math.min(0,Math.max(H*(1-ZOOM),zoom.y))}
/* wherever it is tapped, it zooms in on the tie and the shirt: centred across, the top of the picture (the collar and the knot)
   at the top of the frame, as the owner asked; a drag then pans from there */
function toggleZoom(){const c=$('#mannequin-container'),t=zoomTarget();if(!c||!t)return;
  if(swOpen){swClose();return}   // a swatch open up close: the double tap closes it
  if(zoom)zoom=null;else{zoom={k:key(sel),x:c.clientWidth*(1-ZOOM)/2,y:0};clampZoom()}
  applyZoom(true)}
function zoomOut(){if(zoom){zoom=null;applyZoom(true)}}
/* ---- a swatch tapped (the owner's pick, 2026-11-13, from mockups: "C", revised twice): the swatch opens large at the top left with the
   piece's name under it, the small swatches shrink in their column at the bottom left, and the photo zooms (SW_Z) and moves so the piece
   lands at SW_AT on the right, ringed (no label: the owner's ask). Another swatch switches, the same swatch or a tap on the picture
   closes it, and so do a swipe to another day and the double-tap zoom. Photos only (the drawn figure has no stack). ---- */
const SW_Z=2.3,SW_AT=[.7,.4];
// where each piece is on each colour-coded master (fractions of the picture): the point deepest inside it, measured from the masters'
// masks at 512 (the jacket's body without its sleeves and lapels); r its inscribed radius, which sizes the ring. A picture made another
// way (an outfit photo, the earlier assembler) takes the suit master's, or the open-collar shirt master's without a jacket
const SW_SPOT={suit:{top:[.341,.606,.106],shirt:[.419,.12,.043],tie:[.481,.315,.053]},vest:{top:[.341,.604,.106],shirt:[.544,.052,.039],tie:[.483,.247,.049]},
  'suit-open':{top:[.341,.606,.106],shirt:[.478,.261,.072]},'shirt-tie':{shirt:[.335,.224,.129],tie:[.497,.519,.039]},'shirt-open':{shirt:[.364,.206,.144]}};
let swOpen=null;
const swKind=o=>{let k=null;try{k=typeof asmCmUse==='function'&&typeof ASM_ON!=='undefined'&&ASM_ON?asmCmUse(o):null}catch(e){}return SW_SPOT[k]?k:o.top?(o.vest?'vest':'suit'):o.tie?'shirt-tie':'shirt-open'};
const swSpot=(o,s)=>(SW_SPOT[swKind(o)]||{})[s]||SW_SPOT.suit[s]||SW_SPOT['shirt-tie'][s];
function swApply(anim){const c=$('#mannequin-container'),t=zoomTarget(),o=planFor()[key(sel)];if(!c)return;
  const on=!!(swOpen&&swOpen.k===key(sel)&&t&&o&&o[swOpen.s]&&c.classList.contains('photo')&&c.querySelector('.swstack'));if(!on)swOpen=null;
  c.scrollTop=0;c.scrollLeft=0;   // (a zoomed photo made the frame scrollable, and the tapped swatch's focus scrolled it: styles.css clips it too)
  c.classList.toggle('swopen',on);c.querySelectorAll('.swstack .ovsw').forEach(b=>{const me=on&&b.dataset.s===swOpen.s;b.classList.toggle('on',me);b.setAttribute('aria-pressed',me)});
  const motion=anim&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!on){c.querySelectorAll('.swlens,.swlab,.swring').forEach(e=>e.remove());if(t&&!zoom){t.style.transition=motion?'transform .45s cubic-bezier(.2,.8,.2,1)':'none';t.style.transform=''}return}
  const W=c.clientWidth,H=c.clientHeight,[fx,fy,r]=swSpot(o,swOpen.s),cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  // the piece moved to SW_AT, but never past the picture's edges (no blank space shows)
  const tx=cl(SW_AT[0]*W-SW_Z*fx*W,W-SW_Z*W,0),ty=cl(SW_AT[1]*H-SW_Z*fy*H,H-SW_Z*H,0);
  t.style.transformOrigin='0 0';t.style.transition=motion?'transform .45s cubic-bezier(.2,.8,.2,1)':'none';t.style.transform=`translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${SW_Z})`;
  const it=o[swOpen.s],mk=(cls,html)=>{let e=c.querySelector(':scope > .'+cls);if(!e){e=document.createElement('div');e.className=cls;e.setAttribute('aria-hidden','true');c.appendChild(e)}if(html!=null)e.innerHTML=html;return e};
  mk('swlens',ovlPiece(it));   // (no name under it: the owner's ask, 2026-11-13, so the small swatches keep more of their size)
  const ring=mk('swring'),d=cl(2*r*SW_Z,.16,.26)*W;ring.style.width=ring.style.height=d+'px';ring.style.left=(tx+SW_Z*fx*W)+'px';ring.style.top=(ty+SW_Z*fy*H)+'px'}
function swTap(s){const k=key(sel);if(zoom){zoom=null;applyZoom(false)}swOpen=swOpen&&swOpen.k===k&&swOpen.s===s?null:{k,s};swApply(true)}
function swClose(){if(swOpen){swOpen=null;swApply(true)}}
// a tap on the picture (not on a swatch or another button) closes it
$('#today').addEventListener('click',e=>{if(!swOpen)return;const c=e.target.closest&&e.target.closest('#mannequin-container');if(c&&!e.target.closest('button,a'))swClose()});
(()=>{const el=$('#today'),inPic=e=>{const c=e.target.closest&&e.target.closest('#mannequin-container');return c&&!e.target.closest('button,a')?c:null};
  el.addEventListener('touchstart',e=>{const c=inPic(e);if(!c||e.touches.length>1){zoomPan=null;return}const t=e.touches[0];
    zoomPan={x0:t.clientX,y0:t.clientY,t:Date.now(),zx:zoom?zoom.x:0,zy:zoom?zoom.y:0,moved:false}},{passive:true});
  el.addEventListener('touchmove',e=>{if(!zoomPan)return;const t=e.touches[0],dx=t.clientX-zoomPan.x0,dy=t.clientY-zoomPan.y0;if(Math.abs(dx)>8||Math.abs(dy)>8)zoomPan.moved=true;
    if(!zoom)return;e.preventDefault();zoom.x=zoomPan.zx+dx;zoom.y=zoomPan.zy+dy;clampZoom();applyZoom(false)},{passive:false});
  el.addEventListener('touchend',e=>{const p=zoomPan;zoomPan=null;if(!p||p.moved||Date.now()-p.t>300){lastTap=null;return}const t=e.changedTouches[0],now=Date.now();
    if(lastTap&&now-lastTap.t<320&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<40){lastTap=null;zoomTouchAt=now;e.preventDefault();toggleZoom(t.clientX,t.clientY)}
    else lastTap={t:now,x:t.clientX,y:t.clientY}},{passive:false});
  el.addEventListener('dblclick',e=>{if(!inPic(e)||Date.now()-zoomTouchAt<700)return;e.preventDefault();toggleZoom(e.clientX,e.clientY)});
})();
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed */
/* move to the next/previous scheduled day (Sunday-Thursday), crossing months as needed.
   from: where the new day's outfit slides in from (px, sign = side); 0 = no animation */
function stepDay(n,from){
  const d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate());
  let g=0;do d.setDate(d.getDate()+n);while(!isWorkday(d)&&++g<7);
  foldAll();sel=d;view={y:d.getFullYear(),m:d.getMonth()};renderToday();
  const sl=$('#slide');if(!sl)return;
  const x=from===undefined?(n>0?1:-1)*Math.min(innerWidth*.35,140):from;if(!x||noMotion())return;   // reduced motion: the new day just shows
  sl.style.transition='none';sl.style.transform=`translateX(${x}px)`;sl.style.opacity='0';
  void sl.offsetWidth;
  sl.style.transition='transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out';sl.style.transform='translateX(0)';sl.style.opacity='1';
}
(()=>{const el=$('#today');let st=null;
  const slide=()=>$('#slide');
  el.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    // ignore multi-touch and touches that start at the screen edge (iOS back/forward gesture)
    // the gesture can start anywhere on Today (e.g. a Saturday shows only a one-line message); only the outfit moves
    // nor while the picture is zoomed: then a drag on it pans the picture
    // inside the open month a sideways drag changes the month instead (the day stays)
    st=e.touches.length>1||t.clientX<24||t.clientX>innerWidth-24||(zoom&&e.target.closest('#mannequin-container'))?null:{x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0,month:!!e.target.closest('#mpanel-in')};
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(outfitMove)st=null;if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.lock&&(Math.abs(dx)>8||Math.abs(dy)>8)){st.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';if(st.lock==='x'&&!st.month)foldAll()}
    if(st.lock!=='x')return;
    e.preventDefault(); // horizontal drag is ours: no page pan, no zoom bounce
    if(st.month){st.dx=dx;monthDrag(dx);return}
    st.dx=dx;const sl=slide();if(sl){sl.style.transition='none';sl.style.transform=`translateX(${dx}px)`;sl.style.opacity=String(1-Math.min(.5,Math.abs(dx)/innerWidth))}
  },{passive:false});
  const end=()=>{
    if(!st)return;const {lock,dx,t,month}=st;st=null;if(month){if(lock==='x')monthRelease(dx,Date.now()-t);return}const sl=slide();if(lock!=='x'||!sl)return;
    const fast=Math.abs(dx)/Math.max(1,Date.now()-t)>.5;
    if(Math.abs(dx)>70||(fast&&Math.abs(dx)>30)){
      const n=dx<0?1:-1,w=sl.offsetWidth||innerWidth;
      if(noMotion()){stepDay(n,0);return}   // reduced motion: no fly-out and slide-in
      sl.style.transition='transform .16s ease-in,opacity .16s';sl.style.transform=`translateX(${dx<0?-w:w}px)`;sl.style.opacity='0';
      setTimeout(()=>stepDay(n,(dx<0?1:-1)*w*.6),160);
    }else{sl.style.transition='transform .2s ease-out,opacity .2s';sl.style.transform='translateX(0)';sl.style.opacity='1'}
  };
  el.addEventListener('touchend',end,{passive:true});el.addEventListener('touchcancel',end,{passive:true});
  // a mouse drag inside the open month does the same on a computer; the click that ends a drag doesn't open a day
  let md=null,noClick=false;
  el.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||!e.target.closest('#mpanel-in'))return;md={x:e.clientX,y:e.clientY,t:Date.now(),on:false}});
  addEventListener('pointermove',e=>{if(outfitMove)md=null;if(!md)return;const dx=e.clientX-md.x;if(!md.on&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(e.clientY-md.y))md.on=true;if(md.on){e.preventDefault();monthDrag(dx)}});
  addEventListener('pointerup',e=>{if(!md)return;const m=md;md=null;if(!m.on)return;noClick=true;setTimeout(()=>noClick=false,0);monthRelease(e.clientX-m.x,Date.now()-m.t)});
  el.addEventListener('click',e=>{if(noClick&&e.target.closest('#mpanel-in')){e.stopPropagation();e.preventDefault()}},true);
  document.addEventListener('keydown',e=>{if(el.hidden||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight')stepDay(1);if(e.key==='ArrowLeft')stepDay(-1)});
})();

/* ---- moving an outfit to another day in the month: long-press a day (like an icon on an iPhone home screen), drag it over
   another day and the planner re-plans the month live as if the outfit were pinned there (the day it left is planned afresh, and
   every later day adjusts for rest and repeats); outfits that changed day slide from their old cell to their new one. Drop to
   keep it (the target day gets the outfit's pieces as pins, `kind` keeps it a suit or blazer day), drop anywhere else to cancel.
   Only today and later workdays that aren't worn and have no occasion take part. ---- */
let outfitMove=null;
const mvSig=o=>o?[o.top&&o.top.id,o.bot&&o.bot.id,o.shirt&&o.shirt.id,o.tie&&o.tie.id].join('|'):'';
const MOVE_HOLD=380,MOVE_SLOP=8;
function moveRecs(src,dst,plan){const o=(plan||planFor())[src];if(!o)return null;const ids=idsOf(o),force={};
  for(const [s,v] of Object.entries(ids))if(v&&s!=='coat')force[s]=v;   // the coat is the weather's choice
  const recs={...dayRecs},keep=r=>{const n={...(r||{})};delete n.force;delete n.skip;delete n.ids;delete n.vest;delete n.kind;delete n.auto;delete n.lock;return n};
  recs[dst]={...keep(dayRecs[dst]),date:dst,force,vest:!!o.vest,kind:o.suitDay?'suit':'blazer'};
  const s=keep(dayRecs[src]);if(Object.keys(s).filter(k=>k!=='date'&&k!=='updated').length)recs[src]={...s,date:src};else delete recs[src];
  return recs}
/* the month as it would be planned with these records (the real ones and the cache stay as they are) */
function planWith(recs,y,m){const keep=dayRecs;dayRecs=recs;try{return buildPlan(y,m)}finally{dayRecs=keep}}
/* put a plan into the grid: a cell whose outfit changed gets its new stack, sliding in from the cell that showed it before */
function showPlan(p){const grid=document.querySelector('#mpanel-in .mgrid:not(.mdow)');if(!grid)return;
  const cells=[...grid.querySelectorAll('.mc[data-k]')],was=new Map(),ease='cubic-bezier(.2,.8,.2,1)',still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const c of cells){const st=c.querySelector('.stack');if(c.dataset.sig&&st&&!was.has(c.dataset.sig))was.set(c.dataset.sig,st.getBoundingClientRect())}
  for(const c of cells){const o=p[c.dataset.k];if(!o||!hasOutfit(o))continue;const sg=mvSig(o);if(sg===c.dataset.sig)continue;
    const old=c.querySelector('.stack');if(!old)continue;const box=document.createElement('span');box.innerHTML=stackSVG(o);const nw=box.firstElementChild;
    // the lifted day's drawing may be what the finger is on: it stays in the page, hidden, or the browser stops sending that touch
    if(c.classList.contains('lifted')){old.classList.replace('stack','mv-held');old.after(nw)}else old.replaceWith(nw);c.dataset.sig=sg;
    if(still||!nw.animate)continue;const from=was.get(sg),to=nw.getBoundingClientRect();
    if(from)nw.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px)`,zIndex:3},{transform:'none',zIndex:3}],{duration:340,easing:ease});
    else nw.animate([{opacity:0,transform:'scale(.82)'},{opacity:1,transform:'none'}],{duration:260,easing:ease})}}
(()=>{const root=$('#today');let hold=null,mv=null,noClick=false;
  const cellAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&el.closest('#mpanel-in .mc[data-mv]')};
  const start=(cell,x,y)=>{clearTimeout(hold&&hold.t);hold={cell,x,y,t:setTimeout(()=>lift(cell,x,y),MOVE_HOLD)}};
  const cancelHold=()=>{if(hold){clearTimeout(hold.t);hold=null}};
  function lift(cell,x,y){hold=null;if(!monthPanel)return;const r=cell.getBoundingClientRect(),g=document.createElement('div');
    const base=planMonth(monthPanel.y,monthPanel.m),o=base[cell.dataset.k];if(!o)return;
    // its own drawing (fresh pattern ids): the lifted cell's may be hidden while the month is re-planned, and its patterns with it
    g.className='mv-ghost';g.innerHTML=`<span class="dn">${keyDate(cell.dataset.k).getDate()}</span>${stackSVG(o)}`;g.style.width=r.width+'px';g.style.height=r.height+'px';document.body.appendChild(g);
    mv={src:cell.dataset.k,over:null,ghost:g,dx:x-r.left-r.width/2,dy:y-r.top-r.height/2,y:monthPanel.y,m:monthPanel.m,base};
    outfitMove=mv;cell.classList.add('lifted');document.querySelector('#mpanel-in').classList.add('mv-on');if(navigator.vibrate)try{navigator.vibrate(12)}catch{}
    place(x,y)}
  function place(x,y){if(!mv)return;mv.ghost.style.transform=`translate(${x-mv.dx-mv.ghost.offsetWidth/2}px,${y-mv.dy-mv.ghost.offsetHeight*.85}px) scale(1.14)`;   // held a little above the fingertip, so the day under it shows
    const c=cellAt(x,y),k=c?c.dataset.k:null;if(k===mv.over)return;mv.over=k;
    document.querySelectorAll('#mpanel-in .mc.drop').forEach(e=>e.classList.remove('drop'));
    if(k&&k!==mv.src){c.classList.add('drop');const recs=moveRecs(mv.src,k,mv.base);if(recs){mv.recs=recs;showPlan(planWith(recs,mv.y,mv.m))}}
    else{mv.recs=null;showPlan(mv.base)}}
  async function drop(){if(!mv)return;const m=mv;mv=null;outfitMove=null;m.ghost.remove();noClick=true;setTimeout(()=>noClick=false,350);
    const pan=document.querySelector('#mpanel-in');if(pan)pan.classList.remove('mv-on');document.querySelectorAll('#mpanel-in .mc.drop,#mpanel-in .mc.lifted').forEach(e=>e.classList.remove('drop','lifted'));
    if(!m.recs||!m.over){showPlan(m.base);return}
    const before={src:dayRecs[m.src]?{...dayRecs[m.src]}:null,dst:dayRecs[m.over]?{...dayRecs[m.over]}:null},src=m.src,dst=m.over;
    await saveDay(m.recs[dst]);if(m.recs[src])await saveDay(m.recs[src]);else if(dayRecs[src])await saveDay({date:src});
    cache={};renderToday();
    const nm=k=>keyDate(k).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
    toast(`${nm(src)}'s outfit moved to ${nm(dst)}.`,6000,{label:'Undo',fn:async()=>{await saveDay(before.dst||{date:dst});await saveDay(before.src||{date:src});cache={};renderToday()}})}
  // touch: hold still, then drag; scrolling first (moving before the hold ends) cancels
  root.addEventListener('touchstart',e=>{const c=e.touches.length===1&&e.target.closest('#mpanel-in .mc[data-mv]');if(c){const t=e.touches[0];start(c,t.clientX,t.clientY)}},{passive:true});
  root.addEventListener('touchmove',e=>{const t=e.touches[0];if(hold&&Math.hypot(t.clientX-hold.x,t.clientY-hold.y)>MOVE_SLOP)cancelHold();if(mv){e.preventDefault();place(t.clientX,t.clientY)}},{passive:false});
  root.addEventListener('touchend',e=>{cancelHold();if(mv){e.preventDefault();drop()}},{passive:false});
  root.addEventListener('touchcancel',()=>{cancelHold();if(mv){mv.over=null;mv.recs=null;drop()}});
  // mouse: the same with a held button
  root.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;const c=e.target.closest('#mpanel-in .mc[data-mv]');if(c)start(c,e.clientX,e.clientY)});
  addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>MOVE_SLOP)cancelHold();if(mv){e.preventDefault();place(e.clientX,e.clientY)}});
  addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')return;cancelHold();if(mv)drop()});
  // the click that ends a hold or a move doesn't open the day; nor does the long press's context menu show
  root.addEventListener('click',e=>{if(noClick&&e.target.closest('#mpanel-in')){e.stopPropagation();e.preventDefault()}},true);
  root.addEventListener('contextmenu',e=>{if(e.target.closest('#mpanel-in .mc[data-mv]'))e.preventDefault()});
})();

