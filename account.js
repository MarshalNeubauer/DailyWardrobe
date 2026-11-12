/* Who the app is connected as (loaded after sync.js). The server knows two kinds of people: the owner, and testers the owner
   invited. A tester connects by opening an invitation link, <app url>#invite=<code>&w=<server url>: connectFromLink() stores the
   server's address and the code (localStorage.worker_url / app_token, the same two the Connection fields hold) once the server
   accepts the code. Settings → Connection then says who is connected: a tester sees today's use against each daily limit, the
   owner gets "Invite testers" (make a link, see each tester's use today, revoke one).
   Server API used here: GET /me, GET/POST/DELETE /invites. An older server answers these 404 or 405: the box then stays empty. */
const ACCT_CAPS=[['photo','Outfit photos'],['item','Item pictures'],['tag','Photo readings'],['pattern','Pattern readings']];
let acct={me:null,state:'',invites:null,link:null,busy:false,msg:'',at:0};   // state: '' not asked, 'wait', 'ok', 'old' (a server without accounts), 'no' (refused), 'off' (unreachable)
const acctEsc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function acctBase(){const w=(localStorage.getItem('worker_url')||'').trim();if(!w)return null;return {url:w.replace(/\/*$/,'/'),tok:localStorage.getItem('app_token')||''}}
/* one request to the server with the connection's header -> {status, j}; status 0 = could not be reached */
async function acctCall(path,opt={},base=acctBase()){if(!base)return {status:0,j:{}};
  try{const r=await fetch(new URL(path,base.url).href,{...opt,headers:{'x-app-token':base.tok,...(opt.body?{'content-type':'application/json'}:{})},cache:'no-store'});
    return {status:r.status,j:await r.json().catch(()=>({}))}}
  catch{return {status:0,j:{}}}}
/* the parts of an invitation link, or null: the text may be the whole link or only what follows the # */
function inviteParts(text){const s=String(text||''),h=s.includes('#')?s.slice(s.indexOf('#')+1):s,p=new URLSearchParams(h),code=p.get('invite')||'',w=p.get('w')||'';
  if(!/^[A-Za-z0-9_-]{24,80}$/.test(code))return null;
  let u;try{u=new URL(w)}catch{return null}
  if(!/^https?:$/.test(u.protocol))return null;
  return {code,url:u.href}}
const inviteLink=code=>{const b=acctBase();return location.origin+location.pathname+'#invite='+code+'&w='+encodeURIComponent(b?b.url:'')};
function dropInviteHash(){try{if(/(^#|&)invite=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search)}catch{}}
/* connect from an invitation link -> true when the server accepted the code. Only then are the address and the code stored (a
   link that doesn't work leaves an existing connection alone); the #invite part is dropped from the address bar either way,
   except when the server couldn't be reached, so opening the app again tries once more. */
async function connectFromLink(text){const p=inviteParts(text);
  if(!p){dropInviteHash();return false}
  const r=await acctCall('me',{},{url:p.url.replace(/\/*$/,'/'),tok:p.code});
  if(r.status===0){acctToast('Couldn’t reach the server. Open the invitation link again when you’re online.',5000);return false}
  dropInviteHash();
  if(r.status!==200||!r.j||!r.j.id){acctToast(r.j&&r.j.message||'That invitation link didn’t work. Ask for a new one.',5000);return false}
  // already connected with another code: the wardrobe on this phone belongs to that account. Merging it into the new one (what
  // a sync would do) copied the owner's whole wardrobe into a tester's account when the owner tried the tester's link.
  const cur=acctBase();
  if(cur&&cur.tok&&cur.tok!==p.code){
    if(acctHasLocal()){
      if(!await askConfirm(`Switch this phone to ${r.j.name?r.j.name+'’s':'this'} invitation?\n\nThis phone is connected to another wardrobe. To switch, its wardrobe is cleared from this phone first; its backup on the server stays as it is.`,{ok:'Clear and switch',danger:true})){acctToast('Kept the current connection.');return false}
      if(typeof wipeDevice==='function')await wipeDevice();
      localStorage.setItem('worker_url',p.url);localStorage.setItem('app_token',p.code);rememberRole(r.j);
      try{sessionStorage.setItem(typeof ABOUT_NOTE==='string'?ABOUT_NOTE:'about_note','Connected as '+(r.j.name||'a tester'))}catch{}
      location.reload();return true}
    for(const k of ['sync_mark','last_sync','sync_status'])localStorage.removeItem(k);   // what the old account's syncs left
  }
  localStorage.setItem('worker_url',p.url);localStorage.setItem('app_token',p.code);
  acct={...acct,me:r.j,state:'ok',invites:null,link:null,msg:''};rememberRole(r.j);
  if(document.querySelector('#cfg-url'))document.querySelector('#cfg-url').value=p.url;
  if(document.querySelector('#cfg-token'))document.querySelector('#cfg-token').value=p.code;
  acctToast('Connected as '+(r.j.name||'a tester'));
  if(typeof settingsSummaries==='function')settingsSummaries();
  renderAccountUI();
  if(typeof renderAdd==='function'&&document.querySelector('#add')&&!document.querySelector('#add').hidden)renderAdd();
  if(window.syncNow)syncNow();
  if(r.j.role==='tester'&&iosInSafari())setTimeout(homeScreenGuide,1200);
  return true}
/* anything of its own on this phone: items, or days with a record */
function acctHasLocal(){try{return (typeof items!=='undefined'&&items.length>0)||(typeof dayRecs!=='undefined'&&Object.keys(dayRecs).length>0)}catch{return false}}
/* ---- iPhone: an invitation opens in Safari, but a Home Screen app keeps storage of its own, so it starts unconnected. Testers are
   told to add the app to the Home Screen and paste their link there; the link can be copied from Connection any time. ---- */
const iosDevice=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standaloneApp=()=>navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
const iosInSafari=()=>iosDevice()&&!standaloneApp();
const myInviteLink=()=>{const b=acctBase();return b&&b.tok?location.origin+location.pathname+'#invite='+b.tok+'&w='+encodeURIComponent(b.url):''};
async function copyInviteLink(){const l=myInviteLink();if(!l)return false;
  try{await navigator.clipboard.writeText(l);acctToast('Your invitation link is copied.');return true}
  catch{const f=document.querySelector('#acct-mylink');if(f){f.hidden=false;f.value=l;f.select()}acctToast('Copy the link shown under the button.',5000);return false}}
async function homeScreenGuide(){
  if(await askConfirm('Put Daily Wardrobe on your Home Screen\n\n1. Tap Copy link below.\n2. Tap Share, then “Add to Home Screen”.\n3. Open Daily Wardrobe from your Home Screen and paste the link when it asks.\n\nThe app on your Home Screen keeps its own copy of everything, so it needs the link once. In Safari, iPhone can clear the app’s data after a week without a visit.',{ok:'Copy link',cancel:'Later'}))copyInviteLink()}
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
  if(!b){acct={...acct,me:null,state:'',invites:null};renderAccountUI();return}
  if(Date.now()-acct.at<3000)return;acct.at=Date.now();   // Settings redraws its extras more than once in a row
  if(!acct.me){acct.state='wait';renderAccountUI()}
  const r=await acctCall('me');
  if(r.status===200&&r.j&&r.j.id){acct.me=r.j;acct.state='ok';rememberRole(r.j)}
  else{acct.me=null;acct.msg=r.j&&r.j.message||'';acct.state=r.status===0?'off':r.status===404||r.status===405?'old':'no'}
  if(acct.me&&acct.me.role==='owner'){const l=await acctCall('invites');if(l.status===200&&Array.isArray(l.j.invites))acct.invites=l.j.invites}
  acct.at=0;renderAccountUI();applyRole()}
const acctUse=(used,caps)=>ACCT_CAPS.map(([k,name])=>`<div class="acct-use"><span>${name} today:</span> <b>${+(used&&used[k])||0} of ${+(caps&&caps[k])||0}</b></div>`).join('');
function renderAccountUI(){const el=document.querySelector('#acct-box');if(!el)return;
  const m=acct.me,typed=el.querySelector('#acct-name')?el.querySelector('#acct-name').value:'';let h='';
  if(acct.state==='wait')h='<p class="shelp">Checking the connection…</p>';
  else if(acct.state==='no')h=`<p class="shelp acct-bad">${acctEsc(acct.msg||'The server didn’t accept this connection. Check the address and the code above.')}</p>`;
  else if(acct.state==='off')h='<p class="shelp">Couldn’t reach the server just now.</p>';
  else if(m&&m.role==='tester')h=`<div class="slabel">Connected as ${acctEsc(m.name||'a tester')}</div>
    <div class="acct-uses" id="acct-uses">${acctUse(m.used,m.caps)}</div><p class="shelp">These limits start again at midnight UTC.</p>
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
  if(/(^#|&)invite=/.test(location.hash)){const go=()=>connectFromLink(location.href);document.readyState==='complete'?go():addEventListener('load',go,{once:true})}
  else if(acctBase()&&!acctRole())setTimeout(()=>{if(!acctRole())loadAccount()},4000)}   // connected before roles were remembered: ask once
acctStart();
