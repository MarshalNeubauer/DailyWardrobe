/* Daily Wardrobe: the weather: units, the location and its search, the 16-day forecast and the usual weather by month
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of settings.js on 2026-11-17.) */
import {on,askFor,serve} from './bus.js';
import {$,climate,key,setClimate,setWeather,settings,settingsOpen,weather} from './core.js';
import {refreshToday,renderSettingsExtras,saveUserSettings,settingsSummaries,todayDirty} from './settings.js';
import {announce} from './app.js';
import {esc} from './photo-keys.js';
import {planDirty} from './today-plan.js';
import {acts} from './act.js';
import {tell} from './ui.js';
/* ---- settings: schedule, weather location, units ---- */
/* °F where the country uses it (audit 2026-11-15: a Kuwait user on an English (US) iPhone got °F): the chosen location's country, else the
   time zone's (setup.js tzCountry, which falls back on the phone's region), else the phone's language as before */
const F_CC=['US','LR','MM','PR','GU','VI','AS','MP','BS','KY','PW','FM','MH'];
const locCC=l=>l&&(l.cc||(/,\s*([A-Z]{2})$/.exec(l.name||'')||[])[1])||'';
const unitCC=()=>locCC(settings.location)||askFor('tz-country')||'';
const unit=()=>{if(settings.units)return settings.units;const cc=unitCC();return cc?(F_CC.includes(cc)?'F':'C'):/^en-(US|LR|MM)/.test(navigator.language||'')?'F':'C'};
const temp=c=>Math.round(unit()==='F'?c*9/5+32:c);
const wxIcon=c=>c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌦️':c<=86?'🌨️':'⛈️';
function wxChip(d){const w=weather[key(d)];if(!w)return '';return `${wxIcon(w.code)} ${temp(w.tmax)}°/${temp(w.tmin)}°${(w.pop||0)>=30?` · ☂ ${w.pop}%`:''}`}
/* the weather location's line, its temperatures in the units chosen (setUnits redraws it: it kept °F under a °C setting) */
function renderWxLoc(){
  if($('#wx-loc'))$('#wx-loc').textContent=settings.location?`Weather for ${settings.location.name}.`+(climate?` Beyond the 16-day forecast, days are planned from the usual weather there: highs of about ${temp(Math.min(...climate.map(m=>m.tmax)))}° in the coolest month and ${temp(Math.max(...climate.map(m=>m.tmax)))}° in the hottest.`:' Beyond the 16-day forecast, days follow the calendar season.'):'No location set: outfits follow the calendar season.'}
function setUnits(v){settings.units=v;saveUserSettings();todayDirty();renderWxLoc();settingsSummaries()}
function setLocation(loc){const fromList=!!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#city-results'));if(loc&&loc.alt!==undefined){loc={...loc};delete loc.alt}settings.location=loc;localStorage.removeItem('wx');localStorage.removeItem('wx_norm');setWeather({});setClimate(null);saveUserSettings().then(()=>loadWeather(true));renderSettingsExtras();if($('#city-results'))$('#city-results').innerHTML='';if(loc)announce('Location set to '+loc.name);if(fromList&&$('#cfg-city'))try{$('#cfg-city').focus({preventScroll:true})}catch{}}   // (the result pressed is gone: the field keeps the keyboard)
function useMyLocation(){if(!navigator.geolocation){tell('Location is not available on this device.');return}
  navigator.geolocation.getCurrentPosition(p=>setLocation({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3),name:geoName(p.coords.latitude,p.coords.longitude)}),()=>tell('Location permission was denied. Search for your city instead.'))}
/* "Use my location" has no place name (Open-Meteo can't look one up): the spot itself, so it doesn't read "your current location" after a trip */
const geoName=(la,lo)=>`your location (${Math.abs(la).toFixed(2)}° ${la<0?'S':'N'}, ${Math.abs(lo).toFixed(2)}° ${lo<0?'W':'E'})`;
/* the language the city search asks in: a name typed in Arabic (or another script) is looked up in that language, English otherwise */
function cityLang(q){const s=[[/[؀-ۿ]/,'ar'],[/[֐-׿]/,'he'],[/[Ѐ-ӿ]/,'ru'],[/[Ͱ-Ͽ]/,'el'],[/[฀-๿]/,'th'],[/[가-힯]/,'ko'],[/[぀-ヿ]/,'ja'],[/[一-鿿]/,/^ja/i.test(navigator.language||'')?'ja':'zh']].find(([r])=>r.test(q));return s?s[1]:'en'}
/* results that read the same ("Dubai, Uttar Pradesh, IN" three times) get their district, and true repeats are dropped */
function cityList(results){const res=(results||[]).map(c=>({lat:c.latitude,lon:c.longitude,cc:c.country_code||'',name:[c.name,c.admin1,c.country_code].filter(Boolean).join(', '),a2:c.admin2||c.admin3||'',...(c.alt?{alt:c.alt}:{})}));
  const cnt={};for(const c of res)cnt[c.name]=(cnt[c.name]||0)+1;for(const c of res)if(cnt[c.name]>1&&c.a2)c.name=[c.name.split(', ')[0],c.a2,...c.name.split(', ').slice(1)].join(', ');
  const seen=new Set();return res.filter(c=>{const k=c.name;if(seen.has(k))return false;seen.add(k);return true}).map(c=>{delete c.a2;return c})}
/* (fix round 2) a name found in another language is stored in English, the app's language (an Arabic search stored "دبي, دبي, AE" and the
   English summary showed it): each result is asked again by its id in English, the name typed shown beside it; a failed lookup keeps it */
async function cityEnglish(list,lang){if(lang==='en')return list;
  return Promise.all(list.map(async c=>{if(!c||c.id==null)return c;
    try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/get?language=en&id='+encodeURIComponent(c.id));if(r.ok){const e=await r.json();if(e&&e.name)return {...e,alt:e.name!==c.name?c.name:''}}}catch{}
    return c}))}
async function findCity(){const q=($('#cfg-city')&&$('#cfg-city').value||'').trim();
  // an empty search clears the last one's results (they stayed, fix round 2)
  if(!q){window._cities=[];if($('#city-results'))$('#city-results').innerHTML='';return}
  try{const lang=cityLang(q),r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language='+lang+'&name='+encodeURIComponent(q));const j=await r.json();
    const res=cityList(await cityEnglish((j.results||[]).slice(0,8),lang)).slice(0,5);
    window._cities=res;$('#city-results').innerHTML=res.length?res.map((c,i)=>`<button type="button" data-act="cityPick" data-i="${i}">${esc(c.name)}${c.alt?` <span dir="auto">(${esc(c.alt)})</span>`:''}</button>`).join(''):'<small class="mut" id="city-none">No matches. Try the name in English or a nearby larger city, or Use my location.</small>';
    announce(res.length?`${res.length} place${res.length===1?'':'s'} found`:'No matches.')}   // (said: W2-19-01)
  catch(e){$('#city-results').innerHTML='<small class="mut">City search is unavailable right now.</small>';announce('City search is unavailable right now.')}}
/* 16-day forecast from Open-Meteo (free, no key); cached for 3 hours */
/* header ↻: sync with the worker (if set up), reload everything from storage, refresh the forecast and redraw */
/* the location's usual weather by month, from Open-Meteo's archive (free, no key): the last two full years' daily highs,
   lows and rain, averaged per month. Kept for four months per location; days beyond the 16-day forecast are planned from it. */
async function loadClimate(){
  const L=settings.location;if(!L){setClimate(null);return}
  try{const c=JSON.parse(localStorage.getItem('wx_norm')||'null');
    if(c&&c.lat===L.lat&&c.lon===L.lon&&Array.isArray(c.months)){const fresh=Date.now()-c.t<120*864e5;if(JSON.stringify(climate)!==JSON.stringify(c.months)){setClimate(c.months);planDirty();if(!$('#today').hidden)refreshToday()}if(fresh)return}}catch{}
  try{const y=new Date().getFullYear(),r=await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${L.lat}&longitude=${L.lon}&start_date=${y-2}-01-01&end_date=${y-1}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
    const d=r.ok&&(await r.json()).daily;if(!d||!d.time||!d.temperature_2m_max)return;
    const m=[...Array(12)].map(()=>({n:0,tx:0,tn:0,r:0}));
    d.time.forEach((t,i)=>{const k=+t.slice(5,7)-1,tx=d.temperature_2m_max[i];if(!(k>=0&&k<12)||typeof tx!=='number')return;m[k].n++;m[k].tx+=tx;m[k].tn+=d.temperature_2m_min?.[i]??tx;if((d.precipitation_sum?.[i]||0)>=1)m[k].r++});
    if(m.some(x=>x.n<20))return;   // a month with hardly any readings: keep what we had
    const months=m.map(x=>({tmax:+(x.tx/x.n).toFixed(1),tmin:+(x.tn/x.n).toFixed(1),rainDays:+(x.r/x.n*30).toFixed(1)}));
    const N=settings.location;if(!N||N.lat!==L.lat||N.lon!==L.lon)return;   // the location changed meanwhile
    setClimate(months);localStorage.setItem('wx_norm',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),months}));planDirty();if(!$('#today').hidden)refreshToday();if(settingsOpen())renderSettingsExtras()}
  catch(e){console.warn('climate history unavailable',e)}
}
async function loadWeather(force){
  const L=settings.location;if(!L)return;loadClimate();
  try{const c=JSON.parse(localStorage.getItem('wx')||'null');
    if(!force&&c&&c.lat===L.lat&&c.lon===L.lon&&Date.now()-c.t<3*3600e3){if(JSON.stringify(weather)===JSON.stringify(c.days))return;   // already read (wxPreload): the plan stands
      setWeather(c.days);planDirty();if(!$('#today').hidden)refreshToday();return}}catch{}
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&timezone=auto&forecast_days=16`);
    const d=(await r.json()).daily;if(!d||!d.time)return;const days={};
    d.time.forEach((t,i)=>{const [y,m,dd]=t.split('-').map(Number);days[key(new Date(y,m-1,dd))]={tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],pop:d.precipitation_probability_max[i]??0,rain:d.precipitation_sum[i]??0,code:d.weather_code[i]??0}});
    setWeather(days);localStorage.setItem('wx',JSON.stringify({lat:L.lat,lon:L.lon,t:Date.now(),days}));planDirty();if(!$('#today').hidden)refreshToday()}
  catch(e){console.warn('weather unavailable',e)}
}
/* the bridge (tests/bridge.test.js lists it), above acts({…}), the file's one top-level call: settings.js and setup.js (unit, renderWxLoc,
   setUnits, setLocation, useMyLocation, findCity), today.js (wxChip, loadWeather), start.js and safety.js (loadWeather) use these as
   globals (setup.js is a module too, as is scorecard.js: temp); geoName is read by tests/setup.test.js only */
Object.assign(globalThis,{unit,temp,wxChip,renderWxLoc,setUnits,setLocation,useMyLocation,findCity,loadWeather});
/* the notice board (bus.js): what this file does when Settings announces it (settings.js no longer names this file) */
on('settings-draw',()=>{renderWxLoc();if($('#cfg-units'))$('#cfg-units').value=unit()});
on('settings-summaries',S=>{S.unit=unit});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,geoName,findCity,setLocation,setUnits,unit};
export {unit,temp,wxChip,renderWxLoc,setUnits,setLocation,useMyLocation,geoName,findCity,loadWeather};
/* the markup's handler (act.js): a place in the city search's results (data-i: its place in the list kept as _cities) */
function cityPick(el){setLocation(window._cities[+el.dataset.i])}
/* index.html's (act.js): Enter in the city field, Search, "Use my location" and the Units choice */
function cityKey(el,ev){if(ev.key==='Enter'){ev.preventDefault();findCity()}}
function citySearchTap(){findCity()}
function myLocTap(){useMyLocation()}
function unitsPick(el){setUnits(el.value)}
acts({cityPick,cityKey,citySearchTap,myLocTap,unitsPick});
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('weather-load',loadWeather);
