/* Daily Wardrobe: small pieces of interface every page shares (loaded after app.js; everything here runs when called, not at load).
   - askConfirm(message, {ok, cancel, danger}) -> Promise<boolean>: the app's own question, a sheet from the bottom like the piece picker
   - tell(message): a plain notice (a toast that stays long enough to read)
   - isConnected(), needConn(): what the buttons that need the server show while the app is not connected
   - advFold(): the "Advanced" folds in Settings */
const ASK_NONE={ok:'OK',cancel:'Cancel',danger:false};
let asking=null;   // the question on screen: {done(answer), last (what had the focus)}
const uiEsc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function askEls(){let b=document.querySelector('#ask-backdrop'),s=document.querySelector('#ask-sheet');
  if(!s){b=document.createElement('div');b.id='ask-backdrop';b.onclick=()=>askAnswer(false);
    s=document.createElement('div');s.id='ask-sheet';s.setAttribute('role','alertdialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-labelledby','ask-title');s.tabIndex=-1;
    s.addEventListener('keydown',askKey);document.body.append(b,s)}
  return {b,s}}
/* Escape answers no; Tab stays inside the sheet */
function askKey(e){if(!asking)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();askAnswer(false);return}
  if(e.key!=='Tab')return;const f=[...document.querySelectorAll('#ask-sheet button')];if(!f.length)return;
  const at=f.indexOf(document.activeElement),to=e.shiftKey?(at<=0?f.length-1:at-1):(at===f.length-1?0:at+1);e.preventDefault();f[to].focus()}
function askAnswer(v){const a=asking;if(!a)return;asking=null;const {b,s}=askEls();b.classList.remove('on');s.classList.remove('on');
  try{if(a.last&&a.last.isConnected)a.last.focus({preventScroll:true})}catch{}
  a.done(!!v)}
/* the first paragraph of the message is the question (bold), the rest the explanation; a question asked while another is up answers that one no */
function askConfirm(message,opt){const o={...ASK_NONE,...(opt||{})};if(asking)askAnswer(false);
  const parts=String(message).split(/\n\s*\n/),{b,s}=askEls();
  s.innerHTML=`<p class="ask-q" id="ask-title">${uiEsc(parts[0])}</p>${parts.slice(1).map(t=>`<p class="ask-more">${uiEsc(t)}</p>`).join('')}
<div class="ask-btns">${o.cancel?`<button type="button" id="ask-cancel" onclick="askAnswer(false)">${uiEsc(o.cancel)}</button>`:''}<button type="button" id="ask-ok" class="${o.danger?'ask-danger':'pri'}" onclick="askAnswer(true)">${uiEsc(o.ok)}</button></div>`;
  return new Promise(done=>{asking={done,last:document.activeElement};b.classList.add('on');s.classList.add('on');
    const f=s.querySelector(o.danger&&o.cancel?'#ask-cancel':'#ask-ok');if(f)f.focus({preventScroll:true})})}
/* a notice: nothing to answer, so a toast, kept up long enough to read (about 15 characters a second, 4 to 9 seconds) */
function tell(message,ms){if(typeof toast==='function')toast(String(message),ms||Math.min(9000,Math.max(4000,String(message).length*70)))}

/* ---- connection ---- */
const NEED_CONN='Needs a connection (Settings → Connection).';
const isConnected=()=>!!((localStorage.getItem('worker_url')||'').trim()&&(localStorage.getItem('app_token')||'').trim());
/* a button that needs the server: its row is hidden while the app is not connected -> true when it was hidden. A switched-off
   button with "Needs a connection" under it made the app look broken to someone who had not connected yet; the sections that
   only work connected say once, at their top, what connecting turns on (renderConnUI, body.nocon in styles.css). */
function needConn(btn){if(!btn)return false;const off=!isConnected(),box=btn.closest('.sactions,.btns,.render-ctl')||btn;
  box.classList.toggle('connhide',off);
  if(btn.classList.contains('needconn')){btn.classList.remove('needconn');btn.removeAttribute('title')}
  return off}
/* the reason as a line of text ('' when connected) */
const connNote=()=>isConnected()?'':`<p class="connnote">${NEED_CONN}</p>`;
/* Settings → Connection: its one-line summary, and the box at its top. Not connected: what a connection adds, and a field for the
   invite link (the address and the code themselves are under Advanced). Who is connected is the account box under it (account.js). */
function connSummary(){if(!isConnected())return 'Not connected';const m=typeof acct!=='undefined'&&acct&&acct.me;
  return m?(m.role==='owner'?'Connected as the owner':'Connected as '+(m.name||'a tester')):'Connected'}
let connMsg='',connBusy=false;
function renderConnUI(){const el=document.querySelector('#conn-box');if(!el)return;const typed=el.querySelector('#conn-link')?el.querySelector('#conn-link').value:'';
  el.innerHTML=isConnected()?`<p class="shelp" id="conn-state"><span class="conn-tick" aria-hidden="true">✓</span> Photos of your clothes are read automatically, outfit photos can be made, and your wardrobe is backed up.</p>`
   :`<p class="shelp" id="conn-state">The app works without a connection: you add your items by hand. With an invite link, photos of your clothes are read automatically, realistic outfit photos can be made, and your wardrobe is backed up.</p>
<div class="sform"><input type="text" id="conn-link" placeholder="Paste your invite link" aria-label="Invite link" autocomplete="off" autocapitalize="off" spellcheck="false" onkeydown="if(event.key==='Enter'){event.preventDefault();connPaste()}"><button type="button" class="pri" id="conn-go" onclick="connPaste()"${connBusy?' disabled':''}>${connBusy?'Connecting…':'Connect'}</button></div>
<p class="shelp conn-msg" id="conn-msg" role="status">${uiEsc(connMsg)}</p>`;
  if(typed&&el.querySelector('#conn-link'))el.querySelector('#conn-link').value=typed;
  for(const ph of document.querySelectorAll('.conn-off-note'))ph.innerHTML=isConnected()?'':`${uiEsc(ph.dataset.what||'This')} needs a connection. <button type="button" class="linkbtn" onclick="goConnect()">Connect</button>`;
  if(typeof applyRole==='function')applyRole()}
/* from a section that needs the server: open Connection and put the cursor in the invite-link field */
function goConnect(){if(typeof toggleCat!=='function')return;const c=document.querySelector('#sc-connection');if(c&&!c.classList.contains('open'))toggleCat('connection');
  setTimeout(()=>{const f=document.querySelector('#conn-link');if(f){f.scrollIntoView({block:'center',behavior:'smooth'});f.focus({preventScroll:true})}},350)}
/* the Add tab: "Several items" finds the items in one photo on the server, so it is switched off (with the reason) while not connected */
const ADD_GROUP_SUB='One photo of a rail, a pile or a few on hangers';
function addGate(){const l=document.querySelector('#add-group'),s=document.querySelector('#add-group-sub'),inp=l&&l.querySelector('input');if(!l||!s||!inp)return;const off=!isConnected();
  l.classList.toggle('connhide',off);l.classList.remove('needconn');l.removeAttribute('aria-disabled');inp.disabled=off;s.textContent=ADD_GROUP_SUB}   // not connected: the card is not shown
async function connPaste(){const inp=document.querySelector('#conn-link'),t=(inp&&inp.value||'').trim();if(!t||connBusy)return;
  connBusy=true;connMsg='';renderConnUI();let ok=false;
  try{ok=typeof connectFromLink==='function'&&!!(await connectFromLink(t))}catch(e){ok=false}
  connBusy=false;connMsg=ok?'':'That link didn’t work. Check that you copied all of it.';renderConnUI();
  if(ok&&typeof renderSettingsExtras==='function')renderSettingsExtras()}

/* ---- Settings: what only the owner needs sits in an "Advanced" fold inside its category, closed until tapped ---- */
function advToggle(btn){const f=btn.closest('.adv');if(!f)return;const open=!f.classList.contains('open');f.classList.toggle('open',open);btn.setAttribute('aria-expanded',open)}
function advClose(){for(const f of document.querySelectorAll('#settings-modal .adv.open')){f.classList.remove('open');const b=f.querySelector('.adv-head');if(b)b.setAttribute('aria-expanded','false')}}
