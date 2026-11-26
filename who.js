/* Daily Wardrobe: who this phone is connected as (the restructure S3b, 2026-11-26: moved out of account.js and sync-status.js, the
   lines' text unchanged but inviteEnded's last line): the account the server answered (acct), the connection's address and code
   (acctBase) and a request with them (acctCall), the role remembered for the code (rememberRole, acctRole, isTester, applyRole's body
   classes), an invitation in the address (hasInviteHash), and an invitation that has ended (endedAnswer, inviteEnded, ENDED).
   Data: nothing is drawn here; inviteEnded announces 'invite-ended' (bus.js) for the screens that say so. Loaded right after
   srgb.js, before photo-keys.js, app.js, ui.js and every screen that asks who is connected or hears an ended invitation; account.js (the invitation link, the account box) and
   sync-status.js (the Backup line) come later. */
import {emit} from './bus.js';
let acct={me:null,state:'',invites:null,link:null,busy:false,msg:'',at:0};   // state: '' not asked, 'wait', 'ok', 'old' (a server without accounts), 'no' (refused), 'off' (unreachable)
const acctEsc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function acctBase(){const w=(localStorage.getItem('worker_url')||'').trim();if(!w)return null;return {url:w.replace(/\/*$/,'/'),tok:localStorage.getItem('app_token')||''}}
/* one request to the server with the connection's header -> {status, j}; status 0 = could not be reached */
async function acctCall(path,opt={},base=acctBase()){if(!base)return {status:0,j:{}};
  try{const r=await fetch(new URL(path,base.url).href,{...opt,headers:{'x-app-token':base.tok,...(opt.body?{'content-type':'application/json'}:{})},cache:'no-store'});
    return {status:r.status,j:await r.json().catch(()=>({}))}}
  catch{return {status:0,j:{}}}}
const hasInviteHash=()=>/(^#|&)invite=/.test(location.hash);
/* who this device is connected as, remembered for the connection's code ({tok, role} in localStorage.acct_role), so the app
   knows it at start-up without asking the server: testers see no costs (showCost in app.js) */
function rememberRole(m){try{const b=acctBase();if(b&&m&&m.role)localStorage.setItem('acct_role',JSON.stringify({tok:b.tok,role:m.role,...(m.id?{id:String(m.id)}:{})}))}catch{}applyRole()}   // (id: a new link for the same account is known as such, acctJoin)
function acctRole(){if(acct.me&&acct.me.role)return acct.me.role;
  try{const r=JSON.parse(localStorage.getItem('acct_role')||'null'),b=acctBase();return r&&b&&r.tok===b.tok?r.role:null}catch{return null}}
const isTester=()=>acctRole()==='tester';
/* body classes for what to show: owner (the Advanced sections, the owner's tools), tester, nocon (not connected: the parts that
   need the server are hidden, styles.css). The owner's server address and code (Connection → Advanced) stay reachable while
   not connected, so the owner can connect a new phone; a tester never sees them. */
function applyRole(){const b=document.body;if(!b)return;const r=acctRole(),on=isConnected();
  b.classList.toggle('owner',on&&r==='owner');b.classList.toggle('tester',on&&r==='tester');b.classList.toggle('nocon',!on)}
/* an invitation that was switched off: said once, and the app stops trying (localStorage.invite_ended holds that code) */
const ENDED='Your invitation has ended. Your wardrobe stays on this phone, and the app keeps working without a connection.';
/* (j: the server's answer) a tester's code the server doesn't know at all (403 'forbidden token': its storage was lost, or the account
   deleted) is also marked invite_lost: the server holds no copy of this phone's wardrobe, so a new invitation link keeps the wardrobe and
   backs it up there instead of clearing it (account.js connectFromLink; 2026-11-15, the audit: nothing said how to recover) */
function inviteEnded(token,j){if(j&&j.error==='forbidden token')try{localStorage.setItem('invite_lost',token)}catch{}
  if(localStorage.getItem('invite_ended')===token)return;localStorage.setItem('invite_ended',token);tell(endedTold(j));
  emit('invite-ended')}   // what said "Connected" and "backed up" says so too: the Backup line (sync-status.js) and the account box (account.js), through bus.js
/* what the one-time message says (fix round 3): a link the owner replaced with a new one (worker/people.js, 'invite off' with replaced) says the
   new link opens the same wardrobe; an account deleted (W1-6-03: after Delete everything on another phone this phone only heard "Your
   invitation has ended") says the backup was deleted; else ENDED */
const ENDED_NEW='Your invitation link was replaced by a new one. Ask the person who invited you for it: it opens the same wardrobe. Until then your wardrobe stays on this phone.';
const ENDED_GONE='Your wardrobe’s backup on the server was deleted, from another phone or by the person who invited you, so this invitation no longer works. Your wardrobe stays on this phone, and the app keeps working without a connection.';
const endedTold=j=>j&&j.replaced?ENDED_NEW:j&&j.error==='forbidden token'?ENDED_GONE:ENDED;
/* the server's answer means this invitation is over: switched off (403 'invite off'), or, for a tester, deleted (the account deleted
   on another phone, or its data deleted by the owner: the code is unknown, 403 'forbidden token'). A tester's phone said "Backups aren't
   available on this server yet" and kept trying. For the owner a refused code is a typing mistake, said as it is. */
const endedAnswer=(status,j)=>status===403&&!!j&&(j.error==='invite off'||j.error==='forbidden token'&&typeof isTester==='function'&&isTester());
/* the setter other files call to assign acct (account.js: a new answer from the server; the restructure S1a's rule) */
function setAcct(v){acct=v}
/* the bridge (tests/bridge.test.js): ui, photos, colpick, look, add, settings, safety, sync, about, remind, kit, account and
   sync-status read who is connected; app, photos, account, sync, snapshots and about hear an ended invitation (endedAnswer,
   inviteEnded, ENDED). acct has a getter and a setter (tests assign it). Nothing here runs at load */
Object.assign(globalThis,{acctEsc,acctBase,acctCall,hasInviteHash,rememberRole,acctRole,isTester,applyRole,setAcct,ENDED,inviteEnded,endedAnswer});
Object.defineProperties(globalThis,{acct:{get:()=>acct,set:v=>{acct=v}}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,rememberRole,get acct(){return acct},set acct(v){acct=v}};
export {acct,acctEsc,acctBase,acctCall,hasInviteHash,rememberRole,acctRole,isTester,applyRole,setAcct,ENDED,inviteEnded,endedAnswer};
