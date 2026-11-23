/* Daily Wardrobe: calendar import (2026-11-17, the owner's ask: "share a calendar subscription link once, and the app sets up occasion
   days, trips and days off from it"; "the user will need a walkthrough on how to get the link"). Loaded after kit.js.
   - Settings → Calendar (#sc-calendar, for everyone): paste a webcal:// or https:// link, Connect, a status line, Read now, Disconnect;
     the link is kept in settings.calendar {url, at} (synced like the other settings) and shown only as its host after it is saved
   - the walkthrough (calGuide: iPhone / iCloud, Google, Outlook): kit.js cards with drawn screens, no screenshots of other companies' apps
   - the server reads the link (POST /calendar, worker/calendar.js: browsers can't read most calendar links) and gives back only the next
     60 days' events: dates, title, all-day, start time, place. The link goes in the request's body, never in an address
   - the events are matched by keyword rules (CAL_RULES) to an occasion (wedding, funeral, formal, casual), days off or a trip; the review
     list (in Settings → Calendar) applies only what is kept (✓), through the app's own setOccasion (history.js), dayOffAdd (settings.js)
     and packSetTrip (pack.js), so locks and re-planning behave as for a day set by hand; ✕ dismisses; both are remembered by the event's
     id in settings.calSeen {id: 'k'|'x'} (synced entry by entry, merge.js SET_SPLIT)
   - read again at start-up and on coming back at most every CAL_EVERY, and by Read now; new matches are a small banner on Today
     ("2 new calendar events"), never applied by themselves
   - the last answer is kept on this phone only (localStorage cal_last), for the review list and Today's trip note */
const CAL_EVERY=3*3600e3;   // read again at most this often by itself
const CAL_KEY='cal_last';    // {t, from, to, events, err} on this phone
let calBusy=false,calMsg='';

/* ---- the keyword rules (data, so they can be made editable later): the first rule whose words match wins ---- */
const CAL_RULES=[
  {k:'funeral',re:/\b(funeral|memorial|burial|wake|condolences?|azza|aza)\b/i,label:'Funeral'},
  {k:'wedding',re:/\b(wedding|nikah|nikkah|marriage ceremony|bride|groom)\b/i,label:'Wedding day'},
  {k:'formal',re:/\b(gala|black[- ]tie|white[- ]tie|formal|ceremony|interview|awards?( night| dinner)?|graduation|reception)\b/i,label:'Formal day'},
  {k:'casual',re:/\b(casual (friday|thursday|day|dress)|dress[- ]down|jeans day)\b/i,label:'Casual day'},
  {k:'off',re:/\b(pto|leave|vacation|vacay|holidays?|ooo|out of (the )?office|day off|days off|off|annual leave|sick day)\b/i,not:/\b(kick[- ]?off|sign[- ]?off|off[- ]?site|drop[- ]?off|take[- ]?off|cut[- ]?off|spin[- ]?off|hand[- ]?off)\b/i,allDay:true,label:'Day off'},
  {k:'trip',re:/\b(trip|travel|travell?ing|flight|fly(ing)? to|conference|summit|offsite|off[- ]site|business trip|visit to|roadshow|expo)\b|✈/i,label:'Trip'}];
const CAL_FLIGHT=/\b(flight|fly(ing)? to)\b|✈|^\s*[A-Z0-9]{2}\s?\d{2,4}\b/i;
const CAL_OCC={wedding:'wedding',funeral:'funeral',formal:'formal',casual:'casual'};

const calRead=()=>{try{return JSON.parse(localStorage.getItem(CAL_KEY))||null}catch{return null}};
const calWrite=v=>{try{if(v)localStorage.setItem(CAL_KEY,JSON.stringify(v));else localStorage.removeItem(CAL_KEY)}catch{}};
const calLink=()=>settings.calendar&&typeof settings.calendar.url==='string'?settings.calendar.url:'';
const calSeen=()=>settings.calSeen&&typeof settings.calSeen==='object'?settings.calSeen:{};
/* the link as shown once saved: only where it points ("p52-caldav.icloud.com/…"); the rest is the secret */
function calMask(u){try{const x=new URL(String(u).replace(/^webcals?:/i,'https:'));return x.hostname+'/…'}catch{return 'your calendar'}}
const calTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}};
const calDay=iso=>isoToDate(iso);
const calDateTxt=(a,b)=>a===b?yearDate(calDay(a)):`${yearDate(calDay(a))} – ${yearDate(calDay(b))}`;
/* the person's home city, to tell a trip by an event's place */
const calHome=()=>String((settings.location&&settings.location.name)||'').split(',')[0].trim().toLowerCase();

/* an event -> what it means here {k, label} or null */
function calKind(ev){const t=String(ev.title||'');
  for(const r of CAL_RULES){if(!r.re.test(t)||(r.not&&r.not.test(t)&&!(r.k==='off'&&/\b(pto|leave|vacation|ooo|day off)\b/i.test(t))))continue;
    if(r.allDay&&!ev.allDay)continue;
    if(r.k==='trip'&&!(ev.days>=2||CAL_FLIGHT.test(t)))continue;   // a one-day "conference" at the office isn't a trip; a flight is
    return {k:r.k,label:r.label}}
  // a stay of two days or more somewhere else (its place names another city than the weather's) is a trip
  const loc=String(ev.location||'').toLowerCase(),home=calHome();
  if(ev.days>=2&&loc&&home&&!loc.includes(home)&&!/\b(online|teams|zoom|meet|webex|call|office|room)\b/i.test(loc))return {k:'trip',label:'Trip'};
  return null}
/* a found event's fields before calPlan fills them */
const CAL_X={ev:null,k:'',label:'',what:'',can:false,done:false,days:[]};
/* the events found, each with its meaning and what keeping it would do: [{ev, k, label, act, what, can}]
   flights pair up: an outbound flight and the next one within 3 weeks make one trip from the first to the second */
function calFound(list){list=list||((calRead()||{}).events)||[];const T=isoKey(todayDate()),out=[],used=new Set();
  const fl=list.filter(e=>e.end>=T&&CAL_FLIGHT.test(e.title||'')&&calKind(e)&&calKind(e).k==='trip').sort((a,b)=>a.start<b.start?-1:1);
  for(let i=0;i<fl.length;i++){const a=fl[i];if(used.has(a.id))continue;const b=fl.slice(i+1).find(x=>!used.has(x.id)&&x.start>a.start&&(+calDay(x.start)-+calDay(a.start))/864e5<=21);
    if(b){used.add(b.id);out.push({...CAL_X,ev:{...a,end:b.start,days:Math.round((+calDay(b.start)-+calDay(a.start))/864e5)+1,pair:b.id},k:'trip',label:'Trip'})}
    else out.push({...CAL_X,ev:a,k:'trip',label:'Trip'});used.add(a.id)}
  for(const e of list){if(e.end<T||used.has(e.id))continue;const m=calKind(e);if(m)out.push({...CAL_X,ev:e,...m})}
  for(const x of out)calPlan(x);
  return out.sort((a,b)=>a.ev.start<b.ev.start?-1:a.ev.start>b.ev.start?1:0)}
/* why a weekday is off: the user's own day off (it wins in offDays) says "your day off", else the holiday's name */
const calOffWhy=d=>(settings.daysOff||[]).some(o=>o&&o.d===isoKey(d))?'your day off':offName(d);
/* what keeping it does, and whether it can be kept: an occasion needs a workday (no outfit is planned on another day) */
function calPlan(x){const e=x.ev,T=todayDate(),days=[];
  for(let d=calDay(e.start<isoKey(T)?isoKey(T):e.start),b=calDay(e.end),g=0;d<=b&&g<92;d.setDate(d.getDate()+1),g++)days.push(new Date(d));
  if(CAL_OCC[x.k]){const wd=days.filter(d=>isWorkday(d)).slice(0,7);x.days=wd;x.can=wd.length>0;
    const done=wd.length&&wd.every(d=>{const r=dayRecs[key(d)];return r&&occOf(r)===CAL_OCC[x.k]});if(done)x.done=true;
    const d0=calDay(e.start),off=offName(d0)&&settings.workdays.includes(d0.getDay());   // (a day off says so, not "Thursday isn’t a workday")
    x.what=x.can?(x.k==='casual'?'Casual day: no jacket or tie':x.label):off?`a day off (${calOffWhy(d0)}): no outfit to plan`:`${DAY_NAMES[d0.getDay()]} isn’t a workday: no outfit to plan`}
  else if(x.k==='off'){const wd=days.filter(d=>isWorkday(d));x.days=days;x.can=wd.length>0;x.done=!x.can&&days.some(d=>(settings.daysOff||[]).some(o=>o.d===isoKey(d)));
    x.what=x.can?(days.length>1?`Days off (${wd.length} workday${wd.length===1?'':'s'})`:'Day off'):x.done?'Day off':'No workdays to take off'}
  else {x.can=true;x.what='Trip: a packing list for those days'}
  return x}
const calNew=()=>{const s=calSeen();return calFound().filter(x=>!s[x.ev.id]&&x.can&&!x.done)};

/* ---- reading the calendar (the server fetches it) ---- */
async function calFetch(url,fresh){const w=(localStorage.getItem('worker_url')||'').trim(),tok=(localStorage.getItem('app_token')||'').trim();
  if(!w||!tok||!isConnected())throw new Error('Reading a calendar needs a connection: Connect in ⚙ Settings first.');
  let r;try{r=await fetch(new URL('calendar',w.replace(/\/*$/,'/')).href,{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-app-token':tok},body:JSON.stringify({url,tz:calTz(),days:60,fresh:!!fresh})})}
  catch(e){throw new Error(netErr(e&&e.message)?'The server couldn’t be reached. Try again in a moment.':'The calendar couldn’t be read just now.')}
  const j=await r.json().catch(()=>({}));
  if(r.status===404||r.status===405)throw new Error('The server can’t read calendars yet: it needs an update.');
  if(!r.ok)throw new Error(j.message||'The calendar couldn’t be read just now.');
  return j}
/* reads the saved link (on demand, or by itself when the last read is older than CAL_EVERY) -> the list of new matches, or null */
async function calSync(force){const url=calLink();if(!url||calBusy||!isConnected())return null;const last=calRead();
  if(!force&&last&&last.url===calMask(url)&&Date.now()-(last.t||0)<CAL_EVERY)return null;
  calBusy=true;const before=calNew().length;
  try{const j=await calFetch(url,force);calWrite({t:Date.now(),url:calMask(url),from:j.from,to:j.to,events:(j.events||[]).slice(0,300),err:''});calMsg=''}
  catch(e){const o=calRead()||{};calWrite({...o,url:calMask(url),err:e.message||'The calendar couldn’t be read.',errAt:Date.now()});calMsg=e.message||''}
  finally{calBusy=false}
  const n=calNew();if(n.length!==before&&!$('#today').hidden)refreshToday();
  if(settingsOpen())renderCalUI();
  return n}
const calAuto=()=>{if(calLink())calSync(false).catch(e=>console.warn('calendar not read',e))};
whenPulled(()=>afterScripts(calAuto));
addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')calAuto()});

/* ---- Settings → Calendar ---- */
async function calConnect(){const inp=$('#cal-link'),v=(inp&&inp.value||'').trim();const say=m=>{calMsg=m;renderCalUI()};
  if(!v)return say('Paste the calendar link first.');
  if(!/^(webcals?|https?):\/\/\S+$/i.test(v)||v.length>2048)return say('That doesn’t look like a calendar link. Copy the whole link that starts with webcal:// or https://.');
  if(calBusy)return;calBusy=true;say('Reading your calendar…');
  try{const j=await calFetch(v,true);
    settings.calendar={url:v,at:Date.now()};await saveUserSettings();
    calWrite({t:Date.now(),url:calMask(v),from:j.from,to:j.to,events:(j.events||[]).slice(0,300),err:''});
    const n=calFound().filter(x=>!calSeen()[x.ev.id]).length;
    calMsg=`Connected. ${(j.events||[]).length} event${(j.events||[]).length===1?'':'s'} in the next 60 days${n?`; ${n} could set up your outfits: check them below.`:'; none that change what you wear.'}`;
    announce(calMsg)}
  catch(e){calMsg=e.message||'The calendar couldn’t be read.'}
  finally{calBusy=false}
  renderCalUI();refreshToday()}
async function calDisconnect(){if(!await askConfirm('Disconnect the calendar?\n\nThe app stops reading it. Days off, occasions and trips already set stay as they are.',{ok:'Disconnect',danger:true}))return;
  delete settings.calendar;calWrite(null);calMsg='Disconnected.';renderCalUI();await saveUserSettings();refreshToday()}
async function calRefresh(){if(calBusy)return;calMsg='Reading your calendar…';renderCalUI();const n=await calSync(true);
  const last=calRead()||{};calMsg=last.err||(n?(n.length?`${n.length} new event${n.length===1?'':'s'} to check below.`:'Up to date: nothing new.'):'');renderCalUI();if(calMsg)announce(calMsg)}
function calSummary(){if(!calLink())return 'Not connected';const last=calRead();if(!last||!last.t)return 'Connected';
  const n=calNew().length;return n?`${n} new event${n===1?'':'s'} to check`:last.err?'Couldn’t read it last time':'Connected · up to date'}
/* "Last read 7:02 · 3 events used" */
function calStatus(){const last=calRead();if(!last||!last.t)return last&&last.err?last.err:'Not read yet.';
  const d=new Date(last.t),same=d.toDateString()===new Date().toDateString(),at=same?d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const s=calSeen(),used=calFound().filter(x=>s[x.ev.id]==='k'||x.done).length;
  return `Last read ${at} · ${used} event${used===1?'':'s'} used`+(last.err?` · ${last.err}`:'')}
function calRow(x,state){const e=x.ev,when=calDateTxt(e.start,e.end)+(e.allDay||!e.time?'':' · '+calTime(e.time));
  const btns=state==='new'?`${x.can?`<button type="button" class="cal-ok" data-act="calKeepTap" data-id="${esc(e.id)}" aria-label="Use: ${esc(x.what)}, ${esc(e.title)}">✓</button>`:''}<button type="button" class="cal-no" data-act="calDismissTap" data-id="${esc(e.id)}" aria-label="Dismiss ${esc(e.title)}">✕</button>`
    :`<button type="button" class="linkbtn" data-act="calUndoTap" data-id="${esc(e.id)}">${state==='kept'?'Used':'Dismissed'} · Undo</button>`;
  return `<li class="cal-row ${state}${x.can?'':' cant'}"><div class="cal-ev"><b dir="auto">${esc(e.title||'(no title)')}</b><small>${when}${e.location?` · <span dir="auto">${esc(e.location)}</span>`:''}</small><span class="cal-to">→ ${esc(x.what)}</span></div><div class="cal-btns">${btns}</div></li>`}
const calTime=t=>{const [h,m]=String(t).split(':').map(Number);const d=new Date(2026,0,1,h,m);return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
function renderCalUI(){const box=$('#cal-box');if(!box)return;const url=calLink(),conn=isConnected();
  const typed=$('#cal-link')?$('#cal-link').value:'';
  let h='';
  if(!url){h+=`<p class="shelp">Share a calendar link once and the app finds weddings, funerals, formal days, days off and trips in your next 60 days. You choose what it uses.</p>
<div class="sform cal-form"><input type="url" id="cal-link" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="webcal://… or https://….ics" aria-label="Calendar link"><button type="button" id="cal-connect" data-act="calConnectTap"${conn&&!calBusy?'':' disabled'}>Connect</button></div>
${conn?'':'<p class="shelp">Reading a calendar needs a connection: Connect in ⚙ Settings first.</p>'}`}
  else{h+=`<div class="cal-conn"><b>Connected</b><span class="mut" id="cal-masked">${esc(calMask(url))}</span></div>
<p class="shelp" id="cal-status">${esc(calStatus())}</p>
<div class="sactions"><button type="button" id="cal-read" data-act="calReadTap"${conn&&!calBusy?'':' disabled'}>Read now</button><button type="button" class="danger" id="cal-off" data-act="calOffTap">Disconnect</button></div>`}
  h+=`<p class="shelp" aria-live="polite" id="cal-msg">${esc(calMsg)}</p>`;
  if(url){const s=calSeen(),f=calFound(),nw=f.filter(x=>!s[x.ev.id]&&!x.done),kept=f.filter(x=>s[x.ev.id]==='k'||(!s[x.ev.id]&&x.done)),gone=f.filter(x=>s[x.ev.id]==='x');
    h+=`<div class="cal-review" id="cal-review">${f.length?`<div class="slabel">Found ${f.length} event${f.length===1?'':'s'}</div>`:'<p class="shelp">No weddings, funerals, formal days, days off or trips in the next 60 days.</p>'}
${nw.length?`<ul class="cal-list" id="cal-new-list">${nw.map(x=>calRow(x,'new')).join('')}</ul>`:''}
${kept.length?`<ul class="cal-list">${kept.map(x=>calRow(x,'kept')).join('')}</ul>`:''}
${gone.length?`<ul class="cal-list">${gone.map(x=>calRow(x,'gone')).join('')}</ul>`:''}</div>`}
  h+=`<div class="slabel cal-howh">How to get the link</div><div class="sactions cal-guides"><button type="button" data-act="calGuideTap" data-g="icloud">iPhone (iCloud)</button><button type="button" data-act="calGuideTap" data-g="google">Google</button><button type="button" data-act="calGuideTap" data-g="outlook">Outlook</button></div>
<p class="shelp cal-priv">Anyone with a calendar link can read that calendar, so the app treats it like a password: it is kept in your settings (on your devices and in your backup) and shown here only by where it points. The server reads the calendar when the app asks, keeps nothing, and sends back only dates, titles and places.</p>`;
  box.innerHTML=h;const inp=$('#cal-link');if(inp&&typed)inp.value=typed;
  const sm=$('#sum-calendar');if(sm)sm.textContent=calSummary()}
settingsPart(renderCalUI);

/* ---- keeping and dismissing ---- */
async function calSetSeen(id,v){const s={...calSeen()};if(v)s[id]=v;else delete s[id];settings.calSeen=s;await saveUserSettings()}
const calById=id=>calFound().find(x=>x.ev.id===id);
async function calKeep(id){const x=calById(id);if(!x||!x.can)return;const e=x.ev;let msg='';
  try{
    if(CAL_OCC[x.k]){for(const d of x.days)await setOccasion(CAL_OCC[x.k],key(d));msg=`${calDateTxt(e.start,e.end)}: ${x.label.toLowerCase()} set.`}
    else if(x.k==='off'){const T=isoKey(todayDate()),r=await dayOffAdd(e.start<T?T:e.start,e.end,e.title);if(!r.ok){calMsg=r.msg;renderCalUI();return}msg=r.msg}
    else if(x.k==='trip'){const t=packSetTrip(e.start<isoKey(todayDate())?isoKey(todayDate()):e.start,e.end);if(!t)return;msg=`Packing list set for ${calDateTxt(t.a,t.b)}.`;
      if(e.pair)await calSetSeen(e.pair,'k')}
    await calSetSeen(id,'k');todayDirty()}
  catch(err){console.warn('calendar event not used',err);calMsg='That couldn’t be set. Try again.';renderCalUI();return}
  calMsg=msg;renderCalUI();announce(msg);
  if(x.k==='trip')toast(msg,6000,{label:'Open',fn:()=>openPack()});
  if(settingsOpen())settingsSummaries()}
async function calDismiss(id){const x=calById(id);await calSetSeen(id,'x');if(x&&x.ev.pair)await calSetSeen(x.ev.pair,'x');calMsg='';todayDirty();renderCalUI()}
/* takes the mark off (the event is offered again); what keeping it set stays (remove a day off or an occasion in Days off & occasions) */
async function calUndoSeen(id){const was=calSeen()[id];await calSetSeen(id,null);
  calMsg=was==='k'?'It is offered again. What it set stays: change it in Days off & occasions or the Packing list.':'';todayDirty();renderCalUI()}

/* ---- Today: "2 new calendar events" and, on a day of a trip kept, the trip ---- */
function calBanner(day){if(!calLink())return '';let h='';const n=calNew().length,home=!day||key(day)===key(homeDay());
  if(n&&home)h+=`<div class="cal-banner" id="cal-new"><span>${n} new calendar event${n===1?'':'s'}</span><button type="button" class="linkbtn" data-act="calReviewTap">Review</button></div>`;
  if(day){const k=isoKey(day),s=calSeen(),t=calFound().find(x=>x.k==='trip'&&s[x.ev.id]==='k'&&x.ev.start<=k&&x.ev.end>=k);
    if(t)h+=`<p class="cal-trip" id="cal-trip">Trip: <span dir="auto">${esc(t.ev.title)}</span> · <button type="button" class="linkbtn" data-act="calPackTap">Packing list</button></p>`}
  return h}

/* ---- the walkthrough: how to get the link, with drawn screens (simple mock-ups in the app's own colors, not screenshots) ---- */
/* a phone screen: a title bar, rows of [text, small text, on (highlighted)], and an optional switch or button drawn in a row */
function calScreen(title,rows,o={}){const H=36+rows.length*34+12;let y=44,s='';
  for(const r of rows){const [t,sub,hl,extra]=r;
    s+=`<rect x="24" y="${y}" width="252" height="28" rx="7" class="kp-card${hl?' kp-sel':''}"/><text x="36" y="${y+18}" class="${hl?'kp-t2':'kp-s'}">${t}</text>`;
    if(sub)s+=`<text x="264" y="${y+18}" class="kp-s" text-anchor="end">${sub}</text>`;
    if(extra==='switch')s+=`<rect x="230" y="${y+6}" width="34" height="16" rx="8" class="kp-on"/><circle cx="256" cy="${y+14}" r="6" class="kp-knob"/>`;
    if(extra==='info')s+=`<circle cx="254" cy="${y+14}" r="8" class="kp-ring"/><text x="254" y="${y+18}" class="kp-i" text-anchor="middle">i</text>`;
    y+=34}
  return `<svg viewBox="0 0 300 ${H+(o.note?26:8)}"><rect x="12" y="4" width="276" height="${H}" rx="16" class="kp-card"/><text x="150" y="28" class="kp-t2" text-anchor="middle">${title}</text>${s}${o.note?`<text x="150" y="${H+21}" class="kp-s" text-anchor="middle">${o.note}</text>`:''}</svg>`}
const calPastePic=()=>calScreen('Daily Wardrobe · Settings',[['Days off &amp; occasions'],['Calendar','',true],['webcal://…  Connect','',false]]);
const CAL_PASTE={key:'cal-paste',title:'Paste it here',pic:calPastePic,last:'Done',body:`<ol class="kit-list"><li>Come back to this app: <b>Settings → Calendar</b>.</li><li>Tap the link field, paste, and tap <b>Connect</b>.</li></ol><p>The app reads your next 60 days and lists what could change your outfits. Nothing is set until you tap ✓.</p>`};
const CAL_GUIDES={
  icloud:[
    {key:'cal-ic1',title:'iPhone: a calendar for it',pic:()=>calScreen('Calendars',[['Work','',false,'info'],['Family','',false,'info'],['Dress code','',true,'info'],['Add Calendar','',false]]),
      body:`<p>The link makes one calendar readable by anyone who has the link. So it is best to share a calendar of its own, say <b>Dress code</b>, and put the events there that matter for clothes: weddings, funerals, dinners, trips, days off.</p><p class="kit-tip">In the <b>Calendar</b> app tap <b>Calendars</b> at the bottom, then <b>Add Calendar</b>. Only an iCloud calendar can be shared this way.</p>`},
    {key:'cal-ic2',title:'iPhone: the calendar’s ⓘ',pic:()=>calScreen('Calendars',[['Work','',false,'info'],['Dress code','',true,'info'],['Family','',false,'info']],{note:'tap ⓘ beside the calendar'}),
      body:`<ol class="kit-list"><li>Open the <b>Calendar</b> app.</li><li>Tap <b>Calendars</b> at the bottom of the screen.</li><li>Tap <b>ⓘ</b> beside the calendar you want to share.</li></ol><p class="kit-tip">The menu may be named slightly differently on your iOS version.</p>`},
    {key:'cal-ic3',title:'iPhone: Public Calendar',pic:()=>calScreen('Edit Calendar',[['Public Calendar','',true,'switch'],['Share Link…','',true],['Copy','',false]]),
      body:`<ol class="kit-list"><li>Scroll down and turn on <b>Public Calendar</b>.</li><li>Tap <b>Share Link…</b>, then <b>Copy</b>.</li></ol><p>The link starts with <b>webcal://</b>. Anyone who has it can read this calendar (not your others), so share it only here. Turning Public Calendar off later stops the link working.</p>`},
    CAL_PASTE],
  google:[
    {key:'cal-g1',title:'Google: on the web',pic:()=>calScreen('calendar.google.com',[['☰  Today   ‹ ›','⚙',false],['Settings','',true],['Trash',''],['Density and color','']]),
      body:`<p>The Google Calendar phone app has no link to share, so use a web browser (a computer is easiest).</p><ol class="kit-list"><li>Go to <b>calendar.google.com</b> and sign in.</li><li>Tap the gear <b>⚙</b> at the top, then <b>Settings</b>.</li></ol><p class="kit-tip">On a phone, ask the browser for the desktop site (in Safari: <b>aA → Request Desktop Website</b>). The menu may be named slightly differently.</p>`},
    {key:'cal-g2',title:'Google: your calendar',pic:()=>calScreen('Settings',[['General',''],['Settings for my calendars',''],['  Dress code','',true],['  Integrate calendar','',false]]),
      body:`<ol class="kit-list"><li>On the left, under <b>Settings for my calendars</b>, choose the calendar.</li><li>Scroll to <b>Integrate calendar</b>.</li></ol><p class="kit-tip">A calendar of its own for clothes (Weddings, trips, days off) keeps everything else private.</p>`},
    {key:'cal-g3',title:'Google: the secret address',pic:()=>calScreen('Integrate calendar',[['Public address in iCal format',''],['Secret address in iCal format','',true],['https://…/basic.ics','⧉',true]]),
      body:`<ol class="kit-list"><li>Find <b>Secret address in iCal format</b>.</li><li>Tap the copy button beside it.</li></ol><p>It ends in <b>basic.ics</b>. It is secret: anyone with it can read that calendar. If it is ever shared by mistake, <b>Reset</b> there makes a new one.</p><p class="kit-tip">Google may take a few hours to show new events through the link.</p>`},
    CAL_PASTE],
  outlook:[
    {key:'cal-o1',title:'Outlook: settings',pic:()=>calScreen('Outlook on the web',[['Settings  ⚙',''],['Calendar','',true],['Mail',''],['General','']]),
      body:`<p>Use Outlook on the web (<b>outlook.com</b> or, for work, <b>outlook.office.com</b>), on a computer or the desktop site.</p><ol class="kit-list"><li>Tap the gear <b>⚙</b> (Settings).</li><li>Choose <b>Calendar</b>, then <b>Shared calendars</b>.</li></ol><p class="kit-tip">The menu may be named slightly differently in your version.</p>`},
    {key:'cal-o2',title:'Outlook: publish a calendar',pic:()=>calScreen('Shared calendars',[['Publish a calendar',''],['Calendar ▾','',true],['Can view all details ▾','',true],['Publish','',false]]),
      body:`<ol class="kit-list"><li>Under <b>Publish a calendar</b>, choose the calendar.</li><li>Choose <b>Can view all details</b> (or titles and locations), then <b>Publish</b>.</li></ol><p class="kit-tip">A work account may have publishing switched off by your company. Then use a personal calendar for the events that matter for clothes.</p>`},
    {key:'cal-o3',title:'Outlook: the ICS link',pic:()=>calScreen('Publish a calendar',[['HTML: https://outlook…/calendar.html',''],['ICS: https://outlook…/calendar.ics','',true],['Copy link','',true]]),
      body:`<ol class="kit-list"><li>Two links appear. Select the <b>ICS</b> one (it ends in <b>.ics</b>), not HTML.</li><li>Choose <b>Copy link</b>.</li></ol><p>Anyone with it can read that calendar; <b>Unpublish</b> there stops it.</p>`},
    CAL_PASTE]};
/* opened from Settings → Calendar; closing goes back there */
function calGuide(which){const c=CAL_GUIDES[which];if(!c)return;closeSettings();kitOpen(c,()=>openSettings('calendar'))}
/* what the calendar's controls do (act.js): Settings → Calendar's Connect, Read now, Disconnect and the three guides (data-g), an
   event's ✓, ✕ and Undo (the event's id in data-id), and Today's "Review" and "Packing list" */
function calConnectTap(){calConnect()}
function calReadTap(){calRefresh()}
function calOffTap(){calDisconnect()}
function calGuideTap(el){calGuide(el.dataset.g)}
function calKeepTap(el){calKeep(el.dataset.id)}
function calDismissTap(el){calDismiss(el.dataset.id)}
function calUndoTap(el){calUndoSeen(el.dataset.id)}
function calReviewTap(){openSettings('calendar')}
function calPackTap(){openPack()}
/* An ES module (2026-11-23): its names are its own, and this is what the other scripts and the tests still use as globals (the bridge;
   tests/bridge.test.js lists it): settings.js (calSummary), today.js (calBanner) and the calendar and restacts tests. calBusy is read by
   the restacts test only, and only this file writes it: a getter and no setter. */
Object.assign(globalThis,{CAL_X,calPlan,calNew,calSummary,renderCalUI,calBanner,CAL_GUIDES,calGuide});
Object.defineProperties(globalThis,{calBusy:{get:()=>calBusy}});
export {calBusy,CAL_X,calPlan,calNew,calSummary,renderCalUI,calBanner,CAL_GUIDES,calGuide};
acts({calConnectTap,calReadTap,calOffTap,calGuideTap,calKeepTap,calDismissTap,calUndoTap,calReviewTap,calPackTap});
