/* Who the app is connected as (loaded after sync.js; the account itself, the connection's address and the role are who.js's since
   the restructure S3b, 2026-11-26, and this file assigns acct with its setAcct). The server knows two kinds of people: the owner, and testers the owner
   invited. A tester connects by opening an invitation link, <app url>#invite=<code>&w=<server url>: connectFromLink() stores the
   server's address and the code (localStorage.worker_url / app_token, the same two the Connection fields hold) once the server
   accepts the code. Settings → Connection then says who is connected: a tester sees today's use against each daily limit, the
   owner gets "Invite testers" (make a link, see each tester's use today, revoke one).
   Server API used here: GET /me, GET/POST/DELETE /invites. An older server answers these 404 or 405: the box then stays empty. */
import {askFor,served,serve,emit,register} from './bus.js';
import {backWanted} from './back.js';
import {addGate,askConfirm,renderConnUI} from './ui.js';
import {settingsSummaries} from './settings.js';
import {connKeep,connRestored,endedAnswer,inviteEnded,tx,txs} from './app.js';
import {acctBase,acctCall,acctEsc,dayRecs,hasInviteHash,homeBrowser,inviteOver,iosInSafari,items,mergeState,myInviteLink,settingsOpen,syncMark} from './core.js';
import {toast} from './toast.js';
import {acts} from './act.js';
import {acct,acctRole,applyRole,isTester,rememberRole,setAcct} from './who.js';
import {localState,syncNow} from './sync.js';
const ACCT_CAPS=[['item','Item pictures'],['tag','Photo readings'],['pattern','Pattern readings'],['describe','Color & pattern lookups']];
/* the parts of an invitation link, or null: the text may be the whole link or only what follows the #. A full stop, comma or bracket
   a mail or chat app put right after the link is not part of it */
function inviteParts(text){const s=String(text||'').trim().replace(/[.,;:!?)\]>'"”’]+$/,''),h=s.includes('#')?s.slice(s.indexOf('#')+1):s,p=new URLSearchParams(h),code=(p.get('invite')||'').trim().replace(/[.,;:!?)\]>'"”’]+$/,''),w=(p.get('w')||'').trim();
  if(!/^[A-Za-z0-9_-]{24,80}$/.test(code))return null;
  // (audit 2026-11-15, W2-13-11) a server part of 200,000 characters, or one carrying a name and password, is not a link anyone was sent
  if(w.length>INVITE_W_MAX)return null;
  let u;try{u=new URL(w)}catch{return null}
  if(!/^https?:$/.test(u.protocol)||u.username||u.password)return null;
  return {code,url:u.href}}
const INVITE_W_MAX=300;
/* ---- the app's own server (audit 2026-11-15, W2-13-01/W2-13-04): an invitation link names its server in w=, and anyone can write a
   link. One that pointed at a stranger's server connected the phone there with no question, sent it the wardrobe and the code, and
   took back whatever it answered. A link is followed only to a server on this list, or to the one this phone is already connected to
   (stored by the owner under Advanced, or by an earlier link). Someone hosting the app on another server adds its address here. ---- */
const APP_SERVERS=['https://wardrobevision.n654t4phfm.workers.dev'];
const acctLoopback=h=>/^(127\.0\.0\.1|localhost|\[::1\])$/.test(h);
function acctOwnServer(url){let u;try{u=new URL(url)}catch{return false}
  if(APP_SERVERS.includes(u.origin))return true;
  const cur=acctBase();try{if(cur&&new URL(cur.url).origin===u.origin)return true}catch{}
  // a copy served from this computer (the tests, the audit's lab): their stand-in servers, *.test (a name the internet never gives
  // out) and the lab's own, on the next port. The published app is never on this computer, so these never apply there
  if(acctLoopback(location.hostname))return /\.test$/.test(u.hostname)||acctLoopback(u.hostname)&&+u.port===+location.port+1;
  return false}
const INVITE_STRANGER='That invitation link points to a server this app doesn’t use, so it wasn’t opened and nothing was sent. Only open invitation links from the person who invited you.';
const inviteLink=code=>{const b=acctBase();return location.origin+location.pathname+'#invite='+code+'&w='+encodeURIComponent(b?b.url:'')};
function dropInviteHash(){try{if(/(^#|&)invite=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search)}catch{}backWanted()}   // (a Back entry that waited for the address to lose the invitation: back.js)
/* why the last connectFromLink didn't connect, for the place that asked (Settings' and the setup's paste fields say it in a line of
   their own): 'bad' a link that can't be read (cut short, no server part), 'refused' the server said no (acctWhyMsg: its sentence),
   'offline' the server couldn't be reached, 'kept' the person kept things as they were. inviteChecking: a link from the address is
   being checked (the setup and Settings say so instead of offering a field: on a slow connection that took 20 s, silently) */
let acctWhy='',acctWhyMsg='',inviteChecking=false,acctLinkRun=null;
const INVITE_BAD='That invitation link didn’t work. Check that you copied all of it, or ask for a new one.';
const INVITE_OFFLINE='Couldn’t reach the server: you may be offline. Try again when you’re back online.';
function acctFailText(){return acctWhy==='bad'?INVITE_BAD:acctWhy==='refused'?(acctWhyMsg||'That invitation link didn’t work. Ask for a new one.'):acctWhy==='offline'?INVITE_OFFLINE:''}
/* what shows the connection's state is drawn again: Settings' Connection, the setup's Connection and All set steps, Add's note */
function acctLinkDrawn(){try{renderConnUI();settingsSummaries();
  askFor('setup-conn-draw');
  if(document.querySelector('#add')&&!/** @type {HTMLElement} */(document.querySelector('#add')).hidden)emit('card-changed')}catch(e){console.warn(e)}}
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
  // another server than the app's own: refused before anything is asked or sent (the code included)
  if(!acctOwnServer(p.url)){acctWhy='refused';acctWhyMsg=INVITE_STRANGER;dropInviteHash();say(INVITE_STRANGER);acctLinkDrawn();return false}
  return acctJoin(p,opt)}
/* the account behind a code -> its id as remembered on this phone (rememberRole), or '' */
function acctIdFor(tok){try{const r=JSON.parse(localStorage.getItem('acct_role')||'null');return r&&r.tok===tok&&r.id?String(r.id):''}catch{return ''}}
function acctRoleFor(tok){try{const r=JSON.parse(localStorage.getItem('acct_role')||'null');return r&&r.tok===tok?r.role:null}catch{return null}}
/* the server couldn't say whether the invitation this phone uses now is still on (an error of its own): nothing is changed (CR-5-02) */
const ACCT_OLD_UNSURE='Couldn’t check the invitation this phone uses now: the server had a problem. Nothing was changed. Try the link again in a few minutes.';
/* p = {code, url}: a link's (acctConnect), or the address and code the owner typed under Advanced (acctTyped, opt.typed) */
async function acctJoin(p,opt){const say=t=>{if((opt.address||opt.typed)&&t)acctToast(t,5000)};
  if(opt.address){inviteChecking=true;acctLinkDrawn()}
  let r;try{r=await acctCall('me',{},{url:p.url.replace(/\/*$/,'/'),tok:p.code})}finally{inviteChecking=false}
  if(r.status===0){acctWhy='offline';say(opt.typed?'Couldn’t reach the server, so the connection wasn’t changed. Try again when you’re back online.':'Couldn’t reach the server just now. Your invitation is tried again when you come back to the app or your connection returns.');acctLinkDrawn();return false}
  dropInviteHash();
  if(r.status!==200||!r.j||!r.j.id){acctWhy='refused';acctWhyMsg=r.j&&r.j.message||'';say(opt.typed?'The server didn’t accept that address and code, so the connection wasn’t changed.':acctFailText());acctLinkDrawn();return false}
  // what this phone holds decides what happens next, so its storage is read first: the connection put back where the browser lost
  // it, and the wardrobe counted in the database. At start-up the link is checked before the wardrobe is read into memory; counted
  // from memory the phone looked empty, it switched without asking and the next sync copied its wardrobe into the other account
  await connRestored.catch(()=>{});
  const cur=acctBase(),local=await acctLocal(),name=r.j.name||'a tester';let toldSame=false;
  const kept=t=>{acctWhy='kept';acctToast(t);acctLinkDrawn();return false};
  if(cur&&cur.tok&&cur.tok!==p.code){
    // (audit 2026-11-15, W1-7-01) the server is asked about the old code first: what this phone remembered was not enough. A phone that
    // hadn't asked anything since its invitation was switched off was offered "Clear and switch" and lost the whole wardrobe
    const old=await acctCall('me',{},cur),oldOk=old.status===200&&old.j&&!!old.j.id;
    const oldId=oldOk?String(old.j.id):acctIdFor(cur.tok),oldRole=oldOk?old.j.role:acctRoleFor(cur.tok);
    if(oldId&&oldId===String(r.j.id)){
      // (fix round 3, the owner's decision 1) the same account under a new code: the owner made a new link for this tester (the old one
      // stops working), or the owner's own code changed. Nothing is cleared or asked: it is the same wardrobe and the same backup
      toldSame=true}
    else{
      // the old code is over: any refusal now (switched off, replaced, the account deleted or its storage lost), or one heard before
      // (sync-status.js inviteEnded: invite_ended, invite_lost). The person can't reach that backup any more, and what changed since is nowhere
      // else: the wardrobe on this phone stays and is backed up with the new invitation instead of being cleared (the re-audit's N1)
      // (CR-5-02, 2026-11-17) only a real "ended" answer counts: switched off or replaced (403 'invite off'), or a code the server doesn't
      // know (403 'forbidden token'). A passing server error (5xx, 429, another refusal) counted as ended too, and "Keep it and back it up"
      // copied the whole wardrobe of an account still in use into the new one: now nothing changes and the link can be tried again
      const lost=old.status===403&&!!old.j&&(old.j.error==='invite off'||old.j.error==='forbidden token')||localStorage.getItem('invite_lost')===cur.tok||localStorage.getItem('invite_ended')===cur.tok;
      if(!lost&&!oldOk&&old.status!==0&&old.status!==404&&old.status!==405){acctWhy='refused';acctWhyMsg=ACCT_OLD_UNSURE;say(ACCT_OLD_UNSURE);acctLinkDrawn();return false}
      if(lost){
        if(local.any&&!await askConfirm(`Back up this phone’s wardrobe with ${r.j.name?r.j.name+'’s':'the new'} invitation?\n\nYour old invitation has ended, so its backup on the server can’t be reached any more. Your wardrobe, day history and settings stay on this phone as they are, changes since the invitation ended included, and are backed up with the new invitation.`,{ok:'Keep it and back it up'}))return kept('Nothing changed: your wardrobe stays on this phone.');
        localStorage.removeItem('invite_lost')}
      // already connected with another code: the wardrobe on this phone belongs to that account. Merging it into the new one (what
      // a sync would do) copied the owner's whole wardrobe into a tester's account when the owner tried the tester's link.
      else if(local.any){
        // what no backup has taken yet is backed up first; what still can't be is said plainly before anything is cleared (2026-11-15, the
        // re-audit: a tie added while the day's backups were used up was wiped under "its backup on the server stays as it is")
        let pend=await acctPending();
        if(pend){acctToast('Backing up this phone’s changes first…',4000);pend=await acctBackUpFirst()}
        if(!await askConfirm(acctSwitchText(r.j,pend,oldRole==='owner'),{ok:pend?'Clear, losing those changes':'Clear and switch',danger:true}))return kept('Kept the current connection.');
        // (a clear that didn't happen switches nothing: the old wardrobe would go into the new account, CR-7-01)
        if(served('wipe-device')&&!await askFor('wipe-device'))return kept('This phone couldn’t be cleared, so it stays connected as before. Close the app fully (swipe it away), open it again and use the link again.');
        localStorage.setItem('worker_url',p.url);localStorage.setItem('app_token',p.code);rememberRole(r.j);
        acctOwnerPhone(oldRole,r.j);
        try{sessionStorage.setItem(askFor('about-note')??'about_note',r.j.role==='owner'?'Connected as the owner':'Connected as '+name)}catch{}
        location.reload();return true}
      // (audit 2026-11-15, W2-13-04) an empty phone switched with no word: the connection it had is said, and how to come back to it
      else if(!await askConfirm(acctSwitchEmptyText(r.j,oldOk?old.j:null,oldRole==='owner'),{ok:'Switch'}))return kept('Kept the current connection.');
      acctOwnerPhone(oldRole,r.j);
      for(const k of ['sync_mark','last_sync','sync_status'])localStorage.removeItem(k)}   // what the old account's syncs left
  }   // (the sample wardrobe needs no question: it stays on this phone and is never backed up, kit.js kitShareFilter; re-audit 2026-11-15)
  else if(!cur&&local.items-local.sample>0){
    // (audit 2026-11-15, W1-7-03, W1-11-01) pieces of this phone's own go into the account: said and asked first. After Safari cleared the
    // site, pieces added again before the link was found were merged into the restored wardrobe with no word, as doubles
    const n=local.items-local.sample,pcs=n===1?'1 piece':n+' pieces';
    if(!await askConfirm(`Add this phone’s ${pcs} to ${r.j.role==='owner'?'your':r.j.name?r.j.name+'’s':'the invitation’s'} wardrobe?\n\nThis phone has ${pcs} of its own. Connecting adds ${n===1?'it':'them'} to the wardrobe backed up with this ${r.j.role==='owner'?'server':'invitation'}, next to anything already there. If ${n===1?'it is a piece':'they are pieces'} the backup already has, tap Cancel, delete ${n===1?'it':'them'} on this phone, then open the link again.`,{ok:'Add and connect'}))return kept('Not connected: nothing was sent, and this phone’s wardrobe stays as it is.');
  }
  localStorage.setItem('worker_url',p.url);localStorage.setItem('app_token',p.code);for(const k of ['sync_pause','sync_pause_msg','invite_ended','invite_lost','list_pause'])localStorage.removeItem(k);connKeep();
  setAcct({...acct,me:r.j,state:'ok',invites:null,link:null,msg:''});rememberRole(r.j);
  if(document.querySelector('#cfg-url'))/** @type {HTMLInputElement} */(document.querySelector('#cfg-url')).value=p.url;
  if(document.querySelector('#cfg-token'))/** @type {HTMLInputElement} */(document.querySelector('#cfg-token')).value=p.code;
  acctToast(r.j.role==='owner'?'Connected as the owner':'Connected as '+name+(toldSame?': the same wardrobe as before':''));
  renderAccountUI();acctLinkDrawn();
  syncNow();
  // once per phone, not when it was already connected with this code (fix round 2: it covered the app every time a tester tapped his link)
  if(r.j.role==='tester'&&iosInSafari()&&!(cur&&cur.tok===p.code)&&!toldSame&&!homeTold())setTimeout(homeScreenGuide,1200);
  return true}
/* (audit 2026-11-15, W1-7-02) the owner's phone moved to a tester's invitation: Connection keeps "I run the server" (ui.js renderConnUI),
   the owner's way back; back on the owner's code the mark goes */
function acctOwnerPhone(oldRole,to){try{if(to&&to.role==='owner')localStorage.removeItem('acct_was_owner');else if(oldRole==='owner')localStorage.setItem('acct_was_owner','1')}catch{}}
/* the owner typed another address or code under Advanced while connected (settings.js saveSettings): the same questions as a link, since
   a typed code that differs moves this phone to another account just the same */
async function acctTyped(url,code){
  while(acctLinkRun)await acctLinkRun.catch(()=>{});
  acctWhy='';acctWhyMsg='';
  let u;try{u=new URL(url)}catch{acctToast('That server address isn’t a web address, so the connection wasn’t changed.',5000);return false}
  const run=acctJoin({code,url:u.href},{typed:true});acctLinkRun=run;try{return await run}finally{if(acctLinkRun===run)acctLinkRun=null}}
/* changes on this phone that no backup has taken (sync.js: the wardrobe's fingerprint differs from the one the last backup agreed on,
   or there was none) -> true/false */
async function acctPending(){try{
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
/* to: the new account's /me; fromOwner: this phone is the owner's now, who has no invitation link to come back with (W1-7-02) */
const acctSwitchHead=to=>to&&to.role==='owner'?'Switch this phone back to your own wardrobe?':`Switch this phone to ${to&&to.name?to.name+'’s':'the new'} invitation?`;
const acctComeBack=fromOwner=>fromOwner?'Your own wardrobe stays in your server’s backup. To come back to it, open Settings → Connection on this phone, tap “I run the server” and type the server’s address and your code.'
  :'The wardrobe of the invitation this phone uses now stays in its backup on the server: open that invitation’s link again to get it back.';
function acctSwitchText(to,pend,fromOwner){const last=+localStorage.getItem('last_sync')||0;
  if(typeof to==='string'||to==null)to={name:to||''};
  const when=last?` (the last backup was ${new Date(last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})})`:'';
  // (W1-7-04) the setup starts again only when the other account has no wardrobe yet
  return `${acctSwitchHead(to)}\n\nTo switch, everything on this phone is cleared first: the wardrobe, its day history and the settings (workdays, what you wear, holidays). If the ${to.role==='owner'?'account':'new invitation'} has no wardrobe yet, the setup starts again. ${acctComeBack(fromOwner)}`+
    (pend?`\n\nSome changes on this phone aren’t backed up yet${when}, so clearing it loses them. Cancel keeps them here; switch once they are backed up.`:'')}
/* an empty phone connected with another code (W2-13-04): nothing to clear, but the connection it has goes */
function acctSwitchEmptyText(to,from,fromOwner){
  const now=fromOwner?'This phone is connected as the owner now.':from&&from.name?`This phone is connected as ${from.name} now.`:'This phone is connected with another invitation now.';
  return `${acctSwitchHead(to)}\n\n${now} Nothing is stored on it yet, so nothing is cleared. ${acctComeBack(fromOwner)}`}
/* what this phone holds, read from the database (and memory: an item saved a moment ago) -> {items, days, sample, any} */
async function acctLocal(){let n=0,d=0,s=0;
  try{const all=await tx('readonly',st=>st.getAll());n=all.length;s=all.filter(i=>i&&i.sample).length;d=await txs('days','readonly',st=>st.count())}catch(e){console.warn('wardrobe not counted',e)}
  try{n=Math.max(n,items.length);s=Math.max(s,items.filter(i=>i.sample).length);d=Math.max(d,Object.keys(dayRecs).length)}catch{}
  return {items:n,days:d,sample:s,any:n>0||d>0}}
/* ---- iPhone: an invitation opens in Safari, but a Home Screen app keeps storage of its own, so it starts unconnected. Testers are
   told to add the app to the Home Screen and paste their link there; the link can be copied from Connection any time. ---- */
async function copyInviteLink(){const l=myInviteLink();if(!l)return false;
  try{await navigator.clipboard.writeText(l);acctToast('Your invitation link is copied.');return true}
  catch{const f=/** @type {HTMLInputElement} */(document.querySelector('#acct-mylink'));if(f){f.hidden=false;f.value=l;f.select()}acctToast('Copy the link shown under the button.',5000);return false}}
/* (audit 2026-11-15, H12) one explanation, kit.js's (with Copy my invitation link): never over the setup, which has its own Home Screen step */
function homeScreenGuide(){if(askFor('setup-shown'))return;if(askFor('kit-shown'))return;
  if(served('home-open')){homeTold(true);askFor('home-open')}}
/* the Home Screen sheet was shown after a link on this phone (localStorage.home_told); About's button still opens it any time */
function homeTold(set){try{if(set)localStorage.setItem('home_told','1');return localStorage.getItem('home_told')==='1'}catch{return false}}
function acctToast(t,ms){toast(t,ms)}
/* a daily limit was reached where the app has no place of its own to say so (a pattern reading falls back to the pixel reader
   and toasts its own result): the server's sentence is shown, and once more if another toast replaced it right away */
function limitNote(message){acctToast(message,6000);
  setTimeout(()=>{const e=document.querySelector('#toast');if(e&&!(e.classList.contains('on')&&e.textContent===message))acctToast(message,6000)},1500)}
/* ask the server who this is (and, for the owner, the invitations), then draw */
async function loadAccount(){const b=acctBase();
  if(!b||inviteOver()){setAcct({...acct,me:null,state:'',invites:null});renderAccountUI();return}
  if(Date.now()-acct.at<3000)return;acct.at=Date.now();   // Settings redraws its extras more than once in a row
  if(!acct.me){acct.state='wait';renderAccountUI()}
  const r=await acctCall('me');
  if(r.status===200&&r.j&&r.j.id){acct.me=r.j;acct.state='ok';rememberRole(r.j)}
  else if(endedAnswer(r.status,r.j)){acct.me=null;acct.state='';acct.at=0;inviteEnded(b.tok,r.j);renderAccountUI();return}   // switched off, or the account deleted (sync.js)
  else{acct.me=null;acct.msg=r.j&&r.j.message||'';acct.state=r.status===0?'off':r.status===404||r.status===405?'old':'no'}
  if(acct.me&&acct.me.role==='owner'){const l=await acctCall('invites');if(l.status===200&&Array.isArray(l.j.invites))acct.invites=l.j.invites}
  acct.at=0;renderAccountUI();applyRole()}
const acctUse=(used,caps)=>ACCT_CAPS.map(([k,name])=>`<div class="acct-use"><span>${name} today:</span> <b>${+(used&&used[k])||0} of ${+(caps&&caps[k])||0}</b></div>`).join('');
function renderAccountUI(){const el=/** @type {HTMLElement} */(document.querySelector('#acct-box'));if(!el)return;
  const m=acct.me,typed=el.querySelector('#acct-name')?/** @type {HTMLInputElement} */(el.querySelector('#acct-name')).value:'';let h='';
  if(acct.state==='wait')h='<p class="shelp">Checking the connection…</p>';
  else if(inviteOver())h='';   // said in the box above (ui.js renderConnUI)
  else if(acct.state==='no')h=`<p class="shelp acct-bad">${acctEsc(acct.msg||(isTester()?'The server didn’t accept your invitation. Ask the person who invited you for a new link.':'The server didn’t accept this connection. Check the server address and the code under Advanced, below.'))}</p>`;
  else if(acct.state==='off')h='<p class="shelp">Couldn’t reach the server just now.</p>';
  else if(m&&m.role==='tester')h=`<div class="slabel">Connected as ${acctEsc(m.name||'a tester')}</div>
    <div class="acct-uses" id="acct-uses">${acctUse(m.used,m.caps)}</div><p class="shelp">These limits start again at midnight UTC.${m.firstUntil&&m.firstUntil>Date.now()?` Your first week has twice the usual limits, until ${new Date(m.firstUntil).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}.`:''}</p>
    ${iosInSafari()?(b=>`<p class="shelp acct-ios">You’re using the app in ${b}. Add it to your Home Screen, open it there and paste your invitation link: iPhone keeps the two apart, and can clear ${b}’s copy after a week.</p>`)(homeBrowser()):''}
    <div class="sactions"><button type="button" data-act="acctMyLinkTap">Copy my invitation link</button></div>
    <p class="shelp">To connect the app on your Home Screen or another phone. Keep it somewhere safe, such as a note or your mail: if this phone’s data is ever cleared, the link brings your wardrobe back. Keep it to yourself: it opens your wardrobe.</p>
    <input type="text" id="acct-mylink" class="acct-mylink" readonly hidden aria-label="Your invitation link">`;
  else if(m){
    const list=(acct.invites||[]).map(v=>`<div class="acct-inv${v.off?' off':''}" data-id="${acctEsc(v.id)}"><div class="acct-inv-top"><b>${acctEsc(v.name)}</b>${v.off?`<span class="acct-tag">Switched off</span><button type="button" class="danger" data-act="acctPurgeTap" data-id="${acctEsc(v.id)}">Delete their data</button>`:`<span class="acct-btns"><button type="button" class="acct-new" data-act="acctReissueTap" data-id="${acctEsc(v.id)}"${acct.busy?' disabled':''}>New link</button><button type="button" class="danger" data-act="acctRevokeTap" data-id="${acctEsc(v.id)}">Revoke</button></span>`}</div>
      ${v.off?'':`<div class="acct-uses">${acctUse(v.used,v.caps)}</div>`}</div>`).join('');
    h=`<div class="slabel">Connected as the owner</div>
    <div class="slabel acct-h">Invite testers</div><p class="shelp">Each tester gets a wardrobe of their own on your server and a daily limit on photos and readings. Send them the link; it is shown only once.</p>
    <div class="sform"><input type="text" id="acct-name" placeholder="Tester’s name" maxlength="40" autocomplete="off" aria-label="Tester’s name"><button type="button" class="pri" id="acct-create" data-act="acctCreateTap"${acct.busy?' disabled':''}>Create</button></div>
    <p class="shelp" id="acct-msg">${acctEsc(acct.msg)}</p>
    ${acct.link?`<div class="acct-link" id="acct-link"><div class="slabel">${acct.link.again?'New link':'Link'} for ${acctEsc(acct.link.name)}</div><input type="text" readonly id="acct-link-url" value="${acctEsc(acct.link.url)}" aria-label="Invitation link" data-act-focus="acctLinkFocus"><div class="sactions"><button type="button" id="acct-copy" data-act="acctCopyTap">Copy</button></div><p class="shelp">${acct.link.again?'It opens the same wardrobe as before; their old link no longer works. ':''}Copy it now: it can’t be shown again.</p></div>`:''}
    <div class="acct-list" id="acct-list">${list||(acct.invites?'<p class="shelp">No testers invited yet.</p>':'')}</div>`}
  el.hidden=!h;el.innerHTML=h;if(typed&&el.querySelector('#acct-name')&&!acct.link)/** @type {HTMLInputElement} */(el.querySelector('#acct-name')).value=typed}   // a redraw keeps the name being typed
async function createInvite(){const inp=/** @type {HTMLInputElement} */(document.querySelector('#acct-name')),name=(inp&&inp.value||'').trim();
  if(!name){acct.msg='Give the tester a name first.';renderAccountUI();return}
  if(acct.busy)return;acct.busy=true;acct.msg='';renderAccountUI();
  const r=await acctCall('invites',{method:'POST',body:JSON.stringify({name})});acct.busy=false;
  if(r.status===200&&r.j.code){acct.link={name:r.j.name,url:inviteLink(r.j.code)};const l=await acctCall('invites');if(l.status===200&&Array.isArray(l.j.invites))acct.invites=l.j.invites}
  else acct.msg=r.j.message||(r.status===0?'Couldn’t reach the server.':'Couldn’t create the invitation.');
  renderAccountUI()}
async function copyInvite(){if(!acct.link)return;const inp=/** @type {HTMLInputElement} */(document.querySelector('#acct-link-url'));
  try{await navigator.clipboard.writeText(acct.link.url);acctToast('Link copied')}
  catch{if(inp){inp.focus();inp.select();try{document.execCommand('copy');acctToast('Link copied')}catch{acctToast('Select the link and copy it')}}}}
async function revokeInvite(id){const v=(acct.invites||[]).find(x=>x.id===id);if(!v)return;
  if(!await askConfirm(`Revoke ${v.name}’s invitation?\n\nTheir app stops working with your server. What they stored stays until you tap "Delete their data" (here, once it is switched off).`,{ok:'Revoke',danger:true}))return;
  const r=await acctCall('invites?id='+encodeURIComponent(id),{method:'DELETE'});
  if(r.status===200){v.off=true;acctToast(v.name+'’s invitation is switched off')}else acct.msg=r.j.message||'Couldn’t revoke it. Try again.';
  renderAccountUI()}
/* (fix round 3, the owner's decision 1; audit W1-11-02) a tester who lost the link: a new link that opens the same wardrobe, the old code
   stops working. The server keeps only each code's fingerprint, so the old link can't be shown again; it makes a new code for the same
   account (POST /invites {reissue: id}, worker/people.js) */
async function reissueInvite(id){const v=(acct.invites||[]).find(x=>x.id===id);if(!v||acct.busy)return;
  if(!await askConfirm(`Make a new link for ${v.name}?\n\nThe new link opens ${v.name}’s same wardrobe, with everything backed up so far. Their current link stops working on every phone: send them the new one and they open it on each phone they use.`,{ok:'Make a new link'}))return;
  acct.busy=true;acct.msg='';acct.link=null;renderAccountUI();
  const r=await acctCall('invites',{method:'POST',body:JSON.stringify({reissue:id})});acct.busy=false;
  if(r.status===200&&r.j.code){acct.link={name:r.j.name||v.name,url:inviteLink(r.j.code),again:true};const l=await acctCall('invites');if(l.status===200&&Array.isArray(l.j.invites))acct.invites=l.j.invites}
  else acct.msg=r.j.message||(r.status===0?'Couldn’t reach the server.':'Couldn’t make a new link. Try again.');
  renderAccountUI();const f=document.querySelector('#acct-link');if(f&&f.scrollIntoView)f.scrollIntoView({block:'nearest'})}
/* a switched-off invitation: delete everything the tester stored on the server (backup, photos, feedback) and take it off the list */
async function purgeInvite(id){const v=(acct.invites||[]).find(x=>x.id===id);if(!v)return;
  if(!await askConfirm(`Delete ${v.name}’s data?\n\nTheir wardrobe backup, photos and feedback are deleted from your server. This can’t be undone.`,{ok:'Delete',danger:true}))return;
  const r=await acctCall('invites?id='+encodeURIComponent(id)+'&purge=1',{method:'DELETE'});
  if(r.status===200){acct.invites=acct.invites.filter(x=>x.id!==id);acctToast(v.name+'’s data is deleted')}else acct.msg=r.j.message||'Couldn’t delete it. Try again.';
  renderAccountUI()}
/* start-up: Settings draws the box whenever it opens (its extras are redrawn there), and an invitation link in the address
   connects the app once the page's scripts are in */
/* Settings' account box, drawn with the rest of Settings (its 'settings-parts' hook) */
function acctSettingsPart(){if(!settingsOpen())acct.link=null;   // a new link is shown once: gone when Settings is opened again
  renderAccountUI();loadAccount()}
function acctStart(){applyRole();
  // a connection localStorage lost comes back from the database after this first look (app.js connRestored): the classes are set again then
  try{connRestored.catch(()=>{}).then(()=>{try{applyRole()}catch(e){console.warn(e)}})}catch{}
  if(hasInviteHash()){const go=()=>connectFromLink(location.href,{address:true});document.readyState==='complete'?go():addEventListener('load',go,{once:true})}
  else if(acctBase()&&!acctRole())setTimeout(()=>{if(!acctRole())loadAccount()},4000);   // connected before roles were remembered: ask once
  // a link opened or pasted in the tab that already shows the app changes only the # part: no new page load, so nothing read it
  addEventListener('hashchange',()=>{if(hasInviteHash())connectFromLink(location.href,{address:true})});
  // a link opened while the server couldn't be reached stays in the address: tried again once the phone is online or back in front
  addEventListener('online',acctRetryLink);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')acctRetryLink()})}
function acctRetryLink(){if(acctWhy==='offline'&&hasInviteHash()&&!acctLinkRun)connectFromLink(location.href,{address:true})}
/* the invitation has ended (switched off, or the account deleted; who.js inviteEnded announces 'invite-ended'): what said "Connected" is drawn again */
function acctEndedUI(){setAcct({...acct,me:null,state:'',invites:null});try{applyRole();renderAccountUI();acctLinkDrawn();addGate()}catch(e){console.warn(e)}}
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,get acctLinkRun(){return acctLinkRun},acctPending,dropInviteHash,homeScreenGuide,loadAccount,renderAccountUI,get inviteChecking(){return inviteChecking},set inviteChecking(v){inviteChecking=v},get acctWhy(){return acctWhy},connectFromLink};
export {dropInviteHash,acctWhy,inviteChecking,acctLinkRun,acctFailText,connectFromLink,acctTyped,acctPending,homeScreenGuide,limitNote,loadAccount,renderAccountUI,acctEndedUI};
acctStart();
/* what Settings' account controls do (act.js): a tester's "Copy my invitation link"; the owner's Create, a new link's field (focus selects
   it) and Copy, and a tester's New link, Revoke and Delete their data (the invitation's id in data-id) */
function acctMyLinkTap(){copyInviteLink()}
function acctCreateTap(){createInvite()}
function acctLinkFocus(el){el.select()}
function acctCopyTap(){copyInvite()}
function acctPurgeTap(el){purgeInvite(el.dataset.id)}
function acctReissueTap(el){reissueInvite(el.dataset.id)}
function acctRevokeTap(el){revokeInvite(el.dataset.id)}
acts({acctMyLinkTap,acctCreateTap,acctLinkFocus,acctCopyTap,acctPurgeTap,acctReissueTap,acctRevokeTap});
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('invite-checking',()=>inviteChecking);serve('acct-why',()=>acctWhy);serve('connect-link',connectFromLink);serve('acct-fail-text',acctFailText);serve('limit-note',limitNote);
/* the hooks (bus.js register; the notice board made clean, N2): what this feature does at the moments core runs, its file's last statement */
register('account',{'settings-parts':acctSettingsPart,'settings-summary':()=>applyRole(),
  'invite-ended':()=>acctEndedUI(),   // an ended invitation (app.js inviteEnded): what said "Connected" is drawn again
  'connection-typed':(url,code)=>acctTyped(url,code).catch(e=>console.warn('connection not changed',e))});   // another address or code typed in Settings → Connection
