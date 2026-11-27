/* Daily Wardrobe: who this phone is connected as (the restructure S3b, 2026-11-26: moved out of account.js and sync-status.js, the
   lines' text unchanged but inviteEnded's last line): the account the server answered (acct), the connection's address and code
   (acctBase, core.js's since the restructure S6a) and the role remembered for the code (rememberRole, acctRole, isTester, applyRole's
   body classes). The request (acctCall), acctEsc and an invitation in the address (hasInviteHash) went to core.js, an invitation that has
   ended (endedAnswer, inviteEnded, ENDED) to app.js (S6a, 2026-11-27: every class may import them there). Data: nothing is drawn here. Loaded right after
   srgb.js, before photo-keys.js, app.js, ui.js and every screen that asks who is connected or hears an ended invitation; account.js (the invitation link, the account box) and
   sync-status.js (the Backup line) come later. */
import {serve} from './bus.js';
import {acctBase,isConnected} from './core.js';
let acct={me:null,state:'',invites:null,link:null,busy:false,msg:'',at:0};   // state: '' not asked, 'wait', 'ok', 'old' (a server without accounts), 'no' (refused), 'off' (unreachable)
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
/* the setter other files call to assign acct (account.js: a new answer from the server; the restructure S1a's rule) */
function setAcct(v){acct=v}
/* the bridge (tests/bridge.test.js): ui, photos, colpick, look, add, settings, safety, sync, about, remind, kit, account and
   sync-status read who is connected; app, photos, account, sync, snapshots and about hear an ended invitation (endedAnswer,
   inviteEnded, ENDED). acct has a getter and a setter (tests assign it). Nothing here runs at load */
Object.assign(globalThis,{rememberRole,acctRole,isTester,applyRole,setAcct});
Object.defineProperties(globalThis,{acct:{get:()=>acct,set:v=>{acct=v}}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,rememberRole,get acct(){return acct},set acct(v){acct=v},acctRole,applyRole,isTester};
export {acct,rememberRole,acctRole,isTester,applyRole,setAcct};
/* the sockets other groups ask (the restructure S6c, tests/bus.test.js SOCKETS) */
serve('acct-role',acctRole);serve('acct-me',()=>acct.me);
