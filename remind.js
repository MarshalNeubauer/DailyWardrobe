/* Daily Wardrobe: the morning reminder (loaded after account.js). Settings → Schedule → "Morning reminder": a notification at the
   time you choose, on workdays, with the day's outfit. The server only knows when (the time, the time zone, the coming workdays'
   dates) and sends a push with no text at that time (worker.js sendReminders); the service worker shows the line this app kept for
   the date (sw.js, Cache Storage dw-keep-remind, remind.json: {"YYYY-MM-DD": "Navy suit, white shirt, burgundy tie"}).
   Needs the connection, a phone that can receive Web Push (on an iPhone: the app on the Home Screen, iOS 16.4 or later) and the
   VAPID keys on the server. The choice is this phone's own (localStorage.remind {on, time}); each phone subscribes for itself. */
const REMIND_CACHE='dw-keep-remind',REMIND_URL='remind.json',REMIND_DAYS=14,REMIND_POST_MS=20*3600000;
let remindMsg='',remindBusy=false,remindTimer=null;
function remindPrefs(){try{const p=JSON.parse(localStorage.getItem('remind')||'null');return {on:!!(p&&p.on),time:p&&/^\d\d:\d\d$/.test(p.time)?p.time:'07:00'}}catch{return {on:false,time:'07:00'}}}
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
/* keep them where the service worker reads them */
async function remindKeep(){const lines=remindLines();
  try{if(self.caches){const c=await caches.open(REMIND_CACHE);await c.put(REMIND_URL,new Response(JSON.stringify(lines),{headers:{'content-type':'application/json'}}))}}catch(e){console.warn('reminder lines',e)}
  return lines}
async function remindCall(body){const r=await acctCall('push',{method:'POST',body:JSON.stringify(body)});if(r.status!==200)throw new Error(r.j&&r.j.message||'The reminder couldn’t be set. Try again.');return r.j}
const remindTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}};
/* switch it on (from a tap: the phone asks for permission) */
async function remindOn(time){
  if(remindBusy)return;remindBusy=true;remindMsg='';renderRemindUI();
  try{
    if(!remindCan())throw new Error('This phone can’t show reminders from the app.');
    const k=await acctCall('push');if(k.status!==200||!k.j.key)throw new Error('Reminders aren’t set up on the server yet.');
    const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('Notifications are off for this app. Allow them in the phone’s settings, then try again.');
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:remindKey(k.j.key)});
    const lines=await remindKeep(),p={on:true,time:time||remindPrefs().time};
    await remindCall({endpoint:sub.endpoint,time:p.time,tz:remindTz(),dates:Object.keys(lines)});
    remindSave(p);localStorage.setItem('remind_sent',JSON.stringify({sig:remindSig(lines,p),at:Date.now()}));
    remindMsg=`On: a notification at ${p.time} on your workdays.`}
  catch(e){remindMsg=e.message||String(e)}
  finally{remindBusy=false;renderRemindUI()}}
async function remindOff(){
  if(remindBusy)return;remindBusy=true;renderRemindUI();
  try{const reg=remindCan()&&await navigator.serviceWorker.getRegistration(),sub=reg&&await reg.pushManager.getSubscription();
    if(sub){try{await remindCall({endpoint:sub.endpoint,off:true})}catch{}try{await sub.unsubscribe()}catch{}}
    remindSave({...remindPrefs(),on:false});localStorage.removeItem('remind_sent');remindMsg='Off.'}
  finally{remindBusy=false;renderRemindUI()}}
const remindSig=(lines,p)=>Object.keys(lines).join()+'|'+p.time+'|'+remindTz();
/* keep the lines and the server's dates current: a while after the plan or the settings change, and at start-up. The lines are
   rewritten each time (cheap, on the phone); the server is told only when the dates or the time changed, or once a day */
function remindSoon(){if(!remindPrefs().on)return;clearTimeout(remindTimer);remindTimer=setTimeout(remindRefresh,3000)}
async function remindRefresh(){const p=remindPrefs();if(!p.on||!remindCan()||!acctBase())return;
  const lines=await remindKeep();let last=null;try{last=JSON.parse(localStorage.getItem('remind_sent')||'null')}catch{}
  const sig=remindSig(lines,p);if(last&&last.sig===sig&&Date.now()-last.at<REMIND_POST_MS)return;
  try{const reg=await navigator.serviceWorker.getRegistration(),sub=reg&&await reg.pushManager.getSubscription();if(!sub)return;
    await remindCall({endpoint:sub.endpoint,time:p.time,tz:remindTz(),dates:Object.keys(lines)});
    localStorage.setItem('remind_sent',JSON.stringify({sig,at:Date.now()}))}catch(e){console.warn('reminder update',e)}}
/* Settings → Schedule */
function renderRemindUI(){const el=document.querySelector('#remind-box');if(!el)return;const p=remindPrefs(),ios=typeof iosInSafari==='function'&&iosInSafari();
  let body;
  if(ios)body='<p class="shelp">On an iPhone, reminders come to the app on your Home Screen: add it there (Share, then “Add to Home Screen”), open it and switch this on.</p>';
  else if(!remindCan())body='<p class="shelp">This browser can’t show reminders from the app.</p>';
  else body=`<div class="dress-row"><span class="dress-txt"><b id="remind-l">Remind me</b><small id="remind-h">A notification with the day’s outfit, on workdays</small></span><button type="button" class="dress-sw${p.on?' on':''}" id="remind-sw" role="switch" aria-checked="${p.on}" aria-labelledby="remind-l" aria-describedby="remind-h"${remindBusy?' disabled':''} onclick="${p.on?'remindOff()':'remindOn()'}"><i></i></button></div>
    <label class="srow">Time <input type="time" id="remind-time" value="${p.time}" onchange="remindTime(this.value)"></label>`;
  el.innerHTML=`<div class="slabel">Morning reminder</div>${body}<p class="shelp remind-msg" role="status">${remindMsg?acctEsc(remindMsg):''}</p>`}
async function remindTime(v){if(!/^\d\d:\d\d$/.test(v))return;const p={...remindPrefs(),time:v};remindSave(p);if(p.on){localStorage.removeItem('remind_sent');await remindRefresh();remindMsg=`A notification at ${v} on your workdays.`;renderRemindUI()}}
/* start-up: draw with Settings' extras, and refresh once the app is up */
(function remindStart(){
  if(typeof renderSettingsExtras==='function'&&!renderSettingsExtras.remind){const draw=renderSettingsExtras;renderSettingsExtras=function(){draw();renderRemindUI()};renderSettingsExtras.remind=1}
  const go=()=>setTimeout(remindRefresh,4000);document.readyState==='complete'?go():addEventListener('load',go,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')remindSoon()})})();
