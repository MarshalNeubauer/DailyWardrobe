// The uniform blouse (2026-11-17, the owner's OCP coat; asm-ocp.js, core.js ocpImage/isOcp/camoPants, draw.js blouseMarks): the type and
// its lists, the fixed OCP look (palette, shares, seamless, the same for the blouse and OCP pants), hand-pick only, its score with camouflage
// pants only, the picker listing it last with the reason otherwise, Today's Sleeves row (rec.roll) and taking it off, the drawing (tapes,
// rolled sleeves), its masters (the kind by the outfit; painted at 512 on tests/fixtures/cm/blouse*/ in the real Web Worker with the OCP
// cloth and the T-shirt in its colour), OCP pants' cloth on the T-shirt master, the upload script's kinds.
const fs=require('fs'),path=require('path');
module.exports=async({ok,chromium,url,settle})=>{
  const FIX=path.join(__dirname,'fixtures','cm'),HOST='https://w.test/';
  const browser=await chromium.launch();const errs=[];
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900}});const served={};
    await ctx.route(HOST+'**',route=>{const u=new URL(route.request().url()),k=u.searchParams.get('key');const j=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
      if(route.request().method()!=='GET')return j({ok:true});if(u.pathname==='/render'&&k)return served[k]?j(served[k]):j({error:'not found'},404);
      if(u.pathname==='/me')return j({id:'owner',role:'owner',name:'Owner',caps:null,used:{}});if(u.pathname==='/sync')return j({rev:0,saved:0,data:null});return j({ok:true})});
    const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- the type and the fixed OCP look ----
    const t=await p.evaluate(()=>{const b={id:'b1',type:'blouse',primaryColor:'khaki',pattern:'camouflage'},pc={id:'p1',type:'pants',primaryColor:'khaki',pattern:'camouflage',camo:'ocp'},pg={id:'p2',type:'pants',primaryColor:'khaki',pattern:'camouflage'};
      CUSTOM_PAT.ownocp={name:'Camouflage (OCP/MultiCam)',base:'camouflage'};const po={id:'p3',type:'pants',primaryColor:'khaki',pattern:'ownocp'};
      const N=128,im=ocpImage(N,7),cols=OCP_CAMO.cols.map(hexRgb),cnt=new Array(5).fill(0);
      for(let q=0;q<N*N;q++){let bi=0,bd=1e9;cols.forEach((c,k)=>{const d=(im[3*q]-c[0])**2+(im[3*q+1]-c[1])**2+(im[3*q+2]-c[2])**2;if(d<bd){bd=d;bi=k}});cnt[bi]++}
      let seam=0,inner=0;for(let y=0;y<N;y++){for(let c=0;c<3;c++){seam+=Math.abs(im[3*(y*N)+c]-im[3*(y*N+N-1)+c]);inner+=Math.abs(im[3*(y*N+60)+c]-im[3*(y*N+61)+c])}}
      const s1=usableSett(b),s2=usableSett(pc),s3=usableSett(po),s4=usableSett(pg);
      return {type:TYPES.blouse,hp:isHandPick(b),slot:handPickSlot(b),jk:CASUAL_JACKETS.includes('blouse'),tag:TAG_TYPES.includes('blouse'),pats:PATS_BY.blouse.join(),cols:COLS_BY.blouse.p[0],mats:MATERIALS_BY.blouse.length,care:CARE_DEF.blouse,
        ocp:[isOcp(b),isOcp(pc),isOcp(po),isOcp(pg),isOcp({...b,pattern:'solid'})],camoPants:[camoPants(pc),camoPants(pg),camoPants({id:'x',type:'pants',primaryColor:'khaki',pattern:'solid'}),camoPants(b)],
        sett:[s1&&s1.ocp,s1&&s1.camo.cols.join(),s2&&s2.camo.cols.join(),s3&&!!s3.ocp,s4&&!s4.ocp],sig:settSig(s1),ver:OCP_V,
        shares:cnt.map(v=>+(v/(N*N)).toFixed(3)),want:OCP_CAMO.shares,seam:seam/N/3,inner:inner/N/3,same:ocpImage(N,7)===im,ms:(()=>{const t0=performance.now();ocpImage(512,99);return Math.round(performance.now()-t0)})()}});
    ok(t.type==='Uniform blouse'&&t.hp&&t.slot==='top'&&t.jk&&t.tag,`the type "Uniform blouse": hand-pick only, the jacket slot, offered to the tagger (${JSON.stringify([t.type,t.hp,t.slot])})`);
    ok(t.pats==='camouflage,solid,other'&&t.cols==='khaki'&&t.mats===5&&t.care===3,`its patterns, colors, materials and 3 wears between washes (${t.pats}; ${t.cols}; ${t.mats}; ${t.care})`);
    ok(t.ocp.join()==='true,true,true,false,false',`OCP: the camouflage blouse, pants marked OCP or with an own pattern named OCP/MultiCam; not other camouflage pants or a plain blouse (${t.ocp})`);
    ok(t.camoPants.join()==='true,true,false,false',`camoPants: camouflage pants only (${t.camoPants})`);
    ok(t.sett[0]===t.ver&&t.sett[1]===t.sett[2]&&t.sett[3]&&t.sett[4]&&new RegExp('/'+t.ver+'\\d{5}/').test(t.sig),`one fixed OCP look for the blouse and OCP pants; other camouflage keeps its tagged colors; the look's version is in its key (${t.sig.slice(0,60)}…)`);
    ok(t.shares.every((v,k)=>Math.abs(v-t.want[k])<.05),`each OCP color covers about its share (the softened edges blend the smallest flecks into their ground) (${t.shares} vs ${t.want})`);
    ok(t.seam<t.inner*1.6+6&&t.same,`the OCP tile is seamless (edge step ${t.seam.toFixed(1)} vs inside ${t.inner.toFixed(1)}) and kept per seed`);
    ok(t.ms<4000,`a 512 OCP tile is made in ${t.ms} ms`);
    // ---- the score: with camouflage pants only; over a T-shirt ----
    const sc=await p.evaluate(()=>{let n=0;const I=(type,primaryColor,x={})=>({id:'s'+type+(n++),type,primaryColor,pattern:'solid',...x});
      const b=I('blouse','khaki',{pattern:'camouflage'}),tee=I('tee','tan'),camo=I('pants','khaki',{pattern:'camouflage',camo:'ocp',trouserKind:'cargo'}),chinos=I('pants','khaki',{trouserKind:'chinos'}),sh=I('shirt','white'),boots=I('shoes','brown',{shoeStyle:'boot',leather:'suede'});
      const r=o=>{const v=rateOutfit({occasion:'casual',notes:[],...o});return {hard:v.hard.join('|'),all:JSON.stringify(v.checks).match(/uniform blouse[^"]*/g)||[]}};
      const u={top:b,shirt:tee,bot:camo,shoes:boots,notes:[]};
      return {h:dialHarmony(u).v,hw:dialHarmony(u).why,oc:dialOccasion(u),ok:r({top:b,shirt:tee,bot:camo,shoes:boots}),chinos:r({top:b,shirt:tee,bot:chinos,shoes:boots}),shirt:r({top:b,shirt:sh,bot:camo,shoes:boots})}});
    ok(sc.h>=80&&sc.oc.v>=80,`the uniform's dials: harmony ${sc.h} ${sc.hw} (no "sits close to the jacket"), occasion ${sc.oc.v} (boots are the uniform's shoes: ${sc.oc.why})`);
    ok(!sc.ok.all.length,`the blouse over a T-shirt with camouflage pants: no note against it (${sc.ok.all})`);
    ok(sc.chinos.all.some(s=>/goes with camouflage pants/.test(s))&&/Pants/.test(sc.chinos.hard),`with chinos: "the uniform blouse goes with camouflage pants", a real mistake (${sc.chinos.hard})`);
    ok(sc.shirt.all.some(s=>/goes over a T-shirt/.test(s)),`over a dress shirt: "the uniform blouse goes over a T-shirt" (${sc.shirt.all})`);
    // ---- the drawing: tapes, rolled sleeves, the OCP tile ----
    const dr=await p.evaluate(()=>{const b={id:'d1',type:'blouse',primaryColor:'khaki',pattern:'camouflage',tapeName:'Hollis',tapeService:'u.s. air force',rank:'maj'},a=itemThumb(b),r=itemThumb({...b,rolled:true}),bare=itemThumb({id:'d2',type:'blouse',primaryColor:'khaki',pattern:'camouflage'});
      return {name:a.includes('>HOLLIS<'),svc:a.includes('>U.S. AIR FORCE<'),leaf:a.includes(OCP_RANK_SVG.maj.slice(0,20)),blank:!/<text/.test(bare)&&!bare.includes(OCP_RANK_SVG.maj.slice(0,20)),fields:JSON.stringify(blouseTapes({tapeName:' hollis!',tapeService:'U.S. Air Force',rank:'maj'}))==='{"name":"HOLLIS","service":"U.S. AIR FORCE","rank":"maj"}',img:/<image href="data:image\/png/.test(a),roll:a!==r&&r.includes('L84.4,52'),pants:/<image href="data:image\/png/.test(itemThumb({id:'p',type:'pants',primaryColor:'khaki',pattern:'camouflage',camo:'ocp',trouserKind:'cargo'}))}});
    ok(dr.name&&dr.svc&&dr.img&&dr.roll&&dr.pants,`the drawing: name and service tapes, the OCP cloth, a rolled-sleeve variant; OCP pants drawn in it (${JSON.stringify(dr)})`);
    // ---- the masters: which outfit takes which; painted at 512 in the Web Worker ----
    const recs={};const add=(kind,n,f)=>{recs[kind+'|'+n]={sig:'asm/cm test',img:`data:image/${f.endsWith('.jpg')?'jpeg':'png'};base64,`+fs.readFileSync(f).toString('base64'),model:'colormaster',t:1000}};
    for(const kind of ['suit-open','blouse','blouse-roll','shirt-open','tee']){const d=path.join(FIX,kind);for(const f of fs.readdirSync(d))add(kind,f.replace(/\.(png|jpg)$/,'').replace(/^mask-/,'mask/').replace(/^part-/,'part/'),path.join(d,f))}
    const kmap=await p.evaluate(ks=>{const o={};for(const k of ks){const [kind,n]=k.split('|');o[k]=asmCmKey(kind,n)}return o},Object.keys(recs));
    for(const [k,r] of Object.entries(recs))served[kmap[k]]=r;
    const res=await p.evaluate(async h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','owner');self.ASM_CM_SIZE=512;asmAheadSoon=()=>{};asmAhead=async()=>{};
      let n=0;const I=(type,primaryColor,x={})=>({id:'m'+type+(n++),type,primaryColor,pattern:'solid',...x});COLORS.tan499='#A08A6B';
      const b=I('blouse','khaki',{pattern:'camouflage'}),tee=I('tee','tan499'),sh=I('shirt','white'),camo=I('pants','khaki',{pattern:'camouflage',camo:'ocp',trouserKind:'cargo'}),belt=I('belt','brown'),watch=I('watch','silver',{metal:'silver',dial:'white',band:'integrated'}),tie=I('tie','navy');
      const kinds={down:asmKindOf({top:b,shirt:tee,watch}),roll:asmKindOf({top:b,shirt:tee,watch,rolled:true}),dress:asmKindOf({top:b,shirt:sh,watch}),tie:asmKindOf({top:b,shirt:tee,tie,watch}),chore:asmKindOf({top:I('chore','olive'),shirt:sh,watch}),off:asmKindOf({shirt:tee,bot:camo,belt,watch})};
      const keys={down:asmCmOutKey({top:b,shirt:tee,watch}),roll:asmCmOutKey({top:b,shirt:tee,watch,rolled:true}),tape:asmCmOutKey({top:{...b,tapeName:'HOLLIS'},shirt:tee,watch}),rank:asmCmOutKey({top:{...b,rank:'maj'},shirt:tee,watch})};
      const none=await (async()=>{const o={top:I('blouse','khaki',{pattern:'camouflage'}),shirt:tee,watch};return {use:asmCmUse(o)}})();
      const px=async u=>(await asmData(u,512)).data,out=[];
      const paint=async(name,o)=>{const r={name};try{await asmCmLook(o);const k=asmKindOf(o);r.kind=k;if(!await asmNkGet(o,k)){r.err='records not here';return r}
          const job=await asmJob(o);r.decal=job&&job.ocpDecal?job.ocpDecal.boxes.length:0;if(!job){r.err='no job: use '+asmCmUse(o)+', base job '+!!(await asmCmJob(o))+', base '+asmCmAssets(asmNkBase(k)).filter(x=>!renders[x]).length+' missing, kind '+asmCmAssets(k).filter(x=>!renders[x]).length+' missing';return r}r.cm=job.cm;const J=job.cloth.jacket||job.cloth.trousers;r.ocp=!!(J&&J.suit&&J.suit.TW===1024&&J.suit.mm===OCP_CAMO.mm);r.tee=job.cloth.shirt&&job.cloth.shirt.mat;
          const res=await asmRun({...job,gl:false},true);r.ok=!!(res&&res.url);
          if(res&&res.url){const d=await px(res.url),zone=async z=>{const m=await px(renders[asmCmKey(job.cm,'mask/'+z)].img);let s=[0,0,0],c=0,v=0;for(let q=0;q<512*512;q++)if(m[4*q]>250){const L=d[4*q]+d[4*q+1]+d[4*q+2];v+=L*L;for(let e=0;e<3;e++)s[e]+=d[4*q+e];c++}const mean=s.map(x=>x/Math.max(1,c)),ml=mean[0]+mean[1]+mean[2];return {mean:mean.map(Math.round),sd:Math.round(Math.sqrt(Math.max(0,v/Math.max(1,c)-ml*ml)))}};
            r.cloth=await zone(job.cloth.jacket?'jacket':'trousers');if(job.cloth.jacket)r.shirt=await zone('shirt')}}
        catch(e){r.err=String(e&&e.message||e)}return r};
      await asmCmMfGet(true);
      out.push(await paint('blouse',{top:{...b,tapeName:'Hollis',tapeService:'U.S. Air Force',rank:'maj'},shirt:tee,watch}));out.push(await paint('rolled',{top:b,shirt:tee,watch,rolled:true}));out.push(await paint('off',{shirt:tee,bot:camo,belt,watch}));
      return {kinds,keys,none,out}},HOST);
    ok(res.kinds.down==='blouse'&&res.kinds.roll==='blouse-roll'&&res.kinds.dress===null&&res.kinds.tie===null&&res.kinds.chore==='chore'&&res.kinds.off==='tee',`the blouse over a T-shirt is its own master, rolled sleeves the other; over a dress shirt or with a tie none (the drawing); the chore jacket and the T-shirt as before (${JSON.stringify(res.kinds)})`);
    ok(res.keys.down!==res.keys.roll&&res.keys.tape!==res.keys.down&&res.keys.rank!==res.keys.down&&res.keys.tape!==res.keys.rank,'rolled sleeves, the tape text and the rank each make another picture');
    const bad=res.out.filter(r=>!r.ok);
    ok(!bad.length,`painted in the Web Worker: ${res.out.map(r=>r.name+(r.ok?'':' ('+(r.err||'no picture')+')')).join(', ')}`);
    const bl=res.out.find(r=>r.name==='blouse')||{},ro=res.out.find(r=>r.name==='rolled')||{},of=res.out.find(r=>r.name==='off')||{};
    ok(bl.decal===3&&!ro.decal,`the name tape, service tape and rank are painted on the blouse with them (${bl.decal} boxes), nothing on a blouse without (${ro.decal})`);
    ok(bl.cm==='blouse'&&ro.cm==='blouse-roll'&&bl.ocp&&ro.ocp&&of.ocp,`on their own masters with the OCP cloth (the blouse, rolled, and OCP pants on the T-shirt master) (${[bl.cm,ro.cm,bl.ocp,ro.ocp,of.ocp]})`);
    ok(bl.cloth&&bl.cloth.sd>25&&bl.cloth.mean[1]>bl.cloth.mean[2],`the blouse is camouflage, not flat (lightness spread ${bl.cloth&&bl.cloth.sd}, mean ${bl.cloth&&bl.cloth.mean})`);
    ok(bl.shirt&&Math.abs(bl.shirt.mean[0]-160)<45&&bl.shirt.mean[0]>bl.shirt.mean[2],`the T-shirt in the V is painted tan (${bl.shirt&&bl.shirt.mean})`);
    // ---- Today: the Sleeves row and taking the blouse off; the picker ----
    const td=await p.evaluate(async()=>{let n=0;const I=(type,primaryColor,x={})=>({id:'t'+type+(n++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('blazer','tan'),I('pants','grey'),I('shirt','white'),I('tie','burgundy'),I('watch','grey',{metal:'silver'}),I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),
        I('blouse','khaki',{pattern:'camouflage'}),I('tee','tan'),I('pants','khaki',{pattern:'camouflage',camo:'ocp',trouserKind:'cargo'})];
      settings.workdays=[0,1,2,3,4];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=true;show('today');
      const B=items[9].id,T=items[10].id,P=items[11].id;
      // the pants picker first is grey dress pants: the blouse is listed last with the reason
      openPicker('top');const g=document.querySelector('#pick-sheet .pick-hand'),cards=g?[...g.querySelectorAll('.pick-it')]:[];const last=cards[cards.length-1];
      const pick1={last:last&&last.getAttribute('onclick').includes(B),why:last&&last.textContent.includes('Goes with camouflage pants')};closePicker();
      await pickItem('top',B);await pickItem('bot',P);await pickItem('shirt',T);
      openPicker('top');const g2=document.querySelector('#pick-sheet .pick-hand'),c2=g2?[...g2.querySelectorAll('.pick-it')].find(c=>c.getAttribute('onclick').includes(B)):null;const pick2=!!c2&&!c2.textContent.includes('Goes with');closePicker();
      // the Sleeves row is off (BLOUSE_ROLL_ON, 2026-11-18): no row, and rolling does nothing; then switched on for the rest
      renderToday();const offRowGone=!document.querySelector('.roll-row');await setRoll(true);const offNoRoll=!(dayRecs[key(sel)]||{}).roll;BLOUSE_ROLL_ON=true;renderToday();
      const o=planFor()[key(sel)],row=document.querySelector('.roll-row');const before={off:offRowGone&&offNoRoll,top:o.top&&o.top.id===B,row:!!row&&row.textContent.includes('Down'),rolled:!!o.rolled};
      await setRoll(true);const o2=planFor()[key(sel)],row2=document.querySelector('.roll-row');const after={dbg:JSON.stringify({top:o2.top&&o2.top.type,shirt:o2.shirt&&o2.shirt.type,force:dayRecs[key(sel)].force}),rec:!!dayRecs[key(sel)].roll,rolled:!!o2.rolled,row:!!row2&&row2.textContent.includes('Rolled up'),kind:asmKindOf(o2)};
      await setOff('top',true);const o3=planFor()[key(sel)],off=document.querySelector('#ri-top.off-row');const taken={top:!o3.top,label:off&&off.textContent,shirt:o3.shirt&&o3.shirt.id===T};
      await setOff('top',false);await resetDay();return {pick1,pick2,before,after,taken,cleared:!(dayRecs[key(sel)]||{}).roll}});
    ok(td.pick1.last&&td.pick1.why,`with dress pants the picker lists the blouse last: "Goes with camouflage pants" (${JSON.stringify(td.pick1)})`);
    ok(td.pick2,'with camouflage pants it is offered by hand like the other casual jackets');
    ok(td.before.off,'the Sleeves row is off for now (BLOUSE_ROLL_ON false): no row, and rolling up does nothing');
    ok(td.before.top&&td.before.row&&!td.before.rolled,`switched on: Today has a Sleeves row, "Down" (${JSON.stringify(td.before)})`);
    ok(td.after.rec&&td.after.rolled&&td.after.row&&td.after.kind==='blouse-roll',`↑ rolls them up for the day (rec.roll): "Rolled up", the rolled master (${JSON.stringify(td.after)})`);
    ok(td.taken.top&&/Uniform blouse/.test(td.taken.label||'')&&/Taken off/.test(td.taken.label||'')&&td.taken.shirt,`− takes the blouse off, the T-shirt stays: "${(td.taken.label||'').trim()}"`);
    ok(td.cleared,'Reset day clears the rolled sleeves');
    // ---- the upload script knows the kinds ----
    const up=fs.readFileSync(path.join(__dirname,'..','tools','asm-cm-upload.js'),'utf8');
    ok(/'blouse','blouse-roll'\]\)ZONES\[k\]=ZONES\['suit-open'\]/.test(up)&&/ASM_LAPELS=new Set\(\[[^\]]*'blouse','blouse-roll'/.test(up),'cm-upload uploads the blouse masters (the open-collar jacket\'s zones, the collar as lapels)');
    ok(!errs.length,`no page errors (${errs.join(' | ')})`);
  }finally{await browser.close()}};
module.exports.assembled=true;   // (assembled pictures on: tests/run.js)
module.exports.realPlanner=true;   // (Today's rows come from the planner: rec.roll, rec.off)
