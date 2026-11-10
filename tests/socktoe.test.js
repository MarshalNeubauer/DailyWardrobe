// Socks: the secondary colour is a contrasting toe cap. The tagger is told so, the drawing shows it, the description names it,
// the editor calls it "Toe cap", and the product picture is a single sock in side profile on pure white.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const src=require('fs').readFileSync(path.join(ROOT,'worker.js'),'utf8');
  ok(/Socks: the colour of a contrasting toe cap/.test(src),'the tagging prompt puts a sock\'s toe cap colour in secondaryColor');
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch;const gens=[],sent=[];
  globalThis.fetch=async(href,init)=>{if(String(href)==='https://api.openai.com/v1/images/generations'){gens.push(JSON.parse(init.body));
      return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})}
    return new Response('',{status:404})};
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)},delete:async k=>{store.delete(k)}};
  const queued=[];const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV,RENDER_QUEUE:{send:async m=>{queued.push(m)}}},HOST='https://w.test/';
  const post=b=>worker.fetch(new Request(HOST+'render',{method:'POST',headers:{'x-app-token':'t','content-type':'application/json'},body:JSON.stringify(b)}),env);
  const browser=await chromium.launch();
  try{
    await post({mode:'item',item:'a single black dress sock',key:'c00000000000000a1',bg:'white'});
    await post({mode:'item',item:'a pair of black shoes',key:'c00000000000000a2'});
    ok(/Pure white seamless background/.test(gens[0].prompt)&&!/warm-grey/.test(gens[0].prompt),'bg white: the product picture is on pure white');
    ok(/light warm-grey/.test(gens[1].prompt)&&!/Pure white/.test(gens[1].prompt),'other items keep the warm-grey backdrop');
    await post({mode:'item',item:'a single navy dress sock',key:'c00000000000000a3',bg:'white',queue:true});
    ok(JSON.parse(store.get('job:c00000000000000a3')).bg==='white'&&queued.length===1,'a queued sock picture keeps the white background');
    // app
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();if(q.method()==='POST')sent.push(JSON.parse(q.postData()));
      const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    const a=await p.evaluate(async()=>{const s={id:'sk1',type:'socks',primaryColor:'black',secondaryColor:'lightgrey',pattern:'solid',added:1},plain={id:'sk2',type:'socks',primaryColor:'black',pattern:'solid',added:1};
      const th=itemThumb(s,true),th0=itemThumb(plain,true);items=[s,plain];
      await renderItemPic(s);
      return {d:itemDesc(s),d0:itemDesc(plain),desc:desc(s),desc0:desc(plain),toe:/class="sock-toe"[^>]*fill="#[0-9a-f]{6}"/i.test(th)&&th.includes(COLORS.lightgrey),toe0:/sock-toe/.test(th0),
        keys:itemKey(s)!==itemKey(plain),form:editForm(s),form0:editForm({id:'t1',type:'tie',primaryColor:'navy',pattern:'solid'})}});
    ok(/single black .*dress sock in side profile/.test(a.d)&&/light grey knitted toe cap/.test(a.d)&&/heel stays black/.test(a.d),`the picture description is one sock in profile with its toe cap (${a.d.slice(0,60)}…)`);
    ok(!/toe cap/.test(a.d0)&&/toe and heel the same colour/.test(a.d0)&&a.keys,'a plain sock has no toe cap, and gets its own picture');
    ok(a.desc==='black, light grey toe'&&a.desc0==='black',`the name says the toe colour (${a.desc})`);
    ok(a.toe&&!a.toe0,'the drawing shows the toe cap in its colour, and none on a plain sock');
    ok(/Toe cap <select/.test(a.form)&&!/Third colour/.test(a.form)&&/Secondary <select/.test(a.form0),'the editor calls a sock\'s secondary colour "Toe cap" and drops the third colour');
    const req=sent.find(b=>b.mode==='item');
    ok(req&&req.bg==='white'&&/toe cap/.test(req.item),'the app asks the worker for a sock picture on white');
    // the Add card says Toe cap too
    const add=await p.evaluate(()=>{show('add');queue=[{id:'q1',manual:true,type:'socks',primaryColor:'navy',secondaryColor:'grey',pattern:'solid'}];renderAdd();return $('#add').textContent});
    ok(/Toe cap/.test(add)&&!/Tertiary Colour/.test(add),'the Add card labels the sock\'s secondary colour "Toe cap"');
    // the planner ignores the toe cap (it is hidden in the shoe)
    const pl=await p.evaluate(()=>sockScore(null,null,{type:'socks',primaryColor:'navy',secondaryColor:'lightgrey',pattern:'solid'})===sockScore(null,null,{type:'socks',primaryColor:'navy',pattern:'solid'}));
    ok(pl,'the toe cap does not change how socks are chosen');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
