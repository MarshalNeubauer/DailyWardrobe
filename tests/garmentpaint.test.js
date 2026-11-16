// The new garments' masters (2026-11-16, asm-kinds.js): every existing look keeps its picture key byte for byte (origin/main's app files
// served to a second page, the same looks keyed in both; jeans change only once the faded master is in the manifest), the painter's code
// fingerprints are main's, the new kinds' keys carry their kind and differ, a kind whose master isn't on the worker paints nothing, each new
// kind is painted at 512 in the real Web Worker on its fixture (tests/fixtures/cm/<kind>/) in the garment's colour, the sweater knit's
// stitches repeat at a stitch, jeans take the faded master, and tools/asm-cm-upload.js puts the new records under the app's keys.
const fs=require('fs'),path=require('path'),{execSync,spawnSync}=require('child_process');
const NEW=['tee','polo','henley','sweater','sweatshirt','hoodie','qzip','cardigan','chore'];
module.exports=async({ok,chromium,url,ROOT})=>{
  const FIX=path.join(__dirname,'fixtures','cm'),HOST='https://w.test/';
  // the app as it was just before the new garments merged (#511's first parent): comparing with origin/main found nothing to compare
  // once the garments were on main
  const BASE='0739984751a64d7a85444dc63a3e1f84326e7bb3';
  let changed=[];try{changed=execSync('git diff --name-only '+BASE,{cwd:ROOT,encoding:'utf8'}).split('\n').map(s=>s.trim()).filter(f=>/^[^/]+\.(js|html)$/.test(f))}catch(e){}
  const mainSrc={};for(const f of changed){try{mainSrc[f]=execSync('git show '+BASE+':'+f,{cwd:ROOT,encoding:'utf8',maxBuffer:64e6})}catch(e){}}
  const browser=await chromium.launch();
  try{
    // ---- the same looks keyed on main's files and on the branch's ----
    const looksFn=()=>{let n=0;const I=(type,primaryColor,x={})=>({id:'k'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const pin={v:2,a:0,bands:[['#1b2a4a',.97],['#c8cbd2',.03]],tr:30,src:'claude+pixels'};
      const J=[I('suit','navy'),I('suit','charcoal',{pattern:'pinstripe',secondaryColor:'white',sett:pin}),I('suit','grey',{pattern:'herringbone'}),I('blazer','khaki',{pattern:'windowpane',secondaryColor:'lightblue'}),I('suit','navy',{vest:'yes'})];
      const S=[I('shirt','white'),I('shirt','pink',{pattern:'herringbone'}),I('shirt','lightblue',{pattern:'stripe',secondaryColor:'white'})],T=[I('tie','burgundy'),I('tie','navy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','charcoal',{pattern:'knit'})];
      const P=[I('pants','khaki',{trouserKind:'chinos'}),I('pants','grey',{pattern:'twill'}),I('pants','denim',{trouserKind:'jeans'}),I('pants','navy',{trouserKind:'jeans',material:'denim'}),I('pants','olive',{trouserKind:'cargo'})];
      const belt=I('belt','brown',{leather:'calf'}),W=[I('watch','silver',{metal:'silver',dial:'white',band:'integrated'}),I('watch','brown',{metal:'gold',dial:'charcoal',band:'leather'})],clip=I('tieclip','silver');
      const L=[];J.forEach((j,a)=>S.forEach((s,b)=>{L.push({top:j,shirt:s,tie:T[(a+b)%3],watch:W[a%2],clip:a%2?clip:null,vest:j.vest==='yes'});L.push({top:j,shirt:s,watch:W[b%2]})}));
      P.forEach((p,a)=>S.forEach((s,b)=>{L.push({shirt:s,bot:p,belt,watch:W[(a+b)%2]});L.push({shirt:s,bot:p,belt,tie:T[b],watch:W[a%2]})}));
      return L};
    const keysOf=async(p,mf)=>p.evaluate(([src,mf])=>{const L=new Function('return ('+src+')()')();asmCmMf={keys:mf||{}};
      return {keys:L.map(o=>asmCmOutKey(o)),jeans:L.map(o=>!!(o.bot&&o.bot.trouserKind==='jeans')),code:asmCmCodeSig(),src:asmCmSrcSig(),kindsJson:JSON.stringify(ASM_CM_KINDS),btnJson:JSON.stringify(ASM_CM_BTN)}},[String(looksFn),mf]);
    const origin=new URL(url).origin;
    const mctx=await browser.newContext({viewport:{width:390,height:844}});
    await mctx.route(origin+'/**',route=>{const f=decodeURIComponent(new URL(route.request().url()).pathname.slice(1))||'index.html';
      if(mainSrc[f]!=null)return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':'text/javascript',body:mainSrc[f]});return route.continue()});
    const mp=await mctx.newPage(),bp=await browser.newPage(),errs=[];bp.on('pageerror',e=>errs.push(e.message));
    await mp.goto(url);await mp.waitForFunction(()=>window.appReady);await bp.goto(url);await bp.waitForFunction(()=>window.appReady);
    const mfKeys=await bp.evaluate(()=>{const o={};for(const k of ['suit','vest','suit-open','shirt-tie','shirt-open'])for(const n of ['master','mask/shirt','geo/u','geo/v','light'])o[asmCmKey(k,n)]=1234;return o});
    const m=await keysOf(mp,mfKeys),b=await keysOf(bp,mfKeys);
    const diff=m.keys.map((k,i)=>k!==b.keys[i]?i:-1).filter(i=>i>=0);
    ok(Object.keys(mainSrc).length>0,`origin/main's versions of the changed app files are served to the first page (${Object.keys(mainSrc).sort().join(', ')})`);
    ok(m.keys.length>=60&&!diff.length,`every existing look keeps its picture key: ${m.keys.length} looks (suits, waistcoats, open collars, shirt and tie, open shirt; patterned cloth, a gold watch, a clip, chinos, jeans, cargo), ${diff.length} differ`);
    ok(m.code===b.code&&m.src===b.src,`the painter's code fingerprints are main's (asmCmCodeSig ${b.code}, asmCmSrcSig ${b.src})`);
    ok(m.kindsJson===b.kindsJson&&m.btnJson===b.btnJson,'ASM_CM_KINDS and ASM_CM_BTN read as on main (the new kinds are not enumerable)');
    // jeans: once the faded master is in the manifest, only looks with jeans on the open shirt or shirt-and-tie masters change
    const jf=await bp.evaluate(mf=>{const o={...mf};for(const k of ['shirt-open','shirt-tie',...ASM_JF_BASES])o[asmJfKey(k)]=5678;return o},mfKeys);
    const bj=await keysOf(bp,jf),mj=await keysOf(mp,jf);
    const chg=bj.keys.map((k,i)=>k!==mj.keys[i]?i:-1).filter(i=>i>=0);
    ok(chg.length>0&&chg.every(i=>bj.jeans[i])&&bj.jeans.every((j,i)=>!j||chg.includes(i)),`with the faded masters listed, exactly the jeans looks get new keys (${chg.length} of ${bj.jeans.filter(Boolean).length} jeans looks; none other)`);
    // ---- the new kinds' keys ----
    const nk=await bp.evaluate(NEW=>{let n=0;const I=(type,primaryColor,x={})=>({id:'n'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const shirt=I('shirt','white'),bot=I('pants','khaki',{trouserKind:'chinos'}),belt=I('belt','brown'),watch=I('watch','silver',{metal:'silver',dial:'white'}),tie=I('tie','navy'),suit=I('suit','navy');
      const r={};for(const t of NEW){const it=I(t,'navy');const jk=t==='cardigan'||t==='chore';const o=jk?{top:it,shirt,watch}:{shirt:it,bot,belt,watch};
        r[t]={kind:asmCmKindOf(o),sig:asmCmSig(o).split('|').slice(0,3).join('|'),key:asmCmOutKey(o),use:asmCmUse(o),
          withTie:asmCmKindOf({...o,tie}),underJacket:jk?null:asmCmKindOf({...o,top:suit}),mannequin:figKind(o)}}
      r.base=asmCmOutKey({shirt,bot,belt,watch});r.cardOverTee=asmCmKindOf({top:I('cardigan','grey'),shirt:I('tee','white'),watch});return r},NEW);
    ok(NEW.every(t=>nk[t].kind===t&&nk[t].sig.startsWith(t+'|')&&/\|nk/.test(nk[t].sig)),'each new garment is painted on its own master, its kind and the new painter code in its key');
    ok(new Set(NEW.map(t=>nk[t].key).concat(nk.base)).size===NEW.length+1,'the new kinds\' keys differ from each other and from the open-shirt look');
    ok(NEW.every(t=>nk[t].use===null),'a new kind whose master is not on the worker paints nothing (the day shows the drawing)');
    ok(NEW.every(t=>nk[t].withTie===null)&&NEW.filter(t=>nk[t].underJacket!==null).every(t=>t==='cardigan'||t==='chore')&&nk.cardOverTee===null,'a casual piece with a tie, a casual top under a jacket or a cardigan over a T-shirt has no master');
    ok(NEW.every(t=>['shirt-open','suit-open'].includes(nk[t].mannequin)),'the mannequin keeps the base pose (figKind)');
    // ---- the sweater knit tile: its stitches repeat at one stitch, not at half of one ----
    const kn=await bp.evaluate(()=>{const ac=(T,dx,dy)=>{const {TW,TH,t}=T;let s=0,s2=0,c=0,n=TW*TH,y=new Float32Array(n);for(let k=0;k<n;k++){y[k]=t[3*k]+t[3*k+1]+t[3*k+2];s+=y[k];s2+=y[k]*y[k]}
        const m=s/n,v=s2/n-m*m;for(let yy=0;yy<TH;yy++)for(let x=0;x<TW;x++)c+=(y[yy*TW+x]-m)*(y[((yy+dy)%TH)*TW+(x+dx)%TW]-m);return c/n/v};
      const K=ASM_NK_KNIT,it={id:'s',type:'sweater',primaryColor:'navy',pattern:'solid',material:'merino wool'},T=asmNkKnitTile(it),C=asmNkKnitTile({...it,pattern:'cable'}),S=asmNkKnitTile({...it,pattern:'stripe',secondaryColor:'cream'});
      const mean=T2=>{let a=[0,0,0];for(let k=0;k<T2.TW*T2.TH;k++)for(let q=0;q<3;q++)a[q]+=T2.t[3*k+q];return a.map(v=>v/(T2.TW*T2.TH))},lin=asmNkLin(colOf(it)),mt=mean(T);
      return {one:ac(T,K.cw,0),half:ac(T,K.cw/2,0),row:ac(T,0,K.ch),mm:T.mm,mmL:asmNkKnitTile({...it,material:'shetland wool'}).mm,mean:mt.map((v,q)=>v/lin[q]),cableDiff:C.t.some((v,k)=>Math.abs(v-T.t[k])>.02),stripe:S.t.some((v,k)=>Math.abs(v-T.t[k])>.05),
        fleece:asmNkCloth({type:'hoodie',primaryColor:'grey',pattern:'solid'},'hoodie',{hex:'#888'}),tee:asmNkCloth({type:'tee',primaryColor:'grey',pattern:'stripe',secondaryColor:'navy'},'tee',{hex:'#888'}).tile}});
    ok(kn.one>.5&&kn.row>.5&&kn.half<kn.one-.3,`the sweater knit repeats at one stitch across and one row down (correlation ${kn.one.toFixed(2)} / ${kn.row.toFixed(2)}, at half a stitch ${kn.half.toFixed(2)})`);
    ok(kn.mean.every(v=>Math.abs(v-1)<.02)&&kn.mm===24&&kn.mmL>kn.mm,`the knit keeps the item's colour on average and its stitch size follows the yarn (merino ${kn.mm/8} mm, shetland ${kn.mmL/8} mm a stitch)`);
    ok(kn.cableDiff&&kn.stripe,'cable and stripe sweaters have their own knit tiles');
    ok(!kn.fleece.tile&&kn.fleece.mat[1]<.5&&kn.tee&&kn.tee.TH>kn.tee.TW,'a plain hoodie is matte fleece with no texture; a striped T-shirt has its bands');
    // ---- each new kind painted in the Web Worker on its 512 fixture, and jeans on the faded master ----
    const ctx=await browser.newContext({viewport:{width:390,height:844}});const served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(route.request().method()!=='GET')return j({ok:true});if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const recs={};const add=(kind,n,f)=>{recs[kind+'|'+n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(f).toString('base64'),model:'colormaster',t:1000}};
    for(const kind of ['shirt-open','suit-open',...NEW]){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d))add(kind,f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'),path.join(d,f))}
    for(const kind of ['shirt-open','tee'])add(kind,'master-jeans',path.join(FIX,'jeans',kind+'.jpg'));
    const kmap=await p.evaluate(ks=>{const o={};for(const k of ks){const [kind,n]=k.split('|');o[k]=asmCmKey(kind,n)}return o},Object.keys(recs));
    for(const [k,r] of Object.entries(recs))served[kmap[k]]=r;
    const mfk=await p.evaluate(()=>({mf:asmCmMfKey(),j1:asmJfKey('shirt-open'),j2:asmJfKey('tee'),bg:asmCmBgKey()}));served[mfk.bg]={...recs['shirt-open|master'],sig:'asm/cm bg'};
    served[mfk.mf]={sig:'asm/cm-manifest '+JSON.stringify({keys:{[mfk.j1]:1000,[mfk.j2]:1000}}),img:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',model:'manifest',t:1000};
    const res=await p.evaluate(async([h,NEW])=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;asmAheadSoon=()=>{};asmAhead=async()=>{};
      let n=0;const I=(type,primaryColor,x={})=>({id:'p'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const shirt=I('shirt','white'),chinos=I('pants','khaki',{trouserKind:'chinos'}),jeans=I('pants','denim',{trouserKind:'jeans'}),belt=I('belt','brown'),watch=I('watch','silver',{metal:'silver',dial:'white',band:'integrated'});
      const px=async u=>{const d=await asmData(u,512);return d.data};
      const out=[];await asmCmMfGet(true);
      const paint=async(name,o)=>{const r={name};try{await asmCmLook(o);const k=asmKindOf(o);r.kind=k;if(!await asmNkGet(o,k)){r.err='records not here';return r}
          const job=await asmJob(o);if(!job){r.err='no job';return r}r.mk=job.mk;r.cm=job.cm;r.tile=!!(job.cloth.shirt&&job.cloth.shirt.tile||job.cloth.jacket&&job.cloth.jacket.tile);r.gl=typeof asmGlWhy==='function'?asmGlWhy(job,{}):'';
          const b=await asmRun(job,true);r.ok=!!(b&&(b.url||b.px));r.usedGl=!!(b&&b.gl);if(b&&b.gl&&b.url){const c=await asmRun({...job,gl:false},true);if(c&&c.url&&!c.gl){const x=await px(b.url),y=await px(c.url);let s=0;for(let k=0;k<x.length;k+=4)s+=Math.abs(x[k]-y[k])+Math.abs(x[k+1]-y[k+1])+Math.abs(x[k+2]-y[k+2]);r.glDiff=s/(x.length/4*3)}}if(b&&b.url){const z=job.cm,mz=ASM_NK[z]&&ASM_NK[z].base==='suit-open'?'jacket':'shirt',m=await px(renders[asmCmKey(z,'mask/'+mz)].img),d=await px(b.url);
            let s=[0,0,0],c=0;for(let k=0;k<512*512;k++)if(m[4*k]>250){for(let q=0;q<3;q++)s[q]+=d[4*k+q];c++}r.mean=s.map(v=>Math.round(v/Math.max(1,c)))}}
        catch(e){r.err=String(e&&e.message||e)}return r};
      for(const t of NEW){const it=I(t,t==='chore'?'rust':'red',t==='sweater'?{material:'lambswool'}:{});const jk=t==='cardigan'||t==='chore';out.push(await paint(t,jk?{top:it,shirt,watch}:{shirt:it,bot:chinos,belt,watch}))}
      out.push(await paint('open shirt, jeans',{shirt,bot:jeans,belt,watch}));out.push(await paint('T-shirt, jeans',{shirt:I('tee','white'),bot:jeans,belt,watch}));
      out.push(await paint('striped T-shirt',{shirt:I('tee','white',{pattern:'stripe',secondaryColor:'navy'}),bot:chinos,belt,watch}));
      out.push(await paint('cable sweater',{shirt:I('sweater','cream',{pattern:'cable'}),bot:chinos,belt,watch}));
      return {out,jk:[asmJfKey('shirt-open'),asmJfKey('tee')],offPage:asmOffPage()}},[HOST,NEW]);
    const bad=res.out.filter(r=>!r.ok);
    ok(!bad.length,`every new kind (and jeans, a striped T-shirt, a cable sweater) is painted in the Web Worker: ${res.out.map(r=>r.name+(r.ok?'':' ('+(r.err||'no picture')+')')).join(', ')}`);
    const red=res.out.filter(r=>NEW.includes(r.name));
    ok(red.every(r=>r.mean&&r.mean[0]>r.mean[1]+25&&r.mean[0]>r.mean[2]+15),`each garment's zone is painted in its colour (red; rust for the chore jacket): ${red.map(r=>r.name+' '+(r.mean||[]).join('/')).join(', ')}`);
    ok(res.out.filter(r=>NEW.includes(r.name)).every(r=>r.cm===r.name),'each painted on its own master (job.cm)');
    ok(res.out.find(r=>r.name==='open shirt, jeans').mk===res.jk[0]&&res.out.find(r=>r.name==='T-shirt, jeans').mk===res.jk[1],'jeans are painted on the faded master (shirt-open and a T-shirt)');
    ok(['sweater','qzip','cardigan'].every(t=>res.out.find(r=>r.name===t).tile)&&!res.out.find(r=>r.name==='tee').tile&&res.out.find(r=>r.name==='striped T-shirt').tile,'knits carry the knit tile, a plain T-shirt none, a striped one its bands');
    {const any=res.out.some(r=>r.usedGl);ok(!any||(res.out.filter(r=>[...NEW.slice(0,7),'chore','striped T-shirt','cable sweater'].includes(r.name)).every(r=>r.usedGl)&&!res.out.find(r=>r.name==='cardigan').usedGl),any?`the tops and the chore jacket are painted on the graphics chip, the cardigan's knit on the CPU (${res.out.map(r=>r.name+':'+(r.usedGl?'gl':'cpu')).join(', ')})`:'(no graphics chip in this browser)')}
    const gd=res.out.filter(r=>r.glDiff!=null);ok(!gd.length||gd.every(r=>r.glDiff<2.5),gd.length?`graphics chip and CPU agree on the new tops (mean difference `+gd.map(r=>r.name+' '+r.glDiff.toFixed(2)).join(', ')+')':'(no graphics chip in this browser: CPU only)');
    ok(res.offPage,'painted in the Web Worker');
    // ---- the upload script: the new kinds' records and the faded master under the app's keys ----
    {const os=require('os'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cmnk-')),d=path.join(tmp,'out-tee');fs.mkdirSync(d);const src=path.join(FIX,'tee');
      fs.copyFileSync(path.join(src,'master.jpg'),path.join(d,'colormaster-2880.png'));fs.copyFileSync(path.join(FIX,'jeans','tee.jpg'),path.join(d,'colormaster-jeans-2880.png'));
      for(const f of fs.readdirSync(src)){if(f.startsWith('mask-'))fs.copyFileSync(path.join(src,f),path.join(d,'alpha-'+f.slice(5)));if(f.startsWith('part-'))fs.copyFileSync(path.join(src,f),path.join(d,'sleeve-'+f.slice(5)))}
      const r=spawnSync(process.execPath,[path.join(__dirname,'..','tools','asm-cm-upload.js'),'--dir',tmp,'--dry','--kinds','tee'],{encoding:'utf8'});
      const want=await bp.evaluate(()=>({m:asmCmKey('tee','master'),j:asmJfKey('tee')}));
      ok(r.status===0&&r.stdout.includes('tee master -> '+want.m)&&r.stdout.includes('tee master-jeans -> '+want.j)&&(r.stdout.match(/^tee mask\//gm)||[]).length===8,`cm-upload puts a new kind's master, its 8 masks and its faded master under the app's keys (${(r.stdout.match(/^tee /gm)||[]).length} records; ${r.stderr.trim()})`);
      fs.rmSync(tmp,{recursive:true,force:true})}
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.assembled=true;   // builds colour-coded pictures (assemble.js)
