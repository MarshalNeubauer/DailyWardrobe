// A dress shirt's weave texture (dobby diamonds, herringbone, oxford) read by Claude (worker POST /pattern, layout "texture") as a
// small bitmap of one repeat, drawn in the tagged colour with the texture's strength measured from the close-up. The close-up
// fixture is the user's white diamond-dobby shirt.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null,reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});sent=JSON.parse(init.body);
    return new Response(JSON.stringify({model:'m',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(reply())}]}),{status:200,headers:{'content-type':'application/json'}})}
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  // a diamond lattice 8 cells wide and 12 tall: two diagonal lines that meet the next repeat's
  const grid=[...Array(12)].map((_,y)=>{const a=Math.round(y*8/12)%8,b=(8-Math.round(y*8/12))%8;return [...Array(8)].map((_,x)=>x===a||x===b?'1':'0').join('')});
  const TEX={layout:'texture',across:null,along:null,motif:null,texture:{kind:'diamond',grid,ground:{name:'white',hex:'#f4f4f2'},raised:{name:'bright white',hex:'#fbfbfa'},contrast:'subtle',aspect:1.5},
    stripeDirection:'vertical',repeatsInCloseup:12,repeatsAcrossItem:150,paneAspect:1,ignored:'light falloff',description:'A white dress shirt in a small diamond dobby weave.'};
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'},call=b=>worker.fetch(new Request('https://w.test/pattern',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify(b)}),env);
  const browser=await chromium.launch();
  try{
    // ---- worker
    reply=()=>({...TEX,across:{bands:[{role:'ground',name:'x',hex:'#ffffff',widthPct:50},{role:'line',name:'y',hex:'#000000',widthPct:50}]},texture:{...TEX.texture,grid:['#..#','.##.','x--x','bad!!1']}});
    let r=await call({image:IMG,closeup:IMG,type:'shirt'}),j=await r.json();
    const t=sent.messages[0].content.find(c=>c.type==='text').text,sch=sent.output_config.format.schema;
    ok(r.status===200&&sch.required.includes('texture')&&sch.properties.layout.enum.includes('texture')&&/ONE repeat of the texture as a small bitmap/.test(t)&&/dobby diamonds/.test(t),'POST /pattern asks Claude for a weave texture as a one-repeat bitmap');
    ok(j.layout==='texture'&&j.across===null&&j.texture&&j.texture.kind==='diamond'&&j.texture.grid.join(',')==='1001,0110,1001,1'+'000'&&j.texture.ground.hex==='#f4f4f2'&&j.texture.aspect===1.5,`the bitmap is tidied: #/. and x/- become 1/0, rows padded to one length, no stray bands (${j.texture&&j.texture.grid.join(',')})`);
    reply=()=>({...TEX,texture:{...TEX.texture,grid:['1111','1111']}});
    ok((await call({image:IMG,type:'shirt'})).status===422,'a bitmap with only one tone is no texture');

    // ---- app
    const ctx=await browser.newContext({viewport:{width:390,height:844}});let patternReply=()=>[200,{...TEX,model:'m'}],calls=[];
    await ctx.route('https://w.test/**',async route=>{const q=route.request(),u=new URL(q.url());
      if(u.pathname==='/pattern'){calls.push(JSON.parse(q.postData()));const [st,b]=patternReply();return route.fulfill({status:st,contentType:'application/json',body:JSON.stringify(b)})}
      if(q.method()==='POST'&&u.pathname==='/')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'shirt',primaryColor:'white',secondaryColor:'none',tertiaryColor:'none',pattern:'woven',metal:null,leather:null,dial:null,band:null,bezel:null,
        confidence:{type:'high',primaryColor:'high',pattern:'high'},altColor:'none',altPattern:'none',newColor:null,newPattern:null,clothBox:null,patternBox:null,weave:null,model:'m'})});
      return route.fulfill({status:404,contentType:'application/json',body:'{}'})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
    const sp=await p.evaluate(async TEX=>{const im=new Image();im.src='tests/fixtures/shirt-diamond-closeup.jpg';await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
      const s=texFromSpec(TEX,{tex:c,type:'shirt'}),plain=document.createElement('canvas');plain.width=plain.height=300;const x=plain.getContext('2d');x.fillStyle='#9a9a98';x.fillRect(0,0,300,300);
      // light falloff alone (a smooth gradient) is no texture
      const gr=x.createLinearGradient(0,0,300,0);gr.addColorStop(0,'#707070');gr.addColorStop(1,'#c0c0c0');x.fillStyle=gr;x.fillRect(0,0,300,300);
      const flat=texContrast(plain,12),it={id:'w1',type:'shirt',primaryColor:'white',pattern:'woven',sett:s};
      const def=fabricDef('sw',it,'shirt'),fig=fabricDef('fg',it,'shirt','fig'),asStripe={...it,pattern:'stripe'},spec2=specSett(TEX,{tex:c,type:'tie'});
      const L=h=>rgbLab(...hexRgb(h))[0],tn=texTones(colOf(it),s.tex).map(L),f1=s.tex.grid.join('').split('').filter(v=>v==='1').length/96,nv=texTones('#1b2a4a',{...s.tex,lighter:false}).map(L);
      return {s,flat,def,fig,tones:tn,mean:tn[0]*(1-f1)+tn[1]*f1,whiteL:L(colOf(it)),navy:nv,usable:!!usableSett(it),stripeUsable:!!usableSett(asStripe),summary:settSummary(s),sig:settSig(s),text:settText(it,'shirt'),spec2}},TEX);
    ok(sp.s&&sp.s.v===4&&sp.s.tex.kind==='diamond'&&sp.s.tex.grid.length===12&&sp.s.tex.lighter&&sp.s.tex.measured&&sp.s.cr===12&&sp.s.tr===150&&sp.s.src==='claude+pixels','Claude\'s diamond bitmap becomes the shirt\'s pattern reading, with the repeats in the close-up and across the shirt');
    ok(sp.s.tex.rel>.04&&sp.s.tex.rel<.3,`the texture's strength is measured from the user's close-up (a ${Math.round(sp.s.tex.rel*100)}% lightness swing)`);
    ok(sp.flat<.03,`a smooth light falloff is not counted as texture (${(sp.flat*100).toFixed(1)}%)`);
    ok(/<pattern id="sw"/.test(sp.def)&&/<image href="data:image\/png;base64,/.test(sp.def),'the swatch draws the bitmap as a soft tile (threads, not a staircase of squares)');
    ok(sp.tones[0]>90&&sp.tones[1]>sp.tones[0]&&sp.tones[1]-sp.tones[0]<8&&Math.abs(sp.mean-sp.whiteL)<3,`a white shirt stays white: ground L* ${sp.tones[0].toFixed(1)}, raised ${sp.tones[1].toFixed(1)}, averaging ${sp.mean.toFixed(1)} against the tagged white's ${sp.whiteL.toFixed(1)} (no room above white, so the ground darkens slightly; the close-up's grey is not the colour)`);
    ok(sp.navy[1]<sp.navy[0]&&sp.navy[0]-sp.navy[1]>=2.5,'raised threads that read darker draw darker');
    const T=+sp.fig.match(/width="([\d.]+)"/)[1],Tv=+sp.fig.match(/height="([\d.]+)"/)[1];
    ok(Math.abs(Tv/T-1.5)<.01&&sp.s.tex.aspect===1.5,`the tile is stretched to the repeat's measured shape (1.5 times as tall as wide: ${(Tv/T).toFixed(2)})`);
    ok(T>=6&&T<=8,`on the figure a repeat is no finer than 6 units (it would only shimmer): ${T}`);
    ok(sp.usable&&!sp.stripeUsable&&sp.spec2===null,'the texture is drawn only while the shirt is a weave pattern, and only for shirts');
    ok(/diamond dobby/.test(sp.summary)&&/^t/.test(sp.sig)&&/tone-on-tone small diamond dobby weave/.test(sp.text),'it is summarised, has its own signature and is described');
    // Add: a woven shirt with a close-up asks Claude and keeps the texture
    await p.evaluate(async()=>{show('add');const b=await (await fetch('tests/fixtures/shirt-diamond-closeup.jpg')).blob();await addFiles([new File([b],'s.jpg',{type:'image/jpeg'})])});
    await p.waitForFunction(()=>queue[0]&&queue[0].pattern==='woven',null,{timeout:20000});
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/shirt-diamond-closeup.jpg')).blob();await addTexture(0,new File([b],'c.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0].sett&&queue[0].sett.tex,null,{timeout:20000});
    const card=await p.evaluate(()=>document.querySelector('#queue').textContent);
    ok(calls.length===1&&calls[0].type==='shirt'&&calls[0].closeup&&/diamond dobby weave/.test(card),'adding a woven shirt\'s close-up asks Claude for its weave, and the card says so');
    await p.evaluate(()=>save(0));
    const sv=await p.evaluate(()=>{const it=items.find(i=>i.type==='shirt');return {tex:!!(it.sett&&it.sett.tex),spec:!!it.patternSpec,key:comboKey({shirt:it})}});
    ok(sv.tex&&sv.spec,'the saved shirt keeps the texture and Claude\'s reading');
    // Claude unavailable: no stripes are made up from the weave
    patternReply=()=>[502,{error:'ai'}];
    await p.evaluate(async()=>{const b=await (await fetch('tests/fixtures/shirt-diamond-closeup.jpg')).blob();await addFiles([new File([b],'s.jpg',{type:'image/jpeg'})]);await addTexture(0,new File([b],'c.jpg',{type:'image/jpeg'}))});
    await p.waitForFunction(()=>queue[0]&&!queue[0].patternReading&&queue[0].specFailed,null,{timeout:20000});
    ok(await p.evaluate(()=>!queue[0].sett),'when Claude can\'t read the weave, the shirt keeps its generic drawing (the band reader is not used on a weave)');
    await p.evaluate(()=>{queue=[];renderAdd()});
    // Settings: read the weaves of textured shirts that have a close-up but no reading
    patternReply=()=>[200,{...TEX,model:'m'}];
    await p.evaluate(async()=>{const it=items.find(i=>i.type==='shirt');delete it.sett;delete it.patternSpec;await put(it);show('settings')});
    const ui=await p.evaluate(()=>{renderWeaveUI();return document.querySelector('#weave-box').textContent});
    ok(/1 textured shirt/.test(ui),'Settings offers to read the one textured shirt without a weave reading');
    const before=calls.length;await p.evaluate(()=>readWeaves());
    const after=await p.evaluate(()=>({tex:!!items.find(i=>i.type==='shirt').sett.tex,ui:document.querySelector('#weave-box').textContent}));
    ok(calls.length===before+1&&after.tex&&/has its weave read/.test(after.ui),'"Read shirt weaves" reads it and the list empties');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
