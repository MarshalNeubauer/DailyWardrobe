// The notice board (bus.js; the restructure, step 0's pilot, 2026-11-25): how a file tells a screen something without naming it.
// Node only. bus.js itself (pin order, one throw doesn't stop the rest, the first error thrown on, heard), and the topics the app
// uses: TOPICS lists each with who announces it and who listens, and the test fails on a topic the files use that isn't listed, a
// listed announcer or listener that no longer does it, a listener with nobody announcing, or an announcement nobody hears.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {appSrc}=require('./appsrc');

/* topic -> {emit: files that announce it, on: files that pin for it (in load order), what: what it means} */
const TOPICS={
  'settings-open':{emit:['settings.js'],on:['ui.js','sync-status.js'],what:'Settings is opening: the Advanced folds close, the Backup line is written'},
  'settings-draw':{emit:['settings.js'],on:['daysoff.js','weather.js','ui.js','dress.js','own-lists.js','care.js'],what:'Settings is drawn: each part draws its own rows'},
  'settings-summaries':{emit:['settings.js'],on:['weather.js','daysoff.js','ui.js','dress.js','account.js','calendar.js','remind.js'],what:'the category summaries are written: parts fill in what only they know'},
  'settings-parts':{emit:['settings.js'],on:['look.js','account.js','calendar.js','remind.js'],what:'the parts drawn last (settingsPart)'},
  'settings-category':{emit:['settings.js'],on:['care.js','snapshots.js','about.js'],what:'a category opened (its key)'},
  'settings-saved':{emit:['settings.js'],on:['sync.js'],what:'the settings were stored: a backup soon'},
  'settings-closed':{emit:['settings.js'],on:['start.js'],what:'Settings closed (the page a sync changed meanwhile, or null)'},
  'connection-saved':{emit:['settings.js'],on:['sync.js'],what:'Done stored the connection: a backup now'},
  'connection-typed':{emit:['settings.js'],on:['account.js'],what:'another address or code typed in Connection: the account decides'},
};

/* name -> {serve: files that serve it (one), ask: files that ask for it (in load order), what: what it does}. A socket is how a
   required file calls into an optional one without importing it (tests/load-contract.json); none is used yet (step 3 converts
   the callers) */
const SOCKETS={};

module.exports=async({ok,ROOT})=>{
  /* bus.js itself, run as a script with its export blanked */
  const ctx=vm.createContext({});vm.runInContext(appSrc(ROOT,'bus.js')+';this.B={on,emit,heard,serve,ask}',ctx);
  const {on,emit,heard,serve,ask}=ctx.B,log=[];
  /* the sockets */
  ok(ask('nobody',1,2)===undefined,'ask for a name nobody serves: nothing is called and the answer is undefined (the old typeof guard)');
  const seen=[];serve('sum',(a,b)=>{seen.push([a,b]);return a+b});
  ok(ask('sum',2,3)===5&&seen.length===1&&seen[0].join()==='2,3','ask calls what is served once, with the arguments, and gives back its answer');
  serve('sum',(a,b)=>a*b);ok(ask('sum',2,3)===6,'the last fn served under a name is the one asked');
  serve('nofn',undefined);ok(ask('nofn')===undefined,'serving something that is not a function serves nothing');
  const sboom=new Error('sboom');serve('throws',()=>{throw sboom});let sgot=null;try{ask('throws')}catch(e){sgot=e}
  ok(sgot===sboom,'an error the served fn throws reaches the one who asked, as a direct call\'s would');
  on('pinned',()=>'heard');ok(emit('sum')===0&&!heard('sum')&&ask('pinned')===undefined&&emit('pinned')===1,'sockets and topics are apart: a served name is no topic, a pinned topic no socket');
  ok(emit('nobody')===0&&!heard('nobody'),'a topic nobody pinned: emit calls nothing and says 0, heard is false');
  const a=x=>log.push('a'+x),b=x=>log.push('b'+x);on('t',a);on('t',b);on('t',a);
  ok(emit('t',1)===2&&log.join()==='a1,b1'&&heard('t'),'each pinned fn is called once, in pin order, with the arguments');
  log.length=0;const boom=new Error('boom'),late=new Error('late');on('u',()=>{log.push(1);throw boom});on('u',()=>log.push(2));on('u',()=>{log.push(3);throw late});
  let got=null;try{emit('u')}catch(e){got=e}
  ok(got===boom&&log.join()==='1,2,3','one that throws does not stop the others, and the first error is thrown on once all have run');
  log.length=0;on('v',()=>{on('v',()=>log.push('new'));log.push('first')});emit('v');
  ok(log.join()==='first','a fn pinned while the topic is being announced is called from the next announcement on');
  /* the topics the app uses */
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),page=[...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
  const used={},sockUsed={};
  const acorn=require('acorn');
  for(const f of page){if(f==='bus.js')continue;const src=fs.readFileSync(path.join(ROOT,f),'utf8');let ast;
    try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'})}catch(e){try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'})}catch(e2){continue}}
    // local name -> bus.js's name (a file that also reads app.js's own ask() imports bus.js's as another name: {ask as askFor})
    const imp=new Map(ast.body.filter(s=>s.type==='ImportDeclaration'&&s.source.value==='./bus.js').flatMap(s=>s.specifiers.map(x=>[x.local.name,x.imported?x.imported.name:x.local.name])));
    const add=(k,t)=>{const u=used[t]=used[t]||{emit:[],on:[],heard:[]};if(!u[k].includes(f))u[k].push(f)};
    const sock=(k,t)=>{const u=sockUsed[t]=sockUsed[t]||{serve:[],ask:[]};if(!u[k].includes(f))u[k].push(f)};
    const walk=n=>{if(!n||typeof n.type!=='string')return;
      if(n.type==='CallExpression'&&n.callee.type==='Identifier'){const c=imp.get(n.callee.name)||null,a=n.arguments[0],lit=a&&a.type==='Literal'&&typeof a.value==='string';
        // (settingsPart(fn) is settings.js's own way to pin for 'settings-parts': counted as the caller's pin)
        if(n.callee.name==='settingsPart'&&f!=='settings.js')add('on','settings-parts');
        else if(c&&/^(?:emit|on|heard)$/.test(c)&&lit&&!(f==='settings.js'&&c==='on'&&a.value==='settings-parts'))add(c,a.value);
        else if(c&&/^(?:serve|ask)$/.test(c)){if(lit)sock(c,a.value);else ok(false,`${f} calls ${n.callee.name}() of bus.js with a name that is not a plain string`)}
        else if(!c&&/^(?:emit|heard|serve)$/.test(n.callee.name))ok(false,`${f} calls ${n.callee.name}() without importing it from './bus.js'`)}
      for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v)}};
    walk(ast)}
  const sockNotListed=Object.keys(sockUsed).filter(t=>!SOCKETS[t]);
  ok(!sockNotListed.length,`every socket the files use is in SOCKETS${sockNotListed.length?': not '+sockNotListed.join(', '):''}`);
  const sbad=[];
  for(const [t,d] of Object.entries(SOCKETS)){const u=sockUsed[t]||{serve:[],ask:[]};
    if(u.serve.length!==1||u.serve[0]!==d.serve)sbad.push(`${t}: served by ${u.serve.join(', ')||'nobody'}, listed ${d.serve}`);
    const order=[...u.ask].sort((x,y)=>page.indexOf(x)-page.indexOf(y));
    if(order.join()!==[...d.ask].sort((x,y)=>page.indexOf(x)-page.indexOf(y)).join()||!order.length)sbad.push(`${t}: asked by ${order.join(', ')||'nobody'}, listed ${d.ask.join(', ')}`)}
  ok(!sbad.length,`each socket is served by the one file SOCKETS lists and asked by the files it lists (${Object.keys(SOCKETS).length} sockets)${sbad.length?': '+sbad.join('; '):''}`);
  const notListed=Object.keys(used).filter(t=>!TOPICS[t]);
  ok(!notListed.length,`every topic the files use is in TOPICS${notListed.length?': not '+notListed.join(', '):''}`);
  const bad=[];
  for(const [t,d] of Object.entries(TOPICS)){const u=used[t]||{emit:[],on:[],heard:[]};
    const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
    if(!same([...u.emit].sort(),[...d.emit].sort()))bad.push(`${t}: announced by ${u.emit.join(', ')||'nobody'}, listed ${d.emit.join(', ')}`);
    const order=[...u.on].sort((x,y)=>page.indexOf(x)-page.indexOf(y));
    if(!same(order,[...d.on].sort((x,y)=>page.indexOf(x)-page.indexOf(y))))bad.push(`${t}: pinned by ${order.join(', ')||'nobody'}, listed ${d.on.join(', ')}`);
    if(!d.emit.length||!d.on.length)bad.push(`${t}: needs an announcer and a listener`);
    for(const f of d.emit)if(page.indexOf(f)<0)bad.push(`${t}: ${f} is not a page script`)}
  ok(!bad.length,`each topic is announced and heard by the files TOPICS lists${bad.length?': '+bad.join('; '):''}`);
  ok(page.indexOf('bus.js')>=0&&page.indexOf('bus.js')<page.indexOf('core.js'),'bus.js is a page script, before core.js (it reads no other file)');
  // (offline, a deep link gets each file from the root's copy, so a module imported by another can run a second time: harmless only for
  // a file that keeps nothing on the page; see RESTRUCTURE-PLAN.md, step 5)
  const bus=fs.readFileSync(path.join(ROOT,'bus.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  ok(!/\b(?:globalThis|window|self|document|localStorage|addEventListener)\b|^\s*import\b/m.test(bus),'bus.js keeps nothing on the page and imports nothing (a second copy of it, as an offline deep link makes, is harmless)');
  const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  ok(/'bus\.js'/.test(sw),'bus.js is in sw.js ASSETS (offline)');
};
module.exports.TOPICS=TOPICS;
module.exports.SOCKETS=SOCKETS;
