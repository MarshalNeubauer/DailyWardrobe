// The pattern read by Claude (worker POST /pattern) and coloured from the photos: Claude strips the noise (a seam, moire, panes
// made uneven by drape) and lists every band of a repeat each way; the app matches each thread to its own pixels, matches the
// close-up's exposure to the item photo's, keeps Claude's hue where the pixels read grey, and falls back to the pixel reader.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null,reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});sent=JSON.parse(init.body);
    return new Response(JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(reply())}]}),{status:200,headers:{'content-type':'application/json'}})};
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  const g='#b0a084',wh='#efeae0',bl='#9db3cf';
  const dir={bands:[{role:'ground',name:'sand khaki',hex:g,widthPct:93},{role:'line',name:'white',hex:wh,widthPct:1.5},{role:'ground',name:'sand khaki',hex:g,widthPct:1},
    {role:'line',name:'light blue',hex:bl,widthPct:1.8},{role:'ground',name:'sand khaki',hex:g,widthPct:1},{role:'line',name:'white',hex:wh,widthPct:1.7}]};
  const SPEC={layout:'windowpane',across:dir,along:dir,stripeDirection:'vertical',repeatsInCloseup:3.5,repeatsAcrossItem:9,paneAspect:1.1,ignored:'a seam down the middle, moire',
    description:'Large windowpane on sand khaki linen: each pane edged by a light blue line with a thin white line either side.'};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'},call=(b,tok='t')=>worker.fetch(new Request('https://w.test/pattern',{method:'POST',headers:{'content-type':'application/json','x-app-token':tok},body:JSON.stringify(b)}),env);
  const browser=await chromium.launch();
  try{
    // ---- worker
    reply=()=>({...SPEC,across:{bands:[...dir.bands,{role:'line',name:'bad',hex:'blue',widthPct:5}]}});
    let r=await call({image:IMG,closeup:IMG,type:'blazer'}),j=await r.json();
    const t=sent.messages[0].content.find(c=>c.type==='text').text,sch=sent.output_config.format.schema;
    ok(r.status===200&&sent.messages[0].content.filter(c=>c.type==='image').length===2&&sent.output_config.effort==='high','POST /pattern sends the photo and the close-up to Claude at high effort');
    ok(/as it was WOVEN, stripping away everything that is not the/.test(t)&&/seams and the pattern shift across them/.test(t)&&/The item is a blazer/.test(t)&&sch.required.includes('across')&&sch.required.includes('paneAspect'),'the prompt asks for the woven pattern without the noise, band by band each way');
    ok(j.across.bands.length===6&&Math.abs(j.across.bands.reduce((a,b)=>a+b.w,0)-1)<1e-3&&j.across.bands[0].w>.9&&j.repeatsInCloseup===3.5,'bands are tidied (a bad colour dropped) and their widths made shares of the repeat');
    ok((await call({image:IMG},'nope')).status===403,'it needs the app token');
    reply=()=>({...SPEC,layout:'none',across:{bands:[]},along:null});
    ok((await call({image:IMG})).status===422,'no pattern found is reported, not drawn');

    // ---- app: Claude's answer coloured from the user's blazer photos
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let patternReply=()=>[200,{...SPEC,across:{bands:dir.bands.map(b=>({...b,w:b.widthPct/100}))},along:{bands:dir.bands.map(b=>({...b,w:b.widthPct/100}))},model:'m'}],calls=[];
    await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());
      if(u.pathname==='/pattern'){calls.push(JSON.parse(q.postData()));const [st,b]=patternReply();return route.fulfill({status:st,contentType:'application/json',body:JSON.stringify(b)})}
      if(q.method()==='POST'&&u.pathname==='/')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'blazer',primaryColor:'khaki',secondaryColor:'lightblue',tertiaryColor:'white',pattern:'windowpane',metal:null,leather:null,dial:null,band:null,bezel:null,
        confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:{x:220,y:420,w:180,h:280},weave:null,model:'m'})});
      return route.fulfill({status:404,contentType:'application/json',body:'{}'})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    const sp=await p.evaluate(async SPEC=>{const ld=async s=>{const im=new Image();im.src=s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c};
      const ph=await ld('tests/fixtures/blazer-windowpane.jpg'),tx=await ld('tests/fixtures/blazer-windowpane-closeup.jpg');
      const spec={...SPEC,across:{bands:SPEC.across.bands.map(b=>({...b,w:b.widthPct/100}))},along:{bands:SPEC.along.bands.map(b=>({...b,w:b.widthPct/100}))}};
      const s=settFromSpec(spec,{full:ph,box:{x:220,y:420,w:180,h:280},tex:tx,type:'blazer'}),L=h=>rgbLab(...hexRgb(h)),C=l=>Math.hypot(l[1],l[2]);
      const plainClose=settFromSpec(spec,{tex:tx,type:'blazer'}),gl=L(s.bands[0][0]),gc=L(plainClose.bands[0][0]),blue=L(s.bands[3][0]),white=L(s.bands[1][0]);
      const tie=settFromSpec({...spec,stripeDirection:'upper-left to lower-right'},{tex:tx,type:'tie'});
      return {s,ground:gl,groundClose:gc,blue,blueC:C(blue),white,tieA:tie.a}},SPEC);
    ok(sp.s.src==='claude+pixels'&&sp.s.bands.length===6&&sp.s.cross&&sp.s.cross.bands.filter(b=>b[0]).length===3&&sp.s.cross.r===1.1&&sp.s.cr===3.5&&sp.s.tr===9,'the windowpane is drawn from Claude\'s bands: the white-blue-white group both ways, the pane shape, 3.5 panes in the close-up and 9 across the jacket');
    ok(Math.abs(sp.ground[0]-71)<4&&sp.ground[0]>sp.groundClose[0]+5,`the close-up's exposure is matched to the jacket photo's (ground L* ${sp.ground[0].toFixed(0)}, the close-up alone ${sp.groundClose[0].toFixed(0)})`);
    ok(sp.blue[2]<-5&&sp.blueC>8,`the light-blue line stays light blue though its pixels read grey (b* ${sp.blue[2].toFixed(0)}, chroma ${sp.blueC.toFixed(0)})`);
    ok(sp.white[0]>80&&sp.white[0]<95,`the white line reads cream-white, its threads crossing the khaki (L* ${sp.white[0].toFixed(0)})`);
    ok(sp.tieA===-45,'a tie\'s stripes take Claude\'s direction');
    // the user's navy pinstripe suit: no pattern box saved, and the item photo is mostly wall and the next jackets
    const ps=await p.evaluate(async()=>{const ld=async s=>{const im=new Image();im.src=s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c};
      const ph=await ld('tests/fixtures/suit-pinstripe.jpg'),tx=await ld('tests/fixtures/suit-pinstripe-closeup.jpg'),nv='#2b365a',ln='#a3aecb',L=h=>rgbLab(...hexRgb(h));
      const spec={layout:'stripes',across:{bands:[{role:'ground',name:'navy',hex:nv,w:.47},{role:'line',name:'pale blue-grey',hex:ln,w:.06},{role:'ground',name:'navy',hex:nv,w:.47}]},along:null,stripeDirection:'vertical',repeatsInCloseup:7,repeatsAcrossItem:40,paneAspect:1};
      const d=s=>dE00(L(s.bands[0][0]),L(nv)),noBox=settFromSpec(spec,{full:ph,tex:tx,type:'suit'}),wall=settFromSpec(spec,{full:ph,box:{x:0,y:250,w:270,h:110},tex:tx,type:'suit'});
      return {noBox:d(noBox),wall:d(wall),line:L(noBox.bands[1][0])[0],ground:L(noBox.bands[0][0])[0]}});
    ok(ps.noBox<10&&ps.ground<35,`without a pattern box the close-up keeps its own exposure: the pinstripe suit stays navy (ΔE00 ${ps.noBox.toFixed(1)} from Claude's navy, L* ${ps.ground.toFixed(0)})`);
    ok(ps.wall<15&&ps.line>ps.ground+20,`a box over the wall can't lift the navy past 15 ΔE00 (${ps.wall.toFixed(1)}); the stripe stays light`);
    const mig=await p.evaluate(async()=>{const tex=await (await fetch('tests/fixtures/suit-pinstripe-closeup.jpg')).blob(),url=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(tex)});
      const spec={layout:'stripes',across:{bands:[{role:'ground',name:'navy',hex:'#2b365a',w:.47},{role:'line',name:'pale blue-grey',hex:'#a3aecb',w:.06},{role:'ground',name:'navy',hex:'#2b365a',w:.47}]},along:null,stripeDirection:'vertical',repeatsInCloseup:7,repeatsAcrossItem:40,paneAspect:1};
      const it={id:'pinsuit',type:'suit',primaryColor:'navy',pattern:'pinstripe',texture:url,patternSpec:spec,sett:{v:2,a:0,bands:[['#63657d',.47],['#b1b6ce',.06],['#63657d',.47]],cross:null,cr:7,tr:40,src:'claude+pixels'}};
      items.push(it);await put(it);localStorage.removeItem('spec_recolour');const n=await recolourSpecSetts(),again=await recolourSpecSetts();
      const L=rgbLab(...hexRgb(it.sett.bands[0][0]));items.splice(items.indexOf(it),1);return {n,again,L:L[0],d:dE00(L,rgbLab(...hexRgb('#2b365a'))),flag:localStorage.getItem('spec_recolour')}});
    ok(mig.n===1&&mig.again===0&&mig.d<10&&mig.L<35&&mig.flag==='3',`a saved lavender pinstripe is recoloured once on start from its saved reading (L* ${mig.L.toFixed(0)}, ΔE00 ${mig.d.toFixed(1)} from navy)`);
    // a reading with a pattern box is recoloured too, from the box in the item photo (it was skipped, and kept its dull lines)
    const bx=await p.evaluate(async SPEC=>{const du=async u=>{const b=await (await fetch(u)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})};
      const spec={...SPEC,across:{bands:SPEC.across.bands.map(b=>({...b,w:b.widthPct/100}))},along:{bands:SPEC.along.bands.map(b=>({...b,w:b.widthPct/100}))}};
      const it={id:'wpbox',type:'blazer',primaryColor:'khaki',pattern:'windowpane',photo:await du('tests/fixtures/blazer-windowpane.jpg'),texture:await du('tests/fixtures/blazer-windowpane-closeup.jpg'),pbox:{x:220,y:420,w:180,h:280},patternSpec:spec,
        sett:{v:2,a:0,bands:spec.across.bands.map(b=>['#808080',b.w]),cross:{d:90,bands:spec.along.bands.map(b=>[b.role==='ground'?null:'#808080',b.w]),r:1.1},cr:3.5,tr:9,src:'claude+pixels'}};
      items.push(it);await put(it);localStorage.removeItem('spec_recolour');const n=await recolourSpecSetts();items.splice(items.indexOf(it),1);
      return {n,grey:it.sett.bands.filter(b=>b[0]==='#808080').length}},SPEC);
    ok(bx.n===1&&bx.grey===0,`a reading with a pattern box is recoloured once too (${bx.n} recoloured, ${bx.grey} bands left grey)`);
    // a tie of equal navy and blue stripes, and one with thin white edging beside a grey band (the owner's, 2026-11-12): the ground
    // is measured from the pixels nearest Claude's ground (the whole close-up's median landed between navy and blue), a tie's
    // stripes get none of the ground mixed in, and a thin line's colour comes from its pixels furthest from the ground
    const eq=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=300;const g=c.getContext('2d'),L=h=>rgbLab(...hexRgb(h));
      for(let x=-300;x<600;x+=60){g.fillStyle='#24243e';g.beginPath();g.moveTo(x,0);g.lineTo(x+30,0);g.lineTo(x+330,300);g.lineTo(x+300,300);g.fill();g.fillStyle='#5387c2';g.beginPath();g.moveTo(x+30,0);g.lineTo(x+60,0);g.lineTo(x+360,300);g.lineTo(x+330,300);g.fill()}
      const spec={layout:'stripes',across:{bands:[{role:'ground',name:'navy',hex:'#1e2347',w:.5},{role:'line',name:'blue',hex:'#5b8fd0',w:.5}]},along:null,stripeDirection:'upper-left to lower-right',repeatsInCloseup:5,repeatsAcrossItem:2.5,paneAspect:1};
      const s=settFromSpec(spec,{tex:c,type:'tie'});
      const w=document.createElement('canvas');w.width=w.height=300;const h=w.getContext('2d');h.fillStyle='#141e33';h.fillRect(0,0,300,300);h.filter='blur(1px)';
      for(let x=0;x<300;x+=75){h.fillStyle='#e8e8e6';h.fillRect(x,0,3,300);h.fillStyle='#8b8d93';h.fillRect(x+3,0,17,300);h.fillStyle='#e8e8e6';h.fillRect(x+20,0,3,300)}
      const spec2={layout:'stripes',across:{bands:[{role:'ground',name:'navy',hex:'#1f2d4e',w:.69},{role:'line',name:'white',hex:'#e4e4e2',w:.04},{role:'line',name:'grey',hex:'#9a9ea7',w:.23},{role:'line',name:'white',hex:'#e4e4e2',w:.04}]},along:null,stripeDirection:'vertical',repeatsInCloseup:4,repeatsAcrossItem:2.5,paneAspect:1};
      const s2=settFromSpec(spec2,{tex:w,type:'tie'});
      return {navy:dE00(L(s.bands[0][0]),L('#24243e')),blue:dE00(L(s.bands[1][0]),L('#5387c2')),white:L(s2.bands[1][0])[0],grey:L(s2.bands[2][0])[0]}});
    ok(eq.navy<2&&eq.blue<2,`a half-navy, half-blue tie keeps both colours (ΔE00 ${eq.navy.toFixed(1)} and ${eq.blue.toFixed(1)} from the cloth)`);
    ok(eq.white>82&&eq.grey>62&&eq.white>eq.grey+12,`a tie's thin white edging stays lighter than the grey band it borders (L* ${eq.white.toFixed(0)} against ${eq.grey.toFixed(0)})`);
    // a tie's read stripes and figures are drawn without the faint white sheen line: turned with the pattern it showed as light bands
    const sh=await p.evaluate(()=>{const band={id:'sb',type:'tie',primaryColor:'navy',secondaryColor:'white',pattern:'stripe',sett:{v:2,a:-45,bands:[['#141e33',.69],['#c0c3c1',.04],['#8b8d93',.23],['#c0c3c1',.04]],cross:null,cr:3.5,tr:2.5,src:'claude+pixels'}};
      const mot={id:'sm',type:'tie',primaryColor:'navy',pattern:'foulard',sett:{v:3,motif:{grid:'diagonal',ground:'#313363',figs:[{shape:'square',place:'cell',size:.9,cols:['#755ea0']}]},a:45,cr:17,tr:20,src:'claude+pixels'}};
      return [fabricDef('x1',band,'tie'),fabricDef('x2',mot,'tie'),fabricDef('x3',band,'tie','fig')].map(d=>/stroke="#fff"/.test(d))});
    ok(sh.every(v=>!v),`a tie's stripes and figures have no white sheen line across them (${sh.join(', ')})`);
    // the Add card: after the close-up, Claude reads the pattern
    await p.evaluate(async()=>{show('add');const b=await (await fetch('tests/fixtures/blazer-windowpane.jpg')).blob();await addFiles([new File([b],'b.jpg',{type:'image/jpeg'})])});
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([b],'c.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0].sett&&queue[0].sett.src==='claude+pixels',null,{timeout:20000});
    const card=await p.evaluate(()=>({txt:document.querySelector('#queue').textContent}));
    ok(calls.length===1&&calls[0].closeup&&calls[0].type==='blazer'&&/read by Claude with the colours from the photo/.test(card.txt),'adding the close-up asks Claude for the pattern, and the card says so');
    await p.evaluate(()=>save(0));
    const sv=await p.evaluate(()=>({spec:!!items[0].patternSpec,text:items[0].patternText,prompt:patternPrompt(items[0],'top')}));
    ok(sv.spec&&/Large windowpane on sand khaki linen/.test(sv.text)&&/light blue/.test(sv.prompt),'the item keeps Claude\'s reading, its description and its thread names for the photo prompt');
    // Claude unavailable: the pixel reader
    patternReply=()=>[502,{error:'ai'}];
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/blazer-windowpane.jpg')).blob();await addFiles([new File([b],'b.jpg',{type:'image/jpeg'})]);
      const c=await (await fetch('tests/fixtures/blazer-windowpane-closeup.jpg')).blob();await addTexture(0,new File([c],'c.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0]&&!queue[0].patternReading&&queue[0].specFailed,null,{timeout:20000});
    ok(await p.evaluate(()=>queue[0].sett&&queue[0].sett.src!=='claude+pixels'),'when Claude can\'t read it, the pixel reader\'s pattern is used');
    // the Wardrobe editor's "Read pattern from photo" asks Claude too
    patternReply=()=>[200,{...SPEC,across:{bands:dir.bands.map(b=>({...b,w:b.widthPct/100}))},along:{bands:dir.bands.map(b=>({...b,w:b.widthPct/100}))},model:'m'}];
    const before=calls.length;await p.evaluate(async()=>{queue=[];const it=items[0];delete it.sett;delete it.patternSpec;await rereadSett(it.id)});
    ok(calls.length===before+1&&calls.at(-1).closeup&&await p.evaluate(()=>items[0].sett.src==='claude+pixels'&&!!items[0].patternSpec),'"Read pattern from photo" in the Wardrobe asks Claude and keeps its reading');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
