// One copy of the merge rules (the code review's CR-6-12 / CR-5-12, Round B, 2026-11-17): merge.js is loaded by the app as a classic
// script before core.js and imported by the worker (worker/backup.js). The same cases go through both, the app's mergeState (merge.js +
// core.js, as the page loads them) and the server's mergeLite: thousands of seeded random snapshots (items with and without field stamps,
// deletions, days with picks and the week's lock, settings stamped setting by setting and entry by entry), each merged both ways round.
// Then the few ways the server always differed on purpose, and that no copy of the rules is left in core.js or worker/backup.js.
const fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');
const {appSrc}=require('./appsrc');
module.exports=async({ok,ROOT})=>{
  const R=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const ctx={console,localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return null}}};vm.createContext(ctx);
  vm.runInContext(appSrc(ROOT,'merge.js','core.js')+';this.K={mergeState,stateSig,keySettings,stampSettings,itemFields,dayFields}',ctx);
  const K=ctx.K,{mergeLite}=await import(pathToFileURL(path.join(ROOT,'worker','backup.js')).href),J=o=>JSON.parse(JSON.stringify(o));
  // the page's objects come from another realm: compare as JSON
  const app=(a,b)=>JSON.stringify(K.mergeState(J(a),J(b))),srv=(a,b)=>JSON.stringify(mergeLite(J(a),J(b)));

  /* ---- seeded random snapshots, of the shapes today's apps save ---- */
  let seed=20261117;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff,pick=a=>a[Math.floor(rnd()*a.length)],chance=p=>rnd()<p;
  const NOW=Date.now(),T=()=>pick([1000,2000,2000,5000,6000,NOW-1000,NOW-200*864e5,NOW,NOW+5]);
  const item=()=>{const it={id:pick(['a','b','c']),type:pick(['tie','shirt']),updated:T()};if(chance(.7))it.added=pick([500,1000]);
    if(chance(.6))it.name=pick(['A','B','C']);if(chance(.5))it.primaryColor=pick(['navy','red']);if(chance(.3))it.paused=true;
    if(chance(.5)){const cur=item();cur.id=it.id;K.itemFields(it,cur)}else if(chance(.1))it.fs={u:3,b:T(),s:{name:T()}};   // (an fs that isn't its own: counted whole)
    return J(it)};
  const day=()=>{const d={date:pick(['2026-11-16','2026-11-17']),updated:T()};
    if(chance(.5))d.force={tie:pick(['a','b'])};if(chance(.4))d.ids={tie:pick(['a','b']),shirt:'c'};if(chance(.3))d.skip={belt:true};
    if(chance(.3)){d.lock={tie:pick(['a','b'])};if(chance(.5)){d.lockOnly=true;d.base=T()}if(chance(.5))d.lockAt=T()}
    if(chance(.4)){const cur=day();cur.date=d.date;K.dayFields(d,cur)}return J(d)};
  const SB={workdays:[0,1,2,3,4],blazerDays:[4],care:{suit:6},custom:{colors:[{key:'ownx',name:'X',hex:'#123456',base:'navy',types:['tie']}],patterns:[]},daysOff:[{d:'2026-12-01',n:'a'}],ownMaterials:{shirt:['cupro']},units:'C',updated:1000};
  const settings=()=>{const s=K.keySettings(J(SB));
    const ed=[()=>{s.units=pick(['F','K'])},()=>{s.workdays=pick([[0,1,2],[0,1,2,3,4,5]])},()=>{s.care={...s.care,[pick(['tie','blazer'])]:pick([3,5])}},
      ()=>{s.custom={...s.custom,colors:[...s.custom.colors,{key:'own'+pick(['y','z']),name:'Y',hex:'#654321',base:'red',types:['tie']}]}},()=>{delete s.units},
      ()=>{s.daysOff=[...s.daysOff,{d:pick(['2026-12-24','2026-12-25']),n:'b'}]},()=>{s.ownMaterials={shirt:['cupro',pick(['ramie','tencel'])]}}];
    for(let i=0,n=1+Math.floor(rnd()*3);i<n;i++){pick(ed)();if(chance(.7))K.stampSettings(s,T()+i)}return J(s)};
  const snap=()=>({items:Array.from({length:Math.floor(rnd()*4)},item),tombstones:chance(.6)?{[pick(['a','b','c'])]:T()}:{},days:Array.from({length:Math.floor(rnd()*3)},day),...(chance(.85)?{settings:settings()}:{})});
  {const N=3000;let same=0,first='';
    for(let i=0;i<N;i++){const a=snap(),b=snap();const x=[app(a,b),srv(a,b)],y=[app(b,a),srv(b,a)];if(x[0]===x[1]&&y[0]===y[1])same++;else if(!first)first=JSON.stringify({a,b,app:x[0],server:x[1]}).slice(0,600)}
    ok(same===N,`app and server merge ${N} random wardrobes alike, either way round (items field by field, deletions, days and the week's lock, settings entry by entry): ${same} of ${N}${first?' '+first:''}`);}
  {const s=snap(),ss=J(s);ok(K.stateSig(s)===K.stateSig(ss)&&typeof K.stateSig(s)==='string','(stateSig, the "did the merge change anything" fingerprint, is the shared one)');}

  /* ---- what the server always did its own way (merge.js mergeStateBy's options) ---- */
  {const smp={id:'s1',type:'tie',sample:true,updated:5},mine={id:'s2',type:'tie',sample:true,sampleMine:true,updated:5};
    const a=JSON.parse(app({items:[smp,mine]},{})),s=JSON.parse(srv({items:[smp,mine]},{}));
    ok(a.items.length===2&&s.items.map(i=>i.id).join()==='s2','a sample piece the person never made his stays on the phone: the app keeps it, the server never keeps it (sampleOnly)');}
  {const junk={items:[null,{type:'tie'},{id:'k',type:'tie',updated:9}],days:[null,{worn:true},{date:'2026-11-16',updated:3}],tombstones:{z:String(NOW)}};
    const s=JSON.parse(srv({},junk));let threw=false;try{K.mergeState({},J(junk))}catch(e){threw=true}
    ok(s.items.length===1&&s.days.length===1&&s.tombstones.z===NOW&&threw,'what a save sends comes from anywhere: the server passes over a record that isn\'t one and reads a deletion mark as a number; the app (cleanState first) never sees one');}
  {const o1={units:'C',updated:5},o2={units:'F',updated:9},a=JSON.parse(app({settings:o1},{settings:o2})).settings,s=JSON.parse(srv({settings:o1},{settings:o2})).settings;
    ok(a.units==='F'&&s.units==='F'&&a.ks&&a.ks.units===9&&!s.ks,'two settings copies from before setting stamps: the newer whole on both, the app keys it as it reads it (keySettings)');}
  {const s1={units:'C',updated:7,ks:{units:'9'},kh:{}},s2={units:'F',updated:6,ks:{units:9},kh:{}};
    ok(JSON.parse(srv({settings:s1},{settings:s2})).settings.units==='C'&&JSON.parse(app({settings:s1},{settings:s2})).settings.units==='F','a setting\'s stamp stored as text: the server reads it as a number, the app as it is (as each always did)');}

  /* ---- one copy ---- */
  const core=R('core.js'),bk=R('worker/backup.js'),idx=R('index.html'),aw=R('analysis-worker.js'),merge=R('merge.js');
  const RULES=['mergeItem','mergeDay','dayWins','setEntries','setJoin','mergeSplit','setHash','dayFlat','fsPack','sameVal','subOk'];
  const defs=(src,n)=>new RegExp(`(?:function\\s+${n}\\s*\\(|(?:const|let|var)\\s+${n}\\s*=)`).test(src);
  ok(RULES.every(n=>defs(merge,n)&&!defs(core,n)&&!defs(bk,n))&&!/\w+Lite\s*\(a, b, k, hi\)|function mergeItemLite|function mergeSettingsLite/.test(bk),
    'the merge rules are written once, in merge.js: neither core.js nor worker/backup.js defines them ('+RULES.filter(n=>defs(core,n)||defs(bk,n)).join(', ')+')');
  ok(/^import '\.\.\/merge\.js';$/m.test(bk)&&/globalThis\.DW_MERGE/.test(bk)&&/^globalThis\.DW_MERGE=\{/m.test(merge),'the worker imports merge.js and takes its functions from globalThis.DW_MERGE');
  const pageList=require('./scriptlist').scriptList(idx);   // (however the tags are written: they carry defer now)
  ok(pageList.indexOf('merge.js')>=0&&pageList.indexOf('merge.js')<pageList.indexOf('core.js')&&/importScripts\('merge\.js','core\.js'/.test(aw),
    'the page and the What to buy worker load merge.js before core.js');
  ok(!/^\s*(?:import|export)\b/m.test(merge)&&!/\b(?:document|window|localStorage|indexedDB)\b/.test(merge.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'')),
    'merge.js stays a plain script with nothing of the page in it (no import/export, DOM or storage), so the page, a Web Worker, the server and Node all load it');
};
