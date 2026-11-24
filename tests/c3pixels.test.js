// C3's repaint (Round C, wave C3, 2026-11-24): the painter's cleanup and its move to ES modules changed every look's key on purpose,
// and no picture's pixels. This paints the same looks with main's painter files of just before (BASE) and with the checkout's, on every
// painting route this browser has, and compares the decoded pixels:
//   the Web Worker's graphics chip (asmRun), the worker's CPU (job.gl false), the page's draw for a worker without WebGL2 (asmRunPage),
//   the page's CPU and the page's own graphics chip with no worker (asmBuild on the main thread).
// The 512 test masters (tests/fixtures/cm), served by a made-up host; nothing leaves the machine. Chromium and WebKit.
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const BASE='1042e76a0e3024bb47255045f9b39df6e9c69dd1';   // main before C3's repaint (#619's merge)
module.exports=async({ok,engines,url,ROOT})=>{
  const HOST='https://w.test/',FIX=path.join(__dirname,'fixtures','cm');
  let changed=[];try{changed=execSync('git diff --name-only '+BASE,{cwd:ROOT,encoding:'utf8'}).split('\n').map(s=>s.trim()).filter(f=>/^(mq\/)?[^/]+\.(js|html)$/.test(f))}catch(e){}
  const mainSrc={};for(const f of changed){try{mainSrc[f]=execSync('git show '+BASE+':'+f,{cwd:ROOT,encoding:'utf8',maxBuffer:64e6})}catch(e){}}
  const data=f=>`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(f).toString('base64');
  const recs={};for(const kind of ['suit','vest','suit-open','shirt-tie','shirt-open','tee','cardigan']){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');recs[kind+'|'+n]=data(path.join(d,f))}}
  const looksFn=()=>{let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
    const pin={v:2,a:0,bands:[['#1b2a4a',.97],['#c8cbd2',.03]],tr:30,src:'claude+pixels'},stripe={v:2,a:-.785,bands:[['#7a2335',.6],['#1b2a4a',.4]],tr:6,src:'claude+pixels'};
    const fig={v:3,motif:{grid:'square',ground:'#f2f2f2',figs:[{shape:'dot',place:'centre',size:.3,cols:['#4a5a8a']}]},a:0,cr:40,tr:60,src:'claude+pixels'};
    const J=[I('suit','navy'),I('suit','charcoal',{pattern:'pinstripe',secondaryColor:'white',sett:pin}),I('suit','grey',{pattern:'herringbone'}),I('suit','slate',{pattern:'tweed'}),I('suit','grey',{pattern:'houndstooth'}),I('blazer','khaki',{pattern:'windowpane',secondaryColor:'lightblue'}),I('blazer','navy',{material:'linen'}),I('suit','black',{pattern:'twill'})];
    const S=[I('shirt','white'),I('shirt','pink',{pattern:'herringbone'}),I('shirt','lightblue',{pattern:'dobby'}),I('shirt','white',{pattern:'dobby',sett:fig})];
    const T=[I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'burgundy',sett:stripe}),I('tie','green',{pattern:'paisley',secondaryColor:'gold'}),I('tie','charcoal',{pattern:'knit'}),I('tie','black')];
    const P=[I('pants','khaki'),I('pants','grey',{pattern:'twill'}),I('pants','denim',{trouserKind:'jeans'})],belt=I('belt','brown',{leather:'calf'}),shoes=I('shoes','brown',{leather:'calf'});
    const W=[I('watch','silver',{metal:'silver',dial:'white',band:'integrated'}),I('watch','brown',{metal:'gold',dial:'charcoal',band:'leather'})],clip=I('tieclip','silver'),sq=I('pocketsquare','burgundy',{pattern:'paisley',material:'silk',secondaryColor:'gold'});
    const L=[];J.forEach((j,i)=>L.push({top:j,shirt:S[i%S.length],tie:T[i%T.length],watch:W[i%2],clip:i%3?null:clip,pocket:i%2?sq:null}));
    L.push({top:{...J[0],id:'vs',vest:'yes'},vest:true,shirt:S[1],tie:T[2],watch:W[1]});L.push({top:J[2],shirt:S[0],watch:W[0]});
    P.forEach((b,i)=>{L.push({shirt:S[i],tie:T[i],bot:b,belt,shoes,watch:W[i%2]});L.push({shirt:S[i+1],bot:b,belt,shoes,watch:W[(i+1)%2]})});
    L.push({shirt:I('tee','red'),bot:P[0],belt,watch:W[0]});L.push({top:I('cardigan','grey'),shirt:S[0],watch:W[0]});
    return {looks:L,items:[...J,...S,...T,...P,belt,shoes,...W,clip,sq]}};
  const pageRun=async src=>{const {looks,items:its}=new Function('return ('+src+')')()();items=its;
    const h=s=>{let a=0x811c9dc5,b=0x9747b28c;for(let i=0;i<s.length;i++){const c=typeof s==='string'?s.charCodeAt(i):s[i];a=Math.imul(a^c,16777619)>>>0;b=Math.imul(b^c,2246822519)>>>0}return a.toString(16)+'.'+b.toString(16)};
    const px=async u=>{const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data};
    const st0=asmWorker();await new Promise(ok=>{const t=setInterval(()=>{if(!st0||st0.ok!=null){clearInterval(t);ok()}},20)});
    const st=asmW,env={worker:!!(st&&st.ok),wgl:!!(st&&st.gl)};await asmListGet(true);await asmCmMfGet(true);const out=[];
    for(const o of looks){const r={routes:{}};
      try{await asmCmLook(o);const k=asmKindOf(o);if(!k||!await asmNkGet(o,k)){r.err='no master';out.push(r);continue}
        r.key=asmOutKey(o);const job=await asmJob(o);if(!job){r.err='no job';out.push(r);continue}job.diskCache=false;
        for(const R of ['wgl','wcpu','pdraw','pcpu','pgl']){let b=null;
          try{if(R==='wgl'){if(!env.wgl)continue;b=await asmRun({...job},true)}else if(R==='wcpu'){if(!env.worker)continue;b=await asmRun({...job,gl:false},true)}
            else if(R==='pdraw'){if(!env.worker)continue;const keep=asmW.gl;asmW.gl=false;try{if(!asmGlOnPage(job,asmW))continue;b=await asmRun({...job},true)}finally{asmW.gl=keep}}
            else if(R==='pcpu')b=await asmBuild({...job,gl:false});else b=await asmBuild({...job})}catch(e){r.routes[R]='error: '+String(e&&e.message||e).slice(0,80);continue}
          r.routes[R]=b&&b.url?(b.gl?'gl ':'cpu ')+h(await px(b.url)):'no picture'}}
      catch(e){r.err=String(e&&e.message||e).slice(0,120)}out.push(r)}
    return {env,out}};
  for(const [eng,launch] of engines){const browser=await launch();
    try{const runOn=async src=>{const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});let served={};
        const origin=new URL(url).origin;
        if(src)await ctx.route(origin+'/**',route=>{const f=decodeURIComponent(new URL(route.request().url()).pathname.slice(1))||'index.html';
          if(src[f]!=null)return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':'text/javascript',body:src[f]});return route.continue()});
        await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(x,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(x)});
          if(route.request().method()!=='GET')return j({ok:true});if(u.pathname==='/render'&&u.searchParams.get('list'))return j({keys:Object.keys(served)});
          if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
          if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
        const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
        await p.goto(url);await p.waitForFunction(()=>window.appReady);
        const kmap=await p.evaluate(ks=>{const o={};for(const k of ks){const [kind,n]=k.split('|');o[k]=asmCmKey(kind,n)}return o},Object.keys(recs));
        const bg=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,512,512);g.addColorStop(0,'#e9e4dc');g.addColorStop(1,'#cfc6b8');x.fillStyle=g;x.fillRect(0,0,512,512);return {k:asmCmBgKey(),img:c.toDataURL('image/png')}});
        const mf={};for(const [k,img] of Object.entries(recs)){served[kmap[k]]={sig:'asm/cm test',img,model:'colormaster',t:1000};mf[kmap[k]]=1000}
        served[bg.k]={sig:'asm/cm bg',img:bg.img,model:'colormaster',t:1000};mf[bg.k]=1000;
        const mfk=await p.evaluate(()=>asmCmMfKey());served[mfk]={sig:'asm/cm-manifest '+JSON.stringify({keys:mf}),img:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',model:'manifest',t:1000};
        await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');ASM_ON=true;self.ASM_CM_SIZE=512;asmAheadSoon=()=>{};asmAhead=async()=>{}},HOST);
        const r=await p.evaluate(pageRun,String(looksFn));await ctx.close();return {...r,errs}};
      const A=await runOn(mainSrc),B=await runOn(null),T=eng==='webkit'?'WebKit: ':'';
      ok(Object.keys(mainSrc).length>=16,`${T}main's painter files of just before C3 are served to the first page (${Object.keys(mainSrc).length} files)`);
      ok(A.out.length>=20&&A.out.every(r=>!r.err)&&B.out.every(r=>!r.err),`${T}${A.out.length} looks painted on both (${[...A.out,...B.out].filter(r=>r.err).map(r=>r.err).join('; ')||'no errors'})`);
      ok(A.out.every((r,i)=>r.key!==B.out[i].key),`${T}every look's key is new (C3's one planned repaint)`);
      const routes=['wgl','wcpu','pdraw','pcpu','pgl'],names={wgl:'the worker\'s graphics chip',wcpu:'the worker\'s CPU',pdraw:'the page\'s draw (a worker without WebGL2)',pcpu:'the page\'s CPU',pgl:'the page\'s own graphics chip'};
      for(const R of routes){const n=A.out.filter(r=>r.routes[R]).length,diff=A.out.map((r,i)=>r.routes[R]!==B.out[i].routes[R]?i:-1).filter(i=>i>=0);
        if(!n&&!B.out.some(r=>r.routes[R])){ok(true,`${T}${names[R]}: not in this browser (worker ${A.env.worker}, its WebGL2 ${A.env.wgl})`);continue}
        ok(!diff.length&&A.out.every(r=>!r.routes[R]||!/^error|no picture/.test(r.routes[R])),`${T}${names[R]}: ${n-diff.length} of ${n} pictures pixel for pixel main's${diff.length?' (differ: '+diff.map(i=>i+' '+A.out[i].routes[R]+' / '+B.out[i].routes[R]).slice(0,4).join('; ')+')':''}`)}
      ok(!A.errs.length&&!B.errs.length,`${T}no page errors (${[...A.errs,...B.errs].join('; ')})`)}
    finally{await browser.close()}}
};
module.exports.assembled=true;   // builds colour-coded pictures (assemble.js)
