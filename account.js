/* Who the app is connected as (loaded after sync.js). The server knows two kinds of people: the owner, and testers the owner
   invited. A tester connects by opening an invitation link, <app url>#invite=<code>&w=<server url>: connectFromLink() stores the
   server's address and the code (localStorage.worker_url / app_token, the same two the Connection fields hold) once the server
   accepts the code. Settings → Connection then says who is connected: a tester sees today's use against each daily limit, the
   owner gets "Invite testers" (make a link, see each tester's use today, revoke one).
   Server API used here: GET /me, GET/POST/DELETE /invites. An older server answers these 404 or 405: the box then stays empty. */
const ACCT_CAPS=[['item','Item pictures'],['tag','Photo readings'],['pattern','Pattern readings'],['describe','Colour & pattern lookups']];
let acct={me:null,state:'',invites:null,link:null,busy:false,msg:'',at:0};   // state: '' not asked, 'wait', 'ok', 'old' (a server without accounts), 'no' (refused), 'off' (unreachable)
const acctEsc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function acctBase(){const w=(localStorage.getItem('worker_url')||'').trim();if(!w)return null;return {url:w.replace(/\/*$/,'/'),tok:localStorage.getItem('app_token')||''}}
/* one request to the server with the connection's header -> {status, j}; status 0 = could not be reached */
async function acctCall(path,opt={},base=acctBase()){if(!base)return {status:0,j:{}};
  try{const r=await fetch(new URL(path,base.url).href,{...opt,headers:{'x-app-token':base.tok,...(opt.body?{'content-type':'application/json'}:{})},cache:'no-store'});
    return {status:r.status,j:await r.json().catch(()=>({}))}}
  catch{return {status:0,j:{}}}}
/* the parts of an invitation link, or null: the text may be the whole link or only what follows the #. A full stop, comma or bracket
   a mail or chat app put right after the link is not part of it */
function inviteParts(text){const s=String(text||'').trim().replace(/[.,;:!?)\]>'"”’]+$/,''),h=s.includes('#')?s.slice(s.indexOf('#')+1):s,p=new URLSearchParams(h),code=(p.get('invite')||'').trim().replace(/[.,;:!?)\]>'"”’]+$/,''),w=(p.get('w')||'').trim();
  if(!/^[A-Za-z0-9_-]{24,80}$/.test(code))return null;
  let u;try{u=new URL(w)}catch{return null}
  if(!/^https?:$/.test(u.protocol))return null;
  return {code,url:u.href}}
const inviteLink=code=>{const b=acctBase();return location.origin+location.pathname+'#invite='+code+'&w='+encodeURIComponent(b?b.url:'')};
function dropInviteHash(){try{if(/(^#|&)invite=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search)}catch{}if(typeof appWanted==='function')appWanted()}   // (a Back entry that waited for the address to lose the invitation: start.js)
const hasInviteHash=()=>/(^#|&)invite=/.test(location.hash);
/* why the last connectFromLink didn't connect, for the place that asked (Settings' and the setup's paste fields say it in a line of
   their own): 'bad' a link that can't be read (cut short, no server part), 'refused' the server said no (acctWhyMsg: its sentence),
   'offline' the server couldn't be reached, 'kept' the person kept things as they were. inviteChecking: a link from the address is
   being checked (the setup and Settings say so instead of offering a field: on a slow connection that took 20 s, silently) */
let acctWhy='',acctWhyMsg='',inviteChecking=false,acctLinkRun=null;
const INVITE_BAD='That invitation link didn’t work. Check that you copied all of it, or ask for a new one.';
const INVITE_OFFLINE='Couldn’t reach the server: you may be offline. Try again when you’re back online.';
function acctFailText(){return acctWhy==='bad'?INVITE_BAD:acctWhy==='refused'?(acctWhyMsg||'That invitation link didn’t work. Ask for a new one.'):acctWhy==='offline'?INVITE_OFFLINE:''}
/* what shows the connection's state is drawn again: Settings' Connection, the setup's Connection and All set steps, Add's note */
function acctLinkDrawn(){try{if(typeof renderConnUI==='function')renderConnUI();if(typeof settingsSummaries==='function')settingsSummaries();
  if(typeof setupShown==='function'&&setupShown()&&typeof setupDraw==='function'&&/^(connect|done)$/.test(SETUP_STEPS[setup.at]))setupDraw();
  if(typeof renderAdd==='function'&&document.querySelector('#add')&&!document.querySelector('#add').hidden)renderAdd()}catch(e){console.warn(e)}}
/* connect from an invitation link -> true when the server accepted the code. Only then are the address and the code stored (a
   link that doesn't work leaves an existing connection alone); the #invite part is dropped from the address bar either way,
   except when the server couldn't be reached, so the link is tried again when the phone is back online or the app is opened again.
   opt.address: the link is the page's own address (start-up, a link opened in the open tab): the outcome is a toast; from a paste
   field the field says it (acctFailText). One link at a time: a second call while one runs waits for it. */
async function connectFromLink(text,opt={}){
  while(acctLinkRun)await acctLinkRun.catch(()=>{});
  const run=acctConnect(text,opt);acctLinkRun=run;try{return await run}finally{if(acctLinkRun===run)acctLinkRun=null}}
async function acctConnect(text,opt){const say=t=>{if(opt.address&&t)acctToast(t,5000)};acctWhy='';acctWhyMsg='';
  const p=inviteParts(text);
  if(!p){acctWhy='bad';dropInviteHash();say(INVITE_BAD);return false}   // (a mangled link opened from mail used to do nothing and say nothing)
  if(opt.address){inviteChecking=true;acctLinkDrawn()}
  let r;try{r=await acctCall('me',{},{url:p.url.replace(/\/*$/,'/'),tok:p.code})}finally{inviteChecking=false}
  if(r.status===0){acctWhy='offline';say('Couldn’t reach the server just now. Your invitation is tried again when you come back to the app or your connection returns.');acctLinkDrawn();return false}
  dropInviteHash();
  if(r.status!==200||!r.j||!r.j.id){acctWhy='refused';acctWhyMsg=r.j&&r.j.message||'';say(acctFailText());acctLinkDrawn();return false}
  // what this phone holds decides what happens next, so its storage is read first: the connection put back where the browser lost
  // it, and the wardrobe counted in the database. At start-up the link is checked before the wardrobe is read into memory; counted
  // from memory the phone looked empty, it switched without asking and the next sync copied its wardrobe into the other account
  if(typeof connRestored!=='undefined')await connRestored.catch(()=>{});
  const cur=acctBase(),local=await acctLocal();
  if(cur&&cur.tok&&cur.tok!==p.code){
    // the old code is over: the server no longer knew it (sync.js inviteEnded marks invite_lost on 403 'forbidden token': its storage
    // was lost, or the account deleted), or it was switched off (invite_ended, 403 'invite off'), after which the app stops syncing and
    // never hears of a later deletion either. Either way the person can't reach that backup any more, and what changed since the switch-off
    // is nowhere else: the wardrobe on this phone stays and is backed up with the new invitation instead of being cleared (2026-11-15, the
    // re-audit's N1: a re-invited tester was offered only "Clear and switch", which wiped 25 pieces)
    const lost=localStorage.getItem('invite_lost')===cur.tok||localStorage.getItem('invite_ended')===cur.tok;
    if(lost&&local.any&&!await askConfirm(`Back up this phone’s wardrobe with ${r.j.name?r.j.name+'’s':'the new'} invitation?\n\nYour old invitation has ended, so its backup on the server can’t be reached any more. Your wardrobe, day history and settings stay on this phone as they are, changes since the invitation ended included, and are backed up with the new invitation.`,{ok:'Keep it and back it up'})){acctWhy='kept';acctToast('Nothing changed: your wardrobe stays on this phone.');acctLinkDrawn();return false}
    if(lost)localStorage.removeItem('invite_lost');
    // already connected with another code: the wardrobe on this phone belongs to that account. Merging it into the new one (what
    // a sync would do) copied the owner's whole wardrobe into a tester's account when the owner tried the tester's link.
    else if(local.any){
      // what no backup has taken yet is backed up first; what still can't be is said plainly before anything is cleared (2026-11-15, the
      // re-audit: a tie added while the day's backups were used up was wiped under "its backup on the server stays as it is")
      let pend=await acctPending();
      if(pend&&typeof syncNow==='function'){acctToast('Backing up this phone’s changes first…',4000);pend=await acctBackUpFirst()}
      if(!await askConfirm(acctSwitchText(r.j.name,pend),{ok:pend?'Clear, losing those changes':'Clear and switch',danger:true})){acctWhy='kept';acctToast('Kept the current connection.');acctLinkDrawn();return false}
      if(typeof wipeDevice==='function')await wipeDevice();
      localStorage.setItem('worker_url',p.url);localStorage.setItem('app_token',p.code);rememberRole(r.j);
      try{sessionStorage.setItem(typeof ABOUT_NOTE==='string'?ABOUT_NOTE:'about_note','Connected as '+(r.j.name||'a tester'))}catch{}
      location.reload();return true}
    for(const k of ['sync_mark','last_sync','sync_status'])localStorage.removeItem(k);   // what the old account's syncs left
  }else if(local.sample&&!(cur&&cur.tok===p.code)){
    // the sample wardrobe isn't the person's: connected, it would be backed up into their wardrobe and show on their other phones
    if(!await askConfirm(`Remove the sample wardrobe first?\n\nOnce connected, what is on this phone is backed up to your wardrobe and shows on your other phones too. The ${local.sample} sample pieces aren’t yours, so they are removed before connecting; your own pieces stay.`,{ok:'Remove the sample and connect'})){
      acctWhy='kept';acctToast('Not connected: the sample wardrobe stays. Open your invitation link again when you’re ready.',6000);acctLinkDrawn();return false}
    await acctStarted();if(typeof kitSampleRemove==='function')await kitSampleRemove(true)}
  localStorage.setItem('worker_url',p.url);localStorage.setItem('app_token',p.code);for(const k of ['sync_pause','sync_pause_msg','invite_ended','list_pause'])localStorage.removeItem(k);if(typeof connKeep==='function')connKeep();
  acct={...acct,me:r.j,state:'ok',invites:null,link:null,msg:''};rememberRole(r.j);
  if(document.querySelector('#cfg-url'))document.querySelector('#cfg-url').value=p.url;
  if(document.querySelector('#cfg-token'))document.querySelector('#cfg-token').value=p.code;
  acctToast('Connected as '+(r.j.name||'a tester'));
  renderAccountUI();acctLinkDrawn();
  if(window.syncNow)syncNow();
  if(r.j.role==='tester'&&iosInSafari())setTimeout(homeScreenGuide,1200);
  return true}
/* changes on this phone that no backup has taken (sync.js: the wardrobe's fingerprint differs from the one the last backup agreed on,
   or there was none) -> true/false */
async function acctPending(){try{if(typeof syncMark!=='function'||typeof stateSig!=='function'||typeof localState!=='function')return false;
  const m=syncMark();return !m||m.sig!==stateSig(mergeState(await localState(),{}))}catch(e){console.warn('backup state not read',e);return true}}
/* back up before a switch -> whether changes are still waiting. A backup's first pull lets the start-up writers run (the day's record, the
   week's locks: sync.js afterPull), which are changes of their own, so it backs up again, up to ACCT_SYNC_TRIES times, while the server
   takes them; within ACCT_SYNC_MS, so a slow connection still gets its question (it then says what isn't backed up) */
const ACCT_SYNC_TRIES=3;
const ACCT_SYNC_MS=20000;
async function acctBackUpFirst(){const t0=Date.now();let pend=true;
  for(let k=0;k<ACCT_SYNC_TRIES&&pend;k++){const left=ACCT_SYNC_MS-(Date.now()-t0);if(left<=0)break;
    let to;const ok=await Promise.race([Promise.resolve().then(()=>syncNow()).catch(()=>false),new Promise(r=>{to=setTimeout(()=>r('slow'),left)})]);clearTimeout(to);
    pend=await acctPending();if(ok!==true)break}
  return pend}
/* the "Clear and switch" question: what is cleared (the setup's answers too, since the new account starts afresh), where the old
   wardrobe stays, and, with changes no backup has taken (pend), that they would be lost */
function acctSwitchText(name,pend){const last=+localStorage.getItem('last_sync')||0;
  const when=last?` (the last backup was ${new Date(last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})})`:'';
  return `Switch this phone to ${name?name+'’s':'the new'} invitation?\n\nTo switch, everything on this phone is cleared first: the wardrobe, its day history and the settings (workdays, what you wear, holidays). The setup then starts again for the new invitation. The wardrobe of the invitation this phone uses now stays in its backup on the server: open that invitation’s link again to get it back.`+
    (pend?`\n\nSome changes on this phone aren’t backed up yet${when}, so clearing it loses them. Cancel keeps them here; switch once they are backed up.`:'')}
/* what this phone holds, read from the database (and memory: an item saved a moment ago) -> {items, days, sample, any} */
async function acctLocal(){let n=0,d=0,s=0;
  try{const all=await tx('readonly',st=>st.getAll());n=all.length;s=all.filter(i=>i&&i.sample).length;d=await txs('days','readonly',st=>st.count())}catch(e){console.warn('wardrobe not counted',e)}
  try{n=Math.max(n,items.length);s=Math.max(s,items.filter(i=>i.sample).length);d=Math.max(d,Object.keys(dayRecs).length)}catch{}
  return {items:n,days:d,sample:s,any:n>0||d>0}}
/* the start-up chain has read the wardrobe into memory (removing the sample works on `items`) */
const acctStarted=()=>new Promise(res=>{const t0=Date.now(),go=()=>window.appReady||Date.now()-t0>20000?res():setTimeout(go,100);go()});
/* ---- iPhone: an invitation opens in Safari, but a Home Screen app keeps storage of its own, so it starts unconnected. Testers are
   told to add the app to the Home Screen and paste their link there; the link can be copied from Connection any time. ---- */
const iosDevice=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standaloneApp=()=>navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
const iosInSafari=()=>iosDevice()&&!standaloneApp();
const myInviteLink=()=>{const b=acctBase();return b&&b.tok?location.origin+location.pathname+'#invite='+b.tok+'&w='+encodeURIComponent(b.url):''};
async function copyInviteLink(){const l=myInviteLink();if(!l)return false;
  try{await navigator.clipboard.writeText(l);acctToast('Your invitation link is copied.');return true}
  catch{const f=document.querySelector('#acct-mylink');if(f){f.hidden=false;f.value=l;f.select()}acctToast('Copy the link shown under the button.',5000);return false}}
/* (audit 2026-11-15, H12) one explanation, kit.js's (with Copy my invitation link): never over the setup, which has its own Home Screen step */
function homeScreenGuide(){if(typeof setupShown==='function'&&setupShown())return;if(typeof kit!=='undefined'&&kit)return;
  if(typeof homeOpen==='function')homeOpen()}
/* who this device is connected as, remembered for the connection's code ({tok, role} in localStorage.acct_role), so the app
   knows it at start-up without asking the server: testers see no costs (showCost in app.js) */
function rememberRole(m){try{const b=acctBase();if(b&&m&&m.role)localStorage.setItem('acct_role',JSON.stringify({tok:b.tok,role:m.role}))}catch{}if(typeof applyRole==='function')applyRole()}
function acctRole(){if(acct.me&&acct.me.role)return acct.me.role;
  try{const r=JSON.parse(localStorage.getItem('acct_role')||'null'),b=acctBase();return r&&b&&r.tok===b.tok?r.role:null}catch{return null}}
const isTester=()=>acctRole()==='tester';
/* body classes for what to show: owner (the Advanced sections, the owner's tools), tester, nocon (not connected: the parts that
   need the server are hidden, styles.css). The owner's server address and code (Connection → Advanced) stay reachable while
   not connected, so the owner can connect a new phone; a tester never sees them. */
function applyRole(){const b=document.body;if(!b)return;const r=acctRole(),on=typeof isConnected==='function'?isConnected():!!acctBase();
  b.classList.toggle('owner',on&&r==='owner');b.classList.toggle('tester',on&&r==='tester');b.classList.toggle('nocon',!on)}
function acctToast(t,ms){if(typeof toast==='function')toast(t,ms)}
/* a daily limit was reached where the app has no place of its own to say so (a pattern reading falls back to the pixel reader
   and toasts its own result): the server's sentence is shown, and once more if another toast replaced it right away */
function limitNote(message){acctToast(message,6000);
  setTimeout(()=>{const e=document.querySelector('#toast');if(e&&!(e.classList.contains('on')&&e.textContent===message))acctToast(message,6000)},1500)}
/* ask the server who this is (and, for the owner, the invitations), then draw */
async function loadAccount(){const b=acctBase();
  if(!b||inviteOver()){acct={...acct,me:null,state:'',invites:null};renderAccountUI();return}
  if(Date.now()-acct.at<3000)return;acct.at=Date.now();   // Settings redraws its extras more than once in a row
  if(!acct.me){acct.state='wait';renderAccountUI()}
  const r=await acctCall('me');
  if(r.status===200&&r.j&&r.j.id){acct.me=r.j;acct.state='ok';rememberRole(r.j)}
  else if(typeof endedAnswer==='function'&&endedAnswer(r.status,r.j)){acct.me=null;acct.state='';acct.at=0;inviteEnded(b.tok,r.j);renderAccountUI();return}   // switched off, or the account deleted (sync.js)
  else{acct.me=null;acct.msg=r.j&&r.j.message||'';acct.state=r.status===0?'off':r.status===404||r.status===405?'old':'no'}
  if(acct.me&&acct.me.role==='owner'){const l=await acctCall('invites');if(l.status===200&&Array.isArray(l.j.invites))acct.invites=l.j.invites}
  acct.at=0;renderAccountUI();applyRole()}
const acctUse=(used,caps)=>ACCT_CAPS.map(([k,name])=>`<div class="acct-use"><span>${name} today:</span> <b>${+(used&&used[k])||0} of ${+(caps&&caps[k])||0}</b></div>`).join('');
function renderAccountUI(){const el=document.querySelector('#acct-box');if(!el)return;
  const m=acct.me,typed=el.querySelector('#acct-name')?el.querySelector('#acct-name').value:'';let h='';
  if(acct.state==='wait')h='<p class="shelp">Checking the connection…</p>';
  else if(inviteOver())h='';   // said in the box above (ui.js renderConnUI)
  else if(acct.state==='no')h=`<p class="shelp acct-bad">${acctEsc(acct.msg||(isTester()?'The server didn’t accept your invitation. Ask the person who invited you for a new link.':'The server didn’t accept this connection. Check the server address and the code under Advanced, below.'))}</p>`;
  else if(acct.state==='off')h='<p class="shelp">Couldn’t reach the server just now.</p>';
  else if(m&&m.role==='tester')h=`<div class="slabel">Connected as ${acctEsc(m.name||'a tester')}</div>
    <div class="acct-uses" id="acct-uses">${acctUse(m.used,m.caps)}</div><p class="shelp">These limits start again at midnight UTC.${m.firstUntil&&m.firstUntil>Date.now()?` Your first week has twice the usual limits, until ${new Date(m.firstUntil).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}.`:''}</p>
    ${iosInSafari()?'<p class="shelp acct-ios">You’re using the app in Safari. Add it to your Home Screen, open it there and paste your invitation link: iPhone keeps the two apart, and can clear Safari’s copy after a week.</p>':''}
    <div class="sactions"><button type="button" onclick="copyInviteLink()">Copy my invitation link</button></div>
    <p class="shelp">To connect the app on your Home Screen or another phone. Keep it to yourself: it opens your wardrobe.</p>
    <input type="text" id="acct-mylink" class="acct-mylink" readonly hidden aria-label="Your invitation link">`;
  else if(m){
    const list=(acct.invites||[]).map(v=>`<div class="acct-inv${v.off?' off':''}" data-id="${acctEsc(v.id)}"><div class="acct-inv-top"><b>${acctEsc(v.name)}</b>${v.off?`<span class="acct-tag">Switched off</span><button type="button" class="danger" onclick="purgeInvite('${acctEsc(v.id)}')">Delete their data</button>`:`<button type="button" class="danger" onclick="revokeInvite('${acctEsc(v.id)}')">Revoke</button>`}</div>
      ${v.off?'':`<div class="acct-uses">${acctUse(v.used,v.caps)}</div>`}</div>`).join('');
    h=`<div class="slabel">Connected as the owner</div>
    <div class="slabel acct-h">Invite testers</div><p class="shelp">Each tester gets a wardrobe of their own on your server and a daily limit on photos and readings. Send them the link; it is shown only once.</p>
    <div class="sform"><input type="text" id="acct-name" placeholder="Tester’s name" maxlength="40" autocomplete="off" aria-label="Tester’s name"><button type="button" class="pri" id="acct-create" onclick="createInvite()"${acct.busy?' disabled':''}>Create</button></div>
    <p class="shelp" id="acct-msg">${acctEsc(acct.msg)}</p>
    ${acct.link?`<div class="acct-link" id="acct-link"><div class="slabel">Link for ${acctEsc(acct.link.name)}</div><input type="text" readonly id="acct-link-url" value="${acctEsc(acct.link.url)}" aria-label="Invitation link" onfocus="this.select()"><div class="sactions"><button type="button" id="acct-copy" onclick="copyInvite()">Copy</button></div><p class="shelp">Copy it now: it can’t be shown again.</p></div>`:''}
    <div class="acct-list" id="acct-list">${list||(acct.invites?'<p class="shelp">No testers invited yet.</p>':'')}</div>`}
  el.hidden=!h;el.innerHTML=h;if(typed&&el.querySelector('#acct-name')&&!acct.link)el.querySelector('#acct-name').value=typed}   // a redraw keeps the name being typed
async function createInvite(){const inp=document.querySelector('#acct-name'),name=(inp&&inp.value||'').trim();
  if(!name){acct.msg='Give the tester a name first.';renderAccountUI();return}
  if(acct.busy)return;acct.busy=true;acct.msg='';renderAccountUI();
  const r=await acctCall('invites',{method:'POST',body:JSON.stringify({name})});acct.busy=false;
  if(r.status===200&&r.j.code){acct.link={name:r.j.name,url:inviteLink(r.j.code)};const l=await acctCall('invites');if(l.status===200&&Array.isArray(l.j.invites))acct.invites=l.j.invites}
  else acct.msg=r.j.message||(r.status===0?'Couldn’t reach the server.':'Couldn’t create the invitation.');
  renderAccountUI()}
async function copyInvite(){if(!acct.link)return;const inp=document.querySelector('#acct-link-url');
  try{await navigator.clipboard.writeText(acct.link.url);acctToast('Link copied')}
  catch{if(inp){inp.focus();inp.select();try{document.execCommand('copy');acctToast('Link copied')}catch{acctToast('Select the link and copy it')}}}}
async function revokeInvite(id){const v=(acct.invites||[]).find(x=>x.id===id);if(!v)return;
  if(!await askConfirm(`Revoke ${v.name}’s invitation?\n\nTheir app stops working with your server. What they stored stays until you tap "Delete their data" (here, once it is switched off).`,{ok:'Revoke',danger:true}))return;
  const r=await acctCall('invites?id='+encodeURIComponent(id),{method:'DELETE'});
  if(r.status===200){v.off=true;acctToast(v.name+'’s invitation is switched off')}else acct.msg=r.j.message||'Couldn’t revoke it. Try again.';
  renderAccountUI()}
/* a switched-off invitation: delete everything the tester stored on the server (backup, photos, feedback) and take it off the list */
async function purgeInvite(id){const v=(acct.invites||[]).find(x=>x.id===id);if(!v)return;
  if(!await askConfirm(`Delete ${v.name}’s data?\n\nTheir wardrobe backup, photos and feedback are deleted from your server. This can’t be undone.`,{ok:'Delete',danger:true}))return;
  const r=await acctCall('invites?id='+encodeURIComponent(id)+'&purge=1',{method:'DELETE'});
  if(r.status===200){acct.invites=acct.invites.filter(x=>x.id!==id);acctToast(v.name+'’s data is deleted')}else acct.msg=r.j.message||'Couldn’t delete it. Try again.';
  renderAccountUI()}
/* start-up: Settings draws the box whenever it opens (its extras are redrawn there), and an invitation link in the address
   connects the app once the page's scripts are in */
function acctStart(){applyRole();
  if(typeof renderSettingsExtras==='function'&&!renderSettingsExtras.acct){const draw=renderSettingsExtras;renderSettingsExtras=function(){draw();if(typeof settingsOpen==='function'&&!settingsOpen())acct.link=null;   // a new link is shown once: gone when Settings is opened again
      renderAccountUI();loadAccount()};renderSettingsExtras.acct=1}
  if(hasInviteHash()){const go=()=>connectFromLink(location.href,{address:true});document.readyState==='complete'?go():addEventListener('load',go,{once:true})}
  else if(acctBase()&&!acctRole())setTimeout(()=>{if(!acctRole())loadAccount()},4000);   // connected before roles were remembered: ask once
  // a link opened or pasted in the tab that already shows the app changes only the # part: no new page load, so nothing read it
  addEventListener('hashchange',()=>{if(hasInviteHash())connectFromLink(location.href,{address:true})});
  // a link opened while the server couldn't be reached stays in the address: tried again once the phone is online or back in front
  addEventListener('online',acctRetryLink);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')acctRetryLink()})}
function acctRetryLink(){if(acctWhy==='offline'&&hasInviteHash()&&!acctLinkRun)connectFromLink(location.href,{address:true})}
/* the invitation has ended (switched off, or the account deleted; sync.js inviteEnded): what said "Connected" is drawn again */
function acctEndedUI(){acct={...acct,me:null,state:'',invites:null};try{applyRole();renderAccountUI();acctLinkDrawn();if(typeof addGate==='function')addGate()}catch(e){console.warn(e)}}
acctStart();
