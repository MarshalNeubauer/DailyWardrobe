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
    ok(await js(A,A+'onresize=()=>{};\n')==='onresize +top'&&await js(A,A+'(()=>{state.x=1})();\n')==='@ +top','new code that runs at load (an assignment, an IIFE) is top-level code');
    ok(await js(A,A.replace('return a+1}','return a+1'))===' +top','a file that no longer parses selects everything that loads it');
    const M=`const help=x=>x*2;\nexport class Hub {\n  constructor(){this.n=0}\n  bump(){this.n++}\n}\nexport default {\n  async fetch(req){return help(1)}\n};\n`;
    ok(await js(M,M.replace('x*2','x*3'))==='help'&&await js(M,M.replace('this.n++','this.n+=2'))==='bump','an ES module (worker.js) is read too: a helper, a class method');
    const lx=I.jsLex("const u='http://x',r=/a\\/\\/b[/]/,t=`p${`//q`}//r`;f(a/2); // real\n/* also */");
    ok(lx&&lx.com.length===2&&lx.com[0][1]-lx.com[0][0]===7,'// inside strings, patterns and templates is not a comment');
    ok(I.jsLex("const a='x")===null&&I.jsLex('f(){')===null,'a text it cannot follow is not trusted');

    /* CSS */
    const C=`:root{--gap:12px}\n/* cards */\n.card{padding:8px}\n.card .dot{width:40px}\n@media (min-width:600px){\n  .card{padding:12px}\n  .wide{display:grid}\n}\n@keyframes spin{to{transform:rotate(360deg)}}\n`,known=['card','dot','wide'];
    ok(css(C,C.replace('40px','44px'),known)==='.card .dot','a changed declaration names its rule');
    ok(css(C,C.replace('/* cards */','/* the cards */'),known)===''&&css(C,C.replace('.card{padding:8px}','.card{padding:8px}\n\n/* more */'),known)==='','comments and blank lines touch nothing');
    ok(css(C,C+'.badge{color:red}\n.card .badge:hover{color:blue}\n',known)==='','a rule for a class the app never had touches no existing test');
    ok(css(C,C+'.card{margin:0}\n',known)==='.card','another rule for a selector that already applies everywhere names that selector');
    ok(css(C,C+'.card.dot{margin:0}\n',known)===' +top'&&css(C,C+'.wide{margin:0}\n',known)===' +top','a new selector for existing classes (or one that only applied in @media) selects every page test');
    ok(css(C,C.replace('.card .dot','.card.dot'),known)==='.card .dot +top','a selector changed by one space is a changed selector');
    ok(css(C,C.replace('600px','700px'),known)===' +top'&&css(C,C.replace('360deg','180deg'),known)===' +top','an @media condition or @keyframes selects every page test');
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
    // enforcing that the map is committed with its change
    ok(I.stampsOf(mapText()).length===0,'a run that did not pass leaves no fingerprint');
    let pp=I.prePush(repo);ok(!pp.ok&&/not committed/.test(pp.msg),'a push is refused while the map has uncommitted changes');
    commit('code and map, untested');pp=I.prePush(repo);ok(pp.ok&&/has not passed/.test(pp.msg),'once it is committed the push goes through, with a note when the files were not passed by npm test');
    main();ok((await I.select(repo,['a.test.js','c.test.js'])).all,'if that reaches main, the next npm test runs everything');
    await I.save(repo,new Map(),['a.test.js','c.test.js'],true);commit('tested again');main();pp=I.prePush(repo);
    ok(pp.ok&&!pp.msg&&!(await I.select(repo,['a.test.js','c.test.js'])).all,'and a passing run with its map committed makes main trusted again');
    fs.writeFileSync(path.join(repo,'README.md'),'docs\n');commit('docs');main();ok(!(await I.select(repo,['a.test.js','c.test.js'])).all&&!I.prePush(repo).msg,'a docs-only commit needs no new fingerprint');
    fs.writeFileSync(path.join(repo,'app.js'),A);commit('code without the map');main();ok((await I.select(repo,['a.test.js','c.test.js'])).all,'a code change merged without its map is noticed: everything runs');
    fs.mkdirSync(path.join(repo,'.githooks'));fs.writeFileSync(path.join(repo,'.githooks','pre-push'),'#!/bin/sh\n');I.installHook(repo);
    ok(sh(repo,'config','--get','core.hooksPath').trim()==='.githooks','a test run switches the push check on in the clone');
    ok(fs.statSync(path.join(ROOT,'.githooks','pre-push')).mode&0o111&&/impact\.js pre-push/.test(fs.readFileSync(path.join(ROOT,'.githooks','pre-push'),'utf8')),'the push check is in the repo and executable');
    fs.unlinkSync(path.join(repo,I.MAP));commit('no map');main();ok((await I.select(repo,T)).all,'without the map everything runs');

    /* the runner's own record of this test */
    if(impactRec){const b=await chromium.launch(),p=await b.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>openStats());await p.waitForSelector('#stats:not([hidden])');await p.reload();await p.waitForFunction(()=>window.appReady);
      fs.readFileSync(path.join(ROOT,'wrangler.toml'));
      const {m,odd}=await impactRec.peek(),has=(f,k)=>!!(m.get(f)&&m.get(f).has(k));
      ok(has('stats.js','openStats')&&has('app.js',I.LOADED),'functions a page ran are recorded, also those from before a reload');
      ok(odd===0,'Chromium and Node agree on where every function starts, so a page\'s functions go by the names a diff is read with ('+odd+' did not)');
      ok([...(m.get('styles.css')||[])].some(k=>k.startsWith('#stats')),'CSS rules that applied are recorded');
      ok(has('index.html',I.LOADED)&&has('wrangler.toml',I.ANY)&&!m.has('worker.js'),'so are the files served to the page and the files the test read');
      await b.close()}
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
};
