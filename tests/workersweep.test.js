// Every kind of garment the colour-coded painter handles, painted in the real Web Worker (2026-11-14: two watch-painter bugs reached code
// only the worker runs, where page-only names are missing; a tester's gold watch found the second before a test did). On the suit and the
// shirt-and-tie test masters (512 px, tests/fixtures/cm/): jacket cloths (plain, a read pinstripe, twill, herringbone, tweed, the micro
// weaves, windowpane, glen check), shirts (plain, weaves, a read figure), ties (plain, a read stripe, dots, paisley, knit, foulard, woven,
// check), trousers on a no-jacket day, clips (silver, enamel) and watches (the masters' Seiko, gold on leather, a black dial, rose gold).
// Each look is built through the worker (asmRun) and must come back as a picture.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url})=>{
  const HOST='https://w.test/',FIX=path.join(__dirname,'fixtures','cm');
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const recs={};for(const kind of ['suit','shirt-tie','vest','suit-open','shirt-open']){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d)){const n=f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/');
      recs[kind+'|'+n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(path.join(d,f)).toString('base64'),model:'colormaster',t:1000}}}
    const keys=await p.evaluate(rs=>{const o={};for(const k of Object.keys(rs)){const [kind,n]=k.split('|');o[k]=asmCmKey(kind,n)}return o},Object.fromEntries(Object.keys(recs).map(k=>[k,1])));
    for(const [k,r] of Object.entries(recs))served[keys[k]]=r;
    const res=await p.evaluate(async h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;HOOK.asmAheadSoon=()=>{};HOOK.asmAhead=async()=>{};
      let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const pin={v:2,a:0,bands:[['#1b2a4a',.97],['#c8cbd2',.03]],tr:30,src:'claude+pixels'},stripe={v:2,a:-.785,bands:[['#7a2335',.6],['#1b2a4a',.4]],tr:6,src:'claude+pixels'};
      const fig={v:3,motif:{grid:'square',ground:'#f2f2f2',figs:[{shape:'dot',place:'centre',size:.3,cols:['#4a5a8a']}]},a:0,cr:40,tr:60,src:'claude+pixels'};
      const jackets=[I('suit','navy'),I('suit','charcoal',{pattern:'pinstripe',secondaryColor:'white',sett:pin}),I('suit','midgrey',{pattern:'twill'}),I('suit','grey',{pattern:'herringbone'}),
        I('suit','slate',{pattern:'tweed'}),I('suit','grey',{pattern:'houndstooth'}),I('suit','charcoal',{pattern:'sharkskin'}),I('suit','navy',{pattern:'birdseye'}),I('suit','grey',{pattern:'nailhead'}),
        I('blazer','khaki',{pattern:'windowpane',secondaryColor:'lightblue'}),I('blazer','grey',{pattern:'glen-check'})];
      const shirts=[I('shirt','white'),I('shirt','pink',{pattern:'herringbone'}),I('shirt','lightblue',{pattern:'dobby'}),I('shirt','white',{pattern:'dobby',sett:fig})];
      const ties=[I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'burgundy',sett:stripe}),I('tie','navy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','green',{pattern:'paisley',secondaryColor:'gold'}),
        I('tie','charcoal',{pattern:'knit'}),I('tie','purple',{pattern:'foulard',secondaryColor:'navy'}),I('tie','charcoal',{pattern:'woven'}),I('tie','grey',{pattern:'check',secondaryColor:'black'})];
      const pants=[I('pants','khaki'),I('pants','grey',{pattern:'twill'}),I('pants','navy',{pattern:'pinstripe',secondaryColor:'white',sett:pin})],belt=I('belt','brown',{leather:'calf'}),shoes=I('shoes','brown',{leather:'calf'});
      const watches=[I('watch','silver',{metal:'silver',dial:'white',band:'integrated'}),I('watch','brown',{metal:'gold',dial:'charcoal',band:'leather'}),I('watch','silver',{metal:'silver',dial:'black',band:'bracelet'}),I('watch','rosegold',{metal:'gold',dial:'cream',band:'bracelet'})];
      const clips=[I('tieclip','silver'),I('tieclip','blue'),I('tieclip','red')];
      HOOK.items=[...jackets,...shirts,...ties,...pants,belt,shoes,...watches,...clips];
      const looks=[];
      jackets.forEach((j,i)=>looks.push({name:'jacket '+j.pattern+' '+j.primaryColor,o:{top:j,shirt:shirts[i%shirts.length],tie:ties[i%ties.length],watch:watches[0]}}));
      shirts.forEach((s,i)=>looks.push({name:'shirt '+s.pattern+(s.sett?' (read)':''),o:{top:jackets[0],shirt:s,tie:ties[0],watch:watches[0]}}));
      ties.forEach((t,i)=>looks.push({name:'tie '+t.pattern+(t.sett?' (read)':''),o:{top:jackets[2],shirt:shirts[0],tie:t,watch:watches[0]}}));
      watches.forEach((w,i)=>looks.push({name:'watch '+(w.metal)+' '+(w.dial)+' '+(w.band)+' (jacket)',o:{top:jackets[0],shirt:shirts[0],tie:ties[0],watch:w}}));
      clips.forEach(c=>looks.push({name:'clip '+c.primaryColor,o:{top:jackets[9],shirt:shirts[0],tie:ties[1],watch:watches[1],clip:c}}));
      pants.forEach((b,i)=>looks.push({name:'no jacket: trousers '+b.pattern+' '+b.primaryColor,o:{shirt:shirts[i%shirts.length],tie:ties[i%ties.length],bot:b,belt,shoes,watch:watches[i%watches.length]}}));
      watches.forEach(w=>looks.push({name:'watch '+w.metal+' '+w.dial+' '+w.band+' (shirt and tie)',o:{shirt:shirts[0],tie:ties[0],bot:pants[0],belt,shoes,watch:w}}));
      // the waistcoat master (a suit with its waistcoat), the open-collar jacket (no tie) and the open-collar shirt (no jacket, no tie)
      const suits=jackets.filter(j=>j.type==='suit');suits.forEach(s=>s.vest='yes');
      suits.forEach((s,i)=>looks.push({name:'waistcoat day: '+s.pattern+' '+s.primaryColor,o:{top:s,vest:true,shirt:shirts[i%shirts.length],tie:ties[i%ties.length],watch:watches[i%watches.length]}}));
      jackets.forEach((j,i)=>looks.push({name:'open collar, jacket '+j.pattern+' '+j.primaryColor,o:{top:j,shirt:shirts[i%shirts.length],watch:watches[i%watches.length]}}));
      pants.forEach((b,i)=>looks.push({name:'open collar, no jacket: trousers '+b.pattern+' '+b.primaryColor,o:{shirt:shirts[i%shirts.length],bot:b,belt,shoes,watch:watches[(i+1)%watches.length]}}));
      watches.forEach(w=>{looks.push({name:'watch '+w.metal+' '+w.dial+' '+w.band+' (waistcoat)',o:{top:suits[0],vest:true,shirt:shirts[0],tie:ties[0],watch:w}});
        looks.push({name:'watch '+w.metal+' '+w.dial+' '+w.band+' (open collar)',o:{top:jackets[0],shirt:shirts[0],watch:w}});
        looks.push({name:'watch '+w.metal+' '+w.dial+' '+w.band+' (open shirt)',o:{shirt:shirts[0],bot:pants[0],belt,shoes,watch:w}})});
      const out=[];await asmListGet(true);
      for(const L of looks){const k=asmCmKind(L.o);let r={name:L.name,kind:k};
        try{await HOOK.asmCmLook(L.o);if(!await asmCmGet(k)){r.err='master not here';out.push(r);continue}const job=await HOOK.asmJob(L.o);if(!job){r.err='no job';out.push(r);continue}
          const t0=performance.now(),b=await asmRun(job,true);r.ok=!!(b&&(b.url||b.px));r.ms=Math.round(performance.now()-t0);r.watch=!!job.watch}catch(e){r.err=String(e&&e.message||e)}out.push(r)}
      return {offPage:HOOK.asmOffPage(),out}},HOST);
    const bad=res.out.filter(r=>!r.ok);
    ok(res.offPage,'the looks are built in the Web Worker');
    const kinds=[...new Set(res.out.map(r=>r.kind))].sort().join(',');
    ok(res.out.length>=72&&kinds==='shirt-open,shirt-tie,suit,suit-open,vest',`${res.out.length} looks swept on all five masters (${kinds}; ${res.out.filter(r=>r.watch).length} with a painted watch)`);
    ok(!bad.length,`every one comes back as a picture from the worker${bad.length?': '+bad.map(r=>`${r.name} (${r.kind}): ${r.err||'no picture'}`).join('; '):''}`);
    ok(errs.length===0,'no page errors: '+errs.join(' | '));
  }finally{await browser.close()}
};
module.exports.assembled=true;   // builds colour-coded pictures (assemble.js)
