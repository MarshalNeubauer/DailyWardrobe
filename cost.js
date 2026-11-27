/* Daily Wardrobe: cost per wear (2026-11-17, the owner's ask; loaded after care.js).
   An item may have a price (item.price, a number in the person's currency) and the day it was bought (item.bought, YYYY-MM-DD), set on the
   Add card's More and in the item sheet's Planning & care; synced like any item field (field by field: app.js put / merge.js mergeItem).
   What a cleaning costs is in Settings → Care (settings.cleanCost: a dry cleaning by type, {suit: 15, …}, and the home laundry as a load's
   cost and the pieces in a load, {load, perLoad}); the currency is settings.currency, else from the holiday country or the phone's language.
   Cost per wear = (price + cleaning so far) ÷ the days it was worn (wornDays, as Insights counts them). Cleanings so far: a piece washed
   after every wear (a limit of 1: shirts; socks) one per wear; else the cleanings recorded (item.cleans: the days it came back from the
   cleaner or the laundry, or was marked cleaned; item.cleaned from before the log), plus, for wears before the first recorded one that
   were more than one cleaning's worth, the ones that must have come before; with none recorded, about wears ÷ wears per cleaning (care.js
   careLimit). Nothing is shown for an item without a price. */
import {$,CARE_ABLE,TYPES,careLimit,careWashed,isoKey,items,settings,titleCls,todayDate} from './core.js';
import {cache} from './today-plan.js';
import {statName1,statPic,wornDays} from './stats.js';
import {esc} from './photo-keys.js';
import {toast} from './toast.js';
import {cardAt,cardIx,cardOf,editing,put} from './app.js';
import {show} from './nav.js';
import {openSettings,saveUserSettings} from './settings.js';
import {acts} from './act.js';
const CPW_MIN=3;   // priced items before Insights shows its card
const CPW_EVERY={socks:1};   // wears per cleaning where the care limits have none: socks are washed after every wear
const CPW_DRY_SHOW=['suit','blazer','pants','overcoat'];   // dry-cleaning costs offered always; the others when the wardrobe has one
const CPW_CURS=['USD','EUR','GBP','KWD','SAR','AED','QAR','BHD','OMR','EGP','CAD','AUD','NZD','CHF','SEK','NOK','DKK','PLN','CZK','JPY','CNY','HKD','SGD','INR','KRW','ZAR','BRL','MXN','TRY','ILS'];
const CPW_EURO='AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
const CPW_REGION={US:'USD',GB:'GBP',KW:'KWD',SA:'SAR',AE:'AED',QA:'QAR',BH:'BHD',OM:'OMR',IQ:'IQD',EG:'EGP',JO:'JOD',CA:'CAD',AU:'AUD',NZ:'NZD',CH:'CHF',SE:'SEK',NO:'NOK',DK:'DKK',PL:'PLN',CZ:'CZK',
  JP:'JPY',CN:'CNY',HK:'HKD',SG:'SGD',IN:'INR',KR:'KRW',ZA:'ZAR',BR:'BRL',MX:'MXN',TR:'TRY',IL:'ILS'};
/* the currency: the one chosen in Settings, else the holiday country's (set from the time zone at setup), else the phone's language region's */
function cpwRegion(){const c=settings.holidays&&settings.holidays.country;if(/^[A-Z]{2}$/.test(c||''))return c;
  try{return new Intl.Locale(navigator.language||'en-US').maximize().region||'US'}catch{return 'US'}}
const cpwCurOk=c=>{if(!/^[A-Z]{3}$/.test(c||''))return false;try{new Intl.NumberFormat('en-US',{style:'currency',currency:c});return true}catch{return false}};
function cpwCur(){const s=settings.currency;if(cpwCurOk(s))return s;const r=cpwRegion();return CPW_REGION[r]||(CPW_EURO.includes(r)?'EUR':'USD')}
const cpwFmts={};
function cpwFmt(whole){const c=cpwCur(),k=c+(whole?'|w':'');if(cpwFmts[k])return cpwFmts[k];
  const o=/** @type {Intl.NumberFormatOptions} */({style:'currency',currency:c,currencyDisplay:'narrowSymbol'});if(whole){o.minimumFractionDigits=0;o.maximumFractionDigits=0}
  try{return cpwFmts[k]=new Intl.NumberFormat(APP_LOC,o)}catch{return cpwFmts[k]=new Intl.NumberFormat('en-US',{...o,currency:'USD'})}}
/* an amount: "$12.40"; whole: a total of 10 or more without cents ("$186") */
const cpwMoney=(v,whole)=>cpwFmt(!!whole&&Math.abs(v)>=10).format(v);
function cpwSym(){try{const p=cpwFmt(false).formatToParts(0).find(x=>x.type==='currency');return p?p.value:cpwCur()}catch{return cpwCur()}}
/* a typed amount -> a number (null: not one). "1,234.50", "1.234,50", "89,90", "$120" */
function cpwParse(s){s=String(s??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.,]/g,'');if(!/\d/.test(s))return null;
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');
  if(lc>=0&&ld>=0)s=lc>ld?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(lc>=0)s=/^\d*,\d{1,2}$/.test(s)?s.replace(',','.'):s.replace(/,/g,'');
  else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
  const v=parseFloat(s);return isFinite(v)&&v>=0&&v<1e8?Math.round(v*1000)/1000:null}
const cpwPriced=i=>!!i&&typeof i.price==='number'&&isFinite(i.price)&&i.price>=0;
/* the days each piece was worn: {id: [YYYY-MM-DD…]}, oldest first; kept on the plan cache like careCounts */
function cpwWears(){if(cache.cpwW)return cache.cpwW;const w={};
  for(const r of wornDays()){const k=isoKey(r.d);for(const id of new Set(Object.values(r.ids)))if(id)(w[id]||(w[id]=[])).push(k)}
  return cache.cpwW=w}
/* wears per cleaning: the type's care limit (Settings → Care), else CPW_EVERY; 0 = not cleaned after a set number of wears */
const cpwEvery=t=>careLimit(t)||CPW_EVERY[t]||0;
const cpwWashed=t=>careWashed(t);
const cpwCleanable=t=>CARE_ABLE.includes(t);
/* what one cleaning costs: a home wash (a load's cost over the pieces in it) for washed types, else the type's dry cleaning; null: not set */
function cpwCleanCost(t){const c=settings.cleanCost||{};
  if(cpwWashed(t)){const l=+c.load;return l>0?l/Math.max(1,Math.round(+c.perLoad)||12):null}
  const v=+c[t];return v>0?v:null}
/* the recorded cleanings: item.cleans and item.cleaned (from before the log), up to today, oldest first */
const cpwRecorded=i=>{const T=isoKey(todayDate());return [...new Set([...(Array.isArray(i.cleans)?i.cleans:[]),i.cleaned].filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=T))].sort()};
/* cleanings so far -> {n, how: 'each' | 'rec' | 'mix' | 'est' | 'none', rec, extra, every}; year: the count from that day on */
function cpwCleanings(i,W,from){const t=i.type,e=cpwEvery(t);W=W||[];const w=from?W.filter(k=>k>=from):W;
  if(!cpwCleanable(t))return {n:0,how:'none',every:0};
  if(e===1)return {n:w.length,how:'each',every:1};
  const R=cpwRecorded(i);
  if(R.length){const before=W.filter(k=>k<R[0]).length,extra=e?Math.max(0,Math.ceil(before/e)-1):0;
    if(!from)return {n:R.length+extra,how:extra?'mix':'rec',rec:R.length,extra,every:e};
    const pre=e?Math.max(0,Math.ceil(W.filter(k=>k<R[0]&&k<from).length/e)-1):0;   // (the extra ones before the year)
    return {n:R.filter(d=>d>=from).length+Math.max(0,extra-pre),how:'rec',every:e}}
  if(!e)return {n:0,how:'none',every:0};
  return {n:from?Math.floor(W.length/e)-Math.floor(W.filter(k=>k<from).length/e):Math.floor(W.length/e),how:'est',every:e}}
/* an item's cost per wear: null without a price */
function cpwOf(i){if(!cpwPriced(i))return null;const W=cpwWears()[i.id]||[],c=cpwCleanings(i,W),each=cpwCleanCost(i.type);
  const clean=each?c.n*each:0,total=i.price+clean,wears=W.length;
  return {i,price:i.price,wears,cl:c,each,clean,total,per:wears?total/wears:null}}
/* the cleaning spent since Jan 1 (Insights) */
function cpwCleanYear(i){const each=cpwCleanCost(i.type);if(!each)return 0;const T=todayDate();
  return cpwCleanings(i,cpwWears()[i.id]||[],`${T.getFullYear()}-01-01`).n*each}
const cpwTimes=n=>n===1?'1 wear':n+' wears';
const cpwClean=(c,n)=>c.how==='each'?(n===1?'1 wash':n+' washes'):(n===1?'1 cleaning':n+' cleanings');
/* "$12.40 a wear · 21 wears · $186 + $74 cleaning" (not worn yet: "Not worn yet · $186") */
function cpwText(c){const cl=c.clean>0?` + ${cpwMoney(c.clean,true)} ${cpwWashed(c.i.type)?'washing':'cleaning'}`:'';
  return c.wears?`${cpwMoney(c.per)} a wear · ${cpwTimes(c.wears)} · ${cpwMoney(c.price,true)}${cl}`:`Not worn yet · ${cpwMoney(c.price,true)}${cl}`}
/* a gentle hint for an expensive piece worn rarely: "Wear it 6 more times to get under $20 a wear" (the round amount just below) */
function cpwHint(c){if(!c||c.wears>=10||!(c.total>0))return '';const per=c.per??c.total;
  let t=0;for(let k=-2;k<9;k++)for(const m of [1,2,5]){const v=m*10**k;if(v<per&&v>t)t=v}
  if(!t)return '';const more=Math.floor(c.total/t)-c.wears+1;if(more<1||more>15)return '';
  return `${c.wears?`Wear it ${more} more time${more===1?'':'s'}`:`Wear it ${more} time${more===1?'':'s'}`} to get under ${cpwMoney(t,true)} a wear.`}
/* how it's worked out, in a few lines */
function cpwHow(c){const i=c.i,t=i.type,cl=c.cl,L=[],each=c.each,w=cpwWashed(t);
  if(i.bought)L.push(`Bought ${(([y,m,d])=>new Date(y,m-1,d))(i.bought.split('-').map(Number)).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} for ${cpwMoney(c.price)}.`);else L.push(`Price ${cpwMoney(c.price)}.`);
  L.push(`Wears: the days you wore it, as Insights counts them (${c.wears}).`);
  const cost=each?` at ${cpwMoney(each)} each`:'';
  if(cl.how==='each')L.push(`${w?'Washed':'Cleaned'} after every wear: ${cpwClean(cl,cl.n)}${cost}.`);
  else if(cl.how==='rec')L.push(`${cpwClean(cl,cl.n)} recorded (back from the ${w?'laundry':'cleaner'} or marked ${w?'washed':'cleaned'})${cost}.`);
  else if(cl.how==='mix')L.push(`${cpwClean(cl,cl.rec)} recorded, and about ${cl.extra} more before ${cl.rec===1?'it':'them'} (${cpwTimes(cl.every)} each)${cost}.`);
  else if(cl.how==='est')L.push(cl.n?`About ${cpwClean(cl,cl.n)}: none recorded, so ${cpwTimes(c.wears)} ÷ ${cl.every} wears per ${w?'wash':'cleaning'} (Settings → Care)${cost}.`:`No ${w?'wash':'cleaning'} counted yet: one every ${cl.every} wears (Settings → Care).`);
  else if(cpwCleanable(t))L.push(`No cleanings counted: none recorded, and it has no wear limit in Settings → Care.`);
  if(cl.n&&!each)L.push(`What a ${w?'wash':'cleaning'} costs isn’t set, so it isn’t counted. <button type="button" class="linkbtn" data-act="cpwCareTap">Set it in Settings → Care</button>`);
  L.push(c.wears?`(${cpwMoney(c.price)}${c.clean>0?' + '+cpwMoney(c.clean):''}) ÷ ${cpwTimes(c.wears)} = ${cpwMoney(c.per)} a wear.`:'Not worn yet: the cost per wear starts with its first wear.');
  return `<details class="cpwhow"><summary>How it’s worked out</summary><ul>${L.map(x=>`<li>${x}</li>`).join('')}</ul></details>`}
/* Planning & care's summary: " · $12.40 a wear" */
const cpwSum=i=>{const c=cpwOf(i);return c&&c.wears?` · ${cpwMoney(c.per)} a wear`:''};
const cpwOut=c=>c?`<p class="cpwline" id="cpw-line">${esc(cpwText(c))}</p>${cpwHint(c)?`<p class="shelp cpwhint">${esc(cpwHint(c))}</p>`:''}${cpwHow(c)}`:'';
/* the item sheet's block (in Planning & care): Price, Bought, and the cost per wear once priced */
function cpwBlock(i){const T=isoKey(todayDate());
  return `<div class="cpw" id="ivcpw"><div class="cpwf"><label class="cpwprice">Price <span class="cpwin"><span class="cpwsym" aria-hidden="true">${esc(cpwSym())}</span><input type="text" inputmode="decimal" id="iv-price" autocomplete="off" maxlength="14" aria-label="Price (${esc(cpwCur())})" value="${cpwPriced(i)?esc(String(i.price)):''}" placeholder="Optional" data-act-input="cpwPriceType" data-act-change="cpwPriceDone" data-id="${esc(i.id)}"></span></label>`+
    `<label class="cpwbought">Bought <input type="date" id="iv-bought" value="${esc(i.bought||'')}" max="${T}" data-act-change="cpwBoughtPick" data-id="${esc(i.id)}"></label></div><div class="cpwout" aria-live="polite">${cpwOut(cpwOf(i))}</div></div>`}
let cpwT=null,cpwPend=null;
function cpwPriceSoon(id,v){clearTimeout(cpwT);cpwPend={id,v};cpwT=setTimeout(()=>cpwFlush(),700)}
function cpwFlush(){clearTimeout(cpwT);cpwT=null;const p=cpwPend;cpwPend=null;if(p)return cpwSetPrice(p.id,p.v,false)}
document.addEventListener('visibilitychange',()=>{if(document.hidden)cpwFlush()});addEventListener('pagehide',()=>cpwFlush());
/* the item's price: an empty field takes it off; redraw: its line in the sheet follows (the field keeps its focus) */
async function cpwSetPrice(id,v,redraw){if(redraw){clearTimeout(cpwT);cpwPend=null}const it=items.find(x=>x.id===id);if(!it){itemGoneTell(id);return}
  const s=String(v??'').trim(),n=s?cpwParse(s):null;
  if(s&&n==null){if(redraw)toast('Type the price as a number, like 120 or 89.50.',4500);return}
  if((cpwPriced(it)?it.price:null)!==n){if(n==null)delete it.price;else it.price=n;if(it.sample)it.sampleMine=1;await put(it)}
  if(redraw)cpwRedraw(id)}
async function cpwSetBought(id,v){const it=items.find(x=>x.id===id);if(!it){itemGoneTell(id);return}
  const d=/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&v<=isoKey(todayDate())?v:'';
  if(v&&!d){toast('Pick the day you bought it: today or a day before.',4500);cpwRedraw(id,true);return}
  if((it.bought||'')===d)return;if(d)it.bought=d;else delete it.bought;await put(it);cpwRedraw(id)}
function cpwRedraw(id,field){if(editing!==id)return;const o=$('#ivcpw .cpwout'),it=items.find(x=>x.id===id);if(o&&it)o.innerHTML=cpwOut(cpwOf(it));
  if(field){const b=$('#iv-bought');if(b)b.value=it&&it.bought||''}}
/* the Add card's More: Price and Bought (kept on the card as typed; saved with the item, cpwSaveFields) */
function cpwQRow(q){const T=isoKey(todayDate());
  return `<div class="cpwf cpwq"><label class="cpwprice">Price <span class="cpwin"><span class="cpwsym" aria-hidden="true">${esc(cpwSym())}</span><input type="text" inputmode="decimal" class="wf-price" autocomplete="off" maxlength="14" aria-label="Price (${esc(cpwCur())})" value="${esc(q.price||'')}" placeholder="Optional" data-act-input="cpwCardField" ${cardAt(q)} data-f="price"></span></label>`+
    `<label class="cpwbought">Bought <input type="date" class="wf-bought" value="${esc(q.bought||'')}" max="${T}" data-act-change="cpwCardField" ${cardAt(q)} data-f="bought"></label></div>`}
function cpwQSet(i,k,v){const q=cardOf(i);if(!q||(k!=='price'&&k!=='bought'))return;v=String(v??'').slice(0,20);if(v.trim())q[k]=v;else delete q[k];askFor('add-keep-soon')}
function cpwSaveFields(q,it){const n=q.price!=null&&String(q.price).trim()?cpwParse(q.price):null;if(n!=null)it.price=n;
  if(/^\d{4}-\d{2}-\d{2}$/.test(q.bought||'')&&q.bought<=isoKey(todayDate()))it.bought=q.bought}
/* ---- Insights: the Cost per wear card, once at least CPW_MIN pieces have a price ---- */
function cpwOpenItem(id){if(!items.some(i=>i.id===id))return;show('wardrobe');askFor('item-show',id)}   // (the Wardrobe's type filter is left as it is: app.js owns it)
function cpwStats(){const all=items.map(cpwOf).filter(Boolean);if(all.length<CPW_MIN)return null;
  const worn=all.filter(c=>c.wears).sort((a,b)=>a.per-b.per||(a.i.id<b.i.id?-1:1));
  const spent=all.reduce((a,c)=>a+c.price,0),year=items.filter(cpwPriced).reduce((a,i)=>a+cpwCleanYear(i),0);
  const n=Math.min(3,Math.ceil(worn.length/2));
  return {all,worn,spent,year,best:worn.slice(0,n),dear:worn.length>1?worn.slice(-Math.min(3,worn.length-n)).reverse():[],idle:all.filter(c=>!c.wears)}}
function cpwStatsCard(){const S=cpwStats();if(!S)return '';
  const tile=(v,l)=>`<div class="st-tile"><b>${v}</b><small>${l}</small></div>`;
  const row=c=>`<button type="button" class="st-row cpw-row" data-act="cpwRowTap" data-id="${esc(c.i.id)}">${statPic(c.i)}<span class="st-main"><span class="${titleCls(c.i)} st-nm">${esc(statName1(c.i))}</span><small class="mut">${esc(c.wears?`${cpwMoney(c.per)} a wear · ${cpwTimes(c.wears)}`:`Not worn yet · ${cpwMoney(c.price,true)}`)}</small></span><span class="cpw-go" aria-hidden="true">›</span></button>`;
  const T=todayDate();
  return `<section class="card st-card" id="st-cpw"><h3>Cost per wear</h3><p class="mut"><small>What each piece has cost per day worn: its price and its cleaning so far, over the days you wore it. ${S.all.length} of ${items.length} items have a price.</small></p>
  <div class="st-tiles cpw-tiles">${tile(esc(cpwMoney(S.spent,true)),'spent on these items')}${tile(esc(cpwMoney(S.year,true)),`on cleaning in ${T.getFullYear()}`)}</div>
  ${S.best.length?`<p class="cpw-h">Best value</p>${S.best.map(row).join('')}`:''}
  ${S.dear.length?`<p class="cpw-h">Most per wear</p>${S.dear.map(row).join('')}`:''}
  ${S.idle.length?`<p class="cpw-h">Not worn yet</p>${S.idle.sort((a,b)=>b.price-a.price).slice(0,3).map(row).join('')}`:''}</section>`}
/* ---- Settings → Care: the currency and what a cleaning costs ---- */
function cpwSettingsUI(){const el=$('#cpw-set');if(!el)return;const c=settings.cleanCost||{},cur=cpwCur(),sym=esc(cpwSym());
  let dn=null;try{dn=new Intl.DisplayNames([APP_LOC],{type:'currency'})}catch{}
  const curs=[...new Set([...CPW_CURS,cur])];
  const money=(k,lab,v)=>`<label class="srow cpwset">${lab}<span class="cpwin"><span class="cpwsym" aria-hidden="true">${sym}</span><input type="text" inputmode="decimal" id="cpw-${k}" autocomplete="off" maxlength="12" aria-label="${esc(lab)} (${esc(cur)})" value="${v>0?esc(String(v)):''}" placeholder="Not set" data-act-change="cpwCostDone" data-f="${esc(k)}"></span></label>`;
  const dry=CARE_ABLE.filter(t=>!cpwWashed(t)&&(CPW_DRY_SHOW.includes(t)||items.some(i=>i.type===t)));
  el.innerHTML=`<div class="slabel">Cost per wear</div><p class="shelp">Add a price to an item (its Planning &amp; care) and it shows what each wear has cost, with its cleaning. Leave a cost empty if you don’t know it.</p>
    <label class="srow">Currency <select id="cpw-cur" data-act-change="cpwCurPick">${curs.map(k=>`<option value="${k}"${k===cur?' selected':''}>${k}${dn?' · '+esc(dn.of(k)||''):''}</option>`).join('')}</select></label>
    <p class="cpw-h">A dry cleaning costs</p>${dry.map(t=>money(t,TYPES[t]||t,+c[t])).join('')}
    <p class="cpw-h">Washing at home</p>${money('load','A laundry load costs',+c.load)}
    <label class="srow cpwset">Pieces in a load<input type="number" inputmode="numeric" id="cpw-perLoad" min="1" max="60" step="1" value="${Math.max(1,Math.round(+c.perLoad)||12)}" data-act-change="cpwCostDone" data-f="perLoad"></label>
    <p class="shelp cpwwash" id="cpw-wash">${esc(cpwWashLine())}</p>`}
const cpwWashLine=()=>{const c=settings.cleanCost||{},l=+c.load;return l>0?`About ${cpwMoney(l/Math.max(1,Math.round(+c.perLoad)||12))} a piece: shirts, T-shirts, socks and the like are washed after the wears set above.`:'Shirts, T-shirts, socks and the like count a wash after the wears set above.'};
async function cpwSetCost(k,v){const s=String(v??'').trim(),n=s?cpwParse(s):null;
  if(s&&n==null){toast('Type the cost as a number, like 12 or 4.50.',4500);return}
  const c={...(settings.cleanCost||{})};if(n==null||n===0&&k!=='perLoad')delete c[k];else c[k]=k==='perLoad'?Math.max(1,Math.min(60,Math.round(n))):n;
  settings.cleanCost=c;await saveUserSettings();const w=$('#cpw-wash');if(w)w.textContent=cpwWashLine()}
async function cpwSetCurrency(v){if(!cpwCurOk(v))return;settings.currency=v;await saveUserSettings();cpwSettingsUI()}
/* what the controls do (act.js): the item sheet's Price (as it is typed, and when the field is left) and Bought (the item by its id in data-id), the Add
   card's two (data-card, add-save.js cardAt; data-f price | bought), "Set it in Settings → Care", an Insights row (data-id), Settings → Care's costs
   (data-f: a type, load or perLoad) and currency */
function cpwPriceType(el){cpwPriceSoon(el.dataset.id,el.value)}
function cpwPriceDone(el){cpwSetPrice(el.dataset.id,el.value,true)}
function cpwBoughtPick(el){cpwSetBought(el.dataset.id,el.value)}
function cpwCardField(el){cpwQSet(cardIx(el),el.dataset.f,el.value)}
function cpwCareTap(){openSettings('care')}
function cpwRowTap(el){cpwOpenItem(el.dataset.id)}
function cpwCostDone(el){cpwSetCost(el.dataset.f,el.value)}
function cpwCurPick(el){cpwSetCurrency(el.value)}
/* An ES module (2026-11-23): its names are its own. The bridge (tests/bridge.test.js lists it): the item sheet, the Add card, Insights and Laundry & cleaning, classic scripts, call these; the rest are read by
   tests/costwear.test.js. */
Object.assign(globalThis,{cpwSum,cpwBlock,cpwQRow,cpwSaveFields,cpwStatsCard,cpwSettingsUI});
/* the socket Insights asks for its cost-per-wear card (bus.js; stats.js no longer names this file) */
import {serve,askFor} from './bus.js';
import {itemGoneTell} from './ui.js';
import {APP_LOC} from './locale.js';
serve('cpw-stats-card',cpwStatsCard);
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,cpwCleanYear,cpwCur,cpwHint,cpwMoney,cpwOf,cpwParse,cpwQSet,cpwSetPrice,cpwText};
export {cpwCur,cpwMoney,cpwParse,cpwOf,cpwCleanYear,cpwText,cpwHint,cpwSum,cpwBlock,cpwSetPrice,cpwQRow,cpwQSet,cpwSaveFields,cpwStatsCard,cpwSettingsUI};
acts({cpwPriceType,cpwPriceDone,cpwBoughtPick,cpwCardField,cpwCareTap,cpwRowTap,cpwCostDone,cpwCurPick});
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('cpw-save-fields',cpwSaveFields);serve('cpw-q-row',cpwQRow);serve('cpw-settings-ui',cpwSettingsUI);serve('cpw-block',cpwBlock);serve('cpw-sum',cpwSum);
