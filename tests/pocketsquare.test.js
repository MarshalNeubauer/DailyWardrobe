// Pocket squares across the app (2026-11-16, the owner's approved feature: "I really just want a square fold, a bit out of the pocket"):
// the type everywhere (lists, the tag, import words, search, the Wardrobe's chip, the Add card), the planner's rules (only with a jacket on,
// never the tie's own colour and pattern, an echo of the tie, shirt or jacket, white as the safe default, a funeral's white or none, off
// with the jacket and not counted as worn, PLAN_RULES), Today's row (⇄, − and +) and its picker, and the drawings: the thumbnail's fold,
// the mannequin's strip above the breast pocket, the painted picture's overlay (asm-pocket.js) and the picture key, which changes only for
// a look with a square.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // ---- the type everywhere ----
    const t=await p.evaluate(()=>{const q={id:'q1',type:'pocketsquare',primaryColor:'white',secondaryColor:'navy',pattern:'border',material:'linen'};
      const tag=normTag({type:'pocketsquare',primaryColor:'white',secondaryColor:'navy',pattern:'border',material:{key:'linen',confidence:'high',why:''}},'m');
      return {name:TYPES.pocketsquare,order:Object.keys(TYPES).indexOf('pocketsquare')===Object.keys(TYPES).indexOf('tieclip')+1,cols:COLS_BY.pocketsquare.p[0],pats:PATS_BY.pocketsquare.join(),mats:MATERIALS_BY.pocketsquare.join(),
        slot:SLOTS.includes('pocket')&&SLOT_TYPE('pocket')==='pocketsquare',alias:['contrast border','dots','plaid','rolled edge'].map(w=>normPat('pocketsquare',w)).join(),hasPat:hasPat('pocketsquare')&&!hasPat('tieclip'),
        tag:[tag.type,tag.pattern,tag.secondaryColor,tag.material&&tag.material.key].join(),flag:JSON.stringify(tagExtras().types),dress:(()=>{const d=settings.dress;settings.dress={jacket:false};const r=dressOut('pocketsquare');settings.dress=d;return r})(),
        desc:desc(q),nm:nm(q),cols2:colShows(q,'secondaryColor')&&colShows(q,'tertiaryColor'),search:['pocket square','hank','handkerchief','pochette','border','linen','navy'].every(w=>wardMatch(q,wardNorm(w))),
        care:CARE_ABLE.includes('pocketsquare')&&careWashed('pocketsquare'),pack:PACK_TITLE.pocketsquare}});
    ok(t.name==='Pocket square'&&t.order&&t.cols==='white'&&t.pats==='solid,border,polka-dot,paisley,stripe,check,foulard,woven,other'&&t.mats==='silk,linen,cotton,wool,silk blend,polyester',`the type "Pocket square" after the tie clip, white first, its patterns (border too) and materials (${t.pats}; ${t.mats})`);
    ok(t.slot&&t.alias==='border,polka-dot,check,border'&&t.hasPat,`a slot "pocket"; pattern words read (${t.alias}); it has a pattern and colours to pick (hasPat)`);
    ok(t.tag==='pocketsquare,border,navy,linen'&&t.flag==='["pocketsquare"]',`a tag answers a pocket square, and the app asks for the type (types: ${t.flag})`);
    ok(t.dress&&t.cols2&&/border/.test(t.desc)&&/pocket square$/.test(t.nm),`without jackets it is left out by the dress code; second and third colours shown; named "${t.nm}"`);
    ok(t.search&&t.care&&t.pack==='Pocket squares','the Wardrobe search finds it as pocket square, hank, handkerchief, pochette, its pattern, material and colours; it can go to the laundry; the packing list has it');
    // the spreadsheet import's words
    const k=await p.evaluate(()=>{const r=kitRead('Type,Color,Pattern\nPocket square,White,Contrast border\nHank,Navy,Paisley\nhandkerchief,Burgundy,Dots\npochette,white,\npocket-square,light blue,\nWhite linen pocket square,White,\n');
      return (r.rows||[]).map(x=>x.ok?x.card.type+'/'+x.card.pattern+'/'+x.card.primaryColor:'x:'+x.why).join(' | ')});
    ok(k==='pocketsquare/border/white | pocketsquare/paisley/navy | pocketsquare/polka-dot/burgundy | pocketsquare/solid/white | pocketsquare/solid/lightblue | pocketsquare/solid/white',`import: pocket square, hank, handkerchief, pochette, pocket-square and "white linen pocket square" (${k})`);
    // the Add card: its pattern section and colours
    await p.evaluate(()=>{queue.unshift({id:'pq-card',manual:true,type:'pocketsquare',primaryColor:'white',secondaryColor:'navy',tertiaryColor:null,pattern:'border',metal:'silver',leather:'calf'});show('add');renderAdd()});await settle(p,300);
    const add=await p.evaluate(()=>{const s=addCkSecs(queue[0],0);return {titles:s.map(x=>x.title).join(','),pat:(s.find(x=>x.k==='pattern')||{}).sum,thumb:/ps-front/.test(itemThumb(queue[0]))}});
    ok(/Pattern/.test(add.titles)&&/Border/.test(add.pat)&&add.thumb,`the Add card asks for its pattern (${add.pat}) and draws it folded`);
    await p.evaluate(()=>{queue.shift();renderAdd()});
    // ---- the drawings ----
    const d=await p.evaluate(()=>{const sq={id:'s',type:'pocketsquare',primaryColor:'white',secondaryColor:'navy',pattern:'border'},dots={id:'d',type:'pocketsquare',primaryColor:'burgundy',secondaryColor:'white',pattern:'polka-dot'};
      return {th:itemThumb(sq),th2:itemThumb(dots),sw:swatchSVG(sq,true),full:itemThumb(sq,true)}});
    ok(/ps-back/.test(d.th)&&/ps-front/.test(d.th)&&/#1b2a4a/i.test(d.th)&&/<circle/.test(d.th2),'the thumbnail is the square folded for the square fold (back, the front fold), with its navy edge; a dotted one shows its dots');
    ok(/stroke="#1b2a4a"/i.test(d.sw)&&/stroke="#1b2a4a"/i.test(d.full),'its swatch and full sample show the edge round its cloth');
    // ---- the planner ----
    const plan=await p.evaluate(()=>{let n=0;const I=(type,primaryColor,x={})=>({id:type+String(n++).padStart(2,'0'),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('blazer','tan'),I('pants','grey'),I('pants','navy'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),
        I('tie','burgundy',{pattern:'stripe',secondaryColor:'navy'}),I('tie','navy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','green',{pattern:'paisley',secondaryColor:'gold'}),I('tie','purple'),
        I('watch','grey',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy'),
        I('pocketsquare','white',{material:'linen'}),I('pocketsquare','burgundy',{pattern:'paisley',secondaryColor:'gold'}),I('pocketsquare','gold',{pattern:'polka-dot',secondaryColor:'navy'}),
        I('pocketsquare','navy',{pattern:'polka-dot',secondaryColor:'white'}),I('pocketsquare','olive',{pattern:'check',secondaryColor:'rust'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[3];settings.vestMode='never';settings.dress=undefined;dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};
      const P=planSim(new Date(2026,10,1)).upTo(new Date(2026,11,31)),days=Object.values(P),withJ=days.filter(o=>o.top),ps=days.filter(o=>o.pocket);
      const same=ps.filter(o=>psSameTie(o.pocket,o.tie)),noJ=ps.filter(o=>!o.top),bad=ps.filter(o=>!psWhite(o.pocket)&&!psEcho(o.pocket,o.top,o.shirt,o.tie).hit);
      const used={};for(const o of ps)used[o.pocket.id]=(used[o.pocket.id]||0)+1;
      const r=rateOutfit(ps[0]);
      // only colored squares that pick nothing up: no square
      const keep=items;items=items.filter(i=>i.type!=='pocketsquare').concat([I('pocketsquare','rust',{pattern:'check',secondaryColor:'olive'})]);   // (nothing rust or olive in these outfits)cache={};
      const P2=planSim(new Date(2026,10,1)).upTo(new Date(2026,10,30)),none=Object.values(P2).filter(o=>o.pocket).length;items=keep;cache={};
      // the same square as the tie, alone: never
      items=items.filter(i=>i.type!=='pocketsquare').concat([I('pocketsquare','navy',{pattern:'polka-dot',secondaryColor:'white',id:'twin'})]);
      const P3=planSim(new Date(2026,10,1)).upTo(new Date(2026,10,30)),twin=Object.values(P3).filter(o=>o.pocket);items=keep;cache={};
      // without jackets (the dress code): none
      settings.dress={jacket:false,tie:true};const P4=planSim(new Date(2026,10,1)).upTo(new Date(2026,10,30)),nj=Object.values(P4).filter(o=>o.pocket).length;settings.dress=undefined;cache={};
      // a funeral: a plain white one or none; a formal day: white
      dayRecs={'2026-11-17':{date:'2026-11-17',occasion:'funeral'},'2026-11-18':{date:'2026-11-18',formal:true}};cache={};
      const P5=planSim(new Date(2026,10,1)).upTo(new Date(2026,10,30)),fu=P5['2026-11-17'].pocket,fo=P5['2026-11-18'].pocket;dayRecs={};cache={};
      return {jdays:withJ.length,ps:ps.length,same:same.length,noJ:noJ.length,bad:bad.length,used,score:r.checks.find(c=>c.label==='Pocket square'),none,twin:twin.map(o=>o.tie&&o.tie.id).join(),nj,
        fu:fu&&{c:fu.primaryColor,p:fu.pattern},fo:fo&&fo.primaryColor,rules:PLAN_RULES}});
    ok(plan.ps>=plan.jdays*.9&&plan.noJ===0,`with a white square owned nearly every jacket day has a square (${plan.ps} of ${plan.jdays}), and never a day without a jacket`);
    ok(plan.same===0&&plan.bad===0,`never the tie's own colour and pattern (${plan.same}); each coloured square picks up a colour of the tie, shirt or jacket (${plan.bad} that don't)`);
    ok(Object.keys(plan.used).length>=3&&plan.used.pocketsquare19>0,`the squares rotate (${JSON.stringify(plan.used)}), white among them`);
    ok(plan.score&&plan.score.max===5,`the score has a "Pocket square" check on a day with one (${plan.score&&plan.score.pts}/5)`);
    ok(plan.none===0,`only coloured squares that pick nothing up: no square planned (${plan.none} days)`);
    ok(!plan.twin.split(',').includes('tie10')||plan.twin==='',`a square that is the navy dot tie's twin is never planned with that tie (with: ${plan.twin||'none'})`);
    ok(plan.nj===0,'without jackets (the dress code) no square');
    ok(plan.fu&&plan.fu.c==='white'&&plan.fu.p==='solid'&&plan.fo==='white',`a funeral takes the plain white square (${JSON.stringify(plan.fu)}), a formal day white (${plan.fo})`);
    ok(plan.rules===21,'PLAN_RULES bumped to 21');
    // ---- Today: the row, its ⇄ − +, the picker, the jacket off ----
    await p.evaluate(()=>{settings.dress=undefined;dayRecs={};cache={};sel=new Date(2026,10,9);view={y:2026,m:10};listOpen=true;show('today');renderToday()});await settle(p,400);
    const tap=async s=>{const t0=await p.evaluate(()=>(dayRecs[key(sel)]||{}).updated||0);await p.click(s);await p.waitForFunction(t=>((dayRecs[key(sel)]||{}).updated||0)>t,t0,{timeout:5000}).catch(()=>{});await settle(p,400)};
    const st=()=>p.evaluate(()=>{const o=planFor()[key(sel)];return {top:o.top&&o.top.id,pocket:o.pocket&&o.pocket.id,off:o.off||null,rows:[...document.querySelectorAll('#ibox .row')].map(e=>e.textContent.replace(/\s+/g,' ').trim()).filter(t=>/^Pocket square/.test(t)),
      btns:[...document.querySelectorAll('#ri-pocket button[aria-label]')].map(b=>b.getAttribute('aria-label'))}});
    const a=await st();
    ok(a.top&&a.pocket&&a.rows.length===1&&a.btns.includes('Change pocket square')&&a.btns.includes('Take off the pocket square'),`Today shows a Pocket square row with ⇄ and − (${a.rows[0]}; ${a.btns.join(', ')})`);
    // the picker
    await p.click('#ri-pocket button[aria-label="Change pocket square"]');await settle(p,400);
    const pk=await p.evaluate(()=>({title:$('#pick-title').textContent,n:document.querySelectorAll('#pick-sheet .pick-it').length,fits:[...document.querySelectorAll('#pick-sheet .pick-it .fit')].map(e=>e.textContent)}));
    ok(pk.title==='Choose a pocket square'&&pk.n===5&&pk.fits.some(f=>/Best match/.test(f)),`the picker lists the pocket squares by match (${pk.title}: ${pk.fits.join(' / ')})`);
    await p.screenshot({path:require('path').join(process.env.PS_SHOTS||require('os').tmpdir(),'pocket-picker.png')}).catch(()=>{});
    const other=await p.evaluate(cur=>[...document.querySelectorAll('#pick-sheet .pick-it')].map(b=>b.getAttribute('onclick')).find(x=>!x.includes(cur)),a.pocket);
    await p.evaluate(on=>{new Function(on)()},other);await p.waitForTimeout(300);await settle(p,300);
    const b=await st();ok(b.pocket&&b.pocket!==a.pocket,`a pick changes the square (${a.pocket} → ${b.pocket})`);
    // − takes it off: "Taken off" with +, not worn
    await tap('#ri-pocket button[aria-label="Take off the pocket square"]');
    const c=await st();
    ok(!c.pocket&&c.off&&c.off.pocket&&/Taken off/.test(c.rows[0]||'')&&c.btns.includes('Put the pocket square back on'),`− takes it off: ${c.rows[0]}`);
    await tap('#ri-pocket button[aria-label="Put the pocket square back on"]');
    const e=await st();ok(e.pocket===b.pocket&&!(e.off&&e.off.pocket),'+ puts the same square back on');
    // the jacket off: no square, no row, and it isn't counted as worn
    await tap('#ibox button[aria-label="Take off the suit jacket"]');
    const f=await st();
    ok(!f.top&&!f.pocket&&!f.rows.length,`the jacket off takes the square with it, and its row goes (${JSON.stringify(f.rows)})`);
    const worn=await p.evaluate(id=>{const s=planSim(new Date(2026,10,1));s.upTo(new Date(2026,10,9));return Object.entries(s.plan).filter(([k,o])=>o.pocket&&o.pocket.id===id&&k==='2026-11-9').length},b.pocket);
    ok(worn===0,'the square taken off with the jacket is not worn that day');
    await tap('#ibox button[aria-label="Put the suit jacket back on"]');
    const g=await st();ok(g.top&&g.pocket===b.pocket,'the jacket back on brings the same square');
    // ---- the drawn figure ----
    const fig=await p.evaluate(()=>{const o=planFor()[key(sel)],sv=figureSvg(o,'pt-'),m=sv.match(/<g class="fig-pocket">([\s\S]*?)<\/g>/),pts=m&&m[1].match(/points="([^"]+)"/g);
      const no=figureSvg({...o,pocket:null},'pt2-'),open=figureSvg({...o,top:null,pocket:o.pocket},'pt3-');return {has:!!m,n:pts&&pts.length,first:pts&&pts[1],no:/fig-pocket/.test(no),open:/fig-pocket/.test(open),kind:figKind(o)}});
    ok(fig.has&&!fig.no&&!fig.open,`the drawn figure shows the square's strip (${fig.kind}: ${fig.first}), only with a square and a jacket`);
    // ---- the painted overlay and the picture key ----
    const pk2=await p.evaluate(()=>{for(const k of ['suit','suit-open','vest','shirt-tie'])renders[asmCmKey(k,'master')]={t:1,img:'',sig:''};
      const o=planFor()[key(sel)],kind=asmCmKind(o),bare={...o,pocket:null},dots={...o,pocket:{...o.pocket,primaryColor:'navy',pattern:'polka-dot',secondaryColor:'white'}};
      const k1=asmOutKey(o),k0=asmOutKey(bare),k2=asmOutKey(dots),k0b=asmOutKey({...bare});
      const sig0=asmCmSig(bare),code=asmCmCodeText(asmCmCode()),inCode=['asmPocketDo','asmPocketQuad','asmPocketPaint','ASM_POCKET_GEO'].some(n=>new RegExp('\\b'+n+'\\b').test(code));
      const open=asmPocketJob({...o,tie:null},'suit-open'),shirt=asmPocketJob({...o,top:null},'shirt-open'),none=asmPocketJob(bare,kind);
      // the overlay on a plain navy picture: the strip turns white where the square is, nothing far from it changes
      const S=512,px=new Uint8ClampedArray(S*S*4);for(let i=0;i<S*S;i++){px[4*i]=27;px[4*i+1]=42;px[4*i+2]=74;px[4*i+3]=255}const before=px.slice();
      const J=asmPocketJob({...o,pocket:{id:'w',type:'pocketsquare',primaryColor:'white',pattern:'solid'}},'suit');asmPocketDo(px,S,J);
      const f=S/2048,Q=asmPocketQuad('suit'),at=(x,y)=>{const i=4*(Math.round(y*f)*S+Math.round(x*f));return [px[i],px[i+1],px[i+2]]},mid=at((Q.b0[0]+Q.b1[0])/2,(Q.b0[1]+Q.b1[1]+Q.t0[1]+Q.t1[1])/4);
      let changed=0,far=0;for(let i=0;i<S*S;i++)if(px[4*i]!==before[4*i]||px[4*i+1]!==before[4*i+1]){changed++;const x=i%S/f,y=Math.floor(i/S)/f;if(x<Q.b0[0]-20||x>Q.b1[0]+30||y<Q.t1[1]-10||y>Q.b0[1]+20)far++}
      return {kind,k1,k0,k2,k0b,sig0,inCode,open:!!open,shirt,none,mid,changed,far,Q}});
    ok(pk2.k1!==pk2.k0&&pk2.k2!==pk2.k1&&pk2.k0===pk2.k0b&&!/pocket:/.test(pk2.sig0),`the look's picture key changes only with a square (and with another square), never for a look without one (${pk2.kind})`);
    ok(!pk2.inCode,'the overlay is outside the painter\'s hashed code (asmCmCode): no other picture is painted again');
    ok(pk2.open&&pk2.shirt===null&&pk2.none===null,'the overlay is painted on the jacket masters (the open collar too), never on the shirt masters or without a square');
    ok(pk2.mid[0]>150&&pk2.mid[1]>150&&pk2.mid[2]>150&&pk2.changed>100&&pk2.far===0,`on a navy picture the strip is light (${pk2.mid.join(',')}), ${pk2.changed} pixels painted, none away from the pocket (${pk2.far})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // the real planner picks the squares
module.exports.assembled=true;     // the painted picture's key and overlay (asm-color.js, asm-pocket.js)
