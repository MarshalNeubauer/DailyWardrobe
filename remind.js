/* Daily Wardrobe: the morning reminder (loaded after account.js). Settings → Schedule → "Morning reminder": a notification at the
   time you choose, on workdays, with the day's outfit. The server only knows when (the time, the time zone, the coming dates) and
   sends a push with no text at that time (worker/remind.js sendReminders); the service worker shows the line this app kept for the
   date (sw.js, Cache Storage dw-keep-remind, remind.json: {"YYYY-MM-DD": "Navy suit, white shirt, burgundy tie"}).
   Cleaning reminders (2026-11-14, the owner's ask: "a phone reminder when a suit is due") ride on the same push: care.json
   {"YYYY-MM-DD": "The navy suit is due for the cleaner."} (care.js careReminders), the dates sent being those of either kind. Their
   switch follows the morning reminder's until it is set by itself (remindPrefs().care: undefined = as the morning reminder).
   Needs the connection, a phone that can receive Web Push (on an iPhone: the app on the Home Screen, iOS 16.4 or later) and the
   VAPID keys on the server. The choice is this phone's own (localStorage.remind {on, care, time}); each phone subscribes for itself. */
const REMIND_CACHE='dw-keep-remind',REMIND_URL='remind.json',CARE_URL='care.json',REMIND_DAYS=14,REMIND_POST_MS=20*3600000;
let remindMsg='',remindBusy=false,remindTimer=null;
function remindPrefs(){try{const p=JSON.parse(localStorage.getItem('remind')||'null');return {on:!!(p&&p.on),care:p&&typeof p.care==='boolean'?p.care:undefined,time:p&&/^\d\d:\d\d$/.test(p.time)?p.time:'07:00'}}catch{return {on:false,care:undefined,time:'07:00'}}}
const remindCareOn=p=>p.care===undefined?p.on:p.care,remindAny=p=>p.on||remindCareOn(p);
const remindSave=p=>{try{localStorage.setItem('remind',JSON.stringify(p))}catch{}};
const remindCan=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const remindKey=s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(s).length+3)%4)),c=>c.charCodeAt(0));
/* one line for the notification: the pieces, in the words of Today's list */
const outfitLine=o=>sentence(piecesLine(o));
/* the next 14 days' outfits, workdays only, by date */
function remindLines(){const out={},T=todayDate();
  for(let i=0;i<REMIND_DAYS;i++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+i);if(!isWorkday(d))continue;
    const o=planMonth(d.getFullYear(),d.getMonth())[key(d)];if(o&&(o.top||o.shirt))out[isoKey(d)]=outfitLine(o)}
  return out}
/* keep both kinds where the service worker reads them (only the kinds switched on) -> the dates a push is wanted on */
async function remindKeep(p=remindPrefs()){const lines=p.on?remindLines():{},care=remindCareOn(p)&&typeof careReminders==='function'?careReminders(REMIND_DAYS,p.time):{};
  try{if(self.caches){const c=await caches.open(REMIND_CACHE),put=(u,o)=>c.put(u,new Response(JSON.stringify(o),{headers:{'content-type':'application/json'}}));await put(REMIND_URL,lines);await put(CARE_URL,care)}}catch(e){console.warn('reminder lines',e)}
  return [...new Set([...Object.keys(lines),...Object.keys(care)])].sort()}
async function remindCall(body){const r=await acctCall('push',{method:'POST',body:JSON.stringify(body)});if(r.status!==200)throw new Error(r.j&&r.j.message||'The reminder couldn’t be set. Try again.');return r.j}
const remindTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}};
const remindSig=(dates,p)=>dates.join()+'|'+p.time+'|'+remindTz();
/* the push subscription (from a tap: the phone asks for permission) */
async function remindSub(){
  if(!remindCan())throw new Error('This phone can’t show reminders from the app.');
  const k=await acctCall('push');if(k.status!==200||!k.j.key)throw new Error('Reminders aren’t set up on the server yet.');
  const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('Notifications are off for this app. Allow them in the phone’s settings, then try again.');
  const reg=await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:remindKey(k.j.key)})}
async function remindPost(sub,p){const dates=await remindKeep(p);await remindCall({endpoint:sub.endpoint,time:p.time,tz:remindTz(),dates});
  localStorage.setItem('remind_sent',JSON.stringify({sig:remindSig(dates,p),at:Date.now()}))}
/* one of the two switches: on subscribes (if not already) and tells the server; off tells it the remaining dates, or switches the
   subscription off when neither kind is left */
async function remindSwitch(which,on){
  if(remindBusy)return;remindBusy=true;remindMsg='';renderRemindUI();
  try{const p={...remindPrefs()};if(which==='care')p.care=!!on;else{p.on=!!on;if(p.care===undefined)p.care=undefined}
    if(on){const sub=await remindSub();remindSave(p);await remindPost(sub,p);
      remindMsg=which==='care'?`On: a notification at ${p.time} when a suit or blazer is due for the cleaner.`:`On: a notification at ${p.time} on your workdays.`}
    else{remindSave(p);const reg=remindCan()&&await navigator.serviceWorker.getRegistration(),sub=reg&&await reg.pushManager.getSubscription();
      if(sub){if(remindAny(p)){try{await remindPost(sub,p)}catch{}}else{try{await remindCall({endpoint:sub.endpoint,off:true})}catch{}try{await sub.unsubscribe()}catch{}localStorage.removeItem('remind_sent')}}
      remindMsg='Off.'}}
  catch(e){remindMsg=e.message||String(e)}
  finally{remindBusy=false;renderRemindUI()}}
const remindOn=time=>{if(time)remindSave({...remindPrefs(),time});return remindSwitch('morning',true)},remindOff=()=>remindSwitch('morning',false);
const careRemindOn=()=>remindSwitch('care',true),careRemindOff=()=>remindSwitch('care',false);
/* keep the kept texts and the server's dates current: a while after the plan, the wardrobe or the settings change, and at start-up.
   The texts are rewritten each time (cheap, on the phone); the server is told only when the dates or the time changed, or once a day */
function remindSoon(){if(!remindAny(remindPrefs()))return;clearTimeout(remindTimer);remindTimer=setTimeout(remindRefresh,3000)}
async function remindRefresh(){const p=remindPrefs();if(!remindAny(p)||!remindCan()||!acctBase())return;
  const dates=await remindKeep(p);let last=null;try{last=JSON.parse(localStorage.getItem('remind_sent')||'null')}catch{}
  const sig=remindSig(dates,p);if(last&&last.sig===sig&&Date.now()-last.at<REMIND_POST_MS)return;
  try{const reg=await navigator.serviceWorker.getRegistration(),sub=reg&&await reg.pushManager.getSubscription();if(!sub)return;
    await remindCall({endpoint:sub.endpoint,time:p.time,tz:remindTz(),dates});
    localStorage.setItem('remind_sent',JSON.stringify({sig,at:Date.now()}))}catch(e){console.warn('reminder update',e)}}
/* Settings → Schedule */
function renderRemindUI(){const el=document.querySelector('#remind-box');if(!el)return;const p=remindPrefs(),ios=typeof iosInSafari==='function'&&iosInSafari(),care=remindCareOn(p);
  let body;
  if(ios)body='<p class="shelp">On an iPhone, reminders come to the app on your Home Screen: add it there (Share, then “Add to Home Screen”), open it and switch this on.</p>';
  else if(!remindCan())body='<p class="shelp">This browser can’t show reminders from the app.</p>';
  else body=`<div class="dress-row"><span class="dress-txt"><b id="remind-l">Remind me</b><small id="remind-h">A notification with the day’s outfit, on workdays</small></span><button type="button" class="dress-sw${p.on?' on':''}" id="remind-sw" role="switch" aria-checked="${p.on}" aria-labelledby="remind-l" aria-describedby="remind-h"${remindBusy?' disabled':''} onclick="${p.on?'remindOff()':'remindOn()'}"><i></i></button></div>
    <div class="dress-row"><span class="dress-txt"><b id="care-rem-l">Cleaning reminders</b><small id="care-rem-h">A notification when a suit or blazer is on its last wear or due for the cleaner</small></span><button type="button" class="dress-sw${care?' on':''}" id="care-rem-sw" role="switch" aria-checked="${care}" aria-labelledby="care-rem-l" aria-describedby="care-rem-h"${remindBusy?' disabled':''} onclick="${care?'careRemindOff()':'careRemindOn()'}"><i></i></button></div>
    <label class="srow">Time <input type="time" id="remind-time" value="${p.time}" onchange="remindTime(this.value)"></label>`;
  el.innerHTML=`<div class="slabel">Morning reminder</div>${body}<p class="shelp remind-msg" role="status">${remindMsg?acctEsc(remindMsg):''}</p>`}
async function remindTime(v){if(!/^\d\d:\d\d$/.test(v))return;const p={...remindPrefs(),time:v};remindSave(p);if(remindAny(p)){localStorage.removeItem('remind_sent');await remindRefresh();remindMsg=`Notifications at ${v}.`;renderRemindUI()}}
/* start-up: draw with Settings' extras, and refresh once the app is up */
(function remindStart(){
  if(typeof renderSettingsExtras==='function'&&!renderSettingsExtras.remind){const draw=renderSettingsExtras;renderSettingsExtras=function(){draw();renderRemindUI()};renderSettingsExtras.remind=1}
  const go=()=>setTimeout(remindRefresh,4000);document.readyState==='complete'?go():addEventListener('load',go,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')remindSoon()})})();
