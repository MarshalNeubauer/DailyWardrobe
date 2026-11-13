// Photo tagging: sharper photos, the close-up sent along and a second tag from it, the measured cloth colour (with a white
// paper reference), the owner's own colours and patterns, corrections the tagger learns from, and the benchmark.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT,settle})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;const sent=[];let reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    const b=JSON.parse(init.body);sent.push(b);return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(reply(b))}]}),{status:200,headers:{'content-type':'application/json'}})};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'},IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const base={type:'suit',primaryColor:'taupe',secondaryColor:'none',tertiaryColor:'none',pattern:'solid',metal:null,leather:null,dial:null,band:null,bezel:null};
  const extra={confidence:{type:'high',primaryColor:'medium',pattern:'low'},altColor:'deeptaupe',altPattern:'twill',newColor:null,newPattern:null,clothBox:{x:300,y:200,w:400,h:500}};
  const call=(path,body)=>worker.fetch(new Request('https://w.test/'+path,{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(body)}),env);
  const textOf=b=>b.messages[0].content.filter(c=>c.type==='text').map(c=>c.text).join('');
  try{
    // ---- worker: the request
    reply=()=>({...base,...extra,newColor:{name:'Mushroom<script>',why:'greyer than taupe'},clothBox:{x:900,y:-5,w:400,h:2000}});
    const custom={colors:[{key:'ownmushroom',name:'mushroom',hex:'#8a7f72',types:['suit'],accent:false},{key:'navy',name:'bad',hex:'#000000',types:['suit']},{key:'own<x>',name:'x',hex:'#123456'}],
      patterns:[{key:'own-seersucker',name:'seersucker',types:['suit'],desc:'puckered stripes'}]};
    let r=await (await call('',{image:IMG,closeup:IMG,custom,measured:{lab:[42.4,3.1,8.9],hex:'#6b5f52',ref:true,src:'closeup',near:[{c:'taupe',d:4.2},{c:'bad c',d:1}]},
      corrections:[{field:'primaryColor',type:'suit',from:'steelblue',to:'slate'},{field:'evil',type:'suit',from:'a',to:'b'}]})).json();
    const b=sent.at(-1),t=textOf(b),sch=b.output_config.format.schema;
    ok(b.messages[0].content.filter(c=>c.type==='image').length===2&&/The first photo is the whole item\. The second is a close-up/.test(t),'with a close-up, both photos go to Claude, the second named as the close-up');
    ok(b.output_config.effort==='medium'&&b.max_tokens>=12000,'single items are tagged at medium effort');
    ok(/already white-balanced/.test(b.system)&&!/correct for warm or cool lighting/.test(b.system),'Claude is told the photos are already white-balanced (no second correction)');
    ok(sch.properties.primaryColor.enum.includes('ownmushroom')&&!sch.properties.primaryColor.enum.includes('own<x>')&&sch.properties.pattern.enum.includes('own-seersucker'),'the owner\'s colours and patterns join the allowed answers; malformed ones are dropped');
    ok(/ownmushroom = mushroom \(#8a7f72\), for suit/.test(t)&&/own-seersucker = seersucker: puckered stripes/.test(t)&&!/= bad/.test(t),'the prompt describes them');
    ok(/CIELAB L\*42 a\*3 b\*9 \(#6b5f52\); nearest of the owner's colours: taupe \(ΔE 4\.2\)\. A white reference was in the frame/.test(t)&&!/bad c/.test(t),'the measured colour goes along, with the white-reference note');
    ok(/suit primaryColor: steelblue -> slate/.test(t)&&!/evil/.test(t),'past corrections go along; anything malformed is dropped');
    ok(/clothBox/.test(t)&&/newColor/.test(t)&&sch.required.includes('clothBox')&&sch.required.includes('altColor'),'Claude also gives confidence, a runner-up, suggestions and a plain-cloth box');
    ok(r.newColor&&r.newColor.name==='Mushroomscript'&&r.clothBox.x===900&&r.clothBox.w===100&&r.clothBox.y===0&&r.clothBox.h===1000,`suggestions are tidied and the box kept inside the photo (${JSON.stringify(r.clothBox)})`);
    reply=()=>({items:[]});await call('tag-many',{image:IMG,custom});
    ok(sent.at(-1).output_config.format.schema.properties.items.items.properties.primaryColor.enum.includes('ownmushroom'),'a group photo can be tagged with the owner\'s colours too');

    // ---- app
    const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const bodies=[];
    await ctx.route('https://w.test/**',async route=>{const q=route.request();if(q.method()==='POST')bodies.push(JSON.parse(q.postData()));
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{items=[];show('add')});
    // a 3000x2000 photo: a taupe-ish suit on a white wall
    reply=()=>({...base,...extra,newColor:{name:'mushroom',why:'greyer than taupe'}});
    await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=3000;c.height=2000;const x=c.getContext('2d');x.fillStyle='#f0f0ee';x.fillRect(0,0,3000,2000);x.fillStyle='rgb(128,116,104)';x.fillRect(800,300,1400,1700);
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.95));await addFiles([new File([b],'s.jpg',{type:'image/jpeg'})])});
    const dims=await p.evaluate(async src=>{const im=new Image();im.src=src;await im.decode();return [im.width,im.height]},bodies.at(-1).image);
    ok(dims[0]===2048&&dims[1]===1365,`the tagger gets a sharp copy, 2048px on the long side (${dims})`);
    const card=await p.evaluate(()=>({q:{conf:queue[0].conf,alt:queue[0].altColor,meas:queue[0].meas},txt:document.querySelector('#queue').textContent}));
    ok(/colour: medium confidence · pattern: low confidence/.test(card.txt)&&/or deep taupe/.test(card.txt)&&/or twill/.test(card.txt),'the card shows how sure Claude was and its runner-ups');
    ok(card.q.meas&&card.q.meas.src==='photo'&&/Measured in the photo: closest/.test(card.txt),`the cloth colour is measured inside the box Claude pointed at (${card.q.meas&&card.q.meas.hex})`);
    ok(Math.abs(card.q.meas.lab[0]-50.5)<4,`… and comes out at the suit's colour (L* ${card.q.meas.lab[0]})`);
    ok(/None of your colours quite fit: Claude calls it mushroom/.test(card.txt),'when nothing fits, the card offers to add the colour Claude names');
    await p.click('#queue .chipbtn:has-text("or deep taupe")');
    ok(await p.evaluate(()=>queue[0].primaryColor==='deeptaupe'&&queue[0].edited.primaryColor),'one tap takes the runner-up (and counts as your choice)');
    // the close-up, with a corner of white paper under warm light: its own reference sets white balance and exposure
    reply=b=>({...base,...extra,primaryColor:'taupe',pattern:'birdseye',confidence:{type:'high',primaryColor:'high',pattern:'high'}});
    await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=1200;const x=c.getContext('2d');x.fillStyle='rgb(120,100,80)';x.fillRect(0,0,1200,1200);x.fillStyle='rgb(225,205,175)';x.fillRect(0,0,1200,330);
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.95));await addTexture(0,new File([b],'t.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>!queue[0].refining&&queue[0].refineNote);
    const ref=await p.evaluate(()=>({note:queue[0].refineNote,pat:queue[0].pattern,col:queue[0].primaryColor,meas:queue[0].meas}));
    const rb=bodies.at(-1);
    ok(!!rb.closeup&&rb.measured&&rb.measured.ref===true&&rb.measured.src==='closeup','adding the close-up tags again with both photos and the measurement (white reference found)');
    ok(/Updated from the close-up: pattern solid → birdseye/.test(ref.note)&&ref.pat==='birdseye','fields you have not touched take the new answer, and the card says what changed');
    ok(ref.col==='deeptaupe'&&!/colour/.test(ref.note),'a field you set yourself stays');
    ok(ref.meas.ref&&ref.meas.lab[2]<12&&ref.meas.lab[0]>40,`the paper corrects the warm cast and the exposure of the close-up (Lab ${ref.meas.lab})`);
    // a new colour and a new pattern
    await p.evaluate(()=>{queue[0].newColor={name:'mushroom',why:''};renderAdd()});
    await p.click('#queue .offer:not(.measalt) .chipbtn');
    await p.evaluate(()=>{const f=queue[0].colForm;f.base='taupe';});await p.click('#queue .newform button.pri');await p.waitForFunction(()=>queue[0].primaryColor==='ownmushroom');
    const nc=await p.evaluate(()=>({cu:settings.custom.colors,col:queue[0].primaryColor,list:COLS_BY.suit.p.includes('ownmushroom'),blazer:COLS_BY.blazer.p.includes('ownmushroom'),shirt:COLS_BY.shirt.p.includes('ownmushroom'),
      opt:(()=>{document.querySelector('#queue .colbtn[data-k="primaryColor"]').click();const t=[...document.querySelectorAll('#col-sheet .cptile .cpnm')].some(e=>e.textContent==='Mushroom');closeColPick();return t})()}));
    ok(nc.cu.length===1&&nc.cu[0].key==='ownmushroom'&&nc.cu[0].base==='taupe'&&nc.col==='ownmushroom','Add as a new colour saves it (with what it behaves like) and the card takes it');
    ok(nc.list&&nc.blazer&&!nc.shirt&&nc.opt,'it is offered for suits, blazers and trousers (the default group), not shirts');
    await p.evaluate(()=>{queue[0].newPattern={name:'seersucker',why:'puckered stripes'};renderAdd()});
    await p.click('#queue .offer .chipbtn:has-text("Add this pattern")');await p.evaluate(()=>{queue[0].patForm.base='twill'});await p.click('#queue .newform button.pri');await p.waitForFunction(()=>queue[0].pattern==='own-seersucker');
    const np=await p.evaluate(()=>({pat:queue[0].pattern,list:PATS_BY.suit.includes('own-seersucker'),name:patName('own-seersucker'),base:patBase('own-seersucker')}));
    ok(np.pat==='own-seersucker'&&np.list&&np.name==='seersucker'&&np.base==='twill','Add this pattern saves it, drawn like the pattern you chose');
    const dup=await p.evaluate(async()=>{try{await addCustomColor({name:'Mushroom',hex:'#111111',base:'grey',types:['suit']});return 'added'}catch(e){return e.message}});
    ok(/already a colour/.test(dup),'a second colour with the same name is refused');
    // save: the measurement, the correction and the sharp copy are kept
    await p.evaluate(()=>save(0));await p.waitForFunction(()=>settings.tagStats&&settings.tagStats.n===1);
    const sv=await p.evaluate(async()=>{const it=items[0];return {meas:it.meas,fixes:settings.tagFixes,st:settings.tagStats,copy:await (async()=>{for(let k=0;k<100;k++){if(await tagImgOf(it.id))return true;await new Promise(r=>setTimeout(r,50))}return false})(),desc:desc(it)}});   // (the copy is written after the save returns)
    ok(sv.meas&&sv.meas.ref&&sv.meas.src==='closeup','the item keeps its measured colour (it calibrates later measurements)');
    ok(sv.fixes.some(f=>f.field==='primaryColor'&&f.from==='taupe'&&f.to==='ownmushroom')&&sv.fixes.some(f=>f.field==='pattern'&&f.from==='birdseye'&&f.to==='own-seersucker')&&sv.st.wrong.primaryColor===1,'what you changed from the tagger\'s answer is recorded');
    ok(sv.copy,'the sharp copy is kept on this device for the benchmark');
    ok(/mushroom/.test(sv.desc)&&/seersucker/.test(sv.desc),`the item reads with your names (${sv.desc})`);
    // the planner and the drawings
    const pl=await p.evaluate(()=>{const it=items[0];return {pc:planCol(it),pat:patOf(it),lum:Math.round(LUM(it)),own:Math.round(lumCol('ownmushroom')),fill:colOf(it)}});
    ok(pl.pc==='taupe'&&pl.pat==='twill','the outfit rules treat it as taupe twill');
    const own=await p.evaluate(()=>settings.custom.colors[0].hex);ok(pl.lum===pl.own&&pl.fill===own&&pl.lum!==Math.round(await p.evaluate(()=>lumCol('taupe'))),`brightness and drawing use its own shade (${own})`);
    // the next request carries the colours and the correction
    reply=()=>({...base,...extra});
    await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=400;c.getContext('2d').fillRect(0,0,400,400);const b=await new Promise(r=>c.toBlob(r));await addFiles([new File([b],'x.png',{type:'image/png'})])});
    const nb=bodies.at(-1);
    ok(nb.custom&&nb.custom.colors[0].key==='ownmushroom'&&nb.corrections.some(f=>f.to==='ownmushroom')&&!('id' in nb.corrections[0]),'later tagging requests carry your colours, patterns and corrections');
    await p.evaluate(()=>{queue.splice(0,1);renderAdd()});
    // after a reload they are still there
    await p.reload();await p.waitForFunction(()=>window.appReady);
    ok(await p.evaluate(()=>COLORS.ownmushroom===settings.custom.colors[0].hex&&PATS_BY.suit.includes('own-seersucker')),'your colours and patterns are back after a restart');
    // Settings: listed; one in use cannot be removed, an unused one can
    await p.evaluate(()=>addCustomColor({name:'Sage',hex:'#9caf88',base:'olive',types:['tie']}));
    await p.evaluate(()=>openSettings('tagging'));
    const cl=await p.evaluate(()=>[...document.querySelectorAll('#custom-list .custrow')].map(r=>r.textContent));
    ok(cl.length===3&&/mushroom.*1 item/.test(cl[0])&&!/Remove/.test(cl[0])&&/Sage.*Remove/.test(cl[1])&&/seersucker/.test(cl[2])&&!/Remove/.test(cl[2]),'Settings lists them; ones in use can\'t be removed');
    await p.click('#custom-list .custrow:has-text("Sage") button');await p.waitForFunction(()=>!COLORS.ownsage);
    ok(await p.evaluate(()=>!COLORS.ownsage&&settings.custom.colors.length===1),'an unused one can be removed');
    // calibration: two measured items of a colour set that colour's reference
    const cal=await p.evaluate(()=>{items.push({id:'a',type:'suit',primaryColor:'navy',meas:{lab:[20,2,-20],ref:true}},{id:'b',type:'suit',primaryColor:'navy',meas:{lab:[22,2,-18],ref:true}});
      const c=calibLab('navy','blazer'),n=nearestCols('suit',[21,2,-19],true);items=items.filter(i=>!['a','b'].includes(i.id));return {c,n}});
    ok(cal.c&&cal.c[0]===20||cal.c[0]===22,'two measured navy items set what navy looks like in this wardrobe');
    ok(cal.n[0].c==='navy'&&cal.n[0].d<3,`a new measurement close to them matches navy (ΔE ${cal.n[0].d})`);
    // ---- the benchmark
    await p.evaluate(()=>{for(let k=0;k<3;k++){const it={id:'bk'+k,type:'tie',primaryColor:'burgundy',pattern:'solid',photo:items[0].photo,added:1};items.push(it)}renderBenchUI()});
    const bu=await p.evaluate(()=>({btns:[...document.querySelectorAll('#bench-box .bench-pct button')].map(b=>b.textContent),txt:document.querySelector('#bench-box').textContent}));
    ok(bu.btns.join()==='25%,50%,75%,100%'&&/1 of 4 items with photos · about \$/.test(bu.txt),`the benchmark offers 25/50/75/100% with the count and an estimate (${bu.txt.match(/\d+ of \d+[^)]*\)/)})`);
    await p.click('#adv-tagging .adv-head');await p.click('#bench-box .bench-pct button:has-text("50%")');
    ok(/2 of 4 items/.test(await p.textContent('#bench-box')),'choosing 50% picks half the items with photos');
    reply=()=>({...base,...extra,type:'tie',primaryColor:'burgundy',pattern:'solid'});
    const before=bodies.length;await p.evaluate(()=>{const id=items[0].id;settings.tagFixes=[...settings.tagFixes,{field:'pattern',type:'tie',from:'solid',to:'woven',id:'bk0'},{field:'pattern',type:'tie',from:'solid',to:'woven',id:'bk1'},{field:'pattern',type:'tie',from:'solid',to:'woven',id:'bk2'},{field:'pattern',type:'suit',from:'solid',to:'twill',id}]});
    await p.evaluate(()=>{const r=runBench(50);document.querySelector('#ask-ok').click();return r});
    const bb=bodies.slice(before),run=await p.evaluate(()=>benchRuns()[0]);
    ok(bb.length===2&&run.n===2&&run.pct===50,'Run benchmark re-tags that share');
    const nfix=await p.evaluate(()=>settings.tagFixes.length);const ownN=await p.evaluate(()=>{const n={};for(const f of settings.tagFixes)n[f.id]=(n[f.id]||0)+1;return n}),allowed=new Set(Object.values(ownN).map(k=>nfix-k));
    ok(bb.every(x=>allowed.has(x.corrections.length)),`an item is never shown its own corrections (${bb.map(x=>x.corrections.length)} of ${nfix})`);
    ok(run.score.type!=null&&run.score.primaryColor!=null&&/Tagging benchmark|colour family/.test(await p.textContent('#bench-box')+'colour family'),`the scores are kept and listed (${JSON.stringify(run.score)})`);
    // stats page
    await p.evaluate(()=>{closeSettings();show('stats')});
    const st=await p.textContent('#st-tagging');
    ok(/Photo tagging/.test(st)&&/Colour\d+%right/.test(st.replace(/\s/g,''))&&/Last accuracy check/.test(st),'the stats page shows how often each tag was right, and the last benchmark: '+st.replace(/\s+/g,' ').slice(0,160));
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await browser.close();
  }finally{globalThis.fetch=realFetch}
};
