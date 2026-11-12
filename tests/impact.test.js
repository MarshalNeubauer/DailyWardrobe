// Test selection (tests/impact.js): which top-level functions and CSS rules an edit touches, which tests then run,
// and that the runner really records what a test uses (also what it ran before a reload).
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process'),I=require('./impact');
module.exports=async({ok,chromium,url,ROOT,impactRec})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'impact-')),sh=(cwd,...a)=>execFileSync('git',a,{cwd,stdio:['ignore','pipe','ignore']}).toString();
  // the hunks git finds between two texts
  const hunks=(a,b)=>{fs.writeFileSync(path.join(dir,'a'),a);fs.writeFileSync(path.join(dir,'b'),b);let d='';
    try{sh(dir,'diff','--no-index','-U0','a','b')}catch(e){d=String(e.stdout)}return I.hunksOf(d,a,b)};
  const js=async(a,b)=>{const r=await I.jsImpact(a,b,hunks(a,b));return [...r.units].sort().join(',')+(r.syms.size?' ~'+[...r.syms].sort().join(','):'')+(r.top?' +top':'')};
  const css=(a,b,known=[])=>{const r=I.cssImpact(a,b,hunks(a,b),n=>!known.includes(n));return [...r.units].sort().join(' | ')+(r.top?' +top':'')};
  try{
    /* JS */
    const A=`/* helpers */\nconst LIMIT=5;\nconst one=a=>{\n  // adds one\n  return a+1};\nfunction two(a){return \`x \${a}  y\`}\nconst three=()=>3,four=()=>4;\ndocument.addEventListener('paste',e=>{handle(e)});\nlet state={};\n`;
    ok(await js(A,A.replace('a+1','a+2'))==='one','an edit inside a function names that function');
    ok(await js(A,A.replace('// adds one','// adds 1').replace('/* helpers */','/* small helpers */'))==='','comment edits, in a function or between them, touch nothing');
    ok(await js(A,A.replace('let state','/* five */\nconst five=()=>{\n  return 5};\nlet state'))==='five','a new function (with its comment) touches no existing one');
    ok(await js(A,A.replace('three=()=>3,','three=()=>3,six=()=>6,'))==='six','a function added in the middle of a line is cut out cleanly');
    ok(await js(A,A.replace('const three=()=>3,four=()=>4;\n',''))==='four,three','a removed function is named, so the tests that ran it are picked');
    ok(await js(A,A.replace('LIMIT=5','LIMIT=6'))===' ~LIMIT'&&await js(A,A.replace('let state={}','let state={a:1}'))===' ~state','a changed constant is followed by its name');
    ok(await js(A,A.replace("'paste',","'drop',"))===' +top'&&await js(A,A.replace('const LIMIT=5','const {LIMIT}={LIMIT:5}'))===' ~LIMIT +top','other top-level code, or a declaration it cannot read, counts as top-level code');
    // following a name: the functions that use it, constants built from it, and top-level code that runs with it
    const F=async(file,syms,src)=>{const m=new Map();for(const [f,t] of Object.entries(src))m.set(f,await I.analyse(t));const r=I.follow(file,new Set(syms),m);
      return [...r.files].map(([f,x])=>f+':'+[...x.units].sort().join(',')+(x.top?'+top':'')).sort().join(' ')};
    const SRC={'a.js':"const LIMIT=5,TEXT='LIMIT is '+LIMIT;\nconst over=n=>n>LIMIT;\nconst say=()=>TEXT;\nconst other=o=>o.LIMIT+'LIMIT'; // LIMIT\n",'b.js':"function far(){return LIMIT*2}\n"};
    ok(await F('a.js',['LIMIT'],SRC)==='a.js:over,say b.js:far','a constant leads to the functions that name it, in every script, and through constants built from it');
    ok(await F('a.js',['LIMIT'],{...SRC,'c.js':'start(LIMIT);\n'})==='a.js:over,say b.js:far c.js:+top','top-level code that names it makes its file top-level');
    ok(await js(A,A.replace('handle(e)','handle(e,1)'))==='@document.addEventListenerpaste','an unnamed listener is named after the code before it');
    ok(await js(A,A.replace('}  y','} y'))==='two'&&await js(A,A.replace('return a+1','return  a+1'))==='','spacing counts inside a string, not in code');
    ok(await js(A,A+'onresize=()=>{};\n')==='onresize +top'&&await js(A,A+'(()=>{state.x=1})();\n')==='@{state.x1} +top','new code that runs at load (an assignment, an IIFE) is top-level code');
    ok(await js(A,A.replace('return a+1}','return a+1'))===' +top','a file that no longer parses selects everything that loads it');
    const M=`const help=x=>x*2;\nexport class Hub {\n  constructor(){this.n=0}\n  bump(){this.n++}\n}\nexport default {\n  async fetch(req){return help(1)}\n};\n`;
    ok(await js(M,M.replace('x*2','x*3'))==='help'&&await js(M,M.replace('this.n++','this.n+=2'))==='bump','an ES module (worker.js) is read too: a helper, a class method');
    const lx=I.jsLex("const u='http://x',r=/a\\/\\/b[/]/,t=`p${`//q`}//r`;f(a/2); // real\n/* also */");
    ok(lx&&lx.com.length===2&&lx.com[0][1]-lx.com[0][0]===7,'// inside strings, patterns and templates is not a comment');
    ok(I.jsLex("const a='x")===null&&I.jsLex('f(){')===null,'a text it cannot follow is not trusted');

    /* a block called on the spot runs at load in every test; its own functions (the listeners it installs) are units */
    const B=A+`(()=>{const el=document;let st=null;\n  el.addEventListener('touchstart',e=>{st=1},{passive:true});\n  el.addEventListener('touchmove',e=>{st=LIMIT},{passive:true});\n  const end=()=>{st=null};\n  el.addEventListener('touchend',end);\n})();\n`,BK='@{consteldocument}';
    const blk=(await I.scan(B)).find(u=>u.kids);
    ok(blk&&blk.n===BK&&blk.kids.map(k=>k.n).join()===[BK+'>@el.addEventListenertouchstart',BK+'>@el.addEventListenertouchmove',BK+'>end'].join(),'a block called on the spot is named after its first statement, and its functions after what they are installed for ('+(blk&&blk.kids.map(k=>k.n.slice(BK.length+1)).join(', '))+')');
    ok(await js(B,B.replace('st=1}','st=5}'))===BK+'>@el.addEventListenertouchstart','an edit inside one of its listeners names that listener only');
    ok(await js(B,B.replace('st=null};','st=0};'))===BK+'>end'&&await js(B,B.replace('// adds one','// adds 1'))==='','so does an edit inside a function it declares; a comment still touches nothing');
    ok(await js(B,B.replace('let st=null','let st=0'))===BK&&await js(B,B.replace("el.addEventListener('touchend',end);","el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);"))===BK,'an edit to the block\'s own code (it runs at load) names the block: every test that loads the file');
    ok(await js(B,B.replace("  const end=","  el.addEventListener('click',e=>{st=9});\n  const end="))===BK+','+BK+'>@el.addEventListenerclick','a listener added to a block is new load-time code: the block (and the listener, which no test has run yet)');
    ok((await js(B,B.replace(/\(\(\)=>\{const el[\s\S]*$/,''))).endsWith(' +top')&&(await js(A,B)).endsWith(' +top')&&(await js(A,B)).startsWith(BK+','),'a block added or removed whole is top-level code');
    const flB=I.follow('app.js',['LIMIT'],new Map([['app.js',await I.analyse(B)]]));
    ok([...flB.files.get('app.js').units].sort().join()===[BK+'>@el.addEventListenertouchmove'].join()&&!flB.files.get('app.js').top,'a changed constant named in one of its listeners touches that listener, not the block');

    /* CSS */
    const C=`:root{--gap:12px}\n/* cards */\n.card{padding:8px}\n.card .dot{width:40px}\n@media (min-width:600px){\n  .card{padding:12px}\n  .wide{display:grid}\n}\n@keyframes spin{to{transform:rotate(360deg)}}\n`,known=['card','dot','wide'];
    ok(css(C,C.replace('40px','44px'),known)==='.card .dot','a changed declaration names its rule');
    ok(css(C,C.replace('/* cards */','/* the cards */'),known)===''&&css(C,C.replace('.card{padding:8px}','.card{padding:8px}\n\n/* more */'),known)==='','comments and blank lines touch nothing');
    ok(css(C,C+'.badge{color:red}\n.card .badge:hover{color:blue}\n',known)==='','a rule for a class the app never had touches no existing test');
    ok(css(C,C+'.card{margin:0}\n',known)==='.card','another rule for a selector that already applies everywhere names that selector');
    {const K='.a{animation:spin 1s both}\n.b{color:red}\n.c{animation-name:fade}\n@keyframes spin{from{opacity:0}to{opacity:1}}\n@keyframes fade{to{opacity:0}}\n@font-face{font-family:x}\n';
      ok(css(K,K.replace('opacity:0}to','opacity:.2}to'),['a','b','c'])==='.a','a changed @keyframes names only the rules that animate with it');
      ok(css(K,K+'@keyframes pop{to{transform:scale(1.1)}}\n',['a','b','c'])==='','a new @keyframes no rule names yet touches nothing');
      ok(css(K,K.replace('@keyframes fade{to{opacity:0}}','@keyframes fade{to{opacity:.5}}'),['a','b','c'])==='.c','animation-name counts too');
      ok(css(K,K.replace('font-family:x','font-family:y'),['a','b','c'])===' +top','another at-rule is still the whole sheet')}
    ok(css(C,C+'.card.dot{margin:0}\n',known)==='.card'&&css(C,C+'.card::before{content:""}\n.card .dot:hover>b,.card:not(.dot){margin:0}\n',known)==='.card +top'&&css(C,C+'.card::before{content:""}\n.wide .card:hover,.card:not(.dot){margin:0}\n',known)==='.card',
      'a new selector whose last part needs what a plain rule already asks for (.card.dot, .card::before, .wide .card:hover, .card:not(.dot)) can only apply where that rule does: its tests; one part that no plain rule covers (… > b) and it is every page test');
    ok(css(C,C+'.card:not(.badge){margin:0}\n',known)==='.card'&&css(C,C+'.badge .card{margin:0}\n.card>.badge{color:red}\n',known)==='','a new class inside :not() is not a rule for something new; a new class the element or one around it must have is');
    ok(css(C,C+'@media (max-width:400px){\n  .card{margin:0}\n  .card.dot{margin:1px}\n}\n',known)==='.card'&&css(C,C+'@media (max-width:400px){.wide{margin:0}}\n',known)===' +top','a whole new @media block is only its rules: the tests of the plain rules they sit inside (none for .wide: every page test)');
    ok(css(C,C.replace(/@media[^@]*/,''),known)==='.card | .wide','a whole @media block removed names the rules it held');
    ok(css(C,C+'.card .dot b{margin:0}\n',known)===' +top'&&css(C,C+'.wide{margin:0}\n',known)===' +top','a new selector for existing classes that no plain rule covers (or one that only applied in @media) selects every page test');
    ok(css(C,C.replace('.card .dot','.card.dot'),known)==='.card | .card .dot','a selector changed by one space is a changed selector: the tests that used the old one, and those where the new one can apply');
    ok(css(C,C.replace('600px','700px'),known)===' +top'&&css(C,C.replace('360deg','180deg'),known)==='','an @media condition selects every page test; a @keyframes no rule uses selects nothing (one in use: below)');
    ok(css(C,C.replace('  .wide{display:grid}\n',''),known)==='.wide','a removed rule names its selector');

    /* choosing */
    const S=(...a)=>new Set(a),E=o=>new Map(Object.entries(o)),map=new Map([
      [I.SMOKE,E({'index.html':S(I.LOADED),'app.js':S(I.LOADED,'boot')})],
      ['a.test.js',E({'index.html':S(I.LOADED),'app.js':S(I.LOADED,'boot','foo'),'styles.css':S(I.LOADED,'.card')})],
      ['b.test.js',E({'index.html':S(I.LOADED),'app.js':S(I.LOADED,'boot','bar'),'tests/fixtures/x.jpg':S(I.ANY)})],
      ['w.test.js',E({'worker.js':S(I.LOADED,'handleRender'),'wrangler.toml':S(I.ANY)})],
      ['odd.test.js',E({[I.ANY]:S(I.ANY)})]]),all=[...map.keys(),'new.test.js'];
    const P=(...c)=>{const r=I.pick(map,all,c);return r.all?'ALL':[...r.tests.keys()].sort().join(' ')},has=(s,t)=>s.split(' ').includes(t);
    const U=(file,kind,units=[],top=false)=>({file,kind,units:new Set(units),top});
    ok(P(U('CLAUDE.md','other'))==='new.test.js','a docs change runs no test (only one that was never recorded)');
    ok(P(U('worker.js','js',['handleRender']))==='new.test.js odd.test.js w.test.js','a worker function: the tests that run it, without the app start check');
    ok(P(U('app.js','js',['foo']))===[I.SMOKE,'a.test.js','new.test.js','odd.test.js'].sort().join(' '),'an app function: the tests that run it, plus the app start check');
    ok(has(P(U('app.js','js',[],true)),'b.test.js')&&!has(P(U('app.js','js',[],true)),'w.test.js'),'top-level app code: every test that loads the file');
    ok(P({file:'app.js',kind:'named',name:'LIMIT',tests:['b.test.js']})==='b.test.js new.test.js','a test that names a changed constant itself runs');
    ok(P(U('styles.css','css',['.card']))===[I.SMOKE,'a.test.js','new.test.js','odd.test.js'].sort().join(' '),'a CSS rule: the tests where it applied');
    ok(has(P(U('index.html','other')),'a.test.js')&&has(P(U('index.html','other')),'b.test.js')&&!has(P(U('index.html','other')),'w.test.js'),'index.html: every page test');
    ok(has(P(U('tests/fixtures/x.jpg','other')),'b.test.js')&&has(P(U('wrangler.toml','other')),'w.test.js'),'a file a test reads itself selects that test');
    ok(P(U('tests/b.test.js','test'))==='b.test.js new.test.js','an edited test file runs (others only if never recorded)');
    ok(P(U('tests/run.js','other'))==='ALL'&&P(U('package.json','other'))==='ALL','the runner or the Playwright version: everything');

    /* against a real git history */
    const repo=path.join(dir,'repo');fs.mkdirSync(path.join(repo,'tests'),{recursive:true});
    fs.writeFileSync(path.join(repo,'app.js'),A);fs.writeFileSync(path.join(repo,'README.md'),'hello\n');
    const rows=['a.test.js\tapp.js\t'+I.LOADED+'\tone','b.test.js\tapp.js\t'+I.LOADED+'\ttwo',''].join('\n'),commit=m=>{sh(repo,'add','-A');sh(repo,'-c','user.name=t','-c','user.email=t@example.com','commit','-qm',m)};
    const main=()=>sh(repo,'update-ref','refs/remotes/origin/main','HEAD'),mapText=()=>fs.readFileSync(path.join(repo,I.MAP),'utf8');
    sh(repo,'init','-q');fs.writeFileSync(path.join(repo,I.MAP),rows);commit('x');main();
    const T=['a.test.js','b.test.js'];let r=await I.select(repo,T);
    ok(r.all&&/not recorded for the files/.test(r.report),'a map on main without the fingerprint of main\'s files is not trusted: everything runs');
    // a passing run writes the fingerprint of the files it ran on; the same files give the same one, committed or not
    await I.save(repo,new Map(),T,true);const fp=I.fingerprint(repo);commit('tested');main();
    ok(/^\w{20}$/.test(fp)&&I.stampsOf(mapText()).join()===fp&&I.fingerprint(repo,'HEAD')===fp,'a passing run stamps the map with the fingerprint of its files, the same for the folder and for the commit made from it');
    r=await I.select(repo,T);ok(!r.all&&r.tests.length===0,'nothing changed: nothing to run');
    fs.writeFileSync(path.join(repo,'app.js'),A.replace('a+1','a+2'));fs.writeFileSync(path.join(repo,'README.md'),'hello there\n');fs.writeFileSync(path.join(repo,'notes.md'),'x\n');
    r=await I.select(repo,T);ok(!r.all&&r.tests.join()==='a.test.js'&&/one\(\)/.test(r.report),'an uncommitted edit to one function picks the one test that runs it ('+(r.tests||[]).join()+')');
    fs.writeFileSync(path.join(repo,'app.js'),A.replace('LIMIT=5','LIMIT=6').replace('return a+1','return a+LIMIT'));fs.writeFileSync(path.join(repo,'tests','b.test.js'),'// checks LIMIT\n');
    commit('y');fs.writeFileSync(path.join(repo,'app.js'),A.replace('LIMIT=5','LIMIT=7').replace('return a+1','return a+LIMIT'));
    r=await I.select(repo,T);ok(!r.all&&r.tests.sort().join()==='a.test.js,b.test.js'&&/LIMIT/.test(r.report),'committed and uncommitted work both count, and a changed constant picks the function and the test that name it ('+(r.tests||[]).join()+')');
    // saving: what a test used is added to what is known, names that are gone are dropped
    await I.save(repo,new Map([['a.test.js',{m:new Map([['app.js',new Set(['two','gone'])],['old.js',new Set([I.LOADED])]]),bad:false}],['c.test.js',{m:new Map(),bad:true}]]),['a.test.js','c.test.js']);
    const sv=I.load(repo);ok([...sv.get('a.test.js').get('app.js')].sort().join()===[I.LOADED,'one','two'].sort().join()&&!sv.get('a.test.js').has('old.js')&&!sv.has('b.test.js')&&sv.get('c.test.js').has(I.ANY),'the map adds up what a test uses, forgets functions, files and tests that are gone, and marks a test it could not follow');
    // a test that ran with the fixed plan (tests/fixedplan.js): its planner.js entries are replaced, not added to, so what an older
    // map (or a run with the real planner) left there drops out; a test with the real planner keeps adding up as before
    {const fx=path.join(dir,'fixedmap');fs.mkdirSync(path.join(fx,'tests'),{recursive:true});
      fs.writeFileSync(path.join(fx,'planner.js'),'function outfit(){return 1}\nfunction tieScore(){return 2}\n');fs.writeFileSync(path.join(fx,'app.js'),'function one(){return 1}\n');
      sh(fx,'init','-q');fs.writeFileSync(path.join(fx,I.MAP),['a.test.js\tplanner.js\t'+I.LOADED+'\toutfit\ttieScore','b.test.js\tplanner.js\t'+I.LOADED+'\toutfit',''].join('\n'));
      const m=()=>new Map([['app.js',new Set([I.LOADED,'one'])],['planner.js',new Set([I.LOADED])]]);
      await I.save(fx,new Map([['a.test.js',{m:m(),bad:false}],['b.test.js',{m:m(),bad:false}]]),['a.test.js','b.test.js'],false,k=>k==='a.test.js');
      const fm=I.load(fx),pa=[...(fm.get('a.test.js').get('planner.js')||[])],pb=[...(fm.get('b.test.js').get('planner.js')||[])];
      ok(pa.join()===I.LOADED&&pb.includes('outfit')&&fm.get('a.test.js').get('app.js').has('one'),`a fixed-plan test's planner entries are replaced (${pa.join()}), a real-planner test's still add up (${pb.join()})`)}
    // enforcing that the map is committed with its change
    ok(I.stampsOf(mapText()).length===0,'a run that did not pass leaves no fingerprint');
    let pp=I.prePush(repo);ok(!pp.ok&&/not committed/.test(pp.msg),'a push is refused while the map has uncommitted changes');
    commit('code and map, untested');pp=I.prePush(repo);ok(pp.ok&&/has not passed/.test(pp.msg),'once it is committed the push goes through, with a note when the files were not passed by npm test');
    main();ok((await I.select(repo,['a.test.js','c.test.js'])).all,'if that reaches main, the next npm test runs everything');
    await I.save(repo,new Map(),['a.test.js','c.test.js'],true);commit('tested again');main();pp=I.prePush(repo);
    ok(pp.ok&&!pp.msg&&!(await I.select(repo,['a.test.js','c.test.js'])).all,'and a passing run with its map committed makes main trusted again');
    fs.writeFileSync(path.join(repo,'README.md'),'docs\n');commit('docs');main();ok(!(await I.select(repo,['a.test.js','c.test.js'])).all&&!I.prePush(repo).msg,'a docs-only commit needs no new fingerprint');
    // the service worker's version: changed app files need a new CACHE name, or phones never take them
    fs.writeFileSync(path.join(repo,'sw.js'),"const CACHE='dw-v1';\nconst ASSETS=['./','app.js'];\n");commit('sw');main();
    fs.writeFileSync(path.join(repo,'app.js'),fs.readFileSync(path.join(repo,'app.js'),'utf8')+'\nconst EXTRA=1;\n');commit('app change, no bump');pp=I.prePush(repo);
    ok(!pp.ok&&/CACHE in sw\.js is still dw-v1/.test(pp.msg)&&/app\.js/.test(pp.msg),'a push that changes an app file with main\'s CACHE name is refused');
    fs.writeFileSync(path.join(repo,'sw.js'),"const CACHE='dw-v2';\nconst ASSETS=['./','app.js'];\n");commit('bump');ok(I.prePush(repo).ok,'with a new CACHE name it goes through');main();
    fs.writeFileSync(path.join(repo,'app.js'),A);commit('code without the map');main();ok((await I.select(repo,['a.test.js','c.test.js'])).all,'a code change merged without its map is noticed: everything runs');
    fs.mkdirSync(path.join(repo,'.githooks'));fs.writeFileSync(path.join(repo,'.githooks','pre-push'),'#!/bin/sh\n');I.installHook(repo);
    ok(sh(repo,'config','--get','core.hooksPath').trim()==='.githooks','a test run switches the push check on in the clone');
    ok(fs.statSync(path.join(ROOT,'.githooks','pre-push')).mode&0o111&&/impact\.js pre-push/.test(fs.readFileSync(path.join(ROOT,'.githooks','pre-push'),'utf8')),'the push check is in the repo and executable');
    fs.unlinkSync(path.join(repo,I.MAP));commit('no map');main();ok((await I.select(repo,T)).all,'without the map everything runs');

    /* main moved and was merged in: only a test that both changes can affect runs again */
    {const repo=path.join(dir,'moved'),T=['a.test.js','b.test.js','c.test.js'],L='const five=()=>5;\nconst six=()=>6;\n';fs.mkdirSync(path.join(repo,'tests'),{recursive:true});
      const git=(...a)=>sh(repo,'-c','user.name=t','-c','user.email=t@example.com',...a),commit=m=>{git('add','-A');git('commit','-q','--allow-empty','-m',m)},put=(f,t)=>fs.writeFileSync(path.join(repo,f),t);
      const pass=async m=>{await I.save(repo,new Map(),T,true);commit(m)};   // `npm test` passed: the map is stamped, and committed
      // main gets a change (with its own passing run), then the branch merges it in
      const onMain=async(m,edit)=>{git('checkout','-q','mainline');edit();await pass(m);git('update-ref','refs/remotes/origin/main','HEAD');git('checkout','-q','work');git('merge','-q','--no-edit','mainline')};
      put('app.js',A);put('lib.js',L);put('README.md','hello\n');put('.gitattributes',I.MAP+' merge=union\n');
      put(I.MAP,['a.test.js\tapp.js\t'+I.LOADED+'\tone','a.test.js\tlib.js\t'+I.LOADED+'\tfive','b.test.js\tapp.js\t'+I.LOADED+'\tone','c.test.js\tlib.js\t'+I.LOADED+'\tfive\tsix',''].join('\n'));
      git('init','-q','-b','mainline');commit('start');await pass('tested');git('update-ref','refs/remotes/origin/main','HEAD');
      git('checkout','-q','-b','work');put('app.js',A.replace('a+1','a+2'));
      let r=await I.select(repo,T);ok(!r.all&&r.tests.sort().join()==='a.test.js,b.test.js','(the branch changes one(): the two tests that run it)');
      await pass('mine, tested');
      await onMain('docs',()=>put('README.md','hello there\n'));r=await I.select(repo,T);
      ok(!r.all&&r.tests.length===0&&/main has moved/.test(r.report)&&/Nothing more needs to run/.test(r.report),'main moved by a docs change only: nothing runs again');
      await pass('merged, tested');
      await onMain('lib',()=>put('lib.js',L.replace('=>6','=>66')));r=await I.select(repo,T);
      ok(!r.all&&r.tests.length===0,'main changed a function none of the branch\'s tests runs: nothing runs again ('+(r.tests||[]).join()+')');
      await pass('merged, tested');
      await onMain('lib',()=>put('lib.js',L.replace('=>5','=>55').replace('=>6','=>66')));r=await I.select(repo,T);
      ok(!r.all&&r.tests.join()==='a.test.js'&&/1 of the 2 this branch selects/.test(r.report),'main changed a function one of them runs: that test runs again, the other does not ('+(r.tests||[]).join()+')');
      // without a pass on the merged files, the earlier pass still counts for the next move of main
      await onMain('tooling',()=>put('tests/run.js','// runner\n'));r=await I.select(repo,T);
      ok(!r.all&&r.tests.sort().join()==='a.test.js,b.test.js'&&/can affect every test/.test(r.report),'main changed the runner: the branch\'s tests all run again');
      git('checkout','-q','mainline');git('rm','-q','tests/run.js');await pass('no runner');git('update-ref','refs/remotes/origin/main','HEAD');git('checkout','-q','work');git('merge','-q','--no-edit','mainline');await pass('merged, tested');
      await onMain('same file',()=>put('app.js',A.replace('()=>3,','()=>33,')));r=await I.select(repo,T);
      ok(!r.all&&r.tests.sort().join()==='a.test.js,b.test.js'&&/Both sides changed app\.js/.test(r.report),'both sides changed the same file: the branch\'s tests all run again');
      await pass('merged, tested');
      await onMain('lib',()=>put('lib.js',L.replace('=>6','=>67')));put('app.js',fs.readFileSync(path.join(repo,'app.js'),'utf8').replace('a+2','a+3'));r=await I.select(repo,T);
      ok(!r.all&&r.tests.sort().join()==='a.test.js,b.test.js','an edit made after the merge was not in the run that passed: its tests run');
      commit('edited after the merge, not tested');
      await onMain('lib',()=>put('lib.js',L.replace('=>6','=>68')));r=await I.select(repo,T);
      ok(!r.all&&r.tests.sort().join()==='a.test.js,b.test.js','the pass that counts is on the branch\'s own files as they are now: an earlier one, from before an untested edit, saves nothing')}

    /* the runner's own record of this test */
    if(impactRec){const b=await chromium.launch(),p=await b.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>openStats());await p.waitForSelector('#stats:not([hidden])');await p.reload();await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>show('wardrobe'));await p.keyboard.press('ArrowRight');
      fs.readFileSync(path.join(ROOT,'wrangler.toml'));
      const {m,odd}=await impactRec.peek(),has=(f,k)=>!!(m.get(f)&&m.get(f).has(k));
      ok(has('stats.js','openStats')&&has('app.js',I.LOADED),'functions a page ran are recorded, also those from before a reload');
      const blocks=[...m.get('app.js')].filter(k=>k.includes('>')),keyed=k=>/^@\{constel\$wardrobe\}>@document\.addEventListenerkeydown$/.test(k);
      ok(has('app.js','@{constel$wardrobe}')&&blocks.some(keyed)&&!blocks.some(k=>/touchmove/.test(k)),'of a block that runs at load, the listeners that really fired are recorded (a key was pressed, nothing was touched: '+blocks.filter(keyed).length+' of '+blocks.length+')');
      ok(odd===0,'Chromium and Node agree on where every function starts, so a page\'s functions go by the names a diff is read with ('+odd+' did not)');
      ok([...(m.get('styles.css')||[])].some(k=>k.startsWith('#stats')),'CSS rules that applied are recorded');
      ok(has('index.html',I.LOADED)&&has('wrangler.toml',I.ANY)&&!m.has('worker.js'),'so are the files served to the page and the files the test read');
      await b.close()}
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
};
