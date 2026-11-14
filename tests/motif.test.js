// A motif (a small figure repeated on a grid: a neat / foulard, mini squares, dots) read by Claude (worker POST /pattern,
// layout "motif") and coloured from the photos: the user's purple and navy mini-square tie (tests/fixtures/tie-neat*.jpg) is
// drawn as its checkerboard of squares with white square-and-dot accents, not as the diagonal plaid the band reader made of it.
// An older band reading of a motif pattern is ignored everywhere (drawing, photo prompt, photo diagram, summary).
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null,reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});sent=JSON.parse(init.body);
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(reply())}]}),{status:200,headers:{'content-type':'application/json'}})};
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  // the answer Claude gives for the user's tie
  const MOTIF={grid:'diagonal',ground:{name:'dark navy',hex:'#1f2140'},figures:[
    {shape:'square',placement:'cell',colours:[{name:'purple',hex:'#7a5ea8'},{name:'navy',hex:'#3a3d72'}],centre:null,sizePct:74},
    {shape:'square-with-dot',placement:'corner',colours:[{name:'white',hex:'#ecebf2'}],centre:{name:'navy',hex:'#22254a'},sizePct:30}]};
  const SPEC={layout:'motif',across:null,along:null,motif:MOTIF,stripeDirection:'vertical',repeatsInCloseup:15,repeatsAcrossItem:9,paneAspect:1,ignored:'silk sheen, folds',
    description:'A woven silk neat: small purple and navy squares in a diagonal checkerboard, each corner with a tiny white square.'};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'},call=b=>worker.fetch(new Request('https://w.test/pattern',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(b)}),env);
  const browser=await chromium.launch();
  try{
    // ---- worker
    reply=()=>({...SPEC,across:{bands:[{role:'ground',name:'x',hex:'#000000',widthPct:50},{role:'line',name:'y',hex:'#ffffff',widthPct:50}]},
      motif:{...MOTIF,figures:[...MOTIF.figures,{shape:'blob',placement:'nowhere',colours:[{name:'bad',hex:'red'}],centre:null,sizePct:20}]}});
    let r=await call({image:IMG,closeup:IMG,type:'tie'}),j=await r.json();
    const t=[...(sent.system||[]).map(s=>s.text),...sent.messages[0].content.filter(c=>c.type==='text').map(c=>c.text)].join('\n'),sch=sent.output_config.format.schema;
    ok(r.status===200&&sch.properties.layout.enum.includes('motif')&&sch.required.includes('motif')&&/motif — for a motif only/.test(t)&&/square-with-dot/.test(t),'POST /pattern offers a motif reading: grid, ground and each figure');
    ok(j.layout==='motif'&&j.across===null&&j.motif.grid==='diagonal'&&j.motif.figures.length===2&&j.motif.figures[0].size===.74&&j.motif.figures[1].centre.hex==='#22254a',
      'the motif is tidied: bands dropped for a motif, a figure with no valid colour dropped, sizes as fractions');
    reply=()=>({...SPEC,motif:{...MOTIF,ground:{name:'x',hex:'nope'}}});
    ok((await call({image:IMG})).status===422,'a motif without a valid ground colour is reported as no pattern, not drawn');
    ok(/patternBox — for a striped, checked or plaid item, or one with a small figure repeated all over \(a neat or foulard, dots\)/.test(require('./workersrc.js')()),'the tagger marks a pattern box on a neat too, so its colours can be matched to the tie photo');

    // ---- app
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let calls=[];
    const spec={...SPEC,motif:{...MOTIF,figures:MOTIF.figures.map(f=>({...f,size:f.sizePct/100}))}};
    await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());
      if(u.pathname==='/pattern'){calls.push(JSON.parse(q.postData()));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...spec,model:'m'})})}
      if(q.method()==='POST'&&u.pathname==='/')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'tie',primaryColor:'purple',secondaryColor:'navy',tertiaryColor:'white',pattern:'foulard',metal:null,leather:null,dial:null,band:null,bezel:null,
        confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:{x:340,y:150,w:240,h:550},weave:null,model:'m'})});
      return route.fulfill({status:404,contentType:'application/json',body:'{}'})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    const m=await p.evaluate(async spec=>{const ld=async s=>{const im=new Image();im.src=s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c};
      const ph=await ld('tests/fixtures/tie-neat.jpg'),tx=await ld('tests/fixtures/tie-neat-closeup.jpg'),L=h=>rgbLab(...hexRgb(h));
      const s=motifFromSpec(spec,{tex:tx,full:ph,box:{x:340,y:150,w:240,h:550},type:'tie'}),noBox=motifFromSpec(spec,{tex:tx,full:ph,type:'tie'});
      const mm=s.motif,lab={ground:L(mm.ground),purple:L(mm.figs[0].cols[0]),navy:L(mm.figs[0].cols[1]),white:L(mm.figs[1].cols[0]),centre:L(mm.figs[1].centre)};
      const it={id:'t1',type:'tie',primaryColor:'purple',secondaryColor:'navy',tertiaryColor:'white',pattern:'foulard',sett:s};
      const def=fabricDef('q',it,'tie'),fig=fabricDef('q',it,'tie','fig');
      const o={suitDay:true,top:{id:'s',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'},tie:it};
      const key1=comboKey(o),key2=comboKey({...o,tie:{...it,sett:{...s,motif:{...mm,ground:'#000000'}}}});
      return {s,lab,noBoxGround:L(noBox.motif.ground)[0],def,fig,key1,key2,text:settText(it,'tie'),prompt:patternPrompt({...it,patternText:spec.description},'tie'),sum:settSummary(s)}},spec);
    const l=m.lab,hue=x=>Math.atan2(x[2],x[1])*180/Math.PI;
    ok(m.s.v===3&&m.s.src==='claude+pixels'&&m.s.a===45&&m.s.cr===15&&m.s.tr===9,'the tie\'s motif is kept with its diagonal grid and its scale (cells in the close-up and across the tie)');
    ok(l.white[0]>85&&l.white[0]>l.purple[0]&&l.purple[0]>l.navy[0]&&l.navy[0]>l.ground[0]&&l.ground[0]<30,
      `each colour comes from its own pixels, lightest to darkest white, purple, navy, ground (L* ${[l.white,l.purple,l.navy,l.ground].map(x=>x[0].toFixed(0)).join(' > ')})`);
    ok(hue(l.purple)>-80&&hue(l.purple)<-20&&Math.hypot(l.purple[1],l.purple[2])>12&&l.navy[2]<-5,`purple stays purple and navy stays blue (purple hue ${hue(l.purple).toFixed(0)}°, navy b* ${l.navy[2].toFixed(0)})`);
    ok(m.noBoxGround<30,`without a box on the tie the close-up's exposure is left alone (the photo's grey wall would wash it out): ground L* ${m.noBoxGround.toFixed(0)}`);
    const sq=(m.def.match(/<rect /g)||[]).length,cols=['#'+'',...m.s.motif.figs[0].cols];
    ok(/patternTransform="rotate\(45\)"/.test(m.def)&&m.def.includes(`fill="${m.s.motif.ground}"`)&&m.s.motif.figs[0].cols.every(c=>m.def.includes(c))&&m.def.includes(m.s.motif.figs[1].centre)&&sq>=4+9*2,
      'the swatch draws the squares in both colours like a checkerboard, the white square-and-dot at every corner, on the ground, turned 45°');
    const T=d=>+d.match(/width="([\d.]+)"/)[1];
    ok(T(m.fig)<T(m.def)&&T(m.fig)>2,`on the figure the tile is sized so about 9 cells fit across the tie (tile ${T(m.fig)} vs swatch ${T(m.def)})`);
    ok(m.key1!==m.key2,'a different motif reading makes a different outfit photo key (no stale photo)');
    ok(/diagonal \(45°\) grid/.test(m.text)&&/alternating purple and navy small squares/.test(m.text)&&/white tiny squares with a dot in the middle \(each with a navy dot\)/.test(m.text)&&/dark navy ground/.test(m.text)&&/about 9 repeats across the tie/.test(m.text),
      'the photo generator is told the motif in words: grid, figures, colours, ground and scale');
    ok(/neat pattern/.test(m.prompt)&&/A woven silk neat/.test(m.prompt)&&/2 figures on a diagonal grid, read by Claude/.test(m.sum),'the prompt adds Claude\'s description; the summary names the motif');

    // an older band reading of the same tie is ignored: no plaid drawn, described or sent as a diagram
    const old=await p.evaluate(()=>{const it={id:'t2',type:'tie',primaryColor:'purple',secondaryColor:'navy',tertiaryColor:'white',pattern:'foulard',sett:{v:2,a:-45,bands:[['#6c5584',.5],['#463a64',.5]],cross:null,cr:3,tr:4,src:'claude+pixels'}};
      items=[it];return {use:usableSett(it),def:fabricDef('q',it,'tie'),text:settText(it,'tie'),sum:patSummary(it),stripe:usableSett({...it,pattern:'stripe'})}});
    ok(old.use===null&&!old.def.includes('#6c5584')&&old.text===''&&/older reading drew these foulard figures as stripes/.test(old.sum)&&old.stripe,'an older band reading of a foulard is ignored (drawn generic, not described), and the editor says to read it again; a striped tie keeps its bands');

    // the Add card: the tagger says foulard; once the close-up is in, Claude reads the motif
    await p.evaluate(async()=>{items=[];show('add');const b=await (await fetch('tests/fixtures/tie-neat.jpg')).blob();await addFiles([new File([b],'t.jpg',{type:'image/jpeg'})])});
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/tie-neat-closeup.jpg')).blob();await addTexture(0,new File([b],'c.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0].sett&&queue[0].sett.motif,null,{timeout:20000});
    const card=await p.evaluate(()=>document.querySelector('#queue').textContent);
    ok(calls.length===1&&calls[0].closeup&&calls[0].type==='tie'&&/2 figures on a diagonal grid, read by Claude/.test(card),'a foulard tie\'s close-up asks Claude for the pattern, and the card shows the motif');
    await p.evaluate(()=>save(0));
    const sv=await p.evaluate(async()=>{const it=items[0],o={suitDay:true,top:{id:'s',type:'suit',primaryColor:'charcoal',pattern:'solid'},shirt:{id:'h',type:'shirt',primaryColor:'white',pattern:'solid'},tie:it};
      const {labels}=await outfitRefsFull(o);return {motif:!!(it.sett&&it.sett.motif),spec:!!it.patternSpec,label:labels.find(x=>/measured pattern/.test(x))||''}});
    ok(sv.motif&&sv.spec&&/copy its figures, their shapes, colours, arrangement and size exactly/.test(sv.label),'the saved tie keeps the motif, and the photo generator gets a drawing of it labelled as figures');
    // a foulard without Claude: no band reading (it would be a plaid); the generic foulard is drawn
    await p.evaluate(()=>localStorage.removeItem('worker_url'));
    const q2=await p.evaluate(async()=>{const q={type:'tie',pattern:'foulard',raw:{full:document.createElement('canvas'),tex:document.createElement('canvas')},weave:{layout:'check'}};return readSett(q)});
    ok(q2===null,'without Claude\'s reading a foulard gets no band reading');
    // the Wardrobe editor reads a foulard with Claude even without a close-up
    await p.evaluate(()=>localStorage.setItem('worker_url','https://w.test/'));
    const before=calls.length;await p.evaluate(async()=>{const it=items[0];delete it.sett;delete it.texture;delete it.pbox;await rereadSett(it.id)});
    ok(calls.length===before+1&&await p.evaluate(()=>!!(items[0].sett&&items[0].sett.motif)),'"Read pattern from photo" asks Claude for a foulard\'s motif and keeps it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
