// The pattern for the realistic photo: described from the measurements (direction as the viewer sees it, each colour's share in
// Claude's own colour names), Claude's own words with any direction taken out (it once had a plaid tie's stripes rising the
// wrong way, and the generator followed), and a drawing of the measured pattern sent as a reference.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const sent=[];await ctx.route('https://w.test/**',async route=>{const q=route.request();if(q.method()!=='POST')return route.fulfill({status:404,contentType:'application/json',body:'{}'});sent.push(JSON.parse(q.postData()));
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(JSON.parse(q.postData()).mode==='queue'?{queued:true}:{image:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',model:'m'})})});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.evaluate(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','t')});await p.reload();await p.waitForFunction(()=>window.appReady);
  const CLAUDE='A shiny silk-look tie with broad diagonal stripes rising from lower left to upper right: wide taupe-brown bands edged by narrow dark brown lines, alternating with cream, steel blue and pale icy blue stripes and a wide beige band.';
  const weave={layout:'stripes-with-crossing-lines',direction:'lower-left to upper-right',repeatsAcross:1,colours:[{name:'taupe brown',hex:'#7e7363',width:'wide'},{name:'dark brown',hex:'#5e5446',width:'narrow'},
    {name:'cream',hex:'#e6e1cf',width:'medium'},{name:'steel blue',hex:'#8a9ab2',width:'medium'},{name:'pale blue',hex:'#dce6ee',width:'narrow'},{name:'beige',hex:'#c2b8a6',width:'wide'}],crossing:'',description:CLAUDE};
  const r=await p.evaluate(async([CLAUDE,weave])=>{
    const im=new Image();im.src='tests/fixtures/tie-plaid.jpg';await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
    const plain=settFromCanvas(applyWb(c,wbGains(c)),{x:293,y:272,w:339,h:543}),sett=settFrom({full:c,box:{x:293,y:272,w:339,h:543},weave,type:'tie'});
    const tie={id:'t',type:'tie',primaryColor:'taupe',pattern:'stripe',sett,weave,patternText:CLAUDE};
    const L=s=>Math.max(...s.bands.map(b=>rgbLab(...hexRgb(b[0]))[0]));
    const dia=await patternDiagram(tie,'tie'),dim=await new Promise(ok=>{const i=new Image();i.onload=()=>ok([i.width,i.height]);i.src=dia});
    const o={top:{id:'s',type:'suit',primaryColor:'navy',pattern:'solid',photo:dia},shirt:{id:'h',type:'shirt',primaryColor:'cream',pattern:'solid'},tie:{...tie,photo:dia},suitDay:true};
    const refs=await outfitRefsFull(o);
    return {prompt:patternPrompt(tie,'tie'),down:settDirText({a:-46},'tie'),up:settDirText({a:46},'tie'),suit:settDirText({a:4},'top'),tr:sett.tr,lighter:L(sett)-L(plain),
      dim,labels:refs.labels,n:refs.refs.length,text:outfitText(o),
      drop:dropDir('Bold stripes running from the upper-left to the lower-right, with fine lines.')}},[CLAUDE,weave]);
  ok(r.down==='diagonal stripes running from the upper left down to the lower right, as the viewer sees them'&&/lower left up to the upper right/.test(r.up)&&r.suit==='vertical stripes','the direction is written from the measured angle, as the viewer sees it (a jacket\'s stripes are straight)');
  ok(/^measured: diagonal stripes running from the upper left down to the lower right/.test(r.prompt)&&!/rising from lower left to upper right/.test(r.prompt)&&/wide taupe-brown bands/.test(r.prompt),'the photo prompt leads with the measurements and keeps Claude\'s words without its (wrong) direction');
  ok(r.drop==='Bold stripes, with fine lines.','direction phrases in Claude\'s words are taken out');
  ok(/the bands are about \d+% (taupe brown|dark brown)/.test(r.prompt)&&/steel blue/.test(r.prompt)&&/cream/.test(r.prompt),`each colour's share is given in Claude's colour names (${r.prompt.match(/about [^;]*/)[0]})`);
  ok(r.lighter>5,`an underexposed photo is brightened from its white reference before the pattern is read (lightest band +${r.lighter.toFixed(0)} L*)`);
  ok(Math.abs(r.tr-.61)<.08,`a tie's scale comes from its photo (${r.tr} repeats across), not Claude's estimate (1)`);
  ok(r.dim[0]===360&&r.dim[1]>1300,'the pattern drawing is the tie\'s blade, tip down, large');
  const at=r.labels.findIndex(l=>/^a drawing of the tie's measured pattern as worn/.test(l));
  ok(at===r.labels.indexOf('the tie')+1&&r.n<=8,`the drawing goes right after the tie's photo (${r.labels.join(' | ')})`);
  ok(/stripe tie \(measured: diagonal stripes running from the upper left down to the lower right/.test(r.text),'the outfit text carries the measured description');
  // the worker keeps the label whole
  let form=null;const real=globalThis.fetch;globalThis.fetch=async(h,init)=>{form=init.body;return new Response(JSON.stringify({data:[{b64_json:'AAAA'}]}),{status:200,headers:{'content-type':'application/json'}})};
  try{const lab=r.labels[at],IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
    await worker.fetch(new Request('https://w.test/render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify({image:IMG,refs:[IMG],labels:[lab],outfit:'x'})}),{APP_TOKEN:'t',OPENAI_API_KEY:'k'});
    ok(form&&form.get('prompt').includes(lab),'the worker passes the drawing\'s label on whole')}finally{globalThis.fetch=real}
  // both ways of making a photo send the drawing
  await p.evaluate(async()=>{const im=new Image();im.src='tests/fixtures/tie-plaid.jpg';await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
    const tie={id:'t2',type:'tie',primaryColor:'taupe',pattern:'stripe',photo:c.toDataURL('image/jpeg',.5),sett:settFrom({full:c,box:{x:293,y:272,w:339,h:543},type:'tie'})};
    const o={top:{id:'s2',type:'suit',primaryColor:'navy',pattern:'solid'},shirt:{id:'h2',type:'shirt',primaryColor:'white',pattern:'solid'},tie,suitDay:true};
    await renderCombo(o);await queueCombo(o)});
  ok(sent.length===2&&sent.every(b=>b.labels.some(l=>/measured pattern/.test(l))&&b.refs.length===b.labels.length),'a photo made now and one queued for the worker both send the pattern drawing');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
