/* Daily Wardrobe: the phone's Back (the iPhone's edge swipe, Android's Back button, a browser's Back): one history stack for the whole app
   (Round B, the code review's CR-7-08, 2026-11-17: it was three systems, in start.js, itemsheet.js and the color sheet's own listener, each
   reading the others' flags). An ES module, loaded right after app.js; every page and sheet that Back closes registers here (backOn), and nothing else
   in the app calls history.pushState or history.back.
   - BACK holds the app's own history entries, oldest first, at most two: the item sheet's (kind 'item') and one app entry, whose kind says
     who holds it now ('set' Settings, 'sub' Add or the Packing list, 'setup', 'pick', 'shop', and the sheets that borrow it:
     'ask', 'cu', 'rd', 'kit', 'nps'). A page and the sheet over it share that one entry, so Back never needs two presses.
   - Back takes the latest entry and runs what its kind registered (backOn); the page under it keeps its own entry.
   - Left any other way (Done, ×, a tab) an entry is taken away with a history.back() of our own (backPend), which the listener lets pass;
     an entry asked for meanwhile waits (backWant; the item sheet's: backLand) and is made once that step back has landed.
   - A sheet with no entry of its own (the color sheet) is asked first (backOver): it closes and the entry Back took is put back. */
const BACK=[];   // our entries, oldest first: {kind}
const BACK_ON={};   // kind -> what Back does when it takes that entry (backOn); a kind with none does what Settings' does
const BACK_OVER=[];   // asked before any entry's own: true when it took the Back (backOver)
const BACK_LAND=[];   // run when a step back of our own has landed (backLand)
const backPend={app:false,item:false};   // a history.back() of ours is on its way, taking the app entry or the item sheet's away
let backKeep=false;   // the app entry stays through a page change (backHold: a page opened from Settings going back to Settings)
/* an app entry asked for while a step back of ours is on its way, or while the address still holds an invitation (#invite: the entry would
   keep it, and Back would land on it again), waits here and is made once that is over (backWanted; account.js dropInviteHash) */
let backWant='';
let backWait=[];   // what waits for our step back to land (backSettled)
/* what BACK holds, for the tests and the console (kept by backSync; the app itself asks backKind) */
let appHist=false,appKind='',itemHist=false;
try{history.scrollRestoration='manual'}catch{}   // stepping back must not move the Wardrobe (the page scrolls it to the item it closes on)
const backApp=()=>BACK.find(x=>x.kind!=='item');
const backItem=()=>BACK.find(x=>x.kind==='item');
/* whose the app entry is ('' with none), and the kind of the latest entry of ours */
const backKind=()=>{const a=backApp();return a?a.kind:''};
const backTop=()=>BACK.length?BACK[BACK.length-1].kind:'';
const inviteInUrl=()=>/(^#|&)invite=/.test(location.hash);
function backOn(kind,f){BACK_ON[kind]=f}
function backOver(f){BACK_OVER.push(f)}
function backLand(f){BACK_LAND.push(f)}
function backOut(e){const i=BACK.indexOf(e);if(i>=0)BACK.splice(i,1)}
function backSync(){appHist=!!backApp();appKind=backKind();itemHist=!!backItem()}
/* the app entry for kind: made, or taken over when there is one already */
function backPush(kind){const a=backApp();if(a)a.kind=kind;
  else if(backPend.app||backPend.item||inviteInUrl())backWant=kind;
  else try{history.pushState({app:kind},'');BACK.push({kind});backWant=''}catch{}
  backSync()}
/* the app entry goes (with a step back of our own), if kind holds it */
function backDrop(kind){if(backWant===kind)backWant='';const a=backApp();if(!a||backKeep||a.kind!==kind)return;
  backOut(a);backSync();backPend.app=true;try{history.back()}catch{backPend.app=false}}
/* a sheet over a page that holds the entry (a question over Settings, the import sheet over Add) borrows it: -> whose it was ('' when the
   sheet made its own); an entry still waiting in backWant is taken over the same way */
function backBorrow(kind){const a=backApp();if(a&&a.kind!==kind){const was=a.kind;a.kind=kind;backSync();return was}
  if(!a&&backWant&&backWant!==kind){const was=backWant;backWant=kind;return was}
  backPush(kind);return ''}
/* the sheet closes: by a tap it hands the entry back to whose it was (or takes its own away); by Back (fromBack) the entry is gone already,
   so the page under it gets a new one */
function backReturn(kind,was,fromBack){if(fromBack){if(was)backPush(was);return}
  if(backWant===kind){backWant=was||'';return}if(!was)return backDrop(kind);const a=backApp();if(a&&a.kind===kind){a.kind=was;backSync()}}
/* f runs with the app entry kept through it (keep) */
function backHold(keep,f){backKeep=keep;try{return f()}finally{backKeep=false}}
/* waits for a step back of ours to land (or 400 ms): a question's answer runs after it, so what the answer does (a reload on Clear and
   switch, another entry) never races the step back (WebKit applied the step back to the reloaded page) */
const backSettled=()=>backPend.app?new Promise(r=>{backWait.push(r);setTimeout(r,400)}):null;
function backWanted(){const k=backWant;backWant='';if(k)backPush(k)}
/* the item sheet's entry: made once (asked for while a step back of ours is on its way: when it lands, backLand), and taken away */
function histPush(){if(backItem()||backPend.item||backPend.app)return;try{history.pushState({item:1},'');BACK.push({kind:'item'});backSync()}catch{}}
function histDrop(){const e=backItem();if(!e)return;backOut(e);backSync();backPend.item=true;try{history.back()}catch{backPend.item=false}}
/* the phone's Back, or a step back of our own landing */
function backPop(){
  if(!backPend.app&&!backPend.item){const had=BACK.length>0,top=backTop();
    if(BACK_OVER.some(f=>f(top))){if(had)try{history.pushState({cp:1},'')}catch{}return}}   // the color sheet took it: the entry Back took goes back
  let item=false;
  if(backPend.item){backPend.item=false;for(const f of BACK_LAND)f()}   // the item sheet's own step back has landed
  else if(!backPend.app&&!(backApp()&&backTop()!=='item')){const e=backItem();if(e){backOut(e);item=true;BACK_ON.item()}}   // the item sheet's entry is the latest: Back closes the sheet
  if(backPend.app){backPend.app=false;for(const f of BACK_LAND)f();backWanted();for(const f of backWait.splice(0))f();return}   // our own step back of the app entry has landed
  if(!backApp()){if(backWant&&!backPend.item)backWanted();return}
  if(item)return;
  const a=backApp();backOut(a);(BACK_ON[a.kind]||BACK_ON.set)(a.kind)}
addEventListener('popstate',()=>{try{backPop()}finally{backSync()}});
/* An ES module (2026-11-23): its names are its own, and this is what the other scripts and the tests still use as globals (the bridge;
   tests/bridge.test.js lists it). The functions the pages and sheets call, and the three flags the tests read, read-only: only backSync
   writes them, so they have a getter and no setter. A script that is a module too imports them instead (the export below). */
Object.assign(globalThis,{backKind,backOn,backOver,backLand,backPush,backDrop,backBorrow,backReturn,backHold,backSettled,backWanted,histPush,histDrop});
Object.defineProperties(globalThis,{appHist:{get:()=>appHist},appKind:{get:()=>appKind},itemHist:{get:()=>itemHist}});
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,get appHist(){return appHist},get appKind(){return appKind},get itemHist(){return itemHist}};
export {backKind,backOn,backOver,backLand,backPush,backDrop,backBorrow,backReturn,backHold,backSettled,backWanted,histPush,histDrop,appHist,appKind,itemHist};
