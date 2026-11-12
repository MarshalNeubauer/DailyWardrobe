/* Daily Wardrobe: "What to buy". A button on the Wardrobe tab opens a full-height sheet that slides up from the bottom
   (like the piece picker): the top picks, then a section per kind of piece with what the owner has, a verdict and up to
   five ideas each with its reasons, and how the wardrobe copes with a formal day, a wedding, a funeral and a day without a
   jacket. The analysis itself is analysis.js, run in analysis-worker.js; sections appear as they finish.
   - Escape, the backdrop, ×, changing tab and a swipe down (shopSwipe) close it
   - the result is kept on the device (meta 'shop': {sig, at, res}) and shown at once next time; it is checked again when
     the wardrobe changed since (shopSig) or it is over a week old
   - "Bought it" adds the piece as bought, on the way (item.order + item.paused, optional arrival date)
   - "Not for me" hides that colour and pattern for good (settings.shopSkip: keys type|colour group|pattern class, synced) */
let shop=null,shopBusy=null,shopPart=null,shopWorker=null,shopOpen=false,shopShown={},shopForm=null,shopMsg='',shopFigN=0;
const SHOP_STALE=7*864e5;
const shopSig=()=>items.map(i=>i.id+':'+stamp(i)).sort().join(',')+'|'+JSON.stringify([settings.workdays,settings.blazerDays,settings.vestMode||'auto'])+(wearsJacket()?'':'|nojacket')+(wearsTie()?'':'|notie');
const shopFresh=()=>!!shop&&shop.sig===shopSig()&&Date.now()-(shop.at||0)<SHOP_STALE;
const shopHid=x=>(settings.shopSkip||[]).includes(x.key);
const shopRecs=r=>r?r.cats.reduce((a,c)=>a+c.recs.filter(x=>!shopHid(x)).length,0):0;
const shopFind=key=>{const r=shopPart||(shop&&shop.res);if(!r)return null;for(const c of r.cats){const x=c.recs.find(x=>x.key===key);if(x)return x}return null};
db.then(()=>metaGet('shop')).then(v=>{if(v&&v.res&&v.res.v===2&&!shop){shop=v;if(!$('#wardrobe').hidden&&!editing)renderWardrobe()}}).catch(()=>{});

/* the button on the Wardrobe tab */
function shopButton(){
  if(!items.length)return '';
  const r=shop&&shop.res,n=shopRecs(r),first=r&&r.top.map(t=>shopFindIn(r,t.key)).find(x=>x&&!shopHid(x));
  const sub=shopBusy?'Checking your wardrobe…':r?`${n?`${n} idea${n===1?'':'s'}`:'Nothing needed'}${first?` · first: ${first.name}`:''}${shop.sig===shopSig()?'':' · your wardrobe changed since'}`:'What would improve your outfits most';
  return `<button type="button" class="shopbtn" id="shop-btn" onclick="openShop()" aria-haspopup="dialog"><span class="shopbtn-t"><b>What to buy</b><small>${esc(sub)}</small></span><span class="shopbtn-c" aria-hidden="true">›</span></button>`;
}
const shopFindIn=(r,key)=>{for(const c of r.cats){const x=c.recs.find(x=>x.key===key);if(x)return x}return null};

function openShop(){
  shopOpen=true;shopForm=null;shopMsg='';shopSwipe();renderShop();
  $('#shop-sheet').classList.add('on');$('#shop-backdrop').classList.add('on');$('#shop-sheet').scrollTop=0;
  if(!shopBusy&&!shopFresh())analyzeWardrobe();
}
function closeShop(){if(!shopOpen)return;shopOpen=false;const s=$('#shop-sheet'),b=$('#shop-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on')}
document.addEventListener('keydown',e=>{if(shopOpen&&e.key==='Escape')closeShop()});
/* swiping the sheet down closes it, as on the Wardrobe's item sheet: the header (with the grabber) is a handle at any time, the
   content only while it is scrolled to the top (further down, a downward swipe scrolls it back up, as it must). The choice is
   made on the first move of a touch, before the browser starts scrolling. The sheet follows the finger and the backdrop
   lightens; let go past a quarter of the sheet's height, or with a flick, and it closes, else it springs back (both by the
   sheet's own CSS transition, from where the finger left it). A section arriving from the check meanwhile is drawn once the
   finger lifts (shopStale): redrawing removes the element the touch started on, and its moves would stop coming.
   The listeners are installed the first time the sheet opens (openShop), not when the script loads: a test that never opens
   the sheet never runs this, so `npm test` can tell which tests a change here can affect (see CLAUDE.md, Testing). */
let shopDrag=false,shopStale=false,shopSwipeOn=false;
function shopSwipe(){if(shopSwipeOn)return;const v=$('#shop-sheet'),bd=$('#shop-backdrop');if(!v)return;shopSwipeOn=true;let st=null;
  const put=d=>{v.style.transform=d?`translateY(${d}px)`:'';if(bd)bd.style.opacity=d?String(Math.max(.15,1-d/v.offsetHeight)):''};
  const held=on=>{for(const el of [v,bd])if(el)el.style.transition=on?'none':''};
  v.addEventListener('touchstart',e=>{const t=e.touches[0],head=!!e.target.closest('.shop-top-head');
    st=!shopOpen||e.touches.length>1||e.target.closest('input,textarea')||(!head&&v.scrollTop>0)?null:{x:t.clientX,y:t.clientY,on:false,d:0,ly:t.clientY,lt:Date.now(),vy:0}},{passive:true});
  v.addEventListener('touchmove',e=>{
    if(!st)return;const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.on){if(dy>0&&dy>=Math.abs(dx)){st.on=shopDrag=true;held(true)}else{st=null;return}}   // downward: ours; anything else is a scroll
    e.preventDefault();const now=Date.now();if(now>st.lt){st.vy=(t.clientY-st.ly)/(now-st.lt);st.ly=t.clientY;st.lt=now}
    st.d=Math.max(0,dy);put(st.d)},{passive:false});
  const end=()=>{
    if(!st)return;const {on,d,vy}=st;st=null;if(!on)return;shopDrag=false;held(false);
    if(d>v.offsetHeight*.25||(vy>.5&&d>30))closeShop();
    put(0);if(shopStale){shopStale=false;if(shopOpen)renderShop()}};
  v.addEventListener('touchend',end,{passive:true});v.addEventListener('touchcancel',end,{passive:true});
}

/* run the analysis in the background; the sheet fills in section by section */
function analyzeWardrobe(){
  if(shopWorker){shopWorker.terminate();shopWorker=null}
  const sig=shopSig(),strip=({photo,swatch,stripes,texture,sett,patternText,weave,pbox,patternSpec,meas,...i})=>i;   // the planner needs the tags only: no pictures
  const payload={list:items.map(strip),days:Object.values(dayRecs),settings,weather,climate,today:TODAY_OVERRIDE,weeks:SHOP_WEEKS};
  const redraw=()=>{if(shopOpen)renderShop();const b=$('#shop-btn');if(b)b.outerHTML=shopButton()};
  const finish=res=>{shopWorker=null;shopBusy=null;shopPart=null;shop={sig,at:Date.now(),res};metaPut('shop',shop).catch(()=>{});redraw()};
  const fail=msg=>{shopWorker=null;shopBusy=null;shopPart=null;shopMsg='The check failed: '+msg;redraw()};
  const progress=(i,n,label)=>{shopBusy={i,n,label:label||''};const el=$('#shop-prog');if(el){el.querySelector('i').style.width=Math.round(100*(i+1)/n)+'%';el.nextElementSibling.textContent=shopBusyText()}};
  const part=cat=>{shopPart=shopPart||{cats:[],top:[],partial:true};shopPart.cats.push(cat);if(shopOpen)renderShop()};
  shopBusy={i:-1,n:1,label:''};shopPart=null;redraw();
  let w=null;try{w=new Worker('analysis-worker.js')}catch(e){}
  if(w){shopWorker=w;w.onmessage=e=>{const d=e.data;if(w!==shopWorker)return;if(d.progress)progress(...d.progress);else if(d.cat)part(d.cat);else{w.terminate();if(d.error)fail(d.error);else finish(d.done)}};
    w.onerror=()=>{w.terminate();if(w===shopWorker){shopWorker=null;onMain()}};w.postMessage(JSON.parse(JSON.stringify(payload)))}
  else onMain();
  function onMain(){setTimeout(()=>{try{finish(runAnalysis(items,todayDate(),SHOP_WEEKS,progress))}catch(e){fail(String(e&&e.message||e))}},30)}   // where workers aren't available
}
const shopBusyText=()=>!shopBusy?'':shopBusy.i<0?'Planning your next six months with what you own…':`Checking ${shopBusy.label?shopBusy.label.toLowerCase()+': ':''}${Math.min(shopBusy.i+1,shopBusy.n)} of ${shopBusy.n}…`;

/* ---- the sheet ---- */
const SHOP_TIER={fix:'Fixes a problem',better:'Better outfits',gap:'Fills a gap',variety:'Adds variety',optional:'Optional'};
const SHOP_VERDICT={needed:'Needed',worth:'Worth adding',covered:'Covered'};
const FIG_TYPES=['suit','blazer','shirt','tie','tieclip'];
/* a sample outfit of a recommendation: the planner's pick on one of the days it would be worn, drawn from the tags */
function shopOutfit(rec,s){const o={suitDay:s.suitDay,vest:s.vest};for(const sl of SLOTS){const id=s.ids[sl];o[sl]=id?rec.items.find(i=>i.id===id)||items.find(i=>i.id===id)||null:null}return o}
function shopSamples(rec){
  if(!rec.samples||!rec.samples.length)return '';
  return `<div class="shop-figs">${rec.samples.map(s=>{const o=shopOutfit(rec,s),mine=rec.items.map(i=>i.id);
    const withs=[o.top,o.suitDay?null:o.bot,o.shirt,o.tie,o.shoes].filter(i=>i&&!mine.includes(i.id)).map(i=>prettyCols(nm(i)));
    return `<figure class="shop-fig">${FIG_TYPES.includes(rec.type)&&(o.top||o.shirt)?figureSvg(o,'shopf'+(shopFigN++)+'-'):''}<figcaption><small>With your ${esc(withs.join(', '))}${s.score!=null?` · score ${s.score}`:''}</small></figcaption></figure>`}).join('')}</div>`;
}
/* one idea: folded to its picture, name and first reason; a tap unfolds every reason, sample outfits and the two actions */
function shopRec(x){
  const k=esc(x.key),open=!!shopShown[x.key],form=shopForm===x.key;
  return `<div class="shop-rec${open?' open':''}" data-key="${k}"><button type="button" class="shop-rechead" aria-expanded="${open}" onclick="shopToggle('${k}')"><span class="rec-img">${itemThumb(x.items[0],true)}</span>
    <span class="rec-txt"><small class="shop-tag ${x.tier}">${SHOP_TIER[x.tier]||''}</small><b class="cap">${esc(x.name)}</b>${open?'':`<small class="shop-lead">${esc(x.why[0]||'')}</small>`}</span><span class="shop-chev" aria-hidden="true">${open?'−':'+'}</span></button>
    ${open?`<div class="shop-more">${x.detail?`<p><small>${esc(x.detail)}</small></p>`:''}<ul class="shop-why">${x.why.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>${shopSamples(x)}
      ${form?`<div class="shop-buy"><label class="ordate">Arrives (optional) <input type="date" id="shop-arr" min="${isoKey(todayDate())}"></label><div class="btns"><button type="button" class="pri" onclick="shopBought('${k}')">Add as on the way</button><button type="button" onclick="shopForm=null;renderShop()">Cancel</button></div><small class="mut">It joins your outfits the day after it arrives; without a date, when you put it in rotation.</small></div>`
        :`<div class="btns"><button type="button" onclick="shopForm='${k}';renderShop()">Bought it</button><button type="button" onclick="shopHide('${k}')">Not for me</button></div>`}</div>`:''}</div>`;
}
function shopCat(c){
  const o=c.own,mix=o&&o.n?`<p class="shop-mix">${o.groups.map(([l,h,n])=>`<span class="shop-g"><i style="background:${h}"></i>${esc(l)} ${n}</span>`).join('')}</p>
    <p class="mut"><small>${esc(o.classes.map(([l,n])=>`${n} ${l}`).join(' · '))}${o.none.length?` · none ${esc(listAnd(o.none).replace(/ and /,' or '))}`:''}</small></p>`:'';
  return `<section class="shop-cat" id="shop-c-${c.key}"><h3>${esc(c.title)}${c.verdict?`<span class="shop-v ${c.verdict}">${SHOP_VERDICT[c.verdict]}</span>`:''}</h3>${mix}
    ${c.notes.map(n=>`<p class="mut"><small>${esc(n)}</small></p>`).join('')}
    ${c.recs.some(x=>!shopHid(x))?c.recs.filter(x=>!shopHid(x)).map(x=>shopRec(x)).join(''):`<p class="shop-none"><small>No idea here would improve your outfits.</small></p>`}</section>`;
}
function renderShop(){
  const el=$('#shop-sheet');if(!el)return;if(shopDrag){shopStale=true;return}const y=el.scrollTop,r=shopPart||(shop&&shop.res),full=r&&!r.partial?r:null,stale=shop&&!shopBusy&&shop.sig!==shopSig();
  const b=full&&full.base,idle=b?b.idle.length:0;
  let body='';
  if(shopBusy)body+=`<div class="shop-busy"><span class="st-bar" id="shop-prog"><i style="width:${Math.round(100*(shopBusy.i+1)/shopBusy.n)}%"></i></span><small class="mut">${esc(shopBusyText())}</small></div>`;
  if(shopMsg)body+=`<p class="shop-msg"><small>${esc(shopMsg)}</small></p>`;
  if(b)body+=`<p class="mut shop-sum"><small>Your next ${full.months} months, ${b.days} workdays: average outfit score ${b.avg}, ${b.looks} different look${b.looks===1?'':'s'}, ${b.problems?`${b.problems} day${b.problems===1?'':'s'} with a problem`:'no day with a problem'}${b.rest?`, ${b.rest} where a jacket hasn't rested ${COOL} days`:''}${idle?`, ${idle} piece${idle===1?'':'s'} never planned`:''}. ${shop&&shop.at?`Checked ${new Date(shop.at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}${stale?'; your wardrobe changed since':''}.`:''}</small></p>`;
  if(!shopBusy&&r)body+=`<div class="btns shop-re"><button type="button" onclick="analyzeWardrobe()">Check again</button></div>`;
  if(full){const top=full.top.map(t=>shopFindIn(full,t.key)).filter(x=>x&&!shopHid(x));
    body+=`<section class="shop-cat" id="shop-c-top"><h3>Top picks</h3>${top.length?`<p class="mut"><small>The most useful first, across everything. Tap one for its reasons.</small></p><ol class="shop-top">${top.map((x,i)=>`<li><button type="button" class="shop-toprow" onclick="shopGo('${esc(x.key)}')"><span class="shop-n">${i+1}</span><span class="rec-img">${itemThumb(x.items[0],true)}</span><span class="shop-topnm"><b class="cap">${esc(x.name)}</b><small class="shop-tag ${x.tier}">${SHOP_TIER[x.tier]}</small></span><span aria-hidden="true">›</span></button></li>`).join('')}</ol>`
      :'<p class="shop-none"><small>Nothing would make a real difference: your wardrobe covers the plan well. The optional ideas are below.</small></p>'}</section>`}
  if(r)body+=r.cats.map(shopCat).join('');
  if(full){
    body+=`<section class="shop-cat" id="shop-c-occ"><h3>Occasions</h3><p class="mut"><small>One day of each kind, dressed from your wardrobe.</small></p>${full.occasions.map(o=>`<div class="shop-occ"><b>${esc(o.label)}</b><span class="shop-v ${o.ready?'covered':'needed'}">${o.ready?'Ready':'Gaps'} · ${o.score}</span><small class="mut">${esc(o.pieces.join(', '))}</small>${o.gaps.length?`<ul class="shop-why">${o.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul>`:''}</div>`).join('')}</section>`;
    const hid=settings.shopSkip||[];
    if(hid.length)body+=`<section class="shop-cat" id="shop-c-hidden"><h3>Hidden ideas</h3><p class="mut"><small>Marked "Not for me": never suggested again.</small></p>${hid.map(k=>`<div class="shop-hid"><span class="cap">${esc(shopKeyName(k))}</span><button type="button" onclick="shopUnhide('${esc(k)}')">Show again</button></div>`).join('')}</section>`;
    body+=`<p class="mut shop-foot"><small>${full.checked} possible purchases compared with what you own; the best ${full.sims-1} planned day by day.</small></p>`}
  else if(!shopBusy&&!r)body+='<p class="mut"><small>Plans your next six months with what you own, then checks what each possible purchase would change.</small></p>';
  el.innerHTML=`<div class="pick-head shop-top-head"><i class="shop-grab" aria-hidden="true"></i><b id="shop-title">What to buy</b><button class="pick-x" onclick="closeShop()" aria-label="Close">×</button></div><div class="shop-body">${body}</div>`;
  el.scrollTop=y;
}
/* a hidden idea in words, from its key (type|colour group|pattern class) */
function shopKeyName(k){const [t,g,cl]=String(k).split('|');return `${groupLabel(t,g)} ${CLASS_NAMES[cl]&&cl!=='plain'&&cl!=='smooth'?CLASS_NAMES[cl]+' ':''}${(TYPE_WORD[t]||[t])[1]||t}`}
function shopToggle(key){shopShown[key]=!shopShown[key];renderShop()}
/* from the top picks to the idea in its section, opened */
function shopGo(key){shopShown[key]=true;renderShop();const el=[...document.querySelectorAll('#shop-sheet .shop-rec')].find(e=>e.dataset.key===key),sh=$('#shop-sheet');
  if(el&&sh){const top=el.getBoundingClientRect().top-sh.getBoundingClientRect().top+sh.scrollTop-64;sh.scrollTo({top,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1200)}}
/* bought: into the wardrobe as on its way, then check again */
async function shopBought(key){
  const rec=shopFind(key);if(!rec)return;const v=($('#shop-arr')||{}).value||'',arrives=/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null,now=Date.now();
  if(typeof dressNewItem==='function')dressNewItem();
  for(const x of rec.items){const it={...x,...(x.type==='suit'?{vest:'no'}:{}),id:crypto.randomUUID(),added:now,paused:true,order:true,...(arrives?{arrives}:{})};await put(it);items.push(it)}
  cache={};shopForm=null;shopMsg=`Added to your wardrobe as on the way: ${rec.name}${arrives?`, arriving ${fmtDay(arrives)}`:''}.`;
  if(!$('#wardrobe').hidden&&!editing)renderWardrobe();
  analyzeWardrobe();
}
/* not for me: hidden at once, and left out of every later check (the next check puts another idea in its place) */
async function shopHide(key){settings.shopSkip=[...new Set([...(settings.shopSkip||[]),key])];await saveUserSettings();shopMsg='Hidden. You can bring it back under "Hidden ideas" at the bottom.';renderShop();if(!$('#wardrobe').hidden&&!editing)renderWardrobe()}
async function shopUnhide(key){settings.shopSkip=(settings.shopSkip||[]).filter(k=>k!==key);await saveUserSettings();shopMsg='';if(shopFind(key))renderShop();else analyzeWardrobe()}
