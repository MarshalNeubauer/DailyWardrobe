// Shared state has one owner (Round B, 2026-11-17, the code review's CR-7-07 ratchet): the page scripts share one global scope, so any
// file can assign another file's `let` or function (`cache={}` was written from 16 files, `todayStale` from 8). This reads index.html's
// scripts in Node (acorn + eslint-scope, no browser, about a second) and finds every assignment to a top-level `let`/`var`/function
// made by a file other than the one that declares it. Each one must be in ALLOW below, with its exact count:
// - a new cross-file write fails: give the state's owner a function and call that (planDirty, todayDirty, setWardrobe);
// - a write that went away fails too, until its allowance is lowered or removed: the list only shrinks, so it stays the true picture.
// A page script that is an ES module (type="module": none yet) owns the names it bridges onto globalThis (tests/modscope.js), since
// those are what another file can still assign: a function or `let` handed over with Object.assign, a getter/setter pair. A name
// keeps its owner file through the conversion, so the allowances carry over. A module's writes to other files' names count as before.
const fs=require('fs'),path=require('path');
const acorn=require('acorn'),escope=require('eslint-scope');
const modscope=require('./modscope');

/* name -> {writing file: number of writes}: the writes on main when this test came (2026-11-17), lowered as owners take them over */
const ALLOW={
  items:{'analysis.js':4},
  aiModel:{'add.js':1},
  aiError:{'add.js':2},
  kitNoMine:{'itemsheet.js':2},
  flt:{'itemsheet.js':1},
  listOpen:{'history.js':1},
  climate:{'weather.js':4,'today.js':1},
  weather:{'weather.js':3,'today.js':1},
  swapMsg:{'today.js':1},
  sel:{'month.js':1,'start.js':1,'today.js':4},
  view:{'month.js':1,'start.js':1,'today.js':4},
  monthOpen:{'today.js':4},
  remoteKeys:{'today.js':1},
  pastEdit:{'today.js':1},
  todayPullWait:{'today.js':2},
  scoreOpen:{'today.js':1},
  dayRecs:{'pack.js':2,'today.js':2},
  addFor:{'start.js':2},
  setSeen:{'start.js':2},
  asmOut:{'asm-color.js':2},
  viewStale:{'sync.js':1},
  clockSkew:{'sync.js':1},
  storeToldAt:{'sync.js':1},
  restoring:{'snapshots.js':1},
  dbWiping:{'about.js':2},
  connReady:{'about.js':2},
  dbConn:{'about.js':1},
  dbCur:{'about.js':1},
};

/* {files, owner: name -> file, seen: name -> {writing file: n}, where: 'name file' -> [lines]} for the app in ROOT */
function measure(ROOT){
  const tags=modscope.pageScripts(ROOT),files=tags.map(t=>t.src),mod=Object.fromEntries(tags.map(t=>[t.src,t.module]));
  const asts={},srcs={};
  for(const f of files){srcs[f]=fs.readFileSync(path.join(ROOT,f),'utf8');asts[f]=acorn.parse(srcs[f],{ecmaVersion:'latest',sourceType:mod[f]?'module':'script',locations:true,ranges:true})}
  /* who declares each mutable top-level name (a module: who bridges it) */
  const owner={};
  for(const f of files){
    if(mod[f]){const kind=new Map(modscope.declared(asts[f]).map(d=>[d.name,d.kind]));
      for(const [n,how] of modscope.bridged(asts[f],srcs[f]).names)if(how==='accessor'||!/^(?:const|class|import)$/.test(kind.get(n)||''))owner[n]=f;
      continue}
    for(const st of asts[f].body){
    if(st.type==='FunctionDeclaration')owner[st.id.name]=f;
    else if(st.type==='VariableDeclaration'&&st.kind!=='const')for(const d of st.declarations)if(d.id.type==='Identifier')owner[d.id.name]=f}}
  /* every write to one of them from another file: plain assignments, ++/--, destructuring, and window.name = … */
  const seen={},where={};
  const note=(name,f,line)=>{if(!owner[name]||owner[name]===f)return;
    const a=seen[name]=seen[name]||{};a[f]=(a[f]||0)+1;(where[name+' '+f]=where[name+' '+f]||[]).push(line)};
  for(const f of files){
    const sm=escope.analyze(asts[f],{ecmaVersion:2024,sourceType:mod[f]?'module':'script'}),gs=sm.globalScope;
    for(const sc of sm.scopes)for(const r of sc.references){
      if(r.resolved&&r.resolved.scope!==gs)continue;   // a local of the same name
      if(!r.isWrite()||r.init&&sc===gs)continue;        // its own declaration
      note(r.identifier.name,f,r.identifier.loc.start.line)}
    (function walk(n,parent){if(!n||typeof n.type!=='string')return;
      if(n.type==='MemberExpression'&&!n.computed&&n.object.type==='Identifier'&&/^(window|self|globalThis)$/.test(n.object.name)&&parent&&(parent.type==='AssignmentExpression'&&parent.left===n||parent.type==='UpdateExpression'))note(n.property.name,f,n.loc.start.line);
      for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(c=>walk(c,n));else if(v&&typeof v.type==='string')walk(v,n)}})(asts[f],null);
  }
  return {files,owner,seen,where};
}

module.exports=async({ok,ROOT})=>{
  const {files,owner,seen,where}=measure(ROOT);
  // (over 1,000 before the painter's files became modules, C3: a module's names it keeps to itself are no other file's to write)
  ok(files.length>40&&Object.keys(owner).length>900,`index.html's ${files.length} scripts read, ${Object.keys(owner).length} mutable top-level names`);
  const fresh=[],over=[],under=[];
  for(const [name,by] of Object.entries(seen))for(const [f,n] of Object.entries(by)){
    const allowed=(ALLOW[name]||{})[f]||0,at=`${f}:${where[name+' '+f].join('/')}`;
    if(!allowed)fresh.push(`${name} (declared in ${owner[name]}) written by ${at}`);
    else if(n>allowed)over.push(`${name} by ${f}: ${n} writes, ${allowed} allowed (${at})`)}
  for(const [name,by] of Object.entries(ALLOW))for(const [f,n] of Object.entries(by)){
    const now=(seen[name]||{})[f]||0;if(now<n)under.push(`${name} by ${f}: ${now} now, ${n} allowed`)}
  ok(!fresh.length,'no file writes another file\'s shared state outside the allow-list'+(fresh.length?': '+fresh.join('; ')+' (call the owner\'s function instead: planDirty(), todayDirty(), setWardrobe())':''));
  ok(!over.length,'no allowed writer writes more often than it did'+(over.length?': '+over.join('; '):''));
  ok(!under.length,'the allow-list only shrinks: every allowance is still used'+(under.length?' (lower or remove in tests/globals.test.js: '+under.join('; ')+')':''));
  ok(!seen.cache&&!seen.todayStale,'the plan cache and "redraw Today later" are written only by their owners (today.js planDirty, settings.js todayDirty)');
  ok(!seen.settings&&Object.keys(seen.items||{}).join()==='analysis.js'&&Object.keys(seen.dayRecs||{}).sort().join()==='pack.js,today.js','the wardrobe, history and settings are set through core.js setWardrobe (only the planner\'s brief swaps in analysis.js, pack.js packPlanOf and today.js planWith remain)');
  ok(!seen.renderSettingsExtras,'no script replaces another\'s function (account.js and remind.js register their parts of Settings with settingsPart)');
};
module.exports.measure=measure;
