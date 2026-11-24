// The materials update (2026-11-15, the materials audit and the owner's decisions; C:\code\audit-2026-11-13\materials-audit\): the lists per
// type (shirts fabric only, knitted silk retired, the additions and maybes, the same as the worker's), stored names off a list still shown,
// searched, seasoned and painted; seasons (tropical wool warm; cashmere, moleskin, melton cold; wool ties cold; the owner's own season
// wins); import aliases, a shirt weave as its pattern, "Pebble grain" with a space and Nubuck; search synonyms; the one-time rename of the
// owner's stretch shirts; the accessory options (rubber and NATO bands, two-tone, silk knots, braided and canvas belts labeled Material,
// nubuck); the painter's material light and corduroy / seersucker cloth; the close-up reader's material card (high/medium shown, low
// shown as a guess (2026-11-16), a material set by hand not changed by Use all, "Yours · Claude" with Use to switch, Use all, Undo); the Add card's material from
// photo tagging (empty field only, marked as Claude's, a hand choice kept). The worker is stubbed: nothing paid.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,settle,ROOT})=>{
  const WM=(await import(pathToFileURL(path.join(ROOT,'worker/tag.js')).href)).MATERIALS_BY;
  const b=await chromium.launch();
  try{
    const ctx=await b.newContext({viewport:{width:390,height:844}});
    const S={reply:null,sent:[],syncs:0};const H={'content-type':'application/json','access-control-allow-origin':'*'};
    await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
      if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
      if(u.pathname==='/describe'&&q.method()==='POST'){let bd={};try{bd=JSON.parse(q.postData()||'{}')}catch{}S.sent.push(bd);return route.fulfill({status:200,headers:H,body:JSON.stringify(S.reply)})}
      if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify({id:'owner',role:'owner',caps:null,used:{}})});
      return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});
    const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
    let e;
    // ---- the lists
    e=await p.evaluate(()=>({M:MATERIALS_BY,label:[leatherLabel({type:'belt'}),leatherLabel({type:'shoes'})],belt:leathersFor({type:'belt'}),boot:leathersFor({type:'shoes',shoeStyle:'boot'}),oxford:leathersFor({type:'shoes'}),
      derby:leathersFor({type:'shoes',shoeStyle:'derby'}),loafer:leathersFor({type:'shoes',shoeStyle:'loafer'}),bands:BANDS.map(x=>x[0]),metals:METAL_OPTS.map(x=>x[0]),links:metalOptsFor('cufflinks').map(x=>x.join(':')),watchM:metalOptsFor('watch').map(x=>x[0])}));
    ok(JSON.stringify(e.M)===JSON.stringify(WM),'core.js MATERIALS_BY is the worker\'s list, type by type');
    ok(e.M.shirt.join()==='cotton,poplin,linen,linen blend,flannel,cotton blend,performance stretch,seersucker,polyester,polyester blend,silk,rayon,modal,lyocell,bamboo,wool,jersey,denim,corduroy','shirts hold the fabric only (the owner\'s list, polyester and the other fibers added 2026-11-16): no twill, oxford, pinpoint oxford, end-on-end, chambray or nylon');
    ok(await p.evaluate(()=>[matAlias('shirt','polyester'),matAlias('shirt','Viscose'),matAlias('shirt','Tencel'),matAlias('shirt','poly-cotton'),matAlias('shirt','nylon'),matAlias('shirt','merino')].join('|'))==='polyester|rayon|lyocell|cotton blend|performance stretch|wool','a shirt\'s polyester is polyester (no longer performance stretch); viscose is rayon, Tencel lyocell, poly-cotton cotton blend; nylon is still performance stretch');
    ok(!e.M.tie.includes('knitted silk')&&e.M.tie.includes('shantung'),'ties: knitted silk retired, shantung added');
    const has=(t,l)=>l.every(m=>e.M[t].includes(m));
    ok(has('suit',['tropical wool','silk blend','moleskin'])&&has('blazer',['camel hair','silk blend','jersey','tropical wool'])&&!e.M.blazer.includes('moleskin')&&has('pants',['tropical wool','gabardine','moleskin','seersucker'])
      &&has('socks',['mercerized cotton'])&&has('overcoat',['melton','loden','alpaca'])&&has('raincoat',['rubberized cotton']),'the audit\'s additions and the owner\'s maybes are offered (suit moleskin, blazer tropical wool, coat loden and alpaca, raincoat rubberized cotton)');
    ok(Object.values(e.M).every(l=>l.length<=20&&new Set(l).size===l.length),'every list has 20 names or fewer, none twice (the reader\'s schema stays small)');
    ok(e.label.join()==='Material,Material'&&e.belt.includes('braided')&&e.belt.includes('canvas')&&e.boot.includes('nubuck')&&e.derby.includes('nubuck')&&!e.oxford.includes('nubuck')&&!e.loafer.includes('nubuck'),'belts are labeled Material, with braided leather and canvas; nubuck for boots, derbies and sneakers');
    ok(e.bands.join()==='bracelet,integrated,leather,rubber,nato'&&e.metals.includes('two-tone')&&e.links.includes('silk:silk knot')&&!e.watchM.includes('silk'),'watch bands rubber and NATO, a two-tone metal, silk knots for cufflinks only');
    // ---- stored names off the lists keep working: shown, searched, seasoned, painted
    e=await p.evaluate(()=>{items=[{id:'s1',type:'shirt',primaryColor:'white',pattern:'solid',material:'twill',added:3},{id:'t1',type:'tie',primaryColor:'navy',pattern:'knit',material:'knitted silk',added:2},
      {id:'p1',type:'pants',primaryColor:'grey',pattern:'solid',material:'tropical wool',added:1},{id:'so',type:'socks',primaryColor:'navy',pattern:'solid',material:'Merino',added:4}];flt='all';editing=null;wardQ='';show('wardrobe');
      openItem('s1');const sel=document.querySelector('#item-view .wmat'),tx=document.querySelector('#item-view .wmat-t');const r={sel:sel&&sel.value,tx:tx&&tx.value};closeItem();
      const find=q=>{wardQ=q;const l=wardFresh().map(i=>i.id).join();wardQ='';return l};
      return {...r,twill:find('twill'),knitted:find('knitted'),fresco:find('fresco'),highTwist:find('high-twist'),merino:find('merino wool'),silkT:find('silk'),mat:asmCmMat(items[1],'tie').join(),sea:itemSeason({type:'shirt',material:'twill'})}});
    ok(e.sel==='other'&&e.tx==='twill','a shirt saved with a weave as material shows "Other: twill"');
    ok(e.twill==='s1'&&e.knitted==='t1'&&e.silkT==='t1','stored names are still searched (twill, knitted silk)');
    ok(e.fresco==='p1'&&e.highTwist==='p1'&&e.merino==='so','search synonyms: "fresco" and "high-twist" find tropical wool, "merino wool" finds socks typed "Merino"');
    ok(e.mat==='0.9,0.4','a stored "knitted silk" tie is still painted as a knit (soft, matt)');
    // ---- seasons
    e=await p.evaluate(()=>{const s=(t,m,x={})=>itemSeason({type:t,material:m,...x});return {trop:s('suit','tropical wool'),cash:s('blazer','cashmere'),cb:s('overcoat','cashmere blend'),mole:s('pants','moleskin'),melton:s('overcoat','melton'),
      woolTie:s('tie','wool'),woolSuit:s('suit','wool'),woolBlendTie:s('tie','wool blend'),own:s('tie','wool',{season:'all'}),own2:s('suit','tropical wool',{season:'cold'}),socks:s('socks','cashmere blend'),case:s('suit','Tropical Wool'),
      mohair:s('suit','mohair blend'),hop:s('blazer','hopsack'),seer:s('shirt','seersucker')}});
    ok(e.trop==='warm'&&e.cash==='cold'&&e.cb==='cold'&&e.mole==='cold'&&e.melton==='cold'&&e.seer==='warm'&&e.case==='warm','tropical wool warm; cashmere, cashmere blend, moleskin and melton cold; seersucker shirts warm; any case');
    ok(e.woolTie==='cold'&&e.woolSuit==='all'&&e.woolBlendTie==='all','a wool tie is cold (a tie-only rule): a wool suit stays all year');
    ok(e.own==='all'&&e.own2==='cold'&&e.socks==='all'&&e.mohair==='all'&&e.hop==='all','the owner\'s own season wins; socks have none; mohair blend and hopsack set none');
    // ---- import
    e=await p.evaluate(()=>{const R=t=>kitRead(t).rows.map(x=>x.ok?[x.card.type,x.card.pattern,x.card.material||'',x.card.type==='shoes'||x.card.type==='belt'?x.card.leather:'',x.probs.join('/')].join(':'):'bad:'+x.why);
      return R('Type,Colour,Material,Pattern\nSuit,Navy,Fresco,\nPants,Grey,Worsted,\nShirt,White,Broadcloth,\nSocks,Navy,Lisle,\nSocks,Black,Merino,\nBlazer,Grey,Wool-linen,\nSuit,Grey,Wool-silk,\nShirt,Blue,Oxford,\nShirt,Blue,End-on-end,Stripe\nShirt,White,Nylon/spandex,\nShoes,Brown,Pebble grain,\nBelt,Black,Scotch grain,\nShoes,Tan,Nubuck,\nBoots,Tan,Nubuck,\nBelt,Brown,Braided leather,\nShirt,White,Twill weave,\nTie,Navy,Knitted silk,\nBlazer,Tan,Camel,\n')});
    const imp=e;
    ok(/^suit:solid:tropical wool::.*read as tropical wool/.test(imp[0])&&/^pants:solid:wool:/.test(imp[1])&&/^shirt:solid:poplin:/.test(imp[2])&&/^socks:solid:mercerized cotton:/.test(imp[3])&&/^socks:solid:merino wool:/.test(imp[4])&&/^blazer:solid:linen blend:/.test(imp[5])&&/^suit:solid:silk blend:/.test(imp[6])&&/^blazer:solid:camel hair:/.test(imp[17]),'import aliases: Fresco, Worsted, Broadcloth, Lisle, Merino, Wool-linen, Wool-silk, Camel ("read as" said): '+imp.join(' | '));
    ok(/^shirt:oxford::/.test(imp[7])&&/read as the oxford pattern/.test(imp[7])&&/^shirt:stripe::/.test(imp[8])&&/left out/.test(imp[8])&&/^shirt:solid:performance stretch:/.test(imp[9]),'a shirt\'s weave in the Material column is its pattern (kept out when the row has a pattern); Nylon/spandex is performance stretch');
    ok(/^shoes:solid::pebble-grain:$/.test(imp[10])&&/^belt:solid::scotch-grain:$/.test(imp[11]),'"Pebble grain" and "Scotch grain" with a space save as the grains, not calf');
    ok(/^shoes:solid::suede:.*read as suede/.test(imp[12])&&/^shoes:solid::nubuck:$/.test(imp[13])&&/^belt:solid::braided:$/.test(imp[14]),'Nubuck is kept: nubuck on boots, suede (said) on oxfords; braided leather belts');
    ok(/^shirt:solid:Twill weave:/.test(imp[15])&&/^tie:knit:silk:|^tie:solid:silk:/.test(imp[16]),'an unknown word stays as typed (Other); "Knitted silk" imports as silk: '+imp[15]+' | '+imp[16]);
    // ---- the owner's stretch shirts: renamed once, through the normal save and sync
    e=await p.evaluate(async()=>{const mk=(id,type,material)=>({id,type,primaryColor:'white',pattern:'solid',material,added:1,updated:1});
      const list=[mk('a','shirt','nylon/spandex'),mk('b','shirt','Nylon/Spandex'),mk('c','shirt','nylon'),mk('d','raincoat','nylon'),mk('e','shirt','nylon spandex blend'),mk('f','shirt','cotton'),mk('g','socks','nylon/spandex')];
      for(const i of list)await putRaw(i);items=list.map(i=>({...i}));let syncs=0;const was=window.setTimeout;window.setTimeout=(f,...a)=>{if(f===syncNow){syncs++;return 0}return was.call(window,f,...a)};
      const n=await matMigrate(),again=await matMigrate();window.setTimeout=was;const st=await tx('readonly',s=>s.getAll());const m=id=>st.find(x=>x.id===id);
      return {n,again,syncs,mats:['a','b','c','d','e','f','g'].map(id=>m(id).material).join('|'),mem:items.find(i=>i.id==='a').material,stamped:m('a').updated>1&&m('f').updated===1,syn:wardHay({type:'shirt',material:'performance stretch'}).includes('nylon')}});
    ok(e.n===3&&e.mats==='performance stretch|performance stretch|performance stretch|nylon|nylon spandex blend|cotton|nylon/spandex','exactly "nylon/spandex" (any case) and "nylon" on shirts become performance stretch; a raincoat\'s nylon, other words and socks are left: '+e.mats);
    ok(e.again===0&&e.syncs===1&&e.stamped&&e.mem==='performance stretch','idempotent (a second run changes nothing), stamped and synced, the copy on screen too');
    ok(e.syn,'"nylon" still finds the performance stretch shirts');
    // ---- the painter
    e=await p.evaluate(()=>{const M=(t,z,m,x={})=>asmCmMat({type:t,material:m,pattern:'solid',...x},z).join();
      return {velvet:M('blazer','jacket','velvet'),cord:M('suit','jacket','corduroy'),seer:M('suit','jacket','seersucker'),cotSuit:M('suit','jacket','cotton'),woolSuit:M('suit','jacket','wool'),cotTie:M('tie','tie','cotton'),silkTie:M('tie','tie','silk'),
        mohair:M('suit','jacket','mohair blend'),trop:M('suit','jacket','tropical wool'),stretch:M('shirt','shirt','performance stretch'),poplin:M('shirt','shirt','poplin'),camel:M('blazer','jacket','camel hair'),jersey:M('blazer','jacket','jersey'),
        routeCord:asmCmRoute({type:'suit',primaryColor:'brown',pattern:'solid',material:'corduroy'},'jacket').how,routeSeer:asmCmRoute({type:'pants',primaryColor:'blue',pattern:'solid',material:'seersucker'},'trousers').how,
        routeWool:asmCmRoute({type:'suit',primaryColor:'navy',pattern:'solid',material:'wool'},'jacket').how,routeCu:asmCmRoute({type:'suit',primaryColor:'tan',pattern:'solid',material:'corduroy',texture:'data:image/jpeg;base64,AAAA'},'jacket').how,
        tile:(()=>{const t=asmPileTile({type:'suit',primaryColor:'brown',material:'corduroy'},'cord');return t&&t.TW===256&&t.t.length===3*256*256&&t.mm>0})(),
        grain:['corduroy','seersucker','velvet','wool'].map(m=>ovlGrain({material:m,pattern:'solid'})).join(),
        sig:asmCmWeaveTag('jacket',{type:'suit',primaryColor:'brown',pattern:'solid',material:'corduroy'})}});
    ok(e.velvet==='1.2,1.45'&&e.cord==='0.96,0.6'&&e.camel==='0.96,0.6'&&e.jersey==='0.9,0.4','velvet a deep pile sheen; corduroy and camel hair soft and matt; jersey like a knit');
    ok(e.cotSuit==='1.05,0.7'&&e.seer==='1.05,0.7'&&e.woolSuit==='1,1.15','a cotton or seersucker suit is matt like chinos; wool keeps the worsted sheen');
    ok(e.cotTie==='1.05,0.7'&&e.silkTie==='1.1,1.3','a cotton tie is matt, not silk-shiny');
    ok(e.mohair==='1,1.3'&&e.trop==='1,1'&&e.stretch==='1,1.2'&&e.poplin==='1,1','mohair a little more sheen, tropical wool a little less, a performance stretch shirt a little sheen');
    ok(e.routeCord==='cord'&&e.routeSeer==='sucker'&&e.routeWool==='flat'&&e.routeCu==='flat'&&e.tile&&/^\/pcord/.test(e.sig),'a plain corduroy or seersucker without a close-up gets its generated cloth (a close-up\'s patch wins), and its look key says so');
    ok(e.grain==='cord,sucker,velvet,plain','Today\'s painted swatch has corduroy wales, seersucker pucker and velvet pile');
    // ---- accessories in the planner and the drawings
    e=await p.evaluate(()=>{const w=I=>({type:'watch',primaryColor:'black',metal:'silver',...I});
      return {same:[metalSame('two-tone','gold'),metalSame('silver','two-tone'),metalSame('gold','silver'),metalSame('other','two-tone')].join(),silk:metalOf({type:'cufflinks',metal:'silk',primaryColor:'navy'}),
        fin:[finish('nubuck'),finish('braided'),finish('canvas')].join(),fit:beltFit({type:'shoes',primaryColor:'brown',leather:'nubuck',shoeStyle:'derby'},{type:'belt',primaryColor:'brown',leather:'canvas'}),
        strap:[strapBand(w({band:'rubber'})),strapBand(w({band:'nato'})),strapBand(w({band:'bracelet'}))].join(),desc:[desc(w({band:'rubber'})),desc({type:'cufflinks',primaryColor:'navy',metal:'silk'}),desc({type:'belt',primaryColor:'brown',leather:'braided',metal:'silver'})].join(' | '),
        thumb:/link|circle/.test(itemThumb({type:'cufflinks',primaryColor:'navy',metal:'silk'})),paints:asmWatchPaints(w({band:'nato'}))&&!asmWatchPaints(w({band:'bracelet',dial:'white'})),text:watchText(w({band:'nato',metal:'two-tone'}))}});
    ok(e.same==='true,true,false,false'&&e.silk===null,'two-tone goes with gold and silver (not gunmetal); silk knots go with any metal');
    ok(e.fin==='suede,smooth,textile'&&e.fit===0,'nubuck is planned as suede, a braided belt as smooth leather; a canvas belt goes with suede-type shoes');
    ok(e.strap==='true,true,false'&&/black/.test(e.desc)&&/rubber strap/.test(e.desc)&&/Navy · silk knot|navy · silk knot/i.test(e.desc)&&/braided leather/.test(e.desc)&&e.thumb&&e.paints&&/two-tone/.test(e.text)&&/NATO strap/.test(e.text),'rubber and NATO straps have a color and are painted; descriptions say silk knot and braided leather: '+e.desc);
    // ---- the close-up reader's material card
    const CU='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
    await p.evaluate(cu=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');rememberRole({role:'owner'});settings.custom={colors:[],patterns:[]};applyCustom(settings.custom);
      items=[{id:'r1',type:'suit',primaryColor:'grey',pattern:'solid',texture:cu,added:2,name:'Grey suit'},{id:'r2',type:'suit',primaryColor:'grey',pattern:'solid',texture:cu,material:'wool',added:1,name:'Wool suit'}];show('wardrobe')},CU);
    const COL={kind:'colour',match:'existing',existing:'grey',dE:1,name:'grey',hex:'#8b8f96',plansAs:'grey',fitsType:true,confidence:'high',why:'',ask:null};
    const PAT={kind:'pattern',match:'existing',existing:'solid',name:'solid',description:'',plansAs:'solid',look:{layout:'none',tr:10},colourHint:null,confidence:'high',why:'',ask:null};
    const reply=m=>({colour:COL,pattern:{...PAT,...(m?{material:m}:{})},model:'stub',lookups:2});
    const read=async id=>{S.sent=[];await p.evaluate(id=>rdRun('e',id),id);await p.waitForSelector('#rd-sheet.on #rd-both');await settle(p,200)};
    const sheet=()=>p.evaluate(()=>{const s=document.querySelector('#rd-sheet'),m=s.querySelector('#rd-mat');return {mat:m&&m.textContent,both:s.querySelector('#rd-both').textContent,h:[...s.querySelectorAll('#rd-mat button,#rd-both')].map(b=>Math.round(b.getBoundingClientRect().height))}});
    S.reply=reply({key:'flannel',confidence:'high',why:'A fuzzy nap hides the weave.'});await read('r1');e=await sheet();
    ok(S.sent.length===1&&e.mat&&/Material: Flannel/.test(e.mat)&&/high confidence/.test(e.mat)&&/A fuzzy nap hides the weave/.test(e.mat)&&/Keep blank/.test(e.mat)&&/Use Flannel/.test(e.mat)&&e.h.every(x=>x>=44),'high confidence: a third card "Material: Flannel" with Keep / Use and Claude\'s line, one request (still 2 lookups), buttons 44 px: '+e.mat);
    ok(e.both==='Use Flannel','the bar uses what is left to decide (color and pattern already the item\'s): '+e.both);
    await p.click('#rd-muse');await p.waitForFunction(()=>items.find(i=>i.id==='r1').material==='flannel');await p.waitForSelector('#rd-mat.done');
    e=await p.evaluate(()=>({done:(document.querySelector('#rd-mat')||{}).textContent||'',bar:document.querySelector('#rd-both').textContent}));
    ok(/Flannel set/.test(e.done)&&/Undo/.test(e.done)&&e.bar==='Keep as it is','the card then says "Flannel set" with Undo; the color and pattern cards wait (the bar: '+e.bar+')');
    await p.click('#rd-both');await p.waitForFunction(()=>!document.querySelector('#rd-sheet.on'));
    e=await p.evaluate(()=>({t:((document.querySelector('#toast')||{}).textContent||'')+' '+((document.querySelector('#undo-fab.on')||{getAttribute:()=>''}).getAttribute('aria-label')||''),season:itemSeason(items.find(i=>i.id==='r1'))}));
    ok(/Material updated/.test(e.t)&&e.season==='cold','Use sets it (flannel: cold weather) and the toast says so, with Undo');
    await p.evaluate(()=>rdUndoAll());await p.waitForFunction(()=>!('material' in items.find(i=>i.id==='r1')));ok(true,'Undo takes the material off again');
    S.reply=reply({key:'cotton',confidence:'low',why:'maybe'});await read('r1');e=await sheet();ok(e.mat&&/Claude’s guess: cotton/.test(e.mat)&&/Use cotton/.test(e.mat)&&e.both==='Keep as it is','low confidence (2026-11-16): shown as Claude\'s guess with its own Use; the bar never applies it ('+e.both+')');await p.evaluate(()=>rdClose());
    S.reply=reply({key:'none',confidence:'low',why:''});await read('r1');e=await sheet();ok(!e.mat,'"none": no card');await p.evaluate(()=>rdClose());
    S.reply=reply(null);await read('r1');e=await sheet();ok(!e.mat,'an older worker (no material): no card');await p.evaluate(()=>rdClose());
    // a material set by hand: "Yours · Claude", Use all leaves it
    S.reply={colour:{...COL,match:'new',existing:'charcoal',dE:9,name:'smoke',hex:'#55585e',plansAs:'charcoal'},pattern:{...PAT,match:'existing',existing:'twill',name:'twill',plansAs:'twill',material:{key:'flannel',confidence:'medium',why:'Soft nap.'}},model:'stub',lookups:2};
    await read('r2');e=await sheet();
    ok(/Yours: Wool · Claude: Flannel/.test(e.mat)&&/Keep Wool/.test(e.mat)&&/Use Flannel/.test(e.mat)&&/medium confidence/.test(e.mat),'a material set by hand: "Yours: Wool · Claude: Flannel", Keep Wool / Use Flannel: '+e.mat);
    ok(e.both==='Use both','with the material yours, the bar is "Use both" (color and pattern)');
    await p.click('#rd-both');await p.waitForFunction(()=>!document.querySelector('#rd-sheet.on'));
    e=await p.evaluate(()=>{const i=items.find(x=>x.id==='r2');return {m:i.material,p:i.pattern,c:i.primaryColor}});
    ok(e.m==='wool'&&e.p==='twill'&&/^own/.test(e.c),'Use both sets the color and pattern and never changes a hand-set material: '+JSON.stringify(e));
    await p.evaluate(()=>rdUndoAll());await settle(p,300);
    // all three: "Use all"
    await p.evaluate(()=>{const i=items.find(x=>x.id==='r1');delete i.material;i.pattern='solid';i.primaryColor='grey'});
    S.reply={...S.reply,pattern:{...S.reply.pattern,material:{key:'flannel',confidence:'high',why:''}}};await read('r1');e=await sheet();
    ok(e.both==='Use all','color, pattern and material to decide: "Use all"');
    await p.click('#rd-both');await p.waitForFunction(()=>!document.querySelector('#rd-sheet.on'));
    e=await p.evaluate(()=>{const i=items.find(x=>x.id==='r1');return {m:i.material,p:i.pattern,t:((document.querySelector('#toast')||{}).textContent||'')+' '+((document.querySelector('#undo-fab.on')||{getAttribute:()=>''}).getAttribute('aria-label')||'')}});
    ok(e.m==='flannel'&&e.p==='twill'&&/Color, texture and material updated/.test(e.t),'Use all sets all three: '+JSON.stringify(e));
    // ---- the Add card: Claude's material from photo tagging
    e=await p.evaluate(()=>{queue.length=0;show('add');addManual();const q=queue[0];
      const tag=m=>normTag({type:'blazer',primaryColor:'navy',pattern:'solid',material:m},'claude-x');
      q.type='blazer';takeExtras(q,tag({key:'tweed',confidence:'high',why:'Flecked, rough wool.'}));renderAdd();
      const card=document.querySelector(`.qcard[data-q="${q.id}"]`),r1={m:q.material,note:(card.querySelector('.matai')||{}).textContent||'',sel:card.querySelector('.wmat').value};
      takeExtras(q,tag({key:'flannel',confidence:'medium',why:''}));const r2=q.material;   // a later reading replaces its own suggestion
      setQField(0,'material','hopsack');takeExtras(q,tag({key:'tweed',confidence:'high',why:''}));const r3={m:q.material,note:!!document.querySelector(`.qcard[data-q="${q.id}"] .matai`)};
      const q2={type:'suit'};takeExtras(q2,tag({key:'linen',confidence:'low',why:''}));const q3={type:'suit',material:'wool'};takeExtras(q3,normTag({type:'suit',primaryColor:'navy',pattern:'solid',material:{key:'linen',confidence:'high',why:''}},'m'));
      const q4={type:'shirt'};takeExtras(q4,normTag({type:'shirt',primaryColor:'white',pattern:'solid',material:{key:'oxford',confidence:'high',why:''}},'m'));
      return {r1,r2,r3,low:q2.material||'',hand:q3.material,off:q4.material||''}});
    ok(e.r1.m==='tweed'&&e.r1.sel==='tweed'&&/Material suggested by Claude \(high confidence\): Flecked, rough wool/.test(e.r1.note),'tagging fills an empty Material with Claude\'s high or medium answer, marked as Claude\'s suggestion and editable: '+e.r1.note);
    ok(e.r2==='flannel'&&e.r3.m==='hopsack'&&!e.r3.note,'tagging again replaces its own suggestion; one chosen by hand stays, and the mark goes');
    ok(e.low===''&&e.hand==='wool'&&e.off==='','a low answer fills nothing; a material already there stays; a name off the type\'s list (and not new) is ignored');
    await p.evaluate(()=>{queue.length=0;renderAdd()});
    ok(!errs.length,'no page errors: '+errs.join(' | '));
  }finally{await b.close()}
};
