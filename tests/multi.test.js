// Several items in one photo: the worker asks Claude (mocked) for every item with a rough box; the app makes one card per
// item with a crop of that item, and Save all adds them. Covers a shirt rail and a mixed rail of suits, blazer and trousers.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const realFetch=globalThis.fetch;let sent=null,reply=null;
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.anthropic.com/v1/messages')return new Response('',{status:404});
    sent=JSON.parse(init.body);const [st,b]=reply();return new Response(JSON.stringify(b),{status:st,headers:{'content-type':'application/json'}})};
  const claude=items=>()=>[200,{model:'claude-opus-5-5',stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify({items})}]}];
  const T=(type,primaryColor,pattern,box,x={})=>({type,primaryColor,secondaryColor:'none',tertiaryColor:'none',pattern,metal:null,leather:null,dial:null,band:null,bezel:null,confidence:'high',box,...x});
  // 11 shirts as vertical bands, given to Claude's mock out of order; colours chosen to be easy to tell apart in the crops
  const SHIRTS=[['paleyellow','#f1e6ac','solid'],['midgrey','#a2a4a8','fine-texture'],['lightblue','#a9c7e4','solid'],['white','#f6f6f3','dobby'],['pink','#e3a5b4','solid'],
    ['white','#f6f6f3','woven'],['lavender','#c9bfe2','solid'],['periwinkle','#9ea8d4','end-on-end'],['ivory','#f4efde','solid'],['white','#f6f6f3','textured'],['beige','#dccbb0','solid']];
  const band=1000/11,shirtItems=SHIRTS.map(([c,,p],k)=>T('shirt',c,p,{x:Math.round(k*band+8),y:20,w:Math.round(band-16),h:950},{confidence:k===7?'low':k%3?'high':'medium'}));
  const env={APP_TOKEN:'t',ANTHROPIC_API_KEY:'k'},HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    // ---- worker ----
    reply=claude([...shirtItems].reverse().concat([T('shirt','white','solid',{x:990,y:-50,w:400,h:2000})]));
    const call=(b,h={'x-app-token':'t'},e=env)=>worker.fetch(new Request(HOST+'tag-many',{method:'POST',headers:{'content-type':'application/json',...h},body:JSON.stringify(b)}),e);
    let r=await call({image:'data:image/jpeg;base64,/9j/'});const j=await r.json();
    ok(r.status===200&&j.items.length===12&&j.model==='claude-opus-5-5','the worker returns every item Claude lists');
    ok(j.items.slice(0,11).map(i=>i.primaryColor).join()===SHIRTS.map(s=>s[0]).join(),'items come back sorted left to right');
    const last=j.items[11].box;ok(last.x===990&&last.y===0&&last.x+last.w<=1000&&last.y+last.h<=1000,'out-of-range boxes are clamped to the image');
    const sch=sent.output_config.format.schema.properties.items.items;
    ok(sch.required.includes('box')&&sch.required.includes('confidence')&&sch.properties.box.required.join()==='x,y,w,h'&&sch.additionalProperties===false,'structured output asks for a box and confidence per item');
    ok(sent.max_tokens>=16000&&sent.output_config.effort==='medium','enough tokens and effort for a long list');
    const pr=sent.messages[0].content[1].text;
    ok(/ONE item of type suit/.test(pr)&&/jacket hanging on its own is a blazer/.test(pr)&&/Trousers hanging or folded/.test(pr)&&/left to right/.test(pr),'the prompt covers suits (jacket + trousers = one), blazers, trousers and order');
    ok(/periwinkle/.test(pr)&&/end-on-end/.test(pr),'the prompt includes the full colour and texture lists');
    ok((await call({image:'x'},{})).status===403,'needs the app token');
    ok((await call({image:'x'},{'x-app-token':'t'},{APP_TOKEN:'t'})).status===501,'without a Claude key it says one is needed');
    // ---- app: a shirt rail ----
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    reply=claude(shirtItems);
    await p.evaluate(()=>{items=[];show('add')});
    ok(await p.isVisible('#add-group')&&await p.isVisible('#add-one'),'Add asks for one item or several items in one photo');
    const rail=await p.evaluate(async S=>{const c=document.createElement('canvas');c.width=1100;c.height=600;const x=c.getContext('2d');
      S.forEach(([, hex],k)=>{x.fillStyle=hex;x.fillRect(k*100,0,100,600)});const b=await new Promise(r=>c.toBlob(r,'image/png'));
      await addFiles([new File([b],'rail.png',{type:'image/png'})],true);
      const avg=src=>{const im=new Image();return new Promise(r=>{im.onload=()=>{const k=document.createElement('canvas');k.width=k.height=8;const g=k.getContext('2d');g.drawImage(im,im.width*.3,im.height*.3,im.width*.4,im.height*.4,0,0,8,8);
        const d=g.getImageData(0,0,8,8).data;let R=0,G=0,B=0;for(let i=0;i<d.length;i+=4){R+=d[i];G+=d[i+1];B+=d[i+2]}r([R,G,B].map(v=>Math.round(v/64)))};im.src=src})};
      const crops=await Promise.all(queue.map(q=>avg(q.photo)));
      return {n:queue.length,types:queue.map(q=>q.type).join(),cols:queue.map(q=>q.primaryColor).join(),pats:queue.map(q=>q.pattern).join(),crops,
        heads:[...document.querySelectorAll('#queue .multi-h')].map(e=>e.textContent),status:document.querySelector('#multi-status').textContent,
        saveAll:(document.querySelector('#save-all button')||{}).textContent||''}},SHIRTS);
    ok(rail.n===11&&rail.types.split(',').every(t=>t==='shirt'),'one card per shirt (11)');
    ok(rail.cols===SHIRTS.map(s=>s[0]).join()&&rail.pats===SHIRTS.map(s=>s[2]).join(),'each card has that shirt\'s colour and texture, including the shirt-only colours');
    const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=12);
    ok(rail.crops.every((c,k)=>near(c,hex(SHIRTS[k][1]))),'each card\'s photo is cropped to its own shirt');
    ok(rail.heads[0]==='Item 1 of 11 medium confidence'&&rail.heads[7].includes('low confidence'),'cards say which item they are and how confident the tag is');
    ok(/Found 11 items \(11 dress shirts\)/.test(rail.status)&&rail.saveAll==='Save all 11 items','a summary and a Save all button');
    // skip one, save the rest
    await p.evaluate(()=>{queue.splice(4,1);renderAdd()});
    await p.click('#save-all button');await p.waitForFunction(()=>queue.length===0&&items.length===10);
    const saved=await p.evaluate(()=>items.map(i=>i.type+':'+i.primaryColor+':'+i.pattern).sort().join(','));
    ok(saved.split(',').length===10&&!/pink/.test(saved)&&/lavender/.test(saved)&&/periwinkle:end-on-end/.test(saved)&&saved.split(',').every(s=>s.startsWith('shirt:')),'Save all adds the 10 kept shirts with their tags (the skipped one is not added)');
    // ---- app: suits, a blazer and trousers ----
    reply=claude([T('suit','navy','pinstripe',{x:10,y:20,w:230,h:940},{secondaryColor:'white'}),T('suit','charcoal','solid',{x:250,y:20,w:230,h:940}),
      T('blazer','navy','solid',{x:490,y:20,w:230,h:600},{confidence:'medium'}),T('pants','grey','solid',{x:730,y:300,w:250,h:660}),T('pants','lavender','solid',{x:730,y:960,w:250,h:30},{confidence:'low'})]);
    const mixed=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=600;c.getContext('2d').fillRect(0,0,800,600);const b=await new Promise(r=>c.toBlob(r,'image/png'));
      await addFiles([new File([b],'rail.png',{type:'image/png'})],true);
      const forms=[...document.querySelectorAll('#queue .card')].map(cd=>[...cd.querySelectorAll('select')].map(s=>s.value).join('/'));
      return {cards:queue.map(q=>q.type+':'+q.primaryColor+':'+q.pattern+':'+(q.secondaryColor||'')).join(','),status:document.querySelector('#multi-status').textContent,forms,
        vestOpt:[...document.querySelectorAll('#queue select')].some(s=>[...s.options].some(o=>o.textContent==='Matching vest')),
        suitPats:PATS_BY.suit.includes(queue[0].pattern),tiny:queue[4].photo.length>100}});
    ok(mixed.cards==='suit:navy:pinstripe:white,suit:charcoal:solid:,blazer:navy:solid:,pants:grey:solid:,pants:lightblue:solid:','suits, blazer and trousers each get their own card with the right type, colour and pattern');
    ok(/Found 5 items \(2 suits, 1 blazer, 2 trousers\)/.test(mixed.status),`the summary counts each kind (${mixed.status})`);
    ok(mixed.suitPats&&mixed.vestOpt,'suit cards use the suiting patterns and offer the vest option');
    ok(mixed.cards.includes('pants:lightblue'),'a shirt colour tagged on trousers moves to the closest trouser colour (lavender → light blue)');
    ok(mixed.tiny,'even a sliver-sized box gives a usable crop');
    await p.click('#save-all button');await p.waitForFunction(()=>queue.length===0);
    const s2=await p.evaluate(()=>({suits:items.filter(i=>i.type==='suit').map(i=>hasVest(i)).join(),n:items.length}));
    ok(s2.n===15&&s2.suits==='false,false','saved suits have no waistcoat unless the card says so (the default since the dress code)');
    // errors
    reply=()=>[200,{model:'m',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({items:[]})}]}];
    await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=50;const b=await new Promise(r=>c.toBlob(r,'image/png'));await addFiles([new File([b],'x.png',{type:'image/png'})],true)});
    ok(/No clothing items were found/.test(await p.textContent('#multi-status')),'a photo with nothing found says so');
    await ctx.unroute(HOST+'**');await ctx.route(HOST+'**',r=>r.fulfill({status:405,contentType:'application/json',body:'{"error":"method not allowed"}'}));
    await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=50;const b=await new Promise(r=>c.toBlob(r,'image/png'));await addFiles([new File([b],'x.png',{type:'image/png'})],true)});
    ok(/needs an update/.test(await p.textContent('#multi-status')),'an old worker is explained');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
