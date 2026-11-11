// Which checks can a change affect? Used by `node tests/run.js --changed` (= `npm test`).
//
// While a test runs, the runner records what it really uses (tests/impact.map, one line per test and file):
//   - every top-level function of the app's scripts it runs in the page (V8 coverage over CDP) and of worker.js in Node,
//   - every rule of styles.css that applied to an element (CSS rule usage),
//   - every other file its pages were served (<loaded>) and every file it read itself or ran in a Web Worker (<any>).
// For a change, the edited functions and CSS rules are worked out from `git diff` against origin/main, and only the tests
// that use one of them run. Anything that can't be narrowed down (top-level code, index.html, a new selector for existing
// classes, a file V8 can't parse) selects every test that loads that file; run.js / impact.js / package.json select all.
//
// The map has to travel with the change it was recorded for. Two things see to that:
//   - a passing `npm test` writes into the map a fingerprint of the files it ran on (`# tested`). When origin/main's map
//     doesn't carry the fingerprint of origin/main's own files (the map was left out of a commit, the last edit wasn't
//     tested, two changes were merged without a run on the result), the next `npm test` runs everything and records anew;
//   - `git push` is refused while the map has changes that aren't committed (.githooks/pre-push, switched on by tests/run.js).
const fs=require('fs'),path=require('path'),vm=require('vm'),inspector=require('inspector'),crypto=require('crypto'),{execFileSync}=require('child_process'),{fileURLToPath}=require('url');
const MAP='tests/impact.map',ANY='<any>',LOADED='<loaded>',SMOKE='run.js: renders the outfit without errors';
const realRead=fs.readFileSync;

/* ---------- V8: the Node-side coverage session, and the top-level functions of a source text ---------- */
let session=null,covOn=null;
const post=(m,p)=>new Promise((res,rej)=>{if(!session){session=new inspector.Session();session.connect()}session.post(m,p||{},(e,r)=>e?rej(e):res(r))});
const nodeCov=()=>covOn||(covOn=post('Profiler.enable').then(()=>post('Profiler.startPreciseCoverage',{callCount:true,detailed:false})));
/* an unnamed top-level function (an event listener, an IIFE) is named after the code just before it */
const anon=(src,a)=>'@'+(src?src.slice(Math.max(0,a-60),a).split(/[;\n{}]/).pop().replace(/[^\w$.]/g,'').slice(-48):'');
/* V8's function list for one script → its top-level functions [{n,a,b,c}] (name, range, call count), in order */
const units=(fns,src,shift=0)=>{const L=fns.map(f=>({n:f.functionName,a:f.ranges[0].startOffset-shift,b:f.ranges[0].endOffset-shift,c:f.ranges[0].count})).sort((x,y)=>x.a-y.a||y.b-x.b);
  if(L.length&&L[0].a<=0&&L.every(f=>f.b<=L[0].b))L.shift();   // the script itself
  const out=[];let end=-Infinity;for(const f of L){if(f.a<end)continue;end=f.b;if(!f.n)f.n=anon(src,f.a);out.push(f)}return out};
let seq=0;
/* compiled inside a branch that is never taken, so nothing runs: V8 still lists every top-level function. null when it doesn't parse */
const scan=async src=>{await nodeCov();const id='impact-scan-'+(++seq)+'.js',pre='if(Math.random()<0){';
  const code=pre+src.replace(/^export default\b/gm,'void          ').replace(/^export\b/gm,'      ')+'\n}';
  try{new vm.Script(code,{filename:id}).runInNewContext({Math})}catch(e){return null}
  const e=(await post('Profiler.takePreciseCoverage')).result.find(x=>x.url===id);return e?units(e.functions,src,pre.length):null};

/* ---------- comments and literals of a JS text (null when unsure) ---------- */
const jsLex=src=>{const com=[],lit=[],n=src.length,st=[];let i=0,depth=0,last='',word='';
  const KW=/^(?:return|typeof|case|in|of|void|delete|throw|new|do|else|instanceof|yield|await)$/;
  const tpl=()=>{const a=i;for(;;){if(i>=n)return false;const c=src[i];if(c==='\\'){i+=2;continue}
    if(c==='`'){lit.push([a,i]);i++;last='`';word='';return true}if(c==='$'&&src[i+1]==='{'){lit.push([a,i]);i+=2;st.push(depth);last='{';word='';return true}i++}};
  while(i<n){const c=src[i],d=src[i+1];
    if(c==='/'&&d==='/'){let j=src.indexOf('\n',i);if(j<0)j=n;com.push([i,j]);i=j;continue}
    if(c==='/'&&d==='*'){const j=src.indexOf('*/',i+2);if(j<0)return null;com.push([i,j+2]);i=j+2;continue}
    if(c==='"'||c==="'"){let j=i+1;for(;;){if(j>=n||src[j]==='\n')return null;if(src[j]==='\\'){j+=2;continue}if(src[j]===c)break;j++}lit.push([i+1,j]);i=j+1;last=c;word='';continue}
    if(c==='`'){i++;if(!tpl())return null;continue}
    if(c==='/'&&(!last||'(,=:[!&|?{};+-*%<>~^'.includes(last)||(word&&KW.test(word)))){let j=i+1,cls=false;
      for(;;){if(j>=n||src[j]==='\n')return null;const x=src[j];if(x==='\\'){j+=2;continue}if(x==='[')cls=true;else if(x===']')cls=false;else if(x==='/'&&!cls)break;j++}
      lit.push([i+1,j]);i=j+1;last='/';word='';continue}
    if(c==='{')depth++;
    else if(c==='}'){if(st.length&&st[st.length-1]===depth){st.pop();i++;if(!tpl())return null;continue}if(--depth<0)return null}
    if(/\s/.test(c)){i++;continue}
    word=/[\w$]/.test(c)?(/[\w$]/.test(src[i-1]||'')?word:'')+c:'';last=c;i++}
  return depth===0&&!st.length?{com,lit}:null};
const blank=(src,R)=>{let out='',at=0;for(const [a,b] of R){out+=src.slice(at,a)+src.slice(a,b).replace(/[^\n]/g,' ');at=b}return out+src.slice(at)};
const inAny=(R,i)=>R.some(([a,b])=>a<=i&&i<b);
/* the text of [a,b) without its comments */
const codeOf=(src,com,a,b)=>{let out='';for(let i=a;i<b;i++)if(!inAny(com,i))out+=src[i];return out};

/* ---------- top-level statements, so a changed constant can be followed to the code that names it ---------- */
/* view: comments, the insides of strings and the top-level functions blanked. Statements end at a `;` outside brackets, at a
   line break before a declaration, or where a line break ends one without a `;`. A `const/let/var` statement gets the names
   it declares (null when it can't be read, as with destructuring) */
const segments=view=>{const segs=[],n=view.length;let depth=0,a=0,commas=[];
  const close=b=>{const t=view.slice(a,b);if(t.trim()){const m=/^[\sƒ]*(?:export\s+)?(?:const|let|var)\s/.exec(t);let names=null;
      if(m){names=[];for(const at of [a+m[0].length,...commas.map(c=>c+1)]){const x=/^\s*([A-Za-z_$][\w$]*)\s*(?=[=,;]|$)/.exec(view.slice(at,b));if(!x){names=null;break}names.push(x[1])}}
      segs.push({a,b,names})}a=b;commas=[]};
  for(let i=0;i<n;i++){const c=view[i];
    if('([{'.includes(c))depth++;else if(')]}'.includes(c))depth--;
    else if(depth===0){if(c===';')close(i+1);else if(c===',')commas.push(i);
      else if(c==='\n'){const next=view.slice(i+1,i+80),prev=view.slice(Math.max(a,i-80),i).trimEnd().slice(-1);
        if(/^\s*(?:export\b|(?:const|let|var|function|async\s+function|class)\b)/.test(next)||(prev&&!'=,+-*/%&|?:<>(.[{!~^'.includes(prev)&&/^\s*[A-Za-z_$(\[`ƒ]/.test(next)))close(i+1)}}}
  close(n);return segs};
/* everything known about one source text, or null when V8 can't parse it; lx and segs are null when the comments and
   strings can't be told apart for sure (blanking them must leave V8 the very same functions) */
const analysed=new Map();
const analyse=async src=>{if(analysed.has(src))return analysed.get(src);const u=await scan(src);let r=null;
  if(u){r={s:src,u,lx:null,code:null,segs:null};const lx=jsLex(src);
    if(lx){const code=blank(src,[...lx.com,...lx.lit].sort((x,y)=>x[0]-y[0])),v=await scan(code);
      if(v&&v.length===u.length&&v.every((f,k)=>f.a===u[k].a&&f.b===u[k].b)){r.lx=lx;r.code=code;
        let view='',at=0;for(const f of u){view+=code.slice(at,f.a)+'ƒ'+' '.repeat(f.b-f.a-1);at=f.b}r.view=view+code.slice(at);r.segs=segments(r.view)}}}
  analysed.set(src,r);return r};
const nameRe=n=>new RegExp('(?<![\\w$.])'+n.replace(/\$/g,'\\$')+'(?![\\w$])');

/* ---------- what changed: git hunks as character ranges ---------- */
const git=(root,...a)=>{try{return execFileSync('git',a,{cwd:root,maxBuffer:1<<28,stdio:['ignore','pipe','ignore']}).toString('utf8')}catch(e){return null}};
/* the commit to compare with: where the branch left origin/main. A cloud session's copy of origin/main can be months old
   (and its history cut short, so no common commit is found): it is fetched first; without a network the copy at hand is used */
const baseOf=root=>{if(process.env.TEST_BASE)return process.env.TEST_BASE;
  try{execFileSync('git',['fetch','-q','origin','main'],{cwd:root,stdio:'ignore',timeout:30000})}catch(e){}
  return (git(root,'merge-base','HEAD','origin/main')||'').trim()||null};
const changedFiles=(root,base)=>{const a=git(root,'diff','--name-only','-z','--no-renames',base),b=git(root,'ls-files','--others','--exclude-standard','-z');
  return a==null||b==null?null:[...new Set((a+'\0'+b).split('\0').filter(Boolean))].sort()};
const lineStarts=s=>{const L=[0];for(let i=s.indexOf('\n');i>=0;i=s.indexOf('\n',i+1))L.push(i+1);L.push(s.length);return L};
/* `git diff -U0` text → one entry per hunk: [[oldA,oldB,newA,newB], …], the hunk narrowed to the characters that differ and
   widened to whole words. Text added in the middle of a line can be cut out in two ways (shared start first, or shared end
   first); both are true, and the caller takes the one that touches less */
const hunksOf=(diff,oldS,newS)=>{const O=lineStarts(oldS),N=lineStarts(newS),W=/[\w$]/,out=[];
  const at=(L,a,n)=>{const e=L.length-1;return n?[L[Math.min(a-1,e)],L[Math.min(a-1+n,e)]]:[L[Math.min(a,e)],L[Math.min(a,e)]]};
  const wide=(s,a,b)=>{if(a<b){while(a>0&&W.test(s[a-1])&&W.test(s[a]))a--;while(b<s.length&&W.test(s[b])&&W.test(s[b-1]))b++}return [a,b]};
  for(const m of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)){
    const [oa0,ob0]=at(O,+m[1],m[2]==null?1:+m[2]),[na0,nb0]=at(N,+m[3],m[4]==null?1:+m[4]),alts=[];
    for(const startFirst of [true,false]){let oa=oa0,ob=ob0,na=na0,nb=nb0;
      const pre=()=>{while(oa<ob&&na<nb&&oldS[oa]===newS[na]){oa++;na++}},suf=()=>{while(ob>oa&&nb>na&&oldS[ob-1]===newS[nb-1]){ob--;nb--}};
      if(startFirst){pre();suf()}else{suf();pre()}
      const h=[...wide(oldS,oa,ob),...wide(newS,na,nb)];if(!alts.some(x=>x.join()===h.join()))alts.push(h)}
    out.push(alts)}
  return out};

/* of several true readings of one hunk, the one that touches least */
const least=L=>L.slice().sort((x,y)=>(x.top-y.top)||(x.units.size+(x.syms?x.syms.size:0)-y.units.size-(y.syms?y.syms.size:0)))[0];

/* ---------- JS: the top-level functions an edit touches; top = code outside them changed too ---------- */
// a statement that only declares a function (`const f=ƒ`, `,g=ƒ`, `function f(){}`, a class) runs nothing by itself
const TRIVIAL=/^(?:\s|;|ƒ|(?:export|default|async)\b|(?:(?:const|let|var)\s+|,\s*)[A-Za-z_$][\w$]*\s*=\s*(?:async\s+)?ƒ)*$/;
const jsImpact=async(oldS,newS,H)=>{const out={units:new Set(),syms:new Set(),top:false},sides=[await analyse(oldS),await analyse(newS)];
  if(!sides[0]||!sides[1]){out.top=true;return out}
  const com=S=>S.lx?S.lx.com:[],real=(S,i)=>!inAny(com(S),i)&&(!/\s/.test(S.s[i])||(S.lx&&inAny(S.lx.lit,i)));
  // a piece is cosmetic when it is only comments, and whitespace outside strings
  const cosmetic=(S,p,q)=>{if(p===q)return true;if(!S.lx)return false;for(let i=p;i<q;i++)if(real(S,i))return false;return true};
  const one=h=>{const R=[[h[0],h[1]],[h[2],h[3]]],r={units:new Set(),syms:new Set(),top:false};if(sides.every((S,k)=>cosmetic(S,...R[k])))return r;
    sides.forEach((S,k)=>{const [p,q]=R[k],gaps=[];let res='',at=p;
      for(const f of S.u)if(p===q?f.a<p&&p<f.b:f.a<q&&f.b>p){r.units.add(f.n);if(f.a>at){gaps.push([at,f.a]);res+=codeOf(S.s,com(S),at,f.a)}res+='ƒ';at=Math.max(at,f.b)}
      if(at<q){gaps.push([at,q]);res+=codeOf(S.s,com(S),at,q)}
      if(TRIVIAL.test(res))return;
      // code outside the functions changed: a `const X=…` statement is followed by name (syms); anything else is top-level code
      if(!S.segs){r.top=true;return}
      for(const [x,y] of gaps)for(const sg of S.segs){let hit=false;for(let i=Math.max(x,sg.a);i<Math.min(y,sg.b);i++)if(real(S,i)){hit=true;break}
        if(hit){if(sg.names)for(const n of sg.names)r.syms.add(n);else r.top=true}}});return r};
  for(const alts of H){const r=least(alts.map(one));for(const u of r.units)out.units.add(u);for(const n of r.syms)out.syms.add(n);if(r.top)out.top=true}
  return out};
/* the names in `syms` changed in `file`: every top-level function that names one is touched, a constant that names one is
   followed in turn, other top-level code that names one makes its file top. sources: file → analyse() of each script in
   the same scope. → Map(file → {units,top}), and every name reached */
const follow=(file,syms,sources)=>{const out=new Map(),at=g=>{if(!out.has(g))out.set(g,{units:new Set(),top:false});return out.get(g)},seen=new Set(),queue=[...syms];
  while(queue.length){const n=queue.shift();if(seen.has(n))continue;seen.add(n);const re=nameRe(n);
    for(const [g,A] of sources){if(!A)continue;if(!A.segs){if(re.test(A.s))at(g).top=true;continue}
      for(const u of A.u)if(re.test(A.code.slice(u.a,u.b)))at(g).units.add(u.n);
      for(const sg of A.segs)if(re.test(A.view.slice(sg.a,sg.b))){if(sg.names)queue.push(...sg.names);else at(g).top=true}}}   // (a statement's other names may be built from it)
  return {files:out,names:seen}};

/* ---------- CSS: rules by selector ---------- */
const normSel=s=>s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\s+/g,' ').trim();
/* → {rules:[{key,a,ba,bb,b,cond}], com}: style rules (key = selector; null for @keyframes and the like), cond = inside @media/@supports */
const cssScan=src=>{const rules=[],com=[],n=src.length;let i=0;
  const skip=()=>{if(src[i]==='/'&&src[i+1]==='*'){const j=src.indexOf('*/',i+2);if(j<0)throw 0;com.push([i,j+2]);i=j+2;return true}
    if(src[i]==='"'||src[i]==="'"){const c=src[i];let j=i+1;while(j<n&&src[j]!==c){if(src[j]==='\\')j++;j++}if(j>=n)throw 0;i=j+1;return true}return false};
  const block=cond=>{for(;;){while(i<n&&(/\s/.test(src[i])||(src[i]==='/'&&src[i+1]==='*')))if(!skip())i++;
    if(i>=n){if(cond)throw 0;return}if(src[i]==='}'){if(!cond)throw 0;i++;return}
    const a=i;while(i<n&&!'{;}'.includes(src[i]))if(!skip())i++;if(i>=n||src[i]==='}')throw 0;
    const pre=normSel(src.slice(a,i));if(src[i]===';'){i++;rules.push({key:null,a,ba:i,bb:i,b:i,cond});continue}
    const ba=++i;if(/^@(media|supports|container|layer)\b/.test(pre)){block(true);continue}
    let d=1;while(i<n&&d){if(skip())continue;if(src[i]==='{')d++;else if(src[i]==='}')d--;i++}if(d)throw 0;
    rules.push({key:pre[0]==='@'?null:pre,a,ba,bb:i-1,b:i,cond})}};
  try{block(false)}catch(e){return null}return {rules,com}};
/* isNew(name): is this class/id unknown to the old app? Then a rule for it can only style what changed code adds */
const cssImpact=(oldS,newS,H,isNew)=>{const out={units:new Set(),top:false},O=cssScan(oldS),N=cssScan(newS);if(!O||!N){out.top=true;return out}
  const plainOld=new Set(O.rules.filter(r=>r.key&&!r.cond).map(r=>r.key));
  const novel=key=>key.split(',').every(part=>(part.match(/[.#][\w-]+/g)||[]).some(t=>isNew(t.slice(1))));
  const side=(r0,S,src,p,q,isOld)=>{const real=i=>!inAny(S.com,i)&&!/\s/.test(src[i]);
    for(const r of S.rules){if(!(p===q?r.a<p&&p<r.b:r.a<q&&r.b>p))continue;
      let any=false;for(let i=Math.max(p,r.a);i<Math.min(q,r.b);i++)if(real(i)){any=true;break}
      // spacing or a comment: it matters inside a selector (`.a .b` is not `.a.b`), nowhere else
      const sel=r.key&&(p===q?p<r.ba-1:p<r.ba-1&&q>r.a);if(!any&&!sel)continue;
      if(!r.key){r0.top=true;continue}
      if(p>=r.ba&&q<=r.bb){r0.units.add(r.key);continue}                                   // its declarations only
      if(isOld||plainOld.has(r.key))r0.units.add(r.key);else if(!novel(r.key))r0.top=true}   // a rule added, removed, or its selector changed
    for(let i=p;i<q;i++)if(real(i)&&!S.rules.some(r=>r.a<=i&&i<r.b)){r0.top=true;break}};   // outside the rules: an @media condition, a brace
  const one=h=>{const r={units:new Set(),top:false};side(r,O,oldS,h[0],h[1],true);side(r,N,newS,h[2],h[3],false);return r};
  for(const alts of H){const r=least(alts.map(one));for(const u of r.units)out.units.add(u);if(r.top)out.top=true}
  return out};

/* ---------- the map: test → file → what it uses ---------- */
// What every page test uses (starting the app) is written once, under COMMON; a test that includes it has a COMMON line
const COMMON='<every page test>';
const load=root=>{try{return parse(realRead(path.join(root,MAP),'utf8'))}catch(e){return null}};
const parse=t=>{const m=new Map();
  for(const line of t.split('\n')){if(!line||line[0]==='#')continue;const [test,file,...toks]=line.split('\t');if(!file)continue;
    if(!m.has(test))m.set(test,new Map());const e=m.get(test);if(!e.has(file))e.set(file,new Set());for(const k of toks)e.get(file).add(k)}   // a merge can leave two lines for one test and file: both count
  const com=m.get(COMMON);m.delete(COMMON);
  for(const e of m.values())if(e.delete(COMMON)&&com)for(const [f,S] of com){if(!e.has(f))e.set(f,new Set());for(const k of S)e.get(f).add(k)}
  return m};
const dump=(m,stamp)=>{const pages=[...m.values()].filter(e=>e.has('index.html')),com=new Map();
  if(pages.length>1)for(const [f,S] of pages[0]){const k=[...S].filter(x=>pages.every(e=>e.has(f)&&e.get(f).has(x)));if(k.length)com.set(f,new Set(k))}
  const rows=(t,e,cut)=>[...e.keys()].sort().map(f=>[t,f,...[...e.get(f)].filter(x=>!(cut&&com.has(f)&&com.get(f).has(x))).sort()]).filter(r=>r.length>2).map(r=>r.join('\t'));
  return ['# What each test uses (written by tests/run.js; see tests/impact.js): test, file, then functions / CSS rules, '+LOADED+' or '+ANY+'.',
    ...(stamp?[TESTED+stamp]:[]),...(com.size?rows(COMMON,com):[]),...[...m.keys()].sort().flatMap(t=>{const cut=com.size&&pages.includes(m.get(t));return [...(cut?[t+'\t'+COMMON+'\t'+COMMON]:[]),...rows(t,m.get(t),cut)]})].join('\n')+'\n'};
/* ---------- the fingerprint: which files the map was tested on ---------- */
const TESTED='# tested\t';
const stampsOf=text=>[...(text||'').matchAll(/^# tested\t(\w+)$/gm)].map(m=>m[1]);   // a merge can leave two
/* every file but the map itself and the docs (*.md, LICENSE: no test reads them), by content: of a commit, or of the
   folder as it is now (committed or not). The same files give the same fingerprint either way. null when git can't say */
const fingerprint=(root,commit)=>{let rows;
  try{if(commit){const t=git(root,'ls-tree','-r','-z',commit);if(t==null)return null;rows=t.split('\0').filter(Boolean).map(l=>{const [meta,f]=l.split('\t');return [f,meta.split(' ')[2]]})}
    else{const t=git(root,'ls-files','-co','--exclude-standard','-z');if(t==null)return null;const files=[...new Set(t.split('\0').filter(Boolean))].filter(f=>fs.existsSync(path.join(root,f)));
      const h=execFileSync('git',['hash-object','--stdin-paths'],{cwd:root,input:files.join('\n')+'\n',maxBuffer:1<<28,stdio:['pipe','pipe','ignore']}).toString().trim().split('\n');rows=files.map((f,i)=>[f,h[i]])}
  }catch(e){return null}
  return crypto.createHash('sha256').update(rows.filter(([f])=>f!==MAP&&!/\.md$/.test(f)&&f!=='LICENSE').map(r=>r.join(' ')).sort().join('\n')).digest('hex').slice(0,20)};
/* before a push (.githooks/pre-push → `node tests/impact.js pre-push`): the map may not be left behind */
const prePush=root=>{const dirty=(git(root,'status','--porcelain','--',MAP)||'').trim();
  if(dirty)return {ok:false,msg:MAP+' has changes that are not committed. It records what each test uses, and later sessions choose their tests from it:\ncommit it with your change, then push again.'};
  const fp=fingerprint(root,'HEAD');
  if(fp&&!stampsOf(git(root,'show','HEAD:'+MAP)).includes(fp))return {ok:true,msg:'Note: `npm test` has not passed on exactly these files (or its '+MAP+' is not in the commit).\nIf this reaches main as it is, the next `npm test` there runs every check.'};
  return {ok:true,msg:''}};
/* tests/run.js calls this: from then on git runs .githooks/pre-push in this clone (left alone if hooks are set up otherwise) */
const installHook=root=>{try{if(fs.existsSync(path.join(root,'.githooks','pre-push'))&&!(git(root,'config','--get','core.hooksPath')||'').trim())git(root,'config','core.hooksPath','.githooks')}catch(e){}};

/* results: Map(test → {m, bad}). What a test used is added to what it used before: a timer that fires in one run and not
   the next, or a path only taken on a weekend, stays known. Names that no longer exist in the sources are dropped, and so
   are tests that no longer exist */
// passed: `npm test` (or the whole suite) ran and nothing failed: the map then says which files it stands for
const save=async(root,results,all,passed)=>{const out=load(root)||new Map(),alive=new Map();
  const names=async f=>{if(!alive.has(f)){let t=null,k=null;try{t=realRead(path.join(root,f),'utf8')}catch(e){}
      if(t!=null){k=true;if(/^[^/]+\.js$/.test(f)){const u=await scan(t);if(u)k=new Set(u.map(x=>x.n))}else if(/\.css$/.test(f)){const c=cssScan(t);if(c)k=new Set(c.rules.map(r=>r.key))}}
      alive.set(f,k)}return alive.get(f)};
  for(const [k,r] of results){if(r.bad){out.set(k,new Map([[ANY,new Set([ANY])]]));continue}
    const e=out.has(k)&&!out.get(k).has(ANY)?out.get(k):new Map();for(const [f,S] of r.m){if(!e.has(f))e.set(f,new Set());for(const x of S)e.get(f).add(x)}out.set(k,e)}
  for(const k of [...out.keys()])if(!all.includes(k))out.delete(k);
  for(const e of out.values())for(const [f,S] of [...e]){if(f===ANY)continue;const ok=await names(f);if(!ok){e.delete(f);continue}
    if(ok!==true)for(const x of [...S])if(x!==ANY&&x!==LOADED&&!ok.has(x))S.delete(x);if(!S.size)e.delete(f)}
  let was=null;try{was=realRead(path.join(root,MAP),'utf8')}catch(e){}
  const fp=fingerprint(root),text=dump(out,fp&&(passed||stampsOf(was).includes(fp))?fp:null);   // an earlier pass on these very files still counts
  if(text!==was)fs.writeFileSync(path.join(root,MAP),text)};

/* ---------- choosing ---------- */
const FULL=/^(?:tests\/run\.js|tests\/impact\.js|package(?:-lock)?\.json)$/;
const servedFile=f=>!f.includes('/')&&/\.(?:js|html|css|webmanifest|png|svg|ico)$/.test(f)&&f!=='worker.js';
/* changes: [{file, kind:'test'|'js'|'css'|'other', units:Set, top}] → {all, why} or {tests:Map(test → reason)} */
const pick=(map,all,changes)=>{const out=new Map(),add=(t,why)=>{if(all.includes(t)&&!out.has(t))out.set(t,why)};
  const users=(f,ok)=>[...map].filter(([,e])=>e.has(f)&&[...e.get(f)].some(ok)).map(([t])=>t);
  let real=false;
  for(const c of changes){const f=c.file;if(f===MAP)continue;
    if(FULL.test(f))return {all:true,why:f+' changed'};
    if(c.kind==='test'){add(f.slice(6),'edited');continue}
    if(c.kind==='named'){for(const t of c.tests)add(t,'names '+c.name);continue}
    if(!/\.md$/.test(f))real=true;
    for(const t of users(f,k=>k===ANY))add(t,'reads '+f);
    if(c.kind==='js'||c.kind==='css'){for(const u of c.units)for(const t of users(f,k=>k===u))add(t,(c.kind==='js'?'runs '+u+(u[0]==='@'?'':'()'):'uses the rule '+u)+' in '+f);
      if(c.top)for(const t of users(f,()=>true))add(t,'loads '+f)}
    else for(const t of users(f,k=>k===LOADED))add(t,'loads '+f);
    if(servedFile(f))add(SMOKE,'the app still starts')}
  for(const t of all){if(!map.has(t))add(t,'not in the map yet');else if(real&&map.get(t).has(ANY))add(t,'what it uses is unknown')}
  return {tests:out}};

const select=async(root,all)=>{const base=baseOf(root),map=load(root);
  if(!base)return {all:true,report:'No origin/main to compare with: running everything.'};
  if(!map)return {all:true,report:'No '+MAP+' yet: running everything.'};
  const fp=fingerprint(root,base);
  if(!fp||!stampsOf(git(root,'show',base+':'+MAP)).includes(fp))return {all:true,report:'The '+MAP+' on origin/main was not recorded for the files that are there (a change went in without it, or without a passing `npm test`): running everything.'};
  const files=changedFiles(root,base);if(!files)return {all:true,report:'git could not list the changes: running everything.'};
  const oldOf=f=>git(root,'show',base+':'+f),newOf=f=>{try{return realRead(path.join(root,f),'utf8')}catch(e){return null}};
  let corpus=null;const isNew=name=>{if(corpus==null)corpus=(git(root,'ls-tree','--name-only',base)||'').split('\n').filter(f=>/\.(?:js|html|css)$/.test(f)).map(f=>oldOf(f)||'').join('\n');
    return !new RegExp('(?<![\\w-])'+name.replace(/[^\w-]/g,'\\$&')+'(?![\\w-])').test(corpus)};
  const changes=[],said=[],scripts=fs.readdirSync(root).filter(f=>/\.js$/.test(f)).sort();
  for(const f of files){if(f===MAP)continue;
    if(/^tests\/[^/]+\.test\.js$/.test(f)){changes.push({file:f,kind:'test'});said.push(f);continue}
    const js=/\.js$/.test(f)&&!f.startsWith('tests/'),css=/\.css$/.test(f);
    if(!js&&!css){changes.push({file:f,kind:'other'});said.push(f);continue}
    const o=oldOf(f),n=newOf(f),d=o!=null&&n!=null?git(root,'diff','-U0','--no-renames',base,'--',f):null;
    let im={units:new Set(),top:true};if(d!=null){const H=hunksOf(d,o,n);im=js?await jsImpact(o,n,H):cssImpact(o,n,H,isNew)}
    changes.push({file:f,kind:js?'js':'css',...im});
    const what=[...im.units].map(u=>js&&u[0]!=='@'?u+'()':u);if(im.syms)what.push(...im.syms);if(im.top)what.push(js?'top-level code':'the stylesheet as a whole');
    said.push(f+' ('+(what.join(', ')||(js?'comments or spacing only':'only comments, spacing or rules for new classes'))+')')}
  // a changed constant: the functions that name it (worker.js and sw.js are worlds of their own, the other scripts share one), and the tests that do
  for(const c of [...changes]){if(!c.syms||!c.syms.size)continue;const alone=c.file==='worker.js'||c.file==='sw.js',sources=new Map();
    for(const g of scripts)if(alone?g===c.file:g!=='worker.js'&&g!=='sw.js'){const t=newOf(g);if(t!=null)sources.set(g,await analyse(t))}
    const fl=follow(c.file,c.syms,sources);
    for(const [g,x] of fl.files){let e=changes.find(e=>e.file===g&&e.kind==='js');if(!e){e={file:g,kind:'js',units:new Set(),top:false};changes.push(e)}for(const u of x.units)e.units.add(u);if(x.top)e.top=true}
    for(const n of fl.names){const re=nameRe(n),tests=all.filter(t=>{const src=newOf('tests/'+(t.startsWith('run.js: ')?'run.js':t));return src!=null&&re.test(src)});
      if(tests.length)changes.push({file:c.file,kind:'named',name:n,tests})}}
  const r=pick(map,all,changes);
  const head='Changed since origin/main: '+(said.join('; ')||'nothing')+'\n';
  if(r.all)return {all:true,report:head+'Running everything: '+r.why+'.'};
  const list=[...r.tests].map(([t,why])=>'  '+t+'  ('+why+')').join('\n');
  return {all:false,tests:[...r.tests.keys()],report:head+(r.tests.size?'Running '+r.tests.size+' of '+all.length+' test files and built-in suites:\n'+list:'No check can be affected by this change.')}};

/* ---------- recording what a test uses ---------- */
const recorder=root=>{let cur=null;const live=new Map(),srcs=new Map(),scans=new Map(),canon=new Map();
  const relOf=p=>{if(p instanceof URL)p=fileURLToPath(p);if(Buffer.isBuffer(p))p=p.toString();if(typeof p!=='string')return null;
    const r=path.relative(root,path.resolve(p));return !r||r.startsWith('..')||path.isAbsolute(r)||/^(?:node_modules|\.git)(?:\/|$)/.test(r)||r===MAP?null:r.split(path.sep).join('/')};
  const srcOf=f=>{if(!srcs.has(f)){let s=null;try{s=realRead(path.join(root,f),'utf8')}catch(e){}srcs.set(f,s)}return srcs.get(f)};
  const urlRel=u=>{try{const x=new URL(u);if(x.protocol==='file:')return relOf(fileURLToPath(u.split(/[?#]/)[0]));
    if(!/^(?:127\.0\.0\.1|localhost)$/.test(x.hostname))return null;const r=relOf(path.join(root,decodeURIComponent(x.pathname)));return r&&srcOf(r)!=null?r:null}catch(e){return null}};
  const mk=key=>{const m=new Map();return {key,m,bad:false,odd:0,add(f,k){if(!m.has(f))m.set(f,new Set());m.get(f).add(k)}}};
  // files the test itself reads (fixtures, sources checked as text)
  // (a root script that Node itself loads as a module is followed by its functions instead)
  const note=p=>{if(!cur)return;try{const r=relOf(p);if(!r||r===cur.self)return;
    if(/^[^/]+\.js$/.test(r)&&/node:internal\/modules/.test(new Error().stack))return;cur.add(r,ANY)}catch(e){}};
  for(const k of ['readFileSync','readFile','createReadStream']){const o=fs[k];fs[k]=function(p,...a){note(p);return o.call(this,p,...a)}}
  const pr=fs.promises.readFile;fs.promises.readFile=function(p,...a){note(p);return pr.call(this,p,...a)};
  // a function goes by the name scan() gives it (the name a diff is read with), found by where it starts; Chromium's own
  // name is only used where the two disagree (c.odd counts those)
  const addJs=(c,result,node)=>{for(const e of result){const f=urlRel(e.url);if(!f||!/\.js$/.test(f)||(node&&f.includes('/')))continue;const C=canon.get(f);
    if(e.functions.some(x=>x.ranges[0].count))c.add(f,LOADED);for(const u of units(e.functions,srcOf(f)))if(u.c){if(C&&C.has(u.a))c.add(f,C.get(u.a));else{c.odd++;c.add(f,u.n)}}}};
  const addCss=(c,L,usage)=>{for(const u of usage||[]){if(!u.used)continue;const f=urlRel(L.sheets.get(u.styleSheetId)||'');if(!f||!/\.css$/.test(f))continue;
    if(!scans.has(f))scans.set(f,cssScan(srcOf(f)));const S=scans.get(f);if(!S)continue;const r=S.rules.find(r=>r.a<=u.startOffset&&u.startOffset<r.b);if(r&&r.key)c.add(f,r.key)}};
  const take=async(page,final)=>{const L=live.get(page);if(!L)return;if(final||page.isClosed())live.delete(page);
    if(page.isClosed()){L.c.bad=true;return}   // closed behind our back: what it ran is lost
    try{addJs(L.c,(await L.s.send('Profiler.takePreciseCoverage')).result);
      const css=await L.s.send(final?'CSS.stopRuleUsageTracking':'CSS.takeCoverageDelta');addCss(L.c,L,css.ruleUsage||css.coverage)}catch(e){if(!page.isClosed())L.c.bad=true}};
  const starting=new Map();
  const start=(ctx,page)=>{if(!starting.has(page))starting.set(page,(async()=>{const c=cur;if(!c)return;
    try{const s=await ctx.newCDPSession(page),sheets=new Map();s.on('CSS.styleSheetAdded',e=>sheets.set(e.header.styleSheetId,e.header.sourceURL));
      await s.send('Profiler.enable');await s.send('Profiler.startPreciseCoverage',{callCount:false,detailed:false});
      await s.send('DOM.enable');await s.send('CSS.enable');await s.send('CSS.startRuleUsageTracking');
      // code run in a Web Worker isn't seen: the test then depends on the worker's files as a whole
      page.on('worker',w=>{const f=urlRel(w.url());if(!f)return;c.add(f,ANY);for(const m of (srcOf(f)||'').matchAll(/importScripts\(([^)]*)\)/g))for(const q of m[1].matchAll(/['"]([^'"]+)['"]/g))c.add(q[1],ANY)});
      live.set(page,{s,sheets,c});
      const pc=page.close.bind(page);page.close=async(...a)=>{await take(page,true);return pc(...a)};
      // a page load drops what the old document ran, and Chromium answers nothing while a load is pending: read it first
      for(const k of ['goto','reload','goBack','goForward','setContent']){const o=page[k].bind(page);page[k]=async(...a)=>{await take(page,false);return o(...a)}}}catch(e){c.bad=true}})());
    return starting.get(page)};
  return {
    /* a context a test opened: coverage starts before its pages can load anything, and is read before they close */
    context(ctx){if(!cur)return ctx;const np=ctx.newPage.bind(ctx),cc=ctx.close.bind(ctx);
      ctx.newPage=async(...a)=>{const p=await np(...a);await start(ctx,p);return p};ctx.on('page',p=>{start(ctx,p)});
      ctx.close=async(...a)=>{for(const p of [...live.keys()])if(p.context()===ctx)await take(p,true);return cc(...a)};return ctx},
    /* before the first test: the functions of every script, by where they start */
    async prepare(){for(const f of fs.readdirSync(root).filter(f=>/\.js$/.test(f))){const u=await scan(srcOf(f));if(u)canon.set(f,new Map(u.map(x=>[x.a,x.n])))}},
    served(f){if(cur&&f&&!/\.js$/.test(f))cur.add(f,LOADED)},
    /* what the running test has used so far (for tests/impact.test.js) */
    async peek(){for(const p of [...live.keys()])await take(p,false);return cur&&{m:cur.m,odd:cur.odd}},
    async begin(key,self){await nodeCov();await post('Profiler.takePreciseCoverage');cur=mk(key);cur.self=self||null},
    async end(){const c=cur;for(const p of [...live.keys()])await take(p,true);
      try{addJs(c,(await post('Profiler.takePreciseCoverage')).result,true)}catch(e){c.bad=true}cur=null;return {m:c.m,bad:c.bad}}}};

module.exports={MAP,ANY,LOADED,SMOKE,units,scan,jsLex,analyse,follow,hunksOf,jsImpact,cssScan,cssImpact,load,save,pick,select,recorder,fingerprint,stampsOf,prePush,installHook};

if(require.main===module&&process.argv[2]==='pre-push'){const r=prePush(path.resolve(__dirname,'..'));if(r.msg)console.error(r.msg);process.exit(r.ok?0:1)}
